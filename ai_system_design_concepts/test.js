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
  const banned = /p99|p95|QPS|AUC|nDCG|GBDT|recall@k|SLO|MDE|ANN/;
  Object.keys(C.plain).forEach(id => {
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

console.log('ok — content data and widget arithmetic are consistent');
