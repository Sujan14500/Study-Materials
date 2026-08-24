"""Model access, with a budget meter welded on.

Every call goes through `LLM.chat()` and every call is metered, because on a
multi-tenant product the question is never "what did inference cost" — it is
"what did inference cost *for tenant 7*, and are they still inside their plan".

Providers:
  stub    deterministic. All tests and all evals run against this.
  ollama  local models. Free, private, and slow enough to make you think about
          which tier you actually need.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

TIERS = {
    "small": os.environ.get("SUPPORT_MODEL_SMALL", "gemma3:270m"),
    "large": os.environ.get("SUPPORT_MODEL_LARGE", "llama3.2:latest"),
}

# Published rates for the models you would use in production, per million tokens.
# Local models cost nothing, but a platform still needs a number to bill and to
# cap against, so the meter runs on notional rates and reports both.
RATES = {"small": (0.10, 0.40), "large": (0.80, 4.00)}   # (input, output) $/M tokens


@dataclass
class Meter:
    calls: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    ms: float = 0.0
    notional_cents: float = 0.0
    by_tier: dict = field(default_factory=dict)

    def add(self, tier: str, t_in: int, t_out: int, ms: float) -> float:
        rin, rout = RATES.get(tier, RATES["large"])
        cents = (t_in / 1e6 * rin + t_out / 1e6 * rout) * 100
        self.calls += 1
        self.tokens_in += t_in
        self.tokens_out += t_out
        self.ms += ms
        self.notional_cents += cents
        d = self.by_tier.setdefault(tier, {"calls": 0, "ms": 0.0, "cents": 0.0})
        d["calls"] += 1
        d["ms"] += ms
        d["cents"] += cents
        return cents


class LLMError(RuntimeError):
    pass


class StubLLM:
    """Deterministic. Knows the four prompts this system sends."""

    name = "stub"

    def __init__(self) -> None:
        self.meter = Meter()

    def chat(self, system: str, user: str, tier: str = "large", json_mode: bool = False) -> str:
        t0 = time.perf_counter()
        out = self._respond(system, user)
        self.meter.add(tier, len(system + user) // 4, len(out) // 4, (time.perf_counter() - t0) * 1000)
        return out

    def _respond(self, system: str, user: str) -> str:
        s = system.lower()

        if "memory extractor" in s:
            return json.dumps({"facts": _stub_facts(user)})

        if "reconcile" in s:
            # user carries: CANDIDATE: ... / EXISTING: [...]
            cand = re.search(r"CANDIDATE:\s*(.+)", user)
            existing = re.findall(r"- \[(\d+)\] (.+)", user)
            c = (cand.group(1) if cand else "").strip()
            for mid, text in existing:
                if _same_slot(c, text):
                    if c.strip().lower() == text.strip().lower():
                        return json.dumps({"op": "NOOP", "target_id": int(mid)})
                    if c.lower().startswith("no longer") or "not " in c.lower()[:12]:
                        return json.dumps({"op": "DELETE", "target_id": int(mid)})
                    return json.dumps({"op": "UPDATE", "target_id": int(mid), "text": c})
            return json.dumps({"op": "ADD", "text": c})

        if "sql" in s and "analyst" in s:
            return _stub_sql(user)

        if "support agent" in s:
            # Grounded answer: quote the strongest retrieved line back.
            m = re.search(r"\[1\]\s*(.+)", user)
            return (m.group(1).strip()[:240] + " [1]") if m else "I don't have that in our help centre."

        return ""


def _same_slot(a: str, b: str) -> bool:
    """Crude 'these are about the same attribute' check for the stub."""
    keys = ("plan", "timezone", "billing", "email", "seats", "region", "contact")
    for k in keys:
        if k in a.lower() and k in b.lower():
            return True
    return False


def _stub_facts(convo: str) -> list:
    facts = []
    low = convo.lower()
    for pat, tmpl in (
        (r"we(?:'re| are) on the (\w+) plan", "On the {} plan"),
        (r"upgraded to (\w+)", "On the {} plan"),
        (r"i(?:'m| am) in ([A-Z][a-z]+/[A-Z_][A-Za-z_]+)", "Timezone is {}"),
        (r"(\d+) seats", "Has {} seats"),
        (r"bill(?:ed|ing) (annually|monthly)", "Billed {}"),
    ):
        for m in re.finditer(pat, convo, re.I):
            facts.append(tmpl.format(m.group(1)))
    if "no longer" in low and "plan" in low:
        facts.append("No longer on the Pro plan")
    if "prefer" in low and "email" in low:
        facts.append("Prefers email over chat")
    return facts


def _stub_sql(ask: str) -> str:
    a = ask.lower()
    if "category" in a and ("deflect" in a or "auto" in a or "rate" in a):
        return ("SELECT category, "
                "ROUND(100.0 * SUM(CASE WHEN resolution = 'auto_send' THEN 1 ELSE 0 END) "
                "/ COUNT(*), 1) AS deflection_pct "
                "FROM tickets GROUP BY category ORDER BY deflection_pct DESC")
    if "handle" in a or "time" in a:
        return ("SELECT category, ROUND(AVG(handle_seconds) / 60.0, 1) AS avg_handle_minutes "
                "FROM tickets GROUP BY category ORDER BY avg_handle_minutes DESC")
    if "volume" in a or "count" in a or "busiest" in a:
        return "SELECT category, COUNT(*) AS tickets FROM tickets GROUP BY category ORDER BY tickets DESC"
    if "csat" in a or "satisf" in a:
        return ("SELECT resolution, ROUND(AVG(csat), 2) AS avg_csat, COUNT(*) AS n "
                "FROM tickets WHERE csat IS NOT NULL GROUP BY resolution ORDER BY avg_csat DESC")
    if "share" in a or "percent" in a or "mix" in a:
        return ("SELECT category, ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM tickets), 1) "
                "AS share_pct FROM tickets GROUP BY category ORDER BY share_pct DESC")
    return "SELECT category, COUNT(*) AS tickets FROM tickets GROUP BY category"


class OllamaLLM:
    name = "ollama"

    def __init__(self, url: str = OLLAMA_URL, timeout: float = 180.0) -> None:
        self.url = url.rstrip("/")
        self.timeout = timeout
        self.meter = Meter()

    def chat(self, system: str, user: str, tier: str = "large", json_mode: bool = False) -> str:
        payload = {
            "model": TIERS.get(tier, TIERS["large"]),
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": False,
            "options": {"temperature": 0},
        }
        if json_mode:
            payload["format"] = "json"
        req = urllib.request.Request(
            self.url + "/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                body = json.loads(r.read().decode())
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise LLMError(f"ollama unreachable at {self.url}: {e}") from e
        self.meter.add(tier, body.get("prompt_eval_count", 0), body.get("eval_count", 0),
                       (time.perf_counter() - t0) * 1000)
        return body.get("message", {}).get("content", "")


def available(url: str = OLLAMA_URL) -> bool:
    try:
        with urllib.request.urlopen(url + "/api/tags", timeout=2.0):
            return True
    except Exception:
        return False


def get_llm(name: str | None = None):
    name = (name or os.environ.get("SUPPORT_LLM", "auto")).lower()
    if name == "stub":
        return StubLLM()
    if name == "ollama":
        return OllamaLLM()
    return OllamaLLM() if available() else StubLLM()
