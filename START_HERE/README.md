# Start Here

The map for everything else in this repository. Twelve interactive courses and a
486-question interview bank, arranged in the order that makes each one easier than
the last — with five tracks, because not everybody has twelve weeks.

## Run it

Open `index.html` in a browser. Every card opens the corresponding course in a new tab.

```
start index.html          # Windows
open index.html           # macOS
```

## What is on the page

- **A track picker.** *Everything in order* (10–14 weeks), *I already write software*
  (6–8), *GenAI engineer role* (4–6), *AI / platform engineer role* (5–7), and
  *Interview in two weeks* (10 evenings). Choosing one reorders the stages and dims the
  ones that track skips — nothing is hidden, only re-prioritised.
- **Seven stages**, each with the courses it contains, what they cover, and — the field
  that actually matters — *why it is on the roadmap at this point*.
- **A progress ring and a "next up" button.** Tick a course off and the road at the top
  fills in. The button opens whatever you should do next on the current track.
- **A flat table** of all twelve, for when you would rather just pick something.

Progress lives in `localStorage`. Nothing leaves the browser.

## The order, and why

| Stage | Courses | Why here |
|-------|---------|----------|
| 0 · Foundations | Python, DSA, ML, DL | Skippable if you already ship software. ML gives you the evaluation vocabulary; DL makes the transformer chapter click rather than be memorised. |
| 1 · How LLMs work | GenAI Flow | The core. Everything after it is an application of these chapters. |
| 2 · Building with them | LangChain, LangGraph | The plumbing, once you know what the model is doing. LangGraph is where checkpointing and human-in-the-loop live. |
| 3 · Agents | Agentic AI Flow | Where interviews are going. Harness engineering answers the "same model, different quality" question. |
| 4 · Systems and scale | AI System Design | The whiteboard round, and where the cost and latency arithmetic lives. |
| 5 · Two real systems | Projects Walkthrough, Datanyx | So you have something real to answer "tell me about something you shipped". |
| 6 · Interview drilling | AI Interview Prep | Start this in parallel with Stage 1, not at the end. |

## Files

```
index.html        the roadmap page
css/styles.css    one theme, shared with the courses it links to
js/roadmap.js     every course, stage and track — edit here to change the roadmap
js/app.js         rendering, progress, track switching
test.js           node test.js — fails if the roadmap points somewhere that is not there
```

## Testing

`node test.js` checks the things that silently rot:

- every course's `href` resolves to a file that actually exists on disk
- every stage references real courses, and every course appears in exactly one stage
- every course is reachable from at least one track (nothing orphaned in the UI)
- the `full` track really does contain every stage
- the two-week track is genuinely less than half the full one
- every element id `app.js` reaches for exists in the markup
- both SVG gradients the CSS paints with are defined in the document

Run it after adding a course, renaming a folder or reordering a stage.
