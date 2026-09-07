/* ============================================================
   obstrace.js — "system healthy ≠ answer correct".

   Self-mounting: put <div id="obstrace"></div> in the page.

   Four incidents. In every one of them the infrastructure
   dashboard is entirely green — CPU fine, p95 fine, error rate
   zero, throughput normal — and the user got a wrong answer.
   Pick an incident, read the trace, and find the span that knew.

   The argument: classic observability watches whether the system
   ran. LLM observability watches whether it was right. They are
   different questions, they need different instrumentation, and
   the first one going green is exactly what makes the second one
   so easy to miss.
   ============================================================ */
(function () {
'use strict';

/* the infra dashboard everyone already has. It is green in all four cases,
   which is the entire point, so it is defined once rather than per incident. */
const HEALTH = [
  { n: 'CPU', v: '23%', ok: true },
  { n: 'Memory', v: '41%', ok: true },
  { n: 'p95 latency', v: '1.9 s', ok: true },
  { n: 'HTTP 5xx', v: '0.00%', ok: true },
  { n: 'Throughput', v: '128 req/s', ok: true },
  { n: 'Timeouts', v: '0', ok: true }
];

const CASES = [

{ id: 'empty', n: 'Retrieval came back empty', ico: '🕳️',
  ask: 'What is our refund window for enterprise plans?',
  said: 'Enterprise refunds are processed within 30 days of purchase.',
  truth: 'There is no enterprise refund policy document in the index. The number is invented.',
  spans: [
    { n: 'guardrail.input', ms: 34, ok: true, detail: 'clean' },
    { n: 'embed.query', ms: 21, ok: true, detail: '1 × 1024-d vector' },
    { n: 'retrieve.hybrid', ms: 12, ok: true, detail: '0 chunks above threshold', flag: true },
    { n: 'llm.generate', ms: 1620, ok: true, detail: '412 tokens in, 38 out' }
  ],
  tell: 'The retrieval span is <b>faster than usual</b> and returned zero chunks. Every status is 200. Nothing in an infrastructure dashboard has a shape for "succeeded and found nothing".',
  metric: 'Empty-retrieval rate, and chunks-returned as a distribution rather than an average.',
  fix: 'Instrument the <i>result</i>, not just the call: number of chunks, top score, and the document ids. Then make empty retrieval a first-class path — say "I could not find that" instead of letting the model answer from parametric memory.' },

{ id: 'cite', n: 'A citation nobody could have written', ico: '🔗',
  ask: 'Which clause covers early termination?',
  said: 'Clause 7.4 of the Master Services Agreement — see [doc: msa-2024-v3].',
  truth: 'msa-2024-v3 was never retrieved for this request. The chunk ids that were retrieved are three other documents.',
  spans: [
    { n: 'retrieve.hybrid', ms: 88, ok: true, detail: '5 chunks: c-118, c-119, c-204, c-981, c-77' },
    { n: 'rerank', ms: 61, ok: true, detail: 'top 3 kept' },
    { n: 'llm.generate', ms: 2110, ok: true, detail: 'cites msa-2024-v3', flag: true },
    { n: 'guardrail.output', ms: 40, ok: true, detail: 'no policy violation' }
  ],
  tell: 'The output guardrail checked for toxicity and personal data, and had no opinion about whether the citation was real. A fabricated citation is grammatically perfect and semantically confident.',
  metric: 'Citation validity: the fraction of cited ids that appear in the retrieved set for that same request.',
  fix: 'Verify citations mechanically after generation — parse the ids out of the answer and intersect them with what retrieval actually returned. A mismatch is a failed response, not a warning. This is a five-line check that catches an entire class of hallucination.' },

{ id: 'tool', n: 'A tool failed politely', ico: '🔧',
  ask: 'Refund order 88213 for the customer.',
  said: 'Done — the refund for order 88213 has been issued.',
  truth: 'The payments API returned <code>{"status":"error","reason":"already_refunded"}</code> with HTTP 200. Nothing was issued, and the customer was told it was.',
  spans: [
    { n: 'llm.plan', ms: 640, ok: true, detail: 'chose refund_order' },
    { n: 'tool.refund_order', ms: 210, ok: true, detail: 'HTTP 200 · body says error', flag: true },
    { n: 'llm.generate', ms: 980, ok: true, detail: 'summarised the tool result as success' }
  ],
  tell: 'The transport succeeded, so every metric that watches transports is green. The failure lives in the response <i>body</i>, and the model — which treats tool output as trustworthy text — turned it into a confident confirmation.',
  metric: 'Tool outcome, parsed from the payload and recorded separately from the HTTP status. Then: tool success rate per tool, not per endpoint.',
  fix: 'Observation shaping. Parse every tool result into an explicit success or failure before it reaches the model, and make a failed tool call a state the agent has to handle rather than a paragraph it gets to interpret.' },

{ id: 'cost', n: 'Everything green, cost tripled', ico: '💸',
  ask: 'Summarise this quarter\'s support escalations.',
  said: 'A correct answer — after nine tool calls, four of which repeated the same failing search.',
  truth: 'Per-request latency is inside the SLO because each step is fast. The agent is looping, and the bill for a successful task went from $0.04 to $0.13.',
  spans: [
    { n: 'agent.step 1-3', ms: 1400, ok: true, detail: 'search → read → search' },
    { n: 'agent.step 4-7', ms: 1900, ok: true, detail: 'the same search, three more times', flag: true },
    { n: 'agent.step 8-9', ms: 900, ok: true, detail: 'gave up and summarised what it had' },
    { n: 'llm.generate', ms: 1100, ok: true, detail: '14,900 tokens in' }
  ],
  tell: 'No span is slow, no span errors, and the request finished inside the latency budget. Averaged over a dashboard, a loop looks exactly like normal traffic — just more of it.',
  metric: '<b>Cost per successful task</b>, plus steps-per-task and repeated-tool-call rate. Cost per request hides this; cost per <i>success</i> cannot.',
  fix: 'Hash each tool call with its arguments and count repeats inside a run. Two identical calls is a signal, three is a loop — cap the step budget and the spend per run, and emit both as span attributes so the trace shows them.' }
];

if (typeof window !== 'undefined') window.OBSTRACE = { HEALTH, CASES };

/* ============================================================
   rendering
   ============================================================ */
const root = typeof document !== 'undefined' && document.getElementById('obstrace');
if (!root) return;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let at = 0, span = null;

function paint() {
  const c = CASES[at];
  const max = Math.max.apply(null, c.spans.map(s => s.ms));

  root.innerHTML =
    '<div class="ob-tabs">' + CASES.map((x, i) =>
      '<button class="ob-tab' + (i === at ? ' on' : '') + '" data-i="' + i + '">' +
        x.ico + ' ' + esc(x.n) + '</button>').join('') + '</div>' +

    '<div class="ob-split">' +
      '<div class="ob-side ok">' +
        '<h5>The system<span>every check green</span></h5>' +
        '<div class="ob-health">' + HEALTH.map(h =>
          '<div class="ob-hc"><b>' + esc(h.n) + '</b><span>' + esc(h.v) + '</span></div>').join('') + '</div>' +
        '<div class="ob-note">Nothing here is lying. The request was served, quickly, without an error. ' +
        'These metrics answer <i>did it run</i> — and that is a different question from the one the user cares about.</div>' +
      '</div>' +
      '<div class="ob-neq">≠</div>' +
      '<div class="ob-side bad">' +
        '<h5>The answer<span>wrong, confidently</span></h5>' +
        '<div class="ob-chat">' +
          '<div class="ob-msg u">' + esc(c.ask) + '</div>' +
          '<div class="ob-msg a">' + esc(c.said) + '<i>⚠ wrong</i></div>' +
        '</div>' +
        '<div class="ob-truth">' + c.truth + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ob-trace"><h5>The trace — the flagged span knew</h5>' +
      c.spans.map((s, i) =>
        '<button class="ob-span' + (s.flag ? ' flag' : '') + (span === i ? ' on' : '') + '" data-s="' + i + '">' +
          '<span class="ob-sn">' + esc(s.n) + '</span>' +
          '<span class="ob-sbar"><i style="width:' + Math.max(6, s.ms / max * 100) + '%"></i></span>' +
          '<span class="ob-sms">' + s.ms + ' ms</span>' +
          '<span class="ob-sd">' + s.detail + '</span>' +
          '<span class="ob-ss">' + (s.flag ? '⚠' : '✓') + '</span>' +
        '</button>').join('') +
    '</div>' +

    '<div class="ob-learn">' +
      '<div class="ob-l"><b>What the dashboard could not show</b>' + c.tell + '</div>' +
      '<div class="ob-l m"><b>The metric that catches it</b>' + c.metric + '</div>' +
      '<div class="ob-l f"><b>The fix</b>' + c.fix + '</div>' +
    '</div>' +

    '<div class="ob-foot"><b>The rule this widget exists for:</b> instrument the ' +
      '<i>content</i>, not only the call. Span attributes for the retrieved document ids, the ' +
      'parsed tool outcome, the cited ids, tokens and cost per step, and a groundedness score on the ' +
      'answer — then alert on cost per successful task and on empty retrieval, because those two ' +
      'have no equivalent anywhere in an infrastructure dashboard.</div>';

  root.querySelectorAll('.ob-tab').forEach(b => b.onclick = () => { at = +b.dataset.i; span = null; paint(); });
  root.querySelectorAll('.ob-span').forEach(b => b.onclick = () => {
    span = span === +b.dataset.s ? null : +b.dataset.s; paint();
  });
}

paint();
})();
