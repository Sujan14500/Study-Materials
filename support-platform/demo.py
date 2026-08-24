"""Narrated walkthrough of the platform.

    python demo.py                # deterministic stub model, instant
    python demo.py --llm ollama   # real local models

Six scenes, in the order a sceptical reviewer would ask about them.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    # sys.stdout is typed TextIO, which does not declare reconfigure; the
    # hasattr guard above is the real check.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

from support import Analytics, IsolationError, Platform, SupportAgent
from support.agent import period_now
from support.llm import StubLLM, get_llm
from support.seed import build, seed_history

W = 78


def head(n: int, title: str, why: str) -> None:
    print("\n" + "=" * W)
    print(f"{n}. {title}")
    print(f"   {why}")
    print("=" * W)


def show(reply, label: str = "") -> None:
    print(f"\n   {label}")
    print(f"     action     {reply.action}   (confidence {reply.confidence})")
    print(f"     answer     {reply.text[:150]}")
    if reply.citations:
        print(f"     cited      {[c['title'] for c in reply.citations]}")
    if reply.memories_used:
        print(f"     memory     {reply.memories_used}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", default="stub", choices=["stub", "ollama", "auto"])
    args = ap.parse_args()

    tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    p = Platform(str(Path(tmp.name) / "demo.db"))
    build(p)
    llm = StubLLM() if args.llm == "stub" else get_llm(args.llm)
    print(f"support platform demo · 3 tenants · model backend: {llm.name}")

    acme = SupportAgent(p.scope("acme"), llm)
    zenith = SupportAgent(p.scope("zenith"), llm)
    bloom = SupportAgent(p.scope("bloom"), llm)

    # ------------------------------------------------------------------- 1
    head(1, "Two tenants, one question, two different right answers",
         "Acme refunds in 30 days. Zenith refunds in 14. A leak looks like a correct answer.")
    q = "how long do I have for a refund?"
    for name, agent in (("acme  ", acme), ("zenith", zenith)):
        top = agent.index.search(q, k=1)[0]
        print(f"\n   {name} retrieves -> {top.title}: {top.text[:105]}")
    print("\n   Neither is confident enough to auto-send this loose phrasing, so both")
    print("   go to a human — and each human sees only their own tenant's policy:")
    show(acme.answer("u-1", q, record=False), "acme  ->")
    show(zenith.answer("u-1", q, record=False), "zenith ->")
    print("\n   Same code, same index class, same model. The only difference is which")
    print("   TenantDB was handed in — and there is no way to get an unscoped one.")

    # ------------------------------------------------------------------- 2
    head(2, "Customer memory, and the four operations",
         "Mem0's pipeline: extract from what the CUSTOMER said, then reconcile.")
    for turn in (["Hi, we're on the Starter plan and we have 12 seats."],
                 ["Actually we upgraded to Business this morning."],
                 ["We're on the Business plan, just confirming."],
                 ["We are no longer on the Business plan, we downgraded."]):
        ops = acme.observe("u-1", turn)
        print(f"\n   customer: {turn[0]}")
        for o in ops:
            extra = f"  (was: {o['was']})" if o.get("was") else ""
            print(f"     {o['op']:<7} {o.get('text', '')}{extra}")
    print(f"\n   store now: {[m['text'] for m in acme.memory.all('u-1')]}")
    print("   Four turns, one slot. A transcript would still contain 'Starter'.")

    # ------------------------------------------------------------------- 3
    head(3, "The same user_id in another tenant shares nothing",
         "Mem0 scopes by user_id. A platform must scope by (tenant, user).")
    zenith.observe("u-1", ["We're on the Enterprise plan with 500 seats."])
    print(f"\n   acme   u-1: {[m['text'] for m in acme.memory.all('u-1')]}")
    print(f"   zenith u-1: {[m['text'] for m in zenith.memory.all('u-1')]}")
    print(f"\n   acme searching zenith's fact: {acme.memory.search('u-1', 'how many seats')}")
    n = acme.memory.forget("u-1")
    print(f"   erasure endpoint: acme forgot {n} memories for u-1; "
          f"zenith still has {len(zenith.memory.all('u-1'))}")

    # ------------------------------------------------------------------- 4
    head(4, "The gate: auto-send, review, refuse",
         "Confidence comes from retrieval. An uncited answer is never auto-sent.")
    show(acme.answer("u-2", "where do I create an API key?", record=False), "covered      →")
    show(acme.answer("u-2", "what is your VAT registration number?", record=False), "weak match   →")
    show(acme.answer("u-2", "write me a poem about kubernetes", record=False), "not covered  →")

    # ------------------------------------------------------------------- 5
    head(5, "Over budget: degrade, do not fail",
         "A support desk that 500s because of a billing threshold is worse than a slow one.")
    btdb = p.scope("bloom")
    print(f"\n   bloom cap {btdb.tenant.get('budget_cents_per_period')}¢ · "
          f"spent {btdb.spend(period_now()):.3f}¢")
    r = bloom.answer("u-9", "can I move my appointment?", record=False)
    show(r, "inside budget →")
    btdb.add_spend(period_now(), 10_000)
    r = SupportAgent(btdb, llm).answer("u-9", "can I move my appointment?", record=False)
    show(r, "over budget   →")
    print(f"     degraded   {r.degraded}   model spend on this call: {r.cost_cents}¢")
    print("\n   Retrieval still runs. The human still gets the snippet. Nothing 500s.")

    # ------------------------------------------------------------------- 6
    head(6, "Tenant analytics: the Data Formulator loop",
         "ask → generate SQL → validate → execute → check the result → repair → thread")
    tdb = p.scope("acme")
    seed_history(tdb, n=140)
    an = Analytics(tdb, llm)

    first = None
    for ask, anchor in (("deflection rate by category", False),
                        ("average handle time by category", True),
                        ("share of tickets by category", False)):
        r = an.ask(ask, parent=first if anchor else None)
        first = first or r.thread_id
        print(f"\n   ask: {ask}")
        print(f"   sql: {r.sql[:150]}")
        print(an.chart(r))
        for c in r.checks:
            print(f"     [{'ok  ' if c['passed'] else 'FAIL'}] {c['name']:<28} {c['detail']}")

    print("\n   data threads (lineage, branchable):")
    print(an.lineage())

    print("\n   The generated SQL never contains a tenant filter — the platform wraps")
    print("   it in a CTE of this tenant's rows. A model that forgets, or is talked")
    print("   out of it, produces exactly the same answer:")
    rows = tdb.select("SELECT COUNT(*) AS n FROM tickets WHERE tenant_id = 'zenith'")
    print(f"     SELECT COUNT(*) FROM tickets WHERE tenant_id='zenith'  ->  {rows[0]['n']} rows")
    try:
        tdb.select("SELECT * FROM memories")
    except IsolationError as e:
        print(f"     SELECT * FROM memories  ->  refused: {e}")

    # ------------------------------------------------------------------- fin
    print("\n" + "=" * W)
    m = llm.meter
    print(f"platform totals · {m.calls} model calls · {m.tokens_in}/{m.tokens_out} tokens")
    print(f"                 notional {m.notional_cents:.3f}¢ · actual $0.00 (local)")
    for tid in ("acme", "bloom", "zenith"):
        t = p.scope(tid)
        print(f"   {t.tenant.name:<14} spend {t.spend(period_now()):8.3f}¢ · "
              f"tickets {len(t.tickets()):>4} · memories {len(t.memories()):>2}")
    print("=" * W)
    p.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
