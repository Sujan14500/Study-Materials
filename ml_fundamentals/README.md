# ML Fundamentals

An interactive, animated course on machine learning fundamentals. Fourteen chapters,
every concept attached to something you can drag, break or watch converge.

The angle: **every number on screen is computed live in your browser** from data you can read
in `js/content.js`. Ordinary least squares, gradient descent, logistic regression, ROC/AUC,
Gini impurity and k-means all run for real. Nothing is a pre-baked figure, so nothing can
quietly stop being true.

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
| 1 | What is ML? | Five real problems — decide whether each should be rules or a model |
| 2 | Data & splits | **Animated** train/val/test split, plus four leakage bugs with the fix |
| 3 | Linear regression | Drag slope and intercept, watch residuals and live MSE, then let least squares beat you |
| 4 | Gradient descent | **Animated**: four learning rates on the same data. The last one diverges to infinity |
| 5 | Classification | **Animated**: logistic regression trained from zero, boundary rotating into place over 600 steps |
| 6 | Evaluation | Drag the threshold across 22 scored customers — confusion matrix, precision/recall/F1 and a live ROC curve |
| 7 | Overfitting | Degree slider from 1 to 9, real least-squares fits, and the bias-variance bowl drawn from actual test error |
| 8 | Cross-validation | **Animated** five-fold rotation |
| 9 | Trees & ensembles | Slide the split point and watch the real Gini gain curve; press search and the tree tries every threshold |
| 10 | Clustering | **Animated** k-means — step assign and move separately, watch inertia fall |
| 11 | Features & scaling | Standardise three wildly different features and watch the bars equalise |
| 12 | The workflow | Nine steps with the specific trap waiting at each |
| 13 | Final quiz | 15 questions with explanations, plus a 31-term glossary |

Progress, XP and answers persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework
js/mathkit.js     the actual maths — OLS, gradient descent, ROC, Gini, k-means
js/content.js     every dataset and piece of course content
js/demos.js       the interactive widgets (drawing only; it imports the maths)
js/app.js         navigation, progress, XP
test.js           node test.js — fails if the data or the maths goes wrong
```

`mathkit.js` exists so that `test.js` can import and run **the same code the page runs**.
There is one implementation, not one for the demo and one for the check.

## Editing the course

Datasets, copy, quiz questions and glossary terms live in `js/content.js`. Add a chapter by
copying a `<section class="chapter">` block in `index.html` — the sidebar, pager and progress
bar build themselves from the DOM.

Run `node test.js` after editing. It does not merely check shapes; it re-runs the maths and
verifies the claims each chapter makes:

- **Gradient descent actually behaves as labelled.** Each of the four learning rates is run for
  4,000 steps: the "good" and "fast" ones must land within 1% of the closed-form optimum, the
  "too small" one must still be short of it, and the "diverges" one must blow up within 60 steps.
  Descent at a stable rate is also checked to be monotonic, which is what makes the "healthy loss
  curve" claim true.
- **The closed form is really optimal.** A grid of nearby lines is checked to be no better.
- **The sliders can reach the answer.** The optimal slope, intercept and tree threshold are all
  checked against the `min`/`max` in the markup.
- **The bias-variance bowl is really a bowl.** All nine polynomial fits are recomputed: train
  error must fall monotonically with degree, test error must fall to the minimum and rise after
  it, and degree 9 must overfit by at least 5×. The under/good/over bands in `demos.js` are
  checked to agree with where the minimum actually is.
- **The classifier learns but is not perfect** — above 90% in the demo's own 600-epoch budget,
  and below 100%, or the "irreducible error" lesson has no evidence.
- **The metrics move the right way.** Lowering the threshold must raise recall and lower
  precision; the confusion matrix must always account for every sample; the ROC curve must be
  monotonic and start and end in the corners.
- **k-means converges for every k from 2 to 6**, inertia never rises, and no cluster ends empty.
- **Standardising really produces mean 0 and standard deviation 1.**
- **The tree's chosen split is the best one**, verified by brute force over every threshold.
- Every `#id` the demos reach for exists, `mathkit.js` loads before `demos.js`, and every
  chapter the demos redraw on actually exists.

## Notes on accuracy

- The datasets are small and synthetic, generated from a known function plus Gaussian noise, so
  the phenomena are visible at a glance and every figure is hand-checkable. Real data is messier.
- Chapter 3's data uses hours studied and exam score as a familiar framing. It is not a claim
  about real students.
- Complexity, convergence and metric behaviour are all real; the *animation speed* is arbitrary.
- The per-fold scores in Chapter 8 are illustrative — the demo shows which rows are held out,
  which is the actual lesson, rather than training five models in the browser.
- Chapter 5's logistic regression uses full-batch gradient descent at a fixed learning rate. A
  real library uses a better optimiser and gets there in fewer passes.
- k-means seeds its centres deterministically (and deliberately badly) so the first moves are
  worth watching. Real implementations use k-means++ and several restarts.
