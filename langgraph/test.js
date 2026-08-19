/* Smallest check that fails if the course data rots.
   Run: node test.js                                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

// quiz answers must index a real option
C.quiz.forEach((q, i) => assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`));

// ch1: every task sorts into a bucket the UI renders, and both buckets are used
C.shapeTasks.forEach(t => assert(C.shapeLabels[t.a], `shapeTasks: unknown bucket "${t.a}"`));
assert(new Set(C.shapeTasks.map(t => t.a)).size === 2, 'ch1 must exercise both chain and graph');

// ch2: node returns must be valid JSON, and only touch keys the demo's state declares
const STATE_KEYS = new Set(['question', 'steps', 'docs', 'relevant']);
C.stateUpdates.forEach(u => {
  const parsed = JSON.parse(u.ret);
  Object.keys(parsed).forEach(k => assert(STATE_KEYS.has(k), `stateUpdates: unknown key "${k}"`));
  assert(Array.isArray(parsed.steps), `${u.node} must return a steps list for the reducer demo to mean anything`);
});
// the lesson only lands if "no reducer" and "add" produce different results
assert(C.reducers.some(r => r.k === 'none') && C.reducers.some(r => r.k === 'add'),
  'the reducer demo needs both the overwrite and the append case');
assert(C.stateUpdates.length > 1, 'need at least two node returns to show a reducer doing anything');

// ch4: routers must target nodes the branch strip renders
const ROUTE_TARGETS = new Set(['run_sql', 'retrieve', 'review', 'generate']);
C.routerCases.forEach(c => assert(ROUTE_TARGETS.has(c.node), `routerCases: unknown target "${c.node}"`));
assert(new Set(C.routerCases.map(c => c.node)).size === ROUTE_TARGETS.size,
  'every routing branch should be demonstrated at least once');

// ch5: the cycle must reference real nodes, actually cycle, and terminate
const cycleIds = new Set(C.cycleNodes.map(n => n.id));
C.cycleEdges.forEach(e => {
  assert(cycleIds.has(e[0]) && cycleIds.has(e[1]), `cycleEdges: ${e[0]}->${e[1]} references an unknown node`);
});
C.cycleRun.forEach(r => assert(cycleIds.has(r.node), `cycleRun visits unknown node "${r.node}"`));
assert(C.cycleRun.filter(r => r.node === 'retrieve').length > 1,
  'the cycle demo must pass through retrieve twice or it does not show a cycle');
assert(C.cycleRun[C.cycleRun.length - 1].node === 'END', 'the cycle demo must terminate');
// attempts must never exceed the guard the chapter's code claims stops it
const guard = 2;
C.cycleRun.forEach(r => assert(r.state.attempts <= guard,
  `cycleRun reaches attempts=${r.state.attempts}, above the attempts>=${guard} guard in cycleCode`));
// and it must not need the recursion limit to stop: default limit is 25
assert(C.cycleRun.length < 25, 'the demo run must finish well inside the default recursion_limit');

// ch6: the prebuilt agent trace must alternate through the two real nodes and terminate
C.reactTrace.forEach(s => {
  if (s.k === 'ai' || s.k === 'final') assert(s.node === 'agent', `${s.k} step should run in the agent node`);
  if (s.k === 'tool') assert(s.node === 'tools', 'tool results come from the tools node');
});
assert(C.reactTrace[C.reactTrace.length - 1].k === 'final', 'react trace never reaches a final answer');
// every tool call must be answered by a ToolMessage, or the loop would not be valid
const calls = C.reactTrace.filter(s => s.tool).length;
const results = C.reactTrace.filter(s => s.k === 'tool').length;
assert(calls === results, `${calls} tool calls but ${results} tool results — the message list is malformed`);

// ch7: two threads, and the same question asked in both — that is the whole point
const threads = new Set(C.threadTurns.map(t => t.th));
assert(threads.size === 2, 'the thread demo needs exactly two threads to show isolation');
const dup = C.threadTurns.filter(t => t.u === C.threadTurns[1].u);
assert(dup.length === 2 && dup[0].th !== dup[1].th,
  'both threads must ask one identical question for the isolation point to land');
assert(C.savers.some(s => !s.prod) && C.savers.some(s => s.prod), 'list both a dev and a production checkpointer');

// ch8: all three outcomes exist and land where the chapter says they do
['approve', 'edit', 'reject'].forEach(k => assert(C.hitlOutcomes[k], `hitlOutcomes missing "${k}"`));
assert(C.hitlSteps[C.hitlSteps.length - 1].node === 'review', 'the graph must pause at the review node');
['approve', 'edit'].forEach(k => {
  const tail = C.hitlOutcomes[k].tail;
  assert(tail.some(s => s.node === 'send' && s.state.sent === true), `"${k}" must reach send`);
});
const rejectTail = C.hitlOutcomes.reject.tail;
assert(rejectTail.some(s => s.node === 'draft'), 'reject must route back to draft, not end the run');
assert(rejectTail.every(s => !s.state.sent), 'nothing may be sent on the reject path');
assert(rejectTail[0].state.feedback, 'reject must carry a reason back into state');

// ch9: the fork must start from a real checkpoint, before the value it changes is used
assert(C.ttHistory[C.ttFork.fromIndex], `ttFork.fromIndex ${C.ttFork.fromIndex} is not a real checkpoint`);
const editedKey = Object.keys(C.ttFork.edit)[0];
assert(C.ttHistory[C.ttFork.fromIndex].vals[editedKey] !== C.ttFork.edit[editedKey],
  'forking must actually change the value, or the demo shows nothing');
assert(C.ttHistory[C.ttFork.fromIndex].vals.rows === null,
  'fork before the SQL runs, otherwise the changed region would not alter the result');
const forkEnd = C.ttFork.branch[C.ttFork.branch.length - 1].vals;
const mainEnd = C.ttHistory[C.ttHistory.length - 1].vals;
assert(forkEnd.answer !== mainEnd.answer, 'the forked branch must reach a different answer');

// ch10: every stream mode carries example events, and "messages" is the token-level one
C.streamModes.forEach(m => assert(m.events.length, `stream mode ${m.name} has no example events`));
const msgs = C.streamModes.find(m => m.k === 'messages');
assert(msgs && msgs.events.every(e => e.includes('AIMessageChunk')),
  '"messages" mode must show token chunks — that is what distinguishes it');

// ch11: handoffs must reference real nodes, route through the supervisor, and end
const multiIds = new Set(C.multiNodes.map(n => n.id));
C.multiSteps.forEach(s => {
  assert(multiIds.has(s.from) && multiIds.has(s.to), `multiSteps: ${s.from}->${s.to} references an unknown node`);
  assert(s.from === 'supervisor' || s.to === 'supervisor',
    `handoff ${s.from}->${s.to} bypasses the supervisor, which is not the pattern being taught`);
});
assert(C.multiSteps[C.multiSteps.length - 1].to === 'END', 'the handoff demo must terminate');

// ch12: nothing may be read from a namespace nothing was written to
const ns = a => (a.match(/\(\("([^"]+)",\s*"([^"]+)"\)/) || []).slice(1).join('/');
const written = new Set();
C.memOps.forEach(o => {
  const n = ns(o.args);
  assert(n, `memOps: could not parse a namespace out of ${o.args}`);
  if (o.op === 'put') written.add(n);
  else assert(written.has(n), `memOps: ${o.op} reads namespace ${n} before anything was put there`);
});
// the collision point of the chapter: one key name reused across namespaces
const puts = C.memOps.filter(o => o.op === 'put').map(o => (o.args.match(/,\s*"([^"]+)",\s*\{/) || [])[1]);
assert(puts.length !== new Set(puts).size, 'reuse one key name across namespaces, or the isolation point is not shown');

console.log('ok — content data is consistent');
