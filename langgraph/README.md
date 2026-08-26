# LangGraph Flow

An interactive, animated course on LangGraph — from "why does a chain not just do this"
to rewinding a finished run and forking a different future from the middle of it.
Fifteen chapters, every idea attached to something you can step and break.

Companion to [`genai_flow`](../genai_flow) (tokens → RAG concepts),
[`langchain`](../langchain) (the framework),
[`agentic_ai_flow`](../agentic_ai_flow) (agent architecture, framework-free) and
[`ai_system_design_concepts`](../ai_system_design_concepts) (system design).
Do **LangChain Flow** first — this course assumes you know what a Runnable and an LCEL chain are.

## Run it

Open `index.html` in a browser. That's it — no build, no server, no dependencies.

```
start index.html          # Windows
open index.html           # macOS
```

(Optional, if you prefer a server: `python -m http.server` then visit `localhost:8000`.)

Code examples are Python.

## What's inside

| # | Chapter | The interactive bit |
|---|---------|---------------------|
| 1 | Chain or graph? | Six tasks, two questions: does control flow go backwards, does the run outlive the process |
| 2 | State & reducers | Swap the reducer and replay four nodes — watch "appended" become "silently lost" |
| 3 | Nodes & edges | Build a graph node by node; diagram, wiring and code follow along |
| 4 | Conditional edges | Four questions, one router, and the branch that lights up for each |
| 5 | Cycles & limits | Step a loop backwards through a node — then drop `recursion_limit` to 3 and watch it abort |
| 6 | `create_react_agent` | Step the two-node agent loop, messages accumulating in state |
| 7 | Scoped tools & state | Replay one task through two graphs — scoped per node, then everything bound everywhere — and watch two production side effects appear from nothing but the wiring |
| 8 | Checkpointers | Two threads, one graph; then kill the process and bring it back |
| 9 | Interrupts & HITL | Run until it pauses, then approve, edit or reject with a reason — three different endings |
| 10 | Time travel | Pick a checkpoint from the middle of a finished run, change one field, fork |
| 11 | Streaming | The same run through all five `stream_mode` values, side by side |
| 12 | Subgraphs & handoffs | Step a supervisor delegating with `Command(goto=…, update=…)` |
| 13 | Long-term memory | Store lab: namespaces, the same key in two of them, and a search that cannot escape one |
| 14 | Ship it | A checkpoint-storage calculator, six production concerns, and a checklist that saves |
| 15 | Final quiz | 12 questions with explanations, plus a 32-term glossary |

### Every chapter opens in plain English

Under each chapter heading sits a collapsible **plain English** block with two columns:
an everyday example on the left — no code, no jargon — and the same idea in Python on the
right. It is pitched at someone who knows a little Python and nothing about LLMs, and it
collapses once you no longer need it.

The text lives in `C.plain` in `js/content.js`, keyed by each chapter's `data-id`. Each
entry is `{ q, lay: {t, b}, tech: {t, b, code} }` — `q` is the question in the summary
bar, `lay` the everyday column, `tech` the code column. Blank lines in `b` become
paragraphs and `backticks` become inline code. `test.js` fails if a chapter has no entry
or an entry is half-filled.

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

Almost everything you'd want to edit is in `js/content.js`: the plain-English openers, the
graph node and edge lists, the traces, the checkpoint history, the store operations, quiz
and glossary. `demos.js` only renders it.

`test.js` guards the invariants that are easy to break by hand — quiz answer indices,
graph edges pointing at nodes that exist, the cycle demo actually containing a cycle and
still terminating inside `recursion_limit`, the reject path never sending anything, the
fork actually reaching a different answer, and no store read from a namespace nothing was
written to. Run it after editing content:

```
node test.js
```

## A note on versions

The core ideas — state, reducers, super-steps, checkpoints, interrupts, the store — have
been stable for a long time. The surface around them still moves: names get aliased,
keyword arguments get added, prebuilts improve. Where this course and your installed
version disagree on an exact call, trust the docs for the call and this course for what
the call is *for*.
