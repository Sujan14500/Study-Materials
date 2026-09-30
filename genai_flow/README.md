# GenAI Flow

An interactive, animated course that takes someone from "what even is a token" to
"I could ship a RAG-backed agent". Twenty-six chapters, every concept attached to
something you can click, drag or break.

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
| 1 | What is GenAI? | Be the language model — guess the next word, then see the real probabilities |
| 2 | Tokens | Live tokenizer with per-token IDs and cost stats |
| 3 | Embeddings | A 2D meaning map with nearest-neighbour search and runnable vector arithmetic |
| 4 | Attention | Hover any word, watch what it attends to |
| 5 | Generation | A sampler with temperature and top-p — step it, or watch it run |
| 6 | Making it fast | Race bulk against streaming, then flip streaming / prompt cache / KV cache / speculative decoding and watch which number each one actually moves |
| 7 | Training | Pretraining → SFT → preference tuning, click through each stage |
| 8 | Prompt engineering | Prompt lab: toggle ingredients, watch answer quality move |
| 9 | Context & memory | Fill a context window until it overflows and the model forgets your name |
| 10 | RAG | The full pipeline animated, with real retrieval scoring over a tiny knowledge base. Then hybrid RAG end to end — two indexes, two lanes, one fused ranking — with reciprocal rank fusion computed live on three queries where a different lane wins each time |
| 11 | Advanced RAG | Switch the dense / sparse / late-interaction lanes on and off over one knowledge base, fan one question into five and fuse them with RRF, then break a RAG system four different ways and watch which metric family collapses |
| 12 | Prompt vs RAG vs fine-tune | Three questions, one reasoned recommendation |
| 13 | Agents & tools | Step through think → act → observe loops |
| 14 | Evaluation & risk | Spot the hallucination |
| 15 | Ship it | Cost/latency calculator, a production checklist that saves, and 40 production interview questions with animated diagrams |
| 16 | Mem0: agent memory | Step a conversation through extract → reconcile and watch ADD/UPDATE/DELETE/NOOP fire, then search the store |
| 17 | Data Formulator | Fill in encoding shelves, ask for a field the data doesn't have, read the pandas/SQL it generates |
| 18 | One transformer block | A real 4-dim, 1-head model computed live: step all ten operations, then switch the feed-forward off and watch the prediction flip from "cat" to "mat" |
| 18b | Reading print(model) | The real Llama 3.2 3B printout, every line clickable and synced to a data-flow diagram: plain-English and technical explanation, shapes, exact parameter count, maths and interview trap for each module. Plus a live tensor-shape tracer, where the 3.21B parameters live (and why the notebook said 12.9 GB), GQA vs MHA vs MQA with a KV cache calculator, and a LoRA target_modules calculator |
| 19 | Decoding controls | Temperature, top-k, top-p, repetition penalty, stop sequences and max tokens applied to one real distribution, in the order a server applies them |
| 20 | Chunking | Six splitters run live on one document, plus a probe question whose answer sits on a boundary |
| 21 | Fine-tuning menu | A four-question decision tool, a LoRA-vs-QLoRA table, a draggable-rank LoRA diagram, exact parameter arithmetic, and the ten knobs of a QLoRA run: the four steps of training with the knobs that act in each, a config builder for the five QLoRA knobs (target modules, r, alpha, quantization, dropout) and the five training knobs (epochs, batch size, learning rate, gradient accumulation, optimizer) that reviews your settings, draws the learning-rate schedule and writes the Python |
| 22 | LLM as a judge | Eight judged answer pairs with the biases switched on; toggle mitigations and watch agreement with humans climb from 25% to 100% |
| 23 | Beyond RAG | A long-context-vs-RAG calculator on your own numbers, classic vs agentic RAG animated, five architectures compared, and an Arabic retrieval debug |
| 24 | Final quiz | 35 questions with explanations, plus an 80-term glossary |

Progress, XP and the checklist persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework
js/content.js     every piece of course content — edit here to change the course
js/demos.js       the interactive widgets
js/hybridrag.js   hybrid RAG: the animated pipeline and the RRF fusion bench
js/llama.js       Reading print(model): Llama 3.2 3B, every widget driven by one config
js/qlora.js       the ten knobs of a QLoRA run: config builder, review, LR schedule, generated Python
js/app.js         navigation, progress, XP
test.js           node test.js — fails if the course data goes inconsistent
```

## Editing the course

Almost all text, examples, quiz questions and glossary terms live in `js/content.js`.
Add a chapter by copying a `<section class="chapter">` block in `index.html` — the
sidebar, pager and progress bar build themselves from the DOM.

Run `node test.js` after editing content: it checks the vector-arithmetic words exist
and are actually parallel on the map, that quiz answer indices are valid, that every RAG
question can retrieve something, that the Mem0 run only UPDATEs/DELETEs memories that
exist at that point, that every Data Formulator number ties back to `sales.csv`, and that
every `#id` the demos reach for is actually created somewhere.

The deep-dive chapters get the same treatment. Chapter 18's transformer is re-implemented
from scratch in `test.js` and asserted: every attention row sums to 1, nothing attends to the
future, "sat" really does attend mostly to "cat", and — the claim the chapter is built on —
the feed-forward ON predicts a *place* word while feed-forward OFF predicts an *animate* one.
The print(model) chapter re-derives Llama 3.2 3B’s parameter count straight from the printed shapes and pins it to 3,212,749,824, checks that fp32 reproduces the notebook’s 12.9 GB, that GQA really cuts the KV cache 3×, that 8192 is exactly 8/3 × 3072, that every printed line has a full explanation, and that print order really does differ from run order. Chapter 19 asserts that temperature monotonically raises entropy and that top-p keeps the
smallest set covering the mass. Chapter 21 checks the LoRA arithmetic really is under 1% of
the base model and that the VRAM ordering QLoRA < LoRA < full holds; its QLoRA config builder
re-derives Llama 3 8B, Mistral 7B and Llama 3 70B from their real shapes (8,030,261,248 /
7,241,732,096 / 70,553,706,496 parameters), pins r=16 on all seven linears of the 8B to 41,943,040,
places every one of the ten knobs in one of the four training steps, and checks that the sensible
default raises no warning while the "did nothing" and "memorised" scenarios are caught for the
right reasons. Chapter 22 asserts the
naive judge looks unreliable, the mitigated one reaches 100%, and position swap is the single
biggest lever. Chapter 23 asserts stuffing a corpus costs far more than retrieving from it and
that the lost-in-the-middle curve dips in the middle and is symmetric.

It also re-derives chapter 6’s inference maths independently and asserts the claims the
chapter makes: streaming moves time-to-first-token and *nothing* else, prompt caching moves
prefill and leaves tokens-per-second untouched, decode is linear in output length with a KV
cache and superlinear without one, and speculative decoding is a win at the configured
acceptance rate and a **loss** at zero. If a future edit breaks one of those, the chapter is
teaching something false and the test says so.

## Notes on accuracy

- The tokenizer is a heuristic approximation of BPE, not a real one — it demonstrates
  the behaviour (rare words shatter, spaces attach to tokens) without a 100k-entry vocab.
- The embedding map is hand-placed in 2D so the geometry is visible. Real embeddings
  have hundreds to thousands of dimensions.
- Attention weights and next-token probabilities are illustrative, chosen to show the
  phenomenon the chapter is teaching.
- The cost calculator takes your own $/million-token rates, because real prices change.
- Chapter 6’s prefill/decode constants (tokens per second, cache speedup, draft acceptance rate)
  are plausible mid-size-model figures, not measurements — yours will differ. The *arithmetic*
  around them is the real model, including the standard speculative-decoding expectation
  `E = (1 - a^(g+1)) / (1 - a)`, so every trade-off points the right way even if your constants do not match.
- The Mem0 chapter replays a scripted run of the real extract/reconcile pipeline. A live
  run costs two LLM calls per turn and will word its memories differently; the operations
  and the decision logic are the real thing. Similarity scores are illustrative.
- The Data Formulator chapter ships pre-computed transforms so every number on screen can
  be checked against `sales.csv` in `test.js`. A live run generates the code fresh, and the
  code shown is the shape of what it produces, not a verbatim capture.
- Chapter 18's model is a genuine transformer block, just a tiny one: 4 dimensions, 1 head,
  8 tokens of vocabulary. The weights are hand-designed so the dimensions mean something
  (animate / action / place / modifier) and so one feed-forward neuron is a readable "fact"
  neuron. Real models learn these; the *mechanism* on screen is the real thing.
- The print(model) chapter uses the real Llama 3.2 3B config (hidden 3072, 28 layers, 24 query / 8 KV heads, MLP 8192, vocab 128,256, tied embeddings, rope_theta 500,000). The printout text matches recent transformers releases; older ones print `SiLU()` instead of `SiLUActivation()` and put `rotary_emb` inside each attention layer.
- Chapter 22's judge bench is a deterministic simulation over eight real answer pairs, with
  each documented bias modelled as an explicit term. Toggling a mitigation zeroes its term.
  The agreement numbers are what that model produces, not measurements of a specific judge.
- Chapter 23's "lost in the middle" curve is the *shape* reported in that literature, scaled
  by context length. Your model's curve will differ; the argument does not.
- Chapter 15 is about Microsoft Research's open-source Data Formulator, not a Power BI
  feature. Power BI's own AI is Copilot; the chapter says so and compares them.
