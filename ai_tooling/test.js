/* Smallest check that fails if the course data rots.
   Run: node test.js

   The promise this course makes on its own front page is "two lines
   and at least five points on every single tool". Most of what is
   below exists to make that promise unbreakable by an edit.          */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, a global in the browser
vm.createContext(ctx);
['js/content.js', 'js/cat-core.js', 'js/cat-infra.js', 'js/cat-state.js', 'js/cat-app.js']
  .forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx));
const C = ctx.window.C;
const html = fs.readFileSync('index.html', 'utf8');

const CATS = C.cats;
const TOOLS = [];
CATS.forEach(c => c.tools.forEach(t => TOOLS.push(Object.assign({ cat: c.id }, t))));

/* ---------- the promise ---------- */
CATS.forEach(c => {
  assert(c.id && c.n && c.ico && c.color && c.tag, `category ${c.id || '?'} is missing a field`);
  assert(c.two.length >= 110 && c.two.length <= 420, `category "${c.n}" summary is not a two-line summary (${c.two.length} chars)`);
  assert(c.pts.length >= 5, `category "${c.n}" has only ${c.pts.length} points — the floor is five`);
  assert(c.tools.length >= 5, `category "${c.n}" has only ${c.tools.length} tools`);
});

TOOLS.forEach(t => {
  ['id', 'n', 'by', 'kind', 'two', 'pick', 'watch'].forEach(k =>
    assert(t[k] && String(t[k]).trim(), `tool "${t.n || t.id}" is missing ${k}`));
  assert(t.pts.length >= 5, `tool "${t.n}" has only ${t.pts.length} points — the floor is five`);
  assert(t.two.length >= 110 && t.two.length <= 420, `tool "${t.n}" summary is not a two-line summary (${t.two.length} chars)`);
  t.pts.forEach((p, i) => assert(p.length > 40, `tool "${t.n}" point ${i + 1} is too thin to say out loud`));
});

/* ids must be unique or the catalogue and the picker collide */
const seen = new Set();
TOOLS.forEach(t => { assert(!seen.has(t.id), `duplicate tool id "${t.id}"`); seen.add(t.id); });
const catIds = new Set(CATS.map(c => c.id));
assert(catIds.size === CATS.length, 'duplicate category id');

/* ---------- the map ---------- */
C.mapQuestions.forEach(q => assert(catIds.has(q.cat), `mapQuestions points at unknown layer "${q.cat}"`));
assert(C.mapQuestions.length === CATS.length, 'every layer needs exactly one question on the map');

/* ---------- the picker ---------- */
C.picker.forEach((s, i) => {
  assert(s.a.length, `picker scenario ${i} has no correct answer`);
  s.a.forEach(id => assert(C.pickerTools[id], `picker scenario ${i} names unknown option "${id}"`));
  assert(s.why && s.why.length > 60, `picker scenario ${i} needs a real explanation, not a label`);
});
/* every offered option must be a real tool somewhere in the catalogue, or the
   drill teaches a name that does not exist. Two ids are deliberately coarser
   than a single tool row, so they are allowed by name. */
const COARSE = new Set(['rerank', 'mcp']);
Object.keys(C.pickerTools).forEach(id =>
  assert(seen.has(id) || COARSE.has(id), `pickerTools has "${id}" with no matching tool`));
/* the drill needs enough distractors to be a real choice */
assert(Object.keys(C.pickerTools).length >= 12, 'picker needs more options to be worth doing');

/* ---------- quiz ---------- */
C.quiz.forEach((q, i) => {
  assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`);
  assert(q.o.length >= 3, `quiz ${i} needs at least three options`);
  assert(q.e && q.e.length > 50, `quiz ${i} explanation is too thin`);
});

/* ---------- rapid fire + ladder ---------- */
C.rapid.forEach((r, i) => {
  assert(r.q.trim().endsWith('?'), `rapid ${i} is not a question`);
  assert(r.a.length > 80, `rapid ${i} answer is too short to be an interview answer`);
});
C.ladder.forEach((r, i) => ['n', 'what', 'when', 'cost'].forEach(k =>
  assert(r[k], `ladder rung ${i} is missing ${k}`)));

/* ---------- the page must actually render all of it ---------- */
['js/content.js', 'js/cat-core.js', 'js/cat-infra.js', 'js/cat-state.js', 'js/cat-app.js']
  .forEach(f => assert(html.includes(f), `index.html never loads ${f}`));
CATS.forEach(c => {
  assert(html.includes('data-toolcat="' + c.id + '"'), `no tool grid on the page for layer "${c.id}"`);
  assert(html.includes('data-catpts="' + c.id + '"'), `no five-point block on the page for layer "${c.id}"`);
  assert(html.includes('data-cattwo="' + c.id + '"'), `no two-line lead on the page for layer "${c.id}"`);
});
/* every mount point demos.js looks for must exist, or a widget silently vanishes */
['eco-svg', 'eco-info', 'ladder-box', 'picker', 'rapid', 'quiz', 'coverage',
 'cat-search', 'cat-chips', 'cat-out', 'cat-count'].forEach(id =>
  assert(html.includes('id="' + id + '"'), `index.html is missing #${id}`));

/* the sidebar count claimed in the hero must match reality */
const chapters = (html.match(/class="chapter"/g) || []).length;
assert(chapters === CATS.length + 7,
  `expected ${CATS.length + 7} chapters (welcome, map, ${CATS.length} layers, ladder, picker, catalogue, rapid, quiz) but found ${chapters}`);

/* ---------- the animated diagrams ---------- */
/* a step that names a node or an edge that does not exist lights nothing
   and says nothing about it, so it is checked here rather than in a browser */
Object.keys(C.arch).forEach(k => {
  const D = C.arch[k];
  assert(html.includes(`data-arch="${k}"`), `no mount point on the page for the "${k}" diagram`);
  assert(D.lead && D.note, `diagram "${k}" needs a lead and a note`);
  const ids = new Set(D.nodes.map(n => n.id));
  assert(ids.size === D.nodes.length, `diagram "${k}" has a duplicate node id`);
  D.nodes.forEach(n => {
    assert(n.n && n.s && n.ico && n.c, `diagram "${k}" node "${n.id}" is missing a field`);
    assert(n.x >= 0 && n.x + n.w <= D.w && n.y >= 0 && n.y + n.h <= D.h,
      `diagram "${k}" node "${n.id}" is drawn outside the viewBox`);
  });
  const edges = new Set(D.edges.map(e => e.f + '>' + e.t));
  D.edges.forEach(e => {
    assert(ids.has(e.f) && ids.has(e.t), `diagram "${k}" edge ${e.f}>${e.t} points at an unknown node`);
  });
  assert(edges.size === D.edges.length, `diagram "${k}" has the same edge twice`);
  D.steps.forEach((s, i) => {
    assert(s.t && s.say && s.say.length > 80, `diagram "${k}" step ${i + 1} has no real explanation`);
    s.n.forEach(id => assert(ids.has(id), `diagram "${k}" step ${i + 1} lights unknown node "${id}"`));
    s.e.forEach(id => assert(edges.has(id), `diagram "${k}" step ${i + 1} lights unknown edge "${id}"`));
  });
  /* every edge should be explained by some step, or it is decoration */
  const lit = new Set([].concat(...D.steps.map(s => s.e)));
  edges.forEach(id => assert(lit.has(id), `diagram "${k}" draws edge ${id} but no step ever explains it`));
});

const points = TOOLS.reduce((a, t) => a + t.pts.length, 0) + CATS.reduce((a, c) => a + c.pts.length, 0);
console.log(`ok — ${CATS.length} layers, ${TOOLS.length} tools, ${points} talking points, ` +
            `${C.quiz.length} quiz questions, ${C.picker.length} scenarios, ${C.rapid.length} rapid-fire pairs`);
