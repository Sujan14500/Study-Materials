/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.

   One strip per chapter that has a real tooling answer. Each tool
   gets a mark, one line, its advantages, its drawbacks and the
   sentence for when to reach for it. Nothing here is a logo file:
   these courses have no build step and no network dependency.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch3: tokens ---------- */
C.toolstrips.tokens = {
  title: 'Tools & frameworks — tokenisation',
  sub: 'You almost never train a tokenizer. You count tokens, and you need the right one for the model you are calling, because token counts differ per family.',
  tools: [
    { n: 'tiktoken', by: 'OpenAI', mark: 'tk', c: '#10a37f',
      what: 'The fast BPE tokenizer used by OpenAI models. Count tokens before you send them.',
      pro: ['Exact counts for GPT models', 'Rust-fast, no model download', 'The way to price a prompt before sending it'],
      con: ['OpenAI families only', 'Wrong numbers for Claude or Llama'],
      use: 'Budgeting, truncation and cost estimation against an OpenAI model.' },
    { n: 'HF tokenizers', by: 'Hugging Face', mark: '🤗', c: '#ff9d00',
      what: 'The tokenizer that ships with every model on the Hub, loaded with AutoTokenizer.',
      pro: ['Always matches the model you loaded', 'Handles chat templates for you', 'Covers every open model'],
      con: ['Downloads files on first use', 'Slower to start than tiktoken'],
      use: 'Any open-weights model — and always for building the chat prompt string.' },
    { n: 'SentencePiece', by: 'Google', mark: 'sp', c: '#4285f4',
      what: 'The subword trainer behind Llama, Mistral and T5. Language-agnostic, works on raw bytes.',
      pro: ['No pre-tokenisation, so it works on any script', 'Reversible: decode gives the exact input back', 'The standard if you ever train your own'],
      con: ['Lower level than you usually need', 'Training a tokenizer is rarely the right project'],
      use: 'Understanding why Llama-family counts differ, or genuinely training a new vocabulary.' },
    { n: 'Token counting endpoints', by: 'Anthropic / Google', mark: '#', c: '#d97757',
      what: 'Provider APIs that return the exact token count for a request, including images and tools.',
      pro: ['Exact for that provider, including tool definitions', 'Counts multimodal input you cannot count locally'],
      con: ['A network round trip', 'Rate limited like any other call'],
      use: 'When the prompt includes images, files or tool schemas and a local count would be a guess.' }
  ]
};

/* ---------- Ch4: embeddings ---------- */
C.toolstrips.embeddings = {
  title: 'Tools & frameworks — embeddings',
  sub: 'Pick on your own retrieval set, not a leaderboard. Remember that changing model later means re-embedding every document you have.',
  tools: [
    { n: 'OpenAI text-embedding-3', by: 'OpenAI', mark: 'oa', c: '#10a37f',
      what: 'The default hosted embedding API, in a cheap small tier and a stronger large tier.',
      pro: ['Cheap and genuinely good', 'Truncatable dimensions with graceful degradation', 'No infrastructure at all'],
      con: ['Every document leaves your network at index time', 'Rate limits bite on a first bulk index'],
      use: 'Default starting point when there is no data-residency constraint.' },
    { n: 'Cohere Embed', by: 'Cohere', mark: 'co', c: '#39594d',
      what: 'Multilingual embeddings with an input_type flag and compression-friendly output.',
      pro: ['Separate query and document encoding lifts recall', 'Strong multilingual in one model', 'int8/binary output cuts storage hard'],
      con: ['Forgetting input_type silently costs accuracy', 'Another vendor relationship'],
      use: 'Multilingual corpora, or when vector storage cost is a real constraint.' },
    { n: 'sentence-transformers', by: 'UKP / Hugging Face', mark: 'st', c: '#ff9d00',
      what: 'The library for running and fine-tuning embedding models locally. model.encode(texts) and you are done.',
      pro: ['Free, local, nothing leaves the network', 'The standard way to fine-tune on your own pairs', 'Runs BGE, E5, GTE and cross-encoders'],
      con: ['CPU inference is slow at corpus scale', 'You own the hardware and the latency'],
      use: 'Self-hosted embedding, offline work, or beating a general model on your domain.' },
    { n: 'BGE', by: 'BAAI', mark: 'bg', c: '#7c5cff',
      what: 'Open-weights embedding family, still a standard baseline. BGE-M3 does dense, sparse and multi-vector at once.',
      pro: ['Free and competitive with hosted models', 'M3 gives hybrid retrieval from one model', 'A matching free reranker exists'],
      con: ['Needs an instruction prefix on queries or it underperforms', 'You host it'],
      use: 'Self-hosted retrieval where you want quality without a per-token bill.' },
    { n: 'Voyage AI', by: 'Voyage (MongoDB)', mark: 'vy', c: '#22d3ee',
      what: 'Specialist embeddings with domain-tuned variants for code, law and finance.',
      pro: ['Domain models beat general ones on their domain', 'Rerankers from the same vendor', 'Quantised output for storage'],
      con: ['Smaller vendor than the hyperscalers', 'Hosted only'],
      use: 'Code search, or legal and financial corpora where the domain gap is real.' }
  ]
};

/* ---------- Ch7: making it fast / serving ---------- */
C.toolstrips.speed = {
  title: 'Tools & frameworks — inference & serving',
  sub: 'The distinction that gets tested: a convenient local runner is not a serving layer. Concurrency is what separates them.',
  tools: [
    { n: 'vLLM', by: 'UC Berkeley', mark: 'vL', c: '#fbbf24',
      what: 'The high-throughput open-source inference server. PagedAttention plus continuous batching.',
      pro: ['Far more concurrent sequences per GPU', 'New requests join a running batch', 'OpenAI-compatible endpoint'],
      con: ['You now own capacity planning and OOMs', 'Cluster upgrades are your problem'],
      use: 'Self-hosting open weights with real users hitting it.' },
    { n: 'Ollama', by: 'Ollama', mark: '🦙', c: '#34d399',
      what: 'One command to run an open model on your laptop, with an OpenAI-compatible local API.',
      pro: ['Zero setup, quantised weights pulled for you', 'Offline, free, nothing leaves the machine', 'Frameworks point at it by base URL'],
      con: ['Single-user: no batching, no scheduler', 'Throughput collapses under concurrency'],
      use: 'Local development, demos and privacy-first prototyping. Never production traffic.' },
    { n: 'TGI', by: 'Hugging Face', mark: 'tg', c: '#ff9d00',
      what: 'Text Generation Inference — the Hugging Face production server, Rust core with continuous batching.',
      pro: ['Tight Hub integration', 'Token streaming and quantisation built in', 'Battle-tested on HF endpoints'],
      con: ['Licence terms have changed over its life', 'Smaller community than vLLM now'],
      use: 'Hugging Face-centric stacks, or deploying straight to Inference Endpoints.' },
    { n: 'llama.cpp', by: 'ggml / community', mark: 'cpp', c: '#60a5fa',
      what: 'C++ inference that runs quantised GGUF models on CPU, Apple Silicon and modest GPUs.',
      pro: ['Runs where nothing else will, including phones', 'Aggressive quantisation options', 'No Python runtime needed'],
      con: ['Quantisation costs quality', 'Not a multi-tenant server'],
      use: 'Edge, offline and consumer hardware — and it is what Ollama runs underneath.' },
    { n: 'Groq / hosted OSS', by: 'Groq, Together, Fireworks', mark: '⚡', c: '#fb7185',
      what: 'Someone else runs the open model for you, often on hardware built for very low latency.',
      pro: ['Open-model economics without operating a GPU', 'Extremely fast time-to-first-token', 'Swap models with a config change'],
      con: ['Data still leaves your network', 'Model availability changes without you'],
      use: 'You want an open model and low latency but have no ops capacity.' }
  ]
};

/* ---------- Ch8: training / fine-tuning ---------- */
C.toolstrips.tuning = {
  title: 'Tools & frameworks — fine-tuning & PEFT',
  sub: 'Almost nobody does full fine-tuning any more. The whole practical landscape is adapters, and these are the four ways people run them.',
  tools: [
    { n: 'PEFT', by: 'Hugging Face', mark: '🤗', c: '#ff9d00',
      what: 'The reference library for parameter-efficient tuning: LoRA, QLoRA, prefix tuning, prompt tuning, IA3.',
      pro: ['Every PEFT method in one API', 'Adapters are a few MB, so you can ship dozens', 'Merges cleanly back into base weights'],
      con: ['You still write the training loop around it', 'Hyperparameters (rank, alpha, target modules) need care'],
      use: 'Any adapter-based fine-tune where you want full control of the code.' },
    { n: 'TRL', by: 'Hugging Face', mark: 'trl', c: '#f472b6',
      what: 'Trainers for the alignment stage: SFT, DPO, ORPO, GRPO and PPO on top of transformers.',
      pro: ['SFTTrainer removes most of the boilerplate', 'DPO without a separate reward model', 'Integrates with PEFT directly'],
      con: ['Preference data is the hard part and it does not supply that', 'Alignment training is easy to get subtly wrong'],
      use: 'Going past instruction tuning into preference alignment.' },
    { n: 'Unsloth', by: 'Unsloth', mark: '🦥', c: '#34d399',
      what: 'Hand-optimised kernels that make LoRA/QLoRA training substantially faster and lighter on one GPU.',
      pro: ['Large speed and memory gains on a single GPU', 'Drop-in replacement for the usual loader', 'Makes consumer hardware viable'],
      con: ['Supported model list is narrower', 'Multi-GPU support lags the open version'],
      use: 'Fine-tuning on one GPU, especially a consumer card or a free notebook.' },
    { n: 'Axolotl / LLaMA-Factory', by: 'OpenAccess / hiyouga', mark: 'yml', c: '#7c5cff',
      what: 'Config-driven training: describe the run in YAML and it handles dataset formats, PEFT and distribution.',
      pro: ['Reproducible runs a colleague can rerun', 'Handles many dataset formats already', 'Multi-GPU and DeepSpeed wired up'],
      con: ['You are debugging YAML instead of Python', 'Less obvious what it is doing under the hood'],
      use: 'Repeatable production fine-tunes, or comparing many configurations quickly.' },
    { n: 'Hosted fine-tuning', by: 'OpenAI / Bedrock / Vertex', mark: '☁', c: '#60a5fa',
      what: 'Upload a JSONL of examples, get a fine-tuned model ID back. No GPUs involved.',
      pro: ['No infrastructure, no CUDA, no OOMs', 'Serving is handled too', 'Often the fastest path to a measurable lift'],
      con: ['The tuned weights are not yours to take', 'Fewer knobs, and your data goes to the vendor'],
      use: 'You want the quality lift and have neither GPU budget nor ML-infra time.' }
  ]
};

/* ---------- Ch9: prompting ---------- */
C.toolstrips.prompting = {
  title: 'Tools & frameworks — prompting & structured output',
  sub: 'Two jobs here that people conflate: managing prompts as artefacts, and forcing the output into a shape your code can trust.',
  tools: [
    { n: 'Pydantic', by: 'Pydantic', mark: 'py', c: '#e92063',
      what: 'Declare the output as a typed model; get JSON Schema for the request and validation of the reply.',
      pro: ['One definition drives schema and validation', 'Errors are specific enough to feed back as a repair instruction', 'Business rules encoded as validators'],
      con: ['v1/v2 API differences bite in mixed dependency trees', 'Automatic re-asks can loop if uncapped'],
      use: 'Every time the model output is consumed by code rather than read by a human.' },
    { n: 'Instructor', by: 'Jason Liu', mark: 'in', c: '#22d3ee',
      what: 'A thin wrapper that patches the provider client so a call returns a validated Pydantic object.',
      pro: ['Structured output in about three lines', 'Retries with the validation error attached', 'Works across providers'],
      con: ['Another dependency for something providers now do natively', 'Hides the retry cost'],
      use: 'Fast structured extraction where you do not want to write the retry loop.' },
    { n: 'DSPy', by: 'Stanford NLP', mark: 'ds', c: '#8c1515',
      what: 'Treats the prompt as a parameter to optimise against a metric rather than a string to hand-write.',
      pro: ['Prompts become portable across models', 'Forces a metric, so you end up with real evals', 'Finds few-shot examples for you'],
      con: ['Compilation burns real API calls', 'Useless without decent training examples'],
      use: 'A measurable task with labelled examples, when hand-tuning has stalled.' },
    { n: 'Promptfoo', by: 'Promptfoo', mark: 'pf', c: '#fbbf24',
      what: 'Declarative prompt testing: cases and assertions in YAML, run in CI like any other test suite.',
      pro: ['Prompt changes become reviewable in a pull request', 'Side-by-side matrix across models', 'Most assertions are deterministic and free'],
      con: ['Not a tracing platform', 'LLM-graded assertions cost real money'],
      use: 'Proving a prompt or model change did not make five hundred known cases worse.' },
    { n: 'Prompt registries', by: 'LangSmith / Langfuse', mark: '📌', c: '#34d399',
      what: 'Version prompts outside the code, with labels, so promoting a new one is not a deploy.',
      pro: ['Non-engineers can iterate safely', 'Roll back a bad prompt in seconds', 'Ties a trace to the exact prompt version'],
      con: ['Prompt changes escape code review unless you insist', 'One more system in the request path'],
      use: 'Once more than one person edits prompts, or changes need to ship faster than releases.' }
  ]
};

/* ---------- Ch11: RAG ---------- */
C.toolstrips.rag = {
  title: 'Tools & frameworks — RAG',
  sub: 'Retrieval quality beats model quality. These are the layers you assemble, and the honest trade each one asks for.',
  tools: [
    { n: 'LangChain', by: 'LangChain', mark: '🔗', c: '#1c3c3c',
      what: 'A standard interface over models, loaders, splitters, retrievers and stores, composed with LCEL.',
      pro: ['The biggest integration catalogue by far', 'Swapping a component is a one-line change', 'Streaming, batching and async for free'],
      con: ['Deep abstractions: the real prompt can be five wrappers away', 'Historic reputation for breaking changes'],
      use: 'You want breadth of connectors and will keep your control flow visible.' },
    { n: 'LlamaIndex', by: 'LlamaIndex', mark: '🦙', c: '#7c5cff',
      what: 'A data framework focused on the document path: parsing, index types and advanced retrieval.',
      pro: ['LlamaParse handles nasty PDFs and tables', 'Auto-merging and sentence-window retrieval built in', 'Query engines do routing and sub-questions'],
      con: ['Its abstraction stack is deep too', 'Overlaps with LangChain, which confuses teams'],
      use: 'Document-heavy RAG, especially messy PDFs and multi-document QA.' },
    { n: 'Haystack', by: 'deepset', mark: 'hs', c: '#03cb98',
      what: 'Pipelines as explicit typed components with named ports, serialisable to YAML.',
      pro: ['Wiring mistakes caught at build time, not runtime', 'Same pipeline definition across dev, CI and prod', 'Classic BM25 and readers are first class'],
      con: ['Smaller integration catalogue', 'More verbose for the same result'],
      use: 'Teams that want RAG as explicit, testable, config-driven infrastructure.' },
    { n: 'pgvector', by: 'PostgreSQL community', mark: '🐘', c: '#336791',
      what: 'A Postgres extension adding a vector type and ANN indexes to the database you already run.',
      pro: ['Joins between vectors and business data, in one transaction', 'You inherit backups, roles and replication', 'Hybrid search in a single SQL statement'],
      con: ['HNSW builds are slow and memory-hungry', 'Ceiling is roughly the low millions of vectors'],
      use: 'The correct default. Move to a dedicated engine only when you measure a reason.' },
    { n: 'Cohere Rerank', by: 'Cohere', mark: '🎯', c: '#39594d',
      what: 'A cross-encoder that rescores your top-100 candidates into a properly ordered top-10.',
      pro: ['Usually the single biggest quality win in a mediocre RAG system', 'No reindexing required to adopt', 'Multilingual'],
      con: ['A network hop and real latency per query', 'Per-call cost on every search'],
      use: 'The right chunk is being retrieved and then buried below rank five.' }
  ]
};

/* ---------- Ch: chunking ---------- */
C.toolstrips.chunking = {
  title: 'Tools & frameworks — parsing & chunking',
  sub: 'Most RAG projects fail here rather than at the model. A PDF flattened into a text blob cannot be rescued by a better prompt.',
  tools: [
    { n: 'Unstructured', by: 'Unstructured.io', mark: 'un', c: '#60a5fa',
      what: 'Turns PDFs, Word, HTML, email and slides into typed elements: Title, NarrativeText, Table, ListItem.',
      pro: ['Typed elements make structure-aware chunking possible', 'Handles the long tail of formats', 'chunk_by_title preserves document hierarchy'],
      con: ['hi_res mode is slow and CPU-hungry', 'System dependencies surprise people in Docker'],
      use: 'Any corpus of real-world documents rather than clean markdown.' },
    { n: 'LlamaParse', by: 'LlamaIndex', mark: '📄', c: '#7c5cff',
      what: 'A hosted parser aimed squarely at complex PDFs — tables, multi-column layouts, scanned pages.',
      pro: ['Best-in-class on tables and financial documents', 'Outputs clean markdown that chunks well', 'No local OCR dependencies'],
      con: ['Hosted, so documents leave your network', 'Per-page pricing at scale'],
      use: 'Financial reports, scientific papers and anything where tables carry the meaning.' },
    { n: 'LangChain splitters', by: 'LangChain', mark: '✂', c: '#1c3c3c',
      what: 'RecursiveCharacterTextSplitter and friends: split on the largest natural boundary that fits.',
      pro: ['Sensible default that works everywhere', 'Language- and markdown-aware variants', 'Zero setup'],
      con: ['Character counts ignore document structure', 'Fixed sizes split tables from their headings'],
      use: 'A baseline. Beat it with structure-aware splitting before you tune chunk size.' },
    { n: 'Docling', by: 'IBM', mark: 'dl', c: '#0f62fe',
      what: 'Open-source document conversion with layout and table-structure models, producing a rich document tree.',
      pro: ['Strong table extraction, fully local', 'Rich structured output, not flat text', 'Permissive licence'],
      con: ['Heavier local models to run', 'Younger ecosystem'],
      use: 'You need LlamaParse-grade parsing but the documents cannot leave your network.' },
    { n: 'RAGFlow', by: 'InfiniFlow', mark: 'rf', c: '#fb923c',
      what: 'A self-hosted RAG platform whose real feature is letting you see and edit chunks before indexing.',
      pro: ['Chunking becomes a review step, not a guess', 'Template-based chunking per document type', 'Citations point at the source region'],
      con: ['Several services to operate', 'Less flexible than code for custom needs'],
      use: 'A non-engineer needs to verify document quality before answers go live.' }
  ]
};

/* ---------- Ch: agents ---------- */
C.toolstrips.agents = {
  title: 'Tools & frameworks — agents',
  sub: 'Every one of these is the same loop with different decorations. What differs is how much control you keep, and whether a crash loses the run.',
  tools: [
    { n: 'LangGraph', by: 'LangChain', mark: '🕹', c: '#1c3c3c',
      what: 'Agents as explicit state machines with checkpointed state, interrupts and resumable runs.',
      pro: ['A crash mid-run resumes from the last node', 'interrupt() gives real human approval gates', 'Control flow is visible in code'],
      con: ['Steep curve; reducers are what people get wrong first', 'More code than a role-play framework'],
      use: 'Production agents that must be resumable, auditable and gated by humans.' },
    { n: 'OpenAI Agents SDK', by: 'OpenAI', mark: 'oa', c: '#10a37f',
      what: 'Four primitives — agents, handoffs, guardrails, sessions — and deliberately little else.',
      pro: ['Small, readable, few abstractions', 'Handoffs make delegation an explicit traceable tool call', 'Tracing built in'],
      con: ['Shaped around one provider', 'No durable state story'],
      use: 'OpenAI-centric agents where you want structure without a heavy framework.' },
    { n: 'CrewAI', by: 'CrewAI', mark: '👥', c: '#fb923c',
      what: 'Role, goal and backstory agents executed sequentially or by a manager agent.',
      pro: ['Fastest route to a working multi-agent demo', 'Maps naturally onto "a team of specialists"', 'Flows added for explicit control flow'],
      con: ['Token cost balloons in manager mode', 'Prompts generated from role strings are hard to control precisely'],
      use: 'Prototypes and content pipelines where a wrong step is cheap.' },
    { n: 'PydanticAI', by: 'Pydantic', mark: 'py', c: '#e92063',
      what: 'A type-safe agent framework where outputs are validated Pydantic models with automatic repair.',
      pro: ['Static typing catches wiring mistakes before runtime', 'Dependency injection for database and HTTP clients', 'Model-agnostic'],
      con: ['Younger, smaller integration surface', 'You write more glue yourself'],
      use: 'Type-safe Python services where the model must return trustworthy structured data.' },
    { n: 'A plain loop', by: 'you', mark: '{}', c: '#94a3b8',
      what: 'Thirty lines: call the model, run the tool it asked for, append the result, repeat with caps.',
      pro: ['Nothing hidden; every guard is visible', 'No dependency to upgrade or debug', 'Often the honest answer for two tools'],
      con: ['You rebuild streaming, retries and tracing yourself', 'Stops scaling once orchestration gets real'],
      use: 'Any agent simple enough that a framework would be more code than the solution.' }
  ]
};

/* ---------- Ch: evaluation ---------- */
C.toolstrips.eval = {
  title: 'Tools & frameworks — evaluation & observability',
  sub: 'Instrument before you optimise. Without traces you are guessing which of five stages is the problem, and guessing costs a month.',
  tools: [
    { n: 'Ragas', by: 'Exploding Gradients', mark: '📏', c: '#60a5fa',
      what: 'RAG metrics — faithfulness, answer relevancy, context precision and recall — most of them reference-free.',
      pro: ['Start measuring with no labelled data', 'Splits retrieval metrics from generation metrics', 'Can synthesise a test set from your documents'],
      con: ['Scores depend on the judge model', 'Treat as relative trends, not absolute truth'],
      use: 'Putting numbers on RAG quality quickly when you have no gold answers.' },
    { n: 'Promptfoo', by: 'Promptfoo', mark: 'pf', c: '#fbbf24',
      what: 'YAML test cases with assertions, run in CI, plus a red-team mode for injection and jailbreaks.',
      pro: ['Regression suite that runs on every pull request', 'Most assertions are deterministic and free', 'Red-team findings map to OWASP LLM risks'],
      con: ['Not a tracing platform', 'LLM-graded assertions add real cost'],
      use: 'Proving a change did not break known cases, and comparing models before a switch.' },
    { n: 'LangSmith', by: 'LangChain', mark: 'ls', c: '#1c3c3c',
      what: 'Hosted tracing, datasets, experiments and prompt versioning, auto-instrumenting LangChain code.',
      pro: ['Two environment variables and every span appears', 'Turn real traces into a regression dataset', 'Annotation queues for human labelling'],
      con: ['Hosted by default; self-host is enterprise only', 'Pulls you further into one ecosystem'],
      use: 'You are on LangChain or LangGraph and want tracing working this afternoon.' },
    { n: 'Langfuse', by: 'Langfuse', mark: 'lf', c: '#34d399',
      what: 'Open-source tracing, evals, prompt management and cost analytics, self-hostable with Docker.',
      pro: ['Traces stay inside your network', 'Framework-agnostic via OpenTelemetry', 'Cost per trace, user and session'],
      con: ['Self-hosting means running Postgres, ClickHouse and a queue', 'More setup than a hosted signup'],
      use: 'Traces contain data that cannot leave, or you want no vendor lock-in.' },
    { n: 'TruLens', by: 'TruEra / Snowflake', mark: '△', c: '#a78bfa',
      what: 'Evaluation organised around the RAG Triad: context relevance, groundedness, answer relevance.',
      pro: ['The triad localises the failure to one stage', 'Pluggable feedback functions', 'Local dashboard, no account'],
      con: ['Judge-based feedback costs a call per evaluation', 'Narrower than a full platform'],
      use: 'Diagnosing *where* a RAG pipeline fails rather than merely that it does.' }
  ]
};

/* ---------- Ch: ship it ---------- */
C.toolstrips.ship = {
  title: 'Tools & frameworks — shipping it',
  sub: 'The layer people forget to name in interviews. An LLM endpoint is slow and streaming, and that changes the architecture.',
  tools: [
    { n: 'FastAPI', by: 'Sebastián Ramírez', mark: '🚪', c: '#009688',
      what: 'Async Python API framework where type hints generate validation, errors and OpenAPI docs.',
      pro: ['Async fits I/O-bound model calls perfectly', 'StreamingResponse for token streaming', 'Depends() for auth, rate limits and tracing'],
      con: ['A blocking call inside an async handler stalls everything', 'Timeouts must be set at every layer or the stingiest wins'],
      use: 'Any Python AI service that other software will call. This is the default.' },
    { n: 'Streamlit', by: 'Streamlit (Snowflake)', mark: '🎈', c: '#ff4b4b',
      what: 'A Python script becomes a web app. Native chat primitives and token streaming.',
      pro: ['A working UI in twenty lines', 'Chat components and write_stream built in', 'Perfect for internal tools and stakeholder demos'],
      con: ['Reruns the whole script on every interaction', 'No routing, no real auth, does not scale like a web app'],
      use: 'Internal tools and demos. Say the limitation out loud before someone else does.' },
    { n: 'Gradio', by: 'Hugging Face', mark: 'gr', c: '#ff9d00',
      what: 'Wraps a function in a shareable interface, with one-click deployment to Spaces.',
      pro: ['Rich multimodal components out of the box', 'Auto-generates a REST API for the same function', 'The standard way open models get demoed'],
      con: ['A demo framework, not a product surface', 'Layout control needs the lower-level Blocks API'],
      use: 'Model demos, especially anything with images, audio or video.' },
    { n: 'Docker', by: 'Docker', mark: '🐳', c: '#2496ed',
      what: 'The reproducible unit of deployment. Pin the Python, the CUDA and the system libraries together.',
      pro: ['Same image in CI and production', 'System dependencies stop being a mystery', 'Everything below deploys it'],
      con: ['GPU images are enormous', 'Layer caching mistakes make builds crawl'],
      use: 'Anything leaving your laptop. Non-negotiable once a second person runs the code.' },
    { n: 'Helicone', by: 'Helicone', mark: 'hl', c: '#fb7185',
      what: 'A gateway in front of the model: change the base URL and get logging, caching, rate limits and cost per user.',
      pro: ['One-line adoption across many services', 'Response caching cuts spend directly', 'Per-user spend attribution'],
      con: ['A proxy in the critical path', 'Must fail open or it becomes your outage'],
      use: 'Fast observability and spend control across services you do not want to instrument one by one.' }
  ]
};

/* ---------- Ch: multimodal ---------- */
C.toolstrips.multimodal = {
  title: 'Tools & frameworks — multimodal',
  sub: 'The honest first question is whether you need a general multimodal model at all. A specialist is often cheaper, faster and more accurate at the one job.',
  tools: [
    { n: 'GPT-4o class models', by: 'OpenAI', mark: 'oa', c: '#10a37f',
      what: 'Text, image and audio in one API call, with tool calling and structured output on top.',
      pro: ['One model and one bill for several modalities', 'Structured JSON output from an image in a single call', 'Strong at charts, screenshots and document layout'],
      con: ['Images cost hundreds to thousands of tokens each turn', 'Dedicated OCR is more accurate on dense scans'],
      use: 'Reasoning that genuinely spans modalities — a question about what is in the picture.' },
    { n: 'Gemini', by: 'Google DeepMind', mark: 'gm', c: '#4285f4',
      what: 'Natively multimodal including video, with context windows long enough to hold whole recordings.',
      pro: ['Video as a first-class input, not frames you extracted yourself', 'Very long context for whole documents or recordings', 'Native audio understanding'],
      con: ['Two SDKs and two consoles for the same models', 'Long multimodal context is expensive per turn'],
      use: 'Video and long-form audio, or anything where the input is genuinely enormous.' },
    { n: 'Whisper', by: 'OpenAI', mark: '🎙', c: '#7c5cff',
      what: 'A dedicated speech-to-text model, available hosted and as open weights you can run yourself.',
      pro: ['More accurate and far cheaper than a general model for transcription', 'Open weights, so it can run entirely offline', 'Word-level timestamps for alignment'],
      con: ['Transcription only — it does not reason about the audio', 'Hallucinated text on long silences is a known failure'],
      use: 'Any transcription job. Reaching for a frontier model here wastes money.' },
    { n: 'CLIP / SigLIP', by: 'OpenAI / Google', mark: 'cl', c: '#22d3ee',
      what: 'Image and text encoders trained into one shared space, so distance means similarity across modalities.',
      pro: ['Text-to-image search with no captions written in advance', 'Small, fast, and runs locally', 'Zero-shot classification by writing the labels as sentences'],
      con: ['Late fusion, so no fine-grained grounding at all', 'Cannot answer a question, only compare'],
      use: 'Image search, deduplication and zero-shot tagging — not question answering.' },
    { n: 'Stable Diffusion', by: 'Stability AI', mark: 'sd', c: '#f472b6',
      what: 'Open-weights text-to-image generation you can run and fine-tune on your own hardware.',
      pro: ['Runs on your own GPU with no per-image fee', 'Fine-tunable on a style or a product with LoRA', 'A large ecosystem of controls such as depth and pose conditioning'],
      con: ['Output quality needs prompt and sampler craft', 'Licence and provenance questions around training data'],
      use: 'Image generation at volume, or where the images must not leave your network.' },
    { n: 'LlamaParse / Docling', by: 'LlamaIndex / IBM', mark: '📄', c: '#60a5fa',
      what: 'Document parsers that use vision models on layout rather than asking a chat model to read a page.',
      pro: ['Far better on tables than a general model reading a screenshot', 'Structured output that chunks well for RAG', 'Docling runs entirely locally'],
      con: ['Hosted parsing sends the document off your network', 'Per-page cost at corpus scale'],
      use: 'Turning real documents into text. This is the specialist that beats the generalist.' }
  ]
};
