/* ============================================================
   Foundations — the questions that open almost every round.
   Fields: id, topic, level (1 junior / 2 mid / 3 senior), q,
           lay, tech, code?, compare?, dgm?, trap?, tags, orig?
   `orig` records which of the 57 seed questions this answers.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'fo01', topic: 'foundations', level: 1,
  q: 'What is generative AI, and how is it different from the machine learning that came before it?',
  lay: 'Older machine learning was a very good sorting hat: show it an email and it says "spam" or "not spam" — one of a fixed set of answers it was trained to choose between. Generative AI writes a new answer instead of picking one. Same idea underneath (learn patterns from examples), completely different output: a menu versus a blank page.',
  tech: 'Discriminative models learn <span class="mono">P(y|x)</span> over a fixed label set. Generative models learn a distribution over sequences and sample from it, so the output space is open-ended. Modern LLMs are autoregressive: they factor <span class="mono">P(x₁..xₙ) = Π P(xᵢ | x₁..xᵢ₋₁)</span> and generate one token at a time. Two consequences follow immediately and explain most of the field: the output is probabilistic (same prompt, different answer), and there is no ground-truth label at inference time, so "is this correct" becomes a hard evaluation problem rather than a lookup.',
  trap: '"So is it just autocomplete?" Mechanically yes, and that is the honest answer — but at scale, next-token prediction over a large corpus forces the model to learn syntax, facts, arithmetic and reasoning shortcuts, because all of those reduce prediction loss. Say that instead of getting defensive.',
  tags: ['genai', 'basics'] },

{ id: 'fo02', topic: 'foundations', level: 1,
  q: 'What is a token, and why does everything in this field get measured in tokens?',
  lay: 'A token is a chunk of text — roughly three-quarters of an English word. "Unbelievable" might be three tokens: "un", "believ", "able". The model never sees letters or words, only these chunks. And because every chunk costs money to read and money to write, tokens are the unit of your bill, your speed and your context limit all at once.',
  tech: 'Tokens are the output of a subword tokenizer (BPE, WordPiece or Unigram) over a fixed vocabulary, typically 30k–200k entries. Rules of thumb for English: ~4 characters per token, ~0.75 words per token, ~1.3 tokens per word. Non-Latin scripts and code cost significantly more tokens per unit of meaning. Everything downstream is denominated in tokens: API pricing, the context window, KV cache memory, prefill and decode time.',
  trap: '"Why can it not count the letters in strawberry?" Because it never sees letters. It sees two or three token chunks, and character-level questions ask about information the tokenizer already destroyed.',
  tags: ['tokens', 'basics'], orig: 40 },

{ id: 'fo03', topic: 'foundations', level: 2,
  q: 'Why do LLMs use a subword tokenizer instead of treating every word as one token?',
  lay: 'Give every word its own number and you need millions of numbers, you still break on every typo and every new product name, and half your model becomes a giant dictionary. Give every letter its own number and sentences become five times longer, which makes the model far slower and it has to learn spelling before it learns meaning. Subwords are the compromise: common words stay whole, rare words break into reusable pieces, and nothing is ever unknown.',
  tech: 'Three options, one survivor.',
  compare: { cols: ['Word-level', 'Character-level', 'Subword (BPE)'],
    rows: [
      ['Vocabulary size', 'millions, and still incomplete', '~100', '30k–200k, fixed'],
      ['Unknown words', '&lt;UNK&gt; — information destroyed', 'never', 'never — falls back to pieces'],
      ['Sequence length', 'shortest', '4–5× longer', 'short'],
      ['Attention cost', 'low', 'quadratic in a much longer sequence', 'low'],
      ['Morphology', 'unrelated ids for run/runs/running', 'must be learned from scratch', 'partly shared through pieces'],
      ['Embedding table', 'larger than the rest of the model', 'tiny', 'reasonable']
    ] },
  trap: 'Follow-ups worth pre-empting: numbers tokenise badly (which is part of why arithmetic is shaky), non-English text costs more tokens per word, and the same string can tokenise differently depending on the leading space — <span class="mono">" the"</span> and <span class="mono">"the"</span> are usually different tokens.',
  tags: ['tokenizer', 'bpe'], orig: 40 },

{ id: 'fo04', topic: 'foundations', level: 1,
  q: 'What is an embedding?',
  lay: 'A list of numbers that stands for meaning. "Dog" and "puppy" get lists that are close together; "dog" and "database" get lists far apart. Once meaning is a position in space, "find me something similar" becomes "find me something nearby", which a computer can do very fast.',
  tech: 'A dense vector, typically 384–3072 dimensions, produced by an encoder trained so that semantically related inputs land close under a chosen distance metric. Contrastive training objectives pull positive pairs together and push negatives apart. Key properties: the space is only meaningful relative to the model that produced it (you cannot mix two models in one index), directions can carry relationships (the classic king − man + woman ≈ queen), and cosine similarity is the usual metric because magnitude carries little signal.',
  trap: '"What dimension should I use?" Not the biggest available. Higher dimensions cost memory and index build time; measure recall on your own eval set. Matryoshka-style models let you truncate dimensions and trade a little accuracy for a lot of memory.',
  tags: ['embeddings'], orig: 50 },

{ id: 'fo05', topic: 'foundations', level: 1,
  q: 'What is the context window, and what actually happens when you exceed it?',
  lay: 'It is the model\'s desk. Everything it can see right now — your instructions, the conversation so far, the documents you pasted, and the space for its answer — has to fit on that desk. Go over and something falls off the edge. The dangerous part is that nothing beeps.',
  tech: 'A hard architectural limit on the number of tokens in one forward pass, covering prompt plus generated output. Exceeding it either throws an error or, worse, triggers silent truncation in a client library — which usually drops the OLDEST messages, meaning your system prompt goes first. Two costs scale with it: attention is O(n²) in sequence length, and the KV cache is linear in tokens × batch, which is what really limits your throughput.',
  trap: '"You have a million tokens now, so this is solved?" No. You pay for every token on every request, prefill takes seconds at that size, accuracy sags in the middle of a long context, and everything in the window is visible to the model regardless of who is asking — which is a permissions problem retrieval solves and a big window does not.',
  tags: ['context'], orig: 38 },

{ id: 'fo06', topic: 'foundations', level: 1,
  q: 'What are parameters, and does a bigger parameter count mean a better model?',
  lay: 'Parameters are the knobs the model tuned during training — billions of them. More knobs means more capacity to store patterns, in the same way a bigger library can hold more books. But a well-organised small library beats a huge disorganised one, and that is roughly where the field has landed.',
  tech: 'Weights learned by gradient descent. Count drives memory directly: fp16 needs 2 bytes per parameter, so a 7B model is ~14 GB of weights, a 70B is ~140 GB. Scaling laws (Kaplan, then Chinchilla) showed that for a fixed compute budget most models were undertrained on data rather than too small — Chinchilla-optimal is roughly 20 training tokens per parameter. Since then the trend has been smaller models trained far longer, plus mixture-of-experts, where total parameters and active-per-token parameters diverge sharply.',
  trap: 'Know the distinction between total and active parameters. Mixtral 8x7B holds about 46.7B parameters and activates roughly 12.9B per token — so it costs like a 13B model to run and like a 47B model to store.',
  tags: ['scaling', 'params'] },

{ id: 'fo07', topic: 'foundations', level: 2,
  q: 'Why does the same prompt give a different answer each time?',
  lay: 'Because the model does not pick one word, it produces a ranked list of likely next words and then rolls a weighted die. Turn the randomness down to zero and it always picks the favourite — which is right for extracting a date and wrong for writing marketing copy.',
  tech: 'The model outputs logits over the whole vocabulary; sampling parameters transform that into an actual choice. Temperature divides the logits, top-k truncates by rank, top-p truncates by cumulative mass. Temperature 0 is greedy decoding, which is deterministic in principle. In practice even greedy is not perfectly reproducible on hosted APIs: batching changes floating-point reduction order, GPU kernels are non-deterministic, mixture-of-experts routing depends on batch composition, and model builds change silently.',
  trap: '"So how do you test it?" Pin a seed where the API offers one, assert on parsed fields rather than exact strings, and use an eval set with tolerant matching. Anyone who asserts on exact output has a test suite that fails on a Tuesday for no reason.',
  tags: ['sampling', 'determinism'], orig: 8 },

{ id: 'fo08', topic: 'foundations', level: 1,
  q: 'What is a hallucination, and why do models hallucinate at all?',
  lay: 'The model is not looking anything up. It is producing the most plausible continuation, and a fluent wrong answer is often more plausible-sounding than an awkward right one. It is not lying — lying requires knowing the truth. It is filling in a shape.',
  tech: 'Fabricated content presented with the same confidence as grounded content. Root causes: (1) the model is optimising for likelihood, not truth; (2) training data contains errors and contradictions; (3) parametric knowledge is lossy and has a cutoff; (4) with no retrieved context the model has nothing to anchor to; (5) RLHF rewards helpful-sounding answers, which mildly penalises "I do not know". Mitigations in order of effectiveness: retrieve and cite, force refusal when retrieval is empty, verify citations mechanically, constrain output structure, and judge faithfulness against the provided context.',
  trap: 'The strongest answer names the empty-retrieval case explicitly: if your retriever returns nothing and you pass an empty context anyway, the model answers from parametric memory and sounds completely certain. That single code path causes more production hallucination than the model does.',
  tags: ['hallucination'], orig: 39 },

{ id: 'fo09', topic: 'foundations', level: 2,
  q: 'What is the difference between a base model, an instruct model and a chat model?',
  lay: 'A base model has read the internet and will happily continue whatever you write, including continuing your question with more questions. An instruct model has been taught that when someone asks something, they want an answer. A chat model has additionally been taught to keep track of who said what.',
  tech: '<ul><li><b>Base / pretrained:</b> trained only on next-token prediction. Excellent at completion, terrible at following instructions, no notion of a conversation. Cheapest to fine-tune from and the right starting point if you have a lot of domain data.</li><li><b>Instruct / SFT:</b> supervised fine-tuned on (instruction, response) pairs, usually followed by preference tuning. Answers questions.</li><li><b>Chat:</b> an instruct model with a trained chat template — special tokens delimiting system, user and assistant turns. Using the wrong template silently degrades quality, which is one of the most common self-hosting bugs.</li></ul>',
  trap: 'If you self-host, always apply the model\'s own chat template (<span class="mono">tokenizer.apply_chat_template</span>). Hand-rolling "User: ... Assistant:" for a model trained on different delimiters costs real accuracy and produces no error.',
  tags: ['models'] },

{ id: 'fo10', topic: 'foundations', level: 2,
  q: 'What is a mixture-of-experts model, and what does it actually buy you?',
  lay: 'Instead of one enormous generalist, you have eight specialists and a receptionist who sends each question to the two most relevant ones. You keep the knowledge of all eight but only pay to run two.',
  tech: 'The feed-forward sublayer is replaced by N expert FFNs plus a router that selects top-k experts per token. Total parameters scale with N; compute scales with k. Mixtral 8x7B: ~46.7B total, ~12.9B active per token. The catch is that memory is driven by TOTAL parameters — every expert must be resident — so an MoE is cheap to compute and expensive to host. Operationally the hard part is load balancing: a popular expert becomes a bottleneck, so training uses an auxiliary load-balancing loss and serving uses expert parallelism with careful placement.',
  compare: { cols: ['Dense model', 'Mixture of experts'],
    rows: [
      ['Parameters used per token', 'all of them', 'only the routed top-k'],
      ['Memory to host', 'equals the parameter count', 'equals the TOTAL count, not the active one'],
      ['Compute per token', 'high', 'much lower for the same total size'],
      ['Training stability', 'straightforward', 'needs load-balancing losses; routing can collapse'],
      ['Serving complexity', 'low', 'expert parallelism, all-to-all communication, imbalance']
    ] },
  trap: '"So MoE is free capacity?" No. You pay full memory for capacity you mostly do not use on any given token, and you inherit an entire class of load-imbalance operational problems.',
  tags: ['moe', 'architecture'] },

{ id: 'fo11', topic: 'foundations', level: 1,
  q: 'What is the difference between AI, machine learning, deep learning and generative AI?',
  lay: 'Nested boxes. AI is the whole idea of machines doing clever things. Machine learning is the subset that learns from examples instead of being programmed rule by rule. Deep learning is the subset of that which uses many-layered neural networks. Generative AI is the subset of deep learning that produces new content rather than a label.',
  tech: 'AI ⊃ ML ⊃ deep learning ⊃ generative models ⊃ LLMs. Worth adding one distinction interviewers listen for: classical ML still wins on tabular data with clear features (gradient-boosted trees remain the default for structured prediction), deep learning wins where representation learning matters (images, audio, text), and generative models are the subset whose output is a sample from a learned distribution rather than a point estimate.',
  trap: 'A good candidate volunteers that LLMs are not the answer to everything: if the task is "predict churn from 40 tabular columns", XGBoost is faster, cheaper, more accurate and auditable.',
  tags: ['basics', 'taxonomy'] },

{ id: 'fo12', topic: 'foundations', level: 2,
  q: 'What is a knowledge cutoff, and what are the ways around it?',
  lay: 'The model finished reading on a certain date and knows nothing after it. Worse, it does not reliably know that it does not know — ask about last week and it may invent something confidently.',
  tech: 'The end date of the pretraining corpus. Four ways around it, in increasing order of cost: (1) put the fact in the prompt; (2) retrieval, which is the general answer for anything that changes; (3) tool use — let it call a live API or a search engine; (4) continued pretraining or fine-tuning, which is slow, expensive and still frozen at a new date. Note that fine-tuning is a poor way to inject facts: it teaches form far better than it teaches content, and it has no versioning story.',
  trap: 'The model often does not behave as if it has a cutoff. It will answer a post-cutoff question fluently. Handle it in the harness: detect time-sensitive intents and force a retrieval or a tool call rather than trusting the model to abstain.',
  tags: ['cutoff', 'rag'] },

{ id: 'fo13', topic: 'foundations', level: 2,
  q: 'What is zero-shot, few-shot and chain-of-thought prompting?',
  lay: 'Zero-shot is asking. Few-shot is asking after showing two worked examples. Chain-of-thought is asking it to show its working before giving the answer — which, remarkably, makes the answer more likely to be right.',
  tech: '<ul><li><b>Zero-shot:</b> instruction only. Best default for capable models; adding examples can even hurt by over-constraining the format.</li><li><b>Few-shot / in-context learning:</b> k demonstrations in the prompt. No weights change — the model conditions on the pattern. Most valuable for enforcing an output FORMAT or an unusual convention, less for teaching knowledge.</li><li><b>Chain of thought:</b> eliciting intermediate reasoning tokens before the answer. It works because the extra tokens give the model more forward passes to compute in — reasoning is literally serial computation it could not do in one step.</li></ul>',
  trap: 'Two follow-ups: chain-of-thought costs latency and tokens, and on simple tasks it can reduce accuracy by talking the model out of a correct first instinct. And newer reasoning models do this internally, so bolting "think step by step" onto them is redundant at best.',
  tags: ['prompting', 'cot'], orig: 53 },

{ id: 'fo14', topic: 'foundations', level: 2,
  q: 'What is temperature actually doing, mathematically?',
  lay: 'It flattens or sharpens the model\'s preferences before it rolls the die. Low temperature means "always pick your favourite". High temperature means "give the outsiders a real chance".',
  tech: 'Logits are divided by T before the softmax: <span class="mono">p_i = exp(z_i / T) / Σ exp(z_j / T)</span>. As T → 0 the distribution approaches a one-hot on the argmax (greedy). As T → ∞ it approaches uniform over the vocabulary. T &lt; 1 sharpens, T &gt; 1 flattens. Practically: 0–0.3 for extraction, SQL and code; ~0.7 for chat; 0.9–1.2 for creative variety; above 1.3 is rarely useful because the tail is genuinely bad.',
  code: `# temperature, top-k and top-p applied in the order a real server applies them
import numpy as np

def sample(logits, temperature=0.7, top_k=0, top_p=0.95):
    if temperature <= 0:                       # greedy
        return int(np.argmax(logits))
    z = logits / temperature
    p = np.exp(z - z.max()); p /= p.sum()

    order = np.argsort(-p)
    if top_k:
        p[order[top_k:]] = 0
    if top_p < 1.0:
        cum = np.cumsum(p[order])
        # keep the smallest set covering top_p, INCLUDING the one that crosses it
        cut = np.searchsorted(cum, top_p) + 1
        p[order[cut:]] = 0
    p /= p.sum()                               # renormalise the survivors
    return int(np.random.choice(len(p), p=p))`,
  trap: '"Is temperature 0 deterministic?" It is greedy, which is a different claim. Batching, GPU kernel non-determinism and MoE routing can still change the token.',
  tags: ['sampling', 'temperature'], orig: 8 },

{ id: 'fo15', topic: 'foundations', level: 1,
  q: 'What are top-k and top-p, and which should you use?',
  lay: 'Both throw away unlikely words before the die is rolled. Top-k says "only the best 40 candidates are allowed in the room". Top-p says "keep adding candidates until you have covered 90% of the probability, then stop" — so the room is small when the model is confident and large when it is not. Top-p adapts; top-k does not.',
  tech: 'Top-k truncates by rank: keep the k highest-probability tokens and renormalise. Top-p (nucleus) truncates by cumulative mass: sort descending, keep the smallest prefix whose probabilities sum to at least p. Nucleus is generally preferred because the survivor set size responds to the shape of the distribution. Stacking both aggressively is a mistake — the tighter one wins and you no longer know which knob is doing the work.',
  compare: { cols: ['Top-k', 'Top-p (nucleus)'],
    rows: [
      ['Cuts by', 'rank', 'cumulative probability mass'],
      ['Survivor count', 'always k', 'varies with model confidence'],
      ['On a confident step', 'lets in k−1 bad options', 'shrinks to one or two'],
      ['On an uncertain step', 'may cut good options', 'widens automatically'],
      ['Typical value', '40', '0.9–0.95'],
      ['Use it when', 'you want a hard, predictable bound', 'almost always — this is the better default']
    ] },
  trap: 'Setting top_p to 1.0 disables it. Setting top_k to 0 usually disables it. Knowing the "off" values matters more than knowing the defaults.',
  tags: ['sampling'], orig: 8 },

{ id: 'fo16', topic: 'foundations', level: 1,
  q: 'What are max tokens, stop sequences and the repetition penalty?',
  lay: 'Max tokens is a guillotine, not an editor — it cuts the answer off mid-sentence rather than making it concise. A stop sequence is a tripwire: the moment the model types that string, generation ends. The repetition penalty is a nudge that says "you already said that".',
  tech: '<ul><li><b>max_tokens:</b> a hard cap on generated tokens. Always set it — it is your only defence against a runaway loop billing you for 100k tokens. To get short answers, ask for them in the prompt AND set this as the circuit breaker.</li><li><b>stop sequences:</b> strings that terminate generation; the stop string itself is not returned. Essential for few-shot formats and agent scratchpads — stopping at <span class="mono">"Observation:"</span> is what prevents the model hallucinating its own tool results.</li><li><b>repetition / frequency / presence penalty:</b> subtracts from the logit of tokens already produced. Frequency penalty scales with count, presence penalty is a flat one-off. Useful in long prose at 0.1–0.5.</li></ul>',
  trap: 'The repetition penalty destroys code and JSON, because those formats repeat braces, quotes and key names by design. If someone tells you they set it to 1.2 for structured output, that is the bug.',
  tags: ['sampling', 'decoding'], orig: 8 },

{ id: 'fo17', topic: 'foundations', level: 2,
  q: 'What is the difference between an encoder, a decoder and an encoder-decoder model?',
  lay: 'An encoder reads the whole sentence at once and produces an understanding of it — good for classifying and searching. A decoder writes left to right and can only see what it has already written — good for generating. Encoder-decoder does both: read fully, then write.',
  tech: '<ul><li><b>Encoder-only</b> (BERT, most embedding models): bidirectional attention, no causal mask. Trained with masked language modelling. Best for classification, NER and retrieval embeddings — every token sees full context, which is exactly what a good sentence vector needs.</li><li><b>Decoder-only</b> (GPT, Llama, Claude): causal mask, trained on next-token prediction. Scales best and is what almost every modern LLM is.</li><li><b>Encoder-decoder</b> (T5, BART): cross-attention from decoder to a fully-encoded input. Strong on translation and summarisation, largely displaced by large decoder-only models.</li></ul>',
  trap: 'Interviewers like: "why are embedding models usually encoders?" Because the vector should reflect the entire input, and a causal mask means the first token never sees the last. Decoder-based embedders exist and work, but they need tricks like bidirectional attention at the last layer or last-token pooling.',
  tags: ['architecture'] },

{ id: 'fo18', topic: 'foundations', level: 2,
  q: 'What is the difference between pretraining, fine-tuning and in-context learning?',
  lay: 'Pretraining is school — years of general reading, done once, at enormous expense. Fine-tuning is a specialist course afterwards that changes how they think. In-context learning is handing them a briefing note on the way into the meeting: nothing about them changes, they just have the note.',
  tech: 'Pretraining: self-supervised next-token prediction on trillions of tokens; updates every weight; costs millions. Fine-tuning: supervised or preference-based updates on a smaller curated set; changes weights permanently; teaches form, style, format and behaviour far better than facts. In-context learning: no weight update at all — the model conditions on tokens in the prompt. The engineering rule that survives every interview: <b>fine-tuning teaches form, retrieval supplies facts.</b>',
  trap: '"We fine-tuned on our documentation so the model would know it." That is the most expensive way to build a bad search engine. The facts get blurred into the weights with no citations, no versioning and no way to delete anything.',
  tags: ['training', 'rag'], orig: 5 },

{ id: 'fo19', topic: 'foundations', level: 3,
  q: 'Why does chain-of-thought reasoning actually improve accuracy? What is the mechanism?',
  lay: 'A transformer does a fixed amount of thinking per word it produces. If the answer needs six steps of reasoning and you demand it in one word, there is nowhere for those steps to happen. Letting it write out the steps gives it the room.',
  tech: 'Each generated token is one forward pass through a fixed-depth network. Producing intermediate tokens converts a problem that would need more serial depth than the architecture has into one solved across many passes — the reasoning tokens are literally a scratchpad in the residual stream, extended in time. This is why chain-of-thought helps most on multi-step arithmetic and logic and barely at all on single-fact recall. It also explains test-time compute scaling: more reasoning tokens buy more computation, up to a point.',
  trap: 'Two honest caveats worth raising unprompted: the written reasoning is not guaranteed to be the actual computation (faithfulness of chain-of-thought is an open research problem), and on simple tasks forced reasoning can talk the model out of a correct first answer.',
  tags: ['cot', 'reasoning'] },

{ id: 'fo20', topic: 'foundations', level: 2,
  q: 'What is a system prompt, and what belongs in it?',
  lay: 'The standing instructions the model reads before every conversation — its job description. The user\'s message is what they said today; the system prompt is what they were told on their first day.',
  tech: 'A separately-delimited message with elevated priority in the chat template. What belongs there: role and scope, hard constraints and refusals, output format, tone, tool-use policy, and anything that is identical across every request. What does not: per-request data, retrieved documents, or anything volatile — because a stable prefix is what makes prompt caching work, and one changed character near the top invalidates the entire cache for that request.',
  trap: '"Is it a security boundary?" No. It is a strong prior, not a permission system. Users can and do talk models out of system prompts. Anything that must be enforced — tenant filtering, spend limits, which tools exist — is enforced in your code, outside the model.',
  tags: ['prompting', 'security'], orig: 53 },

{ id: 'fo21', topic: 'foundations', level: 1,
  q: 'What is an LLM API call actually made of, and what are you charged for?',
  lay: 'You send a pile of text and get back a smaller pile. You pay per chunk in both directions, and output chunks usually cost several times more than input ones because they are generated one at a time.',
  tech: 'Request: model id, a list of messages (system / user / assistant), sampling parameters, optional tool definitions, optional response schema. Billing: input tokens (everything you send — system prompt, history, tools, retrieved documents) and output tokens, priced separately, output typically 3–5× input. Cached input tokens are usually discounted heavily. Two implications people miss: (1) tool schemas count as input tokens on every call, and (2) in a multi-turn conversation you resend the entire history each time, so cost grows quadratically with turns unless you trim or summarise.',
  trap: 'The quadratic-history point is a favourite. A 30-turn conversation is not 30 calls of equal size; it is 30 calls of steadily growing size. That is exactly why prompt caching matters so much in agent loops.',
  tags: ['api', 'cost'] },

{ id: 'fo22', topic: 'foundations', level: 2,
  q: 'What are logits, and what is the softmax doing?',
  lay: 'Logits are raw scores — one per possible next word, unbounded and uncalibrated. Softmax turns that pile of scores into percentages that add up to 100%.',
  tech: 'The final layer projects the last position\'s hidden state onto the vocabulary, producing one real-valued logit per token. Softmax exponentiates and normalises: <span class="mono">p_i = e^{z_i} / Σ e^{z_j}</span>. Two practical notes: it is shift-invariant, which is why implementations subtract the max for numerical stability; and it is used at three quite different places in a transformer — attention weights, the output distribution, and MoE routing.',
  trap: '"Is the softmax probability a confidence score?" Only loosely. It is calibrated for next-token prediction, not for factual correctness. A model can be 99% confident on the first token of a completely fabricated citation. Use logprobs as a weak signal, never as a truth oracle.',
  tags: ['softmax', 'logits'] },

{ id: 'fo23', topic: 'foundations', level: 2,
  q: 'What are logprobs and what can you legitimately use them for?',
  lay: 'The model can tell you how sure it was about each word it wrote. That is genuinely useful for spotting the places where it was guessing — as long as you remember that being sure and being right are different things.',
  tech: 'The log of the sampled token\'s probability, plus optionally the top alternatives at each position. Legitimate uses: cheap classification (compare logprobs of "yes" and "no" instead of parsing prose), a routing signal for escalation, detecting low-confidence spans for highlighting, and constrained scoring of a fixed answer set. Illegitimate use: treating mean logprob as a hallucination detector — the correlation is weak and it fails exactly where you need it, on confident fabrications.',
  code: `# classification by comparing logprobs is cheaper, faster and unambiguous
# than asking for prose and parsing it
resp = client.chat.completions.create(
    model=MODEL, messages=msgs, max_tokens=1, logprobs=True, top_logprobs=5)
top = {t.token.strip().lower(): t.logprob
       for t in resp.choices[0].logprobs.content[0].top_logprobs}
label = "yes" if top.get("yes", -99) > top.get("no", -99) else "no"
margin = abs(top.get("yes", -99) - top.get("no", -99))   # route to a human if tiny`,
  trap: 'Not every provider exposes logprobs, and reasoning models often do not. Do not design a system whose confidence signal is unavailable on the model you end up using.',
  tags: ['logprobs', 'confidence'] },

{ id: 'fo24', topic: 'foundations', level: 3,
  q: 'What are scaling laws, and what did Chinchilla change?',
  lay: 'People found that model quality improves predictably as you add parameters, data and compute — you can draw the curve. Then a follow-up paper showed everyone had been building models that were too big and had read too little, like a huge brain that only got through half the syllabus.',
  tech: 'Kaplan et al. (2020) showed loss follows a power law in parameters, data and compute. Hoffmann et al. (2022, "Chinchilla") re-ran the compute-optimal analysis and found the optimum is roughly 20 training tokens per parameter — meaning models of that era were significantly undertrained. A 70B model trained on 1.4T tokens beat a 175B trained on 300B. Consequences that still hold: training budgets shifted toward data, small-and-long-trained models became the norm, and inference cost (which scales with parameters, not with training tokens) became the dominant lifetime cost, pushing everyone further toward smaller models.',
  trap: 'Chinchilla-optimal is compute-optimal for TRAINING. If you will serve billions of tokens, it is rational to overtrain a smaller model well past the Chinchilla point, because you pay training once and inference forever. That is what most modern open models do.',
  tags: ['scaling', 'chinchilla'] },

{ id: 'fo25', topic: 'foundations', level: 2,
  q: 'What is an emergent ability, and why is the term contested?',
  lay: 'Some skills seem to appear suddenly once a model gets big enough — nothing, nothing, nothing, then suddenly it can do three-digit arithmetic. A later paper argued the sharp jump is often an artefact of grading the task pass/fail rather than something really appearing out of nowhere.',
  tech: 'Originally: a capability absent in smaller models and present in larger ones, appearing non-linearly with scale. Schaeffer et al. (2023) showed many such curves are produced by discontinuous metrics — exact-match on a multi-step task is all-or-nothing, so smooth improvement in per-step accuracy looks like a step change. Switch to a continuous metric (token edit distance, per-step accuracy) and the curve is usually smooth.',
  trap: 'The useful engineering takeaway: choose continuous metrics for your own evals. Exact-match hides progress and makes your model comparisons noisy for exactly the same reason.',
  tags: ['scaling', 'eval'] },

{ id: 'fo26', topic: 'foundations', level: 1,
  q: 'What is the difference between a prompt, a completion and a conversation turn?',
  lay: 'The prompt is everything you send. The completion is what comes back. A turn is one exchange. The catch is that in a conversation, every previous turn is part of the next prompt — you are resending the whole transcript each time.',
  tech: 'Prompt = the fully rendered token sequence including system message, all prior turns, tool definitions and retrieved context. Completion = the generated tokens. In a stateless API, conversation state lives entirely on your side and is resent each call, so input tokens grow linearly with turn count and total conversation cost grows quadratically. This is the arithmetic behind every context-management technique: sliding windows, summarisation and prompt caching all exist to fight that curve.',
  trap: 'Assistant-provider APIs that keep state server-side do not change the economics; they just move where the trimming happens. You still pay for the tokens.',
  tags: ['api', 'context'], orig: 52 },

{ id: 'fo27', topic: 'foundations', level: 2,
  q: 'When should you NOT use an LLM?',
  lay: 'When a simpler thing is better. If the answer is a lookup, look it up. If it is arithmetic, calculate it. If it is a rule, write the rule. LLMs are for problems where the input is messy language and the output is judgement.',
  tech: 'Prefer a non-LLM approach when: the task is deterministic and specifiable (validation, routing on structured fields, arithmetic); latency must be single-digit milliseconds; the output must be provably correct or auditable; the task is tabular prediction (gradient-boosted trees still dominate); volume is enormous and margins are thin; or the correct answer already exists in a database. The strongest LLM systems use the model for the fuzzy part only and hand everything else to code — parsing intent, then calling a deterministic function.',
  trap: 'This is a maturity question. Candidates who answer "an LLM can do anything" score badly. The best answer includes a real example: "we replaced an LLM classifier with a regex plus a lookup table, and it was more accurate, 200× cheaper and did not need an eval suite."',
  tags: ['design', 'judgement'] },

{ id: 'fo28', topic: 'foundations', level: 2,
  q: 'What is multimodality, and what changes when you add images?',
  lay: 'The model can take pictures as well as text. Under the hood the picture is chopped into patches and turned into the same kind of number-chunks as words, so the model reads an image roughly the way it reads a sentence.',
  tech: 'A vision encoder (usually a ViT) turns an image into patch embeddings, which are projected into the language model\'s embedding space and prepended as tokens. Practical consequences: images consume a lot of tokens (often several hundred to a few thousand each, scaling with resolution), so cost and latency jump; the effective resolution of the encoder determines whether small text in the image is readable; and OCR-heavy tasks are often better served by a dedicated OCR pass feeding text to the LLM than by asking the vision model directly.',
  trap: '"How do you do RAG over images?" Either caption them with a vision model at index time and embed the caption (cheap, searchable, loses detail), or use a multimodal embedding model like CLIP-style joint space (keeps visual signal, weaker on text queries). Most production systems do both and fuse.',
  tags: ['multimodal', 'vision'] },

{ id: 'fo29', topic: 'foundations', level: 3,
  q: 'What is the difference between parametric and non-parametric knowledge in an LLM system?',
  lay: 'Parametric knowledge is what the model remembers from training — baked in, fast, free, and impossible to update or cite. Non-parametric knowledge is what you hand it at question time — current, citable, deletable, and it costs tokens.',
  tech: 'Parametric: encoded in the weights, primarily in the feed-forward layers, retrieved by association. Cannot be versioned, audited, permission-scoped or deleted without retraining. Non-parametric: retrieved documents, tool outputs, database rows placed in the context. The design rule follows directly: anything that changes, anything that must be cited, and anything that is permission-sensitive must be non-parametric. Anything about language, format, style and general reasoning can be parametric.',
  trap: '"Right to be forgotten" is a great follow-up. You cannot reliably delete a fact from weights; you can delete a row from an index instantly. That alone rules out fine-tuning as a knowledge store in most regulated settings.',
  tags: ['rag', 'knowledge'] },

{ id: 'fo30', topic: 'foundations', level: 2,
  q: 'What is quantisation, in one paragraph, and what does it cost you?',
  lay: 'Storing each of the model\'s billions of numbers with fewer decimal places. The model gets much smaller and faster and slightly less accurate — like a JPEG of the weights.',
  tech: 'Reducing weight (and optionally activation) precision from fp16/bf16 to int8, int4 or lower. Memory scales directly: a 70B model is ~140 GB at fp16, ~70 GB at int8, ~35 GB at int4. Quality loss is small down to int8 and modest but real at int4, and it is not uniform — reasoning and long-context tasks degrade first. Methods differ: GPTQ and AWQ are post-training, calibration-based and weight-only; NF4 (used by QLoRA) is a normal-float format tuned for weight distributions; and there is a separate axis of KV cache quantisation, which buys batch size rather than model size.',
  trap: 'Always ask "quantised what?". Weight-only quantisation cuts memory but the compute may still run in fp16. Activation quantisation is what actually speeds up the matrix multiplies, and it is harder to do without quality loss.',
  tags: ['quantisation'], orig: 7 },

{ id: 'fo31', topic: 'foundations', level: 1,
  q: 'Explain what an LLM does to a non-technical stakeholder in thirty seconds.',
  lay: 'It has read an enormous amount of text and learned, extremely well, which words tend to follow which other words. When you ask it something, it writes an answer one word at a time, each word chosen because it fits what came before. That is why it is fluent, why it is fast, and why it will sometimes be confidently wrong — it is producing what sounds right, and most of the time what sounds right is right.',
  tech: 'Interviewers use this to test communication, which is a real part of the job. A good answer: one concrete mechanism (next word prediction), one consequence they care about (fluent but not looked-up), one implication for the business (that is why we ground it in our own documents and check the answers). No jargon, no hedging, under thirty seconds.',
  trap: 'The failure mode is either drowning them in transformers or being so vague it sounds like magic. Land the "it predicts, it does not look up" distinction — every governance and accuracy conversation afterwards depends on it.',
  tags: ['communication'] },

{ id: 'fo32', topic: 'foundations', level: 2,
  q: 'What is the difference between an LLM, an agent and a workflow?',
  lay: 'An LLM answers. A workflow is a fixed set of steps you wrote, some of which call an LLM. An agent decides the steps itself. The more control you hand to the model, the more capable and the less predictable the system becomes.',
  tech: '<ul><li><b>Single call:</b> input → output. Predictable cost and latency.</li><li><b>Workflow / chain:</b> a fixed graph you authored. The LLM fills in steps but does not choose them. Debuggable, testable, bounded.</li><li><b>Agent:</b> the model decides control flow at run time — which tool, how many times, when to stop. Handles open-ended tasks, and introduces unbounded cost, variable latency and a much harder testing story.</li></ul>The engineering principle: use the least agency that solves the problem. Most production "agents" are workflows with one or two agentic steps, and they are better for it.',
  dgm: { nodes: [{ t: 'one call', s: 'fixed' }, { t: 'chain', s: 'you choose steps' }, { t: 'router', s: 'model picks a branch' }, { t: 'agent loop', s: 'model picks everything', k: 'warn' }],
    cap: 'Left to right: more capability, less predictability, harder evaluation.' },
  trap: '"When would you refuse to build an agent?" When the task has a known sequence, when cost variance is unacceptable, or when every action is irreversible. Saying that out loud signals experience.',
  tags: ['agents', 'design'], orig: 46 }

]);
