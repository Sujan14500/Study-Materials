"""The CI gate. Runs every tenant's golden set and fails on the WORST tenant.

    python evalgate.py                 # deterministic stub, seconds
    python evalgate.py --llm ollama    # real local models

Exit code is 1 if any tenant is below its own SLA, or if any tenant wrongly
auto-sent an answer. Wire this to a pre-merge check and a prompt change stops
being a guess.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from support import Platform, SupportAgent
from support.evals import report, run_tenant
from support.llm import StubLLM, get_llm
from support.seed import build


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", default="stub", choices=["stub", "ollama", "auto"])
    ap.add_argument("--db", default=None, help="persist instead of using a temp file")
    args = ap.parse_args()

    tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    p = Platform(args.db or str(Path(tmp.name) / "eval.db"))
    goldens = build(p)
    llm = StubLLM() if args.llm == "stub" else get_llm(args.llm)

    print(f"eval gate · {len(goldens)} tenants · llm={llm.name}")
    print("-" * 78)

    scores, slas = [], {}
    for t in p.tenants():
        tdb = p.scope(t.tenant_id)
        agent = SupportAgent(tdb, llm)
        scores.append(run_tenant(agent, goldens[t.tenant_id]))
        slas[t.tenant_id] = float(t.get("sla_accuracy"))

    lines, worst, passed = report(scores, slas)
    print("\n".join(lines))

    total = sum(s.total for s in scores)
    cost = sum(s.cost_cents for s in scores)
    print(f"\n  {total} cases · notional inference cost {cost:.3f}¢ "
          f"({cost / total:.4f}¢ per case) · actual $0.00 on local models")

    print("\n" + ("PASS" if passed else "FAIL — a tenant is below its SLA"))
    p.close()
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
