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
const NS = 'http://www.w3.org/2000/svg';

/* render a small state dict the same way everywhere */
function stateBlock(obj, changedKeys) {
  const ch = new Set(changedKeys || []);
  return '<pre class="code statecode">{\n' + Object.keys(obj).map(k =>
    '  <span class="' + (ch.has(k) ? 'sk changed' : 'sk') + '">"' + k + '"</span>: ' +
    '<span class="' + (ch.has(k) ? 'sv changed' : 'sv') + '">' + esc(JSON.stringify(obj[k])) + '</span>')
    .join(',\n') + '\n}</pre>';
}

/* a small directed-graph renderer shared by ch5 and ch11 */
function drawGraph(svg, nodes, edges, activeId, litEdge) {
  svg.innerHTML = '';
  const pos = {};
  nodes.forEach(n => pos[n.id] = n);

  edges.forEach(e => {
    const a = pos[e[0]], b = pos[e[1]];
    if (!a || !b) return;
    const lit = litEdge && litEdge[0] === e[0] && litEdge[1] === e[1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const bend = a.y > b.y ? -20 : 0;                 // backward edges bow outward
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M' + a.x + ',' + a.y + ' Q' + (mx + bend) + ',' + my + ' ' + b.x + ',' + b.y);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', lit ? '#e879f9' : 'rgba(255,255,255,.2)');
    path.setAttribute('stroke-width', lit ? '1.1' : '.55');
    svg.appendChild(path);
    if (e[2]) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', mx + bend); t.setAttribute('y', my - 1);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '2.6');
      t.setAttribute('fill', lit ? '#e879f9' : '#7b829c');
      t.textContent = e[2];
      svg.appendChild(t);
    }
  });

  nodes.forEach(n => {
    const on = n.id === activeId;
    const term = n.id === 'END' || n.id === 'START';
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', n.x - 13.5); r.setAttribute('y', n.y - 5.5);
    r.setAttribute('width', 27); r.setAttribute('height', 11);
    r.setAttribute('rx', term ? 5.5 : 3);
    r.setAttribute('fill', on ? 'rgba(129,140,248,.32)' : 'rgba(13,14,26,.95)');
    r.setAttribute('stroke', on ? '#818cf8' : 'rgba(255,255,255,.26)');
    r.setAttribute('stroke-width', on ? '1' : '.5');
    svg.appendChild(r);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', n.x); t.setAttribute('y', n.y + 1.4);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '3.1');
    t.setAttribute('fill', on ? '#f0f1ff' : '#c4cadb');
    t.textContent = n.label;
    svg.appendChild(t);
  });
}

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
      ctx.fillStyle = 'rgba(200,190,255,.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20000) {
          ctx.strokeStyle = 'rgba(129,140,248,' + (0.18 * (1 - d2 / 20000)) + ')';
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
    const labels = ['▶', '◆', '↺', '⏸', '■'];
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 15);
      c.setAttribute('fill', 'rgba(12,13,24,.92)');
      c.setAttribute('stroke', ['#818cf8', '#a78bfa', '#e879f9', '#f0abfc', '#818cf8'][i]);
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', pt.x); t.setAttribute('y', pt.y + 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11');
      t.setAttribute('fill', '#e6e8fb');
      t.textContent = labels[i];
      g.appendChild(t);
    }
  }
}

/* ============================================================
   Ch1 — chain or graph?
   ============================================================ */
function initShape() {
  const root = $('#shape'); if (!root) return;
  let score = 0, done = 0;

  C.shapeTasks.forEach(task => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(task.t)));
    const opts = el('div', 'sortcard-opts two');
    Object.keys(C.shapeLabels).forEach(k => {
      const L = C.shapeLabels[k];
      const b = el('button', 'sortopt', '<span class="so-ico">' + L.ico + '</span><span class="so-n">' + L.name + '</span><span class="so-h">' + L.hint + '</span>');
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => {
          x.disabled = true;
          if (Object.keys(C.shapeLabels)[xi] === task.a) x.classList.add('correct');
        });
        if (k !== task.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === C.shapeTasks.length) {
          root.appendChild(el('div', 'quiz-result',
            '<h3>' + score + ' / ' + C.shapeTasks.length + '</h3><p>' +
            (score >= 5 ? 'You have the test: does an arrow need to point backwards, or does the run need to outlive the process? If neither, a chain is smaller and faster.'
              : 'The test is not "is this complicated". It is: does control flow ever need to go <i>backwards</i>, or survive a restart? Those two are what LCEL cannot do.') +
            '</p>'));
          xp(10, 'A graph is a cost — pay it for cycles and durability, nothing else');
        }
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + C.shapeLabels[task.a].name + '.</b> ' + task.why));
    root.appendChild(card);
  });

  const gives = $('#graph-gives');
  if (gives) gives.innerHTML = C.graphGives.map(g =>
    '<div class="gterm"><b>' + g[0] + '</b><span>' + g[1] + '</span></div>').join('');
}

/* ============================================================
   Ch2 — state and reducers
   ============================================================ */
function initState() {
  const tabs = $('#state-reducers'), out = $('#state-out');
  if (!out) return;
  let mode = 'add', step = 0;

  C.reducers.forEach((r, i) => {
    const b = el('button', 'chip' + (r.k === 'add' ? ' active' : ''), r.ico + ' ' + r.name);
    b.onclick = () => {
      mode = r.k; step = 0;
      $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active');
      render(); xp(3);
    };
    tabs.appendChild(b);
  });

  function compute() {
    const st = { question: 'Are Friday deploys allowed?', steps: [], docs: null, relevant: null };
    const changed = [];
    for (let i = 0; i < step; i++) {
      const u = JSON.parse(C.stateUpdates[i].ret.replace(/'/g, '"'));
      Object.keys(u).forEach(k => {
        if (k === 'steps') {
          if (mode === 'none') st.steps = u.steps;            // overwrite
          else st.steps = st.steps.concat(u.steps);           // add / add_messages both append
        } else st[k] = u[k];
        if (i === step - 1) changed.push(k);
      });
    }
    return { st, changed };
  }

  function render() {
    const r = C.reducers.find(x => x.k === mode);
    const { st, changed } = compute();
    const last = step > 0 ? C.stateUpdates[step - 1] : null;

    out.innerHTML =
      '<pre class="code">' + esc(
        'class State(TypedDict):\n' +
        '    question: str\n' +
        '    ' + r.sig + '\n' +
        '    docs: int\n' +
        '    relevant: bool') + '</pre>' +
      '<div class="two-up" style="margin-top:14px">' +
        '<div><div class="lab-pane-title">node ' + (step || 0) + ' of ' + C.stateUpdates.length + ' returned</div>' +
          (last ? '<div class="trace act"><span class="tk">' + last.node + '</span><code>return ' + esc(last.ret) + '</code></div>'
                : '<p class="panel-sub">Press <b>Run next node</b>.</p>') + '</div>' +
        '<div><div class="lab-pane-title">state after merge</div>' + stateBlock(st, changed) + '</div>' +
      '</div>' +
      '<div class="tnote' + (mode === 'none' && step > 1 ? ' err' : '') + '">' +
        (mode === 'none' && step > 1
          ? '💥 <b>Every earlier step is gone.</b> With no reducer the key is overwritten, so <span class="mono">steps</span> only ever holds the last node\'s return. This is the single most common LangGraph bug, and it is silent.'
          : '💡 ' + r.warn) + '</div>';

    $('#state-next').disabled = step >= C.stateUpdates.length;
  }

  $('#state-next').onclick = () => {
    if (step >= C.stateUpdates.length) return;
    step++; render(); xp(2);
    if (step === 2 && mode === 'none') xp(5, 'Switch reducers and replay — watch what "no reducer" costs you');
  };
  $('#state-reset').onclick = () => { step = 0; render(); };
  render();

  const rules = $('#state-rules');
  if (rules) rules.innerHTML = C.stateRules.map(r =>
    '<div class="gterm"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
}

/* ============================================================
   Ch3 — building a graph
   ============================================================ */
function initBuilder() {
  const bank = $('#build-bank'), out = $('#build-out'), svg = $('#build-svg');
  if (!bank) return;
  let chain = ['classify', 'retrieve', 'generate'];

  bank.innerHTML = C.nodeBank.map(n =>
    '<button class="chip" data-id="' + n.id + '">+ ' + n.ico + ' ' + n.label + '</button>').join('');
  $$('.chip', bank).forEach(b => b.onclick = () => { chain.push(b.dataset.id); render(); xp(2); });

  function render() {
    const nodes = chain.map((id, i) => {
      const n = C.nodeBank.find(x => x.id === id);
      return { id: id + '#' + i, label: n.label, x: 50, y: 0 };
    });
    const all = [{ id: 'START', label: 'START', x: 50, y: 0 }].concat(nodes, [{ id: 'END', label: 'END', x: 50, y: 0 }]);
    const gap = all.length > 1 ? 88 / (all.length - 1) : 0;
    all.forEach((n, i) => n.y = 6 + i * gap);
    const edges = all.slice(1).map((n, i) => [all[i].id, n.id, '']);
    drawGraph(svg, all, edges, null, null);

    out.innerHTML =
      '<div class="lab-pane-title">the code</div>' +
      '<pre class="code">' + esc(
        'builder = StateGraph(State)\n' +
        chain.map(id => 'builder.add_node("' + id + '", ' + id + ')').join('\n') +
        '\n\nbuilder.add_edge(START, "' + (chain[0] || 'END') + '")\n' +
        chain.slice(1).map((id, i) => 'builder.add_edge("' + chain[i] + '", "' + id + '")').join('\n') +
        (chain.length ? '\nbuilder.add_edge("' + chain[chain.length - 1] + '", END)' : '') +
        '\n\ngraph = builder.compile()') + '</pre>' +
      '<div class="lab-pane-title" style="margin-top:16px">the node functions</div>' +
      [...new Set(chain)].map(id => {
        const n = C.nodeBank.find(x => x.id === id);
        return '<pre class="code">' + esc(n.code) + '</pre>';
      }).join('') +
      (chain.includes('review')
        ? '<div class="tnote err">⚠️ <span class="mono">review</span> calls <span class="mono">interrupt()</span>, so this graph will not pause unless you compile it with a checkpointer. See Chapter 8.</div>'
        : '');

    $('#build-chain').innerHTML = chain.length
      ? chain.map((id, i) => {
          const n = C.nodeBank.find(x => x.id === id);
          return '<div class="lnode" data-i="' + i + '"><span class="ln-ico">' + n.ico + '</span><b>' + n.label + '</b><button class="ln-x">✕</button></div>';
        }).join('<div class="lpipe">↓</div>')
      : '<p class="panel-sub">Empty graph — add a node.</p>';
    $$('.ln-x', $('#build-chain')).forEach((x, i) => x.onclick = () => { chain.splice(i, 1); render(); });
  }
  render();
  window.addEventListener('chapterchange', e => { if (e.detail === 'nodes') render(); });

  const rules = $('#edge-rules');
  if (rules) rules.innerHTML = C.edgeRules.map(r =>
    '<div class="gterm"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
}

/* ============================================================
   Ch4 — conditional edges
   ============================================================ */
function initRouter() {
  const chips = $('#router-cases'), out = $('#router-out');
  if (!out) return;
  let cur = 0;

  C.routerCases.forEach((c, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), c.q);
    b.onclick = () => { cur = i; $$('.chip', chips).forEach(x => x.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
    chips.appendChild(b);
  });

  function render() {
    const c = C.routerCases[cur];
    const targets = ['run_sql', 'retrieve', 'review', 'generate'];
    out.innerHTML =
      '<div class="trace think"><span class="tk">state</span>' + stateBlock({ question: c.q, kind: c.kind }, ['kind']) + '</div>' +
      '<div class="trace act"><span class="tk">route() returns</span><code>"' + c.node + '"</code></div>' +
      '<div class="branches">' + targets.map(t =>
        '<div class="branch' + (t === c.node ? ' taken' : '') + '"><b>' + t + '</b>' +
        (t === c.node ? '<span class="pill good">taken</span>' : '<span class="pill">not taken</span>') + '</div>').join('') + '</div>' +
      '<div class="tnote">💡 ' + c.why + '</div>';
  }
  render();

  const code = $('#router-code');
  if (code) code.textContent = C.routerCode;

  const notes = $('#router-notes');
  if (notes) notes.innerHTML = C.routerNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch5 — cycles and recursion limits
   ============================================================ */
function initCycle() {
  const svg = $('#cycle-svg'), stateBox = $('#cycle-state'), log = $('#cycle-log'), limit = $('#cycle-limit');
  if (!svg) return;
  let step = -1;

  function render() {
    const lim = +limit.value;
    $('#cycle-limit-v').textContent = lim;
    const blown = step + 1 > lim;                    // super-steps taken exceeds the ceiling
    const shown = blown ? lim - 1 : step;
    const r = shown >= 0 ? C.cycleRun[shown] : null;
    const prev = shown > 0 ? C.cycleRun[shown - 1] : null;
    const litEdge = prev && r ? [prev.node, r.node] : null;

    drawGraph(svg, C.cycleNodes, C.cycleEdges, r ? r.node : null, litEdge);

    const changed = r && prev ? Object.keys(r.state).filter(k => JSON.stringify(r.state[k]) !== JSON.stringify(prev.state[k])) : [];
    stateBox.innerHTML = '<div class="lab-pane-title">state</div>' +
      stateBlock(r ? r.state : C.cycleRun[0].state, changed);

    if (blown) {
      log.innerHTML = '<div class="trace" style="border-left-color:#fb7185;background:rgba(251,113,133,.09)">' +
        '<span class="tk" style="color:#fb7185">GraphRecursionError</span>' +
        'Recursion limit of ' + lim + ' reached without hitting a stop condition. The run is aborted — no answer, and the partial state is still in the checkpoint.' +
        '<br><br>Raising the limit here would only postpone it. The real fix is the <span class="mono">attempts &gt;= 2</span> guard in the routing function.</div>';
    } else if (r) {
      log.innerHTML = '<div class="trace ' + (r.node === 'rewrite' ? 'observe' : r.node === 'END' ? 'final' : 'act') + '">' +
        '<span class="tk">' + r.node + '</span>' + esc(r.log) + '</div>';
    } else {
      log.innerHTML = '<p class="panel-sub">Press <b>Next super-step</b>. The first retrieval deliberately misses, so the conditional edge sends the run <i>backwards</i> — the thing a chain cannot express. Then drop the recursion limit to 3 and replay.</p>';
    }
    $('#cycle-count').textContent = step < 0 ? 'not started'
      : blown ? 'aborted at super-step ' + lim
      : 'super-step ' + (step + 1) + ' / limit ' + lim;
  }

  $('#cycle-next').onclick = () => {
    if (step >= C.cycleRun.length - 1) return;
    step++; render(); xp(2);
    if (step === 3) xp(5, 'That is the backward edge — retrieve ran a second time');
    if (step === C.cycleRun.length - 1) xp(6, 'The loop stopped because state said so, not because it ran out of steps');
  };
  $('#cycle-reset').onclick = () => { step = -1; render(); };
  limit.oninput = render;
  render();
  window.addEventListener('chapterchange', e => { if (e.detail === 'cycles') render(); });

  const code = $('#cycle-code');
  if (code) code.textContent = C.cycleCode;

  const guards = $('#cycle-guards');
  if (guards) guards.innerHTML = C.cycleGuards.map((g, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + g[0] + '</b><p>' + g[1] + '</p></div></div>').join('');
}

/* ============================================================
   Ch6 — prebuilt react agent
   ============================================================ */
function initReact() {
  const trace = $('#react-trace'); if (!trace) return;
  let step = 0, auto = null;

  const LBL = { human: 'HumanMessage', ai: 'AIMessage', tool: 'ToolMessage', final: 'AIMessage (final)' };
  function next() {
    if (step >= C.reactTrace.length) { stop(); return; }
    const s = C.reactTrace[step++];
    const cls = s.k === 'human' ? 'think' : s.k === 'tool' ? 'observe' : s.k === 'final' ? 'final' : 'act';
    trace.appendChild(el('div', 'trace ' + cls,
      '<span class="tk">' + LBL[s.k] + '</span><span class="node-tag">node: ' + s.node + '</span>' + esc(s.t) +
      (s.tool ? '<div class="tool-call mono">tool_calls: ' + esc(s.tool) + '</div>' : '')));
    trace.scrollTop = trace.scrollHeight;
    $$('.ra-node').forEach(n => n.classList.toggle('on', n.dataset.n === s.node));
    $('#react-count').textContent = 'messages in state: ' + step;
    if (s.k === 'final') { stop(); xp(8, 'The loop exits because the model returned no tool_calls'); }
  }
  function stop() { if (auto) { clearInterval(auto); auto = null; $('#react-auto').textContent = '▶ Run to completion'; } }
  $('#react-step').onclick = () => { next(); xp(1); };
  $('#react-auto').onclick = e => { if (auto) return stop(); e.target.textContent = '⏸ Pause'; auto = setInterval(next, 1100); };
  $('#react-reset').onclick = () => {
    stop(); step = 0; trace.innerHTML = '';
    $$('.ra-node').forEach(n => n.classList.remove('on'));
    $('#react-count').textContent = 'messages in state: 0';
  };

  const code = $('#react-code');
  if (code) code.textContent = C.reactCode;

  const an = $('#react-anatomy');
  if (an) an.innerHTML = C.reactAnatomy.map(a =>
    '<div class="gterm"><b>' + a[0] + '</b><span>' + a[1] + '</span></div>').join('');
}

/* ============================================================
   Ch7 — checkpointers and threads
   ============================================================ */
function initPersist() {
  const stream = $('#thread-stream'), stores = $('#thread-stores');
  if (!stream) return;
  let i = 0, crashed = false;
  const th = { alice: [], bob: [] };

  function paint() {
    stores.innerHTML = Object.keys(th).map(t =>
      '<div class="memstore"><div class="ms-h">🧵 thread_id = "' + t + '"<span class="ms-n">' + th[t].length + ' checkpoints</span></div>' +
      (th[t].length ? th[t].map((c, ci) =>
        '<div class="ms-item"><span class="ck">ckpt ' + ci + '</span> ' + esc(c) + '</div>').join('')
        : '<div class="ms-empty">no checkpoints yet</div>') + '</div>').join('');
  }
  function next() {
    if (i >= C.threadTurns.length) return;
    const t = C.threadTurns[i++];
    stream.appendChild(el('div', 'trace think', '<span class="tk">' + t.th + ' · human</span>' + esc(t.u)));
    stream.appendChild(el('div', 'trace final', '<span class="tk">' + t.th + ' · ai</span>' + esc(t.a)));
    stream.scrollTop = stream.scrollHeight;
    th[t.th].push(t.u.slice(0, 44) + (t.u.length > 44 ? '…' : ''));
    paint();
    if (i === 3) xp(5, 'Bob asked Alice\'s exact question and got a different answer — thread_id is the whole boundary');
  }
  $('#thread-next').onclick = () => { next(); xp(1); };
  $('#thread-crash').onclick = () => {
    crashed = !crashed;
    stream.appendChild(el('div', 'trace',
      crashed
        ? '<span class="tk" style="color:#fb7185">process died</span>In-memory anything is gone. With a Postgres checkpointer the checkpoints on the right survived — so <span class="mono">graph.invoke(None, config)</span> picks each thread up exactly where it stopped.'
        : '<span class="tk" style="color:#34d399">resumed</span>New process, same database. Both threads continue with full history; neither user notices.'));
    stream.scrollTop = stream.scrollHeight;
    xp(4, crashed ? 'The checkpoints outlived the process' : 'Resumed from the last checkpoint');
  };
  $('#thread-reset').onclick = () => { i = 0; crashed = false; stream.innerHTML = ''; th.alice = []; th.bob = []; paint(); };
  paint();

  const sv = $('#savers');
  if (sv) sv.innerHTML = C.savers.map(s =>
    '<div class="pcard"><div class="pcard-badge">' + s.pkg + '</div><h3 class="mono" style="font-size:15px">' + s.name + '</h3>' +
    '<p class="pcard-desc">' + s.use + '</p>' +
    '<div class="pcard-foot"><span class="pill ' + (s.prod ? 'good' : 'bad') + '">' + (s.prod ? 'production' : 'dev only') + '</span></div></div>').join('');

  const code = $('#persist-code');
  if (code) code.textContent = C.persistCode;

  const notes = $('#persist-notes');
  if (notes) notes.innerHTML = C.persistNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch8 — interrupt / human in the loop
   ============================================================ */
function initHitl() {
  const out = $('#hitl-out'), choices = $('#hitl-choices');
  if (!out) return;
  let phase = 0, outcome = null;   // 0 = not started, 1 = paused, 2 = resumed

  function block(s, active) {
    return '<div class="hstep' + (active ? ' on' : '') + '"><div class="hs-h">' +
      (s.node === 'review' ? '⏸ ' : '') + s.node + '</div><div class="hs-log">' + esc(s.log) + '</div>' +
      stateBlock(s.state, []) + '</div>';
  }

  function render() {
    let html = '';
    if (phase === 0) {
      html = '<p class="panel-sub">Press <b>Run the graph</b>. It will stop by itself at the review node.</p>';
    } else {
      html = C.hitlSteps.map((s, i) => block(s, phase === 1 && i === 1)).join('');
      if (phase === 1) {
        html += '<div class="tnote">⏸ <b>Paused.</b> <span class="mono">invoke()</span> returned with an <span class="mono">__interrupt__</span> payload and <span class="mono">snap.next == ("review",)</span>. Nothing irreversible has happened. This process could exit right now and the run would still be resumable tomorrow.</div>';
      } else if (outcome) {
        const o = C.hitlOutcomes[outcome];
        html += '<div class="resume-row ' + o.cls + '"><b>' + o.label + '</b><code>' + esc(o.resume) + '</code></div>' +
          '<div class="trace act"><span class="tk">resumed</span>' + esc(o.log) + '</div>' +
          o.tail.map(s => block(s, false)).join('');
      }
    }
    out.innerHTML = html;
    choices.style.display = phase === 1 ? 'flex' : 'none';
    $('#hitl-run').disabled = phase !== 0;
  }

  $('#hitl-run').onclick = () => { phase = 1; render(); xp(3); };
  $('#hitl-reset').onclick = () => { phase = 0; outcome = null; render(); };

  Object.keys(C.hitlOutcomes).forEach(k => {
    const o = C.hitlOutcomes[k];
    const b = el('button', 'btn' + (k === 'approve' ? '' : ' btn-ghost'), o.label);
    b.onclick = () => {
      outcome = k; phase = 2; render();
      xp(6, k === 'reject' ? 'Reject is not a failure — it is another turn round the loop' : 'Resumed from the checkpoint with the human\'s value');
    };
    choices.appendChild(b);
  });
  render();

  const code = $('#hitl-code');
  if (code) code.textContent = C.hitlCode;

  const notes = $('#hitl-notes');
  if (notes) notes.innerHTML = C.hitlNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch9 — time travel
   ============================================================ */
function initTimeTravel() {
  const list = $('#tt-history'), out = $('#tt-out');
  if (!list) return;
  let sel = null, forked = false;

  function render() {
    list.innerHTML = '<div class="lab-pane-title">get_state_history(config)</div>' +
      C.ttHistory.slice().reverse().map(h =>
        '<button class="ckpt' + (sel === h.i ? ' sel' : '') + '" data-i="' + h.i + '">' +
          '<span class="ck-n">' + h.i + '</span><b>' + h.node + '</b>' +
          '<span class="ck-id mono">' + h.ckpt + '</span></button>').join('') +
      (forked ? '<div class="lab-pane-title" style="margin-top:16px">forked branch</div>' +
        C.ttFork.branch.slice().reverse().map(h =>
          '<div class="ckpt fork"><span class="ck-n">' + h.i + '</span><b>' + h.node + '</b>' +
          '<span class="ck-id mono">' + h.ckpt + '</span></div>').join('') : '');

    $$('.ckpt[data-i]', list).forEach(b => b.onclick = () => { sel = +b.dataset.i; forked = false; render(); xp(2); });

    if (sel === null) {
      out.innerHTML = '<p class="panel-sub">Pick a checkpoint on the left. Every super-step wrote one, so you can address any moment of the run — not just the end.</p>';
      $('#tt-fork').disabled = true;
      return;
    }
    const h = C.ttHistory[sel];
    out.innerHTML =
      '<div class="lab-pane-title">checkpoint ' + h.ckpt + ' · after <b>' + h.node + '</b></div>' +
      stateBlock(h.vals, forked ? Object.keys(C.ttFork.edit) : []) +
      (forked
        ? '<div class="resume-row good"><b>forked</b><code>' + esc('graph.update_state(snap.config, ' + JSON.stringify(C.ttFork.edit) + ')') + '</code></div>' +
          '<div class="lab-pane-title" style="margin-top:14px">state after the forked run</div>' +
          stateBlock(C.ttFork.branch[C.ttFork.branch.length - 1].vals, ['region', 'rows', 'answer']) +
          '<div class="tnote">✅ A new branch of checkpoints, descending from #' + C.ttFork.fromIndex + '. The original EU run is untouched and still addressable by its own checkpoint id — this is a fork, not an undo.</div>'
        : '<div class="tnote">💡 <span class="mono">graph.invoke(None, snap.config)</span> replays forward from here unchanged. To run a <i>different</i> future, edit the state first — that is what the fork button does.' +
          (sel === C.ttFork.fromIndex ? '' : '<br><br>Pick checkpoint <b>#' + C.ttFork.fromIndex + '</b> (after <span class="mono">plan</span>) to fork before the SQL ran.') + '</div>');

    $('#tt-fork').disabled = sel !== C.ttFork.fromIndex || forked;
  }

  $('#tt-fork').onclick = () => {
    forked = true; render();
    xp(8, 'Two futures now exist from the same past — that is time travel');
  };
  $('#tt-reset').onclick = () => { sel = null; forked = false; render(); };
  render();

  const code = $('#tt-code');
  if (code) code.textContent = C.ttCode;

  const uses = $('#tt-uses');
  if (uses) uses.innerHTML = C.ttUses.map(u =>
    '<div class="gterm"><b>' + u[0] + '</b><span>' + u[1] + '</span></div>').join('');
}

/* ============================================================
   Ch10 — streaming modes
   ============================================================ */
function initStream() {
  const tabs = $('#stream-tabs'), out = $('#stream-out');
  if (!out) return;
  let cur = 1;

  C.streamModes.forEach((m, i) => {
    const b = el('button', 'chip' + (i === 1 ? ' active' : ''), m.ico + ' ' + m.name);
    b.onclick = () => { cur = i; $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
    tabs.appendChild(b);
  });

  function render() {
    const m = C.streamModes[cur];
    out.innerHTML =
      '<pre class="code">' + esc('for chunk in graph.stream(inp, config, stream_mode=' + m.name + '):\n    print(chunk)') + '</pre>' +
      '<p class="panel-sub" style="margin-top:12px">' + m.desc + '</p>' +
      '<div class="lab-pane-title" style="margin-top:12px">what you actually receive</div>' +
      '<div class="events">' + m.events.map((e, i) =>
        '<div class="ev" style="animation-delay:' + (i * 110) + 'ms"><span class="ev-n">' + (i + 1) + '</span><code>' + esc(e) + '</code></div>').join('') + '</div>' +
      '<div class="tnote">🎯 <b>Reach for it when:</b> ' + m.use + '</div>';
  }
  render();

  const code = $('#stream-code');
  if (code) code.textContent = C.streamCode;
}

/* ============================================================
   Ch11 — subgraphs and multi-agent handoffs
   ============================================================ */
function initMulti() {
  const svg = $('#multi-svg'), log = $('#multi-log');
  if (!svg) return;
  let step = -1;

  const edges = [
    ['supervisor', 'researcher', ''], ['researcher', 'supervisor', ''],
    ['supervisor', 'writer', ''], ['writer', 'supervisor', ''],
    ['supervisor', 'END', '']
  ];

  function render() {
    const s = step >= 0 ? C.multiSteps[step] : null;
    drawGraph(svg, C.multiNodes, edges, s ? s.to : 'supervisor', s ? [s.from, s.to] : null);
    log.innerHTML = s
      ? C.multiSteps.slice(0, step + 1).map((x, i) =>
          '<div class="trace ' + (x.to === 'END' ? 'final' : 'act') + (i === step ? '' : ' dim') + '">' +
          '<span class="tk">' + x.from + ' → ' + x.to + '</span><code>' + esc(x.cmd) + '</code>' +
          '<div class="hs-log">' + esc(x.log) + '</div></div>').join('')
      : '<p class="panel-sub">Press <b>Next handoff</b>. Each step is one node returning a <span class="mono">Command</span> — routing and a state update in a single return value.</p>';
    $('#multi-count').textContent = step < 0 ? 'not started' : 'handoff ' + (step + 1) + ' of ' + C.multiSteps.length;
  }
  $('#multi-next').onclick = () => {
    if (step >= C.multiSteps.length - 1) return;
    step++; render(); xp(2);
    if (step === C.multiSteps.length - 1) xp(6, 'Every hand-off went through the supervisor — one node holds the plan');
  };
  $('#multi-reset').onclick = () => { step = -1; render(); };
  render();
  window.addEventListener('chapterchange', e => { if (e.detail === 'multi') render(); });

  const code = $('#multi-code');
  if (code) code.textContent = C.multiCode;

  const notes = $('#subgraph-notes');
  if (notes) notes.innerHTML = C.subgraphNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch12 — short vs long term memory
   ============================================================ */
function initMemory() {
  const scopes = $('#mem-scopes');
  if (scopes) scopes.innerHTML = C.memScopes.map(m =>
    '<div class="memcard" style="--c:' + m.color + '"><div class="mem-h">' + m.ico + ' <b>' + m.name + '</b>' +
    '<span class="pill">' + m.scope + '</span></div><p>' + m.holds + '</p>' +
    '<div class="mc-ex">' + esc(m.api) + '</div>' +
    '<div class="mem-watch">⏳ ' + m.dies + '</div></div>').join('');

  const opsBox = $('#mem-ops'), storeBox = $('#mem-store');
  if (!opsBox) return;
  let i = 0;
  const data = {};

  function paint() {
    const keys = Object.keys(data);
    storeBox.innerHTML = '<div class="lab-pane-title">store contents</div>' +
      (keys.length ? keys.map(ns =>
        '<div class="memstore"><div class="ms-h">🗄️ ' + esc(ns) + '<span class="ms-n">' + Object.keys(data[ns]).length + '</span></div>' +
        Object.keys(data[ns]).map(k => '<div class="ms-item"><span class="ck">' + k + '</span> ' + esc(data[ns][k]) + '</div>').join('') +
        '</div>').join('')
        : '<div class="memstore"><div class="ms-empty">empty</div></div>');
  }
  function next() {
    if (i >= C.memOps.length) return;
    const o = C.memOps[i++];
    opsBox.appendChild(el('div', 'trace ' + (o.op === 'put' ? 'act' : 'observe'),
      '<span class="tk">store.' + o.op + '</span><code>store.' + o.op + esc(o.args) + '</code>' +
      '<div class="hs-log">' + esc(o.log) + '</div>'));
    opsBox.scrollTop = opsBox.scrollHeight;
    if (o.op === 'put') {
      const m = o.args.match(/\(\("([^"]+)",\s*"([^"]+)"\),\s*"([^"]+)",\s*\{"text":\s*"([^"]+)"\}\)/);
      if (m) {
        const ns = '("' + m[1] + '", "' + m[2] + '")';
        data[ns] = data[ns] || {};
        data[ns][m[3]] = m[4];
      }
    }
    paint();
    if (i === 3) xp(5, 'Same key, different namespace, no collision — namespaces are the isolation boundary');
    if (i === C.memOps.length) xp(6, 'Search never crossed a namespace. It cannot.');
  }
  $('#mem-next').onclick = () => { next(); xp(1); };
  $('#mem-reset').onclick = () => { i = 0; opsBox.innerHTML = ''; Object.keys(data).forEach(k => delete data[k]); paint(); };
  paint();

  const code = $('#mem-code');
  if (code) code.textContent = C.memCode;

  const notes = $('#mem-notes');
  if (notes) notes.innerHTML = C.memNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch13 — shipping
   ============================================================ */
function initShip() {
  const arch = $('#arch');
  if (arch) arch.innerHTML = C.arch.map((r, i) =>
    '<div class="abox' + (i === 1 ? ' hl' : '') + '"><b>' + r[0] + '</b><small>' + r[1] + '</small></div>').join('');

  const pc = $('#prod-concerns');
  if (pc) pc.innerHTML = C.prodConcerns.map(p =>
    '<div class="gterm"><b>' + p[0] + '</b><span>' + p[1] + '</span></div>').join('');

  const dn = $('#deploy-notes');
  if (dn) dn.innerHTML = C.deployNotes.map(d =>
    '<div class="gterm"><b class="mono">' + d[0] + '</b><span>' + d[1] + '</span></div>').join('');

  const calc = $('#calc');
  if (calc) {
    const fields = [
      ['runs', 'runs / day', 5000],
      ['steps', 'super-steps / run', 9],
      ['size', 'state size (KB)', 40],
      ['days', 'retention (days)', 30]
    ];
    calc.innerHTML = fields.map(f =>
      '<div class="calc-f"><label for="c-' + f[0] + '">' + f[1] + '</label><input id="c-' + f[0] + '" type="number" min="0" value="' + f[2] + '"></div>')
      .join('') + '<div class="calc-out" id="calc-out"></div>';

    function run() {
      const v = id => Math.max(0, +($('#c-' + id).value || 0));
      const runs = v('runs'), steps = v('steps'), kb = v('size'), days = v('days');
      const rowsDay = runs * steps;
      const gb = rowsDay * kb * days / 1e6;
      const wps = rowsDay / 86400;
      const trimmed = rowsDay * Math.min(kb, 8) * days / 1e6;
      $('#calc-out').innerHTML = [
        ['checkpoint rows / day', rowsDay.toLocaleString()],
        ['writes / second', wps.toFixed(1)],
        ['storage at retention', gb.toFixed(1) + ' GB'],
        ['if state were ≤8KB', trimmed.toFixed(1) + ' GB'],
        ['rows retained', (rowsDay * days).toLocaleString()]
      ].map(c => '<div class="stat"><div class="stat-v">' + c[1] + '</div><div class="stat-k">' + c[0] + '</div></div>').join('') +
      '<p class="panel-sub" style="grid-column:1/-1;margin:8px 0 0">A checkpoint is written after <b>every super-step</b>, not once per run — so storage scales with steps × state size, and that is entirely under your control. The single biggest lever is keeping large objects out of state: store a document id and fetch it in the node. Add a retention job too; nobody needs last quarter\'s intermediate checkpoints.</p>';
    }
    $$('input', calc).forEach(i => i.oninput = run);
    run();
  }

  const cl = $('#checklist');
  if (cl) {
    const KEY = 'lgflow.checklist';
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
   Ch14 — quiz + glossary
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
    const msg = pct === 100 ? 'Perfect. Go build the graph — you know where the sharp edges are.'
      : pct >= 75 ? 'Strong. You could review someone\'s graph and spot the missing reducer.'
      : pct >= 50 ? 'Good start. Revisit state/reducers and persistence — nearly everything else rests on those two.'
      : 'Worth another pass. State + checkpoints are the two ideas; the rest is consequences.';
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
  [initBackground, initShape, initState, initBuilder, initRouter, initCycle, initReact,
   initPersist, initHitl, initTimeTravel, initStream, initMulti, initMemory, initShip, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
