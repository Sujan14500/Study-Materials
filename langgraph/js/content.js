/* ============================================================
   content.js — every piece of course content lives here.
   Edit this file to change the course; demos.js only renders it.
   ============================================================ */
window.C = {};

/* ---------- Ch1: chain or graph? ---------- */
C.shapeTasks = [
  { t: 'Summarise a document, then translate the summary.',
    a: 'chain',
    why: 'Two steps, fixed order, no branching, no retry. A plain LCEL chain is smaller, faster and has nothing to configure. Wrapping this in a graph is pure ceremony.' },
  { t: 'Retrieve context, check whether it actually answers the question, and search again with a better query if it does not.',
    a: 'graph',
    why: 'The "search again" arrow points backwards. LCEL builds a DAG — it has no way to express an edge that returns to an earlier step. This is the canonical reason to reach for a graph.' },
  { t: 'Classify a ticket into billing / bug / feature and route it to one of three prompts.',
    a: 'chain',
    why: 'One-shot branching, no loop. `RunnableBranch` handles this in four lines. Reach for a graph when the branches need to rejoin, retry, or come back around.' },
  { t: 'Draft an email, pause for a human to approve or edit it, then send.',
    a: 'graph',
    why: 'A chain runs start to finish in one process. Pausing mid-run, surviving until a human answers tomorrow, and resuming with their edit needs persisted state — a checkpointer and an interrupt.' },
  { t: 'Run the same extraction prompt over 2,000 PDFs.',
    a: 'chain',
    why: 'A chain with `.batch()`. Same operation every time, no state, no decisions. A graph adds overhead and buys you nothing.' },
  { t: 'An agent that calls tools until it has an answer, and whose run must resume if the server restarts.',
    a: 'graph',
    why: 'A cycle (call tool → observe → decide again) plus durability across a process restart. Both are graph features; neither is expressible in LCEL.' }
];
C.shapeLabels = {
  chain: { name: 'LCEL chain', ico: '⛓️', hint: 'forward-only, one process' },
  graph: { name: 'LangGraph', ico: '🕸️', hint: 'cycles, state, checkpoints' }
};
C.graphGives = [
  ['Cycles', 'An edge can point backwards. Retry-until-good, reflect-and-revise and every agent loop are cycles.'],
  ['Explicit state', 'One typed object every node reads and writes. No hidden accumulators, no "where did that value come from".'],
  ['Persistence', 'Checkpoint the state after every node. A run survives a crash, a deploy, or a human taking until Tuesday to reply.'],
  ['Interrupts', 'Stop mid-graph, hand the state to a person, resume from exactly where it paused.'],
  ['Time travel', 'Every checkpoint is addressable. Rewind to step 3, change a value, and run a different future from there.'],
  ['Streaming that means something', 'Stream state, per-node updates, or model tokens — chosen per call, from any depth of the graph.']
];

/* ---------- Ch2: state and reducers ---------- */
C.reducers = [
  { k: 'none', name: 'no reducer', sig: 'steps: list[str]', ico: '♻️',
    desc: 'The default. A node returning this key overwrites whatever was there.',
    warn: 'Two nodes writing the same key in one super-step raises InvalidUpdateError — there is no rule for merging.' },
  { k: 'add', name: 'operator.add', sig: 'steps: Annotated[list[str], add]', ico: '➕',
    desc: 'Concatenates. Each node returns only its own new items and they accumulate.',
    warn: 'Works on lists, ints and anything supporting `+`. On a plain int it sums — which is how you count retries.' },
  { k: 'messages', name: 'add_messages', sig: 'messages: Annotated[list, add_messages]', ico: '💬',
    desc: 'Appends messages, but replaces by `id` instead of duplicating — which is what lets you edit history.',
    warn: 'Also coerces dicts and strings into real message objects. `MessagesState` is a prebuilt TypedDict with exactly this one key.' }
];
C.stateUpdates = [
  { node: 'plan',     ret: '{"steps": ["planned"]}',                    label: 'plan returns one new step' },
  { node: 'retrieve', ret: '{"steps": ["retrieved"], "docs": 3}',       label: 'retrieve adds a step and sets docs' },
  { node: 'grade',    ret: '{"steps": ["graded"], "relevant": false}',  label: 'grade adds a step and a verdict' },
  { node: 'answer',   ret: '{"steps": ["answered"]}',                   label: 'answer adds the last step' }
];
C.stateRules = [
  ['Nodes return updates, not the whole state', 'Return a dict with only the keys you changed. LangGraph merges it in using each key\'s reducer. Returning the full state works but makes diffs unreadable.'],
  ['A key with no reducer is last-write-wins', 'Which is fine for `question` or `answer`, and wrong for anything accumulating.'],
  ['Parallel writes need a reducer', 'Two nodes running in the same super-step and writing the same un-reduced key is an `InvalidUpdateError`, not a silent race. Annotate the key and the error goes away.'],
  ['Reducers are just functions', '`def keep_best(old, new): return max(old, new, key=len)` is a valid reducer. Use `Annotated[str, keep_best]`.'],
  ['Start from MessagesState when you can', 'It is `TypedDict` with `messages: Annotated[list, add_messages]`. Subclass it and add your own keys rather than re-declaring the messages plumbing.']
];

/* ---------- Ch3: nodes and edges ---------- */
C.nodeBank = [
  { id: 'classify', label: 'classify', ico: '🏷️', code: 'def classify(state: State) -> dict:\n    kind = model.invoke(...).content\n    return {"kind": kind}' },
  { id: 'retrieve', label: 'retrieve', ico: '📚', code: 'def retrieve(state: State) -> dict:\n    docs = retriever.invoke(state["question"])\n    return {"docs": docs}' },
  { id: 'run_sql',  label: 'run_sql',  ico: '🗄️', code: 'def run_sql(state: State) -> dict:\n    rows = db.run(state["sql"])\n    return {"rows": rows}' },
  { id: 'generate', label: 'generate', ico: '🧠', code: 'def generate(state: State) -> dict:\n    msg = model.invoke(prompt.invoke(state))\n    return {"answer": msg.content}' },
  { id: 'review',   label: 'review',   ico: '🖐️', code: 'def review(state: State) -> dict:\n    ok = interrupt({"draft": state["answer"]})\n    return {"approved": ok}' }
];
C.edgeRules = [
  ['START and END are real nodes', 'Import them from `langgraph.graph`. `add_edge(START, "first")` is how execution begins; a node with no outgoing edge does not implicitly finish.'],
  ['A node is any callable taking state', 'A function, a Runnable, or another compiled graph. No base class, no decorator, nothing to inherit.'],
  ['Two edges out of one node run in parallel', 'They execute in the same super-step. That is the fan-out primitive — and the reason their shared keys need reducers.'],
  ['Fan-in happens automatically', 'A node with two incoming edges waits for both before running. You do not write a barrier.'],
  ['compile() validates the wiring', 'Dangling nodes, unreachable nodes and a missing START edge are caught at compile time, not at 3am.'],
  ['add_sequence is sugar', '`builder.add_sequence([a, b, c])` wires a linear run without three add_edge calls.']
];

/* ---------- Ch4: conditional edges ---------- */
C.routerCases = [
  { q: 'How many orders shipped yesterday?',            kind: 'sql',    node: 'run_sql',
    why: 'Names a countable fact in our own database. The router sends it to the SQL branch.' },
  { q: 'What is our policy on Friday deploys?',          kind: 'docs',   node: 'retrieve',
    why: 'A policy question — the answer lives in the handbook, so retrieve first.' },
  { q: 'Refund order A-4471 for the damaged screen.',    kind: 'action', node: 'review',
    why: 'A write. The router deliberately sends every action through the human review node before anything executes.' },
  { q: 'Thanks, that helps!',                            kind: 'chat',   node: 'generate',
    why: 'Nothing to look up. Straight to generate — a router that fetches documents for "thanks" is burning money.' }
];
C.routerCode = 'from typing import Literal\n\ndef route(state: State) -> Literal["run_sql", "retrieve", "review", "generate"]:\n    """Pick the next node. Returns a NODE NAME, not a value."""\n    kind = state["kind"]\n    if kind == "sql":    return "run_sql"\n    if kind == "docs":   return "retrieve"\n    if kind == "action": return "review"\n    return "generate"\n\nbuilder.add_conditional_edges("classify", route)\n\n# with an explicit map, when the return values are not node names:\nbuilder.add_conditional_edges(\n    "classify", route,\n    {"sql": "run_sql", "docs": "retrieve", "action": "review", "chat": "generate"},\n)';
C.routerNotes = [
  ['It returns a node name, not data', 'The routing function\'s job is to pick an edge. Anything it computes is thrown away — write to state in a node, route in the router.'],
  ['Return a list to fan out', 'Returning `["run_sql", "retrieve"]` runs both branches in the same super-step.'],
  ['Type-hint the return', 'The `Literal[...]` hint is what lets LangGraph draw the possible edges without an explicit map — and it catches a typo in a node name at compile time.'],
  ['END is a valid destination', 'A router that returns `END` finishes the run. That is how "we are done" is expressed.'],
  ['Command(goto=...) is the alternative', 'A node can return `Command(goto="review", update={...})` to update state and route in one step — usually clearer for agent handoffs.']
];

/* ---------- Ch5: cycles ---------- */
C.cycleRun = [
  { node: 'retrieve', state: { question: 'friday shipping rules', attempts: 0, relevant: null, answer: null }, log: 'Retrieved 3 chunks about physical shipping. Not what was meant.' },
  { node: 'grade',    state: { question: 'friday shipping rules', attempts: 0, relevant: false, answer: null }, log: 'Grader: not relevant. Conditional edge → rewrite.' },
  { node: 'rewrite',  state: { question: 'Are Friday production deploys allowed?', attempts: 1, relevant: false, answer: null }, log: 'Rewrote the query to name the real concept.' },
  { node: 'retrieve', state: { question: 'Are Friday production deploys allowed?', attempts: 1, relevant: false, answer: null }, log: 'Retrieved 2 chunks — the deploy-policy section.' },
  { node: 'grade',    state: { question: 'Are Friday production deploys allowed?', attempts: 1, relevant: true, answer: null }, log: 'Relevant. Conditional edge → generate.' },
  { node: 'generate', state: { question: 'Are Friday production deploys allowed?', attempts: 1, relevant: true, answer: 'Blocked unless tagged hotfix.' }, log: 'Answered from the retrieved policy.' },
  { node: 'END',      state: { question: 'Are Friday production deploys allowed?', attempts: 1, relevant: true, answer: 'Blocked unless tagged hotfix.' }, log: 'Done. Two retrieval passes, one rewrite.' }
];
C.cycleNodes = [
  { id: 'retrieve', label: 'retrieve', x: 50, y: 15 },
  { id: 'grade',    label: 'grade',    x: 50, y: 42 },
  { id: 'rewrite',  label: 'rewrite',  x: 16, y: 68 },
  { id: 'generate', label: 'generate', x: 76, y: 68 },
  { id: 'END',      label: 'END',      x: 76, y: 90 }
];
C.cycleEdges = [
  ['retrieve', 'grade', ''],
  ['grade', 'rewrite', 'not relevant'],
  ['grade', 'generate', 'relevant'],
  ['rewrite', 'retrieve', 'retry'],
  ['generate', 'END', '']
];
C.cycleCode = 'def should_continue(state: State) -> Literal["rewrite", "generate"]:\n    # the attempts guard is what makes this terminate\n    if state["relevant"] or state["attempts"] >= 2:\n        return "generate"\n    return "rewrite"\n\nbuilder.add_conditional_edges("grade", should_continue)\nbuilder.add_edge("rewrite", "retrieve")      # <- the backward edge\n\ngraph.invoke(inp, {"recursion_limit": 10})';
C.cycleGuards = [
  ['A counter in the state', 'The only guard you actually control. `attempts >= 2 → give up` is checked by your code, and the graph stops for a reason you chose.'],
  ['recursion_limit', 'A super-step ceiling, default 25. Hitting it raises `GraphRecursionError` — it is a circuit breaker, not a design. If your graph relies on it to stop, you have a bug.'],
  ['A quality bar that can be met', 'A grader that is never satisfied loops until the limit. Make "good enough" reachable, and log when it is not.'],
  ['Progress, not just repetition', 'If `rewrite` produces the same query twice, the next retrieval returns the same chunks. Compare against previous attempts and bail when nothing changed.']
];

/* ---------- Ch6: prebuilt react agent ---------- */
C.reactCode = 'from langgraph.prebuilt import create_react_agent\nfrom langgraph.checkpoint.memory import InMemorySaver\n\nagent = create_react_agent(\n    model="anthropic:claude-opus-5",\n    tools=[get_p95, list_deploys, open_ticket],\n    prompt="You are an SRE assistant. Check data before claiming anything.",\n    checkpointer=InMemorySaver(),\n)\n\nagent.invoke(\n    {"messages": [{"role": "user", "content": "Checkout feels slow — why?"}]},\n    {"configurable": {"thread_id": "ops-1"}},\n)';
C.reactTrace = [
  { k: 'human', node: '—',     t: 'Checkout feels slow today. Figure out why.' },
  { k: 'ai',    node: 'agent', t: 'I need current latency before claiming anything.', tool: 'get_p95(service="checkout", window="24h")' },
  { k: 'tool',  node: 'tools', t: '{"p95_ms": 812}' },
  { k: 'ai',    node: 'agent', t: '812ms. I need a baseline to know if that is unusual.', tool: 'get_p95(service="checkout", window="7d_prior")' },
  { k: 'tool',  node: 'tools', t: '{"p95_ms": 430}' },
  { k: 'ai',    node: 'agent', t: 'Nearly double. Check what shipped in that window.', tool: 'list_deploys(service="checkout", since="48h")' },
  { k: 'tool',  node: 'tools', t: '[{"sha": "4a91c2", "at": "22:10", "title": "payment client retries"}]' },
  { k: 'final', node: 'agent', t: 'Checkout p95 went 430ms → 812ms (+89%). The only deploy in the window is 4a91c2 ("payment client retries") at 22:10. That is the likely cause.' }
];
C.reactAnatomy = [
  ['It is a two-node graph', '`agent` calls the model; `tools` executes whatever it asked for; a conditional edge loops back to `agent` or exits to END. That is the whole thing.'],
  ['Built on MessagesState', 'The state is one `messages` key with the `add_messages` reducer. Every tool result is appended as a ToolMessage.'],
  ['Everything else still applies', 'Checkpointers, interrupts, streaming and the store all work on it, because it is an ordinary compiled graph.'],
  ['Graduate when you outgrow it', 'The moment you need a node before the model, a second conditional branch, or a different stopping rule, build the graph yourself. It is about thirty lines.'],
  ['pre_model_hook for trimming', 'Long conversations blow the context window. A hook node that trims or summarises messages before the model call is the standard fix.']
];

/* ---------- Ch7: persistence ---------- */
C.threadTurns = [
  { th: 'alice', u: 'I look after the payments service.',  a: 'Noted — payments.' },
  { th: 'alice', u: 'What was p95 last week?',              a: 'For payments, 240ms.' },
  { th: 'bob',   u: 'What was p95 last week?',              a: 'Which service? I have no service in this thread.' },
  { th: 'alice', u: 'And the week before?',                 a: 'For payments, 218ms — so a 10% rise.' },
  { th: 'bob',   u: 'I own search.',                        a: 'Got it — search.' },
  { th: 'bob',   u: 'And mine?',                            a: 'For search, 96ms.' }
];
C.savers = [
  { name: 'InMemorySaver', pkg: 'langgraph.checkpoint.memory', use: 'Tests and notebooks. Dies with the process.', prod: false },
  { name: 'SqliteSaver', pkg: 'langgraph-checkpoint-sqlite', use: 'One machine, one file. Fine for a local tool or a small service.', prod: true },
  { name: 'PostgresSaver', pkg: 'langgraph-checkpoint-postgres', use: 'The production default. Call `.setup()` once to create the tables.', prod: true }
];
C.persistCode = 'from langgraph.checkpoint.postgres import PostgresSaver\n\nwith PostgresSaver.from_conn_string(DB_URL) as saver:\n    saver.setup()                     # once — creates the tables\n    graph = builder.compile(checkpointer=saver)\n\n    config = {"configurable": {"thread_id": "alice"}}\n    graph.invoke({"messages": [msg]}, config)\n\n    snap = graph.get_state(config)\n    snap.values      # the state right now\n    snap.next        # nodes queued to run next — () means finished\n    snap.config      # addresses THIS checkpoint (checkpoint_id inside)';
C.persistNotes = [
  ['thread_id is the conversation', 'One thread, one running history. Everything in the state is scoped to it. Get this wrong and one user reads another\'s thread — the classic bug.'],
  ['A checkpoint is written after every super-step', 'Not just at the end. That granularity is what makes resume, interrupt and time travel possible.'],
  ['Resume by passing None as input', '`graph.invoke(None, config)` continues an existing thread from its last checkpoint instead of starting over.'],
  ['snap.next tells you if it finished', 'An empty tuple means the run completed. A node name means it is paused — usually on an interrupt.'],
  ['Checkpoints are not free', 'Every super-step writes the full state. Keep large blobs out of state; store a reference and fetch it in the node.']
];

/* ---------- Ch8: human in the loop ---------- */
C.hitlSteps = [
  { node: 'draft',   log: 'Model drafts the refund email. Nothing has been sent.',
    state: { order: 'A-4471', amount: 249, draft: 'Hi — sorry about the damaged screen. We have refunded €249 to your original payment method.', approved: null, feedback: null } },
  { node: 'review',  log: '⏸ interrupt() called. The graph STOPS here and the checkpoint is written. This process can now exit; the run survives.',
    state: { order: 'A-4471', amount: 249, draft: 'Hi — sorry about the damaged screen. We have refunded €249 to your original payment method.', approved: null, feedback: null } }
];
C.hitlOutcomes = {
  approve: { label: '✅ Approve', cls: 'good',
    resume: 'Command(resume={"decision": "approve"})',
    log: 'Resumed at the review node. approved=True, so the conditional edge routes to send.',
    tail: [
      { node: 'send', log: 'Refund issued and email sent. This is the first irreversible thing that happened in the whole run.',
        state: { order: 'A-4471', amount: 249, approved: true, feedback: null, sent: true } },
      { node: 'END', log: 'Done. The audit trail shows who approved it and when.',
        state: { order: 'A-4471', amount: 249, approved: true, feedback: null, sent: true } }
    ] },
  edit: { label: '✏️ Edit, then approve', cls: 'meh',
    resume: 'Command(resume={"decision": "approve", "draft": "…refunded €249 and shipped a replacement."})',
    log: 'The human changed the draft. interrupt() returns their value, so the node writes the edited text into state.',
    tail: [
      { node: 'send', log: 'Sent the edited version. Note the human edited STATE, not a prompt — the graph does not know or care that a person touched it.',
        state: { order: 'A-4471', amount: 249, approved: true, feedback: 'replacement mentioned', sent: true } },
      { node: 'END', log: 'Done, with the human\'s edit recorded in the checkpoint history.',
        state: { order: 'A-4471', amount: 249, approved: true, feedback: 'replacement mentioned', sent: true } }
    ] },
  reject: { label: '⛔ Reject with a reason', cls: 'bad',
    resume: 'Command(resume={"decision": "reject", "feedback": "Refund the line item, not the whole order."})',
    log: 'approved=False, so the conditional edge routes back to draft with the feedback in state.',
    tail: [
      { node: 'draft', log: 'Re-drafting with the feedback. The rejection reason is now part of the state the model sees — which is why a reason beats a bare "no".',
        state: { order: 'A-4471', amount: 89, approved: false, feedback: 'Refund the line item, not the whole order.', sent: false } },
      { node: 'review', log: '⏸ Paused again for a second look. The loop is the point: reject is not a failure, it is another turn.',
        state: { order: 'A-4471', amount: 89, approved: null, feedback: 'Refund the line item, not the whole order.', sent: false } }
    ] }
};
C.hitlCode = 'from langgraph.types import interrupt, Command\n\ndef review(state: State) -> dict:\n    decision = interrupt({                 # <- pauses the graph here\n        "draft": state["draft"],\n        "amount": state["amount"],\n    })\n    if decision["decision"] == "approve":\n        return {"approved": True, "draft": decision.get("draft", state["draft"])}\n    return {"approved": False, "feedback": decision["feedback"]}\n\ngraph = builder.compile(checkpointer=saver)   # interrupts REQUIRE a checkpointer\n\n# first call runs up to the interrupt and returns\nresult = graph.invoke(inp, config)\nresult["__interrupt__"]        # what the human needs to see\n\n# later — possibly a different process, a different day\ngraph.invoke(Command(resume={"decision": "approve"}), config)';
C.hitlNotes = [
  ['interrupt() needs a checkpointer', 'Without one there is nothing to pause into. This is the most common "why does my interrupt do nothing" answer.'],
  ['The node re-runs from the top on resume', 'Everything before `interrupt()` in that node executes again. Keep side effects after the interrupt, or in a separate node.'],
  ['Resume with Command(resume=value)', 'That value becomes the return value of `interrupt()`. It can be anything JSON-serialisable — a bool, an edited draft, a whole dict.'],
  ['interrupt_before is the coarse version', '`compile(interrupt_before=["send"])` pauses before a node without changing its code. Good for a quick gate; `interrupt()` is better when you need to show the human specific data.'],
  ['Rejection should carry a reason', 'Write the reason into state and route back. A bare "no" makes the model guess, and it usually guesses the same thing again.']
];

/* ---------- Ch9: time travel ---------- */
C.ttHistory = [
  { i: 0, node: 'START',    ckpt: '1f0a…c31', vals: { question: 'Summarise Q2 revenue', region: 'EU', rows: null, answer: null } },
  { i: 1, node: 'plan',     ckpt: '1f0a…d47', vals: { question: 'Summarise Q2 revenue', region: 'EU', rows: null, answer: null } },
  { i: 2, node: 'run_sql',  ckpt: '1f0a…e02', vals: { question: 'Summarise Q2 revenue', region: 'EU', rows: 1284300, answer: null } },
  { i: 3, node: 'generate', ckpt: '1f0a…f19', vals: { question: 'Summarise Q2 revenue', region: 'EU', rows: 1284300, answer: 'EU Q2 revenue was €1,284,300.' } },
  { i: 4, node: 'END',      ckpt: '1f0b…003', vals: { question: 'Summarise Q2 revenue', region: 'EU', rows: 1284300, answer: 'EU Q2 revenue was €1,284,300.' } }
];
C.ttFork = {
  fromIndex: 1,
  edit: { region: 'APAC' },
  branch: [
    { i: 2, node: 'run_sql',  ckpt: '2c41…a88', vals: { question: 'Summarise Q2 revenue', region: 'APAC', rows: 617400, answer: null } },
    { i: 3, node: 'generate', ckpt: '2c41…b12', vals: { question: 'Summarise Q2 revenue', region: 'APAC', rows: 617400, answer: 'APAC Q2 revenue was €617,400.' } },
    { i: 4, node: 'END',      ckpt: '2c41…c05', vals: { question: 'Summarise Q2 revenue', region: 'APAC', rows: 617400, answer: 'APAC Q2 revenue was €617,400.' } }
  ]
};
C.ttCode = 'config = {"configurable": {"thread_id": "report-9"}}\n\n# newest first\nhistory = list(graph.get_state_history(config))\n\nsnap = history[3]          # the checkpoint after `plan`\nsnap.values                # state at that moment\nsnap.next                  # what was about to run\n\n# 1. replay from there, unchanged\ngraph.invoke(None, snap.config)\n\n# 2. or fork: edit the state, get a NEW checkpoint, run a different future\nforked = graph.update_state(snap.config, {"region": "APAC"})\ngraph.invoke(None, forked)\n\n# the original branch is untouched and still addressable';
C.ttUses = [
  ['Debug without re-running everything', 'Jump to the checkpoint before the node that misbehaved and replay just that. No re-paying for the eleven steps that were fine.'],
  ['Answer "what if we had said X"', 'Fork at the decision point, change one field, run forward. Both futures exist side by side.'],
  ['Undo, properly', 'Rewinding is not deleting. The original branch stays addressable by its checkpoint id.'],
  ['Recover from a bad tool result', 'Rewind to before the call, `update_state` with a corrected result, and continue as though it had worked.'],
  ['update_state can impersonate a node', '`update_state(config, values, as_node="grade")` writes the update as if `grade` produced it — so routing that depends on which node ran still behaves.']
];

/* ---------- Ch10: streaming ---------- */
C.streamModes = [
  { k: 'values', name: '"values"', ico: '📦',
    desc: 'The full state after every super-step.',
    use: 'Simple UIs that just re-render everything, and debugging state drift.',
    events: [
      '{"question": "Friday deploys?", "docs": null, "answer": null}',
      '{"question": "Friday deploys?", "docs": 2, "answer": null}',
      '{"question": "Friday deploys?", "docs": 2, "relevant": true, "answer": null}',
      '{"question": "Friday deploys?", "docs": 2, "relevant": true, "answer": "Blocked unless hotfix."}'
    ] },
  { k: 'updates', name: '"updates"', ico: '🔺',
    desc: 'Only what each node changed, keyed by node name.',
    use: 'The default choice. Small payloads, and you can see exactly which node did what.',
    events: [
      '{"retrieve": {"docs": 2}}',
      '{"grade": {"relevant": true}}',
      '{"generate": {"answer": "Blocked unless hotfix."}}'
    ] },
  { k: 'messages', name: '"messages"', ico: '⚡',
    desc: 'LLM tokens as they are generated, with metadata naming the node that produced them.',
    use: 'Chat UIs. This is the one that makes the answer appear word by word.',
    events: [
      '(AIMessageChunk("Blocked"), {"langgraph_node": "generate"})',
      '(AIMessageChunk(" unless"), {"langgraph_node": "generate"})',
      '(AIMessageChunk(" hotfix"), {"langgraph_node": "generate"})',
      '(AIMessageChunk("."), {"langgraph_node": "generate"})'
    ] },
  { k: 'custom', name: '"custom"', ico: '📣',
    desc: 'Whatever you write from inside a node with `get_stream_writer()`.',
    use: 'Progress on long non-LLM work — "fetched 40/200 pages" — that no other mode can see.',
    events: [
      '{"progress": "embedding 1/3"}',
      '{"progress": "embedding 2/3"}',
      '{"progress": "embedding 3/3"}'
    ] },
  { k: 'debug', name: '"debug"', ico: '🔬',
    desc: 'Task start/end events with inputs, outputs, timings and checkpoint ids.',
    use: 'Working out why the graph took the branch it took. Verbose — not for production UIs.',
    events: [
      '{"type": "task", "step": 1, "payload": {"name": "retrieve", "input": {...}}}',
      '{"type": "task_result", "step": 1, "payload": {"name": "retrieve", "result": [("docs", 2)]}}',
      '{"type": "task", "step": 2, "payload": {"name": "grade", "input": {...}}}'
    ] }
];
C.streamCode = 'for chunk in graph.stream(inp, config, stream_mode="updates"):\n    print(chunk)\n\n# several modes at once — each yield is (mode, chunk)\nfor mode, chunk in graph.stream(inp, config, stream_mode=["updates", "messages"]):\n    ...\n\n# include events from nested subgraphs\ngraph.stream(inp, config, stream_mode="updates", subgraphs=True)\n\n# writing a custom event from inside a node\nfrom langgraph.config import get_stream_writer\n\ndef embed_all(state):\n    writer = get_stream_writer()\n    for i, doc in enumerate(state["docs"]):\n        writer({"progress": f"embedding {i+1}/{len(state[\'docs\'])}"})\n        ...';

/* ---------- Ch11: subgraphs and multi-agent ---------- */
C.multiSteps = [
  { from: 'supervisor', to: 'researcher', cmd: 'Command(goto="researcher", update={"task": "find the 3 closest competitors"})',
    log: 'Supervisor decides research is needed and hands off. `goto` routes, `update` writes state — one return value does both.' },
  { from: 'researcher', to: 'supervisor', cmd: 'Command(goto="supervisor", update={"findings": [...3 competitors...]})',
    log: 'Researcher finishes and hands control back with its findings written into shared state.' },
  { from: 'supervisor', to: 'writer', cmd: 'Command(goto="writer", update={"task": "draft the comparison memo"})',
    log: 'Supervisor reads the findings and delegates the writing.' },
  { from: 'writer', to: 'supervisor', cmd: 'Command(goto="supervisor", update={"draft": "..."})',
    log: 'Draft written and returned. The supervisor is the only node holding the plan.' },
  { from: 'supervisor', to: 'END', cmd: 'Command(goto=END)',
    log: 'Supervisor judges the work complete and ends the run.' }
];
C.multiNodes = [
  { id: 'supervisor', label: 'supervisor', x: 50, y: 25 },
  { id: 'researcher', label: 'researcher', x: 18, y: 72 },
  { id: 'writer',     label: 'writer',     x: 50, y: 72 },
  { id: 'END',        label: 'END',        x: 84, y: 72 }
];
C.multiCode = 'from langgraph.types import Command\nfrom typing import Literal\n\ndef supervisor(state: State) -> Command[Literal["researcher", "writer", "__end__"]]:\n    decision = model.with_structured_output(Route).invoke(state["messages"])\n    if decision.done:\n        return Command(goto=END)\n    return Command(\n        goto=decision.agent,\n        update={"task": decision.task},      # route AND write state\n    )\n\nbuilder.add_node("supervisor", supervisor)\nbuilder.add_node("researcher", researcher)   # a compiled graph is a valid node\nbuilder.add_node("writer", writer)\nbuilder.add_edge(START, "supervisor")';
C.subgraphNotes = [
  ['A compiled graph is a node', '`builder.add_node("research", research_graph)` — nothing special required. Nesting is how you keep a big graph readable.'],
  ['Shared keys flow automatically', 'If parent and subgraph states share a key name, it passes straight through. Different schemas need a wrapper function that translates both ways.'],
  ['Subgraphs get their own checkpoints', 'Namespaced under the parent thread. Interrupts inside a subgraph propagate up and resume correctly.'],
  ['Pass subgraphs=True to see inside', 'Otherwise streaming and `get_state` report the subgraph as one opaque node.'],
  ['Command(goto=) beats a router for handoffs', 'The agent that decides where to go next is the one with the context to decide. Splitting that into a node plus a separate routing function adds a hop for nothing.']
];

/* ---------- Ch12: memory ---------- */
C.memScopes = [
  { k: 'short', name: 'Short-term (checkpointer)', ico: '🧵', color: '#818cf8',
    scope: 'one thread',
    holds: 'The graph state: messages, intermediate values, where the run is up to.',
    api: 'compile(checkpointer=saver) · thread_id',
    dies: 'Never automatically — but it is only ever read back within that one thread.' },
  { k: 'long', name: 'Long-term (store)', ico: '🗄️', color: '#e879f9',
    scope: 'any thread, any run',
    holds: 'Facts worth keeping: preferences, learned rules, profile data, past decisions.',
    api: 'compile(store=store) · namespace + key',
    dies: 'When you delete it. It outlives every conversation.' }
];
C.memOps = [
  { op: 'put', args: '(("memories", "alice"), "pref-1", {"text": "always metric units"})',
    log: 'Wrote a fact into the "memories" namespace for user alice. Namespaces are tuples — that is how you scope by user, org or topic.' },
  { op: 'put', args: '(("memories", "alice"), "pref-2", {"text": "owns the payments service"})',
    log: 'A second fact in the same namespace.' },
  { op: 'put', args: '(("memories", "bob"), "pref-1", {"text": "prefers short answers"})',
    log: 'A different user, a different namespace. Same key name, no collision.' },
  { op: 'search', args: '(("memories", "alice"), query="what units?")',
    log: 'Semantic search inside alice\'s namespace only. Bob\'s memory is not searched, and cannot be.' },
  { op: 'get', args: '(("memories", "bob"), "pref-1")',
    log: 'Exact lookup by key. Cheaper than search when you already know the key.' }
];
C.memCode = 'from langgraph.store.memory import InMemoryStore\nfrom langgraph.checkpoint.memory import InMemorySaver\n\nstore = InMemoryStore(index={"embed": embeddings, "dims": 1536})\ngraph = builder.compile(checkpointer=InMemorySaver(), store=store)\n\ndef remember(state, config, *, store):        # store is injected\n    user = config["configurable"]["user_id"]\n    ns = ("memories", user)\n    store.put(ns, str(uuid4()), {"text": state["fact"]})\n    hits = store.search(ns, query=state["question"], limit=3)\n    return {"recalled": [h.value["text"] for h in hits]}\n\ngraph.invoke(inp, {"configurable": {"thread_id": "t1", "user_id": "alice"}})';
C.memNotes = [
  ['thread_id is not user_id', 'One user has many threads. Scope the checkpointer by thread and the store by user, or last week\'s conversation vanishes every time someone opens a new chat.'],
  ['Namespaces are tuples, and they nest', '`("memories", user_id)`, `("rules", org_id, "billing")`. Search is scoped to the namespace, which is your isolation boundary.'],
  ['Not everything deserves to be stored', 'A transient tool result is noise next week. Store preferences, decisions and durable facts — and write a rule for what qualifies before you build the store.'],
  ['Retrieve, do not paste', 'Search the store and inject the few relevant hits. A store that grows unbounded and is pasted whole eats the context window it was meant to save.'],
  ['InMemoryStore for dev, Postgres for real', 'Same interface. `PostgresStore` with pgvector gives you semantic search over long-term memory.']
];

/* ---------- Ch13: shipping ---------- */
C.arch = [
  ['Your app', 'FastAPI, a worker, a CLI. A compiled graph is just an object you call.'],
  ['Compiled graph', 'Nodes, edges, and the state schema. Immutable once compiled.'],
  ['Checkpointer', 'Postgres in production. Every super-step, every thread.'],
  ['Store', 'Long-term memory across threads, namespaced by user or org.'],
  ['Model + tools', 'Ordinary LangChain runnables. The graph does not care which provider.'],
  ['Tracing', 'LangSmith. Node-level inputs, outputs, timings and the branch taken.']
];
C.prodConcerns = [
  ['Retries belong on the node', '`add_node("fetch", fetch, retry=RetryPolicy(max_attempts=3))`. A flaky API becomes a non-event; a bad plan is not helped by retrying it.'],
  ['recursion_limit is a circuit breaker', 'Set it, alert on `GraphRecursionError`, and treat every occurrence as a design bug rather than raising the limit.'],
  ['Keep state small and serialisable', 'It is written to the checkpointer after every super-step. Put a document id in state, not the document.'],
  ['Nodes must tolerate re-execution', 'A resumed interrupt re-runs the node from the top, and a retry re-runs it entirely. Use idempotency keys on anything that writes.'],
  ['Version the graph with the code', 'A checkpoint from last week refers to node names that must still exist. Renaming a node breaks resume for every in-flight thread.'],
  ['Cache expensive pure nodes', 'A `CachePolicy` on a node whose output depends only on its input skips the work on replay — which matters a lot with time travel and retries.']
];
C.checklist = [
  'A real checkpointer (Postgres/Sqlite) — not InMemorySaver',
  'thread_id derived from the conversation, user_id from auth — never mixed up',
  'recursion_limit set explicitly, and alerted on',
  'Every cycle has a counter in state that can end it',
  'Nodes are idempotent, or their writes carry an idempotency key',
  'State holds references, not large blobs',
  'Irreversible actions sit behind interrupt() or interrupt_before',
  'Rejections write a reason into state and route back',
  'RetryPolicy on nodes that call flaky external services',
  'LangSmith tracing on, with run names on every node',
  'A golden set of runs replayed on every graph or prompt change',
  'Node names are stable — renaming breaks resume for in-flight threads'
];
C.deployNotes = [
  ['langgraph dev', 'Runs the graph locally with a Studio UI: step nodes, inspect state, fork checkpoints in a browser. The fastest debugging loop available.'],
  ['langgraph.json', 'Declares the graphs, dependencies and env vars. `{"graphs": {"agent": "./app.py:graph"}}`.'],
  ['Self-host it', 'A compiled graph is a Python object. Wrap it in FastAPI and deploy it like any other service — the checkpointer is your only stateful dependency.'],
  ['LangGraph Server / Platform', 'Managed API with threads, runs, cron, a task queue and horizontal scaling built in. Worth it once you need queueing and background runs.'],
  ['Streaming to the browser', 'Server-sent events over `stream_mode=["updates","messages"]` covers nearly every chat UI.']
];

/* ---------- Ch14: quiz ---------- */
C.quiz = [
  { q: 'What can a LangGraph graph do that an LCEL chain fundamentally cannot?', o: ['Call a model', 'Contain a cycle — an edge pointing back to an earlier node', 'Stream tokens', 'Use tools'], a: 1,
    e: 'LCEL builds a DAG: data flows forward only. Retry-until-good, reflect-and-revise and every agent loop are cycles, and need a graph.' },
  { q: 'A node returns `{"docs": 3}`. What happens to the rest of the state?', o: ['It is wiped', 'It is unchanged — nodes return updates, which are merged in', 'It must be returned too or the run fails', 'It is copied into a new thread'], a: 1,
    e: 'Return only the keys you changed. LangGraph merges the update using each key\'s reducer.' },
  { q: 'Two nodes run in the same super-step and both write `steps`, which has no reducer. Result?', o: ['Last one wins silently', 'InvalidUpdateError', 'Both values are kept in a list', 'The graph deadlocks'], a: 1,
    e: 'With no reducer there is no rule for merging concurrent writes, so it raises rather than guessing. Annotate the key — `Annotated[list, add]` — and it appends.' },
  { q: 'What does `add_messages` do that plain `operator.add` does not?', o: ['It is faster', 'It replaces a message with the same id instead of appending a duplicate', 'It caps the list length', 'It calls the model'], a: 1,
    e: 'Replace-by-id is what makes editing history possible — re-send a message with an existing id and it is updated in place.' },
  { q: 'A conditional edge function returns…', o: ['The updated state', 'The name of the next node (or a list of names)', 'A boolean', 'The model response'], a: 1,
    e: 'Its only job is picking an edge. Anything it computes is discarded — compute in a node, route in the router.' },
  { q: 'What is `recursion_limit` for?', o: ['Limiting nested subgraphs', 'A ceiling on super-steps that raises GraphRecursionError — a circuit breaker, not a stopping condition', 'Limiting tool calls per node', 'Capping token spend'], a: 1,
    e: 'If your graph relies on it to terminate, that is a bug. Put a counter in the state and route on it.' },
  { q: 'What does `thread_id` control?', o: ['Which model is used', 'Which checkpointed conversation is loaded and appended to', 'Concurrency of node execution', 'The trace name'], a: 1,
    e: 'It is the isolation boundary for short-term memory. Two users sharing a thread_id share their whole history.' },
  { q: 'You call `interrupt()` in a node but the graph never pauses. Most likely cause?', o: ['The model does not support it', 'The graph was compiled without a checkpointer', 'recursion_limit is too low', 'The node is not connected to START'], a: 1,
    e: 'There is nothing to pause into without persistence. `compile(checkpointer=saver)` is required for interrupts.' },
  { q: 'After resuming from an `interrupt()`, what happens to the code before the interrupt call in that node?', o: ['It is skipped', 'It runs again — the node re-executes from the top', 'It runs only if state changed', 'The node is deleted'], a: 1,
    e: 'Which is why side effects belong after the interrupt, or in a separate node. Sending an email before `interrupt()` sends it twice.' },
  { q: 'You want to change one field at step 2 and run a different future without destroying the original. What do you use?', o: ['graph.invoke with new input', 'graph.update_state on that checkpoint\'s config, then invoke with None', 'A new thread_id', 'Editing the checkpointer table'], a: 1,
    e: '`update_state` forks: it writes a new checkpoint descending from that one. The original branch stays addressable.' },
  { q: 'Which stream mode gives you LLM tokens as they are generated?', o: ['"values"', '"messages"', '"updates"', '"debug"'], a: 1,
    e: '"messages" yields (chunk, metadata) tuples, with metadata naming the node — so you can show tokens from one node and ignore another.' },
  { q: 'A checkpointer stores state per thread. What is the Store for?', o: ['Caching model responses', 'Facts that must outlive a single thread — preferences, profiles, learned rules', 'Storing the graph definition', 'Rate limiting'], a: 1,
    e: 'Checkpointer = short-term, scoped to `thread_id`. Store = long-term, scoped by namespace, usually `user_id`. Confusing the two is why memory "disappears" when a user starts a new chat.' }
];

/* ---------- glossary ---------- */
C.glossary = [
  ['StateGraph', 'The builder. You declare a state schema, add nodes and edges, then compile it.'],
  ['State', 'A TypedDict every node reads and writes. The explicit contract between nodes.'],
  ['Reducer', 'A function saying how an update merges with the existing value for one key. Default: overwrite.'],
  ['add_messages', 'The message reducer: appends, but replaces by id instead of duplicating.'],
  ['MessagesState', 'Prebuilt state with one key — `messages: Annotated[list, add_messages]`. Subclass it.'],
  ['Node', 'Any callable taking the state and returning a dict of updates. A compiled graph counts.'],
  ['Edge', 'A fixed connection between nodes. Two edges out of one node means parallel execution.'],
  ['Conditional edge', 'A function that inspects state and returns the name of the next node.'],
  ['START / END', 'Sentinel nodes. `add_edge(START, "first")` begins the run; routing to END finishes it.'],
  ['Super-step', 'One round of the execution loop. All nodes ready at that moment run together; then a checkpoint is written.'],
  ['compile()', 'Validates the wiring and returns the runnable graph. Checkpointer, store and interrupts are set here.'],
  ['Command', 'A node return value that routes and updates state at once: `Command(goto="x", update={...})`.'],
  ['Send', 'Dynamic fan-out: return `[Send("node", payload), ...]` to run one node many times in parallel.'],
  ['recursion_limit', 'Maximum super-steps per run (default 25). Exceeding it raises GraphRecursionError.'],
  ['Checkpointer', 'Persists the state after every super-step. InMemorySaver, SqliteSaver, PostgresSaver.'],
  ['Checkpoint', 'One saved snapshot of state, addressable by id. The unit of resume and time travel.'],
  ['thread_id', 'The conversation key. Everything the checkpointer stores is scoped to it.'],
  ['StateSnapshot', 'What `get_state` returns: `.values`, `.next`, `.config`, `.tasks`, `.metadata`.'],
  ['interrupt()', 'Pauses the graph inside a node and surfaces a payload to the caller. Requires a checkpointer.'],
  ['Command(resume=…)', 'Resumes a paused graph; the value becomes the return value of `interrupt()`.'],
  ['interrupt_before / after', 'Compile-time pause points around a node, without changing the node\'s code.'],
  ['get_state_history', 'Every checkpoint for a thread, newest first. The basis of time travel.'],
  ['update_state', 'Writes a new checkpoint from an existing one — an edit, or a fork into a different future.'],
  ['Time travel', 'Replaying or forking a run from any past checkpoint.'],
  ['stream_mode', '"values" | "updates" | "messages" | "custom" | "debug". Pass a list to combine them.'],
  ['get_stream_writer', 'Called inside a node to emit custom stream events — progress on non-LLM work.'],
  ['Subgraph', 'A compiled graph used as a node in another graph. Nesting keeps large graphs readable.'],
  ['Store', 'Long-term memory across threads, keyed by a namespace tuple plus a key. Optional vector search.'],
  ['Namespace', 'The tuple scoping a store entry, e.g. `("memories", user_id)`. Your isolation boundary.'],
  ['RetryPolicy', 'Per-node retry configuration for flaky external calls.'],
  ['create_react_agent', 'Prebuilt two-node tool-calling agent. An ordinary compiled graph underneath.'],
  ['LangGraph Studio', 'The UI from `langgraph dev`: step nodes, inspect state, fork checkpoints in a browser.']
];

/* ============================================================
   Ch7: scoped tools and controlled state
   ------------------------------------------------------------
   The run below is scripted rather than simulated — it is a
   transcript of one task, and the demo replays it under two
   different graphs. `wide` steps only happen when every tool is
   bound to one node, which is the whole argument for scoping.
   ============================================================ */
C.lgsTools = [
  { n: 'grep_repo',       ph: 'research', tk: 96,  d: 'search the codebase for a literal string' },
  { n: 'read_file',       ph: 'research', tk: 104, d: 'read a file, optionally a line range' },
  { n: 'search_docs',     ph: 'research', tk: 118, d: 'semantic search over the runbooks' },
  { n: 'apply_patch',     ph: 'act',      tk: 182, d: 'apply a unified diff to one file' },
  { n: 'run_tests',       ph: 'act',      tk: 121, d: 'run a test path, return pass/fail plus failures' },
  { n: 'run_lint',        ph: 'act',      tk: 88,  d: 'style and type check' },
  { n: 'open_pr',         ph: 'finish',   tk: 143, d: 'open a pull request with a title and body' },
  { n: 'post_summary',    ph: 'finish',   tk: 110, d: 'write the outcome back to the ticket' },
  { n: 'restart_service', ph: 'ops',      tk: 92,  d: 'restart a production service', danger: true },
  { n: 'deploy_prod',     ph: 'ops',      tk: 134, d: 'deploy the current SHA to production', danger: true },
  { n: 'refund_charge',   ph: 'ops',      tk: 126, d: 'issue a refund against a charge id', danger: true },
  { n: 'page_oncall',     ph: 'ops',      tk: 74,  d: 'page the on-call engineer', danger: true }
];

C.lgsPhases = [
  { id: 'research', n: 'research', d: 'read-only. Understand before touching anything.',
    writes: ['messages', 'findings'] },
  { id: 'act',      n: 'act',      d: 'change the code, then prove the change with tests.',
    writes: ['messages', 'patch', 'test_result'] },
  { id: 'finish',   n: 'finish',   d: 'hand the work to a human. No code changes here.',
    writes: ['messages', 'pr'] }
];

/* the compiled graph, in the coordinate system drawGraph() already uses */
C.lgsNodes = [
  { id: 'START',    label: 'START',    x: 50, y: 8 },
  { id: 'agent',    label: 'agent',    x: 50, y: 32 },
  { id: 'research', label: 'research', x: 15, y: 62 },
  { id: 'act',      label: 'act',      x: 50, y: 62 },
  { id: 'finish',   label: 'finish',   x: 85, y: 62 },
  { id: 'END',      label: 'END',      x: 85, y: 90 }
];
C.lgsEdges = [
  ['START', 'agent', ''],
  ['agent', 'research', 'act'],
  ['agent', 'act', 'act'],
  ['agent', 'finish', 'act'],
  ['research', 'agent', 'obs'],
  ['act', 'agent', 'obs'],
  ['finish', 'END', '']
];

C.lgsSchema = [
  { k: 'messages',    t: 'Annotated[list, add_messages]', w: 'every node',
    d: 'The transcript. Appended, never overwritten — that is what the reducer buys you.' },
  { k: 'findings',    t: 'Annotated[dict, merge_dicts]',  w: 'research',
    d: 'What the agent learned, as typed fields. Later nodes read this instead of re-reading message 6.' },
  { k: 'patch',       t: 'str | None',                    w: 'act',
    d: 'Last write wins. Only one node can produce it, so there is no merge to define.' },
  { k: 'test_result', t: 'Literal["pass","fail"] | None', w: 'act',
    d: 'The exit condition. The router reads this, not the model\'s opinion of its own work.' },
  { k: 'pr',          t: 'int | None',                    w: 'finish',
    d: 'Set once, at the end. If it is None the run did not finish, whatever the transcript says.' }
];

/* ph = which node runs; wide = only happens when everything is bound to one node */
C.lgsRun = [
  { ph: 'research', think: 'The ticket says "some refunds fail". Find the error string first.',
    act: 'grep_repo("E-4021")',
    obs: '2 matches · refund_worker.py:88 · runbooks/gateway.md:12',
    w: { findings: { code: 'E-4021' } } },

  { ph: 'research', wide: true, bad: true,
    think: 'A restart usually clears transient gateway errors. Worth a try.',
    act: 'restart_service("payments")',
    obs: '⚠ executed · 2,100 in-flight refunds dropped',
    note: 'Nothing in the state changed, because this tool has no contract with the state machine at all. It just reached into production. The research node was never supposed to be able to call it — but every tool was bound to every node.' },

  { ph: 'research', think: 'Read the handler around the match before changing anything.',
    act: 'read_file("refund_worker.py", lines="80-96")',
    obs: 'the retry loop catches TimeoutError and returns None',
    w: { findings: { code: 'E-4021', cause: 'timeout swallowed by retry loop' } } },

  { ph: 'act', think: 'Re-raise instead of swallowing, and cap the retries at 2.',
    act: 'apply_patch("refund_worker.py", diff)',
    obs: 'applied · 1 file, +6 −2',
    w: { patch: 'refund_worker.py' } },

  { ph: 'act', think: 'Ground truth, not a vibe.',
    act: 'run_tests("tests/test_refund.py")',
    obs: '1 failed · test_refund_timeout expects RefundError, got TimeoutError',
    w: { test_result: 'fail' } },

  { ph: 'act', think: 'Wrap the re-raise in RefundError so callers see one exception type.',
    act: 'apply_patch("refund_worker.py", diff2)',
    obs: 'applied · 1 file, +3 −1',
    w: { patch: 'refund_worker.py' } },

  { ph: 'act', think: 'Run them again.',
    act: 'run_tests("tests/test_refund.py")',
    obs: '12 passed',
    w: { test_result: 'pass' } },

  { ph: 'act', wide: true, bad: true,
    think: 'Tests are green. I will roll it out.',
    act: 'deploy_prod("refund-worker")',
    obs: '⚠ deployed · no review, no staging',
    note: 'Green tests are not permission to deploy. The finish node exists precisely so that "what happens after the tests pass" is a routing decision you made, not one the model made at temperature 1.' },

  { ph: 'finish', think: 'Tests pass and the patch is on disk. Hand it over.',
    act: 'open_pr(title="fix: surface refund gateway timeouts")',
    obs: 'PR #412 opened · awaiting review',
    w: { pr: 412 } }
];

C.lgsPayload = { base: 620, perMessage: 145 };

C.lgsCode = [
  { t: 'bind per node', code:
`# One model, three tool sets. The node decides what is callable —
# not the prompt, and not the model's judgement.

TOOLS = {
    "research": [grep_repo, read_file, search_docs],
    "act":      [apply_patch, run_tests, run_lint],
    "finish":   [open_pr, post_summary],
}

def agent(state: State) -> Command[Literal["research", "act", "finish"]]:
    phase = state["phase"]
    reply = llm.bind_tools(TOOLS[phase]).invoke(
        build_prompt(state, phase)
    )
    # Command returns the state update AND the routing decision together,
    # so there is no window where one is applied without the other.
    return Command(goto=phase, update={"messages": [reply]})

# Each tool node only ever executes its own set. A tool call for
# deploy_prod arriving at the research node is not "discouraged" —
# it is not in the schema the model was given, so it cannot be produced.
builder.add_node("research", ToolNode(TOOLS["research"]))
builder.add_node("act",      ToolNode(TOOLS["act"]))
builder.add_node("finish",   ToolNode(TOOLS["finish"]))` },

  { t: 'the state contract', code:
`class State(TypedDict):
    messages:    Annotated[list[AnyMessage], add_messages]
    findings:    Annotated[dict, merge_dicts]   # research writes
    patch:       str | None                     # act writes
    test_result: Literal["pass", "fail"] | None # act writes
    pr:          int | None                     # finish writes
    phase:       Literal["research", "act", "finish"]

# Routing reads the state, never the model's self-assessment.
def route(state: State) -> Literal["act", "finish", "__end__"]:
    if state["test_result"] == "pass":
        return "finish"
    if state["pr"]:
        return "__end__"
    return "act"

builder.add_conditional_edges("agent", route)

# Why this matters: "did it work" is now a field with three legal values,
# checked by code. In a plain loop it is a sentence in message 14 that
# somebody has to parse, and the model wrote it.` },

  { t: 'guarding the writes', code:
`# LangGraph merges whatever a node returns. It will not stop the finish
# node writing "patch" — so if that invariant matters, assert it.

WRITABLE = {
    "research": {"messages", "findings"},
    "act":      {"messages", "patch", "test_result"},
    "finish":   {"messages", "pr"},
}

def guarded(node_name, fn):
    def wrapped(state: State):
        update = fn(state) or {}
        illegal = set(update) - WRITABLE[node_name]
        if illegal:
            raise ValueError(f"{node_name} may not write {illegal}")
        return update
    return wrapped

builder.add_node("act", guarded("act", act_node))

# Ten lines, and every "how did that field get set?" debugging session
# for the rest of the project turns into a stack trace instead.` }
];

C.lgsNotes = [
  ['Scoping is a graph edit, not a prompt', 'Listing the allowed tools in the system prompt is a request. Binding a different tool set per node makes the wrong call unrepresentable — the schema the model samples from does not contain it.'],
  ['Command fuses routing and update', 'Returning `Command(goto=..., update=...)` means the next node and the state change land together. Two separate mechanisms is two things that can disagree.'],
  ['The router reads state, not prose', '`state["test_result"] == "pass"` is a comparison. "The agent said it was done" is a parsing problem you gave yourself.'],
  ['Tool schemas are resent every step', 'Twelve bound tools is roughly 1.4k tokens of JSON on every single call, all run long. Three is 320.'],
  ['Write permissions are yours to enforce', 'LangGraph merges anything a node returns. If only one node should set `patch`, wrap the node and assert it — the framework will not do it for you.']
];

/* ------------------------------------------------------------
   Plain-English openers — one per chapter, keyed by data-id.
   Rendered by initPlain() into a <details> under each ch-head.
   Every entry pairs an everyday example with the same idea in code.
   ------------------------------------------------------------ */
C.plain = {

welcome: {
  q: 'What even is LangGraph?',
  lay: {
    t: 'A board game engine for AI steps',
    b: 'LangGraph is a free Python package — something you install, not a website you sign up to. It is not an AI and it does not answer questions.\n\nWhat it does is run your steps in an order that can change while it runs. Go back a step. Wait for a person. Survive the server restarting and carry on from where it stopped.\n\nA chain is a recipe: front to back, once. LangGraph is a board game: squares that send you backwards, turns you can pause, and a save file. Same steps, different rules about how you move between them.'
  },
  tech: {
    t: 'An ordinary dependency',
    b: 'Installed with pip. You still call the model yourself; LangGraph only decides what runs next.',
    code: 'pip install langgraph\n\nfrom langgraph.graph import StateGraph, START, END\n\n# a node is a plain function. no base class, no decorator.\ndef greet(state):\n    return {"reply": "hello " + state["name"]}'
  }
},

why: {
  q: 'Chain or graph — how do I choose?',
  lay: {
    t: 'Two questions, and only two',
    b: 'Forget the diagrams. Ask two things about the job.\n\nFirst: does it ever need to go backwards? Checking the answer and trying again, retrying a failed step, an assistant that keeps looking things up until it is satisfied. All backwards.\n\nSecond: does it need to outlive the program? Waiting for a manager to approve something on Thursday, or picking up cleanly after the server restarts.\n\nBoth no — use a chain, it is smaller and there is nothing to configure. Either one yes — no amount of chain cleverness gets you there. You need a graph.'
  },
  tech: {
    t: 'What a chain physically cannot express',
    b: 'A pipe is a one-way street. There is no syntax for going back, and no place for the run to be saved.',
    code: '# chain: fine, and simpler. use this when you can.\nchain = prompt | model | parser\n\n# graph: needed the moment either answer is yes\ng.add_edge("rewrite", "retrieve")     # backwards\ngraph = g.compile(checkpointer=saver) # survives the process'
  }
},

state: {
  q: 'What is "state" and why does it need rules?',
  lay: {
    t: 'A clipboard passed around a team',
    b: 'One clipboard goes round the office. Each person reads it, writes their bit, hands it on. That clipboard is the state — the only thing every step shares.\n\nThe catch is what "writing your bit" means for each box. On the Name box you cross out the old value and write yours. On the Notes box you add a line at the bottom and leave everyone else’s alone.\n\nGet that backwards and you get the nastiest bug in LangGraph: a step overwrites the Notes box, four people’s notes vanish, nothing crashes, no error appears, and the answer is quietly wrong.'
  },
  tech: {
    t: 'The reducer decides how a key merges',
    b: 'Default is overwrite. Annotate with a reducer to append instead. Getting this wrong fails silently — nothing raises.',
    code: 'from typing import Annotated, TypedDict\nimport operator\n\nclass State(TypedDict):\n    question: str                                   # overwrite (default)\n    notes:    Annotated[list, operator.add]         # append\n\n# a node returns UPDATES, it does not mutate state:\ndef research(state):\n    return {"notes": ["found the pricing page"]}    # appended\n\n# drop the Annotated and this same line silently\n# throws away every earlier note.'
  }
},

nodes: {
  q: 'What is a node?',
  lay: {
    t: 'A person with an in-tray',
    b: 'Each node is one worker at one desk. The clipboard lands in their tray, they read what they need, do their one job, and write their result back on it.\n\nThey do not know who comes next. They do not know who came before. They just do their bit and put the clipboard down.\n\nWhich is why this is easier than it sounds: a node is an ordinary function. Nothing to inherit, nothing to register — which also means you can test one on its own, at your desk, with no AI involved at all.'
  },
  tech: {
    t: 'Takes the state, returns a dict of updates',
    b: 'That is the entire interface. No base class, no decorator — so a node is testable with a plain assert.',
    code: 'def grade(state):\n    good = len(state["docs"]) > 0\n    return {"verdict": "good" if good else "poor"}\n\ng.add_node("grade", grade)\ng.add_edge(START, "grade")\n\n# and the test needs no model, no network, no mocking:\nassert grade({"docs": []}) == {"verdict": "poor"}'
  }
},

routing: {
  q: 'How does it decide what runs next?',
  lay: {
    t: 'A receptionist reading your form',
    b: 'You hand in a form at reception. They glance at it and say "room 3". Not "yes". Not "true". The name of a room.\n\nThat is a conditional edge — a function that looks at the clipboard and returns where it should go next. Repair goes to room 3, returns go to room 5, complaints go to the manager, finished ones go out the front door.\n\nOnce that clicks, branching, looping and finishing stop being three separate features. They are all just the receptionist naming a different room.'
  },
  tech: {
    t: 'Return a node name, not a boolean',
    b: 'Same mechanism for branching, looping and ending. END is just another destination.',
    code: 'def decide(state):\n    if state["verdict"] == "good":\n        return "answer"          # a node name\n    if state["tries"] >= 3:\n        return END               # finishing is a destination too\n    return "rewrite"             # looping is a destination too\n\ng.add_conditional_edges("grade", decide)'
  }
},

cycles: {
  q: 'What happens if it loops forever?',
  lay: {
    t: 'Snakes and ladders needs a rule about giving up',
    b: 'Going back a square is the whole point — but a board with only snakes and no rule about quitting is a game nobody finishes.\n\nAn AI that grades its own answer, decides it is poor, rewrites the question, and tries again is exactly that board. Usually it improves and stops. Sometimes it decides every answer is poor, forever, and cheerfully bills you for each attempt.\n\nSo whoever adds the backwards arrow owns the stopping rule. That is the trade: you got the loop, and the loop is now yours to end.'
  },
  tech: {
    t: 'Own the stopping condition — twice',
    b: 'Your own counter for the sensible exit, and recursion_limit as the backstop that stops the bill.',
    code: 'def decide(state):\n    if state["tries"] >= 3:      # 1. your rule\n        return END\n    return "rewrite"\n\ng.add_edge("rewrite", "retrieve")     # the backwards edge\n\ngraph.invoke(inp, {"recursion_limit": 10})   # 2. the backstop\n# GraphRecursionError instead of an infinite bill'
  }
},

react: {
  q: 'Do I have to build the agent myself?',
  lay: {
    t: 'The loop comes ready-made in a box',
    b: 'An assistant with tools is always the same two rooms. Room one: think about it. Room two: go and look something up. Back to room one with what you found. Repeat until you can answer.\n\nYou could draw those two rooms yourself every time. Or take the one that comes in a box, already wired.\n\nAnd because what comes out of the box is an ordinary board — not some sealed appliance — everything else still works on it. Save files, pauses, live updates. It is a normal graph that someone else drew for you.'
  },
  tech: {
    t: 'Two nodes and one conditional edge, prebuilt',
    b: 'Returns an ordinary compiled graph, so checkpointers, interrupts, streaming and the store all still apply.',
    code: 'from langgraph.prebuilt import create_react_agent\n\nagent = create_react_agent(model, tools, checkpointer=saver)\n\nagent.invoke(\n    {"messages": [("user", "What is 17% of last month’s revenue?")]},\n    {"configurable": {"thread_id": "abc"}},\n)\n\n# identical to the graph you would have drawn:\n#   agent -> (tools needed?) -> tools -> back to agent -> END'
  }
},

scoped: {
  q: 'Why not give the agent every tool?',
  lay: {
    t: 'Which keys does the intern actually need?',
    b: 'A new intern needs the stationery cupboard key. You do not hand over the whole keyring including the server room, and then write a strongly worded note asking them not to go in there.\n\nBut that is precisely what "bind every tool to the model and tell it in the prompt to be careful" amounts to. On a good day it behaves. On a bad day it deploys to production during a research task, and you are left arguing with a prompt.\n\nA graph lets you hand each room its own small keyring. The researcher literally cannot deploy — not because you asked nicely, but because the key is not in the room.'
  },
  tech: {
    t: 'Bind different tools per node',
    b: 'Turns a prompt-engineering problem into something the wiring cannot express. Same for state: give every key exactly one writer.',
    code: 'def research(state):\n    return model.bind_tools([search, read_docs]).invoke(...)\n\ndef deploy(state):\n    return model.bind_tools([ship_it]).invoke(...)\n\n# the research node cannot call ship_it. not "should not" —\n# it was never handed to that model call.'
  }
},

persist: {
  q: 'What happens if the server restarts?',
  lay: {
    t: 'A save file after every move',
    b: 'A game that only exists in the console’s memory is lost the moment the power goes. A game that saves after every move is not.\n\nA checkpointer saves the clipboard after every step, filed under a run id. Nothing clever — just write it down each time.\n\nThat one boring habit is where the next three chapters come from. Resuming after a crash, pausing for a human, and rewinding to an earlier point are not three features. They are three things you get free once every moment has been written down.'
  },
  tech: {
    t: 'One argument at compile time',
    b: 'The full state is written after every super-step, keyed by thread_id. Same thread_id later = same conversation.',
    code: 'from langgraph.checkpoint.sqlite import SqliteSaver\n\ngraph = g.compile(checkpointer=SqliteSaver.from_conn_string("chk.db"))\n\ncfg = {"configurable": {"thread_id": "user-42"}}\ngraph.invoke({"question": "hi"}, cfg)\n\n# kill the process. start it again. same cfg:\ngraph.invoke({"question": "and then?"}, cfg)   # it remembers'
  }
},

hitl: {
  q: 'Can it stop and ask a person?',
  lay: {
    t: 'The form in the manager’s in-tray',
    b: 'An expense claim over £500 needs a signature. The claim does not get cancelled and it does not sit there with someone standing over it — it waits in a tray until Thursday, when the manager gets round to it.\n\nA graph can do the same, and it costs nothing while it waits. The process can exit. The server can be redeployed twice. Nothing is running, because the whole run is sitting in the save file.\n\nWhen the answer finally arrives, it carries on from the exact step where it paused. Approve, edit or reject — three different endings from the same paused moment.'
  },
  tech: {
    t: 'interrupt() pauses; the state is already saved',
    b: 'Not a sleeping thread — the run genuinely stops and lives in the checkpointer until you resume it.',
    code: 'from langgraph.types import interrupt, Command\n\ndef approval(state):\n    decision = interrupt({"amount": state["amount"]})   # stops here\n    return {"approved": decision == "yes"}\n\n# hours or days later, possibly a different process entirely:\ngraph.invoke(Command(resume="yes"), cfg)'
  }
},

timetravel: {
  q: 'Can I go back and change something?',
  lay: {
    t: 'Every save slot kept, not just the latest',
    b: 'Most games keep one save and overwrite it. This keeps every one — every move, its own slot, each with a name.\n\nSo when a run finishes badly, you do not start over. You load the slot from halfway through, change one thing, and play a different ending from there.\n\nThe original is untouched beside it. Both endings exist, from the same first half, which is how you find out whether the poor answer came from the search or from the question — instead of guessing.'
  },
  tech: {
    t: 'Every checkpoint has an id you can resume from',
    b: 'Fork from any past moment. The original branch stays intact next to the new one.',
    code: 'for snap in graph.get_state_history(cfg):\n    print(snap.config["configurable"]["checkpoint_id"], snap.next)\n\n# pick one from the middle, change a value, run a new future:\nforked = graph.update_state(old_cfg, {"question": "rephrased"})\ngraph.invoke(None, forked)'
  }
},

streaming: {
  q: 'Why does "streaming" not work?',
  lay: {
    t: 'Five different things people mean by "live"',
    b: 'A parcel delivery tells you several live things and they are not the same thing. Where the van is. Which depot it just left. The driver’s note. Each is a different feed, and asking for one and expecting another is why people say tracking is broken.\n\nA graph run is the same. It can tell you the words appearing one at a time, or which step just finished, or the whole clipboard as it stands, or your own progress messages.\n\nThey are separate feeds and you pick which. "Streaming does not work" is nearly always the right feed being asked of the wrong subscription.'
  },
  tech: {
    t: 'stream_mode picks the feed',
    b: 'Different modes answer different questions. Wanting typing-out-letter-by-letter and asking for "updates" is the usual mix-up.',
    code: 'for chunk in graph.stream(inp, cfg, stream_mode="updates"):\n    print(chunk)          # which node just finished, and what it wrote\n\nfor chunk in graph.stream(inp, cfg, stream_mode="messages"):\n    print(chunk)          # model tokens, one at a time <- "typing"\n\n# also: "values" (whole state), "custom" (your own events), "debug"\ngraph.stream(inp, cfg, stream_mode=["updates", "messages"])   # or several'
  }
},

multi: {
  q: 'How do I combine several agents?',
  lay: {
    t: 'A department is just an employee from outside',
    b: 'A manager hands work to "Legal". From the manager’s side Legal is one name on the org chart: send it there, get something back.\n\nInside, Legal is a whole team with its own desks and its own procedure. The manager neither knows nor cares.\n\nGraphs nest the same way, and there is no special API for it — because a finished graph takes a clipboard and returns updates, which is the exact description of a node. Multi-agent systems are that, plus a way to say "go here, and take this with you".'
  },
  tech: {
    t: 'A compiled graph is a node',
    b: 'Same shape in, same shape out — so it nests with no special API. Command routes and updates in one move.',
    code: 'legal = legal_builder.compile()\nparent.add_node("legal", legal)        # a whole graph, used as one node\n\nfrom langgraph.types import Command\n\ndef supervisor(state):\n    return Command(\n        goto="legal",                          # where next\n        update={"task": "check the contract"}, # and what to hand over\n    )'
  }
},

memory: {
  q: 'Why does it forget me in a new chat?',
  lay: {
    t: 'Save file vs player profile',
    b: 'A save file remembers this game — where you are, what is in your inventory. Start a new game and it knows nothing, which is correct. That is what a save file is for.\n\nYour player profile is different. Name, settings, achievements. It follows you across every game you start.\n\nThe checkpointer is the save file: this conversation. It is not memory of the person. "Prefers metric units" belongs in the profile — the store — or it dies with the chat and you ask them again next week.'
  },
  tech: {
    t: 'Checkpointer is per-thread; the store is not',
    b: 'Two different things. Facts that should outlive a conversation go in the store, scoped by namespace rather than thread.',
    code: 'from langgraph.store.memory import InMemoryStore\nstore = InMemoryStore()\n\nstore.put(("users", "42"), "prefs", {"units": "metric"})\n\ndef node(state, *, store):\n    prefs = store.get(("users", "42"), "prefs")   # survives new threads\n\ngraph = g.compile(checkpointer=saver, store=store)'
  }
},

ship: {
  q: 'What breaks in production?',
  lay: {
    t: 'Four ways, and only four',
    b: 'Almost every production problem is one of four, and all four are cheap to prevent and expensive to discover.\n\nThe clipboard got fat — every step appended, nobody trimmed, and now each save is enormous. The loop had no stopping rule and ran up a bill. A step that is not safe to repeat got repeated after a resume, and the customer was charged twice.\n\nAnd the quiet one: somebody renamed a room. Every saved game in flight pointed at the old name, and now none of them can resume.'
  },
  tech: {
    t: 'Trim, cap, make it re-runnable, never rename',
    b: 'Resume replays from the last checkpoint, so a node can run twice. Design for that rather than hoping.',
    code: '# 1. state grows -> trim, or the checkpoint table explodes\nmessages: Annotated[list, add_messages]   # + a trim step\n\n# 2. loops -> always pass a limit\ngraph.invoke(inp, {"recursion_limit": 10})\n\n# 3. side effects -> make the node safe to re-run\ncharge(order_id, idempotency_key=state["run_id"])\n\n# 4. node names are part of your saved data.\n#    renaming one breaks resume for every in-flight thread.'
  }
}

};
