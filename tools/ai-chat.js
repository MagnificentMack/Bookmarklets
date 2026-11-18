(() => {
  const ID = '__aichat_tool';
  const old = document.getElementById(ID);
  if (old) { old._destroy ? old._destroy() : old.remove(); return; }
  const P = window.APIPool;
  if (!P) { alert('AI chat needs lib/apipool.js. In tools.json, give this tool "needs": ["lib/apipool.js"].'); return; }
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };

  const host = el('div', { id: ID });
  host.style.cssText = 'all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}
      .box{width:380px;height:500px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column;background:#16181d;color:#e8e9ed;border:1px solid #2c303a;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.55);font:14px/1.45 system-ui,sans-serif}
      .hd{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #2c303a;cursor:move;user-select:none;font-weight:700}
      .hd .sp{flex:1}.x,.nc{cursor:pointer;color:#9aa0b0;padding:2px 7px;border-radius:6px;font-weight:400;font-size:13px}.x:hover,.nc:hover{background:#2b303b;color:#fff}
      .list{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
      .m{max-width:90%;padding:7px 11px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}
      .u{align-self:flex-end;background:#2b4a8a}.a{align-self:flex-start;background:#262a33}.e{align-self:stretch;background:#3d1f1f;color:#ffb4ab;font-size:12.5px}
      .meta{align-self:flex-start;color:#8b90a0;font-size:11.5px;margin-top:-4px}.meta.sw{color:#e3b341}
      .cmp{display:flex;gap:6px;padding:8px;border-top:1px solid #2c303a;align-items:flex-end}
      textarea{flex:1;resize:none;background:#12141a;color:#e8e9ed;border:1px solid #2c303a;border-radius:10px;padding:8px 10px;font:inherit;outline:none;max-height:100px;min-height:36px}
      textarea:focus{border-color:#3b6fd8}
      .send{background:#3b6fd8;color:#fff;border:0;border-radius:10px;padding:0 14px;height:36px;cursor:pointer;font:inherit;font-weight:600}.send:disabled{opacity:.5}
      .hint{color:#8b90a0;font-size:12.5px;text-align:center;margin:auto 0}
    </style>
    <div class='box'>
      <div class='hd'><span>AI chat</span><span class='sp'></span><span class='nc'>New chat</span><span class='x'>\u2715</span></div>
      <div class='list'></div>
      <div class='cmp'><textarea rows='1' placeholder='Ask anything...'></textarea><button class='send'>Send</button></div>
    </div>`;
  document.body.appendChild(host);
  const $ = q => root.querySelector(q), list = $('.list'), ta = $('textarea'), send = $('.send'), hd = $('.hd');

  let hist = [], busy = false;
  const view = (pending) => {
    list.textContent = '';
    if (!hist.length && !pending) list.append(el('div', { className: 'hint', textContent: 'Ask a question. If one of your API keys runs out, the next one is used automatically and the answer says which one replied.' }));
    hist.forEach(m => {
      list.append(el('div', { className: 'm ' + (m.role === 'user' ? 'u' : m.err ? 'e' : 'a'), textContent: m.content }));
      if (m.meta) list.append(el('div', { className: 'meta' + (m.switched ? ' sw' : ''), textContent: m.meta }));
    });
    if (pending) list.append(el('div', { className: 'meta', textContent: pending }));
    list.scrollTop = list.scrollHeight;
  };
  async function go() {
    const text = ta.value.trim();
    if (!text || busy) return;
    busy = true; send.disabled = true; ta.value = ''; ta.style.height = 'auto';
    hist.push({ role: 'user', content: text }); view('Thinking...');
    try {
      const msgs = hist.filter(m => !m.err).slice(-14).map(m => ({ role: m.role, content: m.content }));
      const r = await P.ask({ messages: msgs, onTry: s => view('Trying ' + s.entry.label + ' / ' + s.model + '...') });
      const sw = r.attempts.filter(a => a.skipped || a.error);
      hist.push({ role: 'assistant', content: r.text, meta: 'via ' + r.label + ' \u00B7 ' + r.model + (sw.length ? '  (skipped: ' + sw.map(a => a.label + ' / ' + a.model.split('/').pop()).join(', ') + ')' : ''), switched: !!sw.length });
    } catch (e) { hist.push({ role: 'assistant', content: e.message, err: true }); }
    busy = false; send.disabled = false; view(); ta.focus();
  }
  send.onclick = go;
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; });
  $('.nc').onclick = () => { if (!busy) { hist = []; view(); } };
  for (const t of ['keydown', 'keyup', 'keypress']) $('.box').addEventListener(t, e => e.stopPropagation());
  const destroy = () => host.remove(); host._destroy = destroy; $('.x').onclick = destroy;
  let drag = false, dx = 0, dy = 0;
  hd.addEventListener('pointerdown', e => { if (e.target.classList.contains('x') || e.target.classList.contains('nc')) return; drag = true; const r = host.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; hd.setPointerCapture(e.pointerId); e.preventDefault(); });
  hd.addEventListener('pointermove', e => { if (drag) { host.style.left = (e.clientX - dx) + 'px'; host.style.top = (e.clientY - dy) + 'px'; host.style.right = 'auto'; host.style.bottom = 'auto'; } });
  hd.addEventListener('pointerup', () => { drag = false; });
  view(); setTimeout(() => ta.focus(), 50);
})();
