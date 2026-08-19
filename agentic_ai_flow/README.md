# Agentic AI Flow

An interactive, animated course on agentic AI — from "what actually makes something
an agent" to "I can review someone's agent design and name what will break".
Thirteen chapters, every concept attached to something you can step, drag or break.

Companion to [`genai_flow`](../genai_flow) (tokens → RAG),
[`langgraph`](../langgraph) (stateful graphs) and
[`langchain`](../langchain) (the framework) and
[`ai_system_design_concepts`](../ai_system_design_concepts) (designing the system around it).
Do GenAI Flow first if you are new to LLMs.

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
| 1 | What is agentic? | Sort six real requests into prompt / chain / agent — the cheapest one that works is the right one |
| 2 | The agent loop | Step think→act→observe through three real traces, including one that fails and recovers |
| 3 | Tools & function calling | Switch tools off and watch the model lose the ability, not just the will |
| 4 | ReAct | Same question answered three ways; the tool call reverses the model's prior |
| 5 | Planning | Watch a goal decompose into dependency waves, and see what parallelism buys |
| 6 | Memory | Four memory types, a conversation getting filed, and a quiz on which one did the work |
| 7 | Reflection | Draft → critique → revise, with the score flattening out so you can see where to stop |
| 8 | Multi-agent | Four topologies animated, with call counts, latency and cost side by side |
| 9 | Guardrails & HITL | Gate drill: run it, ask a human, or block in code — seven actions, real answers |
| 10 | Reliability maths | Sliders for per-step accuracy and step count; watch 95% become 36% |
| 11 | Evaluating agents | Four runs graded on outcome *and* trajectory — two pass an outcome-only eval and shouldn't |
| 12 | Ship it | Cost calculator showing quadratic growth, architecture, and a checklist that saves |
| 13 | Final quiz | 12 questions with explanations, plus a 30-term glossary |

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

Almost everything you'd want to edit is in `js/content.js`: task lists, traces, tool
definitions, guardrail verdicts, quiz questions, glossary. `demos.js` only renders it.

`test.js` guards the invariants that are easy to break by hand — quiz answer indices,
plan dependencies pointing backwards, loop traces that terminate, irreversible actions
never marked auto-approve. Run it after editing content:

```
node test.js
```
