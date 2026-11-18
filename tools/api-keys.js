(() => {
  const ID = '__apikeys_tool';
  const old = document.getElementById(ID);
  if (old) { old._destroy ? old._destroy() : old.remove(); return; }
  const P = window.APIPool;
  if (!P) { alert('The API keys tool needs lib/apipool.js. In tools.json, give this tool "needs": ["lib/apipool.js"].'); return; }

  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };
  const host = el('div', { id: ID });
  host.style.cssText = 'all:initial;position:fixed;top:24px;right:24px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}[hidden]{display:none!important}
      .box{width:440px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column;background:#16181d;color:#e8e9ed;border:1px solid #2c303a;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.55);font:14px/1.45 system-ui,sans-serif}
      .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2c303a;cursor:move;user-select:none;font-weight:700}
      .hd .sp{flex:1}.x{cursor:pointer;color:#9aa0b0;padding:2px 7px;border-radius:6px}.x:hover{background:#2b303b;color:#fff}
      .body{overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px}
      .note{padding:8px 10px;border-radius:8px;background:#1f2a3d;color:#bcd2ff;font-size:12.5px;line-height:1.4}
      .note.err{background:#3d1f1f;color:#ffb4ab}.note.ok{background:#1f3d2a;color:#b9f3c9}
      .entry{border:1px solid #2c303a;border-radius:10px;padding:9px 10px;background:#1b1e25}
      .entry.off{opacity:.55}
      .top{display:flex;align-items:center;gap:8px}
      .dot{width:9px;height:9px;border-radius:50%;background:#3fb950;flex:none}.dot.warn{background:#e3b341}.dot.bad{background:#f85149}.dot.off{background:#6b7280}
      .lbl{font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .meta{color:#8b90a0;font-size:12px;margin-top:3px;word-break:break-all}
      .slots{margin-top:6px;font-size:12px;color:#aab0c0}.slots div{display:flex;justify-content:space-between;gap:8px}
      .slots .sk{color:#e3b341}
      .badge{font-size:10.5px;background:#2b4a8a;border-radius:4px;padding:1px 6px;color:#cfe0ff}
      .acts{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
      button,select{background:#2b303b;color:#e8e9ed;border:0;border-radius:8px;padding:6px 10px;font:inherit;cursor:pointer}
      button:hover{background:#363c4a}button.pri{background:#3b6fd8;color:#fff}button.dng{color:#ff9b93}button.sm{padding:3px 8px;font-size:12px}
      button:disabled{opacity:.5;cursor:default}
      label{display:block;color:#9aa0b0;font-size:12px;margin:8px 0 3px}
      input[type=text],input[type=password],input[type=number],select{width:100%;background:#12141a;color:#e8e9ed;border:1px solid #2c303a;border-radius:8px;padding:7px 9px;font:inherit;outline:none}
      input:focus,select:focus{border-color:#3b6fd8}
      .row{display:flex;gap:8px;align-items:center}.row>*{flex:1}.row .chk{flex:none}
      .res{margin-top:6px;font-size:12.5px}.res.ok{color:#7ee787}.res.bad{color:#ffb4ab}
      h3{margin:0 0 4px;font-size:14px}
    </style>
    <div class='box'>
      <div class='hd'><span>\uD83D\uDD11 API keys</span><span class='sp'></span><span class='x'>\u2715</span></div>
      <div class='body'></div>
    </div>`;
  document.body.appendChild(host);
  const body = root.querySelector('.body'), hd = root.querySelector('.hd');

  let entries = [], slots = [], editing = null, busy = false, results = {};
  const vaultEntries = () => entries.filter(e => !e.fromLoader);
  const clean = e => { const c = { ...e }; delete c._kid; return c; };

  let seq = 0;
  async function refresh(force = true) {
    const my = ++seq;                                   // a newer refresh makes older, slower ones irrelevant
    if (force) P.invalidate();
    const e = await P.load(true);
    const sl = P.dbOk() && P.hasSecret() && !P.vaultError() ? await P.status() : [];
    if (my !== seq) return;
    entries = e; slots = sl;
    if (!editing) render();                              // never redraw while a form is open: it would wipe what is being typed
  }
  async function persist(list) {            // list = vault entries only
    busy = true; render();
    try { await P.save(list); await refresh(); }
    catch (e) { busy = false; render(e.message); return; }
    busy = false; render();
  }

  function render(err) {
    body.textContent = '';
    if (err) body.append(el('div', { className: 'note err', textContent: err }));
    if (!P.dbOk()) { body.append(el('div', { className: 'note err', textContent: 'No database address. Your loader bookmark needs window.__CHAT_DB=\'https://...firebaseio.com\' (the same one the chat uses).' })); return; }
    if (!P.hasSecret()) { passForm(); return; }
    const ve = P.vaultError();
    if (ve) { body.append(el('div', { className: 'note err', textContent: ve.message })); passForm(true); return; }
    body.append(el('div', { className: 'note', textContent: 'Keys are encrypted in your browser before they are stored, so your database only ever holds scrambled text. Add as many as you like: when one runs out the next one is used automatically, top to bottom.' }));
    const top = el('div', { className: 'row' }, el('button', { className: 'pri', textContent: '+ Add a key', onclick: () => { editing = { isNew: true, e: { id: P.newId(), provider: 'gemini' } }; render(); } }),
      el('button', { textContent: 'Refresh', onclick: () => refresh() }));
    body.append(top);
    if (editing) { body.append(form()); }
    if (!entries.length && !editing) body.append(el('div', { className: 'note', textContent: 'No keys in this vault yet. Click "Add a key". If you expected to see keys here, the passphrase is probably different: every passphrase opens its own separate vault, and a wrong one can never open someone else\'s.' }));
    entries.forEach((e, idx) => body.append(card(e, idx)));
  }

  function passForm(change) {
    body.append(el('h3', { textContent: change ? 'Enter the vault passphrase' : 'Set the vault passphrase' }));
    body.append(el('div', { className: 'note', textContent: 'This passphrase locks your stored keys. Choose something long. To use the vault on every site, also add window.__VAULT="your passphrase" to your loader bookmark. If you forget it, the stored keys cannot be recovered (you would add them again).' }));
    const i = el('input', { type: 'password', placeholder: 'passphrase' });
    const go = el('button', { className: 'pri', textContent: 'Use it', onclick: async () => { if (i.value.length < 8) { render('Use at least 8 characters.'); return; } P.setPass(i.value); await refresh(); } });
    body.append(i, go);
  }

  function card(e, idx) {
    const mine = slots.filter(s => s.entry.id === e.id);
    const anyOk = mine.some(s => !s.skipped), rejected = mine.length && mine.every(s => s.skipped === 'key rejected');
    const dot = e.enabled === false ? 'off' : rejected ? 'bad' : (mine.length && !anyOk) ? 'warn' : '';
    const c = el('div', { className: 'entry' + (e.enabled === false ? ' off' : '') });
    c.append(el('div', { className: 'top' }, el('span', { className: 'dot ' + dot }), el('span', { className: 'lbl', textContent: e.label || '(no name)' }),
      e.fromLoader ? el('span', { className: 'badge', textContent: 'from loader' }) : '', el('span', { className: 'badge', textContent: '#' + (idx + 1) })));
    c.append(el('div', { className: 'meta', textContent: ((P.PROVIDERS[e.provider] || {}).name || e.provider) + ' \u00B7 ' + P.maskKey(e.key) + (e.base ? ' \u00B7 ' + e.base : '') }));
    if (mine.length) {
      const box = el('div', { className: 'slots' });
      mine.forEach(s => box.append(el('div', { className: s.skipped ? 'sk' : '' }, el('span', { textContent: s.model }), el('span', { textContent: s.skipped || (s.used + (s.limit ? ' / ' + s.limit : '') + ' today') }))));
      c.append(box);
    }
    const r = results[e.id]; if (r) c.append(el('div', { className: 'res ' + (r.ok ? 'ok' : 'bad'), textContent: r.ok ? '\u2713 Works (' + r.ms + ' ms, ' + r.model + ')' : '\u2717 ' + r.msg }));
    const acts = el('div', { className: 'acts' });
    const b = (t, fn, cls = 'sm') => acts.append(el('button', { className: cls, textContent: t, onclick: fn, disabled: busy }));
    b('Test', async () => { results[e.id] = { ok: false, msg: 'Testing...' }; render(); results[e.id] = await P.test(e); render(); });
    if (e.fromLoader) b('Move to vault', () => { const v = vaultEntries(); v.push({ ...clean(e), id: P.newId(), fromLoader: undefined, label: e.label.replace('Loader key', 'My key') }); persist(v); });
    else {
      b('Edit', () => { editing = { isNew: false, e: { ...e } }; render(); });
      b(e.enabled === false ? 'Turn on' : 'Turn off', () => persist(vaultEntries().map(x => x.id === e.id ? { ...x, enabled: x.enabled === false } : x)));
      b('\u2191', () => move(e, -1)); b('\u2193', () => move(e, 1));
      b('Delete', () => { if (confirm('Delete "' + e.label + '"?')) persist(vaultEntries().filter(x => x.id !== e.id)); }, 'sm dng');
    }
    c.append(acts); return c;
  }
  function move(e, d) {
    const v = vaultEntries(), i = v.findIndex(x => x.id === e.id), j = i + d;
    if (j < 0 || j >= v.length) return;
    [v[i], v[j]] = [v[j], v[i]]; v.forEach((x, n) => { x.prio = n * 10; }); persist(v);
  }

  function form() {
    const { isNew, e } = editing, f = el('div', { className: 'entry' });
    f.append(el('h3', { textContent: isNew ? 'Add a key' : 'Edit key' }));
    const sel = el('select'); Object.entries(P.PROVIDERS).forEach(([k, v]) => sel.add(new Option(v.name, k))); sel.value = e.provider;
    const label = el('input', { type: 'text', value: e.label || '', placeholder: 'A name you will recognise, e.g. "Gemini - school account"' });
    const key = el('input', { type: 'password', placeholder: isNew ? 'Paste the API key' : 'Leave empty to keep the current key', autocomplete: 'off' });
    const show = el('button', { className: 'sm', textContent: 'Show', onclick: () => { key.type = key.type === 'password' ? 'text' : 'password'; show.textContent = key.type === 'password' ? 'Show' : 'Hide'; } });
    const models = el('input', { type: 'text', value: (e.models || []).join(', ') });
    const base = el('input', { type: 'text', value: e.base || '', placeholder: 'https://api.example.com/v1' });
    const lim = el('input', { type: 'number', min: 0, value: e.limit != null ? e.limit : '' });
    const vis = el('input', { type: 'checkbox', checked: e.vision != null ? !!e.vision : !!(P.PROVIDERS[e.provider] || {}).vision });
    const baseWrap = el('div'), hint = el('div', { className: 'meta' });
    const sync = () => {
      const pv = P.PROVIDERS[sel.value] || {};
      models.placeholder = pv.models && pv.models.length ? pv.models.join(', ') : 'model name(s), comma separated';
      if (isNew && !models.value) models.value = (pv.models || []).join(', ');
      lim.placeholder = pv.limit ? 'default ' + pv.limit : '0 = no limit';
      baseWrap.hidden = !(sel.value === 'openai' || sel.value === 'openrouter');
      hint.textContent = pv.hint || ''; if (isNew) vis.checked = !!pv.vision;
    };
    sel.onchange = () => { if (isNew) models.value = ''; sync(); };
    baseWrap.append(el('label', { textContent: 'Base URL (only for "Other"; leave empty for OpenRouter)' }), base);
    f.append(el('label', { textContent: 'Service' }), sel, hint, el('label', { textContent: 'Name' }), label, el('label', { textContent: 'API key' }), el('div', { className: 'row' }, key, show),
      el('label', { textContent: 'Models to try, in order (comma separated)' }), models, baseWrap,
      el('label', { textContent: 'Requests per day per model (0 = unknown / no limit)' }), lim,
      el('label', { className: 'row' }, el('span', { className: 'chk' }, vis), el('span', { textContent: 'Can read images (needed for screenshot tools)' })));
    const save = el('button', { className: 'pri', textContent: 'Save', onclick: () => {
      const keyVal = key.value.trim() || (isNew ? '' : e.key);
      const ms = models.value.split(',').map(x => x.trim()).filter(Boolean);
      if (!keyVal) return render('Paste the API key.');
      if (!ms.length && !(P.PROVIDERS[sel.value].models || []).length) return render('Add at least one model name for this service.');
      if (sel.value === 'openai' && !base.value.trim()) return render('"Other" services need a base URL.');
      const ne = { id: e.id, provider: sel.value, label: label.value.trim() || (P.PROVIDERS[sel.value].name), key: keyVal, models: ms, base: base.value.trim().replace(/\/+$/, ''),
        vision: vis.checked, enabled: e.enabled, prio: e.prio };
      if (lim.value !== '') ne.limit = +lim.value;
      const v = vaultEntries(); const i = v.findIndex(x => x.id === e.id);
      if (i >= 0) v[i] = ne; else { ne.prio = v.length * 10; v.push(ne); }
      editing = null; persist(v);
    } });
    f.append(el('div', { className: 'acts' }, save, el('button', { textContent: 'Cancel', onclick: () => { editing = null; render(); } })));
    sync(); return f;
  }

  const destroy = () => host.remove();
  host._destroy = destroy; root.querySelector('.x').onclick = destroy;
  let drag = false, dx = 0, dy = 0;
  hd.addEventListener('pointerdown', e => { if (e.target.classList.contains('x')) return; drag = true; const r = host.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; hd.setPointerCapture(e.pointerId); e.preventDefault(); });
  hd.addEventListener('pointermove', e => { if (drag) { host.style.left = (e.clientX - dx) + 'px'; host.style.top = (e.clientY - dy) + 'px'; host.style.right = 'auto'; } });
  hd.addEventListener('pointerup', () => { drag = false; });
  for (const t of ['keydown', 'keyup', 'keypress']) root.querySelector('.box').addEventListener(t, e => e.stopPropagation());
  render(); refresh(false);
})();
