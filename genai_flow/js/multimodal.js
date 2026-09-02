/* ============================================================
   multimodal.js — the chapter that was missing.

   Two self-mounting widgets:
     #mmfuse  the five fusion architectures, side by side
     #mmtask  which modality goes in, which comes out, and what
              the task is actually called

   Data and rendering live together because nothing else in the
   course needs them. test.js loads this file and checks the data.
   ============================================================ */
window.MM = {

/* ---------- how a multimodal model is wired ---------- */
fusion: [
  { id: 'early', n: 'Early fusion', ico: '⊕', c: '#60a5fa',
    one: 'Concatenate the raw inputs, or their patch embeddings, right at the start and let one network process everything together.',
    how: 'Image patches and text tokens become one sequence before layer 1. The model has no notion of which token came from where beyond a modality embedding.',
    pro: ['Interactions between modalities can be learned at every depth',
          'One network, one set of weights, conceptually simple',
          'Nothing is lost to a bottleneck before the model sees it'],
    con: ['Needs paired data for everything, and lots of it',
          'Expensive: the sequence is the sum of all modalities',
          'Cannot reuse a strong unimodal model you already have'],
    ex: 'Natively multimodal frontier models, where text, image and audio share the same trunk.' },

  { id: 'late', n: 'Late fusion', ico: '⊞', c: '#34d399',
    one: 'Run each modality through its own encoder, then combine the resulting vectors near the end.',
    how: 'An image encoder and a text encoder each produce one embedding; the two are compared or concatenated for the final decision.',
    pro: ['Each encoder can be trained and reused independently',
          'Cheap — encoders run in parallel and outputs are small',
          'Missing a modality degrades gracefully rather than failing'],
    con: ['Fine-grained interaction is impossible: the model never sees the pixels beside the words',
          'A single vector per modality is a hard bottleneck',
          'Poor at questions about a specific region of an image'],
    ex: 'CLIP-style retrieval: embed image and text separately, match by distance.' },

  { id: 'cross', n: 'Cross-attention', ico: '⇄', c: '#7c5cff',
    one: 'Keep separate encoders, but let one modality attend into the other inside the network. The dominant design.',
    how: 'A vision encoder produces a grid of features; the language model attends to that grid at several layers while generating text.',
    pro: ['Fine-grained grounding: a word can attend to one region',
          'Reuses strong pretrained unimodal models',
          'Only the cross-attention layers need training'],
    con: ['More parameters and more compute than late fusion',
          'Where to insert the cross-attention is a real design decision',
          'Harder to debug: attribution spans two networks'],
    ex: 'The standard vision-language architecture, and how most image-question answering works.' },

  { id: 'adapter', n: 'Adapter / projection bridge', ico: '→', c: '#fbbf24',
    one: 'Freeze both models and train only a small projector that maps one modality into the other one\'s embedding space.',
    how: 'A vision encoder output is projected into the language model\'s token space and prepended as if it were a handful of tokens.',
    pro: ['By far the cheapest to train — often a single small network',
          'Both base models stay frozen and reusable',
          'The practical way most open multimodal models are built'],
    con: ['The projector is a bottleneck; detail is lost crossing it',
          'Quality is capped by whichever base model is weaker',
          'Needs the language model to tolerate foreign embeddings'],
    ex: 'LLaVA-style models: a vision encoder, a projection layer, and an off-the-shelf LLM.' },

  { id: 'moe', n: 'Mixture of experts', ico: '⋔', c: '#f472b6',
    one: 'Different expert sub-networks specialise by modality or by content, and a router picks which few to activate.',
    how: 'Routing sends image tokens to some experts and text tokens to others, so capacity grows without every parameter running per token.',
    pro: ['Large total capacity at small per-token compute',
          'Experts can specialise by modality without a hand-designed split',
          'Adding a modality need not slow the existing ones'],
    con: ['Routing instability and load imbalance are real engineering problems',
          'All experts must be held in memory even though few run',
          'Hard to reason about and harder to debug'],
    ex: 'Large frontier models where parameter count far exceeds active compute per token.' }
],

/* ---------- what you can actually ask for ---------- */
tasks: [
  { t: 'Image captioning',        i: 'image',        o: 'text',  ex: 'Describe what is in this photograph.' },
  { t: 'Visual question answering', i: 'image + text', o: 'text', ex: 'How many people are wearing hard hats?' },
  { t: 'Document understanding',  i: 'image / PDF',  o: 'text / JSON', ex: 'Extract the line items and totals from this invoice.' },
  { t: 'Chart reasoning',         i: 'chart image',  o: 'text',  ex: 'Which quarter did revenue first exceed costs?' },
  { t: 'Video understanding',     i: 'video',        o: 'text',  ex: 'Summarise what happens in this recording.' },
  { t: 'Speech transcription',    i: 'audio',        o: 'text',  ex: 'Transcribe this call, with speaker labels.' },
  { t: 'Text to image',           i: 'text',         o: 'image', ex: 'A cutaway diagram of a heat pump, isometric.' },
  { t: 'Text to speech',          i: 'text',         o: 'audio', ex: 'Read this paragraph in a calm voice.' },
  { t: 'Text to video',           i: 'text',         o: 'video', ex: 'A drone shot over a coastline at sunrise.' },
  { t: 'OCR and layout',          i: 'scan',         o: 'structured text', ex: 'Read this scanned form into fields.' }
],

/* ---------- what actually goes wrong ---------- */
risks: [
  ['Cost per request',    'An image is worth hundreds to thousands of tokens. A page of screenshots can cost more than a long document.',
   'Resize before sending, and check whether the detail setting the API offers is actually needed.'],
  ['Silent OCR failure',  'The model reads a number wrongly from a low-resolution table and reports it with complete confidence.',
   'Ask for the source region alongside the value, and validate numbers against a total where one exists.'],
  ['Modality-crossing injection', 'Text hidden inside an image — small print, a watermark, a screenshot of a prompt — is instruction the model may follow.',
   'Treat everything read out of an image as untrusted data, exactly like a retrieved document.'],
  ['Alignment across time', 'Audio and video must be aligned to the same clock, or a summary attributes the wrong words to the wrong moment.',
   'Chunk on natural boundaries and carry timestamps through the pipeline as metadata.'],
  ['Evaluation is harder', 'There is no exact-match answer for a caption or a generated image, so scoring is judgement.',
   'Build a small human-labelled set first, then calibrate an LLM judge against it.']
]
};

/* ============================================================
   rendering
   ============================================================ */
(function () {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const xp = n => window.awardXP && window.awardXP(n);

/* ---------- fusion architectures ---------- */
(function fuse() {
  const root = $('#mmfuse'); if (!root) return;
  root.innerHTML = '<div class="chip-row" id="mf-chips"></div><div class="mf-panel" id="mf-panel"></div>';
  const chips = $('#mf-chips'), panel = $('#mf-panel');

  MM.fusion.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'chip' + (i === 0 ? ' active' : '');
    b.innerHTML = f.ico + ' ' + f.n;
    b.onclick = () => {
      Array.from(chips.children).forEach(c => c.classList.remove('active'));
      b.classList.add('active'); show(f); xp(1);
    };
    chips.appendChild(b);
  });

  function diagram(f) {
    /* a small schematic per architecture — where the two streams meet */
    const meet = { early: 0.16, late: 0.84, cross: 0.5, adapter: 0.34, moe: 0.5 }[f.id];
    const x = 60 + meet * 250;
    let g = '<rect x="14" y="16" width="392" height="120" class="mv-plot"/>';
    g += '<rect x="20" y="30" width="44" height="30" rx="7" class="mf-box"/><text x="42" y="50" class="mf-t">🖼 image</text>';
    g += '<rect x="20" y="90" width="44" height="30" rx="7" class="mf-box"/><text x="42" y="110" class="mf-t">📝 text</text>';
    g += '<path d="M64 45 L' + x + ' 45" class="mf-wire" style="stroke:' + f.c + '"/>';
    g += '<path d="M64 105 L' + x + ' 105" class="mf-wire" style="stroke:' + f.c + '"/>';
    g += '<path d="M' + x + ' 45 L' + (x + 22) + ' 75 L' + x + ' 105" class="mf-wire" style="stroke:' + f.c + '"/>';
    g += '<circle cx="' + x + '" cy="75" r="15" fill="' + f.c + '33" stroke="' + f.c + '"/>';
    g += '<text x="' + x + '" y="80" class="mf-join">' + f.ico + '</text>';
    g += '<path d="M' + (x + 15) + ' 75 L340 75" class="mf-wire" style="stroke:' + f.c + '"/>';
    g += '<rect x="340" y="60" width="58" height="30" rx="7" class="mf-box"/><text x="369" y="80" class="mf-t">output</text>';
    g += '<text x="' + x + '" y="' + (meet < 0.4 ? 26 : 132) + '" class="mv-lbl">they meet here</text>';
    return '<svg viewBox="0 0 420 150" class="mf-svg">' + g + '</svg>';
  }

  function show(f) {
    panel.style.setProperty('--c', f.c);
    panel.innerHTML =
      '<div class="mf-h"><span class="mf-ico" style="background:' + f.c + '2a">' + f.ico + '</span>' +
        '<div><b>' + f.n + '</b><span>' + f.one + '</span></div></div>' +
      diagram(f) +
      '<p class="mf-how"><b>How it is wired.</b> ' + f.how + '</p>' +
      '<div class="ts-pc">' +
        '<div class="ts-pro"><h6>advantages</h6><ul>' + f.pro.map(p => '<li>' + p + '</li>').join('') + '</ul></div>' +
        '<div class="ts-con"><h6>drawbacks</h6><ul>' + f.con.map(p => '<li>' + p + '</li>').join('') + '</ul></div>' +
      '</div>' +
      '<div class="mf-ex"><b>Where you see it</b>' + f.ex + '</div>';
    panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
  }
  show(MM.fusion[0]);
})();

/* ---------- task matrix ---------- */
(function tasks() {
  const root = $('#mmtask'); if (!root) return;
  root.innerHTML =
    '<div class="procon-wrap"><table class="procon"><thead><tr>' +
      '<th>Task</th><th>Input</th><th>Output</th><th>What someone actually asks</th>' +
    '</tr></thead><tbody>' +
    MM.tasks.map(t =>
      '<tr><td>' + t.t + '</td><td><span class="mm-pill">' + t.i + '</span></td>' +
      '<td><span class="mm-pill out">' + t.o + '</span></td><td>' + t.ex + '</td></tr>').join('') +
    '</tbody></table></div>';
})();

/* ---------- risks ---------- */
(function risks() {
  const root = $('#mmrisk'); if (!root) return;
  root.innerHTML =
    '<div class="procon-wrap"><table class="procon"><thead><tr>' +
      '<th>What goes wrong</th><th class="con">Why</th><th class="pro">What to do about it</th>' +
    '</tr></thead><tbody>' +
    MM.risks.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') +
    '</tbody></table></div>';
})();
})();
