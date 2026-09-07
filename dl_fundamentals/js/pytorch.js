/* ============================================================
   pytorch.js — chapter 12: the framework, after eleven chapters
   of doing it by hand.

   Five self-mounting widgets:
     #pt-tensor    shapes and broadcasting, with the real rules
     #pt-autograd  a real scalar autograd graph, forward then backward
     #pt-map       the same network by hand and in PyTorch, line by line
     #pt-loop      the five-line training loop, and what each line costs
     #pt-bugs      eight errors you will actually see, with the message

   Everything numeric on the page is computed here, not typed. The
   autograd engine below is about forty lines and is the same
   reverse-mode differentiation the course derived in chapter 5 —
   test.js checks its gradients against numerical differentiation,
   which is the only reason the page is allowed to claim them.
   ============================================================ */
(function () {
'use strict';

/* ============================================================
   1. a scalar autograd engine
   Node = value + gradient + how it was made. torch.Tensor is this
   with n dimensions, a device, a dtype and twenty years of kernels.
   ============================================================ */
function V(data, prev, op, label) {
  return { data, grad: 0, prev: prev || [], op: op || '', label: label || '', _back() {} };
}
function add(a, b, label) {
  const o = V(a.data + b.data, [a, b], '+', label);
  o._back = () => { a.grad += o.grad; b.grad += o.grad; };
  return o;
}
function mul(a, b, label) {
  const o = V(a.data * b.data, [a, b], '×', label);
  o._back = () => { a.grad += b.data * o.grad; b.grad += a.data * o.grad; };
  return o;
}
function tanh(a, label) {
  const t = Math.tanh(a.data);
  const o = V(t, [a], 'tanh', label);
  o._back = () => { a.grad += (1 - t * t) * o.grad; };
  return o;
}
/* reverse topological order — a node is only ready once everything
   that consumes it has already pushed its gradient back */
function topo(root) {
  const out = [], seen = new Set();
  (function walk(n) {
    if (seen.has(n)) return;
    seen.add(n);
    n.prev.forEach(walk);
    out.push(n);
  })(root);
  return out.reverse();
}
function backward(root) {
  root.grad = 1;                       // d(root)/d(root) = 1. This is what loss.backward() seeds.
  topo(root).forEach(n => n._back());
}

/* the graph the widget draws: one neuron, tanh activation.
   Chosen because every gradient comes out a round number, so the
   arithmetic on screen can be checked by eye as well as by test. */
function neuron() {
  const x1 = V(2, [], '', 'x1'), w1 = V(-3, [], '', 'w1');
  const x2 = V(0, [], '', 'x2'), w2 = V(1, [], '', 'w2');
  const b  = V(6.8813735870195432, [], '', 'b');
  const x1w1 = mul(x1, w1, 'x1·w1');
  const x2w2 = mul(x2, w2, 'x2·w2');
  const sum  = add(x1w1, x2w2, 'x1w1 + x2w2');
  const n    = add(sum, b, 'n');
  const o    = tanh(n, 'o');
  return { x1, w1, x2, w2, b, x1w1, x2w2, sum, n, o,
           all: [x1, w1, x2, w2, b, x1w1, x2w2, sum, n, o] };
}

/* Run the backward pass one node at a time, recording a snapshot after
   each, so the animation replays real gradients instead of narrating
   remembered ones. */
function backwardFrames() {
  const g = neuron();
  const order = topo(g.o).filter(n => n.op || n === g.o);
  const frames = [{ lit: [g.o.label], say:
    'Seed. <b>loss.backward()</b> sets <span class="mono">o.grad = 1</span> — the derivative of the output ' +
    'with respect to itself. Every other gradient on the page is the chain rule applied from here.',
    snap: snap(g) }];
  g.o.grad = 1;
  order.forEach(n => {
    n._back();
    frames.push({ lit: [n.label].concat(n.prev.map(p => p.label)), say: explain(n), snap: snap(g) });
  });
  return { graph: g, frames };
}
function snap(g) {
  const s = {};
  g.all.forEach(n => s[n.label] = { data: n.data, grad: n.grad });
  return s;
}
function explain(n) {
  const f = v => (Math.round(v * 1000) / 1000);
  if (n.op === 'tanh')
    return 'Through <b>tanh</b>. Local derivative is <span class="mono">1 − o² = ' + f(1 - n.data * n.data) +
      '</span>, so <span class="mono">n.grad = ' + f(1 - n.data * n.data) + ' × 1 = ' + f(n.prev[0].grad) +
      '</span>. This single number is the whole reason saturated activations kill training — chapter 9.';
  if (n.op === '+')
    return 'Through <b>+</b>. Addition routes the gradient unchanged to both inputs: each parent gets ' +
      '<span class="mono">' + f(n.grad) + '</span>. A plus node is a gradient splitter, nothing more.';
  if (n.op === '×')
    return 'Through <b>×</b>. Each input gets the gradient times <i>the other</i> input: ' +
      '<span class="mono">' + n.prev[0].label + '.grad += ' + f(n.prev[1].data) + ' × ' + f(n.grad) +
      '</span>. That swap is why a zero input freezes its own weight — look at x2 and w2.';
  return 'Leaf reached.';
}

/* ============================================================
   2. broadcasting, by the actual rule
   Align shapes from the right; each pair must be equal or one of
   them must be 1. Nothing else is allowed, and the error message
   below is the one PyTorch prints.
   ============================================================ */
function broadcast(a, b) {
  const n = Math.max(a.length, b.length);
  const pa = Array(n - a.length).fill(1).concat(a);
  const pb = Array(n - b.length).fill(1).concat(b);
  const out = [], rows = [];
  for (let i = 0; i < n; i++) {
    const x = pa[i], y = pb[i];
    if (x === y)      { out.push(x); rows.push({ a: x, b: y, r: x, how: 'equal' }); }
    else if (x === 1) { out.push(y); rows.push({ a: x, b: y, r: y, how: 'stretch a' }); }
    else if (y === 1) { out.push(x); rows.push({ a: x, b: y, r: x, how: 'stretch b' }); }
    else return { ok: false, pa, pb, rows, dim: i,
      error: 'RuntimeError: The size of tensor a (' + x + ') must match the size of tensor b (' + y +
             ') at non-singleton dimension ' + i };
  }
  return { ok: true, pa, pb, rows, shape: out };
}

const SHAPES = [
  { n: 'batch + bias', a: [32, 128], b: [128] },
  { n: 'image + per-channel mean', a: [8, 3, 64, 64], b: [3, 1, 1] },
  { n: 'attention scores + mask', a: [4, 8, 512, 512], b: [1, 1, 512, 512] },
  { n: 'column vector × row vector', a: [512, 1], b: [1, 256] },
  { n: 'the one that fails', a: [32, 3], b: [32, 4] },
  { n: 'the one that silently does not', a: [64, 1], b: [64] }
];

/* ============================================================
   3. the same network, by hand and in PyTorch
   Left column is this course, chapters 4 to 6, in Python. Right
   column is what those lines become. `note` is why the swap is
   worth making — or, twice, why you should still know the left.
   ============================================================ */
const MAP = [
  { hand: 'W1 = randn(2, 4) * sqrt(2/2)\nb1 = zeros(4)',
    torch: 'self.l1 = nn.Linear(2, 4)',
    note: 'A Linear layer is a weight matrix, a bias vector and He initialisation, already done. Chapter 8 explained why the <span class="mono">sqrt(2/fan_in)</span> matters; nn.Linear is where that lives now.' },
  { hand: 'h = relu(x @ W1 + b1)',
    torch: 'h = F.relu(self.l1(x))',
    note: 'Identical arithmetic. <span class="mono">@</span> is a matmul in both; the framework version dispatches to a tuned kernel and, on a GPU, to a different one entirely.' },
  { hand: 'p = sigmoid(h @ W2 + b2)',
    torch: 'p = torch.sigmoid(self.l2(h))',
    note: 'In real code you would keep the raw logits and use <span class="mono">BCEWithLogitsLoss</span>, which fuses sigmoid and the loss for numerical stability. Doing them separately is the first thing to blame for a NaN.' },
  { hand: 'loss = -(y*log(p) + (1-y)*log(1-p)).mean()',
    torch: 'loss = F.binary_cross_entropy(p, y)',
    note: 'The same formula from chapter 5, with the epsilon clamping already handled. Yours would have produced <span class="mono">log(0)</span> eventually; theirs does not.' },
  { hand: 'dz2 = (p - y) / n\ndW2 = h.T @ dz2\ndb2 = dz2.sum(0)\ndh  = dz2 @ W2.T\ndz1 = dh * (h > 0)\ndW1 = x.T @ dz1\ndb1 = dz1.sum(0)',
    torch: 'loss.backward()',
    note: 'This is the trade. Seven lines you derived by hand — and would have to re-derive for every architecture change — become one line, because the graph recorded what happened on the way forward. That is the whole value proposition of a framework, and it is why chapter 5 is worth having done first: you now know what that line does.' },
  { hand: 'W1 -= lr * dW1\nb1 -= lr * db1\nW2 -= lr * dW2\nb2 -= lr * db2',
    torch: 'opt.step()',
    note: 'And swapping SGD for Adam is now a one-word change instead of a rewrite — <span class="mono">optim.Adam(model.parameters(), lr=1e-3)</span>. Chapter 6 showed why that changes the path down the surface.' },
  { hand: 'dW1 = dW2 = db1 = db2 = 0',
    torch: 'opt.zero_grad()',
    note: 'The line everyone forgets. By hand you overwrote the gradients; PyTorch <i>accumulates</i> them, so skipping this silently sums every step you have ever taken. Watch it happen in the next panel.' }
];

/* ============================================================
   4. the five-line loop
   ============================================================ */
const LOOP = [
  { n: 'opt.zero_grad()', ico: '🧹', c: '#fb7185',
    does: 'Sets <span class="mono">.grad</span> to zero on every parameter the optimiser owns.',
    skip: 'Gradients accumulate instead of being replaced. The effective step grows every iteration, the loss looks unstable rather than wrong, and nothing errors.',
    why: 'Accumulation is a feature, not a bug: it is how you simulate a batch size larger than your GPU. Call backward() four times, step once, and you have a batch of 4× the memory you own.' },
  { n: 'out = model(x)', ico: '➡️', c: '#60a5fa',
    does: 'The forward pass — chapter 4 — and, at the same time, recording the graph that makes the backward pass possible.',
    skip: 'There is no graph, so there is nothing to differentiate — and if you run the forward pass under <span class="mono">torch.no_grad()</span> by accident, you get exactly that: a loss that computes fine and a backward pass that raises <span class="mono">element 0 of tensors does not require grad</span>.',
    why: 'Call the module, never <span class="mono">model.forward(x)</span>. The <span class="mono">__call__</span> path also runs the hooks, which is where profilers, quantisation and half of the debugging tools attach.' },
  { n: 'loss = crit(out, y)', ico: '📏', c: '#fbbf24',
    does: 'Reduces the whole batch to one scalar, because you can only differentiate a scalar.',
    skip: 'backward() on a non-scalar raises <span class="mono">grad can be implicitly created only for scalar outputs</span>.',
    why: 'The reduction matters: <span class="mono">mean</span> makes the gradient scale independent of batch size, <span class="mono">sum</span> does not. Change it and your learning rate silently changes with it.' },
  { n: 'loss.backward()', ico: '⬅️', c: '#a78bfa',
    does: 'Walks the recorded graph in reverse topological order and fills in <span class="mono">.grad</span> — the panel above, at scale.',
    skip: 'Every gradient stays zero, the optimiser steps nowhere, and the loss curve is a flat line.',
    why: 'The graph is freed as it is traversed. Calling backward() twice on the same graph raises <span class="mono">Trying to backward through the graph a second time</span> — retain_graph=True is usually the wrong fix for the right symptom.' },
  { n: 'opt.step()', ico: '👣', c: '#34d399',
    does: 'Applies the update rule — chapter 6 — to every parameter using the gradients that are sitting there now.',
    skip: 'Gradients are computed and then thrown away on the next zero_grad(). No parameter changes, the loss curve is perfectly flat, and everything looks like it is running — this is the failure mode that gets misread as "the model cannot learn this task".',
    why: 'It uses whatever is in <span class="mono">.grad</span>, with no idea when it got there. That is exactly why a missing zero_grad() is invisible to it.' }
];

/* what a forgotten zero_grad() actually does, computed rather than asserted:
   the same batch, backward called k times, parameters untouched */
function accumulation(k) {
  const rows = [];
  const g = neuron();
  for (let i = 1; i <= k; i++) {
    /* PyTorch keeps .grad only on leaves — the tensors an optimiser owns. Every
       intermediate node gets a fresh gradient on each backward pass, so clear
       them here to match. Leaving them to accumulate too would compound (1, 5,
       15…) and would be a bug in this model, not in PyTorch. */
    g.all.forEach(n => { if (n.prev.length) n.grad = 0; });
    backward(g.o);          // and the leaves are never zeroed — that is the bug, reproduced
    rows.push({ pass: i, w1: g.w1.grad, x1: g.x1.grad });
  }
  return rows;
}

/* ============================================================
   5. eight errors you will actually meet
   ============================================================ */
const BUGS = [
  { id: 'shape', n: 'Shape mismatch in a matmul', ico: '📐',
    msg: 'RuntimeError: mat1 and mat2 shapes cannot be multiplied (32x128 and 64x10)',
    cause: 'The layer expects an input width that the tensor does not have — nearly always because a flatten, a transpose or a batch dimension is missing.',
    fix: 'Print <span class="mono">x.shape</span> at the top of forward(). Read the two numbers in the message as (rows × <b>k</b>) and (<b>k</b> × cols): the two ks must match, and the one that is wrong tells you which side to fix.' },
  { id: 'dtype', n: 'Wrong dtype', ico: '🔢',
    msg: 'RuntimeError: expected scalar type Long but found Float',
    cause: 'Class indices for cross-entropy must be int64; almost everything else must be float32. NumPy hands you float64, which is a third thing.',
    fix: '<span class="mono">y.long()</span> for targets, <span class="mono">x.float()</span> for inputs. Convert once at the dataset boundary rather than scattering casts through the model.' },
  { id: 'device', n: 'Tensors on different devices', ico: '🖥️',
    msg: 'RuntimeError: Expected all tensors to be on the same device, but found at least two devices, cuda:0 and cpu!',
    cause: 'The model was moved to the GPU and the batch was not — or a tensor created inside forward() defaulted to the CPU.',
    fix: 'Move both: <span class="mono">model.to(dev)</span> and <span class="mono">x = x.to(dev)</span>. Inside a module, create tensors with <span class="mono">torch.zeros_like(x)</span> or <span class="mono">device=x.device</span> so they follow the input.' },
  { id: 'twice', n: 'Backward twice', ico: '🔁',
    msg: 'RuntimeError: Trying to backward through the graph a second time',
    cause: 'The graph is freed during the backward pass. Reusing a loss tensor, or keeping a hidden state across iterations without detaching it, asks for a graph that no longer exists.',
    fix: '<span class="mono">h = h.detach()</span> between iterations for recurrent state. Reach for <span class="mono">retain_graph=True</span> only when you genuinely need two backward passes over one graph — otherwise it hides the real bug and leaks memory.' },
  { id: 'zerograd', n: 'Forgotten zero_grad()', ico: '🧹',
    msg: '(no error — this one is silent)',
    cause: 'Gradients accumulate across iterations, so the effective step grows without bound.',
    fix: 'Call <span class="mono">opt.zero_grad()</span> every iteration. The symptom is a loss that wobbles or diverges while the learning rate looks reasonable — the panel above shows the numbers doubling and tripling.' },
  { id: 'eval', n: 'Forgotten model.eval()', ico: '🎭',
    msg: '(no error — validation accuracy is just worse than it should be)',
    cause: 'Dropout keeps dropping and batch norm keeps updating its running statistics during validation.',
    fix: '<span class="mono">model.eval()</span> before validating, <span class="mono">model.train()</span> after. Wrap the loop in <span class="mono">torch.no_grad()</span> as well — that one is about memory and speed, and it is a different mistake.' },
  { id: 'grad', n: 'Building the graph you did not need', ico: '💾',
    msg: 'CUDA out of memory. Tried to allocate 2.00 GiB',
    cause: 'Accumulating losses in a Python list keeps every graph alive, and inference without no_grad() records a graph nobody will ever differentiate.',
    fix: '<span class="mono">total += loss.item()</span>, never <span class="mono">total += loss</span>. Wrap evaluation in <span class="mono">torch.no_grad()</span> or <span class="mono">torch.inference_mode()</span>. Then reduce the batch size.' },
  { id: 'inplace', n: 'In-place operation on something autograd needed', ico: '✂️',
    msg: 'RuntimeError: a leaf Variable that requires grad is being used in an in-place operation',
    cause: 'Modifying a tensor the backward pass still needs — a <span class="mono">+=</span> on a parameter, or a ReLU with inplace=True in the wrong place.',
    fix: 'Assign a new tensor instead of mutating, and wrap deliberate parameter surgery in <span class="mono">with torch.no_grad():</span>. The suffix in the message — <span class="mono">version 2; expected version 1</span> — is the version counter telling you exactly which tensor changed underneath it.' }
];

/* ============================================================
   6. what nn.Module actually is
   ============================================================ */
const MODULE = [
  ['Parameters', 'Tensors with <span class="mono">requires_grad=True</span> that the optimiser is allowed to change. Assigning <span class="mono">nn.Parameter</span> or a submodule registers them automatically — a plain list of tensors does not, which is why <span class="mono">nn.ModuleList</span> exists.'],
  ['Buffers', 'State that is saved and moved with the model but never trained: batch-norm running statistics, positional tables, masks. <span class="mono">register_buffer</span>.'],
  ['forward()', 'The only method you write. Call the module, not this — <span class="mono">model(x)</span> runs the hooks around it.'],
  ['train / eval', 'One boolean that changes what dropout and batch norm do. It changes nothing about gradients, which is the confusion worth clearing up.'],
  ['state_dict()', 'An ordered map of names to tensors. Save this, never the pickled model object — the object needs the exact class definition back, the dict does not.']
];

const CODE = {
  model:
`import torch, torch.nn as nn, torch.nn.functional as F

class Net(nn.Module):
    def __init__(self):
        super().__init__()                 # registers the machinery
        self.l1 = nn.Linear(2, 4)          # W (4x2) + b (4,), He-initialised
        self.l2 = nn.Linear(4, 1)

    def forward(self, x):                  # x: (batch, 2)
        h = F.relu(self.l1(x))             # (batch, 4)
        return self.l2(h)                  # logits, (batch, 1)

dev   = "cuda" if torch.cuda.is_available() else "cpu"
model = Net().to(dev)
crit  = nn.BCEWithLogitsLoss()             # fuses sigmoid + BCE, stable
opt   = torch.optim.Adam(model.parameters(), lr=1e-3)`,
  loop:
`for epoch in range(200):
    model.train()
    for x, y in loader:
        x, y = x.to(dev), y.to(dev)
        opt.zero_grad()                    # 1. clear last step's gradients
        out  = model(x)                    # 2. forward, recording the graph
        loss = crit(out, y)                # 3. one scalar
        loss.backward()                    # 4. fill every .grad
        opt.step()                         # 5. update the parameters

    model.eval()                           # dropout off, batchnorm frozen
    with torch.no_grad():                  # and do not build a graph
        val = sum(crit(model(x.to(dev)), y.to(dev)).item()
                  for x, y in val_loader) / len(val_loader)

torch.save(model.state_dict(), "net.pt")   # the dict, not the object`,
  autograd:
`x1 = torch.tensor([2.0],  requires_grad=True)
w1 = torch.tensor([-3.0], requires_grad=True)
x2 = torch.tensor([0.0],  requires_grad=True)
w2 = torch.tensor([1.0],  requires_grad=True)
b  = torch.tensor([6.8813735870195432], requires_grad=True)

n = x1*w1 + x2*w2 + b
o = torch.tanh(n)
o.backward()

w1.grad   # tensor([1.0000])  = x1 * (1 - o**2)
x1.grad   # tensor([-1.5000]) = w1 * (1 - o**2)
w2.grad   # tensor([0.])      <- x2 is zero, so this weight cannot learn`
};

if (typeof window !== 'undefined')
  window.PYTORCH = { V, add, mul, tanh, backward, topo, neuron, backwardFrames,
                     broadcast, SHAPES, MAP, LOOP, BUGS, MODULE, CODE, accumulation };

/* ============================================================
   rendering
   ============================================================ */
if (typeof document === 'undefined') return;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const f3 = v => String(Math.round(v * 1000) / 1000);

/* ---------- 1. shapes and broadcasting ---------- */
(function tensorWidget() {
  const root = $('pt-tensor');
  if (!root) return;
  let pick = 0;

  function paint() {
    const s = SHAPES[pick];
    const r = broadcast(s.a, s.b);
    const cells = (shape, cls) => shape.map(d =>
      '<span class="pt-dim ' + cls + '">' + d + '</span>').join('');

    root.innerHTML =
      '<div class="pt-chips">' + SHAPES.map((x, i) =>
        '<button class="pt-chip' + (i === pick ? ' on' : '') + '" data-i="' + i + '">' +
          esc(x.n) + '</button>').join('') + '</div>' +

      '<div class="pt-bc">' +
        '<div class="pt-bcrow"><b>a</b><code>' + JSON.stringify(s.a) + '</code>' +
          '<div class="pt-dims">' + cells(r.pa, 'a') + '</div></div>' +
        '<div class="pt-bcrow"><b>b</b><code>' + JSON.stringify(s.b) + '</code>' +
          '<div class="pt-dims">' + cells(r.pb, 'b') + '</div></div>' +
        '<div class="pt-bcrule">aligned from the <b>right</b> · each pair must be equal, or one of them must be 1</div>' +
        '<div class="pt-bcrow res"><b>=</b>' +
          (r.ok ? '<code>' + JSON.stringify(r.shape) + '</code><div class="pt-dims">' +
                    cells(r.shape, 'r') + '</div>'
                : '<code class="err">error at dim ' + r.dim + '</code>') +
        '</div>' +
      '</div>' +

      (r.ok
        ? '<div class="pt-rows">' + r.rows.map((x, i) =>
            '<div class="pt-r"><span class="mono">dim ' + i + '</span>' +
              '<span>' + x.a + ' vs ' + x.b + '</span>' +
              '<span class="pt-how' + (x.how === 'equal' ? '' : ' str') + '">' + x.how + '</span>' +
              '<span class="mono">→ ' + x.r + '</span></div>').join('') + '</div>'
        : '<pre class="code pt-err">' + esc(r.error) + '</pre>') +

      '<div class="pt-note">' + noteFor(s, r) + '</div>';

    root.querySelectorAll('.pt-chip').forEach(b =>
      b.onclick = () => { pick = +b.dataset.i; paint(); });
  }

  function noteFor(s, r) {
    if (!r.ok) return '<b>This is the good failure.</b> The shapes are incompatible and PyTorch says so ' +
      'immediately, with the dimension number. Every other case on this row list is a shape that ' +
      '<i>works</i> — and one of them should not.';
    if (s.n.indexOf('silently') >= 0) return '<b>This is the dangerous one.</b> <span class="mono">(64,1)</span> ' +
      'with <span class="mono">(64,)</span> aligns as <span class="mono">(64,1)</span> and ' +
      '<span class="mono">(1,64)</span>, so it broadcasts to <b>(64, 64)</b> — a 4,096-element tensor ' +
      'where you wanted 64. No error, a loss that is quietly the mean of the wrong thing, and hours ' +
      'lost. Fix it at the source with <span class="mono">y.view(-1, 1)</span> or ' +
      '<span class="mono">squeeze(-1)</span>, and assert your shapes.';
    return 'Broadcasting is what lets one bias vector serve a whole batch, one mask serve every attention ' +
      'head, and a per-channel mean serve every pixel — without materialising a single copy. The stretched ' +
      'dimensions are read with a stride of zero, so the memory cost of the stretch is nothing.';
  }
  paint();
})();

/* ---------- 2. autograd, watched ---------- */
(function autogradWidget() {
  const root = $('pt-autograd');
  if (!root) return;

  const { graph, frames } = backwardFrames();
  const POS = {
    x1: [20, 14], w1: [20, 86], x2: [20, 172], w2: [20, 244],
    'x1·w1': [190, 50], 'x2·w2': [190, 208], b: [190, 292],
    'x1w1 + x2w2': [360, 129], n: [520, 190], o: [680, 190]
  };
  const EDGES = [['x1', 'x1·w1'], ['w1', 'x1·w1'], ['x2', 'x2·w2'], ['w2', 'x2·w2'],
                 ['x1·w1', 'x1w1 + x2w2'], ['x2·w2', 'x1w1 + x2w2'],
                 ['x1w1 + x2w2', 'n'], ['b', 'n'], ['n', 'o']];
  const W = 148, H = 52;
  let at = 0;                       // 0 = forward only, then one per backward frame
  let timer = null;

  function paint() {
    const snapshot = at === 0 ? null : frames[at - 1].snap;
    const lit = at === 0 ? [] : frames[at - 1].lit;

    const node = (label) => {
      const [x, y] = POS[label];
      const v = snapshot ? snapshot[label] : { data: graph.all.find(n => n.label === label).data, grad: 0 };
      const on = lit.indexOf(label) >= 0;
      return '<g class="pt-node' + (on ? ' on' : '') + (v.grad ? ' has' : '') + '" ' +
        'transform="translate(' + x + ',' + y + ')">' +
        '<rect width="' + W + '" height="' + H + '" rx="10"/>' +
        '<text class="pt-nl" x="10" y="19">' + label + '</text>' +
        '<text class="pt-nv" x="10" y="38">data ' + f3(v.data) + '</text>' +
        '<text class="pt-ng" x="' + (W - 10) + '" y="38">grad ' + f3(v.grad) + '</text>' +
      '</g>';
    };
    const edge = ([a, b]) => {
      const [ax, ay] = POS[a], [bx, by] = POS[b];
      const x1 = ax + W, y1 = ay + H / 2, x2 = bx, y2 = by + H / 2;
      const on = lit.indexOf(a) >= 0 && lit.indexOf(b) >= 0;
      return '<path class="pt-edge' + (on ? ' on' : '') + (at ? ' back' : '') + '" d="M' + x1 + ' ' + y1 +
        ' C' + (x1 + 26) + ' ' + y1 + ',' + (x2 - 26) + ' ' + y2 + ',' + x2 + ' ' + y2 + '"/>';
    };

    root.innerHTML =
      '<div class="pt-agbar">' +
        '<button class="btn" id="pt-ag-play">' + (timer ? '⏸ Pause' : at === 0 ? '▶ Run backward()' : '▶ Continue') + '</button>' +
        '<button class="btn btn-ghost" id="pt-ag-step">Step →</button>' +
        '<button class="btn btn-ghost" id="pt-ag-reset">↺ Forward only</button>' +
        '<span class="pt-agat">' + (at === 0 ? 'forward pass complete · every grad is 0'
          : 'backward step ' + at + ' of ' + frames.length) + '</span>' +
      '</div>' +
      '<div class="pt-agwrap"><svg class="pt-svg" viewBox="0 0 840 360" ' +
        'aria-label="A scalar autograd graph, forward values then backward gradients">' +
        EDGES.map(edge).join('') + Object.keys(POS).map(node).join('') +
      '</svg></div>' +
      '<div class="pt-agsay">' + (at === 0
        ? '<b>Forward.</b> Every node holds a value and a note of how it was made — that record <i>is</i> ' +
          'the graph, built as a side effect of doing the arithmetic. Nothing has been differentiated yet, ' +
          'so every gradient is zero. Press run.'
        : frames[at - 1].say) + '</div>' +
      (at === frames.length ? '<div class="pt-agdone">' +
        '<b>Done, and check the two interesting ones.</b> <span class="mono">w2.grad = 0</span> because ' +
        'its input <span class="mono">x2</span> is zero — a weight multiplied by nothing cannot learn from ' +
        'this example. And <span class="mono">x1.grad = ' + f3(frames[frames.length - 1].snap.x1.grad) +
        '</span> is negative: pushing that input up pushes the output down. This is reverse-mode ' +
        'differentiation, and it costs one backward pass no matter how many parameters there are — ' +
        'which is the only reason training a billion-parameter model is possible at all.</div>' : '');

    $('pt-ag-play').onclick = () => timer ? stop() : start();
    $('pt-ag-step').onclick = () => { stop(); at = at >= frames.length ? 0 : at + 1; paint(); };
    $('pt-ag-reset').onclick = () => { stop(); at = 0; paint(); };
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; paint(); } }
  function start() {
    if (at >= frames.length) at = 0;
    timer = setInterval(() => {
      if (at >= frames.length) { stop(); return; }
      at++; paint();
    }, 2200);
    paint();
  }
  paint();
})();

/* ---------- 3. the same net, twice ---------- */
(function mapWidget() {
  const root = $('pt-map');
  if (!root) return;
  let open = 4;                     // start on loss.backward(), the line that earns the framework

  function paint() {
    root.innerHTML =
      '<div class="pt-map">' +
        '<div class="pt-mh"><span>by hand · chapters 4–6</span><span>PyTorch</span></div>' +
        MAP.map((m, i) =>
          '<button class="pt-mrow' + (open === i ? ' on' : '') + '" data-i="' + i + '">' +
            '<pre>' + esc(m.hand) + '</pre>' +
            '<span class="pt-arrow">→</span>' +
            '<pre class="t">' + esc(m.torch) + '</pre>' +
          '</button>').join('') +
      '</div>' +
      '<div class="pt-mnote">' + MAP[open].note + '</div>';
    root.querySelectorAll('.pt-mrow').forEach(b =>
      b.onclick = () => { open = +b.dataset.i; paint(); });
  }
  paint();
})();

/* ---------- 4. the training loop ---------- */
(function loopWidget() {
  const root = $('pt-loop');
  if (!root) return;
  let step = 0;
  const acc = accumulation(3);

  function paint() {
    const s = LOOP[step];
    root.innerHTML =
      '<div class="pt-cycle">' + LOOP.map((l, i) =>
        '<button class="pt-cstep' + (i === step ? ' on' : '') + '" data-i="' + i + '" ' +
          'style="--c:' + l.c + '"><span>' + l.ico + '</span><code>' + esc(l.n) + '</code>' +
          (i < LOOP.length - 1 ? '<i class="pt-carrow">→</i>' : '<i class="pt-carrow loop">↻</i>') +
        '</button>').join('') + '</div>' +

      '<div class="pt-cdetail" style="--c:' + s.c + '">' +
        '<div class="pt-cd"><b>What it does</b>' + s.does + '</div>' +
        '<div class="pt-cd warn"><b>Skip it and</b>' + s.skip + '</div>' +
        '<div class="pt-cd"><b>The bit people miss</b>' + s.why + '</div>' +
      '</div>' +

      '<div class="pt-accum">' +
        '<h5>The forgotten <code>zero_grad()</code>, computed</h5>' +
        '<p>Same batch, same parameters, <code>backward()</code> called three times with no zeroing in ' +
        'between — the exact bug, run on the graph from the panel above.</p>' +
        '<table class="pt-atable"><thead><tr><th>backward() call</th><th>w1.grad</th><th>x1.grad</th>' +
        '<th>what the optimiser would step with</th></tr></thead><tbody>' +
          acc.map(r => '<tr><td class="mono">' + r.pass + '</td><td class="mono">' + f3(r.w1) + '</td>' +
            '<td class="mono">' + f3(r.x1) + '</td><td>' + (r.pass === 1 ? 'the right gradient' :
            r.pass + '× the right gradient — an effective learning rate ' + r.pass + '× what you set') +
            '</td></tr>').join('') +
        '</tbody></table>' +
        '<p class="pt-afoot">No exception, no warning. The loss just behaves as though the learning rate ' +
        'is climbing, which is why this bug is usually diagnosed as "unstable training" and fixed by ' +
        'lowering the learning rate — hiding it instead of removing it.</p>' +
      '</div>';

    root.querySelectorAll('.pt-cstep').forEach(b =>
      b.onclick = () => { step = +b.dataset.i; paint(); });
  }
  paint();
})();

/* ---------- 5. the bug gallery ---------- */
(function bugWidget() {
  const root = $('pt-bugs');
  if (!root) return;
  let open = null;

  function paint() {
    root.innerHTML = '<div class="pt-bugs">' + BUGS.map(b =>
      '<article class="pt-bug' + (open === b.id ? ' open' : '') + '" data-b="' + b.id + '">' +
        '<button class="pt-bh"><span>' + b.ico + '</span><b>' + esc(b.n) + '</b>' +
          '<i>' + (open === b.id ? '−' : '+') + '</i></button>' +
        '<pre class="code pt-msg">' + esc(b.msg) + '</pre>' +
        (open === b.id
          ? '<div class="pt-bbody"><p><b>Cause.</b> ' + b.cause + '</p><p class="fix"><b>Fix.</b> ' + b.fix + '</p></div>'
          : '') +
      '</article>').join('') + '</div>';
    root.querySelectorAll('.pt-bh').forEach(b => b.onclick = () => {
      const id = b.parentElement.dataset.b;
      open = open === id ? null : id;
      paint();
    });
  }
  paint();
})();

/* ---------- 6. static fills ---------- */
(function statics() {
  const mod = $('pt-module');
  if (mod) mod.innerHTML = MODULE.map(m =>
    '<div class="pt-mod"><b>' + esc(m[0]) + '</b><span>' + m[1] + '</span></div>').join('');
  ['model', 'loop', 'autograd'].forEach(k => {
    const el = $('pt-code-' + k);
    if (el) el.textContent = CODE[k];
  });
})();
})();
