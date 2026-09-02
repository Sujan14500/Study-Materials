/* Smallest check that fails if the course data or the maths rots.
   Run: node test.js

   This test imports js/mathkit.js — the same file the page loads —
   so it exercises the exact code that produces every number on
   screen, then checks the claims each chapter makes about it.     */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const MK = require('./js/mathkit.js');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

/* ---------------------------------------------------------------
   Ch1 — kinds of learning, and the rules-vs-ML quiz
   --------------------------------------------------------------- */
C.mlKinds.forEach(k => assert(k.d && k.ex.length && k.needs && k.algos, `ml kind "${k.k}" is incomplete`));
C.rulesVsML.forEach(r => {
  assert(['rules', 'ml'].includes(r.verdict), `"${r.q}" has verdict "${r.verdict}"`);
  assert(r.rules && r.ml && r.why, `"${r.q}" is missing a field`);
});
// both answers must be correct somewhere, or one button is decorative
const verdicts = new Set(C.rulesVsML.map(r => r.verdict));
assert(verdicts.has('rules') && verdicts.has('ml'), 'the rules-vs-ML quiz must have both answers');

/* ---------------------------------------------------------------
   Ch2 — the split and the leakage examples
   --------------------------------------------------------------- */
assert.strictEqual(C.splitParts.reduce((a, p) => a + p.pct, 0), 100, 'the split must add up to 100%');
C.splitParts.forEach(p => assert(p.d && p.warn && p.c, `split part "${p.n}" is incomplete`));
C.leakCases.forEach(l => {
  assert(l.bad && l.good && l.why, `leak case "${l.t}" is incomplete`);
  assert.notStrictEqual(l.bad, l.good, `leak case "${l.t}" shows the same code twice`);
});

/* ---------------------------------------------------------------
   Ch3 — the regression demo must have something to demonstrate
   --------------------------------------------------------------- */
const best = MK.ols(C.regData);
const bestLoss = MK.lineMSE(C.regData, best.w, best.b);
assert(best.w > 0, 'the study-hours data should have a positive slope, or the chapter reads oddly');
assert(Number.isFinite(bestLoss) && bestLoss > 0, 'the optimal loss must be a real positive number');
// the slider start must be clearly worse than optimal, or "Solve exactly" does nothing visible
const startLoss = MK.lineMSE(C.regData, C.regStart.w, C.regStart.b);
assert(startLoss > bestLoss * 3,
  `regStart loss ${startLoss.toFixed(2)} is already close to optimal ${bestLoss.toFixed(2)} — nothing to demonstrate`);
// no other (w, b) may beat the closed-form solution: sanity-check the formula itself
for (let dw = -0.4; dw <= 0.4; dw += 0.1) {
  for (let db = -4; db <= 4; db += 1) {
    assert(MK.lineMSE(C.regData, best.w + dw, best.b + db) >= bestLoss - 1e-9,
      'a nearby line beats the OLS solution — the closed form is wrong');
  }
}
// the slider ranges in the markup must be able to reach the answer
const html = fs.readFileSync('index.html', 'utf8');
const wRange = /id="reg-w"[^>]*min="([-\d.]+)"[^>]*max="([-\d.]+)"/.exec(html);
const bRange = /id="reg-b"[^>]*min="([-\d.]+)"[^>]*max="([-\d.]+)"/.exec(html);
assert(wRange && bRange, 'the regression sliders are missing min/max attributes');
assert(best.w >= +wRange[1] && best.w <= +wRange[2],
  `the optimal slope ${best.w.toFixed(2)} is outside the slider range ${wRange[1]}..${wRange[2]}`);
assert(best.b >= +bRange[1] && best.b <= +bRange[2],
  `the optimal intercept ${best.b.toFixed(2)} is outside the slider range ${bRange[1]}..${bRange[2]}`);

/* ---------------------------------------------------------------
   Ch4 — every learning rate must behave the way its label claims.
   This actually runs gradient descent.
   --------------------------------------------------------------- */
// the demo declares divergence at this loss rather than waiting for NaN, so the
// test uses the very same number — read out of demos.js so they cannot drift apart
const blowUp = Number(/L > (\de\d)/.exec(fs.readFileSync('js/demos.js', 'utf8'))[1]);
function descend(lr, steps) {
  let w = C.regStart.w, b = C.regStart.b;
  for (let i = 0; i < steps; i++) {
    const n = MK.gdStep(C.regData, w, b, lr);
    w = n.w; b = n.b;
    const L = MK.lineMSE(C.regData, w, b);
    if (!Number.isFinite(L) || L > blowUp) return { w, b, loss: Infinity, blewUpAt: i };
  }
  return { w, b, loss: MK.lineMSE(C.regData, w, b) };
}
C.gdRates.forEach(r => {
  const out = descend(r.lr, 4000);
  if (r.tag === 'diverges') {
    assert(!Number.isFinite(out.loss),
      `lr=${r.lr} is labelled "diverges" but converged to loss ${out.loss}`);
    // and it must blow up fast enough that a user actually sees it
    const quick = descend(r.lr, 60);
    assert(!Number.isFinite(quick.loss),
      `lr=${r.lr} takes more than 60 steps to visibly diverge — nobody will wait`);
  } else if (r.tag === 'too small') {
    assert(Number.isFinite(out.loss), `lr=${r.lr} should still be stable`);
    assert(out.loss < startLoss, `lr=${r.lr} must at least improve on the starting line`);
    assert(out.loss > bestLoss * 1.02,
      `lr=${r.lr} is labelled "too small" but reaches the optimum in 4000 steps`);
  } else {
    assert(Number.isFinite(out.loss), `lr=${r.lr} labelled "${r.tag}" but diverged`);
    near(out.loss, bestLoss, bestLoss * 0.01, `lr=${r.lr} labelled "${r.tag}" did not reach the optimum`);
  }
});
// descent on a stable rate must be monotonic, or the "healthy loss curve" claim is false
{
  let w = C.regStart.w, b = C.regStart.b, prev = Infinity;
  for (let i = 0; i < 300; i++) {
    const n = MK.gdStep(C.regData, w, b, 0.01);
    w = n.w; b = n.b;
    const L = MK.lineMSE(C.regData, w, b);
    assert(L <= prev + 1e-9, `loss went up at step ${i} with lr=0.01`);
    prev = L;
  }
}

/* ---------------------------------------------------------------
   Ch5 — the classifier must actually learn, and must not be perfect
   --------------------------------------------------------------- */
{
  let w1 = 0, w2 = 0, b = 0;
  const EPOCHS = 600;                     // the same budget the demo runs
  for (let i = 0; i < EPOCHS; i++) {
    const n = MK.logregStep(C.clfData, w1, w2, b, 0.12);
    w1 = n.w1; w2 = n.w2; b = n.b;
  }
  const acc = MK.logregAccuracy(C.clfData, w1, w2, b);
  assert(acc > 0.9, `logistic regression only reaches ${acc.toFixed(3)} in ${EPOCHS} epochs — the demo looks broken`);
  assert(acc < 1, 'the classes must overlap somewhere, or the "irreducible error" lesson has no evidence');
  assert(Math.abs(w2) > 1e-6, 'w2 must be non-zero or the boundary cannot be drawn');
}
C.clfData.forEach((p, i) => assert(p.length === 3 && (p[2] === 0 || p[2] === 1),
  `clfData row ${i} is not [x, y, 0|1]`));
assert(C.clfData.some(p => p[2] === 0) && C.clfData.some(p => p[2] === 1), 'clfData needs both classes');

/* ---------------------------------------------------------------
   Ch6 — metrics. Every claim the chapter makes, recomputed.
   --------------------------------------------------------------- */
C.scored.forEach(([s, l], i) => {
  assert(s >= 0 && s <= 1, `scored[${i}] has score ${s}, outside 0..1`);
  assert(l === 0 || l === 1, `scored[${i}] has label ${l}`);
});
for (let i = 1; i < C.scored.length; i++)
  assert(C.scored[i][0] <= C.scored[i - 1][0], 'scored must be sorted high to low for the strip to read left to right');

const lowT = MK.rates(MK.confusion(C.scored, 0.20));
const midT = MK.rates(MK.confusion(C.scored, 0.50));
const highT = MK.rates(MK.confusion(C.scored, 0.85));
assert(lowT.recall > highT.recall, 'lowering the threshold must raise recall, or the chapter is wrong');
assert(highT.precision > lowT.precision, 'raising the threshold must raise precision');
assert(midT.recall <= lowT.recall && midT.recall >= highT.recall, 'recall must fall monotonically with the threshold');
// the counts must always account for every sample
[0.1, 0.3, 0.5, 0.7, 0.9].forEach(t => {
  const cm = MK.confusion(C.scored, t);
  assert.strictEqual(cm.tp + cm.fp + cm.tn + cm.fn, C.scored.length, `confusion matrix at ${t} loses samples`);
});
// AUC must beat chance, and must not depend on the threshold
const A = MK.auc(C.scored);
assert(A > 0.7, `AUC is only ${A.toFixed(3)} — too close to chance to teach with`);
assert(A <= 1, 'AUC above 1 is impossible');
const roc = MK.rocPoints(C.scored);
assert.strictEqual(roc[0][0], 0, 'the ROC curve must start at (0,0)');
near(roc[roc.length - 1][0], 1, 1e-9, 'the ROC curve must end at fpr 1');
near(roc[roc.length - 1][1], 1, 1e-9, 'the ROC curve must end at tpr 1');
for (let i = 1; i < roc.length; i++) {
  assert(roc[i][0] >= roc[i - 1][0] - 1e-12 && roc[i][1] >= roc[i - 1][1] - 1e-12,
    'the ROC curve must be monotonically non-decreasing');
}
// the metric chooser must only offer answers the demo actually renders
const demos = fs.readFileSync('js/demos.js', 'utf8');
const optsMatch = /const OPTS = \[([^\]]+)\]/.exec(demos);
assert(optsMatch, 'the metric-picker options are missing from demos.js');
const OPTS = optsMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
C.metricPick.forEach(m => {
  assert(OPTS.includes(m.want), `"${m.case}" wants "${m.want}", which is not an option the demo offers`);
  assert(m.why, `"${m.case}" has no explanation`);
});

/* ---------------------------------------------------------------
   Ch7 — the bias/variance bowl must actually be a bowl.
   Every degree is fitted here with the same code the page runs.
   --------------------------------------------------------------- */
const allPts = C.polyTrain.concat(C.polyTest);
const fitRange = [Math.min.apply(null, allPts.map(p => p[0])), Math.max.apply(null, allPts.map(p => p[0]))];
const fits = [];
for (let d = 1; d <= 9; d++) {
  const f = MK.polyFit(C.polyTrain, d, fitRange);
  fits.push({ d, tr: MK.mse(C.polyTrain, f), te: MK.mse(C.polyTest, f) });
}
// more capacity can never fit the training data worse — that is what least squares guarantees
for (let i = 1; i < fits.length; i++)
  assert(fits[i].tr <= fits[i - 1].tr + 1e-6,
    `train error rose from degree ${fits[i - 1].d} to ${fits[i].d} — the fit is numerically broken`);
const bestDeg = fits.reduce((a, b) => (b.te < a.te ? b : a)).d;
assert(bestDeg >= 3 && bestDeg <= 5,
  `the best degree is ${bestDeg}, but the chapter calls degrees 3-5 the sweet spot`);
// the two flanks must slope the right way, or the U-shape the chapter draws is a lie
for (let i = 1; i < bestDeg; i++)
  assert(fits[i].te <= fits[i - 1].te, `test error rose between degree ${i} and ${i + 1}, left of the minimum`);
for (let i = bestDeg; i < fits.length; i++)
  assert(fits[i].te >= fits[i - 1].te, `test error fell between degree ${i} and ${i + 1}, right of the minimum`);
// and overfitting must be dramatic enough to see
assert(fits[8].te > fits[bestDeg - 1].te * 5,
  'degree 9 barely overfits — the chapter promises a wild curve');
assert(fits[0].te > fits[bestDeg - 1].te * 2, 'degree 1 barely underfits — the left half of the bowl is flat');
// the verdict bands in demos.js must agree with where the minimum actually is
const bandMatch = /deg <= (\d+) \? 'under' : deg >= (\d+) \? 'over'/.exec(demos);
assert(bandMatch, 'the under/good/over bands are missing from demos.js');
assert(bestDeg > +bandMatch[1] && bestDeg < +bandMatch[2],
  `demos.js calls degree ${bestDeg} under- or over-fitting, but it is the best degree`);
assert(['under', 'good', 'over'].every(k => C.fitNotes[k]), 'fitNotes needs all three verdicts');

/* ---------------------------------------------------------------
   Ch8 — cross-validation copy
   --------------------------------------------------------------- */
C.cvWhen.forEach(w => assert(w.t && w.v, 'a cross-validation note is incomplete'));

/* ---------------------------------------------------------------
   Ch9 — the tree must find a split, and it must be the best one
   --------------------------------------------------------------- */
near(MK.gini([[0, 1], [0, 1], [0, 1]]), 0, 1e-12, 'a pure group must have Gini 0');
near(MK.gini([[0, 1], [0, 0]]), 0.5, 1e-12, 'a 50/50 group must have Gini 0.5');
const split = MK.bestSplit(C.treeData);
assert(split && split.gain > 0.2,
  `the best split only gains ${split && split.gain.toFixed(3)} — too weak to teach with`);
assert(split.L.length && split.R.length, 'the best split must put samples on both sides');
// brute force: nothing beats what bestSplit returned
for (let t = 20; t <= 60; t += 0.5) {
  const s = MK.splitGain(C.treeData, t);
  if (s) assert(s.gain <= split.gain + 1e-12, `threshold ${t} beats the "best" split`);
}
// the slider in the markup has to be able to land on it
const treeRange = /id="tree-thr"[^>]*min="([-\d.]+)"[^>]*max="([-\d.]+)"/.exec(html);
assert(treeRange, 'the tree slider is missing min/max');
assert(split.thr >= +treeRange[1] && split.thr <= +treeRange[2],
  `the best threshold ${split.thr} is outside the slider range ${treeRange[1]}..${treeRange[2]}`);
C.treeData.forEach((r, i) => assert(r.length === 2 && (r[1] === 0 || r[1] === 1), `treeData row ${i} is malformed`));
C.ensembleCards.forEach(e => assert(e.d && e.good && e.bad, `ensemble card "${e.n}" is incomplete`));

/* ---------------------------------------------------------------
   Ch10 — k-means must converge, and inertia must only ever fall
   --------------------------------------------------------------- */
for (let k = 2; k <= 6; k++) {
  let centres = MK.kmSeed(C.kmData, k);
  let assign = MK.kmAssign(C.kmData, centres);
  let prev = MK.inertia(C.kmData, centres, assign), iters = 0, converged = false;
  for (let i = 0; i < 60; i++) {
    const moved = MK.kmMove(C.kmData, centres, assign);
    const nextAssign = MK.kmAssign(C.kmData, moved);
    const now = MK.inertia(C.kmData, moved, nextAssign);
    assert(now <= prev + 1e-9, `k=${k}: inertia rose at iteration ${i} — k-means cannot do that`);
    if (JSON.stringify(moved) === JSON.stringify(centres)) { converged = true; break; }
    centres = moved; assign = nextAssign; prev = now; iters++;
  }
  assert(converged, `k=${k} did not converge within 60 iterations`);
  assert(iters > 0, `k=${k} converged before moving — the seeded centres are already the answer, so there is nothing to watch`);
  // no cluster may be left empty, or the demo draws a centre with no points
  const finalAssign = MK.kmAssign(C.kmData, centres);
  for (let i = 0; i < k; i++)
    assert(finalAssign.includes(i), `k=${k}: cluster ${i} ended up empty`);
}

/* ---------------------------------------------------------------
   Ch11 — standardising must actually standardise
   --------------------------------------------------------------- */
C.scaleRows.forEach(r => {
  const { mean, sd, z } = MK.standardise(r.raw);
  assert(sd > 0, `feature "${r.f}" has zero variance — it cannot be standardised`);
  near(z.reduce((a, b) => a + b, 0) / z.length, 0, 1e-9, `standardised "${r.f}" mean`);
  const zsd = Math.sqrt(z.reduce((a, b) => a + b * b, 0) / z.length);
  near(zsd, 1, 1e-9, `standardised "${r.f}" standard deviation`);
  assert(Number.isFinite(mean), `feature "${r.f}" mean is not finite`);
});
// the chapter's whole point is that one feature dwarfs the others before scaling
const maxes = C.scaleRows.map(r => Math.max.apply(null, r.raw));
assert(Math.max.apply(null, maxes) > 100 * Math.min.apply(null, maxes),
  'the scaling example needs features on wildly different scales to make its point');
// and that trees are the exception
const treeRow = C.scaleNeeds.find(n => /tree|boosting|forest/i.test(n.m));
assert(treeRow && treeRow.need === false, 'the scaling table must say tree-based models do not need scaling');
assert(C.scaleNeeds.some(n => n.need === true), 'the scaling table must have models that do need it');
C.featureCards.forEach(f => assert(f.code && f.why, `feature card "${f.t}" is incomplete`));

/* ---------------------------------------------------------------
   Ch12 / Ch13 — workflow, quiz, glossary
   --------------------------------------------------------------- */
C.workflow.forEach(s => assert(s.d && s.trap && s.ico, `workflow step "${s.n}" is incomplete`));
assert(C.workflow.findIndex(s => /split/i.test(s.n)) < C.workflow.findIndex(s => /model/i.test(s.n)),
  'the workflow must put splitting before modelling, or it teaches the leak it warns about');
C.quiz.forEach((q, i) => {
  assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`);
  assert.strictEqual(new Set(q.o).size, q.o.length, `quiz ${i} has duplicate options`);
  assert(q.e, `quiz ${i} has no explanation`);
});
C.glossary.forEach(t => assert(t.length === 2 && t[0] && t[1], `glossary entry ${t[0]} is malformed`));

/* ---------------------------------------------------------------
   Wiring — every id the demos reach for must exist somewhere
   --------------------------------------------------------------- */
const ids = new Set();
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));
assert(html.includes('js/mathkit.js'), 'index.html must load mathkit.js before demos.js');
assert(html.indexOf('js/mathkit.js') < html.indexOf('js/demos.js'), 'mathkit.js must load before demos.js');

const chapters = [...html.matchAll(/<section class="chapter"([^>]*)>/g)].map(m => m[1]);
assert(chapters.length >= 12, `only ${chapters.length} chapters found`);
chapters.forEach(attrs => ['data-id', 'data-title', 'data-icon', 'data-group']
  .forEach(a => assert(attrs.includes(a), `a chapter is missing ${a}`)));
const chapterIds = chapters.map(a => /data-id="([^"]+)"/.exec(a)[1]);
assert.strictEqual(new Set(chapterIds).size, chapterIds.length, 'two chapters share a data-id');
// the redraw-on-navigate hooks must name chapters that exist, or a canvas stays blank
for (const m of demos.matchAll(/e\.detail === '([a-z-]+)'/g))
  assert(chapterIds.includes(m[1]), `demos.js redraws on chapter "${m[1]}", which does not exist`);

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

/* ---- the four diagnostic widgets ---- */
/* Each of these asserts the claim the widget makes on screen, using the
   same mathkit function the widget calls. If the maths stops behaving,
   the chapter is teaching something false and this fails. */
{
  const page = fs.readFileSync('index.html', 'utf8');
  ['bv', 'lc', 'regpath', 'imb'].forEach(id =>
    assert(page.includes('id="' + id + '"'), 'index.html is missing #' + id));
  assert(page.includes('js/mlviz.js') && page.includes('css/mlviz.css'), 'mlviz assets are not linked');

  // bias falls and variance rises as the model gets more complex
  const bv = [1, 2, 3, 4, 5, 6, 7].map(d => MK.biasVariance(d));
  assert(bv[0].bias2 > bv[4].bias2 * 10, 'bias should collapse as degree rises');
  assert(bv[6].variance > bv[0].variance * 5, 'variance should grow as degree rises');
  // and the total is U-shaped: the best degree is neither the simplest nor the most complex
  const best = bv.reduce((a, b) => (b.total < a.total ? b : a));
  assert(best.deg > 1 && best.deg < 7, `the bias-variance minimum landed at degree ${best.deg}, not in the middle`);

  // L1 selects (drives coefficients to exactly zero); L2 only shrinks
  const co = [0.92, -0.71, 0.48, -0.34, 0.19, 0.11, -0.06, 0.03];
  const l1 = MK.regPath(co, 0.2, 'l1'), l2 = MK.regPath(co, 0.2, 'l2');
  assert(l1.filter(c => c === 0).length >= 3, 'L1 must zero the small coefficients');
  assert(l2.every(c => c !== 0), 'L2 must never reach exactly zero');
  assert(l2.every((c, i) => Math.abs(c) < Math.abs(co[i])), 'L2 must shrink every coefficient');

  // more data closes the gap; that is the whole point of the learning-curve chapter
  const g10 = MK.learningCurve(10, 0.2, 0.06).gap;
  const g200 = MK.learningCurve(200, 0.2, 0.06).gap;
  assert(g200 < g10 / 5, 'the train/validation gap must close as data grows');
  // ...but it cannot go below the model's own ceiling
  assert(MK.learningCurve(1e6, 0.6, 0.06).val > 0.6, 'a high-bias model must not converge to zero error');

  // the accuracy paradox the widget claims: a useful model scores worse than a constant
  const rare = MK.imbalance(0.02, 0.60, 0.02, 10000);
  assert(rare.accuracy < rare.majorityAccuracy,
    'at a 2% positive rate, always-say-no must beat the model on accuracy — that is the paradox');
  assert(rare.recall > 0.5 && rare.precision < 0.5,
    'the model must be genuinely useful (recall) and look bad on precision, or the lesson is lost');
  const even = MK.imbalance(0.45, 0.60, 0.02, 10000);
  assert(even.accuracy > even.majorityAccuracy, 'on balanced data the model must beat the constant');

  console.log('  bias-variance U verified (best degree ' + best.deg + '), L1 selects and L2 shrinks, ' +
              'accuracy paradox reproduced at 2%');
}

console.log(`ok — ${chapters.length} chapters, best poly degree ${bestDeg}, AUC ${A.toFixed(3)}, ` +
            `best tree split at ${split.thr}, OLS slope ${best.w.toFixed(2)}`);
