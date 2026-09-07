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

/* ---------- Ch: PyTorch ---------- */
C.toolstrips.pytorch = {
  title: 'Tools & frameworks — the ring around PyTorch',
  sub: 'PyTorch itself is one library. What people mean by "the PyTorch stack" is this ring of things that remove the boilerplate around it — and each one takes some control away in exchange.',
  tools: [
    { n: 'PyTorch Lightning', by: 'Lightning AI', mark: '⚡', c: '#792ee5',
      what: 'Takes the training loop, the device handling and the multi-GPU plumbing, and leaves you the model and the step.',
      pro: ['The loop, checkpointing, logging and distributed training stop being your code', 'Same PyTorch underneath, so you can drop back down anywhere', 'Makes multi-GPU a flag rather than a rewrite'],
      con: ['One more abstraction to debug through when something is wrong', 'The hooks and their order are their own thing to learn'],
      use: 'Any project past the notebook stage where you would otherwise copy the same loop for the fourth time.' },
    { n: 'Hugging Face Transformers', by: 'Hugging Face', mark: '🤗', c: '#ffd21e',
      what: 'Pretrained models and tokenizers with a common API, plus a Trainer that owns the loop.',
      pro: ['A pretrained model beats training from scratch on almost every real task', 'One API across thousands of architectures', 'Accelerate handles devices and distribution without a rewrite'],
      con: ['Very large surface area — the Trainer has dozens of arguments that change training silently', 'Easy to fine-tune something you do not understand'],
      use: 'Anything involving text, and increasingly vision and audio. Start here before you build a model.' },
    { n: 'torch.compile', by: 'PyTorch', mark: '⚙️', c: '#ee4c2c',
      what: 'One line that traces your model and compiles fused kernels for it, often for a substantial speedup.',
      pro: ['Frequently a large speedup for a single line of code', 'No change to how you write the model', 'Works with the rest of the ecosystem'],
      con: ['Compilation itself takes time, and recompiles when shapes change', 'Graph breaks on dynamic Python silently give you back the slow path'],
      use: 'Once training works and is correct. Never as a fix for a model that does not learn.' },
    { n: 'TensorBoard / Weights & Biases', by: 'Google / W&B', mark: '📈', c: '#fbbf24',
      what: 'Experiment tracking: loss curves, hyperparameters, gradients and artefacts, per run.',
      pro: ['A loss curve you can compare across runs is the single best debugging tool here', 'Records the hyperparameters you will otherwise forget', 'Gradient and weight histograms make chapter 9 visible on your own model'],
      con: ['W&B is a hosted service — check where the data goes before enterprise use', 'Easy to log so much that nothing is readable'],
      use: 'From the second experiment onwards. The first one you can watch in the terminal.' },
    { n: 'torchvision / torchaudio / datasets', by: 'PyTorch / Hugging Face', mark: '📦', c: '#34d399',
      what: 'Datasets, standard transforms and pretrained backbones, so data loading is not written from scratch.',
      pro: ['Standard augmentations that are already correct', 'Pretrained backbones one line away', 'DataLoader gives you batching, shuffling and worker parallelism free'],
      con: ['num_workers and pinned memory need tuning per machine, and the defaults are rarely right', 'Transform pipelines are a common silent source of train/test skew'],
      use: 'Any vision or audio task, and as the reference for how a Dataset should be shaped.' },
    { n: 'ONNX / TorchScript / ExecuTorch', by: 'PyTorch / ONNX', mark: '🚚', c: '#60a5fa',
      what: 'Export formats that take a trained model out of Python and into a serving runtime or a device.',
      pro: ['Runs without Python, which most production and mobile targets require', 'ONNX Runtime is often faster than eager PyTorch for inference', 'Export forces you to pin the shapes and the preprocessing'],
      con: ['Dynamic control flow in forward() frequently does not export cleanly', 'Numerical differences after export are real and need a comparison test'],
      use: 'At deployment. Always diff the exported model against the original on a fixed batch before trusting it.' }
  ]
};
