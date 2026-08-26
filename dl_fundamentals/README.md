# DL Fundamentals

An interactive, animated course on deep learning fundamentals. Thirteen chapters, every
concept attached to something you can drag, step through or watch train.

The angle: **there is no framework here**. Roughly 200 lines in `js/mathkit.js` implement
initialisation, the forward pass, binary cross-entropy, backpropagation, gradient descent and
2D convolution. Every network on the page is built and trained live in your browser, and the
test suite verifies the gradients against numerical differentiation — so the arithmetic the
course shows you is the arithmetic it actually does.

## Run it

Open `index.html` in a browser. That's it — no build, no server, no dependencies.

```
start index.html          # Windows
open index.html           # macOS
```

(Optional, if you prefer a server: `python -m http.server` then visit `localhost:8000`.)

## What's inside

| # | Chapter | The interactive bit |
|---|---------|---------------------|
| 1 | The neuron | Drag two weights and a bias; watch the boundary move and the truth table fill in |
| 2 | Activations | Plot them, then flip to derivatives — the view that explains why ReLU won |
| 3 | XOR | **Live training.** Pick "no hidden layer" and watch it stall at 50% forever, then add one |
| 4 | Forward pass | **Animated**: a real 2-2-1 network stepped through with the actual arithmetic on screen |
| 5 | Backpropagation | The same network running backwards, with real gradients and per-layer magnitudes |
| 6 | Training | **Live training** on two interleaving crescents, plus four learning rates raced on one chart |
| 7 | Regularisation | **Animated** dropout — watch a different random subset zero on each pass, then hit inference |
| 8 | Vanishing gradients | Gradient magnitude by depth on a log scale. Sigmoid vs tanh vs ReLU, with a depth slider |
| 9 | Convolution | **Animated**: slide a 3×3 kernel over a hand-drawn 7, with the arithmetic for each window |
| 10 | Sequences | Feed-forward → RNN → LSTM → transformer, each fixing the previous one's limit |
| 11 | In practice | A symptom → first-suspect debugging table, and the PyTorch equivalent of everything built here |
| 12 | Final quiz | 15 questions with explanations, plus a 33-term glossary |

Progress, XP and answers persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework
js/mathkit.js     the neural network — init, forward, backprop, training, convolution
js/content.js     every dataset and piece of course content
js/demos.js       the interactive widgets (drawing only; it imports the maths)
js/app.js         navigation, progress, XP
test.js           node test.js — fails if the data or the maths goes wrong
```

`mathkit.js` exists so `test.js` can import and run **the same code the page runs**. There is
one implementation, not one for the demo and one for the check.

## Editing the course

Datasets, copy, quiz questions and glossary terms live in `js/content.js`. Add a chapter by
copying a `<section class="chapter">` block in `index.html` — the sidebar, pager and progress
bar build themselves from the DOM.

Run `node test.js` after editing. It trains real networks and checks the claims each chapter
makes. The most important checks:

- **Gradients are verified against numerical differentiation.** Every weight and bias in a
  test network has its analytic gradient compared to `(L(w+h) − L(w−h)) / 2h`. If backprop
  were subtly wrong, this fails — and it is the check that makes every other number in
  Chapters 4 and 5 trustworthy.
- **The output delta really is `ŷ − y`**, exactly, as Chapter 5 claims.
- **XOR behaves as taught.** A network with no hidden layer is checked across eight different
  random seeds and must never exceed 50% — it is a representational impossibility, not a
  seed accident. The hidden-layer versions must reach 100%, and the demo's own epoch budget
  is checked to be enough for them to get there.
- **The neuron presets really are the gates they claim.** AND, OR and NAND are evaluated at all
  four corners against their truth tables, and every preset is checked to be reachable on the sliders.
- **Sigmoid's derivative peaks at exactly 0.25**, which is the number the vanishing-gradient
  argument rests on.
- **Stacked linear layers really do collapse** — checked numerically via the linearity identity.
- **Gradients genuinely vanish.** Over 8 layers sigmoid shrinks the gradient by more than
  1,000× while ReLU shrinks it by under 100×, and deeper must be worse than shallower. The
  ReLU probe is also checked not to be all zeros, which would draw a misleading chart.
- **The moons dataset defeats a linear model** (under 95%) and is solved by one hidden
  layer (over 97%) — otherwise the chapter's argument has no evidence.
- **The learning rates behave as labelled**: "good" beats "too small" in the same budget,
  "too big" visibly bounces, and "good" settles into a smooth descent.
- **Convolution is checked by hand**: the identity kernel returns the image interior
  untouched, a known 3×3 window is verified against a hand-computed sum, every kernel
  produces a non-flat feature map, and the edge kernels respond more to the edges the copy
  says they do.
- **Max pooling halves the grid and keeps the block maximum**, and the dense-vs-conv
  parameter counts are arithmetically verified.
- Every `#id` the demos reach for exists, the scripts load in the right order, and every
  chapter the demos redraw on actually exists.

## Notes on accuracy

- The networks are tiny and trained with plain full-batch gradient descent at a fixed learning
  rate. A real framework uses mini-batches and an adaptive optimiser and would get there in
  fewer passes. The mechanics are identical.
- Datasets are small and synthetic so the phenomena are visible immediately and every number is
  checkable. Chapter 11 is explicit that real work starts from a pretrained model.
- Chapter 3's "2 hidden units" architecture stalls **from the seed the demo starts with**. That
  is a real and instructive failure — the note says so, and the test asserts it stays true so
  the note cannot silently become wrong. Press "new random init" and it often succeeds.
- Chapter 8's gradient-flow probe uses width-8 layers. A chain of width-1 ReLU layers dies
  almost immediately, which would demonstrate *dying ReLU* rather than the vanishing gradients
  the chapter is about. The comment in `mathkit.js` explains the choice.
- The convolution kernels in Chapter 9 are classical hand-built filters, shown because they make
  the mechanism visible. A real CNN learns its kernels — the chapter says so.
- GELU is plotted but not trainable in the kit; its exact derivative needs the pre-activation,
  which the backward pass deliberately does not keep.
- Animation speeds are chosen for watchability. The maths is not.

## Where this sits

- **ML Fundamentals** (next door) covers splits, leakage, evaluation and the workflow. This
  course assumes all of it.
- **GenAI Flow** (next door) picks up exactly where Chapter 10 stops: attention, tokens,
  embeddings, RAG and agents.
