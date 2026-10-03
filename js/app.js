// UI: problem list, workspace, editor, Run/Submit, routing.
(() => {
'use strict';

/* ================= suites: examples + hidden tests, expected from reference ================= */
const suites = new Map();
function getSuite(p) {
  if (suites.has(p.slug)) return suites.get(p.slug);
  const prom = (async () => {
    const R = makeR(hashStr(p.slug));
    const cases = p.examples.map(e => e.args);
    for (let i = 0; i < (p.count || 40); i++) cases.push(p.gen(R, i));
    const res = await execute(p.ref, p, cases, { limit: 15000 });
    if (res.kind !== 'done' || res.results.some(r => r.error)) throw new Error('reference failed: ' + (res.error || (res.results.find(r => r.error) || {}).error || res.kind));
    const s = { cases, expected: res.results.map(r => r.out), refTimes: res.results.map(r => r.dt) };
    p._suite = s;
    return s;
  })();
  suites.set(p.slug, prom);
  prom.catch(() => suites.delete(p.slug));
  return prom;
}
function parseOut(s) { if (s === 'undefined') return undefined; try { return JSON.parse(s); } catch (e) { return s; } }
function judge(p, args, outStr, expStr) {
  if (p.check) { try { return !!p.check(args, parseOut(outStr), parseOut(expStr)); } catch (e) { return false; } }
  if (p.float) { const a = parseOut(outStr), b = parseOut(expStr); return typeof a === 'number' && Math.abs(a - b) <= 1e-5; }
  return outStr === expStr;
}
const verdictClass = v => v === 'Accepted' ? 'v-ok' : v === 'Time Limit Exceeded' ? 'v-warn' : 'v-bad';
const dotClass = v => v === 'Accepted' ? 'ok' : v === 'Time Limit Exceeded' ? 'warn' : '';
const classify = msg => /SyntaxError/.test(msg || '') ? 'Compile Error' : 'Runtime Error';

/* ================= persistence ================= */
const getSubs = p => store.get('subs.' + p.slug, []);
const isSolved = p => getSubs(p).some(s => s.verdict === 'Accepted');
const statusOf = p => { const s = getSubs(p); return s.some(x => x.verdict === 'Accepted') ? 'solved' : s.length ? 'tried' : 'todo'; };

/* ================= syntax highlighting ================= */
const KW = new Set('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield async await static get set'.split(' '));
const LIT = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const BUILTIN = new Set(['Math', 'Array', 'Map', 'Set', 'Object', 'Number', 'String', 'JSON', 'console', 'Int32Array', 'Uint8Array', 'Float64Array', 'BigInt', 'ListNode', 'TreeNode', 'Symbol', 'WeakMap', 'Date', 'Boolean', 'Error']);
const TOK = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b)|([A-Za-z_$][\w$]*)/g;
function highlight(src) {
  let out = '', last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(src))) {
    if (m.index > last) out += esc(src.slice(last, m.index));
    const t = m[0]; let cls = null;
    if (m[1]) cls = 'tc'; else if (m[2]) cls = 'ts'; else if (m[3]) cls = 'tn';
    else if (KW.has(t)) cls = 'tk'; else if (LIT.has(t)) cls = 'tl'; else if (BUILTIN.has(t)) cls = 'tb';
    else if (src.charAt(TOK.lastIndex) === '(') cls = 'tf';
    out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
    last = TOK.lastIndex;
  }
  return out + esc(src.slice(last));
}

/* ================= icons ================= */
const ICON = {
  play: '<svg class="i" viewBox="0 0 24 24"><path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" stroke="none"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  solved: '<svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>',
  tried: '<svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px"><circle cx="12" cy="12" r="9" stroke-dasharray="3.5 3"/></svg>',
  todo: '<svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px;stroke-width:1.5"><circle cx="12" cy="12" r="9"/></svg>',
};

/* ================= state & elements ================= */
const state = { p: null, leftTab: 'desc', conTab: 'cases', caseSel: 0, resSel: 0, lastRun: null, subSel: 0, busy: null, judging: null, cases: [], showRef: false, filters: { q: '', diff: 'All', status: 'All', tag: 'All' } };
const listView = $('#listView'), workView = $('#workView'), leftBody = $('#leftBody'), conBody = $('#conBody');
const runBtn = $('#runBtn'), submitBtn = $('#submitBtn');
const ta = $('#code'), hl = $('#hl'), gutter = $('#gutter'), edScroll = $('#edScroll');

/* ================= list view ================= */
function renderList() {
  const f = state.filters, q = f.q.trim().toLowerCase();
  const rows = PROBLEMS.filter(p =>
    (f.diff === 'All' || p.diff === f.diff) &&
    (f.tag === 'All' || p.tags.includes(f.tag)) &&
    (f.status === 'All' || statusOf(p) === f.status) &&
    (!q || p.title.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)) || String(p.id) === q));
  $('#ptbody').innerHTML = rows.map(p => {
    const st = statusOf(p), n = getSubs(p).length;
    const label = st === 'solved' ? 'Solved' : st === 'tried' ? 'Attempted' : 'Not attempted';
    return `<tr data-slug="${p.slug}"><td class="st"><span class="status-ic ${st}" title="${label}" aria-label="${label}">${ICON[st]}</span></td><td><a class="ptitle" href="#${p.slug}"><span class="num">${p.id}.</span> ${esc(p.title)}</a></td><td class="col-tags">${p.tags.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</td><td><span class="diff d-${p.diff}">${p.diff}</span></td><td class="col-subs num-col">${n || '–'}</td></tr>`;
  }).join('');
  $('#emptyMsg').hidden = rows.length > 0;
  renderProgress();
  renderRecent();
}
function solvedCounts() {
  const by = { Easy: 0, Medium: 0, Hard: 0 }, tot = { Easy: 0, Medium: 0, Hard: 0 };
  PROBLEMS.forEach(p => { tot[p.diff]++; if (isSolved(p)) by[p.diff]++; });
  return { by, tot, solved: by.Easy + by.Medium + by.Hard };
}
function renderProgress() {
  const { by, tot, solved } = solvedCounts(), total = PROBLEMS.length;
  const r = 30, C = 2 * Math.PI * r; let off = 0, arcs = '';
  for (const d of ['Easy', 'Medium', 'Hard']) {
    const len = by[d] / total * C;
    if (len > 0) { arcs += `<circle cx="38" cy="38" r="${r}" class="arc-${d}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; }
  }
  $('#progressPanel').innerHTML = `<h2>Your progress</h2>
    <div class="prog-top"><svg class="ring" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="${r}" class="ring-bg"/><g transform="rotate(-90 38 38)">${arcs}</g></svg>
    <div><div class="big">${solved}<span> / ${total}</span></div><div class="muted">problems solved</div></div></div>
    ${['Easy', 'Medium', 'Hard'].map(d => `<div class="prog-row"><span class="diff d-${d}">${d}</span><div class="bar"><i style="width:${by[d] / tot[d] * 100}%;background:var(--${d.toLowerCase()})"></i></div><span class="n">${by[d]}/${tot[d]}</span></div>`).join('')}`;
  $('#solvedMini').innerHTML = `<b>${solved}</b> / ${total} solved`;
}
function renderRecent() {
  const all = PROBLEMS.flatMap(p => getSubs(p).map(s => ({ p, s }))).sort((a, b) => b.s.at - a.s.at).slice(0, 6);
  $('#recentList').innerHTML = all.length ? all.map(({ p, s }) => `<li><a href="#${p.slug}"><span class="vdot ${dotClass(s.verdict)}" title="${esc(s.verdict)}"></span><span class="t">${esc(p.title)} <span class="muted">· ${esc(s.verdict)}</span></span><span class="ago">${ago(s.at)}</span></a></li>`).join('')
    : `<li class="muted small">Nothing yet. Open a problem, write a solution and press Submit.</li>`;
}
$('#ptbody').addEventListener('click', e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-slug]'); if (tr) location.hash = tr.dataset.slug; });
$('#q').addEventListener('input', e => { state.filters.q = e.target.value; renderList(); });
$('#diffSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.filters.diff = b.dataset.d; $$('#diffSeg button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderList(); });
$('#statusSel').addEventListener('change', e => { state.filters.status = e.target.value; renderList(); });
$('#tagSel').innerHTML = '<option value="All">Any topic</option>' + TAGS.map(t => `<option>${esc(t)}</option>`).join('');
$('#tagSel').addEventListener('change', e => { state.filters.tag = e.target.value; renderList(); });
$('#clearFilters').addEventListener('click', () => {
  state.filters = { q: '', diff: 'All', status: 'All', tag: 'All' };
  $('#q').value = ''; $('#statusSel').value = 'All'; $('#tagSel').value = 'All';
  $$('#diffSeg button').forEach(x => x.setAttribute('aria-pressed', x.dataset.d === 'All'));
  renderList();
});

/* ================= workspace: left pane ================= */
const inputLine = (p, args) => p.params.map(([n], j) => `${n} = ${JSON.stringify(args[j])}`).join(', ');
function descHTML(p) {
  const s = p._suite;
  return `<h1 class="p-title">${p.id}. ${esc(p.title)}</h1>
  <div class="p-meta"><span class="pill d-${p.diff}">${p.diff}</span>${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}${isSolved(p) ? `<span class="solved-flag">${ICON.check}Solved</span>` : ''}</div>
  <div class="prose">${p.desc}</div>
  ${p.examples.map((ex, k) => `<section class="ex"><h3>Example ${k + 1}</h3>${k === 0 && p.figure ? p.figure(ex.args) : ''}<div class="ex-box"><div><b>Input:</b><span class="v">${esc(inputLine(p, ex.args))}</span></div><div><b>Output:</b><span class="v" data-exout="${k}">${s ? esc(s.expected[k]) : '…'}</span></div>${ex.note ? `<div class="ex-note"><b>Explanation:</b>${ex.note}</div>` : ''}</div></section>`).join('')}
  <h3 class="sec">Constraints</h3><ul class="constraints">${p.constraints.map(c => `<li>${c}</li>`).join('')}</ul>
  ${p.followup ? `<p class="followup"><b>Follow-up:</b> ${p.followup}</p>` : ''}`;
}
function editorialHTML(p) {
  return `<h1 class="p-title">Approach</h1><div class="prose">${p.ed.approach}</div>
  <dl class="cx"><div><dt>Time</dt><dd>${p.ed.time}</dd></div><div><dt>Space</dt><dd>${p.ed.space}</dd></div></dl>
  ${state.showRef ? `<pre class="code-block">${highlight(p.ref)}</pre>` : `<button class="btn" data-act="showref">Show reference solution</button><p class="muted small">It stays hidden until you ask, so you can try first.</p>`}`;
}
function subCardHTML(p, s) {
  const vc = verdictClass(s.verdict);
  let body = '';
  if (s.verdict === 'Accepted') {
    const mx = Math.max(s.runtime, s.refRuntime, 0.001);
    body = `<div class="rt">
      <div class="rt-row"><span>Your code</span><div class="rt-bar"><i style="width:${Math.max(2, s.runtime / mx * 100)}%"></i></div><b>${fmtMs(s.runtime)}</b></div>
      <div class="rt-row ref"><span>Reference</span><div class="rt-bar"><i style="width:${Math.max(2, s.refRuntime / mx * 100)}%"></i></div><b>${fmtMs(s.refRuntime)}</b></div>
    </div><p class="muted small">Total time across all ${s.total} tests, measured in this browser. Expect some variation between runs.</p>`;
  } else if (s.message) {
    body = `<div class="err-box">${esc(s.message)}${s.line ? `\n(line ${s.line})` : ''}</div>`;
  } else if (s.fail) {
    const f = s.fail;
    body = `<div class="io-label">${s.verdict === 'Time Limit Exceeded' ? 'Last executed input' : 'Input'} (test ${f.index + 1} of ${s.total})</div><div class="io-box">${esc(f.input)}</div>
      ${f.logs && f.logs.length ? `<div class="io-label">Stdout</div><div class="io-box logs">${esc(f.logs.join('\n'))}</div>` : ''}
      ${f.error ? `<div class="io-label">Error</div><div class="err-box">${esc(f.error)}${f.line ? `\n(line ${f.line})` : ''}</div>` : ''}
      ${f.out != null ? `<div class="io-label">Output</div><div class="io-box mismatch">${esc(f.out)}</div>` : ''}
      ${s.verdict !== 'Time Limit Exceeded' ? `<div class="io-label">Expected${p.anyAnswer ? ' (one accepted answer)' : ''}</div><div class="io-box">${esc(f.exp)}</div>` : `<div class="note">This test ran longer than 2 seconds and was stopped. Look for a faster approach; the Editorial tab has a hint.</div>`}`;
  }
  return `<article class="sub-card">
    <div class="sub-head"><span class="verdict ${vc}">${esc(s.verdict)}</span><span class="res-meta">${s.passed} / ${s.total} testcases passed</span><span class="res-meta">· ${ago(s.at)}</span></div>
    ${body}
    <div class="sub-actions"><button class="btn sm" data-act="load">Load this code</button>${s.fail && s.fail.args ? `<button class="btn sm" data-act="usecase">Add input to testcases</button>` : ''}</div>
    <details class="code-det"><summary>Submitted code</summary><pre class="code-block">${highlight(s.code)}</pre></details>
  </article>`;
}
function subsHTML(p) {
  const subs = getSubs(p);
  let html = '';
  if (state.judging && state.judging.slug === p.slug) {
    const j = state.judging;
    html += `<article class="sub-card"><div class="pending"><span class="spinner"></span>${j.total ? `Judging… ${j.done} / ${j.total} tests` : 'Preparing hidden tests…'}</div></article>`;
  } else if (subs[state.subSel]) html += subCardHTML(p, subs[state.subSel]);
  if (!subs.length) {
    if (!state.judging) html += `<div class="placeholder"><div>No submissions yet.<br>Submit runs your code on the ${p.examples.length} examples plus ${p.count || 40} hidden tests.</div></div>`;
    return html;
  }
  html += `<table class="sub-table"><thead><tr><th>Verdict</th><th>Runtime</th><th>Passed</th><th>Submitted</th></tr></thead><tbody>${subs.map((s, i) => `<tr data-sub="${i}" class="${i === state.subSel && !state.judging ? 'on' : ''}"><td class="v ${verdictClass(s.verdict)}">${esc(s.verdict)}</td><td>${s.verdict === 'Accepted' ? fmtMs(s.runtime) : '–'}</td><td>${s.passed}/${s.total}</td><td class="muted">${ago(s.at)}</td></tr>`).join('')}</tbody></table>`;
  return html;
}
function renderLeft() {
  const p = state.p;
  $$('#leftTabs .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === state.leftTab)));
  const n = getSubs(p).length; const sc = $('#subCount'); sc.hidden = !n; sc.textContent = n;
  leftBody.innerHTML = state.leftTab === 'desc' ? descHTML(p) : state.leftTab === 'edit' ? editorialHTML(p) : subsHTML(p);
}
$('#leftTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.leftTab = b.dataset.tab; renderLeft(); leftBody.scrollTop = 0; });
leftBody.addEventListener('click', e => {
  const p = state.p;
  const act = e.target.closest('[data-act]');
  if (act) {
    const s = getSubs(p)[state.subSel];
    if (act.dataset.act === 'showref') { state.showRef = true; renderLeft(); }
    else if (act.dataset.act === 'load' && s) { setCode(s.code, true); toast(`Loaded that submission's code. ${MOD}+Z undoes it.`); }
    else if (act.dataset.act === 'usecase' && s && s.fail && s.fail.args) {
      if (state.cases.length >= 8) state.cases.pop();
      state.cases.push(s.fail.args.map(a => JSON.stringify(a)));
      state.caseSel = state.cases.length - 1; saveCases(); state.conTab = 'cases'; renderConsole();
      toast('Added the failing input as a testcase.');
    }
    return;
  }
  const row = e.target.closest('tr[data-sub]');
  if (row) { state.subSel = +row.dataset.sub; renderLeft(); leftBody.scrollTop = 0; }
});

/* ================= workspace: console ================= */
function renderConsole() {
  $$('#conTabs .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === state.conTab)));
  if (state.conTab === 'cases') renderCases(); else renderResult();
}
function renderCases() {
  const p = state.p, cs = state.cases, sel = Math.min(state.caseSel, cs.length - 1);
  state.caseSel = sel;
  conBody.innerHTML = `<div class="chips">${cs.map((_, i) => `<span class="chip ${i === sel ? 'on' : ''}" data-case="${i}" role="button" tabindex="0">Case ${i + 1}${cs.length > 1 && i === sel ? `<button class="x" data-del="${i}" aria-label="Delete case ${i + 1}">×</button>` : ''}</span>`).join('')}${cs.length < 8 ? `<button class="chip add" id="addCase" aria-label="Add a testcase (copies the selected one)" title="Add a testcase">+</button>` : ''}</div>
  ${p.params.map(([n, t], j) => { const v = cs[sel][j]; return `<div class="field"><label for="tc-${j}">${n} =</label><textarea id="tc-${j}" class="tc-in" data-j="${j}" rows="${Math.min(6, Math.max(1, Math.ceil(v.length / 60)))}" spellcheck="false" autocomplete="off">${esc(v)}</textarea></div>`; }).join('')}
  <div class="tc-foot"><span>Values are JSON: strings in double quotes, lists as arrays.</span><button class="linkbtn" id="resetCases">Restore example testcases</button></div>`;
}
function rowStatusClass(r) { return r.status === 'pass' ? 'pass' : r.status === 'fail' ? 'fail' : r.status === 'error' ? 'error' : r.status === 'tle' ? 'tle' : ''; }
function renderResult() {
  const p = state.p, R = state.lastRun;
  if (state.busy === 'run') { conBody.innerHTML = `<div class="pending"><span class="spinner"></span>Running your code…</div>`; return; }
  if (!R) { conBody.innerHTML = `<div class="placeholder"><div>Run your code to see its output for each testcase here.<br><kbd>${MOD}</kbd> <kbd>Enter</kbd> runs, <kbd>${MOD}</kbd> <kbd>Shift</kbd> <kbd>Enter</kbd> submits.</div></div>`; return; }
  if (R.kind === 'input') { conBody.innerHTML = `<div class="res-head"><span class="verdict v-bad">Invalid testcase</span></div><div class="err-box">${esc(R.message)}</div>`; return; }
  if (R.message) { conBody.innerHTML = `<div class="res-head"><span class="verdict v-bad">${esc(R.verdict)}</span></div><div class="err-box">${esc(R.message)}${R.line ? `\n(line ${R.line})` : ''}</div>`; return; }
  const sel = Math.min(state.resSel, R.rows.length - 1), r = R.rows[sel];
  let detail = `<div class="io-label">Input</div>${p.params.map(([n], j) => `<div class="io-box"><span class="pn">${n} =</span>\n${esc(clip(JSON.stringify(r.args[j])))}</div>`).join('')}`;
  if (r.logs && r.logs.length) detail += `<div class="io-label">Stdout</div><div class="io-box logs">${esc(clip(r.logs.join('\n'), 4000))}</div>`;
  if (r.status === 'error') detail += `<div class="io-label">Error</div><div class="err-box">${esc(r.error)}${r.line ? `\n(line ${r.line})` : ''}</div>`;
  else if (r.status === 'tle') detail += `<div class="note">This testcase ran longer than 2 seconds and was stopped.</div>`;
  else if (r.status === 'skipped') detail += `<div class="note">Not run, because an earlier testcase timed out.</div>`;
  else detail += `<div class="io-label">Output</div><div class="io-box ${r.status === 'fail' ? 'mismatch' : ''}">${esc(clip(r.out))}</div>`;
  if (r.exp != null) detail += `<div class="io-label">Expected${p.anyAnswer ? ' (one accepted answer)' : ''}</div><div class="io-box">${esc(clip(r.exp))}</div>`;
  else if (r.expErr) detail += `<div class="note">The reference solution couldn't run this input (${esc(r.expErr)}). Check that it fits the constraints.</div>`;
  conBody.innerHTML = `<div class="res-head"><span class="verdict ${verdictClass(R.verdict)}">${esc(R.verdict)}</span>${R.verdict === 'Accepted' || R.verdict === 'Wrong Answer' ? `<span class="res-meta">Runtime ${fmtMs(R.runtime)}</span>` : ''}</div>
  <div class="chips">${R.rows.map((x, i) => `<button class="chip ${rowStatusClass(x)} ${i === sel ? 'on' : ''}" data-res="${i}"><span class="dot"></span>Case ${i + 1}</button>`).join('')}</div>${detail}`;
}
$('#conTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.conTab = b.dataset.tab; renderConsole(); });
conBody.addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { e.stopPropagation(); state.cases.splice(+del.dataset.del, 1); state.caseSel = Math.max(0, state.caseSel - 1); saveCases(); renderCases(); return; }
  const c = e.target.closest('[data-case]');
  if (c) { state.caseSel = +c.dataset.case; renderCases(); return; }
  if (e.target.closest('#addCase')) { state.cases.push([...state.cases[state.caseSel]]); state.caseSel = state.cases.length - 1; saveCases(); renderCases(); const f = $('#tc-0'); if (f) f.focus(); return; }
  if (e.target.closest('#resetCases')) { state.cases = defaultCases(state.p); state.caseSel = 0; saveCases(); renderCases(); toast('Restored the example testcases.'); return; }
  const r = e.target.closest('[data-res]');
  if (r) { state.resSel = +r.dataset.res; renderResult(); }
});
conBody.addEventListener('keydown', e => { const c = e.target.closest('[data-case]'); if (c && (e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); state.caseSel = +c.dataset.case; renderCases(); } });
conBody.addEventListener('input', e => { const t = e.target.closest('.tc-in'); if (!t) return; state.cases[state.caseSel][+t.dataset.j] = t.value; saveCases(); });
let casesTimer;
function saveCases() { const p = state.p, cs = state.cases; clearTimeout(casesTimer); casesTimer = setTimeout(() => store.set('cases.' + p.slug, cs), 300); }

/* ================= editor ================= */
let lineCount = 0, codeTimer;
function paint() {
  const v = ta.value;
  hl.innerHTML = highlight(v) + '\n';
  const n = v.split('\n').length;
  if (n !== lineCount) { lineCount = n; gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
}
function updatePos() {
  const pos = ta.selectionEnd, before = ta.value.slice(0, pos);
  const line = before.split('\n').length, col = pos - before.lastIndexOf('\n');
  $('#cursorPos').textContent = `Ln ${line}, Col ${col}`;
  return { line: line - 1, col: col - 1 };
}
let charW = 0;
function measureChar() { const s = document.createElement('span'); s.style.cssText = 'position:absolute;visibility:hidden;font:13px var(--f-mono);white-space:pre'; s.textContent = 'x'.repeat(50); document.body.appendChild(s); charW = s.getBoundingClientRect().width / 50 || 7.8; s.remove(); }
function keepCaretVisible() {
  const { line, col } = updatePos();
  const lh = 22, y = 12 + line * lh;
  if (y < edScroll.scrollTop) edScroll.scrollTop = y - 6;
  else if (y + lh > edScroll.scrollTop + edScroll.clientHeight) edScroll.scrollTop = y + lh - edScroll.clientHeight + 10;
  if (!charW) measureChar();
  const gw = gutter.offsetWidth, x = gw + 14 + col * charW;
  if (x + 24 < edScroll.clientWidth) edScroll.scrollLeft = 0;
  else if (x < edScroll.scrollLeft + gw + 10) edScroll.scrollLeft = Math.max(0, x - gw - 40);
  else if (x > edScroll.scrollLeft + edScroll.clientWidth - 20) edScroll.scrollLeft = x - edScroll.clientWidth + 48;
}
function saveCode(now) {
  const p = state.p, v = ta.value;
  clearTimeout(codeTimer);
  const doSave = () => { store.set('code.' + p.slug, v); $('#savedNote').textContent = 'Saved in this browser'; };
  if (now) doSave(); else { $('#savedNote').textContent = 'Editing…'; codeTimer = setTimeout(doSave, 500); }
}
function insertText(text, s, e) {
  ta.focus();
  if (s !== undefined) ta.setSelectionRange(s, e);
  let ok = false;
  try { ok = text === '' ? document.execCommand('delete', false) : document.execCommand('insertText', false, text); } catch (err) {}
  if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
}
function setCode(v, undoable) {
  if (undoable) { insertText(v, 0, ta.value.length); ta.setSelectionRange(0, 0); edScroll.scrollTop = 0; }
  else { ta.value = v; paint(); updatePos(); }
}
function lineRange() {
  const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
  const ls = v.lastIndexOf('\n', s - 1) + 1;
  let le = v.indexOf('\n', e > s && v[e - 1] === '\n' ? e - 1 : e); if (le < 0) le = v.length;
  return { v, s, e, ls, le };
}
function indentSelection(dedent) {
  const { v, s, e, ls, le } = lineRange();
  if (!dedent && s === e) { const col = s - ls; insertText(' '.repeat(4 - (col % 4))); return; }
  const block = v.slice(ls, le), lines = block.split('\n');
  const out = lines.map(l => dedent ? l.replace(/^ {1,4}/, '') : '    ' + l), nb = out.join('\n');
  if (nb === block) return;
  insertText(nb, ls, le);
  if (s === e) { const np = Math.max(ls, s + out[0].length - lines[0].length); ta.setSelectionRange(np, np); }
  else ta.setSelectionRange(ls, ls + nb.length);
}
function toggleComment() {
  const { v, s, e, ls, le } = lineRange();
  const lines = v.slice(ls, le).split('\n');
  const filled = lines.filter(l => l.trim());
  const commented = filled.length && filled.every(l => /^\s*\/\//.test(l));
  const minInd = Math.min(...filled.map(l => l.match(/^ */)[0].length));
  const out = lines.map(l => !l.trim() ? l : commented ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.slice(0, minInd) + '// ' + l.slice(minInd));
  const nb = out.join('\n');
  insertText(nb, ls, le);
  if (s === e) { const np = Math.max(ls, s + out[0].length - lines[0].length); ta.setSelectionRange(np, np); }
  else ta.setSelectionRange(ls, ls + nb.length);
}
let tabEscapes = false;
ta.addEventListener('keydown', e => {
  if (e.key === 'Escape') { tabEscapes = true; return; }
  if (e.key === 'Tab' && tabEscapes) { tabEscapes = false; return; }
  tabEscapes = false;
  if (e.key === 'Tab') { e.preventDefault(); indentSelection(e.shiftKey); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleComment(); return; }
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
    e.preventDefault();
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    const ls = v.lastIndexOf('\n', s - 1) + 1, before = v.slice(ls, s);
    const indent = before.match(/^[ \t]*/)[0], opens = /[{[(]\s*$/.test(before), closes = /^[ \t]*[}\])]/.test(v.slice(en));
    if (opens && closes) { insertText('\n' + indent + '    \n' + indent); const np = s + 1 + indent.length + 4; ta.setSelectionRange(np, np); }
    else insertText('\n' + indent + (opens ? '    ' : ''));
    keepCaretVisible();
    return;
  }
});
ta.addEventListener('beforeinput', e => {
  if (e.inputType !== 'insertText' || !/^[}\])]$/.test(e.data || '') || ta.selectionStart !== ta.selectionEnd) return;
  const v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1, before = v.slice(ls, s);
  if (/^ {4,}$/.test(before)) { e.preventDefault(); insertText(before.slice(4) + e.data, ls, s); }
});
ta.addEventListener('input', () => { paint(); saveCode(); keepCaretVisible(); });
ta.addEventListener('keyup', e => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) keepCaretVisible(); else updatePos(); });
ta.addEventListener('click', updatePos);
$('#resetBtn').addEventListener('click', () => { setCode(starter(state.p), true); toast(`Reset to the starter code. ${MOD}+Z undoes it.`); });
$('#edKeys').innerHTML = `<span><kbd>${MOD}</kbd> <kbd>Enter</kbd> Run</span><span><kbd>${MOD}</kbd> <kbd>Shift</kbd> <kbd>Enter</kbd> Submit</span><span><kbd>${MOD}</kbd> <kbd>/</kbd> Comment</span><span><kbd>Esc</kbd> <kbd>Tab</kbd> Leave editor</span>`;

/* ================= run & submit ================= */
function setBusy(kind) {
  state.busy = kind;
  runBtn.disabled = submitBtn.disabled = !!kind;
  runBtn.innerHTML = kind === 'run' ? '<span class="spinner"></span>Running' : ICON.play + 'Run';
  submitBtn.innerHTML = kind === 'submit' ? '<span class="spinner"></span>Judging' : 'Submit';
}
function parseCases(p) {
  const cases = [];
  for (let c = 0; c < state.cases.length; c++) {
    const row = [];
    for (let j = 0; j < p.params.length; j++) {
      const [name, t] = p.params[j];
      let v;
      try { v = JSON.parse(state.cases[c][j]); } catch (e) { return { error: `Case ${c + 1}: "${name}" isn't valid JSON. ${e.message}` }; }
      if ((t === 'ListNode' || t === 'TreeNode') && !Array.isArray(v)) return { error: `Case ${c + 1}: "${name}" should be written as an array, like [1,2,3].` };
      row.push(v);
    }
    cases.push(row);
  }
  return { cases };
}
async function run() {
  const p = state.p;
  if (!p || state.busy) return;
  const code = ta.value; saveCode(true);
  const parsed = parseCases(p);
  setBusy('run'); state.conTab = 'result'; renderConsole();
  let R;
  if (parsed.error) R = { kind: 'input', message: parsed.error };
  else {
    const [ref, usr] = await Promise.all([execute(p.ref, p, parsed.cases, { limit: 15000 }), execute(code, p, parsed.cases)]);
    if (usr.kind === 'compile') R = { verdict: classify(usr.error), message: usr.error, line: usr.line };
    else if (usr.kind === 'missing') R = { verdict: 'Compile Error', message: `No function named ${p.fn} was found. Keep the name from the starter code.` };
    else {
      const rows = parsed.cases.map((args, i) => {
        const u = usr.results[i], e = ref.kind === 'done' ? ref.results[i] : null;
        const row = { args, exp: e && !e.error ? e.out : null, expErr: e ? e.error || null : 'reference did not finish' };
        if (!u) { row.status = usr.kind === 'tle' && i === usr.results.length ? 'tle' : 'skipped'; return row; }
        row.logs = u.logs; row.dt = u.dt || 0;
        if (u.error) { row.status = 'error'; row.error = u.error; row.line = u.line; return row; }
        row.out = u.out;
        row.status = row.exp == null ? 'unjudged' : judge(p, args, u.out, row.exp) ? 'pass' : 'fail';
        return row;
      });
      const verdict = usr.kind === 'tle' ? 'Time Limit Exceeded' : rows.some(r => r.status === 'error') ? 'Runtime Error' : rows.some(r => r.status === 'fail') ? 'Wrong Answer' : rows.every(r => r.status === 'pass') ? 'Accepted' : 'Finished';
      R = { verdict, rows, runtime: rows.reduce((s, r) => s + (r.dt || 0), 0) };
      const bad = rows.findIndex(r => r.status !== 'pass' && r.status !== 'unjudged');
      state.resSel = bad >= 0 ? bad : 0;
    }
  }
  setBusy(null);
  if (state.p === p) { state.lastRun = R; state.conTab = 'result'; renderConsole(); }
}
async function submit() {
  const p = state.p;
  if (!p || state.busy) return;
  const code = ta.value; saveCode(true);
  setBusy('submit');
  state.judging = { slug: p.slug, done: 0, total: 0 };
  state.leftTab = 'subs'; renderLeft(); leftBody.scrollTop = 0;
  let suite;
  try { suite = await getSuite(p); }
  catch (err) { state.judging = null; setBusy(null); renderLeft(); toast('The hidden tests could not be prepared. Try again.'); return; }
  const total = suite.cases.length;
  state.judging.total = total;
  if (state.p === p && state.leftTab === 'subs') renderLeft();
  let failIdx = -1, lastPaint = 0;
  const usr = await execute(code, p, suite.cases, {
    onCase: (m, i) => {
      const ok = !m.error && judge(p, suite.cases[i], m.out, suite.expected[i]);
      if (!ok) failIdx = i;
      state.judging.done = i + 1;
      const now = performance.now();
      if (now - lastPaint > 120 && state.p === p && state.leftTab === 'subs') { lastPaint = now; const el = $('.pending', leftBody); if (el) el.innerHTML = `<span class="spinner"></span>Judging… ${i + 1} / ${total} tests`; }
      return ok;
    },
  });
  const failInfo = (i, m) => {
    const raw = JSON.stringify(suite.cases[i]);
    return { index: i, input: clip(inputLine(p, suite.cases[i]), 2000), args: raw.length < 20000 ? suite.cases[i] : null, out: m && !m.error ? clip(m.out, 2000) : null, exp: clip(suite.expected[i], 2000), error: m && m.error || null, line: m && m.line || null, logs: m && m.logs ? m.logs.slice(0, 30) : [] };
  };
  const sub = { at: Date.now(), code, total };
  if (usr.kind === 'compile') Object.assign(sub, { verdict: classify(usr.error), message: usr.error, line: usr.line, passed: 0 });
  else if (usr.kind === 'missing') Object.assign(sub, { verdict: 'Compile Error', message: `No function named ${p.fn} was found. Keep the name from the starter code.`, passed: 0 });
  else if (usr.kind === 'tle') Object.assign(sub, { verdict: 'Time Limit Exceeded', passed: usr.results.length, fail: failInfo(usr.results.length, null) });
  else if (usr.kind === 'stopped') { const m = usr.results[failIdx]; Object.assign(sub, { verdict: m.error ? 'Runtime Error' : 'Wrong Answer', passed: failIdx, fail: failInfo(failIdx, m) }); }
  else Object.assign(sub, { verdict: 'Accepted', passed: total, runtime: usr.results.reduce((s, r) => s + (r.dt || 0), 0), refRuntime: suite.refTimes.reduce((s, x) => s + x, 0) });
  const firstSolve = sub.verdict === 'Accepted' && !isSolved(p);
  store.set('subs.' + p.slug, [sub, ...getSubs(p)].slice(0, 30));
  state.judging = null; setBusy(null);
  if (state.p === p) { state.subSel = 0; state.leftTab = 'subs'; renderLeft(); leftBody.scrollTop = 0; }
  renderProgress();
  if (firstSolve) toast(`Solved ${p.title}. ${solvedCounts().solved} of ${PROBLEMS.length} done.`);
}
runBtn.addEventListener('click', run);
submitBtn.addEventListener('click', submit);
document.addEventListener('keydown', e => {
  if (workView.hidden || !state.p) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) submit(); else run(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveCode(true); toast('Saved in this browser.'); }
});

/* ================= splitters ================= */
const split = store.get('split', { lw: 44, ch: 38 });
const applySplit = () => { workView.style.setProperty('--lw', split.lw + '%'); $('#rightCol').style.setProperty('--ch', split.ch + '%'); };
applySplit();
function bindSplit(el, axis) {
  const set = ev => {
    if (axis === 'x') { const r = workView.getBoundingClientRect(); split.lw = Math.min(70, Math.max(24, (ev.clientX - r.left - 16) / (r.width - 32) * 100)); }
    else { const r = $('#rightCol').getBoundingClientRect(); split.ch = Math.min(75, Math.max(14, (r.bottom - ev.clientY) / r.height * 100)); }
    applySplit();
  };
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); document.body.classList.add('dragging');
    const up = () => { el.removeEventListener('pointermove', set); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); document.body.classList.remove('dragging'); store.set('split', split); };
    el.addEventListener('pointermove', set); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  el.addEventListener('keydown', e => {
    const d = { ArrowLeft: -2, ArrowUp: 2, ArrowRight: 2, ArrowDown: -2 }[e.key]; if (!d) return;
    e.preventDefault();
    if (axis === 'x') split.lw = Math.min(70, Math.max(24, split.lw + (e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : 0)));
    else split.ch = Math.min(75, Math.max(14, split.ch + (e.key === 'ArrowUp' ? 2 : e.key === 'ArrowDown' ? -2 : 0)));
    applySplit(); store.set('split', split);
  });
}
bindSplit($('#splitV'), 'x'); bindSplit($('#splitH'), 'y');

/* ================= routing ================= */
function showList() {
  document.body.classList.remove('mode-work');
  listView.hidden = false; workView.hidden = true; $('#workNav').hidden = true; $('#actions').hidden = true;
  renderList();
}
function openProblem(p) {
  const changed = state.p !== p;
  if (changed && state.p) saveCode(true);
  state.p = p;
  document.body.classList.add('mode-work');
  listView.hidden = true; workView.hidden = false; $('#workNav').hidden = false; $('#actions').hidden = false;
  if (changed) {
    Object.assign(state, { leftTab: 'desc', conTab: 'cases', caseSel: 0, resSel: 0, lastRun: null, subSel: 0, showRef: false });
    const draft = store.get('code.' + p.slug, null);
    setCode(draft ?? starter(p), false);
    const saved = store.get('cases.' + p.slug, null);
    state.cases = Array.isArray(saved) && saved.length && saved.every(c => Array.isArray(c) && c.length === p.params.length) ? saved : defaultCases(p);
    edScroll.scrollTop = 0; edScroll.scrollLeft = 0; leftBody.scrollTop = 0;
    $('#savedNote').textContent = draft != null && draft !== starter(p) ? 'Restored your draft' : '';
  }
  renderLeft(); renderConsole(); renderProgress();
  if (!p._suite) getSuite(p).then(s => {
    if (state.p !== p || state.leftTab !== 'desc') return;
    $$('[data-exout]', leftBody).forEach(el => { el.textContent = s.expected[+el.dataset.exout]; });
  }).catch(() => {});
}
function route() {
  const p = BY_SLUG[location.hash.slice(1)];
  if (p) openProblem(p); else showList();
  window.scrollTo(0, 0);
}
const step = d => { const i = PROBLEMS.indexOf(state.p); location.hash = PROBLEMS[(i + d + PROBLEMS.length) % PROBLEMS.length].slug; };
$('#prevBtn').addEventListener('click', () => step(-1));
$('#nextBtn').addEventListener('click', () => step(1));
$('#randBtn').addEventListener('click', () => {
  let pool = PROBLEMS.filter(p => p !== state.p && !isSolved(p));
  if (!pool.length) pool = PROBLEMS.filter(p => p !== state.p);
  location.hash = pool[Math.floor(Math.random() * pool.length)].slug;
});
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', () => { if (state.p) saveCode(true); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { charW = 0; });

setBusy(null);
route();
})();
