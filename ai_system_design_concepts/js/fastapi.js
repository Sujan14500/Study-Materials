/* ============================================================
   fastapi.js — the concurrency model of a FastAPI service, made
   arithmetic instead of folklore.

   Self-mounting: put <div id="fastapi-conc"></div> in the page.

   The claim this widget exists to prove: on an LLM endpoint, the
   single biggest throughput decision in your codebase is not the
   model, the machine or the worker count. It is which of four
   shapes you typed around one network call. The spread between
   the best and the worst of them is two orders of magnitude on
   identical hardware.

   The numbers are a model, not a benchmark. What is real:
     - Starlette runs a plain `def` handler in the anyio threadpool,
       whose default limiter is 40 tokens.
     - An `async def` handler that calls a blocking client never
       yields, so its worker serves exactly one request at a time.
     - CPython's GIL means per-worker CPU work serialises whichever
       shape you pick, so CPU time per request is a hard ceiling on
       every row.
   Everything on screen is derived from those three facts by
   capacity(), and test.js re-derives it with no browser involved.
   ============================================================ */
(function () {
'use strict';

/* Starlette's anyio threadpool default. The number people raise when
   they should be fixing the handler instead. */
const POOL_DEFAULT = 40;

const HANDLERS = [
  {
    id: 'async', n: 'async def + await', ico: '✅', c: '#34d399',
    tag: 'the right shape',
    one: 'An async handler awaiting an async client. The await hands the event loop back, so one worker holds hundreds of requests that are all just waiting on the network.',
    why: 'An LLM call is 99% waiting. Waiting is free if you yield while you do it — the worker spends its time on the 5 ms of real work per request and nothing else.',
    code:
      '@app.post("/chat")\n' +
      'async def chat(req: ChatRequest) -> ChatResponse:\n' +
      '    # httpx.AsyncClient: the await yields the loop to every\n' +
      '    # other in-flight request while this one waits on the wire.\n' +
      '    r = await client.post(LLM_URL, json=req.model_dump(), timeout=30)\n' +
      '    return ChatResponse(**r.json())'
  },
  {
    id: 'asyncblock', n: 'async def + blocking call', ico: '💥', c: '#fb7185',
    tag: 'the bug that looks like async',
    one: 'An async handler calling a synchronous client. Nothing awaits, so nothing yields — the event loop sits inside that call for the entire round trip and every other request on the worker waits behind it.',
    why: 'This is the most expensive two-character mistake in Python web services, and it is invisible in review: the function says async, the import says requests. It is slower than never having written async at all.',
    code:
      '@app.post("/chat")\n' +
      'async def chat(req: ChatRequest) -> ChatResponse:\n' +
      '    # requests is synchronous. There is no await here, so the\n' +
      '    # event loop is parked for the whole round trip. One at a time.\n' +
      '    r = requests.post(LLM_URL, json=req.model_dump(), timeout=30)\n' +
      '    return ChatResponse(**r.json())'
  },
  {
    id: 'def', n: 'plain def', ico: '🧵', c: '#fbbf24',
    tag: 'safe, capped',
    one: 'A synchronous handler. Starlette notices and runs it in the anyio threadpool, so a blocking client is contained to one of the pool\'s threads instead of the loop.',
    why: 'The unglamorous option that saves you. If your client library is synchronous and you are not going to fix it today, `def` is strictly better than lying with `async def`.',
    code:
      '@app.post("/chat")\n' +
      'def chat(req: ChatRequest) -> ChatResponse:\n' +
      '    # a plain `def` handler is run by Starlette in the anyio\n' +
      '    # threadpool, so blocking here costs one thread, not the loop.\n' +
      '    r = requests.post(LLM_URL, json=req.model_dump(), timeout=30)\n' +
      '    return ChatResponse(**r.json())'
  },
  {
    id: 'threadpool', n: 'async def + run_in_threadpool', ico: '🔀', c: '#22d3ee',
    tag: 'the escape hatch',
    one: 'An async handler that has exactly one blocking dependency and pushes it off the loop explicitly. Same ceiling as `def`, but the rest of the handler stays async.',
    why: 'The realistic middle. Most services have one stubborn synchronous library — an old SDK, a database driver, a PDF parser — inside an otherwise async path.',
    code:
      '@app.post("/chat")\n' +
      'async def chat(req: ChatRequest) -> ChatResponse:\n' +
      '    # one stubborn synchronous dependency, moved off the loop\n' +
      '    # on purpose. Everything around it stays async.\n' +
      '    r = await run_in_threadpool(\n' +
      '        requests.post, LLM_URL, json=req.model_dump(), timeout=30)\n' +
      '    return ChatResponse(**r.json())'
  }
];

/* ---------- the model ----------
   One function that answers "how many requests a second can this
   process actually finish", so the bars, the numbers, the verdict
   and the test can never disagree with each other.

   cpuMs  — real work per request: validation, serialisation, business logic
   ioMs   — time spent waiting on something else (the model, the vector DB)
   pool   — anyio threadpool size, which only `def` and run_in_threadpool use
   workers— uvicorn processes, each with its own loop and its own pool      */
function capacity(o) {
  const cpuMs = o.cpuMs, ioMs = o.ioMs;
  const workers = o.workers, pool = o.pool || POOL_DEFAULT;
  const serviceMs = cpuMs + ioMs;

  /* the GIL serialises CPU work inside a worker whichever shape you pick */
  const cpuCeiling = 1000 / cpuMs;

  let inflight, raw, ceiling;
  if (o.handler === 'async') {
    inflight = Infinity;                    // bounded in practice by sockets, not by us
    raw = cpuCeiling;
    ceiling = 'cpu';
  } else if (o.handler === 'asyncblock') {
    inflight = 1;                           // the loop is parked for the whole call
    raw = 1000 / serviceMs;
    ceiling = 'loop';
  } else {                                  // 'def' and 'threadpool' share the pool
    inflight = pool;
    raw = pool * 1000 / serviceMs;
    ceiling = raw < cpuCeiling ? 'pool' : 'cpu';
  }

  const perWorker = Math.min(raw, cpuCeiling);
  const total = perWorker * workers;

  /* Offered load against that ceiling. The wait term is a rough
     M/M/1 queueing estimate and is labelled as one on screen —
     what matters is the cliff at full utilisation, not the curve. */
  const offered = o.offered;
  const util = offered / total;
  const over = util >= 1;
  const waitMs = over ? Infinity : serviceMs * (util / (1 - util));

  return {
    serviceMs, cpuCeiling, perWorker, total, inflight, ceiling,
    util, over, waitMs,
    latencyMs: over ? Infinity : serviceMs + waitMs,
    headroom: total - offered
  };
}

/* the timeout stack: four layers, and the stingiest one wins whether
   or not you meant it to. Static teaching data, kept here so the test
   can check the ordering claim the page makes. */
const TIMEOUTS = [
  { layer: 'Browser / client SDK', typical: 30, note: 'Often the default nobody set. A 45-second agent run dies here and your server logs show a completed request.' },
  { layer: 'Load balancer / ingress', typical: 60, note: 'ALB idle timeout, nginx proxy_read_timeout. Kills the connection mid-stream and the client sees a truncated response, not an error.' },
  { layer: 'Uvicorn / Gunicorn worker', typical: 30, note: 'Gunicorn --timeout kills the worker, taking every other in-flight request on that process with it. The one that turns a slow request into an outage.' },
  { layer: 'Model SDK / httpx', typical: 600, note: 'Usually the most generous, and therefore usually irrelevant. Setting it carefully while ignoring the three above is the classic wasted afternoon.' }
];

/* the three shapes for an endpoint that takes longer than a request should */
const SHAPES = [
  { n: 'Respond when done', ms: '< 1 s', use: 'Classification, embedding, a cache hit, anything short.',
    how: 'An ordinary handler. Do not complicate this.',
    risk: 'Falls apart the moment a p95 crosses a client timeout you do not control.' },
  { n: 'Stream it', ms: '1-30 s', use: 'Chat and any generated text a human reads as it arrives.',
    how: 'StreamingResponse or SSE. Yield tokens as the model produces them.',
    risk: 'Total time is unchanged — you moved what the user experiences, not what the server does. Proxies buffer; check yours or the stream arrives in one lump.' },
  { n: 'Hand back a job id', ms: '> 30 s', use: 'Agent runs, batch ingestion, anything with retries or tool calls.',
    how: 'Enqueue, return 202 and an id, let the client poll or subscribe.',
    risk: 'BackgroundTasks runs in your web process — a deploy kills it and nothing retries. Past a few seconds of work, that is a real queue, not a background task.' }
];

/* the test re-derives every number this widget prints, so publish the
   model itself rather than a table of results */
if (typeof window !== 'undefined') window.FASTAPI = { HANDLERS, TIMEOUTS, SHAPES, capacity, POOL_DEFAULT };

/* ============================================================
   rendering

   The knobs are built once and never re-rendered. Only the results
   region is repainted, because replacing a range input while the
   pointer is still holding it cancels the drag.
   ============================================================ */
const root = typeof document !== 'undefined' && document.getElementById('fastapi-conc');
if (!root) return;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const rps = v => v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(0) : v.toFixed(1);
const ms = v => !isFinite(v) ? '∞' : v >= 1000 ? (v / 1000).toFixed(1) + ' s' : Math.round(v) + ' ms';

const state = { handler: 'async', workers: 4, cpuMs: 5, ioMs: 800, pool: POOL_DEFAULT, offered: 120 };

const SLIDERS = [
  { k: 'workers', label: 'uvicorn workers', min: 1, max: 16, step: 1, fmt: v => v },
  { k: 'cpuMs', label: 'CPU work per request', min: 1, max: 40, step: 1, fmt: v => v + ' ms' },
  { k: 'ioMs', label: 'waiting on the model', min: 0, max: 2000, step: 50, fmt: v => ms(v) },
  { k: 'pool', label: 'anyio threadpool', min: 5, max: 200, step: 5, fmt: v => v + ' threads' },
  { k: 'offered', label: 'offered load', min: 5, max: 1500, step: 5, fmt: v => v + '/s' }
];

/* ---------- the shell, built once ---------- */
root.innerHTML =
  '<div class="fa-tabs">' + HANDLERS.map(x =>
    '<button class="fa-tab" data-h="' + x.id + '" style="--c:' + x.c + '">' +
      x.ico + ' <b>' + esc(x.n) + '</b><i>' + esc(x.tag) + '</i></button>').join('') + '</div>' +
  '<p class="fa-one" id="fa-one"></p>' +
  '<div class="fa-knobs">' + SLIDERS.map(s =>
    '<div class="ctrl" data-for="' + s.k + '">' +
      '<label for="fa-' + s.k + '">' + s.label + ' <span class="val" id="fa-v-' + s.k + '"></span>' +
        (s.k === 'pool' ? ' <i class="fa-na">not used by this shape</i>' : '') + '</label>' +
      '<input type="range" id="fa-' + s.k + '" data-k="' + s.k + '" min="' + s.min + '" max="' + s.max +
        '" step="' + s.step + '" value="' + state[s.k] + '">' +
    '</div>').join('') + '</div>' +
  '<div id="fa-out"></div>';

const out = root.querySelector('#fa-out');
const one = root.querySelector('#fa-one');
const tabs = [].slice.call(root.querySelectorAll('.fa-tab'));

tabs.forEach(b => b.onclick = () => { state.handler = b.dataset.h; paint(); });
root.querySelectorAll('.fa-knobs input').forEach(i =>
  i.oninput = () => { state[i.dataset.k] = +i.value; paint(); });

/* ---------- everything that depends on the state ---------- */
function paint() {
  const h = HANDLERS.find(x => x.id === state.handler);
  const r = capacity(state);
  const poolMatters = state.handler === 'def' || state.handler === 'threadpool';

  tabs.forEach(b => b.classList.toggle('on', b.dataset.h === state.handler));
  one.textContent = h.one;
  SLIDERS.forEach(s => { root.querySelector('#fa-v-' + s.k).textContent = s.fmt(state[s.k]); });
  root.querySelector('.ctrl[data-for="pool"]').classList.toggle('fa-dim', !poolMatters);
  root.querySelector('.ctrl[data-for="pool"] .fa-na').hidden = poolMatters;

  /* every shape at the current settings, so the spread is visible at once */
  const all = HANDLERS.map(x => ({ h: x, r: capacity(Object.assign({}, state, { handler: x.id })) }));
  const best = Math.max.apply(null, all.map(a => a.r.total));

  out.innerHTML =
    '<div class="fa-stats">' +
      stat('Capacity', rps(r.total) + '/s',
           r.over ? 'bad' : r.util > 0.7 ? 'mid' : 'ok',
           rps(r.perWorker) + '/s per worker × ' + state.workers +
           ' — limited by ' + ceilingWord(r.ceiling)) +
      stat('In flight per worker', isFinite(r.inflight) ? r.inflight : 'hundreds',
           r.inflight === 1 ? 'bad' : isFinite(r.inflight) ? 'mid' : 'ok',
           r.inflight === 1 ? 'the loop is parked — this worker is a queue of one'
             : isFinite(r.inflight) ? 'one thread each, and the pool is the ceiling'
             : 'bounded by sockets and memory, not by the framework') +
      stat('Latency at ' + state.offered + '/s', r.over ? 'overloaded' : ms(r.latencyMs),
           r.over ? 'bad' : r.util > 0.7 ? 'mid' : 'ok',
           r.over ? 'demand exceeds capacity — the queue grows until something times out'
             : Math.round(r.util * 100) + '% utilised · ' + ms(r.serviceMs) + ' of work + ' +
               ms(r.waitMs) + ' queued (rough estimate)') +
    '</div>' +

    '<div class="fa-compare">' + all.map(a =>
      '<div class="fa-crow' + (a.h.id === state.handler ? ' on' : '') + '" style="--c:' + a.h.c + '">' +
        '<span class="fa-cn">' + a.h.ico + ' ' + esc(a.h.n) + '</span>' +
        '<span class="fa-cb"><span style="width:' + (a.r.total / best * 100) + '%"></span></span>' +
        '<span class="fa-cv">' + rps(a.r.total) + '/s</span>' +
        '<span class="fa-cx">' + (a.r.total >= best ? 'fastest here'
          : '×' + (best / a.r.total).toFixed(a.r.total * 20 < best ? 0 : 1) + ' slower') + '</span>' +
      '</div>').join('') + '</div>' +

    '<pre class="code fa-code">' + esc(h.code) + '</pre>' +
    '<p class="fa-why"><b>Why it behaves like that.</b> ' + esc(h.why) + '</p>' +
    '<div class="fa-verdict">' + verdict(r, all, best) + '</div>';
}

function ceilingWord(c) {
  return c === 'cpu' ? 'CPU work per request (the GIL serialises it)'
    : c === 'pool' ? 'the threadpool size'
    : 'the blocked event loop';
}

function stat(label, value, kind, sub) {
  return '<div class="fa-stat ' + kind + '"><b>' + label + '</b><strong>' + value + '</strong>' +
    '<span>' + sub + '</span></div>';
}

function verdict(r, all, best) {
  const worst = all.reduce((a, x) => x.r.total < a.r.total ? x : a);
  const spread = best / worst.r.total;
  const awaited = all.find(a => a.h.id === 'async').r.total;
  const blocked = all.find(a => a.h.id === 'asyncblock').r.total;
  const plainDef = all.find(a => a.h.id === 'def').r.total;

  if (state.ioMs === 0) return '<b>Nothing is waiting, so nothing here matters.</b> ' +
    'With no network call in the handler every shape collapses to the same CPU ceiling, and async buys you ' +
    'exactly nothing. Async is not a speed feature, it is a <i>waiting</i> feature — which is why it buys so ' +
    'much on an endpoint that is almost entirely waiting. Drag the model wait back up and watch the four ' +
    'rows separate.';

  const parts = [];
  parts.push('<b>Same machine, same model, ×' + spread.toFixed(0) + ' between the best and worst shape.</b> ');
  parts.push('Nothing here changed the hardware, the model or the worker count — only which of four ways ' +
    'you wrote one function. ');
  if (blocked < plainDef) parts.push('Note the ordering that surprises people: <b>the async handler with a ' +
    'blocking call inside is ' + (plainDef / blocked).toFixed(0) + '× worse than the plain ' +
    '<span class="mono">def</span></b> it replaced. Writing <span class="mono">async def</span> and then not ' +
    'awaiting is worse than never having written async at all, because <span class="mono">def</span> at ' +
    'least gets you the threadpool. ');
  if (r.ceiling === 'pool') parts.push('You are capped by the threadpool right now, which is the point at ' +
    'which people raise it to 200 and call it fixed. Try that slider, then try the top row instead: awaiting ' +
    'properly gets you to ' + rps(awaited) + '/s without a single extra thread. ');
  if (r.ceiling === 'cpu') parts.push('You are at the CPU ceiling now, which is the honest end of this road — ' +
    'from here it is less work per request or more processes, and no amount of concurrency engineering ' +
    'moves it. ');
  if (r.over) parts.push('<b>And at ' + state.offered + '/s you are past capacity.</b> The queue is not a ' +
    'buffer, it is a countdown: latency climbs until something upstream gives up, and the retries make it ' +
    'worse. Shed load or add capacity — waiting is not a strategy.');
  return parts.join('');
}

paint();
})();
