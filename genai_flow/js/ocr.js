/* ============================================================
   ocr.js — "Reading PDFs fast: HunyuanOCR-1.5" (chapter 20b).

   Tencent's HunyuanOCR-1.5 (arXiv 2607.04884, July 2026, final
   version 17 Sep 2026) is a 1B end-to-end OCR model: page image in,
   markdown out. Its speed comes from DFlash speculative decoding,
   not from being small. Every number below is copied from the
   paper's tables; the latency model is FITTED from them, not typed.

     #oc-route   route each page of a PDF: text layer or OCR
     #oc-spec    one decoding pass at a time: autoregressive vs DFlash
     #oc-calc    the latency model: fixed cost + tokens x per-token cost
     #oc-len     latency against output length, measured vs model
     #oc-race    pages per second against the other OCR systems
     #oc-conc    what happens to the speedup under concurrency
     #oc-bench   OmniDocBench v1.6 accuracy
     #oc-tasks   the twelve task types
     #oc-code    run it: PDF to PNG, vLLM, transformers, llama.cpp

   test.js loads this file and re-derives every number.
   ============================================================ */
(function () {
'use strict';

/* ---------- Table 3: one request at a time, vLLM, OmniDocBench pages ----------
   speed = pages/s relative to HunyuanOCR-1.5 without speculative decoding.   */
const SYSTEMS = [
  { n: 'dots.ocr',          by: 'rednote hi lab', para: 'end-to-end', mode: 'AR',     lat: 7.154, pps: 0.136, speed: 0.41 },
  { n: 'DeepSeek-OCR 2',    by: 'DeepSeek',       para: 'end-to-end', mode: 'AR',     lat: 5.460, pps: 0.179, speed: 0.54 },
  { n: 'Unlimited-OCR',     by: '',               para: 'end-to-end', mode: 'AR',     lat: 3.659, pps: 0.255, speed: 0.77 },
  { n: 'HunyuanOCR-1.5',    by: 'Tencent',        para: 'end-to-end', mode: 'AR',     lat: 3.032, pps: 0.330, speed: 1.00 },
  { n: 'PaddleOCR-VL-1.6',  by: 'Baidu',          para: 'two-stage',  mode: 'AR',     lat: 1.744, pps: 0.562, speed: 1.71 },
  { n: 'GLM-OCR',           by: 'Zhipu / Z.ai',   para: 'two-stage',  mode: 'AR',     lat: 1.649, pps: 0.604, speed: 1.83 },
  { n: 'HunyuanOCR-1.5',    by: 'Tencent',        para: 'end-to-end', mode: 'DFlash', lat: 1.408, pps: 0.706, speed: 2.14 }
];

/* ---------- Table 6: concurrency. lat = wall time for a batch of c pages ---------- */
const CONC = [
  { c: 1,  arLat: 3.032,  arPps: 0.330, dfLat: 1.408,  dfPps: 0.706, speed: 2.14 },
  { c: 2,  arLat: 3.761,  arPps: 0.532, dfLat: 1.785,  dfPps: 1.121, speed: 2.11 },
  { c: 4,  arLat: 5.915,  arPps: 0.676, dfLat: 2.615,  dfPps: 1.529, speed: 2.26 },
  { c: 6,  arLat: 7.625,  arPps: 0.787, dfLat: 3.526,  dfPps: 1.702, speed: 2.16 },
  { c: 8,  arLat: 9.433,  arPps: 0.848, dfLat: 4.452,  dfPps: 1.797, speed: 2.12 },
  { c: 16, arLat: 15.657, arPps: 1.022, dfLat: 8.395,  dfPps: 1.906, speed: 1.87 },
  { c: 32, arLat: 29.138, arPps: 1.098, dfLat: 16.162, dfPps: 1.980, speed: 1.80 }
];

/* ---------- Table 4 (vLLM half): pages bucketed by how many tokens they produce ----------
   tps = output tokens per second, acc = effective acceptance length (tokens per pass). */
const BUCKETS = [
  { b: '0-256',     arLat: 0.950, arTps: 217.9, dfLat: 0.723, dfTps: 286.4,  speed: 1.31, acc: 9.23 },
  { b: '256-512',   arLat: 1.156, arTps: 341.8, dfLat: 0.746, dfTps: 529.5,  speed: 1.55, acc: 8.39 },
  { b: '512-1024',  arLat: 1.926, arTps: 395.9, dfLat: 1.086, dfTps: 702.4,  speed: 1.77, acc: 9.38 },
  { b: '1024-2048', arLat: 3.071, arTps: 466.5, dfLat: 1.435, dfTps: 998.6,  speed: 2.14, acc: 9.50 },
  { b: '2048+',     arLat: 6.660, arTps: 514.3, dfLat: 2.901, dfTps: 1183.0, speed: 2.30, acc: 8.65 }
];

/* Table 2: the same model in plain Hugging Face transformers */
const HF = { arLat: 34.850, arTps: 40.9, dfLat: 5.474, dfTps: 245.7, speed: 6.37 };

/* ---------- OmniDocBench v1.6, overall ---------- */
const BENCH = [
  { n: 'HunyuanOCR-1.5',    size: '1B',          kind: 'OCR specialist', s: 94.74 },
  { n: 'Unlimited-OCR',     size: '3B-A0.5B',    kind: 'OCR specialist', s: 93.92 },
  { n: 'Qianfan-OCR',       size: '4.7B',        kind: 'OCR specialist', s: 93.90 },
  { n: 'Logics-Parsing-v2', size: '4B',          kind: 'OCR specialist', s: 93.33 },
  { n: 'Gemini 3 Pro',      size: 'undisclosed', kind: 'general model',  s: 92.91 },
  { n: 'dots.ocr',          size: '3B',          kind: 'OCR specialist', s: 90.77 },
  { n: 'DeepSeek-OCR 2',    size: '3B',          kind: 'OCR specialist', s: 90.25 },
  { n: 'Qwen3-VL-235B',     size: '235B',        kind: 'general model',  s: 89.78 },
  { n: 'GPT-5.2',           size: 'undisclosed', kind: 'general model',  s: 86.59 }
];

/* ---------- the twelve task types the repo's client accepts ---------- */
const TASKS = [
  { id: 'doc_parse',        g: 'parse',     d: 'The default. Whole page to markdown in reading order: tables as HTML, formulas as LaTeX, headers and footers left out.' },
  { id: 'structured_parse', g: 'parse',     d: 'Page parsing with the structure kept explicit, for when you need more than one markdown string per page.' },
  { id: 'layout',           g: 'parse',     d: 'Where the regions are and what each one is, without transcribing them. Useful for cropping and debugging.' },
  { id: 'layout_parse',     g: 'parse',     d: 'Regions and their contents together, so every piece of text keeps the box it came from, which is what citations need.' },
  { id: 'table',            g: 'element',   d: 'A single table image to HTML. Merged cells survive, which is exactly what a plain text extractor destroys.' },
  { id: 'formula',          g: 'element',   d: 'A formula image to LaTeX.' },
  { id: 'chart_parse',      g: 'element',   d: 'A chart back to its data. The paper reports the largest lead over PaddleOCR-VL here (ChartArena).' },
  { id: 'spotting_json',    g: 'spotting',  d: 'Every line of text with its coordinates, as JSON. Street signs, screenshots, receipts: anything that is not a page.' },
  { id: 'spotting_hunyuan', g: 'spotting',  d: 'The same spotting job in the model\'s own coordinate format.' },
  { id: 'doc_trans_en2zh',  g: 'translate', d: 'Read an English document image and write it in Chinese, in one pass.' },
  { id: 'trans_other2en',   g: 'translate', d: 'Read text in another language from the image and write it in English.' },
  { id: 'trans_other2zh',   g: 'translate', d: 'Read text in another language from the image and write it in Chinese.' }
];
const TASK_GROUPS = { parse: 'Parse a page', element: 'One element', spotting: 'Find text anywhere', translate: 'Read and translate' };

/* the default doc_parse prompt, verbatim from the model card, and what it says */
const PROMPT_ZH = '提取文档图片中正文的所有信息用markdown格式表示，其中页眉、页脚部分忽略，表格用html格式表达，文档中公式用latex格式表示，按照阅读顺序组织进行解析。';
const PROMPT_EN = 'Extract all the information in the body of the document image as markdown. Ignore the header and footer. Express tables as HTML and formulas as LaTeX. Organise the result in reading order.';

/* ---------- a mixed PDF: which pages need OCR at all? ----------
   chars = characters in the page's text layer, img = share of the page covered by images. */
const PAGES = [
  { n: 'Cover letter, typed in Word',       chars: 2140, img: 0.00, tables: 0, junk: 0.00 },
  { n: 'Two-column annual report page',     chars: 5310, img: 0.05, tables: 0, junk: 0.00 },
  { n: 'Signed contract page, scanned',     chars: 0,    img: 1.00, tables: 0, junk: 0.00 },
  { n: 'Financial table, born digital',     chars: 3890, img: 0.00, tables: 2, junk: 0.00 },
  { n: 'Scan with an old, bad OCR layer',   chars: 1720, img: 1.00, tables: 0, junk: 0.31 },
  { n: 'Brochure scanned by the office copier', chars: 1310, img: 0.97, tables: 0, junk: 0.04 },
  { n: 'Maths paper page with formulas',    chars: 2460, img: 0.02, tables: 0, junk: 0.22 },
  { n: 'Terms and conditions, small print', chars: 7980, img: 0.00, tables: 0, junk: 0.00 }
];
/* junk = share of the text layer that is replacement characters, broken
   ligatures or single letters: what a formula or a bad OCR layer leaves behind */
function route(p) {
  if (p.chars < 50) return { r: 'ocr', why: 'No text layer worth the name: this page is a picture. Only OCR can read it.' };
  if (p.junk > 0.15) return { r: 'ocr', why: 'The text layer exists but ' + Math.round(p.junk * 100) + '% of it is junk: a bad old OCR layer, or formulas flattened into symbols. Re-read it.' };
  if (p.img > 0.9) return { r: 'ocr', why: 'Mostly image with a thin text layer on top: an earlier OCR pass. Do not trust it.' };
  if (p.tables > 0) return { r: 'ocr', why: 'The text is real, but ' + p.tables + ' table' + (p.tables > 1 ? 's' : '') + ' will come out as word soup from a text extractor. Send this page to the model, or to a table extractor.' };
  return { r: 'native', why: 'A real text layer with nothing it cannot express. Read it directly in milliseconds on a CPU; OCR would only add cost and a chance of misreading.' };
}

/* ---------- the latency model, fitted from the buckets ----------
   latency = fixed + tokens x perToken. tokens per page = latency x tokens/s. */
function fit(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
  const b = sxy / sxx;
  return { fixed: my - b * mx, perToken: b };
}
const AR_FIT = fit(BUCKETS.map(x => x.arLat * x.arTps), BUCKETS.map(x => x.arLat));
const DF_FIT = fit(BUCKETS.map(x => x.dfLat * x.dfTps), BUCKETS.map(x => x.dfLat));
const MEAN_ACC = BUCKETS.reduce((s, x) => s + x.acc, 0) / BUCKETS.length;
/* one DFlash pass (draft a block, verify it) costs this many plain decoding steps */
const PASS_COST = DF_FIT.perToken * MEAN_ACC / AR_FIT.perToken;

function latency(tokens, acc, passCost) {
  const ar = AR_FIT.fixed + tokens * AR_FIT.perToken;
  const df = AR_FIT.fixed + tokens * AR_FIT.perToken * passCost / acc;
  return { ar, df, speed: ar / df, ceiling: acc / passCost };
}

/* expected tokens kept per pass when each drafted token is accepted with
   probability a and the draft block holds k tokens (Leviathan et al., 2023) */
function expectedAccept(a, k) { return a === 1 ? k + 1 : (1 - Math.pow(a, k + 1)) / (1 - a); }

/* ---------- the stepper: a page's output, one pass at a time ---------- */
const SAMPLE = '## Invoice 2026-0917\n\n**Billed to:** Acme Cloud B.V., Rotterdam\n\n' +
  '<table><tr><th>Item</th><th>Qty</th><th>Price</th></tr>' +
  '<tr><td>Edge Gateway EG-300</td><td>4</td><td>1,196.00</td></tr>' +
  '<tr><td>Express delivery</td><td>1</td><td>25.00</td></tr></table>\n\n' +
  'Total due: $1,221.00, payable within 30 days.\n\n$$ \\text{VAT} = 0.21 \\times 1221.00 $$';
/* roughly token-sized pieces: words, numbers, and each markup character on its own */
const PIECES = SAMPLE.match(/<\/?[a-z]+>|[A-Za-z]+|\d+|\s+|[^\sA-Za-z\d]/g);
/* how many tokens each DFlash pass keeps (the last one is the target's own
   correction). Mean 9.28: inside the 8.39-9.50 the paper measures under vLLM. */
const ACC_RUN = [11, 7, 16, 9, 5, 12, 8, 14, 6, 10, 4, 13, 9, 7, 15, 3, 11, 8, 6, 10, 9, 12, 5, 14, 8];
const BLOCK = 16;

const API = { SYSTEMS, CONC, BUCKETS, HF, BENCH, TASKS, PAGES, PROMPT_ZH, PROMPT_EN,
  route, fit, AR_FIT, DF_FIT, MEAN_ACC, PASS_COST, latency, expectedAccept, PIECES, ACC_RUN, BLOCK };
if (typeof window !== 'undefined') window.OCR = API;

/* ================= page wiring ================= */
const doc = typeof document !== 'undefined' ? document : null;
if (!doc || !doc.getElementById('oc-calc')) return;
const $ = id => doc.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const C_AR = '#d97706', C_DF = '#0891b2', C_OTHER = 'rgba(165,171,196,.55)';
const xp = n => { if (typeof window.xp === 'function') window.xp(n); };

/* ---------- route the pages ---------- */
function renderRoute() {
  const rs = PAGES.map(route), ocr = rs.filter(r => r.r === 'ocr').length;
  $('oc-route').innerHTML = PAGES.map((p, i) =>
    '<div class="oc-page oc-' + rs[i].r + '"><div class="oc-page-h"><b>' + (i + 1) + '. ' + p.n + '</b>' +
    '<span class="oc-badge">' + (rs[i].r === 'ocr' ? 'send to OCR' : 'read the text layer') + '</span></div>' +
    '<div class="oc-page-m">' + p.chars.toLocaleString('en-US') + ' chars in text layer &middot; ' +
    Math.round(p.img * 100) + '% image' + (p.tables ? ' &middot; ' + p.tables + ' table' + (p.tables > 1 ? 's' : '') : '') +
    (p.junk ? ' &middot; ' + Math.round(p.junk * 100) + '% junk' : '') + '</div>' +
    '<div class="oc-page-w">' + rs[i].why + '</div></div>').join('');
  const perM = n => (1e6 * n / PAGES.length / CONC[CONC.length - 1].dfPps / 3600);
  $('oc-route-stats').innerHTML = [
    [ocr + ' of ' + PAGES.length, 'pages need the model', ''],
    [Math.round(perM(PAGES.length)).toLocaleString('en-US') + ' h', '1M pages, everything through OCR', ''],
    [Math.round(perM(ocr)).toLocaleString('en-US') + ' h', '1M pages, routed like this', 'good']
  ].map(s => '<div class="stat"><div class="stat-v ' + s[2] + '">' + s[0] + '</div><div class="stat-k">' + s[1] + '</div></div>').join('');
}

/* ---------- the stepper ---------- */
let st = { ar: 0, arPass: 0, df: 0, dfPass: 0, last: null, timer: null };
function resetSpec() { if (st.timer) clearInterval(st.timer); st = { ar: 0, arPass: 0, df: 0, dfPass: 0, last: null, timer: null }; renderSpec(); }
function stepSpec() {
  const N = PIECES.length;
  if (st.ar < N) { st.ar++; st.arPass++; }
  if (st.df < N) {
    const keep = Math.min(ACC_RUN[st.dfPass % ACC_RUN.length], N - st.df);
    st.last = { from: st.df, keep, drafted: Math.min(BLOCK, N - st.df) };
    st.df += keep; st.dfPass++;
  } else st.last = null;
  renderSpec();
  return st.ar < N || st.df < N;
}
function lane(n, last) {
  return PIECES.map((p, i) => {
    let cls = i < n ? 'done' : 'todo';
    if (last && i >= last.from && i < last.from + last.drafted) {
      cls = i < last.from + last.keep - 1 ? 'ok' : i === last.from + last.keep - 1 ? 'fix' : 'drop';
    }
    const t = p === '\n' || p === '\n\n' ? '&#8629;' : esc(p).replace(/ /g, '&nbsp;');
    return '<span class="oc-tok oc-' + cls + '">' + t + '</span>';
  }).join('');
}
function renderSpec() {
  const N = PIECES.length;
  $('oc-spec').innerHTML =
    '<div class="oc-lane"><div class="oc-lane-h" style="--c:' + C_AR + '"><b>Autoregressive</b><span>' + st.arPass +
    ' passes &middot; ' + st.ar + ' / ' + N + ' tokens</span></div><div class="oc-strip">' + lane(st.ar, null) + '</div></div>' +
    '<div class="oc-lane"><div class="oc-lane-h" style="--c:' + C_DF + '"><b>DFlash</b><span>' + st.dfPass +
    ' passes &middot; ' + st.df + ' / ' + N + ' tokens</span></div><div class="oc-strip">' + lane(st.df, st.last) + '</div></div>' +
    '<div class="oc-legend"><span class="oc-tok oc-ok">kept</span> draft token the model agreed with ' +
    '<span class="oc-tok oc-fix">fixed</span> the model\'s own token where the draft went wrong ' +
    '<span class="oc-tok oc-drop">thrown away</span> drafted after the mistake, so discarded</div>' +
    (st.ar >= N && st.df >= N ? '<div class="hyb-ok">Same ' + N + ' tokens, identical text: DFlash took <b>' + st.dfPass +
      ' passes</b> where one-token-at-a-time took <b>' + st.arPass + '</b>. That is ' + (st.arPass / st.dfPass).toFixed(1) +
      ' tokens per pass. It is not ' + (st.arPass / st.dfPass).toFixed(1) + '&times; faster: each pass drafts and checks a block of ' + BLOCK +
      ', which costs about ' + PASS_COST.toFixed(1) + ' plain passes, and reading the image costs the same in both. The calculator below does that arithmetic.</div>' : '');
}

/* ---------- the calculator and the length chart ---------- */
const calc = { tokens: 1414, acc: MEAN_ACC, cost: PASS_COST };   /* the fitted values, unrounded */
function renderCalc() {
  $('oc-calc').innerHTML =
    ctl('tokens', 'output tokens on the page', 100, 4000, 50, calc.tokens, v => v.toLocaleString('en-US')) +
    ctl('acc', 'tokens kept per DFlash pass', 1, 16, 0.1, calc.acc, v => v.toFixed(1)) +
    ctl('cost', 'cost of one pass, in plain steps', 1, 8, 0.1, calc.cost, v => v.toFixed(1) + '&times;');
  renderCalcOut();
}
function ctl(k, label, min, max, step, v, f) {
  return '<label class="oc-ctl"><span>' + label + '</span><input type="range" data-k="' + k + '" min="' + min + '" max="' + max +
    '" step="' + step + '" value="' + v + '"><b id="oc-v-' + k + '">' + f(v) + '</b></label>';
}
function renderCalcOut() {
  const L = latency(calc.tokens, calc.acc, calc.cost), fx = AR_FIT.fixed;
  $('oc-v-tokens').textContent = calc.tokens.toLocaleString('en-US');
  $('oc-v-acc').textContent = calc.acc.toFixed(1);
  $('oc-v-cost').innerHTML = calc.cost.toFixed(1) + '&times;';
  $('oc-calc-stats').innerHTML = [
    [L.ar.toFixed(2) + ' s', 'autoregressive, per page', ''],
    [L.df.toFixed(2) + ' s', 'DFlash, per page', 'good'],
    [L.speed.toFixed(2) + '&times;', 'speedup on this page', ''],
    [L.ceiling.toFixed(2) + '&times;', 'ceiling, infinitely long page', ''],
    [Math.round(fx / L.df * 100) + '%', 'of DFlash time is fixed cost', fx / L.df > 0.5 ? 'bad' : '']
  ].map(s => '<div class="stat"><div class="stat-v ' + s[2] + '">' + s[0] + '</div><div class="stat-k">' + s[1] + '</div></div>').join('');
  const total = L.ar, bar = (t, c, lbl) => {
    const f = fx / total * 100, d = (t - fx) / total * 100;
    return '<div class="oc-tl"><span class="oc-tl-l">' + lbl + '</span><div class="oc-tl-bar">' +
      '<i class="oc-tl-fix" style="width:' + f.toFixed(1) + '%" title="fixed cost ' + fx.toFixed(2) + ' s"></i>' +
      '<i style="width:' + d.toFixed(1) + '%;background:' + c + '" title="decoding ' + (t - fx).toFixed(2) + ' s"></i></div>' +
      '<span class="oc-tl-v">' + t.toFixed(2) + ' s</span></div>';
  };
  $('oc-timeline').innerHTML = bar(L.ar, C_AR, 'Autoregressive') + bar(L.df, C_DF, 'DFlash') +
    '<div class="oc-tl-k"><i class="oc-tl-fix"></i> fixed: read the image, encode it, prefill, overhead (' + fx.toFixed(2) + ' s) ' +
    '<i style="background:' + C_AR + '"></i> decoding, one token per pass <i style="background:' + C_DF + '"></i> decoding, DFlash</div>';
  renderLen();
}
function renderLen() {
  const W = 560, H = 240, pl = 44, pr = 92, pt = 16, pb = 36, xMax = 4000, yMax = 7.5;
  const X = t => pl + (W - pl - pr) * t / xMax, Y = s => H - pb - (H - pt - pb) * s / yMax;
  const line = f => [0, 4000].map(t => X(t).toFixed(1) + ',' + Y(f(t)).toFixed(1)).join(' ');
  const L = t => latency(t, calc.acc, calc.cost);
  let g = '';
  for (let s = 0; s <= 7; s++) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(s) + '" y2="' + Y(s) + '" class="oc-grid"/>' +
    '<text x="' + (pl - 7) + '" y="' + (Y(s) + 4) + '" class="oc-ax" text-anchor="end">' + s + ' s</text>';
  for (let t = 0; t <= 4000; t += 1000) g += '<text x="' + X(t) + '" y="' + (H - pb + 16) + '" class="oc-ax" text-anchor="middle">' + t.toLocaleString('en-US') + '</text>';
  g += '<text x="' + ((pl + W - pr) / 2) + '" y="' + (H - 4) + '" class="oc-ax" text-anchor="middle">output tokens per page</text>';
  g += '<polyline points="' + line(t => L(t).ar) + '" class="oc-ln" stroke="' + C_AR + '"/>';
  g += '<polyline points="' + line(t => L(t).df) + '" class="oc-ln" stroke="' + C_DF + '"/>';
  BUCKETS.forEach(b => {
    const ta = b.arLat * b.arTps, td = b.dfLat * b.dfTps;
    g += '<circle cx="' + X(ta) + '" cy="' + Y(b.arLat) + '" r="4.5" fill="' + C_AR + '" class="oc-dot"><title>' + b.b + ' tokens, autoregressive: measured ' + b.arLat + ' s for ~' + Math.round(ta) + ' tokens</title></circle>';
    g += '<circle cx="' + X(td) + '" cy="' + Y(b.dfLat) + '" r="4.5" fill="' + C_DF + '" class="oc-dot"><title>' + b.b + ' tokens, DFlash: measured ' + b.dfLat + ' s, ' + b.speed + '&times; faster</title></circle>';
  });
  g += '<line x1="' + X(calc.tokens) + '" x2="' + X(calc.tokens) + '" y1="' + pt + '" y2="' + (H - pb) + '" class="oc-cur"/>';
  g += '<text x="' + (W - pr + 6) + '" y="' + (Y(L(4000).ar) + 4) + '" class="oc-lbl">autoregressive</text>';
  g += '<text x="' + (W - pr + 6) + '" y="' + (Y(L(4000).df) + 4) + '" class="oc-lbl">DFlash</text>';
  $('oc-len').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="oc-svg" role="img" aria-label="Latency per page against output tokens: measured buckets and the fitted model">' + g + '</svg>' +
    '<div class="oc-chart-k"><span><i style="background:' + C_AR + '"></i>autoregressive</span><span><i style="background:' + C_DF + '"></i>DFlash</span>' +
    '<span class="dim">dots: the paper\'s five measured length buckets (hover for values) &middot; lines: the model with your settings &middot; vertical line: your page</span></div>';
}

/* ---------- the race: pages per second, one request at a time ---------- */
function renderRace() {
  const max = 0.8, rows = SYSTEMS.slice().sort((a, b) => b.pps - a.pps);
  $('oc-race').innerHTML = rows.map(s => {
    const hy = s.n === 'HunyuanOCR-1.5', c = hy ? (s.mode === 'DFlash' ? C_DF : C_AR) : C_OTHER;
    return '<div class="oc-bar" title="' + s.n + (hy ? ' (' + s.mode + ')' : '') + ': ' + s.lat + ' s per page, ' + s.pps + ' pages/s">' +
      '<span class="oc-bar-n">' + (hy ? '<b>' + s.n + '</b> ' + (s.mode === 'DFlash' ? '+ DFlash' : 'plain') : s.n) +
      '<em>' + s.para + (s.by ? ' &middot; ' + s.by : '') + '</em></span>' +
      '<span class="oc-bar-t"><i style="width:' + (s.pps / max * 100).toFixed(1) + '%;background:' + c + '"></i></span>' +
      '<span class="oc-bar-v">' + s.pps.toFixed(3) + ' <small>pages/s &middot; ' + s.speed.toFixed(2) + '&times;</small></span></div>';
  }).join('');
}

/* ---------- concurrency ---------- */
function renderConc() {
  const W = 560, H = 230, pl = 44, pr = 92, pt = 16, pb = 36, cs = CONC.map(r => r.c);
  const X = c => pl + (W - pl - pr) * Math.log2(c) / 5, Y = v => H - pb - (H - pt - pb) * v / 2.2;
  let g = '';
  [0, 0.5, 1, 1.5, 2].forEach(v => g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="oc-grid"/>' +
    '<text x="' + (pl - 7) + '" y="' + (Y(v) + 4) + '" class="oc-ax" text-anchor="end">' + v + '</text>');
  cs.forEach(c => g += '<text x="' + X(c) + '" y="' + (H - pb + 16) + '" class="oc-ax" text-anchor="middle">' + c + '</text>');
  g += '<text x="' + ((pl + W - pr) / 2) + '" y="' + (H - 4) + '" class="oc-ax" text-anchor="middle">pages in flight at once (log scale)</text>';
  g += '<text x="' + pl + '" y="' + (pt - 4) + '" class="oc-ax">pages per second</text>';
  [['arPps', C_AR, 'autoregressive'], ['dfPps', C_DF, 'DFlash']].forEach(([k, c, n]) => {
    g += '<polyline points="' + CONC.map(r => X(r.c).toFixed(1) + ',' + Y(r[k]).toFixed(1)).join(' ') + '" class="oc-ln" stroke="' + c + '"/>';
    CONC.forEach(r => g += '<circle cx="' + X(r.c) + '" cy="' + Y(r[k]) + '" r="4.5" fill="' + c + '" class="oc-dot"><title>c=' + r.c + ', ' + n + ': ' + r[k] + ' pages/s' + (k === 'dfPps' ? ' (' + r.speed + '&times;)' : '') + '</title></circle>');
    const last = CONC[CONC.length - 1];
    g += '<text x="' + (W - pr + 6) + '" y="' + (Y(last[k]) + 4) + '" class="oc-lbl">' + n + '</text>';
  });
  $('oc-conc').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="oc-svg" role="img" aria-label="Throughput against concurrency for autoregressive and DFlash decoding">' + g + '</svg>' +
    '<div class="oc-speeds">' + CONC.map(r => '<span' + (r.speed === Math.max.apply(null, CONC.map(x => x.speed)) ? ' class="hi"' : '') + '>c=' + r.c + ' <b>' + r.speed.toFixed(2) + '&times;</b></span>').join('') + '</div>';
}

/* ---------- accuracy ---------- */
function renderBench() {
  const lo = 84, hi = 96;
  $('oc-bench').innerHTML = BENCH.map(b => {
    const hy = b.n === 'HunyuanOCR-1.5';
    return '<div class="oc-bar" title="' + b.n + ': ' + b.s + ' overall on OmniDocBench v1.6">' +
      '<span class="oc-bar-n">' + (hy ? '<b>' + b.n + '</b>' : b.n) + '<em>' + b.kind + ' &middot; ' + b.size + '</em></span>' +
      '<span class="oc-bar-t"><i style="width:' + ((b.s - lo) / (hi - lo) * 100).toFixed(1) + '%;background:' + (hy ? C_DF : C_OTHER) + '"></i></span>' +
      '<span class="oc-bar-v">' + b.s.toFixed(2) + '</span></div>';
  }).join('') + '<p class="dec-note"><span class="dim">The bars start at ' + lo + ', not zero, so the gaps are visible; the spread between first and fifth is under two points.</span></p>';
}

/* ---------- tasks ---------- */
function renderTasks() {
  $('oc-tasks').innerHTML = Object.keys(TASK_GROUPS).map(g =>
    '<div class="oc-tgrp"><h5>' + TASK_GROUPS[g] + '</h5>' + TASKS.filter(t => t.g === g).map(t =>
      '<div class="oc-task"><code>' + t.id + '</code><span>' + t.d + '</span></div>').join('') + '</div>').join('');
}

/* ---------- code tabs ---------- */
const CODE = {
  pdf: `# PDF page -> PNG. The model reads images, never the PDF itself.
import pymupdf                                # pip install pymupdf

def page_png(pdf_path: str, i: int, dpi: int = 200) -> bytes:
    with pymupdf.open(pdf_path) as doc:
        return doc[i].get_pixmap(dpi=dpi).tobytes("png")

# A4 at 200 dpi is 1653 x 2339 px: plenty for body text.
# 300 dpi (2480 x 3509) for footnotes and dense tables; 400 dpi overshoots the 4K limit.`,
  vllm: `# 1. serve (from the HunyuanOCR repo; CUDA 13, Python 3.12)
#    uv pip install "vllm>=0.25.1"
#    huggingface-cli download tencent/HunyuanOCR --local-dir ./HunyuanOCR --exclude "v1.0/*"
#    MODEL_PATH=./HunyuanOCR GPU=0 PORT=8000 bash inference/vLLM/serve.sh

# 2. call it like any OpenAI-compatible endpoint
import base64
from openai import OpenAI

PROMPT = "${PROMPT_ZH}"   # doc_parse
client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")

def ocr_page(png: bytes) -> str:
    url = "data:image/png;base64," + base64.b64encode(png).decode()
    r = client.chat.completions.create(
        model="tencent/HunyuanOCR",
        messages=[{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": url}},
            {"type": "text", "text": PROMPT}]}],
        temperature=0.0, top_p=1.0, max_tokens=32768,
        extra_body={"top_k": -1, "repetition_penalty": 1.08})   # the repo's sampling config
    return r.choices[0].message.content

# whole folders: python inference/vLLM/batch_infer.py --image-dir pages/ --out-dir md/ \\
#   --ports 8000 --task-type doc_parse --max-tokens 32768 --concurrency 16`,
  hf: `# plain transformers (>= 5.13): simplest, and ~11x slower than vLLM (34.9 s vs 3.0 s a page)
import torch
from PIL import Image
from transformers import AutoProcessor, HunYuanVLForConditionalGeneration

MODEL_ID = "tencent/HunyuanOCR"
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
model = HunYuanVLForConditionalGeneration.from_pretrained(
    MODEL_ID, torch_dtype=torch.bfloat16, device_map="auto")

messages = [{"role": "user", "content": [
    {"type": "image", "image": Image.open("page_001.png")},
    {"type": "text", "text": PROMPT}]}]
inputs = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=True,
                                       return_dict=True, return_tensors="pt").to(model.device)
out = model.generate(**inputs, max_new_tokens=8192, do_sample=False, repetition_penalty=1.08)
markdown = processor.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0]`,
  cpp: `# laptop / CPU / consumer GPU: llama.cpp with a GGUF conversion
python3 convert_hf_to_gguf.py --outfile ./HunyuanOCR/hyocr-f16.gguf --outtype f16 ./HunyuanOCR
python3 convert_hf_to_gguf.py --outfile ./HunyuanOCR/mmproj-hyocr-f16.gguf --outtype f16 --mmproj ./HunyuanOCR

build/bin/llama-server --model ./HunyuanOCR/hyocr-f16.gguf \\
    --mmproj ./HunyuanOCR/mmproj-hyocr-f16.gguf \\
    --host 0.0.0.0 --port 8080 --alias HYVL \\
    --ctx-size 10240 --n-predict 4096 -fa on --jinja

# DFlash on llama.cpp: convert the draft model, then add
#   --spec-draft-model ./HunyuanOCR/hyocr-dflash-bf16.gguf --spec-type draft-dflash \\
#   --spec-draft-n-max 15 --parallel 1
# llama-server speaks the same OpenAI API, so ocr_page() above works unchanged.`
};
const TABS = [['pdf', 'PDF to image'], ['vllm', 'vLLM server'], ['hf', 'transformers'], ['cpp', 'llama.cpp']];
function renderCode(k) {
  $('oc-code-tabs').innerHTML = TABS.map(t => '<button class="chip' + (t[0] === k ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('');
  $('oc-code').innerHTML = esc(CODE[k]);
}

/* ---------- events ---------- */
$('oc-spec-ctl').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  if (b.dataset.a === 'step') { if (st.timer) { clearInterval(st.timer); st.timer = null; } stepSpec(); }
  if (b.dataset.a === 'reset') resetSpec();
  if (b.dataset.a === 'play') {
    resetSpec(); xp(2);
    st.timer = setInterval(() => { if (!stepSpec()) { clearInterval(st.timer); st.timer = null; } }, 140);
  }
});
$('oc-calc').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  calc[k] = +e.target.value; renderCalcOut();
});
$('oc-code-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) renderCode(b.dataset.tab); });

renderRoute(); resetSpec(); renderCalc(); renderRace(); renderConc(); renderBench(); renderTasks(); renderCode('vllm');
})();
