/* ============================================================
   tools.js — "the tools people actually use for this".
   Rendered by js/toolstrip.js into any <div data-toolstrip="KEY">.
   ============================================================ */
C.toolstrips = C.toolstrips || {};

/* ---------- Ch: files & projects ---------- */
C.toolstrips.projects = {
  title: 'Tools & frameworks — the project toolchain',
  sub: 'The unglamorous half of being employable. An interviewer notices immediately whether you have opinions here.',
  tools: [
    { n: 'uv', by: 'Astral', mark: 'uv', c: '#de5fe9',
      what: 'A Rust package and environment manager that replaces pip, venv, pip-tools and pyenv, ten to a hundred times faster.',
      pro: ['Installs in seconds, so CI gets dramatically faster', 'One tool for environments, dependencies and Python versions', 'Lockfile by default, so builds are reproducible'],
      con: ['Young enough that some corporate mirrors lag', 'Another tool in a crowded space'],
      use: 'New projects. It is the current default answer and shows you are up to date.' },
    { n: 'Poetry', by: 'Poetry', mark: 'po', c: '#60a5fa',
      what: 'Declarative dependencies and locking in pyproject.toml, with building and publishing included.',
      pro: ['Mature and widely adopted, so colleagues know it', 'Real dependency resolution with a lockfile', 'Handles packaging and publishing too'],
      con: ['Resolution can be slow on large trees', 'Has historically disagreed with pip about standards'],
      use: 'Existing projects that already use it, and libraries you will publish.' },
    { n: 'Ruff', by: 'Astral', mark: 'rf', c: '#de5fe9',
      what: 'A Rust linter and formatter replacing flake8, isort, black and most of their plugins.',
      pro: ['Fast enough to run on every keystroke', 'One config replaces four tools', 'Autofixes most of what it finds'],
      con: ['A few niche plugin rules are still missing', 'Formatter output differs from black in rare edge cases'],
      use: 'Every project. Lint and format arguments should be settled by a tool, not a review.' },
    { n: 'pytest', by: 'pytest', mark: 'pt', c: '#009688',
      what: 'Tests are plain functions with plain assert. Fixtures handle setup without inheritance.',
      pro: ['Least ceremony of any test framework', 'Fixtures compose, so setup is not copy-pasted', 'Parametrize turns one test into fifty cases'],
      con: ['Fixture resolution is magical until you learn it', 'Overusing conftest.py hides where setup came from'],
      use: 'Every project. "How do you test this" is a question you will be asked.' },
    { n: 'pathlib', by: 'Python standard library', mark: '📁', c: '#3776ab',
      what: 'Paths as objects with operators, instead of string concatenation and os.path calls.',
      pro: ['Works identically on Windows and POSIX', 'The / operator makes path building readable', 'read_text and write_text remove most boilerplate'],
      con: ['A few old APIs still want strings', 'Mixing os.path and pathlib in one file reads badly'],
      use: 'Any time you touch the filesystem. os.path.join is a code smell in new code.' }
  ]
};

/* ---------- Ch: the data stack ---------- */
C.toolstrips.datastack = {
  title: 'Tools & frameworks — the data stack',
  sub: 'Five libraries carry almost all Python data work. Knowing where each one stops is more useful than knowing more of their APIs.',
  tools: [
    { n: 'NumPy', by: 'NumPy', mark: 'np', c: '#4d77cf',
      what: 'The typed contiguous array everything else is built on, with vectorised operations over it.',
      pro: ['Vectorised code is often a hundred times faster than a loop', 'Broadcasting removes most explicit loops entirely', 'Every other library speaks its array'],
      con: ['Views versus copies causes silent aliasing bugs', 'Everything must fit in memory'],
      use: 'Any numeric work. If you wrote a for loop over numbers, there is a faster way.' },
    { n: 'pandas', by: 'pandas', mark: '🐼', c: '#150458',
      what: 'Labelled tables with joins, group-bys, time series and readers for every format.',
      pro: ['Enormously expressive for exploration and reshaping', 'The format everything else reads and writes', 'Fast enough to a few million rows'],
      con: ['Chained assignment and copy semantics bite everyone once', 'Memory use is several times the file size'],
      use: 'Exploration, cleaning and feature work up to a few million rows.' },
    { n: 'Polars', by: 'Polars', mark: 'pl', c: '#0f172a',
      what: 'A Rust DataFrame with a lazy query optimiser and true multi-core execution.',
      pro: ['Several times faster than pandas and far lighter on memory', 'Lazy mode optimises the whole query before running it', 'Streaming handles data larger than RAM'],
      con: ['Different API, so knowledge does not transfer directly', 'Smaller ecosystem of downstream integrations'],
      use: 'pandas is the bottleneck, or the file no longer fits comfortably in memory.' },
    { n: 'Matplotlib', by: 'Matplotlib', mark: '📊', c: '#11557c',
      what: 'The plotting substrate. Verbose, complete, and underneath almost every other Python chart.',
      pro: ['Control over every element of the figure', 'Publication-quality output in any format', 'Every other plotting library falls back to it'],
      con: ['Verbose for simple charts', 'Two APIs (pyplot and object-oriented) confuse newcomers'],
      use: 'When you need exact control, or to fix what a higher-level library got wrong.' },
    { n: 'seaborn', by: 'seaborn', mark: 'sn', c: '#4c72b0',
      what: 'Statistical plots in one line from a DataFrame, with sensible defaults on top of Matplotlib.',
      pro: ['Distribution and relationship plots in a single call', 'Faceting by a column with one argument', 'Defaults that look right without fiddling'],
      con: ['Customisation drops you back into Matplotlib', 'Opinionated about tidy data shape'],
      use: 'Exploratory analysis, where you want the picture before you want the polish.' }
  ]
};

/* ---------- Ch: gotchas ---------- */
C.toolstrips.gotchas = {
  title: 'Tools & frameworks — catching the gotchas',
  sub: 'Every trap in this chapter has a tool that catches it before review does. That is the actual answer to "how do you avoid these".',
  tools: [
    { n: 'mypy', by: 'Python community', mark: 'my', c: '#3776ab',
      what: 'Static type checking from your annotations, run in CI like a test.',
      pro: ['Catches None-handling and wrong-argument bugs before runtime', 'Annotations double as documentation that cannot go stale', 'Strictness is a dial, so adoption can be gradual'],
      con: ['Gradual typing means partial coverage gives partial safety', 'Third-party stubs are sometimes missing or wrong'],
      use: 'Any codebase more than one person maintains.' },
    { n: 'Ruff', by: 'Astral', mark: 'rf', c: '#de5fe9',
      what: 'Flags mutable default arguments, unused variables, shadowed builtins and a few hundred more.',
      pro: ['Catches the classic def f(x, acc=[]) bug automatically', 'Fast enough to run on save', 'Autofixes most findings'],
      con: ['Some rules need per-project tuning to avoid noise', 'Cannot catch logic errors, only shapes'],
      use: 'Every project, in CI and in the editor.' },
    { n: 'pytest', by: 'pytest', mark: 'pt', c: '#009688',
      what: 'The place a gotcha becomes a permanent regression test instead of a lesson you forget.',
      pro: ['Parametrize covers the edge cases the bug lived in', 'Fixtures make setup reusable rather than copied', 'Runs in CI so the bug cannot return'],
      con: ['Tests that assert on implementation break constantly', 'Slow suites stop being run'],
      use: 'Every bug you fix. One failing test first, then the fix.' },
    { n: 'copy.deepcopy', by: 'Python standard library', mark: '⧉', c: '#7c5cff',
      what: 'The explicit answer to shared mutable state, where a shallow copy silently is not one.',
      pro: ['Removes an entire class of aliasing bug', 'In the standard library, so no dependency', 'Explicit at the call site, so intent is visible'],
      con: ['Slow on large structures', 'Reaching for it often means the design should not share state at all'],
      use: 'Passing a nested structure somewhere that will mutate it.' },
    { n: 'dataclasses / Pydantic', by: 'stdlib / Pydantic', mark: '{}', c: '#e92063',
      what: 'Structured records with defaults handled correctly, instead of dictionaries and positional tuples.',
      pro: ['field(default_factory=list) is the fix for the mutable default trap', 'Attribute access catches typos that dictionary keys hide', 'Pydantic validates at the boundary as well'],
      con: ['Pydantic v1 and v2 differ significantly', 'Overkill for a two-key throwaway dictionary'],
      use: 'Any structure passed between functions or across a boundary.' }
  ]
};
