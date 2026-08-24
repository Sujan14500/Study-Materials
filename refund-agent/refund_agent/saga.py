"""The orchestrator. Five steps, each with an undo, and rules about which
failures roll back and which do not.

The design decisions worth defending in an interview:

  * Idempotency is claimed BEFORE any model call. A replayed webhook costs
    zero tokens and zero money — it reads the stored result and returns.
  * The idempotency key is (channel, external_id). Deliberately not the amount:
    if it included the amount, a policy change between two deliveries of the
    same message would look like a different request and refund twice.
  * Compensation runs in reverse, and only for steps before the money moves.
    Once the customer has their money back, a failure to restock inventory is
    a warning, not a reason to claw the refund back. That is a product
    decision, encoded as `best_effort` on the step.
  * If a compensation itself fails, the run ends FAILED with
    compensation_incomplete and stays visible for a human. Silent partial
    rollback is the worst possible outcome, so it is the one state we shout about.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from . import intake, policy
from .backend import Backend, PermanentError, TransientError
from .ledger import Ledger, idempotency_key

MAX_RETRIES = 2


@dataclass
class Step:
    name: str
    do: Callable[[dict], dict]
    undo: Callable[[dict], None] | None = None
    best_effort: bool = False   # failure here never rolls back the refund


class RefundAgent:
    def __init__(self, backend: Backend, ledger: Ledger, llm) -> None:
        self.backend = backend
        self.ledger = ledger
        self.llm = llm

    # ------------------------------------------------------------------ steps
    def _steps(self) -> list:
        b = self.backend
        return [
            Step("authorize_return",
                 lambda c: {"rma_id": b.create_rma(c["order_id"], c["run_id"])},
                 lambda c: b.cancel_rma(c["rma_id"]) if c.get("rma_id") else None),

            # --- everything above this line is reversible without touching money ---
            Step("issue_refund",
                 lambda c: {"payment_id": b.issue_refund(c["order_id"], c["amount_cents"], c["run_id"])},
                 lambda c: b.reverse_refund(c["order_id"], c["run_id"])),
            # --- everything below is best effort: the customer already has the money ---

            Step("restock_inventory",
                 lambda c: {"restocked": bool(c.get("restock")) and (b.restock(c["sku"]) or True)},
                 lambda c: b.unrestock(c["sku"]) if c.get("restocked") else None,
                 best_effort=True),

            Step("notify_customer",
                 lambda c: {"notified": b.notify(c["order_id"],
                            f"Refund of ${c['amount_cents'] / 100:.2f} issued.") or True},
                 None, best_effort=True),
        ]

    # ------------------------------------------------------------------ entry
    def handle(self, message: str, *, channel: str = "email", external_id: str,
               actor: str = "agent") -> dict:
        key = idempotency_key(channel, external_id)
        run_id, is_new = self.ledger.claim(key, None, 0)

        if not is_new:
            row = self.ledger.get(run_id)
            stored = self.ledger.result(run_id)
            self.ledger.log(run_id, actor, "replay_suppressed", f"state={row['state']}")
            if stored is not None:
                return dict(stored, replayed=True)
            return {"status": row["state"].lower(), "run_id": run_id, "replayed": True}

        self.ledger.log(run_id, actor, "received", f"{channel}:{external_id}")

        # Pre-flight: read the message, read the order, decide. Nothing here has
        # a side effect, so an infrastructure failure means "nothing happened" —
        # release the key and let the webhook be redelivered. An inbound message
        # must never be able to kill the worker.
        try:
            req = intake.parse(message, self.llm)
            if req.needs_human:
                return self._finish(run_id, "BLOCKED", {
                    "status": "needs_human", "run_id": run_id, "reasons": [req.note]})

            order = self._retry(lambda: self.backend.get_order(req.order_id))
            decision = policy.decide(order, req.as_policy_input())
        except Exception as e:                                  # noqa: BLE001
            self.ledger.log(run_id, "agent", "preflight_failed", repr(e))
            self.ledger.release(run_id)
            return {"status": "retry_later", "run_id": run_id, "error": repr(e)}

        self.ledger.log(run_id, "policy", "decided",
                        f"allowed={decision.allowed} amount={decision.amount_cents} "
                        f"approval={decision.requires_approval} reasons={','.join(decision.reasons)}")

        if not decision.allowed:
            return self._finish(run_id, "BLOCKED", {
                "status": "blocked", "run_id": run_id, "order_id": req.order_id,
                "amount_cents": 0, "reasons": list(decision.reasons)})

        ctx = {
            "run_id": run_id, "order_id": req.order_id, "amount_cents": decision.amount_cents,
            "restock": decision.restock, "sku": order["sku"], "reasons": list(decision.reasons),
        }
        self.ledger.set_state(run_id, "PENDING", context=ctx, amount_cents=decision.amount_cents)
        self.ledger.db.execute("UPDATE runs SET order_id = ? WHERE run_id = ?", (req.order_id, run_id))
        self.ledger.db.commit()

        if decision.requires_approval:
            self.ledger.set_state(run_id, "AWAITING_APPROVAL")
            self.ledger.log(run_id, "policy", "held_for_approval",
                            f"${decision.amount_cents / 100:.2f}")
            return {"status": "awaiting_approval", "run_id": run_id, "order_id": req.order_id,
                    "amount_cents": decision.amount_cents, "reasons": list(decision.reasons)}

        return self._execute(run_id, ctx)

    def approve(self, run_id: str, approved_by: str) -> dict:
        """Resumes a held run. Works in a brand new process — state is in SQLite."""
        row = self.ledger.get(run_id)
        if row is None:
            return {"status": "unknown_run", "run_id": run_id}
        if row["state"] != "AWAITING_APPROVAL":
            stored = self.ledger.result(run_id)
            return stored or {"status": row["state"].lower(), "run_id": run_id}

        self.ledger.log(run_id, approved_by, "approved", f"${row['amount_cents'] / 100:.2f}")
        return self._execute(run_id, self.ledger.context(run_id))

    def reject(self, run_id: str, rejected_by: str, note: str = "") -> dict:
        self.ledger.log(run_id, rejected_by, "rejected", note)
        return self._finish(run_id, "BLOCKED", {
            "status": "rejected", "run_id": run_id, "reasons": ["human_rejected"]})

    # -------------------------------------------------------------- execution
    def _execute(self, run_id: str, ctx: dict) -> dict:
        self.ledger.set_state(run_id, "RUNNING", context=ctx)
        done: list = []
        warnings: list = []

        for seq, step in enumerate(self._steps()):
            try:
                ctx.update(self._attempt(run_id, seq, step, ctx) or {})
                self.ledger.step(run_id, seq, step.name, "do", "ok")
                done.append((seq, step))
                self.ledger.set_state(run_id, "RUNNING", context=ctx)
            except Exception as e:                              # noqa: BLE001 - recorded, not swallowed
                self.ledger.step(run_id, seq, step.name, "do", "failed", repr(e))
                if step.best_effort:
                    warnings.append(f"{step.name}: {e}")
                    self.ledger.log(run_id, "agent", "best_effort_failed", f"{step.name}: {e}")
                    continue
                return self._compensate(run_id, ctx, done, failed=step.name, error=e)

        return self._finish(run_id, "COMPLETED", {
            "status": "refunded", "run_id": run_id, "order_id": ctx["order_id"],
            "amount_cents": ctx["amount_cents"], "payment_id": ctx.get("payment_id"),
            "reasons": ctx.get("reasons", []), "warnings": warnings})

    @staticmethod
    def _retry(fn):
        """Retry a read. Reads are safe to repeat; writes go through _attempt."""
        last = None
        for _ in range(MAX_RETRIES + 1):
            try:
                return fn()
            except TransientError as e:
                last = e
        raise last

    def _attempt(self, run_id: str, seq: int, step: Step, ctx: dict) -> dict:
        last: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 2):
            try:
                return step.do(ctx)
            except TransientError as e:
                last = e
                self.ledger.step(run_id, seq, step.name, "do", "retry", f"attempt {attempt}: {e}")
            except PermanentError:
                raise
        raise last  # type: ignore[misc]

    def _compensate(self, run_id: str, ctx: dict, done: list, *, failed: str, error: Exception) -> dict:
        self.ledger.set_state(run_id, "COMPENSATING", context=ctx)
        self.ledger.log(run_id, "agent", "compensating", f"{failed} failed: {error}")
        incomplete = []

        for seq, step in reversed(done):
            if step.undo is None:
                continue
            try:
                step.undo(ctx)
                self.ledger.step(run_id, seq, step.name, "undo", "ok")
            except Exception as e:                              # noqa: BLE001
                incomplete.append(step.name)
                self.ledger.step(run_id, seq, step.name, "undo", "failed", repr(e))

        if incomplete:
            # The one state a human must look at. Never fails silently.
            self.ledger.log(run_id, "agent", "compensation_incomplete", ",".join(incomplete))
            return self._finish(run_id, "FAILED", {
                "status": "compensation_incomplete", "run_id": run_id,
                "order_id": ctx.get("order_id"), "amount_cents": 0,
                "failed_step": failed, "unrolled": incomplete})

        return self._finish(run_id, "COMPENSATED", {
            "status": "compensated", "run_id": run_id, "order_id": ctx.get("order_id"),
            "amount_cents": 0, "failed_step": failed, "reasons": [f"rolled_back_after_{failed}"]})

    def _finish(self, run_id: str, state: str, result: dict) -> dict:
        self.ledger.set_state(run_id, state, result=result)
        self.ledger.log(run_id, "agent", "finished", state)
        return result
