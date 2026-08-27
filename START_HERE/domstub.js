
/* ============================================================
   A minimal DOM good enough to boot a static page's app.js.
   Not a browser: it exists so `node test.js` catches the class of
   bug that only shows up on load — a typo'd id, a helper that was
   never defined, a handler wired to an element that is not there.

   The one thing it does properly is track ids: setting innerHTML
   registers any id="..." in the assigned markup, so a demo that
   renders controls and then wires them up behaves the way it does
   in a browser instead of hitting null.
   ============================================================ */
function makeDom(html) {
  const nodes = new Map();
  const byClass = new Map();
  const ctx2d = new Proxy({}, { get: () => () => ({}) });

  function register(markup) {
    for (const m of String(markup).matchAll(/id="([^"]+)"/g)) {
      if (!nodes.has(m[1])) nodes.set(m[1], node('div', m[1]));
    }
    for (const m of String(markup).matchAll(/class="([^"$]+)"/g)) {
      m[1].split(/\s+/).forEach(c => {
        if (!c) return;
        if (!byClass.has(c)) byClass.set(c, []);
        if (byClass.get(c).length < 8) byClass.get(c).push(node('div'));
      });
    }
  }

  function node(tag, id) {
    const n = {
      tagName: (tag || 'div').toUpperCase(), id: id || '', _html: '',
      value: '1', textContent: '', innerText: '',
      dataset: {}, style: {}, hidden: false, disabled: false, checked: false,
      children: [], parentNode: null,
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); },
        remove(...c) { c.forEach(x => this._s.delete(x)); },
        toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
        contains(c) { return this._s.has(c); }
      },
      get innerHTML() { return this._html; },
      set innerHTML(v) { this._html = String(v); register(v); },
      appendChild(c) { if (c) { this.children.push(c); c.parentNode = this; register(c._html || ''); } return c; },
      append(...cs) { cs.forEach(c => { if (c && typeof c === 'object') this.appendChild(c); }); },
      prepend(...cs) { this.append(...cs); },
      insertBefore(c) { return this.appendChild(c); },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
      remove() {},
      replaceChildren() { this.children = []; },
      querySelector(sel) { return document.querySelector(sel); },
      querySelectorAll(sel) { return document.querySelectorAll(sel); },
      closest() { return null; },
      matches() { return false; },
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
      scrollIntoView() {}, focus() {}, blur() {}, click() {},
      getContext() { return ctx2d; },
      getBoundingClientRect() { return { x: 0, y: 0, width: 300, height: 150, top: 0, left: 0, right: 300, bottom: 150 }; },
      getTotalLength() { return 100; },
      getPointAtLength(l) { return { x: l, y: l / 2 }; },
      setAttribute(k, v) { if (k === 'id') { this.id = v; nodes.set(v, this); } },
      getAttribute() { return null; },
      removeAttribute() {},
      setAttributeNS() {}, appendChildNS() {},
      insertAdjacentHTML(_, v) { this._html += v; register(v); },
      animate() { return { finished: Promise.resolve(), cancel() {} }; }
    };
    return n;
  }

  register(html);

  const document = {
    body: node('body'),
    head: node('head'),
    documentElement: node('html'),
    activeElement: node('div'),
    createElement: t => node(t),
    createElementNS: (_, t) => node(t),
    createTextNode: t => { const n = node('#text'); n.textContent = String(t); return n; },
    createDocumentFragment: () => node('fragment'),
    getElementById: id => nodes.get(id) || null,
    getElementsByClassName: c => byClass.get(c) || [],
    querySelector(sel) {
      const s = sel.trim();
      if (s[0] === '#') return nodes.get(s.slice(1).split(/[\s.[:]/)[0]) || null;
      if (s[0] === '.') { const l = byClass.get(s.slice(1).split(/[\s.[:>]/)[0]); return (l && l[0]) || node('div'); }
      return node('div');
    },
    querySelectorAll(sel) {
      const s = sel.trim();
      if (s[0] === '.') return (byClass.get(s.slice(1).split(/[\s.[:>,]/)[0]) || []).slice();
      if (s[0] === '#') { const n = nodes.get(s.slice(1).split(/[\s.[:]/)[0]); return n ? [n] : []; }
      if (s.includes('[data-')) return [node('div'), node('div')];
      return [];
    },
    addEventListener() {}, removeEventListener() {}
  };

  const store = {};
  const window = {
    document,
    innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; }
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    scrollTo() {}, open() {}, print() {},
    confirm: () => false, alert() {}, prompt: () => null,
    setTimeout: () => 0, clearTimeout() {},
    setInterval: () => 0, clearInterval() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    location: { reload() {}, href: '', hash: '' },
    history: { pushState() {}, replaceState() {} },
    CustomEvent: function (t, o) { return { type: t, detail: o && o.detail }; },
    IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
    console
  };
  window.window = window;
  return { window, document, nodes };
}
module.exports = { makeDom };
