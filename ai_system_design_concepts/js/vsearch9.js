/* ============================================================
   vsearch9.js — the nine ways to search a vector index, drawn.

   Self-mounting: put <div id="vsearch9"></div> in the page and
   this fills it.

   The argument the widget is making: these are not nine competing
   products, they are nine answers to one question — "which vectors
   am I allowed to skip, and what does skipping them cost?" Brute
   force skips none and is exact. Everything else trades a named
   amount of recall for a named amount of memory or latency, and
   the last two do not compress at all: they change what is even
   in the candidate set.

   Every picture below is CSS animation over static SVG — no timers,
   no canvas, and it stops for prefers-reduced-motion.
   ============================================================ */
(function () {
'use strict';

/* ---------- the nine ---------- */
const T = [

{ n: 1, id: 'flat', name: 'Exact / brute force', ico: '🎯', c: '#f472b6', viz: 'scan',
  one: 'Compare the query with every single vector and keep the best k.',
  bullets: ['Compares the query with every vector', 'Returns the true nearest neighbours', 'Fine until the corpus stops being small'],
  how: 'One matrix multiply of the query against the whole corpus, then a partial sort. No index to build, no parameters to tune, nothing to get wrong. Cost is O(N·d) per query, and that is linear in a way that does not forgive growth: 10k vectors is a millisecond, 10M is seconds, and 10M with fifty queries a second is a fleet.',
  cost: 'Latency grows linearly with the corpus. Memory holds every full-precision vector.',
  recall: '100% — this is the definition of correct that everything else is measured against.',
  use: 'Under ~100k vectors, or per-tenant indexes that are individually tiny. Also the reference implementation you measure every approximate index against.',
  line: 'Keep a brute-force path in the codebase even after you ship an index. It is how you compute the recall number that makes every other claim in this chapter checkable.' },

{ n: 2, id: 'ann', name: 'Approximate nearest neighbour', ico: '🌐', c: '#60a5fa', viz: 'ball',
  one: 'Agree to look at a small neighbourhood of the query and accept that you may miss one.',
  bullets: ['Finds near neighbours, not provably the nearest', 'Sub-linear instead of linear', 'Recall becomes a number you tune'],
  how: 'ANN is the family, not a specific algorithm: any structure that lets a query examine a small fraction of the corpus and still land on mostly-correct neighbours. HNSW and IVF below are the two that won. What every member shares is the bargain — you stop being able to say "these are the nearest", and start saying "these are the nearest 95% of the time, in 4 ms".',
  cost: 'An index to build and keep, plus parameters that trade recall against latency.',
  recall: 'Whatever you tune it to. 90–99% is the normal operating range; the last few points cost the most.',
  use: 'Any corpus large enough that a full scan misses the latency budget — which in practice starts around a few hundred thousand vectors.',
  line: 'The word "approximate" is the entire interview. If you cannot say what recall your index is running at, you have not chosen a trade-off, you have accepted a default.' },

{ n: 3, id: 'hnsw', name: 'HNSW', ico: '🕸️', c: '#a78bfa', viz: 'layers',
  one: 'A layered graph: long hops at the top to get near, short hops at the bottom to get right.',
  bullets: ['Graph-based, searched greedily from the top down', 'Highest recall per millisecond', 'Highest memory bill of the family'],
  how: 'Each vector is a node with links to its neighbours. Nodes are assigned to layers with exponentially decreasing probability, so the top layer is sparse with very long links and the bottom holds everything with short ones. A search enters at the top, walks greedily towards the query, drops a layer when it cannot improve, and repeats. <code>efSearch</code> — how many candidates the walk keeps — is the recall dial; <code>M</code> — links per node — is the memory dial.',
  cost: 'The graph itself is roughly M×2 links per node on top of the vectors: expect 1.5–2× the raw vector memory, all of it resident.',
  recall: '95–99% at low latency, better than IVF at the same latency in almost every published benchmark.',
  use: 'The default when the vectors fit in RAM and latency matters. Poor fit for corpora that are mostly deletes, or that must live on disk.',
  line: 'HNSW is where you start and RAM is what moves you off it. The question that decides it is arithmetic, not preference: bytes per vector × vectors × replicas.' },

{ n: 4, id: 'ivf', name: 'IVF — inverted file index', ico: '🧩', c: '#22d3ee', viz: 'cells',
  one: 'Cluster the corpus once, then only open the cells nearest the query.',
  bullets: ['k-means partitions the space into nlist cells', 'A query opens nprobe of them and ignores the rest', 'Cheap to build, easy to shard'],
  how: 'Build: run k-means over a sample to get <code>nlist</code> centroids, then assign every vector to its nearest one. Query: compare against the centroids, open the <code>nprobe</code> closest cells, scan the vectors inside them. Work drops by roughly nprobe/nlist. The failure mode is geometric and worth naming — a true neighbour sitting just across a cell boundary is invisible unless nprobe opens its cell too, which is why recall climbs steeply with the first few probes and then flattens.',
  cost: 'Almost no memory overhead beyond the vectors and the centroid table. Rebuild needed when the distribution drifts.',
  recall: 'nprobe is the dial: 1 probe is fast and lossy, 16 probes is most of brute force\'s work back.',
  use: 'Large corpora, batch-friendly workloads, and anywhere the index must be rebuilt or sharded regularly. Pairs naturally with quantisation.',
  line: 'nlist ≈ √N is the usual starting point, and then you sweep nprobe against recall on a golden set. The curve flattens; where it flattens is your operating point.' },

{ n: 5, id: 'ivfpq', name: 'IVF-PQ', ico: '🗜️', c: '#2dd4bf', viz: 'cellcode',
  one: 'Use IVF to decide where to look, and compressed codes to make looking cheap.',
  bullets: ['IVF narrows the candidate set', 'PQ shrinks each candidate to a few bytes', 'Billions of vectors on hardware you can afford'],
  how: 'The workhorse of large-scale search, and the reason a billion vectors is a normal thing to serve. IVF picks the cells; inside them, vectors are stored as product-quantised codes rather than floats, so the scan reads 16–64 bytes per vector instead of 3072. Distances are computed against the codebook with lookup tables. Almost every deployment adds a rescoring stage: take the top few hundred by code distance, fetch their full vectors, and re-rank exactly.',
  cost: 'A codebook to train, a rebuild path to own, and a recall loss you have to measure rather than assume.',
  recall: 'Good with rescoring, mediocre without. The oversample factor is the second dial after nprobe.',
  use: 'Corpus in the hundreds of millions or billions, or any time the memory arithmetic says full vectors will not fit.',
  line: 'This is the index behind "we serve a billion vectors". Naming IVF-PQ plus rescoring — rather than just "we use Faiss" — is what makes the answer sound like it came from an operator.' },

{ n: 6, id: 'pq', name: 'Product quantisation', ico: '📦', c: '#fbbf24', viz: 'bits',
  one: 'Chop each vector into pieces and store the id of the nearest codebook entry for each piece.',
  bullets: ['Splits the vector into m sub-vectors', 'Replaces each with one byte of codebook id', 'Compression, not a search structure'],
  how: 'Split a 768-d vector into m=96 sub-vectors of 8 dimensions. Run k-means separately in each of those 8-d subspaces to get 256 centroids, and store the id of the nearest one — one byte per sub-vector. The vector stops being 3072 bytes of floats and becomes 96 bytes of integers, a 32× cut. Distances are approximated by summing precomputed sub-distances from a lookup table, which is also why the arithmetic gets faster: table lookups instead of float multiplies.',
  cost: 'Codebook training at build time, an approximation error you cannot remove, and re-training when the data distribution moves.',
  recall: 'Depends entirely on m and whether you rescore. More sub-vectors means better recall and more bytes.',
  use: 'Whenever memory is the binding constraint. Almost always in combination with IVF or HNSW rather than alone.',
  line: 'PQ is a compression scheme, not an index — it decides how much each vector costs, not which vectors you look at. Interviewers listen for that distinction.' },

{ n: 7, id: 'binary', name: 'Binary vector search', ico: '🔢', c: '#fb923c', viz: 'binary',
  one: 'Keep one bit per dimension — just the sign — and compare with a bitwise operation.',
  bullets: ['float32 → 1 bit per dimension, 32× smaller', 'Hamming distance instead of cosine', 'A shortlist filter, never the final ranking'],
  how: 'Threshold each dimension at zero: positive becomes 1, negative becomes 0. A 768-d vector becomes 96 bytes, and distance becomes <code>popcount(a XOR b)</code>, which a CPU does 64 dimensions at a time. It is the crudest compression here and needs no training at all. The pattern that makes it work is oversample-and-rescore: pull 10–20× the k you want using binary codes, then re-score exactly those with full-precision vectors and return the true top-k.',
  cost: 'Nothing at build time. Recall alone is poor, so you pay in a second pass over the shortlist.',
  recall: 'Within a point or two of exact <i>with</i> rescoring. Noticeably worse without it, and worse still below ~1024 dimensions.',
  use: 'RAM-bound deployments with high-dimensional embeddings, especially models that advertise binary support.',
  line: 'Say "binary" and "rescore" in the same breath. Binary codes are a filter; the ranking still has to come from vectors that kept their precision.' },

{ n: 8, id: 'hybrid', name: 'Hybrid search', ico: '🔀', c: '#34d399', viz: 'lanes',
  one: 'Run meaning-matching and word-matching side by side, then fuse the two rankings.',
  bullets: ['Dense embeddings plus BM25 over an inverted index', 'Fused with reciprocal rank fusion', 'Catches identifiers embeddings cannot'],
  how: 'The two lanes fail differently, which is the whole point. Dense retrieval handles paraphrase and intent; BM25 handles error codes, SKUs, function names, surnames and anything coined after the embedding model was trained. Fuse with RRF — <code>score = Σ 1/(60 + rank)</code> across the lists — because it uses ranks only, so a cosine and a BM25 score living on incomparable scales cannot fight. Run the two lanes concurrently: they share no state and the slower one sets the latency.',
  cost: 'Two indexes to maintain and keep in sync, and one more thing to get wrong at ingestion time.',
  recall: 'Higher than either lane alone on real corpora, with the biggest gains on exact-identifier queries.',
  use: 'Effectively every production RAG system over real documents. The default, not the optimisation.',
  line: 'A better embedding model raises the ceiling; it does not change the shape. Matching "error E-4055" is a category problem, and BM25 is the category that solves it.' },

{ n: 9, id: 'filtered', name: 'Filtered vector search', ico: '🎚️', c: '#7c5cff', viz: 'filter',
  one: 'Search only the slice of the index the user is allowed to see, without wrecking recall.',
  bullets: ['Metadata predicates applied with the search', 'The mechanism behind multi-tenancy and permissions', 'Pre-filter, post-filter and the middle path'],
  how: 'Three strategies, and the interview is about knowing why the naive two both break. <b>Post-filtering</b> retrieves top-k then discards what fails the predicate — for a selective filter you retrieve 100 and return 3. <b>Pre-filtering</b> restricts the candidate set first, which is correct but breaks the graph: an HNSW walk over a heavily filtered subgraph disconnects and recall collapses. <b>Filtered search</b> — what modern engines actually do — evaluates the predicate <i>during</i> traversal, with the planner switching to a brute-force scan when the filter is selective enough that scanning is cheaper.',
  cost: 'Metadata indexes alongside the vectors, and a query planner you have to trust or measure.',
  recall: 'The thing that quietly falls apart at high filter selectivity. Measure recall with your real filters, not without them.',
  use: 'Multi-tenant products, permission-scoped corpora, time-bounded questions — which is to say, most enterprise systems.',
  line: 'Tenant isolation belongs in the filter, never in the prompt. And the filter must be applied by the query, not by discarding results afterwards, or one noisy tenant starves everyone else\'s recall.' }
];

/* the test reads this with no browser in sight, so publish before mounting */
if (typeof window !== 'undefined') window.VSEARCH9 = T;

/* ============================================================
   rendering
   ============================================================ */
const root = typeof document !== 'undefined' && document.getElementById('vsearch9');
if (!root) return;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------- the nine little pictures ----------
   Static SVG, animated by CSS. The shapes are deliberately the same
   from card to card — dots are vectors, the pink dot is the query —
   so the difference between two techniques is the only thing moving. */
const dots = (pts, cls) => pts.map((p, i) =>
  '<circle class="' + cls + '" cx="' + p[0] + '" cy="' + p[1] + '" r="3.1" style="--i:' + i + '"/>').join('');

const CORPUS = [[24,26],[46,18],[70,30],[98,22],[120,40],[34,58],[58,50],[86,58],[110,66],
                [22,84],[48,90],[74,80],[100,92],[126,78],[64,30],[92,40]];

const VIZ = {
  /* every vector touched, one after another */
  scan: () => svg(dots(CORPUS, 'v9-dot v9-scan') + q(70, 56)),
  /* only a neighbourhood is considered */
  ball: () => svg('<circle class="v9-ball" cx="70" cy="56" r="30"/>' +
    dots(CORPUS, 'v9-dot') + near(70, 56, 30) + q(70, 56)),
  /* three layers, entry at the top, refine downwards */
  layers: () => svg(
    [18, 48, 82].map((y, li) =>
      '<line class="v9-lyr" x1="12" y1="' + y + '" x2="136" y2="' + y + '"/>' +
      [[30,0],[62,1],[94,2],[126,3]].slice(0, li === 0 ? 2 : li === 1 ? 3 : 4)
        .map(([x]) => '<circle class="v9-dot" cx="' + x + '" cy="' + y + '" r="3.4"/>').join('')
    ).join('') +
    '<path class="v9-hop" d="M30 18 L62 18 L62 48 L94 48 L94 82 L126 82"/>' +
    '<text class="v9-lbl" x="141" y="21">L2</text>' +
    '<text class="v9-lbl" x="141" y="51">L1</text>' +
    '<text class="v9-lbl" x="141" y="85">L0</text>'),
  /* clusters, one of them opened */
  cells: () => svg(
    '<circle class="v9-cell" cx="38" cy="34" r="26"/>' +
    '<circle class="v9-cell on" cx="88" cy="60" r="28"/>' +
    '<circle class="v9-cell" cx="40" cy="88" r="22"/>' +
    dots([[30,28],[46,38],[34,42],[80,52],[96,58],[86,70],[100,68],[32,86],[48,92]], 'v9-dot') +
    q(88, 60)),
  /* the cell is opened, and what is inside it is compressed */
  cellcode: () => svg(
    '<circle class="v9-cell on" cx="42" cy="54" r="30"/>' +
    dots([[32,44],[50,50],[38,66],[54,64]], 'v9-dot') + q(42, 54) +
    '<path class="v9-arrow" d="M78 54 L92 54"/>' +
    [0,1,2,3].map(i => '<rect class="v9-code" x="' + (98 + i * 11) + '" y="44" width="9" height="20" ' +
      'rx="2" style="--i:' + i + '"/>').join('')),
  /* float strip becomes a short code strip */
  bits: () => svg(
    [0,1,2,3,4,5,6,7].map(i => '<rect class="v9-f" x="' + (10 + i * 16) + '" y="20" width="14" height="16" rx="2"/>').join('') +
    '<text class="v9-lbl" x="10" y="14">float32 · 8 dims</text>' +
    '<path class="v9-arrow" d="M70 44 L70 58"/>' +
    [0,1,2,3].map(i => '<rect class="v9-code" x="' + (28 + i * 22) + '" y="66" width="18" height="18" rx="3" style="--i:' + i + '"/>').join('') +
    '<text class="v9-lbl" x="28" y="96">4 codebook ids</text>'),
  /* float strip becomes ones and zeroes */
  binary: () => svg(
    [0,1,2,3,4,5,6,7].map(i => '<rect class="v9-f" x="' + (10 + i * 16) + '" y="20" width="14" height="16" rx="2"/>').join('') +
    '<path class="v9-arrow" d="M70 44 L70 56"/>' +
    [1,0,1,1,0,1,0,0].map((b, i) =>
      '<text class="v9-bit" x="' + (17 + i * 16) + '" y="76" style="--i:' + i + '">' + b + '</text>').join('') +
    '<text class="v9-lbl" x="10" y="96">XOR + popcount</text>'),
  /* two lanes, one merge */
  lanes: () => svg(
    '<rect class="v9-lane a" x="8" y="14" width="52" height="24" rx="6"/>' +
    '<text class="v9-lt" x="34" y="30">vector</text>' +
    '<rect class="v9-lane b" x="8" y="66" width="52" height="24" rx="6"/>' +
    '<text class="v9-lt" x="34" y="82">BM25</text>' +
    '<path class="v9-flow a" d="M60 26 C86 26, 86 52, 104 52"/>' +
    '<path class="v9-flow b" d="M60 78 C86 78, 86 52, 104 52"/>' +
    '<rect class="v9-merge" x="104" y="38" width="34" height="28" rx="7"/>' +
    '<text class="v9-lt" x="121" y="56">RRF</text>'),
  /* the funnel: predicate first, then neighbours */
  filter: () => svg(
    '<rect class="v9-chip" x="10" y="16" width="46" height="17" rx="8"/>' +
    '<text class="v9-lt sm" x="33" y="28">tenant</text>' +
    '<rect class="v9-chip" x="62" y="16" width="40" height="17" rx="8" style="--i:1"/>' +
    '<text class="v9-lt sm" x="82" y="28">date</text>' +
    '<rect class="v9-chip" x="108" y="16" width="30" height="17" rx="8" style="--i:2"/>' +
    '<text class="v9-lt sm" x="123" y="28">acl</text>' +
    '<path class="v9-funnel" d="M18 44 L130 44 L96 74 L96 96 L52 96 L52 74 Z"/>' +
    dots([[36,52],[70,52],[104,52],[74,66],[62,84],[86,84]], 'v9-dot') + q(74, 66))
};

function svg(inner) {
  return '<svg class="v9-svg" viewBox="0 0 156 110" aria-hidden="true">' + inner + '</svg>';
}
function q(x, y) {
  return '<circle class="v9-q" cx="' + x + '" cy="' + y + '" r="4.6"/>';
}
/* the lines a neighbourhood search actually draws */
function near(cx, cy, r) {
  return CORPUS.filter(p => Math.hypot(p[0] - cx, p[1] - cy) < r)
    .map((p, i) => '<line class="v9-hit" x1="' + cx + '" y1="' + cy + '" x2="' + p[0] +
      '" y2="' + p[1] + '" style="--i:' + i + '"/>').join('');
}

/* ---------- cards ---------- */
let open = null;

function cardHtml(t) {
  const on = open === t.id;
  return '<article class="v9-card' + (on ? ' open' : '') + '" style="--c:' + t.c + '" data-id="' + t.id + '">' +
    '<button class="v9-head" aria-expanded="' + on + '">' +
      '<span class="v9-num">' + t.n + '</span>' +
      '<span class="v9-title"><b>' + t.ico + ' ' + esc(t.name) + '</b>' +
        '<span>' + esc(t.one) + '</span></span>' +
      '<span class="v9-caret">›</span>' +
    '</button>' +
    '<div class="v9-viz">' + VIZ[t.viz]() + '</div>' +
    '<ul class="v9-bul">' + t.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' +
    (on ? detail(t) : '') +
  '</article>';
}

function detail(t) {
  return '<div class="v9-detail">' +
    '<p class="v9-how">' + t.how + '</p>' +
    '<div class="v9-facts">' +
      '<div><b>Costs you</b>' + esc(t.cost) + '</div>' +
      '<div><b>Recall</b>' + t.recall + '</div>' +
      '<div><b>Reach for it when</b>' + esc(t.use) + '</div>' +
    '</div>' +
    '<div class="v9-line"><span>✦</span><p>' + esc(t.line) + '</p></div>' +
  '</div>';
}

function paint() {
  root.innerHTML =
    '<div class="v9-grid">' + T.map(cardHtml).join('') + '</div>' +
    '<div class="v9-foot">' +
      '<b>One question, nine answers.</b> Every technique above is a way of answering ' +
      '<i>which vectors am I allowed to skip?</i> — brute force skips none, ANN skips most, ' +
      'quantisation makes the ones you do read cheaper, and the last two change what is in the ' +
      'candidate set at all. In production you stack them: filtered hybrid search over an HNSW ' +
      'or IVF-PQ index, rescored with full-precision vectors, then reranked.' +
    '</div>';

  root.querySelectorAll('.v9-head').forEach(b => b.onclick = () => {
    const id = b.parentElement.dataset.id;
    open = open === id ? null : id;
    paint();
    if (open === id) {
      const el = root.querySelector('.v9-card.open');
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}

paint();
})();
