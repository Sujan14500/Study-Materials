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

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initPlain, initJargon, initBackground, initClarify, initMetrics, initLabels, initSkew, initLadder, initFunnel,
   initBudget, initCapacity, initEval, initLoop, initRagScale, initCascade, initDesigns,
   initShip, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
