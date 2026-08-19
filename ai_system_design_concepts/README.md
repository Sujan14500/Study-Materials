# AI System Design Flow

An interactive, animated course on AI/ML system design — the discipline, not the model zoo.
Sixteen chapters spanning classic ML systems (recommenders, search, fraud) and LLM-era ones
(RAG at scale, model cascades), because real products contain both.

**Written for someone with no prior experience.** Chapter 1 is nothing but vocabulary —
eighteen terms in plain English with an everyday comparison each — and every chapter after
it opens with a jargon-free summary you could read on its own. One running example, a
food-delivery app, carries the whole course, so you are never learning a new domain and a
new concept at the same time.

Every idea is attached to a calculator or a simulator you can push until it breaks: server
sizing, A/B sample size, latency budgets, retrieval funnels, cost per 1k queries, and a
feedback loop that collapses a catalogue in front of you. Each calculator has a worked
example above it with small friendly numbers, so you do the arithmetic by hand once before
the slider becomes a magic box.

Companion to [`genai_flow`](../genai_flow) (how LLMs work),
[`agentic_ai_flow`](../agentic_ai_flow) (agent architecture),
[`langchain`](../langchain) and [`langgraph`](../langgraph) (the frameworks).
This one is the layer above all of them: what to build, and whether it will survive.
For the foundation underneath, see [`dsa_basics`](../dsa_basics).

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
| 1 | The words first | 18 terms in plain English with an everyday comparison each, plus a drill that checks they landed |
| 2 | The framework | You get three clarifying questions before designing. Five of eight are load-bearing — pick them |
| 3 | Metrics | Five situations, one defensible metric each; plus the offline-proxy → online-truth table |
| 4 | Data & labels | Five label sources compared on volume, bias and cost — none wins on all three |
| 5 | Features & skew | Eight features: safe, skewed, or leaking? Two are genuinely nasty |
| 6 | The model ladder | Pick a task, watch the right rung move from "a few if-statements" to "LLM" on the same ladder |
| 7 | Retrieval funnel | Tune the stage sizes; watch the first stage cap everything downstream |
| 8 | Latency budgets | Toggle components against a time budget; turn on the LLM and watch 200ms become impossible |
| 9 | Capacity & scale | Server sizing from users and requests; find out the cache is the biggest lever |
| 10 | Offline → online | A/B sample-size calculator, plus a peeking slider that wrecks your false-positive rate |
| 11 | Feedback loops | 60 items, 10 slots, 25 rounds — watch the catalogue collapse to 10, then add exploration |
| 12 | RAG at scale | Chunk size, k, hybrid, rerank, cache → how often the right document is found, and what it costs |
| 13 | LLM serving & cost | Model-cascade simulator; drop the router accuracy and watch the savings evaporate |
| 14 | Canonical designs | Feed, search, fraud, support assistant — stage by stage, with the gotcha on each |
| 15 | Operate it | Rollout ladder, failure modes and fallbacks, and a checklist that saves |
| 16 | Final quiz | 12 questions with explanations, plus a 40-term glossary |

Every chapter opens with a jargon-free "in plain English" box, and the four calculators
each have a hand-worked example above them.

Progress, XP and the checklist persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework (shared base + this course's accents at the end)
js/content.js     every piece of course content — edit here to change the course
js/demos.js       the interactive widgets, including all the arithmetic
js/app.js         navigation, progress, XP
test.js           node test.js — checks the content AND the widget maths
```

## Changing it

Almost everything you'd want to edit is in `js/content.js`: scenarios, label sources,
feature cards, ladder rungs, funnel stages, latency components, cascade tiers, the four
canonical designs, quiz and glossary. `demos.js` renders it and does the arithmetic.

`test.js` is unusually load-bearing for this course, because several chapters make
quantitative claims. It re-derives the widget maths independently and asserts the claims
actually hold:

- Little's Law sizing lands on the replica count the chapter quotes
- A/B sample size matches the standard two-proportion approximation, and scales with 1/δ²
- stage-1 recall genuinely caps end-to-end funnel quality
- a reliable router saves >40% and a bad one visibly does not
- **the feedback-loop simulation actually collapses** (greedy stays at the launch slate;
  exploration opens the catalogue and raises the quality served)

It also guards the things that keep the course readable for a beginner, because those rot
the moment someone adds a chapter:

- every chapter has a plain-English summary, and every summary is checked to contain **no
  jargon** (`p99`, `QPS`, `AUC`, `nDCG`, `SLO`… are all rejected in that box)
- the vocabulary chapter actually defines every term the later chapters lean on
- every calculator has a worked example, and the capacity walkthrough still lands on the
  same numbers the calculator produces

Plus the ordinary content invariants — no label source may dominate on all three axes,
ladder rungs must climb in quality *and* cost *and* latency, every canonical design must
start at requirements and end at operating it.

```
node test.js
```

That last assertion caught a real bug during authoring: the first version of the feedback
loop rotated through the whole catalogue instead of collapsing, which would have taught
the opposite of the chapter's point.

## A note on the numbers

The calculators use standard formulas (Little's Law, the two-proportion sample-size
approximation) with real arithmetic. The *quality* curves — funnel recall, RAG recall,
blended cascade quality — are plausible illustrative models, not measurements from a
specific system. They are tuned so the **shape** and the **direction** of every trade-off
is right, which is what transfers. Do not quote the third decimal at your next design
review; do quote "recall@k caps everything downstream" and "sample size scales with 1/δ²".
