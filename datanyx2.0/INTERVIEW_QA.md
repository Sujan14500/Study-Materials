# Datanyx AI Service — 50 Interview Questions & Answers

Companion to [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).
Questions are grouped the way an interview usually flows: project story → architecture
→ RAG/retrieval → prompting → agents → safety → performance → reliability → behavioural.

**How to use this:** read the *short answer* line first (that's what you say out loud),
then the detail underneath (that's for the follow-up question that always comes).

---

## A. Project overview & story (Q1–Q6)

### Q1. Tell me about this project in two minutes.

**Short answer:** It's a GenAI backend that turns any customer database into a
conversational BI system.

**Detail.** Datanyx AI Service is a Python/Flask service with two halves. The legacy
half (`sqlService`) is a LangChain text-to-SQL engine. The half I'll focus on
(`agentService`) is an autonomous database-analysis agent: you give it read-only
credentials to a customer database and it onboards itself — introspects the schema,
profiles every column, infers foreign keys that were never declared, uses an LLM to
classify each table's role and business domain, mines a business glossary, embeds
everything into a pgvector index, and generates a starter KPI dashboard and report
topics. After that, business users ask questions in English. The agent retrieves the
relevant slice of the schema by vector search, synthesizes a validated structured
analytics spec with an LLM, executes it through the BI platform's row-level-security
engine, picks a chart, writes a caption, and returns a versioned response envelope.
It's about 75,000 lines across 253 modules with 67 REST endpoints and 94 test files.

### Q2. What was the hardest problem you solved?

**Short answer:** Making the LLM behave correctly on schemas far too large to fit in
a prompt, without letting it hallucinate.

**Detail.** Three sub-problems, each with a concrete fix in the codebase:
1. **Schema size** — solved with RAG: every table gets an LLM-readable summary,
   embedded to 1536 dims, retrieved top-12 per question by pgvector cosine.
2. **Retrieval isn't enough** — vector search is blind to the FK graph, so the fact
   table would arrive without its dimensions and a supported join became impossible.
   Fixed by expanding the slice with 1-hop FK neighbours.
3. **Silent fabrication** — vector search essentially never returns zero rows, so an
   off-topic question ("thermodynamics", a random person's name) still retrieved
   *something* and the model answered confidently. Fixed with an empirical relevance
   floor: if even the best table scores below 0.30 cosine, refuse. Real topics score
   ~0.4+, noise ~0.11–0.19.

### Q3. What would you do differently if you rebuilt it?

Four things. **(1)** Move background jobs off an in-process thread pool onto a real
queue earlier — checkpoints and startup sweeps work, but they're compensating
controls. **(2)** Make the caches shared (Redis) instead of per-process, because
horizontal scaling silently drops the hit rate. **(3)** Add per-tenant cost ceilings
from day one; we have token budgets per prompt but no spend ceiling. **(4)** Build the
evaluation harness before the features — we have 94 unit/contract test files, but a
golden-question regression set scored on answer correctness would have caught prompt
regressions faster than contract tests do.

### Q4. What's the single most important architectural decision in the project?

**Short answer:** The LLM does not write the final SQL on the main path.

**Detail.** It emits a structured JSON spec — dimensions, measures, joins, filters,
having, sort, custom columns — which is validated field-by-field against the catalog
and then POSTed to the BI platform's report generator, which compiles and executes it.
Three payoffs: row- and column-level security are enforced by existing audited code
instead of being reimplemented; the spec is machine-checkable in a way free-form SQL
isn't; and when a question needs something the generator can't express, the synth
raises `UnsupportedQuestionError` and we say so honestly instead of shipping
plausible-but-wrong SQL.

### Q5. Who are the users and what does success look like?

Business users inside a customer's org — people who know the business but not SQL.
Success is: the agent onboards a new datasource unattended; a user's first question
gets a correct, charted answer without anyone writing SQL; and when the agent is
unsure it *says so* (clarification, transparency block, confidence label) rather than
guessing. That last part is why so much of the code is refusal and transparency logic.

### Q6. How is this different from just calling ChatGPT with a schema?

Five differences that are all load-bearing in production: schemas don't fit in
context (RAG); real column names don't carry business meaning (glossary + profiling);
FKs are often undeclared (inference with value-overlap verification); multi-tenant
SaaS needs RLS and PII controls (spec execution through the BI engine + AST PII
guard); and an LLM answering confidently on a schema it misread is worse than no
answer (relevance floor, confidence scoring, clarification path).

---

## B. Architecture (Q7–Q14)

### Q7. Walk me through the request flow of one question.

1. `POST /agent/ask` (or `/ask/stream` for SSE). `_prepare_ask` validates the body,
   decodes base64 `datasourceDetails`, resolves `dataSourceId` → internal
   `connectionId` via the identity tuple, and enforces tenant + user ownership.
2. **Router** — one LLM call in JSON mode does two jobs: decide whether the message is
   a follow-up and rewrite it into a standalone question, and classify intent into one
   of nine buckets.
3. **Intent dispatch** — non-data intents (metadata, report, refine, correction,
   conversational, unsupported, out-of-scope, clarify) short-circuit here.
4. **Data path** — retrieve schema slice + glossary + relationships (no LLM) →
   one structured-synth LLM call → execute via Node → bounded repair on error/0-rows.
5. **Tail** — chart plan (one LLM call producing chart + alternatives + caption),
   confidence score, assumptions and ambiguities, audit record, response envelope.

### Q8. Why is the connection identity a 4-tuple instead of just `dataSourceId`?

Because the same numeric datasource id is not unique across the system. The same id
can exist in different environments (`LOCAL`, `prod`) and belong to different tenants
and users. Keying on `dataSourceId` alone would let one tenant's question resolve to
another tenant's catalog row. So identity is `(tenant_id, user_id, data_source_id,
env_name)`, enforced by two unique constraints, and endpoints reject ambiguous
lookups rather than picking one. `/ask` returns 403 on an ownership mismatch.

### Q9. Why two datastores, and why is neither of them the source database?

The **catalog DB** (Postgres + pgvector) is the agent's own memory: connections,
tables, columns, profiles, FKs, glossary, KPIs, dashboards, reports, conversations
and embeddings. It has to be separate from the customer's database because we only
ever have read-only access there and we must not write to it. The second store was
**ClickHouse** for the audit/query log — deliberately separate because a high-volume
append-only log has different characteristics from transactional catalog data, and
because an unreachable log must never block API serving. That store has since been
removed, so `observability/audit_log.py` is a documented no-op that still mints query
ids so every caller and downstream artifact keeps working.

### Q10. Why did you mount two services in one Flask app?

Product constraint: the Angular BI frontend was already hitting one host and port. So
`api.py` at the repo root is a composition root that boots both on port 5000 —
`sqlService` routes inline, `agentService` as a Blueprint at `/agent/*`. It configures
logging once with `force=True` (several imported modules call `basicConfig`
themselves), puts both service dirs on `sys.path`, and `chdir`s into `sqlService/`
because that service reads its config relative to cwd while `agentService` resolves
its own config by absolute path. The same Blueprint object is reused by the standalone
port-5001 app, so the two deployment modes can't drift.

### Q11. How does the agent talk to six different database engines?

SQLAlchemy with per-engine dialects: MySQL, PostgreSQL, SQL Server, Oracle,
Databricks and ClickHouse. Two notable hacks are documented in the code: `oracledb`
is aliased into `sys.modules` as `cx_Oracle` (cx_Oracle doesn't build on modern
setuptools, and SQLAlchemy's Oracle dialect imports it lazily), and the ClickHouse
SQLAlchemy dialect is patched for SQLAlchemy 2.0. Dialect-specific SQL generation is
handled by sqlglot, and the exact server version captured at onboarding is put into
the synth prompt so the model avoids features the engine doesn't have — CTEs on
MySQL 5.x, `FETCH FIRST` on Oracle 11g.

### Q12. Why is the response a fixed "envelope" and why does it have a schema version?

Because the original code hand-assembled eight different dict literals across the
orchestrator, and fields the frontend treated as "always present" were silently
missing on error paths — the same `kind: "answer"` even shipped results two different
ways. Now every response starts from one skeleton and builders only *overwrite*
blocks, never delete keys, so totality is structural rather than a per-call
discipline. `schemaVersion` (currently 3) lets the frontend detect a breaking change
and warn instead of crashing; v3 is when charts went from base64 PNG to live React
components.

### Q13. What is the `transparency` block and why does it exist?

It carries `tablesUsed`, `assumptions`, `ambiguities` and `clarificationsOffered` with
every answer. It exists because a text-to-SQL system's biggest failure isn't being
wrong — it's being wrong *invisibly*. If the agent assumed "revenue" meant
`net_amount` rather than `gross_amount`, the user needs to see that assumption next to
the number. It's also how the glossary grows: an ambiguity surfaced here becomes a
clarification, and a confirmed clarification becomes a persisted glossary term.

### Q14. Where does state live in a conversation?

Deliberately in two places only. Durable state is in `agent_conversation` /
`agent_message`: question text, answer text, generated SQL, and the chart and
dim-measure **specs** — but *not* raw result rows, for PHI safety. On reload the
`/render` endpoint replays the spec through the RLS-preserving Node path to
regenerate rows. Ephemeral state is a per-conversation in-memory store for "use this
definition for this chat only" ad-hoc glossary terms. Everything else in the pipeline
is stateless because the router rewrites follow-ups into standalone questions.

---

## C. RAG, embeddings and retrieval (Q15–Q22)

### Q15. What exactly do you embed?

Not raw DDL. For each table, `vector_index._summarise_table` builds a
natural-language summary combining the table name, its LLM-assigned role
(fact/dimension/lookup) and business domain, its description, and its column names
with types and representative sample values. That summary is what gets embedded with
`text-embedding-3-small` into a 1536-dim vector. Glossary terms and document chunks
are embedded separately with the same model.

**Why summaries beat raw DDL:** user questions are in business language. A summary
that says "sales fact table, domain: commerce, columns include order_date,
net_amount, customer_id" is semantically much closer to "how much did we sell last
month" than `CREATE TABLE sls_hdr (...)` is.

### Q16. Why pgvector instead of Pinecone/Weaviate/FAISS?

Operational simplicity plus consistency. The embeddings describe metadata that
already lives in Postgres — keeping the vector in the same row as the table it
describes means one datastore to run, one backup, one transaction, and no sync job
that can drift. Search uses the native `<=>` cosine-distance operator through
SQLAlchemy's `Vector.cosine_distance`, backed by an HNSW index, so **ranking and
top-k happen inside Postgres** — there's no per-question Python scan over every
vector. The trade-off is that vector search shares Postgres' availability and scaling
envelope, which is fine at our catalog sizes.

### Q17. Walk me through the retrieval algorithm, including the parts that aren't vector search.

1. Embed the question (cached — see Q18) and run pgvector top-k, `DEFAULT_TOP_K_TABLES
   = 12`.
2. **Near-duplicate suppression**: if two returned tables' column-name sets overlap by
   ≥ 0.7 (denominator `max(len(a), len(b))`, so a small lookup dim inside a wide fact
   is *not* flagged) keep only the higher-ranked one. Showing both makes the LLM join
   them and select duplicate columns, which fails at execution with
   `ER_DUP_FIELDNAME` under MySQL's case-insensitive matching.
3. **Deprecated-twin tiebreak**: if the duplicate pair differs only by `_old`, `_bak`,
   `_backup`, `_archive`, etc., keep the canonical name *regardless of rank* — a 0.004
   cosine gap would otherwise strand every column the LLM references.
4. **FK-graph expansion**: pull in 1-hop FK neighbours of the seed tables (capped), so
   the relationships block has in-slice edges to emit.
5. **Relevance floor**: if the best score is below 0.30, refuse instead of answering.
6. **Metric-source augmentation**: force-add tables that a bound glossary metric
   depends on but vector search missed.

The point I'd emphasize: **pure vector search was about 60% of the solution; the
deterministic post-processing around it is what made it production-usable.**

### Q18. You cache embeddings. Isn't caching risky for correctness?

Not for query embeddings, and that's exactly why we only cache those. An embedding is
a *deterministic pure function* of `(text, deployment)` — the same text always
produces the same vector, like a hash. So a cache hit is byte-identical to
recomputing; it can never introduce a wrong result. The cache is a 512-entry LRU keyed
by `(sha256(text), deployment)`, so changing the model auto-misses. Only successful,
non-empty vectors are stored. It's also **pre-warmed at startup** with recurring
report topics so the first report after a restart doesn't pay a rate-limited
round-trip.

The *question cache* (question → schema slice) is different: it's not provably
deterministic across schema changes, so it gets a 300-second TTL, a 256-entry bound,
and explicit invalidation on `/refresh`.

### Q19. How does glossary retrieval differ from schema retrieval?

Schema retrieval is cosine-first. Glossary retrieval is **exact-match-first**, because
the failure modes are different. If a user literally names a metric — "show me GMV" —
that term's definition *must* be injected; leaving it to cosine ranking risks the
right term being ranked 9th and dropped. So the order is:

1. Exact term or alias match — guaranteed injection.
2. Fuzzy name match (trigram similarity + Damerau-Levenshtein) for typos.
3. Cosine similarity for concepts the user *described* instead of naming.
4. Dependency closure via the `depends_on` column, so a ratio metric's numerator and
   denominator come along.
5. A **token budget** (4000) rather than a fixed top-k, with a reserved slice (1500)
   for cosine hits so exact matches can't starve them.
6. Rank boosts: +0.10 for human-confirmed terms, +0.05 for human-authored, so curated
   entries outrank equally-similar LLM drafts.

### Q20. How do you keep the prompt from exploding?

Explicit, named budgets everywhere, and tests that guard them. Glossary block: 4000
tokens. Few-shot: 2400 tokens, k=3 from a pool of 100. Metadata answers: caps on
tables (200), columns per table (60), samples (3), and a 60,000-char serialization
cap. Tool results returned to the model: 8 rows for the QA agent, 20 for the KPI
agent. In the agentic loop, only the **last 3 tool results are kept in full** —
earlier ones are replaced with short stubs. And `test_prompt_size.py` /
`test_token_budgets.py` fail the build if a change blows a budget.

### Q21. How does document upload (the RAG-over-files feature) work?

Users upload PDFs, DOCX, XLSX, images or typed notes to teach the agent. The pipeline
mirrors onboarding: **read → understand → embed → route**, one background job per
document, resumable via `Document.last_completed_stage`, with per-document failure
isolation so one bad file doesn't fail a batch. Bytes live in S3 (the BI app uploads
and hands us the key; the agent only ever reads). SHA-256 of the content dedupes
re-uploads per connection. **Scanned, text-empty PDFs are rasterized with PyMuPDF and
read by the vision model** — chosen over pdf2image specifically because it doesn't
need the poppler system binary. Chunks carry a `source_locator` (`{"page": 3}` /
`{"sheet": "Orders"}`) so answers can cite them.

The `route` stage is where a document's structured knowledge lands in the catalog —
and importantly, an FK asserted by an ER diagram is **not** trusted: it must pass live
probe verification, or it's parked in `pending_proposals` for human confirmation.

### Q22. Why do document chunks use JSON embeddings with Python cosine while tables use pgvector?

Honest answer: it's a migration in progress, and the code says so. Tables and glossary
terms were moved to native pgvector columns with an HNSW index; document chunks still
use the older JSON-float-in-TEXT representation with cosine computed in Python. The
legacy JSON column is still *written* for tables too, for backward compatibility, but
it is no longer *read* by retrieval. The chunk volume per connection is small enough
that the Python scan isn't the bottleneck yet — but it's the obvious next migration.

---

## D. Prompting & LLM engineering (Q23–Q31)

### Q23. Why does the router do two jobs in one LLM call?

Latency and consistency. Follow-up rewriting and intent classification both need the
same inputs — conversation history plus the latest message — so splitting them meant
two round-trips over nearly identical context. Doing both in one JSON-mode call halves
that latency and removes a whole class of inconsistency where the rewrite and the
classification disagree about what the user meant. Same pattern in the chart picker:
one call returns the best chart, the ranked alternatives for the dropdown, *and* the
caption.

### Q24. What happens if the router's LLM call fails?

It fails **open**. Any failure — no LLM, malformed JSON, an intent outside the
taxonomy, a routed intent missing its required params — degrades to
`RouterVerdict(intent="data", is_followup=False, question=<original>)`. The user gets
their question answered on the normal data path rather than a 500. That's the general
principle in this codebase: an *enrichment* step that fails should silently reduce
quality, never break the request. Glossary retrieval, the relationships block and the
audit write follow the same rule.

### Q25. How do you handle follow-up questions?

By **rewriting, not by context-stuffing**. The router turns "now just the top 5" into
a standalone question carrying over only the subject, filter, time range and grouping
the reference actually needs. Everything downstream — retrieval, glossary, few-shot,
question cache, synth — then operates on a self-contained question with zero
conversation awareness. Two benefits: the pipeline stays stateless and cacheable, and
the schema retriever embeds a complete question instead of a fragment like "top 5".

The prompt is explicit that **sharing a topic is not a follow-up** — the test is
whether the message contains an *unresolved reference* (pronoun, ellipsis, or a
request to modify the previous result). It's told never to carry over a filter the
latest message didn't state or point at, because that answers a different question
than the user asked.

There's a related subtlety: the UI's "Select tables" scope is sticky across turns, so
if this turn is *not* a follow-up we drop the inherited table allow-list — otherwise a
fresh unrelated question gets refused as "irrelevant" against the previous question's
tables.

### Q26. How does the model know it can't answer something?

Three distinct exception types, each with a different user-facing outcome:

- `IrrelevantQuestionError` — the schema genuinely can't answer this. Response
  `kind: "irrelevant"`.
- `UnsupportedQuestionError` — the question needs a construct the report generator
  can't express (some window functions, CTEs, UNION, self-joins). Response
  `kind: "unsupported"` with an honest explanation.
- `NeedsClarificationError` — a named business term can't be grounded without
  guessing. Response `kind: "needs_clarification"` with a *grounded* question, and the
  user's answer can be persisted as a real glossary term.

Plus the router's own terminal intents: `conversational` (greeting/help/thanks),
`unsupported` (write/export/email/schedule — we're read-only), and `out_of_scope`
(general knowledge, never free-answered).

### Q27. Why does the clarification decision happen in the synth step, not the router?

Because the router has **no schema visibility** — it would be guessing. If a user
names a term the dataset doesn't define, the router still sends it down the data path;
the schema-aware structured synth, which can see the actual columns and the retrieved
glossary, decides whether the term can be grounded. It only asks when it genuinely
can't. That's why `router.classify`'s docstring explicitly says undefined-term
clarification isn't decided there. Router `clarify` is reserved for genuinely vague
*wording*.

### Q28. Describe the self-repair loop.

Two nested loops, both bounded.

**Inner (catalog validation):** `structured_synth.synthesize_spec` validates the spec
against the catalog — column existence, legal aggregations, joinable tables, resolvable
custom-column references, duplicate output names — and re-prompts with the specific
problems.

**Outer (execution):** `fast_pipeline._execute_with_repair` POSTs the spec to Node. On
an execution error or 0 rows, it appends the real failure text to the prompt and
re-synthesizes, bounded by `QA_FAST_MAX_EXEC_REPAIRS = 2`. A 0-row result is treated
as a **soft** signal — often a wrong filter value — so we retry once, but if the
budget runs out we return the 0-row result as a legitimate answer rather than failing.

The re-synth threads the error through the existing "previous turn" free-text channel
rather than forking the prompt builder — one less prompt to keep in sync.

### Q29. You said error messages are "engineered for the model". What does that mean?

Two concrete examples from `safety_gate.validate`:

1. **Collect all failures in one pass.** The original code rejected on the first
   unknown column. A wide report references ~40 columns across a dozen tables, so each
   repair fixed exactly one bad column and the next attempt surfaced another — the
   bounded repair budget was exhausted before the query was clean. Now every bad column
   is collected and reported together, with an instruction to "fix ALL of them in a
   single corrected query."
2. **Add `did you mean` suggestions.** Unknown column names are matched against the
   real catalog names with `difflib.get_close_matches` (n=3, cutoff=0.6) and the
   suggestions are appended to the rejection reason, echoed in the catalog's exact
   casing (ClickHouse identifiers can be case-sensitive). Without this the model tends
   to re-emit the same invented name.

The general lesson: **a rejection message is a prompt.** Optimize it like one.

### Q30. What temperature do you use and why?

0.0 almost everywhere — SQL/spec synthesis, chart picking, intent routing, role
classification. These are tasks with a correct answer, not creative ones, and
determinism makes debugging and caching tractable. The one deliberate exception is the
narrator (0.2), which writes the one-sentence caption, where a little variation reads
better and there's no correctness risk. Max-token budgets are per-task: 8000 for SQL
synth, 700 for the router, 600 for the chart planner, 120 for the narrator.

### Q31. How do you handle different LLM model families?

Through `llm_compat.py`, which rewrites `temperature` and `max_tokens` for model
families that reject them — newer reasoning models refuse a non-default temperature
and renamed the token parameter. Wrapping that in one shim meant supporting a new GPT
version was a config change, not a code change across every call site. The service
also supports pluggable providers on the sqlService side: Datanyx-default Azure
OpenAI, a customer's Databricks serving endpoint, or a customer's own OpenAI key —
with **no silent fallback** to the default when a provider's credentials are missing,
so a customer's traffic never quietly lands on the wrong model or the wrong bill.

---

## E. Agents & tool calling (Q32–Q37)

### Q32. Which parts are true "agents" versus a fixed pipeline, and why the split?

Three genuine tool-calling agents — the glossary proposer, the KPI proposer and the FK
proposer — all of which run at **onboarding time**, where a 30–60 iteration
exploration loop is acceptable because it happens once. The main `/ask` path is a
**fixed pipeline** (`fast_pipeline`) with a single synth call plus bounded repairs,
because the user is waiting and the previous agentic version's variable iteration
count made latency unpredictable. There's also a true tool-calling QA loop
(`agent_loop.py` + `agent_tools.py`) kept as a hybrid path.

The general rule I'd state: **agentic where exploration is genuinely needed and
latency is amortized; deterministic where the user is blocked.**

### Q33. What tools does the glossary agent get, and what stops it inventing terms?

Tools: `list_tables` (classified tables with role/domain/row count), `describe_table`,
`get_distinct_values` (low-cardinality categoricals), `sample_rows` (up to 5 real
rows), and `finalize_term`. So it can actually *look at the data* before naming a
concept — it discovers that `status` holds `A/I/X` and proposes a `filter` term for
"active customer" grounded in the real value.

Guards: every SQL-bearing fragment passes the same deny-token check as the KPI
proposer before persistence; term types that carry no SQL (entity, synonym,
join_path) skip it as a no-op. Every proposed term is stored with
`status = "proposed"`, `source = "llm"` and a confidence score, so it's visibly a
draft until a human confirms it — and confirmed terms get a retrieval rank boost so
they outrank equally-similar drafts.

### Q34. How does FK inference work, and how do you avoid bad edges?

Four signal families: a name heuristic (`<thing>_id` → table resembling `<thing>`,
`difflib` similarity above 0.6), shared normalized key names with an orientation
decision, value-shape agreement (UUID / numeric / prefixed code), and optional LLM
proposals for semantically likely pairs the textual heuristic misses — the classic
example being `purchaser_id → customers.id`, where nothing about the strings suggests
a relationship.

The critical part: **LLM proposals are never trusted alone.** They pass through
`filter_unsupported_llm_candidates`, which samples both columns from the live database
and requires genuine value overlap before the edge is persisted. Every stored edge
carries `source` (`declared` vs `inferred`), an origin tag (`heuristic` vs `llm`) and a
confidence score, so a downstream consumer can weight them differently.

That's the pattern I'd name explicitly in an interview: **LLM proposes, deterministic
code disposes.** It shows up in FK inference, in spec validation, and in the document
agent's FK proposals.

### Q35. How do you bound an agent loop so it can't run forever?

Every loop has three separate limits, all named constants: a max-iteration count
(QA 20, KPI 50, glossary 60), a **safety ceiling** on total tool calls (QA 6, KPI 30,
glossary 80) that's independent of iterations, and a per-call max-token budget. Tool
results fed back to the model are row-capped (8 for QA, 20 for KPI). And in the agent
loop only the last 3 tool results are retained in full — older ones are stubbed — so
context doesn't grow unbounded across iterations.

### Q36. How does the KPI/dashboard agent work, and why is there no fallback?

The agent explores the live database through tools and emits finalized KPI SQL with
real table and column names. The runner then **re-executes every KPI itself under a
row cap and a statement timeout**, so a query the model wrote can't wedge the service,
asks the chart picker for a Vega-Lite spec derived from the *actual* result shape, and
persists KPI + value + chart.

There is deliberately **no template fallback**: "if the LLM is down, no dashboard."
The reasoning is that a generic template dashboard looks authoritative but is
disconnected from the customer's real schema — a plausible-but-wrong dashboard damages
trust more than an empty state does.

### Q37. What is the "conversational glossary" and why does it matter?

It's how users correct the agent in plain English instead of filing a ticket. A user
says "Active customer should only count people who ordered in the last 90 days";
`/glossary/{id}/edit-nl` translates that into a structured recipe change and returns an
**old → new diff**; the change applies only on `/edit-nl/confirm`. Terms are versioned
(`previous_versions`) and revertible. There's also a lighter option — ad-hoc terms
scoped to "this chat only", held in memory keyed by conversation.

Why it matters: it turns the semantic layer from something a data engineer maintains
into something the business owner maintains, and it closes the loop from a bad answer
to a permanent fix in one conversation. Notably, the pipeline deliberately does **not**
cache the agent's catalog bindings across turns, precisely so an edit to a term takes
effect on the very next question.

---

## F. Safety, security & governance (Q38–Q43)

### Q38. The database role is read-only. Why do you still need a SQL safety gate?

Defence in depth, plus three failure modes read-only doesn't cover. First, "read-only"
is a deployment claim you can't verify at runtime — a misconfigured customer
credential is exactly the case you need protection for. Second, read-only doesn't stop
**data exfiltration primitives** like `INTO OUTFILE`, `load_file()` or `xp_cmdshell`.
Third, it doesn't stop **resource exhaustion** — `SELECT * FROM huge_table` with no
LIMIT, or `benchmark()` / `pg_sleep()` as a DoS. The gate blocks all three, and injects
a `LIMIT 1000` when the model forgets one.

### Q39. Walk through the safety gate's checks in order.

1. Reject empty SQL.
2. Case-insensitive forbidden-substring scan (`into outfile`, `load_file(`,
   `xp_cmdshell`, `sp_executesql`, `pg_sleep(`, `benchmark(`, `sleep(`).
3. Parse with sqlglot at the target dialect.
4. Top-level node must be `Select`, `With`, or a `SetOperation`.
5. Walk the entire tree rejecting `Insert`/`Update`/`Delete`/`Create`/`Drop`/`Alter`/
   `TruncateTable`/`Merge`/raw `Command` nodes anywhere — including nested.
6. Table allow-list from the retrieved slice.
7. Column-existence check with alias and CTE-alias resolution; unqualified columns must
   exist on at least one FROM/JOIN table, not merely somewhere in the slice.
8. PII-in-projection check.
9. Inject a dialect-correct row cap if no LIMIT is present.

### Q40. What's the PII rule exactly, and why is it projection-only?

Columns tagged `pii`, `financial` or `health` during profiling may appear in `WHERE`,
`JOIN` and `GROUP BY` — those *filter* rows and don't return sensitive values to the
caller — but may **not** appear raw in the SELECT projection unless wrapped in an
aggregate. So `SELECT COUNT(DISTINCT email) FROM users WHERE email LIKE '%@acme.com'`
is allowed; `SELECT email FROM users` is rejected with a message telling the model to
aggregate instead. The check resolves table aliases so `u.email` is recognized as
`users.email`, and it checks unqualified columns against every PII column in scope.

### Q41. What happens when sqlglot can't parse the SQL?

This was a real production problem: sqlglot is an incomplete parser for some dialects —
ClickHouse especially, where its function-arity validation trips on valid nested
duration math. Hard-rejecting there killed **valid** queries *after* the whole repair
budget was spent, and the model can't "fix" SQL that was never wrong — it just
regenerates the same valid ClickHouse and gets rejected again.

So a parse failure falls back to AST-free checks: no chained statements (a `;`
followed by more content), the query must begin as `SELECT`/`WITH`/parenthesised
select, and a row cap is appended. The source DB — the real authority on its own
dialect — validates the rest via the execute-and-repair loop.

**The exception is the important bit: it fails closed when the schema has PII
columns.** Without an AST we can't prove PII isn't in the projection, so we refuse
rather than risk a leak. That's the trade-off stated explicitly: degrade availability
for unparseable SQL, never degrade confidentiality.

### Q42. How is multi-tenancy enforced?

Three layers. **Identity** — the 4-tuple connection key with unique constraints, and
endpoints that reject ambiguous lookups instead of picking one. **Authorization** —
`/ask` and every ownership-sensitive endpoint check tenant *and* user against the
catalog row and return 403 on mismatch; background scripts use an explicit system-user
sentinel rather than a null that could match anything. **Execution** — the spec goes
to the BI app with `x-api-user-id` and `x-client-id` headers, so the BI backend
resolves the user profile and applies its own row- and column-level security. We don't
reimplement RLS; we route through the system that already has it.

### Q43. What data do you deliberately *not* store, and why?

Raw result rows are not persisted in chat history — only the question, the answer
text, the generated SQL and the chart/dim-measure spec. Reopening a conversation
replays the spec through the RLS path to regenerate rows, which means a user who has
lost access to some rows since the original answer doesn't see them on reload. The one
exception is catalog-derived metadata answers (table lists, dimension values), which
are stored inline because they're not source PHI and their SQL is synthetic and
non-executable. Secrets in config are stored encrypted with a `~` marker and decrypted
at read; datasource fields matching sensitive-name hints are redacted in logs.

---

## G. Performance & scale (Q44–Q47)

### Q44. Where does the latency go, and what did you do about it?

Per question the cost is roughly: 1 router call, 1 synth call (plus up to 2 repairs),
1 chart call, 1 embedding call, plus the actual query execution. The optimizations,
roughly by impact:

- **Merged LLM calls** — router does rewrite+classify in one; chart picker does
  chart+alternatives+caption in one.
- **Retrieval with no LLM at all** — the whole retrieve stage is vector + SQL.
- **Embedding cache** (deterministic, pre-warmed) and **question cache** (question →
  schema slice, 300s TTL).
- **Plan snapshots** — for reports, the schema slice, glossary block and planned
  question specs are pre-computed at onboarding, so report generation skips the
  retrieval and planning LLM calls entirely.
- **Background catalog warm-up at boot**, so the first `/ask` doesn't pay one-time
  engine + schema init against the remote catalog DB.
- **SSE streaming** with 15s heartbeats — doesn't reduce latency, but stops gateways
  504-ing a long question at ~60s.
- **Progress beats** published to `/progress/{requestId}` so the UI shows real steps
  instead of a spinner.

### Q45. How do you handle a database with thousands of tables?

Retrieval means prompt size is independent of schema size — that's the whole point.
The parts that *are* O(tables) are onboarding-time: introspection and profiling run on
a thread pool with live intra-stage progress (`{done, total}`) published so the UI's
progress bar interpolates *within* the profile stage instead of freezing while
hundreds of tables are profiled. For genuinely large data there's an optional **Spark
profiler backend**, auto-selected when the engine is Databricks or the largest table
exceeds 100M rows, or forced with `PROFILER_BACKEND=spark`. And the whole pipeline is
checkpointed, so a 30-minute onboarding that dies at stage 7 resumes at stage 7.

### Q46. How do you control LLM cost?

Named token budgets per prompt component (glossary 4000, few-shot 2400, tool results
row-capped, metadata char-capped), tests that fail the build when a budget is
exceeded, per-request thread-local token accounting folded into the audit plan so
every request's real cost is measurable, and caches that remove whole LLM calls rather
than shortening them (plan snapshots remove the report planner entirely; the embedding
cache removes embed calls). The honest gap: there's no per-tenant spend ceiling yet —
that's on the roadmap.

### Q47. Your caches are in-memory. What breaks when you scale to multiple instances?

Correctness doesn't break — every cache is either provably deterministic (embeddings)
or TTL-bounded with explicit invalidation (question cache, metadata cache). What
breaks is **hit rate**: each instance warms its own cache, so N instances mean roughly
1/N the effective hit rate, and a `/refresh` that invalidates on one instance doesn't
invalidate on the others — which is why the TTLs are short (300s / 30min) rather than
long. The documented upgrade path is Redis; the modules are written so swapping the
backing store is a local change, the same way `jobs.submit()` is the single swap point
for moving from a thread pool to a real queue.

---

## H. Reliability, testing & behavioural (Q48–Q50)

### Q48. How do you make a long, multi-stage onboarding survive crashes?

Four mechanisms. **Checkpointing** — after each of the 11 stages, `last_completed_stage`
is written; a re-entered run skips every stage at or before it, with unknown stage
names defensively treated as "not done". **Startup sweeps** — rows stuck in
`INTROSPECTING` for over 30 minutes are assumed to belong to a dead worker and bounced
back to `PENDING`; the same pattern exists for stale `building` dashboards and stale
document ingestions. **Status as the contract** — the BI app polls
`Connection.status`, and `/ask` returns 409 until `ready`, so a half-onboarded source
can't be queried. **Reloader disabled by default** — Werkzeug's watchdog would kill the
long-lived onboarding threads ("cannot schedule new futures after interpreter
shutdown") and a double import would create two thread pools; `AGENT_SERVICE_RELOAD=1`
opts back in for pure sqlService development.

### Q49. How do you test an LLM-dependent system?

Four layers, all runnable offline. **Stubbed LLMs** — a `_ScriptedClient` returns
canned completions so a test asserts on *our* logic, not the model's. **Contract
tests** — `test_response_envelope.py`, `test_narrative_api_contract.py`,
`test_renderer_output_contract.py` assert the shape every consumer depends on, which is
what makes the "every key always present" guarantee real rather than aspirational.
**Property/budget tests** — `test_prompt_size.py`, `test_token_budgets.py` fail if a
prompt change blows a budget. **Named regression tests** — files like
`test_segment_listing_bug.py`, `test_monthly_trend.py` and `test_report_row_ordering.py`
each encode a specific production bug, so the fix can't silently regress.

What's still missing, and I'd say so: an end-to-end evaluation set that scores *answer
correctness* across a golden question bank. Contract tests prove the pipeline holds
its shape; they don't prove the answer is right.

### Q50. What did you learn from this project?

Three things I'd carry into any GenAI system.

**One: the LLM is the smallest part of the system.** The router, synth and chart calls
are maybe 200 lines of prompt. The other 75,000 lines are retrieval, validation,
caching, refusal logic, resumability and transparency — the machinery that makes a
probabilistic component safe to put in front of a customer's database.

**Two: constrain the output, not the model.** Every quality jump came from narrowing
what the model was allowed to emit — free SQL → validated structured spec, free chart
choice → constrained type enum, free answers → explicit refusal exceptions. A model
that can only emit valid shapes doesn't need to be trusted as much.

**Three: an error message is a prompt.** Rewriting rejections to collect all failures
at once and include `did you mean` suggestions fixed more real failures than any
prompt-engineering tweak to the main synth prompt did. The model is a consumer of your
error strings; write them for that reader.

---

## Quick-reference cheat sheet

| Thing | Value |
|---|---|
| Chat model | Azure OpenAI `gpt-4.1`, temperature 0.0 |
| Embedding model | `text-embedding-3-small`, 1536 dims |
| Vector store | pgvector in the catalog Postgres, HNSW index, `<=>` cosine |
| Top-k tables retrieved | 12 |
| Relevance floor | 0.30 cosine |
| Near-duplicate table threshold | 0.70 column-name overlap |
| Execution repair budget | 2 |
| Default row cap injected | 1000 |
| Onboarding stages | 11, checkpointed and resumable |
| Stale-introspection sweep | 30 minutes |
| Question cache | 300s TTL, 256 entries |
| Embedding cache | 512-entry LRU, deterministic, pre-warmed |
| Glossary token budget | 4000 (1500 reserved for cosine hits) |
| Agent loop caps | QA 20 iters / 6 tool calls; KPI 50/30; glossary 60/80 |
| Response envelope | `schemaVersion 3` |
| Endpoints | 67 on `/agent` |
| Tests | 94 files, ~16,600 lines |
| Source engines | MySQL, PostgreSQL, SQL Server, Oracle, Databricks, ClickHouse |
