/* ============================================================
   content.js — every piece of course content lives here.
   Edit this file to change the course; demos.js only renders it.
   ============================================================ */
window.C = {};

/* ---------- Ch1: is this a job for an agent? ---------- */
C.agencyTasks = [
  { t: 'Translate this paragraph into Spanish.',
    a: 'prompt',
    why: 'One input, one output, no external facts, no decisions. A single call. Reaching for an agent here adds latency, cost and new failure modes for nothing.' },
  { t: 'Summarise a PDF, then email the summary to my manager.',
    a: 'chain',
    why: 'Two steps, but *you* already know the order and it never changes. A fixed chain (summarise → send) is cheaper and far more reliable than letting a model rediscover the plan every run.' },
  { t: 'Find out why last night\'s deploy failed and open a ticket with the cause.',
    a: 'agent',
    why: 'Nobody can write the steps in advance — which log, which commit, which service depends on what it finds. The control flow depends on intermediate results. That is the definition of an agent.' },
  { t: 'Classify 40,000 support tickets by topic.',
    a: 'prompt',
    why: 'Same operation 40,000 times. A prompt in a for-loop. An agent would multiply your bill by 20 and your error rate by 5.' },
  { t: 'Answer questions about our internal handbook.',
    a: 'chain',
    why: 'Retrieve → stuff into prompt → answer. Fixed pipeline: this is RAG, not agency. Add agency only when the retrieval itself needs several adaptive hops.' },
  { t: 'Research three competitors and produce a comparison memo with sources.',
    a: 'agent',
    why: 'Open-ended search, unknown number of pages, the model must decide when it knows enough. Loop with tools and a stopping condition.' }
];
C.agencyLabels = {
  prompt: { name: 'Single prompt', ico: '💬', hint: 'one call, no tools' },
  chain:  { name: 'Fixed chain',  ico: '⛓️', hint: 'known steps, no branching by the model' },
  agent:  { name: 'Agent',        ico: '🤖', hint: 'model chooses the next step' }
};

/* ---------- Ch2: the agent loop ---------- */
C.loopTasks = [
  {
    label: 'Is our checkout API slower this week than last week?',
    steps: [
      { k: 'think',   t: 'I need latency numbers for two windows. I have a metrics tool. Start with this week.' },
      { k: 'act',     t: 'metrics.p95(service="checkout", from="-7d", to="now")' },
      { k: 'observe', t: '{"p95_ms": 812, "samples": 44210}' },
      { k: 'think',   t: '812ms. Now the same window a week earlier so the comparison is like-for-like.' },
      { k: 'act',     t: 'metrics.p95(service="checkout", from="-14d", to="-7d")' },
      { k: 'observe', t: '{"p95_ms": 430, "samples": 41880}' },
      { k: 'think',   t: 'Nearly 2x slower. Before reporting, check whether traffic changed — a spike would explain it innocently.' },
      { k: 'act',     t: 'metrics.rps(service="checkout", from="-14d", to="now", bucket="1d")' },
      { k: 'observe', t: '[71,69,73,70,72,74,70,71,69,72,70,73,71,70]' },
      { k: 'think',   t: 'Traffic is flat, so this is a regression, not load. I have enough to answer.' },
      { k: 'final',   t: 'Yes — checkout p95 went from 430ms to 812ms (+89%) week over week, with request volume flat at ~71 rps. Load is not the cause; something shipped. Next step: diff deploys in that window.' }
    ]
  },
  {
    label: 'Book me a meeting room for the Thursday design review.',
    steps: [
      { k: 'think',   t: 'I need the meeting time before I can find a room. Look up the calendar event.' },
      { k: 'act',     t: 'calendar.find(query="design review", window="this week")' },
      { k: 'observe', t: '{"title":"Design review","start":"Thu 14:00","end":"Thu 15:30","attendees":9}' },
      { k: 'think',   t: 'Nine people, 90 minutes. Search rooms that seat 9+ in that slot.' },
      { k: 'act',     t: 'rooms.search(capacity=9, start="Thu 14:00", end="Thu 15:30")' },
      { k: 'observe', t: '[{"room":"Fern","cap":10,"floor":3},{"room":"Basalt","cap":16,"floor":1}]' },
      { k: 'think',   t: 'Fern fits with the least waste. Booking is a write — this is where a human gate belongs, but policy says rooms are auto-approved.' },
      { k: 'act',     t: 'rooms.book(room="Fern", start="Thu 14:00", end="Thu 15:30")' },
      { k: 'observe', t: '{"ok": true, "confirmation": "RB-2291"}' },
      { k: 'final',   t: 'Booked Fern (capacity 10, floor 3) for Thursday 14:00–15:30, confirmation RB-2291. Basalt was the only alternative and seats 16 — oversized for 9.' }
    ]
  },
  {
    label: 'A task that goes wrong (and recovers)',
    steps: [
      { k: 'think',   t: 'The user wants revenue for "last quarter". I will assume calendar Q, query the warehouse.' },
      { k: 'act',     t: 'sql.run("SELECT sum(amount) FROM orders WHERE quarter = \'Q2\'")' },
      { k: 'observe', t: 'ERROR: column "quarter" does not exist' },
      { k: 'think',   t: 'Bad guess at the schema. Do not retry blindly — inspect the table first.' },
      { k: 'act',     t: 'sql.schema("orders")' },
      { k: 'observe', t: 'orders(id, created_at TIMESTAMP, amount NUMERIC, status TEXT)' },
      { k: 'think',   t: 'No quarter column; derive it from created_at. Also exclude refunded rows or the number is wrong.' },
      { k: 'act',     t: 'sql.run("SELECT sum(amount) FROM orders WHERE created_at >= \'2025-04-01\' AND created_at < \'2025-07-01\' AND status != \'refunded\'")' },
      { k: 'observe', t: '{"sum": 1284300.55}' },
      { k: 'final',   t: 'Q2 revenue (Apr 1 – Jun 30, refunds excluded): $1,284,300.55. Note: the orders table has no quarter column, so I derived the window from created_at.' }
    ]
  }
];
C.loopKinds = {
  think:   { name: 'Think',   ico: '🧠', color: '#7c5cff', desc: 'The model reasons about what it still needs.' },
  act:     { name: 'Act',     ico: '🔧', color: '#fbbf24', desc: 'It emits a tool call — structured, not prose.' },
  observe: { name: 'Observe', ico: '👁️', color: '#22d3ee', desc: 'Your code runs the tool and feeds the result back.' },
  final:   { name: 'Answer',  ico: '✅', color: '#34d399', desc: 'Stopping condition met — the loop exits.' }
};

/* ---------- Ch3: tools ---------- */
C.tools = [
  { id: 'search',   name: 'web_search',      ico: '🔍', risk: 'read',
    desc: 'Search the public web and return snippets.',
    schema: '{ "query": string, "top_k": integer = 5 }' },
  { id: 'calc',     name: 'calculator',      ico: '🧮', risk: 'read',
    desc: 'Evaluate an arithmetic expression exactly.',
    schema: '{ "expression": string }' },
  { id: 'sql',      name: 'sql_query',       ico: '🗄️', risk: 'read',
    desc: 'Run a READ-ONLY SQL query against the warehouse.',
    schema: '{ "sql": string }' },
  { id: 'email',    name: 'send_email',      ico: '✉️', risk: 'write',
    desc: 'Send an email. Irreversible once sent.',
    schema: '{ "to": string, "subject": string, "body": string }' },
  { id: 'refund',   name: 'issue_refund',    ico: '💸', risk: 'danger',
    desc: 'Move real money back to a customer.',
    schema: '{ "order_id": string, "amount_cents": integer, "reason": string }' }
];
C.toolQueries = [
  { q: 'What is 17.5% of 84,200?',
    pick: 'calc', args: '{ "expression": "84200 * 0.175" }',
    note: 'Arithmetic is exactly where models slip. Hand it to a tool that cannot be wrong.' },
  { q: 'How many orders did we ship yesterday?',
    pick: 'sql', args: '{ "sql": "SELECT count(*) FROM orders WHERE shipped_at::date = current_date - 1" }',
    note: 'Private, current data. Not in the weights — must come from a tool.' },
  { q: 'Who won the F1 race last weekend?',
    pick: 'search', args: '{ "query": "F1 race winner last weekend", "top_k": 5 }',
    note: 'Public but newer than training. Search, then cite.' },
  { q: 'Refund order #A-4471, the customer got a broken screen.',
    pick: 'refund', args: '{ "order_id": "A-4471", "amount_cents": 24900, "reason": "damaged on arrival" }',
    note: 'The model can *propose* this, but real money should never move without a policy check or a human. See Chapter 9.' },
  { q: 'Explain what a p95 latency is.',
    pick: null, args: null,
    note: 'No tool needed. A good agent answers from its own knowledge instead of calling something to look busy — tool-happy agents are slow and expensive.' }
];

/* ---------- Ch4: ReAct ---------- */
C.reactTask = 'Which of our two warehouses should absorb the extra Black Friday volume?';
C.reactRuns = {
  naive: {
    label: 'Answer straight away',
    badge: 'no reasoning, no tools',
    steps: [
      { role: 'model', t: 'Use the Rotterdam warehouse — it is larger and closer to your main customer base.' }
    ],
    verdict: 'bad',
    note: 'Fluent, confident, ungrounded. It never looked at capacity, current utilisation or where the orders actually ship to. This is the failure mode that gets agents banned from production.'
  },
  cot: {
    label: 'Think step by step',
    badge: 'reasoning, still no tools',
    steps: [
      { role: 'think', t: 'Extra volume should go where there is spare capacity and short shipping distance.' },
      { role: 'think', t: 'Rotterdam is typically the bigger European hub, so it likely has more headroom.' },
      { role: 'model', t: 'Rotterdam — bigger hub, therefore more spare capacity.' }
    ],
    verdict: 'meh',
    note: 'Better structured, equally ungrounded. Reasoning without facts just produces a more persuasive guess. "Typically" and "likely" are the tell.'
  },
  react: {
    label: 'ReAct: reason + act',
    badge: 'reasoning interleaved with tools',
    steps: [
      { role: 'think',   t: 'I need current utilisation per warehouse, not assumptions. Query it.' },
      { role: 'act',     t: 'wms.utilisation(sites=["rotterdam","lodz"])' },
      { role: 'observe', t: '{"rotterdam": 0.93, "lodz": 0.61}' },
      { role: 'think',   t: 'Rotterdam is at 93% — nearly full, the opposite of my prior. Łódź has real headroom. But headroom is useless if it is far from the demand.' },
      { role: 'act',     t: 'orders.destination_mix(window="black_friday_last_year")' },
      { role: 'observe', t: '{"DE": 0.34, "PL": 0.22, "NL": 0.18, "CZ": 0.11, "other": 0.15}' },
      { role: 'think',   t: 'DE+PL+CZ = 67% of volume, all closer to Łódź. Capacity and distance point the same way.' },
      { role: 'model',   t: 'Łódź. Rotterdam is already at 93% utilisation while Łódź sits at 61%, and 67% of last year\'s Black Friday orders shipped to DE/PL/CZ — closer to Łódź. Rotterdam would tip over; Łódź absorbs it and shortens the average leg.' }
    ],
    verdict: 'good',
    note: 'The first observation *reversed* the model\'s prior. That is the whole point: reasoning proposes, observation disposes. Notice it also stopped once two independent signals agreed — a stopping condition, not an endless loop.'
  }
};

/* ---------- Ch5: planning ---------- */
C.planGoals = [
  {
    goal: 'Onboard a new enterprise customer end to end',
    plan: [
      { t: 'Create the tenant and provision the environment', dep: [] },
      { t: 'Import their user list from the CSV they sent',   dep: [0] },
      { t: 'Configure SSO against their identity provider',    dep: [0] },
      { t: 'Run a smoke test as three of their users',          dep: [1, 2] },
      { t: 'Send the welcome pack and book the kickoff call',   dep: [3] }
    ],
    note: 'Steps 2 and 3 have no dependency on each other — a planner that notices this runs them in parallel and halves the wall clock.'
  },
  {
    goal: 'Publish a benchmark comparing three vector databases',
    plan: [
      { t: 'Define the dataset, query set and metrics', dep: [] },
      { t: 'Stand up database A and load the data',     dep: [0] },
      { t: 'Stand up database B and load the data',     dep: [0] },
      { t: 'Stand up database C and load the data',     dep: [0] },
      { t: 'Run the identical query set against all three', dep: [1, 2, 3] },
      { t: 'Write up results with methodology and caveats', dep: [4] }
    ],
    note: 'Three independent branches fan out from one setup step, then re-join. This shape — fan-out, barrier, synthesise — is most of what multi-step agents actually do.'
  },
  {
    goal: 'Fix the failing nightly test suite',
    plan: [
      { t: 'Read the CI log and identify which tests fail', dep: [] },
      { t: 'Reproduce one failure locally',                 dep: [0] },
      { t: 'Find the commit that introduced it (bisect)',   dep: [1] },
      { t: 'Write the fix',                                 dep: [2] },
      { t: 'Re-run the full suite',                         dep: [3] }
    ],
    note: 'A strictly linear chain — every step needs the last one\'s output. Here a plan buys you very little; ReAct is the better fit because step 3 might reveal the fix belongs somewhere else entirely.'
  }
];
C.planStyles = [
  { k: 'react', name: 'ReAct (decide as you go)', ico: '🔁',
    pros: ['Adapts the moment reality contradicts the plan', 'No wasted planning on tasks that end early', 'Simple to implement'],
    cons: ['Can wander or loop', 'Hard to parallelise — it only knows the next step', 'Cost grows with the whole transcript resent every turn'],
    use: 'Short, exploratory, unpredictable tasks. Debugging. Research where you cannot know the shape up front.' },
  { k: 'plan', name: 'Plan-and-execute', ico: '🗺️',
    pros: ['The plan is visible and reviewable before anything runs', 'Independent steps run in parallel', 'Cheaper: the executor gets one small step, not the whole history'],
    cons: ['A plan built on wrong assumptions executes confidently into a wall', 'Needs a re-plan trigger when a step fails', 'Overkill for two-step jobs'],
    use: 'Long tasks with a knowable shape, work that needs human sign-off before it runs, anything you want to parallelise.' }
];

/* ---------- Ch6: memory ---------- */
C.memKinds = [
  { k: 'working',  name: 'Working memory', ico: '📋', color: '#22d3ee',
    span: 'this run only',
    desc: 'The live transcript — the prompt, every tool call and every observation so far. Vanishes when the run ends.',
    watch: 'It is also your bill and your latency. Long runs re-send everything on every turn.' },
  { k: 'episodic', name: 'Episodic memory', ico: '📔', color: '#7c5cff',
    span: 'across runs, per user',
    desc: 'What happened before: past conversations, past tasks, what the user asked for last Tuesday.',
    watch: 'Retrieve it, do not paste all of it. Episodic memory that grows unbounded quietly eats the whole context window.' },
  { k: 'semantic', name: 'Semantic memory', ico: '📚', color: '#34d399',
    span: 'shared, long-lived',
    desc: 'Facts and documents the agent can look up: your handbook, product catalogue, API docs. Usually a vector store — this is RAG.',
    watch: 'Stale documents are indistinguishable from correct ones to the model. Version and date your sources.' },
  { k: 'procedural', name: 'Procedural memory', ico: '🧭', color: '#fbbf24',
    span: 'permanent, curated',
    desc: 'How to behave: the system prompt, tool descriptions, learned playbooks and rules of thumb.',
    watch: 'This is the one you edit by hand. "The agent keeps doing X" is nearly always a procedural-memory bug.' }
];
C.memConvo = [
  { who: 'user',  t: 'Hi — I\'m Priya, I run infra at Northwind.', store: ['working', 'episodic'],
    fact: 'user = Priya, role = infra lead, company = Northwind' },
  { who: 'user',  t: 'Always give me answers in metric units, I never want Fahrenheit.', store: ['episodic', 'procedural'],
    fact: 'preference: metric units, standing instruction' },
  { who: 'agent', t: 'Looking up your current cluster config…', store: ['working'], fact: '' },
  { who: 'tool',  t: 'k8s.describe(cluster="northwind-prod") → 42 nodes, v1.29', store: ['working'],
    fact: 'transient observation — no reason to persist it, it changes hourly' },
  { who: 'user',  t: 'What\'s our upgrade policy for minor versions?', store: ['working', 'semantic'],
    fact: 'answer must come from the handbook — retrieve, do not guess' },
  { who: 'user',  t: 'Remind me next month to redo the capacity review.', store: ['episodic'],
    fact: 'commitment with a date — worthless unless it survives this session' }
];
C.memQuestions = [
  { q: 'Three weeks later, the user asks "what temperature should I set?" and gets an answer in °C.', a: 'episodic',
    e: 'The unit preference was captured once and retrieved later. Working memory was gone; only a persisted store could carry it.' },
  { q: 'The agent quotes the exact upgrade-window wording from your ops handbook.', a: 'semantic',
    e: 'Retrieved from the document store at query time. This is RAG doing memory\'s job.' },
  { q: 'Mid-run, the agent refers back to the node count it fetched two steps ago.', a: 'working',
    e: 'Still in the transcript. No storage needed — and none warranted, since it goes stale in minutes.' },
  { q: 'The agent always asks for confirmation before touching production.', a: 'procedural',
    e: 'That is a rule in the system prompt, not something it learned about you.' }
];

/* ---------- Ch7: reflection ---------- */
C.reflectTask = 'Write the incident summary for last night\'s checkout outage.';
C.reflectRounds = [
  { n: 0, score: 42, label: 'First draft',
    draft: 'There was an outage on the checkout service last night. The team investigated and it is now resolved. We apologise for the inconvenience and are taking steps to prevent this in future.',
    critique: null },
  { n: 1, score: 66, label: 'After critique 1',
    critique: [
      'No times. "Last night" is useless to anyone reading this next quarter.',
      'No impact figure — how many users, how much revenue?',
      'No cause. "The team investigated" says nothing.',
      '"Taking steps" is a non-commitment with no owner and no date.'
    ],
    draft: 'Between 22:14 and 23:02 UTC on 4 March, checkout returned 5xx for roughly 38% of requests. The cause was a database connection-pool exhaustion after the 22:10 deploy. We rolled back at 22:58 and errors cleared by 23:02. We are raising the pool ceiling and adding an alert.' },
  { n: 2, score: 88, label: 'After critique 2',
    critique: [
      'Impact is in requests; the reader cares about orders and money.',
      'Says *what* exhausted the pool but not *why the deploy did it*.',
      'Remediations still have no owner and no date.',
      'No detection time — 48 minutes is a long outage; how much of that was noticing?'
    ],
    draft: 'Between 22:14 and 23:02 UTC on 4 March (48 min), checkout returned 5xx for ~38% of requests: 1,940 failed orders, est. €71k deferred revenue. Detection took 9 minutes (alert fired 22:23) — the remaining 39 was diagnosis.\n\nCause: deploy 4.2.1 at 22:10 added a per-request retry to the payment client without raising the DB connection pool (max 20). Under normal traffic the retries tripled checkout\'s connection demand and exhausted the pool.\n\nActions: (1) pool ceiling 20→80, shipped 5 Mar — R. Okafor. (2) Saturation alert at 70% pool use, due 8 Mar — R. Okafor. (3) Load test in CI for any change to the payment client, due 15 Mar — team.' },
  { n: 3, score: 91, label: 'After critique 3',
    critique: [
      'Genuinely marginal now — wording nits, no substance missing.',
      'Diminishing returns: round 3 changed 4% of the text and cost another full model call.'
    ],
    draft: 'Between 22:14 and 23:02 UTC on 4 March (48 min), checkout returned 5xx for ~38% of requests: 1,940 failed orders, est. €71k deferred revenue. Detection took 9 minutes (alert fired 22:23); the remaining 39 were diagnosis and rollback.\n\nCause: deploy 4.2.1 (22:10) added a per-request retry to the payment client without raising the DB connection pool (max 20). Under normal traffic the retries roughly tripled checkout\'s connection demand and exhausted the pool.\n\nActions: (1) pool ceiling 20→80, shipped 5 Mar — R. Okafor. (2) Saturation alert at 70% pool use, due 8 Mar — R. Okafor. (3) Payment-client changes gated on a CI load test, due 15 Mar — team.' }
];

/* ---------- Ch8: multi-agent ---------- */
C.topologies = [
  { k: 'single', name: 'One agent, many tools', ico: '🤖',
    nodes: [{ id: 'A', label: 'Agent', x: 50, y: 50 }],
    tools: 6,
    calls: 9, latency: 22, cost: 1.0, reliability: 0.72,
    good: 'Simplest thing that works. One prompt to debug, one transcript to read, no coordination bugs.',
    bad: 'Above roughly a dozen tools the model starts picking wrong ones, and one giant system prompt becomes unmaintainable.',
    use: 'Start here. Always. Split only when you can name the specific thing that broke.' },
  { k: 'supervisor', name: 'Supervisor + specialists', ico: '🎩',
    nodes: [
      { id: 'S', label: 'Supervisor', x: 50, y: 20 },
      { id: 'R', label: 'Researcher', x: 18, y: 78 },
      { id: 'C', label: 'Coder', x: 50, y: 78 },
      { id: 'W', label: 'Writer', x: 82, y: 78 }
    ],
    edges: [['S', 'R'], ['S', 'C'], ['S', 'W']],
    calls: 16, latency: 31, cost: 2.1, reliability: 0.79,
    good: 'Each specialist gets a short, focused prompt and only its own tools. The supervisor holds the plan; workers stay dumb and reliable.',
    bad: 'The supervisor becomes a bottleneck and a single point of failure, and every hand-off loses context that was obvious in the original request.',
    use: 'When one agent\'s tool list or system prompt has clearly outgrown itself, and the sub-jobs are genuinely different skills.' },
  { k: 'pipeline', name: 'Pipeline (fixed hand-off)', ico: '➡️',
    nodes: [
      { id: 'P1', label: 'Extract', x: 15, y: 50 },
      { id: 'P2', label: 'Analyse', x: 50, y: 50 },
      { id: 'P3', label: 'Report', x: 85, y: 50 }
    ],
    edges: [['P1', 'P2'], ['P2', 'P3']],
    calls: 6, latency: 14, cost: 0.8, reliability: 0.88,
    good: 'Most reliable and cheapest of the four, because the control flow is yours, not the model\'s. Each stage is independently testable.',
    bad: 'Zero adaptivity. If stage 2 discovers stage 1 grabbed the wrong document, nothing can go back.',
    use: 'Whenever the sequence really is fixed. A surprising share of "agent" projects are this wearing a costume.' },
  { k: 'swarm', name: 'Peer swarm / debate', ico: '🐝',
    nodes: [
      { id: 'A1', label: 'Agent 1', x: 50, y: 16 },
      { id: 'A2', label: 'Agent 2', x: 86, y: 68 },
      { id: 'A3', label: 'Agent 3', x: 14, y: 68 }
    ],
    edges: [['A1', 'A2'], ['A2', 'A3'], ['A3', 'A1'], ['A2', 'A1'], ['A3', 'A2'], ['A1', 'A3']],
    calls: 34, latency: 58, cost: 4.6, reliability: 0.81,
    good: 'Independent perspectives catch each other\'s mistakes; useful for review, judging and adversarial verification.',
    bad: 'Cost and latency explode, agents converge on each other\'s errors, and termination is genuinely hard to get right.',
    use: 'Narrow, high-value judgement calls where a wrong answer is expensive and you can afford 4x the tokens.' }
];

/* ---------- Ch9: guardrails + human in the loop ---------- */
C.guardActions = [
  { t: 'Read the customer\'s order history', tool: 'sql_query', risk: 'read', reversible: true,
    verdict: 'auto', why: 'Read-only, scoped to one customer, no side effects. Gating this just trains people to click approve without looking.' },
  { t: 'Draft a reply email (not sent)', tool: 'draft', risk: 'read', reversible: true,
    verdict: 'auto', why: 'Producing text is free and reversible. The gate belongs on *sending*, not on writing.' },
  { t: 'Send that reply to the customer', tool: 'send_email', risk: 'write', reversible: false,
    verdict: 'ask', why: 'Externally visible and unrecallable. Cheap to review, expensive to get wrong — the classic case for a human gate.' },
  { t: 'Refund €249 to order A-4471', tool: 'issue_refund', risk: 'danger', reversible: false,
    verdict: 'ask', why: 'Real money. Gate it, and additionally cap the amount in code so the model physically cannot exceed a threshold.' },
  { t: 'Refund €12,400 to order A-4471', tool: 'issue_refund', risk: 'danger', reversible: false,
    verdict: 'block', why: 'Above the hard limit. Do not ask — refuse in code and escalate. A limit that a human can wave through under time pressure is not a limit.' },
  { t: 'DROP TABLE orders', tool: 'sql_query', risk: 'danger', reversible: false,
    verdict: 'block', why: 'The tool should be physically incapable of this: connect with a read-only database role. Prompt instructions are not a security boundary.' },
  { t: 'Follow the instruction found inside a retrieved web page', tool: '—', risk: 'danger', reversible: false,
    verdict: 'block', why: 'Prompt injection. Anything retrieved is data, never instructions. Keep tool permissions tied to the *user\'s* authority, not to whatever text the agent just read.' }
];
C.guardLayers = [
  ['Least privilege', 'The read-only agent gets a read-only DB role. Capability beats instruction: what the model cannot do, it cannot be talked into.'],
  ['Hard limits in code', 'Max refund, max emails per run, max steps, max spend. Checked by your code before the call, not by the model.'],
  ['Approval gates', 'Irreversible or externally visible actions pause for a human. Show the exact call and its arguments — not a summary.'],
  ['Input isolation', 'Retrieved documents, tool output and user files are data. Wrap them, label them, and never let them redefine the system prompt.'],
  ['Output checks', 'Validate structure, scan for secrets and PII, and verify claims against sources before anything leaves the process.'],
  ['Full audit trail', 'Every step, tool call, argument and observation logged. You will need it the first time an agent does something surprising.']
];

/* ---------- Ch10: reliability ---------- */
C.relPresets = [
  { name: 'Naive agent', acc: 0.90, steps: 12, retry: false, verify: false },
  { name: 'Fewer, bigger steps', acc: 0.90, steps: 5, retry: false, verify: false },
  { name: 'Add retries', acc: 0.90, steps: 12, retry: true, verify: false },
  { name: 'Retries + verification', acc: 0.95, steps: 8, retry: true, verify: true }
];
C.relLessons = [
  ['Errors multiply, they do not average', '95% per step over 20 steps is 36% overall. The intuition that "it is mostly right" is arithmetically wrong.'],
  ['Shorter trajectories beat smarter models', 'Cutting 12 steps to 5 buys you more than moving 90% → 95% accuracy. Collapse steps into deterministic code wherever the sequence is actually fixed.'],
  ['Retries only help independent failures', 'A retry rescues a flaky API. It does nothing for a bad plan — the model will confidently make the same wrong call again.'],
  ['Verify cheaply, verify often', 'A schema check, a range check or a second model glancing at the output turns a silent wrong answer into a caught one.'],
  ['Always cap the loop', 'Max steps, max wall-clock, max spend. Without them, one confused agent can spend your monthly budget overnight.']
];

/* ---------- Ch11: evals ---------- */
C.evalRuns = [
  { id: 'run-118', task: 'Find the customer\'s last order and tell them its status.',
    outcome: 'pass', trajectory: 'pass', steps: 3, cost: '$0.04',
    trace: ['sql: lookup customer by email', 'sql: last order for customer 8812', 'answer: "Order A-9931, shipped 12 Mar, arriving Thursday."'],
    note: 'Right answer, minimal path. This is the boring success you want most runs to look like.' },
  { id: 'run-119', task: 'Find the customer\'s last order and tell them its status.',
    outcome: 'pass', trajectory: 'fail', steps: 11, cost: '$0.31',
    trace: ['web_search: "customer order status"', 'web_search: "how to find last order"', 'sql: SELECT * FROM orders (no filter)', 'sql: SELECT * FROM orders LIMIT 1000', '…6 more flailing steps…', 'answer: "Order A-9931, shipped 12 Mar, arriving Thursday."'],
    note: 'Correct answer, terrible path: 8x the cost, a full table scan, and a web search for something in your own database. Outcome-only evals score this identical to run-118 — which is exactly how these bills sneak up on people.' },
  { id: 'run-120', task: 'Refund the damaged item on order A-4471.',
    outcome: 'fail', trajectory: 'pass', steps: 4, cost: '$0.06',
    trace: ['sql: order A-4471', 'sql: line items', 'issue_refund(amount_cents=24900)', 'answer: "Refunded €249."'],
    note: 'Sensible path, wrong result: it refunded the whole order instead of the one damaged line item. Trajectory evals miss this. You need both.' },
  { id: 'run-121', task: 'What is our refund policy for opened software?',
    outcome: 'fail', trajectory: 'fail', steps: 1, cost: '$0.01',
    trace: ['answer: "Opened software is generally non-refundable in most jurisdictions."'],
    note: 'Answered from priors instead of retrieving the actual policy. Fast, cheap, confident, wrong — and no tool call in the trace makes it trivial to detect automatically.' }
];
C.evalMetrics = [
  ['Task success', 'Did the final output satisfy the request? Graded against a golden set, by exact match, by rubric or by an LLM judge.'],
  ['Trajectory quality', 'Did it take a sane path? Steps, tool choice, redundant calls, dead ends. Cheap proxy: step count and cost per run.'],
  ['Tool-call accuracy', 'Right tool, right arguments. Easy to score mechanically against expected calls, and it catches most regressions first.'],
  ['Cost and latency per run', 'Track p50 and p95, not the mean. The p95 run is the one that times out in front of a customer.'],
  ['Safety violations', 'Blocked actions attempted, injections followed, PII leaked. Should be zero; alert on any non-zero.'],
  ['Human intervention rate', 'How often a person had to step in. The single best signal of whether the thing is actually ready.']
];

/* ---------- Ch12: shipping ---------- */
C.arch = [
  ['User / trigger', 'A chat box, a webhook, a cron, a queue message. Whatever starts a run.'],
  ['Orchestrator', 'Owns the loop: builds the prompt, calls the model, dispatches tools, enforces caps, decides when to stop.'],
  ['Model', 'Stateless. Gets the transcript, returns text or a tool call. Nothing lives here between calls.'],
  ['Tool layer', 'Your functions with validated arguments, timeouts, retries, and permissions tied to the calling user.'],
  ['Memory stores', 'Vector store for documents, a database for episodic facts, config for procedural rules.'],
  ['Guardrails', 'Input isolation, hard limits, approval gates, output validation — around the loop, not inside the prompt.'],
  ['Observability', 'Every step traced. Cost, latency, step count, tool errors, interventions.'],
  ['Eval harness', 'A golden set of runs replayed on every prompt, model or tool change.']
];
C.checklist = [
  'Loop is capped: max steps, max wall-clock, max spend per run',
  'Every tool validates its arguments before doing anything',
  'Irreversible actions pause for a human, showing the exact call',
  'Tool permissions come from the user\'s identity, not the model\'s request',
  'Retrieved and user-supplied text is clearly wrapped as data, never instructions',
  'Every run is traced end to end and stored',
  'A golden set of 30+ real tasks runs on every change',
  'Cost and step count per run are dashboarded, with p95 alerts',
  'There is a kill switch that stops in-flight runs',
  'Failure path is defined: the agent can say "I could not do this"',
  'Prompt, tool schemas and model version are all version-controlled together',
  'Someone owns the on-call rotation for this thing'
];
C.costRows = [
  { k: 'model', label: 'Model calls', note: 'Steps × (transcript in + tokens out). Grows quadratically with steps — turn 10 resends turns 1-9.' },
  { k: 'tools', label: 'Tool calls', note: 'Search APIs, database time, third-party per-call fees.' },
  { k: 'human', label: 'Human review', note: 'The most expensive line by far once approval gates are on. Minimise how often you need it, not how fast people click.' }
];

/* ---------- Ch13: quiz ---------- */
C.quiz = [
  { q: 'What actually distinguishes an agent from a chain?', o: ['The agent uses a bigger model', 'The model decides the control flow at run time', 'The agent has memory', 'The agent runs asynchronously'], a: 1,
    e: 'A chain\'s steps are written by you and fixed. In an agent, what happens next depends on what the model just observed.' },
  { q: 'The three phases of the core agent loop are…', o: ['Prompt, complete, return', 'Think, act, observe', 'Retrieve, augment, generate', 'Plan, approve, execute'], a: 1,
    e: 'Think (reason about what is needed) → Act (emit a tool call) → Observe (feed the result back), repeating until a stopping condition.' },
  { q: 'Who actually executes a tool call?', o: ['The model, inside its weights', 'Your code — the model only emits a structured request', 'The tool provider polls the model', 'The user, manually'], a: 1,
    e: 'The model can only produce text. "Tool use" is it emitting a structured call that your orchestrator runs, then pastes the result back into the transcript.' },
  { q: 'A step in a ReAct trace observes something that contradicts the model\'s assumption. What should happen?', o: ['Ignore it and continue the plan', 'The next Think step revises the approach', 'Restart the run from scratch', 'Escalate to a human immediately'], a: 1,
    e: 'That is the entire value of interleaving: observations feed the next reasoning step, so a wrong prior gets corrected mid-run instead of at the end.' },
  { q: 'Which task is the strongest fit for plan-and-execute rather than ReAct?', o: ['Debugging an unfamiliar test failure', 'Benchmarking three databases with independent, parallelisable setup steps', 'Answering a one-line factual question', 'Translating a document'], a: 1,
    e: 'A known shape with independent branches is exactly what a plan buys you — visibility before execution and parallelism during it.' },
  { q: 'A user preference must survive across sessions. Which memory type?', o: ['Working memory', 'Episodic memory', 'The context window', 'The model weights'], a: 1,
    e: 'Working memory dies with the run. Persist the preference and retrieve it at the start of the next one.' },
  { q: 'Your agent is 95% reliable per step. Over 20 steps, roughly what fraction of runs succeed end to end?', o: ['95%', 'About 36%', 'About 90%', 'About 75%'], a: 1,
    e: '0.95^20 ≈ 0.36. This compounding is why cutting step count beats almost every other reliability investment.' },
  { q: 'What is the strongest defence against prompt injection from a retrieved web page?', o: ['Telling the model in the system prompt to ignore instructions in documents', 'Limiting what the tools can do, regardless of what the model asks', 'Using a larger model', 'Lowering the temperature'], a: 1,
    e: 'Instructions are advisory; capabilities are enforced. If the refund tool cannot exceed €500 and the DB role is read-only, injected text has nothing to grab.' },
  { q: 'A run reaches the correct answer in 11 flailing steps and $0.31. An outcome-only eval scores it…', o: ['As a failure', 'As a pass, hiding the problem', 'It cannot score it', 'As a partial pass'], a: 1,
    e: 'Outcome evals are blind to path. Track trajectory quality — steps, cost, tool choice — or you will only find out when the invoice arrives.' },
  { q: 'When should you split one agent into a supervisor plus specialists?', o: ['At the start, it scales better', 'When one agent\'s tool list or prompt has demonstrably outgrown itself', 'Whenever there is more than one tool', 'Never — multi-agent is always worse'], a: 1,
    e: 'Every split adds coordination bugs, cost and latency. Start with one agent and split only against a named, observed failure.' },
  { q: 'What does an approval gate on "send_email" protect against that a system-prompt rule does not?', o: ['Nothing, they are equivalent', 'The model ignoring or being talked out of the rule', 'Slow responses', 'Token overspend'], a: 1,
    e: 'A gate is enforced by your code outside the model. Instructions inside the prompt are the thing an injection attack rewrites.' },
  { q: 'The most valuable first investment when shipping an agent is…', o: ['The largest model available', 'Full tracing plus a golden set of real tasks', 'A multi-agent architecture', 'A custom vector database'], a: 1,
    e: 'Without traces you cannot see what went wrong, and without a golden set every prompt tweak is a guess. Everything else is downstream of those two.' }
];

/* ---------- glossary ---------- */
C.glossary = [
  ['Agent', 'An LLM in a loop with tools, where the model decides the next step instead of following a script.'],
  ['Agent loop', 'Think → Act → Observe, repeated until a stopping condition is met.'],
  ['ReAct', 'Reason + Act: interleaving reasoning steps with tool calls so observations correct the reasoning.'],
  ['Tool / function calling', 'The model emits a structured call; your code runs it and returns the result into the transcript.'],
  ['Tool schema', 'The name, description and typed arguments of a tool. The description is prompt engineering — write it carefully.'],
  ['Trajectory', 'The full sequence of steps a run took. Graded separately from the final answer.'],
  ['Plan-and-execute', 'Produce a full plan first, then execute steps — often in parallel — with re-planning on failure.'],
  ['Working memory', 'The live transcript for the current run. Disappears when the run ends.'],
  ['Episodic memory', 'Persisted facts about past interactions with a user, retrieved in later runs.'],
  ['Semantic memory', 'A retrievable document/knowledge store. In practice, RAG.'],
  ['Procedural memory', 'Standing rules: the system prompt, tool descriptions, playbooks.'],
  ['Reflection', 'The agent critiques its own output and revises. Gains flatten fast — usually after 2 rounds.'],
  ['Supervisor', 'An agent whose tools are other agents. Holds the plan; delegates the work.'],
  ['Hand-off', 'Passing control and context from one agent to another. Every hand-off loses information.'],
  ['Guardrail', 'A constraint enforced by your code around the loop: limits, gates, validation, isolation.'],
  ['Human in the loop (HITL)', 'A person approves specific actions before they execute.'],
  ['Least privilege', 'Give the agent the minimum capability for the job. What it cannot do, it cannot be tricked into.'],
  ['Prompt injection', 'Untrusted text — a web page, a file, a user message — hijacking the agent\'s instructions.'],
  ['Stopping condition', 'The rule that ends the loop: answer found, step cap, budget cap or wall-clock cap.'],
  ['Step cap', 'A hard maximum number of loop iterations. Non-negotiable in production.'],
  ['Golden set', 'A fixed set of real tasks with known-good outcomes, replayed on every change.'],
  ['LLM-as-judge', 'Using a model to grade another model\'s output or trajectory against a rubric.'],
  ['Trace', 'The recorded log of every step, tool call, argument and observation in a run.'],
  ['MCP', 'Model Context Protocol — a standard way to expose tools and data sources to agents.'],
  ['Sandbox', 'An isolated environment where an agent can run code or commands without touching anything real.'],
  ['Idempotency key', 'A token that makes a repeated tool call safe. Essential once you add retries to write actions.'],
  ['Context window', 'The maximum tokens the model can see at once — the hard ceiling on working memory.'],
  ['Token budget', 'A per-run spend cap. The difference between a bad night and a bad quarter.'],
  ['Swarm', 'Peer agents communicating without a central coordinator. Expensive; use narrowly.'],
  ['Deterministic fallback', 'Plain code that handles the case when the agent gives up. Every production agent needs one.']
];
