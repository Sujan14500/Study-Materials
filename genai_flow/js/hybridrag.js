/* ============================================================
   hybridrag.js — hybrid RAG end to end, then the fusion step
   taken apart.

   Self-mounting: put <div id="hybridrag"></div> in the page.

   Two halves, because the picture and the mechanism teach different
   things. The top half animates the whole shape: index once into two
   stores, query both, fuse, stuff, generate. The bottom half is the
   part every diagram draws as a funnel and never explains — reciprocal
   rank fusion — computed live on three queries chosen so that a
   different lane wins each time.

   The claim being made: hybrid is not "semantic search plus a bit of
   keyword search for safety". The two lanes fail in different places,
   and fusion is what turns two partial rankings into one good one.
   ============================================================ */
(function () {
'use strict';

/* ============================================================
   1. the pipeline
   ============================================================ */
const STAGES = [
  { id: 'index', n: 'Indexing', ico: '📥', c: '#a78bfa', once: 'once, offline',
    lead: 'Every document is written to <b>two</b> stores, from the same chunks.',
    steps: [
      ['Parse', 'PDF, HTML, email or slide deck into text with its structure intact — headings, tables and lists surviving as themselves.'],
      ['Chunk', 'Split into retrievable units, heading path prepended. The same chunk text feeds both stores, which is what makes the two rankings comparable later.'],
      ['Embed → vector store', 'One vector per chunk, indexed with HNSW or IVF. This lane knows what text means.'],
      ['Tokenise → BM25 index', 'An inverted index of terms with their document frequencies. This lane knows which words are rare — and therefore which are worth matching exactly.']
    ],
    why: 'The cost of hybrid lives here: two indexes to build, two to keep in sync, and two places for an ingestion bug to hide. Everything downstream is nearly free by comparison.' },

  { id: 'retrieve', n: 'Retrieval', ico: '🔀', c: '#22d3ee', once: 'per query',
    lead: 'Both lanes run <b>concurrently</b> on the same query, and neither waits for the other.',
    steps: [
      ['Embed the query', 'Same model that embedded the chunks. A different model here is the single most common silent breakage in RAG.'],
      ['Semantic search', 'Top 50 by cosine. Strong on paraphrase, intent and synonymy; weak on identifiers, numbers and negation.'],
      ['Keyword search', 'Top 50 by BM25. Strong on error codes, SKUs, function names and any term coined after the embedding model was trained.'],
      ['Fuse the rankings', 'Reciprocal rank fusion over both lists — the mechanism taken apart below.']
    ],
    why: 'Run the two lanes in sequence and you pay for both. Run them concurrently and you pay for the slower one, which is almost always the vector search. This is a two-line change most pipelines never make.' },

  { id: 'augment', n: 'Augment', ico: '🧩', c: '#60a5fa', once: 'per query',
    lead: 'The fused top chunks become <b>context</b>, and context is a budget, not a bucket.',
    steps: [
      ['Rerank', 'A cross-encoder reads query and chunk together and re-sorts the top 20. It cannot rescue a chunk retrieval never returned.'],
      ['Deduplicate and trim', 'Near-identical chunks waste the budget twice; drop them and keep the top few.'],
      ['Build the prompt', 'System rules, then the chunks with their ids, then the question. Stable content first so the provider prefix cache can hold it.'],
      ['Mark the boundary', 'Say explicitly that retrieved text is data, not instruction — the cheapest defence against injection from a poisoned document.']
    ],
    why: 'More chunks is not more accuracy. Precision at this step drives both the answer quality and the prefill cost, and it is the step where teams routinely stuff ten chunks and blame the model.' },

  { id: 'generate', n: 'Generate', ico: '✨', c: '#34d399', once: 'per query',
    lead: 'The model answers <b>from the context</b>, and says so with citations.',
    steps: [
      ['Generate', 'Instructed to answer only from the supplied chunks and to say when they do not contain the answer.'],
      ['Cite', 'Every claim carries the id of the chunk it came from — verified against what was actually retrieved, not trusted.'],
      ['Check groundedness', 'Score the answer against the context; a low score routes to a fallback rather than to the user.'],
      ['Stream', 'First token in a few hundred milliseconds, so the wait stops feeling like the total.']
    ],
    why: 'Grounding is an instruction plus a check, not an instruction alone. Without the verification step "cite your sources" produces beautifully formatted citations to chunks that were never retrieved.' }
];

/* ============================================================
   2. the fusion bench
   ============================================================ */
const DOCS = {
  d1: 'Refund policy — processing times',
  d2: 'Error E-4055: payment declined at capture',
  d3: 'Cancelling a subscription mid-term',
  d4: 'Chargeback handling for merchants',
  d5: 'Release notes 4.2 — refund API changes',
  d6: 'Payment method troubleshooting'
};

const QUERIES = [
  { q: 'how long until I get my money back?', answer: 'd1',
    dense: ['d1', 'd3', 'd5', 'd6', 'd2'],
    bm25:  ['d5', 'd4', 'd1'],
    verdict: '<b>The semantic lane wins.</b> Not one content word of the question appears in the answering document — "money back" is not "refund", and BM25 has nothing to match. This is the query type that made everyone buy a vector database.' },

  { q: 'error E-4055', answer: 'd2',
    dense: ['d6', 'd4', 'd2', 'd1'],
    bm25:  ['d2', 'd6'],
    verdict: '<b>Only the keyword lane finds it — and fusion still ranks it second.</b> To an embedding model every error code looks like every other error code: rare tokens with almost no learned meaning. BM25 treats that rarity as the signal, which is exactly right. But look at the fused column: <code>d6</code> is second in one lane and second in the other, and RRF <i>rewards agreement</i>, so a document both lanes quite like edges out one lane\'s clear winner. That is the honest limitation of plain rank fusion, and the two production answers to it are weighting the lanes (or boosting the lexical lane when the query looks like an identifier) and putting a reranker after the fusion, which reads the query and the chunk together and undoes exactly this.' },

  { q: 'refund API returns 402 for cancelled subscriptions', answer: 'd5',
    dense: ['d3', 'd5', 'd1', 'd6'],
    bm25:  ['d2', 'd5', 'd4'],
    verdict: '<b>Neither lane puts it first — fusion does.</b> The question is half meaning ("cancelled subscriptions") and half literal ("refund API", "402"), so each lane ranks the answering document second and something else first. Because the two lanes disagree about their winners and agree about <code>d5</code>, fusion promotes it to the top. This is the case hybrid search exists for, and it is invisible if you only ever look at one lane\'s results.' }
];

/* Reciprocal rank fusion. Ranks only, so a cosine and a BM25 score living on
   incomparable scales cannot fight — which is the entire reason it is the default. */
function rrf(lists, k) {
  k = k || 60;
  const score = {};
  lists.forEach(list => list.forEach((id, i) => {
    score[id] = (score[id] || 0) + 1 / (k + i + 1);
  }));
  /* ties are real and common — two documents at ranks 1 and 3 in opposite lanes
     score identically — and float addition order must not decide the display,
     so equal-within-epsilon falls back to a stable tie-break */
  return Object.keys(score)
    .sort((a, b) => {
      const d = score[b] - score[a];
      return Math.abs(d) > 1e-12 ? d : a.localeCompare(b);
    })
    .map(id => ({ id, s: score[id] }));
}

if (typeof window !== 'undefined') window.HYBRIDRAG = { STAGES, DOCS, QUERIES, rrf };

/* ============================================================
   rendering
   ============================================================ */
const root = typeof document !== 'undefined' && document.getElementById('hybridrag');
if (!root) return;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const REDUCED = typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let stage = 0, qi = 0, timer = null;

/* ---------- the drawing ----------
   One SVG, four stage groups, the active one lit. Deliberately the same
   shape as the diagram everyone has seen, so the extra thing this one
   does — showing the two lanes running side by side rather than in
   sequence — is the only difference to notice. */
function diagram() {
  const box = (x, y, w, h, t, s, cls) =>
    '<g class="hr-box ' + (cls || '') + '" transform="translate(' + x + ',' + y + ')">' +
      '<rect width="' + w + '" height="' + h + '" rx="9"/>' +
      '<text class="hr-bt" x="' + w / 2 + '" y="' + (s ? h / 2 - 3 : h / 2 + 4) + '">' + t + '</text>' +
      (s ? '<text class="hr-bs" x="' + w / 2 + '" y="' + (h / 2 + 12) + '">' + s + '</text>' : '') +
    '</g>';
  const wire = (d, cls) => '<path class="hr-wire ' + (cls || '') + '" d="' + d + '"/>';

  return '<svg class="hr-svg" viewBox="0 0 880 300" aria-label="Hybrid RAG: two indexes, two retrieval lanes, one fused ranking">' +
    /* ---- stage 1: indexing ---- */
    '<g class="hr-stage" data-s="0">' +
      box(14, 24, 86, 40, 'document', 'PDF · HTML') +
      box(118, 24, 78, 40, 'chunks', 'with headings') +
      wire('M100 44 H118') +
      box(214, 4, 108, 38, 'embedding model', '', 'alt') +
      box(214, 60, 108, 38, 'tokeniser', '', 'alt') +
      wire('M196 40 C206 40, 206 23, 214 23') +
      wire('M196 48 C206 48, 206 79, 214 79') +
      box(340, 4, 104, 38, 'vector store', '') +
      box(340, 60, 104, 38, 'BM25 index', '') +
      wire('M322 23 H340') + wire('M322 79 H340') +
    '</g>' +

    /* ---- stage 2: retrieval, the two lanes ---- */
    '<g class="hr-stage" data-s="1">' +
      box(14, 150, 86, 40, 'query', 'from a user') +
      wire('M100 170 C120 170, 120 137, 152 137', 'a') +
      wire('M100 170 C120 170, 120 205, 152 205', 'b') +
      box(152, 118, 130, 38, 'semantic search', 'top 50 · cosine', 'a') +
      box(152, 186, 130, 38, 'keyword search', 'top 50 · BM25', 'b') +
      wire('M392 23 C420 23, 300 100, 282 118', 'thin') +
      wire('M392 79 C420 79, 300 186, 282 186', 'thin') +
      wire('M282 137 C310 137, 310 165, 330 165', 'a') +
      wire('M282 205 C310 205, 310 173, 330 173', 'b') +
      box(330, 146, 96, 40, 'fuse', 'RRF', 'hi') +
      wire('M426 166 H452') +
      box(452, 146, 96, 40, 'rerank', 'top 20') +
    '</g>' +

    /* ---- stage 3: augment ---- */
    '<g class="hr-stage" data-s="2">' +
      wire('M548 166 H578') +
      box(578, 146, 96, 40, 'context', '3–5 chunks') +
      wire('M626 146 V108') +
      box(578, 68, 96, 36, 'prompt', 'rules + chunks + question') +
    '</g>' +

    /* ---- stage 4: generate ---- */
    '<g class="hr-stage" data-s="3">' +
      wire('M674 86 H706') +
      box(706, 66, 78, 40, 'LLM', '') +
      wire('M745 106 V146') +
      box(700, 146, 90, 40, 'answer', 'with citations', 'ok') +
    '</g>' +

    '<text class="hr-cap" x="14" y="248">index once, offline</text>' +
    '<text class="hr-cap" x="152" y="248">both lanes run concurrently — the group costs the slower one</text>' +
  '</svg>';
}

/* ---------- the fusion bench ---------- */
function bench() {
  const Q = QUERIES[qi];
  const fused = rrf([Q.dense, Q.bm25]);
  const rank = (list, id) => { const i = list.indexOf(id); return i < 0 ? '—' : '#' + (i + 1); };

  const lane = (title, sub, list, cls) =>
    '<div class="hr-lane ' + cls + '"><h5>' + title + '<span>' + sub + '</span></h5>' +
      '<ol>' + list.map(id =>
        '<li' + (id === Q.answer ? ' class="win"' : '') + '><b>' + id + '</b>' + esc(DOCS[id]) + '</li>').join('') +
      '</ol></div>';

  return '<div class="hr-qs">' + QUERIES.map((x, i) =>
      '<button class="hr-q' + (i === qi ? ' on' : '') + '" data-q="' + i + '">' + esc(x.q) + '</button>').join('') +
    '</div>' +
    '<div class="hr-lanes">' +
      lane('Semantic lane', 'cosine over embeddings', Q.dense, 'a') +
      lane('Keyword lane', 'BM25 over the inverted index', Q.bm25, 'b') +
      '<div class="hr-lane f"><h5>Fused<span>RRF, k = 60</span></h5><ol>' +
        fused.map(f => '<li' + (f.id === Q.answer ? ' class="win"' : '') + '><b>' + f.id + '</b>' +
          esc(DOCS[f.id]) + '<i>' + f.s.toFixed(4) + '</i></li>').join('') +
      '</ol></div>' +
    '</div>' +
    '<div class="hr-math"><code>score(d) = Σ&nbsp;1 / (60 + rank(d))</code> — ' +
      'the answering document sits at <b>' + rank(Q.dense, Q.answer) + '</b> in the semantic lane, ' +
      '<b>' + rank(Q.bm25, Q.answer) + '</b> in the keyword lane, and ' +
      '<b>#' + (fused.findIndex(f => f.id === Q.answer) + 1) + '</b> after fusion.</div>' +
    '<div class="hr-verdict">' + Q.verdict + '</div>';
}

function paint() {
  const S = STAGES[stage];
  root.innerHTML =
    '<div class="hr-stagebar">' + STAGES.map((s, i) =>
      '<button class="hr-tab' + (i === stage ? ' on' : '') + '" data-s="' + i + '" style="--c:' + s.c + '">' +
        '<span>' + s.ico + '</span><b>' + (i + 1) + '. ' + s.n + '</b><i>' + s.once + '</i></button>').join('') +
      '<button class="hr-play">' + (timer ? '⏸ Pause' : '▶ Play') + '</button>' +
    '</div>' +
    '<div class="hr-figure" data-on="' + stage + '">' + diagram() + '</div>' +
    '<div class="hr-detail" style="--c:' + S.c + '">' +
      '<p class="hr-lead">' + S.lead + '</p>' +
      '<ol class="hr-steps">' + S.steps.map(s =>
        '<li><b>' + esc(s[0]) + '</b>' + esc(s[1]) + '</li>').join('') + '</ol>' +
      '<div class="hr-why"><span>✦</span><p>' + esc(S.why) + '</p></div>' +
    '</div>' +
    '<div class="hr-bench"><h4>Fusion, computed</h4>' +
      '<p class="hr-bsub">Three queries, one corpus. Watch which lane finds the answering document — ' +
      'starred below — and what fusion does with two disagreeing rankings.</p>' + bench() + '</div>';

  root.querySelectorAll('.hr-tab').forEach(b => b.onclick = () => { stop(); stage = +b.dataset.s; paint(); });
  root.querySelectorAll('.hr-q').forEach(b => b.onclick = () => { qi = +b.dataset.q; paint(); });
  root.querySelector('.hr-play').onclick = () => timer ? (stop(), paint()) : (start(), paint());
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }
function start() {
  timer = setInterval(() => {
    stage = (stage + 1) % STAGES.length;
    paint();
    if (stage === STAGES.length - 1) { stop(); }
  }, 4200);
}

paint();

/* autoplay once, when the chapter is actually on screen, and never for
   someone who asked the operating system for less motion */
if (!REDUCED && typeof IntersectionObserver !== 'undefined') {
  const io = new IntersectionObserver(en => {
    if (en[0].isIntersecting) { io.disconnect(); if (!timer) { start(); paint(); } }
  }, { threshold: 0.3 });
  io.observe(root);
}
})();
