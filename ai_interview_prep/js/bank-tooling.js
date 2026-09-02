/* ============================================================
   Tooling & ecosystem — the named products, and which layer
   each one belongs to. Companion to the ai_tooling course.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'tl01', topic: 'tooling', level: 1,
  q: 'Walk me through the layers of a modern GenAI stack.',
  lay: 'Think of it as a dozen jobs rather than a hundred products. Something produces the words, something fetches the facts, something decides the next step, something stops it doing damage, something records what happened, and something serves it to a human. Every logo you have ever seen on an architecture slide is doing one of those jobs.',
  tech: 'Twelve layers, each answering one question. <b>LLM</b>: what produces the tokens. <b>Embedding</b>: how text becomes a vector. <b>Vector DB</b>: where those vectors live. <b>RAG</b>: how facts reach the prompt. <b>Agentic orchestration</b>: who decides the next step. <b>Agent SDK/runtime</b>: whose process runs the loop. <b>MCP/tools</b>: how the model reaches your systems. <b>Memory</b>: what survives the session. <b>Guardrails</b>: what is allowed in and out. <b>Observability</b>: traces, cost, evals. <b>Automation</b>: what triggers it and what happens after. <b>App/serving</b>: FastAPI, Streamlit, the thing a human touches.',
  trap: 'The follow-up is always "which of those would you drop for an MVP". Correct answer: orchestration, memory, MCP and the automation layer. Never drop observability or guardrails — the first one is how you debug and the second is how you avoid the incident.',
  tags: ['tooling', 'architecture'] },

{ id: 'tl02', topic: 'tooling', level: 1,
  q: 'LangChain, LangGraph and LlamaIndex — what is the difference?',
  lay: 'Same company for the first two. LangChain is the box of parts, LangGraph is the thing that runs a multi-step process reliably and can pause for a human, and LlamaIndex is a different company that went deep on getting your documents in properly.',
  tech: 'LangChain is a component and integration layer: a standard interface over models, loaders, splitters, retrievers and vector stores, composed with LCEL. LangGraph, from the same team, is stateful orchestration — an explicit graph with checkpointed state, conditional edges, interrupts and resumable runs. LlamaIndex is a data framework: parsing (LlamaParse), index types beyond flat vector stores, and advanced retrieval such as auto-merging and sentence-window. Using LangChain for connectors and LlamaIndex for the data path in one system is normal, not indecisive.',
  compare: { cols: ['LangChain', 'LangGraph', 'LlamaIndex'],
    rows: [
      ['Primary job', 'components + integrations', 'stateful orchestration', 'ingestion + retrieval'],
      ['Control flow', 'chains you compose', 'explicit graph', 'query engines / workflows'],
      ['Survives a crash?', 'no', 'yes, checkpointers', 'yes, via context serialisation'],
      ['Human-in-the-loop', 'you build it', 'interrupt(), built in', 'you build it'],
      ['Best at', 'breadth of connectors', 'auditable production agents', 'messy PDFs, multi-doc QA']
    ] },
  trap: '"Why is LangChain criticised?" Give the fair answer: too many abstractions in the monolith era, opaque stack traces, breaking changes. Then the current one: langchain-core plus LangGraph is stable, and the sensible use is the connector library, not hiding your control flow.',
  tags: ['tooling', 'frameworks'] },

{ id: 'tl03', topic: 'tooling', level: 1,
  q: 'What is MCP and what problem does it solve?',
  lay: 'A standard plug. Before it, every AI app had to write its own custom adapter for every tool it wanted to use — five apps and twenty tools meant a hundred adapters. With the standard, you write each tool once and any app can use it. It is USB-C for AI tools.',
  tech: 'The Model Context Protocol is an open JSON-RPC 2.0 standard, published by Anthropic in late 2024 and since adopted by OpenAI, Google and Microsoft. It solves the N-clients-by-M-tools integration explosion. Architecture is host / client / server: the host application runs one client per connection, each server exposes one system. Three primitives, distinguished by <b>who decides</b>: <b>tools</b> are model-controlled actions, <b>resources</b> are application-controlled read-only data, <b>prompts</b> are user-controlled templates. Two transports: stdio for local subprocesses, Streamable HTTP for remote.',
  trap: 'The second question is always security, and a complete answer names four controls: least-privilege tokens, an allowlist of servers, human approval on writes, and never treating tool output as instruction. An MCP server is arbitrary code holding your credentials, and everything it returns is untrusted text.',
  tags: ['tooling', 'mcp', 'agents'] },

{ id: 'tl04', topic: 'tooling', level: 2,
  q: 'Pinecone, Qdrant, pgvector, Elasticsearch — how do you choose?',
  lay: 'Start with the database you already run. A separate vector database is a whole extra system to back up, secure and pay for, and below a few million items it buys you nothing. Move only when you can point at a number that says you have to.',
  tech: 'Decide on four axes: scale, ops capacity, filtering complexity and whether you need keyword search. pgvector is the correct default — one database, transactional consistency with your business data, existing backups, and hybrid search via tsvector in the same query. Its ceiling is roughly the low millions of vectors. Qdrant is the self-hosted performance pick, notable for filtering during HNSW traversal rather than before or after, plus quantisation for memory. Pinecone is the managed answer when nobody can operate a database. Elasticsearch wins when you genuinely need BM25 on product codes and names alongside semantic search.',
  compare: { cols: ['pgvector', 'Qdrant', 'Pinecone', 'Elasticsearch'],
    rows: [
      ['Ops burden', 'none extra', 'you run it', 'none', 'high (JVM, cluster)'],
      ['Realistic ceiling', 'low millions', 'hundreds of millions', 'billions', 'hundreds of millions'],
      ['Keyword search', 'tsvector, decent', 'basic', 'sparse vectors', 'best in class'],
      ['Filtering', 'SQL, exact', 'during traversal', 'native pre-filter', 'mature'],
      ['Pick it when', 'almost always, first', 'perf + heavy filters', 'scale, no ops team', 'you already run it']
    ] },
  trap: '"When would you NOT use a vector database?" Under about a hundred thousand chunks. Brute-force cosine over a numpy array is faster to build, has perfect recall, and is one fewer system. Saying that is a seniority signal, not an admission.',
  tags: ['tooling', 'vectors', 'rag'] },

{ id: 'tl05', topic: 'tooling', level: 2,
  q: 'How would you add observability to an LLM application?',
  lay: 'Record every request as a trace: what was asked, what was retrieved, what the model was actually sent, what came back, how long it took and what it cost. Without that you are guessing which of five stages is broken, and guessing is how teams spend a month tuning the wrong one.',
  tech: 'Instrument first, optimise second. The unit is a trace: one user request with nested spans for each model call, retrieval and tool execution, carrying inputs, outputs, latency, tokens and cost. Then two kinds of evaluation. <b>Offline</b>: a fixed dataset run in CI to catch regressions before release. <b>Online</b>: sampling live traffic to catch drift. Tooling is a hosting decision more than a feature one — LangSmith is LangChain-native and hosted, Langfuse is open source and self-hostable, Arize Phoenix runs locally on OpenTelemetry, W&B Weave suits teams already tracking training runs.',
  compare: { cols: ['LangSmith', 'Langfuse', 'Phoenix', 'Promptfoo'],
    rows: [
      ['Type', 'hosted platform', 'open source', 'open source', 'CLI / CI tool'],
      ['Self-host', 'enterprise only', 'yes, documented', 'yes, local', 'runs anywhere'],
      ['Framework tie', 'LangChain-native', 'agnostic, OTel', 'agnostic, OTel', 'agnostic'],
      ['Strength', 'zero-config tracing', 'no lock-in', 'notebook debugging', 'regression tests + red team'],
      ['Weakness', 'ecosystem gravity', 'you run the stack', 'ephemeral by default', 'not a tracing platform']
    ] },
  trap: 'If you propose an LLM-as-judge, name its biases unprompted: position bias, verbosity bias and self-preference. Mitigate by randomising order, scoring against a written rubric, and calibrating the judge against human labels.',
  tags: ['tooling', 'eval', 'production'] },

{ id: 'tl06', topic: 'tooling', level: 2,
  q: 'What is the RAG Triad?',
  lay: 'Three checks that tell you which part of a retrieval system is broken, instead of just telling you the answer was bad. Did we fetch the right material, did the answer stick to it, and did it actually address the question.',
  tech: 'From TruLens. <b>Context relevance</b>: is the retrieved context actually relevant to the query — a retrieval problem if it fails. <b>Groundedness</b>: is every claim in the answer supported by that context — a generation or prompting problem if it fails. <b>Answer relevance</b>: does the response address the question asked — usually a prompting problem. The value is that the three localise the failure to one stage, which a single end-to-end score never does. Ragas covers the same ground with faithfulness, answer relevancy, context precision and context recall, most of them reference-free.',
  trap: 'Reciting the triad is one of the highest-value-per-second things you can do in a RAG interview. Follow it immediately with "and I would split retrieval metrics from generation metrics so I know which half to fix".',
  tags: ['tooling', 'rag', 'eval'] },

{ id: 'tl07', topic: 'tooling', level: 1,
  q: 'Compare FastAPI and Streamlit.',
  lay: 'FastAPI is for software talking to software — it is the proper service behind your product. Streamlit is for humans, and it is a demo and internal-tool framework. The usual real shape is a Streamlit or React page talking to a FastAPI service.',
  tech: 'FastAPI is an async ASGI framework where type hints generate validation, error responses and OpenAPI docs. For LLM work the important parts are async (the work is I/O-bound waiting on a provider, so one worker holds many in-flight requests), StreamingResponse for token streaming, BackgroundTasks or a queue for long agent runs, and Depends for auth, rate limiting and per-request tracing. Streamlit reruns the entire script top to bottom on every interaction; st.cache_resource keeps expensive objects alive across reruns and st.session_state is the only thing that survives one. It has no routing and no real auth.',
  compare: { cols: ['FastAPI', 'Streamlit', 'Gradio', 'Chainlit'],
    rows: [
      ['Audience', 'other software', 'humans', 'humans', 'humans'],
      ['Execution', 'async request handlers', 'full script rerun', 'function wrapper', 'event/chat driven'],
      ['Streaming', 'SSE / WebSocket', 'st.write_stream', 'yes', 'native'],
      ['Auth + routing', 'yes, real', 'no', 'basic', 'built in'],
      ['Production ready', 'yes', 'internal tools only', 'demos', 'chat apps, close']
    ] },
  trap: 'The classic tell is presenting a Streamlit app as a production customer-facing service. Say the limitation out loud first, then describe the FastAPI service behind it — that single move separates people who have shipped from people who have demoed.',
  tags: ['tooling', 'production', 'serving'] },

{ id: 'tl08', topic: 'tooling', level: 2,
  q: 'Why would you use async for an endpoint that calls an LLM?',
  lay: 'Because your server spends almost all of that request waiting for someone else\'s computer to answer. If each wait ties up a whole worker, you can serve a handful of people at once. If the waits overlap, one worker can hold hundreds.',
  tech: 'LLM calls are I/O-bound, not CPU-bound. A synchronous handler blocks a thread for the full generation, so concurrency equals your worker count. An async handler yields the event loop while awaiting, so a single process can hold hundreds of in-flight requests and your real limit becomes the upstream rate limit rather than your process count. Two traps: any blocking call inside an async handler (a sync HTTP client, a sync DB driver, a CPU-heavy parse) stalls the entire event loop for every request, and timeouts must be set deliberately at every layer — client, load balancer, server and model SDK — or the stingiest one kills a long generation.',
  code: `@app.post("/ask")
async def ask(req: AskRequest, user=Depends(current_user)):
    # streams tokens as they arrive; TTFT is what users actually feel
    async def gen():
        async for chunk in llm.astream(req.prompt):
            yield f"data: {chunk}\\n\\n"
    return StreamingResponse(gen(), media_type="text/event-stream")

@app.post("/agent")                      # 40s agent run: do NOT hold the connection
async def agent(req: RunRequest, bg: BackgroundTasks):
    job = await jobs.create(req)
    bg.add_task(run_agent, job.id)       # a real queue once it matters
    return {"job_id": job.id}`,
  trap: 'The follow-up is "so why not make everything async". Because a blocking library inside an async function is worse than a sync endpoint — it stalls every other request too. If you must call sync code, push it to a threadpool.',
  tags: ['tooling', 'production', 'serving'] },

{ id: 'tl09', topic: 'tooling', level: 2,
  q: 'Airflow, Temporal and n8n all "run workflows". How are they different?',
  lay: 'They fail differently, and that is the whole distinction. One reruns a scheduled job for a day that broke, one picks a half-finished process back up exactly where the machine died, and one retries a step between two business apps.',
  tech: 'Three families. <b>Data orchestrators</b> (Airflow, Prefect, Kestra): scheduled batch DAGs with dependencies, retries and backfill — the offline path in an AI stack, for reindexing, eval runs and warehouse loads. <b>Durable execution</b> (Temporal): workflow state persisted as an event history, so a process crash resumes exactly where it stopped without repeating side effects. Deterministic workflow code, non-deterministic work in Activities. <b>Connector platforms</b> (n8n, Zapier, Make, Power Automate): SaaS-to-SaaS plumbing with per-step retries, built for business teams.',
  compare: { cols: ['Airflow', 'Temporal', 'n8n'],
    rows: [
      ['Shape of work', 'scheduled batch DAG', 'long-lived stateful process', 'app-to-app automation'],
      ['On failure', 'rerun the task, backfill', 'resume at the exact step', 'retry the node'],
      ['Runs for', 'minutes to hours', 'days to months', 'seconds'],
      ['Who writes it', 'data engineers', 'backend engineers', 'anyone'],
      ['In an AI stack', 'reindexing, eval runs', 'agent runs that must not lose progress', 'the Slack/Jira glue']
    ] },
  trap: 'The best answer here is often "this is not an agent, it is a cron job with one model call in it". Saying that, with the reason, scores higher than naming five agent frameworks.',
  tags: ['tooling', 'production', 'automation'] },

{ id: 'tl10', topic: 'tooling', level: 2,
  q: 'How do you stop prompt injection?',
  lay: 'You cannot fully, so you stop assuming the instructions are trustworthy and you stop giving the model the ability to do real damage. Layers of cheap checks, then permissions that make the worst case survivable, then a human on anything you cannot undo.',
  tech: 'Two kinds. <b>Direct</b>: the user types the attack. <b>Indirect</b>: the instruction is hidden in a retrieved document, a web page, an email or a GitHub issue — far more dangerous because nobody is watching that input. Defence is in depth: input classification (Lakera Guard, Azure Prompt Shields, LLM Guard), PII redaction before the call (Presidio), output validation and groundedness checks (Guardrails AI, Bedrock Guardrails contextual grounding), and above all architecture — least-privilege tools, read-only by default, an approval gate before any irreversible action, and never letting tool output be interpreted as instruction.',
  compare: { cols: ['NeMo Guardrails', 'Guardrails AI', 'Presidio', 'Bedrock Guardrails'],
    rows: [
      ['Type', 'OSS dialogue rails', 'OSS output validation', 'OSS PII engine', 'managed, AWS'],
      ['Distinctive bit', 'Colang flow DSL', 're-ask on failure', 'reversible encryption', 'model-independent policy'],
      ['Best at', 'keeping a bot on topic', 'schema + content rules', 'redaction before the call', 'uniform policy, audit trail'],
      ['Cost', 'latency per rail', 'extra calls on re-ask', 'CPU, NER recall gaps', 'per-call fee']
    ] },
  trap: 'If your answer is only "a better system prompt", you have failed the question. A prompt is not a security boundary. The gate on an irreversible action belongs in your code, where it is deterministic.',
  tags: ['tooling', 'safety', 'agents'] },

{ id: 'tl11', topic: 'tooling', level: 1,
  q: 'What does Ollama do, and would you use it in production?',
  lay: 'It runs an open model on your own laptop with one command. It is superb for building and testing offline, and it falls over the moment more than one person uses it at a time.',
  tech: 'Ollama wraps llama.cpp with automatic quantised model pulls and serves an OpenAI-compatible endpoint on localhost, so most frameworks point at it by changing a base URL. It is a single-user server with no continuous batching and no concurrency scheduler. The production counterpart is vLLM, whose PagedAttention manages the KV cache in fixed-size pages to kill fragmentation, and whose continuous batching lets new requests join a running batch instead of waiting for it to drain. TGI and SGLang occupy the same slot.',
  trap: 'The three numbers to quote when defending a self-hosted serving choice: tokens/second per GPU, time-to-first-token, and GPU memory utilisation. Those decide your cost per million tokens, which is the actual comparison against a hosted API.',
  tags: ['tooling', 'inference', 'production'] },

{ id: 'tl12', topic: 'tooling', level: 3,
  q: 'When does self-hosting a model actually beat a hosted API?',
  lay: 'When the machine is busy nearly all the time, or when the data legally cannot leave your network. A rented GPU bills every hour whether you send it work or not, so a prototype doing forty calls a day is paying for an idle machine.',
  tech: 'Two independent reasons, and only one of them is money. <b>Data residency</b> decides it outright and needs no arithmetic. <b>Cost</b> needs a crossover calculation: hosted APIs bill per token with zero idle cost, self-hosting is a near-fixed hourly GPU cost plus the engineering time to run vLLM, plan capacity and handle OOMs. Self-hosting wins only at steady high volume — bursty developer traffic is the worst possible fit. Also weigh the quality gap on hard reasoning, which you close by fine-tuning on your narrow task, not by prompting harder.',
  trap: 'Say the phrase "let me do the crossover arithmetic" and then do it out loud with rough numbers. The answer they want is a number and a threshold, not a preference.',
  tags: ['tooling', 'production', 'cost'] },

{ id: 'tl13', topic: 'tooling', level: 2,
  q: 'What is a reranker and where does it sit?',
  lay: 'A second, slower, much more accurate pass over a shortlist. The fast search grabs a hundred candidates, then the reranker reads each one properly against the question and reorders them so the best few are actually at the top.',
  tech: 'Embedding models encode query and document separately, so document vectors can be precomputed and search is fast — but the two never see each other. A reranker reads query and document <em>together</em> in one pass, which is far more accurate and far too slow to run over a whole corpus. So you retrieve top-100 cheaply, rerank to top-10, and pass those to the model. Options: Cohere Rerank (hosted, strongest reputation), Voyage rerank, bge-reranker (free, local, via sentence-transformers). It is usually the single biggest quality win available to a mediocre RAG system.',
  trap: 'If retrieval returns the right chunk at rank 14 and the answer is still wrong, the problem is ordering, not retrieval and not the model. Reaching for a bigger generation model there is the expensive way to not fix it.',
  tags: ['tooling', 'rag', 'vectors'] },

{ id: 'tl14', topic: 'tooling', level: 2,
  q: 'Explain the difference between context and memory in an AI assistant.',
  lay: 'Context is what is in front of the model right now, and you pay for all of it on every single turn. Memory is what it still knows next Tuesday. Making the context window bigger is not the same as remembering anything.',
  tech: 'Four kinds worth naming: <b>working</b> (this conversation, in context), <b>episodic</b> (what happened in past sessions), <b>semantic</b> (durable facts about the user), <b>procedural</b> (learned how-to, in prompts or weights). The engineering problem is not storage, it is retrieval and forgetting — extract candidate facts, deduplicate, resolve conflicts, decay. When a user says "actually I moved to Berlin", the old city fact must be <em>updated</em>, not appended alongside. Tools: Mem0 (extract then ADD/UPDATE/DELETE/NOOP), Zep (temporal knowledge graph, facts carry validity intervals), Letta/MemGPT (the agent pages its own memory), or LangGraph checkpointers plus its Store.',
  trap: 'Privacy gets probed here. Memory is durable personal data: it needs per-user isolation, a deletion path, and an answer to "what happens when they ask to be forgotten".',
  tags: ['tooling', 'agents', 'memory'] },

{ id: 'tl15', topic: 'tooling', level: 1,
  q: 'Name the pieces of a RAG pipeline and which one usually breaks.',
  lay: 'Load the documents, cut them into pieces, turn each piece into numbers, find the closest pieces to the question, then answer using them. When people complain the model is making things up, the fault is usually two or three stages earlier than the model.',
  tech: 'Load → chunk → embed → retrieve → generate. Failure is concentrated in the first two: bad parsing (a PDF flattened into a text blob, tables destroyed) and bad chunking (fixed character counts that split a table from its heading). The upgrade path in order of value per hour: hybrid search (BM25 + dense, fused with Reciprocal Rank Fusion), then a reranker, then structure-aware chunking, then query rewriting. Fine-tuning is last. Tooling: Unstructured or LlamaParse for parsing, chunk_by_title for structure-aware splitting, RAGFlow if you want to review chunks in a UI before indexing.',
  trap: 'Retrieval quality beats model quality. A frontier model with the wrong chunks loses to a cheap model with the right ones, and saying that early frames the whole rest of the answer.',
  tags: ['tooling', 'rag'] },

{ id: 'tl16', topic: 'tooling', level: 2,
  q: 'What is GraphRAG and when is the cost justified?',
  lay: 'Normal retrieval finds the few paragraphs closest to your question. That cannot answer "what are the main themes across all of these documents", because no single paragraph contains the answer. GraphRAG builds a map of who and what is connected first, then answers over the map.',
  tech: 'Microsoft\'s technique: extract entities and relationships across the corpus with an LLM, cluster them into communities, and pre-write community summaries. Two query modes — <b>local</b> walks the graph around named entities, <b>global</b> map-reduces over community summaries. It fixes multi-hop and thematic questions that flat top-k structurally cannot answer. The cost is indexing: many LLM calls per document, so it pays off on a stable, heavily queried corpus and is a poor fit for fast-changing data.',
  trap: 'Always offer the cheap alternative in the same breath: entity extraction plus metadata filtering gets part of the way for a fraction of the cost. Proposing the expensive option without naming the cheap one reads as not having costed it.',
  tags: ['tooling', 'rag'] },

{ id: 'tl17', topic: 'tooling', level: 2,
  q: 'Compare CrewAI, AutoGen and LangGraph.',
  lay: 'Two of them let agents talk to each other and hope the right thing happens. One makes you draw the process out in advance. The talking ones demo beautifully; the drawn one is the one you can debug at three in the morning.',
  tech: 'The axis is graph versus conversation. <b>LangGraph</b>: an explicit state machine — nodes, conditional edges, reducers, checkpointed state, interrupts. Slower to write, resumable, auditable, testable. <b>CrewAI</b>: role/goal/backstory agents executed sequentially or by a manager agent; fastest to a plausible demo, and it added Flows precisely because pure role-play was too loose for production. <b>AutoGen</b>: conversable agents in a group chat with a code-executing user proxy; research-first, rewritten to an event-driven core in v0.4, now converging with Semantic Kernel into the Microsoft Agent Framework.',
  compare: { cols: ['LangGraph', 'CrewAI', 'AutoGen'],
    rows: [
      ['Model', 'explicit graph', 'roles + tasks', 'group chat'],
      ['Durable state', 'yes, checkpointers', 'limited', 'limited'],
      ['Human gate', 'interrupt(), built in', 'you add it', 'you add it'],
      ['Cost behaviour', 'predictable', 'balloons in manager mode', 'unbounded without a stop rule'],
      ['Honest use', 'production agents', 'prototypes, content pipelines', 'research, code-execution loops']
    ] },
  trap: '"When would you not use multi-agent at all?" Almost always at first. Every extra agent is another context window, another handoff where information is lost, and another failure mode. Justify it with different tools or different permissions per agent — never with an org chart.',
  tags: ['tooling', 'agents', 'frameworks'] },

{ id: 'tl18', topic: 'tooling', level: 2,
  q: 'How do you pick an embedding model?',
  lay: 'Not from a leaderboard. Build fifty real question-and-document pairs from your own data, measure how often the right document comes back in the top ten, and pick on that. Also remember that changing your mind later means redoing every document.',
  tech: 'Four considerations. <b>Domain</b>: general leaderboards do not transfer to your jargon; a domain-tuned model (Voyage code/law/finance) can beat a bigger general one. <b>Dimensions</b>: a direct storage and search-cost lever, and Matryoshka models let you truncate with graceful degradation. <b>Deployment</b>: hosted (OpenAI, Cohere, Vertex) sends every document off your network at index time — the same residency conversation as the chat model, and people forget it. <b>Migration cost</b>: vectors from different models are not comparable, so a change means reindexing everything.',
  trap: 'Two silent accuracy bugs to mention unprompted: BGE models expect an instruction prefix on queries, and Cohere and Vertex expect an input/task type. Omit either and nothing errors — retrieval just quietly gets worse.',
  tags: ['tooling', 'vectors', 'rag'] },

{ id: 'tl19', topic: 'tooling', level: 3,
  q: 'Design the tooling for a regulated enterprise that cannot send data to a third party.',
  lay: 'Residency decides the shape before anything else does. Everything runs inside their network: their own model on their own machines, their existing database holding the vectors, self-hosted tracing, and redaction on anything that would otherwise leave.',
  tech: 'Constraint-first. <b>Model</b>: open weights (Llama or Mistral) served by vLLM in their VPC, or a hyperscaler equivalent under an enterprise agreement (Azure OpenAI with Private Endpoints, Bedrock, Vertex with VPC Service Controls). <b>Vectors</b>: pgvector in the database they already back up, or self-hosted Qdrant. <b>Observability</b>: Langfuse or Phoenix self-hosted, because traces contain the prompts and therefore the data. <b>Guardrails</b>: Presidio for PII, LLM Guard or NeMo Guardrails self-hosted. <b>Serving</b>: FastAPI behind their existing identity provider. <b>Orchestration</b>: LangGraph with a Postgres checkpointer, so state also stays put.',
  trap: 'The line that lands: "the observability layer is the one people forget — traces contain the prompts, so a hosted tracing platform quietly reintroduces the exact data flow the whole design was avoiding".',
  tags: ['tooling', 'sysdesign', 'safety'] },

{ id: 'tl20', topic: 'tooling', level: 2,
  q: 'What does Pydantic do for an LLM application?',
  lay: 'It defines the exact shape of the data you expect, and then checks it. The same definition tells the model what a tool takes, tells your API what a request looks like, and catches it when the model returns something malformed.',
  tech: 'One type definition doing three jobs: request validation in FastAPI, JSON Schema generation for tool definitions and structured output, and validation of what came back. Its errors are structured and specific, so a failed model output can be fed back as a precise repair instruction rather than "that was wrong". Custom validators let you encode business rules — a refund cannot exceed the order total — in the type itself, which is a far stronger guarantee than asking the model nicely in a prompt. v2 moved the core to Rust, which matters when you validate every request.',
  trap: 'Mixed v1/v2 dependency trees are a real and annoying failure mode. Also: validation with automatic re-ask can loop, so cap the retries or you have built a money pump.',
  tags: ['tooling', 'production', 'prompting'] },

{ id: 'tl21', topic: 'tooling', level: 1,
  q: 'What is DSPy and why would you use it?',
  lay: 'Instead of writing prompts by hand and tweaking them until they feel right, you describe what goes in and what comes out, give it examples and a way to score the result, and it searches for the prompt that scores best.',
  tech: 'DSPy treats prompts as parameters to be optimised rather than strings to be authored. You declare <b>signatures</b> ("question, context -> answer") and compose modules; an optimiser such as BootstrapFewShot or MIPRO generates and selects demonstrations that maximise your metric. Two real benefits: prompts become <b>portable across models</b> — recompile instead of re-tuning by hand when you switch — and it forces a metric to exist, which is why teams that adopt it end up with real evals.',
  trap: 'The comparison: LangChain composes calls, DSPy optimises them. They solve different problems and can be used together. The cost is that compilation burns real API calls and needs decent training examples.',
  tags: ['tooling', 'prompting', 'eval'] },

{ id: 'tl22', topic: 'tooling', level: 2,
  q: 'Give me the four guards that stop an agent costing $400 in one run.',
  lay: 'A hard limit on how many steps it may take, a running total of what it has spent, a check for whether it just tried the same thing again, and a defined way to give up and say so rather than looping forever.',
  tech: 'Step cap, cost ceiling checked every iteration, repeat-call detection on a hash of tool name plus arguments, and a named degraded outcome when either budget is hit. Those four are the difference between a demo and something you can bill for, and they are the answer regardless of which framework you name.',
  code: `def run(task, tools, max_steps=12, budget_usd=0.40):
    msgs, spent, seen = [system(tools), user(task)], 0.0, set()
    for _ in range(max_steps):                       # 1. step cap
        r = llm(msgs, tools=tools); spent += r.cost
        if spent > budget_usd:                       # 2. cost ceiling
            return degrade("budget exceeded", msgs)  # 4. named outcome
        if not r.tool_calls:
            return r.text
        for call in r.tool_calls:
            key = (call.name, json.dumps(call.args, sort_keys=True))
            obs = ("You already called this with identical arguments."
                   if key in seen else shape(execute(call)))   # 3. repeat detect
            seen.add(key); msgs.append(tool_result(call.id, obs))
    return degrade("step budget exhausted", msgs)`,
  trap: 'Frameworks give you some of these and not others. Ask any framework you are proposing which of the four it has, and be ready to say you would add the rest yourself.',
  tags: ['tooling', 'agents', 'production'] },

{ id: 'tl23', topic: 'tooling', level: 2,
  q: 'How would you expose an existing internal REST API to an AI agent?',
  lay: 'Write it once as a standard tool server rather than four times as custom glue for four different assistants. Then lock down what it is allowed to do, because whatever calls it will be holding real credentials.',
  tech: 'Build an MCP server. With FastMCP it is a decorator plus a type-hinted function — the JSON Schema comes from the type hints and the docstring, and v2 can generate one straight from an OpenAPI spec. Same ergonomics as FastAPI, different protocol. Then the security work, which is the actual job: least-privilege credentials scoped to what this agent needs, read-only tools by default, an approval gate on writes, statement timeouts and row limits enforced in the server rather than requested in the prompt, and tool output treated as data rather than instruction.',
  trap: 'The single most common cause of "the model never calls my tool" is a vague tool description. The description is what the model reads to decide — it is prompt engineering, not documentation.',
  tags: ['tooling', 'mcp', 'agents'] },

{ id: 'tl24', topic: 'tooling', level: 1,
  q: 'Compare Zapier, n8n and Make.',
  lay: 'All three connect business apps together without writing much code. One has the most integrations and is aimed at non-engineers, one you can run on your own servers, and one is better at complicated branching logic.',
  tech: 'Same category, three trade-offs. <b>Zapier</b>: the largest catalogue, aimed at non-engineers, fully hosted, priced per task executed — which gets expensive on multi-step workflows and sends your data through a third party. <b>n8n</b>: fair-code (Sustainable Use licence, not OSI open source), self-hostable so credentials and data stay yours, priced per workflow execution, with a Code node and native LangChain-based AI nodes. <b>Make</b>: a visual canvas with genuinely strong data transformation — iterators, aggregators, per-module error handlers — and per-operation pricing.',
  trap: 'Naming these at all is a maturity signal. Refusing to consider a no-code tool for what is genuinely connector plumbing, and proposing a bespoke service instead, reads as inexperience rather than rigour.',
  tags: ['tooling', 'automation', 'production'] },

{ id: 'tl25', topic: 'tooling', level: 3,
  q: 'How would you evaluate whether a cheaper model is good enough to switch to?',
  lay: 'Build a set of real cases with known good answers, run both models against all of them, and compare quality, cost and speed side by side. Then run that same set every release so you find out immediately if something gets worse.',
  tech: 'Build a regression suite before you touch the model. Promptfoo is the natural tool: test cases and assertions declared in YAML, a matrix of prompts by models by cases, and a side-by-side comparison table. Keep most assertions deterministic and therefore free — contains, regex, valid JSON, latency, cost — and use LLM-graded rubrics only where you must. Add Ragas metrics if retrieval is in scope. Then run it in CI so a prompt change is reviewable in a pull request, and add online sampling in production because offline sets never contain what users actually do.',
  trap: 'Routing is often the better answer than switching: send the easy majority to the small model and escalate the rest on a confidence gate. That gets most of the saving without the quality argument.',
  tags: ['tooling', 'eval', 'cost'] },

{ id: 'tl26', topic: 'tooling', level: 2,
  q: 'What does a managed agent runtime give you that a framework does not?',
  lay: 'Somebody else holds the conversation state, the scaling and the permissions. You give up control of the loop and the ability to debug it properly, and you get identity, audit logs and compliance without building them.',
  tech: 'A framework is a library in your process; a managed runtime holds the state and the execution loop. <b>Bedrock Agents</b>: action groups map tools to Lambda functions with an OpenAPI schema, so tool execution inherits IAM rather than an API key in config; Knowledge Bases give managed RAG; Guardrails attach declaratively. <b>Azure AI Foundry Agent Service</b>: server-side threads, Entra ID managed identity, built-in Azure AI Search and Bing grounding, Content Safety in the same portal. <b>Vertex AI Agent Engine</b> plays the same role for Google ADK. The trade is always control and portability for governance and undifferentiated heavy lifting.',
  trap: 'AWS shipping AgentCore — a runtime that hosts agents written in any framework — is the tell that customers wanted managed infrastructure without giving up their own orchestration. Mentioning that shows you track direction, not just launches.',
  tags: ['tooling', 'agents', 'production'] },

{ id: 'tl27', topic: 'tooling', level: 1,
  q: 'What is Hugging Face, exactly?',
  lay: 'The place open models live. It is the app store and the package manager for models and datasets, plus the libraries most people use to run and train them.',
  tech: 'Three things share the name and you should say which you mean: the <b>Hub</b> (model and dataset registry), the <b>transformers</b> library, and <b>Inference Endpoints</b> (hosted serving). The companion libraries matter as much: PEFT for LoRA, accelerate for multi-GPU, TRL for DPO and RLHF, sentence-transformers for embeddings, datasets for lazy streaming of corpora larger than local disk.',
  trap: 'Raise supply-chain risk unprompted — it is the point almost nobody makes. A model repo is code plus weights from a stranger: pin revisions, prefer safetensors over pickle formats that execute on load, and scan what you pull. Protect AI\'s ModelScan exists for exactly this.',
  tags: ['tooling', 'foundations', 'safety'] },

{ id: 'tl28', topic: 'tooling', level: 2,
  q: 'Explain HNSW versus IVF.',
  lay: 'Two ways to avoid comparing your question against every single item. One builds a network of shortcuts you can hop along; the other sorts everything into buckets first and only opens a few buckets.',
  tech: 'Both are approximate nearest-neighbour indexes — you accept slightly imperfect recall for a search that does not scan everything. <b>HNSW</b> is a multi-layer navigable small-world graph: excellent recall and latency, memory-hungry, slow to build, tuned with M and ef_search. <b>IVF</b> clusters vectors and searches only the nearest few clusters: much lighter on memory, needs a training pass, tuned with nlist and nprobe. Separately, know that metadata filtering differs by product — pre-filtering restricts the candidate set before search (correct, can be slow), post-filtering searches then filters (fast, can return fewer than k). Qdrant filters during traversal to avoid both problems.',
  trap: 'The honest framing that scores well: "approximate, on purpose". If someone expects exact results from a vector index, that expectation is the bug, and at small scale exact brute force is genuinely the right answer.',
  tags: ['tooling', 'vectors', 'sysdesign'] },

{ id: 'tl29', topic: 'tooling', level: 2,
  q: 'Describe the order in which you would add tooling to a new AI product.',
  lay: 'One thing at a time, and only when something you measured says you need it. Every tool you add is another thing to run, secure, upgrade and pay for.',
  tech: 'A ladder. 1) Model API and your own short loop. 2) A vector store when it needs facts it was not trained on — pgvector, not a new system. 3) A framework when you are about to write the fifth document loader by hand. 4) Orchestration when a crash mid-run or a human approval actually matters. 5) Observability — before real users, not after the first incident. 6) Guardrails and a regression eval before anything irreversible or customer-facing ships. 7) Everything else — memory services, MCP servers, rerankers, workflow engines, self-hosted serving — each only when a measured problem demands it.',
  trap: 'The reasons that do <em>not</em> justify a new tool are worth saying out loud: it was on a diagram, everyone had heard of it, it might be needed at a scale nobody forecast, the current thing is boring, the demo was very good.',
  tags: ['tooling', 'sysdesign', 'production'] },

{ id: 'tl30', topic: 'tooling', level: 3,
  q: 'An agent occasionally issues a refund it should not, and nobody can reconstruct why. What do you do?',
  lay: 'Two separate holes. You cannot see what happened, and money can move without anyone checking. Fix the visibility first so you can diagnose, then put a person in front of the irreversible bit.',
  tech: 'Instrument, then gate. <b>Visibility</b>: full tracing so every run records the prompt after templating, the retrieved context, each tool call with arguments, and the cost — LangSmith, Langfuse or Phoenix, self-hosted if the traces contain customer data. <b>Gate</b>: move the refund behind a durable interrupt, so the graph checkpoints, a human approves, and it resumes from the checkpoint. <b>Policy in code</b>: amount limits, eligibility and idempotency enforced by your own functions, not requested in a prompt. <b>Idempotency key</b> on the refund so a retry cannot double-pay. Then add the failing cases to a regression suite so this specific bug cannot come back.',
  trap: 'If the proposed fix is "improve the system prompt", it is the wrong answer. Prompts are probabilistic; a check in your own code before the side effect fires is deterministic. Never defend an irreversible action with a prompt.',
  tags: ['tooling', 'agents', 'safety', 'production'] },

{ id: 'tl31', topic: 'tooling', level: 1,
  q: 'What is FastMCP?',
  lay: 'The easy way to write a tool server in Python. You write a normal function with type hints, add one line above it, and it becomes a tool any AI assistant can call.',
  tech: 'FastMCP is to MCP what FastAPI is to HTTP: a decorator plus a type-hinted function, with the JSON Schema generated from the type hints and docstring. Its v1 was upstreamed into the official MCP Python SDK; v2 continues separately with server composition, proxying, auth integration, OpenAPI-to-MCP generation and in-process testing utilities. That last one matters — it means MCP servers get unit tests like any other code.',
  trap: 'Say which version you mean. v1 lives inside the official SDK, v2 is a separate package, and answers that blur them sound second-hand.',
  tags: ['tooling', 'mcp'] },

{ id: 'tl32', topic: 'tooling', level: 2,
  q: 'Compare hosted and self-hosted observability for an LLM app.',
  lay: 'The recordings contain every prompt and every answer, which means they contain your data. Where those recordings live is the same privacy decision you already made about the model itself, and teams routinely forget to make it twice.',
  tech: 'Feature parity is close; the decision is hosting and lock-in. Hosted (LangSmith, W&B Weave, Helicone cloud) is running the same afternoon and costs a vendor relationship plus your trace data leaving the network. Self-hosted (Langfuse, Phoenix, LLM-Guard-style OSS) keeps traces inside your perimeter and costs you a Postgres, a ClickHouse and a queue to operate. Also weigh framework neutrality: OpenTelemetry-based tools trace your non-LLM services in the same view, which a framework-native tracer usually does not.',
  compare: { cols: ['Hosted', 'Self-hosted'],
    rows: [
      ['Time to first trace', 'minutes', 'a day or two'],
      ['Where prompts live', 'the vendor', 'your network'],
      ['Ops cost', 'none', 'a real stack to run'],
      ['Retention control', 'their policy', 'yours'],
      ['Best fit', 'startups, speed', 'regulated data, scale']
    ] },
  trap: 'Helicone is worth naming as the third shape — a gateway rather than an SDK, so integration is a base-URL change and you also get caching and per-user spend limits. The trade is that it sits in the critical path and must fail open.',
  tags: ['tooling', 'production', 'eval'] }

]);
