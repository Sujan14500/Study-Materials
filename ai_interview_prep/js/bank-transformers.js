/* ============================================================
   Transformers — architecture questions, from "what is attention"
   to "walk me through a block".
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'tr01', topic: 'transformers', level: 1,
  q: 'What is a transformer?',
  lay: 'A stack of identical blocks. Each block does two things: let every word look at every other word and copy what is relevant (attention), then let each word consult a big stored lookup of patterns on its own (the feed-forward layer). Stack that thirty-two times and you get a language model.',
  tech: 'A neural architecture built on self-attention, introduced in "Attention Is All You Need" (2017). It replaced recurrence with a mechanism where every position attends to every other position in one parallel operation — which is why it trains efficiently on GPUs where RNNs did not. A decoder-only LLM is N identical blocks, each containing multi-head self-attention and a position-wise feed-forward network, with residual connections and layer normalisation around both, followed by a projection to the vocabulary.',
  dgm: { nodes: ['tokens', 'embed + position', 'block ×N', 'final norm', 'unembed', 'softmax'],
    cap: 'Each block: LayerNorm → attention → add → LayerNorm → feed-forward → add.' },
  trap: '"Why did it beat RNNs?" Two reasons, and say both: parallel training over the sequence (an RNN must process token t before t+1), and a constant path length between any two positions, so long-range dependencies do not have to survive many sequential steps.',
  tags: ['architecture'], orig: 3 },

{ id: 'tr02', topic: 'transformers', level: 2,
  q: 'Walk me through one transformer block, step by step.',
  lay: 'Think of a committee meeting followed by private study. First everyone at the table looks around and copies notes from whoever seems relevant to them — that is attention. Then everyone goes back to their own desk and consults their personal memory about what they just heard — that is the feed-forward layer. Nobody talks in the second half. Then both sets of notes get added to what they already had, and the next meeting starts.',
  tech: '<ol><li><b>LayerNorm</b> the input (pre-norm). Per token; moves no information between positions.</li><li><b>Project to Q, K, V</b> — three linear maps. Query = what I am looking for; Key = what I advertise; Value = what I hand over if chosen.</li><li><b>Scores</b>: <span class="mono">QKᵀ / √d_k</span>. The √d_k keeps variance stable so softmax does not saturate.</li><li><b>Causal mask</b>: set the upper triangle to −∞ so no position reads the future.</li><li><b>Softmax</b> each row into weights that sum to 1.</li><li><b>Weighted sum of V</b> — the ONLY step where information crosses positions.</li><li><b>Output projection</b> W_O, concatenating the heads.</li><li><b>Residual add</b>: x = x + attn(x).</li><li><b>LayerNorm</b>, then <b>feed-forward</b>: up-project ~4×, non-linearity (GELU/SwiGLU), down-project.</li><li><b>Residual add</b> again. Output goes to the next block.</li></ol>At the end of the stack, take the LAST position only, apply a final norm, project onto the vocabulary and softmax.',
  trap: 'The question behind the question is whether you know attention is routing and the feed-forward is knowledge. Say it explicitly: attention moves information between tokens; the feed-forward adds stored facts to one token and holds roughly two thirds of the parameters.',
  tags: ['attention', 'ffn'], orig: 20,
  xref: [['Run a real 4-dim block, step by step', '../genai_flow/index.html']] },

{ id: 'tr03', topic: 'transformers', level: 2,
  q: 'What is self-attention, in your own words?',
  lay: 'Every word gets to ask the rest of the sentence a question and take a weighted average of the answers. In "the trophy did not fit in the suitcase because it was too big", the word "it" asks "who am I referring to?" and mostly gets back "trophy".',
  tech: 'For each position, form a query vector; for every position, a key and a value. The attention weight from i to j is <span class="mono">softmax_j(q_i · k_j / √d_k)</span>, and the output at i is the weighted sum of the value vectors. Self-attention means Q, K and V all come from the same sequence (as opposed to cross-attention, where Q comes from one sequence and K, V from another). Cost is O(n²·d) in time and O(n²) in attention memory, which is the whole reason long context is expensive.',
  code: `import numpy as np

def attention(X, Wq, Wk, Wv, causal=True):
    Q, K, V = X @ Wq, X @ Wk, X @ Wv
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)          # (n, n)
    if causal:                                # nothing may read the future
        scores += np.triu(np.full_like(scores, -np.inf), k=1)
    w = np.exp(scores - scores.max(-1, keepdims=True))
    w /= w.sum(-1, keepdims=True)             # each row sums to exactly 1
    return w @ V, w`,
  trap: '"Why divide by √d_k?" Because the dot product of two d-dimensional vectors with unit-variance components has variance d. Without the scaling, large d pushes softmax into a regime where one weight is ~1 and the rest ~0, and the gradients vanish.',
  tags: ['attention'], orig: 3 },

{ id: 'tr04', topic: 'transformers', level: 2,
  q: 'What is the feed-forward layer for, and why does it matter that it holds most of the parameters?',
  lay: 'Attention is the part that decides what to look at. The feed-forward layer is the part that knows things. It runs on each word separately — no looking around — and its job is: given what this position now represents, what do I know about that? Turn it off and the model can still route information perfectly and has nothing to say.',
  tech: 'A position-wise MLP: up-project from d to roughly 4d (or ~3.5d with SwiGLU\'s three matrices), apply a non-linearity, project back to d. It runs independently at every position and holds roughly two thirds of a block\'s parameters. Interpretability work reads it as key-value memory: the up-projection rows act as pattern detectors and the down-projection rows as the values written back into the residual stream when a detector fires. Factual associations live here — this is where model editing techniques like ROME operate.',
  compare: { cols: ['Self-attention', 'Feed-forward'],
    rows: [
      ['Job', 'move information between tokens', 'add stored knowledge to one token'],
      ['Sees other positions', 'yes — the only part that does', 'no'],
      ['Share of parameters', '~1/3', '~2/3'],
      ['Cost in sequence length', 'quadratic', 'linear'],
      ['Remove it and', 'words stop referring to each other', 'routing with no facts']
    ] },
  trap: 'People assume attention is where the knowledge is. It is not, and saying so with the parameter split as evidence is a strong signal.',
  tags: ['ffn', 'attention'], orig: 3 },

{ id: 'tr05', topic: 'transformers', level: 2,
  q: 'Why multi-head attention instead of one big head?',
  lay: 'One head can only ask one kind of question at a time. Split the same budget into twelve smaller heads and the model can ask twelve different questions in parallel — one tracking grammatical subject, one tracking which entity a pronoun refers to, one tracking position — and then combine the answers.',
  tech: 'The d-dimensional space is split into h heads of dimension d/h. Each head has its own Q, K, V projections and attends independently; outputs are concatenated and passed through W_O. Total parameters and FLOPs are roughly the same as one head of full width, but the model gets h independent attention patterns instead of one averaged one. Probing studies find specialised heads: previous-token heads, induction heads (which implement in-context copying and are strongly linked to few-shot learning), syntactic heads.',
  trap: '"Are more heads the same as more layers?" No — different axes. Heads split one attention step into parallel sub-questions at the same depth; layers stack whole blocks so later ones read the output of earlier ones. Serial depth is what enables composition.',
  tags: ['attention', 'heads'] },

{ id: 'tr06', topic: 'transformers', level: 2,
  q: 'What is the causal mask and why is it essential?',
  lay: 'It is a blindfold on the future. When the model is learning to predict word five, you must stop it peeking at word five in the input — otherwise it learns nothing except how to copy.',
  tech: 'Before the softmax, set every score for j &gt; i to −∞, so after exponentiation those weights are exactly zero. This makes the model autoregressive and lets you train on every position of a sequence in parallel while each position still only sees its prefix. It is also what makes the KV cache valid at inference: because position i never depends on anything after it, previously computed keys and values remain correct forever and can be reused.',
  trap: 'Two follow-ups. "What if you remove it?" You get an encoder (BERT-style) — better representations, but it cannot generate left to right. "Why does it make the KV cache possible?" Because causality guarantees past keys and values never change when you append a token.',
  tags: ['attention', 'masking'], orig: 3 },

{ id: 'tr07', topic: 'transformers', level: 2,
  q: 'How does the model know word order? Explain positional encoding and RoPE.',
  lay: 'Attention by itself is order-blind — "dog bites man" and "man bites dog" look identical to it. So you stamp each position with a signature before the model reads it. The modern trick is cleverer: instead of stamping, you rotate each word\'s question-and-answer vectors by an angle proportional to its position, so the maths automatically depends on how far apart two words are.',
  tech: '<ul><li><b>Sinusoidal (original):</b> fixed sin/cos of different frequencies added to embeddings. No parameters, extrapolates poorly.</li><li><b>Learned absolute:</b> a trainable vector per position. Simple; cannot go beyond trained length at all.</li><li><b>RoPE (rotary):</b> rotate Q and K by an angle proportional to position, in every layer. The dot product then depends on relative offset, which is what attention actually needs. This is what most modern models use.</li><li><b>ALiBi:</b> add a linear distance penalty to attention scores. Extrapolates well, very simple.</li></ul>RoPE is also why context extension works: scaling the rotation frequencies (position interpolation, NTK-aware scaling, YaRN) lets a model trained at 4k operate at 32k+ with modest fine-tuning.',
  trap: '"Why did RoPE win?" Relative rather than absolute, applied inside attention at every layer rather than added once at the bottom, no extra parameters, and it gives you a knob for context extension after training.',
  tags: ['position', 'rope'] },

{ id: 'tr08', topic: 'transformers', level: 2,
  q: 'What is the residual stream, and why do residual connections matter conceptually?',
  lay: 'Picture a running document that gets passed down the stack. Each block reads it, writes a small note in the margin, and passes it on. Nothing is ever erased and rewritten. That is why you can delete a middle layer of a big model and it mostly still works.',
  tech: 'Each sublayer computes <span class="mono">x = x + f(LayerNorm(x))</span>. Practically this gives gradients a direct path to early layers, which is what makes 100-layer stacks trainable. Conceptually — and this is the interpretability framing — the residual stream is a shared communication channel: attention heads and FFN neurons read from it and write additive updates into it, and different features occupy different directions in that space.',
  trap: '"Pre-norm or post-norm?" The original paper was post-norm; almost every modern model is pre-norm, because it keeps the residual path clean and makes deep stacks trainable without a long learning-rate warmup.',
  tags: ['residual', 'architecture'], orig: 20 },

{ id: 'tr09', topic: 'transformers', level: 2,
  q: 'What does LayerNorm do, and how is RMSNorm different?',
  lay: 'It rescales each word\'s vector so the numbers stay in a sensible range — like automatic gain control on a microphone. It does not change what the word means relative to other words, it just stops the volume drifting as you go deeper.',
  tech: 'LayerNorm normalises across the feature dimension per token: subtract the mean, divide by the standard deviation, then apply a learned scale and bias. RMSNorm drops the mean-centring and the bias, dividing only by the root mean square — about 10–15% cheaper with no measurable quality loss, which is why Llama and most recent models use it. Both are per-token operations that move no information between positions. Placement matters more than the choice: pre-norm (inside the residual branch) is standard now.',
  trap: '"Why not BatchNorm?" Because it makes tokens depend on other examples in the batch, which breaks with variable sequence lengths, breaks at batch size 1, and makes inference depend on batch composition. Sequence models use LayerNorm for exactly those reasons.',
  tags: ['normalisation'] },

{ id: 'tr10', topic: 'transformers', level: 3,
  q: 'What is grouped-query attention (GQA) and multi-query attention (MQA), and why do they exist?',
  lay: 'The model stores a memory of every word it has seen so it does not recompute them. That memory is huge. GQA is the realisation that you can share most of that memory between attention heads without losing much quality — and it can shrink the memory eight-fold.',
  tech: 'Standard multi-head attention keeps a separate K and V per head, so the KV cache is <span class="mono">2 × layers × heads × head_dim × seq × batch × bytes</span>. MQA uses ONE shared K/V head for all query heads — a huge memory saving with a measurable quality cost. GQA groups query heads and gives each group its own K/V, interpolating between them: Llama-3 70B has 64 query heads and 8 KV heads, an 8× KV cache reduction. Since KV cache size determines your maximum batch size, and batch size determines GPU utilisation, this is one of the highest-leverage architecture decisions for serving cost.',
  code: `# why GQA matters: KV cache for Llama-3 70B at 8k context, batch 32
layers, kv_heads, head_dim, seq, batch, bytes_ = 80, 8, 128, 8192, 32, 2
kv = 2 * layers * kv_heads * head_dim * seq * batch * bytes_
print(kv / 1024**3, "GB")            # ~43 GB — with GQA

kv_mha = 2 * layers * 64 * head_dim * seq * batch * bytes_
print(kv_mha / 1024**3, "GB")        # ~344 GB — without it. Does not fit anywhere.`,
  trap: 'Connect it to serving: GQA is not an accuracy optimisation, it is a throughput one. Smaller KV cache → larger batch → better GPU utilisation → lower cost per token.',
  tags: ['gqa', 'kv-cache'], orig: 51 },

{ id: 'tr11', topic: 'transformers', level: 2,
  q: 'Why is attention O(n²), and what have people done about it?',
  lay: 'Every word looks at every other word, so with twice as many words you have four times as many pairs. Doubling your document does not double the cost, it quadruples it.',
  tech: 'The score matrix is n×n, so both compute and (naively) memory are quadratic in sequence length. Approaches: <ul><li><b>FlashAttention</b> — exact, not approximate. It tiles the computation so the n×n matrix is never written to HBM, making it IO-aware. Memory becomes linear and it is substantially faster. This is what almost everyone actually uses.</li><li><b>Sparse / sliding-window attention</b> (Longformer, Mistral) — each token attends to a local window plus a few global tokens.</li><li><b>Linear attention / state-space models</b> (Mamba, RWKV) — replace softmax attention with a recurrent formulation that is linear in n.</li></ul>',
  trap: 'The key distinction: FlashAttention changes the memory access pattern and produces mathematically identical output. Sparse attention changes what the model can see. Confusing "exact but faster" with "approximate" is a common slip.',
  tags: ['attention', 'efficiency'] },

{ id: 'tr12', topic: 'transformers', level: 2,
  q: 'How does next-token prediction actually train a model to reason?',
  lay: 'You cover the next word and ask it to guess, billions of times. To get good at guessing, it has no choice but to learn grammar, then facts, then the shape of an argument — because all of those make the next word more predictable. Reasoning is not taught directly; it falls out of being very good at guessing.',
  tech: 'The objective is cross-entropy between predicted and actual next token, averaged over every position. Because the causal mask lets every position be a training example simultaneously, one 4k-token document yields 4k supervised examples in one forward pass. The pressure to reduce loss forces increasingly abstract structure: character statistics, then syntax, then semantics, then world knowledge, then approximations of algorithms — because a model that can do arithmetic predicts the token after "27 × 3 =" better than one that cannot.',
  code: `# the entire pretraining objective, in five lines
logits = model(input_ids)                    # (batch, seq, vocab)
loss = cross_entropy(
    logits[:, :-1].reshape(-1, vocab),       # predictions for positions 0..n-2
    input_ids[:, 1:].reshape(-1)             # the actual next token, shifted
)
loss.backward(); optimizer.step()`,
  trap: '"Why is that enough?" It is not, on its own — a base model trained this way is a good completer and a bad assistant. The reasoning comes from pretraining; the helpfulness comes from the SFT and preference stages after it.',
  tags: ['training', 'objective'], orig: 4 },

{ id: 'tr13', topic: 'transformers', level: 3,
  q: 'What is an induction head, and why do people care about it?',
  lay: 'A pair of attention heads that together implement "I saw this pattern before, so I will finish it the same way". They are the closest thing we have found to a mechanical explanation of why models can learn from examples in the prompt.',
  tech: 'A two-head circuit: a previous-token head copies information about token n−1 into position n, and an induction head then attends from the current token to the position AFTER a previous occurrence of the same token, copying it forward. Concretely: given "... A B ... A", it predicts "B". They emerge abruptly during training, coinciding with a visible drop in loss, and their emergence correlates strongly with the appearance of in-context learning ability.',
  trap: 'The interviewer is checking whether you follow interpretability at all. The honest framing: this is one of the few genuinely understood circuits, most of the model is not understood, and nobody should claim otherwise.',
  tags: ['interpretability'] },

{ id: 'tr14', topic: 'transformers', level: 2,
  q: 'What is the KV cache, and why does it exist?',
  lay: 'When the model writes word 500, it needs to look back at words 1 to 499 — but it already computed everything it needs about those words when it wrote them. The KV cache is the sticky note that says "do not redo that". Without it, generating N words costs N² work instead of N.',
  tech: 'During decoding, each new token needs the keys and values of every previous position. The causal mask guarantees those never change, so they are cached in GPU memory after their first computation. Effect: without a cache, generating token t recomputes attention over the whole prefix, so total work is O(n²); with it, each step is O(n) and total is O(n²) only in the attention read, with the expensive projections done once. The cost is memory: <span class="mono">2 × layers × kv_heads × head_dim × seq × batch × bytes</span>, which is usually what limits your batch size and therefore your throughput.',
  trap: '"What does it NOT speed up?" Prefill. The first pass over the prompt has nothing cached (unless prompt caching is in play), so time-to-first-token is unaffected by the KV cache. It accelerates decode only.',
  tags: ['kv-cache', 'inference'], orig: 25 },

{ id: 'tr15', topic: 'transformers', level: 3,
  q: 'What is the "lost in the middle" phenomenon?',
  lay: 'Put the answer at the start of a long document and the model finds it. Put it at the end and it finds it. Bury it exactly in the middle and accuracy drops noticeably. Attention is not uniform across a long context.',
  tech: 'Documented by Liu et al. (2023): retrieval accuracy plotted against the answer\'s position in a long context follows a U-shape, high at both ends and sagging in the middle, and the sag deepens as context grows. Attributed to a combination of positional encoding behaviour and training-data distribution (documents are usually front-loaded and conclusions are at the end). Engineering consequences: put the most important content first and last, restate the task at the END of a long prompt immediately before generation, rerank so the best retrieved chunk is at position 1, and do not assume a bigger window means uniform recall.',
  trap: 'This is the strongest single argument against "a 1M context window makes RAG obsolete". You have room for a million tokens; you do not have uniform attention over a million tokens.',
  tags: ['context', 'attention'], orig: 54 },

{ id: 'tr16', topic: 'transformers', level: 3,
  q: 'Explain the difference between prefill and decode.',
  lay: 'Prefill is reading the question — it can read every word at the same time, so it is fast per word and heavy on arithmetic. Decode is writing the answer — one word at a time, each one needing a full pass through the model, so it is slow per word and mostly waiting on memory.',
  tech: '<b>Prefill</b> processes all prompt tokens in one forward pass. It is compute-bound: large matrix multiplies with high arithmetic intensity, keeping the GPU busy. Cost is roughly linear in prompt length (quadratic in the attention term). <b>Decode</b> generates one token per forward pass. It is memory-bandwidth-bound: for each token you stream the entire weight matrix from HBM to do a tiny matrix-vector product, so the GPU is mostly idle waiting on memory. This asymmetry explains almost everything about LLM serving: batching helps decode enormously (one weight read amortised across many sequences) and helps prefill much less; speculative decoding attacks decode specifically; and time-to-first-token and tokens-per-second are separate metrics with separate fixes.',
  compare: { cols: ['Prefill', 'Decode'],
    rows: [
      ['Processes', 'the whole prompt at once', 'one token per pass'],
      ['Bound by', 'compute (FLOPs)', 'memory bandwidth'],
      ['Determines', 'time to first token', 'tokens per second'],
      ['Batching helps', 'a little', 'enormously'],
      ['Made faster by', 'prompt caching, shorter prompts', 'speculative decoding, quantisation, bigger batches'],
      ['GPU utilisation', 'high', 'low without batching']
    ] },
  trap: 'Say "decode is memory-bandwidth-bound" and explain why: you read gigabytes of weights to produce one token. That single sentence separates people who have served models from people who have read about them.',
  tags: ['inference', 'prefill'], orig: 51 },

{ id: 'tr17', topic: 'transformers', level: 2,
  q: 'Why is the first token so much slower than the rest?',
  lay: 'Before it can say anything, the model has to read everything you sent. That reading is one big burst of work over the whole prompt. After that, each new word is a small step that reuses everything already computed.',
  tech: 'Time-to-first-token = network + queueing + prefill over the full prompt. Prefill is O(prompt length) with a quadratic attention term, so a 100k-token prompt can take several seconds before a single output token appears. After that, each token is one decode step at a roughly constant rate. Levers on TTFT: shorter prompts, prompt/prefix caching (skip prefill for the cached prefix entirely), a smaller model or a smaller draft, better batching and queue policy, and moving retrieval off the critical path. Streaming does not reduce TTFT — it reduces perceived latency for everything after it.',
  dgm: { nodes: [{ t: 'network + queue', s: '~100 ms' }, { t: 'PREFILL', s: 'whole prompt', k: 'warn' }, { t: 'token 1', s: 'TTFT ends here' }, { t: 'token 2..n', s: 'steady rate' }],
    cap: 'Everything up to the first token is TTFT. Everything after it is throughput.' },
  trap: '"So streaming fixes slow first tokens?" No — that is the most common confusion here. Streaming changes when the user sees tokens after the first one. TTFT is unchanged, and it is the number users actually feel as "is it broken?".',
  tags: ['latency', 'ttft'], orig: 22 },

{ id: 'tr18', topic: 'transformers', level: 1,
  q: 'What is time to first token, and why is it the metric users feel?',
  lay: 'The gap between hitting enter and seeing the first character. Everything after that feels like reading; that gap feels like waiting. People forgive a slow answer that started immediately and abandon a fast answer that started after four seconds.',
  tech: 'TTFT = network round trip + queue wait + prefill compute + first decode step. Report it as p50 and p95, never as a mean — the tail is where users churn. Companion metrics: inter-token latency (or tokens per second) for the streaming rate, and total generation time for the complete response. A useful target for an interactive chat product is TTFT under about 500 ms at p95 and a streaming rate above human reading speed (~10 tokens/s).',
  trap: 'A strong answer separates the three numbers and says which lever moves which: prompt caching moves TTFT, speculative decoding moves inter-token latency, batching moves throughput and can make TTFT worse. Confusing them is how teams optimise the wrong thing for a quarter.',
  tags: ['latency', 'ttft'], orig: 23 },

{ id: 'tr19', topic: 'transformers', level: 3,
  q: 'What is FlashAttention and why did it matter so much?',
  lay: 'The expensive part of attention was not the arithmetic, it was shuttling a gigantic table in and out of the GPU\'s slow memory. FlashAttention never builds the whole table — it works in tiles that fit in fast on-chip memory. Same answer, several times faster, and far less memory.',
  tech: 'An IO-aware exact attention algorithm. It tiles Q, K and V into blocks that fit in SRAM and uses online softmax (running max and sum) to accumulate the result without ever materialising the n×n score matrix in HBM. Consequences: attention memory drops from O(n²) to O(n), wall-clock speedups of roughly 2–4× on typical shapes, and long context becomes practical. Crucially it is exact — the output is numerically equivalent, not an approximation.',
  trap: '"Is it an approximation?" No, and the interviewer is often checking exactly this. It changes the memory access pattern, not the mathematics.',
  tags: ['attention', 'efficiency'] },

{ id: 'tr20', topic: 'transformers', level: 2,
  q: 'What is cross-attention and where do you see it?',
  lay: 'Self-attention is a sentence looking at itself. Cross-attention is one sequence looking at a completely different one — a translation looking back at the original, or an image caption looking at the picture.',
  tech: 'Queries come from one sequence, keys and values from another. In encoder-decoder models each decoder layer cross-attends to the encoder output. In many vision-language models, cross-attention layers let text queries attend to image patch embeddings. Decoder-only LLMs use self-attention only — "retrieved context" is simply concatenated into the same sequence, which is why RAG needs no architectural change at all.',
  trap: 'A good aside: this is why RAG works with any off-the-shelf model. You are not modifying attention, you are putting text in the prompt. Architectures that cross-attend to a retrieved index (RETRO-style) exist but are rare in practice.',
  tags: ['attention', 'architecture'] },

{ id: 'tr21', topic: 'transformers', level: 2,
  q: 'What activation functions do modern transformers use, and why not ReLU?',
  lay: 'The non-linearity is what stops the whole network collapsing into one big multiplication. ReLU works but chops hard at zero; the modern ones curve smoothly around it, which trains slightly better.',
  tech: 'GELU (Gaussian Error Linear Unit) weights inputs by their percentile under a normal distribution — smooth, non-monotonic near zero, used by GPT and BERT. SwiGLU is a gated variant: <span class="mono">SwiGLU(x) = Swish(xW₁) ⊙ (xW₂)</span> then projected by W₃. It uses three matrices instead of two, so implementations shrink the hidden dimension (typically to ~8/3·d rather than 4·d) to keep the parameter count similar. Llama, Mistral and PaLM use SwiGLU; empirically it is worth about a point of perplexity for the same budget.',
  trap: 'The follow-up is "why does the parameter count still work out?" Because with three matrices you reduce the intermediate width. If you did not, the FFN would be 50% larger.',
  tags: ['activation', 'ffn'] },

{ id: 'tr22', topic: 'transformers', level: 3,
  q: 'How would you extend a model trained at 4k context to 32k?',
  lay: 'The model learned what "twenty words apart" feels like. If you suddenly show it things two hundred words apart, that feeling is off the end of its experience. So you squash the distances back into the range it knows, and give it a little practice at the new scale.',
  tech: 'With RoPE, several options: <ul><li><b>Position interpolation:</b> divide position indices by the extension factor so they fall inside the trained range. Needs a short fine-tune; simple and effective.</li><li><b>NTK-aware scaling:</b> change the RoPE base rather than the positions, scaling high and low frequencies differently. Often works with little or no fine-tuning.</li><li><b>YaRN:</b> combines NTK-aware interpolation with attention temperature scaling; strong results with far less fine-tuning data.</li><li><b>Continued pretraining</b> on genuinely long documents — most expensive, best quality.</li></ul>Always validate with a needle-in-a-haystack test across depths, not just perplexity: perplexity can look fine while retrieval at depth collapses.',
  trap: '"Does a longer window mean it uses the window well?" No. Extended models routinely pass perplexity checks and fail needle tests in the middle depths. Measure the thing you actually need.',
  tags: ['context', 'rope'] },

{ id: 'tr23', topic: 'transformers', level: 2,
  q: 'What does the unembedding / LM head do, and what is weight tying?',
  lay: 'At the end, the model has a vector representing "what should come next". The LM head compares that vector against every word in the vocabulary and scores each one. Weight tying is reusing the same table you used to look words up at the start.',
  tech: 'A linear projection from d_model to vocabulary size, applied only to the LAST position during generation. Weight tying reuses the transposed input embedding matrix as the output projection: it saves d × vocab parameters (substantial — for a 4096-dim model with a 128k vocab that is over 500M parameters) and is a sensible inductive bias, since a token\'s input and output representations should be related. Some large models untie them and gain a little quality.',
  trap: '"Why only the last position?" Because during generation only the last position predicts the next token. Every other position was computed so the last one had something to attend to — which is exactly what the KV cache lets you avoid recomputing.',
  tags: ['architecture', 'head'] },

{ id: 'tr24', topic: 'transformers', level: 3,
  q: 'What is speculative decoding and why does it work?',
  lay: 'A junior writes four words quickly, then the senior checks all four in one glance. If all four are what the senior would have written, you got four words for the price of one check. If the second is wrong, you throw away the rest and continue from there. You never get a worse answer — only the same answer, faster.',
  tech: 'A small draft model proposes γ tokens autoregressively; the large target model verifies all γ+1 positions in ONE forward pass (they can be batched because the draft supplied the inputs). Tokens are accepted with a modified-rejection-sampling rule that provably preserves the target model\'s output distribution. Expected accepted tokens per round is <span class="mono">E = (1 − α^(γ+1)) / (1 − α)</span> where α is the acceptance rate. It works because decode is memory-bandwidth-bound: verifying four positions costs almost the same as generating one, since you read the weights once either way.',
  code: `# expected speedup, including the draft's own cost
def speedup(alpha, gamma, draft_cost=0.15):
    expected = (1 - alpha ** (gamma + 1)) / (1 - alpha)
    cost = 1 + gamma * draft_cost            # one target pass + gamma draft passes
    return expected / cost

print(speedup(0.72, 4))    # ~2.1x  — a realistic acceptance rate
print(speedup(0.0,  4))    # ~0.63x — a LOSS. A bad draft model is worse than none.`,
  trap: 'The trap is claiming it always helps. At low acceptance you pay for drafts you throw away and end up slower. Also it improves latency, not throughput at high batch sizes — under heavy batching the GPU is already saturated and there is no spare capacity to speculate with.',
  tags: ['inference', 'speculative'], orig: 25 },

{ id: 'tr25', topic: 'transformers', level: 2,
  q: 'What is the difference between a transformer and an RNN/LSTM, and why did transformers win?',
  lay: 'An RNN reads a sentence like a person reading through a keyhole — one word at a time, remembering a summary as it goes, and forgetting the start of long sentences. A transformer lays the whole sentence on the table at once and lets every word see every other word directly.',
  tech: 'RNNs have a sequential dependency: hidden state h_t depends on h_{t−1}, so training cannot be parallelised across the sequence, and information from position 1 must survive n multiplications to reach position n (the vanishing gradient problem that LSTMs partly fixed with gates). Transformers have a constant path length between any two positions and process the whole sequence in parallel during training. The trade is cost: O(n²) attention versus O(n) recurrence, and O(n) state at inference versus O(1). State-space models like Mamba are an attempt to get transformer-quality with recurrent-style linear scaling.',
  compare: { cols: ['RNN / LSTM', 'Transformer'],
    rows: [
      ['Training parallelism', 'none across the sequence', 'full'],
      ['Path between distant tokens', 'O(n) steps', 'O(1)'],
      ['Compute in sequence length', 'linear', 'quadratic'],
      ['Inference state', 'fixed-size hidden state', 'KV cache, grows with length'],
      ['Long-range dependencies', 'degrade', 'direct'],
      ['Why it lost / won', 'could not use GPUs well', 'scales with hardware']
    ] },
  trap: 'The honest nuance: RNNs are not strictly worse. Their O(1) inference state is genuinely attractive, which is why state-space models are an active area. Transformers won because they scale on the hardware we have.',
  tags: ['architecture', 'history'] },

{ id: 'tr26', topic: 'transformers', level: 3,
  q: 'What are Mamba and state-space models, and are they a threat to transformers?',
  lay: 'A different bet: keep a fixed-size running summary as you read, like an RNN, but make it smart enough to decide what to remember and what to drop. The payoff is that cost grows with length instead of squaring with it.',
  tech: 'Structured state-space models maintain a hidden state updated by a linear recurrence, giving O(n) training (via a parallel scan) and O(1) memory per step at inference — no KV cache at all. Mamba added input-dependent (selective) state transitions, which fixed the main quality gap. Where they win: extremely long sequences, streaming, and memory-constrained inference. Where they lag: precise in-context recall — copying an exact string from far back is harder without explicit attention over all positions. Hybrid architectures interleaving a few attention layers with many SSM layers currently look like the practical answer.',
  trap: 'Do not oversell it. As of now transformers remain the default for frontier general-purpose models, and the honest framing — "promising, strong on long sequences, weaker on exact recall, hybrids look most likely" — reads as informed rather than hype-driven.',
  tags: ['architecture', 'mamba'] },

{ id: 'tr27', topic: 'transformers', level: 2,
  q: 'What is an attention sink, and why does it matter for streaming?',
  lay: 'Models develop a habit of dumping spare attention onto the very first token, whatever it is. It acts as a kind of null option. If you slide your context window and accidentally delete that token, quality falls off a cliff for no obvious reason.',
  tech: 'Softmax forces attention weights to sum to 1, so when a head has nothing relevant to attend to it must still put its mass somewhere — empirically it goes to the first few tokens. StreamingLLM (Xiao et al.) showed that a naive sliding window that evicts those initial tokens causes a large perplexity spike, and that permanently keeping ~4 initial tokens as "sinks" alongside the recent window restores performance and enables effectively unbounded streaming.',
  trap: 'Practical relevance: if you implement your own KV-cache eviction for a long-running agent, never evict the first few tokens. It is a two-line rule that prevents a very confusing quality bug.',
  tags: ['attention', 'streaming'] },

{ id: 'tr28', topic: 'transformers', level: 3,
  q: 'What is PagedAttention?',
  lay: 'The server used to reserve room for the longest possible answer for every request, even when the answer turned out to be one sentence. PagedAttention borrows the trick operating systems use for memory: hand out small fixed-size blocks on demand instead of one huge reservation.',
  tech: 'From the vLLM paper. The KV cache is stored in fixed-size blocks (commonly 16 tokens) with a per-sequence block table mapping logical positions to physical blocks, exactly like virtual memory pages. Waste is bounded by one block instead of by max_tokens, so a request generating 40 tokens holds 48 slots rather than 2048. Reported throughput improvement is roughly 2–4×, entirely because larger batches now fit. The second benefit is sharing: blocks can be referenced by multiple sequences with copy-on-write, which gives you shared system-prompt prefixes and cheap parallel sampling.',
  trap: 'Pair it with continuous batching in your answer — they are the two halves of a modern inference server. PagedAttention is the memory manager; continuous batching is the scheduler.',
  tags: ['inference', 'vllm'], orig: 51 },

{ id: 'tr29', topic: 'transformers', level: 2,
  q: 'How do you compute the memory a model needs to serve?',
  lay: 'Three piles: the weights themselves, the memory of the conversation so far, and scratch space. The first is fixed. The second grows with how many people are talking and how long they have been talking — and it is usually the one that runs out.',
  tech: '<b>Weights</b> = parameters × bytes per parameter (2 for fp16, 1 for int8, 0.5 for int4). <b>KV cache</b> = 2 × layers × kv_heads × head_dim × seq_len × batch × 2 bytes. <b>Activations plus framework overhead</b> = a few GB, depending on batch and sequence. Worked example — Llama-3 70B, fp16, 8k context, batch 32: weights ≈ 141 GB; KV cache with GQA (8 KV heads, head_dim 128) ≈ 43 GB; total well over 180 GB, so you need at least three 80 GB cards with tensor parallelism, and realistically four.',
  code: `def serving_memory_gb(params, layers, kv_heads, head_dim,
                      seq, batch, w_bits=16):
    weights = params * (w_bits / 8)
    kv      = 2 * layers * kv_heads * head_dim * seq * batch * 2
    overhead = 4 * 1024**3
    return (weights + kv + overhead) / 1024**3

print(serving_memory_gb(70.6e9, 80, 8, 128, 8192, 32))     # ~188 GB
print(serving_memory_gb(70.6e9, 80, 8, 128, 8192, 32, 4))  # ~82 GB at int4`,
  trap: 'The follow-up is always "what do you cut first?" Usually the KV cache, via shorter context, smaller batch, GQA, or KV quantisation — because weights are a fixed cost and the KV cache is the part that scales with traffic.',
  tags: ['memory', 'serving'], orig: 2 },

{ id: 'tr30', topic: 'transformers', level: 3,
  q: 'Explain tensor, pipeline, data and expert parallelism, and when you use each.',
  lay: 'Four ways to split a job across machines. Tensor: four chefs each cook a quarter of the SAME dish and combine constantly — fast, but they must stand next to each other. Pipeline: an assembly line where each chef owns a few stations — they can be in different buildings. Data: four identical chefs cooking four different orders — more orders per hour, not a faster dish. Expert: eight specialists, and each order goes to the two who know it.',
  tech: 'See the table. The composition rule that matters: put the chattiest split on the fastest wire. A 405B model is typically tensor-parallel 8 within a node (NVLink), pipeline-parallel across nodes (Ethernet/InfiniBand), and data-parallel across the cluster for throughput.',
  compare: { cols: ['Tensor', 'Pipeline', 'Data', 'Expert'],
    rows: [
      ['Splits', 'every weight matrix, within a layer', 'whole layers, across depth', 'the batch — model is replicated', 'the experts of an MoE layer'],
      ['Cuts memory per GPU', 'yes, ~N×', 'yes, ~N×', 'no', 'yes'],
      ['Cuts latency', 'yes', 'no — adds a bubble', 'no', 'no'],
      ['Communication', 'two all-reduces per layer per token', 'one activation per stage', 'gradient all-reduce per step', 'two all-to-alls per MoE layer'],
      ['Needs fast interconnect', 'badly', 'no', 'no', 'yes'],
      ['Sensible degree', '2–8, inside one node', 'as many nodes as needed', 'as many replicas as QPS needs', 'equal to expert count'],
      ['Breaks when', 'you cross a slow link', 'too few micro-batches', 'the model stops fitting', 'one expert gets all traffic']
    ] },
  trap: '"Does data parallelism help a model that does not fit?" No — every replica holds the whole model. Getting this wrong is the classic tell that someone has only read about it.',
  tags: ['parallelism', 'serving'], orig: 2 },

{ id: 'tr31', topic: 'transformers', level: 2,
  q: 'What is continuous batching?',
  lay: 'Old way: fill a minibus, wait for everyone to reach their destination, then take the next group — so one long journey holds seven short ones hostage. New way: as soon as someone gets off, the next person gets on, at every stop.',
  tech: 'Also called in-flight or iteration-level batching. Instead of running a fixed batch to completion, the scheduler evaluates the batch at every decode step: finished sequences are evicted and queued requests admitted immediately. This raises GPU utilisation dramatically when output lengths vary, which they always do. Combined with PagedAttention (which makes admitting a new sequence cheap in memory terms) it is the core of vLLM, TGI and TensorRT-LLM.',
  trap: 'The trade-off worth naming: larger batches raise throughput and can raise per-request latency, especially TTFT, because a new request may wait for a scheduling slot. Serving is a throughput/latency dial, not a free win, and chunked prefill exists precisely to stop long prefills stalling ongoing decodes.',
  tags: ['inference', 'batching'], orig: 25 },

{ id: 'tr32', topic: 'transformers', level: 2,
  q: 'What actually happens, end to end, when you send a prompt to an LLM API?',
  lay: 'Your text is chopped into chunks, the chunks become numbers, the numbers flow through the stack once to digest your question, then the model writes one word at a time, each word going through the whole stack again, until it decides to stop or hits your limit.',
  tech: '<ol><li>Text → tokens via the tokenizer; the chat template inserts role delimiters.</li><li>Request queued at the inference server; scheduler admits it into a batch.</li><li><b>Prefill</b>: one forward pass over all prompt tokens, populating the KV cache. If a prefix cache hits, this is largely skipped.</li><li>Sample the first token from the final position\'s logits after temperature / top-k / top-p and penalties.</li><li><b>Decode</b>: repeat one forward pass per token, appending to the KV cache each time.</li><li>Stop on a stop sequence, an end-of-sequence token, or max_tokens.</li><li>Detokenise and stream back; usage is metered on input and output tokens.</li></ol>',
  dgm: { nodes: ['tokenize', 'queue', { t: 'prefill', s: 'compute-bound' }, { t: 'decode ×n', s: 'memory-bound', k: 'alt' }, 'stop check', 'detokenize'],
    cap: 'Everything before the first sampled token is TTFT; everything after it is throughput.' },
  trap: 'Mention the queue. In production, queueing delay under load is frequently a larger share of p95 latency than the model itself, and it is invisible in a local benchmark.',
  tags: ['inference', 'pipeline'] },

{ id: 'tr33', topic: 'transformers', level: 3,
  q: 'What is the difference between weight quantisation and KV cache quantisation?',
  lay: 'One shrinks the model. The other shrinks the conversation memory. They solve different problems: the first lets a bigger model fit on your card; the second lets more people talk to it at once.',
  tech: 'Weight quantisation (GPTQ, AWQ, NF4) reduces the parameter storage, shrinking the fixed cost and — if the kernels support low-precision matmul — speeding up the memory-bound decode step. KV cache quantisation (typically fp8 or int8 per-head) reduces the per-token, per-request memory, which directly raises the maximum batch size and therefore throughput. They compose. Quality impact differs: weights tolerate int4 reasonably; KV caches are more sensitive, and int4 KV is noticeably lossy on long contexts, so fp8 is the common choice.',
  trap: '"Which do I do first?" Weights, if the model does not fit. KV, if the model fits but your batch size is small and utilisation is poor. Diagnose which resource you are actually out of before quantising anything.',
  tags: ['quantisation', 'kv-cache'], orig: 51 },

{ id: 'tr34', topic: 'transformers', level: 2,
  q: 'Why does the model sometimes repeat itself in a loop?',
  lay: 'Once it says a phrase, that phrase is now in the context, which makes the same phrase slightly more likely next time, which makes it more likely again. Low randomness plus a self-reinforcing pattern equals a stuck record.',
  tech: 'Degenerate repetition arises from the interaction of maximum-likelihood training and low-entropy decoding: greedy or very low-temperature decoding follows a self-reinforcing high-probability loop. Mitigations: raise temperature or top-p, apply a modest frequency/presence penalty (0.1–0.5), use a no-repeat-ngram constraint, add a stop sequence, and cap max_tokens. In agent loops the equivalent failure is calling the same tool with the same arguments repeatedly — detect that explicitly and break out.',
  trap: 'Do not reach for the repetition penalty on structured output. JSON and code legitimately repeat tokens, and penalising them produces unparseable output. Fix loops there with constrained decoding and stop sequences instead.',
  tags: ['decoding', 'failure'], orig: 8 },

{ id: 'tr35', topic: 'transformers', level: 3,
  q: 'How would you explain attention to someone with no maths background, and then formalise it?',
  lay: 'Imagine a room where each person holds up a card describing what they are looking for, and everyone else holds up a card describing what they can offer. You compare your card against everyone else\'s, decide who is most relevant, and take a weighted blend of what those people tell you. Do that for everyone at once, and that is attention.',
  tech: 'Formally: given input X ∈ ℝ^{n×d}, compute Q = XW_Q, K = XW_K, V = XW_V. The output is <span class="mono">softmax(QKᵀ / √d_k + M)V</span>, where M is the causal mask with 0 on and below the diagonal and −∞ above. Multi-head repeats this h times on d/h-dimensional subspaces and concatenates, followed by W_O. Complexity O(n²d) time, O(n²) attention memory (O(n) with FlashAttention).',
  trap: 'Interviewers use this to check whether you can teach. Get to the intuition in two sentences and only then reach for symbols — leading with the formula reads as memorisation.',
  tags: ['attention', 'communication'], orig: 3 },

{ id: 'tr36', topic: 'transformers', level: 3,
  q: 'If you removed the feed-forward layers entirely, what would the model still be able to do?',
  lay: 'It would still be brilliant at working out which words relate to which other words, and completely empty of things to say about them. It could route information perfectly and know nothing.',
  tech: 'Attention would still perform token mixing, so copying, positional patterns and induction-style in-context completion would partially survive. What disappears is stored knowledge: the FFN sublayers are where factual associations live, and they hold roughly two thirds of the parameters. Empirically, models with the FFN ablated collapse to something close to a weighted-average-of-context predictor. You can demonstrate this on a toy model: with the FFN off, a prompt like "the cat sat" predicts another animate noun (it echoes what it attended to); with the FFN on, a neuron detecting "animate + action" fires and pushes probability toward a location word.',
  trap: 'This is a comprehension check dressed as a hypothetical. The right answer names the division of labour — routing versus knowledge — and gives one concrete consequence.',
  tags: ['ffn', 'interpretability'], orig: 3,
  xref: [['See the feed-forward switched off, live', '../genai_flow/index.html']] }

]);
