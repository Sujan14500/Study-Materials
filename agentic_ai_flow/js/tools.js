/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch3: tools & function calling ---------- */
C.toolstrips.tools = {
  title: 'Tools & frameworks — function calling',
  sub: 'Three ways to turn a Python function into something a model can call, plus the two things that force the arguments to be valid.',
  tools: [
    { n: 'Native tool calling', by: 'OpenAI / Anthropic / Google', mark: 'fn', c: '#10a37f',
      what: 'The provider API takes a list of JSON Schema tool definitions and returns structured calls, not prose.',
      pro: ['The API enforces the structure, so no parsing of prose', 'Parallel tool calls supported', 'Trained behaviour, so selection is far more reliable'],
      con: ['Schema shapes differ per provider', 'Vague descriptions mean the model never calls your tool'],
      use: 'Always, when the provider supports it. Text-based ReAct is the fallback, not the default.' },
    { n: 'Pydantic', by: 'Pydantic', mark: 'py', c: '#e92063',
      what: 'Declare the arguments as a typed model; get the JSON Schema for the tool and validation of what came back.',
      pro: ['One definition drives the schema and the validation', 'Business rules encoded as validators, not prompt text', 'Errors specific enough to feed back as a repair'],
      con: ['v1/v2 differences bite in mixed dependency trees', 'Uncapped repair loops become a money pump'],
      use: 'Every tool whose arguments must be trusted before you execute anything.' },
    { n: 'LangChain @tool', by: 'LangChain', mark: '🔗', c: '#1c3c3c',
      what: 'A decorator that turns a typed function into a tool definition any of its agent loops can use.',
      pro: ['Schema from type hints and docstring', 'Hundreds of ready-made tools already exist', 'Works across every model provider it supports'],
      con: ['Pulls in the framework for something small', 'The generated description is easy to leave too vague'],
      use: 'You are already on LangChain, or you want its existing tool catalogue.' },
    { n: 'FastMCP', by: 'Prefect / community', mark: '🔌', c: '#22d3ee',
      what: 'Decorate a typed function and it becomes an MCP tool any assistant can discover and call.',
      pro: ['Write the tool once instead of once per client', 'v2 generates a server from an OpenAPI spec', 'In-process testing, so tools get unit tests'],
      con: ['Another process and protocol to operate', 'v1 lives in the official SDK, v2 is separate — say which'],
      use: 'The same tools must be available to several assistants or IDEs.' },
    { n: 'Constrained decoding', by: 'Outlines / llama.cpp / vLLM', mark: '{}', c: '#fbbf24',
      what: 'Restrict generation at the token level so the output cannot be invalid against a grammar or schema.',
      pro: ['Invalid JSON becomes structurally impossible', 'No retry loop and no repair prompt', 'Works with open models that have no native tool API'],
      con: ['Needs control of the sampler, so self-hosting mostly', 'An over-tight grammar can hurt answer quality'],
      use: 'Self-hosted models where the output must parse every single time.' }
  ]
};

/* ---------- Ch7: planning ---------- */
C.toolstrips.plan = {
  title: 'Tools & frameworks — planning',
  sub: 'Planning is a prompting strategy before it is a library. These are the named strategies you will be asked to compare, and the code that implements them.',
  tools: [
    { n: 'ReAct', by: 'Yao et al. / everywhere', mark: 'RA', c: '#fb923c',
      what: 'Interleave reasoning and acting: think, call one tool, observe the real result, think again.',
      pro: ['Adapts after every observation, so it recovers from surprises', 'Simple to implement and to debug', 'The default in every framework for a reason'],
      con: ['No global view, so it can wander', 'One tool at a time means many sequential round trips'],
      use: 'Exploratory tasks where the next step genuinely depends on the last result.' },
    { n: 'Plan-and-Execute', by: 'BabyAGI lineage / LangChain', mark: 'PE', c: '#7c5cff',
      what: 'Write the whole plan first with a strong model, then execute each step, optionally with a cheaper one.',
      pro: ['Independent steps can run in parallel', 'Cheap model does the execution, so cost drops', 'The plan is inspectable and approvable before anything runs'],
      con: ['A plan written before the facts is often wrong', 'Needs a replanning path or it fails rigidly'],
      use: 'Tasks with predictable structure, and anywhere a human should approve the plan first.' },
    { n: 'Self-Ask', by: 'Press et al.', mark: 'SA', c: '#22d3ee',
      what: 'The model explicitly asks and answers sub-questions before committing to the final answer.',
      pro: ['Strong on multi-hop questions where one lookup is not enough', 'The sub-questions are readable, so failures are obvious', 'Maps cleanly onto a search tool'],
      con: ['More calls per answer', 'Can invent sub-questions that lead nowhere'],
      use: 'Multi-hop factual questions — "who directed the film that won X in the year Y".' },
    { n: 'Tree of Thoughts', by: 'Yao et al.', mark: 'ToT', c: '#f472b6',
      what: 'Explore several reasoning branches, score them, and backtrack from the ones that look wrong.',
      pro: ['Genuinely better on puzzles and constraint problems', 'Can abandon a bad path instead of committing', 'Search depth is a dial you control'],
      con: ['Cost multiplies with branching factor', 'Needs a decent way to score a partial thought'],
      use: 'Hard reasoning with a checkable intermediate state. Rarely worth it for ordinary tasks.' },
    { n: 'LangGraph', by: 'LangChain', mark: '🕹', c: '#1c3c3c',
      what: 'Where a planning strategy stops being a prompt and becomes an inspectable graph with durable state.',
      pro: ['The plan is a data structure you can show a human', 'Checkpoints mean a failed step does not lose the run', 'Conditional edges express replanning explicitly'],
      con: ['More upfront design than a prompt strategy', 'Overkill for a three-step task'],
      use: 'A plan that must survive a crash, be approved, or be audited afterwards.' }
  ]
};

/* ---------- Ch8: memory ---------- */
C.toolstrips.memory = {
  title: 'Tools & frameworks — agent memory',
  sub: 'Storing messages is easy. Deciding what is worth keeping, what supersedes what, and what to inject next time is the actual product.',
  tools: [
    { n: 'Mem0', by: 'Mem0', mark: '🧷', c: '#a78bfa',
      what: 'Extracts durable facts from conversations, then decides ADD, UPDATE, DELETE or NOOP against what it already knows.',
      pro: ['Conflict resolution, not just appending', 'Vector, graph and key-value storage together', 'Scoped by user, agent and session'],
      con: ['Every extraction is an LLM call', 'A wrong extraction becomes a durable wrong belief'],
      use: 'Assistants that must remember preferences and history across sessions.' },
    { n: 'Zep', by: 'Zep', mark: '⏳', c: '#22d3ee',
      what: 'A temporal knowledge graph where facts carry validity intervals, so the system knows when something stopped being true.',
      pro: ['Superseded facts are invalidated, not deleted, so history is auditable', 'Fuses semantic, keyword and graph retrieval', 'Handles business data and conversation in one graph'],
      con: ['A graph is more moving parts than a table', 'Needs a real temporal requirement to justify'],
      use: 'Long-lived assistants where facts change and decisions must be explainable later.' },
    { n: 'Letta (MemGPT)', by: 'Letta', mark: '🧠', c: '#f472b6',
      what: 'Agents that page information between limited context and external storage, editing their own memory with tools.',
      pro: ['Tiered memory: core, recall, archival', 'Agents are stateful services with persistent identity', 'The clearest research framing of memory as a systems problem'],
      con: ['Self-editing memory can drift', 'Needs monitoring like any autonomous behaviour'],
      use: 'Long-running agents expected to curate their own knowledge over months.' },
    { n: 'LangGraph Store', by: 'LangChain', mark: '🕹', c: '#1c3c3c',
      what: 'Checkpointers for this thread plus a namespaced cross-thread Store with semantic search.',
      pro: ['Same mechanism as crash recovery, so no extra service', 'Namespaces give per-user isolation for free', 'No extra network hop or vendor'],
      con: ['Gives you storage, not curation', 'Extraction, dedup and decay are still your code'],
      use: 'You are already on LangGraph and do not want another dependency.' },
    { n: 'Postgres + pgvector', by: 'PostgreSQL', mark: '🐘', c: '#336791',
      what: 'Conversation history in a table, user facts in JSONB, semantic recall via vectors — all in one database.',
      pro: ['One system to back up, secure and delete from', 'A GDPR deletion request is a DELETE, not an integration', 'Joins between facts and business data'],
      con: ['You write the extraction and decay logic yourself', 'No built-in conflict resolution'],
      use: 'The honest default. A memory service earns its place only once curation actually hurts.' }
  ]
};

/* ---------- Ch10: multi-agent ---------- */
C.toolstrips.multi = {
  title: 'Tools & frameworks — multi-agent',
  sub: 'Every extra agent is another context window, another handoff where information is lost, and another failure mode. Justify it with different tools or permissions.',
  tools: [
    { n: 'LangGraph', by: 'LangChain', mark: '🕹', c: '#1c3c3c',
      what: 'Supervisor and swarm topologies as explicit graphs, with shared state and per-node checkpoints.',
      pro: ['Handoffs are edges you can see and test', 'State merging is deterministic via reducers', 'A crash does not lose the run'],
      con: ['You design the topology yourself', 'More code than a role-play framework'],
      use: 'Multi-agent systems that have to run reliably rather than demo well.' },
    { n: 'CrewAI', by: 'CrewAI', mark: '👥', c: '#fb923c',
      what: 'Agents defined by role, goal and backstory, executed sequentially or by a manager that delegates.',
      pro: ['A working crew in minutes', 'The team metaphor is genuinely easy to reason about', 'Flows added when role-play proved too loose'],
      con: ['Manager mode makes cost unpredictable', 'Generated prompts are hard to control precisely'],
      use: 'Prototypes and content pipelines where a wrong step is cheap to discard.' },
    { n: 'AutoGen', by: 'Microsoft Research', mark: 'AG', c: '#0f62fe',
      what: 'Conversable agents in a group chat, with a manager choosing who speaks and a proxy that can execute code.',
      pro: ['Code execution loops are genuinely powerful for data work', 'v0.4 async event-driven core scales better', 'New research patterns land here first'],
      con: ['Free-form chat can loop or converge on confident nonsense', 'Code execution demands a sandbox'],
      use: 'Research, experimentation, and analysis loops that need to run code.' },
    { n: 'OpenAI Agents SDK', by: 'OpenAI', mark: 'oa', c: '#10a37f',
      what: 'Handoffs as a first-class primitive: delegating to another agent is itself a traceable tool call.',
      pro: ['Delegation is explicit and shows up in traces', 'Small and readable', 'Guardrails and sessions included'],
      con: ['Provider-shaped', 'No durable state across a crash'],
      use: 'A router plus specialists, on an OpenAI stack, without a heavy framework.' },
    { n: 'A2A protocol', by: 'Google', mark: 'A2A', c: '#4285f4',
      what: 'An open protocol for agents built by different teams or vendors to discover and talk to each other.',
      pro: ['Cross-organisation agent interoperability', 'Complements MCP: MCP is agent-to-tool, A2A is agent-to-agent', 'Capability discovery via agent cards'],
      con: ['Early, and adoption is still thin', 'Solves a problem most teams do not yet have'],
      use: 'Agents owned by different teams or companies genuinely need to cooperate.' }
  ]
};

/* ---------- Ch11: guardrails ---------- */
C.toolstrips.guard = {
  title: 'Tools & frameworks — guardrails',
  sub: 'Layered, because none of these is reliable alone. The deterministic gate in your own code is the one that actually holds.',
  tools: [
    { n: 'NeMo Guardrails', by: 'NVIDIA', mark: 'nm', c: '#76b900',
      what: 'Programmable dialogue rails: input, dialog, retrieval, execution and output, defined in a DSL called Colang.',
      pro: ['Topical rails keep a bot on subject', 'Five rail types, so you block at the cheapest stage', 'Can delegate to other checkers'],
      con: ['Colang is a language your team must learn', 'Every rail adds latency to the request'],
      use: 'Enterprise chatbots that must follow scripted conversational policy.' },
    { n: 'Guardrails AI', by: 'Guardrails AI', mark: 'ga', c: '#7c5cff',
      what: 'Validate output against declared expectations and automatically re-ask when validation fails.',
      pro: ['A hub of pre-built validators: PII, toxicity, valid SQL, no secrets', 'Custom rules are ordinary Python classes', 'Structure validation catches most "garbage output" bugs'],
      con: ['Each re-ask is another billed call', 'Loops if you do not cap retries'],
      use: 'Structured output validation and content policy inside a Python stack.' },
    { n: 'Presidio', by: 'Microsoft', mark: '🕵', c: '#0f62fe',
      what: 'PII detection and anonymisation: NER plus regexes plus checksum validators, with reversible operators.',
      pro: ['Redact before the call, restore after — the response still makes sense', 'Custom recognisers for your own ID formats', 'Not LLM-specific, so it is mature'],
      con: ['NER recall is not perfect', 'For regulated data, pair it with structural controls'],
      use: 'Anything user-typed heading for a hosted model, and de-identifying your own traces.' },
    { n: 'Bedrock Guardrails', by: 'AWS', mark: '☁', c: '#ff9900',
      what: 'Model-independent policy: content filters, denied topics in plain English, PII redaction, contextual grounding.',
      pro: ['Same policy across Claude, Llama or Titan — and outside Bedrock via ApplyGuardrail', 'Denied topics written by non-engineers', 'Versioned, IAM-controlled, auditable'],
      con: ['Latency and cost on every call', 'Over-tight thresholds block legitimate traffic'],
      use: 'A uniform, auditable policy layer across mixed models on AWS.' },
    { n: 'A deterministic gate', by: 'your own code', mark: '{}', c: '#34d399',
      what: 'An if-statement your code runs before the side effect: amount limits, ownership checks, an approval interrupt.',
      pro: ['Deterministic, testable, and cannot be talked out of it', 'Costs nothing and adds no latency', 'The only defence that actually holds for irreversible actions'],
      con: ['You must enumerate the rules yourself', 'Does nothing about content quality'],
      use: 'Every irreversible action, always, regardless of what else you have layered above it.' }
  ]
};

/* ---------- Ch13: evaluating agents ---------- */
C.toolstrips.eval = {
  title: 'Tools & frameworks — evaluating agents',
  sub: 'Agents need trajectory evaluation, not just answer evaluation. Did it reach the right answer, and did it get there without doing anything alarming?',
  tools: [
    { n: 'LangSmith', by: 'LangChain', mark: 'ls', c: '#1c3c3c',
      what: 'Traces every step of a run as nested spans, then turns real traces into a regression dataset.',
      pro: ['Auto-instruments LangChain and LangGraph', 'Step-level view is what agent debugging actually needs', 'Annotation queues for human labelling'],
      con: ['Hosted by default; self-host is enterprise only', 'Ecosystem gravity'],
      use: 'You need to see exactly which step went wrong, this afternoon.' },
    { n: 'Langfuse', by: 'Langfuse', mark: 'lf', c: '#34d399',
      what: 'Open-source tracing and evaluation, self-hostable, framework-agnostic via OpenTelemetry.',
      pro: ['Traces stay in your network', 'Traces your non-LLM services in the same view', 'Cost per trace, user and session'],
      con: ['You operate Postgres, ClickHouse and a queue', 'More setup than a signup'],
      use: 'Traces contain data that cannot leave, or you refuse the lock-in.' },
    { n: 'Promptfoo', by: 'Promptfoo', mark: 'pf', c: '#fbbf24',
      what: 'Declarative test cases in CI, plus a red-team mode that generates adversarial inputs and reports what got through.',
      pro: ['Regression suite reviewable in a pull request', 'Red-team findings map to OWASP LLM risks', 'Most assertions are free'],
      con: ['Not a tracing platform', 'LLM-graded assertions cost money'],
      use: 'Proving a prompt or tool change did not break known cases, and probing for injection.' },
    { n: 'DeepEval', by: 'Confident AI', mark: 'de', c: '#f472b6',
      what: 'Pytest-style LLM evaluation: metrics as assertions inside a normal test suite.',
      pro: ['Feels like tests your team already writes', 'Includes agent-specific metrics such as task completion and tool correctness', 'Runs in existing CI with no new runner'],
      con: ['Judge-based metrics cost calls per assertion', 'Younger than the tracing platforms'],
      use: 'Teams that want evals to live in pytest rather than a separate platform.' },
    { n: 'Trajectory review', by: 'your own eval set', mark: '👁', c: '#22d3ee',
      what: 'A fixed set of tasks with the expected tool sequence, scored on both the answer and the path taken.',
      pro: ['Catches the agent that got the right answer by an alarming route', 'No vendor required', 'Exactly the failures your product cares about'],
      con: ['Building and maintaining it is real work', 'Expected trajectories go stale as tools change'],
      use: 'Any agent with side effects, where how it got there matters as much as the answer.' }
  ]
};

/* ---------- Ch16: MCP ---------- */
C.toolstrips.mcp = {
  title: 'Tools & frameworks — MCP',
  sub: 'Write the tool once and any client can use it. Then spend the rest of your time on the permissions, because that is where the risk lives.',
  tools: [
    { n: 'MCP SDK', by: 'Anthropic / community', mark: '🔌', c: '#d97757',
      what: 'Official protocol implementations in Python, TypeScript, Java, C#, Go and Rust.',
      pro: ['Handshake, capability negotiation and framing handled for you', 'Also carries sampling and elicitation', 'Version negotiation across client and server ages'],
      con: ['You still write every tool description carefully', 'Lower level than FastMCP for simple servers'],
      use: 'Writing a server or client where you want the protocol handled correctly.' },
    { n: 'FastMCP', by: 'Prefect / community', mark: 'fm', c: '#22d3ee',
      what: 'Decorator plus a type-hinted function equals a tool. The FastAPI ergonomics, applied to MCP.',
      pro: ['Schema generated from type hints and docstring', 'v2 turns an OpenAPI spec into a server', 'In-process testing utilities'],
      con: ['v1 lives in the official SDK, v2 is separate', 'Easy to expose more than you meant to'],
      use: 'Wrapping an internal API you already have, in Python.' },
    { n: 'GitHub MCP Server', by: 'GitHub', mark: '🐙', c: '#6e5494',
      what: 'Repositories, issues, pull requests, actions and code search as MCP tools.',
      pro: ['Read repo, run tests, open a PR without bespoke integration per assistant', 'Toolsets can be enabled selectively', 'A read-only mode exists'],
      con: ['Issue and PR text is attacker-controlled input', 'Write scope plus untrusted content is the classic injection chain'],
      use: 'Coding agents, especially across more than one assistant.' },
    { n: 'PostgreSQL MCP Server', by: 'community', mark: '🐘', c: '#336791',
      what: 'Schema introspection and query execution, so an agent can answer from live relational data.',
      pro: ['Introspection means the model writes correct SQL', 'A read-only role removes a whole class of incident', 'Row-level security handles multi-tenancy'],
      con: ['Generated SQL against a write role is the most dangerous tool here', 'Needs statement timeouts and row limits in the server'],
      use: 'Analytics and support agents that must answer from the real database.' },
    { n: 'Filesystem MCP Server', by: 'Anthropic (reference)', mark: '📁', c: '#94a3b8',
      what: 'Read, write, list and search files within explicitly allowlisted directories.',
      pro: ['Demonstrates the whole protocol in minutes', 'Directory allowlisting is a real boundary', 'Perfect for local coding agents'],
      con: ['Write and move tools are genuinely destructive', 'Pointed at a home directory it will read your .env files'],
      use: 'Local coding and document agents — configured read-only unless it truly needs to write.' }
  ]
};

/* ---------- Ch: ship it ---------- */
C.toolstrips.ship = {
  title: 'Tools & frameworks — running agents in production',
  sub: 'An agent run is slow, stateful and expensive. That combination is what breaks a normal request/response architecture.',
  tools: [
    { n: 'FastAPI', by: 'Sebastián Ramírez', mark: '🚪', c: '#009688',
      what: 'The async service in front of the agent: validated requests, streamed events, background jobs.',
      pro: ['Async suits calls that are mostly waiting', 'Stream intermediate steps so the user sees progress', 'Background tasks so a 40-second run does not hold a connection'],
      con: ['A blocking call stalls the whole event loop', 'Timeouts must match across every layer'],
      use: 'Any agent other software will call. Return a job ID, do not hold the request.' },
    { n: 'Temporal', by: 'Temporal', mark: '⏱', c: '#f472b6',
      what: 'Durable execution: workflow state persisted as an event history, so a crash resumes exactly where it stopped.',
      pro: ['Completed steps are not paid for twice after a crash', 'Workflows can sleep for days waiting on approval', 'Retries, timeouts and heartbeats per activity'],
      con: ['Deterministic-workflow discipline is a real learning curve', 'A cluster to run or a cloud bill to pay'],
      use: 'Long-running agents where losing progress is unacceptable.' },
    { n: 'LangGraph checkpointers', by: 'LangChain', mark: '💾', c: '#1c3c3c',
      what: 'Persist graph state after every node into Postgres or Redis, giving resume, time travel and interrupts.',
      pro: ['Durability without adding a workflow engine', 'Human approval falls straight out of it', 'Time travel makes post-incident review possible'],
      con: ['Only durable within the graph abstraction', 'Checkpoint storage grows and needs a retention policy'],
      use: 'You want durability and human gates without adopting Temporal.' },
    { n: 'Redis', by: 'Redis', mark: '⚡', c: '#dc382d',
      what: 'Session state, rate limits, idempotency keys and a semantic cache for repeated questions.',
      pro: ['Sub-millisecond reads for the working set', 'TTLs give session expiry for free', 'Semantic caching cuts model spend directly'],
      con: ['RAM is expensive per GB', 'A loose cache similarity threshold serves confidently wrong answers'],
      use: 'Session state and caching in front of an agent that gets repetitive questions.' },
    { n: 'Helicone', by: 'Helicone', mark: 'hl', c: '#fb7185',
      what: 'A gateway in front of the model: logging, caching, retries, per-user rate limits and spend attribution.',
      pro: ['One-line adoption via a base URL change', 'Per-user cost attribution answers "who is burning the budget"', 'Open source and self-hostable'],
      con: ['A proxy in the critical path', 'Must fail open or it becomes your outage'],
      use: 'Spend control and observability across services you cannot instrument one by one.' }
  ]
};
