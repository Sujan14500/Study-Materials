# LangChain Flow

An interactive, animated course on LangChain and LangGraph — from "what is a Runnable"
to "I can debug someone's RAG chain in the right order". Thirteen chapters, every
concept attached to something you can type into, drag or deliberately break.
Including an honest first chapter on when *not* to use it.

Companion to [`genai_flow`](../genai_flow) (tokens → RAG concepts),
[`langgraph`](../langgraph) (the deep dive on stateful graphs) and
[`agentic_ai_flow`](../agentic_ai_flow) (agent architecture) and
[`ai_system_design_concepts`](../ai_system_design_concepts) (system design). This one is the framework.

## Run it

Open `index.html` in a browser. That's it — no build, no server, no dependencies.

```
start index.html          # Windows
open index.html           # macOS
```

(Optional, if you prefer a server: `python -m http.server` then visit `localhost:8000`.)

Code examples are Python and current LangChain (LCEL, `langchain-core`).

## What's inside

| # | Chapter | The interactive bit |
|---|---------|---------------------|
| 1 | Why LangChain? | Tick what you need; get a line-count comparison and a verdict — sometimes "skip it" |
| 2 | Models & messages | Build a conversation and watch the exact payload that gets resent every call |
| 3 | Prompt templates | Live template lab — edit it, clear a variable, see the validation error |
| 4 | LCEL — the pipe | Click components into a chain; see the generated code and the data at every hop |
| 5 | Structured output | Four ways to get data out, including the JSON parser blowing up on a Tuesday |
| 6 | Loaders & splitters | Live splitter with chunk_size / overlap sliders and highlighted overlap |
| 7 | Embeddings & vectors | Real similarity search over eight documents, with scores you can argue with |
| 8 | The RAG chain | The full pipeline animated — then switch retrieval off and read what you get |
| 9 | Memory & history | Two sessions, one chain; watch session isolation and the resend cost climb |
| 10 | Tools & agents | Step an AgentExecutor trace message by message, iteration counter running |
| 11 | LangGraph | Step a self-correcting RAG graph through a retry cycle, watching state mutate |
| 12 | Ship it | Tracing setup, the debugging order, a RAG cost calculator and a checklist that saves |
| 13 | Final quiz | 12 questions with explanations, plus a 32-term glossary |

Progress, XP and the checklist persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework (shared base + this course's accents at the end)
js/content.js     every piece of course content — edit here to change the course
js/demos.js       the interactive widgets
js/app.js         navigation, progress, XP
test.js           node test.js — checks the course data is self-consistent
```

## Changing it

Almost everything you'd want to edit is in `js/content.js`: the knowledge base, the
LCEL component definitions, parser demos, agent trace, graph nodes, quiz, glossary.
`demos.js` only renders it.

`test.js` guards the invariants that are easy to break by hand — quiz answer indices,
the default chain type-checking under its own rules, every RAG question still retrieving
the document its answer was written for, the graph run still containing a cycle. Run it
after editing content:

```
node test.js
```
