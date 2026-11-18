(() => {
  const ID = '__gs_tool';
  const old = document.getElementById(ID);
  if (old) { old._destroy ? old._destroy() : old.remove(); return; }
  const P = window.APIPool;
  if (!P) { alert('This tool needs lib/apipool.js. In tools.json, give it "needs": ["lib/apipool.js"].'); return; }

  const THINK = 'medium';                                   // used by Gemini models; set to '' to skip
  const PRESETS = {
    rare: { name: 'Rarest answers', text: 'List the rarest answers to this question as a simple list.' },
    krillion: { name: 'Krillion deep cut', text: 'This is a screenshot from Krillion, a game where you name valid members of the prompt category and score MORE for rare answers, but an answer scores ZERO if it is not on the hand-checked accepted list. Read the prompt/category and any constraints on screen (letter, theme, count, etc). Ignore answers already used or shown on screen. Give 8 answers ranked by best expected score. Each must be: (1) definitely a real, well-documented member of the category that satisfies every constraint; (2) obscure, meaning NOT among the first 30 things most people would name; prefer second-tier, regional, historical, older, or specialist examples that a thorough reference list would still include; (3) written as its standard, commonly used name or spelling, as short as possible. Avoid invented, borderline, wordplay, or too-clever answers, and anything you are not highly confident exists. If no prompt is visible, say so. Output ONLY the answers, one per line, best first, no numbering or explanation.' },
    answer: { name: 'Answer the question', text: 'Read all the text in this screenshot. If it contains a question or problem, give the best, most accurate answer with brief reasoning. Otherwise, summarize what it says.' },
  };
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };
  const LSP = '__gs_preset';

  const host = el('div', { id: ID });
  host.style.cssText = 'all:initial;position:fixed;top:24px;right:24px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}
      .box{width:350px;max-height:80vh;display:flex;flex-direction:column;background:#16181d;color:#e8e9ed;border:1px solid #2c303a;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.55);font:14px/1.45 system-ui,sans-serif}
      .hd{display:flex;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid #2c303a;cursor:move;user-select:none;font-weight:700}
      .hd .sp{flex:1}.x{cursor:pointer;color:#9aa0b0;padding:2px 7px;border-radius:6px}.x:hover{background:#2b303b;color:#fff}
      .bar{display:flex;gap:6px;padding:8px 10px}
      select,button{background:#2b303b;color:#e8e9ed;border:0;border-radius:8px;padding:7px 10px;font:inherit;cursor:pointer}
      select{flex:1;min-width:0}button.go{background:#3b6fd8;color:#fff;font-weight:600}button:disabled{opacity:.5;cursor:default}
      .out{flex:1;overflow:auto;padding:4px 12px 10px;white-space:pre-wrap;min-height:60px;max-height:42vh}
      .sw{padding:0 12px 6px;color:#e3b341;font-size:12px}
      .meter{padding:8px 10px;border-top:1px solid #2c303a;font-size:12px;color:#8b90a0}
      .chips{display:flex;flex-wrap:wrap;align-items:flex-start;gap:5px}
      .chip{background:#1f232b;border:1px solid #2c303a;border-radius:10px;padding:2px 8px;white-space:nowrap}
      .chip.cur{border-color:#3b6fd8;color:#cfe0ff}.chip.out{opacity:.5;text-decoration:line-through}
      .err{color:#ffb4ab}
    </style>
    <div class='box'>
      <div class='hd'><span>AI screenshot answers</span><span class='sp'></span><span class='x'>\u2715</span></div>
      <div class='bar'><select class='pr'></select><button class='go'>Ask (Alt+A)</button><button class='cp'>Copy</button></div>
      <div class='out'>Click Ask, pick this tab to share (only needed once), and the answer shows here. Your API keys are used in order, and the next one takes over when one runs out.</div>
      <div class='sw' hidden></div>
      <div class='meter'><div class='chips'></div></div>
    </div>`;
  document.body.appendChild(host);
  const $ = q => root.querySelector(q);
  const hd = $('.hd'), prSel = $('.pr'), goBtn = $('.go'), cpBtn = $('.cp'), out = $('.out'), chips = $('.chips'), swEl = $('.sw');
  Object.entries(PRESETS).forEach(([k, v]) => prSel.add(new Option(v.name, k)));
  try { const p = localStorage.getItem(LSP); if (PRESETS[p]) prSel.value = p; } catch {}
  prSel.onchange = () => { try { localStorage.setItem(LSP, prSel.value); } catch {} };
  const say = (t, isErr) => { out.textContent = t; out.className = 'out' + (isErr ? ' err' : ''); };
  let last = '', busy = false;

  async function meter() {                         // which keys/models are ready, and how much of each is used
    try {
      const st = (await P.status()).filter(s => (s.entry.vision != null ? s.entry.vision : (P.PROVIDERS[s.entry.provider] || {}).vision));
      const cur = st.find(s => !s.skipped);
      chips.textContent = '';
      if (!st.length) chips.append(el('span', { className: 'chip', textContent: 'No keys yet: open the "API keys" tool' }));
      st.slice(0, 8).forEach(s => chips.append(el('span', { className: 'chip' + (s === cur ? ' cur' : '') + (s.skipped ? ' out' : ''), title: s.entry.label + ' / ' + s.model + (s.skipped ? ' - ' + s.skipped : ''),
        textContent: s.entry.label.slice(0, 14) + ' \u00B7 ' + s.model.split('/').pop().replace('gemini-', '') + ' ' + (s.skipped ? 'out' : s.used + (s.limit ? '/' + s.limit : '')) })));
    } catch (e) { chips.textContent = ''; chips.append(el('span', { className: 'chip', textContent: e.message.slice(0, 80) })); }
  }

  async function frame() {
    let stream = window.__gs_stream;
    if (!stream || !stream.active) {
      say('Choose this tab to share (only needed once)...');
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
      window.__gs_stream = stream;
      const v0 = document.createElement('video'); v0.srcObject = stream; v0.muted = true; await v0.play(); window.__gs_video = v0;
      stream.getVideoTracks()[0].addEventListener('ended', () => { window.__gs_stream = null; });
    }
    const v = window.__gs_video;
    host.style.visibility = 'hidden';
    await new Promise(r => setTimeout(r, 300));
    const W = Math.min(v.videoWidth, 1600), H = Math.round(v.videoHeight * W / v.videoWidth), c = document.createElement('canvas');
    c.width = W; c.height = H; c.getContext('2d').drawImage(v, 0, 0, W, H);
    host.style.visibility = 'visible';
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  async function ask() {
    if (busy) return;
    busy = true; goBtn.disabled = true; swEl.hidden = true;
    try {
      const data = await frame();
      say('Thinking...');
      const r = await P.ask({ text: PRESETS[prSel.value].text, image: data, think: THINK, onTry: s => say('Thinking... (' + s.entry.label + ' / ' + s.model + ')') });
      last = r.text; say(r.text + '\n\n[' + r.label + ' \u00B7 ' + r.model + ']');
      const sk = r.attempts.filter(a => a.skipped || a.error);
      if (sk.length) { swEl.hidden = false; swEl.textContent = 'Switched past: ' + sk.map(a => a.label + ' / ' + a.model.split('/').pop() + ' (' + (a.skipped || a.error) + ')').join(', '); }
    } catch (e) {
      say(e.name === 'NotAllowedError' ? 'Screen share was cancelled. Click Ask to try again.' : e.message, true);
      host.style.visibility = 'visible';
    } finally { busy = false; goBtn.disabled = false; meter(); }
  }
  goBtn.onclick = ask;
  cpBtn.onclick = () => { navigator.clipboard.writeText(last).then(() => { cpBtn.textContent = 'Copied'; setTimeout(() => (cpBtn.textContent = 'Copy'), 1200); }).catch(() => {}); };
  const onKey = e => { if (e.altKey && e.code === 'KeyA') { e.preventDefault(); ask(); } };
  window.addEventListener('keydown', onKey, true);
  const destroy = () => { window.removeEventListener('keydown', onKey, true); host.remove(); };
  host._destroy = destroy; $('.x').onclick = destroy;
  let drag = false, dx = 0, dy = 0;
  hd.addEventListener('pointerdown', e => { if (e.target.classList.contains('x')) return; drag = true; const r = host.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; hd.setPointerCapture(e.pointerId); e.preventDefault(); });
  hd.addEventListener('pointermove', e => { if (drag) { host.style.left = (e.clientX - dx) + 'px'; host.style.top = (e.clientY - dy) + 'px'; host.style.right = 'auto'; } });
  hd.addEventListener('pointerup', () => { drag = false; });
  meter();
})();
