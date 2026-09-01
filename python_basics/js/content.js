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

/* ---------- Ch10: the data stack ---------- */
C.dataStack = [
  { name: 'NumPy', tag: 'pip install numpy',
    what: 'One typed, contiguous n-dimensional array, plus arithmetic that applies to the whole thing at once.',
    code: 'import numpy as np\n\na = np.array([1, 2, 3])\na * 2          # array([2, 4, 6])\na.mean()       # 2.0\na[a > 1]       # array([2, 3])',
    why: 'Every other package here stores its numbers in a NumPy array. Learn this one first — the rest is vocabulary on top of it.' },
  { name: 'pandas', tag: 'pip install pandas',
    what: 'A <span class="mono">DataFrame</span>: a table with named columns and an index. Loading, joining, grouping, cleaning.',
    code: 'import pandas as pd\n\ndf = pd.read_csv("staff.csv")\ndf[df["salary"] > 90000]\ndf.groupby("dept")["salary"].mean()',
    why: 'This is where most of a real ML job is spent. The model is ten lines; getting the table right is the other three days.' },
  { name: 'Matplotlib', tag: 'pip install matplotlib',
    what: 'The plotting layer everything else builds on. Verbose, but it can draw anything.',
    code: 'import matplotlib.pyplot as plt\n\nfig, ax = plt.subplots()\nax.scatter(df["years"], df["salary"])\nax.set_xlabel("years")\nfig.savefig("pay.png", dpi=150)',
    why: 'Use the <span class="mono">fig, ax</span> form rather than the global <span class="mono">plt.</span> one — it is the difference between a plot you can reuse and a plot that fights you.' },
  { name: 'seaborn', tag: 'pip install seaborn',
    what: 'Matplotlib with the statistics built in, and defaults that already look right.',
    code: 'import seaborn as sns\n\nsns.boxplot(data=df, x="dept", y="salary")\nsns.heatmap(df.corr(numeric_only=True), annot=True)',
    why: 'One line for a chart that takes fifteen in raw Matplotlib. It takes a DataFrame directly and knows about columns.' },
  { name: 'SciPy', tag: 'pip install scipy',
    what: 'The scientific toolbox on top of NumPy: statistics, optimisation, interpolation, signal processing, sparse matrices.',
    code: 'from scipy import stats\n\nstats.ttest_ind(group_a, group_b)\nstats.pearsonr(x, y)',
    why: 'Reach here before writing a statistical formula by hand. Someone already wrote it, and handled the degenerate cases you have not thought about.' }
];

/* The loop-vs-vectorised comparison. The bars count Python-level operations,
   which is the honest thing to compare — the widget says so on screen. */
C.vecDemo = {
  loop: 'total = 0\nfor x in data:            # a list of 1,000,000 Python ints\n    total += x * x        # a bytecode round-trip, every single time',
  vec: 'import numpy as np\n\narr = np.array(data)      # one flat 8 MB buffer\ntotal = (arr * arr).sum() # one call; the loop runs in C',
  loopOps: 1000000,
  vecOps: 1,
  why: 'A Python list of a million ints is a million pointers to a million separately boxed objects, and the loop pays interpreter overhead on every one. A NumPy array is one flat block of 8-byte integers, and <span class="mono">arr * arr</span> hands the whole block to a C loop. Same answer, one Python-level operation instead of a million.',
  caution: 'The bars count <b>Python-level operations</b>, which is the thing that actually differs. Wall-clock speedup is typically 20&ndash;100&times; and depends on your machine — this page is not measuring it.'
};

/* One small table; every pandas result below is recomputed from it in test.js. */
C.pandasDF = {
  cols: ['name', 'dept', 'salary', 'years'],
  rows: [
    ['Ada', 'eng', 120000, 6],
    ['Bob', 'sales', 70000, 2],
    ['Cleo', 'eng', 135000, 9],
    ['Dev', 'sales', 82000, 4],
    ['Eve', 'ops', 95000, 3]
  ]
};
C.pandasOps = [
  { id: 'load', label: 'load',
    code: 'import pandas as pd\n\ndf = pd.read_csv("staff.csv")\ndf.shape',
    out: '(5, 4)',
    why: '<span class="mono">read_csv</span> handles quoting, dtypes and missing values for you. <span class="mono">.shape</span> is (rows, columns) — check it first, every time; a wrong row count means the load was wrong, not the model.' },
  { id: 'head', label: 'look at it',
    code: 'df.head(3)      # also: df.tail(), df.info(), df.describe()',
    out: '   name   dept  salary  years\n0   Ada    eng  120000      6\n1   Bob  sales   70000      2\n2  Cleo    eng  135000      9',
    why: 'The leftmost column is the <b>index</b>, not data. <span class="mono">df.info()</span> gives you dtypes and null counts — the two things that break everything downstream.' },
  { id: 'select', label: 'pick columns',
    code: 'df[["name", "salary"]]     # a DataFrame\ndf["salary"]              # a Series',
    out: '   name  salary\n0   Ada  120000\n1   Bob   70000\n2  Cleo  135000\n3   Dev   82000\n4   Eve   95000',
    why: 'Double brackets give a table; single brackets give one column as a <span class="mono">Series</span>. Most "why is this not a DataFrame" confusion is that one bracket.' },
  { id: 'filter', label: 'filter rows',
    code: 'df[df["salary"] > 90000]\n\n# combine with & and |, and parenthesise every part\ndf[(df["dept"] == "eng") & (df["years"] > 5)]',
    out: '   name  dept  salary  years\n0   Ada   eng  120000      6\n2  Cleo   eng  135000      9\n4   Eve   ops   95000      3',
    why: 'The inside is a boolean Series and the outside keeps the True rows. Use <span class="mono">&amp;</span> and <span class="mono">|</span>, never <span class="mono">and</span>/<span class="mono">or</span> — those demand one truth value and a Series refuses to give one. Note the index survives: 0, 2, 4.' },
  { id: 'assign', label: 'add a column',
    code: 'df["senior"] = df["years"] >= 5',
    out: '   name   dept  salary  years  senior\n0   Ada    eng  120000      6    True\n1   Bob  sales   70000      2   False\n2  Cleo    eng  135000      9    True\n3   Dev  sales   82000      4   False\n4   Eve    ops   95000      3   False',
    why: 'Column at a time, never row at a time. If you are writing <span class="mono">for i, row in df.iterrows()</span>, there is almost always a vectorised expression that is shorter and far faster.' },
  { id: 'sort', label: 'sort',
    code: 'df.sort_values("salary", ascending=False)',
    out: '   name   dept  salary  years\n2  Cleo    eng  135000      9\n0   Ada    eng  120000      6\n4   Eve    ops   95000      3\n3   Dev  sales   82000      4\n1   Bob  sales   70000      2',
    why: 'Returns a new frame; the original is untouched. Almost every pandas method works this way — assign the result, and prefer that to <span class="mono">inplace=True</span>.' },
  { id: 'group', label: 'group + aggregate',
    code: 'df.groupby("dept")["salary"].mean()',
    out: 'dept\neng      127500.0\nops       95000.0\nsales     76000.0\nName: salary, dtype: float64',
    why: 'Split, apply, combine. The grouping column becomes the index of the result. Use <span class="mono">.agg(["mean", "max", "count"])</span> when one number is not enough.' },
  { id: 'counts', label: 'count values',
    code: 'df["dept"].value_counts()',
    out: 'dept\neng      2\nsales    2\nops      1\nName: count, dtype: int64',
    why: 'The fastest sanity check in pandas. Run it on every categorical column before training — this is how you find the typo class with three rows in it.' },
  { id: 'missing', label: 'missing data',
    code: 'df.isna().sum()               # how many gaps, per column\ndf["bonus"].fillna(0)         # replace them\ndf.dropna(subset=["salary"])  # or drop those rows',
    out: 'name      0\ndept      0\nsalary    0\nyears     0\ndtype: int64',
    why: 'Decide per column what a gap means. Dropping every row with any gap is the default nobody chose, and it quietly throws away most datasets.' },
  { id: 'join', label: 'join',
    code: 'pd.merge(df, bonuses, on="name", how="left")\n\npd.concat([q1, q2])           # stack rows instead',
    out: null,
    why: 'Same idea as a SQL join. Check <span class="mono">.shape</span> before and after: if the row count grew, your join key was not unique and you have just duplicated data.' },
  { id: 'save', label: 'save',
    code: 'df.to_csv("out.csv", index=False)\ndf.to_parquet("out.parquet")',
    out: null,
    why: '<span class="mono">index=False</span>, or you get a stray unnamed column next time you read it. Parquet keeps dtypes and is far smaller — use it for anything you reload often.' }
];

/* ---------- Ch11: scikit-learn and the wider ecosystem ---------- */
C.sklearnApi = [
  { name: 'fit(X, y)',
    what: 'Learn from training data. Mutates the estimator and returns it.',
    code: 'model.fit(X_train, y_train)',
    why: 'Training data only. The moment test rows reach a <span class="mono">fit</span> call, your score is fiction.' },
  { name: 'predict(X)',
    what: 'One answer per row: a class label, or a number from a regressor.',
    code: 'y_pred = model.predict(X_test)',
    why: '<span class="mono">predict_proba</span> gives the probabilities behind the label — you need those to move the decision threshold off 0.5.' },
  { name: 'transform(X)',
    what: 'Features in, features out. Scalers, encoders and PCA are transformers.',
    code: 'X_scaled = scaler.transform(X_test)',
    why: 'A transformer learns its numbers (means, categories) during fit, then applies those same numbers everywhere else.' },
  { name: 'fit_transform(X)',
    what: 'Fit and transform in one pass — training data only.',
    code: 'X_train_s = scaler.fit_transform(X_train)\nX_test_s  = scaler.transform(X_test)',
    why: 'Calling <span class="mono">fit_transform</span> on the test set refits on it. That is data leakage, and it is the most common beginner bug in this chapter.' },
  { name: 'score(X, y)',
    what: 'The estimator default metric — accuracy for classifiers, R&sup2; for regressors.',
    code: 'model.score(X_test, y_test)   # 0.87',
    why: 'Convenient, and often the wrong metric. Pick the metric your problem cares about before you look at any number.' }
];

C.mlPipeline = [
  { n: 'split', small: 'hold data back',
    code: 'from sklearn.model_selection import train_test_split\n\nX = df.drop(columns="churn")\ny = df["churn"]\n\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, random_state=42, stratify=y)',
    say: 'Before anything else. <span class="mono">stratify=y</span> keeps the class balance identical in both halves, and <span class="mono">random_state</span> makes the split reproducible. The test set is now sealed until the last step.' },
  { n: 'preprocess', small: 'per column type',
    code: 'from sklearn.compose import ColumnTransformer\nfrom sklearn.preprocessing import StandardScaler, OneHotEncoder\n\nprep = ColumnTransformer([\n    ("num", StandardScaler(), ["tenure", "monthly_charges"]),\n    ("cat", OneHotEncoder(handle_unknown="ignore"), ["plan", "region"]),\n])',
    say: 'Numbers get centred and scaled; categories become one 0/1 column per category. <span class="mono">handle_unknown="ignore"</span> means a category that only ever appears in production does not crash the model at 3am.' },
  { n: 'Pipeline', small: 'glue it together',
    code: 'from sklearn.pipeline import Pipeline\nfrom sklearn.linear_model import LogisticRegression\n\npipe = Pipeline([\n    ("prep", prep),\n    ("clf", LogisticRegression(max_iter=1000)),\n])',
    say: 'This is the whole point of scikit-learn. The preprocessing is now <i>part of the model</i>, so it cannot be applied inconsistently, cannot leak across the split, and ships as one object.' },
  { n: 'fit', small: 'train',
    code: 'pipe.fit(X_train, y_train)',
    say: 'One call. Every step gets <span class="mono">fit_transform</span> in order, and the final estimator gets <span class="mono">fit</span>. Notice there is nowhere for test data to sneak in.' },
  { n: 'cross-validate', small: 'is it real?',
    code: 'from sklearn.model_selection import cross_val_score\n\nscores = cross_val_score(pipe, X_train, y_train, cv=5, scoring="f1")\nprint(scores.mean(), scores.std())',
    say: 'Five train/validate splits inside the training set. The spread matters as much as the mean: 0.81 &plusmn; 0.02 is a model; 0.81 &plusmn; 0.15 is a coin flip that got lucky once.' },
  { n: 'tune', small: 'search parameters',
    code: 'from sklearn.model_selection import GridSearchCV\n\ngrid = {"clf__C": [0.1, 1, 10]}\nsearch = GridSearchCV(pipe, grid, cv=5, scoring="f1")\nsearch.fit(X_train, y_train)\nsearch.best_params_',
    say: 'The double underscore addresses a step inside the pipeline: <span class="mono">clf__C</span> is the <span class="mono">C</span> of the step named <span class="mono">clf</span>. Still training data only — the search validates on folds, never on the test set.' },
  { n: 'evaluate', small: 'break the seal',
    code: 'from sklearn.metrics import classification_report, confusion_matrix\n\ny_pred = search.predict(X_test)\nprint(classification_report(y_test, y_pred))\nprint(confusion_matrix(y_test, y_pred))',
    say: 'The first and only time the test set is used. Read precision and recall per class, and the confusion matrix — accuracy alone hides which class you are failing.' },
  { n: 'save', small: 'ship it',
    code: 'import joblib\n\njoblib.dump(search.best_estimator_, "churn.joblib")\nmodel = joblib.load("churn.joblib")\nmodel.predict(new_rows)',
    say: 'The saved object contains the preprocessing too, so serving is one <span class="mono">predict</span> on raw columns. Pin your library versions — a pickle from a different scikit-learn version may refuse to load.' }
];

C.modelOptions = ['LinearRegression', 'LogisticRegression', 'HistGradientBoosting', 'KMeans', 'PCA', 'PyTorch'];
C.modelPicks = [
  { ask: 'Predict a house price from ten numeric features, and explain which feature moved it',
    pick: 'LinearRegression',
    good: 'from sklearn.linear_model import Ridge\n\nmodel = Ridge(alpha=1.0).fit(X_train, y_train)\nmodel.coef_          # one weight per feature',
    bad: 'model = RandomForestRegressor(n_estimators=500)\n# accurate, but "why" is now 500 trees',
    why: 'A continuous target means regression. Start linear: it trains instantly and the coefficients are the explanation. <span class="mono">Ridge</span> is linear regression plus a penalty that stops it overreacting to correlated features.' },
  { ask: 'Flag whether an email is spam, and get a probability you can threshold',
    pick: 'LogisticRegression',
    good: 'from sklearn.linear_model import LogisticRegression\n\nclf = LogisticRegression(max_iter=1000).fit(X_train, y_train)\nclf.predict_proba(X_test)[:, 1]',
    bad: 'clf = LinearRegression()\n# predicts 1.4 and -0.2 for a yes/no question',
    why: 'Two classes and you want a probability. Despite the name it is a classifier, and it is the baseline every project should have to beat before it earns anything fancier.' },
  { ask: 'Best possible accuracy on a messy 200k-row table of mixed numbers and categories',
    pick: 'HistGradientBoosting',
    good: 'from sklearn.ensemble import HistGradientBoostingClassifier\n\nclf = HistGradientBoostingClassifier().fit(X_train, y_train)',
    bad: 'clf = MLPClassifier(hidden_layer_sizes=(256, 128))\n# a neural net: slower, and usually worse on tabular data',
    why: 'Gradient-boosted trees win on tabular data, handle missing values natively, and barely care about scaling. XGBoost and LightGBM are the same family with more knobs.' },
  { ask: 'Split customers into groups when nobody has labelled anything',
    pick: 'KMeans',
    good: 'from sklearn.cluster import KMeans\n\nlabels = KMeans(n_clusters=4, n_init="auto").fit_predict(X_scaled)',
    bad: 'clf = LogisticRegression().fit(X, y)\n# there is no y',
    why: 'No target column means unsupervised. KMeans needs scaled features and a <span class="mono">k</span> you choose — check it with a silhouette score, and remember it will always return clusters, even from pure noise.' },
  { ask: 'Squeeze 300 correlated features down to 2 so you can plot them',
    pick: 'PCA',
    good: 'from sklearn.decomposition import PCA\n\npca = PCA(n_components=2)\nXY = pca.fit_transform(X_scaled)\npca.explained_variance_ratio_.sum()   # how much you kept',
    bad: 'X_small = X.iloc[:, :2]\n# keeping the first two columns is not reduction',
    why: 'PCA is a transformer, not a model — it has <span class="mono">fit_transform</span> and no <span class="mono">predict</span>. Always scale first, and check how much variance survived before you trust the picture.' },
  { ask: 'Classify photographs, or fine-tune a language model',
    pick: 'PyTorch',
    good: 'import torch\nfrom transformers import AutoModelForSequenceClassification\n\nmodel = AutoModelForSequenceClassification.from_pretrained(\n    "distilbert-base-uncased")',
    bad: 'clf = SVC().fit(raw_pixels, y)\n# on 224x224 images this will not end well',
    why: 'This is where scikit-learn stops. Unstructured data — images, audio, free text — wants deep learning, a GPU, and almost always a pretrained model you fine-tune rather than one you train from scratch.' }
];

C.mlTraps = [
  { t: 'Scaling before the split',
    bad: 'X = StandardScaler().fit_transform(X)\nX_train, X_test = train_test_split(X)',
    good: 'X_train, X_test = train_test_split(X)\npipe = make_pipeline(StandardScaler(), LogisticRegression())\npipe.fit(X_train, y_train)',
    why: 'The scaler in the first version learned the mean of the test rows too. Your score goes up and your production performance does not. A Pipeline makes the mistake impossible to express.' },
  { t: 'Accuracy on imbalanced data',
    bad: 'accuracy_score(y_test, y_pred)\n# 0.99 — and the model always answers "no"',
    good: 'from sklearn.metrics import classification_report, average_precision_score\n\nprint(classification_report(y_test, y_pred))\naverage_precision_score(y_test, y_proba)',
    why: 'If 1% of rows are fraud, predicting "not fraud" every time scores 99%. Precision, recall and PR-AUC ask the question you actually care about, one class at a time.' },
  { t: 'Tuning against the test set',
    bad: 'for C in [0.1, 1, 10]:\n    fit(C); score(X_test, y_test)   # pick the best\n# ...then report that best number as the result',
    good: 'GridSearchCV(pipe, grid, cv=5).fit(X_train, y_train)\n# test set touched exactly once, at the very end',
    why: 'Every peek at the test set fits your choices to it a little more. Make every decision with cross-validation inside the training data, and keep the test set for the single final number.' },
  { t: 'A random split on time-ordered data',
    bad: 'train_test_split(X, y, shuffle=True)\n# trains on next March, tests on last June',
    good: 'from sklearn.model_selection import TimeSeriesSplit\n\ncv = TimeSeriesSplit(n_splits=5)',
    why: 'A random split lets the model see the future. If rows carry a timestamp and you will predict forward in time, split forward in time.' },
  { t: 'A perfect score',
    bad: 'model.score(X_test, y_test)\n# 1.00',
    good: '# hunt for a column that encodes the answer\ndf.corr(numeric_only=True)["target"].sort_values()',
    why: 'A perfect score is a bug report, not a result. Almost always a leaked column — <span class="mono">churn_date</span> when predicting churn, or an id that happens to encode when the row was created.' },
  { t: 'No random_state',
    bad: 'train_test_split(X, y)\nRandomForestClassifier()',
    good: 'train_test_split(X, y, random_state=42)\nRandomForestClassifier(random_state=42)',
    why: 'Without it every run gives a different number, and you cannot tell an improvement from noise. Set it anywhere something shuffles, splits or samples.' }
];

C.mlEcosystem = [
  { g: 'tabular ML', name: 'scikit-learn', tag: 'the workhorse',
    what: 'Classical ML behind one consistent API: preprocessing, models, pipelines, cross-validation, metrics.',
    code: 'pip install scikit-learn   # but: import sklearn' },
  { g: 'tabular ML', name: 'XGBoost / LightGBM / CatBoost', tag: 'gradient boosting',
    what: 'The three boosting libraries that win tabular competitions. LightGBM is fastest on wide data; CatBoost handles categories with no encoding.',
    code: 'pip install xgboost lightgbm catboost' },
  { g: 'tabular ML', name: 'statsmodels', tag: 'inference',
    what: 'Regression with p-values, confidence intervals and diagnostics, plus ARIMA and friends for time series.',
    code: 'import statsmodels.api as sm\nsm.OLS(y, sm.add_constant(X)).fit().summary()' },
  { g: 'tabular ML', name: 'imbalanced-learn', tag: 'class imbalance',
    what: 'SMOTE, under- and over-sampling, and a Pipeline that resamples only inside training folds.',
    code: 'from imblearn.pipeline import Pipeline' },
  { g: 'deep learning', name: 'PyTorch', tag: 'the default',
    what: 'Tensors on the GPU with autograd. Most research and most new production models are written in it.',
    code: 'import torch\nx = torch.randn(32, 128).cuda()' },
  { g: 'deep learning', name: 'TensorFlow / Keras', tag: 'batteries included',
    what: 'The other big framework. Keras is the friendly high-level API, and the deployment tooling is mature.',
    code: 'from tensorflow import keras\nmodel = keras.Sequential([...])' },
  { g: 'deep learning', name: 'Hugging Face transformers', tag: 'pretrained models',
    what: 'Thousands of pretrained text, vision and audio models, plus <span class="mono">datasets</span> and <span class="mono">tokenizers</span>.',
    code: 'from transformers import pipeline\npipeline("sentiment-analysis")("great!")' },
  { g: 'deep learning', name: 'ONNX', tag: 'portability',
    what: 'One interchange format for trained models, so you can train in PyTorch and serve somewhere that has never heard of Python.',
    code: 'torch.onnx.export(model, sample, "model.onnx")' },
  { g: 'text, image, audio', name: 'spaCy', tag: 'NLP pipelines',
    what: 'Fast, production-shaped NLP: tokenising, part-of-speech tags, named entities.',
    code: 'import spacy\nnlp = spacy.load("en_core_web_sm")' },
  { g: 'text, image, audio', name: 'NLTK / gensim', tag: 'classic NLP',
    what: 'Teaching-oriented NLP tools and corpora, and topic models such as LDA.',
    code: 'pip install nltk gensim' },
  { g: 'text, image, audio', name: 'Pillow / OpenCV', tag: 'images',
    what: 'Reading, resizing and transforming images. Pillow for simple work, OpenCV for real computer vision.',
    code: 'import cv2\nimg = cv2.imread("x.png")' },
  { g: 'text, image, audio', name: 'librosa', tag: 'audio',
    what: 'Loading audio and turning it into the spectrograms models actually eat.',
    code: 'import librosa\ny, sr = librosa.load("clip.wav")' },
  { g: 'scale + workflow', name: 'Optuna', tag: 'tuning',
    what: 'Smarter hyperparameter search than a grid — it learns which regions are worth trying and prunes bad runs early.',
    code: 'study = optuna.create_study()\nstudy.optimize(objective, n_trials=100)' },
  { g: 'scale + workflow', name: 'MLflow', tag: 'tracking',
    what: 'Logs every run with its parameters, metrics and artefacts, so "which version scored 0.91?" has an answer.',
    code: 'mlflow.log_metric("f1", 0.87)' },
  { g: 'scale + workflow', name: 'Polars / DuckDB', tag: 'bigger data',
    what: 'For when pandas runs out of memory. Polars is a faster DataFrame; DuckDB runs SQL straight over your files.',
    code: 'import polars as pl\npl.scan_csv("huge.csv").filter(...).collect()' },
  { g: 'scale + workflow', name: 'SHAP', tag: 'explainability',
    what: 'Per-prediction feature attributions for any model, including the boosted trees you cannot read.',
    code: 'shap.TreeExplainer(model).shap_values(X)' },
  { g: 'scale + workflow', name: 'joblib', tag: 'persistence',
    what: 'Saving fitted estimators, and easy parallelism across a loop of independent jobs.',
    code: 'joblib.dump(pipe, "model.joblib")' },
  { g: 'scale + workflow', name: 'Streamlit / Gradio', tag: 'demos',
    what: 'A working web UI for your model in about twenty lines, which is usually what "can I see it?" really means.',
    code: 'streamlit run app.py' }
];

/* ---------- Ch11: the plain-English layer ----------
   Every card, stage, quiz and library on the scikit-learn page gets a
   no-jargon gloss, keyed by the item it explains. Kept separate from the
   items themselves so the technical text stays technical.            */
C.plain = {

  /* one everyday story the whole chapter maps onto */
  story: [
    ['the job', 'You are training a new hire to spot which customers are about to cancel, so someone can phone them first.'],
    ['a row', 'One past customer. You have thousands of them.'],
    ['features (X)', 'What you know about that customer before they cancelled: how long they had been with you, what they pay, which plan, which region.'],
    ['label (y)', 'What actually happened: did they cancel, yes or no. You only have this for the past.'],
    ['the model', 'The rule of thumb your new hire ends up with. Not a person, not magic — a formula that turns those facts into an answer.'],
    ['fit / training', 'The afternoon you sit them down with the old files, answers attached, and let them work out the pattern.'],
    ['the test set', 'A stack of old cases you photocopy and lock in a drawer <b>before</b> that afternoon. They never see it while learning.'],
    ['predict', 'Handing them a customer they have never seen and asking for one answer.'],
    ['overfitting', 'They memorised the practice files instead of learning the pattern. Perfect on those, useless on a new one.'],
    ['data leakage', 'The practice files accidentally had the outcome written on the back. They look brilliant and have learned nothing.'],
    ['cross-validation', 'Instead of one quiz, five quizzes, each holding back a different fifth of the files. Consistent marks mean they really know it.'],
    ['hyperparameter', 'A dial you set before training — like telling them how cautious to be. You try a few settings and keep the best.'],
    ['the metric', 'How you mark them. "How many did you get right" is one choice, and often the wrong one.'],
    ['the threshold', 'How sure they must be before they flag someone. Move it and you trade missed cancellations against wasted phone calls.']
  ],

  /* jargon → plain English → an everyday example */
  jargon: [
    ['feature', 'A fact you know about each row, used as an input.', 'a customer’s age, plan, monthly bill'],
    ['label / target', 'The answer you want to predict. You only have it for the past.', 'did they cancel: yes / no'],
    ['supervised', 'You have past answers to learn from.', 'old customers, and whether each one left'],
    ['unsupervised', 'No answers at all — you are looking for structure.', '“do our customers fall into natural groups?”'],
    ['classification', 'The answer is one of a few categories.', 'spam / not spam'],
    ['regression', 'The answer is a number on a scale.', 'the price this house will sell for'],
    ['estimator / model', 'The object that learns and then answers.', 'the trained new hire'],
    ['fit', 'Learn the pattern from examples.', 'the training afternoon'],
    ['predict', 'Give one answer for a new row.', '“this one will probably cancel”'],
    ['transform', 'Tidy the data — same rows, cleaner columns. No answers involved.', 'converting every price to the same currency'],
    ['train / test split', 'Hide some of the past so you can honestly check the model later.', 'photocopy 20% of the files, lock them in a drawer'],
    ['overfitting', 'Learned the examples, not the pattern.', 'memorising past exam papers word for word'],
    ['underfitting', 'Too simple to have learned anything useful.', '“always say no” — never wrong enough to notice'],
    ['data leakage', 'A clue about the answer sneaked into the inputs.', 'a “cancellation_date” column when predicting cancellation'],
    ['cross-validation', 'Repeat the quiz several times on different held-back slices.', 'five mock exams instead of one'],
    ['parameter', 'A number the model works out for itself during training.', '“each extra year of tenure lowers risk by this much”'],
    ['hyperparameter', 'A dial <b>you</b> set before training.', 'how strict / how many trees / how long'],
    ['class imbalance', 'One outcome is far rarer than the other.', '1 in 100 transactions is fraud'],
    ['precision', 'Of the ones you flagged, how many were real.', 'of 50 people you phoned, 30 were really leaving'],
    ['recall', 'Of the real ones, how many you caught.', 'of 40 leavers, you spotted 30'],
    ['threshold', 'How confident the model must be before it says yes.', '“only flag if over 80% sure”'],
    ['pipeline', 'The tidy-up steps stapled to the model so they always run together.', 'a recipe card taped to the machine'],
    ['one-hot encoding', 'Turning a word column into yes/no columns, because models do arithmetic.', '“plan = gold” becomes gold?1 silver?0 bronze?0'],
    ['scaling', 'Putting different units on a comparable footing.', 'age 0–90 and salary 0–90,000 in the same sentence']
  ],

  /* "which model do I use?" as four plain questions, no maths */
  chooser: {
    start: 'q_labels',
    nodes: {
      q_labels: {
        q: 'Do you already have past examples where you know the right answer?',
        hint: 'Old rows with the outcome recorded — customers and whether they left, houses and what they sold for.',
        opts: [
          { a: 'Yes — the outcome is recorded for the past', go: 'q_answer' },
          { a: 'No — nothing is labelled, I am looking for structure', go: 'q_unsup' }
        ]
      },
      q_answer: {
        q: 'What does the answer look like?',
        hint: 'Say the answer out loud for one row. Is it a quantity, or is it a bucket?',
        opts: [
          { a: 'A number on a scale — a price, a count, days remaining', go: 'q_reg_data' },
          { a: 'One of a few labels — yes/no, gold/silver/bronze', go: 'q_clf_data' }
        ]
      },
      q_reg_data: {
        q: 'What is the data, and does anyone need to be told why?',
        hint: 'Rows and columns is one world. Photos, audio and sentences are a different one.',
        opts: [
          { a: 'A table, and I have to explain each prediction', go: 'linreg' },
          { a: 'A table, and I just want the most accurate number', go: 'gbr' },
          { a: 'Photos, audio or free text', go: 'deep' }
        ]
      },
      q_clf_data: {
        q: 'What is the data, and does anyone need to be told why?',
        hint: 'Same fork as before — the shape of the data decides the toolbox.',
        opts: [
          { a: 'A table, and I want a probability I can set a cut-off on', go: 'logreg' },
          { a: 'A table, big and messy, and I want the best accuracy', go: 'gbc' },
          { a: 'Photos, audio or free text', go: 'deep' }
        ]
      },
      q_unsup: {
        q: 'What do you actually want out of it?',
        hint: 'With no answers to learn from, the honest question is what shape of finding would be useful.',
        opts: [
          { a: 'Sort the rows into groups that resemble each other', go: 'kmeans' },
          { a: 'Squash a lot of columns into a few, so I can plot it', go: 'pca' },
          { a: 'Find the handful of rows that do not look like the rest', go: 'iforest' }
        ]
      }
    },
    leaves: {
      linreg: { name: 'Ridge / LinearRegression', tag: 'the explainable one',
        plain: 'The straight-line model. It gives you a number <b>and</b> a sentence per feature — “each extra bedroom is worth about £18,000, holding the rest still”. That sentence is why you pick it: a forest of 500 trees may be a little more accurate and cannot tell you anything.',
        code: 'from sklearn.linear_model import Ridge\n\nmodel = Ridge(alpha=1.0).fit(X_train, y_train)\nmodel.coef_          # one weight per feature',
        watch: 'Watch for: it assumes the effect is a straight line. If doubling the size does not double the price, it will quietly under-fit.' },
      gbr: { name: 'HistGradientBoostingRegressor', tag: 'the accurate one',
        plain: 'Hundreds of small rules of thumb stacked up, each one fixing the mistakes of the last. This is what usually wins on spreadsheet data: it copes with gaps, mixes numbers and categories, and barely cares about scaling.',
        code: 'from sklearn.ensemble import HistGradientBoostingRegressor\n\nmodel = HistGradientBoostingRegressor().fit(X_train, y_train)',
        watch: 'The price: you cannot read it. If someone will ask “why did it say that?”, add SHAP — or start with the straight line and only move here if it is genuinely not good enough.' },
      logreg: { name: 'LogisticRegression', tag: 'the baseline',
        plain: 'Despite the name it answers yes/no — and it gives you a confidence, not just a verdict, so you can decide “only act when we are more than 80% sure”. Move that cut-off and you trade missed cases against false alarms, which is a business decision, not a modelling one.',
        code: 'from sklearn.linear_model import LogisticRegression\n\nclf = LogisticRegression(max_iter=1000).fit(X_train, y_train)\nclf.predict_proba(X_test)[:, 1]      # the confidence',
        watch: 'This is the bar. Every fancier model has to beat this one before it has earned the extra complexity and the extra thing that can break at 3am.' },
      gbc: { name: 'HistGradientBoostingClassifier', tag: 'the accurate one',
        plain: 'Same stack-of-small-rules idea, answering a label instead of a number. On a big messy table of mixed columns this is the strongest thing in scikit-learn, and it handles missing values without you filling them in first.',
        code: 'from sklearn.ensemble import HistGradientBoostingClassifier\n\nclf = HistGradientBoostingClassifier().fit(X_train, y_train)',
        watch: 'Still fit the logistic regression first, on the same split. If the gap is 0.86 against 0.85, take the simple one — you can explain it, and it will not surprise you later.' },
      deep: { name: 'PyTorch + a pretrained model', tag: 'different toolbox',
        plain: 'Photos, audio and sentences are not spreadsheet columns, and this is where scikit-learn stops. The important part is that you almost never start from nothing: you take a model someone already trained on millions of examples and nudge it towards your job with your few thousand.',
        code: 'from transformers import AutoModelForSequenceClassification\n\nmodel = AutoModelForSequenceClassification.from_pretrained(\n    "distilbert-base-uncased", num_labels=2)',
        watch: 'Needs a GPU, more data and more patience. If you can turn the problem into a table of features first, do that and go back to the boring model.' },
      kmeans: { name: 'KMeans', tag: 'grouping',
        plain: 'You tell it how many huddles to look for, and it sorts every row into the nearest one. Useful for “do our customers fall into types?” — as long as you remember nobody has told it what a good grouping is.',
        code: 'from sklearn.cluster import KMeans\n\nlabels = KMeans(n_clusters=4, n_init="auto").fit_predict(X_scaled)',
        watch: 'It will always hand you groups, even from pure noise. Scale the columns first, try a few values of k, and sanity-check the groups against something you already know.' },
      pca: { name: 'PCA', tag: 'squashing',
        plain: 'Turns 300 overlapping columns into 2 or 3 that keep most of the information — like summarising a long CV into two lines. Mostly used to plot something you cannot otherwise see, or to speed up what comes next.',
        code: 'from sklearn.decomposition import PCA\n\npca = PCA(n_components=2)\nXY = pca.fit_transform(X_scaled)\npca.explained_variance_ratio_.sum()   # how much you kept',
        watch: 'Scale first, and always check how much you kept. Two components holding 31% of the variance is a picture of almost nothing.' },
      iforest: { name: 'IsolationForest', tag: 'odd ones out',
        plain: 'Points at the rows that do not look like the others — the unusual transaction, the sensor having a bad day. It is not fraud detection on its own; it is a shortlist for a human to look at.',
        code: 'from sklearn.ensemble import IsolationForest\n\nflags = IsolationForest(contamination=0.01).fit_predict(X)\n# -1 = unusual, 1 = ordinary',
        watch: '“Unusual” is not the same as “wrong”. You are setting how much of the data to call weird with <span class="mono">contamination</span>, so that number is your assumption, not a discovery.' }
    },
    always: 'Whatever it lands on: <b>fit the simple version first</b>, and decide how you will be marked <i>before</i> you look at any score. A boring model you can explain, shipped this week, beats a clever one still being tuned.'
  },

  api: {
    'fit(X, y)': 'The training afternoon. You hand over thousands of past customers <b>with the answers attached</b> and let the model work out the pattern. Nothing is predicted here — it is only learning.',
    'predict(X)': 'Now hand it one customer it has never seen and ask for a single answer. Same shape of facts in, one verdict out.',
    'transform(X)': 'Not an answer — a tidy-up. Like converting every receipt to the same currency before you compare them: same receipts, comparable numbers.',
    'fit_transform(X)': 'Work out the exchange rate from the <b>training</b> receipts (fit), then convert them (transform). Test receipts get converted using that same rate — you never recalculate it from the pile you are supposed to be predicting.',
    'score(X, y)': 'One number for “how did it do”, like a single exam mark. Handy, and it quietly hides which questions were failed and how badly.'
  },

  pipe: {
    'split': 'Photocopy a fifth of last year’s cases and lock them in a drawer. Nobody opens the drawer until the very last step — that is the whole trick.',
    'preprocess': 'Numbers and words need different tidying. Ages and bills get put on a comparable scale; “plan type” becomes a row of yes/no boxes, because a model can only do arithmetic — it cannot read the word “gold”.',
    'Pipeline': 'Staple the tidy-up instructions to the model itself. Now the same tidy-up happens every single time — while training, while testing, and at 3am in production — because it is physically part of the same object.',
    'fit': 'The training afternoon, run as one command. Each tidy-up step happens in order, then the model learns. Notice there is nowhere for the drawer to sneak in.',
    'cross-validate': 'Five quizzes instead of one, each holding back a different fifth of the training files. Marks of 81, 80, 82, 79, 83 mean it knows the job. Marks of 95, 62, 88, 70, 91 mean it got lucky once.',
    'tune': 'How cautious should it be? Try three settings, mark each one with the quiz, keep the best. The drawer stays shut the whole time.',
    'evaluate': 'Open the drawer. This is the real exam, sat once. Any number you produce after peeking in here is no longer an honest estimate of anything.',
    'save': 'Put the trained model — tidy-up instructions included — into a box. Tomorrow you take it out ready to work instead of retraining from scratch.'
  },

  pick: {
    'Predict a house price from ten numeric features, and explain which feature moved it':
      'You want a <b>number</b>, and you want to be able to say “each extra bedroom adds about £18,000”. A straight-line model hands you that sentence directly; a forest of 500 trees does not.',
    'Flag whether an email is spam, and get a probability you can threshold':
      'You want <b>yes/no plus a confidence</b>, so you can decide “only bin it if we are more than 90% sure”. A model that answers 1.4 or −0.2 to a yes/no question is answering the wrong question.',
    'Best possible accuracy on a messy 200k-row table of mixed numbers and categories':
      'Lots of rows, mixed columns, gaps everywhere, and nobody needs an explanation for each decision. This is the workhorse that simply wins on spreadsheet-shaped data.',
    'Split customers into groups when nobody has labelled anything':
      'Nobody has told you what the groups are — you are asking “do our customers fall into natural huddles?”. Be warned: it will always hand you huddles, even if the data is pure noise.',
    'Squeeze 300 correlated features down to 2 so you can plot them':
      '300 columns and you want one flat picture. Like summarising a long CV into two lines that keep most of what mattered — some detail is gone, and you should check how much.',
    'Classify photographs, or fine-tune a language model':
      'Photos and sentences are not spreadsheet columns. Different tool entirely — and you start from a model someone else already trained on millions of examples, rather than starting from nothing.'
  },

  trap: {
    'Scaling before the split': 'You worked out the class average using the exam papers as well as the homework. The average now has the exam baked into it, so the mark it produces is flattering and fake.',
    'Accuracy on imbalanced data': 'A doctor who tells everyone “you’re fine” is right 99% of the time in a healthy town, and completely useless. The 99% is measuring the town, not the doctor.',
    'Tuning against the test set': 'Sitting the same exam over and over, tweaking after each attempt, then reporting your best mark as your ability. The exam stopped measuring you the second time you sat it.',
    'A random split on time-ordered data': 'Studying next year’s news to predict last year’s. Brilliant on paper, impossible in real life — and in production you only ever have the past.',
    'A perfect score': 'If someone scores 100%, the answer key was stapled to the question paper. Go and find the column that gives it away, because it will not exist when the model goes live.',
    'No random_state': 'Weighing yourself on a different set of scales every morning, then arguing about whether you lost 200 grams. Pin the scales down before you measure anything.'
  },

  eco: {
    'scikit-learn': 'The standard toolbox — and every tool in it is held the same way, which is why it is worth learning first.',
    'XGBoost / LightGBM / CatBoost': 'The tools that win spreadsheet competitions. Same idea as scikit-learn’s boosting, with more dials and more speed.',
    'statsmodels': 'For when the question is “is this effect real?” rather than “what happens next?”. This is the stats-class end of the room.',
    'imbalanced-learn': 'For when the thing you care about is rare — fraud, a rare disease, the customer about to leave.',
    'PyTorch': 'The workshop where you build the machine yourself, on a graphics card. Where photos, audio and language live.',
    'TensorFlow / Keras': 'The other big workshop. Keras is the friendly front desk on top of it.',
    'Hugging Face transformers': 'A library of models someone else already trained, ready to borrow. Almost always cheaper than training your own.',
    'ONNX': 'A universal plug: train the model in one place, run it somewhere that has never heard of Python.',
    'spaCy': 'Turns a paragraph into labelled pieces — who is mentioned, which word is the verb, where the dates are.',
    'NLTK / gensim': 'The older text toolkit. Still what most textbooks and courses use.',
    'Pillow / OpenCV': 'Opening and resizing pictures. Pillow for simple jobs, OpenCV when the computer actually has to see something.',
    'librosa': 'Turns sound into a picture, because that is the form models can actually read.',
    'Optuna': 'Tries dial settings intelligently instead of trying all of them, and gives up early on bad ones.',
    'MLflow': 'The lab notebook. Answers “which run produced that 0.91, and what was it set to?” three weeks later.',
    'Polars / DuckDB': 'For when the spreadsheet no longer fits in memory and pandas starts crawling.',
    'SHAP': 'Asks the model “which facts made you say that?” about one single decision — the closest thing to an explanation for a model you cannot read.',
    'joblib': 'Saves the trained model to a file, so tomorrow you load it instead of retraining it.',
    'Streamlit / Gradio': 'A clickable web page for your model in about twenty lines, which is what “can I have a look?” usually means.'
  }
};

/* ---------- Ch12: gotchas ---------- */
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

/* ---------- Ch13: quiz + glossary ---------- */
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
  { q: 'Why must a scaler be fitted on the training set only?', o: ['It is faster', 'Fitting on all the data leaks test information into the model', 'Scalers cannot handle two datasets', 'It avoids a TypeError'], a: 1,
    e: 'Fitting on everything means the mean and standard deviation carry information from the test rows. The score goes up, production does not. A Pipeline makes it impossible to get wrong.' },
  { q: 'What does <span class="mono">pipe.fit(X, y)</span> do to a Pipeline?', o: ['Fits only the last step', 'fit_transform on every step in order, then fit on the final estimator', 'Nothing until you call predict', 'Fits every step on the test data too'], a: 1,
    e: 'Each transformer learns and transforms in turn, and the final estimator trains on the result. At predict time the same steps run with transform only.' },
  { q: 'Which command installs scikit-learn?', o: ['pip install sklearn', 'pip install scikit-learn', 'pip install scikit', 'pip install sci-kit-learn'], a: 1,
    e: 'The package is scikit-learn; the import name is sklearn. They differ, and pandas/PIL do the same thing (pillow imports as PIL).' },
  { q: 'Your fraud model scores 99% accuracy on data that is 1% fraud. What now?', o: ['Ship it', 'Check precision and recall — it may be predicting "not fraud" every time', 'Add more features', 'Lower the learning rate'], a: 1,
    e: 'Always answering the majority class scores 99% on a 99:1 split. Per-class precision, recall and PR-AUC are what tell you whether it found anything.' },
  { q: 'Why is <span class="mono">(arr * arr).sum()</span> so much faster than the same loop over a list?', o: ['NumPy caches results', 'One typed contiguous buffer, and the loop runs in C instead of the interpreter', 'It uses every CPU core', 'Lists are stored on disk'], a: 1,
    e: 'A list holds a million pointers to boxed objects and pays interpreter overhead each iteration. An array is one flat block of numbers handed to a C loop.' },
  { q: 'What does <span class="mono">df.groupby("dept")["salary"].mean()</span> return?', o: ['A DataFrame of every row', 'A Series indexed by dept', 'A dict', 'A single float'], a: 1,
    e: 'Split, apply, combine: one row per group, with the grouping column as the index. Use .agg([...]) when one aggregate is not enough.' },
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
  ['ndarray', 'The NumPy array: one type, one flat block of memory, maths applied to all of it at once.'],
  ['Vectorisation', 'Replacing a Python loop with one array-wide operation that runs in C.'],
  ['Broadcasting', 'NumPy stretching a smaller array across a bigger one so shapes line up without copying.'],
  ['DataFrame', 'The pandas table: named columns, an index, mixed dtypes. A single column is a Series.'],
  ['Feature / target', 'X is what the model sees, y is what it must predict. Rows in X map one-to-one to y.'],
  ['Estimator', 'Any scikit-learn object with fit. Add predict and it is a model; add transform and it is a transformer.'],
  ['fit / predict / transform', 'Learn from training data / answer for new rows / turn features into other features.'],
  ['Pipeline', 'Preprocessing plus a model as one estimator, so the steps can never be applied inconsistently.'],
  ['Train/test split', 'Data held back and untouched until the final score. Touch it once.'],
  ['Cross-validation', 'Repeated train/validate splits inside the training set. The spread matters as much as the mean.'],
  ['Data leakage', 'Information from the test set, or from the future, reaching training. The cause of most impossible scores.'],
  ['Overfitting', 'Memorising the training set. Training score high, test score low.'],
  ['Feature scaling', 'Centring and rescaling columns. Needed by linear models, SVMs, KMeans and PCA; ignored by trees.'],
  ['One-hot encoding', 'One 0/1 column per category, because a model cannot multiply the word "sales".'],
  ['Hyperparameter', 'A setting you choose rather than one the model learns. Tuned with cross-validation, never on the test set.'],
  ['Gradient boosting', 'Trees fitted one after another on the previous errors. Usually the best answer on tabular data.'],
  ['Tensor', 'The deep-learning array: like an ndarray, but it lives on a GPU and records gradients.'],
  ['pip', 'The package installer. Prefer python -m pip so you install into the interpreter you are running.']
];
