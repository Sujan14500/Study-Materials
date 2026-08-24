"""BM25 over one tenant's help centre. No dependencies, ~40 lines of real ranking.

Production would put pgvector or a hybrid retriever here. The interface is the
same and swapping it changes nothing above; what would NOT change is that the
index is built per tenant, so there is no shared vector space to leak across.
That is the design decision, not the algorithm.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

STOP = set("the a an and or of to in on at is are was were be been for with how do i my we you your "
           "can what when where which that this it".split())
K1, B = 1.5, 0.75


def stem(w: str) -> str:
    """The cheapest stemmer that fixes the failure that actually happens here:
    a customer asks about a "refund" and the article says "refunds". Without
    this, BM25 scores that pair at zero and the desk refuses a question it can
    answer. Porter would be better; this is two lines and closes 90% of the gap."""
    for suffix in ("ing", "ies", "es", "ed", "s"):
        if len(w) > len(suffix) + 2 and w.endswith(suffix):
            return w[: -len(suffix)] + ("y" if suffix == "ies" else "")
    return w


def tokens(text: str) -> list:
    return [stem(w) for w in re.findall(r"[a-z0-9']+", text.lower())
            if w not in STOP and len(w) > 1]


@dataclass
class Hit:
    doc_id: int
    title: str
    text: str            # what gets shown and cited: the paragraph alone
    score: float
    index_text: str = ""  # what got scored: title + paragraph


class Index:
    def __init__(self, rows) -> None:
        # rows: sqlite Rows from TenantDB.docs(). Chunked one paragraph per entry,
        # because a whole article is too coarse to cite and a sentence is too thin.
        self.chunks = []
        for r in rows:
            for para in [p.strip() for p in r["body"].split("\n\n") if p.strip()]:
                # The title is indexed with every paragraph. In a help centre the
                # title carries most of the topical signal ("Refund policy"), and a
                # customer's question echoes the title more often than the prose.
                indexed = r["title"] + "\n" + para
                self.chunks.append({"doc_id": r["id"], "title": r["title"], "text": para,
                                    "indexed": indexed, "tf": self._tf(indexed)})
        self.N = len(self.chunks)
        self.avgdl = (sum(sum(c["tf"].values()) for c in self.chunks) / self.N) if self.N else 0.0
        self.df = {}
        for c in self.chunks:
            for w in c["tf"]:
                self.df[w] = self.df.get(w, 0) + 1

    @staticmethod
    def _tf(text: str) -> dict:
        d = {}
        for w in tokens(text):
            d[w] = d.get(w, 0) + 1
        return d

    def search(self, query: str, k: int = 3) -> list:
        if not self.N:
            return []
        q = tokens(query)
        scored = []
        for c in self.chunks:
            dl = sum(c["tf"].values()) or 1
            s = 0.0
            for w in q:
                f = c["tf"].get(w, 0)
                if not f:
                    continue
                idf = math.log(1 + (self.N - self.df.get(w, 0) + 0.5) / (self.df.get(w, 0) + 0.5))
                s += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * dl / self.avgdl))
            if s > 0:
                scored.append(Hit(c["doc_id"], c["title"], c["text"], s, c["indexed"]))
        scored.sort(key=lambda h: h.score, reverse=True)
        return scored[:k]


def confidence(hits: list, query: str) -> float:
    """Turn retrieval into a 0..1 number a gate can act on.

    Two signals, because one is not enough. Measured on the golden sets, raw
    BM25 ranks "what is your VAT registration number?" (2.31, matching the word
    "number" in a shipping article) ABOVE a legitimate "how long do I have to
    return something?" (2.03). A single unbounded relevance score is not a
    confidence signal.

      strength  squashed BM25 — is anything here at all
      coverage  fraction of the question's content words the top chunk contains
                — did we match the question, or one incidental word

    Coverage is a weighting, not a multiplier: paraphrases ("return" vs
    "refunds") legitimately score low coverage and should land in the review
    queue, not be refused outright.

    The constants are fitted against the per-tenant golden sets, and refitting
    them is a normal part of changing the retriever. They are not folklore.
    """
    if not hits:
        return 0.0
    strength = 1 - math.exp(-hits[0].score / 4.0)
    q = set(tokens(query))
    cov = len(q & set(tokens(hits[0].index_text or hits[0].text))) / len(q) if q else 0.0
    return strength * (0.6 + 0.4 * cov)
