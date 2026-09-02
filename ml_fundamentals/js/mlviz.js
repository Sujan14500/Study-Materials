/* ============================================================
   mlviz.js — four diagnostics that are much easier to see than
   to read about. Self-mounting: each widget looks for its own
   element and does nothing if the page has not got one.

   All the arithmetic lives in mathkit.js so test.js runs the very
   same functions the page runs. Nothing here computes anything.
   ============================================================ */
(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const xp = (n, m) => window.awardXP && window.awardXP(n, m);
const SVG = 'http://www.w3.org/2000/svg';

/* ============================================================
   1. Bias and variance, measured by resampling
   ============================================================ */
(function biasVariance() {
  const root = $('#bv'); if (!root) return;

  root.innerHTML =
    '<div class="mv-ctrl">' +
      '<label>Model complexity — polynomial degree <b id="bv-d">1</b></label>' +
      '<input type="range" id="bv-r" min="1" max="10" step="1" value="1">' +
      '<div class="mv-hint">Twelve training sets are drawn from the same true curve. Each thin line is one model.</div>' +
    '</div>' +
    '<div class="mv-two">' +
      '<div><svg id="bv-fit" viewBox="0 0 420 260"></svg>' +
        '<div class="mv-cap"><span class="mv-k" style="--c:#94a3b8">one fit each</span>' +
        '<span class="mv-k" style="--c:#7c5cff">average fit</span>' +
        '<span class="mv-k" style="--c:#34d399">the truth</span></div></div>' +
      '<div><svg id="bv-bar" viewBox="0 0 300 260"></svg>' +
        '<div class="mv-verdict" id="bv-v"></div></div>' +
    '</div>';

  const fitSvg = $('#bv-fit'), barSvg = $('#bv-bar');
  const XR = [0, 4], YR = [-1.6, 2.2];
  const px = x => 34 + (x - XR[0]) / (XR[1] - XR[0]) * 372;
  const py = y => 232 - (y - YR[0]) / (YR[1] - YR[0]) * 208;
  const clip = y => Math.max(YR[0] - 0.4, Math.min(YR[1] + 0.4, y));

  function path(f, cls, w, op) {
    let d = '';
    for (let i = 0; i <= 60; i++) {
      const x = XR[0] + (XR[1] - XR[0]) * i / 60;
      d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(clip(f(x))).toFixed(1);
    }
    return '<path d="' + d + '" class="' + cls + '" stroke-width="' + w + '" opacity="' + op + '"/>';
  }

  /* a fixed reference so the bars keep a stable scale as the slider moves */
  const REF = 0.9;

  function draw(deg) {
    const r = MK.biasVariance(deg);
    let g = '<rect x="34" y="24" width="372" height="208" class="mv-plot"/>';
    r.fits.forEach(f => { g += path(f, 'mv-thin', 1, .5); });
    g += path(MK.truth, 'mv-true', 2.4, 1);
    const meanF = x => {
      const i = Math.max(0, Math.min(r.xs.length - 1,
        Math.round((x - XR[0]) / (XR[1] - XR[0]) * (r.xs.length - 1))));
      return r.mean[i];
    };
    g += path(meanF, 'mv-mean', 2.6, 1);
    fitSvg.innerHTML = g;

    const parts = [
      { k: 'bias²', v: r.bias2, c: '#fb923c', t: 'how far the AVERAGE model is from the truth' },
      { k: 'variance', v: r.variance, c: '#22d3ee', t: 'how far the models are from EACH OTHER' },
      { k: 'noise', v: r.noise, c: '#94a3b8', t: 'irreducible — no model removes it' }
    ];
    const scale = v => Math.min(150, v / REF * 150);
    let b = '<text x="8" y="18" class="mv-ax">error, decomposed</text>';
    parts.forEach((p, i) => {
      const h = scale(p.v), y = 210 - h, x = 30 + i * 88;
      b += '<rect x="' + x + '" y="' + y + '" width="52" height="' + h + '" rx="5" fill="' + p.c + '" opacity=".85"><title>' + p.t + '</title></rect>';
      b += '<text x="' + (x + 26) + '" y="' + (y - 6) + '" class="mv-val">' + p.v.toFixed(3) + '</text>';
      b += '<text x="' + (x + 26) + '" y="228" class="mv-lbl">' + p.k + '</text>';
    });
    b += '<line x1="12" y1="210" x2="290" y2="210" class="mv-axis"/>';
    b += '<text x="12" y="248" class="mv-tot">total error ' + r.total.toFixed(3) + '</text>';
    barSvg.innerHTML = b;

    const v = $('#bv-v');
    const msg = deg <= 2
      ? '<b>Underfitting.</b> Every model looks the same and every one of them is wrong. Bias dominates — more data will not help, a bigger model will.'
      : deg <= 4
      ? '<b>About right.</b> Bias has collapsed and variance has not yet taken over. This is the bottom of the U.'
      : '<b>Overfitting.</b> Each model chases its own noise, so the fits disagree wildly. Variance dominates — more data or more regularisation will help, a bigger model will not.';
    v.innerHTML = msg;
    v.className = 'mv-verdict ' + (deg <= 2 ? 'warn' : deg <= 4 ? 'good' : 'bad');
  }

  const r = $('#bv-r');
  r.oninput = () => { $('#bv-d').textContent = r.value; draw(+r.value); };
  r.onchange = () => xp(2);
  draw(1);
})();

/* ============================================================
   2. Learning curves — the "would more data help?" diagnostic
   ============================================================ */
(function learningCurves() {
  const root = $('#lc'); if (!root) return;

  const REGIMES = [
    { id: 'bias', n: 'High bias', cap: 0.62, noise: 0.06,
      d: 'A model too simple for the data. Both curves flatten out high and close together.',
      fix: 'More data will not help at all. Add features, add capacity, or reduce regularisation.' },
    { id: 'var', n: 'High variance', cap: 0.06, noise: 0.05,
      d: 'A model that memorises. Training error is near zero, validation error is far above it.',
      fix: 'More data will help, and so will regularisation or fewer features. A bigger model will not.' },
    { id: 'ok', n: 'Well balanced', cap: 0.16, noise: 0.06,
      d: 'The curves converge, close together, near the noise floor.',
      fix: 'You are near the limit of this data. Squeezing more out means better features, not more rows.' }
  ];
  let cur = REGIMES[1];

  root.innerHTML =
    '<div class="chip-row" id="lc-chips"></div>' +
    '<div class="mv-two">' +
      '<div><svg id="lc-svg" viewBox="0 0 440 260"></svg>' +
        '<div class="mv-cap"><span class="mv-k" style="--c:#7c5cff">training error</span>' +
        '<span class="mv-k" style="--c:#fb7185">validation error</span>' +
        '<span class="mv-k" style="--c:#94a3b8">noise floor</span></div></div>' +
      '<div class="mv-side">' +
        '<div class="mv-ctrl"><label>Training examples <b id="lc-n">120</b></label>' +
        '<input type="range" id="lc-r" min="10" max="240" step="5" value="120"></div>' +
        '<div class="mv-stats" id="lc-stats"></div>' +
        '<div class="mv-verdict" id="lc-v"></div>' +
      '</div>' +
    '</div>';

  const chips = $('#lc-chips');
  REGIMES.forEach(g => {
    const b = document.createElement('button');
    b.className = 'chip' + (g === cur ? ' active' : '');
    b.textContent = g.n;
    b.onclick = () => {
      cur = g;
      Array.from(chips.children).forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      draw(); xp(2);
    };
    chips.appendChild(b);
  });

  const svg = $('#lc-svg');
  const NX = [0, 240], NY = [0, 1.5];
  const px = n => 40 + n / NX[1] * 380;
  const py = e => 224 - Math.min(1, e / NY[1]) * 196;

  function curve(key, cls) {
    let d = '';
    for (let n = 6; n <= NX[1]; n += 4) {
      const l = MK.learningCurve(n, cur.cap, cur.noise);
      d += (d ? 'L' : 'M') + px(n).toFixed(1) + ' ' + py(l[key]).toFixed(1);
    }
    return '<path d="' + d + '" class="' + cls + '" stroke-width="2.6"/>';
  }

  function draw() {
    const n = +$('#lc-r').value;
    const l = MK.learningCurve(n, cur.cap, cur.noise);
    let g = '<rect x="40" y="28" width="380" height="196" class="mv-plot"/>';
    g += '<line x1="40" y1="' + py(cur.noise) + '" x2="420" y2="' + py(cur.noise) + '" class="mv-floor"/>';
    g += curve('train', 'mv-train') + curve('val', 'mv-valline');
    /* the gap, shaded — the gap IS the variance */
    g += '<line x1="' + px(n) + '" y1="' + py(l.train) + '" x2="' + px(n) + '" y2="' + py(l.val) + '" class="mv-gap"/>';
    g += '<circle cx="' + px(n) + '" cy="' + py(l.train) + '" r="5" fill="#7c5cff"/>';
    g += '<circle cx="' + px(n) + '" cy="' + py(l.val) + '" r="5" fill="#fb7185"/>';
    g += '<line x1="40" y1="224" x2="420" y2="224" class="mv-axis"/>';
    g += '<text x="230" y="250" class="mv-lbl">training set size &rarr;</text>';
    g += '<text x="8" y="34" class="mv-ax">error</text>';
    svg.innerHTML = g;

    $('#lc-n').textContent = n;
    $('#lc-stats').innerHTML =
      '<div class="mv-st"><span>train</span><b>' + l.train.toFixed(3) + '</b></div>' +
      '<div class="mv-st"><span>validation</span><b>' + l.val.toFixed(3) + '</b></div>' +
      '<div class="mv-st hot"><span>the gap</span><b>' + l.gap.toFixed(3) + '</b></div>';

    const wide = l.gap > 0.18;
    const v = $('#lc-v');
    v.className = 'mv-verdict ' + (wide ? 'bad' : cur.id === 'bias' ? 'warn' : 'good');
    v.innerHTML = '<b>' + cur.n + '.</b> ' + cur.d + '<br><br><b>What to do:</b> ' + cur.fix;
  }
  $('#lc-r').oninput = draw;
  draw();
})();

/* ============================================================
   3. L1 vs L2 — why one selects features and the other does not
   ============================================================ */
(function regPath() {
  const root = $('#regpath'); if (!root) return;

  const COEFS = [0.92, -0.71, 0.48, -0.34, 0.19, 0.11, -0.06, 0.03];
  const NAMES = ['tenure', 'spend', 'logins', 'tickets', 'region', 'device', 'referrer', 'hour'];
  let kind = 'l1';

  root.innerHTML =
    '<div class="chip-row" id="rp-chips">' +
      '<button class="chip active" data-k="l1">L1 &mdash; Lasso</button>' +
      '<button class="chip" data-k="l2">L2 &mdash; Ridge</button></div>' +
    '<div class="mv-ctrl"><label>Regularisation strength &lambda; = <b id="rp-l">0.00</b></label>' +
      '<input type="range" id="rp-r" min="0" max="100" step="1" value="0"></div>' +
    '<svg id="rp-svg" viewBox="0 0 640 250"></svg>' +
    '<div class="mv-verdict" id="rp-v"></div>';

  const svg = $('#rp-svg');

  function draw() {
    const lam = +$('#rp-r').value / 100;
    $('#rp-l').textContent = lam.toFixed(2);
    const out = MK.regPath(COEFS, lam, kind);
    const alive = out.filter(c => c !== 0).length;

    let g = '<line x1="30" y1="120" x2="620" y2="120" class="mv-axis"/>';
    out.forEach((c, i) => {
      const x = 46 + i * 73, h = Math.abs(c) * 105;
      const y = c >= 0 ? 120 - h : 120;
      const dead = c === 0;
      g += '<rect x="' + x + '" y="' + (dead ? 117 : y) + '" width="44" height="' + (dead ? 6 : h) + '" rx="4" ' +
           'fill="' + (dead ? '#3b415c' : c >= 0 ? '#34d399' : '#fb7185') + '" opacity="' + (dead ? .6 : .85) + '">' +
           '<title>' + NAMES[i] + ': ' + c.toFixed(3) + '</title></rect>';
      g += '<text x="' + (x + 22) + '" y="' + (c >= 0 ? y - 7 : y + h + 15) + '" class="mv-val">' +
           (dead ? '0' : c.toFixed(2)) + '</text>';
      g += '<text x="' + (x + 22) + '" y="243" class="mv-lbl">' + NAMES[i] + '</text>';
    });
    svg.innerHTML = g;

    const v = $('#rp-v');
    if (kind === 'l1') {
      v.className = 'mv-verdict ' + (alive < 8 ? 'good' : '');
      v.innerHTML = '<b>L1 is soft thresholding.</b> Once &lambda; exceeds a coefficient it becomes exactly zero, ' +
        'and the feature is gone from the model. <b>' + alive + ' of 8</b> features survive. ' +
        'That is feature selection, done by the optimiser rather than by you.';
    } else {
      v.className = 'mv-verdict';
      v.innerHTML = '<b>L2 divides everything by (1 + &lambda;).</b> Every coefficient shrinks towards zero ' +
        'and none of them arrives. <b>All 8</b> features are still in the model, each contributing a little less. ' +
        'That is why Ridge handles correlated features gracefully and never gives you a shorter model.';
    }
  }

  Array.from($('#rp-chips').children).forEach(b => b.onclick = () => {
    kind = b.dataset.k;
    Array.from($('#rp-chips').children).forEach(c => c.classList.remove('active'));
    b.classList.add('active'); draw(); xp(2);
  });
  $('#rp-r').oninput = draw;
  draw();
})();

/* ============================================================
   4. The accuracy paradox
   ============================================================ */
(function imbalance() {
  const root = $('#imb'); if (!root) return;

  root.innerHTML =
    '<div class="mv-ctrl">' +
      '<label>Positive class rate <b id="im-r">2.0%</b> &nbsp;&middot;&nbsp; 10,000 cases</label>' +
      '<input type="range" id="im-s" min="5" max="500" step="5" value="20">' +
      '<div class="mv-hint">A decent model: catches 60% of the positives, false-alarms on 2% of the negatives.</div>' +
    '</div>' +
    '<div class="mv-two">' +
      '<div><svg id="im-svg" viewBox="0 0 320 230"></svg></div>' +
      '<div class="mv-side"><div class="mv-stats" id="im-stats"></div>' +
      '<div class="mv-verdict" id="im-v"></div></div>' +
    '</div>';

  const svg = $('#im-svg');

  function draw() {
    const rate = +$('#im-s').value / 1000;
    $('#im-r').textContent = (rate * 100).toFixed(1) + '%';
    const m = MK.imbalance(rate, 0.60, 0.02, 10000);

    const cells = [
      { l: 'TP', v: m.tp, x: 150, y: 46, c: '#34d399', t: 'caught' },
      { l: 'FN', v: m.fn, x: 236, y: 46, c: '#fb7185', t: 'missed' },
      { l: 'FP', v: m.fp, x: 150, y: 132, c: '#fbbf24', t: 'false alarm' },
      { l: 'TN', v: m.tn, x: 236, y: 132, c: '#3b415c', t: 'correctly ignored' }
    ];
    let g = '<text x="150" y="26" class="mv-ax">predicted +</text>' +
            '<text x="236" y="26" class="mv-ax">predicted &minus;</text>' +
            '<text x="10" y="72" class="mv-ax">actual +</text>' +
            '<text x="10" y="158" class="mv-ax">actual &minus;</text>';
    cells.forEach(c => {
      g += '<rect x="' + (c.x - 40) + '" y="' + (c.y - 8) + '" width="80" height="70" rx="9" fill="' + c.c + '" opacity=".2" stroke="' + c.c + '" stroke-opacity=".5"/>';
      g += '<text x="' + c.x + '" y="' + (c.y + 26) + '" class="mv-cell">' + c.v.toLocaleString() + '</text>';
      g += '<text x="' + c.x + '" y="' + (c.y + 48) + '" class="mv-lbl">' + c.l + ' &middot; ' + c.t + '</text>';
    });
    svg.innerHTML = g;

    $('#im-stats').innerHTML =
      '<div class="mv-st"><span>accuracy</span><b>' + (m.accuracy * 100).toFixed(1) + '%</b></div>' +
      '<div class="mv-st"><span>"always say no"</span><b>' + (m.majorityAccuracy * 100).toFixed(1) + '%</b></div>' +
      '<div class="mv-st hot"><span>precision</span><b>' + (m.precision * 100).toFixed(1) + '%</b></div>' +
      '<div class="mv-st hot"><span>recall</span><b>' + (m.recall * 100).toFixed(1) + '%</b></div>' +
      '<div class="mv-st hot"><span>F1</span><b>' + (m.f1 * 100).toFixed(1) + '%</b></div>';

    const beaten = m.accuracy < m.majorityAccuracy;
    const v = $('#im-v');
    v.className = 'mv-verdict ' + (beaten ? 'bad' : 'good');
    v.innerHTML = beaten
      ? '<b>The model scores worse on accuracy than a constant.</b> A function that returns "no" every ' +
        'single time gets ' + (m.majorityAccuracy * 100).toFixed(1) + '%. Report accuracy here and you will be asked ' +
        'to explain, in a meeting, why the useful model looks worse than nothing.'
      : '<b>Balanced enough that accuracy is not lying.</b> Drag the rate down and watch accuracy stay high ' +
        'while precision collapses — that is the moment accuracy stops being a metric and becomes a decoration.';
  }
  $('#im-s').oninput = draw;
  $('#im-s').onchange = () => xp(2);
  draw();
})();
})();
