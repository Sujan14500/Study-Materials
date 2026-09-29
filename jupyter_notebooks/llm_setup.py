"""Which LLM do the notebooks talk to? Every notebook that calls a model imports this.

    import sys
    from pathlib import Path
    for _p in [Path.cwd(), *Path.cwd().parents]:          # find this file from any notebook folder
        if (_p / "llm_setup.py").exists():
            sys.path.insert(0, str(_p)); break
    from llm_setup import client, MODEL, EMBED_MODEL, PROVIDER

`client` is a real `openai.OpenAI` client, so everything you write against it is
the code you would ship. What sits behind it depends on PROVIDER:

    openai   OPENAI_API_KEY is set. Real answers; small real cost (cents per notebook).
    ollama   An Ollama server is running on this machine. Real answers from a local
             model, free. Ollama speaks the OpenAI API, so only base_url changes.
    offline  Neither is available. A deterministic stand-in inside this process
             answers instead (see _offline_llm.py), so every cell still runs. Its
             answers are canned, not intelligent - good enough to see the plumbing.

Choose explicitly with the LLM_PROVIDER environment variable (openai | ollama |
offline), either in your shell or in a `.env` file next to this one:

    OPENAI_API_KEY=sk-...
    LLM_PROVIDER=openai          # optional; auto-detected otherwise
    OPENAI_MODEL=gpt-4.1-mini    # optional
    OLLAMA_MODEL=qwen2.5:3b      # optional

Inside a notebook you can also switch before importing:
    import os; os.environ["LLM_PROVIDER"] = "ollama"
"""

from __future__ import annotations

import os
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ------------------------------------------------------------------ defaults
# gpt-4.1-mini: cheap, supports temperature/logprobs/tools/structured outputs.
# (GPT-5-family reasoning models reject temperature, which the sampling lessons use.)
OPENAI_DEFAULT_MODEL = "gpt-4.1-mini"
OPENAI_DEFAULT_EMBED = "text-embedding-3-small"
# Ollama: pull these once with `ollama pull qwen2.5:3b` and `ollama pull nomic-embed-text`.
OLLAMA_DEFAULT_MODEL = "qwen2.5:3b"
OLLAMA_DEFAULT_EMBED = "nomic-embed-text"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")


def _load_dotenv(path: Path) -> None:
    """Minimal .env reader (KEY=VALUE per line). Never overrides variables already set."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if value[:1] in ('"', "'") and value.count(value[0]) >= 2:
            value = value[1:value.index(value[0], 1)]         # quoted: keep everything inside
        else:
            value = value.split(" #", 1)[0].split("\t#", 1)[0].strip()   # drop inline comments
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(HERE / ".env")


def ollama_running(url: str = OLLAMA_URL, timeout: float = 0.5) -> bool:
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/api/tags", timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def ollama_models(url: str = OLLAMA_URL, timeout: float = 0.5) -> list[str]:
    """Names of the models pulled into the local Ollama (empty if it isn't running)."""
    import json
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/api/tags", timeout=timeout) as r:
            return [m.get("name", "") for m in json.load(r).get("models", [])]
    except Exception:
        return []


def _pick_provider() -> str:
    wanted = os.getenv("LLM_PROVIDER", "").strip().lower()
    if wanted in ("openai", "ollama", "offline"):
        if wanted == "openai" and not os.getenv("OPENAI_API_KEY"):
            print("LLM_PROVIDER=openai but OPENAI_API_KEY is not set - falling back to offline.")
            return "offline"
        if wanted == "ollama" and not ollama_running():
            print(f"LLM_PROVIDER=ollama but nothing answers at {OLLAMA_URL} - falling back to offline.")
            return "offline"
        return wanted
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if ollama_running():
        return "ollama"
    return "offline"


PROVIDER = _pick_provider()

if PROVIDER == "openai":
    MODEL = os.getenv("OPENAI_MODEL", OPENAI_DEFAULT_MODEL)
    EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", OPENAI_DEFAULT_EMBED)
    BASE_URL, API_KEY = None, None                       # the SDK reads OPENAI_API_KEY itself
elif PROVIDER == "ollama":
    MODEL = os.getenv("OLLAMA_MODEL", OLLAMA_DEFAULT_MODEL)
    EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", OLLAMA_DEFAULT_EMBED)
    BASE_URL, API_KEY = OLLAMA_URL.rstrip("/") + "/v1", "ollama"   # any non-empty key works
    # Asking for a model that isn't pulled is a 404 on every call - check what is actually there.
    _pulled = ollama_models()
    _base = lambda n: n.split(":")[0]
    if _pulled and MODEL not in _pulled and not any(_base(p) == MODEL for p in _pulled):
        _chat = [p for p in _pulled if "embed" not in p]
        if _chat and "OLLAMA_MODEL" not in os.environ:
            print(f"Ollama: '{MODEL}' is not pulled; using '{_chat[0]}' instead. "
                  f"For tool calling pull a bigger model: ollama pull {OLLAMA_DEFAULT_MODEL}")
            MODEL = _chat[0]
        else:
            print(f"Ollama: model '{MODEL}' is not pulled - run: ollama pull {MODEL}")
    if _pulled and not any(_base(p) == _base(EMBED_MODEL) for p in _pulled):
        print(f"Ollama: embedding model '{EMBED_MODEL}' is not pulled - run: ollama pull {EMBED_MODEL}")
else:
    MODEL = os.getenv("OPENAI_MODEL", OPENAI_DEFAULT_MODEL)       # just a label offline
    EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", OPENAI_DEFAULT_EMBED)
    BASE_URL, API_KEY = "http://offline.invalid/v1", "offline"

OFFLINE = None            # the stand-in's knobs (latency, fail_next, ...) when PROVIDER == "offline"
if PROVIDER == "offline":
    from _offline_llm import OfflineEngine, OfflineTransport
    OFFLINE = OfflineEngine()
    _TRANSPORT = OfflineTransport(OFFLINE)


def _http_client(async_: bool = False):
    """httpx client for the offline transport (None for real providers = SDK default)."""
    if PROVIDER != "offline":
        return None
    import httpx
    return httpx.AsyncClient(transport=_TRANSPORT) if async_ else httpx.Client(transport=_TRANSPORT)


def make_client(async_: bool = False, **kwargs):
    """A fresh OpenAI (or AsyncOpenAI) client for the active provider. kwargs pass through,
    e.g. make_client(max_retries=0, timeout=10)."""
    from openai import AsyncOpenAI, OpenAI
    cls = AsyncOpenAI if async_ else OpenAI
    opts = dict(kwargs)
    if BASE_URL:
        opts.setdefault("base_url", BASE_URL)
    if API_KEY:
        opts.setdefault("api_key", API_KEY)
    hc = _http_client(async_)
    if hc is not None:
        opts.setdefault("http_client", hc)
    return cls(**opts)


client = make_client()


def make_async_client(**kwargs):
    return make_client(async_=True, **kwargs)


def chat(prompt: str, system: str | None = None, **kwargs) -> str:
    """One-shot helper: a prompt in, the reply text out (Chat Completions API)."""
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    resp = client.chat.completions.create(model=kwargs.pop("model", MODEL), messages=messages, **kwargs)
    return resp.choices[0].message.content


def embed(texts, **kwargs):
    """Embeddings for a string or a list of strings, as a list of float lists."""
    single = isinstance(texts, str)
    resp = client.embeddings.create(model=kwargs.pop("model", EMBED_MODEL), input=[texts] if single else texts,
                                    **kwargs)
    vecs = [d.embedding for d in resp.data]
    return vecs[0] if single else vecs


# ----------------------------------------------------------------- LangChain

def langchain_chat_model(**kwargs):
    """A LangChain ChatOpenAI wired to the active provider (OpenAI, Ollama or offline)."""
    from langchain_openai import ChatOpenAI
    opts = dict(model=MODEL)
    opts.update(kwargs)
    if BASE_URL:
        opts.setdefault("base_url", BASE_URL)
    if API_KEY:
        opts.setdefault("api_key", API_KEY)
    if PROVIDER == "offline":
        opts.setdefault("http_client", _http_client())
        opts.setdefault("http_async_client", _http_client(async_=True))
    return ChatOpenAI(**opts)


def langchain_embeddings(**kwargs):
    """A LangChain OpenAIEmbeddings wired to the active provider."""
    from langchain_openai import OpenAIEmbeddings
    opts = dict(model=EMBED_MODEL)
    opts.update(kwargs)
    if BASE_URL:
        opts.setdefault("base_url", BASE_URL)
    if API_KEY:
        opts.setdefault("api_key", API_KEY)
    if PROVIDER != "openai":
        # Ollama and the stand-in want raw strings, not tiktoken token ids.
        opts.setdefault("check_embedding_ctx_length", False)
    if PROVIDER == "offline":
        opts.setdefault("http_client", _http_client())
        opts.setdefault("http_async_client", _http_client(async_=True))
    return OpenAIEmbeddings(**opts)


def describe() -> None:
    where = {"openai": "OpenAI API (real answers, small cost)",
             "ollama": f"local Ollama at {OLLAMA_URL} (real answers, free)",
             "offline": "offline stand-in (no key, no Ollama) - canned answers, every cell still runs"}[PROVIDER]
    print(f"LLM provider : {PROVIDER} -> {where}")
    print(f"chat model   : {MODEL}")
    print(f"embed model  : {EMBED_MODEL}")


if os.getenv("LLM_SETUP_QUIET") != "1":
    describe()
