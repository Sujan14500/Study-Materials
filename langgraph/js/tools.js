/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: checkpointers ---------- */
C.toolstrips.persist = {
  title: 'Tools & frameworks — checkpointers',
  sub: 'The checkpointer is the single decision that turns a demo into something that survives a deploy. These are the four you will actually pick between.',
  tools: [
    { n: 'MemorySaver', by: 'LangGraph', mark: 'ram', c: '#94a3b8',
      what: 'An in-process dictionary. State survives within one Python process and nothing more.',
      pro: ['Zero setup — one line and interrupts start working', 'Perfect for tests and notebooks', 'No infrastructure at all'],
      con: ['A restart loses everything', 'Useless across more than one worker'],
      use: 'Development, notebooks and unit tests. Never production.' },
    { n: 'PostgresSaver', by: 'LangGraph', mark: '🐘', c: '#336791',
      what: 'Checkpoints in Postgres. The production default, and usually a database you already run.',
      pro: ['Durable across restarts, deploys and workers', 'Backups, replication and point-in-time recovery you already have', 'Query the checkpoint table directly when debugging'],
      con: ['Checkpoint rows grow and need a retention policy', 'Adds write load per node, not per run'],
      use: 'The default for anything with users. Start here.' },
    { n: 'RedisSaver', by: 'LangGraph', mark: '⚡', c: '#dc382d',
      what: 'Checkpoints in Redis, with TTLs so abandoned threads expire on their own.',
      pro: ['Fastest checkpoint writes', 'TTL gives automatic cleanup of dead threads', 'Often already deployed for sessions'],
      con: ['Durability depends on how you configured persistence', 'RAM cost makes long histories expensive'],
      use: 'High-throughput agents with short-lived threads, where speed beats permanence.' },
    { n: 'SqliteSaver', by: 'LangGraph', mark: 'db', c: '#22d3ee',
      what: 'A single file on disk. Durable, zero-configuration, single-machine.',
      pro: ['Durable with literally no server', 'Perfect for a CLI tool or a desktop agent', 'The file is the whole backup'],
      con: ['One machine only; write contention under concurrency', 'Not a path to horizontal scale'],
      use: 'Local agents, single-user tools and demos that must survive a restart.' },
    { n: 'Temporal', by: 'Temporal', mark: '⏱', c: '#f472b6',
      what: 'The heavier alternative: durable execution outside the graph, for processes spanning days.',
      pro: ['Survives far more than a process crash', 'Workflows can sleep for weeks awaiting a signal', 'Retries and timeouts per activity'],
      con: ['A cluster to run or a cloud bill', 'Deterministic-workflow discipline is a real curve'],
      use: 'The process outlives the request by days, not seconds.' }
  ]
};

/* ---------- Ch: interrupts & HITL ---------- */
C.toolstrips.hitl = {
  title: 'Tools & frameworks — human in the loop',
  sub: 'An approval gate is only real if it lives outside the model. These are the four places to put one, in order of how much they hold.',
  tools: [
    { n: 'interrupt()', by: 'LangGraph', mark: '⏸', c: '#1c3c3c',
      what: 'Pause the graph mid-run, surface the proposed action, and resume from the checkpoint when a human answers.',
      pro: ['Deterministic — the tool cannot fire before approval', 'Resumes without repeating completed work', 'The human can edit the proposed arguments, not just approve'],
      con: ['Requires a durable checkpointer to be worth anything', 'You still build the UI that shows the request'],
      use: 'Every irreversible action. This is the mechanism, not a nice-to-have.' },
    { n: 'A policy function', by: 'your own code', mark: '{}', c: '#34d399',
      what: 'A plain function that decides auto / ask / block from the arguments, before anything executes.',
      pro: ['Deterministic and unit-testable', 'Costs nothing and adds no latency', 'Auto-approves the boring 95% so humans see only what matters'],
      con: ['You must enumerate the rules', 'Says nothing about content quality'],
      use: 'In front of every tool that spends money, sends a message or changes data.' },
    { n: 'Slack / email approvals', by: 'your own integration', mark: '💬', c: '#4a154b',
      what: 'The interrupt surfaces where the approver already is, with approve and reject buttons.',
      pro: ['Approvals actually happen instead of queueing in a dashboard nobody opens', 'Threads give a natural audit trail', 'No new tool for the approver to learn'],
      con: ['Message text is untrusted input if the agent reads replies', 'Needs an expiry path when nobody answers'],
      use: 'Approvals by people who do not live in your admin panel.' },
    { n: 'LangSmith', by: 'LangChain', mark: 'ls', c: '#1c3c3c',
      what: 'Shows exactly what state the graph paused in, and what the human decided afterwards.',
      pro: ['Post-incident review of a specific approval decision', 'Annotation queues turn decisions into labelled data', 'Step-level view of the interrupted run'],
      con: ['Hosted by default', 'Observability, not enforcement'],
      use: 'Proving afterwards who approved what and on what evidence.' },
    { n: 'Idempotency keys', by: 'your own code', mark: '🔑', c: '#fbbf24',
      what: 'A stable key per intended side effect, so a resumed or retried run cannot execute it twice.',
      pro: ['Makes resume-after-crash safe rather than dangerous', 'A ledger of what already happened doubles as an audit log', 'Standard practice from payments, not invented for agents'],
      con: ['Key derivation must be stable across retries', 'The downstream system must honour it'],
      use: 'Any tool with a side effect that runs inside a resumable graph.' }
  ]
};

/* ---------- Ch: long-term memory ---------- */
C.toolstrips.memory = {
  title: 'Tools & frameworks — long-term memory',
  sub: 'Checkpointers handle this thread. Anything that must survive across threads is a different problem with different answers.',
  tools: [
    { n: 'LangGraph Store', by: 'LangChain', mark: '🗄', c: '#1c3c3c',
      what: 'A namespaced cross-thread key-value store with semantic search over what it holds.',
      pro: ['No extra service; same deployment as the checkpointer', 'Namespaces such as (user_id, category) give isolation for free', 'Semantic search, so recall is by meaning not exact key'],
      con: ['Storage, not curation — extraction and decay are your code', 'No conflict resolution when a fact changes'],
      use: 'You want cross-session memory without another dependency.' },
    { n: 'Mem0', by: 'Mem0', mark: '🧷', c: '#a78bfa',
      what: 'Extracts facts, then decides ADD, UPDATE, DELETE or NOOP against what is already known.',
      pro: ['Conflict resolution is the actual product', 'Vector, graph and key-value storage together', 'Scoped by user, agent and session'],
      con: ['Every extraction is an LLM call', 'A wrong extraction becomes a durable wrong belief'],
      use: 'Preferences and history that must survive across weeks of sessions.' },
    { n: 'Zep', by: 'Zep', mark: '⏳', c: '#22d3ee',
      what: 'A temporal knowledge graph: facts carry validity intervals, so the system knows when one stopped being true.',
      pro: ['Superseded facts are invalidated, not deleted, so history is auditable', 'Fuses semantic, keyword and graph retrieval', 'Reconstruct what the agent believed at any past moment'],
      con: ['A graph is more moving parts than a table', 'Needs a genuine temporal requirement'],
      use: 'Facts change over time and a decision must be explainable months later.' },
    { n: 'pgvector', by: 'PostgreSQL community', mark: '🐘', c: '#336791',
      what: 'Facts in a table with an embedding column: retrieve by meaning, delete by user with one statement.',
      pro: ['One system to secure, back up and delete from', 'A deletion request is a DELETE, not an integration project', 'Joins between memories and business data'],
      con: ['You write extraction, dedup and decay yourself', 'No conflict resolution out of the box'],
      use: 'The honest default before a memory service earns its place.' }
  ]
};

/* ---------- Ch: ship it ---------- */
C.toolstrips.ship = {
  title: 'Tools & frameworks — running a graph in production',
  sub: 'A graph run is slow, stateful and resumable. That combination is exactly what a plain request/response service handles badly.',
  tools: [
    { n: 'FastAPI', by: 'Sebastián Ramírez', mark: '🚪', c: '#009688',
      what: 'The async service around the graph: start a run, stream its events, resume it after an approval.',
      pro: ['astream_events maps straight onto Server-Sent Events', 'Return a thread ID rather than holding a 40-second connection', 'Depends() for auth and per-user rate limits'],
      con: ['A blocking call stalls the event loop', 'Resume endpoints need careful auth — a thread ID is not a permission'],
      use: 'Any graph other software or a browser will drive.' },
    { n: 'LangGraph Platform', by: 'LangChain', mark: 'lg', c: '#1c3c3c',
      what: 'Managed hosting for graphs: persistence, task queue, streaming and a cron scheduler, without you building them.',
      pro: ['Threads, runs and resume are HTTP endpoints already', 'Handles queueing for long runs', 'Studio gives a visual debugger over real runs'],
      con: ['A vendor in the request path', 'Less control than your own service'],
      use: 'You want the graph in production without building the surrounding service.' },
    { n: 'LangSmith', by: 'LangChain', mark: 'ls', c: '#1c3c3c',
      what: 'Node-level tracing, so you see which node produced which state transition and what it cost.',
      pro: ['Auto-instruments graphs with two environment variables', 'Time travel plus traces makes post-incident review possible', 'Turn real runs into a regression dataset'],
      con: ['Hosted by default', 'Ecosystem gravity'],
      use: 'Before real users. Debugging a graph without node-level traces is guesswork.' },
    { n: 'Postgres', by: 'PostgreSQL', mark: '🐘', c: '#336791',
      what: 'One database holding checkpoints, the long-term Store, and your business data.',
      pro: ['One backup and one security boundary', 'Query checkpoints directly when something is stuck', 'Transactional consistency with the rest of the app'],
      con: ['Checkpoint tables grow; set a retention policy on day one', 'Write amplification per node on chatty graphs'],
      use: 'The default persistence layer for everything LangGraph stores.' },
    { n: 'Docker', by: 'Docker', mark: '🐳', c: '#2496ed',
      what: 'One image with the graph, its dependencies and its migrations, deployed the same way everywhere.',
      pro: ['Same image in CI and production', 'Checkpointer schema migrations ship with the code', 'Rolling deploys work because state is external'],
      con: ['Images get large', 'Graceful shutdown must be configured or a run dies mid-node'],
      use: 'Anything leaving your laptop.' }
  ]
};
