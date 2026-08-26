/* ============================================================
   mathkit.js — the actual machine learning.

   Kept apart from demos.js so that test.js can run the very same
   functions the page runs. If a number on screen is wrong, the
   test is wrong too — which is the point: there is one
   implementation, not one for the demo and one for the check.
   ============================================================ */
(function (root) {
'use strict';

/* ---------- ordinary least squares, closed form ---------- */
function ols(pts) {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  const w = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) /
            pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return { w, b: my - w * mx };
}
const lineMSE = (pts, w, b) => pts.reduce((a, [x, y]) => a + (y - (w * x + b)) ** 2, 0) / pts.length;

/* One gradient-descent step on MSE for y = wx + b. */
function gdStep(pts, w, b, lr) {
  const n = pts.length;
  let gw = 0, gb = 0;
  pts.forEach(([x, y]) => { const e = (w * x + b) - y; gw += 2 * e * x; gb += 2 * e; });
  return { w: w - lr * gw / n, b: b - lr * gb / n };
}

/* ---------- polynomial least squares ----------
   x is rescaled to [-1, 1] before fitting, which is what keeps
   degree 9 from collapsing into numerical mush.               */
function polyFit(pts, deg, xr) {
  const sc = x => (2 * (x - xr[0]) / (xr[1] - xr[0])) - 1;
  const m = deg + 1;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  pts.forEach(([x, y]) => {
    const t = sc(x);
    const pw = [1];
    for (let k = 1; k <= 2 * deg; k++) pw[k] = pw[k - 1] * t;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) A[i][j] += pw[i + j];
      A[i][m] += pw[i] * y;
    }
  });
  for (let i = 0; i < m; i++) {                       // Gaussian elimination, partial pivoting
    let piv = i;
    for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    if (Math.abs(A[piv][i]) < 1e-12) continue;
    const tmp = A[i]; A[i] = A[piv]; A[piv] = tmp;
    for (let r = 0; r < m; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= m; c++) A[r][c] -= f * A[i][c];
    }
  }
  const co = A.map((row, i) => Math.abs(row[i]) < 1e-12 ? 0 : row[m] / row[i]);
  const f = x => { const t = sc(x); let v = 0, p = 1; for (let i = 0; i < m; i++) { v += co[i] * p; p *= t; } return v; };
  f.coef = co;
  return f;
}
const mse = (pts, f) => pts.reduce((a, [x, y]) => a + (y - f(x)) ** 2, 0) / pts.length;

/* ---------- logistic regression ---------- */
const sigmoid = z => 1 / (1 + Math.exp(-z));
function logregStep(rows, w1, w2, b, lr) {
  let g1 = 0, g2 = 0, gb = 0;
  rows.forEach(([x, y, l]) => { const e = sigmoid(w1 * x + w2 * y + b) - l; g1 += e * x; g2 += e * y; gb += e; });
  const n = rows.length;
  return { w1: w1 - lr * g1 / n, w2: w2 - lr * g2 / n, b: b - lr * gb / n };
}
function logregAccuracy(rows, w1, w2, b) {
  const hit = rows.filter(([x, y, l]) => (sigmoid(w1 * x + w2 * y + b) >= 0.5 ? 1 : 0) === l).length;
  return hit / rows.length;
}

/* ---------- classification metrics ---------- */
function confusion(scored, thr) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  scored.forEach(([s, l]) => {
    const pred = s >= thr ? 1 : 0;
    if (pred === 1 && l === 1) tp++;
    else if (pred === 1 && l === 0) fp++;
    else if (pred === 0 && l === 0) tn++;
    else fn++;
  });
  return { tp, fp, tn, fn };
}
function rates(cm) {
  const precision = cm.tp + cm.fp ? cm.tp / (cm.tp + cm.fp) : 0;
  const recall = cm.tp + cm.fn ? cm.tp / (cm.tp + cm.fn) : 0;
  return {
    precision, recall,
    f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0,
    accuracy: (cm.tp + cm.tn) / (cm.tp + cm.tn + cm.fp + cm.fn)
  };
}
function rocPoints(scored) {
  const P = scored.filter(s => s[1] === 1).length, N = scored.length - P;
  const sorted = scored.slice().sort((a, b) => b[0] - a[0]);
  const pts = [[0, 0]];
  let tp = 0, fp = 0;
  sorted.forEach(([, l]) => { if (l === 1) tp++; else fp++; pts.push([fp / N, tp / P]); });
  return pts;
}
function auc(scored) {
  const pts = rocPoints(scored);
  let a = 0;
  for (let i = 1; i < pts.length; i++) a += (pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1]) / 2;
  return a;
}

/* ---------- decision trees ---------- */
function gini(rows) {
  if (!rows.length) return 0;
  const p = rows.filter(r => r[1] === 1).length / rows.length;
  return 1 - p * p - (1 - p) * (1 - p);
}
function splitGain(rows, thr) {
  const L = rows.filter(r => r[0] < thr), R = rows.filter(r => r[0] >= thr);
  if (!L.length || !R.length) return null;
  const weighted = (L.length * gini(L) + R.length * gini(R)) / rows.length;
  return { thr, gain: gini(rows) - weighted, L, R, weighted };
}
function bestSplit(rows) {
  const cands = [];
  const xs = Array.from(new Set(rows.map(r => r[0]))).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const s = splitGain(rows, (xs[i - 1] + xs[i]) / 2);
    if (s) cands.push(s);
  }
  return cands.reduce((a, b) => (b.gain > a.gain ? b : a), cands[0]);
}

/* ---------- k-means ----------
   Centres are seeded deterministically so the demo, the test and
   every reload agree on what happens.                            */
function kmSeed(data, k) {
  const c = [];
  for (let i = 0; i < k; i++) { const p = data[(i * 7 + 3) % data.length]; c.push([p[0], p[1]]); }
  return c;
}
function kmAssign(data, centres) {
  return data.map(([x, y]) => {
    let bi = 0, bd = Infinity;
    centres.forEach((c, i) => { const d = (x - c[0]) ** 2 + (y - c[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
    return bi;
  });
}
function kmMove(data, centres, assign) {
  return centres.map((c, i) => {
    const mine = data.filter((_, j) => assign[j] === i);
    if (!mine.length) return c;
    return [mine.reduce((a, p) => a + p[0], 0) / mine.length,
            mine.reduce((a, p) => a + p[1], 0) / mine.length];
  });
}
function inertia(data, centres, assign) {
  return data.reduce((a, [x, y], j) => {
    const c = centres[assign[j]];
    return a + (x - c[0]) ** 2 + (y - c[1]) ** 2;
  }, 0);
}

/* ---------- scaling ---------- */
function standardise(values) {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
  return { mean: m, sd, z: values.map(v => (v - m) / sd) };
}

const MK = { ols, lineMSE, gdStep, polyFit, mse, sigmoid, logregStep, logregAccuracy,
             confusion, rates, rocPoints, auc, gini, splitGain, bestSplit,
             kmSeed, kmAssign, kmMove, inertia, standardise };

root.MK = MK;
if (typeof module !== 'undefined' && module.exports) module.exports = MK;

})(typeof window !== 'undefined' ? window : globalThis);
