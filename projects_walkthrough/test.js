/* Parity check: the JavaScript on this page vs the Python it explains.

   The walkthrough re-implements policy.decide, BM25, confidence(), the gate,
   the SQL validator, the Mem0 reconcile rules and the eval scorer so the
   interactions behave like the real system. Re-implementations rot silently,
   and a walkthrough that teaches an old threshold is worse than no walkthrough.

   So this runs both and compares:

       python parity.py     # ground truth from the actual modules
       node test.js         # every assertion below

   Run: node test.js                                                        */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- load content.js + demos.js with a minimal DOM ---------- */
const ctx = {};
ctx.window = ctx;
ctx.document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
ctx.requestAnimationFrame = () => {};
ctx.console = console;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/demos.js', 'utf8'), ctx);

const C = ctx.window.C;
const decide = ctx.window.__decide;
const S = ctx.window.__support;
const validateSql = ctx.window.__validateSql;
const reconcile = ctx.window.__reconcile;
const evalTenant = ctx.window.__evalTenant;
const df = ctx.window.__df;
const makeTickets = ctx.window.__makeTickets;

assert(decide && S && validateSql && reconcile && evalTenant, 'demos.js did not export its ported logic');

if (!fs.existsSync('parity.json')) {
  console.error('parity.json is missing. Run:  python parity.py');
  process.exit(1);
}
const T = JSON.parse(fs.readFileSync('parity.json', 'utf8'));

// Values built inside the vm sandbox carry that realm's prototypes, so
// deepStrictEqual rejects arrays that are element-for-element identical.
// Round-tripping through JSON gives us plain host objects to compare.
const plain = v => JSON.parse(JSON.stringify(v));

/* ================= 1. policy constants ================= */
const pc = T.policy_constants;
assert.strictEqual(C.policy.AUTO_APPROVE_LIMIT_CENTS, pc.AUTO_APPROVE_LIMIT_CENTS,
  'the page shows a different auto-approve limit than policy.py');
assert.strictEqual(C.policy.RETURN_WINDOW_DAYS, pc.RETURN_WINDOW_DAYS);
assert.strictEqual(C.policy.FRAUD_BLOCK_SCORE, pc.FRAUD_BLOCK_SCORE);
assert.strictEqual(C.policy.FRAUD_REVIEW_SCORE, pc.FRAUD_REVIEW_SCORE);
assert.deepStrictEqual(plain(C.policy.VALID_REASONS), pc.VALID_REASONS);
assert.deepStrictEqual(plain(C.policy.NO_RESTOCK_REASONS), pc.NO_RESTOCK_REASONS);

/* ================= 2. policy.decide, case by case ================= */
T.policy.forEach((row, i) => {
  const c = row.case;
  const js = decide(
    { total: c.total, refunded: c.refunded, days: c.days, fraud: c.fraud, status: 'delivered' },
    { reason: c.reason, asked: c.asked });

  const where = `policy case ${i} (${JSON.stringify(c)})`;
  assert.strictEqual(js.allowed, row.allowed, `${where}: allowed`);
  assert.strictEqual(js.amount, row.amount, `${where}: amount`);
  assert.strictEqual(js.requiresApproval, row.requires, `${where}: requires_approval`);
  if (row.allowed) assert.strictEqual(js.restock, row.restock, `${where}: restock`);
  // the reason strings are what the page renders as pills, so they must match too
  assert.deepStrictEqual(plain(js.reasons), row.reasons, `${where}: reasons`);
});

/* ================= 3. the injection chapter must actually hold ================= */
C.injectionCases.forEach(c => {
  const badId = !/^O-\d{1,10}$/.test(c.extracted.order_id || '');
  if (badId || c.orderTotal == null) return;          // handled before policy
  const asked = c.extracted.requested_amount == null ? null
    : Math.round(c.extracted.requested_amount * 100);
  const d = decide({ total: c.orderTotal, refunded: 0, days: 3, fraud: 0, status: 'delivered' },
                   { reason: c.extracted.reason, asked: asked });
  assert(d.amount <= c.orderTotal,
    `injection case "${c.label}" would pay ${d.amount} on an order of ${c.orderTotal}`);
  if (d.amount > C.policy.AUTO_APPROVE_LIMIT_CENTS) {
    assert(d.requiresApproval, `injection case "${c.label}" auto-approved above the limit`);
  }
});

/* ================= 4. tenant seed data matches seed.py ================= */
Object.keys(T.tenants).forEach(tid => {
  const page = C.tenants.find(t => t.id === tid);
  assert(page, `the page is missing tenant ${tid}`);
  const truth = T.tenants[tid];

  assert.deepStrictEqual(plain(page.docs.map(d => d.title)), truth.docs.map(d => d[0]),
    `${tid}: doc titles drifted from seed.py`);
  page.docs.forEach((d, i) => assert.strictEqual(d.body, truth.docs[i][1],
    `${tid}: body of "${d.title}" drifted from seed.py`));

  assert.strictEqual(page.config.auto_send_at, truth.config.auto_send_at, `${tid}: auto_send_at`);
  assert.strictEqual(page.config.refuse_below, truth.config.refuse_below, `${tid}: refuse_below`);
  assert.strictEqual(page.config.sla_accuracy, truth.config.sla_accuracy, `${tid}: sla_accuracy`);
  assert.strictEqual(page.config.budget_cents, truth.config.budget_cents_per_period, `${tid}: budget`);

  assert.strictEqual(page.golden.length, truth.golden.length, `${tid}: golden set size`);
  page.golden.forEach((g, i) => {
    assert.strictEqual(g.q, truth.golden[i].q, `${tid}: golden question ${i}`);
    assert.strictEqual(g.must_cite, truth.golden[i].must_cite, `${tid}: must_cite ${i}`);
    assert.strictEqual(!!g.must_refuse, !!truth.golden[i].must_refuse, `${tid}: must_refuse ${i}`);
  });
});

/* ================= 5. BM25 + confidence, per tenant, per probe ================= */
T.retrieval.forEach(row => {
  const t = C.tenants.find(x => x.id === row.tenant);
  const hits = S.search(S.indexFor(t), row.q, 3);
  const where = `retrieval ${row.tenant} "${row.q}"`;

  assert.deepStrictEqual(plain(hits.map(h => h.title)), row.titles, `${where}: ranked titles`);
  if (hits.length) {
    assert(Math.abs(hits[0].score - row.top) < 1e-6, `${where}: bm25 top ${hits[0].score} vs ${row.top}`);
  }
  const conf = S.confidence(hits, row.q);
  assert(Math.abs(conf - row.conf) < 1e-6, `${where}: confidence ${conf} vs ${row.conf}`);
});

/* ================= 6. the eval gate reproduces evalgate.py ================= */
T.evals.forEach(row => {
  const t = C.tenants.find(x => x.id === row.tenant);
  const js = evalTenant(t, null);
  const where = `eval ${row.tenant}`;

  assert.strictEqual(js.n, row.n, `${where}: case count`);
  assert(Math.abs(js.acc - row.acc) < 1e-6, `${where}: accuracy ${js.acc} vs ${row.acc}`);
  assert(Math.abs(js.auto - row.auto) < 1e-6, `${where}: auto-send rate ${js.auto} vs ${row.auto}`);
  assert.strictEqual(js.badAuto, row.bad_auto, `${where}: wrongly auto-sent`);
  assert.strictEqual(js.missedRef, row.missed_ref, `${where}: missed refusals`);
  assert.strictEqual(js.failures.length, row.failures.length, `${where}: failure count`);
});

// the chapter's whole argument: the worst tenant is below the fleet average
const scores = C.tenants.map(t => evalTenant(t, null));
const mean = scores.reduce((a, s) => a + s.acc, 0) / scores.length;
const worst = scores.reduce((a, s) => (s.acc < a.acc ? s : a));
assert(worst.acc < mean, 'chapter 15 claims the average hides the worst tenant — it no longer does');
assert(scores.every(s => s.acc >= s.sla), 'a tenant is below its SLA: the gate would fail');
assert(scores.every(s => s.badAuto === 0), 'a wrong answer was auto-sent');

// The slider in chapter 15 has to demonstrate the real trade-off: a lower
// auto-send bar deflects more tickets, a higher one deflects none.
const reckless = C.tenants.map(t => evalTenant(t, 0.05));
const cautious = C.tenants.map(t => evalTenant(t, 0.95));
const autoAt = arr => arr.reduce((a, s) => a + s.auto, 0) / arr.length;
assert(autoAt(reckless) > autoAt(scores),
  'dropping auto_send_at did not increase deflection — the slider proves nothing');
assert(autoAt(cautious) === 0,
  'raising auto_send_at to 0.95 should route everything to a human');

// Worth stating plainly, because the page says it too: with THESE golden sets
// no threshold can produce a bad auto-send, because every failing case
// retrieves nothing at all and refusal is unconditional when there are no hits.
// That is a property of the seed data, not a guarantee of the gate.
assert(reckless.every(s => s.badAuto === 0),
  'a failing case now retrieves something — chapter 15 needs its caveat updated');

/* ================= 7. the SQL validator agrees with TenantDB.select ================= */
T.sql.forEach(row => {
  const js = validateSql(row.sql);
  assert.strictEqual(js.ok, row.allowed,
    `SQL "${row.sql}": page says ${js.ok ? 'allowed' : 'refused'}, Python says ${row.allowed ? 'allowed' : 'refused'}`);
  if (js.ok) {
    assert(js.scoped.indexOf('main.tickets') > -1,
      'the scoped rewrite must qualify the base table, or SQLite calls the CTE circular');
  }
});
C.sqlProbes.forEach(p => {
  const js = validateSql(p.sql);
  assert.strictEqual(js.ok, p.verdict === 'allowed',
    `sqlProbes entry "${p.sql}" is labelled ${p.verdict} but the validator disagrees`);
});

/* ================= 8. Mem0 reconcile produces the four operations ================= */
(() => {
  const store = [];
  let nextId = 1;
  const ops = [];

  C.memoryTurns.forEach(turn => {
    turn.facts.forEach(fact => {
      const op = reconcile(fact, store);
      ops.push(op.op);
      if (op.op === 'ADD') store.push({ id: nextId++, text: op.text });
      else if (op.op === 'UPDATE') store.find(m => m.id === op.id).text = op.text;
      else if (op.op === 'DELETE') store.splice(store.findIndex(m => m.id === op.id), 1);
    });
  });

  assert.deepStrictEqual(plain(ops), ['ADD', 'ADD', 'UPDATE', 'NOOP', 'DELETE'],
    `the memory chapter must demonstrate all four operations in order, got ${ops.join(',')}`);
  assert.deepStrictEqual(plain(store.map(m => m.text)), ['Has 12 seats'],
    'after the scripted turns exactly one memory should survive');
  const last = C.memoryTurns[C.memoryTurns.length - 1];
  assert.strictEqual(last.facts.length, 0,
    'the last turn is meant to show a question being correctly ignored');
})();

/* ================= 9. the analytics checks catch what they claim ================= */
(() => {
  const tickets = makeTickets(C.ticketSeed, C.ticketCount);
  assert.strictEqual(tickets.length, C.ticketCount);

  C.dfAsks.forEach(a => {
    const res = df.runAsk(a.kind, tickets);
    const checks = df.checkResult(res.rows, res.cols, tickets.length);
    const ok = checks.every(c => c.passed);

    if (a.id === 'bad') {
      assert(!ok, 'the deliberately broken ask must fail its checks — that is the whole lesson');
      assert(checks.some(c => !c.passed && /in range/.test(c.name)),
        'the broken ask should fail the range check specifically');
    } else {
      assert(ok, `ask "${a.label}" failed a check it should pass: ` +
        JSON.stringify(checks.filter(c => !c.passed)));
    }

    // every ask must render something, or the chapter shows an empty panel
    assert(res.rows.length > 0, `ask "${a.label}" returned no rows`);
    assert(res.cols.length >= 2, `ask "${a.label}" has nothing to plot`);
  });

  // the share query must genuinely sum to 100, not merely pass a loose check
  const share = df.runAsk('share', tickets);
  const total = share.rows.reduce((a, r) => a + r.share_pct, 0);
  assert(Math.abs(total - 100) < 0.5, `shares sum to ${total}`);

  // counts must tie back exactly for a full partition
  const vol = df.runAsk('volume', tickets);
  assert.strictEqual(vol.rows.reduce((a, r) => a + r.tickets, 0), tickets.length,
    'ticket volume by category must account for every ticket');

  // every SQL string shown on the page must survive the validator it describes
  C.dfAsks.forEach(a => {
    assert(validateSql(a.sql).ok, `the SQL shown for "${a.label}" would be refused by the validator`);
  });
})();

/* ================= 10. the page's own consistency ================= */
C.quiz.forEach((q, i) => assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`));
assert(C.quiz.length >= 12, 'the quiz got thin');

const html = fs.readFileSync('index.html', 'utf8');
const demos = fs.readFileSync('js/demos.js', 'utf8');
const ids = new Set();
for (const m of demos.matchAll(/\$\$?\('#([a-z0-9-]+)/g)) if (!m[1].endsWith('-')) ids.add(m[1]);
ids.forEach(id => assert(html.includes('id="' + id + '"') || demos.includes('id="' + id + '"'),
  `demos.js targets #${id}, which nothing ever creates`));

// every chapter needs the attributes app.js builds the nav from
const chapters = [...html.matchAll(/<section class="chapter"([^>]*)>/g)].map(m => m[1]);
assert(chapters.length >= 15, `expected the full walkthrough, found ${chapters.length} chapters`);
chapters.forEach((attrs, i) => {
  ['data-id', 'data-title', 'data-icon', 'data-group'].forEach(a =>
    assert(attrs.includes(a), `chapter ${i} is missing ${a}`));
});

// a code tab that references a file the projects do not have is a lie
[['../refund-agent', C.refundCode], ['../support-platform', C.supportCode]].forEach(([dir]) => {
  assert(fs.existsSync(path.join(__dirname, dir)), `${dir} is missing — the walkthrough describes nothing`);
});
C.fileMap.forEach(p => p.files.forEach(f => {
  const rel = path.join(__dirname, '..', p.project, f[0].replace(/\/$/, ''));
  assert(fs.existsSync(rel), `file map points at ${p.project}/${f[0]}, which does not exist`);
}));

console.log('ok — the page and the Python agree');
console.log('   ' + T.policy.length + ' policy cases · ' + T.retrieval.length + ' retrieval probes · ' +
            T.sql.length + ' sql probes · ' + T.evals.length + ' tenant evals');
