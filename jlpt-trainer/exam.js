/* Mock exam engine. Loads after app.js and reuses its helpers ($, shuffle, esc, chips, S, save).

   The papers are original practice material laid out in the official 問題 order — not copies of
   real past papers. 聴解 needs audio we do not ship, so only the 言語知識・読解 half runs; that
   half is the part scored 0-120 in the real exam, and the result panel says what the missing
   listening points mean for the pass mark. */
const EXAMS = { N5: DATA_EXAM_N5, N4: DATA_EXAM_N4 };
const PASS = { N5: { total: 80, section: 38 }, N4: { total: 90, section: 38 } };
const HAS_KANJI = /[一-龯]/;
let examLevel = 'N5', run = null, tick = null;

/* 漢字読み and 表記 are drawn from the vocab deck, so those parts differ on every sitting */
function genItems(part, level) {
  const pool = VOCAB.filter(c => c.level === level && HAS_KANJI.test(c.front) && c.front !== c.sub);
  const read = part.gen === 'read';
  const key = c => read ? c.sub : c.front;
  return shuffle(pool).slice(0, part.count).map(c => {
    const near = pool.filter(x => key(x) !== key(c) && Math.abs(key(x).length - key(c).length) <= 1);
    const opts = [key(c)];
    for (const x of shuffle(near.length >= 3 ? near : pool)) {
      if (opts.length === 4) break;
      if (!opts.includes(key(x))) opts.push(key(x));
    }
    return read
      ? { q: c.front, a: opts, c: 0, why: c.front + 'は「' + c.sub + '」（' + c.back + '）と読みます。' }
      : { q: c.sub, a: opts, c: 0, why: '「' + c.sub + '」は' + c.front + '（' + c.back + '）と書きます。' };
  }).filter(it => new Set(it.a).size === 4);
}

/* options are reshuffled per sitting, so the answer is never in a fixed position */
function shuffleOpts(it) {
  const right = it.a[it.c], a = shuffle(it.a);
  return { q: it.q, a: a, c: a.indexOf(right), why: it.why };
}

function buildExam(paper, level) {
  let n = 0;
  const sections = paper.sections.map(sec => ({
    name: sec.name, min: sec.min,
    parts: sec.parts.map(pt => {
      const src = pt.gen ? genItems(pt, level)
        : [...(pt.items || []), ...(pt.blocks || []).flatMap(b => b.items)];
      const items = src.map(it => Object.assign(shuffleOpts(it), { i: n++ }));
      let k = 0;
      const blocks = (pt.blocks || []).map(b => ({ text: b.text, items: b.items.map(() => items[k++]) }));
      return { n: pt.n, t: pt.t, instr: pt.instr, text: pt.text, blocks: blocks,
               items: pt.blocks ? [] : items };
    })
  }));
  return { paper: paper, level: level, sections: sections, si: 0, ans: Array(n).fill(-1), total: n, ends: 0 };
}

function countQuestions(p) {
  return p.sections.reduce((t, s) => t + s.parts.reduce((u, pt) => u + (pt.gen ? pt.count
    : (pt.items || []).length + (pt.blocks || []).reduce((v, b) => v + b.items.length, 0)), 0), 0);
}

function renderExam() {
  run = null; clearInterval(tick);
  chips($('#examFilter'), [{ v: 'N5', l: 'N5' }, { v: 'N4', l: 'N4' }], [examLevel],
    v => { examLevel = v; renderExam(); });
  const best = S.exams || {};
  $('#examBody').innerHTML =
    '<div class="excard"><h3>Before you start</h3>' +
    '<p class="sub" style="margin:0">These are original practice papers written in the official JLPT ' +
    'layout — the same 問題 order, question counts and per-section time limits. They are not copies of ' +
    'real past papers. 聴解 (listening) is not included because it needs audio, so a paper here covers ' +
    'the 言語知識・読解 half that the real exam scores out of 120. 漢字読み and 表記 are drawn fresh ' +
    'from the vocab deck each time, so retaking a paper is not the same paper twice.</p></div>' +
    EXAMS[examLevel].map(p => {
      const b = best[p.id];
      const mins = p.sections.reduce((t, s) => t + s.min, 0);
      return '<div class="excard"><h3>' + esc(p.name) + '</h3>' +
        '<p class="sub" style="margin:0 0 12px">' + countQuestions(p) + ' questions &middot; ' +
        mins + ' minutes &middot; ' + p.sections.length + ' timed sections' +
        (b ? ' &middot; best ' + b.scaled + '/120' : '') + '</p>' +
        '<button class="btn p" data-p="' + p.id + '">' + (b ? 'Retake' : 'Start') + '</button></div>';
    }).join('');
  $('#examBody').onclick = e => {
    const b = e.target.closest('[data-p]');
    if (b) { run = buildExam(EXAMS[examLevel].find(p => p.id === b.dataset.p), examLevel); drawSection(); }
  };
}

function sectionItems(sec) {
  return sec.parts.flatMap(pt => pt.blocks.length ? pt.blocks.flatMap(b => b.items) : pt.items);
}
function allItems() {
  return run.sections.flatMap(sectionItems);
}

function drawSection() {
  const sec = run.sections[run.si];
  run.ends = Date.now() + sec.min * 60000;
  const qHtml = it => '<div class="eq" id="eq' + it.i + '"><div class="eqh"><i>' + (it.i + 1) + '</i>' +
    '<span>' + esc(it.q) + '</span></div><div class="eopts">' +
    it.a.map((o, j) => '<button class="eopt" data-i="' + it.i + '" data-o="' + j + '">' +
      (j + 1) + '　' + esc(o) + '</button>').join('') + '</div></div>';
  $('#examBody').innerHTML =
    '<div class="exbar"><b id="exTime">--:--</b>' +
    '<span class="sub" style="margin:0">' + esc(sec.name) + '　(' + (run.si + 1) + '/' + run.sections.length + ')</span>' +
    '<span class="sub" id="exProg" style="margin:0"></span>' +
    '<button class="btn p" id="exDone">' +
    (run.si + 1 < run.sections.length ? 'Next section' : 'Finish') + '</button></div>' +
    sec.parts.map(pt => {
      const body = pt.blocks.length
        ? pt.blocks.map(b => '<div class="expass">' + esc(b.text) + '</div>' + b.items.map(qHtml).join('')).join('')
        : (pt.text ? '<div class="expass">' + esc(pt.text) + '</div>' : '') + pt.items.map(qHtml).join('');
      return '<div class="exhead"><b>' + pt.n + '　' + pt.t + '</b><span>' + esc(pt.instr) + '</span></div>' + body;
    }).join('');
  $('#examBody').onclick = e => {
    const b = e.target.closest('.eopt'); if (!b) return;
    const i = +b.dataset.i;
    run.ans[i] = +b.dataset.o;
    $$('.eopt[data-i="' + i + '"]').forEach(x => x.classList.toggle('sel', x === b));
    $('#eq' + i).classList.add('done');
    showProgress();
  };
  $('#exDone').onclick = endSection;
  showProgress();
  startTimer();
  window.scrollTo({ top: 0 });
}

function startTimer() {
  clearInterval(tick);
  tick = setInterval(() => {
    const el = $('#exTime');
    if (!el || !run) return clearInterval(tick);
    const left = Math.max(0, run.ends - Date.now());
    el.textContent = String(Math.floor(left / 60000)).padStart(2, '0') + ':' +
                     String(Math.floor(left / 1000) % 60).padStart(2, '0');
    el.classList.toggle('warn', left < 60000);
    if (left === 0) { clearInterval(tick); toast('Time is up for this section'); endSection(); }
  }, 250);
}

function showProgress() {
  const el = $('#exProg'); if (!el) return;
  const ids = sectionItems(run.sections[run.si]).map(x => x.i);
  el.textContent = ids.filter(i => run.ans[i] >= 0).length + ' / ' + ids.length + ' answered';
}

function endSection() {
  clearInterval(tick);
  if (run.si + 1 < run.sections.length) { run.si++; drawSection(); return; }
  showResult();
}

function showResult() {
  const items = allItems();
  const right = items.filter(it => run.ans[it.i] === it.c).length;
  const scaled = Math.round(120 * right / items.length);
  const need = PASS[run.level];
  const sectionOk = scaled >= need.section;
  const fromListening = Math.max(0, need.total - scaled);
  const best = (S.exams = S.exams || {});
  if (!best[run.paper.id] || best[run.paper.id].scaled < scaled)
    best[run.paper.id] = { scaled: scaled, right: right, of: items.length, on: today() };
  save();

  const perPart = run.sections.flatMap(s => s.parts.map(pt => {
    const its = pt.blocks.length ? pt.blocks.flatMap(b => b.items) : pt.items;
    return [pt.n + '　' + pt.t, its.filter(it => run.ans[it.i] === it.c).length, its.length];
  }));

  $('#examBody').innerHTML =
    '<div class="excard"><h3>' + esc(run.paper.name) + '　言語知識・読解</h3>' +
    '<div class="exscore ' + (sectionOk ? 'ok' : 'no') + '">' + scaled +
    '<span style="font-size:20px;color:var(--dim)"> / 120</span></div>' +
    '<p class="sub" style="margin:6px 0 0">' + right + ' of ' + items.length +
    ' correct &middot; section minimum is ' + need.section + ' &mdash; ' +
    (sectionOk ? 'cleared' : 'not cleared') + '</p>' +
    '<div class="exbars">' + perPart.map(p =>
      '<div class="mrow"><div class="lbl"><span>' + esc(p[0]) + '</span><span>' + p[1] + ' / ' + p[2] +
      '</span></div><div class="bar"><i data-w="' + Math.round(100 * p[1] / p[2]) + '"></i></div></div>').join('') +
    '</div><p class="exnote">The real ' + run.level + ' also has a 聴解 section worth 60 points, which ' +
    'this app cannot run without audio. Passing ' + run.level + ' needs ' + need.total +
    '/180 overall, plus at least ' + need.section + '/120 here and 19/60 in listening. ' +
    (fromListening > 0
      ? 'On this attempt you would still need ' + fromListening + ' of those 60 listening points to reach ' + need.total + '.'
      : 'This score alone already clears the ' + need.total + '-point total.') +
    '</p><div class="row" style="margin-top:16px">' +
    '<button class="btn p" id="exAgain">Take another paper</button>' +
    '<button class="btn" id="exReview">Review every question</button></div></div>';
  requestAnimationFrame(() => $$('#examBody .bar i').forEach(i => i.style.width = i.dataset.w + '%'));
  $('#exAgain').onclick = renderExam;
  $('#exReview').onclick = () => reviewExam(items);
}

function reviewExam(items) {
  $('#exReview').disabled = true;
  $('#examBody').insertAdjacentHTML('beforeend', '<div class="excard" id="exRev"></div>');
  $('#exRev').innerHTML = '<h3>Every question, with the answer</h3>' + items.map(it => {
    const you = run.ans[it.i];
    return '<div class="eq"><div class="eqh"><i>' + (it.i + 1) + '</i><span>' + esc(it.q) + '</span></div>' +
      '<div class="eopts">' + it.a.map((o, j) =>
        '<button class="eopt' + (j === it.c ? ' right' : (j === you ? ' wrong' : '')) + '" disabled>' +
        (j + 1) + '　' + esc(o) + '</button>').join('') + '</div>' +
      '<p class="exwhy">' + (you < 0 ? '未回答。' : '') + esc(it.why) + '</p></div>';
  }).join('');
  $('#exRev').scrollIntoView({ behavior: 'smooth' });
}

window.JLPT_EXAM = { EXAMS, PASS, buildExam, genItems, countQuestions, shuffleOpts };
