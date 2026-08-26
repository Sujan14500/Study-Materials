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
      ctx.fillStyle = 'rgba(160,240,200,.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 20000) {
          ctx.strokeStyle = 'rgba(34,197,94,' + (0.16 * (1 - d2 / 20000)) + ')';
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
    const labels = ['📝', '🧠', '🔤', '📚', '🏁'];
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 15);
      c.setAttribute('fill', 'rgba(10,18,16,.92)');
      c.setAttribute('stroke', ['#38bdf8', '#a78bfa', '#22c55e', '#fbbf24', '#22c55e'][i]);
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
   Ch1 — do you actually need LangChain?
   ============================================================ */
function initWhy() {
  const box = $('#why-needs'), out = $('#why-out');
  if (!box) return;
  const on = new Set(['one']);

  C.needs.forEach(n => {
    const t = el('div', 'toggle' + (on.has(n.id) ? ' on' : ''),
      '<span class="toggle-box">✓</span><span>' + n.ico + ' ' + n.label + '</span>');
    t.onclick = () => {
      t.classList.toggle('on');
      on.has(n.id) ? on.delete(n.id) : on.add(n.id);
      render(); xp(1);
    };
    box.appendChild(t);
  });

  function render() {
    const picked = C.needs.filter(n => on.has(n.id));
    const raw = picked.reduce((a, n) => a + n.raw, 0);
    const lc = picked.reduce((a, n) => a + n.lc, 0);
    const v = C.whyVerdicts.find(x => raw <= x.max);
    const max = Math.max(raw, lc, 1);

    out.innerHTML =
      '<div class="loc-row"><div class="loc-label">Provider SDK, by hand</div>' +
        '<div class="loc-bar"><div class="loc-fill raw" style="width:' + (raw / max * 100) + '%"></div></div>' +
        '<div class="loc-n mono">~' + raw + ' lines</div></div>' +
      '<div class="loc-row"><div class="loc-label">LangChain</div>' +
        '<div class="loc-bar"><div class="loc-fill lc" style="width:' + (lc / max * 100) + '%"></div></div>' +
        '<div class="loc-n mono">~' + lc + ' lines</div></div>' +
      '<div class="verdict ' + v.cls + '"><h4>' + v.v + '</h4><p>' + v.t + '</p></div>' +
      (picked.length ? '<div class="why-notes">' + picked.map(n =>
        '<div class="gterm"><b>' + n.ico + ' ' + n.label + '</b><span>' + n.note + '</span></div>').join('') + '</div>' : '');
  }
  render();
}

/* ============================================================
   Ch2 — messages
   ============================================================ */
function initMessages() {
  const grid = $('#msg-types');
  if (grid) grid.innerHTML = C.msgTypes.map(m =>
    '<div class="msgcard" style="--c:' + m.color + '"><div class="mc-h">' + m.ico +
    ' <b class="mono">' + m.name + '</b></div><p>' + m.desc + '</p>' +
    '<div class="mc-ex">' + esc(m.example) + '</div></div>').join('');

  const b = $('#msg-build'), out = $('#msg-out');
  if (!b) return;
  const convo = [
    { k: 'system', t: 'You are a terse SRE assistant. Answer in at most 3 sentences.' },
    { k: 'human', t: 'Why did checkout page us at 22:14?' }
  ];

  function render() {
    out.innerHTML =
      '<div class="msg-list">' + convo.map((m, i) => {
        const M = C.msgTypes.find(x => x.k === m.k);
        return '<div class="msgrow" style="--c:' + M.color + '"><span class="mr-role">' + M.ico + ' ' + M.name + '</span>' +
          '<span class="mr-t">' + esc(m.t) + '</span>' +
          (i > 1 ? '<button class="mr-x" data-i="' + i + '">✕</button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="lab-pane-title" style="margin-top:16px">what gets sent</div>' +
      '<pre class="code">' + esc(
        'model.invoke([\n' + convo.map(m => {
          const M = C.msgTypes.find(x => x.k === m.k);
          return '    ' + M.name + '("' + m.t.slice(0, 58) + (m.t.length > 58 ? '…' : '') + '"),';
        }).join('\n') + '\n])'
      ) + '</pre>' +
      '<p class="panel-sub" style="margin-top:10px">Total: <b>' + convo.length + ' messages</b>, roughly <b>' +
        Math.round(convo.reduce((a, m) => a + m.t.length, 0) / 4) + ' tokens</b>. Every one of them is resent on every call — the model holds nothing between requests.</p>';

    $$('.mr-x', out).forEach(x => x.onclick = () => { convo.splice(+x.dataset.i, 1); render(); });
  }

  C.msgTypes.forEach(m => {
    const btn = el('button', 'chip', '+ ' + m.ico + ' ' + m.name);
    btn.onclick = () => {
      const samples = {
        system: 'Never speculate. Cite the runbook section you used.',
        human: 'And what should I do about it right now?',
        ai: 'Connection pool exhaustion after the 22:10 deploy.',
        tool: '{"p95_ms": 812, "pool_max": 20, "pool_in_use": 20}'
      };
      convo.push({ k: m.k, t: samples[m.k] });
      render(); xp(2);
    };
    b.appendChild(btn);
  });
  render();

  const knobs = $('#model-knobs');
  if (knobs) knobs.innerHTML = C.modelKnobs.map(k =>
    '<div class="gterm"><b class="mono">' + k[0] + '</b><span>' + k[1] + '</span></div>').join('');
}

/* ============================================================
   Ch3 — prompt templates
   ============================================================ */
function initTemplates() {
  const ta = $('#tpl-input'), vars = $('#tpl-vars'), out = $('#tpl-out'), presets = $('#tpl-presets');
  if (!ta) return;
  let values = {};

  C.tplPresets.forEach((p, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), p.name);
    b.onclick = () => {
      $$('.chip', presets).forEach(c => c.classList.remove('active')); b.classList.add('active');
      ta.value = p.tpl; values = Object.assign({}, p.vars); render(); xp(2);
    };
    presets.appendChild(b);
  });
  ta.value = C.tplPresets[0].tpl;
  values = Object.assign({}, C.tplPresets[0].vars);

  function names(tpl) {
    // {{ and }} are literal braces; everything else in single braces is a variable
    const stripped = tpl.replace(/\{\{|\}\}/g, ' ');
    return [...new Set([...stripped.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map(m => m[1]))];
  }

  function render() {
    const tpl = ta.value;
    const need = names(tpl);

    vars.innerHTML = need.map(n =>
      '<div class="calc-f"><label for="v-' + n + '">' + n + '</label>' +
      '<input id="v-' + n + '" type="text" value="' + esc(values[n] == null ? '' : values[n]).replace(/"/g, '&quot;') + '"></div>').join('')
      || '<p class="panel-sub">No variables in this template.</p>';

    $$('input', vars).forEach(i => i.oninput = () => { values[i.id.slice(2)] = i.value; render(); });

    const missing = need.filter(n => !values[n]);
    let rendered = tpl;
    need.forEach(n => {
      rendered = rendered.split('{' + n + '}').join(values[n] || '‹' + n + '›');
    });
    rendered = rendered.replace(/\{\{/g, '{').replace(/\}\}/g, '}');

    out.innerHTML =
      '<div class="lab-pane-title">rendered prompt</div>' +
      '<div class="rendered' + (missing.length ? ' err' : '') + '">' + esc(rendered).replace(/\n/g, '<br>') + '</div>' +
      (missing.length
        ? '<div class="tnote err">💥 <b>KeyError: \'' + missing[0] + '\'</b> — a template validates its inputs. That is the point: you find out here, not from a model answering a prompt with a literal <span class="mono">{' + missing[0] + '}</span> in it.</div>'
        : '<div class="tnote">✅ All variables supplied. In code this is <span class="mono">prompt.invoke(' +
          esc(JSON.stringify(Object.fromEntries(need.map(n => [n, (values[n] || '').slice(0, 18) + ((values[n] || '').length > 18 ? '…' : '')])))) + ')</span></div>') +
      '<div class="lab-pane-title" style="margin-top:16px">the code</div>' +
      '<pre class="code">' + esc(
        'prompt = ChatPromptTemplate.from_template("""' + tpl.slice(0, 160) + (tpl.length > 160 ? '…' : '') + '""")\n\n' +
        'chain = prompt | model | StrOutputParser()\n' +
        'chain.invoke({' + need.map(n => '"' + n + '": ...').join(', ') + '})'
      ) + '</pre>';
  }
  ta.oninput = render;
  render();

  const rules = $('#tpl-rules');
  if (rules) rules.innerHTML = C.tplRules.map(r =>
    '<div class="gterm"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
}

/* ============================================================
   Ch4 — LCEL builder
   ============================================================ */
function initLcel() {
  const bank = $('#lcel-bank'), chainBox = $('#lcel-chain'), out = $('#lcel-out');
  if (!bank) return;
  let chain = ['prompt', 'model', 'parser'];

  bank.innerHTML = C.lcelParts.map(p =>
    '<button class="chip" data-k="' + p.k + '">+ ' + p.ico + ' ' + p.name + '</button>').join('');
  $$('.chip', bank).forEach(b => b.onclick = () => { chain.push(b.dataset.k); render(); xp(2); });

  function render() {
    const parts = chain.map(k => C.lcelParts.find(p => p.k === k));
    chainBox.innerHTML = parts.map((p, i) =>
      '<div class="lnode" style="--c:' + p.color + '" data-i="' + i + '">' +
        '<span class="ln-ico">' + p.ico + '</span><b>' + p.name + '</b>' +
        '<small>' + p.desc + '</small><button class="ln-x">✕</button></div>')
      .join('<div class="lpipe">|</div>')
      || '<p class="panel-sub">Empty chain — add a component.</p>';

    $$('.ln-x', chainBox).forEach((x, i) => x.onclick = e => {
      e.stopPropagation(); chain.splice(i, 1); render();
    });

    if (!parts.length) { out.innerHTML = ''; return; }

    out.innerHTML =
      '<div class="lab-pane-title">the code</div>' +
      '<pre class="code">' + esc(
        parts.map(p => p.code).join('\n\n') + '\n\nchain = ' + chain.join(' | ') + '\nchain.invoke(' + parts[0].inp + ')'
      ) + '</pre>' +
      '<div class="lab-pane-title" style="margin-top:16px">what flows through</div>' +
      '<div class="dataflow">' + parts.map((p, i) =>
        '<div class="df-step" style="--c:' + p.color + ';animation-delay:' + (i * 120) + 'ms">' +
          '<div class="df-h">' + p.ico + ' ' + p.name + '</div>' +
          '<div class="df-io"><span>in</span><pre>' + esc(p.inp) + '</pre></div>' +
          '<div class="df-io"><span>out</span><pre>' + esc(p.out) + '</pre></div>' +
        '</div>').join('<div class="df-arrow">↓</div>') + '</div>' +
      (chain.length > 1 && !typesLineUp(parts)
        ? '<div class="tnote err">⚠️ The types do not line up: <span class="mono">' + parts.find((p, i) => i && !fits(parts[i - 1], p)).name +
          '</span> does not accept what the step before it produces. LCEL will not catch this until you invoke — which is the main tax you pay for the pipe operator\'s convenience.</div>'
        : '<div class="tnote">✅ Every step accepts what the previous one produces. Whatever you compose is itself a Runnable — so <span class="mono">chain.stream()</span>, <span class="mono">chain.batch()</span> and <span class="mono">chain.with_retry()</span> all work on the whole thing.</div>');
  }

  const ACCEPTS = {
    prompt: ['dict'], model: ['messages'], parser: ['aimessage'],
    retriever: ['dict', 'str'], lambda: ['docs', 'str', 'dict', 'messages', 'aimessage']
  };
  const PRODUCES = { prompt: 'messages', model: 'aimessage', parser: 'str', retriever: 'docs', lambda: 'str' };
  const fits = (a, b) => ACCEPTS[b.k].includes(PRODUCES[a.k]);
  const typesLineUp = parts => parts.every((p, i) => !i || fits(parts[i - 1], p));

  render();

  const meth = $('#lcel-methods');
  if (meth) meth.innerHTML = C.lcelMethods.map(m =>
    '<div class="gterm"><b class="mono">' + m[0] + '</b><span>' + m[1] + '</span></div>').join('');

  const wire = $('#lcel-wiring');
  if (wire) wire.innerHTML = C.lcelWiring.map(w =>
    '<div class="pcard"><h3>' + w.name + '</h3><pre class="code">' + esc(w.code) + '</pre>' +
    '<p class="pcard-desc" style="min-height:0;margin:10px 0 0">' + w.note + '</p></div>').join('');
}

/* ============================================================
   Ch5 — output parsers
   ============================================================ */
function initParsers() {
  const tabs = $('#parser-tabs'), out = $('#parser-out');
  if (!out) return;
  let cur = 0;

  C.parserModes.forEach((p, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), p.ico + ' ' + p.name);
    b.onclick = () => { cur = i; $$('.chip', tabs).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); xp(3); };
    tabs.appendChild(b);
  });

  function render() {
    const p = C.parserModes[cur];
    out.innerHTML =
      '<pre class="code">' + esc(p.code) + '</pre>' +
      '<div class="two-up" style="margin-top:14px">' +
        '<div><div class="lab-pane-title">what the model returned</div><div class="pane raw">' + esc(p.raw) + '</div></div>' +
        '<div><div class="lab-pane-title">what your code receives</div><div class="pane ' + (p.ok ? 'ok' : 'err') + '">' + esc(p.parsed) + '</div></div>' +
      '</div>' +
      '<div class="tnote' + (p.ok ? '' : ' err') + '">' + (p.ok ? '💡 ' : '💥 ') + p.note + '</div>';
  }
  render();
}

/* ============================================================
   Ch6 — text splitter
   ============================================================ */
function initSplitter() {
  const ta = $('#split-text'), size = $('#split-size'), lap = $('#split-lap'), out = $('#split-out');
  if (!ta) return;
  ta.value = C.splitDoc;

  function split(text, n, o) {
    // recursive-character behaviour: prefer paragraph, then sentence, then hard cut
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      let end = Math.min(i + n, text.length);
      if (end < text.length) {
        const window = text.slice(i, end);
        const br = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'));
        if (br > n * 0.5) end = i + br + 1;
      }
      chunks.push({ start: i, end, text: text.slice(i, end) });
      if (end >= text.length) break;
      i = Math.max(end - o, i + 1);
    }
    return chunks;
  }

  function render() {
    const n = +size.value, o = Math.min(+lap.value, n - 1);
    $('#split-size-v').textContent = n;
    $('#split-lap-v').textContent = o;
    const chunks = split(ta.value, n, o);

    out.innerHTML =
      '<div class="stat-row" style="margin-bottom:14px">' +
        '<div class="stat"><div class="stat-v">' + chunks.length + '</div><div class="stat-k">chunks</div></div>' +
        '<div class="stat"><div class="stat-v">' + Math.round(chunks.reduce((a, c) => a + c.text.length, 0) / chunks.length) + '</div><div class="stat-k">avg chars</div></div>' +
        '<div class="stat"><div class="stat-v">' + Math.round((chunks.reduce((a, c) => a + c.text.length, 0) / ta.value.length - 1) * 100) + '%</div><div class="stat-k">storage overhead from overlap</div></div>' +
        '<div class="stat"><div class="stat-v">' + Math.round(chunks.reduce((a, c) => a + c.text.length, 0) / 4) + '</div><div class="stat-k">tokens to embed</div></div>' +
      '</div>' +
      chunks.map((c, i) => {
        const overlapLen = i > 0 ? Math.max(0, chunks[i - 1].end - c.start) : 0;
        const head = c.text.slice(0, overlapLen), tail = c.text.slice(overlapLen);
        return '<div class="chunk"><div class="chunk-h">chunk ' + i + ' <span class="mono">' + c.text.length + ' chars</span>' +
          (overlapLen ? '<span class="pill good">' + overlapLen + ' overlapped</span>' : '') + '</div>' +
          '<div class="chunk-b">' + (overlapLen ? '<mark>' + esc(head) + '</mark>' : '') + esc(tail) + '</div></div>';
      }).join('') +
      '<p class="panel-sub" style="margin-top:12px">Highlighted text is repeated from the previous chunk. Set overlap to 0 and read the boundaries — you will find sentences that now live in neither chunk properly, which is exactly the fact your retriever will fail to find.</p>';
  }
  [ta, size, lap].forEach(x => x.oninput = render);
  render();

  const kinds = $('#split-kinds');
  if (kinds) kinds.innerHTML = C.splitters.map(s =>
    '<div class="pcard"><h3 class="mono" style="font-size:14px">' + s.name + '</h3>' +
    '<p class="pcard-desc">' + s.desc + '</p>' +
    '<div class="pcard-foot"><span class="pill good">' + s.use + '</span></div></div>').join('');

  const les = $('#split-lessons');
  if (les) les.innerHTML = C.splitLessons.map(l =>
    '<div class="gterm"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>').join('');
}

/* ============================================================
   Ch7 — similarity search
   ============================================================ */
function score(query, doc) {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  if (!q.length) return 0;
  let hits = 0;
  q.forEach(w => {
    if (doc.keys.some(k => k.includes(w) || w.includes(k))) hits += 1;
    else if (doc.text.toLowerCase().includes(w)) hits += 0.45;
  });
  // squash into a plausible cosine-similarity range
  return Math.min(0.94, 0.18 + hits / q.length * 0.72);
}

function initVectors() {
  const inp = $('#vec-q'), out = $('#vec-out'), chips = $('#vec-examples');
  if (!inp) return;

  ['friday deploy rules', 'how do I undo a release', 'who is on the pager', 'postgres connections', 'leaked credential']
    .forEach(q => {
      const b = el('button', 'chip', q);
      b.onclick = () => { inp.value = q; render(); xp(2); };
      chips.appendChild(b);
    });

  function render() {
    const q = inp.value.trim();
    if (!q) { out.innerHTML = '<p class="panel-sub">Type a question above.</p>'; return; }
    const ranked = C.kb.map(d => ({ d, s: score(q, d) })).sort((a, b) => b.s - a.s);
    const k = 3;
    out.innerHTML =
      '<pre class="code">' + esc('vectorstore.similarity_search_with_score("' + q + '", k=' + k + ')') + '</pre>' +
      ranked.map((r, i) =>
        '<div class="chunk' + (i < k ? ' picked' : ' dropped') + '">' +
          '<div class="chunk-h"><span class="mono">' + r.d.src + '</span>' +
            '<span class="pill ' + (i < k ? 'good' : '') + '">' + (i < k ? 'retrieved' : 'not returned') + '</span>' +
            '<span class="chunk-score mono">' + r.s.toFixed(3) + '</span></div>' +
          '<div class="score-bar"><div class="score-fill" style="width:' + (r.s * 100) + '%"></div></div>' +
          '<div class="chunk-b">' + esc(r.d.text) + '</div></div>').join('') +
      '<p class="panel-sub" style="margin-top:12px">Similarity is a <b>ranking</b>, not a judgement of relevance. Notice that the bottom results still score above zero — a vector store always returns its k nearest neighbours, even when none of them answer the question. Guarding against that is what Chapter 11\'s grading loop is for.</p>';
  }
  inp.oninput = render;
  render();
}

/* ============================================================
   Ch8 — the RAG chain
   ============================================================ */
function initRag() {
  const qbox = $('#rag-questions'), pipe = $('#rag-pipe'), out = $('#rag-out');
  if (!pipe) return;
  let q = 0, useRag = true;

  C.ragQuestions.forEach((rq, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), rq.q);
    b.onclick = () => { q = i; $$('.chip', qbox).forEach(c => c.classList.remove('active')); b.classList.add('active'); run(); };
    qbox.appendChild(b);
  });

  $('#rag-toggle').onclick = e => {
    useRag = !useRag;
    e.target.textContent = useRag ? '🔌 Turn retrieval OFF' : '🔌 Turn retrieval ON';
    e.target.classList.toggle('btn-ghost', !useRag);
    run(); xp(3);
  };

  function run() {
    const rq = C.ragQuestions[q];
    const stages = useRag ? C.ragStages : C.ragStages.filter(s => s.k === 'question' || s.k === 'prompt' || s.k === 'model');
    pipe.innerHTML = stages.map((s, i) =>
      '<div class="rstage" style="animation-delay:' + (i * 140) + 'ms"><div class="rs-h">' + s.ico + ' ' + s.name + '</div>' +
      '<pre class="code">' + esc(s.code) + '</pre></div>').join('<div class="arch-sep">↓</div>');

    const ranked = C.kb.map(d => ({ d, s: score(rq.q, d) })).sort((a, b) => b.s - a.s).slice(0, 3);
    const best = ranked[0];
    const grounded = rq.hint && best.d.id === rq.hint && best.s > 0.4;

    let html = '';
    if (useRag) {
      html += '<div class="lab-pane-title">retrieved context</div>' +
        ranked.map(r => '<div class="chunk"><div class="chunk-h"><span class="mono">' + r.d.src +
          '</span><span class="chunk-score mono">' + r.s.toFixed(3) + '</span></div>' +
          '<div class="chunk-b">' + esc(r.d.text) + '</div></div>').join('');
    }
    html += '<div class="lab-pane-title" style="margin-top:16px">answer</div>';
    if (!useRag) {
      html += '<div class="pane err">' + esc(C.ragNoContext) + '</div>' +
        '<div class="tnote err">💥 Fluent, plausible, and not your policy. With no retrieval the model answers from general priors — which is precisely the failure RAG exists to remove.</div>';
    } else if (!rq.hint) {
      html += '<div class="pane ok">I could not find anything about that in the knowledge base.</div>' +
        '<div class="tnote">✅ The right behaviour for an out-of-scope question — and it only happens because the prompt says <i>"answer only from the context; if it is not there, say so."</i> Without that line the model will happily answer from memory and cite nothing.</div>';
    } else if (grounded) {
      html += '<div class="pane ok">' + esc(C.ragAnswers[rq.hint]) + '</div>' +
        '<div class="tnote">✅ Grounded in <span class="mono">' + C.kb.find(d => d.id === rq.hint).src + '</span>. Because the source came back with the answer, you can cite it — and a reviewer can check it.</div>';
    } else {
      html += '<div class="pane err">Based on the context provided, I cannot answer that reliably.</div>' +
        '<div class="tnote err">⚠️ Retrieval returned the wrong chunks, so the answer is unavailable no matter how good the model is. This is why you evaluate the retriever separately from the chain.</div>';
    }
    out.innerHTML = html;
  }
  run();

  const code = $('#rag-code');
  if (code) code.textContent =
'from langchain_core.runnables import RunnableParallel, RunnablePassthrough\n' +
'from langchain_core.output_parsers import StrOutputParser\n\n' +
'prompt = ChatPromptTemplate.from_template("""\n' +
'Answer using ONLY the context below. If the answer is not there,\n' +
'say you could not find it. Cite the source of each claim.\n\n' +
'Context:\n{context}\n\nQuestion: {question}\n""")\n\n' +
'def format_docs(docs):\n' +
'    return "\\n\\n".join(f"[{d.metadata[\'source\']}] {d.page_content}" for d in docs)\n\n' +
'chain = (\n' +
'    RunnableParallel(\n' +
'        context=retriever | format_docs,\n' +
'        question=RunnablePassthrough(),\n' +
'    )\n' +
'    | prompt\n' +
'    | model\n' +
'    | StrOutputParser()\n' +
')\n\n' +
'chain.invoke("Can I deploy on a Friday?")';
}

/* ============================================================
   Ch9 — chat history
   ============================================================ */
function initHistory() {
  const stream = $('#hist-stream'), stores = $('#hist-stores');
  if (!stream) return;
  let i = 0;
  const sess = { alice: [], bob: [] };

  function paint() {
    stores.innerHTML = Object.keys(sess).map(s =>
      '<div class="memstore"><div class="ms-h">🗂️ session_id = "' + s + '"<span class="ms-n">' + sess[s].length + ' msgs</span></div>' +
      (sess[s].length ? sess[s].map(m => '<div class="ms-item"><b>' + m.r + ':</b> ' + esc(m.t.slice(0, 62)) + (m.t.length > 62 ? '…' : '') + '</div>').join('')
        : '<div class="ms-empty">empty</div>') +
      '<div class="ms-foot mono">next call resends ' + Math.round(sess[s].reduce((a, m) => a + m.t.length, 0) / 4) + ' tokens of history</div></div>').join('');
  }
  function next() {
    if (i >= C.histTurns.length) return;
    const t = C.histTurns[i++];
    stream.appendChild(el('div', 'trace think',
      '<span class="tk">' + t.s + ' · human</span>' + esc(t.u)));
    stream.appendChild(el('div', 'trace final',
      '<span class="tk">' + t.s + ' · ai</span>' + esc(t.a)));
    stream.scrollTop = stream.scrollHeight;
    sess[t.s].push({ r: 'human', t: t.u }, { r: 'ai', t: t.a });
    paint();
    if (i === 3) xp(5, 'Bob asked the identical question and got a different answer — that is session isolation');
    if (i === C.histTurns.length) xp(6, 'Notice each session\'s resend cost climbing');
  }
  $('#hist-next').onclick = () => { next(); xp(1); };
  $('#hist-reset').onclick = () => { i = 0; stream.innerHTML = ''; sess.alice = []; sess.bob = []; paint(); };
  paint();

  const notes = $('#hist-notes');
  if (notes) notes.innerHTML = C.histNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch10 — tool-calling agent
   ============================================================ */
function initAgent() {
  const trace = $('#agent-trace');
  if (!trace) return;
  let step = 0, auto = null;

  const tools = $('#agent-tools');
  if (tools) tools.innerHTML = C.agentTools.map(t =>
    '<div class="toolcard on"><div class="toolcard-h"><b class="mono">@tool ' + t.name + '</b></div>' +
    '<pre class="code">def ' + t.name + '(' + t.args + ') -> dict:\n    """' + t.desc + '"""</pre></div>').join('');

  const LBL = { human: 'HumanMessage', ai: 'AIMessage', tool: 'ToolMessage', final: 'final answer' };
  function next() {
    if (step >= C.agentTrace.length) { stop(); return; }
    const s = C.agentTrace[step++];
    const cls = s.k === 'human' ? 'think' : s.k === 'tool' ? 'observe' : s.k === 'final' ? 'final' : 'act';
    trace.appendChild(el('div', 'trace ' + cls,
      '<span class="tk">' + LBL[s.k] + '</span>' + esc(s.t) +
      (s.tool ? '<div class="tool-call mono">tool_calls: ' + esc(s.tool) + '</div>' : '')));
    trace.scrollTop = trace.scrollHeight;
    $('#agent-iter').textContent = 'iteration ' + Math.ceil(step / 2) + ' of max_iterations=8';
    if (s.k === 'final') { stop(); xp(8, '+8 XP — the executor returned because the model stopped requesting tools'); }
  }
  function stop() { if (auto) { clearInterval(auto); auto = null; $('#agent-auto').textContent = '▶ Run to completion'; } }
  $('#agent-step').onclick = () => { next(); xp(1); };
  $('#agent-auto').onclick = e => { if (auto) return stop(); e.target.textContent = '⏸ Pause'; auto = setInterval(next, 1100); };
  $('#agent-reset').onclick = () => { stop(); step = 0; trace.innerHTML = ''; $('#agent-iter').textContent = 'not started'; };

  const code = $('#agent-code');
  if (code) code.textContent = C.agentCode;

  const notes = $('#agent-notes');
  if (notes) notes.innerHTML = C.agentNotes.map(n =>
    '<div class="gterm"><b>' + n[0] + '</b><span>' + n[1] + '</span></div>').join('');
}

/* ============================================================
   Ch11 — LangGraph
   ============================================================ */
function initGraph() {
  const svg = $('#graph-svg'), stateBox = $('#graph-state'), log = $('#graph-log');
  if (!svg) return;
  let step = -1;
  const NS = 'http://www.w3.org/2000/svg';

  function draw(activeId) {
    svg.innerHTML = '';
    const pos = {};
    C.graphNodes.forEach(n => pos[n.id] = n);

    C.graphEdges.forEach(e => {
      const a = pos[e[0]], b = pos[e[1]];
      const p = document.createElementNS(NS, 'path');
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const bend = e[0] === 'rewrite' ? -18 : 0;
      p.setAttribute('d', 'M' + a.x + ',' + (a.y + 6) + ' Q' + (mx + bend) + ',' + my + ' ' + b.x + ',' + (b.y - 6));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'rgba(255,255,255,.22)');
      p.setAttribute('stroke-width', '.6');
      svg.appendChild(p);
      if (e[2]) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', mx + bend); t.setAttribute('y', my);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '2.6');
        t.setAttribute('fill', '#8b93ad');
        t.textContent = e[2];
        svg.appendChild(t);
      }
    });

    C.graphNodes.forEach(n => {
      const on = n.id === activeId;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', n.x - 13); r.setAttribute('y', n.y - 5.5);
      r.setAttribute('width', 26); r.setAttribute('height', 11); r.setAttribute('rx', 3);
      r.setAttribute('fill', on ? 'rgba(34,197,94,.28)' : 'rgba(14,20,18,.95)');
      r.setAttribute('stroke', on ? '#22c55e' : 'rgba(255,255,255,.28)');
      r.setAttribute('stroke-width', on ? '.9' : '.5');
      svg.appendChild(r);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', n.x); t.setAttribute('y', n.y + 1.4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '3.2');
      t.setAttribute('fill', on ? '#eafff2' : '#c6cdda');
      t.textContent = n.label;
      svg.appendChild(t);
    });
  }

  function render() {
    const r = step >= 0 ? C.graphRun[step] : null;
    draw(r ? r.node : null);
    const st = r ? r.state : { question: '"friday shipping rules"', attempts: 0, docs: null, relevant: null, answer: null };
    stateBox.innerHTML =
      '<div class="lab-pane-title">graph state</div>' +
      '<pre class="code">' + esc('{\n' + Object.keys(st).map(k =>
        '  "' + k + '": ' + JSON.stringify(st[k])).join(',\n') + '\n}') + '</pre>';
    log.innerHTML = r
      ? '<div class="trace ' + (r.node === 'rewrite' ? 'observe' : r.node === 'end' ? 'final' : 'act') + '">' +
        '<span class="tk">' + r.node + '</span>' + esc(r.log) + '</div>'
      : '<p class="panel-sub">Press <b>Next node</b>. The first retrieval deliberately misses, so you can watch the conditional edge send the run back around — the thing an LCEL chain cannot do.</p>';
    $('#graph-count').textContent = step < 0 ? 'not started' : 'node ' + (step + 1) + ' of ' + C.graphRun.length;
  }
  $('#graph-next').onclick = () => {
    if (step < C.graphRun.length - 1) { step++; render(); xp(2); }
    if (step === C.graphRun.length - 1) xp(8, 'The loop caught its own bad retrieval — that is the point of the graph');
  };
  $('#graph-reset').onclick = () => { step = -1; render(); };
  render();
  window.addEventListener('chapterchange', e => { if (e.detail === 'graph') render(); });

  const nodes = $('#graph-nodes');
  if (nodes) nodes.innerHTML = C.graphNodes.filter(n => n.id !== 'end').map(n =>
    '<div class="gterm"><b class="mono">' + n.ico + ' ' + n.label + '</b><span>' + n.desc +
    '<br><i class="mono" style="font-size:11px;opacity:.75">writes: ' + n.effect + '</i></span></div>').join('');

  const code = $('#graph-code');
  if (code) code.textContent = C.graphCode;

  const why = $('#graph-why');
  if (why) why.innerHTML = C.graphWhy.map(w =>
    '<div class="gterm"><b>' + w[0] + '</b><span>' + w[1] + '</span></div>').join('');
}

/* ============================================================
   Ch12 — shipping
   ============================================================ */
function initShip() {
  const arch = $('#arch');
  if (arch) arch.innerHTML = C.arch.map((r, i) =>
    '<div class="abox' + (i === 1 ? ' hl' : '') + '"><b>' + r[0] + '</b><small>' + r[1] + '</small></div>').join('');

  const eco = $('#ecosystem');
  if (eco) eco.innerHTML = C.ecosystem.map(e =>
    '<div class="gterm"><b class="mono">' + e[0] + '</b><span>' + e[1] + '</span></div>').join('');

  const dbg = $('#debug-steps');
  if (dbg) dbg.innerHTML = C.debugSteps.map((d, i) =>
    '<div class="rung"><div class="rung-n">' + (i + 1) + '</div><div><b>' + d[0] + '</b><p>' + d[1] + '</p></div></div>').join('');

  const calc = $('#calc');
  if (calc) {
    const fields = [
      ['req', 'requests / day', 4000],
      ['ctx', 'retrieved context tokens', 1800],
      ['hist', 'history tokens', 900],
      ['tout', 'output tokens', 350],
      ['pin', '$ per 1M input', 3],
      ['pout', '$ per 1M output', 15]
    ];
    calc.innerHTML = fields.map(f =>
      '<div class="calc-f"><label for="c-' + f[0] + '">' + f[1] + '</label><input id="c-' + f[0] + '" type="number" min="0" value="' + f[2] + '"></div>')
      .join('') + '<div class="calc-out" id="calc-out"></div>';

    function run() {
      const v = id => Math.max(0, +($('#c-' + id).value || 0));
      const req = v('req'), tin = v('ctx') + v('hist') + 250, tout = v('tout');
      const day = req * tin / 1e6 * v('pin') + req * tout / 1e6 * v('pout');
      const noCtx = req * (250 + v('hist')) / 1e6 * v('pin') + req * tout / 1e6 * v('pout');
      $('#calc-out').innerHTML = [
        ['input tokens / request', tin.toLocaleString()],
        ['cost / request', '$' + (day / (req || 1)).toFixed(5)],
        ['cost / month', '$' + (day * 30).toFixed(0)],
        ['retrieval\'s share', Math.round((1 - noCtx / (day || 1)) * 100) + '%'],
        ['with prompt caching', '$' + (day * 30 * 0.6).toFixed(0) + '/mo']
      ].map(c => '<div class="stat"><div class="stat-v">' + c[1] + '</div><div class="stat-k">' + c[0] + '</div></div>').join('') +
      '<p class="panel-sub" style="grid-column:1/-1;margin:8px 0 0">Retrieved context is usually the largest line in a RAG bill, and <b>k</b> is the knob nobody tunes. Dropping k from 6 to 3 with a reranker in front often improves answers <i>and</i> halves the cost — the extra chunks were mostly diluting the prompt.</p>';
    }
    $$('input', calc).forEach(i => i.oninput = run);
    run();
  }

  const cl = $('#checklist');
  if (cl) {
    const KEY = 'lcflow.checklist';
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
    const msg = pct === 100 ? 'Perfect. Go build the RAG app — you know where the bodies are buried.'
      : pct >= 75 ? 'Strong. You could review someone else\'s chain and spot the real problems.'
      : pct >= 50 ? 'Solid start — revisit the chapters behind the misses, especially LCEL and retrieval.'
      : 'Worth another pass. The Runnable interface is the key that unlocks everything else.';
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
   Plain-English opener — injected under every chapter heading.
   Content lives in C.plain (content.js), keyed by data-id.
   Left column: an everyday example. Right column: the same
   idea in code. Collapsible via native <details>, open by default.
   ============================================================ */
function initPlain() {
  if (!window.C || !C.plain) return;
  const md = s => esc(s).replace(/`([^`]+)`/g, '<span class="mono">$1</span>');
  const paras = s => s.split('\n\n').map(p => '<p>' + md(p) + '</p>').join('');

  $$('.chapter').forEach(ch => {
    const p = C.plain[ch.dataset.id];
    if (!p) return;
    const anchor = $('.ch-head', ch) || $('.hero-sub', ch);
    if (!anchor) return;

    const d = el('details', 'plain');
    d.open = true;
    d.innerHTML =
      '<summary class="plain-sum">' +
        '<span class="plain-ico">\uD83D\uDCA1</span>' +
        '<span class="plain-q">' + esc(p.q) + '</span>' +
        '<span class="plain-hint">plain English</span>' +
      '</summary>' +
      '<div class="plain-grid">' +
        '<div class="plain-col">' +
          '<h4>\uD83C\uDF0D Everyday version</h4>' +
          '<h5>' + esc(p.lay.t) + '</h5>' + paras(p.lay.b) +
        '</div>' +
        '<div class="plain-col">' +
          '<h4>\uD83D\uDCBB The same thing in code</h4>' +
          '<h5>' + esc(p.tech.t) + '</h5>' + paras(p.tech.b) +
          '<pre class="code">' + esc(p.tech.code) + '</pre>' +
        '</div>' +
      '</div>';
    anchor.insertAdjacentElement('afterend', d);
  });
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initPlain, initBackground, initWhy, initMessages, initTemplates, initLcel, initParsers,
   initSplitter, initVectors, initRag, initHistory, initAgent, initGraph, initShip, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
