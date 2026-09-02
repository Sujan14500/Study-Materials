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

/* ---------------------------------------------------------------
   Ch1 — the type explorer must not claim something is both
   immutable and a container you can mutate.
   --------------------------------------------------------------- */
const MUTABLE_TYPES = new Set(['list', 'dict', 'set']);
C.typeCards.forEach(t => {
  assert.strictEqual(t.mut, MUTABLE_TYPES.has(t.type),
    `type card "${t.lit}" claims mutable=${t.mut} for a ${t.type}`);
  assert(t.note && t.type && t.size, `type card "${t.lit}" is missing a field`);
});
// the falsy set must be exactly Python's falsy set for these literals
const FALSY_LITERALS = new Set(['""', 'None', '0', '[]']);
C.typeCards.forEach(t =>
  assert.strictEqual(t.truthy, !FALSY_LITERALS.has(t.lit),
    `type card "${t.lit}" has the wrong truthiness`));

/* ---------------------------------------------------------------
   Ch2 — every name must point at an object that exists in the heap
   at that step, or the demo draws an arrow into nothing.
   --------------------------------------------------------------- */
C.bindProgs.forEach(p => {
  assert(p.steps.length, `${p.id} has no steps`);
  p.steps.forEach((s, si) => {
    assert(s.line >= 0 && s.line < p.lines.length,
      `${p.id} step ${si} points at line ${s.line}, out of range`);
    Object.entries(s.names).forEach(([n, id]) =>
      assert(s.heap[id] !== undefined,
        `${p.id} step ${si}: name ${n} -> ${id}, which is not on the heap`));
  });
  // the heap only ever grows within a program — nothing is garbage collected mid-demo
  for (let i = 1; i < p.steps.length; i++) {
    Object.keys(p.steps[i - 1].heap).forEach(id =>
      assert(p.steps[i].heap[id] !== undefined,
        `${p.id} step ${i}: heap object ${id} vanished`));
  }
  // stdout is append-only: a step never un-prints what an earlier step printed
  for (let i = 1; i < p.steps.length; i++) {
    assert(p.steps[i].out.startsWith(p.steps[i - 1].out),
      `${p.id} step ${i}: stdout shrank`);
  }
});
// the aliasing lesson only lands if two names really do share one object
const alias = C.bindProgs.find(p => p.id === 'alias');
const aliasEnd = alias.steps[alias.steps.length - 1];
assert.strictEqual(aliasEnd.names.a, aliasEnd.names.b,
  'the alias program must end with a and b on the same object');
const rebind = C.bindProgs.find(p => p.id === 'rebind');
const rebindEnd = rebind.steps[rebind.steps.length - 1];
assert.notStrictEqual(rebindEnd.names.a, rebindEnd.names.b,
  'the rebind program must end with a and b on different objects');

/* ---------------------------------------------------------------
   Ch3 — every advertised slice result is recomputed here with
   Python's own slice rules. If a case is wrong, this fails.
   --------------------------------------------------------------- */
function pySlice(s, spec) {
  const body = spec.slice(1, -1);            // strip the brackets
  if (!body.includes(':')) {                 // a plain index
    let i = Number(body);
    if (i < 0) i += s.length;
    assert(i >= 0 && i < s.length, `index ${body} out of range`);
    return s[i];
  }
  const [a, b, c] = body.split(':');
  const step = c === undefined || c === '' ? 1 : Number(c);
  assert(step !== 0, 'slice step cannot be zero');
  const norm = (v, dflt) => {
    if (v === undefined || v === '') return dflt;
    let n = Number(v);
    if (n < 0) n += s.length;
    return n;
  };
  let start, stop;
  if (step > 0) {
    start = Math.max(0, Math.min(s.length, norm(a, 0)));
    stop  = Math.max(0, Math.min(s.length, norm(b, s.length)));
  } else {
    start = Math.max(-1, Math.min(s.length - 1, norm(a, s.length - 1)));
    stop  = Math.max(-1, Math.min(s.length - 1, norm(b, -1)));
  }
  let out = '';
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) out += s[i];
  return out;
}
C.sliceCases.forEach(c =>
  assert.strictEqual(pySlice(C.sliceDemo, c.s), c.out,
    `slice "${c.s}" on "${C.sliceDemo}" should be "${pySlice(C.sliceDemo, c.s)}", not "${c.out}"`));

// string method results, recomputed
const S = C.strSubject;
const strTruth = {
  's.upper()':            S.toUpperCase(),
  's.strip()':            S.trim(),
  's.replace("l", "L")':  S.split('l').join('L'),
  's.split(",")':         JSON.stringify(S.split(',')).replace(/","/g, "', '").replace(/^\["/, "['").replace(/"\]$/, "']"),
  's.find("World")':      String(S.indexOf('World')),
  's.strip().title()':    S.trim().replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  's.startswith("  He")': S.startsWith('  He') ? 'True' : 'False',  // Python capitalises its booleans
  'len(s)':               String(S.length)
};
C.strOps.forEach(o => {
  if (strTruth[o.call] === undefined) assert.fail(`no independent check for ${o.call}`);
  assert.strictEqual(o.out, strTruth[o.call],
    `${o.call} on "${S}" should be ${JSON.stringify(strTruth[o.call])}, not ${JSON.stringify(o.out)}`);
});

// f-string format specs, recomputed
const fsTruth = {
  'f"{name} is {age}"': () => 'Ada is 36',
  'f"{price:.2f}"':     () => (3.14159).toFixed(2),
  'f"{total:,}"':       () => (1234567).toLocaleString('en-US'),
  'f"{pct:.1%}"':       () => (0.4237 * 100).toFixed(1) + '%',
  'f"{name:>8}"':       () => 'Ada'.padStart(8)
};
C.fstrings.forEach(f => {
  const check = fsTruth[f.expr] || fsTruth[f.expr.replace('|"', '"')];
  if (check) {
    const want = f.expr.endsWith('|"') ? check() + '|' : check();
    assert.strictEqual(f.out, want, `${f.expr} should render ${JSON.stringify(want)}, not ${JSON.stringify(f.out)}`);
  }
  assert(f.why && Object.keys(f.vars).length, `f-string ${f.expr} is missing vars or a why`);
});

/* ---------------------------------------------------------------
   Ch4 — the complexity table and the container chooser
   --------------------------------------------------------------- */
const CONTAINERS = ['list', 'tuple', 'dict', 'set'];
C.collTable.forEach(r => {
  CONTAINERS.forEach(k => assert(r[k], `collTable row "${r.op}" has no entry for ${k}`));
  assert(r.note, `collTable row "${r.op}" has no note`);
});
// the chapter's whole argument is that set membership beats list membership
const member = C.collTable.find(r => r.op === 'x in c');
assert.strictEqual(member.list, 'O(n)', 'list membership must be shown as O(n)');
assert.strictEqual(member.set, 'O(1)', 'set membership must be shown as O(1)');
C.collTasks.forEach(t => {
  assert(CONTAINERS.includes(t.pick), `task "${t.ask}" picks unknown container "${t.pick}"`);
  assert(t.good && t.bad && t.why, `task "${t.ask}" is missing a field`);
  assert.notStrictEqual(t.good, t.bad, `task "${t.ask}" shows the same code twice`);
});
// every container must be the right answer at least once, or an option is dead
const picked = new Set(C.collTasks.map(t => t.pick));
CONTAINERS.forEach(k => assert(picked.has(k), `no task ever answers "${k}"`));

/* ---------------------------------------------------------------
   Ch5 — the tracer must land on the values it promises
   --------------------------------------------------------------- */
C.traceProgs.forEach(p => {
  assert(p.steps.length, `trace ${p.id} has no steps`);
  const last = p.steps[p.steps.length - 1];
  p.steps.forEach((s, si) => {
    assert(s.line >= 0 && s.line < p.lines.length,
      `trace ${p.id} step ${si} points at line ${s.line}, out of range`);
    Object.values(s.vars).forEach(v => assert(typeof v === 'string',
      `trace ${p.id} step ${si}: variable values must be strings so the renderer can print them`));
  });
  Object.entries(p.expect).forEach(([k, v]) =>
    assert.strictEqual(last.vars[k], v,
      `trace ${p.id} ends with ${k}=${last.vars[k]}, but expects ${v}`));
  for (let i = 1; i < p.steps.length; i++) {
    assert(p.steps[i].out.startsWith(p.steps[i - 1].out),
      `trace ${p.id} step ${i}: stdout shrank`);
  }
});
// the loop-variable-leaks lesson depends on n surviving past the loop body
const sumTrace = C.traceProgs.find(p => p.id === 'sum');
assert(sumTrace.steps[sumTrace.steps.length - 1].vars.n !== undefined,
  'the sum trace must still show n after the loop, or the scope lesson is lost');

/* ---------------------------------------------------------------
   Ch6 — argument binding must cover every parameter, every time
   --------------------------------------------------------------- */
C.funcParams.forEach(p =>
  assert(C.funcSig.includes(p), `signature does not mention parameter "${p}"`));
C.funcCalls.forEach(c => {
  // compared as strings: content.js runs in a vm context, so its arrays are cross-realm
  assert.strictEqual(Object.keys(c.bind).sort().join(','), C.funcParams.slice().sort().join(','),
    `call ${c.call} does not bind exactly the declared parameters`);
  assert(c.why, `call ${c.call} has no explanation`);
});
// keyword-only really must be unreachable positionally: no call fills note by position
const positional = C.funcCalls.find(c => c.call === 'order("tea", 3, "hot", "large")');
assert.strictEqual(positional.bind.note, '""',
  'extra positionals must land in *extras, never in the keyword-only note');
assert.strictEqual(positional.bind.extras, '("hot", "large")',
  '*extras must collect the surplus positional arguments');
// the mutable-default demo is only a lesson if the two outputs differ
assert.notStrictEqual(C.mutDefault.badOut, C.mutDefault.goodOut,
  'the mutable-default trap and its fix must produce different output');
assert(C.mutDefault.bad.includes('=[]'), 'the trap must actually use a mutable default');
assert(C.mutDefault.good.includes('is None'), 'the fix must use the None sentinel');

/* ---------------------------------------------------------------
   Ch7 — each traceback must name its own exception on the last line
   --------------------------------------------------------------- */
C.errCases.forEach(c => {
  const lines = c.tb.trim().split('\n');
  assert(lines[lines.length - 1].startsWith(c.name + ':') ||
         lines[lines.length - 1].startsWith(c.name),
    `${c.name}: the last traceback line must be the exception — got "${lines[lines.length - 1]}"`);
  assert(c.read && c.fix, `${c.name} is missing a reading or a fix`);
  assert.notStrictEqual(c.code, c.fix, `${c.name} shows the same code as broken and fixed`);
});
C.tryPatterns.forEach(p => assert(p.code && p.why, `try pattern "${p.t}" is incomplete`));

/* ---------------------------------------------------------------
   Ch8 — comprehension results are recomputed from the input
   --------------------------------------------------------------- */
const nums = C.compInput;
const compTruth = {
  map:       () => '[' + nums.map(n => n * n).join(', ') + ']',
  filter:    () => '[' + nums.filter(n => n % 2 === 0).join(', ') + ']',
  ternary:   () => '[' + nums.map(n => (n % 2 ? n * n : 0)).join(', ') + ']',
  dict:      () => '{' + nums.map(n => `${n}: ${n * n}`).join(', ') + '}',
  set:       () => '{' + [...new Set(nums.map(n => n % 3))].sort().join(', ') + '}',
  generator: () => String(nums.reduce((a, n) => a + n * n, 0))
};
C.comps.forEach(c => {
  assert(compTruth[c.kind], `no independent check for comprehension kind "${c.kind}"`);
  assert.strictEqual(c.result, compTruth[c.kind](),
    `comprehension "${c.kind}" claims ${c.result}, but the input gives ${compTruth[c.kind]()}`);
  assert.strictEqual(c.keep.length, nums.length, `comprehension "${c.kind}" keep mask is the wrong length`);
  assert.strictEqual(c.vals.length, nums.length, `comprehension "${c.kind}" vals is the wrong length`);
});
// only the filter form may drop items — the others transform every element
C.comps.forEach(c => {
  const dropped = c.keep.filter(k => !k).length;
  assert.strictEqual(dropped > 0, c.kind === 'filter',
    `comprehension "${c.kind}" drops ${dropped} items; only the filter form should drop any`);
});

/* ---------------------------------------------------------------
   Ch9 / Ch10 / Ch11 — the rest of the content
   --------------------------------------------------------------- */
C.fileOps.forEach(f => {
  assert(f.code.includes('with ') || f.code.includes('Path('),
    `file op "${f.t}" should demonstrate with-blocks or pathlib, not bare open()`);
  assert(f.why, `file op "${f.t}" has no explanation`);
});
C.envSteps.forEach(s => assert(s.cmd && s.what && s.why, `env step "${s.cmd}" is incomplete`));
assert(C.envSteps.some(s => s.cmd.includes('venv')), 'the setup walkthrough must create a venv');
assert(C.envSteps.some(s => s.cmd.includes('requirements.txt')), 'the setup walkthrough must pin dependencies');
C.classDemo.parts.forEach(p =>
  assert(C.classDemo.code.includes(p.k.replace('self.', '')),
    `class annotation "${p.k}" refers to something not in the code sample`));

C.gotchas.forEach((g, i) => {
  assert(g.guess[g.a] !== undefined, `gotcha ${i} has a bad answer index`);
  assert.strictEqual(g.guess.length, 2, `gotcha ${i} should offer exactly two guesses`);
  assert(g.e, `gotcha ${i} has no explanation`);
});
C.quiz.forEach((q, i) => {
  assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`);
  assert.strictEqual(new Set(q.o).size, q.o.length, `quiz ${i} has duplicate options`);
  assert(q.e, `quiz ${i} has no explanation`);
});
C.glossary.forEach(t => assert(t.length === 2 && t[0] && t[1], `glossary entry ${t[0]} is malformed`));

/* ---------------------------------------------------------------
   Ch10 — the data stack, and every pandas output recomputed from
   the one source table. If a cell is wrong, this fails.
   --------------------------------------------------------------- */
C.dataStack.forEach(p => {
  assert(p.name && p.what && p.code && p.why, `data stack card "${p.name}" is missing a field`);
  assert(/^pip install /.test(p.tag), `data stack card "${p.name}" should carry its pip install line`);
});
['NumPy', 'pandas'].forEach(n =>
  assert(C.dataStack.some(p => p.name === n), `the data stack must cover ${n}`));

assert(C.vecDemo.loopOps > C.vecDemo.vecOps * 1000,
  'the vectorised side must be at least three orders of magnitude fewer Python-level operations');
assert(/for /.test(C.vecDemo.loop) && !/for /.test(C.vecDemo.vec),
  'the loop side must loop in Python and the array side must not');
assert(/not measuring/.test(C.vecDemo.caution),
  'the widget must say it is not measuring wall-clock time, because it is not');

/* pandas prints a frame as: index column, then each column right-aligned to
   max(header, widest value), joined by two spaces. Recompute, do not trust. */
function pdTable(cols, rows, idx) {
  const w = cols.map((c, ci) => Math.max(String(c).length, ...rows.map(r => String(r[ci]).length)));
  const line = (lead, cells) =>
    String(lead).padStart(String(Math.max(...idx)).length) +
    cells.map((v, ci) => '  ' + String(v).padStart(w[ci])).join('');
  return [line('', cols)].concat(rows.map((r, ri) => line(idx[ri], r))).join('\n');
}
/* and a Series as: optional index name, then index left-aligned, value right-aligned */
function pdSeries(pairs, opt) {
  const iw = Math.max(...pairs.map(p => String(p[0]).length));
  const vw = Math.max(...pairs.map(p => String(p[1]).length));
  const body = pairs.map(p => String(p[0]).padEnd(iw) + String(p[1]).padStart(vw + 4));
  return (opt.index ? [opt.index] : []).concat(body, [opt.foot]).join('\n');
}

const PD = C.pandasDF, PCOLS = PD.cols, PROWS = PD.rows;
const col = n => PCOLS.indexOf(n);
const withIdx = pairs => ({ rows: pairs.map(p => p[1]), idx: pairs.map(p => p[0]) });

const salary = col('salary'), years = col('years'), dept = col('dept');
const rich = withIdx(PROWS.map((r, i) => [i, r]).filter(p => p[1][salary] > 90000));
const sorted = withIdx(PROWS.map((r, i) => [i, r]).slice().sort((a, b) => b[1][salary] - a[1][salary]));
const means = {};
PROWS.forEach(r => (means[r[dept]] = means[r[dept]] || []).push(r[salary]));
const counts = {};
PROWS.forEach(r => counts[r[dept]] = (counts[r[dept]] || 0) + 1);

const pandasTruth = {
  load: () => `(${PROWS.length}, ${PCOLS.length})`,
  head: () => pdTable(PCOLS, PROWS.slice(0, 3), [0, 1, 2]),
  select: () => pdTable(['name', 'salary'], PROWS.map(r => [r[col('name')], r[salary]]), PROWS.map((_, i) => i)),
  filter: () => pdTable(PCOLS, rich.rows, rich.idx),
  sort: () => pdTable(PCOLS, sorted.rows, sorted.idx),
  assign: () => pdTable(PCOLS.concat('senior'),
    PROWS.map(r => r.concat(r[years] >= 5 ? 'True' : 'False')), PROWS.map((_, i) => i)),
  group: () => pdSeries(
    Object.keys(means).sort().map(d => [d, (means[d].reduce((a, b) => a + b, 0) / means[d].length).toFixed(1)]),
    { index: 'dept', foot: 'Name: salary, dtype: float64' }),
  counts: () => pdSeries(
    Object.keys(counts).sort().map(d => [d, counts[d]]).sort((a, b) => b[1] - a[1]),
    { index: 'dept', foot: 'Name: count, dtype: int64' }),
  missing: () => pdSeries(PCOLS.map(c => [c, 0]), { foot: 'dtype: int64' })
};
C.pandasOps.forEach(op => {
  assert(op.code && op.why, `pandas op "${op.id}" is incomplete`);
  const want = pandasTruth[op.id];
  if (!want) { assert.strictEqual(op.out, null, `pandas op "${op.id}" shows output nothing here recomputes`); return; }
  assert.strictEqual(op.out, want(), `pandas op "${op.id}" prints\n${op.out}\nbut the data gives\n${want()}`);
});
// the filter example is only a lesson if it actually drops rows and keeps the original index
assert(rich.rows.length < PROWS.length && rich.idx.join(',') !== '0,1,2',
  'the filter example must drop rows and leave a gapped index');

/* ---------------------------------------------------------------
   Ch11 — the scikit-learn API, and the pipeline that must never
   let the test set in early
   --------------------------------------------------------------- */
C.sklearnApi.forEach(m => assert(m.name && m.what && m.code && m.why, `sklearn API card "${m.name}" is incomplete`));
['fit(X, y)', 'predict(X)', 'transform(X)'].forEach(n =>
  assert(C.sklearnApi.some(m => m.name === n), `the API panel must explain ${n}`));

C.mlPipeline.forEach(s => assert(s.n && s.small && s.code && s.say, `pipeline step "${s.n}" is incomplete`));
const stepNames = C.mlPipeline.map(s => s.n);
assert.strictEqual(stepNames[0], 'split', 'the pipeline must split before anything else');
const evalAt = stepNames.indexOf('evaluate');
assert(evalAt > stepNames.indexOf('fit'), 'evaluation must come after fitting');
C.mlPipeline.forEach((s, i) => {
  if (i === 0 || i >= evalAt) return;    // the split creates it; evaluate is allowed to use it
  assert(!/X_test|y_test/.test(s.code),
    `pipeline step "${s.n}" touches the test set before the evaluate step — that is the leak the chapter warns about`);
});
assert(C.mlPipeline.some(s => s.code.includes('Pipeline(')), 'the walkthrough must build an actual Pipeline');

C.modelPicks.forEach(t => {
  assert(C.modelOptions.includes(t.pick), `model task "${t.ask}" picks unknown option "${t.pick}"`);
  assert(t.good && t.bad && t.why, `model task "${t.ask}" is missing a field`);
  assert.notStrictEqual(t.good, t.bad, `model task "${t.ask}" shows the same code twice`);
});
const mpicked = new Set(C.modelPicks.map(t => t.pick));
C.modelOptions.forEach(o => assert(mpicked.has(o), `no task ever answers "${o}" — it is a dead option`));

C.mlTraps.forEach(t => {
  assert(t.t && t.bad && t.good && t.why, `ML trap "${t.t}" is incomplete`);
  assert.notStrictEqual(t.bad, t.good, `ML trap "${t.t}" shows the same code twice`);
});
C.mlEcosystem.forEach(e => assert(e.g && e.name && e.what && e.code, `ecosystem entry "${e.name}" is incomplete`));
assert(new Set(C.mlEcosystem.map(e => e.g)).size >= 3, 'the ecosystem panel needs its groups to filter by');
assert(C.mlEcosystem.some(e => /scikit-learn/.test(e.code)),
  'the ecosystem panel must show that the package is scikit-learn even though the import is sklearn');


/* ---------------------------------------------------------------
   Wiring — every id the demos reach for must exist somewhere
   --------------------------------------------------------------- */
const demos = fs.readFileSync('js/demos.js', 'utf8') + fs.readFileSync('js/packages.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

/* ---------------------------------------------------------------
   Dark-theme legibility. Two things go wrong silently here: a native
   <select> popup drawn white by the OS, and a text colour that drifts
   under the WCAG AA 4.5:1 body-text line.
   --------------------------------------------------------------- */
{
  const css = fs.readFileSync('css/styles.css', 'utf8');
  assert(/:root\s*\{[^}]*color-scheme:\s*dark/.test(css),
    'without color-scheme:dark the OS draws <select> popups white and the option text vanishes');

  const srgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = h => { const [r, g, b] = srgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const vars = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)) vars[m[1]] = vars[m[1]] || m[2];
  const bg = vars['--bg'];
  assert(bg, 'the theme must define --bg');
  Object.keys(vars).filter(k => /^--txt/.test(k)).forEach(k => {
    const r = contrast(vars[k], bg);
    assert(r >= 4.5, `${k} (${vars[k]}) is only ${r.toFixed(2)}:1 on ${bg} — under the 4.5:1 body-text line`);
  });
}

/* Reveal wiring. app.js runs at parse time, so its first observeReveals()
   sees a chapter whose JS-built cards do not exist yet. Without these two
   lines, a reload straight onto chapter 10, 11 or a deep dive shows empty
   panels — the cards are there at opacity 0, unobserved forever. */
const app = fs.readFileSync('js/app.js', 'utf8');
assert(/DOMContentLoaded['"]\s*,\s*observeReveals/.test(app),
  'app.js must re-run observeReveals after the widgets have built themselves');
assert(app.includes('window.observeReveals = observeReveals'),
  'app.js must expose observeReveals for widgets that rebuild cards later');
assert(/observeReveals\(\);\s*\/\/ these cards are rebuilt on filter/.test(demos),
  'techCards rebuilds .reveal cards on filter and must re-observe them');

// every chapter in the markup needs the data- attributes app.js builds the nav from
const chapters = [...html.matchAll(/<section class="chapter"([^>]*)>/g)].map(m => m[1]);
assert(chapters.length >= 10, `only ${chapters.length} chapters found`);
chapters.forEach(attrs => ['data-id', 'data-title', 'data-icon', 'data-group']
  .forEach(a => assert(attrs.includes(a), `a chapter is missing ${a}`)));
const chapterIds = chapters.map(a => /data-id="([^"]+)"/.exec(a)[1]);
assert.strictEqual(new Set(chapterIds).size, chapterIds.length, 'two chapters share a data-id');

/* ---------------------------------------------------------------
   Ch11 — every card on the page must carry a plain-English gloss,
   and every gloss must belong to a card that still exists.
   --------------------------------------------------------------- */
[['api', C.sklearnApi, t => t.name],
 ['pipe', C.mlPipeline, t => t.n],
 ['pick', C.modelPicks, t => t.ask],
 ['trap', C.mlTraps, t => t.t],
 ['eco', C.mlEcosystem, t => t.name]].forEach(([set, items, key]) => {
  const keys = items.map(key);
  assert.strictEqual(new Set(keys).size, keys.length, `C.plain.${set} cannot key on a duplicated field`);
  keys.forEach(k => assert(C.plain[set][k], `no plain-English gloss for ${set} item "${k}"`));
  Object.keys(C.plain[set]).forEach(k =>
    assert(keys.includes(k), `C.plain.${set} has an orphan gloss for "${k}" — the card it explained is gone`));
});
/* the model chooser must be a walkable tree: every answer leads somewhere
   real, and nothing in it is unreachable. */
{
  const T = C.plain.chooser;
  const seen = new Set();
  (function walk(id, depth) {
    assert(depth < 12, 'the chooser has a loop');
    seen.add(id);
    if (T.leaves[id]) {
      ['name', 'tag', 'plain', 'code', 'watch'].forEach(f =>
        assert(T.leaves[id][f], `chooser leaf "${id}" is missing ${f}`));
      return;
    }
    const node = T.nodes[id];
    assert(node, `chooser answer points at "${id}", which is neither a question nor a result`);
    assert(node.q && node.hint, `chooser node "${id}" needs a question and a hint`);
    assert(node.opts.length >= 2, `chooser node "${id}" needs a real choice`);
    node.opts.forEach(o => {
      assert(o.a && o.go, `an option in "${id}" is incomplete`);
      walk(o.go, depth + 1);
    });
  })(T.start, 0);
  Object.keys(T.nodes).concat(Object.keys(T.leaves)).forEach(id =>
    assert(seen.has(id), `chooser "${id}" can never be reached by answering questions`));
  assert(T.always, 'the chooser needs its always-true footer');
}

assert(C.plain.story.length >= 10, 'the everyday story needs enough rows to map the chapter');
C.plain.story.concat(C.plain.jargon).forEach(r =>
  assert(r.every(cell => typeof cell === 'string' && cell.trim()), 'a story/jargon row has an empty cell'));
C.plain.jargon.forEach(r => assert.strictEqual(r.length, 3,
  `jargon row "${r[0]}" must be [term, meaning, everyday example]`));

/* ---------------------------------------------------------------
   Package deep dives — the maths the widgets show must be real.
   These recompute against known values, not against themselves.
   --------------------------------------------------------------- */
const P = require('./js/packages.js');
const near = (a, b, tol, what) => assert(Math.abs(a - b) < tol, `${what}: got ${a}, expected ~${b}`);

// broadcasting follows the real right-aligned rule
assert(P.broadcast([3, 1], [1, 4]).ok, '(3,1)+(1,4) must broadcast');
assert.deepStrictEqual(P.broadcast([3, 1], [1, 4]).shape, [3, 4], '(3,1)+(1,4) -> (3,4)');
assert.deepStrictEqual(P.broadcast([2, 3, 4], [4]).shape, [2, 3, 4], 'trailing axis broadcasts');
assert(!P.broadcast([3, 4], [4, 3]).ok, '(3,4)+(4,3) must NOT broadcast');
assert(P.broadcast([3, 4], [4, 3]).err.includes('could not be broadcast'),
  'the failure must quote the real numpy message');
assert.strictEqual(P.showShape([3]), '(3,)', 'a 1-d shape prints with a trailing comma');

// Student's t two-sided p — checked against published table values
near(P.tSF2(2.100922, 18), 0.05, 5e-5, 't(18) at 2.101 is the 5% point');
near(P.tSF2(2.228139, 10), 0.05, 5e-5, 't(10) at 2.228 is the 5% point');
near(P.tSF2(0, 30), 1.0, 1e-9, 'no difference means p = 1');
assert(P.tSF2(4, 60) < P.tSF2(2, 60), 'a bigger t must give a smaller p');
// the claim the widget makes out loud: same effect, more n, smaller p
const se = n => 15 * Math.sqrt(2 / n);
assert(P.tSF2(6 / se(200), 398) < P.tSF2(6 / se(10), 18),
  'the n-slider lesson only holds if p really falls with n');

// normal cdf/ppf pair
near(P.normCdf(1.959964, 0, 1), 0.975, 1e-4, 'ppf(0.975) is 1.96');
near(P.normCdf(0, 0, 1), 0.5, 1e-9, 'the normal is symmetric about the mean');
near(P.normPdf(0, 0, 1), 0.3989423, 1e-6, 'peak height of the standard normal');

// lgamma backs the binomial and poisson bars — check a factorial it must reproduce
near(Math.exp(P.lgamma(6)), 120, 1e-6, 'lgamma(6) = ln(5!)');
// binomial pmf over all k must sum to 1
const logC = (n, k) => P.lgamma(n + 1) - P.lgamma(k + 1) - P.lgamma(n - k + 1);
for (const [n, p] of [[20, 0.3], [7, 0.85], [40, 0.05]]) {
  let tot = 0;
  for (let k = 0; k <= n; k++) tot += Math.exp(logC(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  near(tot, 1, 1e-9, `binom(${n}, ${p}) pmf sums to 1`);
}
// poisson too
for (const lam of [0.5, 4, 15]) {
  let tot = 0;
  for (let k = 0; k <= 200; k++) tot += Math.exp(-lam + k * Math.log(lam) - P.lgamma(k + 1));
  near(tot, 1, 1e-9, `poisson(${lam}) pmf sums to 1`);
}

/* ---- tools & frameworks strips ---- */
/* Every strip mounted in the page must have data, every strip with data must be
   mounted, and every tool must carry both advantages and drawbacks — a one-sided
   tool card is marketing, not a study note. */
{
  const tsHtml = fs.readFileSync('index.html', 'utf8');
  vm.runInContext(fs.readFileSync('js/tools.js', 'utf8'), ctx);
  const TS = ctx.window.C.toolstrips || {};
  const mounted = [...tsHtml.matchAll(/data-toolstrip="([a-z0-9-]+)"/g)].map(m => m[1]);
  mounted.forEach(k => assert(TS[k], `index.html mounts a tools strip "${k}" with no data in js/tools.js`));
  Object.keys(TS).forEach(k => {
    assert(mounted.includes(k), `js/tools.js defines strip "${k}" that the page never renders`);
    const s = TS[k];
    assert(s.tools.length >= 3, `tools strip "${k}" has fewer than three tools`);
    s.tools.forEach(t => {
      ['n', 'by', 'mark', 'what', 'use'].forEach(f =>
        assert(t[f] && String(t[f]).trim(), `tools strip "${k}": ${t.n || '?'} is missing ${f}`));
      assert(t.pro && t.pro.length >= 2, `tools strip "${k}": ${t.n} needs at least two advantages`);
      assert(t.con && t.con.length >= 2, `tools strip "${k}": ${t.n} needs at least two drawbacks`);
    });
  });
  if (mounted.length) console.log(`  ${mounted.length} tools strips, ` +
    `${Object.values(TS).reduce((a, s) => a + s.tools.length, 0)} tools with advantages and drawbacks`);
}

console.log(`ok — ${chapters.length} chapters, ${C.quiz.length} quiz questions, content is consistent`);
