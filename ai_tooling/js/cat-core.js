/* ============================================================
   cat-core.js — the model and the things that feed it.
   LLM · Agentic AI · RAG · Embedding
   ============================================================ */
C.cats.push(

/* ============================================================ *
 * 1. LLM                                                       *
 * ============================================================ */
{
  id: 'llm', n: 'LLM', ico: '🧠', color: '#7c5cff', tag: 'the engine',
  two: 'The model itself: the thing that turns tokens in into tokens out. Every other layer on this map exists to feed it better input, constrain its output, or record what it did.',
  pts: [
    'Three buying modes. <b>Hosted API</b> (OpenAI, Anthropic, Google) — no ops, per-token price, your data leaves the building. <b>Open weights</b> (Llama, Mistral) — you host, fixed GPU cost, data stays put. <b>Hosted open weights</b> (Bedrock, Together, Groq) — someone else runs the open model for you.',
    'The choice is rarely about benchmark scores. It is data residency, latency floor, cost at your real volume, and whether a vendor will sign a contract your legal team accepts.',
    'Have the cost crossover ready. Hosted APIs win until you are saturating a GPU; a rented A100/H100 bills by the hour whether or not you send it traffic, so self-hosting only wins on steady high volume, never on bursty developer traffic.',
    'Model routing is the mature pattern: a small cheap model handles the easy majority, a frontier model takes the rest, and a classifier or confidence gate decides. This is how teams cut spend several-fold with no quality drop users can detect.',
    'Never hard-code a provider. One thin function — messages in, text plus usage out — makes swapping providers a config change. Model quality shifts every few months; your architecture should not have to.'
  ],
  tools: [
    { id:'gpt', n:'OpenAI GPT', by:'OpenAI', kind:'hosted',
      two:'The hosted frontier family most teams start on, reached through the Chat Completions and Responses APIs. Widest ecosystem, most integrations, most tutorials written against it.',
      pts:[
        'Native <b>function/tool calling</b> and JSON Schema structured output are first class, which is why most agent frameworks default to it.',
        'Prompt caching applies automatically to repeated prefixes, so putting the stable system prompt and tool definitions first is a genuine cost lever, not a micro-optimisation.',
        'The Batch API gives a large discount for work that can wait — evals, backfills, bulk classification. Knowing that offline work should not pay online prices is a cheap seniority signal.',
        'The Assistants/Responses layer bundles threads, file search and code interpreter. Fast to demo, awkward to control; most production teams drop back to plain completions plus their own state.',
        'Risks to name unprompted: lock-in through proprietary API shapes, data-residency questions, and silent version drift — always pin a dated model ID rather than an alias.'
      ],
      pick:'Default when you want the widest ecosystem and the shortest path from idea to working prototype.',
      watch:'An unpinned alias can change your eval results overnight with no deploy from you.' },

    { id:'claude', n:'Anthropic Claude', by:'Anthropic', kind:'hosted',
      two:'A hosted frontier family known for long-context work, careful instruction following and coding. The reference implementation of the Model Context Protocol.',
      pts:[
        'Very large context windows make "put the whole document in the prompt" a real alternative to RAG for single-document tasks. The trade is cost and latency, not accuracy.',
        'Tool use is native, and extended thinking between tool calls is effectively the agent loop expressed inside one API call.',
        'Prompt caching is <b>explicit</b> — you mark cache breakpoints — which gives more control than automatic caching but forces you to design the prompt so the stable part comes first.',
        'Anthropic authored <b>MCP</b>, so Claude-based stacks reach for MCP servers where an OpenAI-based stack hand-writes tool wrappers.',
        'Constitutional AI and a published safety posture are why it appears in regulated shops. If asked "why Claude", long context and enterprise trust are the honest answers, not benchmark points.'
      ],
      pick:'Long documents, careful instruction following, agentic coding, or when compliance asks hard questions.',
      watch:'Long context is not free context. A 200k-token prompt costs 200k tokens every turn and raises time-to-first-token.' },

    { id:'gemini', n:'Google Gemini', by:'Google DeepMind', kind:'hosted',
      two:'Google\'s frontier family, sold through AI Studio for prototypes and Vertex AI for enterprises. Natively multimodal and the leader on raw context length.',
      pts:[
        'Genuinely multimodal in one model — text, image, audio and video in the same request, rather than a text model bolted onto a vision encoder.',
        'Context windows into the millions of tokens make whole-codebase and whole-video analysis a workflow rather than a demo.',
        'Two front doors matter in interviews: <b>AI Studio</b> for prototypes, <b>Vertex AI</b> for VPC, IAM, data residency and enterprise controls. Same models, very different governance story.',
        'Deep integration with BigQuery, Cloud Storage and Vertex Vector Search is the actual reason a GCP shop picks it.',
        'Context caching is billed explicitly as storage plus cheaper calls, so a long shared prefix becomes a line item you can reason about.'
      ],
      pick:'You are on GCP, the task is genuinely multimodal, or the input is enormous.',
      watch:'Two SDKs and two consoles for the same models. Say which one you mean or the conversation goes sideways.' },

    { id:'llama', n:'Meta Llama', by:'Meta', kind:'open',
      two:'The most widely deployed open-weights family, downloadable and runnable on your own hardware. The default answer when data must not leave your network.',
      pts:[
        'Open <b>weights</b>, not open source — the licence has conditions, notably around very large-scale commercial use. Knowing that distinction is free credibility.',
        'It is the base most fine-tuning work assumes, so the LoRA/QLoRA tooling, quantised GGUF builds and community fine-tunes are all Llama-shaped.',
        'Self-hosting means you now own throughput, batching, GPU memory and uptime. That is precisely the problem vLLM exists to solve.',
        'Smaller variants run on one GPU or a laptop, making them the practical choice for edge, offline and privacy-first products.',
        'The honest trade: a real gap to frontier hosted models on hard reasoning, closed by fine-tuning on your narrow task rather than by prompting harder.'
      ],
      pick:'Data cannot leave your network, or volume is steady and big enough to beat per-token pricing.',
      watch:'"Self-host to save money" is usually wrong at prototype volume. Do the crossover arithmetic before claiming it.' },

    { id:'mistral', n:'Mistral AI', by:'Mistral AI', kind:'both',
      two:'A French lab shipping both open-weights models and a hosted API, known for small models that punch above their size and for popularising sparse mixture-of-experts.',
      pts:[
        '<b>Mixture-of-Experts</b> is the idea to be able to explain: many expert sub-networks, only a couple active per token, giving large-model quality at small-model inference cost.',
        'Strong 7B-class models made "good enough locally" real and reset expectations for what a laptop can run.',
        'European provenance and EU hosting make it the low-friction answer to GDPR and data-sovereignty questions.',
        'It sells both ways — open weights plus a hosted API — so you can prototype on the API and migrate to self-hosted without changing model family.',
        'Function calling and JSON mode are supported, so it drops into existing agent frameworks without special-casing.'
      ],
      pick:'European data residency, or MoE efficiency with an open-weights escape hatch.',
      watch:'Licences differ per model in the family — some Apache 2.0, some research-only. Check per model, not per vendor.' },

    { id:'cohere', n:'Cohere', by:'Cohere', kind:'hosted',
      two:'An enterprise-first provider whose real strength is the retrieval stack around the model rather than the chat model itself. Command generates, Embed vectorises, Rerank reorders.',
      pts:[
        '<b>Rerank</b> is the flagship: a cross-encoder that rescores your top-100 into a top-10, and usually the single biggest quality win available to a mediocre RAG system.',
        'Embed models are multilingual and support int8/binary compression, which cuts vector storage cost directly.',
        'It deploys into your own VPC or on-prem, which is why regulated enterprises shortlist it.',
        'Command models are tuned for grounded generation with citations rather than open-ended chat — RAG is the design centre, not an add-on.',
        'A good line: you can keep OpenAI for generation and still use Cohere Rerank for retrieval. These layers are independently swappable and interviewers like hearing that.'
      ],
      pick:'You need a strong reranker, multilingual embeddings, or a model that runs inside your own VPC.',
      watch:'Reranking adds a network hop per query. Budget the latency before you promise the accuracy.' },

    { id:'hf', n:'Hugging Face', by:'Hugging Face', kind:'hub',
      two:'Not a model — the registry and library layer the whole open ecosystem hangs off. Model hub, datasets, the transformers library and hosted inference endpoints.',
      pts:[
        'Three things share the name: the <b>Hub</b> (models and datasets), the <b>transformers</b> library, and <b>Inference Endpoints</b>. Say which one you mean.',
        'It is the de facto package manager for models. Almost every open model you can name is distributed through it.',
        'The datasets library streams lazily, which is how people fine-tune on corpora far larger than local disk.',
        'The companion libraries matter as much as the hub: <b>PEFT</b> for LoRA, <b>accelerate</b> for multi-GPU, <b>TRL</b> for DPO/RLHF, <b>sentence-transformers</b> for embeddings.',
        'Supply-chain risk is real and worth raising unprompted: a model repo is code plus weights from a stranger. Pin revisions, prefer safetensors over pickle, scan what you pull.'
      ],
      pick:'Any time you touch open models, datasets or fine-tuning. It is infrastructure, not a choice.',
      watch:'Treat model pulls like dependency pulls. Arbitrary repos can execute arbitrary code paths.' },

    { id:'ollama', n:'Ollama', by:'Ollama', kind:'local',
      two:'The easiest way to run an open model on your own machine: one install, one pull, one command. Wraps llama.cpp and exposes an OpenAI-compatible local API.',
      pts:[
        'One-line model pull with automatic quantised weights is why it became the default for local development and demos.',
        'It serves an OpenAI-compatible endpoint on localhost, so most frameworks point at it by changing a base URL and nothing else.',
        'Ideal for offline development, cost-free iteration and privacy-sensitive prototyping — no key, no bill, no data leaving the laptop.',
        'It is a <b>single-user</b> server. No continuous batching, no high-concurrency scheduling, so it is not a serving layer.',
        'The production counterpart is vLLM (or TGI, or SGLang). Knowing which belongs where is usually the whole point of the question.'
      ],
      pick:'Local development, demos, offline work and privacy-first prototypes.',
      watch:'Never put it behind real traffic. Throughput collapses under concurrency because nothing is batching.' },

    { id:'vllm', n:'vLLM', by:'UC Berkeley / community', kind:'serving',
      two:'The open-source high-throughput inference server for self-hosted models. What you actually run in production once you decided to host your own weights.',
      pts:[
        '<b>PagedAttention</b> is the core idea: manage the KV cache in fixed-size pages like OS virtual memory, killing fragmentation and raising concurrent sequences per GPU dramatically.',
        '<b>Continuous batching</b> lets new requests join the running batch instead of waiting for it to drain — the single biggest throughput win over naive serving.',
        'It exposes an OpenAI-compatible server, so swapping a hosted API for your own GPU is a base-URL change for the caller.',
        'Prefix caching, tensor parallelism across GPUs, quantisation and speculative decoding are all in the same process — the whole serving toolbox.',
        'The three numbers to quote when defending it: tokens/second per GPU, time-to-first-token, and GPU memory utilisation. Those decide your cost per million tokens.'
      ],
      pick:'You are self-hosting open weights and real users are hitting it.',
      watch:'You now own capacity planning, OOMs and upgrades. That is a team cost, not just a server cost.' }
  ]
},

/* ============================================================ *
 * 2. AGENTIC AI                                                *
 * ============================================================ */
{
  id: 'agentic', n: 'Agentic AI', ico: '🕹️', color: '#fb923c', tag: 'orchestration',
  two: 'Frameworks that run the loop for you: call the model, execute the tool it asked for, feed the result back, decide whether to stop. They differ almost entirely in how much control they hand back to you.',
  pts: [
    'The axis that explains the whole layer is <b>graph versus conversation</b>. Graph frameworks make you declare states and transitions. Conversational ones let agents talk and hope the right thing emerges.',
    'Explicit graphs cost more up front and are far more debuggable, resumable and testable. Conversational swarms demo beautifully and are miserable to reproduce when they misbehave.',
    'Four features separate a toy from production: <b>durable state</b>, <b>human-in-the-loop interrupts</b>, <b>step and cost caps</b>, and <b>per-step observability</b>. Ask any framework which of the four it actually has.',
    'Multi-agent is not automatically better. Every extra agent is another context window, another handoff where information is lost, and another failure mode. Justify it with different tools or different permissions, not with an org chart.',
    'Nearly every framework is a wrapper over the same loop. Being able to write that loop in thirty lines yourself is the answer to "why not just use the SDK" — and sometimes the honest answer is that you should.'
  ],
  tools: [
    { id:'langgraph', n:'LangGraph', by:'LangChain', kind:'graph',
      two:'A library for building agents as explicit state machines — nodes, edges and a shared state object. The production-grade orchestration choice in the LangChain ecosystem.',
      pts:[
        'You model the agent as a <b>graph</b>: nodes are functions, edges are transitions, conditional edges are where the model routes. Control flow lives in code, not implied by a prompt.',
        '<b>Checkpointers</b> persist state after every node, giving crash recovery, resumable runs and time travel to any prior step — the features that make human-in-the-loop real.',
        '<b>interrupt()</b> pauses a run mid-graph for approval and resumes from the checkpoint, which is how you gate irreversible actions.',
        'State updates go through <b>reducers</b>, so concurrent branches merge deterministically instead of clobbering each other.',
        'It is deliberately lower level than a "make me an agent" framework, and the only one here with a straight answer to "what happens if the process dies mid-run".'
      ],
      pick:'Production agents that must be resumable, auditable and gated by humans.',
      watch:'Steep curve, and the state/reducer model is the part people get wrong first.' },

    { id:'crewai', n:'CrewAI', by:'CrewAI', kind:'roles',
      two:'A role-based multi-agent framework: define agents with a role, goal and backstory, give them tasks, and a crew executes sequentially or hierarchically.',
      pts:[
        'The mental model is a <b>team</b> — Researcher, Writer, Critic. It is the fastest route to a plausible multi-agent demo.',
        'Two process modes: <b>sequential</b> (tasks in order) and <b>hierarchical</b> (a manager agent delegates). The manager mode is where cost becomes unpredictable.',
        'It added <b>Flows</b> precisely because pure role-play was too loose for production — event-driven, explicit control flow, which is a quiet admission that graphs win.',
        'Prompts are largely generated from the role/goal/backstory strings, which is convenient and makes precise prompt control awkward.',
        'Best honest use: prototyping and content pipelines where a wrong step is cheap to throw away.'
      ],
      pick:'Rapid prototypes and content pipelines where "a team of specialists" maps naturally onto the task.',
      watch:'Token cost balloons — every agent resends its own context. Cap steps before demoing it to finance.' },

    { id:'autogen', n:'Microsoft AutoGen', by:'Microsoft Research', kind:'convo',
      two:'A research-born framework where agents solve tasks by conversing, including a user proxy agent that can execute generated code. Heavily used in agent research.',
      pts:[
        'The core abstraction is <b>conversable agents</b> in a group chat, with a manager choosing who speaks next.',
        '<b>UserProxyAgent</b> can execute generated code, which is powerful for data-analysis loops and the reason sandboxing is not optional here.',
        'v0.4 was a full rewrite to an async, event-driven, actor-style core. It fixed the scalability complaints and broke old code.',
        'Its research pedigree means new patterns land here first, and stability lands here last.',
        'Microsoft has been converging AutoGen and Semantic Kernel into the <b>Microsoft Agent Framework</b>, so treat AutoGen as that product\'s research lineage.'
      ],
      pick:'Research, experimentation, and code-execution loops for data work.',
      watch:'Free-form agent chat can loop forever or converge on confident nonsense. Termination conditions are yours to write.' },

    { id:'msaf', n:'Microsoft Agent Framework', by:'Microsoft', kind:'enterprise',
      two:'Microsoft\'s consolidation of AutoGen\'s research ideas and Semantic Kernel\'s enterprise plumbing into one supported SDK for .NET and Python.',
      pts:[
        'The pitch is <b>AutoGen\'s patterns with Semantic Kernel\'s stability</b> — multi-agent orchestration a support contract covers.',
        'First-class .NET support is genuinely differentiating; almost everything else on this map is Python-first.',
        'Deep Azure integration: Entra ID identity, Azure AI Foundry deployment, and OpenTelemetry-based tracing out of the box.',
        'It supports both graph-style workflows and conversational orchestration, so it spans both halves of this layer.',
        'Worth naming because it answers "what would a Microsoft shop use" and shows you track consolidation, not just launches.'
      ],
      pick:'Enterprise Microsoft/.NET shops already committed to Azure.',
      watch:'Young and still consolidating. APIs move, and migrating from AutoGen is real work.' },

    { id:'lliw', n:'LlamaIndex Workflows', by:'LlamaIndex', kind:'events',
      two:'LlamaIndex\'s event-driven orchestration layer: steps subscribe to event types and emit new ones, so control flow is a pub/sub graph rather than a call stack.',
      pts:[
        'Steps are decorated functions that take an event and return an event. Loops, branches and parallelism fall out of that naturally.',
        'Async-first with built-in streaming of intermediate events, so a UI can show progress without you plumbing callbacks.',
        'It inherits the strongest ingestion and indexing ecosystem here, so retrieval-heavy agents need much less glue.',
        'Context serialisation gives checkpoint-and-resume — the same capability LangGraph gets from checkpointers.',
        'The event model reads more naturally than a graph DSL for engineers coming from message-bus backgrounds.'
      ],
      pick:'Retrieval-heavy agents where you are already using LlamaIndex for ingestion.',
      watch:'Event-driven flow is harder to read at a glance — you cannot see the whole path in one function.' },

    { id:'strands', n:'AWS Strands Agents', by:'AWS', kind:'sdk',
      two:'AWS\'s open-source, model-driven agent SDK: give it a model, tools and a prompt, and let the model plan rather than encoding a graph yourself.',
      pts:[
        'Deliberately minimal. The pitch is that frontier models plan well enough now that hand-written orchestration is overhead.',
        'Model-agnostic despite the AWS badge — Bedrock, Anthropic, OpenAI and local models all work.',
        'Native MCP support, so tools arrive from MCP servers rather than bespoke wrappers.',
        'A short path to production on AWS — Lambda, Fargate or the Bedrock AgentCore runtime — with OpenTelemetry tracing built in.',
        'It is the clearest expression of the "less scaffolding, better models" argument, which is a live debate worth having an opinion on.'
      ],
      pick:'AWS shops that want an agent SDK without adopting a heavy framework.',
      watch:'Trusting the model to plan means fewer guardrails by default. You add the caps yourself.' },

    { id:'camel', n:'CAMEL', by:'CAMEL-AI', kind:'research',
      two:'A research framework for role-playing agent societies, and the origin of the "two agents converse to solve a task" pattern that later frameworks commercialised.',
      pts:[
        'The original paper introduced <b>inception prompting</b> — an AI user and an AI assistant given complementary roles so a conversation stays on task without a human.',
        'Its practical modern use is <b>synthetic data generation</b>: run agent societies at scale to produce training and eval data.',
        'It supports large simulated societies, which is why it appears in social-simulation research rather than product stacks.',
        'Fully open source and academically documented, so it is the right thing to cite when explaining where multi-agent ideas came from.',
        'Naming it signals you know the lineage rather than only the current product names — cheap credibility in a senior interview.'
      ],
      pick:'Research, simulation, and generating synthetic conversational data.',
      watch:'Not a production orchestration layer. Do not propose it as one.' },

    { id:'agno', n:'Agno', by:'Agno (formerly Phidata)', kind:'perf',
      two:'A performance-focused agent framework that markets itself on instantiation speed and memory footprint, with memory, knowledge and a debugging UI in the box.',
      pts:[
        'The differentiator is <b>overhead</b>: microsecond-scale agent instantiation and a few KB per agent, which matters when you spawn thousands.',
        'Batteries included — memory, session storage, vector knowledge and tools ship together rather than as five integrations.',
        'A built-in agent UI for chatting with and debugging agents locally shortens the inner loop noticeably.',
        'Model-agnostic behind a consistent interface, so provider swaps stay cheap.',
        'It is the counter-example to "all frameworks are bloat" — useful to name if you are arguing about framework overhead.'
      ],
      pick:'High-agent-count workloads, or when you want memory and knowledge without wiring five services.',
      watch:'Smaller community than LangChain or LlamaIndex. Fewer answers when you get stuck at 2am.' }
  ]
},

/* ============================================================ *
 * 3. RAG                                                       *
 * ============================================================ */
{
  id: 'rag', n: 'RAG', ico: '📚', color: '#60a5fa', tag: 'grounding',
  two: 'Retrieval-Augmented Generation: fetch the relevant facts, put them in the prompt, then answer. It is how a model frozen last year answers questions about a document written this morning.',
  pts: [
    'Five stages, any of which can be the bottleneck: <b>load → chunk → embed → retrieve → generate</b>. Most "the LLM is hallucinating" complaints are retrieval failures three stages earlier.',
    'Retrieval quality beats model quality. A frontier model with the wrong chunks loses to a cheap model with the right ones, every time.',
    'The standard upgrade path in order of value per hour: hybrid search (BM25 + dense), then a reranker, then better chunking, then query rewriting. Fine-tuning is last, not first.',
    'Chunking is the underrated decision. Too small loses context, too big averages the embedding into mush. Structure-aware splitting on headings beats a fixed character count almost always.',
    'Evaluate the halves separately: <b>retrieval</b> with recall@k and MRR, <b>generation</b> with groundedness and answer relevance. One end-to-end score tells you it is broken but never where.'
  ],
  tools: [
    { id:'langchain', n:'LangChain', by:'LangChain', kind:'framework',
      two:'The most widely used LLM application framework: a standard interface over models, prompts, retrievers, vector stores and tools, plus LCEL for composing them.',
      pts:[
        'Its real product is <b>interfaces</b>. Any vector store, model or loader behaves the same, so swapping a component is a one-line change.',
        '<b>LCEL</b> composes components with the pipe operator and gives streaming, batching and async across the whole chain for free.',
        'The integration count is the moat — hundreds of loaders, stores and tools you would otherwise write yourself.',
        'It is the most criticised tool here: too many abstractions, opaque stack traces, breaking changes. The fair modern answer is that <b>langchain-core</b> plus LangGraph is stable and the monolith era is over.',
        'A good senior take: use it for the connector library and the interfaces, not to hide control flow. Hidden control flow is what teams actually regret.'
      ],
      pick:'You want breadth of integrations and a common interface, and you will keep the control flow visible.',
      watch:'Abstraction depth. When a chain misbehaves you can be five wrappers away from the real prompt.' },

    { id:'llamaindex', n:'LlamaIndex', by:'LlamaIndex', kind:'framework',
      two:'A data framework focused on getting your documents into a model\'s context: ingestion, indexing, retrieval and query engines.',
      pts:[
        'Ingestion is the strength — <b>LlamaParse</b> handles nasty PDFs, tables and scans better than generic loaders, and bad parsing is where most RAG projects actually die.',
        'Multiple index types beyond a flat vector store: summary, tree, keyword and knowledge-graph indexes, chosen by question shape.',
        'Advanced retrieval ships in the box — auto-merging, sentence-window, recursive and small-to-big — the patterns you would otherwise hand-roll.',
        'Query engines add routing, sub-question decomposition and multi-document reasoning above plain top-k lookup.',
        'The clean comparison: LangChain is broad application glue, LlamaIndex is deep on the data path. Using both is a legitimate answer, not a hedge.'
      ],
      pick:'Document-heavy RAG, especially messy PDFs and multi-document question answering.',
      watch:'The abstraction stack is deep here too. Know what your query engine actually sends to the model.' },

    { id:'haystack', n:'Haystack', by:'deepset', kind:'framework',
      two:'A production-oriented open-source framework that models everything as an explicit pipeline of typed components connected by named ports.',
      pts:[
        'Pipelines are <b>declarative and serialisable to YAML</b>, so the same definition moves between dev, CI and production without code changes.',
        'Components have typed inputs and outputs and connections are validated at build time — wiring mistakes surface before the first API call, not during it.',
        'It predates the LLM boom as a search/QA framework, so BM25, classic retrieval and reader models are first-class rather than afterthoughts.',
        'Engineering discipline is the selling point: fewer magic defaults, less hidden prompting, more explicit structure.',
        'A strong pick for European enterprises — deepset is a German company with an on-prem enterprise offering.'
      ],
      pick:'Teams that want RAG as explicit, testable, config-driven infrastructure.',
      watch:'Smaller integration catalogue, and more verbosity to write for the same result.' },

    { id:'dspy', n:'DSPy', by:'Stanford NLP', kind:'compiler',
      two:'A framework that treats prompts as parameters to be optimised rather than strings to be hand-written. You declare signatures; it compiles the prompt against a metric.',
      pts:[
        'The reframing: you write <b>signatures</b> ("question, context -> answer") and modules, and an optimiser searches for the prompt and few-shot examples that maximise your metric.',
        'Optimisers such as BootstrapFewShot and MIPRO generate and select demonstrations automatically from your training examples.',
        'It makes prompts <b>portable across models</b> — recompile against a new model instead of hand-re-tuning every prompt when you switch.',
        'It forces a metric to exist. You cannot use DSPy without defining what "better" means, which is why teams that adopt it end up with real evals.',
        'The comparison line: LangChain composes calls, DSPy optimises them. Different problems; they can be used together.'
      ],
      pick:'You have a measurable task with labelled examples and you are tired of hand-tuning prompts.',
      watch:'Compilation burns real API calls, and without decent training examples the optimiser has nothing to work with.' },

    { id:'ragflow', n:'RAGFlow', by:'InfiniFlow', kind:'platform',
      two:'An open-source, self-hosted RAG platform built around deep document understanding, with a UI for ingestion, chunk review and chat.',
      pts:[
        'Its differentiator is <b>DeepDoc</b>: layout-aware parsing that understands tables, headers and figures instead of flattening a PDF into a text blob.',
        'Template-based chunking per document type (paper, manual, invoice, resume) rather than one global splitter setting.',
        'You can <b>see and edit the chunks</b> in the UI before indexing, which turns chunking from a guess into a review step.',
        'Grounded citations point back to the exact source region, which is what makes answers auditable for non-technical users.',
        'It ships as a Docker Compose stack — an appliance you deploy, not a library you import.'
      ],
      pick:'You want a working self-hosted RAG product with document-quality control, not a library to build one.',
      watch:'Heavier to run (several services) and less flexible than code when you need something custom.' },

    { id:'graphrag', n:'GraphRAG', by:'Microsoft', kind:'technique',
      two:'A Microsoft technique and toolkit that builds a knowledge graph from your corpus, then answers over graph communities instead of isolated chunks.',
      pts:[
        'It exists to fix the one thing vector RAG cannot do: <b>global questions</b> like "what are the main themes across all these documents", where no single chunk holds the answer.',
        'Indexing extracts entities and relationships with an LLM, clusters them into communities, and pre-writes community summaries.',
        'Two query modes: <b>local</b> (walk the graph around named entities) and <b>global</b> (map-reduce over community summaries).',
        'Indexing is expensive — many LLM calls per document — so it pays off on stable, heavily queried corpora, not fast-changing data.',
        'Always offer the cheap alternative too: entity extraction plus metadata filtering gets part of the way for a fraction of the cost.'
      ],
      pick:'Multi-hop and thematic questions over a stable corpus where plain top-k demonstrably fails.',
      watch:'Indexing cost is the headline objection. Have a number ready and a cheaper fallback.' },

    { id:'unstructured', n:'Unstructured', by:'Unstructured.io', kind:'ingestion',
      two:'The ingestion workhorse: turns PDFs, Word docs, HTML, email, images and slides into clean typed elements a chunker can work with.',
      pts:[
        'Partitioning returns <b>typed elements</b> — Title, NarrativeText, Table, ListItem — rather than a flat string, which is what makes structure-aware chunking possible.',
        'Two strategies matter: <b>fast</b> (text extraction, cheap) and <b>hi_res</b> (layout model plus OCR, slow, required for scans and complex tables).',
        'It handles the long tail of formats you did not plan for, which is exactly where a hand-rolled loader collapses.',
        'chunk_by_title groups elements under their heading, preserving hierarchy in the chunk — usually a bigger quality win than tuning chunk size.',
        'Open-source library plus a hosted API. The OSS version needs system dependencies such as poppler and tesseract, which surprises people in Docker builds.'
      ],
      pick:'Any RAG system whose inputs are real-world documents rather than clean markdown.',
      watch:'hi_res is slow and CPU-hungry. Choose the strategy per document type, not globally.' },

    { id:'embedchain', n:'EmbedChain', by:'Mem0', kind:'wrapper',
      two:'A deliberately tiny RAG wrapper — add a source, ask a question, three lines total. Now folded into the Mem0 project.',
      pts:[
        'The whole API is roughly <b>add()</b> and <b>query()</b>; loading, chunking, embedding and retrieval are all defaulted for you.',
        'It exists to prove that a basic RAG demo is easy — while hiding chunking, evaluation and retrieval tuning, which are the hard parts.',
        'Good for prototypes, internal tools and teaching. The defaults are sensible and you will outgrow them.',
        'It has largely merged into Mem0, so treat the name as Mem0\'s lineage rather than a separately maintained product.',
        'Naming it invites a senior point: convenience wrappers are fine until you need to tune retrieval, and then you need the layer underneath.'
      ],
      pick:'Prototypes and demos where you want RAG working in five minutes.',
      watch:'Hidden defaults. When quality is bad there is no dial to turn without dropping a layer.' }
  ]
},

/* ============================================================ *
 * 4. EMBEDDING                                                 *
 * ============================================================ */
{
  id: 'embed', n: 'Embedding', ico: '🧬', color: '#f472b6', tag: 'text to vectors',
  two: 'Models that turn text into a fixed-length vector where distance means similarity. They are what makes semantic search possible, and they are the most consequential low-level choice in a RAG system.',
  pts: [
    'An embedding is a point in high-dimensional space. Cosine similarity between two of them approximates "do these mean the same thing" — that is the entire trick.',
    'Embeddings from different models are <b>not comparable</b>. Changing model means reindexing your whole corpus, which is why this choice is expensive to reverse.',
    'Dimensions are a direct cost lever: 3072 dims cost twice the storage and roughly twice the search work of 1536. Matryoshka models let you truncate to fewer dimensions with graceful degradation.',
    'Bi-encoder versus cross-encoder is the distinction to have crisp. Bi-encoders embed documents once and are fast to search. Cross-encoders read query and document together — far more accurate, far too slow to run over everything, so they are used to <b>rerank</b> the shortlist.',
    'Never pick on the MTEB leaderboard alone. Build fifty real query/document pairs from your own domain and measure recall@10. Public rankings do not transfer to your jargon.'
  ],
  tools: [
    { id:'oaiemb', n:'OpenAI Embeddings', by:'OpenAI', kind:'hosted',
      two:'The text-embedding-3 family (small and large): the default hosted embedding API, cheap and good enough that most teams never change it.',
      pts:[
        'Two tiers — <b>small</b> for cost, <b>large</b> for quality — and the small one is startlingly competitive per dollar.',
        'Supports <b>Matryoshka</b> truncation: request fewer dimensions and quality degrades gracefully instead of falling off a cliff.',
        'Embedding is far cheaper than generation, so re-embedding a corpus is usually affordable; the pain is reindexing time, not the API bill.',
        'It is a hosted call, so every document leaves your network at index time — the same data-residency conversation as the chat model, and people forget it.',
        'Batch many texts per request. One text per call wastes most of your throughput on HTTP overhead.'
      ],
      pick:'Default starting point when you are already calling OpenAI and have no residency constraint.',
      watch:'Rate limits bite hard on a first bulk index. Batch, and back off.' },

    { id:'cohemb', n:'Cohere Embed', by:'Cohere', kind:'hosted',
      two:'Cohere\'s multilingual embedding family, notable for input-type awareness and compression-friendly output formats.',
      pts:[
        'You declare an <b>input_type</b> — search_document versus search_query — and the model embeds each side differently, which measurably improves retrieval.',
        'Strong multilingual coverage in a single model, so you do not need a per-language index.',
        'Supports int8 and binary output, cutting vector storage dramatically at a small recall cost — the cheapest scaling lever most teams never pull.',
        'Pairs naturally with Cohere Rerank, giving you both retrieval stages from one vendor and one latency profile.',
        'Deployable in your own VPC, which keeps it on the shortlist for regulated data.'
      ],
      pick:'Multilingual corpora, or when storage cost at scale is a real constraint.',
      watch:'Forgetting input_type silently costs you accuracy. Nothing errors; results just get worse.' },

    { id:'voyage', n:'Voyage AI', by:'Voyage AI (MongoDB)', kind:'hosted',
      two:'A specialist embedding and reranking provider, known for domain-tuned models for code, finance and law. Acquired by MongoDB.',
      pts:[
        'Domain-specific variants (voyage-code, voyage-law, voyage-finance) consistently beat general-purpose models on their domain — the clearest case for not defaulting.',
        'Anthropic pointed at Voyage as a recommended embedding partner, which is why it shows up in Claude-centric stacks.',
        'Offers rerankers as well as embeddings, so both retrieval stages come from one provider.',
        'Supports large context per document and quantised output for storage savings.',
        'The MongoDB acquisition means tight integration with Atlas Vector Search — relevant if you are already there.'
      ],
      pick:'Code search, or legal/financial corpora where a domain-tuned model earns its keep.',
      watch:'A smaller vendor than the hyperscalers. Weigh that against the accuracy gain.' },

    { id:'sbert', n:'Sentence Transformers', by:'UKP Lab / Hugging Face', kind:'oss',
      two:'The open-source Python library for running and training embedding models locally. The reason "just embed it yourself" is a two-line option.',
      pts:[
        'model.encode(texts) is the whole API for inference. Local, free, no network, no key.',
        'It is the standard <b>training</b> library too — fine-tune an embedding model on your own pairs with MultipleNegativesRankingLoss and beat any general model on your domain.',
        'Runs the entire open embedding catalogue, including the BGE, E5 and GTE families.',
        'Includes CrossEncoder classes, so your reranker can be local and free as well.',
        'The trade against hosted: you own the GPU/CPU cost and the latency, but nothing leaves your network and the marginal cost per document is zero.'
      ],
      pick:'Self-hosted embedding, offline work, or fine-tuning an embedder on your own data.',
      watch:'CPU inference is slow at corpus scale. Plan for a GPU or a long first index.' },

    { id:'bge', n:'BGE', by:'BAAI', kind:'oss',
      two:'BAAI\'s open-weights embedding family (BAAI General Embedding) — the strongest freely downloadable embedders for a long stretch, and still a standard baseline.',
      pts:[
        'Free, open weights, and competitive with hosted models on English and Chinese retrieval.',
        'It expects an <b>instruction prefix</b> on queries ("Represent this sentence for searching relevant passages:"). Omitting it quietly costs accuracy — a classic gotcha.',
        '<b>BGE-M3</b> is the notable variant: dense, sparse and multi-vector retrieval from one model, so you get hybrid search without two systems.',
        'BAAI also ships bge-reranker, giving a free local cross-encoder for the second stage.',
        'Runs through sentence-transformers, so adopting it is a model-name change, not an integration.'
      ],
      pick:'Self-hosted embedding where you want quality without a per-token bill.',
      watch:'The instruction prefix. It is the single most common reason a BGE deployment underperforms its benchmarks.' },

    { id:'vertexemb', n:'Vertex AI Embeddings', by:'Google Cloud', kind:'hosted',
      two:'Google Cloud\'s managed embedding models for text, multimodal and code, delivered inside Vertex AI with enterprise controls.',
      pts:[
        'Task-type parameters (RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT, SEMANTIC_SIMILARITY, CLASSIFICATION) tune the same model per use — the Google equivalent of Cohere\'s input_type.',
        'Multimodal embeddings put images and text in one shared space, which is what enables text-to-image search without a separate pipeline.',
        'It inherits Vertex governance — IAM, VPC Service Controls, data residency, audit logs — which is usually the actual reason it is chosen.',
        'Batch prediction handles large corpora as a managed job rather than you writing retry loops.',
        'Plugs directly into Vertex Vector Search, so index and embed live in one billing and permission boundary.'
      ],
      pick:'You are on GCP and governance matters as much as accuracy.',
      watch:'Task type is easy to leave on the default and quietly costs retrieval quality.' },

    { id:'azemb', n:'Azure OpenAI Embeddings', by:'Microsoft Azure', kind:'hosted',
      two:'The same OpenAI embedding models, served through Azure with enterprise networking, identity and compliance around them.',
      pts:[
        'Model parity with OpenAI but under an Azure agreement — data stays in your chosen region and is not used for training.',
        'Private Endpoints and VNet integration mean the traffic never touches the public internet, which is often the only reason it is chosen over OpenAI direct.',
        'Entra ID (managed identity) instead of API keys removes a whole class of secret-management problems.',
        'You deploy a named model into your resource, so version pinning is explicit rather than implicit — a real operational advantage.',
        'Pairs with Azure AI Search, which does hybrid retrieval and semantic reranking natively.'
      ],
      pick:'Microsoft-shop enterprises that need OpenAI quality inside their own compliance boundary.',
      watch:'Regional model availability lags OpenAI direct, and quota is per-deployment. Both surprise teams late.' }
  ]
}

);
