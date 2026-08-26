/* ============================================================
   demos.js — every interactive widget.

   All the maths lives in mathkit.js so that test.js can run the
   exact same code. Every network on this page is initialised and
   trained live in your browser; nothing is a recording.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const xp = (n, msg) => window.awardXP && window.awardXP(n, msg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const fmt = (n, d) => Number(n).toFixed(d == null ? 2 : d);
const SVGNS = 'http://www.w3.org/2000/svg';

const MK = window.MK;
const { ACT, gelu, makeNet, forward, predict, bce, netLoss, backprop, trainStep,
        accuracy, gradientFlow, convolve, maxPool, relu2d, denseParams, convParams } = MK;

/* ---------- the shared plotting helper ---------- */
function plot(canvas, xr, yr, pad) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const p = Object.assign({ l: 46, r: 14, t: 14, b: 32 }, pad);
  const X = v => p.l + (v - xr[0]) / (xr[1] - xr[0]) * (w - p.l - p.r);
  const Y = v => h - p.b - (v - yr[0]) / (yr[1] - yr[0]) * (h - p.t - p.b);
  return {
    ctx, w, h, p, X, Y,
    grid(xt, yt, xlab, ylab, fmtY) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(165,171,196,.75)'; ctx.font = '10px ui-monospace, monospace';
      const nx = xt || 5, ny = yt || 4;
      for (let i = 0; i <= nx; i++) {
        const v = xr[0] + (xr[1] - xr[0]) * i / nx;
        ctx.beginPath(); ctx.moveTo(X(v), p.t); ctx.lineTo(X(v), h - p.b); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1), X(v), h - p.b + 14);
      }
      for (let i = 0; i <= ny; i++) {
        const v = yr[0] + (yr[1] - yr[0]) * i / ny;
        ctx.beginPath(); ctx.moveTo(p.l, Y(v)); ctx.lineTo(w - p.r, Y(v)); ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText(fmtY ? fmtY(v) : (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)), p.l - 7, Y(v) + 3.5);
      }
      if (xlab) { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(111,117,148,.95)';
        ctx.fillText(xlab, p.l + (w - p.l - p.r) / 2, h - 4); }
      if (ylab) { ctx.save(); ctx.translate(11, p.t + (h - p.t - p.b) / 2); ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center'; ctx.fillText(ylab, 0, 0); ctx.restore(); }
    },
    dot(x, y, c, r) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(x), Y(y), r || 4, 0, 7); ctx.fill(); },
    ring(x, y, c, r) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Y(y), r || 6, 0, 7); ctx.stroke(); },
    line(pts, c, wd, dash) {
      ctx.strokeStyle = c; ctx.lineWidth = wd || 2; ctx.setLineDash(dash || []);
      ctx.beginPath(); pts.forEach((pt, i) => i ? ctx.lineTo(X(pt[0]), Y(pt[1])) : ctx.moveTo(X(pt[0]), Y(pt[1])));
      ctx.stroke(); ctx.setLineDash([]);
    },
    seg(x1, y1, x2, y2, c, wd, dash) {
      ctx.strokeStyle = c; ctx.lineWidth = wd || 1; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); ctx.setLineDash([]);
    },
    /* Shade the plane by what the network predicts there. */
    field(fn, cell) {
      const c = cell || 9;
      for (let px = p.l; px < w - p.r; px += c) {
        for (let py = p.t; py < h - p.b; py += c) {
          const x = xr[0] + (px - p.l) / (w - p.l - p.r) * (xr[1] - xr[0]);
          const y = yr[0] + (h - p.b - py) / (h - p.t - p.b) * (yr[1] - yr[0]);
          const v = fn(x, y);
          ctx.fillStyle = v > .5 ? 'rgba(52,211,153,' + ((v - .5) * .5) + ')'
                                 : 'rgba(124,92,255,' + ((.5 - v) * .5) + ')';
          ctx.fillRect(px, py, c, c);
        }
      }
    }
  };
}

/* ============================================================
   Background particles + the hero pipeline
   ============================================================ */
function initBackground() {
  const cv = $('#bg-particles'); if (!cv) return;
  const ctx = cv.getContext('2d');
  let pts = [], W = 0, H = 0;
  function resize() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    const count = Math.min(70, Math.round(W * H / 26000));
    pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: Math.random() * 1.6 + .6
    }));
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.fillStyle = 'rgba(160,180,255,.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = dx * dx + dy * dy;
      if (d2 < 20000) {
        ctx.strokeStyle = 'rgba(124,92,255,' + (0.16 * (1 - d2 / 20000)) + ')';
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }
  resize(); window.addEventListener('resize', resize);
  if (!reduced()) frame();

  const g = $('#hero-nodes'), path = $('#flow-path');
  if (g && path && path.getTotalLength) {
    const len = path.getTotalLength();
    for (let i = 0; i <= 4; i++) {
      const pt = path.getPointAtLength(len * i / 4);
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 13);
      c.setAttribute('fill', 'rgba(12,15,28,.9)');
      c.setAttribute('stroke', ['#7c5cff', '#8f6bff', '#22d3ee', '#2ee6c0', '#34d399'][i]);
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
    }
  }
}

/* ============================================================
   Ch1 — one neuron
   ============================================================ */
function initNeuron() {
  const cv = $('#neuron-canvas'); if (!cv) return;
  let w1 = 1, w2 = 1, b = -1.5, act = 'sigmoid';
  const CORNERS = [[0, 0], [0, 1], [1, 0], [1, 1]];

  const presets = $('#neuron-presets');
  C.neuronPresets.forEach((p, i) => {
    const btn = el('button', 'chip' + (i ? '' : ' active'), p.n);
    btn.onclick = () => {
      $$('.chip', presets).forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      w1 = p.w1; w2 = p.w2; b = p.b;
      $('#n-w1').value = w1; $('#n-w2').value = w2; $('#n-b').value = b;
      $('#neuron-note').innerHTML = p.note;
      draw(); xp(1);
    };
    presets.appendChild(btn);
  });
  $$('#neuron-act .chip').forEach(btn => btn.onclick = () => {
    $$('#neuron-act .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active'); act = btn.dataset.a; draw();
  });

  function draw() {
    $('#n-w1v').textContent = fmt(w1); $('#n-w2v').textContent = fmt(w2); $('#n-bv').textContent = fmt(b);
    const f = ACT[act].f;
    const P = plot(cv, [-0.4, 1.4], [-0.4, 1.4]);
    P.field((x, y) => {
      const v = f(w1 * x + w2 * y + b);
      return act === 'relu' || act === 'leaky' ? (v > 0 ? 0.9 : 0.1) : v;
    }, 8);
    P.grid(4, 4, 'x₁', 'x₂');
    // the decision boundary is where the weighted sum crosses zero
    if (Math.abs(w2) > 1e-6) {
      const yAt = x => -(w1 * x + b) / w2;
      P.line([[-0.4, yAt(-0.4)], [1.4, yAt(1.4)]], '#fff', 2);
    } else if (Math.abs(w1) > 1e-6) {
      P.seg(-b / w1, -0.4, -b / w1, 1.4, '#fff', 2);
    }
    const rows = CORNERS.map(([x, y]) => {
      const z = w1 * x + w2 * y + b, a = f(z);
      P.dot(x, y, a >= 0.5 ? '#34d399' : '#7c5cff', 7);
      return '<tr><td class="mono">' + x + ', ' + y + '</td><td class="mono">' + fmt(z) +
             '</td><td class="mono">' + fmt(a, 3) + '</td><td class="mono ' +
             (a >= 0.5 ? 'on' : 'off') + '">' + (a >= 0.5 ? 1 : 0) + '</td></tr>';
    }).join('');
    $('#neuron-table').innerHTML =
      '<table class="dt"><thead><tr><th>x₁, x₂</th><th>z = w·x + b</th><th>' + ACT[act].name +
      '(z)</th><th>output</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  ['n-w1', 'n-w2', 'n-b'].forEach(id => $('#' + id).oninput = e => {
    if (id === 'n-w1') w1 = +e.target.value;
    if (id === 'n-w2') w2 = +e.target.value;
    if (id === 'n-b') b = +e.target.value;
    draw();
  });
  $('#neuron-note').innerHTML = C.neuronPresets[0].note;
  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'neuron') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch2 — activation functions, plotted for real
   ============================================================ */
function initActivations() {
  const cv = $('#act-canvas'); if (!cv) return;
  let show = { relu: true, sigmoid: true, tanh: true, leaky: false, gelu: false };
  let deriv = false;
  const COLORS = { relu: '#34d399', sigmoid: '#fb7185', tanh: '#fbbf24', leaky: '#22d3ee', gelu: '#f472b6', linear: '#6f7594' };

  const row = $('#act-toggles');
  ['relu', 'leaky', 'tanh', 'sigmoid', 'gelu'].forEach(k => {
    const b = el('button', 'chip' + (show[k] ? ' active' : ''), ACT[k] ? ACT[k].name : 'GELU');
    b.style.borderColor = COLORS[k] + '66';
    b.onclick = () => { show[k] = !show[k]; b.classList.toggle('active', show[k]); draw(); xp(1); };
    row.appendChild(b);
  });
  $('#act-deriv').onclick = e => { deriv = !deriv; e.target.classList.toggle('active', deriv); draw(); };

  function valueAt(k, z) {
    if (k === 'gelu') return gelu(z);
    return ACT[k].f(z);
  }
  function derivAt(k, z) {
    // numerically, so the plotted derivative cannot silently disagree with the plotted function
    const h = 1e-4;
    return (valueAt(k, z + h) - valueAt(k, z - h)) / (2 * h);
  }
  function draw() {
    const yr = deriv ? [-0.2, 1.2] : [-1.4, 2.4];
    const P = plot(cv, [-4, 4], yr);
    P.grid(8, 4, 'z (the weighted sum)', deriv ? 'derivative' : 'activation output');
    P.seg(-4, 0, 4, 0, 'rgba(255,255,255,.2)', 1);
    P.seg(0, yr[0], 0, yr[1], 'rgba(255,255,255,.2)', 1);
    Object.keys(show).forEach(k => {
      if (!show[k]) return;
      const pts = [];
      for (let z = -4; z <= 4; z += 0.02) pts.push([z, deriv ? derivAt(k, z) : valueAt(k, z)]);
      P.line(pts, COLORS[k], 2.5);
    });
    $('#act-caption').innerHTML = deriv
      ? 'Now showing the <b>derivative</b> — the number backpropagation multiplies by at every layer. Notice sigmoid never exceeds <b>0.25</b>: eight sigmoid layers can shrink a gradient by a factor of four thousand. ReLU is flat at 1 wherever it is active, which is the whole reason it won.'
      : 'The activation itself. Everything except the straight line is a curve, and that curvature is what lets a stack of layers represent something a single layer cannot.';
  }
  const cards = $('#act-cards');
  C.activationCards.forEach(a => {
    const c = el('div', 'act-card reveal');
    c.innerHTML = '<h3 style="color:' + (COLORS[a.k] || '#a5abc4') + '">' + a.t + '</h3>' +
      '<pre class="code">' + esc(a.f) + '</pre>' +
      '<p class="pcard-desc">' + a.use + '</p>' +
      '<div class="act-watch">⚠ ' + a.watch + '</div>';
    cards.appendChild(c);
  });
  const collapse = $('#linear-collapse');
  if (collapse) collapse.innerHTML = C.linearCollapse;
  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'activations') requestAnimationFrame(draw); });
}

/* ============================================================
   A live-training widget, shared by the XOR and moons chapters.
   ============================================================ */
function trainer(opts) {
  const { canvas, lossCanvas, archs, data, xr, yr, onFrame, lr, steps, hooks } = opts;
  let arch = archs[0], net = null, hist = [], epoch = 0, timer = null, seed = 42;

  function build() {
    net = makeNet(arch.sizes, arch.act, seed);
    hist = []; epoch = 0;
    draw();
  }
  function step(n) {
    for (let i = 0; i < (n || 1); i++) {
      const L = trainStep(net, data, lr, 0);
      hist.push(L);
      epoch++;
    }
    if (hist.length > 4000) hist = hist.slice(-4000);
    draw();
  }
  function draw() {
    const P = plot(canvas, xr, yr);
    P.field((x, y) => predict(net, [x, y])[0], 9);
    P.grid(5, 4, 'x₁', 'x₂');
    data.forEach(d => {
      const p = predict(net, d.x)[0];
      const right = (p >= 0.5 ? 1 : 0) === d.y;
      P.dot(d.x[0], d.x[1], d.y ? '#34d399' : '#7c5cff', 5);
      if (!right) P.ring(d.x[0], d.x[1], '#fb7185', 8);
    });
    if (lossCanvas) {
      const top = Math.max(0.75, hist.length ? Math.max.apply(null, hist) : 0.75);
      const P2 = plot(lossCanvas, [0, Math.max(60, hist.length)], [0, top], { l: 50 });
      P2.grid(4, 4, 'epoch', 'loss (cross-entropy)');
      P2.line(hist.map((v, i) => [i, v]), '#22d3ee', 2);
    }
    if (onFrame) onFrame({ net, epoch, loss: hist.length ? hist[hist.length - 1] : netLoss(net, data),
                           acc: accuracy(net, data), arch });
  }
  function stop() { clearInterval(timer); timer = null; if (hooks && hooks.onstate) hooks.onstate(false); }
  function run() {
    if (timer) return stop();
    timer = setInterval(() => {
      step(steps || 4);
      if (epoch >= (opts.maxEpochs || 4000)) stop();
    }, reduced() ? 1 : 30);
    if (hooks && hooks.onstate) hooks.onstate(true);
  }
  return {
    build, step, draw, run, stop,
    reseed() { seed = (seed * 7919 + 13) % 100000; build(); },
    setArch(a) { stop(); arch = a; build(); },
    get arch() { return arch; },
    get net() { return net; },
    get epoch() { return epoch; }
  };
}

/* ============================================================
   Ch3 — XOR
   ============================================================ */
function initXor() {
  const cv = $('#xor-canvas'); if (!cv) return;
  const data = C.xorData;

  const T = trainer({
    canvas: cv, lossCanvas: $('#xor-loss'), archs: C.xorArchs, data,
    xr: [-0.35, 1.35], yr: [-0.35, 1.35], lr: 0.6, steps: 6, maxEpochs: 4000,
    hooks: { onstate: on => $('#xor-run').innerHTML = on ? '❚❚ Pause' : '▶ Train' },
    onFrame: s => {
      $('#xor-epoch').textContent = s.epoch;
      $('#xor-loss-v').textContent = fmt(s.loss, 4);
      $('#xor-acc').textContent = fmt(s.acc * 100, 0) + '%';
      $('#xor-truth').innerHTML = '<table class="dt"><thead><tr><th>x₁</th><th>x₂</th>' +
        '<th>target</th><th>predicted</th></tr></thead><tbody>' +
        data.map(d => {
          const p = predict(s.net, d.x)[0];
          const ok = (p >= 0.5 ? 1 : 0) === d.y;
          return '<tr><td class="mono">' + d.x[0] + '</td><td class="mono">' + d.x[1] +
            '</td><td class="mono">' + d.y + '</td><td class="mono ' + (ok ? 'on' : 'off') + '">' +
            fmt(p, 3) + (ok ? ' ✓' : ' ✗') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
  });

  const row = $('#xor-archs');
  C.xorArchs.forEach((a, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), a.label);
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active');
      T.setArch(a);
      $('#xor-note').innerHTML = a.note;
      $('#xor-shape').textContent = a.sizes.join(' → ') + '   (' + ACT[a.act].name + ')';
      xp(2);
    };
    row.appendChild(b);
  });
  $('#xor-run').onclick = () => { T.run(); xp(2); };
  $('#xor-reset').onclick = () => { T.stop(); T.reseed(); };
  $('#xor-note').innerHTML = C.xorArchs[0].note;
  $('#xor-shape').textContent = C.xorArchs[0].sizes.join(' → ') + '   (' + ACT[C.xorArchs[0].act].name + ')';
  T.build();
  window.addEventListener('resize', () => T.draw());
  window.addEventListener('chapterchange', e => { if (e.detail === 'xor') requestAnimationFrame(() => T.draw()); });
}

/* ============================================================
   Ch4/5 — walk one forward pass, then one backward pass
   ============================================================ */
function netDiagram(svg, net, x, opts) {
  const o = opts || {};
  const W = 520, H = 220;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = '';
  const { acts } = forward(net, x);
  const cols = [x.length].concat(net.layers.map(L => L.w.length));
  const pos = cols.map((n, li) => Array.from({ length: n }, (_, i) => ({
    x: 60 + li * ((W - 120) / (cols.length - 1)),
    y: H / 2 + (i - (n - 1) / 2) * 66
  })));

  // edges first, so the nodes sit on top
  net.layers.forEach((L, li) => {
    L.w.forEach((row, i) => row.forEach((wv, j) => {
      const a = pos[li][j], b = pos[li + 1][i];
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      const lit = o.litLayer === li;
      line.setAttribute('stroke', lit ? (wv >= 0 ? '#34d399' : '#fb7185')
                                      : (wv >= 0 ? 'rgba(52,211,153,.22)' : 'rgba(251,113,133,.22)'));
      line.setAttribute('stroke-width', Math.min(4.5, 0.6 + Math.abs(wv) * 1.7));
      svg.appendChild(line);
      if (lit) {
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', (a.x + b.x) / 2); t.setAttribute('y', (a.y + b.y) / 2 - 4);
        t.setAttribute('fill', '#e8eaf3'); t.setAttribute('font-size', '9.5');
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'ui-monospace, monospace');
        t.textContent = fmt(wv, 2);
        svg.appendChild(t);
      }
    }));
  });

  pos.forEach((layer, li) => layer.forEach((p, i) => {
    const g = document.createElementNS(SVGNS, 'g');
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 21);
    const active = o.litNode === li;
    c.setAttribute('fill', active ? 'rgba(124,92,255,.32)' : 'rgba(12,15,28,.92)');
    c.setAttribute('stroke', active ? '#7c5cff' : 'rgba(255,255,255,.24)');
    c.setAttribute('stroke-width', active ? 2.5 : 1.5);
    g.appendChild(c);
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', p.x); t.setAttribute('y', p.y + 4);
    t.setAttribute('fill', '#e8eaf3'); t.setAttribute('font-size', '11');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'ui-monospace, monospace');
    t.textContent = fmt(acts[li][i], 2);
    g.appendChild(t);
    const lab = document.createElementNS(SVGNS, 'text');
    lab.setAttribute('x', p.x); lab.setAttribute('y', p.y + 37);
    lab.setAttribute('fill', 'rgba(111,117,148,.95)'); lab.setAttribute('font-size', '9.5');
    lab.setAttribute('text-anchor', 'middle');
    lab.textContent = li === 0 ? (C.walkNet.inputNames[i] || 'x' + i)
                    : li === pos.length - 1 ? 'output' : 'h' + (i + 1);
    g.appendChild(lab);
    svg.appendChild(g);
  }));
}

function initWalk() {
  const root = $('#walk-demo'); if (!root) return;
  const cfg = C.walkNet;
  const net = makeNet(cfg.sizes, cfg.act, cfg.seed);
  const fwd = forward(net, cfg.x);
  let at = 0, timer = null;

  function render() {
    const s = C.forwardSteps[at];
    // step 0 lights the inputs, then one layer at a time, then the loss
    const litLayer = at >= 1 && at <= 4 ? Math.min(net.layers.length - 1, Math.floor((at - 1) / 2)) : -1;
    netDiagram($('#walk-svg', root), net, cfg.x, { litLayer, litNode: at === 0 ? 0 : litLayer + 1 });
    $('#walk-step', root).textContent = 'Step ' + (at + 1) + ' of ' + C.forwardSteps.length;
    $('#walk-title', root).textContent = s.t;
    $('#walk-desc', root).innerHTML = s.d;

    const L0 = net.layers[0], L1 = net.layers[1];
    const maths = [
      'x = [' + cfg.x.join(', ') + ']',
      'z₁ = ' + L0.w.map((row, i) =>
        row.map((wv, j) => fmt(wv, 2) + '·' + fmt(cfg.x[j], 0)).join(' + ') + ' + ' + fmt(L0.b[i], 2)
        + ' = ' + fmt(fwd.zs[0][i], 3)).join('\n     '),
      'h = tanh(z₁) = [' + fwd.acts[1].map(v => fmt(v, 3)).join(', ') + ']',
      'z₂ = ' + L1.w[0].map((wv, j) => fmt(wv, 2) + '·' + fmt(fwd.acts[1][j], 3)).join(' + ')
        + ' + ' + fmt(L1.b[0], 2) + ' = ' + fmt(fwd.zs[1][0], 3),
      'ŷ = sigmoid(' + fmt(fwd.zs[1][0], 3) + ') = ' + fmt(fwd.out[0], 4),
      'L = −[y·log(ŷ) + (1−y)·log(1−ŷ)]\n  = ' + fmt(bce(fwd.out[0], cfg.y), 4) + '   (target y = ' + cfg.y + ')'
    ];
    $('#walk-math', root).textContent = maths[at];
    if (at === C.forwardSteps.length - 1) xp(4);
  }
  function stop() { clearInterval(timer); timer = null; $('#walk-play', root).innerHTML = '▶ Run the forward pass'; }
  $('#walk-play', root).onclick = () => {
    if (timer) return stop();
    at = 0; render();
    $('#walk-play', root).innerHTML = '❚❚ Pause';
    timer = setInterval(() => {
      at++;
      if (at >= C.forwardSteps.length) { at = C.forwardSteps.length - 1; render(); stop(); return; }
      render();
    }, reduced() ? 1 : 1900);
  };
  $('#walk-next', root).onclick = () => { stop(); at = Math.min(C.forwardSteps.length - 1, at + 1); render(); };
  $('#walk-prev', root).onclick = () => { stop(); at = Math.max(0, at - 1); render(); };
  render();
}

function initBackpropWalk() {
  const root = $('#bp-demo'); if (!root) return;
  const cfg = C.walkNet;
  const net = makeNet(cfg.sizes, cfg.act, cfg.seed);
  const fwd = forward(net, cfg.x);
  const g = backprop(net, cfg.x, cfg.y);
  let at = 0, timer = null;

  function render() {
    const s = C.backpropSteps[at];
    // the highlight walks backwards through the layers
    const litLayer = at >= 2 && at <= 4 ? Math.max(0, net.layers.length - 1 - (at - 2)) : -1;
    netDiagram($('#bp-svg', root), net, cfg.x, { litLayer, litNode: -1 });
    $('#bp-step', root).textContent = 'Step ' + (at + 1) + ' of ' + C.backpropSteps.length;
    $('#bp-title', root).textContent = s.t;
    $('#bp-desc', root).innerHTML = s.d;

    const delta = fwd.out[0] - cfg.y;
    const maths = [
      'L = ' + fmt(bce(fwd.out[0], cfg.y), 4) + '\n\nWe want ∂L/∂w for every weight.',
      'δ_out = ŷ − y = ' + fmt(fwd.out[0], 4) + ' − ' + cfg.y + ' = ' + fmt(delta, 4),
      '∂L/∂w₂ = δ_out × h\n       = ' + fmt(delta, 4) + ' × [' + fwd.acts[1].map(v => fmt(v, 3)).join(', ') + ']\n' +
        '       = [' + g.gw[1][0].map(v => fmt(v, 4)).join(', ') + ']',
      'δ_h = (w₂ · δ_out) × tanh′(h)\n' +
        '    = [' + net.layers[1].w[0].map(v => fmt(v, 3)).join(', ') + '] × ' + fmt(delta, 4) + '\n' +
        '      × [' + fwd.acts[1].map(a => fmt(1 - a * a, 3)).join(', ') + ']\n' +
        '    = [' + g.gb[0].map(v => fmt(v, 4)).join(', ') + ']',
      '∂L/∂w₁ = δ_h ⊗ x\n' + g.gw[0].map((row, i) =>
        '  unit ' + (i + 1) + ': [' + row.map(v => fmt(v, 4)).join(', ') + ']').join('\n'),
      'w ← w − lr × ∂L/∂w      (lr = 0.6)\n\n' +
        'w₂ becomes [' + net.layers[1].w[0].map((wv, j) =>
          fmt(wv - 0.6 * g.gw[1][0][j], 3)).join(', ') + ']'
    ];
    $('#bp-math', root).textContent = maths[at];

    // gradient magnitude per layer, which is the thing Chapter 8 is about
    $('#bp-mags', root).innerHTML = g.mags.map((m, i) =>
      '<div class="magrow"><span class="mono">layer ' + (i + 1) + '</span>' +
      '<div class="magbar"><div style="width:' + Math.min(100, m / Math.max.apply(null, g.mags) * 100) +
      '%"></div></div><span class="mono">' + m.toExponential(2) + '</span></div>').join('');
    if (at === C.backpropSteps.length - 1) xp(5, '+5 XP — you have followed a gradient by hand');
  }
  function stop() { clearInterval(timer); timer = null; $('#bp-play', root).innerHTML = '▶ Run the backward pass'; }
  $('#bp-play', root).onclick = () => {
    if (timer) return stop();
    at = 0; render();
    $('#bp-play', root).innerHTML = '❚❚ Pause';
    timer = setInterval(() => {
      at++;
      if (at >= C.backpropSteps.length) { at = C.backpropSteps.length - 1; render(); stop(); return; }
      render();
    }, reduced() ? 1 : 2400);
  };
  $('#bp-next', root).onclick = () => { stop(); at = Math.min(C.backpropSteps.length - 1, at + 1); render(); };
  $('#bp-prev', root).onclick = () => { stop(); at = Math.max(0, at - 1); render(); };
  const chain = $('#chain-rule'); if (chain) chain.innerHTML = C.chainRule;
  render();
}

/* ============================================================
   Ch6 — a real network on data a line cannot separate
   ============================================================ */
function initMoons() {
  const cv = $('#moons-canvas'); if (!cv) return;
  const data = C.moonsData.map(p => ({ x: [p[0], p[1]], y: p[2] }));

  const T = trainer({
    canvas: cv, lossCanvas: $('#moons-loss'), archs: C.moonsArchs, data,
    xr: [-2.2, 4], yr: [-1.7, 2.3], lr: 0.5, steps: 5, maxEpochs: 2000,
    hooks: { onstate: on => $('#moons-run').innerHTML = on ? '❚❚ Pause' : '▶ Train' },
    onFrame: s => {
      $('#moons-epoch').textContent = s.epoch;
      $('#moons-loss-v').textContent = fmt(s.loss, 4);
      $('#moons-acc').textContent = fmt(s.acc * 100, 1) + '%';
      $('#moons-params').textContent = s.net.layers.reduce((a, L) =>
        a + L.w.length * L.w[0].length + L.b.length, 0);
    }
  });

  const row = $('#moons-archs');
  C.moonsArchs.forEach((a, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), a.label);
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); T.setArch(a);
      $('#moons-note').innerHTML = a.note; xp(2);
    };
    row.appendChild(b);
  });
  $('#moons-run').onclick = () => { T.run(); xp(3); };
  $('#moons-reset').onclick = () => { T.stop(); T.reseed(); };
  $('#moons-note').innerHTML = C.moonsArchs[0].note;
  T.build();
  window.addEventListener('resize', () => T.draw());
  window.addEventListener('chapterchange', e => { if (e.detail === 'training') requestAnimationFrame(() => T.draw()); });
}

/* ============================================================
   Ch6b — the learning rate, four ways, on the same network
   ============================================================ */
function initLR() {
  const cv = $('#lr-canvas'); if (!cv) return;
  const data = C.moonsData.map(p => ({ x: [p[0], p[1]], y: p[2] }));
  const EPOCHS = 600;

  function runAll() {
    const curves = C.lrCards.map(r => {
      const net = makeNet([2, 6, 1], 'tanh', 42);
      const h = [];
      for (let i = 0; i < EPOCHS; i++) {
        const L = trainStep(net, data, r.lr, 0);
        h.push(Number.isFinite(L) ? L : 3);
      }
      return { r, h, final: netLoss(net, data), acc: accuracy(net, data) };
    });
    const P = plot(cv, [0, EPOCHS], [0, 1.1], { l: 50 });
    P.grid(4, 4, 'epoch', 'loss (cross-entropy)');
    curves.forEach(c => P.line(c.h.map((v, i) => [i, Math.min(v, 1.1)]), c.r.c, 2.2));
    $('#lr-legend').innerHTML = curves.map(c =>
      '<div class="lrrow"><span class="lrdot" style="background:' + c.r.c + '"></span>' +
      '<b class="mono">lr = ' + c.r.lr + '</b><span class="lrtag">' + c.r.tag + '</span>' +
      '<span class="lrfin mono">final loss ' + (Number.isFinite(c.final) ? fmt(c.final, 3) : 'diverged') +
      ' · ' + fmt(c.acc * 100, 0) + '%</span></div>').join('');
    $('#lr-note').innerHTML = C.lrCards.map(r =>
      '<div class="lrnote"><b style="color:' + r.c + '">lr = ' + r.lr + '</b> ' + r.note + '</div>').join('');
  }
  $('#lr-go').onclick = () => { runAll(); xp(4, '+4 XP — four learning rates, one network'); };
  runAll();
  window.addEventListener('resize', runAll);
  window.addEventListener('chapterchange', e => { if (e.detail === 'training') requestAnimationFrame(runAll); });
}

/* ============================================================
   Ch7 — regularisation
   ============================================================ */
function initReg() {
  const root = $('#reg-cards'); if (!root) return;
  C.regCards.forEach(r => {
    const c = el('div', 'reg-card reveal');
    c.innerHTML = '<div class="reg-ico">' + r.ico + '</div><h3>' + r.t + '</h3>' +
      '<p class="pcard-desc">' + r.d + '</p><div class="reg-why">' + r.why + '</div>' +
      '<pre class="code">' + esc(r.code) + '</pre>';
    root.appendChild(c);
  });

  const grid = $('#dropout-grid'); if (!grid) return;
  const N = 24;
  for (let i = 0; i < N; i++) grid.appendChild(el('div', 'dunit'));
  let timer = null, pass = 0;
  function shuffle() {
    const rate = +$('#dropout-rate').value / 100;
    $('#dropout-rate-v').textContent = fmt(rate, 2);
    const mask = MK.dropoutMask(N, rate, 1000 + pass);
    $$('.dunit', grid).forEach((u, i) => u.classList.toggle('dropped', mask[i] === 0));
    $('#dropout-count').textContent = mask.filter(m => m === 0).length + ' of ' + N + ' units dropped this pass';
    pass++;
  }
  $('#dropout-rate').oninput = shuffle;
  $('#dropout-go').onclick = e => {
    if (timer) { clearInterval(timer); timer = null; e.target.innerHTML = '▶ Training passes'; return; }
    e.target.innerHTML = '❚❚ Pause';
    timer = setInterval(shuffle, reduced() ? 1 : 800);
    xp(3);
  };
  $('#dropout-eval').onclick = () => {
    if (timer) { clearInterval(timer); timer = null; $('#dropout-go').innerHTML = '▶ Training passes'; }
    $$('.dunit', grid).forEach(u => u.classList.remove('dropped'));
    $('#dropout-count').textContent = 'inference: every unit active, nothing dropped';
    xp(2);
  };
  shuffle();
}

/* ============================================================
   Ch8 — gradient flow and initialisation
   ============================================================ */
function initFlow() {
  const cv = $('#flow-canvas'); if (!cv) return;
  const depthIn = $('#flow-depth');

  function draw() {
    const depth = +depthIn.value;
    $('#flow-depth-v').textContent = depth;
    const series = C.flowActs.map(a => ({ a, mags: gradientFlow(depth, a.k, 7) }));
    // log scale, because the whole point is that the numbers span many orders of magnitude
    const lo = -10, hi = 1;
    const P = plot(cv, [1, depth], [lo, hi], { l: 58, b: 34 });
    P.grid(Math.min(depth - 1, 10), 5, 'layer (1 = first, furthest from the loss)',
      'gradient magnitude', v => '1e' + v.toFixed(0));
    series.forEach(s => {
      const pts = s.mags.map((m, i) => [i + 1, Math.max(lo, Math.log10(Math.max(m, 1e-12)))]);
      P.line(pts, s.a.c, 2.4);
      pts.forEach(p => P.dot(p[0], p[1], s.a.c, 3.4));
    });
    $('#flow-legend').innerHTML = series.map(s => {
      const first = s.mags[0], last = s.mags[s.mags.length - 1];
      const ratio = last / Math.max(first, 1e-30);
      return '<div class="lrrow"><span class="lrdot" style="background:' + s.a.c + '"></span>' +
        '<b>' + s.a.label + '</b><span class="lrfin mono">first layer ' + first.toExponential(1) +
        ' — that is ' + (ratio > 5 ? Math.round(ratio).toLocaleString() + '× weaker' : 'about the same as') +
        ' the last layer</span></div>';
    }).join('');
    $('#flow-note').innerHTML = C.flowNote;
  }
  depthIn.oninput = () => { draw(); xp(1); };
  draw();

  const cards = $('#init-cards');
  if (cards) C.initCards.forEach(i => {
    const c = el('div', 'init-card reveal ' + i.verdict);
    c.innerHTML = '<div class="init-tag">' + (i.verdict === 'good' ? '✓ use this' : '✗ never') + '</div>' +
      '<h3>' + i.t + '</h3><p class="pcard-desc">' + i.d + '</p>';
    cards.appendChild(c);
  });
  window.addEventListener('resize', draw);
  window.addEventListener('chapterchange', e => { if (e.detail === 'gradients') requestAnimationFrame(draw); });
}

/* ============================================================
   Ch9 — convolution, computed for real
   ============================================================ */
function initConv() {
  const root = $('#conv-demo'); if (!root) return;
  const img = C.convImage;
  let kernel = C.convKernels[0], out = null, timer = null, cursor = null;

  function gridEl(data, cls, lo, hi) {
    const box = el('div', 'pixgrid ' + (cls || ''));
    box.style.gridTemplateColumns = 'repeat(' + data[0].length + ', 1fr)';
    data.forEach((row, y) => row.forEach((v, x) => {
      const c = el('div', 'pix');
      const t = hi === lo ? 0 : (v - lo) / (hi - lo);
      c.style.background = v >= 0
        ? 'rgba(226,232,255,' + (0.06 + t * 0.94) + ')'
        : 'rgba(251,113,133,' + (0.1 + Math.min(1, Math.abs(v) / Math.max(1e-6, Math.abs(lo))) * 0.8) + ')';
      c.dataset.x = x; c.dataset.y = y;
      c.title = fmt(v, 2);
      box.appendChild(c);
    }));
    return box;
  }
  function compute() {
    out = convolve(img, kernel.k);
    render();
  }
  function render() {
    const flat = out.reduce((a, r) => a.concat(r), []);
    const lo = Math.min.apply(null, flat), hi = Math.max.apply(null, flat);
    const inBox = $('#conv-in', root), outBox = $('#conv-out', root), kBox = $('#conv-kernel', root);
    inBox.innerHTML = ''; outBox.innerHTML = ''; kBox.innerHTML = '';
    inBox.appendChild(gridEl(img, 'in', 0, 1));
    outBox.appendChild(gridEl(out, 'out', lo, hi));

    const kb = el('div', 'pixgrid kern');
    kb.style.gridTemplateColumns = 'repeat(3, 1fr)';
    kernel.k.forEach(row => row.forEach(v => {
      const c = el('div', 'pix kv mono', fmt(v, v % 1 === 0 ? 0 : 2));
      c.style.background = v > 0 ? 'rgba(52,211,153,' + Math.min(.6, Math.abs(v) / 3 + .12) + ')'
                        : v < 0 ? 'rgba(251,113,133,' + Math.min(.6, Math.abs(v) / 3 + .12) + ')'
                                : 'rgba(255,255,255,.05)';
      kb.appendChild(c);
    }));
    kBox.appendChild(kb);
    $('#conv-sizes', root).innerHTML =
      '<span class="mono">' + img.length + '×' + img[0].length + '</span> input · ' +
      '<span class="mono">3×3</span> kernel · no padding, stride 1 → ' +
      '<span class="mono">' + out.length + '×' + out[0].length + '</span> output';
    $('#conv-why', root).innerHTML = kernel.why;
    if (cursor) paintCursor(cursor[0], cursor[1]);
  }
  function paintCursor(cx, cy) {
    $$('#conv-in .pix', root).forEach(p => p.classList.remove('lit'));
    $$('#conv-out .pix', root).forEach(p => p.classList.remove('lit'));
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const p = $('#conv-in .pix[data-x="' + (cx + dx) + '"][data-y="' + (cy + dy) + '"]', root);
      if (p) p.classList.add('lit');
    }
    const o = $('#conv-out .pix[data-x="' + cx + '"][data-y="' + cy + '"]', root);
    if (o) o.classList.add('lit');
    // show the arithmetic for this exact window
    let terms = [], sum = 0;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const v = img[cy + dy][cx + dx], k = kernel.k[dy][dx];
      sum += v * k;
      if (v !== 0 && k !== 0) terms.push(fmt(v, 0) + '×' + fmt(k, k % 1 === 0 ? 0 : 2));
    }
    $('#conv-math', root).textContent = 'output[' + cy + '][' + cx + '] = ' +
      (terms.length ? terms.join(' + ') : '0') + ' = ' + fmt(sum, 2);
  }
  function sweep() {
    if (timer) { clearInterval(timer); timer = null; $('#conv-go', root).innerHTML = '▶ Slide the kernel'; return; }
    let i = 0;
    const H = out.length, W = out[0].length;
    $('#conv-go', root).innerHTML = '❚❚ Pause';
    timer = setInterval(() => {
      if (i >= H * W) {
        clearInterval(timer); timer = null;
        $('#conv-go', root).innerHTML = '▶ Slide the kernel';
        xp(5, '+5 XP — that sweep is one convolutional layer');
        return;
      }
      cursor = [i % W, Math.floor(i / W)];
      paintCursor(cursor[0], cursor[1]);
      i++;
    }, reduced() ? 1 : 42);
  }

  const row = $('#conv-kernels', root);
  C.convKernels.forEach((k, i) => {
    const b = el('button', 'chip' + (i ? '' : ' active'), k.t);
    b.onclick = () => {
      $$('.chip', row).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); kernel = k; compute(); xp(1);
    };
    row.appendChild(b);
  });
  $('#conv-go', root).onclick = sweep;
  $('#conv-pool', root).onclick = () => {
    const pooled = maxPool(relu2d(out), 2);
    const flat = pooled.reduce((a, r) => a.concat(r), []);
    const box = $('#conv-pooled', root);
    box.innerHTML = '';
    box.appendChild(gridEl(pooled, 'out', Math.min.apply(null, flat), Math.max.apply(null, flat)));
    $('#conv-pool-note', root).innerHTML =
      'ReLU zeroed every negative response, then 2×2 max pooling kept the strongest value in each block: <span class="mono">' +
      out.length + '×' + out[0].length + '</span> → <span class="mono">' + pooled.length + '×' + pooled[0].length +
      '</span>. A quarter of the numbers, none of the parameters, and the strongest evidence survives.';
    xp(3);
  };
  compute();

  const stack = $('#cnn-stack');
  if (stack) C.cnnStack.forEach((s, i) => {
    const c = el('div', 'stack-row reveal');
    c.innerHTML = '<span class="stack-n">' + (i + 1) + '</span><div><b>' + s.t + '</b>' +
      '<p>' + s.d + '</p><span class="stack-note">' + s.n + '</span></div>';
    stack.appendChild(c);
  });
  const why = $('#conv-why-cards');
  if (why) C.convWhy.forEach(w => {
    const c = el('div', 'pcard reveal');
    c.innerHTML = '<h3>' + w.t + '</h3><p class="pcard-desc">' + w.d + '</p>';
    why.appendChild(c);
  });
  const cmp = $('#param-compare');
  if (cmp) {
    const dense = denseParams(28, 28, 128), conv = convParams(3, 3, 32, 1);
    cmp.innerHTML =
      '<div class="pc-row"><b>Dense</b><span class="mono">28×28 → 128 units</span>' +
      '<span class="pc-n bad">' + dense.toLocaleString() + ' parameters</span></div>' +
      '<div class="pc-row"><b>Conv</b><span class="mono">32 filters of 3×3×1</span>' +
      '<span class="pc-n good">' + conv.toLocaleString() + ' parameters</span></div>' +
      '<div class="pc-foot">The conv layer produces 32 feature maps covering the whole image with ' +
      Math.round(dense / conv) + '× fewer parameters — and unlike the dense layer, it works just as well ' +
      'when the object moves.</div>';
  }
}

/* ============================================================
   Ch10/11 — sequences and practice
   ============================================================ */
function initSeq() {
  const root = $('#seq-cards'); if (!root) return;
  C.seqCards.forEach(s => {
    const c = el('div', 'seq-card reveal');
    c.innerHTML = '<div class="seq-head"><span class="seq-ico">' + s.ico + '</span>' +
      '<div><h3>' + s.t + '</h3><span class="seq-era">' + s.era + '</span></div></div>' +
      '<p class="pcard-desc">' + s.d + '</p>' +
      '<div class="seq-fail"><b>Where it runs out:</b> ' + s.fail + '</div>';
    root.appendChild(c);
  });
  const note = $('#attention-note');
  if (note) note.innerHTML = C.attentionNote;
}

function initDebug() {
  const root = $('#debug-table'); if (!root) return;
  root.innerHTML = '<table class="dt"><thead><tr><th>symptom</th><th>where to look first</th></tr></thead><tbody>' +
    C.debugChecklist.map(d => '<tr><td><b>' + d.s + '</b></td><td>' + d.fix + '</td></tr>').join('') +
    '</tbody></table>';
  const rules = $('#sanity-rules');
  if (rules) rules.innerHTML = C.sanityRules.map(r => '<li>' + r + '</li>').join('');
  const code = $('#framework-code');
  if (code) code.textContent = C.frameworkCode;
  const fnote = $('#framework-note');
  if (fnote) fnote.innerHTML = C.frameworkNote;
}

/* ============================================================
   Ch12 — quiz + glossary
   ============================================================ */
function initQuiz() {
  const root = $('#quiz'); if (!root) return;
  const answered = new Set(); let correct = 0;

  C.quiz.forEach((q, i) => {
    const box = el('div', 'quiz-q',
      '<div class="quiz-n">Question ' + (i + 1) + ' of ' + C.quiz.length + '</div><div class="quiz-t">' + q.q + '</div>');
    const opts = el('div', 'quiz-opts');
    q.o.forEach((o, oi) => {
      const b = el('button', 'qopt', o);
      b.onclick = () => {
        if (answered.has(i)) return;
        answered.add(i);
        $$('.qopt', opts).forEach((x, xi) => { x.disabled = true; if (xi === q.a) x.classList.add('correct'); });
        if (oi !== q.a) b.classList.add('incorrect'); else { correct++; xp(5); }
        $('.quiz-exp', box).classList.add('show');
        if (answered.size === C.quiz.length) finish();
      };
      opts.appendChild(b);
    });
    box.appendChild(opts);
    box.appendChild(el('div', 'quiz-exp', '<b>Why:</b> ' + q.e));
    root.appendChild(box);
  });
  const result = el('div'); root.appendChild(result);

  function finish() {
    const pct = Math.round(correct / C.quiz.length * 100);
    const msg = pct === 100 ? 'Perfect. You could debug someone else\'s training run.'
      : pct >= 75 ? 'Strong. The mechanics and the failure modes are both there.'
      : pct >= 50 ? 'Solid start — revisit the chapters behind the misses.'
      : 'Worth another pass. Chapters 3, 5 and 8 carry most of the weight.';
    result.innerHTML = '<div class="quiz-result"><h3>' + correct + ' / ' + C.quiz.length + ' &nbsp;·&nbsp; ' + pct + '%</h3><p>' + msg + '</p></div>';
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    xp(25, '🏁 Course complete — ' + pct + '%');
  }

  const g = $('#glossary'), search = $('#gloss-search');
  function renderG(filter) {
    const f = (filter || '').toLowerCase();
    g.innerHTML = C.glossary
      .filter(t => !f || t[0].toLowerCase().includes(f) || t[1].toLowerCase().includes(f))
      .map(t => '<div class="gterm"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>').join('')
      || '<p class="panel-sub">No match.</p>';
  }
  search.oninput = () => renderG(search.value);
  renderG('');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  [initBackground, initNeuron, initActivations, initXor, initWalk, initBackpropWalk,
   initMoons, initLR, initReg, initFlow, initConv, initSeq, initDebug, initQuiz]
    .forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
});
})();
