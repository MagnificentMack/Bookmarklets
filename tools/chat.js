(() => {
  const ID = '__chat_tool';
  const old = document.getElementById(ID);
  if (old) { old._destroy ? old._destroy() : old.remove(); return; }

  // ---- Logic ----
  const PAGE = 100;
  const cleanDb = u => {
    u = String(u || '').trim().replace(/\/+$/, '');
    return (/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u)) ? u : '';
  };
  const cleanRoom = r => { r = String(r || '').trim(); return /^[A-Za-z0-9_-]{3,64}$/.test(r) ? r : ''; };
  const cleanName = n => String(n || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24);
  const nameKey = n => cleanName(n).toLowerCase().replace(/[.$#\[\]\/]/g, '_');
  const validMsg = v => !!v && typeof v.n === 'string' && typeof v.t === 'string' && typeof v.ts === 'number';
  const hue = n => { let h = 0; for (const c of String(n).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  const linkify = text => {
    const out = [], re = /https?:\/\/[^\s<>"']+/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      let url = m[0];
      const trail = url.match(/[.,!?;:)\]]+$/);
      if (trail) url = url.slice(0, -trail[0].length);
      if (m.index > last) out.push({ t: text.slice(last, m.index) });
      out.push({ t: url, href: url });
      last = m.index + url.length; re.lastIndex = last;
    }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  };

  // Apply a Firebase streaming event ({path, data}) to the message map. Returns keys that are new.
  const applyEvent = (map, ev) => {
    const added = [];
    const put = (k, v) => { if (validMsg(v)) { if (!map.has(k)) added.push(k); map.set(k, { k, n: v.n, t: v.t, ts: v.ts }); } };
    if (!ev || typeof ev.path !== 'string') return added;
    if (ev.path === '/') { if (ev.data && typeof ev.data === 'object') for (const [k, v] of Object.entries(ev.data)) put(k, v); }
    else { const p = ev.path.split('/').filter(Boolean); if (p.length === 1) put(p[0], ev.data); }
    return added;
  };
  const mergeObj = (map, obj) => applyEvent(map, { path: '/', data: obj });
  const sortedMsgs = map => [...map.values()].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  const dayLabel = (ts, now = Date.now()) => {
    const d = new Date(ts).toDateString();
    if (d === new Date(now).toDateString()) return 'Today';
    if (d === new Date(now - 864e5).toDateString()) return 'Yesterday';
    return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  // Turn sorted messages into render items: day dividers, a "new messages" divider, and name-grouping flags.
  const buildItems = (list, divKey, myKey) => {
    const items = []; let lastDay = '', prev = null, shownNew = false;
    for (const m of list) {
      const day = new Date(m.ts).toDateString();
      if (day !== lastDay) { items.push({ type: 'day', label: dayLabel(m.ts) }); lastDay = day; prev = null; }
      if (divKey && !shownNew && m.k > divKey && nameKey(m.n) !== myKey) { items.push({ type: 'new' }); shownNew = true; prev = null; }
      items.push({ type: 'msg', m, mine: nameKey(m.n) === myKey, showName: !prev || prev.n !== m.n || m.ts - prev.ts > 300000 });
      prev = m;
    }
    return items;
  };
  const onlineNames = (presence, ttl = 70000) => {
    const ents = Object.entries(presence || {}).filter(([, v]) => typeof v === 'number');
    if (!ents.length) return [];
    const ref = Math.max(...ents.map(e => e[1]));          // newest heartbeat is ours, so this is "server now"
    return ents.filter(([, v]) => v >= ref - ttl).map(([k]) => k);
  };

  // ---- UI ----
  const LS = '__chat_cfg_v1', UIK = '__chat_ui_v1';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };

  const saved = lsGet(LS, {});
  let DB = cleanDb(window.__CHAT_DB) || cleanDb(saved.db);
  let ROOM = cleanRoom(window.__CHAT_ROOM) || cleanRoom(saved.room);
  let NAME = cleanName(saved.name) || cleanName(window.__CHAT_NAME);
  let KEY = nameKey(NAME);
  let sound = saved.sound !== false;

  const ui = lsGet(UIK, {});
  const W0 = Math.min(ui.w || 340, innerWidth - 20), H0 = Math.min(ui.h || 460, innerHeight - 20);
  const host = el('div', { id: ID });
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:' +
    Math.max(0, Math.min(ui.x != null ? ui.x : innerWidth - W0 - 16, innerWidth - 60)) + 'px;top:' +
    Math.max(0, Math.min(ui.y != null ? ui.y : innerHeight - H0 - 16, innerHeight - 40)) + 'px';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}
      [hidden]{display:none!important}
      .box{width:${W0}px;height:${H0}px;min-width:280px;min-height:300px;max-width:96vw;max-height:96vh;resize:both;overflow:hidden;
        display:flex;flex-direction:column;position:relative;background:#16181d;color:#e8e9ed;border:1px solid #2c303a;border-radius:12px;
        box-shadow:0 12px 40px rgba(0,0,0,.55);font:14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif}
      .hd{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#1d2027;border-bottom:1px solid #2c303a;cursor:move;user-select:none}
      .dot{width:9px;height:9px;border-radius:50%;background:#888;flex:none}
      .dot.ok{background:#3fb950}.dot.wait{background:#e3b341}.dot.err{background:#f85149}
      .ttl{font-weight:700}
      .on{flex:1;color:#8b90a0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ic{cursor:pointer;color:#9aa0b0;padding:3px 7px;border-radius:6px;user-select:none}
      .ic:hover{background:#2b303b;color:#fff}
      .note{padding:6px 10px;background:#3a2a1a;color:#ffd9a8;font-size:12.5px}
      .list{flex:1;overflow-y:auto;padding:8px 10px;scroll-behavior:auto}
      .older{display:block;margin:2px auto 8px;background:#262a33;color:#c8ccd8;border:0;border-radius:14px;padding:4px 12px;cursor:pointer;font:inherit;font-size:12px}
      .day,.newdiv{display:flex;align-items:center;gap:8px;margin:10px 0 6px;color:#7d8394;font-size:11.5px}
      .day::before,.day::after,.newdiv::before,.newdiv::after{content:'';flex:1;height:1px;background:#2c303a}
      .newdiv{color:#ff7b72}.newdiv::before,.newdiv::after{background:#5b2b2b}
      .row{display:flex;flex-direction:column;align-items:flex-start;margin-top:2px}
      .row.mine{align-items:flex-end}
      .row.first{margin-top:8px}
      .nm{font-size:11.5px;font-weight:700;margin:0 4px 1px}
      .bub{max-width:86%;padding:6px 10px;border-radius:12px;background:#262a33;white-space:pre-wrap;overflow-wrap:anywhere;position:relative}
      .mine .bub{background:#2b4a8a}
      .bub a{color:#8cc2ff}
      .bub time{display:none;position:absolute;top:-16px;font-size:10.5px;color:#8b90a0;white-space:nowrap;background:#16181d;padding:0 4px;border-radius:4px}
      .row:not(.mine) .bub time{left:4px}.row.mine .bub time{right:4px}
      .bub:hover time{display:block}
      .jump{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;background:#2b4a8a;color:#fff;border:0;border-radius:16px;padding:5px 12px;
        cursor:pointer;font:inherit;font-size:12.5px;box-shadow:0 4px 12px rgba(0,0,0,.4)}
      .cmp{display:flex;gap:6px;padding:8px;border-top:1px solid #2c303a;background:#1d2027;align-items:flex-end}
      textarea{flex:1;resize:none;background:#12141a;color:#e8e9ed;border:1px solid #2c303a;border-radius:10px;padding:8px 10px;font:inherit;outline:none;
        max-height:96px;min-height:36px}
      textarea:focus{border-color:#3b6fd8}
      .send{background:#3b6fd8;color:#fff;border:0;border-radius:10px;padding:0 14px;height:36px;cursor:pointer;font:inherit;font-weight:600}
      .send:disabled{opacity:.5;cursor:default}
      .cnt{position:absolute;right:76px;bottom:12px;font-size:11px;color:#8b90a0;pointer-events:none}
      .pane{position:absolute;inset:44px 0 0 0;background:#16181d;overflow:auto;padding:14px}
      .pane h3{margin:0 0 10px;font-size:15px}
      .pane label{display:block;margin:10px 0 4px;color:#9aa0b0;font-size:12px}
      .pane input[type=text]{width:100%;background:#12141a;color:#e8e9ed;border:1px solid #2c303a;border-radius:8px;padding:8px;font:inherit;outline:none}
      .pane p{color:#8b90a0;font-size:12.5px;margin:8px 0}
      .btn{background:#2b303b;color:#e8e9ed;border:0;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer;margin:8px 6px 0 0}
      .btn.pri{background:#3b6fd8;color:#fff}
      .chk{display:flex!important;align-items:center;gap:8px;color:#e8e9ed!important;font-size:14px!important}
      code{background:#12141a;padding:1px 5px;border-radius:4px;font-size:12px}
      .pill{background:#3b6fd8;color:#fff;border-radius:22px;padding:9px 15px;cursor:pointer;font:600 14px system-ui,sans-serif;
        box-shadow:0 6px 20px rgba(0,0,0,.45);user-select:none}
      .bdg{background:#f85149;border-radius:10px;padding:0 6px;margin-left:6px;font-size:12px}
    </style>
    <div class='box'>
      <div class='hd'><span class='dot'></span><span class='ttl'>Chat</span><span class='on'></span>
        <span class='ic gear' title='Settings'>\u2699\uFE0E</span><span class='ic min' title='Minimize'>\u2013</span><span class='ic x' title='Close'>\u2715</span></div>
      <div class='note' hidden></div>
      <div class='list'></div>
      <button class='jump' hidden></button>
      <div class='cmp'><textarea rows='1' maxlength='500' placeholder='Message everyone...'></textarea><button class='send'>Send</button></div>
      <span class='cnt' hidden></span>
      <div class='pane setup' hidden></div>
      <div class='pane set' hidden></div>
    </div>
    <div class='pill' hidden>\uD83D\uDCAC Chat<span class='bdg' hidden></span></div>`;
  document.body.appendChild(host);

  const $ = q => root.querySelector(q);
  const box = $('.box'), hd = $('.hd'), dot = $('.dot'), onEl = $('.on'), note = $('.note'), listEl = $('.list'), jump = $('.jump');
  const ta = $('textarea'), sendBtn = $('.send'), cnt = $('.cnt'), setup = $('.setup'), setPane = $('.set'), pill = $('.pill'), bdg = $('.bdg');

  // ---- State ----
  const msgs = new Map();
  let hasMore = false, readKey = '', divKey = '', es = null, pollT = 0, beatT = 0, dead = false, minimized = !!ui.min;
  let bootT = 0, saveT = 0, readT = 0, sending = false, lastSend = 0, authors = {}, online = [], actx = null;

  const api = (path, q = '') => DB + '/rooms/' + ROOM + '/' + path + '.json' + q;
  const qs = o => '?' + Object.entries(o).map(([k, v]) =>
    k + '=' + encodeURIComponent(['orderBy', 'startAt', 'endAt'].includes(k) ? JSON.stringify(v) : v)).join('&');
  const getJson = async url => {
    let r;
    try { r = await fetch(url, { cache: 'no-store' }); } catch { throw new Error('Can\'t reach the database. Check your connection or the site\'s security policy.'); }
    if (r.status === 401 || r.status === 403) throw new Error('Permission denied. Check the database rules.');
    if (!r.ok) throw new Error('Database error ' + r.status);
    return r.json();
  };
  const setStatus = (k, t) => { dot.className = 'dot ' + k; dot.title = t || ''; note.hidden = k !== 'err'; if (k === 'err') note.textContent = t; };
  const saveCfg = () => lsSet(LS, { db: DB, room: ROOM, name: NAME, sound });
  const lastKey = () => { let k = ''; for (const x of msgs.keys()) if (x > k) k = x; return k; };
  const firstKey = () => { let k = ''; for (const x of msgs.keys()) if (!k || x < k) k = x; return k; };
  const unread = () => sortedMsgs(msgs).filter(m => m.k > readKey && nameKey(m.n) !== KEY).length;

  const nearBottom = () => listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
  const visible = () => !minimized && document.visibilityState === 'visible';

  const updateBadges = () => {
    const n = unread();
    bdg.hidden = !(minimized && n); bdg.textContent = n > 99 ? '99+' : n;
  };

  function render(mode = 'keep') {
    const prevH = listEl.scrollHeight, prevTop = listEl.scrollTop, was = nearBottom();
    listEl.textContent = '';
    if (hasMore) {
      const ob = el('button', { className: 'older', textContent: 'Load older messages' });
      ob.onclick = loadOlder; listEl.append(ob);
    }
    let divEl = null;
    for (const it of buildItems(sortedMsgs(msgs), divKey, KEY)) {
      if (it.type === 'day') listEl.append(el('div', { className: 'day', textContent: it.label }));
      else if (it.type === 'new') { divEl = el('div', { className: 'newdiv', textContent: 'New messages' }); listEl.append(divEl); }
      else {
        const m = it.m, parts = linkify(m.t);
        const bub = el('div', { className: 'bub' });
        parts.forEach(p => bub.append(p.href ? el('a', { href: p.href, target: '_blank', rel: 'noopener noreferrer', textContent: p.t }) : document.createTextNode(p.t)));
        bub.append(el('time', { textContent: new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
        const row = el('div', { className: 'row' + (it.mine ? ' mine' : '') + (it.showName ? ' first' : '') });
        if (it.showName && !it.mine) { const nm = el('span', { className: 'nm', textContent: m.n }); nm.style.color = 'hsl(' + hue(m.n) + ',70%,68%)'; row.append(nm); }
        row.append(bub); listEl.append(row);
      }
    }
    if (mode === 'bottom' || (mode === 'keep' && was)) listEl.scrollTop = listEl.scrollHeight;
    else if (mode === 'divider') { divEl ? (listEl.scrollTop = divEl.offsetTop - 30) : (listEl.scrollTop = listEl.scrollHeight); }
    else if (mode === 'older') listEl.scrollTop = prevTop + (listEl.scrollHeight - prevH);
    else listEl.scrollTop = prevTop;
    updateBadges();
  }

  const updateOnline = () => {
    const names = online.map(k => authors[k] || k);
    onEl.textContent = names.length ? names.length + ' online' : '';
    onEl.title = names.join(', ');
  };
  const rememberAuthors = () => { for (const m of msgs.values()) authors[nameKey(m.n)] = m.n; };

  const markRead = () => {
    if (!visible() || !nearBottom()) return;
    const k = lastKey();
    if (!k || k <= readKey) { updateBadges(); return; }
    readKey = k; updateBadges(); jump.hidden = true;
    clearTimeout(readT);
    readT = setTimeout(() => { fetch(api('reads/' + KEY), { method: 'PUT', body: JSON.stringify(readKey) }).catch(() => {}); }, 700);
  };

  const beep = () => {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 880; g.gain.value = .05; o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + .12);
    } catch {}
  };

  const onNew = keys => {
    rememberAuthors();
    const others = keys.filter(k => nameKey(msgs.get(k).n) !== KEY);
    const was = nearBottom();
    render('keep');
    if (others.length) {
      if (!visible()) beep();
      if (visible() && !was) { const n = unread(); jump.hidden = false; jump.textContent = '\u2193 ' + n + ' new'; }
    }
    markRead();
  };

  async function loadOlder() {
    const first = firstKey();
    try {
      const o = await getJson(api('messages', qs({ orderBy: '$key', endAt: first, limitToLast: PAGE + 1 })));
      const n = o ? Object.keys(o).length : 0;
      mergeObj(msgs, o || {});
      hasMore = n >= PAGE + 1; rememberAuthors(); render('older');
    } catch (e) { setStatus('err', e.message); }
  }

  const catchUp = async () => {
    try {
      const k = lastKey();
      const o = await getJson(api('messages', k ? qs({ orderBy: '$key', startAt: k, limitToFirst: 500 }) : qs({ orderBy: '$key', limitToLast: PAGE })));
      const added = mergeObj(msgs, o || {});
      if (added.length) onNew(added);
      if (dot.className.includes('err') || dot.className.includes('wait')) setStatus('ok', 'Connected');
    } catch (e) { setStatus('err', e.message); }
  };

  const stopLive = () => {
    if (es) { es.close(); es = null; }
    clearInterval(pollT); clearInterval(beatT); pollT = beatT = 0;
  };
  const startPolling = () => { if (!pollT) pollT = setInterval(catchUp, 3000); };
  function startLive() {
    stopLive();
    try {
      es = new EventSource(api('messages', qs({ orderBy: '$key', limitToLast: 1 })));
      es.onopen = () => { setStatus('ok', 'Connected'); catchUp(); };
      const onEv = e => { try { const added = applyEvent(msgs, JSON.parse(e.data)); if (added.length) onNew(added); } catch {} };
      es.addEventListener('put', onEv); es.addEventListener('patch', onEv);
      es.addEventListener('cancel', () => { setStatus('err', 'Permission denied. Check the database rules.'); });
      es.onerror = () => { setStatus('wait', 'Reconnecting...'); if (es && es.readyState === 2) startPolling(); };
    } catch { startPolling(); }
    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await fetch(api('presence/' + KEY), { method: 'PUT', body: JSON.stringify({ '.sv': 'timestamp' }) });
        online = onlineNames(await getJson(api('presence'))); updateOnline();
      } catch {}
    };
    beat(); beatT = setInterval(beat, 25000);
  }

  async function boot() {
    clearTimeout(bootT);
    if (!DB || !ROOM || !NAME) { showSetup(); return; }
    setup.hidden = true;
    setStatus('wait', 'Connecting...');
    try {
      const mine = await getJson(api('reads/' + KEY));
      readKey = typeof mine === 'string' ? mine : '';
      msgs.clear();
      const recent = await getJson(api('messages', qs({ orderBy: '$key', limitToLast: PAGE })));
      mergeObj(msgs, recent || {});
      hasMore = !!recent && Object.keys(recent).length >= PAGE;
      const first = firstKey();
      if (readKey && first && readKey < first) {           // unread messages older than the first page
        mergeObj(msgs, await getJson(api('messages', qs({ orderBy: '$key', startAt: readKey, limitToFirst: 1000 }))) || {});
        hasMore = true;
      }
      divKey = readKey; rememberAuthors();
      render(divKey ? 'divider' : 'bottom');
      setStatus('ok', 'Connected');
      startLive(); markRead();
    } catch (e) {
      setStatus('err', e.message);
      bootT = setTimeout(() => { if (!dead) boot(); }, 6000);
    }
  }

  // ---- Sending ----
  async function send() {
    const text = ta.value.trim();
    if (!text || sending) return;
    if (!NAME) { showSettings(); return; }
    const wait = 400 - (Date.now() - lastSend);
    if (wait > 0) { setTimeout(send, wait); return; }       // too fast: send right after the short cooldown instead of dropping it
    sending = true; sendBtn.disabled = true;
    try {
      const r = await fetch(api('messages'), { method: 'POST', body: JSON.stringify({ n: NAME, t: text.slice(0, 500), ts: { '.sv': 'timestamp' } }) });
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Message rejected (rules or size).' : 'Send failed (' + r.status + ')');
      const j = await r.json();
      ta.value = ''; ta.style.height = 'auto'; cnt.hidden = true;
      const added = applyEvent(msgs, { path: '/' + j.name, data: { n: NAME, t: text.slice(0, 500), ts: Date.now() } });
      authors[KEY] = NAME;
      if (added.length) { render('bottom'); readKey = lastKey(); markRead(); }
      lastSend = Date.now();
    } catch (e) {
      setStatus('err', e.message); setTimeout(() => setStatus('ok', 'Connected'), 4000);
    }
    sending = false; sendBtn.disabled = false; ta.focus();
  }
  sendBtn.onclick = send;
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  ta.addEventListener('input', () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
    cnt.hidden = ta.value.length < 400; cnt.textContent = ta.value.length + '/500';
  });
  jump.onclick = () => { render('bottom'); markRead(); };
  listEl.addEventListener('scroll', () => { if (nearBottom()) { jump.hidden = true; markRead(); } });
  for (const t of ['keydown', 'keyup', 'keypress']) box.addEventListener(t, e => e.stopPropagation());

  // ---- Setup + settings panes ----
  function showSetup() {
    setup.hidden = false; setPane.hidden = true; setup.textContent = '';
    const f = (label, val, ph) => { const i = el('input', { type: 'text', value: val || '', placeholder: ph || '' }); setup.append(el('label', { textContent: label }), i); return i; };
    setup.append(el('h3', { textContent: 'Set up chat' }));
    const iDb = f('Database URL', DB, 'https://your-project-default-rtdb.firebaseio.com');
    const iRoom = f('Room name (acts like a password)', ROOM, 'letters, numbers, - and _ only');
    const iName = f('Your name', NAME, 'shown on your messages');
    const err = el('p', { textContent: 'Tip: put the URL and room in your loader bookmark so every site already knows them.' });
    const go = el('button', { className: 'btn pri', textContent: 'Save and connect' });
    go.onclick = () => {
      const d = cleanDb(iDb.value), r = cleanRoom(iRoom.value), n = cleanName(iName.value);
      if (!d) { err.textContent = 'That database URL doesn\'t look right. It should start with https:// and have no path.'; return; }
      if (!r) { err.textContent = 'Room: 3-64 characters, letters, numbers, - or _ only.'; return; }
      if (!n) { err.textContent = 'Pick a name.'; return; }
      DB = d; ROOM = r; NAME = n; KEY = nameKey(n); saveCfg(); boot();
    };
    setup.append(go, err);
  }
  function showSettings() {
    setPane.hidden = false; setPane.textContent = '';
    setPane.append(el('h3', { textContent: 'Settings' }), el('label', { textContent: 'Your name' }));
    const iName = el('input', { type: 'text', value: NAME, maxLength: 24 });
    const chk = el('input', { type: 'checkbox', checked: sound });
    const msg = el('p', { textContent: 'Your name also decides which messages count as read, so use the same name on every device to pick up where you left off.' });
    const save = el('button', { className: 'btn pri', textContent: 'Save' });
    save.onclick = () => {
      const n = cleanName(iName.value); if (!n) { msg.textContent = 'Pick a name.'; return; }
      const changed = nameKey(n) !== KEY;
      NAME = n; KEY = nameKey(n); sound = chk.checked; saveCfg(); setPane.hidden = true;
      if (changed) { stopLive(); boot(); }
    };
    const close = el('button', { className: 'btn', textContent: 'Close', onclick: () => { setPane.hidden = true; } });
    const readAll = el('button', { className: 'btn', textContent: 'Mark all read', onclick: () => { readKey = ''; render('bottom'); markRead(); } });
    const forget = el('button', { className: 'btn', textContent: 'Forget setup on this site', onclick: () => {
      try { localStorage.removeItem(LS); } catch {} NAME = ''; setPane.hidden = true; stopLive(); showSetup(); } });
    setPane.append(iName, el('label', { className: 'chk' }, chk, 'Beep on new messages when I\'m away'), msg, save, close,
      el('label', { textContent: 'Connection' }),
      el('p', { textContent: (DB || 'not set').replace(/^https?:\/\//, '') + '  \u00B7  room ' + (ROOM ? ROOM.slice(0, 4) + '\u2026' : '-') + '  \u00B7  ' + msgs.size + ' messages loaded' }),
      readAll, forget);
  }
  $('.gear').onclick = () => { setPane.hidden ? showSettings() : (setPane.hidden = true); };

  // ---- Window chrome: drag, minimize, close, remember layout ----
  const saveUi = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const r = host.getBoundingClientRect();
      lsSet(UIK, { x: Math.round(r.left), y: Math.round(r.top), w: box.offsetWidth || ui.w, h: box.offsetHeight || ui.h, min: minimized });
    }, 400);
  };
  const setMin = m => {
    minimized = m; box.hidden = m; pill.hidden = !m; updateBadges(); saveUi();
    if (!m) { render('keep'); markRead(); ta.focus(); }
  };
  $('.min').onclick = () => setMin(true);
  pill.onclick = () => setMin(false);
  let drag = false, dx = 0, dy = 0;
  const dragStart = (e, handle) => {
    if (e.target.classList.contains('ic')) return;
    drag = true; const r = host.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId); e.preventDefault();
  };
  const dragMove = e => {
    if (!drag) return;
    host.style.left = Math.max(0, Math.min(e.clientX - dx, innerWidth - 60)) + 'px';
    host.style.top = Math.max(0, Math.min(e.clientY - dy, innerHeight - 40)) + 'px';
  };
  for (const h of [hd, pill]) {
    h.addEventListener('pointerdown', e => dragStart(e, h));
    h.addEventListener('pointermove', dragMove);
    h.addEventListener('pointerup', () => { if (drag) { drag = false; saveUi(); } });
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(saveUi) : null;
  ro && ro.observe(box);

  const onVis = () => { if (document.visibilityState === 'visible') { markRead(); if (DB && ROOM && NAME && !pollT && (!es || es.readyState === 2)) catchUp(); } };
  document.addEventListener('visibilitychange', onVis);

  const destroy = () => {
    dead = true; stopLive(); clearTimeout(bootT); clearTimeout(readT); ro && ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    if (DB && ROOM && KEY) fetch(api('presence/' + KEY), { method: 'DELETE', keepalive: true }).catch(() => {});
    host.remove();
  };
  host._destroy = destroy;
  $('.x').onclick = destroy;

  box.hidden = minimized; pill.hidden = !minimized;
  boot();
  if (!minimized) setTimeout(() => ta.focus(), 50);
})();
