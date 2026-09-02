/* ============================================================
   toolstrip.js — "the tools people actually use for this".

   Drop <div data-toolstrip="KEY"></div> anywhere in a chapter and
   this renders the named tools for that topic: a mark, one line on
   what it is, its advantages, its drawbacks, and a one-line verdict.

   The data lives in C.toolstrips[KEY] in the course's content file:

     C.toolstrips = {
       chunking: {
         title: 'Tools & frameworks',
         sub:   'one line on why this list exists',
         tools: [
           { n: 'Unstructured', mark: 'U', by: 'Unstructured.io', c: '#60a5fa',
             what: 'one line on what it is',
             pro:  ['advantage', 'advantage'],
             con:  ['drawback', 'drawback'],
             use:  'the one sentence for when to reach for it' }
         ]
       }
     }

   `mark` is one or two characters, or an emoji. Deliberately not an
   image: these courses have no build step, no network dependency and
   no third-party logo licensing to think about, and a coloured
   monogram reads at a glance just as well.
   ============================================================ */
(function () {
'use strict';
if (typeof C === 'undefined' || !C.toolstrips) return;

const mounts = Array.from(document.querySelectorAll('[data-toolstrip]'));
if (!mounts.length) return;

const esc = s => String(s);

function card(t) {
  const c = t.c || 'rgba(124,92,255,.85)';
  const isEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t.mark || '');
  return '<div class="ts-card" style="--c:' + c + '">' +
    '<div class="ts-top">' +
      '<div class="ts-mark' + (isEmoji ? '' : ' txt') + '" style="background:' + c + '">' + esc(t.mark) + '</div>' +
      '<div class="ts-name"><b>' + esc(t.n) + '</b><span>' + esc(t.by) + '</span></div>' +
    '</div>' +
    '<p class="ts-what">' + esc(t.what) + '</p>' +
    '<div class="ts-pc">' +
      '<div class="ts-pro"><h6>advantages</h6><ul>' +
        t.pro.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' +
      '<div class="ts-con"><h6>drawbacks</h6><ul>' +
        t.con.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' +
    '</div>' +
    (t.use ? '<div class="ts-verdict"><b>Use it when:</b> ' + esc(t.use) + '</div>' : '') +
  '</div>';
}

mounts.forEach(root => {
  const s = C.toolstrips[root.dataset.toolstrip];
  if (!s) { root.remove(); return; }
  root.className = (root.className ? root.className + ' ' : '') + 'panel';
  root.innerHTML =
    '<div class="ts-head"><h3>🧰 ' + esc(s.title || 'Tools &amp; frameworks') + '</h3>' +
      '<span>' + s.tools.length + ' commonly used</span></div>' +
    (s.sub ? '<p class="ts-sub">' + esc(s.sub) + '</p>' : '') +
    '<div class="ts-cards">' + s.tools.map(card).join('') + '</div>';
});
})();
