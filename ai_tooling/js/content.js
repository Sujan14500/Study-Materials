/* ============================================================
   content.js — the spine of the course.

   The tool catalogue itself is large, so it is split across
   js/cat-*.js the same way ai_interview_prep splits js/bank-*.js.
   Each cat-*.js file pushes onto C.cats. Load order in index.html
   is the order the chapters appear.

   Shape of a category:
     { id, n, ico, color, tag,
       two   : two lines — what this layer is and why it exists,
       pts   : five things to say about the LAYER,
       tools : [ { id, n, by, kind,
                   two   : two lines — what it is, who made it,
                   pts   : five things to say about the TOOL,
                   pick  : the one sentence for "when would you use it",
                   watch : the honest downside an interviewer will probe } ] }

   Every tool has a two-line summary and at least five points.
   test.js enforces both, because "five points on everything" is
   the entire promise of this course.
   ============================================================ */
window.C = { cats: [] };

/* ---------- the map: which layer answers which question ---------- */
C.mapQuestions = [
  { q: 'What produces the words?',                     cat: 'llm' },
  { q: 'Who decides what happens next?',               cat: 'agentic' },
  { q: 'Where do the facts come from?',                cat: 'rag' },
  { q: 'How does text become a number?',               cat: 'embed' },
  { q: 'How does the model reach my systems?',         cat: 'mcp' },
  { q: 'What stops it doing something stupid?',        cat: 'sec' },
  { q: 'How do I know what it did?',                   cat: 'obs' },
  { q: 'What does it remember next time?',             cat: 'mem' },
  { q: 'What runs the loop in production?',            cat: 'agent' },
  { q: 'What triggers it and what happens after?',     cat: 'auto' },
  { q: 'Where do the vectors live?',                   cat: 'vdb' },
  { q: 'How does a human actually reach it?',          cat: 'app' }
];

/* ---------- Chapter: pick the right tool ---------- */
C.picker = [
  { s: 'A bank will not let customer data leave its own network, and needs a chat assistant over internal policy documents.',
    a: ['llama', 'vllm'],
    why: 'Data residency decides this before anything else. Open weights you host (Llama) served by something that survives concurrency (vLLM). A hosted API is disqualified in the first sentence, not the last.' },
  { s: 'RAG answers are wrong about half the time. Retrieval returns 20 chunks and the right one is usually in there somewhere, around position 12.',
    a: ['rerank'],
    why: 'The right chunk is being retrieved and then buried. That is a ranking problem, not a retrieval or generation problem — a cross-encoder reranker is the highest value-per-hour fix available.' },
  { s: 'An agent occasionally issues a refund it should not. Nobody can reconstruct why after the fact.',
    a: ['langsmith', 'langgraph'],
    why: 'Two separate holes. Tracing (LangSmith) to see the run, and a checkpointed graph with an interrupt (LangGraph) so money never moves without a human step.' },
  { s: 'Users paste text that sometimes contains names, card numbers and national IDs, and it is all going to a hosted model.',
    a: ['presidio'],
    why: 'PII redaction before the request leaves your network. Presidio detects and anonymises, and can reversibly restore the entities in the response.' },
  { s: 'A support bot must remember, across weeks and sessions, that this customer is on the enterprise plan and hates phone calls.',
    a: ['mem0', 'zep'],
    why: 'Cross-session user facts, not conversation buffer. A memory layer that extracts and updates durable facts, not a longer context window.' },
  { s: 'Ten million document chunks, sub-100ms search, a two-person team with no infrastructure engineer.',
    a: ['pinecone'],
    why: 'Scale needs a real ANN index; no ops capacity rules out self-hosting. Fully managed is the honest answer even though it costs more per month.' },
  { s: 'Fifty thousand chunks in a Postgres database the team already runs and backs up.',
    a: ['pgvector'],
    why: 'At this scale a dedicated vector database buys you nothing and costs you a system to operate. One database, transactional joins between vectors and metadata, existing backups.' },
  { s: 'A nightly job must pull yesterday\'s tickets, summarise them, write to a warehouse, and page someone if it fails.',
    a: ['airflow'],
    why: 'Scheduled batch data work with dependencies, retries and alerting. That is an orchestrator, and the LLM call is one task inside it — not the thing driving it.' },
  { s: 'A long-running agent must survive a process crash halfway through and resume without redoing paid work.',
    a: ['temporal', 'langgraph'],
    why: 'Durable execution. Either a checkpointed graph or a workflow engine with persisted state. A plain retry loop repeats the expensive steps.' },
  { s: 'The team wants an internal Slack workflow that files a Jira ticket, with no engineer available to maintain it.',
    a: ['n8n', 'zapier'],
    why: 'Connector-plumbing, not model engineering. A no-code automation tool is the correct, unglamorous answer and refusing to say so reads as inexperience.' },
  { s: 'Before every release, prove that changing the system prompt did not make five hundred known cases worse.',
    a: ['promptfoo', 'ragas'],
    why: 'A regression eval in CI. Declarative test cases with assertions, plus RAG-specific metrics if retrieval is in scope.' },
  { s: 'A coding assistant should read the repo, run tests and open pull requests, using the same tool definitions as three other assistants.',
    a: ['mcp', 'ghmcp'],
    why: 'Tools that must be shared across several clients. Write them once as an MCP server rather than four times as bespoke function wrappers.' },
  { s: 'Two analysts need to try the new summariser by Friday. Nobody will call it from code and nobody will maintain a front end.',
    a: ['streamlit'],
    why: 'A demo for humans on a deadline. A script that reruns top to bottom is exactly right here, and reaching for React would be the wrong instinct to show.' },
  { s: 'The mobile team needs a streaming endpoint that returns tokens as they arrive, with per-user rate limits and validated JSON.',
    a: ['fastapi'],
    why: 'Software calling software. Async handler, StreamingResponse for tokens, Pydantic for the contract, dependencies for rate limiting. This is a service, not a UI.' }
];
C.pickerTools = {
  llama:     { n: 'Meta Llama',        ico: '🦙' },
  vllm:      { n: 'vLLM',              ico: '⚡' },
  gpt:       { n: 'OpenAI GPT',        ico: '🟢' },
  rerank:    { n: 'Cohere Rerank',     ico: '🎯' },
  langsmith: { n: 'LangSmith',         ico: '🔬' },
  langgraph: { n: 'LangGraph',         ico: '🕹️' },
  presidio:  { n: 'Presidio',          ico: '🕵️' },
  mem0:      { n: 'Mem0',              ico: '🧷' },
  zep:       { n: 'Zep',               ico: '⏳' },
  pinecone:  { n: 'Pinecone',          ico: '🌲' },
  pgvector:  { n: 'pgvector',          ico: '🐘' },
  airflow:   { n: 'Apache Airflow',    ico: '🌬️' },
  temporal:  { n: 'Temporal',          ico: '⏱️' },
  n8n:       { n: 'n8n',               ico: '🔗' },
  zapier:    { n: 'Zapier',            ico: '⚡' },
  promptfoo: { n: 'Promptfoo',         ico: '🧪' },
  ragas:     { n: 'Ragas',             ico: '📏' },
  mcp:       { n: 'MCP',               ico: '🔌' },
  ghmcp:     { n: 'GitHub MCP Server', ico: '🐙' },
  fastapi:   { n: 'FastAPI',           ico: '🚪' },
  streamlit: { n: 'Streamlit',         ico: '🎈' }
};

/* ---------- Chapter: the honest build-vs-buy ladder ---------- */
C.ladder = [
  { n: 'Model API only',
    what: 'One HTTP call. Your own thirty-line loop if you need tools.',
    when: 'Prototypes, single-purpose features, and more production systems than anyone admits.',
    cost: 'Lowest complexity' },
  { n: '+ a vector store',
    what: 'Add pgvector or Chroma and you have RAG.',
    when: 'The moment the model needs facts it was not trained on.',
    cost: 'One more system' },
  { n: '+ a framework',
    what: 'LangChain or LlamaIndex for loaders, splitters, retrievers and interfaces.',
    when: 'When you are about to write the fifth document loader by hand.',
    cost: 'A dependency with opinions' },
  { n: '+ orchestration',
    what: 'LangGraph or equivalent: durable state, interrupts, resumable runs.',
    when: 'When a crash mid-run, or a human approval step, actually matters.',
    cost: 'Real learning curve' },
  { n: '+ observability',
    what: 'LangSmith, Langfuse or Phoenix. Traces, costs, latency, failures.',
    when: 'Before real users, not after the first incident.',
    cost: 'Cheap. Skipping it is not.' },
  { n: '+ guardrails and evals',
    what: 'Input/output validation, PII redaction, a regression suite in CI.',
    when: 'Before anything irreversible or customer-facing ships.',
    cost: 'Slows releases, saves careers' },
  { n: '+ the rest',
    what: 'Memory services, MCP servers, rerankers, workflow engines, self-hosted serving.',
    when: 'Each one only when a specific measured problem demands it.',
    cost: 'Every addition is a thing to operate' }
];

/* ---------- Chapter: rapid fire ---------- */
C.rapid = [
  { q: 'LangChain vs LangGraph?',
    a: 'LangChain is components and integrations for building LLM apps. LangGraph is stateful orchestration — a graph with durable checkpoints, interrupts and resumable runs. Same organisation; use LangChain for the pieces and LangGraph when control flow and recovery matter.' },
  { q: 'LangChain vs LlamaIndex?',
    a: 'LangChain is broad application glue with the biggest integration catalogue. LlamaIndex is deep on the data path — parsing, indexing and advanced retrieval. Using both is a normal answer, not a cop-out.' },
  { q: 'When would you NOT use a framework?',
    a: 'When the task is one model call with two tools. A thirty-line loop you can read beats a dependency you cannot debug. Frameworks earn their place at integration breadth or orchestration complexity, not at hello world.' },
  { q: 'Pinecone vs pgvector?',
    a: 'pgvector until it hurts — one database, transactional consistency, existing backups. Pinecone when scale, latency SLOs or lack of ops capacity make a managed ANN index worth the bill. The crossover is roughly the low millions of vectors.' },
  { q: 'What is MCP in one sentence?',
    a: 'An open protocol that standardises how an LLM application discovers and calls external tools, resources and prompts — so you write a tool server once instead of once per client.' },
  { q: 'Ragas vs Promptfoo?',
    a: 'Ragas measures RAG-specific quality (faithfulness, context precision, answer relevancy). Promptfoo is a general declarative eval and red-team harness that runs in CI. They stack: Promptfoo runs the suite, Ragas supplies RAG metrics.' },
  { q: 'LangSmith vs Langfuse?',
    a: 'Same job — tracing, evals, prompt management, cost tracking. LangSmith is LangChain-native and hosted (self-host on enterprise). Langfuse is open source, self-hostable, framework-agnostic, OpenTelemetry-friendly. Pick on hosting and lock-in, not features.' },
  { q: 'Mem0 vs a longer context window?',
    a: 'Context is per-conversation and you pay for it every turn. Memory is cross-session, extracted, deduplicated and searchable. If the fact must survive next Tuesday, it is memory; if it only matters this turn, it is context.' },
  { q: 'Airflow vs Temporal vs n8n?',
    a: 'Airflow: scheduled batch DAGs for data work. Temporal: durable execution for long-running stateful workflows that must survive crashes. n8n: node-based connector automation for business plumbing. Different problems that look similar on a slide.' },
  { q: 'Guardrails: input side or output side?',
    a: 'Both, and they are different jobs. Input: prompt injection, jailbreaks, PII redaction before the call. Output: schema validation, groundedness, toxicity, leaked secrets. An output-only guardrail cannot stop an injected instruction from firing a tool.' },
  { q: 'Ollama vs vLLM?',
    a: 'Ollama is single-user local convenience. vLLM is a throughput server with PagedAttention and continuous batching. Ollama on a laptop, vLLM behind traffic. Confusing the two is the trap in the question.' },
  { q: 'Which embedding model should we use?',
    a: 'Start with a hosted default, then evaluate on your own retrieval set — MTEB rankings do not transfer to your domain. Decide dimensions against storage cost, and remember that changing model means reindexing everything.' },
  { q: 'Do you need a vector database at all?',
    a: 'Often no. Under about a hundred thousand chunks, pgvector or even brute-force numpy is fine and the vector database is a system you now operate for nothing. Scale, latency SLOs and filtering complexity are what justify it.' },
  { q: 'Cheapest big win in a bad RAG system?',
    a: 'Fix retrieval before touching the model. Hybrid search plus a reranker, in that order, then look at chunking. Swapping to a bigger model is the expensive way to not fix the problem.' },
  { q: 'How do you stop an agent costing $400 in one run?',
    a: 'Step cap, cost ceiling checked every iteration, repeat-call detection, and a named degraded outcome when either budget is hit. Those four guards are the difference between a demo and something you can bill for.' },
  { q: 'FastAPI or Streamlit?',
    a: 'Different jobs. FastAPI is an async API for software to call — validated contracts, streaming, auth, rate limits. Streamlit is a UI for humans and reruns the whole script on every interaction. The usual production shape is a Streamlit or React front end talking to a FastAPI service.' },
  { q: 'Why does async matter so much for an LLM API?',
    a: 'The work is I/O-bound — you are waiting on someone else\'s network, not burning CPU. Async lets one worker hold hundreds of in-flight requests instead of one thread each, so concurrency is limited by the upstream API, not by your process count.' },
  { q: 'How do you stream tokens to a browser?',
    a: 'Server-Sent Events over a StreamingResponse for the common one-way case; WebSockets when you need bidirectional. It does not make generation faster — it collapses time-to-first-token, which is the latency users actually perceive.' },
  { q: 'Why does a Streamlit app get slow?',
    a: 'Because the script reruns top to bottom on every interaction, so anything not wrapped in st.cache_resource — the model client, the vector store connection, the embedded corpus — is rebuilt on every keystroke. Session state is the only thing that survives.' },
  { q: 'What is FastMCP\'s relationship to FastAPI?',
    a: 'Same ergonomics, different protocol. FastAPI turns a typed function into an HTTP endpoint with a generated schema; FastMCP turns a typed function into an MCP tool with a generated schema. If you can write one you can write the other.' }
];

/* ---------- Chapter: quiz ---------- */
C.quiz = [
  { q: 'A team says "we use LangChain, so we do not need observability". What is wrong?',
    o: ['Nothing — LangChain traces automatically',
        'Framework choice and tracing are unrelated; you still need traces, costs and failure records',
        'LangChain replaces the need for evals',
        'Observability only matters for self-hosted models'],
    a: 1,
    e: 'A framework structures your code. It does not tell you what a specific run cost, which retrieval returned rubbish, or why yesterday\'s answer was better. LangSmith exists precisely because LangChain does not do this on its own.' },
  { q: 'Which of these is NOT a vector database?',
    o: ['Qdrant', 'Weaviate', 'Unstructured', 'Milvus'],
    a: 2,
    e: 'Unstructured is document ingestion — it turns PDFs and Word files into typed elements. It sits several stages before storage in the pipeline.' },
  { q: 'MCP mainly solves which problem?',
    o: ['Making models cheaper to run',
        'The N-clients-times-M-tools integration explosion',
        'Vector search recall',
        'Prompt optimisation'],
    a: 1,
    e: 'Without a protocol, every client writes its own wrapper for every tool. MCP makes it write-once, use-anywhere — the same argument as LSP for editors.' },
  { q: 'Retrieval returns the right chunk at rank 14 out of 20 and the answer is still wrong. Best next move?',
    o: ['Switch to a bigger generation model',
        'Add a cross-encoder reranker',
        'Increase chunk size',
        'Fine-tune the embedding model'],
    a: 1,
    e: 'The information is being retrieved and then buried. Reranking is exactly the stage that fixes ordering, and it is far cheaper than fine-tuning or a bigger model.' },
  { q: 'Which pair does the SAME job?',
    o: ['Airflow and Presidio',
        'LangSmith and Langfuse',
        'vLLM and Pinecone',
        'DSPy and Qdrant'],
    a: 1,
    e: 'Both are LLM observability and evaluation platforms. The real difference is hosting model and framework neutrality, not capability.' },
  { q: 'You must guarantee an agent never sends an email without approval. Which layer?',
    o: ['A better system prompt',
        'A stricter output guardrail',
        'A human-in-the-loop interrupt before the tool executes',
        'A lower temperature'],
    a: 2,
    e: 'Prompts and guardrails are probabilistic. A gate in your own code before the side effect fires is deterministic. Never defend an irreversible action with a prompt.' },
  { q: 'Which is an ingestion tool rather than a framework?',
    o: ['Haystack', 'Unstructured', 'CrewAI', 'Semantic Kernel'],
    a: 1,
    e: 'Unstructured partitions documents into typed elements. The other three orchestrate calls.' },
  { q: 'Your embedding model changes from 1536 to 3072 dimensions. What must happen?',
    o: ['Nothing, the index adapts',
        'Reindex every document — old and new vectors are not comparable',
        'Only new documents need embedding',
        'Change the reranker'],
    a: 1,
    e: 'Embeddings from different models live in different spaces. Mixing them silently destroys retrieval quality, which is the worst kind of bug because nothing errors.' },
  { q: 'Which tool would you reach for to redact PII before a hosted API call?',
    o: ['Microsoft Presidio', 'Ragas', 'Prefect', 'BGE'],
    a: 0,
    e: 'Presidio detects and anonymises PII, with reversible operators so the response can be rehydrated.' },
  { q: 'The strongest argument against a multi-agent design is:',
    o: ['Agents cannot share tools',
        'Every extra agent adds a context window, a handoff and a failure mode',
        'Frameworks do not support it',
        'It is always slower than a single call'],
    a: 1,
    e: 'Multi-agent multiplies cost and lost information at handoffs. Justify it with different tools or different permissions per agent, not with the org chart.' },
  { q: 'Which is a durable-execution engine rather than an agent framework?',
    o: ['Temporal', 'Agno', 'CAMEL', 'PydanticAI'],
    a: 0,
    e: 'Temporal persists workflow state so a workflow survives process death and resumes exactly where it stopped. It is infrastructure that agents can sit on top of.' },
  { q: 'A Streamlit chat app reloads the embedding model on every message. The fix is:',
    o: ['Use a faster model',
        'Wrap the loader in @st.cache_resource',
        'Move the code to the top of the file',
        'Increase the worker count'],
    a: 1,
    e: 'Streamlit reruns the whole script on every interaction. cache_resource keeps expensive objects — model clients, database connections — alive across reruns. Not knowing this is the most common Streamlit bug there is.' },
  { q: 'Why is async the right default for a FastAPI endpoint that calls an LLM?',
    o: ['It makes the model generate faster',
        'The work is I/O-bound, so one worker can hold many in-flight requests instead of one thread each',
        'It reduces token cost',
        'It is required for Pydantic validation'],
    a: 1,
    e: 'You are waiting on someone else\'s network. Async trades blocked threads for concurrency. Note the trap: a blocking call inside an async handler stalls the entire event loop and undoes all of it.' },
  { q: 'A prototype does 40 requests a day. The team wants to self-host Llama "to save money". The best response is:',
    o: ['Agree — self-hosting is always cheaper',
        'Do the crossover arithmetic; at that volume a GPU idles and costs more than the API',
        'Self-host but on CPU',
        'Use a smaller hosted model instead of doing the maths'],
    a: 1,
    e: 'Self-hosting wins on steady high volume, not on burst developer traffic. An idle GPU bills all day for forty calls. The right answer is a number, not an opinion.' }
];

/* ============================================================
   Animated architecture diagrams — MCP vs RAG vs AI Agent.
   Three pictures of the same stack, seen from three angles.
   Shape:
     { title, lead, note, w, h,
       nodes : [ { id, x, y, w, h, ico, n, s, c } ],
       edges : [ { f, t, l, o } ]  — o offsets the anchor along the
               box edge, so two edges between the same pair of boxes
               do not draw on top of each other,
       steps : [ { t, n:[node ids lit], e:['from>to' edges lit], say } ] }
   demos.js draws it. Nothing here knows about SVG.
   ============================================================ */
const NW = 168, NH = 68;   /* every box is the same size on purpose */
const box = (id, x, y, ico, n, s, c) => ({ id, x, y, w: NW, h: NH, ico, n, s, c });

C.arch = {

  mcp: {
    lead: 'The host owns the model. Each server owns one system. The protocol in the middle is the only part that is standard, and that is the entire point.',
    note: 'MCP is the port, not the brain. It standardises <b>how</b> a model reaches a tool. Deciding <b>which</b> tool is the agent’s job.',
    w: 940, h: 320,
    nodes: [
      box('host', 14, 126, '🖥️', 'MCP Host', 'Claude Desktop · IDE', '#34d399'),
      box('c1', 246, 24, '🔌', 'MCP Client', 'session A · stdio', '#22d3ee'),
      box('c2', 246, 126, '🔌', 'MCP Client', 'session B · HTTP', '#22d3ee'),
      box('c3', 246, 228, '🔌', 'MCP Client', 'session C · stdio', '#22d3ee'),
      box('s1', 478, 24, '🧩', 'MCP Server A', 'GitHub · Slack', '#7c5cff'),
      box('s2', 478, 126, '🧩', 'MCP Server B', 'Postgres', '#7c5cff'),
      box('s3', 478, 228, '🧩', 'MCP Server C', 'filesystem', '#7c5cff'),
      box('t1', 760, 24, '🌐', 'Web APIs', 'their rate limit, not yours', '#fbbf24'),
      box('t2', 760, 126, '🗄️', 'Database', 'its own credentials', '#fbbf24'),
      box('t3', 760, 228, '📁', 'Files', 'a scoped root', '#fbbf24')
    ],
    edges: [
      { f: 'host', t: 'c1' }, { f: 'host', t: 'c2', l: 'spawns 1:1' }, { f: 'host', t: 'c3' },
      { f: 'c1', t: 's1' }, { f: 'c2', t: 's2', l: 'JSON-RPC' }, { f: 'c3', t: 's3' },
      { f: 's1', t: 't1', l: 'invokes APIs' }, { f: 's2', t: 't2', l: 'runs queries' }, { f: 's3', t: 't3', l: 'reads / writes' }
    ],
    steps: [
      { t: 'The host starts one client per server',
        n: ['host', 'c1', 'c2', 'c3'], e: ['host>c1', 'host>c2', 'host>c3'],
        say: 'Your config lists the servers. The host opens a separate 1:1 client session for each one, so a server can never see another server’s traffic. That isolation is structural, not a policy you have to remember.' },
      { t: 'Handshake, then discovery',
        n: ['c1', 'c2', 'c3', 's1', 's2', 's3'], e: ['c1>s1', 'c2>s2', 'c3>s3'],
        say: '<code>initialize</code>, then <code>tools/list</code>, <code>resources/list</code>, <code>prompts/list</code>. The model learns names and JSON schemas at run time — nothing is compiled into the app, which is why you can add a server without shipping code.' },
      { t: 'The model picks a tool',
        n: ['host', 'c2'], e: ['host>c2'],
        say: 'The LLM emits a tool call by name and the host routes it to the client that owns that tool as <code>tools/call</code>. This is the one decision MCP does not make for you.' },
      { t: 'The server does the real work',
        n: ['s1', 's2', 's3', 't1', 't2', 't3'], e: ['s1>t1', 's2>t2', 's3>t3'],
        say: 'The server runs with <b>its own</b> credentials, not the model’s. Least privilege lives here: a read-only database role on the server is a real boundary, a sentence in a system prompt asking it to be careful is not.' },
      { t: 'The result returns as untrusted text',
        n: ['t2', 's2', 'c2', 'host'], e: ['s2>t2', 'c2>s2', 'host>c2'],
        say: 'Everything coming back is data that may carry an instruction. Treat tool output as content, never as command, and keep human approval on writes. That pair is most of MCP security.' }
    ]
  },

  rag: {
    lead: 'Five hops, and the interesting one is the third. If the right chunk does not come back, no model and no prompt can save the answer.',
    note: 'RAG changes what the model <b>knows</b>, not what it can <b>do</b>. The weights never move; the facts arrive at run time.',
    w: 940, h: 348,
    nodes: [
      box('user', 14, 122, '🧑', 'User', 'asks in plain language', '#34d399'),
      box('ret', 262, 122, '🔎', 'Retriever', 'embed → search → rerank', '#22d3ee'),
      box('kb', 262, 256, '📚', 'Knowledge base', 'PDFs · vector DB · code', '#f472b6'),
      box('llm', 520, 122, '🧠', 'LLM', 'GPT · Claude · Gemini', '#7c5cff'),
      box('ans', 758, 122, '💬', 'Answer', 'grounded, with citations', '#fbbf24')
    ],
    edges: [
      { f: 'user', t: 'ret', l: '1 · user query' },
      { f: 'ret', t: 'kb', l: '2 · search', o: -36 },
      { f: 'kb', t: 'ret', l: '3 · top-k chunks', o: 36 },
      { f: 'ret', t: 'llm', l: '4 · query + docs' },
      { f: 'llm', t: 'ans', l: '5 · response' }
    ],
    steps: [
      { t: 'The question arrives', n: ['user', 'ret'], e: ['user>ret'],
        say: 'Nothing has reached the model yet. In production the query is usually rewritten first — pronouns resolved, the last few turns folded in — because “and what about the second one?” retrieves nothing on its own.' },
      { t: 'Retrieve', n: ['ret', 'kb'], e: ['ret>kb'],
        say: 'The query becomes a vector and the store returns approximate nearest neighbours. Vector-only search misses exact IDs and error codes, so real systems run keyword search in the same pass and fuse the two lists.' },
      { t: 'The chunks come back — this is the step that fails', n: ['kb', 'ret'], e: ['kb>ret'],
        say: 'Top-k by cosine is a rough sort; a reranker re-orders it by real relevance. Most “the LLM hallucinated” bugs are this line returning the wrong five paragraphs, and you cannot see it unless you log what was retrieved.' },
      { t: 'Assemble the prompt', n: ['ret', 'llm'], e: ['ret>llm'],
        say: 'Question, plus chunks, plus an instruction to answer only from them and cite the source. Those chunks are ordinary context tokens and you pay for them on every call — which is where the RAG bill actually comes from.' },
      { t: 'Generate', n: ['llm', 'ans'], e: ['llm>ans'],
        say: 'The answer is grounded in text you can point at. Edit a document and the next question sees the change as soon as the index does. No retraining is the whole reason this pattern won.' }
    ]
  },

  agent: {
    lead: 'Memory on one side, tools on the other, a human holding the leash. The loop in the middle is what you are actually paying for.',
    note: 'An agent <b>decides</b>. RAG feeds it facts, MCP gives it a plug. Agency is the expensive part — buy it only for uncertainty you cannot remove.',
    w: 940, h: 366,
    nodes: [
      box('human', 14, 148, '🧑‍✈️', 'Human control', 'goal + autonomy level', '#34d399'),
      box('mem', 262, 20, '🧠', 'Memory', 'what it learned last time', '#f472b6'),
      box('agent', 262, 148, '🤖', 'AI Agent', 'plans · picks next step', '#7c5cff'),
      box('tools', 552, 20, '🔧', 'Tools', 'APIs · web · code · MCP', '#22d3ee'),
      box('env', 552, 278, '🌍', 'Environment', 'real side effects', '#fbbf24'),
      box('out', 758, 148, '✅', 'Result', 'an answer — or an ask', '#34d399')
    ],
    edges: [
      { f: 'human', t: 'agent', l: 'delegates' },
      { f: 'agent', t: 'mem', l: 'read / write' },
      { f: 'agent', t: 'tools', l: 'tool invocation', o: -14 },
      { f: 'tools', t: 'env', l: 'action' },
      { f: 'env', t: 'agent', l: 'observation' },
      { f: 'agent', t: 'out', l: 'stops when done', o: 14 }
    ],
    steps: [
      { t: 'A human delegates — and sets the leash', n: ['human', 'agent'], e: ['human>agent'],
        say: 'The autonomy level is the cheapest safety control you own: what it may do alone, what needs approval, what is simply forbidden. Teams that skip this end up arguing about model quality when the real problem is permissions.' },
      { t: 'It reads memory before it thinks', n: ['agent', 'mem'], e: ['agent>mem'],
        say: 'Context is not memory. Context dies with the run; memory is written on purpose and retrieved on purpose, which is why “remember I prefer metric units” is a storage decision, not a prompt.' },
      { t: 'It picks a tool', n: ['agent', 'tools'], e: ['agent>tools'],
        say: 'This is the one thing that makes it an agent: the next call depends on the last observation, so you cannot draw the flowchart in advance. If you can draw it, you wanted a chain and it would have been cheaper.' },
      { t: 'The action lands in the real world', n: ['tools', 'env'], e: ['tools>env'],
        say: 'Not a sandbox — a ticket is created, an email goes out, a row changes. Irreversible actions belong behind approval, and every write wants an idempotency key, because a retried agent will happily do it twice.' },
      { t: 'The observation comes back, and it re-plans', n: ['env', 'agent'], e: ['env>agent'],
        say: 'Round the loop again. Every turn resends the whole transcript, so cost grows quadratically and one wrong step early poisons everything after it. Cap the turns, cap the tokens, and log every step or you cannot debug it.' },
      { t: 'It stops — or it asks', n: ['agent', 'out'], e: ['agent>out'],
        say: 'Knowing when to stop is a design decision, not an emergent one. The honest ending for a task it may not finish alone is escalation to the human, not a confident guess.' }
    ]
  }
};
