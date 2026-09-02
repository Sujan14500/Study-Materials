/* ============================================================
   Production drills — the "can you actually run it?" round.

   Forty scenario questions about keeping a GenAI system alive:
   scale, tail latency, provider failover, caching, circuit
   breakers, backpressure, shedding, least privilege, rollout.

   These overlap deliberately with "Production & cost". That topic
   asks what a thing is; this one drops you into the incident and
   asks what you do. Interviewers ask both, and candidates who can
   define a circuit breaker still freeze when asked where to put it.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'po01', topic: 'prodops', level: 2,
  q: 'Your system works for 100 users. What changes at 100,000?',
  lay: 'Adding more copies of your own service is the easy half, and it is the half that stops helping first. The things that break next belong to other people: the model provider, the search database, the tools you call.',
  tech: 'Three shifts. <b>The bottleneck moves off your fleet</b> — provider requests-per-minute and tokens-per-minute quota, vector database connections, third-party tool limits. <b>The concurrency model has to change</b>: one thread per request is fine at 100 users and is 100,000 open sockets waiting on a five-second generation at scale, so you decouple with a queue and a bounded worker pool sized against the provider quota rather than the CPU count. <b>Shared state becomes the limit</b>: rate-limit counters, caches and connection pools must be shared rather than per-instance, or ten replicas each allowing 100 requests a minute quietly become a 1,000-per-minute limit nobody agreed to.',
  dgm: { nodes: ['users spike', { t: 'gateway', s: 'per-tenant limits' }, { t: 'queue', s: 'backpressure', k: 'alt' }, { t: 'worker pool', s: 'concurrency = quota' }, 'orchestrator'],
    cap: 'The queue exists so the worker count, not the arrival rate, decides how hard you hit the provider.' },
  trap: 'The answer that fails is "autoscale the API servers". Say out loud that scaling servers does not scale your model quota, and that you would ask the provider for the increase before launch rather than during it.',
  tags: ['scale', 'capacity'],
  xref: [['Capacity arithmetic, with sliders', '../ai_system_design_concepts/index.html']] },

{ id: 'po02', topic: 'prodops', level: 2,
  q: 'You have a 2-second latency budget and the model takes 5 seconds. What do you do?',
  lay: 'First find out where the five seconds actually went, because it is often not where people assume. Then separate the fixes that are free from the fixes that cost you quality, and say which is which.',
  tech: 'Trace the request into spans first — network, retrieval, rerank, prefill, decode, guardrails, post-processing, at p95. Teams routinely find a reranker or a synchronous guardrail nobody had timed. Then, free levers: parallelise independent work, prompt-cache the stable prefix, cut output length (decode is usually the largest term), stream. Then quality-costing levers, each measured against the eval set: fewer retrieved chunks, skip the reranker, a smaller model. Streaming does not change the total; it changes time to first token from 5.5s to about 0.5s, which is the number the user experiences as waiting.',
  trap: 'The question is usually phrased "without sacrificing quality". The honest answer is that some levers do sacrifice quality, and you would quantify each one on the eval set rather than guess.',
  tags: ['latency', 'streaming'] },

{ id: 'po03', topic: 'prodops', level: 2,
  q: 'The LLM provider has an outage. How does your system stay online?',
  lay: 'One model endpoint you do not own is a single point of failure you cannot fix. So the choice of provider belongs to a router in your system, not hard-coded into the call.',
  tech: 'A provider router owns health state and fails over on <b>error class</b>, not on any error: 500s, timeouts and sustained 429s mean try the backup, while a 400 means your request is malformed and the backup will reject it identically. Behind it: a circuit breaker per provider so a dead endpoint stops consuming threads, a degradation path when every provider is down (semantic cache, then an honest "I cannot answer right now"), and prompt templates that are portable enough that the backup is not five times worse. The hard part is keeping the fallback honest — route a continuous slice of real traffic through it so it stays warm, monitored and credential-valid.',
  dgm: { nodes: [{ t: 'router', s: 'health + error class' }, { t: 'provider A', s: 'down · 500', k: 'warn' }, { t: 'provider B', s: 'active backup', k: 'alt' }, 'response'],
    cap: 'Failover on error class. A 400 fails identically everywhere, so retrying it elsewhere only doubles the bill.' },
  trap: 'An untested fallback is not a fallback. Expect the follow-up "when did it last run?" — the good answer is "continuously, on a small traffic slice", not "we would find out during the incident".',
  tags: ['reliability', 'failover'] },

{ id: 'po04', topic: 'prodops', level: 2,
  q: 'Describe the layers of a production GenAI architecture and what each one owns.',
  lay: 'Name the layers and what each is allowed to do. The reason to separate them is that when something goes wrong you want to change one layer, not the whole product.',
  tech: '<ul><li><b>Gateway</b> — authentication, per-tenant rate limits and cost budgets, input validation, PII redaction. The cheapest place to reject a request, because nothing has been spent yet.</li><li><b>Orchestration</b> — retrieval, tool calls, model routing, retry policy, fallbacks, caching. The behaviour of the system lives here, and this is what you version.</li><li><b>Model layer</b> — provider clients behind timeouts, breakers and a router, so swapping a provider is a config change.</li><li><b>Validation</b> — schema, citation and safety checks between generation and anything downstream.</li><li><b>Observability</b> — traces carrying quality, latency, token and cost data under one trace id that also appears in user-facing errors.</li></ul>Isolate the shared infrastructure: one Redis doing cache, queue and rate-limit counters is a single failure that takes all three down together.',
  trap: 'Do not draw one box labelled "AI". The interviewer is checking whether you know where a guardrail goes, and "somewhere in the middle" is the answer that ends the round.',
  tags: ['architecture'] },

{ id: 'po05', topic: 'prodops', level: 1,
  q: 'What is horizontal scaling and where does it stop helping a GenAI system?',
  lay: 'You run more identical copies of your service behind something that spreads traffic across them. It works well for anything each copy can do on its own, and does nothing for anything they all share.',
  tech: 'Replicas behind a load balancer scale anything stateless. In GenAI the expensive dependency is shared and usually not yours: one provider quota, one vector index, one database. So three things must be handled explicitly — connection pooling (ten replicas opening their own pools can exhaust the database before the model quota is touched), shared rate-limit counters rather than per-instance ones, and session or cache affinity if you rely on any local state. The fleet size is set by the quota, not the CPU.',
  trap: 'Say the quota sentence explicitly: adding servers raises throughput and does not raise your tokens-per-minute allowance. It is the distinction the question exists to test.',
  tags: ['scale'] },

{ id: 'po06', topic: 'prodops', level: 1,
  q: 'How does rate limiting work, and where do you enforce it?',
  lay: 'A bucket holds a number of permits and refills at a steady rate. Each request takes one, and an empty bucket means the request waits or gets refused. Bursts are allowed up to the bucket size; the refill rate caps the long run.',
  tech: 'Token bucket is the default: capacity sets the tolerated burst, refill rate sets the sustained ceiling, and it is a couple of fields in Redis. GenAI needs <b>two</b> buckets, because requests and tokens are different resources — a thousand short requests and ten enormous ones can cost the same. Enforce at the gateway, before retrieval and generation have spent anything, keyed per tenant and per API key so one customer cannot drain the shared quota. Return 429 with Retry-After and remaining quota, or every client you have will retry blind and turn a limit into an outage.',
  compare: { cols: ['Token bucket', 'Fixed window', 'Sliding window log'],
    rows: [['Burst handling', 'Allowed, bounded by capacity', 'Allowed twice at the boundary', 'Smooth'],
           ['Memory', 'Two numbers per key', 'One counter per key', 'One entry per request'],
           ['Typical use', 'The default for APIs', 'Crude quotas', 'Precise, expensive limits']] },
  trap: 'A per-instance limiter is not a limiter. With ten replicas, "100 per minute" becomes 1,000 per minute, and it silently gets worse every time you autoscale.',
  tags: ['rate-limiting'] },

{ id: 'po07', topic: 'prodops', level: 2,
  q: 'You are getting 429s from your model provider — what is the handling?',
  lay: 'Do not retry straight away. That is what makes a rate limit into an outage. Wait a bit longer each time, add some randomness, and if it keeps happening send the work somewhere else.',
  tech: 'Treat 429 as its own error class. Read Retry-After if the provider sends one; otherwise exponential backoff with full jitter, capped attempts and a capped total wall-clock. If the primary stays locked, route to the fallback model rather than continuing to wait. Longer term a persistent 429 is a capacity signal rather than a bug: your concurrency exceeds your quota, so the fix is a bounded worker pool that cannot exceed the quota, plus a queue in front of it and per-tenant limits so one customer cannot consume the whole allowance.',
  code: `# the shape, not a library
for attempt in range(MAX_ATTEMPTS):
    r = call_model(req)
    if r.status != 429:
        return r
    wait = float(r.headers.get("retry-after", 0)) or random.uniform(0, BASE * 2 ** attempt)
    if total_waited + wait > DEADLINE:      # no point waiting past the deadline
        break
    total_waited += wait; sleep(wait)
return fallback_provider(req)               # not a 500 to the user`,
  trap: 'Retrying immediately on 429 is the single most common self-inflicted outage in this stack. If you only remember one thing: jitter, a cap, and a fallback that is not another attempt at the same endpoint.',
  tags: ['rate-limiting', 'reliability'] },

{ id: 'po08', topic: 'prodops', level: 1,
  q: 'What is exponential backoff, and why is jitter not optional?',
  lay: 'Each retry waits longer than the last, so a struggling service gets more room instead of a constant beating. The randomness matters because otherwise every client that failed together retries together and knocks it over again the moment it recovers.',
  tech: 'Delays grow 1s, 2s, 4s, 8s up to a ceiling. Without jitter, clients that failed at the same instant retry at the same instant — a synchronised wave that re-breaks the recovering service. Full jitter, a uniform random value between zero and the current ceiling, spreads them out and is the variant worth naming. Two caps matter as much as the growth: maximum attempts, and maximum total wall-clock, because three retries behind a thirty-second timeout is a two-minute request nobody is still waiting for.',
  trap: 'Backoff protects the dependency; jitter protects the recovery. Candidates who name only the first half get the follow-up "and what happens when everyone retries at 4 seconds?"',
  tags: ['retries', 'reliability'] },

{ id: 'po09', topic: 'prodops', level: 1,
  q: 'What are the caching layers in a GenAI application?',
  lay: 'There is more than one cache and they are not interchangeable. You can remember the whole answer, get a discount on the part of the prompt that never changes, remember the numbers you computed for a piece of text, and remember what a tool returned.',
  tech: '<ul><li><b>Exact response cache</b> — keyed on normalised prompt plus model plus parameters plus prompt version. Cheapest and safest, and useless on anything personalised.</li><li><b>Provider prompt cache</b> — a large discount on a stable prefix, nearly free to adopt. Anything varying near the top of the prompt, a timestamp included, invalidates it for every request.</li><li><b>Semantic cache</b> — vector similarity for the same intent worded differently, at a high threshold.</li><li><b>Embedding cache</b> — stop re-embedding identical text.</li><li><b>Tool-result cache</b> — anything static or slow-changing.</li></ul>Each needs a stated time-to-live and a rule for what a write invalidates.',
  trap: 'Never cache an answer that failed validation, and put the prompt version in the key. A prompt change with a stale cache serves yesterday’s behaviour indefinitely, and it looks exactly like the deploy not working.',
  tags: ['caching'] },

{ id: 'po10', topic: 'prodops', level: 2,
  q: 'What is semantic caching and what threshold would you set?',
  lay: 'Look up the new question by meaning rather than by exact wording, and if a previous question was close enough, reuse its answer. The whole design lives in what counts as close enough.',
  tech: 'Embed the query, search the cache of previous queries, return the stored answer if the nearest neighbour clears a similarity threshold. Hit rates of 30–40% are realistic on support-style traffic, turning a two-second call into about thirty milliseconds. The risk is that similarity measures wording, not intent: "can I refund an order over 30 days?" and "under 30 days?" sit extremely close and have opposite answers, and negation is generally invisible to an embedding. So the threshold runs high (0.95 and up on cosine), personalised, time-sensitive and permission-scoped content is excluded, and the cache is namespaced per tenant.',
  trap: 'Name the failure mode before you are asked. A candidate who says "0.85 is fine" has not been paged for a cache serving the opposite of the right answer to a paying customer.',
  tags: ['caching', 'cost'],
  xref: [['Move the threshold and watch the wrong hits appear', '../ai_system_design_concepts/index.html']] },

{ id: 'po11', topic: 'prodops', level: 2,
  q: 'Give me your ordered list for cutting the cost of a GenAI feature.',
  lay: 'Find out where the money goes first, because it is almost never spread evenly. Then: stop calling the model, call a cheaper one, send it less, and do not pay for words nobody reads.',
  tech: '<ol><li><b>Attribute</b> — cost per feature, per model, per prompt component, per request at p50 and p99. Usually one endpoint or one oversized system prompt is most of the bill.</li><li><b>Prompt caching</b> — a large discount on a stable prefix, nearly free to adopt. Biggest single lever.</li><li><b>Exact then semantic caching.</b></li><li><b>Model routing</b> — the easy majority to a small model; the biggest structural saving.</li><li><b>Shrink the input</b> — fewer chunks, tighter system prompt, truncated tool output.</li><li><b>Cap the output</b> — output tokens cost several times input.</li><li><b>Batch API</b> for anything not interactive.</li></ol>',
  trap: 'Attach the quality sentence to every item: you would re-run the eval set after each change, because a cheaper system that is worse is not a saving, it is a regression with a nice-looking dashboard.',
  tags: ['cost'] },

{ id: 'po12', topic: 'prodops', level: 2,
  q: 'How would you build a model router, and what decides when to escalate?',
  lay: 'A cheap gatekeeper decides which model each request deserves, because most questions are easy and there is no reason to pay premium prices for all of them.',
  tech: 'Three implementations: <b>rules</b> on intent, user tier or length (cheap, brittle); <b>a classifier</b>, a small fine-tuned model or logistic regression on features (fast and accurate, needs labelled data); <b>a cascade</b> where the small model answers first and a check decides whether to escalate (no training, but you pay twice on escalation). The saving is structural: move 70% of traffic to something 20× cheaper and total spend falls by roughly two thirds. The escalation signal is the part that decides whether this works — use verifiable checks (did the output parse, does the cited chunk exist, did retrieval return anything, did the tool call validate) rather than the model’s self-reported confidence, which is badly calibrated.',
  dgm: { nodes: [{ t: 'request' }, { t: 'router', s: 'rules · classifier · cascade', k: 'alt' }, { t: 'small model', s: '~70% of traffic' }, { t: 'verifiable check', s: 'parse · citation · retrieval', k: 'alt' }, { t: 'escalate to large', s: 'only on failure', k: 'warn' }],
    cap: 'The check is deterministic on purpose. Asking the model how confident it is puts the routing decision back inside the thing you are trying to route.' },
  trap: 'Keep a shadow sample where the expensive model also answers the routed traffic, so you can quantify the quality you traded. An unmeasured router is a silent regression that looks like a cost win.',
  tags: ['routing', 'cost'] },

{ id: 'po13', topic: 'prodops', level: 2,
  q: 'When would you deliberately ship the smaller model?',
  lay: 'When it clears the bar your product actually needs. That only means something once you have measured both on your own test set, because a public leaderboard is measuring a different task than yours.',
  tech: 'Compare on your evaluation set, not on benchmarks, and put the three numbers side by side. If the small model reaches 91% where the product needs 90%, the four extra points from the large model are costing several seconds of latency and roughly an order of magnitude of spend on every request. The complete answer also says where you would not do it: irreversible actions, legally sensitive output, anything where a failure is silent rather than obvious, and any path with no human review behind it.',
  compare: { cols: ['Small (8B)', 'Large (400B)'],
    rows: [['Task accuracy', '91%', '95%'],
           ['p95 latency', '~1.5s', '~5.0s'],
           ['Relative cost', '1×', '~20×'],
           ['Good for', 'Classification, extraction, FAQ, routing', 'Ambiguity, multi-step reasoning, long context']] },
  trap: 'Quantify the four points. "Good enough" is a hand-wave; "four points of accuracy for 3.5 seconds and twenty times the cost on every request, against a product bar of 90" is an engineering decision.',
  tags: ['routing', 'cost'] },

{ id: 'po14', topic: 'prodops', level: 2,
  q: 'What does graceful degradation look like for an AI feature?',
  lay: 'Decide in advance what the system does when each piece it depends on is missing, and write those modes down. The worst outcome is not an error page — it is the system staying confidently up while quietly being wrong.',
  tech: 'One named mode per dependency. <b>Retrieval down</b>: serve from cache, or abstain and offer search — never let the model answer ungrounded, because that is precisely when it invents policy. <b>Primary model down</b>: secondary model; if that is down too, the cached answer with a staleness note. <b>Tools down</b>: return what you have and mark the action unavailable rather than pretending it succeeded. <b>Over budget</b>: smaller model and shorter context before switching the feature off. Each mode is a product decision as much as an engineering one, so it needs writing down before the incident.',
  trap: 'The dangerous failure in a GenAI system is a plausible answer, not a 500. An ungrounded answer after a retrieval failure reads exactly like a real one, and nobody notices for weeks.',
  tags: ['reliability', 'degradation'] },

{ id: 'po15', topic: 'prodops', level: 2,
  q: 'What is a circuit breaker, and where would you put one in an LLM system?',
  lay: 'A switch that watches how often calls to one dependency fail. Past a threshold it stops letting calls through at all for a while, so the sick service gets room to recover and your own threads are not all stuck waiting.',
  tech: 'Three states. <b>CLOSED</b>: calls flow, failures counted over a rolling window. Past a threshold (say 50% of the last 20 calls) it trips <b>OPEN</b>: every call fails instantly without touching the dependency. After a cool-down it goes <b>HALF-OPEN</b> and allows one probe — success closes it, failure re-opens it. One breaker per dependency, never one global breaker: model provider, vector database, each tool, each downstream API. Retries and breakers are complementary — retries handle one unlucky call, breakers stop a thousand unlucky calls becoming your outage.',
  dgm: { nodes: [{ t: 'CLOSED', s: 'calls allowed, failures counted' }, { t: 'OPEN', s: 'fail fast, cool-down', k: 'warn' }, { t: 'HALF-OPEN', s: 'one probe call', k: 'alt' }, { t: 'CLOSED again', s: 'probe succeeded' }],
    cap: 'The probe is the whole design. Without HALF-OPEN a breaker either never reopens or reopens into the same overload.' },
  trap: 'An open breaker needs a fallback behind it. Without one you have not improved anything — you have only made your failures faster.',
  tags: ['reliability', 'circuit-breaker'] },

{ id: 'po16', topic: 'prodops', level: 2,
  q: 'How do you design a retry policy that does not make things worse?',
  lay: 'Only retry the failures a retry can actually fix. Something that was wrong when you sent it will be just as wrong the second time, and you will have paid twice.',
  tech: '<b>Retry</b>: timeouts, connection resets, 429, 503, and 500 from a stateless read — something outside changed. <b>Do not retry</b>: 400, schema validation failures, authentication errors and content-policy refusals — nothing will be different. Then the constraints: capped attempts, capped total wall-clock so retries fit inside the deadline, exponential backoff with jitter, and an idempotency key for anything with a side effect. Retry budgets at the fleet level are the senior detail: cap retries as a percentage of total traffic, so a broad failure cannot triple the load on a service that is already struggling.',
  trap: 'A blanket retry decorator on every call is the wrong answer, and it is the most common one. Classification comes first; the mechanics come second.',
  tags: ['retries', 'reliability'] },

{ id: 'po17', topic: 'prodops', level: 1,
  q: 'Why are timeouts more delicate in an LLM system than in a normal service?',
  lay: 'A call that hangs holds on to a connection and a worker until something kills it. With ordinary services you know quickly that something is wrong; with a model, taking several seconds is normal, so telling "still working" apart from "stuck" is genuinely hard.',
  tech: 'Set an explicit timeout at every hop — retrieval, rerank, model, each tool, each downstream API — and make the sum fit inside the request deadline, or a slow chain silently exceeds the budget you promised. Library defaults are frequently infinite, which is how a provider slowdown becomes a full thread-pool exhaustion. Streaming needs three separate timeouts, not one: time to first token, inter-token stall, and total. And propagate the deadline down the chain, so a late-running step does not start work nobody will wait for.',
  trap: 'Deadline propagation is what separates a good answer here. A per-call timeout of 20 seconds inside a 10-second request budget is a timeout that never fires usefully.',
  tags: ['latency', 'timeouts'] },

{ id: 'po18', topic: 'prodops', level: 2,
  q: 'What is idempotency and why does an agent system need it more than a normal one?',
  lay: 'An operation is idempotent when doing it twice has the same effect as doing it once. Agents retry, queues deliver twice, users double-click — and without this, "issue a refund" happens three times.',
  tech: 'The mechanism lives at the tool boundary, not in the prompt: the caller derives a key from the intent, the tool stores it with the result, and a repeat key returns the stored result instead of executing again. Keys must be derived deterministically from the intent rather than generated fresh per attempt, or every retry looks new. Reads are naturally idempotent; anything that writes, charges, emails, books or deletes is not, and needs the key plus a dedupe window long enough to cover your whole retry budget. Where the tool cannot support it, the orchestrator needs an execution log it checks before acting.',
  trap: 'Retries are only safe when the operation is idempotent — every other part of a retry policy depends on that sentence being true. Say it explicitly, because it is the link the interviewer is checking for.',
  tags: ['reliability', 'tools'],
  xref: [['Where this sits in an agent loop', '../agentic_ai_flow/index.html']] },

{ id: 'po19', topic: 'prodops', level: 1,
  q: 'When should an LLM feature be asynchronous rather than a normal request?',
  lay: 'When the work takes longer than anyone will sit and watch. You accept the request, hand back a ticket number, do the work in the background, and tell them when it is ready.',
  tech: 'Accept, enqueue, return a job id immediately, then deliver by polling, webhook or a push channel. The rule of thumb: anything reliably over ten to thirty seconds, anything nobody is watching in real time, and anything you want to retry safely belongs on a queue. Conversational features stay synchronous and stream instead, because a job id is a terrible chat experience. Async brings its own required parts — a dead-letter queue, visible job status, an expiry for uncollected results, and idempotent handlers because the queue delivers at least once.',
  trap: '"At least once" is the detail people miss. A queue that redelivers on worker crash will re-run your tool calls, so async and idempotency are the same conversation.',
  tags: ['async'] },

{ id: 'po20', topic: 'prodops', level: 2,
  q: 'Why put a queue in front of a production GenAI system?',
  lay: 'Traffic arrives in bursts and your capacity is flat. A queue absorbs the burst so the extra work becomes a wait rather than a wall of errors.',
  tech: 'Two jobs. <b>Smoothing</b>: a spike becomes queue depth and gracefully rising latency instead of timeouts across the board. <b>Control</b>: worker concurrency becomes an explicit number you can pin to the provider quota, rather than an emergent property of arrival rate. Operate it on depth and oldest-message age rather than CPU, because a GenAI worker saturates on waiting, not compute. Bound the queue and shed at the boundary — an unbounded queue only moves the outage to whenever memory runs out, and by then it is serving answers to requests nobody is waiting for.',
  trap: 'Add the staleness rule: drop or fast-fail work whose deadline has already passed. Processing a request the user abandoned four minutes ago costs real money for zero value.',
  tags: ['async', 'backpressure'] },

{ id: 'po21', topic: 'prodops', level: 3,
  q: 'Traffic increases 10× overnight. What breaks first and what do you do about it?',
  lay: 'Not the part you can add more of. The things that break are the fixed ones — your allowance from the model provider, the database connections, the shared cache.',
  tech: 'Three moves before scaling anything. <b>Protect</b>: admission control and per-tenant limits at the gateway, so excess is rejected cheaply and predictably rather than accepted and dropped expensively. <b>Absorb</b>: bounded queues in front of everything slow. <b>Prioritise</b>: shed background work — batch summarisation, analytics, re-indexing — to protect the interactive path. Then scale the parts that can scale, and file the provider quota increase, which has a lead time you cannot compress during an incident. Watch for the second-order failures: cache stampede on a cold key, connection pool exhaustion, and retry amplification turning one failure into four requests.',
  trap: 'Retry amplification is the one that catches people. At 10× traffic with three retries configured, a partial failure becomes 40× load on the thing that was already struggling.',
  tags: ['scale', 'incident'] },

{ id: 'po22', topic: 'prodops', level: 3,
  q: 'What is load shedding and how do you decide what to shed?',
  lay: 'Deliberately refusing some work while overloaded, so the work you do accept actually finishes. Refusing predictably is better than accepting everything and failing at all of it.',
  tech: 'Two decisions make it real. <b>Priority classes assigned at the edge</b>: interactive user requests P1, user-visible async jobs P2, internal analytics and re-indexing P3 — decided before the incident, because nobody classifies traffic sensibly at 3am. <b>The trigger signal</b>: queue depth or oldest-message age, not CPU, because these systems saturate on waiting. Shed from the bottom, return 429 with Retry-After, and emit a metric for every shed request — invisible shedding is indistinguishable from a bug. Deadline-aware shedding is the refinement: drop work that cannot finish inside its budget rather than paying to produce a late answer.',
  trap: 'Load shedding and rate limiting get confused. A rate limit is a per-tenant policy that applies always; shedding is a global response to overload that ignores who you are and looks at what your request is worth.',
  tags: ['shedding', 'incident'] },

{ id: 'po23', topic: 'prodops', level: 2,
  q: 'What would you put on a monitoring dashboard for a GenAI system?',
  lay: 'Four groups: is it answering well, is it answering fast, what is it costing, and is anything falling over. The first group is the one ordinary web monitoring does not have, and it is the one that catches the failures that matter.',
  tech: '<ul><li><b>Quality</b> — faithfulness, citation validity, refusal rate, escalation rate, judge scores on a sampled stream, thumbs-down rate.</li><li><b>Performance</b> — p50/p95/p99 per stage, time to first token, throughput, error rate by class.</li><li><b>Cost</b> — input and output tokens, cost per request at p50 and p99, cache hit rate, cost per successful task.</li><li><b>Reliability</b> — fallback rate, breaker state, empty-retrieval rate, index freshness lag, queue depth and age.</li></ul>All of it hangs off one trace id that also appears in user-facing errors, so a complaint becomes a lookup instead of an investigation.',
  trap: 'Redact personal data before logging. Tracing captures full prompts by default and ships them to a vendor, often in another jurisdiction — the most common privacy failure in this stack.',
  tags: ['observability'] },

{ id: 'po24', topic: 'prodops', level: 2,
  q: 'Which alerts would you actually configure, and which would you not?',
  lay: 'Alarm on rates and on money, not on single events. One timeout is weather. A timeout rate that has doubled is an incident.',
  tech: 'Configure: p95 latency above the objective for five minutes; error rate by class with 429 and 5xx separated because they mean different things; cost per request at p99, which catches runaway loops that total spend conceals; daily spend against budget with a projection; cache hit rate falling, which usually means someone changed the prompt prefix; empty-retrieval rate rising; refusal and escalation rate rising, the earliest quality signal you have; index freshness lag. Do not configure: alerts on individual errors, alerts nobody owns, and alerts with no linked trace — all three get muted within a month, and a muted alert is worse than none because it looks like coverage.',
  trap: 'Cost per request at p99 is the one people omit and regret. Total spend looks normal while a handful of agent loops cost fifty times the median, and that is usually an afternoon of work to fix.',
  tags: ['monitoring', 'alerting'] },

{ id: 'po25', topic: 'prodops', level: 2,
  q: 'How do you keep personal data out of an LLM pipeline?',
  lay: 'Take it out in your own code before the model ever sees it, and take it out again before you write anything to a log. Asking the model nicely not to repeat it is a request, not a control.',
  tech: 'A deterministic detection and redaction pass on the way in — names, card numbers, national identifiers, emails replaced with placeholders — and rehydration on the way out only where the answer genuinely needs them. The same pass runs before logging and tracing, which is the step people miss. Around it: tenant-scoped storage enforced by the query rather than the prompt, retention limits with a real deletion path, encryption in transit and at rest, and a documented answer to whether the provider trains on your data, which is a contract question. For higher-sensitivity data, consider keeping it out of the prompt entirely and passing a reference the tool resolves under the user’s own permissions.',
  trap: 'Redaction is lossy and detection is imperfect. Say what happens on a miss — a second check before anything leaves the system, and an incident path — rather than claiming the redactor catches everything.',
  tags: ['security', 'pii'] },

{ id: 'po26', topic: 'prodops', level: 2,
  q: 'How do you defend a production system against prompt injection?',
  lay: 'The model reads your instructions and the untrusted text as one continuous stream, so there is nothing structurally stopping a document from giving it orders. There is no single fix, so you stack several partial ones and make sure a successful attack cannot do much.',
  tech: 'Direct injection is the user trying it; indirect is a retrieved document, a web page or a tool response carrying hidden instructions, which is the common one in production because it arrives with no attacker present. Layers: keep instructions in the system role and never concatenate untrusted text into them; delimit and label retrieved content as data; strip zero-width characters, homoglyphs and hidden markup; screen input and validate output; treat model output as untrusted input to whatever consumes it. The layer that actually decides the outcome is least privilege on tools — with read-only scopes and approval on irreversible actions, a successful injection is an embarrassment rather than an incident.',
  trap: 'There is no complete defence, and saying so is the right answer. Any candidate claiming a filter that stops injection has not read the literature; the goal is limiting what a successful injection can reach.',
  tags: ['security', 'injection'],
  xref: [['The seven guardrail layers, one at a time', '../agentic_ai_flow/index.html']] },

{ id: 'po27', topic: 'prodops', level: 2,
  q: 'What does least privilege mean for an agent, in concrete terms?',
  lay: 'Give it exactly the access its job needs and nothing more, because it will eventually make a wrong call and the only question is how much damage that call can do.',
  tech: 'Concretely: read-only scopes wherever reading suffices; per-tenant credentials so an agent cannot reach another customer’s data even if instructed to; short-lived tokens issued per session rather than a long-lived key in the environment; one credential per tool, so a compromised search tool is not also a database account; row-level and column-level limits enforced by the data layer rather than by the prompt; and human approval on irreversible actions. Rollout order matters as much as scopes: read-only first, then reversible actions, then irreversible ones once traces and evals have earned it.',
  trap: '"The system prompt tells it not to" is not a permission model. Every control must hold when the model has been convinced to ignore its instructions, because that is the scenario it exists for.',
  tags: ['security', 'agents'] },

{ id: 'po28', topic: 'prodops', level: 3,
  q: 'Design the path between an agent proposing a tool call and the call executing.',
  lay: 'Treat what the model asks for as a request from a stranger on the internet, because functionally that is what it is. Check it before you run it.',
  tech: 'Between proposal and execution: <ol><li><b>Schema validation</b> — types, required fields, enums. Reject rather than coerce.</li><li><b>Business limits</b> — a refund tool that accepts any amount will one day be asked for a very large one. Bounds live in code, not in the description.</li><li><b>Authorisation</b> — does the acting user have permission for this specific object, checked against your own system, not inferred from the conversation.</li><li><b>Rate and loop limits</b> — per session and per tool, so a stuck agent cannot fire the same call a thousand times.</li><li><b>Approval</b> for anything irreversible, with the proposed call rendered in human terms.</li><li><b>Audit</b> — proposed call, verdict, arguments, result, trace id, so an incident is reconstructable.</li></ol>',
  dgm: { nodes: [{ t: 'agent proposes' }, { t: 'schema + limits', s: 'reject, do not coerce', k: 'alt' }, { t: 'authorise', s: 'against your own system' }, { t: 'approve if irreversible', s: 'human in the loop', k: 'warn' }, { t: 'execute + audit' }],
    cap: 'Every gate is deterministic code. Nothing on this path asks the model whether the call is a good idea.' },
  trap: 'Never let model output hold direct authority over a write or a delete. The validation must be independent of the model, or it is the same system checking its own homework.',
  tags: ['security', 'tools'] },

{ id: 'po29', topic: 'prodops', level: 2,
  q: 'What is a canary deployment and what would you watch during one for an LLM feature?',
  lay: 'Send a small slice of real traffic to the new version, compare it against the old one, and widen only if it holds up. The point is finding out on 2% of users instead of all of them.',
  tech: 'One to five percent of traffic, with sticky assignment so a user does not flip versions mid-conversation. The metrics differ from a normal canary: error rate and latency, yes, but also cost per request, input and output token counts, refusal rate, escalation rate, cache hit rate and judge scores on a sample. Two things make it real — automatic rollback on a breach, because a canary a human has to notice is not a canary, and a rollback that is a config flag rather than a deploy. Expect a temporary cost spike as the prompt cache warms on the new prefix, and do not mistake it for a regression.',
  trap: 'An infrastructure-only canary check passes a version that is fast, cheap and quietly worse. Quality metrics have to be in the gate, or the canary is decorative.',
  tags: ['deployment', 'canary'] },

{ id: 'po30', topic: 'prodops', level: 2,
  q: 'The new prompt is live and quality has dropped — what happens in the next hour?',
  lay: 'Roll back first, investigate afterwards. Every minute you spend debugging on live traffic is being served to real people.',
  tech: '<ol><li><b>Roll back</b> to the last known-good release — a config flag, not a deploy — which requires that prompt and model versions are recorded on every request so you can pin the exact previous state.</li><li><b>Confirm</b> the metric recovers. If it does not, the prompt was not the cause and you have narrowed it usefully.</li><li><b>Isolate</b> by diffing traces either side: did retrieval change, did output length change, did the output shape break, did refusals rise?</li><li><b>Reproduce</b> on the golden set and add the escaping case to it.</li><li><b>Fix, re-evaluate, re-canary.</b></li></ol>Then the real finding: the eval set did not catch this. That gap is the bug worth fixing, because the next prompt change will hit it too.',
  trap: 'Do not offer to "tweak the prompt and see". Fixing forward on live traffic is the answer that loses the round; roll back, then reproduce offline.',
  tags: ['deployment', 'incident'] },

{ id: 'po31', topic: 'prodops', level: 2,
  q: 'How do you version an LLM application so that a result three weeks old is reproducible?',
  lay: 'The model name is only a small part of what decided the answer. You have to pin everything that shaped it, together, under one label stamped on every request.',
  tech: 'A release manifest covering the prompt template version, the model with an explicit version tag, sampling parameters, chunking and embedding configuration, retrieval settings, tool schemas and the eval set that approved the release. Stamp the release id on every request log and every cache key. Without it a quality question weeks later is unanswerable — you cannot distinguish a prompt change from a silently updated model from a re-indexed corpus. With it, the question becomes a lookup.',
  code: `release: "v2.4"
model:          "gpt-4o-2024-11-20"   # explicit tag, never a floating alias
prompt_version: "v17"
params:         { temperature: 0.2, max_tokens: 800 }
chunking:       "v5"                  # re-chunking changes every answer
embedding:      "text-embedding-3-large"
retrieval:      { k: 12, rerank: true, threshold: 0.32 }
tools:          "v3"
eval_set:       "v12"                 # what approved this release`,
  trap: 'Re-chunking or re-embedding a corpus changes every answer while the model id stays identical. If the manifest does not include the retrieval configuration, it is not versioning.',
  tags: ['versioning', 'reproducibility'] },

{ id: 'po32', topic: 'prodops', level: 3,
  q: 'Token usage doubled overnight with no deploy. How do you find the cause?',
  lay: 'Split it into what you sent and what came back, because the two have completely different causes. Then compare requests from before and after the jump.',
  tech: '<b>Input tokens up</b>: retrieval returning more or larger chunks (a threshold or k change, a re-index that produced bigger chunks), conversation history not being trimmed, an added few-shot block, or a broken prompt-cache prefix so you are paying full price for text that used to be discounted. <b>Output tokens up</b>: a verbosity change, a dropped max_tokens cap, structured output removed, or an agent looping on a failing tool. Then find the change point precisely and diff traces either side. "No deploy" rarely survives contact with the evidence — check config changes, feature flags, index rebuilds and the provider’s own release notes.',
  trap: 'Look at p99, not the mean. The median can be perfectly flat while a small number of runaway agent runs carry the entire increase, and averaging hides exactly the requests you need to see.',
  tags: ['cost', 'debugging'] },

{ id: 'po33', topic: 'prodops', level: 1,
  q: 'Accuracy is fine but users say the product feels slow. What is happening?',
  lay: 'They are describing something real that your dashboard is not measuring. Waiting five seconds for a block of text feels broken; watching text appear after half a second feels fast, even when the total is the same.',
  tech: 'Measure time to first token separately from total latency and treat it as its own objective. Fixing it: stream, cache the prefix so prefill is shorter, and start the stream before post-processing rather than after. Then check the other perception killers — a spinner with no progress, an output guardrail that buffers the whole answer before releasing it, and mid-stream stalls, which feel worse than a slow start because the user has already begun reading.',
  trap: 'Streaming and a blocking output filter are in direct conflict. If a safety check must see the full answer, stream to a buffer with a short reveal delay, or run the check on chunks — decide which, because you cannot have both naively.',
  tags: ['latency', 'streaming'] },

{ id: 'po34', topic: 'prodops', level: 2,
  q: 'Your vector database goes down. What should the system do?',
  lay: 'The wrong behaviour here is not an error, it is a confident answer. With nothing retrieved, the model falls back on what it half-remembers and produces something fluent and unsourced that nobody spots.',
  tech: 'Treat empty or failed retrieval as an explicit branch rather than an exception. Then choose the degradation in order: semantic cache hit if there is one; keyword search over a replica or a search index if you keep one; otherwise abstain with an honest message that the knowledge base is unavailable. Track empty-retrieval rate as a standing metric, because partial index failures are silent — a shard missing or a filter suddenly matching nothing looks exactly like a quiet day.',
  trap: 'The follow-up is "why not just let the model answer from what it knows?" Because it cannot cite anything, cannot be audited, and produces its most convincing wrong answers when the context is missing.',
  tags: ['reliability', 'rag'] },

{ id: 'po35', topic: 'prodops', level: 2,
  q: 'One customer starts sending 10,000 requests an hour. How do you contain it?',
  lay: 'Limits and budgets that know which customer a request came from, applied before the expensive work happens. Otherwise one customer’s runaway script is everyone else’s outage and your monthly bill.',
  tech: 'Layered, all per tenant: requests-per-minute and tokens-per-minute at the gateway; a concurrency cap, which matters more than the request rate when each request takes seconds; daily and monthly cost budgets with alerting well before the cap; and fair-share queueing so one tenant cannot occupy every worker even while within its rate limit. Then the policy question, which is not technical — is this abuse to throttle or growth to upsell? The 429 body should say which, and what to do next.',
  trap: 'A global rate limit protects your bill and nobody’s experience — it throttles the innocent customers alongside the noisy one. Tenant-aware limits are the whole point of the question.',
  tags: ['multi-tenant', 'rate-limiting'] },

{ id: 'po36', topic: 'prodops', level: 3,
  q: 'The feature is accurate and losing money. What is the analysis?',
  lay: 'You are measuring cost per attempt when the business cares about cost per result. If a third of attempts fail, every real success is paying for the failures too.',
  tech: 'Instrument success as a real metric — task completed, no escalation to a human, no refund, no repeat question within the session — and track cost per successful task. Both terms are levers, and the unintuitive one usually wins: raising the success rate saves more than shaving cost per call, because a failed expensive request is the worst possible spend. Then compare against the baseline it replaced, human or otherwise, since that is the number the business is actually asking about, and include the retries, the failed tool calls and the abandoned agent runs in the numerator.',
  code: `effective_cost = cost_per_request / success_rate

  4.00 / 0.70  = 5.71 per successful task
  4.00 / 0.90  = 4.44   # +20pp success beats a 25% price cut
  3.00 / 0.70  = 4.29
  3.00 / 0.90  = 3.33   # and together they compound`,
  trap: 'Escalation to a human is a cost, not a safety net. If 30% escalate, the true unit cost includes the agent handling time, and that is usually the number that decides whether the feature survives.',
  tags: ['cost', 'unit-economics'] },

{ id: 'po37', topic: 'prodops', level: 3,
  q: 'The provider changes the model’s behaviour without telling you. How do you survive that?',
  lay: 'Assume the model can change under you, because it can. Pin the version, insist on a fixed output shape you check in code, and run your tests against production on a schedule so you find out before your customers do.',
  tech: 'Pin explicit version tags, never a floating alias — an alias is an unannounced deploy you did not perform. Enforce an output contract with structured output or a JSON schema plus validation and a repair-and-retry path, so a formatting drift becomes a caught error rather than a corrupted downstream write. Run the regression suite against production on a schedule, not only in CI. Keep a second provider integrated, tested and carrying a slice of real traffic. And treat deprecation notices as a real project: the migration window is usually shorter than the evaluation work.',
  trap: 'Model output is untrusted input. That single framing answers this question, the injection question and half the reliability questions in the round.',
  tags: ['reliability', 'contracts'] },

{ id: 'po38', topic: 'prodops', level: 3,
  q: 'Design a highly reliable GenAI service end to end.',
  lay: 'Walk the request through the system and, at each stop, say what happens when that stop is broken. That last part is what turns a diagram into a design.',
  tech: 'Gateway: authenticate, per-tenant rate limits and budgets, validate, redact. Orchestrator: exact cache, then semantic cache, then retrieval behind a timeout with an explicit empty-retrieval branch, then routing by complexity. Model call: timeout, error-classified retries with jitter, circuit breaker, provider fallback. Validation: schema, citation existence, safety — with one repair attempt before degrading. Response: streamed, with a trace id the user can quote. Everything logged under one release version. Reliability is the combination of redundancy, retry policy and validation; any one alone leaves an obvious hole.',
  dgm: { nodes: [{ t: 'gateway', s: 'auth · limits · redaction' }, { t: 'orchestrator', s: 'cache · retrieve · route', k: 'alt' }, { t: 'model + fallback', s: 'timeout · retry · breaker' }, { t: 'validator', s: 'schema · citations · safety', k: 'alt' }, { t: 'stream + trace id' }],
    cap: 'Every hop has a written answer to "what if this is down?". That list is the design.' },
  trap: 'Interviewers are checking whether you volunteer the failure path or wait to be asked. Give the happy path in one sentence and spend the rest of the answer on what breaks.',
  tags: ['architecture', 'reliability'],
  xref: [['The same shape, as a walkable diagram', '../genai_flow/index.html']] },

{ id: 'po39', topic: 'prodops', level: 2,
  q: 'The prototype goes to production tomorrow. What do you check tonight?',
  lay: 'Four gates, in the order they are usually missing: is it good enough, is it fast and affordable enough, does it fail sensibly, and would you know if any of that stopped being true.',
  tech: '<ol><li><b>Quality</b> — an eval set exists, the build passes it, and you know the failure rate you are shipping and what happens to those users.</li><li><b>Infrastructure</b> — p95 under realistic concurrency, provider quota confirmed against forecast traffic, cost per request modelled at peak, rate limits in place.</li><li><b>Failure</b> — a written and exercised answer for provider down, retrieval down, each tool down, and over budget.</li><li><b>Observability</b> — traces, cost per request, quality metrics, alerts with an owner, and a trace id in user-facing errors.</li></ol>Then ship it as a canary with a tested rollback, not as a switch.',
  trap: 'The answer that lands in one sentence: verify quality, latency, cost and failure handling, add trace observability, then roll out behind a canary with a rollback you have actually tested.',
  tags: ['readiness', 'deployment'] },

{ id: 'po40', topic: 'prodops', level: 3,
  q: 'How do you know your fallback paths actually work?',
  lay: 'You make them run on purpose, on a schedule. Code that only executes during an emergency is the least tested code you own, and the emergency is a bad time to find out.',
  tech: 'Three practices. <b>Keep it warm</b>: route a continuous small slice of real traffic through the secondary provider so credentials, quotas and prompt compatibility stay valid and monitored. <b>Game days</b>: disable a dependency on a schedule — staging first, then production during a low-traffic window — and confirm the degraded behaviour matches what you documented. <b>Assert in CI</b>: empty retrieval must produce an abstention, a provider 500 must produce a fallback, a schema failure must produce a repair attempt then a safe error. All three are cheap; the usual findings are expired backup credentials, a cache that was never populated, and a degraded message that has never been rendered.',
  trap: 'A fallback that has never executed is a hypothesis, not a control. If you claim graceful degradation in an interview, expect "when did it last run?" — and have an answer that is not "during the incident".',
  tags: ['reliability', 'testing'] }

]);
