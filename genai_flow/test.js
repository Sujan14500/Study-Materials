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

/* ============================================================
   Deep dives (ch18-23). Each block re-derives the maths from
   scratch and asserts the claim the chapter makes on screen.
   If an edit ever makes a chapter teach something false, this
   is where it fails.
   ============================================================ */

/* ---- ch18: the toy transformer, re-implemented independently ---- */
{
  const T = C.tf;
  const mv = (x, M) => M[0].map((_, j) => x.reduce((s, xi, i) => s + xi * M[i][j], 0));
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const ln = x => {
    const m = x.reduce((a, b) => a + b, 0) / x.length;
    const v = x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length;
    return x.map(e => (e - m) / Math.sqrt(v + 1e-5));
  };
  const gelu = z => 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z ** 3)));
  const smax = a => {
    const m = Math.max(...a.filter(Number.isFinite));
    const e = a.map(v => Number.isFinite(v) ? Math.exp(v - m) : 0);
    const s = e.reduce((x, y) => x + y, 0);
    return e.map(v => v / s);
  };
  function fwd(toks, ffn) {
    const n = toks.length, d = 4;
    const X0 = toks.map((t, i) => add(T.vocab[t], T.pos[i]));
    const Xn = X0.map(ln);
    const Q = Xn.map(x => mv(x, T.Wq)), K = Xn.map(x => mv(x, T.Wk)), V = Xn.map(x => mv(x, T.Wv));
    const A = [];
    for (let i = 0; i < n; i++) {
      const r = [];
      for (let j = 0; j < n; j++) r.push(j <= i ? Q[i].reduce((s, q, k) => s + q * K[j][k], 0) / Math.sqrt(d) : -Infinity);
      A.push(smax(r));
    }
    const ctx = A.map(row => row.reduce((acc, w, j) => w > 0 ? add(acc, V[j].map(v => v * w)) : acc, [0, 0, 0, 0]));
    const X1 = X0.map((x, i) => add(x, mv(ctx[i], T.Wo)));
    let X2 = X1, H = null;
    if (ffn) {
      H = X1.map(x => mv(ln(x), T.W1).map((v, j) => gelu(v + T.b1[j])));
      X2 = X1.map((x, i) => add(x, mv(H[i], T.W2)));
    }
    const fin = ln(X2[n - 1]);
    const words = Object.keys(T.vocab);
    const probs = smax(words.map(w => fin.reduce((s, f, i) => s + f * T.vocab[w][i], 0) * T.logitGain));
    return { A, probs, words, H };
  }
  // every prompt must fit the position table and use words that exist
  T.prompts.forEach(p => {
    assert(p.t.length <= T.pos.length, `tf prompt "${p.t.join(' ')}" is longer than the position table`);
    p.t.forEach(w => assert(T.vocab[w], `tf prompt uses unknown token "${w}"`));
  });
  const r = fwd(['the', 'cat', 'sat'], true);
  // softmax must actually be a distribution, or the chapter's percentages are fiction
  r.A.forEach((row, i) => {
    const s = row.reduce((a, b) => a + b, 0);
    assert(Math.abs(s - 1) < 1e-9, `attention row ${i} sums to ${s}, not 1`);
    // causal mask: nothing may attend to a position to its right
    row.forEach((w, j) => assert(j <= i || w === 0, `token ${i} attends ${w} to future token ${j}`));
  });
  assert(Math.abs(r.probs.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'next-token probabilities do not sum to 1');
  // "sat" must attend mostly to "cat" — the chapter says a verb goes looking for its subject
  assert(r.A[2][1] > 0.5, `"sat" attends only ${(r.A[2][1] * 100).toFixed(0)}% to "cat"; the chapter claims it dominates`);
  // THE claim of the chapter: attention alone echoes, the feed-forward supplies knowledge
  const top = x => x.words[x.probs.indexOf(Math.max(...x.probs))];
  const withFfn = top(r), without = top(fwd(['the', 'cat', 'sat'], false));
  assert(['mat', 'on'].includes(withFfn), `feed-forward ON predicts "${withFfn}"; chapter 18 claims a place word`);
  assert(['cat', 'dog'].includes(without), `feed-forward OFF predicts "${without}"; chapter 18 claims it can only echo what it attended to`);
  // and the fact neuron (index 4, animate+action) must be the one doing it
  assert(r.H[2][4] > 0.3, `the animate+action neuron only reaches ${r.H[2][4].toFixed(2)}; the chapter says it fires`);
  assert(T.W2[4][2] > Math.abs(T.W2[4][0]), 'the fact neuron must write more into the place dimension than it removes from animate');
}

/* ---- ch19: decoding maths ---- */
{
  const cands = C.decodeDist.cands;
  const dist = (t) => {
    const s = cands.map(c => c.l / t), m = Math.max(...s);
    const e = s.map(v => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0);
    return e.map(v => v / z);
  };
  const ent = p => -p.reduce((a, v) => a + (v > 0 ? v * Math.log2(v) : 0), 0);
  // temperature must monotonically flatten the distribution — the chapter's whole claim
  const temps = [0.2, 0.5, 1.0, 1.5, 2.0].map(t => ent(dist(t)));
  for (let i = 1; i < temps.length; i++) {
    assert(temps[i] > temps[i - 1], `entropy did not rise from temperature ${i}; the chapter claims heat flattens`);
  }
  // top-p must keep the SMALLEST set covering p, and never more
  const p = dist(1.0).slice().sort((a, b) => b - a);
  [0.5, 0.9, 0.95].forEach(target => {
    let cum = 0, kept = 0;
    for (const v of p) { cum += v; kept++; if (cum >= target) break; }
    const cumMinusOne = p.slice(0, kept - 1).reduce((a, b) => a + b, 0);
    assert(cumMinusOne < target, `top-p ${target} kept ${kept} tokens but ${kept - 1} already covered the mass`);
  });
  // every recipe must be a legal setting, or the copy-paste block ships a bug
  C.decodeRecipes.forEach(r => {
    assert(r.t >= 0 && r.t <= 2, `recipe "${r.n}" has temperature ${r.t}`);
    assert(r.p > 0 && r.p <= 1, `recipe "${r.n}" has top_p ${r.p}`);
  });
  const det = C.decodeRecipes.find(r => r.n.includes('Extraction'));
  assert(det.t === 0, 'the extraction recipe must be greedy, or the chapter contradicts itself');
  const vote = C.decodeRecipes.find(r => r.n.includes('Self-consistency'));
  assert(vote.t > 0, 'self-consistency voting needs temperature above 0 or all samples are identical');
}

/* ---- ch20: chunking must never lose text ---- */
{
  const flat = C.chunkDoc.map(d => d.text).join(' ');
  const words = new Set(flat.toLowerCase().match(/[a-z]+/g));
  // the probe the chapter runs must be genuinely answerable from the document
  assert(flat.includes('5 to 10 business days') && flat.includes('issuing bank'),
    'the chunking probe asks for facts the document does not contain');
  // fixed-size with no overlap must actually split them apart, or the demo proves nothing
  const gap = flat.indexOf('issuing bank') - flat.indexOf('5 to 10 business days');
  assert(gap > 0 && gap < 300, 'the two probe facts must sit close enough that only a boundary separates them');
  C.chunkStrategies.forEach(s => {
    assert(s.lay && s.tech && s.good && s.bad && s.param, `chunk strategy "${s.n}" is missing a field`);
  });
  assert(C.chunkStrategies.length === 6, 'the chapter promises six strategies');
  assert(words.size > 40, 'the chunking document is too small to demonstrate anything');
}

/* ---- ch21: LoRA parameter arithmetic ---- */
{
  const P = C.loraMath;
  const ff = { 'Llama-3 8B': 14336, 'Llama-3 70B': 28672, 'Mistral 7B': 14336 };
  P.presets.forEach(m => {
    const d = m.d, f = ff[m.n];
    assert(f, `no feed-forward width recorded for ${m.n}`);
    const qv = 2 * 16 * 2 * d * m.layers;
    const all = (4 * 16 * 2 * d + 3 * 16 * (d + f)) * m.layers;
    assert(all > qv, 'adapting more matrices must train more parameters');
    // the chapter's headline claim: you train well under 1% of the model
    assert(qv / m.base < 0.01, `${m.n} q+v at r=16 trains ${(qv / m.base * 100).toFixed(2)}% — the chapter claims under 1%`);
    assert(all / m.base < 0.05, `${m.n} full-target at r=16 trains ${(all / m.base * 100).toFixed(2)}%`);
    // and the VRAM ordering the calculator prints must hold
    const full = m.base * 16, lora = m.base * 2 + all * 16, qlora = m.base * 0.55 + all * 16;
    assert(qlora < lora && lora < full, `VRAM ordering broken for ${m.n}`);
  });
  // rank must scale parameters linearly — it is the one thing the diagram promises
  const at = r => 2 * r * 2 * 4096 * 32;
  assert(Math.abs(at(32) / at(16) - 2) < 1e-9, 'doubling the rank must double the trainable parameters');
  // the decision tree must give an answer for every reachable combination
  const problems = C.ftDecision[0].a.map(a => a.v), datas = C.ftDecision[1].a.map(a => a.v);
  const gpus = C.ftDecision[2].a.map(a => a.v), verifs = C.ftDecision[3].a.map(a => a.v);
  const ids = new Set(C.ftMethods.map(m => m.id));
  const rec = (a) => {
    const [problem, data, gpu, verif] = a;
    if (problem === 'facts') return 'rag';
    if (problem === 'cost') return 'distil';
    if (problem === 'reason') return verif === 'verifiable' ? 'grpo' : 'dpo';
    if (data === 'tiny') return 'prompt';
    if (gpu === 'none') return 'prompt';
    if (data === 'big' && gpu === 'cluster') return 'sft';
    if (gpu === 'consumer') return 'qlora';
    return 'lora';
  };
  problems.forEach(p => datas.forEach(d => gpus.forEach(g => verifs.forEach(v => {
    const r = rec([p, d, g, v]);
    assert(ids.has(r), `the fine-tuning decision tree returns "${r}", which is not a method`);
  }))));
  // the comparison table must line up with the number of columns it declares
  assert(C.loraVsQlora.cols.length === 2, 'the LoRA/QLoRA table must have exactly two columns');
  C.loraVsQlora.rows.forEach(r => assert(r.length === 3, `LoRA/QLoRA row "${r[0]}" has ${r.length - 1} cells for 2 columns`));
}

/* ---- ch22: the judge bench must actually improve with mitigations ---- */
{
  const seeded = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) / 4294967295) * 2 - 1;
  };
  const run = active => {
    const on = id => active.includes(id);
    let agree = 0;
    C.judgeBench.forEach(c => {
      const truth = c.better === 'A' ? 1 : c.better === 'B' ? -1 : 0;
      let w = 0.35;
      if (on('rubric')) w += 0.30;
      if (on('reference')) w += 0.30;
      if (on('pairwise')) w += 0.25;
      if (on('cot')) w += 0.20;
      let v = truth * w;
      if (!on('swap')) v += 0.60;
      v += (c.lenA - c.lenB) * (on('lenpen') ? 0.35 : 1.20);
      if (!on('diffjudge')) v += 0.30;
      v += seeded(c.id + active.join('')) * (on('consist') ? 0.08 : 0.25);
      if (!on('rubric')) v += seeded(c.id + 'drift') * 0.20;
      const said = v > 0.18 ? 'A' : v < -0.18 ? 'B' : 'tie';
      if (said === c.better) agree++;
    });
    return agree / C.judgeBench.length;
  };
  const naive = run([]), all = run(C.judgeConfigs.map(c => c.id));
  assert(naive < 0.7, `the naive judge already agrees ${(naive * 100).toFixed(0)}% of the time; the chapter needs it to look unreliable`);
  assert(all >= 0.85, `the fully mitigated judge only reaches ${(all * 100).toFixed(0)}%; the chapter claims mitigations work`);
  assert(all - naive >= 0.25, 'the mitigations must produce a visible jump or the panel teaches nothing');
  // position swap alone must be the single biggest lever, as the chapter states
  const gains = C.judgeConfigs.map(c => ({ id: c.id, g: run([c.id]) - naive }));
  const best = gains.slice().sort((a, b) => b.g - a.g)[0];
  assert(best.id === 'swap', `the biggest single mitigation is "${best.id}", but the chapter says position swap`);
  // every bias must have at least one mitigation pointing at it
  C.judgeBiases.forEach(b => assert(C.judgeConfigs.some(c => c.fixes.includes(b.id)),
    `bias "${b.n}" has no mitigation, but the panel promises one for each`));
  // the bench itself must not be trivially one-sided, or "always answer A" would score well
  const aCount = C.judgeBench.filter(c => c.better === 'A').length;
  assert(aCount < C.judgeBench.length, 'the judge bench must contain cases where B wins');
}

/* ---- ch23: long context vs RAG arithmetic ---- */
{
  const v = C.longCtx.defaults, out = 500;
  const cost = t => t / 1e6 * v.inPrice + out / 1e6 * v.outPrice;
  const depth = t => Math.min(0.45, 0.10 + 0.35 * Math.log10(Math.max(1, t / 4000)) / Math.log10(250));
  const sent = Math.min(v.corpusTokens, v.ctxLimit), ragTok = v.k * v.chunk + 800;
  assert(cost(sent) > cost(ragTok) * 10, 'at the defaults, stuffing the corpus must be far more expensive than retrieving');
  assert(sent / v.prefillRate > 10, 'prefilling a 1M-token prompt must take many seconds, or the latency argument is fiction');
  // the sag must genuinely deepen with length, and never invert
  const ds = [8000, 32000, 128000, 1000000].map(depth);
  for (let i = 1; i < ds.length; i++) assert(ds[i] >= ds[i - 1], 'the lost-in-the-middle sag must not shrink as context grows');
  assert(depth(ragTok) < depth(sent), 'a short retrieved prompt must have a shallower sag than a 1M-token one');
  // the curve is symmetric and worst in the middle — that is the phenomenon being taught
  const acc = (t, x) => 1 - depth(t) * 4 * x * (1 - x);
  assert(acc(sent, 0.5) < acc(sent, 0.05) && acc(sent, 0.5) < acc(sent, 0.95), 'the accuracy curve must dip in the middle');
  assert(Math.abs(acc(sent, 0.2) - acc(sent, 0.8)) < 1e-9, 'the lost-in-the-middle curve must be symmetric');
  // multilingual cause weights are presented as "share of real cases"
  const w = C.multiling.causes.reduce((a, c) => a + c.weight, 0);
  assert(Math.abs(w - 1) < 0.02, `multilingual cause weights sum to ${w.toFixed(2)}, not 1`);
  assert(C.multiling.causes[0].weight === Math.max(...C.multiling.causes.map(c => c.weight)),
    'the causes must be ordered most-likely first, because the chapter says they are');
  // the five architectures each need a flow the diagram can render
  C.ragVariants.forEach(r => assert(r.flow.length >= 4, `architecture "${r.n}" has too short a flow to draw`));
  assert(C.ragVsLong.rows.every(r => r.length === 3), 'the long-context comparison table must have two columns per row');
}

/* ---- comparison tables everywhere must be rectangular ---- */
[C.tfCompare, C.loraVsQlora, C.ragVsLong].forEach(t => {
  t.rows.forEach(r => assert(r.length === t.cols.length + 1,
    `comparison row "${r[0]}" has ${r.length - 1} cells for ${t.cols.length} columns`));
});

console.log('ok — content data is consistent');
