# Datanyx AI Service — Full Project Documentation

> A production GenAI backend that turns any customer database into a conversational
> BI system: it onboards itself onto an unfamiliar schema, builds its own semantic
> layer, and then answers natural-language business questions with governed,
> executable analytics.

**Every section below carries a worked example.** The examples use one running
scenario — a retail/commerce database with `sales_order`, `order_line`, `product`
and `customer` — so you can follow the same question end to end through retrieval,
synthesis, execution and response.

---

## Table of contents

1. [One-paragraph summary](#1-one-paragraph-summary)
2. [The problem it solves](#2-the-problem-it-solves)
3. [System context](#3-system-context)
4. [Tech stack](#4-tech-stack)
5. [Repository layout](#5-repository-layout)
6. [The two engines](#6-the-two-engines)
7. [The Semantic Catalog](#7-the-semantic-catalog-the-agents-memory)
8. [Onboarding pipeline — 11 stages](#8-onboarding-pipeline--11-stages)
9. [The `/agent/ask` Q&A pipeline](#9-the-agentask-qa-pipeline)
10. [Sub-agents and capabilities](#10-sub-agents-and-capabilities)
11. [GenAI engineering patterns](#11-genai-engineering-patterns-used)
12. [Safety, security and governance](#12-safety-security-and-governance)
13. [Performance engineering](#13-performance-engineering)
14. [Reliability engineering](#14-reliability-engineering)
15. [Configuration and secrets](#15-configuration-and-secrets)
16. [API surface](#16-api-surface)
17. [Testing](#17-testing)
18. [Running and deploying](#18-running-and-deploying)
19. [Key design decisions and trade-offs](#19-key-design-decisions-and-trade-offs)
20. [Known limitations and roadmap](#20-known-limitations-and-roadmap)
21. [Resume bullets](#21-resume-bullets-you-can-use)
22. [Glossary](#22-glossary)

---

## 1. One-paragraph summary

**Datanyx AI Service** is a Python/Flask GenAI backend for conversational business
intelligence. Given nothing but read-only credentials to a customer database, it
autonomously introspects the schema, profiles every column, infers undeclared
foreign keys, classifies tables into business domains, mines a business glossary,
embeds everything into a pgvector index, and generates a starter KPI dashboard and
narrative-report topics. After that one-time onboarding, business users ask
questions in plain English and the service retrieves the relevant schema slice via
vector search, synthesizes a **structured analytics spec**, validates it against the
real catalog, executes it through the BI app's row-level-security-preserving
executor, picks the right chart, writes a caption, and returns a versioned response
envelope.

**Scale:** ~253 Python modules, ~75,000 lines in `agentService`, 67 REST endpoints,
94 pytest files (~16,600 lines), 6 supported source-database engines.

> ### Example — the whole system in one exchange
>
> **User types:** `top 5 products by revenue last quarter`
>
> **System does:** rewrite-check → intent `data` → vector-retrieve `order_line`,
> `sales_order`, `product` → bind glossary term *Revenue* → synthesize a spec with
> a `Sum` measure, a `product.name` dimension, a date filter resolved to real
> calendar dates, `sort desc` + `limit 5` → Node compiles and runs it with RLS →
> chart planner picks `bar` → narrator writes the caption.
>
> **User sees:** a bar chart, a 5-row table, the caption *"Ergonomic Chair led Q2
> revenue at ₹4.2M, 31% ahead of the next product."*, and a transparency footer:
> *Tables used: order_line, product · Assumption: "revenue" = SUM(order_line.
> line_amount) per the glossary · Row cap 1000 applied.*

---

## 2. The problem it solves

Classic text-to-SQL demos work on a toy schema you paste into the prompt. Real
enterprise databases break that approach in five ways:

| Real-world problem | What this service does about it |
|---|---|
| Schemas are far too big for a prompt (hundreds/thousands of tables) | Vector-based **schema retrieval** — embed every table, retrieve only top-k per question |
| Column names are cryptic (`cust_stat_cd`), foreign keys often undeclared | **Profiling + FK inference + role/domain classification** at onboarding, cached in a semantic catalog |
| Business language ≠ schema language ("churn", "active customer", "GMV") | A **business glossary** mined by an LLM agent, editable in natural language, retrieved and injected per question |
| LLMs hallucinate columns and can emit destructive SQL | A **sqlglot AST safety gate**, catalog-validated structured specs, and a bounded self-repair loop |
| Multi-tenant SaaS needs row-level security and PII protection | Execution delegated to the BI app's RLS executor; PII blocked from raw projection; connection identity is a 4-tuple with ownership checks |

> ### Example — each problem, concretely
>
> **Schema size.** A customer warehouse has 1,840 tables. Serialized DDL is ~2.1M
> tokens. The retrieved slice for *"top 5 products by revenue"* is 3 tables and
> ~900 tokens.
>
> **Cryptic names.** The column is `sls_ln_amt`, type `DECIMAL(18,2)`. Profiling
> records `null_ratio 0.002`, `min 0.00`, `max 184320.50`, samples
> `[1299.00, 450.00, 89.99]`. Role classification labels the table `fact`, domain
> `commerce`. Now the embedded summary reads like business English, so the question
> matches it.
>
> **Business language.** The user says *"revenue"*. No column is called that. The
> glossary has `Revenue → SUM(order_line.line_amount)` with alias *"net sales"*, so
> the term binds instead of the LLM guessing `sales_order.total_amount` (which
> includes tax and shipping).
>
> **Hallucination.** The LLM writes `SELECT Unit_Price FROM order_line`. The real
> column is `Unit Price`. The gate rejects with
> `` `Unit_Price` on table `order_line` (did you mean: Unit Price?) `` and the
> model fixes it on the next attempt.
>
> **Tenancy.** Tenant 44 asks a question against `dataSourceId 12`. Tenant 91 also
> has a `dataSourceId 12`. Identity is the 4-tuple, so tenant 44's question can
> never resolve to tenant 91's catalog row — and a mismatch returns 403.

---

## 3. System context

```
┌──────────────────────┐        ┌───────────────────────────────────────────┐
│  Angular BI frontend │        │        Datanyx AI Service (this repo)     │
│  (chat, dashboards,  │        │                                           │
│   report wizard)     │        │  api.py  (Flask, port 5000)               │
└──────────┬───────────┘        │   ├── sqlService routes  /ask /mongoquery │
           │                    │   └── agentService blueprint  /agent/*    │
           ▼                    │                                           │
┌──────────────────────┐  HTTP  │  agentService/                            │
│  Node/Java BI backend│◄──────►│   schema_agent  glossary_agent  kpi_agent │
│  ("tekizma app")     │        │   qa_agent  report_agent  viz_agent       │
│  - RLS/CLS executor  │        │   doc_agent  questionnaire  observability │
│  - credential vault  │        └────────────┬─────────────────┬────────────┘
└──────────┬───────────┘                     │                 │
           │                                 ▼                 ▼
           ▼                    ┌────────────────────┐  ┌──────────────────┐
┌──────────────────────┐        │ Catalog DB         │  │ Azure OpenAI     │
│  Customer source DBs │        │ Postgres+pgvector  │  │ gpt-4.1 (chat)   │
│  MySQL/PG/MSSQL/     │◄───────│ schema, profiles,  │  │ text-embedding-  │
│  Oracle/Databricks/  │ read-  │ glossary, KPIs,    │  │ 3-small (1536-d) │
│  ClickHouse          │ only   │ reports, vectors   │  └──────────────────┘
└──────────────────────┘        └────────────────────┘
                                         + AWS S3 (uploaded docs, AI call logs)
```

**Two execution paths from the same endpoint:**

- **`datasourceDetails` supplied** → the agent connects to the source DB itself and
  executes; response carries `data` + chart.
- **`datasourceDetails` omitted** → the agent returns only the SQL/spec and the BI
  app executes it, preserving row- and column-level security. Also the graceful
  fallback when the agent cannot reach the source DB.

> ### Example — the same question on both paths
>
> **Path A — agent executes (request carries credentials):**
> ```json
> POST /agent/ask
> { "dataSourceId": 12, "tenantId": "44", "userId": "13", "envName": "prod",
>   "query": "top 5 products by revenue last quarter",
>   "datasourceDetails": { "host": "<base64>", "user": "<base64>", ... } }
> ```
> Response contains `payload.result.rows` and `payload.chart.component`.
>
> **Path B — BI app executes (no credentials):**
> ```json
> POST /agent/ask
> { "dataSourceId": 12, "tenantId": "44", "userId": "13", "envName": "prod",
>   "query": "top 5 products by revenue last quarter" }
> ```
> Response contains `response` (the SQL string) and the spec; the BI app runs it,
> so a sales rep restricted to the West region sees only West rows — the agent
> never had to know that rule existed.

---

## 4. Tech stack

| Layer | Choice |
|---|---|
| Language / runtime | Python 3.11 |
| Web framework | Flask 3 + Blueprints; Werkzeug 3; SSE for long requests |
| LLM | Azure OpenAI — `gpt-4.1` chat (temperature 0.0), `text-embedding-3-small` (1536 dims). Pluggable: Databricks serving endpoints, customer OpenAI keys |
| Vector store | **pgvector** in the catalog Postgres; native `<=>` cosine distance with HNSW — ranking and top-k in the database |
| ORM | SQLAlchemy 2.0, declarative models, `session_scope()` |
| SQL parsing | **sqlglot** 25.x — AST safety gate, dialect transpilation, LIMIT injection |
| Source drivers | pymysql, psycopg2, pyodbc, oracledb (aliased as `cx_Oracle`), databricks-sql-connector, clickhouse-connect |
| Background work | `ThreadPoolExecutor` job pool + APScheduler |
| Documents | pypdf, PyMuPDF (rasterizes scanned PDFs for the vision model), python-docx, openpyxl, Pillow, boto3 → S3 |
| Optional profiling | PySpark backend for Databricks or tables >100M rows |
| Legacy engine | LangChain 0.3 `SQLDatabaseChain` (sqlService only) |
| Tests | pytest, 94 files, LLM and Node calls stubbed |

> ### Example — why each choice earns its place
>
> **sqlglot over regex.** A regex checking `^\s*select` passes
> `SELECT * FROM (SELECT 1); DROP TABLE users`. sqlglot parses it, sees a second
> statement and a `Drop` node, and rejects.
>
> **pgvector over a separate vector DB.** The retrieval query is one statement:
> ```sql
> SELECT id, embedding_vector <=> :q AS distance
> FROM   agent_datasource_table
> WHERE  connection_id = 50
> ORDER  BY distance LIMIT 12;
> ```
> No sync job, no second backup, and the vector lives in the same row as the
> metadata it describes.
>
> **PyMuPDF over pdf2image.** pdf2image shells out to `poppler`, a system binary
> that has to exist on every EC2 host. PyMuPDF is a pip wheel — one less thing to
> provision.

---

## 5. Repository layout

```
datanyx_ai_service/
├── api.py                     # UNIFIED composition root — both services on :5000
├── requirements.txt           # merged deps
├── CLAUDE.md                  # engineering guide for AI coding agents
├── sqlService/                # legacy "AskMe" LangChain text-to-SQL engine
│   ├── instance_conversation.py   # ChatBotController, SQLDatabaseChain
│   ├── knowledge_type_handler.py  # routes by knowledge_type, multi-provider LLM
│   ├── mongoQueryGenerator.py     # NL → MongoDB query
│   └── chartTemplateProcessor.py
├── agentService/              # the autonomous agent (the GenAI core)
│   ├── api.py                 # 67 Flask routes (~6.6k lines)
│   ├── config.py  cipher.py  constants.py
│   ├── catalog/               # ORM models, repository, database, vector_index
│   ├── schema_agent/          # introspector, profiler, fk_inference, classifiers, onboarding
│   ├── glossary_agent/        # proposer, retriever, embedder, mine_from_sql
│   ├── kpi_agent/             # agentic_proposer, runner, template_recommender
│   ├── qa_agent/              # router, schema_retriever, structured_synth, safety_gate…
│   ├── report_agent/          # narrative_builder, report_spec, evidence, critique
│   ├── viz_agent/             # chart_picker, react_chart, layout_planner, narrator
│   ├── doc_agent/             # extractor, understander, chunk_index, ingestion
│   ├── questionnaire/         # "AI Setup" 3-tier question bank
│   ├── runtime/               # in-memory caches
│   ├── observability/         # audit log, progress, S3 AI-call log
│   ├── orchestrator/jobs.py   # background pool + stale-job sweeps
│   └── tests/                 # 94 pytest files
├── demoService/               # canned demo answers
└── workflowAgent/             # LangChain ETL workflow generator (separate package)
```

> ### Example — where a change lands
>
> | Change you want | File you open |
> |---|---|
> | "The agent picked the wrong chart for time series" | `viz_agent/chart_picker.py` → `_build_planner_prompt` |
> | "It keeps missing the `customer` table on join questions" | `qa_agent/schema_retriever.py` → `_expand_with_fk_neighbors` |
> | "Raise the refusal threshold" | `constants.py` → `RELEVANCE_MIN_TOP_SIMILARITY` |
> | "Support a new source engine" | `schema_agent/introspector.py` → `SUPPORTED_ENGINES` + `data_connections.py` |
> | "Answers ignore our fiscal year" | `questionnaire/templates.yaml` → `common.fiscal_year_start_month` |

---

## 6. The two engines

### 6.1 `sqlService` — the legacy "AskMe" engine

LangChain `SQLDatabaseChain` over `AzureChatOpenAI`. Takes a user query plus optional
selected tables / data-model connections and emits SQL or a MongoDB query. Supports
**per-agent custom prompts** and **pluggable LLM providers** — Datanyx default (Azure
OpenAI), a customer Databricks serving endpoint, or a customer's own OpenAI key. A
provider without credentials is a hard error: there is deliberately no silent
fallback, so a customer is never billed to the wrong model.

> ### Example — provider routing and response cleanup
>
> ```python
> # knowledge_type_handler.call_llm_with_custom_prompt
> provider = "databricks"
> # llm_connector_details missing →
> {"status": "error",
>  "error": "Databricks provider requires llm_connector_details. NO fallback to default LLM."}
> ```
>
> Raw model output, then cleanup:
> ```
> ```sql
> SQL Query: SELECT "Unit Price", "Product Name" FROM products
> ```
> ```
> `_clean_sql_response` strips the fence and the `SQL Query:` prefix and converts
> ANSI quotes to backticks; `_ensure_backticks` re-quotes names with spaces against
> the live `table_info`:
> ```sql
> SELECT `Unit Price`, `Product Name` FROM products
> ```

### 6.2 `agentService` — the autonomous analysis agent

The GenAI heart of the project and the rest of this document. Cwd-agnostic,
self-contained, mounted as a Flask Blueprint at `/agent/*`, and also runnable
standalone on port 5001.

> ### Example — three API responses that show its range
>
> | Question | `kind` | What comes back |
> |---|---|---|
> | "top 5 products by revenue" | `answer` | SQL + rows + bar chart component + caption |
> | "what tables do you have?" | `metadata` | Inline table list from the catalog — no source-DB hit at all |
> | "who won the 2019 world cup?" | `irrelevant` | A fixed decline; general knowledge is never free-answered |

---

## 7. The Semantic Catalog (the agent's memory)

Everything the agent learns is persisted in a Postgres catalog DB with pgvector —
**this is not the customer's source database**. Schema is auto-created on first
request; the `vector` extension and the database itself are auto-created when the PG
user has `CREATEDB`.

### Core tables

| Table | Purpose |
|---|---|
| `agent_connection` | One row per registered datasource. Identity is `(tenant_id, user_id, data_source_id, env_name)`. Status, onboarding checkpoint, live profile progress, industry |
| `agent_datasource_table` | Every profiled table: row count, **role**, **domain**, description, `embedding_vector vector(1536)` |
| `agent_column` | Null ratio, distinct count, min/max/mean/stddev, top-k values, samples, **sensitivity** |
| `agent_datasource_relationship` | FK edges — `declared` or `inferred`, with confidence |
| `agent_business_term` | Glossary: term, aliases, definition, type, column refs, `filter_sql`, `formula_sql`, structured `recipe`, `depends_on`, versions, embedding, status, source |
| `agent_kpi` | KPI definition + last value + structured metadata (base table, measure, aggregation, date column, row-scope filter) |
| `agent_dashboard`, `agent_dashboard_widget_mapping` | Instant dashboards; widgets store a dims/measures **spec**, never raw SQL |
| `agent_datasource_category`, `agent_dashboard_template` | AI-invented dashboard categories and templates |
| `agent_report_topic` | AI-generated report topics with a structural blueprint |
| `agent_narrative_report` | Saved reports (spec as JSON), soft-deleted |
| `agent_report_plan_snapshot` | Pre-computed, window-independent report plan, version-gated |
| `agent_document`, `agent_document_chunk` | Uploaded files (S3 key + SHA-256) and embedded chunks |
| `agent_conversation`, `agent_message` | Chat threads. **No raw result rows** — question, answer text, SQL, and chart/dim-measure spec only |
| questionnaire tables | Per-source answers, org-level shared answers, generated Tier-3 schema questions |

> ### Example — one table, one column, one FK edge as stored rows
>
> ```jsonc
> // agent_datasource_table
> { "id": 812, "connection_id": 50, "schema_name": "retail", "table_name": "order_line",
>   "table_type": "BASE TABLE", "row_count": 4820113,
>   "role": "fact", "domain": "commerce",
>   "description": "One row per product line on a sales order.",
>   "embedding_vector": "[0.0142, -0.0311, …1536 floats]",
>   "embedding_model": "text-embedding-3-small" }
>
> // agent_column  (note the physical column names differ from the attribute names)
> { "id": 9911, "table_id": 812, "column_name": "line_amount", "data_type": "DECIMAL(18,2)",
>   "is_null": 0, "is_primary_key": 0, "null_ratio": 0.002, "distinct_count": 91422,
>   "min_value": "0.00", "max_value": "184320.50", "mean_value": 1187.44,
>   "top_category": [{"value": "1299.00", "count": 8140}],
>   "sample_column_values": ["1299.00", "450.00", "89.99"],
>   "sensitivity_type": "financial" }
>
> // agent_datasource_relationship
> { "connection_id": 50, "from_column_id": 9915, "to_column_id": 8802,
>   "source": "inferred", "confidence_score": 0.86 }
> ```

### Notable data-modelling decisions

- **Soft deletes everywhere** (`active` / `is_deleted`) so a re-detected category,
  topic or dashboard keeps its original id and downstream references stay valid.
- **Python attribute names decoupled from physical column names** via
  `Column("db_name", …)`.
- **Embeddings stored twice during migration** — the legacy JSON-float TEXT column is
  still written for back-compat, but retrieval runs over the pgvector column.

> ### Example — the decoupling in one line
>
> ```python
> class Connection(Base):
>     name   = Column("datasource_name", String(255), nullable=False)
>     engine = Column("db_type", String(32), nullable=False)
> ```
> The DBA renamed the physical columns to `datasource_name` / `db_type`; every call
> site still reads `conn.name` and `conn.engine`. Zero application changes.
>
> ### Example — why soft delete, not hard delete
>
> A user saved a dashboard built on category `id 7` ("Store Performance"). A schema
> refresh no longer detects that category. Hard delete → the saved dashboard's
> template stops resolving and the user's artifact breaks. Soft delete sets
> `active = 0`; when the category is detected again it reactivates **with the same
> id 7**, and the saved dashboard keeps working.

---

## 8. Onboarding pipeline — 11 stages

Triggered by `POST /agent/connect`, run on a background thread pool. Status flows
`pending → introspecting → ready`; `/ask` returns HTTP 409 until `ready`.

| # | Stage | What happens |
|---|---|---|
| 1 | `connect` | Read-only SQLAlchemy connection |
| 2 | `introspect` | Tables, views, columns, types, PKs, declared FKs, constraints, row-count estimates |
| 3 | `profile` | Per-column stats + PII/financial/health tagging. Parallelized; publishes live `{done, total}` progress |
| 4 | `fk_inference` | Infers undeclared foreign keys |
| 5 | `role_classify` | Batched LLM labels role + domain per table (heuristic fallback); separate industry classifier |
| 6 | `vector_embed` | Natural-language table summary → 1536-dim vector |
| 7 | `glossary_bootstrap` | Tool-calling agent mines business terms |
| 8 | `category_generate` | AI invents dashboard categories + up to 3 templates each |
| 9 | `dashboard_build` | Agentic KPI proposer builds the starter dashboard |
| 10 | `report_topics` | AI generates report topics with blueprints |
| 11 | `plan_snapshot_build` | Pre-computes window-independent report plans |

> ### Example — the connect call and the status poll
>
> ```json
> POST /agent/connect
> { "dataSourceId": 12, "tenantId": "44", "userId": "13", "envName": "prod",
>   "datasourceDetails": { "engine": "MYSQL", "host": "<base64>", … } }
>
> → 202 { "connectionId": 50, "status": "pending" }
> ```
> ```json
> GET /agent/connections/50/status
> → { "status": "introspecting", "currentStage": "profile",
>     "progress": { "percent": 27, "done": 412, "total": 1840 },
>     "lastCompletedStage": "introspect" }
> ```
> The `done/total` pair is why the bar moves *inside* the profile stage instead of
> freezing at 27% while 1,400 more tables are profiled.
>
> ### Example — resume after a crash
>
> ```
> 09:14  stage connect        ✓  checkpoint = connect
> 09:14  stage introspect     ✓  checkpoint = introspect
> 09:31  stage profile        ✓  checkpoint = profile
> 09:33  stage fk_inference   ✗  container OOM — worker dies
> ...
> 09:41  startup sweep: connection 50 stuck INTROSPECTING > 30 min → status = pending
> 09:41  re-run: _stage_done("profile") is True for connect/introspect/profile → skipped
>        resumes at fk_inference
> ```
> The 17-minute profile stage is not repeated.

### Foreign-key inference (`schema_agent/fk_inference.py`)

Four signal families, merged and scored: a **name heuristic**
(`<thing>_id` → table resembling `<thing>`, `difflib` similarity above 0.6),
**shared key names** with an orientation decision, **value-shape** agreement, and
optional **LLM proposals**.

**LLM proposals are never trusted alone** — they must pass a deterministic
**value-overlap gate** that samples both columns from the live database.

> ### Example — the four signals on one schema
>
> ```
> order_line.order_id      → sales_order.id      heuristic  0.92  "name match, 0.94 similarity"
> order_line.prod_id       → product.id          heuristic  0.71  "prod ≈ product"
> sales_order.ISRCODE      → sales_target.RC     llm        0.40  "both look like rep codes"
> shipment.tracking_number → (none)                                no candidate
> ```
> The third candidate is where the gate matters. Name similarity between `ISRCODE`
> and `RC` is near zero — only the LLM saw it. So it gets probed:
> ```python
> sketches = {("sales_order","ISRCODE"): ["I001","I002","I003","I004"],
>             ("sales_target","RC"):      ["I001","I002","I003","I004"]}
> fk.filter_unsupported_llm_candidates([cand], samples={}, sketches=sketches)
> # → kept: 4/4 values overlap
> ```
> Same candidate with no overlap (`["I001",…]` vs `["9920",…]`) → **dropped**, never
> persisted. That is `test_sketch_rescues_high_cardinality_llm_candidate` in the
> test suite.
>
> ### Example — value_overlap is directional
>
> ```python
> fk.value_overlap(["a", "b"], ["a", "z"])  # 0.5  — |A∩B| / |A|
> fk.value_overlap([], ["a"])               # 0.0
> ```
> Direction matters: every `order_line.order_id` should exist in `sales_order.id`,
> but not every order has lines. Measuring the wrong direction would reject a
> perfectly good FK.

---

## 9. The `/agent/ask` Q&A pipeline

### 9.1 Request handling

`_prepare_ask()` validates and resolves; `_generate_ask_envelope()` runs the
pipeline. Both the blocking `POST /agent/ask` and the SSE `POST /agent/ask/stream`
share these two functions so the paths cannot drift.

> ### Example — validation failures are specific, not generic
>
> ```json
> // no question
> 400 { "status": "error", "message": "`query` (or `userMessage`) is required." }
> // no datasource
> 400 { "status": "error", "message": "`dataSourceId` is required. Call /agent/connect first." }
> // dataSourceId without envName — identity tuple is incomplete
> 400 { "status": "error", "message": "`envName` is required when resolving by `dataSourceId`." }
> // credentials supplied without envName — no credential section to pick
> 400 { "status": "error", "message": "envName is required when datasourceDetails is supplied." }
> // onboarding not finished
> 409 { "status": "error", "message": "Connection is still being analysed." }
> ```
>
> ### Example — the SSE stream frames
>
> ```
> : ping
> : ping
> event: result
> data: {"schemaVersion":3,"status":"success","kind":"answer", …}
> ```
> A `: ping` comment every ~15s keeps the connection non-idle, so a gateway with a
> 60-second idle timeout never 504s a 90-second question.

### 9.2 The pipeline

```
question
  │
  ├─ 1. ROUTER  (one LLM call, JSON mode)
  │      • is this a follow-up? → rewrite into a standalone question
  │      • classify intent: data | metadata | report | metric_correction |
  │        conversational | unsupported | out_of_scope | refine | clarify
  │      • FAIL-OPEN: any error → "data" with the original question
  │
  ├─ 2. INTENT DISPATCH (non-data intents short-circuit)
  │
  └─ 3. DATA PATH  (qa_agent/fast_pipeline.py)
         a. RETRIEVE   pgvector top-k + 1-hop FK neighbours + glossary +
                       relationships block                        [no LLM]
         b. SYNTH      ONE call → structured spec, catalog-validated
         c. EXECUTE    POST spec to the Node report generator (RLS/CLS)
         d. REPAIR     on error / 0 rows → re-synth, bounded at 2
         e. TAIL       chart plan, caption, confidence, assumptions, audit
```

> ### Example — the router's actual input and output
>
> Input:
> ```
> CONVERSATION SO FAR:
> 1. User asked: revenue by region last quarter
>
> LATEST USER MESSAGE:
> now just the top 5
> ```
> Output:
> ```json
> { "is_followup": true,
>   "question": "top 5 regions by revenue last quarter",
>   "intent": "data",
>   "topic": "", "mode": "", "correction_target": "", "correction_description": "",
>   "subtype": "", "action": "", "chart_type": "", "clarify_question": "" }
> ```
>
> Contrast — a message that shares the *topic* but is not a follow-up:
> ```
> LATEST USER MESSAGE: what was margin by region in 2023?
> → { "is_followup": false, "question": "what was margin by region in 2023?", "intent": "data" }
> ```
> It names its own subject, metric and window, so nothing is carried over. Carrying
> "last quarter" across would silently answer a different question.
>
> ### Example — each non-data intent
>
> | User says | Intent | Result |
> |---|---|---|
> | "what columns are in the orders table?" | `metadata` | Catalog answer, no source-DB hit |
> | "give me a Q3 sales report" | `report` | Narrative report URL |
> | "revenue should exclude cancelled orders" | `metric_correction` | old→new diff + Confirm dialog |
> | "hi" | `conversational` | Static greeting |
> | "email this to my manager" | `unsupported` | "I'm read-only and can't send email." |
> | "what's the capital of Chile?" | `out_of_scope` | Fixed decline |
> | "show that as a pie chart" | `refine` | Re-charts the previous result, **no re-query** |
> | "how are we doing?" | `clarify` | "Doing on what — revenue, orders, or margin?" |

### 9.3 Why a structured spec instead of raw SQL

The shipped path does **not** have the LLM write final SQL. It emits a validated JSON
spec that the Node BI report generator compiles into SQL.

- **Security** — SQL is generated by deterministic, audited BI code; execution runs
  the same path dashboards use, so RLS/CLS are preserved.
- **Correctness** — a spec is checkable field-by-field against the catalog before
  anything executes.
- **Capability honesty** — `UnsupportedQuestionError` when the generator cannot
  express the question, instead of silently producing something wrong.

> ### Example — the spec the LLM emits for our running question
>
> ```json
> {
>   "dimensions": [
>     { "table": "product", "schema": "retail", "column": "product_name",
>       "viewName": "Product", "dataType": "VARCHAR" }
>   ],
>   "measures": [
>     { "table": "order_line", "schema": "retail", "column": "line_amount",
>       "viewName": "Revenue", "aggregateFunction": "Sum" }
>   ],
>   "joins": [
>     { "leftTable": "order_line", "leftColumn": "order_id",
>       "rightTable": "sales_order", "rightColumn": "id", "joinType": "inner" },
>     { "leftTable": "order_line", "leftColumn": "prod_id",
>       "rightTable": "product", "rightColumn": "id", "joinType": "inner" }
>   ],
>   "filters": [
>     { "table": "sales_order", "column": "order_date", "operator": "BETWEEN",
>       "value": "2026-04-01", "valueTo": "2026-06-30" }
>   ],
>   "sort":  [ { "column": "Revenue", "direction": "desc" } ],
>   "limit": 5,
>   "customColumns": [], "having": [],
>   "unsupported": false, "unsupportedReason": null, "no_data": null, "clarify": null
> }
> ```
> Note the date filter: the prompt injects `CURRENT DATE (today): 2026-08-17
> (Monday)`, so "last quarter" resolves to concrete calendar dates rather than a
> placeholder like `<start_of_last_quarter>` or a year guessed from sample values.
>
> ### Example — the payload that spec becomes
>
> ```json
> POST <BI>/agent/getDataForDimMeasure
> {
>   "isReportFromCube": false,
>   "dimensions": [ { "columnName": "product_name", "viewColumnName": "Product",
>                     "queryTableName": "product", "tableName": "product",
>                     "tableSchema": "retail", "dataSourceId": 12,
>                     "reportFrom": "dataset", "isNewColumn": "no",
>                     "aggreagateFunction": "None", "colType": "VARCHAR",
>                     "columnType": "VARCHAR" } ],
>   "measures":  [ { "columnName": "line_amount", "viewColumnName": "Revenue",
>                    "tableName": "order_line", "tableSchema": "retail",
>                    "dataSourceId": 12, "aggreagateFunction": "Sum",
>                    "columnType": "DECIMAL" } ],
>   "joinRelations": [ { "leftTableName": "order_line", "leftColumnName": "order_id",
>                        "rightTableName": "sales_order", "rightColumnName": "id",
>                        "joinType": "inner",
>                        "leftCardinality": "M", "rightCardinality": "N" } ],
>   "sort": [ { "columnName": "Revenue", "direction": "desc" } ],
>   "filterObj": [ { "filters": [ { "table_name": "sales_order",
>                                   "column_name": "order_date",
>                                   "filter_operator": "BETWEEN",
>                                   "value": "2026-04-01", "valueTo": "2026-06-30" } ] } ],
>   "pageNo": 1, "pageSize": 5,
>   "userId": "13", "clientId": "44"
> }
> ```
> `aggreagateFunction` is spelled that way in the BI app — the client mirrors the
> real contract rather than "fixing" it. `leftCardinality: M / rightCardinality: N`
> defaults to many-to-many so the generator pre-aggregates each table and a join can
> never fan out a `SUM` — correctness first.
>
> ### Example — an honest refusal instead of wrong SQL
>
> Question: *"show the average of each store's best day"* — a multi-pass aggregate.
> ```json
> { "unsupported": true,
>   "unsupportedReason": "This needs an aggregate over the result of another aggregate (average of daily maximums), which the structured report cannot express.",
>   "dimensions": [], "measures": [], "joins": [], "customColumns": [] }
> ```
> The user gets that sentence, not a query that quietly computes something else.

### 9.4 Retrieval details

- Ranks tables by pgvector cosine; `DEFAULT_TOP_K_TABLES = 12`.
- **Near-duplicate suppression** at ≥0.70 column-name overlap, denominator
  `max(len(a), len(b))`.
- **Deprecated-twin tiebreak** — `_old` / `_bak` / `_archive` loses to the canonical
  name regardless of rank.
- **FK-aware expansion** — 1-hop neighbours of the seed tables, capped.
- **Relevance floor** — `RELEVANCE_MIN_TOP_SIMILARITY = 0.30`.
- **Metric-source augmentation** — tables a bound glossary metric needs are
  force-added.

> ### Example — what the retriever logs on a real question
>
> ```
> [qa 7f2a91c4] schema_retriever conn=50 VECTOR pool=1840 -> top_k_hits=12 ->
>   after_dedup=9 (top similarities: [(0.472, 'order_line'), (0.451, 'sales_order'),
>   (0.418, 'product'), (0.221, 'order_line_old'), (0.204, 'inventory_txn')])
> [qa 7f2a91c4] fk expansion: +1 table (customer) via order_line.customer_id
> ```
> Three things happened in that one line: `order_line_old` was dropped as a
> deprecated twin of `order_line` (0.96 column overlap), the slice fell from 12 to 9
> after dedup, and `customer` was added by FK expansion even though it ranked
> nowhere near the top.
>
> ### Example — the relevance floor firing
>
> ```
> question: "explain thermodynamics"
> top similarity: 0.111  → below 0.30 → refuse
> ```
> ```json
> { "kind": "irrelevant", "status": "success",
>   "message": "I couldn't find anything in this datasource related to that. This dataset covers sales orders, products, customers and inventory." }
> ```
> Without the floor, the top hit at 0.111 would still be *some* table and the model
> would answer confidently over it. Observed noise scores: a person's name 0.178,
> "thermodynamics" 0.111 — real topics land above 0.40.
>
> ### Example — one entry of the schema slice handed to the LLM
>
> ```json
> { "id": 812, "schema_name": "retail", "table_name": "order_line",
>   "role": "fact", "domain": "commerce", "row_count": 4820113,
>   "columns": [
>     { "name": "id",          "data_type": "BIGINT",        "is_primary_key": true,
>       "is_nullable": false, "sample_values": [1, 2, 3] },
>     { "name": "line_amount", "data_type": "DECIMAL(18,2)", "is_primary_key": false,
>       "is_nullable": false, "sample_values": ["1299.00", "450.00", "89.99"] }
>   ] }
> ```
> The sample values matter as much as the types: they are what let the model tell a
> numeric-looking `VARCHAR` from a real number, and what stop it summing a `String`
> column holding `08:30:00`.

### 9.5 The response envelope

Every answer — success or failure, every path — is built from one skeleton.
`schemaVersion` is currently **3**.

> ### Example — a full success envelope
>
> ```json
> {
>   "schemaVersion": 3, "status": "success", "kind": "answer",
>   "response": "SELECT p.product_name AS Product, SUM(ol.line_amount) AS Revenue …",
>   "queryId": "b2f0c9d1-6a4e-4a91-9f0e-2a7c8d5e1b33",
>   "traceId": "7f2a91c4", "durationMs": 3184,
>   "message": "", "question": "top 5 products by revenue last quarter",
>   "flags":    { "isInsight": false, "isIrrelevant": false,
>                 "limitInjected": true, "inlineData": false },
>   "followup": { "isFollowup": false, "rewrittenQuestion": "" },
>   "transparency": {
>     "tablesUsed": ["retail.order_line", "retail.product", "retail.sales_order"],
>     "assumptions": [ { "kind": "metric", "termName": "Revenue",
>                        "detail": "SUM(order_line.line_amount)" },
>                      { "kind": "window", "detail": "last quarter = 2026-04-01 to 2026-06-30" } ],
>     "ambiguities": [], "clarificationsOffered": []
>   },
>   "links": { "feedbackUrl": "https://…/agent/queries/b2f0…/feedback",
>              "inspectHtmlUrl": "https://…/agent/queries/b2f0…/inspect.html",
>              "clarifyEndpoint": "https://…/agent/connections/50/clarify",
>              "reportHtmlUrl": "", "htmlLink": "" },
>   "payload": {
>     "intent": "qa",
>     "result": { "columns": ["Product", "Revenue"],
>                 "rows": [["Ergonomic Chair", 4218900.00], ["Standing Desk", 3211400.00]],
>                 "rowCount": 5 },
>     "chart": { "type": "bar", "caption": "Ergonomic Chair led Q2 revenue at ₹4.2M…",
>                "component": "<ResponsiveContainer>…</ResponsiveContainer>",
>                "suggestions": [ {"type":"bar","label":"Bar chart","primary":true},
>                                 {"type":"table","label":"Table"} ] },
>     "confidence": { "label": "high", "score": 0.88,
>                     "signals": { "topSimilarity": 0.472, "repairAttempts": 0,
>                                  "qualifiedRatio": 1.0 } }
>   }
> }
> ```
>
> ### Example — an error envelope with the SAME keys
>
> ```json
> {
>   "schemaVersion": 3, "status": "error", "kind": "error",
>   "response": "", "queryId": "", "traceId": "9c31ba07", "durationMs": 812,
>   "message": "The query executed but the source database rejected it.",
>   "question": "revenue by widget",
>   "flags":    { "isInsight": false, "isIrrelevant": false,
>                 "limitInjected": false, "inlineData": false },
>   "followup": { "isFollowup": false, "rewrittenQuestion": "" },
>   "transparency": { "tablesUsed": [], "assumptions": [],
>                     "ambiguities": [], "clarificationsOffered": [] },
>   "links": { "feedbackUrl": "", "inspectHtmlUrl": "", "clarifyEndpoint": "",
>              "reportHtmlUrl": "", "htmlLink": "" },
>   "payload": {}
> }
> ```
> Identical key set. The frontend's `response.transparency.tablesUsed.length` never
> throws on an error path — which is exactly the bug the envelope was introduced to
> kill. `test_response_envelope.py` freezes these key sets.

---

## 10. Sub-agents and capabilities

### 10.1 Glossary agent — the semantic layer

A tool-calling agent with `list_tables`, `describe_table`, `get_distinct_values`,
`sample_rows`, `finalize_term`, proposing seven term types: acronym, filter, metric,
dimension, entity, synonym, join_path.

> ### Example — the agent's tool conversation during mining
>
> ```
> → list_tables()
> ← [{"table":"customer","role":"dimension","domain":"commerce","row_count":48210}, …]
> → describe_table("customer")
> ← columns: id, name, status, country, signup_date, last_order_date
> → get_distinct_values("customer", "status")
> ← ["ACTIVE", "INACTIVE", "SUSPENDED", "PROSPECT"]
> → sample_rows("customer", 3)
> ← [[1,"Acme Corp","ACTIVE","IN","2023-04-11","2026-07-02"], …]
> → finalize_term({ term: "Active Customer", term_type: "filter", … })
> ```
> The `get_distinct_values` call is the whole point: without it the model would
> invent `status = 'active'` (lowercase) and every query would return zero rows.
>
> ### Example — the term that gets persisted
>
> ```json
> { "term": "Active Customer", "term_type": "filter",
>   "aliases": ["active accounts", "live customers"],
>   "definition": "A customer whose status is ACTIVE.",
>   "column_refs": [ { "schema": "retail", "table": "customer", "column": "status" } ],
>   "filter_sql": "customer.status = 'ACTIVE'",
>   "source": "llm", "status": "proposed", "confidence_score": 0.78,
>   "rationale": "status has 4 distinct values; ACTIVE covers 61% of rows" }
> ```
> `status: "proposed"` and `source: "llm"` mark it a draft. A human confirming it
> flips `status` to `confirmed`, which earns it a **+0.10 retrieval rank boost**.
>
> ### Example — a metric term with a Tier-2 recipe (no SQL)
>
> ```json
> { "term": "Average Order Value", "aliases": ["AOV"], "term_type": "metric",
>   "recipe": { "aggregation": "ratio",
>               "ratio_numerator":   { "aggregation": "sum",
>                                      "value_columns": [{"table":"sales_order","column":"total_amount"}] },
>               "ratio_denominator": { "aggregation": "count_distinct",
>                                      "value_columns": [{"table":"sales_order","column":"id"}] },
>               "rounding": 2 },
>   "source": "human", "status": "confirmed" }
> ```
> No SQL string is stored. The agent turns the recipe into dims/measures and Node
> compiles the SQL — same reasoning as §9.3, one dialect problem eliminated.
>
> ### Example — how the glossary reaches the prompt
>
> ```
> BUSINESS GLOSSARY (use these definitions verbatim):
> - Active Customer [filter] — aka active accounts, live customers
>     Definition: A customer whose status is ACTIVE.
>     Columns: retail.customer.status
>     Filter SQL: customer.status = 'ACTIVE'
> - Revenue [metric]
>     Definition: Net sales value of order lines.
>     Source tables: retail.order_line
>     Grain: one row per order line
> ```
>
> ### Example — the approximate-match guard
>
> The user asks about *"VIP customers"*; the glossary only has *"VVIP"*. The term is
> injected, but flagged:
> ```
> - VVIP [filter]
>     [APPROXIMATE MATCH] you asked "VIP" but this term's name is "VVIP" — matched by
>     meaning, NOT a direct name hit. Do NOT assume they mean the same thing. Before
>     using this recipe, confirm the meaning; if "VIP" could be a literal value in a
>     column, verify with run_query (SELECT DISTINCT …) first; if you cannot confirm
>     it, call ask_clarification instead of guessing.
> ```
> This is what stops a VIP question silently answering with the VVIP definition.
>
> ### Example — conversational editing
>
> ```json
> POST /agent/connections/50/glossary/331/edit-nl
> { "instruction": "Active customer should also require an order in the last 90 days" }
>
> → { "diff": {
>       "old": { "filter_sql": "customer.status = 'ACTIVE'" },
>       "new": { "filter_sql": "customer.status = 'ACTIVE' AND customer.last_order_date >= CURRENT_DATE - INTERVAL 90 DAY" } },
>     "confirmEndpoint": "/agent/connections/50/glossary/331/edit-nl/confirm" }
> ```
> Nothing is written until confirm. The previous version is kept in
> `previous_versions`, so `/revert` restores it.

### 10.2 KPI / dashboard agent

The agent explores the live database through tools and emits finalized KPI SQL. The
runner **re-executes each KPI under a row cap and statement timeout**, asks the chart
picker for a Vega-Lite spec from the real result shape, and persists KPI + value +
chart. There is deliberately **no template fallback**.

> ### Example — a proposed KPI as stored
>
> ```json
> { "template_id": "agentic", "name": "Revenue — last 30 days",
>   "category": "commerce", "section": "key_metric_highlights",
>   "sql_text": "SELECT SUM(line_amount) AS value FROM retail.order_line ol JOIN retail.sales_order so ON ol.order_id = so.id WHERE so.order_date >= CURRENT_DATE - INTERVAL 30 DAY",
>   "base_table": "retail.order_line", "measure_column": "line_amount",
>   "aggregation": "Sum", "date_column": "order_date",
>   "filter_sql": null, "cadence_minutes": 1440,
>   "last_value": { "value": 18422900.5 }, "last_computed_at": "2026-08-17T04:10:22Z" }
> ```
> The structured metadata (`base_table` / `measure_column` / `aggregation` /
> `date_column`) is what lets the narrative report **re-measure** this KPI under a
> different window instead of replaying its frozen SQL.
>
> ### Example — why `filter_sql` exists
>
> A KPI "E-Commerce Revenue" carries `filter_sql: "channel = 'E-Commerce'"`.
> Re-measuring it *without* that scope would sum all channels — producing a subset
> KPI **larger than its parent total** in the same report. That was a real defect;
> the column is the fix.
>
> ### Example — the runner's guard rails
>
> ```python
> MAX_ROWS     = constants.KPI_QUERY_MAX_ROWS
> MAX_SECONDS  = constants.KPI_QUERY_TIMEOUT_SECONDS
> execute(engine, kpi.sql_text, engine_type, timeout_seconds=MAX_SECONDS)
> ```
> A model-written `SELECT` over a 4.8M-row fact with a bad join cannot hold a
> connection open indefinitely — it is killed at the timeout and that one tile fails
> while the rest of the dashboard builds.

### 10.3 Narrative report agent

`narrative_builder.py` produces a multi-section report honouring the UI's filters.
The time window is translated into the BI app's `filterObj` and threaded through
every query; "compare against" re-runs the same queries over the prior window;
structured KPIs are re-measured rather than replayed.

> ### Example — the request and what it changes
>
> ```json
> POST /agent/connections/12/narrative-report
> { "tenantId": "44", "userId": "13", "envName": "prod",
>   "topicId": 4, "timePeriodRange": "last_quarter",
>   "timeComparison": "previous_period",
>   "sections": ["key_metric_highlights", "charts", "anomalies"] }
> ```
> `last_quarter` becomes:
> ```json
> "filterObj": [ { "filters": [ { "table_name": "sales_order", "column_name": "order_date",
>                                 "filter_operator": "BETWEEN",
>                                 "value": "2026-04-01", "valueTo": "2026-06-30" } ] } ]
> ```
> and the comparison pass re-runs everything with `2026-01-01 → 2026-03-31`.
>
> ### Example — a headline KPI with a delta
>
> ```
> Revenue            ₹18.4M   ▲ 12.3% vs Jan–Mar
> Orders             14,208   ▲  4.1%
> Average Order Value ₹1,296   ▲  7.9%
> ```
> These numbers are re-measured under the window, not read from
> `agent_kpi.last_value` — which is an all-time figure and would be wrong here.
>
> ### Example — plan snapshot hit vs miss
>
> ```
> MISS: retrieve slice (embed + vector) 0.9s → plan questions (LLM) 4.2s →
>       extract specs (LLM) 3.1s → measure 6.0s   total ≈ 14.2s
> HIT:  snapshot read 0.05s → measure 6.0s        total ≈ 6.1s
> ```
> The snapshot is keyed `(connection_id, template, audience_key)` and carries
> `plan_version`. Bumping `PLAN_SNAPSHOT_VERSION` makes every stored row read as a
> miss, so a prompt change can never be served from a stale plan.

### 10.4 Visualization agent

One LLM call returns the best chart, ranked alternatives, and the caption. Never
raises — falls back to a table plan.

> ### Example — the chart plan
>
> ```json
> { "primary": { "type": "bar", "label": "Bar chart",
>                "rationale": "5 categories against one numeric measure" },
>   "alternatives": [ { "type": "table", "label": "Table", "rationale": "exact values" },
>                     { "type": "pie",   "label": "Pie chart", "rationale": "share of total" } ],
>   "caption": "Ergonomic Chair led Q2 revenue at ₹4.2M, 31% ahead of Standing Desk." }
> ```
>
> ### Example — the high-cardinality guard
>
> ```
> plan says: bar   |   row_count = 512
> _filter_high_cardinality → CHART_MAX_BAR_CATEGORIES = 30 exceeded → downgrade to table
> ```
> A 512-bar chart is unreadable; the guard is deterministic rather than trusting the
> model to count rows.
>
> ### Example — `refine` reuses the cached result
>
> ```json
> POST /agent/queries/b2f0c9d1…/chart   { "chartType": "pie" }
> ```
> The rows are fetched from the runtime result cache by `queryId`. **No SQL is
> re-run** — switching chart type must never re-hit the source database.

### 10.5 Document agent (RAG over uploaded files)

Read → understand → embed → route, resumable, one job per document, SHA-256
duplicate detection per connection, S3-backed.

> ### Example — upload to citation
>
> ```json
> POST /agent/connections/50/documents
> { "batchId": "b-77", "files": [ { "filename": "Data Dictionary v3.pdf",
>                                   "storageRef": "tenant44/ds12/dd-v3.pdf",
>                                   "docKind": "data_dictionary" } ] }
> → { "documentIds": [ 41 ], "status": "pending" }
> ```
> ```json
> GET /agent/documents/41/status
> → { "status": "ready", "lastCompletedStage": "embed", "pageCount": 22,
>     "extractedSummary": "Column-level dictionary for the retail schema; defines
>                          order status codes and the channel taxonomy." }
> ```
> A resulting chunk:
> ```json
> { "document_id": 41, "chunk_index": 7,
>   "content": "STATUS CODES — O: open, S: shipped, X: cancelled, R: returned.",
>   "source_locator": { "page": 4 }, "token_estimate": 38 }
> ```
> Now *"how many cancelled orders last month?"* can bind `X` instead of guessing
> that `'cancelled'` is stored literally.
>
> ### Example — an unverifiable FK from a document is parked, not applied
>
> ```json
> // agent_document.pending_proposals
> [ { "kind": "foreign_key", "from": "shipment.order_ref", "to": "sales_order.id",
>     "source": "ER diagram page 2",
>     "reason": "source DB unreachable at ingest — probe not run" } ]
> ```
> A drawing is a claim, not evidence. It becomes an edge only after the live probe
> passes or a human confirms it via `/documents/41/proposals/confirm`.

### 10.6 Questionnaire — "AI Setup"

Three tiers: **Common** (global YAML), **Domain** (selected by function + industry),
**Schema** (generated per connection, cached, regenerated on catalog-hash drift).

> ### Example — one question from each tier
>
> ```yaml
> # Tier 1 — common, identical for every customer
> - id: common.fiscal_year_start_month
>   kind: choice
>   prompt: "Which month does your fiscal year start?"
>   choices: [January, April, July, October]
>   default: January
> ```
> ```yaml
> # Tier 2 — domain, offered when function = sales
> - id: sales.active_customer_window_days
>   kind: number
>   prompt: "How many days without an order before a customer is no longer 'active'?"
>   default: 90
> ```
> ```json
> // Tier 3 — schema, generated from THIS catalog
> { "question_id": "ai.col.customer.status", "kind": "text", "target": "column",
>   "prompt": "customer.status holds A, I, S and P. What does P mean?",
>   "prefill": "Prospect", "anchor": "customer.status", "rule": "R3",
>   "confidence_score": 0.82, "impact": 0.7, "score": 0.57,
>   "evidence": { "distinct_values": ["A","I","S","P"], "row_share": {"P": 0.07} },
>   "catalog_hash": "8c1f42ab" }
> ```
> Tier 3 is a **confirm**, not an interrogation — note the `prefill` with the AI's
> own guess.
>
> ### Example — answer precedence
>
> ```
> question: common.fiscal_year_start_month
> per-source answer (agent_questionnaire_answer)  : April      ← wins
> org-common answer (agent_org_common_answer)     : January
> standard default (templates.yaml)               : January
> ```
> And `is_default` separates *"we guessed"* from *"they told us"* on the readiness
> meter — an untouched default never counts as configured.

---

## 11. GenAI engineering patterns used

| # | Pattern | Where |
|---|---|---|
| 1 | RAG over schema metadata | `catalog/vector_index.py`, `qa_agent/schema_retriever.py` |
| 2 | Hybrid retrieval — exact → fuzzy → cosine | `glossary_agent/retriever.py` |
| 3 | Structured output over free-form text | `qa_agent/structured_synth.py` |
| 4 | Tool-calling agents | glossary / KPI / FK proposers, `agent_loop.py` |
| 5 | LLM proposes, deterministic code disposes | FK overlap gate, catalog validation |
| 6 | Bounded self-repair on real errors | `fast_pipeline._execute_with_repair` |
| 7 | Error messages engineered for the model | `safety_gate.validate` |
| 8 | Single-call multi-task prompting | `router.py`, `chart_picker.py` |
| 9 | Fail-open routing | `router.classify` |
| 10 | Refuse rather than fabricate | relevance floor + three typed exceptions |
| 11 | Clarify instead of guess | `structured_synth`, `/clarify` |
| 12 | Memory as rewrite, not context stuffing | `router.py`, `qa_agent/followup.py` |
| 13 | Pre-computed, version-gated plan snapshots | `report_agent/plan_snapshot.py` |
| 14 | Deterministic embedding cache | `vector_index._embed_cache` |
| 15 | Confidence scoring | `qa_agent/confidence.py` |
| 16 | Per-request token accounting | `qa_agent/llm.py` |
| 17 | Full LLM call-trace + inspect viewer | `debug_trace.py`, `observability/ai_log_store.py` |
| 18 | Model-compatibility shim | `llm_compat.py` |
| 19 | Human-readable progress beats | `runtime/progress_store.py` |
| 20 | Every threshold a named constant | `constants.py` (~1,400 lines) |

> ### Example — pattern 8, one call doing two jobs
>
> Two calls would cost ~1.4s extra and can disagree. One call cannot:
> ```json
> { "is_followup": true, "question": "top 5 regions by revenue last quarter",
>   "intent": "data" }
> ```
> The rewrite and the classification are produced from the same reasoning pass, so
> the router can't rewrite into a data question and simultaneously label it `report`.
>
> ### Example — pattern 15, the confidence score
>
> ```python
> confidence.score(top_similarity=0.472, repair_attempts=0, sql=safe_sql)
> # qualified_ratio = 1.0 (every column reference is table.column)
> # → {"score": 0.88, "label": "high",
> #    "signals": {"topSimilarity": 0.472, "repairAttempts": 0, "qualifiedRatio": 1.0}}
> ```
> A second question scoring `top_similarity=0.31, repair_attempts=2,
> qualified_ratio=0.4` lands at `label: "low"` — and the UI can warn instead of
> presenting it identically.
>
> ### Example — pattern 16, the token tally in the audit plan
>
> ```json
> "llm": { "calls": 3, "promptTokens": 6142, "completionTokens": 588,
>          "totalTokens": 6730,
>          "byDeployment": { "gpt-4.1": 3 } }
> ```
> Thread-local, reset at the start of each `/ask`, so concurrent requests never mix
> counters.

---

## 12. Safety, security and governance

### 12.1 The sqlglot safety gate

1. Reject empty SQL.
2. Forbidden-substring scan: `into outfile`, `load_file(`, `xp_cmdshell`,
   `sp_executesql`, `pg_sleep(`, `benchmark(`, `sleep(`.
3. Parse with sqlglot at the target dialect.
4. Top level must be `Select`, `With`, or a set operation.
5. Walk the whole tree rejecting `Insert`/`Update`/`Delete`/`Create`/`Drop`/`Alter`/
   `TruncateTable`/`Merge`/raw `Command`.
6. Table allow-list from the retrieved slice.
7. Column-existence check with alias + CTE-alias resolution.
8. PII-in-projection check.
9. Inject a dialect-correct row cap when no LIMIT is present.

> ### Example — five rejections, verbatim
>
> ```sql
> SELECT * FROM users; DROP TABLE users
> ```
> → `forbidden statement: Drop`
>
> ```sql
> SELECT * INTO OUTFILE '/tmp/dump.csv' FROM customer
> ```
> → `forbidden token: into outfile` — caught before parsing even runs
>
> ```sql
> SELECT benchmark(50000000, md5('x'))
> ```
> → `forbidden token: benchmark(`
>
> ```sql
> SELECT Unit_Price, Prod_Name FROM order_line
> ```
> → `2 column(s) do not exist on the tables this query reads (['order_line']):
> `Unit_Price` on table `order_line` (did you mean: Unit Price?); `Prod_Name`
> (not on any FROM/JOIN table) (did you mean: product_name?). Use exact column names
> from the catalog. For EACH one, either reference the table that actually has it
> (JOIN that table in if needed) or drop the column. Fix ALL of them in a single
> corrected query.`
>
> ```sql
> SELECT email, name FROM customer
> ```
> → ``column `email` is sensitive (PII/financial/health). Aggregate it (e.g. COUNT,
> COUNT DISTINCT) instead of selecting raw values.``
>
> ### Example — the row cap injection, per dialect
>
> ```sql
> -- in
> SELECT product_name, SUM(line_amount) FROM order_line GROUP BY product_name
>
> -- out (MySQL / Postgres)
> SELECT product_name, SUM(line_amount) FROM order_line GROUP BY product_name LIMIT 1000
>
> -- out (T-SQL, set operation wrapped)
> SELECT TOP 1000 * FROM (SELECT … UNION ALL SELECT …) AS _
> ```
> `flags.limitInjected: true` tells the UI to show "showing first 1,000 rows".
>
> ### Example — what PII blocking allows vs blocks
>
> ```sql
> -- ALLOWED: email only filters rows
> SELECT COUNT(DISTINCT email) FROM customer WHERE email LIKE '%@acme.com'
> -- ALLOWED: aggregated
> SELECT country, COUNT(*) FROM customer GROUP BY country
> -- BLOCKED: raw PII in the projection
> SELECT c.email FROM customer c JOIN sales_order o ON o.customer_id = c.id
> ```
> Alias resolution is why the third case is caught: `c.email` resolves back to
> `customer.email` before the check runs.
>
> ### Example — the parse-failure fallback, and where it fails closed
>
> ```
> safety_gate sqlglot parse failed (Invalid expression / Unexpected token) —
>   falling back to lenient string checks; AST column/PII checks skipped
> safety_gate ACCEPT (lenient parse-fallback) dialect=clickhouse limit_injected=True
> ```
> Same query, but the schema has PII columns:
> ```
> safety_gate REJECT (lenient) cannot verify PII safety without a parseable AST;
>   schema has 3 PII-bearing table(s)
> → "could not parse SQL to verify sensitive-column safety"
> ```
> Availability degrades; confidentiality does not.

### 12.2 Multi-tenancy and access control

Identity is the 4-tuple; `/ask` enforces tenant **and** user ownership; execution
runs through the BI app so RLS/CLS are applied by the system that already owns them.

> ### Example — the 403
>
> ```json
> POST /agent/ask  { "dataSourceId": 12, "tenantId": "91", "userId": "13", … }
> // connection 50 belongs to tenant 44
> → 403 { "status": "error", "message": "This datasource does not belong to the caller." }
> ```
>
> ### Example — the headers that carry identity to the executor
>
> ```
> POST <BI>/agent/getDataForDimMeasure
> x-api-app-id:     <app id>
> x-api-secret-key: <secret>
> x-api-user-id:    13
> x-client-id:      44
> ```
> The BI backend resolves `user_profile.id` from those headers and applies its own
> row/column filters — the agent never sees, and never needs, the RLS rules.

### 12.3 Data-handling posture

> ### Example — what a stored chat turn actually contains
>
> ```json
> { "id": "…", "conversation_id": "c_…",
>   "question": "top 5 products by revenue last quarter",
>   "answer": "Ergonomic Chair led Q2 revenue at ₹4.2M…",
>   "generated_sql": "SELECT p.product_name …",
>   "dim_measure_spec": { "dimensions": [...], "measures": [...] },
>   "chart_spec": { "type": "bar", "component": "…", "columnTypes": {…} },
>   "inline_result": null }
> ```
> **`rows` is absent.** Reopening the thread POSTs `dim_measure_spec` back through
> the BI path to regenerate them — so a user who has since lost access to some rows
> does not see them on reload.
>
> ### Example — encrypted config and log redaction
>
> ```ini
> [CatalogDB]
> PG_USER     = datanyx_agent
> PG_PASSWORD = ~gAAAAABmZk9s3Q2X…      ; '~' marks ciphertext, decrypted at read
> ```
> ```
> onboarding start conn=50 details={'engine': 'MYSQL', 'host': 'db.acme.internal',
>   'user': '***', 'password': '***', 'database': 'retail'}
> ```

---

## 13. Performance engineering

| Technique | Detail |
|---|---|
| Vector search in the database | pgvector `<=>` + HNSW — ordering and top-k in Postgres |
| Query-embedding cache | 512-entry LRU keyed by `(sha256(text), deployment)`; deterministic; pre-warmed at boot |
| Question cache | `(connection_id, normalized question)` → schema slice; 300s TTL, 256 entries; invalidated by `/refresh` |
| Metadata cache | 30-min TTL, 256 entries, for catalog-only answers |
| Plan snapshots | Report retrieval + planning + extraction pre-computed at onboarding |
| Background warm-up | Catalog engine + schema warmed off-thread at boot |
| Parallelism | Thread pools for profiling, dashboard tiles (4), report pre-work, clarification batches (6) |
| Prompt budgets | Glossary 4000, few-shot 2400, tool results row-capped, metadata char-capped |
| Context compaction | Only the last 3 tool results kept in full |
| SSE transport | 15s heartbeats |
| Spark profiler | Auto for Databricks or tables >100M rows |

> ### Example — the caches on a real session
>
> ```
> 10:02:11 schema_retriever conn=50 VECTOR pool=1840 -> top_k_hits=12 -> after_dedup=9
> 10:02:11 embedding cache MISS ("revenue by region") — 210ms embed call
> 10:04:48 schema_retriever conn=50 CACHE hit — 9 tables (skipped embed+cosine)
> 10:06:02 embedding cache HIT  ("revenue by region")  — 0ms
> ```
> The 10:04 line is the question cache (same question inside 300s). The 10:06 line
> is the embedding cache surviving a question-cache expiry.
>
> ### Example — why the embedding cache is safe but the question cache needs a TTL
>
> ```
> embed("revenue by month") → always the same 1536 floats  → cache forever, keyed by hash
> retrieve("revenue by month") → depends on the CATALOG, which /refresh can change
>                              → 300s TTL + explicit invalidation
> ```
>
> ### Example — the progress beats the UI polls
>
> ```json
> GET /agent/progress/req-7f2a91c4
> → { "message": "Unpacking what you need", "at": "2026-08-17T10:02:11Z" }
> → { "message": "Polishing the insight",    "at": "2026-08-17T10:02:14Z" }
> ```
> Concrete steps rather than an indeterminate spinner.

---

## 14. Reliability engineering

> ### Example — fail-open in three places
>
> ```
> router LLM call failed: Read timed out.        → intent=data, original question, answer still produced
> fast glossary retrieve failed: connection reset → glossary_terms=[], answer still produced
> fast relationships block failed: …             → relationships_block="", answer still produced
> ```
> Each of these degrades quality. None of them returns a 500.
>
> ### Example — 0 rows treated as a soft signal
>
> ```
> attempt 1: filter status = 'cancelled'  → 0 rows
>            re-synth with "the query executed but returned 0 rows"
> attempt 2: filter status = 'X'          → 218 rows   ✓
> ```
> If attempt 2 had also returned 0, the pipeline returns the 0-row result as a
> legitimate answer rather than an error — "no cancelled orders last month" is a
> real finding.
>
> ### Example — the reloader trap
>
> ```
> RuntimeError: cannot schedule new futures after interpreter shutdown
> ```
> That is Werkzeug's watchdog killing the process mid-onboarding. The default is
> `use_reloader=False`; `AGENT_SERVICE_RELOAD=1` opts back in for sqlService-only
> development.

---

## 15. Configuration and secrets

`config.get(section, key)` checks the **environment first**, then the file, and
**auto-decrypts** `~`-prefixed values. Files are **layered** lowest-to-highest:
`agentService/` → repo root → deploy root → `AGENT_CONFIG_PATH`.

> ### Example — the layering resolving one key
>
> ```
> agentService/ConfigFile.properties   [OpenAI] DEPLOYMENT_NAME = gpt-4o
> /opt/datanyx-ai-service/ConfigFile.properties
>                                      [OpenAI] DEPLOYMENT_NAME = gpt-4.1   ← wins
> env AGENT_ENV=PROD
> ```
> Boot log:
> ```
> config provenance: [OpenAI].DEPLOYMENT_NAME  <- /opt/datanyx-ai-service/ConfigFile.properties
> config provenance: [CatalogDB].PG_HOST       <- env
> ```
> Deployment overrides a single key without maintaining a full copy of the file, and
> the provenance line means a misplaced config file is obvious at startup rather
> than three hours into debugging.
>
> ### Example — catalog credential resolution order
>
> ```
> 1. env PG_HOST/PG_USER/…                       (not set)
> 2. BI backend /getCatalogDbCredentials?env=PROD  ✓ used
> 3. ConfigFile.properties [CatalogDB]
> 4. localhost defaults
> → cached for the process lifetime  (restart to pick up a rotation)
> ```

---

## 16. API surface

67 routes on the `/agent` blueprint.

| Group | Representative endpoints |
|---|---|
| Connections / onboarding | `POST /connect`, `GET /connections/by-datasource/{id}`, `POST /connections/status-batch`, `GET /connections/{id}/status`, `POST /connections/{id}/refresh`, `GET /connections/{id}/tables` |
| Chat | `POST /ask`, `POST /ask/stream`, `GET /progress/{requestId}`, `POST /queries/{id}/feedback`, `POST /queries/{id}/chart`, `GET /queries/{id}/inspect.html` |
| Conversations | `POST/GET /conversations`, `GET/PATCH/DELETE /conversations/{id}`, `POST /conversations/{id}/messages/{mid}/render` |
| Glossary | CRUD, `/glossary/resolve`, `/mine`, `/embed`, `/rebuild`, `/{id}/edit-nl` + `/confirm`, `/propose-nl`, `/{id}/revert`, `POST /connections/{id}/clarify` |
| Dashboards | `GET/POST /connections/{id}/dashboard`, `/dashboard-templates`, `GET/PATCH/DELETE /dashboards/{id}`, `/refresh`, `/data`, `/status` |
| Reports | `POST /connections/{id}/narrative-report` (+ `/stream`), `GET /report-topics`, `GET/PUT/DELETE /reports/{id}`, `POST /report-draft` |
| Documents / context | `POST /connections/{id}/documents`, `GET/DELETE/PATCH /documents/{id}`, `/reingest`, `/proposals(/confirm|/reject)`, `GET /batches/{id}/status` |
| Questionnaire | `GET /datasources/{id}/questionnaire` (+ `/progress`), `POST /answers`, `GET/POST /org/common(/answers)` |

Plus root-level sqlService routes: `POST /ask`, `POST /mongoquery`,
`POST /process_chart_template`, `GET /health`.

> ### Example — the minimal integration, four calls
>
> ```
> 1. POST /agent/connect                        → connectionId, onboarding starts
> 2. GET  /agent/connections/50/status          → poll until "ready"
> 3. POST /agent/ask                            → every chat turn
> 4. POST /agent/queries/{queryId}/chart        → user switches chart type
> ```
> Everything else — glossary, dashboards, reports, documents, questionnaire — is
> additive surface on top of those four.

---

## 17. Testing

94 pytest files (~16,600 lines). The LLM (`_ScriptedClient`) and Node/source-DB calls
are stubbed, so the suite runs with no external services.

> ### Example — a stubbed-LLM router test
>
> ```python
> def _llm(payload):
>     text = payload if isinstance(payload, str) else json.dumps(payload)
>     return lambda *a, **k: text
>
> def test_followup_rewrite_applied():
>     v = router.classify("now just the top 5",
>                         [{"question": "sales by region"}],
>                         _llm({"is_followup": True,
>                               "question": "top 5 regions by sales",
>                               "intent": "data"}))
>     assert v.is_followup is True
>     assert v.question == "top 5 regions by sales"
> ```
> The assertion is about **our** parsing and degradation logic, not the model's
> judgement — which is the only part that is deterministic enough to unit test.
>
> ### Example — the contract test that keeps the envelope total
>
> ```python
> TOP_LEVEL_KEYS = {"schemaVersion","status","kind","response","queryId","traceId",
>                   "durationMs","message","question","flags","followup",
>                   "transparency","links","payload"}
>
> def _assert_skeleton(env):
>     assert set(env) == TOP_LEVEL_KEYS, set(env) ^ TOP_LEVEL_KEYS
>     assert set(env["flags"]) == FLAGS_KEYS
>     assert env["schemaVersion"] == resp.SCHEMA_VERSION
> ```
> Adding a key without bumping `SCHEMA_VERSION` fails the build.
>
> ### Example — a fail-open test
>
> ```python
> def test_followup_flag_but_blank_rewrite_keeps_original():
>     v = router.classify("why?", [{"question": "x"}],
>                         _llm({"is_followup": True, "question": "   ", "intent": "data"}))
>     assert v.is_followup is False
>     assert v.question == "why?"
> ```
> The model claimed a rewrite and returned whitespace. The verdict degrades cleanly
> instead of sending an empty question down the pipeline.
>
> ```bash
> python -m pytest agentService/tests/
> python -m pytest agentService/tests/test_fk_inference.py
> python -m pytest agentService/tests/test_agent_qa.py::test_run_query_rejects_non_select
> ```

---

## 18. Running and deploying

```bash
python -m venv .venv && .\.venv\Scripts\activate     # Windows
pip install -r requirements.txt                      # merged deps for BOTH services
python api.py                                        # everything on :5000
```

> ### Example — the boot sequence in `api.py`
>
> ```python
> logging.basicConfig(level=logging.INFO, stream=sys.stdout, force=True)  # 1. win the logging config
> sys.path.insert(0, _SQL_DIR); sys.path.insert(0, _REPO_ROOT)            # 2. both services importable
> os.chdir(_SQL_DIR)                                                      # 3. sqlService reads cwd-relative
> app.register_blueprint(agent_bp)                                        # 4. /agent/* on the same port
> start_background_init()                                                 # 5. warm the catalog off-thread
> app.run(host="0.0.0.0", port=5000, use_reloader=False)
> ```
> `force=True` matters because `instance_conversation`, `data_connections` and
> `chartTemplateProcessor` each call `basicConfig()` at import with no format.
> Without it, whichever imported first would win and request logs would lose their
> timestamps.
>
> ### Example — the two run modes
>
> ```bash
> python api.py                       # :5000 — sqlService + /agent/*
> cd agentService && python api.py    # :5001 — /agent/* only, same Blueprint object
> curl localhost:5001/health          # {"status":"healthy","mode":"agent-standalone"}
> ```

---

## 19. Key design decisions and trade-offs

| Decision | Why | Trade-off accepted |
|---|---|---|
| Structured spec instead of LLM-written SQL | RLS preserved; spec is validatable | Some constructs unexpressible → explicit refusal |
| pgvector in the catalog DB | One datastore, transactional consistency | Vector search shares Postgres' availability |
| In-process thread pool | No extra infra until load demands it | Jobs die with the process — mitigated by checkpoints + sweeps |
| In-memory caches | Deterministic keys make correctness trivial | Lost on restart, not shared across instances |
| No dashboard template fallback | A plausible-but-wrong dashboard is worse than none | LLM outage = no dashboard |
| Lenient gate on parse failure | Hard-rejecting valid ClickHouse burns the repair budget | Weaker static guarantees — mitigated by failing closed on PII |
| Relevance floor at 0.30 | Vector search never returns empty, so silence needs a floor | May refuse a niche legitimate question |
| Credentials cached per process | Avoids a backend round trip per request | Restart after rotation (documented) |
| Soft deletes with stable ids | Re-detection keeps ids so saved artifacts resolve | Rows accumulate |
| Audit log currently disabled | Callers unchanged — `record()` still mints a query id | Few-shot and SQL-mining have no history |

> ### Example — the trade-off you can feel
>
> Question: *"list the email address of every customer who churned"*.
> The PII guard blocks raw `email` in the projection. The user gets:
> > *"`email` is sensitive. I can give you the count, or a breakdown by country or
> > plan — but not the raw list."*
>
> That is genuinely less useful than the answer they asked for. It is also the
> correct behaviour, and it is the trade-off the design chose on purpose.

---

## 20. Known limitations and roadmap

- **Audit / query log is a no-op** since the ClickHouse store was removed —
  re-enabling restores few-shot example selection and glossary mining from history.
- **`sqlService` has no automated tests.**
- **Caches are per-process**, so a multi-instance deployment has a lower hit rate.
- **Dry-run (EXPLAIN) validation is built but not wired** into `/ask`.
- **The `route` stage of document ingestion is partially stubbed** (Phase 2).
- **No per-tenant spend ceiling** yet — token budgets exist, spend limits don't.

> ### Example — the dry-run helper that is deliberately unused
>
> ```python
> res = safety_gate.dry_run(sql, engine, dialect="mysql", strategy="auto")
> # DryRunResult(ok=False, strategy_used="explain",
> #              error="Unknown column 'ol.prod_id' in 'field list'")
> ```
> It works and it is tested. It is not in `/ask` because adding a round trip to
> every question is a latency-versus-value decision for product, not engineering —
> so the helper ships standalone and callers opt in.

---

## 21. Resume bullets you can use

- Built a production **GenAI conversational-BI backend** (Python/Flask, Azure OpenAI,
  pgvector) that autonomously onboards an unfamiliar customer database — schema
  introspection, column profiling, foreign-key inference, LLM domain classification,
  glossary mining and vector indexing — across an 11-stage resumable pipeline.
- Designed a **RAG text-to-analytics pipeline** over a 1536-dimension pgvector index
  with hybrid retrieval, FK-graph slice expansion, near-duplicate table suppression
  and a cosine relevance floor that makes the agent refuse off-topic questions
  instead of fabricating answers.
- Replaced free-form LLM SQL generation with a **validated structured analytics spec**
  executed through the BI platform's RLS-preserving engine, eliminating a class of
  injection and data-leak risk while keeping row/column security intact.
- Implemented a **sqlglot AST safety gate** (read-only enforcement, table/column
  allow-lists with `did-you-mean` repair hints, PII-in-projection blocking, automatic
  row caps) plus a bounded self-repair loop fed by real execution errors.
- Built **tool-calling LLM agents** for glossary mining and KPI generation whose every
  proposal is gated by deterministic verification — live value-overlap probes,
  catalog validation, SQL deny-lists.
- Cut latency with a **deterministic query-embedding cache, TTL question cache and
  pre-computed report plan snapshots**, and eliminated gateway timeouts by moving
  long questions to an SSE streaming endpoint with heartbeats.
- Shipped a **conversational semantic layer**: users correct metric definitions in
  plain English, review an old→new diff, and the change is versioned, revertible and
  live on the next question.
- Delivered **67 REST endpoints** and **94 pytest suites** with fully stubbed LLM and
  database dependencies, plus per-request token accounting and a full LLM call-trace
  viewer.

> ### Example — how to defend one bullet when challenged
>
> **Interviewer:** *"'Eliminating a class of data-leak risk' — how, specifically?"*
>
> **You:** *"Two mechanisms. First, the agent never sends SQL to the source database
> on the main path — it sends a spec to the BI backend, which compiles the SQL and
> applies its existing row- and column-level security using the user id in the
> request headers. So a sales rep's question can't return another region's rows even
> if the model asked for them. Second, columns profiled as PII can't appear raw in a
> SELECT projection — the AST gate rejects them unless they're inside an aggregate.
> `SELECT COUNT(DISTINCT email)` passes; `SELECT email` doesn't."*

---

## 22. Glossary

| Term | Meaning here |
|---|---|
| **Catalog DB** | The agent's own Postgres+pgvector store — never a customer's database |
| **Source DB** | The customer database being analysed, read-only |
| **Connection** | A registered datasource, identified by `(tenant, user, dataSourceId, env)` |
| **Schema slice** | The top-k tables retrieved for one question, plus FK neighbours |
| **Spec / dim-measure spec** | The structured JSON analytics request that replaces raw SQL |
| **Node / BI app** | The separate BI backend that compiles specs to SQL and executes with RLS |
| **Glossary term** | A business concept bound to schema (acronym, filter, metric, dimension, entity, synonym, join_path) |
| **Recipe** | A structured, SQL-free computation definition for a metric |
| **Plan snapshot** | Pre-computed, window-independent report plan cached at onboarding |
| **Relevance floor** | Minimum cosine similarity (0.30) below which the agent refuses |
| **Envelope** | The canonical `/ask` response shape, `schemaVersion 3` |
| **Transparency block** | Tables used, assumptions, ambiguities and offered clarifications, returned with every answer |

> ### Example — the same concept in three vocabularies
>
> | Layer | What "revenue" is |
> |---|---|
> | Business user | "revenue", "net sales", "topline" |
> | Glossary term | `Revenue [metric]`, aliases `["net sales"]`, grain "one row per order line" |
> | Physical schema | `retail.order_line.line_amount`, `DECIMAL(18,2)`, sensitivity `financial` |
>
> The glossary layer is what connects the first row to the third. Remove it and the
> model has to guess — and `sales_order.total_amount` (which includes tax and
> shipping) is right there, one plausible guess away.
