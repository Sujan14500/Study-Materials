/* ============================================================
   content.js — all the course data in one place.
   Edit here to change the course; demos.js only renders it.
   ============================================================ */
window.C = {};

/* ---------- Ch1: guess the next word ---------- */
C.guessRounds = [
  {
    prefix: 'The doctor picked up the stethoscope and listened to the patient’s',
    options: [
      { w: 'heartbeat', p: 0.46 }, { w: 'chest', p: 0.31 },
      { w: 'story', p: 0.06 }, { w: 'bicycle', p: 0.002 }
    ],
    note: 'Context does the work. "bicycle" is a perfectly good English word — it just never follows this setup.'
  },
  {
    prefix: 'She opened the fridge, sighed, and ordered',
    options: [
      { w: 'pizza', p: 0.38 }, { w: 'takeout', p: 0.29 },
      { w: 'groceries', p: 0.11 }, { w: 'a tuba', p: 0.001 }
    ],
    note: 'The model learned the whole little narrative: empty fridge → sigh → delivery food.'
  },
  {
    prefix: 'To fix the bug, first check the error message in the',
    options: [
      { w: 'logs', p: 0.41 }, { w: 'console', p: 0.33 },
      { w: 'terminal', p: 0.14 }, { w: 'garden', p: 0.001 }
    ],
    note: 'Three of these are near-ties. That is why the same question can get different answers on different runs.'
  }
];

/* ---------- Ch3: 2D "embedding" space (hand-placed, illustrative) ---------- */
C.embedWords = [
  { w: 'king',      x: 0.20, y: 0.80, c: 'royal'  },
  { w: 'queen',     x: 0.32, y: 0.86, c: 'royal'  },
  { w: 'prince',    x: 0.16, y: 0.70, c: 'royal'  },
  { w: 'throne',    x: 0.27, y: 0.71, c: 'royal'  },
  { w: 'man',       x: 0.13, y: 0.47, c: 'people' },
  { w: 'woman',     x: 0.25, y: 0.53, c: 'people' },
  { w: 'boy',       x: 0.09, y: 0.38, c: 'people' },
  { w: 'girl',      x: 0.21, y: 0.42, c: 'people' },
  { w: 'dog',       x: 0.60, y: 0.82, c: 'animal' },
  { w: 'puppy',     x: 0.66, y: 0.88, c: 'animal' },
  { w: 'cat',       x: 0.70, y: 0.76, c: 'animal' },
  { w: 'kitten',    x: 0.76, y: 0.82, c: 'animal' },
  { w: 'horse',     x: 0.59, y: 0.69, c: 'animal' },
  { w: 'server',    x: 0.80, y: 0.24, c: 'tech'   },
  { w: 'database',  x: 0.88, y: 0.31, c: 'tech'   },
  { w: 'API',       x: 0.83, y: 0.15, c: 'tech'   },
  { w: 'code',      x: 0.73, y: 0.20, c: 'tech'   },
  { w: 'python',    x: 0.90, y: 0.19, c: 'tech'   },
  { w: 'pizza',     x: 0.36, y: 0.16, c: 'food'   },
  { w: 'pasta',     x: 0.44, y: 0.11, c: 'food'   },
  { w: 'bread',     x: 0.30, y: 0.09, c: 'food'   },
  { w: 'coffee',    x: 0.46, y: 0.23, c: 'food'   },
  { w: 'paris',     x: 0.56, y: 0.35, c: 'place'  },
  { w: 'tokyo',     x: 0.72, y: 0.42, c: 'place'  },
  { w: 'france',    x: 0.62, y: 0.45, c: 'place'  },
  { w: 'japan',     x: 0.78, y: 0.52, c: 'place'  }
];
C.embedColors = {
  royal:  '#f472b6', people: '#7c5cff', animal: '#34d399',
  tech:   '#22d3ee', food:   '#fbbf24', place:  '#fb7185'
};
C.vecMath = [
  { a: 'king',  minus: 'man',    plus: 'woman',  eq: 'queen',  why: 'Subtracting "man" and adding "woman" moves you along the gender direction — while the royalty direction stays put.' },
  { a: 'paris', minus: 'france', plus: 'japan',  eq: 'tokyo',  why: 'The same geometry encodes "capital city of". Nobody programmed that relationship; it fell out of the training data.' },
  { a: 'cat',   minus: 'kitten', plus: 'puppy',  eq: 'dog',    why: 'Same trick, different axis: cat minus kitten isolates the grown-up direction, and adding it to puppy lands you on dog. An analogy is a straight line through the space.' }
];

/* ---------- Ch4: attention ---------- */
C.attnSentences = [
  {
    label: 'pronoun reference',
    words: ['The', 'trophy', 'did', 'not', 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'big'],
    focus: 9,
    weights: { 9: { 1: 0.72, 7: 0.15, 12: 0.34, 4: 0.10 }, 12: { 1: 0.55, 7: 0.20 }, 4: { 1: 0.40, 7: 0.38 } },
    note: 'Ask a human what <b>"it"</b> means and they say "the trophy" instantly. The model does it by attending back to <b>trophy</b> — and swapping "big" for "small" flips the attention to <b>suitcase</b>.'
  },
  {
    label: 'long-range subject',
    words: ['The', 'keys', 'to', 'the', 'cabinet', 'in', 'the', 'old', 'office', 'are', 'missing'],
    focus: 9,
    weights: { 9: { 1: 0.78, 4: 0.12, 8: 0.06 }, 10: { 1: 0.40, 4: 0.22 } },
    note: 'Verb agreement over distance: <b>"are"</b> has to match <b>keys</b>, not the nearer noun <i>office</i>. Attention reaches back nine tokens to get it right.'
  },
  {
    label: 'ambiguous word',
    words: ['She', 'went', 'to', 'the', 'bank', 'to', 'deposit', 'her', 'paycheck'],
    focus: 4,
    weights: { 4: { 6: 0.66, 8: 0.42, 1: 0.08 }, 6: { 4: 0.50, 8: 0.35 } },
    note: '<b>"bank"</b> is a river bank until <b>deposit</b> and <b>paycheck</b> show up. Meaning is assembled from context, not looked up in a dictionary.'
  }
];

/* ---------- Ch5: sampler tree (prefix -> candidate distribution) ---------- */
C.genStart = 'The best way to learn generative AI is';
C.genTree = {
  'is': [['to', .52], [' by', .21], [' through', .12], [' probably', .07], [' actually', .05], [' honestly', .03]],
  'to': [[' build', .44], [' read', .18], [' start', .16], [' experiment', .12], [' watch', .06], [' memorise', .04]],
  'build': [[' something', .49], [' small', .22], [' a', .17], [' things', .07], [' toys', .05]],
  'something': [[' small', .41], [' real', .27], [' useless', .13], [' broken', .11], [' enormous', .08]],
  'small': [[' and', .38], [',', .27], [' that', .19], [' first', .11], [' immediately', .05]],
  'and': [[' ship', .33], [' break', .25], [' then', .21], [' measure', .14], [' rewrite', .07]],
  'ship': [[' it', .62], [' early', .18], [' fast', .12], [' anyway', .08]],
  'it': [['.', .55], [' today', .17], [' badly', .14], [' twice', .09], [' loudly', .05]],
  '_default': [[' and', .3], [' then', .25], [' really', .2], [' quietly', .15], [' obviously', .1]]
};

/* ---------- Ch6: training stages ---------- */
C.trainStages = [
  {
    n: 'Stage 1', name: 'Pretraining', pct: 99,
    tag: 'Learns language. Learns the world. Learns nothing about being helpful.',
    what: 'Show the model trillions of tokens of text and ask one question over and over: what comes next? Every wrong guess nudges billions of parameters.',
    data: 'Web pages, books, code, papers — trillions of tokens',
    cost: 'Thousands of GPUs · weeks to months · $10M–$1B+',
    result: 'A <b>base model</b>. Ask it "What is the capital of France?" and it might reply with three more exam questions — because that’s what usually follows a question in its training data.',
    code: 'loss = predict(text[:-1]) vs text[1:]\n# repeat ~10^13 times'
  },
  {
    n: 'Stage 2', name: 'Supervised fine-tuning (SFT)', pct: 0.9,
    tag: 'Teaches the format of being an assistant.',
    what: 'Train on tens of thousands of high-quality (instruction → ideal answer) pairs written or curated by humans. Same next-token objective, far pickier data.',
    data: '10k–1M curated instruction/response pairs',
    cost: 'Hours to days · a fraction of a percent of pretraining',
    result: 'An <b>instruct model</b>. It now answers the question instead of continuing the document.',
    code: '[{"role":"user","content":"Capital of France?"},\n {"role":"assistant","content":"Paris."}]'
  },
  {
    n: 'Stage 3', name: 'Preference tuning (RLHF / DPO)', pct: 0.1,
    tag: 'Teaches taste, tone and refusal.',
    what: 'Humans rank pairs of answers: A better than B. That signal trains the model toward what people actually prefer — helpful, honest, appropriately cautious.',
    data: 'Millions of human preference comparisons',
    cost: 'Expensive in human time, cheap in compute',
    result: 'The <b>chat model</b> you actually call. Same knowledge as the base model, radically better behaviour.',
    code: 'prefer(answer_A) > prefer(answer_B)\n# -> nudge weights toward A'
  }
];

/* ---------- Ch7: prompt lab ---------- */
C.labParts = [
  { id: 'role',    label: 'Role',            hint: 'who the model is',        pts: 10,
    text: 'You are a senior support engineer at a B2B SaaS company.' },
  { id: 'context', label: 'Context',         hint: 'the facts it cannot know', pts: 25,
    text: 'CONTEXT:\nCustomer: Acme Ltd, Enterprise plan, 3 years.\nIssue: SSO login loop since our 4.2 release on Tuesday.\nKnown: 4.2 changed the SAML clock-skew tolerance to 30s.' },
  { id: 'task',    label: 'Clear task',      hint: 'one unambiguous ask',      pts: 20,
    text: 'TASK: Write a reply to the customer that explains the cause, gives the fix, and sets a timeline.' },
  { id: 'examples',label: 'Examples',        hint: 'show, don’t tell',    pts: 20,
    text: 'EXAMPLE OF OUR TONE:\n"Hi Sam — that’s on us. Here’s what happened and what we’ve already changed..."' },
  { id: 'format',  label: 'Output format',   hint: 'exactly what shape',       pts: 15,
    text: 'FORMAT: Max 120 words. Plain text. No apologising twice. End with one concrete next step.' },
  { id: 'cot',     label: 'Think first',     hint: 'reason before answering',  pts: 10,
    text: 'Before writing, list the root cause and the fix in <thinking> tags, then write the reply.' }
];
C.labOutputs = {
  bare: 'Sorry to hear you’re having trouble! Login issues can have many causes. Please try clearing your cache, checking your password, and making sure your browser is up to date. If the problem persists, contact support.\n\n— generic, guessy, useless to Acme.',
  mid:  'Hi Acme team — thanks for flagging the SSO problem. It looks related to our recent release. Our engineers are looking into the SAML configuration and we’ll follow up as soon as we know more.\n\n— correct-ish, but vague and slow. No fix, no timeline.',
  good: 'Hi Acme team — this one’s on us.\n\nOur 4.2 release on Tuesday tightened the SAML clock-skew tolerance to 30 seconds. Your identity provider’s clock drifts slightly further than that, so the assertion is rejected and you land back at the login screen.\n\nImmediate fix: we’ve raised your tenant’s tolerance to 120s — please retry now. Permanent fix ships Thursday and will make the tolerance configurable.\n\nNext step: reply here if any user still loops after a hard refresh, and I’ll escalate to a live call today.'
};
C.techniques = [
  { h: 'Zero-shot', p: 'Just ask. Modern models are strong; always try this first.', c: 'Classify this ticket as bug, billing, or feature request:\n"{ticket}"' },
  { h: 'Few-shot', p: 'Show 2–5 examples of input → output. The most reliable way to lock a format or tone.', c: '"crashes on save" -> bug\n"charged twice"   -> billing\n"{ticket}"        ->' },
  { h: 'Chain of thought', p: 'Ask it to reason before answering. Big gains on maths and multi-step logic; costs extra tokens.', c: 'Work through this step by step,\nthen give the final answer.' },
  { h: 'Structured output', p: 'Demand JSON and give a schema. Makes the output machine-parseable instead of prose you have to regex.', c: 'Reply with only JSON:\n{"category": "...", "urgency": 1-5}' },
  { h: 'Delimiters', p: 'Fence untrusted or long content so the model never confuses data with instructions.', c: 'Summarise the text between the tags.\n<doc>\n{user_text}\n</doc>' },
  { h: 'Give it an out', p: 'Explicit permission to say "I don’t know" cuts hallucination more than any threat.', c: 'If the context does not answer the\nquestion, reply exactly: NOT_FOUND' }
];

/* ---------- Ch8: context ---------- */
C.ctxTurns = [
  { who: 'user', t: 'Hi! I’m planning a trip to Lisbon in March. My name is Priya.', n: 22 },
  { who: 'assistant', t: 'Lovely choice, Priya. March is mild — 15–20°C and quieter than summer.', n: 26 },
  { who: 'user', t: 'I’m vegetarian and I really dislike crowds.', n: 14 },
  { who: 'assistant', t: 'Noted — I’ll steer you to veggie spots and early-morning visits.', n: 20 },
  { who: 'user', t: 'What about day trips?', n: 8 },
  { who: 'assistant', t: 'Sintra is the classic. Go on a weekday, first train, skip the queues.', n: 24 },
  { who: 'user', t: 'And where should I stay?', n: 9 },
  { who: 'assistant', t: 'Alfama for atmosphere, Príncipe Real for quiet and good vegetarian food.', n: 22 },
  { who: 'user', t: 'Remind me — what was my name again?', n: 12 }
];

/* ---------- Ch9: RAG knowledge base ---------- */
C.ragKB = [
  { src: 'refunds.md',   t: 'Refunds are issued within 14 days of purchase for annual plans, and within 7 days for monthly plans. Refunds go back to the original payment method.', k: ['refund','money','back','cancel','14','days','payment'] },
  { src: 'refunds.md',   t: 'Partial refunds are not offered. If a customer cancels mid-term, service continues until the end of the paid period.', k: ['refund','cancel','partial','mid-term','period'] },
  { src: 'sso.md',       t: 'Single sign-on is available on the Enterprise plan only. Supported providers: Okta, Azure AD, Google Workspace and any generic SAML 2.0 IdP.', k: ['sso','saml','okta','azure','login','enterprise','sign'] },
  { src: 'sso.md',       t: 'SAML clock-skew tolerance defaults to 30 seconds since release 4.2. Admins can raise it per tenant in Settings → Security.', k: ['sso','saml','clock','skew','login','loop','4.2','error'] },
  { src: 'pricing.md',   t: 'Plans: Starter $19/user/month, Team $39/user/month, Enterprise from $75/user/month billed annually.', k: ['price','pricing','cost','plan','month','user','seat','people','$'] },
  { src: 'pricing.md',   t: 'Annual billing saves 20% compared with monthly. Non-profits get an additional 30% discount on request.', k: ['price','cost','discount','annual','billing','save','team','people','non-profit'] },
  { src: 'limits.md',    t: 'API rate limit is 600 requests per minute per organisation. Bursts up to 1000/min are tolerated for 30 seconds.', k: ['rate','limit','api','requests','429','throttle','minute'] },
  { src: 'security.md',  t: 'All data is encrypted at rest with AES-256 and in transit with TLS 1.3. We are SOC 2 Type II certified as of 2025.', k: ['security','encryption','soc','tls','compliance','data'] }
];
C.ragQuestions = [
  { q: 'How long do I have to get a refund?', a: 'You can request a refund within <b>14 days</b> of purchase on annual plans, or <b>7 days</b> on monthly plans, refunded to the original payment method. Note that partial refunds aren’t offered — if you cancel mid-term, service runs to the end of the paid period.' },
  { q: 'Why do our users get stuck in a login loop?', a: 'Most likely the SAML clock-skew tolerance. Since release <b>4.2</b> it defaults to 30 seconds, so a drifting identity-provider clock gets assertions rejected. An admin can raise the tolerance per tenant in <b>Settings → Security</b>.' },
  { q: 'What does it cost for 20 people?', a: 'On the <b>Team</b> plan at $39/user/month, 20 seats is <b>$780/month</b>, or about <b>$7,488/year</b> with the 20% annual-billing discount.' },
  { q: 'Who won the 2031 World Cup?', a: 'I don’t have anything in the knowledge base about that. <span class="cite">(No chunk passed the relevance threshold — this is the answer you want when the answer isn’t there.)</span>' }
];
C.ragStages = [
  { b: 'Question', s: 'user asks' },
  { b: 'Embed', s: 'query → vector' },
  { b: 'Search', s: 'compare vectors' },
  { b: 'Rank', s: 'top-k chunks' },
  { b: 'Augment', s: 'stuff the prompt' },
  { b: 'Generate', s: 'grounded answer' }
];

/* ---------- Ch10: decision helper + ladder ---------- */
C.deciderQs = [
  { id: 'need', t: 'What is actually missing?', opts: [
    { l: 'It doesn’t know our data', v: 'data' },
    { l: 'It gets the format or tone wrong', v: 'style' },
    { l: 'It can’t do the task at all', v: 'skill' } ] },
  { id: 'churn', t: 'How often does that knowledge change?', opts: [
    { l: 'Daily or hourly', v: 'fast' },
    { l: 'Monthly-ish', v: 'slow' },
    { l: 'Basically never', v: 'never' } ] },
  { id: 'data', t: 'How many good examples do you have?', opts: [
    { l: 'A handful', v: 'few' },
    { l: 'A few hundred', v: 'some' },
    { l: 'Thousands, labelled', v: 'many' } ] }
];
C.rungs = [
  { i: '1️⃣', h: 'Better prompt', p: 'Clear task, real context, an example or two, explicit output format. Fixes a shocking share of "the model is bad" complaints.', c: 'minutes · $0' },
  { i: '2️⃣', h: 'Few-shot examples', p: 'Lock tone and structure by showing 3–5 ideal input/output pairs right in the prompt.', c: 'hours · ~$0' },
  { i: '3️⃣', h: 'RAG', p: 'The model needs facts it was never trained on — your docs, your database, today’s data. Retrieve, then generate.', c: 'days · $' },
  { i: '4️⃣', h: 'Tools / agents', p: 'It needs to <i>do</i> things: query a DB, call an API, run code, check its own work.', c: 'days–weeks · $$' },
  { i: '5️⃣', h: 'Fine-tuning', p: 'You have thousands of examples and need a consistent style, a narrow skill, or a smaller/cheaper model that punches above its size.', c: 'weeks · $$$' },
  { i: '6️⃣', h: 'Train from scratch', p: 'Almost certainly not. Reserve for frontier labs and genuinely novel modalities.', c: 'months · $$$$$' }
];

/* ---------- Ch11: agent runs ---------- */
C.agentTasks = [
  { label: 'Is my invoice overdue?',
    steps: [
      { k: 'think',   t: 'The user asked about "my invoice". I don’t know which invoice or today’s date. Look up their most recent invoice first.' },
      { k: 'act',     t: '<code>db.query("SELECT * FROM invoices WHERE user=42 ORDER BY due DESC LIMIT 1")</code>' },
      { k: 'observe', t: '<code>{id: "INV-8891", amount: 4200, due: "2026-08-01", paid: false}</code>' },
      { k: 'think',   t: 'Unpaid, due 1 Aug. I still need the current date to say how overdue it is.' },
      { k: 'act',     t: '<code>get_current_date()</code>' },
      { k: 'observe', t: '<code>"2026-08-18"</code>' },
      { k: 'final',   t: 'Yes — invoice INV-8891 for $4,200 was due on 1 August and is <b>17 days overdue</b>. Want me to draft a payment reminder?' }
    ]},
  { label: 'Book a meeting with Sam',
    steps: [
      { k: 'think',   t: 'I need Sam’s calendar and mine, and a slot that works for both. Start with availability.' },
      { k: 'act',     t: '<code>calendar.free_busy(["me","sam@acme.com"], range="next 3 days")</code>' },
      { k: 'observe', t: '<code>overlap: Tue 14:00-15:00, Wed 09:30-10:00</code>' },
      { k: 'think',   t: 'Two options. Creating an event affects someone else’s calendar — that is a write action, so I should confirm rather than assume.' },
      { k: 'final',   t: 'Sam and you are both free <b>Tue 14:00</b> or <b>Wed 09:30</b>. Say the word and I’ll send the invite. <span class="cite">(Write actions behind human approval — exactly right.)</span>' }
    ]},
  { label: 'Why did the deploy fail?',
    steps: [
      { k: 'think',   t: 'Vague question. Get the most recent failed deploy, then its logs.' },
      { k: 'act',     t: '<code>ci.list_runs(status="failed", limit=1)</code>' },
      { k: 'observe', t: '<code>{run: 4471, job: "build", exit: 1}</code>' },
      { k: 'act',     t: '<code>ci.logs(run=4471, tail=40)</code>' },
      { k: 'observe', t: '<code>ERROR: no space left on device (docker build)</code>' },
      { k: 'think',   t: 'Disk, not code. Worth checking whether this is recurring before I answer.' },
      { k: 'act',     t: '<code>ci.list_runs(status="failed", since="7d")</code>' },
      { k: 'observe', t: '<code>4 of 6 failures share the same disk error</code>' },
      { k: 'final',   t: 'Run 4471 failed on <b>disk space</b> during <code>docker build</code>, not on your code — and 4 of the last 6 failures were the same thing. Prune the runner’s image cache and add a disk alarm.' }
    ]}
];

/* ---------- Ch12: hallucination spotting ---------- */
C.hallucCards = [
  { q: 'Q: Who wrote "The Pragmatic Programmer" and when?',
    parts: [
      { t: 'It was written by Andrew Hunt and David Thomas', bad: false },
      { t: ', first published in 1999', bad: false },
      { t: ', and it won the Turing Award for best software book in 2001', bad: true }
    ],
    exp: 'Authors and year: right. The award: invented. The Turing Award goes to people, not books, and there is no such prize. Note how the fabrication is grammatically identical to the true parts — fluency is not evidence.' },
  { q: 'Q: Summarise our Q3 refund policy.',
    parts: [
      { t: 'Refunds are available within 14 days on annual plans', bad: false },
      { t: ' and 7 days on monthly plans', bad: false },
      { t: ', with a 5% processing fee deducted from every refund', bad: true }
    ],
    exp: 'The first two clauses came from the retrieved document. The fee did not — the model filled a plausible-sounding gap. This is why you ask for citations per claim, not one citation per answer.' },
  { q: 'Q: Does this library support async?',
    parts: [
      { t: 'Yes — pass <code>async=True</code> to the client constructor', bad: true },
      { t: '. Wrap calls in <code>await</code> as usual', bad: false },
      { t: '. See the docs for supported event loops', bad: false }
    ],
    exp: 'The flag is fabricated — a very common failure with APIs and CLI flags, because the model has seen a thousand libraries that <i>do</i> have a flag like that. Ground code answers in the actual docs or a real signature.' }
];

/* ---------- Ch13: checklist + architecture ---------- */
C.checklist = [
  'Golden-set evals run on every prompt change',
  'Model + version pinned (no surprise upgrades)',
  'Prompts in version control, not pasted in code',
  'Timeouts, retries with backoff, and a fallback model',
  'Streaming responses so latency feels lower',
  'Token + cost logging per request and per user',
  'Rate limits and a hard spend cap',
  'PII redaction before anything leaves your systems',
  'Instructions separated from untrusted user/retrieved text',
  'No destructive tool runs without human approval',
  'Every LLM call logged with inputs, outputs and trace id',
  'Caching for repeated prompts and prefixes',
  'A "this was wrong" feedback button wired to your evals',
  'Content filtering on input and output',
  'A documented human escalation path'
];
C.arch = [
  { row: [{ b: 'User', s: 'web / app / slack' }] },
  { row: [{ b: 'Your backend', s: 'auth, rate limit, logging', hl: true }] },
  { row: [
      { b: 'Prompt builder', s: 'templates + versions' },
      { b: 'Retriever', s: 'vector + keyword search' },
      { b: 'Tools', s: 'db, apis, code' } ] },
  { row: [{ b: 'LLM provider', s: 'streaming, retries, fallback', hl: true }] },
  { row: [
      { b: 'Guardrails', s: 'schema, filters, citations' },
      { b: 'Observability', s: 'traces, cost, latency' },
      { b: 'Eval loop', s: 'golden set + feedback' } ] }
];

/* ---------- Ch14: quiz ---------- */
C.quiz = [
  { q: 'What is a token?', o: ['A single character', 'A chunk of text — often a word or word-piece', 'One complete sentence', 'A security key for the API'], a: 1,
    e: 'Tokens are sub-word chunks. Common words are usually one token; rare words split into several.' },
  { q: 'Why can models struggle to count the letters in a word?', o: ['They cannot count at all', 'They see tokens, not individual characters', 'Counting is disabled for safety', 'It needs a bigger context window'], a: 1,
    e: 'The model never sees "strawberry" as ten letters — it sees two or three token chunks.' },
  { q: 'Two words with similar meanings have embeddings that are…', o: ['Identical', 'Close together in vector space', 'Opposite in sign', 'Unrelated — embeddings are random'], a: 1,
    e: 'That proximity is exactly what semantic search and RAG retrieval exploit.' },
  { q: 'What does self-attention let a model do?', o: ['Compress the prompt', 'Weigh how much each token matters to every other token', 'Search the internet', 'Remember previous conversations'], a: 1,
    e: 'It is how "it" gets connected to "the trophy" nine words earlier.' },
  { q: 'You set temperature to 0. What happens?', o: ['The model refuses to answer', 'Output becomes deterministic — always the highest-probability token', 'Output gets more creative', 'Nothing; temperature only affects speed'], a: 1,
    e: 'Use temp 0 for extraction, classification and anything that must be reproducible.' },
  { q: 'Which stage teaches a base model to follow instructions?', o: ['Pretraining', 'Supervised fine-tuning', 'Tokenization', 'Quantization'], a: 1,
    e: 'Pretraining teaches language; SFT teaches the assistant format; preference tuning teaches taste.' },
  { q: 'How does a chatbot "remember" earlier messages?', o: ['It stores them in the model weights', 'The whole history is resent with every request', 'A background memory process', 'It does not — memory is impossible'], a: 1,
    e: 'Every call is stateless. "Memory" is you resending the transcript — which is why long chats cost more.' },
  { q: 'Your assistant must answer from internal docs that change weekly. Best first approach?', o: ['Fine-tune weekly', 'RAG', 'Train from scratch', 'Raise the temperature'], a: 1,
    e: 'Fine-tuning bakes knowledge in and goes stale. RAG reads fresh documents at query time.' },
  { q: 'In a RAG system, the answer is wrong. What do you check first?', o: ['The model version', 'Whether the right chunk was retrieved', 'The temperature', 'The user’s browser'], a: 1,
    e: 'If the correct chunk never reached the prompt, no model or prompt tweak can fix the answer.' },
  { q: 'What is prompt injection?', o: ['Making prompts longer', 'Untrusted text in the prompt hijacking the model’s instructions', 'Injecting code into the model weights', 'A prompt-caching technique'], a: 1,
    e: 'Any user, web page or retrieved doc in your prompt is a potential instruction source. Separate data from instructions and gate risky tools.' },
  { q: 'An agent is 95% reliable per step. Over 10 steps, roughly how often does the whole run succeed?', o: ['95%', 'About 60%', 'About 90%', '100% — errors cancel out'], a: 1,
    e: '0.95^10 ≈ 0.60. Errors compound, which is why you cap loops and verify intermediate results.' },
  { q: 'The single highest-value investment when shipping a GenAI feature is…', o: ['The largest available model', 'A golden-set eval you run on every change', 'A custom vector database', 'A longer system prompt'], a: 1,
    e: 'Without evals, every prompt change is a guess. 30–200 real examples with known-good answers beats almost anything else.' }
];

/* ---------- glossary ---------- */
C.glossary = [
  ['Token', 'A chunk of text the model reads and writes. ~4 characters of English.'],
  ['Context window', 'Maximum tokens the model can see at once — prompt plus answer.'],
  ['Embedding', 'A vector of numbers representing meaning. Similar meanings sit close together.'],
  ['Vector database', 'Storage optimised for finding the nearest vectors to a query vector.'],
  ['Transformer', 'The neural architecture behind modern LLMs, built on self-attention.'],
  ['Attention', 'Mechanism letting each token weigh the relevance of every other token.'],
  ['Parameters', 'The learned numbers inside a model. "70B" = 70 billion of them.'],
  ['Temperature', 'Randomness of token selection. 0 = deterministic, high = wild.'],
  ['Top-p', 'Sample only from the smallest set of tokens whose probabilities sum to p.'],
  ['Base model', 'Pretrained only. Completes text rather than following instructions.'],
  ['SFT', 'Supervised fine-tuning — training on curated instruction/answer pairs.'],
  ['RLHF / DPO', 'Preference tuning from human comparisons of candidate answers.'],
  ['RAG', 'Retrieval-Augmented Generation — look up relevant text, then generate.'],
  ['Chunking', 'Splitting documents into retrievable pieces before embedding them.'],
  ['Reranker', 'A second model that re-sorts retrieved chunks by true relevance.'],
  ['Hybrid search', 'Vector similarity combined with keyword search. Beats either alone.'],
  ['Hallucination', 'Confident output that is not grounded in fact or context.'],
  ['Grounding', 'Tying answers to supplied sources so they can be checked.'],
  ['Prompt injection', 'Untrusted text hijacking the instructions in your prompt.'],
  ['Tool / function calling', 'The model requests a function; your code runs it and returns the result.'],
  ['Agent', 'An LLM in a loop with tools, deciding its own next step.'],
  ['MCP', 'Model Context Protocol — a standard way to expose tools and data to models.'],
  ['System prompt', 'Standing instructions placed before the conversation.'],
  ['Few-shot', 'Including examples of the task directly in the prompt.'],
  ['Chain of thought', 'Prompting the model to reason step by step before answering.'],
  ['Quantization', 'Shrinking model weights (e.g. to 4-bit) for cheaper, faster inference.'],
  ['Distillation', 'Training a small model to imitate a large one.'],
  ['LoRA', 'Low-Rank Adaptation — cheap fine-tuning that trains a small add-on, not the whole model.'],
  ['Inference', 'Actually running the model to get an answer (as opposed to training it).'],
  ['Golden set', 'A fixed set of test inputs with known-good outputs, used as your regression suite.'],
  ['LLM-as-judge', 'Using a model to grade another model’s output against a rubric.'],
  ['Multimodal', 'Handles more than text — images, audio, video.'],
  ['Prompt caching', 'Reusing the processed prefix of a repeated prompt to cut cost and latency.'],
  ['Streaming', 'Sending tokens as they are generated so the user sees output immediately.']
];
