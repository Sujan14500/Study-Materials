/* ============================================================
   ragspeed8.js — eight engineering fixes for a slow RAG pipeline,
   applied to a live waterfall.

   Self-mounting: put <div id="ragspeed8"></div> in the page.

   Same data, same model, same answers — only engineering. Toggle a
   fix and the bar re-draws, because the point of the widget is the
   part the viral version of this list always leaves out: seven of
   the eight fixes attack the 1.5 seconds around the model, and none
   of them touch the 3.2 seconds of decode in the middle of it. Turn
   everything on and the honest floor is still generation.

   Numbers are a plausible p95 for a mid-sized RAG endpoint. They are
   here to be reasoned about, not quoted: the shape is the lesson.
   ============================================================ */
(function () {
'use strict';

/* ---------- the pipeline, before anyone optimises it ---------- */
const SPANS = [
  { id: 'connect', n: 'TCP + TLS handshakes', s: 'three fresh connections: vector DB, cache, provider', ms: 180, c: '#94a3b8' },
  { id: 'embed',   n: 'Embed the query',      s: 'round trip to a hosted embedding API',                ms: 130, c: '#22d3ee' },
  { id: 'guard',   n: 'Input guardrail',      s: 'injection + moderation classifier, awaited',           ms: 150, c: '#fb7185' },
  { id: 'dense',   n: 'Vector search',        s: 'top 100 over the whole index',                         ms:  55, c: '#60a5fa' },
  { id: 'bm25',    n: 'Keyword search',       s: 'BM25 lane, started after the vector lane finished',    ms:  45, c: '#34d399' },
  { id: 'rerank',  n: 'Cross-encoder rerank', s: '100 candidates through a full cross-encoder',          ms: 240, c: '#a78bfa' },
  { id: 'prefill', n: 'Prefill',              s: '10 chunks ≈ 5,000 tokens of context',                  ms: 700, c: '#fbbf24' },
  { id: 'decode',  n: 'Decode',               s: '320 output tokens, one forward pass each',             ms: 3200, c: '#f472b6' }
];

/* ---------- the eight fixes ---------- */
const FIXES = [
  { id: 'cache', n: 'Semantic cache', ico: '🗃️', free: true,
    does: 'Embed the incoming question and serve a stored answer when a previous question is close enough. A hit skips the entire pipeline.',
    not: 'It does not make a miss any faster, and it is the only fix here that can return a <i>wrong</i> answer — which is why the key carries tenant, prompt version and document versions, and why you measure precision on hits, not just hit rate.',
    effect: 'Adds a ~45 ms hit path. At a 35% hit rate the average request falls by about a third.' },

  { id: 'chunks', n: 'Fewer, better chunks', ico: '✂️', free: false,
    does: 'Ten chunks of 500 tokens is 5,000 tokens the model reads before writing a word. Three well-chosen ones prefill in a fraction of the time.',
    not: 'This is the one lever that can cost you an answer, so it is the one you measure on the eval set. In practice context precision usually goes <i>up</i> — the distractors were hurting the answer as well as the clock.',
    effect: 'Prefill 700 ms → 230 ms.' },

  { id: 'stream', n: 'Stream the response', ico: '📡', free: true,
    does: 'Send tokens as they are produced instead of waiting for the last one.',
    not: 'It does not remove a single millisecond of work. It moves what the user experiences as waiting from the total to the time-to-first-token — which is why the two numbers below move independently.',
    effect: 'Total unchanged. Time to first token drops to everything-before-decode.' },

  { id: 'localemb', n: 'Co-locate the embedding model', ico: '🧬', free: true,
    does: 'A small embedding model running in your own process, instead of a network round trip per query.',
    not: 'It does not have to be all-or-nothing: query embedding is latency-critical and tiny, index embedding is a batch job that can stay on the API.',
    effect: 'Query embedding 130 ms → 9 ms.' },

  { id: 'filter', n: 'Filter before you search', ico: '🎚️', free: true,
    does: 'Push tenant, date and department into the vector query as a predicate rather than retrieving broadly and discarding afterwards.',
    not: 'It is not only a latency fix — post-filtering also wrecks recall, because retrieving 100 and keeping 3 leaves you three results where you asked for ten.',
    effect: 'Vector search 55 → 22 ms, BM25 45 → 20 ms.' },

  { id: 'rerank', n: 'Rerank proportionately', ico: '🎯', free: false,
    does: 'Rerank the top 20 rather than the top 100, with a small cross-encoder, and skip it entirely for queries the retriever already answered confidently.',
    not: 'It does not mean dropping the reranker. Reranking is usually the largest single quality lever in retrieval; the fix is spending it on 20 candidates instead of 100.',
    effect: 'Rerank 240 ms → 70 ms.' },

  { id: 'parallel', n: 'Parallelise the independent work', ico: '⇉', free: true,
    does: 'The vector lane, the keyword lane and the input guardrail share no state. Run them concurrently and the group costs the slowest one, not the sum.',
    not: 'It cannot help the parts that genuinely depend on each other: you cannot rerank before you retrieve, or prefill before you have chunks.',
    effect: 'guardrail + dense + BM25 → max of the three.' },

  { id: 'pool', n: 'Connection pooling', ico: '🔌', free: true,
    does: 'Open connections once at process start and keep them alive, instead of a fresh TCP and TLS handshake to three services on every request.',
    not: 'Nothing. This one is free, invisible and almost always missing — the most boring 170 ms you will ever recover.',
    effect: '180 ms → 6 ms.' }
];

/* ---------- the model ----------
   One place that answers "what does the waterfall look like with this
   set of fixes on", so the bars, the numbers and the notes can never
   disagree with each other. */
function pipeline(on) {
  const base = {};
  SPANS.forEach(s => base[s.id] = s.ms);

  if (on.localemb) base.embed = 9;
  if (on.filter) { base.dense = 22; base.bm25 = 20; }
  if (on.rerank) base.rerank = 70;
  if (on.chunks) base.prefill = 230;
  if (on.pool) base.connect = 6;

  const rows = [];
  const push = (id, ms, note) => {
    const s = SPANS.find(x => x.id === id);
    rows.push({ id, n: s.n, sub: note || s.s, ms, c: s.c });
  };

  push('connect', base.connect);
  push('embed', base.embed);
  if (on.parallel) {
    const ms = Math.max(base.guard, base.dense, base.bm25);
    rows.push({ id: 'group', n: 'Guardrail ∥ vector ∥ BM25', c: '#fb7185', ms,
      sub: 'concurrent — the group costs the slowest lane (' + base.guard + ' / ' + base.dense + ' / ' + base.bm25 + ' ms)' });
  } else {
    push('guard', base.guard);
    push('dense', base.dense);
    push('bm25', base.bm25);
  }
  push('rerank', base.rerank);
  push('prefill', base.prefill);
  push('decode', base.decode);

  const total = rows.reduce((a, r) => a + r.ms, 0);
  const beforeDecode = total - base.decode;
  return {
    rows, total,
    ttft: on.stream ? beforeDecode + 40 : total,
    hit: on.cache ? 45 : null,
    blended: on.cache ? Math.round(0.35 * 45 + 0.65 * total) : total
  };
}

/* the test re-derives every claim the widget makes on screen, with no
   browser in sight, so publish the model itself and not just the data */
if (typeof window !== 'undefined') window.RAGSPEED8 = { SPANS, FIXES, pipeline };

/* ============================================================
   rendering
   ============================================================ */
const root = typeof document !== 'undefined' && document.getElementById('ragspeed8');
if (!root) return;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const ms = v => v >= 1000 ? (v / 1000).toFixed(2) + ' s' : v + ' ms';

const on = {};
FIXES.forEach(f => on[f.id] = false);
let openFix = null;

const BASE = pipeline({}).total;

function paint() {
  const p = pipeline(on);
  const scale = 100 / BASE;
  const count = FIXES.filter(f => on[f.id]).length;

  root.innerHTML =
    '<div class="r8-chips">' +
      FIXES.map(f => '<button class="r8-chip' + (on[f.id] ? ' on' : '') + '" data-f="' + f.id + '">' +
        f.ico + ' ' + esc(f.n) + '</button>').join('') +
      '<button class="r8-chip all" data-f="__all">' + (count === FIXES.length ? '↺ Reset' : '✦ All eight') + '</button>' +
    '</div>' +

    '<div class="r8-stats">' +
      stat('End to end', ms(p.total), p.total <= 1500 ? 'ok' : p.total <= 3800 ? 'mid' : 'bad',
           count ? '−' + ms(BASE - p.total) + ' from baseline' : 'baseline, nothing turned on') +
      stat('Time to first token', ms(p.ttft), p.ttft <= 900 ? 'ok' : p.ttft <= 2000 ? 'mid' : 'bad',
           on.stream ? 'streaming — the number the user feels' : 'not streaming, so the user waits for all of it') +
      stat('Cache hit path', p.hit ? ms(p.hit) : '—', p.hit ? 'ok' : 'off',
           p.hit ? 'blended average ' + ms(p.blended) + ' at a 35% hit rate' : 'every request runs the whole pipeline') +
    '</div>' +

    '<div class="r8-bar">' + p.rows.map((r, i) =>
      '<span class="r8-seg" style="--w:' + (r.ms * scale) + '%;--c:' + r.c + ';--d:' + (i * 0.04) + 's" ' +
        'title="' + esc(r.n) + ' — ' + ms(r.ms) + '"></span>').join('') +
      '<span class="r8-ghost" style="--w:' + ((BASE - p.total) * scale) + '%"></span>' +
      (on.stream ? '<span class="r8-mark" style="--x:' + (p.ttft * scale) + '%"><i></i><b>first token</b></span>' : '') +
    '</div>' +

    '<div class="r8-rows">' + p.rows.map(r =>
      '<div class="r8-row" style="--c:' + r.c + '">' +
        '<span class="r8-rn">' + esc(r.n) + '<i>' + r.sub + '</i></span>' +
        '<span class="r8-rb"><span style="width:' + (r.ms / BASE * 100) + '%"></span></span>' +
        '<span class="r8-rms">' + ms(r.ms) + '</span>' +
      '</div>').join('') + '</div>' +

    '<div class="r8-cards">' + FIXES.map(f =>
      '<article class="r8-card' + (on[f.id] ? ' on' : '') + (openFix === f.id ? ' open' : '') + '" data-f="' + f.id + '">' +
        '<button class="r8-ch"><span class="r8-ico">' + f.ico + '</span>' +
          '<span class="r8-cn"><b>' + esc(f.n) + '</b><i>' + f.effect + '</i></span>' +
          '<span class="r8-tag' + (f.free ? '' : ' pay') + '">' + (f.free ? 'free' : 'trades quality') + '</span>' +
        '</button>' +
        (openFix === f.id ? '<div class="r8-body"><p>' + f.does + '</p>' +
          '<p class="r8-not"><b>What it does not do.</b> ' + f.not + '</p></div>' : '') +
      '</article>').join('') + '</div>' +

    '<div class="r8-verdict">' + verdict(p, count) + '</div>';

  root.querySelectorAll('.r8-chip').forEach(b => b.onclick = () => {
    if (b.dataset.f === '__all') {
      const all = FIXES.every(f => on[f.id]);
      FIXES.forEach(f => on[f.id] = !all);
    } else on[b.dataset.f] = !on[b.dataset.f];
    paint();
  });
  root.querySelectorAll('.r8-ch').forEach(b => b.onclick = () => {
    const id = b.parentElement.dataset.f;
    if (openFix === id) { openFix = null; } else { openFix = id; on[id] = true; }
    paint();
  });
}

function stat(label, value, kind, sub) {
  return '<div class="r8-stat ' + kind + '"><b>' + label + '</b><strong>' + value + '</strong>' +
    '<span>' + sub + '</span></div>';
}

function verdict(p, count) {
  if (!count) return '<b>Baseline: ' + ms(p.total) + '.</b> A pipeline nobody has profiled, doing everything ' +
    'in sequence, on connections it opens fresh every request. Nothing here is a bad model or bad data — ' +
    'it is 1.5 seconds of engineering wrapped around 3.2 seconds of generation.';
  if (count === FIXES.length) return '<b>All eight on: ' + ms(p.total) + ' end to end, ' + ms(p.ttft) +
    ' to first token, ' + ms(p.hit) + ' on a cache hit.</b> Now read what is left. Almost all of the ' +
    'non-generation time is gone, and <b>decode has not moved by a millisecond</b> — no amount of ' +
    'pipeline engineering shortens 320 forward passes. That is the honest ending the eight-tips version ' +
    'of this list leaves out: past this point the levers are a smaller model, shorter outputs, ' +
    'speculative decoding or better serving — and every one of those is a different conversation.';
  const led = FIXES.filter(f => on[f.id]).map(f => f.n.toLowerCase());
  return '<b>' + count + ' of 8 on: ' + ms(p.total) + '.</b> ' +
    'Running ' + led.join(', ') + '. The largest remaining segment is <b>' +
    p.rows.reduce((a, r) => r.ms > a.ms ? r : a).n.toLowerCase() + '</b> — which is where the next hour ' +
    'of your time belongs, rather than wherever the last blog post said.';
}

paint();
})();
