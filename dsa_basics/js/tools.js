/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: choosing a structure ---------- */
C.toolstrips.choosing = {
  title: 'Tools & frameworks — what you actually reach for',
  sub: 'In an interview you implement these. In a job you import them. Knowing the standard-library name and its complexity is the practical half of this course.',
  tools: [
    { n: 'collections.deque', by: 'Python standard library', mark: '⇔', c: '#3776ab',
      what: 'A doubly linked list of blocks: O(1) append and pop at both ends.',
      pro: ['The correct queue — list.pop(0) is O(n) and quietly ruins your complexity', 'Also the right stack, and a bounded ring buffer with maxlen', 'Thread-safe appends and pops'],
      con: ['Indexing in the middle is O(n)', 'Slightly more memory per element than a list'],
      use: 'Any queue, any sliding window, any BFS. Reaching for a list here is the classic mistake.' },
    { n: 'heapq', by: 'Python standard library', mark: '⛰', c: '#7c5cff',
      what: 'A binary min-heap over an ordinary list: O(log n) push and pop, O(1) peek at the smallest.',
      pro: ['Top-k in O(n log k) instead of sorting everything', 'nlargest and nsmallest are one-liners', 'Underpins Dijkstra and every scheduler'],
      con: ['Min-heap only — negate values for a max-heap', 'No decrease-key, so Dijkstra pushes duplicates'],
      use: 'Top-k, priority queues, merging sorted streams, shortest paths.' },
    { n: 'collections.Counter / defaultdict', by: 'Python standard library', mark: '#', c: '#3776ab',
      what: 'A hash map specialised for counting, and one that creates the default value on first access.',
      pro: ['most_common(k) removes a whole sorting step', 'defaultdict(list) removes the setdefault boilerplate', 'Counter supports arithmetic between counters'],
      con: ['defaultdict inserts on read, which surprises people during iteration', 'Counter is not a multiset with ordering'],
      use: 'Frequency problems, grouping, and adjacency lists for graphs.' },
    { n: 'bisect', by: 'Python standard library', mark: '⋔', c: '#22d3ee',
      what: 'Binary search over a sorted sequence, with insertion points as well as lookup.',
      pro: ['O(log n) search without writing the off-by-one yourself', 'bisect_left and bisect_right handle duplicates correctly', 'Turns a sorted list into a searchable index for free'],
      con: ['Insertion into a list is still O(n)', 'The sequence must already be sorted and stay sorted'],
      use: 'Range queries, longest-increasing-subsequence, and any "first element ≥ x" question.' },
    { n: 'functools.lru_cache', by: 'Python standard library', mark: '💾', c: '#34d399',
      what: 'Memoisation as a decorator. Turns exponential recursion into linear with one line.',
      pro: ['Top-down dynamic programming becomes a decorator on the naive recursion', 'maxsize=None for unbounded, or a real LRU with a bound', 'cache_info() shows the hit rate'],
      con: ['Arguments must be hashable', 'Holds references, so an unbounded cache is a memory leak'],
      use: 'Every dynamic-programming problem, before you write a table by hand.' },
    { n: 'NetworkX', by: 'NetworkX', mark: '🕸', c: '#f472b6',
      what: 'Graphs as objects, with essentially every classical algorithm already implemented.',
      pro: ['Shortest paths, components, centrality and matching out of the box', 'Excellent for prototyping and for checking your own implementation', 'Reads and writes the common graph formats'],
      con: ['Pure Python, so slow on very large graphs', 'Never allowed in a coding interview'],
      use: 'Real work on graphs, and verifying that your hand-written algorithm agrees with it.' }
  ]
};

/* ---------- Ch: complexity ---------- */
C.toolstrips.complexity = {
  title: 'Tools & frameworks — measuring instead of guessing',
  sub: 'Big-O tells you how it scales. These tell you what it actually costs on your machine, and the two disagree more often than people expect.',
  tools: [
    { n: 'timeit', by: 'Python standard library', mark: '⏱', c: '#3776ab',
      what: 'Times a small snippet properly: many repetitions, best-of, garbage collection disabled.',
      pro: ['Avoids the classic one-shot timing mistake', 'Works from the command line and inside a notebook', 'No dependency'],
      con: ['Only suits small isolated snippets', 'Says nothing about where time went in a large program'],
      use: 'Settling "is this really faster" between two implementations.' },
    { n: 'cProfile + snakeviz', by: 'stdlib / community', mark: '📊', c: '#7c5cff',
      what: 'Function-level profiling of a whole program, with a flame chart to read the result.',
      pro: ['Finds the actual hot function, which is rarely the suspected one', 'Whole-program view including library calls', 'snakeviz makes the output readable'],
      con: ['Per-call overhead distorts very short functions', 'Function granularity, not line granularity'],
      use: 'Before optimising anything. Guessing at the bottleneck wastes days.' },
    { n: 'sys.getsizeof / tracemalloc', by: 'Python standard library', mark: '📦', c: '#22d3ee',
      what: 'How much memory an object holds, and where allocations came from.',
      pro: ['Makes the real cost of a list of small objects visible', 'tracemalloc attributes memory growth to a source line', 'Built in, no extra dependency'],
      con: ['getsizeof is shallow — it excludes referenced objects', 'tracemalloc slows the program noticeably'],
      use: 'When the structure fits in theory and not in RAM.' },
    { n: 'Big-O by inspection', by: 'you', mark: 'O()', c: '#fbbf24',
      what: 'Count the nested loops and the work per element, before writing any code at all.',
      pro: ['Free, instant, and catches the disaster before it exists', 'The only tool available in an interview', 'Scales reasoning to inputs you cannot test on'],
      con: ['Hides constants that dominate at small n', 'Says nothing about cache behaviour, which can be a 10x factor'],
      use: 'Always first. Then measure, because the constants are real.' }
  ]
};
