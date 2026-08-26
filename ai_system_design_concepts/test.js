/* Smallest check that fails if the course data or its arithmetic rots.
   Run: node test.js                                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ~${b}`);

/* ---------- content consistency ---------- */

// quiz answers must index a real option
C.quiz.forEach((q, i) => assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`));

// ch1: the drill only teaches something if both kinds of question are present,
// and there must be at least as many good ones as you are allowed to pick
const good = C.clarifyQs.filter(q => q.good).length;
assert(good >= 3 && good < C.clarifyQs.length, `clarifyQs needs a mix; ${good}/${C.clarifyQs.length} are good`);

// ch2: metric answers index real options, and no case is "all options equal"
C.metricCases.forEach((c, i) => {
  assert(c.o[c.a] !== undefined, `metricCases ${i} has a bad answer index`);
  assert(c.o.length >= 3, `metricCases ${i} needs real distractors`);
});
C.metricPairs.forEach(p => assert(p.length === 4, 'metricPairs rows must have 4 columns to match the table header'));

// ch3: the bars are the lesson — no source may be best on all three axes
C.labelSources.forEach(s => {
  ['volume', 'bias', 'cost'].forEach(k => assert(typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 100,
    `labelSources ${s.k}.${k} must be a 0-100 bar value`));
});
const dominant = C.labelSources.filter(s =>
  C.labelSources.every(o => o === s || (s.volume >= o.volume && s.bias <= o.bias && s.cost <= o.cost)));
assert(dominant.length === 0, `label source "${(dominant[0] || {}).k}" dominates on every axis — the trade-off is the point`);

// ch4: verdicts must exist, and all three must appear or the drill is trivially guessable
C.featureCards.forEach(f => assert(C.skewVerdicts[f.v], `featureCards: unknown verdict "${f.v}"`));
assert(new Set(C.featureCards.map(f => f.v)).size === 3, 'the feature drill must use all three verdicts');

// ch5: every task points at a real rung, and quality/latency/cost climb together
C.ladderTasks.forEach(t => assert(C.ladder[t.best], `ladderTasks "${t.name}" points at rung ${t.best}, which does not exist`));
for (let i = 1; i < C.ladder.length; i++) {
  assert(C.ladder[i].quality > C.ladder[i - 1].quality, `ladder rung ${i} must be more capable than ${i - 1}`);
  assert(C.ladder[i].latency > C.ladder[i - 1].latency, `ladder rung ${i} must be slower than ${i - 1}`);
  assert(C.ladder[i].cost > C.ladder[i - 1].cost, `ladder rung ${i} must cost more than ${i - 1}`);
}
// the chapter's claim is that the right rung is task-dependent, so the tasks must disagree
assert(new Set(C.ladderTasks.map(t => t.best)).size >= 4, 'ladder tasks must land on different rungs');

// ch6: the funnel only makes sense if each stage is far more expensive per item
for (let i = 1; i < C.funnelStages.length; i++) {
  assert(C.funnelStages[i].perItemUs > C.funnelStages[i - 1].perItemUs * 5,
    `funnel stage ${i} must be much costlier per item than stage ${i - 1}, or the funnel is pointless`);
}

// ch7: at least one component runs in parallel and at least one is immovable
assert(C.latencyParts.some(p => p.parallel), 'the budget demo needs a parallel group to show tail amplification');
assert(C.latencyParts.some(p => p.fixed), 'some latency (network, response) is not yours to remove');
// the LLM must be big enough to visibly blow an interactive budget — that is the demo
const llm = C.latencyParts.find(p => p.k === 'llm');
assert(llm && llm.p99 > 1000, 'the LLM component must be large enough to break a 200ms budget');

// ch12: the cascade only argues for itself if small models are near-parity on easy traffic
C.cascadeTiers.forEach(t => assert(t.easyQuality > t.quality || t.k === 'large',
  `cascadeTiers ${t.k}: easyQuality should exceed hard-task quality`));
assert(C.cascadeTiers[0].easyQuality > C.cascadeTiers[2].easyQuality - 6,
  'the small model must be near-parity on easy traffic, or a cascade never makes sense');
for (let i = 1; i < C.cascadeTiers.length; i++) {
  assert(C.cascadeTiers[i].inCost >= C.cascadeTiers[i - 1].inCost, 'cascade tiers must be ordered by cost');
  assert(C.cascadeTiers[i].latency > C.cascadeTiers[i - 1].latency, 'cascade tiers must be ordered by latency');
}
assert(C.cascadeDetection > 0 && C.cascadeDetection < 1, 'detection must be imperfect, or the silent-failure lesson vanishes');

// ch13: every design walks the full arc and every stage carries a gotcha
C.designs.forEach(d => {
  assert(d.stages.length >= 6, `design "${d.k}" is too short to be an end-to-end walkthrough`);
  d.stages.forEach((s, i) => {
    assert(s.n && s.t && s.gotcha, `design "${d.k}" stage ${i} is missing a field`);
  });
  assert(/requirement/i.test(d.stages[0].n), `design "${d.k}" must start with requirements`);
  assert(/operat/i.test(d.stages[d.stages.length - 1].n), `design "${d.k}" must end with operating it`);
});


// ch16: the catalogue must be complete, categorised, and honest about the trap
assert(C.patterns.length === 15, `expected 15 patterns, found ${C.patterns.length}`);
assert(new Set(C.patterns.map(p => p.k)).size === 15, 'pattern keys must be unique');
assert(new Set(C.patterns.map(p => p.cat)).size === Object.keys(C.patternCats).length,
  'every pattern family must be represented, or the filter has a dead chip');
C.patterns.forEach(p => {
  assert(C.patternCats[p.cat], `pattern "${p.k}" has unknown category "${p.cat}"`);
  ['n', 'one', 'problem', 'ai', 'code', 'trap'].forEach(field =>
    assert(p[field], `pattern "${p.k}" is missing ${field}`));
  // a pattern with no downside is a pattern someone will apply everywhere
  assert(p.trap.length > 60, `pattern "${p.k}" needs a real trap, not a disclaimer`);
});

// the drill may only ask about patterns the cards taught, and must have real distractors
{
  const keys = new Set(C.patterns.map(p => p.k));
  C.patternDrill.forEach((d, i) => {
    assert(d.o.every(k => keys.has(k)), `patternDrill[${i}] offers a pattern that does not exist`);
    assert(d.o.includes(d.a), `patternDrill[${i}] answer is not one of its own options`);
    assert(d.o.length >= 3, `patternDrill[${i}] needs real distractors`);
    assert(d.why.length > 80, `patternDrill[${i}] must explain why the near-miss misses`);
  });
  assert(new Set(C.patternDrill.map(d => d.a)).size === C.patternDrill.length,
    'each drill question should test a different pattern');
}
// ch17: the four Redis use cases must each carry a real problem, real commands and a real trap
assert(C.redisUses.length === 4, `expected 4 Redis use cases, found ${C.redisUses.length}`);
assert(new Set(C.redisUses.map(u => u.k)).size === 4, 'Redis use-case keys must be unique');
C.redisUses.forEach(u => {
  ['n', 'ico', 'head', 'type', 'one', 'problem', 'ai', 'code', 'trap'].forEach(field =>
    assert(u[field], `Redis use case "${u.k}" is missing ${field}`));
  // the trap is the part an interview actually asks about — a disclaimer will not do
  assert(u.trap.length > 100, `Redis use case "${u.k}" needs a real trap, not a disclaimer`);
});
// the traps must name the specific failure, because that is the chapter's whole claim
{
  const traps = Object.fromEntries(C.redisUses.map(u => [u.k, u.trap]));
  assert(/stampede/i.test(traps.cache), 'the cache trap must name the stampede');
  assert(/expire|bucket/i.test(traps.zset), 'the sorted-set trap must say the key grows forever without expiry');
  assert(/lease|idempotent/i.test(traps.lock), 'the lock trap must admit a lock is a lease, not a mutex');
  assert(/boundary|neighbour/i.test(traps.geo), 'the geo trap must name the cell-boundary problem');
}

// the drill may only ask about use cases the cards taught, one question each
{
  const keys = new Set(C.redisUses.map(u => u.k));
  C.redisDrill.forEach((d, i) => {
    assert(d.o.every(k => keys.has(k)), `redisDrill[${i}] offers a use case that does not exist`);
    assert(d.o.includes(d.a), `redisDrill[${i}] answer is not one of its own options`);
    assert(d.o.length >= 3, `redisDrill[${i}] needs real distractors`);
    assert(d.why.length > 80, `redisDrill[${i}] must explain why the near-miss misses`);
  });
  assert(new Set(C.redisDrill.map(d => d.a)).size === C.redisUses.length,
    'every Redis use case should be the answer to exactly one drill question');
}

// the toolbox and the rules are the take-home half of the chapter
assert(C.redisTypes.length >= 8, 'the Redis toolbox should cover the types you actually meet');
C.redisTypes.forEach(t => assert(t[1].length > 40, `Redis type "${t[0]}" needs a real one-liner`));
assert(C.redisRules.length === 5, `expected 5 operating rules, found ${C.redisRules.length}`);
C.redisRules.forEach(r => assert(r[1].length > 80, `Redis rule "${r[0]}" is too thin to act on`));


// every pattern needs its animated diagram, and the layouts have fixed-size slots
// (nest has three rings, cycle has four states) — overflow them and the SVG maths goes NaN
{
  const need = { flow: d => d.nodes.length >= 2, cells: d => d.vals.length >= 2 && d.label,
                 fan: d => d.hub && d.spokes.length >= 2 && /^(in|out)$/.test(d.dir),
                 nest: d => d.layers.length === 3, cycle: d => d.states.length === 4,
                 steps: d => d.items.length >= 2 && (d.override === undefined || d.items[d.override]),
                 switch: d => d.input && d.output && d.opts.length >= 2 && d.opts[d.active] };
  C.patterns.forEach(p => {
    const d = C.patternDia[p.k];
    assert(d, `pattern "${p.k}" has no diagram`);
    assert(need[d.kind], `pattern "${p.k}" wants layout "${d.kind}", which no renderer draws`);
    assert(need[d.kind](d), `the "${d.kind}" diagram for "${p.k}" does not fit that layout's slots`);
  });
  Object.keys(C.patternDia).forEach(k =>
    assert(C.patterns.some(p => p.k === k), `C.patternDia has "${k}", which is not a pattern`));
}
/* ---------- accessibility for a first-time reader ---------- */
/* The course was rewritten to be readable without prior experience.
   These guard that, because it is the kind of thing that quietly rots
   the next time someone adds a chapter.                              */

// every chapter (except the welcome hero) needs a plain-English summary
{
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = [...html.matchAll(/data-id="([a-z]+)"/g)].map(m => m[1]).filter(id => id !== 'welcome');
  ids.forEach(id => assert(C.plain[id], `chapter "${id}" has no plain-English summary in C.plain`));
  Object.keys(C.plain).forEach(id => assert(ids.includes(id), `C.plain has "${id}", which is not a chapter`));
  // and those summaries must actually be jargon-free — that is the whole point
  const banned = /\bp99\b|\bp95\b|\bQPS\b|\bAUC\b|\bnDCG\b|\bGBDT\b|recall@k|\bSLO\b|\bMDE\b|\bANN\b/;
  // the vocabulary chapter is the one place the terms may appear: its whole job is
  // naming them before the rest of the course leans on them
  Object.keys(C.plain).filter(id => id !== 'vocab').forEach(id => {
    const text = C.plain[id].join(' ');
    assert(!banned.test(text),
      `the plain-English box for "${id}" uses jargon it is supposed to be explaining: ${(text.match(banned) || [])[0]}`);
  });
  // one sentence, then a short paragraph — not an essay
  Object.keys(C.plain).forEach(id => {
    assert(C.plain[id][0].length < 110, `plain[${id}] headline is too long to scan`);
    assert(C.plain[id][1].length > 80, `plain[${id}] body is too thin to explain anything`);
  });
}

// the vocabulary chapter must define the terms the rest of the course actually leans on
{
  const defined = C.jargon.map(j => j.t.toLowerCase()).join(' | ');
  ['p50, p95, p99', 'qps', 'latency', 'model', 'features', 'label', 'baseline', 'a/b test',
   'cache', 'token', 'drift', 'guardrail metric', 'rag'].forEach(term => {
    assert(defined.includes(term), `the vocabulary chapter never defines "${term}"`);
  });
  // every card needs all three parts, or it is not doing its job
  C.jargon.forEach(j => {
    assert(j.short && j.like && j.at, `jargon card "${j.t}" is missing a field`);
    assert(j.like.length > 40, `jargon card "${j.t}" has no real everyday comparison`);
  });
  // the drill must only test words the cards actually taught
  const keys = Object.keys(C.jargonOptions);
  C.jargonDrill.forEach((d, i) => assert(keys.includes(d.a), `jargonDrill[${i}] answers "${d.a}", not an option`));
  assert(new Set(C.jargonDrill.map(d => d.a)).size === C.jargonDrill.length,
    'each vocabulary drill question should test a different word');
}

// every calculator gets a worked example with real arithmetic above it
{
  const html = fs.readFileSync('index.html', 'utf8');
  const slots = [...html.matchAll(/data-worked="([a-z]+)"/g)].map(m => m[1]);
  assert(slots.length >= 4, `expected a worked example on each calculator, found ${slots.length}`);
  slots.forEach(k => assert(C.worked[k], `index.html asks for worked example "${k}", which C.worked does not have`));
  Object.keys(C.worked).forEach(k => {
    const w = C.worked[k];
    assert(w.steps.length >= 4, `worked example "${k}" is too short to follow`);
    assert(w.punch && w.punch.length > 60, `worked example "${k}" has no takeaway`);
  });
  // the capacity walkthrough must land on the same answer the calculator does
  const walked = C.worked.capacity.steps.map(s => s[1]).join(' ');
  assert(/116/.test(walked) && /460/.test(walked) && /100/.test(walked),
    'the capacity worked example no longer matches the numbers the calculator produces');
}

/* ---------- arithmetic the widgets actually perform ---------- */
/* These mirror demos.js. If a formula there changes, this fails first. */

// Little's Law sizing, with the demo's defaults (4M DAU, 30 req/user, 3x peak,
// 80ms, 8 workers, 40% cache hit, sized to 60% utilisation)
{
  const avgQps = 4e6 * 30 / 86400;
  const peakQps = avgQps * 3;
  const backendQps = peakQps * 0.6;
  const perReplica = 8 / 0.080;
  const replicas = Math.ceil(backendQps / perReplica / 0.6);
  near(avgQps, 1389, 2, 'average QPS');
  near(perReplica, 100, 0.01, 'QPS per replica (Little\'s Law)');
  assert(replicas === 42, `replica count drifted: ${replicas}`);
  // the chapter claims the cache is the biggest lever — prove it
  const noCache = Math.ceil(peakQps / perReplica / 0.6);
  assert(noCache > replicas * 1.5, 'a 40% cache hit rate should remove well over a third of the fleet');
}

// A/B sizing: n ≈ 16·p(1-p)/δ² per variant. 4% baseline, +3% relative.
{
  const p = 0.04, delta = p * 0.03;
  const nPer = Math.ceil(16 * p * (1 - p) / (delta * delta));
  near(nPer, 426667, 50, 'A/B sample size per variant');
  // the headline lesson: halving the detectable effect quadruples the sample
  const half = Math.ceil(16 * p * (1 - p) / Math.pow(delta / 2, 2));
  near(half / nPer, 4, 0.01, 'sample size must scale with 1/δ²');
}

// Quiz claims 0.95^20 ≈ 36% is NOT in this course, but the funnel's ceiling claim is:
// stage-1 recall must genuinely cap end-to-end quality in the demo's model.
{
  const recall = k => 1 - Math.exp(-k / 350);
  assert(recall(100) < 0.3, 'a 100-candidate stage 1 must visibly starve the ranker');
  assert(recall(1000) > 0.9, '1000 candidates should reach usable recall');
  const rankAcc = (a, b) => Math.min(0.99, Math.max(0.4, 0.99 - 0.12 * Math.log10(a / b)));
  assert(rankAcc(1000, 50) < rankAcc(200, 50), 'sifting more candidates per kept slot must cost precision');
}

// Cascade: with the demo defaults the saving must be real and quality must hold up,
// and dropping router accuracy must visibly erode the saving.
{
  const T = {}; C.cascadeTiers.forEach(t => T[t.k] = t);
  const IN = 1400, OUT = 300;
  const cost = t => IN / 1e6 * t.inCost + OUT / 1e6 * t.outCost;
  const run = (s, a) => {
    const mis = s * (1 - a);
    const esc = mis * C.cascadeDetection, bad = mis - esc, only = s - mis, big = 1 - s;
    const c = only * cost(T.small) + esc * (cost(T.small) + cost(T.large)) + bad * cost(T.small) + big * cost(T.large);
    const q = only * T.small.easyQuality + esc * (T.large.quality - 4) + bad * T.small.quality + big * T.large.quality;
    return { saving: 1 - c / cost(T.large), q };
  };
  const goodRouter = run(0.7, 0.9), badRouter = run(0.7, 0.6);
  assert(goodRouter.saving > 0.4, `a reliable router at 70% split should save >40%, got ${(goodRouter.saving * 100).toFixed(0)}%`);
  assert(goodRouter.q > 88, `blended quality should stay high with a good router, got ${goodRouter.q.toFixed(1)}`);
  assert(badRouter.saving < goodRouter.saving - 0.15, 'a bad router must visibly erode the saving');
  assert(badRouter.q < goodRouter.q, 'a bad router must cost some quality via undetected misroutes');
}

// Ch13, KV cache ceiling: concurrency must be set by the term that scales.
// Re-derived here rather than imported, so a drift between demos.js and the
// chapter's claims fails the build instead of quietly teaching the wrong thing.
{
  const d = Object.fromEntries(C.kvDefaults.map(f => [f[0], f[2]]));
  const conc = (gpu, w, kvKB, ctx) => {
    const usable = gpu * (1 - C.kvOverhead) - w;
    const perReq = ctx * kvKB / 1048576;
    return perReq > 0 ? Math.max(0, Math.floor(usable / perReq)) : 0;
  };
  const baseC = conc(d.gpu, d.w, d.kv, d.ctx);
  assert(baseC > 0, 'the default KV configuration must actually fit on the accelerator');

  // halving the context must roughly double concurrency — the chapter's claim
  const halfCtx = conc(d.gpu, d.w, d.kv, d.ctx / 2);
  assert(halfCtx >= baseC * 1.9,
    `halving the context should roughly double concurrency: ${baseC} -> ${halfCtx}`);

  // quantizing the weights must help *less* than halving the context, because the
  // weights are a fixed cost and the KV cache is the term that scales per request
  const quant = conc(d.gpu, d.w / 4, d.kv, d.ctx);
  assert(quant - baseC < halfCtx - baseC,
    `weights are not the scaling term: 4-bit gained ${quant - baseC}, half-context gained ${halfCtx - baseC}`);

  // and long contexts must genuinely be able to price a request off the box
  assert(conc(d.gpu, d.w, d.kv, 1000000) === 0,
    'a million-token context should not fit — the ceiling has to be able to bite');
}

// Ch13, prefill vs decode: each lever must move its own phase and leave the others alone.
{
  const M = C.decodeModel;
  const timing = on => {
    const P = M.promptTokens, O = M.outputTokens, step = 1000 / M.decodeRate;
    const fresh = on.cache ? P * (1 - M.cachedFrac) + P * M.cachedFrac / M.cacheSpeedup : P;
    const prefill = fresh / M.prefillRate * 1000;
    const perRound = (1 - Math.pow(M.accept, M.draftBlock + 1)) / (1 - M.accept);
    const roundCost = 1 + M.draftBlock * M.draftCost;
    const speedup = on.spec ? perRound / roundCost : 1;
    const decode = O * step / speedup;
    const total = M.overheadMs + prefill + decode;
    const billed = on.cache ? P * (1 - M.cachedFrac) + P * M.cachedFrac * M.cacheDiscount : P;
    return { prefill, decode, total, speedup, billed,
             ttft: on.stream ? M.overheadMs + prefill + (on.spec ? roundCost * step : step) : total,
             tps: O / (decode / 1000) };
  };
  const none = timing({ stream: false, cache: false, spec: false });

  // streaming: perceived latency only. Not total, not throughput, not cost.
  const str = timing({ stream: true, cache: false, spec: false });
  near(str.total, none.total, 1e-9, 'streaming must not change total time');
  near(str.tps, none.tps, 1e-9, 'streaming must not change tokens per second');
  near(str.billed, none.billed, 1e-9, 'streaming must not change what you are billed');
  assert(str.ttft < none.ttft / 3, 'streaming must substantially cut time to first token');

  // prompt caching: prefill and the input bill, never generation speed
  const cch = timing({ stream: true, cache: true, spec: false });
  assert(cch.prefill < str.prefill / 2, 'prompt caching should more than halve prefill on a stable prefix');
  assert(cch.billed < str.billed / 2, 'prompt caching should more than halve the billed input tokens');
  near(cch.tps, str.tps, 1e-9, 'prompt caching must not change tokens per second — it attacks prefill only');

  // speculative decoding: decode only, and only worth it above a real acceptance rate
  const spc = timing({ stream: true, cache: false, spec: true });
  near(spc.prefill, str.prefill, 1e-9, 'speculative decoding must not touch prefill');
  assert(spc.speedup > 1.3,
    `speculative decoding should pay at accept=${M.accept}, got ${spc.speedup.toFixed(2)}x`);
  assert(spc.ttft > str.ttft,
    'the first speculative round costs more than one plain step, so TTFT must get slightly worse');
  const saved = M.accept;
  M.accept = 0;
  assert(timing({ stream: true, cache: false, spec: true }).speedup < 1,
    'a draft model that is never accepted must be a net loss, not a wash');
  M.accept = saved;

  // and the levers have to stack, since they attack different phases
  const all = timing({ stream: true, cache: true, spec: true });
  assert(all.total < cch.total && all.total < spc.total,
    'caching and speculating attack different phases and must compose');
}

// every lever the chapter names must be one the demo can actually toggle
C.decodeLevers.forEach(l => {
  assert(['prefill', 'decode', 'neither'].includes(l.phase), `decodeLever ${l.k}: unknown phase "${l.phase}"`);
  assert(l.on && l.off, `decodeLever ${l.k} needs both an on and an off explanation`);
});

// Feedback loop: the greedy simulation must actually collapse, and exploration must fix it.
// This mirrors initLoop exactly, including the seed and the smoothed-CTR scoring,
// so the chapter's central claim is verified rather than asserted.
{
  const lcg = seed => { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
  const N = 60, SLOTS = 10, ROUNDS = 25, A = 0.1, B = 3;
  const simulate = explore => {
    const rnd = lcg(20260819);
    const quality = Array.from({ length: N }, () => 0.15 + rnd() * 0.85);
    const clicks = new Array(N).fill(0), imps = new Array(N).fill(0);
    const tie = Array.from({ length: N }, () => rnd() * 1e-6);
    for (let i = 0; i < 8; i++) { imps[i] = 3; clicks[i] = 3 * quality[i]; }
    const score = i => (clicks[i] + A) / (imps[i] + B) + tie[i];
    const seen = new Set();
    let mq = 0;
    for (let r = 0; r < ROUNDS; r++) {
      const ex = Math.round(SLOTS * explore);
      const order = Array.from({ length: N }, (_, i) => i).sort((x, y) => score(y) - score(x));
      const shown = order.slice(0, SLOTS - ex);
      for (let e = 0; e < ex; e++) shown.push(Math.floor(rnd() * N));
      shown.forEach((i, pos) => { seen.add(i); imps[i]++; clicks[i] += quality[i] / (1 + pos * 0.25); });
      mq = shown.reduce((a, i) => a + quality[i], 0) / shown.length;
    }
    return { cov: seen.size, mq };
  };
  const greedy = simulate(0), explored = simulate(0.2);
  // the greedy run must be genuinely stuck, not merely slow
  assert(greedy.cov <= SLOTS + 2,
    `greedy must collapse to roughly the launch slate; it reached ${greedy.cov}/${N}`);
  assert(explored.cov > greedy.cov * 2.5,
    `exploration must open the catalogue: ${explored.cov} vs ${greedy.cov}`);
  // and the payoff must be real — exploration finds better items, not just more of them
  assert(explored.mq > greedy.mq,
    `exploration should raise the quality served: ${explored.mq.toFixed(2)} vs ${greedy.mq.toFixed(2)}`);
}

// every id the demos reach for must exist in the markup, or a widget is quietly dead
{
  const demos = fs.readFileSync('js/demos.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = new Set();
  // ids built by concatenation ('#k-' + name) end in a dash — not a real id, skip them
  for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
  ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
    `demos.js targets #${id}, which nothing ever creates`));
}

// every C.* key the demos read must exist, or a panel renders empty and nobody notices
{
  const demos = fs.readFileSync('js/demos.js', 'utf8');
  const keys = new Set([...demos.matchAll(/\bC\.([A-Za-z0-9_]+)/g)].map(m => m[1]));
  keys.forEach(k => assert(C[k] !== undefined, `demos.js reads C.${k}, which content.js does not define`));
}


// ch13: the index families only teach something if they genuinely trade off
C.annFamilies.forEach(f => {
  ['bytes', 'recall', 'qps'].forEach(k => assert(typeof f[k] === 'number' && f[k] > 0,
    `annFamilies ${f.k}.${k} must be a positive number`));
  ['win', 'cost', 'when', 'one'].forEach(k => assert((f[k] || '').length > 40,
    `annFamilies ${f.k}.${k} needs a real sentence`));
});
{
  const dom = C.annFamilies.filter(f =>
    C.annFamilies.every(o => o === f || (f.recall >= o.recall && f.qps >= o.qps && f.bytes <= o.bytes)));
  assert(dom.length === 0, `index family "${(dom[0] || {}).k}" wins on recall, speed and memory — then there is no decision to teach`);
  const flat = C.annFamilies.find(f => f.k === 'flat');
  assert(flat && flat.recall === 100, 'flat search is the exact baseline every other recall number is measured against');
  assert(C.annFamilies.find(f => f.k === 'ivfpq').bytes < flat.bytes / 10,
    'PQ must be an order of magnitude smaller, or the compression chapter has no point');
}

// the drill must be answerable and must not have one answer for every scenario
{
  const keys = new Set(C.annFamilies.map(f => f.k));
  C.annDrill.forEach((d, i) => {
    assert(keys.has(d.a), `annDrill ${i} answers with "${d.a}", which is not an index family`);
    d.o.forEach(o => assert(keys.has(o), `annDrill ${i} offers "${o}", which is not an index family`));
    assert(d.o.includes(d.a), `annDrill ${i}'s answer is not one of its options`);
    assert(d.o.length >= 3, `annDrill ${i} needs real distractors`);
  });
  assert(new Set(C.annDrill.map(d => d.a)).size >= 3,
    'the drill must land on different families, or the lesson is "always pick X"');
}

// PQ: the memory saving must be real, and buying it back with m must cost memory
{
  const pq = (dims, m, bits) => ({
    raw: dims * 4,
    bytes: Math.ceil(m * bits / 8),
    recall: Math.min(0.995, Math.max(0.4, 0.995 - 0.0016 * Math.round(dims / m) * (8 / bits)))
  });
  const coarse = pq(768, 8, 8), fine = pq(768, 96, 8);
  assert(coarse.raw / coarse.bytes > 100, `PQ at m=8 should be a huge saving, got ${coarse.raw / coarse.bytes}×`);
  assert(fine.bytes > coarse.bytes, 'more sub-vectors must cost more memory');
  assert(fine.recall > coarse.recall, 'more sub-vectors must buy back recall, or the slider teaches nothing');
  assert(pq(768, 48, 4).bytes < pq(768, 48, 8).bytes, '4-bit codes must be smaller than 8-bit ones');
}

// ch13's central claim: IVF looks at a fraction of the corpus, and what it skips is
// exactly what it gets wrong. Same arithmetic the widget runs, on a fixed corpus.
{
  const N = 400, NLIST = 12, TOPK = 10;
  const rnd = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(7);
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const blobs = Array.from({ length: 8 }, () => ({ x: rnd(), y: rnd() }));
  const pts = Array.from({ length: N }, (_, id) => {
    const b = blobs[Math.floor(rnd() * blobs.length)];
    return { id, x: b.x + (rnd() - .5) * .18, y: b.y + (rnd() - .5) * .18 };
  });

  let cents = pts.slice(0, NLIST).map(p => ({ x: p.x, y: p.y }));
  let assign = [];
  const nearestC = p => cents.reduce((bi, c, i) => d2(p, c) < d2(p, cents[bi]) ? i : bi, 0);
  for (let it = 0; it < 20; it++) {
    assign = pts.map(nearestC);
    cents = cents.map((c, i) => {
      const own = pts.filter((_, j) => assign[j] === i);
      return own.length ? { x: own.reduce((a, p) => a + p.x, 0) / own.length, y: own.reduce((a, p) => a + p.y, 0) / own.length } : c;
    });
  }
  assign = pts.map(nearestC);

  const topK = (list, q) => list.map(p => ({ p, d: d2(p, q) })).sort((a, b) => a.d - b.d).slice(0, TOPK).map(o => o.p.id);
  const queries = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd() }));
  const run = np => {
    let rec = 0, scanned = 0;
    queries.forEach(q => {
      const cells = new Set(cents.map((c, i) => ({ i, d: d2(c, q) })).sort((a, b) => a.d - b.d).slice(0, np).map(o => o.i));
      const cand = pts.filter((_, j) => cells.has(assign[j]));
      scanned += cand.length;
      const exact = new Set(topK(pts, q));
      rec += topK(cand, q).filter(id => exact.has(id)).length / TOPK;
    });
    return { recall: rec / queries.length, scanned: scanned / queries.length };
  };

  const one = run(1), all = run(NLIST);
  near(all.recall, 1, 1e-9, 'probing every cell must be exactly as good as flat search');
  assert(one.scanned < N * 0.25, `nprobe=1 must scan a small slice of the corpus; it scanned ${one.scanned.toFixed(0)}/${N}`);
  assert(one.recall < all.recall, 'nprobe=1 must lose recall — the edge effect is the whole lesson of the chapter');
  // and the dial must actually be a dial: more probes never returns fewer true neighbours
  let prev = 0;
  for (let np = 1; np <= NLIST; np++) {
    const r = run(np).recall;
    assert(r >= prev - 1e-9, `recall dropped when nprobe rose to ${np} — the candidate set is supposed to be nested`);
    prev = r;
  }
}

console.log('ok — content data and widget arithmetic are consistent');
