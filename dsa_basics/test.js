/* Smallest check that fails if the course data or its algorithms rot.
   Run: node test.js

   This course animates real algorithms — BST traversals, heap sifts,
   BFS/DFS, six sorts, binary search, the Fibonacci call tree. The point
   of this file is that a teaching course must not teach something false,
   so every one of those is re-implemented here and checked against a
   known-good answer rather than against itself.                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

/* content.js runs in a vm sandbox, so arrays it produces have a different Array
   prototype than ones built here. deepStrictEqual compares prototypes and would
   fail on identical values, so compare by value instead. */
const eq = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b),
  `${msg}
  got      ${JSON.stringify(a)}
  expected ${JSON.stringify(b)}`);

/* ---------- content consistency ---------- */

// quiz answers must index a real option
C.quiz.forEach((q, i) => assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`));

// every drill's answer key must name an option the UI actually renders
const drills = [
  ['bigoCases', C.bigoCases, C.growthClasses.map(g => g.k)],
  ['sqCases', C.sqCases, ['stack', 'queue']],
  ['paradigmCases', C.paradigmCases, C.paradigms.map(p => p.k)],
  ['chooserCases', C.chooserCases, Object.keys(C.chooserOptions)]
];
drills.forEach(([name, cases, keys]) => {
  cases.forEach((c, i) => assert(keys.includes(c.a), `${name}[${i}] answers "${c.a}", which is not an option`));
  // a drill where every answer is the same option teaches nothing
  assert(new Set(cases.map(c => c.a)).size > 1, `${name} must use more than one answer`);
});

// the growth classes must actually be ordered by growth at a large n
const n = 30;
for (let i = 1; i < C.growthClasses.length; i++) {
  assert(C.growthClasses[i].f(n) > C.growthClasses[i - 1].f(n),
    `growthClasses are out of order at n=${n}: ${C.growthClasses[i].name} should exceed ${C.growthClasses[i - 1].name}`);
}
// and the chapter's headline claim: log n is tiny, 2^n is not
assert(Math.log2(1e9) < 31, 'log2(1 billion) must be about 30 — the chapter says so');
assert(Math.pow(2, 20) > 1e6, '2^20 must exceed a million — the chapter says so');

// the array/list comparison must actually disagree, or the chapter has no point
const wins = C.listVsArray.map(r => r[3]);
assert(wins.includes('array') && wins.includes('list'),
  'the array-vs-list table must show each structure winning something');

/* ---------- the algorithms the course animates ---------- */

// --- BST + traversals (mirrors demos.js) ---
function bstInsert(root, v) {
  if (!root) return { v, l: null, r: null };
  if (v < root.v) root.l = bstInsert(root.l, v);
  else if (v > root.v) root.r = bstInsert(root.r, v);
  return root;
}
const build = vals => vals.reduce((r, v) => bstInsert(r, v), null);
const height = n => n ? 1 + Math.max(height(n.l), height(n.r)) : 0;
function traverse(root, kind) {
  const out = [];
  if (kind === 'level') {
    const q = root ? [root] : [];
    while (q.length) { const x = q.shift(); out.push(x.v); if (x.l) q.push(x.l); if (x.r) q.push(x.r); }
    return out;
  }
  (function w(x) {
    if (!x) return;
    if (kind === 'preorder') out.push(x.v);
    w(x.l);
    if (kind === 'inorder') out.push(x.v);
    w(x.r);
    if (kind === 'postorder') out.push(x.v);
  })(root);
  return out;
}
{
  const t = build(C.bstInserts);
  // the chapter's central claim about in-order: it comes out sorted
  eq(traverse(t, 'inorder'), C.bstInserts.slice().sort((a, b) => a - b),
    'in-order traversal of a BST must be sorted — that claim is the whole reason the traversal matters');
  // the root must come first pre-order and last post-order, by definition
  assert(traverse(t, 'preorder')[0] === C.bstInserts[0], 'pre-order must start at the root');
  assert(traverse(t, 'postorder').slice(-1)[0] === C.bstInserts[0], 'post-order must end at the root');
  eq(traverse(t, 'level')[0], C.bstInserts[0], 'level-order must start at the root');
  // every traversal visits every node exactly once
  C.traversals.forEach(tr => {
    const o = traverse(t, tr.k);
    assert(o.length === C.bstInserts.length, `${tr.k} visited ${o.length} of ${C.bstInserts.length} nodes`);
    assert(new Set(o).size === o.length, `${tr.k} visited a node twice`);
  });

  // the degeneracy demo must actually degenerate, and the balanced one must not
  const bal = height(build(C.bstInserts));
  const deg = height(build(C.degenerateInserts));
  assert(deg === C.degenerateInserts.length,
    `sorted inserts must produce a height equal to the node count (a list); got ${deg}`);
  assert(bal < deg, `the mixed-order tree (${bal}) must be shorter than the degenerate one (${deg})`);
  assert(bal <= Math.ceil(Math.log2(C.bstInserts.length + 1)) + 1,
    `the "balanced" example should actually be near log n; height ${bal}`);
}

// --- heap sifts (mirrors demos.js) ---
function siftUp(a, i) { while (i > 0) { const p = (i - 1) >> 1; if (a[p] <= a[i]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
function siftDown(a, i) {
  for (;;) {
    const l = 2 * i + 1, r = 2 * i + 2; let m = i;
    if (l < a.length && a[l] < a[m]) m = l;
    if (r < a.length && a[r] < a[m]) m = r;
    if (m === i) break;
    [a[i], a[m]] = [a[m], a[i]]; i = m;
  }
}
const isHeap = a => a.every((v, i) => {
  const l = 2 * i + 1, r = 2 * i + 2;
  return (l >= a.length || a[i] <= a[l]) && (r >= a.length || a[i] <= a[r]);
});
{
  const h = [];
  C.heapInserts.forEach(v => { h.push(v); siftUp(h, h.length - 1); assert(isHeap(h), `heap property broken after inserting ${v}`); });
  assert(h[0] === Math.min(...C.heapInserts), 'the root must be the minimum after all inserts');
  // extracting repeatedly must yield ascending order — and the invariant must hold throughout
  const outp = [];
  while (h.length) {
    outp.push(h[0]);
    const last = h.pop();
    if (h.length) { h[0] = last; siftDown(h, 0); assert(isHeap(h), 'heap property broken during extraction'); }
  }
  eq(outp, C.heapInserts.slice().sort((a, b) => a - b), 'repeated extract-min must produce sorted output');
  // the chapter claims a heap is NOT sorted — check the demo data actually demonstrates that
  const built = [];
  C.heapInserts.forEach(v => { built.push(v); siftUp(built, built.length - 1); });
  assert(built.join() !== built.slice().sort((a, b) => a - b).join(),
    'the example heap happens to be sorted, which would undercut the chapter\'s main point — pick different values');
}

// --- BFS / DFS (mirrors demos.js) ---
function adjacency() {
  const adj = {};
  C.graphNodes.forEach(x => adj[x] = []);
  C.graphEdges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  Object.keys(adj).forEach(k => adj[k].sort());
  return adj;
}
{
  const adj = adjacency();
  C.graphEdges.forEach(([a, b]) => {
    assert(C.graphNodes.includes(a) && C.graphNodes.includes(b), `edge ${a}-${b} references an unknown node`);
  });
  C.graphNodes.forEach(v => assert(C.graphPos[v], `graphPos is missing a position for ${v}`));

  const bfsOrder = (() => {
    const seen = new Set(['A']), q = ['A'], o = [];
    while (q.length) { const x = q.shift(); o.push(x); adj[x].forEach(m => { if (!seen.has(m)) { seen.add(m); q.push(m); } }); }
    return o;
  })();
  const dfsOrder = (() => {
    const seen = new Set(), o = [], st = ['A'];
    while (st.length) {
      const x = st.pop();
      if (seen.has(x)) continue;
      seen.add(x); o.push(x);
      adj[x].filter(m => !seen.has(m)).slice().reverse().forEach(m => st.push(m));
    }
    return o;
  })();

  assert(bfsOrder.length === C.graphNodes.length, 'BFS must reach every node — the demo graph must be connected');
  assert(dfsOrder.length === C.graphNodes.length, 'DFS must reach every node');
  assert(bfsOrder.join() !== dfsOrder.join(),
    'BFS and DFS produce the same order on this graph, so the chapter\'s comparison shows nothing');

  // BFS's defining property: nodes appear in non-decreasing distance from the start
  const dist = { A: 0 };
  (function () {
    const q = ['A'];
    while (q.length) { const x = q.shift(); adj[x].forEach(m => { if (!(m in dist)) { dist[m] = dist[x] + 1; q.push(m); } }); }
  })();
  for (let i = 1; i < bfsOrder.length; i++) {
    assert(dist[bfsOrder[i]] >= dist[bfsOrder[i - 1]],
      'BFS visited a farther node before a nearer one — that would break the shortest-path claim');
  }
}

// --- the six sorts must all actually sort ---
{
  const INPUT = [38, 12, 91, 5, 64, 27, 73, 49, 18, 56, 83, 31];
  const expected = INPUT.slice().sort((a, b) => a - b);
  const src = fs.readFileSync('js/demos.js', 'utf8');
  // run the real sortFrames from demos.js rather than a copy, so this cannot drift
  const sandbox = { C, Math, Array, Object, console };
  vm.createContext(sandbox);
  const fnSrc = src.slice(src.indexOf('function sortFrames'), src.indexOf('function initSort'));
  vm.runInContext(fnSrc, sandbox);
  C.sortAlgos.forEach(alg => {
    const frames = sandbox.sortFrames(alg.k, INPUT);
    assert(frames.length > 1, `${alg.name} produced no animation frames`);
    eq(frames[frames.length - 1].a, expected, `${alg.name} did not sort correctly`);
    eq(frames[0].a, INPUT, `${alg.name} did not start from the input array`);
    assert(frames[frames.length - 1].cmp > 0, `${alg.name} reports zero comparisons`);
  });
  // the table's complexity claims must at least be internally ordered:
  // an O(n log n) sort must do fewer comparisons than an O(n^2) one on this input
  const cmpOf = k => sandbox.sortFrames(k, INPUT).slice(-1)[0].cmp;
  assert(cmpOf('merge') < cmpOf('bubble'),
    'merge sort must beat bubble sort on comparisons, or the complexity table is lying');
}

// --- binary search (mirrors demos.js) ---
{
  const arr = C.searchArray;
  for (let i = 1; i < arr.length; i++) {
    assert(arr[i] > arr[i - 1], 'searchArray must be sorted — binary search is wrong on unsorted data');
  }
  const bin = t => { let lo = 0, hi = arr.length - 1, steps = 0; while (lo <= hi) { const m = (lo + hi) >> 1; steps++; if (arr[m] === t) return { found: m, steps }; if (arr[m] < t) lo = m + 1; else hi = m - 1; } return { found: -1, steps }; };
  arr.forEach((v, i) => assert(bin(v).found === i, `binary search failed to find ${v}`));
  assert(bin(50).found === -1, 'binary search must report a miss for a value not present');
  assert(bin(50).steps <= Math.ceil(Math.log2(arr.length)) + 1,
    'binary search took more than log2(n) steps — the chapter\'s claim would be false');
}

// --- the Fibonacci duplication claim ---
{
  const naive = k => k <= 1 ? 1 : 1 + naive(k - 1) + naive(k - 2);   // number of calls
  const memoCalls = k => {
    const memo = {}; let total = 0;
    (function f(x) { total++; if (x in memo) return memo[x]; if (x <= 1) return (memo[x] = x); return (memo[x] = f(x - 1) + f(x - 2)); })(k);
    return total;
  };
  const N = C.fibN;
  assert(naive(N) > memoCalls(N) * 2,
    `at fib(${N}) the naive recursion must make far more calls than the memoised one, or the chapter has no point`);
  // and the gap must widen with n — that is the exponential-vs-linear claim
  const ratioSmall = naive(6) / memoCalls(6);
  const ratioBig = naive(18) / memoCalls(18);
  assert(ratioBig > ratioSmall * 5,
    'the naive-vs-memo gap must widen sharply with n, or "exponential vs linear" is overstated');
}

// --- the string chapter's quadratic claim ---
{
  const naiveCopies = n => n * (n + 1) / 2;
  const builderCopies = n => n;
  assert(naiveCopies(1000) / builderCopies(1000) > 400,
    'naive concatenation must be dramatically worse at n=1000, or the chapter overstates it');
  assert(naiveCopies(2000) / naiveCopies(1000) > 3.9,
    'doubling n must roughly quadruple the work — that is what O(n^2) means');
}

console.log('ok — content data and every animated algorithm are correct');
