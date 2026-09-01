/* ============================================================
   content.js — all the course data in one place.
   Edit here to change the course; demos.js only renders it.

   The networks in this course are trained live in your browser by
   js/mathkit.js. The arrays below are the data they train on.
   ============================================================ */
window.C = {};

/* ---------- Ch1: one neuron ---------- */
C.neuronNote = 'A neuron is a weighted sum plus a bias, pushed through a non-linear function. That is the whole unit. Everything else in deep learning is how you wire millions of them together and how you choose the weights.';
C.neuronPresets = [
  { n: 'AND',  w1: 1,   w2: 1,   b: -1.5, note: 'Both inputs must be on to push the sum above zero. One neuron does this easily.' },
  { n: 'OR',   w1: 1,   w2: 1,   b: -0.5, note: 'Either input alone clears the bar. Same neuron, different bias — the bias is the threshold.' },
  { n: 'NAND', w1: -1,  w2: -1,  b: 1.5,  note: 'Negative weights invert the logic. NAND is functionally complete, which is a hint about why stacking these works.' },
  { n: 'ignore x₂', w1: 1.8, w2: 0, b: -0.9, note: 'A zero weight is the network saying "this input does not matter". Training discovers those on its own.' }
];

/* ---------- Ch2: activations ---------- */
C.activationCards = [
  { k: 'relu', t: 'ReLU', f: 'max(0, z)',
    use: 'The default for hidden layers. Cheap, and its gradient is exactly 1 for positive inputs, so it does not shrink the signal on the way back.',
    watch: 'Units can die: once a unit outputs 0 for every input in your data, its gradient is 0 forever and it never recovers.' },
  { k: 'leaky', t: 'Leaky ReLU', f: 'z if z > 0 else 0.01z',
    use: 'ReLU with a small negative slope, so a dead unit still has a way back.',
    watch: 'Adds a hyper-parameter for a problem you may not have. Try plain ReLU first.' },
  { k: 'tanh', t: 'tanh', f: '(e^z − e^−z) / (e^z + e^−z)',
    use: 'Zero-centred, output in −1..1. Still common inside RNNs and gates.',
    watch: 'Saturates at both ends — gradient near zero for large |z|, so deep stacks learn slowly.' },
  { k: 'sigmoid', t: 'Sigmoid', f: '1 / (1 + e^−z)',
    use: 'The right choice for a <b>binary output</b>, where you want a probability.',
    watch: 'Its derivative peaks at 0.25, so eight sigmoid layers can shrink a gradient by 4⁻⁸. This is the vanishing-gradient problem, and it is why hidden layers stopped using it.' },
  { k: 'gelu', t: 'GELU', f: 'z · Φ(z)',
    use: 'A smooth ReLU. What transformers actually use — BERT, GPT and friends.',
    watch: 'Slightly more expensive than ReLU, and the difference only shows up at scale.' },
  { k: 'linear', t: 'None (linear)', f: 'z',
    use: 'Correct for a <b>regression output</b> layer, where the answer is an unbounded number.',
    watch: 'Never in a hidden layer. Stacking linear layers collapses to a single linear layer — see the demo below.' }
];
C.linearCollapse = 'Two linear layers in a row compute <span class="mono">W₂(W₁x + b₁) + b₂ = (W₂W₁)x + (W₂b₁ + b₂)</span> — which is just another single linear layer. Without a non-linearity, a hundred layers have exactly the expressive power of one. The activation function is not a detail; it is the entire reason depth buys you anything.';

/* ---------- Ch3: XOR, the problem that killed and revived neural nets ---------- */
C.xorData = [
  { x: [0, 0], y: 0 }, { x: [0, 1], y: 1 },
  { x: [1, 0], y: 1 }, { x: [1, 1], y: 0 }
];
C.xorArchs = [
  { id: 'none',  sizes: [2, 1],    act: 'tanh', label: 'no hidden layer', note: 'One neuron can only draw a straight line, and no straight line separates the diagonals of XOR. It will settle at 50% — chance — and stay there no matter how long you train. This is the result that stalled neural network research for a decade.' },
  { id: 'small', sizes: [2, 2, 1], act: 'tanh', label: '2 hidden units', note: 'Two hidden units is the theoretical minimum, and it works — but only from a lucky starting point. From this seed it lands in a flat spot and stalls, which is a real and common failure, not a bug in the demo. Restart it or add a unit.' },
  { id: 'good',  sizes: [2, 4, 1], act: 'tanh', label: '4 hidden units', note: 'Comfortable. The hidden layer bends the space until a straight line in <i>its</i> coordinates does separate the classes, and the output neuron draws that line. Depth buys you a change of coordinates.' },
  { id: 'relu',  sizes: [2, 4, 1], act: 'relu', label: '4 hidden, ReLU',  note: 'Same shape with ReLU instead of tanh. Converges faster here, and the boundary it draws is made of straight creases rather than smooth curves — which is exactly what a piecewise-linear activation produces.' }
];

/* ---------- Ch4/5: the tiny network we step through by hand ---------- */
C.walkNet = {
  sizes: [2, 2, 1], act: 'tanh', seed: 5,
  x: [1, 0], y: 1,
  inputNames: ['x₁', 'x₂'],
  note: 'Two inputs, two hidden units, one output. Small enough that every number on screen fits, and identical in structure to a network with a billion parameters.'
};
C.forwardSteps = [
  { t: 'Inputs arrive', d: 'Two numbers. In a real network this is a pixel patch, a token embedding, or a row of features.' },
  { t: 'Weighted sums', d: 'Each hidden unit computes <span class="mono">z = w·x + b</span>. This is one row of a matrix multiply — and it is why GPUs matter: a real layer does millions of these at once.' },
  { t: 'Activation', d: 'Each z goes through tanh. Without this the whole network would collapse into one linear layer.' },
  { t: 'Output layer', d: 'The hidden activations become the next layer\'s inputs. Same operation, one layer along.' },
  { t: 'Sigmoid', d: 'The final z is squashed into 0..1 so it can be read as a probability.' },
  { t: 'Loss', d: 'Compare with the target using binary cross-entropy. This single number is what the whole backward pass is about to differentiate.' }
];
C.backpropSteps = [
  { t: 'Start at the loss', d: 'The question backpropagation answers is: if I nudge this one weight, how much does the loss change? That is <span class="mono">∂L/∂w</span>.' },
  { t: 'Output delta', d: 'For sigmoid output with cross-entropy loss, the whole thing collapses to <span class="mono">δ = a − y</span> — prediction minus target. The two functions were chosen to pair like this.' },
  { t: 'Gradient for the last layer', d: '<span class="mono">∂L/∂w = δ × (the activation that fed this weight)</span>. A weight is blamed in proportion to how much signal flowed through it.' },
  { t: 'Push the error backwards', d: 'Each hidden unit gets a share of the blame, weighted by the connection it sent forward — then multiplied by its own activation\'s derivative.' },
  { t: 'Repeat, layer by layer', d: 'The same two operations all the way down. That repeated multiplication is exactly why gradients vanish or explode in deep stacks.' },
  { t: 'Update', d: '<span class="mono">w ← w − lr × ∂L/∂w</span>. One step downhill, for every weight at once. Then do it again.' }
];
C.chainRule = 'Backpropagation is the chain rule, applied to a graph, with the intermediate results cached so nothing is computed twice. It is not an approximation, and it is not specific to neural networks — it is reverse-mode automatic differentiation, and it computes the gradient of every parameter for roughly the cost of one forward pass. That efficiency is the reason deep learning is possible at all.';

/* ---------- Ch6: learning rate and the training loop ---------- */
C.moonsLabel = 'two interleaving crescents — no straight line separates them';
C.moonsData = [
  [1.39,-0.01,0],[0.09,0.75,1],[1.59,-0.14,0],[0.24,0.48,1],[1.58,0.31,0],[0.01,0.5,1],
  [1.37,0.28,0],[-0.08,0.15,1],[1.31,0.61,0],[0.26,0.21,1],[1.18,1.06,0],[0.24,-0.34,1],
  [1.26,1.09,0],[0.32,-0.34,1],[1.03,1.05,0],[0.21,-0.57,1],[1.09,1.21,0],[0.43,-0.66,1],
  [1.05,1.41,0],[0.45,-0.72,1],[0.94,1.3,0],[0.7,-0.69,1],[0.67,1.27,0],[1.27,-0.56,1],
  [0.6,1.51,0],[1.15,-0.66,1],[0.08,1.75,0],[1.31,-0.9,1],[0.11,1.39,0],[1.7,-1.11,1],
  [0.15,1.6,0],[1.82,-0.98,1],[-0.3,1.66,0],[1.86,-0.76,1],[-0.64,1.48,0],[1.95,-0.84,1],
  [-0.76,1.39,0],[2.01,-0.75,1],[-0.78,1.6,0],[2.46,-0.8,1],[-1.06,1.52,0],[2.47,-0.61,1],
  [-0.91,1.28,0],[2.64,-0.28,1],[-1.46,1.24,0],[2.87,-0.47,1],[-1.13,1.1,0],[2.69,-0.12,1],
  [-1.35,0.97,0],[3.15,0.08,1],[-1.39,0.57,0],[2.97,0.08,1],[-1.57,0.66,0],[3.06,0.15,1],
  [-1.56,0.23,0],[3.1,0.46,1],[-1.69,0.02,0],[3.12,0.4,1],[-1.6,-0.1,0],[3.44,0.39,1]
];
C.moonsArchs = [
  { id: 'linear', sizes: [2, 1],       act: 'tanh', label: 'no hidden layer',
    note: 'A single neuron draws one straight line. On interleaved crescents the best straight line still misses a chunk of both classes — and no amount of training fixes it.' },
  { id: 'one',    sizes: [2, 6, 1],    act: 'tanh', label: '1 hidden layer × 6',
    note: 'One hidden layer is enough to bend the boundary around both crescents. This is the universal approximation theorem being unremarkable in practice.' },
  { id: 'deep',   sizes: [2, 8, 8, 1], act: 'relu', label: '2 hidden layers × 8, ReLU',
    note: 'More capacity than the problem needs. It fits quickly, and the boundary is visibly made of straight segments — ReLU networks are piecewise linear, always.' }
];
C.lrCards = [
  { lr: 0.01,  tag: 'too small', c: '#828aa8', note: 'Correct direction, no progress. On a real model this is a run you cancel after an hour, unsure whether it was ever going to work.' },
  { lr: 0.5,   tag: 'good',      c: '#34d399', note: 'A clean drop, then a flattening. This is the loss curve shape you are looking for.' },
  { lr: 3.0,   tag: 'too big',   c: '#fbbf24', note: 'It gets there, but the loss bounces — each step overshoots and has to come back. Usually a sign to lower the rate or add momentum.' },
  { lr: 20,    tag: 'chaos',     c: '#fb7185', note: 'The steps are so large the network is thrown somewhere random each time. Loss stops meaning anything, and in float32 this is where NaN appears.' }
];

/* ---------- Ch7: regularisation ---------- */
C.regCards = [
  { t: 'Dropout', ico: '🎲',
    d: 'During training, randomly zero a fraction of units on every forward pass. At inference, keep all of them.',
    why: 'No unit can rely on any specific other unit being present, so the network cannot build fragile co-adapted chains. It is an ensemble of exponentially many subnetworks, averaged.',
    code: 'nn.Dropout(p=0.5)' },
  { t: 'Weight decay (L2)', ico: '⚓',
    d: 'Add a penalty proportional to the squared size of every weight.',
    why: 'Large weights mean sharp, confident functions that pass exactly through the training points. Shrinking them buys smoothness.',
    code: 'optim.AdamW(params, weight_decay=0.01)' },
  { t: 'Early stopping', ico: '🛑',
    d: 'Watch validation loss. Stop when it starts rising, and keep the weights from the best epoch.',
    why: 'The cheapest regulariser there is — it costs nothing and it needs no tuning. Train error will keep falling forever; that is not the signal.',
    code: 'if val_loss > best: patience -= 1' },
  { t: 'Data augmentation', ico: '🔀',
    d: 'Flip, crop, rotate, add noise, change colours. Same label, new example.',
    why: 'Directly attacks the actual problem: not enough data. On images it is often worth more than any architecture change.',
    code: 'transforms.RandomHorizontalFlip()' },
  { t: 'Batch normalisation', ico: '📊',
    d: 'Normalise each layer\'s activations across the batch, then let the network rescale them with learned parameters.',
    why: 'Stabilises training and permits much higher learning rates. It regularises a little as a side effect, because each example is normalised using its batch-mates.',
    code: 'nn.BatchNorm2d(64)' },
  { t: 'Just get more data', ico: '📦',
    d: 'The one that always works.',
    why: 'Every other technique on this list is a way of faking it. If more real data is available, it beats all of them and has no downside.',
    code: '# the hard one' }
];

/* ---------- Ch8: initialisation and gradient flow ---------- */
C.flowActs = [
  { k: 'sigmoid', label: 'sigmoid', c: '#fb7185' },
  { k: 'tanh',    label: 'tanh',    c: '#fbbf24' },
  { k: 'relu',    label: 'ReLU',    c: '#34d399' }
];
C.initCards = [
  { t: 'All zeros', verdict: 'bad',
    d: 'Every unit in a layer computes the same thing, gets the same gradient, and stays identical forever. The layer has one effective unit no matter how wide it is. This is called the symmetry problem.' },
  { t: 'Large random', verdict: 'bad',
    d: 'Activations saturate immediately. With sigmoid or tanh the gradient is then near zero everywhere and nothing moves; with ReLU the forward pass explodes instead.' },
  { t: 'Xavier / Glorot', verdict: 'good',
    d: 'Scale by <span class="mono">√(1/fan_in)</span>. Keeps the variance of activations roughly constant through the layers. The right default for tanh and sigmoid.' },
  { t: 'He / Kaiming', verdict: 'good',
    d: 'Scale by <span class="mono">√(2/fan_in)</span>. The extra factor of 2 compensates for ReLU discarding half its inputs. The right default for ReLU-family networks.' }
];
C.flowNote = 'Each bar is how large the gradient still is when it reaches that layer, on a logarithmic scale. Watch the sigmoid network: by the time the signal has crossed eight layers it has shrunk by orders of magnitude, so the early layers — the ones learning the most basic features — barely move at all. ReLU keeps a gradient of exactly 1 wherever it is active, which is the single change that made deep networks trainable.';

/* ---------- Ch9: convolution ---------- */
C.convImage = [
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0]
];
C.convKernels = [
  { t: 'vertical edges', k: [[1,0,-1],[2,0,-2],[1,0,-1]],
    why: 'A Sobel filter. Positive on the left, negative on the right, so it fires wherever brightness changes horizontally — the vertical stroke of the 7 lights up along its whole length. The top bar is mostly quiet, though its two <i>ends</i> are vertical edges too, and they register.' },
  { t: 'horizontal edges', k: [[1,2,1],[0,0,0],[-1,-2,-1]],
    why: 'The same filter rotated a quarter turn. Now the top bar responds along its whole length and the vertical stroke goes almost silent — only its bottom tip registers. One kernel, one kind of feature.' },
  { t: 'diagonal', k: [[-1,-1,2],[-1,2,-1],[2,-1,-1]],
    why: 'Tuned to one diagonal direction, so the slanted part of the 7 shows up. In a real CNN nobody designs these — the network learns them from data, and the first layer of a trained network really does contain edge detectors like these.' },
  { t: 'blur', k: [[0.111,0.111,0.111],[0.111,0.111,0.111],[0.111,0.111,0.111]],
    why: 'A plain average. Smooths out noise and detail. Useful as preprocessing, useless as a feature detector — nothing is being distinguished.' },
  { t: 'sharpen', k: [[0,-1,0],[-1,5,-1],[0,-1,0]],
    why: 'Amplifies a pixel relative to its neighbours. Note the weights sum to 1, so flat areas stay unchanged while edges get exaggerated.' },
  { t: 'identity', k: [[0,0,0],[0,1,0],[0,0,0]],
    why: 'Copies the input. Worth seeing once, because it makes the mechanics obvious: the output pixel is the weighted sum of the 3×3 patch under the kernel, and nothing more.' }
];
C.cnnStack = [
  { t: 'Conv', d: 'Slide learned kernels over the image. Each produces a feature map showing where that pattern occurs.',
    n: 'A 3×3 kernel over 1 channel is 10 parameters — and it is reused at every position.' },
  { t: 'ReLU', d: 'Zero out negative responses, keeping only "this feature is present here".', n: 'No parameters.' },
  { t: 'Pool', d: 'Take the maximum of each small block, halving the resolution.',
    n: 'No parameters. Buys a little translation tolerance and cuts the compute for every later layer.' },
  { t: 'Repeat', d: 'Later layers see larger areas of the original image, so they combine edges into corners, corners into textures, textures into object parts.',
    n: 'This hierarchy is learned, not designed.' },
  { t: 'Flatten + Dense', d: 'Finally, ordinary fully-connected layers turn the feature maps into class scores.',
    n: 'This is where most of the parameters used to live, before global pooling became standard.' }
];
C.convWhy = [
  { t: 'Parameter sharing', d: 'One 3×3 kernel is 9 weights and a bias — 10 numbers — and it is applied at every position in the image. A dense layer connecting a 28×28 image to 128 units needs 100,480. Same job, four orders of magnitude apart.' },
  { t: 'Locality', d: 'A pixel is related to its neighbours, not to a pixel 400 rows away. Conv layers only look at a small window, which is a prior about images built into the architecture.' },
  { t: 'Translation equivariance', d: 'A cat in the corner produces the same features as a cat in the middle. A dense layer would have to learn "cat" separately for every position.' }
];

/* ---------- Ch10: sequences ---------- */
C.seqCards = [
  { t: 'Feed-forward', ico: '➡️', era: 'the baseline',
    d: 'Fixed-size input, fixed-size output. To feed it a sentence you must first squash the sentence into a fixed vector, losing the order.',
    fail: 'Cannot handle variable length, and has no notion of sequence at all.' },
  { t: 'RNN', ico: '🔁', era: '1990s → 2014',
    d: 'Process one token at a time, carrying a hidden state forward. The state is the memory of everything so far.',
    fail: 'That state is passed through the same weights repeatedly, so gradients vanish over long spans. In practice an RNN forgets what happened 20 steps ago.' },
  { t: 'LSTM / GRU', ico: '🚪', era: '1997 → 2017',
    d: 'Add learned gates that decide what to keep, what to forget and what to output, plus a cell state that flows through mostly untouched.',
    fail: 'Much longer memory, but still strictly sequential — token 500 cannot be computed until token 499 is done, so it cannot use a GPU properly.' },
  { t: 'Transformer', ico: '⚡', era: '2017 → now',
    d: 'Drop recurrence entirely. Every token attends directly to every other token in one parallel operation, with position encoded explicitly.',
    fail: 'Attention costs O(n²) in sequence length, which is why context windows are a headline number and a research problem.' }
];
C.attentionNote = 'Attention is the bridge from this course to language models. The mechanics — Q, K, V, softmax, multiple heads — are a course of their own, and the <b>GenAI Flow</b> folder next door covers them with the same kind of demos.';

/* ---------- Ch11: practice ---------- */
C.debugChecklist = [
  { s: 'Loss is NaN', fix: 'Learning rate too high, nine times out of ten. Divide by 10. Otherwise: a log of zero, a division by zero, or unnormalised inputs.' },
  { s: 'Loss does not move at all', fix: 'Learning rate too low, a broken data pipeline, or all-zero initialisation. Check that the labels are not all the same and that gradients are actually non-zero.' },
  { s: 'Training loss falls, validation loss rises', fix: 'Textbook overfitting. Early stopping, more data, augmentation, dropout, weight decay — roughly in that order of effort.' },
  { s: 'Both losses plateau high', fix: 'Underfitting. More capacity, better features, train longer, or less regularisation. Check first that the model can overfit a batch of 10 examples — if it cannot, something is broken, not just small.' },
  { s: 'Validation loss is below training loss', fix: 'Usually dropout: it is active during training and off during evaluation. If the gap is large, suspect a broken split instead.' },
  { s: 'Great in training, terrible in production', fix: 'Leakage, or preprocessing that differs between the two paths. Serialise the exact transform pipeline with the model.' },
  { s: 'Works, then suddenly diverges mid-training', fix: 'Exploding gradients. Clip them (<span class="mono">clip_grad_norm_</span>), lower the rate, or add normalisation layers.' }
];
C.sanityRules = [
  'Overfit a batch of 10 examples first. If the model cannot reach ~zero loss on ten samples, the bug is in the code, not the data.',
  'Start from the smallest model that could possibly work. Scale only once it trains.',
  'Set every seed and log every hyper-parameter, or you cannot tell an improvement from a lucky run.',
  'Plot training and validation loss on the same axes from step one. Almost every diagnosis in the table above is read off that one chart.',
  'Compare against a non-deep baseline. On tabular data, gradient boosting frequently wins, and that is a result worth knowing early.'
];
C.frameworkCode = 'import torch, torch.nn as nn\n\nmodel = nn.Sequential(\n    nn.Linear(2, 8), nn.ReLU(),\n    nn.Linear(8, 8), nn.ReLU(),\n    nn.Linear(8, 1),\n)\nloss_fn = nn.BCEWithLogitsLoss()\nopt = torch.optim.AdamW(model.parameters(), lr=1e-3)\n\nfor epoch in range(epochs):\n    for xb, yb in train_loader:\n        pred = model(xb)\n        loss = loss_fn(pred, yb)\n\n        opt.zero_grad()      # clear last step\'s gradients\n        loss.backward()      # backpropagation, in one line\n        opt.step()           # w -= lr * grad';
C.frameworkNote = 'Everything this course built by hand is those three lines. <span class="mono">loss.backward()</span> is the backward pass from Chapter 5; <span class="mono">opt.step()</span> is the update rule. Knowing what they do is the difference between tuning a model and guessing at one.';

/* ---------- Ch12: quiz + glossary ---------- */
C.quiz = [
  { q: 'What does a single neuron compute?', o: ['A weighted sum, plus a bias, through an activation function', 'A probability distribution', 'A matrix inverse', 'A decision tree split'], a: 0,
    e: 'w·x + b, then a non-linearity. Everything else is wiring and scale.' },
  { q: 'What happens if you stack linear layers with no activation between them?', o: ['You get a deeper model', 'It collapses to a single linear layer', 'It trains faster', 'The gradients explode'], a: 1,
    e: 'W₂(W₁x) = (W₂W₁)x. Without a non-linearity, depth buys you exactly nothing.' },
  { q: 'Why can no single neuron solve XOR?', o: ['Not enough training data', 'XOR is not linearly separable', 'The learning rate is always wrong', 'Sigmoid cannot output 0'], a: 1,
    e: 'One neuron draws one straight line, and no straight line separates XOR\'s diagonals. A hidden layer bends the space until one can.' },
  { q: 'What is backpropagation?', o: ['Running the network in reverse to generate inputs', 'The chain rule applied to the network graph to get every gradient', 'A way of initialising weights', 'A regularisation technique'], a: 1,
    e: 'It computes ∂Loss/∂w for every parameter for roughly the cost of one forward pass. That efficiency is why deep learning is feasible.' },
  { q: 'Your loss becomes NaN after a few hundred steps. First thing to try?', o: ['Add more layers', 'Lower the learning rate', 'Train longer', 'Remove the activation functions'], a: 1,
    e: 'Overshooting is by far the most common cause. Divide the learning rate by 10 before investigating anything else.' },
  { q: 'Why did ReLU largely replace sigmoid in hidden layers?', o: ['It is more biologically accurate', 'Its gradient is 1 where active, so it does not shrink the signal', 'It outputs probabilities', 'It uses less memory'], a: 1,
    e: 'Sigmoid\'s derivative peaks at 0.25, so each layer shrinks the gradient. Stack eight and the early layers stop learning.' },
  { q: 'What is the vanishing gradient problem?', o: ['Gradients get lost in memory', 'Repeated multiplication makes gradients tiny in early layers', 'The loss goes to zero too fast', 'Weights become NaN'], a: 1,
    e: 'Backpropagation multiplies derivatives layer by layer. If each is below 1, the product shrinks exponentially with depth.' },
  { q: 'What does dropout do at inference time?', o: ['Drops the same units', 'Nothing — all units are active', 'Drops twice as many', 'Randomly drops layers'], a: 1,
    e: 'Dropout is training-only. Forgetting to call model.eval() in PyTorch is a classic bug that makes predictions randomly worse.' },
  { q: 'Training loss falls, validation loss rises. What is happening?', o: ['Underfitting', 'Overfitting', 'The learning rate is too low', 'The data is not shuffled'], a: 1,
    e: 'The model is memorising the training set. Early stopping is the cheapest fix; more data is the best one.' },
  { q: 'Why initialise weights randomly rather than to zero?', o: ['Zeros are slower to compute', 'All units would stay identical forever', 'Zero is not a valid weight', 'It uses more memory'], a: 1,
    e: 'Identical weights get identical gradients, so every unit in a layer learns the same thing. Random breaks the symmetry.' },
  { q: 'What is an epoch?', o: ['One weight update', 'One full pass over the training data', 'One layer\'s forward pass', 'One mini-batch'], a: 1,
    e: 'With 10,000 rows and a batch size of 100, one epoch is 100 updates.' },
  { q: 'What is the main advantage of a convolutional layer over a dense one for images?', o: ['It is more accurate by definition', 'Parameter sharing — one small kernel is reused at every position', 'It needs no activation function', 'It cannot overfit'], a: 1,
    e: 'A 3×3 kernel is 10 parameters reused everywhere; the equivalent dense layer on a 28×28 image needs over 100,000.' },
  { q: 'What does max pooling do?', o: ['Adds parameters', 'Downsamples by keeping the strongest response in each block', 'Normalises the activations', 'Applies the activation function'], a: 1,
    e: 'No parameters. It shrinks the spatial size, cuts later compute, and gives a little tolerance to small shifts.' },
  { q: 'Why did transformers replace RNNs for language?', o: ['They are smaller', 'Every token attends to every other in one parallel step', 'They need no training data', 'They avoid matrix multiplication'], a: 1,
    e: 'RNNs are sequential and forget over long spans. Attention is parallel and connects any two positions directly — at O(n²) cost.' },
  { q: 'Your model cannot reach near-zero loss on a batch of 10 examples. What does that mean?', o: ['You need more data', 'Something is broken in the code or pipeline', 'The learning rate is perfect', 'The model needs regularisation'], a: 1,
    e: 'Any model with enough capacity should memorise ten examples. If it cannot, the bug is in the wiring, not the dataset.' }
];
C.glossary = [
  ['Neuron / unit', 'w·x + b through an activation. The building block.'],
  ['Weight', 'A learned multiplier on one connection.'],
  ['Bias', 'A learned offset added before the activation. It shifts the threshold.'],
  ['Activation function', 'The non-linearity. Without it, depth collapses to one layer.'],
  ['ReLU', 'max(0, z). The default hidden activation — gradient 1 where active.'],
  ['Sigmoid', '1/(1+e⁻ᶻ). Squashes to 0..1. Right for binary outputs, wrong for hidden layers.'],
  ['Softmax', 'Turns a vector of scores into a probability distribution. Multi-class outputs.'],
  ['Forward pass', 'Input to prediction, layer by layer.'],
  ['Loss function', 'How wrong the prediction is. Cross-entropy for classes, MSE for numbers.'],
  ['Backpropagation', 'The chain rule over the network graph, computing every gradient in one backward sweep.'],
  ['Gradient', '∂Loss/∂w — how much the loss changes if this weight nudges.'],
  ['Learning rate', 'Step size. The single most important hyper-parameter.'],
  ['Epoch', 'One full pass over the training data.'],
  ['Batch / mini-batch', 'The group of examples used for one update. 32-512 is typical.'],
  ['Optimiser', 'The update rule. SGD, momentum, Adam, AdamW.'],
  ['Adam', 'Adaptive per-parameter learning rates plus momentum. The usual default.'],
  ['Vanishing gradient', 'Gradients shrink exponentially with depth, so early layers stop learning.'],
  ['Exploding gradient', 'The opposite. Fixed by gradient clipping and normalisation.'],
  ['Initialisation', 'The starting weights. Xavier for tanh, He for ReLU. Never all zeros.'],
  ['Dropout', 'Randomly zero units during training only. A regulariser.'],
  ['Weight decay', 'L2 penalty on weight size. Buys smoothness.'],
  ['Batch normalisation', 'Normalise activations per batch, then rescale with learned parameters.'],
  ['Early stopping', 'Stop when validation loss turns upward. The free regulariser.'],
  ['Convolution', 'Slide a small learned kernel over the input. Parameter sharing plus locality.'],
  ['Kernel / filter', 'The small weight grid a conv layer slides. Learned, not designed.'],
  ['Feature map', 'A conv layer\'s output — where in the input that pattern was found.'],
  ['Pooling', 'Downsample by taking the max or mean of each block. No parameters.'],
  ['RNN', 'Processes a sequence one step at a time, carrying a hidden state.'],
  ['LSTM / GRU', 'Gated RNNs that hold information far longer.'],
  ['Attention', 'Every position looks directly at every other, weighted by relevance.'],
  ['Transformer', 'Attention-based architecture; no recurrence, fully parallel.'],
  ['Autograd', 'The framework machinery that records operations and runs backprop for you.'],
  ['Fine-tuning', 'Continue training a pretrained model on your own smaller dataset.']
];
