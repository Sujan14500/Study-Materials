/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: prompt injection ---------- */
C.toolstrips.injection = {
  title: 'Tools & frameworks — defending against injection',
  sub: 'Layered, because none of these is reliable alone. Only the last one is deterministic, and that is the one that actually holds.',
  tools: [
    { n: 'Lakera Guard', by: 'Lakera', mark: 'lk', c: '#fb7185',
      what: 'One low-latency API call that classifies prompts and responses for injection, jailbreaks and PII.',
      pro: ['Replaces assembling five open-source checkers', 'Trained on a very large corpus of real attacks', 'Built to answer in tens of milliseconds'],
      con: ['Another vendor sees your prompts', 'A black-box classifier you cannot inspect'],
      use: 'You want managed detection without maintaining classifiers yourself.' },
    { n: 'Azure Prompt Shields', by: 'Microsoft', mark: '🛡', c: '#0078d4',
      what: 'Managed detection for jailbreaks and, importantly, indirect injection hidden in documents.',
      pro: ['Explicitly targets indirect injection, which most tools ignore', 'Comes with groundedness detection for hallucinations', 'Inside an existing Azure compliance boundary'],
      con: ['Azure only', 'Thresholds are a product decision someone must own'],
      use: 'Azure applications, especially agents that read untrusted documents.' },
    { n: 'LLM Guard', by: 'Protect AI', mark: 'lg', c: '#7c5cff',
      what: 'An open-source set of input and output scanners: injection, secrets, PII, toxicity, relevance.',
      pro: ['Free and self-hosted, so prompts never leave', 'Composable scanners you enable individually', 'Covers both directions of the call'],
      con: ['You run and update it yourself', 'Detection quality trails the commercial services'],
      use: 'Prompts cannot leave your network but you still want classification.' },
    { n: 'Presidio', by: 'Microsoft', mark: '🕵', c: '#0f62fe',
      what: 'PII detection and reversible anonymisation, applied before the request leaves your network.',
      pro: ['Redact before, restore after, so the answer still makes sense', 'Custom recognisers for your own ID formats', 'Mature, and not LLM-specific'],
      con: ['NER recall is not perfect', 'Pair with structural controls for regulated data'],
      use: 'Anything user-typed heading for a hosted model, and de-identifying traces.' },
    { n: 'A policy boundary in code', by: 'this project', mark: '{}', c: '#34d399',
      what: 'The model proposes; a deterministic function decides. Eligibility, limits and approval live in Python.',
      pro: ['Cannot be talked out of it by any prompt', 'Unit-testable, so the rules have regression tests', 'Costs nothing and adds no latency'],
      con: ['You must enumerate the rules yourself', 'Says nothing about answer quality'],
      use: 'Every irreversible action, always. This is the defence the whole chapter is about.' }
  ]
};

/* ---------- Ch: idempotency ---------- */
C.toolstrips.idem = {
  title: 'Tools & frameworks — exactly-once side effects',
  sub: 'Retries are not optional in a distributed system, so every write must be safe to attempt twice. These are the four standard mechanisms.',
  tools: [
    { n: 'Idempotency keys', by: 'Stripe pattern', mark: '🔑', c: '#635bff',
      what: 'A stable key derived from the intent, stored with the result, so a repeat returns the first outcome.',
      pro: ['The industry-standard answer, from payments not from AI', 'Turns a retry from dangerous into free', 'The key store doubles as an audit log'],
      con: ['Key derivation must be stable across retries', 'The downstream system has to honour it'],
      use: 'Every write with a real-world effect. Non-negotiable in a refund flow.' },
    { n: 'A ledger table', by: 'PostgreSQL', mark: '🐘', c: '#336791',
      what: 'Append-only rows recording every attempted and completed action, with a unique constraint on the key.',
      pro: ['The database enforces uniqueness, not your code', 'Full history for reconciliation and disputes', 'Transactional with the rest of the write'],
      con: ['Grows forever without archiving', 'Unique-violation handling must be explicit'],
      use: 'Anywhere money or state changes and someone will later ask what happened.' },
    { n: 'Redis SETNX + TTL', by: 'Redis', mark: '⚡', c: '#dc382d',
      what: 'A short-lived lock so two concurrent attempts at the same action cannot both proceed.',
      pro: ['Fast enough to sit in the request path', 'TTL means a crashed holder does not deadlock', 'Simple to reason about'],
      con: ['A lock is not durable — it prevents concurrency, not repetition', 'Clock and expiry edge cases are real'],
      use: 'In front of the ledger, to collapse a double-click into one attempt.' },
    { n: 'Temporal', by: 'Temporal', mark: '⏱', c: '#f472b6',
      what: 'Durable execution: a completed activity is recorded, so a replay after a crash does not re-run it.',
      pro: ['Exactly-once semantics for the workflow as a whole', 'Retries and timeouts declared per activity', 'Survives far more than a process restart'],
      con: ['A cluster to run and a real learning curve', 'Heavy for a single refund call'],
      use: 'Multi-step processes where a partial failure must not leave money in limbo.' }
  ]
};

/* ---------- Ch: tenant isolation ---------- */
C.toolstrips.isolation = {
  title: 'Tools & frameworks — multi-tenant isolation',
  sub: 'The rule this chapter enforces: isolation is a property of the query, not of the prompt. These are the four places to enforce it.',
  tools: [
    { n: 'Row-Level Security', by: 'PostgreSQL', mark: '🐘', c: '#336791',
      what: 'A policy on the table so a session can only ever see rows matching its tenant, whatever SQL runs.',
      pro: ['The database enforces it, so a generated query cannot escape', 'Survives a bug in the application layer', 'One policy covers every code path'],
      con: ['Policies add planning overhead on hot queries', 'Requires discipline about setting the session variable'],
      use: 'Any multi-tenant database an LLM writes queries against.' },
    { n: 'Namespaces', by: 'Pinecone / Qdrant / Weaviate', mark: '⊞', c: '#0b7285',
      what: 'Hard partitions inside one vector index, so a search is scoped before it begins.',
      pro: ['Cannot leak across tenants even with a wrong filter', 'Deleting a tenant is deleting a namespace', 'No per-query filtering cost'],
      con: ['Very many tenants means very many namespaces to manage', 'Cross-tenant analytics becomes awkward'],
      use: 'Vector retrieval where a metadata filter is not a strong enough boundary.' },
    { n: 'Scoped credentials', by: 'IAM / database roles', mark: '🔒', c: '#ff9900',
      what: 'The agent runs as a role that can only read what this tenant is allowed to read.',
      pro: ['Least privilege enforced outside your code entirely', 'A compromised prompt still cannot reach other data', 'Auditable in the platform, not in your logs'],
      con: ['Role sprawl at scale', 'Connection pooling per role costs resources'],
      use: 'The strongest boundary available. Use it wherever the platform supports it.' },
    { n: 'A test that tries to escape', by: 'pytest', mark: '🧪', c: '#009688',
      what: 'A test that deliberately asks for another tenant\'s data and asserts it comes back empty.',
      pro: ['Turns the security property into a regression test', 'Catches the refactor that drops the filter', 'Cheap and fast to run on every commit'],
      con: ['Only covers the paths you thought of', 'Needs realistic multi-tenant fixtures'],
      use: 'Every isolation boundary. An untested boundary is an assumption.' }
  ]
};

/* ---------- Ch: the eval gate ---------- */
C.toolstrips.evals = {
  title: 'Tools & frameworks — the eval gate',
  sub: 'The point of a gate is that it blocks the merge. An eval suite nobody enforces is a dashboard, not a gate.',
  tools: [
    { n: 'pytest', by: 'pytest', mark: 'pt', c: '#009688',
      what: 'Evals as ordinary tests, so the existing CI already blocks the merge when they fail.',
      pro: ['No new infrastructure and no new runner', 'Parametrize turns the case file into individual tests', 'The team already knows how to read a failure'],
      con: ['Model calls make the suite slow and non-deterministic', 'Needs caching or mocking to stay affordable'],
      use: 'The default. Evals that live outside CI stop being run within a month.' },
    { n: 'Promptfoo', by: 'Promptfoo', mark: 'pf', c: '#fbbf24',
      what: 'Declarative cases and assertions in YAML, with a matrix across prompts and models.',
      pro: ['Prompt changes become reviewable in a pull request', 'Most assertions are deterministic and therefore free', 'Red-team mode probes for injection and jailbreaks'],
      con: ['Not a tracing platform', 'LLM-graded assertions cost real money'],
      use: 'Comparing prompts or models, and adversarial testing before a release.' },
    { n: 'Ragas', by: 'Exploding Gradients', mark: '📏', c: '#60a5fa',
      what: 'Faithfulness, answer relevancy and context precision, computed without gold answers.',
      pro: ['Start measuring with no labelled data', 'Separates retrieval failures from generation failures', 'Can synthesise a starting test set'],
      con: ['Judge-model dependent, so treat as a trend', 'Costs a call per metric per case'],
      use: 'The retrieval half of a RAG system, where a pass/fail assertion is too blunt.' },
    { n: 'Langfuse', by: 'Langfuse', mark: 'lf', c: '#34d399',
      what: 'Production traces that become the next version of the eval set.',
      pro: ['The best test cases are real failures, and this is where they live', 'Self-hostable, so customer data stays put', 'Cost and latency per trace alongside quality'],
      con: ['A stack to operate', 'Turning traces into cases still needs a human'],
      use: 'Feeding real production failures back into the offline suite.' },
    { n: 'A frozen case file', by: 'this project', mark: '📄', c: '#a78bfa',
      what: 'A checked-in JSON of inputs and expected outcomes, versioned with the code that must satisfy it.',
      pro: ['Reviewable in a diff, like any other requirement', 'No vendor and no runtime dependency', 'Every fixed bug becomes a permanent case'],
      con: ['Goes stale unless someone owns it', 'Only covers what you thought to write down'],
      use: 'From the first week. It is the cheapest thing on this list and the most neglected.' }
  ]
};
