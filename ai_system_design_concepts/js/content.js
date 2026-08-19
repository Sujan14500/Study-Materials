/* ============================================================
   content.js — every piece of course content lives here.
   Edit this file to change the course; demos.js only renders it.
   ============================================================ */
window.C = {};

/* ============================================================
   ONE RUNNING EXAMPLE

   Every chapter comes back to the same imaginary product, so you
   are never learning a new domain and a new concept at once.
   ============================================================ */
C.runningExample = {
  name: 'Snackr',
  what: 'a food-delivery app',
  blurb: 'You open it, it shows you restaurants, you search for "biryani", you pay, and if the order goes wrong you message support. Four screens — and each one is a different AI system design problem. We will build all four across this course.',
  screens: [
    { ico: '🏠', n: 'The home feed', p: 'Which restaurants to show you, in which order.', ch: 'Chapters 6–7 — ranking and latency' },
    { ico: '🔍', n: 'Search', p: 'You type "biryani", it finds the right restaurants.', ch: 'Chapter 7 — retrieval' },
    { ico: '💳', n: 'Payment', p: 'Is this card being used by its real owner?', ch: 'Chapter 14 — fraud detection' },
    { ico: '💬', n: 'Support chat', p: '"Where is my order?" answered without a human.', ch: 'Chapters 12–13 — LLM systems' }
  ]
};

/* ============================================================
   PLAIN ENGLISH

   One jargon-free sentence per chapter, shown in a box at the top
   of that chapter before anything technical starts. If you only
   read these, you still learn something.
   ============================================================ */
C.plain = {
  vocab:      ['Before anything else, the words.', 'Every field has a private vocabulary, and AI system design has a dense one. None of these ideas are hard — but if nobody tells you what "p99" or "QPS" means, every sentence after it is noise. Ten minutes here makes the other fourteen chapters readable.'],
  framework:  ['Ask four questions before you design anything.', 'What counts as a good answer? How many people will use it? How fast must it reply? What data do we already have? Every later decision falls out of those four, which is why guessing at a model first goes wrong so reliably.'],
  metrics:    ['Whatever you measure is what you will get — including the stupid version of it.', 'Tell the system "get more clicks" and it learns clickbait. Not because it is broken; because it did exactly what you asked. So you pick a number carefully, and you pick a second number that catches the cheating.'],
  labels:     ['A model learns from examples, and someone had to produce those examples.', 'Usually it is your users, by clicking things. That is free and enormous — and biased, because people click what was shown first, not what was best. Where your examples came from shapes what your model believes.'],
  features:   ['Two bugs make a great model useless, and both are silent.', 'One: you accidentally let the model see the answer while training, so it looks brilliant in testing and useless in real life. Two: a number means one thing when you train and something slightly different when you run it live. Neither throws an error.'],
  ladder:     ['Fancier is not better. Cheapest-that-works is better.', 'There is a ladder from "a few if-statements" up to "a large language model", each rung roughly ten times more expensive to run. Pick the lowest rung that clears the bar. Most teams climb two rungs too high and pay for it every single day.'],
  funnel:     ['You cannot score a million things for every request, so you narrow down in stages.', 'First a cheap, rough filter cuts a million down to a thousand. Then a real model ranks those thousand. Then an expensive model polishes the top fifty. Cheap and rough first, slow and accurate last.'],
  latency:    ['You get a time budget, and every part of the system spends some of it.', 'If the whole page must appear in 200 milliseconds, and one step alone takes 900, that step cannot be in the page load. Working out the budget first rules out most of your options before you build anything.'],
  capacity:   ['How many machines do you need? It is multiplication, not magic.', 'Users × how often each one uses it ÷ seconds in a day = requests per second. Then: how many can one machine handle? Divide. That is the whole calculation, and doing it in your head prevents most bad architectures.'],
  eval:       ['Testing on old data is cheap and lies to you. Testing on real users is slow and tells the truth.', 'So you use a ladder: cheap tests catch obvious problems, and only the few changes that survive get put in front of real people. And you must decide how long to run that test before you start, not while you are watching it.'],
  loops:      ['A recommender only learns about things it showed you.', 'Anything it never shows gets no clicks, so it looks bad, so it never gets shown. The loop closes and the app slowly narrows to the same few items. Nothing breaks, no alarm goes off — it just quietly gets more boring.'],
  ragscale:   ['If the system fetches the wrong document, the answer cannot be right.', 'People blame the AI for "making things up" when usually the search step simply never found the correct paragraph. Fix the finding before you touch the wording.'],
  llmserving: ['Big AI models are charged by the word, in and out.', 'So the money goes on sending things you did not need to send. Route the easy questions to a small cheap model, keep answers short, and remember anything you already answered.'],
  designs:    ['Four real systems, walked through end to end.', 'The same nine steps applied to a feed, a search box, fraud detection and a support chatbot. They look like completely different products and the skeleton underneath is identical — which is the thing actually worth learning.'],
  operate:    ['Normal software keeps working. AI software rots.', 'The world changes, people change, fraudsters adapt, and the system quietly gets worse without ever throwing an error. So "how will we notice, and what do we do then" is part of the design, not a follow-up ticket.'],
  quiz:       ['Twelve questions, and an explanation after every one.', 'Nothing here is new — every question is about something you already pushed a slider on. Getting one wrong is useful information rather than a problem: the explanation tells you which chapter to go back to, and you can retake it as many times as you like.']
};

/* ============================================================
   Ch1: the vocabulary
   ============================================================ */
C.jargon = [
  { t: 'Model', short: 'A thing that has learned a pattern from examples and can guess about new cases.',
    like: 'A friend who has watched you order takeaway for a year and can now guess what you will want tonight. They cannot explain the rule — they have just seen a lot of Fridays.',
    at: 'Snackr uses one to guess which restaurants you will like.' },
  { t: 'Training vs serving', short: 'Training is teaching the model from old examples. Serving is using it live on a real request.',
    like: 'Revising for an exam versus sitting it. Same person, completely different conditions — and things that were available while revising (the textbook) are not available in the exam.',
    at: 'Snackr trains overnight on last month\'s orders and serves an answer in 80 milliseconds when you open the app.' },
  { t: 'Features', short: 'The facts you give the model about each case, as numbers.',
    like: 'When guessing whether you will like a restaurant, useful facts are: how far away it is, how you rated similar places, what time it is. Those are features.',
    at: 'Snackr uses "how many times you ordered Indian food in the last 30 days" as a feature.' },
  { t: 'Label', short: 'The right answer for a past example — what actually happened.',
    like: 'The marked answers in the back of the textbook. You need them to learn, and getting them is often the hard part.',
    at: 'For Snackr: "did this person actually order from this restaurant?" Yes or no.' },
  { t: 'Latency', short: 'How long one request takes to answer.',
    like: 'How long from tapping the app icon to seeing restaurants. Under about 200 milliseconds feels instant; over a second feels broken.',
    at: 'Snackr\'s home feed has a 200ms budget.' },
  { t: 'p50, p95, p99', short: 'The typical case, the slow case and the very slow case. p99 means "99 out of 100 requests were faster than this".',
    like: 'Your commute is usually 30 minutes (p50), sometimes 50 (p95), and once a fortnight it is 90 because of a signal failure (p99). You plan around the bad days, not the typical one.',
    at: 'If Snackr\'s p99 is 3 seconds, then 1 in 100 people waits 3 seconds. At a million opens a day that is ten thousand annoyed people.' },
  { t: 'QPS (queries per second)', short: 'How many requests arrive each second.',
    like: 'Customers walking into a shop per second. It decides how many tills you need, and nothing else about the shop matters until you know it.',
    at: 'Snackr at dinner time: about 4,000 QPS. At 4am: about 40.' },
  { t: 'Throughput vs latency', short: 'Throughput is how many you can handle per second. Latency is how long each one takes.',
    like: 'A motorway can carry a lot of cars per hour (throughput) while each individual journey still takes an hour (latency). Improving one does not automatically improve the other.',
    at: 'Adding servers raises Snackr\'s throughput. It does nothing for how long one request takes.' },
  { t: 'Offline vs online', short: 'Offline = tested on saved past data. Online = tested on real users right now.',
    like: 'Practising a recipe at home versus cooking it in a restaurant on a Saturday night. Practice is cheap and tells you a lot. It does not tell you everything.',
    at: 'Snackr\'s new ranking looked better on last month\'s data. Whether people actually order more is a different question.' },
  { t: 'Accuracy, precision, recall', short: 'Accuracy: how often you are right. Precision: when you say yes, how often are you correct. Recall: of all the real yeses, how many did you catch.',
    like: 'Fishing with a net. Precision is "how much of what I caught is actually fish". Recall is "how many of the fish in the lake did I catch". A tiny net has great precision and terrible recall.',
    at: 'Snackr blocking fraud: high recall catches more fraudsters, and also blocks more innocent customers. That trade is a business decision, not a technical one.' },
  { t: 'Baseline', short: 'The simplest thing that could possibly work, built first so you know what "better" means.',
    like: 'Before claiming your recipe is good, find out whether people equally like the shop-bought version. Depressingly often, they do.',
    at: 'Snackr\'s baseline: "show the most popular restaurants nearby". Any model has to beat that or it is not worth running.' },
  { t: 'A/B test', short: 'Show version A to half your users and version B to the other half, then compare.',
    like: 'Two identical market stalls with one difference, run side by side on the same day. Same weather, same crowd — so any difference in sales is down to the change.',
    at: 'Half of Snackr\'s users get the new feed, half get the old one, and we see who orders more.' },
  { t: 'Cache', short: 'Remembering an answer so you do not have to work it out again.',
    like: 'Writing a phone number on the fridge instead of looking it up every time. Fast — and wrong the day the number changes.',
    at: 'Snackr remembers the search results for "pizza" for a few minutes, because thousands of people search it.' },
  { t: 'Embedding / vector', short: 'A list of numbers representing the meaning of something, so similar things get similar numbers.',
    like: 'Placing every restaurant on a map where distance means "similar food". Curry houses cluster in one corner, burger places in another. You never wrote the rules — you just placed them by similarity.',
    at: 'Snackr uses this so searching "spicy chicken" finds a place whose menu says "peri-peri", with no shared words.' },
  { t: 'RAG (retrieval-augmented generation)', short: 'Look up the relevant document first, then ask the AI to answer using only that.',
    like: 'An open-book exam. The AI is not remembering your refund policy — it is being handed the page and told to read from it.',
    at: 'Snackr support: fetch the refund policy, paste it into the prompt, then answer the customer.' },
  { t: 'Token', short: 'A chunk of text, roughly ¾ of a word. Large AI models are billed per token, in and out.',
    like: 'A taxi meter that ticks per word rather than per mile — for both what you say and what it says back.',
    at: 'Snackr sending 2,000 tokens of policy text with every support question is where the bill quietly comes from.' },
  { t: 'Drift', short: 'The world changes, so a model trained on last year gets quietly worse.',
    like: 'A map printed in 2019. Still perfectly readable, still confidently wrong about the one-way system.',
    at: 'Snackr\'s model learned pre-summer habits. Then it got hot, everyone ordered ice cream, and it had never seen that.' },
  { t: 'Guardrail metric', short: 'A number you refuse to make worse, even if your main number improves.',
    like: 'Cutting costs is good — unless the food gets worse. "Food quality does not drop" is the guardrail.',
    at: 'Snackr\'s new feed raised orders 3% and made the app 400ms slower. The guardrail catches that; the main metric would have hidden it.' }
];
C.jargonDrill = [
  { t: 'Your app usually answers in 90ms, but one request in a hundred takes 2 seconds. Which number describes the 2 seconds?',
    a: 'p99', why: 'p99 is the value 99% of requests come in under. It is the one your unluckiest users actually experience — and at scale, "1 in 100" is thousands of real people every minute.' },
  { t: '2 million people open the app 5 times a day. Roughly how many requests per second on average?',
    a: 'qps', why: '2,000,000 × 5 ÷ 86,400 seconds ≈ 116 per second. That is QPS, and it is the first number that decides your architecture. Peak will be several times higher than the average.' },
  { t: 'You caught 90 of the 100 real fraud cases, but you also blocked 400 innocent customers.',
    a: 'recall', why: 'Catching 90 of 100 is 90% recall — recall is about how many of the real cases you caught. The 400 blocked innocents are a precision problem, and the two always trade against each other.' },
  { t: '"Show the 10 most popular restaurants near you." No model, twelve lines of code.',
    a: 'baseline', why: 'That is the baseline. Build it first — it ships this week, and it tells you what number any clever model has to beat. Often it is closer than anyone expects.' },
  { t: 'The support bot is handed the refund policy document, then asked to answer using only that.',
    a: 'rag', why: 'Retrieval-augmented generation — an open-book exam for the model. It is not remembering your policy; it is reading a page you fetched for it.' },
  { t: 'Orders went up 3%, but the app got 400ms slower and nobody noticed for a month.',
    a: 'guardrail', why: 'That is exactly what a guardrail metric is for: a number you watch precisely so a win on your main metric cannot quietly hide a loss somewhere else.' }
];
C.jargonOptions = {
  p99:       { name: 'p99 latency', ico: '⏱️' },
  qps:       { name: 'QPS', ico: '📈' },
  recall:    { name: 'Recall', ico: '🎣' },
  baseline:  { name: 'Baseline', ico: '📏' },
  rag:       { name: 'RAG', ico: '📖' },
  guardrail: { name: 'Guardrail metric', ico: '🛡️' }
};

/* ---------- Ch2: the framework ---------- */
C.designPrompt = 'Design a system that recommends what to watch next.';
C.clarifyQs = [
  { q: 'What does "good" mean here — watch time, completion rate, or subscriptions retained?',
    good: true, why: 'Everything downstream is a consequence of this. Optimise watch time and you build an autoplay machine; optimise retention and you build something else entirely. Ask it first, every time.' },
  { q: 'How many users, and how many recommendation requests per second at peak?',
    good: true, why: 'The difference between 100 QPS and 100,000 QPS changes the architecture, not the parameters. This is the number that decides precompute vs online scoring.' },
  { q: 'What is the latency budget for a request?',
    good: true, why: '50ms and 2s are different systems. The budget determines how many stages you can afford and whether a large model can be in the request path at all.' },
  { q: 'How big is the catalogue, and how fast does it change?',
    good: true, why: 'A million items that turn over weekly needs different retrieval than ten thousand stable ones — and it decides whether embeddings can be precomputed.' },
  { q: 'Which vector database should we use?',
    good: false, why: 'A tool choice, not a requirement. Asking it early signals you are designing from the tech backwards. It follows from catalogue size, QPS and update frequency — none of which you know yet.' },
  { q: 'Should we use a transformer or a two-tower model?',
    good: false, why: 'You cannot pick a model before you know the metric, the latency budget and the data. This question in the first minute is the most common way a design conversation goes wrong.' },
  { q: 'Do we have implicit feedback already, or are we starting cold?',
    good: true, why: 'Determines whether you have a training set at all. Cold start is a different problem with a different first solution — usually a popularity heuristic and a way to collect data.' },
  { q: 'How many GPUs do we get?',
    good: false, why: 'A capacity answer to a problem you have not scoped. Ask what the system must do; the hardware falls out of the latency budget and QPS, not the other way round.' }
];
C.framework = [
  ['1 · Clarify', 'What is being optimised, at what scale, under what latency budget, with what data. Do not move on until all four have numbers.'],
  ['2 · Metrics', 'One north-star business metric, the offline proxy you can actually train against, and the guardrails you refuse to regress.'],
  ['3 · Data & labels', 'Where labels come from, what bias they carry, how much you have, and how fast they go stale.'],
  ['4 · Baseline', 'The dumbest thing that could work — popularity, a rule, a keyword match. It ships in a week and it sets the bar everything else must beat.'],
  ['5 · Features & model', 'Features first, model second. Then climb the model ladder only as far as the metric justifies.'],
  ['6 · Serving', 'Batch, online, or streaming. Where the latency goes. What is precomputed and what is computed per request.'],
  ['7 · Scale', 'QPS maths, sharding, caching, and what breaks at 10×.'],
  ['8 · Evaluate', 'Offline first because it is cheap, online because it is the only truth. A/B with enough traffic to mean something.'],
  ['9 · Operate', 'Drift, feedback loops, retraining cadence, fallbacks, and who gets paged.']
];

/* ---------- Ch2: metrics ---------- */
C.metricCases = [
  { s: 'The Snackr home feed. The team says "we want more engagement".',
    o: ['Taps on restaurant cards', 'Orders actually placed and not cancelled', 'Time spent scrolling', 'Model accuracy'],
    a: 1,
    why: 'Taps reward a tempting photo, not a good dinner — optimise that and you get a feed of thumbnail bait. Time spent scrolling sounds like engagement but often means "cannot find anything". A completed order is the thing the business actually runs on, and it is much harder to fake.' },
  { s: 'Blocking stolen cards at checkout. About 2 payments in every 1,000 are fraud.',
    o: ['Accuracy — how often we are right', 'Of the fraud we block, how much is really fraud (at an agreed catch rate)', 'How many alerts we raise', 'Total transactions processed'],
    a: 1,
    why: 'Watch out for accuracy here. If you simply approve everything you are right 998 times out of 1,000 — 99.8% accuracy, and a completely useless system. The real question has two halves: what share of fraud do we catch, and how many innocent customers do we annoy to do it. Measure both together or you are measuring nothing.' },
  { s: 'The search box. Someone types "biryani".',
    o: ['How many results we return', 'Whether the right restaurants came back at all, then whether they were ordered well', 'How fast the search was', 'How many words they typed'],
    a: 1,
    why: 'Measure the two stages separately. If the right restaurant never came back, no amount of clever ordering can save the page — so check "did we find it" before "did we rank it well". Speed matters too, but it is a guardrail, not the goal: instant wrong answers are still wrong.' },
  { s: 'The support chatbot, which can hand a conversation to a human.',
    o: ['How fast it replies', 'Problems solved without a human, with customer satisfaction watched alongside', 'How many messages it sends', 'How many conversations it has'],
    a: 1,
    why: 'Solved-without-a-human on its own is easy to cheat: a bot that simply never hands over scores perfectly while making everyone miserable. Pairing it with a satisfaction score is what stops the number from lying to you. This pattern — a goal plus the thing that catches its cheat — comes up in every chapter after this one.' },
  { s: 'Your new model scored better on saved data from last month. In the live test, orders went DOWN 3%.',
    o: ['Ship it — the offline number is more reliable', 'Believe the live test and go find out why they disagree', 'Keep running the live test until it agrees', 'Average the two results'],
    a: 1,
    why: 'Real users are the truth; the offline score is only a stand-in that has just proved itself unreliable. Something differs between your saved data and real life — and finding out what is worth far more than this one experiment, because that gap will mislead you again on the next twenty.' }
];
C.metricPairs = [
  ['Recommendation', 'nDCG@10, recall@k', 'CTR, watch time, D30 retention', 'Position bias — offline data was collected under the old model'],
  ['Search / retrieval', 'recall@k, MRR', 'Click position, reformulation rate, zero-result rate', 'Nobody clicks result 9; absence of a click is not a negative label'],
  ['Fraud / abuse', 'Precision @ fixed recall, PR-AUC', '$ blocked vs $ lost, false-positive complaints', 'Labels arrive weeks late via chargebacks'],
  ['Classification', 'F1 per class, calibration error', 'Downstream action accuracy, override rate', 'A well-ranked but badly calibrated model breaks any threshold'],
  ['LLM assistant', 'Golden-set pass rate, LLM-judge score', 'Resolution rate, escalation rate, CSAT', 'The judge drifts when you change the judge model'],
  ['Generation quality', 'Rubric score, groundedness', 'Thumbs up/down, edit distance of user corrections', 'Thumbs are ~1% response rate and skew negative']
];

/* ---------- Ch3: labels ---------- */
C.labelSources = [
  { k: 'explicit', name: 'They told you (star rating)', ico: '⭐',
    volume: 8, bias: 85, cost: 25, latency: 'immediate',
    desc: 'The customer rates the restaurant 1 to 5 stars after the order.',
    good: 'No guesswork. One star means one star — you are not inferring anything.',
    bad: 'About 1 in 100 people bother, and it is the ecstatic and the furious who do. Nobody rates a perfectly fine Tuesday curry. So you learn about the extremes and know nothing about the middle, which is most of your business.' },
  { k: 'implicit', name: 'They clicked (or did not)', ico: '👆',
    volume: 98, bias: 70, cost: 5, latency: 'seconds',
    desc: 'Which restaurant cards got tapped. Collected automatically from things people do anyway.',
    good: 'Effectively unlimited and free. This is what nearly every real system trains on, including the ones you use daily.',
    bad: 'The top restaurant gets tapped because it was on top, not because it was best — so the model learns "position" and calls it "quality". And a non-tap is not a "no": they may never have scrolled that far.' },
  { k: 'dwell', name: 'They actually ordered', ico: '🧾',
    volume: 90, bias: 45, cost: 10, latency: 'minutes',
    desc: 'Did the tap turn into a paid, non-cancelled order?',
    good: 'Very hard to fake with an appealing photo. This is the signal that catches the thumbnail-bait a tap-based model happily learns to serve.',
    bad: 'It arrives late, it is affected by price and delivery time as much as by the food, and a repeat order tells you more than a first one. Deciding what counts is a conversation, not a config value.' },
  { k: 'human', name: 'A person judged it', ico: '🧑‍⚖️',
    volume: 12, bias: 20, cost: 95, latency: 'days',
    desc: 'Someone on your team reads 500 searches and marks whether the results were actually relevant.',
    good: 'The highest-quality signal you can get, and the only sane option when you need a trustworthy answer key to check everything else against.',
    bad: 'Slow and expensive. And two reasonable people disagree surprisingly often, so you need written rules and a tie-breaker before you start — that is a project of its own.' },
  { k: 'weak', name: 'A rule guessed for you', ico: '🏷️',
    volume: 80, bias: 55, cost: 15, latency: 'immediate',
    desc: 'Label everything on a "Desserts" menu as dessert. Or have a big model label examples to train a small one.',
    good: 'Gets you a training set on day one when you have none at all. Often the difference between shipping something and shipping nothing.',
    bad: 'Your model inherits every blind spot of the rule — and states them confidently. Always keep a small human-checked set to find out what the rule quietly got wrong.' }
];
C.labelTraps = [
  ['A non-click is not a negative', 'The user may never have seen it. Treating unseen items as negatives teaches the model that everything below the fold is bad. Sample negatives deliberately, or model the examination probability.'],
  ['Position bias is the big one', 'Data collected under your last model is biased toward what that model showed. Train on it naively and you learn to reproduce yesterday\'s ranking. Randomise a small slice of traffic to get unbiased data.'],
  ['Label latency changes the design', 'Chargebacks arrive 30–90 days after the transaction. Your fraud model is always training on last quarter\'s fraud, and your "live" metrics are quarter-old.'],
  ['Survivorship in the training set', 'You only observe outcomes for applications you approved, loans you granted, items you showed. The rejected ones are invisible and they are exactly the interesting cases.'],
  ['Leakage hides in innocent columns', '`account_closed_date` predicts churn perfectly and is unavailable at prediction time. If your offline metric looks too good, it is leakage until proven otherwise.']
];

/* ---------- Ch4: features and skew ---------- */
C.featureCards = [
  { f: 'days_since_signup', plain: 'how long they have been a customer', v: 'safe',
    why: 'You can work this out at any moment in history from one signup date, with the same line of code in training and in production. Boring, stable, never causes an incident. Most of your features should look like this.' },
  { f: 'orders_last_7_days', plain: 'how many orders in the past week', v: 'skew',
    why: 'A perfectly sensible feature, computed two different ways. Overnight you count it with a big database query; live you read a fast counter. Then the two disagree — one uses UTC and the other local time, or one counts an order that arrived late and the other does not. Same name, different number, no error message. The model just quietly performs worse in production than it did in your notebook.' },
  { f: 'total_spent_ever', plain: 'lifetime spend on the account', v: 'leak',
    why: 'Here is the trap. You are predicting "will they order tonight?" — but if you calculate total spend over the whole table, it already includes tonight\'s order. You have handed the model the answer. It scores brilliantly in testing and does nothing in production, and it takes a week to work out why.' },
  { f: 'restaurant_avg_rating', plain: 'the restaurant\'s current star rating', v: 'skew',
    why: 'The rating today is not the rating it had six months ago when that training example happened. Join it naively and every historical row gets today\'s value — so the model learns from a world that did not exist yet. You need "the rating as of that date", which is a different and fussier join.' },
  { f: 'order_was_refunded', plain: 'did we refund this order', v: 'leak',
    why: 'A refund happens after the order. If you are predicting anything about the order itself, this could not possibly be known at the time. Rule of thumb: any feature whose name is in the past tense deserves one hard question — <i>when do we actually find this out?</i>' },
  { f: 'device_type', plain: 'phone or web', v: 'safe',
    why: 'It arrives in the request itself. Nothing to look up, nothing to join, no chance of the two systems disagreeing. Features that come with the request are the safest kind there is.' },
  { f: 'items_in_cart_now', plain: 'what is in their basket right now', v: 'safe',
    why: 'Read straight from the live session, and known before the thing you are predicting. Safe — provided your training data rebuilds sessions the same way production does. That is worth one test rather than one assumption.' },
  { f: 'spend_percentile', plain: 'are they a top-10% spender', v: 'skew',
    why: 'A percentile is relative to everyone else, and everyone else keeps changing. Recompute it nightly for training but cache it for a week in production, and the same customer sits in a different bracket in each. Nothing is broken; the two numbers just mean slightly different things.' }
];
C.skewVerdicts = {
  safe: { name: 'Safe', ico: '✅', cls: 'good' },
  skew: { name: 'Training/serving skew', ico: '⚠️', cls: 'warn' },
  leak: { name: 'Target leakage', ico: '💥', cls: 'bad' }
};
C.skewFixes = [
  ['One definition, one code path', 'A feature store exists so that training and serving read the *same* transformation, not two implementations that agree on a good day. If you cannot have one, at minimum write one test that computes both and asserts they match.'],
  ['Point-in-time correctness', 'When you join a feature onto a training row, take its value *as of* that row\'s timestamp. A plain join takes today\'s value and quietly leaks the future into every historical example.'],
  ['Log the features you actually served', 'The cheapest fix in this chapter. Log the exact feature vector used for each prediction, then train on those logs. Skew becomes impossible by construction.'],
  ['Monitor feature distributions in both places', 'Alert when the serving distribution of a feature drifts from the training distribution. This catches skew, upstream schema changes and dead pipelines with one mechanism.'],
  ['Be suspicious of a great offline number', 'A jump of more than a couple of points from one new feature is leakage far more often than it is insight. Check when the value becomes known before you celebrate.']
];

/* ---------- Ch5: the model ladder ---------- */
C.ladderTasks = [
  { name: 'Route support tickets to a team', best: 1,
    note: 'Ten thousand labelled examples, a fixed set of classes, and a latency budget measured in seconds. Logistic regression on TF-IDF is genuinely competitive here, ships in a day, and costs nothing to serve. An LLM is 100× the cost for a point or two of F1 you may not be able to measure.' },
  { name: 'Predict click-through on ranked items', best: 2,
    note: 'Tabular features, tens of millions of rows, strict single-digit-millisecond budget. Gradient-boosted trees are still the right answer for this shape of problem and have been for a decade. Deep models win only at very large scale with heavy feature engineering behind them.' },
  { name: 'Answer questions about internal docs', best: 4,
    note: 'Open-ended language, no fixed label set, and the knowledge changes weekly. This is what LLMs plus retrieval are actually for. Note the rung below still matters — embeddings do the retrieval.' },
  { name: 'Detect duplicate support tickets', best: 3,
    note: 'Semantic similarity with no generation needed. An embedding model plus a vector index does this at a fraction of the cost and latency of asking an LLM to compare pairs.' },
  { name: 'Flag obviously abusive usernames', best: 0,
    note: 'A blocklist and a regex catch most of it, run in microseconds, and are auditable and instantly fixable when someone complains. Start here and only climb when you can measure what the list is missing.' }
];
C.ladder = [
  { n: 'Heuristic / rules', ico: '📏', quality: 35, latency: 1, cost: 1, build: 1,
    when: 'Always build this first. It is the baseline everything else must beat, and it ships this week.' },
  { n: 'Linear / logistic', ico: '📈', quality: 55, latency: 3, cost: 3, build: 3,
    when: 'Interpretable, fast, calibrated. Astonishingly hard to beat on small tabular problems.' },
  { n: 'Gradient-boosted trees', ico: '🌲', quality: 78, latency: 8, cost: 8, build: 6,
    when: 'The default winner on tabular data. XGBoost/LightGBM should be your reflex, not your fallback.' },
  { n: 'Deep / embeddings', ico: '🧬', quality: 86, latency: 25, cost: 30, build: 40,
    when: 'Text, images, audio, huge sparse feature spaces, or when you need vectors for retrieval.' },
  { n: 'LLM', ico: '🤖', quality: 92, latency: 900, cost: 400, build: 15,
    when: 'Open-ended language, no fixed label set, few or no labels. Fast to prototype, expensive to serve.' }
];
C.ladderRules = [
  ['Climb only when the metric justifies it', 'Each rung costs more to serve and more to operate. A two-point gain that no user can perceive is not worth a 50× serving bill.'],
  ['The baseline is not a formality', 'Half the time it is within a few points of the fancy model. Knowing that number is what stops you spending a quarter on the wrong thing.'],
  ['LLMs invert the usual cost curve', 'Cheap to build, expensive to run. Classic ML is the opposite. That flips the economics: LLMs win on low-volume, high-variety problems and lose badly on high-volume, narrow ones.'],
  ['Distil downward once it works', 'Prototype with an LLM to prove the task is solvable and generate labels, then train a small model on its outputs for serving. Best of both rungs.'],
  ['Features beat models more often than not', 'A GBDT with one good new feature usually beats the same model architecture tuned for two weeks.']
];

/* ---------- Ch6: retrieval and ranking ---------- */
C.funnelStages = [
  { k: 'candidates', name: 'Candidate generation', ico: '🎣', color: '#14b8a6',
    of: 'ANN / inverted index / heuristics', perItemUs: 0.4, base: 6,
    desc: 'Cut millions to hundreds. Cheap and approximate — recall is all that matters here.' },
  { k: 'rank', name: 'Ranking', ico: '📊', color: '#38bdf8',
    of: 'GBDT / DNN over full features', perItemUs: 45, base: 4,
    desc: 'Score every candidate with real features. This is where most of your latency goes.' },
  { k: 'rerank', name: 'Re-ranking', ico: '🎯', color: '#fb7185',
    of: 'Cross-encoder / business rules / diversity', perItemUs: 900, base: 3,
    desc: 'Expensive and accurate, on a tiny set. Also where diversity and business rules land.' }
];
C.funnelNotes = [
  ['Recall is the ceiling', 'Anything candidate generation misses is unrecoverable — no ranker can promote an item it never saw. Measure recall@k of stage 1 against what the final ranker *would* have picked.'],
  ['Precision is the ranker\'s job', 'Stage 1 should be tuned for recall and cheapness only. Making candidate generation "smarter" usually means making it slower for a gain the ranker was going to deliver anyway.'],
  ['Each stage buys accuracy with latency', 'Roughly 100× cost per item, 100× fewer items, per stage. That ratio is why the funnel exists at all.'],
  ['Diversity belongs at the end', 'A pure relevance ranker returns ten near-identical items. Fix that in re-ranking where you can see the whole slate, not in the model\'s loss function.'],
  ['Precompute what you can', 'User and item embeddings computed offline turn stage 1 into a vector lookup. The request path should compute as little as it can get away with.']
];

/* ---------- Ch7: latency budget ---------- */
C.latencyParts = [
  { k: 'net', name: 'Network + TLS + LB', p50: 8, p99: 25, on: true, parallel: false, fixed: true,
    note: 'Mostly out of your control. Regional deployment and connection reuse are the levers.' },
  { k: 'auth', name: 'Auth + rate limit', p50: 2, p99: 9, on: true, parallel: false, fixed: false,
    note: 'Cheap, but every hop has a tail. Cache the token check.' },
  { k: 'features', name: 'Feature fetch (Redis)', p50: 6, p99: 30, on: true, parallel: true, fixed: false,
    note: 'Batch the reads into one round trip. Ten sequential gets is ten tail risks.' },
  { k: 'cands', name: 'Candidate generation (ANN)', p50: 12, p99: 45, on: true, parallel: true, fixed: false,
    note: 'Runs concurrently with the feature fetch — neither needs the other.' },
  { k: 'rank', name: 'Ranking model', p50: 18, p99: 55, on: true, parallel: false, fixed: false,
    note: 'Scales with candidate count. The main knob you actually control.' },
  { k: 'rerank', name: 'Cross-encoder re-rank', p50: 40, p99: 120, on: false, parallel: false, fixed: false,
    note: 'Big quality gain, big latency cost. Only over the top ~50.' },
  { k: 'llm', name: 'LLM call (non-streaming)', p50: 900, p99: 2600, on: false, parallel: false, fixed: false,
    note: 'Blows any interactive budget on its own. Stream it, cache it, or move it off the request path.' },
  { k: 'log', name: 'Logging + response', p50: 3, p99: 12, on: true, parallel: false, fixed: true,
    note: 'Make logging async. Never block a response on an analytics write.' }
];
C.latencyLessons = [
  ['p99 of a sum is not the sum of p99s', 'Adding p99s is a deliberate over-estimate — the true p99 is lower because components rarely peak together. It is the right conservative number for budgeting, and the wrong number to quote as measured. Measure end to end.'],
  ['Fan-out makes tails worse, not better', 'Wait for 10 parallel calls and your p99 is roughly the p99 of the *slowest of ten*, which is far past any single call\'s p99. Hedge requests, or set aggressive per-call timeouts with a degraded fallback.'],
  ['The tail is where users live', 'p50 is a vanity metric. The p99 request is a real person, and at scale it is thousands of them per minute.'],
  ['Every timeout needs a fallback', '"Feature store timed out" must mean "score with defaults", not "500". Degrade to the previous rung of the ladder rather than failing.'],
  ['Streaming changes the metric', 'For generated text, time-to-first-token is what users feel. A 3-second answer that starts in 200ms beats a 1.5-second answer that starts at 1.5s.']
];

/* ---------- Ch8: capacity ---------- */
C.capacityNotes = [
  ['Peak, not average', 'Average QPS sizes nothing. Traffic bunches into a few hours; a peak factor of 2–4× over the daily mean is normal, and launches and pushes are far worse.'],
  ['Little\'s Law does the sizing', 'concurrency = QPS × latency. A box handling 100ms requests with 8 workers serves ~80 QPS. That single line answers most capacity questions.'],
  ['Cache hit rate is the strongest lever', 'Going from 0% to 80% cached cuts backend load fivefold — cheaper than any optimisation and usually faster to ship.'],
  ['Headroom is not waste', 'Run at 50–60% of capacity at peak. The remaining half absorbs a failed AZ, a bad deploy and a retry storm, which tend to arrive together.'],
  ['Precompute beats scaling out', 'If recommendations can be computed nightly for active users and cached, your online QPS is a key-value lookup. Ask what *must* be fresh before you size a fleet.']
];

/* ---------- Ch9: evaluation ---------- */
C.evalLadder = [
  ['Offline holdout', 'Fast, free, run on every commit. Tells you the model learned something. Does not tell you users will like it.'],
  ['Backtest / replay', 'Replay historical traffic through the new system. Catches integration bugs and latency regressions before anyone sees them.'],
  ['Shadow mode', 'Serve live traffic to the new model, log its predictions, act on none of them. The only way to measure real-world latency and feature availability without risk.'],
  ['Interleaving', 'Blend two rankers\' results in one list. Roughly 10× more sensitive than an A/B test for ranking, so it needs far less traffic — but it only works for ranked lists.'],
  ['A/B test', 'The ground truth. Slow, traffic-hungry, and the only thing that measures the actual business metric.'],
  ['Staged rollout', '1% → 5% → 25% → 100%, watching guardrails at each step. Where you catch what the A/B was underpowered to see.']
];
C.abNotes = [
  ['Novelty and primacy effects', 'Any change looks good for a week because it is new, and some look bad because users had habits. Run at least one full weekly cycle before believing anything.'],
  ['Do not peek', 'Checking daily and stopping when it goes significant inflates your false-positive rate from 5% to well over 30%. Fix the duration in advance, or use a sequential test designed for continuous monitoring.'],
  ['Guardrail metrics are not optional', 'Latency, error rate, revenue per user, complaint rate. A change that lifts CTR 2% while adding 300ms of latency is a loss you would not have seen.'],
  ['Watch for interference', 'In marketplaces and social products, the treatment group affects the control group — a better recommender consuming shared inventory. Cluster or switchback rather than splitting users.'],
  ['Underpowered tests are worse than none', 'A test that cannot detect the effect you care about returns "no significant difference" for both a great change and a terrible one, and people read that as "safe to ship".']
];

/* ---------- Ch10: feedback loops and drift ---------- */
C.loopNotes = [
  ['You train on what you showed', 'A recommender only observes feedback for items it surfaced. Items it never shows get no clicks, look bad, and get shown even less. The loop closes and the catalogue collapses.'],
  ['Exploration is the fix, and it costs', 'Serving a small share of random or uncertain items buys you unbiased data. It measurably lowers today\'s metric to keep tomorrow\'s model honest — which is a hard trade to defend and worth defending.'],
  ['Log propensities', 'Record the probability with which each item was shown. It lets you reweight biased logs afterwards (inverse propensity scoring) instead of throwing them away.'],
  ['Data drift vs concept drift', 'Data drift: the inputs change (new device, new market). Concept drift: the relationship changes (fraudsters adapt to your model). The first is detectable from features alone; the second needs labels.'],
  ['Adversarial drift is different in kind', 'Fraud and abuse actively probe your decision boundary. Retraining cadence is a security control there, not a maintenance chore.'],
  ['Retrain on a schedule and a trigger', 'Nightly or weekly by default, plus an alert-driven retrain when a drift monitor or a metric fires. Pure schedule misses fast breaks; pure trigger misses slow ones.']
];

/* ---------- Ch11: RAG at scale ---------- */
C.ragKnobs = [
  { k: 'chunk', name: 'chunk size', min: 200, max: 2000, step: 100, val: 800, unit: ' chars' },
  { k: 'k', name: 'chunks retrieved (k)', min: 1, max: 20, step: 1, val: 5, unit: '' },
  { k: 'cache', name: 'cache hit rate', min: 0, max: 90, step: 5, val: 25, unit: '%' }
];
C.ragToggles = [
  { k: 'hybrid', name: 'Hybrid search (vector + BM25)', on: true,
    note: 'Embeddings are poor at exact tokens — error codes, SKUs, surnames. BM25 covers precisely that gap, so the union beats either alone on almost every corpus.' },
  { k: 'rerank', name: 'Cross-encoder reranker', on: false,
    note: 'Fetch 25, rerank, keep 5. The single largest quality win available in most RAG systems, and it lets you *lower* k — which often pays for its own latency in saved prompt tokens.' },
  { k: 'meta', name: 'Metadata filters', on: true,
    note: 'Narrow by tenant, product, date before searching. Cheap, exact, and mandatory the moment you are multi-tenant — a vector search that can cross a tenant boundary is a data breach waiting to happen.' }
];
C.ragScaleNotes = [
  ['Retrieval quality caps everything', 'Instrument recall@k on a golden set of question→chunk pairs. If the right chunk is not retrieved, the answer cannot be right, and every hour spent on the prompt is wasted.'],
  ['k is the cost knob nobody tunes', 'Every extra chunk is prompt tokens on every request, forever. Going from k=10 to k=4 with a reranker in front usually improves answers *and* halves the bill.'],
  ['Cache at three levels', 'Embedding cache (same query text), retrieval cache (same query → same chunks), and answer cache (same query + same chunks → same answer). Hit rates of 20–40% are common on real traffic.'],
  ['Freshness is an index problem', 'Decide the acceptable staleness up front. Nightly full rebuild is simple; incremental upserts are fresher and much fussier. Tombstone deletes or you will serve retracted documents.'],
  ['Multi-tenancy: isolate at the index', 'Per-tenant namespaces or a hard filter applied server-side. Never a filter the caller can forget to pass.'],
  ['Chunking beats model choice', 'Teams reach for a bigger model when their real problem is a fact split across two chunks. Fix retrieval first — it is cheaper and it is usually the actual bug.']
];

/* ---------- Ch12: LLM serving and cost ---------- */
/* quality: on genuinely hard requests. easyQuality: on the routine ones a router
   should be sending here. The gap between those two columns is the whole argument
   for a cascade — and the reason router accuracy matters more than the split. */
C.cascadeTiers = [
  { k: 'small', name: 'Small model', ico: '🐇', inCost: 1, outCost: 5, quality: 55, easyQuality: 93, latency: 320,
    note: 'Nearly as good as anything on routine, well-specified requests — and most traffic is routine. Falls apart on the hard tail.' },
  { k: 'mid', name: 'Mid model', ico: '🐎', inCost: 3, outCost: 15, quality: 88, easyQuality: 95, latency: 700,
    note: 'The workhorse. Good enough for nearly everything that is not genuinely hard.' },
  { k: 'large', name: 'Large model', ico: '🐘', inCost: 5, outCost: 25, quality: 95, easyQuality: 96, latency: 1400,
    note: 'Reserve it for the hard tail — and for anything where being wrong is expensive. On easy traffic it is barely better than the small one, which is the point.' }
];
/* share of misroutes your output check actually catches and escalates.
   The rest silently return a weak answer — the failure mode nobody dashboards. */
C.cascadeDetection = 0.8;
C.servingLevers = [
  ['Prompt caching', 'A long stable system prompt or a fixed document prefix is re-processed on every call unless cached. Put stable content first and volatile content last; a timestamp near the top silently destroys every hit below it.'],
  ['Continuous batching', 'A serving stack that batches requests dynamically (vLLM, TGI) raises throughput several-fold over one-request-at-a-time. This is the single biggest self-hosting lever.'],
  ['KV cache is your memory ceiling', 'Self-hosting: the KV cache grows with batch size × sequence length and it, not the weights, is usually what limits concurrency. Long contexts are expensive in memory, not just in tokens.'],
  ['Quantization', '8-bit or 4-bit weights cut memory and raise throughput for a small quality cost. Measure that cost on your golden set — the average is fine, the tail is where it shows.'],
  ['Stream everything user-facing', 'Time-to-first-token is the perceived latency. Streaming turns a 3-second wait into a 200ms one without making anything faster.'],
  ['Move work off the request path', 'Summaries, embeddings, enrichment and classification of yesterday\'s data belong in a batch job. Only what the user is waiting for should be synchronous.']
];

/* ---------- Ch13: canonical designs ---------- */
C.designs = [
  { k: 'feed', name: 'Recommendation feed', ico: '📱',
    problem: 'Rank a personalised feed for 40M daily users, 200ms p99, catalogue of 50M items refreshed hourly.',
    stages: [
      { n: 'Requirements', t: 'North star: D30 retention. Proxy: watch time with a clickbait guardrail. 40M DAU × ~30 feed loads = ~14k QPS average, ~40k at peak.', gotcha: 'Nail the peak factor early — it decides precompute vs online scoring, and that decision is expensive to reverse.' },
      { n: 'Data', t: 'Implicit feedback: impressions, clicks, dwell, completions. Impressions logged with position and the propensity they were shown at.', gotcha: 'Log propensities from day one. Retro-fitting them onto a year of logs is impossible.' },
      { n: 'Candidate generation', t: 'Several sources in parallel: two-tower ANN over user/item embeddings, recent-follows, trending, and a fresh-content pool. Union to ~1000.', gotcha: 'A single source has a blind spot by construction. Multiple sources with different biases is how new content gets a chance at all.' },
      { n: 'Ranking', t: 'GBDT or a wide DNN over ~200 features, scoring 1000 candidates in under 30ms. Multi-task heads: p(click), p(complete), p(hide).', gotcha: 'Combine heads with an explicit weighted objective you can tune. A single click head reliably produces a clickbait machine.' },
      { n: 'Re-rank', t: 'Top 50 → diversity constraints, per-creator caps, freshness boost, policy filters. Return 20.', gotcha: 'Diversity and business rules belong here where the whole slate is visible — not inside the model\'s loss.' },
      { n: 'Serving', t: 'Embeddings precomputed nightly; ANN index sharded by item; features in a low-latency store; ranking on CPU with batching.', gotcha: 'Precompute the feed for inactive users offline and serve it from a cache. They are most of your users and none of your engagement.' },
      { n: 'Evaluate', t: 'Offline nDCG@10 on held-out days, then interleaving for ranker changes, then A/B on retention with latency and complaint-rate guardrails.', gotcha: 'Interleaving needs a fraction of the traffic an A/B does. Use it for every ranking change; save A/B for the ones that alter the objective.' },
      { n: 'Operate', t: 'Daily retrain, drift monitors on feature distributions, 1–5% exploration traffic, and a popularity fallback if scoring fails.', gotcha: 'Without exploration the catalogue collapses onto whatever was popular the day you launched. Chapter 10 shows exactly how fast.' }
    ] },
  { k: 'search', name: 'Search ranking', ico: '🔍',
    problem: 'Rank results for 5k QPS of queries over 200M documents, 150ms p99, with exact-match queries mattering as much as semantic ones.',
    stages: [
      { n: 'Requirements', t: 'Success = the user clicks something and does not reformulate. Guardrails: zero-result rate, p99 latency, and a hard rule that exact identifier matches always rank first.', gotcha: '"Reformulation" is the most honest failure signal in search and almost nobody instruments it.' },
      { n: 'Data', t: 'Click logs with position, dwell after click, reformulations, and abandonment. Plus a human-rated relevance set for the head queries.', gotcha: 'Head queries are 1% of distinct queries and 50% of traffic. Rate those by hand; the tail can only be measured statistically.' },
      { n: 'Retrieval', t: 'Hybrid: BM25 over an inverted index plus ANN over embeddings, fused with reciprocal rank fusion. Metadata filters applied first.', gotcha: 'Embeddings are bad at exact tokens — SKUs, error codes, surnames. Pure vector search fails visibly and often on precisely the queries users are most confident about.' },
      { n: 'Ranking', t: 'Learning-to-rank (LambdaMART) over query-document features: BM25 score, vector similarity, freshness, popularity, click-through priors.', gotcha: 'Click priors create a rich-get-richer loop. Cap their weight and refresh them, or the top result is permanently the top result.' },
      { n: 'Re-rank', t: 'Cross-encoder over the top 25, plus deduplication by domain and business rules.', gotcha: 'A cross-encoder over 25 documents is affordable; over 1000 it is not. That ratio is why the funnel has three stages instead of one.' },
      { n: 'Serving', t: 'Index sharded by document, scattered and gathered; results cached by normalised query; typeahead served from a separate lightweight path.', gotcha: 'Query normalisation is what makes the cache work. Case, whitespace, punctuation and stopwords should collapse to one key.' },
      { n: 'Evaluate', t: 'Offline nDCG on the rated set, interleaving online, and zero-result and reformulation rates as continuous guardrails.', gotcha: 'A ranking change that improves the head and destroys the tail nets out flat in aggregate. Segment your evaluation by query frequency.' },
      { n: 'Operate', t: 'Continuous indexing with tombstones for deletes, index freshness alerting, and a BM25-only fallback if the ANN service degrades.', gotcha: 'Being able to fall back to keyword-only search is the difference between degraded search and no search.' }
    ] },
  { k: 'fraud', name: 'Fraud detection', ico: '🛡️',
    problem: 'Score payments in under 100ms at 3k QPS. Fraud is 0.2% of volume, labels arrive 30–90 days late, and adversaries adapt.',
    stages: [
      { n: 'Requirements', t: 'Precision at a recall the risk team commits to — not accuracy, not AUC. The operating point is a business decision about how many good customers you are willing to block.', gotcha: 'Get the false-positive cost in writing. Engineering cannot pick that threshold, and a blocked legitimate customer is often more expensive than the fraud.' },
      { n: 'Data', t: 'Chargebacks (delayed, reliable), manual review outcomes (fast, biased toward what you flagged), and rules that fired.', gotcha: 'You only see outcomes for transactions you approved. Everything you blocked is an unlabelled counterfactual — reserve a small always-approve slice if regulation allows.' },
      { n: 'Features', t: 'Velocity features across several windows, device and IP reputation, graph features over shared cards and addresses, and deviation from the account\'s own history.', gotcha: 'Velocity features are exactly where training/serving skew lives: a batch SQL window and a streaming counter almost never agree. Log what you served.' },
      { n: 'Model', t: 'GBDT for the score, plus a hard rule layer for known patterns and regulatory requirements. Calibrated so the score is a usable probability.', gotcha: 'Calibration matters more than ranking here, because the threshold *is* the product. A well-ranked, badly calibrated model breaks the moment volume shifts.' },
      { n: 'Serving', t: 'Synchronous scoring inside the payment flow, features from a streaming store, with a conservative rules-only fallback on timeout.', gotcha: 'A fraud model that times out must fail to a defined policy — never to "approve everything" by accident.' },
      { n: 'Evaluate', t: 'Backtest on chargeback-labelled history, shadow new models for a full label cycle, then A/B on dollar loss and false-positive complaints.', gotcha: 'You cannot A/B this quickly — the label takes 30–90 days. Budget the calendar for it, and lean much harder on shadow mode than you would elsewhere.' },
      { n: 'Operate', t: 'Weekly retrain minimum, drift alerting on both features and score distribution, and a fast path to ship a rule when a new pattern appears.', gotcha: 'Adversaries adapt in days. Retraining cadence here is a security control, and shipping a rule must not require a model release.' }
    ] },
  { k: 'assistant', name: 'LLM support assistant', ico: '💬',
    problem: 'Answer customer questions from a 200k-document knowledge base, 3s to first token, with escalation to a human and a hard rule against inventing policy.',
    stages: [
      { n: 'Requirements', t: 'North star: resolution without escalation, guardrailed by CSAT and by a groundedness check. Any claim about policy must be traceable to a document.', gotcha: 'Resolution rate alone is gameable by never escalating. The guardrail is what makes the metric honest.' },
      { n: 'Data', t: 'The knowledge base, past ticket transcripts with resolutions, and a golden set of 200 real questions with verified answers and source documents.', gotcha: 'Build the golden set before the system. It is the only way to tell whether a prompt change helped, and retrofitting it is a month of work nobody funds.' },
      { n: 'Retrieval', t: 'Hybrid search over chunked documents with tenant and product metadata filters, cross-encoder rerank, k=4 into the prompt.', gotcha: 'Instrument retrieval separately. Most wrong answers are retrieval failures wearing a generation costume.' },
      { n: 'Generation', t: 'A mid-tier model with a strict grounding instruction, citations required, and a documented refusal path when the context does not contain the answer.', gotcha: '"Answer only from the context" must be in the prompt *and* verified in output, because the model will blend its priors in when the context is thin.' },
      { n: 'Guardrails', t: 'PII redaction inbound, groundedness check outbound, injection isolation for retrieved text, and confidence-based escalation to a human.', gotcha: 'Retrieved documents are data, never instructions. A knowledge-base article an attacker can edit is a prompt-injection vector.' },
      { n: 'Serving', t: 'Stream tokens, cache embeddings and answers, route easy intents to a small model, and reserve the large one for the hard tail.', gotcha: 'Time-to-first-token is what users judge. Streaming buys more perceived speed than any model swap.' },
      { n: 'Evaluate', t: 'Golden set on every prompt, model or index change; LLM-judge scoring calibrated against humans; then A/B on resolution rate and CSAT.', gotcha: 'Pin the judge model and version. A judge that silently upgrades makes every historical score incomparable.' },
      { n: 'Operate', t: 'Trace every run, alert on escalation-rate and groundedness regressions, re-index on document change, and sample transcripts for human review weekly.', gotcha: 'A knowledge-base edit can regress answers with no code change at all. Re-run the golden set on index updates, not just on deploys.' }
    ] }
];

/* ---------- Ch14: operate ---------- */
C.arch = [
  ['Clients', 'Web, mobile, internal tools. Where the latency budget is actually spent.'],
  ['API / orchestrator', 'Auth, rate limiting, the request path, fallbacks and timeouts.'],
  ['Feature store', 'One definition, read offline for training and online for serving.'],
  ['Model serving', 'Autoscaled, versioned, with a fallback to the previous rung of the ladder.'],
  ['Retrieval layer', 'Inverted index plus vector index, sharded, with metadata filters.'],
  ['Training pipeline', 'Scheduled and triggered. Produces versioned models and an eval report.'],
  ['Logging & metrics', 'Predictions, served features, propensities, latency, cost — per request.'],
  ['Eval harness', 'Golden sets and backtests, run on every change before anything reaches traffic.']
];
C.rollout = [
  ['Offline eval', 'Golden set and holdout. Gate the build. Minutes, free, catches the obvious.'],
  ['Backtest / replay', 'Historical traffic through the new path. Catches integration and latency regressions.'],
  ['Shadow', 'Live traffic in, predictions logged, nothing acted on. The only honest latency measurement.'],
  ['Canary 1%', 'Real users, small blast radius. Watch errors and latency, not quality — 1% is too small for quality.'],
  ['A/B 50%', 'Now measure the metric. Fixed duration decided in advance. Guardrails watched throughout.'],
  ['Full rollout', 'Keep the old path warm and the flag flippable for at least a week.']
];
C.failModes = [
  ['Model server down', 'Fall back to the previous rung: cached predictions, then a heuristic. Never a 500.'],
  ['Feature store timeout', 'Score with default or last-known feature values, and log that you did. A degraded prediction beats no prediction.'],
  ['Vector index degraded', 'Fall back to keyword search. Worse results, working product.'],
  ['LLM provider erroring', 'Retry with backoff, then fail over to a second provider or a smaller model, then to a templated response with an escalation path.'],
  ['Bad model shipped', 'One flag flip back to the previous version. If a rollback needs a deploy, it is not a rollback.'],
  ['Cost spike', 'Per-tenant and global spend caps enforced in code, alerting well before the cap. A runaway retry loop can spend a month\'s budget overnight.']
];
C.checklist = [
  'Every prediction logged with its features, model version and propensity',
  'One feature definition shared by training and serving',
  'A golden set / holdout replayed on every model, prompt or index change',
  'Guardrail metrics defined before the A/B starts, and its duration fixed in advance',
  'Every external call has a timeout and a defined fallback',
  'Model rollback is a flag flip, not a deploy',
  'Drift monitors on feature distributions and on the score distribution',
  'Exploration traffic (or logged propensities) so tomorrow\'s training data is not poisoned',
  'Cost per request dashboarded, with per-tenant and global caps enforced in code',
  'Retraining is scheduled AND alert-triggered',
  'p99 latency alerted on, not just p50',
  'Someone owns the on-call rotation, and the runbook names the fallbacks'
];

/* ============================================================
   WORKED EXAMPLES

   Small, friendly numbers walked through by hand, shown just above
   each calculator. Do the arithmetic yourself once and the slider
   stops being a magic box.
   ============================================================ */
C.worked = {
  funnel: {
    title: 'Do it once by hand',
    lead: 'Snackr has 50,000 restaurants. You cannot score all of them in 200ms, so you narrow down in three stages.',
    steps: [
      ['Start', '50,000 restaurants exist'],
      ['Stage 1 — cheap filter', 'Keep the 1,000 nearest that are open. Costs almost nothing per restaurant, so 1,000 is affordable.'],
      ['Stage 2 — the real model', 'Score those 1,000 properly using what we know about you. Roughly 45 microseconds each = 45ms. Keep the best 50.'],
      ['Stage 3 — the expensive model', 'Carefully re-order just those 50. Nearly a millisecond each — which is only affordable because there are 50 of them and not 50,000.'],
      ['Show', 'The top 20 appear on your screen.']
    ],
    punch: 'Notice the pattern: <b>each stage handles about 20× fewer items and spends about 20× more on each one.</b> That is the entire reason funnels exist. And the catch: if stage 1 drops your favourite restaurant, no later stage can bring it back — so stage 1 is judged on "did it keep the good ones", never on "was it clever".'
  },
  capacity: {
    title: 'Do it once by hand',
    lead: 'How many servers does Snackr need? Four multiplications, no magic.',
    steps: [
      ['Users', '2,000,000 people open the app on a given day'],
      ['× how often', 'each opens it 5 times → 10,000,000 requests a day'],
      ['÷ seconds in a day', '10,000,000 ÷ 86,400 ≈ <b>116 requests per second on average</b>'],
      ['× peak', 'but nobody orders dinner at 4am. Dinner time is ~4× the average → <b>about 460 per second at peak</b>'],
      ['÷ what one server handles', 'one server does 8 requests at once, each taking 0.08s → 8 ÷ 0.08 = <b>100 per second</b>'],
      ['= servers', '460 ÷ 100 = 5 servers — then don\'t run them at 100%, so call it <b>8</b>']
    ],
    punch: 'That last step matters: sizing for exactly your peak means a single failed machine takes you down. Run at around 60% and the spare capacity absorbs a bad deploy, a dead server and a retry storm — which have a habit of arriving together.'
  },
  ab: {
    title: 'Do it once by hand',
    lead: 'You changed the feed. Did it help? You need enough people for the answer to mean anything.',
    steps: [
      ['Today', '4 out of every 100 visits end in an order — call that 4%'],
      ['The hope', 'the new feed makes it 4.12% — a 3% relative improvement'],
      ['The problem', 'that difference is 0.12 percentage points. Day to day, the number already wobbles by more than that on its own.'],
      ['So', 'you need enough people that the wobble averages out. The standard formula gives roughly <b>430,000 people per version</b>.'],
      ['Time', 'at 200,000 people a day in the test, that is about <b>4 days</b>.']
    ],
    punch: 'The one thing to remember: <b>to detect an effect half as big, you need four times as many people.</b> Small improvements are not slightly harder to prove — they are dramatically harder. That is why teams chase big changes, and why "we ran it for a day and it looked good" means nothing.'
  },
  latency: {
    title: 'Do it once by hand',
    lead: 'Snackr\'s home feed must appear within 200ms. Here is where that budget goes.',
    steps: [
      ['Network in and out', '25ms — mostly out of your control'],
      ['Check who they are', '9ms'],
      ['Look up their preferences + find nearby restaurants', '45ms — these two do not need each other, so run them at the same time and pay for the slower one, not both'],
      ['Rank the results', '55ms'],
      ['Send the response', '12ms'],
      ['Total', 'about 150ms — inside budget, with 50ms spare']
    ],
    punch: 'Now add one call to a large AI model, which typically takes 900ms to 2.6 seconds. It does not "make the page slower" — it makes the 200ms budget <b>impossible</b>, on its own, before you have written any code. Working the budget out first is what turns that from a month of discovery into a five-minute conversation.'
  }
};

/* ---------- Ch15: quiz ---------- */
C.quiz = [
  { q: 'What should you establish before anything else in an AI system design?', o: ['Which model architecture to use', 'What is being optimised, at what scale, under what latency budget', 'Which vector database to use', 'How many GPUs are available'], a: 1,
    e: 'Metric, scale, latency and data. Every later decision is a consequence of those four, and picking a model before you have them is how designs go wrong in the first five minutes.' },
  { q: 'Fraud is 0.2% of transactions. Which metric is useless?', o: ['Precision at fixed recall', 'Accuracy', 'PR-AUC', 'Dollar loss prevented'], a: 1,
    e: 'A model that predicts "never fraud" scores 99.8% accuracy. On heavily imbalanced problems, accuracy measures the class balance, not the model.' },
  { q: 'What is training/serving skew?', o: ['The model degrading over time', 'A feature computed differently in training than in serving', 'Train/test split leakage', 'GPU/CPU numerical differences'], a: 1,
    e: 'Two implementations of the same feature — a batch SQL window offline and a streaming counter online — that disagree. The model never tells you; it just performs worse in production than in your notebook.' },
  { q: 'Your offline AUC jumps from 0.82 to 0.94 after adding one feature. Most likely explanation?', o: ['A breakthrough feature', 'Target leakage', 'Better hyperparameters', 'A larger training set'], a: 1,
    e: 'A jump that size from one feature is leakage far more often than insight. Check when the feature\'s value actually becomes known relative to the prediction.' },
  { q: 'In a candidate-generation → ranking funnel, why does stage 1 optimise recall rather than precision?', o: ['It is faster', 'Anything it misses can never be recovered by any later stage', 'Recall is easier to measure', 'Precision does not apply to retrieval'], a: 1,
    e: 'The ranker can only reorder what it was given. Stage 1 recall is the hard ceiling on the whole system\'s quality.' },
  { q: 'Ten parallel calls each with a 50ms p99. What is the p99 of waiting for all ten?', o: ['50ms', 'Meaningfully worse than 50ms — the slowest of ten is usually past any single call\'s p99', '500ms exactly', '5ms'], a: 1,
    e: 'Fan-out amplifies tails: the chance that at least one of ten calls is slow is far higher than the chance any single one is. Hedge requests or set aggressive per-call timeouts with a fallback.' },
  { q: 'You size a service on average QPS. What goes wrong?', o: ['Nothing, averages are fine', 'You are under-provisioned at peak, which is when it matters', 'Costs are too high', 'Latency improves'], a: 1,
    e: 'Traffic bunches. A peak factor of 2–4× over the daily mean is normal, and that is exactly the moment the system must not fall over.' },
  { q: 'Why is checking an A/B test daily and stopping when it goes significant a problem?', o: ['It wastes engineering time', 'Repeated peeking inflates the false-positive rate far above the nominal 5%', 'It slows the test down', 'It biases the control group'], a: 1,
    e: 'Every look is another chance to cross the threshold by luck. Fix the duration in advance, or use a sequential test designed for continuous monitoring.' },
  { q: 'A recommender is only trained on items it previously showed. What happens?', o: ['It improves steadily', 'A degenerate feedback loop — unshown items get no clicks, look bad, and are shown even less', 'Latency increases', 'Nothing, this is standard'], a: 1,
    e: 'The catalogue collapses onto what was popular when you launched. Exploration traffic and logged propensities are the standard fixes, and both cost you today\'s metric to protect tomorrow\'s.' },
  { q: 'A RAG answer is wrong. What do you instrument first?', o: ['A larger model', 'Whether the correct chunk was retrieved at all', 'The temperature', 'The system prompt wording'], a: 1,
    e: 'Retrieval quality is the ceiling. If the chunk never reached the prompt, no model or prompt change can produce the right answer — and most "generation" bugs are retrieval bugs.' },
  { q: 'When does a model cascade (small model first, escalate when unsure) pay off?', o: ['Always', 'When most traffic is routine and the router can identify the hard tail reliably', 'Only for image models', 'When latency does not matter'], a: 1,
    e: 'The saving is the share of traffic the small model handles well. If routing is unreliable you pay for two calls on the escalated share and lose quality — so measure the router before you trust the savings.' },
  { q: 'What must be true of every external call on the request path?', o: ['It is cached', 'It has a timeout and a defined fallback', 'It runs on a GPU', 'It is asynchronous'], a: 1,
    e: 'A timeout with no fallback is just a slower error. "Feature store timed out" must mean "score with defaults and log it", not a 500 to the user.' }
];

/* ---------- glossary ---------- */
C.glossary = [
  ['North-star metric', 'The single business outcome the system exists to improve. Everything else is a proxy or a guardrail.'],
  ['Guardrail metric', 'A metric you refuse to regress even if the north star improves. Latency, error rate, complaint rate.'],
  ['Offline metric', 'Computed on held-out historical data. Cheap, fast, and only a proxy for what users do.'],
  ['Online metric', 'Measured on live traffic. Slow and expensive, and the only ground truth.'],
  ['Proxy metric', 'A measurable stand-in for something you actually care about. Every proxy is gameable — watch time for satisfaction, clicks for relevance.'],
  ['Position bias', 'Items ranked higher get clicked more regardless of relevance. The main confound in click-trained rankers.'],
  ['Propensity', 'The probability an item was shown. Logging it lets you debias training data afterwards.'],
  ['Implicit feedback', 'Behavioural signals — clicks, dwell, purchases — used as labels. Plentiful and biased.'],
  ['Weak supervision', 'Labels from rules or a stronger model instead of humans. Gets you started; inherits the labeller\'s blind spots.'],
  ['Target leakage', 'A feature that encodes information unavailable at prediction time. Inflates offline metrics, does nothing online.'],
  ['Training/serving skew', 'The same feature computed differently in training and in serving.'],
  ['Point-in-time correctness', 'Joining a feature at the value it had when the training row was generated, not its value today.'],
  ['Feature store', 'A system serving one feature definition to both training and serving, offline and online.'],
  ['Candidate generation', 'Stage 1 of retrieval: cut millions of items to hundreds, cheaply, optimising recall.'],
  ['Ranking', 'Stage 2: score the candidates with full features and a real model.'],
  ['Re-ranking', 'Stage 3: an expensive model, diversity constraints and business rules over the final few dozen.'],
  ['ANN', 'Approximate nearest neighbour search. Trades exactness for speed at large scale.'],
  ['Hybrid search', 'Vector similarity plus keyword (BM25). Beats either alone, especially on exact tokens.'],
  ['Cross-encoder', 'A model scoring a (query, document) pair jointly. Far more accurate and far slower than embeddings — hence stage 3 only.'],
  ['recall@k', 'The share of relevant items appearing in the top k retrieved. The ceiling on a two-stage system.'],
  ['nDCG', 'A ranking metric that rewards putting relevant items near the top, discounted by position.'],
  ['Calibration', 'Whether a predicted probability of 0.7 means it happens 70% of the time. Matters whenever you threshold.'],
  ['Little\'s Law', 'concurrency = arrival rate × latency. The one-line answer to most capacity questions.'],
  ['Peak factor', 'Peak QPS divided by average QPS. Typically 2–4× for consumer traffic.'],
  ['p99', 'The latency 99% of requests come in under. The number your users actually feel at scale.'],
  ['Time to first token', 'How long before generated text starts appearing. The perceived latency of a streaming system.'],
  ['Shadow mode', 'Running a new system on live traffic and logging its output without acting on it.'],
  ['Interleaving', 'Blending two rankers into one result list. Roughly 10× more traffic-efficient than an A/B for ranking.'],
  ['A/B test', 'Randomised comparison on live traffic. The ground truth, and expensive in traffic and calendar time.'],
  ['Statistical power', 'The probability of detecting a real effect of a given size. An underpowered test reports "no difference" for everything.'],
  ['Peeking', 'Repeatedly checking a running test and stopping at significance. Inflates false positives dramatically.'],
  ['Data drift', 'The input distribution changes. Detectable from features alone.'],
  ['Concept drift', 'The relationship between inputs and outcome changes. Needs labels to detect.'],
  ['Degenerate feedback loop', 'A system trained only on its own outputs, progressively narrowing what it can recommend.'],
  ['Exploration', 'Deliberately serving uncertain or random items to collect unbiased training data.'],
  ['Model cascade', 'Route to a cheap model first, escalate the hard cases to an expensive one.'],
  ['Continuous batching', 'Dynamically batching LLM requests in the serving layer. The biggest self-hosting throughput lever.'],
  ['KV cache', 'Cached attention keys and values during generation. Usually what limits concurrency, more than model weights.'],
  ['Prompt caching', 'Reusing the processed prefix of a repeated prompt. Requires a stable prefix — volatile content goes last.'],
  ['Golden set', 'A fixed set of real inputs with verified outputs, replayed on every change.']
];
