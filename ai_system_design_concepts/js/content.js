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
    { ico: '🔍', n: 'Search', p: 'You type "biryani", it finds the right restaurants.', ch: 'Chapters 7 & 13 — retrieval' },
    { ico: '💳', n: 'Payment', p: 'Is this card being used by its real owner?', ch: 'Chapter 15 — fraud detection' },
    { ico: '💬', n: 'Support chat', p: '"Where is my order?" answered without a human.', ch: 'Chapters 12–14 — LLM systems' }
  ]
};

/* ============================================================
   PLAIN ENGLISH

   One jargon-free sentence per chapter, shown in a box at the top
   of that chapter before anything technical starts. If you only
   read these, you still learn something.
   ============================================================ */
C.plain = {
  vocab:      ['Before anything else, the words.', 'Every field has a private vocabulary, and AI system design has a dense one. None of these ideas are hard — but if nobody tells you what "p99" or "QPS" means, every sentence after it is noise. Ten minutes here makes the other sixteen chapters readable.'],
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
  annindex:   ['Searching ten million things by meaning, without looking at ten million things.', 'You group everything into neighbourhoods first — that is what the k-means clustering in the picture is doing. Then a search only opens the few neighbourhoods nearest the question and ignores the rest. It is faster because it looks at less, and it is occasionally wrong for exactly the same reason.'],
  llmserving: ['Big AI models are charged by the word, in and out.', 'So the money goes on sending things you did not need to send. Route the easy questions to a small cheap model, keep answers short, and remember anything you already answered.'],
  designs:    ['Four real systems, walked through end to end.', 'The same nine steps applied to a feed, a search box, fraud detection and a support chatbot. They look like completely different products and the skeleton underneath is identical — which is the thing actually worth learning.'],
  operate:    ['Normal software keeps working. AI software rots.', 'The world changes, people change, fraudsters adapt, and the system quietly gets worse without ever throwing an error. So "how will we notice, and what do we do then" is part of the design, not a follow-up ticket.'],
  patterns:   ['Fifteen problems that come up so often that somebody gave each one a name.', 'None of them are clever. They are the shapes code keeps landing in: one shared thing everyone borrows, one simple door into a messy subsystem, a line of handlers passing work along until one of them deals with it. Learning the names means a design conversation takes a sentence instead of a whiteboard.'],
  redis:      ['One extra box that holds a little data in memory, so the slow parts get asked far less often.', 'It is a shared scratchpad every server can reach in well under a millisecond. Four jobs cover almost everything people use it for: remember an answer you already worked out, keep a running scoreboard, make sure only one worker picks up a job, and find the things nearest to you.'],
  quiz:       ['Fourteen questions, and an explanation after every one.', 'Nothing here is new — every question is about something you already pushed a slider on. Getting one wrong is useful information rather than a problem: the explanation tells you which chapter to go back to, and you can retake it as many times as you like.']
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

/* ============================================================
   Ch13: vector indexes — how ANN search actually works

   The chapter's claim: an index is a promise to look at less.
   Every family below buys speed by refusing to compare the query
   against most of the corpus, and each one loses recall in its
   own characteristic way. bytes/qps/recall are for a 768-d float
   corpus and are order-of-magnitude, not benchmarks.
   ============================================================ */
C.ivfPhases = [
  ['1 · train', 'Run k-means over a sample of the vectors. The centroids you get <i>are</i> the index — they carve the space into <b>nlist</b> cells, and that is the only thing the index really knows.'],
  ['2 · add', 'Every vector is assigned to its nearest centroid and appended to that centroid\'s list. This is why it is called an <i>inverted file</i>: centroid → list of vector ids, exactly like a term → list of document ids.'],
  ['3 · search', 'Compare the query to <b>nlist</b> centroids (cheap), keep the closest <b>nprobe</b> of them, and brute-force only those lists. Everything in the other cells is never looked at — which is the speedup, and also the entire source of lost recall.']
];

C.annFamilies = [
  { k: 'flat', ico: '🧱', n: 'Flat', tag: 'exact',
    one: 'No index. Compare the query to every vector and sort.',
    bytes: 3072, recall: 100, qps: 1,
    win: 'Exact by definition, zero tuning, no build step, inserts are instantly searchable and deletes are real deletes.',
    cost: 'Work grows linearly with the corpus, forever. 100k vectors is nothing; 50M is a hardware conversation.',
    when: 'Under ~100k vectors — and always as the ground truth you measure the other three against.' },
  { k: 'ivf', ico: '🗺️', n: 'IVF-Flat', tag: 'clustered',
    one: 'k-means the corpus into nlist cells; search the nprobe cells nearest the query.',
    bytes: 3084, recall: 93, qps: 40,
    win: 'One knob (nprobe) trades recall for latency <i>per query</i>, at runtime, with no rebuild. Fast to build, and the full vectors are still there for reranking.',
    cost: 'A true neighbour sitting just across a cell boundary is invisible unless you probe its cell. Clusters drift as the corpus grows, so recall quietly decays until you retrain.',
    when: 'Millions of vectors, batch or nightly rebuilds, and you want a recall dial you can turn per request.' },
  { k: 'ivfpq', ico: '🗜️', n: 'IVF-PQ', tag: 'compressed',
    one: 'IVF, but each vector is stored as a handful of codebook ids instead of floats.',
    bytes: 100, recall: 82, qps: 120,
    win: '10–60× less memory, which is usually the difference between one node and thirty. Distances are computed on the codes with lookup tables, so it is small <i>and</i> fast.',
    cost: 'The stored vector is now an approximation of an approximation. Recall drops noticeably unless you rerank the top few hundred against the real vectors.',
    when: 'Hundreds of millions of vectors, or any time RAM — not latency — is the thing you cannot afford.' },
  { k: 'hnsw', ico: '🕸️', n: 'HNSW', tag: 'graph',
    one: 'A layered proximity graph. Hop greedily toward the query, coarse layers first.',
    bytes: 3328, recall: 97, qps: 90,
    win: 'The best recall-per-millisecond of the four, and it takes incremental inserts without a rebuild. This is what most managed vector databases run by default.',
    cost: 'Memory for the graph links on top of the vectors, slow builds, and deletes are tombstones that degrade the graph until you rebuild it.',
    when: 'Low-latency online search where recall matters and you can pay for RAM. The default choice, and the expensive one.' }
];

C.annDrill = [
  { s: '40,000 support articles for one tenant. Answers must be exactly right, and editors change the corpus all day.',
    o: ['flat', 'hnsw', 'ivf'], a: 'flat',
    why: 'At 40k vectors a brute-force scan is a few milliseconds — an index buys you nothing and costs you a rebuild pipeline, a staleness window and an approximation. HNSW is the reflex answer and the wrong one: you would take a recall loss and an ops burden to speed up something that was already fast.' },
  { s: '1.2 billion image embeddings. 64 GB of RAM per node, and 95% recall after reranking is fine.',
    o: ['ivfpq', 'hnsw', 'ivf'], a: 'ivfpq',
    why: 'Do the arithmetic before the architecture: 1.2B × 3 KB is 3.6 TB of raw vectors. Only compression makes this affordable — PQ at ~100 bytes per vector brings it to ~120 GB. Then rerank the top few hundred against full-precision vectors to buy the recall back.' },
  { s: '8M chunks, p99 must stay under 20ms, recall must be at least 95%, memory is not the constraint, writes trickle in all day.',
    o: ['hnsw', 'ivfpq', 'flat'], a: 'hnsw',
    why: 'High recall at low latency with incremental inserts is the exact shape HNSW is best at, and 8M × ~3.3 KB ≈ 26 GB fits on one machine. IVF-PQ would hit the latency target but not the recall target without a rerank stage you do not otherwise need.' },
  { s: '40M vectors rebuilt nightly by a batch job. Cost matters, 92% recall is acceptable, and the ranker needs the full vectors afterwards.',
    o: ['ivf', 'hnsw', 'ivfpq'], a: 'ivf',
    why: 'A nightly rebuild removes HNSW\'s main advantage (incremental inserts) and leaves its main costs (slow builds, extra memory). IVF-Flat builds in minutes, keeps the exact vectors for reranking, and hands you nprobe as a per-query recall dial.' }
];

C.annNotes = [
  ['Recall is measured against exact search, not truth', 'Run flat search over a golden set of a few thousand queries, store the exact top-k, and report your index\'s overlap with it. Without that number you are tuning nprobe by vibes, and "search got worse" becomes unfalsifiable.'],
  ['The index is a cache of the corpus', 'It is derived data: rebuildable, disposable, never the source of truth. Keep vectors and ids in durable storage, and treat losing an index node as a slow hour rather than an incident.'],
  ['Filters are where ANN quietly breaks', 'Post-filtering searches k=100 and then throws most of them away, so a narrow filter returns three results — or none. Pre-filtering is exact but can degrade into a full scan. Real systems filter during traversal, and you need to know which one yours does.'],
  ['Deletes are tombstones', 'Nothing is removed from a graph or a posting list on delete; it is marked and skipped. Recall and latency both decay with the tombstone ratio, so trigger rebuilds off that ratio rather than off the calendar.'],
  ['Memory is the bill', 'bytes-per-vector × vectors × replicas — and the replicas are the part people forget. That one multiplication decides between IVF-PQ and HNSW far more often than any recall benchmark does.'],
  ['Metric mismatches fail silently', 'Cosine, L2 and inner product disagree unless vectors are normalised. Index one way, query the other, and you get plausible wrong neighbours with no error anywhere. Normalise at write time and pin the metric in config.']
];

/* PQ: a 768-d float32 vector is 3072 bytes. Split it into m sub-vectors, replace each
   with the id of its nearest codebook centroid, and the whole vector becomes m × bits
   bits. The recall model here is a stand-in for the real curve: the loss grows with how
   many dimensions a single code has to stand for. */
C.pqKnobs = [
  { k: 'dims', name: 'embedding dimensions', min: 128, max: 1536, step: 128, val: 768, unit: 'd' },
  { k: 'm', name: 'sub-vectors (m)', min: 4, max: 96, step: 4, val: 48, unit: '' },
  { k: 'bits', name: 'bits per code', min: 4, max: 8, step: 4, val: 8, unit: ' bits' }
];

C.hnswSteps = [
  ['Layer 2 — the motorway', 'The top layer holds a handful of nodes with very long links. A few greedy hops here cross most of the space, which is why the search never has to start from a random place.'],
  ['Layer 1 — the A-roads', 'Keep the best node found and re-enter the layer below at that same point. Each layer down has more nodes and shorter links than the one above it.'],
  ['Layer 0 — every vector', 'The bottom layer contains everything. Hop greedily between close neighbours until no neighbour is nearer to the query. That local minimum is your answer — and occasionally it is the wrong one, which is precisely the recall you traded away.']
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
  ['Move work off the request path', 'Summaries, embeddings, enrichment and classification of yesterday\'s data belong in a batch job. Only what the user is waiting for should be synchronous.'],
  ['Speculative decoding', 'A small draft model proposes several tokens and the big one verifies the block in a single pass, keeping the longest correct prefix. Output is provably identical — you are buying latency with extra compute. Worth it when p95 latency is the complaint; a net loss on a server that is already saturated, because rejected drafts are wasted work.'],
  ['Split prefill from decode', 'They are different bottlenecks — prefill is compute-bound, decode is memory-bandwidth-bound — so they respond to different fixes and, at scale, often belong on different hardware. Every lever above attacks one or the other; knowing which saves you from optimising the phase that was never the problem.']
];

/* ---------- Ch13: the KV cache ceiling ----------
   Defaults describe one 80GB accelerator serving an 8B-class model at bf16 with
   grouped-query attention. Your numbers will differ; the ratio is the lesson.  */
C.kvDefaults = [
  ['gpu', 'accelerator memory (GB)', 80],
  ['w', 'model weights (GB)', 16],
  ['kv', 'KV cache per token (KB)', 128],
  ['ctx', 'context tokens per request', 8000]
];
/* activations, fragmentation, the runtime itself — never assume you get 100% */
C.kvOverhead = 0.10;

/* ---------- Ch13: prefill vs decode ----------
   The standard two-phase inference model. Speculative decoding uses the
   expected-tokens-per-round result from Leviathan et al. 2023:
     E = (1 - a^(g+1)) / (1 - a),  speedup = E / (1 + g*c)                     */
C.decodeModel = {
  promptTokens: 6000,  // system prompt + retrieved context + history
  outputTokens: 500,
  prefillRate: 9000,   // prompt tokens per second, one parallel pass
  decodeRate: 42,      // generated tokens per second, one pass each
  overheadMs: 140,     // network, queue, routing
  cachedFrac: 0.80,    // share of the prompt that is a stable, cacheable prefix
  cacheSpeedup: 10,    // cached prefix tokens cost about a tenth as much to replay
  cacheDiscount: 0.10, // and are billed at roughly a tenth of the input rate
  draftBlock: 4,       // gamma
  draftCost: 0.15,     // one draft token as a fraction of one target pass
  accept: 0.70         // alpha
};

C.decodeLevers = [
  { k: 'stream', n: 'Streaming', phase: 'neither',
    on: 'Tokens go out as they are produced. Time-to-first-token becomes the number the user feels.',
    off: 'The answer is held back until the last token lands. The user watches a blank screen for the whole request.' },
  { k: 'cache', n: 'Prompt caching', phase: 'prefill',
    on: 'The stable prefix is replayed from cache instead of re-processed — cheaper prefill, cheaper input tokens.',
    off: 'Every request re-processes the full prompt from scratch and pays full input rate for it.' },
  { k: 'spec', n: 'Speculative decoding', phase: 'decode',
    on: 'A draft model proposes a block of tokens; the big model verifies them in one pass. Same output, fewer passes.',
    off: 'One forward pass per token, strictly sequential.' }
];

C.decodeLessons = [
  ['Streaming is a perception fix, not a throughput fix', 'Total time and total cost are identical either way. It is still the first thing to ship, because it converts an 8-second blank screen into a 0.8-second one for the price of a flag.'],
  ['Prompt caching cannot speed up generation', 'It only touches prefill. If your complaint is "the answer comes out slowly", caching will not help and you should be looking at output length, model size or speculative decoding.'],
  ['Speculative decoding is a latency-for-compute trade', 'It makes a single request faster while doing more total work. On a saturated, fully-batched server it can lower overall throughput — the opposite of what you wanted. Reach for it when p95 latency is the problem, not when the GPU bill is.'],
  ['The KV cache is a capacity problem, not a speed problem', 'It is not something you enable. It is memory you spend per concurrent request, and it — not the weights — is what decides how many users one accelerator holds.']
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
  annindex: {
    title: 'Do it once by hand',
    lead: 'Snackr has 10,000,000 menu-item embeddings and 40ms to find the 10 nearest. Flat search means 10,000,000 comparisons per query. IVF means far fewer — here is exactly how few.',
    steps: [
      ['Pick nlist', 'The usual starting point is about √N clusters: √10,000,000 ≈ 3,162, so round to <b>nlist = 4,096</b>'],
      ['Average list length', '10,000,000 ÷ 4,096 ≈ <b>2,441 vectors per cell</b>'],
      ['Step 1 of a query', 'Compare the query to all 4,096 centroids to find the nearest cells. That is 4,096 comparisons — the fixed cost of the index.'],
      ['Step 2 of a query', 'With <b>nprobe = 16</b>, scan 16 cells: 16 × 2,441 ≈ <b>39,000 vectors</b>'],
      ['Total compared', '4,096 + 39,000 ≈ 43,000 out of 10,000,000 = <b>0.43% of the corpus</b>'],
      ['Speedup', '10,000,000 ÷ 43,000 ≈ <b>230× less work</b>, for a recall of roughly 90–95%']
    ],
    punch: 'Two knobs, two different jobs. <b>nlist</b> is chosen at build time and sets the fixed centroid cost — too few and each cell is huge, too many and you spend the whole query scanning centroids. <b>nprobe</b> is chosen per query, at runtime: it is the one dial that lets one caller ask for cheap-and-approximate and another ask for slow-and-thorough <i>against the same index</i>. And the missing 5–10%? Those are neighbours that landed in a cell you did not open.'
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
  { q: 'Your IVF index returns 88% recall@10. Where did the missing 12% go?', o: ['The embedding model is underfit', 'True neighbours sat in cells the query never probed', 'The corpus is too small', 'The distance metric is wrong'], a: 1,
    e: 'IVF only compares against the nprobe cells nearest the query. A neighbour just across a cell boundary is never looked at. Raise nprobe and the recall comes back, at a proportional cost in scanned vectors — that is the whole trade.' },
  { q: 'You have 1.2B vectors of 768 float32 dimensions and 64 GB of RAM per node. What decides the index?', o: ['Recall benchmarks', 'bytes-per-vector × vectors × replicas — the raw vectors are 3.6 TB, so they must be compressed', 'Query latency', 'The embedding model vendor'], a: 1,
    e: 'Memory is the binding constraint long before recall is. PQ at ~100 bytes per vector turns 3.6 TB into ~120 GB, and a rerank pass over the top few hundred against exact vectors buys the recall back.' },
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
  ['IVF', 'Inverted file index. k-means partitions the vectors into nlist cells; a query scans only the nprobe cells whose centroid is nearest. Centroid → list of vector ids, exactly like term → list of doc ids.'],
  ['nlist / nprobe', 'nlist: how many clusters the index was built with (build time). nprobe: how many of them a given query opens (run time). nprobe is the recall-versus-latency dial.'],
  ['HNSW', 'Hierarchical navigable small world. A layered proximity graph searched greedily from coarse layers down to the layer holding every vector. Best recall per millisecond, most memory.'],
  ['Product quantization (PQ)', 'Split each vector into m sub-vectors and store the id of the nearest codebook centroid for each. 3 KB becomes ~50 bytes, at a recall cost you claw back by reranking on the full vectors.'],
  ['Rerank on exact vectors', 'Retrieve a few hundred candidates from a compressed index, then re-score just those against the full-precision vectors. Cheap, and it recovers most of what quantization lost.'],
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
  ['Prefill', 'The phase that processes your whole prompt in one parallel pass. Compute-bound; what prompt caching attacks.'],
  ['Decode', 'The phase that generates the answer, one forward pass per token. Memory-bandwidth-bound; what speculative decoding and batching attack.'],
  ['KV cache', 'Cached attention keys and values during generation. Makes decode O(n) instead of O(n²), and its size — batch × sequence length — is usually what limits concurrency, more than model weights.'],
  ['Prompt caching', 'Reusing the processed prefix of a repeated prompt. Cuts prefill latency and input cost; does nothing for generation speed. Requires a stable prefix — volatile content goes last.'],
  ['Speculative decoding', 'A draft model proposes a block of tokens that the target model verifies in one pass. Identical output, fewer passes, more total compute. The acceptance rate decides whether it pays.'],
  ['Acceptance rate', 'Share of speculatively drafted tokens the target model agrees with. Below roughly 40% the wasted draft compute outweighs the passes saved.'],
  ['Streaming', 'Sending tokens to the client as they are generated. Changes perceived latency only — same tokens, same total time, same bill.'],
  ['Golden set', 'A fixed set of real inputs with verified outputs, replayed on every change.']
];

/* ============================================================
   Ch16: the fifteen design patterns

   Code-level, not system-level — but every one of them shows up
   inside the systems the earlier chapters designed, so each card
   points at the chapter where you already used it.
   ============================================================ */
C.patternCats = {
  creational:  { name: 'Creational', ico: '🏭', blurb: 'How things get made.' },
  structural:  { name: 'Structural', ico: '🧱', blurb: 'How things are composed.' },
  behavioural: { name: 'Behavioural', ico: '🔁', blurb: 'How things talk and decide.' }
};

C.patterns = [
  { k: 'singleton', num: 1, n: 'Singleton', cat: 'creational',
    one: 'Ensures only one instance exists.',
    problem: 'Something expensive or genuinely shared — a loaded model, a connection pool, a tokenizer — must be created once and reused, not rebuilt per request.',
    ai: 'Snackr\'s ranker is 2 GB and takes six seconds to load. At 400 requests a second you load it once per worker at startup and every request borrows the same handle.',
    code: 'from functools import lru_cache\n\n@lru_cache(maxsize=1)          # the whole pattern, in one decorator\ndef ranker():\n    return load_model("ranker-v7.onnx")',
    trap: '"One instance" means one per process, not one per cluster. It is global mutable state, so never hang request data on it, and expect tests to surprise you when they run in a different order.' },

  { k: 'factory', num: 2, n: 'Factory Method', cat: 'creational',
    one: 'Creates objects without naming their exact class.',
    problem: 'The caller knows what it needs, not which implementation is configured today.',
    ai: 'Config says embeddings: "local" in development and "hosted" in production. One function returns the right client, and no calling code mentions either vendor.',
    code: 'EMBEDDERS = {"hosted": HostedEmbedder, "local": E5Embedder}\n\ndef make_embedder(name, **kw):\n    return EMBEDDERS[name](**kw)     # a dict lookup IS the factory',
    trap: 'A dict of constructors is usually the entire pattern. An abstract-factory class hierarchy for two products is ceremony you maintain forever and read never.' },

  { k: 'builder', num: 3, n: 'Builder', cat: 'creational',
    one: 'Builds a complex object step by step.',
    problem: 'Many optional parts, an order that matters, and half-built states that must not escape.',
    ai: 'A retrieval prompt: fixed rules, then retrieved documents, then history trimmed to a token budget, then the question. The order is the cache prefix, so it is not cosmetic.',
    code: 'msg = (Prompt()\n       .system(RULES)            # stable prefix first — prompt caching needs it\n       .docs(retrieved)\n       .history(turns, max_tokens=2000)\n       .ask(question)\n       .build())',
    trap: 'Four fields and no invalid intermediate state? A dataclass with defaults beats a builder. Reach for this only when ordering or validation is real.' },

  { k: 'adapter', num: 4, n: 'Adapter', cat: 'structural',
    one: 'Bridges two interfaces that were never meant to meet.',
    problem: 'Two libraries do the same job with different shapes, and you refuse to spread "if vendor == …" through the codebase.',
    ai: 'Every reranking vendor returns a different JSON. Each adapter maps it to one shape — a list of (index, score) — so swapping vendors becomes a config change.',
    code: 'class VendorRerank:            # returns {"data":[{"index":0,"relevance_score":.8}]}\n    def rerank(self, q, docs):    # our interface: -> [(index, score)]\n        r = self.api.rerank(query=q, documents=docs)\n        return [(d["index"], d["relevance_score"]) for d in r["data"]]',
    trap: 'An adapter that leaks vendor-only options has stopped adapting. Expose the intersection every backend supports; push the rest into the constructor.' },

  { k: 'decorator', num: 5, n: 'Decorator', cat: 'structural',
    one: 'Adds behaviour around an object without changing it.',
    problem: 'Retries, timeouts, caching, redaction and token counting all want to wrap the same call, and none of them belong inside it.',
    ai: 'One generate() plus four wrappers is how a model call becomes production-ready without the model code knowing that any of it happened.',
    code: '@retry(3, on=RateLimited)   # outermost: this retries cache hits too — usually wrong\n@cached(ttl=3600)\n@timed("llm.generate")\ndef generate(prompt): ...',
    trap: 'Order changes behaviour. Cache outside retry and you retry hits; cache inside retry and failures are never cached. Stack five and nobody can read the stack trace or account for the latency.' },

  { k: 'facade', num: 6, n: 'Facade', cat: 'structural',
    one: 'One simple door into a complicated subsystem.',
    problem: 'Callers should not have to orchestrate six services correctly to ask one question.',
    ai: 'answer(q) hides retrieve → rerank → build prompt → generate → guardrail → cite. Product code calls one function while the pipeline underneath it changes weekly.',
    code: 'def answer(q, k=8, model="small"):\n    docs = rerank(q, retrieve(q, k * 4))[:k]\n    out  = generate(build_prompt(q, docs), model=model)\n    return guard(out, docs)       # one door — knobs still reachable',
    trap: 'A facade that hides every knob gets copy-pasted the first time someone needs k=50. Hide the wiring, keep the parameters.' },

  { k: 'proxy', num: 7, n: 'Proxy', cat: 'structural',
    one: 'A stand-in that controls access to the real thing.',
    problem: 'You need caching, rate limiting, auth or a circuit breaker in front of an object, with the same interface, so nothing downstream notices.',
    ai: 'The cache in front of the ranker is a proxy — and chapter 9\'s arithmetic says a 40% hit rate removes well over a third of the fleet. This pattern pays rent.',
    code: 'class CachedRanker:\n    def __init__(self, real, cache): self.real, self.cache = real, cache\n    def rank(self, q):\n        key = f"v7:{normalise(q)}"          # version the key with the model\n        return self.cache.get_or_set(key, lambda: self.real.rank(q), ttl=300)',
    trap: 'A proxy serving stale results after a deploy is indistinguishable from a bug. Put the model version in the key and stale entries retire themselves.' },

  { k: 'composite', num: 8, n: 'Composite', cat: 'structural',
    one: 'Treat one thing and a group of things the same way.',
    problem: 'A tree where leaves and branches answer the same calls, so callers stop caring which one they are holding.',
    ai: 'A document is sections is chunks, and all three answer .tokens(). Same trick for agents: a sub-agent is just another tool, so the planner never learns which of its tools is a whole agent.',
    code: 'class Chunk:\n    def tokens(self): return len(self.ids)\n\nclass Section:                            # same interface, different insides\n    def tokens(self): return sum(c.tokens() for c in self.children)',
    trap: 'Recursion with no depth limit. An agent that can call agents eventually calls itself, in a loop, at real money per turn. Cap depth and total spend at the top.' },

  { k: 'observer', num: 9, n: 'Observer', cat: 'behavioural',
    one: 'One change, many interested parties, no coupling.',
    problem: 'Something happened, and the list of things that care about it keeps growing.',
    ai: 'Every prediction fans out to the metrics dashboard, the drift monitor, the training log and the feature store. Chapter 5\'s "log the vector you served" is an observer sitting on the serving path.',
    code: 'def on_prediction(ev):\n    bus.publish("prediction", ev)   # fire and forget\n\n# subscribers: metrics · drift · training-log · feature-store',
    trap: 'Synchronous observers put every subscriber\'s tail latency on your serving path, and one slow consumer takes the request down with it. Publish to a queue and let them be slow on their own time.' },

  { k: 'strategy', num: 10, n: 'Strategy', cat: 'behavioural',
    one: 'Swap the algorithm at runtime, keep the interface.',
    problem: 'Several interchangeable ways to do one job, chosen by config, by experiment, or per request.',
    ai: 'Chapter 6\'s model ladder as code: rules, tree and language model all behind score(x). It is also what an experiment flips — the framework picks a strategy per user.',
    code: 'STRATEGIES = {"keyword": bm25_search, "dense": vector_search, "hybrid": fuse}\n\ndef retrieve(q, strategy=cfg.retrieval):\n    return STRATEGIES[strategy](q)   # the experiment just changes the string',
    trap: 'Strategies must return the same shape and honour the same latency contract. Two "strategies" with different output schemas is one experiment comparing two different products.' },

  { k: 'command', num: 11, n: 'Command', cat: 'behavioural',
    one: 'Wrap a request as an object you can queue, log, retry and undo.',
    problem: 'What to do, and the doing of it, need to be separated in time.',
    ai: 'A tool call from a language model is already a Command — a name and arguments. That is exactly why it can be reviewed by a human, queued, retried and replayed from a log.',
    code: '@dataclass(frozen=True)\nclass Refund:\n    order_id: str\n    amount: int\n    key: str        # idempotency key: the line between retry and double refund\n    def run(self, api): api.refund(self.order_id, self.amount, idem=self.key)',
    trap: 'A retryable command that is not idempotent refunds twice. If it touches money, state or a third party, it carries a key.' },

  { k: 'iterator', num: 12, n: 'Iterator', cat: 'behavioural',
    one: 'Walk a collection without exposing how it is stored.',
    problem: 'The caller wants items one at a time; the source may be a list, a paged API, a database cursor or a token stream.',
    ai: 'Streaming tokens to the user is an iterator, and it is the reason time to first token is a metric at all. Paging an index and batching a training set are the same idea over different storage.',
    code: 'def stream(prompt):\n    for chunk in client.stream(prompt):   # a generator is the stdlib iterator\n        yield chunk.text',
    trap: 'A generator holding a database cursor or an HTTP connection open for a whole response is a connection leak waiting for a traffic spike. Bound it, or materialise a page at a time.' },

  { k: 'state', num: 13, n: 'State', cat: 'behavioural',
    one: 'Behaviour changes with the object\'s current state.',
    problem: 'The same input means different things depending on where you are in a lifecycle, and a chain of ifs over a status field stops being readable at about the fourth branch.',
    ai: 'The agent loop: planning → acting → waiting for a human → done → failed. What the next model output is allowed to do depends entirely on which of those you are in.',
    code: 'LEGAL = {"planning": {"acting", "failed"},\n         "acting":   {"planning", "waiting", "done", "failed"},\n         "waiting":  {"acting", "failed"}}\n\ndef go(cur, nxt):\n    assert nxt in LEGAL[cur], f"illegal transition {cur} -> {nxt}"',
    trap: 'When a model picks the transition, the legal set must be enforced in code. Ask it to name the next state and sooner or later it invents one you never wrote a handler for.' },

  { k: 'template', num: 14, n: 'Template Method', cat: 'behavioural',
    one: 'A fixed skeleton; the steps are filled in per case.',
    problem: 'Ten variants that must all happen in the same order, with two or three steps genuinely different.',
    ai: 'Every training pipeline: load → split → featurise → fit → evaluate → register. The order is fixed for a reason — featurise before you split and you have leaked the future into your metric.',
    code: 'class TrainingJob:\n    def run(self):                      # the skeleton, not overridable\n        d = self.load(); tr, te = self.split(d)\n        m = self.fit(self.featurise(tr))\n        self.register(m, self.evaluate(m, te))\n    def fit(self, X): raise NotImplementedError   # the hole subclasses fill',
    trap: 'By the third level of subclassing nobody can tell which class actually runs. Pass functions in instead — that is Strategy, and it is flatter.' },

  { k: 'chain', num: 15, n: 'Chain of Responsibility', cat: 'behavioural',
    one: 'Hand the request down a line until someone handles it.',
    problem: 'Several handlers might deal with this, in a known order, and adding one should not touch the others.',
    ai: 'Chapter 14\'s cascade is a chain: small model, then large model, then a human. So is the guardrail stack — length, personal data, moderation, grounding — each link passing it on or stopping it.',
    code: 'def handle(req, chain):\n    for link in chain:\n        out = link(req)\n        if out is not None:\n            log.info("handled by %s", link.__name__)  # always log the link\n            return out\n    return escalate(req)              # the last link is never optional',
    trap: 'Every link costs latency, and a link that silently swallows a request is unfindable unless you log which one handled it. Chains must also end somewhere explicit — usually a human.' }
];

/* six situations, all lifted from earlier chapters */
C.patternDrill = [
  { s: 'Snackr support tries a small model first, escalates the hard questions to a big one, and hands the last few percent to a human agent.',
    o: ['chain', 'strategy', 'decorator', 'proxy'], a: 'chain',
    why: 'Ordered handlers, each of which either deals with the request or passes it along. Strategy would pick one handler up front; a chain tries them in turn — which is exactly what a cascade does.' },
  { s: 'Every prediction must reach the metrics dashboard, the drift monitor and the training log — and product wants a fourth consumer next month.',
    o: ['observer', 'facade', 'command', 'template'], a: 'observer',
    why: 'The publisher must not grow a line of code per consumer. Publish the event and let consumers subscribe — asynchronously, or their latency quietly becomes yours.' },
  { s: 'The ranking model is 2 GB and takes six seconds to load. You serve 400 requests a second.',
    o: ['singleton', 'builder', 'proxy', 'iterator'], a: 'singleton',
    why: 'Load once per worker process and share the handle. In Python that is a module-level object or lru_cache(maxsize=1) — and remember it is one per process, not one per cluster.' },
  { s: 'The model replies with a tool call — a name and arguments. You must queue it, show it to a reviewer, log it, and retry it safely.',
    o: ['command', 'state', 'factory', 'adapter'], a: 'command',
    why: 'Separating "what to do" from "doing it" is the whole point, and it is why a tool call can be reviewed, queued and replayed. Give it an idempotency key or the retry is a second refund.' },
  { s: 'You want to compare keyword, dense and hybrid retrieval on live traffic without the serving code knowing which one is running.',
    o: ['strategy', 'chain', 'composite', 'decorator'], a: 'strategy',
    why: 'Interchangeable algorithms behind one interface, selected at runtime. Keep the return shape and the latency contract identical, or you are comparing two products rather than two retrievers.' },
  { s: 'Three reranking vendors, three different JSON shapes, and you want swapping them to be a one-line config change.',
    o: ['adapter', 'facade', 'builder', 'singleton'], a: 'adapter',
    why: 'Adapter converts one interface into the one you already have. A facade would simplify a whole subsystem; here there is a single call per vendor, just shaped differently each time.' }
];

/* where the course already used them, before anyone said "pattern" */
C.patternsHere = [
  ['Strategy · chapter 6', 'The model ladder: rules, tree and language model behind one score(x). Choosing a rung is choosing a strategy.'],
  ['Chain of Responsibility · chapter 14', 'The model cascade — small model, big model, human. Each link handles the request or passes it on.'],
  ['Proxy · chapter 9', 'The cache in front of the ranker. Same interface, and the single biggest lever on fleet size.'],
  ['Observer · chapter 5', 'Logging the exact feature vector you served, to everyone who needs it, off the serving path.'],
  ['Facade · chapter 12', 'One answer() call hiding retrieve, rerank, prompt, generate and guard.'],
  ['Iterator · chapter 8', 'Token streaming — and the reason time to first token is a metric at all.'],
  ['Template Method · chapter 15', 'The same nine stages, in the same order, for a feed, a search box, fraud and a support bot.'],
  ['Builder · chapter 12', 'Prompt assembly with the stable prefix first, because caching depends on the order.']
];

C.patternRules = [
  ['Name the problem, not the pattern', 'A pattern is a name for a shape you already needed. If you cannot state the problem in one sentence without using the pattern\'s name, you do not have that problem yet.'],
  ['One implementation is not an interface', 'An abstract base class with a single subclass is a dict lookup in a costume. Write the second implementation first; the abstraction is obvious then and guesswork now.'],
  ['The standard library is half of this list', 'lru_cache is a Singleton and a Proxy, a generator is an Iterator, a decorator is Decorator, a dataclass replaces most Builders. Look there before writing a class.'],
  ['Patterns cost milliseconds', 'Every wrapper, link and observer is another frame on the serving path. Chapter 8 hands you a budget; a five-deep decorator stack spends a surprising amount of it.'],
  ['Mostly they are vocabulary', 'The real payoff is saying "put a proxy in front of it" in a design review and having six people picture the same thing. That is worth more than any of the code above.']
];

/* ============================================================
   Ch17: Redis — the four use cases that come up in every interview

   Redis is one box holding a little data in memory. What makes it
   worth a chapter is that four of its data types answer four
   different system-design problems, and the trap on each one is
   what separates "I have used Redis" from "I have operated it".
   ============================================================ */
C.redisUses = [
  { k: 'cache', num: 1, n: 'Cache', ico: '🗄️', head: 'fast reads', type: 'String / Hash',
    one: 'A hot copy of a slow read, with an expiry date on it.',
    problem: 'Reads outnumber writes by an order of magnitude and the answer barely changes between them, so the database is being asked the same question thousands of times a second.',
    ai: 'Snackr\'s restaurant page — menu, hours, rating — changes a few times a day and is read constantly. Chapter 9 already priced this: a 40% hit rate removes well over a third of the fleet, which makes it the single biggest lever in that calculator.',
    code: 'v = r.get(key)\nif v is None:                       # miss: pay for the slow read once\n    v = db.restaurant(rid)\n    r.set(key, dumps(v), ex=300 + randint(0, 60))   # jittered TTL\nreturn loads(v)',
    trap: 'Every copy of a hot key expiring in the same second sends the whole fleet at the database at once — a cache stampede. Jitter the TTL, and let one request rebuild the value while the others serve the stale copy. Version the key with the schema, or a deploy serves yesterday\'s shape.' },

  { k: 'zset', num: 2, n: 'Sorted Set', ico: '🏆', head: 'leaderboards', type: 'ZSET',
    one: 'A set where every member carries a score, permanently kept in score order.',
    problem: 'You want the top N by a number that changes constantly, and re-sorting a table on every read — or on every write — is not affordable.',
    ai: 'Snackr\'s "most ordered this hour". Each order bumps one member; the read is a range from the top. The ordering is maintained on write, so the read is a slice, not a sort.',
    code: 'r.zincrby("top:hour:19", 1, rid)         # O(log n) per order\nr.zrevrange("top:hour:19", 0, 9, withscores=True)   # O(log n + 10)\nr.zrevrank("top:hour:19", my_rid)        # "you are #42"',
    trap: 'A sorted set never forgets. Bucket the key by hour or day and expire the old buckets, or it grows until it is the reason for your memory alert. And ZRANGEBYSCORE over a huge span costs what it returns — pagination is not optional.' },

  { k: 'lock', num: 3, n: 'Lock', ico: '🔒', head: 'one worker at a time', type: 'SET NX PX',
    one: 'Mutual exclusion across machines, agreed on by one shared server.',
    problem: 'Several workers can pick up the same job, and doing it twice is not harmless — a double refund, a second courier, two identical emails.',
    ai: 'Snackr runs three schedulers for redundancy. Exactly one of them may assign a courier to order 88, and the other two must find out cheaply that they lost.',
    code: 'tok = uuid4().hex\nif r.set("lock:order:88", tok, nx=True, px=5000):   # NX = only if absent\n    try: assign_courier(88)\n    finally: r.eval(RELEASE_LUA, 1, "lock:order:88", tok)  # delete only if still mine',
    trap: 'A bare DEL releases whoever holds the lock now — which, after your lease expired, is somebody else. Compare the token and delete atomically, in Lua. And accept what the lock actually is: a lease with a timeout, not a mutex. If the work outlives the TTL, two workers run it, so the work still has to be idempotent.' },

  { k: 'geo', num: 4, n: 'Geo Hash', ico: '📍', head: 'nearby search', type: 'GEO (a ZSET underneath)',
    one: 'Two coordinates squashed into one sortable number, so "near each other" becomes "close in that number".',
    problem: 'Find everything within N km of a point, fast, without measuring the distance to every row you own.',
    ai: 'Snackr needs the couriers within 3 km of a restaurant, sorted by distance, before the confirmation screen renders. Every courier ping is one GEOADD; the query is one GEOSEARCH.',
    code: 'r.geoadd("couriers", (lon, lat, courier_id))          # on every ping\nr.geosearch("couriers", longitude=lon, latitude=lat,\n            radius=3, unit="km", sort="ASC", count=10)',
    trap: 'The interleaved number is a grid, so two points either side of a cell boundary are physically close and numerically far. Redis searches the neighbouring cells for you; a hand-rolled prefix match does not, and quietly misses the courier across the street. Also: GEO is a sorted set, and sorted sets do not expire members — stale couriers linger until you remove them.' }
];

/* four situations, one per use case — the interview version of this chapter */
C.redisDrill = [
  { s: 'Snackr\'s restaurant page is read forty thousand times a minute and edited about twice a day. The database is at 80% CPU and it is nearly all the same query.',
    o: ['cache', 'zset', 'lock', 'geo'], a: 'cache',
    why: 'Read-heavy, rarely written, and identical between reads — the textbook shape for a cache. Reach for a sorted set only if the answer is a ranking; here the answer is one document, so a string with a jittered TTL does it.' },
  { s: 'Product wants a live "top 10 restaurants this hour" board, updated on every order, and each restaurant should be able to see its own rank.',
    o: ['zset', 'cache', 'geo', 'lock'], a: 'zset',
    why: 'A ranking that changes on every write is what a sorted set is for: the order is maintained as you write, so the read is a slice instead of a sort. Caching a computed top-10 would go stale in seconds and still needs the sort somewhere.' },
  { s: 'Three schedulers run in parallel for redundancy. Each order must be assigned exactly one courier, and assigning two is a real cost.',
    o: ['lock', 'cache', 'zset', 'geo'], a: 'lock',
    why: 'SET NX gives you the one-winner decision in a single round trip. Remember what you bought: a lease with an expiry, not a mutex — so the assignment itself still needs an idempotency key for the case where the lease expires mid-work.' },
  { s: 'The confirmation screen must show couriers within 3 km, nearest first, in under twenty milliseconds — and every courier reports its position every few seconds.',
    o: ['geo', 'zset', 'cache', 'lock'], a: 'geo',
    why: 'Proximity search over constantly moving points: the write is one GEOADD per ping and the read is one radius query, no scan. A plain sorted set cannot rank by two dimensions at once, and a cache would be stale before it was written.' }
];

/* the rest of the toolbox, one line each — you will meet these next to the four above */
C.redisTypes = [
  ['String', 'Bytes with a TTL. Caching, counters (INCR is atomic), and rate limiting with INCR plus EXPIRE.'],
  ['Hash', 'A small map under one key. A session or a profile where you update one field without rewriting the whole blob.'],
  ['List', 'A deque. Cheap queue with LPUSH and BRPOP — no acknowledgements, so a crashed worker loses the job.'],
  ['Set', 'Unordered, unique. Membership tests, tags, and "who has already seen this" with SADD and SISMEMBER.'],
  ['Sorted Set', 'A set plus a score, kept in order. Leaderboards, delay queues (score = due time), sliding-window rate limits.'],
  ['Stream', 'An append-only log with consumer groups and acknowledgements. The List you actually want for jobs that must not vanish.'],
  ['HyperLogLog', 'Approximate unique counts in 12 KB, about 0.8% error. Unique visitors, when exact is not worth the memory.'],
  ['Bitmap', 'One bit per user id. Daily actives, feature flags, "did this user do X today" — a million users in 128 KB.'],
  ['Pub/Sub', 'Fire-and-forget broadcast. No history, no delivery guarantee — if a subscriber is offline the message is simply gone.']
];

C.redisRules = [
  ['It is memory, so plan for it vanishing', 'Persistence exists — snapshots and an append-only file — but neither is a durability promise you would put money behind. Anything you cannot recompute belongs in the database; Redis holds the copy.'],
  ['Choose an eviction policy on purpose', 'A cache should run allkeys-lru and shed cold keys. A lock or a queue must not — set noeviction there, or the box quietly deletes the thing you were relying on being present.'],
  ['One thread runs your commands', 'Which is why it is fast and predictable, and why KEYS, a huge ZRANGE or a slow Lua script blocks every other client on that box. Use SCAN, bound your ranges, keep scripts short.'],
  ['Round trips dominate, not Redis', 'A command takes microseconds; the network takes a millisecond. Ten sequential calls is ten milliseconds of nothing. Pipeline them, or do the whole sequence in one Lua script.'],
  ['A hot key beats your cluster', 'Sharding spreads keys, not traffic to one key. The single most-read key lands on one node, and that node is now your ceiling — replicate it, or put a short-lived in-process copy in front of it.']
];

/* ============================================================
   Ch16: one small animated diagram per pattern.

   Seven layouts cover all fifteen — the shape is the lesson, so
   Observer fans out, Decorator nests and State goes round.
   Everything animates in SVG itself (SMIL), so there are no
   timers running behind fifteen cards.
   ============================================================ */
C.patternDia = {
  singleton: { kind: 'fan',  dir: 'in',  hub: 'Instance', spokes: ['Client 1', 'Client 2', 'Client 3'] },
  factory:   { kind: 'flow', nodes: ['create()', 'Factory', 'Product'] },
  builder:   { kind: 'steps', items: ['.base()', '.walls()', '.roof()', '.build()'] },
  adapter:   { kind: 'flow', nodes: ['Square', 'Adapter', 'Round'] },
  decorator: { kind: 'nest', layers: ['retry', 'cache', 'generate()'] },
  facade:    { kind: 'fan',  dir: 'out', hub: 'Facade', spokes: ['Retrieve', 'Generate', 'Guard'] },
  proxy:     { kind: 'flow', nodes: ['Client', 'Proxy', 'Real object'] },
  composite: { kind: 'nest', layers: ['Document', 'Section', 'Chunk'] },
  observer:  { kind: 'fan',  dir: 'out', hub: 'Subject', spokes: ['Metrics', 'Drift', 'Training log'] },
  strategy:  { kind: 'switch', input: 'query', opts: ['keyword', 'dense', 'hybrid'], active: 2, output: 'results' },
  command:   { kind: 'flow', nodes: ['Invoker', 'Command', 'Receiver'] },
  iterator:  { kind: 'cells', vals: ['8', '3', '5', '1', '9', '4'], label: 'next()' },
  state:     { kind: 'cycle', states: ['Idle', 'Act', 'Wait', 'Done'] },
  template:  { kind: 'steps', items: ['load()', 'split()', 'fit()', 'register()'], override: 2 },
  chain:     { kind: 'flow', nodes: ['Small', 'Large', 'Human'] }
};
