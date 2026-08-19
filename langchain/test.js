/* Smallest check that fails if the course data rots.
   Run: node test.js                                        */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = {};
ctx.window = ctx;          // content.js writes window.C, which is a global in the browser
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/content.js', 'utf8'), ctx);
const C = ctx.window.C;

// quiz answers must index a real option
C.quiz.forEach((q, i) => assert(q.o[q.a] !== undefined, `quiz ${i} has a bad answer index`));

// ch1: every verdict band must be reachable from some combination of needs,
// otherwise the widget can never show it
const total = C.needs.reduce((a, n) => a + n.raw, 0);
C.whyVerdicts.forEach((v, i) => {
  const lower = i === 0 ? 0 : C.whyVerdicts[i - 1].max + 1;
  assert(lower <= total, `verdict "${v.v}" is unreachable — needs more than ${total} lines`);
});
// LangChain must never be the more verbose option for a need it exists to solve
C.needs.filter(n => n.id !== 'one').forEach(n =>
  assert(n.lc < n.raw, `need "${n.label}" claims LangChain is more code`));

// ch4: the chain builder's default chain must type-check under its own rules
const ACCEPTS = {
  prompt: ['dict'], model: ['messages'], parser: ['aimessage'],
  retriever: ['dict', 'str'], lambda: ['docs', 'str', 'dict', 'messages', 'aimessage']
};
const PRODUCES = { prompt: 'messages', model: 'aimessage', parser: 'str', retriever: 'docs', lambda: 'str' };
const partKeys = new Set(C.lcelParts.map(p => p.k));
Object.keys(ACCEPTS).forEach(k => assert(partKeys.has(k), `lcelParts is missing "${k}"`));
['prompt', 'model', 'parser'].reduce((prev, k) => {
  if (prev) assert(ACCEPTS[k].includes(PRODUCES[prev]), `default chain breaks at ${prev} | ${k}`);
  return k;
}, null);

// ch5: exactly one parser mode should be the deliberate failure, and it must be a JSON one
const bad = C.parserModes.filter(p => !p.ok);
assert(bad.length === 1 && bad[0].k.startsWith('json'), 'expected exactly one failing JSON parser demo');

// ch6/7: the same scoring function the demo uses must retrieve the intended doc
function score(query, doc) {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  if (!q.length) return 0;
  let hits = 0;
  q.forEach(w => {
    if (doc.keys.some(k => k.includes(w) || w.includes(k))) hits += 1;
    else if (doc.text.toLowerCase().includes(w)) hits += 0.45;
  });
  return Math.min(0.94, 0.18 + hits / q.length * 0.72);
}
C.ragQuestions.forEach(rq => {
  const top = C.kb.map(d => ({ d, s: score(rq.q, d) })).sort((a, b) => b.s - a.s)[0];
  if (rq.hint === null) return;                       // the deliberate out-of-scope question
  assert(top.d.id === rq.hint,
    `"${rq.q}" retrieves ${top.d.id} (${top.s.toFixed(3)}), expected ${rq.hint}`);
  assert(C.ragAnswers[rq.hint], `no grounded answer written for ${rq.hint}`);
});

// ch9: the demo's point is two sessions asking the same thing — keep that
const sessions = new Set(C.histTurns.map(t => t.s));
assert(sessions.size === 2, 'history demo needs exactly two sessions to show isolation');
const repeated = C.histTurns.filter(t => t.u === C.histTurns[1].u);
assert(repeated.length === 2 && repeated[0].s !== repeated[1].s,
  'history demo must have both sessions ask one identical question');

// ch10: every tool the trace calls must be declared
const toolNames = new Set(C.agentTools.map(t => t.name));
C.agentTrace.filter(s => s.tool).forEach(s => {
  const name = s.tool.split('(')[0];
  assert(toolNames.has(name), `agentTrace calls undeclared tool "${name}"`);
});
assert(C.agentTrace[C.agentTrace.length - 1].k === 'final', 'agent trace never reaches a final answer');

// ch11: graph edges must reference declared nodes, and the run must visit a cycle
const nodeIds = new Set(C.graphNodes.map(n => n.id));
C.graphEdges.forEach(e => {
  assert(nodeIds.has(e[0]) && nodeIds.has(e[1]), `graph edge ${e[0]}->${e[1]} references an unknown node`);
});
C.graphRun.forEach(r => assert(nodeIds.has(r.node), `graphRun visits unknown node "${r.node}"`));
const visits = C.graphRun.map(r => r.node);
assert(visits.filter(n => n === 'retrieve').length > 1,
  'the graph demo must loop back through retrieve, or it does not show a cycle');
assert(visits[visits.length - 1] === 'end', 'graph run must terminate at END');

console.log('ok — content data is consistent');
