/* ============================================================
   demos.js — renders everything in content.js / cat-*.js.
   No content lives here. If you want to change what a tool
   says, edit the cat-*.js file, not this one.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const xp = (n, m) => window.awardXP && window.awardXP(n, m);

const CATS  = C.cats;
const BY_ID = {};
const TOOLS = [];
CATS.forEach(c => { BY_ID[c.id] = c; c.tools.forEach(t => { t.cat = c.id; TOOLS.push(t); }); });

/* ============================================================
   The five-point card — the single most reused thing here.
   ============================================================ */
function toolCardHTML(t) {
  const c = BY_ID[t.cat];
  return '<div class="tl-head">' +
      '<div class="tl-ico" style="background:' + c.color + '22;border-color:' + c.color + '55">' + c.ico + '</div>' +
      '<div class="tl-id"><b>' + t.n + '</b><span>' + t.by + ' &middot; ' + c.n + '</span></div>' +
      '<span class="tl-kind">' + t.kind + '</span>' +
    '</div>' +
    '<p class="tl-two">' + t.two + '</p>' +
    '<div class="tl-pts-h">Five points you can say out loud</div>' +
    '<ol class="tl-pts">' + t.pts.map(p => '<li>' + p + '</li>').join('') + '</ol>' +
    '<div class="tl-foot">' +
      '<div class="tl-pick"><b>Reach for it when</b>' + t.pick + '</div>' +
      '<div class="tl-watch"><b>They will push back with</b>' + t.watch + '</div>' +
    '</div>';
}

/* ============================================================
   1. The animated ecosystem map
   ============================================================ */
function initMap() {
  const svg  = $('#eco-svg'); if (!svg) return;
  const info = $('#eco-info');

  const W = 760, H = 560, cx = W / 2, cy = H / 2;
  const n = CATS.length;
  const nodes = CATS.map((c, i) => {
    // start at the top, go clockwise; squash vertically so it fits wide screens
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { c, x: cx + Math.cos(a) * 262, y: cy + Math.sin(a) * 208, a };
  });

  let parts = '';
  nodes.forEach((nd, i) => {
    parts += '<line class="eco-spoke" data-i="' + i + '" x1="' + cx + '" y1="' + cy +
             '" x2="' + nd.x + '" y2="' + nd.y + '" stroke="' + nd.c.color +
             '" stroke-width="1.4" opacity=".28"/>';
    parts += '<circle class="eco-pulse" data-i="' + i + '" r="3.4" fill="' + nd.c.color + '" opacity="0">' +
             '<animateMotion dur="' + (3.6 + i * 0.28) + 's" repeatCount="indefinite" ' +
             'path="M ' + cx + ' ' + cy + ' L ' + nd.x + ' ' + nd.y + '"/></circle>';
  });
  parts += '<circle cx="' + cx + '" cy="' + cy + '" r="62" class="eco-hub-ring"/>' +
           '<circle cx="' + cx + '" cy="' + cy + '" r="48" class="eco-hub"/>' +
           '<text x="' + cx + '" y="' + (cy - 4) + '" class="eco-hub-t">your</text>' +
           '<text x="' + cx + '" y="' + (cy + 13) + '" class="eco-hub-t">system</text>';

  nodes.forEach((nd, i) => {
    parts += '<g class="eco-node" data-i="' + i + '" transform="translate(' + nd.x + ',' + nd.y + ')">' +
      '<circle r="30" fill="' + nd.c.color + '1e" stroke="' + nd.c.color + '66" stroke-width="1.4"/>' +
      '<text y="6" class="eco-ico">' + nd.c.ico + '</text>' +
      '<text y="47" class="eco-lbl">' + nd.c.n + '</text>' +
      '<text y="61" class="eco-cnt">' + nd.c.tools.length + ' tools</text></g>';
  });
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = parts;

  function show(i) {
    const c = CATS[i];
    $$('.eco-node', svg).forEach((g, gi) => g.classList.toggle('on', gi === i));
    $$('.eco-spoke', svg).forEach((l, li) => l.setAttribute('opacity', li === i ? '.9' : '.18'));
    info.innerHTML =
      '<div class="eco-i-h" style="border-color:' + c.color + '55">' +
        '<span class="eco-i-ico" style="background:' + c.color + '22">' + c.ico + '</span>' +
        '<div><b>' + c.n + '</b><span>' + c.tag + '</span></div></div>' +
      '<p class="eco-i-two">' + c.two + '</p>' +
      '<div class="eco-i-tools">' + c.tools.map(t =>
        '<span class="eco-i-tool" style="border-color:' + c.color + '44">' + t.n + '</span>').join('') + '</div>' +
      '<a class="eco-i-go" href="#" data-go="' + c.id + '">Open the ' + c.n + ' chapter &rarr;</a>';
    info.classList.remove('in'); void info.offsetWidth; info.classList.add('in');
    const go = $('[data-go]', info);
    go.onclick = e => {
      e.preventDefault();
      const b = $$('.nav-item').find(x => x.textContent.indexOf(c.n) > -1);
      if (b) b.click();
    };
  }
  $$('.eco-node', svg).forEach(g => g.onclick = () => { show(+g.dataset.i); xp(1); });
  show(0);

  /* let the map cycle on its own until someone touches it */
  let auto = 1, timer = setInterval(() => show(auto = (auto + 1) % n), 3400);
  svg.addEventListener('click', () => { clearInterval(timer); timer = null; }, { once: true });
}

/* ============================================================
   2. Per-chapter tool grid — one <div data-toolcat="llm"> per chapter
   ============================================================ */
function initToolGrids() {
  $$('[data-toolcat]').forEach(root => {
    const c = BY_ID[root.dataset.toolcat];
    if (!c) return;
    const strip = el('div', 'tl-strip');
    const panel = el('div', 'tl-panel');
    c.tools.forEach((t, i) => {
      const b = el('button', 'tl-tab',
        '<span class="tl-tab-n">' + t.n + '</span><span class="tl-tab-b">' + t.by + '</span>');
      b.onclick = () => {
        $$('.tl-tab', strip).forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        panel.style.borderColor = c.color + '55';
        panel.innerHTML = toolCardHTML(t);
        panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
        xp(1);
      };
      strip.appendChild(b);
      if (i === 0) setTimeout(() => b.click(), 0);
    });
    root.appendChild(strip);
    root.appendChild(panel);
  });
}

/* ============================================================
   3. Category five-pointers — the layer-level points
   ============================================================ */
function initCatPoints() {
  /* the two-line summary is written once in cat-*.js and injected here,
     so the chapter lead and the map tooltip can never drift apart */
  $$('[data-cattwo]').forEach(root => {
    const c = BY_ID[root.dataset.cattwo]; if (c) root.innerHTML = c.two;
  });
  $$('[data-catpts]').forEach(root => {
    const c = BY_ID[root.dataset.catpts]; if (!c) return;
    root.innerHTML = '<ol class="tl-pts big">' + c.pts.map(p => '<li>' + p + '</li>').join('') + '</ol>';
  });
  $$('[data-catcount]').forEach(root => {
    const c = BY_ID[root.dataset.catcount]; if (c) root.textContent = c.tools.length;
  });
}

/* ============================================================
   4. Searchable catalogue — every tool, one keystroke away
   ============================================================ */
function initCatalogue() {
  const box  = $('#cat-search'); if (!box) return;
  const chips = $('#cat-chips');
  const out  = $('#cat-out');
  const count = $('#cat-count');
  let filter = 'all';

  const all = el('button', 'chip active', 'all &middot; ' + TOOLS.length);
  all.onclick = () => { filter = 'all'; mark(all); render(); };
  chips.appendChild(all);
  CATS.forEach(c => {
    const b = el('button', 'chip', c.ico + ' ' + c.n);
    b.onclick = () => { filter = c.id; mark(b); render(); };
    chips.appendChild(b);
  });
  function mark(b) { $$('.chip', chips).forEach(x => x.classList.remove('active')); b.classList.add('active'); }

  function render() {
    const q = (box.value || '').toLowerCase().trim();
    const hits = TOOLS.filter(t =>
      (filter === 'all' || t.cat === filter) &&
      (!q || t.n.toLowerCase().includes(q) || t.by.toLowerCase().includes(q) ||
       t.two.toLowerCase().includes(q) || t.kind.includes(q)));
    count.textContent = hits.length + ' of ' + TOOLS.length;
    out.innerHTML = '';
    if (!hits.length) { out.innerHTML = '<p class="panel-sub">Nothing matches. Try "vector", "guardrail" or "agent".</p>'; return; }
    hits.forEach(t => {
      const c = BY_ID[t.cat];
      const card = el('div', 'cg-card');
      card.style.setProperty('--c', c.color);
      card.innerHTML =
        '<div class="cg-h"><span class="cg-ico">' + c.ico + '</span>' +
        '<b>' + t.n + '</b><span class="cg-cat">' + c.n + '</span></div>' +
        '<p class="cg-two">' + t.two + '</p>' +
        '<div class="cg-more"></div>' +
        '<button class="cg-btn">five points &darr;</button>';
      const more = $('.cg-more', card), btn = $('.cg-btn', card);
      let open = false;
      btn.onclick = () => {
        open = !open;
        btn.textContent = open ? 'collapse ↑' : 'five points ↓';
        more.classList.toggle('open', open);
        if (open && !more.innerHTML) {
          more.innerHTML = '<ol class="tl-pts">' + t.pts.map(p => '<li>' + p + '</li>').join('') + '</ol>' +
            '<div class="tl-foot"><div class="tl-pick"><b>Reach for it when</b>' + t.pick + '</div>' +
            '<div class="tl-watch"><b>They will push back with</b>' + t.watch + '</div></div>';
          xp(1);
        }
      };
      out.appendChild(card);
    });
  }
  box.oninput = render;
  render();
}

/* ============================================================
   5. Pick the right tool
   ============================================================ */
function initPicker() {
  const root = $('#picker'); if (!root) return;
  const ids = Object.keys(C.pickerTools);
  let at = 0, score = 0, done = false;

  const stage = el('div', 'pk-stage');
  const opts  = el('div', 'pk-opts');
  const why   = el('div', 'pk-why');
  const nextB = el('button', 'btn', 'Next scenario →');
  nextB.style.display = 'none';
  root.appendChild(stage); root.appendChild(opts); root.appendChild(why);
  root.appendChild(el('div', 'btn-row')).appendChild(nextB);

  function draw() {
    const s = C.picker[at];
    done = false;
    stage.innerHTML = '<div class="pk-n">Scenario ' + (at + 1) + ' of ' + C.picker.length + '</div>' +
                      '<div class="pk-t">' + s.s + '</div>';
    why.className = 'pk-why';
    why.innerHTML = '';
    nextB.style.display = 'none';
    opts.innerHTML = '';
    /* four options: every correct answer plus fillers, shuffled deterministically per index */
    const wrong = ids.filter(i => s.a.indexOf(i) === -1);
    const pickN = Math.max(2, 5 - s.a.length);
    const fill = [];
    for (let k = 0; k < pickN; k++) fill.push(wrong[(at * 7 + k * 5 + 3) % wrong.length]);
    const shown = s.a.concat(fill.filter((v, i2) => fill.indexOf(v) === i2 && s.a.indexOf(v) === -1));
    shown.sort((a, b) => ((a.charCodeAt(0) * 31 + at) % 17) - ((b.charCodeAt(0) * 31 + at) % 17));
    shown.forEach(id => {
      const t = C.pickerTools[id];
      const b = el('button', 'pk-opt', '<span>' + t.ico + '</span>' + t.n);
      b.onclick = () => {
        if (done) return;
        done = true;
        const right = s.a.indexOf(id) > -1;
        $$('.pk-opt', opts).forEach((x, xi) => {
          x.disabled = true;
          if (s.a.indexOf(shown[xi]) > -1) x.classList.add('good');
        });
        if (!right) b.classList.add('bad'); else { score++; xp(5); }
        why.className = 'pk-why show ' + (right ? 'ok' : 'no');
        why.innerHTML = '<b>' + (right ? 'Right.' : 'Not the first answer.') + '</b> ' + s.why +
          (s.a.length > 1 ? '<span class="pk-all">Accepted: ' + s.a.map(x => C.pickerTools[x].n).join(', ') + '</span>' : '');
        nextB.style.display = at < C.picker.length - 1 ? 'inline-block' : 'none';
        if (at === C.picker.length - 1) {
          why.innerHTML += '<div class="pk-score">' + score + ' / ' + C.picker.length + ' first-choice correct</div>';
          xp(20, '🎯 Tool picker finished — ' + score + '/' + C.picker.length);
        }
      };
      opts.appendChild(b);
    });
  }
  nextB.onclick = () => { at++; draw(); };
  draw();
}

/* ============================================================
   6. The build-vs-buy ladder
   ============================================================ */
function initLadder() {
  const root = $('#ladder-box'); if (!root) return;
  const wrap = el('div', 'ladder');
  C.ladder.forEach((r, i) => {
    const d = el('div', 'rung reveal');
    d.innerHTML = '<div class="rung-n">' + (i + 1) + '</div>' +
      '<div><h4>' + r.n + '</h4><p>' + r.what + '</p><p class="rung-when"><b>Add it when:</b> ' + r.when + '</p></div>' +
      '<div class="rung-cost">' + r.cost + '</div>';
    wrap.appendChild(d);
  });
  root.appendChild(wrap);
}

/* ============================================================
   7. Rapid fire — the flip cards
   ============================================================ */
function initRapid() {
  const root = $('#rapid'); if (!root) return;
  C.rapid.forEach((r, i) => {
    const card = el('div', 'rf');
    card.innerHTML = '<div class="rf-q"><span class="rf-n">' + (i + 1) + '</span>' + r.q + '<span class="rf-cue">tap</span></div>' +
                     '<div class="rf-a">' + r.a + '</div>';
    let open = false;
    card.onclick = () => {
      open = !open;
      card.classList.toggle('open', open);
      if (open) xp(1);
    };
    root.appendChild(card);
  });
  const all = $('#rf-all');
  if (all) {
    let shown = false;
    all.onclick = () => {
      shown = !shown;
      $$('.rf', root).forEach(c => c.classList.toggle('open', shown));
      all.textContent = shown ? 'Hide all answers' : 'Reveal all answers';
    };
  }
}

/* ============================================================
   8. Coverage counter — the "how much is on this page" stat
   ============================================================ */
function initCoverage() {
  const root = $('#coverage'); if (!root) return;
  const stats = [
    { k: 'layers of the stack',      v: CATS.length },
    { k: 'named tools',              v: TOOLS.length },
    { k: 'five-point answers',       v: TOOLS.length + CATS.length },
    { k: 'individual talking points', v: TOOLS.reduce((a, t) => a + t.pts.length, 0) + CATS.reduce((a, c) => a + c.pts.length, 0) }
  ];
  root.innerHTML = stats.map(s =>
    '<div class="cv"><div class="cv-v" data-to="' + s.v + '">0</div><div class="cv-k">' + s.k + '</div></div>').join('');
  const run = () => $$('.cv-v', root).forEach(n => {
    const to = +n.dataset.to; let at = 0;
    const step = Math.max(1, Math.round(to / 34));
    const t = setInterval(() => { at += step; if (at >= to) { at = to; clearInterval(t); } n.textContent = at; }, 26);
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(e => { if (e[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: .4 });
    io.observe(root);
  } else run();
}

/* ============================================================
   9. Quiz
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
    const msg = pct === 100 ? 'You can hold a whiteboard conversation about any box on that map.'
      : pct >= 75 ? 'Strong. You know which layer a problem belongs to, which is the actual skill.'
      : pct >= 50 ? 'Good start. Re-read the layer chapters behind the misses.'
      : 'Worth another pass — the categories matter more than the brand names.';
    result.innerHTML = '<div class="quiz-result"><h3>' + correct + ' / ' + C.quiz.length + ' &nbsp;·&nbsp; ' + pct + '%</h3><p>' + msg + '</p></div>';
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    xp(25, '🏁 Course complete — ' + pct + '%');
  }
}


/* ============================================================
   9. Animated architecture diagrams
   One <div data-arch="mcp"> per chapter. The picture is drawn
   from C.arch; the steps light one path at a time so the flow
   is readable instead of being twelve arrows at once.
   ============================================================ */
function initArch() {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the anchor on the side of the box that faces the other box */
  function port(a, b, off) {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    if (Math.abs(bx - ax) >= Math.abs(by - ay))
      return { x: bx > ax ? a.x + a.w : a.x, y: ay + (off || 0), dx: bx > ax ? 1 : -1, dy: 0 };
    return { x: ax + (off || 0), y: by > ay ? a.y + a.h : a.y, dx: 0, dy: by > ay ? 1 : -1 };
  }

  $$('[data-arch]').forEach(root => {
    const D = (C.arch || {})[root.dataset.arch];
    if (!D) return;
    if (D.lead) root.appendChild(el('p', 'panel-sub', D.lead));
    const N = {};
    D.nodes.forEach(n => N[n.id] = n);

    /* ---- geometry ---- */
    const geo = D.edges.map(e => {
      const a = N[e.f], b = N[e.t];
      const p = port(a, b, e.o), q = port(b, a, e.o);
      const k = 48;
      return {
        id: e.f + '>' + e.t, l: e.l,
        d: 'M' + p.x + ' ' + p.y +
           ' C' + (p.x + p.dx * k) + ' ' + (p.y + p.dy * k) +
           ',' + (q.x + q.dx * k) + ' ' + (q.y + q.dy * k) +
           ',' + (q.x - q.dx * 9) + ' ' + (q.y - q.dy * 9),
        lx: (p.x + q.x) / 2, ly: (p.y + q.y) / 2 - (p.dy ? 0 : 9)
      };
    });

    /* ---- svg ---- */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'arch-svg');
    svg.setAttribute('viewBox', '0 0 ' + D.w + ' ' + D.h);
    svg.innerHTML =
      '<defs>' +
        '<marker id="ar-' + root.dataset.arch + '" viewBox="0 0 10 10" refX="8" refY="5" ' +
          'markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
          '<path d="M0 0 L10 5 L0 10 z" fill="rgba(255,255,255,.28)"/></marker>' +
        '<marker id="aron-' + root.dataset.arch + '" viewBox="0 0 10 10" refX="8" refY="5" ' +
          'markerWidth="6.6" markerHeight="6.6" orient="auto-start-reverse">' +
          '<path d="M0 0 L10 5 L0 10 z" fill="#22d3ee"/></marker>' +
      '</defs>' +
      geo.map(g => '<path class="arch-edge" data-e="' + g.id + '" d="' + g.d + '" ' +
        'marker-end="url(#ar-' + root.dataset.arch + ')"/>').join('') +
      geo.filter(g => g.l).map(g =>
        '<text class="arch-elbl" data-e="' + g.id + '" x="' + g.lx + '" y="' + g.ly + '">' + g.l + '</text>').join('') +
      D.nodes.map(n =>
        '<g class="arch-node" data-n="' + n.id + '" style="--nc:' + n.c + '" ' +
          'transform="translate(' + n.x + ',' + n.y + ')">' +
          '<rect class="arch-box" width="' + n.w + '" height="' + n.h + '" rx="13"/>' +
          '<text class="arch-ico" x="24" y="30">' + n.ico + '</text>' +
          '<text class="arch-n" x="45" y="29">' + n.n + '</text>' +
          '<text class="arch-s" x="15" y="52">' + n.s + '</text>' +
        '</g>').join('');

    /* ---- steps ---- */
    const wrap = el('div', 'arch-wrap');
    const left = el('div', 'arch-stage');
    left.appendChild(svg);
    const cap = el('div', 'arch-cap');
    left.appendChild(cap);

    const side = el('div', 'arch-side');
    const play = el('button', 'btn btn-ghost arch-play', '▶ Play the flow');
    side.appendChild(play);
    const list = el('div', 'arch-steps');
    D.steps.forEach((s, i) => {
      const b = el('button', 'arch-step', '<i>' + (i + 1) + '</i><span>' + s.t + '</span>');
      b.onclick = () => { stop(); show(i); xp(1); };
      list.appendChild(b);
    });
    side.appendChild(list);
    if (D.note) side.appendChild(el('div', 'arch-note', D.note));

    wrap.appendChild(left);
    wrap.appendChild(side);
    root.appendChild(wrap);

    /* ---- playback ---- */
    let at = -1, timer = null, seen = false;

    function show(i) {
      at = i;
      const s = D.steps[i];
      const on = new Set(s.n), one = new Set(s.e);
      $$('.arch-node', svg).forEach(g => g.classList.toggle('on', on.has(g.dataset.n)));
      $$('.arch-edge', svg).forEach(p => {
        const lit = one.has(p.dataset.e);
        p.classList.toggle('on', lit);
        p.setAttribute('marker-end', 'url(#' + (lit ? 'aron-' : 'ar-') + root.dataset.arch + ')');
      });
      $$('.arch-elbl', svg).forEach(t => t.classList.toggle('on', one.has(t.dataset.e)));
      $$('.arch-step', list).forEach((b, bi) => b.classList.toggle('active', bi === i));
      cap.innerHTML = '<b>' + (i + 1) + '. ' + s.t + '</b>' + s.say;
      if (i === D.steps.length - 1 && !seen) { seen = true; xp(6, '+6 XP — you can draw this one from memory now'); }
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      play.textContent = '▶ Play the flow';
    }
    function start() {
      show((at + 1) % D.steps.length);
      timer = setInterval(() => {
        if (at >= D.steps.length - 1) { stop(); return; }
        show(at + 1);
      }, 3200);
      play.textContent = '⏸ Pause';
    }
    play.onclick = () => timer ? stop() : start();

    show(0);
    /* autoplay once the chapter is actually on screen, and never for
       someone who asked the OS for less motion */
    if (!REDUCED && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(en => {
        if (en[0].isIntersecting) { io.disconnect(); if (!timer) start(); }
      }, { threshold: .35 });
      io.observe(svg);
    }
  });
}

/* ---------- go ---------- */
initMap();
initToolGrids();
initCatPoints();
initCatalogue();
initPicker();
initLadder();
initRapid();
initCoverage();
initQuiz();
initArch();
})();
