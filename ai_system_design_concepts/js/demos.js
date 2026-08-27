/* ============================================================
   demos.js — every interactive widget.
   Each init* runs once on load; anything needing layout also
   redraws on the 'chapterchange' event fired by app.js.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = (n, msg) => window.awardXP && window.awardXP(n, msg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString();

/* deterministic pseudo-random so the feedback-loop sim is reproducible and testable */
function lcg(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }

const stat = (v, k, color) =>
  '<div class="stat"><div class="stat-v"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div><div class="stat-k">' + k + '</div></div>';

const bar = (label, pct, color, right) =>
  '<div class="mrow"><div class="mrow-l">' + label + '</div>' +
  '<div class="mrow-bar"><div class="mrow-fill" style="width:' + clamp(pct, 0, 100) + '%;background:' + color + '"></div></div>' +
  '<div class="mrow-n mono">' + right + '</div></div>';

/* ============================================================
   Background particles + hero nodes
   ============================================================ */
function initBackground() {
  const cv = $('#bg-particles'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let pts = [], W = 0, H = 0;

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
    const count = Math.min(70, Math.round(W * H / 26000));
    pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
      r: Math.random() * 1.6 + .6
    }));
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.fillStyle = 'rgba(160,240,235,.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20000) {
          ctx.strokeStyle = 'rgba(20,184,166,' + (0.18 * (1 - d2 / 20000)) + ')';
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  }
  resize(); window.addEventListener('resize', resize);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) frame();

  const g = $('#hero-nodes'), path = $('#flow-path');
  if (g && path && path.getTotalLength) {
    const len = path.getTotalLength();
    const labels = ['?', 'μ', '⚙', '↗', '✓'];
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 15);
      c.setAttribute('fill', 'rgba(8,16,18,.92)');
      c.setAttribute('stroke', ['#14b8a6', '#2dd4bf', '#fb7185', '#f472b6', '#14b8a6'][i]);
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', pt.x); t.setAttribute('y', pt.y + 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11');
      t.setAttribute('fill', '#e6fbf8');
      t.textContent = labels[i];
      g.appendChild(t);
    }
  }
}

/* ============================================================
   Plain-English boxes + worked examples

   Injected from data rather than written into the markup, so adding
   a chapter means adding one line to C.plain and nothing else.
   ============================================================ */
function initPlain() {
  $$('.chapter').forEach(ch => {
    const p = C.plain[ch.dataset.id];
    if (!p) return;
    const head = $('.ch-head', ch);
    if (!head) return;
    head.insertAdjacentElement('afterend', el('div', 'plainbox',
      '<div class="pb-tag">in plain English</div>' +
      '<div class="pb-one">' + p[0] + '</div>' +
      '<div class="pb-body">' + p[1] + '</div>'));
  });

  /* worked examples sit in whichever panel asked for one */
  $$('[data-worked]').forEach(host => {
    const w = C.worked[host.dataset.worked];
    if (!w) return;
    host.innerHTML =
      '<div class="worked"><div class="wk-h">✏️ ' + w.title + '</div>' +
      '<p class="wk-lead">' + w.lead + '</p>' +
      '<div class="wk-steps">' + w.steps.map((s, i) =>
        '<div class="wk-step"><div class="wk-n">' + (i + 1) + '</div>' +
        '<div class="wk-l">' + s[0] + '</div><div class="wk-v">' + s[1] + '</div></div>').join('') + '</div>' +
      '<div class="wk-punch">' + w.punch + '</div></div>';
  });
}

/* ============================================================
   Ch1 — the vocabulary
   ============================================================ */
function initJargon() {
  const grid = $('#jargon');
  if (grid) {
    grid.innerHTML = C.jargon.map((j, i) =>
      '<div class="jcard" data-i="' + i + '">' +
        '<div class="jc-t">' + esc(j.t) + '</div>' +
        '<div class="jc-s">' + esc(j.short) + '</div>' +
        '<button class="btn btn-ghost jc-btn">Show me an everyday version</button>' +
        '<div class="jc-more">' +
          '<div class="jc-like"><b>Think of it like…</b>' + j.like + '</div>' +
          '<div class="jc-at"><b>In our app:</b> ' + j.at + '</div>' +
        '</div>' +
      '</div>').join('');
    $$('.jc-btn', grid).forEach((b, i) => b.onclick = () => {
      const m = $$('.jc-more', grid)[i];
      m.classList.toggle('show');
      b.textContent = m.classList.contains('show') ? 'Hide' : 'Show me an everyday version';
      xp(1);
    });
  }

  const ex = $('#running-example');
  if (ex) ex.innerHTML = C.runningExample.screens.map(s =>
    '<div class="rescard"><div class="rc-ico">' + s.ico + '</div>' +
    '<b>' + s.n + '</b><p>' + s.p + '</p>' +
    '<span class="pill">' + s.ch + '</span></div>').join('');

  const root = $('#jargon-drill');
  if (root) {
    const keys = Object.keys(C.jargonOptions);
    let done = 0, score = 0;
    C.jargonDrill.forEach(c => {
      const card = el('div', 'sortcard');
      card.appendChild(el('div', 'sortcard-t', esc(c.t)));
      const opts = el('div', 'sortcard-opts');
      keys.forEach(k => {
        const O = C.jargonOptions[k];
        const b = el('button', 'sortopt', '<span class="so-ico">' + O.ico + '</span><span class="so-n">' + O.name + '</span>');
        b.onclick = () => {
          if (card.dataset.done) return;
          card.dataset.done = '1'; done++;
          $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (keys[xi] === c.a) x.classList.add('correct'); });
          if (k !== c.a) b.classList.add('incorrect'); else { score++; xp(4); }
          $('.sortcard-why', card).classList.add('show');
          if (done === C.jargonDrill.length) {
            root.appendChild(el('div', 'quiz-result',
              '<h3>' + score + ' / ' + C.jargonDrill.length + '</h3><p>' +
              (score >= 5
                ? 'You can read the rest of this course without a dictionary. That is genuinely most of the barrier gone.'
                : 'Worth a second pass through the cards above — every chapter from here on uses these words as if you already know them, so ten minutes now saves an hour later.') + '</p>'));
            xp(10, 'Vocabulary sorted — the rest of the course gets much easier from here');
          }
        };
        opts.appendChild(b);
      });
      card.appendChild(opts);
      card.appendChild(el('div', 'sortcard-why', '<b>' + C.jargonOptions[c.a].name + '.</b> ' + c.why));
      root.appendChild(card);
    });
  }
}

/* ============================================================
   Ch2 — clarifying questions
   ============================================================ */
function initClarify() {
  const root = $('#clarify'); if (!root) return;
  const picked = new Set();
  const LIMIT = 3;

  const list = el('div', 'qpick');
  C.clarifyQs.forEach((q, i) => {
    const b = el('button', 'qpick-item', '<span class="qp-box"></span><span>' + esc(q.q) + '</span>');
    b.onclick = () => {
      if (root.dataset.done) return;
      if (picked.has(i)) { picked.delete(i); b.classList.remove('on'); }
      else {
        if (picked.size >= LIMIT) return;
        picked.add(i); b.classList.add('on');
      }
      $('#clarify-count').textContent = picked.size + ' / ' + LIMIT + ' chosen';
      $('#clarify-go').disabled = picked.size !== LIMIT;
    };
    list.appendChild(b);
  });
  root.appendChild(list);

  $('#clarify-go').onclick = () => {
    if (picked.size !== LIMIT || root.dataset.done) return;
    root.dataset.done = '1';
    const hits = [...picked].filter(i => C.clarifyQs[i].good).length;
    $$('.qpick-item', list).forEach((b, i) => {
      b.disabled = true;
      const q = C.clarifyQs[i];
      if (q.good) b.classList.add('is-good');
      if (picked.has(i) && !q.good) b.classList.add('is-bad');
      b.appendChild(el('div', 'qp-why', (q.good ? '✅ ' : '🚫 ') + q.why));
    });
    $('#clarify-go').disabled = true;
    root.appendChild(el('div', 'quiz-result',
      '<h3>' + hits + ' / ' + LIMIT + ' load-bearing</h3><p>' +
      (hits === LIMIT
        ? 'Exactly right. Metric, scale, latency and data availability are the four that constrain every later decision — everything else is downstream.'
        : 'Five of these eight are load-bearing (metric, QPS, latency, catalogue, existing data). The other three are tool and hardware choices that <i>follow</i> from the answers — asking them first is designing from the tech backwards.') +
      '</p>'));
    xp(hits * 5, hits === LIMIT ? 'You asked the questions that constrain the design' : 'Metric, scale, latency, data — in that order');
  };

  const fw = $('#framework');
  if (fw) fw.innerHTML = C.framework.map((f, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + f[0] + '</b><p>' + f[1] + '</p></div></div>').join('');
}

/* ============================================================
   Ch2 — metrics
   ============================================================ */
function initMetrics() {
  const root = $('#metric-cases'); if (!root) return;
  let done = 0, score = 0;

  C.metricCases.forEach(c => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(c.s)));
    const opts = el('div', 'sortcard-opts');
    c.o.forEach((o, oi) => {
      const b = el('button', 'sortopt', '<span class="so-n">' + esc(o) + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (xi === c.a) x.classList.add('correct'); });
        if (oi !== c.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.metricCases.length) xp(10, score >= 4 ? 'You pick metrics that are hard to game' : 'Every proxy is gameable — pair it with a guardrail');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', c.why));
    root.appendChild(card);
  });

  const t = $('#metric-pairs');
  if (t) t.innerHTML =
    '<div class="mtab mtab-h"><b>System</b><b>Offline proxy</b><b>Online truth</b><b>What bites</b></div>' +
    C.metricPairs.map(p =>
      '<div class="mtab"><b>' + p[0] + '</b><span class="mono">' + p[1] + '</span><span class="mono">' + p[2] + '</span><span>' + p[3] + '</span></div>').join('');
}

/* ============================================================
   Ch3 — label sources
   ============================================================ */
function initLabels() {
  const root = $('#label-cards'); if (!root) return;

  root.innerHTML = C.labelSources.map(s =>
    '<div class="labcard" data-k="' + s.k + '">' +
      '<div class="lab-h">' + s.ico + ' <b>' + s.name + '</b></div>' +
      '<p>' + s.desc + '</p>' +
      bar('volume', s.volume, '#14b8a6', s.volume >= 80 ? 'huge' : s.volume >= 40 ? 'ok' : 'thin') +
      bar('bias', s.bias, '#fb7185', s.bias >= 70 ? 'severe' : s.bias >= 40 ? 'notable' : 'low') +
      bar('cost', s.cost, '#f59e0b', s.cost >= 70 ? 'high' : s.cost >= 25 ? 'medium' : 'cheap') +
      '<div class="lab-lat mono">label latency: ' + s.latency + '</div>' +
      '<button class="btn btn-ghost lab-btn">Trade-off</button>' +
      '<div class="sortcard-why"><b>✅ ' + s.good + '</b><br><br>⚠️ ' + s.bad + '</div>' +
    '</div>').join('');

  $$('.lab-btn', root).forEach((b, i) => b.onclick = () => {
    $$('.sortcard-why', root)[i].classList.toggle('show'); xp(2);
  });

  const tr = $('#label-traps');
  if (tr) tr.innerHTML = C.labelTraps.map(t =>
    '<div class="gterm"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>').join('');
}

/* ============================================================
   Ch4 — features: safe, skewed, or leaking?
   ============================================================ */
function initSkew() {
  const root = $('#skew-cards'); if (!root) return;
  let done = 0, score = 0;
  const keys = Object.keys(C.skewVerdicts);

  C.featureCards.forEach(f => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', '<span class="mono feat">' + f.f + '</span>' +
      (f.plain ? '<span class="feat-plain">— ' + f.plain + '</span>' : '')));
    const opts = el('div', 'sortcard-opts three');
    keys.forEach(k => {
      const V = C.skewVerdicts[k];
      const b = el('button', 'sortopt', '<span class="so-ico">' + V.ico + '</span><span class="so-n">' + V.name + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (keys[xi] === f.v) x.classList.add('correct'); });
        if (k !== f.v) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.featureCards.length) xp(10, score >= 6 ? 'You can smell a leak' : 'Ask one question per feature: when does this value become known?');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + C.skewVerdicts[f.v].name + '.</b> ' + f.why));
    root.appendChild(card);
  });

  const fx = $('#skew-fixes');
  if (fx) fx.innerHTML = C.skewFixes.map(f =>
    '<div class="gterm"><b>' + f[0] + '</b><span>' + f[1] + '</span></div>').join('');
}

/* ============================================================
   Ch5 — the model ladder
   ============================================================ */
function initLadder() {
  const chips = $('#ladder-tasks'), out = $('#ladder-out');
  if (!out) return;
  let cur = 0;

  C.ladderTasks.forEach((t, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), t.name);
    b.onclick = () => { cur = i; $$('.chip', chips).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
    chips.appendChild(b);
  });

  function render() {
    const task = C.ladderTasks[cur];
    const maxLat = Math.max(...C.ladder.map(r => r.latency));
    const maxCost = Math.max(...C.ladder.map(r => r.cost));
    out.innerHTML = C.ladder.map((r, i) =>
      '<div class="rung lrung' + (i === task.best ? ' pick' : '') + '">' +
        '<div class="rung-n">' + r.ico + '</div>' +
        '<div><b>' + r.n + (i === task.best ? ' <span class="pill good">right rung here</span>' : '') + '</b>' +
        '<p>' + r.when + '</p>' +
        bar('quality', r.quality, '#14b8a6', r.quality + '/100') +
        bar('latency', r.latency / maxLat * 100, '#fb7185', r.latency < 50 ? r.latency + 'ms' : (r.latency / 1000).toFixed(1) + 's') +
        bar('serving cost', r.cost / maxCost * 100, '#f59e0b', r.cost + '×') +
        '</div></div>').join('') +
      '<div class="tnote">🎯 <b>' + esc(task.name) + ':</b> ' + task.note + '</div>';
  }
  render();

  const rules = $('#ladder-rules');
  if (rules) rules.innerHTML = C.ladderRules.map(r =>
    '<div class="gterm"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
}

/* ============================================================
   Ch6 — the retrieval funnel
   ============================================================ */
function initFunnel() {
  const out = $('#funnel-out');
  if (!out) return;
  const k1 = $('#f-k1'), k2 = $('#f-k2'), k3 = $('#f-k3');

  function render() {
    let a = +k1.value, b = +k2.value, c = +k3.value;
    b = Math.min(b, a); c = Math.min(c, b);
    $('#f-k1-v').textContent = a;
    $('#f-k2-v').textContent = b;
    $('#f-k3-v').textContent = c;

    const N = 1e6;
    // stage 1: recall saturates with k — cheap and approximate, tuned for recall only
    const recall = 1 - Math.exp(-a / 350);
    // stage 2: the ranker's job gets harder the more it must sift per kept slot
    const rankAcc = clamp(0.99 - 0.12 * Math.log10(Math.max(a / Math.max(b, 1), 1)), 0.4, 0.99);
    // stage 3: a cross-encoder over a small set buys a little more, and only if it has room to reorder
    const rerankGain = b > c ? 1 + 0.09 * clamp(Math.log10(b / Math.max(c, 1)), 0, 1.2) : 1;
    const quality = clamp(recall * rankAcc * rerankGain, 0, 1);

    const S = C.funnelStages;
    const lat = [
      S[0].base + S[0].perItemUs * a / 1000,
      S[1].base + S[1].perItemUs * a / 1000,
      S[2].base + S[2].perItemUs * b / 1000
    ];
    const total = lat.reduce((x, y) => x + y, 0);
    const maxLat = Math.max(...lat);

    out.innerHTML =
      '<div class="funnel">' +
        '<div class="fstage" style="--c:#6f7594"><div class="fs-n">' + fmt(N) + '</div><div class="fs-l">catalogue</div></div>' +
        '<div class="fs-arrow">▼</div>' +
        S.map((s, i) => {
          const kept = [a, b, c][i];
          const w = 92 - i * 24;
          return '<div class="fstage" style="--c:' + s.color + ';width:' + w + '%">' +
            '<div class="fs-n">' + fmt(kept) + '</div>' +
            '<div class="fs-l">' + s.ico + ' ' + s.name + '</div>' +
            '<div class="fs-sub mono">' + s.of + ' · ' + lat[i].toFixed(1) + 'ms</div></div>' +
            (i < 2 ? '<div class="fs-arrow">▼</div>' : '');
        }).join('') +
      '</div>' +
      '<div class="stat-row" style="margin-top:16px">' +
        stat((recall * 100).toFixed(1) + '%', 'stage-1 recall (the ceiling)', recall > .9 ? '#14b8a6' : '#fb7185') +
        stat((quality * 100).toFixed(1) + '%', 'end-to-end quality', quality > .8 ? '#14b8a6' : quality > .6 ? '#f59e0b' : '#fb7185') +
        stat(total.toFixed(0) + 'ms', 'total latency', total < 100 ? '#14b8a6' : total < 200 ? '#f59e0b' : '#fb7185') +
        stat((total / (quality || 1)).toFixed(0), 'ms per unit of quality') +
      '</div>' +
      '<div class="lab-pane-title" style="margin-top:16px">where the latency goes</div>' +
      S.map((s, i) => bar(s.name, lat[i] / maxLat * 100, s.color, lat[i].toFixed(1) + 'ms')).join('') +
      '<div class="tnote">' + advice(a, b, c, recall, rankAcc, total) + '</div>';
  }

  function advice(a, b, c, recall, rankAcc, total) {
    if (recall < 0.85) return '⚠️ <b>Stage-1 recall is ' + (recall * 100).toFixed(0) + '%.</b> Roughly ' + ((1 - recall) * 100).toFixed(0) + '% of the good items are never seen by the ranker, and no amount of ranking quality can recover them. Raise the candidate count before touching anything downstream.';
    if (total > 200) return '⚠️ <b>' + total.toFixed(0) + 'ms is past most interactive budgets.</b> The ranking stage scales with candidate count — cutting stage 1 is usually cheaper in quality than cutting the ranker.';
    if (rankAcc < 0.75) return '⚠️ <b>The ranker is sifting ' + Math.round(a / Math.max(b, 1)) + ' candidates per kept slot.</b> Precision degrades when the ratio gets extreme. Either keep more after ranking, or make stage 1 slightly more selective.';
    if (b <= c) return '💡 <b>Re-ranking is doing nothing.</b> It only helps if it has more items than it keeps — feed it more than the final slate size or drop the stage and save the latency.';
    return '✅ <b>Balanced.</b> High stage-1 recall, a sane sift ratio, and the re-ranker has room to reorder. Note the shape: ~100× fewer items and ~100× more compute per item at each stage. That ratio is the entire reason the funnel exists.';
  }

  [k1, k2, k3].forEach(s => s.oninput = () => { render(); });
  render();

  const notes = $('#funnel-notes');
  if (notes) notes.innerHTML = C.funnelNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch7 — latency budget
   ============================================================ */
function initBudget() {
  const list = $('#budget-parts'), out = $('#budget-out'), slo = $('#budget-slo');
  if (!list) return;
  const state = {};
  C.latencyParts.forEach(p => state[p.k] = p.on);

  list.innerHTML = C.latencyParts.map(p =>
    '<div class="toggle' + (p.on ? ' on' : '') + (p.fixed ? ' locked' : '') + '" data-k="' + p.k + '">' +
      '<span class="toggle-box">✓</span>' +
      '<span>' + p.name + '<small>p50 ' + p.p50 + 'ms · p99 ' + p.p99 + 'ms' + (p.parallel ? ' · runs in parallel' : '') + '</small></span>' +
    '</div>').join('');

  $$('.toggle', list).forEach(t => t.onclick = () => {
    const p = C.latencyParts.find(x => x.k === t.dataset.k);
    if (p.fixed) return;
    state[p.k] = !state[p.k];
    t.classList.toggle('on', state[p.k]);
    render(); xp(1);
  });

  function render() {
    const on = C.latencyParts.filter(p => state[p.k]);
    const serial = on.filter(p => !p.parallel);
    const par = on.filter(p => p.parallel);

    const serial99 = serial.reduce((a, p) => a + p.p99, 0);
    const serial50 = serial.reduce((a, p) => a + p.p50, 0);
    // fan-out amplification: waiting on N parallel calls means waiting on the slowest of N
    const parMax99 = par.length ? Math.max(...par.map(p => p.p99)) : 0;
    const par99 = par.length ? parMax99 * (1 + 0.15 * (par.length - 1)) : 0;
    const par50 = par.length ? Math.max(...par.map(p => p.p50)) : 0;

    const t99 = serial99 + par99, t50 = serial50 + par50;
    const budget = +slo.value;
    $('#budget-slo-v').textContent = budget + 'ms';
    const over = t99 > budget;

    const maxc = Math.max(...on.map(p => p.p99), 1);
    out.innerHTML =
      '<div class="stat-row">' +
        stat(t50.toFixed(0) + 'ms', 'p50 estimate') +
        stat(t99.toFixed(0) + 'ms', 'p99 estimate', over ? '#fb7185' : '#14b8a6') +
        stat(budget + 'ms', 'SLO') +
        stat((over ? '+' : '−') + Math.abs(t99 - budget).toFixed(0) + 'ms', over ? 'over budget' : 'headroom', over ? '#fb7185' : '#14b8a6') +
      '</div>' +
      '<div class="lab-pane-title" style="margin-top:16px">p99 contribution</div>' +
      on.map(p => bar(p.name + (p.parallel ? ' ∥' : ''), p.p99 / maxc * 100,
        p.parallel ? '#f59e0b' : '#14b8a6', p.p99 + 'ms')).join('') +
      (par.length > 1
        ? '<div class="tnote">⚠️ <b>' + par.length + ' calls in parallel.</b> Waiting on all of them means waiting on the <i>slowest</i> — so the group\'s p99 (' + par99.toFixed(0) + 'ms) is worse than any single call\'s p99 (' + parMax99 + 'ms). Fan-out amplifies tails; it does not average them.</div>'
        : '') +
      '<div class="tnote' + (over ? ' err' : '') + '">' +
        (over
          ? '💥 <b>Over budget by ' + (t99 - budget).toFixed(0) + 'ms at p99.</b> ' +
            (state.llm ? 'The LLM call alone is ' + C.latencyParts.find(p => p.k === 'llm').p99 + 'ms — stream it, cache it, or move it off the request path entirely. ' : '') +
            (state.rerank ? 'Re-ranking is the next biggest lever: shrink the set it sees. ' : '') +
            'Remember one in a hundred users is getting this, and at 10k QPS that is 100 people a second.'
          : '✅ <b>Inside budget at p99, with ' + (budget - t99).toFixed(0) + 'ms spare.</b> Keep some of it — a retry, a cold cache or a slow AZ will want it back.') +
      '</div>' +
      '<p class="panel-sub" style="margin-top:12px">These p99s are <b>added</b>, which deliberately over-estimates: components rarely peak on the same request, so the true end-to-end p99 is lower. It is the right conservative number for budgeting and the wrong one to quote as measured — measure end to end.</p>';
  }
  slo.oninput = render;
  render();

  const les = $('#latency-lessons');
  if (les) les.innerHTML = C.latencyLessons.map(l =>
    '<div class="gterm"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>').join('');
}

/* ============================================================
   Ch8 — capacity
   ============================================================ */
function initCapacity() {
  const calc = $('#capacity'); if (!calc) return;
  const fields = [
    ['dau', 'daily active users', 4000000],
    ['rpu', 'requests / user / day', 30],
    ['peak', 'peak factor (× average)', 3],
    ['lat', 'per-request latency (ms)', 80],
    ['conc', 'concurrent workers / replica', 8],
    ['cache', 'cache hit rate (%)', 40]
  ];
  calc.innerHTML = fields.map(f =>
    '<div class="calc-f"><label for="c-' + f[0] + '">' + f[1] + '</label><input id="c-' + f[0] + '" type="number" min="0" value="' + f[2] + '"></div>')
    .join('') + '<div class="calc-out" id="capacity-out"></div>';

  function run() {
    const v = id => Math.max(0, +($('#c-' + id).value || 0));
    const dau = v('dau'), rpu = v('rpu'), peak = v('peak') || 1;
    const lat = v('lat') || 1, conc = v('conc') || 1, hit = clamp(v('cache'), 0, 99) / 100;

    const avgQps = dau * rpu / 86400;
    const peakQps = avgQps * peak;
    const backendQps = peakQps * (1 - hit);
    const perReplica = conc / (lat / 1000);         // Little's Law
    const util = 0.6;                                // leave headroom for failure + deploys
    const replicas = Math.ceil(backendQps / perReplica / util);
    const noCache = Math.ceil(peakQps / perReplica / util);

    $('#capacity-out').innerHTML =
      stat(fmt(avgQps), 'average QPS') +
      stat(fmt(peakQps), 'peak QPS', '#f59e0b') +
      stat(fmt(backendQps), 'QPS reaching the backend', '#14b8a6') +
      stat(fmt(perReplica), 'QPS per replica') +
      stat(replicas, 'replicas at 60% util', '#14b8a6') +
      stat(noCache - replicas >= 0 ? '−' + (noCache - replicas) : '+' + (replicas - noCache), 'replicas saved by the cache', '#14b8a6') +
      '<p class="panel-sub" style="grid-column:1/-1;margin:8px 0 0">' +
        '<b>Little\'s Law</b> does the sizing: one replica with ' + conc + ' workers at ' + lat + 'ms serves ~' + fmt(perReplica) + ' QPS. ' +
        'Sizing at 60% utilisation is not waste — the other 40% absorbs a failed availability zone, a bad deploy and a retry storm, which have a habit of arriving together. ' +
        'Note which input moves the replica count most: the cache hit rate is almost always a bigger lever than any code optimisation, and it ships faster.</p>';
  }
  $$('input', calc).forEach(i => i.oninput = run);
  run();

  const notes = $('#capacity-notes');
  if (notes) notes.innerHTML = C.capacityNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch9 — evaluation + A/B sizing
   ============================================================ */
function initEval() {
  const lad = $('#eval-ladder');
  if (lad) lad.innerHTML = C.evalLadder.map((e, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + e[0] + '</b><p>' + e[1] + '</p></div></div>').join('');

  const out = $('#ab-out'); if (!out) return;
  const base = $('#ab-base'), mde = $('#ab-mde'), traffic = $('#ab-traffic'), looks = $('#ab-looks');

  function render() {
    const p = clamp(+base.value, 0.1, 60) / 100;
    const rel = clamp(+mde.value, 0.5, 30) / 100;
    const daily = Math.max(1, +traffic.value);
    const nLooks = Math.max(1, +looks.value);

    $('#ab-base-v').textContent = (p * 100).toFixed(1) + '%';
    $('#ab-mde-v').textContent = '+' + (rel * 100).toFixed(1) + '% relative';
    $('#ab-traffic-v').textContent = fmt(daily) + ' / day';
    $('#ab-looks-v').textContent = nLooks === 1 ? 'once, at the end' : nLooks + ' times';

    const delta = p * rel;                                   // absolute effect size
    // standard two-proportion sizing at 80% power, alpha 0.05 two-sided
    const nPer = Math.ceil(16 * p * (1 - p) / (delta * delta));
    const days = (2 * nPer) / daily;
    // approximate false-positive inflation from repeated peeking
    const fpr = 1 - Math.pow(0.95, Math.sqrt(nLooks));

    out.innerHTML =
      '<div class="stat-row">' +
        stat(fmt(nPer), 'users per variant') +
        stat(fmt(nPer * 2), 'users total') +
        stat(days < 1 ? '<1' : days.toFixed(1), 'days to run', days > 28 ? '#fb7185' : days > 14 ? '#f59e0b' : '#14b8a6') +
        stat((fpr * 100).toFixed(0) + '%', 'false-positive rate', fpr > 0.1 ? '#fb7185' : '#14b8a6') +
      '</div>' +
      '<div class="tnote' + (days > 28 ? ' err' : '') + '">' +
        (days > 28
          ? '💥 <b>' + days.toFixed(0) + ' days is not a test, it is a quarter.</b> Detecting a ' + (rel * 100).toFixed(1) + '% relative lift on a ' + (p * 100).toFixed(1) + '% baseline needs ' + fmt(nPer * 2) + ' users. Options: accept a larger MDE, use interleaving (roughly 10× more sensitive for ranking), or pick a higher-rate metric further up the funnel.'
          : days > 14
            ? '⚠️ <b>' + days.toFixed(1) + ' days.</b> Workable, but run whole weeks — weekday and weekend traffic behave differently, and a part-week is a biased sample.'
            : '✅ <b>' + days.toFixed(1) + ' days.</b> Still run at least one full weekly cycle: novelty effects make any change look good for the first few days.') +
      '</div>' +
      (nLooks > 1
        ? '<div class="tnote err">💥 <b>Peeking ' + nLooks + ' times pushes your false-positive rate to roughly ' + (fpr * 100).toFixed(0) + '%</b>, not the 5% you think you are running at. Every look is another chance to cross the line by luck. Fix the duration in advance, or use a sequential test built for continuous monitoring.</div>'
        : '<div class="tnote">✅ <b>One look, at a duration fixed in advance.</b> That is what makes the 5% false-positive rate real.</div>') +
      '<p class="panel-sub" style="margin-top:12px">Sizing uses the standard two-proportion approximation — <span class="mono">n ≈ 16·p(1−p)/δ²</span> per variant at 80% power and α=0.05. The lesson is the shape, not the third decimal: <b>required sample scales with 1/δ²</b>, so halving the effect you want to detect quadruples the traffic you need.</p>';
  }
  [base, mde, traffic, looks].forEach(i => i.oninput = render);
  render();

  const notes = $('#ab-notes');
  if (notes) notes.innerHTML = C.abNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch10 — degenerate feedback loops
   ============================================================ */
function initLoop() {
  const out = $('#loop-out'); if (!out) return;
  const eps = $('#loop-eps');
  const N = 60, SLOTS = 10, ROUNDS = 25;

  /* The model ranks by smoothed CTR: (clicks + A) / (impressions + B).
     That is the whole mechanism. An item that has never been shown has no clicks
     AND no impressions, so it sits at A/B forever while items with observed clicks
     climb past it — and nothing ever brings it back. Note the corollary: a more
     OPTIMISTIC prior (larger A) is itself a form of exploration. */
  const A = 0.1, B = 3;

  function simulate(explore) {
    const rnd = lcg(20260819);
    const quality = Array.from({ length: N }, () => 0.15 + rnd() * 0.85);
    const clicks = new Array(N).fill(0);
    const imps = new Array(N).fill(0);
    const tie = Array.from({ length: N }, () => rnd() * 1e-6);
    // launch week: the first 8 items were shown before the model existed
    for (let i = 0; i < 8; i++) { imps[i] = 3; clicks[i] = 3 * quality[i]; }

    const score = i => (clicks[i] + A) / (imps[i] + B) + tie[i];
    const seen = new Set();
    const history = [];

    for (let r = 0; r < ROUNDS; r++) {
      const exploreSlots = Math.round(SLOTS * explore);
      const order = Array.from({ length: N }, (_, i) => i).sort((x, y) => score(y) - score(x));
      const shown = order.slice(0, SLOTS - exploreSlots);
      for (let e = 0; e < exploreSlots; e++) shown.push(Math.floor(rnd() * N));

      shown.forEach((i, pos) => {
        seen.add(i);
        imps[i]++;
        clicks[i] += quality[i] / (1 + pos * 0.25);        // position bias
      });
      history.push({
        round: r + 1,
        coverage: seen.size,
        meanQuality: shown.reduce((a, i) => a + quality[i], 0) / shown.length
      });
    }
    return { history, quality, imps, seen };
  }


  function render() {
    const e = clamp(+eps.value, 0, 40) / 100;
    $('#loop-eps-v').textContent = (e * 100).toFixed(0) + '%';
    const noExp = simulate(0);
    const withExp = simulate(e);
    const last = withExp.history[withExp.history.length - 1];
    const lastNo = noExp.history[noExp.history.length - 1];
    const best = Math.max(...withExp.quality);

    const chart = h => '<div class="lchart">' + h.map(p =>
      '<div class="lbar" title="round ' + p.round + ': ' + p.coverage + '/' + N + ' items ever shown">' +
      '<div class="lbar-fill" style="height:' + (p.coverage / N * 100) + '%"></div></div>').join('') + '</div>';

    out.innerHTML =
      '<div class="two-up">' +
        '<div><div class="lab-pane-title">no exploration — catalogue coverage over ' + ROUNDS + ' rounds</div>' +
          chart(noExp.history) +
          '<div class="stat-row" style="margin-top:10px">' +
            stat(lastNo.coverage + '/' + N, 'items ever shown', '#fb7185') +
            stat(lastNo.meanQuality.toFixed(2), 'mean quality served') +
          '</div></div>' +
        '<div><div class="lab-pane-title">' + (e * 100).toFixed(0) + '% exploration</div>' +
          chart(withExp.history) +
          '<div class="stat-row" style="margin-top:10px">' +
            stat(last.coverage + '/' + N, 'items ever shown', last.coverage > lastNo.coverage ? '#14b8a6' : '#fb7185') +
            stat(last.meanQuality.toFixed(2), 'mean quality served', last.meanQuality > lastNo.meanQuality ? '#14b8a6' : '#f59e0b') +
          '</div></div>' +
      '</div>' +
      '<div class="tnote' + (e === 0 ? ' err' : '') + '">' +
        (e === 0
          ? '💥 <b>The loop closed on round one and never reopened.</b> Exactly ' + lastNo.coverage + ' of ' + N + ' items have ever been shown. The other ' + (N - lastNo.coverage) + ' have zero clicks <i>and</i> zero impressions, so their smoothed CTR sits at the prior forever while the launch slate accumulates real clicks and climbs past it. The best item in the catalogue scores ' + best.toFixed(2) + ' — and if it was not in that first slate, nothing in this system will ever find out. Note the flat line: no metric goes red, because from the inside everything is working.'
          : '✅ <b>Exploration found ' + (last.coverage - lastNo.coverage) + ' items the greedy system never showed.</b> Note what it costs: ' + (e * 100).toFixed(0) + '% of slots go to items you are less sure about, so today\'s metric is lower than pure greedy. That is the trade — you are paying today\'s CTR for tomorrow\'s training data, and it is a hard trade to defend in a review.') +
      '</div>';
  }
  eps.oninput = render;
  render();

  const notes = $('#loop-notes');
  if (notes) notes.innerHTML = C.loopNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch11 — RAG at scale
   ============================================================ */
function initRagScale() {
  const knobs = $('#rag-knobs'), toggles = $('#rag-toggles'), out = $('#rag-out');
  if (!knobs) return;
  const val = {}; C.ragKnobs.forEach(k => val[k.k] = k.val);
  const on = {};  C.ragToggles.forEach(t => on[t.k] = t.on);

  knobs.innerHTML = C.ragKnobs.map(k =>
    '<div class="ctrl"><label for="r-' + k.k + '">' + k.name + ' <span class="mono" id="r-' + k.k + '-v">' + k.val + k.unit + '</span></label>' +
    '<input type="range" id="r-' + k.k + '" min="' + k.min + '" max="' + k.max + '" step="' + k.step + '" value="' + k.val + '"></div>').join('');

  toggles.innerHTML = C.ragToggles.map(t =>
    '<div class="toggle' + (t.on ? ' on' : '') + '" data-k="' + t.k + '"><span class="toggle-box">✓</span><span>' + t.name + '</span></div>').join('');

  $$('.toggle', toggles).forEach(t => t.onclick = () => {
    on[t.dataset.k] = !on[t.dataset.k];
    t.classList.toggle('on', on[t.dataset.k]);
    render(); xp(2);
  });
  C.ragKnobs.forEach(k => $('#r-' + k.k).oninput = e => {
    val[k.k] = +e.target.value;
    $('#r-' + k.k + '-v').textContent = val[k.k] + k.unit;
    render();
  });

  function render() {
    const chunk = val.chunk, k = val.k, hit = val.cache / 100;

    // retrieval quality: chunk size has a sweet spot, k saturates, each technique multiplies
    const chunkFit = 1 - Math.abs(chunk - 800) / 2600;
    const kFit = 1 - Math.exp(-k / 4);
    let recall = 0.74 * chunkFit * kFit;
    if (on.hybrid) recall *= 1.12;
    if (on.rerank) recall *= 1.18;
    if (on.meta) recall *= 1.05;
    recall = clamp(recall, 0, 0.98);

    const promptTok = Math.round(k * chunk / 4) + 320;
    const outTok = 240;
    // $3/$15 per million, only uncached requests pay
    const per1k = (1 - hit) * 1000 * (promptTok / 1e6 * 3 + outTok / 1e6 * 15);
    const latency = 40 + 25 + (on.rerank ? 90 : 0) + (on.hybrid ? 15 : 0) + 300 + promptTok * 0.02;
    const effLatency = latency * (1 - hit) + 12 * hit;

    out.innerHTML =
      '<div class="stat-row">' +
        stat((recall * 100).toFixed(0) + '%', 'retrieval recall@k', recall > .85 ? '#14b8a6' : recall > .7 ? '#f59e0b' : '#fb7185') +
        stat(fmt(promptTok), 'prompt tokens / query') +
        stat('$' + per1k.toFixed(2), 'cost / 1k queries', per1k < 8 ? '#14b8a6' : per1k < 20 ? '#f59e0b' : '#fb7185') +
        stat(effLatency.toFixed(0) + 'ms', 'effective latency') +
      '</div>' +
      '<div class="lab-pane-title" style="margin-top:16px">what each technique is contributing</div>' +
      bar('chunk size fit', chunkFit * 100, '#14b8a6', chunk + ' chars') +
      bar('k saturation', kFit * 100, '#2dd4bf', 'k=' + k) +
      C.ragToggles.map(t => bar(t.name, on[t.k] ? 100 : 0, on[t.k] ? '#14b8a6' : '#3a3f52', on[t.k] ? 'on' : 'off')).join('') +
      '<div class="tnote">' + ragAdvice(recall, k, per1k, chunk) + '</div>' +
      '<div class="why-notes">' + C.ragToggles.map(t =>
        '<div class="gterm' + (on[t.k] ? '' : ' off') + '"><b>' + t.name + '</b><span>' + t.note + '</span></div>').join('') + '</div>';
  }

  function ragAdvice(recall, k, cost, chunk) {
    if (recall < 0.7) {
      const off = C.ragToggles.filter(t => !on[t.k]).map(t => t.name.split(' (')[0]);
      return '⚠️ <b>Recall is ' + (recall * 100).toFixed(0) + '%.</b> Roughly ' + ((1 - recall) * 100).toFixed(0) +
        '% of questions cannot be answered correctly no matter what the model does. ' +
        (off.length ? 'Still off: <b>' + off.join(', ') + '</b> — turn those on before touching the prompt. '
                    : 'Everything is already on, so raise k or fix the chunk size. ') +
        'This is a retrieval bug, and most "the model hallucinated" reports are exactly this.';
    }
    if (k > 10 && !on.rerank)
      return '💡 <b>k=' + k + ' with no reranker</b> is the expensive way to buy recall. Fetch 25, rerank, keep 4: usually better answers <i>and</i> a smaller prompt. You are currently paying $' + cost.toFixed(2) + ' per 1k queries for chunks the model mostly ignores.';
    if (chunk > 1400) return '💡 <b>Large chunks dilute the embedding.</b> One vector has to represent 350+ words, so it matches everything vaguely and nothing precisely. Recall drops even though each chunk carries more context.';
    if (chunk < 400) return '💡 <b>Small chunks embed sharply and lose their surroundings.</b> Precise retrieval, but a fact that spans a paragraph boundary is now in neither chunk properly. Raise overlap or chunk on structure.';
    return '✅ <b>Sensible configuration.</b> Now watch the cost line as you raise k — every extra chunk is prompt tokens on <i>every request, forever</i>. A reranker in front is what lets you keep k low and recall high at the same time.';
  }
  render();

  const notes = $('#rag-scale-notes');
  if (notes) notes.innerHTML = C.ragScaleNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch12 — model cascade
   ============================================================ */
/* ============================================================
   Ch13 — the KV cache ceiling

   usable      = accelerator memory * (1 - overhead) - weights
   kv per req  = context tokens * KV bytes per token
   concurrency = floor(usable / kv per req)

   The whole point of the widget: the second term scales with every
   concurrent request and the first does not, so context length — not
   model size — is what sets how many users one accelerator holds.
   ============================================================ */
function initKv() {
  const calc = $('#kvcalc'); if (!calc) return;
  calc.innerHTML = C.kvDefaults.map(f =>
    '<div class="calc-f"><label for="k-' + f[0] + '">' + f[1] + '</label>' +
    '<input id="k-' + f[0] + '" type="number" min="0" value="' + f[2] + '"></div>').join('') +
    '<div class="calc-out" id="kv-out"></div>';

  function concurrency(gpu, w, kvKB, ctx) {
    const usable = gpu * (1 - C.kvOverhead) - w;
    const perReq = ctx * kvKB / 1048576;              // KB -> GB
    return { usable, perReq, max: perReq > 0 ? Math.max(0, Math.floor(usable / perReq)) : 0 };
  }

  function run() {
    const v = id => Math.max(0, +($('#k-' + id).value || 0));
    const gpu = v('gpu'), w = v('w'), kvKB = v('kv'), ctx = v('ctx');
    const r = concurrency(gpu, w, kvKB, ctx);
    const half = concurrency(gpu, w, kvKB, ctx / 2).max;
    const quant = concurrency(gpu, w / 4, kvKB, ctx).max;   // 4-bit weights, same KV

    $('#kv-out').innerHTML =
      stat(r.max, 'concurrent requests', r.max ? '#14b8a6' : '#f43f5e') +
      stat(r.perReq.toFixed(2) + ' GB', 'KV cache per request') +
      stat(Math.max(0, r.usable).toFixed(1) + ' GB', 'memory left for KV') +
      stat(half, 'at half the context', '#14b8a6') +
      stat(quant, 'at 4-bit weights');

    const kvUsed = Math.min(r.max * r.perReq, gpu);
    const oh = gpu * C.kvOverhead;
    $('#kv-bars').innerHTML =
      bar('weights', gpu ? w / gpu * 100 : 0, '#7c5cff', w.toFixed(0) + ' GB') +
      bar('KV cache', gpu ? kvUsed / gpu * 100 : 0, '#14b8a6', kvUsed.toFixed(0) + ' GB') +
      bar('runtime overhead', C.kvOverhead * 100, '#64748b', oh.toFixed(0) + ' GB');

    const note = $('#kv-note');
    if (!r.max) {
      note.innerHTML = '<b style="color:#f43f5e">This does not fit.</b> The weights plus one request’s ' +
        'KV cache already exceed the accelerator. Shrink the context, quantize the weights, or shard the ' +
        'model across devices — in that order of cheapness.';
      return;
    }
    note.innerHTML = 'At ' + ctx.toLocaleString() + ' context tokens each request reserves <b>' +
      r.perReq.toFixed(2) + ' GB</b> of KV cache, so one accelerator holds <b>' + r.max +
      '</b> at once. Halving the context roughly doubles that to <b>' + half + '</b>; quantizing the ' +
      'weights to 4-bit only gets you <b>' + quant + '</b>, because the weights were never the term that ' +
      'scaled. This is why long-context features quietly cost you throughput, and why an admission-control ' +
      'limit on context length is a capacity decision, not a product one.';
  }
  $$('input', calc).forEach(i => i.oninput = run);
  run();
}

/* ============================================================
   Ch13 — prefill vs decode, and which lever moves which

   prefill_ms = prompt tokens / prefillRate
   decode_ms  = output tokens / decodeRate / speculative speedup
   speculative speedup = E / (1 + g*c),  E = (1 - a^(g+1)) / (1 - a)

   test.js re-derives all of it and asserts the claims the chapter makes.
   ============================================================ */
function decodeTiming(on) {
  const M = C.decodeModel, P = M.promptTokens, O = M.outputTokens;
  const step = 1000 / M.decodeRate;
  const fresh = on.cache ? P * (1 - M.cachedFrac) + P * M.cachedFrac / M.cacheSpeedup : P;
  const prefill = fresh / M.prefillRate * 1000;

  const perRound = (1 - Math.pow(M.accept, M.draftBlock + 1)) / (1 - M.accept);
  const roundCost = 1 + M.draftBlock * M.draftCost;
  const speedup = on.spec ? perRound / roundCost : 1;
  const decode = O * step / speedup;

  const total = M.overheadMs + prefill + decode;
  const firstStep = on.spec ? roundCost * step : step;
  const billed = on.cache ? P * (1 - M.cachedFrac) + P * M.cachedFrac * M.cacheDiscount : P;

  return {
    prefill: prefill, decode: decode, total: total,
    ttft: on.stream ? M.overheadMs + prefill + firstStep : total,
    tps: O / (decode / 1000), billed: billed, speedup: speedup
  };
}

function initDecode() {
  const chips = $('#lever-chips'); if (!chips) return;
  const on = { stream: true, cache: false, spec: false };
  const ms = t => t >= 1000 ? (t / 1000).toFixed(1) + 's' : Math.round(t) + 'ms';

  C.decodeLevers.forEach(l => {
    const b = el('button', 'chip' + (on[l.k] ? ' active' : ''), l.n);
    b.onclick = () => { on[l.k] = !on[l.k]; b.classList.toggle('active', on[l.k]); run(); };
    chips.appendChild(b);
  });

  function run() {
    const r = decodeTiming(on);
    const base = decodeTiming({ stream: false, cache: false, spec: false });
    const span = Math.max(r.prefill + r.decode, 1);

    $('#lever-bars').innerHTML =
      bar('prefill', r.prefill / span * 100, '#7c5cff', ms(r.prefill)) +
      bar('decode', r.decode / span * 100, '#14b8a6', ms(r.decode)) +
      bar('first token', r.ttft / span * 100, r.ttft < 1500 ? '#22c55e' : '#f59e0b', ms(r.ttft));

    $('#lever-stats').innerHTML =
      stat(ms(r.ttft), 'time to first token', r.ttft < 1500 ? '#22c55e' : '#f43f5e') +
      stat(ms(r.total), 'total time') +
      stat(r.tps.toFixed(0), 'tokens / second') +
      stat(Math.round(r.billed).toLocaleString(), 'input tokens billed',
           r.billed < base.billed ? '#22c55e' : undefined);

    const lines = C.decodeLevers.map(l =>
      '<b>' + l.n + '</b> ' + (on[l.k] ? 'on' : 'off') + ' — ' + (on[l.k] ? l.on : l.off));
    const deltas = [];
    if (on.stream) deltas.push('Streaming cut the perceived wait from ' + ms(base.total) + ' to ' +
      ms(r.ttft) + ' <i>without changing total time or cost by one token</i>.');
    if (on.cache) deltas.push('Prompt caching took prefill from ' + ms(base.prefill) + ' to ' +
      ms(r.prefill) + ' and billed input from ' + Math.round(base.billed).toLocaleString() + ' to ' +
      Math.round(r.billed).toLocaleString() + ' tokens — and left tokens/second at exactly ' +
      base.tps.toFixed(0) + '.');
    if (on.spec) deltas.push('Speculative decoding is running at ' + r.speedup.toFixed(2) +
      '× on decode. That is real latency, bought with real extra compute: on a GPU that is already ' +
      'saturated it is a throughput loss.');
    if (!on.stream) deltas.push('<b style="color:#f43f5e">Not streaming:</b> the user stares at nothing for ' +
      ms(r.total) + '. This is the cheapest fix on the page and it is switched off.');

    $('#lever-note').innerHTML = lines.join('<br>') + '<br><br>' + deltas.join(' ');
  }
  run();

  const lessons = $('#decode-lessons');
  if (lessons) lessons.innerHTML = C.decodeLessons.map(l =>
    '<div class="gterm"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>').join('');
}

function initCascade() {
  const out = $('#cascade-out'); if (!out) return;
  const share = $('#cas-share'), acc = $('#cas-acc'), cache = $('#cas-cache');

  const T = {}; C.cascadeTiers.forEach(t => T[t.k] = t);
  const IN_TOK = 1400, OUT_TOK = 300;
  const callCost = t => (IN_TOK / 1e6 * t.inCost + OUT_TOK / 1e6 * t.outCost);

  function render() {
    const s = clamp(+share.value, 0, 100) / 100;      // share the router sends to the small model
    const a = clamp(+acc.value, 50, 99) / 100;        // how often the router is right about "this is easy"
    const hit = clamp(+cache.value, 0, 80) / 100;

    $('#cas-share-v').textContent = (s * 100).toFixed(0) + '%';
    $('#cas-acc-v').textContent = (a * 100).toFixed(0) + '%';
    $('#cas-cache-v').textContent = (hit * 100).toFixed(0) + '%';

    const misrouted = s * (1 - a);                    // sent to small, actually hard
    const escalated = misrouted * C.cascadeDetection; // caught by the output check → second call
    const silentBad = misrouted - escalated;          // not caught → weak answer, one call, no alert
    const smallOnly = s - misrouted;
    const largeDirect = 1 - s;

    const cSmall = callCost(T.small), cLarge = callCost(T.large);
    const paid = 1 - hit;
    const cost1k = 1000 * paid * (smallOnly * cSmall + escalated * (cSmall + cLarge) +
                                  silentBad * cSmall + largeDirect * cLarge);
    const baseline1k = 1000 * paid * cLarge;
    const saving = baseline1k > 0 ? (1 - cost1k / baseline1k) * 100 : 0;

    const quality = smallOnly * T.small.easyQuality + escalated * (T.large.quality - 4) +
                    silentBad * T.small.quality + largeDirect * T.large.quality;
    const latency = smallOnly * T.small.latency + escalated * (T.small.latency + T.large.latency) +
                    silentBad * T.small.latency + largeDirect * T.large.latency;

    out.innerHTML =
      '<div class="splitbar">' +
        '<div class="sb-seg small" style="width:' + (smallOnly * 100) + '%"><span>' + (smallOnly * 100).toFixed(0) + '% small</span></div>' +
        '<div class="sb-seg esc" style="width:' + (escalated * 100) + '%"><span>' + (escalated * 100).toFixed(0) + '% escalated</span></div>' +
        '<div class="sb-seg bad" style="width:' + (silentBad * 100) + '%"><span>' + (silentBad * 100).toFixed(0) + '% silently weak</span></div>' +
        '<div class="sb-seg large" style="width:' + (largeDirect * 100) + '%"><span>' + (largeDirect * 100).toFixed(0) + '% large</span></div>' +
      '</div>' +
      '<div class="stat-row" style="margin-top:16px">' +
        stat('$' + cost1k.toFixed(2), 'cost / 1k requests', saving > 25 ? '#14b8a6' : '#f59e0b') +
        stat(saving.toFixed(0) + '%', 'saved vs all-large', saving > 25 ? '#14b8a6' : saving > 5 ? '#f59e0b' : '#fb7185') +
        stat(quality.toFixed(1), 'blended quality', quality > 90 ? '#14b8a6' : quality > 85 ? '#f59e0b' : '#fb7185') +
        stat(latency.toFixed(0) + 'ms', 'mean latency') +
      '</div>' +
      '<div class="lab-pane-title" style="margin-top:16px">tiers</div>' +
      C.cascadeTiers.map(t =>
        '<div class="gterm"><b>' + t.ico + ' ' + t.name + '</b><span>' + t.note +
        '<br><i class="mono" style="font-size:11px;opacity:.75">$' + t.inCost + '/$' + t.outCost + ' per Mtok · easy ' + t.easyQuality + ' / hard ' + t.quality + ' · ' + t.latency + 'ms</i></span></div>').join('') +
      '<div class="tnote' + (saving < 10 || quality < 88 ? ' err' : '') + '">' + casAdvice(s, a, saving, quality, escalated, silentBad) + '</div>';
  }

  function casAdvice(s, a, saving, quality, esc, bad) {
    if (a < 0.75 && s > 0.5) return '💥 <b>The router is wrong ' + ((1 - a) * 100).toFixed(0) + '% of the time and you are sending it ' + (s * 100).toFixed(0) + '% of traffic.</b> ' + (esc * 100).toFixed(0) + '% of requests now pay for <i>two</i> model calls and arrive late — and ' + (bad * 100).toFixed(0) + '% slip through as a weak answer with no alert at all. That second number is the one that does not show up on any dashboard. A cascade is only worth it when routing is reliable: measure the router before you trust the savings.';
    if (s > 0.9) return '⚠️ <b>Almost everything goes to the small model.</b> Cheap, but blended quality is ' + quality.toFixed(1) + ' — check whether that costs you more in escalations, retries and complaints than the tokens you saved.';
    if (s < 0.2) return '💡 <b>Barely a cascade.</b> You are paying large-model prices for routine traffic. Most real workloads are 60–80% routine — sample yours and find out where the line actually is before assuming it is hard.';
    if (saving > 40 && quality > 88) return '✅ <b>' + saving.toFixed(0) + '% cheaper at quality ' + quality.toFixed(1) + '.</b> This is the sweet spot: most traffic is routine, the router is reliable enough that escalation is rare, and the hard tail still gets the strong model. Caching multiplies all of it.';
    return '💡 <b>Working, not optimal.</b> Push the small-model share up while watching blended quality, and remember the escalated slice pays twice — router accuracy is worth more than the split.';
  }
  [share, acc, cache].forEach(i => i.oninput = render);
  render();

  const lev = $('#serving-levers');
  if (lev) lev.innerHTML = C.servingLevers.map(l =>
    '<div class="gterm"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>').join('');
}

/* ============================================================
   Ch13 — canonical designs
   ============================================================ */
function initDesigns() {
  const tabs = $('#design-tabs'), out = $('#design-out');
  if (!out) return;
  let cur = 0, step = 0;

  C.designs.forEach((d, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), d.ico + ' ' + d.name);
    b.onclick = () => {
      cur = i; step = 0;
      $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active');
      render(); xp(2);
    };
    tabs.appendChild(b);
  });

  function render() {
    const d = C.designs[cur];
    out.innerHTML =
      '<div class="dprob"><b>' + d.ico + ' ' + d.name + '</b><p>' + esc(d.problem) + '</p></div>' +
      '<div class="dsteps">' + d.stages.map((s, i) =>
        '<div class="dstep' + (i <= step ? ' on' : '') + '">' +
          '<div class="ds-n">' + (i + 1) + '</div>' +
          '<div class="ds-body"><b>' + s.n + '</b>' +
          (i <= step ? '<p>' + s.t + '</p><div class="ds-gotcha">⚠️ ' + s.gotcha + '</div>' : '<p class="ds-hidden">…</p>') +
          '</div></div>').join('') + '</div>';
    $('#design-next').disabled = step >= d.stages.length - 1;
    $('#design-count').textContent = 'stage ' + (step + 1) + ' of ' + d.stages.length;
  }
  $('#design-next').onclick = () => {
    const d = C.designs[cur];
    if (step >= d.stages.length - 1) return;
    step++; render(); xp(2);
    if (step === d.stages.length - 1) xp(8, 'That is the whole shape — and every stage had a gotcha worth knowing');
  };
  $('#design-all').onclick = () => { step = C.designs[cur].stages.length - 1; render(); xp(3); };
  $('#design-reset').onclick = () => { step = 0; render(); };
  render();
}

/* ============================================================
   Ch14 — operate
   ============================================================ */
function initShip() {
  const arch = $('#arch');
  if (arch) arch.innerHTML = C.arch.map((r, i) =>
    '<div class="abox' + (i === 1 ? ' hl' : '') + '"><b>' + r[0] + '</b><small>' + r[1] + '</small></div>').join('');

  const ro = $('#rollout');
  if (ro) ro.innerHTML = C.rollout.map((r, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + r[0] + '</b><p>' + r[1] + '</p></div></div>').join('');

  const fm = $('#fail-modes');
  if (fm) fm.innerHTML = C.failModes.map(f =>
    '<div class="gterm"><b>' + f[0] + '</b><span>' + f[1] + '</span></div>').join('');

  const cl = $('#checklist');
  if (cl) {
    const KEY = 'aisdflow.checklist';
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    C.checklist.forEach((item, i) => {
      const t = el('div', 'toggle' + (saved.includes(i) ? ' on' : ''), '<span class="toggle-box">✓</span><span>' + item + '</span>');
      t.onclick = () => {
        t.classList.toggle('on');
        const now = $$('.toggle', cl).map((x, xi) => x.classList.contains('on') ? xi : -1).filter(x => x >= 0);
        localStorage.setItem(KEY, JSON.stringify(now));
        if (now.length === C.checklist.length) xp(20, '+20 XP — production ready');
      };
      cl.appendChild(t);
    });
  }
}

/* ============================================================
   Ch15 — quiz + glossary
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
    const msg = pct === 100 ? 'Perfect. You could run the design conversation, not just answer it.'
      : pct >= 75 ? 'Strong — you have the framework and the failure modes.'
      : pct >= 50 ? 'Good start. Revisit metrics, skew and the funnel; most real systems fail on those three.'
      : 'Worth another pass. Clarify → metric → data → baseline is the spine; everything else hangs off it.';
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

/* ============================================================
   Ch16 — the fifteen patterns: an animated diagram each, then a
   drill that gives you a situation and asks for the name.
   ============================================================ */

/* --- tiny SVG helpers. Animation is SMIL, so no timers run per card. --- */
const svgWrap = (body, h) =>
  '<svg class="pdia" viewBox="0 0 320 ' + h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + body + '</svg>';
const pbox = (x, y, w, h, label, cls) =>
  '<rect class="pd-box ' + (cls || '') + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7"/>' +
  '<text class="pd-t' + (cls === 'hot' ? ' b' : '') + '" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 1) + '">' + esc(label) + '</text>';
const pline = (d, cls) => '<path class="pd-line ' + (cls || '') + '" d="' + d + '"/>';
const pdot = (d, dur, begin, cls) =>
  '<circle class="pd-dot ' + (cls || '') + '" r="3.4">' +
  '<animateMotion dur="' + dur + 's" begin="' + begin + 's" repeatCount="indefinite" path="' + d + '"/></circle>';

const DIA = {
  /* a request travelling left to right through N boxes */
  flow(d) {
    const n = d.nodes.length, gap = 22, w = (304 - gap * (n - 1)) / n, y = 30, h = 34;
    let s = '';
    d.nodes.forEach((label, i) => {
      const x = 8 + i * (w + gap);
      s += pbox(x, y, w, h, label, i === 1 ? 'hot' : '');
      if (i) s += pline('M' + (x - gap + 3) + ',47 H' + (x - 4), 'arrow');
    });
    return svgWrap(s + pdot('M12,47 H308', 3, 0), 90);
  },

  /* one hub, three spokes — out for Observer and Facade, in for Singleton */
  fan(d) {
    const out = d.dir === 'out';
    const hx = out ? 8 : 200, sx = out ? 196 : 8, sw = 116, hw = 112;
    let s = pbox(hx, 28, hw, 34, d.hub, 'hot');
    d.spokes.forEach((label, i) => {
      const sy = 6 + i * 30;
      s += pbox(sx, sy, sw, 24, label);
      const path = out
        ? 'M' + (hx + hw) + ',45 C' + (hx + hw + 40) + ',45 ' + (sx - 40) + ',' + (sy + 12) + ' ' + sx + ',' + (sy + 12)
        : 'M' + (sx + sw) + ',' + (sy + 12) + ' C' + (sx + sw + 40) + ',' + (sy + 12) + ' ' + (hx - 40) + ',45 ' + hx + ',45';
      s += pline(path, 'dash') + pdot(path, 2.6, i * 0.45);
    });
    return svgWrap(s, 90);
  },

  /* concentric wrappers: Decorator from the outside in, Composite as containment */
  nest(d) {
    const W = [304, 214, 126], H = [78, 54, 28];
    let s = '';
    d.layers.forEach((label, i) => {
      const w = W[i], h = H[i], x = (320 - w) / 2, y = (90 - h) / 2;
      s += '<rect class="pd-box' + (i === 2 ? ' hot' : '') + '" x="' + x + '" y="' + y + '" width="' + w +
           '" height="' + h + '" rx="9"><animate attributeName="stroke-opacity" values="1;.28;1" dur="3s" begin="' +
           (2 - i) * 0.5 + 's" repeatCount="indefinite"/></rect>';
      s += i === 2
        ? '<text class="pd-t b" x="160" y="46">' + esc(label) + '</text>'
        : '<text class="pd-t s" x="' + (x + 9) + '" y="' + (y + 9) + '" text-anchor="start">' + esc(label) + '</text>';
    });
    return svgWrap(s, 90);
  },

  /* a fixed skeleton of steps, lit one at a time; one step may be the overridden hole */
  steps(d) {
    const n = d.items.length, h = 16, gap = 5, top = 4;
    let s = '<rect class="pd-hl" x="34" y="' + top + '" width="252" height="' + h + '" rx="5">' +
      '<animate attributeName="y" values="' + d.items.map((_, i) => top + i * (h + gap)).join(';') +
      ';" dur="' + (n * 0.9) + 's" calcMode="discrete" repeatCount="indefinite"/></rect>';
    d.items.forEach((label, i) => {
      const y = top + i * (h + gap), hot = i === d.override;
      s += '<rect class="pd-box' + (hot ? ' hot' : '') + '" x="34" y="' + y + '" width="252" height="' + h + '" rx="5"/>' +
        '<text class="pd-t' + (hot ? ' b' : '') + '" x="46" y="' + (y + h / 2 + 1) + '" text-anchor="start">' + esc(label) +
        (hot ? '  ← overridden' : '') + '</text>';
    });
    return svgWrap(s, top + n * (h + gap) + 2);
  },

  /* a cursor stepping through cells without anyone seeing the storage */
  cells(d) {
    const n = d.vals.length, w = 44, gap = 8, y = 36, h = 32;
    let s = '<text class="pd-t b" x="160" y="14">' + esc(d.label) + '</text>';
    s += '<rect class="pd-hl" x="8" y="' + y + '" width="' + w + '" height="' + h + '" rx="7">' +
      '<animate attributeName="x" values="' + d.vals.map((_, i) => 8 + i * (w + gap)).join(';') +
      ';" dur="' + (n * 0.7) + 's" calcMode="discrete" repeatCount="indefinite"/></rect>';
    d.vals.forEach((v, i) => { s += pbox(8 + i * (w + gap), y, w, h, v); });
    return svgWrap(s, 78);
  },

  /* states on a ring, with the transition doing the walking */
  cycle(d) {
    const pts = [[46, 45], [160, 14], [274, 45], [160, 76]];
    const ring = 'M46,45 A114,31 0 0,1 274,45 A114,31 0 0,1 46,45';
    let s = pline(ring, 'dash');
    d.states.forEach((label, i) => {
      s += '<circle class="pd-box' + (i === 0 ? ' hot' : '') + '" cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="17"/>' +
           '<text class="pd-t" x="' + pts[i][0] + '" y="' + (pts[i][1] + 1) + '">' + esc(label) + '</text>';
    });
    return svgWrap(s + pdot(ring, 5, 0), 94);
  },

  /* same input, same output, three interchangeable middles */
  switch(d) {
    const ox = 92, ow = 116;
    let s = pbox(4, 32, 76, 28, d.input) + pbox(216, 32, 100, 28, d.output);
    d.opts.forEach((label, i) => {
      const y = 4 + i * 30, on = i === d.active;
      const a = 'M80,46 C' + (ox - 20) + ',46 ' + (ox - 20) + ',' + (y + 12) + ' ' + ox + ',' + (y + 12);
      const b = 'M' + (ox + ow) + ',' + (y + 12) + ' C' + (ox + ow + 20) + ',' + (y + 12) + ' ' + (ox + ow + 20) + ',46 216,46';
      s += pline(a, on ? '' : 'faint') + pline(b, on ? '' : 'faint') +
           pbox(ox, y, ow, 24, label, on ? 'hot' : 'dim');
      if (on) s += pdot(a + ' ' + b.replace('M', 'L'), 2.4, 0);
    });
    return svgWrap(s, 96);
  }
};

function patternDia(k) {
  const d = C.patternDia[k];
  if (!d || !DIA[d.kind]) return '';
  return DIA[d.kind](d);
}

function initPatterns() {
  const grid = $('#pattern-cards'), cats = $('#pattern-cats');
  if (grid) {
    grid.innerHTML = C.patterns.map(p =>
      '<div class="labcard patcard" data-cat="' + p.cat + '">' +
        '<div class="lab-h">' + C.patternCats[p.cat].ico + ' <b>' + p.num + '. ' + p.n + '</b></div>' +
        patternDia(p.k) +
        '<p>' + esc(p.one) + '</p>' +
        '<div class="pcard-foot"><span class="pill">' + C.patternCats[p.cat].name + '</span></div>' +
        '<button class="btn btn-ghost pat-btn">Problem, code, trap</button>' +
        '<div class="sortcard-why">' +
          '<b>The problem.</b> ' + esc(p.problem) + '<br><br>' +
          '<b>Where it shows up here.</b> ' + esc(p.ai) +
          '<pre class="code">' + esc(p.code) + '</pre>' +
          '<div class="ds-gotcha">⚠️ ' + esc(p.trap) + '</div>' +
        '</div>' +
      '</div>').join('');

    /* SMIL ignores prefers-reduced-motion, so stop it ourselves */
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)
      $$('.pdia', grid).forEach(s => s.pauseAnimations && s.pauseAnimations());
    const opened = new Set();
    $$('.pat-btn', grid).forEach((b, i) => b.onclick = () => {
      $$('.sortcard-why', grid)[i].classList.toggle('show');
      if (!opened.has(i)) { opened.add(i); xp(2); }
      if (opened.size === C.patterns.length) xp(12, 'All fifteen. Most of them you had already built.');
    });
  }

  if (cats) {
    const groups = [['all', 'All 15']].concat(Object.keys(C.patternCats).map(k =>
      [k, C.patternCats[k].ico + ' ' + C.patternCats[k].name]));
    groups.forEach(([k, label], i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), label);
      b.onclick = () => {
        $$('.chip', cats).forEach(c => c.classList.remove('active')); b.classList.add('active');
        $$('.labcard', grid).forEach(c => {
          const show = k === 'all' || c.dataset.cat === k;
          c.style.display = show ? '' : 'none';
          if (show) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
        });
      };
      cats.appendChild(b);
    });
  }

  /* the drill: a situation from an earlier chapter, four plausible patterns */
  const root = $('#pattern-drill'); if (!root) return;
  const byKey = {}; C.patterns.forEach(p => byKey[p.k] = p);
  let done = 0, score = 0;

  C.patternDrill.forEach(d => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(d.s)));
    const opts = el('div', 'sortcard-opts');
    d.o.forEach(k => {
      const b = el('button', 'sortopt', '<span class="so-n">' + byKey[k].n + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (d.o[xi] === d.a) x.classList.add('correct'); });
        if (k !== d.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.patternDrill.length)
          xp(10, score >= 5 ? 'You can name the shape — that is the whole point of the vocabulary'
                            : 'Re-read the near-misses: most pairs differ by when the choice is made');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + byKey[d.a].n + '.</b> ' + esc(d.why)));
    root.appendChild(card);
  });

  const here = $('#pattern-here');
  if (here) here.innerHTML = C.patternsHere.map(h =>
    '<div class="gterm"><b>' + h[0] + '</b><span>' + h[1] + '</span></div>').join('');

  const rules = $('#pattern-rules');
  if (rules) rules.innerHTML = C.patternRules.map(r =>
    '<div class="gterm"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
}

/* ============================================================
   Ch17 — Redis: four cards, then name the use case from a situation
   ============================================================ */
function initRedis() {
  const grid = $('#redis-cards');
  if (grid) {
    grid.innerHTML = C.redisUses.map(u =>
      '<div class="labcard">' +
        '<div class="lab-h">' + u.ico + ' <b>' + u.num + '. ' + u.n + '</b> → ' + esc(u.head) + '</div>' +
        '<p>' + esc(u.one) + '</p>' +
        '<div class="pcard-foot"><span class="pill">' + esc(u.type) + '</span></div>' +
        '<button class="btn btn-ghost redis-btn">Problem, commands, trap</button>' +
        '<div class="sortcard-why">' +
          '<b>The problem.</b> ' + esc(u.problem) + '<br><br>' +
          '<b>Where it shows up here.</b> ' + esc(u.ai) +
          '<pre class="code">' + esc(u.code) + '</pre>' +
          '<div class="ds-gotcha">⚠️ ' + esc(u.trap) + '</div>' +
        '</div>' +
      '</div>').join('');

    const opened = new Set();
    $$('.redis-btn', grid).forEach((b, i) => b.onclick = () => {
      $$('.sortcard-why', grid)[i].classList.toggle('show');
      if (!opened.has(i)) { opened.add(i); xp(3); }
      if (opened.size === C.redisUses.length) xp(10, 'All four. Every one of them is a cache of something you can rebuild.');
    });
  }

  /* the drill: a Snackr situation, four plausible use cases */
  const root = $('#redis-drill'); if (!root) return;
  const byKey = {}; C.redisUses.forEach(u => byKey[u.k] = u);
  let done = 0, score = 0;

  C.redisDrill.forEach(d => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(d.s)));
    const opts = el('div', 'sortcard-opts');
    d.o.forEach(k => {
      const b = el('button', 'sortopt', '<span class="so-n">' + byKey[k].ico + ' ' + byKey[k].n + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (d.o[xi] === d.a) x.classList.add('correct'); });
        if (k !== d.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.redisDrill.length)
          xp(10, score === 4 ? 'Four for four — that is the cheat sheet'
                             : 'Re-read the near-misses: each pair differs by whether the answer is a ranking, a decision or a place');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + byKey[d.a].n + '.</b> ' + esc(d.why)));
    root.appendChild(card);
  });

  const types = $('#redis-types');
  if (types) types.innerHTML = C.redisTypes.map(t =>
    '<div class="gterm"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>').join('');

  const rules = $('#redis-rules');
  if (rules) rules.innerHTML = C.redisRules.map(r =>
    '<div class="gterm"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
}

/* ============================================================
   Ch13 — vector indexes

   Four widgets: IVF built live on a 2-D corpus, the nprobe sweep
   that comes out of that same index, the four index families,
   product quantization, and a greedy walk down an HNSW graph.
   The IVF panel is the only one doing real work — everything it
   reports (recall, vectors scanned) is measured against a brute
   force search over the same points, never faked.
   ============================================================ */
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* one rAF tween, cancellable, shared by the IVF and HNSW animations */
function tween(ms, onFrame, done) {
  if (REDUCED) { onFrame(1); done && done(); return { cancel() {} }; }
  let start = null, id = 0, dead = false;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const frame = ts => {
    if (dead) return;
    if (start === null) start = ts;
    const t = Math.min(1, (ts - start) / ms);
    onFrame(ease(t));
    if (t < 1) id = requestAnimationFrame(frame); else done && done();
  };
  id = requestAnimationFrame(frame);
  return { cancel() { dead = true; cancelAnimationFrame(id); } };
}

function initAnn() { initIvf(); initAnnFamilies(); initPq(); initHnsw(); }

/* ---------- the IVF map ---------- */
function initIvf() {
  const cv = $('#ivf-canvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const N = 380, TOPK = 10, GRID = 8;

  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  const bctx = base.getContext('2d');

  let pts = [], cents = [], assign = [], cell = null;
  let nlist = 10, nprobe = 1, seed = 7, iter = 0, built = false;
  let query = { x: W * .62, y: H * .40 };
  let probed = new Set(), top = [], scanned = N, recall = 1, curve = [];
  let anim = null, awarded = false;

  const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const hue = i => (i * 47 + 15) % 360;
  const gauss = r => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); };

  function makeCorpus() {
    const r = lcg(seed);
    const blobs = Array.from({ length: 9 }, () => ({ x: 80 + r() * (W - 160), y: 60 + r() * (H - 120), s: 24 + r() * 42 }));
    pts = Array.from({ length: N }, (_, i) => {
      const b = blobs[Math.floor(r() * blobs.length)];
      return { id: i, x: clamp(b.x + gauss(r) * b.s, 10, W - 10), y: clamp(b.y + gauss(r) * b.s, 10, H - 10) };
    });
    built = false; probed = new Set(); top = []; scanned = N; recall = 1; curve = [];
  }

  /* k-means++ : spread the seeds out, or one blob quietly gets two centroids */
  function kppInit(k, r) {
    const cs = [{ x: pts[Math.floor(r() * N)].x, y: pts[Math.floor(r() * N)].y }];
    while (cs.length < k) {
      const w = pts.map(p => cs.reduce((m, c) => Math.min(m, d2(p, c)), Infinity));
      const sum = w.reduce((a, b) => a + b, 0);
      let t = r() * sum, i = 0;
      while (i < N - 1 && t > w[i]) { t -= w[i]; i++; }
      cs.push({ x: pts[i].x, y: pts[i].y });
    }
    return cs;
  }

  const nearest = p => { let bi = 0, bd = Infinity; cents.forEach((c, i) => { const d = d2(p, c); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const assignAll = () => { assign = pts.map(nearest); };

  function means() {
    const sx = new Float64Array(cents.length), sy = new Float64Array(cents.length), n = new Float64Array(cents.length);
    pts.forEach((p, i) => { const a = assign[i]; sx[a] += p.x; sy[a] += p.y; n[a]++; });
    return cents.map((c, i) => n[i] ? { x: sx[i] / n[i], y: sy[i] / n[i] } : { x: c.x, y: c.y });
  }

  function topK(list, k, q) {
    return list.map(p => ({ p, d: d2(p, q || query) })).sort((a, b) => a.d - b.d).slice(0, k).map(o => o.p);
  }

  /* the cells are a coarse nearest-centroid grid — a Voronoi diagram you can
     paint with fillRect instead of computing the polygons */
  function buildCells() {
    const cols = Math.ceil(W / GRID), rows = Math.ceil(H / GRID);
    cell = { cols, rows, id: new Uint8Array(cols * rows) };
    for (let gy = 0; gy < rows; gy++)
      for (let gx = 0; gx < cols; gx++)
        cell.id[gy * cols + gx] = nearest({ x: gx * GRID + GRID / 2, y: gy * GRID + GRID / 2 });
  }

  /* ---------- drawing ---------- */
  function cross(c, x, y, r, color, w) {
    c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - r, y - r); c.lineTo(x + r, y + r);
    c.moveTo(x + r, y - r); c.lineTo(x - r, y + r);
    c.stroke();
  }

  function renderBase() {
    bctx.clearRect(0, 0, W, H);
    bctx.fillStyle = 'rgba(4,6,14,.72)';
    bctx.fillRect(0, 0, W, H);

    if (built && cell) {
      for (let gy = 0; gy < cell.rows; gy++)
        for (let gx = 0; gx < cell.cols; gx++) {
          const id = cell.id[gy * cell.cols + gx];
          const hot = probed.has(id);
          bctx.fillStyle = 'hsla(' + hue(id) + ',' + (hot ? '72%,55%,.17' : '20%,45%,.05') + ')';
          bctx.fillRect(gx * GRID, gy * GRID, GRID, GRID);
        }
    }

    const topIds = new Set(top.map(p => p.id));
    pts.forEach((p, i) => {
      const id = built ? assign[i] : -1;
      const hot = built && probed.has(id);
      const color = !built ? 'rgba(200,206,230,.72)'
        : hot ? 'hsl(' + hue(id) + ' 85% 68%)'
              : 'hsla(' + hue(id) + ',30%,55%,.28)';
      cross(bctx, p.x, p.y, topIds.has(p.id) ? 5.5 : 3.6, color, topIds.has(p.id) ? 2.4 : 1.7);
      if (topIds.has(p.id)) {
        bctx.strokeStyle = 'rgba(52,211,153,.9)'; bctx.lineWidth = 1.4;
        bctx.beginPath(); bctx.arc(p.x, p.y, 9, 0, 6.2832); bctx.stroke();
      }
    });

    cents.forEach((c, i) => {
      const hot = probed.has(i);
      bctx.fillStyle = hot ? 'hsl(' + hue(i) + ' 90% 62%)' : 'rgba(160,168,200,.55)';
      bctx.strokeStyle = 'rgba(8,10,20,.9)'; bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.moveTo(c.x, c.y - 8); bctx.lineTo(c.x + 8, c.y); bctx.lineTo(c.x, c.y + 8); bctx.lineTo(c.x - 8, c.y);
      bctx.closePath(); bctx.fill(); bctx.stroke();
      if (hot) {
        bctx.strokeStyle = 'hsla(' + hue(i) + ',90%,70%,.55)'; bctx.lineWidth = 1.5;
        bctx.beginPath(); bctx.arc(c.x, c.y, 15, 0, 6.2832); bctx.stroke();
      }
    });
  }

  function paint(ring) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);

    if (top.length) {
      ctx.strokeStyle = 'rgba(52,211,153,.35)'; ctx.lineWidth = 1;
      top.forEach(p => { ctx.beginPath(); ctx.moveTo(query.x, query.y); ctx.lineTo(p.x, p.y); ctx.stroke(); });
    }
    if (ring != null) {
      ctx.strokeStyle = 'rgba(251,191,36,' + (0.55 * (1 - ring)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(query.x, query.y, ring * Math.max(W, H) * .55, 0, 6.2832); ctx.stroke();
    }
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(query.x, query.y, 6, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(query.x, query.y, 13, 0, 6.2832); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(query.x - 20, query.y); ctx.lineTo(query.x - 13, query.y);
    ctx.moveTo(query.x + 13, query.y); ctx.lineTo(query.x + 20, query.y);
    ctx.moveTo(query.x, query.y - 20); ctx.lineTo(query.x, query.y - 13);
    ctx.moveTo(query.x, query.y + 13); ctx.lineTo(query.x, query.y + 20);
    ctx.stroke();
  }

  /* ---------- build, animated ---------- */
  function build(animate) {
    if (anim) anim.cancel();
    cents = kppInit(nlist, lcg(seed * 31 + nlist));
    iter = 0; built = false; probed = new Set(); top = [];
    assignAll(); renderBase(); paint();
    badge('training · k-means iteration 0');
    if (animate && !REDUCED) stepKmeans(); else { for (let i = 0; i < 14 && lloyd(); i++); finish(); }
  }

  function lloyd() {
    assignAll();
    const next = means();
    const moved = Math.max(...cents.map((c, i) => Math.hypot(c.x - next[i].x, c.y - next[i].y)));
    cents = next;
    return moved > 0.7;
  }

  function stepKmeans() {
    assignAll(); renderBase(); paint();
    badge('training · k-means iteration ' + (iter + 1) + ' — every × joins its nearest centroid');
    const from = cents.map(c => ({ x: c.x, y: c.y }));
    const to = means();
    const moved = Math.max(...from.map((c, i) => Math.hypot(c.x - to[i].x, c.y - to[i].y)));
    anim = tween(380, t => {
      cents = from.map((c, i) => ({ x: c.x + (to[i].x - c.x) * t, y: c.y + (to[i].y - c.y) * t }));
      renderBase(); paint();
    }, () => {
      iter++;
      if (moved > 0.7 && iter < 14) setTimeout(stepKmeans, 70);
      else finish();
    });
  }

  function finish() {
    assignAll(); buildCells(); built = true;
    badge('indexed · ' + nlist + ' cells, ' + iter + ' k-means iterations');
    sweep();
    search(true);
    if (!awarded) { awarded = true; xp(6, 'Index built. Those ' + nlist + ' diamonds are the entire index — everything else is bookkeeping.'); }
  }

  /* ---------- search ---------- */
  function search(animate) {
    if (!built) {
      probed = new Set(); top = topK(pts, TOPK); scanned = N; recall = 1;
      renderBase(); paint(); out(); return;
    }
    const order = cents.map((c, i) => ({ i, d: d2(c, query) })).sort((a, b) => a.d - b.d);
    probed = new Set(order.slice(0, nprobe).map(o => o.i));
    const cand = pts.filter((p, i) => probed.has(assign[i]));
    const exact = new Set(topK(pts, TOPK).map(p => p.id));
    top = topK(cand, TOPK);
    recall = top.filter(p => exact.has(p.id)).length / TOPK;
    scanned = cand.length;
    renderBase(); out();
    if (animate && !REDUCED) { if (anim) anim.cancel(); anim = tween(620, t => paint(t), () => paint()); }
    else paint();
  }

  const badge = t => { const b = $('#ivf-badge'); if (b) b.textContent = t; };

  function out() {
    const host = $('#ivf-out'); if (!host) return;
    const compared = built ? scanned + nlist : N;
    const pct = compared / N * 100;
    host.innerHTML =
      '<div class="stat-row">' +
        stat(fmt(compared), 'vectors compared', pct < 30 ? '#34d399' : pct < 70 ? '#fbbf24' : '#fb7185') +
        stat((recall * 100).toFixed(0) + '%', 'recall@10', recall > .9 ? '#34d399' : recall > .7 ? '#fbbf24' : '#fb7185') +
        stat((N / compared).toFixed(1) + '×', 'less work than flat') +
        stat((built ? nprobe : nlist) + '/' + nlist, 'cells opened') +
      '</div>' +
      bar('corpus scanned', pct, pct < 30 ? '#34d399' : '#fbbf24', pct.toFixed(0) + '%') +
      bar('recall@10', recall * 100, recall > .9 ? '#34d399' : '#fb7185', (recall * 100).toFixed(0) + '%');
    const note = $('#ivf-advice');
    if (note) note.innerHTML = advice();
    renderCurve();
  }

  function advice() {
    if (!built) return '🧱 <b>No index yet — this is Flat search.</b> Every query compares against all ' + N +
      ' vectors, which is exact and, at ten million vectors, unaffordable. Press <b>Run k-means</b> and watch the corpus get carved into cells.';
    const pct = (scanned + nlist) / N * 100;
    if (nprobe >= nlist) return '🐌 <b>nprobe = nlist, so you are opening every cell.</b> That is brute force plus the cost of scanning ' +
      nlist + ' centroids first — strictly worse than Flat. The index only pays when you refuse to look at most of it.';
    if (recall < 0.75) return '⚠️ <b>Recall ' + (recall * 100).toFixed(0) + '% at nprobe=' + nprobe + '.</b> Look at the query crosshair: some of its true nearest neighbours are sitting just across a cell boundary, in a cell you did not open. This is the <b>edge effect</b>, and it is the characteristic failure of IVF — nothing is broken, you simply told it not to look there.';
    if (recall === 1 && pct < 30) return '✅ <b>Perfect recall while touching ' + pct.toFixed(0) + '% of the corpus.</b> Now drag the query onto a cell boundary and watch it drop. Recall is not a property of the index — it is a property of the index <i>and this particular query</i>, which is why you measure it over a golden set rather than once.';
    return '💡 <b>' + (recall * 100).toFixed(0) + '% recall for ' + pct.toFixed(0) + '% of the work.</b> That is the entire trade, in two numbers. Raise nprobe until recall stops moving and stop there — the sweep below shows exactly where that point is for this index.';
  }

  /* ---------- the nprobe sweep: same index, 24 random queries ---------- */
  function sweep() {
    const r = lcg(4242);
    const qs = Array.from({ length: 24 }, () => ({ x: 20 + r() * (W - 40), y: 20 + r() * (H - 40) }));
    const exact = qs.map(q => new Set(topK(pts, TOPK, q).map(p => p.id)));
    curve = [];
    for (let np = 1; np <= nlist; np++) {
      let rec = 0, sc = 0;
      qs.forEach((q, qi) => {
        const set = new Set(cents.map((c, i) => ({ i, d: d2(c, q) })).sort((a, b) => a.d - b.d).slice(0, np).map(o => o.i));
        const cand = pts.filter((p, i) => set.has(assign[i]));
        sc += cand.length;
        rec += topK(cand, TOPK, q).filter(p => exact[qi].has(p.id)).length / TOPK;
      });
      curve.push({ np, recall: rec / qs.length, scan: (sc / qs.length + nlist) / N });
    }
  }

  function renderCurve() {
    const c = $('#ivf-curve'); if (!c || !curve.length) return;
    const g = c.getContext('2d'), CW = c.width, CH = c.height;
    const L = 46, R = CW - 16, T = 18, B = CH - 30;
    g.clearRect(0, 0, CW, CH);
    g.font = '11px "JetBrains Mono", monospace';

    for (let p = 0; p <= 100; p += 25) {
      const y = B - (B - T) * p / 100;
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
      g.fillStyle = '#6f7594'; g.textAlign = 'right';
      g.fillText(p + '%', L - 8, y + 4);
    }
    const X = np => L + (R - L) * (curve.length === 1 ? .5 : (np - 1) / (curve.length - 1));
    const Y = v => B - (B - T) * clamp(v, 0, 1);

    const line = (key, color) => {
      g.strokeStyle = color; g.lineWidth = 2.2; g.beginPath();
      curve.forEach((d, i) => i ? g.lineTo(X(d.np), Y(d[key])) : g.moveTo(X(d.np), Y(d[key])));
      g.stroke();
    };
    line('scan', '#7c5cff');
    line('recall', '#34d399');

    const here = curve[Math.min(nprobe, curve.length) - 1];
    g.strokeStyle = 'rgba(251,191,36,.7)'; g.setLineDash([4, 4]); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(X(here.np), T); g.lineTo(X(here.np), B); g.stroke();
    g.setLineDash([]);
    [['recall', '#34d399'], ['scan', '#7c5cff']].forEach(([k, col]) => {
      g.fillStyle = col; g.beginPath(); g.arc(X(here.np), Y(here[k]), 4.5, 0, 6.2832); g.fill();
    });

    g.textAlign = 'center'; g.fillStyle = '#6f7594';
    curve.forEach(d => { if (curve.length <= 12 || d.np % 2 === 1) g.fillText(d.np, X(d.np), B + 16); });
    g.fillText('nprobe (cells opened per query)', (L + R) / 2, CH - 2);
    g.textAlign = 'left';
    g.fillStyle = '#34d399'; g.fillText('■ recall@10', L + 6, T + 2);
    g.fillStyle = '#7c5cff'; g.fillText('■ corpus scanned', L + 96, T + 2);
    g.fillStyle = '#fbbf24'; g.fillText('▲ you are here: nprobe=' + here.np, L + 232, T + 2);
  }

  /* ---------- controls ---------- */
  const at = e => {
    const r = cv.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) * (W / r.width), 4, W - 4), y: clamp((e.clientY - r.top) * (H / r.height), 4, H - 4) };
  };
  let dragging = false;
  cv.addEventListener('pointerdown', e => { dragging = true; cv.setPointerCapture(e.pointerId); query = at(e); search(false); });
  cv.addEventListener('pointermove', e => { if (dragging) { query = at(e); search(false); } });
  cv.addEventListener('pointerup', () => { dragging = false; xp(2); });

  const nl = $('#ivf-nlist'), np = $('#ivf-nprobe');
  nl.oninput = () => { $('#ivf-nlist-v').textContent = nl.value; };
  nl.onchange = () => { nlist = +nl.value; nprobe = Math.min(nprobe, nlist); np.max = nlist; np.value = nprobe; $('#ivf-nprobe-v').textContent = nprobe; build(true); };
  np.oninput = () => { nprobe = +np.value; $('#ivf-nprobe-v').textContent = nprobe; search(false); };

  $('#ivf-run').onclick = () => build(true);
  $('#ivf-search').onclick = () => { if (!built) return build(true); search(true); xp(3); };
  $('#ivf-new').onclick = () => { seed = (seed * 7 + 13) % 9973; makeCorpus(); build(true); };

  const phases = $('#ivf-phases');
  if (phases) phases.innerHTML = C.ivfPhases.map(p =>
    '<div class="pcard"><div class="pcard-badge">' + p[0] + '</div><div class="pcard-desc">' + p[1] + '</div></div>').join('');

  makeCorpus();
  search(false);
}

/* ---------- the four families, then pick one ---------- */
function initAnnFamilies() {
  const grid = $('#ann-cards');
  const byKey = {}; C.annFamilies.forEach(f => byKey[f.k] = f);
  if (grid) {
    const maxB = Math.max(...C.annFamilies.map(f => f.bytes));
    const maxQ = Math.max(...C.annFamilies.map(f => f.qps));
    grid.innerHTML = C.annFamilies.map(f =>
      '<div class="labcard">' +
        '<div class="lab-h">' + f.ico + ' <b>' + f.n + '</b> <span class="pill">' + f.tag + '</span></div>' +
        '<p>' + esc(f.one) + '</p>' +
        bar('recall@10', f.recall, '#34d399', f.recall + '%') +
        bar('throughput', f.qps / maxQ * 100, '#22d3ee', f.qps + '×') +
        bar('memory', f.bytes / maxB * 100, '#fb7185', f.bytes >= 1000 ? (f.bytes / 1024).toFixed(1) + ' KB' : f.bytes + ' B') +
        '<button class="btn btn-ghost ann-btn">What it wins, what it costs</button>' +
        '<div class="sortcard-why">' +
          '<b>Wins.</b> ' + f.win + '<br><br><b>Costs.</b> ' + f.cost +
          '<div class="ds-gotcha">📍 ' + esc(f.when) + '</div>' +
        '</div>' +
      '</div>').join('');
    const opened = new Set();
    $$('.ann-btn', grid).forEach((b, i) => b.onclick = () => {
      $$('.sortcard-why', grid)[i].classList.toggle('show');
      if (!opened.has(i)) { opened.add(i); xp(3); }
      if (opened.size === C.annFamilies.length)
        xp(8, 'All four. Note that none of them wins on all three bars — that is the whole decision.');
    });
  }

  const root = $('#ann-drill'); if (!root) return;
  let done = 0, score = 0;
  C.annDrill.forEach(d => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(d.s)));
    const opts = el('div', 'sortcard-opts three');
    d.o.forEach(k => {
      const b = el('button', 'sortopt', '<span class="so-n">' + byKey[k].ico + ' ' + byKey[k].n + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (d.o[xi] === d.a) x.classList.add('correct'); });
        if (k !== d.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.annDrill.length)
          xp(10, score === C.annDrill.length ? 'Four for four — you sized the memory before you picked the index'
                                             : 'Re-read the misses: each one is decided by a constraint, not by which index is best');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + byKey[d.a].n + '.</b> ' + d.why));
    root.appendChild(card);
  });

  const notes = $('#ann-notes');
  if (notes) notes.innerHTML = C.annNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ---------- product quantization ---------- */
function initPq() {
  const host = $('#pq-knobs'); if (!host) return;
  const val = {}; C.pqKnobs.forEach(k => val[k.k] = k.val);

  host.innerHTML = C.pqKnobs.map(k =>
    '<div class="ctrl"><label for="pq-' + k.k + '">' + k.name + ' <span class="mono" id="pq-' + k.k + '-v">' + k.val + k.unit + '</span></label>' +
    '<input type="range" id="pq-' + k.k + '" min="' + k.min + '" max="' + k.max + '" step="' + k.step + '" value="' + k.val + '"></div>').join('');
  C.pqKnobs.forEach(k => $('#pq-' + k.k).oninput = e => {
    val[k.k] = +e.target.value;
    $('#pq-' + k.k + '-v').textContent = val[k.k] + k.unit;
    render();
  });

  function render() {
    const dims = val.dims, m = Math.min(val.m, dims), bits = val.bits;
    const per = Math.round(dims / m);                 // dimensions each single code stands for
    const raw = dims * 4;                             // float32
    const pq = Math.ceil(m * bits / 8);
    const shown = Math.min(m, 16);
    // stand-in for the real curve: the more dimensions one code must represent, the more it loses
    const recall = clamp(0.995 - 0.0016 * per * (8 / bits), 0.4, 0.995);
    const gb = b => (b * 1e8 / 1073741824).toFixed(b > 500 ? 0 : 1) + ' GB';

    $('#pq-strip').innerHTML = Array.from({ length: shown }, (_, i) =>
      '<div class="pq-seg" style="--h:' + ((i * 37) % 360) + ';animation-delay:' + (i * 28) + 'ms">' +
      '<span>' + per + 'd</span></div>').join('') + (m > shown ? '<div class="pq-more">+' + (m - shown) + '</div>' : '');

    $('#pq-codes').innerHTML = Array.from({ length: shown }, (_, i) =>
      '<div class="pq-code" style="--h:' + ((i * 37) % 360) + ';animation-delay:' + (140 + i * 28) + 'ms">' +
      ((i * 53 + 17) % (1 << bits)).toString(16).toUpperCase() + '</div>').join('') +
      (m > shown ? '<div class="pq-more">+' + (m - shown) + '</div>' : '');

    $('#pq-out').innerHTML =
      '<div class="stat-row">' +
        stat(raw + ' B', 'float32 vector') +
        stat(pq + ' B', 'quantized', '#34d399') +
        stat((raw / pq).toFixed(0) + '×', 'smaller', '#22d3ee') +
        stat((recall * 100).toFixed(0) + '%', 'recall before rerank', recall > .9 ? '#34d399' : recall > .8 ? '#fbbf24' : '#fb7185') +
      '</div>' +
      bar('100M vectors, raw', 100, '#fb7185', gb(raw)) +
      bar('100M vectors, PQ', pq / raw * 100, '#34d399', gb(pq)) +
      '<div class="tnote">' + pqAdvice(per, bits, recall, raw / pq) + '</div>';
  }

  function pqAdvice(per, bits, recall, ratio) {
    if (per > 32) return '⚠️ <b>Each code is standing in for ' + per + ' dimensions.</b> One byte cannot describe a 32-dimensional sub-space, so distances between codes stop tracking distances between vectors and recall falls off a cliff. Raise m before you raise anything else.';
    if (bits === 4) return '💡 <b>4 bits gives you 16 centroids per sub-space</b> instead of 256. Half the memory of 8-bit, and a noticeably coarser vector. It is a real option at billion scale and a bad default below it.';
    if (ratio > 40) return '✅ <b>' + ratio.toFixed(0) + '× compression at ' + (recall * 100).toFixed(0) + '% recall.</b> Now add the move that makes PQ practical: retrieve the top few hundred on codes, then rescore just those against the full-precision vectors. Most of the lost recall comes straight back for a few milliseconds.';
    return '💡 <b>' + ratio.toFixed(0) + '× smaller, ' + (recall * 100).toFixed(0) + '% recall.</b> PQ is the only knob here that changes which hardware you need rather than how fast it runs. Pair it with a rerank pass on exact vectors and the recall cost mostly disappears.';
  }
  render();
}

/* ---------- HNSW: greedy hops, coarse layers first ---------- */
function initHnsw() {
  const svg = $('#hnsw-svg'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const r = lcg(31);
  const nodes = Array.from({ length: 30 }, (_, i) => ({ i, x: .06 + r() * .88, y: .08 + r() * .84 }));
  const q = { x: .74, y: .68 };
  // layer membership shrinks geometrically, exactly as HNSW assigns levels
  const layers = [nodes, nodes.filter((_, i) => i % 3 === 0), nodes.filter((_, i) => i % 9 === 0)];
  const planeY = [300, 180, 60];
  const P = (n, l) => ({ x: 70 + n.x * 560 + (1 - n.y) * 100, y: planeY[l] + n.y * 84 });

  const near = (list, from, k) => list.filter(n => n !== from)
    .map(n => ({ n, d: (n.x - from.x) ** 2 + (n.y - from.y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, k).map(o => o.n);

  const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  svg.innerHTML = '';

  const nodeEls = {};
  [2, 1, 0].forEach(l => {
    const list = layers[l];
    const g = mk('g', { class: 'hnsw-layer' });
    const c1 = P({ x: 0, y: 0 }, l), c2 = P({ x: 1, y: 0 }, l), c3 = P({ x: 1, y: 1 }, l), c4 = P({ x: 0, y: 1 }, l);
    g.appendChild(mk('polygon', { points: [c1, c2, c3, c4].map(p => p.x + ',' + p.y).join(' '), class: 'hnsw-plane' }));
    g.appendChild(mk('text', { x: 18, y: planeY[l] + 46, class: 'hnsw-ltext' })).textContent = 'L' + l;

    list.forEach(n => near(list, n, l === 0 ? 3 : 2).forEach(o => {
      const a = P(n, l), b = P(o, l);
      g.appendChild(mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'hnsw-edge', 'data-e': l + ':' + Math.min(n.i, o.i) + '-' + Math.max(n.i, o.i) }));
    }));
    list.forEach(n => {
      const p = P(n, l);
      const c = mk('circle', { cx: p.x, cy: p.y, r: 6, class: 'hnsw-node' });
      g.appendChild(c);
      nodeEls[l + ':' + n.i] = c;
    });
    if (l === 0) {
      const p = P(q, 0);
      g.appendChild(mk('circle', { cx: p.x, cy: p.y, r: 9, class: 'hnsw-query' }));
      g.appendChild(mk('text', { x: p.x + 15, y: p.y + 4, class: 'hnsw-qtext' })).textContent = 'query';
    }
    svg.appendChild(g);
  });
  const marker = mk('circle', { r: 9, class: 'hnsw-marker', cx: -50, cy: -50 });
  svg.appendChild(marker);

  /* greedy descent: best node in this layer becomes the entry point of the next */
  function plan() {
    const path = [];
    let cur = layers[2][0];
    for (let l = 2; l >= 0; l--) {
      if (!layers[l].includes(cur)) cur = near(layers[l], cur, 1)[0];
      path.push({ l, n: cur });
      for (;;) {
        const better = near(layers[l], cur, 4)
          .filter(o => (o.x - q.x) ** 2 + (o.y - q.y) ** 2 < (cur.x - q.x) ** 2 + (cur.y - q.y) ** 2)
          .sort((a, b) => ((a.x - q.x) ** 2 + (a.y - q.y) ** 2) - ((b.x - q.x) ** 2 + (b.y - q.y) ** 2))[0];
        if (!better) break;
        cur = better;
        path.push({ l, n: cur });
      }
    }
    return path;
  }

  let anim = null;
  function run() {
    if (anim) anim.cancel();
    $$('.hnsw-node', svg).forEach(n => n.classList.remove('on'));
    $$('.hnsw-edge', svg).forEach(e => e.classList.remove('on'));
    const path = plan();
    let i = 0;
    const cap = $('#hnsw-cap');
    const hop = () => {
      const cur = path[i], next = path[i + 1];
      const a = P(cur.n, cur.l);
      nodeEls[cur.l + ':' + cur.n.i].classList.add('on');
      marker.setAttribute('cx', a.x); marker.setAttribute('cy', a.y);
      if (cap && (i === 0 || path[i - 1].l !== cur.l)) {
        const s = C.hnswSteps[2 - cur.l];
        cap.innerHTML = '<b>' + s[0] + '.</b> ' + s[1];
      }
      if (!next) { xp(3); return; }
      const b = P(next.n, next.l);
      if (cur.l === next.l) {
        const e = svg.querySelector('[data-e="' + cur.l + ':' + Math.min(cur.n.i, next.n.i) + '-' + Math.max(cur.n.i, next.n.i) + '"]');
        if (e) e.classList.add('on');
      }
      anim = tween(cur.l === next.l ? 520 : 760, t => {
        marker.setAttribute('cx', a.x + (b.x - a.x) * t);
        marker.setAttribute('cy', a.y + (b.y - a.y) * t);
      }, () => { i++; hop(); });
    };
    hop();
  }

  $('#hnsw-run').onclick = run;
  const cap = $('#hnsw-cap');
  if (cap) cap.innerHTML = '<b>' + C.hnswSteps[0][0] + '.</b> ' + C.hnswSteps[0][1];
}


/* ============================================================
   Shared helpers for chapters 19-22
   ============================================================ */
function cmpTable(host, spec) {
  if (!host) return;
  host.innerHTML =
    '<div class="cmp-wrap"><table class="cmp">' +
    '<thead><tr><th></th>' + spec.cols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead>' +
    '<tbody>' + spec.rows.map(r =>
      '<tr><th scope="row">' + r[0] + '</th>' +
      r.slice(1).map((c, i) => '<td class="c' + i + '">' + c + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}
const miniBar = (frac, cls) =>
  '<div class="mini-bar ' + (cls || '') + '"><i style="width:' + Math.max(0, Math.min(100, frac * 100)) + '%"></i></div>';
const bytesToGB = b => b / 1073741824;
const fmtB = b => b >= 1073741824 ? bytesToGB(b).toFixed(1) + ' GB' : (b / 1048576).toFixed(0) + ' MB';

/* ============================================================
   Ch19 — caching layers
   ============================================================ */
function initCaching() {
  const host = $('#cl-ladder'); if (!host) return;

  /* ---- the ladder ---- */
  function drawLadder(sel) {
    host.innerHTML = '<div class="cl-rungs">' + C.cacheLadder.map((r, i) =>
      '<button class="cl-rung' + (sel === r.id ? ' sel' : '') + '" data-id="' + r.id + '">' +
      '<span class="cl-n">' + (i === 0 ? '&mdash;' : i) + '</span>' +
      '<span class="cl-body"><b>' + r.n + '</b><small>' + r.what + '</small></span>' +
      '<span class="cl-metric">' + miniBar(r.hit) + '<i>' + (r.hit * 100).toFixed(0) + '% hit</i></span>' +
      '<span class="cl-lat">' + (r.lat === 0 ? 'prefill only' : r.lat + ' ms') + '</span>' +
      (r.risk > 0 ? '<span class="cl-risk">can be wrong</span>' : '<span class="cl-safe">always correct</span>') +
      '</button>').join('') + '</div>';
    $$('.cl-rung', host).forEach(b => b.onclick = () => {
      const r = C.cacheLadder.filter(x => x.id === b.dataset.id)[0];
      drawLadder(r.id);
      $('#cl-detail').innerHTML = '<h4>' + r.n + '</h4>' +
        '<div class="knob-lay"><span>plain English</span>' + r.lay + '</div>' +
        '<div class="knob-tech"><span>the key</span>' + r.what + '</div>' +
        '<div class="cc-good"><b>Use it when</b> ' + r.when + '</div>' +
        '<div class="arch-kill"><b>The trap:</b> ' + r.trap + '</div>';
      xp(2);
    });
  }
  drawLadder(null);
  $('#cl-detail').innerHTML = '<p class="dim">Click a rung.</p>';

  /* ---- semantic cache threshold ---- */
  function scPaint() {
    const t = parseFloat($('#sc-t').value);
    $('#sc-tv').textContent = t.toFixed(2);
    const cachedIntent = C.cacheCached.intent;
    let served = 0, wrong = 0, missedGood = 0, calls = 0;
    const rows = C.cacheQueries.map(q => {
      const hit = q.sim >= t;
      const same = q.intent === cachedIntent;
      let verdict;
      if (hit && same) { served++; verdict = 'good-hit'; }
      else if (hit && !same) { served++; wrong++; verdict = 'wrong'; }
      else if (!hit && same) { calls++; missedGood++; verdict = 'missed'; }
      else { calls++; verdict = 'correct-miss'; }
      return { q: q, verdict: verdict, hit: hit };
    });
    const n = C.cacheQueries.length;
    const hitRate = served / n;
    const wrongRate = served ? wrong / served : 0;
    $('#sc-stats').innerHTML =
      '<div class="stat"><div class="stat-v">' + (hitRate * 100).toFixed(0) + '%</div><div class="stat-k">cache hit rate</div></div>' +
      '<div class="stat"><div class="stat-v ' + (wrong ? 'bad' : 'good') + '">' + wrong + '</div><div class="stat-k">WRONG answers served</div></div>' +
      '<div class="stat"><div class="stat-v">' + missedGood + '</div><div class="stat-k">missed good hits</div></div>' +
      '<div class="stat"><div class="stat-v">' + (hitRate * 100).toFixed(0) + '%</div><div class="stat-k">inference cost saved</div></div>';
    $('#sc-rows').innerHTML = rows.map(r =>
      '<div class="sc-row ' + r.verdict + '">' +
      '<span class="sc-q">' + r.q.q + '</span>' +
      '<span class="sc-sim">' + r.q.sim.toFixed(2) + '</span>' +
      '<span class="sc-int">' + r.q.intent + '</span>' +
      '<span class="sc-v">' + (r.verdict === 'good-hit' ? 'cache &#10003;' :
        r.verdict === 'wrong' ? 'cache &#10007; WRONG' :
        r.verdict === 'missed' ? 'model (could have hit)' : 'model &#10003;') + '</span></div>').join('');
    let note;
    if (wrong > 1) note = '<b class="bad">' + wrong + ' customers just got the wrong answer.</b> Look at "how long do refunds take NOT" &mdash; negation barely moves an embedding, so it sits at 0.95 similarity to its own opposite. This is the failure mode that makes people afraid of semantic caching, and the reason the threshold is not a hit-rate dial.';
    else if (wrong === 1) note = '<b class="warn">One wrong answer.</b> Usually a near-duplicate intent: "refund time for a lost card" is not the same answer as "refund time". Either raise the threshold, or put the distinguishing entity (card status, payment method) into the cache key so they cannot collide.';
    else if (hitRate < 0.15) note = '<b>Safe, and barely worth running.</b> At this threshold you are paying for an embedding and a vector search to hit almost nothing. If you cannot get above about 25% here, exact plus normalised caching is the better spend.';
    else note = '<b class="good">This is the zone you want.</b> Real paraphrases hit, different intents miss, and nobody is served a wrong answer. Find it by labelling a few hundred real queries by intent &mdash; not by guessing 0.9 because it sounds high.';
    $('#sc-note').innerHTML = note;
  }
  $('#sc-t').oninput = scPaint;

  cmpTable($('#cache-compare'), C.cacheCompare);
  $('#cache-compare-verdict').innerHTML = '<b>Verdict.</b> ' + C.cacheCompare.verdict;

  $('#cache-paths').innerHTML = C.cachePathologies.map(p =>
    '<button class="path" data-id="' + p.id + '"><span class="path-ico">' + p.icon + '</span>' +
    '<b>' + p.n + '</b><span>' + p.lay + '</span></button>').join('');
  $$('#cache-paths .path').forEach(b => b.onclick = () => {
    const p = C.cachePathologies.filter(x => x.id === b.dataset.id)[0];
    $$('#cache-paths .path').forEach(x => x.classList.toggle('active', x === b));
    $('#cache-path-detail').innerHTML =
      '<h4>' + p.icon + ' ' + p.n + '</h4>' +
      '<div class="knob-lay"><span>plain English</span>' + p.lay + '</div>' +
      '<div class="knob-tech"><span>technically</span>' + p.tech + '</div>' +
      '<div class="lab-pane-title" style="margin-top:12px">Fixes</div>' +
      '<ul class="fact-list">' + p.fixes.map(f => '<li>' + f + '</li>').join('') + '</ul>' +
      '<div class="cc-bad"><b>In an LLM system</b> ' + p.llm + '</div>';
    xp(2);
  });
  $('#cache-path-detail').innerHTML = '<p class="dim">Click a failure mode.</p>';
  $('#cache-key-code').textContent = C.cacheKeyRecipe;
  scPaint();
}

/* ============================================================
   Ch20 — sharding and parallelism
   ============================================================ */
function parMemory(m, gpu, bits, seq, batch, strat, deg) {
  const bytesPerParam = bits / 8;
  const headDim = m.d / m.heads;
  const kvPerToken = 2 * m.layers * m.kvHeads * headDim * 2;   // K and V, fp16
  let weights = m.params * bytesPerParam;
  let kv = kvPerToken * seq * batch;
  const act = batch * seq * m.d * 2 * 4 + 2 * 1073741824;      // working set + framework
  let perGpuW = weights, perGpuKv = kv, note = '';
  if (strat === 'tensor')       { perGpuW = weights / deg; perGpuKv = kv / deg; }
  else if (strat === 'pipeline'){ perGpuW = weights / deg; perGpuKv = kv / deg; }
  else if (strat === 'data')    { perGpuW = weights;       perGpuKv = kv;       }
  else if (strat === 'expert' && m.experts) {
    const expertShare = 0.92;                                   // MoE weights are mostly experts
    perGpuW = weights * (1 - expertShare) + weights * expertShare / deg;
    perGpuKv = kv;
  } else if (strat === 'expert') { perGpuW = weights; note = 'this model has no experts to split'; }
  const perGpu = perGpuW + perGpuKv + act;
  const cap = gpu.vram * 1073741824 * 0.92;                     // leave headroom
  return { weights: weights, kv: kv, act: act, kvPerToken: kvPerToken,
           perGpuW: perGpuW, perGpuKv: perGpuKv, perGpu: perGpu, cap: cap,
           fits: perGpu <= cap, need: Math.ceil((weights + kv + act) / cap), note: note };
}
function initParallel() {
  const host = $('#par-calc'); if (!host) return;
  const S = { model: 1, gpu: 2, bits: 16, seq: 4096, batch: 16, strat: 'tensor', deg: 4 };
  host.innerHTML =
    '<label>model<select id="pc-m">' + C.parModels.map((m, i) => '<option value="' + i + '"' + (i === 1 ? ' selected' : '') + '>' + m.n + '</option>').join('') + '</select></label>' +
    '<label>GPU<select id="pc-g">' + C.parGpus.map((g, i) => '<option value="' + i + '"' + (i === 2 ? ' selected' : '') + '>' + g.n + '</option>').join('') + '</select></label>' +
    '<label>weight precision<select id="pc-b"><option value="16">fp16 / bf16</option><option value="8">int8</option><option value="4">int4 / NF4</option></select></label>' +
    '<label>sequence length <span class="val" id="pv-seq"></span><input type="range" id="pc-seq" min="512" max="32768" step="512" value="4096"></label>' +
    '<label>concurrent requests <span class="val" id="pv-batch"></span><input type="range" id="pc-batch" min="1" max="128" step="1" value="16"></label>' +
    '<label>strategy<select id="pc-s">' + C.parStrategies.map(s => '<option value="' + s.id + '"' + (s.id === 'tensor' ? ' selected' : '') + '>' + s.n + '</option>').join('') + '</select></label>' +
    '<label>GPUs (degree) <span class="val" id="pv-deg"></span><input type="range" id="pc-deg" min="1" max="16" step="1" value="4"></label>';
  ['m', 'g', 'b', 'seq', 'batch', 's', 'deg'].forEach(k => {
    const e = $('#pc-' + k); e.oninput = read; e.onchange = read;
  });
  function read() {
    S.model = +$('#pc-m').value; S.gpu = +$('#pc-g').value; S.bits = +$('#pc-b').value;
    S.seq = +$('#pc-seq').value; S.batch = +$('#pc-batch').value;
    S.strat = $('#pc-s').value; S.deg = +$('#pc-deg').value;
    paint();
  }
  function paint() {
    const m = C.parModels[S.model], g = C.parGpus[S.gpu];
    const deg = S.strat === 'none' ? 1 : S.deg;
    $('#pv-seq').textContent = S.seq.toLocaleString();
    $('#pv-batch').textContent = S.batch;
    $('#pv-deg').textContent = deg;
    const r = parMemory(m, g, S.bits, S.seq, S.batch, S.strat, deg);
    $('#par-stats').innerHTML =
      '<div class="stat"><div class="stat-v">' + fmtB(r.weights) + '</div><div class="stat-k">weights total</div></div>' +
      '<div class="stat"><div class="stat-v">' + (r.kvPerToken / 1024).toFixed(0) + ' KB</div><div class="stat-k">KV per token</div></div>' +
      '<div class="stat"><div class="stat-v">' + fmtB(r.kv) + '</div><div class="stat-k">KV cache total</div></div>' +
      '<div class="stat"><div class="stat-v ' + (r.fits ? 'good' : 'bad') + '">' + fmtB(r.perGpu) + '</div><div class="stat-k">per GPU</div></div>' +
      '<div class="stat"><div class="stat-v">' + fmtB(r.cap) + '</div><div class="stat-k">usable per GPU</div></div>' +
      '<div class="stat"><div class="stat-v ' + (r.fits ? 'good' : 'bad') + '">' + (r.fits ? 'FITS' : 'OOM') + '</div><div class="stat-k">verdict</div></div>';
    /* topology */
    const boxes = [];
    for (let i = 0; i < Math.min(deg, 16); i++) {
      const wPct = r.perGpuW / r.cap, kPct = r.perGpuKv / r.cap, aPct = r.act / r.cap;
      boxes.push('<div class="gpu' + (r.fits ? '' : ' over') + '">' +
        '<div class="gpu-h">GPU ' + i + '<small>' + g.n + '</small></div>' +
        '<div class="gpu-stack">' +
        '<i class="w" style="height:' + Math.min(100, wPct * 100) + '%" title="weights"></i>' +
        '<i class="k" style="height:' + Math.min(100, kPct * 100) + '%" title="KV cache"></i>' +
        '<i class="a" style="height:' + Math.min(100, aPct * 100) + '%" title="activations"></i>' +
        '</div><div class="gpu-f">' +
        (S.strat === 'tensor' ? 'slice of every layer' :
         S.strat === 'pipeline' ? 'layers ' + Math.round(i * m.layers / deg) + '-' + Math.round((i + 1) * m.layers / deg - 1) :
         S.strat === 'data' ? 'full copy' :
         S.strat === 'expert' ? 'experts ' + i + (m.experts ? '/' + m.experts : '') :
         S.strat === 'zero' ? 'param + optimiser shard' : 'everything') +
        '</div></div>');
    }
    $('#par-topology').innerHTML =
      '<div class="gpu-legend"><span><i class="w"></i>weights</span><span><i class="k"></i>KV cache</span>' +
      '<span><i class="a"></i>activations + framework</span><span class="dim">bar height = share of one GPU</span></div>' +
      '<div class="gpu-row">' + boxes.join('') + '</div>';
    const st = C.parStrategies.filter(x => x.id === S.strat)[0];
    let v;
    if (r.fits && deg === 1) v = '<b class="ok">It fits on one GPU.</b> Stop here. Every parallelism strategy below costs communication, complexity and a new class of failure &mdash; and none of them beat "it already fits".';
    else if (r.fits) v = '<b class="ok">Fits across ' + deg + ' GPUs with ' + st.n.toLowerCase() + '.</b> Communication cost: ' + st.comm + '. ' +
      (S.strat === 'tensor' && deg > 8 ? '<b class="warn">Above 8-way tensor parallel you are almost certainly communication-bound &mdash; go pipeline across nodes instead.</b>' :
       S.strat === 'pipeline' && S.batch < deg * 4 ? '<b class="warn">With only ' + S.batch + ' concurrent requests across ' + deg + ' stages, most GPUs are sitting in the pipeline bubble. Raise concurrency or reduce the degree.</b>' : '');
    else v = '<b class="warn">Out of memory.</b> You need about ' + fmtB(r.perGpu) + ' per GPU and have ' + fmtB(r.cap) + '. ' +
      'Options in order of how much they cost you: <b>quantise the weights</b> (' + (S.bits > 8 ? 'int8 halves the weight bytes for a small quality cost' : 'already quantised') + '), ' +
      '<b>cut the sequence length or concurrency</b> (the KV cache is ' + (r.kv / (r.weights + r.kv) * 100).toFixed(0) + '% of the non-activation memory here), ' +
      'or <b>raise the parallel degree</b> to at least ' + r.need + '.';
    if (r.note) v += ' <span class="dim">(' + r.note + ')</span>';
    $('#par-verdict').innerHTML = v;
  }

  $('#par-grid').innerHTML = C.parStrategies.map(s =>
    '<button class="rvcard" data-id="' + s.id + '"><span class="rv-ico">' + s.icon + '</span><b>' + s.n + '</b>' +
    '<span class="rv-flow">splits: ' + s.split + '</span>' +
    '<span class="ftcard-scales">comm: ' + s.comm.split(';')[0] + '</span></button>').join('');
  $$('#par-grid .rvcard').forEach(b => b.onclick = () => {
    const s = C.parStrategies.filter(x => x.id === b.dataset.id)[0];
    $$('#par-grid .rvcard').forEach(x => x.classList.toggle('active', x === b));
    $('#par-detail').innerHTML = '<h4>' + s.icon + ' ' + s.n + '</h4>' +
      '<div class="knob-lay"><span>plain English</span>' + s.lay + '</div>' +
      '<div class="knob-tech"><span>technically</span>' + s.what + '</div>' +
      '<div class="ftv-facts"><span><b>splits</b> ' + s.split + '</span><span><b>communication</b> ' + s.comm + '</span></div>' +
      '<div class="cc-good"><b>Good for</b> ' + s.good + '</div>' +
      '<div class="cc-bad"><b>Breaks when</b> ' + s.bad + '</div>';
    xp(2);
  });
  $('#par-detail').innerHTML = '<p class="dim">Click a strategy.</p>';
  cmpTable($('#par-compare'), C.parCompare);
  $('#par-compare-verdict').innerHTML = '<b>Verdict.</b> ' + C.parCompare.verdict;

  /* ---- PagedAttention ---- */
  let paged = true;
  const tog = $('#pa-toggle');
  tog.onclick = () => { paged = !paged; tog.classList.toggle('off', !paged); paPaint(); xp(2); };
  function paPaint() {
    const P = C.pagedSim;
    const alloc = P.reqs.map(l => paged ? Math.ceil(l / P.blockSize) * P.blockSize : P.maxTokens);
    const used = P.reqs.slice();
    const totalAlloc = alloc.reduce((a, b) => a + b, 0);
    const totalUsed = used.reduce((a, b) => a + b, 0);
    const waste = 1 - totalUsed / totalAlloc;
    const budget = 20480;                                  // fixed KV budget in tokens
    let fit = 0, run = 0;
    for (let i = 0; i < alloc.length; i++) { if (run + alloc[i] <= budget) { run += alloc[i]; fit++; } }
    const maxAlloc = Math.max.apply(null, alloc);
    $('#pa-viz').innerHTML = '<div class="pa-rows">' + P.reqs.map((l, i) =>
      '<div class="pa-row"><span class="pa-id">req ' + i + '</span>' +
      '<div class="pa-track"><i class="pa-alloc" style="width:' + (alloc[i] / maxAlloc * 100) + '%"></i>' +
      '<u class="pa-used" style="width:' + (used[i] / maxAlloc * 100) + '%"></u></div>' +
      '<span class="pa-n">' + used[i] + ' used / ' + alloc[i] + ' held</span></div>').join('') + '</div>';
    $('#pa-stats').innerHTML =
      '<div class="stat"><div class="stat-v">' + totalAlloc.toLocaleString() + '</div><div class="stat-k">KV slots held</div></div>' +
      '<div class="stat"><div class="stat-v">' + totalUsed.toLocaleString() + '</div><div class="stat-k">actually used</div></div>' +
      '<div class="stat"><div class="stat-v ' + (waste > 0.5 ? 'bad' : 'good') + '">' + (waste * 100).toFixed(0) + '%</div><div class="stat-k">wasted</div></div>' +
      '<div class="stat"><div class="stat-v ' + (fit >= 10 ? 'good' : 'bad') + '">' + fit + ' / 10</div><div class="stat-k">fit in a 20k budget</div></div>';
    $('#pa-note').innerHTML = paged
      ? '<b class="good">Bounded waste.</b> Every request holds at most 15 unused token slots &mdash; one block minus one. All ten requests fit in the same memory that previously held ' + fit + '. Bigger batches mean the GPU is doing arithmetic instead of waiting, which is the entire reason throughput improves.'
      : '<b class="bad">Reserving max_tokens.</b> A request that generates 40 tokens is holding 2,048 slots because the server cannot know in advance how long the answer will be. ' + (waste * 100).toFixed(0) + '% of your KV cache is holding nothing, your batch size is small for no reason, and your GPU is idle waiting for memory it is not using.';
  }
  $('#paged-note').innerHTML = C.pagedNote.map(p => '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>').join('');
  paPaint();
  read();
}

/* ============================================================
   Ch21 — lexical search
   ============================================================ */
function lexTok(s) { return (s.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || []); }
function lexIndex(corpus) {
  const post = {}, len = {};
  corpus.forEach(d => {
    const ts = lexTok(d.t);
    len[d.id] = ts.length;
    ts.forEach(t => {
      post[t] = post[t] || {};
      post[t][d.id] = (post[t][d.id] || 0) + 1;
    });
  });
  const avgdl = corpus.reduce((a, d) => a + len[d.id], 0) / corpus.length;
  return { post: post, len: len, avgdl: avgdl, N: corpus.length };
}
function bm25Score(idx, terms, docId) {
  const { k1, b } = C.bm25;
  let total = 0; const parts = [];
  terms.forEach(t => {
    const p = idx.post[t];
    if (!p) { parts.push({ t: t, df: 0, tf: 0, idf: 0, s: 0 }); return; }
    const df = Object.keys(p).length, tf = p[docId] || 0;
    const idf = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
    const dl = idx.len[docId];
    const s = tf ? idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / idx.avgdl)) : 0;
    parts.push({ t: t, df: df, tf: tf, idf: idf, s: s });
    total += s;
  });
  return { total: total, parts: parts };
}
function initLexical() {
  const chips = $('#lex-queries'); if (!chips) return;
  const idx = lexIndex(C.lexCorpus);
  let q = C.lexQueries[0].q, why = C.lexQueries[0].why;
  C.lexQueries.forEach((x, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), x.q);
    b.onclick = () => { q = x.q; why = x.why; $('#lex-custom').value = ''; paint(); xp(2); };
    chips.appendChild(b);
  });
  $('#lex-custom').oninput = e => {
    if (!e.target.value.trim()) return;
    q = e.target.value; why = 'Your own query. Terms that appear in no document contribute exactly zero &mdash; which is the whole weakness of lexical search in one observation.';
    $$('.chip', chips).forEach(c => c.classList.remove('active'));
    paint();
  };
  function paint() {
    $$('.chip', chips).forEach(c => c.classList.toggle('active', c.textContent === q));
    const terms = lexTok(q);
    $('#lex-postings').innerHTML = terms.map(t => {
      const p = idx.post[t];
      const df = p ? Object.keys(p).length : 0;
      const idf = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
      return '<div class="post' + (df ? '' : ' empty') + '">' +
        '<b>' + t + '</b>' +
        '<span class="post-df">df ' + df + ' &middot; idf ' + idf.toFixed(2) + '</span>' +
        '<div class="post-list">' + (df
          ? Object.keys(p).map(id => '<i>' + id + '<sub>&times;' + p[id] + '</sub></i>').join('')
          : '<i class="none">no postings &mdash; contributes 0</i>') + '</div></div>';
    }).join('') || '<p class="dim">Type a query.</p>';
    const scored = C.lexCorpus.map(d => {
      const r = bm25Score(idx, terms, d.id);
      return { d: d, total: r.total, parts: r.parts };
    }).sort((a, b) => b.total - a.total);
    const top = scored[0].total;
    $('#lex-results').innerHTML = scored.map((s, i) =>
      '<div class="lex-r' + (s.total > 0 ? '' : ' zero') + '">' +
      '<div class="lex-r-h"><span class="lex-rank">' + (i + 1) + '</span><b>' + s.d.id + '</b>' +
      miniBar(top ? s.total / top : 0) + '<span class="lex-s">' + s.total.toFixed(3) + '</span></div>' +
      '<div class="lex-t">' + s.d.t + '</div>' +
      (s.total > 0 ? '<div class="lex-math">' + s.parts.filter(p => p.s > 0).map(p =>
        p.t + ': idf ' + p.idf.toFixed(2) + ' &times; tf-sat ' + (p.s / p.idf).toFixed(2) + ' = ' + p.s.toFixed(3)).join(' &nbsp;+&nbsp; ') +
        ' &nbsp;&rarr;&nbsp; ' + s.total.toFixed(3) + '</div>' : '') +
      '</div>').join('');
    $('#lex-note').innerHTML = '<b>Why this query is here:</b> ' + why +
      (top === 0 ? ' <b class="bad">Every score is zero.</b> No amount of BM25 tuning fixes a query that shares no vocabulary with the corpus. That is the dense lane\'s job.' : '');
  }
  /* the formula, decoded */
  const PARTS = [
    { id: 'idf', label: 'IDF(t)', d: 'Inverse document frequency. A term in 1 of 8 documents is worth far more than a term in 7 of 8. This is why an error code like E-4055 dominates a query and "the" contributes nothing.',
      knob: 'Not tunable. It falls out of your corpus &mdash; which is why the same query ranks differently after you add documents.' },
    { id: 'tf', label: 'tf &times; (k1+1)', d: 'Raw term frequency in this document. More mentions means more relevant.',
      knob: 'k1 (default 1.2) controls saturation. Higher k1 means term frequency keeps mattering; k1 = 0 means one mention is the same as fifty.' },
    { id: 'sat', label: 'tf + k1&middot;(...)', d: 'The saturation denominator. This is what stops a document that repeats "refund" ninety times from beating a document that answers the question.',
      knob: 'This single term is the difference between BM25 and naive TF-IDF, and it is why BM25 won.' },
    { id: 'len', label: '1 - b + b&middot;(dl/avgdl)', d: 'Length normalisation. A 20-word document mentioning "refund" twice is more about refunds than a 2000-word document mentioning it twice.',
      knob: 'b (default 0.75). b = 0 disables length normalisation entirely; b = 1 normalises fully. Lower it for corpora where long documents are genuinely more informative.' }
  ];
  $('#bm25-formula').innerHTML = '<div class="bm-formula">' +
    '<span class="bm-sum">&sum;<sub>t &isin; q</sub></span>' +
    '<span class="bm-part" data-id="idf">IDF(t)</span><span class="bm-op">&times;</span>' +
    '<span class="bm-frac"><span class="bm-part" data-id="tf">tf<sub>t,d</sub> &middot; (k<sub>1</sub>+1)</span>' +
    '<span class="bm-bar"></span>' +
    '<span class="bm-part" data-id="sat">tf<sub>t,d</sub> + k<sub>1</sub> &middot;</span>' +
    '<span class="bm-part" data-id="len">(1 - b + b &middot; dl/avgdl)</span></span></div>' +
    '<div class="bm-consts">k<sub>1</sub> = ' + C.bm25.k1 + ' &nbsp;&middot;&nbsp; b = ' + C.bm25.b +
    ' &nbsp;&middot;&nbsp; avgdl = ' + idx.avgdl.toFixed(1) + ' terms &nbsp;&middot;&nbsp; N = ' + idx.N + ' documents</div>';
  $$('#bm25-formula .bm-part').forEach(p => {
    const show = () => {
      const x = PARTS.filter(a => a.id === p.dataset.id)[0];
      $$('#bm25-formula .bm-part').forEach(y => y.classList.toggle('sel', y.dataset.id === p.dataset.id));
      $('#bm25-detail').innerHTML = '<h4>' + x.label + '</h4><p>' + x.d + '</p>' +
        '<div class="cc-param"><b>the knob</b> ' + x.knob + '</div>';
    };
    p.onmouseenter = show; p.onclick = show;
  });
  $('#bm25-detail').innerHTML = '<p class="dim">Hover a piece of the formula.</p>';
  $('#lex-es').innerHTML = C.lexEsConcepts.map(e => '<dt>' + e[0] + '</dt><dd>' + e[1] + '</dd>').join('');
  cmpTable($('#lex-compare'), C.lexCompare);
  $('#lex-compare-verdict').innerHTML = '<b>Verdict.</b> ' + C.lexCompare.verdict;
  paint();
}

/* ============================================================
   Ch22 — big files, small RAM
   ============================================================ */
function initBigData() {
  const host = $('#big-calc'); if (!host) return;
  $('#stream-meanings').innerHTML = C.streamMeanings.map(s =>
    '<div class="pcard reveal"><div class="pcard-badge">' + s.where + '</div><h3>' + s.n + '</h3>' +
    '<p class="pcard-desc">' + s.d + '</p></div>').join('');

  let sel = 'chunks';
  host.innerHTML =
    '<label>file size on disk <span class="val" id="bv-file"></span><input type="range" id="bc-file" min="1" max="200" step="1" value="5"></label>' +
    '<label>machine RAM <span class="val" id="bv-ram"></span><input type="range" id="bc-ram" min="1" max="64" step="1" value="2"></label>';
  $('#bc-file').oninput = paint; $('#bc-ram').oninput = paint;
  function paint() {
    const file = +$('#bc-file').value, ram = +$('#bc-ram').value;
    $('#bv-file').textContent = file + ' GB';
    $('#bv-ram').textContent = ram + ' GB';
    const rows = C.bigStrategies.map(s => {
      const peak = file * s.peakMult + 0.35;                       // + interpreter baseline
      return { s: s, peak: peak, oom: peak > ram };
    });
    const maxPeak = Math.max.apply(null, rows.map(r => r.peak));
    $('#big-bars').innerHTML = '<div class="big-rows">' + rows.map(r =>
      '<button class="big-row' + (r.s.id === sel ? ' sel' : '') + (r.oom ? ' oom' : '') + '" data-id="' + r.s.id + '">' +
      '<span class="big-n">' + r.s.n + '</span>' +
      '<span class="big-track"><i style="width:' + Math.min(100, r.peak / maxPeak * 100) + '%"></i>' +
      '<u style="left:' + Math.min(100, ram / maxPeak * 100) + '%"></u></span>' +
      '<span class="big-v">' + (r.peak < 0.5 ? (r.peak * 1024).toFixed(0) + ' MB' : r.peak.toFixed(1) + ' GB') + '</span>' +
      '<span class="big-x">' + (r.oom ? 'OOM' : '&#10003;') + '</span></button>').join('') +
      '<div class="big-legend">the dashed line is your ' + ram + ' GB of RAM</div></div>';
    $$('#big-bars .big-row').forEach(b => b.onclick = () => { sel = b.dataset.id; paint(); xp(2); });
    const r = rows.filter(x => x.s.id === sel)[0];
    const base = rows.filter(x => x.s.id === 'naive')[0];
    $('#big-stats').innerHTML =
      '<div class="stat"><div class="stat-v ' + (r.oom ? 'bad' : 'good') + '">' + (r.peak < 0.5 ? (r.peak * 1024).toFixed(0) + ' MB' : r.peak.toFixed(1) + ' GB') + '</div><div class="stat-k">peak memory</div></div>' +
      '<div class="stat"><div class="stat-v">' + (base.peak / r.peak).toFixed(0) + 'x</div><div class="stat-k">less than loading it</div></div>' +
      '<div class="stat"><div class="stat-v">' + r.s.speed.toFixed(1) + 'x</div><div class="stat-k">relative speed</div></div>' +
      '<div class="stat"><div class="stat-v ' + (r.oom ? 'bad' : 'good') + '">' + (r.oom ? 'CRASHES' : 'SURVIVES') + '</div><div class="stat-k">on ' + ram + ' GB</div></div>';
    $('#big-note').innerHTML = '<div class="knob-lay"><span>plain English</span>' + r.s.lay + '</div>' +
      '<div class="knob-tech"><span>technically</span>' + r.s.tech + '</div>';
    $('#big-code').textContent = r.s.code;
  }

  /* ---- the aggregate that does not fit ---- */
  function cardPaint() {
    const n = +$('#card-r').value, keys = Math.pow(10, n);
    const ram = +$('#bc-ram').value;
    const bytesPerKey = 130;                                  // dict entry + str object + float, CPython
    const state = keys * bytesPerKey;
    const stateGB = state / 1073741824;
    const ok = stateGB < ram * 0.5;
    $('#card-v').textContent = keys.toLocaleString();
    $('#card-stats').innerHTML =
      '<div class="stat"><div class="stat-v">' + keys.toLocaleString() + '</div><div class="stat-k">distinct keys</div></div>' +
      '<div class="stat"><div class="stat-v">~' + bytesPerKey + ' B</div><div class="stat-k">per key in CPython</div></div>' +
      '<div class="stat"><div class="stat-v ' + (ok ? 'good' : 'bad') + '">' + (stateGB < 0.1 ? (state / 1048576).toFixed(0) + ' MB' : stateGB.toFixed(1) + ' GB') + '</div><div class="stat-k">aggregate size</div></div>' +
      '<div class="stat"><div class="stat-v ' + (ok ? 'good' : 'bad') + '">' + (ok ? 'stream it' : 'partition it') + '</div><div class="stat-k">correct answer</div></div>';
    $('#card-note').innerHTML = ok
      ? '<b class="good">Streaming is enough.</b> The file is unbounded but the state is not, so one pass with a dictionary finishes the job. This is the answer the interviewer is looking for.'
      : '<b class="warn">This is the follow-up question.</b> You streamed the file perfectly and the <span class="mono">defaultdict</span> is now ' + stateGB.toFixed(1) + ' GB. Streaming bounded the FILE, not the STATE. Hash each key into one of N spill files, then aggregate each file independently &mdash; external group-by, and it is fifteen lines.';
    $('#card-code').textContent = ok
      ? `# state fits: one pass, one dict\nfrom collections import defaultdict\ntotals = defaultdict(float)\nfor row in stream("events.csv"):\n    totals[row["key"]] += row["amount"]`
      : `# state does not fit: partition, then aggregate each part\nimport os, csv, hashlib\nfrom collections import defaultdict\n\nN = 64\nparts = [open(f"part-{i}.csv", "w", newline="") for i in range(N)]\nwriters = [csv.writer(p) for p in parts]\n\nfor row in stream("events.csv"):                 # pass 1: shuffle by key hash\n    h = int(hashlib.blake2b(row["key"].encode(), digest_size=4).hexdigest(), 16)\n    writers[h % N].writerow([row["key"], row["amount"]])\nfor p in parts: p.close()\n\nresult = {}\nfor i in range(N):                                # pass 2: each part fits in RAM\n    totals = defaultdict(float)                   # because equal keys share a part\n    with open(f"part-{i}.csv", newline="") as f:\n        for k, v in csv.reader(f):\n            totals[k] += float(v)\n    result.update(totals)\n    os.remove(f"part-{i}.csv")`;
  }
  $('#card-r').oninput = cardPaint;
  $('#bc-ram').addEventListener('input', cardPaint);
  $('#big-principles').innerHTML = C.bigPrinciples.map(p => '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>').join('');
  paint(); cardPaint();
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initPlain, initJargon, initBackground, initClarify, initMetrics, initLabels, initSkew, initLadder, initFunnel,
   initBudget, initCapacity, initEval, initLoop, initRagScale, initCascade, initKv, initDecode, initDesigns,
   initShip, initPatterns, initRedis, initAnn,
   initCaching, initParallel, initLexical, initBigData,
   initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
