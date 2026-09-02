# AI Interview Prep

558 GenAI and AI-engineer interview questions, each answered twice — once in plain
English so it sticks, once at interview depth so it survives the follow-up — plus
236 multiple-choice questions, flashcards with spaced repetition, and a timed mock
interview that makes you answer out loud.

Built because the gap between *"I know this"* and *"I can say this in ninety
seconds"* is the reason people fail interviews they were qualified for.

## Run it

Open `index.html` in a browser. No build, no server, no dependencies.

```
start index.html          # Windows
open index.html           # macOS
```

## The five modes

| Mode | What it is for |
|------|----------------|
| **Study** | Browse and search all 558 questions. Filter by topic, level and status. Every card opens to a plain-English answer, a technical answer, a comparison table or diagram where one helps, and *the follow-up they will ask*. Mark questions known or starred. |
| **Flashcards** | Recall, not recognition. Say the answer out loud, flip, then rate yourself. Cards you rate badly come back sooner — the schedule is SM-2-lite and lives in `localStorage`. |
| **Quiz** | Multiple choice with an explanation after every question, optionally timed. Every wrong option is a real misconception, and the explanation says why the tempting answer is wrong. |
| **Mock interview** | A timed round for a chosen role and level. Questions arrive one at a time with a clock and a target answer length. Reveal, self-rate, and get a report with your weakest topic and how often you ran long. |
| **Progress** | Mastery per topic — because an average of 70% hides the topic at 20% that will be the question you get asked. Plus quiz history and what to do next. |
| **Study paths** | Seven ordered routes (two-week crash, GenAI engineer, AI engineer, RAG specialist, agent engineer, LLMOps, complete beginner), each linking to the topics here and to the interactive course in this repo that teaches the underlying idea properly. |

## Topics

| Topic | Questions | Covers |
|-------|-----------|--------|
| Foundations | 32 | tokens, embeddings, context, sampling, hallucination, when not to use an LLM |
| Transformers | 36 | attention, feed-forward, residual stream, RoPE, GQA, prefill vs decode, KV cache |
| Training & tuning | 40 | pretraining, SFT, LoRA, QLoRA, DPO, RLHF, GRPO, distillation, forgetting |
| Inference & serving | 42 | KV cache, prompt caching, batching, PagedAttention, quantisation, routing, cost |
| Prompting & context | 32 | few-shot, chain of thought, structured output, memory layers, context engineering |
| RAG | 56 | chunking, hybrid search, reranking, agentic RAG, GraphRAG, OKF, failure modes |
| Vectors & search | 32 | cosine, HNSW, IVF, product quantisation, BM25, Elasticsearch, filtered ANN |
| Agents & tools | 45 | the loop, harness engineering, tool design, multi-agent, HITL, the failure playbook |
| Evaluation | 35 | the eval pyramid, LLM-as-judge and its biases, RAGAS, A/B testing, agent eval |
| Safety & guardrails | 28 | injection, memory poisoning, PII, tenant isolation, over-refusal, OWASP LLM Top 10 |
| Production & cost | 42 | caching layers, routing, observability, incidents, SLOs, cost arithmetic |
| Production drills | 40 | the scenario round: 10× spikes, provider outages, 429 storms, shedding, canaries, idempotency |
| Data engineering | 24 | streaming a 5 GB file, external group-by, ingestion, freshness, Parquet, PDFs |
| System design | 22 | long-form whiteboard questions with a structure to follow |
| Behavioural | 20 | the questions that decide the offer, asked of AI engineers specifically |

## What is in an answer

Every question carries:

- **`lay`** — the plain-English answer. No jargon (there is a test for that). This is
  the one you use when a non-technical stakeholder asks.
- **`tech`** — the interview-depth answer, with the numbers and the mechanism.
- **`compare`** — a side-by-side table wherever two things are best learned against
  each other: LoRA vs QLoRA, RAG vs agentic RAG, tensor vs pipeline parallelism,
  BM25 vs dense vs hybrid, bi-encoder vs cross-encoder, and about forty more.
- **`dgm`** — an animated inline flow diagram where the shape of the thing is the point.
- **`code`** — runnable-shaped code where the arithmetic or the API matters.
- **`trap`** — *the follow-up they will ask*. Usually the most valuable field on the card.
- **`xref`** — a link into the interactive course in this repo that teaches it properly.

## The 57 seed questions

This bank was built around 57 real interview questions, and `test.js` asserts that
every one of them is answered somewhere — several are split across multiple cards
because they were really three questions in a trench coat. Ambiguous ones are handled
honestly rather than guessed at: the OKF card says outright that the acronym is not
standardised and tells you to ask which definition they mean.

## Files

```
index.html              all five modes' markup
css/styles.css          one theme, no framework
js/bank-*.js            the question bank, one file per topic — edit here
js/mcq.js               the multiple-choice bank
js/paths.js             the study paths
js/app.js               modes, filtering, spaced repetition, scoring
test.js                 node test.js — fails if the bank goes inconsistent
```

## Testing

`node test.js` checks that every question is well formed and every claim the project
makes is still true:

- 550+ questions, at least 15 per topic, spread across three levels
- every one of the 57 seed questions is answered by at least one card
- **the plain-English answer contains no jargon** — the word list is enforced, with an
  exception only when the question is *about* that term
- every comparison table is rectangular, every diagram has enough nodes to draw
- every cross-reference points at a course folder that exists on disk
- every study-path link resolves
- every element id `app.js` reaches for is created somewhere
- every file `index.html` loads exists, and every file in `js/` is loaded

Two multiple-choice guards worth explaining, because they are the interesting ones:

- **Position.** Options are authored with the answer in a fixed slot, so `renderQuiz`
  shuffles them per question. Without that, "always pick B" scores about 90%. The test
  asserts the shuffle is still in `app.js`, because losing it silently would quietly
  ruin the quiz.
- **Length.** A precise correct answer tends to be longer than a terse misconception,
  which makes "pick the longest option" a real heuristic. 45 option sets were rewritten
  so the distractors are full statements rather than short labels, which brought it from
  87% to 78%. It is tracked and asserted below 80% so it cannot silently get worse — but
  it is not zero, and pretending otherwise would be dishonest. Read the explanations
  rather than pattern-matching on shape.

## Notes on accuracy

- Prices, model names and benchmark figures move. Where a number matters the card says
  what it is a number *of* and how to recompute it — the arithmetic is the durable part.
- Where a term is genuinely contested (OKF, "streaming", "agent"), the card says so and
  gives the readings rather than picking one and sounding confident.
- Techniques attributed to a specific paper or vendor are named as such. Reported
  improvements (contextual retrieval, PagedAttention, speculative decoding) are quoted
  as *reported*, not as guarantees for your corpus.
- Progress, flashcard schedules and quiz history live in `localStorage`. Nothing leaves
  your browser.

## Related

The interactive courses this bank cross-references:

- [`genai_flow`](../genai_flow) — how LLMs actually work, 24 chapters
- [`agentic_ai_flow`](../agentic_ai_flow) — agent architecture, 17 chapters
- [`ai_system_design_concepts`](../ai_system_design_concepts) — the systems layer, 23 chapters
- [`langchain`](../langchain) and [`langgraph`](../langgraph) — the frameworks
- [`projects_walkthrough`](../projects_walkthrough) — two real systems end to end
- [`ml_fundamentals`](../ml_fundamentals), [`dl_fundamentals`](../dl_fundamentals),
  [`python_basics`](../python_basics), [`dsa_basics`](../dsa_basics) — the foundation
