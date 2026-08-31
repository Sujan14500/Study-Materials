/* JLPT N5/N4 trainer - vanilla JS, no deps, works from file:// */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------- kana to romaji ---------- */
// the lookup table is the kana deck itself, so adding a kana row teaches the converter too
const ROMAJI = {};
for (const [c, r] of DATA_KANA) {
  const clean = r.replace(/\s*\(.*\)$/, '');          // "wo (o)" -> "wo"
  if (/^[a-z]+$/.test(clean)) ROMAJI[c] = clean;      // skips "long vowel mark"
}
// Returns '' for anything holding kanji: a kanji has no reading we can derive here, and half
// romanised text would be worse than none. Everything we call it on is a reading, so that is rare.
function romaji(s) {
  if (!s || s === '-') return '';
  let out = '';
  for (let i = 0; i < s.length;) {
    const two = s.substr(i, 2);
    // youon first (きゃ before き); the length guard stops a 1-char tail matching here
    if (two.length === 2 && ROMAJI[two]) { out += ROMAJI[two]; i += 2; continue; }
    const ch = s[i], next = ROMAJI[s.substr(i + 1, 2)] || ROMAJI[s[i + 1]] || '';
    const after = s[i + 1];
    // Particles are pronounced away from their spelling. を is only ever the object particle, so it
    // is unconditional; は and へ are ordinary syllables inside words, so they only count as
    // particles when a space follows -- which is how the readings in data/ are written.
    // ponytail: a heuristic, not a tokeniser. Space the particle in the reading if one reads wrong.
    // padded so the particle detaches as its own word; the trailing collapse tidies up
    if (ch === 'を' || ch === 'ヲ') { out += ' o '; i++; continue; }
    if ((ch === 'は' || ch === 'へ') && (after === undefined || /\s/.test(after))) {
      out += ch === 'は' ? ' wa ' : ' e '; i++; continue;
    }
    if (ch === '、') { out += ', '; i++; continue; }
    if (ch === '。') { out += '.'; i++; continue; }
    if (ch === 'っ' || ch === 'ッ') {                  // sokuon doubles the next consonant
      out += next.startsWith('ch') ? 't' : (next[0] || '');
      i++; continue;
    }
    if (ch === 'ん' || ch === 'ン') {                  // kin'en, not kinen
      out += /^[aiueoy]/.test(next) ? "n'" : 'n';
      i++; continue;
    }
    if (ch === 'ー') { out += out.slice(-1); i++; continue; }
    if (ROMAJI[ch]) { out += ROMAJI[ch]; i++; continue; }
    if (ch === '・') { out += ' / '; i++; continue; }
    if (/[\sA-Za-z0-9\/\-~+()「」]/.test(ch)) { out += ch; i++; continue; }
    return '';
  }
  return out.replace(/\s+/g, ' ').replace(/ ([,.])/g, '$1').trim();
}

/* ---------- unify every deck into one card shape ---------- */
// {id, kind, level, front, sub, back, extra, rom}
const KANA = DATA_KANA.map(([c, r, s]) => ({
  id: 'a' + c, kind: 'kana', level: 'N5', front: c, sub: '', back: r, rom: '',
  extra: s === 'h' ? 'hiragana' : 'katakana', script: s
}));
const KANJI = DATA_KANJI.map(([c, m, on, kun, lv]) => ({
  id: 'k' + c, kind: 'kanji', level: lv, front: c, sub: '', back: m,
  extra: 'on ' + on + '　kun ' + kun, on, kun, tip: DATA_MNEMONIC[c] || '',
  rom: [romaji(on) && 'on ' + romaji(on), romaji(kun) && 'kun ' + romaji(kun)].filter(Boolean).join('　')
}));
// a word listed at both levels keeps its first (lower) level, so ids stay unique
const seenVocab = new Set();
const VOCAB = DATA_VOCAB.map(([w, r, m, lv, pos]) => ({
  id: 'v' + w + r, kind: 'vocab', level: lv, front: w, sub: r, back: m, extra: pos, pos,
  rom: romaji(r)
})).filter(c => !seenVocab.has(c.id) && seenVocab.add(c.id));
const GRAMMAR = DATA_GRAMMAR.map(([p, m, jp, en, lv]) => {
  // example sentences hold kanji, so their reading is stored rather than derived
  const [patKana, jpKana] = DATA_GRAMMAR_READING[p] || ['', ''];
  const jpRom = romaji(jpKana);
  return {
    id: 'g' + p, kind: 'grammar', level: lv, front: p, sub: '', back: m,
    jp, en, kana: jpKana, jpRom,
    rom: romaji((patKana || p).replace(/〜/g, '~')),
    extra: [jp, jpKana, jpRom, en].filter(Boolean).join('\n')
  };
});
const DECKS = { kana: KANA, kanji: KANJI, vocab: VOCAB, grammar: GRAMMAR };
const ALL = [...KANA, ...KANJI, ...VOCAB, ...GRAMMAR];
const BY_ID = Object.fromEntries(ALL.map(c => [c.id, c]));

/* ---------- persistence ---------- */
const KEY = 'jlpt-trainer-v1';
const BOX_DAYS = [0, 1, 2, 4, 8, 16];      // box index -> days until next review
const MASTER_BOX = 4;                       // box >= this counts as mastered
const DAY = 864e5;
const today = () => new Date().toISOString().slice(0, 10);

let S = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.srs) return s;
  } catch (e) { /* corrupt or unavailable -> fresh */ }
  return { srs: {}, streak: 0, last: '', hist: {}, reviews: 0 };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
}
function touchStreak() {
  const t = today();
  if (S.last === t) return;
  const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  S.streak = S.last === y ? S.streak + 1 : 1;
  S.last = t;
  save();
}

/* pure so the self-test can call it directly */
function nextBox(box, grade) {
  if (grade === 'again') return 0;
  if (grade === 'easy') return Math.min(box + 2, BOX_DAYS.length - 1);
  return Math.min(box + 1, BOX_DAYS.length - 1);
}
function grade(id, g) {
  const r = S.srs[id] || { b: 0, d: 0, s: 0, o: 0 };
  r.b = nextBox(r.b, g);
  r.d = Date.now() + BOX_DAYS[r.b] * DAY;
  r.s++;
  if (g !== 'again') r.o++;
  S.srs[id] = r;
  S.reviews++;
  S.hist[today()] = (S.hist[today()] || 0) + 1;
  touchStreak();
  save();
}
const isDue = c => { const r = S.srs[c.id]; return r && r.d <= Date.now(); };
const isNew = c => !S.srs[c.id];
const mastered = c => (S.srs[c.id] || {}).b >= MASTER_BOX;
const dueCount = () => ALL.filter(isDue).length;

/* ---------- chrome ---------- */
const SCREENS = [
  ['home', 'Home'], ['kana', 'Kana'], ['kanji', 'Kanji'], ['vocab', 'Vocab'],
  ['grammar', 'Grammar'], ['quiz', 'Quiz'], ['exam', 'Mock exam'], ['stats', 'Progress']
];
function go(name, arg) {
  $$('.screen').forEach(s => s.classList.remove('on'));
  const target = (name === 'kanji' || name === 'vocab') ? 's-study' : 's-' + name;
  $('#' + target).classList.add('on');
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.s === name));
  ({ home: renderHome, kana: renderKana, kanji: () => renderStudy('kanji'),
     vocab: () => renderStudy('vocab'), grammar: renderGrammar, quiz: renderQuiz,
     exam: renderExam, stats: renderStats }[name])(arg);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function buildNav() {
  $('#nav').innerHTML = SCREENS.map(([k, l]) =>
    `<button data-s="${k}"${k === 'home' ? ' class="on"' : ''}>${l}</button>`).join('');
  $('#nav').onclick = e => { if (e.target.dataset.s) go(e.target.dataset.s); };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1600);
}
function burst(el) {
  const r = el.getBoundingClientRect(), cs = ['#ff5a5f', '#ffd166', '#3ddc97', '#6ea8ff'];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;` +
      `background:${rnd(cs)};--dx:${(Math.random() - .5) * 260}px;--dy:${(Math.random() - .5) * 260}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}
function chips(host, opts, sel, onPick) {
  host.innerHTML = opts.map(o =>
    `<button class="chip${sel.includes(o.v) ? ' on' : ''}" data-v="${o.v}">${o.l}</button>`).join('');
  host.onclick = e => { if (e.target.dataset.v) onPick(e.target.dataset.v); };
}
function refreshHeader() {
  $('#streak').textContent = S.streak;
  $('#dueN').textContent = dueCount();
}

/* ---------- how to remember kanji: shown above the kanji learn list ---------- */
const KANJI_TIPS = [
  ['Learn the parts, not the picture',
   'Almost every kanji is two or three reusable components. 晴 is not 12 random strokes, it is ' +
   'sun 日 plus blue 青. Name the parts and the character becomes a short sentence you can retell.'],
  ['On-yomi in compounds, kun-yomi alone',
   'A kanji standing on its own or trailing hiragana usually takes the kun-yomi: 山 やま, 食べる たべる. ' +
   'Two or more kanji stuck together usually take the on-yomi: 火山 かざん, 食事 しょくじ. ' +
   'This app prints on-yomi in katakana and kun-yomi in hiragana so you can tell them apart at a glance.'],
  ['The radical tells you the meaning family',
   '氵 water · 木 tree · 言 speech · 扌 hand · 心 and 忄 heart · 疒 illness · 金 metal · 糸 thread · ' +
   '艹 plant · 阝 place · 亻 person · 辶 movement. Meet an unknown kanji, find its radical, and you ' +
   'already have half the meaning.'],
  ['The other half often carries the sound',
   'A repeated component frequently keeps its reading across characters. 青 セイ gives 清 晴 請 セイ. ' +
   '寺 ジ gives 時 ジ, 持 ジ, 特 トク. 生 セイ gives 性 星 セイ. Spot the phonetic and you can guess ' +
   'readings for kanji you have never seen.'],
  ['Learn kanji inside words, never alone',
   'A bare kanji has no context to hang on. 生 alone means almost nothing useful; 学生, 生きる and ' +
   '生ビール each pin down one reading and one sense. Every kanji card here lists the words from the ' +
   'vocab deck that use it — read those, not just the character.'],
  ['Drill the look-alikes as pairs',
   'They are only confusing while you meet them apart: 未 / 末 · 土 / 士 · 日 / 曰 · 千 / 干 · 石 / 右 · ' +
   '大 / 犬 / 太 · 王 / 玉 · 力 / 刀 · 待 / 持 · building 建 / 健. Learn each pair side by side once and ' +
   'the confusion never forms.'],
  ['Stroke order is a compression trick',
   'Top before bottom, left before right, horizontal before vertical, outside before inside, and the ' +
   'closing stroke of a box goes last. Following it makes your hand remember the shape, and it is what ' +
   'lets handwriting recognition and dictionary lookup work.'],
  ['Write each new kanji once, by hand',
   'Recognition and recall are different skills and the exam tests both. One slow written repetition ' +
   'when you first meet a character is worth more than ten extra passive reviews later.'],
  ['Let the schedule do the remembering',
   'Grading a card Again is not failure, it is the system working: the card comes back sooner. ' +
   'Grading Easy on something you barely knew is the only way to actually lose it.']
];
const TIPS_HTML = '<div class="item tip"><div class="t"><b>Tips for remembering kanji</b>' +
  '<em>9 things worth knowing before you grind</em></div><div class="body">' +
  KANJI_TIPS.map(([h, b]) => `<p class="j">${h}</p><p class="e">${b}</p>`).join('') +
  '</div></div>';

/* ---------- home ---------- */
const TILES = [
  ['kana', 'あ', 'Kana', 'Hiragana + katakana'],
  ['kanji', '漢', 'Kanji', 'N5 + N4 characters'],
  ['vocab', '語', 'Vocabulary', 'Words with readings'],
  ['grammar', '文', 'Grammar', 'Patterns + examples'],
  ['quiz', '?', 'Quiz', 'Multiple choice'],
  ['exam', '試', 'Mock exam', 'Full timed papers'],
  ['stats', '↑', 'Progress', 'What you have mastered']
];
function pct(list) {
  return list.length ? Math.round(100 * list.filter(mastered).length / list.length) : 0;
}
function renderHome() {
  refreshHeader();
  $('#tiles').innerHTML = TILES.map(([k, ic, h, p]) => {
    const d = DECKS[k];
    return `<div class="tile" data-s="${k}"><span class="ic">${ic}</span>
      <h3>${h}</h3><p>${p}</p>
      ${d ? `<div class="bar"><i data-w="${pct(d)}"></i></div>` : ''}</div>`;
  }).join('');
  $('#tiles').onclick = e => {
    const t = e.target.closest('.tile'); if (t) go(t.dataset.s);
  };
  requestAnimationFrame(() => $$('#tiles .bar i').forEach(i => i.style.width = i.dataset.w + '%'));
}

/* ---------- kana browser ---------- */
let kanaScript = 'h';
function renderKana() {
  chips($('#kanaFilter'),
    [{ v: 'h', l: 'Hiragana' }, { v: 'k', l: 'Katakana' }], [kanaScript],
    v => { kanaScript = v; renderKana(); });
  $('#kanaFilter').insertAdjacentHTML('beforeend',
    '<button class="btn p" id="kanaDrill" style="margin-left:auto">Drill these</button>');
  $('#kanaDrill').onclick = () => startSession('kana', ['N5'], c => c.script === kanaScript);
  $('#kanaGrid').innerHTML = KANA.filter(c => c.script === kanaScript).map((c, i) =>
    `<div class="kb${mastered(c) ? ' mast' : ''}" style="animation-delay:${i * 8}ms" data-id="${c.id}">
      <div class="c">${c.front}</div><div class="r">${c.back}</div></div>`).join('');
  $('#kanaGrid').onclick = e => {
    const b = e.target.closest('.kb'); if (!b) return;
    b.style.animation = 'pop .3s'; setTimeout(() => b.style.animation = '', 300);
    toast(BY_ID[b.dataset.id].front + '  =  ' + BY_ID[b.dataset.id].back);
  };
}

/* ---------- study session (shared by kana / kanji / vocab) ---------- */
const SESSION_SIZE = 20;
let sess = null;
const LEVELS = { kanji: ['N5', 'N4'], vocab: ['N5', 'N4'], grammar: ['N5', 'N4'] };
let levelSel = { kanji: ['N5'], vocab: ['N5'], grammar: ['N5', 'N4'], quiz: ['N5'] };

function pickCards(kind, levels, filter) {
  let pool = DECKS[kind].filter(c => levels.includes(c.level) && (!filter || filter(c)));
  const due = shuffle(pool.filter(isDue));
  const fresh = pool.filter(isNew).slice(0, Math.max(0, SESSION_SIZE - due.length));
  let out = [...due.slice(0, SESSION_SIZE), ...fresh];
  if (!out.length) out = shuffle(pool).slice(0, SESSION_SIZE); // nothing due -> free review
  return out.slice(0, SESSION_SIZE);
}

let studyMode = { kanji: 'learn', vocab: 'learn' };

function renderStudy(kind) {
  sess = null; // leaving or re-filtering the screen ends any running session
  const host = $("#studyBody"), lv = levelSel[kind], mode = studyMode[kind];
  $('#studyTitle').textContent = kind === 'kanji' ? 'Kanji' : 'Vocabulary';
  $('#studySub').textContent = mode === 'learn'
    ? (kind === 'kanji'
        ? 'Tap a kanji to open its readings and the words that use it.'
        : 'Tap a word to open its part of speech and the kanji inside it.')
    : 'Space flips the card. 1 = again, 2 = good, 3 = easy.';
  const deck = DECKS[kind].filter(c => lv.includes(c.level));
  $('#studyFilter').innerHTML =
    LEVELS[kind].map(v => `<button class="chip lv${lv.includes(v) ? ' on' : ''}" data-lv="${v}">${v}</button>`).join('') +
    '<span style="width:14px"></span>' +
    [['learn', 'Learn'], ['drill', 'Drill']].map(([v, l]) =>
      `<button class="chip md${mode === v ? ' on' : ''}" data-md="${v}">${l}</button>`).join('') +
    `<span class="sub" style="margin:0 0 0 auto">${deck.length} cards &middot; ` +
    `${deck.filter(isDue).length} due &middot; ${deck.filter(mastered).length} mastered</span>`;
  $('#studyFilter').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.md) studyMode[kind] = b.dataset.md;
    else {
      const i = lv.indexOf(b.dataset.lv);
      if (i < 0) lv.push(b.dataset.lv); else if (lv.length > 1) lv.splice(i, 1);
    }
    renderStudy(kind);
  };

  if (mode === 'learn') { browse(host, deck, kind === 'kanji' ? TIPS_HTML : ''); return; }
  host.innerHTML = `<div class="row"><button class="btn p" id="start">Start session</button></div>
    <div id="sessHost"></div>`;
  $('#start').onclick = () => startSession(kind, lv);
}

// ponytail: rebuilds the whole list on every filter change. ~950 rows renders in well under a
// frame; switch to a virtual list only if the decks grow by an order of magnitude.
function browse(host, deck, prefix) {
  host.innerHTML = '<div class="list">' + (prefix || '') + deck.map(c =>
    `<div class="item"><div class="t">
      <b style="font-size:${c.kind === 'kanji' ? 30 : 17}px">${esc(c.front)}</b>
      <span class="sub" style="margin:0">${esc(c.sub || '')}</span>
      ${c.kind === 'vocab' && c.rom ? `<span class="rj">${esc(c.rom)}</span>` : ''}
      <em>${esc(c.back)}</em>
      ${mastered(c) ? '<span class="tag" style="background:#3ddc9722;color:#3ddc97">MASTERED</span>' : ''}
      <span class="tag ${c.level}">${c.level}</span></div>
      <div class="body">${studyDetail(c)}</div></div>`).join('') + '</div>';
  host.onclick = e => {
    const it = e.target.closest('.item'); if (it) it.classList.toggle('open');
  };
}

/* the example words and kanji breakdowns come from the other decks, no extra data needed */
function studyDetail(c) {
  if (c.kind === 'kanji') {
    const ex = VOCAB.filter(v => v.front.includes(c.front)).slice(0, 8);
    return `<p class="e">on&nbsp;yomi <b style="color:var(--ink)">${esc(c.on)}</b>` +
      ` <span class="rj">${esc(romaji(c.on))}</span>` +
      ` &nbsp;&middot;&nbsp; kun&nbsp;yomi <b style="color:var(--ink)">${esc(c.kun)}</b>` +
      ` <span class="rj">${esc(romaji(c.kun))}</span></p>` +
      (c.tip ? `<p class="tip">${esc(c.tip)}</p>` : '') +
      (ex.length
        ? `<p class="j">${ex.map(v =>
            `${esc(v.front)}（${esc(v.sub)}<span class="rj"> ${esc(v.rom)}</span>）${esc(v.back)}`).join('<br>')}</p>`
        : '<p class="e">No word in the vocab deck uses this kanji yet.</p>');
  }
  const parts = [...c.front].map(ch => BY_ID['k' + ch]).filter(Boolean);
  return `<p class="e">${esc(c.pos)}</p>` +
    (parts.length
      ? `<p class="j">${parts.map(k => `${esc(k.front)} = ${esc(k.back)}　[${esc(k.on)} / ${esc(k.kun)}]` +
          `<span class="rj">　${esc(k.rom)}</span>`).join('<br>')}</p>`
      : '<p class="e">Written in kana only.</p>');
}

function startSession(kind, levels, filter) {
  const cards = pickCards(kind, levels, filter);
  if (!cards.length) { toast('No cards for that filter'); return; }
  sess = { kind, cards, i: 0, right: 0, flipped: false };
  if (kind === 'kana') { go('kana'); $('#kanaGrid').innerHTML = ''; }
  drawCard();
}

function sessHost() {
  // a kana drill runs on the kana screen; #sessHost may still exist on the hidden study screen
  if (sess && sess.kind === 'kana') return $('#kanaGrid');
  return $('#sessHost') || $('#studyBody');
}

function drawCard() {
  const h = sessHost();
  if (sess.i >= sess.cards.length) {
    h.innerHTML = `<div class="done"><div class="big">\u{1F389}</div>
      <h2>${sess.right} / ${sess.cards.length} on the first try</h2>
      <p class="sub">Streak ${S.streak} days &middot; ${dueCount()} cards still due</p>
      <button class="btn p" id="again">Another session</button></div>`;
    const kind = sess.kind, lv = levelSel[kind] || ['N5'];
    $('#again').onclick = () => startSession(kind, lv);
    refreshHeader();
    sess = null;
    return;
  }
  const c = sess.cards[sess.i], n = sess.cards.length;
  const box = (S.srs[c.id] || {}).b || 0;
  h.innerHTML = `
    <div class="meta"><span>${sess.i + 1} / ${n}</span>
      <span>${c.level} ${c.kind} &middot; box ${box}/${BOX_DAYS.length - 1}</span></div>
    <div class="prog"><i style="width:${100 * sess.i / n}%"></i></div>
    <div class="stage shell" id="shell"><div class="card" id="card">
      <div class="face">
        <div class="big${c.front.length > 3 ? ' sm' : ''}">${esc(c.front)}</div>
        <div class="hint">tap or press space</div>
      </div>
      <div class="face back">
        ${c.sub ? `<div class="mid">${esc(c.sub)}</div>` : ''}
        ${c.rom && c.sub ? `<div class="rj">${esc(c.rom)}</div>` : ''}
        <div class="mean">${esc(c.back)}</div>
        ${c.extra ? `<div class="ex">${esc(c.extra).replace(/\n/g, '<br>')}</div>` : ''}
        ${c.rom && !c.sub ? `<div class="rj">${esc(c.rom)}</div>` : ''}
        ${c.tip ? `<div class="ex tip">${esc(c.tip)}</div>` : ''}
      </div>
    </div></div>
    <div class="row" id="ctl"><button class="btn p" data-g="show">Show answer</button></div>`;
  $('#card').onclick = flip;
  $('#ctl').onclick = e => { if (e.target.dataset.g) answer(e.target.dataset.g); };
}

function flip() {
  if (!sess || sess.flipped) return;
  sess.flipped = true;
  $('#card').classList.add('flip');
  $('#ctl').innerHTML =
    `<button class="btn r" data-g="again">1 &middot; Again</button>
     <button class="btn" data-g="good">2 &middot; Good</button>
     <button class="btn g" data-g="easy">3 &middot; Easy</button>`;
}

function answer(g) {
  if (!sess) return;
  if (g === 'show') return flip();
  if (!sess.flipped) return;
  const c = sess.cards[sess.i];
  grade(c.id, g);
  const shell = $('#shell');
  if (g === 'again') { shell.classList.add('no'); }
  else { shell.classList.add('ok'); sess.right++; burst($('#card')); }
  if (g === 'again') sess.cards.push(c);           // wrong cards come back this session
  setTimeout(() => { sess.i++; sess.flipped = false; drawCard(); refreshHeader(); }, 380);
}

document.addEventListener('keydown', e => {
  if (!sess) return;
  if (e.key === ' ') { e.preventDefault(); sess.flipped ? answer('good') : flip(); }
  if (e.key === '1') answer('again');
  if (e.key === '2') answer('good');
  if (e.key === '3') answer('easy');
});

/* ---------- grammar ---------- */
function renderGrammar() {
  const lv = levelSel.grammar;
  chips($('#gFilter'), [{ v: 'N5', l: 'N5' }, { v: 'N4', l: 'N4' }], lv, v => {
    const i = lv.indexOf(v);
    if (i < 0) lv.push(v); else if (lv.length > 1) lv.splice(i, 1);
    renderGrammar();
  });
  $('#gFilter').insertAdjacentHTML('beforeend',
    '<button class="btn p" id="gDrill" style="margin-left:auto">Drill as flashcards</button>');
  $('#gDrill').onclick = () => {
    // swap to the study screen first so the session renders into the right host
    $('#s-grammar').classList.remove('on');
    $('#s-study').classList.add('on');
    $('#studyTitle').textContent = 'Grammar drill';
    $('#studySub').textContent = 'Space flips the card. 1 = again, 2 = good, 3 = easy.';
    $('#studyFilter').innerHTML = '';
    $('#studyBody').innerHTML = '<div id="sessHost"></div>';
    startSession('grammar', lv);
  };
  const rows = GRAMMAR.filter(g => lv.includes(g.level));
  $('#gList').innerHTML = rows.map(g =>
    `<div class="item"><div class="t"><b>${esc(g.front)}</b>
      ${g.rom ? `<span class="rj">${esc(g.rom)}</span>` : ''}
      <em>${esc(g.back)}</em><span class="tag ${g.level}">${g.level}</span></div>
      <div class="body"><p class="j">${esc(g.jp)}</p>
      ${g.kana ? `<p class="e">${esc(g.kana)}</p>` : ''}
      ${g.jpRom ? `<p class="rj">${esc(g.jpRom)}</p>` : ''}
      <p class="e">${esc(g.en)}</p></div></div>`).join('');
  $('#gList').onclick = e => {
    const it = e.target.closest('.item'); if (it) it.classList.toggle('open');
  };
}

/* ---------- quiz ---------- */
let qKind = 'vocab', quiz = null;
function makeQuestion(kind, levels) {
  const pool = DECKS[kind].filter(c => levels.includes(c.level));
  const c = rnd(pool);
  // distractors must differ from the answer AND from each other:
  // ぢ and じ are different cards but both read "ji"
  const used = new Set([c.back]), wrong = [];
  for (const x of shuffle(pool)) {
    if (wrong.length === 3) break;
    if (used.has(x.back)) continue;
    used.add(x.back);
    wrong.push(x);
  }
  return { card: c, opts: shuffle([c, ...wrong]) };
}
function renderQuiz() {
  const lv = levelSel.quiz;
  chips($('#qFilter'),
    [{ v: 'kana', l: 'Kana' }, { v: 'kanji', l: 'Kanji' },
     { v: 'vocab', l: 'Vocab' }, { v: 'grammar', l: 'Grammar' }], [qKind],
    v => { qKind = v; renderQuiz(); });
  $('#qFilter').insertAdjacentHTML('beforeend',
    `<span style="margin-left:auto"></span>` +
    ['N5', 'N4'].map(v =>
      `<button class="chip lv${lv.includes(v) ? ' on' : ''}" data-lv="${v}">${v}</button>`).join(''));
  $$('#qFilter .lv').forEach(b => b.onclick = () => {
    const i = lv.indexOf(b.dataset.lv);
    if (i < 0) lv.push(b.dataset.lv); else if (lv.length > 1) lv.splice(i, 1);
    renderQuiz();
  });
  quiz = { n: 0, right: 0, total: 10 };
  nextQ();
}
function nextQ() {
  const body = $('#quizBody');
  if (quiz.n >= quiz.total) {
    const p = Math.round(100 * quiz.right / quiz.total);
    body.innerHTML = `<div class="done"><div class="big">${p >= 80 ? '\u{1F3AF}' : '\u{1F4AA}'}</div>
      <h2>${quiz.right} / ${quiz.total} correct</h2>
      <p class="sub">${p >= 80 ? 'Exam-ready on this deck.' : 'Run it again, the weak ones repeat.'}</p>
      <button class="btn p" id="qAgain">Play again</button></div>`;
    $('#qAgain').onclick = renderQuiz;
    return;
  }
  const kindPool = DECKS[qKind].filter(c => levelSel.quiz.includes(c.level));
  if (kindPool.length < 4) { body.innerHTML = '<p class="sub">Pick more levels.</p>'; return; }
  const q = makeQuestion(qKind, levelSel.quiz);
  body.innerHTML = `
    <div class="meta"><span>${quiz.n + 1} / ${quiz.total}</span><span>${quiz.right} correct</span></div>
    <div class="prog"><i style="width:${100 * quiz.n / quiz.total}%"></i></div>
    <div class="qbox"><div class="q">${esc(q.card.front)}</div>
      ${q.card.sub ? `<div class="qs">${esc(q.card.sub)}</div>` : ''}
      ${q.card.rom ? `<div class="rj">${esc(q.card.rom)}</div>` : ''}</div>
    <div class="opts">${q.opts.map(o =>
      `<button class="opt" data-id="${o.id}">${esc(o.back)}</button>`).join('')}</div>`;
  $('.opts').onclick = e => {
    const b = e.target.closest('.opt'); if (!b || b.disabled) return;
    $$('.opt').forEach(x => x.disabled = true);
    const ok = b.dataset.id === q.card.id;
    $$('.opt').forEach(x => { if (x.dataset.id === q.card.id) x.classList.add('good'); });
    if (!ok) b.classList.add('bad'); else { quiz.right++; burst(b); }
    grade(q.card.id, ok ? 'good' : 'again');
    quiz.n++;
    refreshHeader();
    setTimeout(nextQ, ok ? 500 : 1100);
  };
}

/* ---------- stats ---------- */
function renderStats() {
  refreshHeader();
  const all = ALL, done = all.filter(mastered).length;
  const p = Math.round(100 * done / all.length);
  $('#ringPct').textContent = p + '%';
  requestAnimationFrame(() => $('#ringFg').style.strokeDashoffset = 339 * (1 - p / 100));
  const seen = Object.keys(S.srs).length;
  $('#statGrid').innerHTML = [
    [done, 'mastered'], [seen, 'cards started'], [all.length - seen, 'not seen yet'],
    [dueCount(), 'due now'], [S.reviews || 0, 'total reviews'], [S.streak, 'day streak']
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  const rows = [];
  for (const k of ['kana', 'kanji', 'vocab', 'grammar'])
    for (const lv of ['N5', 'N4']) {
      const d = DECKS[k].filter(c => c.level === lv);
      if (d.length) rows.push([`${lv} ${k}`, d.filter(mastered).length, d.length]);
    }
  $('#mastery').innerHTML = rows.map(([l, m, t]) =>
    `<div class="mrow"><div class="lbl"><span>${l}</span><span>${m} / ${t}</span></div>
      <div class="bar"><i data-w="${Math.round(100 * m / t)}"></i></div></div>`).join('');
  requestAnimationFrame(() => $$('#mastery .bar i').forEach(i => i.style.width = i.dataset.w + '%'));
  $('#reset').onclick = () => {
    if (!confirm('Delete all progress? This cannot be undone.')) return;
    S = { srs: {}, streak: 0, last: '', hist: {}, reviews: 0 };
    save(); renderStats(); toast('Progress cleared');
  };
}

/* ---------- boot ---------- */
// ponytail: test.html loads this file without the app markup, so only boot when it is there
if ($('#tiles')) { buildNav(); renderHome(); refreshHeader(); }
window.JLPT = { S, ALL, DECKS, nextBox, makeQuestion, pickCards, romaji, BOX_DAYS, MASTER_BOX };
