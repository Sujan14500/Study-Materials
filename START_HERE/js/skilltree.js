/* ============================================================
   skilltree.js — the "AI agent developer skills" tree that goes
   round on social media, with the two things those posters never
   have: what each skill actually means when someone tests you on
   it, and which course here teaches it.

   Self-mounting: put <div id="skilltree"></div> in the page.

   Every leaf names a course id from roadmap.js, so a renamed or
   deleted course fails test.js rather than leaving a dead branch.

   The last branch is deliberately not on the poster. Evaluation,
   observability and cost are what separate someone who has built
   an agent from someone who has watched one run in production,
   and no skills tree on the internet includes them.
   ============================================================ */
(function () {
'use strict';

const TREE = [
  { id: 'found', n: 'Foundations', ico: '📚', c: '#34d399',
    why: 'None of this is AI. All of it is what an AI codebase is made of, and it is where interviews start when they want to know whether you can actually ship.',
    leaves: [
      { n: 'Python', ico: '🐍', course: 'python',
        what: 'Generators, async, typing and context managers. Half the data questions in an interview are answered by "I would stream it with a generator", and the other half by "I would run those concurrently".' },
      { n: 'Async & concurrency', ico: '⇉', course: 'python',
        what: 'Every AI pipeline is mostly waiting on the network. Knowing when to await, when to gather and when a thread pool is the wrong tool is worth more than any framework.' },
      { n: 'Git', ico: '🌿', course: 'python',
        what: 'Branches, rebases and a history someone can read six months later. Never the subject of an interview question and always the subject of a first impression when they look at your repository.' },
      { n: 'Data structures', ico: '🧮', course: 'dsa',
        what: 'Hash tables and heaps come straight back as inverted indexes and top-k selection. The coding round is still real.' }
    ] },

  { id: 'llm', n: 'The models', ico: '🧠', c: '#7c5cff',
    why: 'Not "which provider do you like" — what the thing actually does, and what that costs you per request.',
    leaves: [
      { n: 'Tokens & embeddings', ico: '🔤', course: 'genai',
        what: 'What you are billed for and what similarity is computed over. Everything downstream is a consequence of these two.' },
      { n: 'Attention & transformers', ico: '🕸️', course: 'genai',
        what: 'One block, honestly understood, answers a dozen interview questions — context limits, KV cache, prefill versus decode, why the first token is slow.' },
      { n: 'Prompting & context', ico: '✍️', course: 'genai',
        what: 'Few-shot, chain of thought, structured output, and knowing that a context window is a budget rather than a bucket.' },
      { n: 'Fine-tuning vs RAG', ico: '🎓', course: 'genai',
        what: 'The most common architecture question in the field. Fine-tune for behaviour, retrieve for facts — and be able to say why.' },
      { n: 'Provider APIs', ico: '🔌', course: 'tooling',
        what: 'GPT, Claude, Gemini, Llama and the open-weight stack. What differs is context, tool calling, caching and price, not vibes.' }
    ] },

  { id: 'frame', n: 'Frameworks', ico: '⚙️', c: '#22d3ee',
    why: 'A framework is a set of defaults. The interview question is always "what does it do for you, and what would you write yourself?"',
    leaves: [
      { n: 'LangChain', ico: '🔗', course: 'langchain',
        what: 'Loaders, splitters, retrievers and LCEL. Worth knowing well enough to say which parts you would keep and which you would replace with forty lines.' },
      { n: 'LangGraph', ico: '🕹️', course: 'langgraph',
        what: 'State, cycles, checkpointing, interrupts and time travel. Durable interrupts are what make human-in-the-loop real rather than aspirational.' },
      { n: 'LlamaIndex & the rest', ico: '🦙', course: 'tooling',
        what: 'Where each framework is genuinely strong, and when a plain loop with a tool schema beats all of them.' }
    ] },

  { id: 'agent', n: 'Agent skills', ico: '🤖', c: '#fb923c',
    why: 'The centre of the tree, and the part most posters get wrong: an agent is a loop with tools and a budget, not a personality.',
    leaves: [
      { n: 'The agent loop', ico: '🔁', course: 'agentic',
        what: 'Think, act, observe, repeat — with a step budget, a stop condition and a way to notice it is going nowhere.' },
      { n: 'Tool & function calling', ico: '🔧', course: 'agentic',
        what: 'The schema is prompt engineering. A vague description is the number one reason a model never calls your tool.' },
      { n: 'RAG', ico: '📚', course: 'genai',
        what: 'Chunking, hybrid retrieval, reranking and grounding. Retrieval quality is the product; no model or prompt rescues a chunk that was never retrieved.' },
      { n: 'Memory', ico: '🧷', course: 'agentic',
        what: 'Four stores with four lifetimes, and a write path that is a privilege-escalation surface if you let it be.' },
      { n: 'Multi-agent', ico: '👥', course: 'agentic',
        what: 'Mostly a way to lose context at handoffs. Know when it helps — independent, read-only work — and be sceptical out loud.' },
      { n: 'MCP', ico: '🔌', course: 'tooling',
        what: 'The tool port. Three primitives, two transports, and a supply-chain risk everyone forgets to mention.' }
    ] },

  { id: 'data', n: 'Storage & retrieval', ico: '🗄️', c: '#60a5fa',
    why: 'The database question is never "which vector store" — it is "what does correct mean here, and what does it cost".',
    leaves: [
      { n: 'Vector databases', ico: '🧭', course: 'tooling',
        what: 'Pinecone, Qdrant, Chroma, FAISS, pgvector. Choose on filtering, scale, operational burden and whether the vectors want to live beside your other data.' },
      { n: 'Vector indexes', ico: '🕸️', course: 'sysdesign',
        what: 'HNSW, IVF, PQ, binary. The arithmetic that picks one is bytes-per-vector × vectors × replicas, and it is decided before anyone has an opinion.' },
      { n: 'Keyword search', ico: '🔎', course: 'sysdesign',
        what: 'BM25, inverted indexes, analyzers. The lane that finds the error code your embedding model cannot see.' },
      { n: 'SQL & pipelines', ico: '🐘', course: 'sysdesign',
        what: 'Text-to-SQL for anything involving counting, and ingestion that is idempotent because it will be re-run.' }
    ] },

  { id: 'ship', n: 'Shipping it', ico: '🚀', c: '#facc15',
    why: 'Where a prototype becomes a system somebody is paged about at three in the morning. Prototype thinking asks whether it works; this branch asks whether it keeps working when the provider does not.',
    leaves: [
      { n: 'APIs & serving', ico: '🌐', course: 'sysdesign',
        what: 'FastAPI end to end: why an async handler with a blocking call inside is slower than a plain def, Pydantic as the guarantee a prompt cannot give, streaming versus a job id, and the four timeouts where the smallest one wins.' },
      { n: 'Docker & deployment', ico: '🐳', course: 'projects',
        what: 'Reproducible images, secrets that are not in the repo, and a rollback you have actually tested.' },
      { n: 'Latency & cost', ico: '⏱️', course: 'sysdesign',
        what: 'Budgets at p95, caching layers, model routing and the arithmetic of cost per successful task.' },
      { n: 'Reliability', ico: '🧯', course: 'sysdesign',
        what: 'Timeouts, retries with jitter, circuit breakers, queues, graceful degradation — a nondeterministic dependency you do not control.' }
    ] },

  { id: 'grown', n: 'The branch the posters leave off', ico: '⚖️', c: '#fb7185',
    why: 'Every skills tree on the internet stops at "deploy". These four are what the second interview is about, and what the job is actually made of.',
    leaves: [
      { n: 'Evaluation', ico: '📏', course: 'interview',
        what: 'A golden set, retrieval metrics, an LLM judge you have calibrated, and offline evals that predict online behaviour. Without this you tune prompts in the dark.' },
      { n: 'Observability', ico: '📡', course: 'agentic',
        what: 'Traces per step, cost per successful task, and the understanding that a green dashboard says nothing about whether the answer was right.' },
      { n: 'Safety & guardrails', ico: '🛡️', course: 'agentic',
        what: 'Injection, jailbreaks, tenant isolation and least privilege at the tool boundary — the layer that decides whether a jailbreak is embarrassing or expensive.' },
      { n: 'Taking systems apart', ico: '🔬', course: 'projects',
        what: '"Tell me about something you shipped" is the highest-signal question in the interview, and the only preparation for it is having built one.' }
    ] }
];

if (typeof window !== 'undefined') window.SKILLTREE = TREE;

/* ============================================================
   rendering
   ============================================================ */
const root = typeof document !== 'undefined' && document.getElementById('skilltree');
if (!root) return;

const COURSES = (typeof window !== 'undefined' && window.COURSES) || {};
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let open = null;

function paint() {
  root.innerHTML =
    '<div class="st-tree">' + TREE.map((b, bi) =>
      '<div class="st-branch" style="--c:' + b.c + ';--d:' + (bi * 0.12) + 's">' +
        '<div class="st-bh"><span>' + b.ico + '</span><b>' + esc(b.n) + '</b></div>' +
        '<div class="st-leaves">' + b.leaves.map((l, li) => {
          const id = b.id + ':' + li;
          return '<button class="st-leaf' + (open === id ? ' on' : '') + '" data-l="' + id + '" ' +
            'style="--d:' + (bi * 0.12 + li * 0.05) + 's">' + l.ico + ' ' + esc(l.n) + '</button>';
        }).join('') + '</div>' +
      '</div>').join('') + '</div>' +
    '<div class="st-detail">' + detail() + '</div>';

  root.querySelectorAll('.st-leaf').forEach(b => b.onclick = () => {
    open = open === b.dataset.l ? null : b.dataset.l;
    paint();
  });
}

function detail() {
  if (!open) {
    return '<div class="st-empty"><b>Pick any skill.</b> Each one says what it means when somebody ' +
      'tests you on it, and opens the course here that covers it. The last branch is the one ' +
      'no skills poster includes — and it is where the second interview lives.</div>';
  }
  const [bid, li] = open.split(':');
  const b = TREE.find(x => x.id === bid), l = b.leaves[+li];
  const c = COURSES[l.course];
  return '<div class="st-card" style="--c:' + b.c + '">' +
    '<div class="st-ct"><span>' + l.ico + '</span><div><b>' + esc(l.n) + '</b>' +
      '<i>' + b.ico + ' ' + esc(b.n) + '</i></div></div>' +
    '<p>' + esc(l.what) + '</p>' +
    '<div class="st-why"><b>Why this branch is here.</b> ' + esc(b.why) + '</div>' +
    (c ? '<a class="btn st-go" href="' + c.href + '">' + c.i + ' ' + esc(c.n) + ' &rarr;</a>' : '') +
  '</div>';
}

paint();
})();
