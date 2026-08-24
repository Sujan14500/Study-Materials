"""LLM providers.

Two of them, on purpose:

  stub    deterministic, no network. Every test runs against this, because an
          eval suite that calls a nondeterministic model is not a test suite.
  ollama  local models over http://localhost:11434. Free, private, and it makes
          the model ladder real: a 270M model decides whether a message is even
          a refund request, and only then does a 3B model do extraction.

Swapping in a hosted provider means adding one class with a .chat() method.
Nothing else in this codebase knows what a model is.
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

# The ladder. Small model triages, large model extracts. Both local.
TIERS = {
    "small": os.environ.get("REFUND_MODEL_SMALL", "gemma3:270m"),
    "large": os.environ.get("REFUND_MODEL_LARGE", "llama3.2:latest"),
}


@dataclass
class Usage:
    """What a call cost. Local models are free in money and not in time."""

    calls: int = 0
    prompt_tokens: int = 0
    output_tokens: int = 0
    ms: float = 0.0
    by_tier: dict = field(default_factory=dict)

    def add(self, tier: str, prompt_tokens: int, output_tokens: int, ms: float) -> None:
        self.calls += 1
        self.prompt_tokens += prompt_tokens
        self.output_tokens += output_tokens
        self.ms += ms
        t = self.by_tier.setdefault(tier, {"calls": 0, "ms": 0.0})
        t["calls"] += 1
        t["ms"] += ms


class LLMError(RuntimeError):
    pass


class StubLLM:
    """Deterministic stand-in. Understands exactly the two prompts we send it.

    It is intentionally dumb: it proves the *system* works when the model
    behaves, and the tests inject bad output separately to prove the system
    works when it does not.
    """

    name = "stub"

    def __init__(self) -> None:
        self.usage = Usage()

    def chat(self, system: str, user: str, tier: str = "large", json_mode: bool = False) -> str:
        t0 = time.perf_counter()
        out = self._respond(system, user)
        self.usage.add(tier, len(system + user) // 4, len(out) // 4, (time.perf_counter() - t0) * 1000)
        return out

    def _respond(self, system: str, user: str) -> str:
        low = user.lower()
        if "classifier" in system.lower():
            hit = any(w in low for w in ("refund", "return", "money back", "cancel my order", "broken", "damaged"))
            return "yes" if hit else "no"

        order = re.search(r"\b(O-\d+)\b", user, re.I)
        amount = re.search(r"\$\s?([\d,]+(?:\.\d{1,2})?)", user)
        reason = "damaged" if "damag" in low or "broken" in low else (
            "not_as_described" if "not as described" in low or "wrong" in low else "changed_mind"
        )
        return json.dumps(
            {
                "order_id": order.group(1).upper() if order else None,
                "reason": reason,
                # Note: whatever number appears in the message. The customer does
                # not get to decide what is legal — policy.py does.
                "requested_amount": float(amount.group(1).replace(",", "")) if amount else None,
            }
        )


class OllamaLLM:
    """Local models. Never leaves the machine, costs nothing, still unreliable."""

    name = "ollama"

    def __init__(self, url: str = OLLAMA_URL, timeout: float = 120.0) -> None:
        self.url = url.rstrip("/")
        self.timeout = timeout
        self.usage = Usage()

    def chat(self, system: str, user: str, tier: str = "large", json_mode: bool = False) -> str:
        model = TIERS.get(tier, TIERS["large"])
        payload = {
            "model": model,
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

        ms = (time.perf_counter() - t0) * 1000
        self.usage.add(tier, body.get("prompt_eval_count", 0), body.get("eval_count", 0), ms)
        return body.get("message", {}).get("content", "")


def available(url: str = OLLAMA_URL) -> bool:
    try:
        with urllib.request.urlopen(url + "/api/tags", timeout=2.0):
            return True
    except Exception:
        return False


def get_llm(name: str | None = None):
    """REFUND_LLM=stub|ollama|auto (default auto: ollama if up, else stub)."""
    name = (name or os.environ.get("REFUND_LLM", "auto")).lower()
    if name == "stub":
        return StubLLM()
    if name == "ollama":
        return OllamaLLM()
    return OllamaLLM() if available() else StubLLM()
