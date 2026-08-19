/* ============================================================
   content.js — every piece of course content lives here.
   Edit this file to change the course; demos.js only renders it
   and computes the algorithms live.

   This course is theory only. No coding problems, no exercises to
   solve — just the concepts, each attached to something you can
   poke until the definition sticks.
   ============================================================ */
window.C = {};

/* ---------- Ch1: complexity ---------- */
C.growthClasses = [
  { k: 'o1',     name: 'O(1)',        label: 'constant',    color: '#22c55e', f: () => 1,
    means: 'The work does not depend on the input size at all.',
    eg: 'Reading array[7]. Pushing onto a stack. A hash-table lookup that does not collide.' },
  { k: 'ologn',  name: 'O(log n)',    label: 'logarithmic', color: '#4ade80', f: n => Math.log2(n),
    means: 'Every step throws away half of what is left. Doubling the input adds one step.',
    eg: 'Binary search. Descending a balanced tree. Each level of a heap sift.' },
  { k: 'on',     name: 'O(n)',        label: 'linear',      color: '#a3e635', f: n => n,
    means: 'You touch every element once. Doubling the input doubles the work.',
    eg: 'Scanning a list for a value. Summing an array. Copying a string.' },
  { k: 'onlogn', name: 'O(n log n)',  label: 'linearithmic', color: '#facc15', f: n => n * Math.log2(n),
    means: 'A linear pass repeated for each halving level. The practical floor for comparison sorting.',
    eg: 'Merge sort, heap sort, the average case of quicksort.' },
  { k: 'on2',    name: 'O(n²)',       label: 'quadratic',   color: '#fb923c', f: n => n * n,
    means: 'Every element compared against every element. Doubling the input quadruples the work.',
    eg: 'A nested loop over the same array. Bubble sort. Comparing all pairs.' },
  { k: 'o2n',    name: 'O(2ⁿ)',       label: 'exponential', color: '#fb7185', f: n => Math.pow(2, n),
    means: 'Each extra element doubles the total work. Unusable past small n.',
    eg: 'Naive recursive Fibonacci. Enumerating every subset. Brute-force password search.' }
];
C.bigoCases = [
  { t: 'Look up a value in a hash table by its key.', a: 'o1',
    why: 'Hash the key, jump to the bucket. The table\'s size does not change the work — that is the whole reason hash tables exist. (Worst case is O(n) if every key collides, but that is rare enough to be a footnote.)' },
  { t: 'Find a name in a sorted phone book by repeatedly opening the middle.', a: 'ologn',
    why: 'Each open discards half the remaining pages. A million entries takes about 20 steps, and two million takes 21. That is what logarithmic means in practice.' },
  { t: 'Add up every number in a list.', a: 'on',
    why: 'You must touch each element exactly once. There is no cleverness available — you cannot sum numbers you have not read.' },
  { t: 'Sort a list of numbers with merge sort.', a: 'onlogn',
    why: 'log n levels of splitting, and each level does O(n) work merging. No comparison-based sort can do better in the general case.' },
  { t: 'For each person in a room, shake hands with every other person.', a: 'on2',
    why: 'n people × n-1 handshakes each. The nested loop is the giveaway: whenever you see a loop inside a loop over the same data, suspect quadratic.' },
  { t: 'List every possible subset of a set of items.', a: 'o2n',
    why: 'Each item is either in a subset or not — 2 choices, n times. Twenty items is a million subsets; thirty is a billion. This is why brute force stops being an option so suddenly.' }
];
C.bigoRules = [
  ['Big-O describes growth, not speed', 'An O(n²) algorithm can beat an O(n log n) one on small inputs — the constants and the cache behaviour matter. Big-O tells you what happens as n gets large, which is the question that decides architecture.'],
  ['Drop constants and lower terms', '3n² + 500n + 9000 is O(n²). Once n is big enough, the n² term is all that matters. This is not sloppiness — it is the point of the notation.'],
  ['Worst, average and best are different questions', 'Quicksort is O(n log n) average and O(n²) worst. Hash lookup is O(1) average and O(n) worst. Say which one you mean; interviewers and incidents both care.'],
  ['Space complexity is the other half', 'An algorithm that is fast because it built a copy of the input has O(n) extra space. On a large dataset that is often the binding constraint, not time.'],
  ['Amortised is not average', 'Amortised O(1) means: any single operation might be expensive, but over a long run the total cost divided by the count is constant. A dynamic array\'s push is the classic example.']
];

/* ---------- Ch2: arrays ---------- */
C.arrayDef = 'A fixed-size, contiguous block of memory holding elements of the same type. Because the elements sit next to each other and are all the same width, the address of element i is just base + i × size — one multiplication and one addition, no searching. That single fact is where every array property comes from.';
C.arrayOps = [
  { op: 'Read / write by index', cost: 'O(1)', good: true,
    why: 'Address arithmetic. The computer jumps straight there without looking at anything else.' },
  { op: 'Append at the end (room left)', cost: 'O(1)', good: true,
    why: 'Write one slot, bump the length. Nothing else moves.' },
  { op: 'Insert at the front', cost: 'O(n)', good: false,
    why: 'Every existing element must shift one slot to the right to make a hole. Contiguity is exactly what makes this expensive.' },
  { op: 'Insert in the middle', cost: 'O(n)', good: false,
    why: 'Everything after the insertion point shifts. On average that is half the array — which is still O(n).' },
  { op: 'Delete from the front', cost: 'O(n)', good: false,
    why: 'Everything shifts left to close the gap, for the same reason.' },
  { op: 'Search for a value (unsorted)', cost: 'O(n)', good: false,
    why: 'You have no idea where it is, so you look at each element until you find it. Being contiguous does not help you find things — only reach them.' },
  { op: 'Search for a value (sorted)', cost: 'O(log n)', good: true,
    why: 'Binary search. Sorting buys you this, which is why "sort it first" is such a common opening move.' }
];
C.arrayFacts = [
  ['Zero-indexing is address arithmetic, not a convention', 'The index is an offset from the start. Element 0 is at base + 0, so it is literally the first byte. Once you see it that way it stops feeling arbitrary.'],
  ['Cache locality is the hidden superpower', 'The CPU fetches memory in chunks. Walking an array pulls neighbours in for free, so a linear scan over an array is often faster in practice than a "smarter" structure with pointers scattered across memory.'],
  ['Dynamic arrays are arrays plus a resize rule', 'Python lists, Java ArrayList, C++ vector, JavaScript arrays. Fixed-size array underneath; when it fills, allocate a bigger one and copy. Doubling the capacity is what makes append amortised O(1).'],
  ['2D arrays are still one block', 'A grid is stored row after row in one flat run of memory. Iterating row-by-row is much faster than column-by-column, because row-by-row is the order the memory is actually in.'],
  ['The trade-off in one sentence', 'Arrays give you instant access by position and pay for it with expensive insertion in the middle. Every other linear structure is a different point on that same trade.']
];

/* ---------- Ch3: strings ---------- */
C.stringDef = 'A sequence of characters. In most languages a string is an array of characters with extra rules attached — and the most important rule is usually immutability: you cannot change a string in place, you can only build a new one.';
C.stringFacts = [
  ['Immutability is why naive concatenation is quadratic', 'Every `s = s + x` in a loop allocates a whole new string and copies the old one. Doing that n times copies 1 + 2 + 3 + … + n characters, which is O(n²). Use a builder or join a list instead — that is O(n).'],
  ['A character is not a byte', 'ASCII fits in one byte. UTF-8 uses one to four. "é" may be one code point or two (e + combining accent), and an emoji can be several. `length` counts whatever unit your language counts, which is rarely "what a human calls a character".'],
  ['Substring may or may not copy', 'Some languages slice by copying (O(k)); some share the underlying buffer (O(1) but keeps the whole original alive). Knowing which one you have explains a whole class of memory surprises.'],
  ['Comparison is O(n), not O(1)', 'Two strings are compared character by character until they differ. Equal-length near-identical strings are the worst case — relevant for hash keys and for timing-sensitive comparisons.'],
  ['Strings are the default hash key', 'Which means a hash of the string is computed on every lookup — O(length). Many languages cache it after the first computation, since strings are immutable and the hash cannot change.']
];
C.strOps = [
  { op: 'Access character at index', cost: 'O(1)', note: 'If the encoding is fixed-width. With UTF-8, indexing by character is O(n) — you have to walk it.' },
  { op: 'Length', cost: 'O(1)', note: 'Usually stored alongside. In C it is O(n) because the end is a marker, not a number.' },
  { op: 'Concatenate two strings', cost: 'O(a + b)', note: 'A new buffer is allocated and both are copied in.' },
  { op: 'Concatenate n times in a loop', cost: 'O(n²)', note: 'The trap. Each step copies everything built so far.' },
  { op: 'Compare for equality', cost: 'O(n)', note: 'Character by character. Fast in practice because it stops at the first difference.' },
  { op: 'Find a substring (naive)', cost: 'O(n × m)', note: 'Try every start position. Smarter algorithms (KMP, Boyer–Moore) reach O(n + m).' },
  { op: 'Reverse', cost: 'O(n)', note: 'Every character moves. Watch out for multi-byte characters — reversing bytes corrupts them.' }
];

/* ---------- Ch4: linked lists ---------- */
C.nodeDef = 'A node is the atom of every linked structure: a small box holding a value plus one or more references to other boxes. That is the entire idea. A linked list gives each node one "next" pointer, a binary tree gives it "left" and "right", a graph gives it a list of neighbours — same atom, different wiring.';
C.listDef = 'A chain of nodes, each holding a value and a reference to the next. The list itself is just a pointer to the first node (the head). There is no index arithmetic, because the nodes can live anywhere in memory — the only way to reach the fifth one is to walk through the first four.';
C.listKinds = [
  { n: 'Singly linked', ico: '→', desc: 'Each node points to the next. Cheapest and most common.',
    cost: 'One pointer per node.', catch: 'You can only walk forwards, and deleting a node needs a reference to the one before it.' },
  { n: 'Doubly linked', ico: '⇄', desc: 'Each node points both forwards and backwards.',
    cost: 'Two pointers per node.', catch: 'Lets you delete a node in O(1) given only that node, and walk in both directions. This is what LRU caches are built from.' },
  { n: 'Circular', ico: '↻', desc: 'The last node points back to the first.',
    cost: 'Same as its base kind.', catch: 'Handy for round-robin scheduling and ring buffers. Every traversal needs a stop condition, or it never ends.' }
];
C.listVsArray = [
  ['Access by index',        'O(1)', 'O(n)', 'array', 'The array does address arithmetic; the list has to walk.'],
  ['Insert / delete at head', 'O(n)', 'O(1)', 'list',  'The array shifts everything; the list re-points one reference.'],
  ['Insert / delete at a known node', 'O(n)', 'O(1)', 'list', 'Given the node, the list just re-wires neighbours. The array still shifts.'],
  ['Append at the end',      'O(1)*', 'O(1)†', 'tie',  '* amortised for a dynamic array. † only if the list keeps a tail pointer, otherwise O(n).'],
  ['Search for a value',     'O(n)', 'O(n)', 'tie',   'Both must look at elements one by one. Neither structure helps you find things.'],
  ['Memory per element',     'value', 'value + pointer(s)', 'array', 'The list pays for its flexibility in memory, on every single node.'],
  ['Cache friendliness',     'excellent', 'poor', 'array', 'Array elements are neighbours in memory; list nodes are scattered. This is why arrays often win in practice even where the Big-O says otherwise.']
];

/* ---------- Ch5: stacks and queues ---------- */
C.stackDef = 'A collection where the last thing you put in is the first thing you take out (LIFO). Only the top is reachable — that restriction is the feature, not a limitation. Push and pop are both O(1).';
C.queueDef = 'A collection where the first thing you put in is the first thing you take out (FIFO). You add at the back and remove from the front. Enqueue and dequeue are both O(1).';
C.sqCases = [
  { t: 'Undo history in a text editor.', a: 'stack',
    why: 'The most recent action is the first one you want to undo. That is LIFO, exactly.' },
  { t: 'Printer jobs waiting to be processed.', a: 'queue',
    why: 'Whoever asked first should print first. Anything else is a queue-jumping bug and users notice immediately.' },
  { t: 'Checking whether brackets in an expression are balanced.', a: 'stack',
    why: 'Each closing bracket must match the most recent unmatched opening one. Push on open, pop on close — if the popped bracket does not match, the expression is malformed.' },
  { t: 'Breadth-first traversal of a graph, level by level.', a: 'queue',
    why: 'You must finish everything at the current distance before going deeper, and a queue is exactly the structure that preserves that order.' },
  { t: 'Tracking which function called which, so you know where to return.', a: 'stack',
    why: 'That is the call stack, and it is why deep recursion causes a "stack overflow". Chapter 11 watches it happen.' },
  { t: 'Requests waiting for a worker in a web server.', a: 'queue',
    why: 'Fairness and bounded waiting. A stack here would starve the oldest request forever under load — an outage that looks like a mystery until you find the LIFO.' }
];
C.sqVariants = [
  ['Deque (double-ended queue)', 'Add and remove at both ends in O(1). A deque can act as a stack or a queue, so many languages ship only this.'],
  ['Priority queue', 'Removal returns the highest-priority item rather than the oldest. Usually built on a heap — Chapter 8.'],
  ['Circular buffer', 'A fixed-size queue in an array where the indices wrap around. Constant memory, and it overwrites the oldest entry when full. The shape of most logging and streaming buffers.'],
  ['Monotonic stack', 'A stack kept in sorted order by popping anything that breaks the order. Turns several "next greater element" problems from quadratic into linear.']
];

/* ---------- Ch6: hash tables ---------- */
C.hashDef = 'An array where the position of each item is computed from its key rather than chosen by you. A hash function turns the key into a number, that number modulo the array size gives a bucket, and the item lives there. Because you compute the location instead of searching for it, lookup is O(1) on average.';
C.hashKeys = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'kiwi'];
C.hashFacts = [
  ['Collisions are certain, not exceptional', 'Infinitely many keys map into finitely many buckets, so two keys will land together. A hash table is not defined by its hash function so much as by how it handles that.'],
  ['Chaining vs open addressing', 'Chaining hangs a small list off each bucket. Open addressing probes for the next free slot instead. Chaining is simpler and degrades gracefully; open addressing is faster when the table is not too full because it stays cache-friendly.'],
  ['Load factor drives resizing', 'Load factor = items ÷ buckets. Past roughly 0.7 collisions climb sharply, so the table allocates a bigger array and rehashes everything. That one insert is O(n) — but amortised over all the cheap ones it is still O(1).'],
  ['O(1) is average, not worst', 'If every key hashes to the same bucket, lookup degrades to O(n). This is a real denial-of-service vector, which is why serious implementations randomise their hash seed per process.'],
  ['Keys must be hashable and stable', 'If you mutate an object after using it as a key, its hash changes and the entry becomes unreachable — still in the table, findable by nothing. This is why immutable keys are the norm.'],
  ['No ordering, by design', 'A hash table has no natural order. If you need sorted keys or range queries, you want a tree — Chapter 7 — not a hash table.']
];

/* ---------- Ch7: trees ---------- */
C.treeDef = 'A hierarchy of nodes with exactly one root and no cycles: every node has one parent (except the root) and any number of children. The defining property is that there is exactly one path between any two nodes — which is what makes trees so much easier to reason about than graphs.';
C.treeTerms = [
  ['Root', 'The single node with no parent. Every traversal starts here.'],
  ['Leaf', 'A node with no children — the bottom of a branch.'],
  ['Depth of a node', 'How many edges from the root down to it. The root has depth 0.'],
  ['Height of the tree', 'The depth of the deepest leaf. This is what appears in the Big-O of tree operations.'],
  ['Subtree', 'Any node plus everything beneath it. Trees are recursive, which is why tree code is recursive.'],
  ['Binary tree', 'Every node has at most two children, called left and right.'],
  ['Binary search tree (BST)', 'A binary tree with an ordering rule: everything in the left subtree is smaller, everything in the right is larger. That rule is what makes searching O(height).'],
  ['Balanced tree', 'One whose height stays around log n. AVL and red-black trees rebalance on insert to guarantee it.']
];
C.bstInserts = [50, 30, 70, 20, 40, 60, 80];
C.degenerateInserts = [20, 30, 40, 50, 60, 70, 80];
C.traversals = [
  { k: 'inorder',   name: 'In-order',   order: 'left → node → right',
    use: 'Visits a BST in sorted order. If you need the values ascending, this is the traversal.' },
  { k: 'preorder',  name: 'Pre-order',  order: 'node → left → right',
    use: 'Visits a parent before its children. Used to copy a tree, or to serialise one so it can be rebuilt.' },
  { k: 'postorder', name: 'Post-order', order: 'left → right → node',
    use: 'Visits children before the parent. Used to delete or free a tree, and to evaluate expression trees bottom-up.' },
  { k: 'level',     name: 'Level-order', order: 'top to bottom, left to right',
    use: 'Breadth-first. Needs a queue rather than recursion, and answers "what is at each depth".' }
];
C.treeKinds = [
  ['Binary search tree', 'Ordered, O(height) search. Degenerates to a linked list if you insert sorted data — the demo shows it.'],
  ['AVL / red-black tree', 'Self-balancing BSTs. They do extra work on insert to guarantee O(log n) forever. This is what most language "sorted map" types are.'],
  ['B-tree / B+ tree', 'Wide, shallow trees where each node holds many keys. Built for disk and SSD, where reading one big node beats following many pointers. Every relational database index is one of these.'],
  ['Trie (prefix tree)', 'Keys are paths of characters rather than values in nodes. Gives you prefix search and autocomplete in O(length of the prefix).'],
  ['Heap', 'A tree with a much weaker ordering rule — parent beats child, siblings unordered. Chapter 8.']
];

/* ---------- Ch8: heaps ---------- */
C.heapDef = 'A binary tree with one rule: every parent compares favourably to its children (smaller, for a min-heap). Note what is NOT promised — siblings have no order, and the tree is not sorted. That weaker rule is exactly why a heap is cheap to maintain while still giving you the minimum instantly.';
C.heapInserts = [5, 3, 8, 1, 9, 2, 7];
C.heapFacts = [
  ['It lives in a flat array', 'A heap is always a complete tree, so it packs into an array with no gaps. Node i has children at 2i+1 and 2i+2, and its parent at (i−1)÷2. No pointers, perfect cache behaviour.'],
  ['Peek is O(1), removal is O(log n)', 'The minimum is always at index 0. Removing it means moving the last element to the top and sifting it down one level at a time — at most the height of the tree.'],
  ['Insert is O(log n)', 'Put the new value at the end, then sift it up while it beats its parent. Usually far fewer than log n swaps in practice.'],
  ['Building from n items is O(n), not O(n log n)', 'Heapifying bottom-up is linear, which is a genuinely surprising result — most nodes are near the bottom and barely sift at all.'],
  ['Sorted is not required, and that is the point', 'Keeping a full sort costs more. A heap gives you "the next best item" repeatedly, which is all a priority queue ever needs.'],
  ['Where you meet it', 'Priority queues, task schedulers, Dijkstra\'s shortest path, "top k" queries, and heap sort.']
];

/* ---------- Ch9: graphs ---------- */
C.graphDef = 'A set of nodes (vertices) connected by edges. That is it — no root, no hierarchy, and cycles are allowed. A tree is just a graph that happens to be connected and acyclic, which is why tree algorithms are usually simpler versions of graph ones.';
C.graphNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
C.graphEdges = [['A','B'], ['A','C'], ['B','D'], ['C','D'], ['C','E'], ['D','F'], ['E','F']];
C.graphPos = { A: [50,12], B: [18,35], C: [82,35], D: [40,62], E: [86,64], F: [58,88] };
C.graphTerms = [
  ['Vertex / node', 'A thing. A person, a city, a web page, a task.'],
  ['Edge', 'A connection between two vertices. A friendship, a road, a link, a dependency.'],
  ['Directed vs undirected', 'A one-way street vs a two-way one. "Follows" is directed; "is friends with" is usually not.'],
  ['Weighted', 'Edges carry a number — distance, cost, capacity. Shortest-path problems live here.'],
  ['Degree', 'How many edges touch a vertex. In a directed graph, in-degree and out-degree differ.'],
  ['Path', 'A sequence of vertices connected by edges.'],
  ['Cycle', 'A path that returns to where it started. A graph with none is acyclic — and a directed acyclic graph (DAG) is what dependency and build systems are.'],
  ['Connected component', 'A group of vertices all reachable from each other. A graph can have several islands.']
];
C.graphReps = [
  { k: 'list', name: 'Adjacency list', ico: '📋',
    space: 'O(V + E)',
    neighbours: 'O(degree)',
    hasEdge: 'O(degree)',
    good: 'The default. Most real graphs are sparse — a social network has millions of users and each knows a few hundred, not millions.',
    bad: 'Checking whether one specific edge exists means scanning that vertex\'s neighbour list.' },
  { k: 'matrix', name: 'Adjacency matrix', ico: '⬛',
    space: 'O(V²)',
    neighbours: 'O(V)',
    hasEdge: 'O(1)',
    good: 'Instant edge lookup, and easy to reason about mathematically. Fine for small or genuinely dense graphs.',
    bad: 'A million vertices needs a trillion cells, nearly all of them zero. Unusable at scale.' }
];
C.graphAlgos = [
  ['BFS — breadth-first search', 'Explores level by level using a queue. Finds the shortest path in an unweighted graph, because it reaches everything at distance k before anything at k+1.'],
  ['DFS — depth-first search', 'Goes as deep as possible before backtracking, using a stack (or recursion). Natural for cycle detection, topological sort and exploring every path.'],
  ['Dijkstra', 'Shortest path with non-negative edge weights. BFS with a priority queue instead of a plain queue.'],
  ['Topological sort', 'Orders a DAG so every edge points forwards. This is what build systems, task schedulers and course prerequisites run.'],
  ['Union-Find', 'Tracks connected components incredibly cheaply. The engine behind Kruskal\'s minimum spanning tree.'],
  ['Cycle detection', 'DFS with a "currently on the stack" marker. Finds circular dependencies and deadlock risks.']
];

/* ---------- Ch10: sorting and searching ---------- */
C.sortAlgos = [
  { k: 'bubble',    name: 'Bubble sort',    best: 'O(n)',       avg: 'O(n²)',       worst: 'O(n²)',      space: 'O(1)',     stable: true,
    idea: 'Repeatedly swap adjacent out-of-order pairs. The largest value "bubbles" to the end each pass.',
    use: 'Teaching only. It is here because it is easy to see, not because you should ever ship it.' },
  { k: 'selection', name: 'Selection sort', best: 'O(n²)',      avg: 'O(n²)',       worst: 'O(n²)',      space: 'O(1)',     stable: false,
    idea: 'Find the smallest remaining element and swap it into place. Repeat.',
    use: 'When writes are far more expensive than reads — it does at most n swaps, which is the fewest of any simple sort.' },
  { k: 'insertion', name: 'Insertion sort', best: 'O(n)',       avg: 'O(n²)',       worst: 'O(n²)',      space: 'O(1)',     stable: true,
    idea: 'Take each element and slide it back into its place among the already-sorted prefix. How people sort a hand of cards.',
    use: 'Genuinely the best choice for small or nearly-sorted arrays — which is why real sort implementations switch to it for small chunks.' },
  { k: 'merge',     name: 'Merge sort',     best: 'O(n log n)', avg: 'O(n log n)',  worst: 'O(n log n)', space: 'O(n)',     stable: true,
    idea: 'Split in half, sort each half recursively, then merge the two sorted halves in one pass.',
    use: 'When you need a guaranteed bound and stability, or when sorting data too big for memory. Divide and conquer in its purest form.' },
  { k: 'quick',     name: 'Quicksort',      best: 'O(n log n)', avg: 'O(n log n)',  worst: 'O(n²)',      space: 'O(log n)', stable: false,
    idea: 'Pick a pivot, partition into smaller and larger, recurse on both sides.',
    use: 'The usual default in practice — excellent constants and sorts in place. The O(n²) worst case is why real ones randomise or median-of-three the pivot.' },
  { k: 'heap',      name: 'Heap sort',      best: 'O(n log n)', avg: 'O(n log n)',  worst: 'O(n log n)', space: 'O(1)',     stable: false,
    idea: 'Build a heap from the array, then repeatedly extract the minimum.',
    use: 'Guaranteed O(n log n) with no extra memory. Loses to quicksort on constants, wins on worst-case guarantees.' }
];
C.sortFacts = [
  ['O(n log n) is the floor for comparison sorts', 'If your only tool is comparing pairs, you cannot beat n log n in the general case — it is a proven lower bound, not a gap waiting to be closed.'],
  ['Counting and radix sort beat it by cheating', 'They do not compare elements; they use the values themselves as indices. O(n + k) for integers in a bounded range. Not magic — just a different set of assumptions.'],
  ['Stability means equal elements keep their order', 'Sort by name, then by department: with a stable sort the names stay alphabetical within each department. With an unstable one they scatter. It matters more often than people expect.'],
  ['In-place means O(1) extra space', 'Merge sort needs a second array; quicksort and heap sort do not. On large data that difference decides whether it fits in memory.'],
  ['Real sorts are hybrids', 'Timsort (Python, Java objects) and pdqsort (Rust, C++) switch strategies by size and by how sorted the data already is. Almost nobody ships a textbook algorithm unmodified.']
];
C.searchArray = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
C.searchFacts = [
  ['Binary search requires sorted data', 'Not "usually works better on" — it is wrong on unsorted data, silently. The precondition is the whole algorithm.'],
  ['Sorting to search once is not worth it', 'Sorting is O(n log n); one linear scan is O(n). Sort when you will search many times — the cost amortises over the searches.'],
  ['log₂ n is smaller than people expect', 'A thousand items: 10 steps. A million: 20. A billion: 30. This is why balanced trees and binary search show up everywhere.'],
  ['Off-by-one is the classic bug', 'Whether `high` is inclusive, and whether the midpoint rounds down, decide whether the loop terminates. Binary search is famously easy to describe and hard to write correctly.'],
  ['A hash table beats both for exact lookup', 'O(1) average, no sorting needed. Binary search wins when you also need range queries, nearest-neighbour, or ordered iteration — which a hash table cannot do at all.']
];

/* ---------- Ch11: recursion ---------- */
C.recursionDef = 'A function that solves a problem by calling itself on a smaller version of the same problem. It needs exactly two things: a base case that stops without recursing, and a recursive step that makes genuine progress toward that base case. Miss either one and it never terminates.';
C.recursionParts = [
  ['Base case', 'The smallest input, answered directly with no further calls. Without one the recursion never stops. Write it first.'],
  ['Recursive step', 'Solve a strictly smaller version and build the answer from it. "Strictly smaller" is the part people get wrong — n−1 works, n÷2 works, n does not.'],
  ['The call stack', 'Each call gets a frame holding its arguments and local variables. Frames pile up until the base case is hit, then unwind. That pile is finite memory.'],
  ['Stack overflow', 'Too many frames and the stack runs out. Typical limits are a few thousand to a few tens of thousands of frames — much less than most people assume.'],
  ['Tail recursion', 'When the recursive call is the very last thing the function does, some languages reuse the frame instead of stacking a new one. Python and JavaScript notably do not.']
];
C.recursionExamples = [
  { k: 'fact', name: 'factorial(4)', calls: 'linear',
    note: 'One call per level, four levels deep. The stack depth is n, and each frame does a single multiplication on the way back up.' },
  { k: 'fib', name: 'fib(5) — naive', calls: 'exponential',
    note: 'Each call spawns two more. The stack is only n deep, but the number of calls is exponential — the same subproblems are solved again and again. Chapter 12 is entirely about fixing this.' }
];
C.recursionVsIteration = [
  ['Recursion is clearer for recursive data', 'Trees and nested structures are defined recursively, so recursive code mirrors the shape of the data. Iterative tree traversal means managing your own explicit stack.'],
  ['Iteration is cheaper', 'No frames, no call overhead, no depth limit. When the loop version is equally readable, prefer it.'],
  ['Any recursion can be made iterative', 'By keeping the stack yourself. Sometimes that is uglier; sometimes it is the only way to handle deep input without overflowing.'],
  ['Depth is the constraint, not the call count', 'Naive Fibonacci makes an exponential number of calls but is only n frames deep. Recursing down a million-node linked list makes n calls and blows the stack. Different failure, different fix.']
];

/* ---------- Ch12: dynamic programming ---------- */
C.dpDef = 'A technique for problems where the same subproblem is solved many times. You solve each subproblem once and store the answer. That is genuinely all it is — the intimidating name describes a habit, not a category of algorithm.';
C.dpConditions = [
  ['Overlapping subproblems', 'The naive recursion computes the same thing repeatedly. If every subproblem is distinct, storing them buys you nothing and this is plain divide-and-conquer.'],
  ['Optimal substructure', 'The best answer to the whole is built from the best answers to its parts. Shortest paths have it; "longest simple path" famously does not, which is why it is hard.'],
  ['If both hold, DP applies', 'And the speed-up is usually dramatic: exponential to polynomial. If only one holds, you have a different kind of problem.']
];
C.dpStyles = [
  { k: 'memo', name: 'Memoisation (top-down)', ico: '🗂️',
    how: 'Write the natural recursion, then add a cache. Before computing, check the cache; after computing, store it.',
    good: 'Keeps the recursive shape, which is usually the readable one. Only computes the subproblems you actually need.',
    bad: 'Still uses the call stack, so deep problems can overflow. Cache lookups add a constant overhead.' },
  { k: 'tab', name: 'Tabulation (bottom-up)', ico: '📊',
    how: 'Fill a table starting from the base cases, in an order where every value you need is already computed.',
    good: 'No recursion and no stack limit, and often less memory — many tabulations only need the last row or two.',
    bad: 'You must work out the fill order yourself, and it computes every cell whether or not you needed it.' }
];
C.fibN = 6;
C.dpFacts = [
  ['The name is historical, not descriptive', 'Richard Bellman chose "dynamic programming" in the 1950s partly because it sounded impressive to a research funder. It means "solve subproblems once and remember them".'],
  ['State is the whole design', 'Almost all the difficulty is deciding what a subproblem is — what the parameters of your cache key are. Once the state is right, the recurrence usually writes itself.'],
  ['Draw the recursion tree first', 'If you see the same node twice, DP applies. If you do not, it does not. That is the entire test, and it takes thirty seconds on paper.'],
  ['Space can usually be reduced', 'If row i only depends on row i−1, keep two rows instead of the whole table. Grid DP problems routinely drop from O(n×m) to O(m) space this way.'],
  ['Where you meet it', 'Edit distance (spell check, diff), sequence alignment in bioinformatics, knapsack and resource allocation, text justification, and shortest paths with Bellman–Ford.']
];

/* ---------- Ch13: paradigms ---------- */
C.paradigms = [
  { k: 'brute', name: 'Brute force', ico: '🔨',
    idea: 'Try every possibility and keep the best.',
    when: 'Small inputs, or as the correct-by-construction baseline you check a clever solution against.',
    cost: 'Usually exponential or factorial. Fine at n=10, hopeless at n=50.' },
  { k: 'dc', name: 'Divide and conquer', ico: '✂️',
    idea: 'Split into independent subproblems, solve each, combine the results.',
    when: 'The parts genuinely do not overlap. Merge sort, quicksort, binary search, FFT.',
    cost: 'Often O(n log n) — log n levels of splitting with linear work per level.' },
  { k: 'greedy', name: 'Greedy', ico: '🍽️',
    idea: 'Take the best-looking option right now and never reconsider.',
    when: 'Only when a local optimum provably leads to a global one. Fast and often wrong — you must prove it, not hope.',
    cost: 'Usually O(n log n), dominated by the sort that orders the choices.' },
  { k: 'dp', name: 'Dynamic programming', ico: '🗃️',
    idea: 'Solve overlapping subproblems once and reuse the answers.',
    when: 'Overlapping subproblems plus optimal substructure. Exactly Chapter 12.',
    cost: 'Polynomial — usually the number of states times the work per state.' },
  { k: 'back', name: 'Backtracking', ico: '↩️',
    idea: 'Build a candidate step by step and abandon a branch the moment it cannot work.',
    when: 'Constraint problems with a big search space — sudoku, N-queens, puzzle solving.',
    cost: 'Exponential worst case, but pruning makes it practical far beyond brute force.' }
];
C.paradigmCases = [
  { t: 'Sort a large list of numbers.', a: 'dc',
    why: 'Split, sort each half independently, merge. The halves do not share subproblems, so there is nothing to cache — this is divide and conquer, not DP.' },
  { t: 'Make change for £0.87 using the fewest coins, with arbitrary coin denominations.', a: 'dp',
    why: 'The subproblem "fewest coins for amount k" recurs constantly across branches. Greedy — always take the largest coin — is right for normal currency and wrong for denominations like {1, 3, 4}, where greedy gives 6=4+1+1 but the answer is 3+3.' },
  { t: 'Place 8 queens on a chessboard so none attack each other.', a: 'back',
    why: 'Place one queen at a time and abandon a placement the instant it is attacked. Pruning cuts an astronomical search space to something a laptop finishes instantly.' },
  { t: 'Schedule the most non-overlapping meetings in one room.', a: 'greedy',
    why: 'Always take the meeting that ends earliest. This is provably optimal — and the proof is the reason you are allowed to be greedy here. Without the proof it is just a guess that sometimes works.' },
  { t: 'Find the best move in a game with 12 possible positions.', a: 'brute',
    why: 'Twelve possibilities. Enumerate them, pick the best, move on. Reaching for something clever here costs you a day and buys you nothing.' },
  { t: 'Find the minimum number of single-character edits to turn one word into another.', a: 'dp',
    why: 'Edit distance. The subproblem "best edit for prefixes of length i and j" is reached from three directions, so it recurs constantly. This is the canonical DP table, and it is what spell checkers and diff tools run.' }
];

/* ---------- Ch14: choosing ---------- */
C.chooserCases = [
  { t: 'You need to check "have I seen this ID before?" millions of times.', a: 'hash',
    why: 'Exact-match membership with no ordering needed — a hash set is O(1) average and nothing else comes close. A sorted array would be O(log n); a list would be O(n).' },
  { t: 'You need the smallest remaining task, repeatedly, as new tasks keep arriving.', a: 'heap',
    why: 'A priority queue. O(log n) to insert and to extract the minimum. Keeping a fully sorted list would cost more and you never need the full order.' },
  { t: 'You need to iterate items in sorted order and also do range queries ("everything between 10 and 50").', a: 'tree',
    why: 'A balanced BST or a B-tree. A hash table cannot do this at all — it has no ordering to iterate. This is exactly why databases index with B-trees.' },
  { t: 'A fixed-size collection you scan front to back constantly, with no insertions in the middle.', a: 'array',
    why: 'Contiguous memory, O(1) indexing and excellent cache behaviour. Do not reach for a fancy structure to solve a problem you do not have.' },
  { t: 'You constantly add and remove from both ends and never index into the middle.', a: 'list',
    why: 'A deque, usually implemented as a doubly linked list or a chunked array. O(1) at both ends, and indexing — which you do not need — is the only thing you give up.' },
  { t: 'You need to answer "is B reachable from A?" over a network of connections.', a: 'graph',
    why: 'Arbitrary connections with possible cycles is the definition of a graph. BFS or DFS answers reachability; neither a tree nor a list can represent the cycles.' },
  { t: 'Autocomplete: every word starting with "prog".', a: 'trie',
    why: 'A trie walks the prefix once and everything beneath that node is an answer. A hash table cannot do prefix queries; a sorted array can via binary search but a trie is cleaner and shares storage across common prefixes.' },
  { t: 'Undo/redo in an editor.', a: 'stack',
    why: 'Two stacks, in fact — one for undo, one for redo. LIFO is exactly the semantics users expect, and anything else feels broken.' }
];
C.chooserOptions = {
  array: { name: 'Array', ico: '▦' },
  list:  { name: 'Linked list / deque', ico: '⇄' },
  stack: { name: 'Stack', ico: '⬓' },
  hash:  { name: 'Hash table', ico: '#️⃣' },
  tree:  { name: 'Balanced tree', ico: '🌳' },
  heap:  { name: 'Heap', ico: '⛰️' },
  graph: { name: 'Graph', ico: '🕸️' },
  trie:  { name: 'Trie', ico: '🔤' }
};
C.cheatsheet = [
  ['Array',        'O(1)',    'O(n)',      'O(n)',      'O(n)',      'Indexing, iteration, cache locality'],
  ['Dynamic array', 'O(1)',   'O(n)',      'O(1)*',     'O(n)',      'The default list type in every language'],
  ['Linked list',  'O(n)',    'O(n)',      'O(1)',      'O(1)†',     'Cheap ends, no indexing'],
  ['Stack',        '—',       '—',         'O(1)',      'O(1)',      'LIFO only, by design'],
  ['Queue',        '—',       '—',         'O(1)',      'O(1)',      'FIFO only, by design'],
  ['Hash table',   '—',       'O(1)',      'O(1)',      'O(1)',      'Exact lookup, no ordering'],
  ['Balanced tree', 'O(log n)', 'O(log n)', 'O(log n)', 'O(log n)',  'Ordered, range queries'],
  ['Heap',         '—',       'O(n)',      'O(log n)',  'O(log n)',  'Min/max instantly, rest unordered'],
  ['Trie',         '—',       'O(k)',      'O(k)',      'O(k)',      'Prefix queries, k = key length']
];

/* ---------- Ch15: quiz ---------- */
C.quiz = [
  { q: 'What does O(n) actually describe?', o: ['How many seconds the code takes', 'How the work grows as the input grows', 'How much memory it uses', 'How many lines of code it is'], a: 1,
    e: 'Big-O is about growth, not speed. An O(n²) algorithm can beat an O(n log n) one on small inputs — the notation tells you what happens as n gets large.' },
  { q: 'Why is reading array[5000] as fast as reading array[2]?', o: ['The array is cached', 'The address is computed with arithmetic: base + index × element size', 'Arrays are sorted', 'It is not — larger indices are slower'], a: 1,
    e: 'Contiguous memory plus fixed-width elements means the location is calculated, not searched for. That one fact is where every array property comes from.' },
  { q: 'Building a string by `s = s + x` inside a loop of n iterations costs…', o: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], a: 1,
    e: 'Strings are immutable, so each concatenation copies everything built so far. 1+2+3+…+n is O(n²). Use a builder or join a list instead.' },
  { q: 'What does a linked list give you that an array does not?', o: ['Faster indexing', 'O(1) insert and delete at a known position', 'Less memory per element', 'Better cache behaviour'], a: 1,
    e: 'Re-pointing two references beats shifting every following element. It pays for that with a pointer per node, no index arithmetic, and poor cache locality.' },
  { q: 'Which structure fits "undo the most recent action"?', o: ['Queue', 'Stack', 'Heap', 'Hash table'], a: 1,
    e: 'LIFO: the last action in is the first one undone. A queue would undo your oldest action first, which no user has ever wanted.' },
  { q: 'A hash table gives O(1) lookup. Under what condition is it O(n)?', o: ['Never', 'When many keys collide into the same bucket', 'When the table is empty', 'When keys are strings'], a: 1,
    e: 'O(1) is the average case. All keys hashing to one bucket degrades it to a linear scan — a real denial-of-service vector, which is why implementations randomise their hash seed.' },
  { q: 'You insert 1, 2, 3, 4, 5, 6, 7 into an empty binary search tree in that order. What do you get?', o: ['A balanced tree of height 3', 'A degenerate tree — effectively a linked list of height 7', 'A heap', 'An error'], a: 1,
    e: 'Every value is larger than the last, so each becomes the right child of the previous. Search degrades to O(n). This is exactly why self-balancing trees (AVL, red-black) exist.' },
  { q: 'Which traversal visits a BST in sorted order?', o: ['Pre-order', 'In-order', 'Post-order', 'Level-order'], a: 1,
    e: 'In-order is left → node → right. Combined with the BST rule (left is smaller, right is larger), that produces ascending order by construction.' },
  { q: 'A heap does NOT promise…', o: ['That the root is the minimum', 'That siblings are in order relative to each other', 'That it is a complete tree', 'That insert is O(log n)'], a: 1,
    e: 'The only rule is parent-beats-child. Siblings are unordered and the heap as a whole is not sorted — that weaker promise is exactly why it stays cheap to maintain.' },
  { q: 'You need the shortest path in an unweighted graph. Which traversal?', o: ['DFS', 'BFS', 'In-order', 'Either works equally'], a: 1,
    e: 'BFS reaches everything at distance k before anything at k+1, so the first time it finds the target, it has found it by a shortest path. DFS offers no such guarantee.' },
  { q: 'What makes a sorting algorithm "stable"?', o: ['It never crashes', 'Equal elements keep their original relative order', 'It always runs in O(n log n)', 'It sorts in place'], a: 1,
    e: 'Sort by name then by department: a stable sort keeps names alphabetical within each department. An unstable one scatters them.' },
  { q: 'What are the two conditions that make dynamic programming apply?', o: ['Recursion and a base case', 'Overlapping subproblems and optimal substructure', 'Sorted input and a loop', 'A tree and a queue'], a: 1,
    e: 'Overlapping subproblems means caching helps. Optimal substructure means the best whole is built from best parts. Missing either, DP is the wrong tool — draw the recursion tree and look for a repeated node.' }
];

/* ---------- glossary ---------- */
C.glossary = [
  ['Algorithm', 'A finite, unambiguous sequence of steps that solves a problem.'],
  ['Data structure', 'A way of organising data so that particular operations are cheap. Every structure is a set of trade-offs, never a winner.'],
  ['Big-O', 'An upper bound on how work grows with input size, with constants and lower-order terms dropped.'],
  ['Big-Θ / Big-Ω', 'Tight bound and lower bound. Most people say "Big-O" when they mean Θ; in practice nobody minds.'],
  ['Amortised', 'The average cost per operation over a long sequence, where occasional expensive operations are paid for by many cheap ones.'],
  ['Space complexity', 'How extra memory grows with input size. Ignores the input itself.'],
  ['In-place', 'Uses O(1) extra memory beyond the input.'],
  ['Array', 'Contiguous, fixed-size, same-typed elements. O(1) access by index.'],
  ['Dynamic array', 'An array that reallocates to a larger block when full. Amortised O(1) append.'],
  ['String', 'A sequence of characters, usually immutable, usually an array underneath.'],
  ['Immutable', 'Cannot be changed after creation. Any "modification" produces a new object.'],
  ['Node', 'A box holding a value plus references to other boxes. The atom of lists, trees and graphs.'],
  ['Pointer / reference', 'A value that says where another value lives.'],
  ['Linked list', 'Nodes chained by next pointers. O(1) at the ends, O(n) to index.'],
  ['Head / tail', 'The first and last node of a list.'],
  ['Stack', 'LIFO. Push and pop at one end only.'],
  ['Queue', 'FIFO. Add at the back, remove from the front.'],
  ['Deque', 'Add and remove at both ends in O(1).'],
  ['Priority queue', 'Removal returns the highest-priority item rather than the oldest. Usually a heap.'],
  ['Hash function', 'Maps a key to a number. Good ones spread keys evenly and are cheap to compute.'],
  ['Hash table', 'An array indexed by hashed keys. O(1) average lookup, no ordering.'],
  ['Collision', 'Two keys landing in the same bucket. Inevitable, and how you handle it defines the table.'],
  ['Load factor', 'Items ÷ buckets. Past ~0.7 the table usually resizes.'],
  ['Tree', 'A connected acyclic hierarchy with one root and exactly one path between any two nodes.'],
  ['Root / leaf', 'The node with no parent; a node with no children.'],
  ['Height / depth', 'Depth of the deepest leaf; edges from the root down to a node.'],
  ['Binary search tree', 'A binary tree where left < node < right. Search is O(height).'],
  ['Balanced tree', 'A tree kept at height ~log n. AVL and red-black trees rebalance on insert.'],
  ['B-tree', 'A wide, shallow tree built for disk. What every database index actually is.'],
  ['Trie', 'A tree keyed by the characters of a key. Prefix search in O(key length).'],
  ['Traversal', 'Visiting every node in some order: in-, pre-, post- or level-order.'],
  ['Heap', 'A complete tree where each parent beats its children. Siblings are unordered.'],
  ['Heapify', 'Building a heap from an unordered array — O(n), which surprises most people.'],
  ['Graph', 'Vertices connected by edges. Cycles allowed, no root, no hierarchy.'],
  ['Vertex / edge', 'A node; a connection between two nodes.'],
  ['Directed / undirected', 'Edges with a direction, or without.'],
  ['Weighted graph', 'Edges carry a number — distance, cost, capacity.'],
  ['DAG', 'Directed acyclic graph. What dependency and build systems are.'],
  ['Adjacency list', 'Each vertex stores its neighbours. O(V + E) space — the default for sparse graphs.'],
  ['Adjacency matrix', 'A V×V grid of booleans. O(1) edge lookup, O(V²) space.'],
  ['BFS', 'Breadth-first search. Level by level with a queue. Shortest path when unweighted.'],
  ['DFS', 'Depth-first search. As deep as possible, then backtrack. Uses a stack or recursion.'],
  ['Topological sort', 'An ordering of a DAG where every edge points forwards.'],
  ['Stable sort', 'Equal elements keep their original relative order.'],
  ['Comparison sort', 'A sort whose only tool is comparing pairs. Provably cannot beat O(n log n).'],
  ['Binary search', 'Halve a sorted range each step. O(log n), and silently wrong on unsorted data.'],
  ['Recursion', 'A function calling itself on a smaller input, with a base case that stops it.'],
  ['Base case', 'The input answered directly, with no further recursive call.'],
  ['Call stack', 'The pile of frames for in-progress function calls. Finite — hence stack overflow.'],
  ['Tail recursion', 'When the recursive call is the last action, allowing frame reuse in some languages.'],
  ['Memoisation', 'Caching a function\'s results by its arguments. Top-down dynamic programming.'],
  ['Tabulation', 'Filling a table from the base cases upward. Bottom-up dynamic programming.'],
  ['Overlapping subproblems', 'The same subproblem being solved repeatedly. The signal that DP applies.'],
  ['Optimal substructure', 'The best overall answer is built from the best answers to its parts.'],
  ['Greedy', 'Taking the locally best option and never reconsidering. Fast, and correct only when proved.'],
  ['Divide and conquer', 'Split into independent subproblems, solve, combine.'],
  ['Backtracking', 'Building candidates incrementally and abandoning a branch as soon as it cannot work.'],
  ['Invariant', 'Something that stays true throughout a loop or structure. The usual way to reason about correctness.']
];
