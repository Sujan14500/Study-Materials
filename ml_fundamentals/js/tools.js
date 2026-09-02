/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: evaluation ---------- */
C.toolstrips.evaluation = {
  title: 'Tools & frameworks — measuring a model',
  sub: 'Nothing here is exotic. What separates people is knowing which metric answers which question, and which library already computes it correctly.',
  tools: [
    { n: 'sklearn.metrics', by: 'scikit-learn', mark: 'sk', c: '#f7931e',
      what: 'Every classification and regression metric you need, plus the confusion matrix and the curves.',
      pro: ['classification_report gives precision, recall and F1 per class in one call', 'Handles multi-class averaging correctly, which people get wrong by hand', 'Curves and thresholds included'],
      con: ['Silently gives a flattering number on imbalanced data if you ask for accuracy', 'Default averaging choices hide per-class failures'],
      use: 'Always. Writing your own F1 is how sign errors get shipped.' },
    { n: 'Confusion matrix display', by: 'scikit-learn', mark: '▦', c: '#f7931e',
      what: 'The picture that turns four numbers into an argument about which error is worse.',
      pro: ['Makes the cost asymmetry visible to non-technical stakeholders', 'Shows exactly which classes are being confused', 'Normalisation by row or column answers different questions'],
      con: ['Useless past a dozen classes without sorting', 'Says nothing about calibration'],
      use: 'Every classification review. Bring it to the meeting instead of an accuracy number.' },
    { n: 'Calibration curves', by: 'scikit-learn', mark: '📈', c: '#7c5cff',
      what: 'Plots predicted probability against observed frequency, so you can see whether 0.8 means 80%.',
      pro: ['Essential once a threshold or a cost decision depends on the score', 'CalibratedClassifierCV fixes what it reveals', 'Trees and boosted models are usually badly calibrated'],
      con: ['Needs enough data per bin to be readable', 'Improving calibration can slightly worsen ranking'],
      use: 'Whenever the probability itself is used, not just the argmax.' },
    { n: 'MLflow', by: 'Databricks / LF AI', mark: 'ml', c: '#0194e2',
      what: 'Logs every run: parameters, metrics, artefacts and the model, so results are comparable months later.',
      pro: ['Answers "which run produced this model" definitively', 'Comparison UI across dozens of runs', 'Model registry with stages'],
      con: ['A server and a store to operate', 'Discipline required — an unlogged run may as well not exist'],
      use: 'The moment you have more than a handful of experiments to compare.' },
    { n: 'Weights & Biases', by: 'W&B', mark: 'wb', c: '#ffbe00',
      what: 'Hosted experiment tracking with live charts, sweeps and shareable reports.',
      pro: ['Live training curves you can watch and share', 'Hyperparameter sweeps built in', 'Reports make results reviewable by a team'],
      con: ['Hosted, with a real bill at scale', 'Self-hosting is enterprise only'],
      use: 'Teams that want experiment tracking without operating the tracker.' }
  ]
};

/* ---------- Ch: trees & ensembles ---------- */
C.toolstrips.trees = {
  title: 'Tools & frameworks — gradient boosting',
  sub: 'On tabular data these still beat deep learning most of the time. Knowing that, and why, is a strong interview answer.',
  tools: [
    { n: 'XGBoost', by: 'DMLC', mark: 'xg', c: '#337ab7',
      what: 'The boosted-tree library that won a decade of competitions. Regularised, sparsity-aware, everywhere.',
      pro: ['Excellent out of the box on tabular data', 'Handles missing values natively via learned default directions', 'Deployable everywhere, including ONNX'],
      con: ['Slower to train than LightGBM on wide data', 'Many hyperparameters and it is easy to overfit'],
      use: 'The default first model on any tabular problem, before anything neural.' },
    { n: 'LightGBM', by: 'Microsoft', mark: 'lg', c: '#02b3a4',
      what: 'Leaf-wise growth with histogram binning. Usually the fastest of the three at similar accuracy.',
      pro: ['Substantially faster on large datasets', 'Native categorical feature handling — no one-hot explosion', 'Lower memory footprint'],
      con: ['Leaf-wise growth overfits small datasets without num_leaves care', 'Slightly more tuning-sensitive'],
      use: 'Large tabular datasets, or anywhere training time is a bottleneck.' },
    { n: 'CatBoost', by: 'Yandex', mark: 'cb', c: '#ffcc00',
      what: 'Ordered boosting with built-in target encoding for categorical features.',
      pro: ['Best defaults of the three — often strong with no tuning', 'Handles high-cardinality categoricals without leakage', 'Ordered boosting reduces a subtle overfitting bias'],
      con: ['Slower training in some configurations', 'Smaller ecosystem and fewer integrations'],
      use: 'Lots of categorical features, or you want a strong baseline with minimal tuning.' },
    { n: 'RandomForest', by: 'scikit-learn', mark: 'rf', c: '#f7931e',
      what: 'Bagged trees. Not the strongest, but almost impossible to overfit badly and needs no tuning.',
      pro: ['Works with default settings', 'Parallel and fast to train', 'A trustworthy baseline that tells you if boosting is even helping'],
      con: ['Usually a few points behind gradient boosting', 'Large models are memory-hungry'],
      use: 'The baseline you compare boosting against, so you know the gain is real.' },
    { n: 'SHAP', by: 'Lundberg / community', mark: '◈', c: '#a78bfa',
      what: 'Per-prediction feature attributions with a game-theoretic basis, and the plots people actually understand.',
      pro: ['Explains a single prediction, not just the model', 'Beeswarm plots reveal interactions and data bugs', 'Fast exact algorithm for tree models'],
      con: ['Expensive on non-tree models', 'Correlated features make attributions misleading'],
      use: 'Any model whose decisions a human must justify, and for finding leakage.' }
  ]
};

/* ---------- Ch: features & scaling ---------- */
C.toolstrips.features = {
  title: 'Tools & frameworks — feature engineering',
  sub: 'The whole point of this layer is that the same transformation must run at training time and at serving time. Everything here exists to enforce that.',
  tools: [
    { n: 'Pipeline', by: 'scikit-learn', mark: '⛓', c: '#f7931e',
      what: 'Chains transformers and the estimator into one object that fits and predicts as a unit.',
      pro: ['Makes leakage structurally hard — the scaler fits inside each CV fold', 'One object to pickle, so serving matches training', 'Grid search can tune preprocessing too'],
      con: ['Debugging an intermediate step takes more effort', 'Custom transformers need the fit/transform contract'],
      use: 'Always. A scaler fitted outside cross-validation is the classic leakage bug.' },
    { n: 'ColumnTransformer', by: 'scikit-learn', mark: '⫼', c: '#f7931e',
      what: 'Applies different transformations to different columns — scale the numbers, encode the categories.',
      pro: ['Keeps heterogeneous preprocessing in one declarative object', 'remainder="passthrough" avoids silently dropping columns', 'Composes into a Pipeline'],
      con: ['Column names after transformation are awkward to recover', 'Easy to leave a column out by accident'],
      use: 'Any real dataset, because real datasets are never all one type.' },
    { n: 'pandas', by: 'pandas', mark: '🐼', c: '#150458',
      what: 'Where the actual feature engineering happens: joins, group-bys, rolling windows, date parts.',
      pro: ['Expressive enough for almost any derived feature', 'The ecosystem everything else reads and writes', 'Fast enough up to a few million rows'],
      con: ['Chained assignment and copy semantics cause silent bugs', 'Feature logic written here rarely runs identically in production'],
      use: 'Exploration and offline features. Port the logic into the pipeline before shipping.' },
    { n: 'Feature stores', by: 'Feast / Tecton', mark: 'fs', c: '#22d3ee',
      what: 'One definition of a feature, served offline for training and online for inference from the same source.',
      pro: ['Directly attacks training/serving skew', 'Point-in-time correct joins prevent leakage from the future', 'Features become reusable across teams'],
      con: ['Real infrastructure for a problem small teams solve with discipline', 'Another system in the critical path'],
      use: 'Several models share features, or online and offline paths have already drifted.' },
    { n: 'Great Expectations', by: 'Great Expectations', mark: '✓', c: '#ff6310',
      what: 'Assertions about data — ranges, nulls, cardinality, distributions — run as a gate in the pipeline.',
      pro: ['Catches the upstream schema change before it silently degrades the model', 'Documents what the model assumes about its input', 'Runs in CI and in production'],
      con: ['Expectation suites need maintaining as data legitimately changes', 'Verbose configuration'],
      use: 'Any pipeline fed by data someone else owns, which is all of them.' }
  ]
};

/* ---------- Ch: the workflow ---------- */
C.toolstrips.workflow = {
  title: 'Tools & frameworks — the end-to-end workflow',
  sub: 'This is the toolchain an ML engineer is expected to name. Notebook to registry to serving, with the run recorded at every step.',
  tools: [
    { n: 'scikit-learn', by: 'scikit-learn', mark: 'sk', c: '#f7931e',
      what: 'The reference API for classical ML: fit, predict, transform, and everything composes.',
      pro: ['One consistent API across every model and transformer', 'Cross-validation, search and metrics all built in', 'The vocabulary every other library imitates'],
      con: ['Single-machine and mostly single-threaded by default', 'Not built for deep learning or very large data'],
      use: 'Every tabular problem, and as the baseline before anything heavier.' },
    { n: 'Optuna', by: 'Preferred Networks', mark: 'op', c: '#2f6fdb',
      what: 'Hyperparameter search with pruning: kill unpromising trials early instead of running them out.',
      pro: ['Far more efficient than grid search', 'Pruning saves most of the compute', 'define-by-run means conditional search spaces are natural'],
      con: ['Easy to overfit the validation set with too many trials', 'Needs a study store for distributed runs'],
      use: 'Once the model is chosen and the remaining gain is in the hyperparameters.' },
    { n: 'MLflow', by: 'Databricks / LF AI', mark: 'ml', c: '#0194e2',
      what: 'Tracking, a model registry with stages, and a packaging format that serves the model.',
      pro: ['One place that answers which code, data and parameters made this model', 'Registry stages give a promotion path', 'Framework-agnostic'],
      con: ['A server and artefact store to run', 'Only as good as the logging discipline around it'],
      use: 'The moment a model needs to be reproduced or promoted by someone else.' },
    { n: 'DVC', by: 'Iterative', mark: 'dv', c: '#945dd6',
      what: 'Git for data and models: version large files by hash, with reproducible pipeline stages.',
      pro: ['Datasets get versioned alongside the code that used them', 'Pipeline stages rerun only what changed', 'Works with the object store you already have'],
      con: ['Another concept for the team to learn', 'Merge conflicts on data pointers are unpleasant'],
      use: 'Datasets change over time and "which data trained this" must be answerable.' },
    { n: 'FastAPI + ONNX', by: 'community', mark: '🚪', c: '#009688',
      what: 'Export the trained model to a portable runtime and serve it behind a typed HTTP endpoint.',
      pro: ['ONNX drops Python from the serving path and speeds up inference', 'Pydantic validates the feature payload before it reaches the model', 'One image to deploy anywhere'],
      con: ['Not every estimator converts cleanly to ONNX', 'Preprocessing must be exported too or skew returns'],
      use: 'Any model other software will call in real time.' }
  ]
};
