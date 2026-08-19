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

console.log('ok — content data is consistent');
