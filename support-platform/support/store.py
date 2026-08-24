"""Storage, and the isolation boundary.

The constraint for this whole project is that tenant A must never, by any path,
read tenant B's data. One leak ends the product, so isolation is not a filter
you remember to add — it is the only way to reach the data at all.

Design:
  * There is no public method anywhere that takes raw SQL from a caller.
  * `Platform.scope(tenant_id)` hands back a `TenantDB`. Every method on it
    injects `tenant_id = ?` itself. The caller cannot omit it, spell it wrong,
    or interpolate it.
  * Read-only analytical SQL (the one place generated text becomes a query) goes
    through `TenantDB.select()`, which validates the statement and appends the
    tenant predicate *itself* rather than trusting anything upstream.

`tests/test_isolation.py` checks this behaviourally, not structurally: tenant B
is seeded with a document that would obviously answer tenant A's question, and
the assertion is that tenant A never sees it.
"""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id     TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  config        TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS docs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  category   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  memory_id  INTEGER,
  op         TEXT NOT NULL,
  detail     TEXT,
  at         TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL,
  user_id         TEXT,
  created_at      TEXT NOT NULL,
  category        TEXT NOT NULL,
  question        TEXT NOT NULL,
  resolution      TEXT NOT NULL,
  confidence      REAL,
  handle_seconds  INTEGER,
  csat            INTEGER,
  cost_cents      REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS spend (
  tenant_id  TEXT NOT NULL,
  period     TEXT NOT NULL,
  cents      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, period)
);
CREATE TABLE IF NOT EXISTS threads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL,
  label       TEXT NOT NULL,
  ask         TEXT NOT NULL,
  sql         TEXT NOT NULL,
  parent      INTEGER,
  rows        TEXT NOT NULL,
  checks      TEXT NOT NULL,
  repairs     INTEGER NOT NULL DEFAULT 0,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS docs_t   ON docs(tenant_id);
CREATE INDEX IF NOT EXISTS mem_t    ON memories(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS tick_t   ON tickets(tenant_id);
"""

DEFAULT_CONFIG = {
    "auto_send_at": 0.72,        # confidence needed to reply without a human
    "refuse_below": 0.35,        # below this we say "I don't know" instead of guessing
    "budget_cents_per_period": 500.0,
    "sla_accuracy": 0.80,        # the per-tenant floor the eval gate enforces
    "brand_voice": "friendly and concise",
}

# Only these tables may appear in generated analytical SQL.
ANALYTICS_TABLES = {"tickets"}
SQL_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|"
    r"union|begin|commit)\b", re.I)


class IsolationError(RuntimeError):
    """Raised when something tries to leave its tenant. Never caught, always loud."""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Tenant:
    tenant_id: str
    name: str
    config: dict = field(default_factory=lambda: dict(DEFAULT_CONFIG))

    def get(self, key: str):
        return self.config.get(key, DEFAULT_CONFIG.get(key))


class Platform:
    """Owns the connection. Hands out scoped views and nothing else."""

    def __init__(self, path: str = "support.db") -> None:
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.commit()

    def add_tenant(self, tenant_id: str, name: str, config: dict | None = None) -> Tenant:
        cfg = dict(DEFAULT_CONFIG)
        cfg.update(config or {})
        with self.db:
            self.db.execute("INSERT OR REPLACE INTO tenants (tenant_id, name, config) VALUES (?,?,?)",
                            (tenant_id, name, json.dumps(cfg)))
        return Tenant(tenant_id, name, cfg)

    def tenants(self) -> list:
        return [Tenant(r["tenant_id"], r["name"], json.loads(r["config"]))
                for r in self.db.execute("SELECT * FROM tenants ORDER BY tenant_id")]

    def scope(self, tenant_id: str) -> "TenantDB":
        row = self.db.execute("SELECT * FROM tenants WHERE tenant_id = ?", (tenant_id,)).fetchone()
        if row is None:
            raise IsolationError(f"unknown tenant {tenant_id!r} — refusing to open an unscoped view")
        return TenantDB(self.db, Tenant(row["tenant_id"], row["name"], json.loads(row["config"])))

    def close(self) -> None:
        self.db.close()


class TenantDB:
    """Everything an application can touch. All of it filtered, by construction."""

    def __init__(self, db: sqlite3.Connection, tenant: Tenant) -> None:
        self._db = db
        self.tenant = tenant
        self.tenant_id = tenant.tenant_id

    # ---------------------------------------------------------------- docs
    def add_doc(self, title: str, body: str) -> int:
        with self._db:
            cur = self._db.execute("INSERT INTO docs (tenant_id, title, body) VALUES (?,?,?)",
                                   (self.tenant_id, title, body))
        return cur.lastrowid

    def docs(self) -> list:
        return self._db.execute("SELECT * FROM docs WHERE tenant_id = ? ORDER BY id",
                                (self.tenant_id,)).fetchall()

    # ------------------------------------------------------------ memories
    def memories(self, user_id: str | None = None) -> list:
        if user_id is None:
            return self._db.execute(
                "SELECT * FROM memories WHERE tenant_id = ? ORDER BY id", (self.tenant_id,)).fetchall()
        return self._db.execute(
            "SELECT * FROM memories WHERE tenant_id = ? AND user_id = ? ORDER BY id",
            (self.tenant_id, user_id)).fetchall()

    def add_memory(self, user_id: str, text: str, category: str = "general") -> int:
        with self._db:
            cur = self._db.execute(
                "INSERT INTO memories (tenant_id, user_id, text, category, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?)",
                (self.tenant_id, user_id, text, category, now(), now()))
        return cur.lastrowid

    def update_memory(self, memory_id: int, text: str) -> int:
        with self._db:
            cur = self._db.execute(
                "UPDATE memories SET text = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
                (text, now(), memory_id, self.tenant_id))
        return cur.rowcount            # 0 means it was not ours. Silently, safely, nothing.

    def delete_memory(self, memory_id: int) -> int:
        with self._db:
            cur = self._db.execute("DELETE FROM memories WHERE id = ? AND tenant_id = ?",
                                   (memory_id, self.tenant_id))
        return cur.rowcount

    def forget_user(self, user_id: str) -> int:
        """The erasure endpoint. Has to exist as code, not as a runbook."""
        with self._db:
            cur = self._db.execute("DELETE FROM memories WHERE tenant_id = ? AND user_id = ?",
                                   (self.tenant_id, user_id))
        return cur.rowcount

    def log_memory_event(self, user_id: str, memory_id: int | None, op: str, detail: str = "") -> None:
        with self._db:
            self._db.execute(
                "INSERT INTO memory_events (tenant_id, user_id, memory_id, op, detail, at)"
                " VALUES (?,?,?,?,?,?)",
                (self.tenant_id, user_id, memory_id, op, detail[:400], now()))

    def memory_events(self, user_id: str | None = None) -> list:
        if user_id is None:
            return self._db.execute("SELECT * FROM memory_events WHERE tenant_id = ? ORDER BY id",
                                    (self.tenant_id,)).fetchall()
        return self._db.execute(
            "SELECT * FROM memory_events WHERE tenant_id = ? AND user_id = ? ORDER BY id",
            (self.tenant_id, user_id)).fetchall()

    # -------------------------------------------------------------- tickets
    def add_ticket(self, **kw) -> int:
        cols = ("user_id", "created_at", "category", "question", "resolution",
                "confidence", "handle_seconds", "csat", "cost_cents")
        vals = [kw.get(c) for c in cols]
        with self._db:
            cur = self._db.execute(
                f"INSERT INTO tickets (tenant_id, {', '.join(cols)}) "
                f"VALUES (?, {', '.join('?' * len(cols))})",
                (self.tenant_id, *vals))
        return cur.lastrowid

    def tickets(self) -> list:
        return self._db.execute("SELECT * FROM tickets WHERE tenant_id = ? ORDER BY id",
                                (self.tenant_id,)).fetchall()

    # ---------------------------------------------------------------- spend
    def spend(self, period: str) -> float:
        row = self._db.execute("SELECT cents FROM spend WHERE tenant_id = ? AND period = ?",
                               (self.tenant_id, period)).fetchone()
        return row["cents"] if row else 0.0

    def add_spend(self, period: str, cents: float) -> float:
        with self._db:
            self._db.execute(
                "INSERT INTO spend (tenant_id, period, cents) VALUES (?,?,?) "
                "ON CONFLICT(tenant_id, period) DO UPDATE SET cents = cents + excluded.cents",
                (self.tenant_id, period, cents))
        return self.spend(period)

    # -------------------------------------------------------------- threads
    def add_thread(self, label: str, ask: str, sql: str, rows: list,
                   checks: list, parent: int | None, repairs: int) -> int:
        with self._db:
            cur = self._db.execute(
                "INSERT INTO threads (tenant_id, label, ask, sql, parent, rows, checks, repairs, at)"
                " VALUES (?,?,?,?,?,?,?,?,?)",
                (self.tenant_id, label, ask, sql, parent, json.dumps(rows),
                 json.dumps(checks), repairs, now()))
        return cur.lastrowid

    def threads(self) -> list:
        return self._db.execute("SELECT * FROM threads WHERE tenant_id = ? ORDER BY id",
                                (self.tenant_id,)).fetchall()

    # ------------------------------------------------------- generated SQL
    def select(self, sql: str) -> list:
        """Run a generated read-only query, scoped to this tenant.

        The tenant predicate is added HERE. A model that forgets it, or is talked
        into omitting it, changes nothing: the query it wrote is wrapped in a
        subquery over a view that only ever contains this tenant's rows.
        """
        stripped = sql.strip().rstrip(";").strip()
        if not stripped.lower().startswith("select"):
            raise IsolationError("generated SQL must be a single SELECT")
        if ";" in stripped:
            raise IsolationError("generated SQL must be a single statement")
        if SQL_FORBIDDEN.search(stripped):
            raise IsolationError("generated SQL contains a forbidden keyword")

        used = set(re.findall(r"\bfrom\s+([a-z_][a-z0-9_]*)|\bjoin\s+([a-z_][a-z0-9_]*)",
                              stripped, re.I))
        names = {n for pair in used for n in pair if n}
        if not names <= ANALYTICS_TABLES:
            raise IsolationError(f"generated SQL touches tables outside the analytics surface: "
                                 f"{sorted(names - ANALYTICS_TABLES)}")

        # `tickets` becomes a CTE containing only our rows, so the model's query
        # is physically unable to see anyone else's — whatever it wrote. The base
        # table must be written as `main.tickets`: an unqualified reference makes
        # SQLite treat the CTE as self-referential and refuse the statement.
        scoped = "WITH tickets AS (SELECT * FROM main.tickets WHERE tenant_id = ?) " + stripped
        return self._db.execute(scoped, (self.tenant_id,)).fetchall()
