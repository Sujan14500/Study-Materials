"""Idempotency, compensation, approval durability. The three things that decide
whether an LLM is allowed near a payments API."""

import tempfile
import unittest
from pathlib import Path

from refund_agent import Backend, FaultPlan, Ledger, RefundAgent
from refund_agent.backend import PermanentError, TransientError
from refund_agent.llm import StubLLM


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / "t.db")
        self.faults = FaultPlan()
        self.backend = Backend(self.faults)
        self.ledger = Ledger(self.db)
        self.agent = RefundAgent(self.backend, self.ledger, StubLLM())

    def tearDown(self):
        self.ledger.close()
        self.tmp.cleanup()

    def new_ledger(self):
        """A fresh Ledger over the same file — stands in for a process restart."""
        self.ledger.close()
        self.ledger = Ledger(self.db)
        self.agent = RefundAgent(self.backend, self.ledger, StubLLM())
        return self.ledger


class TestIdempotency(Base):
    def test_the_same_message_delivered_twice_refunds_once(self):
        self.backend.seed("O-1001", 3_000)
        msg = "My order O-1001 arrived damaged, please refund."

        first = self.agent.handle(msg, external_id="tkt-1")
        second = self.agent.handle(msg, external_id="tkt-1")

        self.assertEqual(first["status"], "refunded")
        self.assertTrue(second["replayed"])
        self.assertEqual(second["run_id"], first["run_id"])
        self.assertEqual(self.backend.refunded_total("O-1001"), 3_000)

    def test_replay_costs_zero_model_calls(self):
        self.backend.seed("O-1002", 2_000)
        llm = StubLLM()
        agent = RefundAgent(self.backend, self.ledger, llm)
        msg = "refund O-1002 it was damaged"

        agent.handle(msg, external_id="tkt-2")
        after_first = llm.usage.calls
        agent.handle(msg, external_id="tkt-2")

        self.assertGreater(after_first, 0)
        self.assertEqual(llm.usage.calls, after_first)   # the replay never reached a model

    def test_a_second_genuine_ticket_finds_nothing_left_to_refund(self):
        self.backend.seed("O-1003", 4_000)          # under the auto-approve limit
        a = self.agent.handle("refund O-1003 damaged", external_id="tkt-a")
        b = self.agent.handle("refund O-1003 damaged", external_id="tkt-b")

        self.assertNotEqual(a["run_id"], b["run_id"])   # different tickets, different runs
        self.assertEqual(a["status"], "refunded")
        self.assertEqual(b["status"], "blocked")        # ...but the money only leaves once
        self.assertIn("already_fully_refunded", b["reasons"])
        self.assertEqual(self.backend.refunded_total("O-1003"), 4_000)

    def test_ten_concurrent_deliveries_of_one_webhook(self):
        import threading
        self.backend.seed("O-1004", 4_000)
        results = []
        barrier = threading.Barrier(10)

        def fire():
            ledger = Ledger(self.db)
            try:
                agent = RefundAgent(self.backend, ledger, StubLLM())
                barrier.wait()
                results.append(agent.handle("refund O-1004 damaged", external_id="hook-1"))
            finally:
                ledger.close()

        threads = [threading.Thread(target=fire) for _ in range(10)]
        [t.start() for t in threads]
        [t.join() for t in threads]

        self.assertEqual(len(results), 10)
        self.assertEqual(self.backend.refunded_total("O-1004"), 4_000)  # once, not ten times
        self.assertEqual(len({r["run_id"] for r in results}), 1)        # all ten saw one run


class TestCompensation(Base):
    def test_failure_before_the_money_rolls_everything_back(self):
        self.backend.seed("O-2001", 3_000)
        self.faults.fail_steps["issue_refund"] = PermanentError

        out = self.agent.handle("refund O-2001, damaged", external_id="tkt-c1")

        self.assertEqual(out["status"], "compensated")
        self.assertEqual(self.backend.refunded_total("O-2001"), 0)
        self.assertEqual(self.backend.rmas, {})              # the RMA was cancelled
        names = [(s["name"], s["phase"], s["status"]) for s in self.ledger.steps_of(out["run_id"])]
        self.assertIn(("authorize_return", "undo", "ok"), names)

    def test_failure_after_the_money_does_not_claw_it_back(self):
        self.backend.seed("O-2002", 3_000)
        self.faults.fail_steps["notify_customer"] = TransientError

        out = self.agent.handle("refund O-2002, damaged", external_id="tkt-c2")

        self.assertEqual(out["status"], "refunded")          # customer keeps the money
        self.assertEqual(self.backend.refunded_total("O-2002"), 3_000)
        self.assertTrue(out["warnings"])                     # and we said so, loudly

    def test_transient_failures_are_retried_not_rolled_back(self):
        self.backend.seed("O-2003", 3_000)
        calls = {"n": 0}
        real = self.backend.create_rma

        def flaky(order_id, run_id):
            calls["n"] += 1
            if calls["n"] < 2:
                raise TransientError("downstream hiccup")
            return real(order_id, run_id)

        self.backend.create_rma = flaky
        out = self.agent.handle("refund O-2003, damaged", external_id="tkt-c3")

        self.assertEqual(out["status"], "refunded")
        self.assertEqual(calls["n"], 2)

    def test_a_failed_compensation_is_never_silent(self):
        self.backend.seed("O-2004", 3_000)
        self.faults.fail_steps["issue_refund"] = PermanentError
        self.backend.cancel_rma = lambda rma: (_ for _ in ()).throw(RuntimeError("rma service down"))

        out = self.agent.handle("refund O-2004, damaged", external_id="tkt-c4")

        self.assertEqual(out["status"], "compensation_incomplete")
        self.assertIn("authorize_return", out["unrolled"])
        events = [a["event"] for a in self.ledger.audit_of(out["run_id"])]
        self.assertIn("compensation_incomplete", events)


class TestApproval(Base):
    def test_large_refunds_wait_for_a_human(self):
        self.backend.seed("O-3001", 25_000)
        out = self.agent.handle("refund O-3001, damaged", external_id="tkt-h1")

        self.assertEqual(out["status"], "awaiting_approval")
        self.assertEqual(self.backend.refunded_total("O-3001"), 0)   # nothing moved yet

    def test_a_held_run_survives_a_process_restart(self):
        self.backend.seed("O-3002", 25_000)
        held = self.agent.handle("refund O-3002, damaged", external_id="tkt-h2")

        self.new_ledger()                                    # "the pod was rescheduled"

        pending = self.ledger.awaiting_approval()
        self.assertEqual([r["run_id"] for r in pending], [held["run_id"]])

        out = self.agent.approve(held["run_id"], approved_by="ops@acme.com")
        self.assertEqual(out["status"], "refunded")
        self.assertEqual(self.backend.refunded_total("O-3002"), 25_000)

    def test_approving_twice_does_not_pay_twice(self):
        self.backend.seed("O-3003", 25_000)
        held = self.agent.handle("refund O-3003, damaged", external_id="tkt-h3")
        self.agent.approve(held["run_id"], "ops@acme.com")
        again = self.agent.approve(held["run_id"], "ops@acme.com")

        self.assertEqual(again["status"], "refunded")
        self.assertEqual(self.backend.refunded_total("O-3003"), 25_000)

    def test_rejection_moves_no_money_and_names_the_human(self):
        self.backend.seed("O-3004", 25_000)
        held = self.agent.handle("refund O-3004, damaged", external_id="tkt-h4")
        out = self.agent.reject(held["run_id"], "ops@acme.com", "customer already refunded offline")

        self.assertEqual(out["status"], "rejected")
        self.assertEqual(self.backend.refunded_total("O-3004"), 0)
        actors = [a["actor"] for a in self.ledger.audit_of(held["run_id"])]
        self.assertIn("ops@acme.com", actors)


class TestAudit(Base):
    def test_every_run_leaves_a_readable_trail(self):
        self.backend.seed("O-4001", 3_000)
        out = self.agent.handle("refund O-4001, damaged", external_id="tkt-a1")
        events = [a["event"] for a in self.ledger.audit_of(out["run_id"])]

        self.assertEqual(events[0], "received")
        self.assertIn("decided", events)
        self.assertEqual(events[-1], "finished")


if __name__ == "__main__":
    unittest.main()
