"""Tenant analytics, built on Data Formulator's loop rather than its UI.

Microsoft Research's Data Formulator pairs chart-encoding shelves with a natural
language prompt, has a model generate the *data transformation*, executes it,
validates that the result actually contains the requested fields, and repairs on
failure — keeping every derivation as a branchable "data thread".

What is worth stealing is the loop, not the UI:

    ask -> generate SQL -> VALIDATE -> execute -> CHECK the result -> repair -> thread

Two additions this system needs that a single-user research tool does not:

  1. The tenant predicate is never generated. `TenantDB.select()` wraps whatever
     the model wrote in a CTE containing only this tenant's rows. A model that
     omits the filter, or is talked into omitting it, produces the same answer.
  2. Every result is checked against assertions derived from the ask — shares
     must sum to 100, counts must tie back to the ticket table, percentages must
     be in range. A wrong chart renders exactly as smoothly as a right one, so
     something other than the human eye has to catch it.

Threads carry `parent`, so a follow-up ask is anchored to an earlier derivation
instead of rebuilding it — the same reason Data Formulator does it: shorter
generated code, fewer ways to be wrong.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .store import IsolationError

SQL_SYSTEM = """You are a SQL analyst. Write ONE SQLite SELECT that answers the question.

Schema — table `tickets`:
  created_at      TEXT   ISO timestamp
  category        TEXT   billing | technical | account | shipping
  question        TEXT
  resolution      TEXT   auto_send | review | refuse
  confidence      REAL   0..1
  handle_seconds  INTEGER
  csat            INTEGER 1..5, may be NULL
  cost_cents      REAL

Rules:
  - SELECT only. No INSERT/UPDATE/DELETE/DROP/ATTACH/PRAGMA, no semicolons,
    no second statement, no other tables.
  - Do NOT filter by tenant. The platform scopes the table for you.
  - Alias every computed column with a readable name.
  - Return ONLY the SQL. No prose, no markdown fences."""

REPAIR_SYSTEM = SQL_SYSTEM + """

Your previous query failed. Fix it. The error follows the question."""


@dataclass
class Result:
    ask: str
    sql: str
    rows: list
    columns: list
    checks: list = field(default_factory=list)
    repairs: int = 0
    thread_id: int | None = None
    parent: int | None = None

    @property
    def ok(self) -> bool:
        return all(c["passed"] for c in self.checks)


def _clean(sql: str) -> str:
    sql = re.sub(r"```(?:sql)?", "", sql or "").strip()
    # Models like to explain themselves. Keep from the first SELECT onward.
    m = re.search(r"\bselect\b", sql, re.I)
    return (sql[m.start():] if m else sql).strip().rstrip(";").strip()


class Analytics:
    def __init__(self, tdb, llm, max_repairs: int = 2) -> None:
        self.tdb = tdb
        self.llm = llm
        self.max_repairs = max_repairs

    # ------------------------------------------------------------------ ask
    def ask(self, question: str, *, parent: int | None = None, label: str | None = None) -> Result:
        context = question
        if parent is not None:
            prev = next((t for t in self.tdb.threads() if t["id"] == parent), None)
            if prev is not None:
                # Anchoring: the model sees what has already been derived, so the
                # follow-up query is smaller than a from-scratch one.
                context = (f"{question}\n\n"
                           f"-- previously derived (thread {prev['id']}: {prev['ask']}):\n"
                           f"-- {prev['sql']}")

        sql = _clean(self.llm.chat(SQL_SYSTEM, context, tier="large"))
        repairs, last_error = 0, None

        while True:
            try:
                rows = self.tdb.select(sql)
                break
            except (IsolationError, Exception) as e:          # noqa: BLE001
                last_error = e
                if repairs >= self.max_repairs:
                    return Result(question, sql, [], [],
                                  checks=[{"name": "executes", "passed": False, "detail": repr(e)}],
                                  repairs=repairs, parent=parent)
                repairs += 1
                sql = _clean(self.llm.chat(
                    REPAIR_SYSTEM, f"{context}\n\nFAILED SQL:\n{sql}\n\nERROR: {e}", tier="large"))

        cols = list(rows[0].keys()) if rows else []
        data = [dict(r) for r in rows]
        checks = self._check(question, data, cols)

        thread_id = self.tdb.add_thread(
            label or f"t{len(self.tdb.threads()) + 1}", question, sql, data, checks, parent, repairs)

        return Result(question, sql, data, cols, checks, repairs, thread_id, parent)

    # --------------------------------------------------------------- checks
    def _check(self, question: str, rows: list, cols: list) -> list:
        """Assertions derived from the ask. Every one of these has shipped as a
        real wrong dashboard somewhere."""
        checks = [{"name": "executes", "passed": True, "detail": f"{len(rows)} rows"}]

        checks.append({"name": "returned rows", "passed": bool(rows),
                       "detail": f"{len(rows)} rows" if rows
                       else "empty result — the question may not match the data"})
        if not rows:
            return checks

        pct_cols = [c for c in cols if c.endswith("_pct") or "percent" in c or "share" in c]
        for c in pct_cols:
            vals = [r[c] for r in rows if isinstance(r[c], (int, float))]
            in_range = all(-100.001 <= v <= 100.001 for v in vals)
            checks.append({"name": f"{c} in range", "passed": in_range,
                           "detail": f"min={min(vals):.1f} max={max(vals):.1f}" if vals else "n/a"})
            if "share" in c and len(rows) > 1:
                total = sum(vals)
                checks.append({"name": f"{c} sums to 100", "passed": abs(total - 100) < 0.5,
                               "detail": f"sums to {total:.1f}"})

        count_cols = [c for c in cols if c in ("tickets", "n", "count", "total")]
        if count_cols:
            actual = len(self.tdb.tickets())
            got = sum(r[count_cols[0]] for r in rows if isinstance(r[count_cols[0]], (int, float)))
            # Only a full partition should tie back; a filtered query legitimately will not.
            checks.append({"name": "counts tie back to tickets", "passed": got <= actual,
                           "detail": f"query {got} vs table {actual}"})

        return checks

    # ---------------------------------------------------------------- chart
    @staticmethod
    def chart(result: Result, width: int = 34) -> str:
        if not result.rows:
            return "   (no rows)"
        label_col = result.columns[0]
        num_cols = [c for c in result.columns[1:]
                    if all(isinstance(r[c], (int, float)) for r in result.rows)]
        if not num_cols:
            return "   (nothing numeric to plot)"
        value_col = num_cols[0]

        top = max(abs(r[value_col]) for r in result.rows) or 1
        lines = [f"   {label_col} × {value_col}"]
        for r in result.rows:
            v = r[value_col]
            bar = "█" * max(1, int(abs(v) / top * width))
            lines.append(f"   {str(r[label_col])[:14]:<14} {bar} {v:g}")
        return "\n".join(lines)

    def lineage(self) -> str:
        rows = self.tdb.threads()
        if not rows:
            return "   (no derivations yet)"
        out = []
        for t in rows:
            indent = "     └─ " if t["parent"] else "   "
            checks = json.loads(t["checks"])
            bad = [c["name"] for c in checks if not c["passed"]]
            flag = f"  ⚠ {', '.join(bad)}" if bad else ""
            repairs = f"  (repaired ×{t['repairs']})" if t["repairs"] else ""
            out.append(f"{indent}{t['label']}  {t['ask']}{repairs}{flag}")
        return "\n".join(out)
