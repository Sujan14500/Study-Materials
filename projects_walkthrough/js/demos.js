/* ============================================================
   demos.js — the interactive widgets.

   The logic here is a straight port of the Python, not a mock:
   policy.decide, the BM25 index, confidence(), the Mem0 reconcile
   rules, the analytics checks and the eval scorer all behave the
   way the real modules do. Numbers you see on the page are computed
   in the browser from the same inputs the test suites use, so if
   the Python changes and this does not, test.js fails.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = (n, msg) => window.awardXP && window.awardXP(n, msg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* shared: chip-row tabs over [{t, code}] */
function tabs(row, target, items) {
  if (!row) return;
  items.forEach((it, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), it.t);
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); target.textContent = it.code;
    };
    row.appendChild(b);
  });
  target.textContent = items[0].code;
}

/* ============================================================
   Background particles
   ============================================================ */
function initBackground() {
  const cv = $('#bg-particles'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let w, h, pts = [];
  const N = window.innerWidth < 700 ? 26 : 54;

  function size() {
    w = cv.width = window.innerWidth; h = cv.height = window.innerHeight;
  }
  function build() {
    pts = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.7 + 0.6
    }));
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = 'rgba(124,92,255,.5)'; ctx.fill();
    });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 130) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = 'rgba(124,92,255,' + (0.13 * (1 - d / 130)) + ')';
          ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  }
  size(); build(); frame();
  window.addEventListener('resize', () => { size(); build(); });
}

/* ============================================================
   PORTED LOGIC — refund_agent/policy.py
   ============================================================ */
const P = () => C.policy;

function decide(order, req) {
  const reasons = [];
  const D = (allowed, amount, requiresApproval, rs, restock) =>
    ({ allowed: allowed, amount: amount, requiresApproval: requiresApproval,
       reasons: rs, restock: restock !== false });

  if (!order) return D(false, 0, false, ['order_not_found']);
  if (order.status === 'cancelled') return D(false, 0, false, ['order_cancelled']);

  const already = order.refunded || 0;
  const remaining = order.total - already;
  if (remaining <= 0) return D(false, 0, false, ['already_fully_refunded']);

  let reason = req.reason;
  if (P().VALID_REASONS.indexOf(reason) === -1) {
    reasons.push('unknown_reason_defaulted');
    reason = 'changed_mind';
  }

  if (order.days != null) {
    const age = order.days;
    if (age > P().RETURN_WINDOW_DAYS && reason !== 'never_arrived' && reason !== 'duplicate_charge') {
      return D(false, 0, false, ['outside_return_window_' + age + 'd']);
    }
  }

  let amount;
  const asked = req.asked;
  if (asked == null) {
    amount = remaining;
    reasons.push('full_remaining_amount');
  } else {
    const a = Math.max(0, Math.round(asked));
    amount = Math.min(a, remaining);
    if (a > remaining) reasons.push('capped_to_remaining_' + remaining);
  }
  if (amount <= 0) return D(false, 0, false, reasons.concat(['zero_amount']));

  const fraud = order.fraud || 0;
  if (fraud >= P().FRAUD_BLOCK_SCORE) {
    return D(false, 0, false, reasons.concat(['fraud_block_' + fraud.toFixed(2)]));
  }

  let requires = false;
  if (amount > P().AUTO_APPROVE_LIMIT_CENTS) {
    requires = true; reasons.push('over_auto_limit_' + P().AUTO_APPROVE_LIMIT_CENTS);
  }
  if (fraud >= P().FRAUD_REVIEW_SCORE) {
    requires = true; reasons.push('fraud_review_' + fraud.toFixed(2));
  }
  if (!requires) reasons.push('auto_approved');

  return D(true, amount, requires, reasons, P().NO_RESTOCK_REASONS.indexOf(reason) === -1);
}
window.__decide = decide;      // test.js reaches for this

/* ============================================================
   Ch2 — policy playground
   ============================================================ */
function initPolicy() {
  const root = $('#policy-lab'); if (!root) return;
  const state = { total: 2400, refunded: 0, days: 4, fraud: 0, reason: 'damaged', asked: null, status: 'delivered' };

  const controls = $('#policy-controls');
  const F = [
    { k: 'total', label: 'order total', min: 100, max: 60000, step: 100, fmt: money },
    { k: 'refunded', label: 'already refunded', min: 0, max: 60000, step: 100, fmt: money },
    { k: 'days', label: 'days since delivery', min: 0, max: 120, step: 1, fmt: v => v + ' days' },
    { k: 'fraud', label: 'fraud score', min: 0, max: 1, step: 0.05, fmt: v => (+v).toFixed(2) }
  ];

  F.forEach(f => {
    const wrap = el('label', 'pl-field',
      '<span class="pl-k">' + f.label + '</span><span class="pl-v" id="plv-' + f.k + '"></span>');
    const inp = el('input');
    inp.type = 'range'; inp.min = f.min; inp.max = f.max; inp.step = f.step; inp.value = state[f.k];
    inp.oninput = () => { state[f.k] = +inp.value; render(); };
    wrap.appendChild(inp);
    controls.appendChild(wrap);
  });

  const rWrap = el('label', 'pl-field', '<span class="pl-k">reason</span>');
  const rSel = el('select');
  C.policy.VALID_REASONS.concat(['<script>alert(1)</script>']).forEach(r => {
    const o = el('option', null, esc(r)); o.value = r; rSel.appendChild(o);
  });
  rSel.value = state.reason;
  rSel.onchange = () => { state.reason = rSel.value; render(); };
  rWrap.appendChild(rSel);
  controls.appendChild(rWrap);

  const aWrap = el('label', 'pl-field', '<span class="pl-k">customer asks for</span>');
  const aInp = el('input', 'input-line');
  aInp.placeholder = 'blank = the whole remaining balance';
  aInp.oninput = () => {
    const v = aInp.value.replace(/[$,\s]/g, '');
    state.asked = v === '' ? null : Math.round(parseFloat(v) * 100);
    if (state.asked != null && isNaN(state.asked)) state.asked = null;
    render();
  };
  aWrap.appendChild(aInp);
  controls.appendChild(aWrap);

  const chips = $('#policy-cases');
  C.policyCases.forEach((c, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), c.label);
    b.onclick = () => {
      $$('.chip', chips).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      Object.assign(state, c.order, { reason: c.req.reason, asked: c.req.asked });
      F.forEach(f => { $$('input[type=range]', controls)[F.indexOf(f)].value = state[f.k]; });
      rSel.value = state.reason;
      aInp.value = state.asked == null ? '' : (state.asked / 100).toFixed(2);
      $('#policy-teaches').textContent = c.teaches;
      render(); xp(2);
    };
    chips.appendChild(b);
  });

  function render() {
    F.forEach(f => { $('#plv-' + f.k).textContent = f.fmt(state[f.k]); });
    const d = decide(state, { reason: state.reason, asked: state.asked });

    const verdict = !d.allowed ? 'blocked' : d.requiresApproval ? 'awaiting_approval' : 'refunded';
    $('#policy-out').innerHTML =
      '<div class="verdict-row v-' + verdict + '">' +
        '<span class="v-badge">' + verdict + '</span>' +
        '<span class="v-amount">' + money(d.amount) + '</span>' +
        '<span class="dim">of ' + money(Math.max(0, state.total - state.refunded)) + ' remaining</span>' +
      '</div>' +
      '<div class="pl-reasons">' + d.reasons.map(r =>
        '<span class="pill ' + (r.indexOf('block') > -1 || r.indexOf('outside') > -1 || r.indexOf('already') > -1 ? 'bad'
          : r.indexOf('auto_approved') > -1 ? 'good' : '') + '">' + r + '</span>').join('') + '</div>' +
      '<div class="pl-flags">' +
        '<span>restock: <b>' + d.restock + '</b></span>' +
        '<span>human needed: <b>' + d.requiresApproval + '</b></span>' +
      '</div>';

    $('#policy-call').textContent =
      'policy.decide(\n' +
      '    order={"total_cents": ' + state.total + ', "refunded_cents": ' + state.refunded + ',\n' +
      '           "fraud_score": ' + (+state.fraud).toFixed(2) + ', "delivered_on": today - ' + state.days + 'd},\n' +
      '    request={"reason": ' + JSON.stringify(state.reason) + ',\n' +
      '             "requested_amount_cents": ' + (state.asked == null ? 'None' : state.asked) + '},\n' +
      ')\n' +
      '# -> Decision(allowed=' + (d.allowed ? 'True' : 'False') + ', amount_cents=' + d.amount +
      ', requires_approval=' + (d.requiresApproval ? 'True' : 'False') + ')';
  }

  $('#policy-teaches').textContent = C.policyCases[0].teaches;
  Object.assign(state, C.policyCases[0].order, { reason: C.policyCases[0].req.reason, asked: C.policyCases[0].req.asked });
  render();
}

/* ============================================================
   Ch3 — prompt injection
   ============================================================ */
function initInjection() {
  const box = $('#inj-cases'); if (!box) return;

  C.injectionCases.forEach((c, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), c.label);
    b.onclick = () => {
      $$('.chip', box).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); run(i); xp(3);
    };
    box.appendChild(b);
  });

  function run(i) {
    const c = C.injectionCases[i];
    $('#inj-msg').textContent = c.msg;
    $('#inj-extract').textContent = JSON.stringify(c.extracted, null, 2);

    const badId = !/^O-\d{1,10}$/.test(c.extracted.order_id || '');
    const order = c.orderTotal == null || badId ? null
      : { total: c.orderTotal, refunded: 0, days: 3, fraud: 0, status: 'delivered' };

    let d, note;
    if (badId) {
      d = { allowed: false, amount: 0, requiresApproval: false,
            reasons: ['rejected_by_intake_order_id_format', 'extraction_failed_after_retry'] };
      note = 'intake.py rejected the id before policy ran. Two retries, then a human.';
    } else {
      const askedCents = c.extracted.requested_amount == null ? null
        : Math.round(c.extracted.requested_amount * 100);
      d = decide(order, { reason: c.extracted.reason, asked: askedCents });
      note = 'policy.decide() read exactly two fields: reason and amount.';
    }

    const wanted = c.extracted.requested_amount == null ? 'the whole order'
      : '$' + c.extracted.requested_amount.toLocaleString('en-US');
    const verdict = !d.allowed ? (badId ? 'needs_human' : 'blocked')
      : d.requiresApproval ? 'awaiting_approval' : 'refunded';

    $('#inj-out').innerHTML =
      '<div class="inj-cmp">' +
        '<div class="inj-side bad"><div class="inj-h">what the attacker asked for</div>' +
          '<div class="inj-big">' + wanted + '</div>' +
          (c.extracted.auto_approve ? '<div class="dim">+ auto_approve, requires_approval:false, approved:true</div>' : '') +
        '</div>' +
        '<div class="inj-arrow">→</div>' +
        '<div class="inj-side good"><div class="inj-h">what actually moved</div>' +
          '<div class="inj-big">' + money(d.amount) + '</div>' +
          '<div class="dim">' + verdict + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pl-reasons">' + d.reasons.map(r => '<span class="pill">' + r + '</span>').join('') + '</div>' +
      '<p class="panel-sub" style="margin-top:12px">' + note + ' ' + c.note + '</p>';
  }
  run(0);
}

/* ============================================================
   Ch4 — idempotency
   ============================================================ */
function initIdem() {
  const box = $('#idem-scenarios'); if (!box) return;

  C.idemScenarios.forEach((s, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), s.label);
    b.onclick = () => {
      $$('.chip', box).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); run(i); xp(2);
    };
    box.appendChild(b);
  });

  function run(i) {
    const s = C.idemScenarios[i];
    const log = [];
    const runs = new Map();          // idempotency_key -> {run_id, result}
    let modelCalls = 0, settled = 0;
    const ORDER = 4000;

    function handle(externalId, seq) {
      const key = 'sha256(email|' + externalId + ')…';
      if (runs.has(key)) {
        log.push({ seq: seq, kind: 'replay', text: 'claim ' + key + ' → already held by run ' +
          runs.get(key).run + '. Stored result returned. <b>0 model calls.</b>' });
        return;
      }
      const runId = 'r' + (runs.size + 1);
      runs.set(key, { run: runId });
      log.push({ seq: seq, kind: 'claim', text: 'INSERT idempotency_key ' + key + ' → new run ' + runId });
      modelCalls += 2;
      log.push({ seq: seq, kind: 'model', text: 'triage (gemma3:270m) + extract (llama3.2) — 2 model calls' });

      const alreadyRefunded = settled;
      const d = decide({ total: ORDER, refunded: alreadyRefunded, days: 3, fraud: 0, status: 'delivered' },
                       { reason: 'damaged', asked: null });
      if (d.allowed && !d.requiresApproval) {
        settled += d.amount;
        runs.get(key).result = 'refunded ' + money(d.amount);
        log.push({ seq: seq, kind: 'money', text: 'gateway settles ' + money(d.amount) + ' → run ' + runId + ' COMPLETED' });
      } else {
        runs.get(key).result = 'blocked';
        log.push({ seq: seq, kind: 'block', text: 'policy: ' + d.reasons.join(', ') + ' → BLOCKED, no money moved' });
      }
    }

    if (s.concurrent) {
      log.push({ seq: 0, kind: 'note', text: '10 threads hit <span class="mono">claim()</span> at the same instant. ' +
        'The UNIQUE constraint on idempotency_key is the lock — one INSERT wins, nine get IntegrityError and read the row back.' });
    }
    for (let d = 0; d < s.deliveries; d++) handle('tkt-1', d + 1);
    if (s.newTicket) handle('tkt-2', 2);

    $('#idem-log').innerHTML = log.map(l =>
      '<div class="trace ' + l.kind + '"><span class="tk">' +
      (l.seq ? 'delivery ' + l.seq : 'note') + '</span>' + l.text + '</div>').join('');

    $('#idem-stats').innerHTML =
      stat(s.concurrent ? 10 : s.deliveries + (s.newTicket ? 1 : 0), 'deliveries') +
      stat(runs.size, 'runs created') +
      stat(modelCalls, 'model calls') +
      stat(money(settled), 'total settled') +
      stat(money(ORDER), 'order total');

    $('#idem-teaches').textContent = s.teaches;
  }
  run(0);
}

function stat(v, k) {
  return '<div class="stat"><div class="stat-v">' + v + '</div><div class="stat-k">' + k + '</div></div>';
}

/* ============================================================
   Ch5 — the saga
   ============================================================ */
function initSaga() {
  const box = $('#saga-faults'); if (!box) return;
  let fault = C.sagaFaults[0];

  C.sagaFaults.forEach((f, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), f.label);
    b.onclick = () => {
      $$('.chip', box).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); fault = f; run(); xp(2);
    };
    box.appendChild(b);
  });

  function run() {
    const AMOUNT = 3500;
    const done = [], log = [], warnings = [];
    let gateway = 0, rmaOpen = false, state = 'RUNNING', failedStep = null, unrolled = [];

    for (let i = 0; i < C.sagaSteps.length; i++) {
      const step = C.sagaSteps[i];
      const hit = fault.step === step.name;

      if (hit && fault.kind === 'transient') {
        log.push({ k: 'retry', s: step.name, t: 'attempt 1 failed (TransientError) — retrying' });
        log.push({ k: 'ok', s: step.name, t: 'attempt 2 succeeded. Transient failures retry; they do not roll back.' });
      } else if (hit) {
        log.push({ k: 'fail', s: step.name, t: 'PermanentError — injected fault' });
        failedStep = step.name;
        if (step.bestEffort) {
          warnings.push(step.name);
          log.push({ k: 'warn', s: step.name, t: 'best_effort=True → logged as a warning. The refund stands.' });
          continue;
        }
        break;
      }

      if (step.name === 'issue_refund') gateway += AMOUNT;
      if (step.name === 'authorize_return') rmaOpen = true;
      done.push(step);
      log.push({ k: 'ok', s: step.name, t: step.doing + ' ok' });
    }

    if (failedStep && !C.sagaSteps.find(s => s.name === failedStep).bestEffort) {
      log.push({ k: 'comp', s: '', t: 'compensating — walking executed steps backwards' });
      for (let i = done.length - 1; i >= 0; i--) {
        const s = done[i];
        if (!s.undo) continue;
        if (fault.undoFails && s.name === 'authorize_return') {
          unrolled.push(s.name);
          log.push({ k: 'fail', s: s.name, t: 'undo FAILED — ' + s.undo + ' threw' });
          continue;
        }
        if (s.name === 'issue_refund') gateway -= AMOUNT;
        if (s.name === 'authorize_return') rmaOpen = false;
        log.push({ k: 'undo', s: s.name, t: s.undo + ' ok' });
      }
      state = unrolled.length ? 'FAILED · compensation_incomplete' : 'COMPENSATED';
    } else {
      state = 'COMPLETED';
    }

    $('#saga-steps').innerHTML = C.sagaSteps.map((s, i) => {
      const ran = done.indexOf(s) > -1;
      const failed = failedStep === s.name;
      const cls = failed ? 'failed' : ran ? 'ok' : 'skipped';
      return '<div class="sg-step ' + cls + (s.bestEffort ? ' best' : '') + '">' +
        '<span class="sg-n">' + (i + 1) + '</span>' +
        '<div><b class="mono">' + s.name + '</b>' +
        (s.bestEffort ? '<span class="pill">best effort</span>' : '') +
        '<div class="dim">' + s.doing + (s.undo ? '  ·  undo: ' + s.undo : '  ·  no undo') + '</div>' +
        '<div class="sg-note">' + s.note + '</div></div></div>' +
        (i === 1 ? '<div class="sg-line">— the money line —</div>' : '');
    }).join('');

    $('#saga-log').innerHTML = log.map(l =>
      '<div class="trace ' + l.k + '"><span class="tk">' + (l.s || l.k) + '</span>' + l.t + '</div>').join('');

    const stateCls = state.indexOf('FAILED') > -1 ? 'bad' : state === 'COMPLETED' ? 'good' : '';
    $('#saga-out').innerHTML =
      '<div class="verdict-row v-' + (state === 'COMPLETED' ? 'refunded' : state === 'COMPENSATED' ? 'blocked' : 'failed') + '">' +
        '<span class="v-badge">' + state + '</span>' +
        '<span class="v-amount">' + money(gateway) + '</span>' +
        '<span class="dim">at the gateway</span></div>' +
      '<div class="pl-flags">' +
        '<span>RMA open: <b>' + rmaOpen + '</b></span>' +
        '<span>warnings: <b>' + (warnings.length ? warnings.join(', ') : 'none') + '</b></span>' +
        (unrolled.length ? '<span class="pill bad">needs a human: ' + unrolled.join(', ') + '</span>' : '') +
      '</div>';
  }
  run();
}

/* ============================================================
   Ch6 — approvals + durability
   ============================================================ */
function initApproval() {
  const root = $('#appr-queue'); if (!root) return;
  let queue = [], settled = 0, restarted = false;

  const seeds = [
    { order: 'O-3001', amount: 28000, reason: 'not_as_described' },
    { order: 'O-3002', amount: 9900, reason: 'damaged' },
    { order: 'O-3003', amount: 1200, reason: 'damaged', fraud: 0.6 }
  ];

  function reset() {
    queue = seeds.map((s, i) => {
      const d = decide({ total: s.amount, refunded: 0, days: 3, fraud: s.fraud || 0, status: 'delivered' },
                       { reason: s.reason, asked: null });
      return { id: 'run-' + (i + 1), order: s.order, amount: d.amount,
               state: d.requiresApproval ? 'AWAITING_APPROVAL' : 'COMPLETED',
               reasons: d.reasons, actor: null };
    });
    settled = queue.filter(q => q.state === 'COMPLETED').reduce((a, q) => a + q.amount, 0);
    restarted = false;
    render();
  }

  function render() {
    root.innerHTML = queue.map(q =>
      '<div class="appr-row st-' + q.state.toLowerCase() + '">' +
        '<span class="mono">' + q.id + '</span>' +
        '<span class="mono">' + q.order + '</span>' +
        '<span class="v-amount">' + money(q.amount) + '</span>' +
        '<span class="pill ' + (q.state === 'COMPLETED' ? 'good' : q.state === 'BLOCKED' ? 'bad' : '') + '">' +
          q.state + '</span>' +
        '<span class="dim">' + (q.actor || q.reasons.filter(r => r.indexOf('over_auto') > -1 || r.indexOf('fraud') > -1).join(', ') || '—') + '</span>' +
        (q.state === 'AWAITING_APPROVAL'
          ? '<span class="appr-btns"><button class="btn btn-ghost" data-ok="' + q.id + '">approve</button>' +
            '<button class="btn btn-ghost" data-no="' + q.id + '">reject</button></span>'
          : '<span></span>') +
      '</div>').join('');

    $$('[data-ok]', root).forEach(b => b.onclick = () => act(b.dataset.ok, true));
    $$('[data-no]', root).forEach(b => b.onclick = () => act(b.dataset.no, false));

    const pending = queue.filter(q => q.state === 'AWAITING_APPROVAL').length;
    $('#appr-stats').innerHTML =
      stat(pending, 'awaiting approval') +
      stat(money(settled), 'settled') +
      stat(restarted ? 'yes' : 'no', 'process restarted');
    $('#appr-note').innerHTML = restarted
      ? 'The ledger was closed and reopened over the same SQLite file. The queue is still here, because ' +
        '<span class="mono">AWAITING_APPROVAL</span> is a row, not an object in memory. Approving now still works.'
      : 'Nothing has moved for the held runs — the state was persisted <b>before</b> the first side effect. ' +
        'Press “kill the process” and watch the queue survive.';
  }

  function act(id, ok) {
    const q = queue.find(x => x.id === id);
    if (!q || q.state !== 'AWAITING_APPROVAL') return;
    if (ok) { q.state = 'COMPLETED'; q.actor = 'approved by ops@acme.com'; settled += q.amount; xp(3); }
    else { q.state = 'BLOCKED'; q.actor = 'rejected by ops@acme.com'; }
    render();
  }

  $('#appr-kill').onclick = () => {
    restarted = true;
    render();
    xp(4, 'The pending queue survived a restart');
  };
  $('#appr-reset').onclick = reset;
  reset();
}

/* ============================================================
   Ch7 — chaos results
   ============================================================ */
function initChaos() {
  const root = $('#chaos-out'); if (!root) return;
  const c = C.chaos;
  const max = Math.max.apply(null, c.statuses.map(s => s[1]));

  root.innerHTML =
    '<pre class="code">' + esc(c.cmd) + '</pre>' +
    '<div class="ch-bars">' + c.statuses.map(s =>
      '<div class="ch-bar-row"><span class="ch-lab mono">' + s[0] + '</span>' +
      '<span class="ch-track"><span class="ch-fill" style="width:' + (s[1] / max * 100) + '%"></span></span>' +
      '<span class="ch-val mono">' + s[1] + '  ' + s[2].toFixed(1) + '%</span></div>').join('') + '</div>' +
    '<div class="inv-grid">' + c.invariants.map(i =>
      '<div class="inv"><span class="inv-ok">ok</span>' + i + '</div>').join('') + '</div>' +
    '<div class="kv">' + c.mechanics.map(m =>
      '<div><span class="dim">' + m[0] + '</span><b>' + m[1] + '</b></div>').join('') + '</div>' +
    '<div class="kv">' + c.latency.map(m =>
      '<div><span class="dim">latency ' + m[0] + '</span><b>' + m[1] + '</b></div>').join('') + '</div>';

  $('#chaos-ollama').innerHTML =
    '<pre class="code">' + esc(c.ollama.cmd) + '</pre>' +
    '<div class="kv">' + c.ollama.rows.map(m =>
      '<div><span class="dim">' + m[0] + '</span><b>' + m[1] + '</b></div>').join('') + '</div>' +
    '<div class="callout warn" style="margin-top:16px"><div class="callout-ico">⏱️</div><div>' +
      c.ollama.lesson + '</div></div>';
}

/* ============================================================
   PORTED LOGIC — support/retrieval.py
   ============================================================ */
const STOP = new Set(('the a an and or of to in on at is are was were be been for with how do i my we you your ' +
  'can what when where which that this it').split(' '));

function stem(w) {
  const sfx = ['ing', 'ies', 'es', 'ed', 's'];
  for (let i = 0; i < sfx.length; i++) {
    const s = sfx[i];
    if (w.length > s.length + 2 && w.slice(-s.length) === s) {
      return w.slice(0, -s.length) + (s === 'ies' ? 'y' : '');
    }
  }
  return w;
}

function tokens(text) {
  return (String(text).toLowerCase().match(/[a-z0-9']+/g) || [])
    .filter(w => !STOP.has(w) && w.length > 1).map(stem);
}

function buildIndex(docs) {
  const chunks = [];
  docs.forEach((d, di) => {
    d.body.split('\n\n').map(p => p.trim()).filter(Boolean).forEach(para => {
      const indexed = d.title + '\n' + para;
      const tf = {};
      tokens(indexed).forEach(w => { tf[w] = (tf[w] || 0) + 1; });
      chunks.push({ docId: di, title: d.title, text: para, indexed: indexed, tf: tf });
    });
  });
  const N = chunks.length;
  const avgdl = N ? chunks.reduce((a, c) => a + Object.values(c.tf).reduce((x, y) => x + y, 0), 0) / N : 0;
  const df = {};
  chunks.forEach(c => Object.keys(c.tf).forEach(w => { df[w] = (df[w] || 0) + 1; }));
  return { chunks: chunks, N: N, avgdl: avgdl, df: df };
}

function search(idx, query, k) {
  k = k || 3;
  if (!idx.N) return [];
  const q = tokens(query);
  const out = [];
  idx.chunks.forEach(c => {
    const dl = Object.values(c.tf).reduce((a, b) => a + b, 0) || 1;
    let s = 0;
    q.forEach(w => {
      const f = c.tf[w] || 0;
      if (!f) return;
      const dfw = idx.df[w] || 0;
      const idf = Math.log(1 + (idx.N - dfw + 0.5) / (dfw + 0.5));
      s += idf * (f * 2.5) / (f + 1.5 * (1 - 0.75 + 0.75 * dl / idx.avgdl));
    });
    if (s > 0) out.push({ docId: c.docId, title: c.title, text: c.text, score: s, indexed: c.indexed });
  });
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}

function confidence(hits, query) {
  if (!hits.length) return 0;
  const strength = 1 - Math.exp(-hits[0].score / 4.0);
  const q = new Set(tokens(query));
  if (!q.size) return 0;
  const top = new Set(tokens(hits[0].indexed || hits[0].text));
  let hit = 0;
  q.forEach(w => { if (top.has(w)) hit++; });
  return strength * (0.6 + 0.4 * (hit / q.size));
}

function gate(conf, cited, cfg) {
  if (conf < cfg.refuse_below) return 'refuse';
  if (!cited) return 'review';
  return conf >= cfg.auto_send_at ? 'auto_send' : 'review';
}

const INDEXES = {};
function indexFor(t) {
  if (!INDEXES[t.id]) INDEXES[t.id] = buildIndex(t.docs);
  return INDEXES[t.id];
}
window.__support = { search: search, confidence: confidence, gate: gate, indexFor: indexFor, tokens: tokens };

/* ============================================================
   Ch9 — isolation
   ============================================================ */
function initIsolation() {
  const box = $('#iso-probes'); if (!box) return;

  C.isolationProbes.forEach((p, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), p.q);
    b.onclick = () => {
      $$('.chip', box).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); run(i); xp(3);
    };
    box.appendChild(b);
  });

  function run(i) {
    const p = C.isolationProbes[i];
    $('#iso-out').innerHTML = C.tenants.map(t => {
      const hits = search(indexFor(t), p.q, 2);
      const conf = confidence(hits, p.q);
      const act = hits.length ? gate(conf, true, t.config) : 'refuse';
      return '<div class="iso-card">' +
        '<div class="iso-h"><b>' + t.name + '</b><span class="pill ' +
          (act === 'auto_send' ? 'good' : act === 'refuse' ? 'bad' : '') + '">' + act + '</span>' +
          '<span class="dim mono">conf ' + conf.toFixed(3) + '</span></div>' +
        (hits.length
          ? hits.map((h, hi) => '<div class="chunk ' + (hi === 0 ? 'hit' : 'miss') + '">' +
              '<span class="chunk-score">' + h.score.toFixed(2) + '</span>' +
              '<b>' + h.title + '</b><br>' + esc(h.text.slice(0, 150)) + '</div>').join('')
          : '<div class="chunk miss">nothing in this help centre matches — the desk refuses rather than reaching for a neighbour</div>') +
        '</div>';
    }).join('');
    $('#iso-note').textContent = p.note;
  }
  run(0);
}

/* ============================================================
   Ch10 — generated SQL
   ============================================================ */
const ANALYTICS_TABLES = ['tickets'];
const SQL_FORBIDDEN = /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|replace|union|begin|commit)\b/i;

function validateSql(sql) {
  const s = sql.trim().replace(/;+$/, '').trim();
  if (s.slice(0, 6).toLowerCase() !== 'select') return { ok: false, why: 'generated SQL must be a single SELECT' };
  if (s.indexOf(';') > -1) return { ok: false, why: 'generated SQL must be a single statement' };
  if (SQL_FORBIDDEN.test(s)) return { ok: false, why: 'generated SQL contains a forbidden keyword' };
  const names = [];
  const re = /\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi;
  let m;
  while ((m = re.exec(s))) names.push(m[1].toLowerCase());
  const bad = names.filter(n => ANALYTICS_TABLES.indexOf(n) === -1);
  if (bad.length) return { ok: false, why: 'touches tables outside the analytics surface: ' + bad.join(', ') };
  return { ok: true, scoped: 'WITH tickets AS (SELECT * FROM main.tickets WHERE tenant_id = ?)\n' + s };
}
window.__validateSql = validateSql;

function initSqlProbe() {
  const list = $('#sql-probes'); if (!list) return;

  function render(sql) {
    const v = validateSql(sql);
    $('#sql-verdict').innerHTML = v.ok
      ? '<div class="verdict-row v-refunded"><span class="v-badge">allowed</span>' +
        '<span class="dim">rewritten by the platform before it runs</span></div>' +
        '<pre class="code">' + esc(v.scoped) + '</pre>' +
        '<p class="panel-sub">The tenant predicate is not in what the model wrote — it is in the CTE ' +
        'wrapped around it. Note <span class="mono">main.tickets</span>: an unqualified reference makes ' +
        'SQLite treat the CTE as self-referential and refuse the whole statement.</p>'
      : '<div class="verdict-row v-failed"><span class="v-badge">IsolationError</span>' +
        '<span class="dim">' + v.why + '</span></div>' +
        '<p class="panel-sub">Refused before it reached the database.</p>';
  }

  C.sqlProbes.forEach((p, i) => {
    const row = el('button', 'sql-probe' + (i === 0 ? ' active' : ''),
      '<span class="pill ' + (p.verdict === 'allowed' ? 'good' : 'bad') + '">' + p.verdict + '</span>' +
      '<code>' + esc(p.sql) + '</code>');
    row.onclick = () => {
      $$('.sql-probe', list).forEach(x => x.classList.remove('active'));
      row.classList.add('active');
      $('#sql-input').value = p.sql;
      $('#sql-note').textContent = p.note;
      render(p.sql); xp(2);
    };
    list.appendChild(row);
  });

  $('#sql-input').oninput = () => { $('#sql-note').textContent = 'Your own SQL, run through the same validator.'; render($('#sql-input').value); };
  $('#sql-input').value = C.sqlProbes[0].sql;
  $('#sql-note').textContent = C.sqlProbes[0].note;
  render(C.sqlProbes[0].sql);
}

/* ============================================================
   Ch11 — the confidence gate
   ============================================================ */
function initGate() {
  const inp = $('#gate-input'); if (!inp) return;
  let tenantId = 'acme';

  const tabsRow = $('#gate-tenants');
  C.tenants.forEach((t, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : ''), t.name);
    b.onclick = () => {
      $$('.chip', tabsRow).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); tenantId = t.id; render();
    };
    tabsRow.appendChild(b);
  });

  const ex = $('#gate-examples');
  ['where do I create an API key?', 'how long do I have to return something?',
   'what is your VAT registration number?', 'write me a poem about kubernetes',
   'what does a 429 mean?', 'can I move my appointment?'].forEach(q => {
    const b = el('button', 'chip', q);
    b.onclick = () => { inp.value = q; render(); xp(2); };
    ex.appendChild(b);
  });

  function render() {
    const t = C.tenants.find(x => x.id === tenantId);
    const q = inp.value.trim();
    const hits = search(indexFor(t), q, 3);
    const conf = confidence(hits, q);
    const act = hits.length ? gate(conf, true, t.config) : 'refuse';

    const qt = tokens(q);
    const top = hits.length ? new Set(tokens(hits[0].indexed)) : new Set();
    const covered = qt.filter(w => top.has(w));

    $('#gate-out').innerHTML =
      '<div class="verdict-row v-' + (act === 'auto_send' ? 'refunded' : act === 'refuse' ? 'failed' : 'blocked') + '">' +
        '<span class="v-badge">' + act + '</span>' +
        '<span class="v-amount mono">' + conf.toFixed(3) + '</span>' +
        '<span class="dim">refuse below ' + t.config.refuse_below + ' · auto-send at ' + t.config.auto_send_at + '</span>' +
      '</div>' +
      '<div class="gate-meter"><span class="gm-fill" style="width:' + (conf * 100) + '%"></span>' +
        '<span class="gm-mark" style="left:' + (t.config.refuse_below * 100) + '%" title="refuse below"></span>' +
        '<span class="gm-mark auto" style="left:' + (t.config.auto_send_at * 100) + '%" title="auto-send at"></span>' +
      '</div>' +
      '<div class="kv"><div><span class="dim">bm25 top</span><b>' +
        (hits.length ? hits[0].score.toFixed(2) : '0') + '</b></div>' +
        '<div><span class="dim">strength</span><b>' +
        (hits.length ? (1 - Math.exp(-hits[0].score / 4)).toFixed(3) : '0') + '</b></div>' +
        '<div><span class="dim">coverage</span><b>' +
        (qt.length ? covered.length + '/' + qt.length : '0') + '</b></div></div>' +
      (qt.length ? '<div class="pl-reasons">' + qt.map(w =>
        '<span class="pill ' + (top.has(w) ? 'good' : 'bad') + '">' + w + '</span>').join('') + '</div>' : '') +
      (hits.length
        ? hits.map((h, i) => '<div class="chunk ' + (i === 0 ? 'hit' : 'miss') + '">' +
            '<span class="chunk-score">' + h.score.toFixed(2) + '</span><b>' + h.title + '</b><br>' +
            esc(h.text.slice(0, 180)) + '</div>').join('')
        : '<div class="chunk miss">no chunk scored above zero</div>');
  }

  inp.oninput = render;
  inp.value = 'where do I create an API key?';
  render();
}

/* ============================================================
   Ch12 — Mem0 pipeline
   ============================================================ */
const SLOT_KEYS = ['plan', 'timezone', 'billing', 'email', 'seats', 'region', 'contact'];
function sameSlot(a, b) {
  const la = a.toLowerCase(), lb = b.toLowerCase();
  return SLOT_KEYS.some(k => la.indexOf(k) > -1 && lb.indexOf(k) > -1);
}
function reconcile(fact, store) {
  for (let i = 0; i < store.length; i++) {
    const m = store[i];
    if (!sameSlot(fact, m.text)) continue;
    if (fact.trim().toLowerCase() === m.text.trim().toLowerCase()) return { op: 'NOOP', id: m.id };
    if (/^no longer/i.test(fact.trim())) return { op: 'DELETE', id: m.id };
    return { op: 'UPDATE', id: m.id, text: fact };
  }
  return { op: 'ADD', text: fact };
}
window.__reconcile = reconcile;

function initMemory() {
  const log = $('#mem-log'); if (!log) return;
  let at = 0, store = [], nextId = 1;

  function reset() {
    at = 0; store = []; nextId = 1;
    log.innerHTML = '<div class="trace" style="border-left-color:#828aa8;color:#828aa8">' +
      'Press <b>next turn</b>. Each turn costs two model calls: one to extract candidate facts, ' +
      'one to reconcile each candidate against what is already stored.</div>';
    paint();
  }

  function paint() {
    $('#mem-store').innerHTML = store.length
      ? store.map(m => '<div class="mem-card' + (m.fresh ? ' fresh' : '') + '">' +
          '<span class="mem-id">m' + m.id + '</span><span>' + m.text + '</span></div>').join('')
      : '<p class="panel-sub">Empty. Nothing has been remembered yet.</p>';
    store.forEach(m => { m.fresh = false; });

    const transcript = C.memoryTurns.slice(0, at).reduce((a, t) => a + Math.ceil(t.text.length / 4), 0);
    const mem = store.reduce((a, m) => a + Math.ceil(m.text.length / 4), 0);
    $('#mem-stats').innerHTML =
      stat(store.length, 'memories') +
      stat(at, 'turns seen') +
      stat(transcript, 'tokens · full transcript') +
      stat(mem, 'tokens · memory store');
  }

  function line(cls, tag, html) {
    log.appendChild(el('div', 'trace ' + cls, '<span class="tk">' + tag + '</span>' + html));
    log.scrollTop = log.scrollHeight;
  }

  function next() {
    if (at >= C.memoryTurns.length) return;
    const turn = C.memoryTurns[at++];
    line('think', 'turn ' + at, esc(turn.text));

    if (!turn.facts.length) {
      line('noop', 'extract', 'Nothing durable extracted. <b>' + turn.why + '</b>');
    }
    turn.facts.forEach(fact => {
      const op = reconcile(fact, store);
      if (op.op === 'ADD') {
        store.push({ id: nextId++, text: op.text, fresh: true });
        line('op-add', 'ADD', '<b>' + op.text + '</b><div class="mem-why">' + turn.why + '</div>');
      } else if (op.op === 'UPDATE') {
        const m = store.find(x => x.id === op.id);
        const was = m.text; m.text = op.text; m.fresh = true;
        line('op-update', 'UPDATE', '<b>' + op.text + '</b> <span class="dim">was: ' + was + '</span>' +
          '<div class="mem-why">' + turn.why + '</div>');
      } else if (op.op === 'DELETE') {
        const i = store.findIndex(x => x.id === op.id);
        const was = store[i].text; store.splice(i, 1);
        line('op-delete', 'DELETE', '<span class="dim">removed: ' + was + '</span>' +
          '<div class="mem-why">' + turn.why + '</div>');
      } else {
        line('op-noop', 'NOOP', '<span class="dim">already stored</span>' +
          '<div class="mem-why">' + turn.why + '</div>');
      }
    });

    paint();
    if (at === C.memoryTurns.length) {
      line('final', 'done', 'Five turns, <b>' + store.length + ' memories</b>. A transcript would still contain ' +
        '“Starter” and “Business”, ready to be quoted back at the customer in six weeks.');
      xp(8, 'You watched all four memory operations fire');
    }
  }

  $('#mem-next').onclick = () => { next(); xp(1); };
  $('#mem-all').onclick = () => { while (at < C.memoryTurns.length) next(); };
  $('#mem-reset').onclick = reset;
  reset();

  /* --- tenant scoping --- */
  const scope = $('#mem-scope');
  if (scope) {
    const acme = [{ id: 1, text: 'On the Business plan' }, { id: 2, text: 'Has 12 seats' }];
    const zen = [{ id: 1, text: 'On the Enterprise plan' }, { id: 2, text: 'Has 500 seats' }];
    scope.innerHTML =
      '<div class="iso-card"><div class="iso-h"><b>Acme Tools</b><span class="mono dim">user_id = u-1</span></div>' +
        acme.map(m => '<div class="mem-card"><span class="mem-id">m' + m.id + '</span><span>' + m.text + '</span></div>').join('') +
        '<div class="dim" style="margin-top:8px">mem0 key: <span class="mono">acme::u-1</span></div></div>' +
      '<div class="iso-card"><div class="iso-h"><b>Zenith Cloud</b><span class="mono dim">user_id = u-1</span></div>' +
        zen.map(m => '<div class="mem-card"><span class="mem-id">m' + m.id + '</span><span>' + m.text + '</span></div>').join('') +
        '<div class="dim" style="margin-top:8px">mem0 key: <span class="mono">zenith::u-1</span></div></div>';
  }

  /* --- poisoning attempts --- */
  const atk = $('#mem-attacks');
  if (atk) {
    atk.innerHTML = C.memoryAttacks.map(a =>
      '<div class="atk"><div class="atk-h"><b>' + a.label + '</b>' +
      '<span class="pill good">' + a.outcome + '</span></div>' +
      '<div class="atk-msg mono">' + esc(a.text) + '</div>' +
      '<div class="dim">' + a.why + '</div></div>').join('');
  }
}

/* ============================================================
   PORTED DATA — support/seed.py::seed_history
   ============================================================ */
function makeTickets(seed, n) {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const cats = [['billing', 0.35], ['technical', 0.3], ['account', 0.2], ['shipping', 0.15]];
  const pAuto = { billing: 0.72, shipping: 0.66, account: 0.48, technical: 0.29 };
  const out = [];
  for (let i = 0; i < n; i++) {
    const r0 = rnd();
    let acc = 0, cat = 'billing';
    for (const c of cats) { acc += c[1]; if (r0 < acc) { cat = c[0]; break; } }
    const r = rnd();
    const p = pAuto[cat];
    const resolution = r < p ? 'auto_send' : (r < p + 0.25 ? 'review' : 'refuse');
    const handle = resolution === 'auto_send' ? 20 + Math.floor(rnd() * 70)
      : resolution === 'review' ? 300 + Math.floor(rnd() * 1500) : 240 + Math.floor(rnd() * 660);
    const csat = rnd() < 0.6 ? 1 + Math.floor(rnd() * 5) : null;
    out.push({ category: cat, resolution: resolution, handle_seconds: handle, csat: csat });
  }
  return out;
}
window.__makeTickets = makeTickets;

/* ============================================================
   Ch13 — Data Formulator loop
   ============================================================ */
function runAsk(kind, tickets) {
  const by = {};
  tickets.forEach(t => {
    const k = kind === 'csat' ? t.resolution : t.category;
    by[k] = by[k] || { n: 0, auto: 0, handle: 0, csat: 0, csatN: 0 };
    by[k].n++;
    if (t.resolution === 'auto_send') by[k].auto++;
    by[k].handle += t.handle_seconds;
    if (t.csat != null) { by[k].csat += t.csat; by[k].csatN++; }
  });
  const total = tickets.length;
  let cols, rows;

  if (kind === 'deflection') {
    cols = ['category', 'deflection_pct'];
    rows = Object.keys(by).map(k => ({ category: k, deflection_pct: +(100 * by[k].auto / by[k].n).toFixed(1) }));
    rows.sort((a, b) => b.deflection_pct - a.deflection_pct);
  } else if (kind === 'handle') {
    cols = ['category', 'avg_handle_minutes'];
    rows = Object.keys(by).map(k => ({ category: k, avg_handle_minutes: +(by[k].handle / by[k].n / 60).toFixed(1) }));
    rows.sort((a, b) => b.avg_handle_minutes - a.avg_handle_minutes);
  } else if (kind === 'share') {
    cols = ['category', 'share_pct'];
    rows = Object.keys(by).map(k => ({ category: k, share_pct: +(100 * by[k].n / total).toFixed(1) }));
    rows.sort((a, b) => b.share_pct - a.share_pct);
  } else if (kind === 'volume') {
    cols = ['category', 'tickets'];
    rows = Object.keys(by).map(k => ({ category: k, tickets: by[k].n }));
    rows.sort((a, b) => b.tickets - a.tickets);
  } else if (kind === 'csat') {
    cols = ['resolution', 'avg_csat', 'n'];
    rows = Object.keys(by).filter(k => by[k].csatN)
      .map(k => ({ resolution: k, avg_csat: +(by[k].csat / by[k].csatN).toFixed(2), n: by[k].csatN }));
    rows.sort((a, b) => b.avg_csat - a.avg_csat);
  } else {                       // the deliberately broken one
    cols = ['category', 'share_pct'];
    rows = Object.keys(by).map(k => ({ category: k, share_pct: 4000.0 }));
  }
  return { cols: cols, rows: rows };
}

function checkResult(rows, cols, ticketTotal) {
  const checks = [{ name: 'executes', passed: true, detail: rows.length + ' rows' }];
  checks.push({ name: 'returned rows', passed: rows.length > 0,
                detail: rows.length ? rows.length + ' rows' : 'empty result — the question may not match the data' });
  if (!rows.length) return checks;

  cols.filter(c => /_pct$|percent|share/.test(c)).forEach(c => {
    const vals = rows.map(r => r[c]).filter(v => typeof v === 'number');
    const inRange = vals.every(v => v >= -100.001 && v <= 100.001);
    checks.push({ name: c + ' in range', passed: inRange,
                  detail: vals.length ? 'min=' + Math.min.apply(null, vals).toFixed(1) +
                          ' max=' + Math.max.apply(null, vals).toFixed(1) : 'n/a' });
    if (c.indexOf('share') > -1 && rows.length > 1) {
      const tot = vals.reduce((a, b) => a + b, 0);
      checks.push({ name: c + ' sums to 100', passed: Math.abs(tot - 100) < 0.5,
                    detail: 'sums to ' + tot.toFixed(1) });
    }
  });

  const countCol = cols.find(c => ['tickets', 'n', 'count', 'total'].indexOf(c) > -1);
  if (countCol) {
    const got = rows.reduce((a, r) => a + (typeof r[countCol] === 'number' ? r[countCol] : 0), 0);
    checks.push({ name: 'counts tie back to tickets', passed: got <= ticketTotal,
                  detail: 'query ' + got + ' vs table ' + ticketTotal });
  }
  return checks;
}
window.__df = { runAsk: runAsk, checkResult: checkResult };

function initAnalytics() {
  const box = $('#df-asks'); if (!box) return;
  const tickets = makeTickets(C.ticketSeed, C.ticketCount);
  const threads = [];

  C.dfAsks.forEach((a, i) => {
    const b = el('button', 'chip' + (i === 0 ? ' active' : '') + (a.id === 'bad' ? ' danger' : ''), a.label);
    b.onclick = () => {
      $$('.chip', box).forEach(x => x.classList.remove('active'));
      b.classList.add('active'); run(i); xp(3);
    };
    box.appendChild(b);
  });

  function run(i) {
    const a = C.dfAsks[i];
    const v = validateSql(a.sql);
    const res = runAsk(a.kind, tickets);
    const checks = checkResult(res.rows, res.cols, tickets.length);
    const ok = checks.every(c => c.passed);

    if (!threads.some(t => t.id === a.id)) threads.push(a);

    $('#df-sql').textContent = a.sql;
    $('#df-scoped').textContent = v.ok ? v.scoped : 'REFUSED: ' + v.why;

    const valCol = res.cols.slice(1).find(c => res.rows.every(r => typeof r[c] === 'number'));
    const max = Math.max.apply(null, res.rows.map(r => Math.abs(r[valCol]))) || 1;
    $('#df-chart').innerHTML = res.rows.map(r =>
      '<div class="ch-bar-row"><span class="ch-lab">' + r[res.cols[0]] + '</span>' +
      '<span class="ch-track"><span class="ch-fill' + (a.id === 'bad' ? ' bad' : '') +
        '" style="width:' + Math.min(100, Math.abs(r[valCol]) / max * 100) + '%"></span></span>' +
      '<span class="ch-val mono">' + r[valCol] + (a.fmt === 'pct' ? '%' : a.fmt === 'min' ? 'm' : '') + '</span></div>').join('');

    $('#df-checks').innerHTML = checks.map(c =>
      '<div class="inv"><span class="inv-' + (c.passed ? 'ok' : 'no') + '">' +
      (c.passed ? 'ok' : 'FAIL') + '</span>' + c.name +
      '<span class="dim"> — ' + c.detail + '</span></div>').join('') +
      (ok ? '' : '<div class="callout warn" style="margin-top:14px"><div class="callout-ico">📉</div><div>' +
        'The chart above rendered perfectly. Same colours, same axes, same confidence — and every bar is wrong. ' +
        'This is the entire reason the checks exist rather than the human eye.</div></div>');

    $('#df-why').textContent = a.why;

    $('#df-threads').innerHTML = threads.map(t => {
      const parent = t.parent ? C.dfAsks.find(x => x.id === t.parent) : null;
      return '<div class="df-thread' + (parent ? ' child' : '') + (t.id === a.id ? ' on' : '') + '">' +
        '<span class="df-tid mono">' + t.id + '</span><span>' + t.label +
        (parent ? '<span class="dim"> · anchored to ' + parent.id + '</span>' : '') + '</span></div>';
    }).join('');
  }
  run(0);
}

/* ============================================================
   Ch14 — budget + degradation
   ============================================================ */
function initBudget() {
  const sl = $('#budget-slider'); if (!sl) return;
  const t = C.tenants.find(x => x.id === 'bloom');

  function render() {
    const spent = +sl.value;
    const cap = t.config.budget_cents;
    const degraded = spent >= cap;
    const q = 'can I move my appointment?';
    const hits = search(indexFor(t), q, 3);
    const conf = confidence(hits, q);
    const act = degraded ? 'review' : (hits.length ? gate(conf, true, t.config) : 'refuse');

    $('#budget-out').innerHTML =
      '<div class="gate-meter"><span class="gm-fill' + (degraded ? ' over' : '') +
        '" style="width:' + Math.min(100, spent / cap * 100) + '%"></span></div>' +
      '<div class="kv">' +
        '<div><span class="dim">spent this period</span><b>' + spent.toFixed(1) + '¢</b></div>' +
        '<div><span class="dim">cap</span><b>' + cap + '¢</b></div>' +
        '<div><span class="dim">mode</span><b class="' + (degraded ? 'over' : '') + '">' +
          (degraded ? 'degraded' : 'normal') + '</b></div>' +
      '</div>' +
      '<div class="verdict-row v-' + (act === 'auto_send' ? 'refunded' : 'blocked') + '">' +
        '<span class="v-badge">' + act + '</span>' +
        '<span class="dim">' + (degraded
          ? 'no model called — the human gets the retrieved snippet'
          : 'drafted by the model, gated on confidence ' + conf.toFixed(3)) + '</span></div>' +
      '<div class="chunk hit">' + esc(hits.length ? hits[0].text.slice(0, 200) : '—') + '</div>' +
      '<p class="panel-sub">' + (degraded
        ? 'Retrieval still runs. The queue still fills. Nothing returns a 500 — the desk gets slower, not broken. ' +
          'Memory lookups are skipped too, because they cost a model call.'
        : 'Inside the cap: generation runs, memory is injected, and the gate decides.') + '</p>';
  }
  sl.oninput = render;
  render();
}

/* ============================================================
   Ch15 — the eval gate (recomputed live)
   ============================================================ */
function evalTenant(t, autoAt) {
  const cfg = autoAt == null ? t.config : Object.assign({}, t.config, { auto_send_at: autoAt });
  const idx = indexFor(t);
  let correct = 0, auto = 0, badAuto = 0, missedRef = 0;
  const failures = [];

  t.golden.forEach(c => {
    const hits = search(idx, c.q, 3);
    const conf = confidence(hits, c.q);
    const act = hits.length ? gate(conf, true, cfg) : 'refuse';
    let ok;
    if (c.must_refuse) {
      ok = act === 'refuse' || act === 'review';
      if (!ok) { missedRef++; failures.push('answered a question it should not have: "' + c.q + '"'); }
    } else {
      const cited = hits.map(h => h.title);
      ok = cited.indexOf(c.must_cite) > -1;
      if (!ok) failures.push('"' + c.q + '" cited ' + (cited.length ? cited.join(', ') : 'nothing') +
        ', expected "' + c.must_cite + '"');
    }
    if (act === 'auto_send') { auto++; if (!ok) badAuto++; }
    if (ok) correct++;
  });

  return { id: t.id, name: t.name, n: t.golden.length, acc: correct / t.golden.length,
           auto: auto / t.golden.length, badAuto: badAuto, missedRef: missedRef,
           sla: t.config.sla_accuracy, failures: failures };
}
window.__evalTenant = evalTenant;

function initEval() {
  const root = $('#eval-out'); if (!root) return;
  const sl = $('#eval-slider');

  function render() {
    const override = sl && sl.value !== '' ? +sl.value : null;
    const scores = C.tenants.map(t => evalTenant(t, override));
    scores.sort((a, b) => a.acc - b.acc);
    const passed = scores.every(s => s.acc >= s.sla && s.badAuto === 0);
    const worst = scores[0];
    const mean = scores.reduce((a, s) => a + s.acc, 0) / scores.length;

    root.innerHTML =
      '<table class="ev"><thead><tr><th>tenant</th><th>n</th><th>acc</th><th>auto</th>' +
      '<th>bad auto</th><th>missed ref</th><th>SLA</th><th>status</th></tr></thead><tbody>' +
      scores.map(s => {
        const ok = s.acc >= s.sla && s.badAuto === 0;
        return '<tr class="' + (ok ? '' : 'bad') + '"><td>' + s.name + '</td><td>' + s.n + '</td>' +
          '<td><b>' + Math.round(s.acc * 100) + '%</b></td><td>' + Math.round(s.auto * 100) + '%</td>' +
          '<td>' + s.badAuto + '</td><td>' + s.missedRef + '</td><td>' + Math.round(s.sla * 100) + '%</td>' +
          '<td><span class="pill ' + (ok ? 'good' : 'bad') + '">' + (ok ? 'ok' : 'FAIL') + '</span></td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="kv">' +
        '<div><span class="dim">fleet average</span><b>' + Math.round(mean * 100) + '%</b></div>' +
        '<div><span class="dim">worst tenant</span><b>' + worst.name + ' at ' + Math.round(worst.acc * 100) + '%</b></div>' +
        '<div><span class="dim">gate exit code</span><b class="' + (passed ? '' : 'over') + '">' +
          (passed ? '0 — PASS' : '1 — FAIL') + '</b></div>' +
      '</div>' +
      (scores.some(s => s.failures.length)
        ? '<div class="ev-fails">' + scores.flatMap(s => s.failures.map(f =>
            '<div class="inv"><span class="inv-no">miss</span><b>' + s.name + '</b> — ' + esc(f) + '</div>')).join('') + '</div>'
        : '') +
      '<p class="panel-sub" style="margin-top:14px">' +
        (override == null
          ? 'These numbers are recomputed in your browser right now, with the same BM25, the same ' +
            'confidence function and the same gate the Python uses. They match <span class="mono">python evalgate.py</span>.'
          : 'Auto-send threshold forced to ' + override + ' for every tenant — the deflection/safety trade-off, ' +
            'live. <b>bad auto</b> stays at 0 here because every failing case in these golden sets retrieves ' +
            'nothing at all, and no-hits refuses unconditionally. That is a property of the seed data, not a ' +
            'promise from the gate: with a fuller help centre a wrong-but-retrievable answer is exactly what ' +
            'this column is waiting to catch.') +
      '</p>';
  }

  if (sl) sl.oninput = render;
  if ($('#eval-reset')) $('#eval-reset').onclick = () => { sl.value = ''; render(); };
  render();
}

/* ============================================================
   Ch16 — file maps, what's not here
   ============================================================ */
function initMaps() {
  const root = $('#file-maps'); if (!root) return;
  root.innerHTML = C.fileMap.map(p =>
    '<div class="panel"><div class="panel-head"><h3>📁 ' + p.project + '</h3>' +
    '<span class="panel-tag">' + p.tests + '</span></div>' +
    '<div class="fmap">' + p.files.map(f =>
      '<div class="fm-row"><code>' + f[0] + '</code><span>' + f[1] + '</span></div>').join('') +
    '</div></div>').join('');

  $('#not-here').innerHTML = C.notHere.map(p =>
    '<div class="panel"><div class="panel-head"><h3>🚫 not in ' + p.p + '</h3></div>' +
    '<dl class="deflist">' + p.items.map(i =>
      '<dt>' + i[0] + '</dt><dd>' + i[1] + '</dd>').join('') + '</dl></div>').join('');
}

/* ============================================================
   Quiz + glossary
   ============================================================ */
function initQuiz() {
  const root = $('#quiz'); if (!root) return;
  const answered = new Set(); let correct = 0;
  const result = $('#quiz-result');

  C.quiz.forEach((q, i) => {
    const box = el('div', 'quiz-q',
      '<div class="quiz-n">Question ' + (i + 1) + ' of ' + C.quiz.length + '</div>' +
      '<div class="quiz-t">' + q.q + '</div>');
    const opts = el('div', 'quiz-opts');
    q.o.forEach((o, oi) => {
      const b = el('button', 'qopt', o);
      b.onclick = () => {
        if (answered.has(i)) return;
        answered.add(i);
        $$('.qopt', opts).forEach((x, xi) => { x.disabled = true; if (xi === q.a) x.classList.add('correct'); });
        if (oi !== q.a) b.classList.add('incorrect'); else { correct++; xp(5); }
        $('.quiz-exp', box).classList.add('show');
        if (answered.size === C.quiz.length) finish();
      };
      opts.appendChild(b);
    });
    box.appendChild(opts);
    box.appendChild(el('div', 'quiz-exp', q.e));
    root.appendChild(box);
  });

  function finish() {
    const pct = Math.round(correct / C.quiz.length * 100);
    const msg = pct === 100 ? 'Perfect. You could defend either project in an interview tomorrow.'
      : pct >= 75 ? 'Strong. Re-read the chapters behind the misses and you are there.'
      : pct >= 50 ? 'Solid start — the constraint chapters are the ones worth a second pass.'
      : 'Worth another walk through. Start with chapter 1 and chapter 8: the constraints explain everything else.';
    result.innerHTML = '<div class="quiz-result"><h3>' + correct + ' / ' + C.quiz.length +
      ' &nbsp;·&nbsp; ' + pct + '%</h3><p>' + msg + '</p></div>';
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    xp(25, '🏁 Walkthrough complete — ' + pct + '%');
  }

  const g = $('#glossary'), searchBox = $('#gloss-search');
  function renderG(filter) {
    const f = (filter || '').toLowerCase();
    g.innerHTML = C.glossary
      .filter(t => !f || t[0].toLowerCase().indexOf(f) > -1 || t[1].toLowerCase().indexOf(f) > -1)
      .map(t => '<div class="gterm"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>').join('')
      || '<p class="panel-sub">No match.</p>';
  }
  searchBox.oninput = () => renderG(searchBox.value);
  renderG('');
}

/* ---------- code tabs ---------- */
function initCode() {
  if ($('#refund-code-tabs')) tabs($('#refund-code-tabs'), $('#refund-code'), C.refundCode);
  if ($('#support-code-tabs')) tabs($('#support-code-tabs'), $('#support-code'), C.supportCode);
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initBackground, initPolicy, initInjection, initIdem, initSaga, initApproval, initChaos,
   initIsolation, initSqlProbe, initGate, initMemory, initAnalytics, initBudget, initEval,
   initMaps, initCode, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
