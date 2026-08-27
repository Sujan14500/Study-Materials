/* ============================================================
   app.js — renders the roadmap, tracks what you have finished,
   and tells you what to open next. Data lives in roadmap.js.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const KEY = 'starthere.state';

const C = window.COURSES, R = window.ROADMAP, T = window.TRACKS;
const state = Object.assign({ done: {}, track: 'full' },
  JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

const track = () => T.filter(t => t.id === state.track)[0] || T[0];
/* the stages this track cares about, in the order it wants them */
const activeStages = () => track().stages;
/* every course in this track, in track order, de-duplicated */
function trackCourses() {
  const out = [];
  activeStages().forEach(si => R[si].items.forEach(id => { if (out.indexOf(id) < 0) out.push(id); }));
  return out;
}
const nextCourse = () => trackCourses().filter(id => !state.done[id])[0] || null;

/* ---------- the little road at the top ---------- */
function paintRoad() {
  const g = $('#road-stops'), path = $('#road');
  if (!g || !path || !path.getTotalLength) return;
  const ids = trackCourses();
  const len = path.getTotalLength();
  g.innerHTML = ids.map((id, i) => {
    const p = path.getPointAtLength(len * (ids.length === 1 ? 0.5 : i / (ids.length - 1)));
    return '<g class="road-stop' + (state.done[id] ? ' done' : '') + '">' +
      '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9"/>' +
      '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 3.2).toFixed(1) + '">' +
      (state.done[id] ? '✓' : (i + 1)) + '</text></g>';
  }).join('');
}

/* ---------- progress ring + next-up line ---------- */
function paintProgress() {
  const ids = trackCourses();
  const done = ids.filter(id => state.done[id]).length;
  const pct = ids.length ? Math.round(done / ids.length * 100) : 0;
  $('#ring-pct').textContent = pct + '%';
  $('#ring-fg').style.strokeDashoffset = (327 - 327 * pct / 100).toFixed(1);

  const next = nextCourse();
  $('#prog-line').innerHTML = done === 0
    ? 'Nothing marked complete yet. <b>' + ids.length + ' courses</b> on this track.'
    : done === ids.length
    ? '<b>All ' + ids.length + ' courses complete.</b> Go and do a mock interview.'
    : '<b>' + done + ' of ' + ids.length + '</b> complete on this track.';
  $('#prog-next').innerHTML = next
    ? 'Next up: <b>' + C[next].i + ' ' + C[next].n + '</b> &middot; ' + C[next].hrs
    : 'Nothing left on this track. Try a different one, or drill in AI Interview Prep.';
  const btn = $('#open-next');
  btn.disabled = !next;
  btn.textContent = next ? 'Open ' + C[next].n + ' →' : 'Track complete';
  btn.onclick = () => { if (next) window.open(C[next].href, '_blank'); };
  paintRoad();
}

/* ---------- tracks ---------- */
function paintTracks() {
  $('#tracks').innerHTML = T.map(t =>
    '<button class="track' + (t.id === state.track ? ' active' : '') + '" data-id="' + t.id + '">' +
    '<span class="track-i">' + t.i + '</span><b>' + t.n + '</b><span>' + t.time + '</span></button>').join('');
  $$('#tracks .track').forEach(b => b.onclick = () => {
    state.track = b.dataset.id; save(); render();
    toast(track().n + ' — ' + trackCourses().length + ' courses');
  });
  const t = track();
  $('#track-note').innerHTML = '<b>' + t.n + '.</b> ' + t.d + (t.note ? ' <b>Note:</b> ' + t.note : '');
}

/* ---------- stages ---------- */
function paintStages() {
  const order = activeStages();
  const shown = order.concat(R.map((_, i) => i).filter(i => order.indexOf(i) < 0));
  $('#stages').innerHTML = shown.map((si, pos) => {
    const s = R[si], inTrack = order.indexOf(si) >= 0;
    return '<div class="stage' + (inTrack ? '' : ' muted') + '">' +
      '<div class="stage-h"><h3>' + s.n + '</h3>' +
      '<span class="stage-tag">' + s.tag + '</span>' +
      '<span class="stage-n">' + (inTrack ? 'step ' + (order.indexOf(si) + 1) + ' of ' + order.length : 'not in this track') + '</span></div>' +
      '<p class="stage-d">' + s.d + '</p>' +
      '<div class="cards">' + s.items.map(id => {
        const c = C[id];
        const unit = c.unit || 'chapters';
        return '<div class="card' + (state.done[id] ? ' done' : '') + '" data-id="' + id + '">' +
          '<div class="card-top"><span class="card-i">' + c.i + '</span>' +
          '<span class="card-t"><b>' + c.n + '</b><span>' + c.ch + ' ' + unit + ' &middot; ' + c.hrs + '</span></span>' +
          '<button class="card-check" title="Mark complete">&#10003;</button></div>' +
          '<div class="card-d">' + c.d + '</div>' +
          '<div class="card-why"><i>why it is here</i>' + c.why + '</div>' +
          '<a class="card-open" href="' + c.href + '" target="_blank" rel="noopener">' +
          (state.done[id] ? 'Open again' : 'Open') + ' &rarr;</a></div>';
      }).join('') + '</div></div>';
  }).join('');

  $$('#stages .card-check').forEach(b => b.onclick = e => {
    e.preventDefault();
    const id = b.closest('.card').dataset.id;
    if (state.done[id]) delete state.done[id]; else state.done[id] = 1;
    save(); render();
    toast(state.done[id] ? '✓ ' + C[id].n + ' marked complete' : C[id].n + ' unmarked');
  });
}

/* ---------- the flat table ---------- */
function paintTable() {
  $('#all-rows').innerHTML = Object.keys(C).map(id => {
    const c = C[id], unit = c.unit || 'chapters';
    return '<tr class="' + (state.done[id] ? 'done' : '') + '" data-href="' + c.href + '">' +
      '<td class="t-i">' + c.i + '</td>' +
      '<td class="t-n">' + c.n + (state.done[id] ? '<small>&#10003; complete</small>' : '') + '</td>' +
      '<td class="t-num">' + c.ch + ' ' + unit + '</td>' +
      '<td class="t-num">' + c.hrs + '</td>' +
      '<td class="t-d">' + c.d + '</td>' +
      '<td class="t-go">open &rarr;</td></tr>';
  }).join('');
  $$('#all-rows tr').forEach(tr => tr.onclick = () => window.open(tr.dataset.href, '_blank'));
}

function render() { paintTracks(); paintStages(); paintTable(); paintProgress(); }

$('#reset').onclick = () => {
  if (!confirm('Clear which courses you have marked complete?')) return;
  localStorage.removeItem(KEY); location.reload();
};

/* ---------- background particles ---------- */
(function bg() {
  const cv = document.getElementById('bg-particles'); if (!cv) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d');
  let pts = [], W = 0, H = 0;
  function resize() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    pts = Array.from({ length: Math.min(55, Math.round(W * H / 32000)) }, () => ({
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

render();
})();
