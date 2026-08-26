/* ============================================================
   content.js — all the course data in one place.
   Edit here to change the course; demos.js only renders it.
   ============================================================ */
window.C = {};

/* ---------- Ch1: the type explorer ---------- */
C.typeCards = [
  { lit: '42',            type: 'int',   mut: false, truthy: true,  size: 'arbitrary precision',
    note: 'Python ints never overflow. <span class="mono">2**1000</span> is a normal number here.' },
  { lit: '3.14',          type: 'float', mut: false, truthy: true,  size: '64-bit IEEE-754',
    note: 'Binary floats. <span class="mono">0.1 + 0.2 == 0.3</span> is <b>False</b> — use <span class="mono">decimal</span> for money.' },
  { lit: '"hi"',          type: 'str',   mut: false, truthy: true,  size: 'sequence of characters',
    note: 'Immutable. Every "modification" builds a new string; that is why <span class="mono">+=</span> in a loop is slow.' },
  { lit: '""',            type: 'str',   mut: false, truthy: false, size: 'empty',
    note: 'Empty containers are falsy. That is why <span class="mono">if items:</span> reads better than <span class="mono">if len(items) &gt; 0:</span>.' },
  { lit: 'True',          type: 'bool',  mut: false, truthy: true,  size: 'subclass of int',
    note: '<span class="mono">True == 1</span> is genuinely True, and <span class="mono">sum([True, True])</span> is 2.' },
  { lit: 'None',          type: 'NoneType', mut: false, truthy: false, size: 'singleton',
    note: 'There is exactly one None object, which is why you compare with <span class="mono">is None</span>, not <span class="mono">== None</span>.' },
  { lit: '[1, 2, 3]',     type: 'list',  mut: true,  truthy: true,  size: 'ordered, growable',
    note: 'Mutable — the default sequence. Append is cheap, insert at the front is not.' },
  { lit: '(1, 2)',        type: 'tuple', mut: false, truthy: true,  size: 'ordered, fixed',
    note: 'Immutable, so it can be a dict key. Use it for a fixed record: <span class="mono">(x, y)</span>.' },
  { lit: "{'a': 1}",      type: 'dict',  mut: true,  truthy: true,  size: 'hash map, insertion ordered',
    note: 'O(1) lookup by key. Ordered by insertion since 3.7 — a language guarantee now, not an accident.' },
  { lit: '{1, 2, 3}',     type: 'set',   mut: true,  truthy: true,  size: 'unordered, unique',
    note: 'O(1) membership. <span class="mono">x in big_set</span> beats <span class="mono">x in big_list</span> by a mile.' },
  { lit: '0',             type: 'int',   mut: false, truthy: false, size: 'zero',
    note: 'Zero is falsy — the classic bug in <span class="mono">if count:</span> when 0 is a legitimate count.' },
  { lit: '[]',            type: 'list',  mut: true,  truthy: false, size: 'empty',
    note: 'Falsy but <b>not</b> None. <span class="mono">[] == None</span> is False; the distinction matters in APIs.' }
];

/* ---------- Ch2: names, objects, aliasing ----------
   Each step: the line that just ran, the heap objects, and which
   names point at which object id.                                  */
C.bindProgs = [
  {
    id: 'alias',
    title: 'Two names, one list',
    lines: ['a = [1, 2, 3]', 'b = a', 'b.append(4)', 'print(a)'],
    steps: [
      { line: 0, heap: { o1: '[1, 2, 3]' }, names: { a: 'o1' }, out: '',
        say: 'One list object is built on the heap, and the name <b>a</b> is bound to it.' },
      { line: 1, heap: { o1: '[1, 2, 3]' }, names: { a: 'o1', b: 'o1' }, out: '',
        say: 'Assignment never copies. <b>b</b> is a second label on the same object.' },
      { line: 2, heap: { o1: '[1, 2, 3, 4]' }, names: { a: 'o1', b: 'o1' }, out: '',
        say: 'Mutating through one name is visible through the other. One object, two doors.' },
      { line: 3, heap: { o1: '[1, 2, 3, 4]' }, names: { a: 'o1', b: 'o1' }, out: '[1, 2, 3, 4]',
        say: 'The surprise that bites every beginner exactly once.' }
    ],
    moral: 'Want a real copy? <span class="mono">b = a.copy()</span> or <span class="mono">b = a[:]</span> — and <span class="mono">copy.deepcopy</span> if the list holds lists.'
  },
  {
    id: 'rebind',
    title: 'Rebinding is not mutating',
    lines: ['a = [1, 2, 3]', 'b = a', 'b = b + [4]', 'print(a)'],
    steps: [
      { line: 0, heap: { o1: '[1, 2, 3]' }, names: { a: 'o1' }, out: '',
        say: 'Same start as before.' },
      { line: 1, heap: { o1: '[1, 2, 3]' }, names: { a: 'o1', b: 'o1' }, out: '',
        say: 'Still two names, one object.' },
      { line: 2, heap: { o1: '[1, 2, 3]', o2: '[1, 2, 3, 4]' }, names: { a: 'o1', b: 'o2' }, out: '',
        say: '<span class="mono">+</span> builds a <b>new</b> list and rebinds the name b to it. o1 is untouched.' },
      { line: 3, heap: { o1: '[1, 2, 3]', o2: '[1, 2, 3, 4]' }, names: { a: 'o1', b: 'o2' }, out: '[1, 2, 3]',
        say: 'Same two opening lines as the last program, opposite result. <span class="mono">b += [4]</span> would have mutated in place like append.' }
    ],
    moral: '<span class="mono">b = b + x</span> rebinds. <span class="mono">b += x</span> mutates lists in place. For immutable types they behave the same, which is exactly why the difference hides until it bites.'
  },
  {
    id: 'ints',
    title: 'Immutables have nowhere to hide',
    lines: ['x = 5', 'y = x', 'y += 1', 'print(x, y)'],
    steps: [
      { line: 0, heap: { o1: '5' }, names: { x: 'o1' }, out: '' },
      { line: 1, heap: { o1: '5' }, names: { x: 'o1', y: 'o1' }, out: '',
        say: 'Both names point at the same int object — CPython even caches small ints, so this really is one object.' },
      { line: 2, heap: { o1: '5', o2: '6' }, names: { x: 'o1', y: 'o2' }, out: '',
        say: 'Ints are immutable, so <span class="mono">+=</span> has no choice: it makes a new object and rebinds y.' },
      { line: 3, heap: { o1: '5', o2: '6' }, names: { x: 'o1', y: 'o2' }, out: '5 6',
        say: 'x never moved. No aliasing surprise is possible here.' }
    ],
    moral: 'Aliasing only ever surprises you with <b>mutable</b> objects: list, dict, set, and your own classes.'
  }
];

/* ---------- Ch3: strings ---------- */
C.strSubject = '  Hello, World  ';
C.strOps = [
  { call: 's.upper()',               out: '  HELLO, WORLD  ', why: 'Returns a new string. The original is never touched — strings are immutable.' },
  { call: 's.strip()',               out: 'Hello, World',     why: 'Removes leading and trailing whitespace. The most-used cleanup call in Python.' },
  { call: 's.replace("l", "L")',     out: '  HeLLo, WorLd  ', why: 'Every occurrence, not just the first. Pass a count as the third argument to limit it.' },
  { call: 's.split(",")',            out: "['  Hello', ' World  ']", why: 'Splits into a list. Bare <span class="mono">s.split()</span> splits on any run of whitespace and drops empties.' },
  { call: 's.find("World")',         out: '9',                why: 'Index of the first match, or −1 if absent. <span class="mono">.index()</span> raises instead of returning −1.' },
  { call: 's.strip().title()',       out: 'Hello, World',     why: 'Methods return strings, so they chain. Read left to right like a pipeline.' },
  { call: 's.startswith("  He")',    out: 'True',             why: 'Cheaper and clearer than slicing. Takes a tuple of options too: <span class="mono">.startswith(("a", "b"))</span>.' },
  { call: 'len(s)',                  out: '16',               why: 'Characters, not bytes. <span class="mono">len("héllo")</span> is 5 even though it is 6 bytes as UTF-8.' }
];
C.sliceDemo = 'Python';
C.sliceCases = [
  { s: '[0]',     out: 'P',      why: 'Index 0 is the first character. Indexes are offsets from the start.' },
  { s: '[-1]',    out: 'n',      why: 'Negative counts from the end, so −1 is the last character. No length arithmetic needed.' },
  { s: '[0:3]',   out: 'Pyt',    why: 'start is inclusive, stop is <b>exclusive</b>. Length of the result is stop − start.' },
  { s: '[:3]',    out: 'Pyt',    why: 'Omit start and it means "from the beginning".' },
  { s: '[3:]',    out: 'hon',    why: 'Omit stop and it means "to the end". These two always split cleanly at the same number.' },
  { s: '[::2]',   out: 'Pto',    why: 'The third value is the step. 2 takes every other character.' },
  { s: '[::-1]',  out: 'nohtyP', why: 'A negative step walks backwards — the famous one-line reverse.' },
  { s: '[2:99]',  out: 'thon',   why: 'Slices clamp instead of raising. An out-of-range <i>index</i> raises IndexError; an out-of-range <i>slice</i> quietly returns what exists.' }
];
C.fstrings = [
  { expr: 'f"{name} is {age}"', vars: { name: '"Ada"', age: '36' },  out: 'Ada is 36',   why: 'Any expression goes inside the braces. This replaced % and .format() and you should not look back.' },
  { expr: 'f"{price:.2f}"',     vars: { price: '3.14159' },          out: '3.14',        why: 'Format spec after the colon. <span class="mono">.2f</span> = fixed point, 2 decimals.' },
  { expr: 'f"{total:,}"',       vars: { total: '1234567' },          out: '1,234,567',   why: 'Thousands separators for free. <span class="mono">:,.2f</span> combines both.' },
  { expr: 'f"{pct:.1%}"',       vars: { pct: '0.4237' },             out: '42.4%',       why: 'The percent spec multiplies by 100 and appends the sign. Stop doing that by hand.' },
  { expr: 'f"{name:>8}|"',      vars: { name: '"Ada"' },             out: '     Ada|',   why: 'Alignment: <span class="mono">&gt;</span> right, <span class="mono">&lt;</span> left, <span class="mono">^</span> centre. Great for lining up console output.' },
  { expr: 'f"{value=}"',        vars: { value: '42' },               out: 'value=42',    why: 'The debug specifier (3.8+). Prints the expression <i>and</i> its value — the fastest print-debugging trick in the language.' }
];

/* ---------- Ch4: collections ---------- */
C.collTable = [
  { op: 'x in c',            list: 'O(n)', tuple: 'O(n)', dict: 'O(1)', set: 'O(1)',
    note: 'The big one. Membership on a list scans every item; on a set or dict it hashes straight to the answer.' },
  { op: 'c[i] by position',  list: 'O(1)', tuple: 'O(1)', dict: '—',    set: '—',
    note: 'Sets and dicts have no positional index. A dict indexes by key instead, also in O(1).' },
  { op: 'append / add',      list: 'O(1)*',tuple: '—',    dict: 'O(1)*',set: 'O(1)*',
    note: '* amortised — occasionally the container resizes and that one call costs more.' },
  { op: 'insert at front',   list: 'O(n)', tuple: '—',    dict: '—',    set: '—',
    note: 'Everything shifts up one slot. Need a queue? <span class="mono">collections.deque</span> makes it O(1) at both ends.' },
  { op: 'mutable',           list: 'yes',  tuple: 'no',   dict: 'yes',  set: 'yes',
    note: 'Immutability is what lets tuples be dict keys and set members. Lists can be neither.' },
  { op: 'keeps order',       list: 'yes',  tuple: 'yes',  dict: 'yes',  set: 'no',
    note: 'Dicts keep insertion order (3.7+). Sets genuinely do not — never rely on set iteration order.' },
  { op: 'allows duplicates', list: 'yes',  tuple: 'yes',  dict: 'keys: no', set: 'no',
    note: '<span class="mono">list(set(items))</span> is the one-line dedupe, at the cost of order.' }
];
C.collTasks = [
  { ask: 'Count how many times each word appears',
    good: 'from collections import Counter\n\ncounts = Counter(words)',
    bad:  'counts = {}\nfor w in words:\n    if w not in counts:\n        counts[w] = 0\n    counts[w] += 1',
    pick: 'dict', why: 'Counter is a dict subclass built for exactly this. The manual version is correct but is five lines the standard library already wrote and tested.' },
  { ask: 'Check whether an id is one of 50,000 banned ids',
    good: 'banned = set(banned_ids)\n\nif user_id in banned:\n    reject()',
    bad:  'if user_id in banned_ids:   # a list\n    reject()',
    pick: 'set', why: 'List membership scans up to 50,000 items on every call. Building the set once makes every later check a single hash lookup.' },
  { ask: 'Return an (x, y) coordinate that must not change',
    good: 'def origin():\n    return (0, 0)',
    bad:  'def origin():\n    return [0, 0]',
    pick: 'tuple', why: 'A fixed-size record with meaning per position. Immutable, hashable, and it signals "this is not a collection you append to".' },
  { ask: 'Keep an ordered to-do list the user reorders',
    good: 'todos = ["buy milk", "call bank"]\ntodos.insert(0, "urgent")',
    bad:  'todos = {"buy milk", "call bank"}',
    pick: 'list', why: 'Order matters and duplicates are legal. That is a list — the default choice until a specific need pushes you elsewhere.' },
  { ask: 'Look up a user record by user id, fast',
    good: 'users = {u.id: u for u in all_users}\n\nusers[42]',
    bad:  'next(u for u in all_users if u.id == 42)',
    pick: 'dict', why: 'One pass to build the index, then O(1) forever. The generator version is O(n) per lookup — fine once, disastrous inside a loop.' }
];

/* ---------- Ch5: control flow trace ---------- */
C.traceProgs = [
  {
    id: 'sum',
    title: 'for over a list',
    lines: ['total = 0', 'for n in [3, 1, 4]:', '    total += n', 'print(total)'],
    steps: [
      { line: 0, vars: { total: '0' }, out: '' },
      { line: 1, vars: { total: '0', n: '3' }, out: '', say: 'The loop hands you each item directly — no index arithmetic, no off-by-one.' },
      { line: 2, vars: { total: '3', n: '3' }, out: '' },
      { line: 1, vars: { total: '3', n: '1' }, out: '' },
      { line: 2, vars: { total: '4', n: '1' }, out: '' },
      { line: 1, vars: { total: '4', n: '4' }, out: '' },
      { line: 2, vars: { total: '8', n: '4' }, out: '' },
      { line: 1, vars: { total: '8', n: '4' }, out: '', say: 'The list is exhausted, so the loop ends and control falls through.' },
      { line: 3, vars: { total: '8', n: '4' }, out: '8', say: 'n survives the loop — Python scopes by function, not by block.' }
    ],
    expect: { total: '8' }
  },
  {
    id: 'break',
    title: 'while, break, and the else nobody knows',
    lines: ['n = 9', 'while n > 1:', '    if n % 2 == 0:', '        break', '    n -= 3', 'else:', '    print("never even")', 'print(n)'],
    steps: [
      { line: 0, vars: { n: '9' }, out: '' },
      { line: 1, vars: { n: '9' }, out: '', say: '9 &gt; 1, so we enter the body.' },
      { line: 2, vars: { n: '9' }, out: '', say: '9 % 2 is 1, not 0 — the if is False.' },
      { line: 4, vars: { n: '6' }, out: '' },
      { line: 1, vars: { n: '6' }, out: '', say: '6 &gt; 1, round two.' },
      { line: 2, vars: { n: '6' }, out: '', say: '6 % 2 is 0 — this time the if fires.' },
      { line: 3, vars: { n: '6' }, out: '', say: '<b>break</b> leaves the loop <i>and</i> skips the else clause entirely.' },
      { line: 7, vars: { n: '6' }, out: '6', say: 'A loop-else runs only when the loop finished <i>without</i> breaking. It really means "no break happened", which is why it reads so strangely.' }
    ],
    expect: { n: '6' }
  },
  {
    id: 'enum',
    title: 'enumerate instead of range(len(...))',
    lines: ['names = ["ada", "bob"]', 'for i, name in enumerate(names, start=1):', '    print(i, name.title())'],
    steps: [
      { line: 0, vars: { names: '["ada", "bob"]' }, out: '' },
      { line: 1, vars: { names: '["ada", "bob"]', i: '1', name: '"ada"' }, out: '',
        say: 'enumerate yields <span class="mono">(index, item)</span> pairs, and unpacking splits each pair into two names.' },
      { line: 2, vars: { names: '["ada", "bob"]', i: '1', name: '"ada"' }, out: '1 Ada' },
      { line: 1, vars: { names: '["ada", "bob"]', i: '2', name: '"bob"' }, out: '1 Ada' },
      { line: 2, vars: { names: '["ada", "bob"]', i: '2', name: '"bob"' }, out: '1 Ada\n2 Bob',
        say: '<span class="mono">start=1</span> is why counting begins at one. Reach for this the moment you catch yourself writing <span class="mono">range(len(x))</span>.' }
    ],
    expect: { i: '2' }
  }
];

/* ---------- Ch6: functions ---------- */
C.funcSig = 'def order(item, qty=1, *extras, note="", **opts):';
C.funcParams = ['item', 'qty', 'extras', 'note', 'opts'];
C.funcCalls = [
  { call: 'order("tea")',
    bind: { item: '"tea"', qty: '1', extras: '()', note: '""', opts: '{}' },
    why: 'Only the required positional argument. Everything else takes its default.' },
  { call: 'order("tea", 3)',
    bind: { item: '"tea"', qty: '3', extras: '()', note: '""', opts: '{}' },
    why: 'The second positional fills qty. Position is the only thing deciding that — nothing is named.' },
  { call: 'order("tea", 3, "hot", "large")',
    bind: { item: '"tea"', qty: '3', extras: '("hot", "large")', note: '""', opts: '{}' },
    why: 'Extra positionals collect into the <span class="mono">*extras</span> tuple instead of raising TypeError.' },
  { call: 'order("tea", note="no sugar")',
    bind: { item: '"tea"', qty: '1', extras: '()', note: '"no sugar"', opts: '{}' },
    why: 'Because note comes after <span class="mono">*extras</span>, it is <b>keyword-only</b> — you cannot reach it positionally at all.' },
  { call: 'order("tea", gift=True, wrap="blue")',
    bind: { item: '"tea"', qty: '1', extras: '()', note: '""', opts: '{"gift": True, "wrap": "blue"}' },
    why: 'Unknown keywords land in <span class="mono">**opts</span>. Handy for pass-through wrappers, awful as an API you expect people to read.' },
  { call: 'order(qty=2, item="tea")',
    bind: { item: '"tea"', qty: '2', extras: '()', note: '""', opts: '{}' },
    why: 'Keyword arguments ignore order. Naming them at the call site is usually worth the extra characters.' }
];
C.mutDefault = {
  bad: 'def add_item(item, cart=[]):\n    cart.append(item)\n    return cart\n\nprint(add_item("apple"))\nprint(add_item("pear"))',
  badOut: "['apple']\n['apple', 'pear']",
  good: 'def add_item(item, cart=None):\n    if cart is None:\n        cart = []\n    cart.append(item)\n    return cart\n\nprint(add_item("apple"))\nprint(add_item("pear"))',
  goodOut: "['apple']\n['pear']",
  why: 'Default values are evaluated <b>once</b>, when the <span class="mono">def</span> line runs — not on each call. So every call that omits <span class="mono">cart</span> shares one list that quietly accumulates forever. Never use a mutable default; use None and build inside.'
};

/* ---------- Ch7: errors ---------- */
C.errCases = [
  { name: 'NameError',
    code: 'total = 0\nfor n in nums:\n    total += n',
    tb: 'Traceback (most recent call last):\n  File "app.py", line 2, in <module>\n    for n in nums:\nNameError: name \'nums\' is not defined',
    read: 'The bottom line names the problem, the line above shows where it happened. Here: nothing ever assigned <span class="mono">nums</span> — usually a typo or a missing import.',
    fix: 'nums = [1, 2, 3]\ntotal = 0\nfor n in nums:\n    total += n' },
  { name: 'TypeError',
    code: 'age = input("age? ")   # returns a str\nif age > 18:\n    print("adult")',
    tb: 'Traceback (most recent call last):\n  File "app.py", line 2, in <module>\n    if age > 18:\nTypeError: \'>\' not supported between instances of \'str\' and \'int\'',
    read: '<span class="mono">input()</span> always returns a string. Python refuses to guess whether <span class="mono">"9" &gt; 18</span> means text or number, so it raises instead of doing something clever and wrong.',
    fix: 'age = int(input("age? "))\nif age > 18:\n    print("adult")' },
  { name: 'KeyError',
    code: 'user = {"name": "Ada"}\nprint(user["email"])',
    tb: 'Traceback (most recent call last):\n  File "app.py", line 2, in <module>\n    print(user["email"])\nKeyError: \'email\'',
    read: 'The key is not in the dict. The message <i>is</i> the missing key — read it literally.',
    fix: 'user = {"name": "Ada"}\nprint(user.get("email", "none on file"))' },
  { name: 'IndexError',
    code: 'items = [1, 2, 3]\nprint(items[3])',
    tb: 'Traceback (most recent call last):\n  File "app.py", line 2, in <module>\n    print(items[3])\nIndexError: list index out of range',
    read: 'Three items means valid indexes 0, 1, 2. Off-by-one, every time.',
    fix: 'items = [1, 2, 3]\nprint(items[-1])   # last item, no arithmetic' },
  { name: 'AttributeError',
    code: 'name = "ada"\nprint(name.push("x"))',
    tb: 'Traceback (most recent call last):\n  File "app.py", line 2, in <module>\n    print(name.push("x"))\nAttributeError: \'str\' object has no attribute \'push\'',
    read: 'The type is right there in the message. Either the object is not what you thought it was, or you brought a method name from another language.',
    fix: 'name = "ada"\nprint(name + "x")' },
  { name: 'ZeroDivisionError',
    code: 'scores = []\nprint(sum(scores) / len(scores))',
    tb: 'Traceback (most recent call last):\n  File "app.py", line 2, in <module>\n    print(sum(scores) / len(scores))\nZeroDivisionError: division by zero',
    read: 'The classic empty-list average. It never fires while you are testing and always fires in production.',
    fix: 'scores = []\nprint(sum(scores) / len(scores) if scores else 0)' },
  { name: 'IndentationError',
    code: 'def greet(name):\nprint(name)',
    tb: '  File "app.py", line 2\n    print(name)\n    ^\nIndentationError: expected an indented block after function definition on line 1',
    read: 'Indentation is syntax in Python, not style. Any line ending in <span class="mono">:</span> must be followed by an indented body.',
    fix: 'def greet(name):\n    print(name)' }
];
C.tryPatterns = [
  { t: 'try / except',     code: 'try:\n    n = int(text)\nexcept ValueError:\n    n = 0',
    why: 'Catch the <b>specific</b> exception. A bare <span class="mono">except:</span> swallows typos, KeyboardInterrupt and genuine bugs alike.' },
  { t: 'else',             code: 'try:\n    f = open(path)\nexcept OSError:\n    log("missing")\nelse:\n    data = f.read()',
    why: 'The else block runs only if nothing was raised. It keeps the try body down to the one line that can actually fail.' },
  { t: 'finally',          code: 'try:\n    work()\nfinally:\n    cleanup()',
    why: 'Runs whether or not there was an exception, and even on <span class="mono">return</span>. Cleanup goes here.' },
  { t: 'with (preferred)', code: 'with open(path, encoding="utf-8") as f:\n    data = f.read()',
    why: 'A context manager is try/finally with the boilerplate removed. The file closes even if <span class="mono">read()</span> raises.' },
  { t: 'raise your own',   code: 'if qty < 1:\n    raise ValueError(f"qty must be >= 1, got {qty}")',
    why: 'Fail loudly at the boundary, with the bad value in the message. Silent coercion is how bad data gets deep into a system.' }
];

/* ---------- Ch8: comprehensions ---------- */
C.compInput = [1, 2, 3, 4, 5];
C.comps = [
  { kind: 'map',
    loop: 'out = []\nfor n in nums:\n    out.append(n * n)',
    comp: 'out = [n * n for n in nums]',
    keep: [true, true, true, true, true], vals: ['1', '4', '9', '16', '25'], result: '[1, 4, 9, 16, 25]',
    why: 'Transform every item. The comprehension says "a list of n squared, for each n" — a description of the result, not a recipe for building it.' },
  { kind: 'filter',
    loop: 'out = []\nfor n in nums:\n    if n % 2 == 0:\n        out.append(n)',
    comp: 'out = [n for n in nums if n % 2 == 0]',
    keep: [false, true, false, true, false], vals: ['1', '2', '3', '4', '5'], result: '[2, 4]',
    why: 'The trailing <span class="mono">if</span> filters. Read it left to right: take n, for each n, when n is even.' },
  { kind: 'ternary',
    loop: 'out = []\nfor n in nums:\n    out.append(n * n if n % 2 else 0)',
    comp: 'out = [n * n if n % 2 else 0 for n in nums]',
    keep: [true, true, true, true, true], vals: ['1', '0', '9', '0', '25'], result: '[1, 0, 9, 0, 25]',
    why: 'An <span class="mono">if/else</span> <b>before</b> the for is a ternary picking the value, so nothing is dropped. An <span class="mono">if</span> <b>after</b> the for filters. Same keyword, different position, completely different job.' },
  { kind: 'dict',
    loop: 'out = {}\nfor n in nums:\n    out[n] = n * n',
    comp: 'out = {n: n * n for n in nums}',
    keep: [true, true, true, true, true], vals: ['1: 1', '2: 4', '3: 9', '4: 16', '5: 25'], result: '{1: 1, 2: 4, 3: 9, 4: 16, 5: 25}',
    why: 'The same syntax with a colon builds a dict. Turning a list of records into a lookup index is the most common real use.' },
  { kind: 'set',
    loop: 'out = set()\nfor n in nums:\n    out.add(n % 3)',
    comp: 'out = {n % 3 for n in nums}',
    keep: [true, true, true, true, true], vals: ['1', '2', '0', '1', '2'], result: '{0, 1, 2}',
    why: 'Braces without a colon build a set, so duplicates collapse. Five inputs in, three values out.' },
  { kind: 'generator',
    loop: 'total = 0\nfor n in nums:\n    total += n * n',
    comp: 'total = sum(n * n for n in nums)',
    keep: [true, true, true, true, true], vals: ['1', '4', '9', '16', '25'], result: '55',
    why: 'No brackets means a generator: it produces one value at a time and never builds the list. For a million rows that is the difference between fine and out-of-memory.' }
];

/* ---------- Ch9: files, modules, environments ---------- */
C.fileOps = [
  { t: 'read a whole text file',
    code: 'from pathlib import Path\n\ntext = Path("notes.txt").read_text(encoding="utf-8")',
    why: 'pathlib beats string paths: it handles Windows vs POSIX separators for you. Always name the encoding — the default differs per platform and that is a real source of production bugs.' },
  { t: 'read line by line',
    code: 'with open("big.log", encoding="utf-8") as f:\n    for line in f:\n        process(line.rstrip("\\n"))',
    why: 'A file object is an iterator of lines, so this streams and never loads the whole file. The right shape for a 4 GB log.' },
  { t: 'write',
    code: 'with open("out.txt", "w", encoding="utf-8") as f:\n    f.write("hello\\n")',
    why: '<span class="mono">"w"</span> truncates the file to empty first. <span class="mono">"a"</span> appends. Getting these two the wrong way round destroys data.' },
  { t: 'CSV',
    code: 'import csv\n\nwith open("data.csv", newline="", encoding="utf-8") as f:\n    for row in csv.DictReader(f):\n        print(row["email"])',
    why: 'Never split a CSV on commas by hand — a quoted field containing a comma will break it. <span class="mono">newline=""</span> is required, not optional.' },
  { t: 'JSON',
    code: 'import json\nfrom pathlib import Path\n\nconfig = json.loads(Path("config.json").read_text())\nPath("out.json").write_text(json.dumps(config, indent=2))',
    why: '<span class="mono">loads</span>/<span class="mono">dumps</span> work on strings; <span class="mono">load</span>/<span class="mono">dump</span> work on file objects. The trailing s is the whole difference.' }
];
C.envSteps = [
  { cmd: 'python -m venv .venv', what: 'Creates an isolated interpreter and site-packages inside your project folder.',
    why: 'Without this, every project shares one global set of packages, and two projects needing different versions of the same library cannot both work.' },
  { cmd: '.venv\\Scripts\\activate', what: 'Activates it on Windows (<span class="mono">source .venv/bin/activate</span> on macOS and Linux).',
    why: 'Your prompt gains a <span class="mono">(.venv)</span> prefix. Now <span class="mono">python</span> and <span class="mono">pip</span> mean the ones in this folder.' },
  { cmd: 'python -m pip install requests', what: 'Installs into the active environment only.',
    why: 'Prefer <span class="mono">python -m pip</span> over bare <span class="mono">pip</span> — it guarantees you install into the interpreter you are actually running.' },
  { cmd: 'pip freeze > requirements.txt', what: 'Records exact versions of everything installed.',
    why: 'This file is what makes the project reproducible on someone else\'s machine. Commit it; never commit <span class="mono">.venv/</span>.' },
  { cmd: 'pip install -r requirements.txt', what: 'Rebuilds the same environment elsewhere.',
    why: 'The other half of the contract. If <span class="mono">git clone</span> plus these two commands does not run your project, the setup is broken.' }
];
C.classDemo = {
  code: 'class Account:\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n        self.balance = balance\n\n    def deposit(self, amount):\n        if amount <= 0:\n            raise ValueError("amount must be positive")\n        self.balance += amount\n        return self.balance\n\n    def __repr__(self):\n        return f"Account({self.owner!r}, {self.balance})"',
  parts: [
    { k: '__init__',   v: 'Runs when you call <span class="mono">Account("ada")</span>. It is not really a constructor — the object already exists by then; this just fills it in.' },
    { k: 'self',       v: 'The instance, passed automatically. It is explicit in Python because explicit beats magic, so you write it in every method signature.' },
    { k: 'self.owner', v: 'An <b>instance</b> attribute — one per object. A name assigned in the class body instead would be shared by every instance, which is the class-level twin of the mutable-default bug.' },
    { k: 'deposit',    v: 'Validates at the boundary, then mutates state. Raising beats returning None on bad input: the caller cannot accidentally ignore an exception.' },
    { k: '__repr__',   v: 'What you see in the REPL and in logs. <span class="mono">!r</span> uses repr for the field too, so strings keep their quotes. Add it to every class you will ever have to debug.' }
  ]
};

/* ---------- Ch10: gotchas ---------- */
C.gotchas = [
  { q: 'a = [1, 2, 3]<br>b = a<br>b.append(4)<br><b>len(a)</b> is ?', guess: ['3', '4'], a: 1,
    e: '<b>4.</b> <span class="mono">b = a</span> copies the reference, not the list. Use <span class="mono">a.copy()</span> for a real copy.' },
  { q: '<b>0.1 + 0.2 == 0.3</b>', guess: ['True', 'False'], a: 1,
    e: '<b>False.</b> Binary floats cannot represent 0.1 exactly; the sum is 0.30000000000000004. Compare with <span class="mono">math.isclose</span>, and use <span class="mono">decimal.Decimal</span> for money.' },
  { q: '<b>[] == None</b>', guess: ['True', 'False'], a: 1,
    e: '<b>False.</b> Both are falsy, but they are different objects. "Empty" and "absent" are different facts, and conflating them hides bugs.' },
  { q: 'def f(x, acc=[]):<br>&nbsp;&nbsp;&nbsp;&nbsp;acc.append(x); return acc<br>f(1) then <b>f(2)</b> returns ?', guess: ['[2]', '[1, 2]'], a: 1,
    e: '<b>[1, 2].</b> The default list is created once at def time and shared by every call. Use <span class="mono">acc=None</span> and build inside.' },
  { q: 'fs = [lambda: i for i in range(3)]<br><b>fs[0]()</b> is ?', guess: ['0', '2'], a: 1,
    e: '<b>2.</b> Closures capture the <i>variable</i>, not its value at creation time. By the time you call it, i is 2. Fix with a default argument: <span class="mono">lambda i=i: i</span>.' },
  { q: '<b>"1" + 1</b>', guess: ['"11"', 'TypeError'], a: 1,
    e: '<b>TypeError.</b> Python refuses to guess whether you meant concatenation or addition — unlike JavaScript, which guesses and is often wrong.' },
  { q: 'x = 5; y = 5<br><b>x is y</b>', guess: ['True', 'False'], a: 0,
    e: '<b>True</b> — but only by accident. CPython caches small ints (−5 to 256). At 500 it is False. Never use <span class="mono">is</span> for value comparison; it is for None and other singletons.' },
  { q: 'for x in [1, 2, 3]: pass<br><b>x</b> after the loop is ?', guess: ['3', 'NameError'], a: 0,
    e: '<b>3.</b> The loop variable leaks — Python scopes by function, not by block. A comprehension does <i>not</i> leak, which changed in Python 3.' },
  { q: 'x = [3, 1, 2]<br><b>x = x.sort()</b> leaves x as ?', guess: ['[1, 2, 3]', 'None'], a: 1,
    e: '<b>None.</b> <span class="mono">.sort()</span> sorts in place and returns None. Use <span class="mono">sorted(x)</span> when you want a new list back.' }
];

/* ---------- Ch11: quiz + glossary ---------- */
C.quiz = [
  { q: 'What does <span class="mono">b = a</span> do when a is a list?', o: ['Copies the list', 'Makes b a second name for the same list', 'Creates an empty list', 'Raises unless you use copy()'], a: 1,
    e: 'Assignment binds a name to an object. There is one list and two names; mutating through either is visible through both.' },
  { q: 'Which of these is immutable?', o: ['list', 'dict', 'tuple', 'set'], a: 2,
    e: 'Tuples cannot change after creation, which is exactly why they can be dict keys and set members.' },
  { q: 'Why is <span class="mono">x in some_set</span> faster than <span class="mono">x in some_list</span>?', o: ['Sets are stored in RAM', 'Sets hash the value and jump straight to it', 'Sets are always shorter', 'They are the same speed'], a: 1,
    e: 'Set membership is O(1) hashing; list membership is an O(n) scan. On large collections it is the single biggest easy win in Python.' },
  { q: 'What is wrong with <span class="mono">def f(items=[]):</span>?', o: ['Nothing', 'The default list is created once and shared across calls', 'Lists cannot be defaults', 'It is slower than a tuple'], a: 1,
    e: 'Defaults are evaluated at def time. Every call that omits the argument mutates the same list. Use None as the sentinel.' },
  { q: 'When you read a traceback, where is the actual error?', o: ['The first line', 'The last line', 'The middle', 'In the filename'], a: 1,
    e: 'Read bottom-up: the last line is the exception type and message, and the frames above it are the call path that got there.' },
  { q: '<span class="mono">[n for n in nums if n &gt; 2]</span> — what does the if do?', o: ['Picks between two values', 'Filters which items are included', 'Stops the loop', 'Nothing, it is a syntax error'], a: 1,
    e: 'An if after the for filters. An if/else before the for chooses the value. Position decides the meaning.' },
  { q: 'What does <span class="mono">with open(path) as f:</span> guarantee?', o: ['The file exists', 'The file is closed when the block exits, even on an exception', 'The file is read fully', 'The file is locked'], a: 1,
    e: 'A context manager is try/finally without the boilerplate. It does not guarantee the file exists — a missing file still raises.' },
  { q: 'Why use a virtual environment?', o: ['It runs Python faster', 'It isolates each project\'s package versions', 'It is required to import stdlib modules', 'It compiles your code'], a: 1,
    e: 'Two projects needing different versions of the same library cannot share one global site-packages. venv gives each its own.' },
  { q: '<span class="mono">"9" &gt; 5</span> in Python 3 does what?', o: ['Returns True', 'Returns False', 'Raises TypeError', 'Converts and compares'], a: 2,
    e: 'Python refuses to compare str with int. Convert explicitly — this is why input() results need int() before arithmetic.' },
  { q: 'What does <span class="mono">.sort()</span> return?', o: ['A new sorted list', 'None', 'The original list', 'A generator'], a: 1,
    e: 'It sorts in place and returns None. Use sorted() when you want a new list back.' },
  { q: 'What is the difference between <span class="mono">is</span> and <span class="mono">==</span>?', o: ['None, they are aliases', 'is compares identity, == compares value', 'is is faster', '== only works on numbers'], a: 1,
    e: 'is asks "the same object?"; == asks "equal value?". Use is only for None and other singletons.' },
  { q: 'How does <span class="mono">sum(x*x for x in nums)</span> differ from the list version?', o: ['It is invalid syntax', 'It never builds the intermediate list', 'It sorts first', 'It only works on ints'], a: 1,
    e: 'A generator expression yields one value at a time, so memory stays constant regardless of input size.' },
  { q: 'Which of these is falsy?', o: ['"0"', '[0]', '0.0', '" "'], a: 2,
    e: '0.0 is falsy. A non-empty string (even "0" or " ") and a non-empty list (even [0]) are both truthy — the container matters, not the contents.' },
  { q: 'What does <span class="mono">f"{value=}"</span> print when value is 42?', o: ['42', 'value=42', '{value=}', 'TypeError'], a: 1,
    e: 'The debug specifier prints the expression text and its value. Added in 3.8, and the fastest print-debugging in the language.' },
  { q: 'Where does an unhandled exception stop your program?', o: ['At the raise, unwinding to the top', 'At the end of the file', 'It does not stop it', 'At the next function call'], a: 0,
    e: 'The exception propagates up the call stack; if nothing catches it, the interpreter prints the traceback and exits with a non-zero status.' }
];
C.glossary = [
  ['Object', 'Everything in Python is one: a value with a type and an identity.'],
  ['Name', 'A label bound to an object. Assignment binds names; it never copies objects.'],
  ['Mutable', 'Can be changed in place — list, dict, set. Immutable: int, str, tuple, frozenset.'],
  ['Reference', 'What a name holds — the address of an object, not the object itself.'],
  ['Iterable', 'Anything you can loop over: list, str, dict, file, generator.'],
  ['Iterator', 'An object with __next__ that yields items once, then is exhausted.'],
  ['Generator', 'A lazy iterator built from yield or a (genexp). Constant memory.'],
  ['Comprehension', 'Expression syntax that builds a list, dict or set from an iterable.'],
  ['Truthy / falsy', 'How a value behaves in an if. Empty containers, 0, "" and None are falsy.'],
  ['f-string', 'f"..." — inline expression interpolation with format specs. The modern default.'],
  ['Slice', 'x[start:stop:step]. stop is exclusive; negative indexes count from the end.'],
  ['Unpacking', 'a, b = pair, or *rest to absorb the remainder.'],
  ['*args / **kwargs', 'Collect extra positional arguments into a tuple / keyword arguments into a dict.'],
  ['Keyword-only', 'A parameter after *args that can only be passed by name.'],
  ['Default argument', 'Evaluated once at def time — never make it mutable.'],
  ['Scope', 'Where a name is visible. Python scopes by function (LEGB), not by block.'],
  ['Closure', 'A function that captures names from the enclosing scope — by variable, not by value.'],
  ['Exception', 'An error object that propagates up the stack until something catches it.'],
  ['Traceback', 'The call path printed on an unhandled exception. Read it bottom-up.'],
  ['Context manager', 'The with protocol — guaranteed setup and teardown.'],
  ['Module', 'One .py file. A package is a folder of them.'],
  ['Virtual environment', 'A per-project interpreter and package set, made by python -m venv.'],
  ['PEP 8', 'The style guide: 4-space indents, snake_case, 79–88 column lines.'],
  ['Type hint', 'def f(x: int) -> str. Documentation the tooling can check; ignored at runtime.'],
  ['dunder', 'A __name__ method the language calls for you — __init__, __repr__, __len__.'],
  ['REPL', 'The interactive prompt. The fastest way to answer "what does this actually do".'],
  ['GIL', 'Global Interpreter Lock — one thread runs Python bytecode at a time; use processes for CPU-bound work.'],
  ['pip', 'The package installer. Prefer python -m pip so you install into the interpreter you are running.']
];
