/* Smallest check that fails if the course data or the maths rots.
   Run: node test.js

   This test imports js/mathkit.js — the same file the page loads —
   so it trains the exact networks the page trains, then checks the
   claims each chapter makes about them.                            */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const MK = require('./js/mathkit.js');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

const html = fs.readFileSync('index.html', 'utf8');
const demos = fs.readFileSync('js/demos.js', 'utf8');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const train = (net, data, lr, epochs) => {
  let L = 0;
  for (let i = 0; i < epochs; i++) L = MK.trainStep(net, data, lr, 0);
  return L;
};

/* ---------------------------------------------------------------
   Ch1 — one neuron really does compute the logic gates it claims
   --------------------------------------------------------------- */
const CORNERS = [[0, 0], [0, 1], [1, 0], [1, 1]];
const TRUTH = {
  AND:  [0, 0, 0, 1],
  OR:   [0, 1, 1, 1],
  NAND: [1, 1, 1, 0]
};
C.neuronPresets.forEach(p => {
  const want = TRUTH[p.n];
  if (!want) return;                                  // "ignore x₂" is not a gate
  CORNERS.forEach(([x1, x2], i) => {
    const out = MK.ACT.sigmoid.f(p.w1 * x1 + p.w2 * x2 + p.b) >= 0.5 ? 1 : 0;
    assert.strictEqual(out, want[i],
      `preset ${p.n} gives ${out} for (${x1}, ${x2}), but ${p.n} is ${want[i]}`);
  });
});
// the "ignore x₂" preset must genuinely ignore x₂
const ig = C.neuronPresets.find(p => /ignore/.test(p.n));
assert.strictEqual(ig.w2, 0, 'the "ignore" preset must have a zero weight on x₂');
// and every preset must be reachable on the sliders
const range = id => {
  const m = new RegExp(`id="${id}"[^>]*min="([-\\d.]+)"[^>]*max="([-\\d.]+)"`).exec(html);
  assert(m, `slider #${id} is missing min/max`);
  return [+m[1], +m[2]];
};
const [w1lo, w1hi] = range('n-w1'), [w2lo, w2hi] = range('n-w2'), [blo, bhi] = range('n-b');
C.neuronPresets.forEach(p => {
  assert(p.w1 >= w1lo && p.w1 <= w1hi, `preset ${p.n} w1=${p.w1} is outside the slider range`);
  assert(p.w2 >= w2lo && p.w2 <= w2hi, `preset ${p.n} w2=${p.w2} is outside the slider range`);
  assert(p.b >= blo && p.b <= bhi, `preset ${p.n} b=${p.b} is outside the slider range`);
});

/* ---------------------------------------------------------------
   Ch2 — activations and their derivatives
   --------------------------------------------------------------- */
near(MK.ACT.sigmoid.f(0), 0.5, 1e-12, 'sigmoid(0)');
near(MK.ACT.tanh.f(0), 0, 1e-12, 'tanh(0)');
assert.strictEqual(MK.ACT.relu.f(-3), 0, 'relu of a negative must be 0');
assert.strictEqual(MK.ACT.relu.f(2), 2, 'relu of a positive is identity');
assert(MK.ACT.leaky.f(-1) < 0, 'leaky relu must pass a little of the negative through');
// the chapter's central claim: sigmoid's derivative never exceeds 0.25
let maxSig = 0;
for (let z = -8; z <= 8; z += 0.01) maxSig = Math.max(maxSig, MK.ACT.sigmoid.d(MK.ACT.sigmoid.f(z)));
near(maxSig, 0.25, 1e-4, "sigmoid's peak derivative");
assert(/0\.25/.test(JSON.stringify(C.activationCards)) || /0\.25/.test(demos),
  'the 0.25 figure should appear in the course text, since the maths depends on it');
// relu's derivative is exactly 1 where active — the reason it won
assert.strictEqual(MK.ACT.relu.d(3), 1, 'relu derivative must be exactly 1 when active');
// each card must name an activation the kit implements (GELU is plot-only, by design)
C.activationCards.forEach(a => {
  assert(MK.ACT[a.k] || a.k === 'gelu', `activation card "${a.t}" names unknown key "${a.k}"`);
  assert(a.f && a.use && a.watch, `activation card "${a.t}" is incomplete`);
});
// stacking linear layers really does collapse — check it numerically
{
  const net = MK.makeNet([2, 3, 3, 1], 'linear', 11);
  net.layers[net.layers.length - 1].act = 'linear';    // make the output linear too
  const f = x => MK.forward(net, x).out[0];
  // a linear map satisfies f(a) + f(b) - 2f(0) === f(a + b) - f(0)
  const a = [1, 2], b = [-0.5, 3];
  const sum = [a[0] + b[0], a[1] + b[1]];
  near(f(a) + f(b) - f([0, 0]), f(sum), 1e-9,
    'a stack of linear layers must itself be linear — that is the collapse the chapter claims');
}

/* ---------------------------------------------------------------
   Ch3 — XOR. Each architecture must do what its note says.
   --------------------------------------------------------------- */
const xorData = C.xorData;
assert.strictEqual(xorData.length, 4, 'XOR has four cases');
xorData.forEach(d => assert.strictEqual((d.x[0] ^ d.x[1]), d.y, `XOR label wrong for ${d.x}`));

C.xorArchs.forEach(a => {
  const net = MK.makeNet(a.sizes, a.act, 42);
  train(net, xorData, 0.6, 4000);
  const acc = MK.accuracy(net, xorData);
  if (a.id === 'none') {
    // this one is a mathematical certainty, not a seed accident — check several seeds
    for (let seed = 1; seed <= 8; seed++) {
      const n2 = MK.makeNet(a.sizes, a.act, seed * 137);
      train(n2, xorData, 0.6, 4000);
      assert(MK.accuracy(n2, xorData) <= 0.5,
        `a network with no hidden layer reached ${MK.accuracy(n2, xorData)} on XOR — impossible`);
    }
  } else if (a.id === 'small') {
    // the note explicitly says this one stalls from this seed; if that stops being
    // true the note is now wrong and should be rewritten
    assert(acc < 1, 'the "2 hidden units" note claims it stalls from this seed, but it converged');
    assert(/stall/i.test(a.note), 'the 2-unit architecture must warn that it stalls');
  } else {
    assert.strictEqual(acc, 1, `${a.label} should solve XOR in 4000 epochs, got ${acc}`);
  }
});
// the demo's own training budget must be enough for the architectures it promises
const maxEpochs = Number(/maxEpochs: (\d+),[\s\S]{0,120}?onstate: on => \$\('#xor-run'/.exec(demos)[1]);
{
  const good = C.xorArchs.find(a => a.id === 'good');
  const net = MK.makeNet(good.sizes, good.act, 42);
  train(net, xorData, 0.6, maxEpochs);
  assert.strictEqual(MK.accuracy(net, xorData), 1,
    `the XOR demo stops at ${maxEpochs} epochs, which is not enough for "${good.label}" to converge`);
}

/* ---------------------------------------------------------------
   Ch4/5 — the walkthrough network, and backprop itself
   --------------------------------------------------------------- */
const cfg = C.walkNet;
const wNet = MK.makeNet(cfg.sizes, cfg.act, cfg.seed);
const fwd = MK.forward(wNet, cfg.x);
assert.strictEqual(fwd.acts.length, cfg.sizes.length, 'forward must return one activation set per layer');
assert(fwd.out[0] > 0 && fwd.out[0] < 1, 'a sigmoid output must lie strictly inside 0..1');
// the walkthrough is only interesting if the network starts off wrong
assert(Math.abs(fwd.out[0] - cfg.y) > 0.15,
  `the walkthrough net already predicts ${fwd.out[0].toFixed(3)} for target ${cfg.y} — no visible error to backpropagate`);
// there must be exactly one step of narration per thing the demo can show
assert(C.forwardSteps.length >= 4 && C.backpropSteps.length >= 4, 'the walkthroughs need enough steps');
C.forwardSteps.concat(C.backpropSteps).forEach(s => assert(s.t && s.d, 'a walkthrough step is incomplete'));

// THE important check: backprop's analytic gradients must match numerical ones.
// If this passes, every gradient the course displays is genuinely correct.
{
  const net = MK.makeNet([2, 3, 1], 'tanh', 9);
  const x = [0.7, -0.4], y = 1;
  const g = MK.backprop(net, x, y);
  const h = 1e-6;
  net.layers.forEach((L, li) => {
    L.w.forEach((row, i) => row.forEach((orig, j) => {
      L.w[i][j] = orig + h; const up = MK.bce(MK.predict(net, x)[0], y);
      L.w[i][j] = orig - h; const dn = MK.bce(MK.predict(net, x)[0], y);
      L.w[i][j] = orig;
      const numeric = (up - dn) / (2 * h);
      near(g.gw[li][i][j], numeric, 1e-4,
        `analytic gradient for w[${li}][${i}][${j}] disagrees with the numerical one`);
    }));
    L.b.forEach((orig, i) => {
      L.b[i] = orig + h; const up = MK.bce(MK.predict(net, x)[0], y);
      L.b[i] = orig - h; const dn = MK.bce(MK.predict(net, x)[0], y);
      L.b[i] = orig;
      near(g.gb[li][i], (up - dn) / (2 * h), 1e-4,
        `analytic gradient for b[${li}][${i}] disagrees with the numerical one`);
    });
  });
}
// and the output delta really is (prediction − target), which the chapter states outright
{
  const net = MK.makeNet([2, 2, 1], 'tanh', 3);
  const g = MK.backprop(net, [1, 0], 1);
  const pred = MK.predict(net, [1, 0])[0];
  near(g.gb[1][0], pred - 1, 1e-12, 'the output-layer delta must be exactly (ŷ − y)');
}
// training must reduce the loss it is given
{
  const net = MK.makeNet([2, 4, 1], 'tanh', 21);
  const before = MK.netLoss(net, xorData);
  train(net, xorData, 0.6, 300);
  assert(MK.netLoss(net, xorData) < before, 'training must lower the loss');
}

/* ---------------------------------------------------------------
   Ch6 — moons: a line must fail, a hidden layer must succeed
   --------------------------------------------------------------- */
C.moonsData.forEach((p, i) => assert(p.length === 3 && (p[2] === 0 || p[2] === 1),
  `moonsData row ${i} is not [x, y, 0|1]`));
const moons = C.moonsData.map(p => ({ x: [p[0], p[1]], y: p[2] }));
assert(moons.filter(d => d.y === 1).length === moons.filter(d => d.y === 0).length,
  'the moons dataset should be balanced');
const moonAcc = {};
C.moonsArchs.forEach(a => {
  const net = MK.makeNet(a.sizes, a.act, 42);
  train(net, moons, 0.5, 1500);
  moonAcc[a.id] = MK.accuracy(net, moons);
});
assert(moonAcc.linear < 0.95,
  `the no-hidden-layer model reached ${moonAcc.linear} on the moons — the chapter's whole point needs it to fail`);
assert(moonAcc.one > 0.97, `one hidden layer only reached ${moonAcc.one} on the moons`);
assert(moonAcc.deep > 0.97, `the deeper network only reached ${moonAcc.deep} on the moons`);
assert(moonAcc.one > moonAcc.linear, 'adding a hidden layer must visibly help');

/* ---------------------------------------------------------------
   Ch6b — the learning rates must behave as labelled
   --------------------------------------------------------------- */
const lrResults = C.lrCards.map(r => {
  const net = MK.makeNet([2, 6, 1], 'tanh', 42);
  const h = [];
  for (let i = 0; i < 600; i++) h.push(MK.trainStep(net, moons, r.lr, 0));
  return { r, h, final: MK.netLoss(net, moons), acc: MK.accuracy(net, moons) };
});
const small = lrResults.find(x => x.r.tag === 'too small');
const good = lrResults.find(x => x.r.tag === 'good');
const big = lrResults.find(x => x.r.tag === 'too big');
const chaos = lrResults.find(x => x.r.tag === 'chaos');
assert(good.final < small.final,
  'the "good" learning rate must reach a lower loss than the "too small" one');
assert(good.acc > 0.97, `the "good" learning rate only reached ${good.acc} accuracy`);
assert(small.acc < good.acc, 'the "too small" rate must underperform the good one in the same budget');
// "too big" must bounce: the loss must rise somewhere, unlike the good curve
const bounced = arr => arr.some((v, i) => i > 4 && v > arr[i - 1] + 1e-6);
assert(bounced(big.h) || big.final > good.final,
  'the "too big" learning rate must visibly bounce or end worse than the good one');
assert(chaos.acc <= good.acc, 'the "chaos" learning rate must not quietly outperform the good one');
assert(!bounced(good.h.slice(20)), 'the "good" learning rate should settle into a smooth descent');

/* ---------------------------------------------------------------
   Ch7 — regularisation copy, and the dropout mask
   --------------------------------------------------------------- */
C.regCards.forEach(r => assert(r.d && r.why && r.code && r.ico, `reg card "${r.t}" is incomplete`));
{
  const mask = MK.dropoutMask(1000, 0.5, 5);
  const dropped = mask.filter(m => m === 0).length;
  assert(dropped > 400 && dropped < 600, `a 0.5 dropout mask dropped ${dropped} of 1000 — not close to half`);
  assert.strictEqual(MK.dropoutMask(100, 0, 5).filter(m => m === 0).length, 0,
    'a rate of 0 must drop nothing');
  // the same seed must give the same mask, or the demo flickers unpredictably
  assert.strictEqual(MK.dropoutMask(50, 0.4, 9).join(''), MK.dropoutMask(50, 0.4, 9).join(''),
    'dropoutMask must be deterministic for a given seed');
}

/* ---------------------------------------------------------------
   Ch8 — gradients really do vanish, and only for the activation
   the chapter blames
   --------------------------------------------------------------- */
const flow = {};
C.flowActs.forEach(a => { flow[a.k] = MK.gradientFlow(8, a.k, 7); });
Object.keys(flow).forEach(k => {
  assert.strictEqual(flow[k].length, 8, `gradientFlow returned the wrong number of layers for ${k}`);
  flow[k].forEach(m => assert(Number.isFinite(m) && m >= 0, `${k} produced a non-finite gradient`));
});
const shrink = k => flow[k][flow[k].length - 1] / Math.max(flow[k][0], 1e-30);
assert(shrink('sigmoid') > 1000,
  `sigmoid only shrinks the gradient ${shrink('sigmoid').toFixed(1)}× over 8 layers — the chapter promises orders of magnitude`);
assert(shrink('relu') < 100,
  `ReLU shrinks the gradient ${shrink('relu').toFixed(1)}× — it is supposed to be the fix`);
assert(shrink('sigmoid') > shrink('relu') * 10,
  'sigmoid must vanish far more than ReLU, or the chapter teaches the wrong lesson');
// ReLU must not be dead: an all-zero flow would draw a misleading chart
assert(flow.relu.some(m => m > 1e-6), 'the ReLU gradient flow is all zeros — the probe network died');
// and it must get worse with depth, which is the slider's whole purpose
assert(MK.gradientFlow(14, 'sigmoid', 7)[0] < MK.gradientFlow(4, 'sigmoid', 7)[0],
  'deeper sigmoid networks must have smaller first-layer gradients');
const depthRange = range('flow-depth');
assert(depthRange[1] >= 8, 'the depth slider must reach at least 8 to show the effect');
C.initCards.forEach(i => assert(['good', 'bad'].includes(i.verdict) && i.d,
  `init card "${i.t}" is incomplete`));
assert(C.initCards.some(i => i.verdict === 'good') && C.initCards.some(i => i.verdict === 'bad'),
  'the initialisation cards need both good and bad examples');

/* ---------------------------------------------------------------
   Ch9 — convolution, checked by hand
   --------------------------------------------------------------- */
{
  // identity kernel must return the interior of the image untouched
  const ident = C.convKernels.find(k => k.t === 'identity');
  const out = MK.convolve(C.convImage, ident.k);
  assert.strictEqual(out.length, C.convImage.length - 2, 'a 3x3 valid convolution loses two rows');
  assert.strictEqual(out[0].length, C.convImage[0].length - 2, 'a 3x3 valid convolution loses two columns');
  for (let y = 0; y < out.length; y++)
    for (let x = 0; x < out[0].length; x++)
      assert.strictEqual(out[y][x], C.convImage[y + 1][x + 1],
        `the identity kernel changed pixel (${x}, ${y})`);
}
{
  // a known 3x3 window, computed by hand
  const img = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const k = [[1, 0, 0], [0, 2, 0], [0, 0, 3]];
  assert.strictEqual(MK.convolve(img, k)[0][0], 1 * 1 + 5 * 2 + 9 * 3,
    'convolution is not summing the element-wise product');
}
C.convKernels.forEach(k => {
  assert.strictEqual(k.k.length, 3, `kernel "${k.t}" is not 3 rows`);
  k.k.forEach(row => assert.strictEqual(row.length, 3, `kernel "${k.t}" has a row that is not 3 wide`));
  assert(k.why, `kernel "${k.t}" has no explanation`);
  // it must actually do something to this image, or the demo shows a flat rectangle
  const out = MK.convolve(C.convImage, k.k).reduce((a, r) => a.concat(r), []);
  assert(Math.max.apply(null, out) - Math.min.apply(null, out) > 0.1,
    `kernel "${k.t}" produces a flat feature map on this image`);
});
// the edge kernels must respond to the edges the copy says they do
{
  const vert = C.convKernels.find(k => /vertical/.test(k.t));
  const horiz = C.convKernels.find(k => /horizontal/.test(k.t));
  const vOut = MK.convolve(C.convImage, vert.k);
  const hOut = MK.convolve(C.convImage, horiz.k);
  // total response over a band, not the peak: the vertical kernel also spikes at the
  // top bar's two ends, so a max-based comparison would tie and prove nothing
  const energy = (g, y0, y1) => {
    let s = 0;
    for (let y = y0; y <= y1 && y < g.length; y++)
      for (let x = 0; x < g[0].length; x++) s += Math.abs(g[y][x]);
    return s;
  };
  // output rows 0-2 cover the horizontal top bar; rows 6-9 cover the vertical stroke
  assert(energy(hOut, 0, 2) > energy(vOut, 0, 2) * 1.3,
    'the horizontal-edge kernel must respond more to the top bar than the vertical one does');
  assert(energy(vOut, 6, 9) > energy(hOut, 6, 9) * 1.3,
    'the vertical-edge kernel must respond more to the vertical stroke than the horizontal one does');
}
// the image must actually contain something
{
  const on = C.convImage.reduce((a, r) => a + r.filter(v => v > 0).length, 0);
  assert(on > 10, 'the convolution demo image is nearly blank');
  C.convImage.forEach((r, i) => assert.strictEqual(r.length, C.convImage[0].length,
    `convImage row ${i} is a different width`));
}
// pooling halves the grid and keeps maxima
{
  const pooled = MK.maxPool([[1, 2, 9, 4], [5, 6, 7, 8], [1, 1, 1, 1], [1, 1, 1, 1]], 2);
  assert.strictEqual(pooled.length, 2, 'max pooling must halve the height');
  assert.strictEqual(pooled[0][0], 6, 'max pooling must keep the block maximum');
  assert.strictEqual(pooled[0][1], 9, 'max pooling must keep the block maximum');
  assert.strictEqual(MK.relu2d([[-1, 2]])[0][0], 0, 'relu2d must clamp negatives to zero');
}
// the parameter-count comparison the chapter makes must be arithmetically true
{
  const dense = MK.denseParams(28, 28, 128), conv = MK.convParams(3, 3, 32, 1);
  assert.strictEqual(dense, 28 * 28 * 128 + 128, 'dense parameter count is wrong');
  assert.strictEqual(conv, (3 * 3 * 1 + 1) * 32, 'conv parameter count is wrong');
  assert(dense > conv * 100, 'the dense-vs-conv comparison should be dramatic, or the point is lost');
}
C.cnnStack.forEach(s => assert(s.d && s.n, `CNN stack row "${s.t}" is incomplete`));
C.convWhy.forEach(w => assert(w.d, `conv rationale "${w.t}" is incomplete`));

/* ---------------------------------------------------------------
   Ch10 / Ch11 / Ch12 — the rest
   --------------------------------------------------------------- */
C.seqCards.forEach(s => assert(s.d && s.fail && s.era, `sequence card "${s.t}" is incomplete`));
assert(C.seqCards.some(s => /transformer/i.test(s.t)), 'the sequence chapter must reach transformers');
C.debugChecklist.forEach(d => assert(d.s && d.fix, 'a debug row is incomplete'));
assert(C.sanityRules.length >= 3, 'the sanity rules list is too short to be useful');
assert(/backward\(\)/.test(C.frameworkCode) && /step\(\)/.test(C.frameworkCode),
  'the framework snippet must show backward() and step(), which the course just explained');
C.quiz.forEach((q, i) => {
  assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`);
  assert.strictEqual(new Set(q.o).size, q.o.length, `quiz ${i} has duplicate options`);
  assert(q.e, `quiz ${i} has no explanation`);
});
C.glossary.forEach(t => assert(t.length === 2 && t[0] && t[1], `glossary entry ${t[0]} is malformed`));

/* ---------------------------------------------------------------
   Wiring
   --------------------------------------------------------------- */
const ids = new Set();
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));
assert(html.indexOf('js/mathkit.js') < html.indexOf('js/content.js'), 'mathkit.js must load first');
assert(html.indexOf('js/content.js') < html.indexOf('js/demos.js'), 'content.js must load before demos.js');

const chapters = [...html.matchAll(/<section class="chapter"([^>]*)>/g)].map(m => m[1]);
assert(chapters.length >= 12, `only ${chapters.length} chapters found`);
chapters.forEach(attrs => ['data-id', 'data-title', 'data-icon', 'data-group']
  .forEach(a => assert(attrs.includes(a), `a chapter is missing ${a}`)));
const chapterIds = chapters.map(a => /data-id="([^"]+)"/.exec(a)[1]);
assert.strictEqual(new Set(chapterIds).size, chapterIds.length, 'two chapters share a data-id');
for (const m of demos.matchAll(/e\.detail === '([a-z-]+)'/g))
  assert(chapterIds.includes(m[1]), `demos.js redraws on chapter "${m[1]}", which does not exist`);

console.log(`ok — ${chapters.length} chapters, gradients verified against numerical differentiation, ` +
  `sigmoid vanishes ${Math.round(shrink('sigmoid')).toLocaleString()}× over 8 layers vs ReLU's ${shrink('relu').toFixed(1)}×`);
