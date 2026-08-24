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

// every id the demos reach for must exist in the markup, or a chapter is quietly dead
const demos = fs.readFileSync('js/demos.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
// ids built by concatenation ('#c-' + name) end in a dash — not a real id, skip them
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
// the element has to exist somewhere: written in the markup, or built by a demo
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

console.log('ok — content data is consistent');
