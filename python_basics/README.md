# Python Basics

An interactive, animated course that takes someone from "what is a variable" to reading a
traceback, picking the right container, and writing a comprehension without thinking about it.
Twelve chapters, every concept attached to something you can click, step or break.

The angle: syntax is the easy half. This course teaches the **model underneath** — names are
labels, objects live on a heap, defaults are evaluated once — because that is where every
confusing bug in your first year comes from.

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
| 1 | Values & types | Click any literal — see its type, mutability and truthiness |
| 2 | Names & objects | **Animated**: watch arrows wire names to heap objects, line by line. Amber = aliased |
| 3 | Strings & slicing | A live string lab, plus a slice ruler that lights up the surviving characters |
| 4 | Collections | **Animated**: race a list against a set on membership and count the comparisons |
| 5 | Control flow | A step-through tracer with a live variable table — changed values flash |
| 6 | Functions | Click a call, watch each parameter get filled; then run the mutable-default trap |
| 7 | Errors | Seven real tracebacks that type in bottom-up, with the fix beside them |
| 8 | Comprehensions | Watch items flow through map / filter / dict / set / generator forms |
| 9 | Files & projects | An animated terminal that sets up a venv, plus one annotated class |
| 10 | Gotchas | Nine guess-the-output cards |
| 11 | Final quiz | 15 questions with explanations, plus a 28-term glossary |

Progress, XP and answers persist in `localStorage`.

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

Almost all text, examples, traces, quiz questions and glossary terms live in `js/content.js`.
Add a chapter by copying a `<section class="chapter">` block in `index.html` — the sidebar,
pager and progress bar build themselves from the DOM.

Run `node test.js` after editing. It does more than shape-checking: it **recomputes** the
answers the course claims. Specifically it checks that

- every slice result matches a real implementation of Python's slice rules (negative indexes,
  exclusive stop, clamping, negative step),
- every string-method and f-string result matches an independent computation,
- every comprehension result matches the declared input actually being mapped/filtered,
- every name in the binding demo points at an object that exists on the heap at that step, and
  the aliasing program really does end with two names on one object while the rebinding one does not,
- each tracer program ends on the values it promises, and stdout only ever grows,
- every traceback's last line is the exception it claims to be,
- each `order(...)` call binds exactly the parameters in the signature, and the keyword-only
  argument is never reachable positionally,
- every `#id` the demos reach for is actually created somewhere.

That last one has already caught one real wiring bug.

## Notes on accuracy

- Everything shown is standard CPython 3.10+ behaviour. Where something is an implementation
  detail rather than a language guarantee, the course says so — small-int caching in the
  `is` gotcha is the main one.
- Complexity figures in Chapter 4 are the documented amortised costs for CPython's built-in
  containers, not measurements on your machine.
- The list-vs-set race counts real comparisons (a list scan does index+1 of them; a set does
  one hash probe). The *animation speed* is arbitrary; the *counts* are not.
- The tracer replays hand-written step data rather than executing Python in the browser. The
  steps are checked against their declared end state by `test.js`, but they are a recording,
  not a live interpreter.
- Chapter 9's project layout is one common convention (`src/` layout), not the only correct one.
