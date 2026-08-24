"""Stand-in downstream systems: orders, payments, inventory, notifications.

Two things make this more than a mock:

  * every service can be told to fail, on demand or randomly, which is how the
    chaos suite proves the saga's compensation logic actually runs;
  * the payment gateway keeps its own books. The invariant "no order is ever
    refunded more than its total" is checked against the gateway's ledger, not
    against our own state, because checking your own homework proves nothing.
"""

from __future__ import annotations

import random
import threading
from dataclasses import dataclass, field
from datetime import date, timedelta


class TransientError(RuntimeError):
    """Downstream said try again. Retryable."""


class PermanentError(RuntimeError):
    """Downstream said no. Not retryable."""


@dataclass
class FaultPlan:
    """Which step names should blow up, and how."""

    fail_steps: dict = field(default_factory=dict)      # {"issue_refund": TransientError}
    random_rate: float = 0.0
    rng: random.Random = field(default_factory=random.Random)

    def maybe_fail(self, step: str) -> None:
        exc = self.fail_steps.get(step)
        if exc is not None:
            raise exc(f"injected fault in {step}")
        if self.random_rate and self.rng.random() < self.random_rate:
            raise (TransientError if self.rng.random() < 0.7 else PermanentError)(
                f"random fault in {step}"
            )


class Backend:
    def __init__(self, fault_plan: FaultPlan | None = None) -> None:
        self.faults = fault_plan or FaultPlan()
        self._lock = threading.Lock()
        self.orders: dict[str, dict] = {}
        # Gateway books: order_id -> [(run_id, cents)] for settled refunds only.
        self.gateway_refunds: dict[str, list] = {}
        self.rmas: dict[str, str] = {}
        self.restocked: dict[str, int] = {}
        self.notifications: list = []

    # ---------- seeding ----------
    def seed(self, order_id: str, total_cents: int, *, delivered_days_ago: int = 3,
             fraud_score: float = 0.0, status: str = "delivered") -> dict:
        o = {
            "order_id": order_id,
            "total_cents": total_cents,
            "refunded_cents": 0,
            "status": status,
            "fraud_score": fraud_score,
            "delivered_on": date.today() - timedelta(days=delivered_days_ago) if delivered_days_ago is not None else None,
            "sku": "SKU-" + order_id.split("-")[-1],
        }
        self.orders[order_id] = o
        return o

    def get_order(self, order_id: str | None) -> dict | None:
        self.faults.maybe_fail("get_order")
        o = self.orders.get(order_id or "")
        return dict(o) if o else None

    # ---------- returns ----------
    def create_rma(self, order_id: str, run_id: str) -> str:
        self.faults.maybe_fail("authorize_return")
        rma = f"RMA-{run_id[:8]}"
        self.rmas[rma] = order_id
        return rma

    def cancel_rma(self, rma_id: str) -> None:
        self.rmas.pop(rma_id, None)

    # ---------- money ----------
    def issue_refund(self, order_id: str, cents: int, run_id: str) -> str:
        """The only call in this codebase that moves money."""
        self.faults.maybe_fail("issue_refund")
        with self._lock:
            book = self.gateway_refunds.setdefault(order_id, [])
            # A real gateway rejects over-refunds. Ours does too, so a bug in our
            # policy layer shows up as a failure instead of as missing money.
            settled = sum(c for _, c in book)
            if settled + cents > self.orders[order_id]["total_cents"]:
                raise PermanentError(
                    f"gateway rejected: {settled + cents} exceeds order total "
                    f"{self.orders[order_id]['total_cents']}"
                )
            book.append((run_id, cents))
            self.orders[order_id]["refunded_cents"] = settled + cents
        return f"PAY-{run_id[:8]}"

    def reverse_refund(self, order_id: str, run_id: str) -> None:
        """Compensation. Pulls the money back out of the gateway's books."""
        with self._lock:
            book = self.gateway_refunds.get(order_id, [])
            keep = [(r, c) for r, c in book if r != run_id]
            self.gateway_refunds[order_id] = keep
            self.orders[order_id]["refunded_cents"] = sum(c for _, c in keep)

    def refunded_total(self, order_id: str) -> int:
        return sum(c for _, c in self.gateway_refunds.get(order_id, []))

    # ---------- inventory / comms (best effort) ----------
    def restock(self, sku: str, qty: int = 1) -> None:
        self.faults.maybe_fail("restock_inventory")
        self.restocked[sku] = self.restocked.get(sku, 0) + qty

    def unrestock(self, sku: str, qty: int = 1) -> None:
        self.restocked[sku] = max(0, self.restocked.get(sku, 0) - qty)

    def notify(self, order_id: str, text: str) -> None:
        self.faults.maybe_fail("notify_customer")
        self.notifications.append((order_id, text))
