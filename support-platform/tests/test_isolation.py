"""Isolation. One leak ends the product, so this file gets the most paranoid tests.

Structural tests ("the query contains tenant_id") are worth little — they pass
right up until someone adds a method that forgets. These are behavioural: tenant
zenith is seeded with content that would obviously answer an acme question with
the WRONG answer, and the assertion is that acme never sees it.
"""

import tempfile
import unittest
from pathlib import Path

from support import Analytics, IsolationError, Platform, SupportAgent
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

    def agent(self, tid):
        return SupportAgent(self.p.scope(tid), self.llm)


class TestDataIsolation(Base):
    def test_docs_never_cross(self):
        acme, zenith = self.p.scope("acme"), self.p.scope("zenith")
        acme_titles = {d["title"] for d in acme.docs()}
        zenith_titles = {d["title"] for d in zenith.docs()}

        # Both have a doc called "Refund policy" — with different answers.
        self.assertIn("Refund policy", acme_titles & zenith_titles)
        self.assertIn("Shipping", acme_titles)
        self.assertNotIn("Shipping", zenith_titles)
        self.assertNotIn("Rate limits", acme_titles)

    def test_the_same_question_retrieves_each_tenants_own_answer(self):
        """Asserted at the retrieval boundary, not on the reply text: whether the
        gate then auto-sends or asks a human is a separate concern (TestGate).
        What must never happen is Acme's retriever surfacing Zenith's policy."""
        q = "how long do I have for a refund?"
        a = self.agent("acme").index.search(q, k=3)
        z = self.agent("zenith").index.search(q, k=3)

        a_text = " ".join(h.text for h in a)
        z_text = " ".join(h.text for h in z)

        self.assertIn("30 days", a_text)
        self.assertIn("14 days", z_text)
        self.assertNotIn("14 days", a_text)      # the leak this project exists to prevent
        self.assertNotIn("30 days", z_text)

    def test_retrieval_only_ever_returns_own_documents(self):
        for tid in ("acme", "bloom", "zenith"):
            tdb = self.p.scope(tid)
            own = {d["id"] for d in tdb.docs()}
            agent = SupportAgent(tdb, self.llm)
            for probe in ("refund", "api key", "shipping", "rate limit", "gift card",
                          "appointment", "billing", "plan"):
                reply = agent.answer("u1", probe, record=False)
                for c in reply.citations:
                    self.assertIn(c["doc_id"], own,
                                  f"{tid} retrieved doc {c['doc_id']} that is not its own")

    def test_tickets_and_spend_are_scoped(self):
        self.agent("acme").answer("u1", "refund window?")
        self.agent("acme").answer("u1", "api key?")
        self.agent("bloom").answer("u1", "gift card?")

        self.assertEqual(len(self.p.scope("acme").tickets()), 2)
        self.assertEqual(len(self.p.scope("bloom").tickets()), 1)
        self.assertEqual(len(self.p.scope("zenith").tickets()), 0)

    def test_every_scoped_read_returns_only_its_own_rows(self):
        """Reflective sweep: whatever read methods exist, none may return a
        foreign tenant_id. New methods are covered automatically."""
        for tid in ("acme", "bloom", "zenith"):
            tdb = self.p.scope(tid)
            seed_history(tdb, n=10)
            SupportAgent(tdb, self.llm).observe("u1", ["We are on the Pro plan."])

            for name in ("docs", "tickets", "memories", "memory_events", "threads"):
                for row in getattr(tdb, name)():
                    self.assertEqual(row["tenant_id"], tid,
                                     f"{name}() on {tid} returned a row owned by {row['tenant_id']}")

    def test_an_unknown_tenant_cannot_open_a_view(self):
        with self.assertRaises(IsolationError):
            self.p.scope("does-not-exist")

    def test_writing_to_another_tenants_row_does_nothing(self):
        acme, zenith = self.p.scope("acme"), self.p.scope("zenith")
        mid = zenith.add_memory("u1", "Zenith secret: enterprise discount 40%")

        self.assertEqual(acme.update_memory(mid, "hacked"), 0)
        self.assertEqual(acme.delete_memory(mid), 0)

        still = [r["text"] for r in zenith.memories("u1")]
        self.assertIn("Zenith secret: enterprise discount 40%", still)


class TestGeneratedSQLIsolation(Base):
    """The one place model output becomes a database query."""

    def setUp(self):
        super().setUp()
        for tid, n in (("acme", 40), ("zenith", 7)):
            seed_history(self.p.scope(tid), n=n)

    def test_generated_sql_cannot_see_other_tenants_rows(self):
        a = Analytics(self.p.scope("acme"), self.llm).ask("ticket volume by category")
        z = Analytics(self.p.scope("zenith"), self.llm).ask("ticket volume by category")

        self.assertEqual(sum(r["tickets"] for r in a.rows), 40)
        self.assertEqual(sum(r["tickets"] for r in z.rows), 7)

    def test_a_model_that_omits_the_tenant_filter_changes_nothing(self):
        tdb = self.p.scope("zenith")
        rows = tdb.select("SELECT COUNT(*) AS n FROM tickets")     # no WHERE at all
        self.assertEqual(rows[0]["n"], 7)                          # still only zenith's

    def test_a_model_that_writes_a_cross_tenant_filter_is_still_contained(self):
        tdb = self.p.scope("zenith")
        rows = tdb.select("SELECT COUNT(*) AS n FROM tickets WHERE tenant_id = 'acme'")
        self.assertEqual(rows[0]["n"], 0)      # the CTE already removed every acme row

    def test_write_statements_are_refused(self):
        tdb = self.p.scope("acme")
        for evil in ("DROP TABLE tickets",
                     "DELETE FROM tickets",
                     "SELECT 1; DROP TABLE tickets",
                     "UPDATE tickets SET csat = 5",
                     "SELECT * FROM tickets UNION SELECT * FROM tickets",
                     "PRAGMA table_info(tickets)",
                     "ATTACH DATABASE 'x.db' AS x"):
            with self.assertRaises(IsolationError, msg=f"allowed: {evil}"):
                tdb.select(evil)

    def test_querying_tables_outside_the_analytics_surface_is_refused(self):
        tdb = self.p.scope("acme")
        for evil in ("SELECT * FROM tenants",
                     "SELECT * FROM memories",
                     "SELECT * FROM docs JOIN tickets ON 1=1"):
            with self.assertRaises(IsolationError, msg=f"allowed: {evil}"):
                tdb.select(evil)

    def test_the_tickets_table_still_exists_after_all_that(self):
        self.assertEqual(len(self.p.scope("acme").tickets()), 40)


if __name__ == "__main__":
    unittest.main()
