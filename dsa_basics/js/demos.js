/* ============================================================
   demos.js — every interactive widget.

   The algorithms here are computed live rather than hardcoded:
   traversals, BFS/DFS, sort passes, heap sifts and the Fibonacci
   call tree are all derived from the data in content.js. That is
   deliberate — it means test.js can verify the course is telling
   the truth instead of just checking that strings exist.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = (n, msg) => window.awardXP && window.awardXP(n, msg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const NS = 'http://www.w3.org/2000/svg';

const stat = (v, k, color) =>
  '<div class="stat"><div class="stat-v"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div><div class="stat-k">' + k + '</div></div>';

/* a generic "pick the right answer" drill, reused by five chapters */
function drill(root, cases, options, onDone) {
  if (!root) return;
  const keys = Object.keys(options);
  let done = 0, score = 0;
  cases.forEach(c => {
    const card = el('div', 'sortcard');
    card.appendChild(el('div', 'sortcard-t', esc(c.t)));
    const opts = el('div', 'sortcard-opts');
    keys.forEach(k => {
      const O = options[k];
      const b = el('button', 'sortopt',
        (O.ico ? '<span class="so-ico">' + O.ico + '</span>' : '') +
        '<span class="so-n">' + O.name + '</span>' +
        (O.hint ? '<span class="so-h">' + O.hint + '</span>' : ''));
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = '1'; done++;
        $$('.sortopt', opts).forEach((x, xi) => { x.disabled = true; if (keys[xi] === c.a) x.classList.add('correct'); });
        if (k !== c.a) b.classList.add('incorrect'); else { score++; xp(4); }
        $('.sortcard-why', card).classList.add('show');
        if (done === cases.length && onDone) onDone(score, cases.length);
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);
    card.appendChild(el('div', 'sortcard-why', '<b>' + options[c.a].name + '.</b> ' + c.why));
    root.appendChild(card);
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
      ctx.fillStyle = 'rgba(216,190,255,.48)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20000) {
          ctx.strokeStyle = 'rgba(192,132,252,' + (0.18 * (1 - d2 / 20000)) + ')';
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
    const labels = ['▦', '⇄', '🌳', '🕸️', '🗃️'];
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 15);
      c.setAttribute('fill', 'rgba(16,10,24,.92)');
      c.setAttribute('stroke', ['#c084fc', '#a78bfa', '#a3e635', '#facc15', '#c084fc'][i]);
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', pt.x); t.setAttribute('y', pt.y + 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11');
      t.textContent = labels[i];
      g.appendChild(t);
    }
  }
}

/* ============================================================
   Ch1 — complexity
   ============================================================ */
function initComplexity() {
  const out = $('#growth-out'), slider = $('#growth-n');
  if (!out) return;

  function render() {
    const n = +slider.value;
    $('#growth-n-v').textContent = 'n = ' + n;
    const vals = C.growthClasses.map(g => ({ g, v: g.f(n) }));
    const max = Math.max(...vals.map(x => x.v));
    const fmtv = v => v >= 1e12 ? v.toExponential(1)
      : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M'
      : v >= 1000 ? (v / 1000).toFixed(1) + 'k'
      : v < 10 ? v.toFixed(1) : Math.round(v).toString();

    out.innerHTML = vals.map(({ g, v }) =>
      '<div class="grow"><div class="grow-h"><b style="color:' + g.color + '">' + g.name + '</b>' +
        '<span class="grow-lab">' + g.label + '</span>' +
        '<span class="grow-v mono">' + fmtv(v) + ' steps</span></div>' +
      '<div class="grow-bar"><div class="grow-fill" style="width:' +
        clamp(Math.log10(v + 1) / Math.log10(max + 1) * 100, 1, 100) + '%;background:' + g.color + '"></div></div>' +
      '<div class="grow-m">' + g.means + '<br><i>' + g.eg + '</i></div></div>').join('') +
      '<p class="panel-sub" style="margin-top:12px">Bars are on a <b>log scale</b> — on a linear one the exponential row would be the only thing visible, which is itself the lesson. At n=' + n +
      ', O(log n) does about ' + Math.round(Math.log2(n)) + ' steps and O(2ⁿ) does about ' + fmtv(Math.pow(2, n)) +
      '. Both are "just an algorithm"; only one of them finishes.</p>';
  }
  slider.oninput = render;
  render();

  drill($('#bigo-cases'), C.bigoCases,
    Object.fromEntries(C.growthClasses.map(g => [g.k, { name: g.name, hint: g.label }])),
    (s, t) => xp(10, s >= 5 ? 'You can read growth off a description' : 'Look for the loop structure — nested means multiply'));

  const r = $('#bigo-rules');
  if (r) r.innerHTML = C.bigoRules.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
}

/* ============================================================
   Ch2 — arrays
   ============================================================ */
function initArrays() {
  const mem = $('#memviz');
  if (mem) {
    const BASE = 4000, SIZE = 4;
    const vals = [17, 42, 8, 99, 23, 61, 4, 88];
    mem.innerHTML = vals.map((v, i) =>
      '<div class="cell" data-i="' + i + '"><div class="cell-i">' + i + '</div>' +
      '<div class="cell-v">' + v + '</div>' +
      '<div class="cell-a mono">' + (BASE + i * SIZE) + '</div></div>').join('');
    $$('.cell', mem).forEach(c => c.onclick = () => {
      const i = +c.dataset.i;
      $$('.cell', mem).forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      $('#mem-out').innerHTML =
        '<pre class="code">address = base + index × element_size\n' +
        '        = ' + BASE + ' + ' + i + ' × ' + SIZE + '\n' +
        '        = ' + (BASE + i * SIZE) + '   →  value ' + vals[i] + '</pre>' +
        '<div class="tnote">✅ One multiplication and one addition, whatever the index. That is what <b>O(1) access</b> means — and it is only possible because the elements are contiguous and all the same width. Take away either property and this arithmetic stops working.</div>';
      xp(2);
    });
    $$('.cell', mem)[0].click();
  }

  const shiftBox = $('#shiftviz');
  if (shiftBox) {
    const ops = [
      { k: 'end',    label: 'Append at the end', at: 8, del: false },
      { k: 'front',  label: 'Insert at the front', at: 0, del: false },
      { k: 'mid',    label: 'Insert in the middle', at: 4, del: false },
      { k: 'delfront', label: 'Delete from the front', at: 0, del: true }
    ];
    const tabs = $('#shift-tabs');
    let cur = 0;
    ops.forEach((o, i) => {
      const b = el('button', 'chip' + (i === 0 ? ' active' : ''), o.label);
      b.onclick = () => { cur = i; $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(2); };
      tabs.appendChild(b);
    });
    function render() {
      const o = ops[cur];
      const base = [17, 42, 8, 99, 23, 61, 4, 88];
      const moved = o.del ? base.length - o.at - 1 : base.length - o.at;
      shiftBox.innerHTML =
        '<div class="cellrow">' + base.map((v, i) => {
          const shifts = o.del ? i > o.at : i >= o.at;
          return '<div class="cell sm' + (shifts ? ' shift' : '') + (i === o.at && !o.del ? ' target' : '') +
            (i === o.at && o.del ? ' target' : '') + '"><div class="cell-v">' + v + '</div></div>';
        }).join('') + (o.k === 'end' ? '<div class="cell sm target"><div class="cell-v">+</div></div>' : '') + '</div>' +
        '<div class="stat-row" style="margin-top:14px">' +
          stat(moved, 'elements that must move', moved === 0 ? '#a3e635' : '#fb7185') +
          stat(moved === 0 ? 'O(1)' : 'O(n)', 'cost', moved === 0 ? '#a3e635' : '#fb7185') +
        '</div>' +
        '<div class="tnote' + (moved === 0 ? '' : ' err') + '">' +
          (moved === 0
            ? '✅ Nothing shifts. Write one slot, bump the length. This is the only cheap structural change an array offers — which is why "append" is everywhere and "insert at 0" is a code smell in a loop.'
            : '⚠️ <b>' + moved + ' elements shift</b> to open or close the gap. Contiguity is what makes access O(1), and it is the exact same property that makes this O(n). You cannot have one without the other.') +
        '</div>';
    }
    render();
  }

  const grow = $('#growarr');
  if (grow) {
    let n = 0, cap = 1, copies = 0, history = [];
    function render() {
      const cells = [];
      for (let i = 0; i < cap; i++) cells.push('<div class="cell xs' + (i < n ? ' used' : '') + '"></div>');
      grow.innerHTML = '<div class="cellrow">' + cells.join('') + '</div>' +
        '<div class="stat-row" style="margin-top:12px">' +
          stat(n, 'items') + stat(cap, 'capacity') +
          stat(copies, 'total elements copied', '#fb7185') +
          stat(n ? (copies / n).toFixed(2) : '0.00', 'copies per push', '#a3e635') +
        '</div>' +
        (history.length ? '<div class="tnote">🔁 Resizes so far: <b class="mono">' + history.join(' → ') + '</b>. ' +
          'Each one copies the whole array, which is O(n) — but because the capacity <b>doubles</b>, resizes get exponentially rarer. ' +
          'Total copying across n pushes stays under 2n, so the average cost per push is constant. That is what <b>amortised O(1)</b> means, and it is why growing by a fixed +1 instead of ×2 would make appending quadratic.</div>'
          : '<div class="tnote">Press push a few times and watch the capacity double.</div>');
    }
    $('#grow-push').onclick = () => {
      if (n === cap) { copies += n; cap *= 2; history.push(cap); }
      n++; render(); xp(1);
      if (history.length === 3) xp(5, 'Doubling is what makes append amortised O(1)');
    };
    $('#grow-reset').onclick = () => { n = 0; cap = 1; copies = 0; history = []; render(); };
    render();
  }

  const ops = $('#array-ops');
  if (ops) ops.innerHTML = C.arrayOps.map(o =>
    '<div class="oprow"><span class="op-n">' + o.op + '</span>' +
    '<span class="pill ' + (o.good ? 'good' : 'bad') + ' mono">' + o.cost + '</span>' +
    '<span class="op-w">' + o.why + '</span></div>').join('');

  const f = $('#array-facts');
  if (f) f.innerHTML = C.arrayFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');

  const d = $('#array-def');
  if (d) d.textContent = C.arrayDef;
}

/* ============================================================
   Ch3 — strings
   ============================================================ */
/* UTF-8 byte length, computed directly — no TextEncoder dependency */
function utf8Len(s) {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

function initStrings() {
  const inp = $('#str-input'), out = $('#str-out');
  if (inp) {
    function render() {
      const s = inp.value;
      const chars = Array.from(s);                 // splits by code point, not code unit
      const units = s.length;                      // what .length actually reports
      const bytes = utf8Len(s);
      out.innerHTML =
        '<div class="charrow">' + chars.slice(0, 40).map((c, i) =>
          '<div class="charbox"><div class="cb-c">' + esc(c === ' ' ? '␣' : c) + '</div>' +
          '<div class="cb-i mono">' + i + '</div></div>').join('') +
          (chars.length > 40 ? '<div class="charbox more">…</div>' : '') + '</div>' +
        '<div class="stat-row" style="margin-top:14px">' +
          stat(chars.length, 'characters (code points)') +
          stat(units, '.length reports', units !== chars.length ? '#fb7185' : null) +
          stat(bytes, 'bytes in UTF-8', bytes !== units ? '#facc15' : null) +
        '</div>' +
        '<div class="tnote' + (units !== chars.length ? ' err' : '') + '">' +
          (units !== chars.length
            ? '💥 <b>.length disagrees with what you can see.</b> Some of these characters need two UTF-16 code units, so <span class="mono">.length</span> counts them twice. Indexing, slicing and reversing by that unit will split a character in half and produce mojibake. This is the single most common string bug in internationalised software.'
            : bytes !== units
              ? '⚠️ <b>Characters are not bytes.</b> These fit in one code unit each, but UTF-8 needs ' + bytes + ' bytes to store them. Anything that budgets storage or network in "characters" is wrong by a factor that depends on the language.'
              : '✅ Plain ASCII: one character, one code unit, one byte. This is the case everything is accidentally designed for — try typing an accent or an emoji.') +
        '</div>';
    }
    inp.oninput = render;
    $$('#str-samples .chip').forEach(b => b.onclick = () => { inp.value = b.dataset.s; render(); xp(2); });
    render();
  }

  const cc = $('#concat-out'), cn = $('#concat-n');
  if (cc) {
    function render() {
      const n = +cn.value;
      $('#concat-n-v').textContent = n + ' pieces';
      // naive: each += copies everything built so far
      let naive = 0;
      for (let i = 1; i <= n; i++) naive += i;
      const builder = n;                            // one copy each, into a growing buffer
      const max = Math.max(naive, builder);
      cc.innerHTML =
        '<div class="cmp"><div class="cmp-l">s = s + piece  <span class="mono">(naive)</span></div>' +
          '<div class="cmp-bar"><div class="cmp-fill bad" style="width:' + (naive / max * 100) + '%"></div></div>' +
          '<div class="cmp-n mono">' + naive.toLocaleString() + ' copies</div></div>' +
        '<div class="cmp"><div class="cmp-l">parts.append + join <span class="mono">(builder)</span></div>' +
          '<div class="cmp-bar"><div class="cmp-fill good" style="width:' + (builder / max * 100) + '%"></div></div>' +
          '<div class="cmp-n mono">' + builder.toLocaleString() + ' copies</div></div>' +
        '<div class="stat-row" style="margin-top:14px">' +
          stat((naive / builder).toFixed(0) + '×', 'more work, naive vs builder', '#fb7185') +
          stat('O(n²)', 'naive', '#fb7185') +
          stat('O(n)', 'builder', '#a3e635') +
        '</div>' +
        '<div class="tnote">💡 Because strings are <b>immutable</b>, <span class="mono">s = s + piece</span> cannot extend anything — it allocates a new string and copies the old one in. Doing that ' + n +
        ' times copies 1 + 2 + … + ' + n + ' = ' + naive.toLocaleString() + ' characters. Collecting the pieces and joining once copies each piece exactly once. Same output, different complexity class.</div>';
    }
    cn.oninput = render;
    render();
  }

  const so = $('#str-ops');
  if (so) so.innerHTML = C.strOps.map(o =>
    '<div class="oprow"><span class="op-n">' + o.op + '</span>' +
    '<span class="pill mono">' + o.cost + '</span>' +
    '<span class="op-w">' + o.note + '</span></div>').join('');

  const f = $('#string-facts');
  if (f) f.innerHTML = C.stringFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');

  const d = $('#string-def');
  if (d) d.textContent = C.stringDef;
}

/* ============================================================
   Ch4 — linked lists
   ============================================================ */
function initList() {
  const viz = $('#listviz'); if (!viz) return;
  let nodes = [17, 42, 8], counter = 100;
  let msg = '';

  function render(highlight) {
    viz.innerHTML =
      '<div class="lnodes"><div class="lhead">head</div><div class="larrow">→</div>' +
      nodes.map((v, i) =>
        '<div class="lnode' + (highlight === i ? ' on' : '') + '">' +
          '<div class="ln-v">' + v + '</div><div class="ln-p mono">next</div></div>' +
        '<div class="larrow">→</div>').join('') +
      '<div class="lnull mono">null</div></div>' +
      (msg ? '<div class="tnote">' + msg + '</div>' : '');
  }

  $('#l-head').onclick = () => {
    nodes.unshift(counter++);
    msg = '✅ <b>Insert at head — O(1).</b> Make a new node, point its <span class="mono">next</span> at the old head, move the head pointer. Two writes, and nothing else in the list is touched. An array would have shifted every element right.';
    render(0); xp(2);
  };
  $('#l-tail').onclick = () => {
    nodes.push(counter++);
    msg = '⚠️ <b>Insert at tail — O(n)</b> unless you keep a tail pointer. Without one you must walk all ' + (nodes.length - 1) +
      ' existing nodes to find the end, because there is no way to jump there. This is why most real list implementations track the tail.';
    render(nodes.length - 1); xp(2);
  };
  $('#l-del').onclick = () => {
    if (!nodes.length) return;
    nodes.shift();
    msg = '✅ <b>Delete head — O(1).</b> Point head at the second node. The old first node is now unreachable and gets collected. One write.';
    render(0); xp(2);
  };
  $('#l-walk').onclick = () => {
    const target = Math.min(3, nodes.length - 1);
    if (target < 0) return;
    let step = 0;
    msg = '⚠️ <b>Reaching index ' + target + ' — O(n).</b> There is no address arithmetic here: the nodes can live anywhere in memory, so the only way to reach the ' +
      (target + 1) + 'th is to follow ' + target + ' pointers from the head. This is the price of cheap insertion.';
    const t = setInterval(() => {
      render(step);
      if (step++ >= target) clearInterval(t);
    }, 320);
    xp(3);
  };
  $('#l-reset').onclick = () => { nodes = [17, 42, 8]; counter = 100; msg = ''; render(); };
  render();

  const k = $('#list-kinds');
  if (k) k.innerHTML = C.listKinds.map(x =>
    '<div class="pcard"><div class="pcard-badge">' + x.ico + '</div><h3>' + x.n + '</h3>' +
    '<p class="pcard-desc">' + x.desc + '</p>' +
    '<div class="deflist"><b>Memory</b><span>' + x.cost + '</span><b>Why it exists</b><span>' + x.catch + '</span></div></div>').join('');

  const t = $('#list-vs-array');
  if (t) t.innerHTML =
    '<div class="cmptab cmptab-h"><b>Operation</b><b>Array</b><b>Linked list</b><b>Why</b></div>' +
    C.listVsArray.map(r =>
      '<div class="cmptab"><b>' + r[0] + '</b>' +
      '<span class="mono ' + (r[3] === 'array' ? 'win' : r[3] === 'list' ? 'lose' : '') + '">' + r[1] + '</span>' +
      '<span class="mono ' + (r[3] === 'list' ? 'win' : r[3] === 'array' ? 'lose' : '') + '">' + r[2] + '</span>' +
      '<span>' + r[4] + '</span></div>').join('');

  const d = $('#node-def'); if (d) d.textContent = C.nodeDef;
  const d2 = $('#list-def'); if (d2) d2.textContent = C.listDef;
}

/* ============================================================
   Ch5 — stacks and queues
   ============================================================ */
function initStackQueue() {
  const sv = $('#sq-stack'), qv = $('#sq-queue');
  if (sv) {
    let stack = [], queue = [], next = 1, log = [];

    function render() {
      sv.innerHTML = '<div class="sq-title">Stack — LIFO</div><div class="sq-body stack">' +
        (stack.length ? stack.slice().reverse().map((v, i) =>
          '<div class="sq-item' + (i === 0 ? ' top' : '') + '">' + v + (i === 0 ? ' <span class="sq-tag">top</span>' : '') + '</div>').join('')
          : '<div class="sq-empty">empty</div>') + '</div>';
      qv.innerHTML = '<div class="sq-title">Queue — FIFO</div><div class="sq-body queue">' +
        (queue.length ? queue.map((v, i) =>
          '<div class="sq-item' + (i === 0 ? ' top' : '') + '">' + v + (i === 0 ? ' <span class="sq-tag">front</span>' : '') + '</div>').join('')
          : '<div class="sq-empty">empty</div>') + '</div>';
      $('#sq-log').innerHTML = log.length
        ? log.slice(-6).map(l => '<div class="trace ' + l.c + '"><span class="tk">' + l.t + '</span>' + l.m + '</div>').join('')
        : '<p class="panel-sub">Add the same items to both, then remove from both. The order they come back out is the entire difference.</p>';
    }
    $('#sq-add').onclick = () => {
      stack.push(next); queue.push(next);
      log.push({ c: 'act', t: 'add ' + next, m: 'Pushed ' + next + ' onto the stack and enqueued ' + next + ' — both now hold the same items in the same insertion order.' });
      next++; render(); xp(1);
    };
    $('#sq-take').onclick = () => {
      if (!stack.length) return;
      const s = stack.pop(), q = queue.shift();
      log.push({ c: s === q ? 'act' : 'observe', t: 'remove',
        m: 'Stack returned <b>' + s + '</b> (the newest). Queue returned <b>' + q + '</b> (the oldest).' +
           (s !== q ? ' Same inputs, different answers — that is LIFO vs FIFO, and it is the only difference between them.' : '') });
      render(); xp(2);
      if (s !== q) xp(4, 'Same items in, different items out — that is the whole distinction');
    };
    $('#sq-reset').onclick = () => { stack = []; queue = []; next = 1; log = []; render(); };
    render();
  }

  drill($('#sq-cases'), C.sqCases,
    { stack: { name: 'Stack (LIFO)', ico: '⬓' }, queue: { name: 'Queue (FIFO)', ico: '⇥' } },
    (s, t) => xp(10, s >= 5 ? 'You can hear LIFO and FIFO in a requirement' : 'Ask: does the newest or the oldest go first?'));

  const v = $('#sq-variants');
  if (v) v.innerHTML = C.sqVariants.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');

  const d = $('#stack-def'); if (d) d.textContent = C.stackDef;
  const d2 = $('#queue-def'); if (d2) d2.textContent = C.queueDef;
}

/* ============================================================
   Ch6 — hash tables
   ============================================================ */
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initHash() {
  const view = $('#hash-view'); if (!view) return;
  const nb = $('#hash-buckets');
  let inserted = [];

  function render(lastKey) {
    const n = +nb.value;
    $('#hash-buckets-v').textContent = n + ' buckets';
    const buckets = Array.from({ length: n }, () => []);
    inserted.forEach(k => buckets[hashCode(k) % n].push(k));
    const load = inserted.length / n;
    const collisions = buckets.filter(b => b.length > 1).reduce((a, b) => a + b.length - 1, 0);

    view.innerHTML =
      '<div class="buckets">' + buckets.map((b, i) =>
        '<div class="bucket' + (b.length > 1 ? ' clash' : '') + (b.some(k => k === lastKey) ? ' on' : '') + '">' +
          '<div class="bk-i mono">' + i + '</div>' +
          '<div class="bk-items">' + (b.length
            ? b.map(k => '<span class="bk-item' + (k === lastKey ? ' new' : '') + '">' + esc(k) + '</span>').join('<span class="bk-link">→</span>')
            : '<span class="bk-empty">—</span>') + '</div></div>').join('') + '</div>' +
      '<div class="stat-row" style="margin-top:14px">' +
        stat(inserted.length, 'keys stored') +
        stat(load.toFixed(2), 'load factor', load > 0.7 ? '#fb7185' : '#a3e635') +
        stat(collisions, 'collisions', collisions ? '#facc15' : '#a3e635') +
        stat(Math.max(1, ...buckets.map(b => b.length)), 'longest chain', Math.max(1, ...buckets.map(b => b.length)) > 2 ? '#fb7185' : '#a3e635') +
      '</div>' +
      (lastKey ? '<pre class="code">hash("' + esc(lastKey) + '") = ' + hashCode(lastKey) + '\n' +
        hashCode(lastKey) + ' % ' + n + ' = bucket ' + (hashCode(lastKey) % n) + '</pre>' : '') +
      '<div class="tnote' + (load > 0.7 ? ' err' : '') + '">' +
        (load > 0.7
          ? '⚠️ <b>Load factor ' + load.toFixed(2) + ' is past the usual 0.7 threshold.</b> Chains are getting long and lookups are drifting away from O(1). A real hash table would resize now: allocate a bigger array and rehash every key. That single insert is O(n) — but because it happens rarely, the average stays constant. Drag the bucket slider up to see what resizing buys.'
          : collisions
            ? '💡 <b>' + collisions + ' collision' + (collisions === 1 ? '' : 's') + '.</b> Different keys, same bucket — inevitable, because infinitely many keys map into finitely many buckets. Here they are <i>chained</i> into a small list. Finding a key in a chain of k costs O(k), which is why keeping chains short is the whole game.'
            : '✅ <b>No collisions yet.</b> Each key hashes to its own bucket, so lookup is one hash plus one array access — genuinely O(1). Add more keys, or shrink the table, and watch that fall apart.') +
      '</div>';
  }

  const kb = $('#hash-keys');
  C.hashKeys.forEach(k => {
    const b = el('button', 'chip', k);
    b.onclick = () => {
      if (inserted.includes(k)) return;
      inserted.push(k); render(k); xp(2);
      if (inserted.length === 4) xp(4, 'Watch the load factor as you add more');
    };
    kb.appendChild(b);
  });
  nb.oninput = () => render();
  $('#hash-reset').onclick = () => { inserted = []; render(); };
  render();

  const f = $('#hash-facts');
  if (f) f.innerHTML = C.hashFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const d = $('#hash-def'); if (d) d.textContent = C.hashDef;
}

/* ============================================================
   Ch7 — trees
   ============================================================ */
function bstInsert(root, v) {
  if (!root) return { v: v, l: null, r: null };
  if (v < root.v) root.l = bstInsert(root.l, v);
  else if (v > root.v) root.r = bstInsert(root.r, v);
  return root;
}
function buildBst(values) { let root = null; values.forEach(v => root = bstInsert(root, v)); return root; }
function treeHeight(n) { return n ? 1 + Math.max(treeHeight(n.l), treeHeight(n.r)) : 0; }
function traverse(root, kind) {
  const out = [];
  if (kind === 'level') {
    const q = root ? [root] : [];
    while (q.length) { const n = q.shift(); out.push(n.v); if (n.l) q.push(n.l); if (n.r) q.push(n.r); }
    return out;
  }
  (function walk(n) {
    if (!n) return;
    if (kind === 'preorder') out.push(n.v);
    walk(n.l);
    if (kind === 'inorder') out.push(n.v);
    walk(n.r);
    if (kind === 'postorder') out.push(n.v);
  })(root);
  return out;
}
/* lay out by in-order position (x) and depth (y) so nothing overlaps */
function layout(root) {
  const nodes = [];
  let x = 0;
  (function walk(n, depth) {
    if (!n) return;
    walk(n.l, depth + 1);
    nodes.push({ v: n.v, x: x++, y: depth, node: n });
    walk(n.r, depth + 1);
  })(root, 0);
  const w = Math.max(1, x - 1), h = Math.max(1, treeHeight(root) - 1);
  nodes.forEach(n => {
    n.px = 8 + (w ? n.x / w : 0.5) * 84;
    n.py = 10 + (h ? n.y / h : 0) * 78;
  });
  const map = new Map(nodes.map(n => [n.node, n]));
  const edges = [];
  nodes.forEach(n => {
    if (n.node.l) edges.push([n, map.get(n.node.l)]);
    if (n.node.r) edges.push([n, map.get(n.node.r)]);
  });
  return { nodes, edges };
}

function initTree() {
  const svg = $('#tree-svg'); if (!svg) return;
  let balanced = true, order = [], step = -1, timer = null, kind = 'inorder';

  function root() { return buildBst(balanced ? C.bstInserts : C.degenerateInserts); }

  function draw() {
    const r = root();
    const { nodes, edges } = layout(r);
    svg.innerHTML = '';
    edges.forEach(([a, b]) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', a.px); l.setAttribute('y1', a.py);
      l.setAttribute('x2', b.px); l.setAttribute('y2', b.py);
      l.setAttribute('stroke', 'rgba(255,255,255,.25)'); l.setAttribute('stroke-width', '.6');
      svg.appendChild(l);
    });
    const visited = new Set(order.slice(0, step + 1));
    const current = step >= 0 ? order[step] : null;
    nodes.forEach(n => {
      const on = n.v === current, seen = visited.has(n.v);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', n.px); c.setAttribute('cy', n.py); c.setAttribute('r', 6);
      c.setAttribute('fill', on ? 'rgba(163,230,53,.85)' : seen ? 'rgba(192,132,252,.4)' : 'rgba(18,12,26,.95)');
      c.setAttribute('stroke', on ? '#a3e635' : seen ? '#c084fc' : 'rgba(255,255,255,.3)');
      c.setAttribute('stroke-width', on ? '1.1' : '.55');
      svg.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', n.px); t.setAttribute('y', n.py + 2);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '4');
      t.setAttribute('fill', on ? '#10160a' : '#e8eaf3');
      t.textContent = n.v;
      svg.appendChild(t);
    });

    const h = treeHeight(r);
    $('#tree-stats').innerHTML =
      stat(C.bstInserts.length, 'nodes') +
      stat(h, 'height', balanced ? '#a3e635' : '#fb7185') +
      stat('O(' + h + ')', 'worst-case search', balanced ? '#a3e635' : '#fb7185') +
      stat(balanced ? '≈ log n' : '= n', 'height grows as', balanced ? '#a3e635' : '#fb7185');

    $('#tree-note').innerHTML = balanced
      ? '✅ <b>Inserted in a mixed order</b> (' + C.bstInserts.join(', ') + '), so the tree spread out. Height ' + h + ' for ' + C.bstInserts.length + ' nodes, and search halves the remaining nodes at every step.'
      : '💥 <b>Inserted already sorted</b> (' + C.degenerateInserts.join(', ') + '). Every value is larger than the last, so each becomes the right child of the one before — a linked list wearing a tree costume. Search is now O(n), and nothing about the BST rule was violated. This is precisely why self-balancing trees (AVL, red-black) exist.';
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function run(k) {
    stop(); kind = k; order = traverse(root(), k); step = -1;
    $$('#tree-traversals .chip').forEach(c => c.classList.toggle('active', c.dataset.k === k));
    timer = setInterval(() => {
      step++;
      if (step >= order.length) { stop(); step = order.length - 1; }
      draw(); paintOrder();
    }, 420);
    xp(3);
  }
  function paintOrder() {
    const T = C.traversals.find(t => t.k === kind);
    $('#tree-order').innerHTML =
      '<div class="lab-pane-title">' + T.name + ' — ' + T.order + '</div>' +
      '<div class="orderrow">' + order.map((v, i) =>
        '<span class="ob' + (i <= step ? ' on' : '') + '">' + v + '</span>').join('') + '</div>' +
      '<div class="tnote">' + T.use +
        (kind === 'inorder' ? ' <b>Notice the sequence is sorted</b> — that is not a coincidence, it falls straight out of the BST rule.' : '') + '</div>';
  }

  const tb = $('#tree-traversals');
  C.traversals.forEach(t => {
    const b = el('button', 'chip' + (t.k === 'inorder' ? ' active' : ''), t.name);
    b.dataset.k = t.k;
    b.onclick = () => run(t.k);
    tb.appendChild(b);
  });
  $('#tree-shape').onclick = e => {
    balanced = !balanced;
    e.target.textContent = balanced ? '🌳 Now insert them sorted instead' : '🌳 Back to mixed insertion order';
    order = []; step = -1; stop(); draw();
    $('#tree-order').innerHTML = '<p class="panel-sub">Pick a traversal above.</p>';
    xp(4, balanced ? '' : 'Sorted input degenerates a BST into a list');
  };
  draw();
  $('#tree-order').innerHTML = '<p class="panel-sub">Pick a traversal above and watch the visit order build up.</p>';
  window.addEventListener('chapterchange', e => { if (e.detail === 'trees') draw(); });

  const t = $('#tree-terms');
  if (t) t.innerHTML = C.treeTerms.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const k = $('#tree-kinds');
  if (k) k.innerHTML = C.treeKinds.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const d = $('#tree-def'); if (d) d.textContent = C.treeDef;
}

/* ============================================================
   Ch8 — heaps
   ============================================================ */
function siftUp(a, i, log) {
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (a[p] <= a[i]) break;
    log.push('swap ' + a[i] + ' up past parent ' + a[p]);
    [a[p], a[i]] = [a[i], a[p]];
    i = p;
  }
}
function siftDown(a, i, log) {
  for (;;) {
    const l = 2 * i + 1, r = 2 * i + 2;
    let m = i;
    if (l < a.length && a[l] < a[m]) m = l;
    if (r < a.length && a[r] < a[m]) m = r;
    if (m === i) break;
    log.push('swap ' + a[i] + ' down past child ' + a[m]);
    [a[i], a[m]] = [a[m], a[i]];
    i = m;
  }
}

function initHeap() {
  const svg = $('#heap-svg'); if (!svg) return;
  let heap = [], idx = 0, log = [];
  /* seed a few values so the tree is visible before any button is pressed */
  function seed() {
    heap = []; idx = 0; log = [];
    while (idx < 3) { heap.push(C.heapInserts[idx++]); siftUp(heap, heap.length - 1, []); }
  }

  function draw(hot) {
    svg.innerHTML = '';
    const depth = Math.max(1, Math.floor(Math.log2(heap.length || 1)) + 1);
    const pos = heap.map((v, i) => {
      const lvl = Math.floor(Math.log2(i + 1));
      const inLvl = i - (Math.pow(2, lvl) - 1);
      const count = Math.pow(2, lvl);
      return { v, i, x: (inLvl + 0.5) / count * 92 + 4, y: 12 + (depth > 1 ? lvl / (depth - 1) : 0) * 74 };
    });
    pos.forEach(p => {
      const par = (p.i - 1) >> 1;
      if (p.i > 0 && pos[par]) {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', pos[par].x); l.setAttribute('y1', pos[par].y);
        l.setAttribute('x2', p.x); l.setAttribute('y2', p.y);
        l.setAttribute('stroke', 'rgba(255,255,255,.25)'); l.setAttribute('stroke-width', '.6');
        svg.appendChild(l);
      }
    });
    pos.forEach(p => {
      const on = hot === p.i;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 6);
      c.setAttribute('fill', p.i === 0 ? 'rgba(163,230,53,.8)' : on ? 'rgba(192,132,252,.6)' : 'rgba(18,12,26,.95)');
      c.setAttribute('stroke', p.i === 0 ? '#a3e635' : '#c084fc'); c.setAttribute('stroke-width', p.i === 0 ? '1.1' : '.55');
      svg.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', p.x); t.setAttribute('y', p.y + 2);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '4');
      t.setAttribute('fill', p.i === 0 ? '#10160a' : '#e8eaf3');
      t.textContent = p.v;
      svg.appendChild(t);
    });

    $('#heap-array').innerHTML =
      '<div class="lab-pane-title">the same heap, as a flat array</div>' +
      '<div class="cellrow">' + heap.map((v, i) =>
        '<div class="cell sm' + (i === 0 ? ' target' : '') + '"><div class="cell-i">' + i + '</div><div class="cell-v">' + v + '</div></div>').join('') + '</div>' +
      '<pre class="code">left child of i  = 2i + 1\nright child of i = 2i + 2\nparent of i      = (i - 1) / 2</pre>' +
      '<div class="stat-row" style="margin-top:12px">' +
        stat(heap.length ? heap[0] : '—', 'minimum (peek)', '#a3e635') +
        stat('O(1)', 'cost to peek', '#a3e635') +
        stat(Math.max(0, Math.ceil(Math.log2(heap.length + 1)) - 1), 'height') +
        stat('O(log n)', 'insert / extract') +
      '</div>' +
      (log.length ? '<div class="tnote">🔧 ' + log.join(' · ') + '</div>' : '');
  }

  $('#heap-insert').onclick = () => {
    if (idx >= C.heapInserts.length) return;
    const v = C.heapInserts[idx++];
    heap.push(v);
    log = ['inserted ' + v + ' at the end'];
    siftUp(heap, heap.length - 1, log);
    log.push(log.length > 1 ? 'sifted up ' + (log.length - 2) + ' level(s)' : 'no sift needed — it was already in place');
    draw(heap.indexOf(v)); xp(2);
    if (idx === C.heapInserts.length) xp(5, 'Note the tree is never sorted — only parent-beats-child holds');
  };
  $('#heap-extract').onclick = () => {
    if (!heap.length) return;
    const min = heap[0];
    const last = heap.pop();
    log = ['removed the minimum (' + min + ') from the root'];
    if (heap.length) { heap[0] = last; log.push('moved ' + last + ' from the end to the root'); siftDown(heap, 0, log); }
    draw(0); xp(2);
  };
  $('#heap-reset').onclick = () => { seed(); draw(); };
  seed();
  draw();
  window.addEventListener('chapterchange', e => { if (e.detail === 'heaps') draw(); });

  const f = $('#heap-facts');
  if (f) f.innerHTML = C.heapFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const d = $('#heap-def'); if (d) d.textContent = C.heapDef;
}

/* ============================================================
   Ch9 — graphs
   ============================================================ */
function adjacency() {
  const adj = {};
  C.graphNodes.forEach(n => adj[n] = []);
  C.graphEdges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  Object.keys(adj).forEach(k => adj[k].sort());
  return adj;
}
function bfs(start) {
  const adj = adjacency(), seen = new Set([start]), q = [start], order = [], steps = [];
  while (q.length) {
    const n = q.shift();
    order.push(n);
    const added = [];
    adj[n].forEach(m => { if (!seen.has(m)) { seen.add(m); q.push(m); added.push(m); } });
    steps.push({ node: n, frontier: q.slice(), visited: order.slice(), added });
  }
  return { order, steps };
}
function dfs(start) {
  const adj = adjacency(), seen = new Set(), order = [], steps = [], stack = [start];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n); order.push(n);
    const added = adj[n].filter(m => !seen.has(m));
    // push in reverse so the alphabetically-first neighbour is explored next
    added.slice().reverse().forEach(m => stack.push(m));
    steps.push({ node: n, frontier: stack.slice(), visited: order.slice(), added });
  }
  return { order, steps };
}

function initGraph() {
  const svg = $('#graph-svg'); if (!svg) return;
  let algo = 'bfs', run = bfs('A'), step = -1, timer = null;

  function draw() {
    svg.innerHTML = '';
    const cur = step >= 0 ? run.steps[step] : null;
    const visited = new Set(cur ? cur.visited : []);
    const frontier = new Set(cur ? cur.frontier : []);
    C.graphEdges.forEach(([a, b]) => {
      const [ax, ay] = C.graphPos[a], [bx, by] = C.graphPos[b];
      const lit = visited.has(a) && visited.has(b);
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', ax); l.setAttribute('y1', ay);
      l.setAttribute('x2', bx); l.setAttribute('y2', by);
      l.setAttribute('stroke', lit ? '#c084fc' : 'rgba(255,255,255,.22)');
      l.setAttribute('stroke-width', lit ? '.9' : '.55');
      svg.appendChild(l);
    });
    C.graphNodes.forEach(n => {
      const [x, y] = C.graphPos[n];
      const isCur = cur && cur.node === n;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 7);
      c.setAttribute('fill', isCur ? 'rgba(163,230,53,.85)' : visited.has(n) ? 'rgba(192,132,252,.45)'
        : frontier.has(n) ? 'rgba(250,204,21,.3)' : 'rgba(18,12,26,.95)');
      c.setAttribute('stroke', isCur ? '#a3e635' : visited.has(n) ? '#c084fc' : frontier.has(n) ? '#facc15' : 'rgba(255,255,255,.32)');
      c.setAttribute('stroke-width', isCur ? '1.2' : '.6');
      svg.appendChild(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y + 2.2);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '5');
      t.setAttribute('fill', isCur ? '#10160a' : '#e8eaf3');
      t.textContent = n;
      svg.appendChild(t);
    });

    const structName = algo === 'bfs' ? 'queue' : 'stack';
    $('#graph-log').innerHTML = cur
      ? '<div class="lab-pane-title">' + (algo === 'bfs' ? 'BFS' : 'DFS') + ' from A — step ' + (step + 1) + ' of ' + run.steps.length + '</div>' +
        '<div class="trace act"><span class="tk">visiting</span><b>' + cur.node + '</b>' +
          (cur.added.length ? ' — discovered ' + cur.added.join(', ') + ', added to the ' + structName : ' — no new neighbours') + '</div>' +
        '<div class="kv"><span>visited so far</span><b class="mono">' + cur.visited.join(' → ') + '</b></div>' +
        '<div class="kv"><span>' + structName + ' now holds</span><b class="mono">' + (cur.frontier.join(', ') || 'empty') + '</b></div>' +
        (step === run.steps.length - 1
          ? '<div class="tnote">' + (algo === 'bfs'
            ? '✅ <b>BFS finished:</b> ' + run.order.join(' → ') + '. It reached everything one edge away before anything two edges away — which is exactly why the first time BFS reaches a node, it has reached it by a <b>shortest path</b>. That guarantee is what makes it the answer for unweighted shortest paths.'
            : '✅ <b>DFS finished:</b> ' + run.order.join(' → ') + '. It dived as deep as it could before backtracking. No shortest-path guarantee at all — but it is the natural fit for cycle detection, topological sort and "explore every path".') + '</div>'
          : '')
      : '<p class="panel-sub">Press <b>Step</b>. Green is the node being visited, purple is already visited, yellow is waiting in the ' + structName + '.</p>';

    $('#graph-count').textContent = step < 0 ? 'not started' : 'step ' + (step + 1) + ' / ' + run.steps.length;
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; $('#graph-auto').textContent = '▶ Run it'; } }
  function reset(a) {
    stop(); algo = a; run = a === 'bfs' ? bfs('A') : dfs('A'); step = -1;
    $$('#graph-algo .chip').forEach(c => c.classList.toggle('active', c.dataset.a === a));
    draw();
  }
  const ab = $('#graph-algo');
  [['bfs', 'BFS (queue)'], ['dfs', 'DFS (stack)']].forEach(([k, n], i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), n);
    b.dataset.a = k;
    b.onclick = () => { reset(k); xp(3); };
    ab.appendChild(b);
  });
  $('#graph-step').onclick = () => { if (step < run.steps.length - 1) { step++; draw(); xp(1); } };
  $('#graph-auto').onclick = e => {
    if (timer) return stop();
    e.target.textContent = '⏸ Pause';
    timer = setInterval(() => { if (step < run.steps.length - 1) { step++; draw(); } else stop(); }, 700);
  };
  $('#graph-reset').onclick = () => reset(algo);
  reset('bfs');
  window.addEventListener('chapterchange', e => { if (e.detail === 'graphs') draw(); });

  /* representations */
  const rep = $('#graph-rep-out'), rt = $('#graph-rep');
  let repKind = 'list';
  C.graphReps.forEach((r, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), r.ico + ' ' + r.name);
    b.onclick = () => { repKind = r.k; $$('.chip', rt).forEach(c => c.classList.remove('active')); b.classList.add('active'); paintRep(); xp(2); };
    rt.appendChild(b);
  });
  function paintRep() {
    const adj = adjacency();
    const R = C.graphReps.find(r => r.k === repKind);
    let body;
    if (repKind === 'list') {
      body = '<div class="adjlist">' + C.graphNodes.map(n =>
        '<div class="adjrow"><b>' + n + '</b><span class="mono">→ ' + adj[n].join(', ') + '</span></div>').join('') + '</div>';
    } else {
      body = '<div class="matrix"><div class="mcell hdr"></div>' +
        C.graphNodes.map(n => '<div class="mcell hdr">' + n + '</div>').join('') +
        C.graphNodes.map(a => '<div class="mcell hdr">' + a + '</div>' +
          C.graphNodes.map(b => {
            const on = adj[a].includes(b);
            return '<div class="mcell' + (on ? ' on' : '') + '">' + (on ? 1 : 0) + '</div>';
          }).join('')).join('') + '</div>';
    }
    const cells = C.graphNodes.length * C.graphNodes.length;
    const used = C.graphEdges.length * 2;
    rep.innerHTML = body +
      '<div class="stat-row" style="margin-top:14px">' +
        stat(R.space, 'space') + stat(R.neighbours, 'list neighbours') + stat(R.hasEdge, 'is there an edge?') +
        (repKind === 'matrix' ? stat(Math.round((1 - used / cells) * 100) + '%', 'of the matrix is zeros', '#fb7185') : stat(used, 'entries stored', '#a3e635')) +
      '</div>' +
      '<div class="two-up" style="margin-top:14px">' +
        '<div class="callout"><div class="callout-ico">✅</div><div>' + R.good + '</div></div>' +
        '<div class="callout warn"><div class="callout-ico">⚠️</div><div>' + R.bad + '</div></div>' +
      '</div>';
  }
  paintRep();

  const t = $('#graph-terms');
  if (t) t.innerHTML = C.graphTerms.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const a = $('#graph-algos');
  if (a) a.innerHTML = C.graphAlgos.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const d = $('#graph-def'); if (d) d.textContent = C.graphDef;
}

/* ============================================================
   Ch10 — sorting and searching
   ============================================================ */
function sortFrames(kind, input) {
  const a = input.slice(), frames = [];
  let cmp = 0, swaps = 0;
  const snap = (hi, note) => { if (frames.length < 400) frames.push({ a: a.slice(), hi: hi.slice(), cmp, swaps, note }); };
  snap([], 'start');

  if (kind === 'bubble') {
    for (let i = 0; i < a.length; i++) {
      let moved = false;
      for (let j = 0; j < a.length - i - 1; j++) {
        cmp++;
        if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; swaps++; moved = true; }
        snap([j, j + 1], 'compare adjacent');
      }
      if (!moved) break;
    }
  } else if (kind === 'selection') {
    for (let i = 0; i < a.length; i++) {
      let m = i;
      for (let j = i + 1; j < a.length; j++) { cmp++; if (a[j] < a[m]) m = j; snap([i, j], 'scanning for the minimum'); }
      if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; swaps++; }
      snap([i], 'swap the minimum into place');
    }
  } else if (kind === 'insertion') {
    for (let i = 1; i < a.length; i++) {
      const v = a[i]; let j = i - 1;
      while (j >= 0) { cmp++; if (a[j] <= v) break; a[j + 1] = a[j]; swaps++; j--; snap([j + 1, i], 'sliding back'); }
      a[j + 1] = v;
      snap([j + 1], 'placed');
    }
  } else if (kind === 'merge') {
    (function ms(lo, hi) {
      if (hi - lo < 2) return;
      const mid = (lo + hi) >> 1;
      ms(lo, mid); ms(mid, hi);
      const tmp = [];
      let i = lo, j = mid;
      while (i < mid && j < hi) { cmp++; tmp.push(a[i] <= a[j] ? a[i++] : a[j++]); }
      while (i < mid) tmp.push(a[i++]);
      while (j < hi) tmp.push(a[j++]);
      for (let k = 0; k < tmp.length; k++) { a[lo + k] = tmp[k]; swaps++; }
      snap(Array.from({ length: hi - lo }, (_, k) => lo + k), 'merged [' + lo + ',' + hi + ')');
    })(0, a.length);
  } else if (kind === 'quick') {
    (function qs(lo, hi) {
      if (lo >= hi) return;
      const pivot = a[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        cmp++;
        if (a[j] < pivot) { [a[i], a[j]] = [a[j], a[i]]; swaps++; i++; }
        snap([j, hi], 'partition around pivot ' + pivot);
      }
      [a[i], a[hi]] = [a[hi], a[i]]; swaps++;
      snap([i], 'pivot ' + pivot + ' is now in its final place');
      qs(lo, i - 1); qs(i + 1, hi);
    })(0, a.length - 1);
  } else if (kind === 'heap') {
    const log = [];
    for (let i = (a.length >> 1) - 1; i >= 0; i--) {
      // max-heapify so extraction fills from the back and leaves ascending order
      (function down(k) {
        for (;;) {
          const l = 2 * k + 1, r = 2 * k + 2; let m = k;
          if (l < a.length && (cmp++, a[l] > a[m])) m = l;
          if (r < a.length && (cmp++, a[r] > a[m])) m = r;
          if (m === k) break;
          [a[k], a[m]] = [a[m], a[k]]; swaps++; k = m;
        }
      })(i);
      snap([i], 'building the heap');
    }
    for (let end = a.length - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]]; swaps++;
      snap([0, end], 'extract the max to position ' + end);
      (function down(k, lim) {
        for (;;) {
          const l = 2 * k + 1, r = 2 * k + 2; let m = k;
          if (l < lim && (cmp++, a[l] > a[m])) m = l;
          if (r < lim && (cmp++, a[r] > a[m])) m = r;
          if (m === k) break;
          [a[k], a[m]] = [a[m], a[k]]; swaps++; k = m;
        }
      })(0, end);
    }
  }
  snap([], 'sorted');
  return frames;
}

function initSort() {
  const bars = $('#sort-bars'); if (!bars) return;
  const INPUT = [38, 12, 91, 5, 64, 27, 73, 49, 18, 56, 83, 31];
  let kind = 'bubble', frames = sortFrames('bubble', INPUT), f = 0, timer = null;

  function draw() {
    const fr = frames[f];
    const max = Math.max(...fr.a);
    bars.innerHTML = fr.a.map((v, i) =>
      '<div class="sbar' + (fr.hi.includes(i) ? ' hot' : '') + '" style="height:' + (v / max * 100) + '%" title="' + v + '"><span>' + v + '</span></div>').join('');
    $('#sort-stats').innerHTML =
      stat(fr.cmp, 'comparisons') + stat(fr.swaps, 'moves') +
      stat(f + 1 + ' / ' + frames.length, 'frame') +
      stat(C.sortAlgos.find(s => s.k === kind).avg, 'average case');
    $('#sort-note').textContent = fr.note;
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; $('#sort-play').textContent = '▶ Run'; } }
  function reset(k) {
    stop(); kind = k; frames = sortFrames(k, INPUT); f = 0;
    $$('#sort-tabs .chip').forEach(c => c.classList.toggle('active', c.dataset.k === k));
    const A = C.sortAlgos.find(s => s.k === k);
    $('#sort-info').innerHTML =
      '<div class="tnote"><b>' + A.name + '.</b> ' + A.idea + '<br><br>🎯 <b>Use it when:</b> ' + A.use + '</div>';
    draw();
  }
  const tb = $('#sort-tabs');
  C.sortAlgos.forEach((s, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), s.name);
    b.dataset.k = s.k;
    b.onclick = () => { reset(s.k); xp(2); };
    tb.appendChild(b);
  });
  $('#sort-play').onclick = e => {
    if (timer) return stop();
    if (f >= frames.length - 1) f = 0;
    e.target.textContent = '⏸ Pause';
    timer = setInterval(() => { if (f < frames.length - 1) { f++; draw(); } else { stop(); xp(3); } }, 90);
  };
  $('#sort-step').onclick = () => { if (f < frames.length - 1) { f++; draw(); } };
  $('#sort-reset').onclick = () => reset(kind);
  reset('bubble');

  const t = $('#sort-table');
  if (t) t.innerHTML =
    '<div class="cmptab s6 cmptab-h"><b>Algorithm</b><b>Best</b><b>Average</b><b>Worst</b><b>Space</b><b>Stable</b></div>' +
    C.sortAlgos.map(s =>
      '<div class="cmptab s6"><b>' + s.name + '</b>' +
      '<span class="mono">' + s.best + '</span><span class="mono">' + s.avg + '</span>' +
      '<span class="mono ' + (s.worst === 'O(n²)' ? 'lose' : 'win') + '">' + s.worst + '</span>' +
      '<span class="mono ' + (s.space === 'O(1)' ? 'win' : '') + '">' + s.space + '</span>' +
      '<span class="mono ' + (s.stable ? 'win' : 'lose') + '">' + (s.stable ? 'yes' : 'no') + '</span></div>').join('');

  const f2 = $('#sort-facts');
  if (f2) f2.innerHTML = C.sortFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');

  /* ---- searching ---- */
  const sv = $('#search-out');
  if (sv) {
    const arr = C.searchArray;
    const tb2 = $('#search-targets');
    arr.concat([50]).forEach(v => {
      const b = el('button', 'chip', String(v));
      b.onclick = () => { show(v); xp(2); };
      tb2.appendChild(b);
    });
    function linear(t) { const s = []; for (let i = 0; i < arr.length; i++) { s.push(i); if (arr[i] === t) return { steps: s, found: i }; } return { steps: s, found: -1 }; }
    function binary(t) {
      const s = []; let lo = 0, hi = arr.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        s.push(mid);
        if (arr[mid] === t) return { steps: s, found: mid };
        if (arr[mid] < t) lo = mid + 1; else hi = mid - 1;
      }
      return { steps: s, found: -1 };
    }
    function row(name, res, color) {
      return '<div class="lab-pane-title">' + name + ' — ' + res.steps.length + ' step' + (res.steps.length === 1 ? '' : 's') + '</div>' +
        '<div class="cellrow">' + arr.map((v, i) => {
          const order = res.steps.indexOf(i);
          return '<div class="cell sm' + (order >= 0 ? ' looked' : '') + (i === res.found ? ' target' : '') + '">' +
            '<div class="cell-v">' + v + '</div>' +
            '<div class="cell-i">' + (order >= 0 ? '#' + (order + 1) : '') + '</div></div>';
        }).join('') + '</div>';
    }
    function show(t) {
      const L = linear(t), B = binary(t);
      sv.innerHTML = row('Linear search for ' + t, L) + row('Binary search for ' + t, B) +
        '<div class="stat-row" style="margin-top:14px">' +
          stat(L.steps.length, 'linear steps', '#fb7185') +
          stat(B.steps.length, 'binary steps', '#a3e635') +
          stat('O(n)', 'linear') + stat('O(log n)', 'binary') +
        '</div>' +
        '<div class="tnote' + (B.found < 0 ? ' err' : '') + '">' +
          (B.found < 0
            ? '🔍 <b>' + t + ' is not in the array.</b> Linear had to check all ' + L.steps.length + ' elements to be sure; binary ruled out half the remaining range each time and was certain after ' + B.steps.length + '. Proving absence is where the gap is widest.'
            : '🔍 Binary search discards half the remaining range at every step. On 10 elements that is a modest win — but on a million it is 20 steps instead of a million, and on a billion it is 30 instead of a billion. <b>It is also wrong on unsorted data</b>, silently: the precondition is not a suggestion.') +
        '</div>';
    }
    show(23);
  }

  const f3 = $('#search-facts');
  if (f3) f3.innerHTML = C.searchFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
}

/* ============================================================
   Ch11 — recursion
   ============================================================ */
function factTrace(n) {
  const events = [];
  (function f(k, depth) {
    events.push({ type: 'call', label: 'factorial(' + k + ')', depth });
    if (k <= 1) { events.push({ type: 'return', label: '1', depth }); return 1; }
    const r = k * f(k - 1, depth + 1);
    events.push({ type: 'return', label: String(r), depth });
    return r;
  })(n, 0);
  return events;
}
function fibTrace(n) {
  const events = [];
  let calls = 0;
  (function f(k, depth) {
    calls++;
    events.push({ type: 'call', label: 'fib(' + k + ')', depth, k });
    if (k <= 1) { events.push({ type: 'return', label: String(k), depth }); return k; }
    const r = f(k - 1, depth + 1) + f(k - 2, depth + 1);
    events.push({ type: 'return', label: String(r), depth });
    return r;
  })(n, 0);
  return { events, calls };
}

function initRecursion() {
  const out = $('#rec-out'); if (!out) return;
  let kind = 'fact', ev = factTrace(4), i = -1, timer = null;

  function draw() {
    const stack = [];
    for (let k = 0; k <= i; k++) {
      const e = ev[k];
      if (e.type === 'call') stack.push(e);
      else stack.pop();
    }
    const maxDepth = Math.max(0, ...ev.slice(0, i + 1).map(e => e.depth));
    const cur = i >= 0 ? ev[i] : null;

    out.innerHTML =
      '<div class="two-up">' +
        '<div><div class="lab-pane-title">the call stack, right now</div>' +
          '<div class="callstack">' +
            (stack.length ? stack.slice().reverse().map((f, k) =>
              '<div class="frame' + (k === 0 ? ' top' : '') + '">' + f.label +
              (k === 0 ? '<span class="sq-tag">top</span>' : '') + '</div>').join('')
              : '<div class="sq-empty">empty — nothing is running</div>') +
          '</div></div>' +
        '<div><div class="lab-pane-title">what just happened</div>' +
          (cur
            ? '<div class="trace ' + (cur.type === 'call' ? 'act' : 'final') + '"><span class="tk">' +
              (cur.type === 'call' ? 'call' : 'return') + '</span>' +
              (cur.type === 'call' ? 'A new frame is pushed for <b>' + cur.label + '</b>' : 'The top frame returns <b>' + cur.label + '</b> and is popped') + '</div>'
            : '<p class="panel-sub">Press step and watch frames pile up, then unwind.</p>') +
          '<div class="stat-row" style="margin-top:12px">' +
            stat(stack.length, 'frames on the stack', stack.length > 4 ? '#facc15' : null) +
            stat(maxDepth + 1, 'deepest so far') +
            stat(ev.filter((e, k) => k <= i && e.type === 'call').length, 'total calls made',
              kind === 'fib' ? '#fb7185' : null) +
          '</div></div>' +
      '</div>' +
      '<div class="tnote">' + note(stack.length) + '</div>';
    $('#rec-count').textContent = i < 0 ? 'not started' : 'event ' + (i + 1) + ' / ' + ev.length;
  }

  function note(depth) {
    const ex = C.recursionExamples.find(e => e.k === kind);
    if (i < 0) return '💡 ' + ex.note;
    if (kind === 'fib' && i >= ev.length - 1) {
      const total = ev.filter(e => e.type === 'call').length;
      return '💥 <b>' + total + ' calls to compute fib(5).</b> The stack never got deeper than ' + (Math.max(...ev.map(e => e.depth)) + 1) +
        ' frames — depth is fine. The problem is that <b>fib(3) was computed more than once, and fib(2) more than that</b>. Nothing remembers previous answers, so the same work is redone down every branch. That is exactly the situation dynamic programming exists for, and Chapter 12 fixes it.';
    }
    if (i >= ev.length - 1) return '✅ <b>Fully unwound.</b> Every call that was pushed has returned, and the stack is empty. Notice the shape: frames pile up until the <b>base case</b> stops the recursion, then answers flow back up. Without a base case that pile never stops growing — and when it exhausts the stack, that is a stack overflow.';
    return '💡 ' + ex.note + ' Current depth: ' + depth + ' frame' + (depth === 1 ? '' : 's') + '.';
  }

  const tb = $('#rec-tabs');
  C.recursionExamples.forEach((e, k) => {
    const b = el('button', 'chip' + (k === 0 ? ' active' : ''), e.name);
    b.onclick = () => {
      kind = e.k; ev = e.k === 'fact' ? factTrace(4) : fibTrace(5).events; i = -1;
      stop();
      $$('.chip', tb).forEach(c => c.classList.remove('active')); b.classList.add('active');
      draw(); xp(3);
    };
    tb.appendChild(b);
  });
  function stop() { if (timer) { clearInterval(timer); timer = null; $('#rec-play').textContent = '▶ Run'; } }
  $('#rec-step').onclick = () => { if (i < ev.length - 1) { i++; draw(); xp(1); } };
  $('#rec-play').onclick = e => {
    if (timer) return stop();
    if (i >= ev.length - 1) i = -1;
    e.target.textContent = '⏸ Pause';
    timer = setInterval(() => { if (i < ev.length - 1) { i++; draw(); } else { stop(); xp(4); } }, 380);
  };
  $('#rec-reset').onclick = () => { stop(); i = -1; draw(); };
  draw();

  const p = $('#rec-parts');
  if (p) p.innerHTML = C.recursionParts.map((x, k) =>
    '<div class="rung"><div class="rung-n">' + (k + 1) + '</div><div><b>' + x[0] + '</b><p>' + x[1] + '</p></div></div>').join('');
  const v = $('#rec-vs-iter');
  if (v) v.innerHTML = C.recursionVsIteration.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const d = $('#rec-def'); if (d) d.textContent = C.recursionDef;
}

/* ============================================================
   Ch12 — dynamic programming
   ============================================================ */
function fibCallCounts(n) {
  const counts = {};
  let total = 0;
  (function f(k) {
    total++;
    counts[k] = (counts[k] || 0) + 1;
    if (k <= 1) return k;
    return f(k - 1) + f(k - 2);
  })(n);
  return { counts, total };
}
function fibMemoCount(n) {
  const memo = {};
  let total = 0;
  (function f(k) {
    total++;
    if (k in memo) return memo[k];
    if (k <= 1) return (memo[k] = k);
    return (memo[k] = f(k - 1) + f(k - 2));
  })(n);
  return { total, distinct: Object.keys(memo).length };
}

function initDP() {
  const out = $('#dp-out'), slider = $('#dp-n');
  if (!out) return;

  function render() {
    const n = +slider.value;
    $('#dp-n-v').textContent = 'fib(' + n + ')';
    const naive = fibCallCounts(n);
    const memo = fibMemoCount(n);
    const dupes = Object.keys(naive.counts).filter(k => naive.counts[k] > 1);
    const maxc = Math.max(...Object.values(naive.counts));

    out.innerHTML =
      '<div class="lab-pane-title">how many times the naive recursion computes each subproblem</div>' +
      '<div class="dupes">' + Object.keys(naive.counts).map(Number).sort((a, b) => b - a).map(k =>
        '<div class="dupe' + (naive.counts[k] > 1 ? ' repeat' : '') + '">' +
          '<div class="dp-k mono">fib(' + k + ')</div>' +
          '<div class="dp-bar"><div class="dp-fill" style="width:' + (naive.counts[k] / maxc * 100) + '%"></div></div>' +
          '<div class="dp-c mono">×' + naive.counts[k] + '</div></div>').join('') + '</div>' +
      '<div class="stat-row" style="margin-top:16px">' +
        stat(naive.total, 'calls, naive recursion', '#fb7185') +
        stat(memo.total, 'calls, memoised', '#a3e635') +
        stat((naive.total / memo.total).toFixed(1) + '×', 'less work') +
        stat(memo.distinct, 'distinct subproblems') +
      '</div>' +
      '<div class="tnote">' +
        (dupes.length
          ? '💡 <b>' + dupes.length + ' subproblems are computed more than once</b> — fib(' + dupes[dupes.length - 1] + ') alone is recomputed ' +
            naive.counts[dupes[dupes.length - 1]] + ' times. There are only <b>' + memo.distinct +
            ' distinct subproblems</b> in the whole tree, and the naive version solves them ' + naive.total +
            ' times between them. Caching each answer the first time collapses ' + naive.total + ' calls into ' + memo.total +
            '. That is the entire technique — the name "dynamic programming" is doing a lot of unearned intimidation.'
          : '💡 At n=' + n + ' the tree is too small for repeats to matter. Push the slider up and watch the duplication explode — that is the signal that DP applies.') +
      '</div>' +
      (n >= 10 ? '<div class="tnote err">📈 Naive Fibonacci is <b>O(2ⁿ)</b> and memoised is <b>O(n)</b>. At n=' + n +
        ' that is ' + naive.total + ' calls versus ' + memo.total + '. At n=50 the naive version would make about 40 billion calls and the memoised one 99. The recursion is identical; the only difference is a cache.</div>' : '');
  }
  slider.oninput = render;
  render();

  const c = $('#dp-conditions');
  if (c) c.innerHTML = C.dpConditions.map((x, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + x[0] + '</b><p>' + x[1] + '</p></div></div>').join('');
  const s = $('#dp-styles');
  if (s) s.innerHTML = C.dpStyles.map(x =>
    '<div class="pcard"><div class="pcard-badge">' + x.ico + '</div><h3>' + x.name + '</h3>' +
    '<p class="pcard-desc">' + x.how + '</p>' +
    '<div class="deflist"><b>Strengths</b><span>' + x.good + '</span><b>Costs</b><span>' + x.bad + '</span></div></div>').join('');
  const f = $('#dp-facts');
  if (f) f.innerHTML = C.dpFacts.map(x =>
    '<div class="gterm"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
  const d = $('#dp-def'); if (d) d.textContent = C.dpDef;
}

/* ============================================================
   Ch13 — paradigms
   ============================================================ */
function initParadigms() {
  const g = $('#paradigm-cards');
  if (g) g.innerHTML = C.paradigms.map(p =>
    '<div class="pcard"><div class="pcard-badge">' + p.ico + '</div><h3>' + p.name + '</h3>' +
    '<p class="pcard-desc">' + p.idea + '</p>' +
    '<div class="deflist"><b>Use it when</b><span>' + p.when + '</span><b>Typical cost</b><span>' + p.cost + '</span></div></div>').join('');

  drill($('#paradigm-cases'), C.paradigmCases,
    Object.fromEntries(C.paradigms.map(p => [p.k, { name: p.name, ico: p.ico }])),
    (s, t) => xp(10, s >= 5 ? 'You can name the shape of a problem' : 'Ask: do the subproblems repeat? Is greedy provably right?'));
}

/* ============================================================
   Ch14 — choosing a structure
   ============================================================ */
function initChooser() {
  drill($('#chooser'), C.chooserCases, C.chooserOptions,
    (s, t) => xp(12, s >= 6 ? 'You pick structures from requirements, not from habit' : 'Match the operation you do most often to the structure that makes it O(1)'));

  const t = $('#cheatsheet');
  if (t) t.innerHTML =
    '<div class="cmptab s6 cmptab-h"><b>Structure</b><b>Index</b><b>Search</b><b>Insert</b><b>Delete</b><b>Good at</b></div>' +
    C.cheatsheet.map(r =>
      '<div class="cmptab s6"><b>' + r[0] + '</b>' +
      r.slice(1, 5).map(c => '<span class="mono ' + (c === 'O(1)' ? 'win' : c === 'O(n)' ? 'lose' : '') + '">' + c + '</span>').join('') +
      '<span>' + r[5] + '</span></div>').join('') +
    '<p class="panel-sub" style="margin-top:12px">* amortised · † given a tail pointer · k = key length. A dash means the operation is not part of that structure\'s interface at all — a stack has no "search", by design, and that restriction is the feature.</p>';
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
    const msg = pct === 100 ? 'Perfect. You know what each structure costs and why — which is the part that transfers.'
      : pct >= 75 ? 'Strong. You could pick the right structure in a design discussion.'
      : pct >= 50 ? 'Good start. Revisit complexity and trees — most of the rest hangs off those.'
      : 'Worth another pass. Every structure is a trade: what it makes cheap, and what it makes expensive.';
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
  [initBackground, initComplexity, initArrays, initStrings, initList, initStackQueue,
   initHash, initTree, initHeap, initGraph, initSort, initRecursion, initDP,
   initParadigms, initChooser, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
