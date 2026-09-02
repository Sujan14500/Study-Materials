/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: backpropagation ---------- */
C.toolstrips.backprop = {
  title: 'Tools & frameworks — automatic differentiation',
  sub: 'Nobody derives gradients by hand any more. What you are expected to know is what the framework is doing on your behalf, and where it can go wrong.',
  tools: [
    { n: 'PyTorch autograd', by: 'Meta / PyTorch', mark: '🔥', c: '#ee4c2c',
      what: 'Builds the computation graph as your Python runs, then walks it backwards on loss.backward().',
      pro: ['Define-by-run, so the graph can change every batch', 'Debuggable with an ordinary breakpoint', 'The research default, so papers ship in it'],
      con: ['Forgetting optimizer.zero_grad() silently accumulates gradients', 'Retaining tensors in a list leaks the whole graph and the memory'],
      use: 'Almost everything. It is the default in research and increasingly in production.' },
    { n: 'TensorFlow / Keras', by: 'Google', mark: 'tf', c: '#ff6f00',
      what: 'GradientTape for autodiff, with Keras as the high-level model API on top.',
      pro: ['Keras is the fastest path from idea to trained model', 'Mature deployment story: TF Serving, TFLite, TF.js', 'Static graphs optimise well for inference'],
      con: ['Two APIs and a large version history to navigate', 'Lost most research mindshare to PyTorch'],
      use: 'Existing TensorFlow estates, mobile deployment, or Keras for teaching.' },
    { n: 'JAX', by: 'Google', mark: 'jx', c: '#5e97f6',
      what: 'Composable function transforms: grad, jit, vmap, pmap, over NumPy-shaped code.',
      pro: ['grad of grad of grad just works', 'vmap removes hand-written batching entirely', 'XLA compilation is very fast on TPU and GPU'],
      con: ['Functional purity is a real constraint — no in-place state', 'Smaller ecosystem and steeper curve'],
      use: 'Research needing higher-order gradients, or TPU-scale training.' },
    { n: 'torch.autograd.gradcheck', by: 'PyTorch', mark: '✓', c: '#ee4c2c',
      what: 'Compares your analytic gradient against a numerical one and fails if they disagree.',
      pro: ['Catches a wrong custom backward immediately', 'The standard proof that a custom layer is correct', 'A few lines to add'],
      con: ['Slow, so double precision and tiny inputs only', 'Only useful for custom autograd functions'],
      use: 'Any time you write a backward pass by hand.' }
  ]
};

/* ---------- Ch: training ---------- */
C.toolstrips.training = {
  title: 'Tools & frameworks — running the training loop',
  sub: 'The loop itself is ten lines. Everything here exists to handle the parts that are not: multiple GPUs, mixed precision, checkpoints and knowing what happened.',
  tools: [
    { n: 'PyTorch Lightning', by: 'Lightning AI', mark: '⚡', c: '#792ee5',
      what: 'Separates the science (your model) from the engineering (devices, precision, checkpoints, logging).',
      pro: ['Multi-GPU and mixed precision by changing a flag', 'Checkpointing, early stopping and logging built in', 'Removes the boilerplate people copy wrongly'],
      con: ['Another abstraction between you and the loop', 'Hook order takes time to learn'],
      use: 'Any training run that outgrows a single script on a single GPU.' },
    { n: 'accelerate', by: 'Hugging Face', mark: '🤗', c: '#ff9d00',
      what: 'Keeps your explicit loop but makes it run on CPU, one GPU, many GPUs or TPU unchanged.',
      pro: ['You keep the loop, so nothing is hidden', 'Four lines to add to an existing script', 'Wraps DeepSpeed and FSDP without their configuration'],
      con: ['Less structure than Lightning, so more discipline needed', 'You still write checkpointing yourself'],
      use: 'You want distribution without giving up control of the loop.' },
    { n: 'Optimizers: AdamW', by: 'Loshchilov & Hutter', mark: 'Aw', c: '#7c5cff',
      what: 'Adam with weight decay applied correctly, decoupled from the gradient update.',
      pro: ['The sane default for almost every modern network', 'Robust to a badly chosen learning rate', 'Decoupled decay actually regularises, unlike Adam plus L2'],
      con: ['Two extra state tensors per parameter, so more memory', 'SGD with momentum still generalises better on some vision tasks'],
      use: 'Your default. Change it only when you have a measured reason.' },
    { n: 'LR schedulers', by: 'PyTorch', mark: '📉', c: '#22d3ee',
      what: 'Warmup then cosine decay — the schedule almost every modern result actually used.',
      pro: ['Warmup prevents the early divergence that wastes a whole run', 'Cosine decay reliably squeezes out the last few points', 'A few lines and no tuning in most cases'],
      con: ['Total steps must be known up front for cosine', 'Interacts with batch size, so it is not transferable blindly'],
      use: 'Every non-trivial training run. A flat learning rate leaves accuracy on the table.' },
    { n: 'AMP / bf16', by: 'PyTorch', mark: '½', c: '#34d399',
      what: 'Mixed precision: compute in 16-bit, keep master weights in 32-bit, and roughly double throughput.',
      pro: ['Large speed and memory gains for a two-line change', 'bfloat16 needs no loss scaling on modern hardware', 'Lets a bigger batch fit on the same card'],
      con: ['fp16 without loss scaling produces silent NaNs', 'Some operations must stay in fp32'],
      use: 'Any GPU training on modern hardware. Leaving it off wastes half the card.' }
  ]
};

/* ---------- Ch: in practice ---------- */
C.toolstrips.practice = {
  title: 'Tools & frameworks — deep learning in practice',
  sub: 'The honest sequence: do not train from scratch, fine-tune something. These are the tools that make that the default rather than the ambition.',
  tools: [
    { n: 'transformers', by: 'Hugging Face', mark: '🤗', c: '#ff9d00',
      what: 'Pretrained models and a uniform API across text, vision and audio, with the Trainer to fine-tune them.',
      pro: ['Thousands of pretrained checkpoints, one API', 'Trainer covers most fine-tuning without a custom loop', 'Pipelines give a working baseline in three lines'],
      con: ['A large dependency with fast-moving APIs', 'Easy to use a model without understanding its preprocessing'],
      use: 'Almost any modern task. Start from a checkpoint, not from random weights.' },
    { n: 'timm', by: 'Ross Wightman / HF', mark: 'tm', c: '#f472b6',
      what: 'Nearly every image model architecture with pretrained weights and a consistent interface.',
      pro: ['Swap architecture with a string, keep everything else', 'Well-tested augmentation and training recipes', 'Benchmarks let you pick on accuracy-per-FLOP'],
      con: ['Vision only', 'The sheer number of variants is its own decision problem'],
      use: 'Any image task. It is the vision equivalent of the model hub.' },
    { n: 'TensorBoard', by: 'Google', mark: '📊', c: '#ff6f00',
      what: 'Loss curves, histograms, embeddings and the graph, written from any framework.',
      pro: ['Free, local, no account, works with PyTorch too', 'Gradient histograms make vanishing and exploding visible', 'Embedding projector for representation sanity checks'],
      con: ['Comparing dozens of runs gets unwieldy', 'No experiment metadata beyond what you log'],
      use: 'Every run. Training without watching the curves is guessing.' },
    { n: 'ONNX Runtime', by: 'Microsoft / LF AI', mark: 'ox', c: '#0f62fe',
      what: 'Export the trained network to a portable graph and run it without the training framework.',
      pro: ['Drops Python and the framework from the serving path', 'Faster inference through graph optimisation', 'Runs on CPU, mobile and browsers'],
      con: ['Not every operator converts cleanly', 'Preprocessing must be exported too or results skew'],
      use: 'Deploying a trained network anywhere that should not carry a training framework.' },
    { n: 'PEFT', by: 'Hugging Face', mark: 'pf', c: '#7c5cff',
      what: 'LoRA and friends: freeze the pretrained network, train a few million new parameters instead.',
      pro: ['Fine-tunes large models on one consumer GPU', 'Adapters are a few MB, so you can ship dozens', 'Merges back into base weights for deployment'],
      con: ['Rank, alpha and target modules need care', 'A small accuracy gap to full fine-tuning on some tasks'],
      use: 'Adapting a large pretrained model without the compute to retrain it.' }
  ]
};
