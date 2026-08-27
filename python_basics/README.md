# Python Basics

An interactive, animated course that takes someone from "what is a variable" to reading a
traceback, picking the right container, writing a comprehension without thinking about it, and
then fitting a model with scikit-learn. Thirteen chapters, every concept attached to something
you can click, step or break.

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
| 10 | The data stack | **Animated**: a Python loop and a NumPy array race on the same sum; then eleven pandas operations with their real output |
| 11 | scikit-learn & ML | **Animated**: step an eight-stage churn pipeline; pick the estimator for six jobs; six ways to fool yourself |
| 12 | Gotchas | Nine guess-the-output cards |
| 13 | Final quiz | 21 questions with explanations, plus a 45-term glossary |

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
- every pandas result in Chapter 10 matches a reimplementation of pandas' own printing rules
  applied to the one source table — the frames, the Series, the column widths,
- the scikit-learn walkthrough never mentions `X_test` between the split and the evaluate stage,
  which is the leak the chapter spends its whole length warning about,
- every option in the estimator chooser is the right answer somewhere, so none is dead,
- every `#id` the demos reach for is actually created somewhere.

That last one has already caught two real wiring bugs.

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
- Chapter 10's list-vs-array bars count **Python-level operations** — a million versus one. That
  number is exact. The wall-clock speedup is stated as a typical range and is not measured in
  your browser, which the widget says on screen.
- The pandas outputs are recomputed from the source table by `test.js`, and formatted the way
  pandas 2.x prints them. Older pandas differs in small ways (`value_counts` gained its
  `Name: count` line in 2.0).
- Chapter 11 teaches conventional practice — split first, pipeline everything, touch the test set
  once. That is the consensus, not a law; time series, tiny datasets and nested CV all bend it.
