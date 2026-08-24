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

// every ch1 task must be sortable into a bucket the UI actually renders
C.agencyTasks.forEach(t => assert(C.agencyLabels[t.a], `agencyTasks: unknown bucket "${t.a}"`));

// every loop step must use a kind the legend + trace styling know about,
// and every task must terminate — a loop demo with no exit teaches the wrong lesson
C.loopTasks.forEach(t => {
  t.steps.forEach(s => assert(C.loopKinds[s.k], `loopTasks: unknown step kind "${s.k}"`));
  assert(t.steps[t.steps.length - 1].k === 'final', `loopTask "${t.label}" never reaches a final answer`);
});

// tool queries must point at a tool that exists (or explicitly at none)
C.toolQueries.forEach(q => {
  if (q.pick === null) return;
  assert(C.tools.some(t => t.id === q.pick), `toolQueries: unknown tool "${q.pick}"`);
});

// plan dependencies must be backward-pointing, or the wave layout loops forever
C.planGoals.forEach(g => g.plan.forEach((s, i) =>
  s.dep.forEach(d => assert(d < i, `plan "${g.goal}" step ${i} depends on later step ${d}`))));

// memory routing must name real stores
const memKeys = new Set(C.memKinds.map(m => m.k));
C.memConvo.forEach(m => m.store.forEach(s => assert(memKeys.has(s), `memConvo: unknown store "${s}"`)));
C.memQuestions.forEach(q => assert(memKeys.has(q.a), `memQuestions: unknown store "${q.a}"`));

// reflection must actually improve, and flatten out — that is the lesson of the chapter
for (let i = 1; i < C.reflectRounds.length; i++) {
  assert(C.reflectRounds[i].score > C.reflectRounds[i - 1].score, `reflect round ${i} did not improve`);
}
const first = C.reflectRounds[1].score - C.reflectRounds[0].score;
const last = C.reflectRounds[C.reflectRounds.length - 1].score - C.reflectRounds[C.reflectRounds.length - 2].score;
assert(last < first, 'reflection gains must show diminishing returns');

// topology edges must reference declared nodes
C.topologies.forEach(t => {
  const ids = new Set(t.nodes.map(n => n.id));
  (t.edges || []).forEach(e => e.forEach(id => assert(ids.has(id), `topology "${t.k}": edge to unknown node "${id}"`)));
});

// guardrail verdicts must be one of the three the drill offers
C.guardActions.forEach(a => assert(['auto', 'ask', 'block'].includes(a.verdict),
  `guardActions: unknown verdict "${a.verdict}"`));
// anything irreversible must never be auto-approved — that is the whole chapter
C.guardActions.forEach(a => assert(a.reversible || a.verdict !== 'auto',
  `guardActions: irreversible action "${a.t}" is marked auto`));

// the compounding maths the chapter claims must hold
assert(Math.abs(Math.pow(0.95, 20) - 0.3585) < 0.01, '0.95^20 is not ~36% — the quiz answer is wrong');

// eval runs must exercise all four outcome/trajectory combinations
const combos = new Set(C.evalRuns.map(r => r.outcome + '/' + r.trajectory));
assert(combos.size === 4, `evalRuns should cover all 4 pass/fail combinations, got ${combos.size}`);

// MCP: every frame that claims to be JSON-RPC must actually parse, or the
// chapter is teaching malformed protocol
const MCP_DIRS = ['c2s', 's2c', 'host', 'model', 'err'];
C.mcpFrames.forEach((f, i) => {
  assert(MCP_DIRS.includes(f.dir), `mcpFrames[${i}]: unknown direction "${f.dir}"`);
  assert(f.m && f.n && f.tag, `mcpFrames[${i}]: needs a method, a tag and a note`);
  if (!f.j.trim().startsWith('{')) return;                 // code sample, not a frame
  let parsed;
  try { parsed = JSON.parse(f.j); }
  catch (e) { assert.fail(`mcpFrames[${i}] (${f.m}) is not valid JSON: ${e.message}`); }
  if (parsed.jsonrpc) {
    assert(parsed.jsonrpc === '2.0', `mcpFrames[${i}]: wrong jsonrpc version`);
    // requests carry an id and a method; notifications carry a method and no id
    if (parsed.method) assert(!('result' in parsed), `mcpFrames[${i}]: both method and result`);
    else assert('id' in parsed, `mcpFrames[${i}]: a result must echo the request id`);
  }
});
// the session must show the handshake before anything else, and all three of
// request / notification / result — that is the whole point of the walkthrough
assert(C.mcpFrames[0].m === 'initialize', 'the MCP session must open with initialize');
assert(C.mcpFrames.some(f => f.m === 'tools/list'), 'no discovery frame in the MCP session');
assert(C.mcpFrames.some(f => f.m === 'tools/call'), 'no tool call in the MCP session');
assert(C.mcpFrames.some(f => f.dir === 'err'), 'no error frame — the failure path is half the lesson');
C.mcpPrimitives.forEach(p => assert(p.h && p.who && p.c, 'mcpPrimitives entries need a name, an owner and code'));
assert(C.mcpCode.length >= 5, 'the MCP chapter should carry the full worked example set');

// every id the demos reach for must exist somewhere, or a chapter is quietly dead
const demos = fs.readFileSync('js/demos.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
// ids built by concatenation ('#c-' + name) end in a dash — not a real id, skip them
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

console.log('ok — content data is consistent');
