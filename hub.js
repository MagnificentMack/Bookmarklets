(() => {
  // ---- Where am I loaded from? (the loader bookmark decides; nothing is hard-coded here) ----
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const M = /\/gh\/([^/]+)\/([^@/]+)@([^/]+)\//.exec(SRC);
  if (!M) { alert('Hub: could not read the repo from the script address.'); return; }
  const USER = M[1], REPO = M[2], VER = M[3];
  const base = (v = VER) => 'https://cdn.jsdelivr.net/gh/' + USER + '/' + REPO + '@' + v + '/';
  const bust = u => u + (u.includes('?') ? '&' : '?') + '_=' + Date.now();
  const ID = '__hub_root';
  document.getElementById(ID)?.remove();

  // ---- Settings (saved in this site's localStorage, so they are per-site) ----
  const SK = '__hub_settings_v1';
  const DEF = { theme: 'dark', size: 'm', sort: 'order', siteFirst: true, desc: true, closeOnRun: true, favs: [], recent: [] };
  const SIZES = { s: { w: 280, f: 13 }, m: { w: 320, f: 14 }, l: { w: 380, f: 16 } };
  const S = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(SK) || '{}') }; } catch { return { ...DEF }; } })();
  const save = () => { try { localStorage.setItem(SK, JSON.stringify(S)); } catch {} };

  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };

  // ---- Shell ----
  const host = el('div', { id: ID });
  host.style.cssText = 'all:initial;position:fixed;top:12px;right:12px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}
      [hidden]{display:none!important}
      .p{--bg:#111;--fg:#eee;--mut:#999;--in:#1c1c1c;--bd:#2a2a2a;--hv:#2b2b2b;--bt:#333;--ac:#3b82f6;
        width:320px;max-height:78vh;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);
        font:14px system-ui,sans-serif;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.55);overflow:hidden}
      .p[data-t=l]{--bg:#fff;--fg:#1a1a1a;--mut:#666;--in:#f3f3f3;--bd:#ddd;--hv:#eee;--bt:#e4e4e4}
      .h{display:flex;align-items:center;gap:4px;padding:10px;border-bottom:1px solid var(--bd)}
      input.q{flex:1;min-width:0;background:var(--in);color:var(--fg);border:1px solid var(--bd);border-radius:8px;padding:8px;font:inherit;outline:none}
      .ttl{flex:1;font-weight:700;padding:6px}
      .ic{cursor:pointer;color:var(--mut);padding:6px 8px;border-radius:6px;user-select:none}
      .ic:hover{background:var(--hv);color:var(--fg)}
      .note{margin:8px 8px 0;padding:8px 10px;border-radius:8px;background:#1f3d2a;color:#b9f3c9;font-size:.9em}
      .l,.s{overflow:auto;padding:6px}
      .i{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer}
      .i.sel,.i:hover{background:var(--hv)}
      .i .t{flex:1;min-width:0}
      .i small{display:block;color:var(--mut);margin-top:2px}
      .st{color:var(--mut);padding:2px 4px;font-size:1.1em}
      .st.on{color:#f5b400}
      .m{padding:12px;color:var(--mut)}
      .sec{margin:14px 6px 4px;font-size:.78em;text-transform:uppercase;letter-spacing:.07em;color:var(--mut)}
      .row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px}
      select{background:var(--in);color:var(--fg);border:1px solid var(--bd);border-radius:6px;padding:5px;font:inherit}
      button{background:var(--bt);color:var(--fg);border:0;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer;margin:2px 4px 2px 0}
      button.pri{background:var(--ac);color:#fff}
      button.back{background:none;color:var(--mut);padding:6px}
      a.lnk{display:block;padding:6px;color:var(--ac);text-decoration:none}
      a.lnk:hover{text-decoration:underline}
      .info{padding:3px 6px;color:var(--mut);font-size:.9em}
      .ok{color:#3fb950}.no{color:#f85149}
    </style>
    <div class='p'>
      <div class='h'>
        <input class='q' placeholder='Search tools...'>
        <span class='ttl' hidden>Settings</span>
        <span class='ic gear' title='Settings'>\u2699\uFE0E</span>
        <span class='ic x' title='Close'>\u2715</span>
      </div>
      <div class='note' hidden></div>
      <div class='l'><div class='m'>Loading...</div></div>
      <div class='s' hidden></div>
    </div>`;
  document.body.appendChild(host);

  const $ = s => root.querySelector(s);
  const P = $('.p'), q = $('input.q'), ttl = $('.ttl'), note = $('.note'), lPane = $('.l'), sPane = $('.s');
  let tools = [], shown = [], sel = 0, view = 'list', updStatus = null;
  const close = () => host.remove();

  const applyLook = () => {
    const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    P.dataset.t = dark ? 'd' : 'l';
    const z = SIZES[S.size] || SIZES.m;
    P.style.width = z.w + 'px';
    P.style.fontSize = z.f + 'px';
    if (view === 'list') render();
  };

  // ---- Tool list ----
  const rank = () => {
    const site = location.hostname;
    const here = t => S.siteFirst && (t.sites || []).some(s => site.endsWith(s));
    const idx = new Map(tools.map((t, i) => [t.file, i]));
    const rec = f => { const i = S.recent.indexOf(f); return i < 0 ? 99 : i; };
    return [...tools].sort((a, b) =>
      (S.favs.includes(b.file) - S.favs.includes(a.file)) ||
      (here(b) - here(a)) ||
      (S.sort === 'az' ? a.name.localeCompare(b.name)
        : S.sort === 'recent' ? (rec(a.file) - rec(b.file) || idx.get(a.file) - idx.get(b.file))
        : idx.get(a.file) - idx.get(b.file)));
  };

  function render() {
    const qs = q.value.toLowerCase();
    shown = rank().filter(t => (t.name + ' ' + (t.desc || '') + ' ' + (t.tags || '')).toLowerCase().includes(qs));
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    lPane.textContent = '';
    if (!shown.length) { lPane.append(el('div', { className: 'm', textContent: tools.length ? 'No matches' : 'No tools yet' })); return; }
    shown.forEach((t, i) => {
      const fav = S.favs.includes(t.file);
      const txt = el('div', { className: 't' }, el('b', { textContent: t.name }));
      if (S.desc && t.desc) txt.append(el('small', { textContent: t.desc }));
      const star = el('span', { className: 'st' + (fav ? ' on' : ''), title: fav ? 'Unpin' : 'Pin to top', textContent: fav ? '\u2605' : '\u2606' });
      star.onclick = e => {
        e.stopPropagation();
        S.favs = fav ? S.favs.filter(f => f !== t.file) : [...S.favs, t.file];
        save(); render();
      };
      const row = el('div', { className: 'i' + (i === sel ? ' sel' : '') }, txt, star);
      row.onclick = () => run(t);
      lPane.append(row);
    });
  }

  function run(t) {
    S.recent = [t.file, ...S.recent.filter(f => f !== t.file)].slice(0, 8);
    save();
    if (S.closeOnRun) close();
    const s = el('script', { src: bust(base() + 'tools/' + t.file) });
    s.onerror = () => alert('Could not load ' + t.file + '. Check the filename, or the site may block external scripts.');
    document.head.appendChild(s);
  }

  async function loadTools() {
    const r = await fetch(bust(base() + 'tools.json'), { cache: 'no-store' });
    if (!r.ok) throw new Error('tools.json returned ' + r.status);
    tools = await r.json();
  }

  // ---- Update: only runs when you press the button ----
  async function update() {
    const say = t => { if (updStatus) updStatus.textContent = t; };
    say('Checking GitHub...');
    try {
      const r = await fetch('https://api.github.com/repos/' + USER + '/' + REPO + '/commits/main', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status === 403 ? 'GitHub rate limit reached, try again later' : 'GitHub returned ' + r.status);
      const j = await r.json();
      const sha = j.sha, msg = ((j.commit && j.commit.message) || '').split('\n')[0];
      // Ask the CDN to drop its cached copy of the main branch, so future opens are fresh too
      ['hub.js', 'tools.json', ...tools.map(t => 'tools/' + t.file)].forEach(f =>
        fetch('https://purge.jsdelivr.net/gh/' + USER + '/' + REPO + '@main/' + f, { mode: 'no-cors' }).catch(() => {}));
      if (sha !== VER) {
        // Reload the whole hub from this exact commit (replaces this window)
        window.__hub_notice = 'Updated to ' + sha.slice(0, 7) + (msg ? ': ' + msg : '');
        document.head.appendChild(el('script', { src: bust(base(sha) + 'hub.js') }));
      } else {
        await loadTools();
        say('Already on the latest version (' + sha.slice(0, 7) + '). Tool list refreshed.');
      }
    } catch (e) {
      say('Update failed: ' + e.message);
    }
  }

  // ---- Settings pane ----
  function renderSettings() {
    sPane.textContent = '';
    const sec = t => sPane.append(el('div', { className: 'sec', textContent: t }));
    const row = (label, ctl) => sPane.append(el('label', { className: 'row' }, el('span', { textContent: label }), ctl));
    const select = (key, opts) => {
      const s = el('select');
      opts.forEach(([l, v]) => s.add(new Option(l, v)));
      s.value = S[key];
      s.onchange = () => { S[key] = s.value; save(); applyLook(); };
      return s;
    };
    const check = key => {
      const c = el('input', { type: 'checkbox', checked: !!S[key] });
      c.onchange = () => { S[key] = c.checked; save(); applyLook(); };
      return c;
    };
    const info = t => sPane.append(el('div', { className: 'info', textContent: t }));

    sPane.append(el('button', { className: 'back', textContent: '\u2190 Back to tools', onclick: () => setView('list') }));

    sec('Updates');
    sPane.append(el('button', { className: 'pri', textContent: 'Update now', onclick: update }));
    updStatus = el('div', { className: 'info', textContent: 'Fetches the newest version from GitHub. Nothing is checked until you press this.' });
    sPane.append(updStatus);
    info('Loaded version: ' + (VER === 'main' ? 'main (branch, may be cached)' : VER.slice(0, 7)));
    info('Tools loaded: ' + tools.length);

    sec('Display');
    row('Theme', select('theme', [['Dark', 'dark'], ['Light', 'light'], ['Match system', 'auto']]));
    row('Size', select('size', [['Small', 's'], ['Medium', 'm'], ['Large', 'l']]));
    row('Show descriptions', check('desc'));

    sec('Behavior');
    row('Sort tools', select('sort', [['Menu order', 'order'], ['A to Z', 'az'], ['Recently used', 'recent']]));
    row('Site matches first', check('siteFirst'));
    row('Close hub after running a tool', check('closeOnRun'));

    sec('Repo shortcuts');
    const link = (t, href) => sPane.append(el('a', { className: 'lnk', textContent: t, href, target: '_blank', rel: 'noopener' }));
    link('Open repo on GitHub', 'https://github.com/' + USER + '/' + REPO);
    link('Edit tools.json (menu)', 'https://github.com/' + USER + '/' + REPO + '/edit/main/tools.json');
    link('Add a tool file', 'https://github.com/' + USER + '/' + REPO + '/new/main/tools');

    sec('Keys (set in your loader bookmark)');
    row('Gemini key (__K)', el('span', { className: window.__K ? 'ok' : 'no', textContent: window.__K ? 'set' : 'not set' }));
    row('OpenRouter key (__OR)', el('span', { className: window.__OR ? 'ok' : 'no', textContent: window.__OR ? 'set' : 'not set' }));

    sec('Data');
    sPane.append(
      el('button', { textContent: 'Clear pins and recents', onclick: () => { S.favs = []; S.recent = []; save(); renderSettings(); } }),
      el('button', { textContent: 'Reset all settings', onclick: () => { Object.assign(S, JSON.parse(JSON.stringify(DEF))); save(); applyLook(); renderSettings(); } })
    );
    info('Settings are saved per website (in that site\'s browser storage), so each site keeps its own.');
  }

  function setView(v) {
    view = v;
    const set = v === 'set';
    lPane.hidden = set; sPane.hidden = !set;
    q.hidden = set; ttl.hidden = !set;
    if (set) renderSettings(); else { render(); q.focus(); }
  }

  // ---- Wiring ----
  $('.x').onclick = close;
  $('.gear').onclick = () => setView(view === 'set' ? 'list' : 'set');
  q.addEventListener('input', () => { sel = 0; render(); });
  P.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { view === 'set' ? setView('list') : close(); return; }
    if (view !== 'list') return;
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && shown[sel] && e.target === q) run(shown[sel]);
  });

  if (window.__hub_notice) { note.textContent = window.__hub_notice; note.hidden = false; delete window.__hub_notice; }
  applyLook();
  loadTools()
    .then(() => { render(); q.focus(); })
    .catch(e => { lPane.textContent = 'Could not load tools.json: ' + e.message; });
})();
