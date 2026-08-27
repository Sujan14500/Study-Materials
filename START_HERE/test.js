/* Smallest check that fails if the roadmap points at something that is not there.
   Run: node test.js                                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/roadmap.js', 'utf8'), ctx);
const C = ctx.window.COURSES, R = ctx.window.ROADMAP, T = ctx.window.TRACKS;
const html = fs.readFileSync('index.html', 'utf8');
const app  = fs.readFileSync('js/app.js', 'utf8');

/* every course must open something that actually exists on disk */
Object.keys(C).forEach(id => {
  const c = C[id];
  ['n', 'i', 'href', 'ch', 'hrs', 'd', 'why'].forEach(k =>
    assert(c[k] !== undefined, `course "${id}" is missing "${k}"`));
  assert(fs.existsSync(c.href), `course "${id}" links to ${c.href}, which does not exist`);
  assert(c.why.length > 50, `course "${id}" needs a real reason for being on the roadmap`);
});
console.log(`  ${Object.keys(C).length} courses, every link resolves`);

/* stages must reference real courses, and must cover all of them */
const inStages = new Set();
R.forEach((s, i) => {
  assert(s.n && s.d && s.tag, `stage ${i} is missing a field`);
  assert(s.items.length >= 1, `stage ${i} has no courses`);
  s.items.forEach(id => {
    assert(C[id], `stage "${s.n}" references unknown course "${id}"`);
    assert(!inStages.has(id), `course "${id}" appears in more than one stage`);
    inStages.add(id);
  });
});
Object.keys(C).forEach(id => assert(inStages.has(id),
  `course "${id}" exists but no stage includes it, so nothing on the page links to it`));
console.log(`  ${R.length} stages covering every course exactly once`);

/* tracks must reference real stages, and the ordering must be a real ordering */
T.forEach(t => {
  assert(t.id && t.n && t.d && t.time, `track "${t.n}" is missing a field`);
  assert(t.stages.length >= 3, `track "${t.n}" is too short to be a track`);
  t.stages.forEach(si => assert(R[si], `track "${t.n}" references stage ${si}, which does not exist`));
  assert(new Set(t.stages).size === t.stages.length, `track "${t.n}" repeats a stage`);
});
/* the default track must be the complete one, and must include every stage */
const full = T.filter(t => t.id === 'full')[0];
assert(full, 'there must be a track called "full"');
assert(full.stages.length === R.length, 'the "full" track must include every stage');
/* every stage must appear in at least one track, or it is unreachable in the UI */
R.forEach((s, i) => assert(T.some(t => t.stages.includes(i)),
  `stage "${s.n}" is in no track`));
console.log(`  ${T.length} tracks, all stages reachable`);

/* the sprint track must genuinely be shorter than the full one */
const courses = t => new Set(t.stages.flatMap(si => R[si].items)).size;
assert(courses(T.filter(t => t.id === 'sprint')[0]) < courses(full) / 2,
  'the two-week track is not meaningfully shorter than doing everything');

/* every element id the app reaches for must exist in the markup */
const wanted = new Set();
for (const m of app.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)/g)) wanted.add(m[1]);
const built = new Set();
for (const m of html.matchAll(/id="([^"]+)"/g)) built.add(m[1]);
for (const m of app.matchAll(/id="([^"]+)"/g)) built.add(m[1]);
const absent = [...wanted].filter(id => !built.has(id));
assert(absent.length === 0, `app.js targets ids nothing creates: ${absent.join(', ')}`);

/* the SVG gradients the CSS paints with must be defined in the same document */
['rg', 'ringg'].forEach(g => assert(html.includes('id="' + g + '"'),
  `CSS strokes with url(#${g}) but no such gradient is defined`));


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
  ['roadmap.js', 'app.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join('js', f), 'utf8'), boot, { filename: f }));
  console.log('  app boots against a stub DOM without throwing');
}

console.log('ok — roadmap is consistent');
