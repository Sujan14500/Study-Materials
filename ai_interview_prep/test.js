/* Smallest check that fails if the question bank rots.
   Run: node test.js                                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = {};
ctx.window = ctx;
ctx.document = { addEventListener() {}, getElementById() { return null; },
                 querySelector() { return null; }, querySelectorAll() { return []; } };
vm.createContext(ctx);

const banks = fs.readdirSync('js').filter(f => /^bank-.*\.js$/.test(f)).sort();
banks.forEach(f => vm.runInContext(fs.readFileSync(path.join('js', f), 'utf8'), ctx));
vm.runInContext(fs.readFileSync('js/mcq.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/paths.js', 'utf8'), ctx);

const QB = ctx.window.QB, MCQ = ctx.window.MCQ, PATHS = ctx.window.PATHS;
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

/* ---- the topics the app knows about must match the topics the bank uses ---- */
const TOPICS = [...app.matchAll(/\{ id: '([a-z]+)',\s*n: '/g)].map(m => m[1]);
assert(TOPICS.length >= 10, 'could not parse the topic list out of app.js');
const known = new Set(TOPICS);

/* ---- every question must be well formed, or a card renders broken ---- */
const ids = new Set();
QB.forEach((q, i) => {
  assert(q.id, `question ${i} has no id`);
  assert(!ids.has(q.id), `duplicate question id: ${q.id}`);
  ids.add(q.id);
  assert(known.has(q.topic), `${q.id} has unknown topic "${q.topic}"`);
  assert([1, 2, 3].includes(q.level), `${q.id} has level ${q.level}, expected 1-3`);
  assert(q.q && q.q.length > 12, `${q.id} has no real question text`);
  assert(q.lay && q.lay.length > 60, `${q.id} is missing a plain-English answer`);
  // a short technical answer is fine only when a table, diagram or code block carries it
  assert(q.tech && (q.tech.length > 80 || q.compare || q.code || q.dgm),
    `${q.id} is missing a technical answer`);
  assert(/\?/.test(q.q) || /^(Walk|Describe|Design|Tell|Explain|Compare|Give|Name|List)/.test(q.q),
    `${q.id} does not read as an interview question: "${q.q.slice(0, 60)}"`);
  // the layman answer is the differentiator of this bank; it must not be jargon
  const jargon = /\b(logits|softmax|autoregressive|quadratic|bi-encoder|cross-encoder)\b/i;
  // a term is allowed in the plain answer only if the QUESTION is about that term
  const j = (q.lay.match(new RegExp(jargon, 'gi')) || [])
    .filter(w => !q.q.toLowerCase().includes(w.toLowerCase()));
  assert(j.length === 0, `${q.id}'s plain-English answer uses jargon: ${j[0]}`);
  if (q.compare) {
    assert(Array.isArray(q.compare.cols) && q.compare.cols.length >= 2,
      `${q.id} has a comparison table with fewer than two columns`);
    q.compare.rows.forEach(r => assert(r.length === q.compare.cols.length + 1,
      `${q.id} comparison row "${r[0]}" has ${r.length - 1} cells for ${q.compare.cols.length} columns`));
  }
  if (q.dgm) {
    const nodes = q.dgm.nodes || q.dgm;
    assert(Array.isArray(nodes) && nodes.length >= 2, `${q.id} has a diagram with fewer than two nodes`);
  }
  if (q.xref) q.xref.forEach(x => {
    assert(x.length === 2, `${q.id} has a malformed cross-reference`);
    const target = path.join('..', x[1].replace(/^\.\.\//, ''));
    assert(fs.existsSync(target), `${q.id} links to ${x[1]}, which does not exist`);
  });
});

/* ---- the bank has to be big enough to be worth the name ---- */
assert(QB.length >= 400, `only ${QB.length} questions; the project promises 400+`);
console.log(`  ${QB.length} questions across ${TOPICS.length} topics`);

/* ---- and spread across topics and levels, not piled into one ---- */
TOPICS.forEach(t => {
  const n = QB.filter(q => q.topic === t).length;
  assert(n >= 15, `topic "${t}" has only ${n} questions; every topic needs at least 15`);
});
[1, 2, 3].forEach(l => {
  const n = QB.filter(q => q.level === l).length;
  assert(n >= 20, `only ${n} questions at level ${l}; the mock interview needs a spread`);
});

/* ---- every one of the 57 seed questions must be answered somewhere ---- */
const covered = new Set(QB.filter(q => q.orig).map(q => q.orig));
const missing = [];
for (let i = 1; i <= 57; i++) if (!covered.has(i)) missing.push(i);
assert(missing.length === 0,
  `seed questions with no answer in the bank: ${missing.join(', ')}`);
console.log(`  all 57 seed questions covered by ${QB.filter(q => q.orig).length} bank entries`);

/* ---- multiple choice: answers must index a real option, and be non-trivial ---- */
const mcqQs = new Set();
MCQ.forEach((m, i) => {
  assert(known.has(m.topic), `MCQ ${i} has unknown topic "${m.topic}"`);
  assert(Array.isArray(m.o) && m.o.length >= 3, `MCQ ${i} needs at least three options`);
  assert(m.o[m.a] !== undefined, `MCQ ${i} answer index ${m.a} is out of range`);
  assert(m.e && m.e.length > 40, `MCQ ${i} needs a real explanation`);
  assert(!mcqQs.has(m.q), `duplicate MCQ question: ${m.q.slice(0, 50)}`);
  mcqQs.add(m.q);
  // the correct answer must not simply be the longest option, or the quiz is guessable
  const lens = m.o.map(o => o.length);
  const longest = lens.indexOf(Math.max(...lens));
  m._longestIsAnswer = longest === m.a;
});
assert(MCQ.length >= 150, `only ${MCQ.length} multiple-choice questions`);

/* Two things make a multiple-choice bank guessable: the answer always sitting in
   the same slot, and the answer always being the longest option.
   The first is fixed in the app - renderQuiz shuffles the options - so assert the
   app actually does that, because losing it silently would make "always pick B"
   score about 90%.                                                              */
assert(/m\._order = shuffle\(/.test(app) && /bi === m\._ans/.test(app),
  'app.js no longer shuffles quiz options, so the authored answer position is a giveaway');

/* The second cannot be fully removed: a precise answer is often longer than a
   terse misconception. Track it so it cannot silently get worse.               */
const guessable = MCQ.filter(m => m._longestIsAnswer).length / MCQ.length;
assert(guessable < 0.80,
  `${(guessable * 100).toFixed(0)}% of MCQs have the longest option as the answer — rewrite some distractors`);
console.log(`  ${MCQ.length} multiple-choice questions, ${(guessable * 100).toFixed(0)}% longest-is-answer (options are shuffled at render)`);

/* ---- every topic in the app must have MCQs, or the quiz filter renders empty ---- */
TOPICS.forEach(t => {
  const n = MCQ.filter(m => m.topic === t).length;
  if (n === 0) console.log(`  note: topic "${t}" has no multiple-choice questions (quiz filter will be empty)`);
});

/* ---- study paths must point at topics and courses that exist ---- */
PATHS.forEach(p => {
  assert(p.n && p.d && p.stages.length >= 5, `path "${p.n}" is too thin to be useful`);
  p.stages.forEach(s => {
    (s.topics || []).forEach(t => assert(known.has(t), `path "${p.n}" references unknown topic "${t}"`));
    if (s.course) {
      const target = path.join('..', s.course[1].replace(/^\.\.\//, ''));
      assert(fs.existsSync(target), `path "${p.n}" links to ${s.course[1]}, which does not exist`);
    }
  });
});
console.log(`  ${PATHS.length} study paths, all links resolve`);

/* ---- every bank file referenced by index.html must exist, and vice versa ---- */
const referenced = [...html.matchAll(/src="js\/([^"]+)"/g)].map(m => m[1]);
referenced.forEach(f => assert(fs.existsSync(path.join('js', f)),
  `index.html loads js/${f}, which does not exist`));
fs.readdirSync('js').forEach(f => assert(referenced.includes(f),
  `js/${f} exists but index.html never loads it`));

/* ---- every element id the app reaches for must exist in the markup ---- */
const wanted = new Set();
for (const m of app.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)/g)) wanted.add(m[1]);
const built = new Set();
for (const m of html.matchAll(/id="([^"]+)"/g)) built.add(m[1]);
for (const m of app.matchAll(/id="([^"]+)"/g)) built.add(m[1]);
const absent = [...wanted].filter(id => !built.has(id));
assert(absent.length === 0, `app.js targets ids nothing creates: ${absent.join(', ')}`);


/* ---- boot smoke test: run the real app.js against a minimal DOM ---- */
{
  const { makeDom } = require('./domstub.js');
  const { window, document } = makeDom(html);
  /* the sandbox global IS window in a browser, so copy the stub onto it */
  const boot = Object.assign({ console }, window);
  boot.window = boot;
  boot.self = boot;
  boot.globalThis = boot;
  vm.createContext(boot);
  [...banks, 'mcq.js', 'paths.js', 'app.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join('js', f), 'utf8'), boot, { filename: f }));
  console.log('  app boots against a stub DOM without throwing');
}

console.log('ok — question bank is consistent');
