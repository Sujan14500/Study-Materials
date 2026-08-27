/* ============================================================
   RAG — retrieval, chunking, hybrid search, evaluation, failure modes.
   The largest bank, because this is where most AI-engineer
   interviews spend their time.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'rg01', topic: 'rag', level: 1,
  q: 'What is RAG and why does it exist?',
  lay: 'Instead of hoping the model remembers your company handbook, you look up the relevant pages at question time and paste them into the prompt. The model then answers from the pages instead of from memory — so it can cite them, and you can update them.',
  tech: 'Retrieval-Augmented Generation: chunk documents, embed them, index them, retrieve the top-k relevant chunks for a query, place them in the prompt and generate an answer grounded in them. It exists because parametric knowledge is frozen at training time, unciteable, undeletable and not permission-scoped. RAG makes knowledge non-parametric: fresh (update the index), attributable (you know which chunk you sent), removable (delete the row) and access-controlled (filter before retrieval).',
  dgm: { nodes: ['question', 'embed', { t: 'search', s: 'top-k', k: 'alt' }, 'rerank', 'stuff prompt', 'generate + cite'],
    cap: 'Index time: load → chunk → embed → store. Query time: the flow above.' },
  trap: '"Does RAG stop hallucination?" It reduces it and does not eliminate it. The model can still misread the context, blend two chunks, or answer from parametric memory when retrieval returns nothing — which is why empty-retrieval handling and faithfulness checking are part of the system, not optional extras.',
  tags: ['rag', 'basics'] },

{ id: 'rg02', topic: 'rag', level: 2,
  q: 'Why is embedding-based semantic search not enough for production RAG?',
  lay: 'Meaning-matching is brilliant at "when do I get my money back" and useless at "error E-4055", because to an embedding model every error code looks roughly the same. It is also weak on numbers, blind to negation, clueless about jargon coined last week, bad at filtering, and it cannot explain why it ranked anything.',
  tech: 'Concrete failure classes: <ul><li><b>Exact identifiers</b> — SKUs, error codes, order ids, function names. Almost no semantic signal; BM25 nails them with huge inverse document frequency.</li><li><b>Numbers and negation</b> — "5 days" and "50 days" embed almost identically; "refundable" and "not refundable" are close neighbours.</li><li><b>New jargon</b> — a term coined after the embedding model was trained has no meaningful position.</li><li><b>Recall ceiling</b> — one embedding of one question, searched one way, has a hard limit. Multi-part questions sit in the average of two meanings and retrieve neither well.</li><li><b>Filtering and aggregation</b> — "invoices over £10k from Q3" is a structured query, not a similarity search.</li><li><b>Explainability</b> — a cosine of 0.83 is not a reason.</li></ul>The production answer is hybrid retrieval (dense + lexical, fused with reciprocal rank fusion), a cross-encoder reranker, metadata filters, and query rewriting.',
  trap: 'The rebuttal to "just use a better embedding model": a better embedder raises the ceiling and does not change the shape. Exact-identifier matching is not a quality problem, it is a category problem.',
  tags: ['rag', 'hybrid'], orig: 9 },

{ id: 'rg03', topic: 'rag', level: 1,
  q: 'What are chunks, and why not just index whole documents?',
  lay: 'A whole document is too big to put in a prompt and too vague to match a question — a 40-page manual is "about" everything and specifically about nothing. So you cut it into pieces small enough to be precise and big enough to answer.',
  tech: 'A chunk is the unit of retrieval and the unit of context. Whole-document embedding dilutes the signal: one vector averaging forty pages sits near nothing in particular. Too-small chunks retrieve precisely and answer incompletely. The tension between those two is the entire subject, and the parent-child pattern is the standard resolution: index small children for precision, return large parents for completeness.',
  trap: 'Chunk size is not an opinion, it is an experiment. Sweep 128/256/512/1024 tokens and 0/10/20% overlap against a 50-question eval set, read recall@10, and the argument is over in an afternoon.',
  tags: ['chunking'], orig: 24 },

{ id: 'rg04', topic: 'rag', level: 2,
  q: 'What are the six types of chunking, and when do you use each?',
  lay: 'Cut every N characters. Cut every N with a bit of overlap so nothing falls in the gap. Cut at paragraphs, then sentences, then words if you must. Cut at the headings. Cut where the topic changes. Or cut small for searching and big for answering.',
  tech: 'The six, in the order you would try them:',
  compare: { cols: ['Fixed', 'Fixed + overlap', 'Recursive', 'Document-aware', 'Semantic', 'Parent-child'],
    rows: [
      ['Cuts on', 'a character or token count', 'the same, with a stride overlap', 'paragraph → sentence → word', 'headings, DOM, PDF outline, code AST', 'embedding distance between sentences', 'small children, large parents'],
      ['Index cost', 'lowest', 'low', 'low', 'medium — needs a parser', 'high — an embedding per sentence', 'medium — two stores'],
      ['Respects meaning', 'no', 'barely', 'punctuation only', 'structure', 'yes', 'via the parent'],
      ['Best for', 'logs, transcripts', 'the safe default', 'general prose', 'manuals, contracts, code', 'unstructured mixed-topic text', 'almost everything, if you can afford it'],
      ['Main failure', 'cuts sentences in half', 'duplicates content', 'blind to topic', 'one huge section still needs splitting', 'threshold needs tuning per corpus', 'parents blow the context budget']
    ] },
  trap: 'Recursive with 10–20% overlap is the right default on day one. Move to document-aware the moment your corpus has real structure, and prepend the heading path to every chunk — that one line is worth more than most splitter tuning.',
  tags: ['chunking'], orig: 35,
  xref: [['Run all six splitters live on one document', '../genai_flow/index.html']] },

{ id: 'rg05', topic: 'rag', level: 2,
  q: 'What is parent-child (small-to-big) retrieval?',
  lay: 'Search with small precise snippets, but hand the model the whole surrounding section. You get the accuracy of a small chunk and the completeness of a big one.',
  tech: 'Index small child chunks (~100–200 tokens) for retrieval precision; each child stores a pointer to a larger parent (~800–1500 tokens). Retrieve on children, deduplicate by parent, return parents to the LLM. It resolves the core tension of chunking directly. Costs: two stores to keep in sync, and parents can blow your context budget when k is large — so deduplicate and cap the number of distinct parents. A variant, sentence-window retrieval, indexes single sentences and returns a window of surrounding sentences.',
  trap: 'Deduplicate by parent id after retrieval. Without it, five children of the same parent return the same parent five times and you have wasted 80% of your context budget.',
  tags: ['chunking', 'retrieval'], orig: 47 },

{ id: 'rg06', topic: 'rag', level: 3,
  q: 'What is contextual retrieval and why does it work so well?',
  lay: 'Before storing a chunk, ask a cheap model to write one or two sentences explaining where it came from and what it is about, and glue that to the front. Now a chunk that says "it takes 5 to 10 days" also says "this is from the Processing Time section of the refund policy, about card refunds".',
  tech: 'Anthropic\'s approach: for each chunk, prompt a cheap model with the whole document plus the chunk and ask for a short situating preamble; prepend it before embedding and before BM25 indexing. Reported roughly a 35% reduction in retrieval failures alone, and around 49% combined with BM25. It works because chunks lose their referents — pronouns, implicit subjects, section context — and the preamble restores them. Cost: one cheap call per chunk, once, at index time, heavily discounted by prompt caching the document prefix.',
  trap: 'The related technique is <b>late chunking</b>: embed the entire document with a long-context embedding model first, then pool token embeddings into chunk vectors, so every chunk vector has already seen the whole document. Different mechanism, same goal, no LLM call needed.',
  tags: ['chunking', 'retrieval'], orig: 47 },

{ id: 'rg07', topic: 'rag', level: 2,
  q: 'What is hybrid search and how do you combine the two lanes?',
  lay: 'Run a word-matching search and a meaning-matching search side by side, then merge the two ranked lists. Each catches what the other misses.',
  tech: 'Dense retrieval (embeddings, cosine) plus sparse/lexical retrieval (BM25 over an inverted index), fused into one ranking. Fusion methods: <ul><li><b>Reciprocal Rank Fusion (RRF)</b> — score = Σ 1/(k + rank) with k ≈ 60, over each list. Uses only ranks, so it needs no score normalisation and is robust. This is the default.</li><li><b>Weighted score fusion</b> — normalise each lane\'s scores and take a weighted sum. Needs calibration and is brittle when score distributions shift.</li></ul>Typical gains over dense alone are substantial on real corpora, and largest where identifiers and rare terms matter.',
  code: `def rrf(rank_lists, k=60):
    """rank_lists: [[doc_id, ...], ...] one ordered list per retrieval lane."""
    scores = {}
    for lst in rank_lists:
        for rank, doc in enumerate(lst, start=1):
            scores[doc] = scores.get(doc, 0) + 1 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

# ranks only — no score normalisation, so a lane with a different
# score scale cannot dominate the fusion.`,
  trap: 'Why RRF over weighted scores? Because cosine similarities and BM25 scores live on incomparable scales that also shift as your corpus grows. Rank-based fusion is invariant to both.',
  tags: ['hybrid', 'rrf'], orig: 47 },

{ id: 'rg08', topic: 'rag', level: 2,
  q: 'What is reranking, and why can a reranker not fix bad recall?',
  lay: 'A reranker reads the question and each candidate together and re-sorts them properly. But it only sees the candidates retrieval already handed it — if the right document was at rank 200 and you only passed the top 50, no amount of re-sorting will find it.',
  tech: 'A cross-encoder scores (query, document) pairs jointly with full attention between them, which is far more accurate than comparing two independently-computed vectors — and far too slow to run over a whole corpus. So it runs as a second stage over 50–200 candidates from first-stage retrieval, returning the best 3–10. Typical improvement in precision@5 is large. Latency cost is real: 50–800 ms depending on model and candidate count, which is often the single biggest term in a RAG latency budget.',
  compare: { cols: ['Bi-encoder (retrieval)', 'Cross-encoder (rerank)'],
    rows: [
      ['Encodes', 'query and document separately', 'query and document together'],
      ['Precomputable', 'yes — index once', 'no — must run per pair at query time'],
      ['Speed', 'millions of documents in milliseconds', 'tens to hundreds of pairs in 50–800 ms'],
      ['Accuracy', 'good', 'substantially better'],
      ['Role', 'recall — get the right doc into the candidate set', 'precision — put it at the top'],
      ['Can it fix the other\'s failure', 'no', 'no — it never sees what retrieval missed']
    ] },
  trap: 'The trap is treating the reranker as a quality fix. Measure recall@50 first: if the right chunk is not in the candidate set, your problem is retrieval, and reranking is spending latency to reorder the wrong documents.',
  tags: ['reranking'], orig: 47 },

{ id: 'rg09', topic: 'rag', level: 2,
  q: 'What is query rewriting and what forms does it take?',
  lay: 'The question the user typed is often not the best thing to search for. Rewrite it — expand the acronym, resolve "it" to what it refers to, or split a two-part question into two searches.',
  tech: '<ul><li><b>Contextualisation</b> — resolve pronouns and ellipsis against the conversation ("what about the second one?" → "what is the refund window for digital goods?"). Essential in multi-turn RAG and frequently the whole bug when follow-ups retrieve nothing.</li><li><b>Expansion</b> — add synonyms, expand acronyms, add domain terms.</li><li><b>Decomposition</b> — split a multi-hop question into sub-questions retrieved separately.</li><li><b>Multi-query / fan-out</b> — generate 3–5 paraphrases, retrieve for each, fuse with RRF. One embedding of one phrasing has a hard recall ceiling; five cheap searches beat one clever one.</li><li><b>HyDE</b> — generate a hypothetical ANSWER and embed that instead of the question, because answers live nearer answers in embedding space than questions do.</li><li><b>Step-back</b> — ask a more general question first to retrieve background, then the specific one.</li></ul>',
  trap: 'Every rewrite costs an LLM call and latency. Rewrite selectively: contextualise only when the query contains a pronoun or is very short; fan out only when the first retrieval scores poorly. Unconditional rewriting doubles latency on the 70% of queries that did not need it.',
  tags: ['query-rewriting'], orig: 47 },

{ id: 'rg10', topic: 'rag', level: 2,
  q: 'What is metadata filtering and why is it more important than it sounds?',
  lay: 'Narrowing the search before you search — only this customer\'s documents, only the current version, only what this user is allowed to see. It is usually a bigger quality win than any clever ranking, and it is how you avoid leaking data between customers.',
  tech: 'Attach structured attributes to every chunk (tenant, source, section path, document version, timestamp, language, permissions) and filter on them at query time. Two implementation strategies: <b>pre-filtering</b> (restrict the candidate set, then search — correct results, can be slow or degrade ANN recall) and <b>post-filtering</b> (search, then discard — fast, but you may end up with fewer than k results, or none). Most vector databases now implement filtered ANN search that pushes the predicate into the index traversal. Filtering by tenant is a security control, not an optimisation, and it must be enforced server-side where the user cannot influence it.',
  trap: 'Post-filtering silently returns fewer results than requested. If you ask for k=10 and post-filter to 2, the answer quality collapses and no error is raised. Always check how your vector store implements filtering.',
  tags: ['metadata', 'security'], orig: 47 },

{ id: 'rg11', topic: 'rag', level: 2,
  q: 'How do you evaluate a RAG system? What do you measure?',
  lay: 'Grade the librarian and the writer separately. If the right page was never fetched, no amount of good writing saves the answer — and if the page was fetched and the answer still ignores it, that is a different bug entirely.',
  tech: 'Two layers, always separate: <ul><li><b>Retrieval</b> — recall@k (is the right chunk in the top k), MRR (how high), nDCG (graded relevance), and context precision (what fraction of what you sent was actually relevant). No LLM needed for any of these, given labels.</li><li><b>Generation</b> — faithfulness (is every claim supported by the retrieved context), answer relevance (does it address the question), and correctness against a reference where one exists.</li></ul>Plus end-to-end signals: task completion, escalation rate, thumbs. The RAGAS framework packages faithfulness, answer relevance, context precision and context recall.',
  dgm: { nodes: [{ t: 'recall@k', s: 'did we find it' }, { t: 'MRR / nDCG', s: 'how high' }, { t: 'context precision', s: 'how much noise', k: 'alt' }, { t: 'faithfulness', s: 'is it supported', k: 'alt' }, { t: 'answer relevance', s: 'did it answer' }, { t: 'thumbs / escalation', s: 'did the user get what they came for', k: 'warn' }],
    cap: 'Debug left to right. Four of these six need no LLM, and that is where most bugs are.' },
  trap: 'When a RAG answer is wrong, resist blaming the model. Check in order: is the chunk in the index, is it in the top 50, is it in the prompt, did the model use it. Three of those four are answerable without an LLM.',
  tags: ['eval', 'ragas'], orig: 17 },

{ id: 'rg12', topic: 'rag', level: 2,
  q: 'How do you build a RAG eval set from nothing?',
  lay: 'Take fifty real questions, find the passage that answers each one, and write down that pairing. That is your eval set. It takes a day and it is the single highest-value day in the project.',
  tech: '<ol><li><b>Source real questions</b> — support tickets, search logs, sales calls. Invented questions test an imaginary product.</li><li><b>Label the answering chunk(s)</b> per question. This gives you recall@k and MRR for free, forever, with no LLM.</li><li><b>Write a reference answer</b> for a subset, for correctness scoring.</li><li><b>Cover the failure classes deliberately</b>: multi-hop, ambiguous, out-of-scope (the correct answer is "I do not know"), exact-identifier lookups, and one in each supported language.</li><li><b>Bootstrap with an LLM but verify by hand</b> — generate candidate questions from chunks, then have a human keep the good ones. Unverified synthetic evals measure your generator, not your system.</li><li><b>Freeze it and version it.</b> A moving eval set measures nothing.</li></ol>50–100 well-chosen cases beat 1,000 scraped ones.',
  trap: 'Include out-of-scope questions where the correct behaviour is refusal. Without them your system scores well by answering everything, and you will not notice it never says "I do not know" until a customer does.',
  tags: ['eval', 'dataset'], orig: 17 },

{ id: 'rg13', topic: 'rag', level: 2,
  q: 'What is the RAG deployment checklist you would run before going live?',
  lay: 'Do you have an eval set, do you know your retrieval quality, do you know your latency and your cost per question, and are your query and document embeddings from the same model? Most failed launches miss at least two of those.',
  tech: '<ol><li><b>Eval set exists and is frozen</b> — 50–300 real questions with labelled answering chunks, including refusal cases.</li><li><b>Retrieval quality measured</b> — recall@10 and recall@50 known. Below ~0.85 recall@50, fix retrieval before anything else.</li><li><b>Same embedding model on both sides</b> — query and documents. Mixing models produces silent nonsense, and asymmetric models need the right prefix ("query:" / "passage:").</li><li><b>Latency budget broken down</b> — retrieve, rerank, prefill, decode, guardrails, each measured at p95.</li><li><b>Cost per query known</b>, including reranker and guardrail calls, with a per-request ceiling enforced.</li><li><b>Empty and low-confidence retrieval handled explicitly</b> — a named branch, not a hallucination.</li><li><b>Permissions enforced pre-retrieval</b>, server-side.</li><li><b>Citations verified</b> — every cited id exists in what was retrieved.</li><li><b>Freshness path</b> — how does an updated document reach the index, and how long does it take?</li><li><b>Observability</b> — every request logs the query, the retrieved ids and scores, the prompt version and the model version.</li><li><b>Rollback</b> — prompt and index version pinned and revertible without a deploy.</li></ol>',
  trap: 'The embedding-consistency check is the one that silently ruins launches. If someone re-embedded the corpus with a new model and left the query encoder alone, everything still runs and every result is noise.',
  tags: ['deployment', 'checklist'], orig: 17 },

{ id: 'rg14', topic: 'rag', level: 2,
  q: 'Must the query and the documents use the same embedding model? What if they do not?',
  lay: 'Yes, and if they do not, nothing errors — the results just quietly become random. Two models put meaning in different places, so "near" in one space means nothing in the other.',
  tech: 'Embeddings are only comparable within the space that produced them. Mixing models yields a similarity number that is mathematically valid and semantically meaningless, and there is no error to catch. Two related subtleties: (1) some models are ASYMMETRIC and require different prefixes for queries and passages (E5 and BGE families use "query:" and "passage:"); using the wrong prefix costs measurable accuracy silently. (2) Changing embedding model means re-embedding the ENTIRE corpus — you cannot migrate incrementally within one index.',
  trap: 'Guard it in code: store the embedding model id and version as index metadata and assert it matches the query encoder at startup. It is a five-line check that prevents an entire class of undiagnosable outage.',
  tags: ['embeddings', 'ops'], orig: 17 },

{ id: 'rg15', topic: 'rag', level: 2,
  q: 'How do you optimise retrieval quality? Give me the ordered list.',
  lay: 'Measure first, then fix the cheapest things: how you cut the documents, whether you search by words as well as meaning, and whether you re-sort the results properly. Fancier techniques come after that.',
  tech: '<ol><li><b>Measure recall@50.</b> If the right chunk is not in the candidate set, nothing downstream can help. This tells you whether your problem is recall or ranking.</li><li><b>Fix chunking</b> — usually the biggest single lever. Document-aware splitting with heading paths, sensible size, overlap.</li><li><b>Add the lexical lane</b> — hybrid with RRF. Immediate gains on identifiers and rare terms.</li><li><b>Add metadata filters</b> — often a bigger win than better ranking, and required for permissions anyway.</li><li><b>Add a reranker</b> — large precision gain, real latency cost.</li><li><b>Query rewriting</b> — contextualisation for multi-turn, fan-out for multi-part questions.</li><li><b>Contextual retrieval</b> — one cheap call per chunk at index time, large measured gains.</li><li><b>Better embedding model</b> — measure on YOUR data; leaderboard rank is a weak predictor.</li><li><b>Fine-tune the embedder</b> — last, and only with a real labelled set.</li></ol>',
  trap: 'The ordering is the answer. Anyone can list techniques; the signal is knowing that chunking and hybrid come before reranking, and that all of it comes after measuring recall.',
  tags: ['retrieval', 'optimisation'], orig: 17 },

{ id: 'rg16', topic: 'rag', level: 2,
  q: 'What is agentic RAG, and how does it differ from classic RAG?',
  lay: 'Classic RAG always does exactly one search, whatever you asked. Agentic RAG lets the model decide: do I need to search at all, what should I search for, was that good enough, should I search again differently.',
  tech: 'Classic RAG is a fixed pipeline: embed → retrieve → stuff → generate. Agentic RAG puts the model in control of retrieval: planning, tool selection (vector search vs SQL vs web), query formulation, self-critique of results, and iteration. It earns its cost on multi-hop and ambiguous questions where a single blended embedding retrieves neither part well. It pays in variance: latency and cost swing wildly, so it needs a hard step budget, a per-request cost ceiling and full tracing.',
  compare: { cols: ['Classic RAG', 'Agentic RAG'],
    rows: [
      ['Number of retrievals', 'exactly one, always', 'zero to many, model decides'],
      ['Can recover from a bad search', 'no', 'yes — critique and re-search'],
      ['Multi-hop questions', 'poorly — one blended embedding', 'well — decomposes into sub-questions'],
      ['Can skip retrieval', 'no', 'yes, when the answer needs no lookup'],
      ['Latency', 'predictable', 'highly variable'],
      ['Cost per query', '1 LLM call + 1 search', '2–10 LLM calls + N searches'],
      ['Debuggability', 'easy', 'needs tracing'],
      ['Use when', 'FAQ over a stable corpus', 'multi-hop, ambiguous, multi-source']
    ] },
  trap: 'On a simple lookup, agentic RAG spends two extra model calls to reach the same answer. Say that: the honest engineer routes simple queries down the classic path and reserves the agent for questions that need it.',
  tags: ['agentic-rag'], orig: 56,
  xref: [['Watch both pipelines run side by side', '../genai_flow/index.html']] },

{ id: 'rg17', topic: 'rag', level: 3,
  q: 'What is GraphRAG and when is it worth the indexing cost?',
  lay: 'Instead of finding the chunks nearest to your question, you build a map of the entities and how they relate, then walk the map. It answers questions no single chunk contains — like "what themes recur across all 900 incident reports".',
  tech: 'Extract entities and relationships from the corpus with an LLM, build a knowledge graph, detect communities and generate hierarchical community summaries. At query time, either traverse relationships from matched entities (local search) or aggregate community summaries (global search). It answers <b>global</b> questions — themes, trends, "who touched this clause and when" — that vector similarity cannot, because the answer is not in any one chunk. Cost: an LLM pass over the entire corpus at index time, plus a schema design exercise, plus re-extraction when documents change.',
  trap: 'The honest scoping: GraphRAG is overkill for lookup questions and expensive to maintain on a corpus that changes daily. Use it when your users ask aggregate or relational questions, and keep vector RAG for everything else — most systems that need it need both.',
  tags: ['graphrag'], orig: 16 },

{ id: 'rg18', topic: 'rag', level: 3,
  q: 'What is a knowledge fabric / OKF, and how does it differ from RAG?',
  lay: 'RAG is a technique for finding text. A knowledge fabric is an agreement about what your data means — which system is authoritative for "customer", who is allowed to see it, and whose definition of "active user" wins. They are different layers, and the second is a governance project rather than a library.',
  tech: 'Be careful with the acronym: OKF is not standardised. In interviews it almost always means an <b>Organisational Knowledge Fabric</b> — a governed semantic layer over enterprise sources providing an ontology, entity resolution, lineage and access policy, exposed to many consumers (RAG, BI, agents). A small number of people mean the Open Knowledge Foundation, an unrelated non-profit; asking which scores points. The honest comparison: RAG is chunk-embed-search-stuff-answer; a fabric is the model of what your entities ARE and where they authoritatively live. They are complementary — a fabric is what stops your RAG pipeline confidently citing a deprecated wiki page that three teams disagree with.',
  compare: { cols: ['RAG', 'Knowledge fabric (OKF)'],
    rows: [
      ['What it is', 'a retrieval technique', 'a data architecture and governance layer'],
      ['Unit', 'a text chunk', 'an entity with a canonical definition'],
      ['Answers', '"what does the document say"', '"which system is authoritative, and who may see it"'],
      ['Built by', 'an engineering team, in weeks', 'an organisation, over months'],
      ['Consumers', 'the LLM', 'RAG, BI, agents, applications'],
      ['Solves', 'finding relevant text', 'conflicting sources, permissions, lineage, definitions'],
      ['Day-one value', 'immediate', 'none — it pays back at scale']
    ] },
  trap: 'Why anyone bothers: every large RAG deployment hits the same three walls — the same fact exists in four systems with four values, nobody can say which is authoritative, and permissions were never modelled so retrieval leaks. Those are governance problems, and no reranker fixes them.',
  tags: ['okf', 'governance'], orig: 16 },

{ id: 'rg19', topic: 'rag', level: 2,
  q: 'What is CAG (cache-augmented generation)?',
  lay: 'If your whole knowledge base is small and stable, skip searching entirely: load the lot into the model\'s memory once, precompute its digested form, and answer straight from it.',
  tech: 'Preload the entire corpus into the context and precompute its KV cache, so every request reuses that cache and skips both retrieval and prefill for the corpus. Lowest possible latency — there is no search hop at all — and no retrieval failures by construction. Constraints: the corpus must fit in the window, any update invalidates the cache, and you pay attention cost over the whole corpus on every request. Right for a single product manual, one policy set, or one module of code; wrong for anything large or fast-changing.',
  trap: 'The trade-off against RAG is exact: CAG removes retrieval error and adds a hard size ceiling plus a full-corpus attention cost per request. Naming both sides is the answer.',
  tags: ['cag', 'caching'], orig: 16 },

{ id: 'rg20', topic: 'rag', level: 2,
  q: 'Your LLM has a 1M-token context window. Why would you still need RAG?',
  lay: 'A bigger desk does not make the librarian useless. You still pay by the page every time you read, you still cannot fit the library on the desk, accuracy still sags in the middle of a huge pile, and you still would not hand an intern every confidential file just because there was room.',
  tech: 'Five arguments, in order of force: <ol><li><b>Cost</b> — you pay for every token on every request. A 1M-token prompt at $3/M input is $3 per question before output; retrieving 4k tokens is under a cent.</li><li><b>Latency</b> — prefill of 1M tokens takes seconds. TTFT is destroyed.</li><li><b>Ceiling</b> — corpora are gigabytes. A window is a window; an index is unbounded.</li><li><b>Accuracy</b> — lost-in-the-middle means recall at depth is materially worse than recall at position 1 of a short prompt.</li><li><b>Permissions and citations</b> — everything in the window is visible to the model regardless of who is asking, and you no longer know which passage the answer came from.</li></ol>Freshness matters too: updating one chunk is instant; rebuilding a 1M-token prompt invalidates the prefix cache.',
  trap: 'The nuanced answer: a large window does not delete RAG, it makes RAG EASIER — you can be generous with k, chunk more lazily and skip aggressive compression. The two are complementary.',
  tags: ['long-context'], orig: 38,
  xref: [['Calculate it on your own numbers', '../genai_flow/index.html']] },

{ id: 'rg21', topic: 'rag', level: 2,
  q: 'RAG works in English and collapses for Arabic queries even though the documents are indexed. How do you debug it?',
  lay: 'Almost always the embedding model. Most of them are trained overwhelmingly on English, so Arabic text lands in a small crowded corner of the space where everything looks similar to everything else. Test that first before touching anything else.',
  tech: 'Debug in this order: <ol><li><b>Is the document in the index at all?</b> Fetch by id. If not, it is an ingestion bug.</li><li><b>Embed the Arabic document and the Arabic question and print the cosine.</b> If a document that literally answers the question scores near your corpus average, the embedder is the problem — stop looking anywhere else.</li><li><b>Compare with the same pair translated to English.</b> A large gap is proof.</li><li><b>Turn off the dense lane and query BM25 only.</b> If BM25 also fails, it is normalisation; if BM25 works, it is the embedder.</li><li><b>Check tokens per chunk by language.</b> If Arabic chunks hold half the text, fix chunking first.</li><li><b>Only now</b> look at the reranker and the prompt template.</li></ol>Causes and fixes: English-centric embedder → switch to multilingual-e5, BGE-M3 or Cohere multilingual and re-embed everything. Tokenizer explosion → size chunks in characters, not tokens. No normalisation → Unicode NFKC, strip diacritics and tatweel, unify alef/ya forms, on BOTH index and query. Cross-lingual query → a cross-lingual embedder, or translate the query and search both. English-only reranker → a multilingual reranker.',
  trap: 'The RTL detail worth mentioning: right-to-left text with embedded Latin product codes gets mangled by naive splitters and templates, and it looks fine in the browser. Log and inspect the actual bytes reaching the model.',
  tags: ['multilingual', 'debugging'], orig: 41 },

{ id: 'rg22', topic: 'rag', level: 3,
  q: 'How do you design RAG for data that changes frequently, minimising stale answers?',
  lay: 'Make the pipeline event-driven end to end. When a document changes, re-chunk just that document, update just those vectors, and make every cached answer that used them stop matching automatically.',
  tech: '<ol><li><b>Ingestion:</b> change-data-capture or webhooks, not a nightly full crawl. Content-hash each chunk so unchanged chunks are not re-embedded.</li><li><b>Indexing:</b> upsert by a stable chunk id derived from (document id, section, content hash). Deletes must propagate — a deleted document that remains retrievable is a compliance incident, not a bug.</li><li><b>Versioning:</b> every chunk carries a document version and a valid-from timestamp. Filter to current at query time.</li><li><b>Caching:</b> include a hash of the retrieved chunk ids plus their versions in the answer cache key. Change a document and its cached answers stop matching, with no purge logic.</li><li><b>TTL by volatility:</b> short for pricing and availability, long for policy and definitions.</li><li><b>Freshness SLO:</b> measure index lag — the time from source change to retrievable — and alarm on it. This is the number that tells you whether "stale" is a cache problem or an ingestion problem.</li><li><b>Surface it:</b> show the source and its date, so a user can see the answer is from last Tuesday.</li></ol>',
  trap: 'Deletion is the part teams skip. Ask anyone whose RAG has been live a year whether a deleted document is still retrievable; often it is, because the delete path was never built.',
  tags: ['freshness', 'ingestion'], orig: 34 },

{ id: 'rg23', topic: 'rag', level: 2,
  q: 'What are the main RAG failure modes, and how do you tell them apart?',
  lay: 'Six ways it goes wrong: it did not find the right page, it found it but buried it in a pile, the page is out of date, the pile did not fit, the answer cites something that does not exist, or the whole thing is simply too slow.',
  tech: '<ul><li><b>Poor retrieval</b> — the answering chunk is not in the top k. Diagnose with recall@k. Fix: chunking, hybrid, filters, query rewriting.</li><li><b>Lost in the middle</b> — it was retrieved but sat at position 8 of a long prompt. Fix: rerank, reduce k, restate the task at the end.</li><li><b>Stale knowledge</b> — the index has last quarter\'s policy. Fix: event-driven ingestion, version filtering, freshness SLO.</li><li><b>Context overflow</b> — the prompt exceeded the window and something was silently dropped. Fix: token counting, explicit trimming policy, reserved headroom.</li><li><b>Hallucinated citations</b> — the answer cites chunk 7 which does not exist or does not say that. Fix: verify every citation id mechanically, and check claim support with a faithfulness judge.</li><li><b>Retrieval latency</b> — a cold index, a slow reranker, or fan-out without parallelism. Fix: measure the budget per stage.</li></ul>',
  dgm: { nodes: [{ t: 'in the index?' }, { t: 'in the top 50?' }, { t: 'in the prompt?' }, { t: 'did the model use it?' }, { t: 'did the user get what they came for?', k: 'warn' }],
    cap: 'Debug in this order. The first three need no LLM, and that is where most bugs live.' },
  trap: 'The single most useful habit: before blaming the model, print exactly what was retrieved and check whether the answer was in it. Most "the model hallucinated" tickets are retrieval tickets.',
  tags: ['failure-modes', 'debugging'], orig: 54 },

{ id: 'rg24', topic: 'rag', level: 2,
  q: 'How do you verify citations so the model cannot fabricate them?',
  lay: 'Give each retrieved chunk an id, tell the model to cite ids, then check in code that every id it used was actually one you sent — and that the quoted text really appears there.',
  tech: 'A three-level check, all deterministic and free: <ol><li><b>Existence</b> — every cited id is in the set you retrieved. A fabricated id is caught with a set lookup.</li><li><b>Support</b> — if the answer quotes text, that string (normalised) appears in the cited chunk.</li><li><b>Coverage</b> — every factual sentence carries at least one citation. Sentences without one are candidates for an LLM faithfulness check.</li></ol>On failure: retry once with the validator\'s complaint in the prompt, then degrade to "I could not verify this" plus the sources, and escalate. Never cache an answer that failed verification.',
  code: `def verify(answer: str, retrieved: dict[str, str]) -> list[str]:
    problems = []
    cited = set(re.findall(r"\\[(chunk-[a-z0-9]+)\\]", answer))
    for cid in cited:
        if cid not in retrieved:
            problems.append(f"cited {cid} which was never retrieved")
    for quote in re.findall(r'"([^"]{20,})"', answer):
        if not any(norm(quote) in norm(t) for t in retrieved.values()):
            problems.append(f"quoted text not present in any source: {quote[:40]}")
    for sent in split_sentences(answer):
        if is_factual(sent) and not re.search(r"\\[chunk-", sent):
            problems.append(f"uncited claim: {sent[:60]}")
    return problems`,
  trap: 'This is one of the highest-value things you can build and it needs no LLM. Teams reach for a judge model when a set-membership test would have caught most of it for free.',
  tags: ['citations', 'hallucination'], orig: 54 },

{ id: 'rg25', topic: 'rag', level: 2,
  q: 'How do you handle empty or low-confidence retrieval?',
  lay: 'Notice it, try one cheap recovery, and if it still fails, say so specifically rather than making something up. Passing an empty context to the model and hoping is the single biggest source of production hallucination.',
  tech: '<b>Empty:</b> detect explicitly — zero hits, or best score below a floor you calibrated on real queries. Try one cheap recovery (relax filters, drop the rarest term, run the lexical lane alone, rewrite the query once). If still empty, refuse with a specific message naming what you searched and offering the nearest topics you did find. Log it — an empty-retrieval rate above a couple of percent is a corpus problem. <b>Low confidence:</b> use the score GAP between rank 1 and rank 5, not the absolute score — a flat distribution means the retriever is guessing. Escalate: rerank, fan out the query, widen k. Then hedge the answer explicitly and offer escalation. Never cache a low-confidence answer.',
  trap: 'Absolute similarity scores are not calibrated and drift as the corpus changes. A "0.8 threshold" that worked in March means something different in September. Use relative signals and recalibrate on real data.',
  tags: ['failure-modes'], orig: 37 },

{ id: 'rg26', topic: 'rag', level: 2,
  q: 'What is HyDE and why does it work?',
  lay: 'Ask the model to invent a plausible answer to the question, then search using that fake answer instead of the question. Answers look like answers, so they land nearer the real ones in the space.',
  tech: 'Hypothetical Document Embeddings: generate a hypothetical answer with an LLM, embed IT, and retrieve with that vector. It works because of the asymmetry between questions and passages — a short question and a long factual passage have quite different surface form even when they are about the same thing, whereas a hypothetical answer shares form with a real one. Helps most in zero-shot settings and on domains the embedding model was not trained for. Costs one extra generation call and its latency, and it can hurt when the hallucinated answer drifts off-topic.',
  trap: 'A cheaper alternative worth naming: an asymmetric embedding model (E5, BGE) trained specifically with query and passage prefixes solves the same asymmetry at index time with no extra call. Try that before HyDE.',
  tags: ['query-rewriting', 'hyde'], orig: 47 },

{ id: 'rg27', topic: 'rag', level: 2,
  q: 'How many chunks should you retrieve, and does more always help?',
  lay: 'No. Past a point, extra chunks are noise — they push the good one into the middle where the model is least likely to notice it, and they cost tokens and latency.',
  tech: 'Typical k: 3–5 with a reranker, 5–10 without. More chunks raise recall and lower context precision, and the lost-in-the-middle effect means the marginal chunk can actively hurt. The standard shape is retrieve wide, rerank narrow: fetch 50–200 candidates cheaply, rerank to the best 3–5. Measure the curve on your eval set — plot answer quality against k and you will usually see a peak, not a plateau.',
  trap: '"Just set k=20 to be safe" is a real anti-pattern with a measurable cost: more tokens, more latency, and lower accuracy because the answer is buried. Show the curve.',
  tags: ['retrieval', 'tuning'] },

{ id: 'rg28', topic: 'rag', level: 3,
  q: 'How would you do RAG over tables and spreadsheets?',
  lay: 'Do not treat a table as prose. Either turn each row into a sentence, or — better — put the table in a database and let the model write a query against it.',
  tech: 'Options in increasing order of correctness: <ul><li><b>Row-to-text</b> — serialise each row as "column: value" sentences and embed. Works for lookup ("what is the price of SKU-4471"), fails for aggregation.</li><li><b>Table summaries</b> — embed a description of the table alongside the raw rows; retrieval finds the table, then you pass the relevant rows.</li><li><b>Text-to-SQL</b> — the right answer for anything involving counting, filtering, ranking or maths. The LLM writes a query; the database computes the answer exactly.</li><li><b>Hybrid</b> — route by intent: lookup questions go to retrieval, analytical questions go to text-to-SQL.</li></ul>',
  trap: 'An LLM cannot reliably sum a column of numbers in a prompt. If the question involves aggregation, the answer is text-to-SQL or a calculator tool, not better retrieval — and saying that is the whole point of the question.',
  tags: ['tables', 'sql'] },

{ id: 'rg29', topic: 'rag', level: 3,
  q: 'How do you implement permission-aware retrieval?',
  lay: 'Filter by who is asking, before you search — never after, and never by asking the model nicely. The model has no concept of permissions; your database does.',
  tech: '<ol><li><b>Store an access control list on every chunk</b> at ingestion — inherited from the source document, kept in sync when the source ACL changes.</li><li><b>Filter server-side, pre-retrieval</b>, using an identity derived from the authenticated session, never from anything the user can influence.</li><li><b>Prefer pre-filtering</b> in the vector store so the ANN traversal respects the predicate; post-filtering can silently return fewer than k results.</li><li><b>Handle ACL changes</b> — a revoked permission must take effect immediately, so either store ACLs on the chunk and reindex on change, or evaluate against a live permission service at query time.</li><li><b>Never rely on the prompt</b> — "only answer using documents this user can see" is a suggestion, not a control.</li><li><b>Cache per principal</b> — an answer cached without the tenant in the key is a cross-tenant leak waiting to happen.</li><li><b>Test it</b> — an eval case per tenant asserting that user A cannot retrieve user B\'s document.</li></ol>',
  trap: 'The cache key is the trap. Everything else can be right and a shared answer cache without a tenant component leaks data between customers on the first hit.',
  tags: ['security', 'multi-tenant'], orig: 47 },

{ id: 'rg30', topic: 'rag', level: 2,
  q: 'What is context precision and why does it matter as much as recall?',
  lay: 'Recall asks "did we find the right page?" Precision asks "how much rubbish did we send along with it?" Sending nine irrelevant pages with the right one costs money, latency, and accuracy.',
  tech: 'Context precision is the fraction of retrieved chunks that are actually relevant, often computed rank-aware so relevant chunks at the top count for more. Low precision has three costs: token spend, latency, and — because of lost-in-the-middle — reduced accuracy, since the correct chunk is diluted. It is the metric that justifies reranking and a smaller k, and it is the reason "retrieve more to be safe" is wrong.',
  trap: 'Recall and precision trade off through k. Report both, plus the k you used. A recall@20 of 0.95 with precision 0.15 is a worse system than recall@5 of 0.90 with precision 0.60 in almost every real deployment.',
  tags: ['eval', 'metrics'], orig: 17 },

{ id: 'rg31', topic: 'rag', level: 2,
  q: 'What is RAGAS and what does it actually compute?',
  lay: 'A toolkit that scores a RAG system on four things: does the answer stick to the sources, does it address the question, was what you retrieved relevant, and did you retrieve everything you needed.',
  tech: '<ul><li><b>Faithfulness</b> — decompose the answer into claims and check each is supported by the retrieved context. Needs no ground truth, which makes it usable on production traffic.</li><li><b>Answer relevance</b> — generate questions from the answer and measure similarity to the original question; catches answers that are true but off-topic.</li><li><b>Context precision</b> — are the relevant chunks ranked highly.</li><li><b>Context recall</b> — does the retrieved context contain everything needed to produce the reference answer. This one needs ground truth, which is why it is the expensive metric nobody builds.</li></ul>',
  trap: 'These are LLM-judged metrics, so they inherit judge noise and cost. Use them as a directional regression signal on a frozen set, and keep deterministic checks (citation existence, schema validity) underneath as the reliable layer.',
  tags: ['eval', 'ragas'], orig: 48 },

{ id: 'rg32', topic: 'rag', level: 2,
  q: 'RAG is live. How do you actually know it is working?',
  lay: 'Not from a demo. From four things: a frozen offline suite that runs every change, real user signals, a sample a human reads every week, and alarms on the handful of numbers that move before users complain.',
  tech: '<ol><li><b>Offline, on every change</b> — recall@k and MRR on the frozen eval set, plus faithfulness and answer relevance on a fixed 100–300 cases. Gate the deploy on it.</li><li><b>Online product metrics</b> — task completion or deflection rate, escalation rate, follow-up-question rate (a strong implicit signal of a bad answer), thumbs, copy/share actions.</li><li><b>Operational metrics with alarms</b> — empty-retrieval rate, low-confidence rate, citation-verification failure rate, p95 latency, cost per query, index freshness lag.</li><li><b>Weekly human review</b> of a stratified sample, including every case where the judge and the deterministic checks disagreed. That queue is also where your next eval cases come from.</li><li><b>A/B</b> for any meaningful change, with pre-declared primary and guardrail metrics.</li></ol>',
  trap: 'The follow-up-rate signal is the underrated one. Users who immediately rephrase their question did not get what they needed, and it needs no labelling to measure.',
  tags: ['eval', 'observability'], orig: 57 },

{ id: 'rg33', topic: 'rag', level: 2,
  q: 'What is a vector database and do you always need one?',
  lay: 'A database built for "find me the nearest vectors" instead of "find me the exact row". You need one when you have a lot of vectors. Below about a hundred thousand, a library and a file will do.',
  tech: 'Provides approximate nearest-neighbour indexing, metadata filtering, upserts and deletes, persistence, and usually replication and multi-tenancy. Options: <b>pgvector</b> (Postgres extension — you already run Postgres, transactional, joins with your real data; the default choice for most teams), <b>Qdrant / Weaviate / Milvus</b> (purpose-built, better filtered-search performance at scale), <b>Pinecone</b> (managed), <b>FAISS / hnswlib</b> (libraries, not services — no persistence or filtering out of the box), <b>Elasticsearch / OpenSearch</b> (dense vectors plus BM25 in one system, which makes hybrid trivial).',
  trap: 'The honest answer for most teams is pgvector. One less system to operate, transactional consistency with your source of truth, and filtering by joining on real tables. Reach for a dedicated store when you have tens of millions of vectors or need filtered search at high QPS.',
  tags: ['vector-db'], orig: 13 },

{ id: 'rg34', topic: 'rag', level: 3,
  q: 'Design a RAG system for 50 million documents.',
  lay: 'The hard parts stop being "how do I search" and become "where does this all live, how does it stay up to date, and what does one query cost". You shard, you compress the vectors, you filter hard before searching, and you cache aggressively.',
  tech: '<ol><li><b>Ingestion</b> — a streaming pipeline with change-data-capture, content-hash deduplication, and idempotent upserts keyed by (doc id, section, content hash). Embedding is a batch job, parallel, with backpressure.</li><li><b>Index</b> — 50M chunks at 768 float32 dimensions is ~150 GB of raw vectors, so compress: product quantisation or scalar quantisation to ~100 bytes/vector brings it to a few GB per shard. Shard by tenant or document range; replicate for availability and read throughput.</li><li><b>Retrieval</b> — metadata filter first (tenant, recency, language), then hybrid dense + BM25, then rerank the top 100 to the top 5. Push filters into the ANN traversal rather than post-filtering.</li><li><b>Serving</b> — a semantic cache in front, prompt caching for the stable prefix, and a model router.</li><li><b>Freshness</b> — measure index lag as an SLO; incremental upserts, not nightly rebuilds.</li><li><b>Cost</b> — measure cost per query and cache hit rate; at this scale the embedding backfill is a one-off batch cost and the ongoing cost is generation.</li><li><b>Evaluation</b> — a frozen eval set per major tenant or domain, because aggregate metrics hide per-segment collapse.</li></ol>',
  trap: 'The scale-specific insight interviewers listen for: at 50M documents, metadata filtering does more for both latency and quality than any ranking improvement, because it cuts the candidate space by orders of magnitude before similarity is ever computed.',
  tags: ['scale', 'design'], orig: 13 },

{ id: 'rg35', topic: 'rag', level: 2,
  q: 'What is multi-query / fan-out retrieval and when does it pay?',
  lay: 'Ask the same question five different ways, search for all five, and merge the results. It costs five searches and it finds things one phrasing never would.',
  tech: 'Generate 3–5 paraphrases or sub-questions with a cheap model, retrieve for each, and fuse with reciprocal rank fusion. It pays when a question has multiple aspects that no single embedding captures — "why did my refund fail" has two distinct causes (a gateway timeout and an issuer decline) that live in different chunks and no single vector sits near both. Costs: one extra LLM call plus N searches, and the searches parallelise so the latency cost is roughly one search plus the rewrite call.',
  trap: 'Do it conditionally. Fan out when the first retrieval\'s score distribution is flat or the question contains a conjunction; skip it on simple lookups. Unconditional fan-out multiplies your search load for the majority of queries that did not need it.',
  tags: ['query-rewriting', 'rrf'], orig: 47 },

{ id: 'rg36', topic: 'rag', level: 2,
  q: 'How do you handle multi-hop questions in RAG?',
  lay: 'Break the question into steps and search for each in turn, feeding what you learn into the next search. "Who manages the person who signed this contract?" needs two lookups, and one blended search finds neither.',
  tech: 'Options: <ul><li><b>Decomposition</b> — an LLM splits the question into sub-questions retrieved independently, then a final synthesis step.</li><li><b>Iterative retrieval</b> — retrieve, read, formulate the next query from what you learned, repeat with a step budget. This is agentic RAG.</li><li><b>Graph traversal</b> — if the relationships are explicit, follow edges instead of re-searching.</li></ul>Always cap the number of hops (2–3 is usually enough) and carry the intermediate findings forward explicitly rather than relying on the model to remember them.',
  trap: 'Multi-hop is where classic RAG measurably fails and where agentic RAG earns its cost. Say why: one embedding of a two-part question sits in the average of two meanings and is near neither.',
  tags: ['multi-hop', 'agentic-rag'], orig: 56 },

{ id: 'rg37', topic: 'rag', level: 2,
  q: 'What is late interaction retrieval (ColBERT)?',
  lay: 'Instead of squashing a whole passage into one number-list, you keep a list per word, and at query time each query word finds its best match inside the passage. More precise, more storage.',
  tech: 'ColBERT stores a per-token embedding for each document and scores with MaxSim: for each query token, take the maximum similarity against any document token, then sum. It sits between bi-encoders (fast, one vector, lossy) and cross-encoders (accurate, no precomputation, slow) — most of the accuracy of a cross-encoder with much of the speed of a bi-encoder. Cost: storage is 10–100× a single-vector index, which is the reason it is not the default. ColBERTv2 and PLAID reduce that substantially with residual compression.',
  trap: 'Where it shines: long passages where the answer is one sentence buried inside. A single pooled vector averages that sentence away; MaxSim finds it. That is the concrete case to cite.',
  tags: ['colbert', 'retrieval'] },

{ id: 'rg38', topic: 'rag', level: 2,
  q: 'How would you fine-tune an embedding model for your domain?',
  lay: 'Collect pairs of questions and the passages that answer them, then train the model so those pairs end up closer together than random pairs. You need real pairs, and you need a held-out set to prove it helped.',
  tech: 'Collect (query, positive passage) pairs from real usage — click logs, support tickets with resolutions, question-answer pairs. Train with a contrastive objective (MultipleNegativesRankingLoss is the standard starting point) using in-batch negatives, and add HARD negatives — passages that the current retriever ranks highly but are wrong, which is where most of the gain comes from. Evaluate on held-out recall@k, not on training loss. A few thousand pairs is often enough for a measurable gain on a narrow domain.',
  trap: 'Re-embedding cost and the migration are the practical blockers: a new embedder means rebuilding the whole index and running both in parallel for comparison. Budget that before promising the gain.',
  tags: ['embeddings', 'finetuning'] },

{ id: 'rg39', topic: 'rag', level: 2,
  q: 'What is the difference between retrieval and search, in an interview context?',
  lay: 'Search is for a human who will look at ten blue links and judge for themselves. Retrieval feeds a machine that will believe whatever you hand it. That changes what "good enough" means.',
  tech: 'Classic search optimises for a human scanning a ranked list — nDCG over ten results, diversity, snippets. RAG retrieval optimises for a downstream generator that sees only k passages and cannot tell a wrong one from a right one. Consequences: precision at very small k matters far more; a plausible-but-wrong passage is worse than no passage (it produces a confident wrong answer); diversity is less valuable than correctness; and you need an explicit "nothing good enough" outcome, which a search engine never has to produce.',
  trap: 'The strongest framing: in search, a bad result costs the user a click. In RAG, a bad result costs the user a confident false answer they will act on. That asymmetry justifies the reranker and the refusal path.',
  tags: ['retrieval', 'design'] },

{ id: 'rg40', topic: 'rag', level: 3,
  q: 'How do you keep the index and the source of truth in sync?',
  lay: 'Treat the index as a derived view, never as the master copy. Everything flows one way, every change is an event, and you can rebuild the whole thing from scratch if you have to.',
  tech: '<ol><li><b>One direction only</b> — source → pipeline → index. Never write to the index by hand.</li><li><b>Event-driven</b> — change-data-capture or webhooks; nightly full crawls guarantee staleness and cost a fortune.</li><li><b>Idempotent upserts</b> with a deterministic chunk id, so replays are safe.</li><li><b>Deletes propagate</b> — a tombstone or a hard delete, tested. This is the most commonly missing path.</li><li><b>Reconciliation job</b> — periodically diff source ids against index ids and report drift. Something will always drift.</li><li><b>Rebuildability</b> — you must be able to reconstruct the index from source in a bounded time, and you should have done it at least once.</li><li><b>Freshness SLO</b> — measure and alarm on lag from source change to retrievable.</li></ol>',
  trap: 'Reconciliation is the item that separates people who have operated one of these. Indexes drift — failed jobs, partial writes, schema changes — and without a diff job you find out from a customer.',
  tags: ['ingestion', 'ops'], orig: 34 },

{ id: 'rg41', topic: 'rag', level: 2,
  q: 'What is document-aware chunking and why is the heading path so valuable?',
  lay: 'Cut at the headings, and staple the heading trail to the top of each piece. Now a chunk that says "5 to 10 business days" also says "Refund Policy > Processing time", which is exactly what a search needs to match.',
  tech: 'Parse the format first — Markdown headers, HTML DOM, PDF outline, code AST — and chunk on real structural nodes rather than character counts. Then prepend the full heading path to each chunk before embedding. The path restores the context a chunk loses when it is cut out of its document, which is the same problem contextual retrieval solves with an LLM, at zero marginal cost when the structure already exists. Also store the path as metadata for filtering and for display in citations.',
  trap: 'This is a one-line change with an outsized effect, and it is the first thing to try when a structured corpus retrieves badly. Interviewers notice when a candidate reaches for the cheap fix before the expensive one.',
  tags: ['chunking'], orig: 24 },

{ id: 'rg42', topic: 'rag', level: 2,
  q: 'What is semantic chunking and is it worth the cost?',
  lay: 'Read the document sentence by sentence and start a new chunk whenever the topic changes. It produces the most coherent chunks and costs an embedding call per sentence at index time.',
  tech: 'Embed each sentence, walk the sequence computing cosine distance between consecutive sentences, and cut where the distance exceeds a percentile threshold (commonly the 95th). Produces topically coherent chunks with no fixed size. Costs: one embedding per sentence at index time, and a threshold that needs tuning per corpus. Worth it when the corpus is unstructured and mixed-topic — meeting notes, long emails, research papers — where neither fixed size nor structure gives you a good boundary.',
  trap: 'On a structured corpus, document-aware chunking beats semantic chunking and costs nothing. Semantic chunking is for the case where there is genuinely no structure to exploit.',
  tags: ['chunking'], orig: 35 },

{ id: 'rg43', topic: 'rag', level: 3,
  q: 'How do you A/B test a retrieval change safely?',
  lay: 'Prove it offline first on a frozen question set, then send a slice of real traffic and watch the user signals, not just the retrieval numbers.',
  tech: '<ol><li><b>Offline first</b> — recall@k and MRR on the frozen eval set. If it does not win offline, do not ship it.</li><li><b>Shadow</b> — run the new retriever alongside the old on live traffic, logging both result sets, without serving the new one. Free, safe, and it tells you how different the results actually are.</li><li><b>Interleaving</b> — for retrieval specifically, team-draft interleaving mixes results from both systems into one list and attributes clicks; it needs far less traffic than a split A/B to reach significance.</li><li><b>A/B</b> — randomise by user, declare the primary metric (task completion, escalation rate) and guardrails (p95 latency, cost per query) before launch.</li><li><b>Segment the analysis</b> — a change that helps English and destroys Arabic is a net win on average and a disaster in production.</li></ol>',
  trap: 'Retrieval metrics and product metrics diverge more often than people expect. A change that improves recall@10 and increases latency by 400 ms can lose on task completion. The product metric wins.',
  tags: ['ab-test', 'eval'], orig: 48 },

{ id: 'rg44', topic: 'rag', level: 2,
  q: 'What goes in a chunk\'s metadata, and why is it not optional?',
  lay: 'Where it came from, which section, which version, when, what language, and who is allowed to see it. Without those you cannot filter, cannot cite, cannot expire and cannot keep tenants apart.',
  tech: 'Minimum viable metadata: <span class="mono">source_id, source_url, section_path, doc_version, updated_at, language, tenant_id, acl, chunk_index, content_hash</span>. Each earns its place: tenant and ACL for security, version and timestamp for freshness filtering and cache keys, section path for citations and for prepending to the text, language for routing to the right embedder and reranker, content hash for idempotent upserts and deduplication.',
  trap: 'Metadata filtering is frequently a bigger quality win than any ranking improvement, because it removes whole categories of wrong answer before scoring begins. It is also the only correct way to enforce permissions.',
  tags: ['metadata'], orig: 47 },

{ id: 'rg45', topic: 'rag', level: 2,
  q: 'What is reciprocal rank fusion and why is it the default?',
  lay: 'A way to merge several ranked lists using only positions, not scores. Something ranked second in two lists beats something ranked first in one and nowhere in the others.',
  tech: '<span class="mono">RRF(d) = Σ_lists 1 / (k + rank_list(d))</span>, typically k = 60. It is the default because it needs no score normalisation: cosine similarities and BM25 scores live on incomparable scales that also shift as the corpus grows, so any weighted-score fusion needs recalibration and RRF does not. The constant k dampens the influence of very top ranks, which makes it robust when one lane is occasionally confidently wrong.',
  code: `def rrf(lists, k=60, top_n=10):
    scores = {}
    for lst in lists:                       # dense, bm25, multi-query variants...
        for rank, doc in enumerate(lst, 1):
            scores[doc] = scores.get(doc, 0) + 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)[:top_n]`,
  trap: 'It generalises beyond hybrid: use the same function to fuse the results of five query rewrites, or three different embedding models. Any set of ranked lists is a valid input.',
  tags: ['rrf', 'hybrid'], orig: 47 },

{ id: 'rg46', topic: 'rag', level: 3,
  q: 'Your RAG answers are correct but users still complain. What might be wrong?',
  lay: 'Correct is not the same as useful. It may be answering a question they did not ask, burying the answer in three paragraphs, refusing too often, taking too long, or giving no way to check it.',
  tech: 'Diagnose beyond correctness: <ul><li><b>Relevance</b> — technically true, but not what they asked. Measure answer relevance separately from faithfulness.</li><li><b>Actionability</b> — "refunds take 5–10 days" when the user wanted to know what to do about THEIR refund.</li><li><b>Format and length</b> — a wall of text where a two-line answer was wanted.</li><li><b>Over-refusal</b> — abstaining on questions it could answer. Track refusal rate against a labelled sample of answerable questions.</li><li><b>Latency</b> — a correct answer after nine seconds loses to a decent one after one.</li><li><b>Trust</b> — no citations, or citations users cannot click through to.</li><li><b>Coverage</b> — it is great at the 60% you tested and useless at the 40% you did not.</li></ul>',
  trap: 'Go and read fifty real conversations, unaggregated. Dashboards tell you what is happening; transcripts tell you why. Almost every team that says "the metrics look fine but users are unhappy" has not done this.',
  tags: ['product', 'eval'], orig: 57 },

{ id: 'rg47', topic: 'rag', level: 2,
  q: 'How do you deal with contradictory documents in the corpus?',
  lay: 'First decide which one is right — usually the newest, or the one from the authoritative system. Then either filter the other out or tell the user there is a conflict. What you must not do is silently average them.',
  tech: 'Strategies, in order: <ol><li><b>Prevent</b> — versioning and a single authoritative source per fact. This is the knowledge-fabric problem, and it is the only real fix.</li><li><b>Filter</b> — retrieve only the current version; mark superseded documents and exclude them by default.</li><li><b>Rank by authority</b> — a source-trust score in the ranking, so the policy document outranks the old wiki page.</li><li><b>Surface the conflict</b> — when retrieved chunks disagree, say so and cite both. Users generally prefer an honest conflict to a confident guess.</li><li><b>Detect it</b> — an offline job that finds semantically similar chunks with contradictory content is a genuinely useful data-quality tool.</li></ol>',
  trap: 'The failure to name: the model does not know which source is authoritative and will happily blend two contradictory passages into one plausible sentence that is in neither. Authority has to be encoded in metadata and enforced in ranking.',
  tags: ['data-quality', 'okf'], orig: 16 },

{ id: 'rg48', topic: 'rag', level: 2,
  q: 'What does a RAG latency budget look like?',
  lay: 'Add up every step and see where the seconds go. Usually it is the reranker and the generation, and usually nobody has measured.',
  tech: 'A typical breakdown for a 2-second target: network and auth 30 ms; query embedding 20 ms; vector search 30–80 ms; BM25 lane 20 ms (in parallel); RRF fusion negligible; reranker 80–400 ms (often the biggest surprise); prompt assembly 10 ms; prefill 150–600 ms depending on prompt size; decode 400–1200 ms depending on output length; guardrails 50–300 ms if synchronous. The levers: parallelise the retrieval lanes, cap reranker candidates, shorten the prompt, cap output length, run guardrails concurrently with generation where possible, and cache.',
  trap: 'Decode length is usually the largest single term and the easiest to reduce: asking for a shorter answer is free and immediate. Teams optimise retrieval for weeks and never cap max_tokens.',
  tags: ['latency'], orig: 33 },

{ id: 'rg49', topic: 'rag', level: 2,
  q: 'What is the difference between retrieval score and confidence?',
  lay: 'A similarity score says "this was the closest thing I had". It does not say "this is right". The closest thing in a corpus that does not contain the answer is still the closest thing.',
  tech: 'Cosine similarity is a relative measure within a corpus, not a calibrated probability of relevance. Its absolute value drifts with the embedding model, the corpus and even the query length. Better confidence signals: the GAP between rank 1 and rank 5 (a flat distribution means the retriever is guessing); agreement between the dense and lexical lanes; the reranker score, which is closer to calibrated because a cross-encoder is trained on relevance directly; and whether the generated answer survives citation verification.',
  trap: 'Do not ship a hard threshold on raw cosine. Calibrate on labelled data, prefer relative signals, and re-check the calibration whenever the corpus or the embedder changes.',
  tags: ['confidence', 'retrieval'], orig: 37 },

{ id: 'rg50', topic: 'rag', level: 3,
  q: 'Design a RAG system for a regulated industry — what changes?',
  lay: 'Everything gets an audit trail, permissions become mandatory rather than nice, deletion has to actually work, and the model must be able to say "I do not know" rather than guessing.',
  tech: 'Additions over a standard design: <ul><li><b>Full audit trail</b> — every query, every retrieved chunk id, the exact prompt, the model version and the answer, retained per the retention policy.</li><li><b>Permission enforcement pre-retrieval</b>, server-side, with per-tenant cache keys and a test asserting cross-tenant isolation.</li><li><b>Right to erasure</b> — a working delete path from source through index through caches, tested and timed.</li><li><b>Citations mandatory</b>, verified mechanically, with a refusal when they cannot be verified.</li><li><b>Human in the loop</b> on any consequential output, with the reviewer recorded.</li><li><b>Data residency</b> — the model and the index in the required region, which often rules out some providers.</li><li><b>Model version pinning</b> and a change-control process, because "the provider silently updated the model" is not an acceptable explanation for a changed decision.</li><li><b>Refusal over guessing</b> — the default behaviour on low confidence is to escalate, not to answer.</li></ul>',
  trap: 'Model version pinning is the one people forget. In a regulated setting, an answer must be reproducible and attributable to a specific model version — floating aliases like "latest" are a compliance problem, not a convenience.',
  tags: ['compliance', 'design'] },

{ id: 'rg51', topic: 'rag', level: 2,
  q: 'When should you NOT use RAG?',
  lay: 'When the answer is not in documents. If it is a calculation, do the calculation. If it is a database question, query the database. If it is a general knowledge question the model already answers well, retrieval just adds latency and noise.',
  tech: 'Bad fits: <ul><li><b>Aggregation and analytics</b> — "how many refunds last quarter" is text-to-SQL, not similarity search.</li><li><b>Real-time state</b> — order status is an API call, not a document.</li><li><b>General knowledge</b> the model already has — retrieval adds cost and can inject irrelevant context that makes the answer worse.</li><li><b>Style and format problems</b> — that is prompting or fine-tuning.</li><li><b>Tiny stable corpora</b> — if everything fits in the prompt, put it in the prompt (or use CAG) and skip the machinery.</li><li><b>Deterministic lookups</b> — an exact-match key lookup should be an exact-match key lookup.</li></ul>',
  trap: 'The strongest production shape is routing: classify the intent first, then send it to retrieval, to SQL, to an API, or straight to the model. Treating RAG as the answer to every question is the most common architectural mistake in this space.',
  tags: ['design', 'routing'] },

{ id: 'rg52', topic: 'rag', level: 2,
  q: 'What is the "needle in a haystack" test and what does it miss?',
  lay: 'Hide one sentence in a huge document and see if the model can find it. Useful, and much easier than the thing you actually need, which is finding several related facts and reasoning over them.',
  tech: 'Insert a distinctive fact at a controlled depth in a long context and ask for it, sweeping depth and context length. It measures raw retrieval-from-context ability and exposes the lost-in-the-middle sag. What it misses: multi-needle retrieval (find several facts and combine them), reasoning over retrieved content rather than quoting it, distractor robustness (a plausible but wrong passage nearby), and negative cases where the needle is absent and the model should say so. Multi-needle variants and RULER are stronger.',
  trap: 'A model can pass single-needle at 100% and fail badly at "find the three relevant clauses and tell me whether they conflict" — which is what real users ask. Do not accept a needle score as evidence of long-context competence.',
  tags: ['eval', 'long-context'], orig: 38 },

{ id: 'rg53', topic: 'rag', level: 2,
  q: 'How do you handle very long documents — a 500-page contract, say?',
  lay: 'Do not put it all in the prompt. Index it properly by section, retrieve the relevant clauses, and if the question really needs the whole thing, summarise it in pieces and then reason over the summaries.',
  tech: 'Patterns: <ul><li><b>Structure-aware indexing</b> — chunk by clause or section, keep the heading path, and store a document-level summary for routing.</li><li><b>Hierarchical / RAPTOR</b> — build a tree of summaries over clusters of chunks, so a query can retrieve at whichever level of abstraction fits.</li><li><b>Map-reduce</b> — for whole-document questions, summarise each section then combine. Costs many calls; parallelises well.</li><li><b>Extract-then-answer</b> — retrieve widely, extract the relevant spans with a cheap model, then answer over the short extract. Cheaper and more accurate than one enormous prompt.</li><li><b>Route by question type</b> — clause lookup goes to retrieval; "summarise the whole thing" goes to map-reduce.</li></ul>',
  trap: 'Whole-document questions and specific-clause questions need different pipelines. A system that only does one will fail visibly at the other, and classifying the question first is a cheap, high-value step.',
  tags: ['long-documents'], orig: 24 },

{ id: 'rg54', topic: 'rag', level: 3,
  q: 'What is RAPTOR / hierarchical retrieval?',
  lay: 'Build a pyramid of summaries over your documents. A detailed question hits the bottom layer; a broad question hits a higher one. It lets one index answer both "what does clause 4.2 say" and "what is this contract about".',
  tech: 'Recursively cluster chunks by embedding similarity, summarise each cluster with an LLM, embed the summaries, and repeat up several levels. Index every level. At query time, either retrieve across all levels at once (collapsed tree, usually better) or traverse from the top. It addresses the mismatch between question granularity and chunk granularity — a broad question matches a summary node, a specific one matches a leaf. Cost: an LLM pass over the corpus at index time, and re-summarisation when documents change.',
  trap: 'The maintenance cost is the practical objection: changing one document invalidates summaries up the tree. It fits stable corpora far better than fast-changing ones.',
  tags: ['raptor', 'retrieval'] },

{ id: 'rg55', topic: 'rag', level: 2,
  q: 'What is the single biggest mistake teams make with RAG?',
  lay: 'Shipping without a way to measure retrieval. They tune prompts for weeks while the right document was never in the top fifty, and no one checked.',
  tech: 'The failure chain: no eval set → no retrieval metrics → every quality complaint is attributed to "the model hallucinating" → the team tunes prompts and swaps models → nothing improves, because the answering chunk was never retrieved. The fix is one day of work: fifty real questions with the answering chunk labelled, and recall@10 computed. Everything after that becomes measurable. The second biggest mistake, closely related, is treating chunking as an implementation detail rather than the single largest quality lever.',
  trap: 'If you say only one thing in a RAG interview, say this: <b>retrieval quality is the product</b>. If the right chunk is not retrieved, no model and no prompt can save the answer.',
  tags: ['eval', 'process'], orig: 17 },

{ id: 'rg56', topic: 'rag', level: 2,
  q: 'What is memory in a RAG system, and what are its layers?',
  lay: 'Retrieval answers "what do the documents say". Memory answers "what has already been said, and what do we know about this person". They are different stores with different lifetimes, and mixing them up is why assistants either forget your name or confidently quote a conversation that never happened.',
  tech: 'A RAG system typically carries four distinct stores, and it is worth naming them separately because they have different write rules:<ul><li><b>The corpus index</b> — chunked documents. Written by ingestion, read by retrieval, never written by the conversation.</li><li><b>Working memory</b> — the context window for this request: system prompt, retrieved chunks, recent turns, the restated task. Rebuilt every turn.</li><li><b>Conversational memory</b> — recent turns verbatim plus a rolling summary, scoped to the session and regenerated from the original transcript.</li><li><b>Long-term memory</b> — durable facts about the user (semantic) and records of past interactions and their outcomes (episodic), stored separately, retrieved per request by user id plus relevance.</li></ul>The concepts that hold it together: <b>consolidation</b> (extract candidate facts after a turn and reconcile them into ADD / UPDATE / DELETE / NOOP against what is already stored), <b>pinning</b> (ids, names and constraints copied verbatim every turn rather than left to survive in prose), <b>scoping</b> (per user and per tenant, in the retrieval filter AND the cache key), and <b>provenance</b> (when a fact was learned and from where).',
  compare: { cols: ['Corpus index', 'Conversational memory', 'Long-term memory'],
    rows: [
      ['Written by', 'the ingestion pipeline', 'the conversation', 'the consolidation step, after review'],
      ['Lifetime', 'until the document changes', 'the session', 'indefinite, with expiry for state-like facts'],
      ['Retrieved by', 'similarity to the question', 'recency', 'user id plus relevance'],
      ['Trusted because', 'it came from a governed source', 'the user said it, this session', 'it survived reconciliation - which is why the write path matters'],
      ['Failure mode', 'stale or missing documents', 'summary drift, silent truncation', 'contradictory facts, or memory poisoning']
    ] },
  trap: 'The write path into long-term memory is a privilege-escalation surface: a fact stored today is trusted context tomorrow. Never extract memories from retrieved documents or other untrusted content, and always let the user see and delete what is stored.',
  tags: ['memory', 'rag'], orig: 18,
  xref: [['Step a real extract/reconcile pipeline', '../genai_flow/index.html']] }

]);
