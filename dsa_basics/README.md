# DSA Basics

An interactive, **theory-first** course on data structures and algorithms. Fourteen
chapters covering complexity, arrays, strings, nodes and linked lists, stacks, queues,
hash tables, trees, heaps, graphs, sorting, searching, recursion, dynamic programming
and how to choose between them.

**There are no coding problems here.** No LeetCode, no exercises to solve, no "implement
a reversed linked list". This is the conceptual half: what each structure *is*, what it
makes cheap, what it makes expensive, and why — each definition immediately attached to
something you can push, step and watch.

Companion to the AI courses in this repo — [`genai_flow`](../genai_flow),
[`agentic_ai_flow`](../agentic_ai_flow), [`langchain`](../langchain),
[`langgraph`](../langgraph) and
[`ai_system_design_concepts`](../ai_system_design_concepts). This one is the foundation
underneath all of them.

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
| 1 | Big-O & complexity | Drag n and watch six growth classes diverge on a log scale; then name the complexity of six plain-English operations |
| 2 | Arrays | Click a cell to see the address arithmetic; watch elements shift on insert; push items and watch a dynamic array double |
| 3 | Strings | Type text and see characters vs code units vs bytes disagree; a slider showing why building a string in a loop is quadratic |
| 4 | Nodes & linked lists | Insert at head, at tail, delete, and walk to an index — each with the cost and the reason; full array-vs-list table |
| 5 | Stacks & queues | Feed both the *same* items, remove from both, watch the answers diverge |
| 6 | Hash tables | Insert keys, see the hash → bucket arithmetic, shrink the table and watch collisions and load factor climb |
| 7 | Trees | Animate all four traversals on a BST — then insert the same values *sorted* and watch it degenerate into a list |
| 8 | Heaps | Insert with sift-up, extract with sift-down, with the flat array shown alongside the tree |
| 9 | Graphs | Step BFS and DFS on the same graph with the queue/stack shown; toggle adjacency list vs matrix |
| 10 | Sorting & searching | Six sorts animated with live comparison counts; linear vs binary search on the same array |
| 11 | Recursion | Watch the call stack pile up and unwind; switch to naive Fibonacci and count the calls |
| 12 | Dynamic programming | Every naive Fibonacci call grouped by subproblem — the duplication, counted, next to the memoised total |
| 13 | Algorithm paradigms | Five strategies, then name the paradigm for six problems (two are traps) |
| 14 | Choosing a structure | Eight requirements phrased the way a colleague would say them, plus the cheat sheet |
| 15 | Final quiz | 12 questions with explanations, plus a 58-term glossary |

Progress and XP persist in `localStorage`.

## Files

```
index.html        all chapter markup
css/styles.css    one theme, no framework (shared base + this course's accents at the end)
js/content.js     every definition, fact and drill — edit here to change the course
js/demos.js       the interactive widgets; the algorithms are computed live, not hardcoded
js/app.js         navigation, progress, XP
test.js           node test.js — verifies every animated algorithm is actually correct
```

## Changing it

Definitions, facts, drill questions, the glossary and the demo data (which values go
into the BST, which keys into the hash table, which graph) all live in `js/content.js`.
`demos.js` renders them and *runs the real algorithms* — traversals, sifts, BFS/DFS, six
sorts, binary search and the Fibonacci call tree are computed from that data, not
written out by hand.

That is what makes `test.js` worth having. A teaching course must not teach something
false, so the test re-implements each algorithm independently and checks the claims the
chapters actually make:

- in-order traversal of the BST really does come out sorted
- the "degenerate" tree really does reach height = node count, and the balanced one does not
- the heap invariant holds after every insert and every extraction, and repeated
  extract-min yields sorted output
- BFS really does visit nodes in non-decreasing distance from the start (the property the
  shortest-path claim rests on), and BFS and DFS really do differ on the demo graph
- all six sorts actually sort, starting from the input, and merge beats bubble on comparisons
- binary search finds every element, reports misses, and stays within log₂(n) steps
- the naive-vs-memoised Fibonacci gap widens sharply with n

```
node test.js
```

It also enforces the softer things that are easy to break by hand — every drill answer
must name a real option, no drill may have a single repeated answer, the growth classes
must be ordered by actual growth, and the array-vs-list table must show each structure
winning something.
