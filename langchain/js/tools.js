/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: models & messages ---------- */
C.toolstrips.models = {
  title: 'Tools & frameworks — model providers',
  sub: 'LangChain gives you one interface over all of these. The point of that interface is that swapping provider is a config change, not a refactor.',
  tools: [
    { n: 'langchain-openai', by: 'OpenAI', mark: 'oa', c: '#10a37f',
      what: 'ChatOpenAI — the most-used integration, with native tool calling and structured output.',
      pro: ['Best-supported path; every feature lands here first', 'Automatic prompt caching on repeated prefixes', 'Batch API for offline work at a discount'],
      con: ['Pin a dated model ID or an alias will shift under you', 'Your data leaves the network'],
      use: 'Default when there is no residency constraint and you want the shortest path.' },
    { n: 'langchain-anthropic', by: 'Anthropic', mark: 'an', c: '#d97757',
      what: 'ChatAnthropic — very large context, strong instruction following, explicit prompt caching.',
      pro: ['Whole-document prompts become a real alternative to RAG', 'Cache breakpoints you control', 'Strong tool use and extended thinking'],
      con: ['Long context is billed on every turn', 'Cache design forces the stable content first'],
      use: 'Long documents, careful instruction following, agentic coding.' },
    { n: 'langchain-ollama', by: 'Ollama', mark: '🦙', c: '#34d399',
      what: 'Point the same chain at a model on your own laptop by changing one class.',
      pro: ['Free iteration with no key and no bill', 'Nothing leaves the machine', 'Proves your abstraction is actually provider-agnostic'],
      con: ['Single-user, no batching', 'Small local models fail at tool calling more often'],
      use: 'Development, offline work and privacy-sensitive prototyping.' },
    { n: 'langchain-aws / azure / google', by: 'the clouds', mark: '☁', c: '#60a5fa',
      what: 'Bedrock, Azure OpenAI and Vertex integrations — the same models inside an enterprise boundary.',
      pro: ['IAM or Entra identity instead of an API key in config', 'VPC and private networking', 'Data residency your compliance team accepts'],
      con: ['Regional model availability lags the direct APIs', 'Quota is per deployment and surprises people late'],
      use: 'Enterprises where the governance story decides the architecture.' },
    { n: 'init_chat_model', by: 'LangChain', mark: '{}', c: '#1c3c3c',
      what: 'One helper that returns any provider from a string, so the model becomes configuration.',
      pro: ['Provider and model live in config, not in code', 'Makes A/B testing two models trivial', 'Removes the last provider import from your business logic'],
      con: ['Hides which package must be installed', 'Provider-specific features still need the concrete class'],
      use: 'Any application that might change model, which is all of them.' }
  ]
};

/* ---------- Ch: loaders & splitters ---------- */
C.toolstrips.splitters = {
  title: 'Tools & frameworks — loading & splitting',
  sub: 'This is where RAG projects actually fail. A PDF flattened into a text blob cannot be rescued by a better prompt downstream.',
  tools: [
    { n: 'RecursiveCharacterTextSplitter', by: 'LangChain', mark: '✂', c: '#1c3c3c',
      what: 'Splits on the largest natural boundary that still fits: paragraphs, then lines, then words.',
      pro: ['A sensible default that works on almost anything', 'Language- and markdown-aware variants exist', 'Zero setup and zero cost'],
      con: ['Character counts ignore document structure', 'Will cheerfully split a table from its heading'],
      use: 'Your baseline. Beat it with structure-aware splitting before tuning chunk size.' },
    { n: 'Unstructured', by: 'Unstructured.io', mark: 'un', c: '#60a5fa',
      what: 'Partitions documents into typed elements — Title, NarrativeText, Table — instead of a flat string.',
      pro: ['Typed elements make structure-aware chunking possible', 'chunk_by_title keeps a section with its heading', 'Handles the long tail of formats'],
      con: ['hi_res is slow and needs system dependencies', 'Choosing the strategy per document type is real work'],
      use: 'Any corpus of real-world documents rather than clean markdown.' },
    { n: 'LlamaParse', by: 'LlamaIndex', mark: '📄', c: '#7c5cff',
      what: 'A hosted parser built for the hard cases: complex tables, multi-column layouts, scanned pages.',
      pro: ['Best-in-class on tables and financial documents', 'Clean markdown output that chunks well', 'No local OCR dependencies to install'],
      con: ['Documents leave your network', 'Per-page pricing at corpus scale'],
      use: 'Reports and papers where the tables carry the meaning.' },
    { n: 'Docling', by: 'IBM', mark: 'dl', c: '#0f62fe',
      what: 'Open-source conversion with layout and table-structure models, producing a rich document tree.',
      pro: ['Strong table extraction, fully local', 'Permissive licence', 'Structured output, not flat text'],
      con: ['Heavier local models to run', 'Younger ecosystem than the alternatives'],
      use: 'You need hosted-grade parsing but the documents cannot leave.' },
    { n: 'tiktoken length function', by: 'OpenAI', mark: 'tk', c: '#10a37f',
      what: 'Measure chunks in tokens rather than characters, because tokens are what you actually pay for.',
      pro: ['Chunk sizes map onto real context budget', 'Stops the surprise where a chunk overflows the window', 'Two lines to wire into any splitter'],
      con: ['Counts are OpenAI-specific', 'Slower than counting characters'],
      use: 'Whenever the context budget is tight enough that character counts start lying.' }
  ]
};

/* ---------- Ch: embeddings & vectors ---------- */
C.toolstrips.vectors = {
  title: 'Tools & frameworks — vector stores',
  sub: 'LangChain gives all of these the same interface, so this choice is about operations and scale, not about API.',
  tools: [
    { n: 'pgvector', by: 'PostgreSQL community', mark: '🐘', c: '#336791',
      what: 'A Postgres extension adding a vector type and ANN indexes to the database you already run.',
      pro: ['Joins between vectors and business data in one transaction', 'Backups, roles and replication you already have', 'Hybrid search in a single SQL statement'],
      con: ['HNSW builds are slow and memory-hungry', 'Ceiling is roughly the low millions of vectors'],
      use: 'The correct default. Move only when you can point at a measured reason.' },
    { n: 'Chroma', by: 'Chroma', mark: 'ch', c: '#f472b6',
      what: 'In-process embedding database: pip install, no server, persistent to disk.',
      pro: ['Fastest path from nothing to working retrieval', 'Prototype survives a restart with no infrastructure', 'Documents, embeddings and metadata together'],
      con: ['Not built for tens of millions of vectors', 'Choose your migration target before you need it'],
      use: 'Prototypes, notebooks and small production systems.' },
    { n: 'Qdrant', by: 'Qdrant', mark: 'qd', c: '#dc244c',
      what: 'Rust vector database that applies payload filters during graph traversal rather than before or after.',
      pro: ['Filtering that avoids both the recall loss and the cost', 'Quantisation cuts memory dramatically', 'Same engine from a laptop container to a cluster'],
      con: ['You operate a database: sharding, replication, backups', 'Another system in the diagram'],
      use: 'Self-hosted search with heavy per-tenant or per-permission filtering.' },
    { n: 'Pinecone', by: 'Pinecone', mark: '🌲', c: '#0b7285',
      what: 'Fully managed vector database. An API key and a namespace, no servers.',
      pro: ['No capacity planning at all', 'Namespaces give clean multi-tenant isolation', 'Proper pre-filtering, so filtered queries still return k'],
      con: ['Proprietary and hosted', 'Model the cost at your projected scale before committing'],
      use: 'Production scale with a small team and no appetite for running a database.' },
    { n: 'Elasticsearch', by: 'Elastic', mark: 'es', c: '#fed10a',
      what: 'Mature search engine with dense vector fields, kNN and Reciprocal Rank Fusion for hybrid.',
      pro: ['BM25 on product codes and names, which embeddings handle badly', 'Aggregations, faceting and permission filtering are mature', 'Hybrid beats either half on most real corpora'],
      con: ['JVM heap and cluster operations are a real skill', 'Overkill if you do not need keyword search'],
      use: 'You need genuine keyword search alongside semantic, or you already run the cluster.' }
  ]
};

/* ---------- Ch: the RAG chain ---------- */
C.toolstrips.rag = {
  title: 'Tools & frameworks — improving a RAG chain',
  sub: 'In value-per-hour order. Every one of these beats swapping to a bigger generation model.',
  tools: [
    { n: 'EnsembleRetriever', by: 'LangChain', mark: '⚖', c: '#1c3c3c',
      what: 'Hybrid search: run BM25 and dense retrieval, then fuse the rankings.',
      pro: ['Fixes the exact-term failures embeddings are bad at', 'No reindexing to try it', 'Usually the first thing to add'],
      con: ['Two indexes to keep in sync', 'Weighting between them needs tuning on your data'],
      use: 'Any corpus with product codes, names, error strings or acronyms.' },
    { n: 'Cohere Rerank', by: 'Cohere', mark: '🎯', c: '#39594d',
      what: 'A cross-encoder that rescores your top-100 candidates into a properly ordered top-10.',
      pro: ['Usually the single biggest quality win available', 'Drops in as a ContextualCompressionRetriever', 'Multilingual'],
      con: ['A network hop and real latency per query', 'Per-call cost on every search'],
      use: 'The right chunk is retrieved and then buried below rank five.' },
    { n: 'MultiQueryRetriever', by: 'LangChain', mark: 'mq', c: '#7c5cff',
      what: 'Rewrites one question into several phrasings, retrieves for each, and unions the results.',
      pro: ['Rescues badly phrased user questions', 'Improves recall with no reindexing', 'Two lines to add'],
      con: ['An extra model call plus several searches per question', 'Can drag in loosely related material'],
      use: 'Users ask in a vocabulary that does not match the documents.' },
    { n: 'ParentDocumentRetriever', by: 'LangChain', mark: '⇱', c: '#22d3ee',
      what: 'Search over small precise chunks, then hand the model the larger parent section they came from.',
      pro: ['Precise matching and full context at once', 'Fixes answers that are cut off mid-explanation', 'No reranker needed to get the benefit'],
      con: ['Two stores to manage: chunks and parents', 'Parent sections can blow the context budget'],
      use: 'Retrieval finds the right paragraph but the answer lacks surrounding context.' },
    { n: 'Ragas', by: 'Exploding Gradients', mark: '📏', c: '#60a5fa',
      what: 'Faithfulness, answer relevancy, context precision and recall — mostly without gold answers.',
      pro: ['Start measuring immediately with no labelled data', 'Separates retrieval failures from generation failures', 'Can synthesise a test set from your documents'],
      con: ['Scores depend on the judge model', 'Relative trends, not absolute truth'],
      use: 'Before you change anything, so you can tell whether the change helped.' }
  ]
};

/* ---------- Ch: tools & agents ---------- */
C.toolstrips.agents = {
  title: 'Tools & frameworks — agents in LangChain',
  sub: 'The important thing to know here is which of these is current. A lot of tutorials still teach the deprecated one.',
  tools: [
    { n: 'create_react_agent', by: 'LangGraph', mark: '🕹', c: '#1c3c3c',
      what: 'The current prebuilt agent: a ReAct loop built on LangGraph, so it gets checkpointing and streaming free.',
      pro: ['Same convenience as the old executor plus durable state', 'interrupt() gives real human approval gates', 'Streams intermediate steps'],
      con: ['Prebuilt means less control than a hand-written graph', 'You still add cost caps yourself'],
      use: 'The default modern answer for "give me an agent loop".' },
    { n: 'AgentExecutor', by: 'LangChain', mark: '⚠', c: '#94a3b8',
      what: 'The classic loop most tutorials still show. Now legacy, superseded by the LangGraph prebuilts.',
      pro: ['Enormous amount of existing example code', 'Simple mental model', 'Still works'],
      con: ['No durable state, so a crash loses the run', 'Deprecated — knowing that is itself the interview point'],
      use: 'Reading old code. Do not start here.' },
    { n: '@tool', by: 'LangChain', mark: 'fn', c: '#22d3ee',
      what: 'A decorator turning a typed Python function into a tool definition, schema from hints and docstring.',
      pro: ['One decorator and it works with every loop here', 'Args schema can be a Pydantic model for validation', 'Hundreds of ready-made tools already use it'],
      con: ['A vague docstring means the model never calls it', 'Errors returned as strings need shaping or they confuse the model'],
      use: 'Every tool you write. The docstring is prompt engineering, not documentation.' },
    { n: 'langchain-mcp-adapters', by: 'LangChain', mark: '🔌', c: '#d97757',
      what: 'Turns tools exposed by any MCP server into LangChain tools your agent can use.',
      pro: ['Reuse tool servers written for other assistants', 'No bespoke wrapper per integration', 'Tool permissions live in the server, not the prompt'],
      con: ['Another process to run and secure', 'Server output is untrusted text that can carry an instruction'],
      use: 'The tools you need already exist as MCP servers, or must be shared across clients.' },
    { n: 'Tool-calling directly', by: 'the provider SDK', mark: '{}', c: '#10a37f',
      what: 'bind_tools plus your own thirty-line loop, with the caps you want and nothing hidden.',
      pro: ['Every guard visible: step cap, cost ceiling, repeat detection', 'No framework behaviour to reverse-engineer', 'Often the honest answer for two tools'],
      con: ['You rebuild streaming, retries and tracing', 'Stops scaling once orchestration gets real'],
      use: 'Simple agents where a framework would be more code than the solution.' }
  ]
};

/* ---------- Ch: ship it ---------- */
C.toolstrips.ship = {
  title: 'Tools & frameworks — shipping a LangChain app',
  sub: 'A chain that works in a notebook is a third of the job. These are the pieces between that and something with users on it.',
  tools: [
    { n: 'FastAPI', by: 'Sebastián Ramírez', mark: '🚪', c: '#009688',
      what: 'The async service around the chain: validated requests, streamed tokens, background jobs.',
      pro: ['Async suits calls that are mostly waiting on a provider', 'astream_events maps cleanly onto Server-Sent Events', 'Depends() for auth, rate limits and tracing'],
      con: ['A blocking call stalls the whole event loop', 'Timeouts must line up across every layer'],
      use: 'Any chain other software will call.' },
    { n: 'LangSmith', by: 'LangChain', mark: 'ls', c: '#1c3c3c',
      what: 'Set two environment variables and every chain, retrieval and tool call appears as a nested span.',
      pro: ['Genuinely zero-config for LangChain code', 'Turn production traces into a regression dataset', 'Prompt versioning outside the code'],
      con: ['Hosted by default; self-host is enterprise only', 'Pulls you further into one ecosystem'],
      use: 'Before real users, not after the first incident.' },
    { n: 'Langfuse', by: 'Langfuse', mark: 'lf', c: '#34d399',
      what: 'The open-source alternative: same tracing and evals, self-hostable, framework-agnostic.',
      pro: ['Traces stay inside your network', 'OpenTelemetry, so it covers your other services too', 'Cost per trace, user and session'],
      con: ['You operate Postgres, ClickHouse and a queue', 'More setup than a signup'],
      use: 'Traces contain data that cannot leave, or you want no lock-in.' },
    { n: 'Redis semantic cache', by: 'Redis', mark: '⚡', c: '#dc382d',
      what: 'Embed the question, look for a near-identical earlier one, serve the stored answer and skip the model.',
      pro: ['Cuts spend and latency on repetitive traffic directly', 'Two lines via the LangChain cache interface', 'Doubles as session and rate-limit store'],
      con: ['A loose similarity threshold serves confidently wrong answers', 'RAM is expensive per GB'],
      use: 'Support and FAQ traffic where the same question arrives all day.' },
    { n: 'Docker', by: 'Docker', mark: '🐳', c: '#2496ed',
      what: 'Pin the Python, the system libraries and the model client versions into one reproducible image.',
      pro: ['Same image in CI and production', 'Parser system dependencies stop being a mystery', 'Everything below deploys it'],
      con: ['Images get large fast', 'Layer caching mistakes make builds crawl'],
      use: 'Anything leaving your laptop.' }
  ]
};
