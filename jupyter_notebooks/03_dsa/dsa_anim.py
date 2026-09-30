"""Step-by-step animations for the top-100 DSA notebooks.

A solution records what it is doing, one frame at a time, and `show()` turns the
frames into a small player (play, pause, step, speed) that runs inside the
notebook. Nothing is drawn by hand: every frame is recorded while the real
algorithm runs, so the picture always matches the code.

    from dsa_anim import Movie, arr, hmap, note

    m = Movie("Two Sum", "Find two cards that add up to 9")
    m.step("Look at the first card, 2.", arr([2, 7, 11, 15], ptr={"i": 0}, hi={0: "look"}))
    m.show()

Colour roles, used everywhere so they always mean the same thing:
    look  yellow  "looking at this right now"
    good  green   "yes! part of the answer"
    bad   red     "no, this one does not work"
    done  grey    "finished with this"
    win   blue    "inside the window / range"
    swap  orange  "moving or swapping"
    new   purple  "just added"
    land, water   for grid maps (islands, flood fill)
"""

from __future__ import annotations

import html
import json
import math
import uuid

ROLES = {
    "look": "looking at it now",
    "good": "yes — part of the answer",
    "bad": "no — does not work",
    "done": "finished",
    "win": "inside the window",
    "swap": "moving / swapping",
    "new": "just added",
    "land": "land",
    "water": "water",
}
MAX_FRAMES = 400


def _lab(x) -> str:
    """How one value is written inside a box."""
    if x is None:
        return "·"
    if isinstance(x, bool):
        return "T" if x else "F"
    if isinstance(x, float):
        if math.isinf(x):
            return "∞" if x > 0 else "-∞"
        return f"{x:g}"
    return str(x)


def _roles(hi, key=str):
    return {key(k): v for k, v in (hi or {}).items()}


def _ptrs(ptr, key=str):
    """{"L": 0, "R": 3} -> {"0": ["L"], "3": ["R"]}; skips pointers that are None or off the end."""
    out: dict[str, list[str]] = {}
    for name, where in (ptr or {}).items():
        if where is None:
            continue
        out.setdefault(key(where), []).append(name)
    return out


# ---------------------------------------------------------------- panels

def arr(values, title="", hi=None, ptr=None, win=None, index=True):
    """A row of boxes. hi={index: role}, ptr={"L": index}, win=(left, right) inclusive."""
    return {"t": "arr", "title": title, "v": [_lab(x) for x in values], "hi": _roles(hi),
            "ptr": _ptrs(ptr), "win": list(win) if win else None, "idx": index}


def bars(values, title="", hi=None, ptr=None, area=None):
    """Bars whose heights are the numbers. area=(left, right, height) shades water between two bars."""
    return {"t": "bars", "title": title, "v": [float(x) for x in values], "hi": _roles(hi),
            "ptr": _ptrs(ptr), "area": list(area) if area else None}


def hmap(d, title="", hi=None):
    """A dictionary (or a set) drawn as key → value tags. hi={key: role} or a single key."""
    if isinstance(d, (set, frozenset)):
        items = [[_lab(k), None] for k in sorted(d, key=lambda k: (str(type(k)), k))]
    else:
        items = [[_lab(k), _lab(v)] for k, v in d.items()]
    if hi is not None and not isinstance(hi, dict):
        hi = {hi: "look"}
    return {"t": "map", "title": title, "items": items, "hi": _roles(hi, _lab)}


def stack(items, title="stack", hi=None):
    """A stack of plates: the last item is on top."""
    return {"t": "stack", "title": title, "v": [_lab(x) for x in items], "hi": _roles(hi)}


def queue(items, title="queue", hi=None):
    """A line of people: front on the left, back on the right."""
    return {"t": "queue", "title": title, "v": [_lab(x) for x in items], "hi": _roles(hi)}


def chain(values, title="", nexts=None, hi=None, ptr=None):
    """Linked-list nodes in a row. nexts[i] = index that node i points to (None = nowhere).
    By default each node points to the one on its right and the last points to nothing."""
    n = len(values)
    if nexts is None:
        nexts = [i + 1 if i + 1 < n else None for i in range(n)]
    return {"t": "chain", "title": title, "v": [_lab(x) for x in values], "nx": list(nexts),
            "hi": _roles(hi), "ptr": _ptrs(ptr)}


def chain_of(head, title="", hi=None, ptr=None, limit=30):
    """Draw a real linked list starting at `head`. hi={node: role}, ptr={"slow": node}.
    Stops after `limit` nodes, so a list with a cycle still draws."""
    nodes, pos, cur = [], {}, head
    while cur is not None and id(cur) not in pos and len(nodes) < limit:
        pos[id(cur)] = len(nodes)
        nodes.append(cur)
        cur = cur.next
    nexts = [pos.get(id(nd.next)) if nd.next is not None else None for nd in nodes]
    return chain([nd.val for nd in nodes], title, nexts,
                 {pos[id(k)]: r for k, r in (hi or {}).items() if id(k) in pos},
                 {name: pos.get(id(nd)) for name, nd in (ptr or {}).items() if nd is not None})


def tree(root, title="", hi=None, ptr=None):
    """Draw a binary tree of nodes with .val/.left/.right. hi={node: role}, ptr={"cur": node}."""
    nodes, edges, order = [], [], []

    def walk(nd, depth):                       # in-order position = x, depth = y
        if nd is None:
            return
        walk(nd.left, depth + 1)
        order.append((nd, depth))
        walk(nd.right, depth + 1)

    walk(root, 0)
    x_of = {id(nd): i for i, (nd, _) in enumerate(order)}
    roles = {id(k): r for k, r in (hi or {}).items() if k is not None}
    for nd, depth in order:
        nodes.append({"id": id(nd) % 10**9, "v": _lab(nd.val), "x": x_of[id(nd)], "y": depth,
                      "r": roles.get(id(nd))})
        for child in (nd.left, nd.right):
            if child is not None:
                edges.append([id(nd) % 10**9, id(child) % 10**9])
    return {"t": "tree", "title": title, "nodes": nodes, "edges": edges,
            "ptr": _ptrs({k: v for k, v in (ptr or {}).items() if v is not None},
                         key=lambda nd: str(id(nd) % 10**9))}


def grid(rows, title="", hi=None, cmap=None, row_labels=None, col_labels=None):
    """A 2-D table. hi={(r, c): role}; cmap={value: role} colours cells by what they hold."""
    return {"t": "grid", "title": title, "v": [[_lab(x) for x in row] for row in rows],
            "hi": {f"{r},{c}": role for (r, c), role in (hi or {}).items()},
            "cmap": {_lab(k): v for k, v in (cmap or {}).items()},
            "rl": [_lab(x) for x in row_labels] if row_labels else None,
            "cl": [_lab(x) for x in col_labels] if col_labels else None}


def graph(nodes, edges, title="", hi=None, ehi=None, directed=False, pos=None, weights=None):
    """Circles joined by lines. edges=[(u, v)]; weights={(u, v): w}; hi={node: role};
    ehi={(u, v): role}; pos={node: (x, y)} in 0..1, otherwise the nodes sit on a circle."""
    nodes = list(nodes)
    if pos is None:
        k = len(nodes)
        pos = {nd: (0.5 + 0.42 * math.cos(2 * math.pi * i / k - math.pi / 2),
                    0.5 + 0.42 * math.sin(2 * math.pi * i / k - math.pi / 2)) for i, nd in enumerate(nodes)}
    ehi = {(str(a), str(b)): r for (a, b), r in (ehi or {}).items()}
    weights = {(str(a), str(b)): w for (a, b), w in (weights or {}).items()}
    out_edges = []
    for a, b in edges:
        key = (str(a), str(b))
        role = ehi.get(key) or (None if directed else ehi.get((str(b), str(a))))
        w = weights.get(key, weights.get((str(b), str(a))) if not directed else None)
        out_edges.append({"a": str(a), "b": str(b), "r": role, "w": _lab(w) if w is not None else None})
    return {"t": "graph", "title": title, "directed": directed, "edges": out_edges,
            "nodes": [{"id": str(nd), "v": _lab(nd), "x": pos[nd][0], "y": pos[nd][1],
                       "r": (hi or {}).get(nd)} for nd in nodes]}


def note(**values):
    """Little labelled chips: note(best=5, target=9)."""
    return {"t": "vars", "items": [[k, _lab(v)] for k, v in values.items()]}


def say(text):
    """A line of plain text inside the picture."""
    return {"t": "text", "s": text}


# ---------------------------------------------------------------- the movie

class Movie:
    """Collect frames with step(), then show() the player."""

    def __init__(self, title, subtitle=""):
        self.title, self.subtitle, self.frames = title, subtitle, []

    def step(self, caption, *panels):
        if len(self.frames) >= MAX_FRAMES:
            raise RuntimeError(f"more than {MAX_FRAMES} frames: animate a smaller example")
        self.frames.append({"cap": caption, "panels": json.loads(json.dumps(list(panels)))})
        return self

    def __len__(self):
        return len(self.frames)

    def _used_roles(self):
        used = set()

        def scan(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    if k in ("hi", "cmap") and isinstance(v, dict):
                        used.update(r for r in v.values() if isinstance(r, str))
                    elif k == "r" and isinstance(v, str):
                        used.add(v)
                    elif k == "win" and v:
                        used.add("win")          # a window is drawn blue even without a per-box role
                    else:
                        scan(v)
            elif isinstance(x, list):
                for y in x:
                    scan(y)

        scan(self.frames)
        return [[r, ROLES[r]] for r in ROLES if r in used]

    def html(self) -> str:
        uid = "dsa" + uuid.uuid4().hex[:10]
        data = {"title": self.title, "sub": self.subtitle, "frames": self.frames, "legend": self._used_roles()}
        steps = "".join(f"<li>{html.escape(f['cap'])}</li>" for f in self.frames)
        payload = json.dumps(data).replace("</", "<\\/")
        return (f'<div id="{uid}" class="dsa-anim">{_CSS}'
                f'<div class="dsa-fallback"><b>{html.escape(self.title)}</b> — {len(self.frames)} steps '
                f'(the player needs JavaScript; the steps are listed below).</div>'
                f'<details class="dsa-text"><summary>Read the steps as text</summary><ol>{steps}</ol></details>'
                f'<script>(function(){{var DATA={payload};{_JS};dsaPlay(document.getElementById("{uid}"),DATA);}})();'
                f'</script></div>')

    def _repr_html_(self):
        return self.html()

    def show(self):
        from IPython.display import HTML, display
        display(HTML(self.html()))


_CSS = """<style>
.dsa-anim{--ink:#1d1d1b;--muted:#6b6a66;--card:#fbfaf7;--line:#d9d7cf;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;
 color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:8px 0;max-width:900px}
.dsa-anim .dsa-h{font-weight:650;font-size:16px}.dsa-anim .dsa-sub{color:var(--muted);margin-bottom:8px}
.dsa-anim .dsa-stage{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:flex-start;min-height:60px}
.dsa-anim .dsa-panel{max-width:100%;overflow-x:auto}.dsa-anim .dsa-pt{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:2px}
.dsa-anim .dsa-cap{background:#fff;border:1px solid var(--line);border-left:4px solid #eda100;border-radius:8px;padding:8px 12px;
 margin:10px 0;font-size:15px;min-height:24px}
.dsa-anim .dsa-cap code{background:#f1efe8;border-radius:4px;padding:0 4px;font-size:13px}
.dsa-anim .dsa-ctl{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dsa-anim button{font:inherit;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:8px;padding:3px 10px;cursor:pointer}
.dsa-anim button:hover{background:#f1efe8}.dsa-anim button.dsa-play{background:#2a78d6;color:#fff;border-color:#2a78d6;min-width:78px}
.dsa-anim .dsa-count{color:var(--muted);margin-left:6px;font-variant-numeric:tabular-nums}
.dsa-anim .dsa-bar{height:4px;background:#ebe9e2;border-radius:2px;margin:8px 0 4px}.dsa-anim .dsa-bar>div{height:100%;background:#2a78d6;border-radius:2px;width:0}
.dsa-anim .dsa-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);margin-top:6px}
.dsa-anim .dsa-leg span{display:inline-flex;align-items:center;gap:4px}.dsa-anim .dsa-leg i{width:12px;height:12px;border-radius:3px;border:1.5px solid;display:inline-block}
.dsa-anim .dsa-text{font-size:12px;color:var(--muted);margin-top:6px}.dsa-anim .dsa-text ol{margin:4px 0;padding-left:22px}
.dsa-anim svg text{font-family:ui-monospace,"Cascadia Code",Consolas,monospace}
.dsa-anim select{font:inherit;border:1px solid var(--line);border-radius:8px;padding:2px 4px;background:#fff;color:var(--ink)}
</style>"""

_JS = r"""
function dsaPlay(root, D) {
  var COL = {look:["#fff3c4","#d99a00"], good:["#d4f5e6","#12936a"], bad:["#fde0dd","#d23a38"], done:["#ececea","#9a9994"],
             win:["#dcebfb","#2a78d6"], swap:["#ffe2d3","#eb6834"], new:["#efe4fb","#7a4bd1"],
             land:["#cfe8c4","#4c8a3f"], water:["#dcecf8","#8bb8d8"]};
  var PLAIN = ["#ffffff", "#8a8983"], INK = "#1d1d1b", MUTED = "#6b6a66";
  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function col(r) { return COL[r] || PLAIN; }
  function fs(s, w) { var n = String(s).length; return Math.max(9, Math.min(17, (w - 6) / Math.max(1, n) * 1.7)); }
  function txt(x, y, s, size, color, weight, anchor) {
    return '<text x="'+x+'" y="'+y+'" font-size="'+(size||14)+'" fill="'+(color||INK)+'" text-anchor="'+(anchor||"middle")+
           '" dominant-baseline="central"'+(weight?' font-weight="'+weight+'"':'')+'>'+esc(s)+'</text>';
  }
  function box(x, y, w, h, role, rx) {
    var c = col(role);
    return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(rx==null?6:rx)+'" fill="'+c[0]+'" stroke="'+c[1]+'" stroke-width="'+(role?2.2:1.2)+'"/>';
  }
  function head(x1, y1, x2, y2, color) {
    var a = Math.atan2(y2-y1, x2-x1), s = 7;
    return '<polygon points="'+x2+','+y2+' '+(x2-s*Math.cos(a-0.45))+','+(y2-s*Math.sin(a-0.45))+' '+
           (x2-s*Math.cos(a+0.45))+','+(y2-s*Math.sin(a+0.45))+'" fill="'+color+'"/>';
  }
  function arrow(x1, y1, x2, y2, color, w) {
    return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+(w||1.8)+'"/>'+head(x1,y1,x2,y2,color);
  }
  function ptrLabels(names, cx, y) {
    var s = names.join(",");
    return txt(cx, y, s, 12, "#b0461c", 700) + arrow(cx, y+8, cx, y+19, "#b0461c", 1.6);
  }
  function svg(w, h, body) { return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="max-width:100%;height:auto">'+body+'</svg>'; }

  var R = {};
  R.arr = function (p) {
    var n = p.v.length, mx = 1;
    p.v.forEach(function (s) { mx = Math.max(mx, String(s).length); });
    var cw = Math.max(40, mx * 9 + 14), g = 4, top = 30, h = 40, W = Math.max(60, n * (cw + g) + 8), b = "";
    if (p.win) { var l = p.win[0], r = p.win[1];
      if (r >= l) b += '<rect x="'+(4+l*(cw+g)-3)+'" y="'+(top-4)+'" width="'+((r-l+1)*(cw+g)+2)+'" height="'+(h+8)+'" rx="9" fill="#dcebfb" stroke="#2a78d6" stroke-dasharray="5 3" stroke-width="1.6"/>'; }
    for (var i = 0; i < n; i++) {
      var x = 4 + i * (cw + g), role = p.hi[i];
      if (!role && p.win && i >= p.win[0] && i <= p.win[1]) role = "win";
      b += box(x, top, cw, h, role) + txt(x + cw/2, top + h/2, p.v[i], fs(p.v[i], cw), INK, 600);
      if (p.idx) b += txt(x + cw/2, top + h + 12, i, 10, MUTED);
      if (p.ptr[i]) b += ptrLabels(p.ptr[i], x + cw/2, 7);
    }
    if (!n) b += txt(30, top + h/2, "(empty)", 12, MUTED);
    return svg(W, top + h + (p.idx ? 22 : 6), b);
  };
  R.bars = function (p) {
    var n = p.v.length, mx = Math.max.apply(null, p.v.concat([1])), bw = 34, g = 8, H = 130, top = 30, W = n * (bw + g) + 8, b = "";
    var y0 = top + H;
    if (p.area) { var l = p.area[0], r = p.area[1], ah = p.area[2] / mx * H;
      b += '<rect x="'+(4+l*(bw+g)+bw/2)+'" y="'+(y0-ah)+'" width="'+((r-l)*(bw+g))+'" height="'+ah+'" fill="#bcdcf7" opacity="0.8"/>'; }
    for (var i = 0; i < n; i++) {
      var x = 4 + i * (bw + g), bh = Math.max(2, p.v[i] / mx * H);
      b += box(x, y0 - bh, bw, bh, p.hi[i], 3) + txt(x + bw/2, y0 - bh - 9, p.v[i], 11, INK, 600) + txt(x + bw/2, y0 + 11, i, 10, MUTED);
      if (p.ptr[i]) b += txt(x + bw/2, y0 + 27, p.ptr[i].join(","), 12, "#b0461c", 700);
    }
    return svg(W, y0 + 36, b);
  };
  R.map = function (p) {
    var x = 4, y = 4, rowH = 34, maxW = 560, b = "", W = 60;
    if (!p.items.length) return svg(90, 34, txt(40, 17, "{ } empty", 12, MUTED));
    p.items.forEach(function (it) {
      var label = it[1] == null ? it[0] : it[0] + " → " + it[1], w = String(label).length * 8.4 + 18;
      if (x + w > maxW && x > 4) { x = 4; y += rowH; }
      var role = p.hi[it[0]];
      b += box(x, y, w, 28, role, 14) + txt(x + w/2, y + 14, label, 13, INK, 600);
      x += w + 6; W = Math.max(W, x);
    });
    return svg(W, y + rowH, b);
  };
  R.stack = function (p) {
    var n = p.v.length, show = Math.min(n, 10), w = 96, h = 26, W = w + 70, H = show * (h + 3) + 30, b = "";
    b += '<path d="M4,'+(H-8)+' L'+(w+14)+','+(H-8)+'" stroke="'+MUTED+'" stroke-width="2"/>';
    for (var k = 0; k < show; k++) {
      var i = n - show + k, y = H - 12 - (k + 1) * (h + 3);
      b += box(9, y, w, h, p.hi[i], 5) + txt(9 + w/2, y + h/2, p.v[i], 13, INK, 600);
      if (i === n - 1) b += txt(w + 18, y + h/2, "← top", 11, "#b0461c", 700, "start");
    }
    if (n > show) b += txt(9 + w/2, 10, "… " + (n - show) + " more below", 10, MUTED);
    if (!n) b += txt(9 + w/2, H - 22, "(empty)", 12, MUTED);
    return svg(W, H, b);
  };
  R.queue = function (p) {
    var n = p.v.length, cw = 44, g = 4, W = Math.max(120, n * (cw + g) + 70), b = "";
    b += txt(4, 20, "front", 11, "#b0461c", 700, "start");
    for (var i = 0; i < n; i++) { var x = 42 + i * (cw + g);
      b += box(x, 4, cw, 32, p.hi[i]) + txt(x + cw/2, 20, p.v[i], fs(p.v[i], cw), INK, 600); }
    if (!n) b += txt(70, 20, "(empty)", 12, MUTED, null, "start");
    else b += txt(42 + n * (cw + g) + 2, 20, "back", 11, MUTED, 700, "start");
    return svg(W, 42, b);
  };
  R.chain = function (p) {
    var n = p.v.length, sp = 74, r = 19, top = 34, cy = top + r + 22, W = Math.max(80, n * sp + 20), b = "", H = cy + r + 40;
    function cx(i) { return 30 + i * sp; }
    for (var i = 0; i < n; i++) {
      var j = p.nx[i], c = "#5d5c57";
      if (j == null) { b += arrow(cx(i), cy + r, cx(i), cy + r + 16, "#b3b2ab", 1.4) + txt(cx(i), cy + r + 26, "∅", 12, MUTED); continue; }
      if (j === i + 1) b += arrow(cx(i) + r, cy, cx(j) - r - 2, cy, c);
      else if (j === i - 1) b += arrow(cx(i) - r, cy + 6, cx(j) + r + 2, cy + 6, "#eb6834");
      else { var x1 = cx(i), x2 = cx(j), up = j > i ? -1 : 1, lift = 26 + Math.abs(j - i) * 5, mx = (x1 + x2) / 2, my = cy + up * (r + lift);
        var ex = x2 + (j > i ? -4 : 4), ey = cy + up * r;
        b += '<path d="M'+x1+','+(cy+up*r)+' Q'+mx+','+my+' '+ex+','+ey+'" fill="none" stroke="'+(j<i?"#d23a38":c)+'" stroke-width="1.8"/>' + head(mx, my, ex, ey, j<i?"#d23a38":c);
        if (up < 0) top = Math.min(top, my); else H = Math.max(H, my + 16); }
    }
    for (var i = 0; i < n; i++) {
      var cc = col(p.hi[i]);
      b += '<circle cx="'+cx(i)+'" cy="'+cy+'" r="'+r+'" fill="'+cc[0]+'" stroke="'+cc[1]+'" stroke-width="'+(p.hi[i]?2.4:1.3)+'"/>' + txt(cx(i), cy, p.v[i], fs(p.v[i], 2*r), INK, 600);
      if (p.ptr[i]) b += ptrLabels(p.ptr[i], cx(i), cy - r - 26);
    }
    if (!n) b += txt(40, cy, "(empty)", 12, MUTED);
    return svg(W, H, b);
  };
  R.tree = function (p) {
    if (!p.nodes.length) return svg(90, 34, txt(40, 17, "(empty tree)", 12, MUTED));
    var sx = 46, sy = 62, r = 18, ox = 26, oy = 40, pos = {}, b = "", W = 0, H = 0;
    p.nodes.forEach(function (nd) { pos[nd.id] = [ox + nd.x * sx, oy + nd.y * sy]; W = Math.max(W, pos[nd.id][0] + 30); H = Math.max(H, pos[nd.id][1] + 28); });
    p.edges.forEach(function (e) { var a = pos[e[0]], c = pos[e[1]]; b += '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+c[0]+'" y2="'+c[1]+'" stroke="#9a9994" stroke-width="1.6"/>'; });
    p.nodes.forEach(function (nd) { var q = pos[nd.id], cc = col(nd.r);
      b += '<circle cx="'+q[0]+'" cy="'+q[1]+'" r="'+r+'" fill="'+cc[0]+'" stroke="'+cc[1]+'" stroke-width="'+(nd.r?2.4:1.3)+'"/>' + txt(q[0], q[1], nd.v, fs(nd.v, 2*r), INK, 600);
      if (p.ptr[nd.id]) b += txt(q[0] + r + 4, q[1] - r, p.ptr[nd.id].join(","), 12, "#b0461c", 700, "start"); });
    return svg(W + 20, H, b);
  };
  R.grid = function (p) {
    var rows = p.v.length, cols = rows ? p.v[0].length : 0, mx = 1;
    p.v.forEach(function (row) { row.forEach(function (s) { mx = Math.max(mx, String(s).length); }); });
    var cw = Math.max(32, mx * 9 + 12), ch = 32, ox = p.rl ? 34 : 4, oy = p.cl ? 20 : 4, b = "";
    if (p.cl) p.cl.forEach(function (s, c) { b += txt(ox + c * cw + cw/2, 10, s, 11, MUTED, 600); });
    for (var r = 0; r < rows; r++) {
      if (p.rl) b += txt(ox - 6, oy + r * ch + ch/2, p.rl[r], 11, MUTED, 600, "end");
      for (var c = 0; c < cols; c++) {
        var s = p.v[r][c], role = p.hi[r + "," + c] || p.cmap[s];
        b += box(ox + c * cw, oy + r * ch, cw, ch, role, 0) + txt(ox + c * cw + cw/2, oy + r * ch + ch/2, s, fs(s, cw), INK, 600);
      }
    }
    return svg(ox + cols * cw + 6, oy + rows * ch + 6, b);
  };
  R.graph = function (p) {
    var W = 380, H = 250, r = 18, pos = {}, b = "";
    p.nodes.forEach(function (nd) { pos[nd.id] = [30 + nd.x * (W - 60), 24 + nd.y * (H - 48)]; });
    p.edges.forEach(function (e) {
      var a = pos[e.a], c = pos[e.b]; if (!a || !c) return;
      var color = e.r ? col(e.r)[1] : "#a3a29b", w = e.r ? 3 : 1.6, dx = c[0] - a[0], dy = c[1] - a[1], L = Math.sqrt(dx*dx + dy*dy) || 1;
      var x1 = a[0] + dx / L * r, y1 = a[1] + dy / L * r, x2 = c[0] - dx / L * (r + 2), y2 = c[1] - dy / L * (r + 2);
      b += p.directed ? arrow(x1, y1, x2, y2, color, w) : '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+w+'"/>';
      if (e.w != null) b += '<rect x="'+((a[0]+c[0])/2-11)+'" y="'+((a[1]+c[1])/2-9)+'" width="22" height="18" rx="4" fill="#fff" stroke="#d9d7cf"/>' + txt((a[0]+c[0])/2, (a[1]+c[1])/2, e.w, 11, "#2a78d6", 700);
    });
    p.nodes.forEach(function (nd) { var q = pos[nd.id], cc = col(nd.r);
      b += '<circle cx="'+q[0]+'" cy="'+q[1]+'" r="'+r+'" fill="'+cc[0]+'" stroke="'+cc[1]+'" stroke-width="'+(nd.r?2.6:1.3)+'"/>' + txt(q[0], q[1], nd.v, fs(nd.v, 2*r), INK, 600); });
    return svg(W, H, b);
  };
  R.vars = function (p) {
    var x = 2, b = "";
    p.items.forEach(function (it) { var s = it[0] + " = " + it[1], w = s.length * 8 + 18;
      b += '<rect x="'+x+'" y="2" width="'+w+'" height="26" rx="13" fill="#f1efe8" stroke="#d9d7cf"/>' + txt(x + w/2, 15, s, 13, INK, 600); x += w + 6; });
    return svg(Math.max(20, x), 30, b);
  };
  R.text = function (p) { return '<div style="font-size:14px;padding:4px 0">' + esc(p.s) + '</div>'; };

  function capHTML(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }

  var i = 0, timer = null, n = D.frames.length, speed = 1100;
  root.querySelector(".dsa-fallback").style.display = "none";
  var ui = document.createElement("div");
  ui.innerHTML = '<div class="dsa-h">🎬 ' + esc(D.title) + '</div>' + (D.sub ? '<div class="dsa-sub">' + esc(D.sub) + '</div>' : '') +
    '<div class="dsa-stage"></div><div class="dsa-cap"></div>' +
    '<div class="dsa-ctl"><button data-a="first" title="first step">⏮</button><button data-a="prev" title="previous step">◀ back</button>' +
    '<button data-a="play" class="dsa-play">▶ play</button><button data-a="next" title="next step">next ▶</button>' +
    '<button data-a="last" title="last step">⏭</button><select title="speed"><option value="2000">slow</option>' +
    '<option value="1100" selected>normal</option><option value="500">fast</option></select><span class="dsa-count"></span></div>' +
    '<div class="dsa-bar"><div></div></div><div class="dsa-leg"></div>';
  root.insertBefore(ui, root.querySelector(".dsa-text"));
  var stage = ui.querySelector(".dsa-stage"), cap = ui.querySelector(".dsa-cap"), cnt = ui.querySelector(".dsa-count"),
      bar = ui.querySelector(".dsa-bar>div"), playBtn = ui.querySelector(".dsa-play");
  ui.querySelector(".dsa-leg").innerHTML = D.legend.map(function (l) { var c = col(l[0]);
    return '<span><i style="background:' + c[0] + ';border-color:' + c[1] + '"></i>' + esc(l[1]) + '</span>'; }).join("");
  function draw() {
    var f = D.frames[i]; if (!f) { cap.textContent = "(no steps recorded)"; return; }
    stage.innerHTML = f.panels.map(function (p) {
      var body = R[p.t] ? R[p.t](p) : esc(JSON.stringify(p));
      return '<div class="dsa-panel">' + (p.title ? '<div class="dsa-pt">' + esc(p.title) + '</div>' : '') + body + '</div>';
    }).join("");
    cap.innerHTML = capHTML(f.cap);
    cnt.textContent = "step " + (i + 1) + " / " + n;
    bar.style.width = (n > 1 ? i / (n - 1) * 100 : 100) + "%";
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } playBtn.textContent = i >= n - 1 ? "↺ again" : "▶ play"; }
  function play() {
    if (i >= n - 1) i = 0;
    draw(); playBtn.textContent = "⏸ pause";
    timer = setInterval(function () { if (i < n - 1) { i++; draw(); } if (i >= n - 1) stop(); }, speed);
  }
  ui.querySelector(".dsa-ctl").addEventListener("click", function (e) {
    var a = e.target.getAttribute && e.target.getAttribute("data-a"); if (!a) return;
    if (a === "play") { if (timer) stop(); else play(); return; }
    stop();
    if (a === "first") i = 0; if (a === "last") i = n - 1;
    if (a === "prev") i = Math.max(0, i - 1); if (a === "next") i = Math.min(n - 1, i + 1);
    draw(); stop();
  });
  ui.querySelector("select").addEventListener("change", function (e) { speed = +e.target.value; if (timer) { stop(); play(); } });
  draw();
}
"""
