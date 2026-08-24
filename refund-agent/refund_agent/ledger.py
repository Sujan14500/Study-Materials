"""Durable state + audit trail. SQLite, because the run has to survive the process.

Three tables, three jobs:

  runs        one row per refund attempt, keyed by an idempotency key. This row
              is what makes a retry safe and what makes a paused run resumable
              after a restart.
  steps       every step attempt: do or undo, ok or failed. This is how you
              answer "what actually happened" six weeks later.
  audit       the human-readable narrative, including who approved what.

Nothing here is clever. Money systems should be boring.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  run_id           TEXT PRIMARY KEY,
  idempotency_key  TEXT NOT NULL UNIQUE,
  order_id         TEXT,
  state            TEXT NOT NULL,
  amount_cents     INTEGER NOT NULL DEFAULT 0,
  context          TEXT NOT NULL DEFAULT '{}',
  result           TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS steps (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id   TEXT NOT NULL,
  seq      INTEGER NOT NULL,
  name     TEXT NOT NULL,
  phase    TEXT NOT NULL,
  status   TEXT NOT NULL,
  detail   TEXT,
  at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id  TEXT NOT NULL,
  actor   TEXT NOT NULL,
  event   TEXT NOT NULL,
  detail  TEXT,
  at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS steps_run ON steps(run_id);
CREATE INDEX IF NOT EXISTS audit_run ON audit(run_id);
"""

TERMINAL = ("COMPLETED", "COMPENSATED", "BLOCKED", "FAILED")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def idempotency_key(channel: str, external_id: str) -> str:
    """One inbound customer request = one refund attempt. Forever.

    external_id is the upstream message/ticket/webhook id. The amount is
    deliberately NOT part of the key: if it were, a policy change between two
    deliveries of the same message would produce a different key and refund
    the customer twice. The message identity is the thing that must be unique,
    not our opinion about it.
    """
    raw = f"{channel}|{external_id}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class Ledger:
    def __init__(self, path: str = "refunds.db") -> None:
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.commit()

    # ---------- runs ----------
    def claim(self, key: str, order_id: str | None, amount_cents: int) -> tuple[str, bool]:
        """Reserve the idempotency key. Returns (run_id, is_new).

        The UNIQUE constraint is the lock. Two concurrent identical requests:
        one inserts, the other reads back the existing row. No double refund,
        no distributed lock, no lease to expire.
        """
        run_id = uuid.uuid4().hex
        try:
            with self.db:
                self.db.execute(
                    "INSERT INTO runs (run_id, idempotency_key, order_id, state, amount_cents,"
                    " context, result, created_at, updated_at)"
                    " VALUES (?,?,?,?,?,?,?,?,?)",
                    (run_id, key, order_id, "PENDING", amount_cents, "{}", None, now(), now()),
                )
            return run_id, True
        except sqlite3.IntegrityError:
            row = self.db.execute("SELECT run_id FROM runs WHERE idempotency_key = ?", (key,)).fetchone()
            return row["run_id"], False

    def get(self, run_id: str) -> sqlite3.Row | None:
        return self.db.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()

    def set_state(self, run_id: str, state: str, *, result: dict | None = None,
                  context: dict | None = None, amount_cents: int | None = None) -> None:
        sets, args = ["state = ?", "updated_at = ?"], [state, now()]
        if result is not None:
            sets.append("result = ?"); args.append(json.dumps(result))
        if context is not None:
            sets.append("context = ?"); args.append(json.dumps(context, default=str))
        if amount_cents is not None:
            sets.append("amount_cents = ?"); args.append(amount_cents)
        args.append(run_id)
        with self.db:
            self.db.execute(f"UPDATE runs SET {', '.join(sets)} WHERE run_id = ?", args)

    def release(self, run_id: str) -> None:
        """Give the idempotency key back.

        Used when nothing business-visible happened — an infrastructure failure
        before any side effect. The run stays in the table for the audit trail,
        but its key is retired so a redelivery of the same webhook is processed
        fresh instead of being suppressed as a replay of a run that did nothing.
        """
        with self.db:
            self.db.execute(
                "UPDATE runs SET state = 'RELEASED', idempotency_key = ?, updated_at = ?"
                " WHERE run_id = ?",
                (f"released:{run_id}", now(), run_id),
            )

    def context(self, run_id: str) -> dict:
        row = self.get(run_id)
        return json.loads(row["context"]) if row else {}

    def result(self, run_id: str) -> dict | None:
        row = self.get(run_id)
        return json.loads(row["result"]) if row and row["result"] else None

    def awaiting_approval(self) -> list:
        return self.db.execute(
            "SELECT * FROM runs WHERE state = 'AWAITING_APPROVAL' ORDER BY created_at"
        ).fetchall()

    # ---------- steps + audit ----------
    def step(self, run_id: str, seq: int, name: str, phase: str, status: str, detail: str = "") -> None:
        with self.db:
            self.db.execute(
                "INSERT INTO steps (run_id, seq, name, phase, status, detail, at) VALUES (?,?,?,?,?,?,?)",
                (run_id, seq, name, phase, status, detail[:500], now()),
            )

    def steps_of(self, run_id: str) -> list:
        return self.db.execute("SELECT * FROM steps WHERE run_id = ? ORDER BY id", (run_id,)).fetchall()

    def log(self, run_id: str, actor: str, event: str, detail: str = "") -> None:
        with self.db:
            self.db.execute(
                "INSERT INTO audit (run_id, actor, event, detail, at) VALUES (?,?,?,?,?)",
                (run_id, actor, event, detail[:1000], now()),
            )

    def audit_of(self, run_id: str) -> list:
        return self.db.execute("SELECT * FROM audit WHERE run_id = ? ORDER BY id", (run_id,)).fetchall()

    def close(self) -> None:
        self.db.close()
