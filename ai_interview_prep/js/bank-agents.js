/* ============================================================
   Agents & tools — loops, harnesses, multi-agent, failure modes.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'ag01', topic: 'agents', level: 1,
  q: 'What is an AI agent, and how is it different from a chain?',
  lay: 'A chain is a recipe you wrote: do this, then this, then this. An agent decides the steps itself — which tool to use, how many times, and when it is finished. The more you hand over, the more it can do and the less predictable it becomes.',
  tech: 'An agent is an LLM in a loop with tools, where the MODEL decides the control flow at run time. The defining property is not tool use, memory or planning — it is that the next action depends on what the model just observed. A chain has a fixed graph you authored. The engineering principle: use the least agency that solves the problem, because agency costs predictability, testability and bounded cost.',
  dgm: { nodes: [{ t: 'single call', s: 'fixed' }, { t: 'chain', s: 'you choose the steps' }, { t: 'router', s: 'model picks a branch', k: 'alt' }, { t: 'agent loop', s: 'model picks everything', k: 'warn' }],
    cap: 'Left to right: more capability, less predictability, much harder to evaluate.' },
  trap: '"When would you refuse to build an agent?" When the sequence is known, when cost variance is unacceptable, or when every action is irreversible. Most production "agents" are workflows with one or two agentic steps, and they are better for it.',
  tags: ['agents', 'basics'], orig: 46 },

{ id: 'ag02', topic: 'agents', level: 1,
  q: 'What is the core agent loop?',
  lay: 'Think, act, look at what happened, repeat until done. That is the whole thing.',
  tech: 'Think (reason about what is needed) → Act (emit a tool call) → Observe (feed the real result back into the context) → repeat until a stop condition. Implementation essentials: a step cap, a cost ceiling, loop detection, and an explicit give-up path. In a text-based ReAct format, the stop sequence at <span class="mono">Observation:</span> is what prevents the model hallucinating its own tool results; with native tool calling the API enforces this structurally.',
  code: `def run(task, tools, max_steps=12, budget_usd=0.40):
    msgs, spent, seen = [system(tools), user(task)], 0.0, set()
    for step in range(max_steps):
        r = llm(msgs, tools=tools)
        spent += r.cost
        if spent > budget_usd:
            return degrade("budget exceeded", msgs)     # a named outcome
        if not r.tool_calls:
            return r.text                               # the model is done
        for call in r.tool_calls:
            key = (call.name, json.dumps(call.args, sort_keys=True))
            if key in seen:
                obs = "You already called this with identical arguments. Try something else."
            else:
                seen.add(key)
                obs = shape(execute(call))              # project, truncate, humanise errors
            msgs.append(tool_result(call.id, obs))
    return degrade("step budget exhausted", msgs)`,
  trap: 'The three guards in that snippet — step cap, cost ceiling, repeat-call detector — are what separate a demo from something you can put in front of users. A bare while-loop with max 50 steps will spend real money rediscovering that a tool is broken.',
  tags: ['agents', 'loop'], orig: 31 },

{ id: 'ag03', topic: 'agents', level: 2,
  q: 'Are function calling and tool calling the same thing?',
  lay: 'Yes, in practice. "Function calling" was the original name; "tool calling" is the newer name for the same mechanism, generalised because a tool is not always a function you wrote — it might be a hosted search, a code sandbox, or another agent.',
  tech: 'The mechanism is identical: you pass JSON-schema definitions with the request; the model returns a structured call rather than prose; your code executes it and returns the result. OpenAI shipped it as "function calling" in 2023 and renamed it "tools" in later API versions; Anthropic has always called it tool use. The generalisation matters conceptually: "tool" covers provider-hosted tools (web search, code execution), MCP servers, and sub-agents — things that are not functions in your codebase.',
  compare: { cols: ['Function calling', 'Tool calling'],
    rows: [
      ['Mechanism', 'JSON schema in, structured call out', 'identical'],
      ['Origin', 'the original 2023 name', 'the current name'],
      ['Scope implied', 'a function you wrote', 'also hosted tools, MCP servers, sub-agents'],
      ['Who executes it', 'you', 'you, or the provider for hosted tools'],
      ['Practical difference', 'none — treat them as synonyms', 'none — treat them as synonyms']
    ] },
  trap: 'The point worth making: the model never executes anything. It emits a request; your code decides whether to honour it. That boundary is where all your permission checks and approval gates live, and confusing it is a genuine security misunderstanding.',
  tags: ['tools'], orig: 30 },

{ id: 'ag04', topic: 'agents', level: 2,
  q: 'What makes a good tool definition?',
  lay: 'A name that says what it does, a description that says when NOT to use it, and parameters that make the wrong value impossible rather than merely discouraged.',
  tech: '<ul><li><b>Name</b> — verb_noun, unambiguous: <span class="mono">search_orders_by_customer</span> not <span class="mono">get_data</span>.</li><li><b>Description</b> — what it returns, what it does not do, and explicitly when to use a different tool. Tool descriptions ARE prompts; most selection failures are description failures.</li><li><b>Enums over free strings</b> — a free-text <span class="mono">status</span> invites "open", "Open", "opened", each a silent empty result. An enum makes the failure impossible.</li><li><b>Required versus optional</b> marked accurately, with sensible defaults.</li><li><b>Constraints in the schema</b> — patterns, ranges, max lengths.</li><li><b>An example call</b> in the description for anything non-obvious.</li><li><b>Errors that instruct</b> — "status must be one of OPEN, PENDING, CLOSED; you sent \'open\'" gets fixed on the next call. "400 Bad Request" does not.</li></ul>',
  code: `{
  "name": "search_orders",
  "description": (
    "Find orders for ONE customer by email or order id. "
    "Returns at most 20, newest first. "
    "Do NOT use this to browse or to count - use count_orders for counts. "
    "Example: {\\"email\\": \\"a@b.com\\", \\"status\\": \\"PENDING\\"}"),
  "parameters": {
    "type": "object",
    "properties": {
      "email":    {"type": "string", "format": "email"},
      "order_id": {"type": "string", "pattern": "^ORD-[0-9]{6}$"},
      "status":   {"type": "string",
                   "enum": ["OPEN", "PENDING", "REFUNDED", "CLOSED"]}
    },
    "oneOf": [{"required": ["email"]}, {"required": ["order_id"]}]
  }
}`,
  trap: 'Rewriting one tool description is frequently a bigger quality win than changing model. Interviewers notice candidates who reach for the cheap fix.',
  tags: ['tools'], orig: 30 },

{ id: 'ag05', topic: 'agents', level: 3,
  q: 'What is harness engineering?',
  lay: 'The model is just a function: text in, text out, no memory, no hands, no idea when to stop. Everything that turns it into an agent — the loop, the tools, what goes in the prompt, what comes back from a tool, how errors are worded, when to give up — is code you wrote. That code is the harness, and it is where most of the quality lives.',
  tech: 'Harness engineering is everything between the model and the world. Prompt engineering is one small part of it. The layers, roughly by impact: <ol><li><b>Context assembly</b> — what is in the window this step, in what order, with what budget.</li><li><b>Tool surface</b> — names, descriptions, schemas, how many are visible at once.</li><li><b>Observation shaping</b> — what the model sees after a tool runs. The most underrated layer.</li><li><b>Control flow</b> — step caps, cost ceilings, loop detection, stop conditions.</li><li><b>State and memory</b> — scratchpad, summary, durable facts, checkpoints.</li><li><b>Output contract</b> — schema validation, citation checks, repair loops.</li></ol>',
  trap: 'The phrase exists because two teams ship on the same model with the same tools and one is twice as good with no meaningful prompt difference. If you can name where the difference actually lives, you have answered the question.',
  tags: ['harness'], orig: 36,
  xref: [['Take a harness apart layer by layer', '../agentic_ai_flow/index.html']] },

{ id: 'ag06', topic: 'agents', level: 3,
  q: 'Two agents, same model, same tools, similar prompts. One resolves 71% of tickets, the other 38%. What explains it?',
  lay: 'Not the prompt. The labels on the tools, what the tools hand back, how the errors are phrased, what gets thrown away when the context fills up, and when the loop is allowed to stop.',
  tech: 'Six differences that produce a large gap with no visible prompt change: <ul><li><b>Tool description</b> — "search orders" versus a description that says what it returns, its limit, and when to use a different tool.</li><li><b>Parameter schema</b> — free string versus enum. One invites silent empty results; the other makes them impossible.</li><li><b>Error message</b> — a stack trace versus a sentence naming the mistake and the legal values.</li><li><b>Observation size</b> — six projected fields plus "3 more, call with offset=3" versus a 38k-token raw payload that buries the answer and evicts the task.</li><li><b>History policy</b> — pinned system prompt, rolling summary, last six turns, versus appending forever until something silently truncates.</li><li><b>Stop conditions</b> — step cap, cost ceiling and repeat-call detector, versus "max 50 steps".</li></ul>',
  trap: 'Notice that none of those is a prompt change. That is the whole point, and saying it explicitly is the answer: "we use the same model" tells you almost nothing about how good an agent will be.',
  tags: ['harness'], orig: 12 },

{ id: 'ag07', topic: 'agents', level: 2,
  q: 'What is observation shaping and why does it matter so much?',
  lay: 'What the tool hands back to the model. A tool that returns forty thousand tokens of raw JSON costs money, buries the answer in the middle of the context, and pushes the original task out of the window. Six well-chosen fields do the job.',
  tech: 'Transform the tool result before the model sees it: <ul><li><b>Project</b> to the fields that matter for the decision at hand.</li><li><b>Truncate lists</b> with an explicit continuation: "showing 3 of 217, call again with offset=3".</li><li><b>Store large payloads out of band</b> under an id the model can reference, rather than inlining them.</li><li><b>Turn errors into instructions</b> — name what was wrong and what the legal values are.</li><li><b>Summarise</b> long text results with a cheap model when the agent only needs the gist.</li><li><b>Normalise formats</b> so the model sees consistent shapes across tools.</li></ul>',
  trap: 'This one change often beats a model upgrade. Teams reach for a better model when the real problem is that one tool returns a 38k-token blob on step three and everything after it degrades.',
  tags: ['harness', 'tools'], orig: 36 },

{ id: 'ag08', topic: 'agents', level: 2,
  q: 'What is ReAct?',
  lay: 'A pattern where the model alternates between writing its reasoning and taking an action, then reads the result and continues. It makes the thinking visible and the actions parseable.',
  tech: 'Reason + Act: interleave reasoning traces with tool calls in a fixed format — Thought, Action, Action Input, Observation, repeat. The critical implementation detail is the stop sequence at <span class="mono">Observation:</span>, so the model cannot fabricate a tool result. Your code executes the tool and appends the real observation. Modern native tool-calling APIs replace the text format with structured calls, which is far more reliable to parse, but the loop is identical.',
  trap: 'If you see plausible-looking tool results that never happened, check the stop sequence first. It is the single most common bug in a hand-rolled ReAct loop.',
  tags: ['react'], orig: 31 },

{ id: 'ag09', topic: 'agents', level: 2,
  q: 'What is plan-and-execute, and when is it better than ReAct?',
  lay: 'Write the whole plan first, then carry it out — instead of deciding each step as you go. Cheaper, because the expensive model only plans once, and a human can approve the plan before anything happens.',
  tech: 'Generate a complete plan with a strong model, then execute steps with a cheaper one, re-planning only when a step fails. Advantages: fewer expensive calls, a plan that can be shown to a human for approval before side effects occur, easier to parallelise independent steps, and bounded cost. Disadvantages: less adaptive — a plan made before seeing any data can be wrong from step one — so you need an explicit replan trigger. Best for multi-step tasks with side effects and for anything requiring sign-off.',
  compare: { cols: ['ReAct', 'Plan-and-execute'],
    rows: [
      ['Decides the next step', 'after each observation', 'all up front'],
      ['Adaptivity', 'high', 'lower — needs an explicit replan'],
      ['Expensive model calls', 'one per step', 'one for the plan'],
      ['Human approval', 'awkward — mid-loop', 'natural — approve the plan'],
      ['Parallelism', 'hard', 'easy for independent steps'],
      ['Cost predictability', 'poor', 'good'],
      ['Best for', 'exploration, unknown shape', 'known-shape tasks with side effects']
    ] },
  trap: 'A hybrid usually wins: plan at a coarse level, execute each step with a small ReAct loop, and replan only when a step reports failure.',
  tags: ['planning'], orig: 46 },

{ id: 'ag10', topic: 'agents', level: 2,
  q: 'What is reflection, and what does it cost?',
  lay: 'The agent reads its own answer, criticises it, and revises. It genuinely improves writing and code, and it doubles or triples your bill and latency.',
  tech: 'A second pass where a critic (the same model with a different prompt, or a different model) evaluates the output against criteria and triggers a revision. It works best when errors are visible on re-reading — code that does not compile, an answer missing a required section, a claim without a citation. It works worst on factual errors the model cannot detect without external information. Always cap the number of revisions (2 is usually enough) or it will revise indefinitely, and measure whether iteration 2 actually improves your metric — often it does not.',
  trap: 'Reflection against a VERIFIER is far more valuable than reflection against the model\'s own judgement. Run the tests, run the validator, run the citation check, and feed the concrete failure back. Self-critique without ground truth mostly produces more confident prose.',
  tags: ['reflection'], orig: 31 },

{ id: 'ag11', topic: 'agents', level: 2,
  q: 'What are the main agentic design patterns?',
  lay: 'Nine shapes that keep recurring. Most real systems are two or three of them stacked, not one exotic one.',
  tech: '<ul><li><b>ReAct loop</b> — think, act, observe. The default. Cheap and debuggable; needs a step cap.</li><li><b>Plan-and-execute</b> — plan once, execute with a cheaper model, replan on failure.</li><li><b>Reflection / critic</b> — a second pass that criticises and revises.</li><li><b>Router / dispatcher</b> — a cheap classifier picks the specialist or model tier first. Usually the highest-leverage single change to cost.</li><li><b>Tool scoping by phase</b> — only expose the tools legal right now.</li><li><b>Supervisor / worker</b> — one agent owns the goal and delegates to specialists with their own contexts.</li><li><b>Blackboard</b> — agents read and write one shared structured state instead of passing messages.</li><li><b>Human in the loop gate</b> — interrupt before any irreversible action, checkpoint, wait, resume.</li><li><b>Escalation ladder</b> — cheap model, strong model, human, with an explicit trigger at each rung.</li></ul>',
  trap: 'The interviewer is checking whether you treat these as a menu or as a hierarchy. Say that you start with the simplest that works and add a pattern only when a specific failure demands it.',
  tags: ['patterns'], orig: 31 },

{ id: 'ag12', topic: 'agents', level: 2,
  q: 'How do you set up a multi-agent system, and when should you?',
  lay: 'Split the work between specialists, each with its own instructions and its own tools, coordinated by a supervisor. Do it when the subtasks are genuinely separate — and know that you have just multiplied the number of ways things can go wrong.',
  tech: 'Topologies: <ul><li><b>Supervisor / worker</b> — one agent owns the goal and delegates. The most common and the easiest to reason about.</li><li><b>Sequential pipeline</b> — fixed handoffs, each stage specialised. Barely an agent system; more predictable for it.</li><li><b>Peer handoff</b> — agents transfer control to each other. Flexible and hard to bound.</li><li><b>Blackboard</b> — shared structured state instead of messages. Much easier to inspect and checkpoint.</li></ul>Use it when: subtasks need genuinely different tools or system prompts; contexts would otherwise collide (a code agent and a customer-comms agent should not share a window); you want independent evaluation of each specialist; or the work parallelises. Do NOT use it because it sounds sophisticated.',
  trap: 'The hardest part is the handoff message: what one agent tells the next is a lossy summary, and most multi-agent failures are information lost at the boundary. Make the handoff a typed schema, not free prose.',
  tags: ['multi-agent'], orig: 45 },

{ id: 'ag13', topic: 'agents', level: 3,
  q: 'What goes wrong in multi-agent systems?',
  lay: 'Every boundary is a chance to lose information, every agent is a chance to loop, and every extra model call multiplies your bill and your failure modes. Two agents are more than twice as hard as one.',
  tech: '<ul><li><b>Lossy handoffs</b> — the summary passed between agents omits the detail the next one needed.</li><li><b>Infinite delegation</b> — A asks B, B asks A. Needs a depth limit and a cycle detector.</li><li><b>Cost explosion</b> — five agents at three steps each is fifteen model calls, plus the supervisor.</li><li><b>Error compounding</b> — 90% per agent over four agents is 66% end to end.</li><li><b>Diffuse responsibility</b> — when the output is wrong, which agent is to blame? Without per-agent tracing you cannot tell.</li><li><b>Context divergence</b> — agents form contradictory beliefs about the same facts.</li><li><b>Untestability</b> — you can no longer evaluate the system by evaluating one prompt.</li></ul>',
  trap: 'The strong answer is scepticism with a threshold: "I would start with one agent and a router, and split only when I could point at a specific failure that separation fixes." Enthusiasm for multi-agent architectures without that caveat reads as inexperience.',
  tags: ['multi-agent'], orig: 45 },

{ id: 'ag14', topic: 'agents', level: 2,
  q: 'What is human in the loop, and where does it belong?',
  lay: 'Stop before doing anything you cannot undo, show a person what you are about to do, and wait. It is a safety feature and, just as importantly, a durability feature — the run has to survive the wait.',
  tech: 'Patterns: <b>approve before acting</b> (interrupt before an irreversible tool call), <b>review after drafting</b> (the agent prepares, a human sends), <b>escalate on low confidence</b>, and <b>sample audit</b> (a percentage reviewed asynchronously). The engineering requirement is durable interruption: checkpoint the full agent state, return, and resume from the checkpoint when approval arrives — possibly hours later, possibly on a different server. That is why frameworks like LangGraph make checkpointing a first-class concept.',
  trap: 'Where to put the gate: anything that moves money, deletes data, sends external communication, or changes permissions. Everything else can be reviewed after the fact by sampling. Gating everything trains reviewers to click approve without reading.',
  tags: ['hitl'], orig: 46 },

{ id: 'ag15', topic: 'agents', level: 3,
  q: 'An agent has been running for 50 turns and suddenly forgets everything from the beginning. What happened?',
  lay: 'Nothing crashed. Something quietly deleted the earliest part of the conversation to make room — and the earliest part was your system prompt and the original task.',
  tech: 'Causes, roughly by frequency: <ol><li><b>Silent truncation</b> — a framework or provider dropped the oldest messages to fit the window. The system prompt was message zero, so it went first. No error.</li><li><b>Summary drift</b> — you summarised the summary repeatedly, so specifics evaporated: "refund order 4471 for $89.20" became "the customer had a billing issue".</li><li><b>Lost in the middle</b> — nothing was dropped, but the instruction sits at token 60,000 of 120,000 where attention is weakest.</li><li><b>Tool output flooding</b> — a 40k-token JSON result on turn 12 is still there on turn 50, having pushed out everything else.</li><li><b>No pinned identity</b> — the user\'s name and constraints were mentioned once, in prose, in turn one.</li></ol>Fixes: own the trimming (pin the system prompt and the task, drop from the middle); summarise from the ORIGINAL transcript, never from the previous summary; keep a pinned facts block copied verbatim; restate the task at the END of the prompt every turn; truncate tool outputs at the tool boundary; and log the token count of every request with an alarm near the limit.',
  dgm: { nodes: [{ t: 'system + tools', s: 'pinned' }, { t: 'pinned facts', s: 'verbatim' }, { t: 'summary', s: 'from the original' }, { t: 'last N turns' }, { t: 'task restated', s: 'LAST', k: 'warn' }, { t: 'headroom', s: 'reserved' }],
    cap: 'Every band has a token budget and an explicit policy. Nothing is appended without one.' },
  trap: 'The framing that lands: this is not model degradation, it is a context management bug, and it is silent. If you cannot say what your system drops when it runs out of room, it is dropping your instructions.',
  tags: ['context-rot', 'memory'], orig: 32 },

{ id: 'ag16', topic: 'agents', level: 2,
  q: 'How do you stop an agent looping forever?',
  lay: 'Give it a step limit, a money limit, and a rule that says "you already tried exactly that". Then make sure that when it gives up, it hands over something useful.',
  tech: 'Layered guards: <ul><li><b>Step cap</b> — 8–15 for most tasks. If it needs more, the task is wrong or the tools are.</li><li><b>Cost ceiling</b> in tokens and money, checked before every model call.</li><li><b>Wall-clock deadline.</b></li><li><b>Repeat-call detection</b> — the same tool with identical arguments twice in a row is almost always a bug; tell the model so in the observation.</li><li><b>No-progress detection</b> — N steps with no new information retrieved.</li><li><b>Explicit give-up path</b> that returns a partial answer plus what was tried, rather than an error.</li></ul>',
  trap: 'The give-up path is the part people skip, and it is what users actually experience. "I could not complete this. Here is what I found and what I tried" scores far higher with users than either a spinner or a fabricated answer.',
  tags: ['reliability', 'loop'], orig: 37 },

{ id: 'ag17', topic: 'agents', level: 2,
  q: 'What is MCP (Model Context Protocol)?',
  lay: 'A standard plug shape for connecting models to tools and data. Before it, every integration was bespoke; with it, any client that speaks the protocol can use any server that speaks it.',
  tech: 'An open protocol (introduced by Anthropic, now broadly adopted) standardising how applications expose context and capabilities to LLMs. It defines three primitive types: <b>tools</b> (model-invoked functions), <b>resources</b> (application-controlled data the client can read), and <b>prompts</b> (user-invoked templates). Transport is JSON-RPC over stdio or HTTP with server-sent events. The value is combinatorial: N clients × M servers becomes N + M integrations instead of N × M.',
  trap: 'The security consideration worth raising: an MCP server is code you are trusting with your context and your tool permissions. Treat third-party servers like third-party dependencies — review them, scope their permissions, and do not connect one to an agent that can spend money.',
  tags: ['mcp', 'tools'] },

{ id: 'ag18', topic: 'agents', level: 2,
  q: 'How do you scope tools so the agent picks the right one?',
  lay: 'Do not show it forty tools. Show it the five that make sense right now, and tell each one when NOT to be used.',
  tech: 'Techniques: <ul><li><b>Phase scoping</b> — expose only tools legal at this point in the task. Halves the token cost and roughly halves selection errors.</li><li><b>Role scoping</b> — in multi-agent systems, each agent sees only its own tools.</li><li><b>Tool retrieval</b> — when you genuinely have hundreds, embed the tool descriptions and select the top-k for this request.</li><li><b>Hierarchical tools</b> — one <span class="mono">search</span> tool with a <span class="mono">source</span> enum beats five near-identical search tools.</li><li><b>Negative guidance</b> — "do NOT use this to count; use count_orders" is worth more than a longer positive description.</li></ul>',
  trap: 'Ordering matters for a reason people miss: tool definitions are part of the prompt prefix, so a shuffled tool list breaks prompt caching and quietly multiplies your input cost.',
  tags: ['tools'], orig: 31 },

{ id: 'ag19', topic: 'agents', level: 2,
  q: 'How do you handle a tool that fails?',
  lay: 'Translate the failure into a sentence the model can act on, decide whether retrying could possibly help, and stop offering a tool that keeps breaking.',
  tech: '<ol><li><b>Humanise the error</b> — "status must be one of OPEN, PENDING, CLOSED; you sent \'open\'" rather than a stack trace. A good error is a prompt.</li><li><b>Classify retryable versus terminal</b> — a 500 is worth one retry; a 422 means the arguments were wrong and an identical retry is pure waste.</li><li><b>Cap retries per tool per run.</b></li><li><b>Remove a repeatedly-failing tool</b> from the surface for the rest of the run and tell the model it is unavailable.</li><li><b>Have a documented degradation</b> — "the order service is unavailable; here is what I can tell you from the cache".</li><li><b>Never leak internals</b> — stack traces in the context are tokens spent teaching the model nothing, and occasionally a security leak.</li></ol>',
  trap: 'Metric to name: recovery rate after a tool error. An agent that never recovers from a bad parameter has an error-message problem, not a model problem, and that is measurable.',
  tags: ['tools', 'reliability'], orig: 37 },

{ id: 'ag20', topic: 'agents', level: 2,
  q: 'What is agent memory, and what are its layers?',
  lay: 'Four kinds: what is on the desk right now, what happened earlier in this conversation, durable facts about this user, and records of specific past events.',
  tech: '<b>Working</b> — the context window itself, rebuilt each request. <b>Short-term / conversational</b> — recent turns verbatim plus a rolling summary, session-scoped. <b>Semantic</b> — durable facts and preferences, stored and retrieved per request. <b>Episodic</b> — records of specific past events and outcomes, retrieved by similarity to the current situation. <b>Procedural</b> — learned or authored workflows. Consolidation moves things between layers: extract durable facts from a conversation, reconcile against what is stored, and ADD, UPDATE, DELETE or do nothing.',
  trap: 'The hard part is reconciliation, not storage. Without it you accumulate "the user lives in Berlin" and "the user lives in Munich" side by side, and retrieve whichever is closer to the query — which is worse than having no memory at all.',
  tags: ['memory'], orig: 46 },

{ id: 'ag21', topic: 'agents', level: 3,
  q: 'How do you evaluate an agent, as opposed to a model?',
  lay: 'You are not grading one answer, you are grading a whole run: did it reach the goal, how many steps did it take, what did it cost, did it break anything, and did it use the right tools along the way.',
  tech: 'Model evaluation scores a single input-output pair. Agent evaluation scores a trajectory: <ul><li><b>Task success</b> — did it achieve the goal, verified programmatically where possible (the refund was issued, the tests pass, the record exists).</li><li><b>Trajectory quality</b> — correct tool selection, no redundant calls, sensible ordering. Compare against a reference trajectory or judge it.</li><li><b>Efficiency</b> — steps, tokens, wall-clock, cost per successful task (not per call).</li><li><b>Safety</b> — did it attempt anything out of policy, did it respect approval gates.</li><li><b>Recovery</b> — when a tool failed, did it adapt.</li><li><b>Termination</b> — did it stop appropriately rather than hitting the cap.</li></ul>You also need deterministic tool mocks, or your eval measures the weather in your dependencies rather than your agent.',
  compare: { cols: ['Evaluating a model', 'Evaluating an agent'],
    rows: [
      ['Unit', 'one input → one output', 'a whole trajectory'],
      ['Ground truth', 'a reference answer', 'a final state you can check'],
      ['Determinism', 'reasonably reproducible', 'compounding variance across steps'],
      ['Cost per eval case', 'one call', 'many calls, unbounded without a cap'],
      ['Key metrics', 'accuracy, faithfulness', 'task success, steps, cost per success, recovery rate'],
      ['Environment', 'none needed', 'a sandbox with mocked tools and seeded state'],
      ['Main difficulty', 'grading open text', 'reproducing the environment']
    ] },
  trap: 'Cost per SUCCESSFUL task is the metric that changes decisions. An agent with 60% success at $0.10 is worse than one with 85% at $0.25, and only the per-success number shows it.',
  tags: ['eval', 'agents'], orig: 44 },

{ id: 'ag22', topic: 'agents', level: 2,
  q: 'What is the failure playbook for an agent in production?',
  lay: 'Eight things will go wrong. Each needs to be a named branch with a detection, one cheap recovery, an honest degradation and a number you alarm on — not an exception that surfaces as a confident wrong answer.',
  tech: '<ul><li><b>Empty retrieval</b> — detect explicitly, try one relaxed retry, then refuse specifically. Alarm on empty-retrieval rate.</li><li><b>Low-confidence retrieval</b> — use the rank-1 to rank-5 score gap; escalate to rerank or fan-out; hedge the answer.</li><li><b>LLM timeout</b> — client timeout shorter than user patience, one retry with jitter, hedge, fail over to a smaller model, mark degraded.</li><li><b>Rate limit</b> — respect Retry-After, full jitter, throttle at source, priority queue, overflow to a second provider.</li><li><b>Context too long</b> — count before sending, trim by explicit policy, never drop the system prompt, reserve answer headroom.</li><li><b>Cost runaway</b> — per-request token and money budget checked before every call, plus loop detection. Alarm on cost per request, not total spend.</li><li><b>Low-confidence answer</b> — verify mechanically first (citations exist, numbers present, output parses), then a cheap faithfulness judge, then escalate.</li><li><b>Tool failure</b> — instructive errors, retryable versus terminal, cap retries, remove the failing tool.</li></ul>',
  trap: 'The unifying principle: degrade, never disappear. A partial answer plus what was tried plus a route to a human beats both a spinner and a fabrication — and never cache anything produced on a degraded path.',
  tags: ['reliability', 'playbook'], orig: 37,
  xref: [['The playbook, one card per failure', '../agentic_ai_flow/index.html']] },

{ id: 'ag23', topic: 'agents', level: 2,
  q: 'How do you make agent runs reproducible for debugging?',
  lay: 'Record everything that went in and out, so you can replay the whole run without calling anything expensive again.',
  tech: 'Log per step: the full rendered prompt (or a hash plus the template version), the model id and version, sampling parameters and seed, the tool calls with arguments, the raw tool responses, the shaped observations, token counts and cost. Then build a replay mode that feeds recorded tool responses instead of calling the real ones — that turns a production incident into a deterministic local test. Store the trace with a run id that appears in your user-facing error messages so a support ticket maps to a trace.',
  trap: 'Log the tool RESPONSE, not just the call. Most agent failures are the agent reacting reasonably to a surprising tool result, and without the response you are guessing.',
  tags: ['observability', 'debugging'], orig: 39 },

{ id: 'ag24', topic: 'agents', level: 3,
  q: 'What is prompt injection in an agent, and why is it worse than in a chatbot?',
  lay: 'Someone hides an instruction inside a document or a web page, the agent reads it, and follows it. In a chatbot the worst case is a rude answer. In an agent with tools, the worst case is it emails your data to a stranger.',
  tech: 'Indirect prompt injection: malicious instructions embedded in content the agent retrieves (a document, a web page, an email, a code comment). The agent cannot reliably distinguish data from instructions. It is worse in agents because the model has capabilities — it can call tools, spend money, send messages and modify data. The classic chain is: retrieve poisoned content → the model follows the injected instruction → it exfiltrates data through a tool call. Defences must be architectural, not prompt-based: <ul><li>Least-privilege tools; the agent should not have a "send email to arbitrary address" tool if it does not need one.</li><li>Human approval on irreversible or outbound actions.</li><li>Treat all retrieved content as untrusted data, clearly delimited, with an explicit instruction never to follow instructions inside it.</li><li>Egress controls — allowlist destinations for any tool that sends data outward.</li><li>Separate the agent that reads untrusted content from the agent that has privileges (a dual-LLM pattern).</li><li>Output scanning for exfiltration patterns.</li></ul>',
  trap: 'The honest position: prompt injection is not solved, and prompt-based defences reduce the rate rather than eliminating it. Design so that a successful injection cannot do serious damage, because you must assume some will succeed.',
  tags: ['security', 'injection'], orig: 43 },

{ id: 'ag25', topic: 'agents', level: 2,
  q: 'How do you handle irreversible actions?',
  lay: 'Ask first, do once, and be able to undo. Confirm before anything that moves money or sends a message, make sure a retry does not do it twice, and have a compensating action for when it goes wrong anyway.',
  tech: '<ol><li><b>Classify every tool</b> as read, reversible write, or irreversible. Only the last two need ceremony.</li><li><b>Human approval</b> before irreversible actions, with a durable interrupt: checkpoint, wait, resume.</li><li><b>Idempotency keys</b> — a deterministic key per logical action, so a retry after a timeout does not issue a second refund. This is the single most important one.</li><li><b>Compensating transactions</b> — a saga pattern: for every action, a defined way to undo it, executed in reverse on failure.</li><li><b>Dry run</b> — the agent proposes the exact call and a human sees the arguments before it executes.</li><li><b>Limits</b> — per-action and per-day caps enforced in code, not in the prompt.</li><li><b>Audit</b> — who approved, what was executed, what changed.</li></ol>',
  trap: 'Idempotency is the one people forget and the one that bites. An agent that times out and retries a payment without an idempotency key has just charged the customer twice, and the model did nothing wrong.',
  tags: ['reliability', 'hitl'] },

{ id: 'ag26', topic: 'agents', level: 2,
  q: 'What does an agent observability stack look like?',
  lay: 'Every run gets a trace showing each step, what it cost, how long it took and what it decided. Without that, debugging an agent is guesswork.',
  tech: 'Structured tracing with a span per step: model call (prompt hash, model version, tokens, cost, latency), tool call (name, arguments, latency, error), and decision points. Aggregate into: steps per run, cost per run and per successful task, tool error rates, recovery rate, termination reason distribution (completed / step cap / cost cap / error), and end-to-end task success. Tools: OpenTelemetry with GenAI semantic conventions, or a purpose-built platform (LangSmith, Langfuse, Arize, Braintrust). Sample full traces on success, keep all traces on failure.',
  trap: 'Termination-reason distribution is the underrated metric. If 20% of runs end at the step cap, your agent is not succeeding — it is running out of budget, and no accuracy metric will show that.',
  tags: ['observability'], orig: 39 },

{ id: 'ag27', topic: 'agents', level: 2,
  q: 'What is a supervisor agent and how does it decide what to delegate?',
  lay: 'One agent owns the goal and hands pieces of it to specialists, then puts the results together. It is a project manager that can also do the work if it has to.',
  tech: 'The supervisor holds the task, decides which specialist to invoke (usually as a tool call), passes a scoped brief, and integrates results. Design decisions that matter: does the supervisor see the workers\' full context or just their outputs (usually just outputs, to keep the window manageable); is delegation one-shot or can workers ask clarifying questions; what is the depth limit; and what is the shape of the handoff message. Making the handoff a typed schema rather than free prose removes most of the lossy-summary problem.',
  trap: 'The failure to name: the supervisor becomes a bottleneck holding the whole task in its context, which is exactly the context-management problem you split the system to avoid. Keep the supervisor thin and the briefs explicit.',
  tags: ['multi-agent'], orig: 45 },

{ id: 'ag28', topic: 'agents', level: 3,
  q: 'How do you test an agent in CI?',
  lay: 'Mock the tools so the results are the same every time, run a fixed set of tasks, and check the end state — not the exact words it used.',
  tech: '<ol><li><b>Deterministic tool mocks</b> with recorded fixtures, so the environment does not change between runs.</li><li><b>A task suite</b> of 20–100 scenarios with programmatically checkable end states ("a refund record exists with this amount", "the file compiles").</li><li><b>Assert on outcomes and trajectories</b>, not on strings: success, step count under a threshold, no forbidden tool called, cost under a ceiling.</li><li><b>Run at temperature 0 with a pinned model version</b>, and accept that it is still not perfectly deterministic — use a pass rate over n runs rather than a single boolean.</li><li><b>Adversarial cases</b> — an injected instruction in a retrieved document, a tool that returns an error, a tool that returns nothing.</li><li><b>Budget the suite</b> — agent evals are expensive; run the full suite nightly and a fast subset per commit.</li></ol>',
  trap: 'Flakiness is inherent, so define the gate as a pass rate ("18 of 20 scenarios, three runs each") rather than all-green. A suite that fails randomly gets disabled, and then you have no suite.',
  tags: ['testing', 'eval'], orig: 44 },

{ id: 'ag29', topic: 'agents', level: 2,
  q: 'What is the difference between an agent and a workflow, in production terms?',
  lay: 'A workflow is a flowchart with LLM calls in some boxes. An agent is a loop where the model draws the flowchart as it goes. The first is testable and boring; the second is capable and unpredictable.',
  tech: 'Workflow: fixed graph, deterministic control flow, predictable cost and latency, testable node by node, and it fails in ways you can enumerate. Agent: model-determined control flow, unbounded cost without guards, variable latency, requires trajectory-level evaluation, and it fails in ways you discover in production. The practical shape of most good systems: a workflow skeleton with agentic steps inside specific nodes, so you get bounded structure with local flexibility.',
  trap: 'The maturity signal is choosing the workflow when it suffices. "We replaced the agent with a three-step chain and a router; accuracy went up and cost fell 80%" is a better story than any architecture diagram.',
  tags: ['design'], orig: 46 },

{ id: 'ag30', topic: 'agents', level: 2,
  q: 'How do you give an agent long-term memory without it going stale or contradictory?',
  lay: 'Write facts down carefully, check new facts against old ones, mark when things were learned, and let the user see and delete them.',
  tech: '<ul><li><b>Extract selectively</b> — only durable, useful facts, not every sentence. Run extraction asynchronously after the turn.</li><li><b>Reconcile</b> — for each candidate, retrieve similar existing memories and decide ADD / UPDATE / DELETE / NOOP rather than blindly appending.</li><li><b>Provenance and timestamps</b> — when was this learned, from which conversation, with what confidence.</li><li><b>Expire or re-verify</b> — facts about preferences age well; facts about state ("currently on the Pro plan") do not.</li><li><b>Scope</b> — strictly per user and per tenant, in the retrieval filter and in the cache key.</li><li><b>Make it inspectable</b> — the user can see and delete what is stored. This is a requirement in most jurisdictions and a good idea everywhere.</li><li><b>Never extract from untrusted content</b> — that is memory poisoning.</li></ul>',
  trap: 'Ask "how do you delete a memory?" of any memory design. If there is no answer, it is a data-protection problem waiting to happen as well as a quality one.',
  tags: ['memory'], orig: 52 },

{ id: 'ag31', topic: 'agents', level: 2,
  q: 'What is a router agent, and why is it the highest-leverage pattern?',
  lay: 'A cheap classifier at the front that decides where each request should go — which specialist, which model, which pipeline. Most traffic is easy, and this is how you stop paying premium prices for it.',
  tech: 'A lightweight first step (a small model, a classifier, or rules) that inspects the request and routes to a destination: a model tier, a specialised agent, a deterministic pipeline, or a canned response. Highest leverage because it addresses cost and quality simultaneously: the cheap tier handles the easy majority, and the expensive tier is reserved for cases that need it. Implementation notes: route on intent, not on length; measure quality per destination separately; keep a shadow sample where the expensive path also answers so you can quantify what you gave up.',
  trap: 'The failure mode is a router that is confidently wrong. Track the escalation rate and the quality gap per route, and make the router\'s own accuracy a measured metric rather than an assumption.',
  tags: ['routing', 'cost'], orig: 27 },

{ id: 'ag32', topic: 'agents', level: 3,
  q: 'How do you parallelise agent work safely?',
  lay: 'Run independent steps at the same time, but only if they genuinely do not depend on each other and none of them changes shared state.',
  tech: 'Safe to parallelise: independent read-only tool calls (three searches, four lookups), independent sub-tasks with no shared state, and fan-out patterns like multi-query retrieval. Unsafe: anything with side effects on shared state, anything where step B needs step A\'s result, and anything where partial failure leaves an inconsistent state. Implementation: express dependencies explicitly (a DAG rather than a list), use a concurrency cap to avoid hammering downstream services, and define the semantics of partial failure — does one failed branch fail the whole task, or does the agent continue with what it has?',
  trap: 'The interesting failure is partial success: three of five branches return, two time out. Decide in advance whether that is a failure or a degraded success, and make sure the model is told which branches are missing rather than silently seeing four results and assuming that was all of them.',
  tags: ['concurrency', 'design'] },

{ id: 'ag33', topic: 'agents', level: 2,
  q: 'What is the ReWOO pattern and why does it save money?',
  lay: 'Plan all the tool calls up front without waiting for any results, run them all at once, then reason over everything together. Fewer expensive model calls, and the tools run in parallel.',
  tech: 'Reasoning WithOut Observation: the planner produces a full plan with variable placeholders for results the tools have not returned yet; a worker executes the tools (in parallel where independent); a solver reasons over the collected evidence in one final call. Contrasted with ReAct, which interleaves and therefore needs one expensive model call per step. Savings can be large on multi-tool tasks. Cost: it cannot adapt mid-plan, so it needs a replan trigger when a tool returns something unexpected.',
  trap: 'It suits tasks where the shape is predictable — gather these four facts, then answer. It suits exploration badly, because the plan was written before the agent knew anything.',
  tags: ['patterns', 'cost'], orig: 31 },

{ id: 'ag34', topic: 'agents', level: 2,
  q: 'How do you decide the step budget for an agent?',
  lay: 'Look at how many steps successful runs actually take, and set the cap a bit above that. If the cap is where most runs end, the cap is not the problem.',
  tech: 'Measure the distribution of steps on SUCCESSFUL runs and set the cap around p95 plus a small margin — typically 8–15 for tool-using agents. Then watch the termination-reason distribution: if a significant share of runs terminate at the cap, either the tasks are too hard for the tool set, a tool is broken, or the agent is looping. Raising the cap is almost never the fix; it usually just costs more before failing. Also budget in tokens and money, because a run can be expensive in three steps if one tool returns 40k tokens.',
  trap: 'The diagnostic framing: the step cap is a symptom detector, not a control. If runs are hitting it, something upstream is wrong, and the interesting question is which tool or which task type.',
  tags: ['reliability', 'tuning'], orig: 37 },

{ id: 'ag35', topic: 'agents', level: 2,
  q: 'What is the difference between structured output and tool calling?',
  lay: 'Structured output is "give me the answer in this shape". Tool calling is "tell me which action to take, and with what arguments". Mechanically they are the same trick; the intent is different.',
  tech: 'Both constrain the model to emit JSON matching a schema. Structured output constrains the FINAL answer — extraction, classification, a filled form. Tool calling constrains an intermediate ACTION that your code will execute and whose result goes back into the loop. Many providers implement structured output using the same constrained-decoding machinery as tool calling. Practical distinction: with structured output you are done; with a tool call you are mid-loop and must handle execution, errors and the next turn.',
  trap: 'A neat trick worth knowing: you can implement "the model must choose exactly one of these actions" as a structured output with a discriminated union, which is often simpler to reason about than a tool-calling loop when there is only one decision to make.',
  tags: ['tools', 'structured-output'], orig: 46 },

{ id: 'ag36', topic: 'agents', level: 3,
  q: 'How would you build a customer support agent that can issue refunds?',
  lay: 'Let the model read and reason; do not let it press the button. It gathers facts, proposes a refund with a reason, a policy check runs in code, and either a rule or a human approves it.',
  tech: '<ol><li><b>Tools split by risk</b> — read tools (order lookup, policy search) are free; the refund tool is gated.</li><li><b>Policy in code, not in the prompt</b> — eligibility, limits and exceptions are deterministic rules the model cannot talk its way past.</li><li><b>The model proposes, the system disposes</b> — the agent emits a structured refund proposal with a reason and citations; the policy engine approves, rejects or escalates.</li><li><b>Idempotency key</b> on the refund call, derived from the order id and amount, so a timeout retry cannot double-refund.</li><li><b>Thresholds</b> — auto-approve below a value with a clean policy match, human approval above it.</li><li><b>Audit trail</b> — the conversation, the retrieved policy chunks, the proposal, the decision, the executed call.</li><li><b>Guards</b> — per-day refund caps in code, injection defences on any customer-supplied text, and a kill switch.</li><li><b>Evaluation</b> — a scenario suite including adversarial customers, policy edge cases and tool failures, asserting on the END STATE.</li></ol>',
  trap: 'The line that matters: the model decides what SHOULD happen; deterministic code decides what DOES happen. Any design where the model can directly move money will be talked into doing so.',
  tags: ['design', 'safety'], orig: 45 },

{ id: 'ag37', topic: 'agents', level: 2,
  q: 'What is a scratchpad and how do you keep it from exploding?',
  lay: 'The agent\'s notepad — what it tried and what it learned. Useful, and it grows forever unless you manage it.',
  tech: 'The working area in context holding reasoning, tool calls and observations for the current run. Management: truncate tool outputs at the tool boundary (not in the prompt builder); summarise the scratchpad when it exceeds a threshold, keeping the pinned task and the key findings; store large artefacts out of band under ids; and drop superseded observations (the failed attempt at step 2 is rarely worth carrying to step 9). An unmanaged scratchpad is the most common cause of context overflow in agents.',
  trap: 'Compress by removing the failed paths, not the findings. Many implementations summarise everything uniformly and lose the one fact the agent actually needed.',
  tags: ['context', 'agents'] },

{ id: 'ag38', topic: 'agents', level: 2,
  q: 'What is the "agent that does nothing" failure, and how do you detect it?',
  lay: 'The agent runs, calls tools, produces a confident summary — and nothing actually changed. It reported success without doing the job.',
  tech: 'A silent failure where the trajectory looks healthy but the end state is unchanged: the tool call was made with wrong arguments and returned an empty success, the write went to a sandbox, the model summarised its plan as if it were an outcome. Detection: assert on END STATE, never on the agent\'s own report. Query the system of record after the run and confirm the change exists. In evaluation this means every scenario needs a programmatic post-condition, not a judge reading the transcript.',
  trap: 'This is why "task success" must be verified externally. An LLM judge reading the agent\'s own summary will happily confirm a success that never happened, because the summary is well written.',
  tags: ['eval', 'failure'], orig: 44 },

{ id: 'ag39', topic: 'agents', level: 3,
  q: 'How do you handle state and durability in a long-running agent?',
  lay: 'Save your place after every step, so a crash, a restart or a two-hour wait for human approval does not throw the work away.',
  tech: 'Checkpoint the full agent state (messages, scratchpad, pinned facts, step count, spend) to durable storage after every step, keyed by a run id. Requirements: serialisable state (avoid holding open connections or closures in it), idempotent step execution so replaying a checkpoint does not repeat a side effect, and a resume path that reconstructs from the checkpoint. This is what makes human-in-the-loop practical — the interrupt can last hours and resume on a different machine. LangGraph\'s checkpointer and durable-execution engines like Temporal both solve this.',
  trap: 'Idempotency and checkpointing must be designed together. Checkpointing after a step that has already sent an email means a resume re-sends it unless the send is keyed and deduplicated.',
  tags: ['durability', 'hitl'] },

{ id: 'ag40', topic: 'agents', level: 2,
  q: 'What is the difference between an agent framework and rolling your own?',
  lay: 'A framework gives you the loop, the tool plumbing, checkpointing and tracing for free, and gives you an abstraction to fight when you need something it did not anticipate. Rolling your own is a few hundred lines and total control.',
  tech: 'What frameworks (LangGraph, the OpenAI Agents SDK, CrewAI, AutoGen) give you: a loop with retries, tool schema generation, streaming, checkpointing and durable interrupts, tracing integration, and multi-agent primitives. What you give up: transparency into the exact prompt sent, easy debugging when behaviour comes from framework internals, and freedom when your control flow does not match theirs. A reasonable position: start with a hand-rolled loop for a single agent (it is genuinely short), and adopt a framework when you need durable interrupts, checkpointing or a genuinely complex graph.',
  trap: 'The question behind the question is judgement. "We used a framework and could not see what prompt was actually being sent" is a real and common failure; so is "we rebuilt checkpointing badly". Name the trade rather than picking a side dogmatically.',
  tags: ['frameworks'], orig: 42 },

{ id: 'ag41', topic: 'agents', level: 2,
  q: 'What is agentic RAG, in one answer?',
  lay: 'Retrieval where the model decides: whether to search, what to search for, which source to use, and whether the results were good enough to answer with.',
  tech: 'The agent treats retrieval as a tool rather than a fixed pipeline step. It plans, may issue several searches against different sources (vector, SQL, web), critiques the results, and iterates or stops. Earns its cost on multi-hop and ambiguous questions where a single blended embedding retrieves neither part well; wastes money on simple lookups where classic RAG reaches the same answer in one call. Needs a hard step budget, a cost ceiling and tracing, or it will loop silently.',
  trap: 'Route by question complexity. The mature architecture uses classic RAG for the easy majority and escalates to the agentic path when the first retrieval scores poorly or the question contains a conjunction.',
  tags: ['agentic-rag'], orig: 56 },

{ id: 'ag42', topic: 'agents', level: 2,
  q: 'How do you keep an agent from doing something expensive by accident?',
  lay: 'Budgets, checked before every call, and a hard stop when they run out. Everything else is advice.',
  tech: '<ul><li><b>Per-request budget</b> in tokens and money, checked BEFORE each model call, not after.</li><li><b>Per-user and per-tenant daily ceilings</b>, enforced at the gateway so no code path can bypass them.</li><li><b>Caps on anything entering the prompt</b> — documents, tool results, pasted text — enforced at the boundary.</li><li><b>Loop detection</b> — identical tool call twice in a row.</li><li><b>Model tier limits</b> — the expensive model requires an explicit escalation, not a default.</li><li><b>Alarm on cost per request p99</b>, not on total spend, because total spend hides the handful of catastrophic requests.</li></ul>',
  trap: 'The story to have ready: an agent that loops forty times on a broken tool costs $14 for one request, and you find out at the end of the month unless you alarm on the p99. That is the difference between a bad day and a bad invoice.',
  tags: ['cost', 'reliability'], orig: 37 },

{ id: 'ag43', topic: 'agents', level: 3,
  q: 'What is the dual-LLM pattern for injection defence?',
  lay: 'One model reads the untrusted stuff and has no powers. A second model has the powers and never sees the untrusted stuff directly — only a sanitised, structured summary.',
  tech: 'A privileged agent orchestrates and holds tool permissions; a quarantined agent processes untrusted content (retrieved documents, web pages, emails) and can only return structured data, never instructions or free text that the privileged agent will treat as guidance. The quarantined output is validated against a schema before it crosses the boundary. This limits the blast radius of an injection: a successful injection can at worst corrupt data within the schema, not trigger a tool call.',
  trap: 'It is a mitigation with real costs — an extra model call, and a schema that must anticipate what the privileged agent needs. Worth it when the agent has genuinely dangerous capabilities; overkill for a read-only assistant.',
  tags: ['security', 'injection'], orig: 43 },

{ id: 'ag44', topic: 'agents', level: 2,
  q: 'How do you decide when a task is "done"?',
  lay: 'Define done before you start, in terms a program can check. "The model said it was finished" is not a definition.',
  tech: 'Stop conditions, ranked by reliability: <ol><li><b>Programmatic post-condition</b> — the record exists, the tests pass, the file compiles. Always prefer this.</li><li><b>Structured completion signal</b> — the model calls a <span class="mono">finish</span> tool with a typed result, which you then validate.</li><li><b>No tool call in the response</b> — the default in most loops, and the weakest, because a model can stop early.</li><li><b>Budget exhaustion</b> — a failure, not a completion, and it must be reported as such.</li></ol>Always distinguish "completed" from "gave up" in your logs, or your success rate is fiction.',
  trap: 'The failure to name: an agent that stops early and summarises its plan as if it were an outcome. Verifying the end state externally is the only defence, and it is why agent evaluation needs an environment rather than a transcript.',
  tags: ['design', 'eval'], orig: 44 },

{ id: 'ag45', topic: 'agents', level: 2,
  q: 'What would you build first if asked to add an agent to an existing product?',
  lay: 'The smallest thing that is useful and safe: one read-only task, one or two tools, a hard step cap, full tracing, and a way to turn it off. Ship that, learn from real traffic, then expand.',
  tech: 'A concrete first increment: <ol><li>Pick ONE task with a verifiable outcome and no irreversible side effects.</li><li>Two or three well-described read-only tools.</li><li>A hand-rolled loop with a step cap, a cost ceiling and a repeat-call detector.</li><li>Full tracing from day one — you cannot add it retroactively to an incident.</li><li>An eval suite of 20 scenarios with programmatic post-conditions, in CI.</li><li>A feature flag and a kill switch.</li><li>Ship to 5% of traffic, watch task success, escalation rate, cost per success and p95 latency.</li></ol>Then add write capability behind a human approval gate, then automate approval for the low-risk subset once you have the data to justify a threshold.',
  trap: 'The strongest signal here is sequencing: tracing and evaluation BEFORE capability, and read before write. Candidates who describe the full multi-agent architecture first have usually not shipped one.',
  tags: ['design', 'process'], orig: 45 }

]);
