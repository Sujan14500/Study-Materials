/* ============================================================
   cat-state.js — what it remembers, what runs it, and where
   the vectors live.
   Memory · AI Agent · Automation · Vector Database
   ============================================================ */
C.cats.push(

/* ============================================================ *
 * 8. MEMORY                                                    *
 * ============================================================ */
{
  id: 'mem', n: 'Memory', ico: '🧷', color: '#a78bfa', tag: 'what survives the session',
  two: 'Everything that lets an assistant know something next Tuesday that it learned today. The context window is not memory — it is a buffer you pay for on every single turn.',
  pts: [
    'Four kinds, and naming them cleanly is most of the answer. <b>Working</b> (this conversation, in context), <b>episodic</b> (what happened in past sessions), <b>semantic</b> (durable facts about the user or world), <b>procedural</b> (learned how-to, usually baked into prompts or weights).',
    'The engineering job is not storage, it is <b>retrieval and forgetting</b>. Anyone can append messages to a table. Deciding what is worth keeping, what supersedes what, and what to inject into the next prompt is the hard part.',
    'Naive memory is a buffer; real memory is <b>extract, deduplicate, resolve conflicts, decay</b>. When a user says "actually I moved to Berlin", the old city fact must be updated, not appended alongside it.',
    'Cost is the reason this layer exists. Replaying a full transcript every turn is quadratic in tokens; a summary plus five retrieved facts is flat and usually more accurate.',
    'Privacy is a first-class concern here and interviewers probe it. Memory is durable personal data — it needs a deletion path, per-user isolation, and an answer to "what happens when they ask you to forget them".'
  ],
  tools: [
    { id:'mem0', n:'Mem0', by:'Mem0', kind:'service',
      two:'A memory layer that extracts durable facts from conversations, stores them across a vector store and a graph, and returns the relevant ones for the next prompt.',
      pts:[
        'The pipeline is <b>extract → decide → store</b>: an LLM pulls candidate facts, then a second decision step chooses ADD, UPDATE, DELETE or NOOP against what is already known.',
        'That conflict-resolution step is the actual product. Appending facts is easy; superseding a stale one correctly is not.',
        'Hybrid storage — vectors for semantic recall, a graph for relationships between entities, key-value for exact lookups.',
        'Memories are scoped by user, agent and session, so multi-tenant isolation is part of the model rather than a convention you enforce.',
        'The claimed win is token cost: inject a handful of relevant facts instead of the whole transcript. Quote it as a design argument, not a benchmark.'
      ],
      pick:'Assistants that must remember user preferences and history across sessions.',
      watch:'Every extraction is an LLM call. Memory is not free, it just moves the cost off the hot path.' },

    { id:'zep', n:'Zep', by:'Zep', kind:'service',
      two:'A memory service built on a temporal knowledge graph, so facts carry validity intervals and the system knows when something stopped being true.',
      pts:[
        '<b>Graphiti</b> is the open-source engine underneath — a temporally aware knowledge graph purpose-built for agent memory.',
        'The differentiator is <b>bi-temporal</b> modelling: every fact records when it was true and when it was recorded, so you can reconstruct what the agent believed at any past moment.',
        'Instead of deleting a superseded fact it <b>invalidates</b> it with an end date, which keeps history auditable — valuable when a decision must be explained later.',
        'It fuses semantic search, BM25 and graph traversal for retrieval rather than relying on vectors alone.',
        'It handles both conversation history and ingested business data in one graph, so user facts and domain facts are queried together.'
      ],
      pick:'Long-lived assistants where facts change over time and history must be explainable.',
      watch:'A graph is more moving parts than a table. Justify it with a real temporal requirement.' },

    { id:'letta', n:'Letta', by:'Letta (formerly MemGPT)', kind:'framework',
      two:'The productised form of MemGPT: agents that manage their own memory by paging information between limited context and external storage, like an operating system.',
      pts:[
        'The MemGPT insight is the OS analogy — treat the context window as RAM and external stores as disk, with the agent itself deciding what to page in and out.',
        'The agent has <b>tools to edit its own memory</b>, so self-editing memory blocks are a first-class capability rather than a wrapper trick.',
        'Memory is tiered: core memory always in context, recall memory for conversation history, archival memory for everything else.',
        'Agents are <b>stateful services</b> with persistent identity, so you talk to the same agent tomorrow rather than reconstructing it from a transcript.',
        'It is the clearest research lineage to cite when explaining that memory is a systems problem, not a prompt-length problem.'
      ],
      pick:'Long-running persistent agents that should curate their own knowledge over months.',
      watch:'Self-editing memory can drift or degrade. It needs monitoring like any other autonomous behaviour.' },

    { id:'lgmem', n:'LangGraph Memory', by:'LangChain', kind:'library',
      two:'LangGraph\'s built-in persistence: short-term memory through checkpointed thread state, and long-term memory through a cross-thread key-value store.',
      pts:[
        'Two clean layers: <b>checkpointers</b> persist the graph state of one thread, and the <b>Store</b> holds namespaced data shared across threads.',
        'Because it is the same mechanism as crash recovery, memory and durability are one feature rather than two systems.',
        'Namespaces are typically (user_id, category), which gives per-user isolation without extra plumbing.',
        'Store supports semantic search over stored items, so long-term memory can be retrieved by meaning rather than exact key.',
        'The advantage over a separate memory service is that there is no extra network hop or vendor — the trade is that you write the extraction logic yourself.'
      ],
      pick:'You are already on LangGraph and want memory without adding a service.',
      watch:'It gives you storage, not curation. Extraction, dedup and decay are still your code.' },

    { id:'redis', n:'Redis', by:'Redis', kind:'store',
      two:'The in-memory data store, used here as short-term session state, a semantic cache, and increasingly as a vector index in its own right.',
      pts:[
        'Sub-millisecond reads make it the natural home for the working set — active session state, conversation buffers, rate-limit counters.',
        '<b>Semantic caching</b> is the LLM-specific use: embed the query, look for a near-identical previous question, serve the stored answer and skip the model entirely.',
        'That cache is also the classic trap — too loose a similarity threshold and you confidently serve the answer to a different question.',
        'Redis Query Engine adds real vector indexing (HNSW and flat) with metadata filtering, so it can be your vector store at moderate scale.',
        'TTLs give you expiry for free, which maps neatly onto "a session is over after thirty minutes".'
      ],
      pick:'Session state, caching and a vector index when you already run Redis.',
      watch:'Memory-resident data is expensive per GB, and a semantic cache with a loose threshold is a correctness bug, not a perf win.' },

    { id:'pg', n:'PostgreSQL', by:'PostgreSQL', kind:'store',
      two:'The relational default, and a completely respectable memory backend: durable conversation history, structured user facts, and vectors via pgvector.',
      pts:[
        'One database for messages, users, permissions and vectors means <b>transactional consistency</b> — no dual-write problem between a metadata store and a vector store.',
        'JSONB lets you keep flexible fact documents without giving up SQL, indexes or constraints.',
        'You already have backups, replication, access control and a team that knows how to run it. That is worth more than most feature comparisons.',
        'pgvector turns it into a vector store, and pg_trgm or tsvector gives lexical search for hybrid retrieval in the same query.',
        'The honest ceiling: at very large vector counts a dedicated engine wins on latency, and that is the point to migrate — not before.'
      ],
      pick:'Almost every system under a few million vectors, and any system that needs joins between vectors and business data.',
      watch:'Vector indexes are memory-hungry. Watch shared_buffers and index build time before you promise latency.' },

    { id:'neo4j', n:'Neo4j', by:'Neo4j', kind:'graph',
      two:'The mainstream graph database, used for knowledge graphs behind GraphRAG-style retrieval and for relationship-heavy agent memory.',
      pts:[
        'Graphs answer the questions vectors cannot: multi-hop relationships, "who reports to whom", "what depends on this service", "how are these two entities connected".',
        '<b>Cypher</b> is the query language, and text-to-Cypher is the graph equivalent of text-to-SQL, with the same injection and permission concerns.',
        'It supports native vector indexes, so one database can do semantic search and graph traversal in a single query.',
        'The usual pattern is <b>hybrid</b>: vector search finds entry-point entities, then a traversal expands the neighbourhood for context.',
        'The real cost is building and maintaining the graph — entity extraction and resolution is an ongoing pipeline, not a one-off import.'
      ],
      pick:'Relationship-heavy domains and multi-hop questions where flat retrieval demonstrably fails.',
      watch:'Entity resolution is the hidden project. Two spellings of one customer become two nodes and wrong answers.' },

    { id:'chroma', n:'Chroma', by:'Chroma', kind:'vector',
      two:'The developer-friendly embedding database: an in-process store that runs from a pip install, with a client-server mode when you outgrow that.',
      pts:[
        'It is the fastest path from nothing to working retrieval — no server, no account, embeddings handled by default.',
        'Persistent local mode writes to disk, so a prototype survives a restart without any infrastructure.',
        'It carries documents, embeddings and metadata together and filters on metadata, which covers most prototype requirements.',
        'For memory specifically it is a natural fit for per-user collections in a small deployment.',
        'The trade is scale — it is designed for developer ergonomics first, and a dedicated engine wins well before ten million vectors.'
      ],
      pick:'Prototypes, local development, and small production systems.',
      watch:'Do not plan a large production rollout on the in-process mode. Know your migration target early.' }
  ]
},

/* ============================================================ *
 * 9. AI AGENT (vendor SDKs and managed runtimes)               *
 * ============================================================ */
{
  id: 'agent', n: 'AI Agent', ico: '🤖', color: '#38bdf8', tag: 'SDKs + runtimes',
  two: 'The vendor-supplied way to build and run an agent: an SDK from the model provider, or a managed runtime from a cloud. Less flexible than a framework, and far less for you to operate.',
  pts: [
    'This layer differs from the framework layer in <b>who runs it</b>. A framework is a library in your process; a managed agent service holds the state, the tools and the execution loop for you.',
    'The trade is always the same: managed runtimes give you identity, scaling, tracing and compliance for free, and take away control over the prompt, the loop and the failure behaviour.',
    'Every one of these converges on the same primitives — instructions, tools, a loop, state, handoffs and guardrails. Learn the primitives and the SDKs become surface details.',
    'Cloud agent services are also a <b>data boundary</b> decision. Where the conversation state lives matters as much to a compliance team as which model produced it.',
    'A useful senior answer: use the provider SDK for a single-purpose agent, a framework when orchestration gets complex, and your own loop when you need every guard to be visible.'
  ],
  tools: [
    { id:'oaisdk', n:'OpenAI Agents SDK', by:'OpenAI', kind:'sdk',
      two:'OpenAI\'s lightweight, production-focused agent framework — the successor to the experimental Swarm — built on four primitives and very little else.',
      pts:[
        'Four primitives: <b>Agents</b> (instructions plus tools), <b>Handoffs</b> (one agent transfers to another), <b>Guardrails</b> (input and output validation), <b>Sessions</b> (conversation state).',
        '<b>Handoffs</b> are the distinctive idea — delegation is itself a tool call, so routing between specialists is explicit and traceable.',
        'Python functions become tools automatically, with the schema derived from type hints and the docstring.',
        'Tracing is built in and visible in the OpenAI dashboard, so you get observability without adding a platform.',
        'It is deliberately minimal — few abstractions, readable source — which makes it a good answer to "frameworks are too heavy".'
      ],
      pick:'OpenAI-centric agents where you want structure without adopting a large framework.',
      watch:'Provider-shaped. Portability to another model family is not the design goal.' },

    { id:'lcagents', n:'LangChain Agents', by:'LangChain', kind:'library',
      two:'The agent abstractions in LangChain — historically the AgentExecutor, now largely superseded by prebuilt ReAct agents built on LangGraph.',
      pts:[
        'The classic <b>AgentExecutor</b> ran the ReAct loop for you and is what most tutorials still show; it is now legacy and worth saying so.',
        'The modern path is <b>create_react_agent</b> on LangGraph, which gives the same convenience plus checkpointing, interrupts and streaming.',
        'Its enduring value is the <b>tool ecosystem</b> — hundreds of ready-made integrations that work with any of these loops.',
        '@tool turns a typed Python function into a tool definition, which is the piece most people actually import.',
        'Knowing that the executor is deprecated in favour of the graph is a cheap way to show you track the ecosystem rather than the tutorials.'
      ],
      pick:'You want prebuilt agent loops plus the largest tool catalogue available.',
      watch:'Lots of stale tutorials teach the deprecated executor. Check what era the code you copy is from.' },

    { id:'pydanticai', n:'PydanticAI', by:'Pydantic', kind:'sdk',
      two:'An agent framework from the Pydantic team that brings type safety and validated structured output to LLM calls, with FastAPI-style ergonomics.',
      pts:[
        'Outputs are <b>Pydantic models</b>, validated on arrival, with automatic retries that feed the validation error back to the model.',
        'Full static typing means your IDE and type checker catch agent wiring mistakes before runtime — rare in this ecosystem.',
        'Dependency injection passes database connections, HTTP clients and config into tools cleanly instead of through globals.',
        'It is model-agnostic across OpenAI, Anthropic, Gemini, Groq and local models behind one interface.',
        'Pydantic already sits under most of these libraries, so this is the ecosystem\'s own foundation offering an opinion — worth noting.'
      ],
      pick:'Type-safe Python services where the model must return validated structured data.',
      watch:'Young relative to LangChain. Smaller integration surface, so you write more glue.' },

    { id:'sk', n:'Semantic Kernel', by:'Microsoft', kind:'sdk',
      two:'Microsoft\'s enterprise-grade SDK for embedding LLM capability into applications, with first-class C#, Python and Java support.',
      pts:[
        '<b>Plugins</b> (formerly skills) wrap native functions and prompt templates as callable capabilities the model can invoke.',
        '<b>Automatic function calling</b> and the planner let the model assemble plugins into a sequence to achieve a goal.',
        'Genuine enterprise .NET and Java support is the differentiator — this is what a bank\'s existing codebase can actually import.',
        'Filters and hooks give cross-cutting concerns (logging, permission checks, PII redaction) at the framework level rather than per call.',
        'It is converging with AutoGen into the Microsoft Agent Framework, so present it as the enterprise half of that story.'
      ],
      pick:'.NET and Java enterprises embedding AI into existing applications.',
      watch:'It has been rearchitected more than once. Check which version the documentation you are reading targets.' },

    { id:'adk', n:'Google ADK', by:'Google', kind:'sdk',
      two:'Google\'s open-source Agent Development Kit — the framework used internally for Agentspace, with a code-first model and a local dev UI.',
      pts:[
        'Multi-agent by design: agents compose hierarchically, with sequential, parallel and loop workflow agents as explicit building blocks.',
        'A local <b>dev UI</b> lets you run, inspect and trace agents step by step before anything is deployed.',
        'It supports MCP for tools and the <b>Agent2Agent (A2A)</b> protocol for agent-to-agent communication across systems.',
        'Deployment targets Vertex AI Agent Engine as a managed runtime, so the same code runs locally and in production.',
        'Model-agnostic despite the badge, though the Gemini and Vertex path is clearly the best-supported one.'
      ],
      pick:'GCP shops wanting a code-first agent framework with a managed deployment target.',
      watch:'Newer than the alternatives. Expect API movement and fewer community answers.' },

    { id:'bragents', n:'AWS Bedrock Agents', by:'AWS', kind:'managed',
      two:'AWS\'s managed agent service: you configure instructions, action groups and knowledge bases, and Bedrock runs the orchestration loop for you.',
      pts:[
        '<b>Action groups</b> map tools to Lambda functions with an OpenAPI schema, so tool execution inherits IAM permissions rather than an API key in a config file.',
        '<b>Knowledge Bases</b> give managed RAG — ingestion, chunking, embedding and retrieval from S3 with no pipeline to write.',
        'Bedrock Guardrails attach directly, so policy is configured on the agent rather than coded into the prompt.',
        'Everything is IAM-governed, VPC-capable and CloudTrail-logged, which is usually the actual reason an enterprise chooses it.',
        '<b>AgentCore</b> is the newer runtime for hosting agents written in any framework, which is AWS conceding that teams want their own orchestration with managed infrastructure.'
      ],
      pick:'AWS enterprises that want managed orchestration, retrieval and governance in one place.',
      watch:'You give up control of the loop. Debugging is limited to what the service chooses to expose.' },

    { id:'foundry', n:'Azure AI Foundry Agent Service', by:'Microsoft Azure', kind:'managed',
      two:'Azure\'s managed runtime for agents: hosted threads, tools, files and state, with enterprise identity and networking around it.',
      pts:[
        'Threads and conversation state are <b>server-side</b>, so you do not build persistence yourself — and your data lives in Azure, which is the point either way.',
        'Built-in tools cover Azure AI Search, Bing grounding, code interpreter, Logic Apps and OpenAPI endpoints.',
        'Entra ID identity means an agent acts with a managed identity and real RBAC rather than a shared key.',
        'Connected Agents allow multi-agent delegation without writing your own orchestration layer.',
        'Content Safety and evaluation are integrated in the same portal, so the governance story is one surface instead of five tools.'
      ],
      pick:'Azure enterprises that want an agent runtime under existing identity and compliance controls.',
      watch:'Deep Azure coupling. Portability off it is a rewrite, not a config change.' }
  ]
},

/* ============================================================ *
 * 10. AUTOMATION                                               *
 * ============================================================ */
{
  id: 'auto', n: 'Automation', ico: '⚙️', color: '#fbbf24', tag: 'triggers + workflows',
  two: 'What fires the thing and what happens afterwards: schedulers, connector platforms and workflow engines. Most of an AI product is ordinary plumbing, and this is where it lives.',
  pts: [
    'Three distinct families that a slide deck flattens into one. <b>Connector platforms</b> (Zapier, Make, n8n, Power Automate) join SaaS apps. <b>Data orchestrators</b> (Airflow, Prefect, Kestra) run scheduled batch DAGs. <b>Durable execution engines</b> (Temporal) run long-lived stateful workflows that must survive crashes.',
    'The distinction that matters is <b>failure semantics</b>. A connector platform retries a step. An orchestrator reruns a task with backfill. A durable engine resumes the exact workflow at the exact line after the process died.',
    'Idempotency is the recurring interview theme. Any step that can be retried must be safe to run twice, which usually means an idempotency key on every write and a ledger of what already happened.',
    'An LLM call inside a workflow is just a slow, expensive, non-deterministic task. Give it a timeout, a retry budget, a cost cap, and never let a retry storm loose against a paid API.',
    'Knowing when the answer is "this is not an agent, it is a cron job with one model call" is worth more in an interview than knowing five agent frameworks.'
  ],
  tools: [
    { id:'n8n', n:'n8n', by:'n8n', kind:'lowcode',
      two:'A fair-code, self-hostable workflow automation tool with a node-based visual editor, several hundred integrations and native AI/agent nodes.',
      pts:[
        'Self-hostable is the headline — workflows and credentials stay on your infrastructure, which is why it beats Zapier in privacy-sensitive shops.',
        'A <b>Code node</b> runs arbitrary JavaScript or Python, so you are never blocked when the visual builder runs out of road.',
        'Native LangChain-based AI nodes give agents, vector stores, chains and memory as draggable blocks.',
        'Pricing is per workflow execution rather than per task, which is dramatically cheaper for multi-step workflows.',
        'Licence caveat worth knowing: it is <b>fair-code</b> (Sustainable Use), not OSI open source. Self-host and modify freely; reselling it as a service is restricted.'
      ],
      pick:'Self-hosted automation with AI steps, especially when data cannot go through a hosted platform.',
      watch:'Self-hosting means you own uptime for the thing that runs your business processes.' },

    { id:'zapier', n:'Zapier', by:'Zapier', kind:'saas',
      two:'The original no-code automation platform: trigger in one SaaS app, actions in others, across thousands of integrations.',
      pts:[
        'The integration catalogue is the moat — thousands of apps, including the long tail your business actually uses.',
        'It is aimed squarely at non-engineers, which is the real feature: business teams build and own their own workflows.',
        'Zapier Agents and AI actions add model steps, and Zapier MCP exposes its whole catalogue as tools to an agent, which is a genuinely clever move.',
        'Pricing is per <b>task</b> (per action executed), so a chatty multi-step workflow gets expensive quickly.',
        'Fully hosted, so your data flows through Zapier — the objection that sends regulated teams to n8n.'
      ],
      pick:'Business-team automation across SaaS apps with no engineering time available.',
      watch:'Per-task pricing plus hosted data handling. Both are decisions someone should make deliberately.' },

    { id:'make', n:'Make', by:'Make (formerly Integromat)', kind:'saas',
      two:'A visual automation platform with a canvas-style builder, stronger data transformation and branching than the simple trigger-action model.',
      pts:[
        'The visual scenario canvas shows branching, iteration and aggregation, so complex flows are readable rather than a long list of steps.',
        'Data transformation is genuinely capable — array handling, iterators, aggregators and a formula language — which usually removes the need for a code step.',
        'Error handlers can be attached per module with defined routes, giving real error handling rather than blind retries.',
        'Priced per <b>operation</b> and generally cheaper than Zapier for data-heavy scenarios.',
        'Positioning line: Zapier for breadth and simplicity, Make for complex logic, n8n for self-hosting and code.'
      ],
      pick:'Complex multi-branch automations with real data transformation, without writing code.',
      watch:'The canvas gets unreadable at scale. Break large scenarios into linked ones.' },

    { id:'powerauto', n:'Microsoft Power Automate', by:'Microsoft', kind:'enterprise',
      two:'Microsoft\'s automation platform across the 365 estate, covering both cloud API flows and robotic process automation on the desktop.',
      pts:[
        'Deep 365 integration — SharePoint, Teams, Outlook, Dataverse — is why it is already deployed in most large enterprises whether or not anyone chose it.',
        '<b>RPA</b> is the differentiator: desktop flows drive legacy applications that have no API at all, which is the reality in a lot of enterprises.',
        'AI Builder and Copilot Studio add model steps and conversational agents inside the same governance boundary.',
        'Governance is the enterprise selling point — DLP policies, environments, Entra identity, and admin visibility over what employees built.',
        'It is the answer to "the business already has Microsoft licences", which decides more architecture than any technical comparison.'
      ],
      pick:'Microsoft-estate enterprises, especially where legacy desktop automation is in scope.',
      watch:'Licensing is genuinely complicated and premium connectors cost extra. Check before you design.' },

    { id:'temporal', n:'Temporal', by:'Temporal', kind:'durable',
      two:'A durable execution platform: you write ordinary code and the platform persists its execution state, so a workflow survives crashes and resumes exactly where it stopped.',
      pts:[
        'The core idea is <b>durable execution</b> — every step\'s result is persisted in an event history, so a replay reconstructs state exactly rather than re-running side effects.',
        'Workflows must be <b>deterministic</b>; anything non-deterministic (an API call, a model call, a random number, the clock) goes in an <b>Activity</b>. That split is the thing to explain.',
        'Automatic retries with backoff, timeouts and heartbeats per activity remove most hand-written reliability code.',
        'Workflows can run for months, sleep for days and wait for external signals — which is exactly what a human approval step needs.',
        'For agents it is a strong fit: each LLM call is an activity, so a crash mid-run resumes without repaying for completed steps.'
      ],
      pick:'Long-running, stateful, must-not-lose-progress processes — payments, onboarding, multi-day agent runs.',
      watch:'Real conceptual overhead and a cluster to operate (or Temporal Cloud to pay for). Not for a nightly report.' },

    { id:'airflow', n:'Apache Airflow', by:'Apache', kind:'orchestrator',
      two:'The industry-standard scheduler for batch data pipelines: DAGs defined in Python, with dependencies, retries, backfills and a mature UI.',
      pts:[
        'A DAG is Python code, so pipelines get code review, version control and tests like anything else.',
        '<b>Backfill</b> is the feature that keeps it dominant — rerun the last ninety days after fixing a bug, with per-day task instances tracked individually.',
        'Its sweet spot is scheduled batch work: nightly ingestion, embedding refreshes, eval runs, warehouse loads.',
        'It is explicitly <b>not</b> built for low-latency or event-driven work; the scheduler thinks in intervals, not milliseconds.',
        'In an AI stack it usually owns the offline path — reindexing a corpus, running the eval suite, retraining — while something else handles the request path.'
      ],
      pick:'Scheduled batch data pipelines with dependencies, retries and backfill.',
      watch:'Heavy to operate and easy to abuse. It is not an application runtime and does not want to be.' },

    { id:'prefect', n:'Prefect', by:'Prefect', kind:'orchestrator',
      two:'A modern Python orchestrator built on decorators: turn functions into flows and tasks, with dynamic runtime-defined DAGs.',
      pts:[
        'DAGs are <b>dynamic</b> — the graph is discovered as the code runs, so loops and conditionals are ordinary Python rather than DAG gymnastics.',
        'Two decorators is the whole adoption cost, which makes it far easier to retrofit onto existing scripts than Airflow.',
        'Retries, caching, timeouts and result persistence are per-task parameters rather than framework ceremony.',
        'It runs the same code locally and in production, so testing a pipeline does not require a scheduler.',
        'It is the team behind FastMCP, which is a small but genuine sign of where its ecosystem energy sits.'
      ],
      pick:'Python-first teams wanting orchestration without Airflow\'s operational weight.',
      watch:'Smaller ecosystem than Airflow, and Prefect Cloud is where the nicer features live.' },

    { id:'kestra', n:'Kestra', by:'Kestra', kind:'orchestrator',
      two:'A declarative, YAML-defined orchestrator that is language-agnostic — tasks can be Python, shell, SQL, containers or plugins.',
      pts:[
        'Workflows are <b>YAML</b>, so they are readable by people who do not write Python and reviewable as configuration.',
        'Language-agnostic by design — it orchestrates containers and scripts rather than assuming your code is Python.',
        'Event-driven triggers as well as schedules, so it spans batch and reactive work in one tool.',
        'A built-in UI editor with validation lets non-engineers author and debug flows safely.',
        'It is a good name to have when someone claims orchestration means Airflow — it shows you know the category has moved.'
      ],
      pick:'Polyglot teams that want declarative workflows across languages and containers.',
      watch:'Smaller community. YAML at scale needs discipline or it becomes its own language.' },

    { id:'pipedream', n:'Pipedream', by:'Pipedream', kind:'saas',
      two:'A developer-first integration platform: connect apps with pre-built triggers and actions, then drop into Node, Python, Go or Bash whenever you need to.',
      pts:[
        'It targets <b>developers</b> specifically — code is a first-class step, not an escape hatch bolted onto a visual builder.',
        'Managed OAuth for thousands of APIs removes the most tedious part of integration work; you get an authenticated client, not a token to store.',
        'Every workflow gets an HTTP endpoint instantly, which makes it an excellent webhook receiver and glue layer.',
        'Its connector catalogue is exposed to agents via MCP, turning managed auth into an agent tool surface.',
        'The trade against n8n: faster to start and hosted, versus self-hostable and yours.'
      ],
      pick:'Developers who want managed auth and hosted glue without building a service.',
      watch:'Hosted only. Data and credentials pass through a third party.' }
  ]
},

/* ============================================================ *
 * 11. VECTOR DATABASE                                          *
 * ============================================================ */
{
  id: 'vdb', n: 'Vector Database', ico: '🗃️', color: '#c084fc', tag: 'where vectors live',
  two: 'Storage and approximate nearest-neighbour search over embeddings. It is the index that makes "find the twenty most similar chunks out of ten million" fast enough to sit in a request.',
  pts: [
    'The core trade is <b>ANN, not exact</b>. You accept slightly imperfect recall in exchange for logarithmic-ish search instead of scanning every vector. Knowing you are trading recall for speed is the answer interviewers want.',
    'Two index families cover most systems. <b>HNSW</b>: a navigable small-world graph, excellent recall and latency, memory-hungry, slow to build. <b>IVF</b>: cluster then search a few clusters, cheaper memory, needs training and tuning of nprobe.',
    'Metadata filtering is where implementations genuinely differ. <b>Pre-filtering</b> restricts the candidate set before search (correct, potentially slow); <b>post-filtering</b> searches then filters (fast, can return fewer results than asked for). Ask which one a product does.',
    'Hybrid search — dense vectors for meaning, BM25 for exact terms — fused with Reciprocal Rank Fusion, beats either alone on almost every real corpus. Product codes and names are precisely what embeddings are bad at.',
    'The unglamorous truth: below roughly a hundred thousand vectors you do not need one of these. pgvector, or even brute-force numpy, is faster to build and one fewer system to operate. Scale, latency SLOs and filtering complexity are what justify a dedicated engine.'
  ],
  tools: [
    { id:'pinecone', n:'Pinecone', by:'Pinecone', kind:'managed',
      two:'The fully managed vector database: no servers, no index tuning, an API key and a namespace. The default answer when nobody on the team wants to operate infrastructure.',
      pts:[
        'Serverless separates storage from compute and bills on usage, which removes capacity planning entirely.',
        '<b>Namespaces</b> give hard partitioning inside one index, which is the clean multi-tenant answer — one namespace per customer.',
        'Metadata filtering is done properly rather than as a post-filter, so filtered queries still return the k you asked for.',
        'It handles hybrid search with sparse-dense vectors, so lexical matching does not need a second system.',
        'The honest trade: it is proprietary and hosted. Your vectors live with a vendor, and pricing at scale needs modelling before you commit.'
      ],
      pick:'Production scale with a small team and no appetite for running a database.',
      watch:'Vendor lock-in plus per-usage billing. Model the cost at your projected scale, not today\'s.' },

    { id:'weaviate', n:'Weaviate', by:'Weaviate', kind:'oss',
      two:'An open-source vector database with a real schema, built-in vectorisation modules and a GraphQL query interface. It embeds on ingest, so you can send it text rather than vectors.',
      pts:[
        'Vectorisation <b>modules</b> can embed on ingest, so you send text and it calls the embedding model for you — one less pipeline to write.',
        'It has a real schema with classes, properties and cross-references, which makes it feel like a database rather than a bag of vectors.',
        'Native hybrid search fuses BM25 and dense scores with a single alpha parameter, which is the simplest hybrid API here.',
        'Multi-tenancy is first class, with per-tenant isolation and the ability to offload inactive tenants to cold storage.',
        'Self-hostable or managed cloud, which keeps it available to teams that cannot use a hosted-only product.'
      ],
      pick:'You want hybrid search and schema structure, with the option to self-host.',
      watch:'More concepts to learn than a plain vector store, and modules tie you to their embedding call path.' },

    { id:'qdrant', n:'Qdrant', by:'Qdrant', kind:'oss',
      two:'A Rust-based open-source vector database focused on performance and on doing metadata filtering properly during the graph search.',
      pts:[
        'Written in Rust, with strong latency and memory characteristics — the usual pick when performance per node matters.',
        'Its <b>filterable HNSW</b> applies payload filters during graph traversal rather than before or after, avoiding both the recall loss of post-filtering and the cost of pre-filtering.',
        '<b>Scalar and binary quantisation</b> cut memory dramatically (binary can be up to 32x) with a rescoring pass to recover accuracy — the standard way to make large indexes affordable.',
        'Rich payload filtering with nested conditions makes it strong for permission-scoped retrieval, where every query is filtered by tenant or ACL.',
        'It runs from a single Docker container locally and scales to a distributed cluster, so dev and prod are the same engine.'
      ],
      pick:'Self-hosted vector search with heavy metadata filtering or tight memory budgets.',
      watch:'You are operating a database. Sharding, replication and backups are yours.' },

    { id:'milvus', n:'Milvus', by:'Zilliz / LF AI', kind:'oss',
      two:'An open-source vector database built for very large scale, with a disaggregated architecture and the widest selection of index types.',
      pts:[
        'Architecture separates access, coordinator, worker and storage layers, so you scale query nodes and ingestion independently — built for billions of vectors.',
        'The widest index catalogue here: HNSW, IVF variants, DiskANN, SCANN and GPU indexes, so you can tune the recall/memory/cost triangle precisely.',
        '<b>DiskANN</b> matters when the index cannot fit in RAM — SSD-resident search is how billion-scale gets affordable.',
        'Milvus Lite runs in-process for development, so you prototype without a cluster and deploy to the same API.',
        'It is a Linux Foundation project with Zilliz Cloud as the managed option, so there is a governance story as well as a vendor.'
      ],
      pick:'Very large corpora where you need index-level control and horizontal scale.',
      watch:'Operationally the heaviest here. Do not deploy the full cluster for a million vectors.' },

    { id:'chromadb', n:'Chroma', by:'Chroma', kind:'oss',
      two:'The embedding database built for developer ergonomics: pip install, no server, collections of documents with embeddings and metadata.',
      pts:[
        'Zero-setup in-process mode is why it is in almost every tutorial — retrieval working in four lines.',
        'It defaults to an embedding function, so you can add plain text and it handles vectorisation.',
        'Persistent local storage means a prototype survives restarts without infrastructure.',
        'A client-server mode exists for when several processes need the same store.',
        'Be honest about the ceiling: it is a prototyping and small-production store, and the migration target should be chosen before you need it.'
      ],
      pick:'Prototypes, demos, notebooks and small production systems.',
      watch:'It is not designed for tens of millions of vectors. Plan the exit early.' },

    { id:'pgvector', n:'pgvector', by:'PostgreSQL community', kind:'extension',
      two:'A Postgres extension adding a vector type and ANN indexes, turning the database you already run into a perfectly good vector store.',
      pts:[
        'One database for vectors and business data means real <b>SQL joins</b> and transactional consistency — no dual-write between a metadata store and a vector index.',
        'Two index types: <b>HNSW</b> (better recall and latency, slower build, more memory) and <b>IVFFlat</b> (faster build, less memory, needs training data and tuning).',
        'You inherit backups, replication, point-in-time recovery, roles and row-level security for free — none of which the dedicated engines match.',
        'Combine it with tsvector or pg_trgm for lexical search and you have hybrid retrieval in a single SQL statement.',
        'The realistic ceiling is roughly the low millions of vectors on sensible hardware; past that a dedicated engine wins on latency.'
      ],
      pick:'The correct default for most systems. Start here and move only when you measure a reason.',
      watch:'HNSW index builds are slow and memory-hungry. Size the box and expect a long first build.' },

    { id:'es', n:'Elasticsearch', by:'Elastic', kind:'search',
      two:'The mature search engine, now with dense vector fields and native kNN. The strongest choice when you need real lexical search alongside semantic search.',
      pts:[
        '<b>BM25</b> is the reason it belongs here — exact-term matching on product codes, names and error strings, which embeddings handle badly.',
        'Native hybrid search combines kNN and BM25 with <b>Reciprocal Rank Fusion</b>, and this combination beats either half on most real corpora.',
        'Aggregations, faceting, permission filtering and complex boolean queries are mature in a way no vector-native store matches.',
        'ELSER, its learned sparse encoder, gives semantic matching that remains interpretable term-by-term — a genuine middle ground.',
        'If a company already runs Elasticsearch for logs or product search, adding vectors there beats introducing a new system on almost every axis.'
      ],
      pick:'You need genuine keyword search as well as semantic, or you already run the cluster.',
      watch:'JVM heap tuning and cluster operations are a real skill. Licensing changed in 2021 and matters to some buyers.' },

    { id:'redisvec', n:'Redis (vector)', by:'Redis', kind:'inmem',
      two:'Redis with the query engine enabled: HNSW and flat vector indexes over hashes or JSON, held in memory for the lowest possible latency.',
      pts:[
        'Everything is in memory, so latency is the best on this list — the right pick when the retrieval budget is single-digit milliseconds.',
        'It supports both HNSW and exact flat search, and flat is genuinely fine for small collections.',
        'It doubles as your cache, session store and rate limiter, so a small stack gets fewer systems rather than more.',
        'Semantic caching of LLM responses is the natural companion feature and directly cuts model spend.',
        'The constraint that decides it: RAM cost per GB. A large corpus in memory is expensive, which is why it suits hot subsets rather than everything.'
      ],
      pick:'Latency-critical retrieval over a moderate corpus, especially where Redis is already deployed.',
      watch:'RAM is the budget. Persistence and replication need configuring deliberately, not assumed.' },

    { id:'atlas', n:'MongoDB Atlas Vector Search', by:'MongoDB', kind:'managed',
      two:'Vector search built into MongoDB Atlas, so embeddings live in the same documents as the data they describe. One database, one backup, no sync problem between metadata and vectors.',
      pts:[
        'The vector is a field in the document, which removes the sync problem entirely — no separate store to keep consistent.',
        'Vector search is a stage in the <b>aggregation pipeline</b>, so it composes with matching, lookups, grouping and projection in one query.',
        'Pre-filtering on document fields is native, which makes permission-scoped and tenant-scoped retrieval straightforward.',
        'It runs on the same managed cluster as your application data — one system to secure, back up and pay for.',
        'MongoDB acquired Voyage AI, so first-party embedding models are being pulled into the same platform.'
      ],
      pick:'Teams already on MongoDB who want retrieval without adding a second database.',
      watch:'Atlas only — not available in self-managed MongoDB. That surprises people late in a design.' }
  ]
}

);
