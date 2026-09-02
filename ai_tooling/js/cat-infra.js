/* ============================================================
   cat-infra.js — how the model reaches the world, and what
   watches it while it does.
   MCP · AI Security · Observability
   ============================================================ */
C.cats.push(

/* ============================================================ *
 * 5. MCP                                                       *
 * ============================================================ */
{
  id: 'mcp', n: 'MCP', ico: '🔌', color: '#22d3ee', tag: 'the tool port',
  two: 'The Model Context Protocol: an open standard for how an LLM application discovers and calls external tools, data and prompts. Anthropic published it in late 2024 and OpenAI, Google and Microsoft adopted it.',
  pts: [
    'It solves the <b>N x M problem</b>. Without a protocol, every client writes a wrapper for every tool: five clients and twenty tools is a hundred integrations. With one, it is twenty-five. The analogy that lands is USB-C, or LSP for editors.',
    'Three primitives, and mixing them up is the giveaway. <b>Tools</b> are model-controlled actions. <b>Resources</b> are application-controlled read-only data. <b>Prompts</b> are user-controlled templates. Who decides is what separates them.',
    'Architecture is host / client / server. The <b>host</b> is the application (an IDE, a chat app), it runs one <b>client</b> per connection, and each <b>server</b> exposes one system\'s capabilities.',
    'Two transports: <b>stdio</b> for a local subprocess (fast, no network, most desktop servers) and <b>Streamable HTTP</b> for remote servers, which superseded the older HTTP+SSE transport.',
    'Security is the interview\'s second question, always. An MCP server is arbitrary code with your credentials, and anything it returns is untrusted text that can carry an injected instruction. Least-privilege tokens, allowlisted servers, human approval on writes, and never treating tool output as instruction.'
  ],
  tools: [
    { id:'mcpsdk', n:'MCP SDK', by:'Anthropic / community', kind:'sdk',
      two:'The official protocol implementations — Python, TypeScript, Java, C#, Kotlin, Go, Rust — that let you write a server or a client without hand-rolling JSON-RPC.',
      pts:[
        'The wire protocol is <b>JSON-RPC 2.0</b>. The SDK handles the handshake, capability negotiation, framing and lifecycle so you write handlers, not plumbing.',
        'Server side you register tools with a name, a description and a JSON Schema; the description is what the model reads to decide, so it is prompt engineering, not documentation.',
        'Client side you connect, list capabilities, and expose them to your model\'s tool-calling API — that mapping is where the protocol earns its keep.',
        'It also carries <b>sampling</b> (a server can ask the client\'s model for a completion) and <b>elicitation</b> (a server can ask the user a question), which most people never notice exist.',
        'Version negotiation is part of the handshake, so a newer client and an older server can still agree on a working feature set.'
      ],
      pick:'You are writing an MCP server or client and want the protocol handled correctly.',
      watch:'A vague tool description is the number one cause of "the model never calls my tool".' },

    { id:'fastmcp', n:'FastMCP', by:'Prefect / community', kind:'framework',
      two:'The ergonomic Python way to build MCP servers: decorate a function, get a tool. Its v1 was upstreamed into the official Python SDK; v2 continues with more features.',
      pts:[
        'A decorator plus a type-hinted function is the whole server — the JSON Schema is generated from your type hints and docstring.',
        'It is the FastAPI of MCP, and the comparison is exact: the same decorator ergonomics applied to a different protocol.',
        'v2 adds server composition, proxying, auth integration and OpenAPI-to-MCP generation, which turns an existing REST API into a tool server almost for free.',
        'Built-in testing utilities let you call your server in-process, so MCP servers get unit tests like any other code.',
        'It is the fastest honest answer to "how would you expose our internal API to an agent" in an interview.'
      ],
      pick:'Building a Python MCP server, especially wrapping an API you already have.',
      watch:'Know which version you mean. v1 lives inside the official SDK; v2 is a separate package.' },

    { id:'mcpreg', n:'MCP Registry', by:'MCP community', kind:'registry',
      two:'The official open catalogue of MCP servers, plus the community directories that grew around it. Discovery and distribution for tool servers.',
      pts:[
        'It is to MCP what npm is to Node — a place to find a server for a system instead of writing one.',
        'Registry entries carry the package name, transport and configuration, so a client can install and launch a server from metadata.',
        'Discovery is exactly where supply-chain risk enters. A registry entry is a stranger\'s code that will run with your credentials.',
        'Practical controls to name: pin versions, vendor or mirror the servers you depend on, review what scopes their tokens actually need, and allowlist rather than auto-install.',
        'Enterprises are increasingly running <b>internal</b> registries, so the story becomes an approved catalogue rather than the open internet.'
      ],
      pick:'Finding an existing server before writing one, and governing which servers your org allows.',
      watch:'Auto-installing from a public registry is the same risk as curl-piping a script into a shell.' },

    { id:'ghmcp', n:'GitHub MCP Server', by:'GitHub', kind:'server',
      two:'GitHub\'s official server exposing repositories, issues, pull requests, actions and code search as MCP tools. The canonical example of a first-party server.',
      pts:[
        'It turns "read this repo, run the tests, open a PR" into tool calls rather than a bespoke integration per assistant.',
        'Toolsets are grouped (repos, issues, pull requests, actions, security) so you can enable only what a given agent needs.',
        'A <b>read-only mode</b> exists, and it is the correct default for anything exploratory — write access to a repo is an irreversible action surface.',
        'It runs locally against a personal access token or remotely as a hosted server with OAuth; the token scope <em>is</em> the security boundary.',
        'The known risk to name: issue and PR text is attacker-controlled. A malicious issue body is a prompt-injection vector straight into an agent with commit rights.'
      ],
      pick:'Coding agents and repo automation, especially across several different assistants.',
      watch:'Untrusted repository content plus write scope is the classic injection-to-exfiltration chain.' },

    { id:'slackmcp', n:'Slack MCP Server', by:'community / Slack', kind:'server',
      two:'Exposes Slack channels, messages, threads and search as MCP tools so an agent can read context and post updates.',
      pts:[
        'Typical tools: list channels, read history, post a message, reply in thread, search. Reading is cheap; posting is a public, irreversible act.',
        'Scoping matters more than usual — a bot token that can read every channel hands the agent your entire company\'s private conversation.',
        'It is the standard demo of "agent reads the incident channel and drafts the summary", and a genuinely useful pattern.',
        'Every message it reads is untrusted input written by humans and bots, so injection risk is continuous rather than occasional.',
        'Rate limits and pagination are real engineering here; naive history reads blow through both.'
      ],
      pick:'Ops and support agents that need conversation context or must report back into a channel.',
      watch:'Posting to a channel cannot be undone in any way that matters. Gate it behind approval.' },

    { id:'pgmcp', n:'PostgreSQL MCP Server', by:'community', kind:'server',
      two:'Exposes a Postgres database over MCP: schema inspection and query execution, so an agent can answer questions from live data.',
      pts:[
        'Schema introspection tools matter as much as query execution — the model needs the table shapes before it can write correct SQL.',
        'Run it against a <b>read-only role</b>. That single decision removes the entire class of "the agent dropped a table" incidents.',
        'Statement timeouts and row limits belong in the server, not the prompt, because a prompt cannot stop a cartesian join.',
        'Row-level security and a per-tenant role are how you stop a multi-tenant agent reading another customer\'s data.',
        'It is the cleanest example of the general rule: enforce permissions in the system, never in the instructions.'
      ],
      pick:'Analytics and support agents that must answer from live relational data.',
      watch:'Generated SQL against a write-capable role is the most dangerous tool on this whole page.' },

    { id:'gdrivemcp', n:'Google Drive MCP Server', by:'community / Google', kind:'server',
      two:'Exposes Drive files, folders and search over MCP, converting Docs, Sheets and Slides into text an agent can read.',
      pts:[
        'It handles the export step — a Google Doc is not a file you can read directly, it must be exported to text or markdown first.',
        'Search plus read is usually enough; write access to shared corporate documents is rarely worth the risk.',
        'OAuth scopes are the control surface, and drive.readonly versus full drive access is a decision someone must make explicitly.',
        'It is a fast route to "RAG over the company wiki" without building an ingestion pipeline, at the cost of per-query latency.',
        'Documents are user-authored and therefore untrusted; a shared doc is a perfectly good injection delivery mechanism.'
      ],
      pick:'Knowledge agents over company documents when you do not want a separate ingestion pipeline.',
      watch:'Live reads are slower and less controllable than a proper indexed pipeline. Know which you need.' },

    { id:'fsmcp', n:'Filesystem MCP Server', by:'Anthropic (reference)', kind:'server',
      two:'The reference server: read, write, list and search files within configured directories. The one everybody runs first.',
      pts:[
        'Directory allowlisting is the entire security model — the server only touches paths under the roots you pass at launch.',
        'It demonstrates the protocol end to end in a few minutes, which is why it is the standard first server to install.',
        'Path traversal is the obvious attack, so the server resolves and validates paths against the allowed roots rather than trusting the string.',
        'Write and move tools are genuinely destructive. Read-only configuration is the sane default for anything not explicitly a coding agent.',
        'Combined with an agent that reads untrusted files, it is the textbook data-exfiltration path: read secrets, then use another tool to send them.'
      ],
      pick:'Local coding and document agents, and learning the protocol.',
      watch:'Never point it at a home directory or a repository root containing .env files and credentials.' }
  ]
},

/* ============================================================ *
 * 6. AI SECURITY                                               *
 * ============================================================ */
{
  id: 'sec', n: 'AI Security', ico: '🛡️', color: '#fb7185', tag: 'guardrails',
  two: 'The layer that decides what may go into the model and what may come out. It exists because a prompt is not a security boundary and never will be.',
  pts: [
    'The threats worth naming: <b>prompt injection</b> (instructions hidden in data the model reads), <b>jailbreaks</b> (getting past the system prompt), <b>PII leakage</b>, <b>toxic or unsafe output</b>, and <b>excessive agency</b> — a tool doing more than the request justified.',
    'Direct injection comes from the user; <b>indirect</b> injection comes from a retrieved document, a web page, an email or a Jira ticket. Indirect is the dangerous one because nobody is watching the input.',
    'Guardrails run on both sides and the jobs differ. <b>Input</b>: injection detection, jailbreak classification, PII redaction. <b>Output</b>: schema validation, groundedness, toxicity, secret leakage. An output-only guardrail cannot un-send an email the model already triggered.',
    'No classifier is perfect, so architecture carries the load: least-privilege tools, read-only by default, human approval on irreversible actions, and never letting tool output be interpreted as instruction.',
    'The frame that impresses: guardrails are <b>defence in depth</b>, not a fix. You layer a cheap classifier, a policy check in code, and a human gate — and you assume each one will occasionally fail.'
  ],
  tools: [
    { id:'nemo', n:'NVIDIA NeMo Guardrails', by:'NVIDIA', kind:'oss',
      two:'An open-source toolkit that puts a programmable dialogue rail around an LLM, using its own modelling language to define allowed conversational flows.',
      pts:[
        '<b>Colang</b> is the distinguishing feature: a DSL for defining canonical user intents and the flows allowed to follow them.',
        'Five rail types cover the pipeline — input, dialog, retrieval, execution and output — so you can block at whichever stage is cheapest.',
        'Topical rails keep a bot on subject, which is the unglamorous requirement most enterprise deployments actually have.',
        'It can call out to other checkers (including Presidio and third-party classifiers) rather than doing everything itself.',
        'The trade: Colang is a language your team must learn, and every rail adds latency to the request path.'
      ],
      pick:'Enterprise chatbots that must stay on topic and follow scripted conversational policy.',
      watch:'A DSL is a new thing to maintain. Weigh it against a few explicit checks in Python.' },

    { id:'grai', n:'Guardrails AI', by:'Guardrails AI', kind:'oss',
      two:'A Python framework that validates LLM output against declared expectations and can re-ask the model when validation fails.',
      pts:[
        'The core loop is <b>validate, then fix or re-ask</b> — a failed check can automatically prompt the model again with the failure explained.',
        'The <b>Guardrails Hub</b> is a library of pre-built validators: toxicity, PII, competitor mentions, valid SQL, no secrets, topic restriction.',
        'Output structure validation (types, ranges, enums) is the mundane feature people underrate — most "the model returned garbage" bugs are schema bugs.',
        'Validators are ordinary Python classes, so a domain-specific business rule is a small class rather than a prompt paragraph.',
        'Honest limitation: re-asking costs another call and can loop. Cap the retries or you have built a money pump.'
      ],
      pick:'Structured output validation and content policy in a Python stack.',
      watch:'Every re-ask is another billed call and more latency. Cap retries explicitly.' },

    { id:'presidio', n:'Microsoft Presidio', by:'Microsoft', kind:'oss',
      two:'An open-source PII detection and anonymisation SDK. Not LLM-specific, which is exactly why it is the mature choice for the redaction problem.',
      pts:[
        'Two parts: an <b>Analyzer</b> that finds entities and a <b>Anonymizer</b> that redacts, masks, hashes or encrypts them.',
        'Detection combines named-entity recognition, regexes and checksum validators — a card number is validated with Luhn, not guessed.',
        'Custom recognisers are straightforward, which matters because your internal account-number format is not in anyone\'s default list.',
        'Encryption operators are <b>reversible</b>, so you can redact before the model call and restore the real values in the response.',
        'It also handles images and structured data, so the same policy covers scanned documents and database columns.'
      ],
      pick:'Redacting PII before it reaches a hosted model, and de-identifying logs and traces.',
      watch:'NER recall is not 100%. For regulated data, pair it with structural controls, not just detection.' },

    { id:'lakera', n:'Lakera Guard', by:'Lakera', kind:'saas',
      two:'A commercial API that classifies prompts and responses for injection, jailbreaks, PII and content risk in a single low-latency call.',
      pts:[
        'The pitch is <b>one API call</b> before and after the model, rather than assembling five open-source checkers.',
        'Its detection models are trained partly on data from Gandalf, a public prompt-injection game that produced a very large corpus of real attacks.',
        'Latency is the design constraint — it sits in the request path, so it is built to answer in tens of milliseconds.',
        'Threat intelligence updates centrally, so new jailbreak families are covered without you retraining anything.',
        'The trade: another vendor sees your prompts, and you are trusting a black-box classifier you cannot inspect.'
      ],
      pick:'You want managed injection and jailbreak detection without building or maintaining classifiers.',
      watch:'A network hop in front of every request. Decide your fail-open versus fail-closed policy before launch.' },

    { id:'promptsec', n:'Prompt Security', by:'Prompt Security', kind:'saas',
      two:'An enterprise platform for governing all GenAI use in an organisation — employee tool usage as well as the applications you build.',
      pts:[
        'It covers <b>shadow AI</b>: employees pasting source code and customer data into consumer chatbots, which is a bigger real-world leak than most application bugs.',
        'A browser extension plus a gateway gives visibility into who is using which AI tool with what data.',
        'The same engine protects your own applications with input and output inspection, so security has one policy surface.',
        'Policy is per-group and per-data-classification, which is what a compliance team actually asks for.',
        'Naming it shows you understand that AI security is an organisational problem, not only an application problem — a strong senior signal.'
      ],
      pick:'Enterprises that need governance and visibility across all AI usage, not just their own app.',
      watch:'This is a security-organisation purchase. Do not propose it as an application library.' },

    { id:'protectai', n:'Protect AI', by:'Protect AI (Palo Alto Networks)', kind:'saas',
      two:'An AI security company focused on the ML supply chain — scanning models, notebooks and pipelines — now part of Palo Alto Networks.',
      pts:[
        '<b>ModelScan</b> checks model files for unsafe serialisation; a pickle-based checkpoint can execute code on load, which is a real and under-discussed attack.',
        '<b>LLM Guard</b> is its open-source scanner set for prompts and responses — a free, self-hosted alternative to a commercial guard API.',
        '<b>NB Defense</b> targets Jupyter notebooks, where secrets and unreviewed code habitually accumulate.',
        'It popularised the "AI Bill of Materials" idea — knowing exactly which models, datasets and weights are in your system.',
        'It is the layer people forget: everyone guards the prompt, almost nobody scans the artefacts they downloaded.'
      ],
      pick:'Securing the model supply chain when you pull open weights from public hubs.',
      watch:'Supply-chain scanning is not runtime protection. You still need input and output guards.' },

    { id:'azcs', n:'Azure AI Content Safety', by:'Microsoft Azure', kind:'cloud',
      two:'Azure\'s managed moderation service: severity-scored categories for harmful content, plus dedicated prompt-injection and groundedness detection.',
      pts:[
        'Four harm categories — hate, sexual, violence, self-harm — each returned with a <b>severity score</b> rather than a binary flag, so you set your own thresholds.',
        '<b>Prompt Shields</b> targets jailbreaks and, importantly, indirect injection from documents.',
        '<b>Groundedness detection</b> checks whether an answer is actually supported by the provided sources — a hallucination check as a managed API.',
        'Protected material detection flags regurgitated copyrighted text and code, which is a genuine legal exposure.',
        'Custom categories let you train a detector for a policy that only exists at your company.'
      ],
      pick:'Azure-hosted applications that need moderation and injection defence with enterprise compliance.',
      watch:'Severity thresholds are a product decision. Someone must own where the line sits, and it will not be engineering.' },

    { id:'brguard', n:'AWS Bedrock Guardrails', by:'AWS', kind:'cloud',
      two:'AWS\'s configurable safety layer for Bedrock: content filters, denied topics, word filters, PII redaction and contextual grounding, applied independently of the model.',
      pts:[
        'It is <b>model-independent</b> — the same guardrail applies to Claude, Llama or Titan on Bedrock, and via the ApplyGuardrail API even to models outside Bedrock.',
        '<b>Denied topics</b> are defined in natural language ("do not give investment advice"), which non-engineers can write and review.',
        'Contextual grounding checks scores answers against source passages and blocks ungrounded ones — a hallucination filter you configure rather than build.',
        '<b>Automated Reasoning checks</b> use formal verification against encoded policy rules, which is a genuinely different approach from classification and worth mentioning.',
        'Guardrails are versioned resources with IAM permissions, so policy changes are auditable rather than a prompt someone edited.'
      ],
      pick:'Anything on Bedrock, and as a uniform policy layer across mixed models.',
      watch:'Filters add latency and cost per call, and over-tight thresholds block legitimate traffic. Measure the false-positive rate.' }
  ]
},

/* ============================================================ *
 * 7. OBSERVABILITY                                             *
 * ============================================================ */
{
  id: 'obs', n: 'Observability', ico: '🔬', color: '#4ade80', tag: 'traces + evals',
  two: 'Tracing, evaluation and cost tracking for LLM applications. It exists because a non-deterministic system with no logs is a system nobody can debug, improve or defend.',
  pts: [
    'The unit is a <b>trace</b>: one user request, with a nested span for every model call, retrieval and tool execution, carrying inputs, outputs, latency, tokens and cost.',
    'Two questions this layer answers that ordinary APM cannot: what exactly was the prompt after templating, and was the answer any good. Prompt and quality are the new dimensions.',
    'Evaluation splits into <b>offline</b> (a fixed dataset run in CI, catches regressions before release) and <b>online</b> (sampling live traffic, catches drift and real user behaviour). You need both, and teams that only do offline are surprised in production.',
    'LLM-as-judge is the workhorse for scoring free text at scale, and its weaknesses are exam material: position bias, verbosity bias, self-preference. Mitigate by randomising order, using a rubric, and calibrating the judge against human labels.',
    'The cheapest correct answer to "how would you improve this system": instrument first. Without traces you are guessing about which of five stages is the problem, and guessing is how teams spend a month tuning the wrong one.'
  ],
  tools: [
    { id:'langsmith', n:'LangSmith', by:'LangChain', kind:'saas',
      two:'LangChain\'s hosted platform for tracing, evaluating and monitoring LLM applications. Auto-instruments LangChain and LangGraph, and works standalone via its SDK.',
      pts:[
        'Zero-config tracing for LangChain code — set two environment variables and every chain, tool and retrieval shows up as a nested span.',
        'Datasets and experiments are first class: capture real traces, turn them into a test set, then run a new prompt against it and diff the scores.',
        'The <b>annotation queue</b> puts humans in the loop for labelling, which is how you calibrate an LLM judge instead of trusting it.',
        'Prompt Hub versions prompts outside your code, so a prompt change is not a deploy.',
        'It is hosted by default with self-hosting on enterprise plans, which is exactly the objection a regulated buyer raises.'
      ],
      pick:'You are on LangChain or LangGraph and want tracing working this afternoon.',
      watch:'Gravity toward one vendor\'s ecosystem. Fine until you leave it.' },

    { id:'langfuse', n:'Langfuse', by:'Langfuse', kind:'oss',
      two:'The open-source LLM observability platform: tracing, evals, prompt management and cost analytics, self-hostable with Docker.',
      pts:[
        'MIT-licensed core and a documented self-hosted deployment, which is the answer when traces contain data that cannot leave your network.',
        'Framework-agnostic with OpenTelemetry support, so it traces LangChain, LlamaIndex, raw SDK calls and your own services in one view.',
        'Prompt management with versioning and labels lets you promote a prompt to production without redeploying the application.',
        'Cost and token tracking per trace, user and session is the feature finance eventually asks for and nobody builds in advance.',
        'It is the natural counterpart to LangSmith in an interview: same job, open source, self-hostable, not tied to one framework.'
      ],
      pick:'You want full trace data and no vendor lock-in, or your data cannot leave your infrastructure.',
      watch:'Self-hosting means you now run Postgres, ClickHouse and a queue. That is real operations.' },

    { id:'phoenix', n:'Arize Phoenix', by:'Arize AI', kind:'oss',
      two:'An open-source observability and evaluation tool that runs locally in a notebook or as a service, built on OpenTelemetry and OpenInference semantics.',
      pts:[
        'It runs <b>locally in a notebook</b>, which makes it the lowest-friction way to see traces during development with no account and no cloud.',
        'Built on OpenTelemetry, so the instrumentation is a standard rather than a proprietary SDK — traces can go to Phoenix and to your normal APM.',
        'Embedding drift visualisation with UMAP projections is distinctive: you can literally see clusters of queries your retrieval handles badly.',
        'A built-in eval library covers hallucination, relevance, toxicity and QA correctness with tested prompt templates.',
        'Arize sells the production-scale platform, so Phoenix is the free on-ramp with an upgrade path — worth knowing which one you mean.'
      ],
      pick:'Local development, notebook debugging and retrieval analysis without signing up for anything.',
      watch:'The local instance is ephemeral by default. Configure persistence before you rely on the history.' },

    { id:'weave', n:'W&B Weave', by:'Weights & Biases', kind:'saas',
      two:'Weights & Biases\' LLM tracing and evaluation product, sitting alongside its long-established experiment tracking for model training.',
      pts:[
        'A single decorator makes any function traced, and it captures inputs, outputs, latency, cost and exceptions without further code.',
        'Its advantage is <b>continuity</b>: if the team already tracks fine-tuning runs in W&B, the LLM app traces live next to the model that produced them.',
        'The Evaluation API is a proper harness — a dataset, a set of scorers, a leaderboard — rather than a logging tool with charts.',
        'Everything is versioned and immutable, which makes "prove which prompt and which model produced this output" answerable months later.',
        'It appears mostly in ML-mature organisations, and naming it signals you know MLOps did not start with LLMs.'
      ],
      pick:'Teams already using Weights & Biases who want one platform across training and inference.',
      watch:'It is a hosted platform with a real bill. Self-hosting is enterprise-only.' },

    { id:'trulens', n:'TruLens', by:'TruEra / Snowflake', kind:'oss',
      two:'An open-source evaluation library organised around the RAG Triad — a compact, memorable framework for diagnosing exactly where a RAG system fails.',
      pts:[
        'The <b>RAG Triad</b> is the reason to know it: <b>context relevance</b> (did retrieval fetch the right thing), <b>groundedness</b> (is the answer supported by that context), <b>answer relevance</b> (does it address the question).',
        'Those three localise the failure. Bad context relevance is a retrieval problem; bad groundedness is a generation problem; bad answer relevance is a prompting problem.',
        'Feedback functions are pluggable — an LLM judge, a classifier, or a deterministic rule, whichever is cheapest for the check.',
        'It instruments applications non-invasively and stores results in a local database with a dashboard.',
        'Reciting the triad in an interview is one of the highest-value-per-second things on this whole page.'
      ],
      pick:'Diagnosing where a RAG pipeline is failing rather than merely that it is.',
      watch:'Judge-based feedback costs API calls per evaluation. Sample rather than scoring everything.' },

    { id:'ragas', n:'Ragas', by:'Exploding Gradients', kind:'oss',
      two:'The standard open-source metric library for RAG evaluation, offering reference-free scores you can compute without hand-written ground-truth answers.',
      pts:[
        'Core metrics: <b>faithfulness</b> (claims supported by context), <b>answer relevancy</b>, <b>context precision</b> (are the top chunks the useful ones) and <b>context recall</b>.',
        'Most metrics are <b>reference-free</b> — computed with an LLM judge rather than a gold answer — which is why teams can start evaluating immediately.',
        'It can generate a synthetic test set from your documents, solving the cold-start problem of having no evaluation data.',
        'Splitting retrieval metrics from generation metrics is the point: you learn which half to fix.',
        'It integrates with LangChain, LlamaIndex and the observability platforms, so scores land next to traces rather than in a notebook.'
      ],
      pick:'Putting numbers on RAG quality quickly, especially with no labelled data.',
      watch:'The scores are judge-model dependent. Treat them as relative trends, not absolute truth.' },

    { id:'promptfoo', n:'Promptfoo', by:'Promptfoo', kind:'oss',
      two:'A declarative, CLI-first evaluation and red-teaming tool: define test cases and assertions in YAML and run them in CI like any other test suite.',
      pts:[
        'Config-as-code means prompt evaluation is reviewable in a pull request — the cultural shift that actually makes evals happen.',
        'A matrix of prompts by models by test cases produces a side-by-side comparison table, which settles "is the cheaper model good enough" with data.',
        'Assertions range from cheap deterministic checks (contains, regex, valid JSON, latency, cost) to LLM-graded rubrics, so most tests cost nothing.',
        'The <b>red-team</b> mode generates adversarial inputs for injection, jailbreaks and PII extraction and reports what got through, mapped to OWASP LLM risks.',
        'It runs anywhere with node and needs no account, so adding it to CI is genuinely a same-afternoon job.'
      ],
      pick:'Regression testing prompts in CI, and comparing models before a switch.',
      watch:'Deterministic assertions are cheap; LLM-graded ones are not. Keep the CI suite mostly cheap.' },

    { id:'helicone', n:'Helicone', by:'Helicone', kind:'oss',
      two:'An open-source LLM gateway and observability layer: change the base URL, and every request is logged, cached, rate-limited and costed.',
      pts:[
        'Integration is a <b>one-line base URL change</b> — a proxy rather than an SDK — which is the lowest-friction adoption on this list.',
        'Being in the request path lets it do things a passive tracer cannot: response caching, rate limiting per user, retries and fallbacks between providers.',
        'Per-user and per-org cost attribution is built in, which is how you answer "which customer is burning the budget".',
        'Open source and self-hostable, so the proxy can live inside your own network.',
        'The architectural trade is the interview point: a proxy is a dependency in the critical path. It must fail open, or it becomes your outage.'
      ],
      pick:'Fast adoption across many services, plus caching and spend control at the gateway.',
      watch:'A proxy in the hot path adds latency and a failure mode. Design the fallback before you deploy it.' }
  ]
}

);
