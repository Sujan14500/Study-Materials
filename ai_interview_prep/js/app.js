/* ============================================================
   app.js — modes, filtering, scheduling, scoring.
   The question banks live in js/bank-*.js and only hold data.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const KEY = 'aiprep.state';
const DAY = 86400000;

const QB  = (window.QB || []).slice();
const MCQ = (window.MCQ || []).slice();

/* ---------- topics ---------- */
const TOPICS = [
  { id: 'foundations', n: 'Foundations',        i: '🌱', c: '#34d399' },
  { id: 'transformers',n: 'Transformers',       i: '🧠', c: '#7c5cff' },
  { id: 'training',    n: 'Training & tuning',  i: '🎓', c: '#f472b6' },
  { id: 'inference',   n: 'Inference & serving',i: '⚡', c: '#fbbf24' },
  { id: 'prompting',   n: 'Prompting & context',i: '✍️', c: '#22d3ee' },
  { id: 'rag',         n: 'RAG',                i: '📚', c: '#60a5fa' },
  { id: 'vectors',     n: 'Vectors & search',   i: '🔍', c: '#a78bfa' },
  { id: 'agents',      n: 'Agents & tools',     i: '🤖', c: '#fb923c' },
  { id: 'eval',        n: 'Evaluation',         i: '⚖️', c: '#4ade80' },
  { id: 'safety',      n: 'Safety & guardrails',i: '🛡️', c: '#fb7185' },
  { id: 'production',  n: 'Production & cost',  i: '🚀', c: '#38bdf8' },
  { id: 'prodops',     n: 'Production drills',  i: '🧯', c: '#f97316' },
  { id: 'data',        n: 'Data engineering',   i: '🗄️', c: '#c084fc' },
  { id: 'sysdesign',   n: 'System design',      i: '🏗️', c: '#facc15' },
  { id: 'tooling',     n: 'Tooling & ecosystem',i: '🧰', c: '#2dd4bf' },
  { id: 'behavioural', n: 'Behavioural',        i: '💬', c: '#94a3b8' }
];
const TMAP = {};
TOPICS.forEach(t => TMAP[t.id] = t);

/* ---------- state ---------- */
const state = Object.assign(
  { known: {}, star: {}, sched: {}, xp: 0, history: [], streak: 0, last: 0 },
  JSON.parse(localStorage.getItem(KEY) || '{}')
);
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

/* daily streak, computed once on load */
(function streak() {
  const today = Math.floor(Date.now() / DAY);
  if (state.last === today) return;
  state.streak = state.last === today - 1 ? (state.streak || 0) + 1 : 1;
  state.last = today; save();
})();

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function xp(n, msg) { state.xp += n; save(); paintProgressBar(); if (msg) toast(msg); }

function paintProgressBar() {
  const pct = QB.length ? Math.round(Object.keys(state.known).length / QB.length * 100) : 0;
  $('#progress-fill').style.width = pct + '%';
  $('#progress-label').textContent = pct + '%';
  $('#xp-badge').textContent = state.xp + ' XP';
}

/* ---------- rendering an answer ---------- */
function cmp(spec) {
  return '<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>' +
    spec.cols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
    spec.rows.map(r => '<tr><th scope="row">' + r[0] + '</th>' +
      r.slice(1).map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}
function dgm(d) {
  const nodes = d.nodes || d;
  return '<div class="dgm"><div class="dgm-flow">' +
    nodes.map((n, i) => {
      const cls = typeof n === 'string' ? '' : (n.k || '');
      const label = typeof n === 'string' ? n : n.t;
      const sub = typeof n === 'string' ? '' : (n.s ? '<small>' + n.s + '</small>' : '');
      return (i ? '<span class="dgm-a">&rarr;</span>' : '') +
        '<span class="dgm-n ' + cls + '" style="animation-delay:' + (i * 70) + 'ms">' + label + sub + '</span>';
    }).join('') + '</div>' +
    (d.cap ? '<div class="dgm-cap">' + d.cap + '</div>' : '') + '</div>';
}
function answerHTML(q, opts) {
  opts = opts || {};
  let h = '';
  if (q.lay)  h += '<div class="ans ans-lay"><span class="ans-k">in plain English</span><p>' + q.lay + '</p></div>';
  if (q.tech) h += '<div class="ans ans-tech"><span class="ans-k">the technical answer</span>' +
    (/^\s*<(ul|ol|p|div)/.test(q.tech) ? q.tech : '<p>' + q.tech + '</p>') + '</div>';
  if (q.dgm)  h += dgm(q.dgm);
  if (q.compare) h += cmp(q.compare);
  if (q.code) h += '<pre class="code">' + q.code.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>';
  if (q.trap) h += '<div class="ans ans-trap"><span class="ans-k">the follow-up they will ask</span><p>' + q.trap + '</p></div>';
  if (!opts.bare) {
    if (q.tags && q.tags.length) h += '<div class="tags">' + q.tags.map(t => '<span class="tag">' + t + '</span>').join('') + '</div>';
    if (q.xref) h += '<div class="xref">Go deeper: ' + q.xref.map(x => '<a href="' + x[1] + '" target="_blank" rel="noopener">' + x[0] + '</a>').join(' &middot; ') + '</div>';
  }
  return h;
}

/* ============================================================
   STUDY
   ============================================================ */
const study = { topic: 'all', level: 'all', known: 'all', search: '', shown: 60, cursor: -1 };

function filtered() {
  const s = study.search.toLowerCase();
  return QB.filter(q => {
    if (study.topic !== 'all' && q.topic !== study.topic) return false;
    if (study.level !== 'all' && String(q.level) !== study.level) return false;
    if (study.known === 'known' && !state.known[q.id]) return false;
    if (study.known === 'new' && state.known[q.id]) return false;
    if (study.known === 'star' && !state.star[q.id]) return false;
    if (!s) return true;
    return (q.q + ' ' + (q.lay || '') + ' ' + (q.tech || '') + ' ' + (q.tags || []).join(' ')).toLowerCase().includes(s);
  });
}
function renderStudy() {
  const list = filtered();
  const slice = list.slice(0, study.shown);
  $('#result-count').textContent =
    list.length + ' question' + (list.length === 1 ? '' : 's') +
    (list.length > slice.length ? ' — showing ' + slice.length : '') +
    ' · ' + QB.length + ' in the bank';
  const host = $('#q-list');
  if (!list.length) { host.innerHTML = '<div class="empty">Nothing matches. Try a shorter search, or clear the filters.</div>'; $('#load-more').hidden = true; return; }
  host.innerHTML = slice.map((q, i) => {
    const t = TMAP[q.topic] || { n: q.topic, c: 'var(--violet)' };
    return '<article class="qc" data-id="' + q.id + '" data-i="' + i + '" style="--tc:' + t.c + '">' +
      '<div class="qc-head">' +
      '<span class="qc-n">' + q.id.toUpperCase() + '</span>' +
      '<h3 class="qc-q">' + q.q + '</h3>' +
      '<span class="qc-meta">' +
        '<span class="tp">' + t.n + '</span>' +
        '<span class="lv lv' + q.level + '">' + ['', 'junior', 'mid', 'senior'][q.level] + '</span>' +
        '<button class="qc-mark star' + (state.star[q.id] ? ' on' : '') + '" title="Star this">&#9733;</button>' +
        '<button class="qc-mark known' + (state.known[q.id] ? ' on' : '') + '" title="I know this">&#10003;</button>' +
      '</span></div>' +
      '<div class="qc-body">' + answerHTML(q) + '</div></article>';
  }).join('');
  $('#load-more').hidden = list.length <= slice.length;
  wireCards();
}
function wireCards() {
  $$('#q-list .qc').forEach(card => {
    const id = card.dataset.id;
    $('.qc-head', card).onclick = e => {
      if (e.target.closest('.qc-mark')) return;
      card.classList.toggle('open');
      if (card.classList.contains('open')) xp(1);
    };
    $('.qc-mark.star', card).onclick = () => {
      state.star[id] ? delete state.star[id] : state.star[id] = 1;
      $('.qc-mark.star', card).classList.toggle('on', !!state.star[id]); save();
    };
    $('.qc-mark.known', card).onclick = () => {
      if (state.known[id]) { delete state.known[id]; }
      else { state.known[id] = 1; xp(3); }
      $('.qc-mark.known', card).classList.toggle('on', !!state.known[id]);
      save(); paintProgressBar(); paintTopics();
    };
  });
}
$('#q-search').oninput = e => { study.search = e.target.value; study.shown = 60; renderStudy(); };
$('#load-more').onclick = () => { study.shown += 60; renderStudy(); };
$('#expand-all').onclick = function () {
  const open = $$('#q-list .qc.open').length < $$('#q-list .qc').length;
  $$('#q-list .qc').forEach(c => c.classList.toggle('open', open));
  this.textContent = open ? 'Collapse all' : 'Expand all';
};
$$('#level-filter .seg-b').forEach(b => b.onclick = () => {
  study.level = b.dataset.level; study.shown = 60;
  $$('#level-filter .seg-b').forEach(x => x.classList.toggle('active', x === b));
  renderStudy();
});
$$('#known-filter .seg-b').forEach(b => b.onclick = () => {
  study.known = b.dataset.known; study.shown = 60;
  $$('#known-filter .seg-b').forEach(x => x.classList.toggle('active', x === b));
  renderStudy();
});

/* ---------- topic nav ---------- */
function paintTopics() {
  const host = $('#topic-nav');
  const counts = {};
  QB.forEach(q => { counts[q.topic] = counts[q.topic] || { n: 0, k: 0 }; counts[q.topic].n++; if (state.known[q.id]) counts[q.topic].k++; });
  host.innerHTML = '<div class="topic-head">Topics</div>' +
    '<button class="topic-b' + (study.topic === 'all' ? ' active' : '') + '" data-t="all">' +
    '<i>&#9673;</i><span>Everything</span><em>' + QB.length + '</em></button>' +
    TOPICS.map(t => {
      const c = counts[t.id] || { n: 0, k: 0 };
      const pct = c.n ? c.k / c.n * 100 : 0;
      return '<button class="topic-b' + (study.topic === t.id ? ' active' : '') + '" data-t="' + t.id + '">' +
        '<i>' + t.i + '</i><span>' + t.n + '</span>' +
        '<span class="tb-bar"><i style="width:' + pct + '%;background:' + t.c + '"></i></span>' +
        '<em>' + c.n + '</em></button>';
    }).join('');
  $$('.topic-b', host).forEach(b => b.onclick = () => {
    study.topic = b.dataset.t; study.shown = 60;
    paintTopics(); renderStudy(); go('study');
    $('#sidebar').classList.remove('open');
  });
}

/* ============================================================
   FLASHCARDS  (SM-2 lite: 0 again / 1 hard / 2 good / 3 easy)
   ============================================================ */
const cards = { deck: [], at: 0, flipped: false };
const INTERVALS = [0, 0.007, 1, 4];   // days for again / hard / good / easy on a fresh card

function dueCards(topic, level) {
  const now = Date.now();
  return QB.filter(q => {
    if (topic !== 'all' && q.topic !== topic) return false;
    if (level !== 'all' && String(q.level) !== level) return false;
    const s = state.sched[q.id];
    return !s || s.due <= now;
  });
}
function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function paintCardCount() {
  const t = $('#card-topic').value, l = $('#card-level').value;
  const d = dueCards(t, l).length;
  const total = QB.filter(q => (t === 'all' || q.topic === t) && (l === 'all' || String(q.level) === l)).length;
  $('#card-count').textContent = d + ' card' + (d === 1 ? '' : 's') + ' due now, out of ' + total +
    (d === 0 ? ' — nothing is due. Shuffle the deck to review anyway.' : '');
}
function startDeck(all) {
  const t = $('#card-topic').value, l = $('#card-level').value;
  const pool = all
    ? QB.filter(q => (t === 'all' || q.topic === t) && (l === 'all' || String(q.level) === l))
    : dueCards(t, l);
  cards.deck = shuffle(pool).slice(0, 40);
  cards.at = 0; cards.flipped = false;
  renderCard();
}
function renderCard() {
  const stage = $('#card-stage'), ctrl = $('#card-controls');
  if (cards.at >= cards.deck.length) {
    ctrl.hidden = true;
    stage.innerHTML = cards.deck.length
      ? '<div class="deck-done"><h3>&#127881; Deck finished</h3><p>' + cards.deck.length +
        ' cards reviewed. The ones you rated <b>Again</b> or <b>Hard</b> are already scheduled to come back sooner ' +
        'than the ones you rated <b>Easy</b> — that spacing is the entire reason flashcards work.</p>' +
        '<button class="btn" id="deck-again">Another session</button></div>'
      : '<div class="empty">Pick a topic and press Start.</div>';
    const b = $('#deck-again'); if (b) b.onclick = () => startDeck(false);
    paintCardCount();
    return;
  }
  const q = cards.deck[cards.at];
  const t = TMAP[q.topic] || { n: q.topic };
  ctrl.hidden = false;
  stage.innerHTML =
    '<div class="fc" id="fc"><div class="fc-face fc-front">' +
    '<div class="fc-top"><span>' + t.n + ' · ' + ['', 'junior', 'mid', 'senior'][q.level] + '</span>' +
    '<span>' + (cards.at + 1) + ' / ' + cards.deck.length + '</span></div>' +
    '<div class="fc-q">' + q.q + '</div>' +
    '<div class="fc-hint">Say your answer out loud, then click to flip.</div></div>' +
    '<div class="fc-face fc-back"><div class="fc-top"><span>' + t.n + '</span><span>' + q.id.toUpperCase() + '</span></div>' +
    '<div class="fc-a">' + answerHTML(q, { bare: true }) + '</div></div></div>';
  $('#fc').onclick = () => { cards.flipped = !cards.flipped; $('#fc').classList.toggle('flipped', cards.flipped); };
}
function rate(r) {
  const q = cards.deck[cards.at]; if (!q) return;
  const prev = state.sched[q.id] || { ease: 2.3, reps: 0, iv: 0 };
  let iv, ease = prev.ease;
  if (r === 0) { iv = INTERVALS[0]; ease = Math.max(1.3, ease - 0.2); }
  else if (r === 1) { iv = prev.reps ? Math.max(0.02, prev.iv * 1.2) : INTERVALS[1]; ease = Math.max(1.3, ease - 0.15); }
  else if (r === 2) { iv = prev.reps ? prev.iv * ease : INTERVALS[2]; }
  else { iv = prev.reps ? prev.iv * ease * 1.35 : INTERVALS[3]; ease = Math.min(2.8, ease + 0.1); }
  state.sched[q.id] = { due: Date.now() + iv * DAY, ease: ease, reps: prev.reps + 1, iv: iv };
  if (r >= 2) { state.known[q.id] = 1; xp(2); } else { delete state.known[q.id]; }
  save(); paintProgressBar(); paintTopics();
  cards.at++; cards.flipped = false;
  renderCard();
}
$$('.rate').forEach(b => b.onclick = () => rate(+b.dataset.rate));
$('#card-start').onclick = () => { startDeck(false); xp(1); };
$('#card-shuffle').onclick = () => startDeck(true);

/* ============================================================
   QUIZ
   ============================================================ */
const quiz = { qs: [], at: 0, score: 0, wrong: [], timed: false, timer: null, left: 60 };
$('#quiz-timed').onclick = function () { this.classList.toggle('on'); quiz.timed = this.classList.contains('on'); };
function paintQuizCount() {
  const t = $('#quiz-topic').value;
  const n = MCQ.filter(m => t === 'all' || m.topic === t).length;
  $('#quiz-count').textContent = n + ' multiple-choice question' + (n === 1 ? '' : 's') + ' available · ' + MCQ.length + ' in total';
}
function startQuiz() {
  const t = $('#quiz-topic').value;
  let len = +$('#quiz-len').value;
  const pool = shuffle(MCQ.filter(m => t === 'all' || m.topic === t));
  quiz.qs = len ? pool.slice(0, len) : pool;
  quiz.qs.forEach(m => { delete m._order; delete m._ans; });
  quiz.at = 0; quiz.score = 0; quiz.wrong = [];
  if (!quiz.qs.length) { $('#quiz-stage').innerHTML = '<div class="empty">No questions for that topic yet.</div>'; return; }
  renderQuiz();
}
function stopTimer() { if (quiz.timer) { clearInterval(quiz.timer); quiz.timer = null; } }
function renderQuiz() {
  stopTimer();
  const host = $('#quiz-stage');
  if (quiz.at >= quiz.qs.length) return finishQuiz();
  const m = quiz.qs[quiz.at];
  const t = TMAP[m.topic] || { n: m.topic };
  const pct = quiz.at / quiz.qs.length * 100;
  /* Options are authored with the answer in a fixed slot, so shuffle per render:
     otherwise "always pick B" scores far better than chance. */
  if (!m._order) {
    m._order = shuffle(m.o.map((_, i) => i));
    m._ans = m._order.indexOf(m.a);
  }
  const opts = m._order.map(i => m.o[i]);
  host.innerHTML =
    '<div class="qz-bar"><span class="qz-n">' + (quiz.at + 1) + ' / ' + quiz.qs.length + '</span>' +
    '<span class="qz-prog"><i style="width:' + pct + '%"></i></span>' +
    '<span class="qz-score">' + quiz.score + ' correct</span>' +
    (quiz.timed ? '<span class="qz-timer" id="qz-timer">60s</span>' : '') + '</div>' +
    '<div class="qz-card"><div class="qz-topic">' + t.n + '</div>' +
    '<div class="qz-q">' + m.q + '</div>' +
    '<div class="qz-opts">' + opts.map((o, i) =>
      '<button class="qopt" data-i="' + i + '"><i>' + 'ABCD'[i] + '</i><span>' + o + '</span></button>').join('') + '</div>' +
    '<div class="qz-exp" id="qz-exp"><b>Why:</b> ' + m.e + '</div>' +
    '<div class="btn-row"><button class="btn" id="qz-next" disabled>Next question &rarr;</button></div></div>';
  let answered = false;
  const pick = i => {
    if (answered) return; answered = true; stopTimer();
    $$('.qopt').forEach((b, bi) => {
      b.disabled = true;
      if (bi === m._ans) b.classList.add('correct');
      else if (bi === i) b.classList.add('incorrect');
    });
    if (i === m._ans) { quiz.score++; xp(3); }
    else { quiz.wrong.push({ m: m, chose: i >= 0 ? m._order[i] : -1 }); }
    $('#qz-exp').classList.add('show');
    $('#qz-next').disabled = false;
  };
  $$('.qopt').forEach(b => b.onclick = () => pick(+b.dataset.i));
  $('#qz-next').onclick = () => { quiz.at++; renderQuiz(); };
  if (quiz.timed) {
    quiz.left = 60;
    quiz.timer = setInterval(() => {
      quiz.left--;
      const t2 = $('#qz-timer'); if (!t2) return stopTimer();
      t2.textContent = quiz.left + 's';
      t2.classList.toggle('low', quiz.left <= 10);
      if (quiz.left <= 0) pick(-1);
    }, 1000);
  }
}
function finishQuiz() {
  stopTimer();
  const pct = Math.round(quiz.score / quiz.qs.length * 100);
  state.history.unshift({ t: Date.now(), topic: $('#quiz-topic').value, n: quiz.qs.length, s: quiz.score });
  state.history = state.history.slice(0, 30); save();
  const msg = pct === 100 ? 'Perfect. Go and book the interview.'
    : pct >= 85 ? 'Interview-ready on this material. Move to the mock round and practise saying it out loud.'
    : pct >= 65 ? 'Solid. The misses below are your revision list — read the explanation, then star the question in Study mode.'
    : pct >= 40 ? 'Worth another pass. Work through the topic in Study mode first, then come back.'
    : 'Start with the Study tab for this topic. Guessing on multiple choice is not learning.';
  $('#quiz-stage').innerHTML =
    '<div class="qz-result"><h3>' + quiz.score + ' / ' + quiz.qs.length + ' &nbsp;·&nbsp; ' + pct + '%</h3><p>' + msg + '</p></div>' +
    (quiz.wrong.length ? '<div class="qz-review"><h3 style="margin:22px 0 12px">Review — ' + quiz.wrong.length + ' to fix</h3>' +
      quiz.wrong.map(w => '<div class="qz-rv"><b>' + w.m.q + '</b>' +
        '<span class="yours">You said: ' + (w.chose >= 0 ? w.m.o[w.chose] : 'ran out of time') + '</span><br>' +
        '<span class="right">Correct: ' + w.m.o[w.m.a] + '</span><br>' +
        '<span>' + w.m.e + '</span></div>').join('') + '</div>' : '') +
    '<div class="btn-row"><button class="btn" id="qz-again">Another quiz</button>' +
    '<button class="btn btn-ghost" id="qz-back">Back to setup</button></div>';
  $('#qz-again').onclick = startQuiz;
  $('#qz-back').onclick = () => { $('#quiz-stage').innerHTML = ''; };
  xp(10, 'Quiz finished — ' + pct + '%');
}
$('#quiz-start').onclick = startQuiz;

/* ============================================================
   MOCK INTERVIEW
   ============================================================ */
const ROLE_MIX = {
  genai:  { foundations: 2, transformers: 3, training: 3, inference: 2, prompting: 2, rag: 3, eval: 2, agents: 1, safety: 1 },
  aieng:  { production: 4, inference: 3, rag: 2, eval: 2, sysdesign: 3, data: 2, safety: 2, agents: 1 },
  rag:    { rag: 6, vectors: 4, eval: 3, prompting: 2, production: 2, data: 1 },
  agent:  { agents: 6, prompting: 2, eval: 2, safety: 2, production: 2, sysdesign: 2 },
  mlops:  { inference: 5, production: 4, sysdesign: 2, data: 2, eval: 2, training: 2 },
  mixed:  { foundations: 1, transformers: 2, training: 2, inference: 2, prompting: 1, rag: 3, vectors: 1,
            agents: 2, eval: 2, safety: 1, production: 2, data: 1, sysdesign: 2, behavioural: 2 }
};
const mock = { qs: [], at: 0, ratings: [], t0: 0, timer: null, sec: 0 };
function buildMock() {
  const role = $('#mock-role').value, level = +$('#mock-level').value, want = +$('#mock-len').value;
  const mix = ROLE_MIX[role];
  const weightsTotal = Object.keys(mix).reduce((a, k) => a + mix[k], 0);
  const picked = [];
  Object.keys(mix).forEach(topic => {
    const n = Math.max(1, Math.round(want * mix[topic] / weightsTotal));
    const pool = shuffle(QB.filter(q => q.topic === topic && Math.abs(q.level - level) <= 1)
      .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level)).slice(0, 40));
    picked.push.apply(picked, pool.slice(0, n));
  });
  mock.qs = shuffle(picked).slice(0, want);
  mock.at = 0; mock.ratings = [];
  renderMock();
}
function stopMockTimer() { if (mock.timer) { clearInterval(mock.timer); mock.timer = null; } }
function renderMock() {
  stopMockTimer();
  const host = $('#mock-stage');
  if (mock.at >= mock.qs.length) return mockReport();
  const q = mock.qs[mock.at], t = TMAP[q.topic] || { n: q.topic };
  const budget = q.level === 3 ? 150 : q.level === 2 ? 105 : 75;
  host.innerHTML =
    '<div class="mk-card"><div class="mk-top">' +
    '<span class="mk-tag">' + t.n + ' · ' + ['', 'junior', 'mid', 'senior'][q.level] + ' · question ' + (mock.at + 1) + ' of ' + mock.qs.length + '</span>' +
    '<span class="mk-clock" id="mk-clock">0:00</span></div>' +
    '<div class="mk-q">' + q.q + '</div>' +
    '<div class="mk-hint">Answer out loud. Aim for about ' + budget + ' seconds — structure first, then one concrete example, then the trade-off.</div>' +
    '<div class="btn-row"><button class="btn" id="mk-reveal">Reveal the model answer</button>' +
    '<button class="btn btn-ghost" id="mk-skip">Skip</button></div>' +
    '<div class="mk-answer" id="mk-answer">' + answerHTML(q) +
    '<div class="mk-rate"><button class="rate again" data-r="0">Missed it</button>' +
    '<button class="rate hard" data-r="1">Partly there</button>' +
    '<button class="rate good" data-r="2">Nailed it</button></div></div></div>';
  mock.sec = 0; mock.t0 = Date.now();
  mock.timer = setInterval(() => {
    mock.sec = Math.round((Date.now() - mock.t0) / 1000);
    const c = $('#mk-clock'); if (!c) return stopMockTimer();
    c.textContent = Math.floor(mock.sec / 60) + ':' + String(mock.sec % 60).padStart(2, '0');
    c.classList.toggle('warn', mock.sec > budget);
    c.classList.toggle('over', mock.sec > budget * 1.6);
  }, 1000);
  $('#mk-reveal').onclick = function () { $('#mk-answer').classList.add('show'); this.disabled = true; };
  $('#mk-skip').onclick = () => { record(0); };
  $$('#mk-answer .rate').forEach(b => b.onclick = () => record(+b.dataset.r));
  function record(r) {
    stopMockTimer();
    mock.ratings.push({ q: q, r: r, sec: mock.sec, budget: budget });
    mock.at++; renderMock();
    if (r === 2) xp(4);
  }
}
function mockReport() {
  const R = mock.ratings;
  if (!R.length) { $('#mock-stage').innerHTML = ''; return; }
  const score = R.reduce((a, x) => a + x.r, 0) / (R.length * 2);
  const byTopic = {};
  R.forEach(x => {
    const k = x.q.topic;
    byTopic[k] = byTopic[k] || { n: 0, s: 0 };
    byTopic[k].n++; byTopic[k].s += x.r;
  });
  const slow = R.filter(x => x.sec > x.budget * 1.5).length;
  const rows = Object.keys(byTopic).map(k => {
    const b = byTopic[k], pct = b.s / (b.n * 2);
    return { k: k, pct: pct, n: b.n };
  }).sort((a, b) => a.pct - b.pct);
  const weakest = rows[0];
  $('#mock-stage').innerHTML =
    '<div class="mk-card mk-report"><h3>' + Math.round(score * 100) + '% &nbsp;·&nbsp; ' + R.length + ' questions</h3>' +
    '<p class="lead">' + (score >= 0.85
      ? 'That is a pass in most rooms. Now do it again with the timer visible — pacing is the thing that slips under pressure.'
      : score >= 0.6
      ? 'A real interview would land somewhere around "promising, some gaps". The bars below tell you which gaps.'
      : 'Not ready yet, and that is useful information rather than bad news. Work the weakest topic in Study mode and repeat this round in two days.') + '</p>' +
    '<div class="stat-row" style="margin-top:18px">' +
    '<div class="stat"><div class="stat-v">' + Math.round(score * 100) + '%</div><div class="stat-k">self-rated</div></div>' +
    '<div class="stat"><div class="stat-v">' + R.filter(x => x.r === 2).length + '</div><div class="stat-k">nailed</div></div>' +
    '<div class="stat"><div class="stat-v bad">' + R.filter(x => x.r === 0).length + '</div><div class="stat-k">missed</div></div>' +
    '<div class="stat"><div class="stat-v ' + (slow ? 'bad' : 'good') + '">' + slow + '</div><div class="stat-k">ran long</div></div>' +
    '<div class="stat"><div class="stat-v">' + Math.round(R.reduce((a, x) => a + x.sec, 0) / R.length) + 's</div><div class="stat-k">average answer</div></div>' +
    '</div>' +
    '<div class="mk-bars">' + rows.map(r => {
      const t = TMAP[r.k] || { n: r.k, c: 'var(--violet)' };
      return '<div class="mk-bar"><span>' + t.n + '</span>' +
        '<span class="t"><i style="width:' + (r.pct * 100) + '%;background:' + t.c + '"></i></span>' +
        '<b>' + Math.round(r.pct * 100) + '%</b></div>';
    }).join('') + '</div>' +
    (weakest ? '<div class="advice" style="margin-top:18px"><b>Do this next:</b> your weakest topic was <b>' +
      (TMAP[weakest.k] || { n: weakest.k }).n + '</b> at ' + Math.round(weakest.pct * 100) +
      '%. Open Study mode, filter to it, and read every question you have not marked known. ' +
      (slow ? 'You also ran long on ' + slow + ' answer' + (slow === 1 ? '' : 's') + ' — practise a 30-second version of each before the 2-minute one.' : '') +
      '</div>' : '') +
    '<div class="btn-row"><button class="btn" id="mk-again">Run another round</button>' +
    '<button class="btn btn-ghost" id="mk-study">Study the weakest topic</button></div></div>';
  $('#mk-again').onclick = buildMock;
  $('#mk-study').onclick = () => { study.topic = weakest.k; study.shown = 60; paintTopics(); renderStudy(); go('study'); };
  xp(15, 'Mock round complete');
}
$('#mock-start').onclick = buildMock;

/* ============================================================
   PROGRESS
   ============================================================ */
function renderProgress() {
  const known = Object.keys(state.known).length;
  const due = QB.filter(q => { const s = state.sched[q.id]; return !s || s.due <= Date.now(); }).length;
  const seen = Object.keys(state.sched).length;
  $('#prog-stats').innerHTML =
    '<div class="stat"><div class="stat-v">' + known + '</div><div class="stat-k">marked known</div></div>' +
    '<div class="stat"><div class="stat-v">' + Math.round(known / QB.length * 100) + '%</div><div class="stat-k">of the bank</div></div>' +
    '<div class="stat"><div class="stat-v">' + seen + '</div><div class="stat-k">cards started</div></div>' +
    '<div class="stat"><div class="stat-v ' + (due > 60 ? 'bad' : 'good') + '">' + due + '</div><div class="stat-k">due for review</div></div>' +
    '<div class="stat"><div class="stat-v">' + (state.streak || 1) + '</div><div class="stat-k">day streak</div></div>' +
    '<div class="stat"><div class="stat-v">' + state.xp + '</div><div class="stat-k">XP</div></div>';
  const rows = TOPICS.map(t => {
    const all = QB.filter(q => q.topic === t.id);
    const k = all.filter(q => state.known[q.id]).length;
    return { t: t, n: all.length, k: k, pct: all.length ? k / all.length : 0 };
  });
  $('#prog-topics').innerHTML = rows.map(r =>
    '<div class="pt-row"><span class="pt-n">' + r.t.i + ' ' + r.t.n + '</span>' +
    '<span class="pt-t"><i style="width:' + (r.pct * 100) + '%;background:' + r.t.c + '"></i></span>' +
    '<span class="pt-v">' + r.k + '/' + r.n + '</span></div>').join('');
  const weak = rows.filter(r => r.n >= 5).sort((a, b) => a.pct - b.pct).slice(0, 3);
  $('#prog-advice').innerHTML = (known === 0
    ? '<div class="advice"><b>Start here.</b> Open Study mode, filter to <b>Foundations</b>, and read the first ten questions. ' +
      'Mark the ones you could already answer out loud as known. That first pass takes about fifteen minutes and it calibrates everything else.</div>'
    : weak.map(w =>
      '<div class="advice"><b>' + w.t.i + ' ' + w.t.n + ' — ' + Math.round(w.pct * 100) + '% covered.</b> ' +
      (w.pct < 0.2
        ? 'Barely touched. Read it in Study mode before you quiz yourself; multiple choice on material you have not read is just guessing.'
        : w.pct < 0.6
        ? 'Half done. Run a flashcard session on this topic — recall beats re-reading by a wide margin at this stage.'
        : 'Nearly there. Run a mock round filtered to this topic and practise saying the answers out loud within ninety seconds.') +
      '</div>').join('')) +
    (due > 40 ? '<div class="advice"><b>' + due + ' cards are due.</b> That backlog gets worse every day you leave it. ' +
      'Twenty minutes of flashcards now is worth more than an hour of re-reading later.</div>' : '');
  $('#prog-history').innerHTML = state.history.length
    ? '<div class="hist">' + state.history.slice(0, 12).map(h => {
        const pct = Math.round(h.s / h.n * 100);
        const cls = pct >= 80 ? 'ok' : pct >= 55 ? 'mid' : 'bad';
        const t = h.topic === 'all' ? 'Everything' : (TMAP[h.topic] || { n: h.topic }).n;
        return '<div class="hist-r"><span>' + t + '</span>' +
          '<span class="dim">' + new Date(h.t).toLocaleDateString() + '</span>' +
          '<span class="dim">' + h.s + '/' + h.n + '</span>' +
          '<b class="' + cls + '">' + pct + '%</b></div>';
      }).join('') + '</div>'
    : '<p class="dim">No quizzes yet. The history here is what tells you whether you are actually improving or just feeling busy.</p>';
}

/* ============================================================
   STUDY PATHS
   ============================================================ */
function renderPaths() {
  $('#paths').innerHTML = (window.PATHS || []).map(p =>
    '<div class="path" style="--pc:' + p.c + '">' +
    '<div class="path-h"><h3>' + p.i + ' ' + p.n + '</h3><span>' + p.time + '</span></div>' +
    '<p class="path-d">' + p.d + '</p>' +
    p.stages.map((s, i) =>
      '<div class="stage-row"><span class="stage-n">' + (i + 1) + '</span>' +
      '<div class="stage-b"><b>' + s.n + '</b><p>' + s.d + '</p>' +
      '<div class="stage-links">' +
      (s.topics || []).map(t => '<button data-topic="' + t + '">' + ((TMAP[t] || { n: t }).i || '') + ' ' + (TMAP[t] || { n: t }).n + '</button>').join('') +
      (s.course ? '<a class="course" href="' + s.course[1] + '" target="_blank" rel="noopener">📘 ' + s.course[0] + '</a>' : '') +
      '</div></div></div>').join('') +
    '</div>').join('');
  $$('#paths [data-topic]').forEach(b => b.onclick = () => {
    study.topic = b.dataset.topic; study.shown = 60;
    paintTopics(); renderStudy(); go('study');
  });
}

/* ============================================================
   MODES + KEYBOARD
   ============================================================ */
function go(mode) {
  $$('.mode').forEach(m => m.hidden = m.id !== 'mode-' + mode);
  $$('#mode-nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'progress') renderProgress();
  if (mode === 'paths') renderPaths();
  if (mode === 'cards') paintCardCount();
  if (mode === 'quiz') paintQuizCount();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('#sidebar').classList.remove('open');
}
$$('#mode-nav .nav-item').forEach(b => b.onclick = () => go(b.dataset.mode));
$('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');
$('#reset-btn').onclick = () => {
  if (!confirm('Clear everything you have marked known, every flashcard schedule and all quiz history?')) return;
  localStorage.removeItem(KEY); location.reload();
};

document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === '/' && !typing) { e.preventDefault(); go('study'); $('#q-search').focus(); return; }
  if (e.key === 'Escape' && typing) { document.activeElement.blur(); return; }
  if (typing) return;
  const cardsVisible = !$('#mode-cards').hidden && cards.deck.length && cards.at < cards.deck.length;
  if (cardsVisible) {
    if (e.key === ' ') { e.preventDefault(); $('#fc').click(); return; }
    if ('1234'.includes(e.key)) { rate(+e.key - 1); return; }
  }
  if (!$('#mode-study').hidden) {
    const list = $$('#q-list .qc');
    if (e.key === 'j' || e.key === 'k') {
      study.cursor = Math.max(0, Math.min(list.length - 1, study.cursor + (e.key === 'j' ? 1 : -1)));
      list.forEach((c, i) => c.classList.toggle('cursor', i === study.cursor));
      const c = list[study.cursor];
      if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (e.key === ' ' && list[study.cursor]) { e.preventDefault(); list[study.cursor].classList.toggle('open'); }
  }
});

/* ---------- background particles ---------- */
(function bg() {
  const cv = document.getElementById('bg-particles'); if (!cv) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d');
  let pts = [], W = 0, H = 0;
  function resize() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    pts = Array.from({ length: Math.min(60, Math.round(W * H / 30000)) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2, r: Math.random() * 1.5 + .5
    }));
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.fillStyle = 'rgba(160,180,255,.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = dx * dx + dy * dy;
      if (d2 < 18000) {
        ctx.strokeStyle = 'rgba(124,92,255,' + (0.14 * (1 - d2 / 18000)) + ')';
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }
  resize(); window.addEventListener('resize', resize); frame();
})();

/* ---------- boot ---------- */
(function boot() {
  const opts = '<option value="all">All topics</option>' +
    TOPICS.map(t => '<option value="' + t.id + '">' + t.i + ' ' + t.n + '</option>').join('');
  $('#card-topic').innerHTML = opts;
  $('#quiz-topic').innerHTML = opts;
  $('#card-topic').onchange = paintCardCount;
  $('#card-level').onchange = paintCardCount;
  $('#quiz-topic').onchange = paintQuizCount;
  paintTopics(); renderStudy(); paintProgressBar(); paintCardCount(); paintQuizCount();
  const unknown = QB.filter(q => !TMAP[q.topic]);
  if (unknown.length) console.warn('questions with an unknown topic:', unknown.map(q => q.id));
})();
})();
