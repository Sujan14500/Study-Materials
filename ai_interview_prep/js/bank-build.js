/* ============================================================
   BUILD — the hands-on question. You are given a corpus and a
   blank editor, and asked to write the thing rather than
   describe it. Loaded first, so it opens the bank.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'rg00', topic: 'rag', level: 2,
  q: 'Design a RAG system over a knowledge base folder: what language, what packages, and what does the skeleton code look like?',
  lay: 'You are handed a folder of company documents and a blank file. The job splits in two. Once, up front: read every document, cut it into pieces, turn each piece into numbers and save them. Then, on every question: find the handful of pieces that match, paste them into the prompt next to the question, and let the model write the answer from those pieces only — with the filename beside each claim so the reader can check it.',
  tech: '<p><b>Language:</b> Python 3.11+. Every retrieval library, vector client and model SDK ships a Python client first, so the whole stack is one <code>pip install</code>.</p><p><b>Framework:</b> LangChain, because loader, splitter, retriever and chat model are already the same shape — swapping Chroma for Qdrant, or Voyage for a local embedder, is a one-line change and nothing downstream moves. It is all writable without a framework; you would then be writing that glue yourself.</p><p><b>Packages:</b></p>',
  compare: { cols: ['What it does', 'Why this one', 'Swap it for'],
    rows: [
      ['langchain', 'the glue — retriever interface, prompt piping, the ensemble retriever', 'one import surface everything below plugs into', 'LlamaIndex, or plain functions and no framework'],
      ['langchain-community', 'document loaders and the BM25 retriever', 'ships loaders for markdown, PDF, HTML, CSV, Confluence and the rest', 'unstructured, for PDFs that fight back'],
      ['langchain-text-splitters', 'cuts documents into chunks', 'recursive splitting on paragraph then sentence is the right day-one default', 'a document-aware splitter once the corpus has real headings'],
      ['langchain-voyageai', 'turns chunks and questions into vectors', 'voyage-3 is a strong retrieval embedder and pairs with Claude', 'sentence-transformers with bge-base, for local and free'],
      ['langchain-chroma', 'stores the vectors and searches them', 'runs in-process, persists to a folder, no server to operate', 'Qdrant or pgvector when one box is no longer enough'],
      ['langchain-anthropic', 'the generator', 'ChatAnthropic wraps the Messages API and takes the retrieved context', 'any other LangChain chat model — the chain does not change'],
      ['rank_bm25', 'the keyword lane of the hybrid search', 'catches order ids, error codes and rare terms that embeddings blur together', 'Elasticsearch or OpenSearch once the corpus is large']
    ] },
  dgm: { nodes: ['load folder', { t: 'split', s: '800 / 120' }, { t: 'embed', s: 'voyage-3', k: 'alt' }, 'Chroma', { t: 'retrieve', s: 'dense + BM25' }, { t: 'prompt', s: 'context + question' }, { t: 'generate', s: 'answer + sources' }],
    cap: 'The first four boxes run once at index time, and again whenever a document changes. The last three run on every question.' },
  code: `"""rag.py — a knowledge-base folder in, grounded answers out.
   pip install langchain langchain-community langchain-text-splitters
               langchain-voyageai langchain-chroma langchain-anthropic rank_bm25
   env: ANTHROPIC_API_KEY, VOYAGE_API_KEY"""

from pathlib import Path

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_voyageai import VoyageAIEmbeddings
from langchain_chroma import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

KB_DIR = Path("knowledge_base")
DB_DIR = "chroma_db"
TOP_K = 5

embeddings = VoyageAIEmbeddings(model="voyage-3")
llm = ChatAnthropic(model="claude-opus-5", max_tokens=2000)
# no temperature argument: Opus 5 rejects sampling parameters with a 400.

# ---- 1. INDEX: runs once, and again whenever a document changes ----
def build_chunks():
    docs = DirectoryLoader(str(KB_DIR), glob="**/*.md", loader_cls=TextLoader).load()
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=800, chunk_overlap=120, add_start_index=True
    ).split_documents(docs)
    for c in chunks:                      # the filename is what the answer will cite
        c.metadata["source"] = Path(c.metadata["source"]).name
    return chunks

def build_store(chunks):
    if Path(DB_DIR).exists():             # already embedded: do not pay for it twice
        return Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
    return Chroma.from_documents(chunks, embeddings, persist_directory=DB_DIR)

# ---- 2. RETRIEVE: meaning lane and keyword lane, fused ----
def build_retriever(chunks, store):
    dense = store.as_retriever(search_kwargs={"k": TOP_K})
    sparse = BM25Retriever.from_documents(chunks)
    sparse.k = TOP_K
    return EnsembleRetriever(retrievers=[dense, sparse], weights=[0.5, 0.5])

# ---- 3. GENERATE: answer from the context, or admit it is not there ----
PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "Answer using the context below and nothing else. After each claim, cite the "
     "source filename in square brackets. If the context does not answer the "
     "question, say you do not know — do not fill the gap from memory."),
    ("human", "Question: {question}\\n\\nContext:\\n{context}"),
])

def format_docs(docs):
    return "\\n\\n".join("[" + d.metadata["source"] + "]\\n" + d.page_content
                       for d in docs)

def answer(question, retriever):
    docs = retriever.invoke(question)
    if not docs:                          # empty retrieval is a real case, not an edge case
        return "Nothing in the knowledge base covers that.", []
    chain = PROMPT | llm | StrOutputParser()
    text = chain.invoke({"question": question, "context": format_docs(docs)})
    return text, docs

# ---- 4. ASK ----
if __name__ == "__main__":
    chunks = build_chunks()
    retriever = build_retriever(chunks, build_store(chunks))
    while True:
        q = input("ask> ").strip()
        if not q:
            break
        text, used = answer(q, retriever)
        print(text)
        print("sources:", sorted({d.metadata["source"] for d in used}))`,
  trap: 'The follow-up is always "what would you add second?", and the honest order is: an eval set of 30–50 real questions with known answers, so every later change is measurable; a cross-encoder reranker over a wider candidate pool, which is the biggest single quality jump; metadata filters and permission checks applied <i>before</i> retrieval rather than after, so a user never sees a chunk they are not allowed to read; then incremental re-indexing keyed on a content hash, because rebuilding the whole store on every document edit stops being acceptable at around ten thousand chunks. Two smaller ones interviewers like to hear you volunteer: BM25 here is rebuilt in memory at boot, which does not survive a large corpus, and the chunk size and overlap are guesses until the eval set has an opinion about them.',
  tags: ['rag', 'coding', 'skeleton', 'langchain'],
  xref: [['Build the same pipeline step by step', '../langchain/index.html'], ['Chunking and retrieval, drawn', '../genai_flow/index.html']] }

]);
