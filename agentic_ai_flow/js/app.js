/* ============================================================
   app.js — navigation, progress, XP. Small on purpose.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const KEY = 'agenticflow.state';

const chapters = $$('.chapter');
const nav = $('#chapter-nav');
const dots = $('#pager-dots');

const state = Object.assign({ at: 0, seen: [], xp: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
state.seen = new Set(state.seen);

const save = () => localStorage.setItem(KEY, JSON.stringify({ at: state.at, seen: [...state.seen], xp: state.xp }));

/* ---------- build nav ---------- */
let lastGroup = null;
chapters.forEach((ch, i) => {
  const group = ch.dataset.group;
  if (group !== lastGroup) {
    const g = document.createElement('div');
    g.className = 'nav-group'; g.textContent = group;
    nav.appendChild(g); lastGroup = group;
  }
  const b = document.createElement('button');
  b.className = 'nav-item';
  b.innerHTML = '<span class="nav-num">' + ch.dataset.icon + '</span><span>' + ch.dataset.title + '</span>';
  b.onclick = () => goto(i);
  nav.appendChild(b);

  const d = document.createElement('button');
  d.className = 'dot'; d.title = ch.dataset.title;
  d.onclick = () => goto(i);
  dots.appendChild(d);
});
const navItems = $$('.nav-item', nav);
const dotItems = $$('.dot', dots);

/* ---------- navigation ---------- */
function goto(i, skipScroll) {
  i = Math.max(0, Math.min(chapters.length - 1, i));
  state.at = i;
  state.seen.add(chapters[i].dataset.id);
  chapters.forEach((c, ci) => c.classList.toggle('active', ci === i));
  navItems.forEach((n, ni) => {
    n.classList.toggle('active', ni === i);
    const done = state.seen.has(chapters[ni].dataset.id);
    n.classList.toggle('done', done && ni !== i);
    n.querySelector('.nav-num').textContent = (done && ni !== i) ? '✓' : chapters[ni].dataset.icon;
  });
  dotItems.forEach((d, di) => {
    d.classList.toggle('active', di === i);
    d.classList.toggle('done', state.seen.has(chapters[di].dataset.id));
  });
  if (!skipScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  $('#sidebar').classList.remove('open');
  paint();
  save();
  window.dispatchEvent(new CustomEvent('chapterchange', { detail: chapters[i].dataset.id }));
  observeReveals();
}

function paint() {
  const pct = Math.round(state.seen.size / chapters.length * 100);
  $('#progress-fill').style.width = pct + '%';
  $('#progress-label').textContent = pct + '%';
  $('#xp-badge').textContent = state.xp + ' XP';
  const active = navItems[state.at];
  if (active) active.scrollIntoView({ block: 'nearest' });
}

/* ---------- XP + toast ---------- */
let toastTimer;
window.awardXP = function (n, msg) {
  state.xp += n; save(); paint();
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
};

/* ---------- controls ---------- */
$$('[data-goto]').forEach(b => b.onclick = () =>
  goto(state.at + (b.dataset.goto === 'next' ? 1 : -1)));

$('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');

$('#reset-btn').onclick = () => {
  if (!confirm('Clear your progress, XP and checklist?')) return;
  localStorage.removeItem(KEY);
  localStorage.removeItem('agenticflow.checklist');
  location.reload();
};

document.addEventListener('keydown', e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight') goto(state.at + 1);
  if (e.key === 'ArrowLeft') goto(state.at - 1);
});

/* ---------- reveal-on-scroll ---------- */
let io;
function observeReveals() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach(r => r.classList.add('in')); return;
  }
  if (!io) io = new IntersectionObserver(entries => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add('in'), i * 90);
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  $$('.chapter.active .reveal:not(.in)').forEach(r => io.observe(r));
}

goto(state.at, true);
paint();
})();
