'use strict';
// Shared helpers: DOM utilities, storage, the in-browser judge (Web Workers) and seeded test generators.

/* ================= small utilities ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('verdict.v1.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('verdict.v1.' + k, JSON.stringify(v)); } catch (e) {} },
};
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';
const clip = (s, max = 1500) => s == null ? '' : (s.length > max ? s.slice(0, max) + ` … (${s.length.toLocaleString()} characters in total)` : s);
const fmtMs = ms => ms < 0.1 ? '< 0.1 ms' : ms < 10 ? ms.toFixed(2) + ' ms' : ms < 1000 ? ms.toFixed(1) + ' ms' : (ms / 1000).toFixed(2) + ' s';
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.round(s / 86400) + ' d ago';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800); }

/* ================= runtime helpers (also shipped into judge workers) ================= */
function ListNode(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; }
function TreeNode(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; }
function toList(a) { const head = new ListNode(); let cur = head; for (const v of a) { cur.next = new ListNode(v); cur = cur.next; } return head.next; }
function fromList(h) { const out = []; while (h) { if (out.length > 200000) throw new Error('the returned list never ends (is there a cycle?)'); out.push(h.val); h = h.next; } return out; }
function toTree(a) {
  if (!a.length || a[0] === null) return null;
  const root = new TreeNode(a[0]); const q = [root]; let qi = 0, i = 1;
  while (i < a.length && qi < q.length) {
    const n = q[qi++];
    if (a[i] !== null && a[i] !== undefined) { n.left = new TreeNode(a[i]); q.push(n.left); } i++;
    if (i < a.length && a[i] !== null && a[i] !== undefined) { n.right = new TreeNode(a[i]); q.push(n.right); } i++;
  }
  return root;
}
function fromTree(r) {
  const out = []; const q = [r]; let qi = 0;
  while (qi < q.length) {
    const n = q[qi++];
    if (n) { out.push(n.val); q.push(n.left, n.right); if (q.length > 400000) throw new Error('the returned tree is too large (is there a cycle?)'); }
    else out.push(null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
function decode(v, t) { return t === 'ListNode' ? toList(v) : t === 'TreeNode' ? toTree(v) : v; }
function encode(v, t) {
  if (t === 'ListNode' || t === 'TreeNode') { if (v === null) return []; if (v && typeof v === 'object' && !Array.isArray(v)) return t === 'ListNode' ? fromList(v) : fromTree(v); }
  return v;
}
function ser(v) { if (v === undefined) return 'undefined'; if (typeof v === 'function') return 'function'; const s = JSON.stringify(v); return s === undefined ? String(v) : s; }
function workerMain(getFn) {
  if (typeof self.ListNode === 'undefined') self.ListNode = ListNode;
  if (typeof self.TreeNode === 'undefined') self.TreeNode = TreeNode;
  let FN; try { FN = getFn(); } catch (e) {}
  let logs = null;
  const fmt = x => { if (typeof x === 'string') return x; try { const s = JSON.stringify(x); return s === undefined ? String(x) : s; } catch (e) { return String(x); } };
  const cap = (...a) => { if (logs && logs.length < 100) logs.push(a.map(fmt).join(' ').slice(0, 2000)); };
  ['log', 'info', 'warn', 'error', 'debug'].forEach(k => { console[k] = cap; });
  const lineOf = err => { const l = String(err && err.stack || '').split('\n').find(s => s.includes('blob:')); const m = l && /:(\d+):\d+\)?\s*$/.exec(l); return m ? +m[1] : null; };
  self.onmessage = e => {
    const { cases, types, ret } = e.data;
    if (typeof FN !== 'function') { postMessage({ type: 'missing' }); return; }
    for (let i = 0; i < cases.length; i++) {
      logs = [];
      const args = cases[i].map((v, j) => decode(v, types[j]));
      const t0 = performance.now();
      let out;
      try { out = FN(...args); }
      catch (err) { postMessage({ type: 'case', i, error: err && err.name ? err.name + ': ' + err.message : 'Thrown value: ' + fmt(err), line: lineOf(err), logs }); continue; }
      const dt = performance.now() - t0;
      let enc;
      try { enc = ser(encode(out, ret)); }
      catch (err) { postMessage({ type: 'case', i, error: 'Could not read the return value: ' + err.message, logs, dt }); continue; }
      postMessage({ type: 'case', i, out: enc, dt, logs });
    }
    postMessage({ type: 'done' });
  };
}
const HELPER_SRC = [ListNode, TreeNode, toList, fromList, toTree, fromTree, decode, encode, ser, workerMain].map(String).join('\n');

/* Runs code in a fresh worker. Resolves with {kind, results, error?, line?} */
function execute(code, p, cases, opts = {}) {
  return new Promise(resolve => {
    const src = code + '\n;(function(){\n' + HELPER_SRC + '\nworkerMain(function(){ return ' + p.fn + '; });\n})();\n';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url); } catch (err) { URL.revokeObjectURL(url); resolve({ kind: 'compile', error: String(err), results: [] }); return; }
    const results = [];
    const limit = opts.limit || 2000;
    let timer, done = false;
    const finish = r => { if (done) return; done = true; clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(r); };
    const arm = extra => { clearTimeout(timer); timer = setTimeout(() => finish({ kind: 'tle', results }), limit + (extra || 0)); };
    w.onmessage = e => {
      const m = e.data;
      if (m.type === 'missing') finish({ kind: 'missing', results });
      else if (m.type === 'case') {
        results.push(m);
        if (opts.onCase && opts.onCase(m, results.length - 1) === false) finish({ kind: 'stopped', results });
        else arm();
      } else if (m.type === 'done') finish({ kind: 'done', results });
    };
    w.onerror = e => { e.preventDefault(); finish({ kind: 'compile', error: String(e.message || 'The script failed to load.').replace(/^Uncaught\s+/, ''), line: e.lineno || null, results }); };
    arm(1500);
    w.postMessage({ cases, types: p.params.map(x => x[1]), ret: p.ret });
  });
}

/* ================= deterministic test generation ================= */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeR(seed) {
  const r = mulberry32(seed);
  const R = {
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    chance: p => r() < p,
    pick: a => a[Math.floor(r() * a.length)],
    arr: (n, a, b) => Array.from({ length: n }, () => R.int(a, b)),
    str: (n, al) => { let s = ''; for (let i = 0; i < n; i++) s += al[Math.floor(r() * al.length)]; return s; },
    shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    distinct: (n, a, b) => { const s = new Set(); while (s.size < n) s.add(R.int(a, b)); return [...s]; },
  };
  return R;
}
function balanced(R, half) {
  const open = '([{', close = ')]}', n = half * 2, st = []; let s = '';
  for (let k = 0; k < n; k++) {
    const rem = n - k;
    if (st.length && (st.length >= rem || R.chance(0.5))) s += close[st.pop()];
    else { const t = R.int(0, 2); st.push(t); s += open[t]; }
  }
  return s;
}
function randTree(R, n, chainy) {
  if (!n) return [];
  const root = new TreeNode(R.int(-100, 100));
  const slots = [[root, 'left'], [root, 'right']];
  for (let k = 1; k < n; k++) {
    const idx = chainy ? slots.length - 1 - R.int(0, 1) : R.int(0, slots.length - 1);
    const [par, side] = slots[idx];
    slots[idx] = slots[slots.length - 1]; slots.pop();
    const c = new TreeNode(R.int(-100, 100)); par[side] = c;
    slots.push([c, 'left'], [c, 'right']);
  }
  return fromTree(root);
}
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

function trapFigure([h]) {
  const n = h.length, top = Math.max(...h, 1), u = 18, W = n * u, H = (top + 1) * u;
  const L = [], Rt = []; let m = 0, total = 0;
  for (let i = 0; i < n; i++) { m = Math.max(m, h[i]); L[i] = m; }
  m = 0; for (let i = n - 1; i >= 0; i--) { m = Math.max(m, h[i]); Rt[i] = m; }
  let s = '';
  for (let y = 1; y <= top; y++) s += `<line x1="0" x2="${W}" y1="${H - y * u}" y2="${H - y * u}" class="fg-grid"/>`;
  h.forEach((v, i) => {
    const w = Math.min(L[i], Rt[i]) - v; total += w;
    if (w > 0) s += `<rect x="${i * u}" y="${H - (v + w) * u}" width="${u}" height="${w * u}" class="fg-water"/>`;
    if (v > 0) s += `<rect x="${i * u}" y="${H - v * u}" width="${u}" height="${v * u}" class="fg-bar"/>`;
  });
  return `<figure class="ex-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elevation map ${h.join(', ')} holding ${total} units of water">${s}<line x1="0" x2="${W}" y1="${H}" y2="${H}" class="fg-base"/></svg><figcaption>Grey bars are the elevation map; blue cells are the ${total} units of trapped water.</figcaption></figure>`;
}
