/* ============================================================
   Data engineering — the unglamorous half of every AI system.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'dt01', topic: 'data', level: 1,
  q: 'You need to process a 5 GB CSV on a server with 2 GB of RAM. What do you do?',
  lay: 'Do not pick the file up. Read one row, add it to a running total, throw the row away, repeat. You only ever hold one row and the total.',
  tech: 'Stream it. The file size is never the constraint — the largest live object is. A row-at-a-time iterator gives O(1) memory in the file size: <span class="mono">csv.DictReader</span> over an open file handle, reducing inside the loop. If you want vectorised speed, <span class="mono">pandas.read_csv(chunksize=N)</span> gives an iterator of DataFrames with bounded memory, as long as you reduce inside the loop rather than collecting chunks. For anything analytical, hand it to a query engine: DuckDB will query a 5 GB CSV in place in a few hundred megabytes of RAM, and Polars\' streaming engine does the same.',
  code: `import csv
from collections import defaultdict

totals = defaultdict(float)                  # bounded by KEYS, not rows
with open("events.csv", newline="") as f:
    for row in csv.DictReader(f):            # streams; never holds the file
        totals[row["country"]] += float(row["amount"])

# WRONG, and extremely common:
# frames = [c for c in pd.read_csv("events.csv", chunksize=200_000)]
# df = pd.concat(frames)      <- you have just loaded the whole file again`,
  trap: 'The follow-up is always "what if the totals dictionary does not fit either?" Then you partition: hash each key into one of N spill files, then aggregate each file independently. That is external group-by, it is fifteen lines, and knowing it is what separates a senior answer from a junior one.',
  tags: ['streaming', 'memory'], orig: 15 },

{ id: 'dt02', topic: 'data', level: 2,
  q: 'What if the aggregate itself does not fit in memory?',
  lay: 'Split the work into buckets so that every copy of the same key lands in the same bucket, then do one bucket at a time. Databases have always done exactly this.',
  tech: 'External group-by (or external merge sort for ordering). Pass 1: read the stream and write each record to one of N spill files chosen by <span class="mono">hash(key) % N</span>. Because equal keys hash identically, each partition contains all records for its keys. Pass 2: aggregate each partition independently in memory and combine. Memory is bounded by the largest partition, which you control by choosing N. Alternatives when exactness is not required: HyperLogLog for distinct counts (kilobytes for billions of items), count-min sketch for frequencies, reservoir sampling for a uniform sample, or a top-k heap.',
  code: `import os, csv, hashlib
from collections import defaultdict

N = 64
parts = [open(f"part-{i}.csv", "w", newline="") for i in range(N)]
writers = [csv.writer(p) for p in parts]
for row in stream("events.csv"):                       # pass 1: shuffle by key
    h = int(hashlib.blake2b(row["key"].encode(), digest_size=4).hexdigest(), 16)
    writers[h % N].writerow([row["key"], row["amount"]])
for p in parts: p.close()

result = {}
for i in range(N):                                      # pass 2: each part fits
    totals = defaultdict(float)
    with open(f"part-{i}.csv", newline="") as f:
        for k, v in csv.reader(f):
            totals[k] += float(v)
    result.update(totals)
    os.remove(f"part-{i}.csv")`,
  trap: 'Check the cardinality of the group-by key BEFORE choosing an approach. Ten thousand keys fits trivially; fifty million does not. That question is the one that shows you have done this.',
  tags: ['streaming', 'memory'], orig: 15 },

{ id: 'dt03', topic: 'data', level: 2,
  q: '"Streaming" means at least four different things. Which do you mean?',
  lay: 'Token streaming is showing words as the model writes them. Data streaming is processing a file a piece at a time. Weight streaming is running a model too big for your GPU by shuffling parts of it in from disk. Stream processing is Kafka and friends. People use the word for all four.',
  tech: '<ul><li><b>Token streaming</b> — server-sent events from an LLM API. Changes perceived latency; total time and cost unchanged.</li><li><b>Data streaming</b> — bounded-memory processing of a file or queue, one record or chunk at a time. This is the 5 GB CSV answer.</li><li><b>Weight streaming / offload</b> — layers held in CPU RAM or NVMe and moved into VRAM as needed. Works, and is brutally slow because weights cross PCIe every token.</li><li><b>Stream processing</b> — continuous unbounded pipelines with windows and watermarks: Kafka, Flink, Spark Structured Streaming.</li></ul>',
  trap: 'Asking which one they mean is a legitimate and well-received clarifying question. Answering the wrong one confidently is a common way to lose an easy question.',
  tags: ['streaming'], orig: 26 },

{ id: 'dt04', topic: 'data', level: 2,
  q: 'What is a generator in Python and why does it matter here?',
  lay: 'A function that hands you one item at a time instead of building the whole list first. It is how you process something bigger than memory without thinking hard about it.',
  tech: 'A function containing <span class="mono">yield</span> returns a lazy iterator: each value is produced on demand and discarded after use, so memory is O(1) in the number of items rather than O(n). Generators compose into pipelines where each stage pulls from the previous one, and nothing materialises. This is the language-level expression of streaming, and it is why the idiomatic Python answer to "the file is too big" is a generator chain rather than a framework.',
  code: `def rows(path):
    with open(path, newline="") as f:
        yield from csv.DictReader(f)          # lazy: one row at a time

def recent(rs, since):
    for r in rs:
        if r["date"] >= since:
            yield r                            # still lazy

def amounts(rs):
    for r in rs:
        yield float(r["amount"])

# nothing has been read yet; the sum drives the whole pipeline
total = sum(amounts(recent(rows("events.csv"), "2026-01-01")))`,
  trap: 'The gotcha: a generator is single-use. Iterate it twice and the second pass is empty, with no error. If you need two passes, either re-create it or materialise deliberately — and if you materialise, you are back to holding everything.',
  tags: ['python', 'streaming'], orig: 26 },

{ id: 'dt05', topic: 'data', level: 2,
  q: 'Why convert CSV to Parquet, and when is it worth it?',
  lay: 'CSV is text that has to be parsed every single time. Parquet is already-typed columns, so you only read the columns you asked for. If you are going to query it more than twice, convert once.',
  tech: 'Parquet is columnar, typed and compressed with per-column encodings and row-group statistics. Benefits: 5–10× smaller on disk; projection pushdown (read only the columns in your query); predicate pushdown (skip row groups whose min/max cannot match); and no parsing cost, because types are stored. CSV parsing is frequently the dominant cost in a naive pipeline, so a single streaming conversion pass pays for itself almost immediately.',
  code: `import pyarrow as pa, pyarrow.csv as pv, pyarrow.parquet as pq

writer = None
with pv.open_csv("events.csv") as reader:      # streaming, bounded memory
    for batch in reader:
        table = pa.Table.from_batches([batch])
        writer = writer or pq.ParquetWriter("events.parquet", table.schema,
                                            compression="zstd")
        writer.write_table(table)
writer.close()`,
  trap: 'Partition by the column you filter on most (usually date) so queries skip whole files. An unpartitioned Parquet file still beats CSV; a partitioned one beats it by another order of magnitude.',
  tags: ['parquet', 'formats'], orig: 15 },

{ id: 'dt06', topic: 'data', level: 2,
  q: 'When would you reach for Spark or Dask, and when is it overkill?',
  lay: 'When the data genuinely does not fit on one machine, or the job has to finish in minutes rather than an hour. For a single 5 GB file on one box, a cluster is slower and more work.',
  tech: 'Use a cluster when the dataset exceeds what one machine can hold or process in an acceptable time — typically hundreds of gigabytes and up — or when the workload is already on a platform (Databricks, EMR) and adding a job is trivial. For single-machine work, DuckDB and Polars routinely beat Spark on datasets up to tens of gigabytes because they avoid serialisation, scheduling and shuffle overhead entirely. Modern hardware is large: a machine with 128 GB of RAM handles far more than people assume.',
  trap: '"We used Spark" is not an achievement. The strong answer names the threshold and mentions that single-node tools have improved enormously — reaching for a cluster to look sophisticated is a real anti-pattern.',
  tags: ['spark', 'scale'], orig: 15 },

{ id: 'dt07', topic: 'data', level: 2,
  q: 'How would you build the ingestion pipeline for a RAG system?',
  lay: 'Watch for changes, pull only what changed, cut it up, embed it, and write it with an id that means the same thing every time so re-running is safe.',
  tech: '<ol><li><b>Source connectors</b> with change-data-capture or webhooks. Nightly full crawls guarantee staleness and cost a fortune.</li><li><b>Extraction</b> — format-specific parsers (PDF layout, HTML, Office). This is where most quality is won or lost.</li><li><b>Content hashing</b> — skip anything unchanged before you pay for embedding.</li><li><b>Chunking</b> with structure awareness, carrying the heading path.</li><li><b>Metadata</b> — source, section, version, timestamp, language, tenant, ACL.</li><li><b>Embedding</b> as a batch job with concurrency limits and retry.</li><li><b>Idempotent upsert</b> keyed by (document id, section, content hash), so replays are safe.</li><li><b>Delete propagation</b> — tested, because it is the most commonly missing path.</li><li><b>Reconciliation</b> — a periodic diff of source ids against index ids.</li><li><b>Freshness metric</b> — lag from source change to retrievable, alarmed.</li></ol>',
  dgm: { nodes: ['CDC / webhook', 'parse', { t: 'content hash', s: 'skip unchanged', k: 'alt' }, 'chunk + metadata', 'embed (batch)', { t: 'idempotent upsert', s: 'and deletes', k: 'warn' }],
    cap: 'One direction only: source → pipeline → index. Never write to the index by hand.' },
  trap: 'PDF extraction is the step that quietly determines your quality ceiling. A pipeline that turns two-column PDFs into interleaved nonsense cannot be rescued by any retrieval technique downstream.',
  tags: ['ingestion', 'rag'], orig: 34 },

{ id: 'dt08', topic: 'data', level: 2,
  q: 'How do you extract text from PDFs reliably?',
  lay: 'Badly, is the honest answer — PDFs describe where ink goes, not what the words mean. Two-column layouts interleave, tables become word soup, and scanned pages have no text at all.',
  tech: 'A tiered approach: <ol><li><b>Native text extraction</b> (pdfplumber, PyMuPDF) for digitally-generated PDFs — fast and free, but layout-naive.</li><li><b>Layout-aware parsing</b> that understands reading order, columns and tables (Unstructured, LlamaParse, Docling, or a document-AI service).</li><li><b>OCR</b> for scanned pages: classic engines (Tesseract) for plain text, or — now the usual choice — a small OCR vision-language model (HunyuanOCR-1.5, GLM-OCR, PaddleOCR-VL) that writes markdown with HTML tables and LaTeX.</li><li><b>General vision-model extraction</b> for the rest — render the page and ask a multimodal model. Expensive, and often the only thing that works on a truly bad page.</li></ol>Route <b>per page</b>, not per document: detect whether a clean text layer exists, whether the layout is multi-column, and whether the page holds tables (see dt26).',
  trap: 'Always sample the extracted text and read it. Teams debug retrieval for weeks when the actual problem is that every table in the corpus became a row of unrelated numbers.',
  tags: ['pdf', 'ingestion'] },

{ id: 'dt09', topic: 'data', level: 2,
  q: 'How do you deduplicate a large document corpus?',
  lay: 'Exact copies are easy — compare fingerprints. Near-copies need a trick that gives similar documents similar fingerprints, so you only compare the ones that might match.',
  tech: '<b>Exact:</b> hash the normalised content (SHA-256) and compare — O(n) with a set. <b>Near-duplicate:</b> MinHash with locality-sensitive hashing — shingle the document, compute a MinHash signature that estimates Jaccard similarity, and band the signature so similar documents collide into the same bucket, making the comparison sub-quadratic. SimHash is the alternative for Hamming-distance-style matching. <b>Semantic:</b> embed and cluster, which catches paraphrase but costs an embedding per document and is not exact. Deduplication measurably improves both retrieval quality (fewer redundant chunks in the top k) and training quality.',
  trap: 'Chunk-level near-duplication matters as much as document-level: overlapping chunks and boilerplate headers mean your top five results can be the same paragraph five times. Deduplicate after chunking, not only before.',
  tags: ['dedup'], orig: 34 },

{ id: 'dt10', topic: 'data', level: 2,
  q: 'What is idempotency in a data pipeline and why does it matter here?',
  lay: 'Running the job twice gives the same result as running it once. Without it, a retry after a crash duplicates half your index.',
  tech: 'Achieve it with deterministic keys: derive the chunk id from (document id, section path, content hash) and use upsert rather than insert. Then a replay overwrites rather than duplicating, a partial failure can simply be re-run, and backfills are safe. Combined with content hashing (skip unchanged content) this also makes re-runs cheap. The alternative — insert-only pipelines with generated ids — means every retry silently multiplies your corpus and degrades retrieval.',
  trap: 'Deletes need the same treatment. If the source removes a document, the pipeline must remove its chunks; a pipeline that only ever upserts accumulates ghosts that stay retrievable forever.',
  tags: ['pipeline', 'idempotency'], orig: 34 },

{ id: 'dt11', topic: 'data', level: 2,
  q: 'What is backpressure and why does it matter in an embedding pipeline?',
  lay: 'When the slow part cannot keep up, the fast part has to be told to wait — otherwise the queue grows until you run out of memory.',
  tech: 'A producer that outpaces its consumer builds an unbounded queue. In an embedding pipeline, the reader is fast and the embedding API is rate-limited, so without backpressure you accumulate millions of pending chunks in memory. Mechanisms: bounded queues that block on put, a semaphore limiting in-flight requests, batch-and-await, or a proper queue system with consumer-driven pull. Combine with retry and a dead-letter queue so a persistently failing document does not stall the pipeline.',
  code: `import asyncio

async def embed_all(chunks, concurrency=8, batch=64):
    sem = asyncio.Semaphore(concurrency)             # in-flight cap
    async def one(b):
        async with sem:                              # blocks -> backpressure
            return await embed_with_retry(b)
    out = []
    for i in range(0, len(chunks), batch):
        out += await one(chunks[i:i + batch])
    return out`,
  trap: 'Rate limits are backpressure from the other side. A pipeline that responds to 429s by retrying immediately has no backpressure at all — it has a retry storm.',
  tags: ['pipeline', 'async'], orig: 37 },

{ id: 'dt12', topic: 'data', level: 2,
  q: 'How do you handle schema evolution in an index?',
  lay: 'Adding a field is easy. Changing what a field means, or changing the embedding model, means rebuilding — so plan for running two versions side by side.',
  tech: 'Additive changes (a new metadata field) can be applied incrementally with a default for existing rows. Breaking changes (a new embedding model, a different chunking strategy, a changed field meaning) require a full rebuild. Pattern: build the new index alongside the old under a version alias, backfill, compare quality on the eval set, then flip the alias and keep the old index for rollback. Store the schema and embedding-model version as index metadata and assert it matches the query path at startup.',
  trap: 'Mixing embedding models in one index produces no error and complete nonsense. The startup assertion that the query encoder matches the index metadata is five lines and prevents an undiagnosable outage.',
  tags: ['schema', 'ops'], orig: 34 },

{ id: 'dt13', topic: 'data', level: 2,
  q: 'What is a dead-letter queue and why does an AI pipeline need one?',
  lay: 'A place to put the items that keep failing, so one broken document does not stop the other fifty thousand.',
  tech: 'After N failed attempts, move the item to a separate queue with the error, the attempt count and the payload, and continue. Then someone can inspect the batch, fix the cause, and replay. Essential in ingestion because real corpora contain corrupt PDFs, unsupported encodings, files that are 400 MB of scanned images, and documents that trigger a parser bug. Without it, one bad file blocks the pipeline or gets silently skipped — and silently skipped is worse, because the document is simply missing from search and nobody knows.',
  trap: 'Alarm on dead-letter depth. A DLQ nobody looks at is the same as dropping the data, and it fails silently in exactly the way that produces "why can I not find this document" tickets months later.',
  tags: ['pipeline', 'reliability'] },

{ id: 'dt14', topic: 'data', level: 3,
  q: 'How do you build a training dataset from production logs?',
  lay: 'Take the interactions that went well, strip the personal data, check a sample by hand, and split by time rather than at random.',
  tech: '<ol><li><b>Consent and retention</b> — know what you are allowed to keep and for how long.</li><li><b>PII removal at ingestion</b>, not later.</li><li><b>Filter to success</b> — thumbs up, no escalation, task completed, no immediate rephrase.</li><li><b>Human-verify a sample</b> and measure agreement before trusting the filter.</li><li><b>Deduplicate</b> — production traffic is heavily repetitive and duplicates will dominate training.</li><li><b>Rebalance</b> — real traffic is long-tailed; upsample rare intents or you improve only the easy majority.</li><li><b>Split by time</b>, holding out the most recent slice. A random split leaks future distribution and inflates your eval.</li><li><b>Version it</b> and record which model version produced which rows.</li></ol>',
  trap: 'The self-distillation loop: training on your own model\'s unchallenged outputs reinforces your existing failure modes. Always mix in human-written gold data, and never let the dataset become purely self-generated.',
  tags: ['dataset', 'training'] },

{ id: 'dt15', topic: 'data', level: 2,
  q: 'What is data lineage and why does it matter for AI?',
  lay: 'Being able to say where a piece of information came from and what happened to it on the way. When an answer is wrong, that trail is how you find out why.',
  tech: 'Track: source system and record id, extraction version, chunking parameters, embedding model and version, index version, and which cached answers derive from which chunks. Uses: debugging a bad answer back to its source; complying with deletion requests (find everything derived from a record); assessing the blast radius when a source turns out to be wrong; and reproducing a decision months later. Practical minimum: store the source id and version on every chunk, and log retrieved chunk ids on every request.',
  trap: 'Deletion is where lineage becomes a legal requirement rather than a nicety. "Delete everything derived from this record" is unanswerable without it, and that includes cached answers.',
  tags: ['lineage', 'compliance'] },

{ id: 'dt16', topic: 'data', level: 2,
  q: 'How do you handle documents in many formats and languages?',
  lay: 'Route by type. A PDF needs a different parser from a spreadsheet, and an Arabic document needs a different embedder and a different way of counting chunk size.',
  tech: 'Format: detect type and route to a specialised parser; normalise everything into a common internal representation (text plus structure plus metadata) so downstream stages are format-agnostic. Language: detect per document (and sometimes per section); use a multilingual embedding model, or separate indexes per language with query routing; size chunks in characters rather than tokens for non-Latin scripts, because tokenisers inflate them; apply language-appropriate normalisation (Unicode NFKC, diacritic stripping for Arabic, segmentation for Chinese and Japanese); and use a multilingual reranker if you use one at all.',
  trap: 'Evaluate per language, never on the average. A system at 80% overall can be at 85% in English and 30% in the language of your second-biggest market, and the aggregate hides it completely.',
  tags: ['multilingual', 'ingestion'], orig: 41 },

{ id: 'dt17', topic: 'data', level: 2,
  q: 'What is the difference between batch and streaming ingestion for RAG?',
  lay: 'Batch runs on a schedule and is simple; streaming reacts to changes and is fresh. Most systems start with batch and move to streaming when someone complains that yesterday\'s policy is still being quoted.',
  tech: 'Batch: a scheduled full or incremental crawl. Simple, easy to reason about, cheap to build; freshness is bounded by the schedule, and full crawls waste enormous compute re-embedding unchanged content. Streaming: change-data-capture or webhooks trigger per-document processing. Fresh within seconds, cheaper at steady state (only changes are processed), and more moving parts — you need ordering guarantees, idempotency and a dead-letter path. Hybrid is common: streaming for updates plus a nightly reconciliation pass to catch what the stream missed.',
  trap: 'The reconciliation pass is not optional. Streams drop messages, connectors break, and without a periodic diff of source ids against index ids you find out from a user that a document has been missing for a month.',
  tags: ['ingestion'], orig: 34 },

{ id: 'dt18', topic: 'data', level: 2,
  q: 'How do you decide chunk size and overlap empirically?',
  lay: 'Try several and measure. Fifty real questions, each with the passage that answers it labelled, and a loop over the combinations.',
  tech: 'Sweep chunk size over {128, 256, 512, 1024} tokens and overlap over {0, 10%, 20%}, rebuild the index for each combination, and read recall@10 and answer quality on a fixed eval set. Plot the surface — there is usually a clear plateau rather than a sharp peak, which means you can pick the smaller size (cheaper, more precise) at the edge of the plateau. Costs an afternoon of compute and settles an argument permanently. Note that the optimum depends on the corpus and the embedding model, so re-run it when either changes.',
  trap: 'Measure answer quality as well as recall. Smaller chunks often win on recall and lose on answer completeness, which is exactly the tension parent-child chunking exists to resolve.',
  tags: ['chunking', 'eval'], orig: 24 },

{ id: 'dt19', topic: 'data', level: 2,
  q: 'What is the cost of re-embedding a corpus, and how do you plan a migration?',
  lay: 'Usually far less than people fear — it is a one-off batch job. The awkward part is running two indexes at once while you compare.',
  tech: 'Cost: corpus tokens × embedding price. Ten million chunks at 400 tokens each is 4 billion tokens; at typical embedding prices with a batch discount that is a manageable one-off figure — much cheaper than a single day of generation traffic in most products. Migration: build the new index alongside the old, backfill in batches with backpressure, compare on the eval set, shadow on live traffic to diff the retrieved sets, then flip an alias. Keep the old index until you are confident, because rollback is otherwise another full rebuild.',
  trap: 'The real cost is calendar time and the risk window, not tokens. Plan for both indexes to coexist for a week, and make sure your storage budget allows it.',
  tags: ['embeddings', 'migration'] },

{ id: 'dt20', topic: 'data', level: 2,
  q: 'What is a feature store and does an LLM system need one?',
  lay: 'A shared place for computed inputs so that training and serving see exactly the same numbers. Classic ML needs it badly; an LLM system usually needs a simpler version of the same idea.',
  tech: 'A feature store solves training/serving skew by providing one definition of a feature computed consistently offline and online, with point-in-time correctness. LLM systems have an analogous problem in a different shape: the retrieval context, prompt template and model version at evaluation time must match production, or your offline numbers are meaningless. You rarely need a full feature store; you do need versioned prompts, a versioned index, pinned model versions and an eval harness that reads the same configuration production does.',
  trap: 'The general principle transfers: whatever produced the inputs at evaluation time must be the same thing that produces them at serving time. Most "our evals do not match production" investigations end here.',
  tags: ['mlops'] },

{ id: 'dt21', topic: 'data', level: 3,
  q: 'How would you process a stream of documents that arrive faster than you can embed them?',
  lay: 'Queue them, prioritise the ones that matter, and be honest about the lag rather than pretending the index is current.',
  tech: '<ol><li><b>Queue with priority</b> — new and updated high-value documents ahead of bulk backfill.</li><li><b>Batch aggressively</b> — embedding APIs are far more efficient at 64–256 items per call.</li><li><b>Scale consumers</b> horizontally up to the provider rate limit, with a shared token-bucket limiter so consumers do not collectively exceed it.</li><li><b>Backpressure</b> — bounded queues so the reader slows rather than the memory growing.</li><li><b>Measure lag</b> and expose it as a freshness metric with an alarm.</li><li><b>Shed or defer</b> low-value work when lag exceeds a threshold — a backfill can wait; today\'s policy change cannot.</li></ol>',
  trap: 'The freshness metric is the product-facing part. "The index is 40 minutes behind" is actionable; "the pipeline is running" is not, and users experience the former.',
  tags: ['pipeline', 'scale'], orig: 34 },

{ id: 'dt22', topic: 'data', level: 2,
  q: 'How do you sample data for evaluation without biasing the result?',
  lay: 'Do not take a random slice of traffic if most of your traffic is one easy question. Sample deliberately across the kinds of request you care about.',
  tech: 'Stratified sampling: partition traffic by intent, language, tenant tier and outcome, then sample within each stratum, weighting so rare-but-important segments are represented. For quality monitoring, oversample the failure-adjacent cases (low confidence, escalated, thumbs-down) because that is where the signal is — and then reweight when you report an overall rate, or you will overstate the failure rate. Keep a separate uniformly-sampled stream for unbiased rate estimation.',
  trap: 'Running two sampling streams — a stratified one for finding problems and a uniform one for measuring rates — is the clean answer. Using one for both gives you either a blind spot or a wrong number.',
  tags: ['eval', 'sampling'] },

{ id: 'dt23', topic: 'data', level: 2,
  q: 'What is text-to-SQL and when is it better than RAG?',
  lay: 'Let the model write a database query instead of searching documents. Any question involving counting, filtering, ranking or maths should go this way — an LLM cannot reliably add up a column in a prompt.',
  tech: 'The model receives the schema (and often example rows and a few example queries) and generates SQL, which your code validates and executes. Better than RAG whenever the answer is an aggregation or a precise filter. Requirements: a read-only connection with a query timeout and a row limit; schema description in the prompt with column semantics, not just names; validation before execution (parse the SQL, reject anything not a SELECT, check table and column allowlists); and returning the query alongside the answer so it can be checked. Accuracy improves substantially with retrieved example queries and with a self-correction loop on database errors.',
  trap: 'Security is the whole game: never execute generated SQL on a connection that can write, and always enforce row-level security in the database rather than trusting the generated WHERE clause to include a tenant filter.',
  tags: ['sql', 'rag'] },

{ id: 'dt24', topic: 'data', level: 2,
  q: 'How do you keep an index in sync with a source of truth?',
  lay: 'Treat the index as a copy that can always be rebuilt, push changes one way, and run a job that periodically checks the two agree.',
  tech: '<ol><li><b>One direction</b> — source → pipeline → index. Never write to the index by hand.</li><li><b>Event-driven</b> updates with idempotent upserts keyed deterministically.</li><li><b>Delete propagation</b>, tested.</li><li><b>Reconciliation</b> — a periodic job that diffs source ids against index ids and reports drift. Something always drifts.</li><li><b>Rebuildability</b> — you must be able to reconstruct the index from source in a bounded time, and you should have done it at least once.</li><li><b>Freshness SLO</b> — lag from source change to retrievable, measured and alarmed.</li></ol>',
  trap: 'Reconciliation is the item that separates people who have operated one of these from people who have built one. Indexes drift through failed jobs, partial writes and schema changes, and without a diff you find out from a customer.',
  tags: ['ingestion', 'ops'], orig: 34 },

{ id: 'dt25', topic: 'data', level: 2,
  q: 'What is HunyuanOCR-1.5, and why is it fast?',
  lay: 'A small model from Tencent that looks at a picture of a page and types it out properly: headings, tables and formulas included. It is fast because a much smaller helper guesses the next sixteen words at once, and the main model only has to check the guess instead of writing every word itself.',
  tech: 'Tencent Hunyuan\'s <b>1B-parameter end-to-end OCR model</b> (v1.5 released July 2026; arXiv 2607.04884): a native-resolution ViT (~0.4B), an MLP connector that pools image features, and a 0.5B Hunyuan language model. Page image in; markdown out, with <b>tables as HTML</b> and <b>formulas as LaTeX</b>, plus eleven other task types (spotting, layout, charts, translation). It scores <b>94.74 on OmniDocBench v1.6</b>, ahead of Gemini 3 Pro in the authors\' comparison. The speed comes from <b>DFlash speculative decoding</b>: a 90.7M-parameter block-diffusion draft model (five layers initialised from the target\'s last five) proposes 16 tokens in one parallel pass, and the 1B model verifies them in one pass, keeping ~8.4–9.5 tokens per pass. Output is unchanged. Result: <b>1.408 s and 0.706 pages/s</b> for one request on vLLM (2.14× over plain decoding), 1.98 pages/s with 32 in flight. Runs on vLLM, transformers or llama.cpp; licence is the Tencent Hunyuan Community License, not Apache.',
  trap: 'The speed is not because the model is small — an ordinary 1B OCR model writing 1,400 tokens a page one at a time is slow. Say "speculative decoding", then say why it is only 2.14× (dt27), and you have answered the question they were actually asking.',
  tags: ['ocr', 'pdf', 'speculative-decoding'],
  xref: [['Reading PDFs fast: HunyuanOCR-1.5', '../genai_flow/index.html']] },

{ id: 'dt26', topic: 'data', level: 2,
  q: 'How do you decide, page by page, whether a PDF needs OCR?',
  lay: 'Look at what the page already stores. If it holds real, clean text, just read it: it is instant and cannot misread a number. Only pages that are pictures, carry garbled text from an old scan, or hold tables that would turn into a jumble go to the OCR model.',
  tech: 'A per-page router, because one contract mixes typed pages with a scanned signature page:<ol><li><b>Text-layer size</b> — under ~50 characters means the page is a picture: OCR.</li><li><b>Junk ratio</b> — the share of words with replacement characters, stray symbols or letter-digit mixes ("br0wn"). High means an old OCR layer or flattened formulas: re-OCR.</li><li><b>Image coverage</b> — a page that is ~100% image under a thin text layer was OCR\'d before; do not trust that layer.</li><li><b>Tables</b> — a ruled born-digital table can go to a table extractor (PyMuPDF <span class="mono">find_tables</span>, Camelot); a borderless or scanned one to an OCR model that emits HTML tables.</li><li>Everything else: <b>read the text layer</b>, fixing reading order for columns.</li></ol>Log the route and the reason per page, so a bad answer can be traced to the extraction path.',
  code: `def route(s):                       # s = page stats
    if s["chars"] < 50:   return "ocr"      # a picture
    if s["junk"] > 0.15:  return "ocr"      # a bad old OCR layer
    if s["img"] > 0.9:    return "ocr"      # image under a thin layer
    if s["tables"]:       return "ocr"      # or a table extractor
    return "native"                          # milliseconds, exact`,
  trap: 'Sending everything through OCR "for consistency" is slower, costs GPUs, and is <em>less</em> accurate on born-digital pages: the text layer is exact, the model can misread. Routing is the single biggest cost lever in document ingestion.',
  tags: ['ocr', 'pdf', 'ingestion'] },

{ id: 'dt27', topic: 'data', level: 3,
  q: 'Why does speculative decoding give OCR 6.37× in one setup and 2.14× in another?',
  lay: 'The trick only speeds up the writing, not the looking. Every page first costs about half a second to read the image, whatever you do. In a slow, simple setup the writing is almost all of the time, so the gain looks huge; in a tuned server the writing was already quick, so the same trick saves less.',
  tech: 'Fit the paper\'s five vLLM length buckets to <b>latency = fixed + tokens × per-token</b>: plain decoding is <b>0.53 s + 1.79 ms/token</b>, DFlash is <b>0.53 s + 0.69 ms/token</b>. The fixed part (image encode, prefill, overhead) is untouched, so this is Amdahl\'s law: the ceiling is 1.79 / 0.69 ≈ <b>2.6×</b>, a 200-token page gets 1.31×, a 3,400-token table 2.30×. Per pass DFlash keeps ~9 tokens but a pass costs ~3.5 plain steps (draft + verify a 16-token block). In <b>plain transformers</b> each ordinary step is slow (34.9 s a page, ~41 tokens/s) because of per-step overhead that vLLM\'s engine already removes; DFlash pays that overhead once per ~9 tokens, so it wins <b>6.37×</b> there. Under load it shrinks again — 2.26× at 4 concurrent, <b>1.80× at 32</b> — because batching already fills the GPU and drafting competes for compute.',
  compare: { cols: ['Plain transformers', 'vLLM, 1 request', 'vLLM, 32 in flight'],
    rows: [
      ['Plain decoding', '34.9 s / page', '3.03 s / page', '1.10 pages/s'],
      ['With DFlash', '5.47 s / page', '1.41 s / page', '1.98 pages/s'],
      ['Speedup', '6.37×', '2.14×', '1.80×'],
      ['Why', 'huge per-step overhead to amortise', 'fixed 0.53 s is untouched', 'no idle compute left for drafting']] },
  trap: 'Quoting 6.37× for a production estimate. Always ask "against which baseline, at what concurrency?" — the honest number for a busy vLLM fleet is under 2×.',
  tags: ['ocr', 'speculative-decoding', 'latency'],
  xref: [['The latency calculator in the chapter', '../genai_flow/index.html']] },

{ id: 'dt28', topic: 'data', level: 2,
  q: 'How do you size an OCR fleet for a million pages?',
  lay: 'Work out how many pages really need the model, divide by how many pages one machine does per second when it is busy, and turn that into machine-hours. Then decide how fast you need it done and divide again.',
  tech: '<ol><li><b>Route first</b> (dt26): only the OCR share counts. If half the pages have clean text layers, the job halves.</li><li><b>Use concurrent throughput</b>, not single-request latency: HunyuanOCR-1.5 does 1.98 pages/s per accelerator at 32 in flight with DFlash (1.10 without).</li><li><b>GPU-hours</b> = pages × OCR share ÷ pages/s ÷ 3600. A million pages, all OCR: 1e6 / 1.98 / 3600 ≈ <b>140 GPU-h</b>; with half routed away, ≈ 70.</li><li><b>Deadline</b>: 70 GPU-h in 24 h → 3 GPUs; add headroom for retries and long pages.</li><li><b>Pipeline around it</b>: render pages on CPU workers in parallel, content-hash pages to skip re-OCR, make the job resumable, and cap max_tokens so one looping page cannot stall a worker.</li></ol>',
  code: `gpu_h = pages * ocr_share / pages_per_s / 3600
gpus  = ceil(gpu_h / deadline_hours)
# 1e6 * 0.5 / 1.98 / 3600 = 70 GPU-h  ->  3 GPUs for a 24 h deadline`,
  trap: 'Multiplying the single-request speedup into a throughput plan. 2.14× is a latency number at concurrency 1; the fleet runs at concurrency 32, where it is 1.80×, and the absolute pages/s is what you plan with.',
  tags: ['ocr', 'capacity', 'ingestion'] },

{ id: 'dt29', topic: 'data', level: 2,
  q: 'How do you know the OCR output is wrong?',
  lay: 'The model never says "I could not read this" — it writes something believable. So you compare it with a small set of pages you checked by hand, and you check the numbers separately, because one wrong digit in a price hardly changes the overall score but is the only mistake anyone cares about.',
  tech: '<ul><li><b>Labelled sample</b> of a few hundred of <em>your</em> pages, stratified by type (scans, tables, forms, languages). Benchmarks like OmniDocBench are a starting point, not your data.</li><li><b>Character error rate</b> = edit distance / reference length, for overall text quality. Tables: cell-level accuracy or TEDS. Formulas: render-and-compare.</li><li><b>Numbers diff</b>: extract amounts, dates and IDs and compare one by one. A 0.3% CER can hide a wrong contract fee.</li><li><b>Cross-check the text layer</b> where one exists: disagreement between OCR and the layer flags a page.</li><li><b>Hallucination and loop detectors</b>: output far longer than the page\'s ink suggests, repeated n-grams, or text in regions that were blank. HunyuanOCR\'s authors built CHAOS-Bench specifically to measure invented characters.</li><li><b>Downstream</b>: track which answers cite OCR\'d chunks and sample those for review.</li></ul>',
  trap: 'Reporting CER alone. In the chapter\'s notebook one misread digit gives 0.32% CER and a wrong monthly fee — the metric looks excellent and the answer is wrong.',
  tags: ['ocr', 'eval', 'hallucination'] },

{ id: 'dt30', topic: 'data', level: 2,
  q: 'What breaks when OCR output flows into a RAG index?',
  lay: 'The page number disappears, tables get cut in half so rows lose their column names, and anything written on a scanned page — including instructions meant to trick the assistant — goes straight into the knowledge base.',
  tech: '<ul><li><b>Headers and footers are dropped</b> by the default document-parsing prompt, and the page number with them. Carry page, source and route as metadata from your own loop, or citations point nowhere.</li><li><b>HTML tables</b>: a character splitter cuts through a <span class="mono">&lt;table&gt;</span> and rows lose their header. Parse tables and emit each row as a self-describing sentence ("Item: Express delivery; Qty: 1; Price: 25.00"), or keep small tables whole.</li><li><b>LaTeX</b> embeds poorly and matches nothing in BM25; keep it for display, add a plain-language gloss for retrieval.</li><li><b>Reading order</b> errors on complex layouts produce chunks that mix two topics.</li><li><b>Prompt injection</b>: text read from an image is untrusted input, exactly like a web page.</li><li><b>Versioning</b>: record the OCR model and prompt in the chunk metadata so a re-OCR can be diffed and rolled back.</li></ul>',
  trap: 'Treating OCR output as "the document". It is a model\'s reading of the document, with a model version, a prompt and an error rate — store it like one.',
  tags: ['ocr', 'rag', 'chunking'] }

]);
