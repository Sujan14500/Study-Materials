# Jupyter notebooks — the practical half

The rest of this repo explains things. This folder makes you **do** them: runnable notebooks covering
Python, DSA, NumPy/Pandas/PyTorch, machine learning, deep learning, how LLMs work, LLM apps, RAG,
Hugging Face, fine-tuning (LoRA, QLoRA, DPO), evaluation, LangChain, LangGraph, agents and production
engineering — plus the hands-on coding rounds interviewers actually give ("build a RAG skeleton",
"build an agent in 30 minutes").

It is the practical companion to [`../ai_interview_prep`](../ai_interview_prep/index.html): every notebook
opens with a table of the theory questions it makes concrete, and [`INTERVIEW_MAP.md`](INTERVIEW_MAP.md)
goes the other way — from any of the 596 theory questions to the notebook where you can run the answer.

Everything is small on purpose: toy datasets, tiny models, CPU only, each notebook runs top to bottom in
about a minute, and nothing costs money unless you choose to use a real API key.

## Start here

**→ [`00_start_here/00_how_to_use_these_notebooks.ipynb`](00_start_here/00_how_to_use_these_notebooks.ipynb)** —
setup, how the LLM switch works, a version check of every package, and three study tracks.

**→ [`00_start_here/01_quick_interview_topics.ipynb`](00_start_here/01_quick_interview_topics.ipynb)** —
one-screen answers with code for the topics that come up constantly: Jev & Laya (System-1 decision models),
Power BI-style quick charts, overfitting, quantization, LiteLLM, reranking, BM25, KV cache,
semantic chunking, Pydantic, p95 latency, `np.random.seed`.

## Setup (Windows, once)

```bat
cd jupyter_notebooks
python -m venv .venv
.venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python -m ipykernel install --user --name study-notebooks --display-name "Study Notebooks (.venv)"
```

The last line registers the venv as the Jupyter kernel every notebook asks for, so VS Code and
JupyterLab pick it automatically. Open any notebook and **Run All**. If you ever see
`ModuleNotFoundError: No module named 'matplotlib'` (or numpy, torch, ...), the notebook is running
on your global Python instead: click the kernel name at the top right and choose
**Study Notebooks (.venv)**.
The Hugging Face, RAG and fine-tuning notebooks download a few small models on first run
(about 750 MB in total, cached afterwards in `~/.cache/huggingface`).

## Which LLM do the notebooks call?

Every notebook that needs a model gets it from [`llm_setup.py`](llm_setup.py), which hands back a real
`openai.OpenAI` client — so the code you practise is the code you would ship. What is behind it:

| Provider | When | Cost |
|---|---|---|
| **offline** (default) | no key, no Ollama | free — a deterministic stand-in answers so every cell runs; answers are canned, not intelligent |
| **OpenAI** | `OPENAI_API_KEY` in `jupyter_notebooks/.env` (copy [`.env.example`](.env.example)) | cents per notebook with `gpt-4.1-mini` |
| **Ollama** (local) | [Ollama](https://ollama.com) running, `ollama pull qwen2.5:3b` | free, private, runs on your laptop |

Auto-detected in that order of preference (OpenAI, then Ollama, then offline), or forced with
`LLM_PROVIDER=openai|ollama|offline`. Ollama speaks the OpenAI API, so switching changes the base URL
and nothing else. `.env` is gitignored — never commit a key.

## What is in here

| Folder | What you practise |
|---|---|
| [`00_start_here`](00_start_here) | Setup, the provider switch, study tracks, and quick answers to the most frequent interview topics |
| [`01_python_basics`](01_python_basics) | 17 notebooks: types, strings, collections, control flow, functions, generators, OOP, errors, files/JSON, stdlib, decorators, type hints & Pydantic, async, testing, gotchas, and tqdm progress bars + Gradio apps |
| [`02_python_problems`](02_python_problems) | Warm-ups, string and list/dict problems, and the practical AI-engineer tasks (parse LLM JSON, chunk text, token budgets, backoff, rate limits, PII redaction) |
| [`03_dsa`](03_dsa) | 14 notebooks, pattern by pattern: Big-O, two pointers, sliding window, stacks, linked lists, binary search, sorting, backtracking, trees, heaps/top-k, graphs, DP, greedy, tries/union-find/LRU |
| [`04_numpy_pandas_pytorch`](04_numpy_pandas_pytorch) | The three libraries every AI engineer uses daily, plus matplotlib and Power BI-style quick charts |
| [`05_machine_learning`](05_machine_learning) | Splits and leakage, regression and gradient descent, classification, metrics, overfitting & CV, trees & boosting, kNN/SVM/NB, clustering & PCA, pipelines |
| [`06_deep_learning`](06_deep_learning) | Backprop from scratch, training loops & LR schedules, regularisation & normalisation, CNNs, embeddings → RNNs → attention |
| [`07_genai_foundations`](07_genai_foundations) | Tokenization (BPE), embeddings, attention, a tiny GPT trained from scratch, decoding, KV cache, quantization |
| [`08_llm_apps`](08_llm_apps) | The OpenAI API, prompting, structured outputs, function calling, local LLMs with Ollama, conversation memory |
| [`09_rag`](09_rag) | Chunking (incl. semantic), BM25, vector search (FAISS, HNSW), hybrid + RRF, reranking, a full pipeline, advanced RAG, and reading PDFs: text layers, two-column order, tables, a per-page OCR router, HunyuanOCR-1.5 and the maths of its speculative decoding |
| [`10_huggingface`](10_huggingface) | Hub & pipelines, tokenizers & `generate`, `datasets`, sentence-transformers, the Trainer, bitsandbytes quantization |
| [`11_finetuning`](11_finetuning) | When to fine-tune, SFT with loss masking, LoRA from scratch, LoRA with PEFT, QLoRA, DPO, distillation, the OpenAI fine-tuning API |
| [`12_evaluation`](12_evaluation) | EM/F1/BLEU/ROUGE, LLM-as-judge and its biases, RAG evaluation, agent evaluation, statistics for evals |
| [`13_langchain`](13_langchain) | LangChain 1.x: models & prompts, LCEL, structured output & tools, retrievers, the RAG chain, agents & memory |
| [`14_langgraph`](14_langgraph) | State graphs, conditional edges & loops, checkpointing & time travel, human-in-the-loop, ReAct agents, supervisors |
| [`15_agentic_ai`](15_agentic_ai) | Agents from scratch: the loop, tool design, ReAct & plan-and-execute, memory, multi-agent, guardrails, MCP, System-1 decision models (Jev & Laya) |
| [`16_production`](16_production) | Async concurrency, retries & circuit breakers, caching, FastAPI streaming, p50/p95 & cost, LiteLLM routing, PII & prompt injection, tracing |
| [`17_interview_coding_rounds`](17_interview_coding_rounds) | The blank-editor rounds: RAG skeleton, agent in 30 minutes, chat API, semantic search service, eval harness, ML end to end, implement-from-scratch drills |

## How every notebook is laid out

1. **Why this matters in interviews**, and a table of the **theory questions** it answers (IDs link to the bank).
2. Concepts, each explained in plain English first, then with the mechanism and the numbers, then in code.
   Most mechanisms are built from scratch and then checked against the library with an `assert`.
3. Charts wherever a picture beats a paragraph.
4. **Try it yourself** exercises, with solutions directly below (try first).
5. **Say it in an interview**: the 30-second answer, the numbers, the follow-up they will ask and the trap.

Outputs are not saved in the files: predict what a cell will print, then run it.

## Tests

```bat
python run_all_notebooks.py              :: every notebook, offline, free
python run_all_notebooks.py 09_rag       :: one section
python run_all_notebooks.py --jobs 4     :: in parallel
python build_interview_map.py            :: rebuild INTERVIEW_MAP.md (fails on unknown question IDs)
```

The notebooks are full of `assert`s that re-derive what the prose claims — that the merged LoRA weights
give identical outputs, that NF4 beats uniform int4 on normal weights, that the KV cache changes speed and
not the tokens, that BM25 puts the exact error code first. If an edit makes a notebook teach something
false, the run fails. Test runs always use the offline stand-in, even if `.env` holds a key.
