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


// ---- ch7: scoped tools. The chapter's whole argument is that the scoped run
// and the unscoped run differ only in which tools were reachable, so the data
// has to actually encode that.
{
  const phases = new Set(C.lgsPhases.map(p => p.id));
  const byName = {};
  C.lgsTools.forEach(t => { byName[t.n] = t; });

  // every phase must own tools, or scoping that node binds nothing
  C.lgsPhases.forEach(p => assert(C.lgsTools.some(t => t.ph === p.id),
    `phase "${p.id}" has no tools, so the scoped graph would bind an empty set`));

  // the dangerous tools must sit OUTSIDE every phase, or the scoped run could
  // legally reach them and the demo proves nothing
  C.lgsTools.filter(t => t.danger).forEach(t => assert(!phases.has(t.ph),
    `dangerous tool ${t.n} is scoped into phase "${t.ph}" — the scoped run could call it`));
  assert(C.lgsTools.some(t => t.danger), 'without a dangerous tool the unscoped run has no consequence to show');

  // every step names a real phase, and every tool call it makes is one that
  // phase can produce — except the wide-only steps, which by definition cannot
  C.lgsRun.forEach((s, i) => {
    assert(phases.has(s.ph), `lgsRun[${i}] runs in unknown phase "${s.ph}"`);
    const fn = s.act.split('(')[0];
    const tool = byName[fn];
    assert(tool, `lgsRun[${i}] calls ${fn}, which is not in C.lgsTools`);
    if (s.wide) assert(tool.ph !== s.ph,
      `lgsRun[${i}] is marked wide-only but ${fn} is in scope for "${s.ph}" — it would happen either way`);
    else assert(tool.ph === s.ph,
      `lgsRun[${i}] calls ${fn} from "${s.ph}", which the scoped graph would not allow`);
  });

  // the wide-only steps are the payoff; there has to be more than one, and each
  // needs the explanation the demo renders
  const wide = C.lgsRun.filter(s => s.wide);
  assert(wide.length >= 2, 'the unscoped run needs at least two extra steps to be worth showing');
  wide.forEach(s => assert(s.note && s.bad, `wide-only step "${s.act}" is missing its note or bad flag`));

  // every state key a step writes must be declared, and declared to that node
  const schema = {};
  C.lgsSchema.forEach(r => { schema[r.k] = r.w; });
  const writable = {};
  C.lgsPhases.forEach(p => { writable[p.id] = new Set(p.writes); });
  C.lgsRun.forEach((s, i) => Object.keys(s.w || {}).forEach(k => {
    assert(schema[k], `lgsRun[${i}] writes "${k}", which C.lgsSchema does not declare`);
    assert(writable[s.ph].has(k),
      `lgsRun[${i}] writes "${k}" from "${s.ph}", but that node's write list does not include it`);
    assert(schema[k] === s.ph || schema[k] === 'every node',
      `C.lgsSchema says "${k}" is written by ${schema[k]}, but lgsRun[${i}] writes it from ${s.ph}`);
  }));

  // the scoped run has to actually finish: tests pass, then a PR
  const scoped = C.lgsRun.filter(s => !s.wide);
  const last = scoped[scoped.length - 1];
  assert(last.w && last.w.pr, 'the scoped run does not end with a PR, so it never demonstrates completion');
  assert(scoped.some(s => s.w && s.w.test_result === 'pass'),
    'nothing in the scoped run ever reaches a passing test — the exit condition is never met');

  // the graph the demo draws must be connected to the phases it steps through
  const nodeIds = new Set(C.lgsNodes.map(n => n.id));
  C.lgsEdges.forEach(e => assert(nodeIds.has(e[0]) && nodeIds.has(e[1]),
    `lgsEdges: ${e[0]}->${e[1]} references a node that does not exist`));
  C.lgsPhases.forEach(p => assert(nodeIds.has(p.id),
    `phase "${p.id}" has no node in C.lgsNodes, so stepping into it lights nothing`));

  // scoping has to be a real token saving, since the panel prints the number
  const all = C.lgsTools.reduce((a, t) => a + t.tk, 0);
  C.lgsPhases.forEach(p => {
    const some = C.lgsTools.filter(t => t.ph === p.id).reduce((a, t) => a + t.tk, 0);
    assert(some < all / 2, `scoping to "${p.id}" saves less than half the schema tokens`);
  });
}

// every id the demos reach for must exist somewhere, or a chapter is quietly dead
{
  const demosSrc = fs.readFileSync('js/demos.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = new Set();
  // ids built by concatenation ('#c-' + name) end in a dash — not a real id, skip them
  for (const m of demosSrc.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
  ids.forEach(id => assert(html.includes('id="' + id + '"') || demosSrc.includes('id="' + id + '"'),
    `demos.js targets #${id}, which nothing ever creates`));
}


// plain-English openers: every chapter bar the quiz must have one, and each must be
// complete — a half-filled entry renders as an empty column instead of failing loudly
{
  const html = fs.readFileSync('index.html', 'utf8');
  const chapters = [...html.matchAll(/<section class="chapter" data-id="([a-z0-9-]+)"/g)].map(m => m[1]);
  assert(chapters.length > 5, 'could not read the chapter list out of index.html');

  chapters.filter(id => id !== 'quiz').forEach(id => {
    const p = C.plain[id];
    assert(p, `chapter "${id}" has no C.plain entry — it would render with no plain-English opener`);
    [['q', p.q], ['lay.t', p.lay && p.lay.t], ['lay.b', p.lay && p.lay.b],
     ['tech.t', p.tech && p.tech.t], ['tech.b', p.tech && p.tech.b],
     ['tech.code', p.tech && p.tech.code]
    ].forEach(([name, v]) =>
      assert(typeof v === 'string' && v.trim(), `C.plain.${id} is missing ${name}`));
    assert(p.tech.code.includes('\n'),
      `C.plain.${id}.tech.code is a single line — the technical half needs a real example`);
  });

  Object.keys(C.plain).forEach(id =>
    assert(chapters.includes(id), `C.plain."${id}" matches no chapter — it can never render`));
}

/* ---- tools & frameworks strips ---- */
/* Every strip mounted in the page must have data, every strip with data must be
   mounted, and every tool must carry both advantages and drawbacks — a one-sided
   tool card is marketing, not a study note. */
{
  const tsHtml = fs.readFileSync('index.html', 'utf8');
  vm.runInContext(fs.readFileSync('js/tools.js', 'utf8'), ctx);
  const TS = ctx.window.C.toolstrips || {};
  const mounted = [...tsHtml.matchAll(/data-toolstrip="([a-z0-9-]+)"/g)].map(m => m[1]);
  mounted.forEach(k => assert(TS[k], `index.html mounts a tools strip "${k}" with no data in js/tools.js`));
  Object.keys(TS).forEach(k => {
    assert(mounted.includes(k), `js/tools.js defines strip "${k}" that the page never renders`);
    const s = TS[k];
    assert(s.tools.length >= 3, `tools strip "${k}" has fewer than three tools`);
    s.tools.forEach(t => {
      ['n', 'by', 'mark', 'what', 'use'].forEach(f =>
        assert(t[f] && String(t[f]).trim(), `tools strip "${k}": ${t.n || '?'} is missing ${f}`));
      assert(t.pro && t.pro.length >= 2, `tools strip "${k}": ${t.n} needs at least two advantages`);
      assert(t.con && t.con.length >= 2, `tools strip "${k}": ${t.n} needs at least two drawbacks`);
    });
  });
  if (mounted.length) console.log(`  ${mounted.length} tools strips, ` +
    `${Object.values(TS).reduce((a, s) => a + s.tools.length, 0)} tools with advantages and drawbacks`);
}

console.log('ok — content data is consistent');
