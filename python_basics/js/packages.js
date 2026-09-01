/* ============================================================
   packages.js — one deep-dive page per package.
   NumPy · pandas · Matplotlib · seaborn · SciPy.

   Self-contained on purpose: its own data, its own widgets, its
   own boot. The five <section class="chapter"> blocks in
   index.html are the only thing it needs to exist.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = (n, msg) => window.awardXP && window.awardXP(n, msg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (x, d) => Number(x).toFixed(d == null ? 2 : d);

/* code / output pair, the shape used everywhere in this course */
const twoUp = (code, out, why) =>
  '<div class="two-up">' +
    '<div><div class="lab-pane-title">code</div><pre class="code">' + esc(code) + '</pre></div>' +
    '<div><div class="lab-pane-title">output</div><pre class="code">' +
      (out == null ? '<span class="dim">no output — it draws, writes or returns in place</span>' : esc(out)) +
    '</pre></div></div>' + (why ? '<div class="stepper-say">' + why + '</div>' : '');

/* generic chip-tabs over [{label, code, out, why}] */
function opTabs(tabsSel, bodySel, ops) {
  const tabs = $(tabsSel), body = $(bodySel);
  if (!tabs || !body) return;
  ops.forEach((op, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), op.label);
    b.onclick = () => {
      $$('.chip', tabs).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      body.innerHTML = twoUp(op.code, op.out, op.why);
      xp(1);
    };
    tabs.appendChild(b);
  });
  body.innerHTML = twoUp(ops[0].code, ops[0].out, ops[0].why);
}

/* card grid, same look as .tech-grid elsewhere */
function cards(sel, items) {
  const root = $(sel); if (!root) return;
  root.innerHTML = '';
  items.forEach(t => root.appendChild(el('div', 'pcard reveal',
    '<h3>' + t.t + (t.tag ? ' <span class="pcard-badge">' + t.tag + '</span>' : '') + '</h3>' +
    (t.code ? '<pre class="code">' + esc(t.code) + '</pre>' : '') +
    '<p class="pcard-desc">' + t.d + '</p>')));
}

/* ============================================================
   maths — real, not decorative
   ============================================================ */
function lgamma(x) {                       /* Lanczos */
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
             -176.61502916214059, 12.507343278686905, -0.13857109526572012,
             9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993, t = x + 7.5;
  for (let i = 0; i < 8; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) {                 /* Numerical Recipes continued fraction */
  const MAX = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAX; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betai(a, b, x) {                  /* regularised incomplete beta */
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
/* two-sided p for Student's t — this is what scipy.stats.ttest_ind returns */
const tSF2 = (t, df) => betai(df / 2, 0.5, df / (df + t * t));
const erf = x => {                         /* Abramowitz & Stegun 7.1.26 */
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const normPdf = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
const normCdf = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const vari = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };

/* ============================================================
   tiny SVG plotting — enough to show what a call would draw
   ============================================================ */
function svg(w, h, inner, cls) {
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" ' +
         'style="max-width:' + w + 'px;height:auto;display:block;margin:0 auto"' +
         (cls ? ' class="' + cls + '"' : '') + '>' + inner + '</svg>';
}
const AX = '#5b6b85', INK = '#e6edf7', GRID = '#22304a';
function axes(x0, y0, x1, y1, xlab, ylab, grid) {
  let s = '';
  if (grid) for (let i = 1; i < 5; i++) {
    const y = y1 - (y1 - y0) * i / 5;
    s += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="' + GRID + '" stroke-width="1"/>';
  }
  s += '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="' + AX + '" stroke-width="1.5"/>' +
       '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x0 + '" y2="' + y1 + '" stroke="' + AX + '" stroke-width="1.5"/>';
  if (xlab) s += '<text x="' + ((x0 + x1) / 2) + '" y="' + (y1 + 26) + '" fill="#93a3b8" font-size="11" text-anchor="middle">' + xlab + '</text>';
  if (ylab) s += '<text x="' + (x0 - 26) + '" y="' + ((y0 + y1) / 2) + '" fill="#93a3b8" font-size="11" text-anchor="middle" transform="rotate(-90 ' + (x0 - 26) + ' ' + ((y0 + y1) / 2) + ')">' + ylab + '</text>';
  return s;
}

/* ============================================================
   DATA
   ============================================================ */

/* ---------- NumPy ---------- */
const NP_OPS = [
  { label: 'creation', code:
`np.array([1, 2, 3])          # from a list
np.zeros((2, 3))             # filled with 0.0
np.ones(4, dtype=np.int64)
np.arange(0, 10, 2)          # like range(), returns an array
np.linspace(0, 1, 5)         # 5 points INCLUDING both ends
np.random.default_rng(0).normal(size=3)`,
    out:
`array([1, 2, 3])
array([[0., 0., 0.],
       [0., 0., 0.]])
array([1, 1, 1, 1])
array([0, 2, 4, 6, 8])
array([0.  , 0.25, 0.5 , 0.75, 1.  ])
array([ 0.12573022, -0.13210486,  0.64042265])`,
    why: '<b>arange</b> excludes the stop, <b>linspace</b> includes it. That single difference is behind most off-by-one plots. Use a seeded <span class="mono">default_rng</span> rather than <span class="mono">np.random.seed</span> — the legacy global is shared state.' },
  { label: 'shape', code:
`a = np.arange(12)
a.shape          # (12,)
b = a.reshape(3, 4)
b.shape          # (3, 4)
b.reshape(2, -1) # -1 means "work it out"
b.T.shape        # (4, 3)
b.ravel().shape  # (12,) — flat view when it can be
a[:, None].shape # (12, 1) — add an axis`,
    out:
`(12,)
(3, 4)
array([[ 0,  1,  2,  3,  4,  5],
       [ 6,  7,  8,  9, 10, 11]])
(4, 3)
(12,)
(12, 1)`,
    why: '<span class="mono">reshape</span> never copies if it does not have to, and never changes the data — only how the same buffer is read. <span class="mono">None</span> (or <span class="mono">np.newaxis</span>) inserts a length-1 axis, which is how you set up a broadcast on purpose.' },
  { label: 'maths', code:
`a = np.array([1., 2., 3., 4.])
a * 2 + 1
np.sqrt(a)
a.sum(), a.mean(), a.std()
np.dot(a, a)      # or a @ a
np.clip(a, 2, 3)`,
    out:
`array([3., 5., 7., 9.])
array([1.        , 1.41421356, 1.73205081, 2.        ])
(10.0, 2.5, 1.118033988749895)
30.0
array([2., 2., 3., 3.])`,
    why: 'Every one of these runs in C over the whole buffer. The moment you write <span class="mono">for x in arr</span> you have thrown that away — the loop is the thing NumPy exists to delete.' },
  { label: 'indexing', code:
`a = np.arange(10, 20)
a[3]         # 13   scalar
a[2:5]       # view
a[::2]       # view, every other
a[[1, 3, 5]] # fancy -> COPY
a[a > 15]    # boolean mask -> COPY
a[-1]        # 19`,
    out:
`13
array([12, 13, 14])
array([10, 12, 14, 16, 18])
array([11, 13, 15])
array([16, 17, 18, 19])
19`,
    why: 'Slices are <b>views</b>; fancy and boolean indexing are <b>copies</b>. That one line decides whether writing to the result changes the original — see the view/copy lab below.' },
  { label: 'stacking', code:
`a = np.array([[1, 2], [3, 4]])
b = np.array([[5, 6]])
np.vstack([a, b])      # add rows
np.hstack([a, a])      # add columns
np.concatenate([a, b], axis=0)
np.stack([a, a]).shape # NEW axis`,
    out:
`array([[1, 2],
       [3, 4],
       [5, 6]])
array([[1, 2, 1, 2],
       [3, 4, 3, 4]])
array([[1, 2],
       [3, 4],
       [5, 6]])
(2, 2, 2)`,
    why: '<span class="mono">concatenate</span> joins along an axis that already exists; <span class="mono">stack</span> creates a new one. If a shape comes out one dimension too big, you reached for the wrong one.' },
  { label: 'where / any / all', code:
`a = np.array([3, -1, 4, -5])
np.where(a > 0, a, 0)   # elementwise if/else
np.where(a > 0)         # the indices
(a > 0).any(), (a > 0).all()
(a > 0).sum()           # True counts as 1
np.argmax(a), np.argsort(a)`,
    out:
`array([3, 0, 4, 0])
(array([0, 2]),)
(True, False)
2
(2, array([3, 1, 0, 2]))`,
    why: '<span class="mono">np.where</span> with three arguments is a vectorised ternary; with one it hands back indices. And <span class="mono">.sum()</span> on a boolean array is how you count matches — no loop, no <span class="mono">len([x for x ...])</span>.' }
];

const NP_TRAPS = [
  { t: 'if arr:', tag: 'ValueError', code:
`if arr:            # ValueError: the truth value of an
    ...            # array with more than one element
                   # is ambiguous
if arr.any(): ...  # or .all(), or arr.size`,
    d: 'An array has no single truthiness. NumPy refuses to guess which one you meant and says so — pick <span class="mono">.any()</span>, <span class="mono">.all()</span> or <span class="mono">.size</span> explicitly.' },
  { t: 'and / or', tag: 'same cause', code:
`(a > 0) and (a < 5)     # ValueError
(a > 0) & (a < 5)       # correct
a > 0 & a < 5           # wrong: & binds tighter`,
    d: 'Python’s <span class="mono">and</span>/<span class="mono">or</span> call <span class="mono">bool()</span>. Use <span class="mono">&amp;</span>, <span class="mono">|</span>, <span class="mono">~</span> — and parenthesise every comparison, because those operators bind more tightly than <span class="mono">&lt;</span>.' },
  { t: 'integer overflow', tag: 'silent', code:
`x = np.array([127], dtype=np.int8)
x + np.int8(1)
# RuntimeWarning: overflow encountered
# array([-128], dtype=int8)`,
    d: 'Fixed-width integers wrap. Python’s own <span class="mono">int</span> never does, so this only bites once you are in an array. Choose a wider dtype, or work in <span class="mono">float64</span>.' },
  { t: 'float equality', tag: 'never ==', code:
`0.1 + 0.2 == 0.3          # False
np.isclose(0.1 + 0.2, 0.3)  # True
np.allclose(a, b)           # whole arrays`,
    d: 'Binary floats cannot hold 0.1 exactly. Compare with <span class="mono">isclose</span>/<span class="mono">allclose</span>, and never write <span class="mono">==</span> between two computed floats.' },
  { t: 'copy vs view', tag: 'aliasing', code:
`b = a[2:5]        # view — writes reach a
b = a[2:5].copy() # independent
a.base is None    # True if a owns its data`,
    d: 'The cheapest debugging tool in NumPy: if a mutation seems to travel, check <span class="mono">.base</span>. Not <span class="mono">None</span> means you are holding a window onto someone else’s buffer.' },
  { t: 'ragged input', tag: 'NumPy 1.24+', code:
`np.array([[1, 2], [3]])
# ValueError: setting an array element
# with a sequence. The requested array
# has an inhomogeneous shape`,
    d: 'Arrays are rectangular. Uneven rows used to silently give you an object array; modern NumPy raises instead. Pad the rows, or keep a list of arrays.' }
];

/* ---------- pandas ---------- */
const STAFF = [
  { name: 'Ana',  dept: 'eng',   years: 6, salary: 118000 },
  { name: 'Bo',   dept: 'eng',   years: 2, salary:  94000 },
  { name: 'Cai',  dept: 'sales', years: 9, salary: 102000 },
  { name: 'Dee',  dept: 'sales', years: 1, salary:  61000 },
  { name: 'Eli',  dept: 'ops',   years: 4, salary:  78000 }
];
const LEFT_T  = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bo' }, { id: 3, name: 'Cai' }];
const RIGHT_T = [{ id: 2, city: 'Pune' }, { id: 3, city: 'Berlin' }, { id: 4, city: 'Lima' }];

const PD_INDEX = [
  { label: '.loc', code:
`df.loc[2]                 # row with INDEX label 2
df.loc[2, "salary"]       # one cell
df.loc[df.dept == "eng"]  # boolean mask
df.loc[:, "name":"years"] # label slice: END INCLUDED`,
    out:
`name        Cai
dept      sales
years         9
salary   102000
Name: 2, dtype: object

102000

  name dept  years  salary
0  Ana  eng      6  118000
1   Bo  eng      2   94000

  name   dept  years
0  Ana    eng      6
1   Bo    eng      2
...`,
    why: '<b>Labels.</b> And the one thing that catches everyone: a <span class="mono">.loc</span> slice <b>includes</b> the end label, unlike every other slice in Python.' },
  { label: '.iloc', code:
`df.iloc[2]        # third row, by POSITION
df.iloc[0:2]      # rows 0,1 — end excluded
df.iloc[-1]       # last row
df.iloc[0, 3]     # row 0, column 3`,
    out:
`name        Cai
dept      sales
years         9
salary   102000
Name: 2, dtype: object

  name dept  years  salary
0  Ana  eng      6  118000
1   Bo  eng      2   94000

118000`,
    why: '<b>Positions</b>, and ordinary Python slicing rules. After a filter or a sort your labels and positions no longer agree — that is exactly when picking the wrong one gives a plausible wrong row.' },
  { label: 'chained =', code:
`# the bug
df[df.dept == "eng"]["salary"] = 0
# SettingWithCopyWarning — and it may
# have changed nothing at all

# the fix: one indexer, one call
df.loc[df.dept == "eng", "salary"] = 0`,
    out:
`SettingWithCopyWarning:
A value is trying to be set on a copy of
a slice from a DataFrame

# after the fix:
  name   dept  years  salary
0  Ana    eng      6       0
1   Bo    eng      2       0`,
    why: 'Two bracket calls means pandas may hand the second one a <b>copy</b>, so the write lands nowhere. The rule that removes the whole class of bug: <b>one</b> <span class="mono">.loc[rows, cols]</span> call, never bracket-then-bracket.' },
  { label: 'query', code:
`df.query("dept == 'eng' and years > 3")
df.query("salary > @cutoff")   # @ = a Python name
df[(df.dept == "eng") & (df.years > 3)]  # same thing`,
    out:
`  name dept  years  salary
0  Ana  eng      6  118000

  name   dept  years  salary
0  Ana    eng      6  118000
2  Cai  sales      9  102000`,
    why: 'Readable for long filters, and it avoids the parenthesis maze around <span class="mono">&amp;</span>. It parses a string, so typos are runtime errors, not editor errors — fine interactively, worth avoiding in library code.' }
];

const PD_MISSING = [
  { label: 'find', code:
`s = pd.Series([1.0, None, 3.0, None, 5.0])
s.isna()
s.isna().sum()
df.isna().sum()      # per column — run this first`,
    out:
`0    False
1     True
2    False
3     True
4    False
dtype: bool

2`,
    why: 'Always start here. <span class="mono">df.isna().sum()</span> is the first line of every real analysis, before you believe any mean.' },
  { label: 'drop', code:
`s.dropna()
df.dropna()                  # any NaN in the row
df.dropna(subset=["salary"]) # only that column
df.dropna(thresh=3)          # keep rows with 3+ values`,
    out:
`0    1.0
2    3.0
4    5.0
dtype: float64`,
    why: 'Default <span class="mono">dropna()</span> on a wide frame can delete most of your data because of one sparse column. Name the columns you actually require.' },
  { label: 'fill', code:
`s.fillna(0)
s.fillna(s.mean())
s.ffill()          # carry the last value forward
df["dept"] = df["dept"].fillna("unknown")`,
    out:
`0    1.0
1    0.0
2    3.0
3    0.0
4    5.0
dtype: float64

0    1.0
1    3.0
2    3.0
3    3.0
4    5.0
dtype: float64   # mean of 1,3,5`,
    why: 'Filling with the mean shrinks the variance and quietly flatters every model you fit afterwards. If you do it, do it <b>inside</b> a scikit-learn pipeline so the value is learned from the training fold only.' },
  { label: 'NaN rules', code:
`np.nan == np.nan     # False
s.sum()              # skips NaN by default
s.sum(skipna=False)  # NaN
len(s), s.count()    # 5, 3
pd.NA, None, np.nan  # three flavours`,
    out:
`False
9.0
nan
(5, 3)`,
    why: '<span class="mono">len</span> counts rows, <span class="mono">count</span> counts non-null. A mean that looks fine can be computed over a third of your rows — which is why the first tab exists.' }
];

const PD_PERF = [
  { t: 'iterrows()', tag: 'slowest', code:
`for i, row in df.iterrows():        # slow
    df.loc[i, "band"] = f(row)

df["band"] = df["salary"].map(f)    # fast
df["band"] = np.where(df.salary > 1e5, "hi", "lo")`,
    d: '<span class="mono">iterrows</span> builds a Series per row and throws it away. Vectorise, or at worst <span class="mono">.map</span>/<span class="mono">.apply</span> — and reach for <span class="mono">np.where</span> for two-way splits.' },
  { t: 'object dtype', tag: 'memory', code:
`df.dept.memory_usage(deep=True)   # 578
df["dept"] = df.dept.astype("category")
df.dept.memory_usage(deep=True)   # 429`,
    d: 'A text column is a column of Python string objects. <span class="mono">category</span> stores small integer codes plus one dictionary of values — a large win once the column repeats itself, which department names always do.' },
  { t: 'growing a frame', tag: 'quadratic', code:
`for chunk in chunks:                 # copies every time
    df = pd.concat([df, chunk])

df = pd.concat(list_of_chunks)       # once, at the end`,
    d: 'Every <span class="mono">concat</span> allocates a whole new frame. Collect the pieces in a list and concatenate once — the same rule as building a string with <span class="mono">+=</span> in a loop.' },
  { t: 'read_csv dtypes', tag: 'load time', code:
`pd.read_csv("f.csv",
    usecols=["id", "dept", "salary"],
    dtype={"dept": "category"},
    parse_dates=["hired"])`,
    d: 'Reading three columns instead of forty is the cheapest optimisation in pandas. Declaring dtypes also stops the inference pass turning an id column into a float because one row was blank.' },
  { t: 'copy on write', tag: 'pandas 3.0', code:
`pd.options.mode.copy_on_write = True   # 2.x opt-in
# in 3.0 this is the default and
# chained assignment simply never writes`,
    d: 'Copy-on-write makes the copy-vs-view question disappear: every result behaves like a copy, and the <span class="mono">SettingWithCopyWarning</span> era ends. Turn it on now and find the code that depended on the old behaviour.' },
  { t: 'inplace=True', tag: 'myth', code:
`df.drop(columns=["x"], inplace=True)  # no faster
df = df.drop(columns=["x"])           # clearer`,
    d: 'It rarely avoids a copy, it breaks method chaining, and it returns <span class="mono">None</span> — which is how <span class="mono">df = df.sort_values(..., inplace=True)</span> silently destroys a frame.' }
];

/* ---------- Matplotlib ---------- */
const MPL_PARTS = {
  fig:    { t: 'Figure', d: 'The whole canvas — the window, the page, the PNG. It owns the Axes, the size and the DPI. One figure can hold many plots.', code: 'fig = plt.figure(figsize=(6, 4), dpi=150)\nfig, ax = plt.subplots()          # usual form\nfig.suptitle("all of it")\nfig.tight_layout()' },
  axes:   { t: 'Axes', d: 'One plot. This is the object you spend your life with — <span class="mono">ax.plot</span>, <span class="mono">ax.set_xlabel</span>, <span class="mono">ax.legend</span>. Confusingly named: an Axes is a plot, an Axis is one direction of it.', code: 'fig, ax = plt.subplots()\nax.plot(x, y)\nax.set_title("one plot")\nfig, axs = plt.subplots(2, 2)     # axs is an array' },
  xaxis:  { t: 'Axis (x)', d: 'One direction: its limits, its scale, its ticks and their formatting. Two of these live inside every Axes.', code: 'ax.set_xlim(0, 10)\nax.set_xscale("log")\nax.set_xticks([0, 5, 10])\nax.set_xticklabels(["a", "b", "c"])' },
  tick:   { t: 'Ticks', d: 'The marks and the numbers beside them. Locators decide where they go, formatters decide how they read.', code: 'ax.tick_params(axis="x", rotation=45)\nax.xaxis.set_major_locator(MultipleLocator(5))\nax.xaxis.set_major_formatter("{x:.0f}%")' },
  spine:  { t: 'Spines', d: 'The four border lines. Removing the top and right is the single fastest way to make a default Matplotlib chart look deliberate.', code: 'ax.spines[["top", "right"]].set_visible(False)\nax.spines["left"].set_color("#888")' },
  line:   { t: 'Artist (the line)', d: 'Everything drawn is an Artist — lines, bars, text, the legend. <span class="mono">plot</span> returns a list of them, which is why you see that trailing comma.', code: 'line, = ax.plot(x, y, lw=2, ls="--", color="C0")\nline.set_ydata(new_y)   # update in place' },
  legend: { t: 'Legend', d: 'Built from the <span class="mono">label=</span> you passed when drawing. No labels, no legend — and Matplotlib will warn you rather than invent names.', code: 'ax.plot(x, y1, label="train")\nax.plot(x, y2, label="test")\nax.legend(loc="upper left", frameon=False)' },
  title:  { t: 'Title & labels', d: 'Axes-level text. <span class="mono">ax.set_title</span> is one plot; <span class="mono">fig.suptitle</span> is the whole figure — mixing them up is why a title sometimes lands over the wrong subplot.', code: 'ax.set_title("Revenue by quarter")\nax.set_xlabel("quarter")\nax.set_ylabel("revenue (M)")\nax.set(xlabel="q", ylabel="rev")   # all at once' }
};

const MPL_TRAPS = [
  { t: 'plt.show() blocks', tag: 'scripts', code:
`plt.show()          # blocks until you close it
fig.savefig("a.png") # after show(), the figure is
                     # often already cleared`,
    d: 'Save first, then show. In a script <span class="mono">show()</span> halts execution; in a notebook it is unnecessary. Save before you display and the ordering never bites.' },
  { t: 'figures leak', tag: 'loops', code:
`for name in files:
    fig, ax = plt.subplots()
    ...
    fig.savefig(name)
    plt.close(fig)      # <- the line people forget`,
    d: 'Matplotlib keeps every figure alive until you close it. Twenty is a warning; two thousand is your notebook kernel dying.' },
  { t: 'the pyplot state machine', tag: 'plt vs ax', code:
`plt.plot(x, y); plt.title("t")   # "current" figure
fig, ax = plt.subplots()          # explicit objects
ax.plot(x, y); ax.set_title("t")`,
    d: '<span class="mono">plt.</span> functions act on whatever figure is current — fine for one throwaway chart, a source of mystery once there are two. Use <span class="mono">fig, ax</span> in anything you will run twice.' },
  { t: 'savefig cuts labels', tag: 'layout', code:
`fig.savefig("a.png", bbox_inches="tight", dpi=200)
fig.tight_layout()      # or constrained_layout=True`,
    d: 'The saved image uses the figure box, not the ink. Rotated tick labels fall outside it — <span class="mono">bbox_inches="tight"</span> is the one-word fix.' },
  { t: 'imshow flips your image', tag: 'origin', code:
`ax.imshow(arr)                  # row 0 at the TOP
ax.imshow(arr, origin="lower")  # row 0 at the bottom`,
    d: 'Images count rows downward, plots count y upward. When a heatmap looks mirrored, this is why.' },
  { t: 'no backend', tag: 'servers', code:
`import matplotlib
matplotlib.use("Agg")     # BEFORE pyplot is imported
import matplotlib.pyplot as plt`,
    d: 'On a headless box the default interactive backend fails to open a window. <span class="mono">Agg</span> renders straight to a file and needs no display.' }
];

/* ---------- seaborn ---------- */
const SNS_LEVEL = [
  { k: 'axes', t: 'Axes-level', fns: 'scatterplot · lineplot · barplot · boxplot · histplot · heatmap · countplot',
    ret: 'returns a matplotlib <b>Axes</b>',
    code: `fig, ax = plt.subplots(figsize=(6, 4))
sns.scatterplot(data=df, x="years", y="salary",
                hue="dept", ax=ax)
ax.set_title("pay vs experience")
ax.spines[["top", "right"]].set_visible(False)`,
    d: 'Draws into an Axes you own — so you keep every Matplotlib control you already know, and it composes into subplots. <b>Take this one by default.</b>' },
  { k: 'figure', t: 'Figure-level', fns: 'relplot · displot · catplot · lmplot · jointplot · pairplot',
    ret: 'returns a seaborn <b>FacetGrid</b> (it owns the whole figure)',
    code: `g = sns.relplot(data=df, x="years", y="salary",
                hue="dept", col="dept", kind="scatter",
                height=3.5, aspect=1.1)
g.set_axis_labels("years", "salary")
g.figure.suptitle("one panel per dept", y=1.02)`,
    d: 'Makes its own figure and can split it into a grid with <span class="mono">col=</span>/<span class="mono">row=</span>. It cannot be drawn into an existing Axes — there is no <span class="mono">ax=</span> argument, which is the error message that sends everyone to Stack Overflow.' }
];

const SNS_PICK = [
  { q: 'One numeric column. What is its shape?', a: 'sns.histplot(data=df, x="salary", bins=20, kde=True)', w: 'Distribution of one variable. <span class="mono">kdeplot</span> for a smooth version, <span class="mono">ecdfplot</span> when you want to read off percentiles without choosing bins.' },
  { q: 'One categorical column. How many of each?', a: 'sns.countplot(data=df, x="dept")', w: 'Counting rows per category. If you already have the counts in a column, that is <span class="mono">barplot</span>, not <span class="mono">countplot</span>.' },
  { q: 'Numeric split by category.', a: 'sns.boxplot(data=df, x="dept", y="salary")', w: 'Box for the five-number summary, <span class="mono">violinplot</span> to see the shape, <span class="mono">stripplot</span>/<span class="mono">swarmplot</span> over the top when there are few points and you want to show them all.' },
  { q: 'Two numeric columns.', a: 'sns.scatterplot(data=df, x="years", y="salary", hue="dept")', w: 'Relationship. Add <span class="mono">sns.regplot</span> or <span class="mono">lmplot</span> for a fitted line with a confidence band — and remember the band is about the fit, not about your data.' },
  { q: 'Something over time.', a: 'sns.lineplot(data=df, x="month", y="revenue", hue="region")', w: '<span class="mono">lineplot</span> aggregates repeats at the same x and draws a 95% interval by default — pass <span class="mono">errorbar=None</span> when you just want the raw line.' },
  { q: 'Every numeric column against every other.', a: 'sns.pairplot(df, hue="dept", corner=True)', w: 'The fastest first look at a new dataset. <span class="mono">corner=True</span> drops the mirrored half. Expensive above ~10 columns — slice first.' },
  { q: 'A correlation matrix.', a: 'sns.heatmap(df.corr(numeric_only=True), annot=True,\n            cmap="vlag", center=0, vmin=-1, vmax=1)', w: 'Use a <b>diverging</b> map centred on zero, because correlation has a meaningful middle. A sequential map here makes -0.9 and 0.1 look equally unremarkable.' },
  { q: 'The same plot, once per group.', a: 'sns.relplot(data=df, x="years", y="salary",\n            col="dept", col_wrap=3, kind="scatter")', w: 'Faceting — the reason figure-level functions exist. Small multiples beat one crowded chart with eight colours, every time.' }
];

/* ---------- SciPy ---------- */
const SP_MODULES = [
  { t: 'stats', tag: 'most used', code: 'from scipy import stats\nstats.ttest_ind(a, b)\nstats.pearsonr(x, y)\nstats.norm.ppf(0.975)   # 1.959963...', d: 'Distributions, hypothesis tests, correlation, descriptive statistics. Every distribution object answers to the same four methods: <span class="mono">pdf</span>, <span class="mono">cdf</span>, <span class="mono">ppf</span>, <span class="mono">rvs</span>.' },
  { t: 'optimize', tag: 'fitting', code: 'from scipy.optimize import curve_fit, minimize\npopt, pcov = curve_fit(f, x, y)\nminimize(loss, x0, method="L-BFGS-B")', d: 'Curve fitting, root finding, minimisation. <span class="mono">curve_fit</span> also hands back a covariance matrix — the square roots of its diagonal are the standard errors of your parameters.' },
  { t: 'interpolate', tag: 'between points', code: 'from scipy.interpolate import interp1d, CubicSpline\nf = CubicSpline(x, y)\nf(2.5)', d: 'Values between the samples you have. Interpolation passes through your points; a regression does not — do not confuse the two when someone asks for a trend.' },
  { t: 'signal', tag: 'time series', code: 'from scipy import signal\nb, a = signal.butter(3, 0.1)\nsignal.filtfilt(b, a, y)\nsignal.find_peaks(y, height=2)', d: 'Filtering, convolution, spectra, peak finding. <span class="mono">filtfilt</span> runs the filter forwards and backwards so it introduces no phase shift.' },
  { t: 'sparse', tag: 'big + empty', code: 'from scipy.sparse import csr_matrix\nM = csr_matrix(dense)\nM.nnz, M.shape', d: 'Matrices that are mostly zero — a term-document matrix, a graph. CSR stores only the non-zeros, which is the difference between 8 GB and 40 MB. scikit-learn accepts them directly.' },
  { t: 'spatial', tag: 'distances', code: 'from scipy.spatial import distance, cKDTree\ndistance.cdist(A, B, "cosine")\ncKDTree(pts).query(p, k=5)', d: 'Distance matrices, nearest neighbours, convex hulls, Voronoi. A KD-tree turns "find the closest five" from a full scan into a logarithmic lookup.' },
  { t: 'integrate', tag: 'calculus', code: 'from scipy.integrate import quad, solve_ivp\nquad(lambda x: x**2, 0, 1)   # (0.333..., 3.7e-15)\nsolve_ivp(dydt, (0, 10), [y0])', d: 'Numerical integration and ODE solving. <span class="mono">quad</span> returns the value <b>and</b> an error estimate — check the second number before you trust the first.' },
  { t: 'linalg', tag: 'more than numpy', code: 'from scipy import linalg\nlinalg.solve(A, b)\nlinalg.eig(A)\nlinalg.svd(A)', d: 'A superset of <span class="mono">numpy.linalg</span>: more decompositions, matrix functions, and it always links a compiled LAPACK. Prefer <span class="mono">solve</span> over inverting a matrix — faster, and numerically better behaved.' }
];

/* ============================================================
   NumPy widgets
   ============================================================ */
function initNpOps() { opTabs('#np-tabs', '#np-body', NP_OPS); }
function initNpTraps() { cards('#np-traps', NP_TRAPS); }

const SHAPES = ['(3,)', '(4,)', '(1,)', '(3,1)', '(1,4)', '(3,4)', '(4,3)', '(2,3,4)'];
const parseShape = s => s.replace(/[()]/g, '').split(',').filter(x => x.trim() !== '').map(Number);
const showShape = a => '(' + a.join(', ') + (a.length === 1 ? ',' : '') + ')';

function broadcast(a, b) {
  const n = Math.max(a.length, b.length), out = [], rows = [];
  for (let i = 0; i < n; i++) {
    const ia = a.length - n + i, ib = b.length - n + i;
    const da = ia >= 0 ? a[ia] : null, db = ib >= 0 ? b[ib] : null;
    const va = da == null ? 1 : da, vb = db == null ? 1 : db;
    const ok = va === vb || va === 1 || vb === 1;
    rows.push({ da, db, res: ok ? Math.max(va, vb) : null, ok, stretched: ok && va !== vb });
    if (!ok) return { ok: false, rows, err: 'ValueError: operands could not be broadcast together with shapes ' + showShape(a) + ' ' + showShape(b) };
    out.push(Math.max(va, vb));
  }
  return { ok: true, rows, shape: out };
}

function initBroadcast() {
  const root = $('#np-bcast'); if (!root) return;
  const opts = SHAPES.map(s => '<option>' + s + '</option>').join('');
  root.innerHTML =
    '<div class="btn-row" style="align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="mono dim">a.shape</span><select id="bc-a" class="chip mono">' + opts + '</select>' +
      '<span class="mono">+</span>' +
      '<span class="mono dim">b.shape</span><select id="bc-b" class="chip mono">' + opts + '</select>' +
    '</div><div id="bc-out"></div>';
  $('#bc-a', root).value = '(3, 1)'; $('#bc-b', root).value = '(1, 4)';
  const draw = () => {
    const a = parseShape($('#bc-a', root).value), b = parseShape($('#bc-b', root).value);
    const r = broadcast(a, b);
    const cell = (v, cls) => '<td class="mono" style="padding:6px 12px;text-align:center' +
      (cls === 'pad' ? ';color:#5b6b85' : cls === 'stretch' ? ';color:#f0b429' : cls === 'bad' ? ';color:#f87171' : '') + '">' +
      (v == null ? '—' : v) + '</td>';
    let tbl = '<table class="tbl" style="margin:12px 0"><tr><th></th>' +
      r.rows.map((_, i) => '<th class="mono">axis ' + i + '</th>').join('') + '</tr>' +
      '<tr><td class="mono dim">a</td>' + r.rows.map(x => cell(x.da, x.da == null ? 'pad' : '')).join('') + '</tr>' +
      '<tr><td class="mono dim">b</td>' + r.rows.map(x => cell(x.db, x.db == null ? 'pad' : '')).join('') + '</tr>' +
      '<tr><td class="mono dim">→</td>' + r.rows.map(x => cell(x.res, x.ok ? (x.stretched ? 'stretch' : '') : 'bad')).join('') + '</tr></table>';
    $('#bc-out', root).innerHTML = tbl +
      (r.ok
        ? '<pre class="code">a + b   # ' + showShape(r.shape) + '</pre>' +
          '<div class="stepper-say">Right-aligned, then compared axis by axis. ' +
          (r.rows.some(x => x.stretched)
            ? 'The <span style="color:#f0b429">amber</span> axes were length 1 and got stretched — <b>no data was copied</b>, NumPy just reads the same element repeatedly.'
            : 'Every axis already matched, so nothing had to stretch.') + '</div>'
        : '<pre class="code">' + esc(r.err) + '</pre>' +
          '<div class="stepper-say">Two axes disagreed and neither was 1, so there is no honest way to line them up. The fix is almost always <span class="mono">a[:, None]</span> — insert a length-1 axis where you meant "repeat along here".</div>');
    xp(1);
  };
  $('#bc-a', root).onchange = draw; $('#bc-b', root).onchange = draw;
  draw();
}

const AXM = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];
function initAxis() {
  const root = $('#np-axis'); if (!root) return;
  root.innerHTML =
    '<div class="btn-row"><button class="btn" data-ax="none">a.sum()</button>' +
      '<button class="btn btn-ghost" data-ax="0">a.sum(axis=0)</button>' +
      '<button class="btn btn-ghost" data-ax="1">a.sum(axis=1)</button></div>' +
    '<div id="ax-grid" style="margin:14px 0"></div><div id="ax-say"></div>';
  const draw = mode => {
    let g = '<table class="tbl" style="width:auto;margin:0 auto">';
    for (let r = 0; r < 3; r++) {
      g += '<tr>';
      for (let c = 0; c < 4; c++) {
        const col = mode === '0' ? ['#38bdf8', '#a78bfa', '#34d399', '#f0b429'][c]
                  : mode === '1' ? ['#38bdf8', '#a78bfa', '#34d399'][r]
                  : '#38bdf8';
        g += '<td class="mono" style="padding:8px 14px;text-align:right;color:' + col + '">' + AXM[r][c] + '</td>';
      }
      if (mode === '1') g += '<td class="mono" style="padding:8px 14px;color:' + ['#38bdf8', '#a78bfa', '#34d399'][r] + '">→ ' + AXM[r].reduce((a, b) => a + b, 0) + '</td>';
      g += '</tr>';
    }
    if (mode === '0') {
      g += '<tr>';
      for (let c = 0; c < 4; c++) g += '<td class="mono" style="padding:8px 14px;text-align:right;color:' + ['#38bdf8', '#a78bfa', '#34d399', '#f0b429'][c] + '">↓ ' + AXM.reduce((s, r) => s + r[c], 0) + '</td>';
      g += '</tr>';
    }
    g += '</table>';
    $('#ax-grid', root).innerHTML = g;
    const res = mode === 'none' ? '78'
      : mode === '0' ? 'array([15, 18, 21, 24])'
      : 'array([10, 26, 42])';
    const shape = mode === 'none' ? '() — a scalar' : mode === '0' ? '(4,)' : '(3,)';
    $('#ax-say', root).innerHTML =
      '<pre class="code">a.shape          # (3, 4)\n' +
      (mode === 'none' ? 'a.sum()' : 'a.sum(axis=' + mode + ')') + '\n# ' + res + '\n# shape ' + shape + '</pre>' +
      '<div class="stepper-say">' + (mode === 'none'
        ? 'No axis: every element collapses into one number.'
        : mode === '0'
          ? '<b>axis=0 is the axis that disappears.</b> It runs <i>down</i> the rows, so a (3, 4) becomes a (4,) — one value per column. Say it as "collapse the rows", not "sum the rows".'
          : 'axis=1 collapses the columns, leaving one value per row: (3, 4) → (3,). Pass <span class="mono">keepdims=True</span> to keep it as (3, 1) so it still broadcasts against the original.') + '</div>';
    xp(1);
  };
  $$('[data-ax]', root).forEach(b => b.onclick = () => {
    $$('[data-ax]', root).forEach(x => x.className = 'btn btn-ghost');
    b.className = 'btn';
    draw(b.dataset.ax);
  });
  draw('none');
}

function initViewCopy() {
  const root = $('#np-view'); if (!root) return;
  root.innerHTML =
    '<div class="btn-row"><button class="btn" id="vc-slice">b = a[2:5] &nbsp;then&nbsp; b[0] = 99</button>' +
      '<button class="btn" id="vc-fancy">b = a[[2,3,4]] &nbsp;then&nbsp; b[0] = 99</button>' +
      '<button class="btn btn-ghost" id="vc-reset">reset</button></div>' +
    '<div id="vc-view" style="margin-top:14px"></div>';
  const base = [10, 11, 12, 13, 14, 15, 16, 17];
  let a = base.slice(), b = null, changed = -1, kind = null;
  const boxes = (arr, hi) => '<div class="btn-row" style="gap:6px;justify-content:center">' +
    arr.map((v, i) => '<div class="mono" style="min-width:44px;text-align:center;padding:8px 6px;border-radius:8px;border:1px solid ' +
      (i === hi ? '#f0b429' : '#22304a') + ';background:' + (i === hi ? '#2a1e05' : '#0e1421') + '">' + v + '</div>').join('') + '</div>';
  const draw = () => {
    $('#vc-view', root).innerHTML =
      '<div class="lab-pane-title">a</div>' + boxes(a, kind === 'slice' ? changed : -1) +
      (b ? '<div class="lab-pane-title" style="margin-top:12px">b</div>' + boxes(b, 0) : '') +
      '<pre class="code" style="margin-top:12px">' +
        (kind === 'slice'
          ? 'b = a[2:5]\nb.base is a      # True  -> b is a VIEW\nb[0] = 99\na                # array([10, 11, 99, 13, 14, 15, 16, 17])'
          : kind === 'fancy'
            ? 'b = a[[2, 3, 4]]\nb.base is None   # True  -> b is a COPY\nb[0] = 99\na                # unchanged'
            : 'a = np.arange(10, 18)') + '</pre>' +
      (kind ? '<div class="stepper-say">' + (kind === 'slice'
        ? 'A basic slice hands back a <b>window onto the same buffer</b>. Writing through it reaches the original — which is a feature when you want it and a two-hour bug when you do not. <span class="mono">.copy()</span> if the result must be independent.'
        : 'Fancy indexing (a list of positions) and boolean masks cannot be expressed as a stride, so NumPy has to build a new array. The write lands in <span class="mono">b</span> and nowhere else.') + '</div>' : '');
  };
  $('#vc-slice', root).onclick = () => { a = base.slice(); kind = 'slice'; a[2] = 99; b = [99, a[3], a[4]]; changed = 2; draw(); xp(2); };
  $('#vc-fancy', root).onclick = () => { a = base.slice(); kind = 'fancy'; b = [99, base[3], base[4]]; changed = -1; draw(); xp(2); };
  $('#vc-reset', root).onclick = () => { a = base.slice(); b = null; kind = null; changed = -1; draw(); };
  draw();
}

/* ============================================================
   pandas widgets
   ============================================================ */
function initPdIndex()   { opTabs('#pd-ix-tabs', '#pd-ix-body', PD_INDEX); }
function initPdMissing() { opTabs('#pd-na-tabs', '#pd-na-body', PD_MISSING); }
function initPdPerf()    { cards('#pd-perf', PD_PERF); }

const DEPT_COL = { eng: '#38bdf8', sales: '#a78bfa', ops: '#34d399' };
function staffTable(rows, colourBy, note) {
  let h = '<table class="tbl"><tr><th></th><th>name</th><th>dept</th><th>years</th><th>salary</th></tr>';
  rows.forEach((r, i) => {
    const c = colourBy ? DEPT_COL[r.dept] : null;
    h += '<tr style="' + (c ? 'background:' + c + '18' : '') + '">' +
      '<td class="mono dim">' + i + '</td><td>' + r.name + '</td>' +
      '<td class="mono" style="color:' + (c || INK) + '">' + r.dept + '</td>' +
      '<td class="mono">' + r.years + '</td><td class="mono">' + r.salary.toLocaleString('en-US') + '</td></tr>';
  });
  return h + '</table>' + (note ? '<div class="dim" style="font-size:12.5px;margin-top:6px">' + note + '</div>' : '');
}

function initGroupby() {
  const root = $('#pd-groupby'); if (!root) return;
  root.innerHTML =
    '<div class="rag-pipe" id="gb-strip"></div>' +
    '<div id="gb-body" style="margin-top:12px"></div>' +
    '<div class="btn-row"><button class="btn" id="gb-play">▶ Run</button>' +
      '<button class="btn btn-ghost" id="gb-prev">&larr; prev</button>' +
      '<button class="btn btn-ghost" id="gb-next">next &rarr;</button></div>' +
    '<div class="stepper-say" id="gb-say"></div>';
  const groups = {};
  STAFF.forEach(r => (groups[r.dept] = groups[r.dept] || []).push(r));
  const agg = Object.entries(groups).map(([d, rows]) => ({ dept: d, n: rows.length, mean: mean(rows.map(r => r.salary)) }));

  const STEPS = [
    { n: 'the frame', small: 'df', body: () => staffTable(STAFF, false),
      say: 'Five rows, one table. Nothing has happened yet — <span class="mono">df.groupby("dept")</span> on its own is lazy and returns a GroupBy object, not data.' },
    { n: 'split', small: 'by dept', body: () => staffTable(STAFF, true, 'the same rows, tagged by key — no copy yet'),
      say: '<b>Split.</b> pandas works out which rows belong to which key. <span class="mono">df.groupby("dept").groups</span> shows exactly this mapping.' },
    { n: 'apply', small: 'mean()', body: () => Object.entries(groups).map(([d, rows]) =>
        '<div style="margin-bottom:10px"><div class="lab-pane-title" style="color:' + DEPT_COL[d] + '">' + d + '</div>' +
        '<pre class="code">mean(' + rows.map(r => r.salary).join(', ') + ') = ' + fmt(mean(rows.map(r => r.salary)), 1) + '</pre></div>').join(''),
      say: '<b>Apply.</b> The aggregation runs once per group, independently. Any function that turns a Series into one number works here — including your own, via <span class="mono">.agg(fn)</span>.' },
    { n: 'combine', small: 'one frame', body: () =>
        '<table class="tbl"><tr><th>dept</th><th>salary (mean)</th><th>count</th></tr>' +
        agg.map(a => '<tr><td class="mono" style="color:' + DEPT_COL[a.dept] + '">' + a.dept + '</td>' +
          '<td class="mono">' + fmt(a.mean, 1) + '</td><td class="mono">' + a.n + '</td></tr>').join('') + '</table>' +
        '<pre class="code">df.groupby("dept")["salary"].mean()\n\n' +
        'dept\n' + agg.map(a => a.dept.padEnd(8) + fmt(a.mean, 1)).join('\n') + '\nName: salary, dtype: float64</pre>',
      say: '<b>Combine.</b> The group keys become the <b>index</b> of the result — which is why the next thing you write is so often <span class="mono">.reset_index()</span>. Want several aggregations at once? <span class="mono">.agg({"salary": ["mean", "max"], "years": "median"})</span>.' }
  ];
  const strip = $('#gb-strip', root);
  STEPS.forEach((s, i) => {
    const d = el('div', 'rp', '<b>' + s.n + '</b><small>' + s.small + '</small>');
    d.onclick = () => go(i);
    strip.appendChild(d);
  });
  let at = 0, timer = null;
  function go(i) {
    at = Math.max(0, Math.min(STEPS.length - 1, i));
    $$('.rp', strip).forEach((d, di) => { d.classList.toggle('lit', di === at); d.classList.toggle('done', di < at); });
    $('#gb-body', root).innerHTML = STEPS[at].body();
    $('#gb-say', root).innerHTML = STEPS[at].say;
    xp(1);
  }
  $('#gb-play', root).onclick = () => {
    if (timer) { clearInterval(timer); timer = null; $('#gb-play', root).textContent = '▶ Run'; return; }
    if (at >= STEPS.length - 1) go(0);
    $('#gb-play', root).textContent = '❚❚ Pause';
    timer = setInterval(() => {
      if (at >= STEPS.length - 1) { clearInterval(timer); timer = null; $('#gb-play', root).textContent = '▶ Run'; }
      else go(at + 1);
    }, 1900);
  };
  $('#gb-next', root).onclick = () => go(at + 1);
  $('#gb-prev', root).onclick = () => go(at - 1);
  go(0);
}

function initMerge() {
  const root = $('#pd-merge'); if (!root) return;
  root.innerHTML =
    '<div class="chip-row" id="mg-tabs"></div>' +
    '<div class="two-up" style="margin-top:10px"><div id="mg-src"></div><div id="mg-res"></div></div>' +
    '<div class="stepper-say" id="mg-say"></div>';
  const HOWS = [
    { k: 'inner', d: 'Keys present in <b>both</b>. The default, and the one that silently loses rows — always compare <span class="mono">len(df)</span> before and after.' },
    { k: 'left',  d: 'Every left row survives; missing right values become <span class="mono">NaN</span>. This is the lookup join you want 90% of the time.' },
    { k: 'right', d: 'The mirror of left. Rare in practice — swapping the operands and using <span class="mono">left</span> reads better.' },
    { k: 'outer', d: 'Everything from both sides, padded with <span class="mono">NaN</span>. Use it to <b>find</b> the mismatches: add <span class="mono">indicator=True</span> and inspect the <span class="mono">_merge</span> column.' }
  ];
  const src =
    '<div class="lab-pane-title">left</div><table class="tbl"><tr><th>id</th><th>name</th></tr>' +
    LEFT_T.map(r => '<tr><td class="mono">' + r.id + '</td><td>' + r.name + '</td></tr>').join('') + '</table>' +
    '<div class="lab-pane-title" style="margin-top:12px">right</div><table class="tbl"><tr><th>id</th><th>city</th></tr>' +
    RIGHT_T.map(r => '<tr><td class="mono">' + r.id + '</td><td>' + r.city + '</td></tr>').join('') + '</table>';
  function join(how) {
    const ids = how === 'inner' ? LEFT_T.filter(l => RIGHT_T.some(r => r.id === l.id)).map(l => l.id)
      : how === 'left' ? LEFT_T.map(l => l.id)
      : how === 'right' ? RIGHT_T.map(r => r.id)
      : [...new Set([...LEFT_T.map(l => l.id), ...RIGHT_T.map(r => r.id)])].sort((a, b) => a - b);
    return ids.map(id => ({
      id,
      name: (LEFT_T.find(l => l.id === id) || {}).name,
      city: (RIGHT_T.find(r => r.id === id) || {}).city
    }));
  }
  function show(h) {
    const rows = join(h.k);
    const cell = v => v == null ? '<span class="mono" style="color:#f0b429">NaN</span>' : v;
    $('#mg-res', root).innerHTML =
      '<div class="lab-pane-title">pd.merge(left, right, on="id", how="' + h.k + '")</div>' +
      '<table class="tbl"><tr><th>id</th><th>name</th><th>city</th></tr>' +
      rows.map(r => '<tr><td class="mono">' + r.id + '</td><td>' + cell(r.name) + '</td><td>' + cell(r.city) + '</td></tr>').join('') +
      '</table><div class="dim" style="font-size:12.5px;margin-top:6px">3 + 3 rows in → <b>' + rows.length + '</b> rows out</div>';
    $('#mg-say', root).innerHTML = h.d +
      '<br><br><b>The check that saves you:</b> <span class="mono">pd.merge(..., validate="one_to_one")</span> raises if the key is not unique on both sides. Duplicate keys silently multiply rows, and a join that turns 10,000 rows into 47,000 is the most common way a pandas analysis goes quietly wrong.';
    xp(1);
  }
  const tabs = $('#mg-tabs', root);
  HOWS.forEach((h, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), 'how="' + h.k + '"');
    b.onclick = () => { $$('.chip', tabs).forEach(x => x.classList.remove('active')); b.classList.add('active'); show(h); };
    tabs.appendChild(b);
  });
  $('#mg-src', root).innerHTML = src;
  show(HOWS[0]);
}

function initReshape() {
  const root = $('#pd-reshape'); if (!root) return;
  const WIDE = [{ name: 'Ana', q1: 12, q2: 15, q3: 11 }, { name: 'Bo', q1: 9, q2: 7, q3: 14 }];
  const LONG = [];
  WIDE.forEach(r => ['q1', 'q2', 'q3'].forEach(q => LONG.push({ name: r.name, quarter: q, sales: r[q] })));
  root.innerHTML =
    '<div class="btn-row"><button class="btn" id="rs-melt">wide → long &nbsp;(melt)</button>' +
      '<button class="btn btn-ghost" id="rs-pivot">long → wide &nbsp;(pivot)</button></div>' +
    '<div class="two-up" style="margin-top:12px"><div id="rs-a"></div><div id="rs-b"></div></div>' +
    '<div class="stepper-say" id="rs-say"></div>';
  const wideT = '<div class="lab-pane-title">wide — one column per quarter</div><table class="tbl">' +
    '<tr><th>name</th><th>q1</th><th>q2</th><th>q3</th></tr>' +
    WIDE.map(r => '<tr><td>' + r.name + '</td><td class="mono">' + r.q1 + '</td><td class="mono">' + r.q2 + '</td><td class="mono">' + r.q3 + '</td></tr>').join('') + '</table>';
  const longT = '<div class="lab-pane-title">long / tidy — one row per observation</div><table class="tbl">' +
    '<tr><th>name</th><th>quarter</th><th>sales</th></tr>' +
    LONG.map(r => '<tr><td>' + r.name + '</td><td class="mono">' + r.quarter + '</td><td class="mono">' + r.sales + '</td></tr>').join('') + '</table>';
  function draw(dir) {
    $('#rs-a', root).innerHTML = dir === 'melt' ? wideT : longT;
    $('#rs-b', root).innerHTML = (dir === 'melt' ? longT : wideT) +
      '<pre class="code">' + esc(dir === 'melt'
        ? 'long = df.melt(id_vars="name",\n               var_name="quarter",\n               value_name="sales")'
        : 'wide = long.pivot(index="name",\n                  columns="quarter",\n                  values="sales").reset_index()') + '</pre>';
    $('#rs-say', root).innerHTML = dir === 'melt'
      ? '<b>Long is what plotting libraries want.</b> seaborn takes column <i>names</i> as arguments — <span class="mono">x="quarter", y="sales", hue="name"</span> — which is only possible if quarter is a column of values rather than three separate columns. Every "how do I plot these three columns" question is really this reshape.'
      : '<b>Wide is what people want to read.</b> Pivot at the very end, for display. <span class="mono">pivot</span> fails on duplicate index/column pairs; <span class="mono">pivot_table</span> aggregates them instead — if <span class="mono">pivot</span> raises, that is your data telling you the key is not unique.';
    xp(1);
  }
  $('#rs-melt', root).onclick = () => { $('#rs-melt', root).className = 'btn'; $('#rs-pivot', root).className = 'btn btn-ghost'; draw('melt'); };
  $('#rs-pivot', root).onclick = () => { $('#rs-pivot', root).className = 'btn'; $('#rs-melt', root).className = 'btn btn-ghost'; draw('pivot'); };
  draw('melt');
}

/* ============================================================
   Matplotlib widgets
   ============================================================ */
function initMplTraps() { cards('#mpl-traps', MPL_TRAPS); }

function initAnatomy() {
  const root = $('#mpl-anatomy'); if (!root) return;
  const hit = (k, x, y, w, h) => '<rect class="mp-hit" data-p="' + k + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" fill="transparent" style="cursor:pointer"/>';
  const inner =
    '<rect x="8" y="8" width="544" height="304" rx="10" fill="#0e1421" stroke="#2b3a50" data-p="fig" class="mp-part" style="cursor:pointer"/>' +
    '<text x="20" y="28" fill="#5b6b85" font-size="10" font-family="monospace">Figure</text>' +
    '<rect x="86" y="48" width="400" height="212" rx="4" fill="#0a0f18" stroke="#3a4d6b" data-p="axes" class="mp-part" style="cursor:pointer"/>' +
    '<text x="94" y="64" fill="#5b6b85" font-size="10" font-family="monospace">Axes</text>' +
    /* grid + data */
    '<g stroke="#1b2740">' + [1, 2, 3].map(i => '<line x1="86" y1="' + (48 + i * 53) + '" x2="486" y2="' + (48 + i * 53) + '"/>').join('') + '</g>' +
    '<polyline points="120,224 190,180 260,196 330,132 400,150 460,92" fill="none" stroke="#38bdf8" stroke-width="2.5" data-p="line" class="mp-part" style="cursor:pointer"/>' +
    [ [120,224],[190,180],[260,196],[330,132],[400,150],[460,92] ].map(p => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="#38bdf8"/>').join('') +
    /* spines */
    '<g data-p="spine" class="mp-part" style="cursor:pointer">' +
      '<line x1="86" y1="260" x2="486" y2="260" stroke="#7c8ba6" stroke-width="2.5"/>' +
      '<line x1="86" y1="48" x2="86" y2="260" stroke="#7c8ba6" stroke-width="2.5"/>' +
      '<line x1="86" y1="48" x2="486" y2="48" stroke="#3a4d6b" stroke-width="2"/>' +
      '<line x1="486" y1="48" x2="486" y2="260" stroke="#3a4d6b" stroke-width="2"/></g>' +
    /* ticks */
    '<g data-p="tick" class="mp-part" style="cursor:pointer">' +
      [0, 1, 2, 3, 4, 5].map(i => '<line x1="' + (120 + i * 68) + '" y1="260" x2="' + (120 + i * 68) + '" y2="266" stroke="#7c8ba6" stroke-width="2"/>' +
        '<text x="' + (120 + i * 68) + '" y="280" fill="#93a3b8" font-size="10" text-anchor="middle" font-family="monospace">' + (i + 1) + '</text>').join('') +
      [0, 1, 2, 3].map(i => '<line x1="80" y1="' + (260 - i * 53) + '" x2="86" y2="' + (260 - i * 53) + '" stroke="#7c8ba6" stroke-width="2"/>' +
        '<text x="74" y="' + (264 - i * 53) + '" fill="#93a3b8" font-size="10" text-anchor="end" font-family="monospace">' + (i * 5) + '</text>').join('') + '</g>' +
    /* axis labels */
    '<g data-p="xaxis" class="mp-part" style="cursor:pointer">' +
      '<text x="286" y="300" fill="#c4d0e0" font-size="12" text-anchor="middle">quarter</text>' +
      '<text x="34" y="154" fill="#c4d0e0" font-size="12" text-anchor="middle" transform="rotate(-90 34 154)">revenue</text></g>' +
    /* title */
    '<text x="286" y="38" fill="#e6edf7" font-size="13" text-anchor="middle" font-weight="600" data-p="title" class="mp-part" style="cursor:pointer">Revenue by quarter</text>' +
    /* legend */
    '<g data-p="legend" class="mp-part" style="cursor:pointer">' +
      '<rect x="378" y="60" width="96" height="30" rx="5" fill="#0e1421" stroke="#3a4d6b"/>' +
      '<line x1="388" y1="75" x2="406" y2="75" stroke="#38bdf8" stroke-width="2.5"/>' +
      '<text x="412" y="79" fill="#93a3b8" font-size="10" font-family="monospace">2024</text></g>' +
    hit('fig', 8, 8, 544, 34) + hit('axes', 240, 100, 90, 40);
  root.innerHTML =
    '<div style="background:#070b12;border:1px solid #1e293b;border-radius:12px;padding:10px">' + svg(560, 320, inner) + '</div>' +
    '<div class="chip-row" id="mp-chips" style="margin-top:10px"></div>' +
    '<div id="mp-detail" style="margin-top:10px"></div>';
  const show = k => {
    const p = MPL_PARTS[k];
    $$('.mp-part', root).forEach(n => n.setAttribute('opacity', n.dataset.p === k ? '1' : '0.34'));
    $$('#mp-chips .chip', root).forEach(c => c.classList.toggle('active', c.dataset.p === k));
    $('#mp-detail', root).innerHTML =
      '<div class="pcard"><h3>' + p.t + '</h3><p class="pcard-desc">' + p.d + '</p><pre class="code">' + esc(p.code) + '</pre></div>';
    xp(1);
  };
  const chips = $('#mp-chips', root);
  Object.keys(MPL_PARTS).forEach(k => {
    const c = el('button', 'chip', MPL_PARTS[k].t);
    c.dataset.p = k; c.onclick = () => show(k); chips.appendChild(c);
  });
  $$('.mp-part, .mp-hit', root).forEach(n => n.onclick = () => show(n.dataset.p));
  show('axes');
}

function initMplBuilder() {
  const root = $('#mpl-builder'); if (!root) return;
  const st = { kind: 'line', color: '#38bdf8', cname: 'C0', grid: true, spines: true, marker: true, w: 6, h: 4, dpi: 100 };
  const X = [1, 2, 3, 4, 5, 6], Y = [3, 5, 4, 7, 6, 9];
  const COLORS = [['C0', '#38bdf8'], ['C1', '#f0883e'], ['C2', '#3fb950'], ['C3', '#f85149'], ['#8172B3', '#a78bfa']];
  root.innerHTML =
    '<div class="btn-row" id="mb-controls" style="gap:14px;align-items:center;flex-wrap:wrap"></div>' +
    '<div class="two-up" style="margin-top:14px">' +
      '<div><div class="lab-pane-title">what it draws</div><div id="mb-plot" style="background:#070b12;border:1px solid #1e293b;border-radius:12px;padding:8px"></div>' +
      '<div class="dim mono" id="mb-px" style="font-size:12px;margin-top:6px;text-align:center"></div></div>' +
      '<div><div class="lab-pane-title">the code that made it</div><pre class="code" id="mb-code"></pre></div></div>';
  const c = $('#mb-controls', root);
  const seg = (label, opts, key) => {
    const wrap = el('span', 'btn-row', '<span class="dim mono" style="font-size:12px">' + label + '</span>');
    opts.forEach(o => {
      const b = el('button', 'chip mono' + (st[key] === o.v ? ' active' : ''), o.l);
      b.onclick = () => { st[key] = o.v; if (o.extra) o.extra(); $$('.chip', wrap).forEach(x => x.classList.remove('active')); b.classList.add('active'); draw(); };
      wrap.appendChild(b);
    });
    c.appendChild(wrap);
  };
  seg('kind', [{ l: 'line', v: 'line' }, { l: 'bar', v: 'bar' }, { l: 'scatter', v: 'scatter' }], 'kind');
  const colWrap = el('span', 'btn-row', '<span class="dim mono" style="font-size:12px">color</span>');
  COLORS.forEach(([n, hex]) => {
    const b = el('button', 'chip mono' + (st.cname === n ? ' active' : ''), '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + hex + ';margin-right:5px"></span>' + n);
    b.onclick = () => { st.color = hex; st.cname = n; $$('.chip', colWrap).forEach(x => x.classList.remove('active')); b.classList.add('active'); draw(); };
    colWrap.appendChild(b);
  });
  c.appendChild(colWrap);
  seg('grid', [{ l: 'on', v: true }, { l: 'off', v: false }], 'grid');
  seg('top/right spines', [{ l: 'keep', v: true }, { l: 'hide', v: false }], 'spines');
  seg('markers', [{ l: 'on', v: true }, { l: 'off', v: false }], 'marker');
  const sl = el('span', 'btn-row',
    '<span class="dim mono" style="font-size:12px">figsize</span>' +
    '<input type="range" id="mb-w" min="3" max="10" step="0.5" value="6" style="width:90px">' +
    '<span class="mono" id="mb-wv" style="font-size:12px">6.0</span>' +
    '<span class="dim mono" style="font-size:12px">×</span>' +
    '<input type="range" id="mb-h" min="2" max="8" step="0.5" value="4" style="width:80px">' +
    '<span class="mono" id="mb-hv" style="font-size:12px">4.0</span>' +
    '<span class="dim mono" style="font-size:12px">dpi</span>' +
    '<input type="range" id="mb-dpi" min="72" max="300" step="1" value="100" style="width:90px">' +
    '<span class="mono" id="mb-dv" style="font-size:12px">100</span>');
  c.appendChild(sl);

  function draw() {
    const W = 460, H = 260, x0 = 54, y0 = 26, x1 = W - 18, y1 = H - 42;
    const maxY = 10;
    const px = i => x0 + (x1 - x0) * (X[i] - 0.6) / 5.8;
    const py = v => y1 - (y1 - y0) * v / maxY;
    let g = '';
    if (st.grid) for (let i = 1; i <= 4; i++) {
      const y = py(i * 2.5);
      g += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="#1b2740" stroke-width="1"/>';
    }
    let art = '';
    if (st.kind === 'line') {
      art = '<polyline points="' + X.map((_, i) => px(i) + ',' + py(Y[i])).join(' ') + '" fill="none" stroke="' + st.color + '" stroke-width="2.5"/>';
      if (st.marker) art += X.map((_, i) => '<circle cx="' + px(i) + '" cy="' + py(Y[i]) + '" r="4" fill="' + st.color + '"/>').join('');
    } else if (st.kind === 'bar') {
      art = X.map((_, i) => '<rect x="' + (px(i) - 16) + '" y="' + py(Y[i]) + '" width="32" height="' + (y1 - py(Y[i])) + '" rx="2" fill="' + st.color + '"/>').join('');
    } else {
      art = X.map((_, i) => '<circle cx="' + px(i) + '" cy="' + py(Y[i]) + '" r="6" fill="' + st.color + '" fill-opacity="0.85"/>').join('');
    }
    let spines = '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="#7c8ba6" stroke-width="1.5"/>' +
                 '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x0 + '" y2="' + y1 + '" stroke="#7c8ba6" stroke-width="1.5"/>';
    if (st.spines) spines += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y0 + '" stroke="#3a4d6b" stroke-width="1.5"/>' +
                             '<line x1="' + x1 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="#3a4d6b" stroke-width="1.5"/>';
    const ticks = X.map((v, i) => '<text x="' + px(i) + '" y="' + (y1 + 18) + '" fill="#93a3b8" font-size="10" text-anchor="middle" font-family="monospace">' + v + '</text>').join('') +
      [0, 5, 10].map(v => '<text x="' + (x0 - 8) + '" y="' + (py(v) + 4) + '" fill="#93a3b8" font-size="10" text-anchor="end" font-family="monospace">' + v + '</text>').join('');
    $('#mb-plot', root).innerHTML = svg(W, H, g + spines + ticks + art +
      '<text x="' + ((x0 + x1) / 2) + '" y="16" fill="#e6edf7" font-size="12" text-anchor="middle" font-weight="600">quarterly revenue</text>');
    $('#mb-px', root).textContent = st.w.toFixed(1) + ' × ' + st.h.toFixed(1) + ' in at ' + st.dpi + ' dpi  →  ' +
      Math.round(st.w * st.dpi) + ' × ' + Math.round(st.h * st.dpi) + ' px';
    const plotcall =
      st.kind === 'line'   ? 'ax.plot(x, y, color="' + st.cname + '", lw=2' + (st.marker ? ', marker="o"' : '') + ')'
    : st.kind === 'bar'    ? 'ax.bar(x, y, color="' + st.cname + '")'
                           : 'ax.scatter(x, y, color="' + st.cname + '", s=60, alpha=0.85)';
    $('#mb-code', root).textContent =
      'import matplotlib.pyplot as plt\n\n' +
      'fig, ax = plt.subplots(figsize=(' + st.w.toFixed(1) + ', ' + st.h.toFixed(1) + '), dpi=' + st.dpi + ')\n' +
      plotcall + '\n' +
      'ax.set_title("quarterly revenue")\n' +
      'ax.set_xlabel("quarter"); ax.set_ylabel("revenue")\n' +
      (st.grid ? 'ax.grid(axis="y", alpha=0.3)\n' : '') +
      (st.spines ? '' : 'ax.spines[["top", "right"]].set_visible(False)\n') +
      'fig.tight_layout()\n' +
      'fig.savefig("revenue.png", dpi=' + st.dpi + ', bbox_inches="tight")';
    xp(1);
  }
  const bind = (id, lab, key, dec) => $('#' + id, root).oninput = e => {
    st[key] = +e.target.value; $('#' + lab, root).textContent = dec ? st[key].toFixed(1) : st[key]; draw();
  };
  bind('mb-w', 'mb-wv', 'w', true); bind('mb-h', 'mb-hv', 'h', true); bind('mb-dpi', 'mb-dv', 'dpi', false);
  draw();
}

/* ============================================================
   seaborn widgets
   ============================================================ */
function initSnsLevel() {
  const root = $('#sns-level'); if (!root) return;
  root.innerHTML = '<div class="btn-row" id="sl-btns"></div><div id="sl-body" style="margin-top:12px"></div>';
  const btns = $('#sl-btns', root);
  SNS_LEVEL.forEach((L, i) => {
    const b = el('button', 'btn' + (i ? ' btn-ghost' : ''), L.t);
    b.onclick = () => {
      $$('.btn', btns).forEach(x => x.className = 'btn btn-ghost'); b.className = 'btn';
      const grid = L.k === 'figure'
        ? '<div class="btn-row" style="gap:6px;justify-content:center">' + ['eng', 'sales', 'ops'].map(d =>
            '<div style="width:96px;height:74px;border:1px solid ' + DEPT_COL[d] + '66;border-radius:8px;background:#0a0f18;display:grid;place-items:center;font:600 11px monospace;color:' + DEPT_COL[d] + '">' + d + '</div>').join('') +
            '</div><div class="dim" style="text-align:center;font-size:12px;margin-top:6px">one Axes per level of col= — the grid is the return value</div>'
        : '<div style="width:300px;height:110px;margin:0 auto;border:1px solid #3a4d6b;border-radius:8px;background:#0a0f18;display:grid;place-items:center;font:600 11px monospace;color:#93a3b8">a single Axes you already own</div>';
      $('#sl-body', root).innerHTML =
        '<div class="two-up"><div>' + grid + '</div>' +
        '<div><pre class="code">' + esc(L.code) + '</pre></div></div>' +
        '<div class="stepper-say"><b>' + L.ret + '</b><br>' + L.d + '<br><br><span class="mono dim">' + L.fns + '</span></div>';
      xp(1);
    };
    btns.appendChild(b);
  });
  btns.firstChild.click();
}

function initSnsPick() {
  const root = $('#sns-pick'); if (!root) return;
  root.innerHTML = '';
  SNS_PICK.forEach(p => {
    const card = el('div', 'ct-card reveal',
      '<div class="ct-ask">' + p.q + '</div>' +
      '<button class="btn btn-ghost">show the call</button>' +
      '<div class="ct-body"><pre class="code">' + esc(p.a) + '</pre><div class="ct-why">' + p.w + '</div></div>');
    const body = $('.ct-body', card), btn = $('button', card);
    btn.onclick = () => { body.classList.toggle('show'); xp(1); };
    root.appendChild(card);
  });
}

function initFacet() {
  const root = $('#sns-facet'); if (!root) return;
  const st = { hue: 'dept', col: 'none', row: 'none' };
  const OPTS = { hue: ['none', 'dept', 'senior'], col: ['none', 'dept'], row: ['none', 'senior'] };
  root.innerHTML = '<div class="btn-row" id="fc-ctl" style="gap:14px;flex-wrap:wrap"></div>' +
    '<div class="two-up" style="margin-top:12px"><div id="fc-prev"></div><div><pre class="code" id="fc-code"></pre></div></div>' +
    '<div class="stepper-say" id="fc-say"></div>';
  const ctl = $('#fc-ctl', root);
  Object.keys(OPTS).forEach(k => {
    const wrap = el('span', 'btn-row', '<span class="dim mono" style="font-size:12px">' + k + '=</span>');
    OPTS[k].forEach(v => {
      const b = el('button', 'chip mono' + (st[k] === v ? ' active' : ''), v);
      b.onclick = () => { st[k] = v; $$('.chip', wrap).forEach(x => x.classList.remove('active')); b.classList.add('active'); draw(); };
      wrap.appendChild(b);
    });
    ctl.appendChild(wrap);
  });
  function draw() {
    const cols = st.col === 'none' ? [''] : ['eng', 'sales', 'ops'];
    const rows = st.row === 'none' ? [''] : ['junior', 'senior'];
    const dots = n => Array.from({ length: n }, (_, i) =>
      '<circle cx="' + (12 + (i * 37) % 62) + '" cy="' + (12 + (i * 23) % 34) + '" r="3" fill="' +
      (st.hue === 'none' ? '#38bdf8' : ['#38bdf8', '#a78bfa', '#34d399'][i % 3]) + '"/>').join('');
    $('#fc-prev', root).innerHTML =
      '<div class="lab-pane-title">the grid it builds</div>' +
      rows.map(r => '<div class="btn-row" style="gap:6px;justify-content:center;margin-bottom:6px">' +
        cols.map(cName => '<div style="width:86px;border:1px solid #2b3a50;border-radius:8px;background:#0a0f18;padding:4px">' +
          '<div style="font:600 9.5px monospace;color:#93a3b8;text-align:center">' + [cName, r].filter(Boolean).join(' · ') + '</div>' +
          svg(80, 46, dots(7)) + '</div>').join('') + '</div>').join('') +
      '<div class="dim" style="text-align:center;font-size:12px">' + (rows.length * cols.length) + ' panel' + (rows.length * cols.length > 1 ? 's' : '') +
      (st.hue === 'none' ? '' : ' · coloured by <span class="mono">' + st.hue + '</span>') + '</div>';
    const args = ['data=df', 'x="years"', 'y="salary"']
      .concat(st.hue !== 'none' ? ['hue="' + st.hue + '"'] : [])
      .concat(st.col !== 'none' ? ['col="' + st.col + '"'] : [])
      .concat(st.row !== 'none' ? ['row="' + st.row + '"'] : [])
      .concat(['kind="scatter"']);
    const faceted = st.col !== 'none' || st.row !== 'none';
    $('#fc-code', root).textContent = faceted
      ? 'g = sns.relplot(\n    ' + args.join(',\n    ') + ',\n    height=3, aspect=1.2)\ng.set_titles("{col_name}")'
      : 'fig, ax = plt.subplots(figsize=(6, 4))\nsns.scatterplot(\n    ' + args.filter(a => a !== 'kind="scatter"').join(',\n    ') + ', ax=ax)';
    $('#fc-say', root).innerHTML = faceted
      ? '<b>You just crossed into figure-level territory.</b> The moment you want <span class="mono">col=</span> or <span class="mono">row=</span>, the axes-level function cannot help — it draws into one Axes and a facet grid needs many. That is the whole practical difference between <span class="mono">scatterplot</span> and <span class="mono">relplot</span>.'
      : '<b>No faceting, so stay axes-level.</b> <span class="mono">hue=</span> alone works fine in <span class="mono">scatterplot</span>, and you keep the <span class="mono">fig, ax</span> you made — which means every Matplotlib method you already know still applies.';
    xp(1);
  }
  draw();
}

const PALETTES = [
  { n: 'deep', k: 'categorical', c: ['#4C72B0', '#DD8452', '#55A868', '#C44E52', '#8172B3', '#937860', '#DA8BC3', '#8C8C8C'],
    d: 'The default. Distinct hues, no order implied — for unordered categories only.' },
  { n: 'colorblind', k: 'categorical', c: ['#0173B2', '#DE8F05', '#029E73', '#D55E00', '#CC78BC', '#CA9161', '#FBAFE4', '#949494'],
    d: 'Same job, safe under the common colour-vision deficiencies. Around 1 in 12 men cannot separate the default red and green — make this your habit, not your accessibility pass.' },
  { n: 'viridis', k: 'sequential', c: ['#440154', '#46327E', '#365C8D', '#277F8E', '#1FA187', '#4AC16D', '#A0DA39', '#FDE725'],
    d: 'Low → high. Perceptually uniform and monotone in lightness, so it survives being printed in greyscale. Use for magnitude: a heatmap, a density, a count.' },
  { n: 'rocket', k: 'sequential', c: ['#03051A', '#3B0F70', '#8C2981', '#DE4968', '#FE9F6D', '#FDD9A0', '#FCFDBF', '#FFFFFF'],
    d: 'seaborn’s own sequential map, tuned for heatmaps on a dark background. <span class="mono">mako</span> is the cool-toned sibling.' },
  { n: 'vlag', k: 'diverging', c: ['#2369BD', '#6E9BC5', '#A9C0D0', '#E7E7E7', '#E5B0A8', '#D06E68', '#A11122', '#7A0403'],
    d: 'Two directions from a meaningful middle. Correlations, differences, anything signed — and you must set <span class="mono">center=0</span> or the neutral colour lands somewhere arbitrary.' },
  { n: 'Set2', k: 'categorical', c: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#E5C494', '#B3B3B3'],
    d: 'Softer categorical set from ColorBrewer. Good when the marks are large — the pastel hues get hard to tell apart at scatter-point size.' }
];
function initPalette() {
  const root = $('#sns-palette'); if (!root) return;
  root.innerHTML = '<div class="chip-row" id="pl-tabs"></div><div id="pl-body" style="margin-top:12px"></div>';
  const tabs = $('#pl-tabs', root);
  PALETTES.forEach((p, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), p.n);
    b.onclick = () => {
      $$('.chip', tabs).forEach(x => x.classList.remove('active')); b.classList.add('active');
      $('#pl-body', root).innerHTML =
        '<div class="btn-row" style="gap:0;justify-content:center;margin-bottom:10px">' +
        p.c.map(c => '<div title="' + c + '" style="width:56px;height:44px;background:' + c + '"></div>').join('') + '</div>' +
        '<div class="btn-row" style="gap:0;justify-content:center;font:11px monospace;color:#5b6b85;margin-bottom:12px">' +
        p.c.map(c => '<div style="width:56px;text-align:center">' + c.slice(1) + '</div>').join('') + '</div>' +
        twoUp('sns.set_palette("' + p.n + '")\n' +
              'sns.scatterplot(data=df, x="x", y="y", hue="g",\n                palette="' + p.n + '")\n\n' +
              '# or grab the colours directly\nsns.color_palette("' + p.n + '", 8).as_hex()',
              "['" + p.c.slice(0, 4).join("', '") + "', ...]",
              '<b>' + p.k + '</b> — ' + p.d);
      xp(1);
    };
    tabs.appendChild(b);
  });
  tabs.firstChild.click();
}

/* ============================================================
   SciPy widgets
   ============================================================ */
function initSpModules() { cards('#sp-modules', SP_MODULES); }

function initTtest() {
  const root = $('#sp-ttest'); if (!root) return;
  const SD = 15, MA = 100;
  const st = { mb: 106, n: 30 };
  root.innerHTML =
    '<div class="btn-row" style="gap:16px;flex-wrap:wrap;align-items:center">' +
      '<span class="dim mono" style="font-size:12px">group B mean</span>' +
      '<input type="range" id="tt-mb" min="94" max="118" step="0.5" value="106" style="width:150px">' +
      '<span class="mono" id="tt-mbv">106.0</span>' +
      '<span class="dim mono" style="font-size:12px">n per group</span>' +
      '<input type="range" id="tt-n" min="5" max="300" step="1" value="30" style="width:150px">' +
      '<span class="mono" id="tt-nv">30</span></div>' +
    '<div class="two-up" style="margin-top:14px">' +
      '<div><div class="lab-pane-title">the two groups (sd fixed at 15)</div><div id="tt-plot"></div></div>' +
      '<div><div class="lab-pane-title">scipy says</div><pre class="code" id="tt-code"></pre><div id="tt-verdict"></div></div></div>' +
    '<div class="stepper-say" id="tt-say"></div>';
  function draw() {
    const n = st.n, mb = st.mb;
    const se = SD * Math.sqrt(2 / n);
    const t = (mb - MA) / se, df = 2 * n - 2, p = tSF2(Math.abs(t), df);
    const semA = SD / Math.sqrt(n);
    /* plot: population curves + sampling distributions of the two means */
    const W = 440, H = 210, x0 = 40, y0 = 12, x1 = W - 12, y1 = H - 30;
    const lo = 80, hi = 130, sx = v => x0 + (x1 - x0) * (v - lo) / (hi - lo);
    const peak = normPdf(0, 0, semA);
    const curve = (m, s, colour, wid, dash) => {
      const pts = [];
      for (let v = lo; v <= hi; v += 0.4) pts.push(sx(v) + ',' + (y1 - (y1 - y0) * normPdf(v, m, s) / peak));
      return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + colour + '" stroke-width="' + wid + '"' + (dash ? ' stroke-dasharray="4 4"' : '') + '/>';
    };
    const popPeak = normPdf(0, 0, SD);
    const popCurve = (m, colour) => {
      const pts = [];
      for (let v = lo; v <= hi; v += 0.6) pts.push(sx(v) + ',' + (y1 - (y1 - y0) * 0.32 * normPdf(v, m, SD) / popPeak));
      return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + colour + '" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.7"/>';
    };
    $('#tt-plot', root).innerHTML = svg(W, H,
      axes(x0, y0, x1, y1, 'value', null, false) +
      popCurve(MA, '#38bdf8') + popCurve(mb, '#a78bfa') +
      curve(MA, semA, '#38bdf8', 2.5) + curve(mb, semA, '#a78bfa', 2.5) +
      [MA, mb].map((m, i) => '<line x1="' + sx(m) + '" y1="' + y0 + '" x2="' + sx(m) + '" y2="' + y1 + '" stroke="' + ['#38bdf8', '#a78bfa'][i] + '" stroke-width="1" opacity="0.5"/>').join('') +
      '<text x="' + sx(MA) + '" y="' + (y1 + 16) + '" fill="#38bdf8" font-size="10" text-anchor="middle" font-family="monospace">A ' + MA + '</text>' +
      '<text x="' + sx(mb) + '" y="' + (y1 + 16) + '" fill="#a78bfa" font-size="10" text-anchor="middle" font-family="monospace">B ' + fmt(mb, 1) + '</text>');
    $('#tt-code', root).textContent =
      'from scipy import stats\n\n' +
      '# n=' + n + ' per group, sd=15\n' +
      'res = stats.ttest_ind(a, b)\n' +
      'res.statistic   # ' + fmt(t, 3) + '\n' +
      'res.pvalue      # ' + (p < 1e-4 ? p.toExponential(2) : fmt(p, 4)) + '\n' +
      'res.df          # ' + df + '\n\n' +
      '# the effect size, which the p-value hides\n' +
      '(b.mean() - a.mean()) / 15   # d = ' + fmt((mb - MA) / SD, 2);
    const sig = p < 0.05;
    $('#tt-verdict', root).innerHTML =
      '<div class="pill ' + (sig ? 'good' : 'bad') + '" style="margin-top:8px">p = ' +
      (p < 1e-4 ? p.toExponential(2) : fmt(p, 4)) + (sig ? '  → reject H₀ at 0.05' : '  → cannot reject H₀') + '</div>';
    $('#tt-say', root).innerHTML =
      'The dashed curves are the two <b>populations</b> — they never move when you change n. The solid curves are the <b>sampling distributions of the means</b>, and they narrow as √n. ' +
      'That is the whole trick: <b>drag n up and the same ' + fmt(mb - MA, 1) + '-point difference becomes "significant" without the data changing at all.</b> ' +
      'A p-value answers "could this gap be noise at this sample size", never "is this gap big enough to care about" — which is why the effect size sits in the code beside it.' +
      (Math.abs(mb - MA) < 1.5 && p < 0.05 ? '<br><br><b style="color:#f0b429">Look at what you just did:</b> a ' + fmt(Math.abs(mb - MA), 1) + '-point difference, statistically significant, and almost certainly meaningless to anyone using the product.' : '');
    xp(1);
  }
  $('#tt-mb', root).oninput = e => { st.mb = +e.target.value; $('#tt-mbv', root).textContent = fmt(st.mb, 1); draw(); };
  $('#tt-n', root).oninput  = e => { st.n = +e.target.value;  $('#tt-nv', root).textContent = st.n; draw(); };
  draw();
}

function initFit() {
  const root = $('#sp-fit'); if (!root) return;
  const X = [1, 2, 3, 4, 5, 6, 7, 8];
  const CLEAN = [5.2, 7.1, 9.4, 11.0, 13.6, 15.1, 17.4, 19.2];
  let outlier = false;
  root.innerHTML =
    '<div class="btn-row"><button class="btn" id="ft-toggle">add one bad reading</button>' +
      '<span class="dim" style="font-size:12.5px">one sensor glitch at x = 6</span></div>' +
    '<div class="two-up" style="margin-top:12px"><div id="ft-plot" style="background:#070b12;border:1px solid #1e293b;border-radius:12px;padding:8px"></div>' +
      '<div><pre class="code" id="ft-code"></pre><div id="ft-num"></div></div></div>' +
    '<div class="stepper-say" id="ft-say"></div>';
  function ols(xs, ys) {
    const mx = mean(xs), my = mean(ys);
    const m = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const c = my - m * mx;
    const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
    const ssRes = ys.reduce((s, y, i) => s + (y - (m * xs[i] + c)) ** 2, 0);
    return { m, c, r2: 1 - ssRes / ssTot };
  }
  function draw() {
    const Y = CLEAN.slice(); if (outlier) Y[5] = 44;
    const f = ols(X, Y), clean = ols(X, CLEAN);
    const W = 400, H = 250, x0 = 44, y0 = 14, x1 = W - 14, y1 = H - 32;
    const maxY = outlier ? 48 : 22;
    const sx = v => x0 + (x1 - x0) * (v - 0.4) / 8.2, sy = v => y1 - (y1 - y0) * v / maxY;
    const pts = X.map((x, i) => '<circle cx="' + sx(x) + '" cy="' + sy(Y[i]) + '" r="4.5" fill="' +
      (outlier && i === 5 ? '#f87171' : '#38bdf8') + '"/>').join('');
    const resid = X.map((x, i) => '<line x1="' + sx(x) + '" y1="' + sy(Y[i]) + '" x2="' + sx(x) + '" y2="' + sy(f.m * x + f.c) +
      '" stroke="#f0b429" stroke-width="1" stroke-dasharray="2 3" opacity="0.8"/>').join('');
    const line = (fit, colour, dash) => '<line x1="' + sx(0.4) + '" y1="' + sy(fit.m * 0.4 + fit.c) + '" x2="' + sx(8.6) +
      '" y2="' + sy(fit.m * 8.6 + fit.c) + '" stroke="' + colour + '" stroke-width="2.5"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    $('#ft-plot', root).innerHTML = svg(W, H,
      axes(x0, y0, x1, y1, 'x', 'y', true) + resid +
      (outlier ? line(clean, '#3fb950', true) : '') + line(f, '#a78bfa') + pts +
      (outlier ? '<text x="' + (sx(6) + 8) + '" y="' + (sy(44) + 4) + '" fill="#f87171" font-size="10" font-family="monospace">44</text>' : ''));
    $('#ft-code', root).textContent =
      'from scipy.optimize import curve_fit\n\n' +
      'def line(x, m, c):\n    return m * x + c\n\n' +
      'popt, pcov = curve_fit(line, x, y)\n' +
      'm, c = popt                 # ' + fmt(f.m, 3) + ', ' + fmt(f.c, 3) + '\n' +
      'np.sqrt(np.diag(pcov))      # standard errors\n\n' +
      (outlier
        ? '# the fix for exactly this situation:\n' +
          'from scipy.optimize import least_squares\n' +
          'least_squares(resid, x0, loss="soft_l1")\n' +
          '# or scipy.stats.siegelslopes / theilslopes'
        : '# stats.linregress does the same for a\n' +
          '# straight line, and hands back r and p');
    $('#ft-num', root).innerHTML =
      '<div class="stat-row"><div class="stat"><div class="stat-k">slope</div><div class="stat-v">' + fmt(f.m, 3) + '</div></div>' +
      '<div class="stat"><div class="stat-k">intercept</div><div class="stat-v">' + fmt(f.c, 3) + '</div></div>' +
      '<div class="stat"><div class="stat-k">R²</div><div class="stat-v">' + fmt(f.r2, 3) + '</div></div></div>';
    $('#ft-say', root).innerHTML = outlier
      ? '<b>One point in eight moved the slope from ' + fmt(clean.m, 2) + ' to ' + fmt(f.m, 2) + '.</b> Least squares minimises the <i>squared</i> residual, so a point twice as far off counts four times as much — the fit is dragged toward the glitch and R² still looks respectable. ' +
        'The green dashed line is the fit you wanted. Reach for a robust loss (<span class="mono">loss="soft_l1"</span>) or a robust estimator (<span class="mono">siegelslopes</span>), and always plot the residuals before you believe a fit.'
      : 'The amber dashes are the <b>residuals</b> — what the fit gets wrong at each point, and the quantity being minimised. <span class="mono">curve_fit</span> takes any function of <span class="mono">(x, *params)</span>, so exponentials, sigmoids and sums of Gaussians work the same way; a straight line is just the easiest one to check by eye. Now add the bad reading.';
    xp(2);
  }
  $('#ft-toggle', root).onclick = () => {
    outlier = !outlier;
    $('#ft-toggle', root).textContent = outlier ? 'remove the bad reading' : 'add one bad reading';
    draw();
  };
  draw();
}

function initDist() {
  const root = $('#sp-dist'); if (!root) return;
  const st = { kind: 'norm', mu: 0, sigma: 1, x: 1.5, n: 20, p: 0.3, lam: 4 };
  root.innerHTML = '<div class="chip-row" id="ds-tabs"></div><div id="ds-ctl" class="btn-row" style="gap:14px;margin-top:10px;flex-wrap:wrap"></div>' +
    '<div class="two-up" style="margin-top:12px"><div id="ds-plot" style="background:#070b12;border:1px solid #1e293b;border-radius:12px;padding:8px"></div>' +
    '<div><pre class="code" id="ds-code"></pre></div></div><div class="stepper-say" id="ds-say"></div>';
  const tabs = $('#ds-tabs', root);
  [['norm', 'normal'], ['binom', 'binomial'], ['poisson', 'poisson']].forEach(([k, lab], i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), 'stats.' + k);
    b.onclick = () => { $$('.chip', tabs).forEach(x => x.classList.remove('active')); b.classList.add('active'); st.kind = k; ctl(); draw(); };
    tabs.appendChild(b);
  });
  const slider = (id, label, key, min, max, step, dec) =>
    '<span class="btn-row"><span class="dim mono" style="font-size:12px">' + label + '</span>' +
    '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + st[key] + '" style="width:120px">' +
    '<span class="mono" id="' + id + '-v" style="font-size:12px">' + (dec ? fmt(st[key], 1) : st[key]) + '</span></span>';
  function ctl() {
    $('#ds-ctl', root).innerHTML =
      st.kind === 'norm' ? slider('ds-mu', 'μ', 'mu', -3, 3, 0.1, true) + slider('ds-sg', 'σ', 'sigma', 0.4, 3, 0.1, true) + slider('ds-x', 'x', 'x', -4, 4, 0.1, true)
    : st.kind === 'binom' ? slider('ds-n', 'n', 'n', 2, 40, 1) + slider('ds-p', 'p', 'p', 0.05, 0.95, 0.05, true)
    : slider('ds-lam', 'λ', 'lam', 0.5, 15, 0.5, true);
    $$('#ds-ctl input', root).forEach(inp => inp.oninput = e => {
      const map = { 'ds-mu': 'mu', 'ds-sg': 'sigma', 'ds-x': 'x', 'ds-n': 'n', 'ds-p': 'p', 'ds-lam': 'lam' };
      const key = map[e.target.id];
      st[key] = +e.target.value;
      $('#' + e.target.id + '-v', root).textContent = (key === 'n' ? st[key] : fmt(st[key], 1));
      draw();
    });
  }
  const logC = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  function draw() {
    const W = 400, H = 240, x0 = 44, y0 = 14, x1 = W - 14, y1 = H - 34;
    let body = '', code = '', say = '';
    if (st.kind === 'norm') {
      const lo = st.mu - 4.2 * st.sigma, hi = st.mu + 4.2 * st.sigma;
      const sx = v => x0 + (x1 - x0) * (v - lo) / (hi - lo);
      const peak = normPdf(st.mu, st.mu, st.sigma), sy = v => y1 - (y1 - y0) * v / peak;
      const pts = [], fill = [x0 + ',' + y1];
      for (let v = lo; v <= hi; v += (hi - lo) / 160) {
        pts.push(sx(v) + ',' + sy(normPdf(v, st.mu, st.sigma)));
        if (v <= st.x) fill.push(sx(v) + ',' + sy(normPdf(v, st.mu, st.sigma)));
      }
      fill.push(sx(Math.min(st.x, hi)) + ',' + y1);
      const cdf = normCdf(st.x, st.mu, st.sigma);
      body = svg(W, H, axes(x0, y0, x1, y1, 'x', 'density', true) +
        '<polygon points="' + fill.join(' ') + '" fill="#38bdf8" fill-opacity="0.22"/>' +
        '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#38bdf8" stroke-width="2.5"/>' +
        '<line x1="' + sx(st.x) + '" y1="' + y0 + '" x2="' + sx(st.x) + '" y2="' + y1 + '" stroke="#f0b429" stroke-width="1.5"/>' +
        '<text x="' + sx(st.x) + '" y="' + (y1 + 16) + '" fill="#f0b429" font-size="10" text-anchor="middle" font-family="monospace">x=' + fmt(st.x, 1) + '</text>');
      code = 'from scipy.stats import norm\n\nd = norm(loc=' + fmt(st.mu, 1) + ', scale=' + fmt(st.sigma, 1) + ')\n' +
        'd.pdf(' + fmt(st.x, 1) + ')     # ' + fmt(normPdf(st.x, st.mu, st.sigma), 4) + '   height\n' +
        'd.cdf(' + fmt(st.x, 1) + ')     # ' + fmt(cdf, 4) + '   shaded area\n' +
        'd.sf(' + fmt(st.x, 1) + ')      # ' + fmt(1 - cdf, 4) + '   the tail\n' +
        'd.ppf(0.975)   # ' + fmt(st.mu + 1.959964 * st.sigma, 4) + '   inverse cdf\n' +
        'd.rvs(size=5, random_state=0)';
      say = 'Every distribution in <span class="mono">scipy.stats</span> answers to the same four methods, which is the reason to learn one of them properly. ' +
        '<b>pdf</b> is the height (never a probability), <b>cdf</b> is the shaded area, <b>sf</b> is <span class="mono">1 - cdf</span> computed accurately in the far tail, and <b>ppf</b> runs the cdf backwards — it is where 1.96 comes from.';
    } else if (st.kind === 'binom') {
      const n = Math.round(st.n), p = st.p, ks = Array.from({ length: n + 1 }, (_, k) => k);
      const pm = ks.map(k => Math.exp(logC(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)));
      const mx = Math.max(...pm), bw = (x1 - x0) / (n + 1);
      body = svg(W, H, axes(x0, y0, x1, y1, 'k successes', 'P(X=k)', true) +
        ks.map((k, i) => '<rect x="' + (x0 + i * bw + 1) + '" y="' + (y1 - (y1 - y0) * pm[i] / mx) + '" width="' + Math.max(1, bw - 2) +
          '" height="' + ((y1 - y0) * pm[i] / mx) + '" fill="#a78bfa" fill-opacity="0.85"/>').join('') +
        '<text x="' + (x0 + Math.round(n * p) * bw + bw / 2) + '" y="' + (y1 + 16) + '" fill="#93a3b8" font-size="10" text-anchor="middle" font-family="monospace">' + Math.round(n * p) + '</text>');
      const k0 = Math.round(n * p);
      code = 'from scipy.stats import binom\n\nd = binom(n=' + n + ', p=' + fmt(p, 2) + ')\n' +
        'd.pmf(' + k0 + ')      # ' + fmt(pm[k0], 4) + '  exactly k\n' +
        'd.cdf(' + k0 + ')      # ' + fmt(pm.slice(0, k0 + 1).reduce((a, b) => a + b, 0), 4) + '  k or fewer\n' +
        'd.mean()      # ' + fmt(n * p, 2) + '   = n·p\n' +
        'd.var()       # ' + fmt(n * p * (1 - p), 2) + '   = n·p·(1-p)';
      say = 'Discrete, so it is <b>pmf</b> not pdf — an actual probability of an exact value. Count of successes in ' + n + ' independent trials: conversions out of visitors, defects out of units. ' +
        'Push p toward 0 with n large and it becomes the Poisson beside it; push n up with p fixed and it approaches the normal.';
    } else {
      const lam = st.lam, top = Math.max(10, Math.ceil(lam + 4 * Math.sqrt(lam)));
      const ks = Array.from({ length: top + 1 }, (_, k) => k);
      const pm = ks.map(k => Math.exp(-lam + k * Math.log(lam) - lgamma(k + 1)));
      const mx = Math.max(...pm), bw = (x1 - x0) / (top + 1);
      body = svg(W, H, axes(x0, y0, x1, y1, 'k events', 'P(X=k)', true) +
        ks.map((k, i) => '<rect x="' + (x0 + i * bw + 1) + '" y="' + (y1 - (y1 - y0) * pm[i] / mx) + '" width="' + Math.max(1, bw - 2) +
          '" height="' + ((y1 - y0) * pm[i] / mx) + '" fill="#3fb950" fill-opacity="0.85"/>').join(''));
      const k0 = Math.round(lam);
      code = 'from scipy.stats import poisson\n\nd = poisson(mu=' + fmt(lam, 1) + ')\n' +
        'd.pmf(' + k0 + ')       # ' + fmt(pm[k0], 4) + '\n' +
        'd.cdf(' + k0 + ')       # ' + fmt(pm.slice(0, k0 + 1).reduce((a, b) => a + b, 0), 4) + '\n' +
        'd.mean(), d.var()  # ' + fmt(lam, 1) + ', ' + fmt(lam, 1) + '  (equal — that is the tell)\n' +
        'd.sf(' + (k0 + 3) + ')       # ' + fmt(1 - pm.slice(0, k0 + 4).reduce((a, b) => a + b, 0), 4) + '  "worse than this by luck?"';
      say = 'Counts per fixed interval: errors per hour, arrivals per minute. Its mean and variance are both λ — so if your count data has variance far above its mean, it is <b>overdispersed</b> and Poisson is the wrong model (reach for negative binomial). ' +
        'The <span class="mono">sf</span> call is the practical one: the probability of seeing at least this many by chance is how you decide an alert is real.';
    }
    $('#ds-plot', root).innerHTML = body;
    $('#ds-code', root).textContent = code;
    $('#ds-say', root).innerHTML = say;
    xp(1);
  }
  ctl(); draw();
}

function initSparse() {
  const root = $('#sp-sparse'); if (!root) return;
  const R = 20000, C = 8000;
  let dens = 0.5;
  root.innerHTML =
    '<div class="btn-row" style="gap:14px;align-items:center"><span class="dim mono" style="font-size:12px">density</span>' +
      '<input type="range" id="sp-d" min="0.05" max="20" step="0.05" value="0.5" style="width:200px">' +
      '<span class="mono" id="sp-dv">0.50%</span>' +
      '<span class="dim" style="font-size:12.5px">of a 20,000 × 8,000 matrix</span></div>' +
    '<div id="sp-bars" style="margin-top:14px"></div>' +
    '<pre class="code" id="sp-code"></pre><div class="stepper-say" id="sp-say"></div>';
  const mb = b => b / 1048576;
  function draw() {
    const nnz = Math.round(R * C * dens / 100);
    const dense = R * C * 8;
    const csr = nnz * 8 + nnz * 4 + (R + 1) * 4;
    const wide = Math.max(mb(dense), mb(csr));
    const bar = (lab, bytes, colour) =>
      '<div style="margin:8px 0"><div class="btn-row" style="justify-content:space-between"><span class="mono" style="font-size:12.5px">' + lab + '</span>' +
      '<span class="mono" style="font-size:12.5px;color:' + colour + '">' + (mb(bytes) > 999 ? fmt(mb(bytes) / 1024, 2) + ' GiB' : fmt(mb(bytes), 1) + ' MiB') + '</span></div>' +
      '<div style="height:14px;border-radius:5px;background:#0e1421;border:1px solid #22304a;overflow:hidden">' +
      '<div style="height:100%;width:' + (mb(bytes) / wide * 100) + '%;background:' + colour + '"></div></div></div>';
    $('#sp-bars', root).innerHTML =
      bar('np.zeros((20000, 8000))  — dense float64', dense, '#f87171') +
      bar('csr_matrix(...)  — ' + nnz.toLocaleString('en-US') + ' stored values', csr, '#3fb950');
    $('#sp-code', root).textContent =
      'from scipy.sparse import csr_matrix, random\n\n' +
      'M = random(20_000, 8_000, density=' + (dens / 100).toFixed(4) + ', format="csr")\n' +
      'M.nnz          # ' + nnz.toLocaleString('en-US') + '\n' +
      'M.data.nbytes + M.indices.nbytes + M.indptr.nbytes\n' +
      '#              ' + Math.round(csr).toLocaleString('en-US') + ' bytes\n\n' +
      'M @ v          # sparse matmul, only the non-zeros\n' +
      'M.toarray()    # ' + fmt(mb(dense) / 1024, 2) + ' GiB — do not do this';
    $('#sp-say', root).innerHTML =
      'CSR stores three arrays: the values, their column indices, and one offset per row. That is 12 bytes per stored value plus 4 per row, against 8 bytes per <i>cell</i> for a dense array. ' +
      (mb(csr) < mb(dense)
        ? '<b>At ' + fmt(dens, 2) + '% density the sparse form is ' + fmt(mb(dense) / mb(csr), 0) + '× smaller.</b> '
        : '<b>At ' + fmt(dens, 2) + '% density sparse has stopped paying</b> — the index overhead now costs more than the zeros you avoided. ') +
      'The break-even is around 33% density; in practice a term-document matrix or a user-item matrix sits under 1%, which is why <span class="mono">CountVectorizer</span> hands you one of these and scikit-learn estimators accept it directly. The one rule: never call <span class="mono">.toarray()</span> on something you built sparse on purpose.';
    xp(1);
  }
  $('#sp-d', root).oninput = e => { dens = +e.target.value; $('#sp-dv', root).textContent = fmt(dens, 2) + '%'; draw(); };
  draw();
}

/* ---------- boot ---------- */
if (typeof module !== 'undefined' && module.exports)
  module.exports = { broadcast, tSF2, normCdf, normPdf, lgamma, parseShape, showShape };

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  [initNpOps, initNpTraps, initBroadcast, initAxis, initViewCopy,
   initPdIndex, initPdMissing, initPdPerf, initGroupby, initMerge, initReshape,
   initAnatomy, initMplBuilder, initMplTraps,
   initSnsLevel, initSnsPick, initFacet, initPalette,
   initSpModules, initTtest, initFit, initDist, initSparse
  ].forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
