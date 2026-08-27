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
      ctx.fillStyle = 'rgba(255,214,160,.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20000) {
          ctx.strokeStyle = 'rgba(251,146,60,' + (0.15 * (1 - d2 / 20000)) + ')';
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
    const labels = ['🧠', '🔧', '👁️', '🧠', '✅'];
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 15);
      c.setAttribute('fill', 'rgba(14,12,22,.92)');
      c.setAttribute('stroke', ['#fb923c', '#fbbf24', '#22d3ee', '#fb923c', '#34d399'][i]);
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', pt.x); t.setAttribute('y', pt.y + 5);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '13');
      t.textContent = labels[i];
      g.appendChild(t);
    }
  }
}

/* ============================================================
   Ch1 — prompt / chain / agent?
   ============================================================ */
function initAgency() {
  const root = $('#agency'); if (!root) return;
  let score = 0, done = 0;

  C.agencyTasks.forEach((task) => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(task.t)));
    const opts = el('div', 'sortcard-opts');
    Object.keys(C.agencyLabels).forEach(k => {
      const L = C.agencyLabels[k];
      const b = el('button', 'sortopt', '<span class="so-ico">' + L.ico + '</span><span class="so-n">' + L.name + '</span><span class="so-h">' + L.hint + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach(x => x.disabled = true);
        const right = $$('.sortopt', opts)[Object.keys(C.agencyLabels).indexOf(task.a)];
        right.classList.add('correct');
        if (k !== task.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.agencyTasks.length) {
          root.appendChild(el('div', 'quiz-result',
            '<h3>' + score + ' / ' + C.agencyTasks.length + '</h3><p>' +
            (score >= 5 ? 'You already have the instinct most teams learn the expensive way: agency is a cost, not a feature.'
              : 'Rule of thumb: if <i>you</i> can write the steps down in advance, write them down. Agency is only worth its price when the next step genuinely depends on what the last one found.') +
            '</p>'));
          xp(10, 'Nice — the cheapest architecture is usually the right one');
        }
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + C.agencyLabels[task.a].name + '.</b> ' + task.why));
    root.appendChild(card);
  });
}

/* ============================================================
   Ch2 — the agent loop
   ============================================================ */
function initLoop() {
  const tasksBox = $('#loop-tasks'), trace = $('#loop-trace');
  if (!trace) return;
  let task = 0, step = 0, auto = null;

  C.loopTasks.forEach((t, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), t.label);
    b.onclick = () => { task = i; reset(); $$('.chip', tasksBox).forEach(c => c.classList.remove('active')); b.classList.add('active'); };
    tasksBox.appendChild(b);
  });

  function light(kind) {
    $$('.loop-node').forEach(n => n.classList.toggle('on', n.dataset.n === (kind === 'final' ? 'think' : kind)));
  }
  function next() {
    const steps = C.loopTasks[task].steps;
    if (step >= steps.length) { stop(); return; }
    const s = steps[step++];
    const K = C.loopKinds[s.k];
    const body = (s.k === 'act' || s.k === 'observe') ? '<code>' + esc(s.t) + '</code>' : esc(s.t);
    trace.appendChild(el('div', 'trace ' + s.k, '<span class="tk">' + K.name.toLowerCase() + '</span>' + body));
    trace.scrollTop = trace.scrollHeight;
    light(s.k);
    $('#loop-count').textContent = step + ' step' + (step === 1 ? '' : 's') + ' · ' + Math.round(step * 1.4 * 10) / 10 + 'k tokens resent';
    if (s.k === 'final') { stop(); xp(8, '+8 XP — loop exited on its stopping condition'); }
  }
  function stop() { if (auto) { clearInterval(auto); auto = null; $('#loop-auto').textContent = '▶ Run to completion'; } }
  function reset() {
    stop(); step = 0;
    trace.innerHTML = '<div class="trace" style="border-left-color:#6f7594;color:#6f7594">Task: <b>' + esc(C.loopTasks[task].label) + '</b> — press Next step.</div>';
    $$('.loop-node').forEach(n => n.classList.remove('on'));
    $('#loop-count').textContent = '0 steps';
  }
  $('#loop-step').onclick = () => { next(); xp(1); };
  $('#loop-auto').onclick = e => { if (auto) return stop(); e.target.textContent = '⏸ Pause'; auto = setInterval(next, 1100); };
  $('#loop-reset').onclick = reset;

  const legend = $('#loop-legend');
  if (legend) legend.innerHTML = Object.keys(C.loopKinds).map(k => {
    const K = C.loopKinds[k];
    return '<div class="lk" style="--c:' + K.color + '"><b>' + K.ico + ' ' + K.name + '</b><span>' + K.desc + '</span></div>';
  }).join('');

  reset();
}

/* ============================================================
   Ch3 — tools: pick the right one, see the call
   ============================================================ */
function initTools() {
  const box = $('#tool-list'); if (!box) return;
  const enabled = new Set(C.tools.map(t => t.id));

  box.innerHTML = C.tools.map(t =>
    '<div class="toolcard on risk-' + t.risk + '" data-id="' + t.id + '">' +
      '<div class="toolcard-h"><span class="tc-ico">' + t.ico + '</span><b class="mono">' + t.name + '</b>' +
      '<span class="pill ' + (t.risk === 'read' ? 'good' : t.risk === 'write' ? 'warn' : 'bad') + '">' + t.risk + '</span>' +
      '<span class="tc-sw">on</span></div>' +
      '<p>' + t.desc + '</p><pre class="code">' + esc(t.schema) + '</pre></div>').join('');

  $$('.toolcard', box).forEach(c => {
    c.onclick = () => {
      const id = c.dataset.id;
      if (enabled.has(id)) { enabled.delete(id); c.classList.remove('on'); $('.tc-sw', c).textContent = 'off'; }
      else { enabled.add(id); c.classList.add('on'); $('.tc-sw', c).textContent = 'on'; }
      render();
    };
  });

  const out = $('#tool-out'), qbox = $('#tool-queries');
  let q = 0;
  C.toolQueries.forEach((tq, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), tq.q);
    b.onclick = () => { q = i; $$('.chip', qbox).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
    qbox.appendChild(b);
  });

  function render() {
    const tq = C.toolQueries[q];
    const tool = tq.pick ? C.tools.find(t => t.id === tq.pick) : null;
    let html = '<div class="tstep"><span class="tk">user</span>' + esc(tq.q) + '</div>';
    if (!tool) {
      html += '<div class="tstep model"><span class="tk">model</span>No tool call — answering directly from what it already knows.</div>';
    } else if (!enabled.has(tool.id)) {
      html += '<div class="tstep bad"><span class="tk">model</span>The right tool for this is <b class="mono">' + tool.name +
        '</b>, but it is switched off. The model cannot invent a capability it was not given — it will either refuse, or guess and be wrong.</div>';
    } else {
      html += '<div class="tstep think"><span class="tk">model picks</span><b class="mono">' + tool.ico + ' ' + tool.name + '</b></div>' +
        '<div class="tstep act"><span class="tk">tool call</span><code>' + esc(tool.name + '(' + tq.args + ')') + '</code></div>' +
        '<div class="tstep obs"><span class="tk">your code</span>runs the function, returns the result into the transcript, and the loop continues.</div>';
    }
    html += '<div class="tnote">💡 ' + tq.note + '</div>';
    out.innerHTML = html;
  }
  render();
}

/* ============================================================
   Ch4 — ReAct vs the alternatives
   ============================================================ */
function initReact() {
  const tabs = $('#react-tabs'), out = $('#react-out');
  if (!out) return;
  const keys = Object.keys(C.reactRuns);
  let cur = 'naive';

  keys.forEach((k, i) => {
    const r = C.reactRuns[k];
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), r.label);
    b.onclick = () => { cur = k; $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(3); };
    tabs.appendChild(b);
  });

  const LBL = { think: 'thought', act: 'action', observe: 'observation', model: 'answer' };
  function render() {
    const r = C.reactRuns[cur];
    out.innerHTML =
      '<div class="react-badge ' + r.verdict + '">' + r.badge + '</div>' +
      r.steps.map((s, i) => {
        const body = s.role === 'act' || s.role === 'observe' ? '<code>' + esc(s.t) + '</code>' : esc(s.t);
        return '<div class="trace ' + (s.role === 'model' ? 'final' : s.role) + '" style="animation-delay:' + (i * 70) + 'ms">' +
          '<span class="tk">' + LBL[s.role] + '</span>' + body + '</div>';
      }).join('') +
      '<div class="verdict ' + r.verdict + '">' + r.note + '</div>';
  }
  render();
}

/* ============================================================
   Ch5 — planning
   ============================================================ */
function initPlan() {
  const gbox = $('#plan-goals'), out = $('#plan-out');
  if (!out) return;
  let g = 0;

  C.planGoals.forEach((goal, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), goal.goal);
    b.onclick = () => { g = i; $$('.chip', gbox).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
    gbox.appendChild(b);
  });

  function render() {
    const goal = C.planGoals[g];
    // group steps into waves: a step runs once all its deps have run
    const wave = [];
    goal.plan.forEach((s, i) => {
      wave[i] = s.dep.length ? Math.max(...s.dep.map(d => wave[d])) + 1 : 0;
    });
    const waves = [];
    wave.forEach((w, i) => { (waves[w] = waves[w] || []).push(i); });

    out.innerHTML = waves.map((ids, wi) =>
      '<div class="wave"><div class="wave-n">step ' + (wi + 1) + (ids.length > 1 ? ' · ' + ids.length + ' in parallel' : '') + '</div>' +
      '<div class="wave-row">' + ids.map(i =>
        '<div class="wave-box"><span class="wb-n">' + (i + 1) + '</span>' + esc(goal.plan[i].t) + '</div>').join('') + '</div></div>')
      .join('<div class="arch-sep">↓</div>') +
      '<div class="tnote">💡 ' + goal.note + '</div>' +
      '<div class="stat-row" style="margin-top:14px">' +
        '<div class="stat"><div class="stat-v">' + goal.plan.length + '</div><div class="stat-k">tasks</div></div>' +
        '<div class="stat"><div class="stat-v">' + waves.length + '</div><div class="stat-k">sequential waves</div></div>' +
        '<div class="stat"><div class="stat-v">' + Math.round((1 - waves.length / goal.plan.length) * 100) + '%</div><div class="stat-k">wall-clock saved by parallelism</div></div>' +
      '</div>';
  }
  render();

  const cmp = $('#plan-compare');
  if (cmp) cmp.innerHTML = C.planStyles.map(s =>
    '<div class="pcard"><div class="pcard-badge">' + s.ico + '</div><h3>' + s.name + '</h3>' +
    '<div class="deflist"><b>Strengths</b><ul>' + s.pros.map(p => '<li>' + p + '</li>').join('') + '</ul>' +
    '<b>Costs</b><ul>' + s.cons.map(p => '<li>' + p + '</li>').join('') + '</ul></div>' +
    '<div class="pcard-foot"><span class="pill good">Use for: ' + s.use + '</span></div></div>').join('');
}

/* ============================================================
   Ch6 — the four memories
   ============================================================ */
function initMemory() {
  const kinds = $('#mem-kinds');
  if (kinds) kinds.innerHTML = C.memKinds.map(m =>
    '<div class="memcard" style="--c:' + m.color + '"><div class="mem-h">' + m.ico + ' <b>' + m.name + '</b><span class="pill">' + m.span + '</span></div>' +
    '<p>' + m.desc + '</p><div class="mem-watch">⚠️ ' + m.watch + '</div></div>').join('');

  const stream = $('#mem-stream'), stores = $('#mem-stores');
  if (stream) {
    let i = 0;
    const bank = {};
    C.memKinds.forEach(m => bank[m.k] = []);

    function paintStores() {
      stores.innerHTML = C.memKinds.map(m =>
        '<div class="memstore" style="--c:' + m.color + '"><div class="ms-h">' + m.ico + ' ' + m.name +
        '<span class="ms-n">' + bank[m.k].length + '</span></div>' +
        (bank[m.k].length ? bank[m.k].map(f => '<div class="ms-item">' + esc(f) + '</div>').join('')
          : '<div class="ms-empty">empty</div>') + '</div>').join('');
    }
    function next() {
      if (i >= C.memConvo.length) return;
      const m = C.memConvo[i++];
      stream.appendChild(el('div', 'trace ' + (m.who === 'user' ? 'think' : m.who === 'tool' ? 'observe' : 'act'),
        '<span class="tk">' + m.who + '</span>' + esc(m.t) +
        (m.fact ? '<div class="mem-tag">→ ' + m.store.map(s => '<span class="mtag">' + s + '</span>').join('') + ' <i>' + esc(m.fact) + '</i></div>' : '')));
      stream.scrollTop = stream.scrollHeight;
      if (m.fact) m.store.forEach(s => { if (!bank[s].includes(m.fact)) bank[s].push(m.fact); });
      paintStores();
      if (i === C.memConvo.length) xp(6, 'Notice how little of the transcript deserves to be persisted');
    }
    $('#mem-next').onclick = () => { next(); xp(1); };
    $('#mem-reset').onclick = () => { i = 0; stream.innerHTML = ''; C.memKinds.forEach(m => bank[m.k] = []); paintStores(); };
    paintStores();
  }

  const qz = $('#mem-quiz');
  if (qz) C.memQuestions.forEach(q => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(q.q)));
    const opts = el('div', 'sortcard-opts mem4');
    C.memKinds.forEach(m => {
      const b = el('button', 'sortopt', '<span class="so-ico">' + m.ico + '</span><span class="so-n">' + m.name.replace(' memory', '') + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1';
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (C.memKinds[xi].k === q.a) x.classList.add('correct'); });
        if (m.k !== q.a) b.classList.add('incorrect'); else xp(4);
        $('.sortcard-why', card).classList.add('show');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', q.e));
    qz.appendChild(card);
  });
}

/* ============================================================
   Ch7 — reflection
   ============================================================ */
function initReflect() {
  const out = $('#reflect-out'); if (!out) return;
  let r = 0;

  function render() {
    const round = C.reflectRounds[r];
    const prev = r > 0 ? C.reflectRounds[r - 1] : null;
    out.innerHTML =
      '<div class="ref-head"><b>' + round.label + '</b>' +
      '<div class="score-wrap"><div class="score-bar"><div class="score-fill" style="width:' + round.score + '%"></div></div>' +
      '<span class="mono">' + round.score + '/100' + (prev ? ' <i class="' + (round.score - prev.score >= 15 ? 'up' : 'flat') + '">+' + (round.score - prev.score) + '</i>' : '') + '</span></div></div>' +
      (round.critique ? '<div class="critique"><b>🔎 Critic said:</b><ul>' + round.critique.map(c => '<li>' + c + '</li>').join('') + '</ul></div>' : '') +
      '<div class="draft">' + esc(round.draft).replace(/\n/g, '<br>') + '</div>';
    $('#reflect-next').disabled = r >= C.reflectRounds.length - 1;
    $('#reflect-next').textContent = r >= C.reflectRounds.length - 1 ? 'No more gains' : '🔁 Critique &amp; revise';
  }
  $('#reflect-next').onclick = () => {
    if (r >= C.reflectRounds.length - 1) return;
    r++; render(); xp(3);
    if (r === C.reflectRounds.length - 1) xp(6, 'Round 3 gained 3 points for a full extra model call — that is where you stop');
  };
  $('#reflect-reset').onclick = () => { r = 0; render(); };
  render();
}

/* ============================================================
   Ch8 — multi-agent topologies
   ============================================================ */
function initTopo() {
  const tabs = $('#topo-tabs'), svg = $('#topo-svg'), info = $('#topo-info');
  if (!svg) return;
  let cur = 0;

  C.topologies.forEach((t, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), t.ico + ' ' + t.name);
    b.onclick = () => { cur = i; $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
    tabs.appendChild(b);
  });

  const NS = 'http://www.w3.org/2000/svg';
  function render() {
    const t = C.topologies[cur];
    svg.innerHTML = '';
    const pos = {};
    t.nodes.forEach(n => pos[n.id] = n);

    (t.edges || []).forEach((e, i) => {
      const a = pos[e[0]], b = pos[e[1]];
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
      l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
      l.setAttribute('stroke', 'rgba(255,255,255,.22)'); l.setAttribute('stroke-width', '.6');
      svg.appendChild(l);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '1.4'); dot.setAttribute('fill', '#fb923c');
      const an = document.createElementNS(NS, 'animateMotion');
      an.setAttribute('dur', '2.2s'); an.setAttribute('begin', (i * 0.35) + 's');
      an.setAttribute('repeatCount', 'indefinite');
      an.setAttribute('path', 'M' + a.x + ',' + a.y + ' L' + b.x + ',' + b.y);
      dot.appendChild(an); svg.appendChild(dot);
    });

    t.nodes.forEach(n => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', n.x); c.setAttribute('cy', n.y); c.setAttribute('r', '9');
      c.setAttribute('fill', 'rgba(16,14,26,.95)');
      c.setAttribute('stroke', n.id === 'S' ? '#fbbf24' : '#fb923c'); c.setAttribute('stroke-width', '1');
      svg.appendChild(c);
      const tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', n.x); tx.setAttribute('y', n.y + 1.6);
      tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('font-size', '3.4');
      tx.setAttribute('fill', '#e8eaf3');
      tx.textContent = n.label;
      svg.appendChild(tx);
    });

    if (t.tools) {
      for (let i = 0; i < t.tools; i++) {
        const ang = (i / t.tools) * Math.PI * 2;
        const x = 50 + Math.cos(ang) * 32, y = 50 + Math.sin(ang) * 32;
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', 50); l.setAttribute('y1', 50); l.setAttribute('x2', x); l.setAttribute('y2', y);
        l.setAttribute('stroke', 'rgba(255,255,255,.18)'); l.setAttribute('stroke-width', '.5');
        svg.insertBefore(l, svg.firstChild);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x - 4); r.setAttribute('y', y - 3); r.setAttribute('width', 8); r.setAttribute('height', 6);
        r.setAttribute('rx', 1.5); r.setAttribute('fill', 'rgba(251,191,36,.15)');
        r.setAttribute('stroke', '#fbbf24'); r.setAttribute('stroke-width', '.5');
        svg.appendChild(r);
      }
    }

    info.innerHTML =
      '<div class="stat-row">' +
        '<div class="stat"><div class="stat-v">' + t.calls + '</div><div class="stat-k">model calls / task</div></div>' +
        '<div class="stat"><div class="stat-v">' + t.latency + 's</div><div class="stat-k">typical latency</div></div>' +
        '<div class="stat"><div class="stat-v">' + t.cost.toFixed(1) + '×</div><div class="stat-k">relative cost</div></div>' +
        '<div class="stat"><div class="stat-v">' + Math.round(t.reliability * 100) + '%</div><div class="stat-k">end-to-end success</div></div>' +
      '</div>' +
      '<div class="two-up" style="margin-top:14px">' +
        '<div class="callout"><div class="callout-ico">✅</div><div><b>Buys you</b><p>' + t.good + '</p></div></div>' +
        '<div class="callout warn"><div class="callout-ico">⚠️</div><div><b>Costs you</b><p>' + t.bad + '</p></div></div>' +
      '</div>' +
      '<div class="tnote">🎯 <b>Reach for it when:</b> ' + t.use + '</div>';
  }
  render();
  window.addEventListener('chapterchange', e => { if (e.detail === 'multi') render(); });
}

/* ============================================================
   Ch9 — guardrails and approval gates
   ============================================================ */
function initGuard() {
  const root = $('#guard'); if (!root) return;
  let strict = true, correct = 0, done = 0;

  const VERD = {
    auto:  { n: 'Run it', ico: '⚡', cls: 'good' },
    ask:   { n: 'Ask a human', ico: '🖐️', cls: 'warn' },
    block: { n: 'Block in code', ico: '⛔', cls: 'bad' }
  };

  C.guardActions.forEach(a => {
    const card = el('div', 'guardcard risk-' + a.risk);
    card.innerHTML = '<div class="gc-h"><b>' + esc(a.t) + '</b>' +
      '<span class="mono gc-tool">' + a.tool + '</span>' +
      '<span class="pill ' + (a.reversible ? 'good' : 'bad') + '">' + (a.reversible ? 'reversible' : 'irreversible') + '</span></div>';
    const opts = el('div', 'gc-opts');
    Object.keys(VERD).forEach(k => {
      const b = el('button', 'sortopt', '<span class="so-ico">' + VERD[k].ico + '</span><span class="so-n">' + VERD[k].n + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (Object.keys(VERD)[xi] === a.verdict) x.classList.add('correct'); });
        if (k !== a.verdict) b.classList.add('incorrect'); else { correct++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.guardActions.length) xp(10, correct >= 5 ? 'You gate the right things — and only those' : 'Gate what is irreversible; block what should be impossible');
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + VERD[a.verdict].n + '.</b> ' + a.why));
    root.appendChild(card);
  });

  const lay = $('#guard-layers');
  if (lay) lay.innerHTML = C.guardLayers.map((l, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + l[0] + '</b><p>' + l[1] + '</p></div></div>').join('');
}

/* ============================================================
   Ch10 — reliability compounding
   ============================================================ */
function initReliability() {
  const out = $('#rel-out'); if (!out) return;
  const acc = $('#rel-acc'), steps = $('#rel-steps'), retry = $('#rel-retry'), verify = $('#rel-verify');

  function render() {
    const p0 = +acc.value / 100;
    const n = +steps.value;
    // a retry rescues an independent transient failure ~60% of the time
    const p1 = retry.checked ? p0 + (1 - p0) * 0.6 : p0;
    // verification does not raise per-step success, it converts silent wrongs into caught ones
    const perStep = p1;
    const success = Math.pow(perStep, n);
    const caught = verify.checked ? (1 - success) * 0.7 : 0;
    const silent = 1 - success - caught;

    $('#rel-acc-v').textContent = (p0 * 100).toFixed(0) + '%';
    $('#rel-steps-v').textContent = n;

    const bars = [];
    for (let i = 1; i <= n; i++) bars.push(Math.pow(perStep, i));

    out.innerHTML =
      '<div class="stat-row">' +
        '<div class="stat"><div class="stat-v" style="color:' + (success > .8 ? '#34d399' : success > .5 ? '#fbbf24' : '#fb7185') + '">' + (success * 100).toFixed(1) + '%</div><div class="stat-k">runs that fully succeed</div></div>' +
        '<div class="stat"><div class="stat-v" style="color:#22d3ee">' + (caught * 100).toFixed(1) + '%</div><div class="stat-k">failures caught &amp; retried</div></div>' +
        '<div class="stat"><div class="stat-v" style="color:#fb7185">' + (silent * 100).toFixed(1) + '%</div><div class="stat-k">silently wrong 😱</div></div>' +
        '<div class="stat"><div class="stat-v">' + (perStep * 100).toFixed(1) + '%</div><div class="stat-k">effective per-step</div></div>' +
      '</div>' +
      '<div class="relchart">' + bars.map((b, i) =>
        '<div class="relbar" title="after step ' + (i + 1) + ': ' + (b * 100).toFixed(1) + '%">' +
        '<div class="relbar-fill" style="height:' + (b * 100) + '%;background:' + (b > .8 ? '#34d399' : b > .5 ? '#fbbf24' : '#fb7185') + '"></div>' +
        '<span>' + (i + 1) + '</span></div>').join('') + '</div>' +
      '<p class="panel-sub">Cumulative probability the run is still on track after each step. The curve is exponential decay — it never looks alarming at step 3 and always does by step 15.</p>';
  }
  [acc, steps, retry, verify].forEach(i => i.oninput = render);
  render();

  const pre = $('#rel-presets');
  if (pre) C.relPresets.forEach(p => {
    const b = el('button', 'chip', p.name);
    b.onclick = () => {
      acc.value = p.acc * 100; steps.value = p.steps;
      retry.checked = p.retry; verify.checked = p.verify;
      render(); xp(2);
    };
    pre.appendChild(b);
  });

  const les = $('#rel-lessons');
  if (les) les.innerHTML = C.relLessons.map(l =>
    '<div class="gterm"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>').join('');
}

/* ============================================================
   Ch11 — evaluating agents
   ============================================================ */
function initEval() {
  const root = $('#eval-runs'); if (!root) return;

  root.innerHTML = C.evalRuns.map(r =>
    '<div class="evalrun">' +
      '<div class="er-h"><span class="mono">' + r.id + '</span><span class="er-task">' + esc(r.task) + '</span>' +
        '<span class="pill ' + (r.outcome === 'pass' ? 'good' : 'bad') + '">outcome ' + r.outcome + '</span>' +
        '<span class="pill ' + (r.trajectory === 'pass' ? 'good' : 'bad') + '">trajectory ' + r.trajectory + '</span>' +
        '<span class="pill">' + r.steps + ' steps · ' + r.cost + '</span></div>' +
      '<div class="er-trace">' + r.trace.map(t => '<div class="trace act"><code>' + esc(t) + '</code></div>').join('') + '</div>' +
      '<button class="btn btn-ghost er-btn">Why this matters</button>' +
      '<div class="sortcard-why">' + r.note + '</div>' +
    '</div>').join('');

  $$('.er-btn', root).forEach((b, i) => b.onclick = () => {
    $$('.sortcard-why', root)[i].classList.toggle('show');
    xp(2);
  });

  const m = $('#eval-metrics');
  if (m) m.innerHTML = C.evalMetrics.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
}

/* ============================================================
   Ch12 — architecture, cost, checklist
   ============================================================ */
function initShip() {
  const arch = $('#arch');
  if (arch) arch.innerHTML = C.arch.map((r, i) =>
    '<div class="abox' + (i === 1 ? ' hl' : '') + '"><b>' + r[0] + '</b><small>' + r[1] + '</small></div>').join('');

  const calc = $('#calc');
  if (calc) {
    const fields = [
      ['runs', 'agent runs / day', 800],
      ['steps', 'avg steps / run', 7],
      ['tin', 'prompt tokens at step 1', 1500],
      ['tout', 'output tokens / step', 250],
      ['pin', '$ per 1M input', 3],
      ['pout', '$ per 1M output', 15],
      ['cache', 'cached input billed at (%)', 10]
    ];
    calc.innerHTML = fields.map(f =>
      '<div class="calc-f"><label for="c-' + f[0] + '">' + f[1] + '</label><input id="c-' + f[0] + '" type="number" min="0" value="' + f[2] + '"></div>')
      .join('') + '<div class="calc-out" id="calc-out"></div>';

    function run() {
      const v = id => Math.max(0, +($('#c-' + id).value || 0));
      const runs = v('runs'), n = v('steps'), tin = v('tin'), tout = v('tout');
      // Step k resends step k-1's prompt verbatim and appends one observation, so almost
      // all of it is a prefix the provider has already processed. That is what makes an
      // agent loop the best-shaped workload there is for prompt caching.
      const disc = clamp(v('cache'), 0, 100) / 100;
      let inTok = 0, billedTok = 0;
      for (let k = 0; k < n; k++) {
        const stepIn = tin + k * (tout + 200);
        // at step 0 only the system prompt and tool schemas are a known prefix
        const cached = k === 0 ? tin * 0.8 : tin + (k - 1) * (tout + 200);
        inTok += stepIn;
        billedTok += (stepIn - cached) + cached * disc;
      }
      const outTok = n * tout;
      const perRun = inTok / 1e6 * v('pin') + outTok / 1e6 * v('pout');
      const cachedRun = billedTok / 1e6 * v('pin') + outTok / 1e6 * v('pout');
      const day = perRun * runs;
      const oneStep = (tin / 1e6 * v('pin') + tout / 1e6 * v('pout'));
      $('#calc-out').innerHTML = [
        ['input tokens / run', (inTok / 1000).toFixed(1) + 'k'],
        ['cost / run', '$' + perRun.toFixed(4)],
        ['cost / day', '$' + day.toFixed(2)],
        ['cost / month', '$' + (day * 30).toFixed(0)],
        ['vs. a single call', (perRun / (oneStep || 1)).toFixed(1) + '× more'],
        ['with prompt caching', '$' + (cachedRun * runs * 30).toFixed(0) + '/mo']
      ].map(c => '<div class="stat"><div class="stat-v">' + c[1] + '</div><div class="stat-k">' + c[0] + '</div></div>').join('') +
      '<p class="panel-sub" style="grid-column:1/-1;margin:8px 0 0">Cost grows <b>quadratically</b> with step count, because every turn resends the whole transcript. Doubling steps roughly quadruples the bill. This is the single strongest argument for shorter trajectories — and for summarising or pruning the transcript once it gets long. Prompt caching is the other half: at ' + Math.round(disc * 100) + '% billing on cached input it takes the month down to <b>$' + (cachedRun * runs * 30).toFixed(0) + '</b>, because every step after the first resends a prefix the provider has already processed. It bends the curve; it does not straighten it, and it does nothing at all for how fast the answer comes out.</p>';
    }
    $$('input', calc).forEach(i => i.oninput = run);
    run();
  }

  const rows = $('#cost-rows');
  if (rows) rows.innerHTML = C.costRows.map(r =>
    '<div class="gterm"><b>' + r.label + '</b><span>' + r.note + '</span></div>').join('');

  const cl = $('#checklist');
  if (cl) {
    const KEY = 'agenticflow.checklist';
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
    const msg = pct === 100 ? 'Perfect. You could design and review an agent system tomorrow.'
      : pct >= 75 ? 'Strong — you have the architecture instincts and the failure modes.'
      : pct >= 50 ? 'Good start. Revisit the chapters behind the misses; the reliability maths especially.'
      : 'Worth another pass. Agents are mostly about knowing when *not* to use one.';
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
   Ch13 — MCP: the session, frame by frame, and the N×M argument
   ============================================================ */
function initMcp() {
  const trace = $('#mcp-trace');
  if (!trace) return;

  /* ---- which pipeline stage each frame belongs to ---- */
  const STAGE = [0, 0, 0, 1, 1, 2, 2, 2, 2, 3, 3];
  let step = 0, auto = null;

  function light(s) {
    $$('#mcp-pipe .rp').forEach((n, i) => n.classList.toggle('lit', i === s));
  }

  function next() {
    if (step >= C.mcpFrames.length) { stop(); return; }
    const f = C.mcpFrames[step];
    light(STAGE[step]);
    step++;

    const card = el('div', 'mcp-frame dir-' + f.dir,
      '<div class="mcp-fh"><span class="tk">' + f.tag + '</span>' +
      '<b class="mono">' + f.m + '</b></div>' +
      '<pre class="code">' + esc(f.j) + '</pre>' +
      '<div class="mcp-fn">' + f.n + '</div>');
    trace.appendChild(card);
    trace.scrollTop = trace.scrollHeight;

    if (step === C.mcpFrames.length) {
      xp(10, '+10 XP — you have read a whole MCP session');
      stop();
    }
  }

  function stop() {
    if (auto) { clearInterval(auto); auto = null; $('#mcp-auto').textContent = '▶ Play the session'; }
  }
  function reset() {
    stop(); step = 0; light(-1);
    trace.innerHTML = '<div class="mcp-frame dir-idle"><div class="mcp-fn">' +
      'Eleven frames: handshake, discovery, one tool call, one live change. ' +
      'JSON-RPC 2.0 over stdio or Streamable HTTP — nothing here is model-specific.' +
      '</div></div>';
  }

  $('#mcp-step').onclick = () => { next(); xp(1); };
  $('#mcp-auto').onclick = e => {
    if (auto) return stop();
    e.target.textContent = '⏸ Pause';
    auto = setInterval(next, 2600);
  };
  $('#mcp-reset').onclick = reset;
  reset();

  /* ---- the three primitives ---- */
  $('#mcp-prims').innerHTML = C.mcpPrimitives.map(p =>
    '<div class="tech"><h5>' + p.h + ' <span class="pill">' + p.who + '</span></h5>' +
    '<p>' + p.p + '</p><pre class="code">' + esc(p.c) + '</pre></div>').join('');

  /* ---- code tabs ---- */
  const row = $('#mcp-code-tabs'), blk = $('#mcp-code');
  C.mcpCode.forEach((it, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), it.t);
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); blk.textContent = it.code;
    };
    row.appendChild(b);
  });
  blk.textContent = C.mcpCode[0].code;

  /* ---- N×M: every client wired to every tool, by hand ---- */
  let hosts = 3, servers = 4;
  const grid = $('#mcp-matrix'), counts = $('#mcp-counts');

  function paintWire() {
    let cells = '';
    for (let h = 0; h < hosts; h++) {
      for (let s = 0; s < servers; s++) cells += '<span class="mcp-dot"></span>';
    }
    grid.style.gridTemplateColumns = 'repeat(' + servers + ', 1fr)';
    grid.innerHTML = cells;

    const bespoke = hosts * servers, viaMcp = hosts + servers;
    counts.innerHTML =
      '<div class="stat"><div class="stat-v">' + bespoke + '</div>' +
        '<div class="stat-k">bespoke integrations</div></div>' +
      '<div class="stat"><div class="stat-v">' + viaMcp + '</div>' +
        '<div class="stat-k">with MCP · ' + hosts + ' clients + ' + servers + ' servers</div></div>' +
      '<div class="stat"><div class="stat-v">' + (bespoke - viaMcp) + '</div>' +
        '<div class="stat-k">integrations you did not write</div></div>';
    $('#mcp-wire-note').innerHTML = bespoke <= viaMcp
      ? 'At this size MCP is pure overhead — <b>two clients and two tools do not need a protocol.</b> Add a few and look again.'
      : 'Every dot is a bespoke integration someone maintains, re-tests on every API change, and re-implements for the next client. ' +
        'MCP turns the grid into <b>' + hosts + ' + ' + servers + '</b> — each side implements the protocol once.';
  }

  $('#mcp-h-plus').onclick  = () => { hosts = clamp(hosts + 1, 1, 8); paintWire(); };
  $('#mcp-h-minus').onclick = () => { hosts = clamp(hosts - 1, 1, 8); paintWire(); };
  $('#mcp-s-plus').onclick  = () => { servers = clamp(servers + 1, 1, 10); paintWire(); xp(1); };
  $('#mcp-s-minus').onclick = () => { servers = clamp(servers - 1, 1, 10); paintWire(); };
  paintWire();
}


/* ============================================================
   Ch4 — the naive loop and the guards that fix it.
   The simulation is deterministic: same guards + same seed give
   the same run, every time. test.js re-derives it independently.
   ============================================================ */
const NL = (function () {
  const M = C.nlModel;
  /* a plain LCG. Math.random() would make the demo unreproducible and
     the test flaky, and neither is worth the convenience. */
  function lcg(seed) {
    let s = (seed * 1103515245 + 12345) >>> 0;
    return () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  }
  /* one run. `g` is the guard set; every guard removes one specific
     failure mode and nothing else. */
  function sim(g, seed) {
    const rnd = lcg(seed);
    const cap = g.budget ? M.budgetSteps : M.hardCap;
    let ctx = M.ctx0, tokens = 0, prog = 0, step = 0;
    const trace = [];
    while (step < cap) {
      step++;
      tokens += ctx;                       // the whole transcript, resent
      const hp = Math.min(M.hpMax, ctx * M.hpPerToken);
      const tc = g.scope ? M.tcScoped : M.tcAll;
      const sp = g.state ? 0 : M.statePenalty;
      const p = Math.min(0.95, Math.max(0.05, M.p0 - hp - tc - sp));
      const ok = rnd() < p;
      if (ok) prog++; else prog = Math.max(0, prog - 1);
      ctx += M.obsTokens + (ok ? 0 : M.wrongTokens);
      if (g.compact) ctx = Math.min(ctx, M.ctxCap);
      trace.push({ step: step, ok: ok, p: p, ctx: ctx, tokens: tokens, prog: prog, hp: hp });

      if (g.verify) {
        if (prog >= M.need) return { o: 'done', step: step, tokens: tokens, ctx: ctx, trace: trace };
      } else if (rnd() < M.pDeclare) {
        const o = prog >= M.need ? 'done' : 'shipped';
        trace[trace.length - 1].declared = true;
        return { o: o, step: step, tokens: tokens, ctx: ctx, trace: trace };
      }
    }
    return { o: g.budget ? 'escalated' : 'runaway', step: step, tokens: tokens, ctx: ctx, trace: trace };
  }
  /* 400 runs, so the headline number is a rate and not an anecdote */
  function agg(g) {
    const t = { done: 0, shipped: 0, escalated: 0, runaway: 0 };
    let tokens = 0;
    for (let s = 1; s <= 400; s++) { const r = sim(g, s); t[r.o]++; tokens += r.tokens; }
    return { t: t, tokens: tokens / 400,
             perDone: t.done ? tokens / t.done : Infinity };
  }
  return { sim: sim, agg: agg };
})();

function initNaiveLoop() {
  const svg = $('#nl-svg'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const g = { verify: false, scope: false, compact: false, state: false, budget: false };
  let seed = 7, timers = [];

  const byId = {};
  C.nlNodes.forEach(n => { byId[n.id] = n; });
  const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;

  /* ---- edges first so nodes paint over them ---- */
  C.nlEdges.forEach(e => {
    const a = byId[e.a], b = byId[e.b];
    const p = document.createElementNS(NS, 'path');
    let d;
    if (a.y === b.y) {                        // straight across
      const dir = b.x > a.x ? 1 : -1;
      d = 'M' + (dir > 0 ? a.x + a.w : a.x) + ',' + cy(a) + ' H' + (dir > 0 ? b.x : b.x + b.w);
    } else if (a.x === b.x) {                 // straight down
      d = 'M' + cx(a) + ',' + (b.y > a.y ? a.y + a.h : a.y) + ' V' + (b.y > a.y ? b.y : b.y + b.h);
    } else {                                  // elbow
      d = 'M' + cx(a) + ',' + (b.y > a.y ? a.y + a.h : a.y) +
          ' V' + (b.y > a.y ? b.y - 14 : b.y + b.h + 14) +
          ' H' + cx(b) + ' V' + (b.y > a.y ? b.y : b.y + b.h);
    }
    p.setAttribute('d', d);
    p.setAttribute('class', 'nl-edge' + (e.l === 'no' || byId[e.b].bad ? ' bad' : ''));
    p.dataset.e = e.a + '>' + e.b;
    svg.appendChild(p);
    if (e.l) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (cx(a) + cx(b)) / 2); t.setAttribute('y', cy(a) - 8);
      t.setAttribute('class', 'nl-elab'); t.textContent = e.l;
      if (e.l === 'no') { t.setAttribute('x', cx(a) + 12); t.setAttribute('y', a.y + a.h + 20); }
      svg.appendChild(t);
    }
  });

  C.nlNodes.forEach(n => {
    const grp = document.createElementNS(NS, 'g');
    grp.setAttribute('class', 'nl-node' + (n.bad ? ' bad' : ''));
    grp.dataset.n = n.id;
    const r = document.createElementNS(NS, n.dia ? 'polygon' : 'rect');
    if (n.dia) r.setAttribute('points',
      [cx(n) + ',' + n.y, (n.x + n.w) + ',' + cy(n), cx(n) + ',' + (n.y + n.h), n.x + ',' + cy(n)].join(' '));
    else { r.setAttribute('x', n.x); r.setAttribute('y', n.y);
           r.setAttribute('width', n.w); r.setAttribute('height', n.h); r.setAttribute('rx', 10); }
    grp.appendChild(r);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', cx(n)); t.setAttribute('y', cy(n) + 4);
    t.textContent = n.t;
    grp.appendChild(t);
    svg.appendChild(grp);
  });
  const label = id => $('.nl-node[data-n="' + id + '"] text', svg);

  /* ---- guard toggles ---- */
  $('#nl-guards').innerHTML = C.nlGuards.map(gu =>
    '<button class="toggle" data-g="' + gu.id + '"><span class="toggle-box">&#10003;</span>' +
    '<div><b>' + gu.n + '</b><small>' + gu.s + '</small></div></button>').join('');
  $$('#nl-guards .toggle').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.g;
      g[id] = !g[id];
      b.classList.toggle('on', g[id]);
      const gu = C.nlGuards.filter(x => x.id === id)[0];
      $('#nl-guard-note').innerHTML = '<b>' + gu.n + '</b> — ' + gu.d;
      relabel(); paintDist(); xp(1);
    };
  });
  $('#nl-all').onclick = () => {
    const turnOn = !C.nlGuards.every(gu => g[gu.id]);
    C.nlGuards.forEach(gu => { g[gu.id] = turnOn; });
    $$('#nl-guards .toggle').forEach(b => b.classList.toggle('on', turnOn));
    $('#nl-guard-note').innerHTML = turnOn
      ? '<b>All five on.</b> This is the loop you actually ship. Run it and compare the outcome bar with the naive one.'
      : '<b>All five off.</b> The loop from the top of the chapter: no cap, no ground truth, no context control.';
    relabel(); paintDist();
  };

  /* the flowchart itself changes when you turn a guard on — that is the
     point, the guards are edits to the graph, not settings on a model */
  function relabel() {
    label('check').textContent = g.verify ? 'Tests pass?' : 'Looks good?';
    label('fix').textContent = g.scope ? 'Targeted fix' : 'Try a random fix';
    label('grow').textContent = g.compact ? 'Context compacted' : 'Context grows';
    label('hall').textContent = g.state ? 'State stays true' : 'Hallucinations up';
    label('ship').textContent = g.budget ? 'Escalate to human' : 'Hidden bugs ship';
    ['check', 'fix', 'grow', 'hall', 'ship'].forEach((id, i) => {
      const key = ['verify', 'scope', 'compact', 'state', 'budget'][i];
      $('.nl-node[data-n="' + id + '"]', svg).classList.toggle('fixed', !!g[key]);
    });
  }

  /* ---- one animated run ---- */
  function walk() {
    timers.forEach(clearTimeout); timers = [];
    const r = NL.sim(g, seed++);
    $('#nl-trace').innerHTML = '';
    $('#nl-stats').innerHTML = '';
    r.trace.forEach((t, i) => {
      const seq = t.ok || t.declared ? ['gen', 'check'] : ['gen', 'check', 'fix', 'grow', 'hall', 'worse'];
      seq.forEach((id, j) => timers.push(setTimeout(() => {
        $$('.nl-node', svg).forEach(n => n.classList.remove('lit'));
        $('.nl-node[data-n="' + id + '"]', svg).classList.add('lit');
      }, i * 460 + j * 62)));

      timers.push(setTimeout(() => {
        const row = el('div', 'nl-row ' + (t.ok ? 'ok' : 'bad'),
          '<span class="nl-s">' + t.step + '</span>' +
          '<span class="nl-a">' + (t.ok ? 'progress' : 'wrong turn') + '</span>' +
          '<span class="nl-p">p=' + t.p.toFixed(2) + '</span>' +
          '<span class="nl-c">ctx ' + (t.ctx / 1000).toFixed(1) + 'k</span>' +
          '<span class="nl-t">' + (t.tokens / 1000).toFixed(1) + 'k billed</span>');
        $('#nl-trace').appendChild(row);
        $('#nl-trace').scrollTop = 1e6;
        $('#nl-ctx-fill').style.width = Math.min(100, t.ctx / (M_ctxMax()) * 100) + '%';
        $('#nl-ctx-lab').textContent = (t.ctx / 1000).toFixed(1) + 'k tokens of context · accuracy penalty −' +
          (t.hp * 100).toFixed(0) + ' points';
      }, i * 460 + 300));
    });

    timers.push(setTimeout(() => {
      $$('.nl-node', svg).forEach(n => n.classList.remove('lit'));
      const o = C.nlOutcomes[r.o];
      $('.nl-node[data-n="' + (r.o === 'done' ? 'declare' : 'ship') + '"]', svg).classList.add('lit');
      $('#nl-stats').innerHTML =
        '<div class="stat"><div class="stat-v" style="color:' + o.c + '">' + r.step + '</div><div class="stat-k">steps taken</div></div>' +
        '<div class="stat"><div class="stat-v">' + (r.tokens / 1000).toFixed(1) + 'k</div><div class="stat-k">tokens billed</div></div>' +
        '<div class="stat"><div class="stat-v">' + (r.ctx / 1000).toFixed(1) + 'k</div><div class="stat-k">final context</div></div>' +
        '<div class="stat" style="grid-column:span 2"><div class="stat-v" style="font-size:15px;color:' + o.c + '">' +
          o.n + '</div><div class="stat-k">' + o.d + '</div></div>';
      xp(3, r.o === 'done' ? '+3 XP — the loop actually finished' : null);
    }, r.trace.length * 460 + 340));
  }
  function M_ctxMax() { return C.nlModel.ctx0 + C.nlModel.hardCap * (C.nlModel.obsTokens + C.nlModel.wrongTokens) / 2; }

  $('#nl-run').onclick = walk;

  /* ---- 400-run distribution: the number that actually decides things ---- */
  function paintDist() {
    const a = NL.agg(g);
    const naive = NL.agg({ verify: 0, scope: 0, compact: 0, state: 0, budget: 0 });
    const keys = ['done', 'shipped', 'escalated', 'runaway'];
    $('#nl-dist').innerHTML =
      '<div class="nl-bar">' + keys.map(k => {
        const pct = a.t[k] / 400 * 100;
        return pct ? '<span style="width:' + pct + '%;background:' + C.nlOutcomes[k].c + '" title="' +
          C.nlOutcomes[k].n + ': ' + pct.toFixed(0) + '%">' + (pct > 9 ? pct.toFixed(0) + '%' : '') + '</span>' : '';
      }).join('') + '</div>' +
      '<div class="nl-key">' + keys.map(k =>
        '<span><i style="background:' + C.nlOutcomes[k].c + '"></i>' + C.nlOutcomes[k].n +
        ' <b>' + (a.t[k] / 4).toFixed(0) + '%</b></span>').join('') + '</div>' +
      '<div class="stat-row" style="margin-top:14px">' +
        '<div class="stat"><div class="stat-v" style="color:' + (a.t.done > 200 ? '#34d399' : '#fb7185') + '">' +
          (a.t.done / 4).toFixed(0) + '%</div><div class="stat-k">runs that actually finished</div></div>' +
        '<div class="stat"><div class="stat-v">' + (a.tokens / 1000).toFixed(0) + 'k</div><div class="stat-k">avg tokens per run</div></div>' +
        '<div class="stat"><div class="stat-v" style="color:#fbbf24">' +
          (isFinite(a.perDone) ? (a.perDone / 1000).toFixed(0) + 'k' : '∞') +
          '</div><div class="stat-k">tokens per finished task</div></div>' +
        '<div class="stat"><div class="stat-v">' +
          (isFinite(a.perDone) ? (naive.perDone / a.perDone).toFixed(1) + '×' : '—') +
          '</div><div class="stat-k">vs the naive loop</div></div>' +
      '</div>' +
      '<p class="panel-sub" style="margin-top:12px">Average tokens per <i>run</i> flatters the naive loop, because giving up early with a wrong answer is cheap. Tokens per <b>finished task</b> is the number that survives contact with a finance team.</p>';
  }

  relabel();
  paintDist();
  $('#nl-guard-note').innerHTML = 'Toggle a guard to read what it does — and watch the flowchart itself change. Each one is an edit to the graph, not a setting on the model.';

  /* code tabs */
  const row = $('#nl-code-tabs'), blk = $('#nl-code');
  C.nlCode.forEach((it, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), it.t);
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); blk.textContent = it.code;
    };
    row.appendChild(b);
  });
  blk.textContent = C.nlCode[0].code;

  $('#nl-lessons').innerHTML = C.nlLessons.map(l =>
    '<div class="gterm"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>').join('');
}

/* ---------- Ch4b: how many tools is too many ---------- */
function initToolScope() {
  const grid = $('#ts-grid'); if (!grid) return;
  const M = C.tsModel;
  let n = 20, scoped = false, phase = 'act';

  /* accuracy falls with the log of the menu size — doubling the tool list
     costs a fixed number of points, which is why 8 -> 16 hurts as much as
     4 -> 8 does */
  const acc = k => Math.max(M.floor, Math.min(0.99, M.baseAcc - M.decay * Math.log2(Math.max(1, k) / 4)));
  const bound = () => scoped
    ? C.tsTools.slice(0, n).filter(t => t.ph === phase)
    : C.tsTools.slice(0, n);

  C.tsPhases.forEach((p, i) => {
    const b = el('button', 'chip' + (p.id === phase ? ' active' : ''), p.n);
    b.onclick = () => {
      $$('.chip', $('#ts-phases')).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); phase = p.id; render();
    };
    $('#ts-phases').appendChild(b);
  });

  $('#ts-n').oninput = () => { n = +$('#ts-n').value; render(); };
  $('#ts-scope').onchange = () => { scoped = $('#ts-scope').checked; render(); xp(2); };

  function render() {
    const list = bound();
    const k = list.length;
    const pStep = acc(k);
    const pRun = Math.pow(pStep, M.steps);
    const perStep = M.tokensPerTool * k;
    const perRun = perStep * M.steps;
    const naiveRun = Math.pow(acc(n), M.steps);

    $('#ts-n-v').textContent = n;
    $('#ts-phases').style.opacity = scoped ? 1 : .35;

    grid.innerHTML = C.tsTools.slice(0, n).map(t => {
      const inScope = !scoped || t.ph === phase;
      return '<span class="ts-tool' + (inScope ? '' : ' out') + ' ph-' + t.ph + '">' + t.n + '</span>';
    }).join('');

    $('#ts-out').innerHTML =
      '<div class="stat"><div class="stat-v">' + k + '</div><div class="stat-k">tools in the prompt</div></div>' +
      '<div class="stat"><div class="stat-v" style="color:' + (pStep > .9 ? '#34d399' : pStep > .8 ? '#fbbf24' : '#fb7185') + '">' +
        (pStep * 100).toFixed(0) + '%</div><div class="stat-k">right tool, per step</div></div>' +
      '<div class="stat"><div class="stat-v" style="color:' + (pRun > .6 ? '#34d399' : pRun > .3 ? '#fbbf24' : '#fb7185') + '">' +
        (pRun * 100).toFixed(0) + '%</div><div class="stat-k">clean run of ' + M.steps + ' steps</div></div>' +
      '<div class="stat"><div class="stat-v">' + (perRun / 1000).toFixed(1) + 'k</div><div class="stat-k">tokens on schemas alone</div></div>';

    /* the curve: run success against menu size, with the current point marked */
    const xs = [4, 6, 8, 10, 12, 16, 20];
    $('#ts-chart').innerHTML = xs.map(x => {
      const v = Math.pow(acc(x), M.steps);
      return '<div class="relbar" title="' + x + ' tools → ' + (v * 100).toFixed(0) + '% clean runs">' +
        '<div class="relbar-fill' + (x === k ? ' here' : '') + '" style="height:' + (v * 100) + '%;background:' +
        (v > .6 ? '#34d399' : v > .3 ? '#fbbf24' : '#fb7185') + '"></div><span>' + x + '</span></div>';
    }).join('');

    $('#ts-note').innerHTML = scoped
      ? 'Scoped to <b>' + C.tsPhases.filter(p => p.id === phase)[0].n.toLowerCase() + '</b>: ' + k +
        ' tools instead of ' + n + '. Clean-run rate goes from <b>' + (naiveRun * 100).toFixed(0) + '%</b> to <b>' +
        (pRun * 100).toFixed(0) + '%</b>, and you stopped paying for ' +
        (((n - k) * M.tokensPerTool * M.steps) / 1000).toFixed(1) + 'k tokens of schemas the agent was never allowed to call.'
      : 'All ' + n + ' tools bound at once. Note that <span class="mono">refund_charge</span> and <span class="mono">deploy_prod</span> ' +
        'are on the menu during a code-fixing task — the model is one bad sample away from calling them, and the only thing ' +
        'preventing it is the prompt asking nicely.';
  }
  render();
}


/* ============================================================
   Ch15 — harness engineering
   ============================================================ */
function initHarness() {
  const host = $('#hn-diagram'); if (!host) return;
  const L = C.harnessLayers;
  const COL = ['var(--violet)', 'var(--cyan)', 'var(--green)', 'var(--amber)', 'var(--pink)', 'var(--red)'];

  function draw(sel) {
    host.innerHTML =
      '<div class="hn-wrap">' +
      '<div class="hn-side hn-model"><b>the model</b><small>tokens in, tokens out.<br>no memory, no hands,<br>no idea when to stop</small></div>' +
      '<div class="hn-layers">' + L.map((l, i) =>
        '<button class="hn-layer' + (sel === l.id ? ' sel' : '') + '" data-id="' + l.id + '" style="--hc:' + COL[i] + '">' +
        '<span class="hn-ico">' + l.icon + '</span>' +
        '<span class="hn-body"><b>' + l.n + '</b><small>' + l.q + '</small></span>' +
        '<span class="hn-w"><i style="width:' + (l.weight / 0.24 * 100) + '%"></i></span>' +
        '</button>').join('') + '</div>' +
      '<div class="hn-side hn-world"><b>the world</b><small>tools, databases,<br>APIs, humans,<br>money moving</small></div>' +
      '</div>';
    $$('.hn-layer', host).forEach(b => b.onclick = () => {
      const l = L.filter(x => x.id === b.dataset.id)[0];
      draw(l.id);
      $('#hn-detail').innerHTML =
        '<h4>' + l.icon + ' ' + l.n + '</h4><p><b>Decides:</b> ' + l.q + '</p>' +
        '<div class="knob-lay"><span>plain English</span>' + l.lay + '</div>' +
        '<div class="knob-tech"><span>technically</span>' + l.tech + '</div>' +
        '<div class="cc-bad"><b>Weak version</b> ' + l.bad + '</div>' +
        '<div class="cc-good"><b>Strong version</b> ' + l.good + '</div>';
      xp(2);
    });
  }
  draw(null);
  $('#hn-detail').innerHTML = '<p class="dim">Click a layer. The bars are how much each one moves quality in practice &mdash; note that "prompt" is not on this list at all.</p>';

  const T = C.harnessTwins;
  $('#hn-twins-intro').textContent = T.intro;
  let revealed = 0;
  function twins() {
    $('#hn-twins').innerHTML =
      '<div class="tw-head"><span></span><b class="tw-a">Agent A &mdash; 38%</b><b class="tw-b">Agent B &mdash; 71%</b></div>' +
      T.rows.map((r, i) =>
        '<div class="tw-row' + (i < revealed ? ' shown' : '') + '" data-i="' + i + '">' +
        '<span class="tw-layer">' + r.layer + '</span>' +
        '<code class="tw-a">' + r.a + '</code>' +
        '<code class="tw-b">' + r.b + '</code>' +
        '<div class="tw-why">' + r.why + '</div></div>').join('') +
      '<div class="btn-row"><button class="btn" id="tw-next">' +
      (revealed >= T.rows.length ? 'Show them again' : 'Reveal the next difference &rarr;') + '</button></div>';
    $('#tw-next').onclick = () => {
      revealed = revealed >= T.rows.length ? 0 : revealed + 1;
      twins();
      if (revealed === T.rows.length) xp(6, 'Six code changes, zero prompt changes');
    };
    $$('#hn-twins .tw-row').forEach(r => r.onclick = () => r.classList.toggle('shown'));
  }
  twins();
  $('#hn-twins-verdict').innerHTML = '<b>Verdict.</b> ' + T.verdict;

  $('#hn-patterns').innerHTML = C.harnessPatterns.map(p =>
    '<div class="hp"><b>' + p.n + '</b><span class="hp-d">' + p.d + '</span>' +
    '<span class="hp-w"><i>use it when</i> ' + p.when + '</span></div>').join('');
  $('#hn-def').innerHTML = C.harnessDef.map(d => '<dt>' + d[0] + '</dt><dd>' + d[1] + '</dd>').join('');
}

/* ============================================================
   Ch16 — the failure playbook
   ============================================================ */
function initPlaybook() {
  const grid = $('#pb-grid'); if (!grid) return;
  grid.innerHTML = C.playbook.map(p =>
    '<button class="pb" data-id="' + p.id + '"><span class="pb-sev ' + p.sev + '">' + p.sev + '</span>' +
    '<span class="pb-ico">' + p.icon + '</span><b>' + p.n + '</b>' +
    '<span class="pb-sym">' + p.sym + '</span></button>').join('');
  $$('.pb', grid).forEach(b => b.onclick = () => {
    const p = C.playbook.filter(x => x.id === b.dataset.id)[0];
    $$('.pb', grid).forEach(x => x.classList.toggle('active', x === b));
    $('#pb-detail').innerHTML =
      '<h4>' + p.icon + ' ' + p.n + ' <span class="pb-sev ' + p.sev + '">' + p.sev + '</span></h4>' +
      '<div class="knob-tech"><span>what you see</span>' + p.sym + '</div>' +
      '<div class="cc-bad"><b>What people do</b> ' + p.wrong + '</div>' +
      '<div class="lab-pane-title" style="margin-top:12px">What to do instead</div>' +
      '<ol class="steps">' + p.right.map(r => '<li>' + r + '</li>').join('') + '</ol>' +
      '<div class="cc-param"><b>watch this number</b> ' + p.metric + '</div>';
    xp(2);
  });
  $('#pb-detail').innerHTML = '<p class="dim">Click a failure. Each one has a detection, one cheap recovery, an honest degradation, and a number to alarm on.</p>';

  /* ---- context rot ---- */
  const R = C.contextRot;
  $('#rot-intro').textContent = R.intro;
  $('#rot-causes').innerHTML = R.causes.map((c, i) =>
    '<button class="mlc" data-i="' + i + '"><b>' + c.n + '</b>' +
    '<div class="mini-bar"><i style="width:' + (c.share / 0.42 * 100) + '%"></i></div>' +
    '<span>' + Math.round(c.share * 100) + '% of real cases</span></button>').join('');
  $$('#rot-causes .mlc').forEach(b => b.onclick = () => {
    const c = R.causes[+b.dataset.i];
    $$('#rot-causes .mlc').forEach(x => x.classList.toggle('active', x === b));
    $('#rot-detail').innerHTML = '<h4>' + c.n + '</h4><p>' + c.d + '</p>' +
      '<div class="cc-good"><b>Fix</b> ' + c.fix + '</div>';
    xp(2);
  });
  $('#rot-detail').innerHTML = '<p class="dim">Click a cause. Nearly half the time it is the first one, and it happens without an error.</p>';

  /* ---- the context budget ---- */
  const COL = ['var(--violet)', 'var(--pink)', 'var(--cyan)', 'var(--green)', 'var(--amber)', 'rgba(255,255,255,.22)'];
  function budget() {
    const w = +$('#rot-w').value;
    $('#rot-wv').textContent = w.toLocaleString() + ' tokens';
    $('#rot-budget').innerHTML =
      '<div class="bud-bar">' + R.budget.map((b, i) =>
        '<div class="bud-seg" data-i="' + i + '" style="width:' + b.pct + '%;--sc:' + COL[i] + '">' +
        '<span>' + b.pct + '%</span></div>').join('') + '</div>' +
      '<div class="bud-key">' + R.budget.map((b, i) =>
        '<button class="bud-k" data-i="' + i + '" style="--sc:' + COL[i] + '">' +
        '<i></i><span><b>' + b.n + '</b>' + Math.round(w * b.pct / 100).toLocaleString() + ' tokens</span></button>').join('') + '</div>';
    const show = i => {
      const b = R.budget[i];
      $$('#rot-budget .bud-seg,#rot-budget .bud-k').forEach(x => x.classList.toggle('sel', +x.dataset.i === i));
      $('#rot-budget-detail').innerHTML = '<h4>' + b.n + ' <span class="dim">' + b.pct + '% &middot; ' +
        Math.round(w * b.pct / 100).toLocaleString() + ' tokens</span></h4><p><b>Policy:</b> ' + b.policy + '</p>';
    };
    $$('#rot-budget .bud-seg,#rot-budget .bud-k').forEach(x => {
      x.onmouseenter = () => show(+x.dataset.i);
      x.onclick = () => { show(+x.dataset.i); xp(1); };
    });
  }
  $('#rot-w').oninput = budget;
  $('#rot-budget-detail').innerHTML = '<p class="dim">Hover a band. Note the last one: reserving headroom for the ANSWER is what stops a truncated reply that looks like a model failure.</p>';
  budget();
  $('#pb-principles').innerHTML = C.playbookPrinciples.map(p => '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>').join('');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initBackground, initAgency, initLoop, initTools, initReact, initPlan, initMemory,
   initReflect, initTopo, initGuard, initReliability, initEval, initShip, initMcp,
   initNaiveLoop, initToolScope, initHarness, initPlaybook, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
