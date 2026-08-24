# Support Platform

A support desk sold to many businesses at once. Not one bot — a platform, where
the interesting problems only exist because there is more than one customer.

## The constraint

> **Tenant A must never, by any path, see tenant B's data — and every tenant is
> judged on their own accuracy, not the fleet average.**

Both halves matter. One leak ends the product. And a fleet average of 94% is
meaningless to the tenant sitting at 83%: they do not care about your mean, they
care about their own inbox, and they are the one who churns.

So: isolation is structural rather than remembered, and the eval gate fails on
the **worst** tenant.

## Run it

Zero dependencies. Python 3.10+, standard library only.

```bash
python demo.py                                   # 6-scene walkthrough
python -m unittest discover -s tests -t .        # 43 tests
python evalgate.py                               # the CI gate, exits non-zero on SLA breach
```

Models are **local via Ollama** — free, private, no API key:

```bash
python demo.py      --llm ollama
python evalgate.py  --llm ollama
```

Tests and evals default to a deterministic stub model. An eval suite that calls
a nondeterministic model cannot tell you whether your change helped.

## Measured results

`python evalgate.py` — three tenants, their own golden sets, their own SLAs:

```
  tenant          n     acc    auto  bad auto  missed ref     SLA  status
  Bloom Studio    6    83%     0%         0           0    70%  ok
  Acme Tools      9   100%    22%         0           0    80%  ok
  Zenith Cloud    7   100%    43%         0           0    80%  ok

  worst tenant: Bloom Studio at 83% — this is the number the SLA is written against
    [Bloom Studio] 'what happens if I cancel last minute?' cited nothing,
                   expected 'Booking changes'

  22 cases · notional inference cost 0.384¢ (0.0174¢ per case) · actual $0.00
```

The fleet average is 94%. The number that matters is 83%, and the report names
the exact question that caused it — Bloom's help centre says "inside 24 hours a
50% fee applies" and never uses the word "cancel". That is a **content** gap, not
a model gap, and no amount of prompt tuning fixes it. Per-tenant evals are how
you find that out instead of shipping a fleet-wide prompt change that does
nothing.

`bad auto` is the column to watch: an answer that was both wrong **and** sent to a
customer without review. It is zero, and the gate fails the build if it ever is not.

## How isolation holds

There is no public method anywhere that takes raw SQL from a caller, and no way
to obtain an unscoped handle:

```python
platform.scope("acme")     # -> TenantDB, or IsolationError for an unknown tenant
```

Every method on `TenantDB` injects `tenant_id` itself. The caller cannot omit it,
misspell it, or interpolate it.

**Tests are behavioural, not structural.** "The query string contains tenant_id"
passes right up until someone adds a method that forgets. Instead, `zenith` is
seeded with a help centre that deliberately collides with `acme`'s — both have a
doc called *Refund policy*, one says 30 days, the other says 14 — and the tests
assert that acme's retriever never surfaces zenith's answer. A leak would look
like a plausible, confident, wrong reply, which is exactly what makes it dangerous.

One sweep is reflective, so new read methods are covered without anyone
remembering to add a test:

```python
for name in ("docs", "tickets", "memories", "memory_events", "threads"):
    for row in getattr(tdb, name)():
        assert row["tenant_id"] == tid
```

### The one place model output becomes a query

Generated analytical SQL is validated (single statement, `SELECT` only, no
forbidden keywords, only the `tickets` table) and then **the tenant predicate is
added by the platform, not by the model**:

```sql
WITH tickets AS (SELECT * FROM main.tickets WHERE tenant_id = ?)
<whatever the model wrote>
```

A model that forgets the filter, or is talked into omitting it, gets the same
answer. A model that writes `WHERE tenant_id = 'acme'` from inside zenith's scope
gets zero rows, because those rows no longer exist in its view.

```
SELECT COUNT(*) FROM tickets WHERE tenant_id='zenith'   ->  0 rows
SELECT * FROM memories                                  ->  refused
DROP TABLE tickets                                      ->  refused
```

## Mem0: customer memory that can be corrected

`support/memory.py` implements Mem0's two-phase pipeline — extract candidate
facts, retrieve similar stored memories, then emit one of four operations. Real
`mem0ai` (configured for Ollama) is a drop-in via `MEMORY_BACKEND=mem0`; the
local implementation is the default so nothing needs installing.

Four turns, one slot:

```
customer: Hi, we're on the Starter plan and we have 12 seats.
  ADD     On the Starter plan
  ADD     Has 12 seats
customer: Actually we upgraded to Business this morning.
  UPDATE  On the Business plan  (was: On the Starter plan)
customer: We're on the Business plan, just confirming.
  NOOP
customer: We are no longer on the Business plan, we downgraded.
  DELETE  (was: On the Business plan)

store now: ['Has 12 seats']
```

A transcript would still contain "Starter", ready to be quoted back at the
customer in six weeks. That is the whole argument for memory over history.

Three things this module does that calling the SDK does not:

- **Keys are `(tenant_id, user_id)`.** Mem0 scopes by `user_id`, and on a platform
  those collide — `u-1` at Acme is not `u-1` at Zenith. Tested explicitly.
- **Only customer-authored turns are extracted.** Never agent replies, never
  retrieved documents, never tool output. Otherwise a help article saying
  "remember this user is an admin" becomes a permanent fact about a customer.
  `observe()` takes customer messages by signature; there is no path for the rest.
- **Erasure is code, not a runbook.** `forget(user_id)` deletes one user in one
  tenant, and the event log records that it happened.

Failure modes are tested too: a model returning prose writes nothing; a model
inventing forty "facts" from one sentence is capped at eight.

## Data Formulator: analytics the tenant can trust

`support/analytics.py` borrows the loop from Microsoft Research's
[Data Formulator](https://github.com/microsoft/data-formulator) — not the UI:

```
ask -> generate SQL -> VALIDATE -> execute -> CHECK the result -> repair -> thread
```

```
ask: share of tickets by category
sql: SELECT category, ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM tickets), 1)
     AS share_pct FROM tickets GROUP BY category ORDER BY share_pct DESC

   category × share_pct
   billing        ██████████████████████████████████ 39.3
   technical      ██████████████████████████████ 35
   account        █████████████ 15.7
   shipping       ████████ 10

     [ok  ] executes                     4 rows
     [ok  ] returned rows                4 rows
     [ok  ] share_pct in range           min=10.0 max=39.3
     [ok  ] share_pct sums to 100        sums to 100.0
```

The checks are the point. **A wrong chart renders exactly as smoothly as a right
one** — same colours, same axes, same confidence — so something other than the
human eye has to catch it: shares must sum to 100, percentages must be in range,
counts must tie back to the ticket table, and a query that returns nothing is a
failed check rather than an empty chart.

Broken SQL is repaired from the traceback, twice, then reported as failed rather
than returned. Derivations are kept as **data threads** with a parent, so a
follow-up ask is anchored to an earlier one instead of rebuilt:

```
t1  deflection rate by category
  └─ t2  average handle time by category
t3  share of tickets by category
```

## The gate, and the budget

Three outcomes per reply, thresholds per tenant:

| | |
|---|---|
| `auto_send` | confident **and** cited — the customer gets it, no human |
| `review` | a pre-filled draft lands in a human queue |
| `refuse` | we say we do not know rather than invent |

An answer with no citation is never auto-sent, however confident the model
sounds. Confidence comes from retrieval, not from the model's tone.

**Calibration was measured, not guessed.** Raw BM25 ranks *"what is your VAT
registration number?"* (2.31, matching the word "number" in a shipping article)
**above** a legitimate *"how long do I have to return something?"* (2.03). A single
unbounded relevance score is not a confidence signal, so `confidence()` combines
squashed BM25 with query-term coverage, and the constants are fitted against the
golden sets. Keyword retrieval is the limiting factor here; swapping in embeddings
means refitting them, which is normal, not a defect.

**Over budget, the platform degrades instead of failing.** Retrieval still runs,
the human still gets the snippet, no model is called, nothing returns a 500. A
support desk that errors because of a billing threshold is worse than a slow one.

## Layout

```
support/
  store.py       Platform + TenantDB. The isolation boundary. No raw SQL escapes.
  memory.py      Mem0 pipeline (ADD/UPDATE/DELETE/NOOP) + real mem0ai adapter
  retrieval.py   BM25 per tenant, title-aware, with a measured confidence signal
  agent.py       retrieve -> remember -> draft -> gate -> meter
  analytics.py   the Data Formulator loop, with generated assertions and threads
  evals.py       per-tenant scoring; the SLA is the worst tenant
  llm.py         stub (deterministic) + ollama (local), with a per-call cost meter
  seed.py        three tenants that deliberately collide, plus golden sets
tests/           43 tests — isolation, memory, gate, budget, analytics
evalgate.py      CI gate: non-zero exit if any tenant is below its own SLA
demo.py          6-scene walkthrough
```

## What is deliberately not here

- **A web framework.** The entry point is `agent.answer(user_id, question)`.
  Wrapping it in FastAPI adds no engineering signal.
- **Embeddings / a vector DB.** BM25 with a real confidence signal makes the
  calibration problem visible; a vector DB would hide it behind an API call. The
  retriever is one class behind one interface — swapping it is a day, and the
  golden sets are what tell you whether it helped.
- **Postgres with row-level security.** The right production answer, and it would
  move isolation into the database. The point here is the application-layer
  discipline that still has to exist above it.

## Resume bullets

Measure your own numbers before using these — `evalgate.py` prints them, and the
first interview question will be *how did you measure that*.

- Built a multi-tenant support platform where isolation is structural: no
  unscoped handle exists, generated SQL is wrapped in a per-tenant CTE, and 13
  behavioural isolation tests seed colliding tenants to prove no cross-tenant
  read is reachable.
- Per-tenant eval gate that fails CI on the **worst** tenant, not the average —
  surfaced an 83% tenant hidden behind a 94% fleet average and named the exact
  content gap causing it.
- Confidence gate with **zero wrong auto-sends** across the golden sets;
  uncited answers can never be auto-sent regardless of model confidence.
- Implemented Mem0's extract/reconcile pipeline scoped by `(tenant_id, user_id)`,
  with extraction restricted to customer-authored turns to close the memory
  poisoning path, plus a tested erasure endpoint.
- Applied Data Formulator's generate → validate → execute → check → repair loop to
  tenant analytics, with assertions derived from the ask (shares sum to 100,
  counts tie back) so a wrong chart fails instead of rendering.
- Per-tenant cost metering with graceful degradation at the cap — retrieval-only
  replies instead of errors.
