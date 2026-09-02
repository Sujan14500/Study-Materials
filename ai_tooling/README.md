# AI Tooling Landscape

The breadth course. Twelve layers of the modern AI stack, ninety-five named tools, and the
same promise on every single one of them:

- **two lines** on what it is and who makes it,
- **at least five points** you can say out loud without bluffing,
- **when to reach for it**, and
- **the objection you will get** when you do.

Open [`index.html`](index.html). No build, no server, no dependencies.

## Why this course exists

The rest of this repo teaches how things work. This one teaches what things are *called* and
where they sit — because the gap that actually costs people interviews is not understanding
attention, it is being shown a slide with eighty logos on it and not being able to place one.

The organising idea is that the ecosystem is not chaos. It is twelve layers, and each one
answers exactly one question:

| Question | Layer |
|---|---|
| What produces the words? | LLM |
| Who decides what happens next? | Agentic AI |
| Where do the facts come from? | RAG |
| How does text become a number? | Embedding |
| How does the model reach my systems? | MCP |
| What stops it doing something stupid? | AI Security |
| How do I know what it did? | Observability |
| What does it remember next time? | Memory |
| What runs the loop in production? | AI Agent SDKs |
| What triggers it, and what happens after? | Automation |
| Where do the vectors live? | Vector Database |
| How does a human actually reach it? | App & Serving |

Learn the twelve questions and you can place a tool that did not exist when this was written.

## What is in it

19 chapters:

- **Start here** — the animated ecosystem map, and the one-question-per-layer table.
- **Twelve layer chapters** — five points on the layer, then every tool in it as an
  interactive card.
- **Three animated architecture diagrams** — MCP, RAG and the agent loop, each one wired
  up step by step so the difference between them is a picture, not a paragraph. They live in
  the MCP, RAG and Agentic AI chapters and are defined in `C.arch` in `js/content.js`.
- **Choosing** — the build-vs-buy ladder (add one rung at a time, and the triggers that
  justify each), and a 14-scenario "pick the right tool" drill.
- **Drilling** — a searchable catalogue of all 95 tools, 20 rapid-fire comparisons, and a
  14-question quiz where every wrong answer sounds impressive.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup and chapter structure |
| `css/styles.css` | The shared course theme |
| `css/tooling.css` | Widgets specific to this course |
| `js/content.js` | The spine: map questions, picker, ladder, rapid fire, quiz |
| `js/cat-core.js` | LLM · Agentic AI · RAG · Embedding |
| `js/cat-infra.js` | MCP · AI Security · Observability |
| `js/cat-state.js` | Memory · AI Agent · Automation · Vector Database |
| `js/cat-app.js` | App & Serving |
| `js/demos.js` | Renders all of the above. No content lives here. |
| `js/app.js` | Navigation, progress, XP |

The catalogue is split across `cat-*.js` the same way `ai_interview_prep` splits `bank-*.js`.
To add a tool, add an object to the right category's `tools` array — nothing else needs
touching.

## Test

```
node test.js
```

It is not decorative. It enforces the promise on the front page: every tool must have a
two-line summary and **at least five** substantive points, every picker option must name a
tool that exists in the catalogue, every layer must have a rendered chapter, and every mount
point `demos.js` looks for must exist in the HTML. Every diagram step must light a node
and an edge that actually exist. If an edit makes the course claim
something it does not deliver, the test says so.

Current output:

```
ok — 12 layers, 95 tools, 535 talking points, 14 quiz questions, 14 scenarios, 20 rapid-fire pairs
```

## Where this sits

Do it **after** GenAI Flow and Agentic AI Flow. Those two teach the mechanisms; this one
attaches names to them. Doing it first produces someone who can list tools and cannot
explain any of them, which is the exact failure mode it is meant to prevent.
