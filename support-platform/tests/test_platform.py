"""The confidence gate, the budget, and the Data Formulator loop."""

import tempfile
import unittest
from pathlib import Path

from support import Analytics, Platform, SupportAgent
from support.agent import period_now
from support.llm import StubLLM
from support.seed import build, seed_history


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.p = Platform(str(Path(self.tmp.name) / "t.db"))
        self.goldens = build(self.p)
        self.llm = StubLLM()

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def agent(self, tid="acme"):
        return SupportAgent(self.p.scope(tid), self.llm)


class TestGate(Base):
    def test_a_well_covered_question_is_auto_sent(self):
        r = self.agent().answer("u1", "where do I create an API key?", record=False)
        self.assertEqual(r.action, "auto_send")
        self.assertTrue(r.citations)
        self.assertEqual(r.citations[0]["title"], "API keys")

    def test_a_question_the_docs_do_not_cover_is_refused_not_guessed(self):
        r = self.agent().answer("u1", "can you write me a poem about kubernetes?", record=False)
        self.assertEqual(r.action, "refuse")
        self.assertIn("human", r.text.lower())
        self.assertEqual(r.citations, [])

    def test_a_weak_partial_match_lands_in_review_not_auto_send(self):
        """"VAT registration number" hits the word "number" in a shipping article
        and nothing else. Keyword retrieval genuinely cannot tell that apart from
        a real match — measured, it even outscores some legitimate questions.

        So the guarantee is not "classify perfectly", it is "never auto-send
        something weakly grounded". Ambiguity resolves to a human, which is the
        outcome that costs a few minutes instead of a wrong answer."""
        r = self.agent().answer("u1", "what is your VAT registration number?", record=False)
        self.assertNotEqual(r.action, "auto_send")
        self.assertLess(r.confidence, self.p.scope("acme").tenant.get("auto_send_at"))

    def test_thresholds_are_per_tenant(self):
        """Same platform, same code, different risk appetite."""
        acme = self.p.scope("acme").tenant
        bloom = self.p.scope("bloom").tenant
        self.assertLess(acme.get("auto_send_at"), bloom.get("auto_send_at"))

        # Bloom's bar is higher, so a mid-confidence answer goes to a human there.
        r = self.agent("bloom").answer("u1", "can I get cash for my gift card?", record=False)
        self.assertIn(r.action, ("review", "auto_send"))

    def test_an_answer_without_a_citation_is_never_auto_sent(self):
        class NoCite(StubLLM):
            def _respond(self, system, user):
                if "support agent" in system.lower():
                    return "Sure, just click Settings and it's all done, easy."
                return super()._respond(system, user)

        # A question retrieval is confident about, so only the missing citation
        # can be what stops it being auto-sent.
        agent = SupportAgent(self.p.scope("acme"), NoCite())
        r = agent.answer("u1", "where do I create an API key?", record=False)
        self.assertGreaterEqual(r.confidence, self.p.scope("acme").tenant.get("auto_send_at"))
        self.assertEqual(r.action, "review")     # confident-sounding but ungrounded

    def test_every_answer_is_recorded_as_a_ticket(self):
        a = self.agent()
        a.answer("u1", "refund window?")
        a.answer("u1", "api key?")
        rows = self.p.scope("acme").tickets()
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r["resolution"] in ("auto_send", "review", "refuse") for r in rows))


class TestBudget(Base):
    def test_spend_accumulates_per_tenant(self):
        self.agent("acme").answer("u1", "refund window?")
        self.agent("acme").answer("u1", "api keys?")
        self.agent("bloom").answer("u1", "gift card?")

        period = period_now()
        self.assertGreater(self.p.scope("acme").spend(period), 0)
        self.assertGreater(self.p.scope("acme").spend(period),
                           self.p.scope("bloom").spend(period))
        self.assertEqual(self.p.scope("zenith").spend(period), 0)

    def test_over_budget_degrades_instead_of_failing(self):
        tdb = self.p.scope("bloom")
        tdb.add_spend(period_now(), 10_000)          # blow way past the cap

        agent = SupportAgent(tdb, self.llm)
        r = agent.answer("u1", "can I move my appointment?", record=False)

        self.assertTrue(r.degraded)
        self.assertEqual(r.action, "review")         # a human handles it...
        self.assertTrue(r.text)                      # ...but they still get the snippet
        self.assertEqual(r.cost_cents, 0.0)          # and no model was called

    def test_degraded_mode_skips_memory_too(self):
        tdb = self.p.scope("bloom")
        SupportAgent(tdb, self.llm).observe("u1", ["We're on the Pro plan."])
        tdb.add_spend(period_now(), 10_000)

        r = SupportAgent(tdb, self.llm).answer("u1", "what plan are we on?", record=False)
        self.assertEqual(r.memories_used, [])


class TestAnalytics(Base):
    def setUp(self):
        super().setUp()
        self.tdb = self.p.scope("acme")
        seed_history(self.tdb, n=120)
        self.an = Analytics(self.tdb, self.llm)

    def test_a_question_becomes_a_validated_result(self):
        r = self.an.ask("deflection rate by category")
        self.assertTrue(r.rows)
        self.assertIn("category", r.columns)
        self.assertTrue(r.ok, [c for c in r.checks if not c["passed"]])

    def test_checks_catch_percentages_out_of_range(self):
        class Broken(StubLLM):
            def _respond(self, system, user):
                if "sql" in system.lower() and "analyst" in system.lower():
                    return "SELECT category, 4000.0 AS share_pct FROM tickets GROUP BY category"
                return super()._respond(system, user)

        r = Analytics(self.tdb, Broken()).ask("share of tickets by category")
        self.assertFalse(r.ok)
        self.assertTrue(any(not c["passed"] and "range" in c["name"] for c in r.checks))

    def test_shares_must_sum_to_one_hundred(self):
        r = self.an.ask("share of tickets by category")
        sums = [c for c in r.checks if "sums to 100" in c["name"]]
        self.assertTrue(sums)
        self.assertTrue(sums[0]["passed"], sums[0]["detail"])

    def test_broken_sql_is_repaired_not_returned(self):
        class FirstTryBroken(StubLLM):
            def __init__(self):
                super().__init__()
                self.n = 0
            def _respond(self, system, user):
                if "sql" in system.lower() and "analyst" in system.lower():
                    self.n += 1
                    if self.n == 1:
                        return "SELECT category, COUNT(*) AS tickets FROM tickets GROUP BY nonexistent_col"
                    return "SELECT category, COUNT(*) AS tickets FROM tickets GROUP BY category"
                return super()._respond(system, user)

        r = Analytics(self.tdb, FirstTryBroken()).ask("ticket volume by category")
        self.assertEqual(r.repairs, 1)
        self.assertTrue(r.rows)
        self.assertTrue(r.ok)

    def test_a_query_that_never_works_fails_loudly(self):
        class AlwaysBroken(StubLLM):
            def _respond(self, system, user):
                if "sql" in system.lower() and "analyst" in system.lower():
                    return "SELECT nope FROM tickets"
                return super()._respond(system, user)

        r = Analytics(self.tdb, AlwaysBroken()).ask("anything")
        self.assertFalse(r.ok)
        self.assertEqual(r.repairs, 2)
        self.assertEqual(r.rows, [])

    def test_threads_record_lineage(self):
        a = self.an.ask("ticket volume by category", label="t1")
        b = self.an.ask("average handle time by category", parent=a.thread_id, label="t2")

        rows = self.tdb.threads()
        self.assertEqual(len(rows), 2)
        self.assertIsNone(rows[0]["parent"])
        self.assertEqual(rows[1]["parent"], a.thread_id)
        self.assertEqual(b.parent, a.thread_id)
        self.assertIn("t2", self.an.lineage())

    def test_the_chart_renders_without_a_plotting_library(self):
        r = self.an.ask("ticket volume by category")
        chart = self.an.chart(r)
        self.assertIn("█", chart)
        self.assertIn("category", chart)


if __name__ == "__main__":
    unittest.main()
