/* ============================================================
   content.js — every piece of course content lives here.
   Edit this file to change the course; demos.js only renders it.
   ============================================================ */
window.C = {};

/* ---------- Ch1: why LangChain (and when not) ---------- */
C.needs = [
  { id: 'one',    label: 'One prompt, one answer',            raw: 8,  lc: 12, ico: '💬',
    note: 'The SDK is already three lines. LangChain adds imports and an abstraction for nothing.' },
  { id: 'swap',   label: 'Swap model providers without a rewrite', raw: 60, lc: 4, ico: '🔀',
    note: 'One interface over every provider. Change the import and the model string; the rest of the chain is untouched.' },
  { id: 'struct', label: 'Reliable structured output',        raw: 45, lc: 6, ico: '🧱',
    note: '`with_structured_output(Schema)` handles the tool-call plumbing, parsing and validation retry.' },
  { id: 'rag',    label: 'RAG over your own documents',       raw: 180, lc: 25, ico: '📚',
    note: 'Loaders, splitters, embeddings and 40+ vector stores behind one retriever interface.' },
  { id: 'stream', label: 'Token streaming through every step', raw: 70, lc: 2, ico: '⚡',
    note: 'Every LCEL runnable implements `.stream()`. You get streaming through the whole chain for free.' },
  { id: 'trace',  label: 'See exactly what the prompt became', raw: 90, lc: 1, ico: '🔍',
    note: 'Set two env vars and every step of every run shows up in LangSmith with inputs, outputs, tokens and latency.' },
  { id: 'agent',  label: 'A tool-calling agent loop',          raw: 120, lc: 20, ico: '🤖',
    note: 'The loop, tool dispatch, error handling and message formatting are already written and tested.' },
  { id: 'graph',  label: 'Branching, loops, human approval',   raw: 250, lc: 60, ico: '🕸️',
    note: 'LangGraph: an explicit state machine with checkpoints, interrupts and resume. Writing this yourself is a real project.' }
];
C.whyVerdicts = [
  { max: 20,  v: 'Skip LangChain.', cls: 'bad',
    t: 'At this scope the provider SDK is smaller, has fewer moving parts, and one less thing to upgrade. Reach for a framework when you have a problem it solves — not before.' },
  { max: 120, v: 'Judgement call.', cls: 'meh',
    t: 'You would save some code but take on an abstraction layer. If only one or two of these matter, write them yourself. If you expect the list to grow, start with LangChain now — retrofitting is worse.' },
  { max: 9999, v: 'Use LangChain.', cls: 'good',
    t: 'This is the shape LangChain exists for: several concerns, several providers, and plumbing that is genuinely tedious and genuinely solved. Rewriting it yourself is a quarter you do not get back.' }
];

/* ---------- Ch2: models and messages ---------- */
C.msgTypes = [
  { k: 'system', name: 'SystemMessage', ico: '⚙️', color: '#22c55e',
    desc: 'Standing instructions. Persona, rules, format, tone. Sent once at the top of every request.',
    example: 'You are a terse SRE assistant. Answer in at most 3 sentences. If you are unsure, say so.' },
  { k: 'human', name: 'HumanMessage', ico: '🧑', color: '#38bdf8',
    desc: 'What the user said. Can hold text, images or files.',
    example: 'Why did the checkout service page us at 22:14?' },
  { k: 'ai', name: 'AIMessage', ico: '🤖', color: '#a78bfa',
    desc: 'What the model replied. Also carries tool calls, token usage and the response id.',
    example: 'Connection pool exhaustion after the 22:10 deploy. Rolled back at 22:58.' },
  { k: 'tool', name: 'ToolMessage', ico: '🔧', color: '#fbbf24',
    desc: 'The result of a tool the model asked for. Must carry the tool_call_id it answers.',
    example: '{"p95_ms": 812, "pool_max": 20, "pool_in_use": 20}' }
];
C.modelKnobs = [
  ['model', 'Which model. `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5` — capability and price differ by roughly 5× across the range.'],
  ['temperature', '0 for extraction, classification and anything reproducible. Higher for drafting and ideation. Most production chains want 0.'],
  ['max_tokens', 'Ceiling on the reply. Too low truncates mid-sentence; the model does not know the cap exists.'],
  ['timeout', 'Always set one. A hanging model call with no timeout blocks the whole chain.'],
  ['max_retries', 'The integrations retry 429s and 5xx with backoff. Default is 2; raise it for batch jobs, lower it for interactive paths.'],
  ['streaming', 'Not a constructor flag you need — call `.stream()` on any runnable and it streams end to end.']
];

/* ---------- Ch3: prompt templates ---------- */
C.tplPresets = [
  { name: 'Support reply',
    tpl: 'You are a support engineer at {company}.\nTone: {tone}.\n\nCustomer said: {question}\n\nAnswer in under {limit} words. If you do not know, say so and offer to escalate.',
    vars: { company: 'Northwind', tone: 'direct and warm', question: 'SSO keeps bouncing me back to the login screen', limit: '60' } },
  { name: 'Extraction',
    tpl: 'Extract the fields from the text below.\nReturn ONLY JSON matching: {schema}\n\nText:\n"""\n{text}\n"""',
    vars: { schema: '{{"name": str, "company": str, "intent": str}}', text: 'Hi, Priya here from Northwind — we want to talk about enterprise pricing.' } },
  { name: 'Few-shot classify',
    tpl: 'Classify the ticket into: billing | bug | feature | other.\n\nExamples:\n"Charged twice this month" -> billing\n"Export button does nothing" -> bug\n"Can you add dark mode?" -> feature\n\nTicket: {ticket}\nLabel:',
    vars: { ticket: 'The CSV download is missing the last column' } }
];
C.tplRules = [
  ['Templates are not f-strings',
   'A template is a declared object with named inputs. It validates that you supplied them, it composes with other runnables, and it shows up in traces as a step you can inspect.',
   `# f-string: the hole is filled before LangChain ever sees it
p = f"Translate to {lang}: {text}"      # NameError at best

# template: declares its inputs, and checks them
tpl = ChatPromptTemplate.from_template(
    "Translate to {language}: {text}")

tpl.input_variables             # ['language', 'text']  <- it knows
tpl.invoke({"text": "hi"})      # KeyError: missing {'language'}

# and it is a runnable, so it composes:
chain = tpl | model | parser`],

  ['Escape literal braces',
   'Inside a template, \`{\` starts a variable. To emit a literal brace — a JSON example, say — write \`{{\` and \`}}\`.',
   `# WRONG — and note it does not raise. the brace is silently read
# as a variable named '"name"', and you find out at call time.
bad = ChatPromptTemplate.from_template('Return JSON: {"name": str}')
bad.input_variables         # ['"name"']  <- one you never asked for

# RIGHT — double each brace to emit one
tpl = ChatPromptTemplate.from_template(
    'Return JSON matching: {{"name": str}}\\n\\nText: {text}')

tpl.input_variables         # ['text']  <- one variable, as intended
tpl.format(text="hi")
# 'Human: Return JSON matching: {"name": str}\\n\\nText: hi'`],

  ['Put the variable part last',
   'Prompt caching matches on a stable prefix. A timestamp near the top of a long system prompt silently destroys every cache hit below it.',
   `# WRONG — the timestamp changes every call, so the 2,000 words of
# policy underneath it are never the same prefix twice. nothing
# after the first changed token can be cached.
ChatPromptTemplate.from_messages([
    ("system", "Now: {now}\\n\\n" + POLICY),
    ("human",  "{question}"),
])

# RIGHT — stable bytes first, volatile bytes last
ChatPromptTemplate.from_messages([
    ("system", POLICY),             # identical every call -> cache hit
    ("system", "Now: {now}"),       # volatile, and cheap to re-read
    ("human",  "{question}"),
])`],

  ['MessagesPlaceholder for history',
   'Do not string-concatenate a transcript into one blob. \`MessagesPlaceholder("history")\` splices in a real list of messages and keeps roles intact.',
   `# WRONG — roles flattened into prose. the model can no longer tell
# who said what, and any tool calls in the history are destroyed.
("human", "Earlier:\\n" + "\\n".join(
    f"{m.type}: {m.content}" for m in history))

# RIGHT — a real list of messages, spliced in with roles intact
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a support engineer at {company}."),
    MessagesPlaceholder("history"),
    ("human", "{question}"),
])

prompt.invoke({"company": "Northwind",
               "history": [HumanMessage("hi"), AIMessage("hello")],
               "question": "SSO keeps bouncing me"})`],

  ['Partial early',
   '\`prompt.partial(company="Northwind")\` locks in what you already know and leaves a smaller template for the caller to fill.',
   `base = ChatPromptTemplate.from_template(
    "You are a support engineer at {company}.\\n"
    "Tone: {tone}.\\n\\n{question}")

base.input_variables        # ['company', 'question', 'tone'] — sorted

# fix what you already know, once, at startup:
support = base.partial(company="Northwind", tone="direct and warm")

support.input_variables     # ['question']  <- callers fill one thing
support.invoke({"question": "SSO keeps bouncing me"})

# a callable is re-evaluated on every call, not frozen at partial time:
base.partial(now=lambda: datetime.now().isoformat())`]
];

/* ---------- Ch4: LCEL ---------- */
C.lcelParts = [
  { k: 'prompt', name: 'ChatPromptTemplate', ico: '📝', color: '#38bdf8',
    inp: '{"topic": "vector databases"}',
    out: 'ChatPromptValue([\n  System("You explain things in one sentence."),\n  Human("Explain vector databases.")\n])',
    code: 'prompt = ChatPromptTemplate.from_messages([\n    ("system", "You explain things in one sentence."),\n    ("human", "Explain {topic}."),\n])',
    desc: 'Turns a dict of variables into a list of messages.' },
  { k: 'model', name: 'ChatAnthropic', ico: '🧠', color: '#a78bfa',
    inp: 'ChatPromptValue([...])',
    out: 'AIMessage(content="A vector database stores embeddings and finds the nearest ones to a query vector.",\n  usage_metadata={"input_tokens": 28, "output_tokens": 19})',
    code: 'model = ChatAnthropic(model="claude-opus-5", temperature=0)',
    desc: 'Takes messages, returns an AIMessage.' },
  { k: 'parser', name: 'StrOutputParser', ico: '🔤', color: '#22c55e',
    inp: 'AIMessage(content="A vector database stores...")',
    out: '"A vector database stores embeddings and finds the nearest ones to a query vector."',
    code: 'parser = StrOutputParser()',
    desc: 'Pulls the plain string out of the AIMessage.' },
  { k: 'retriever', name: 'Retriever', ico: '📚', color: '#fbbf24',
    inp: '"vector databases"',
    out: '[Document(page_content="A vector store indexes embeddings..."),\n Document(page_content="Similarity is usually cosine distance...")]',
    code: 'retriever = vectorstore.as_retriever(search_kwargs={"k": 2})',
    desc: 'Takes a query string, returns Documents.' },
  { k: 'lambda', name: 'RunnableLambda', ico: '🪄', color: '#f472b6',
    inp: '[Document(...), Document(...)]',
    out: '"A vector store indexes embeddings...\\n\\nSimilarity is usually cosine distance..."',
    code: 'format_docs = RunnableLambda(\n    lambda docs: "\\n\\n".join(d.page_content for d in docs)\n)',
    desc: 'Wraps any plain function so it becomes a chain step.' }
];
C.lcelMethods = [
  ['invoke(x)', 'One input, one output. The everyday call.'],
  ['stream(x)', 'Yields chunks as they arrive. Works through the whole chain, not just the model.'],
  ['batch([x, y, z])', 'Runs many inputs concurrently with a configurable concurrency limit.'],
  ['ainvoke / astream / abatch', 'Async versions of all three. Same semantics, awaitable.'],
  ['with_retry()', 'Wraps any runnable in exponential backoff on failure.'],
  ['with_fallbacks([other])', 'If this runnable raises, try the next one. Common for cheap-model-first routing.'],
  ['with_config(...)', 'Attach tags, metadata, run names and callbacks — all of which show up in traces.'],
  ['bind(**kwargs)', 'Pin arguments for later calls, e.g. `model.bind(tools=[...])` or `model.bind(stop=["\\n\\n"])`.']
];
C.lcelWiring = [
  { name: 'Sequence', code: 'chain = prompt | model | parser', note: 'Output of each step is the input of the next. 90% of chains are this.' },
  { name: 'Parallel', code: 'chain = RunnableParallel(\n    context=retriever | format_docs,\n    question=RunnablePassthrough(),\n) | prompt | model | parser',
    note: 'A dict of runnables run concurrently. Their outputs become the keys the prompt fills. This is the standard RAG shape.' },
  { name: 'Branch', code: 'chain = RunnableBranch(\n    (lambda x: x["kind"] == "code", code_chain),\n    (lambda x: x["kind"] == "sql",  sql_chain),\n    default_chain,\n)', note: 'Route on a condition. Reach for LangGraph once the branching needs to loop back.' },
  { name: 'Fallback', code: 'chain = (prompt | fast_model | parser).with_fallbacks(\n    [prompt | strong_model | parser]\n)', note: 'Try the cheap model, fall back to the strong one on error. Note it does not fall back on a *bad* answer — only on an exception.' }
];

/* ---------- Ch5: output parsers ---------- */
C.parserModes = [
  { k: 'str', name: 'StrOutputParser', ico: '🔤',
    code: 'chain = prompt | model | StrOutputParser()',
    raw: 'AIMessage(content="Priya from Northwind wants enterprise pricing.")',
    parsed: '"Priya from Northwind wants enterprise pricing."',
    ok: true,
    note: 'The simplest parser. Use it whenever the answer really is prose.' },
  { k: 'json', name: 'JsonOutputParser', ico: '🧾',
    code: 'chain = prompt | model | JsonOutputParser()',
    raw: 'AIMessage(content=\'```json\\n{"name": "Priya", "company": "Northwind"}\\n```\')',
    parsed: '{"name": "Priya", "company": "Northwind"}',
    ok: true,
    note: 'Strips code fences and parses. Works, but nothing checks the shape — a missing key surfaces as a KeyError three functions later.' },
  { k: 'json-bad', name: 'JsonOutputParser (model went off-script)', ico: '💥',
    code: 'chain = prompt | model | JsonOutputParser()',
    raw: 'AIMessage(content="Sure! Here is the JSON you asked for:\\n{\'name\': \'Priya\',}")',
    parsed: 'OutputParserException: Invalid json output',
    ok: false,
    note: 'Single quotes, a trailing comma and a chatty preamble. This is the everyday failure that makes people distrust LLM pipelines — and it is entirely avoidable.' },
  { k: 'structured', name: 'with_structured_output(schema)', ico: '🧱',
    code: 'class Lead(BaseModel):\n    name: str\n    company: str\n    intent: Literal["pricing","support","other"]\n\nchain = prompt | model.with_structured_output(Lead)',
    raw: 'AIMessage(tool_calls=[{"name": "Lead",\n  "args": {"name": "Priya", "company": "Northwind",\n           "intent": "pricing"}}])',
    parsed: 'Lead(name="Priya", company="Northwind", intent="pricing")',
    ok: true,
    note: 'The right answer. The schema is sent as a tool definition, so the model is constrained at generation time rather than corrected afterwards — and you get a typed object, not a dict you hope has the right keys.' }
];

/* ---------- Ch6: loaders and splitters ---------- */
C.splitDoc = 'LangChain is a framework for building applications with language models. It provides a standard interface for models, prompts, retrievers and tools.\n\nThe core abstraction is the Runnable. Every component implements invoke, stream and batch, which is what lets the pipe operator compose them.\n\nRetrieval-augmented generation combines a retriever with a model. Documents are split into chunks, embedded, and stored in a vector store. At query time the nearest chunks are fetched and placed in the prompt.\n\nChunk size is a genuine trade-off. Small chunks retrieve precisely but lose surrounding context. Large chunks carry context but dilute the embedding and waste tokens.';
C.splitters = [
  { k: 'char', name: 'CharacterTextSplitter',
    desc: 'Splits on one separator, then merges pieces up to chunk_size. Simple; happily cuts a sentence in half.',
    use: 'Rarely the right choice. Use it when the document has one obvious hard delimiter.' },
  { k: 'recursive', name: 'RecursiveCharacterTextSplitter',
    desc: 'Tries paragraph breaks first, then lines, then sentences, then words — descending until the chunk fits.',
    use: 'The default, and correct for ~90% of text. Start here.' },
  { k: 'token', name: 'TokenTextSplitter',
    desc: 'Counts tokens rather than characters, so chunks match the model\'s real limit.',
    use: 'When you are packing a context window tightly and character counts are lying to you.' },
  { k: 'markdown', name: 'MarkdownHeaderTextSplitter',
    desc: 'Splits on heading levels and attaches the heading path as metadata on each chunk.',
    use: 'Docs, wikis, runbooks. The heading metadata alone makes retrieval noticeably better.' }
];
C.splitLessons = [
  ['Overlap exists for one reason', 'A fact that straddles a chunk boundary is invisible to retrieval. Overlap of 10–20% of chunk_size buys the boundary back cheaply.'],
  ['Chunk size is a retrieval decision, not a storage one', 'Small chunks give sharp embeddings and vague context; large chunks give rich context and mushy embeddings. 500–1000 characters with 100–200 overlap is a sane starting point.'],
  ['Keep metadata on every chunk', 'Source, title, page, last-updated. You need it for citations, for filtering, and for noticing that an answer came from a document nobody has touched in three years.'],
  ['Split on structure when you have it', 'Headings, functions, table rows. A splitter that respects the document\'s own boundaries beats tuning chunk_size for a week.']
];

/* ---------- Ch7 + 8: embeddings, vector store, RAG ---------- */
C.kb = [
  { id: 'd1', src: 'runbook.md § Deploys', text: 'All production deploys require two approvals and must land before 16:00 UTC on weekdays. Friday deploys are blocked unless the change is tagged hotfix.',
    keys: ['deploy', 'production', 'approval', 'friday', 'hotfix', 'release', 'ship'] },
  { id: 'd2', src: 'runbook.md § Rollback', text: 'To roll back, run `deployctl rollback <service> --to <sha>`. Rollback does not revert database migrations; those need a forward fix.',
    keys: ['rollback', 'revert', 'migration', 'database', 'undo', 'deployctl'] },
  { id: 'd3', src: 'handbook.md § On-call', text: 'On-call rotations are one week, Monday 09:00 to Monday 09:00. Acknowledge a page within 5 minutes; escalate to the secondary after 15.',
    keys: ['on-call', 'oncall', 'rotation', 'page', 'escalate', 'pager', 'shift'] },
  { id: 'd4', src: 'handbook.md § Incidents', text: 'Any customer-visible outage over 5 minutes needs an incident channel, an incident lead and a written summary within 48 hours.',
    keys: ['incident', 'outage', 'postmortem', 'summary', 'severity', 'downtime'] },
  { id: 'd5', src: 'infra.md § Databases', text: 'The primary Postgres cluster runs 16.2 with a connection pool ceiling of 80 per service. Raising it requires a capacity review.',
    keys: ['postgres', 'database', 'connection', 'pool', 'capacity', 'cluster', 'db'] },
  { id: 'd6', src: 'infra.md § Kubernetes', text: 'Clusters are upgraded one minor version at a time, never skipping. Upgrades happen in staging first, with a 72-hour soak.',
    keys: ['kubernetes', 'k8s', 'cluster', 'upgrade', 'version', 'staging', 'soak'] },
  { id: 'd7', src: 'security.md § Access', text: 'Production database access is read-only by default. Write access is granted per-incident and expires automatically after 4 hours.',
    keys: ['access', 'permission', 'production', 'read-only', 'write', 'security', 'grant'] },
  { id: 'd8', src: 'security.md § Secrets', text: 'Secrets live in the vault and are injected at runtime. A secret committed to git must be rotated even if the commit was reverted.',
    keys: ['secret', 'vault', 'credential', 'rotate', 'git', 'key', 'token'] }
];
C.ragQuestions = [
  { q: 'Can I deploy on a Friday?', hint: 'd1' },
  { q: 'How do I roll back a bad release?', hint: 'd2' },
  { q: 'How long is an on-call shift?', hint: 'd3' },
  { q: 'What is the connection pool limit?', hint: 'd5' },
  { q: 'Someone committed an API key — what now?', hint: 'd8' },
  { q: 'What is the capital of Peru?', hint: null }
];
C.ragAnswers = {
  d1: 'Not normally — Friday deploys are blocked unless the change is tagged `hotfix`. On weekdays you also need two approvals and the deploy must land before 16:00 UTC.',
  d2: 'Run `deployctl rollback <service> --to <sha>`. Note it does **not** revert database migrations — those need a forward fix.',
  d3: 'One week, Monday 09:00 to Monday 09:00. Acknowledge a page within 5 minutes and escalate to the secondary after 15.',
  d5: 'The primary Postgres cluster caps connections at 80 per service. Raising that ceiling requires a capacity review.',
  d8: 'Rotate it. A secret committed to git must be rotated even if the commit was reverted — secrets belong in the vault and get injected at runtime.'
};
C.ragNoContext = 'Friday deploys are generally discouraged in most engineering organisations, since fewer people are available over the weekend if something goes wrong. You should check with your team lead.';
C.ragStages = [
  { k: 'question', name: 'Question in', ico: '❓', code: 'chain.invoke("Can I deploy on a Friday?")' },
  { k: 'embed', name: 'Embed the query', ico: '🔢', code: 'embeddings.embed_query(q)  # -> [0.021, -0.113, ...]' },
  { k: 'search', name: 'Similarity search', ico: '🔍', code: 'vectorstore.similarity_search(q, k=3)' },
  { k: 'format', name: 'Format documents', ico: '📄', code: '"\\n\\n".join(d.page_content for d in docs)' },
  { k: 'prompt', name: 'Fill the prompt', ico: '📝', code: 'prompt.invoke({"context": ctx, "question": q})' },
  { k: 'model', name: 'Model answers', ico: '🧠', code: 'model.invoke(messages)' }
];

/* ---------- Ch9: history ---------- */
C.histTurns = [
  { s: 'alice', u: 'Hi, I\'m Alice and I look after the payments service.', a: 'Noted — payments. What can I help with?' },
  { s: 'alice', u: 'What was our p95 last week?', a: 'For payments, p95 was 240ms last week.' },
  { s: 'bob',   u: 'What was our p95 last week?', a: 'Which service do you mean? I do not have a service in context for this session.' },
  { s: 'alice', u: 'And the week before?', a: 'For payments, the previous week was 218ms — so a 10% rise.' },
  { s: 'bob',   u: 'Hi, I\'m Bob, I own search.', a: 'Got it — search. What do you need?' },
  { s: 'bob',   u: 'And my p95?', a: 'For search, p95 was 96ms last week.' }
];
C.histNotes = [
  ['History is per session, not global', '`session_id` is the whole isolation mechanism. Get it wrong and Bob sees Alice\'s context — the most common and most embarrassing bug in this area.'],
  ['The model is still stateless', '`RunnableWithMessageHistory` loads the stored messages and splices them into the prompt before every call. Nothing is remembered inside the model.'],
  ['History costs money on every turn', 'Turn 20 resends turns 1–19. Trim with `trim_messages`, or summarise older turns into one message, before the window and the bill get away from you.'],
  ['Store it somewhere real', 'The in-memory history in the docs is for demos. Production wants Redis, Postgres or the LangGraph checkpointer.'],
  ['Trim on tokens, not turns', '`trim_messages(max_tokens=..., strategy="last", include_system=True)` keeps the system message and the most recent exchanges — dropping the system message by accident changes the assistant\'s personality mid-conversation.']
];

/* ---------- Ch10: tools and agents ---------- */
C.agentTools = [
  { name: 'get_p95', args: 'service: str, window: str', desc: 'Return p95 latency in ms for a service over a window.' },
  { name: 'list_deploys', args: 'service: str, since: str', desc: 'List deploys for a service since a timestamp.' },
  { name: 'open_ticket', args: 'title: str, body: str, severity: str', desc: 'Open a ticket. Writes — gate this one.' }
];
C.agentTrace = [
  { k: 'human', t: 'Checkout feels slow today. Figure out why and open a ticket if it is a regression.' },
  { k: 'ai', t: 'I need the current latency before deciding anything.', tool: 'get_p95(service="checkout", window="24h")' },
  { k: 'tool', t: '{"p95_ms": 812}' },
  { k: 'ai', t: '812ms. I need a baseline to know whether that is unusual.', tool: 'get_p95(service="checkout", window="7d_prior")' },
  { k: 'tool', t: '{"p95_ms": 430}' },
  { k: 'ai', t: 'Nearly double. If something shipped, that is the likely cause.', tool: 'list_deploys(service="checkout", since="48h")' },
  { k: 'tool', t: '[{"sha": "4a91c2", "at": "22:10", "title": "payment client retries"}]' },
  { k: 'ai', t: 'One deploy, right before the change. Confident enough to file it.', tool: 'open_ticket(title="checkout p95 +89% after 4a91c2", severity="high", ...)' },
  { k: 'tool', t: '{"ticket": "OPS-3312"}' },
  { k: 'final', t: 'Checkout p95 went 430ms → 812ms (+89%). The only deploy in the window is 4a91c2 ("payment client retries") at 22:10. Filed OPS-3312 at high severity.' }
];
C.agentCode = 'from langchain.agents import create_tool_calling_agent, AgentExecutor\n\nagent = create_tool_calling_agent(model, tools, prompt)\nexecutor = AgentExecutor(\n    agent=agent,\n    tools=tools,\n    max_iterations=8,        # always cap the loop\n    return_intermediate_steps=True,\n    handle_parsing_errors=True,\n)\nexecutor.invoke({"input": "Checkout feels slow today..."})';
C.agentNotes = [
  ['@tool turns a function into a tool', 'The decorator reads the name, the type hints and the docstring. The docstring is the description the model sees — write it for the model, not for your colleague.'],
  ['Cap max_iterations, always', 'AgentExecutor defaults to 15. An uncapped loop with a paid tool in it is a genuinely bad night.'],
  ['return_intermediate_steps is how you debug', 'Without it you get an answer with no visible path. With it — plus LangSmith — you can see which tool call went wrong.'],
  ['Reach for LangGraph when this stops fitting', 'AgentExecutor is a fixed loop. The moment you need branching, human approval mid-run, or resume-after-failure, you want an explicit graph.']
];

/* ---------- Ch11: LangGraph ---------- */
C.graphNodes = [
  { id: 'retrieve', label: 'retrieve', x: 50, y: 14, ico: '📚',
    desc: 'Search the knowledge base for the question.',
    effect: 'docs = [3 chunks]' },
  { id: 'grade', label: 'grade_docs', x: 50, y: 40, ico: '⚖️',
    desc: 'Ask the model whether the retrieved chunks actually answer the question.',
    effect: 'relevant = ?' },
  { id: 'rewrite', label: 'rewrite_query', x: 15, y: 63, ico: '✏️',
    desc: 'Retrieval missed. Rewrite the question and try again.',
    effect: 'question = rewritten; attempts += 1' },
  { id: 'generate', label: 'generate', x: 72, y: 63, ico: '🧠',
    desc: 'Answer using the retrieved context.',
    effect: 'answer = "..."' },
  { id: 'end', label: 'END', x: 72, y: 88, ico: '🏁',
    desc: 'Graph finishes and returns the final state.',
    effect: '' }
];
C.graphEdges = [
  ['retrieve', 'grade', ''],
  ['grade', 'rewrite', 'not relevant'],
  ['grade', 'generate', 'relevant'],
  ['rewrite', 'retrieve', 'retry'],
  ['generate', 'end', '']
];
C.graphRun = [
  { node: 'retrieve', state: { question: 'friday shipping rules', attempts: 0, docs: 3, relevant: null, answer: null },
    log: 'Retrieved 3 chunks for "friday shipping rules" — mostly about physical shipping, not deploys.' },
  { node: 'grade', state: { question: 'friday shipping rules', attempts: 0, docs: 3, relevant: false, answer: null },
    log: 'Grader says the chunks do not answer the question. Conditional edge routes to rewrite_query.' },
  { node: 'rewrite', state: { question: 'Are Friday production deploys allowed?', attempts: 1, docs: 3, relevant: false, answer: null },
    log: 'Rewrote the query to name the actual concept: production deploys, not shipping.' },
  { node: 'retrieve', state: { question: 'Are Friday production deploys allowed?', attempts: 1, docs: 2, relevant: false, answer: null },
    log: 'Retrieved 2 chunks — the deploy-policy section this time.' },
  { node: 'grade', state: { question: 'Are Friday production deploys allowed?', attempts: 1, docs: 2, relevant: true, answer: null },
    log: 'Relevant. Route to generate.' },
  { node: 'generate', state: { question: 'Are Friday production deploys allowed?', attempts: 1, docs: 2, relevant: true, answer: 'Blocked unless tagged hotfix.' },
    log: 'Answered from the retrieved policy — and it is right this time because the loop noticed the first attempt was not.' },
  { node: 'end', state: { question: 'Are Friday production deploys allowed?', attempts: 1, docs: 2, relevant: true, answer: 'Blocked unless tagged hotfix.' },
    log: 'Final state returned. The whole path above is one trace, and every step was checkpointed.' }
];
C.graphCode = 'from langgraph.graph import StateGraph, START, END\nfrom typing import TypedDict\n\nclass State(TypedDict):\n    question: str\n    docs: list\n    relevant: bool\n    answer: str\n    attempts: int\n\ng = StateGraph(State)\ng.add_node("retrieve", retrieve)\ng.add_node("grade_docs", grade_docs)\ng.add_node("rewrite_query", rewrite_query)\ng.add_node("generate", generate)\n\ng.add_edge(START, "retrieve")\ng.add_edge("retrieve", "grade_docs")\ng.add_conditional_edges(\n    "grade_docs",\n    lambda s: "generate" if s["relevant"] or s["attempts"] >= 2 else "rewrite_query",\n)\ng.add_edge("rewrite_query", "retrieve")\ng.add_edge("generate", END)\n\napp = g.compile(checkpointer=MemorySaver())';
C.graphWhy = [
  ['State is explicit', 'A TypedDict every node reads and updates. No hidden memory, no "where did that value come from" — the state is the contract between nodes.'],
  ['Cycles are first-class', 'LCEL is a DAG; it cannot loop. Retry-until-good, reflect-and-revise, and multi-turn tool loops all need a cycle.'],
  ['Checkpoints mean resume', 'With a checkpointer, a run that crashes at node 4 resumes at node 4. Long agent runs stop being all-or-nothing.'],
  ['Interrupts mean human approval', '`interrupt_before=["execute"]` pauses the graph, hands you the state, and waits. Approve, edit the state, resume.'],
  ['Every node is a normal function', 'Take state, return a dict of updates. Testable without a model, without a mock framework, without ceremony.']
];

/* ---------- Ch12: shipping ---------- */
C.arch = [
  ['Your app', 'FastAPI, a worker, a notebook. LangChain is a library, not a runtime.'],
  ['Chain / graph', 'The composed runnable — the thing you invoke, stream and test.'],
  ['Model integration', '`langchain-anthropic`, `langchain-openai`, … Swappable behind one interface.'],
  ['Retriever + vector store', 'Your documents, chunked, embedded and indexed.'],
  ['Callbacks / LangSmith', 'Traces of every step: inputs, outputs, tokens, latency, errors.'],
  ['Eval suite', 'Golden datasets replayed against the chain on every change.']
];
C.checklist = [
  'Pinned versions for langchain-core and every integration package',
  'Temperature 0 anywhere the output feeds code',
  'Timeouts and max_retries set on every model and every tool',
  'Structured output uses with_structured_output, not a JSON parser over prose',
  'Chat history is trimmed or summarised before it reaches the context limit',
  'Agent loops have max_iterations set explicitly',
  'LangSmith tracing on in staging, sampled in production',
  'A golden dataset of 30+ real inputs replayed on every change',
  'Token usage and cost per request logged per chain',
  'Secrets from the environment — never a key in the notebook',
  'Retrieval evaluated on its own (did the right chunk come back?) before blaming the model',
  'A fallback path for when the model call fails outright'
];
C.debugSteps = [
  ['Print the actual prompt', '`chain.get_prompts()` or set `LANGCHAIN_TRACING_V2=true` and read it in LangSmith. Half of all "the model is wrong" bugs are the template filling in something you did not expect.'],
  ['Check retrieval first, always', 'Call the retriever alone. If the right chunk never came back, no prompt change and no bigger model will save the answer.'],
  ['Invoke each step separately', 'LCEL composes runnables, so `prompt.invoke(x)` and `model.invoke(y)` work standalone. Bisect the chain.'],
  ['Read usage_metadata', 'Every AIMessage carries input and output token counts. When the bill is surprising, this is where the answer is.'],
  ['Set a run name on every step', '`.with_config({"run_name": "grade_docs"})` turns an unreadable trace of anonymous lambdas into something you can scan.']
];
C.ecosystem = [
  ['langchain-core', 'Runnables, messages, prompts, output parsers. Tiny, stable, and the only hard dependency of the rest.'],
  ['langchain', 'Higher-level chains and agent constructors built on core.'],
  ['langchain-anthropic / -openai / …', 'One package per provider. Install only what you use — this is why the mega-package split happened.'],
  ['langgraph', 'Stateful graphs with cycles, checkpoints and interrupts. Where agents belong.'],
  ['langsmith', 'Tracing, datasets and evaluation. Works with or without the rest of LangChain.'],
  ['langserve', 'Turns a runnable into a REST endpoint with streaming and a playground.']
];

/* ---------- Ch13: quiz ---------- */
C.quiz = [
  { q: 'What does the `|` operator actually do in LCEL?', o: ['Runs both sides in parallel', 'Composes two Runnables so the left one\'s output becomes the right one\'s input', 'Pipes text through a shell', 'Concatenates two prompts'], a: 1,
    e: 'It builds a RunnableSequence. Because every component implements the same interface, composition is uniform — and the sequence itself is a Runnable you can compose further.' },
  { q: 'Which message type carries the result of a tool the model asked for?', o: ['SystemMessage', 'ToolMessage', 'AIMessage', 'HumanMessage'], a: 1,
    e: 'ToolMessage, and it must carry the `tool_call_id` of the request it answers, or the model cannot match result to call.' },
  { q: 'Why prefer `with_structured_output(Schema)` over `JsonOutputParser`?', o: ['It is faster', 'It constrains generation via a tool schema and returns a validated object, instead of parsing prose after the fact', 'It uses fewer tokens', 'It works without a model'], a: 1,
    e: 'A parser cleans up after the model. Structured output changes what the model is allowed to emit in the first place — and hands you a typed object rather than a dict you hope has the right keys.' },
  { q: 'What is chunk overlap for?', o: ['Making retrieval faster', 'Preventing a fact that straddles a chunk boundary from being lost', 'Reducing storage', 'Improving embedding quality generally'], a: 1,
    e: 'Without overlap, a sentence split across two chunks is fully present in neither, so neither embeds it well. 10–20% of chunk_size is the usual range.' },
  { q: 'A RAG answer is wrong. What do you check first?', o: ['The model version', 'Whether the retriever returned the right chunk', 'The temperature', 'The prompt wording'], a: 1,
    e: 'If the correct chunk never reached the prompt, no model or prompt change can fix the answer. Always test retrieval in isolation first.' },
  { q: 'What does `RunnableParallel` (or a plain dict in a chain) do?', o: ['Runs the same input through several runnables concurrently and returns a dict of their outputs', 'Runs one runnable on several inputs', 'Splits the model across GPUs', 'Retries on failure'], a: 0,
    e: 'It is the standard RAG shape: `{"context": retriever | format, "question": RunnablePassthrough()}` fans one question out and hands the prompt both keys.' },
  { q: 'In `RunnableWithMessageHistory`, what does `session_id` control?', o: ['Which model is used', 'Which stored conversation is loaded and appended to', 'The cache key for prompts', 'The trace name'], a: 1,
    e: 'It is the entire isolation boundary between users. Reusing one session_id across users leaks conversations — the classic bug in this area.' },
  { q: 'What must you always set on an AgentExecutor?', o: ['streaming=True', 'max_iterations', 'temperature=1', 'verbose=True'], a: 1,
    e: 'An uncapped agent loop is an uncapped bill. Set it explicitly rather than relying on the default of 15.' },
  { q: 'What can LangGraph do that a plain LCEL chain cannot?', o: ['Call a model', 'Cycles, persisted checkpoints and mid-run interrupts', 'Stream tokens', 'Use tools'], a: 1,
    e: 'LCEL is a DAG — it cannot loop back. Retry-until-good, human approval mid-run and resume-after-crash all need an explicit stateful graph.' },
  { q: 'A node in a LangGraph graph is…', o: ['A subclass of a special Node class', 'A normal function that takes the state and returns a dict of updates', 'A prompt template', 'A vector store index'], a: 1,
    e: 'Which is why nodes are trivially testable — call the function with a dict, assert on the dict you get back. No model required.' },
  { q: 'Your chat app gets slower and more expensive as conversations go on. Most likely cause?', o: ['The vector store is fragmenting', 'The whole message history is resent on every turn', 'The model is degrading', 'Callbacks are leaking'], a: 1,
    e: 'Every call is stateless, so turn 20 resends turns 1–19. Fix it with `trim_messages` or a rolling summary — not with a bigger model.' },
  { q: 'Which is the honest reason NOT to use LangChain?', o: ['It is always slower', 'For a single prompt with one provider, the provider SDK is less code and one less abstraction to upgrade', 'It cannot stream', 'It only supports one model'], a: 1,
    e: 'Frameworks earn their keep on plumbing — swapping providers, RAG, tracing, agent loops. For one call to one provider they are pure overhead, and saying so is not heresy.' }
];

/* ---------- glossary ---------- */
C.glossary = [
  ['Runnable', 'The core interface. Anything with invoke / stream / batch — and therefore anything you can compose with `|`.'],
  ['LCEL', 'LangChain Expression Language — composing Runnables with the pipe operator.'],
  ['RunnableSequence', 'What `a | b | c` builds. Output of each step feeds the next.'],
  ['RunnableParallel', 'A dict of Runnables run concurrently; the result is a dict of their outputs.'],
  ['RunnablePassthrough', 'Passes its input through unchanged. Used to hand the raw question to a later step.'],
  ['RunnableLambda', 'Wraps a plain function so it becomes a chain step with the full Runnable interface.'],
  ['ChatPromptTemplate', 'A declared prompt with named variables that renders to a list of messages.'],
  ['MessagesPlaceholder', 'A slot in a prompt template where a list of messages (usually history) is spliced in.'],
  ['SystemMessage / HumanMessage / AIMessage / ToolMessage', 'The four message roles LangChain uses across every provider.'],
  ['Output parser', 'Converts a model response into a usable type — string, JSON, or a validated object.'],
  ['with_structured_output', 'Binds a schema as a tool so the model is constrained to produce it, returning a typed object.'],
  ['Document', 'A `page_content` string plus a `metadata` dict. The unit everything retrieval-related moves around.'],
  ['Document loader', 'Reads a source — PDF, web page, database, S3 — into Documents.'],
  ['Text splitter', 'Cuts Documents into chunks small enough to embed and retrieve usefully.'],
  ['Chunk overlap', 'Characters repeated between adjacent chunks so a fact on a boundary is not lost.'],
  ['Embeddings', 'A model turning text into a vector. Similar meanings land close together.'],
  ['Vector store', 'Storage plus nearest-neighbour search over embeddings. Chroma, FAISS, pgvector, Pinecone…'],
  ['Retriever', 'Anything that takes a query string and returns Documents. The interface RAG chains depend on.'],
  ['RAG', 'Retrieval-Augmented Generation — fetch relevant text, then put it in the prompt.'],
  ['Reranker', 'A second model that re-sorts retrieved chunks by true relevance before they hit the prompt.'],
  ['Tool', 'A Python function exposed to the model via `@tool`. The docstring is the description the model reads.'],
  ['AgentExecutor', 'The classic tool-calling loop: call model, run tool, repeat until final answer or max_iterations.'],
  ['LangGraph', 'Stateful graphs with cycles, checkpoints and interrupts. Where agents belong now.'],
  ['State (LangGraph)', 'The TypedDict every node reads and updates. The explicit contract between nodes.'],
  ['Conditional edge', 'A function that inspects state and returns the name of the next node. How branching works.'],
  ['Checkpointer', 'Persists graph state after every node, so a run can resume or be inspected mid-flight.'],
  ['Interrupt', 'Pausing a graph before or after a node, typically for human approval, then resuming.'],
  ['Callbacks', 'Hooks fired on start/end/error of every runnable. How tracing and streaming are implemented.'],
  ['LangSmith', 'Tracing, dataset and evaluation platform. Independent of the rest of LangChain.'],
  ['LangServe', 'Turns a Runnable into a REST endpoint with streaming and a playground UI.'],
  ['bind()', 'Pins arguments for later invocations, e.g. `model.bind(tools=[...])`.'],
  ['with_fallbacks()', 'Try the next runnable if this one raises. Common for cheap-model-first routing.']
];

/* ------------------------------------------------------------
   Plain-English openers — one per chapter, keyed by data-id.
   Rendered by initPlain() into a <details> under each ch-head.
   Every entry pairs an everyday example with the same idea in code.
   ------------------------------------------------------------ */
C.plain = {

welcome: {
  q: 'What even is LangChain?',
  lay: {
    t: 'A box of parts, not a robot',
    b: 'LangChain and LangGraph are free Python packages — things you install, like adding a plugin to a word processor. They are not an AI. They do not think, and they cannot answer a question.\n\nThe AI itself lives somewhere else, on a company’s server, and you talk to it over the internet. These packages are the wiring around that call: fetching the right document first, remembering what was said earlier, retrying when it fails.\n\nIf the restaurant is the AI, LangChain is the delivery bike. It does not cook.'
  },
  tech: {
    t: 'They are ordinary dependencies',
    b: 'Installed with pip, imported like anything else. No account, no server, no background process.',
    code: 'pip install langchain langgraph\n\n# then, in your own code:\nfrom langchain_core.prompts import ChatPromptTemplate\nfrom langgraph.graph import StateGraph\n\n# you still need an API key for the actual model,\n# and you still pay that provider per call'
  }
},

why: {
  q: 'Why not just call the AI directly?',
  lay: {
    t: 'Hanging one picture vs fitting a kitchen',
    b: 'One picture on the wall: buy a hammer. Buying a whole workshop for it is silly — you would spend the afternoon learning the tools instead of hanging the picture.\n\nFitting an entire kitchen: now the workshop pays for itself. Twenty jobs, each needing a different tool, and every tool you skip is one you have to make yourself.\n\nSame trade here. One question, one answer? Call the AI directly — six lines, done. Loading documents, remembering conversations, calling tools, retrying when things fail? That is the kitchen, and LangChain is the workshop.'
  },
  tech: {
    t: 'The six-line version really is six lines',
    b: 'This is the whole app, when the app is one call. A framework on top of this buys you nothing.',
    code: 'import anthropic\nclient = anthropic.Anthropic()\n\nmsg = client.messages.create(\n    model="claude-sonnet-5",\n    max_tokens=500,\n    messages=[{"role": "user", "content": "What is a Python list?"}],\n)\nprint(msg.content[0].text)\n\n# now add: your PDFs, conversation memory, three tools,\n# retries and streaming. that is when it stops being six lines.'
  }
},

models: {
  q: 'Does the AI remember me?',
  lay: {
    t: 'It has no memory whatsoever',
    b: 'Picture writing to a pen pal who forgets you completely the moment they post their reply. Not rude — genuinely blank.\n\nSo to hold a conversation, you re-send the entire correspondence every single time. Your first letter, their reply, your second letter, their reply, and finally your new question. All of it, every time.\n\nThat is exactly what a chat app does behind the scenes. The "conversation" is an illusion built by resending the transcript. Which is also why long chats get slower and cost more — the letter keeps getting fatter.'
  },
  tech: {
    t: 'A list goes in, one message comes out',
    b: 'That is the entire contract, and it is identical across providers — which is what makes swapping them a one-line change.',
    code: 'messages = [\n    {"role": "system",    "content": "You are a terse assistant."},\n    {"role": "user",      "content": "What is Python?"},\n    {"role": "assistant", "content": "A programming language."},\n    {"role": "user",      "content": "Who made it?"},   # <- only this is new\n]\n\n# all four go over the wire, on every call.\n# nothing is stored on their end between calls.'
  }
},

prompts: {
  q: 'Why not just use an f-string?',
  lay: {
    t: 'A blank form beats a blank page',
    b: 'Two ways to take a customer order. One: hand someone a blank sheet and hope they write down everything you need. Two: hand them a form with labelled boxes — Name, Address, Item.\n\nThe form wins for a dull reason. If a box is empty you notice at the counter, immediately. With the blank sheet you find out three days later, when the parcel cannot be delivered.\n\nA prompt template is that form. It knows which blanks exist and complains the moment one is missing — instead of quietly sending the AI a sentence with a hole in it.'
  },
  tech: {
    t: 'A missing variable is an error, not a strange answer',
    b: 'The f-string fails silently and you debug it at 2am. The template fails immediately and names the blank.',
    code: 'from langchain_core.prompts import ChatPromptTemplate\n\ntpl = ChatPromptTemplate.from_template(\n    "Translate to {language}: {text}"\n)\n\ntpl.invoke({"language": "French", "text": "hello"})   # fine\ntpl.invoke({"text": "hello"})                          # KeyError: language\n\n# the f-string version would have cheerfully sent\n# "Translate to : hello" and left you wondering'
  }
},

lcel: {
  q: 'What does the | symbol do?',
  lay: {
    t: 'A conveyor belt in a sandwich shop',
    b: 'Bread station, filling station, wrapping station. Each one takes what the last handed over and passes its work along the belt.\n\nNobody needs to understand the whole sandwich. Each station knows one job and where to put the result.\n\nThe `|` symbol is that belt. `prompt | model | parser` reads left to right: fill in the prompt, hand it to the AI, tidy up the reply. Swap the filling station for a different one and the bread and wrapping carry on unbothered.'
  },
  tech: {
    t: 'Each step’s output is the next step’s input',
    b: 'And the result is itself a component, so a chain drops inside a bigger chain without ceremony.',
    code: 'chain = prompt | model | parser\n\nchain.invoke({"question": "How many holidays do I get?"})\n\n# swap the middle station; nothing else changes:\nchain = prompt | other_model | parser\n\n# and because a chain is a component too:\nbigger = retriever | chain | formatter'
  }
},

parsers: {
  q: 'How do I get data instead of a paragraph?',
  lay: {
    t: 'Ask for a form, not a chat',
    b: 'Ask someone "where do you live?" and you get "oh, just off the high street, near the big Tesco". True, friendly, useless for posting a parcel.\n\nHand them a form with House Number, Street, Postcode and you get three fields you can type straight into a system.\n\nSame with the AI. Ask loosely and you get prose you have to pick apart — phrased differently every Tuesday. Give it a form and it fills in the boxes.'
  },
  tech: {
    t: 'Constrain what it may produce, don’t tidy up after',
    b: 'The schema goes over as a tool definition, so the model is not free to ramble. You get back a validated object, not a dict you hope has the right keys.',
    code: 'from pydantic import BaseModel\n\nclass Address(BaseModel):\n    house: str\n    street: str\n    postcode: str\n\nstructured = model.with_structured_output(Address)\nout = structured.invoke("I live at 12 Mill Lane, EC1 4AB")\n\nout.postcode        # "EC1 4AB" — a real field, already validated\n# not: json.loads(reply) and a prayer'
  }
},

splitters: {
  q: 'Why chop up my documents?',
  lay: {
    t: 'Index cards from a textbook',
    b: 'You cannot hand the AI a 500-page handbook — there is a size limit on one message. So you copy it onto index cards and hand over only the few cards that matter.\n\nCard size is the whole game. Too small and a fact gets sliced in half — "holiday allowance is" on one card, "28 days" on the next. Neither card can answer the question, and no amount of clever AI repairs that.\n\nToo big and you waste the space handing over four paragraphs of nothing to reach one useful line. Hence the overlap: let each card repeat the tail of the one before, so nothing falls down the crack.'
  },
  tech: {
    t: 'chunk_size and chunk_overlap are the two dials',
    b: 'This is where retrieval quality is actually decided. Everyone tunes the prompt; almost nobody tunes this.',
    code: 'from langchain_text_splitters import RecursiveCharacterTextSplitter\n\nsplitter = RecursiveCharacterTextSplitter(\n    chunk_size=1000,      # characters per card\n    chunk_overlap=200,    # repeat the tail so facts survive the cut\n)\nchunks = splitter.split_documents(docs)\n\nlen(chunks)      # 500 pages -> a few thousand cards'
  }
},

vectors: {
  q: 'How does it find the right page?',
  lay: {
    t: 'Give every sentence a map coordinate',
    b: 'Word search is brittle. Someone asks "how do I undo a release?" and your handbook says "rollback procedure". No shared words, no results — and the answer was sitting right there.\n\nSo instead, every sentence gets a coordinate on a map, placed by meaning rather than spelling. "Undo a release" and "rollback procedure" land on neighbouring streets. "Cheese" is in another county.\n\nFinding the right page becomes: put the question on the map, look at what is nearby. That is all a vector search is — a map where meaning decides the address.'
  },
  tech: {
    t: 'Text becomes numbers; near means similar',
    b: 'An embedding model returns a list of numbers. The store indexes them and answers "what are the k nearest to this one?"',
    code: 'vec = embeddings.embed_query("how do I undo a release?")\nlen(vec)        # 1536 numbers — the coordinate\n\nhits = store.similarity_search("how do I undo a release?", k=3)\nfor d in hits:\n    print(d.page_content[:60])\n\n# -> "Rollback procedure: to revert a deployment..."\n# matched on meaning. not one keyword in common.'
  }
},

rag: {
  q: 'How does it answer about MY documents?',
  lay: {
    t: 'An open-book exam',
    b: 'You would not make a new starter memorise the staff handbook. You hand them the handbook and let them look things up.\n\nThat is the whole trick, and it carries an ugly three-letter name (RAG) for something quite simple. A question arrives, you find the relevant pages first, staple them to the question, and ask the AI to answer only from what is stapled on.\n\nThe AI never learned your handbook. It is reading it over your shoulder for that one question, then forgetting it again.'
  },
  tech: {
    t: 'Retrieve, staple, ask',
    b: 'No special model and no special API. A chain built from parts you have already met.',
    code: 'chain = (\n    {"context": retriever, "question": RunnablePassthrough()}\n    | prompt      # "Answer using ONLY this context: {context}"\n    | model\n    | parser\n)\n\nchain.invoke("How many holidays do I get?")\n\n# switch the retriever off and it still answers — confidently,\n# from general knowledge, about somebody else’s company.'
  }
},

history: {
  q: 'How do chatbots remember the conversation?',
  lay: {
    t: 'A notebook you read aloud every time',
    b: 'Back to the pen pal with no memory. The fix is unglamorous: keep a notebook of everything said so far, and read the whole thing aloud before each new question.\n\nTwo things follow, and both bite people in production.\n\nIt gets slower and dearer with every exchange, because the notebook you re-read keeps growing. And if you mix up whose notebook is whose, you read one customer’s conversation aloud to another. That is not a mysterious AI bug — it is a filing error, and it is entirely yours.'
  },
  tech: {
    t: 'Store by session id, splice in before the call',
    b: '"Memory" means exactly this and nothing more. Two sessions, two notebooks, one chain.',
    code: 'from langchain_core.runnables.history import RunnableWithMessageHistory\n\nchat = RunnableWithMessageHistory(\n    chain,\n    lambda sid: get_history(sid),      # <- one notebook per session id\n    input_messages_key="question",\n    history_messages_key="history",\n)\n\nchat.invoke({"question": "and who made it?"},\n            config={"configurable": {"session_id": "user-42"}})\n\n# the wrong session_id here is one user reading another’s chat'
  }
},

agents: {
  q: 'What makes something an "agent"?',
  lay: {
    t: 'An assistant allowed to go and check',
    b: 'A chain is a recipe: these four steps, in order, stop. Fine — until the task needs something looked up.\n\nAn agent is an assistant with a phone and a calculator on the desk. You ask a question. They might answer straight away, or say "hold on, let me check", make a call, read the answer, and only then decide whether they need another call before replying.\n\nYou did not decide how many calls. They did, while working. That is the appeal, and also the danger: an assistant with no instruction to stop will happily be on the phone all afternoon, on your bill. Hence the cap.'
  },
  tech: {
    t: 'A loop that ends when the model stops asking',
    b: 'Each turn the model either requests a tool or gives a final answer. The executor keeps going until it stops requesting. You write the tools and the cap.',
    code: 'agent = create_tool_calling_agent(model, tools, prompt)\nexecutor = AgentExecutor(\n    agent=agent,\n    tools=tools,\n    max_iterations=6,        # <- the cap. do not skip this.\n)\n\nexecutor.invoke({"input": "What is 17% of last month’s revenue?"})\n\n# it calls the revenue tool, reads the number, calls the\n# calculator, then answers. two tool calls, and you\n# specified neither of them.'
  }
},

graph: {
  q: 'When is a chain not enough?',
  lay: {
    t: 'A recipe vs a board game',
    b: 'A recipe goes one way. Step 1, 2, 3, serve. You never go back to step 2, and if the kitchen catches fire you start again tomorrow from the beginning.\n\nA board game is different. You can land on a square that sends you back three. You can pause overnight and resume where you left off. You can wait for another player to take their turn.\n\nChains are recipes. Some jobs are board games — check the answer and retry if it is poor, wait for a manager to approve, survive the server restarting. LangGraph is for those.'
  },
  tech: {
    t: 'The edge that points backwards',
    b: 'One line a chain cannot express, and the reason the whole library exists.',
    code: 'from langgraph.graph import StateGraph\n\ng = StateGraph(dict)\ng.add_node("retrieve", retrieve)\ng.add_node("grade",    grade)\ng.add_node("rewrite",  rewrite)\n\ng.add_edge("retrieve", "grade")\ng.add_conditional_edges("grade", decide)   # good? finish. poor? rewrite.\ng.add_edge("rewrite", "retrieve")          # <- backwards. no pipe does this.'
  }
},

ship: {
  q: 'What changes when it goes live?',
  lay: {
    t: 'Fit the dashcam before the crash',
    b: 'On your own laptop you can see everything, because you printed it. In production the app is off doing thousands of runs while you are asleep, and the only thing you hear is "it gave a weird answer yesterday".\n\nWithout a recording you are guessing. Was the question odd? Did it fetch the wrong page? Did the AI simply have a bad day?\n\nTracing is the dashcam. Two settings, switched on before you launch, and every run is recorded — what went in, what came back, how long it took, what it cost. Turn it on first, not after the first complaint.'
  },
  tech: {
    t: 'Two environment variables',
    b: 'That is the entire setup. Every step of every run then appears with inputs, outputs, tokens and latency.',
    code: 'export LANGSMITH_TRACING=true\nexport LANGSMITH_API_KEY=...\n\n# no code change. the chain you already wrote is now recorded.\n\n# the debugging order when an answer is wrong:\n#   1. what did the retriever fetch?      (usually here)\n#   2. what did the prompt become?\n#   3. what did the model actually say?\n#   4. blame the model                    (rarely here)'
  }
}

};
