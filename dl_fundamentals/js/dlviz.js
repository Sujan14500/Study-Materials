/* ============================================================
   dlviz.js — two things that are far easier to see than to read
   about: why plain gradient descent struggles on a stretched
   surface, and what normalisation actually does to a deep stack.

   Self-mounting. All arithmetic lives in mathkit.js so test.js
   runs the same functions the page runs.
   ============================================================ */
(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const xp = (n, m) => window.awardXP && window.awardXP(n, m);

/* ============================================================
   1. The optimiser race on a ravine
   ============================================================ */
(function optimisers() {
  const root = $('#opt'); if (!root) return;

  const A = 40, START = [-2.4, 2.0], STEPS = 60;
  const RUNS = [
    { k: 'sgd', n: 'SGD', c: '#fb7185',
      d: 'Follows the gradient. The steepest direction sets the largest learning rate it can survive, so it crawls along the flat one.' },
    { k: 'momentum', n: 'Momentum', c: '#fbbf24',
      d: 'Accumulates a velocity. Consistent gradients along the valley build up; the oscillation across it cancels itself out.' },
    { k: 'adam', n: 'Adam', c: '#34d399',
      d: 'Divides each coordinate by its own recent gradient size, so the step is roughly the learning rate in every direction regardless of curvature.' }
  ];

  root.innerHTML =
    '<div class="dv-ctrl">' +
      '<label>Learning rate <b id="op-lr">0.045</b> <span class="dv-note">stability limit for SGD here is 2/curvature = 0.050</span></label>' +
      '<input type="range" id="op-r" min="5" max="70" step="1" value="45">' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-ghost" id="op-play">&#9654; Run</button>' +
        '<button class="btn btn-ghost" id="op-reset">reset</button>' +
        '<span class="dv-step">step <b id="op-n">0</b> / ' + STEPS + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="dv-two">' +
      '<div><svg id="op-svg" viewBox="0 0 420 300"></svg></div>' +
      '<div class="dv-side" id="op-side"></div>' +
    '</div>' +
    '<div class="mv-verdict" id="op-v"></div>';

  const svg = $('#op-svg');
  const XR = [-3, 3], YR = [-2.6, 2.6];
  const px = x => 20 + (x - XR[0]) / (XR[1] - XR[0]) * 380;
  const py = y => 285 - (y - YR[0]) / (YR[1] - YR[0]) * 270;
  const ok = v => isFinite(v) && Math.abs(v) < 1e4;

  let at = 0, timer = null, runs = [];

  function compute() {
    const lr = +$('#op-r').value / 1000;
    $('#op-lr').textContent = lr.toFixed(3);
    runs = RUNS.map(r => Object.assign({}, r, MK.optPath(r.k, START, lr, STEPS, A)));
  }

  function contours() {
    /* level sets of 0.5(A x² + y²) are ellipses; draw a few */
    let g = '';
    [0.15, 0.6, 1.6, 3.4, 6.2].forEach(L => {
      const rx = Math.sqrt(2 * L / A), ry = Math.sqrt(2 * L);
      g += '<ellipse cx="' + px(0) + '" cy="' + py(0) + '" ' +
           'rx="' + (rx / (XR[1] - XR[0]) * 380).toFixed(1) + '" ' +
           'ry="' + (ry / (YR[1] - YR[0]) * 270).toFixed(1) + '" class="dv-contour"/>';
    });
    g += '<circle cx="' + px(0) + '" cy="' + py(0) + '" r="4" class="dv-min"/>';
    g += '<text x="' + (px(0) + 9) + '" y="' + (py(0) + 4) + '" class="dv-lbl2">minimum</text>';
    return g;
  }

  function draw() {
    let g = '<rect x="20" y="15" width="380" height="270" class="mv-plot"/>' + contours();
    runs.forEach(r => {
      const pts = r.path.slice(0, at + 1).filter(p => ok(p[0]) && ok(p[1]));
      if (pts.length > 1) {
        const d = pts.map((p, i) => (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('');
        g += '<path d="' + d + '" fill="none" stroke="' + r.c + '" stroke-width="2" opacity=".85"/>';
      }
      const last = pts[pts.length - 1] || START;
      g += '<circle cx="' + px(last[0]) + '" cy="' + py(last[1]) + '" r="5" fill="' + r.c + '"/>';
    });
    g += '<circle cx="' + px(START[0]) + '" cy="' + py(START[1]) + '" r="4" class="dv-start"/>';
    g += '<text x="' + (px(START[0]) - 6) + '" y="' + (py(START[1]) - 10) + '" class="dv-lbl2">start</text>';
    svg.innerHTML = g;

    $('#op-n').textContent = at;
    $('#op-side').innerHTML = runs.map(r => {
      const p = r.path[Math.min(at, r.path.length - 1)];
      const loss = ok(p[0]) && ok(p[1]) ? MK.ravine(p[0], p[1], A) : Infinity;
      const dead = !isFinite(loss) || loss > 1e3;
      return '<div class="dv-card" style="--c:' + r.c + '">' +
        '<div class="dv-h"><b>' + r.n + '</b>' +
        (dead ? '<span class="dv-badge bad">diverged</span>'
              : '<span class="dv-badge">loss ' + loss.toExponential(1) + '</span>') + '</div>' +
        '<p>' + r.d + '</p></div>';
    }).join('');

    verdict();
  }

  function verdict() {
    const lr = +$('#op-r').value / 1000;
    const v = $('#op-v');
    if (lr > 0.05) {
      v.className = 'mv-verdict bad';
      v.innerHTML = '<b>SGD has diverged.</b> On a quadratic, plain gradient descent is stable only while the ' +
        'learning rate stays under 2 divided by the largest curvature &mdash; here 2/40 = 0.050. One step past it ' +
        'and the steep direction amplifies instead of shrinking. Adam survives because its step size does not ' +
        'scale with the gradient.';
    } else if (lr < 0.02) {
      v.className = 'mv-verdict warn';
      v.innerHTML = '<b>Safe and slow.</b> Every optimiser is stable, and SGD is barely moving along the valley floor. ' +
        'This is the real cost of an ill-conditioned surface: the learning rate you are allowed is set by the steepest ' +
        'direction, and the flat direction is the one you actually need to travel.';
    } else {
      v.className = 'mv-verdict good';
      v.innerHTML = '<b>Watch the shapes, not the winner.</b> SGD zig-zags across the valley because the steep direction ' +
        'dominates every step. Momentum cancels that oscillation and accelerates along the floor. Adam takes ' +
        'roughly the same size step in both directions, which is exactly what an ill-conditioned surface needs. ' +
        'Each of the three would use a different learning rate in practice &mdash; comparing them at one rate is the ' +
        'comparison, not a verdict.';
    }
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; $('#op-play').innerHTML = '&#9654; Run'; } }
  $('#op-play').onclick = () => {
    if (timer) return stop();
    if (at >= STEPS) at = 0;
    $('#op-play').innerHTML = '&#10073;&#10073; Pause';
    timer = setInterval(() => { at++; if (at >= STEPS) { at = STEPS; stop(); } draw(); }, 55);
    xp(3);
  };
  $('#op-reset').onclick = () => { stop(); at = 0; draw(); };
  $('#op-r').oninput = () => { stop(); at = 0; compute(); draw(); };

  compute(); draw();
})();

/* ============================================================
   2. What normalisation actually does
   ============================================================ */
(function normalisation() {
  const root = $('#normviz'); if (!root) return;

  const DEPTH = 10;
  root.innerHTML =
    '<div class="dv-ctrl">' +
      '<label>Per-layer gain <b id="nv-g">0.60</b> <span class="dv-note">below 1 the signal shrinks, above 1 it grows &mdash; every layer multiplies</span></label>' +
      '<input type="range" id="nv-r" min="40" max="180" step="5" value="60">' +
      '<label class="dv-check" style="margin-top:10px">' +
        '<input type="checkbox" id="nv-n"> normalise after every layer' +
      '</label>' +
    '</div>' +
    '<svg id="nv-svg" viewBox="0 0 620 230"></svg>' +
    '<div class="mv-verdict" id="nv-v"></div>';

  const svg = $('#nv-svg');

  function draw() {
    const gain = +$('#nv-r').value / 100;
    const norm = $('#nv-n').checked;
    $('#nv-g').textContent = gain.toFixed(2);
    const rows = MK.activationScale(DEPTH, gain, norm, 7);

    /* log scale, because the whole point is that the change is multiplicative */
    const lo = -4, hi = 2;                                   // log10 bounds
    const ly = sd => {
      const v = Math.log10(Math.max(1e-9, sd));
      return 190 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * 160;
    };

    let g = '<rect x="42" y="26" width="560" height="164" class="mv-plot"/>';
    [-4, -3, -2, -1, 0, 1, 2].forEach(t => {
      g += '<line x1="42" y1="' + ly(Math.pow(10, t)) + '" x2="602" y2="' + ly(Math.pow(10, t)) + '" class="dv-grid"/>';
      g += '<text x="36" y="' + (ly(Math.pow(10, t)) + 4) + '" class="dv-tick">1e' + t + '</text>';
    });
    g += '<line x1="42" y1="' + ly(1) + '" x2="602" y2="' + ly(1) + '" class="dv-healthy"/>';

    let d = '';
    rows.forEach((r, i) => {
      const x = 42 + (i + 0.5) / DEPTH * 560;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + ly(r.sd).toFixed(1);
      const col = r.sd < 0.05 ? '#fb7185' : r.sd > 6 ? '#fbbf24' : '#34d399';
      g += '<circle cx="' + x.toFixed(1) + '" cy="' + ly(r.sd).toFixed(1) + '" r="4.5" fill="' + col + '">' +
           '<title>layer ' + r.layer + ': sd ' + r.sd.toExponential(2) + ', ' +
           (r.dead * 100).toFixed(0) + '% of units at zero</title></circle>';
      g += '<text x="' + x.toFixed(1) + '" y="212" class="mv-lbl">' + r.layer + '</text>';
    });
    g = g.replace('<rect x="42" y="26" width="560" height="164" class="mv-plot"/>',
      '<rect x="42" y="26" width="560" height="164" class="mv-plot"/>') +
      '<path d="' + d + '" fill="none" stroke="' + (norm ? '#34d399' : '#7c5cff') + '" stroke-width="2.4"/>';
    g += '<text x="322" y="228" class="mv-lbl">layer depth &rarr;</text>';
    g += '<text x="8" y="20" class="mv-ax">activation spread (log)</text>';
    svg.innerHTML = g;

    const last = rows[rows.length - 1];
    const first = rows[0];
    const ratio = last.sd / first.sd;
    const v = $('#nv-v');
    if (norm) {
      v.className = 'mv-verdict good';
      v.innerHTML = '<b>Flat, at any gain.</b> Normalisation rescales the activations back to a spread of 1 after ' +
        'every layer, so the gain stops compounding. Drag the slider anywhere &mdash; the line does not move. That is ' +
        'the whole mechanism, and it is why very deep networks became trainable at all.';
    } else if (ratio < 0.05) {
      v.className = 'mv-verdict bad';
      v.innerHTML = '<b>The signal has vanished.</b> Spread fell by <b>' + (1 / ratio).toFixed(0) + '&times;</b> over ' +
        DEPTH + ' layers, because a gain below 1 is applied again at every one. The gradient on the way back shrinks ' +
        'by the same factor, so the early layers receive almost nothing and stop learning. Tick the box.';
    } else if (ratio > 20) {
      v.className = 'mv-verdict bad';
      v.innerHTML = '<b>The signal has exploded.</b> Spread grew <b>' + ratio.toFixed(0) + '&times;</b> over ' + DEPTH +
        ' layers. In training this is where you see NaN losses. Gradient clipping treats the symptom; normalisation ' +
        'and careful initialisation treat the cause.';
    } else {
      v.className = 'mv-verdict warn';
      v.innerHTML = '<b>Roughly stable &mdash; and only because the gain happens to be near 1.</b> This is what ' +
        'careful initialisation buys you: the right starting scale. It is a knife edge, and it drifts as the weights ' +
        'train. Normalisation makes it hold by construction instead of by luck.';
    }
  }
  $('#nv-r').oninput = draw;
  $('#nv-n').onchange = () => { draw(); xp(3); };
  draw();
})();
})();
