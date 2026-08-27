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

// prompt caching in an agent loop: re-derived from the same model initShip uses.
// The claim the chapter makes is that a loop is the best-shaped workload for it,
// so the saving has to be large — and it must not touch the output side at all.
{
  const bill = (n, tin, tout, disc) => {
    let full = 0, billed = 0;
    for (let k = 0; k < n; k++) {
      const stepIn = tin + k * (tout + 200);
      const cached = k === 0 ? tin * 0.8 : tin + (k - 1) * (tout + 200);
      full += stepIn;
      billed += (stepIn - cached) + cached * disc;
    }
    return { full, billed };
  };
  const r = bill(7, 1500, 250, 0.1);
  assert(r.billed < r.full / 3,
    `caching a 7-step loop should cut billed input to well under a third: ${Math.round(r.billed)} of ${r.full}`);
  // no cache discount means no saving — the model must not be flattering itself
  const none = bill(7, 1500, 250, 1);
  assert(Math.abs(none.billed - none.full) < 1e-9, 'a 100% billing rate must be identical to no caching');
  // and the saving must grow with trajectory length, since the prefix grows with it
  const short = bill(2, 1500, 250, 0.1), long = bill(14, 1500, 250, 0.1);
  assert(1 - long.billed / long.full > 1 - short.billed / short.full,
    'longer trajectories must benefit more from caching, not less');
}


// ---- ch4: the naive-loop chapter makes claims with numbers on them.
// The simulation is re-derived here, independently of demos.js, because a
// chapter that says "7x cheaper" has to still be true after someone edits
// C.nlModel.
{
  const M = C.nlModel;
  const lcg = seed => { let s = (seed * 1103515245 + 12345) >>> 0;
    return () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }; };
  function sim(g, seed) {
    const rnd = lcg(seed);
    const cap = g.budget ? M.budgetSteps : M.hardCap;
    let ctx = M.ctx0, tokens = 0, prog = 0, step = 0;
    while (step < cap) {
      step++;
      tokens += ctx;
      const hp = Math.min(M.hpMax, ctx * M.hpPerToken);
      const p = Math.min(0.95, Math.max(0.05,
        M.p0 - hp - (g.scope ? M.tcScoped : M.tcAll) - (g.state ? 0 : M.statePenalty)));
      const ok = rnd() < p;
      prog = ok ? prog + 1 : Math.max(0, prog - 1);
      ctx += M.obsTokens + (ok ? 0 : M.wrongTokens);
      if (g.compact) ctx = Math.min(ctx, M.ctxCap);
      if (g.verify) { if (prog >= M.need) return { o: 'done', tokens }; }
      else if (rnd() < M.pDeclare) return { o: prog >= M.need ? 'done' : 'shipped', tokens };
    }
    return { o: g.budget ? 'escalated' : 'runaway', tokens };
  }
  const agg = g => {
    const t = { done: 0, shipped: 0, escalated: 0, runaway: 0 };
    let tokens = 0;
    for (let s = 1; s <= 400; s++) { const r = sim(g, s); t[r.o]++; tokens += r.tokens; }
    return { t, tokens: tokens / 400, perDone: t.done ? tokens / t.done : Infinity };
  };
  const guards = on => ({ verify: on, scope: on, compact: on, state: on, budget: on });

  // the guard ids in the content must be exactly the levers the model reads,
  // or a toggle in the UI does nothing and nobody notices
  const levers = ['verify', 'scope', 'compact', 'state', 'budget'].sort().join(',');
  assert(C.nlGuards.map(g => g.id).sort().join(',') === levers,
    'C.nlGuards no longer matches the guards the simulation implements');

  const naive = agg(guards(0)), all = agg(guards(1));

  // claim 1: the naive loop mostly ships wrong answers with a "done" on them
  assert(naive.t.shipped / 400 > 0.6,
    `the naive loop only ships bugs on ${(naive.t.shipped / 4).toFixed(0)}% of runs — the chapter's premise is gone`);

  // claim 2: all five guards actually finish the task most of the time
  assert(all.t.done / 400 > 0.7,
    `with every guard on only ${(all.t.done / 4).toFixed(0)}% of runs finish`);
  assert(all.t.shipped === 0, 'a verified loop must never silently ship an unfinished task');

  // claim 3: the headline. Cost per FINISHED task, which is the only cost that
  // means anything, falls by a lot. Average cost per run does not — and the
  // chapter says so out loud, so check that stays true too.
  assert(naive.perDone / all.perDone > 3,
    `guards only improve tokens-per-finished-task by ${(naive.perDone / all.perDone).toFixed(1)}x`);
  assert(naive.tokens < all.tokens,
    'the naive loop is no longer cheaper per run, so the "cheap because it gives up" point no longer lands');

  // claim 4: the callout under the demo — verification with no budget converts
  // silent failure into expensive failure. It must be worse per finished task
  // than turning everything on.
  {
    const only = agg({ verify: 1, scope: 0, compact: 0, state: 0, budget: 0 });
    assert(only.t.shipped === 0, 'verification alone must at least stop the silent ships');
    assert(only.t.runaway > 0, 'verification with no budget must produce runaways — that is the callout');
    assert(only.perDone > all.perDone * 2,
      'verification-only is no longer dramatically more expensive per finished task');
  }

  // the flowchart has to be a real graph, or the animation walks off the edge
  const nodeIds = new Set(C.nlNodes.map(n => n.id));
  C.nlEdges.forEach(e => {
    assert(nodeIds.has(e.a) && nodeIds.has(e.b), `nlEdges: ${e.a}->${e.b} references a node that does not exist`);
  });
  ['gen', 'check', 'fix', 'grow', 'hall', 'worse', 'declare', 'ship'].forEach(id =>
    assert(nodeIds.has(id), `the run animation lights #${id}, which C.nlNodes does not define`));
  Object.keys(C.nlOutcomes).forEach(k =>
    assert(C.nlOutcomes[k].n && C.nlOutcomes[k].c, `outcome ${k} is missing a label or colour`));
}

// ---- ch4b: tool scoping. Two monotonic claims, both easy to break by editing
// C.tsModel, both load-bearing for the panel's copy.
{
  const M = C.tsModel;
  const acc = k => Math.max(M.floor, Math.min(0.99, M.baseAcc - M.decay * Math.log2(Math.max(1, k) / 4)));

  for (let k = 4; k < 20; k++)
    assert(acc(k + 1) <= acc(k), `tool accuracy is not monotonically falling at ${k} tools`);

  // scoping has to be worth doing at the sizes the slider actually reaches
  const phases = {};
  C.tsTools.forEach(t => { phases[t.ph] = (phases[t.ph] || 0) + 1; });
  C.tsPhases.forEach(p => assert(phases[p.id] >= 3,
    `phase "${p.id}" has ${phases[p.id] || 0} tools — the scoped demo needs at least 3`));

  // every phase must be populated at the slider's minimum, or scoping shows an
  // empty tool list and the accuracy maths divides by nothing
  const MIN = 11;
  C.tsPhases.forEach(p => assert(C.tsTools.slice(0, MIN).some(t => t.ph === p.id),
    `phase "${p.id}" has no tool inside the first ${MIN}, which is the slider minimum`));

  const scopedRun = Math.pow(acc(C.tsTools.slice(0, 20).filter(t => t.ph === 'act').length), M.steps);
  const wideRun = Math.pow(acc(20), M.steps);
  assert(scopedRun > wideRun * 2,
    `scoping only improves the clean-run rate from ${(wideRun * 100).toFixed(0)}% to ${(scopedRun * 100).toFixed(0)}% — not worth a panel`);

  // the demo warns that dangerous tools sit on the menu during a code task;
  // they have to actually be in the list for that warning to be honest
  const names = new Set(C.tsTools.map(t => t.n));
  ['refund_charge', 'deploy_prod'].forEach(n =>
    assert(names.has(n), `the scoping copy names ${n}, which is not in C.tsTools`));
}

// every C.* key the demos read must exist, or a panel renders empty and nobody notices
{
  const demosSrc = fs.readFileSync('js/demos.js', 'utf8');
  const keys = new Set([...demosSrc.matchAll(/\bC\.([A-Za-z0-9_]+)/g)].map(m => m[1]));
  keys.forEach(k => assert(C[k] !== undefined, `demos.js reads C.${k}, which content.js does not define`));
}

// every id the demos reach for must exist somewhere, or a chapter is quietly dead
const demos = fs.readFileSync('js/demos.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
// ids built by concatenation ('#c-' + name) end in a dash — not a real id, skip them
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

/* ============================================================
   Ch15-16 — harness engineering and the failure playbook.
   These guard the claims the chapters make, because they are
   claims about ordering and completeness rather than arithmetic.
   ============================================================ */
{
  // the diagram draws one bar per layer against the largest; weights must be a real ranking
  const L = C.harnessLayers;
  assert(L.length >= 5, 'the harness diagram needs at least five layers to be worth drawing');
  const total = L.reduce((a, l) => a + l.weight, 0);
  assert(Math.abs(total - 1) < 0.02, `harness layer weights sum to ${total.toFixed(2)}, not 1`);
  assert(L[0].weight === Math.max(...L.map(l => l.weight)),
    'the layers must be ordered most-impactful first, because the chapter presents them that way');
  L.forEach(l => ['q', 'lay', 'tech', 'bad', 'good', 'icon'].forEach(k =>
    assert(l[k], `harness layer "${l.n}" is missing "${k}"`)));
  // the chapter's central claim is that prompt wording is NOT one of the layers
  assert(!L.some(l => /^prompt/i.test(l.n)),
    'the chapter argues the harness is not prompt engineering; a layer called "prompt" undercuts it');

  // the twins panel: every row must differ and must carry its reason
  const T = C.harnessTwins;
  assert(T.rows.length >= 5, 'the twins comparison needs enough rows to make the point');
  T.rows.forEach(r => {
    assert(r.a !== r.b, `twins row "${r.layer}" shows the same thing on both sides`);
    assert(r.b.length > r.a.length, `twins row "${r.layer}": the strong version should be the more specific one`);
    assert(r.why && r.why.length > 60, `twins row "${r.layer}" needs an explanation, not just a diff`);
  });
  // and none of the differences may be a prompt change, or the chapter's thesis is false
  assert(!T.rows.some(r => /system prompt/i.test(r.layer)),
    'the twins are supposed to differ in code, not in the prompt');

  assert(C.harnessPatterns.length >= 8, 'the chapter promises nine harness patterns');
  C.harnessPatterns.forEach(p => assert(p.when, `pattern "${p.n}" needs a "use it when"`));
}

{
  // the playbook must cover every failure the chapter's heading claims
  const need = ['empty', 'lowret', 'timeout', 'rate', 'toolong', 'cost', 'lowans'];
  need.forEach(id => assert(C.playbook.some(p => p.id === id), `the playbook is missing "${id}"`));
  C.playbook.forEach(p => {
    assert(p.right.length >= 3, `"${p.n}" needs at least three concrete actions`);
    assert(p.wrong, `"${p.n}" must name the wrong thing people actually do`);
    assert(p.metric, `"${p.n}" must name a number to alarm on`);
    assert(['critical', 'high', 'medium'].includes(p.sev), `"${p.n}" has an unknown severity`);
  });
  // exactly the money one should be critical — that is the ranking the cards render
  assert(C.playbook.filter(p => p.sev === 'critical').map(p => p.id).join() === 'cost',
    'cost runaway should be the one critical failure; nothing else can bankrupt you silently');

  // context rot: causes are drawn as shares of real cases, ordered most-likely first
  const R = C.contextRot;
  const s = R.causes.reduce((a, c) => a + c.share, 0);
  assert(Math.abs(s - 1) < 0.02, `context-rot shares sum to ${s.toFixed(2)}, not 1`);
  assert(R.causes[0].share === Math.max(...R.causes.map(c => c.share)),
    'context-rot causes must be ordered most-likely first');
  assert(R.causes[0].n.toLowerCase().includes('truncation'),
    'the chapter says silent truncation is the most common cause; the data should agree');
  R.causes.forEach(c => assert(c.fix && c.fix.length > 40, `context-rot cause "${c.n}" needs a real fix`));

  // the budget is rendered as a 100% stacked bar — it must actually total 100
  const b = R.budget.reduce((a, x) => a + x.pct, 0);
  assert(b === 100, `the context budget sums to ${b}%, so the stacked bar would lie`);
  R.budget.forEach(x => assert(x.policy, `budget band "${x.n}" has no trimming policy`));
  // headroom for the answer must be reserved, which is the point of the panel
  assert(R.budget.some(x => /headroom/i.test(x.n) && x.pct >= 10),
    'the budget must reserve real headroom for the answer');
  // and the two pinned bands must exist, because every fix in the chapter depends on them
  assert(R.budget.filter(x => /pinned/i.test(x.policy)).length >= 2,
    'the system prompt and the task must both be pinned, or the trimming advice is unimplementable');
}

console.log('ok — content data is consistent');
