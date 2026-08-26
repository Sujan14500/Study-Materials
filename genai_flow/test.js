/* Smallest check that fails if the course data rots.
   Run: node test.js                                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

// every word used in vector arithmetic must exist on the map, or the arrows point nowhere
const words = new Set(C.embedWords.map(w => w.w));
for (const eq of C.vecMath) {
  for (const k of ['a', 'minus', 'plus', 'eq']) {
    assert(words.has(eq[k]), `vecMath uses unknown word "${eq[k]}"`);
  }
  // analogy must actually be a parallelogram, else the drawn arrows lie
  const P = n => C.embedWords.find(w => w.w === n);
  const d1 = [P(eq.a).x - P(eq.minus).x, P(eq.a).y - P(eq.minus).y];
  const d2 = [P(eq.eq).x - P(eq.plus).x, P(eq.eq).y - P(eq.plus).y];
  assert(Math.hypot(d1[0] - d2[0], d1[1] - d2[1]) < 0.03,
    `analogy ${eq.a}-${eq.minus}+${eq.plus}=${eq.eq} is not parallel on the map`);
}

// quiz answers must index a real option
C.quiz.forEach((q, i) => assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`));

// guess-game probabilities must be plausible (sum under 1, one clear winner)
C.guessRounds.forEach((r, i) => {
  const sum = r.options.reduce((a, o) => a + o.p, 0);
  assert(sum > 0 && sum <= 1, `guess round ${i} probabilities sum to ${sum}`);
});

// every RAG question except the deliberate miss must hit at least one chunk
C.ragQuestions.slice(0, -1).forEach(q => {
  const qw = q.q.toLowerCase().match(/[a-z0-9.$]+/g) || [];
  const hit = C.ragKB.some(c => qw.some(w => w.length > 2 && c.k.some(k => k.includes(w) || w.includes(k))));
  assert(hit, `no chunk retrievable for: ${q.q}`);
});

// the sampler must be able to walk its own tree without falling into _default immediately
assert(C.genTree[C.genStart.trim().split(/\s+/).pop().toLowerCase()], 'genStart does not match a genTree key');

// ---- ch6: the speed claims must actually hold ----
// re-derived here on purpose: if demos.js and this disagree, the chapter is lying
const M = C.speedModel;
function timing(P, O, o) {
  const step = 1000 / M.decodeRate;
  const fresh = o.cache ? P * (1 - M.cachedFrac) + P * M.cachedFrac / M.cacheSpeedup : P;
  const prefill = fresh / M.prefillRate * 1000;
  const recompute = o.kv ? 0 : (O * P + O * (O - 1) / 2) / M.prefillRate * 1000;
  const perRound = (1 - Math.pow(M.accept, M.draftBlock + 1)) / (1 - M.accept);
  const roundCost = 1 + M.draftBlock * M.draftCost;
  const speedup = o.spec ? perRound / roundCost : 1;
  const decode = (O * step + recompute) / speedup;
  const first = (o.spec ? roundCost * step : step) + (o.kv ? 0 : P / M.prefillRate * 1000);
  const total = M.overheadMs + prefill + decode;
  return { prefill, decode, total, ttft: o.stream ? M.overheadMs + prefill + first : total,
           tps: O / (decode / 1000), speedup };
}
const ON = { stream: true, cache: true, kv: true, spec: false };
const off = k => Object.assign({}, ON, { [k]: false });

// streaming moves perceived latency and nothing else — the chapter's central claim
{
  const s = timing(4000, 400, ON), b = timing(4000, 400, off('stream'));
  assert(Math.abs(s.total - b.total) < 1e-9, 'streaming changed total time — it must not');
  assert(Math.abs(s.tps - b.tps) < 1e-9, 'streaming changed tokens/sec — it must not');
  assert(s.ttft < b.ttft / 4, 'streaming barely moved time-to-first-token');
}

// prompt caching attacks prefill only: first token sooner, generation speed identical
{
  const c = timing(20000, 400, ON), n = timing(20000, 400, off('cache'));
  assert(c.ttft < n.ttft, 'prompt caching did not reduce time-to-first-token');
  assert(Math.abs(c.tps - n.tps) < 1e-9, 'prompt caching changed tokens/sec — it attacks prefill only');
}

// no KV cache: strictly slower, and superlinear in output length (the O(n^2) lesson)
{
  const kv = timing(4000, 400, ON), no = timing(4000, 400, off('kv'));
  assert(no.decode > kv.decode, 'dropping the KV cache did not cost anything');
  const a = timing(4000, 400, off('kv')).decode, b = timing(4000, 800, off('kv')).decode;
  assert(b > 2 * a, 'without a KV cache, doubling the output must more than double the work');
  const k1 = timing(4000, 400, ON).decode, k2 = timing(4000, 800, ON).decode;
  assert(Math.abs(k2 - 2 * k1) < 1e-6, 'with a KV cache, decode must be linear in output length');
}

// speculative decoding: a win at the configured acceptance rate, a loss at zero
{
  const s = timing(4000, 400, Object.assign({}, ON, { spec: true }));
  assert(s.speedup > 1.4, `speculative decoding should be worth it at accept=${M.accept}, got ${s.speedup.toFixed(2)}x`);
  assert(s.ttft > timing(4000, 400, ON).ttft, 'speculating should cost a little time-to-first-token, not save it');
  const saved = M.accept;
  M.accept = 0;
  const dead = timing(4000, 400, Object.assign({}, ON, { spec: true }));
  assert(dead.speedup < 1, 'a draft model that is always wrong must make things slower, not faster');
  M.accept = saved;
}

// the scripted speculative run has to be a legal run
C.specRounds.forEach((r, i) => {
  assert(r.ok >= 0 && r.ok <= r.draft.length, `spec round ${i}: accepted ${r.ok} of ${r.draft.length}`);
  assert((r.ok < r.draft.length) === !!r.fix,
    `spec round ${i}: a rejected block needs a correction token, a fully accepted one must not have any`);
  assert(r.why, `spec round ${i}: the reasoning is the lesson`);
});
assert(C.specRounds.some(r => r.fix) && C.specRounds.some(r => !r.fix),
  'the speculative run must show both a clean block and a rejected one');

// mem0: UPDATE/DELETE/NOOP must target a memory that exists at that point in the
// run, or the demo silently does nothing and teaches the wrong lesson
const store = [];
C.mem0Turns.forEach((t, ti) => {
  t.ops.forEach(op => {
    assert(['ADD', 'UPDATE', 'DELETE', 'NOOP'].includes(op.op), `mem0 turn ${ti}: unknown op "${op.op}"`);
    if (op.op === 'ADD') {
      assert(op.mem && op.cat, `mem0 turn ${ti}: ADD needs mem + cat`);
      assert(!store.includes(op.mem), `mem0 turn ${ti}: ADD "${op.mem}" is already stored — should be NOOP`);
      store.push(op.mem);
    } else {
      assert(store.includes(op.target), `mem0 turn ${ti}: ${op.op} targets "${op.target}", which is not in the store`);
      if (op.op === 'UPDATE') store[store.indexOf(op.target)] = op.mem;
      if (op.op === 'DELETE') store.splice(store.indexOf(op.target), 1);
    }
    assert(op.why, `mem0 turn ${ti}: every op needs a why — the reasoning IS the lesson`);
  });
});
// all four operations must actually appear, or the chapter's own diagram lies
const kinds = new Set(C.mem0Turns.flatMap(t => t.ops.map(o => o.op)));
assert(kinds.size === 4, `mem0 run should demonstrate all 4 ops, got ${[...kinds].join(',')}`);
// the deleted diet fact must be gone and the budget must be the corrected one
assert(!store.includes('Is vegetarian'), 'mem0: deleted memory survived the run');
assert(store.includes('Trip budget is about $2,400'), 'mem0: budget UPDATE did not land');

// every search hit must be a memory the run actually leaves behind
C.mem0Queries.forEach(q => {
  assert(q.hits.length, `mem0 query "${q.q}" retrieves nothing`);
  q.hits.forEach(h => assert(store.includes(h.m), `mem0 query "${q.q}" hits "${h.m}", which is not in the final store`));
  for (let i = 1; i < q.hits.length; i++) {
    assert(q.hits[i].s <= q.hits[i - 1].s, `mem0 query "${q.q}" hits are not sorted by score`);
  }
});

// data formulator: threads must chain backwards, and every recipe must be reachable
const rIds = new Set(C.dfRecipes.map(r => r.id));
C.dfRecipes.forEach((r, i) => {
  if (r.from) {
    assert(rIds.has(r.from), `recipe ${r.id} anchors to unknown thread "${r.from}"`);
    assert(C.dfRecipes.findIndex(p => p.id === r.from) < i, `recipe ${r.id} anchors forward to ${r.from}`);
  }
  assert(r.rows.length, `recipe ${r.id} produced no rows`);
  assert(['usd', 'pct', 'num'].includes(r.fmt), `recipe ${r.id} has unknown fmt "${r.fmt}"`);
  // the y field must be one the transform actually derives, or a real source column
  const srcFields = C.dfData.fields.map(f => f.f);
  assert(r.newFields.includes(r.y) || srcFields.includes(r.y),
    `recipe ${r.id}: y "${r.y}" is neither derived nor a source column`);
  // a colour encoding needs a group on every row, and none without
  r.rows.forEach(row => assert(!!r.color === (row.g !== undefined),
    `recipe ${r.id}: colour encoding and row groups disagree`));
  // the generated code must define the function the tool actually calls
  assert(/def transform_data\(/.test(r.code), `recipe ${r.id}: python is not a transform_data function`);
  assert(/SELECT/i.test(r.sql), `recipe ${r.id}: sql dialect is missing a SELECT`);
  // the demo matches an ask to a recipe by keyword — no keyword, unreachable recipe
  assert(r.kw.length >= 3, `recipe ${r.id} has too few keywords to ever be matched`);
});

// the numbers on screen must be the numbers in the data, or the chapter is fiction
const rev = {};
C.dfData.rows.forEach(([d, region, product, units, price]) => {
  rev[region] = (rev[region] || 0) + units * price;
});
C.dfRecipes[0].rows.forEach(row =>
  assert(Math.abs(rev[row.k] - row.v) < 0.01,
    `recipe t1: ${row.k} shows ${row.v} but sales.csv says ${rev[row.k]}`));
const shareSum = C.dfRecipes[1].rows.reduce((a, r) => a + r.v, 0);
assert(Math.abs(shareSum - 100) < 0.05, `recipe t2 shares sum to ${shareSum}, not 100`);
const q3 = C.dfRecipes[2].rows.reduce((a, r) => a + r.v, 0);
const totalRev = Object.values(rev).reduce((a, b) => a + b, 0);
assert(Math.abs(q3 - totalRev) < 0.01, `recipe t3 total ${q3} does not match sales.csv total ${totalRev}`);


// ---- ch11: the advanced-RAG chapter makes four claims. Re-derive them here,
// with the same maths demos.js uses. If this file and the chapter disagree,
// the chapter is lying to the reader.
{
  const stop = new Set(C.arStop);
  const stem = w => (w.length > 3 && !/(ss|us)$/.test(w))
    ? (/ies$/.test(w) ? w.slice(0, -3) + 'y' : w.replace(/s$/, ''))
    : w;
  const tok = s => (String(s).toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || [])
    .filter(w => !stop.has(w)).map(stem);
  const docs = C.arCorpus;
  const dtok = docs.map(d => tok(d.t));
  const N = docs.length;
  const avgdl = dtok.reduce((a, t) => a + t.length, 0) / N;
  const df = {};
  dtok.forEach(t => new Set(t).forEach(w => { df[w] = (df[w] || 0) + 1; }));

  const cos = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (const k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
    for (const k in b) nb += b[k] * b[k];
    return (na && nb) ? dot / Math.sqrt(na * nb) : 0;
  };
  const bm25 = (qt, i) => {
    const t = dtok[i], k1 = 1.2, b = 0.75;
    return qt.reduce((s, w) => {
      const f = t.filter(x => x === w).length;
      if (!f) return s;
      const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
      return s + idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * t.length / avgdl));
    }, 0);
  };
  const tokSim = (a, b) => {
    if (a === b) return 1;
    const ca = C.arTokenCon[a], cb = C.arTokenCon[b];
    if (!ca || !cb) return 0;
    const inter = ca.filter(x => cb.indexOf(x) >= 0).length;
    return inter ? inter / new Set(ca.concat(cb)).size : 0;
  };
  const late = (qt, i) => qt.length
    ? qt.reduce((a, w) => a + dtok[i].reduce((m, d) => Math.max(m, tokSim(w, d)), 0), 0) / qt.length
    : 0;
  const rank = sc => sc.map((s, i) => ({ i, s })).filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const lanes = q => {
    const qt = tok(q.q);
    return { dense: rank(docs.map(d => cos(q.con, d.con))),
             sparse: rank(docs.map((d, i) => bm25(qt, i))),
             late: rank(docs.map((d, i) => late(qt, i))) };
  };
  const rrf = (lists, k) => {
    const acc = {};
    lists.forEach(l => l.forEach((x, r) => { acc[x.i] = (acc[x.i] || 0) + 1 / (k + r + 1); }));
    return Object.keys(acc).map(i => ({ i: +i, s: acc[i] }))
      .sort((a, b) => b.s - a.s || a.i - b.i);
  };
  const hybrid = q => rrf([lanes(q).dense, lanes(q).sparse, lanes(q).late], 60);
  const id = x => docs[x.i].id;

  // every judgement must point at a chunk that exists
  const corpusIds = new Set(docs.map(d => d.id));
  C.arQueries.concat([C.arFusion]).forEach(q =>
    Object.keys(q.gold).forEach(g =>
      assert(corpusIds.has(g), `gold label ${g} is not a chunk in C.arCorpus`)));

  // claim 1: hybrid + rerank puts a relevant chunk first, for every query.
  // This is the promise the whole chapter is built on.
  C.arQueries.forEach(q => {
    const cands = hybrid(q).slice(0, 5);
    const reranked = cands.map((c, r) => ({ i: c.i, g: q.gold[id(c)] || 0, r }))
      .sort((a, b) => b.g - a.g || a.r - b.r);
    assert(reranked[0] && q.gold[id(reranked[0])],
      `hybrid+rerank does not surface a relevant chunk for "${q.q}"`);
  });

  // claim 2: dense alone cannot tell E-4021 from E-4055 — it ranks the wrong
  // runbook first. Without this the "add a lexical lane" advice is unmotivated.
  {
    const q = C.arQueries.filter(q => q.id === 'q2')[0];
    assert(!q.gold[id(lanes(q).dense[0])],
      'dense retrieval now gets the error-code query right — the sparse lane has lost its reason to exist');
    assert(id(lanes(q).sparse[0]) === 'd3',
      'BM25 no longer pins the exact error code, which is the only thing it is there for');
  }

  // claim 3: BM25 scores the synonym query at zero. Chapter text says "zero".
  {
    const q = C.arQueries.filter(q => q.id === 'q3')[0];
    assert(lanes(q).sparse.length === 0,
      'the sign-on query now has lexical overlap, so the synonym lesson no longer holds');
    assert(q.gold[id(lanes(q).dense[0])],
      'dense retrieval must still bridge "single sign-on" to "SSO"');
  }

  // claim 4: fusing five queries gets BOTH root causes into the top 2, and the
  // original query on its own does not. That gap is the entire demo.
  {
    const F = C.arFusion;
    const lists = [F].concat(F.variants).map(q => hybrid(q).slice(0, 5));
    const fused = rrf(lists, 60);
    const causes = Object.keys(F.gold).filter(k => F.gold[k] === 3);
    assert(causes.length === 2, 'the fusion demo needs exactly two root causes to be legible');
    const at2 = l => l.slice(0, 2).filter(x => causes.indexOf(id(x)) >= 0).length;
    assert(at2(fused) === causes.length,
      'RRF no longer surfaces both root causes in the top 2 — the demo shows no gain');
    assert(at2(lists[0]) < causes.length,
      'the original query alone already finds both root causes, so fusion buys nothing here');
  }
}

// ---- ch11: the evaluation panel must be internally consistent ----
{
  const keys = C.arEvalFamilies.reduce((a, f) => a.concat(f.metrics.map(m => m.k)), []);
  const famOf = {};
  C.arEvalFamilies.forEach(f => f.metrics.forEach(m => { famOf[m.k] = f.id; }));
  C.arEvalRuns.forEach(r => {
    keys.forEach(k => assert(typeof r.vals[k] === 'number' && r.vals[k] >= 0 && r.vals[k] <= 1,
      `eval run "${r.n}" is missing a 0-1 value for ${k}`));
    assert(Object.keys(r.vals).length === keys.length,
      `eval run "${r.n}" carries a metric no family declares`);
    // the run says which family it breaks; the numbers have to agree, or the
    // ring highlights one thing while the prose blames another
    const avg = (f, run) => f.metrics.reduce((a, m) => a + run.vals[m.k], 0) / f.metrics.length;
    const healthy = C.arEvalRuns.filter(x => !x.root)[0];
    assert(healthy, 'the eval panel needs one healthy run to act as the baseline');
    if (r.root) {
      const fam = C.arEvalFamilies.filter(f => f.id === r.root)[0];
      assert(fam, `run "${r.n}" blames a family that does not exist: ${r.root}`);
      // the family the prose blames has to actually be worse than baseline,
      // or the verdict text and the rings are telling different stories
      assert(avg(fam, r) < avg(fam, healthy) - 0.1,
        `run "${r.n}" blames ${r.root}, but ${r.root} scores as well as the healthy baseline`);
      assert(C.arEvalFamilies.some(f => avg(f, r) < 0.6),
        `run "${r.n}" is a failure case but no family drops below 0.6`);
    } else {
      C.arEvalFamilies.forEach(f => assert(avg(f, r) >= 0.6,
        `run "${r.n}" is labelled healthy but ${f.id} averages ${avg(f, r).toFixed(2)}`));
    }
  });
}

// every id the demos reach for must exist in the markup, or a chapter is quietly dead
const demos = fs.readFileSync('js/demos.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
// ids built by concatenation ('#c-' + name) end in a dash — not a real id, skip them
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
// the element has to exist somewhere: written in the markup, or built by a demo
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

// every C.* key the demos read must exist, or a panel renders empty and nobody notices
{
  const demos = fs.readFileSync('js/demos.js', 'utf8');
  const keys = new Set([...demos.matchAll(/\bC\.([A-Za-z0-9_]+)/g)].map(m => m[1]));
  keys.forEach(k => assert(C[k] !== undefined, `demos.js reads C.${k}, which content.js does not define`));
}

console.log('ok — content data is consistent');
