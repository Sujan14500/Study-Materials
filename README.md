# Study Materials

Interactive, animated courses for getting from "what even is a token" to designing and
defending a production GenAI system in an interview. Everything is plain HTML, CSS and
JavaScript — no build, no server, no dependencies. Open a file, learn a thing.

## Start here

**→ [`START_HERE/index.html`](START_HERE/index.html)**

The roadmap: every course in the order to do them, five tracks depending on how much
time you have, and a button that opens whatever you should do next.

## What is in the repo

| Folder | What it is | Size |
|--------|-----------|------|
| [`START_HERE`](START_HERE) | The roadmap and course launcher | 1 page |
| [`ai_interview_prep`](ai_interview_prep) | 486 interview questions with plain-English *and* technical answers, 203 multiple-choice questions, flashcards, timed mock interview | 486 questions |
| [`genai_flow`](genai_flow) | How LLMs actually work — tokens through to shipping, plus deep dives on one transformer block, decoding controls, chunking, the fine-tuning menu, LLM-as-judge and beyond-RAG | 24 chapters |
| [`ai_system_design_concepts`](ai_system_design_concepts) | AI/ML system design — metrics, latency budgets, capacity, vector indexes, serving, plus caching layers, parallelism, Elasticsearch and big-files-small-RAM | 23 chapters |
| [`agentic_ai_flow`](agentic_ai_flow) | Agent architecture — the loop, tools, planning, memory, multi-agent, MCP, plus harness engineering and an eight-failure playbook | 17 chapters |
| [`projects_walkthrough`](projects_walkthrough) | Two real systems taken apart: a refund agent and a support platform | 18 chapters |
| [`langgraph`](langgraph) | State, graphs, checkpointing, interrupts, time travel | 15 chapters |
| [`dsa_basics`](dsa_basics) | Big-O through dynamic programming, every algorithm animated | 15 chapters |
| [`langchain`](langchain) | Models, LCEL, splitters, retrievers, the RAG chain, agents | 13 chapters |
| [`ml_fundamentals`](ml_fundamentals) | Splits, gradient descent, evaluation, overfitting, trees | 13 chapters |
| [`python_basics`](python_basics) | Values through to files, projects and the gotchas | 13 chapters |
| [`dl_fundamentals`](dl_fundamentals) | Neurons, backpropagation, vanishing gradients, convolution | 12 chapters |
| [`datanyx2.0`](datanyx2.0) | Field guide and interview Q&A for the Datanyx project | 1 guide |
| [`refund-agent`](refund-agent), [`support-platform`](support-platform) | The runnable source for the two systems in `projects_walkthrough` | code |

## How these are built

Every course is the same four files: `index.html` for the markup, `css/styles.css` for
one theme with no framework, `js/content.js` for all the course data, and `js/demos.js`
for the interactive widgets. Editing a course means editing `content.js`.

Every course also has a `test.js` that runs on plain Node with no dependencies:

```
cd genai_flow && node test.js
```

These are not decorative. They re-derive the maths a chapter teaches and assert the
claims it makes on screen — that streaming moves time-to-first-token and nothing else,
that speculative decoding is a *loss* at zero acceptance, that the feed-forward layer
switched off really does change the prediction, that a semantic cache with a loose
threshold really does serve wrong answers. If an edit makes a chapter teach something
false, the test says so.

Run them all:

```bash
for d in genai_flow ai_system_design_concepts agentic_ai_flow langchain langgraph \
         ml_fundamentals dl_fundamentals python_basics dsa_basics \
         projects_walkthrough ai_interview_prep START_HERE; do
  printf '%-28s ' "$d"; (cd "$d" && node test.js | tail -1)
done
```

## Conventions

- **Two answers for everything.** A plain-English one that would survive a
  non-technical stakeholder, and a technical one that would survive a follow-up.
- **Comparisons where things are best learned against each other.** LoRA vs QLoRA,
  RAG vs agentic RAG, tensor vs pipeline parallelism, BM25 vs dense vs hybrid.
- **Interactive over illustrative.** If a chapter claims a trade-off, there is usually a
  slider that lets you break it.
- **Honest about uncertainty.** Where a term is contested or a number is illustrative,
  the page says so rather than sounding confident.
