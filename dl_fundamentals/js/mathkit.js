/* ============================================================
   mathkit.js — the actual neural network.

   Kept apart from demos.js so that test.js can run the very same
   functions the page runs. Forward passes, backpropagation,
   convolution and the gradient-flow experiment are all here, and
   all real: there is one implementation, not one for the demo and
   one for the check.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- a seeded RNG, so every run and every test agree ---------- */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return function () {                       // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
function gaussian(rand) {
  let u = 0, v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------- activations, each with its derivative ----------
   d() takes the activation's OUTPUT where that is enough (sigmoid,
   tanh, relu), which is the usual implementation trick and is why
   the backward pass below never re-evaluates the forward one.     */
const ACT = {
  sigmoid: { f: z => 1 / (1 + Math.exp(-z)), d: a => a * (1 - a),
             range: [0, 1], name: 'sigmoid' },
  tanh:    { f: z => Math.tanh(z), d: a => 1 - a * a,
             range: [-1, 1], name: 'tanh' },
  relu:    { f: z => (z > 0 ? z : 0), d: a => (a > 0 ? 1 : 0),
             range: [0, Infinity], name: 'ReLU' },
  leaky:   { f: z => (z > 0 ? z : 0.01 * z), d: a => (a > 0 ? 1 : 0.01),
             range: [-Infinity, Infinity], name: 'Leaky ReLU' },
  linear:  { f: z => z, d: () => 1, range: [-Infinity, Infinity], name: 'linear' }
};
/* GELU's exact derivative needs z, not a, so it is kept out of the
   trainable set above and used only for plotting. */
const gelu = z => 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z * z * z)));

/* ============================================================
   A plain fully-connected network. sizes[0] is the input width.
   Hidden layers use `act`; the output layer is always sigmoid,
   paired with binary cross-entropy — which is what makes the
   output-layer delta the clean (a − y) below.
   ============================================================ */
function makeNet(sizes, act, seed) {
  const rand = rng(seed == null ? 42 : seed);
  const layers = [];
  for (let i = 1; i < sizes.length; i++) {
    const fanIn = sizes[i - 1];
    // He initialisation for ReLU-family, Xavier otherwise — Chapter 9 is about why
    const scale = (act === 'relu' || act === 'leaky')
      ? Math.sqrt(2 / fanIn) : Math.sqrt(1 / fanIn);
    layers.push({
      w: Array.from({ length: sizes[i] }, () =>
           Array.from({ length: fanIn }, () => gaussian(rand) * scale)),
      b: new Array(sizes[i]).fill(0),
      act: i === sizes.length - 1 ? 'sigmoid' : act
    });
  }
  return { sizes, layers, act };
}

/* Returns every layer's activations, input first — the backward
   pass needs all of them, and the forward-pass demo displays them. */
function forward(net, x) {
  const acts = [x.slice()];
  const zs = [];
  net.layers.forEach(L => {
    const prev = acts[acts.length - 1];
    const z = L.w.map((row, i) => row.reduce((a, wij, j) => a + wij * prev[j], 0) + L.b[i]);
    const f = ACT[L.act].f;
    zs.push(z);
    acts.push(z.map(f));
  });
  return { acts, zs, out: acts[acts.length - 1] };
}
const predict = (net, x) => forward(net, x).out;

/* Binary cross-entropy, clamped so a confident wrong answer does not
   become Infinity and take the whole loss curve with it. */
function bce(pred, target) {
  const p = Math.min(1 - 1e-9, Math.max(1e-9, pred));
  return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
}
function netLoss(net, data) {
  return data.reduce((a, d) => a + bce(predict(net, d.x)[0], d.y), 0) / data.length;
}

/* Backpropagation for one example. Returns gradients with the same
   shape as the weights, plus the per-layer delta magnitudes that
   Chapter 9 plots to show gradients vanishing with depth. */
function backprop(net, x, y) {
  const { acts } = forward(net, x);
  const L = net.layers.length;
  const gw = net.layers.map(l => l.w.map(row => row.map(() => 0)));
  const gb = net.layers.map(l => l.b.map(() => 0));
  const mags = new Array(L).fill(0);

  // output layer: sigmoid + BCE collapses to (a − y)
  let delta = [acts[L][0] - y];

  for (let li = L - 1; li >= 0; li--) {
    const prev = acts[li];
    for (let i = 0; i < net.layers[li].w.length; i++) {
      gb[li][i] += delta[i];
      for (let j = 0; j < prev.length; j++) gw[li][i][j] += delta[i] * prev[j];
    }
    mags[li] = Math.sqrt(delta.reduce((a, d) => a + d * d, 0));
    if (li === 0) break;
    // push the error back through the weights, then through the activation
    const dPrev = ACT[net.layers[li - 1].act].d;
    delta = prev.map((a, j) =>
      net.layers[li].w.reduce((s, row, i) => s + row[j] * delta[i], 0) * dPrev(a));
  }
  return { gw, gb, mags };
}

/* One full-batch gradient-descent step. Returns the loss BEFORE the
   update, which is the number a training curve should plot. */
function trainStep(net, data, lr, l2) {
  const gw = net.layers.map(l => l.w.map(row => row.map(() => 0)));
  const gb = net.layers.map(l => l.b.map(() => 0));
  let loss = 0;
  data.forEach(d => {
    const g = backprop(net, d.x, d.y);
    loss += bce(predict(net, d.x)[0], d.y);
    g.gw.forEach((lw, li) => lw.forEach((row, i) => row.forEach((v, j) => { gw[li][i][j] += v; })));
    g.gb.forEach((lb, li) => lb.forEach((v, i) => { gb[li][i] += v; }));
  });
  const n = data.length;
  net.layers.forEach((L, li) => {
    L.w.forEach((row, i) => row.forEach((wv, j) => {
      L.w[i][j] = wv - lr * (gw[li][i][j] / n + (l2 || 0) * wv);
    }));
    L.b.forEach((bv, i) => { L.b[i] = bv - lr * gb[li][i] / n; });
  });
  return loss / n;
}
function accuracy(net, data) {
  const hit = data.filter(d => (predict(net, d.x)[0] >= 0.5 ? 1 : 0) === d.y).length;
  return hit / data.length;
}

/* ============================================================
   Chapter 9 — why deep sigmoid networks stop learning.
   Builds a chain of `depth` layers and measures how big the
   gradient still is by the time it reaches layer 0.

   Width matters here: a chain of single-unit ReLU layers dies
   almost immediately (one negative pre-activation zeroes the whole
   path), which would demonstrate dying ReLU rather than vanishing
   gradients. Width 8 is the smallest that reliably shows the
   phenomenon the chapter is actually about.
   ============================================================ */
function gradientFlow(depth, act, seed, width) {
  const w = width || 8;
  const sizes = new Array(depth + 1).fill(w);
  sizes[depth] = 1;                                  // one sigmoid output
  const net = makeNet(sizes, act, seed == null ? 7 : seed);
  const x = new Array(w).fill(1);
  const { mags } = backprop(net, x, 1);
  return mags;                    // mags[0] is the first layer — the one that starves
}

/* ============================================================
   Convolution — a real 2D cross-correlation, the operation every
   framework calls "conv". No padding, stride 1.
   ============================================================ */
function convolve(img, kernel) {
  const kh = kernel.length, kw = kernel[0].length;
  const h = img.length - kh + 1, w = img[0].length - kw + 1;
  const out = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ky = 0; ky < kh; ky++)
        for (let kx = 0; kx < kw; kx++) s += img[y + ky][x + kx] * kernel[ky][kx];
      row.push(s);
    }
    out.push(row);
  }
  return out;
}
function maxPool(grid, size) {
  const s = size || 2;
  const out = [];
  for (let y = 0; y + s <= grid.length; y += s) {
    const row = [];
    for (let x = 0; x + s <= grid[0].length; x += s) {
      let m = -Infinity;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) m = Math.max(m, grid[y + dy][x + dx]);
      row.push(m);
    }
    out.push(row);
  }
  return out;
}
const relu2d = g => g.map(r => r.map(v => (v > 0 ? v : 0)));

/* Parameter counts for the dense-vs-conv comparison in Chapter 10. */
function denseParams(inputH, inputW, units) { return inputH * inputW * units + units; }
function convParams(kh, kw, filters, inChannels) { return (kh * kw * (inChannels || 1) + 1) * filters; }

/* ---------- dropout: a mask, not a deletion ---------- */
function dropoutMask(n, rate, seed) {
  const rand = rng(seed == null ? 3 : seed);
  return Array.from({ length: n }, () => (rand() < rate ? 0 : 1));
}

/* ---------- optimisers on a ravine ----------
   A stretched quadratic: steep across the valley, almost flat along
   it. This is the shape that makes plain SGD zig-zag, and it is why
   momentum and Adam exist. The surface is deliberately simple so the
   optimiser behaviour, not the landscape, is what you are watching. */
function ravine(x, y, a) { const A = a || 12; return 0.5 * (A * x * x + y * y); }
function ravineGrad(x, y, a) { const A = a || 12; return [A * x, y]; }

/* One step of each optimiser. State is passed in and returned, so the
   page and the test step them identically. */
function optStep(kind, p, st, lr, a) {
  const g = ravineGrad(p[0], p[1], a);
  const s = st || { v: [0, 0], m: [0, 0], vv: [0, 0], t: 0 };
  let step;
  if (kind === 'sgd') {
    step = [lr * g[0], lr * g[1]];
  } else if (kind === 'momentum') {
    const b = 0.9;
    s.v = [b * s.v[0] + g[0], b * s.v[1] + g[1]];
    step = [lr * s.v[0], lr * s.v[1]];
  } else {                                        // adam
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    s.t += 1;
    s.m = [b1 * s.m[0] + (1 - b1) * g[0], b1 * s.m[1] + (1 - b1) * g[1]];
    s.vv = [b2 * s.vv[0] + (1 - b2) * g[0] * g[0], b2 * s.vv[1] + (1 - b2) * g[1] * g[1]];
    const mh = [s.m[0] / (1 - Math.pow(b1, s.t)), s.m[1] / (1 - Math.pow(b1, s.t))];
    const vh = [s.vv[0] / (1 - Math.pow(b2, s.t)), s.vv[1] / (1 - Math.pow(b2, s.t))];
    step = [lr * mh[0] / (Math.sqrt(vh[0]) + eps), lr * mh[1] / (Math.sqrt(vh[1]) + eps)];
  }
  return { p: [p[0] - step[0], p[1] - step[1]], st: s };
}

/* Run one optimiser and return the whole path, so the widget can draw
   it and the test can measure where it got to. */
function optPath(kind, start, lr, steps, a) {
  let p = start.slice(), st = null;
  const path = [p.slice()];
  for (let i = 0; i < (steps || 60); i++) {
    const r = optStep(kind, p, st, lr, a);
    p = r.p; st = r.st;
    if (!isFinite(p[0]) || !isFinite(p[1])) break;
    path.push(p.slice());
  }
  return { kind, path, final: p, loss: ravine(p[0], p[1], a) };
}

/* ---------- what normalisation actually does ----------
   Push a batch of activations through `depth` layers. Without
   normalisation the scale compounds: gain < 1 collapses towards zero,
   gain > 1 explodes. Normalising after each layer resets the scale to
   1 every time, which is the entire mechanism.                      */
function activationScale(depth, gain, normalise, seed) {
  const rand = rng(seed || 7);
  let batch = [];
  for (let i = 0; i < 256; i++) batch.push(gaussian(rand));
  const out = [];
  for (let l = 0; l < depth; l++) {
    batch = batch.map(v => v * gain * (1 + 0.04 * gaussian(rand)));
    batch = batch.map(v => (v > 0 ? v : 0));          // ReLU
    if (normalise) {
      const m = batch.reduce((a, b) => a + b, 0) / batch.length;
      const sd = Math.sqrt(batch.reduce((a, b) => a + (b - m) ** 2, 0) / batch.length) || 1e-8;
      batch = batch.map(v => (v - m) / sd);
    }
    const m = batch.reduce((a, b) => a + b, 0) / batch.length;
    const sd = Math.sqrt(batch.reduce((a, b) => a + (b - m) ** 2, 0) / batch.length);
    const dead = batch.filter(v => Math.abs(v) < 1e-6).length / batch.length;
    out.push({ layer: l + 1, mean: m, sd, dead });
  }
  return out;
}

const MK = { rng, gaussian, ACT, gelu, makeNet, forward, predict, bce, netLoss,
             backprop, trainStep, accuracy, gradientFlow, convolve, maxPool, relu2d,
             denseParams, convParams, dropoutMask,
             ravine, ravineGrad, optStep, optPath, activationScale };

root.MK = MK;
if (typeof module !== 'undefined' && module.exports) module.exports = MK;

})(typeof window !== 'undefined' ? window : globalThis);
