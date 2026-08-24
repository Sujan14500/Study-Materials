"""Dump ground truth from the real Python so test.js can check the JS ports.

The page re-implements policy.decide, BM25, confidence(), the gate, the SQL
validator and the eval scorer in JavaScript. Re-implementations rot. This
script runs the actual modules and prints JSON; test.js runs the JS and
compares. If someone changes a threshold in Python and not on the page, the
walkthrough starts teaching something that is no longer true, and the test fails.

    python parity.py > /dev/null && node test.js
"""

from __future__ import annotations

import json
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "refund-agent"))
sys.path.insert(0, str(HERE.parent / "support-platform"))

from refund_agent import policy                                   # noqa: E402
from support import Platform, SupportAgent                        # noqa: E402
from support.evals import run_tenant                              # noqa: E402
from support.llm import StubLLM                                   # noqa: E402
from support.retrieval import Index, confidence                   # noqa: E402
from support.seed import TENANTS, build                           # noqa: E402
from support.store import IsolationError                          # noqa: E402

# The same scenarios the page ships as presets, plus the boundary cases.
POLICY_CASES = [
    {"total": 2400, "refunded": 0, "days": 4, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 28000, "refunded": 0, "days": 6, "fraud": 0.0, "reason": "not_as_described", "asked": None},
    {"total": 3000, "refunded": 0, "days": 2, "fraud": 0.0, "reason": "damaged", "asked": 5000000},
    {"total": 10000, "refunded": 7000, "days": 5, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 90, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 90, "fraud": 0.0, "reason": "never_arrived", "asked": None},
    {"total": 3000, "refunded": 0, "days": 3, "fraud": 0.95, "reason": "damaged", "asked": None},
    {"total": 1000, "refunded": 0, "days": 3, "fraud": 0.60, "reason": "damaged", "asked": None},
    {"total": 2000, "refunded": 0, "days": 3, "fraud": 0.0, "reason": "<script>alert(1)</script>", "asked": None},
    # boundaries
    {"total": 5000, "refunded": 0, "days": 1, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 5001, "refunded": 0, "days": 1, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 30, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 31, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 4000, "days": 1, "fraud": 0.0, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 1, "fraud": 0.80, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 1, "fraud": 0.45, "reason": "damaged", "asked": None},
    {"total": 4000, "refunded": 0, "days": 1, "fraud": 0.0, "reason": "changed_mind", "asked": 0},
    {"total": 9000, "refunded": 0, "days": 1, "fraud": 0.0, "reason": "duplicate_charge", "asked": 2500},
]

SQL_CASES = [
    "SELECT category, COUNT(*) AS tickets FROM tickets GROUP BY category",
    "SELECT COUNT(*) AS n FROM tickets",
    "SELECT COUNT(*) AS n FROM tickets WHERE tenant_id = 'acme'",
    "SELECT * FROM memories",
    "SELECT * FROM tenants",
    "DROP TABLE tickets",
    "SELECT 1; DROP TABLE tickets",
    "UPDATE tickets SET csat = 5",
    "SELECT * FROM tickets UNION SELECT * FROM tickets",
    "PRAGMA table_info(tickets)",
    "SELECT * FROM docs JOIN tickets ON 1=1",
]

RETRIEVAL_PROBES = [
    "how long do I have for a refund?",
    "how do I create an API key?",
    "what is the rate limit?",
    "can I move my appointment?",
    "where do I create an API key?",
    "how long do I have to return something?",
    "what is your VAT registration number?",
    "write me a poem about kubernetes",
    "what does a 429 mean?",
]


def policy_truth() -> list:
    out = []
    today = date.today()
    for c in POLICY_CASES:
        order = {
            "order_id": "O-1", "total_cents": c["total"], "refunded_cents": c["refunded"],
            "status": "delivered", "fraud_score": c["fraud"],
            "delivered_on": today - timedelta(days=c["days"]), "sku": "SKU-1",
        }
        d = policy.decide(order, {"reason": c["reason"], "requested_amount_cents": c["asked"]}, today)
        out.append({"case": c, "allowed": d.allowed, "amount": d.amount_cents,
                    "requires": d.requires_approval, "restock": d.restock,
                    "reasons": list(d.reasons)})
    return out


def support_truth() -> dict:
    tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    p = Platform(str(Path(tmp.name) / "parity.db"))
    goldens = build(p)
    llm = StubLLM()

    retrieval, evals = [], []
    for t in p.tenants():
        tdb = p.scope(t.tenant_id)
        idx = Index(tdb.docs())
        for q in RETRIEVAL_PROBES:
            hits = idx.search(q, k=3)
            retrieval.append({
                "tenant": t.tenant_id, "q": q,
                "titles": [h.title for h in hits],
                "top": round(hits[0].score, 6) if hits else 0.0,
                "conf": round(confidence(hits, q), 6),
            })
        s = run_tenant(SupportAgent(tdb, llm), goldens[t.tenant_id])
        evals.append({"tenant": t.tenant_id, "name": s.name, "n": s.total,
                      "acc": round(s.accuracy, 6), "auto": round(s.deflection, 6),
                      "bad_auto": s.wrongly_auto_sent, "missed_ref": s.missed_refusals,
                      "failures": s.failures})

    sql = []
    tdb = p.scope("acme")
    for q in SQL_CASES:
        try:
            tdb.select(q)
            sql.append({"sql": q, "allowed": True})
        except IsolationError as e:
            sql.append({"sql": q, "allowed": False, "why": str(e)})
        except Exception as e:                       # a SELECT that is valid but broken
            sql.append({"sql": q, "allowed": True, "runtime_error": type(e).__name__})

    p.close()
    return {"retrieval": retrieval, "evals": evals, "sql": sql,
            "tenants": {tid: {"docs": [[d[0], d[1]] for d in spec["docs"]],
                              "config": spec["config"],
                              "golden": spec["golden"]}
                        for tid, spec in TENANTS.items()}}


def main() -> int:
    truth = {
        "policy_constants": {
            "AUTO_APPROVE_LIMIT_CENTS": policy.AUTO_APPROVE_LIMIT_CENTS,
            "RETURN_WINDOW_DAYS": policy.RETURN_WINDOW_DAYS,
            "FRAUD_BLOCK_SCORE": policy.FRAUD_BLOCK_SCORE,
            "FRAUD_REVIEW_SCORE": policy.FRAUD_REVIEW_SCORE,
            "VALID_REASONS": list(policy.VALID_REASONS),
            "NO_RESTOCK_REASONS": list(policy.NO_RESTOCK_REASONS),
        },
        "policy": policy_truth(),
    }
    truth.update(support_truth())

    (HERE / "parity.json").write_text(json.dumps(truth, indent=1, default=str), encoding="utf-8")
    print("wrote parity.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
