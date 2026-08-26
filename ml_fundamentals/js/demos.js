/* ============================================================
   demos.js — every interactive widget.

   The maths here is real: ordinary least squares, gradient
   descent, logistic regression, ROC/AUC, Gini impurity and
   k-means are all computed live from the arrays in content.js.
   Nothing is a pre-baked number.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = (n, msg) => window.awardXP && window.awardXP(n, msg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const fmt = (n, d) => Number(n).toFixed(d == null ? 2 : d);

/* Every piece of maths in this file lives in mathkit.js, so test.js
   can check the same implementation the page actually runs. */
const { ols, lineMSE, gdStep, polyFit, mse, sigmoid, logregStep,
        confusion, rocPoints, auc, gini, splitGain, bestSplit,
        kmSeed, kmAssign, kmMove, inertia, standardise } = window.MK;

/* ------------------------------------------------------------
   A tiny plotting helper. Every chart in the course draws
   through this so the axes look the same everywhere.
   ------------------------------------------------------------ */
function plot(canvas, xr, yr, pad) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const p = Object.assign({ l: 46, r: 14, t: 14, b: 32 }, pad);
  const X = v => p.l + (v - xr[0]) / (xr[1] - xr[0]) * (w - p.l - p.r);
  const Y = v => h - p.b - (v - yr[0]) / (yr[1] - yr[0]) * (h - p.t - p.b);
  return {
    ctx, w, h, p, X, Y,
    grid(xt, yt, xlab, ylab) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(165,171,196,.75)'; ctx.font = '10px ui-monospace, monospace';
      const nx = xt || 5, ny = yt || 4;
      for (let i = 0; i <= nx; i++) {
        const v = xr[0] + (xr[1] - xr[0]) * i / nx;
        ctx.beginPath(); ctx.moveTo(X(v), p.t); ctx.lineTo(X(v), h - p.b); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1), X(v), h - p.b + 14);
      }
      for (let i = 0; i <= ny; i++) {
        const v = yr[0] + (yr[1] - yr[0]) * i / ny;
        ctx.beginPath(); ctx.moveTo(p.l, Y(v)); ctx.lineTo(w - p.r, Y(v)); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1), p.l - 7, Y(v) + 3.5);
      }
      if (xlab) { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(111,117,148,.95)';
        ctx.fillText(xlab, p.l + (w - p.l - p.r) / 2, h - 4); }
      if (ylab) { ctx.save(); ctx.translate(11, p.t + (h - p.t - p.b) / 2); ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center'; ctx.fillText(ylab, 0, 0); ctx.restore(); }
    },
    dot(x, y, c, r) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(x), Y(y), r || 4, 0, 7); ctx.fill(); },
    ring(x, y, c, r) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Y(y), r || 5, 0, 7); ctx.stroke(); },
    line(pts, c, wdt, dash) {
      ctx.strokeStyle = c; ctx.lineWidth = wdt || 2; ctx.setLineDash(dash || []);
      ctx.beginPath(); pts.forEach((pt, i) => i ? ctx.lineTo(X(pt[0]), Y(pt[1])) : ctx.moveTo(X(pt[0]), Y(pt[1])));
      ctx.stroke(); ctx.setLineDash([]);
    },
    seg(x1, y1, x2, y2, c, wdt, dash) {
      ctx.strokeStyle = c; ctx.lineWidth = wdt || 1; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); ctx.setLineDash([]);
    }
  };
}

/* ============================================================
   Background particles + the hero pipeline
   ============================================================ */
function initBackground() {
  const cv = $('#bg-particles'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let pts = [], W = 0, H = 0;
  function resize() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    const count = Math.min(70, Math.round(W * H / 26000));
    pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: Math.random() * 1.6 + .6
    }));
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.fillStyle = 'rgba(160,180,255,.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = dx * dx + dy * dy;
      if (d2 < 20000) {
        ctx.strokeStyle = 'rgba(124,92,255,' + (0.16 * (1 - d2 / 20000)) + ')';
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }
  resize(); window.addEventListener('resize', resize);
  if (!reduced()) frame();

  const g = $('#hero-nodes'), path = $('#flow-path');
  if (g && path && path.getTotalLength) {
    const len = path.getTotalLength();
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 13);
      c.setAttribute('fill', 'rgba(12,15,28,.9)');
      c.setAttribute('stroke', ['#7c5cff', '#8f6bff', '#22d3ee', '#2ee6c0', '#34d399'][i]);
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
    }
  }
}

/* ============================================================
   Ch1 — kinds of learning, and when not to learn at all
   ============================================================ */
function initKinds() {
  const root = $('#ml-kinds'); if (!root) return;
  C.mlKinds.forEach(k => {
    const c = el('div', 'kind-card reveal');
    c.innerHTML =
      '<div class="kind-ico">' + k.ico + '</div><h3>' + k.k + '</h3>' +
      '<p class="pcard-desc">' + k.d + '</p>' +
      '<ul class="fact-list mini">' + k.ex.map(e => '<li>' + e + '</li>').join('') + '</ul>' +
      '<div class="kind-foot"><b>Needs:</b> ' + k.needs + '</div>' +
      '<div class="kind-algos mono">' + k.algos + '</div>';
    root.appendChild(c);
  });
}

function initRulesVsML() {
  const root = $('#rules-ml'); if (!root) return;
  let done = 0, right = 0;
  C.rulesVsML.forEach(c => {
    const card = el('div', 'rm-card reveal');
    card.innerHTML = '<div class="rm-q">' + c.q + '</div>' +
      '<div class="rm-opts"><button class="qopt" data-v="rules">write rules</button>' +
      '<button class="qopt" data-v="ml">train a model</button></div><div class="rm-body"></div>';
    $$('.qopt', card).forEach(b => b.onclick = () => {
      if (card.classList.contains('answered')) return;
      card.classList.add('answered'); done++;
      $$('.qopt', card).forEach(x => { x.disabled = true; if (x.dataset.v === c.verdict) x.classList.add('correct'); });
      if (b.dataset.v !== c.verdict) b.classList.add('incorrect'); else right++;
      $('.rm-body', card).innerHTML =
        '<div class="ct-two"><div><div class="ct-tag' + (c.verdict === 'rules' ? ' good' : ' bad') + '">rules</div>' +
        '<pre class="code">' + esc(c.rules) + '</pre></div>' +
        '<div><div class="ct-tag' + (c.verdict === 'ml' ? ' good' : ' bad') + '">machine learning</div>' +
        '<pre class="code">' + esc(c.ml) + '</pre></div></div><div class="ct-why">' + c.why + '</div>';
      $('.rm-body', card).classList.add('show');
      xp(b.dataset.v === c.verdict ? 4 : 1,
         done === C.rulesVsML.length ? '+XP — ' + right + '/' + done + ' on "should this even be ML?"' : null);
    });
    root.appendChild(card);
  });
}

/* ============================================================
   Ch2 — the split, animated
   ============================================================ */
function initSplit() {
  const root = $('#split-demo'); if (!root) return;
  root.innerHTML =
    '<div class="split-bar" id="split-bar"></div>' +
    '<div class="split-cards" id="split-cards"></div>' +
    '<div class="btn-row"><button class="btn" id="split-go">▶ Replay the split</button></div>';
  const bar = $('#split-bar', root), cards = $('#split-cards', root);

  C.splitParts.forEach(p => {
    const seg = el('div', 'split-seg');
    seg.style.background = p.c + '33';
    seg.style.borderColor = p.c;
    seg.innerHTML = '<b>' + p.n + '</b><span>' + p.pct + '%</span>';
    bar.appendChild(seg);
    const c = el('div', 'split-card');
    c.style.borderColor = p.c + '55';
    c.innerHTML = '<h4 style="color:' + p.c + '">' + p.n + '</h4><p>' + p.d + '</p>' +
      '<div class="split-warn">⚠ ' + p.warn + '</div>';
    cards.appendChild(c);
  });

  function run() {
    $$('.split-seg', bar).forEach((s, i) => {
      s.style.transition = 'none'; s.style.flexGrow = '0'; s.style.opacity = '0';
      setTimeout(() => {
        s.style.transition = 'flex-grow .7s cubic-bezier(.4,0,.2,1), opacity .4s';
        s.style.flexGrow = String(C.splitParts[i].pct);
        s.style.opacity = '1';
      }, reduced() ? 0 : 120 + i * 260);
    });
  }
  $('#split-go', root).onclick = () => { run(); xp(2); };
  run();
}

function initLeak() {
  const root = $('#leak-cards'); if (!root) return;
  C.leakCases.forEach(c => {
    const card = el('div', 'panel reveal');
    card.innerHTML = '<div class="panel-head"><h3>🩸 ' + c.t + '</h3></div>' +
      '<div class="ct-two"><div><div class="ct-tag bad">leaks</div><pre class="code">' + c.bad + '</pre></div>' +
      '<div><div class="ct-tag good">safe</div><pre class="code">' + c.good + '</pre></div></div>' +
      '<div class="ct-why">' + c.why + '</div>';
    root.appendChild(card);
  });
}

/* ============================================================
   Ch3 — fit a line by hand, then let the maths do it
   ============================================================ */
function initRegression() {
  const cv = $('#reg-canvas'); if (!cv) return;
  const wIn = $('#reg-w'), bIn = $('#reg-b');
  let w = C.regStart.w, b = C.regStart.b, showRes = true;
  const best = ols(C.regData);
  const xr = [0, 10.4], yr = [30, 96];

  function draw() {
    const P = plot(cv, xr, yr);
    P.grid(5, 4, C.regLabels.x, C.regLabels.y);
    if (showRes) C.regData.forEach(([x, y]) => {
      const pred = w * x + b;
      P.seg(x, y, x, pred, 'rgba(251,113,133,.55)', 1.5);
    });
    P.line([[xr[0], w * xr[0] + b], [xr[1], w * xr[1] + b]], '#7c5cff', 2.5);
    C.regData.forEach(([x, y]) => P.dot(x, y, '#22d3ee', 4));
    const e = lineMSE(C.regData, w, b);
    $('#reg-mse').textContent = fmt(e, 2);
    $('#reg-eq').textContent = 'score = ' + fmt(w, 2) + ' × hours + ' + fmt(b, 1);
    const bestE = lineMSE(C.regData, best.w, best.b);
    const pct = Math.max(0, Math.min(100, 100 * bestE / Math.max(e, 1e-9)));
    $('#reg-bar').style.width = pct + '%';
    $('#reg-verdict').textContent = e <= bestE * 1.02 ? 'that is the best line there is'
      : e <= bestE * 1.15 ? 'close' : e <= bestE * 2 ? 'getting warmer' : 'a long way off';
  }
  function sync() { wIn.value = w; bIn.value = b; $('#reg-wv').textContent = fmt(w, 2); $('#reg-bv').textContent = fmt(b, 1); draw(); }

  wIn.oninput = () => { w = +wIn.value; sync(); };
  bIn.oninput = () => { b = +bIn.value; sync(); };
  $('#reg-res').onclick = e => { showRes = !showRes; e.target.classList.toggle('active', showRes); draw(); };
  $('#reg-solve').onclick = () => {
    const w0 = w, b0 = b, t0 = performance.now();
    (function anim(t) {
      const k = Math.min(1, (t - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      w = w0 + (best.w - w0) * e; b = b0 + (best.b - b0) * e;
      sync();
      if (k < 1) requestAnimationFrame(anim);
      else xp(5, '+5 XP — least squares, solved in one shot');
    })(t0);
  };
  $('#reg-reset').onclick = () => { w = C.regStart.w; b = C.regStart.b; sync(); };
  $('#reg-res').classList.add('active');
  sync();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'regression') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch4 — gradient descent, four learning rates
   ============================================================ */
function initGD() {
  const cv = $('#gd-canvas'), lossCv = $('#gd-loss'); if (!cv) return;
  const best = ols(C.regData);
  const xr = [0, 10.4], yr = [30, 96];
  let rate = C.gdRates[1], w = C.regStart.w, b = C.regStart.b, hist = [], timer = null, step = 0;

  const rateRow = $('#gd-rates');
  C.gdRates.forEach((r, i) => {
    const bt = el('button', 'chip mono' + (i === 1 ? ' active' : ''), 'lr = ' + r.lr + ' · ' + r.tag);
    bt.style.borderColor = r.c + '55';
    bt.onclick = () => { $$('.chip', rateRow).forEach(c => c.classList.remove('active')); bt.classList.add('active'); rate = r; reset(); };
    rateRow.appendChild(bt);
  });

  function reset() {
    stop(); w = C.regStart.w; b = C.regStart.b; step = 0;
    hist = [lineMSE(C.regData, w, b)];
    $('#gd-say').innerHTML = rate.say;
    draw();
  }
  function gradStep() {
    const next = gdStep(C.regData, w, b, rate.lr);
    w = next.w; b = next.b;
    step++;
    const L = lineMSE(C.regData, w, b);
    hist.push(Number.isFinite(L) ? L : Infinity);
    if (hist.length > 120) hist.shift();
    draw();
    if (!Number.isFinite(L) || L > 1e7) { stop(); $('#gd-say').innerHTML =
      '<b style="color:var(--red)">Diverged.</b> ' + rate.say; }
  }
  function draw() {
    const P = plot(cv, xr, yr);
    P.grid(5, 4, C.regLabels.x, C.regLabels.y);
    P.line([[xr[0], best.w * xr[0] + best.b], [xr[1], best.w * xr[1] + best.b]], 'rgba(52,211,153,.5)', 1.5, [5, 5]);
    C.regData.forEach(([x, y]) => P.dot(x, y, '#22d3ee', 3.5));
    if (Number.isFinite(w) && Number.isFinite(b) && Math.abs(w) < 1e6)
      P.line([[xr[0], w * xr[0] + b], [xr[1], w * xr[1] + b]], rate.c, 2.5);

    const fin = hist.filter(Number.isFinite);
    const top = Math.max(10, Math.min(1e4, fin.length ? Math.max.apply(null, fin) : 10));
    const L2 = plot(lossCv, [0, Math.max(20, hist.length)], [0, top], { l: 52 });
    L2.grid(4, 3, 'step', 'loss (MSE)');
    L2.line(hist.map((v, i) => [i, Math.min(v, top)]), rate.c, 2);
    $('#gd-step').textContent = step;
    $('#gd-mse').textContent = Number.isFinite(hist[hist.length - 1]) ? fmt(hist[hist.length - 1], 2) : '∞ — diverged';
    $('#gd-eq').textContent = 'w = ' + (Number.isFinite(w) ? fmt(w, 3) : '∞') + '   b = ' + (Number.isFinite(b) ? fmt(b, 2) : '∞');
  }
  function stop() { clearInterval(timer); timer = null; $('#gd-run').innerHTML = '▶ Train'; }
  $('#gd-run').onclick = () => {
    if (timer) return stop();
    timer = setInterval(gradStep, reduced() ? 1 : 55);
    $('#gd-run').innerHTML = '❚❚ Pause';
    xp(3);
  };
  $('#gd-step1').onclick = () => { stop(); gradStep(); };
  $('#gd-reset').onclick = reset;
  reset();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'gradient') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch5 — logistic regression, trained live
   ============================================================ */
function initClassifier() {
  const cv = $('#clf-canvas'); if (!cv) return;
  const xr = [0, 10], yr = [0, 10.5];
  let w1 = 0, w2 = 0, bb = 0, ep = 0, timer = null;

  function trainStep() {
    const next = logregStep(C.clfData, w1, w2, bb, 0.12);
    w1 = next.w1; w2 = next.w2; bb = next.b;
    ep++;
    draw();
  }
  function draw() {
    const P = plot(cv, xr, yr);
    // probability shading, drawn coarsely so it stays cheap
    const cell = 10;
    for (let px = P.p.l; px < P.w - P.p.r; px += cell) {
      for (let py = P.p.t; py < P.h - P.p.b; py += cell) {
        const x = xr[0] + (px - P.p.l) / (P.w - P.p.l - P.p.r) * (xr[1] - xr[0]);
        const y = yr[0] + (P.h - P.p.b - py) / (P.h - P.p.t - P.p.b) * (yr[1] - yr[0]);
        const pr = sigmoid(w1 * x + w2 * y + bb);
        P.ctx.fillStyle = pr > .5 ? 'rgba(52,211,153,' + ((pr - .5) * .42) + ')'
                                  : 'rgba(124,92,255,' + ((.5 - pr) * .42) + ')';
        P.ctx.fillRect(px, py, cell, cell);
      }
    }
    P.grid(5, 4, C.clfLabels.x, C.clfLabels.y);
    // the boundary is where w1*x + w2*y + b = 0
    if (Math.abs(w2) > 1e-6) {
      const yAt = x => -(w1 * x + bb) / w2;
      P.line([[xr[0], yAt(xr[0])], [xr[1], yAt(xr[1])]], '#fff', 2);
    }
    let correct = 0, tp = 0, fp = 0, fn = 0;
    C.clfData.forEach(([x, y, l]) => {
      const pred = sigmoid(w1 * x + w2 * y + bb) >= .5 ? 1 : 0;
      if (pred === l) correct++; else if (pred === 1) fp++; else fn++;
      if (pred === 1 && l === 1) tp++;
      const c = l ? '#34d399' : '#7c5cff';
      if (pred === l) P.dot(x, y, c, 4.5); else { P.dot(x, y, c, 4.5); P.ring(x, y, '#fb7185', 7.5); }
    });
    $('#clf-acc').textContent = fmt(100 * correct / C.clfData.length, 1) + '%';
    $('#clf-ep').textContent = ep;
    $('#clf-eq').textContent = fmt(w1, 2) + '·x + ' + fmt(w2, 2) + '·y + ' + fmt(bb, 2) + ' = 0';
    $('#clf-wrong').textContent = (C.clfData.length - correct) + ' misclassified';
  }
  function stop() { clearInterval(timer); timer = null; $('#clf-run').innerHTML = '▶ Train'; }
  $('#clf-run').onclick = () => {
    if (timer) return stop();
    timer = setInterval(() => { trainStep(); if (ep >= 600) { stop(); xp(5, '+5 XP — a decision boundary, learned from scratch'); } },
      reduced() ? 1 : 22);
    $('#clf-run').innerHTML = '❚❚ Pause';
  };
  $('#clf-reset').onclick = () => { stop(); w1 = w2 = bb = 0; ep = 0; draw(); };
  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'classification') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch6 — threshold, confusion matrix, ROC
   ============================================================ */
function initMetrics() {
  const root = $('#metrics-demo'); if (!root) return;
  const slider = $('#thr'), rocCv = $('#roc-canvas');
  const A = auc(C.scored);

  function draw() {
    const thr = +slider.value / 100;
    const { tp, fp, tn, fn } = confusion(C.scored, thr);
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
    const acc = (tp + tn) / C.scored.length;

    $('#thr-v').textContent = fmt(thr, 2);
    $('#m-tp').textContent = tp; $('#m-fp').textContent = fp;
    $('#m-fn').textContent = fn; $('#m-tn').textContent = tn;
    $('#m-prec').textContent = fmt(prec, 3);
    $('#m-rec').textContent = fmt(rec, 3);
    $('#m-f1').textContent = fmt(f1, 3);
    $('#m-acc').textContent = fmt(acc, 3);
    $('#m-prec-bar').style.width = (prec * 100) + '%';
    $('#m-rec-bar').style.width = (rec * 100) + '%';
    $('#m-f1-bar').style.width = (f1 * 100) + '%';

    // the scored samples as a strip, sorted by score
    const strip = $('#score-strip', root);
    strip.innerHTML = '';
    C.scored.forEach(([s, l]) => {
      const pred = s >= thr ? 1 : 0;
      const cls = pred === 1 && l === 1 ? 'tp' : pred === 1 && l === 0 ? 'fp' : pred === 0 && l === 1 ? 'fn' : 'tn';
      const d = el('div', 'sdot ' + cls, l ? '●' : '○');
      d.title = 'score ' + s + ' · actually ' + (l ? 'churned' : 'stayed') + ' · called ' + (pred ? 'churn' : 'stay');
      d.style.left = (s * 100) + '%';
      strip.appendChild(d);
    });
    $('#thr-marker', root).style.left = (thr * 100) + '%';

    const P = plot(rocCv, [0, 1], [0, 1], { l: 44, b: 34 });
    P.grid(4, 4, 'false positive rate', 'true positive rate');
    P.seg(0, 0, 1, 1, 'rgba(255,255,255,.22)', 1, [4, 4]);
    P.line(rocPoints(C.scored), '#22d3ee', 2.5);
    // where the current threshold sits on the curve
    const N = C.scored.length - C.scored.filter(s => s[1] === 1).length;
    P.dot(fp / N, rec, '#fbbf24', 5.5);
    $('#m-auc').textContent = fmt(A, 3);

    $('#m-say').innerHTML =
      thr <= 0.25 ? 'A low bar: you flag almost everyone, so recall is high and precision suffers. This is the cancer-screening setting.'
      : thr >= 0.75 ? 'A high bar: only the most confident predictions are flagged. Precision is high, and you are missing real cases.'
      : 'Around the middle, the two trade off almost evenly. There is no "correct" threshold — only the one matching what a mistake costs you.';
  }
  slider.oninput = draw;
  $$('#thr-presets .chip', root).forEach(b => b.onclick = () => {
    slider.value = b.dataset.t; draw();
    $$('#thr-presets .chip', root).forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    xp(2);
  });
  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'evaluation') requestAnimationFrame(draw); });
}

function initMetricPick() {
  const root = $('#metric-pick'); if (!root) return;
  const OPTS = ['precision', 'recall', 'F1', 'ROC-AUC', 'PR-AUC'];
  C.metricPick.forEach(m => {
    const card = el('div', 'ct-card reveal');
    card.innerHTML = '<div class="ct-ask">' + m.case + '</div><div class="ct-opts"></div><div class="ct-body"></div>';
    const opts = $('.ct-opts', card);
    OPTS.forEach(o => {
      const b = el('button', 'qopt ct-opt', o);
      b.onclick = () => {
        if (card.classList.contains('answered')) return;
        card.classList.add('answered');
        $$('.ct-opt', opts).forEach(x => { x.disabled = true; if (x.textContent === m.want) x.classList.add('correct'); });
        if (o !== m.want) b.classList.add('incorrect');
        $('.ct-body', card).innerHTML = '<div class="ct-why">' + m.why + '</div>';
        $('.ct-body', card).classList.add('show');
        xp(o === m.want ? 4 : 1);
      };
      opts.appendChild(b);
    });
    root.appendChild(card);
  });
}

/* ============================================================
   Ch7 — overfitting: degree slider, real polynomial fits
   ============================================================ */
function initOverfit() {
  const cv = $('#of-canvas'), curveCv = $('#of-curve'); if (!cv) return;
  const slider = $('#of-deg');
  const xr = [-0.4, 10.2], yr = [-3, 6];
  const all = C.polyTrain.concat(C.polyTest);
  const fitRange = [Math.min.apply(null, all.map(p => p[0])), Math.max.apply(null, all.map(p => p[0]))];
  const DEGREES = 9;

  // every degree fitted once — this is also what the bias/variance curve plots
  const fits = [];
  for (let d = 1; d <= DEGREES; d++) {
    const f = polyFit(C.polyTrain, d, fitRange);
    fits.push({ d, f, tr: mse(C.polyTrain, f), te: mse(C.polyTest, f) });
  }
  const bestDeg = fits.reduce((a, b) => (b.te < a.te ? b : a)).d;
  const trueLabel = $('#poly-true'); if (trueLabel) trueLabel.textContent = C.polyTrue;

  function draw() {
    const deg = +slider.value;
    const F = fits[deg - 1];
    const P = plot(cv, xr, yr);
    P.grid(5, 4, 'x', 'y');
    const curve = [];
    for (let x = xr[0]; x <= xr[1]; x += 0.05) curve.push([x, Math.max(yr[0] - 5, Math.min(yr[1] + 5, F.f(x)))]);
    P.line(curve, '#7c5cff', 2.5);
    C.polyTrain.forEach(([x, y]) => P.dot(x, y, '#22d3ee', 4.5));
    C.polyTest.forEach(([x, y]) => { P.ring(x, y, '#34d399', 5.5); });

    $('#of-deg-v').textContent = deg;
    $('#of-tr').textContent = fmt(F.tr, 3);
    $('#of-te').textContent = fmt(F.te, 3);
    $('#of-gap').textContent = fmt(F.te - F.tr, 3);
    const verdict = deg <= 2 ? 'under' : deg >= 6 ? 'over' : 'good';
    $('#of-verdict').textContent = verdict === 'under' ? 'underfitting — high bias'
      : verdict === 'over' ? 'overfitting — high variance' : 'about right';
    $('#of-verdict').className = 'of-verdict ' + verdict;
    $('#of-note').innerHTML = C.fitNotes[verdict];

    const top = Math.max.apply(null, fits.map(f => Math.min(f.te, 8))) * 1.15;
    const P2 = plot(curveCv, [1, DEGREES], [0, top], { l: 46, b: 34 });
    P2.grid(DEGREES - 1, 4, 'model complexity (polynomial degree)', 'error (MSE)');
    P2.line(fits.map(f => [f.d, Math.min(f.tr, top)]), '#22d3ee', 2);
    P2.line(fits.map(f => [f.d, Math.min(f.te, top)]), '#34d399', 2);
    P2.seg(deg, 0, deg, top, 'rgba(255,255,255,.35)', 1.5, [4, 4]);
    P2.dot(bestDeg, Math.min(fits[bestDeg - 1].te, top), '#fbbf24', 5);
    $('#of-best').textContent = bestDeg;
  }
  slider.oninput = () => { draw(); xp(1); };
  $('#of-best-btn').onclick = () => { slider.value = bestDeg; draw(); xp(4, '+4 XP — the sweet spot is where test error bottoms out'); };
  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'overfitting') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch8 — k-fold, animated
   ============================================================ */
function initCV() {
  const root = $('#cv-demo'); if (!root) return;
  const K = 5, ROWS = 20;
  root.innerHTML = '<div class="cv-grid" id="cv-grid"></div>' +
    '<div class="btn-row"><button class="btn" id="cv-go">▶ Run the folds</button>' +
    '<span class="cv-score mono" id="cv-score"></span></div>';
  const grid = $('#cv-grid', root);

  for (let k = 0; k < K; k++) {
    const row = el('div', 'cv-row');
    row.innerHTML = '<span class="cv-lab mono">fold ' + (k + 1) + '</span>';
    const track = el('div', 'cv-track');
    for (let i = 0; i < ROWS; i++) {
      const cell = el('div', 'cv-cell');
      // fold k holds out the k-th contiguous block
      if (Math.floor(i / (ROWS / K)) === k) cell.classList.add('held');
      track.appendChild(cell);
    }
    row.appendChild(track);
    row.appendChild(el('span', 'cv-res mono', '—'));
    grid.appendChild(row);
  }

  // per-fold scores are illustrative; the point on screen is which rows are held out
  const scores = [0.84, 0.79, 0.86, 0.81, 0.83];
  $('#cv-go', root).onclick = () => {
    const rows = $$('.cv-row', grid);
    rows.forEach(r => { r.classList.remove('on'); $('.cv-res', r).textContent = '—'; });
    $('#cv-score', root).textContent = '';
    let k = 0;
    (function next() {
      if (k >= K) {
        const mean = scores.reduce((a, b) => a + b, 0) / K;
        const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / K);
        $('#cv-score', root).textContent = 'mean accuracy ' + fmt(mean, 3) + '  ±' + fmt(sd, 3);
        xp(4, '+4 XP — every row held out exactly once');
        return;
      }
      rows.forEach(r => r.classList.remove('on'));
      rows[k].classList.add('on');
      $('.cv-res', rows[k]).textContent = fmt(scores[k], 2);
      k++;
      setTimeout(next, reduced() ? 1 : 620);
    })();
  };
}

function initCVWhen() {
  const root = $('#cv-when'); if (!root) return;
  C.cvWhen.forEach(w => {
    const r = el('div', 'cvw-row reveal');
    r.innerHTML = '<b>' + w.t + '</b><span>' + w.v + '</span>';
    root.appendChild(r);
  });
}

/* ============================================================
   Ch9 — a decision tree's first split, by Gini
   ============================================================ */
function initTree() {
  const cv = $('#tree-canvas'); if (!cv) return;
  const slider = $('#tree-thr');
  const rows = C.treeData;
  const xs = rows.map(r => r[0]);
  const lo = Math.min.apply(null, xs) - 2, hi = Math.max.apply(null, xs) + 2;
  const best = bestSplit(rows);
  slider.min = Math.ceil(lo + 1); slider.max = Math.floor(hi - 1); slider.value = 30;

  // every candidate threshold's gain, so the chart is the real search surface
  const curve = [];
  for (let t = Math.ceil(lo + 1); t <= Math.floor(hi - 1); t += 0.5) {
    const s = splitGain(rows, t);
    if (s) curve.push([t, s.gain]);
  }
  const maxGain = Math.max.apply(null, curve.map(c => c[1]));

  function draw() {
    const thr = +slider.value;
    const s = splitGain(rows, thr) || { gain: 0, L: [], R: [], weighted: gini(rows) };
    const P = plot(cv, [lo, hi], [0, Math.max(maxGain * 1.25, 0.05)], { l: 50, b: 34 });
    P.grid(5, 4, C.treeLabels.x, 'Gini gain from splitting here');
    P.line(curve, 'rgba(124,92,255,.85)', 2);
    P.dot(best.thr, best.gain, '#fbbf24', 5.5);
    P.seg(thr, 0, thr, Math.max(maxGain * 1.25, 0.05), '#fff', 1.5, [4, 4]);

    // the samples themselves, along the bottom
    rows.forEach(([x, l]) => P.dot(x, maxGain * 0.06 * (l ? 1.9 : 1), l ? '#34d399' : '#7c5cff', 4));

    $('#tree-thr-v').textContent = thr;
    $('#tree-gain').textContent = fmt(s.gain, 4);
    $('#tree-parent').textContent = fmt(gini(rows), 4);
    $('#tree-l').innerHTML = 'age &lt; ' + thr + ' → <b>' + s.L.length + '</b> samples, ' +
      s.L.filter(r => r[1] === 1).length + ' churned, gini ' + fmt(gini(s.L), 3);
    $('#tree-r').innerHTML = 'age ≥ ' + thr + ' → <b>' + s.R.length + '</b> samples, ' +
      s.R.filter(r => r[1] === 1).length + ' churned, gini ' + fmt(gini(s.R), 3);
    $('#tree-best').textContent = best.thr;
    $('#tree-verdict').textContent = Math.abs(s.gain - best.gain) < 1e-9
      ? 'this is the best split available' : 'the tree would not choose this one';
  }
  slider.oninput = () => { draw(); xp(1); };
  $('#tree-auto').onclick = () => {
    // walk every candidate so you can watch the search happen
    let i = Math.ceil(lo + 1);
    const t = setInterval(() => {
      slider.value = i; draw();
      if (i++ >= Math.floor(hi - 1)) {
        clearInterval(t);
        slider.value = Math.round(best.thr); draw();
        xp(5, '+5 XP — the tree tries every threshold and keeps the best');
      }
    }, reduced() ? 1 : 60);
  };
  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'trees') requestAnimationFrame(draw); });
}

function initEnsembles() {
  const root = $('#ensembles'); if (!root) return;
  C.ensembleCards.forEach(c => {
    const card = el('div', 'pcard reveal');
    card.innerHTML = '<div class="pcard-badge">' + c.ico + '</div><h3>' + c.n + '</h3>' +
      '<p class="pcard-desc">' + c.d + '</p>' +
      '<div class="pcard-foot"><span class="pill good">' + c.good + '</span></div>' +
      '<div class="pcard-foot"><span class="pill bad">' + c.bad + '</span></div>';
    root.appendChild(card);
  });
}

/* ============================================================
   Ch10 — k-means, animated
   ============================================================ */
function initKmeans() {
  const cv = $('#km-canvas'); if (!cv) return;
  const kIn = $('#km-k');
  const xr = [0, 10], yr = [0, 10];
  const COLORS = ['#7c5cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#f472b6'];
  let k = 3, centres = [], assign = [], iter = 0, phase = 'assign', timer = null;

  function seed() {
    stop();
    k = +kIn.value; iter = 0; phase = 'assign';
    // deliberately poor starting positions so the first moves are visible
    centres = kmSeed(C.kmData, k);
    assign = C.kmData.map(() => -1);
    draw();
  }
  function assignStep() { assign = kmAssign(C.kmData, centres); }
  function moveStep()   { centres = kmMove(C.kmData, centres, assign); }
  function step() {
    if (phase === 'assign') { assignStep(); phase = 'move'; }
    else { moveStep(); phase = 'assign'; iter++; }
    draw();
  }

  function draw() {
    const P = plot(cv, xr, yr);
    P.grid(5, 5, 'feature 1', 'feature 2');
    C.kmData.forEach(([x, y], j) => {
      const c = assign[j] < 0 ? 'rgba(165,171,196,.55)' : COLORS[assign[j] % COLORS.length];
      if (assign[j] >= 0) P.seg(x, y, centres[assign[j]][0], centres[assign[j]][1], c + '44', 1);
      P.dot(x, y, c, 4);
    });
    centres.forEach((c, i) => {
      P.ctx.fillStyle = COLORS[i % COLORS.length];
      P.ctx.strokeStyle = '#fff'; P.ctx.lineWidth = 2;
      P.ctx.beginPath(); P.ctx.arc(P.X(c[0]), P.Y(c[1]), 9, 0, 7); P.ctx.fill(); P.ctx.stroke();
    });
    $('#km-iter').textContent = iter;
    $('#km-phase').textContent = phase === 'assign' ? 'next: assign points to the nearest centre'
                                                    : 'next: move each centre to its points\' mean';
    $('#km-inertia').textContent = assign.some(a => a >= 0) ? fmt(inertia(C.kmData, centres, assign), 1) : '—';
  }
  function stop() { clearInterval(timer); timer = null; if ($('#km-run')) $('#km-run').innerHTML = '▶ Run'; }
  $('#km-run').onclick = () => {
    if (timer) return stop();
    timer = setInterval(() => {
      const before = JSON.stringify(centres);
      step();
      if (phase === 'assign' && before === JSON.stringify(centres)) {
        stop(); xp(5, '+5 XP — converged: the centres stopped moving');
      }
    }, reduced() ? 1 : 620);
    $('#km-run').innerHTML = '❚❚ Pause';
  };
  $('#km-step').onclick = () => { stop(); step(); xp(1); };
  $('#km-reset').onclick = seed;
  kIn.oninput = () => { $('#km-kv').textContent = kIn.value; seed(); };
  $('#km-kv').textContent = kIn.value;
  seed();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'clustering') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch11 — scaling, and which models care
   ============================================================ */
function initScale() {
  const root = $('#scale-demo'); if (!root) return;
  let scaled = false;
  root.innerHTML = '<div class="scale-rows" id="scale-rows"></div>' +
    '<div class="btn-row"><button class="btn" id="scale-go">▶ Standardise</button>' +
    '<span class="stepper-pos" id="scale-state">raw values</span></div>';
  const rows = $('#scale-rows', root);

  function render() {
    rows.innerHTML = '';
    C.scaleRows.forEach(r => {
      const vals = scaled ? standardise(r.raw).z : r.raw;
      const lim = scaled ? 3 : Math.max.apply(null, C.scaleRows.map(x => Math.max.apply(null, x.raw)));
      const row = el('div', 'scale-row');
      row.innerHTML = '<div class="scale-name mono">' + r.f + '<span>' + (scaled ? 'z-score' : r.unit) + '</span></div>';
      const track = el('div', 'scale-track');
      vals.forEach(v => {
        const bar = el('div', 'scale-bar');
        const pct = scaled ? (Math.abs(v) / lim) * 50 : (v / lim) * 100;
        bar.style.width = Math.max(1.5, Math.min(100, pct)) + '%';
        if (scaled && v < 0) bar.classList.add('neg');
        bar.innerHTML = '<span>' + (scaled ? fmt(v, 2) : (v >= 1000 ? v.toLocaleString() : v)) + '</span>';
        track.appendChild(bar);
      });
      row.appendChild(track);
      rows.appendChild(row);
    });
    $('#scale-state', root).textContent = scaled
      ? 'mean 0, standard deviation 1 — every feature now speaks the same units'
      : 'raw values — income dwarfs everything else purely because of its unit';
  }
  $('#scale-go', root).onclick = () => {
    scaled = !scaled; render();
    $('#scale-go', root).innerHTML = scaled ? '↩ Back to raw' : '▶ Standardise';
    xp(3);
  };
  render();

  const whyBox = $('#scale-why-text'); if (whyBox) whyBox.innerHTML = C.scaleWhy;

  const needs = $('#scale-needs');
  if (needs) C.scaleNeeds.forEach(n => {
    const r = el('div', 'need-row' + (n.need ? ' yes' : ' no'));
    r.innerHTML = '<span class="need-flag">' + (n.need ? 'needs scaling' : 'does not care') + '</span>' +
      '<b>' + n.m + '</b><span class="need-why">' + n.why + '</span>';
    needs.appendChild(r);
  });
}

function initFeatures() {
  const root = $('#feature-cards'); if (!root) return;
  C.featureCards.forEach(f => {
    const c = el('div', 'pcard reveal');
    c.innerHTML = '<h3>' + f.t + '</h3><pre class="code">' + f.code + '</pre><p class="pcard-desc">' + f.why + '</p>';
    root.appendChild(c);
  });
}

/* ============================================================
   Ch12 — the workflow, stepped
   ============================================================ */
function initWorkflow() {
  const root = $('#workflow'); if (!root) return;
  root.innerHTML = '<div class="wf-track" id="wf-track"></div><div class="wf-detail" id="wf-detail"></div>' +
    '<div class="btn-row"><button class="btn" id="wf-play">▶ Walk the workflow</button></div>';
  const track = $('#wf-track', root), detail = $('#wf-detail', root);
  let timer = null;

  C.workflow.forEach((s, i) => {
    const n = el('button', 'wf-node');
    n.innerHTML = '<span class="wf-ico">' + s.ico + '</span><span class="wf-n">' + s.n + '</span>';
    n.onclick = () => { clearInterval(timer); timer = null; $('#wf-play', root).innerHTML = '▶ Walk the workflow'; show(i); };
    track.appendChild(n);
  });

  function show(i) {
    $$('.wf-node', track).forEach((n, ni) => n.classList.toggle('on', ni === i));
    const s = C.workflow[i];
    detail.innerHTML = '<div class="wf-step">Step ' + (i + 1) + ' of ' + C.workflow.length + '</div>' +
      '<h3>' + s.ico + ' ' + s.n + '</h3><p>' + s.d + '</p>' +
      '<div class="wf-trap"><b>The trap:</b> ' + s.trap + '</div>';
    detail.classList.remove('flash'); void detail.offsetWidth; detail.classList.add('flash');
    $$('.wf-node', track)[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  $('#wf-play', root).onclick = () => {
    if (timer) { clearInterval(timer); timer = null; $('#wf-play', root).innerHTML = '▶ Walk the workflow'; return; }
    let i = 0; show(0);
    $('#wf-play', root).innerHTML = '❚❚ Pause';
    timer = setInterval(() => {
      i++;
      if (i >= C.workflow.length) {
        clearInterval(timer); timer = null;
        $('#wf-play', root).innerHTML = '▶ Walk the workflow';
        xp(6, '+6 XP — the whole ML workflow, end to end');
        return;
      }
      show(i);
    }, reduced() ? 1 : 2100);
  };
  show(0);
}

/* ============================================================
   Ch13 — quiz + glossary
   ============================================================ */
function initQuiz() {
  const root = $('#quiz'); if (!root) return;
  const answered = new Set(); let correct = 0;

  C.quiz.forEach((q, i) => {
    const box = el('div', 'quiz-q',
      '<div class="quiz-n">Question ' + (i + 1) + ' of ' + C.quiz.length + '</div><div class="quiz-t">' + q.q + '</div>');
    const opts = el('div', 'quiz-opts');
    q.o.forEach((o, oi) => {
      const b = el('button', 'qopt', o);
      b.onclick = () => {
        if (answered.has(i)) return;
        answered.add(i);
        $$('.qopt', opts).forEach((x, xi) => { x.disabled = true; if (xi === q.a) x.classList.add('correct'); });
        if (oi !== q.a) b.classList.add('incorrect'); else { correct++; xp(5); }
        $('.quiz-exp', box).classList.add('show');
        if (answered.size === C.quiz.length) finish();
      };
      opts.appendChild(b);
    });
    box.appendChild(opts);
    box.appendChild(el('div', 'quiz-exp', '<b>Why:</b> ' + q.e));
    root.appendChild(box);
  });
  const result = el('div'); root.appendChild(result);

  function finish() {
    const pct = Math.round(correct / C.quiz.length * 100);
    const msg = pct === 100 ? 'Perfect. You could review someone else\'s model and spot the leak.'
      : pct >= 75 ? 'Strong. You have the workflow and the failure modes.'
      : pct >= 50 ? 'Solid start — revisit the chapters behind the misses.'
      : 'Worth another pass. Chapters 2, 6 and 7 carry most of the weight.';
    result.innerHTML = '<div class="quiz-result"><h3>' + correct + ' / ' + C.quiz.length + ' &nbsp;·&nbsp; ' + pct + '%</h3><p>' + msg + '</p></div>';
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    xp(25, '🏁 Course complete — ' + pct + '%');
  }

  const g = $('#glossary'), search = $('#gloss-search');
  function renderG(filter) {
    const f = (filter || '').toLowerCase();
    g.innerHTML = C.glossary
      .filter(t => !f || t[0].toLowerCase().includes(f) || t[1].toLowerCase().includes(f))
      .map(t => '<div class="gterm"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>').join('')
      || '<p class="panel-sub">No match.</p>';
  }
  search.oninput = () => renderG(search.value);
  renderG('');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initBackground, initKinds, initRulesVsML, initSplit, initLeak, initRegression, initGD,
   initClassifier, initMetrics, initMetricPick, initOverfit, initCV, initCVWhen, initTree, initEnsembles,
   initKmeans, initScale, initFeatures, initWorkflow, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
