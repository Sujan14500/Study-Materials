/* ============================================================
   guardrails7.js — the seven guardrail layers, as an interactive
   map rather than a list.

   Self-mounting: put <div id="g7"></div> in the page and this
   fills it. Data and rendering both live here so nothing else
   needed touching.

   The point the widget is making: guardrails are not one filter
   in front of the model. They are seven places a request passes
   through, and each one fails differently. Most teams build the
   first and the last, and are then surprised by the middle five.
   ============================================================ */
(function () {
'use strict';
const root = document.getElementById('g7');
if (!root) return;

const $ = (s, r) => (r || document).querySelector(s);

/* Layers are ordered the way a request actually travels. */
const LAYERS = [
  { id: 'input', n: 'Input', ico: '📥', c: '#60a5fa', side: 'l', row: 0,
    one: 'Everything arriving from the outside, before a single token is spent.',
    why: 'This is the cheapest place to say no. A request rejected here costs nothing; the same request rejected at the output has already paid for retrieval, reasoning and generation.',
    gone: 'A 40MB PDF, a zip bomb or a thousand-request-per-second script becomes a bill and an outage rather than a 400 response.',
    checks: [
      ['Input validation', 'Length, encoding and required fields, before anything else runs.'],
      ['Size and rate limits', 'Per user and per key, or one script becomes your monthly budget.'],
      ['Language & injection screening', 'A first cheap classifier pass on obviously hostile input.'],
      ['Schema and MIME checks', 'The file claiming to be a PDF should actually be one.'],
      ['Content sanitization', 'Strip markup, control characters and zero-width tricks.'],
      ['Malware and file scanning', 'Uploads reach a parser. Parsers have had CVEs.']
    ] },
  { id: 'prompt', n: 'Prompt', ico: '📝', c: '#7c5cff', side: 'r', row: 0,
    one: 'The boundary between your instructions and everything the user or a document supplied.',
    why: 'The model sees one flat sequence of tokens. Nothing structurally separates your rules from an attacker\'s text unless you build that separation deliberately.',
    gone: 'System prompt extraction, and any hidden instruction in a retrieved document that says "ignore your previous rules" gets exactly the authority your own rules had.',
    checks: [
      ['System prompt isolation', 'Rules in the system role, never concatenated into user text.'],
      ['Role separation', 'User content stays user content, and is labelled as untrusted.'],
      ['Instruction locking', 'State explicitly that instructions inside data are data, not commands.'],
      ['Hidden prompt protection', 'Strip zero-width, homoglyph and comment-hidden text.'],
      ['Jailbreak detection', 'Classify for known bypass patterns before spending on generation.'],
      ['Context boundaries', 'Delimit retrieved text clearly so the model can tell where it starts.']
    ] },
  { id: 'memory', n: 'Memory', ico: '🧷', c: '#a78bfa', side: 'l', row: 1,
    one: 'What the agent carries between turns and between sessions.',
    why: 'Memory is the layer nobody guards, and it is the one where a single bad moment becomes permanent. An injected instruction written into memory fires again tomorrow, with no attacker present.',
    gone: 'Persistent injection, one tenant\'s facts recalled in another\'s conversation, and personal data with no deletion path when someone asks to be forgotten.',
    checks: [
      ['Session separation', 'Namespaced by user and tenant, enforced by the store, not the prompt.'],
      ['Write controls', 'Not everything observed deserves to be remembered.'],
      ['Recall filtering', 'Filter on the way out as well as the way in.'],
      ['Sensitive data blocking', 'Never persist card numbers, secrets or credentials.'],
      ['Memory retention rules', 'A written policy for what is kept and for how long.'],
      ['Memory expiry', 'A TTL, so a stale fact stops being asserted as current.']
    ] },
  { id: 'retrieval', n: 'Retrieval', ico: '📚', c: '#22d3ee', side: 'r', row: 1,
    one: 'Everything RAG pulls in and hands to the model as if it were true.',
    why: 'Retrieved text is untrusted input that arrives without a user attached. This is the delivery mechanism for indirect prompt injection, and nobody is watching it.',
    gone: 'A poisoned document in the index instructs every agent that retrieves it, and permission-scoped documents leak because the filter was a prompt instruction rather than a query condition.',
    checks: [
      ['Source filtering', 'Only indexes you control, with provenance recorded per chunk.'],
      ['Metadata filtering', 'Tenant and ACL applied in the query, never asked for in the prompt.'],
      ['Trust scoring', 'Internal policy documents and scraped web pages are not equals.'],
      ['Freshness checks', 'Stale answers are wrong answers with a confident tone.'],
      ['Chunk validation', 'Reject chunks carrying instruction-shaped text.'],
      ['Grounding rules', 'Answer only from retrieved context, and cite which chunk.']
    ] },
  { id: 'tool', n: 'Tool', ico: '🔧', c: '#fb923c', side: 'r', row: 2,
    one: 'The moment a token turns into a real-world action.',
    why: 'Every other layer on this map is about text. This one is about consequences, and it is the only layer where a mistake cannot be corrected by a better answer afterwards.',
    gone: 'Excessive agency: the refund that should not have been issued, the email that cannot be unsent, the table that is no longer there.',
    checks: [
      ['Tool allowlists', 'This agent gets these tools. Not the full catalogue.'],
      ['Permission checks', 'Least-privilege credentials, enforced by the system not the prompt.'],
      ['Transaction limits', 'A hard ceiling per action and per session.'],
      ['Human confirmation', 'A durable interrupt on anything irreversible.'],
      ['Tool sandboxing', 'Generated code runs in a container, never in your process.'],
      ['Timeout controls', 'A hung tool must not hold the run open indefinitely.']
    ] },
  { id: 'runtime', n: 'Runtime', ico: '📡', c: '#34d399', side: 'l', row: 2,
    one: 'The behaviour of the run itself: how long, how many steps, how much.',
    why: 'The failure here is not a wrong answer, it is an unbounded one. An agent stuck in a loop produces no output and a very large invoice.',
    gone: 'Denial of wallet. One run rediscovering that a tool is broken, forty times, at frontier-model prices.',
    checks: [
      ['Loop detection', 'Hash the tool call and its arguments; the same call twice is a signal.'],
      ['Latency tracking', 'Per step, not just per request, or you cannot find the slow one.'],
      ['Anomaly detection', 'Ten times the usual tool calls means stop and look.'],
      ['Concurrency control', 'One user cannot occupy the whole worker pool.'],
      ['Session monitoring', 'A live cost total, checked every iteration.'],
      ['Fallback routing', 'A named degraded outcome, not an exception at the top of the stack.']
    ] },
  { id: 'output', n: 'Output', ico: '📤', c: '#fb7185', side: 'b', row: 3,
    one: 'The last thing checked before a human or another system sees it.',
    why: 'This is the layer everyone builds first, and on its own it is the weakest. It runs after the tool already fired, so it can change what is said but never what was done.',
    gone: 'Leaked secrets and personal data in the response, confident fabrications presented as fact, and answers on topics you promised regulators you would not touch.',
    checks: [
      ['Response validation', 'Parse against the schema. Malformed output is a failure, not a warning.'],
      ['Hallucination checks', 'Score groundedness against the retrieved context.'],
      ['PII masking', 'Detect and redact on the way out as well as the way in.'],
      ['Content moderation', 'Category scores with thresholds you chose deliberately.'],
      ['Toxicity checks', 'Cheap classifier, and it belongs on every user-facing path.'],
      ['Restricted topic blocking', 'The list your legal team wrote, enforced in code.']
    ] }
];

/* ---------- build ---------- */
root.innerHTML =
  '<div class="g7-wrap">' +
    '<div class="g7-board" id="g7-board"></div>' +
    '<div class="g7-detail" id="g7-detail"></div>' +
  '</div>';

const board = $('#g7-board');
board.innerHTML =
  LAYERS.map(l =>
    '<button class="g7-node" data-id="' + l.id + '" style="--c:' + l.c + '" ' +
      'data-side="' + l.side + '" data-row="' + l.row + '">' +
      '<span class="g7-ico">' + l.ico + '</span>' +
      '<b>' + l.n + '</b><span class="g7-cnt">' + l.checks.length + ' checks</span>' +
    '</button>').join('') +
  '<div class="g7-core"><span>🤖</span><b>the agent</b></div>';

const detail = $('#g7-detail');

function show(id) {
  const l = LAYERS.find(x => x.id === id);
  Array.from(board.querySelectorAll('.g7-node')).forEach(n =>
    n.classList.toggle('on', n.dataset.id === id));
  detail.style.setProperty('--c', l.c);
  detail.innerHTML =
    '<div class="g7-d-h"><span class="g7-d-ico">' + l.ico + '</span>' +
      '<div><b>' + l.n + ' guardrails</b><span>' + l.one + '</span></div></div>' +
    '<p class="g7-why"><b>Why this layer exists.</b> ' + l.why + '</p>' +
    '<div class="g7-gone"><b>Without it</b>' + l.gone + '</div>' +
    '<div class="g7-checks">' + l.checks.map(c =>
      '<div class="g7-check"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>').join('') + '</div>';
  detail.classList.remove('in'); void detail.offsetWidth; detail.classList.add('in');
  if (window.awardXP) window.awardXP(1);
}

Array.from(board.querySelectorAll('.g7-node')).forEach(n =>
  n.onclick = () => { show(n.dataset.id); stop(); });

show('input');

/* cycle until touched, so the shape of the map lands before the detail does */
let at = 0;
let timer = setInterval(() => show(LAYERS[at = (at + 1) % LAYERS.length].id), 3600);
function stop() { clearInterval(timer); timer = null; }
})();
