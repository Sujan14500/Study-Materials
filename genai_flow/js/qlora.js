/* ============================================================
   qlora.js — "The ten knobs of a QLoRA run" (chapter 21).

   Five knobs decide WHAT is trained and how the frozen base is
   stored (target modules, r, alpha, quantization, dropout). Five
   decide HOW training runs (epochs, batch size, learning rate,
   gradient accumulation, optimizer). One config object drives the
   controls, the stats, the review, the generated Python and the
   learning-rate curve, so none of them can disagree.

     #qk-steps     the four steps of one training step, and the knobs in each
     #qk-scen      one-click scenarios (good default, "did nothing", "memorised")
     #qk-controls  the ten knobs, plus model and dataset size
     #qk-stats     parameters, memory, scale, effective batch, steps
     #qk-review    what an experienced reviewer would say about the config
     #qk-curve     the learning-rate schedule those settings produce
     #qk-code      the BitsAndBytesConfig / LoraConfig / SFTConfig it implies
     #qk-knobs     all ten knobs explained

   test.js loads this file and re-derives every number.
   ============================================================ */
(function () {
'use strict';

/* ---------- models: real config.json shapes ----------
   d = hidden size, kv = key/value projection width (grouped-query
   attention: 8 KV heads x 128), ff = MLP intermediate size.
   None of these three ties lm_head to embed_tokens.              */
const MODELS = [
  { id: 'l8',  n: 'Llama 3 8B',  d: 4096, kv: 1024, ff: 14336, layers: 32, vocab: 128256 },
  { id: 'm7',  n: 'Mistral 7B',  d: 4096, kv: 1024, ff: 14336, layers: 32, vocab: 32000 },
  { id: 'l70', n: 'Llama 3 70B', d: 8192, kv: 1024, ff: 28672, layers: 80, vocab: 128256 }
];

/* the seven Linear layers in every decoder block, as print(model) names them */
const MODULES = [
  { id: 'q_proj',    grp: 'attn', io: m => [m.d, m.d] },
  { id: 'k_proj',    grp: 'attn', io: m => [m.d, m.kv] },
  { id: 'v_proj',    grp: 'attn', io: m => [m.d, m.kv] },
  { id: 'o_proj',    grp: 'attn', io: m => [m.d, m.d] },
  { id: 'gate_proj', grp: 'mlp',  io: m => [m.d, m.ff] },
  { id: 'up_proj',   grp: 'mlp',  io: m => [m.d, m.ff] },
  { id: 'down_proj', grp: 'mlp',  io: m => [m.ff, m.d] }
];

/* every parameter, split into the part bitsandbytes quantises (the
   decoder Linears) and the part it leaves in 16-bit (embeddings,
   lm_head, norms)                                                   */
function params(m) {
  const linear = m.layers * MODULES.reduce((s, x) => { const [i, o] = x.io(m); return s + i * o; }, 0);
  const norms = m.layers * 2 * m.d + m.d;
  const embed = m.vocab * m.d * 2;                    /* embed_tokens + untied lm_head */
  return { linear, rest: norms + embed, total: linear + norms + embed };
}

/* LoRA adds A (r x in) and B (out x r) beside each targeted Linear */
function loraCount(m, r, targets) {
  return m.layers * MODULES.filter(x => targets.indexOf(x.id) >= 0)
    .reduce((s, x) => { const [i, o] = x.io(m); return s + r * (i + o); }, 0);
}

/* storage for the frozen base. bits = bits per quantised Linear weight,
   including the per-block scales: NF4/FP4 keep one fp32 absmax per 64
   weights (+0.5 bit); double quantisation stores those as 8-bit with one
   fp32 scale per 256 of them (+0.127 bit).                              */
const QUANT = [
  { id: 'bf16',  n: 'none: bf16, plain LoRA', bits: 16,
    cfg: null },
  { id: 'int8',  n: '8-bit', bits: 8,
    cfg: ['load_in_8bit=True'] },
  { id: 'fp4',   n: '4-bit FP4', bits: 4 + 32 / 64,
    cfg: ['load_in_4bit=True', 'bnb_4bit_quant_type="fp4"', 'bnb_4bit_compute_dtype=torch.bfloat16'] },
  { id: 'nf4',   n: '4-bit NF4', bits: 4 + 32 / 64,
    cfg: ['load_in_4bit=True', 'bnb_4bit_quant_type="nf4"', 'bnb_4bit_compute_dtype=torch.bfloat16'] },
  { id: 'nf4dq', n: 'NF4 + double quant', bits: 4 + 8 / 64 + 32 / (64 * 256),
    cfg: ['load_in_4bit=True', 'bnb_4bit_quant_type="nf4"', 'bnb_4bit_use_double_quant=True', 'bnb_4bit_compute_dtype=torch.bfloat16'] }
];
function baseBytes(m, qid) {
  const q = QUANT.filter(x => x.id === qid)[0], p = params(m);
  return p.linear * q.bits / 8 + p.rest * 2;
}

/* optimizer state per TRAINABLE parameter, in bytes (HF `optim` names) */
const OPTIM = [
  { id: 'adamw_torch',       b: 8, paged: false, n: 'AdamW, fp32 states' },
  { id: 'paged_adamw_32bit', b: 8, paged: true,  n: 'AdamW, fp32 states, paged' },
  { id: 'adamw_bnb_8bit',    b: 2, paged: false, n: 'AdamW, 8-bit states' },
  { id: 'paged_adamw_8bit',  b: 2, paged: true,  n: 'AdamW, 8-bit states, paged' },
  { id: 'sgd',               b: 0, paged: false, n: 'SGD, no momentum' }
];

const RANKS = [4, 8, 16, 32, 64, 128, 256];
const ALPHAS = [4, 8, 16, 32, 64, 128, 256, 512];
const LRS = [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 3e-4, 5e-4, 1e-3, 2e-3];
const BATCHES = [1, 2, 4, 8, 16, 32];
const ACCUMS = [1, 2, 4, 8, 16, 32, 64];
const DROPOUTS = [0, 0.05, 0.1, 0.2, 0.3];
const WARMUP = 0.03;

const ALL7 = MODULES.map(x => x.id);
const DEFAULT = { model: 'l8', targets: ALL7.slice(), r: 16, alpha: 32, quant: 'nf4dq', dropout: 0.05,
                  n: 5000, epochs: 2, batch: 4, accum: 4, lr: 2e-4, optim: 'paged_adamw_8bit' };

const SCENARIOS = [
  { id: 'good', n: 'A sensible default', cfg: {} },
  { id: 'flat', n: 'The fine-tune that did nothing',
    cfg: { targets: ['q_proj', 'v_proj'], r: 64, alpha: 8, lr: 2e-5, epochs: 1 } },
  { id: 'memo', n: 'The fine-tune that memorised',
    cfg: { n: 300, epochs: 10, r: 256, alpha: 512, dropout: 0, batch: 1, accum: 1, lr: 1e-3 } },
  { id: 'big',  n: '70B on one GPU',
    cfg: { model: 'l70', r: 16, alpha: 32, batch: 1, accum: 16, lr: 1e-4 } }
];

/* ---------- everything the page shows, from one config ---------- */
function compute(c) {
  const m = MODELS.filter(x => x.id === c.model)[0];
  const P = params(m);
  const lora = loraCount(m, c.r, c.targets);
  const opt = OPTIM.filter(x => x.id === c.optim)[0];
  const effBatch = c.batch * c.accum;
  const perEpoch = Math.ceil(Math.ceil(c.n / c.batch) / c.accum);   /* optimizer steps per epoch */
  const steps = perEpoch * c.epochs;
  return {
    m, P, lora,
    pct: lora / P.total * 100,
    base: baseBytes(m, c.quant),
    adapterFile: lora * 2,                    /* saved in bf16 */
    adapterTrain: lora * (4 + 4 + opt.b),     /* fp32 weights + fp32 grads + optimizer state */
    optState: lora * opt.b,
    scale: c.alpha / c.r,
    effBatch, perEpoch, steps,
    warmup: Math.ceil(steps * WARMUP)
  };
}

/* learning rate at a given optimizer step: linear warmup, then cosine to zero */
function lrAt(c, step, total) {
  const w = Math.ceil(total * WARMUP);
  if (step < w) return c.lr * step / w;
  return c.lr * 0.5 * (1 + Math.cos(Math.PI * (step - w) / Math.max(1, total - w)));
}

/* ---------- number formatting, shared by the review and the page ---------- */
function gb(b) { return b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(0) + ' MB'; }
function fmt(n) { return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n.toLocaleString('en-US'); }

/* ---------- the review: what a reviewer would flag ----------
   lvl: bad (will not work) | warn (probably wrong) | info (worth knowing) */
function review(c) {
  const R = compute(c), out = [];
  const add = (lvl, id, t) => out.push({ lvl, id, t });
  const hasMlp = c.targets.some(t => /gate|up|down/.test(t));
  const fmtLr = c.lr.toExponential(0).replace('e-', 'e-');

  if (c.lr <= 5e-5) add('bad', 'lr', 'learning_rate=' + fmtLr + ' is a full fine-tune rate. The adapters start at zero and barely move: the classic "the fine-tune did nothing". LoRA and QLoRA want 1e-4 to 3e-4.');
  if (c.lr >= 1e-3) add('warn', 'lr', 'learning_rate=' + fmtLr + ' is high for LoRA. Expect loss spikes and forgetting; drop to around 2e-4, or keep it only for a tiny model and a short run.');
  if (R.scale > 4) add('warn', 'alpha', 'alpha / r = ' + R.scale + ': every adapter update is amplified ' + R.scale + 'x, which acts like a higher learning rate. alpha = 2r (scale 2) is the usual default.');
  if (R.scale < 0.5) add('warn', 'alpha', 'alpha / r = ' + R.scale + ': the adapter is damped to ' + R.scale + 'x of its value. Raising r while keeping alpha fixed does this silently. Move alpha with r.');
  if (!hasMlp) add('warn', 'target', 'Attention only. That is the 2021 LoRA-paper default; the QLoRA paper put adapters on every linear layer and found it mattered more than rank. Add gate_proj, up_proj, down_proj, or pass "all-linear".');
  if (c.r >= 128) add('warn', 'r', 'r=' + c.r + ' gives diminishing returns and a large adapter that can memorise a small dataset. 16 to 64 covers almost every task.');
  if (c.dropout === 0 && c.n < 2000) add('warn', 'dropout', 'No dropout on ' + c.n.toLocaleString('en-US') + ' examples. Small datasets are where lora_dropout of 0.05 to 0.1 earns its keep.');
  if (c.dropout >= 0.2) add('warn', 'dropout', 'lora_dropout=' + c.dropout + ' slows learning a lot. 0.05 to 0.1 is the usual range.');
  if (c.quant === 'fp4') add('warn', 'quant', 'FP4 spaces its 16 levels evenly-ish; NF4 puts them at the quantiles of a normal distribution, where pretrained weights actually sit. There is no reason to pick FP4 here.');
  if (c.quant === 'bf16') add('info', 'quant', 'No quantization: this is plain LoRA, and the frozen base alone needs ' + gb(R.base) + '. If that fits your GPU, this is the faster and slightly more accurate choice.');
  if (c.quant === 'int8') add('info', 'quant', '8-bit halves the base versus bf16, but 8-bit matmuls are slow and 4-bit NF4 is the standard QLoRA setting.');
  if (/^(fp4|nf4|nf4dq)$/.test(c.quant) && !OPTIM.filter(o => o.id === c.optim)[0].paged)
    add('warn', 'optim', 'A 4-bit run without a paged optimizer: one long sequence can spike memory and crash with OOM. paged_adamw_8bit or paged_adamw_32bit is the QLoRA default.');
  if (c.optim === 'sgd') add('warn', 'optim', 'SGD is almost never used to fine-tune LLMs: it needs far more learning-rate tuning than Adam, and the memory it saves on adapters is small.');
  if (R.effBatch < 8) add('warn', 'accum', 'Effective batch ' + R.effBatch + ' (batch ' + c.batch + ' x accumulation ' + c.accum + ') gives noisy updates. Raise gradient_accumulation_steps; it costs time, not memory.');
  if (R.effBatch > c.n / 10) add('warn', 'batch', 'Effective batch ' + R.effBatch + ' on ' + c.n.toLocaleString('en-US') + ' examples leaves only ' + R.perEpoch + ' optimizer steps per epoch.');
  if (R.steps < 50) add('bad', 'epochs', 'Only ' + R.steps + ' optimizer steps in total. That is too few updates to learn anything reliable.');
  if (c.epochs >= 4) add('warn', 'epochs', c.epochs + ' epochs: past about 3, a fine-tune usually starts reciting its training set. Watch eval loss and keep the best checkpoint, not the last.');
  if (c.batch >= 16) add('info', 'batch', 'A micro-batch of ' + c.batch + ' is bounded by activation memory, not by this maths. If it OOMs, halve the batch and double the accumulation: same effective batch, same result.');
  if (!out.some(x => x.lvl !== 'info')) add('ok', 'all', 'A sensible starting config. Now the only way to improve it is an eval set: change one knob at a time and compare eval loss.');
  return out;
}

/* ---------- the Python those settings imply ---------- */
function pyCode(c) {
  const R = compute(c), q = QUANT.filter(x => x.id === c.quant)[0];
  const tgt = c.targets.length === 7 ? '"all-linear"' : '[' + c.targets.map(t => '"' + t + '"').join(', ') + ']';
  const lr = c.lr.toExponential(0).replace('e-', 'e-');
  const L = [];
  L.push('import torch');
  L.push('from transformers import AutoModelForCausalLM, BitsAndBytesConfig');
  L.push('from peft import LoraConfig');
  L.push('from trl import SFTConfig');
  L.push('');
  L.push('# ---- the five QLoRA knobs ----');
  if (q.cfg) {
    L.push('bnb_config = BitsAndBytesConfig(                  # quantization');
    q.cfg.forEach(x => L.push('    ' + x + ','));
    L.push(')');
    L.push('model = AutoModelForCausalLM.from_pretrained(MODEL, quantization_config=bnb_config)');
  } else {
    L.push('# quantization: none. Base loaded in bf16, so this is plain LoRA, not QLoRA');
    L.push('model = AutoModelForCausalLM.from_pretrained(MODEL, torch_dtype=torch.bfloat16)');
  }
  L.push('lora_config = LoraConfig(');
  L.push('    target_modules=' + tgt + ',');
  L.push('    r=' + c.r + ',');
  L.push('    lora_alpha=' + c.alpha + ',                   # adapter scale = alpha / r = ' + R.scale);
  L.push('    lora_dropout=' + c.dropout + ',');
  L.push('    task_type="CAUSAL_LM",');
  L.push(')');
  L.push('');
  L.push('# ---- the five training knobs ----');
  L.push('train_config = SFTConfig(');
  L.push('    output_dir="out",');
  L.push('    num_train_epochs=' + c.epochs + ',');
  L.push('    per_device_train_batch_size=' + c.batch + ',');
  L.push('    gradient_accumulation_steps=' + c.accum + ',      # effective batch ' + R.effBatch);
  L.push('    learning_rate=' + lr + ',');
  L.push('    lr_scheduler_type="cosine",');
  L.push('    warmup_ratio=' + WARMUP + ',');
  L.push('    optim="' + c.optim + '",');
  L.push('    bf16=True,');
  L.push(')');
  L.push('# ' + c.n.toLocaleString('en-US') + ' examples -> ' + R.perEpoch + ' optimizer steps per epoch, ' + R.steps + ' in total');
  return L.join('\n');
}

/* ---------- the ten knobs, explained ---------- */
const KNOBS = [
  { id: 'target', grp: 'qlora', n: 'Target modules', arg: 'target_modules',
    lay: 'Which parts of the model get the clip-on glasses. Only the parts you pick can change.',
    tech: 'The names of the nn.Linear layers PEFT wraps with A and B, exactly as print(model) shows them: q_proj, k_proj, v_proj, o_proj in attention; gate_proj, up_proj, down_proj in the MLP. Each costs r &times; (in + out) parameters per layer. The LoRA paper adapted q and v; the QLoRA paper adapted every linear layer and found that mattered more than rank.',
    typical: '"all-linear", or q, k, v, o',
    when: 'Attention only for a light style change and the smallest adapter. Add the MLP when the task needs new associations: that is where most parameters live.' },
  { id: 'r', grp: 'qlora', n: 'r (rank)', arg: 'r',
    lay: 'How much room the glasses have for new behaviour. More room holds more change, costs more, and can memorise.',
    tech: 'The inner dimension of A (r &times; in) and B (out &times; r), so the update BA has rank at most r. Trainable parameters and adapter size grow linearly with r. Returns flatten fast: 8&ndash;16 for style and format, 32&ndash;64 for bigger behaviour changes.',
    typical: '16 to start; 8&ndash;64',
    when: 'Raise it if train and eval loss both stall high (underfitting). Lower it if a small dataset gets memorised.' },
  { id: 'alpha', grp: 'qlora', n: 'Alpha', arg: 'lora_alpha',
    lay: 'The volume knob on the glasses: how loudly the learned change is played on top of the original model.',
    tech: 'The adapter output is multiplied by &alpha;/r: <code>h = Wx + (&alpha;/r)&middot;BAx</code>. The ratio is what matters. With Adam, a bigger scale acts much like a bigger learning rate for the adapter. Change r without changing &alpha; and you silently change that scale. rsLoRA (<code>use_rslora=True</code>) scales by &alpha;/&radic;r to keep large ranks stable.',
    typical: '&alpha; = 2r (scale 2), or &alpha; = r',
    when: 'Keep the ratio fixed while you sweep r. Tune the learning rate first, then leave &alpha; alone.' },
  { id: 'quant', grp: 'qlora', n: 'Quantization', arg: 'BitsAndBytesConfig',
    lay: 'How tightly the frozen original is compressed so it fits on your GPU. It is the Q in QLoRA. The part you train is never compressed.',
    tech: '<code>load_in_4bit</code> + <code>bnb_4bit_quant_type="nf4"</code> stores each base Linear in 4 bits at the quantiles of a normal distribution, one scale per 64 weights. <code>bnb_4bit_use_double_quant</code> quantises those scales too (0.5 &rarr; 0.127 bits of overhead per weight). <code>bnb_4bit_compute_dtype=torch.bfloat16</code> is what each block is de-quantised into for the matmul. Embeddings, lm_head and norms stay 16-bit.',
    typical: '4-bit NF4 + double quant, bf16 compute',
    when: 'Skip it (plain LoRA on a bf16 base) when the model fits: roughly 25&ndash;40% faster per step and the reference quality.' },
  { id: 'dropout', grp: 'qlora', n: 'Dropout', arg: 'lora_dropout',
    lay: 'Randomly blanking part of what the glasses see during practice, so they learn the pattern instead of memorising the examples.',
    tech: 'PEFT applies dropout to the input of the adapter path only: <code>B&middot;A&middot;dropout(x)</code>. The frozen path Wx is untouched, and dropout switches off at inference. It is a regulariser, so it matters on small datasets and hardly at all on large ones. The QLoRA paper used 0.1 for 7B/13B and 0.05 for 33B/65B.',
    typical: '0.05&ndash;0.1',
    when: 'Raise it when eval loss turns up while train loss keeps falling on a small dataset. Use 0 on very large datasets.' },
  { id: 'epochs', grp: 'train', n: 'Epochs', arg: 'num_train_epochs',
    lay: 'How many times the model reads your whole training set. Too few and it has not learned; too many and it recites your examples back.',
    tech: 'One epoch is one full pass over the data. For fine-tuning, 1&ndash;3 is standard: eval loss usually bottoms out in that range, then climbs while train loss keeps falling. That turn is overfitting. Epochs multiply the total optimizer steps, which the learning-rate schedule is laid out over.',
    typical: '1&ndash;3',
    when: 'More only if eval loss is still falling at the end. Save a checkpoint per epoch and keep the best on eval loss, not the last.' },
  { id: 'batch', grp: 'train', n: 'Batch size', arg: 'per_device_train_batch_size',
    lay: 'How many examples the model looks at together in one go. Bigger batches give steadier corrections but need more memory.',
    tech: 'The micro-batch that goes through one forward and backward pass on one GPU. Activation memory grows with batch &times; sequence length, so in QLoRA this, not the weights, is usually what runs out. What learning actually sees is the <b>effective batch</b> = batch &times; gradient_accumulation_steps &times; number of GPUs.',
    typical: '1&ndash;8 per GPU; effective 16&ndash;64',
    when: 'Use the largest that fits without OOM, then reach the effective batch you want with gradient accumulation.' },
  { id: 'lr', grp: 'train', n: 'Learning rate', arg: 'learning_rate',
    lay: 'How big a correction the model makes after each step. Too small and nothing changes; too big and it overshoots and forgets what it knew.',
    tech: 'For LoRA and QLoRA, 1e-4 to 3e-4: roughly 10&times; a full fine-tune (1e-5 to 5e-5), because only the small, zero-initialised adapters move. The QLoRA paper used 2e-4 for 7B/13B and 1e-4 for 33B/65B: bigger model, smaller rate. It comes with a schedule: warm up from zero over the first ~3% of steps, then decay (cosine or linear).',
    typical: '2e-4, cosine, warmup_ratio 0.03',
    when: 'Loss flat from step one: raise it. Loss spiking or NaN: lower it, add warmup, clip gradients (max_grad_norm 0.3&ndash;1.0).' },
  { id: 'accum', grp: 'train', n: 'Gradient accumulation', arg: 'gradient_accumulation_steps',
    lay: 'Doing several small batches and adding up their corrections before making one change. A big batch\'s result on a small GPU\'s memory.',
    tech: 'Run N micro-batches forward and backward, let the gradients sum, then call optimizer.step() once. Memory is one micro-batch; the update equals one batch N&times; bigger (loss divided by N). The price is time: N passes per update. With variable-length sequences, averaging per micro-batch weights tokens unevenly; recent transformers releases normalise by the token count across the whole accumulated batch.',
    typical: '4&ndash;16, to reach an effective batch of 16&ndash;64',
    when: 'Raise it whenever you cut the per-GPU batch to fit memory, so the effective batch, and the learning rate that suits it, stays the same.' },
  { id: 'optim', grp: 'train', n: 'Optimizer', arg: 'optim',
    lay: 'The rule that turns each correction into an actual change. Adam remembers recent directions so it moves smoothly; the variants store that memory more cheaply.',
    tech: 'AdamW keeps two running averages per trainable parameter: 8 bytes in fp32. In full fine-tuning that is most of the 16 bytes/param; in LoRA it applies only to the adapters, so it is small. <code>adamw_bnb_8bit</code> stores both averages in 8 bits (2 bytes). <code>paged_</code> variants, the QLoRA default, keep that state in memory that can page to CPU RAM when a long sequence spikes GPU memory, instead of crashing with OOM.',
    typical: 'paged_adamw_8bit or paged_adamw_32bit',
    when: 'Plain adamw_torch when memory is comfortable and you want the fastest steps. SGD is almost never the right answer for LLMs.' }
];

/* ---------- the four steps of one training step, and where each knob acts ----------
   Training = tweaking the parameters based on training data, in a way that
   should generalise to unseen data. Every knob above acts in one of these.  */
const STEPS = [
  { id: 'forward', n: 'Forward pass', s: 'Predict the output given the inputs',
    d: 'A micro-batch goes through the model. Each targeted Linear computes Wx from the 4-bit base (de-quantised block by block) plus (&alpha;/r)&middot;BA&middot;dropout(x) from the adapter.',
    knobs: ['batch', 'quant', 'target', 'dropout'] },
  { id: 'loss', n: 'Loss calculation', s: 'How far was the prediction from the ground truth?',
    d: 'Cross-entropy between the predicted next-token distribution and the real next token, usually on the answer tokens only. With accumulation the loss is divided by the number of micro-batches, so the summed gradient is an average.',
    knobs: ['accum'] },
  { id: 'backward', n: 'Backward pass', s: 'Which way should each parameter move? (the gradients)',
    d: 'loss.backward() sends gradients back through the frozen, de-quantised base into A and B only. The base gets no gradient at all. With accumulation, gradients from several micro-batches add up before anything moves.',
    knobs: ['target', 'r', 'accum'] },
  { id: 'optimize', n: 'Optimization', s: 'Update the parameters a tiny step, to do better next time',
    d: 'optimizer.step() moves A and B by an amount set by the learning rate (and the schedule), using Adam\'s running averages. &alpha;/r then sets how loudly that change is heard. Then zero the gradients and go again, for as many epochs as you asked.',
    knobs: ['lr', 'optim', 'alpha', 'epochs'] }
];

const API = { MODELS, MODULES, QUANT, OPTIM, KNOBS, STEPS, DEFAULT, SCENARIOS, WARMUP,
              gb, params, loraCount, baseBytes, compute, lrAt, review, pyCode };
if (typeof window !== 'undefined') window.QLORA = API;

/* ================= DOM: only in the browser ================= */
const doc = typeof document !== 'undefined' ? document : null;
if (!doc || !doc.getElementById('qk-controls')) return;
const $ = id => doc.getElementById(id);

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

let cfg = Object.assign({}, DEFAULT, { targets: DEFAULT.targets.slice() });

function sel(key, label, knob, opts) {
  return '<label class="qk-ctl" data-knob="' + knob + '"><span>' + label + '</span><select data-k="' + key + '">' +
    opts.map(o => '<option value="' + o[0] + '"' + (String(cfg[key]) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
    '</select></label>';
}

function renderControls() {
  const lrTxt = v => v.toExponential(0);
  $('qk-controls').innerHTML =
    '<div class="qk-set"><div class="qk-set-h">The model and the data</div>' +
      sel('model', 'model', '', MODELS.map(m => [m.id, m.n])) +
      sel('n', 'training examples', '', [300, 1000, 5000, 20000, 100000].map(v => [v, v.toLocaleString('en-US')])) +
    '</div>' +
    '<div class="qk-set"><div class="qk-set-h">Five QLoRA knobs</div>' +
      '<div class="qk-ctl" data-knob="target"><span>target modules</span><div class="qk-chips">' +
        MODULES.map(x => '<button class="chip' + (cfg.targets.indexOf(x.id) >= 0 ? ' active' : '') + '" data-t="' + x.id + '">' + x.id + '</button>').join('') +
      '</div></div>' +
      sel('r', 'r (rank)', 'r', RANKS.map(v => [v, v])) +
      sel('alpha', 'lora_alpha', 'alpha', ALPHAS.map(v => [v, v])) +
      sel('quant', 'quantization', 'quant', QUANT.map(q => [q.id, q.n])) +
      sel('dropout', 'lora_dropout', 'dropout', DROPOUTS.map(v => [v, v])) +
    '</div>' +
    '<div class="qk-set"><div class="qk-set-h">Five training knobs</div>' +
      sel('epochs', 'epochs', 'epochs', [1, 2, 3, 4, 5, 10].map(v => [v, v])) +
      sel('batch', 'per-device batch size', 'batch', BATCHES.map(v => [v, v])) +
      sel('lr', 'learning rate', 'lr', LRS.map(v => [v, lrTxt(v)])) +
      sel('accum', 'gradient accumulation', 'accum', ACCUMS.map(v => [v, v])) +
      sel('optim', 'optimizer', 'optim', OPTIM.map(o => [o.id, o.id])) +
    '</div>';
}

function renderOut() {
  const R = compute(cfg);
  $('qk-stats').innerHTML = [
    [fmt(R.lora), 'trainable params', ''],
    [R.pct.toFixed(2) + '%', 'of ' + fmt(R.P.total), 'good'],
    [gb(R.base), 'frozen base weights', ''],
    [gb(R.adapterTrain), 'adapter + grads + optimizer', ''],
    [String(R.scale), 'adapter scale &alpha;/r', R.scale > 4 || R.scale < 0.5 ? 'bad' : ''],
    [String(R.effBatch), 'effective batch', R.effBatch < 8 ? 'bad' : ''],
    [R.steps.toLocaleString('en-US'), 'optimizer steps', R.steps < 50 ? 'bad' : '']
  ].map(s => '<div class="stat"><div class="stat-v ' + s[2] + '">' + s[0] + '</div><div class="stat-k">' + s[1] + '</div></div>').join('');

  const lvlTxt = { bad: 'will not work', warn: 'check this', info: 'worth knowing', ok: 'looks right' };
  $('qk-review').innerHTML = review(cfg).map(x =>
    '<div class="qk-rv qk-' + x.lvl + '"><span>' + lvlTxt[x.lvl] + '</span>' + x.t + '</div>').join('');

  /* learning-rate schedule */
  const W = 520, H = 120, pad = 26, N = Math.max(R.steps, 2), peak = cfg.lr;
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const s = Math.round(i / 120 * N);
    pts.push((pad + (W - 2 * pad) * s / N).toFixed(1) + ',' + (H - pad - (H - 2 * pad) * lrAt(cfg, s, N) / peak).toFixed(1));
  }
  const wx = pad + (W - 2 * pad) * R.warmup / N;
  $('qk-curve').innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" class="qk-svg" role="img" aria-label="Learning rate schedule">' +
    '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" class="qk-axis"/>' +
    '<line x1="' + wx.toFixed(1) + '" y1="' + pad + '" x2="' + wx.toFixed(1) + '" y2="' + (H - pad) + '" class="qk-warm"/>' +
    '<polyline points="' + pts.join(' ') + '" class="qk-line"/>' +
    '<text x="' + pad + '" y="' + (pad - 8) + '" class="qk-lbl">peak ' + peak.toExponential(0) + '</text>' +
    '<text x="' + (wx + 6).toFixed(1) + '" y="' + (H - pad - 6) + '" class="qk-lbl">warmup ' + R.warmup + ' steps</text>' +
    '<text x="' + (W - pad) + '" y="' + (H - 8) + '" class="qk-lbl" text-anchor="end">step ' + R.steps.toLocaleString('en-US') + '</text>' +
    '<text x="' + pad + '" y="' + (H - 8) + '" class="qk-lbl">0</text></svg>';

  $('qk-code').innerHTML = esc(pyCode(cfg));
  $('qk-scen').querySelectorAll('[data-s]').forEach(b => b.classList.remove('active'));
}

function renderSteps() {
  const name = id => KNOBS.filter(k => k.id === id)[0].n;
  $('qk-steps').innerHTML = STEPS.map((s, i) =>
    '<div class="qk-step" data-step="' + s.id + '"><div class="qk-step-n">' + (i + 1) + '</div>' +
    '<b>' + s.n + '</b><div class="qk-step-s">' + s.s + '</div>' +
    '<div class="qk-step-d">' + s.d + '</div>' +
    '<div class="qk-step-k">' + s.knobs.map(k => '<span data-knob="' + k + '">' + name(k) + '</span>').join('') + '</div></div>'
  ).join('<div class="qk-step-arrow" aria-hidden="true">&rarr;</div>') +
  '<div class="qk-step-loop">&#8634; zero the gradients and repeat for every micro-batch, for every epoch. The goal is not a low training loss; it is a model that <b>generalises</b> to data it never saw, which is why you watch eval loss.</div>';
}

function renderKnobs() {
  const card = k => '<div class="knob qk-knob" id="qk-k-' + k.id + '"><b>' + k.n + ' <code>' + k.arg + '</code></b>' +
    '<div class="knob-lay"><span>plain English</span>' + k.lay + '</div>' +
    '<div class="knob-tech"><span>technically</span>' + k.tech + '</div>' +
    '<div class="knob-when"><span>typical</span>' + k.typical + '</div>' +
    '<div class="knob-when"><span>turn it when</span>' + k.when + '</div></div>';
  $('qk-knobs').innerHTML =
    '<h4 class="qk-grp">The five QLoRA knobs: what gets trained, and how the base is stored</h4>' +
    '<div class="knob-grid">' + KNOBS.filter(k => k.grp === 'qlora').map(card).join('') + '</div>' +
    '<h4 class="qk-grp">The five training knobs: how the run goes</h4>' +
    '<div class="knob-grid">' + KNOBS.filter(k => k.grp === 'train').map(card).join('') + '</div>';
}

$('qk-scen').innerHTML = SCENARIOS.map(s => '<button class="chip" data-s="' + s.id + '">' + s.n + '</button>').join('');
$('qk-scen').addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  const s = SCENARIOS.filter(x => x.id === b.dataset.s)[0];
  cfg = Object.assign({}, DEFAULT, { targets: DEFAULT.targets.slice() }, s.cfg);
  renderControls(); renderOut();
  b.classList.add('active');
  if (typeof window.xp === 'function') window.xp(2);
});
$('qk-controls').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  cfg[k] = /^(model|quant|optim)$/.test(k) ? e.target.value : +e.target.value;
  renderOut();
});
$('qk-controls').addEventListener('click', e => {
  const c = e.target.closest('[data-t]'); if (!c) return;
  const t = c.dataset.t, i = cfg.targets.indexOf(t);
  if (i >= 0) { if (cfg.targets.length > 1) cfg.targets.splice(i, 1); }
  else cfg.targets = ALL7.filter(x => x === t || cfg.targets.indexOf(x) >= 0);
  c.classList.toggle('active', cfg.targets.indexOf(t) >= 0);
  renderOut();
});
/* hovering a control, or a knob tag on a training step, lights up the card that explains it */
['qk-controls', 'qk-steps'].forEach(host => {
  $(host).addEventListener('mouseover', e => {
    const c = e.target.closest('[data-knob]');
    doc.querySelectorAll('.qk-knob').forEach(k => k.classList.toggle('lit', !!c && k.id === 'qk-k-' + c.dataset.knob));
  });
  $(host).addEventListener('mouseleave', () => doc.querySelectorAll('.qk-knob').forEach(k => k.classList.remove('lit')));
});
$('qk-steps').addEventListener('click', e => {
  const t = e.target.closest('[data-knob]'); if (!t) return;
  const card = $('qk-k-' + t.dataset.knob);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

renderSteps(); renderControls(); renderKnobs(); renderOut();
})();
