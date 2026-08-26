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
   Wiring — every id the demos reach for must exist somewhere
   --------------------------------------------------------------- */
const demos = fs.readFileSync('js/demos.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = new Set();
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

// every chapter in the markup needs the data- attributes app.js builds the nav from
const chapters = [...html.matchAll(/<section class="chapter"([^>]*)>/g)].map(m => m[1]);
assert(chapters.length >= 10, `only ${chapters.length} chapters found`);
chapters.forEach(attrs => ['data-id', 'data-title', 'data-icon', 'data-group']
  .forEach(a => assert(attrs.includes(a), `a chapter is missing ${a}`)));
const chapterIds = chapters.map(a => /data-id="([^"]+)"/.exec(a)[1]);
assert.strictEqual(new Set(chapterIds).size, chapterIds.length, 'two chapters share a data-id');

console.log(`ok — ${chapters.length} chapters, ${C.quiz.length} quiz questions, content is consistent`);
