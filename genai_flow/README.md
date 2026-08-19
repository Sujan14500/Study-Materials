# GenAI Flow

An interactive, animated course that takes someone from "what even is a token" to
"I could ship a RAG-backed agent". Fourteen chapters, every concept attached to
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
| 6 | Training | Pretraining → SFT → preference tuning, click through each stage |
| 7 | Prompt engineering | Prompt lab: toggle ingredients, watch answer quality move |
| 8 | Context & memory | Fill a context window until it overflows and the model forgets your name |
| 9 | RAG | The full pipeline animated, with real retrieval scoring over a tiny knowledge base |
| 10 | Prompt vs RAG vs fine-tune | Three questions, one reasoned recommendation |
| 11 | Agents & tools | Step through think → act → observe loops |
| 12 | Evaluation & risk | Spot the hallucination |
| 13 | Ship it | Cost/latency calculator and a production checklist that saves |
| 14 | Final quiz | 12 questions with explanations, plus a glossary |

Progress, XP and the checklist persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework
js/content.js     every piece of course content — edit here to change the course
js/demos.js       the interactive widgets
js/app.js         navigation, progress, XP
test.js           node test.js — fails if the course data goes inconsistent
```

## Editing the course

Almost all text, examples, quiz questions and glossary terms live in `js/content.js`.
Add a chapter by copying a `<section class="chapter">` block in `index.html` — the
sidebar, pager and progress bar build themselves from the DOM.

Run `node test.js` after editing content: it checks the vector-arithmetic words exist
and are actually parallel on the map, that quiz answer indices are valid, and that
every RAG question can retrieve something.

## Notes on accuracy

- The tokenizer is a heuristic approximation of BPE, not a real one — it demonstrates
  the behaviour (rare words shatter, spaces attach to tokens) without a 100k-entry vocab.
- The embedding map is hand-placed in 2D so the geometry is visible. Real embeddings
  have hundreds to thousands of dimensions.
- Attention weights and next-token probabilities are illustrative, chosen to show the
  phenomenon the chapter is teaching.
- The cost calculator takes your own $/million-token rates, because real prices change.
