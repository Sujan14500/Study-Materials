"""A deterministic stand-in for an OpenAI-compatible API, so every notebook runs
with no API key, no network and no cost.

It is not a language model. It plugs into the *real* OpenAI SDK as an httpx
transport, so the notebook code is exactly the code you would run against
OpenAI or Ollama; only the answers are worse. `llm_setup.py` wires it in when
there is no OPENAI_API_KEY and no local Ollama server. You never need to read
this file to use the notebooks.

What it answers
  POST /chat/completions   text, tools (incl. parallel calls), json_schema and
                           json_object, streaming, logprobs, n, max_tokens
  POST /responses          text, function tools, text.format json_schema,
                           streaming, previous_response_id
  POST /embeddings         hashed bag-of-words vectors with a small synonym
                           table, so texts that share words (or synonyms) land
                           close together; float or base64 encoding
  POST /moderations        keyword flags
  GET  /models
  POST /files, GET /files, GET /files/{id}
  POST /fine_tuning/jobs, GET /fine_tuning/jobs[/{id}[/events]], POST .../cancel

How it "thinks", in order
  structured output requested   -> an instance of the JSON schema, filled from the prompt
  tools offered, none called yet -> the tool whose name/description best matches the
                                    user message, arguments pulled from the message
  tool results present           -> a final answer that quotes the tool results
  "what is my X?"                -> recalled from an earlier "my X is Y"
  arithmetic                     -> computed
  classify / sentiment           -> a label from the options in the prompt
  summarise                      -> the first sentences of the text
  a question plus context        -> the context sentence that best matches (extractive RAG)
  anything else                  -> a canned reply that says it is offline

Like the real API, it rejects the mistakes that are easy to make in an agent
loop: a tool message whose tool_call_id answers no preceding tool call, an
assistant tool call left without a tool message, a function_call_output with
an unknown call_id, and strict schemas without additionalProperties: false.

Knobs (reach them as llm_setup.OFFLINE)
  OFFLINE.latency = 0.3          seconds per request; async requests overlap, so
                                 asyncio.gather() is visibly faster than a for loop
  OFFLINE.token_delay = 0.02     seconds between streamed chunks (time-to-first-token demos)
  OFFLINE.fail_next(2, 429)      the next two requests fail with that status
  OFFLINE.request_count          how many requests have been served (cache demos)
"""

from __future__ import annotations

import ast
import asyncio
import base64
import hashlib
import json
import math
import operator
import re
import struct
import threading
import time

import httpx

# ----------------------------------------------------------------- text utils

STOPWORDS = set("""
a an the is are was were be been being am of to in on for with and or but if then so as at by from
this that these those it its i you he she we they me my your our their them his her what which who
whom whose when where why how do does did can could should would will shall may might must not no
yes please tell give show about into over under than also just only very more most some any all each
there here have has had get got let use using given based answer question context following below
above say said like one two per via vs etc s t
""".split())

_SYNONYM_GROUPS = [
    "car cars automobile automobiles vehicle vehicles auto",
    "dog dogs puppy puppies canine",
    "cat cats kitten kittens feline",
    "happy glad joyful cheerful delighted",
    "sad unhappy sorrowful miserable",
    "refund refunds reimbursement reimburse repay",
    "price prices cost costs pricing fee fees charge charges expensive cheap",
    "buy purchase purchased bought",
    "fast quick rapid speedy quickly",
    "big large huge enormous",
    "small tiny little",
    "doctor doctors physician physicians",
    "movie movies film films",
    "error errors bug bugs failure failures fault crash crashed",
    "password passwords credentials login",
    "ship shipping shipped delivery deliver delivered",
    "cancel cancellation cancelled canceled terminate",
    "computer computers laptop laptops pc",
    "ocean oceans sea seas",
    "start begin started began",
    "help support assist assistance",
    "weather forecast",
    "money cash funds payment payments pay paid",
    "employee employees staff worker workers",
    "vacation holiday holidays pto leave",
    "sick ill illness",
    "house home homes houses",
    "phone phones smartphone mobile",
]
SYNONYMS = {}
for _g in _SYNONYM_GROUPS:
    _words = _g.split()
    for _w in _words:
        SYNONYMS[_w] = _words[0]

POSITIVE = set("""love loved lovely great excellent amazing good happy fantastic wonderful best awesome like
liked enjoy enjoyed perfect recommend helpful pleased delighted superb brilliant nice glad works
smooth easy fast friendly""".split())
NEGATIVE = set("""hate hated terrible awful bad worst poor broken slow disappointed disappointing angry
useless horrible waste late rude refund never crash crashed buggy error annoying frustrating failed
fails worse cold""".split())


def _stem(w: str) -> str:
    if len(w) > 5 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 5 and w.endswith("ing"):
        return w[:-3]
    if len(w) > 4 and w.endswith("ed"):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def concept(w: str) -> str:
    w = w.lower()
    if w in SYNONYMS:
        return SYNONYMS[w]
    s = _stem(w)
    return SYNONYMS.get(s, s)


def content_words(text: str) -> list[str]:
    return [concept(w) for w in words(text) if w not in STOPWORDS and len(w) > 1]


def approx_tokens(text: str) -> int:
    return max(1, len(text or "") // 4)


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text or "")
    return [p.strip() for p in parts if p and p.strip()]


# ------------------------------------------------------------------ embedding

def embed(text: str, dims: int = 1536) -> list[float]:
    """Hashed bag of concepts + word bigrams + character trigrams, L2-normalised."""
    vec = [0.0] * dims
    cw = content_words(text) or words(text) or ["<empty>"]
    feats = [(w, 1.0) for w in cw]
    feats += [(a + "_" + b, 0.5) for a, b in zip(cw, cw[1:])]
    for w in cw:
        padded = f"#{w}#"
        feats += [("3:" + padded[i:i + 3], 0.25) for i in range(len(padded) - 2)]
    for f, weight in feats:
        h = hashlib.md5(f.encode()).digest()
        idx = int.from_bytes(h[:4], "little") % dims
        sign = 1.0 if h[4] & 1 else -1.0
        vec[idx] += sign * weight
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


# ----------------------------------------------------------- safe arithmetic

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.Mod: operator.mod, ast.FloorDiv: operator.floordiv,
        ast.USub: operator.neg, ast.UAdd: operator.pos}


def safe_eval(expr: str):
    def ev(node):
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.operand))
        raise ValueError("not arithmetic")
    return ev(ast.parse(expr.replace("^", "**"), mode="eval"))


def find_expression(text: str):
    cands = re.findall(r"[\d\.\s\+\-\*/\(\)\^%x×÷]+", text or "")
    best = None
    for c in cands:
        c = c.replace("×", "*").replace("÷", "/")
        c = re.sub(r"(?<=\d)\s*x\s*(?=\d)", "*", c).strip()
        if not re.search(r"\d", c) or not re.search(r"[\+\-\*/\^%]", c.strip("-")):
            continue
        try:
            val = safe_eval(c)
        except Exception:
            continue
        if best is None or len(c) > len(best[0]):
            best = (c, val)
    return best


def fmt_number(v):
    if isinstance(v, float):
        if v.is_integer():
            return str(int(v))
        return f"{v:.6g}"
    return str(v)


# ------------------------------------------------------ argument extraction

_CAP_SKIP = set("""What Whats What's Who How Why When Where Which Is Are Was Can Could Should Would Will Do Does
Did Please Tell Give Show Find Get Look The A An I In On At For And Or But My Our Your Their Hi Hello Hey
Also Then Now Today Tomorrow Yesterday Compare Check Calculate Compute Book Send Search Summarize Explain
Use Using Make Create Write Add List Monday Tuesday Wednesday Thursday Friday Saturday Sunday Extract Return
Classify Translate Answer Reply Respond Format Output Parse Identify Generate Rewrite Review Note Context
Question Text Input User Assistant System JSON Name Email Here There This That These Those It""".split())


def capitalized_entities(text: str) -> list[str]:
    ents = []
    for m in re.finditer(r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b", text or ""):
        phrase = m.group(1)
        toks = [t for t in phrase.split() if t not in _CAP_SKIP]
        if toks:
            e = " ".join(toks)
            if e not in ents:
                ents.append(e)
    return ents


def numbers_in(text: str) -> list[float]:
    out = []
    for m in re.finditer(r"(?<![\w.])-?\d+(?:,\d{3})*(?:\.\d+)?", text or ""):
        s = m.group(0).replace(",", "")
        out.append(float(s) if "." in s else int(s))
    return out


def _string_for(name: str, schema: dict, text: str, used: set):
    n = name.lower()
    if schema.get("enum"):
        for e in schema["enum"]:
            if str(e).lower() in (text or "").lower():
                return e
        return schema["enum"][0]
    if any(k in n for k in ("expression", "expr", "formula", "equation", "calculation")):
        found = find_expression(text)
        return found[0] if found else (text or "1+1").strip()[:80]
    if "email" in n:
        m = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text or "")
        return m.group(0).rstrip(".") if m else "user@example.com"
    if "url" in n or "link" in n:
        m = re.search(r"https?://\S+", text or "")
        return m.group(0).rstrip(".,)") if m else "https://example.com"
    if "date" in n or n.endswith("_on") or n == "day":
        m = re.search(r"\d{4}-\d{2}-\d{2}", text or "")
        return m.group(0) if m else "2026-01-15"
    is_id = n == "id" or n.endswith("_id") or (n.endswith("id") and len(n) <= 8 and n not in ("paid", "valid"))
    if is_id or ("number" in n and "phone" not in n):
        m = re.search(r"#?\b([A-Z]{0,4}-?\d{3,})\b", text or "")
        return m.group(1) if m else "12345"
    if any(k in n for k in ("city", "location", "place", "country", "destination", "origin", "region", "where")):
        for e in capitalized_entities(text):
            if e not in used:
                used.add(e)
                return e
        return "London"
    if any(k in n for k in ("query", "question", "search", "text", "input", "prompt", "content", "message",
                            "description", "body", "task", "request", "topic", "statement")):
        return (text or "").strip()[:300]
    if any(k in n for k in ("lang", "language")):
        return "en"
    if "unit" in n:
        return "celsius"
    if any(k in n for k in ("name", "title", "product", "item", "company", "person", "user", "customer", "ticker", "symbol")):
        for e in capitalized_entities(text):
            if e not in used:
                used.add(e)
                return e
    cw = content_words(text)
    return cw[0] if cw else "example"


def instance_from_schema(schema: dict, text: str, defs: dict | None = None, name: str = "value", used=None, nums=None):
    """A value that satisfies `schema`, filled with whatever the prompt offers."""
    defs = defs if defs is not None else (schema.get("$defs") or schema.get("definitions") or {})
    used = used if used is not None else set()
    nums = nums if nums is not None else list(numbers_in(text))
    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        return instance_from_schema(defs.get(ref, {}), text, defs, name, used, nums)
    for key in ("anyOf", "oneOf"):
        if key in schema:
            opts = [o for o in schema[key] if o.get("type") != "null"] or schema[key]
            return instance_from_schema(opts[0], text, defs, name, used, nums)
    if "allOf" in schema:
        return instance_from_schema(schema["allOf"][0], text, defs, name, used, nums)
    if "const" in schema:
        return schema["const"]
    if "default" in schema and schema.get("default") is not None and schema.get("type") not in ("object", "array"):
        return schema["default"]
    t = schema.get("type")
    if isinstance(t, list):
        t = next((x for x in t if x != "null"), "string")
    if t == "object" or "properties" in schema:
        props = schema.get("properties", {})
        return {k: instance_from_schema(v, text, defs, k, used, nums) for k, v in props.items()}
    if t == "array":
        item = instance_from_schema(schema.get("items", {"type": "string"}), text, defs, name, used, nums)
        n = max(1, int(schema.get("minItems", 1)))
        return [item for _ in range(n)]
    if t in ("integer", "number"):
        lo = schema.get("minimum", schema.get("exclusiveMinimum"))
        hi = schema.get("maximum", schema.get("exclusiveMaximum"))
        if "exclusiveMinimum" in schema and "minimum" not in schema:
            lo = lo + (1 if t == "integer" else 1e-6)
        if "exclusiveMaximum" in schema and "maximum" not in schema:
            hi = hi - (1 if t == "integer" else 1e-6)
        val = None
        while nums:                       # first number in the prompt that fits the bounds
            cand = nums.pop(0)
            if (lo is None or cand >= lo) and (hi is None or cand <= hi):
                val = cand
                break
        if val is None:
            val = lo if lo is not None else (hi if hi is not None and hi < 1 else 1)
        return int(val) if t == "integer" else float(val)
    if t == "boolean":
        return name.lower().replace("_", " ") in (text or "").lower()
    if t == "null":
        return None
    s = _string_for(name, schema, text, used)
    if schema.get("maxLength"):
        s = str(s)[: schema["maxLength"]]
    return s


# ------------------------------------------------------ schema strictness

def strict_problems(schema: dict, path: str = "root", defs: dict | None = None) -> list[str]:
    probs = []
    if not isinstance(schema, dict):
        return probs
    defs = defs if defs is not None else (schema.get("$defs") or {})
    is_obj = schema.get("type") == "object" or "properties" in schema
    if is_obj:
        props = schema.get("properties", {})
        if schema.get("additionalProperties", True) is not False:
            probs.append(f"In context=({path}), 'additionalProperties' is required to be supplied and to be false.")
        req = schema.get("required", [])
        missing = [k for k in props if k not in req]
        if missing:
            probs.append(f"In context=({path}), 'required' is required to be supplied and to be an array "
                         f"including every key in properties. Missing '{missing[0]}'.")
        for k, v in props.items():
            probs += strict_problems(v, f"{path}.{k}", defs)
    if "items" in schema:
        probs += strict_problems(schema["items"], path + "[]", defs)
    for key in ("anyOf", "oneOf", "allOf"):
        for i, sub in enumerate(schema.get(key, [])):
            probs += strict_problems(sub, f"{path}.{key}[{i}]", defs)
    if path == "root":
        for k, v in defs.items():
            probs += strict_problems(v, f"$defs.{k}", defs)
    return probs


# ------------------------------------------------------------ the "model"

def content_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    out = []
    for p in content:
        if isinstance(p, dict):
            if p.get("type") in ("text", "input_text", "output_text"):
                out.append(p.get("text", ""))
            elif p.get("type") in ("image_url", "input_image"):
                out.append("[image]")
            elif p.get("type") in ("input_file", "file"):
                out.append("[file]")
        elif isinstance(p, str):
            out.append(p)
    return "\n".join(out)


def norm_tools(tools) -> list[dict]:
    out = []
    for t in tools or []:
        if t.get("type") == "function" and "function" in t:
            f = t["function"]
            out.append({"name": f.get("name"), "description": f.get("description", ""),
                        "parameters": f.get("parameters") or {"type": "object", "properties": {}},
                        "strict": f.get("strict")})
        elif t.get("type") == "function":
            out.append({"name": t.get("name"), "description": t.get("description", ""),
                        "parameters": t.get("parameters") or {"type": "object", "properties": {}},
                        "strict": t.get("strict")})
    return out


def _name_tokens(name: str) -> list[str]:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", name or "")
    return [concept(w) for w in re.split(r"[_\-\s]+", s.lower()) if w and w not in STOPWORDS]


def _tool_score(tool: dict, text: str) -> float:
    uw = set(content_words(text))
    name_t = set(_name_tokens(tool["name"]))
    desc_t = set(content_words(tool.get("description", "")))
    props = (tool.get("parameters") or {}).get("properties", {})
    param_t = set(t for p in props for t in _name_tokens(p))
    score = 2.0 * len(uw & name_t) + 1.0 * len(uw & desc_t) + 0.5 * len(uw & param_t)
    if find_expression(text) and name_t & {"calculat", "calculator", "math", "calc", "add", "multiply",
                                           "compute", "arithmetic", "evaluate", "sum"}:
        score += 3
    return score


def pick_tool_calls(user_text: str, tools: list[dict], tool_choice, seed: int) -> list[dict]:
    if not tools or tool_choice == "none":
        return []
    forced = None
    if isinstance(tool_choice, dict):
        forced = (tool_choice.get("function") or {}).get("name") or tool_choice.get("name")
    if forced:
        chosen = [t for t in tools if t["name"] == forced][:1]
    else:
        scored = sorted(((_tool_score(t, user_text), i, t) for i, t in enumerate(tools)), key=lambda x: (-x[0], x[1]))
        best = scored[0][0]
        if best <= 0:
            if tool_choice == "required":
                chosen = [scored[0][2]]
            else:
                return []
        else:
            chosen = [scored[0][2]]
            for s, _, t in scored[1:]:
                if s >= max(2.0, 0.6 * best):
                    chosen.append(t)
    calls = []
    for t in chosen:
        params = t.get("parameters") or {}
        props = params.get("properties", {})
        loc_keys = [k for k in props if any(x in k.lower() for x in ("city", "location", "place", "country"))]
        ents = [e for e in capitalized_entities(user_text)]
        variants = [None]
        if loc_keys and len(ents) >= 2 and len(chosen) == 1:
            variants = ents[:3]
        for v in variants:
            args = instance_from_schema(params, user_text)
            if not t.get("strict"):
                req = params.get("required")
                if req is not None:
                    args = {k: val for k, val in args.items() if k in req or k in loc_keys}
            if v is not None:
                for k in loc_keys:
                    args[k] = v
            h = hashlib.md5(f"{seed}:{t['name']}:{json.dumps(args, sort_keys=True)}".encode()).hexdigest()[:24]
            calls.append({"id": f"call_{h}", "name": t["name"], "arguments": json.dumps(args)})
    return calls


def _options_from_prompt(text: str) -> list[str]:
    m = re.search(r"(?:one of|labels?|categories|category|classes|options|choose from|either)\s*[:\-]?\s*"
                  r"\[?([A-Za-z_\"' ,/|\-]+?)\]?(?:[.\n]|$)", text, flags=re.I)
    if not m:
        return []
    raw = re.split(r",|/|\||\bor\b", m.group(1))
    opts = [o.strip(" '\"").strip() for o in raw]
    opts = [o for o in opts if o and len(o.split()) <= 3]
    return opts[:8] if len(opts) >= 2 else []


def sentiment_label(text: str) -> str:
    toks = words(text)
    score = 0
    for i, w in enumerate(toks):
        s = 1 if w in POSITIVE else -1 if w in NEGATIVE else 0
        if s and i > 0 and toks[i - 1] in ("not", "never", "no", "isn", "wasn", "don", "didn", "t"):
            s = -s
        score += s
    return "positive" if score > 0 else "negative" if score < 0 else "neutral"


def _target_text(last_user: str) -> str:
    quoted = re.findall(r"[\"“]([^\"”]{3,})[\"”]", last_user)
    if quoted:
        return quoted[-1]
    if ":" in last_user:
        return last_user.rsplit(":", 1)[-1]
    return last_user


def classify(full: str, last_user: str) -> str | None:
    low = full.lower()
    if not any(k in low for k in ("classify", "sentiment", "label", "categor", "route", "intent")):
        return None
    opts = _options_from_prompt(full)
    target = _target_text(last_user)
    if not opts and "sentiment" in low:
        opts = ["positive", "negative", "neutral"]
    if not opts:
        return None
    lower_opts = [o.lower() for o in opts]
    if "positive" in lower_opts and "negative" in lower_opts:
        lab = sentiment_label(target)
        for o in opts:
            if o.lower() == lab:
                return o
        return opts[lower_opts.index("positive" if lab == "positive" else "negative")]
    tw = set(content_words(target))
    best, best_s = opts[0], 0
    for o in opts:
        s = len(set(content_words(o)) & tw)
        if s > best_s:
            best, best_s = o, s
    return best


def extractive_answer(question: str, context: str) -> str | None:
    qw = set(content_words(question))
    if not qw:
        return None
    source = None
    scored = []
    for line in (context or "").splitlines():
        tag = re.match(r"^\s*(?:\[([^\]]{1,80})\]|(?:source|file|doc(?:ument)?)\s*[:=]\s*(\S+))", line, flags=re.I)
        if tag:
            source = tag.group(1) or tag.group(2)
            line = line[tag.end():]
        for s in split_sentences(line):
            sw = content_words(s)
            if len(sw) < 3:
                continue
            overlap = len(qw & set(sw))
            if overlap:
                scored.append((overlap / math.sqrt(len(set(sw))), s, source))
    if not scored:
        return None
    scored.sort(key=lambda x: -x[0])
    picked = scored[:2] if len(scored) > 1 and scored[1][0] >= 0.75 * scored[0][0] else scored[:1]
    out = []
    for _, s, src in picked:
        out.append(s + (f" [{src}]" if src else ""))
    return " ".join(out)


def recall_fact(messages_text: str, last_user: str) -> str | None:
    q = re.search(r"(?:what(?:'s| is| was)|do you (?:know|remember))\s+my\s+([a-z][a-z ]{1,30}?)\s*\??$",
                  last_user.strip().lower())
    if q:
        key = q.group(1).strip()
    elif re.search(r"\bwho am i\b", last_user.lower()):
        key = "name"
    else:
        return None
    # key is case-insensitive; the optional second word of the value must really be Capitalised
    facts = re.findall(r"(?i:\bmy\s+([a-z][a-z ]{1,30}?)\s+is)\s+([A-Za-z0-9][\w\-]*(?:\s+[A-Z][\w\-]*)?)",
                       messages_text)
    for k, v in reversed(facts):
        if k.strip().lower() == key:
            return f"Your {key} is {v}."
    names = re.findall(r"\b(?:i am|i'm|call me)\s+([A-Z][a-z]+)", messages_text)
    if key == "name" and names:
        return f"Your name is {names[-1]}."
    return f"I don't know your {key} - you haven't told me."


def generate(messages: list[dict], tools: list[dict], tool_choice, response_format, max_tokens, seed: int) -> dict:
    """The whole 'model': returns {'content', 'tool_calls', 'finish_reason'}."""
    last_user_idx = max((i for i, m in enumerate(messages) if m.get("role") == "user"), default=-1)
    last_user = content_text(messages[last_user_idx].get("content")) if last_user_idx >= 0 else ""
    system = "\n".join(content_text(m.get("content")) for m in messages if m.get("role") in ("system", "developer"))
    all_text = "\n".join(content_text(m.get("content")) for m in messages)
    tool_results = [content_text(m.get("content")) for m in messages[last_user_idx + 1:] if m.get("role") == "tool"]

    if tools and not tool_results and tool_choice != "none":
        calls = pick_tool_calls(last_user, tools, tool_choice, seed)
        if calls:
            return {"content": None, "tool_calls": calls, "finish_reason": "tool_calls"}

    rf = response_format or {}
    if rf.get("type") == "json_schema":
        js = rf.get("json_schema") or {}
        schema = js.get("schema") or {}
        text = json.dumps(instance_from_schema(schema, last_user + "\n" + "\n".join(tool_results)))
        return {"content": text, "tool_calls": None, "finish_reason": "stop"}

    if tool_results:
        joined = "; ".join(r.strip().replace("\n", " ")[:300] for r in tool_results)
        text = f"Based on the tool results: {joined}"
    else:
        text = answer_text(system, last_user, all_text, messages)

    if rf.get("type") == "json_object":
        text = json.dumps({"answer": text})

    finish = "stop"
    if max_tokens:
        toks = re.findall(r"\S+\s*", text)
        if len(toks) > max_tokens:
            text = "".join(toks[:max_tokens]).rstrip()
            finish = "length"
    return {"content": text, "tool_calls": None, "finish_reason": finish}


def answer_text(system: str, last_user: str, all_text: str, messages: list[dict]) -> str:
    full = system + "\n" + last_user
    low = full.lower()
    earlier = "\n".join(content_text(m.get("content")) for m in messages[:-1])

    fact = recall_fact(earlier, last_user)
    if fact:
        return fact

    label = classify(full, last_user)
    if label:
        return label

    instruction = (system + "\n" + last_user[:300]).lower()   # the ask, not the pasted context
    if re.search(r"\bsummar", instruction) and not re.search(r"question\s*[:\-]", full, flags=re.I):
        body = max((p for p in re.split(r"\n\s*\n", last_user) if p.strip()), key=len, default=last_user)
        sents = [s for s in split_sentences(body) if not re.search(r"\bsummar", s.lower())]
        if sents:
            return "Summary: " + " ".join(sents[:2])

    # a question asked over supplied context -> extractive answer
    question = last_user
    m = re.search(r"question\s*[:\-]\s*(.+?)(?:\n|$)", full, flags=re.I)
    if m:
        question = m.group(1)
    elif "?" in last_user:
        qs = [s for s in split_sentences(last_user) if s.endswith("?")]
        if qs:
            question = qs[-1]
    context = full.replace(question, " ")
    if len(context) > 200 and len(split_sentences(context)) >= 3:
        ans = extractive_answer(question, context)
        if ans:
            return ans
        if re.search(r"don.?t know|not in the context|only the context|using only|nothing else", low):
            return "I don't know - the provided context does not cover that."

    expr = find_expression(last_user)
    if expr and len(last_user) < 300:
        return f"The answer is {fmt_number(expr[1])}."

    if re.fullmatch(r"\s*(hi|hello|hey)\b.*", last_user.lower()):
        return "Hello! I'm the offline stand-in model. Set OPENAI_API_KEY or start Ollama for real answers."

    snippet = re.sub(r"\s+", " ", last_user).strip()[:90]
    return (f"[offline stand-in] I'm a deterministic placeholder, not a real model, so I can't really answer "
            f"\"{snippet}\". Set OPENAI_API_KEY (or start Ollama) and re-run this cell for a real answer.")


# ------------------------------------------------------------- validation

class APIError(Exception):
    def __init__(self, status: int, message: str, etype: str = "invalid_request_error", param=None, code=None):
        super().__init__(message)
        self.status, self.message, self.etype, self.param, self.code = status, message, etype, param, code


def validate_chat(body: dict):
    msgs = body.get("messages")
    if not isinstance(msgs, list) or not msgs:
        raise APIError(400, "'messages' must be a non-empty array.", param="messages")
    pending: dict[str, int] = {}
    for i, m in enumerate(msgs):
        role = m.get("role")
        if role not in ("system", "developer", "user", "assistant", "tool", "function"):
            raise APIError(400, f"Invalid value: '{role}'. Supported values are: 'system', 'assistant', 'user', "
                                f"'function', 'tool', and 'developer'.", param=f"messages[{i}].role")
        if role != "tool" and pending:
            raise APIError(400, "An assistant message with 'tool_calls' must be followed by tool messages responding "
                                "to each 'tool_call_id'. The following tool_call_ids did not have response messages: "
                                + ", ".join(pending), param="messages")
        if role == "assistant":
            for tc in m.get("tool_calls") or []:
                pending[tc.get("id")] = i
        elif role == "tool":
            tid = m.get("tool_call_id")
            if tid not in pending:
                raise APIError(400, "Invalid parameter: messages with role 'tool' must be a response to a preceeding "
                                    "message with 'tool_calls'.", param=f"messages[{i}].role")
            pending.pop(tid)
    for t in body.get("tools") or []:
        f = t.get("function", t)
        name = f.get("name", "")
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", name or ""):
            raise APIError(400, f"Invalid 'tools[].function.name': string does not match pattern. Expected a string "
                                f"that matches the pattern '^[a-zA-Z0-9_-]+$'. Got '{name}'.")
        if f.get("strict"):
            probs = strict_problems(f.get("parameters") or {})
            if probs:
                raise APIError(400, f"Invalid schema for function '{name}': {probs[0]}")
    rf = body.get("response_format") or {}
    if rf.get("type") == "json_schema":
        js = rf.get("json_schema") or {}
        if js.get("strict"):
            probs = strict_problems(js.get("schema") or {})
            if probs:
                raise APIError(400, f"Invalid schema for response_format '{js.get('name')}': {probs[0]}")
    if rf.get("type") == "json_object":
        if "json" not in json.dumps(msgs).lower():
            raise APIError(400, "'messages' must contain the word 'json' in some form, to use 'response_format' of "
                                "type 'json_object'.", param="messages")


# ------------------------------------------------------------------ engine

def _err_body(e: APIError) -> dict:
    return {"error": {"message": e.message, "type": e.etype, "param": e.param, "code": e.code}}


class OfflineEngine:
    def __init__(self):
        self.latency = 0.0
        self.token_delay = 0.0
        self.request_count = 0
        self._fail: list[int] = []
        self._lock = threading.Lock()
        self._n = 0
        self._responses: dict[str, list[dict]] = {}
        self._files: dict[str, dict] = {}
        self._jobs: dict[str, dict] = {}

    # knobs -------------------------------------------------------------
    def fail_next(self, n: int = 1, status: int = 429):
        with self._lock:
            self._fail.extend([status] * n)

    def reset(self):
        self.__init__()

    def _next(self) -> int:
        with self._lock:
            self._n += 1
            return self._n

    # dispatch ----------------------------------------------------------
    def handle(self, request: httpx.Request):
        """Returns (status, headers, body) where body is bytes or a list of SSE chunks."""
        with self._lock:
            self.request_count += 1
            fail = self._fail.pop(0) if self._fail else None
        if fail:
            kinds = {400: "invalid_request_error", 401: "authentication_error", 403: "permission_error",
                     404: "not_found_error", 429: "rate_limit_error", 500: "server_error", 503: "server_error"}
            msg = {429: "Rate limit reached (offline simulation). Please try again in 100ms.",
                   500: "The server had an error while processing your request (offline simulation).",
                   503: "The engine is currently overloaded (offline simulation)."}.get(fail, "Simulated error.")
            headers = {"content-type": "application/json", "retry-after-ms": "100", "x-request-id": f"req_off_{self._n}"}
            return fail, headers, json.dumps({"error": {"message": msg, "type": kinds.get(fail, "api_error"),
                                                        "param": None, "code": None}}).encode()
        path = request.url.path
        path = path[path.index("/v1") + 3:] if "/v1" in path else path
        method = request.method.upper()
        try:
            body = json.loads(request.content or b"{}") if request.headers.get("content-type", "").startswith(
                "application/json") else {}
        except ValueError:
            body = {}
        try:
            if method == "POST" and path == "/chat/completions":
                return self.chat(body)
            if method == "POST" and path == "/responses":
                return self.responses(body)
            if method == "POST" and path == "/embeddings":
                return self._json(self.embeddings(body))
            if method == "POST" and path == "/moderations":
                return self._json(self.moderations(body))
            if method == "GET" and path == "/models":
                return self._json({"object": "list", "data": [
                    {"id": m, "object": "model", "created": 1700000000, "owned_by": "offline"}
                    for m in ("gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "text-embedding-3-small")]})
            if path.startswith("/files"):
                return self._json(self.files(method, path, request))
            if path.startswith("/fine_tuning/jobs"):
                out = self.fine_tuning(method, path, body)
                limit = request.url.params.get("limit")
                if limit and isinstance(out.get("data"), list):
                    out["data"] = out["data"][: int(limit)]
                return self._json(out)
            raise APIError(404, f"The offline stand-in does not implement {method} {path}.", code="unknown_url")
        except APIError as e:
            return e.status, {"content-type": "application/json"}, json.dumps(_err_body(e)).encode()

    @staticmethod
    def _json(obj, status=200):
        return status, {"content-type": "application/json"}, json.dumps(obj).encode()

    # chat completions ---------------------------------------------------
    def chat(self, body: dict):
        validate_chat(body)
        n = self._next()
        model = body.get("model", "offline")
        msgs = body["messages"]
        tools = norm_tools(body.get("tools"))
        max_tok = body.get("max_completion_tokens") or body.get("max_tokens")
        out = generate(msgs, tools, body.get("tool_choice", "auto"), body.get("response_format"), max_tok, n)
        prompt_toks = sum(approx_tokens(content_text(m.get("content"))) for m in msgs) + 3 * len(msgs)
        comp_text = out["content"] or json.dumps([c["arguments"] for c in out["tool_calls"] or []])
        usage = {"prompt_tokens": prompt_toks, "completion_tokens": approx_tokens(comp_text),
                 "total_tokens": prompt_toks + approx_tokens(comp_text),
                 "prompt_tokens_details": {"cached_tokens": 0, "audio_tokens": 0},
                 "completion_tokens_details": {"reasoning_tokens": 0, "audio_tokens": 0,
                                               "accepted_prediction_tokens": 0, "rejected_prediction_tokens": 0}}
        cid, created = f"chatcmpl-offline-{n}", 1700000000 + n
        tool_calls = [{"id": c["id"], "type": "function", "function": {"name": c["name"], "arguments": c["arguments"]}}
                      for c in out["tool_calls"] or []]
        if body.get("tools") and body.get("parallel_tool_calls") is False:
            tool_calls = tool_calls[:1]
        n_choices = int(body.get("n") or 1)
        if body.get("stream"):
            return 200, {"content-type": "text/event-stream"}, self._chat_stream(
                cid, created, model, out, tool_calls, usage, body)
        choices = []
        for i in range(n_choices):
            msg = {"role": "assistant", "content": out["content"], "refusal": None, "annotations": []}
            if tool_calls:
                msg["tool_calls"] = tool_calls
            choice = {"index": i, "message": msg, "finish_reason": out["finish_reason"], "logprobs": None}
            if body.get("logprobs") and out["content"]:
                choice["logprobs"] = {"content": self._logprobs(out["content"], body.get("top_logprobs") or 0),
                                      "refusal": None}
            choices.append(choice)
        return self._json({"id": cid, "object": "chat.completion", "created": created, "model": model,
                           "choices": choices, "usage": usage, "system_fingerprint": "fp_offline",
                           "service_tier": "default"})

    @staticmethod
    def _logprobs(text: str, top: int) -> list[dict]:
        out = []
        for tok in re.findall(r"\s*\S+", text):
            h = int(hashlib.md5(tok.encode()).hexdigest()[:6], 16)
            lp = -0.02 - (h % 1000) / 1000.0
            entry = {"token": tok, "logprob": lp, "bytes": list(tok.encode()), "top_logprobs": []}
            alts = [tok, tok.upper(), tok.strip() + "s", " the", " a"]
            for j in range(top):
                alt = alts[j % len(alts)]
                entry["top_logprobs"].append({"token": alt, "logprob": lp - 1.3 * j, "bytes": list(alt.encode())})
            out.append(entry)
        return out

    def _chat_stream(self, cid, created, model, out, tool_calls, usage, body) -> list[bytes]:
        def chunk(delta, finish=None, extra=None):
            obj = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
                   "system_fingerprint": "fp_offline",
                   "choices": [{"index": 0, "delta": delta, "finish_reason": finish, "logprobs": None}]}
            if extra:
                obj.update(extra)
            return f"data: {json.dumps(obj)}\n\n".encode()
        chunks = [chunk({"role": "assistant", "content": "", "refusal": None})]
        if tool_calls:
            for i, tc in enumerate(tool_calls):
                chunks.append(chunk({"tool_calls": [{"index": i, "id": tc["id"], "type": "function",
                                                     "function": {"name": tc["function"]["name"], "arguments": ""}}]}))
                args = tc["function"]["arguments"]
                for j in range(0, len(args), 12):
                    chunks.append(chunk({"tool_calls": [{"index": i, "function": {"arguments": args[j:j + 12]}}]}))
        else:
            for piece in re.findall(r"\s*\S+", out["content"] or ""):
                chunks.append(chunk({"content": piece}))
        chunks.append(chunk({}, out["finish_reason"]))
        if (body.get("stream_options") or {}).get("include_usage"):
            obj = {"id": cid, "object": "chat.completion.chunk", "created": created, "model": model,
                   "choices": [], "usage": usage}
            chunks.append(f"data: {json.dumps(obj)}\n\n".encode())
        chunks.append(b"data: [DONE]\n\n")
        return chunks

    # responses -----------------------------------------------------------
    def responses(self, body: dict):
        n = self._next()
        model = body.get("model", "offline")
        history: list[dict] = []
        prev = body.get("previous_response_id")
        if prev:
            if prev not in self._responses:
                raise APIError(400, f"Previous response with id '{prev}' not found.", param="previous_response_id")
            history = [dict(m) for m in self._responses[prev]]
        msgs = list(history)
        if body.get("instructions"):
            msgs = [m for m in msgs if m.get("role") != "system"]
            msgs.insert(0, {"role": "system", "content": body["instructions"]})
        known_calls = {tc["id"] for m in msgs for tc in m.get("tool_calls") or []}
        inp = body.get("input")
        new_msgs: list[dict] = []
        if isinstance(inp, str):
            new_msgs.append({"role": "user", "content": inp})
        else:
            for item in inp or []:
                t = item.get("type")
                if t == "function_call":
                    tc = {"id": item.get("call_id"), "type": "function",
                          "function": {"name": item.get("name"), "arguments": item.get("arguments", "{}")}}
                    if new_msgs and new_msgs[-1].get("role") == "assistant" and new_msgs[-1].get("tool_calls") is not None:
                        new_msgs[-1]["tool_calls"].append(tc)
                    else:
                        new_msgs.append({"role": "assistant", "content": None, "tool_calls": [tc]})
                    known_calls.add(item.get("call_id"))
                elif t == "function_call_output":
                    if item.get("call_id") not in known_calls:
                        raise APIError(400, f"No tool call found for function call output with call_id "
                                            f"{item.get('call_id')}.", param="input")
                    out = item.get("output")
                    new_msgs.append({"role": "tool", "tool_call_id": item.get("call_id"),
                                     "content": out if isinstance(out, str) else json.dumps(out)})
                elif t in (None, "message") and item.get("role"):
                    new_msgs.append({"role": item["role"], "content": content_text(item.get("content"))})
        msgs += new_msgs
        tools = norm_tools(body.get("tools"))
        tc = body.get("tool_choice", "auto")
        if isinstance(tc, dict) and tc.get("type") == "function":
            tc = {"type": "function", "function": {"name": tc.get("name")}}
        fmt = ((body.get("text") or {}).get("format")) or {}
        rf = None
        if fmt.get("type") == "json_schema":
            if fmt.get("strict", True):
                probs = strict_problems(fmt.get("schema") or {})
                if probs:
                    raise APIError(400, f"Invalid schema for response_format '{fmt.get('name')}': {probs[0]}",
                                   param="text.format.schema")
            rf = {"type": "json_schema", "json_schema": {"name": fmt.get("name"), "schema": fmt.get("schema")}}
        elif fmt.get("type") == "json_object":
            rf = {"type": "json_object"}
        out = generate(msgs, tools, tc, rf, body.get("max_output_tokens"), n)
        rid = f"resp_offline_{n}"
        output = []
        if out["tool_calls"]:
            calls = out["tool_calls"] if body.get("parallel_tool_calls", True) else out["tool_calls"][:1]
            for c in calls:
                output.append({"type": "function_call", "id": f"fc_{c['id'][5:]}", "call_id": c["id"],
                               "name": c["name"], "arguments": c["arguments"], "status": "completed"})
            assistant = {"role": "assistant", "content": None,
                         "tool_calls": [{"id": c["id"], "type": "function",
                                         "function": {"name": c["name"], "arguments": c["arguments"]}} for c in calls]}
        else:
            output.append({"type": "message", "id": f"msg_offline_{n}", "status": "completed", "role": "assistant",
                           "content": [{"type": "output_text", "text": out["content"], "annotations": [],
                                        "logprobs": []}]})
            assistant = {"role": "assistant", "content": out["content"]}
        if body.get("store", True) is not False:
            self._responses[rid] = [m for m in msgs if m.get("role") != "system"] + [assistant]
        in_toks = sum(approx_tokens(content_text(m.get("content"))) for m in msgs) + 3 * len(msgs)
        out_toks = approx_tokens(out["content"] or json.dumps([o.get("arguments") for o in output]))
        incomplete = out["finish_reason"] == "length"
        resp = {"id": rid, "object": "response", "created_at": 1700000000 + n,
                "status": "incomplete" if incomplete else "completed",
                "incomplete_details": {"reason": "max_output_tokens"} if incomplete else None,
                "error": None, "model": model, "output": output, "instructions": body.get("instructions"),
                "previous_response_id": prev, "parallel_tool_calls": body.get("parallel_tool_calls", True),
                "tool_choice": body.get("tool_choice", "auto"), "tools": body.get("tools") or [],
                "temperature": body.get("temperature", 1.0), "top_p": body.get("top_p", 1.0),
                "max_output_tokens": body.get("max_output_tokens"), "metadata": body.get("metadata") or {},
                "text": body.get("text") or {"format": {"type": "text"}}, "truncation": "disabled",
                "store": body.get("store", True), "usage": {
                    "input_tokens": in_toks, "input_tokens_details": {"cached_tokens": 0},
                    "output_tokens": out_toks, "output_tokens_details": {"reasoning_tokens": 0},
                    "total_tokens": in_toks + out_toks}}
        if body.get("stream"):
            return 200, {"content-type": "text/event-stream"}, self._responses_stream(resp)
        return self._json(resp)

    @staticmethod
    def _responses_stream(resp: dict) -> list[bytes]:
        seq = [0]

        def ev(obj):
            obj["sequence_number"] = seq[0]
            seq[0] += 1
            return f"event: {obj['type']}\ndata: {json.dumps(obj)}\n\n".encode()
        start = dict(resp, status="in_progress", output=[], usage=None)
        chunks = [ev({"type": "response.created", "response": start}),
                  ev({"type": "response.in_progress", "response": start})]
        for oi, item in enumerate(resp["output"]):
            if item["type"] == "message":
                text = item["content"][0]["text"]
                empty = dict(item, status="in_progress", content=[])
                chunks.append(ev({"type": "response.output_item.added", "output_index": oi, "item": empty}))
                part = {"type": "output_text", "text": "", "annotations": [], "logprobs": []}
                chunks.append(ev({"type": "response.content_part.added", "item_id": item["id"], "output_index": oi,
                                  "content_index": 0, "part": part}))
                for piece in re.findall(r"\s*\S+", text):
                    chunks.append(ev({"type": "response.output_text.delta", "item_id": item["id"], "output_index": oi,
                                      "content_index": 0, "delta": piece, "logprobs": []}))
                chunks.append(ev({"type": "response.output_text.done", "item_id": item["id"], "output_index": oi,
                                  "content_index": 0, "text": text, "logprobs": []}))
                chunks.append(ev({"type": "response.content_part.done", "item_id": item["id"], "output_index": oi,
                                  "content_index": 0, "part": dict(part, text=text)}))
            else:
                empty = dict(item, arguments="", status="in_progress")
                chunks.append(ev({"type": "response.output_item.added", "output_index": oi, "item": empty}))
                args = item["arguments"]
                for j in range(0, len(args), 12):
                    chunks.append(ev({"type": "response.function_call_arguments.delta", "item_id": item["id"],
                                      "output_index": oi, "delta": args[j:j + 12]}))
                chunks.append(ev({"type": "response.function_call_arguments.done", "item_id": item["id"],
                                  "output_index": oi, "arguments": args, "name": item["name"]}))
            chunks.append(ev({"type": "response.output_item.done", "output_index": oi, "item": item}))
        chunks.append(ev({"type": "response.completed", "response": resp}))
        return chunks

    # embeddings ------------------------------------------------------------
    def embeddings(self, body: dict) -> dict:
        inp = body.get("input")
        model = body.get("model", "text-embedding-3-small")
        if isinstance(inp, str) or (isinstance(inp, list) and inp and isinstance(inp[0], int)):
            inp = [inp]
        if not inp:
            raise APIError(400, "'input' must not be empty.", param="input")
        dims = body.get("dimensions") or (3072 if "large" in model else 768 if "nomic" in model else 1536)
        data, total = [], 0
        for i, item in enumerate(inp):
            text = item if isinstance(item, str) else _decode_tokens(item)
            total += approx_tokens(text)
            vec = embed(text, dims)
            if body.get("encoding_format") == "base64":
                emb = base64.b64encode(struct.pack(f"<{dims}f", *vec)).decode()
            else:
                emb = vec
            data.append({"object": "embedding", "index": i, "embedding": emb})
        return {"object": "list", "data": data, "model": model,
                "usage": {"prompt_tokens": total, "total_tokens": total}}

    # moderations --------------------------------------------------------------
    def moderations(self, body: dict) -> dict:
        inp = body.get("input")
        items = inp if isinstance(inp, list) else [inp]
        cats = {"violence": ["kill", "murder", "attack", "bomb", "shoot", "stab", "weapon"],
                "harassment": ["idiot", "stupid", "loser", "worthless"],
                "hate": ["hate all", "inferior race"],
                "self-harm": ["suicide", "kill myself", "hurt myself", "self-harm"],
                "illicit": ["steal", "hack into", "make meth", "counterfeit"],
                "sexual": ["explicit sex"]}
        all_cats = ["harassment", "harassment/threatening", "hate", "hate/threatening", "illicit", "illicit/violent",
                    "self-harm", "self-harm/intent", "self-harm/instructions", "sexual", "sexual/minors", "violence",
                    "violence/graphic"]
        results = []
        for it in items:
            text = content_text(it) if not isinstance(it, str) else it
            low = (text or "").lower()
            flags = {c: False for c in all_cats}
            scores = {c: 0.0001 for c in all_cats}
            for c, kws in cats.items():
                hit = sum(k in low for k in kws)
                if hit:
                    flags[c] = True
                    scores[c] = min(0.99, 0.6 + 0.15 * hit)
            results.append({"flagged": any(flags.values()), "categories": flags, "category_scores": scores,
                            "category_applied_input_types": {c: ["text"] for c in all_cats}})
        return {"id": f"modr-offline-{self._next()}", "model": body.get("model", "omni-moderation-latest"),
                "results": results}

    # files ------------------------------------------------------------------
    def files(self, method: str, path: str, request: httpx.Request) -> dict:
        if method == "POST" and path == "/files":
            raw = request.content or b""
            text = raw.decode("utf-8", "replace")
            fname = (re.search(r'filename="([^"]+)"', text) or [None, "upload.jsonl"])[1]
            purpose = (re.search(r'name="purpose"\r?\n\r?\n([^\r\n]+)', text) or [None, "fine-tune"])[1]
            payload = ""
            m = re.search(r'filename="[^"]+"\r?\n(?:[^\r\n]+\r?\n)*\r?\n(.*?)\r?\n--', text, flags=re.S)
            if m:
                payload = m.group(1)
            fid = f"file-offline-{self._next()}"
            obj = {"id": fid, "object": "file", "bytes": len(payload.encode()), "created_at": 1700000000,
                   "filename": fname, "purpose": purpose, "status": "processed", "expires_at": None,
                   "status_details": None}
            self._files[fid] = dict(obj, _content=payload)
            return {k: v for k, v in obj.items()}
        if method == "GET" and path == "/files":
            return {"object": "list", "data": [{k: v for k, v in f.items() if not k.startswith("_")}
                                               for f in self._files.values()], "has_more": False}
        fid = path.split("/")[2] if len(path.split("/")) > 2 else ""
        if fid not in self._files:
            raise APIError(404, f"No such File object: {fid}", code="not_found")
        if method == "DELETE":
            self._files.pop(fid)
            return {"id": fid, "object": "file", "deleted": True}
        return {k: v for k, v in self._files[fid].items() if not k.startswith("_")}

    # fine-tuning ------------------------------------------------------------
    def fine_tuning(self, method: str, path: str, body: dict) -> dict:
        parts = [p for p in path.split("/") if p]  # fine_tuning, jobs, [id], [events|cancel]
        if method == "POST" and len(parts) == 2:
            tf = body.get("training_file")
            if tf not in self._files:
                raise APIError(400, f"invalid training_file: {tf}", param="training_file")
            content = self._files[tf].get("_content", "")
            examples = [ln for ln in content.splitlines() if ln.strip()]
            bad = 0
            for ln in examples:
                try:
                    ex = json.loads(ln)
                    if not isinstance(ex.get("messages"), list):
                        bad += 1
                except ValueError:
                    bad += 1
            if bad:
                raise APIError(400, f"Training file {tf} has {bad} malformed example(s): each line must be a JSON "
                                    f"object with a 'messages' list.", param="training_file")
            jid = f"ftjob-offline-{self._next()}"
            hp = (body.get("hyperparameters") or {}) or (((body.get("method") or {}).get("supervised") or {})
                                                        .get("hyperparameters") or {})
            epochs = hp.get("n_epochs", "auto")
            n_ep = 3 if epochs == "auto" else int(epochs)
            job = {"id": jid, "object": "fine_tuning.job", "created_at": 1700000000, "finished_at": None,
                   "model": body.get("model"), "fine_tuned_model": None, "organization_id": "org-offline",
                   "result_files": [], "status": "validating_files", "validation_file": body.get("validation_file"),
                   "training_file": tf, "hyperparameters": {"n_epochs": n_ep, "batch_size": 1,
                                                             "learning_rate_multiplier": 2.0},
                   "trained_tokens": None, "error": None, "seed": body.get("seed", 42), "suffix": body.get("suffix"),
                   "estimated_finish": None, "integrations": [], "method": body.get("method"),
                   "_examples": len(examples), "_tokens": approx_tokens(content), "_polls": 0}
            self._jobs[jid] = job
            return self._public_job(job)
        if method == "GET" and len(parts) == 2:
            return {"object": "list", "data": [self._public_job(j) for j in self._jobs.values()], "has_more": False}
        jid = parts[2] if len(parts) > 2 else ""
        if jid not in self._jobs:
            raise APIError(404, f"Could not find fine-tuning job {jid}.", code="not_found")
        job = self._jobs[jid]
        if len(parts) == 4 and parts[3] == "cancel":
            job["status"] = "cancelled"
            return self._public_job(job)
        if len(parts) == 4 and parts[3] == "events":
            steps = max(3, job["_examples"]) * job["hyperparameters"]["n_epochs"]
            evs = [("info", "Validating training file: " + job["training_file"]),
                   ("info", "Files validated, moving job to queued state"),
                   ("info", "Fine-tuning job started")]
            for s in range(1, steps + 1, max(1, steps // 5)):
                evs.append(("metrics", f"Step {s}/{steps}: training loss={2.2 * math.exp(-3 * s / steps) + 0.1:.2f}"))
            evs.append(("info", "The job has successfully completed"))
            data = [{"object": "fine_tuning.job.event", "id": f"ftevent-{i}", "created_at": 1700000000 + i,
                     "level": lvl, "message": msg, "type": "message"} for i, (lvl, msg) in enumerate(evs)]
            return {"object": "list", "data": list(reversed(data)), "has_more": False}
        if job["status"] not in ("succeeded", "cancelled", "failed"):
            job["_polls"] += 1
            order = ["validating_files", "queued", "running", "succeeded"]
            job["status"] = order[min(job["_polls"], 3)]
            if job["status"] == "succeeded":
                job["fine_tuned_model"] = f"ft:{job['model']}:offline:{job.get('suffix') or 'custom'}:{jid[-4:]}"
                job["trained_tokens"] = job["_tokens"] * job["hyperparameters"]["n_epochs"]
                job["finished_at"] = 1700000600
        return self._public_job(job)

    @staticmethod
    def _public_job(job: dict) -> dict:
        return {k: v for k, v in job.items() if not k.startswith("_")}


def _decode_tokens(ids) -> str:
    try:
        import tiktoken
        return tiktoken.get_encoding("cl100k_base").decode(list(ids))
    except Exception:
        return " ".join(f"tok{i}" for i in ids)


# --------------------------------------------------------------- transport

class OfflineTransport(httpx.BaseTransport, httpx.AsyncBaseTransport):
    """An httpx transport that answers from OfflineEngine instead of the network."""

    def __init__(self, engine: OfflineEngine):
        self.engine = engine

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        request.read()
        if self.engine.latency:
            time.sleep(self.engine.latency)
        status, headers, body = self.engine.handle(request)
        if isinstance(body, list):
            delay = self.engine.token_delay

            def gen():
                for i, c in enumerate(body):
                    if delay and i:
                        time.sleep(delay)
                    yield c
            return httpx.Response(status, headers=headers, content=gen(), request=request)
        return httpx.Response(status, headers=headers, content=body, request=request)

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        await request.aread()
        if self.engine.latency:
            await asyncio.sleep(self.engine.latency)
        status, headers, body = self.engine.handle(request)
        if isinstance(body, list):
            delay = self.engine.token_delay

            async def agen():
                for i, c in enumerate(body):
                    if delay and i:
                        await asyncio.sleep(delay)
                    yield c
            return httpx.Response(status, headers=headers, content=agen(), request=request)
        return httpx.Response(status, headers=headers, content=body, request=request)
