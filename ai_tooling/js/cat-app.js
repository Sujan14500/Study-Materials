/* ============================================================
   cat-app.js — the layer everybody forgets to name in interviews:
   how the thing is actually served and how a human touches it.
   App & Serving
   ============================================================ */
C.cats.push(

/* ============================================================ *
 * 12. APP & SERVING                                            *
 * ============================================================ */
{
  id: 'app', n: 'App & Serving', ico: '🚪', color: '#2dd4bf', tag: 'API + UI',
  two: 'The web layer around the model: the API that exposes it and the UI a human types into. Every AI system on this map ends up behind one of these, and candidates who cannot describe it sound like they have only ever run notebooks.',
  pts: [
    'The split to keep clear: <b>FastAPI</b> is a production API for other software to call. <b>Streamlit, Gradio and Chainlit</b> are UIs for humans, and they are prototyping tools first. Presenting a Streamlit app as a production service is the classic tell.',
    'LLM endpoints are <b>slow and streaming</b>, which changes the architecture. You need async handlers, Server-Sent Events or WebSockets for token streaming, and background tasks so a thirty-second agent run does not hold an HTTP request open.',
    'Structured output starts here. <b>Pydantic</b> models validate the request, define the tool schema, and validate what the model returned — the same type definition doing three jobs is the reason Python won this layer.',
    'The production checklist an interviewer is listening for: timeouts, per-user rate limits, idempotency keys on anything that spends money, a health endpoint, request IDs propagated into your traces, and a cost cap per request.',
    'A subtle point worth making: <b>FastMCP is FastAPI\'s pattern applied to MCP</b> — decorate a typed function, get a schema. Once you see that, exposing your existing API to an agent stops being a project and becomes an afternoon.'
  ],
  tools: [
    { id:'fastapi', n:'FastAPI', by:'Sebastián Ramírez / community', kind:'api',
      two:'The modern Python web framework for building APIs: async by default, with request and response validation generated from ordinary type hints. The default way an AI service is exposed.',
      pts:[
        'Type hints <b>are</b> the schema. A Pydantic model on the handler gives you parsing, validation, error responses and OpenAPI docs from one declaration — no duplicate definitions to drift apart.',
        'It is <b>async-native</b> (ASGI, running on Uvicorn), which matters enormously here: an LLM call is mostly waiting on the network, so async lets one worker hold hundreds of in-flight requests instead of blocking a thread each.',
        'Streaming is first class via <b>StreamingResponse</b>, which is how you deliver tokens as they are generated and cut perceived latency — time-to-first-token is the number users actually feel.',
        '<b>BackgroundTasks</b> (or a real queue for anything serious) is the answer to long agent runs: return a job ID immediately, let the client poll or subscribe, rather than holding a connection for forty seconds.',
        'Dependency injection with <b>Depends</b> handles auth, database sessions, rate limiting and per-request tracing cleanly, and it is testable because you can override any dependency in a test.'
      ],
      pick:'Any Python AI service that other software will call. This is the default and you should be able to defend it.',
      watch:'A blocking call inside an async handler stalls the whole event loop. Use await, or push the sync work to a threadpool.' },

    { id:'streamlit', n:'Streamlit', by:'Streamlit (Snowflake)', kind:'ui',
      two:'A Python library that turns a script into a web app — no HTML, no JavaScript, no callbacks. The fastest way to put a UI in front of a model for a demo or an internal tool.',
      pts:[
        'The execution model is the thing to understand and the thing that trips people up: <b>the entire script reruns top to bottom on every interaction</b>. There is no event handler; there is a re-execution.',
        'That is why <b>@st.cache_resource</b> and <b>@st.cache_data</b> matter so much — without them you reload the model, reconnect the vector store and re-embed the corpus on every keystroke.',
        '<b>st.session_state</b> is the only thing that survives a rerun, so chat history, the conversation ID and any agent state must live there rather than in a local variable.',
        'It has native chat primitives (st.chat_message, st.chat_input) and <b>st.write_stream</b> for token-by-token output, so a streaming chat UI is genuinely about twenty lines.',
        'The honest limits: it is single-user-per-session by design, has no real routing or auth, and does not scale like a normal web app. It is a demo and internal-tool framework, and saying so is a maturity signal.'
      ],
      pick:'Internal tools, demos, data apps and getting a stakeholder to click something by Friday.',
      watch:'Never present it as a production customer-facing app. The rerun model and the missing auth story will not survive the follow-up question.' },

    { id:'gradio', n:'Gradio', by:'Hugging Face', kind:'ui',
      two:'A Python library for wrapping a function in a shareable web interface, built for ML demos and deeply integrated with Hugging Face Spaces.',
      pts:[
        'The core abstraction is a <b>function with typed inputs and outputs</b> — Gradio builds the UI around it, which fits "model in, prediction out" perfectly.',
        'It auto-generates a REST API and an OpenAPI schema for the same function, so a demo is also a callable endpoint.',
        'One-click deployment to <b>Hugging Face Spaces</b> made it the standard way open models get demoed publicly.',
        'Rich ML-native components — image, audio, video, webcam, annotated output — that a general web framework would make you build.',
        'The <b>Blocks</b> API drops to explicit layout and event wiring when the automatic interface is too rigid, so it scales further than it first appears.'
      ],
      pick:'ML model demos, especially anything multimodal, and public sharing via Spaces.',
      watch:'Same class as Streamlit: a demo framework. Do not put it in front of paying customers without a real service behind it.' },

    { id:'chainlit', n:'Chainlit', by:'Chainlit', kind:'ui',
      two:'A Python framework specifically for conversational AI interfaces, with agent step visualisation and human feedback built in rather than bolted on.',
      pts:[
        'It is <b>chat-first</b> — threads, message history, streaming and file uploads are the primitives, not things you assemble.',
        'Its distinguishing feature is <b>step visualisation</b>: intermediate reasoning, tool calls and retrieved documents render as collapsible steps, so users and developers can see why the answer happened.',
        'Human feedback widgets (thumbs, comments) are built in, which is how you collect the labelled data that later feeds your evals.',
        '<b>Ask user</b> primitives support human-in-the-loop approval inside the chat, which pairs directly with an agent interrupt.',
        'Authentication and persistent chat history are supported, so it sits a step closer to production than Streamlit for chat specifically.'
      ],
      pick:'Chat and agent UIs where showing the reasoning steps and collecting feedback matters.',
      watch:'Narrower than Streamlit — if the app is not a conversation, this is the wrong shape.' },

    { id:'pydantic', n:'Pydantic', by:'Pydantic', kind:'lib',
      two:'The data validation library underneath most of this ecosystem: declare a model with type hints and get parsing, validation and JSON Schema for free.',
      pts:[
        'It is the quiet dependency of the whole stack — FastAPI, LangChain, PydanticAI, the OpenAI SDK and most tool definitions are built on it.',
        'For LLM work its killer feature is <b>JSON Schema generation</b>: the same model defines your tool\'s parameters, your structured-output schema, and the validation of what came back.',
        'v2 moved the core to Rust and is several times faster, which matters when you validate on every request.',
        'Validation errors are structured and specific, so a failed model output can be <b>fed back to the model</b> as a precise repair instruction rather than "that was wrong".',
        'Validators let you encode business rules (a refund cannot exceed the order total) in the type itself, which is a far stronger guarantee than asking the model nicely in a prompt.'
      ],
      pick:'Everywhere. If you are writing Python and calling a model, you are using it whether you noticed or not.',
      watch:'v1 and v2 APIs differ significantly. Mixed-version dependency trees are a real and annoying failure mode.' },

    { id:'uvicorn', n:'Uvicorn / Gunicorn', by:'Encode / community', kind:'server',
      two:'The ASGI server that actually runs your FastAPI app, usually managed by Gunicorn in production. The bit between "it works on my laptop" and "it serves traffic".',
      pts:[
        '<b>Uvicorn</b> is the ASGI server; FastAPI is only the framework. Nothing is served until Uvicorn (or an equivalent) runs it.',
        'In production the common shape is <b>Gunicorn managing Uvicorn workers</b>, which adds process supervision, graceful restarts and worker recycling.',
        'Worker count is the tuning knob, and for LLM work the usual CPU-count rule is wrong — the work is I/O-bound waiting on APIs, so you can run far more concurrency per core.',
        'Graceful shutdown matters more than usual: a rolling deploy must not kill a request halfway through a paid model call.',
        'Timeouts must be set deliberately at every layer — client, load balancer, server, and the model SDK — or a slow generation gets killed by whichever layer is stingiest, usually the one you forgot.'
      ],
      pick:'Any FastAPI service going to production. It is not optional, just easy to forget to mention.',
      watch:'Default timeouts are shorter than a long generation. Mismatched timeouts across layers cause the weirdest bugs in this stack.' }
  ]
}

);
