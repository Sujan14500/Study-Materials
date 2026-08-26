/* ============================================================
   content.js — all the course data in one place.
   Edit here to change the course; demos.js only renders it.

   Every dataset below is small enough to read, and every number
   the course claims about them is recomputed in test.js from
   these arrays. Nothing on screen is a made-up figure.
   ============================================================ */
window.C = {};

/* ---------- Ch1: what learning actually means ---------- */
C.mlKinds = [
  { k: 'Supervised', ico: '🏷️',
    d: 'You have inputs <b>and</b> the right answers. The model learns the mapping from one to the other.',
    ex: ['spam / not spam', 'house price from square footage', 'will this customer churn'],
    needs: 'Labelled examples — usually the expensive part.',
    algos: 'linear &amp; logistic regression, decision trees, random forests, gradient boosting, neural nets' },
  { k: 'Unsupervised', ico: '🔍',
    d: 'Inputs only, no answers. The model finds structure that was already there.',
    ex: ['group customers into segments', 'compress 200 features into 10', 'flag anomalous transactions'],
    needs: 'Just data — and a way to judge whether the structure it found is useful.',
    algos: 'k-means, hierarchical clustering, PCA, DBSCAN, isolation forests' },
  { k: 'Reinforcement', ico: '🎮',
    d: 'No fixed dataset. An agent acts, gets a reward, and learns a policy that earns more of it.',
    ex: ['game playing', 'robot control', 'ad bidding under a budget'],
    needs: 'An environment you can simulate cheaply, and a reward you can actually define.',
    algos: 'Q-learning, policy gradients, PPO, actor-critic' }
];
C.rulesVsML = [
  { q: 'Detect spam email',
    rules: 'if "viagra" in subject: spam', ml: 'model.fit(emails, labels)',
    verdict: 'ml', why: 'Spammers adapt every week. Rules need a human every week; a model needs a retrain.' },
  { q: 'Reject an order over the credit limit',
    rules: 'if order.total > customer.limit: reject()', ml: 'model.predict(order)',
    verdict: 'rules', why: 'The rule is exact, auditable and never wrong. A model here would be slower, less accurate and impossible to explain to a regulator.' },
  { q: 'Estimate delivery time',
    rules: 'distance / 40 + 15  # minutes', ml: 'model.fit(past_deliveries, actual_times)',
    verdict: 'ml', why: 'Traffic, weather, driver, time of day, order size. Too many interacting factors to hand-tune, and you already have the history.' },
  { q: 'Compute VAT on an invoice',
    rules: 'total * rate_for(country)', ml: 'model.predict(invoice)',
    verdict: 'rules', why: 'It is a defined arithmetic fact. Learning it from data would be slower and occasionally wrong, which for tax is not a trade-off.' },
  { q: 'Decide which support ticket is urgent',
    rules: 'if "URGENT" in subject: escalate()', ml: 'model.fit(tickets, escalated)',
    verdict: 'ml', why: 'Urgency lives in the wording, the customer, the history. You have years of labelled tickets — that is exactly the case for learning it.' }
];

/* ---------- Ch2: data and splits ---------- */
C.splitParts = [
  { n: 'Train', pct: 60, c: '#7c5cff', d: 'The model sees these and fits its parameters to them.',
    warn: 'Performance here is an upper bound on optimism, never a report of quality.' },
  { n: 'Validation', pct: 20, c: '#22d3ee', d: 'Used to choose hyper-parameters, features and which model wins.',
    warn: 'You look at it many times, so it slowly leaks into your decisions and becomes optimistic too.' },
  { n: 'Test', pct: 20, c: '#34d399', d: 'Touched once, at the very end, to estimate real-world performance.',
    warn: 'Every extra peek costs you the honesty of the number. Use it once.' }
];
C.leakCases = [
  { t: 'Scaling before splitting',
    bad: 'X = scaler.fit_transform(X)\nX_tr, X_te = train_test_split(X)',
    good: 'X_tr, X_te = train_test_split(X)\nX_tr = scaler.fit_transform(X_tr)\nX_te = scaler.transform(X_te)',
    why: 'The scaler\'s mean and standard deviation were computed using test rows. The model has now seen a summary of data it is about to be graded on. Fit on train, transform both.' },
  { t: 'A feature that encodes the answer',
    bad: 'features = ["age", "plan", "cancellation_date"]',
    good: 'features = ["age", "plan", "logins_last_30d"]',
    why: '<span class="mono">cancellation_date</span> only exists <i>because</i> the customer churned. You get 99% accuracy in testing and 50% in production, because at prediction time that column is empty.' },
  { t: 'Random split on time-series data',
    bad: 'train_test_split(sales, shuffle=True)',
    good: 'train = sales[sales.date &lt; "2026-01-01"]\ntest  = sales[sales.date &gt;= "2026-01-01"]',
    why: 'A random split lets the model train on Wednesday and Friday to predict Thursday. In production the future is not available. Split on time, always.' },
  { t: 'Duplicate rows across the split',
    bad: 'train_test_split(df)  # df has near-duplicates',
    good: 'df = df.drop_duplicates(subset=key)\n# or split by group / customer id',
    why: 'The same customer appearing in both halves means the model is being tested on rows it memorised. Deduplicate, or split by group.' }
];

/* ---------- Ch3+4: linear regression, hours studied -> exam score ---------- */
C.regLabels = { x: 'hours studied per week', y: 'exam score', unit: '' };
C.regData = [
  [0.56,36.55],[1.05,41.74],[1.24,43.89],[1.81,45.7],[2.2,42.75],[2.46,52.53],
  [3.02,55.58],[3.32,53.05],[3.67,62.26],[4.22,54.95],[4.6,66.21],[4.88,57.51],
  [5.44,66.4],[5.66,71.22],[6.2,63.96],[6.61,75.09],[6.95,70.81],[7.3,75.87],
  [7.7,73.09],[8.24,86.24],[8.46,77.78],[8.8,82.49],[9.3,88.77],[9.72,91.25]
];
/* The demo starts the sliders here so gradient descent has visible work to do. */
C.regStart = { w: 2.0, b: 55 };
C.gdRates = [
  { lr: 0.001, tag: 'too small', c: '#6f7594', say: 'It moves in the right direction, just barely. With a hundred features and a real dataset this is a training run that never finishes.' },
  { lr: 0.010, tag: 'good',      c: '#34d399', say: 'Steady, monotonic descent. This is what a healthy loss curve looks like — steep at first, then flattening.' },
  { lr: 0.028, tag: 'fast',      c: '#22d3ee', say: 'Faster, and it still lands. Near the edge of stable, which is where you want to be if you are watching the curve.' },
  { lr: 0.045, tag: 'diverges',  c: '#fb7185', say: 'Each step overshoots the minimum by more than it started, so the error grows without limit. A loss going to NaN is almost always this.' }
];

/* ---------- Ch5: classification, two features ---------- */
C.clfLabels = { x: 'sessions per week', y: 'features used', c0: 'stayed', c1: 'upgraded' };
C.clfData = [
  [4.17,2.32,0],[3.3,4,0],[2.96,3.37,0],[3.1,2.69,0],[3.82,1.67,0],[2.48,4.62,0],
  [3.82,2.95,0],[2.87,3.79,0],[1.41,5.1,0],[3.73,3.43,0],[3.44,1.94,0],[2.86,2.18,0],
  [1.75,1.25,0],[3.13,1.06,0],[3.02,3.69,0],[2.81,4.66,0],[1.45,5.81,0],[2.25,1.77,0],
  [3.83,4.02,0],[1.51,2.4,0],[3.4,1.98,0],[2.16,1.72,0],[3.62,3.42,0],[2.65,0.53,0],
  [2.31,0.82,0],[1.91,2.53,0],[5.2,6.4,0],
  [5.49,4.73,1],[5.1,6.01,1],[7.12,5.86,1],[7.81,7.35,1],[5.49,6,1],[8.53,8.89,1],
  [5.24,7.51,1],[7.22,9.7,1],[7.04,7.8,1],[5.71,6.57,1],[7.6,5.1,1],[6.65,6.67,1],
  [6.95,6.68,1],[7.61,6.32,1],[6.56,6.51,1],[7.01,7.42,1],[5.27,6.12,1],[5.41,7.22,1],
  [3.5,7.06,1],[5.88,9.75,1],[7.82,6.88,1],[7.07,9.37,1],[7.12,6.97,1],[8.16,5.91,1],
  [6.74,7.77,1],[5.49,4.67,1],[4.9,3.1,1]
];

/* ---------- Ch6: evaluation. 22 scored predictions, sorted high to low ---------- */
C.scoredLabel = 'a churn model scoring 22 held-out customers';
C.scored = [
  [0.923,1],[0.913,1],[0.906,1],[0.825,1],[0.749,1],[0.627,0],[0.605,1],[0.594,0],
  [0.591,0],[0.589,1],[0.563,1],[0.517,1],[0.466,1],[0.463,1],[0.406,0],[0.301,0],
  [0.264,0],[0.263,0],[0.059,0],[0.02,0],[0.02,0],[0.02,0]
];
C.metricPick = [
  { case: 'Cancer screening', want: 'recall', why: 'A missed case is a death; a false alarm is one more test. Push the threshold down until recall is high, and accept the false positives.' },
  { case: 'Spam filter', want: 'precision', why: 'A real email in the spam folder is worse than a spam email in the inbox. Only flag when you are confident.' },
  { case: 'Fraud detection on 0.2% fraud', want: 'PR-AUC', why: 'Accuracy is 99.8% for a model that predicts "never fraud". With extreme imbalance, precision-recall tells you something and accuracy tells you nothing.' },
  { case: 'Ranking search results', want: 'ROC-AUC', why: 'You do not have one threshold, you have an ordering. AUC is exactly the probability that a random positive outranks a random negative.' },
  { case: 'Balanced A/B model comparison', want: 'F1', why: 'Roughly equal classes and equal costs — the harmonic mean of precision and recall is a fair single number.' }
];

/* ---------- Ch7: overfitting. True function is a smooth cubic ---------- */
C.polyTrue = 'y = 2 + 1.4x − 0.55x² + 0.045x³';
C.polyTrain = [
  [0.73,3.07],[1.1,3.65],[2.06,2.71],[2.74,2.8],[3.17,3.03],[4.17,1.9],[4.68,0.74],
  [5.32,0.53],[5.86,0.09],[6.88,0.28],[7.49,0.2],[8.13,1.62],[8.72,1.58],[9.6,4.09]
];
C.polyTest = [
  [0,1.57],[0.05,2.31],[0.25,2.51],[0.4,2.73],[0.59,2.47],[0.89,3.43],[1.54,2.1],
  [1.73,2.95],[1.97,2.12],[2.14,2.32],[2.53,2.54],[2.77,2.57],[3.09,2.68],[3.41,2.59],
  [3.46,1.66],[3.62,1.61],[3.85,1.95],[4.87,0.61],[5.4,0.59],[6.2,0.5],[6.42,0.44],
  [6.54,0.79],[7.51,0.11],[7.87,1.08],[9.11,3.19],[9.23,3.49],[9.37,4.66],[9.78,5.07],
  [9.84,5.34],[9.95,6.1]
];
C.fitNotes = {
  under: 'A straight line cannot bend. It is wrong in the same direction for whole regions of the data — that is <b>bias</b>, and more data will not fix it.',
  good:  'Enough flexibility to follow the real shape, not enough to chase the noise. Train and test error are close, which is the signal you want.',
  over:  'The curve threads every training point exactly and does something wild between them. Training error near zero, test error climbing — that is <b>variance</b>.'
};

/* ---------- Ch8: cross-validation ---------- */
C.cvNote = 'Five folds. Every row is held out exactly once, so every row gets to be test data.';
C.cvWhen = [
  { t: 'Use a single split when', v: 'you have a lot of data (say 100k+ rows) and training is expensive. One held-out set is already a stable estimate.' },
  { t: 'Use k-fold when', v: 'data is limited. A single 20% test set on 200 rows is 40 rows, and its score swings wildly depending on which 40.' },
  { t: 'Use stratified k-fold when', v: 'classes are imbalanced. It keeps the class ratio in every fold, so no fold accidentally contains three positives.' },
  { t: 'Use grouped k-fold when', v: 'rows are not independent — several rows per patient, per customer, per document. Split by the group, never by the row.' },
  { t: 'Use time-series splits when', v: 'order matters. Train on the past, test on the future, and roll the window forward. Never shuffle.' }
];

/* ---------- Ch9: decision trees. age -> churned ---------- */
C.treeLabels = { x: 'customer age', y: 'churned' };
C.treeData = [
  [21,1],[21,1],[22,1],[23,1],[24,1],[25,1],[27,1],[29,1],[30,1],[30,1],
  [32,1],[34,1],[39,0],[42,0],[47,0],[49,0],[50,1],[51,0],[57,0],[58,1]
];
C.treeNotes = 'A tree tries every possible threshold and keeps the one that separates the classes best. "Best" here means the biggest drop in <b>Gini impurity</b> — the chance of mislabelling a random sample if you guessed using the group\'s own class mix.';
C.ensembleCards = [
  { n: 'One decision tree', ico: '🌲',
    d: 'Splits until the leaves are pure. Fully readable, and it will memorise your training set given the chance.',
    good: 'You can print it and explain it to a regulator.', bad: 'High variance — change a few rows and the whole tree changes shape.' },
  { n: 'Random forest', ico: '🌳',
    d: 'Hundreds of trees, each on a bootstrap sample and a random subset of features, then vote.',
    good: 'The errors are decorrelated, so averaging cancels most of them. Strong out of the box.', bad: 'No longer one readable diagram, and the model is large.' },
  { n: 'Gradient boosting', ico: '🚀',
    d: 'Trees in sequence, each one fitting what the previous ones got wrong.',
    good: 'Usually the best result on tabular data. XGBoost, LightGBM, CatBoost all do this.', bad: 'More knobs to tune, and it will overfit happily if you let it run.' }
];

/* ---------- Ch10: k-means ---------- */
C.kmData = [
  [1.91,3.3],[2.8,0.68],[1.5,1.9],[1.7,1.4],[1.86,2.69],[1.52,2.35],[0.45,3.46],
  [2.38,1.59],[3.48,3.67],[2.89,1.82],[2.8,2.67],[1.59,3.19],[2.19,1.12],[2.79,3.04],
  [8.33,4.09],[8.83,2.93],[8.4,2.8],[7.83,3.23],[7.7,4.41],[6.8,1.97],[6.68,3.68],
  [9.1,3.27],[6.95,3.68],[7.09,2.43],[8.55,2.17],[7.06,5.12],[7.78,3.48],[8.29,1.88],
  [4.51,6.99],[3.64,7.26],[4.51,8.5],[4.12,8.67],[6.4,6.92],[4.65,7.74],[4.51,7.91],
  [4.24,6.64],[4.23,6.35],[5.6,7.32],[5.62,7.09],[5.41,7.5],[4.82,8.04],[5.87,8.13]
];
C.kmNotes = 'Two steps, repeated: <b>assign</b> every point to its nearest centre, then <b>move</b> each centre to the mean of the points that chose it. That is the entire algorithm. It always converges, and it converges to a local optimum that depends on where the centres started.';

/* ---------- Ch11: features and scaling ---------- */
C.scaleRows = [
  { f: 'age',            raw: [23, 41, 35, 58, 29], unit: 'years' },
  { f: 'annual_income',  raw: [31000, 88000, 54000, 120000, 46000], unit: '$' },
  { f: 'logins_per_day', raw: [1.2, 0.4, 3.1, 0.9, 2.2], unit: 'count' }
];
C.scaleWhy = 'Distance-based and gradient-based models treat "1 unit" the same for every feature. With income measured in tens of thousands and logins in single digits, income silently becomes the only feature that matters. Standardising puts every feature on the same footing — mean 0, standard deviation 1.';
C.scaleNeeds = [
  { m: 'k-means, kNN, SVM', need: true,  why: 'They measure distance. An unscaled large-range feature dominates every distance.' },
  { m: 'Linear / logistic regression with gradient descent', need: true, why: 'Wildly different scales make an elongated loss surface, so descent zig-zags and needs far more steps.' },
  { m: 'Neural networks', need: true, why: 'Same reason, plus saturating activations behave badly on large inputs.' },
  { m: 'Decision trees, random forests, gradient boosting', need: false, why: 'They split on thresholds within one feature at a time. Multiplying a column by 1000 changes nothing about which split is best.' }
];
C.featureCards = [
  { t: 'Categorical → numbers', code: 'pd.get_dummies(df["city"])          # one-hot\n# or, for high cardinality:\ndf["city_freq"] = df["city"].map(counts)',
    why: 'Never label-encode an unordered category into 0,1,2 for a linear model — you have just told it Paris is twice Berlin.' },
  { t: 'Dates → components', code: 'df["dow"]   = df.ts.dt.dayofweek\ndf["hour"]  = df.ts.dt.hour\ndf["is_we"] = df.dow &gt;= 5',
    why: 'A raw timestamp is a meaningless big integer. Day-of-week and hour are where the signal actually lives.' },
  { t: 'Missing values', code: 'df["income"].fillna(df["income"].median())\ndf["income_missing"] = df["income"].isna()',
    why: 'Impute, and keep a flag. The fact that a value was missing is often predictive all by itself.' },
  { t: 'Ratios beat raw counts', code: 'df["fail_rate"] = df.failures / df.attempts',
    why: '3 failures means nothing without knowing whether it was 4 attempts or 4,000. Divide.' }
];

/* ---------- Ch12: the workflow ---------- */
C.workflow = [
  { n: 'Frame the problem', ico: '🎯',
    d: 'What decision changes because of this prediction? What does a wrong answer cost, in each direction?',
    trap: 'Building a model nobody will act on. If no decision changes, stop here.' },
  { n: 'Get and check the data', ico: '📦',
    d: 'Look at it. Distributions, missing values, duplicates, obvious impossibilities.',
    trap: 'Trusting a column because it has a sensible name. Plot everything once.' },
  { n: 'Split first', ico: '✂️',
    d: 'Hold out test data before you do anything else — before scaling, before imputing, before looking.',
    trap: 'Every leakage bug starts by doing something to the whole dataset.' },
  { n: 'Baseline', ico: '📏',
    d: 'Predict the mean, or the majority class, or last week\'s value. Write the number down.',
    trap: 'Skipping it, then celebrating an 87% that a constant predictor also reaches.' },
  { n: 'Simple model', ico: '📐',
    d: 'Linear or logistic regression, or one shallow tree. Fast, debuggable, and often close to the ceiling.',
    trap: 'Starting with a neural network on 900 rows of tabular data.' },
  { n: 'Iterate on features', ico: '🔧',
    d: 'Better features beat fancier models on tabular data almost every time. This is where the wins are.',
    trap: 'Tuning hyper-parameters for a week to gain 0.4% while an obvious feature is missing.' },
  { n: 'Tune, with cross-validation', ico: '🎛️',
    d: 'Search hyper-parameters against validation folds, not the test set.',
    trap: 'Selecting on the test set. That number is now meaningless and you cannot get it back.' },
  { n: 'Evaluate once, honestly', ico: '⚖️',
    d: 'Test set, the metric that matches the real cost, plus a confusion matrix and error analysis.',
    trap: 'Reporting accuracy on imbalanced data.' },
  { n: 'Ship and monitor', ico: '🚀',
    d: 'Log inputs and predictions. Watch for drift. Plan the retrain before you need it.',
    trap: 'Assuming the world stays the shape it was on training day. It does not.' }
];

/* ---------- Ch13: quiz + glossary ---------- */
C.quiz = [
  { q: 'What makes a problem "supervised"?', o: ['It uses a neural network', 'The training data includes the correct answers', 'A human watches it train', 'It runs on labelled hardware'], a: 1,
    e: 'Supervised means every training example carries its target. Getting those labels is usually the expensive part of the project.' },
  { q: 'Why hold out a test set?', o: ['To speed up training', 'To estimate performance on data the model has never seen', 'Because the library requires it', 'To reduce memory use'], a: 1,
    e: 'Training error measures memorisation. Only unseen data tells you whether the model generalises.' },
  { q: 'What does gradient descent actually do?', o: ['Tries every parameter combination', 'Steps the parameters downhill along the loss gradient', 'Sorts the data by error', 'Solves the equation exactly'], a: 1,
    e: 'It computes which way the loss decreases fastest and takes a small step that way, repeatedly.' },
  { q: 'Your loss goes to NaN after a few steps. Most likely cause?', o: ['Too little data', 'Learning rate too high', 'Learning rate too low', 'Wrong metric'], a: 1,
    e: 'Too large a step overshoots the minimum by more than it started with, so the error grows every iteration until it blows up.' },
  { q: 'Training error is 2%, test error is 30%. What is happening?', o: ['Underfitting', 'Overfitting', 'The data is too clean', 'The learning rate is too low'], a: 1,
    e: 'The model memorised the training set including its noise. Classic high variance — get more data, simplify the model, or regularise.' },
  { q: 'A model that always predicts "not fraud" scores 99.8% accuracy. What went wrong?', o: ['Nothing, it is a good model', 'Accuracy is the wrong metric for imbalanced classes', 'The test set is too small', 'It needs more features'], a: 1,
    e: 'With 0.2% positives, accuracy rewards ignoring them entirely. Use precision, recall, or PR-AUC.' },
  { q: 'What is recall?', o: ['Of the ones flagged, how many were right', 'Of the real positives, how many were caught', 'Overall correctness', 'The speed of prediction'], a: 1,
    e: 'Recall = TP / (TP + FN). Precision is the other one: TP / (TP + FP), of what you flagged, how much was right.' },
  { q: 'Lowering the decision threshold does what?', o: ['Raises precision, lowers recall', 'Raises recall, lowers precision', 'Raises both', 'Changes neither'], a: 1,
    e: 'A lower bar flags more cases, so you catch more real positives and also more false alarms. It is always a trade.' },
  { q: 'Why fit the scaler on the training set only?', o: ['It is faster', 'Otherwise test statistics leak into training', 'Scalers cannot handle test data', 'To save memory'], a: 1,
    e: 'Fitting on everything means the mean and standard deviation carry information from rows you are about to be graded on.' },
  { q: 'Which model does NOT need feature scaling?', o: ['k-nearest neighbours', 'k-means', 'Gradient boosted trees', 'Logistic regression trained by gradient descent'], a: 2,
    e: 'Trees split on a threshold inside one feature at a time, so rescaling a column changes nothing. The other three all measure distance or descend a gradient.' },
  { q: 'What is k-fold cross-validation for?', o: ['Making training faster', 'Getting a more stable performance estimate from limited data', 'Removing outliers', 'Choosing the number of clusters'], a: 1,
    e: 'Every row is held out exactly once, so the estimate does not depend on which single split you happened to draw.' },
  { q: 'What does k-means actually optimise?', o: ['Classification accuracy', 'Total squared distance from points to their assigned centre', 'The number of clusters', 'The margin between clusters'], a: 1,
    e: 'It minimises within-cluster sum of squares by alternating assign and move. It cannot tell you what k should be.' },
  { q: 'Your churn model uses a "cancellation_date" column and scores 99%. What is wrong?', o: ['Nothing, it is a strong model', 'Target leakage — that column only exists after churn', 'The model is underfitting', 'Not enough features'], a: 1,
    e: 'At prediction time that column is empty. The model learned to read the answer, and it will collapse in production.' },
  { q: 'What is a baseline for?', o: ['Warming up the GPU', 'Knowing whether your real model adds anything', 'Initialising the weights', 'Splitting the data'], a: 1,
    e: 'Predict the mean or the majority class first. If your model does not clearly beat it, you have learned something important.' },
  { q: 'Bias and variance, in one line each?', o: ['Bias = noise, variance = signal', 'Bias = too simple to fit the truth, variance = too sensitive to this particular data', 'Bias = bad labels, variance = bad features', 'They are the same thing'], a: 1,
    e: 'High bias underfits and more data will not help. High variance overfits and more data usually does.' }
];
C.glossary = [
  ['Feature', 'One input column. Also called a predictor or independent variable.'],
  ['Label / target', 'The thing you are predicting. Present in supervised training data.'],
  ['Model', 'A function with parameters, fitted to data, that maps features to a prediction.'],
  ['Parameter', 'A number the model learns — a weight or bias.'],
  ['Hyper-parameter', 'A number you choose before training — learning rate, tree depth, k.'],
  ['Loss function', 'How wrong a prediction is. MSE for regression, cross-entropy for classification.'],
  ['Gradient descent', 'Repeatedly step parameters against the gradient of the loss.'],
  ['Learning rate', 'How big each step is. Too small crawls, too large diverges.'],
  ['Epoch', 'One full pass over the training data.'],
  ['Train / validation / test', 'Fit on the first, choose on the second, report on the third — once.'],
  ['Overfitting', 'Great on training data, poor on new data. High variance.'],
  ['Underfitting', 'Poor on both. The model is too simple. High bias.'],
  ['Regularisation', 'Penalising complexity — L1, L2, dropout, early stopping, pruning.'],
  ['Bias-variance trade-off', 'Simple models miss the shape; flexible models chase the noise.'],
  ['Cross-validation', 'Rotate which fold is held out so every row is tested once.'],
  ['Data leakage', 'Information from outside the training set reaching the model. The classic silent killer.'],
  ['Baseline', 'The dumbest reasonable predictor. Everything is measured against it.'],
  ['Confusion matrix', 'TP, FP, FN, TN laid out as a grid. Read it before any single metric.'],
  ['Precision', 'TP / (TP + FP). Of what you flagged, how much was right.'],
  ['Recall / sensitivity', 'TP / (TP + FN). Of what was real, how much you caught.'],
  ['F1', 'Harmonic mean of precision and recall. One number when both matter equally.'],
  ['ROC-AUC', 'Probability a random positive scores above a random negative. 0.5 is chance.'],
  ['Threshold', 'The score above which you predict positive. Tuning it moves precision against recall.'],
  ['Class imbalance', 'One class is rare. Accuracy stops being informative.'],
  ['Feature scaling', 'Standardising or normalising columns so no feature dominates by unit alone.'],
  ['One-hot encoding', 'Turning a category into one binary column per value.'],
  ['Gini impurity', 'Chance of mislabelling a random sample using the group\'s own class mix. Trees minimise it.'],
  ['Ensemble', 'Many models combined. Bagging averages, boosting corrects in sequence.'],
  ['k-means', 'Unsupervised clustering: assign to the nearest centre, move centres to the mean, repeat.'],
  ['Inertia', 'Total squared distance from points to their cluster centre. What k-means minimises.'],
  ['Drift', 'The world changes and the training distribution stops matching production.']
];
