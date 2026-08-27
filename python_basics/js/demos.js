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
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* A play/pause driver shared by every stepper in the course. */
function stepper(len, render, ms) {
  let at = 0, timer = null;
  const api = {
    get at() { return at; },
    go(i) { at = Math.max(0, Math.min(len - 1, i)); render(at); return api; },
    next() { if (at >= len - 1) { api.stop(); return api; } return api.go(at + 1); },
    prev() { return api.go(at - 1); },
    playing: () => !!timer,
    stop() { clearInterval(timer); timer = null; if (api.onstate) api.onstate(false); return api; },
    play() {
      if (timer) return api.stop();
      if (at >= len - 1) api.go(0);
      timer = setInterval(() => { if (at >= len - 1) api.stop(); else api.go(at + 1); }, ms || 1100);
      if (api.onstate) api.onstate(true);
      return api;
    }
  };
  return api;
}

/* ============================================================
   Background particles + the hero pipeline
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
      ctx.fillStyle = 'rgba(160,180,255,.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20000) {
          ctx.strokeStyle = 'rgba(124,92,255,' + (0.16 * (1 - d2 / 20000)) + ')';
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
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
   Ch1 — the type explorer
   ============================================================ */
function initTypes() {
  const grid = $('#type-grid'), out = $('#type-out'); if (!grid) return;
  let seen = new Set();

  C.typeCards.forEach((t, i) => {
    const b = el('button', 'tcard', '<span class="tcard-lit mono">' + esc(t.lit) + '</span><span class="tcard-type">' + t.type + '</span>');
    b.onclick = () => {
      $$('.tcard', grid).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      show(t);
      if (!seen.has(i)) { seen.add(i); xp(seen.size === C.typeCards.length ? 10 : 1,
        seen.size === C.typeCards.length ? '+10 XP — every built-in type inspected' : null); }
    };
    grid.appendChild(b);
  });

  function show(t) {
    out.innerHTML = '';
    const rows = [
      ['type(x)', "&lt;class '" + t.type + "'&gt;", 'violet'],
      ['mutable', t.mut ? 'yes — can change in place' : 'no — every change makes a new object', t.mut ? 'amber' : 'cyan'],
      ['bool(x)', String(t.truthy), t.truthy ? 'green' : 'red'],
      ['shape', t.size, 'dim']
    ];
    const box = el('div', 'tout-rows');
    rows.forEach((r, i) => {
      const row = el('div', 'tout-row tout-in');
      row.style.animationDelay = (i * 70) + 'ms';
      row.innerHTML = '<span class="tout-k mono">' + r[0] + '</span><span class="tout-v ' + r[2] + '">' + r[1] + '</span>';
      box.appendChild(row);
    });
    out.appendChild(el('div', 'tout-head mono', '&gt;&gt;&gt; x = ' + esc(t.lit)));
    out.appendChild(box);
    out.appendChild(el('div', 'tout-note', t.note));
  }
  show(C.typeCards[0]);
  $$('.tcard', grid)[0].classList.add('active');
}

/* ============================================================
   Ch2 — names, objects and the arrows between them
   ============================================================ */
function initBind() {
  const root = $('#bind-demo'); if (!root) return;
  let prog = C.bindProgs[0], step;

  const tabRow = el('div', 'chip-row');
  C.bindProgs.forEach((p, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), p.title);
    b.onclick = () => {
      $$('.chip', tabRow).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); prog = p; build();
    };
    tabRow.appendChild(b);
  });
  root.appendChild(tabRow);
  const body = el('div'); root.appendChild(body);

  function build() {
    body.innerHTML = '';
    const wrap = el('div', 'bind-wrap');
    const codeBox = el('pre', 'code bind-code');
    prog.lines.forEach((l, i) => {
      const line = el('span', 'cl');
      line.dataset.i = i;
      line.textContent = (i + 1) + '   ' + l + '\n';
      codeBox.appendChild(line);
    });
    const viz = el('div', 'bind-viz',
      '<div class="bind-col"><div class="bind-h">names</div><div id="bind-names"></div></div>' +
      '<svg class="bind-svg" id="bind-svg"></svg>' +
      '<div class="bind-col"><div class="bind-h">objects on the heap</div><div id="bind-heap"></div></div>');
    wrap.appendChild(codeBox); wrap.appendChild(viz);
    body.appendChild(wrap);

    const say = el('div', 'stepper-say');
    const outBox = el('pre', 'code console-out', '');
    const ctrl = el('div', 'stepper-ctrl');
    const bPlay = el('button', 'btn', '▶ Run');
    const bPrev = el('button', 'btn btn-ghost', '‹ Step back');
    const bNext = el('button', 'btn btn-ghost', 'Step ›');
    const pos = el('span', 'stepper-pos');
    ctrl.append(bPlay, bPrev, bNext, pos);
    body.append(ctrl, say, el('div', 'panel-sub', 'stdout'), outBox, el('div', 'callout mini', '<div class="callout-ico">🧠</div><div>' + prog.moral + '</div>'));

    step = stepper(prog.steps.length, render, 1400);
    step.onstate = on => bPlay.innerHTML = on ? '❚❚ Pause' : '▶ Run';
    bPlay.onclick = () => step.play();
    bNext.onclick = () => { step.stop(); step.next(); };
    bPrev.onclick = () => { step.stop(); step.prev(); };
    render(0);
  }

  function render(i) {
    const s = prog.steps[i];
    $$('.cl', body).forEach(l => l.classList.toggle('on', +l.dataset.i === s.line));
    $('.stepper-pos', body).textContent = 'step ' + (i + 1) + ' / ' + prog.steps.length;
    $('.stepper-say', body).innerHTML = s.say || '&nbsp;';
    $('.console-out', body).textContent = s.out || '(nothing printed yet)';

    const namesBox = $('#bind-names', body), heapBox = $('#bind-heap', body);
    namesBox.innerHTML = ''; heapBox.innerHTML = '';
    Object.keys(s.heap).forEach(id => {
      const o = el('div', 'heap-obj', '<span class="heap-id">' + id + '</span><span class="mono">' + esc(s.heap[id]) + '</span>');
      o.dataset.id = id;
      heapBox.appendChild(o);
    });
    Object.keys(s.names).forEach(n => {
      const b = el('div', 'name-box', '<span class="mono">' + n + '</span>');
      b.dataset.name = n;
      namesBox.appendChild(b);
    });
    requestAnimationFrame(() => drawArrows(s));
    if (i === prog.steps.length - 1) xp(3);
  }

  function drawArrows(s) {
    const svg = $('#bind-svg', body); if (!svg) return;
    const box = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    svg.innerHTML = '<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">' +
      '<path d="M0,0 L0,6 L9,3 z" fill="#22d3ee"/></marker></defs>';
    const shared = {};
    Object.values(s.names).forEach(id => shared[id] = (shared[id] || 0) + 1);
    Object.keys(s.names).forEach(n => {
      const from = $('.name-box[data-name="' + n + '"]', body);
      const to = $('.heap-obj[data-id="' + s.names[n] + '"]', body);
      if (!from || !to) return;
      const f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
      const y1 = f.top + f.height / 2 - box.top, y2 = t.top + t.height / 2 - box.top;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M0,' + y1 + ' C' + (box.width * .55) + ',' + y1 + ' ' + (box.width * .45) + ',' + y2 + ' ' + (box.width - 2) + ',' + y2);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', shared[s.names[n]] > 1 ? '#fbbf24' : '#22d3ee');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('marker-end', 'url(#ah)');
      p.setAttribute('class', 'bind-arrow');
      svg.appendChild(p);
      if (!reduced()) {
        const len = p.getTotalLength ? p.getTotalLength() : 300;
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 420, fill: 'forwards', easing: 'ease-out' });
      }
    });
  }

  build();
  window.addEventListener('resize', () => { if (step) render(step.at); });
  window.addEventListener('chapterchange', e => { if (e.detail === 'names' && step) requestAnimationFrame(() => render(step.at)); });
}

/* ============================================================
   Ch3 — the string lab and the slice ruler
   ============================================================ */
function initStrings() {
  const row = $('#str-ops'), out = $('#str-out'), why = $('#str-why'); if (!row) return;
  $('#str-subject').textContent = 's = "' + C.strSubject + '"';
  C.strOps.forEach((o, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), esc(o.call));
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash');
      out.innerHTML = '<span class="mono prompt">&gt;&gt;&gt; ' + esc(o.call) + '</span>\n<span class="mono res">' + esc(o.out) + '</span>';
      why.innerHTML = o.why;
      xp(1);
    };
    row.appendChild(b);
  });
  $$('.chip', row)[0].click();
}

function initSlice() {
  const strip = $('#slice-strip'), row = $('#slice-ops'), out = $('#slice-out'), why = $('#slice-why');
  if (!strip) return;
  const s = C.sliceDemo;
  strip.innerHTML = '';
  [...s].forEach((ch, i) => {
    strip.appendChild(el('div', 'sch',
      '<span class="sch-neg">' + (i - s.length) + '</span><span class="sch-c">' + ch + '</span><span class="sch-i">' + i + '</span>'));
  });

  C.sliceCases.forEach((c, ci) => {
    const b = el('button', 'chip mono' + (ci ? '' : ' active'), 's' + esc(c.s));
    b.onclick = () => {
      $$('.chip', row).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const chars = $$('.sch', strip);
      chars.forEach(x => x.classList.remove('lit'));
      // light the characters that survive, in output order, one at a time
      const kept = [...c.out];
      let k = 0;
      const idx = [];
      // find each output character's source position, walking the direction of the slice
      const reverse = c.s.includes('-1]') && c.s.includes('::');
      const order = reverse ? [...Array(s.length).keys()].reverse() : [...Array(s.length).keys()];
      order.forEach(i => { if (k < kept.length && s[i] === kept[k]) { idx.push(i); k++; } });
      idx.forEach((i, n) => setTimeout(() => chars[i] && chars[i].classList.add('lit'), reduced() ? 0 : n * 110));
      out.innerHTML = '<span class="mono prompt">&gt;&gt;&gt; s' + esc(c.s) + '</span>\n<span class="mono res">' + esc(JSON.stringify(c.out)) + '</span>';
      why.innerHTML = c.why;
      xp(1);
    };
    row.appendChild(b);
  });
  $$('.chip', row)[0].click();
}

function initFstrings() {
  const root = $('#fstr'); if (!root) return;
  C.fstrings.forEach(f => {
    const card = el('div', 'fs-card reveal');
    card.innerHTML =
      '<div class="fs-vars mono">' + Object.keys(f.vars).map(k => k + ' = ' + esc(f.vars[k])).join('<br>') + '</div>' +
      '<div class="fs-expr mono">' + esc(f.expr) + '</div>' +
      '<div class="fs-arrow">↓</div>' +
      '<div class="fs-out mono">' + esc(f.out) + '</div>' +
      '<div class="fs-why">' + f.why + '</div>';
    root.appendChild(card);
  });
}

/* ============================================================
   Ch4 — collections: the race, the table, the chooser
   ============================================================ */
function initCollRace() {
  const root = $('#coll-race'); if (!root) return;
  const N = 24;
  const items = Array.from({ length: N }, (_, i) => i * 7 % 97);
  let target = items[N - 3];

  root.innerHTML =
    '<div class="race-head"><span>Looking for <b class="mono" id="race-target"></b> among ' + N + ' items</span>' +
    '<button class="btn" id="race-go">▶ Race them</button></div>' +
    '<div class="race-lane"><div class="race-lab">list<span class="race-o">O(n) — scan</span></div><div class="race-cells" id="race-list"></div><div class="race-count" id="race-lc">0 checks</div></div>' +
    '<div class="race-lane"><div class="race-lab">set<span class="race-o">O(1) — hash</span></div><div class="race-cells" id="race-set"></div><div class="race-count" id="race-sc">0 checks</div></div>' +
    '<div class="race-note" id="race-note">A list compares item by item until it finds a match. A set hashes the value and jumps straight to the slot. Same answer, wildly different work.</div>';

  const lc = $('#race-list', root), sc = $('#race-set', root);
  items.forEach(v => { lc.appendChild(el('div', 'cell mono', String(v))); sc.appendChild(el('div', 'cell mono', String(v))); });
  $('#race-target', root).textContent = target;

  let running = false;
  $('#race-go', root).onclick = () => {
    if (running) return;
    running = true;
    target = items[Math.floor(Math.random() * N)];
    $('#race-target', root).textContent = target;
    const cells = $$('.cell', lc), scells = $$('.cell', sc);
    cells.concat(scells).forEach(c => c.className = 'cell mono');
    const hit = items.indexOf(target);

    // set: one hash, one probe
    const sIdx = scells[hit];
    setTimeout(() => { sIdx.classList.add('found'); $('#race-sc', root).textContent = '1 check'; }, 260);

    // list: walk it
    let i = 0;
    const tick = () => {
      if (i > 0) cells[i - 1].classList.add('miss');
      if (i > hit) {
        running = false;
        $('#race-note', root).innerHTML = 'The list needed <b>' + (hit + 1) + '</b> comparisons; the set needed <b>1</b>. ' +
          'At 24 items nobody notices. At 50,000, inside a loop, it is the difference between a page that loads and one that times out.';
        xp(4, '+4 XP — O(n) vs O(1), seen not told');
        return;
      }
      cells[i].classList.add('probe');
      $('#race-lc', root).textContent = (i + 1) + ' check' + (i ? 's' : '');
      if (i === hit) cells[i].classList.add('found');
      i++;
      setTimeout(tick, reduced() ? 0 : 90);
    };
    setTimeout(tick, 260);
  };
}

function initCollTable() {
  const t = $('#coll-table'), note = $('#coll-note'); if (!t) return;
  t.innerHTML = '<table class="dt"><thead><tr><th>operation</th><th>list</th><th>tuple</th><th>dict</th><th>set</th></tr></thead><tbody></tbody></table>';
  const tb = $('tbody', t);
  C.collTable.forEach(r => {
    const tr = el('tr');
    tr.innerHTML = '<td class="mono">' + r.op + '</td>' + ['list', 'tuple', 'dict', 'set']
      .map(k => '<td class="mono ' + (r[k] === 'O(1)' || r[k] === 'O(1)*' || r[k] === 'yes' ? 'good' : r[k] === '—' || r[k] === 'no' ? 'dimc' : 'warn') + '">' + r[k] + '</td>').join('');
    tr.onclick = () => {
      $$('tr', tb).forEach(x => x.classList.remove('on'));
      tr.classList.add('on');
      note.innerHTML = r.note;
      note.classList.remove('flash'); void note.offsetWidth; note.classList.add('flash');
    };
    tb.appendChild(tr);
  });
  $$('tr', tb)[0].click();
}

function initCollTasks() {
  const root = $('#coll-tasks'); if (!root) return;
  let done = new Set();
  C.collTasks.forEach((t, i) => {
    const card = el('div', 'ct-card reveal');
    card.innerHTML = '<div class="ct-ask">' + t.ask + '</div><div class="ct-opts"></div><div class="ct-body"></div>';
    const opts = $('.ct-opts', card), body = $('.ct-body', card);
    ['list', 'tuple', 'dict', 'set'].forEach(k => {
      const b = el('button', 'qopt ct-opt', k);
      b.onclick = () => {
        if (card.classList.contains('answered')) return;
        card.classList.add('answered');
        $$('.ct-opt', opts).forEach(x => { x.disabled = true; if (x.textContent === t.pick) x.classList.add('correct'); });
        if (k !== t.pick) b.classList.add('incorrect');
        body.innerHTML =
          '<div class="ct-two"><div><div class="ct-tag good">reach for this</div><pre class="code">' + esc(t.good) + '</pre></div>' +
          '<div><div class="ct-tag bad">not this</div><pre class="code">' + esc(t.bad) + '</pre></div></div>' +
          '<div class="ct-why">' + t.why + '</div>';
        body.classList.add('show');
        done.add(i);
        xp(k === t.pick ? 4 : 1, done.size === C.collTasks.length ? '+XP — you can now pick a container on purpose' : null);
      };
      opts.appendChild(b);
    });
    root.appendChild(card);
  });
}

/* ============================================================
   Ch5 — the execution tracer
   ============================================================ */
function initTrace() {
  const root = $('#trace-demo'); if (!root) return;
  let prog = C.traceProgs[0], step;

  const tabRow = el('div', 'chip-row');
  C.traceProgs.forEach((p, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), p.title);
    b.onclick = () => { $$('.chip', tabRow).forEach(c => c.classList.remove('active')); b.classList.add('active'); prog = p; build(); };
    tabRow.appendChild(b);
  });
  root.appendChild(tabRow);
  const body = el('div'); root.appendChild(body);

  function build() {
    body.innerHTML =
      '<div class="trace-wrap">' +
        '<pre class="code trace-code" id="trace-code"></pre>' +
        '<div class="trace-side">' +
          '<div class="trace-h">variables</div><div class="var-table" id="trace-vars"></div>' +
          '<div class="trace-h">stdout</div><pre class="code console-out" id="trace-out"></pre>' +
        '</div>' +
      '</div>' +
      '<div class="stepper-ctrl">' +
        '<button class="btn" id="tr-play">▶ Run</button>' +
        '<button class="btn btn-ghost" id="tr-prev">‹ Step back</button>' +
        '<button class="btn btn-ghost" id="tr-next">Step ›</button>' +
        '<span class="stepper-pos" id="tr-pos"></span></div>' +
      '<div class="stepper-say" id="tr-say"></div>';

    const code = $('#trace-code', body);
    prog.lines.forEach((l, i) => {
      const line = el('span', 'cl'); line.dataset.i = i;
      line.textContent = String(i + 1).padStart(2, ' ') + '  ' + l + '\n';
      code.appendChild(line);
    });

    step = stepper(prog.steps.length, render, 900);
    step.onstate = on => $('#tr-play', body).innerHTML = on ? '❚❚ Pause' : '▶ Run';
    $('#tr-play', body).onclick = () => step.play();
    $('#tr-next', body).onclick = () => { step.stop(); step.next(); };
    $('#tr-prev', body).onclick = () => { step.stop(); step.prev(); };
    render(0);
  }

  let prev = {};
  function render(i) {
    const s = prog.steps[i];
    $$('.cl', body).forEach(l => l.classList.toggle('on', +l.dataset.i === s.line));
    $('#tr-pos', body).textContent = 'step ' + (i + 1) + ' / ' + prog.steps.length;
    $('#tr-say', body).innerHTML = s.say || '&nbsp;';
    $('#trace-out', body).textContent = s.out || '(nothing printed yet)';
    const vt = $('#trace-vars', body);
    vt.innerHTML = '';
    Object.keys(s.vars).forEach(k => {
      const changed = prev[k] !== s.vars[k];
      const r = el('div', 'vrow' + (changed ? ' changed' : ''),
        '<span class="vk mono">' + k + '</span><span class="vv mono">' + esc(s.vars[k]) + '</span>');
      vt.appendChild(r);
    });
    prev = Object.assign({}, s.vars);
    if (i === prog.steps.length - 1) xp(3);
  }

  build();
}

/* ============================================================
   Ch6 — argument binding + the mutable default
   ============================================================ */
function initFuncs() {
  const root = $('#func-demo'); if (!root) return;
  root.innerHTML =
    '<pre class="code func-sig">' + esc(C.funcSig) + '</pre>' +
    '<div class="chip-row" id="fc-calls"></div>' +
    '<div class="bind-table" id="fc-bind"></div>' +
    '<div class="stepper-say" id="fc-why"></div>';
  const row = $('#fc-calls', root), table = $('#fc-bind', root);

  C.funcCalls.forEach((c, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), esc(c.call));
    b.onclick = () => {
      $$('.chip', row).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      table.innerHTML = '';
      C.funcParams.forEach((p, pi) => {
        const isDefault = (p === 'qty' && c.bind[p] === '1') || (p === 'note' && c.bind[p] === '""') ||
                          (p === 'extras' && c.bind[p] === '()') || (p === 'opts' && c.bind[p] === '{}');
        const r = el('div', 'brow');
        r.style.animationDelay = (pi * 80) + 'ms';
        r.innerHTML = '<span class="bk mono">' + p + '</span><span class="barrow">←</span>' +
          '<span class="bv mono' + (isDefault ? ' defaulted' : '') + '">' + esc(c.bind[p]) + '</span>' +
          (isDefault ? '<span class="btag">default</span>' : '<span class="btag passed">passed</span>');
        table.appendChild(r);
      });
      $('#fc-why', root).innerHTML = c.why;
      xp(1);
    };
    row.appendChild(b);
  });
  $$('.chip', row)[0].click();
}

function initMutDefault() {
  const root = $('#mutdef'); if (!root) return;
  const M = C.mutDefault;
  root.innerHTML =
    '<div class="two-up">' +
      '<div class="md-side bad"><div class="md-tag bad">the trap</div><pre class="code">' + esc(M.bad) + '</pre>' +
        '<div class="md-out"><span class="panel-sub">output</span><pre class="code console-out" id="md-bad-out"></pre></div></div>' +
      '<div class="md-side good"><div class="md-tag good">the fix</div><pre class="code">' + esc(M.good) + '</pre>' +
        '<div class="md-out"><span class="panel-sub">output</span><pre class="code console-out" id="md-good-out"></pre></div></div>' +
    '</div>' +
    '<div class="btn-row"><button class="btn" id="md-run">▶ Run both</button></div>' +
    '<div class="callout warn md-why" id="md-why" style="display:none"><div class="callout-ico">⚠️</div><div>' + M.why + '</div></div>';

  $('#md-run', root).onclick = () => {
    typeInto($('#md-bad-out', root), M.badOut);
    typeInto($('#md-good-out', root), M.goodOut, () => {
      $('#md-why', root).style.display = '';
      xp(5, '+5 XP — the mutable default, understood');
    });
  };
  $('#md-bad-out', root).textContent = '(not run yet)';
  $('#md-good-out', root).textContent = '(not run yet)';
}

function typeInto(node, text, done) {
  if (reduced()) { node.textContent = text; if (done) done(); return; }
  node.textContent = '';
  let i = 0;
  const t = setInterval(() => {
    node.textContent = text.slice(0, ++i);
    if (i >= text.length) { clearInterval(t); if (done) done(); }
  }, 28);
}

/* ============================================================
   Ch7 — reading a traceback
   ============================================================ */
function initErrors() {
  const row = $('#err-tabs'), root = $('#err-body'); if (!row) return;
  C.errCases.forEach((c, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), c.name);
    b.onclick = () => { $$('.chip', row).forEach(x => x.classList.remove('active')); b.classList.add('active'); show(c); };
    row.appendChild(b);
  });

  function show(c) {
    root.innerHTML =
      '<div class="two-up">' +
        '<div><div class="err-tag bad">code that raises</div><pre class="code">' + esc(c.code) + '</pre></div>' +
        '<div><div class="err-tag good">what to write instead</div><pre class="code">' + esc(c.fix) + '</pre></div>' +
      '</div>' +
      '<div class="err-tb-wrap"><div class="err-tag">the traceback — read it bottom-up</div><pre class="code err-tb" id="err-tb"></pre></div>' +
      '<div class="stepper-say">' + c.read + '</div>';
    const tb = $('#err-tb', root);
    const lines = c.tb.split('\n');
    lines.forEach((l, i) => {
      const s = el('span', 'tbl' + (i === lines.length - 1 ? ' tb-key' : ''));
      s.textContent = l + '\n';
      s.style.animationDelay = ((lines.length - 1 - i) * 90) + 'ms';
      tb.appendChild(s);
    });
    xp(1);
  }
  show(C.errCases[0]);
}

function initTryPatterns() {
  const root = $('#try-pat'); if (!root) return;
  C.tryPatterns.forEach(p => {
    const c = el('div', 'pcard reveal');
    c.innerHTML = '<h3 class="mono">' + esc(p.t) + '</h3><pre class="code">' + esc(p.code) + '</pre><p class="pcard-desc">' + p.why + '</p>';
    root.appendChild(c);
  });
}

/* ============================================================
   Ch8 — comprehension flow
   ============================================================ */
function initComp() {
  const root = $('#comp-demo'); if (!root) return;
  root.innerHTML =
    '<div class="chip-row" id="cp-tabs"></div>' +
    '<div class="two-up cp-code">' +
      '<div><div class="cp-tag">the loop</div><pre class="code" id="cp-loop"></pre></div>' +
      '<div><div class="cp-tag grad-tag">the comprehension</div><pre class="code" id="cp-comp"></pre></div>' +
    '</div>' +
    '<div class="cp-flow"><div class="cp-lane" id="cp-in"></div>' +
      '<div class="cp-mid" id="cp-mid">↓</div>' +
      '<div class="cp-lane" id="cp-out"></div></div>' +
    '<div class="btn-row"><button class="btn" id="cp-run">▶ Watch it build</button>' +
      '<span class="cp-result mono" id="cp-result"></span></div>' +
    '<div class="stepper-say" id="cp-why"></div>';

  const tabs = $('#cp-tabs', root);
  let cur = C.comps[0], timer = null;

  C.comps.forEach((c, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), c.kind);
    b.onclick = () => { $$('.chip', tabs).forEach(x => x.classList.remove('active')); b.classList.add('active'); cur = c; show(); };
    tabs.appendChild(b);
  });

  function show() {
    clearInterval(timer);
    $('#cp-loop', root).textContent = cur.loop;
    $('#cp-comp', root).textContent = cur.comp;
    $('#cp-why', root).innerHTML = cur.why;
    $('#cp-result', root).textContent = '';
    const inLane = $('#cp-in', root), outLane = $('#cp-out', root);
    inLane.innerHTML = ''; outLane.innerHTML = '';
    C.compInput.forEach(n => inLane.appendChild(el('div', 'cbox mono', String(n))));
    $('#cp-mid', root).textContent = cur.kind === 'filter' ? 'keep only the even ones ↓'
      : cur.kind === 'generator' ? 'one at a time, never stored ↓' : '↓';
  }

  $('#cp-run', root).onclick = () => {
    clearInterval(timer);
    const inBoxes = $$('.cbox', $('#cp-in', root));
    const outLane = $('#cp-out', root);
    outLane.innerHTML = '';
    inBoxes.forEach(b => b.className = 'cbox mono');
    $('#cp-result', root).textContent = '';
    let i = 0;
    timer = setInterval(() => {
      if (i >= C.compInput.length) {
        clearInterval(timer);
        $('#cp-result', root).textContent = '→ ' + cur.result;
        xp(2);
        return;
      }
      inBoxes[i].classList.add(cur.keep[i] ? 'kept' : 'dropped');
      if (cur.keep[i]) {
        const o = el('div', 'cbox mono out', cur.vals[i]);
        if (cur.kind === 'generator') o.classList.add('ghost');
        outLane.appendChild(o);
      }
      i++;
    }, reduced() ? 1 : 320);
  };
  show();
}

/* ============================================================
   Ch9 — files, the venv terminal, one class
   ============================================================ */
function initFiles() {
  const root = $('#file-ops'); if (!root) return;
  C.fileOps.forEach(f => {
    const c = el('div', 'pcard reveal');
    c.innerHTML = '<h3>' + f.t + '</h3><pre class="code">' + esc(f.code) + '</pre><p class="pcard-desc">' + f.why + '</p>';
    root.appendChild(c);
  });
}

function initEnv() {
  const root = $('#env-demo'); if (!root) return;
  root.innerHTML =
    '<div class="term"><div class="term-bar"><span></span><span></span><span></span><b>project ~ terminal</b></div>' +
    '<pre class="term-body" id="env-body"></pre></div>' +
    '<div class="btn-row"><button class="btn" id="env-run">▶ Set up a project</button>' +
    '<button class="btn btn-ghost" id="env-reset">reset</button></div>' +
    '<div class="stepper-say" id="env-say"></div>';
  const body = $('#env-body', root);
  let running = false;

  function reset() { body.textContent = '$ '; $('#env-say', root).innerHTML = '&nbsp;'; }
  reset();

  $('#env-reset', root).onclick = () => { running = false; reset(); };
  $('#env-run', root).onclick = () => {
    if (running) return;
    running = true; reset();
    let i = 0;
    const nextCmd = () => {
      if (i >= C.envSteps.length) {
        running = false;
        body.textContent += '\n$ ';
        xp(5, '+5 XP — you can set up a Python project from scratch');
        return;
      }
      const s = C.envSteps[i];
      $('#env-say', root).innerHTML = '<b class="mono">' + esc(s.cmd) + '</b> — ' + s.what + '<br>' + s.why;
      let k = 0;
      const t = setInterval(() => {
        body.textContent += s.cmd[k++];
        body.scrollTop = body.scrollHeight;
        if (k >= s.cmd.length) {
          clearInterval(t);
          setTimeout(() => { body.textContent += '\n' + s.what.replace(/<[^>]+>/g, '') + '\n$ '; i++; setTimeout(nextCmd, 700); }, 350);
        }
      }, reduced() ? 1 : 26);
    };
    nextCmd();
  };
}

function initClass() {
  const root = $('#class-demo'); if (!root) return;
  root.innerHTML = '<div class="two-up"><pre class="code" id="cls-code"></pre><div class="cls-parts" id="cls-parts"></div></div>';
  $('#cls-code', root).textContent = C.classDemo.code;
  const parts = $('#cls-parts', root);
  C.classDemo.parts.forEach(p => {
    const b = el('button', 'cls-part', '<b class="mono">' + p.k + '</b><span>' + p.v + '</span>');
    b.onclick = () => {
      $$('.cls-part', parts).forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      highlight(p.k);
      xp(1);
    };
    parts.appendChild(b);
  });

  function highlight(key) {
    const code = C.classDemo.code;
    $('#cls-code', root).innerHTML = code.split('\n').map(line =>
      line.includes(key.replace('self.', '')) && (line.includes(key) || line.includes(key.replace('self.', '')))
        ? '<span class="hl">' + esc(line) + '</span>' : esc(line)).join('\n');
  }
}

/* ============================================================
   Ch10 — gotcha cards
   ============================================================ */
function initGotchas() {
  const root = $('#gotchas'); if (!root) return;
  let hit = 0, answered = 0;
  C.gotchas.forEach(g => {
    const card = el('div', 'got-card reveal');
    card.innerHTML = '<div class="got-q mono">' + g.q + '</div><div class="got-opts"></div><div class="got-e"></div>';
    const opts = $('.got-opts', card);
    g.guess.forEach((txt, gi) => {
      const b = el('button', 'qopt', txt);
      b.onclick = () => {
        if (card.classList.contains('answered')) return;
        card.classList.add('answered');
        answered++;
        $$('.qopt', opts).forEach((x, xi) => { x.disabled = true; if (xi === g.a) x.classList.add('correct'); });
        if (gi !== g.a) b.classList.add('incorrect'); else hit++;
        const e = $('.got-e', card);
        e.innerHTML = g.e; e.classList.add('show');
        xp(gi === g.a ? 3 : 1, answered === C.gotchas.length ? '🐍 ' + hit + '/' + C.gotchas.length + ' gotchas dodged' : null);
      };
      opts.appendChild(b);
    });
    root.appendChild(card);
  });
}

/* ============================================================
   Ch11 — quiz + glossary
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
    const msg = pct === 100 ? 'Perfect. You have the mental model, not just the syntax.'
      : pct >= 75 ? 'Strong. You can read and debug real Python from here.'
      : pct >= 50 ? 'Solid start — revisit the chapters behind the misses.'
      : 'Worth another pass. Chapters 2 and 6 are where most of this clicks.';
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
   Ch10 — the data stack
   ============================================================ */

/* Three panels are the same card, so they share one renderer. */
function techCards(sel, items) {
  const root = $(sel); if (!root) return;
  root.innerHTML = '';
  items.forEach(t => root.appendChild(el('div', 'tech reveal',
    '<h5>' + t.name + (t.tag ? ' <span class="pill">' + t.tag + '</span>' : '') + '</h5>' +
    '<p>' + t.what + '</p>' +
    (t.code ? '<pre class="code">' + esc(t.code) + '</pre>' : '') +
    (t.why ? '<p class="pcard-desc">' + t.why + '</p>' : ''))));
}

function initDataStack() { techCards('#data-stack', C.dataStack); }

function initVec() {
  const root = $('#vec-demo'); if (!root) return;
  const V = C.vecDemo;
  root.innerHTML =
    '<div class="lab-panes">' +
      '<div><div class="lab-pane-title">a list, and a Python loop</div>' +
        '<pre class="code">' + esc(V.loop) + '</pre>' +
        '<div class="score-wrap"><span class="mono" id="vec-loop-n">0</span>' +
        '<div class="score-bar"><div class="score-fill" id="vec-loop-b" style="background:var(--amber)"></div></div></div></div>' +
      '<div><div class="lab-pane-title">a NumPy array</div>' +
        '<pre class="code">' + esc(V.vec) + '</pre>' +
        '<div class="score-wrap"><span class="mono" id="vec-arr-n">0</span>' +
        '<div class="score-bar"><div class="score-fill" id="vec-arr-b" style="background:var(--green)"></div></div></div></div>' +
    '</div>' +
    '<div class="btn-row"><button class="btn" id="vec-run">▶ Run both</button></div>' +
    '<div class="stepper-say" id="vec-say">' + V.caution + '</div>';

  const num = n => n.toLocaleString('en-US') + ' Python-level op' + (n === 1 ? '' : 's');
  const loopN = $('#vec-loop-n', root), loopB = $('#vec-loop-b', root);
  const arrN = $('#vec-arr-n', root), arrB = $('#vec-arr-b', root);
  let timer = null;

  $('#vec-run', root).onclick = () => {
    clearInterval(timer);
    loopB.style.width = arrB.style.width = '0%';
    loopN.textContent = arrN.textContent = num(0);
    $('#vec-say', root).innerHTML = V.caution;

    /* the array finishes before you can read the sentence — that is the point */
    setTimeout(() => { arrB.style.width = '100%'; arrN.textContent = num(V.vecOps); }, 60);

    const ticks = reduced() ? 1 : 60;
    let k = 0;
    timer = setInterval(() => {
      k++;
      loopB.style.width = (k / ticks * 100) + '%';
      loopN.textContent = num(Math.round(V.loopOps * k / ticks));
      if (k >= ticks) {
        clearInterval(timer);
        $('#vec-say', root).innerHTML = V.why + '<br><br>' + V.caution;
        xp(4, '⚡ vectorise instead of looping');
      }
    }, reduced() ? 1 : 45);
  };
}

function initPandas() {
  const tabs = $('#pd-tabs'), body = $('#pd-body'); if (!tabs) return;
  C.pandasOps.forEach((op, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), op.label);
    b.onclick = () => {
      $$('.chip', tabs).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      show(op);
    };
    tabs.appendChild(b);
  });

  function show(op) {
    body.innerHTML =
      '<div class="two-up">' +
        '<div><div class="lab-pane-title">code</div><pre class="code">' + esc(op.code) + '</pre></div>' +
        '<div><div class="lab-pane-title">output</div><pre class="code">' +
          (op.out == null ? '<span class="dim">no output — it writes a file, or returns a new frame</span>' : esc(op.out)) +
        '</pre></div>' +
      '</div><div class="stepper-say">' + op.why + '</div>';
    xp(1);
  }
  show(C.pandasOps[0]);
}

/* ============================================================
   Ch11 — scikit-learn
   ============================================================ */
function initSkApi() { techCards('#sk-api', C.sklearnApi); }

function initMlPipe() {
  const root = $('#ml-pipe'); if (!root) return;
  root.innerHTML =
    '<div class="rag-pipe" id="mp-strip"></div>' +
    '<pre class="code" id="mp-code"></pre>' +
    '<div class="btn-row"><button class="btn" id="mp-play">▶ Run</button>' +
      '<button class="btn btn-ghost" id="mp-prev">&larr; prev</button>' +
      '<button class="btn btn-ghost" id="mp-next">next &rarr;</button>' +
      '<span class="dim mono" id="mp-pos"></span></div>' +
    '<div class="stepper-say" id="mp-say"></div>';

  const strip = $('#mp-strip', root);
  C.mlPipeline.forEach((s, i) => {
    const d = el('div', 'rp', '<b>' + s.n + '</b><small>' + s.small + '</small>');
    d.onclick = () => { step.stop(); step.go(i); };
    strip.appendChild(d);
  });
  const boxes = $$('.rp', strip);
  let reached = 0;

  const step = stepper(C.mlPipeline.length, render, 3000);
  step.onstate = on => $('#mp-play', root).innerHTML = on ? '❚❚ Pause' : '▶ Run';
  $('#mp-play', root).onclick = () => step.play();
  $('#mp-next', root).onclick = () => { step.stop(); step.next(); };
  $('#mp-prev', root).onclick = () => { step.stop(); step.prev(); };

  function render(i) {
    const s = C.mlPipeline[i];
    boxes.forEach((b, bi) => {
      b.classList.toggle('lit', bi === i);
      b.classList.toggle('done', bi < i);
    });
    $('#mp-code', root).textContent = s.code;
    $('#mp-say', root).innerHTML = s.say;
    $('#mp-pos', root).textContent = 'step ' + (i + 1) + ' / ' + C.mlPipeline.length;
    if (i > reached) { reached = i; xp(2, i === C.mlPipeline.length - 1 ? '🔬 that is a whole ML project' : null); }
  }
  render(0);
}

function initModelPicks() {
  const root = $('#model-picks'); if (!root) return;
  const done = new Set();
  C.modelPicks.forEach((t, i) => {
    const card = el('div', 'ct-card reveal',
      '<div class="ct-ask">' + t.ask + '</div><div class="ct-opts"></div><div class="ct-body"></div>');
    const opts = $('.ct-opts', card), body = $('.ct-body', card);
    C.modelOptions.forEach(k => {
      const b = el('button', 'qopt ct-opt', k);
      b.onclick = () => {
        if (card.classList.contains('answered')) return;
        card.classList.add('answered');
        $$('.ct-opt', opts).forEach(x => { x.disabled = true; if (x.textContent === t.pick) x.classList.add('correct'); });
        if (k !== t.pick) b.classList.add('incorrect');
        body.innerHTML =
          '<div class="ct-two"><div><div class="ct-tag good">reach for this</div><pre class="code">' + esc(t.good) + '</pre></div>' +
          '<div><div class="ct-tag bad">not this</div><pre class="code">' + esc(t.bad) + '</pre></div></div>' +
          '<div class="ct-why">' + t.why + '</div>';
        body.classList.add('show');
        done.add(i);
        xp(k === t.pick ? 4 : 1, done.size === C.modelPicks.length ? '🎯 you can pick an estimator on purpose' : null);
      };
      opts.appendChild(b);
    });
    root.appendChild(card);
  });
}

function initTraps() {
  const root = $('#ml-traps'); if (!root) return;
  C.mlTraps.forEach(t => root.appendChild(el('div', 'pcard reveal',
    '<h3>' + t.t + '</h3>' +
    '<div class="ct-tag bad">what people write</div><pre class="code">' + esc(t.bad) + '</pre>' +
    '<div class="ct-tag good">what to write instead</div><pre class="code">' + esc(t.good) + '</pre>' +
    '<p class="pcard-desc">' + t.why + '</p>')));
}

function initEco() {
  const tabs = $('#eco-tabs'); if (!tabs) return;
  const groups = ['everything'];
  C.mlEcosystem.forEach(e => { if (!groups.includes(e.g)) groups.push(e.g); });
  groups.forEach((g, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), g);
    b.onclick = () => {
      $$('.chip', tabs).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      techCards('#ml-eco', i ? C.mlEcosystem.filter(e => e.g === g) : C.mlEcosystem);
      xp(1);
    };
    tabs.appendChild(b);
  });
  techCards('#ml-eco', C.mlEcosystem);
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initBackground, initTypes, initBind, initStrings, initSlice, initFstrings,
   initCollRace, initCollTable, initCollTasks, initTrace, initFuncs, initMutDefault,
   initErrors, initTryPatterns, initComp, initFiles, initEnv, initClass,
   initDataStack, initVec, initPandas, initSkApi, initMlPipe, initModelPicks,
   initTraps, initEco, initGotchas, initQuiz].forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
