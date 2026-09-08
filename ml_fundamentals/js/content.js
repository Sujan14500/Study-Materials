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
  { lr: 0.001, tag: 'too small', c: '#828aa8', say: 'It moves in the right direction, just barely. With a hundred features and a real dataset this is a training run that never finishes.' },
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
  ['Feature', 'One input column. Also called a predictor or independent variable.',
   "One column in a spreadsheet of houses. Bedrooms, postcode and floor area are three features."],
  ['Label / target', 'The thing you are predicting. Present in supervised training data.',
   "The house price you are trying to guess. Training data already has it filled in, the way an answer key already has the answers."],
  ['Model', 'A function with parameters, fitted to data, that maps features to a prediction.',
   "A recipe with adjustable amounts. Feed it bedrooms and postcode, it hands back a price."],
  ['Parameter', 'A number the model learns — a weight or bias.',
   "The amounts in that recipe, tuned by tasting. \"Add 30,000 per bedroom\" — the 30,000 is learned, not chosen by you."],
  ['Hyper-parameter', 'A number you choose before training — learning rate, tree depth, k.',
   "Oven temperature, not an ingredient. You set it before baking and the recipe never adjusts it for you."],
  ['Loss function', 'How wrong a prediction is. MSE for regression, cross-entropy for classification.',
   "The mark on a test, where lower is better. Missing a house price by 10k is a smaller loss than missing it by 200k."],
  ['Gradient descent', 'Repeatedly step parameters against the gradient of the loss.',
   "Walking downhill in thick fog. You cannot see the valley, so you feel which way the ground slopes, take a step that way, and feel again."],
  ['Learning rate', 'How big each step is. Too small crawls, too large diverges.',
   "The size of those steps in the fog. Baby steps take all day; giant leaps bounce straight over the valley and land up the far side."],
  ['Epoch', 'One full pass over the training data.',
   "Reading the whole textbook once. Ten epochs is reading it ten times."],
  ['Train / validation / test', 'Fit on the first, choose on the second, report on the third — once.',
   "Homework, practice exam, real exam. You learn on the homework, pick your study strategy from the practice exam, and sit the real exam once. Sitting it twice is cheating yourself."],
  ['Overfitting', 'Great on training data, poor on new data. High variance.',
   "A student who memorised the practice questions instead of learning the subject. Full marks on the practice paper, lost on the real one."],
  ['Underfitting', 'Poor on both. The model is too simple. High bias.',
   "A student who skimmed one page the night before. Bad on the practice paper too."],
  ['Regularisation', 'Penalising complexity — L1, L2, dropout, early stopping, pruning.',
   "Forcing the student to explain their answer simply. Elaborate special-case explanations lose marks, so they learn the actual rule instead."],
  ['Bias-variance trade-off', 'Simple models miss the shape; flexible models chase the noise.',
   "A straight line through a curve misses the shape. A line joining every single dot traces wobbles that were only measurement noise. You want the one in between."],
  ['Cross-validation', 'Rotate which fold is held out so every row is tested once.',
   "Five practice exams instead of one. Every question gets to be a test question exactly once, so a single lucky or unlucky paper cannot fool you."],
  ['Data leakage', 'Information from outside the training set reaching the model. The classic silent killer.',
   "The answers were printed on the back of the homework. The model scores brilliantly, learns nothing, and you only find out in production."],
  ['Baseline', 'The dumbest reasonable predictor. Everything is measured against it.',
   "\"Always guess the average house price.\" If your clever model cannot beat that, it is not clever."],
  ['Confusion matrix', 'TP, FP, FN, TN laid out as a grid. Read it before any single metric.',
   "Four buckets for a spam filter: spam caught, real mail wrongly binned, spam that got through, real mail delivered. One accuracy number hides which bucket is hurting you."],
  ['Precision', 'TP / (TP + FP). Of what you flagged, how much was right.',
   "Of the emails you binned as spam, how many really were spam. Low precision means your boss loses real mail."],
  ['Recall / sensitivity', 'TP / (TP + FN). Of what was real, how much you caught.',
   "Of all the spam that arrived, how much you actually binned. Low recall means spam sitting in the inbox."],
  ['F1', 'Harmonic mean of precision and recall. One number when both matter equally.',
   "One combined mark for when losing real mail and letting spam through hurt about the same. It punishes being brilliant at one and awful at the other."],
  ['ROC-AUC', 'Probability a random positive scores above a random negative. 0.5 is chance.',
   "Pick one real spam and one real email at random. AUC is how often the model rates the spam as the more spam-like of the two. 0.5 is a coin flip."],
  ['Threshold', 'The score above which you predict positive. Tuning it moves precision against recall.',
   "How suspicious an email has to look before you bin it. Strict and spam slips through; loose and your boss loses mail. Same model, different dial."],
  ['Class imbalance', 'One class is rare. Accuracy stops being informative.',
   "One card payment in 10,000 is fraud. A model that always says \"not fraud\" is 99.99% accurate and completely useless."],
  ['Feature scaling', 'Standardising or normalising columns so no feature dominates by unit alone.',
   "Salary is in tens of thousands, age is in tens. Without rescaling, the model treats salary as a thousand times more important purely because of the units."],
  ['One-hot encoding', 'Turning a category into one binary column per value.',
   "Colour red/green/blue becomes three yes-no columns. Numbering them 1, 2, 3 instead would tell the model that green sits halfway between red and blue, which is nonsense."],
  ['Gini impurity', 'Chance of mislabelling a random sample using the group\'s own class mix. Trees minimise it.',
   "Pull one person out of a group and guess their team from the group's own mix. Gini is how often you would be wrong. A group that is all one team is never wrong — which is why trees keep splitting until groups are pure."],
  ['Ensemble', 'Many models combined. Bagging averages, boosting corrects in sequence.',
   "A hundred people guessing the weight of a cow. Bagging averages every guess; boosting sends each new guesser to study the ones everybody got wrong."],
  ['k-means', 'Unsupervised clustering: assign to the nearest centre, move centres to the mean, repeat.',
   "Drop three flags on a map of houses. Every house joins its nearest flag, then each flag moves to the middle of its own houses. Repeat until the flags stop moving."],
  ['Inertia', 'Total squared distance from points to their cluster centre. What k-means minimises.',
   "Total walking distance from every house to its flag. Adding flags always shortens it — which is exactly why inertia alone cannot tell you how many flags to use."],
  ['Drift', 'The world changes and the training distribution stops matching production.',
   "Your 2019 model prices houses the way people wanted houses in 2019. The model has not changed; the world did."]
];

/* ============================================================
   Plain-English chapter openers.

   C.plain[id]  — [headline, body]. Read on its own, by someone who
                  has never met any of this. No symbols, no acronyms.
   C.terms[id]  — the words that actually appear on that chapter's
                  screen, defined where you meet them rather than
                  only in the glossary at the very end.

   demos.js injects both above the first panel, so adding a chapter
   means adding an entry here and nothing else. test.js refuses a
   chapter that has no entry, and refuses an opener that uses the
   jargon it is supposed to be explaining.
   ============================================================ */
C.plain = {
  what: ['Instead of writing the rule yourself, you show a computer thousands of examples and let it work the rule out.',
    'Writing "an email is spam if it contains the word viagra" is you knowing the rule. Machine learning is handing over ten thousand emails you have already sorted and letting the computer find the pattern for itself &mdash; including the parts you would never have thought to write down. It is worth doing only when the rule is too messy or changes too often to write by hand, which is the first question this chapter makes you ask.'],

  data: ['Hide some of your data before you start, and do not look at it again until the very end.',
    'If you use every row to build the model, you have no honest way of telling whether it learned anything or simply memorised what it was shown. So you put a portion in a drawer. The model never sees it while learning, and how it does on that hidden portion is the only trustworthy guess you have about how it will behave on real data tomorrow.'],

  regression: ['Draw the straightest line you can through a cloud of dots, then measure how badly it misses.',
    'Each blue dot in the picture is one of 24 students: how many hours they studied, and what they scored in the exam. You want a rule that turns hours into a predicted score, and the simplest possible rule is a straight line. A straight line is completely described by exactly two numbers &mdash; how steep it is, and how high up it starts. Training, here, means nothing more mysterious than hunting for the pair of numbers that makes the line pass as close as it can to all 24 dots at once.'],

  gradient: ['When you cannot just solve for the best answer, feel which way is downhill and take a step.',
    'Picture standing on a hillside in thick fog, trying to reach the lowest point. You cannot see the valley, but you can feel which way the ground slopes under your feet, so you step that way and then feel again. That is the entire algorithm. The hillside is "how wrong the model is" for every possible setting of its numbers, and the bottom of the valley is the setting you are looking for.'],

  classification: ['The same idea as the line, except the answer is now a category rather than a number.',
    'Predicting an exam score gives you a number. Predicting spam or not spam is a choice between two boxes. So instead of a line drawn <i>through</i> the dots, you want a line drawn <i>between</i> two groups of dots, keeping them apart. The model still works in numbers underneath, but at the end it squeezes its answer into a confidence between 0 and 1: how sure am I that this one belongs in the first box.'],

  evaluation: ['How often the model is right is usually the least useful thing you can measure.',
    'If one card payment in ten thousand is fraudulent, a model that shrugs and says "not fraud" every single time is right 99.99% of the time and catches nothing at all. That is why the rest of this chapter exists. You need numbers that tell the two different ways of being wrong apart, because in real life a false alarm and a miss almost never cost the same amount.'],

  overfitting: ['A model can score brilliantly on the data it studied and be useless on anything new.',
    'It is the student who memorised last year\'s exam paper instead of learning the subject. Given enough freedom, a model starts fitting the random flukes in your training rows as though they were the pattern. On the rows it studied it looks like it is still improving. On the only thing you actually care about &mdash; tomorrow\'s data &mdash; it is getting worse, and nothing warns you.'],

  cv: ['One split is one opinion. Rotate the split five times and you get an answer you can trust.',
    'If you hold back a single chunk of your data and score against it, all you have learned is how the model does on that one chunk. Draw an unlucky chunk and you will throw away a perfectly good model; draw a lucky one and you will ship a bad one with confidence. So you repeat the whole exercise with a different chunk held back each time, until every row has had exactly one turn at being the test.'],

  trees: ['Twenty questions. Each question splits the group in two, and the model keeps whichever question separates best.',
    'A decision tree asks something like "did they study more than four hours?", splits everyone into a yes pile and a no pile, then asks another question inside each pile. It keeps going until the piles are tidy enough. Nothing about it is clever: at every step it simply tries every question it could ask and keeps the one that tidies the piles the most.'],

  clustering: ['Nobody labelled anything. You are asking the data what groups are hiding in it.',
    'Everything up to here had right answers to learn from. This does not &mdash; just customers, or documents, or readings, and a suspicion that they fall into natural groups. The catch is that with no right answers there is also nothing to check yourself against, which makes "is this any good?" a genuinely harder question than it first sounds.'],

  features: ['The columns you feed the model matter far more than which model you picked.',
    'Two things go wrong here, both silently. One: your columns are on wildly different scales &mdash; salary in tens of thousands sitting next to age in tens &mdash; and the model concludes salary is a thousand times more important purely because of the units it happens to be measured in. Two: a category like colour gets numbered 1, 2 and 3, which quietly tells the model that green sits halfway between red and blue. Neither of them raises an error.'],

  workflow: ['Nine steps from a question to something running, and a specific way to trip over each one.',
    'Most real machine learning failures are not clever modelling mistakes. They are ordinary process mistakes: rescaling the data before splitting it, having no simple baseline so nobody can tell whether the model is actually any good, or shipping something with no way of noticing when it slowly stops working.'],

  quiz: ['Every question here is about something you already dragged a slider on.',
    'Nothing in the quiz is new material. Getting one wrong is useful rather than embarrassing &mdash; each explanation names the chapter worth going back to, and you can retake the whole thing as often as you like. Underneath it is the glossary: every term in the course, each with a plain-English example attached.']
};

C.terms = {
  what: [
    ['Model', 'What comes out of the whole process. Hand it a new email and it guesses spam or not spam.'],
    ['Training', 'Showing it examples where you already know the right answer, so it can find the pattern.'],
    ['Supervised', 'You have the right answers for your examples. Almost all useful machine learning is this.'],
    ['Unsupervised', 'You have no answers, only the data, and you are asking what structure is already in there.']
  ],
  data: [
    ['Training set', 'The rows the model actually learns from. Usually about 60&ndash;70% of what you have.'],
    ['Validation set', 'The rows you use to choose between options &mdash; which settings, which model. You may look at this one as often as you like.'],
    ['Test set', 'The rows you look at once, at the very end, to report a number. Looking twice quietly turns it into another validation set.'],
    ['Data leakage', 'Anything from outside the training rows sneaking into the model. It makes your scores look wonderful and mean nothing.']
  ],
  regression: [
    ['Slope <span class="mono">w</span>', 'How steep the line is &mdash; how many extra exam marks one extra hour of study buys you. Drag it and the line tilts.'],
    ['Intercept <span class="mono">b</span>', 'Where the line starts: the score it predicts for someone who studied zero hours. Drag it and the whole line slides up or down without tilting.'],
    ['Residual', 'One red vertical line in the picture &mdash; the gap between what a real student actually scored and what your line predicted for them. That gap is the miss.'],
    ['Mean squared error', 'One number summing up all 24 misses. Square each gap, so that too high and too low are both simply "wrong", then take the average. Lower is a better line; zero would mean the line goes exactly through every dot.'],
    ['Fitting', 'The hunt for the slope and intercept that make that number as small as it will go. That is all training is here.']
  ],
  gradient: [
    ['Gradient', 'Which way is downhill, and how steeply &mdash; worked out with calculus rather than by feel.'],
    ['Learning rate', 'How big a step you take. Tiny steps take forever; huge steps leap clean over the valley and land higher up the other side.'],
    ['Epoch', 'One complete pass over all of your training rows.'],
    ['Batch', 'How many rows you look at before taking one step. All of them is slow and steady, one at a time is fast and jittery, a few dozen is the usual compromise.'],
    ['Convergence', 'The point where further steps stop improving anything, because you have reached the bottom or something flat enough to call the bottom.']
  ],
  classification: [
    ['Decision boundary', 'The line the model draws between the two groups. Anything on one side gets one label, anything on the other side gets the other.'],
    ['Logistic regression', 'The standard way of doing this. Despite the name it classifies &mdash; the "regression" part is what happens before the squashing.'],
    ['Sigmoid', 'The squash. It takes whatever number the model produced and bends it into a confidence between 0 and 1.'],
    ['Threshold', 'How confident the model has to be before you actually act on it. Move it and you trade one kind of mistake for the other.'],
    ['Linearly separable', 'Whether one straight line can genuinely keep the two groups apart. Often it cannot, which is where curves and neural networks come in.']
  ],
  evaluation: [
    ['Accuracy', 'What fraction of all predictions were right. Fine when both outcomes are common, actively misleading when one of them is rare.'],
    ['Precision', 'Of the things you flagged, how many really were. Low precision means you cry wolf.'],
    ['Recall', 'Of the things that really were, how many you caught. Low recall means you let them through.'],
    ['F1', 'One number combining precision and recall, for when both matter about equally. It punishes being brilliant at one and hopeless at the other.'],
    ['Confusion matrix', 'The four boxes underneath all of the above: caught it, false alarm, missed it, correctly ignored.'],
    ['ROC-AUC', 'Take one real positive and one real negative at random. This is how often the model rates the positive as the more likely of the two. 0.5 is a coin flip.']
  ],
  overfitting: [
    ['Overfitting', 'Great on the rows it studied, poor on new ones. The model chased the noise.'],
    ['Underfitting', 'Poor on both. The model was too simple to catch the pattern in the first place.'],
    ['Bias', 'Error that comes from being too simple &mdash; a straight line where the truth curves.'],
    ['Variance', 'Error that comes from being too sensitive &mdash; the answer swings about wildly if you change a handful of training rows.'],
    ['Regularisation', 'Deliberately penalising complexity, so the model prefers a simple explanation over an elaborate one.'],
    ['L1 and L2', 'Two ways of applying that penalty. L1 tends to switch whole features off; L2 tends to shrink them all a little.']
  ],
  cv: [
    ['Fold', 'One of the chunks you cut the data into. Five folds means five chunks, and five separate rounds of train-then-score.'],
    ['k-fold', 'The standard version of this. k is how many chunks; five or ten are the usual choices.'],
    ['Stratified', 'Cutting the chunks so each one holds the same mix of outcomes as the whole. Essential as soon as one outcome is rare.'],
    ['Learning curve', 'Score plotted against how much data you used. It answers "would collecting more data actually help, or am I stuck?"']
  ],
  trees: [
    ['Split', 'One question, and the threshold it uses. "Hours studied above 4.2?"'],
    ['Gini impurity', 'How mixed a pile is. Pull one member out at random and guess their label from the pile\'s own mix &mdash; Gini is how often you would be wrong. Zero means the pile is entirely one label.'],
    ['Depth', 'How many questions deep the tree may go. Deeper fits the training rows better and starts memorising sooner.'],
    ['Random forest', 'Grow hundreds of trees on random slices of the data and average them. Individually shaky, collectively steady.'],
    ['Boosting', 'Grow trees one after another, each new one concentrating on what the previous ones got wrong. Usually the strongest thing you can run on table-shaped data.']
  ],
  clustering: [
    ['Cluster', 'One of the groups the algorithm decides is there.'],
    ['Centroid', 'The middle of a cluster &mdash; the average of everything currently assigned to it.'],
    ['k-means', 'Drop k markers on the map, send every point to its nearest marker, move each marker to the middle of its own points, and repeat until nothing moves.'],
    ['k', 'How many groups you told it to find. It will happily find exactly that many whether or not they exist.'],
    ['Inertia', 'Total distance from points to their own centroid. It always improves when you add more clusters, which is precisely why it cannot tell you the right k on its own.']
  ],
  features: [
    ['Feature', 'One input column. Hours studied is a feature; so is postcode.'],
    ['Scaling / standardising', 'Rewriting every column onto a comparable range, so none of them dominates simply by being measured in bigger units.'],
    ['Normalising', 'A related rescaling that squeezes values into a fixed range, often 0 to 1.'],
    ['One-hot encoding', 'Turning a category into one yes-no column per value, so the model cannot invent an ordering that was never there.'],
    ['Pipeline', 'Bundling the rescaling and the model together, so the rescaling is worked out from training rows only. Doing it beforehand across all your data is leakage.']
  ],
  workflow: [
    ['Baseline', 'The dumbest reasonable answer &mdash; always guess the average, or always guess the commonest outcome. Everything else is measured against it.'],
    ['Pipeline', 'The whole sequence wired up as one object, so the steps always happen in the same order during training and on live data.'],
    ['Drift', 'The world moving away from the data you trained on. Nothing breaks and no error appears; the model just quietly gets worse.'],
    ['Monitoring', 'Watching for exactly that. It belongs in the design, not in a follow-up ticket.']
  ]
};
