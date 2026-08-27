/* ============================================================
   Production & cost — shipping it, running it, paying for it.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'pd01', topic: 'production', level: 1,
  q: 'What are the cost optimisation techniques every AI engineer should know?',
  lay: 'Do not call the model. If you must, call a cheaper one. If you must call the expensive one, send it less. Make sure the bit you keep sending is identical so it gets cached. And do not pay for words nobody reads.',
  tech: 'In order of return on effort: <ol><li><b>Prompt caching</b> — up to ~90% off input tokens for a stable prefix, and it is nearly free to adopt. Biggest single lever in most systems.</li><li><b>Exact and semantic caching</b> — a hit costs milliseconds instead of dollars.</li><li><b>Model routing</b> — a cheap classifier sends the easy majority to a small model.</li><li><b>Shorten the input</b> — fewer retrieved chunks, tighter system prompt, truncated tool outputs.</li><li><b>Shorten the output</b> — output tokens cost 3–5× input. Structured output instead of prose, explicit brevity instructions, a max_tokens cap.</li><li><b>Batch APIs</b> — roughly 50% off for anything not interactive.</li><li><b>Trim conversation history</b> — cost grows quadratically with turns otherwise.</li><li><b>Distil</b> a small model for a high-volume narrow task.</li><li><b>Self-host</b> — only above a real volume threshold, and count the engineers.</li></ol>',
  trap: 'Measure before optimising. Break the bill down by feature, by model and by prompt component. It is routinely one endpoint, or one oversized system prompt, doing 80% of the damage.',
  tags: ['cost'], orig: 28 },

{ id: 'pd02', topic: 'production', level: 2,
  q: 'Walk me through how you would cut an LLM bill in half.',
  lay: 'Find out where the money goes first. It is almost never spread evenly — one feature, one prompt, or one retry loop is usually most of it.',
  tech: '<ol><li><b>Attribute</b> — cost per feature, per endpoint, per model, and cost per request p50/p99. You cannot cut what you cannot see.</li><li><b>Find the p99</b> — a small number of runaway requests (agent loops, enormous pasted documents) often dominates.</li><li><b>Cache</b> — check prompt-cache hit rate first; a timestamp near the top of the prompt is a common and expensive bug.</li><li><b>Route</b> — classify and send the easy majority to a small model. Typically the biggest structural saving.</li><li><b>Shrink the prompt</b> — audit what is actually in it. Oversized system prompts and unused few-shot blocks are common.</li><li><b>Cap outputs</b> — output tokens are the expensive half.</li><li><b>Move offline work to the batch API.</b></li><li><b>Re-measure</b> and check quality did not fall — every cost cut is a potential quality regression, so run the eval suite.</li></ol>',
  trap: 'Pair every cost change with a quality measurement. "We halved cost" is only good news alongside "and the eval score held". Otherwise you have discovered that a worse system is cheaper.',
  tags: ['cost'], orig: 28 },

{ id: 'pd03', topic: 'production', level: 2,
  q: 'What is model routing and how do you build one?',
  lay: 'A cheap gatekeeper that decides which model each request deserves. Most questions are easy; there is no reason to pay premium prices for all of them.',
  tech: 'Three implementations: <b>rules</b> (by intent, user tier, request length — cheap and brittle), <b>a classifier</b> (a small fine-tuned model or a logistic regression on features — fast, accurate, needs labelled data), or <b>a cascade</b> (the small model attempts first and a confidence check decides whether to escalate — no training needed, but you pay twice on escalation). Savings are structural: if 70% of traffic goes to a model costing a twentieth as much, total spend falls by roughly 65%. The critical piece is the escalation signal: use verifiable checks (does the output parse, does the citation exist, did retrieval succeed) rather than self-reported confidence.',
  trap: 'Measure quality per route separately, and keep a shadow sample where the expensive model also answers so you can quantify the gap you accepted. An unmeasured router is a silent quality regression.',
  tags: ['routing', 'cost'], orig: 27 },

{ id: 'pd04', topic: 'production', level: 2,
  q: 'What is context trimming and what is the right policy?',
  lay: 'Deciding what to throw away when the conversation no longer fits. The wrong answer — letting a library silently drop the oldest messages — takes your instructions with it.',
  tech: 'An explicit, ordered eviction policy: drop old verbatim turns first, then old tool outputs, then low-ranked retrieved documents. Never the system prompt, never the pinned facts. Combine with a rolling summary regenerated from the ORIGINAL transcript, a pinned facts block copied verbatim, and reserved headroom for the answer. Count tokens before sending and treat overflow as a normal branch rather than an exception.',
  code: `BUDGET = {                       # fractions of the window, must sum below 1
    "system":    0.12,           # pinned, first (prefix cache)
    "facts":     0.06,           # pinned, restated LAST in the prompt
    "summary":   0.14,           # regenerated from the original transcript
    "recent":    0.28,           # sliding window of verbatim turns
    "retrieved": 0.24,           # re-fetched per turn
    "answer":    0.16,           # RESERVED - never fill this
}
def assemble(window, parts):
    out, used = {}, 0
    for name in ["system", "facts", "summary", "recent", "retrieved"]:
        cap = int(window * BUDGET[name])
        out[name] = truncate(parts[name], cap)      # per-section policy
        used += count_tokens(out[name])
    assert used <= window * (1 - BUDGET["answer"]), "no headroom for the answer"
    return out`,
  trap: 'Reserving headroom for the answer is the step people miss. Running out there produces a truncated response, which users read as a model failure and your judge scores as incoherent.',
  tags: ['context', 'trimming'], orig: 27 },

{ id: 'pd05', topic: 'production', level: 2,
  q: 'How do you reduce end-to-end latency to under two seconds without losing quality?',
  lay: 'Measure where the time actually goes, then fix the biggest piece. It is usually one step nobody had timed — a reranker, a synchronous guardrail, or an unnecessarily long answer.',
  tech: '<ol><li><b>Trace the budget</b> — network, queue, retrieval, rerank, prefill, decode, guardrails, post-processing, at p95. Most teams cannot produce this, and that is the real problem.</li><li><b>Free wins first</b>: parallelise independent work (retrieval lanes, guardrails alongside generation), prompt caching, removing dead weight from the prompt.</li><li><b>Cut output length</b> — decode is usually the largest term and brevity is free.</li><li><b>Cache</b> — semantic cache turns a 2-second request into 30 ms on a hit.</li><li><b>Route</b> — a small model for easy requests.</li><li><b>Speculative decoding</b> for the tokens-per-second term.</li><li><b>Quality-costing levers last</b>: fewer retrieved chunks, skip the reranker, smaller model — and measure what each costs on the eval set rather than guessing.</li><li><b>Stream</b> — changes perception, not the number, but buys goodwill.</li></ol>',
  trap: 'Separate the free levers from the ones that trade quality, and say which is which. The question is usually phrased "without sacrificing quality", and the honest answer is that some levers do and you would measure the cost.',
  tags: ['latency'], orig: 33 },

{ id: 'pd06', topic: 'production', level: 2,
  q: 'What does an LLM observability stack look like?',
  lay: 'Every request leaves a trail: what was sent, what came back, what it cost, how long it took, and what was retrieved along the way. Without that, every bug report is a guess.',
  tech: 'Per request, logged with a trace id that appears in user-facing errors: rendered prompt (or hash plus template version), model id and version, sampling parameters, retrieved chunk ids with scores, tool calls with arguments and responses, token counts, cost, latency per stage, guardrail verdicts, and the output. Aggregate into dashboards: latency p50/p95/p99 by stage, cost per request p50/p99, error rate by class, cache hit rate, empty-retrieval rate, refusal rate, escalation rate, and judge scores on a sampled stream. Standards: OpenTelemetry GenAI conventions; platforms include LangSmith, Langfuse, Arize and Braintrust.',
  trap: 'Redact PII BEFORE logging. Tracing captures full prompts by default, which means personal data in your tracing vendor, frequently in another jurisdiction. It is the most common privacy failure in this stack.',
  tags: ['observability'], orig: 39 },

{ id: 'pd07', topic: 'production', level: 2,
  q: 'What alerts would you set up for an LLM feature?',
  lay: 'Alarm on rates and on money, not on individual errors. One timeout is weather; a timeout rate that doubled is an incident.',
  tech: '<ul><li><b>Latency</b> — p95 above SLO for 5 minutes.</li><li><b>Error rate</b> by class — timeouts, 429s, 5xx, schema failures — each with its own threshold.</li><li><b>Cost per request p99</b> — catches runaway loops that total spend hides.</li><li><b>Daily spend</b> against budget, with a projection.</li><li><b>Cache hit rate</b> dropping — usually someone changed the prompt prefix.</li><li><b>Empty-retrieval rate</b> rising — a corpus or ingestion problem.</li><li><b>Refusal rate</b> rising — often a model or prompt change.</li><li><b>Escalation rate</b> rising — the earliest quality signal you have.</li><li><b>Index freshness lag</b> — ingestion is stuck.</li><li><b>Judge score</b> on the sampled stream dropping.</li></ul>',
  trap: 'Cost per request p99 is the one people omit and then regret. Total spend looks normal while a handful of requests cost fifty times the median, and those are usually a loop you can fix in an afternoon.',
  tags: ['monitoring'], orig: 39 },

{ id: 'pd08', topic: 'production', level: 2,
  q: 'How do you deploy a prompt change safely?',
  lay: 'Treat it like a code change: version it, test it, roll it out gradually, and be able to switch back without a deploy.',
  tech: '<ol><li>Prompts in version control, reviewed as diffs.</li><li>Eval suite runs on the PR and gates the merge.</li><li>A version identifier attached to every request log and every cache key, so quality changes can be attributed.</li><li>Canary to 1–5% of traffic with automatic rollback on guardrail breach.</li><li>Rollback is a config flag, not a deploy.</li><li>Expect a cost spike on rollout: changing the prefix invalidates the prompt cache for every request until it warms.</li></ol>',
  trap: 'The prompt-cache invalidation cost is real and surprises people. A system-prompt edit can double your input bill for the warm-up period, which is a reason to batch prompt changes rather than shipping five a day.',
  tags: ['deployment'], orig: 28 },

{ id: 'pd09', topic: 'production', level: 2,
  q: 'How do you handle a model provider deprecating a model?',
  lay: 'Assume it will happen and be ready: never pin to "latest", keep a second provider working, and have an eval suite that can tell you within an hour whether the replacement is acceptable.',
  tech: 'Preparation: pin explicit model versions (never floating aliases) so nothing changes under you; keep an abstraction layer over provider SDKs, thin enough not to be a burden; maintain a portable prompt format and know which provider-specific features you depend on (structured output support, tool-calling format, system-prompt handling); and have an eval suite that can be pointed at a new model and produce a verdict quickly. Migration: run the eval, shadow the new model on live traffic, canary, then switch. Budget for prompt re-tuning — prompts genuinely do not port cleanly between model families.',
  trap: 'Floating aliases are the trap. "gpt-4o" resolving to a new snapshot means your behaviour changed silently, your evals are not comparable, and in a regulated setting your decisions are not reproducible.',
  tags: ['vendor', 'ops'] },

{ id: 'pd10', topic: 'production', level: 2,
  q: 'Why does LangChain (or any framework) exist, if the providers already have APIs?',
  lay: 'Because the API gives you one call, and an application needs a hundred things around it — loaders, splitters, retrievers, memory, tool plumbing, streaming, tracing and a way to swap providers. Frameworks are the glue, and you can write your own glue.',
  tech: 'What they genuinely provide: provider abstraction; document loaders and text splitters; retriever and vector-store integrations; prompt templating and output parsing; agent loops with tool schema generation; streaming and callback plumbing; checkpointing and durable interrupts (LangGraph); and tracing integration. What they cost: an abstraction layer between you and the exact prompt being sent, harder debugging when behaviour comes from framework internals, breaking changes, and a tendency to make simple things indirect. A reasonable position: use the pieces (splitters, loaders, a graph runtime with checkpointing) rather than adopting the whole opinionated stack, and always be able to print the exact prompt.',
  compare: { cols: ['Raw provider SDK', 'Framework'],
    rows: [
      ['Time to a prototype', 'hours', 'minutes'],
      ['Visibility into the prompt', 'total', 'often obscured'],
      ['Provider switching', 'you write the adapter', 'built in'],
      ['Integrations (loaders, stores)', 'you write them', 'dozens included'],
      ['Debugging', 'straightforward', 'harder — behaviour lives in the framework'],
      ['Durable interrupts, checkpointing', 'you build it', 'included (LangGraph, Temporal)'],
      ['Best for', 'a single well-understood flow', 'many integrations, complex graphs, HITL']
    ] },
  trap: 'The mature answer names both sides and gives a threshold: hand-roll a single agent loop (it is genuinely short), and adopt a framework when you need checkpointing, durable interrupts or a genuinely complex graph.',
  tags: ['frameworks'], orig: 42 },

{ id: 'pd11', topic: 'production', level: 2,
  q: 'What is async processing and when should an LLM feature be asynchronous?',
  lay: 'If it takes more than a few seconds, do not make the user hold the line. Return a ticket number and tell them when it is ready.',
  tech: 'Return a job id immediately, process in a queue, and deliver the result by webhook, websocket, polling or notification. Right for: document processing, batch enrichment, long agent runs, report generation, and anything using a batch API. Benefits beyond user experience: you can retry safely, you can rate-limit and prioritise, you get natural backpressure, and long work does not hold HTTP connections open. Requirements: durable job state, idempotent processing, a visible progress or status endpoint, and a defined behaviour when a job fails or is cancelled.',
  trap: 'Separate the interactive and batch paths from day one. Retrofitting the split later means untangling code that assumed a synchronous call, and it is always more work than it sounds.',
  tags: ['async', 'architecture'], orig: 55 },

{ id: 'pd12', topic: 'production', level: 2,
  q: 'How do you rate limit an LLM API you own?',
  lay: 'Limit by cost, not just by request count — one enormous prompt can cost more than a thousand small ones. And when you are over capacity, degrade deliberately rather than failing at random.',
  tech: 'Token-bucket limiters per user, per tenant and per API key, with limits expressed in TOKENS and money rather than request count. Add: a per-request maximum input size at the boundary; concurrency limits per principal; a priority queue so interactive traffic pre-empts batch; admission control that rejects or queues past the capacity knee; and clear 429 responses with a Retry-After that clients can respect. Communicate limits in response headers so well-behaved clients can self-throttle.',
  trap: 'The economics are asymmetric: an attacker spends one HTTP request and you spend dollars of GPU time. Any limiter based purely on request count is a limiter against polite users.',
  tags: ['rate-limit'], orig: 55 },

{ id: 'pd13', topic: 'production', level: 2,
  q: 'What is a fallback model strategy and how do you test it?',
  lay: 'A second-choice model ready when the first is down, throttled or too slow — plus the honesty to record that today\'s answer came from the understudy, and a regular drill to prove it still works.',
  tech: 'Tiers: primary → secondary (different provider, ideally different cloud) → a small local model → a canned response or human handoff. Requirements: portable prompts (different templates, tool-calling formats and structured-output support), an eval on the fallback so you know what quality you are accepting, the model id recorded on every response, and degraded answers excluded from the cache. Test it: a scheduled fire drill that forces failover in production for a short window, plus a CI test that exercises the fallback path.',
  trap: 'An untested fallback does not work. The failover path is exactly the code that has never run under load, and an incident is a bad time to discover the prompt does not port.',
  tags: ['reliability'], orig: 55 },

{ id: 'pd14', topic: 'production', level: 3,
  q: 'Design the deployment pipeline for an LLM feature.',
  lay: 'Same shape as normal software, with two extra things: an eval suite that runs like tests, and the ability to change prompts and models without a deploy.',
  tech: '<ol><li><b>Source control</b> for prompts, retrieval config, model versions and eval cases.</li><li><b>CI</b> — unit tests, deterministic assertions, a fast eval subset per commit; the full suite plus safety suite nightly.</li><li><b>Artifacts</b> — versioned prompt bundle, index version, model version pinned together as a release.</li><li><b>Staging</b> with production-shaped data and shadow traffic.</li><li><b>Canary</b> at 1–5% with automatic rollback on guardrail breach.</li><li><b>Progressive rollout</b> with A/B measurement for anything material.</li><li><b>Runtime config</b> — prompt version, model choice and feature flags changeable without a deploy, because your mean time to containment is otherwise your deploy time.</li><li><b>Observability</b> from day one; you cannot add it during an incident.</li></ol>',
  trap: 'Version the prompt, the model and the INDEX together as one release artifact. A rollback that reverts the prompt but not the index gives you a combination that was never tested.',
  tags: ['deployment', 'ci'], orig: 29 },

{ id: 'pd15', topic: 'production', level: 2,
  q: 'How do you decide between a hosted API and self-hosting?',
  lay: 'Volume, data rules, and whether you have people to run GPUs. Below a real threshold the API is cheaper once you count engineering time.',
  tech: 'Self-host when: volume is high enough that per-token pricing dominates (usually millions of tokens a day, and do the arithmetic); data cannot leave your network; you need a custom or unusual model; you need latency control without shared tenancy; or you cannot accept a provider\'s rate limits. Use an API when: volume is moderate; you want automatic access to better models; you do not have GPU operations expertise; or you are still finding product-market fit. Include in the comparison: GPU cost at your actual utilisation (a reserved GPU at 20% utilisation is expensive), engineering time, on-call burden, and the opportunity cost of not shipping features.',
  trap: 'Utilisation is the number that decides it. A reserved GPU costs the same at 10% and 90% utilisation, so self-hosting only wins when you can keep it busy — which usually means batch workloads alongside interactive ones.',
  tags: ['cost', 'serving'] },

{ id: 'pd16', topic: 'production', level: 2,
  q: 'How would you migrate from one LLM provider to another?',
  lay: 'Build the abstraction, run both against your eval set, shadow the new one on real traffic, canary, then switch — and expect to re-tune the prompts.',
  tech: '<ol><li><b>Abstraction layer</b> if you do not have one — thin, covering completion, tools and structured output.</li><li><b>Inventory the differences</b> — chat template, tool-calling format, structured-output support, system-prompt handling, token limits, sampling parameter names and semantics.</li><li><b>Run the eval suite</b> against the new provider. Expect a drop, because your prompts were tuned for the old one.</li><li><b>Re-tune prompts</b> and re-run.</li><li><b>Shadow</b> on live traffic; diff outputs, latency and cost.</li><li><b>Canary</b>, then progressive rollout with the model id on every response.</li><li><b>Keep the old path warm</b> for a while as a fallback.</li></ol>',
  trap: 'Budget for prompt re-tuning explicitly. Teams plan a two-day migration, discover a 15-point eval drop, and spend three weeks. Saying that up front is the experienced answer.',
  tags: ['migration', 'vendor'] },

{ id: 'pd17', topic: 'production', level: 2,
  q: 'What is a circuit breaker and where does it belong in an LLM system?',
  lay: 'When a dependency keeps failing, stop calling it for a while instead of piling on more requests. Fail fast, and give it room to recover.',
  tech: 'Track the failure rate on a dependency; when it crosses a threshold, open the circuit and fail immediately (or take the fallback path) for a cool-down; then half-open to test recovery with a trickle of traffic. Apply to: model providers, the vector database, rerankers, and each tool in an agent. Benefits: prevents cascading failure, stops a queue building faster than it drains, and turns a slow degradation into a fast, visible one you can route around.',
  trap: 'Pair it with a defined fallback. An open circuit that returns errors is only marginally better than timeouts; an open circuit that routes to a smaller model or a cached answer keeps the product working.',
  tags: ['reliability'], orig: 55 },

{ id: 'pd18', topic: 'production', level: 2,
  q: 'What is the difference between a cache hit rate and a cost saving?',
  lay: 'They are not the same number. A cache hit on a cheap request saves less than a miss on an expensive one, so you can raise the hit rate and barely move the bill.',
  tech: 'Hit rate is a count ratio; savings are cost-weighted. If your hits are concentrated on short, cheap requests and your misses are long RAG or agent requests, a 40% hit rate might be a 10% saving. Report both, and report cost saved per cache layer separately (prompt cache, exact cache, semantic cache) so you can see which is earning its complexity. The same applies in reverse: a small prompt-cache hit rate on very long prefixes can be an enormous saving.',
  trap: 'Always weight cache metrics by cost. It changes which optimisation you do next, and it is a cheap analysis that teams routinely skip.',
  tags: ['caching', 'cost'], orig: 28 },

{ id: 'pd19', topic: 'production', level: 2,
  q: 'How do you keep prompt caching working as your system evolves?',
  lay: 'Keep the top of the prompt boringly identical. Everything that changes goes at the bottom.',
  tech: 'Rules: stable content first (system prompt, tool schemas, few-shot block, the document being discussed); volatile content last (the user question, timestamps, session ids, retrieved chunks if they change per turn). Keep tool ordering deterministic — a shuffled list breaks the prefix. Never put a timestamp, request id or user name near the top. Batch prompt changes rather than shipping many small edits, because each invalidates the cache fleet-wide. Monitor the cache hit rate as a first-class metric and alarm when it drops.',
  trap: 'The classic bug: someone adds "Current time: {now}" to the top of the system prompt for a legitimate reason and the cache hit rate goes to zero. The fix is to move it to the bottom, and the way you find it is the alarm.',
  tags: ['caching', 'cost'], orig: 21 },

{ id: 'pd20', topic: 'production', level: 2,
  q: 'What SLOs would you set for an LLM feature?',
  lay: 'Promise things you can measure and defend: how fast, how available, how often it succeeds. Then set the alarm below the promise so you find out first.',
  tech: 'Typical set: <b>availability</b> (99.9% of requests return a valid response, including degraded ones), <b>latency</b> (p95 TTFT under 1s, p95 end-to-end under 3s), <b>quality</b> (task completion above X%, measured on a sampled stream), and <b>cost</b> (cost per request under a ceiling). Define what counts as success carefully — a degraded fallback answer counts as available, and a refusal on an answerable question does not count as a success. Set alerting thresholds tighter than the SLO so you have burn-rate warning.',
  trap: 'Quality SLOs need a measurement pipeline that runs continuously, not a quarterly evaluation. If you cannot measure it daily, do not promise it.',
  tags: ['slo', 'monitoring'] },

{ id: 'pd21', topic: 'production', level: 3,
  q: 'How do you handle capacity planning for a spiky LLM workload?',
  lay: 'Plan for the peak, not the average, and give the system a way to survive when the peak is bigger than you planned — queues, priorities, and a cheaper answer rather than no answer.',
  tech: '<ol><li><b>Measure the peak-to-average ratio</b> — typically 3–5×, higher for consumer products.</li><li><b>Provision for peak plus headroom</b> if self-hosting; use provisioned throughput plus on-demand overflow if using an API.</li><li><b>Queue with priority</b> — interactive ahead of batch, and shed the lowest-value traffic first and deliberately.</li><li><b>Degrade gracefully</b> — a smaller model, fewer retrieved chunks, cached answers, or a queue position with an honest wait estimate.</li><li><b>Autoscale on the right signal</b> — queue depth or KV cache occupancy, not CPU, and account for GPU cold-start time in the scaling policy.</li><li><b>Load test</b> at realistic prompt sizes; a benchmark with 200-token prompts tells you nothing about a 4,000-token RAG workload.</li></ol>',
  trap: 'GPU cold start is minutes, so scale-to-zero is usually unacceptable for interactive traffic. Keep a warm floor and scale above it.',
  tags: ['capacity'] },

{ id: 'pd22', topic: 'production', level: 2,
  q: 'What is graceful degradation for an AI feature?',
  lay: 'When something breaks, give people less rather than nothing — and tell them it is less.',
  tech: 'A ladder: full quality → smaller model → cached or template answer → retrieval-only (show the sources without a generated answer) → an honest error with a route to a human. Every rung must be marked so the answer is not cached and so analysis does not mix populations. Triggers: timeout, rate limit, circuit open, budget exhausted, low confidence. Design the rungs before the incident, because during one you will pick whatever is easiest.',
  trap: 'Retrieval-only is the underrated rung: showing the three most relevant documents with no generated answer is often genuinely useful and costs nothing when the model is unavailable.',
  tags: ['reliability'], orig: 37 },

{ id: 'pd23', topic: 'production', level: 2,
  q: 'How do you version an AI system so results are reproducible?',
  lay: 'Everything that could change the answer gets a version number, and they ship together as one release.',
  tech: 'Version and record together: model id and explicit version; prompt template version; retrieval config (embedding model, chunking parameters, k, reranker); index version or snapshot; guardrail config; and the code. Log the full set on every request. Ship them as one artifact so a rollback reverts the combination rather than one component. This is what makes "why did the system say that on 3 March" answerable, and it is a hard requirement in regulated settings.',
  trap: 'The index is the component people forget to version. Rolling back the prompt while the index has moved on gives you a combination that was never evaluated.',
  tags: ['versioning'], orig: 39 },

{ id: 'pd24', topic: 'production', level: 2,
  q: 'What is a canary deployment and what would you watch during one?',
  lay: 'Send a small slice of real traffic to the new version and watch a handful of numbers. If any of them move the wrong way, it goes back automatically.',
  tech: 'Route 1–5% of traffic to the new version, keyed by a stable user id, and monitor: error rate, p95 latency, cost per request, refusal rate, escalation rate, and judge scores on the sampled stream. Set automatic rollback on any guardrail breach. Run long enough to cover a full traffic cycle, and segment the analysis — a change that helps most users and destroys one cohort looks fine in aggregate.',
  trap: 'Give the canary long enough for the prompt cache to warm. A cold cache makes the new version look slower and more expensive than it is, and teams roll back good changes for that reason.',
  tags: ['deployment'], orig: 48 },

{ id: 'pd25', topic: 'production', level: 2,
  q: 'How do you manage secrets and credentials for an agent?',
  lay: 'The agent should never see a credential. Your code holds them, uses the narrowest one for each call, and the model only ever sees the result.',
  tech: 'Rules: credentials live in a secret manager and are injected into the tool implementation, never into the prompt or the tool schema; each tool uses the narrowest scope it needs (a read-only key for a read tool); use short-lived tokens where available; act on behalf of the user with their own permissions rather than a broad service account where the platform supports it; and never log credentials, including in traces where prompts and tool arguments are captured by default.',
  trap: 'The failure to name: a credential in the context window is now in your logs, your traces, your provider\'s systems and potentially in a cached prefix. Once it is in the prompt it has leaked in several places at once.',
  tags: ['security', 'secrets'] },

{ id: 'pd26', topic: 'production', level: 2,
  q: 'What is the cost of a multi-turn conversation, and why does it surprise people?',
  lay: 'Every turn resends the whole conversation so far. Turn thirty is not the same size as turn one, so the total cost grows with the square of the number of turns.',
  tech: 'With a stateless API, input tokens at turn n are roughly the sum of all previous turns, so cumulative cost is O(n²). A 30-turn conversation at 200 tokens per turn sends about 93,000 cumulative input tokens rather than 6,000. Mitigations: prompt caching (the shared prefix is cached, which flattens most of the curve), sliding window plus rolling summary, and retrieval over history instead of resending it. This is the arithmetic behind every context-management technique.',
  code: `def conversation_tokens(turns, per_turn=200, system=800):
    total = 0
    for n in range(1, turns + 1):
        total += system + per_turn * n          # resend everything each time
    return total

print(conversation_tokens(10))    # ~19,000
print(conversation_tokens(30))    # ~117,000  - 6x the turns, 6x the cost per turn`,
  trap: 'Prompt caching changes the economics dramatically here, because the growing prefix is exactly what caching is good at. Measure your cached-token ratio on long conversations before optimising anything else.',
  tags: ['cost', 'context'], orig: 28 },

{ id: 'pd27', topic: 'production', level: 3,
  q: 'How do you run an incident for an AI feature?',
  lay: 'Turn it off or route around it first, work out what changed, fix it, then add the test that would have caught it.',
  tech: '<ol><li><b>Detect</b> — from alarms, ideally, not from customers.</li><li><b>Contain</b> — feature flag off, roll back the prompt version, or route to the fallback. Config, not deploy.</li><li><b>Diagnose</b> — what changed: prompt version, model version, index version, a dependency, or traffic mix. The version log makes this a lookup rather than an investigation.</li><li><b>Assess impact</b> — how many requests, which tenants, what was exposed.</li><li><b>Fix and verify</b> against the eval suite before re-enabling.</li><li><b>Regression case</b> — the incident becomes a permanent eval case.</li><li><b>Post-mortem</b> — why did the control not exist, why did detection take as long as it did.</li></ol>',
  trap: 'The AI-specific complication: "what changed" often includes something you did not change — a provider updated a model behind a floating alias. Pinned versions turn that from a mystery into a non-event.',
  tags: ['incident', 'ops'] },

{ id: 'pd28', topic: 'production', level: 2,
  q: 'What is the difference between provisioned throughput and on-demand?',
  lay: 'Reserved capacity you pay for whether or not you use it, versus paying per request with everyone else. Reserved is cheaper if you keep it busy and more predictable under load.',
  tech: 'Provisioned throughput reserves dedicated capacity at a fixed price with guaranteed rate limits and more predictable latency. On-demand is pay-per-token on shared infrastructure, subject to shared rate limits and noisy-neighbour latency variance. The decision is utilisation: reserved wins above a break-even utilisation you can compute. The common architecture is a provisioned base for steady traffic with on-demand overflow for peaks, which gives you predictable cost and elastic headroom.',
  trap: 'Reserved capacity at low utilisation is worse than on-demand, and teams commit to it based on peak rather than average. Compute the break-even and measure your actual utilisation for a month first.',
  tags: ['cost', 'capacity'] },

{ id: 'pd29', topic: 'production', level: 2,
  q: 'How do you test an LLM feature in CI without spending a fortune?',
  lay: 'Record real responses once and replay them for most tests. Only call the real model on a small suite, and only on the changes that need it.',
  tech: 'Layers: <ul><li><b>Unit tests</b> with recorded fixtures — deterministic, free, fast, covering parsing, validation, error handling and control flow.</li><li><b>A smoke suite</b> of 10–20 real calls per commit against a cheap model.</li><li><b>The full eval suite</b> nightly, with a cost budget.</li><li><b>Cache by prompt hash</b> in CI so an unchanged prompt does not re-call.</li><li><b>A cost ceiling per CI run</b> that fails the build if exceeded — a runaway test loop should not cost a thousand dollars.</li></ul>',
  trap: 'Record-and-replay is the technique that makes this practical. Most of your logic is not the model — it is the code around it — and that code deserves fast deterministic tests.',
  tags: ['ci', 'testing'] },

{ id: 'pd30', topic: 'production', level: 2,
  q: 'What is drift in an LLM system, and how do you detect it?',
  lay: 'Nothing changed on your side and it got worse anyway — because the users changed, the documents changed, or the provider quietly updated the model.',
  tech: 'Sources: <b>input drift</b> (users ask new things — new products, new jargon, a new market), <b>corpus drift</b> (documents change, categories shift), <b>model drift</b> (the provider updated a floating alias), and <b>judge drift</b> (your evaluator changed). Detection: track the distribution of input embeddings over time and alarm on divergence; monitor empty-retrieval and refusal rates; run the frozen eval set nightly and chart the score across releases; and pin model versions so provider updates are a deliberate event. Respond by adding the new traffic to the eval set and to the corpus.',
  trap: 'Chart your eval score over releases, not just against the previous one. Half a point lost per release is invisible release to release and obvious over six months.',
  tags: ['drift', 'monitoring'], orig: 39 },

{ id: 'pd31', topic: 'production', level: 2,
  q: 'What does "the same question a hundred different ways" cost you, and what do you do about it?',
  lay: 'You pay full price for the same answer four thousand times a day. The fix is layered caching: normalise the text, keep the prompt prefix stable, and add a meaning-based layer with a threshold you actually measured.',
  tech: '<ol><li><b>Normalise and hash</b> — lowercase, collapse whitespace, strip punctuation. An afternoon of work, multiplies exact-match hit rate.</li><li><b>Prefix caching</b> — stable content at the top of the prompt. Nearly free, cuts input cost and TTFT.</li><li><b>Semantic layer</b> — embed the normalised question, search past questions, serve above a tuned threshold. 25–50% hit rates on FAQ-shaped traffic.</li><li><b>The key is the design</b> — normalised question, tenant, locale, user tier, prompt version, model id, and a hash of retrieved chunk ids plus their versions. That last part makes invalidation automatic.</li><li><b>Guards</b> — negative caching against penetration, single-flight against stampede, TTL jitter against avalanche, never cache a degraded answer.</li><li><b>Measure</b> both hit rate AND wrong-answer rate on a labelled sample.</li></ol>',
  trap: 'Only the semantic layer can be wrong, so it is the only one whose threshold is a customer-facing decision. Tune it against labelled paraphrases, not against a hit-rate target.',
  tags: ['caching'], orig: 1 },

{ id: 'pd32', topic: 'production', level: 2,
  q: 'How do you monitor quality continuously rather than only in CI?',
  lay: 'Sample a small share of live traffic, run the same checks you run in tests, and chart the result. Most of those checks need no model.',
  tech: 'A continuous evaluation stream: sample 1–5% of production requests; run deterministic checks on all of them (schema validity, citation existence, refusal detection, latency); run a judge on a smaller sample for faithfulness and relevance; and route disagreements and low scores into a human review queue. Chart the metrics daily, segmented by intent, tenant and language. This is what catches drift, and it is also where new eval cases come from.',
  trap: 'Sampling must be stratified, not random. Random sampling of traffic that is 80% one easy intent tells you almost nothing about the other 20% where the failures live.',
  tags: ['monitoring', 'eval'], orig: 57 },

{ id: 'pd33', topic: 'production', level: 2,
  q: 'What is the operational difference between a RAG system and a normal web service?',
  lay: 'It has a second database that has to stay in sync with the first, its answers can be wrong without erroring, and its cost per request varies by a factor of a hundred.',
  tech: 'Three differences that change how you operate it: <ol><li><b>A derived index</b> that can drift from the source, so you need freshness monitoring, reconciliation and a rebuild path.</li><li><b>Silent failure</b> — a wrong answer returns HTTP 200. Your error rate can be zero while the product is broken, so quality monitoring is not optional the way it is for a CRUD service.</li><li><b>Variable cost per request</b> — prompt size and output length vary enormously, so cost is a metric to alarm on rather than a fixed line item.</li></ol>Plus: non-deterministic output makes testing probabilistic, and a third-party dependency (the model provider) sits on your critical path with its own rate limits and incidents.',
  trap: 'The silent-failure point is the one that reframes the conversation. Traditional monitoring tells you the service is healthy while it confidently answers every question wrongly.',
  tags: ['ops', 'rag'] },

{ id: 'pd34', topic: 'production', level: 2,
  q: 'How do you handle model outputs that need to be idempotent?',
  lay: 'Give every action a key derived from what it is meant to do, so retrying after a timeout cannot do it twice.',
  tech: 'Derive a deterministic idempotency key from the logical action — for example a hash of (order id, refund amount, reason) — and pass it to the downstream system, which deduplicates on it. This matters because LLM calls time out and get retried, and an agent that retries a refund without a key issues two refunds. Store the key and the outcome so a replay returns the original result. Combine with checkpointing so an agent resuming from a checkpoint does not repeat a completed side effect.',
  trap: 'The key must come from the ACTION, not from the request. A random uuid per attempt makes every retry a new action, which is exactly what you were trying to prevent.',
  tags: ['reliability', 'idempotency'] },

{ id: 'pd35', topic: 'production', level: 3,
  q: 'What would you put in a production readiness review for an LLM feature?',
  lay: 'Can you measure it, can you turn it off, do you know what it costs, and do you know what happens when each piece breaks?',
  tech: '<ul><li><b>Evaluation</b> — a frozen eval set exists, runs in CI, and gates deploys. Baseline numbers recorded.</li><li><b>Observability</b> — traces with prompt, retrieval ids, model version, cost and latency; dashboards; alerts.</li><li><b>Failure handling</b> — a named branch for empty retrieval, timeout, rate limit, context overflow, budget exhaustion and tool failure.</li><li><b>Cost</b> — cost per request measured, a per-request ceiling enforced, a daily budget alarm.</li><li><b>Safety</b> — input and output guards, tenant isolation tested in CI, PII redacted before logging.</li><li><b>Rollback</b> — prompt, model and index versions pinned and revertible by config.</li><li><b>Kill switch</b> — tested.</li><li><b>Freshness</b> — index lag measured and alarmed, delete path tested.</li><li><b>Runbook</b> — what to do for each alert, written before launch.</li></ul>',
  trap: 'The kill switch and the rollback path are the two that must be tested rather than merely present. Everything else can be fixed during an incident; those two are what let you have the incident calmly.',
  tags: ['checklist', 'process'], orig: 17 },

{ id: 'pd36', topic: 'production', level: 2,
  q: 'How do you estimate the cost of an AI feature before building it?',
  lay: 'Sketch the token counts for one request, multiply by expected traffic, and multiply again for the parts you forgot — retries, the guardrail model, the reranker, and the conversation history.',
  tech: 'Build a per-request model: system prompt + tool schemas + retrieved context + user input = input tokens; expected output tokens; multiply by the price of each; sum over every model call in the path (main call, judge, guardrail, rewriter, reranker); add a retry factor; then multiply by requests per day. Compute p50 and p99, because agent and long-document paths have heavy tails. Then apply the discounts you expect (prompt caching, batch API) and state them as assumptions. Sanity-check against a small live experiment before committing to a number.',
  trap: 'The forgotten terms are always the same: tool schemas on every call, the guardrail pass, retries, and conversation history growth. Listing them explicitly is what makes an estimate credible.',
  tags: ['cost', 'planning'], orig: 28 },

{ id: 'pd37', topic: 'production', level: 2,
  q: 'What is a feature flag strategy for AI features?',
  lay: 'Every model, prompt and retrieval setting should be switchable at runtime — per user, per tenant, per percentage — without shipping code.',
  tech: 'Flag: which model, which prompt version, whether the reranker runs, k, whether guardrails are enforced or shadow-only, and whether the feature is on at all. Scope flags per user, per tenant and per percentage so you can canary and so you can disable for one customer without disabling for everyone. Requirements: flag evaluation on the request path with a low-latency cache; the flag state recorded in the request log so behaviour can be attributed; and a documented default when the flag service is unavailable.',
  trap: 'Record the flag state in the log. Without it, you cannot tell whether a bad response came from the old path or the new one, and your A/B analysis is mixing populations.',
  tags: ['deployment'] },

{ id: 'pd38', topic: 'production', level: 3,
  q: 'How do you handle a provider outage?',
  lay: 'Detect it fast, stop hammering it, switch to the backup, and tell users honestly that they are getting a reduced service.',
  tech: '<ol><li><b>Detect</b> — error rate and latency alarms, plus a synthetic health check independent of user traffic.</li><li><b>Circuit break</b> — stop calling immediately rather than queueing; a queue that fills during an outage makes recovery worse.</li><li><b>Fail over</b> to the secondary provider, marking responses as degraded.</li><li><b>Degrade further</b> if the secondary is also unavailable: cached answers, retrieval-only, or an honest error with a route to a human.</li><li><b>Communicate</b> — a status banner beats silence.</li><li><b>Recover carefully</b> — half-open the circuit and ramp, rather than sending the full backlog at a recovering service.</li></ol>',
  trap: 'The backlog is the second incident. Draining a queue at full rate into a service that has just recovered knocks it over again — ramp, and consider dropping stale queued requests entirely.',
  tags: ['incident', 'reliability'], orig: 55 },

{ id: 'pd39', topic: 'production', level: 2,
  q: 'What does "streaming" mean in a production LLM system, and what are the gotchas?',
  lay: 'Showing words as they arrive. It makes waiting bearable and it makes checking the answer before showing it impossible.',
  tech: 'Server-sent events or websockets delivering tokens as generated. It improves perceived latency only — total time and cost are unchanged, and TTFT is unaffected. Gotchas: output guardrails cannot inspect what has already been shown (buffer, or validate incrementally at sentence boundaries); mid-stream errors need a protocol, because the client has rendered half an answer; structured output cannot be validated until complete; client reconnection needs a resume story or the user loses the answer; and load balancers and proxies need configuration for long-lived connections.',
  trap: 'The guardrail conflict is the real design decision, and it is a decision rather than a detail: buffer and lose the streaming benefit, validate incrementally and accept partial exposure, or accept the risk explicitly.',
  tags: ['streaming'], orig: 26 },

{ id: 'pd40', topic: 'production', level: 2,
  q: 'How do you decide what to build in-house versus buy?',
  lay: 'Buy the parts that are not your product. Build the parts that are. And check what the "free" open-source option costs to operate.',
  tech: 'Buy: the model (unless you are a model company), observability, evaluation tooling, vector database (managed, unless you already run Postgres well), and guardrail classifiers. Build: your retrieval logic, your prompts, your evaluation cases, your domain guardrails, and your harness — those encode your product understanding and no vendor has it. The honest cost comparison for anything self-hosted includes engineering time, on-call, upgrades and the opportunity cost of features not shipped.',
  trap: 'The build-it-yourself trap in this space is the eval harness and the observability layer — both look like a weekend and both become a team. The custom retrieval logic, which people assume they should buy, is usually where the differentiation actually is.',
  tags: ['strategy'] },

{ id: 'pd41', topic: 'production', level: 2,
  q: 'What is the difference between p50, p95 and p99, and which do you optimise?',
  lay: 'Half your users are faster than p50. One in twenty is slower than p95. One in a hundred is slower than p99. Users judge you on the slow ones.',
  tech: 'Optimise p95 for user experience and watch p99 for the tail that generates support tickets. Means are actively misleading in this domain because the distribution is heavy-tailed — one 40-second agent run drags the mean and hides a healthy median. For LLM systems, report TTFT and end-to-end separately at each percentile, and remember that p99 latency is often dominated by queueing under load rather than by model time, which is invisible in a local benchmark.',
  trap: 'With multiple sequential dependencies, tail latencies compound: five services each at p99 = 1s means the combined p99 is much worse than 1s. Hedging and parallelisation are the standard answers.',
  tags: ['latency', 'metrics'] },

{ id: 'pd42', topic: 'production', level: 3,
  q: 'What single change has the biggest impact on a typical LLM application in production?',
  lay: 'Measuring it. Almost every system that is not working has no eval set, and almost every team with one knows exactly what to fix next.',
  tech: 'The ranked list of what actually moves the needle in practice: <ol><li><b>An eval set</b> — 50 real cases with expected outcomes. Turns opinion into measurement.</li><li><b>Retrieval metrics</b> if it is a RAG system — most "the model hallucinated" tickets are retrieval tickets.</li><li><b>Prompt caching</b> — the largest cost lever, nearly free.</li><li><b>Observability</b> — you cannot debug what you did not log.</li><li><b>Model routing</b> — the largest structural cost saving.</li><li><b>Explicit failure branches</b> — empty retrieval, timeout, budget, each named rather than discovered.</li></ol>',
  trap: 'Notice that four of the six are measurement and plumbing rather than model work. That ordering is the answer, and it is what distinguishes people who have shipped from people who have prototyped.',
  tags: ['process'], orig: 29 }

]);
