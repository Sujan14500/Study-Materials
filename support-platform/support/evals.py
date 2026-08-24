"""Per-tenant evals, and the rule that makes them mean something:

    the SLA is the WORST tenant's score, not the average.

An average hides the tenant who is about to churn. Tenant 12 does not care that
the fleet is at 91% if their own desk is at 62% — they care about their own
inbox, and they are the one who leaves.

Each tenant owns a golden set: questions with the article that must be cited,
plus questions that must be refused. The refusal cases matter more than the
answers — a support bot that confidently answers what it does not know is worse
than one that says "let me get a human", and only the refusal cases catch it.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TenantScore:
    tenant_id: str
    name: str
    total: int = 0
    correct: int = 0
    auto_sent: int = 0
    wrongly_auto_sent: int = 0
    refused_correctly: int = 0
    missed_refusals: int = 0
    cost_cents: float = 0.0
    failures: list = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        return self.correct / self.total if self.total else 0.0

    @property
    def deflection(self) -> float:
        return self.auto_sent / self.total if self.total else 0.0


def run_tenant(agent, golden: list) -> TenantScore:
    t = agent.tenant
    s = TenantScore(t.tenant_id, t.name)

    for case in golden:
        s.total += 1
        # record=False: evals must not pollute the tenant's own ticket analytics.
        reply = agent.answer(case.get("user_id", "eval-user"), case["q"], record=False)
        s.cost_cents += reply.cost_cents

        if case.get("must_refuse"):
            ok = reply.action in ("refuse", "review")
            if ok:
                s.refused_correctly += 1
            else:
                s.missed_refusals += 1
                s.failures.append(f"answered a question it should not have: {case['q']!r}")
        else:
            cited = {c["title"] for c in reply.citations}
            ok = case["must_cite"] in cited
            if not ok:
                s.failures.append(
                    f"{case['q']!r} cited {sorted(cited) or 'nothing'}, expected {case['must_cite']!r}")

        if reply.action == "auto_send":
            s.auto_sent += 1
            if not ok:
                # The expensive failure: wrong AND sent to a customer unreviewed.
                s.wrongly_auto_sent += 1

        s.correct += int(ok)

    return s


def report(scores: list, sla_by_tenant: dict) -> tuple:
    """Returns (lines, worst_tenant, passed). Exit non-zero on `passed is False`."""
    lines = []
    w = max((len(s.name) for s in scores), default=8)
    lines.append(f"  {'tenant':<{w}}  {'n':>3}  {'acc':>6}  {'auto':>6}  "
                 f"{'bad auto':>8}  {'missed ref':>10}  {'SLA':>6}  status")
    worst, passed = None, True

    for s in sorted(scores, key=lambda x: x.accuracy):
        sla = sla_by_tenant.get(s.tenant_id, 0.8)
        ok = s.accuracy >= sla and s.wrongly_auto_sent == 0
        passed &= ok
        worst = worst or s
        lines.append(f"  {s.name:<{w}}  {s.total:>3}  {s.accuracy:>5.0%}  {s.deflection:>5.0%}  "
                     f"{s.wrongly_auto_sent:>8}  {s.missed_refusals:>10}  {sla:>5.0%}  "
                     f"{'ok' if ok else 'FAIL'}")

    if worst:
        lines.append("")
        lines.append(f"  worst tenant: {worst.name} at {worst.accuracy:.0%} "
                     f"— this is the number the SLA is written against")
    for s in scores:
        for f in s.failures:
            lines.append(f"    [{s.name}] {f}")

    return lines, worst, passed
