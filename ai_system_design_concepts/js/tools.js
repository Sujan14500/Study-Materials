/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: vector indexes ---------- */
C.toolstrips.annindex = {
  title: 'Tools & frameworks — vector indexes',
  sub: 'Below roughly a hundred thousand vectors you do not need any of these. Above it, the choice is scale against operational burden.',
  tools: [
    { n: 'pgvector', by: 'PostgreSQL community', mark: '🐘', c: '#336791',
      what: 'HNSW and IVFFlat indexes inside the database you already run and already back up.',
      pro: ['SQL joins between vectors and business data, transactionally', 'Backups, replication and roles you already have', 'Hybrid search in one statement with tsvector'],
      con: ['HNSW builds are slow and memory-hungry', 'Realistic ceiling is the low millions of vectors'],
      use: 'The default. Move only when a measured latency or scale limit says so.' },
    { n: 'Qdrant', by: 'Qdrant', mark: 'qd', c: '#dc244c',
      what: 'Rust engine whose HNSW applies payload filters during traversal rather than before or after.',
      pro: ['Avoids both post-filter recall loss and pre-filter cost', 'Binary quantisation cuts memory up to 32x with rescoring', 'Same engine from one container to a cluster'],
      con: ['You own sharding, replication and backups', 'Another system in the diagram'],
      use: 'Permission-scoped retrieval where every query carries a tenant or ACL filter.' },
    { n: 'Milvus', by: 'Zilliz / LF AI', mark: 'mv', c: '#00a1ea',
      what: 'Disaggregated architecture and the widest index catalogue, built for billions of vectors.',
      pro: ['Scale query nodes and ingestion independently', 'DiskANN makes billion-scale affordable on SSD', 'HNSW, IVF, SCANN and GPU indexes to tune against'],
      con: ['Operationally the heaviest option here', 'Absurd overkill for a million vectors'],
      use: 'Very large corpora where you need index-level control and horizontal scale.' },
    { n: 'Pinecone', by: 'Pinecone', mark: '🌲', c: '#0b7285',
      what: 'Fully managed serverless vector search. No index tuning, no capacity planning.',
      pro: ['Removes capacity planning entirely', 'Namespaces give clean per-tenant isolation', 'Real pre-filtering, so filtered queries still return k'],
      con: ['Proprietary and hosted', 'Model the bill at your projected scale, not today’s'],
      use: 'Production scale with a small team and no database operator.' },
    { n: 'FAISS', by: 'Meta', mark: 'fa', c: '#0668e1',
      what: 'The library the others are built on ideas from. An in-process index, not a database.',
      pro: ['Fastest raw search, GPU support included', 'No server, no network hop', 'Reference implementation of nearly every index type'],
      con: ['No persistence, filtering or updates by itself', 'You build the durability and the API around it'],
      use: 'Batch similarity jobs, research, and understanding what the databases do underneath.' }
  ]
};

/* ---------- Ch: LLM serving & cost ---------- */
C.toolstrips.llmserving = {
  title: 'Tools & frameworks — serving and cost control',
  sub: 'Three numbers decide this chapter: tokens per second per GPU, time-to-first-token, and GPU memory utilisation.',
  tools: [
    { n: 'vLLM', by: 'UC Berkeley', mark: 'vL', c: '#fbbf24',
      what: 'PagedAttention manages the KV cache in fixed pages; continuous batching lets new requests join a running batch.',
      pro: ['Dramatically more concurrent sequences per GPU', 'Prefix caching, tensor parallelism and speculative decoding included', 'OpenAI-compatible, so callers do not change'],
      con: ['You own capacity planning, OOMs and upgrades', 'A team cost, not just a server cost'],
      use: 'Self-hosting open weights behind real traffic.' },
    { n: 'Model routing', by: 'your own classifier', mark: '⇄', c: '#7c5cff',
      what: 'A cheap small model takes the easy majority; a frontier model takes the rest, chosen by a gate.',
      pro: ['The largest single cost lever available, typically several-fold', 'Users cannot detect the difference on easy traffic', 'No infrastructure change required'],
      con: ['The router itself needs evaluating', 'Two model behaviours to keep tested'],
      use: 'Any product with a wide spread of question difficulty, which is most of them.' },
    { n: 'Semantic cache', by: 'Redis / GPTCache', mark: '⚡', c: '#dc382d',
      what: 'Embed the query, look for a near-identical earlier one, serve the stored answer and skip the model.',
      pro: ['Cuts both spend and latency on repetitive traffic', 'Sub-millisecond lookup', 'Doubles as the session store'],
      con: ['A loose similarity threshold serves confidently wrong answers', 'Invalidation when the underlying data changes'],
      use: 'Support and FAQ traffic where the same question arrives all day.' },
    { n: 'Batch APIs', by: 'OpenAI / Anthropic', mark: '📦', c: '#10a37f',
      what: 'Submit work that can wait 24 hours and pay substantially less per token.',
      pro: ['A large discount for the same tokens', 'Ideal for evals, backfills and bulk classification', 'No infrastructure to build'],
      con: ['Not for anything a user is waiting on', 'Failures come back as a file to reconcile'],
      use: 'Any offline workload. Offline work should not pay online prices.' },
    { n: 'Helicone', by: 'Helicone', mark: 'hl', c: '#fb7185',
      what: 'A gateway that logs, caches, rate-limits and attributes cost per user with a base-URL change.',
      pro: ['One-line adoption across many services', 'Per-user attribution answers "who is burning the budget"', 'Self-hostable'],
      con: ['A proxy in the critical path', 'Must fail open or it becomes your outage'],
      use: 'Spend visibility across services you cannot instrument one at a time.' }
  ]
};

/* ---------- Ch: caching layers ---------- */
C.toolstrips.caching = {
  title: 'Tools & frameworks — caching layers',
  sub: 'Four distinct caches with four distinct correctness risks. Conflating them is how a cache becomes a bug report.',
  tools: [
    { n: 'Provider prompt caching', by: 'OpenAI / Anthropic', mark: 'pc', c: '#10a37f',
      what: 'The provider caches the KV state of a repeated prompt prefix and charges less for it.',
      pro: ['Large discount on the stable part of every prompt', 'Zero correctness risk — the model still runs', 'Automatic on OpenAI, explicit breakpoints on Anthropic'],
      con: ['Forces the stable content to come first', 'Cache lifetime is short and not guaranteed'],
      use: 'Any system with a long fixed system prompt or tool schema. Free money.' },
    { n: 'Exact-match cache', by: 'Redis', mark: '=', c: '#dc382d',
      what: 'Hash the full request; identical requests return the stored response.',
      pro: ['Zero risk of a wrong answer', 'Trivial to reason about and to invalidate', 'Microsecond lookups'],
      con: ['Hit rate is low on natural language', 'One extra space and it misses'],
      use: 'Machine-generated prompts and repeated pipeline steps.' },
    { n: 'Semantic cache', by: 'Redis / GPTCache', mark: '≈', c: '#a78bfa',
      what: 'Embed the query and serve a stored answer if a previous question is close enough.',
      pro: ['Much higher hit rate on human questions', 'Cuts latency to near zero on a hit', 'Directly reduces model spend'],
      con: ['This is the one that serves wrong answers — the threshold is a correctness decision', 'Needs invalidation when source data changes'],
      use: 'High-volume repetitive traffic, with a threshold you tuned on real questions.' },
    { n: 'Embedding cache', by: 'Redis / your database', mark: 'ec', c: '#22d3ee',
      what: 'Store the vector next to the text so unchanged documents are never re-embedded.',
      pro: ['Reindexing becomes cheap and incremental', 'No correctness risk whatsoever', 'Turns a full re-embed into a diff'],
      con: ['Must be keyed by model and version, or you mix incomparable vectors', 'Storage grows with the corpus'],
      use: 'Any corpus that is re-indexed on a schedule.' },
    { n: 'CDN / HTTP cache', by: 'Cloudflare / Varnish', mark: '🌐', c: '#f38020',
      what: 'Cache the whole response at the edge for genuinely public, identical requests.',
      pro: ['Cheapest possible hit — never reaches your infrastructure', 'Handles bursts and scrapers', 'Standard, well-understood tooling'],
      con: ['Only works for non-personalised responses', 'Streaming responses do not cache well'],
      use: 'Public, non-personalised generated content such as marketing pages or summaries.' }
  ]
};

/* ---------- Ch: Elasticsearch & BM25 ---------- */
C.toolstrips.lexical = {
  title: 'Tools & frameworks — lexical & hybrid search',
  sub: 'Embeddings are bad at exact tokens: product codes, error strings, surnames, version numbers. That is what this layer is for.',
  tools: [
    { n: 'Elasticsearch', by: 'Elastic', mark: 'es', c: '#fed10a',
      what: 'Mature BM25 search plus dense vector fields and native Reciprocal Rank Fusion.',
      pro: ['Best-in-class keyword matching and analysers', 'Aggregations, faceting and permission filtering are mature', 'Hybrid in one query beats either half'],
      con: ['JVM heap and cluster operations are a real skill', 'Licensing changed in 2021 and matters to some buyers'],
      use: 'You need genuine keyword search alongside semantic, or already run the cluster.' },
    { n: 'OpenSearch', by: 'AWS / Linux Foundation', mark: 'os', c: '#005eb8',
      what: 'The Apache-2.0 fork of Elasticsearch, with its own vector and hybrid pipeline.',
      pro: ['Permissive licence with no vendor concerns', 'Managed on AWS with IAM integration', 'Feature parity for most search workloads'],
      con: ['Feature drift from Elasticsearch over time', 'Smaller community than the original'],
      use: 'The same job as Elasticsearch when licence terms or AWS integration decide it.' },
    { n: 'BM25 in Postgres', by: 'tsvector / pg_trgm', mark: '🐘', c: '#336791',
      what: 'Full-text search and trigram similarity in the database that already holds your vectors.',
      pro: ['Hybrid retrieval in a single SQL statement', 'No second system to operate or keep in sync', 'Ranking is good enough for most corpora'],
      con: ['Weaker analysers and ranking than a real search engine', 'Index maintenance costs on write-heavy tables'],
      use: 'You want hybrid search without adding a search cluster.' },
    { n: 'BGE-M3 / SPLADE', by: 'BAAI / Naver', mark: 'sp', c: '#7c5cff',
      what: 'Learned sparse retrieval — a model that produces weighted term expansions instead of raw counts.',
      pro: ['Semantic matching that stays interpretable term by term', 'Handles vocabulary mismatch that BM25 misses', 'BGE-M3 gives dense and sparse from one model'],
      con: ['Larger indexes than plain BM25', 'Needs a store that supports sparse vectors'],
      use: 'The middle ground when BM25 misses synonyms and dense misses exact terms.' },
    { n: 'Reciprocal Rank Fusion', by: 'Cormack et al.', mark: 'RRF', c: '#34d399',
      what: 'Combine two ranked lists by summing 1/(k + rank), ignoring the incomparable raw scores.',
      pro: ['No score normalisation needed, which is the usual failure', 'One parameter, and the default works', 'Consistently beats either list alone'],
      con: ['Discards score magnitude, so a runaway best match is flattened', 'Not tunable per query type'],
      use: 'Whenever you fuse dense and lexical results. This is the standard answer.' }
  ]
};

/* ---------- Ch: RAG at scale ---------- */
C.toolstrips.ragscale = {
  title: 'Tools & frameworks — RAG at scale',
  sub: 'At scale the ingestion pipeline, not the query path, is what breaks. These are the pieces that keep an index fresh without re-embedding the world.',
  tools: [
    { n: 'Apache Airflow', by: 'Apache', mark: '🌬', c: '#017cee',
      what: 'Scheduled DAGs for the offline path: crawl, parse, embed, upsert, on a timetable with retries.',
      pro: ['Backfill is the feature that keeps it dominant', 'Pipelines are Python, so they get code review', 'Mature alerting and per-task retries'],
      con: ['Heavy to operate and not an application runtime', 'Thinks in intervals, not events'],
      use: 'Nightly reindexing, eval runs and warehouse loads.' },
    { n: 'Prefect', by: 'Prefect', mark: 'pf', c: '#024dfd',
      what: 'Decorator-based orchestration with dynamic DAGs discovered as the code runs.',
      pro: ['Two decorators to retrofit onto an existing script', 'Loops and conditionals are ordinary Python', 'Same code runs locally and in production'],
      con: ['Smaller ecosystem than Airflow', 'The nicer features live in Prefect Cloud'],
      use: 'Python-first teams wanting orchestration without Airflow’s weight.' },
    { n: 'Content hashing', by: 'your own pipeline', mark: '#', c: '#22d3ee',
      what: 'Hash each source document; re-parse and re-embed only what actually changed.',
      pro: ['Turns a full reindex into a small diff', 'Cuts embedding spend and index downtime', 'Twenty lines of code'],
      con: ['Deletions need explicit handling or the index rots', 'Hash must cover metadata that affects chunking'],
      use: 'Any corpus refreshed on a schedule. The cheapest scaling win in this chapter.' },
    { n: 'Blue-green indexes', by: 'your own pipeline', mark: '⇄', c: '#34d399',
      what: 'Build the new index alongside the live one, evaluate it, then flip an alias atomically.',
      pro: ['No window where users query a half-built index', 'Roll back by flipping the alias back', 'Lets you evaluate before promoting'],
      con: ['Double the storage during a rebuild', 'Alias support varies by vector store'],
      use: 'Any change to the embedding model, chunking or schema.' },
    { n: 'Ray Data', by: 'Anyscale', mark: 'ry', c: '#028cf0',
      what: 'Distributed batch inference for embedding millions of chunks across many workers or GPUs.',
      pro: ['Scales embedding from hours to minutes', 'Handles retries and backpressure for you', 'Same code from one machine to a cluster'],
      con: ['A cluster to run and reason about', 'Overkill below a few million documents'],
      use: 'First index of a very large corpus, or a full re-embed after a model change.' }
  ]
};

/* ---------- Ch: operate it ---------- */
C.toolstrips.operate = {
  title: 'Tools & frameworks — operating an AI system',
  sub: 'Ordinary observability still applies. What is new is that you must also record the prompt, the retrieval and whether the answer was any good.',
  tools: [
    { n: 'Langfuse', by: 'Langfuse', mark: 'lf', c: '#34d399',
      what: 'Open-source LLM tracing, evals, prompt management and cost analytics, self-hostable.',
      pro: ['Traces stay inside your network', 'OpenTelemetry, so it sits beside your normal APM', 'Cost per trace, user and session'],
      con: ['You operate Postgres, ClickHouse and a queue', 'More setup than a hosted signup'],
      use: 'Traces contain data that cannot leave, or you refuse the lock-in.' },
    { n: 'Prometheus + Grafana', by: 'CNCF', mark: '📊', c: '#e6522c',
      what: 'The ordinary metrics stack: latency percentiles, error rate, queue depth, GPU utilisation.',
      pro: ['You already run it, and the team already reads it', 'Alerting that pages the right person', 'Cheap, high-cardinality-free numbers'],
      con: ['Cannot tell you the answer was wrong', 'Sampling loses the specific bad request'],
      use: 'The p95 latency, saturation and error-rate half of the picture. Still mandatory.' },
    { n: 'Online sampling', by: 'your own job', mark: '🎲', c: '#a78bfa',
      what: 'Score a small random slice of live traffic with a judge, continuously, and alert on drift.',
      pro: ['Catches what your offline set never contained', 'Cheap at 1% of traffic', 'Gives a quality trend, not just a latency trend'],
      con: ['Judge cost scales with sample rate', 'Needs calibrating against human labels'],
      use: 'Any production system where quality can drift without anything erroring.' },
    { n: 'Feature flags', by: 'LaunchDarkly / your own', mark: '🚩', c: '#fbbf24',
      what: 'Route a percentage of traffic to a new model, prompt or retrieval config, and roll back instantly.',
      pro: ['Model changes stop being a deploy', 'Instant rollback when the metric moves the wrong way', 'A/B two prompts on real traffic'],
      con: ['Flag sprawl if nobody removes them', 'Every combination is a config to test'],
      use: 'Any model or prompt change big enough that you would want to undo it fast.' },
    { n: 'Cost budgets per request', by: 'your own code', mark: '💸', c: '#fb7185',
      what: 'A running cost total checked every loop iteration, with a named degraded outcome when it trips.',
      pro: ['Turns an unbounded bill into a bounded one', 'Degradation becomes a designed behaviour, not a surprise', 'Trivially testable'],
      con: ['You must decide what degraded looks like', 'Provider pricing changes need updating'],
      use: 'Every agentic path. Without it one bad run can cost more than a month of normal traffic.' }
  ]
};
