/* ============================================================
   Inference & serving — what happens after training, and what it costs.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'in01', topic: 'inference', level: 1,
  q: 'What is inference, and why is it the expensive part?',
  lay: 'Training happens once. Inference is every single time anyone uses the thing. You pay for training in one big bill and for inference forever, which is why almost all the engineering effort goes into making inference cheap.',
  tech: 'Inference is the forward pass: prompt in, tokens out. It has two distinct phases with completely different performance characteristics — prefill (compute-bound, processes the whole prompt at once, determines time-to-first-token) and decode (memory-bandwidth-bound, one token per forward pass, determines tokens per second). Over a model\'s lifetime, inference cost typically dwarfs training cost by orders of magnitude, which is why the field moved toward smaller models trained longer: you pay training once and inference on every request.',
  trap: '"What are you actually optimising?" Name the three numbers separately: time to first token, inter-token latency, and throughput (tokens per second per GPU). They have different fixes and they trade against each other.',
  tags: ['inference', 'basics'], orig: 7 },

{ id: 'in02', topic: 'inference', level: 2,
  q: 'Explain the KV cache — what it stores, why it works, and what it costs.',
  lay: 'When writing word 500, the model needs to look back at words 1–499. But it already worked out everything it needs about those words when it wrote them. The KV cache is the note that says "do not redo that work". Without it, every new word means redoing all the work for every earlier word, and the cost snowballs. With it, each word is a small step - and the note itself takes a lot of memory.',
  tech: 'During decode, attention needs the key and value vectors of every previous position. The causal mask guarantees those never change once computed, so they are stored. Size: <span class="mono">2 × layers × kv_heads × head_dim × seq_len × batch × bytes</span>. The factor of 2 is K and V. For Llama-3 70B with GQA (80 layers, 8 KV heads, head_dim 128) at 8k context that is about 1.3 GB PER SEQUENCE — so a batch of 32 needs ~43 GB on top of 141 GB of weights. This is why KV cache size, not model size, usually determines your maximum batch and therefore your cost per token.',
  trap: '"What does it not help?" Prefill. Nothing is cached on the first pass, so the KV cache does nothing for time-to-first-token. That is what PROMPT caching is for, and the two are different things.',
  tags: ['kv-cache'], orig: 25 },

{ id: 'in03', topic: 'inference', level: 2,
  q: 'What is prompt caching and how is it different from a KV cache?',
  lay: 'The KV cache is the model remembering the current conversation while it writes one answer. Prompt caching is the provider keeping the already-digested version of your standard opening — the system prompt, the tool list, the document — so it does not have to re-read it on every request.',
  tech: 'Prompt (prefix) caching stores the KV state for a stable prompt PREFIX across requests. On a hit, prefill for those tokens is skipped entirely: time-to-first-token drops sharply and cached input tokens are billed at a heavy discount (often 90% off). It is prefix-only — a single changed character invalidates everything after it. Practical rules: put everything stable at the TOP (system prompt, tool schemas, few-shot block, the document), everything volatile at the BOTTOM (user question, timestamps, session ids), keep tool ordering deterministic, and never put a timestamp near the front.',
  compare: { cols: ['KV cache', 'Prompt / prefix cache', 'Semantic cache'],
    rows: [
      ['Scope', 'within one generation', 'across requests, same prefix', 'across requests, similar meaning'],
      ['What it saves', 'recomputing attention over the prefix', 'prefill for the cached prefix', 'the entire call'],
      ['Affects TTFT', 'no', 'yes, strongly', 'yes — hit is milliseconds'],
      ['Can be wrong', 'no', 'no', 'YES — this is the risk'],
      ['Who runs it', 'the inference server', 'the model provider', 'you'],
      ['Invalidated by', 'end of request', 'any change to the prefix', 'your own TTL and versioning']
    ] },
  trap: '"Why did our cache hit rate drop to zero?" Someone put a timestamp, a request id or a shuffled tool list near the top of the prompt. It is the most common prompt-caching bug and it is invisible until you look at the bill.',
  tags: ['caching', 'prompt-cache'], orig: 21 },

{ id: 'in04', topic: 'inference', level: 2,
  q: 'What is continuous batching, and why does it matter so much?',
  lay: 'Old approach: fill a bus, wait for every passenger to reach their stop, then load the next bus — so one long journey holds seven short ones hostage. New approach: as soon as someone gets off, the next person gets on, at every stop.',
  tech: 'Also called in-flight or iteration-level batching. The scheduler re-evaluates the batch at every decode step, evicting finished sequences and admitting queued ones immediately, rather than running a static batch to completion. Because output lengths vary enormously in real traffic, static batching wastes most of the GPU. Combined with PagedAttention — which makes admitting a sequence cheap in memory terms — this is the core of vLLM, TGI and TensorRT-LLM, and it is worth several times the throughput of a naive server.',
  trap: 'Name the trade-off: bigger batches raise throughput and can raise per-request latency, particularly TTFT, because a new request waits for a scheduling slot and long prefills can stall ongoing decodes. Chunked prefill exists specifically to fix that second problem.',
  tags: ['batching', 'serving'], orig: 25 },

{ id: 'in05', topic: 'inference', level: 3,
  q: 'How does speculative decoding work, and when does it lose?',
  lay: 'A junior drafts four words quickly, then the senior checks all four in one glance. If the senior agrees with all four, you got four words for the price of one check. If they disagree on the second, you throw away the rest. The answer is identical to what the senior would have written alone — only faster.',
  tech: 'A cheap draft model proposes γ tokens autoregressively; the target model verifies all γ+1 positions in a SINGLE forward pass, because the draft supplied the inputs so they can be batched. A modified rejection-sampling rule accepts or rejects each token in a way that provably preserves the target\'s output distribution. Expected accepted tokens per round: <span class="mono">E = (1 − α^(γ+1)) / (1 − α)</span> for acceptance rate α. It works because decode is memory-bandwidth-bound — verifying four positions costs nearly the same as generating one, since the weights are read once either way.',
  code: `def speculative_speedup(alpha, gamma, draft_cost=0.15):
    """alpha = per-token acceptance rate; draft_cost as a fraction
    of one target forward pass."""
    expected = (1 - alpha ** (gamma + 1)) / (1 - alpha)
    cost     = 1 + gamma * draft_cost
    return expected / cost

for a in (0.9, 0.72, 0.4, 0.0):
    print(a, round(speculative_speedup(a, 4), 2))
# 0.9 -> 2.6x   0.72 -> 2.1x   0.4 -> 1.0x   0.0 -> 0.63x  (a real loss)`,
  trap: 'Two loss cases worth naming. Low acceptance (a mismatched draft model, or an out-of-distribution prompt) makes it slower than not speculating. And at high batch sizes the GPU is already saturated, so there is no spare capacity to speculate with — it is a latency optimisation, not a throughput one.',
  tags: ['speculative', 'latency'], orig: 25 },

{ id: 'in06', topic: 'inference', level: 3,
  q: 'What are the variants of speculative decoding that do not need a second model?',
  lay: 'Instead of a junior model drafting, the model drafts for itself — either by having extra prediction heads bolted on, or by guessing that text it has already seen will repeat.',
  tech: '<ul><li><b>Medusa:</b> add several extra decoding heads that predict tokens at positions t+1, t+2, ... in parallel, then verify with a tree-structured attention mask. No separate model, needs a small amount of training.</li><li><b>EAGLE:</b> predict at the feature level rather than the token level, which raises acceptance rates substantially.</li><li><b>Lookahead / n-gram decoding:</b> draft from n-grams already present in the prompt or the generated text. Free, needs no training, and is remarkably effective for summarisation, code editing and RAG, where large spans are copied verbatim.</li><li><b>Self-speculative:</b> use a subset of the model\'s own layers as the draft.</li></ul>',
  trap: 'The prompt-lookahead point is the practically useful one: in RAG and code-editing workloads, much of the output is copied from the input, so a zero-cost n-gram draft can achieve very high acceptance without any extra model or training.',
  tags: ['speculative'] },

{ id: 'in07', topic: 'inference', level: 2,
  q: 'What is quantisation and which method would you pick?',
  lay: 'Store the model\'s numbers with fewer decimal places. It gets smaller and faster and slightly less accurate — a JPEG of the weights. Which compression algorithm you pick depends on whether you need it to load fast, run fast, or stay accurate.',
  tech: '<ul><li><b>GPTQ:</b> post-training, layer-wise, second-order weight reconstruction. Good 4-bit quality, needs calibration data.</li><li><b>AWQ:</b> activation-aware — protects the small fraction of weight channels that matter most based on activation magnitudes. Often faster to run and slightly better than GPTQ at 4-bit.</li><li><b>NF4:</b> a normal-float format matched to the (roughly Gaussian) weight distribution; used by QLoRA for training.</li><li><b>GGUF / llama.cpp k-quants:</b> the CPU and consumer-GPU ecosystem, with mixed per-tensor bit widths.</li><li><b>fp8:</b> hardware-native on H100 and later; good quality and real speedups because the tensor cores support it directly.</li></ul>',
  compare: { cols: ['fp16', 'int8', 'int4'],
    rows: [
      ['70B model size', '~141 GB', '~71 GB', '~35 GB'],
      ['Quality cost', 'baseline', 'negligible', 'small but real; long context and reasoning degrade first'],
      ['Speed', 'baseline', 'faster (memory-bound decode)', 'fastest'],
      ['Fits on one 80 GB GPU', 'no', 'yes, barely', 'comfortably'],
      ['Use when', 'quality is everything', 'the default trade', 'the model would not fit at all']
    ] },
  trap: 'Always ask "quantised what?". Weight-only quantisation shrinks memory but the matmuls may still run in fp16. Activation quantisation is what actually accelerates compute and is much harder to do without quality loss. And KV cache quantisation is a third, separate axis that buys batch size rather than model size.',
  tags: ['quantisation'], orig: 7 },

{ id: 'in08', topic: 'inference', level: 2,
  q: 'What is streaming, and what does it actually improve?',
  lay: 'Instead of waiting for the whole answer and then showing it, you show each word as it arrives. Nothing gets faster. It just stops feeling broken, because something is happening.',
  tech: 'Server-sent events or a websocket delivering tokens as they are generated. It changes PERCEIVED latency, not real latency: total generation time and total cost are identical. Time-to-first-token is unchanged too — streaming affects everything after the first token. Real engineering consequences: you cannot validate output structure before the user sees the start of it, so guardrails must either run on the buffered result (losing the streaming benefit) or run incrementally; and error handling mid-stream needs a defined protocol, because the client has already rendered half an answer.',
  trap: 'Beware the word overload. "Streaming" also means processing a large file chunk by chunk (data streaming), and offloading model weights from disk (weight streaming). Ask which one they mean before answering — it is a legitimate clarifying question.',
  tags: ['streaming', 'latency'], orig: 26 },

{ id: 'in09', topic: 'inference', level: 2,
  q: 'How do you reduce time to first token?',
  lay: 'The first token is slow because the model has to read everything you sent before it can say anything. So: send less, or arrange things so it has already read most of it.',
  tech: 'In rough order of effectiveness: <ol><li><b>Prompt caching</b> — a stable prefix means prefill is skipped almost entirely. Usually the single biggest win.</li><li><b>Shorten the prompt</b> — fewer retrieved chunks, trimmed history, compressed few-shot block.</li><li><b>Move retrieval off the critical path</b> — start prefill on the stable prefix while retrieval runs, or prefetch on likely intents.</li><li><b>Smaller model or a router</b> — send easy requests to a fast model.</li><li><b>Better scheduling</b> — chunked prefill so a long prompt does not queue behind other work; separate prefill and decode pools.</li><li><b>Co-locate</b> — network round trips are a real share of a 300 ms budget.</li></ol>',
  trap: 'Streaming is NOT on this list, and interviewers check for that. Streaming improves the experience after the first token; it does nothing for the first token itself.',
  tags: ['latency', 'ttft'], orig: 33 },

{ id: 'in10', topic: 'inference', level: 3,
  q: 'Your p95 latency is 6 seconds and the target is under 2. What do you do?',
  lay: 'Measure before you touch anything. Break the six seconds into pieces, find the two biggest pieces, and fix those. Almost always it turns out to be one slow step nobody had timed.',
  tech: '<ol><li><b>Break down the budget with tracing</b> — network, queue, retrieval, rerank, prefill, decode, guardrails, post-processing. Most teams cannot answer this and that is the real problem.</li><li><b>Attack the largest term.</b> Common culprits: a cross-encoder reranker on the critical path (300–800 ms), a synchronous guardrail pass, retrieval fan-out to a cold index, or an enormous prompt.</li><li><b>Parallelise</b> anything independent — retrieval and prompt assembly, multiple retrieval lanes, guardrails alongside generation rather than after it.</li><li><b>Cut output tokens</b> — decode is usually the biggest term. Instruct for brevity, cap max_tokens, use structured output instead of prose.</li><li><b>Cache</b> — prompt cache always; a semantic cache if traffic is repetitive.</li><li><b>Route</b> — small model for easy requests, big model only where needed.</li><li><b>Speculative decoding</b> for the tokens-per-second term.</li><li><b>Stream</b> — last, because it changes perception rather than the number, but it buys goodwill while you do the rest.</li></ol>',
  trap: 'The question as usually asked is "reduce latency without sacrificing quality". Say explicitly which levers are free (caching, parallelisation, removing dead weight from the prompt) and which trade quality (smaller model, fewer retrieved chunks, skipping the reranker) — and propose measuring the quality cost of the second group rather than guessing.',
  tags: ['latency', 'debugging'], orig: 33 },

{ id: 'in11', topic: 'inference', level: 2,
  q: 'What is the difference between latency and throughput here, and why do they fight?',
  lay: 'Latency is how long one person waits. Throughput is how many people you serve per hour. Batching more people together serves more people per hour and makes each individual wait slightly longer.',
  tech: 'Latency = time for one request (TTFT + tokens × inter-token latency). Throughput = tokens per second across all concurrent requests, which is what determines cost per token. They conflict because decode is memory-bandwidth-bound: batching amortises one expensive weight read across many sequences, so throughput rises steeply with batch size while per-request latency rises gently. Serving is therefore a dial, not an optimum — you pick a point on the curve based on whether the workload is interactive or batch, and you often run two pools with different settings.',
  trap: 'The strong answer proposes separate pools: an interactive pool with small batches and tight latency SLOs, and a batch pool with large batches for offline work. Trying to serve both from one configuration is how teams end up with bad latency AND bad economics.',
  tags: ['latency', 'throughput'] },

{ id: 'in12', topic: 'inference', level: 2,
  q: 'What is PagedAttention?',
  lay: 'The server used to reserve room for the longest possible answer on every request, even when the answer turned out to be one sentence. PagedAttention borrows the operating system trick: hand out small fixed-size blocks on demand instead of one big reservation.',
  tech: 'From the vLLM paper. KV cache is stored in fixed-size blocks (commonly 16 tokens) with a per-sequence block table mapping logical to physical blocks, exactly like virtual memory. Waste is bounded by one block instead of by max_tokens — a request generating 40 tokens holds 48 slots rather than 2048. Reported throughput improvement is roughly 2–4×, entirely from fitting larger batches. Second benefit: blocks can be shared with copy-on-write, giving free prefix sharing across concurrent requests with the same system prompt, and cheap parallel sampling.',
  trap: 'Pair it with continuous batching. PagedAttention is the memory manager; continuous batching is the scheduler. Together they are what a modern inference server IS.',
  tags: ['vllm', 'kv-cache'], orig: 51 },

{ id: 'in13', topic: 'inference', level: 2,
  q: 'Which inference server would you choose and why?',
  lay: 'For serving your own open model at scale, vLLM is the default. If you need every last bit of speed on NVIDIA hardware and can tolerate a build step, TensorRT-LLM. For a laptop, llama.cpp. For managed simplicity, a hosted API.',
  tech: '<ul><li><b>vLLM</b> — PagedAttention, continuous batching, wide model support, an OpenAI-compatible API, multi-LoRA. The default choice for self-hosting.</li><li><b>TensorRT-LLM</b> — best raw performance on NVIDIA, at the cost of an ahead-of-time compilation step and less flexibility.</li><li><b>TGI</b> (Hugging Face) — solid, good ecosystem integration.</li><li><b>SGLang</b> — strong on structured generation and prefix-heavy workloads via RadixAttention.</li><li><b>llama.cpp / Ollama</b> — CPU and consumer GPU, GGUF quantisation, local development.</li></ul>Decision factors: model support, quantisation format, structured-output support, multi-LoRA, and whether you need to compile per model.',
  trap: 'The honest first answer is often "do not self-host yet". Below a few million tokens a day, a hosted API is cheaper once you count engineering time, and it removes an entire on-call surface.',
  tags: ['serving', 'vllm'] },

{ id: 'in14', topic: 'inference', level: 3,
  q: 'How do you size a GPU deployment for a given traffic level?',
  lay: 'Work out how many tokens per second you need, work out how many tokens per second one GPU produces at your batch size, divide, then add headroom for peaks and redundancy.',
  tech: '<ol><li><b>Demand:</b> requests/second × (input + output tokens per request). Use peak, not average — the peak-to-average ratio is often 3–5×.</li><li><b>Supply:</b> benchmark YOUR model on YOUR hardware at YOUR sequence lengths. Published numbers are measured on different shapes and will mislead you.</li><li><b>Memory check:</b> weights + KV cache at your target batch and context must fit, or your achievable batch is smaller than you assumed.</li><li><b>Divide, then multiply</b> — add 30–50% headroom, plus replicas for availability, plus capacity for a rolling deploy.</li><li><b>Validate with a load test</b> at p95, not with a single-request benchmark.</li></ol>',
  code: `def gpus_needed(rps, in_tok, out_tok, tok_per_s_per_gpu, headroom=1.4):
    # output tokens dominate: they are generated one at a time
    demand = rps * (in_tok / 8 + out_tok)     # prefill is ~8x cheaper per token
    return math.ceil(demand * headroom / tok_per_s_per_gpu)

print(gpus_needed(rps=20, in_tok=3000, out_tok=400,
                  tok_per_s_per_gpu=2200))   # ~9 GPUs`,
  trap: 'The most common sizing mistake is benchmarking with a 200-token prompt and deploying with a 4000-token RAG prompt. Prefill cost scales with the prompt, and your KV cache — and therefore your batch size — scales with total sequence length.',
  tags: ['capacity', 'serving'] },

{ id: 'in15', topic: 'inference', level: 2,
  q: 'What is model routing / cascading, and how much does it save?',
  lay: 'Most questions are easy. Send those to a small cheap model and only escalate the hard ones to the expensive model. Done well, most of your traffic never touches the big model and quality barely moves.',
  tech: 'A router decides the model tier per request. Approaches: (1) a cheap classifier trained on features of the request; (2) a small model attempts first and a confidence check decides whether to escalate — this is a cascade; (3) rules on intent, user tier or request length. Savings are real: if 70% of traffic is handled by a model that costs a twentieth as much, total spend falls by roughly 65%. The critical piece is the escalation signal — self-reported confidence is weak, so use verifiable checks (does the output parse, does the citation exist, did retrieval succeed) plus a judge on a sample.',
  dgm: { nodes: [{ t: 'request' }, { t: 'router', s: 'cheap classifier', k: 'alt' }, { t: 'small model', s: '~70% of traffic' }, { t: 'confidence check' }, { t: 'large model', s: 'escalations only', k: 'warn' }],
    cap: 'Cost falls with the share handled by the cheap tier; quality is protected by the escalation check.' },
  trap: '"How do you know the router is not sending hard questions to the small model?" You measure quality per tier separately and you keep a shadow sample where the big model also answers, so you can quantify the gap you accepted.',
  tags: ['routing', 'cost'], orig: 27 },

{ id: 'in16', topic: 'inference', level: 2,
  q: 'What is context trimming, and what are the strategies?',
  lay: 'The conversation grows until it will not fit. Something has to go. The question is what, and the wrong answer — letting a library silently drop the oldest messages — takes your instructions with it.',
  tech: 'Strategies, usually combined: <ul><li><b>Sliding window</b> — keep the last N turns verbatim.</li><li><b>Summarisation</b> — compress older turns into a rolling summary, always regenerated from the ORIGINAL transcript, never from the previous summary.</li><li><b>Pinned facts</b> — ids, names, constraints held in structured state and re-injected verbatim every turn.</li><li><b>Relevance selection</b> — retrieve the most relevant past turns for THIS question rather than the most recent.</li><li><b>Tool-output truncation</b> — truncate at the tool boundary, store the full result out of band under an id.</li><li><b>Priority-based eviction</b> — an explicit ordered policy: drop old verbatim turns first, then old tool outputs, then low-ranked retrieved documents; never the system prompt, never the pinned facts.</li></ul>',
  trap: 'Reserve headroom for the ANSWER. Running out there produces a truncated response, which users read as a model failure and which your eval judge scores as incoherent.',
  tags: ['context', 'trimming'], orig: 27 },

{ id: 'in17', topic: 'inference', level: 2,
  q: 'What are the main cost levers for an LLM application, in order?',
  lay: 'Do not call the model. If you must, call a cheaper one. If you must call the expensive one, send it less. If you send it a lot, make sure it is the same thing every time so it is cached. And do not pay for words nobody reads.',
  tech: '<ol><li><b>Caching</b> — prompt caching (up to 90% off input tokens, nearly free to adopt), then exact/normalised caching, then a semantic cache. This is the biggest and cheapest lever.</li><li><b>Routing</b> — a cheap model for the easy majority.</li><li><b>Shorten the input</b> — fewer retrieved chunks, tighter system prompt, compressed few-shot block, truncated tool outputs.</li><li><b>Shorten the output</b> — output tokens cost 3–5× input. Structured output instead of prose; ask for brevity; cap max_tokens.</li><li><b>Batch offline work</b> — batch APIs are typically 50% cheaper for anything not interactive.</li><li><b>Distil</b> — a small fine-tuned model for a high-volume narrow task.</li><li><b>Self-host</b> — only above a genuine volume threshold, and count engineering time.</li></ol>',
  trap: 'The one people forget: multi-turn conversations resend the entire history, so cost grows quadratically with turns. Trimming and summarising is a cost lever, not just a context lever.',
  tags: ['cost'], orig: 28 },

{ id: 'in18', topic: 'inference', level: 2,
  q: 'How do you calculate cost per request, properly?',
  lay: 'Count every token you send and receive, including the ones you forgot about — the system prompt, the tool definitions, the retrieved documents, the retries, and the guardrail model that also read the answer.',
  tech: 'cost = (input_tokens × input_price + output_tokens × output_price) / 1e6, summed over EVERY model call in the request path. The parts people omit: tool schemas (sent on every call), retrieved chunks, the reranker, the guardrail or judge pass, retries after a timeout, and each additional step in an agent loop. Then divide the cached portion at the cached rate. Report p50 and p99, not the mean — a small number of runaway requests can dominate the bill and the mean hides them.',
  code: `def request_cost(calls, in_price=3.0, out_price=15.0, cached_discount=0.9):
    total = 0.0
    for c in calls:                       # every model call in the path
        fresh  = c["in_tokens"] - c.get("cached_tokens", 0)
        total += (fresh * in_price
                  + c.get("cached_tokens", 0) * in_price * (1 - cached_discount)
                  + c["out_tokens"] * out_price) / 1e6
    return total`,
  trap: 'Alarm on cost per request, not on total spend. Total spend hides the handful of catastrophic requests — the agent that looped forty times — that are both your biggest risk and your easiest fix.',
  tags: ['cost'], orig: 28 },

{ id: 'in19', topic: 'inference', level: 3,
  q: 'When would you self-host a model instead of using an API?',
  lay: 'When the volume is high enough that per-token pricing hurts, when the data cannot leave your network, when you need a model nobody hosts, or when you need control over latency that a shared API cannot give you.',
  tech: 'Reasons to self-host: (1) volume — the crossover is usually in the millions of tokens per day, and you must include engineering and on-call cost; (2) data residency or regulatory constraints; (3) a custom fine-tuned or unusual model; (4) predictable latency without a noisy shared tenancy; (5) no rate limits you do not control. Reasons not to: you now own capacity planning, GPU procurement, upgrades, quantisation, an inference stack, an on-call rota, and you lose the automatic quality improvements that arrive when a provider ships a better model.',
  trap: 'The strongest answer includes a threshold and an honest total cost of ownership. "We would self-host above roughly X million tokens a day, and below that the API is cheaper once you count the two engineers it takes to run a GPU fleet."',
  tags: ['serving', 'cost'] },

{ id: 'in20', topic: 'inference', level: 2,
  q: 'What is structured output / constrained decoding, and how does it work?',
  lay: 'Instead of asking politely for JSON and hoping, you make it physically impossible for the model to produce anything else — at each step, tokens that would break the format are removed from the running.',
  tech: 'Constrained decoding masks the logits at each step so only tokens permitted by a grammar or JSON schema can be sampled. Implementations: Outlines and XGrammar compile a schema into a finite-state machine over the token vocabulary; llama.cpp supports GBNF grammars; providers expose it as JSON mode or structured outputs. Guarantees validity by construction, unlike prompt-based requests which fail a small but non-zero percentage of the time — and that percentage is where your production incidents come from.',
  trap: 'Two honest caveats: over-constraining can hurt quality (forcing a schema the model finds unnatural), and it cannot make the CONTENT correct — a schema-valid JSON with a hallucinated customer id is still wrong. Validity and correctness are different guarantees.',
  tags: ['structured-output'], orig: 46 },

{ id: 'in21', topic: 'inference', level: 2,
  q: 'What happens if you exceed the context window at inference?',
  lay: 'Either you get a clear error, or — much worse — something silently deletes part of your prompt to make it fit. Usually the oldest part, which is your system prompt.',
  tech: 'Behaviour varies: raw APIs typically return an error; many client libraries and frameworks silently truncate. The dangerous default is dropping the oldest messages, which removes the system prompt and the original task. Correct handling: count tokens BEFORE sending, treat overflow as a normal branch rather than an exception, trim by an explicit policy that pins the system prompt and the task, summarise what you drop, and reserve headroom for the answer so the response itself is not truncated.',
  trap: 'This is the mechanism behind "the agent forgot everything at turn 50". It is not model degradation — it is silent truncation with no error, and the fix is to own the trimming yourself and log the token count of every request.',
  tags: ['context', 'failure'], orig: 32 },

{ id: 'in22', topic: 'inference', level: 3,
  q: 'What is chunked prefill and why does it exist?',
  lay: 'A very long prompt takes a while to read. If the server reads it all in one go, everyone currently receiving words has to wait. Chunked prefill reads it in slices, interleaved with everyone else\'s words.',
  tech: 'Prefill and decode compete for the same GPU. A 32k-token prefill occupies the device long enough to stall ongoing decodes, which shows up as inter-token latency spikes for other users. Chunked prefill splits a long prefill into pieces and schedules them between decode iterations, smoothing tail latency at a small cost to raw prefill throughput. It is one of the main reasons modern servers can offer both long context and stable streaming.',
  trap: 'Connect it to a symptom: "our streaming stutters when someone sends a long document" is a scheduling problem, not a model problem, and chunked prefill (or separating prefill and decode into different pools) is the fix.',
  tags: ['serving', 'latency'] },

{ id: 'in23', topic: 'inference', level: 3,
  q: 'What is disaggregated prefill/decode serving?',
  lay: 'Reading and writing want different hardware. Run them on separate machines, tuned separately, and pass the digested memory between them.',
  tech: 'Because prefill is compute-bound and decode is memory-bandwidth-bound, running both on the same replica means one phase is always underusing the hardware. Disaggregation puts them in separate pools: prefill nodes process prompts and transfer the resulting KV cache to decode nodes over a fast interconnect. Benefits: each pool can be scaled and configured independently, TTFT and inter-token latency stop interfering, and utilisation rises. Cost: the KV transfer is substantial data, so it needs high-bandwidth networking, and the system is more complex.',
  trap: 'This is a scale answer. If asked at a startup, the honest response is that it matters above a certain fleet size and that chunked prefill gets you most of the tail-latency benefit for far less complexity.',
  tags: ['serving', 'architecture'] },

{ id: 'in24', topic: 'inference', level: 2,
  q: 'What is a batch API and when should you use it?',
  lay: 'Tell the provider "I do not need this back for a few hours" and they charge you about half, because they can fit your work into the gaps in their schedule.',
  tech: 'Asynchronous bulk processing with a longer completion window (commonly up to 24 hours) at roughly 50% of the interactive price. Right for: backfilling embeddings, offline classification, evaluation runs, synthetic data generation, nightly summarisation, and any enrichment that does not block a user. Design implication: separate your interactive path from your batch path from day one, because retrofitting that split later means untangling code that assumed a synchronous call.',
  trap: 'The related pattern worth naming is async processing in general: if a task takes more than a few seconds, return a job id immediately and deliver the result by webhook, email or notification. Holding an HTTP connection open for ninety seconds is a bad experience and a fragile system.',
  tags: ['cost', 'async'], orig: 55 },

{ id: 'in25', topic: 'inference', level: 2,
  q: 'How do you handle rate limits properly?',
  lay: 'Back off, wait the amount they told you to wait, and add randomness so all your servers do not retry at exactly the same moment and rebuild the spike you just caused.',
  tech: '<ol><li>Respect <span class="mono">Retry-After</span> — it is not advisory.</li><li>Exponential backoff with FULL jitter (<span class="mono">sleep = random(0, base × 2^n)</span>), not a small random addition. Equal-jitter and full-jitter strategies measurably outperform naive backoff.</li><li>Throttle at the source with a token-bucket limiter sized to your actual quota, so you rarely see a 429 at all.</li><li>Priority queue — interactive requests jump ahead of batch work.</li><li>Overflow routing to a second provider or a smaller model.</li><li>Shed the lowest-value traffic first, deliberately, rather than failing randomly.</li><li>Alarm on 429 rate and queue depth, not just on errors.</li></ol>',
  code: `import random, time
def call_with_backoff(fn, attempts=5, base=0.5):
    for n in range(attempts):
        try:
            return fn()
        except RateLimited as e:
            if n == attempts - 1: raise
            wait = e.retry_after or random.uniform(0, base * 2 ** n)  # FULL jitter
            time.sleep(wait)`,
  trap: 'Tight retry loops turn a rate limit into an outage. And retrying a request that failed for a non-transient reason (a 400, a schema violation) is pure waste — classify the error before you retry it.',
  tags: ['rate-limit', 'reliability'], orig: 37 },

{ id: 'in26', topic: 'inference', level: 2,
  q: 'How should you handle an LLM timeout?',
  lay: 'Wait less than the user will. Try once more, politely. Then fall back to something smaller and faster, and be honest that the answer is a fallback.',
  tech: '<ol><li>Set the client timeout SHORTER than the user\'s patience. If the budget is 4 seconds, do not wait 60.</li><li>Retry once with backoff and jitter, and only on genuinely transient errors.</li><li><b>Hedge</b> — after p95 latency elapses, fire a second request to another model or region and take the first response. Costs a small percentage more and cuts the tail dramatically.</li><li>Fail over to a smaller model with a trimmed prompt, and MARK the answer as degraded.</li><li>Circuit-break after a threshold: stop calling for 30 seconds rather than queueing forever.</li><li>Never cache a degraded answer.</li></ol>',
  trap: 'The "never cache the degraded answer" rule is the one that separates people who have run this in production. Caching a fallback response turns a thirty-second incident into a permanent quality regression nobody can find.',
  tags: ['timeout', 'reliability'], orig: 37 },

{ id: 'in27', topic: 'inference', level: 3,
  q: 'What is request hedging and what does it cost?',
  lay: 'If the answer has not come back by the time it usually does, ask a second time somewhere else and use whichever arrives first. You pay for a few extra calls and you cut the worst waits sharply.',
  tech: 'Send a duplicate request after the p95 latency has elapsed, then take the first response and cancel the other. Because only the slow tail triggers a hedge, the extra cost is roughly (1 − p95 percentile) = about 5% more calls, while p99 latency can improve dramatically. Requirements: the operation must be idempotent (safe to run twice), and you need a cancellation path so you are not billed for both completions where the provider supports it.',
  trap: 'Never hedge a non-idempotent operation. Hedging a request that sends an email or charges a card sends two emails and charges twice. Hedge reads, not writes.',
  tags: ['latency', 'reliability'] },

{ id: 'in28', topic: 'inference', level: 2,
  q: 'What is a fallback model strategy?',
  lay: 'A second-choice model ready to take over when the first one is down, rate-limited or too slow — plus the honesty to record that today\'s answer came from the understudy.',
  tech: 'Tiers: primary → secondary (different provider, ideally different cloud) → a small local model → a canned response or a human handoff. Requirements that people forget: prompts must be portable across providers (different templates, different tool-calling formats, different structured-output support), you need an eval on the fallback so you know what quality you are accepting, and every response must carry the model id so downstream analysis is not silently mixing two populations.',
  trap: 'Test the fallback regularly — a fallback nobody has exercised in six months does not work. Fire drills belong in the release process, not in the incident.',
  tags: ['reliability', 'fallback'], orig: 55 },

{ id: 'in29', topic: 'inference', level: 2,
  q: 'What is the difference between concurrency, batch size and throughput?',
  lay: 'Concurrency is how many people are talking to you at once. Batch size is how many of them the GPU processes in one step. Throughput is how many words per second come out in total.',
  tech: 'Concurrency is a property of your traffic; batch size is a property of the scheduler; throughput is the outcome. With continuous batching the server assembles a batch from whatever is currently in flight, so batch size varies per step and is bounded by KV cache memory. Raising concurrency raises throughput until you saturate either compute or KV memory, after which requests queue and latency rises sharply — the classic hockey stick. Find that knee with a load test and set your admission control below it.',
  trap: 'Naming admission control is a strong signal: past the knee, accepting more requests makes everything worse for everyone. Rejecting or queueing with a visible wait is better than degrading uniformly.',
  tags: ['serving', 'capacity'] },

{ id: 'in30', topic: 'inference', level: 3,
  q: 'How would you serve a 70B model on a single 80 GB GPU?',
  lay: 'It will not fit at full precision, so you compress it. Four-bit quantisation takes it from about 140 GB to about 35 GB, leaving room for the conversation memory.',
  tech: 'fp16 weights are ~141 GB — impossible on one card. Options: <ul><li><b>int4 (AWQ or GPTQ)</b> — ~35 GB of weights, leaving ~40 GB for the KV cache and activations. This is the standard answer.</li><li><b>int8</b> — ~71 GB, technically fits but leaves almost nothing for the KV cache, so batch size is tiny and throughput is poor.</li><li><b>CPU offload</b> — works, and is unusably slow for interactive use because weights stream over PCIe every token.</li></ul>Then tune context length and batch size against the remaining memory, and quantise the KV cache to fp8 if you need more concurrency.',
  trap: 'Quote the quality cost honestly: int4 is a small but real regression, and it shows up first on long-context and reasoning tasks. If the workload is either of those, measure before committing.',
  tags: ['quantisation', 'serving'], orig: 2 },

{ id: 'in31', topic: 'inference', level: 2,
  q: 'What metrics would you put on an inference dashboard?',
  lay: 'How long people wait, how much you are spending, how often it breaks, and how hard the machines are working — each broken down so you can see which model and which route is responsible.',
  tech: '<ul><li><b>Latency:</b> TTFT p50/p95/p99, inter-token latency, end-to-end p95, queue wait time.</li><li><b>Throughput:</b> requests/s, output tokens/s, tokens/s per GPU.</li><li><b>Utilisation:</b> GPU utilisation, KV cache occupancy, batch size distribution.</li><li><b>Cost:</b> cost per request p50/p99, cost per successful task, cache hit rate, share of traffic per model tier.</li><li><b>Reliability:</b> error rate by class (timeout, 429, 5xx, schema failure), retry rate, share of responses served from the degraded path.</li><li><b>Quality proxies:</b> output token length distribution, refusal rate, truncation rate, thumbs-down rate.</li></ul>',
  trap: 'KV cache occupancy is the underrated one. If it is near 100% you are memory-bound and your batch size is capped — that tells you to quantise the cache or shorten context, and no other metric shows it.',
  tags: ['observability', 'serving'], orig: 39 },

{ id: 'in32', topic: 'inference', level: 2,
  q: 'How do you make LLM output reproducible for testing?',
  lay: 'Pin everything you can — the model version, the seed, the temperature — and then write tests that check the meaning rather than the exact words, because you will never get byte-identical output forever.',
  tech: 'Pin: an explicit model version (never a floating alias like "latest"), temperature 0, a seed where supported, and the exact prompt template. Then assert on structure and semantics rather than strings: does the JSON parse, is the extracted field correct, does the answer contain the required citation id, is the classification label right. For open-ended output, use a frozen judge with a rubric and assert on a score threshold with tolerance. Record every prompt/response pair with its model version so you can diff when something changes.',
  trap: 'Exact-string assertions on LLM output are a test suite that fails on a Tuesday for no reason and gets disabled within a month. Saying that shows you have maintained one.',
  tags: ['testing', 'determinism'] },

{ id: 'in33', topic: 'inference', level: 3,
  q: 'What is KV cache offloading and when is it useful?',
  lay: 'Move the older parts of the conversation memory to slower storage — system RAM or disk — and bring them back when needed. Cheaper, and slower.',
  tech: 'Move cold KV blocks from HBM to host memory or NVMe, freeing GPU memory for larger batches. Useful for very long contexts, multi-turn sessions with gaps between turns, and prefix caches too large to keep resident. The cost is transfer bandwidth: PCIe is orders of magnitude slower than HBM, so this only pays when the alternative is recomputing prefill entirely. Related idea: persistent prefix caching across requests, where a hot system prompt\'s KV state is kept in host memory and copied in on a hit.',
  trap: 'Compare it honestly against just recomputing. For a short prefix, recomputing prefill is faster than fetching from disk. Offloading wins for large prefixes that would otherwise be recomputed repeatedly.',
  tags: ['kv-cache', 'memory'], orig: 26 },

{ id: 'in34', topic: 'inference', level: 2,
  q: 'What is the difference between an embedding model call and a generation call, operationally?',
  lay: 'Embedding is one quick pass that returns numbers — cheap, fast, batchable, and you can run thousands at once. Generation writes word by word — slower, dearer, and the price depends on how much it writes.',
  tech: 'Embedding: a single encoder forward pass, no autoregressive loop, output is a fixed-size vector. Extremely batchable (hundreds per request), typically 10–100× cheaper per token than generation, and latency is a few milliseconds. Generation: prefill plus N decode steps, priced on input and output separately. Operationally this means embedding is a batch-friendly background job (backfill your corpus overnight) while generation sits on the interactive path. It also means embedding is almost never your bottleneck or your bill in a RAG system — retrieval quality is where the effort goes.',
  trap: 'A useful cost note: re-embedding a whole corpus when you change models is a one-off batch job, usually cheaper than people fear. That removes the main objection to switching to a better embedding model.',
  tags: ['embeddings', 'cost'] },

{ id: 'in35', topic: 'inference', level: 3,
  q: 'Explain the arithmetic intensity argument for why decode is memory-bound.',
  lay: 'To produce one word, the model has to read every one of its billions of numbers out of memory and do a tiny amount of arithmetic with each. Reading is the slow part, so the chip spends most of its time waiting rather than calculating.',
  tech: 'Arithmetic intensity = FLOPs per byte moved. In decode with batch size 1, each weight is read once and used in a matrix-vector product: roughly 2 FLOPs per parameter, and 2 bytes read per parameter in fp16 — an intensity near 1. Modern GPUs need intensities in the hundreds to saturate their compute, so the device idles waiting on HBM. Prefill, by contrast, does matrix-MATRIX products over many tokens, reusing each weight across the sequence, so intensity is high and compute is the limit. This single fact explains: why batching helps decode enormously (weight reads amortised across sequences), why speculative decoding works (verification is nearly free), and why weight quantisation speeds up decode (fewer bytes to move).',
  trap: 'This is the answer that distinguishes people who have profiled a model from people who have read a blog post. If you can state it clearly, most follow-up serving questions answer themselves.',
  tags: ['performance', 'theory'], orig: 51 },

{ id: 'in36', topic: 'inference', level: 2,
  q: 'What is a cold start in LLM serving and how do you avoid it?',
  lay: 'The first request after a machine boots is slow because a hundred gigabytes of model has to be loaded from storage into the GPU before anything can happen.',
  tech: 'Loading a 70B model can take minutes: read from object storage, page into host memory, copy to device, and (for TensorRT-LLM) possibly compile. Mitigations: keep a warm pool rather than scaling to zero, use fast local NVMe with the weights pre-staged in the image, load safetensors with memory mapping, use a smaller model for the warm-up window, and pre-warm during a rolling deploy so the new replica is ready before it takes traffic. Serverless GPU offerings that scale to zero are extremely attractive on paper and usually unacceptable for interactive traffic because of this.',
  trap: 'Rolling deploys are the real-world version of this. If new pods take three minutes to become ready and the load balancer sends them traffic at thirty seconds, every deploy causes a latency spike your users notice.',
  tags: ['serving', 'ops'] },

{ id: 'in37', topic: 'inference', level: 2,
  q: 'What is tokens-per-second and how do you interpret it?',
  lay: 'How fast the words come out. A person reads about ten words a second, so anything above roughly fifteen tokens a second feels like it is keeping up. Below that, people watch the text crawl.',
  tech: 'Two different measurements share the name: <b>per-request output rate</b> (what the user experiences, driven by inter-token latency) and <b>aggregate server throughput</b> (total output tokens per second across all requests, which determines cost per token). They move in opposite directions with batch size, so quoting one without saying which is meaningless. Useful targets: above ~15 tokens/s per request for interactive reading; aggregate throughput as high as your latency SLO allows.',
  trap: 'When a vendor quotes "3000 tokens/s", ask at what batch size, what sequence length and which measurement. A large aggregate number at batch 256 tells you nothing about what one user will experience.',
  tags: ['latency', 'metrics'] },

{ id: 'in38', topic: 'inference', level: 3,
  q: 'How would you A/B test two models in production safely?',
  lay: 'Send a small slice of traffic to the new one, watch the numbers that matter, and be able to turn it off in seconds. Decide what "better" means before you start, not after you see the results.',
  tech: '<ol><li>Define the primary metric and the guardrail metrics BEFORE launch — for example task completion as primary, with latency p95, cost per request and escalation rate as guardrails.</li><li>Randomise by stable user or session id, not per request, so one user has one consistent experience.</li><li>Start at 1–5%, with an automatic rollback triggered by guardrail breaches.</li><li>Compute the required sample size up front; use a sequential test if you intend to monitor continuously, or you will peek your way into a false positive.</li><li>Log the model version on every response so analysis is not mixing populations.</li><li>Run for at least a full weekly cycle — weekday and weekend traffic differ.</li></ol>',
  trap: 'Offline evals and online results routinely disagree. When they do, the online result wins — and the interesting work is explaining the gap, which usually means your eval set does not match real traffic.',
  tags: ['ab-test', 'deployment'], orig: 48 },

{ id: 'in39', topic: 'inference', level: 2,
  q: 'What is a semantic cache and what makes it risky?',
  lay: 'A cache that recognises "when do I get my money back" and "how long do refunds take" are the same question. Enormously effective on repetitive traffic — and it is the one cache that can confidently hand someone the wrong answer.',
  tech: 'Embed the incoming question, search a vector index of previously-answered questions, and reuse the stored answer if similarity clears a threshold. Typical hit rates of 25–50% on FAQ-shaped traffic. The risk is precision: similarity is not equivalence. Negation is the classic failure — "is X refundable" and "is X not refundable" embed very closely. Controls: tune the threshold against LABELLED paraphrase pairs rather than guessing; include tenant, locale, permissions, prompt version, model version and retrieved-content version in the cache key; never cache low-confidence or degraded answers; and add a TTL by intent class, short for volatile topics and long for stable ones.',
  trap: 'The interviewer wants to hear that you know it can be wrong. Say it first, then say how you would measure and bound the error rate — that is the difference between someone who has run one and someone who has read about one.',
  tags: ['caching', 'semantic-cache'], orig: 1 },

{ id: 'in40', topic: 'inference', level: 3,
  q: 'Design a cache for an LLM that gets the same question a hundred different ways.',
  lay: 'Build it in layers. Normalise the text so trivial differences collapse. Keep the provider\'s prefix cache warm by never changing the top of your prompt. Then add a meaning-based layer on top, with a threshold you actually measured and a key that includes everything that could change the answer.',
  tech: '<ol><li><b>Normalise and hash</b> — lowercase, collapse whitespace, strip punctuation. Free, and it multiplies exact-match hit rate.</li><li><b>Prefix cache discipline</b> — stable content at the top of the prompt, volatile at the bottom. Nearly free, and it cuts input cost and TTFT.</li><li><b>Semantic layer</b> — embed the normalised question, search past questions, serve on a tuned threshold.</li><li><b>The key is the design.</b> Include: normalised question, tenant, locale, user tier if answers differ by plan, prompt version, model id, and a hash of retrieved chunk ids plus their document versions. That last component makes invalidation automatic — change a document and its answers stop matching.</li><li><b>Guards:</b> negative caching with a short TTL against penetration, single-flight against stampede, TTL jitter against avalanche, and never write a degraded or low-confidence answer.</li><li><b>Measure:</b> hit rate, and separately the wrong-answer rate on a labelled sample. A hit rate with no precision number is not a result.</li></ol>',
  dgm: { nodes: [{ t: 'question' }, { t: 'normalise' }, { t: 'exact key', s: '~3 ms' }, { t: 'semantic', s: '~30 ms', k: 'alt' }, { t: 'prefix cache', s: 'skips prefill', k: 'alt' }, { t: 'model', s: 'full cost', k: 'warn' }],
    cap: 'Each layer catches what the previous one missed. Only the semantic layer can be wrong.' },
  trap: 'The version-in-the-key idea is the one that impresses. It converts cache invalidation — famously one of the two hard problems — into a naming problem.',
  tags: ['caching', 'design'], orig: 1,
  xref: [['Tune a semantic cache threshold live', '../ai_system_design_concepts/index.html']] },

{ id: 'in41', topic: 'inference', level: 2,
  q: 'What is cache penetration, and how is it different from a stampede?',
  lay: 'Penetration is people asking for things that do not exist anywhere — the cache can never help, so every request goes straight through to your database. A stampede is one popular thing expiring and two thousand people asking for it in the same second.',
  tech: '<b>Penetration:</b> requests for keys absent from both cache and backing store. The cache offers no protection because there is nothing to store. Trivially weaponised — generate random ids and you have a denial-of-service. Fixes: cache the negative result with a short TTL, put a Bloom filter in front (definite-absence in microseconds, no false negatives), validate key shape before looking anything up, and rate limit on MISS rate rather than request rate. <b>Stampede (dogpile / thundering herd):</b> a hot key expires and all concurrent misses regenerate simultaneously. Fixes: single-flight locking, serve-stale-while-revalidate, TTL jitter, and refresh-ahead for known-hot keys.',
  trap: 'The LLM twist on penetration: a user pastes a fresh random string into every question, so your semantic cache misses forever and every request pays full inference cost. Detect it with a per-caller miss-rate alarm, not a QPS alarm.',
  tags: ['caching', 'reliability'], orig: 11 },

{ id: 'in42', topic: 'inference', level: 2,
  q: 'How do you keep a cache from serving stale answers when the underlying data changes?',
  lay: 'Put a version of the data into the cache key. Change the document and the key changes, so the old answers simply stop matching — no purging, no bookkeeping.',
  tech: 'Three complementary mechanisms: <ol><li><b>Content-versioned keys</b> — include a hash of the retrieved chunk ids and their document versions. Automatic invalidation with no purge logic at all.</li><li><b>Event-driven purge</b> — the ingestion pipeline emits "document 42 changed" and you evict every cached answer whose key references chunk 42. Requires a reverse index from chunk to cache key.</li><li><b>TTL by intent class</b> — short for volatile topics (pricing, availability, status), long for stable ones (policy, definitions). One global TTL is always wrong for something.</li></ol>Plus: show the answer\'s age where it matters, and give the user a "get a fresh answer" button.',
  trap: '"What if the document changed but your index has not caught up yet?" Then the cache is not the problem — your ingestion lag is. Measure and alarm on index freshness separately, because a correct cache over a stale index is still a stale answer.',
  tags: ['caching', 'freshness'], orig: 34 }

]);
