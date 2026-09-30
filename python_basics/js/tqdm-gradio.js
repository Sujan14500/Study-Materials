/* ============================================================
   tqdm-gradio.js — two more package deep dives.
   tqdm   (4.70): progress bars, and where the ETA comes from.
   Gradio (6.29): a web UI and an API around any Python function.

   Self-contained like packages.js: its own data, widgets and
   boot. formatMeter() re-implements tqdm.format_meter, and
   test.js checks it against lines the real library printed.
   ============================================================ */
(function () {
'use strict';

const hasDoc = typeof document !== 'undefined';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = n => hasDoc && window.awardXP && window.awardXP(n);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const twoUp = (code, out, why) =>
  '<div class="two-up">' +
    '<div><div class="lab-pane-title">code</div><pre class="code">' + esc(code) + '</pre></div>' +
    '<div><div class="lab-pane-title">what you get</div><pre class="code">' + esc(out) + '</pre></div></div>' +
  (why ? '<div class="stepper-say">' + why + '</div>' : '');

function opTabs(tabsSel, bodySel, ops) {
  const tabs = $(tabsSel), body = $(bodySel);
  if (!tabs || !body) return;
  ops.forEach((op, i) => {
    const b = el('button', 'chip mono' + (i ? '' : ' active'), op.label);
    b.onclick = () => {
      $$('.chip', tabs).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      body.innerHTML = twoUp(op.code, typeof op.out === 'function' ? op.out() : op.out, op.why);
      xp(1);
    };
    tabs.appendChild(b);
  });
  body.innerHTML = twoUp(ops[0].code, typeof ops[0].out === 'function' ? ops[0].out() : ops[0].out, ops[0].why);
}

function cards(sel, items) {
  const root = $(sel); if (!root) return;
  root.innerHTML = '';
  items.forEach(t => root.appendChild(el('div', 'pcard reveal',
    '<h3>' + t.t + (t.tag ? ' <span class="pcard-badge">' + t.tag + '</span>' : '') + '</h3>' +
    (t.code ? '<pre class="code">' + esc(t.code) + '</pre>' : '') +
    '<p class="pcard-desc">' + t.d + '</p>')));
}

/* ============================================================
   tqdm, re-implemented where it matters
   ============================================================ */

/* Python's f'{x:W.Pf}': fixed decimals, right-aligned to width W. Python
   rounds an exact half to even (f'{62.5:3.0f}' is ' 62'); toFixed does not. */
function pyf(x, w, p) {
  const k = Math.pow(10, p), y = x * k, f = Math.floor(y);
  const s = (y - f === 0.5 ? (f % 2 === 0 ? f : f + 1) / k : x).toFixed(p);
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

/* tqdm.format_interval: [H:]MM:SS, truncating seconds */
function formatInterval(t) {
  const sign = t < 0 ? '-' : '';
  const a = Math.trunc(Math.abs(t)), h = Math.floor(a / 3600), m = Math.floor(a / 60) % 60, s = a % 60;
  const p2 = v => String(v).padStart(2, '0');
  return h ? sign + h + ':' + p2(m) + ':' + p2(s) : sign + p2(m) + ':' + p2(s);
}

/* tqdm.format_sizeof: 3 significant figures and an SI prefix */
function formatSizeof(num, divisor) {
  divisor = divisor || 1000;
  for (const unit of ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z']) {
    if (Math.abs(num) < 999.5) {
      if (Math.abs(num) < 99.95) {
        if (Math.abs(num) < 9.995) return pyf(num, 1, 2) + unit;
        return pyf(num, 2, 1) + unit;
      }
      return pyf(num, 3, 0) + unit;
    }
    num /= divisor;
  }
  return pyf(num, 3, 1) + 'Y';
}

/* the default bar, eight sub-cell steps per character */
const UTF = ' ▏▎▍▌▋▊▉█';
function bar(frac, width) {
  const nsyms = UTF.length - 1;
  const cells = Math.floor(frac * width * nsyms);
  const full = Math.floor(cells / nsyms), part = cells % nsyms;
  let res = UTF[nsyms].repeat(full);
  if (full < width) res += UTF[part] + ' '.repeat(width - full - 1);
  return res;
}

/* tqdm.format_meter with the default bar_format. o: prefix, unit, unitScale,
   unitDivisor, postfix, ncols (undefined = 10-cell bar, 0 = no bar), rate */
function formatMeter(n, total, elapsed, o) {
  o = o || {};
  const unit = o.unit || 'it', div = o.unitDivisor || 1000, us = !!o.unitScale;
  if (total && n >= total + 0.5) total = null;
  const elapsedStr = formatInterval(elapsed);
  let rate = o.rate != null ? o.rate : (elapsed ? n / elapsed : null);
  const inv = rate ? 1 / rate : null;
  const rateNoinv = (rate ? (us ? formatSizeof(rate) : pyf(rate, 5, 2)) : '?') + unit + '/s';
  const rateInv = (inv ? (us ? formatSizeof(inv) : pyf(inv, 5, 2)) : '?') + 's/' + unit;
  const rateFmt = inv && inv > 1 ? rateInv : rateNoinv;
  const nFmt = us ? formatSizeof(n, div) : String(n);
  const totalFmt = total != null ? (us ? formatSizeof(total, div) : String(total)) : '?';
  const postfix = o.postfix ? ', ' + o.postfix : '';
  const remaining = rate && total ? (total - n) / rate : 0;
  const remainingStr = rate ? formatInterval(remaining) : '?';
  let lBar = o.prefix ? (o.prefix.slice(-2) === ': ' ? o.prefix : o.prefix + ': ') : '';
  const rBar = '| ' + nFmt + '/' + totalFmt + ' [' + elapsedStr + '<' + remainingStr + ', ' + rateFmt + postfix + ']';
  if (!total) return lBar + nFmt + unit + ' [' + elapsedStr + ', ' + rateFmt + postfix + ']';
  lBar += pyf(n / total * 100, 3, 0) + '%|';
  if (o.ncols === 0) return lBar.slice(0, -1) + rBar.slice(1);
  const width = o.ncols ? Math.max(1, o.ncols - (lBar.length + rBar.length)) : 10;
  return lBar + bar(n / total, width) + rBar;
}

/* tqdm's EMA: exponential moving average with bias correction */
function makeEma(alpha) {
  let last = 0, calls = 0;
  return x => {
    if (x != null) { last = alpha * x + (1 - alpha) * last; calls++; }
    return calls ? last / (1 - Math.pow(1 - alpha, calls)) : last;
  };
}

/* ---------- the ETA simulation ----------
   A job of `total` items whose speed changes part-way. The bar redraws
   every `tick` seconds; each redraw feeds (dn, dt) to two EMAs, exactly as
   tqdm.update does, and the rate shown is emaDn / emaDt (smoothing > 0) or
   n / elapsed (smoothing = 0).                                           */
const SCENARIOS = [
  { id: 'slow', n: 'Slows down at 60%', total: 1000, legs: [[600, 50], [400, 10]],
    say: 'Items 1-600 are cached and run at 50 it/s; the rest hit the network at 10 it/s.' },
  { id: 'fast', n: 'Speeds up at 20%', total: 1000, legs: [[200, 8], [800, 80]],
    say: 'The first 200 items warm a cache at 8 it/s; after that it runs at 80 it/s.' },
  { id: 'steady', n: 'Steady', total: 1000, legs: [[1000, 25]],
    say: 'One constant speed: every smoothing setting agrees, which is why the default rarely matters until it does.' }
];
function simulate(sc, smoothing, tick) {
  tick = tick || 0.5;
  /* the job itself: speed set by which leg we are in, times +/-35% noise from a
     fixed-seed generator, so every smoothing value sees the very same run */
  let seed = 7, n = 0, t = 0, change = null;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bounds = []; let acc = 0; sc.legs.forEach(([k, r]) => { acc += k; bounds.push([acc, r]); });
  const trace = [];
  while (n < sc.total) {
    const leg = bounds.findIndex(b => n < b[0]);
    if (leg > 0 && change == null) change = t;
    const r = bounds[leg][1] * (1 + 0.7 * (rnd() - 0.5));
    n = Math.min(sc.total, n + r * tick); t += tick;
    trace.push([t, Math.floor(n)]);
  }
  const end = t;
  const eDn = makeEma(smoothing), eDt = makeEma(smoothing);
  const pts = [];
  let prevN = 0;
  trace.slice(0, -1).forEach(([tt, nn]) => {
    const dn = nn - prevN; prevN = nn;
    let rate;
    if (smoothing) { if (dn) { eDn(dn); eDt(tick); } rate = eDn() / eDt(); }
    else rate = nn / tt;
    pts.push({ t: tt, n: nn, eta: rate ? (sc.total - nn) / rate : null, truth: end - tt });
  });
  return { pts, total: end, change: sc.legs.length > 1 ? change : null };
}
/* seconds after the speed change until the ETA is, and stays, within 25% (or 2 s) */
function catchUp(run) {
  if (run.change == null) return 0;
  const ok = p => p.eta != null && Math.abs(p.eta - p.truth) <= Math.max(0.25 * p.truth, 2);
  const after = run.pts.filter(p => p.t > run.change);
  for (let i = 0; i < after.length; i++) if (after.slice(i).every(ok)) return after[i].t - run.change;
  return Infinity;
}

/* how far the ETA jumps between redraws, on average: the price of smoothing */
function jitter(run) {
  let a = 0;
  for (let i = 1; i < run.pts.length; i++) a += Math.abs(run.pts[i].eta - run.pts[i - 1].eta);
  return a / Math.max(1, run.pts.length - 1);
}

/* ============================================================
   Gradio: the builder's templates and the queue model
   ============================================================ */
const TEMPLATES = [
  { id: 'sum', n: 'Summarise text', fn: 'summarise', params: ['text', 'max_words'],
    body: ['words = text.split()', 'return " ".join(words[:max_words])'],
    inputs: [['Textbox', 'lines=6, label="Text"'], ['Slider', '5, 100, value=30, step=5, label="Max words"']],
    outputs: [['Textbox', 'label="Summary"']], example: '["Gradio turns a Python function into a web app.", 5]',
    stream: true, client: '"Some long text ...", 30' },
  { id: 'img', n: 'Classify an image', fn: 'classify', params: ['image'],
    body: ['probs = model(image)                  # your model', 'return {"cat": probs[0], "dog": probs[1]}'],
    inputs: [['Image', 'type="pil", label="Photo"']],
    outputs: [['Label', 'num_top_classes=2, label="Prediction"']], example: '["cat.jpg"]',
    stream: false, client: 'handle_file("cat.jpg")' },
  { id: 'asr', n: 'Transcribe audio', fn: 'transcribe', params: ['audio_path', 'language'],
    body: ['result = asr(audio_path, language=language)   # e.g. Whisper', 'return result["text"]'],
    inputs: [['Audio', 'type="filepath", label="Recording"'], ['Dropdown', '["en", "de", "hi"], value="en", label="Language"']],
    outputs: [['Textbox', 'label="Transcript"']], example: '["meeting.wav", "en"]',
    stream: false, client: 'handle_file("meeting.wav"), "en"' },
  { id: 'chat', n: 'Chat with a model', fn: 'reply', params: ['message', 'history'], chat: true,
    body: ['msgs = [{"role": m["role"], "content": m["content"]} for m in history]',
           'msgs.append({"role": "user", "content": message})',
           'return llm(msgs)                      # your model call'],
    inputs: [], outputs: [], example: '["What does Gradio do?"]', stream: true, client: '"What does Gradio do?"' }
];

function buildCode(tpl, o) {
  const L = [];
  const stream = o.stream && tpl.stream;
  L.push('import gradio as gr');
  if (o.progress) L.push('from tqdm import tqdm');
  L.push('');
  const sig = tpl.params.slice();
  if (o.progress) sig.push('progress=gr.Progress(track_tqdm=True)');
  L.push('def ' + tpl.fn + '(' + sig.join(', ') + '):');
  if (o.progress) L.push('    for _ in tqdm(range(100), desc="working"):   # any tqdm loop shows in the browser', '        ...');
  if (stream && tpl.chat) {
    L.push('    ' + tpl.body[0], '    ' + tpl.body[1], '    partial = ""',
           '    for token in llm_stream(msgs):         # yield = stream to the browser',
           '        partial += token', '        yield partial');
  } else if (stream) {
    L.push('    words = text.split()[:max_words]', '    for i in range(1, len(words) + 1):',
           '        yield " ".join(words[:i])          # yield = stream to the browser');
  } else tpl.body.forEach(b => L.push('    ' + b));
  L.push('');
  const api = '"' + tpl.fn + '"';
  const conc = o.limit === 'default' ? '' : ',\n    concurrency_limit=' + o.limit;
  if (tpl.chat) {
    L.push('demo = gr.ChatInterface(', '    ' + tpl.fn + ',', '    title="' + o.title + '",' +
      (o.examples ? '\n    examples=["What does Gradio do?", "Summarise our refund policy"],' : ''),
      '    api_name=' + api + conc + ',', ')');
  } else {
    const comp = c => 'gr.' + c[0] + '(' + c[1] + ')';
    const ins = tpl.inputs.length === 1 ? comp(tpl.inputs[0]) : '[' + tpl.inputs.map(comp).join(', ') + ']';
    const outs = tpl.outputs.length === 1 ? comp(tpl.outputs[0]) : '[' + tpl.outputs.map(comp).join(', ') + ']';
    L.push('demo = gr.Interface(', '    fn=' + tpl.fn + ',', '    inputs=' + ins + ',', '    outputs=' + outs + ',',
      '    title="' + o.title + '",' + (o.examples ? '\n    examples=[' + tpl.example + '],' : ''),
      '    flagging_mode="never",', '    api_name=' + api + conc + ',', ')');
  }
  L.push('');
  const launch = [];
  if (o.share) launch.push('share=True');
  if (o.auth) launch.push('auth=("demo", "change-me")');
  launch.push('theme=gr.themes.Soft()');
  L.push('demo.launch(' + launch.join(', ') + ')');
  return L.join('\n');
}

function clientCode(tpl) {
  return 'from gradio_client import Client' + (/handle_file/.test(tpl.client) ? ', handle_file' : '') + '\n\n' +
    'client = Client("http://127.0.0.1:7860/")      # or "you/your-space" on Hugging Face\n' +
    'client.predict(' + tpl.client + ', api_name="/' + tpl.fn + '")';
}

/* ---------- the queue ----------
   n users click at once, each call takes secs. A concurrency group runs at
   most `limit` of them together (null = no limit, but a sync function still
   needs a worker thread: launch(max_threads=40)). FIFO, so job i starts in
   wave floor(i / limit).                                                    */
function queueRun(n, secs, limit, maxThreads) {
  const slots = limit == null ? Math.min(n, maxThreads || 40) : Math.min(limit, maxThreads || 40);
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const wave = Math.floor(i / slots);
    jobs.push({ i, slot: i % slots, start: wave * secs, end: (wave + 1) * secs });
  }
  const last = jobs.length ? jobs[jobs.length - 1].end : 0;
  const avgWait = jobs.reduce((s, j) => s + j.start, 0) / Math.max(1, n);
  return { jobs, slots, last, avgWait, throughput: n / last };
}
/* two endpoints wrapping the SAME function share one concurrency group
   (concurrency_id defaults to id(fn)), and the group takes the lower limit */
function sharedLimit(a, b, sameFn) {
  if (!sameFn) return [a, b];
  const lo = a == null ? b : b == null ? a : Math.min(a, b);
  return [lo, lo];
}

const API = { formatMeter, formatInterval, formatSizeof, bar, makeEma, simulate, catchUp, jitter, SCENARIOS,
  TEMPLATES, buildCode, clientCode, queueRun, sharedLimit };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (!hasDoc) return;

/* ============================================================
   tqdm page
   ============================================================ */
const TQ_PARTS = [
  ['desc', '#a78bfa', 'desc=', 'A label, so four bars in one log can be told apart. Change it mid-run with set_description().'],
  ['pct', '#38bdf8', 'n / total', 'Needs total. A generator has no len(), so pass total= or you lose %, bar and ETA.'],
  ['bar', '#38bdf8', 'ncols / ascii', 'Eight sub-steps per character. ascii=True for terminals that mangle Unicode; ncols fixes the width.'],
  ['count', '#e6edf7', 'unit, unit_scale', 'Done / total. unit="B", unit_scale=True, unit_divisor=1024 turns 3500000 into 3.34M.'],
  ['elapsed', '#34d399', '(time)', 'Wall time since the bar was created, not since the first item.'],
  ['eta', '#f0b429', 'smoothing', 'Remaining = (total − n) / rate. The rate is a moving average, so the ETA lags any change of speed.'],
  ['rate', '#f472b6', 'unit', 'Items per second, flipped to seconds per item when that reads better (13.67s/page, not 0.07page/s).'],
  ['postfix', '#fb923c', 'set_postfix()', 'Live numbers you choose, such as loss=0.231. Updated on the same redraw, so it costs nothing extra.']
];
function paintMeter(s) {
  const m = /^(.*?: )?(\s*\d+%)\|(.*)\| (\S+\/\S+) \[([^<]+)<([^,]+), ([^,\]]+)(, [^\]]*)?\]$/.exec(s);
  if (!m) return esc(s);
  const c = k => TQ_PARTS.filter(p => p[0] === k)[0][1];
  const sp = (k, t) => '<span data-part="' + k + '" style="color:' + c(k) + '">' + esc(t) + '</span>';
  return (m[1] ? sp('desc', m[1]) : '') + sp('pct', m[2]) + '|' + sp('bar', m[3]) + '| ' + sp('count', m[4]) +
    ' [' + sp('elapsed', m[5]) + '<' + sp('eta', m[6]) + ', ' + sp('rate', m[7]) + (m[8] ? sp('postfix', m[8]) : '') + ']';
}

function initTqAnatomy() {
  const root = $('#tq-anatomy'); if (!root) return;
  const st = { n: 420, total: 1000, elapsed: 12.17, desc: 'train', unit: 'it', postfix: true };
  root.innerHTML =
    '<div class="btn-row" style="gap:14px;flex-wrap:wrap;align-items:center">' +
      '<span class="dim mono" style="font-size:12px">done</span><input type="range" id="tq-n" min="0" max="1000" value="420" style="width:150px">' +
      '<span class="dim mono" style="font-size:12px">seconds so far</span><input type="range" id="tq-e" min="0" max="120" step="0.5" value="12" style="width:130px">' +
      '<select id="tq-u" class="mono" style="width:auto"><option value="it">items</option><option value="B">bytes (unit_scale)</option><option value="page">pages</option></select>' +
      '<label class="mono dim" style="font-size:12px"><input type="checkbox" id="tq-p" checked> postfix</label></div>' +
    '<pre class="code tq-line" id="tq-line"></pre>' +
    '<div class="tq-parts" id="tq-parts"></div>' +
    '<div class="two-up"><div><div class="lab-pane-title">the code that prints it</div><pre class="code" id="tq-code"></pre></div>' +
    '<div><div class="lab-pane-title">the arithmetic</div><pre class="code" id="tq-math"></pre></div></div>';
  $('#tq-parts', root).innerHTML = TQ_PARTS.map(p =>
    '<div class="tq-part" data-part="' + p[0] + '"><b style="color:' + p[1] + '">' + p[0] + '</b> <span class="mono dim">' + esc(p[2]) + '</span><div>' + p[3] + '</div></div>').join('');
  function draw() {
    const byte = st.unit === 'B', total = byte ? 10485760 : st.unit === 'page' ? 12 : st.total;
    const n = Math.round(st.n / 1000 * total);
    const o = { prefix: byte ? 'model.safetensors' : st.unit === 'page' ? 'pages' : st.desc, unit: st.unit, ncols: 88,
      unitScale: byte, unitDivisor: byte ? 1024 : 1000, postfix: st.postfix && !byte ? 'loss=0.231' : '' };
    const line = formatMeter(n, total, st.elapsed, o);
    $('#tq-line', root).innerHTML = paintMeter(line);
    $('#tq-code', root).textContent = byte
      ? 'with tqdm(total=size, unit="B", unit_scale=True,\n          unit_divisor=1024, desc="model.safetensors") as bar:\n    for chunk in resp.iter_bytes(1 << 16):\n        f.write(chunk)\n        bar.update(len(chunk))       # bytes, not iterations'
      : 'bar = tqdm(batches, desc="' + o.prefix + '"' + (st.unit === 'page' ? ', unit="page"' : '') + ')\nfor batch in bar:\n    loss = train_step(batch)' +
        (o.postfix ? '\n    bar.set_postfix(loss=f"{loss:.3f}")' : '');
    const rate = st.elapsed ? n / st.elapsed : 0;
    $('#tq-math', root).textContent =
      'n = ' + n + ', total = ' + total + ', elapsed = ' + st.elapsed + ' s\n' +
      'rate      = n / elapsed      = ' + (rate ? rate.toFixed(3) : '?') + ' ' + st.unit + '/s\n' +
      'remaining = (total - n) / rate = ' + (rate ? ((total - n) / rate).toFixed(1) + ' s' : '? (no rate yet)') + '\n\n' +
      '# a finished bar prints this rate as the overall average;\n# while running, tqdm shows a smoothed recent rate instead';
    xp(1);
  }
  $('#tq-n', root).oninput = e => { st.n = +e.target.value; draw(); };
  $('#tq-e', root).oninput = e => { st.elapsed = +e.target.value; draw(); };
  $('#tq-u', root).onchange = e => { st.unit = e.target.value; draw(); };
  $('#tq-p', root).onchange = e => { st.postfix = e.target.checked; draw(); };
  $('#tq-line', root).addEventListener('mouseover', e => {
    const k = e.target.dataset && e.target.dataset.part;
    $$('.tq-part', root).forEach(p => p.classList.toggle('lit', p.dataset.part === k));
  });
  draw();
}

function initTqEta() {
  const root = $('#tq-eta'); if (!root) return;
  const st = { sc: 'slow', s: 0.3 };
  root.innerHTML =
    '<div class="chip-row" id="tq-sc">' + SCENARIOS.map((s, i) => '<button class="chip' + (i ? '' : ' active') + '" data-sc="' + s.id + '">' + s.n + '</button>').join('') + '</div>' +
    '<div class="btn-row" style="gap:14px;align-items:center"><span class="dim mono" style="font-size:12px">smoothing</span>' +
    '<input type="range" id="tq-s" min="0" max="1" step="0.05" value="0.3" style="width:200px"><span class="mono" id="tq-sv">0.30</span>' +
    '<span class="dim" style="font-size:12px">0 = overall average &middot; 0.3 = tqdm default &middot; 1 = last redraw only &middot; speed noise &plusmn;35%, redraw every 0.5 s</span></div>' +
    '<div id="tq-chart"></div><div class="stat-row" id="tq-stats"></div><div class="stepper-say" id="tq-say"></div>';
  function draw() {
    const sc = SCENARIOS.filter(s => s.id === st.sc)[0];
    const run = simulate(sc, st.s), avg = simulate(sc, 0);
    const W = 560, H = 230, x0 = 46, y0 = 14, x1 = W - 100, y1 = H - 34;
    const yMax = Math.max(...run.pts.map(p => Math.min(p.eta || 0, 200)), ...run.pts.map(p => p.truth)) * 1.05;
    const X = t => x0 + (x1 - x0) * t / run.total, Y = v => y1 - (y1 - y0) * Math.min(v, yMax) / yMax;
    const line = (pts, key, col, w, dash) => '<polyline points="' + pts.filter(p => p[key] != null).map(p => X(p.t).toFixed(1) + ',' + Y(p[key]).toFixed(1)).join(' ') +
      '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const v = yMax * k / 4;
      g += '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#22304a"/>' +
        '<text x="' + (x0 - 6) + '" y="' + (Y(v) + 4) + '" fill="#7e8fa6" font-size="10" text-anchor="end" font-family="monospace">' + Math.round(v) + 's</text>';
    }
    g += '<text x="' + ((x0 + x1) / 2) + '" y="' + (H - 6) + '" fill="#7e8fa6" font-size="10" text-anchor="middle" font-family="monospace">seconds into the job (the job takes ' + run.total.toFixed(0) + ' s)</text>';
    g += line(run.pts, 'truth', '#7e8fa6', 1.5, true) + line(avg.pts, 'eta', '#a78bfa', 1.5) + line(run.pts, 'eta', '#38bdf8', 2.5);
    const lab = (pts, key, col, t) => { const p = pts[pts.length - 1]; return '<text x="' + (x1 + 6) + '" y="' + (Y(p[key]) + 4) + '" fill="' + col + '" font-size="11">' + t + '</text>'; };
    g += '<text x="' + (x1 + 6) + '" y="' + (y0 + 10) + '" fill="#7e8fa6" font-size="10">true remaining</text>';
    g += lab(run.pts, 'eta', '#38bdf8', 'ETA, s=' + st.s.toFixed(2)) ;
    g += '<text x="' + (x1 + 6) + '" y="' + (y0 + 26) + '" fill="#a78bfa" font-size="10">ETA, s=0</text>';
    $('#tq-chart', root).innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:680px;display:block" role="img" aria-label="Estimated vs true remaining time">' + g + '</svg>';
    /* how wrong, and for how long */
    const cu = r => r.change == null ? 'no change' : isFinite(catchUp(r)) ? catchUp(r).toFixed(1) + ' s' : 'never';
    $('#tq-stats', root).innerHTML = [
      [cu(run), 'after the change, until the ETA settles (s=' + st.s.toFixed(2) + ')'],
      [cu(avg), 'the same for the overall average (s=0)'],
      [jitter(run).toFixed(1) + ' s', 'average jump in the ETA between redraws']
    ].map(s => '<div class="stat"><div class="stat-v">' + s[0] + '</div><div class="stat-k">' + s[1] + '</div></div>').join('');
    $('#tq-say', root).innerHTML = sc.say + ' The dashed line is the truth. ' +
      (st.sc === 'steady' ? 'With one speed every estimate is right.' :
      'The overall average (violet) remembers the old speed forever, so after the change it is wrong for most of the rest of the job. ' +
      'The default <span class="mono">smoothing=0.3</span> weights recent redraws, so it notices the change within a few seconds. ' +
      'Push it to 1 and the ETA chases every hiccup of the noisy job: it reacts at once but jumps around so much it never settles either. That trade is the whole parameter, and 0.3 sits near the sweet spot.');
    xp(1);
  }
  $('#tq-sc', root).onclick = e => {
    const b = e.target.closest('[data-sc]'); if (!b) return;
    st.sc = b.dataset.sc; $$('#tq-sc .chip', root).forEach(c => c.classList.toggle('active', c === b)); draw();
  };
  $('#tq-s', root).oninput = e => { st.s = +e.target.value; $('#tq-sv', root).textContent = st.s.toFixed(2); draw(); };
  draw();
}

const TQ_OPS = [
  { label: 'wrap an iterable', code: 'from tqdm import tqdm\n\nfor doc in tqdm(docs, desc="embed"):\n    vectors.append(embed(doc))',
    out: () => formatMeter(2400, 2400, 61.3, { prefix: 'embed', ncols: 76 }),
    why: 'Wrapping is the whole API for 90% of uses. tqdm reads len(docs) for the total; the loop body does not change.' },
  { label: 'generators need total=', code: 'rows = (parse(l) for l in open("big.csv"))\n\nfor row in tqdm(rows):              # no len() -> no %, no bar, no ETA\n    ...\nfor row in tqdm(rows, total=1_204_331):\n    ...',
    out: () => formatMeter(412904, null, 9.2, {}) + '\n' + formatMeter(412904, 1204331, 9.2, { ncols: 76 }),
    why: 'A generator cannot tell tqdm its length. Pass total= when you know it (a line count, a row count from the database) and you get the bar and the ETA back.' },
  { label: 'bytes: update(n)', code: 'with tqdm(total=size, unit="B", unit_scale=True,\n          unit_divisor=1024, desc="download") as bar:\n    for chunk in resp.iter_bytes(65536):\n        f.write(chunk)\n        bar.update(len(chunk))',
    out: () => formatMeter(734003200, 1073741824, 38.5, { prefix: 'download', unit: 'B', unitScale: true, unitDivisor: 1024, ncols: 76 }),
    why: 'When progress is not "one item per loop", create the bar with a total and call update(n) yourself. unit_divisor=1024 makes the counts binary; the rate stays decimal, as tqdm itself prints it.' },
  { label: 'live numbers: set_postfix', code: 'bar = tqdm(loader, desc="epoch 3")\nfor x, y in bar:\n    loss = step(x, y)\n    bar.set_postfix(loss=f"{loss:.3f}", lr=f"{sched.get_last_lr()[0]:.1e}")',
    out: () => formatMeter(310, 782, 52.0, { prefix: 'epoch 3', postfix: 'loss=0.418, lr=2.0e-04', ncols: 90 }),
    why: 'set_postfix puts your own numbers in the brackets and is redrawn with the bar, so logging a loss costs nothing extra.' },
  { label: 'nested bars', code: 'for epoch in trange(3, desc="epochs"):\n    for batch in tqdm(loader, desc="batches", leave=False):\n        step(batch)',
    out: () => formatMeter(1, 3, 104.0, { prefix: 'epochs', ncols: 70 }) + '\n' + formatMeter(518, 782, 34.1, { prefix: 'batches', ncols: 70 }),
    why: 'The inner bar gets leave=False so it disappears when each epoch ends instead of leaving 3 finished bars behind. trange(n) is tqdm(range(n)).' },
  { label: 'pandas', code: 'from tqdm.auto import tqdm\ntqdm.pandas(desc="clean")\n\ndf["clean"] = df["text"].progress_apply(clean_text)',
    out: () => formatMeter(50000, 50000, 7.9, { prefix: 'clean', ncols: 70 }),
    why: 'tqdm.pandas() adds progress_apply and progress_map to Series, DataFrames and groupby objects. Same result as .apply, with a bar.' },
  { label: 'threads & processes', code: 'from tqdm.contrib.concurrent import thread_map, process_map\n\npages = thread_map(fetch, urls, max_workers=16, desc="fetch")\nvecs  = process_map(embed, texts, max_workers=8, chunksize=64)',
    out: () => formatMeter(640, 640, 12.4, { prefix: 'fetch', ncols: 70 }),
    why: 'One bar for a whole pool, counting completions. process_map needs chunksize for many small tasks or the inter-process overhead dominates.' },
  { label: 'notebooks & logs', code: 'from tqdm.auto import tqdm            # widget in Jupyter, text in a terminal\n\ntqdm.write("checkpoint saved")        # print without breaking the bar\n\nfor x in tqdm(items, disable=None):    # off when stdout is not a TTY (CI logs)\n    ...\n# or, without touching code:  TQDM_DISABLE=1 python train.py',
    out: '(no bar in CI; a clean widget in Jupyter; your messages print above the bar)',
    why: 'Bars write carriage returns, which turn CI logs into thousands of lines. disable=None or the TQDM_DISABLE / TQDM_MININTERVAL environment variables fix that without editing the loop.' }
];
function initTqOps() { opTabs('#tq-tabs', '#tq-body', TQ_OPS); }

const TQ_TRAPS = [
  { t: 'print() inside the loop', tag: 'output', code: 'for x in tqdm(xs):\n    print(x)          # redraws a new bar every line',
    d: 'The bar lives on one terminal line and print() pushes it down. Use <span class="mono">tqdm.write()</span>, or <span class="mono">logging_redirect_tqdm()</span> from tqdm.contrib.logging for loggers.' },
  { t: 'tqdm(list(gen))', tag: 'memory', code: 'for row in tqdm(list(read_rows())):   # loads everything first',
    d: 'Materialising a generator just to get a length defeats streaming. Pass total= instead.' },
  { t: 'Bars in CI logs', tag: 'logs', code: 'TQDM_DISABLE=1 pytest\nTQDM_MININTERVAL=30 python job.py',
    d: 'Every redraw becomes a log line when output is not a terminal. Disable it, or slow it to one line every 30 s.' },
  { t: 'Calling refresh() yourself', tag: 'speed', code: 'bar.update(1); bar.refresh()   # forces a redraw every step',
    d: 'tqdm is cheap because it redraws at most every mininterval (0.1 s). Forcing a refresh per item makes the bar the slowest thing in the loop.' },
  { t: 'A bar per worker process', tag: 'concurrency', code: 'Pool(8).map(work_with_its_own_bar, jobs)',
    d: 'Eight processes writing to one terminal garble each other. Use one bar in the parent (process_map), or give each a position=.' },
  { t: 'Trusting the ETA after a change', tag: 'estimates', code: 'tqdm(items, smoothing=0)   # overall average',
    d: 'The ETA assumes the future looks like the recent past. When a job changes phase (cache warm, network cold) it is wrong until the moving average catches up.' }
];
function initTqTraps() { cards('#tq-traps', TQ_TRAPS); }

/* ============================================================
   Gradio page
   ============================================================ */
const GR_OPS = [
  { label: 'gr.Interface', code: 'import gradio as gr\n\ndef summarise(text: str, max_words: int) -> str:\n    words = text.split()\n    return " ".join(words[:max_words])\n\ndemo = gr.Interface(\n    fn=summarise,\n    inputs=[gr.Textbox(lines=6, label="Text"),\n            gr.Slider(5, 100, value=30, step=5, label="Max words")],\n    outputs=gr.Textbox(label="Summary"),\n    flagging_mode="never",\n    api_name="summarise",\n)\ndemo.launch()',
    out: '* Running on local URL:  http://127.0.0.1:7860\n\nIn the browser: a text box, a slider, a Submit button,\nand an output box — built from the three components.\n\nAnd an API, for free:\n  POST /gradio_api/call/summarise   {"data": ["...", 30]}',
    why: 'One component per function argument, in order, and one per return value. That mapping is the entire model: Gradio builds the page and the HTTP endpoint around your function.' },
  { label: 'gr.Blocks', code: 'with gr.Blocks() as demo:\n    gr.Markdown("# Word counter")\n    with gr.Row():\n        text = gr.Textbox(lines=6, label="Text")\n        with gr.Column():\n            count = gr.Number(label="Words")\n            longest = gr.Textbox(label="Longest word")\n    btn = gr.Button("Count", variant="primary")\n\n    def stats(t):\n        words = t.split()\n        return len(words), max(words, key=len, default="")\n\n    btn.click(stats, inputs=text, outputs=[count, longest], api_name="stats")\n    text.submit(stats, inputs=text, outputs=[count, longest], api_visibility="private")\n\ndemo.launch(theme=gr.themes.Soft())',
    out: 'A two-column layout. Clicking Count and pressing Enter\nboth run stats(); only the click is a public API endpoint:\n\n  named endpoints: [\'/stats\']',
    why: 'Blocks is for when the layout or the wiring is yours: rows, columns, tabs, several buttons, events that chain. Each event listener (click, submit, change) is one endpoint; api_visibility="private" keeps one out of the API.' },
  { label: 'gr.ChatInterface', code: 'def reply(message, history):\n    # history: [{"role": "user", "content": ...},\n    #           {"role": "assistant", "content": ...}, ...]\n    msgs = [{"role": m["role"], "content": m["content"]} for m in history]\n    msgs.append({"role": "user", "content": message})\n    partial = ""\n    for token in llm_stream(msgs):\n        partial += token\n        yield partial          # streams into the chat bubble\n\ngr.ChatInterface(reply, title="Support bot").launch()',
    out: 'A full chat UI: message box, bubbles, retry and undo,\nstreaming text. Your function sees the message and the\nhistory as a list of {"role", "content"} dicts.',
    why: 'The fastest way to put a chat model in front of people. Copy role and content out of history before sending it to a provider API: Gradio can add extra keys (metadata, options) that a strict API rejects.' },
  { label: 'progress + tqdm', code: 'from tqdm import tqdm\n\ndef index(files, progress=gr.Progress(track_tqdm=True)):\n    for f in tqdm(files, desc="embedding"):\n        embed(f)\n    return f"{len(files)} files indexed"',
    out: 'The tqdm bar in your code becomes a progress bar\nin the browser, with the same desc and the same ETA.',
    why: 'This is where the two packages on these pages meet. Declare a gr.Progress default argument with track_tqdm=True and every tqdm loop inside the call — yours or a library\'s — is mirrored to the user.' },
  { label: 'state per user', code: 'with gr.Blocks() as demo:\n    seen = gr.State([])                  # one copy per browser session\n    item, msg = gr.Textbox(), gr.Textbox()\n\n    def remember(x, seen):\n        seen = seen + [x]\n        return seen, f"{len(seen)} items this session"\n\n    gr.Button("Add").click(remember, [item, seen], [seen, msg])',
    out: 'Each visitor gets their own list. A module-level\nlist would be shared by every user of the server.',
    why: 'gr.State is an invisible component: it goes in as an input and comes back as an output. Global variables are shared across all sessions, which is a privacy bug the first time two people use your demo.' },
  { label: 'call it from code', code: 'from gradio_client import Client\n\nclient = Client("http://127.0.0.1:7860/")   # or "user/space" on Hugging Face\nclient.predict("Some long text ...", 30, api_name="/summarise")\n\njob = client.submit("Some long text ...", 30, api_name="/summarise")\njob.result()          # non-blocking version\n\n# plain HTTP:\n# curl -X POST http://127.0.0.1:7860/gradio_api/call/summarise \\\n#      -H "Content-Type: application/json" -d \'{"data": ["text", 30]}\'\n# curl -N http://127.0.0.1:7860/gradio_api/call/summarise/$EVENT_ID',
    out: '\'Some long text ...\'\n\nThe same queue, validation and limits as the browser.\nAn out-of-range slider value comes back as an error:\n  AppError: Value 3 is less than minimum value 5.',
    why: 'Every Gradio app is also an API. gradio_client is the Python way in; the REST call is a POST that returns an event id and a GET that streams the result.' },
  { label: 'inside FastAPI', code: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health():\n    return {"ok": True}\n\napp = gr.mount_gradio_app(app, demo, path="/ui")\n# uvicorn main:app --port 8000',
    out: 'GET /health  -> {"ok": true}\nGET /ui      -> the Gradio app',
    why: 'When the demo has to live next to a real API, mount it into your FastAPI app instead of running two servers.' },
  { label: 'concurrency', code: 'btn.click(generate, inp, out, concurrency_limit=4)     # 4 of this event at once\ndemo.queue(default_concurrency_limit=2, max_size=50)   # default + waiting-room cap',
    out: 'Default: ONE call of each event at a time.\nThe fifth user waits for the first four.',
    why: 'The default concurrency limit is 1, set so a GPU model is not run twice at once. For I/O-bound functions (calling an API) raise it; for a GPU model, raise it only as far as memory allows.' }
];
function initGrOps() { opTabs('#gr-tabs', '#gr-body', GR_OPS); }

function initGrBuilder() {
  const root = $('#gr-builder'); if (!root) return;
  const st = { tpl: 'sum', title: 'My demo', examples: true, stream: false, progress: false, limit: 'default', share: false, auth: false };
  root.innerHTML =
    '<div class="chip-row" id="grb-tpl">' + TEMPLATES.map((t, i) => '<button class="chip' + (i ? '' : ' active') + '" data-t="' + t.id + '">' + t.n + '</button>').join('') + '</div>' +
    '<div class="btn-row" style="gap:14px;flex-wrap:wrap;font-size:12.5px" id="grb-opts">' +
      ['examples', 'stream', 'progress', 'share', 'auth'].map(k => '<label class="mono"><input type="checkbox" data-o="' + k + '"' + (st[k] ? ' checked' : '') + '> ' +
        { examples: 'examples', stream: 'stream (yield)', progress: 'progress bar (tqdm)', share: 'share=True', auth: 'password' }[k] + '</label>').join('') +
      '<label class="mono">concurrency_limit <select data-o="limit" style="width:auto"><option value="default">default (1)</option><option value="4">4</option><option value="None">None</option></select></label></div>' +
    '<div class="two-up"><div><div class="lab-pane-title">app.py</div><pre class="code" id="grb-code"></pre></div>' +
    '<div><div class="lab-pane-title">what the browser shows</div><div class="gr-mock" id="grb-mock"></div>' +
    '<div class="lab-pane-title" style="margin-top:12px">and from Python</div><pre class="code" id="grb-client"></pre></div></div>' +
    '<div class="stepper-say" id="grb-say"></div>';
  const MOCK = {
    Textbox: l => '<div class="gm-field"><span>' + l + '</span><div class="gm-box"></div></div>',
    Slider: l => '<div class="gm-field"><span>' + l + '</span><div class="gm-slider"><i></i></div></div>',
    Image: l => '<div class="gm-field"><span>' + l + '</span><div class="gm-drop">drop an image, or click to upload</div></div>',
    Audio: l => '<div class="gm-field"><span>' + l + '</span><div class="gm-drop">record or upload audio</div></div>',
    Dropdown: l => '<div class="gm-field"><span>' + l + '</span><div class="gm-box gm-dd">en &#9662;</div></div>',
    Label: l => '<div class="gm-field"><span>' + l + '</span><div class="gm-bars"><i style="width:82%"></i><i style="width:18%"></i></div></div>'
  };
  const label = c => (/label="([^"]+)"/.exec(c[1]) || [0, c[0]])[1];
  function draw() {
    const tpl = TEMPLATES.filter(t => t.id === st.tpl)[0];
    $('#grb-code', root).textContent = buildCode(tpl, st);
    $('#grb-client', root).textContent = clientCode(tpl);
    $('#grb-mock', root).innerHTML = '<div class="gm-title">' + esc(st.title) + '</div>' + (tpl.chat
      ? '<div class="gm-chat"><div class="gm-bubble u">What does Gradio do?</div><div class="gm-bubble a">It wraps a Python function in a web UI' + (st.stream && tpl.stream ? '&hellip;' : '.') + '</div></div><div class="gm-box gm-input">Type a message&hellip;</div>'
      : '<div class="gm-cols"><div>' + tpl.inputs.map(c => MOCK[c[0]](label(c))).join('') + '<div class="gm-btns"><b>Submit</b><span>Clear</span></div></div>' +
        '<div>' + tpl.outputs.map(c => MOCK[c[0]](label(c))).join('') + (st.progress ? '<div class="gm-prog"><i style="width:42%"></i><span>working 42% &middot; 00:03&lt;00:04</span></div>' : '') + '</div></div>' +
        (st.examples ? '<div class="gm-ex">Examples: ' + esc(tpl.example) + '</div>' : '')) +
      '<div class="gm-foot">' + (st.share ? 'public link: https://xxxx.gradio.live' : 'http://127.0.0.1:7860') + ' &middot; Use via API</div>';
    const notes = [];
    if (st.share) notes.push('<b>share=True</b> gives anyone with the link access to your machine\'s function for up to a week. Add a password, and never share an app that reads local files or holds keys.');
    if (st.auth) notes.push('<b>auth</b> puts a login page in front of the UI and the API alike. It is a demo lock, not user management.');
    if (st.limit === 'default') notes.push('With the <b>default concurrency limit of 1</b>, a second visitor waits until the first call finishes. Fine for a GPU model; slow for a function that only waits on an API.');
    if (st.limit === 'None') notes.push('<b>concurrency_limit=None</b> runs every call at once. Sync functions still share a pool of 40 worker threads (launch(max_threads=40)), and a GPU model will run out of memory long before that.');
    if (st.stream && !tpl.stream) notes.push('This template returns one value, so there is nothing to stream; streaming needs a function that <b>yields</b> partial results.');
    if (st.progress) notes.push('<b>gr.Progress(track_tqdm=True)</b> mirrors every tqdm bar in the call into the browser — the bridge to the tqdm page.');
    $('#grb-say', root).innerHTML = notes.join(' ');
    xp(1);
  }
  $('#grb-tpl', root).onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    st.tpl = b.dataset.t; $$('#grb-tpl .chip', root).forEach(c => c.classList.toggle('active', c === b)); draw();
  };
  $('#grb-opts', root).onchange = e => {
    const k = e.target.dataset.o; if (!k) return;
    st[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; draw();
  };
  draw();
}

function initGrQueue() {
  const root = $('#gr-queue'); if (!root) return;
  const st = { n: 8, secs: 0.5, limit: '1', shared: false };
  root.innerHTML =
    '<div class="btn-row" style="gap:14px;flex-wrap:wrap;align-items:center">' +
      '<span class="dim mono" style="font-size:12px">users clicking at once</span><input type="range" id="gq-n" min="1" max="16" value="8" style="width:120px"><span class="mono" id="gq-nv">8</span>' +
      '<span class="dim mono" style="font-size:12px">seconds per call</span><input type="range" id="gq-s" min="0.5" max="10" step="0.5" value="0.5" style="width:120px"><span class="mono" id="gq-sv">0.5</span>' +
      '<label class="mono" style="font-size:12px">concurrency_limit <select id="gq-l" style="width:auto"><option value="1">1 (default)</option><option value="2">2</option><option value="4">4</option><option value="8">8</option><option value="none">None</option></select></label>' +
      '<label class="mono" style="font-size:12px"><input type="checkbox" id="gq-sh"> another endpoint reuses the same function with limit 1</label></div>' +
    '<div id="gq-chart"></div><div class="stat-row" id="gq-stats"></div><div class="stepper-say" id="gq-say"></div>';
  function draw() {
    let lim = st.limit === 'none' ? null : +st.limit;
    lim = sharedLimit(lim, 1, st.shared)[0];
    const R = queueRun(st.n, st.secs, lim);
    const W = 560, rowH = 16, pad = 4, x0 = 70, x1 = W - 16, H = R.slots * (rowH + pad) + 40;
    const span = Math.max(R.last, st.secs), X = t => x0 + (x1 - x0) * t / span;
    let g = '';
    for (let s = 0; s < R.slots; s++) g += '<text x="' + (x0 - 8) + '" y="' + (14 + s * (rowH + pad) + 12) + '" fill="#7e8fa6" font-size="10" text-anchor="end" font-family="monospace">worker ' + (s + 1) + '</text>';
    R.jobs.forEach(j => {
      const y = 14 + j.slot * (rowH + pad);
      g += '<rect x="' + (X(j.start) + 1).toFixed(1) + '" y="' + y + '" width="' + Math.max(2, X(j.end) - X(j.start) - 2).toFixed(1) + '" height="' + rowH + '" rx="4" fill="' + (j.start ? '#a78bfa' : '#38bdf8') + '"><title>user ' + (j.i + 1) + ': waits ' + j.start.toFixed(1) + ' s, done at ' + j.end.toFixed(1) + ' s</title></rect>' +
        '<text x="' + ((X(j.start) + X(j.end)) / 2).toFixed(1) + '" y="' + (y + 12) + '" fill="#0b1020" font-size="10" text-anchor="middle" font-family="monospace">' + (j.i + 1) + '</text>';
    });
    g += '<text x="' + x0 + '" y="' + (H - 6) + '" fill="#7e8fa6" font-size="10" font-family="monospace">0 s</text><text x="' + x1 + '" y="' + (H - 6) + '" fill="#7e8fa6" font-size="10" text-anchor="end" font-family="monospace">' + span.toFixed(1) + ' s</text>';
    $('#gq-chart', root).innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:680px;display:block" role="img" aria-label="Gradio queue timeline">' + g + '</svg>';
    $('#gq-stats', root).innerHTML = [
      [R.last.toFixed(1) + ' s', 'until the last user gets an answer'],
      [R.avgWait.toFixed(1) + ' s', 'average time waiting in the queue'],
      [R.slots, 'calls running at once']
    ].map(s => '<div class="stat"><div class="stat-v">' + s[0] + '</div><div class="stat-k">' + s[1] + '</div></div>').join('');
    $('#gq-say', root).innerHTML = 'Cyan runs at once; violet waited in the queue first. ' +
      (st.shared && st.limit !== '1' ? '<b>The limit you set is ignored.</b> Both endpoints wrap the same Python function, and Gradio groups concurrency by function (<span class="mono">concurrency_id</span> defaults to the function\'s id), so the group runs at the lower limit, 1. Wrap it in a second function or pass <span class="mono">concurrency_id</span>. ' : '') +
      'Measured in the tqdm-and-Gradio notebook on Gradio 6.29 (a laptop, HTTP overhead included): 8 calls of 0.5 s took 5.4 s at the default limit and 2.1 s at limit 4 — and 5.4 s again at limit 4 when another endpoint shared the function.';
    xp(1);
  }
  $('#gq-n', root).oninput = e => { st.n = +e.target.value; $('#gq-nv', root).textContent = st.n; draw(); };
  $('#gq-s', root).oninput = e => { st.secs = +e.target.value; $('#gq-sv', root).textContent = st.secs; draw(); };
  $('#gq-l', root).onchange = e => { st.limit = e.target.value; draw(); };
  $('#gq-sh', root).onchange = e => { st.shared = e.target.checked; draw(); };
  draw();
}

const GR_TRAPS = [
  { t: 'One slow user blocks everyone', tag: 'queue', code: 'demo.queue(default_concurrency_limit=4)',
    d: 'The default concurrency limit is 1 per event. For functions that wait on a network call, raise it; for a GPU model, raise it only as far as memory allows.' },
  { t: 'Two endpoints, one function', tag: 'queue', code: 'a.click(run, ..., concurrency_limit=1)\nb.click(run, ..., concurrency_limit=4)   # also runs one at a time',
    d: 'concurrency_id defaults to the function\'s id, so both events share one group and the lower limit wins. Use two functions or name the groups.' },
  { t: 'A global list as "memory"', tag: 'state', code: 'history = []          # shared by EVERY visitor',
    d: 'Module-level variables are shared across sessions. Per-user data belongs in gr.State or the Chatbot history.' },
  { t: 'share=True on a laptop with secrets', tag: 'security', code: 'demo.launch(share=True)',
    d: 'A public URL for up to a week that runs code on your machine. Add auth=, keep allowed_paths tight, and deploy to a Space or a server for anything real.' },
  { t: 'Old tutorials on Gradio 6', tag: 'versions', code: 'gr.Chatbot(type="messages")      # no longer an argument\ngr.Blocks(theme=...)             # theme now goes to launch()',
    d: 'Gradio 6 made the {"role", "content"} message format the only one, moved theme and css to launch(), and replaced show_api / api_name=False with api_visibility.' },
  { t: 'Calling it production', tag: 'scope', code: '# Gradio for the demo, FastAPI for the product',
    d: 'Gradio is excellent for demos, internal tools and model playgrounds. A product with accounts, billing and its own design usually wants a real API and front end — mount Gradio beside it if you still want the playground.' }
];
function initGrTraps() { cards('#gr-traps', GR_TRAPS); }

document.addEventListener('DOMContentLoaded', () => {
  [initTqAnatomy, initTqEta, initTqOps, initTqTraps, initGrOps, initGrBuilder, initGrQueue, initGrTraps]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
