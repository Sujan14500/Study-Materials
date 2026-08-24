"""Policy is pure code, so it gets the cheapest, strictest tests in the repo."""

import unittest
from datetime import date, timedelta

from refund_agent import policy


def order(**kw):
    base = {
        "order_id": "O-1001", "total_cents": 10_000, "refunded_cents": 0,
        "status": "delivered", "fraud_score": 0.0,
        "delivered_on": date.today() - timedelta(days=3), "sku": "SKU-1001",
    }
    base.update(kw)
    return base


class TestPolicy(unittest.TestCase):
    def test_missing_order_is_blocked(self):
        d = policy.decide(None, {"reason": "damaged"})
        self.assertFalse(d.allowed)
        self.assertIn("order_not_found", d.reasons)

    def test_customer_cannot_ask_for_more_than_remains(self):
        d = policy.decide(order(total_cents=5_000), {"reason": "damaged",
                                                     "requested_amount_cents": 999_999_00})
        self.assertTrue(d.allowed)
        self.assertEqual(d.amount_cents, 5_000)
        self.assertTrue(any(r.startswith("capped_to_remaining") for r in d.reasons))

    def test_partial_refund_leaves_the_remainder(self):
        d = policy.decide(order(refunded_cents=4_000), {"reason": "damaged"})
        self.assertEqual(d.amount_cents, 6_000)

    def test_fully_refunded_order_cannot_refund_again(self):
        d = policy.decide(order(refunded_cents=10_000), {"reason": "damaged"})
        self.assertFalse(d.allowed)
        self.assertIn("already_fully_refunded", d.reasons)

    def test_small_amounts_auto_approve_large_ones_do_not(self):
        small = policy.decide(order(total_cents=2_500), {"reason": "damaged"})
        large = policy.decide(order(total_cents=25_000), {"reason": "damaged"})
        self.assertFalse(small.requires_approval)
        self.assertTrue(large.requires_approval)

    def test_the_approval_boundary_is_exact(self):
        at_limit = policy.decide(order(total_cents=policy.AUTO_APPROVE_LIMIT_CENTS),
                                 {"reason": "damaged"})
        over = policy.decide(order(total_cents=policy.AUTO_APPROVE_LIMIT_CENTS + 1),
                             {"reason": "damaged"})
        self.assertFalse(at_limit.requires_approval)
        self.assertTrue(over.requires_approval)

    def test_return_window_expires(self):
        old = policy.decide(order(delivered_on=date.today() - timedelta(days=90)),
                            {"reason": "damaged"})
        self.assertFalse(old.allowed)

    def test_never_arrived_ignores_the_window(self):
        d = policy.decide(order(delivered_on=date.today() - timedelta(days=90)),
                          {"reason": "never_arrived"})
        self.assertTrue(d.allowed)

    def test_high_fraud_blocks_medium_fraud_asks_a_human(self):
        blocked = policy.decide(order(fraud_score=0.95), {"reason": "damaged"})
        review = policy.decide(order(total_cents=1_000, fraud_score=0.60), {"reason": "damaged"})
        self.assertFalse(blocked.allowed)
        self.assertTrue(review.allowed)
        self.assertTrue(review.requires_approval)   # cheap, but still a human's call

    def test_damaged_goods_are_not_restocked(self):
        self.assertFalse(policy.decide(order(), {"reason": "damaged"}).restock)
        self.assertTrue(policy.decide(order(), {"reason": "changed_mind"}).restock)

    def test_unknown_reason_falls_back_instead_of_crashing(self):
        d = policy.decide(order(), {"reason": "<script>alert(1)</script>"})
        self.assertTrue(d.allowed)
        self.assertIn("unknown_reason_defaulted", d.reasons)


if __name__ == "__main__":
    unittest.main()
