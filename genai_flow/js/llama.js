/* ============================================================
   llama.js — "Reading print(model)": Llama 3.2 3B, line by line.

   Self-mounting widgets, all driven by one config object so the
   printout, the diagram, the parameter table and the calculators
   can never disagree with each other:

     #ll-print    the printout, every line clickable
     #ll-arch     the same model drawn, boxes synced to the printout
     #ll-detail   what the selected module does, in full
     #ll-shapes   one tensor followed through the network
     #ll-params   where the 3.21 billion parameters live, and the
                  memory they cost at each precision
     #ll-gqa      MHA vs GQA vs MQA, with the KV cache they imply
     #ll-lora     where LoRA attaches, and how many weights it trains
     #ll-myths    things people say about this printout that are wrong

   test.js loads this file and re-derives every number.
   ============================================================ */
(function () {
'use strict';

/* ---------- the config the printout implies ----------
   Everything below is derived from these numbers. They are the real
   Llama 3.2 3B values (config.json on the model card).              */
const CFG = {
  name: 'Llama 3.2 3B',
  vocab: 128256,        /* 128,000 BPE tokens + 256 reserved special tokens */
  d: 3072,              /* hidden size — the width of the residual stream   */
  layers: 28,
  heads: 24,            /* query heads                                      */
  kvHeads: 8,           /* key/value heads — grouped-query attention        */
  headDim: 128,         /* 3072 / 24                                        */
  ffn: 8192,            /* intermediate size — exactly 8/3 x 3072           */
  eps: 1e-5,
  ropeTheta: 500000,
  maxPos: 131072,
  tied: true            /* lm_head shares its weight with embed_tokens      */
};

/* ---------- parameter arithmetic ---------- */
function count(c) {
  const d = c.d, kv = c.kvHeads * c.headDim;
  const q = d * c.heads * c.headDim, k = d * kv, v = d * kv, o = c.heads * c.headDim * d;
  const gate = d * c.ffn, up = d * c.ffn, down = c.ffn * d;
  const ln = d;
  const attn = q + k + v + o, mlp = gate + up + down, norms = 2 * ln;
  const layer = attn + mlp + norms;
  const embed = c.vocab * d, head = d * c.vocab, finalNorm = d;
  const total = embed + c.layers * layer + finalNorm + (c.tied ? 0 : head);
  return { q, k, v, o, gate, up, down, ln, attn, mlp, norms, layer, embed, head, finalNorm, total };
}

/* bytes per parameter at each precision people actually load in */
const DTYPES = [
  { id: 'fp32', n: 'float32', b: 4,   note: 'The default if you call from_pretrained without torch_dtype. This is the 12.9 GB in the notebook.' },
  { id: 'bf16', n: 'bfloat16', b: 2,  note: 'What the weights were trained and shipped in. Pass torch_dtype=torch.bfloat16 and the footprint halves with no quality loss.' },
  { id: 'int8', n: 'int8', b: 1,      note: 'bitsandbytes load_in_8bit. Small quality cost, noticeably slower matmuls on most GPUs.' },
  { id: 'nf4',  n: '4-bit NF4', b: 0.5, note: 'QLoRA territory. Fits a free Colab T4 with room for activations. Quality cost is real but usually acceptable for fine-tuning.' }
];

/* KV cache bytes for ONE token: K and V, every layer, every KV head */
const kvPerToken = (c, kvHeads, bytes) => 2 * c.layers * kvHeads * c.headDim * bytes;

/* LoRA adds A (r x in) and B (out x r) beside a frozen Linear: r*(in+out) */
function loraCount(c, r, targets) {
  const kv = c.kvHeads * c.headDim, qd = c.heads * c.headDim;
  const dims = { q_proj: [c.d, qd], k_proj: [c.d, kv], v_proj: [c.d, kv], o_proj: [qd, c.d],
                 gate_proj: [c.d, c.ffn], up_proj: [c.d, c.ffn], down_proj: [c.ffn, c.d] };
  return c.layers * targets.reduce((s, t) => s + r * (dims[t][0] + dims[t][1]), 0);
}

/* ---------- the printout, generated from CFG ----------
   Each line: [text, module id or null, indent]. The text is what
   print(model) shows with a recent transformers release.            */
function printout(c) {
  const lin = (i, o) => 'Linear(in_features=' + i + ', out_features=' + o + ', bias=False)';
  const kv = c.kvHeads * c.headDim, qd = c.heads * c.headDim;
  const norm = 'LlamaRMSNorm((' + c.d + ',), eps=' + c.eps.toExponential().replace('e-', 'e-0') + ')';
  return [
    ['LlamaForCausalLM(', 'causallm', 0],
    ['(model): LlamaModel(', 'model', 1],
    ['(embed_tokens): Embedding(' + c.vocab + ', ' + c.d + ')', 'embed', 2],
    ['(layers): ModuleList(', 'layers', 2],
    ['(0-' + (c.layers - 1) + '): ' + c.layers + ' x LlamaDecoderLayer(', 'layer', 3],
    ['(self_attn): LlamaAttention(', 'attn', 4],
    ['(q_proj): ' + lin(c.d, qd), 'q', 5],
    ['(k_proj): ' + lin(c.d, kv), 'k', 5],
    ['(v_proj): ' + lin(c.d, kv), 'v', 5],
    ['(o_proj): ' + lin(qd, c.d), 'o', 5],
    [')', null, 4],
    ['(mlp): LlamaMLP(', 'mlp', 4],
    ['(gate_proj): ' + lin(c.d, c.ffn), 'gate', 5],
    ['(up_proj): ' + lin(c.d, c.ffn), 'up', 5],
    ['(down_proj): ' + lin(c.ffn, c.d), 'down', 5],
    ['(act_fn): SiLUActivation()', 'act', 5],
    [')', null, 4],
    ['(input_layernorm): ' + norm, 'ln1', 4],
    ['(post_attention_layernorm): ' + norm, 'ln2', 4],
    [')', null, 3],
    [')', null, 2],
    ['(norm): ' + norm, 'norm', 2],
    ['(rotary_emb): LlamaRotaryEmbedding()', 'rope', 2],
    [')', null, 1],
    ['(lm_head): ' + lin(c.d, c.vocab), 'head', 1],
    [')', null, 0]
  ];
}

/* The printout is a table of contents, not a flowchart. This is the
   order things actually RUN in one forward pass.                    */
const RUN = { embed: 1, rope: 2, ln1: 3, q: 4, k: 4, v: 4, attn: 5, o: 6, ln2: 7,
              gate: 8, up: 8, act: 9, down: 10, norm: 11, head: 12 };

/* ---------- every module, explained ----------
   p: a key into count() for the parameter figure (per layer where it
   is inside the decoder layer). c: colour family for the diagram.   */
const G = { io: '#f472b6', attn: '#7c5cff', mlp: '#fbbf24', norm: '#22d3ee', pos: '#34d399', box: '#94a3b8' };

const M = {
  causallm: { t: 'LlamaForCausalLM', c: G.box, p: 'total',
    lay: 'The whole thing: a language model plus the one extra layer that turns its final thoughts into a guess about the next word.',
    what: 'The top-level wrapper Hugging Face returns from <span class="mono">AutoModelForCausalLM</span>. It owns two children: <span class="mono">model</span> (the transformer body, which produces a 3072-number vector per token) and <span class="mono">lm_head</span> (the projection from that vector to a score for every token in the vocabulary). Its <span class="mono">forward()</span> also computes the shifted cross-entropy loss when you pass <span class="mono">labels</span>, and it is what <span class="mono">.generate()</span> is called on.',
    shape: 'input_ids [B, T] &rarr; logits [B, T, ' + CFG.vocab + ']',
    formula: 'logits = lm_head( model(input_ids) )',
    why: '"CausalLM" means decoder-only, left-to-right: every position can only see itself and earlier positions. The same body with a different head would be <span class="mono">LlamaForSequenceClassification</span> &mdash; the split between body and head is why you can swap tasks without retraining the body.',
    trap: 'Passing <span class="mono">labels=input_ids</span> is correct: the class shifts them by one internally. Shifting them yourself as well is a classic bug that trains the model to predict two tokens ahead.' },

  model: { t: 'LlamaModel', c: G.box, p: null,
    lay: 'The body of the model: turn words into numbers, pass them through 28 identical processing stages, tidy the result up. Everything except the final guess.',
    what: 'Embedding &rarr; 28 decoder layers &rarr; final RMSNorm. Output is <span class="mono">last_hidden_state</span>, one 3072-vector per token. This is what you take if you want embeddings rather than text, and what <span class="mono">AutoModel</span> (no <i>ForCausalLM</i>) returns. It also computes the RoPE cos/sin tables once per forward and hands them to every layer, and builds the causal mask.',
    shape: '[B, T] &rarr; [B, T, ' + CFG.d + ']',
    formula: 'h&#8320; = E[ids];  h&#8343;&#8330;&#8321; = Layer&#8343;(h&#8343;);  out = RMSNorm(h&#8322;&#8328;)',
    why: 'Keeping the body separate from the head lets one set of weights serve generation, classification and embedding. It is also where the KV cache lives during generation: <span class="mono">past_key_values</span> is threaded through here into every layer.',
    trap: 'Its output is already normalised by the final <span class="mono">norm</span>. If you take <span class="mono">hidden_states[-1]</span> from <span class="mono">output_hidden_states=True</span> you get the same thing; <span class="mono">hidden_states[-2]</span> is <i>not</i> normalised.' },

  embed: { t: 'embed_tokens · Embedding(' + CFG.vocab + ', ' + CFG.d + ')', c: G.io, p: 'embed',
    lay: 'A giant lookup table with one row per word-piece the model knows &mdash; 128,256 rows, each a list of 3,072 numbers. The token id is just a row number. Look it up, and that row is how the model first "sees" the word.',
    what: 'A learned matrix <span class="mono">E &isin; &#8477;<sup>128256 &times; 3072</sup></span>. The forward pass is an index, not a multiplication: <span class="mono">E[input_ids]</span>. Mathematically it equals a one-hot vector times E, but a gather is O(T&middot;d) instead of O(T&middot;V&middot;d). 128,256 = 128,000 tiktoken-style BPE tokens + 256 reserved special tokens (<span class="mono">&lt;|begin_of_text|&gt;</span>, <span class="mono">&lt;|eot_id|&gt;</span>, <span class="mono">&lt;|start_header_id|&gt;</span> and many unused slots).',
    shape: 'input_ids [B, T] (int64) &rarr; [B, T, 3072]',
    formula: 'h&#8320;[b, t] = E[ input_ids[b, t] ]',
    why: 'A 128k vocabulary (up from 32k in Llama 2) compresses text into about 15% fewer tokens, which means cheaper, faster inference and more text per context window &mdash; paid for with a bigger table. Here the table is <b>394 million parameters, 12% of the model</b>, which is enormous for a 3B model and is exactly why it is shared with <span class="mono">lm_head</span>.',
    trap: 'Note what is <i>not</i> added here: no position embedding. Llama gets word order from RoPE inside attention. "Embeddings plus positional encoding" is the GPT-2 answer and is wrong for this model. Also: if you add tokens to the tokenizer, you must <span class="mono">resize_token_embeddings()</span> or new ids index past the end of E.' },

  layers: { t: 'layers · ModuleList', c: G.box, p: null,
    lay: 'A plain list holding the 28 processing stages, in order. It does no work itself &mdash; it is a shelf.',
    what: 'A <span class="mono">torch.nn.ModuleList</span>: a Python list that registers its children as submodules so their parameters are found by <span class="mono">.parameters()</span>, moved by <span class="mono">.to()</span> and saved by <span class="mono">state_dict()</span>. <span class="mono">LlamaModel.forward</span> loops over it. The printout collapses 28 identical children into <span class="mono">(0-27): 28 x</span> because their reprs are identical &mdash; the <i>weights</i> are all different.',
    shape: 'n/a &mdash; a container',
    formula: 'for layer in self.layers: h = layer(h, ...)',
    why: 'A ModuleList rather than nn.Sequential because each layer needs extra arguments (position embeddings, mask, cache) that Sequential cannot pass. Indexing it is how you do surgery: <span class="mono">model.model.layers[:20]</span> for layer pruning, <span class="mono">layers[i].register_forward_hook</span> for probing, and freezing the first N layers for cheap fine-tuning.',
    trap: '"28 x" does not mean the layers share weights. Each holds its own ~100.7M parameters. (Weight-shared layers are a real idea &mdash; ALBERT does it &mdash; but Llama does not.)' },

  layer: { t: 'LlamaDecoderLayer × ' + CFG.layers, c: G.box, p: 'layer',
    lay: 'One stage of thinking, repeated 28 times. Each stage does two things: every word looks at the earlier words and borrows what is relevant (attention), then every word privately looks up what it knows about what it just learned (the MLP). Both results are <i>added</i> onto what the word already had, never overwritten.',
    what: 'A pre-norm residual block with two sublayers:<br><span class="mono">h = h + self_attn( input_layernorm(h) )</span><br><span class="mono">h = h + mlp( post_attention_layernorm(h) )</span><br>The <span class="mono">h</span> that flows straight through is the <b>residual stream</b>. Each sublayer reads a normalised copy of it and writes a correction back. 100,669,440 parameters per layer: 25% attention, 75% MLP, 0.006% norms.',
    shape: '[B, T, 3072] &rarr; [B, T, 3072]  (same in, same out &mdash; that is what makes them stackable)',
    formula: 'h&prime; = h + Attn(RMSNorm&#8321;(h));   h&Prime; = h&prime; + MLP(RMSNorm&#8322;(h&prime;))',
    why: '<b>Pre-norm</b> (normalise <i>inside</i> the branch) keeps an un-normalised identity path from input to output, so gradients reach layer 0 intact and deep stacks train stably without warm-up tricks. The original 2017 transformer was post-norm and needed careful learning-rate warm-up to not diverge.',
    trap: 'The printout lists the norms <i>last</i> but they run <i>first</i> in each half. Registration order in <span class="mono">__init__</span> is not execution order &mdash; read <span class="mono">forward()</span> for that. Toggle "execution order" above to see the real sequence.' },

  attn: { t: 'self_attn · LlamaAttention', c: G.attn, p: 'attn',
    lay: 'The only place where words talk to each other. Each word writes a question ("what am I looking for?"), every earlier word holds up a label ("what do I contain?") and a message. Each word reads the messages of the words whose labels best match its question.',
    what: 'Grouped-query causal self-attention. Project to Q (24 heads &times; 128), K and V (8 heads &times; 128 each). Rotate Q and K with RoPE. Each K/V head is shared by 3 query heads. Compute <span class="mono">softmax(QK&#7488;/&radic;128 + mask)&middot;V</span> per head &mdash; via <span class="mono">scaled_dot_product_attention</span> (FlashAttention / memory-efficient kernels), which is why the core has no module of its own in the printout. Concatenate the 24 heads back to 3072 and project with <span class="mono">o_proj</span>.',
    shape: '[B, T, 3072] &rarr; Q [B, 24, T, 128], K/V [B, 8, T, 128] &rarr; scores [B, 24, T, T] &rarr; [B, T, 3072]',
    formula: 'Attn(x) = W&#8338; &middot; concat&#8341;[ softmax( RoPE(q&#8341;)&middot;RoPE(k&#8339;&#8333;&#8341;&#8334;)&#7488; / &radic;128 + M ) &middot; v&#8339;&#8333;&#8341;&#8334; ],  g(h) = &lfloor;h/3&rfloor;',
    why: 'GQA with 8 KV heads cuts the KV cache 3&times; versus full multi-head attention (24 KV heads) at almost no quality cost. At a 128k context that is the difference between ~15 GB and ~45 GB of cache per sequence. No biases anywhere (<span class="mono">bias=False</span>): they add parameters and, with RMSNorm, buy nothing.',
    trap: 'It is the only sublayer whose cost grows with T&sup2; (the score matrix), and it only holds 22% of the model\'s parameters. "Most of a transformer is attention" is wrong by parameter count and right by long-context compute.' },

  q: { t: 'q_proj · Linear(3072 → 3072)', c: G.attn, p: 'q',
    lay: 'Turns each word into its question: "given what I am, what should I be looking for in the earlier words?"',
    what: 'A bias-free linear map <span class="mono">W_q &isin; &#8477;<sup>3072&times;3072</sup></span>. The 3072 outputs are reshaped to <b>24 heads &times; 128 dims</b>: each head gets its own 128-dimensional query and asks a different kind of question (previous token, subject of the verb, matching bracket&hellip;). RoPE then rotates each 128-vector by an angle that depends on the token\'s position.',
    shape: '[B, T, 3072] &rarr; [B, T, 3072] &rarr; view &rarr; [B, T, 24, 128] &rarr; transpose &rarr; [B, 24, T, 128]',
    formula: 'Q = x W_q&#7488;,   q&#8341; = Q[:, :, 128h : 128(h+1)]',
    why: 'Queries are needed only for the token being processed, so they are <i>never cached</i>. That is why GQA shrinks K and V but leaves Q at full width: Q costs compute, not memory.',
    trap: 'Why 3072 = 24&times;128 rather than, say, 12&times;256? Head dim 128 is the sweet spot for GPU attention kernels and for RoPE frequency coverage; more heads means more distinct attention patterns for the same parameter budget.' },

  k: { t: 'k_proj · Linear(3072 → 1024)', c: G.attn, p: 'k',
    lay: 'Turns each word into a label saying what it contains, so questions can find it. There are fewer labels than questions: three questions share each label.',
    what: 'A bias-free linear map to <b>1024 = 8 KV heads &times; 128</b>. This is grouped-query attention made visible: 24 query heads, 8 key heads, so query heads 0-2 share key head 0, 3-5 share key head 1, and so on. RoPE rotates keys exactly as it rotates queries, so the dot product q&middot;k depends only on the <i>distance</i> between the two tokens. During generation every key is written into the KV cache.',
    shape: '[B, T, 3072] &rarr; [B, T, 1024] &rarr; [B, 8, T, 128] &rarr; (repeat_kv &times;3) &rarr; [B, 24, T, 128]',
    formula: 'K = x W_k&#7488;,   W_k &isin; &#8477;<sup>1024&times;3072</sup>',
    why: 'This row is why the model is cheap to serve. With full MHA, k_proj would be 3072 wide and the KV cache three times bigger; that memory, not the weights, is what caps your batch size and context length on a GPU.',
    trap: '<span class="mono">repeat_kv</span> in the eager implementation literally copies each KV head three times before the matmul. That is a <i>compute</i> view; the <i>cache</i> still stores only 8 heads. Fused kernels skip the copy entirely.' },

  v: { t: 'v_proj · Linear(3072 → 1024)', c: G.attn, p: 'v',
    lay: 'Turns each word into the message it hands over if someone\'s question picks it. The label decides <i>who</i> gets read; this decides <i>what</i> they get.',
    what: 'Same shape as k_proj: <b>8 KV heads &times; 128</b>, shared by groups of 3 query heads. The attention weights (from Q&middot;K) take a weighted average of these value vectors. Values are <i>not</i> rotated by RoPE &mdash; position only affects who attends to whom, not what is carried.',
    shape: '[B, T, 3072] &rarr; [B, T, 1024] &rarr; [B, 8, T, 128]',
    formula: 'V = x W_v&#7488;,   out&#8341; = softmax(&hellip;) &middot; v&#8339;&#8333;&#8341;&#8334;',
    why: 'Keys and values are separate so that "what makes me relevant" and "what I say when chosen" can differ. A pronoun\'s key can say "I am a pronoun" while its value carries "the thing I refer to".',
    trap: 'LoRA on only <span class="mono">q_proj, v_proj</span> (the old default from the LoRA paper) works, but targeting all seven linears in the layer consistently fine-tunes better. See the LoRA calculator below.' },

  o: { t: 'o_proj · Linear(3072 → 3072)', c: G.attn, p: 'o',
    lay: 'The 24 heads each came back with their own findings. This mixes those 24 reports into one update and hands it back to the main stream.',
    what: 'Concatenate the 24 head outputs (24 &times; 128 = 3072) and apply <span class="mono">W_o &isin; &#8477;<sup>3072&times;3072</sup></span>. Without it, head h could only ever write into dimensions 128h&hellip;128h+127 of the stream; o_proj lets every head write anywhere. Its output is added to the residual stream.',
    shape: '[B, 24, T, 128] &rarr; transpose/reshape &rarr; [B, T, 3072] &rarr; [B, T, 3072]',
    formula: 'Attn(x) = concat(head&#8320; &hellip; head&#8322;&#8323;) W_o&#7488;',
    why: 'Equivalent to each head having its own 128&rarr;3072 output matrix and summing the results. That view is how interpretability work attributes a model\'s behaviour to individual heads.',
    trap: 'It is the <i>output</i> of attention, so it is where the residual add happens next, not before. In the diagram the &oplus; sits right after it.' },

  mlp: { t: 'mlp · LlamaMLP (SwiGLU)', c: G.mlp, p: 'mlp',
    lay: 'The model\'s memory. Each word, on its own and without looking at the others, is checked against 8,192 learned patterns; the patterns that fire add what they "know" back onto the word. Most facts the model has live here.',
    what: 'A gated feed-forward network (SwiGLU): <span class="mono">down( SiLU(gate(x)) &odot; up(x) )</span>. Two parallel projections up to 8192, one of them passed through SiLU and used as a soft on/off switch for the other, then one projection back to 3072. Runs independently at every position &mdash; no information crosses between tokens here. <b>75,497,472 parameters per layer, 75% of each layer, 66% of the whole model.</b>',
    shape: '[B, T, 3072] &rarr; 2&times; [B, T, 8192] &rarr; [B, T, 8192] &rarr; [B, T, 3072]',
    formula: 'MLP(x) = W_down ( SiLU(W_gate x) &odot; W_up x )',
    why: 'SwiGLU beats a plain ReLU/GELU MLP at equal parameter count. Because it needs three matrices instead of two, the hidden size is cut from 4d to (8/3)d to keep the budget the same &mdash; and 8/3 &times; 3072 is <b>exactly 8192</b>.',
    trap: 'If someone says attention is where the knowledge is: here, attention is 25M parameters per layer and the MLP is 75.5M. With GQA shrinking K and V, the MLP share is even higher than the "two thirds" usually quoted.' },

  gate: { t: 'gate_proj · Linear(3072 → 8192)', c: G.mlp, p: 'gate',
    lay: 'Decides how much each of the 8,192 memory slots should open for this word. It is the dimmer switch.',
    what: 'Projects to 8192 and feeds <span class="mono">act_fn</span> (SiLU). The result multiplies <span class="mono">up_proj</span>\'s output element-wise, so a gate value near 0 silences that hidden unit and a large value passes it through amplified. The gate is <i>input-dependent</i>: which units open depends on the token and its context.',
    shape: '[B, T, 3072] &rarr; [B, T, 8192]',
    formula: 'g = SiLU(x W_gate&#7488;)',
    why: 'Gating lets the network represent multiplicative interactions ("fire only when feature A <i>and</i> feature B") that a single activation cannot express as cheaply.',
    trap: 'SiLU is applied to gate only &mdash; never to up. Swapping them in a reimplementation silently loads the weights and produces garbage text.' },

  up: { t: 'up_proj · Linear(3072 → 8192)', c: G.mlp, p: 'up',
    lay: 'Expands the word into 8,192 candidate "facts I might add". The gate then decides which of them actually get through.',
    what: 'Projects to the same 8192-wide hidden space as gate_proj, with no activation. Its output is the content being gated. Interpretability work reads each row of up/gate as a pattern detector and each column of down_proj as the vector written when that detector fires.',
    shape: '[B, T, 3072] &rarr; [B, T, 8192]',
    formula: 'u = x W_up&#7488;;   hidden = g &odot; u',
    why: 'A linear "value" path next to a non-linear "gate" path is the GLU family\'s signature, and it trains more smoothly than squashing everything through one non-linearity.',
    trap: 'gate_proj and up_proj are often fused into one 3072&rarr;16384 matmul in fast inference engines (vLLM, llama.cpp). That is why converted checkpoints sometimes have a <span class="mono">gate_up_proj</span> tensor you will not find here.' },

  down: { t: 'down_proj · Linear(8192 → 3072)', c: G.mlp, p: 'down',
    lay: 'Squeezes the 8,192 opened memory slots back into a normal-sized note and adds it onto the word.',
    what: 'Projects the gated 8192-vector back to model width, <span class="mono">W_down &isin; &#8477;<sup>3072&times;8192</sup></span>, and the result is added to the residual stream. Each of its 8192 columns is a direction in the stream that gets written, scaled by how strongly its hidden unit fired.',
    shape: '[B, T, 8192] &rarr; [B, T, 3072]',
    formula: 'MLP(x) = (g &odot; u) W_down&#7488;',
    why: 'The only matrix in the layer whose <i>input</i> is 8192 wide, which makes it the most sensitive to quantisation outliers. Many quantisation schemes keep extra precision here for that reason.',
    trap: 'In the printout it appears before <span class="mono">act_fn</span>, but it runs <i>after</i> it. The printout order is just the order the attributes were assigned in <span class="mono">__init__</span>.' },

  act: { t: 'act_fn · SiLU', c: G.mlp, p: null,
    lay: 'A smooth "mostly let positives through, mostly block negatives" filter applied to the gate. Without it the whole MLP would collapse into one big straight-line multiplication and learn nothing new.',
    what: '<span class="mono">SiLU(x) = x &middot; &sigma;(x)</span>, also called Swish. Near 0 for large negative x, near x for large positive x, smooth everywhere, and slightly negative around x &asymp; &minus;1.28 (minimum &asymp; &minus;0.278). No parameters. Applied only to the gate branch. Older transformers versions print it as <span class="mono">SiLU()</span>; same function.',
    shape: '[B, T, 8192] &rarr; [B, T, 8192]  (element-wise)',
    formula: 'SiLU(x) = x / (1 + e<sup>&minus;x</sup>)',
    why: 'Smooth gradients everywhere (ReLU has a kink and a dead zone), and in the SwiGLU arrangement it outperformed GELU and ReLU gates in the PaLM/Llama ablations.',
    trap: 'A non-linearity is not decoration: stacking linear layers without one is still one linear layer. This single line is what lets 28 layers be more expressive than one.' },

  ln1: { t: 'input_layernorm · RMSNorm(3072)', c: G.norm, p: 'ln',
    lay: 'Before attention reads a word, this rescales its 3,072 numbers so they are a sensible size. It stops some words shouting and others whispering, then applies a learned per-dimension volume knob.',
    what: '<span class="mono">RMSNorm(x) = x / &radic;(mean(x&sup2;) + &epsilon;) &odot; w</span>, &epsilon; = 1e-5, <span class="mono">w &isin; &#8477;<sup>3072</sup></span> learned. Per token, across the 3072 features; no information moves between tokens. Computed in float32 internally even when the model is in bf16, because squaring small numbers in bf16 underflows. It normalises a <i>copy</i> fed into attention; the residual stream itself is left unnormalised.',
    shape: '[B, T, 3072] &rarr; [B, T, 3072]',
    formula: 'y = w &odot; x / &radic;( (1/3072)&Sigma;x&#7522;&sup2; + 10&#8315;&#8309; )',
    why: 'RMSNorm drops LayerNorm\'s mean subtraction and bias. It is cheaper (one reduction instead of two) and empirically just as good: the re-centring turned out not to matter, the re-scaling does.',
    trap: '&epsilon; is not cosmetic. An all-zero vector (padding, a dead feature) would divide by zero without it; too large an &epsilon; and small activations are squashed. Mismatched &epsilon; between training and inference code is a real source of subtle output drift.' },

  ln2: { t: 'post_attention_layernorm · RMSNorm(3072)', c: G.norm, p: 'ln',
    lay: 'Same volume-levelling as the first one, applied again before the memory lookup, because attention just changed the word\'s numbers.',
    what: 'Identical operation to <span class="mono">input_layernorm</span>, with its own 3072 learned weights. Despite the name it is a <b>pre</b>-norm for the MLP: it runs <i>after</i> the attention residual add and <i>before</i> the MLP.',
    shape: '[B, T, 3072] &rarr; [B, T, 3072]',
    formula: 'MLP input = RMSNorm&#8322;( h + Attn(RMSNorm&#8321;(h)) )',
    why: 'Each sublayer gets inputs at a predictable scale no matter how large the residual stream has grown after many layers of additions. That is what keeps 28 layers of "add a correction" numerically stable.',
    trap: 'The name "post_attention" makes people draw it as post-norm. It is not: the residual stream bypasses it. A post-norm model would normalise the stream itself after the add.' },

  norm: { t: 'norm · RMSNorm(3072) — final', c: G.norm, p: 'finalNorm',
    lay: 'One last volume-levelling of each word\'s numbers after all 28 stages, so the final guessing layer gets inputs of a consistent size.',
    what: 'A single RMSNorm applied to the residual stream after the last decoder layer. Needed <i>because</i> of pre-norm: every sublayer normalised only its own input, so the stream itself has been accumulating un-normalised additions for 28 layers and can be large. This is the only place the stream itself is normalised.',
    shape: '[B, T, 3072] &rarr; [B, T, 3072]',
    formula: 'out = w_f &odot; h&#8322;&#8328; / &radic;(mean(h&#8322;&#8328;&sup2;) + &epsilon;)',
    why: 'Pre-norm plus a final norm is the standard pairing: stable gradients through the identity path, and a well-scaled input to the head. Drop it and the logits\' scale depends on depth.',
    trap: 'Its 3072 parameters are the smallest named module in the model. It is listed at model level, not inside a layer &mdash; it runs once, not 28 times.' },

  rope: { t: 'rotary_emb · LlamaRotaryEmbedding', c: G.pos, p: null,
    lay: 'How the model knows word order. Instead of stamping a position number onto each word, it rotates each word\'s question and label by an angle that depends on where the word sits. Two words\' match then depends on how far apart they are, not on where in the text they are.',
    what: 'Computes <span class="mono">cos</span> and <span class="mono">sin</span> tables for the current positions, once per forward pass, and passes them to every attention layer, where q and k are rotated pairwise: each 128-dim head vector is 64 pairs, pair i rotated by angle <span class="mono">pos &middot; &theta;<sup>&minus;2i/128</sup></span> with <b>&theta; = 500,000</b>. No trainable parameters &mdash; only a non-persistent <span class="mono">inv_freq</span> buffer. Llama 3.x also applies "llama3" frequency scaling (factor 32 over an 8,192 original window) so it works to 131,072 tokens.',
    shape: 'position_ids [B, T] &rarr; (cos, sin) each [B, T, 128]',
    formula: 'RoPE(x, m)&#8322;&#7522;,&#8322;&#7522;&#8330;&#8321; = R(m&middot;&omega;&#7522;) [x&#8322;&#7522;, x&#8322;&#7522;&#8330;&#8321;],   &omega;&#7522; = &theta;<sup>&minus;2i/128</sup>',
    why: 'Because R(m&omega;)&#7488;R(n&omega;) = R((n&minus;m)&omega;), the attention score depends only on the relative offset n&minus;m. No parameters, no maximum-length table, and the frequencies can be rescaled after training to extend context. A large &theta; stretches the slowest frequencies so far-apart tokens stay distinguishable at long context.',
    trap: 'It is printed last, at model level, and looks like a leftover. It is used in <i>every</i> layer on every forward pass. And it touches only Q and K &mdash; never V, never the embeddings.' },

  head: { t: 'lm_head · Linear(3072 → ' + CFG.vocab + ')', c: G.io, p: 'head',
    lay: 'The final guess. It compares the model\'s last thought against every one of the 128,256 word-pieces it knows and gives each a score. The highest-scoring piece is the most likely next word.',
    what: 'A bias-free projection <span class="mono">W &isin; &#8477;<sup>128256&times;3072</sup></span> producing one logit per vocabulary entry per position. Softmax turns the logits into probabilities; the sampler (temperature, top-p&hellip;) picks a token. <b>In Llama 3.2 1B and 3B this weight is tied to <span class="mono">embed_tokens</span></b> (<span class="mono">tie_word_embeddings: true</span>): the same 394M-parameter matrix, used once as a lookup and once, transposed, as a classifier.',
    shape: '[B, T, 3072] &rarr; [B, T, 128256]  (generation only needs the last position: [B, 1, 128256])',
    formula: 'logits = h W&#7488;,   W = E  (tied);   p = softmax(logits / temperature)',
    why: 'Tying saves 394M parameters (11% of the model) and forces "what a token means going in" and "what predicts that token coming out" to live in the same space. Larger Llamas (8B, 70B) do not tie &mdash; there the table is a small fraction of the model and separate matrices are slightly better.',
    trap: 'It prints as its own module, but <span class="mono">model.lm_head.weight is model.model.embed_tokens.weight</span> returns <span class="mono">True</span>, and <span class="mono">sum(p.numel() for p in model.parameters())</span> counts it once. Also: full logits for training are [B, T, 128256] in fp32 &mdash; 4.2 GB at batch 1 &times; 8k tokens &mdash; often the single biggest activation in fine-tuning.' }
};

/* ---------- a tensor followed through ----------
   [stage, shape(B,T) -> array, note, run-id]                        */
const TRACE = [
  ['input_ids', (B, T) => [B, T], 'integers, one per token', 'embed'],
  ['embed_tokens', (B, T) => [B, T, CFG.d], 'the residual stream is born', 'embed'],
  ['input_layernorm', (B, T) => [B, T, CFG.d], 'a normalised copy; the stream is untouched', 'ln1'],
  ['q_proj &rarr; heads', (B, T) => [B, CFG.heads, T, CFG.headDim], '24 query heads', 'q'],
  ['k_proj / v_proj &rarr; heads', (B, T) => [B, CFG.kvHeads, T, CFG.headDim], '8 KV heads &mdash; this is what the KV cache stores', 'k'],
  ['scores QK&#7488;/&radic;d', (B, T) => [B, CFG.heads, T, T], 'quadratic in T &mdash; never materialised by FlashAttention', 'attn'],
  ['weights &middot; V', (B, T) => [B, CFG.heads, T, CFG.headDim], 'each head\'s weighted average of values', 'attn'],
  ['o_proj + residual', (B, T) => [B, T, CFG.d], 'written back into the stream', 'o'],
  ['gate_proj, up_proj', (B, T) => [B, T, CFG.ffn], 'two of these, in parallel', 'gate'],
  ['down_proj + residual', (B, T) => [B, T, CFG.d], 'written back into the stream', 'down'],
  ['&hellip; &times;28 &hellip; norm', (B, T) => [B, T, CFG.d], 'the stream after the final layer', 'norm'],
  ['lm_head', (B, T) => [B, T, CFG.vocab], 'one score per vocabulary entry per position', 'head']
];

/* ---------- things people say that are wrong ---------- */
const MYTHS = [
  ['"The printout shows the order things run in."',
   'It shows the order attributes were assigned in <span class="mono">__init__</span>. Both norms run before the sublayers they are listed after; <span class="mono">act_fn</span> runs before <span class="mono">down_proj</span>; <span class="mono">rotary_emb</span> is listed last and used first. Read <span class="mono">forward()</span> for execution order.'],
  ['"It is a 3.6B model &mdash; add up the Linear layers."',
   'Adding every printed shape gives 3,606,752,256. The real count is 3,212,749,824, because <span class="mono">lm_head</span> and <span class="mono">embed_tokens</span> are one tensor printed twice. The model card says 3.21B.'],
  ['"12.9 GB means this model needs a big GPU."',
   '12.9 GB is fp32, 4 bytes per weight, because no dtype was passed. The weights ship in bf16: 6.4 GB. In 4-bit NF4, about 1.6 GB plus overhead &mdash; fits a free Colab T4 with room to fine-tune.'],
  ['"k_proj and v_proj are smaller, so the model is lower quality."',
   'That is grouped-query attention, deliberately. Queries keep all 24 heads; only the cached keys and values are shared in groups of 3. The quality cost is small and the KV cache is 3&times; smaller.'],
  ['"There is no positional encoding in this model."',
   'There is &mdash; <span class="mono">rotary_emb</span>. It is not added to the embeddings; it rotates Q and K inside every attention layer. It has no trainable weights, which is why it is easy to miss.'],
  ['"The attention layer is the big one."',
   'Per layer: attention 25.2M, MLP 75.5M. Across the model: MLP 66%, attention 22%, embeddings 12%. Attention dominates <i>compute</i> only at long context, because its score matrix is T&times;T.']
];

if (typeof window !== 'undefined')
  window.LLAMA = { CFG, count, DTYPES, kvPerToken, loraCount, printout, RUN, M, TRACE, MYTHS };

/* ============================================================
   rendering
   ============================================================ */
const doc = typeof document !== 'undefined' ? document : null;
const printEl = doc && doc.getElementById('ll-print');
if (!printEl) return;

const $ = id => doc.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const human = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
const bytes = b => b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b >= 1e3 ? (b / 1e3).toFixed(1) + ' KB' : b + ' B';
const P = count(CFG);
const INSIDE = new Set(['layer', 'attn', 'q', 'k', 'v', 'o', 'mlp', 'gate', 'up', 'down', 'act', 'ln1', 'ln2']);

let sel = 'embed', showRun = false;

/* ---------- 1. the printout ---------- */
function renderPrint() {
  printEl.innerHTML = printout(CFG).map(([t, id, ind]) => {
    const pad = '<span class="ll-ind">' + '  '.repeat(ind) + '</span>';
    const run = id && RUN[id] ? '<span class="ll-run">' + RUN[id] + '</span>' : '';
    const hi = t.replace(/^\(([a-z_0-9-]+)\)/, '(<b>$1</b>)')
                .replace(/(Linear|Embedding|LlamaRMSNorm|SiLUActivation|LlamaRotaryEmbedding|LlamaAttention|LlamaMLP|LlamaDecoderLayer|ModuleList|LlamaModel|LlamaForCausalLM)/, '<i>$1</i>');
    return id
      ? '<button class="ll-line' + (id === sel ? ' on' : '') + '" data-m="' + id + '" style="--c:' + M[id].c + '">' + pad + hi + run + '</button>'
      : '<div class="ll-line ll-close">' + pad + t + '</div>';
  }).join('');
  printEl.classList.toggle('show-run', showRun);
}

/* ---------- 2. the architecture diagram ----------
   Drawn once. Boxes carry data-m so a click on either the printout or
   the drawing selects the same module.                              */
function renderArch() {
  const box = (id, x, y, w, h, t, s) =>
    '<g class="ll-box" data-m="' + id + '" style="--c:' + M[id].c + '" tabindex="0" role="button" aria-label="' + t + '">' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9"/>' +
      '<text class="ll-bt" x="' + (x + w / 2) + '" y="' + (y + (s ? h / 2 - 3 : h / 2 + 4)) + '">' + t + '</text>' +
      (s ? '<text class="ll-bs" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 12) + '">' + s + '</text>' : '') +
    '</g>';
  const line = (d, cls) => '<path class="ll-wire ' + (cls || '') + '" d="' + d + '" marker-end="url(#ll-arr)"/>';
  const plain = (d, cls) => '<path class="ll-wire ' + (cls || '') + '" d="' + d + '"/>';
  const op = (x, y, s) => '<g class="ll-op"><circle cx="' + x + '" cy="' + y + '" r="13"/><text x="' + x + '" y="' + (y + 5) + '">' + s + '</text></g>';
  const pill = (x, y, w, t) => '<g class="ll-pill"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="28" rx="14"/><text x="' + (x + w / 2) + '" y="' + (y + 18) + '">' + t + '</text></g>';
  const cap = (x, y, t, a) => '<text class="ll-cap" x="' + x + '" y="' + y + '"' + (a ? ' text-anchor="' + a + '"' : '') + '>' + t + '</text>';

  const s = [];
  s.push('<defs><marker id="ll-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ll-arrhead"/></marker></defs>');

  /* input and embedding */
  s.push(pill(250, 12, 200, 'input_ids  [B, T]'));
  s.push(line('M350,40 V62'));
  s.push(box('embed', 220, 64, 260, 46, 'embed_tokens', 'Embedding(128256, 3072)'));

  /* the decoder-layer frame */
  s.push('<rect class="ll-frame" x="60" y="140" width="500" height="690" rx="16"/>');
  s.push('<g class="ll-box ll-framehit" data-m="layer" style="--c:' + M.layer.c + '" tabindex="0" role="button" aria-label="decoder layer"><rect x="72" y="148" width="210" height="24" rx="7"/><text class="ll-bt" x="177" y="164">LlamaDecoderLayer</text></g>');
  s.push('<text class="ll-x28" x="545" y="178" text-anchor="end">&times; 28</text>');

  /* residual stream */
  s.push(plain('M350,110 V124 H110 V470', 'll-res'));
  s.push(plain('M110,496 V800', 'll-res'));
  s.push(line('M110,826 V846 H350 V856', 'll-res'));
  s.push(cap(96, 320, 'residual stream  [B, T, 3072]', 'middle').replace('<text', '<text transform="rotate(-90 96 320)"'));

  /* attention half */
  s.push(line('M110,203 H198'));
  s.push(box('ln1', 200, 186, 260, 34, 'input_layernorm', 'RMSNorm · runs first'));
  s.push(line('M330,220 V232'));
  s.push(plain('M220,232 H440'));
  s.push(line('M220,232 V246')); s.push(line('M330,232 V246')); s.push(line('M440,232 V246'));
  s.push(box('q', 170, 248, 100, 46, 'q_proj', '3072 → 3072'));
  s.push(box('k', 280, 248, 100, 46, 'k_proj', '3072 → 1024'));
  s.push(box('v', 390, 248, 100, 46, 'v_proj', '3072 → 1024'));
  s.push('<g class="ll-box ll-ropechip" data-m="rope" style="--c:' + M.rope.c + '" tabindex="0" role="button" aria-label="RoPE"><rect x="170" y="306" width="210" height="24" rx="7"/><text class="ll-bt" x="275" y="322">rotate q, k by position (RoPE)</text></g>');
  s.push(line('M220,294 V304')); s.push(line('M330,294 V304'));
  s.push(line('M220,330 V356')); s.push(line('M330,330 V356')); s.push(line('M440,294 V356'));
  s.push(box('attn', 170, 358, 320, 46, 'attention  softmax(QKᵀ/√128 + mask)·V', '24 Q heads share 8 KV heads · causal'));
  s.push(line('M330,404 V420'));
  s.push(box('o', 230, 422, 200, 40, 'o_proj', '3072 → 3072'));
  s.push(line('M330,462 V483 H125'));
  s.push(op(110, 483, '+'));

  /* MLP half */
  s.push(line('M110,540 H198'));
  s.push(box('ln2', 200, 523, 260, 34, 'post_attention_layernorm', 'RMSNorm · runs before the MLP'));
  s.push(line('M330,557 V569'));
  s.push(plain('M245,569 H415'));
  s.push(line('M245,569 V583')); s.push(line('M415,569 V583'));
  s.push(box('gate', 170, 585, 150, 46, 'gate_proj', '3072 → 8192'));
  s.push(box('up', 340, 585, 150, 46, 'up_proj', '3072 → 8192'));
  s.push(line('M245,631 V645'));
  s.push(box('act', 185, 647, 120, 30, 'act_fn · SiLU'));
  s.push(line('M245,677 V694 H316'));
  s.push(line('M415,631 V694 H344'));
  s.push(op(330, 694, '×'));
  s.push(line('M330,707 V728'));
  s.push(box('down', 230, 730, 200, 40, 'down_proj', '8192 → 3072'));
  s.push(line('M330,770 V813 H125'));
  s.push(op(110, 813, '+'));

  /* the MLP and attention group labels, clickable */
  s.push('<g class="ll-box ll-group" data-m="attn" style="--c:' + M.attn.c + '" tabindex="0" role="button" aria-label="self attention"><rect x="500" y="248" width="52" height="214" rx="8"/><text class="ll-bt" transform="rotate(90 526 355)" x="526" y="359">self_attn</text></g>');
  s.push('<g class="ll-box ll-group" data-m="mlp" style="--c:' + M.mlp.c + '" tabindex="0" role="button" aria-label="MLP"><rect x="500" y="585" width="52" height="185" rx="8"/><text class="ll-bt" transform="rotate(90 526 677)" x="526" y="681">mlp · SwiGLU</text></g>');

  /* rotary_emb: model-level, feeds every layer */
  s.push(box('rope', 585, 290, 160, 56, 'rotary_emb', 'cos/sin, θ = 500,000'));
  s.push(line('M585,318 H382', 'll-dash'));
  s.push(cap(665, 364, 'computed once per forward', 'middle'));
  s.push(cap(665, 378, 'used by all 28 layers', 'middle'));
  s.push(cap(665, 392, 'no trainable weights', 'middle'));

  /* output */
  s.push(box('norm', 220, 858, 260, 36, 'norm', 'final RMSNorm · once'));
  s.push(line('M350,894 V906'));
  s.push(box('head', 220, 908, 260, 46, 'lm_head', 'Linear(3072 → 128256) · tied'));
  s.push(line('M350,954 V966'));
  s.push(pill(230, 968, 240, 'logits  [B, T, 128256]'));

  /* the tie between embed and head */
  s.push('<path class="ll-tie" d="M480,87 C640,87 640,931 480,931"/>');
  s.push('<g class="ll-tielabel"><rect x="585" y="600" width="130" height="44" rx="8"/><text x="650" y="618">same tensor</text><text x="650" y="634">tie_word_embeddings</text></g>');

  $('ll-arch').innerHTML = '<svg class="ll-svg" viewBox="0 0 760 1010" role="img" aria-label="Llama 3.2 3B architecture">' + s.join('') + '</svg>';
}

/* ---------- 3. detail of the selected module ---------- */
function renderDetail() {
  const m = M[sel];
  const n = m.p ? P[m.p] : 0;
  const per = INSIDE.has(sel) && m.p && sel !== 'layer' ? ' per layer &middot; ' + human(n * CFG.layers) + ' across all 28' : sel === 'layer' ? ' per layer &middot; ' + human(n * CFG.layers) + ' for all 28' : '';
  const share = m.p ? ((INSIDE.has(sel) ? n * CFG.layers : n) / P.total * 100) : 0;
  const pline = m.p === 'head'
    ? '<b>' + fmt(n) + '</b> &mdash; but shared with embed_tokens, so <b>0 extra</b>'
    : m.p ? '<b>' + fmt(n) + '</b>' + per + (sel !== 'causallm' ? ' &middot; ' + (share < 0.01 ? '&lt;0.01' : share.toFixed(share < 1 ? 2 : 1)) + '% of the model' : '')
    : '<b>0</b> trainable';
  $('ll-detail').innerHTML =
    '<div class="ll-d" style="--c:' + m.c + '">' +
      '<div class="ll-d-head"><span class="ll-d-dot"></span><h4>' + m.t + '</h4>' + (RUN[sel] ? '<span class="ll-d-run">runs at step ' + RUN[sel] + '</span>' : '') + '</div>' +
      '<p class="ll-d-lay"><b>In plain English.</b> ' + m.lay + '</p>' +
      '<div class="ll-d-grid">' +
        '<div><div class="lab-pane-title">Shape</div><div class="ll-d-mono">' + m.shape + '</div></div>' +
        '<div><div class="lab-pane-title">Parameters</div><div class="ll-d-num">' + pline + '</div></div>' +
      '</div>' +
      '<div class="lab-pane-title">What it does</div><p>' + m.what + '</p>' +
      '<div class="lab-pane-title">The maths</div><div class="ll-d-mono ll-d-f">' + m.formula + '</div>' +
      '<div class="lab-pane-title">Why Llama does it this way</div><p>' + m.why + '</p>' +
      '<div class="ll-d-trap"><b>Interview trap</b>' + m.trap + '</div>' +
    '</div>';
}

/* one detail card, moved under whichever view was clicked so it opens
   where the reader is looking instead of a screen away                */
function select(id, from) {
  if (!M[id]) return;
  sel = id;
  if (from) $('ll-slot-' + from).appendChild($('ll-detail'));
  printEl.querySelectorAll('.ll-line[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === id));
  doc.querySelectorAll('#ll-arch .ll-box').forEach(b => b.classList.toggle('on', b.dataset.m === id));
  renderDetail();
}

/* ---------- 4. the shape tracer ---------- */
function renderShapes() {
  const T = +$('ll-T').value, B = +$('ll-B').value;
  $('ll-T-v').textContent = fmt(T); $('ll-B-v').textContent = B;
  const rows = TRACE.map(([st, f, note, id]) => {
    const sh = f(B, T), n = sh.reduce((a, b) => a * b, 1);
    const big = n * 2 > 1e9;
    return '<tr' + (big ? ' class="big"' : '') + ' data-m="' + id + '"><td>' + st + '</td><td class="mono">[' + sh.map(fmt).join(', ') + ']</td>' +
      '<td class="num">' + human(n) + '</td><td class="num">' + bytes(n * 2) + '</td><td class="dim">' + note + '</td></tr>';
  }).join('');
  $('ll-shapes').innerHTML = '<div class="ll-tablewrap"><table class="ll-table"><thead><tr><th>After</th><th>Shape</th><th>Elements</th><th>bf16</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---------- 5. parameters and memory ---------- */
let dtype = 'fp32', untie = false;
function renderParams() {
  const L = CFG.layers;
  const parts = [
    ['embed_tokens', P.embed, G.io],
    ['attention &times;28', P.attn * L, G.attn],
    ['MLP &times;28', P.mlp * L, G.mlp],
    ['RMSNorms (57)', P.norms * L + P.finalNorm, G.norm]
  ];
  if (untie) parts.push(['lm_head (untied)', P.head, '#fb7185']);
  const total = parts.reduce((s, p) => s + p[1], 0);
  const bar = parts.map(p => '<div class="ll-seg" style="flex:' + p[1] + ';--c:' + p[2] + '" title="' + p[0].replace(/&times;/, 'x') + ': ' + fmt(p[1]) + '"></div>').join('');
  const legend = parts.map(p => '<div class="ll-leg"><span style="--c:' + p[2] + '"></span><b>' + p[0] + '</b><i>' + fmt(p[1]) + '</i><em>' + (p[1] / total * 100).toFixed(p[1] / total < 0.01 ? 3 : 1) + '%</em></div>').join('');
  const dt = DTYPES.find(d => d.id === dtype);
  $('ll-params').innerHTML =
    '<div class="ll-bar">' + bar + '</div><div class="ll-legend">' + legend + '</div>' +
    '<div class="stat-row ll-stats">' +
      '<div class="stat"><div class="stat-v">' + (total / 1e9).toFixed(3) + 'B</div><div class="stat-k">parameters</div></div>' +
      '<div class="stat"><div class="stat-v">' + (total * dt.b / 1e9).toFixed(1) + ' GB</div><div class="stat-k">weights in ' + dt.n + '</div></div>' +
      '<div class="stat"><div class="stat-v">' + human(P.layer) + '</div><div class="stat-k">per decoder layer</div></div>' +
      '<div class="stat"><div class="stat-v">' + (P.mlp / P.layer * 100).toFixed(0) + '%</div><div class="stat-k">of each layer is MLP</div></div>' +
    '</div>' +
    '<p class="ll-dnote">' + dt.note + (untie ? ' <b>Untied:</b> this is the number you get by naively adding every printed shape &mdash; ' + fmt(total) + ' &mdash; and it is wrong for this checkpoint.' : '') + '</p>';
  $('ll-dtypes').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.d === dtype));
}

/* ---------- 6. GQA and the KV cache ---------- */
let kvMode = 'gqa';
const KVMODES = { mha: ['Multi-head (MHA)', CFG.heads], gqa: ['Grouped-query (GQA) — this model', CFG.kvHeads], mqa: ['Multi-query (MQA)', 1] };
function renderGQA() {
  const kvh = KVMODES[kvMode][1], group = CFG.heads / kvh;
  const W = 740, qw = 26, gap = (W - 20 - CFG.heads * qw) / (CFG.heads - 1);
  const qx = i => 10 + i * (qw + gap);
  const s = [];
  for (let i = 0; i < CFG.heads; i++) {
    const g = Math.floor(i / group);
    s.push('<rect class="ll-qh" x="' + qx(i) + '" y="30" width="' + qw + '" height="26" rx="5" style="--g:' + (g * 360 / kvh) + '"/>');
    s.push('<text class="ll-hn" x="' + (qx(i) + qw / 2) + '" y="47">' + i + '</text>');
  }
  for (let j = 0; j < kvh; j++) {
    const first = qx(j * group), last = qx((j + 1) * group - 1) + qw;
    const cx = (first + last) / 2, kw = Math.max(26, Math.min(70, last - first));
    for (let i = j * group; i < (j + 1) * group; i++)
      s.push('<path class="ll-gw" style="--g:' + (j * 360 / kvh) + '" d="M' + (qx(i) + qw / 2) + ',56 C' + (qx(i) + qw / 2) + ',92 ' + cx + ',92 ' + cx + ',116"/>');
    s.push('<rect class="ll-kvh" x="' + (cx - kw / 2) + '" y="118" width="' + kw + '" height="30" rx="6" style="--g:' + (j * 360 / kvh) + '"/>');
    if (kw >= 40 || kvh <= 8) s.push('<text class="ll-hn" x="' + cx + '" y="137">' + (kw >= 40 ? 'K,V ' + j : j) + '</text>');
  }
  s.push('<text class="ll-cap" x="10" y="20">24 query heads (q_proj: 24 × 128 = 3072)</text>');
  s.push('<text class="ll-cap" x="10" y="170">' + kvh + ' key/value head' + (kvh > 1 ? 's' : '') + ' (k_proj, v_proj: ' + kvh + ' × 128 = ' + fmt(kvh * 128) + ') — each shared by ' + group + ' query head' + (group > 1 ? 's' : '') + '</text>');
  $('ll-gqa').innerHTML = '<svg class="ll-gsvg" viewBox="0 0 ' + W + ' 180" role="img" aria-label="attention heads">' + s.join('') + '</svg>';

  const ctx = +$('ll-ctx').value, bs = +$('ll-bs').value;
  $('ll-ctx-v').textContent = fmt(ctx); $('ll-bs-v').textContent = bs;
  const per = kvPerToken(CFG, kvh, 2), total = per * ctx * bs;
  const kvW = kvh * CFG.headDim, attnP = 2 * CFG.d * CFG.d + 2 * CFG.d * kvW;
  $('ll-kvstats').innerHTML =
    '<div class="stat"><div class="stat-v">' + (per / 1024).toFixed(0) + ' KiB</div><div class="stat-k">KV cache per token</div></div>' +
    '<div class="stat"><div class="stat-v' + (total > 40e9 ? ' bad' : '') + '">' + bytes(total) + '</div><div class="stat-k">KV cache, ' + fmt(ctx) + ' tok &times; ' + bs + '</div></div>' +
    '<div class="stat"><div class="stat-v">' + fmt(kvW) + '</div><div class="stat-k">k_proj / v_proj out</div></div>' +
    '<div class="stat"><div class="stat-v">' + human(attnP) + '</div><div class="stat-k">attention params / layer</div></div>';
  $('ll-kvmodes').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.k === kvMode));
}

/* ---------- 7. LoRA ---------- */
const LORA_T = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'];
let loraR = 16, loraOn = new Set(LORA_T);
function renderLoRA() {
  const t = LORA_T.filter(x => loraOn.has(x));
  const n = loraCount(CFG, loraR, t);
  $('ll-lora-t').innerHTML = LORA_T.map(x =>
    '<button class="chip' + (loraOn.has(x) ? ' active' : '') + '" data-t="' + x + '">' + x + '</button>').join('');
  $('ll-lora-r').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', +c.dataset.r === loraR));
  $('ll-lora-out').innerHTML =
    '<div class="stat-row">' +
      '<div class="stat"><div class="stat-v">' + fmt(n) + '</div><div class="stat-k">trainable parameters</div></div>' +
      '<div class="stat"><div class="stat-v good">' + (n / P.total * 100).toFixed(2) + '%</div><div class="stat-k">of the 3.21B model</div></div>' +
      '<div class="stat"><div class="stat-v">' + bytes(n * 2) + '</div><div class="stat-k">adapter file (bf16)</div></div>' +
    '</div>' +
    '<pre class="code ll-code">from peft import LoraConfig, get_peft_model\n\nconfig = LoraConfig(\n    r=' + loraR + ', lora_alpha=' + (loraR * 2) + ', lora_dropout=0.05,\n    target_modules=[' + t.map(x => '"' + x + '"').join(', ') + '],\n    task_type="CAUSAL_LM",\n)\nmodel = get_peft_model(base_model, config)\nmodel.print_trainable_parameters()\n# trainable params: ' + fmt(n) + ' || all params: ' + fmt(P.total + n) + ' || trainable%: ' + (n / (P.total + n) * 100).toFixed(4) + '</pre>';
}

/* ---------- 8. myths ---------- */
function renderMyths() {
  $('ll-myths').innerHTML = MYTHS.map(([m, a]) => '<dt>' + m + '</dt><dd>' + a + '</dd>').join('');
}

/* ---------- wiring ---------- */
renderPrint(); renderArch(); renderDetail(); renderShapes(); renderParams(); renderGQA(); renderLoRA(); renderMyths();
select(sel);

printEl.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) select(b.dataset.m, 'print'); });
$('ll-arch').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) select(b.dataset.m, 'arch'); });
$('ll-arch').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const b = e.target.closest('[data-m]'); if (b) { e.preventDefault(); select(b.dataset.m, 'arch'); }
});
$('ll-shapes').addEventListener('click', e => {
  const r = e.target.closest('tr[data-m]'); if (!r) return;
  select(r.dataset.m, 'print');
  $('ll-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('ll-runorder').addEventListener('click', () => {
  showRun = !showRun;
  $('ll-runorder').classList.toggle('on', showRun);
  printEl.classList.toggle('show-run', showRun);
});
['ll-T', 'll-B'].forEach(id => $(id).addEventListener('input', renderShapes));
['ll-ctx', 'll-bs'].forEach(id => $(id).addEventListener('input', renderGQA));
$('ll-dtypes').innerHTML = DTYPES.map(d => '<button class="chip" data-d="' + d.id + '">' + d.n + ' &middot; ' + d.b + ' B</button>').join('') +
  '<label class="toggle ll-untie" id="ll-untie"><span class="toggle-box">&#10003;</span><span>Count lm_head separately (untied)</span></label>';
$('ll-dtypes').addEventListener('click', e => {
  const c = e.target.closest('[data-d]');
  if (c) { dtype = c.dataset.d; renderParams(); return; }
  if (e.target.closest('#ll-untie')) { untie = !untie; $('ll-untie').classList.toggle('on', untie); renderParams(); }
});
renderParams();
$('ll-kvmodes').innerHTML = Object.keys(KVMODES).map(k => '<button class="chip" data-k="' + k + '">' + KVMODES[k][0] + '</button>').join('');
$('ll-kvmodes').addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (c) { kvMode = c.dataset.k; renderGQA(); } });
renderGQA();
$('ll-lora-r').innerHTML = [4, 8, 16, 32, 64].map(r => '<button class="chip" data-r="' + r + '">r = ' + r + '</button>').join('');
$('ll-lora-r').addEventListener('click', e => { const c = e.target.closest('[data-r]'); if (c) { loraR = +c.dataset.r; renderLoRA(); } });
$('ll-lora-t').addEventListener('click', e => {
  const c = e.target.closest('[data-t]'); if (!c) return;
  const t = c.dataset.t;
  if (loraOn.has(t)) { if (loraOn.size > 1) loraOn.delete(t); } else loraOn.add(t);
  renderLoRA();
});
renderLoRA();
})();
