(() => {
  // ---- Where am I loaded from? (the loader bookmark decides; nothing is hard-coded here) ----
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const M = /\/gh\/([^/]+)\/([^@/]+)@([^/]+)\//.exec(SRC);
  if (!M) { alert('Hub: could not read the repo from the script address.'); return; }
  const USER = M[1], REPO = M[2], VER = M[3];
  const CDN = SRC.slice(0, SRC.indexOf('/gh/')) || 'https://cdn.jsdelivr.net';
  const base = (v = VER) => CDN + '/gh/' + USER + '/' + REPO + '@' + v + '/';
  const bust = u => u + (u.includes('?') ? '&' : '?') + '_=' + Date.now();
  const ID = '__hub_root';
  document.getElementById(ID)?.remove();

  // ---- Settings (saved in this site's localStorage, so they are per-site) ----
  const SK = '__hub_settings_v1';
  const DEF = { theme: 'dark', size: 'm', sort: 'order', siteFirst: true, desc: true, closeOnRun: true, copyKeys: true, favs: [], recent: [] };
  const SIZES = { s: { w: 280, f: 13 }, m: { w: 320, f: 14 }, l: { w: 380, f: 16 } };
  const S = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(SK) || '{}') }; } catch { return { ...DEF }; } })();
  const save = () => { try { localStorage.setItem(SK, JSON.stringify(S)); } catch {} };

  // ---- OneLine: turns code into a single line that is safe to paste into an address bar or a bookmark ----
  const oneLine = src => {
    src = String(src).replace(/^\uFEFF/, '');
    const n = src.length;
    const isWord = ch => /[A-Za-z0-9_$]/.test(ch) || (ch > '\x7f' && !/[\u00A0\u2028\u2029\uFEFF]/.test(ch));
    const KW = /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
    const STMT = /^(const|let|var|function|class|if|for|return|try|switch|throw|break|continue|do|async|import|export)$/;
    const DECL = /^(const|let|var|function|class)$/;
    const NOSEMI = /^(else|do|return|typeof|void|delete|new|throw|case|default|in|of|instanceof|await|yield|extends|async)$/;
    let i = 0;

    const template = out => {                    // i is just after the opening backtick
      out.push('`');
      while (i < n) {
        const c = src[i];
        if (c === '\\') {
          if (src[i + 1] === '\n') { i += 2; continue; }
          if (src[i + 1] === '\r') { i += src[i + 2] === '\n' ? 3 : 2; continue; }
          out.push(c, src[i + 1] === undefined ? '' : src[i + 1]); i += 2; continue;
        }
        if (c === '`') { out.push('`'); i++; return; }
        if (c === '$' && src[i + 1] === '{') { out.push('${'); i += 2; const inner = []; code(inner, true); out.push(inner.join(''), '}'); continue; }
        if (c === '\r') { if (src[i + 1] === '\n') i++; out.push('\\n'); i++; continue; }
        if (c === '\n') { out.push('\\n'); i++; continue; }
        out.push(c); i++;
      }
    };

    const code = (out, inTpl) => {
      let depth = 0, lastCh = '', lastWord = '', sp = false, nl = false;
      const put = (s, word) => {
        if (sp || nl) {
          let sep = '';
          if (nl && word && lastCh && STMT.test(s) && !NOSEMI.test(lastWord)) {
            const endsExpr = lastCh === '}' || lastCh === ']' || isWord(lastCh) || lastCh === "'" || lastCh === '"' || lastCh === '`';
            if (endsExpr || (lastCh === ')' && DECL.test(s))) sep = ';';   // never after ")" for if/for/while bodies
          }
          if (!sep && nl && word && s === 'else' && lastCh && lastCh !== '}' && lastCh !== ';' && !'({[,'.includes(lastCh)) sep = ';';   // "if (x) a()" newline "else" relied on automatic semicolons
          if (!sep && lastCh && !'({[;,'.includes(lastCh) && !')}];,'.includes(s[0])) sep = ' ';
          out.push(sep + s);
        } else out.push(s);
        lastCh = s[s.length - 1]; lastWord = word ? s : ''; sp = nl = false;
      };
      while (i < n) {
        const c = src[i];
        if (c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === '\u00A0' || c === '\uFEFF') { sp = true; i++; continue; }
        if (c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029') { sp = nl = true; i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; sp = true; continue; }
        if (c === '/' && src[i + 1] === '*') {
          const e = src.indexOf('*/', i + 2), body = src.slice(i, e < 0 ? n : e + 2);
          i = e < 0 ? n : e + 2; sp = true; if (/[\n\r]/.test(body)) nl = true; continue;
        }
        if (c === "'" || c === '"') {
          let j = i + 1, str = c;
          while (j < n && src[j] !== c) {
            if (src[j] === '\\') {
              if (src[j + 1] === '\n') { j += 2; continue; }
              if (src[j + 1] === '\r') { j += src[j + 2] === '\n' ? 3 : 2; continue; }
              str += src[j] + (src[j + 1] === undefined ? '' : src[j + 1]); j += 2;
            } else { str += src[j]; j++; }
          }
          i = j + 1; put(str + c, false); continue;
        }
        if (c === '`') { const t = []; i++; template(t); put(t.join(''), false); continue; }
        if (c === '/' && (!lastCh || '(,=:[!&|?{};+-*%<>~^'.includes(lastCh) || (lastWord && KW.test(lastWord)))) {
          let j = i + 1, inCls = false;                       // regular expression literal
          while (j < n) {
            const d = src[j];
            if (d === '\\') { j += 2; continue; }
            if (d === '[') inCls = true; else if (d === ']') inCls = false;
            else if (d === '/' && !inCls) break; else if (d === '\n') break;
            j++;
          }
          j++; while (j < n && /[A-Za-z]/.test(src[j])) j++;
          put(src.slice(i, j), false); i = j; continue;
        }
        if (c === '{') depth++;
        else if (c === '}') { if (inTpl && depth === 0) { i++; return; } depth--; }
        if (isWord(c)) { let j = i; while (j < n && isWord(src[j])) j++; put(src.slice(i, j), true); i = j; continue; }
        put(c, false); i++;
      }
    };
    const out = []; code(out, false);
    return out.join('').trim();
  };
  // Address bars and bookmarks decode %xx sequences in javascript: addresses, so protect the characters that matter
  const toAddress = code => 'javascript:' + code.replace(/%/g, '%25').replace(/#/g, '%23');
  // ---- /OneLine ----

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
      .note.err{background:#3d1f1f;color:#ffb4ab}
      .more{font-weight:700;padding:2px 7px;border-radius:6px}
      .more:hover,.more.on{background:var(--hv);color:var(--fg)}
      .sub{margin:2px 10px 8px;padding:6px;border-radius:8px;background:var(--in);border:1px solid var(--bd)}
      .sub .mi{display:block;width:100%;text-align:left;background:none;color:var(--fg);border:0;border-radius:6px;padding:8px;margin:0;cursor:pointer;font:inherit}
      .sub .mi:hover{background:var(--hv)}
      .sub .hint{padding:4px 8px 2px;color:var(--mut);font-size:.82em;line-height:1.35}
      .sub textarea{width:100%;height:70px;margin-top:6px;background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-radius:6px;font:11px monospace}
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
  let tools = [], shown = [], sel = 0, view = 'list', updStatus = null, menuFor = '', manual = null, noteT = 0;
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
    const keepTop = lPane.scrollTop;
    lPane.textContent = '';
    if (!shown.length) { lPane.append(el('div', { className: 'm', textContent: tools.length ? 'No matches' : 'No tools yet' })); return; }
    let subEl = null;
    shown.forEach((t, i) => {
      const fav = S.favs.includes(t.file);
      const txt = el('div', { className: 't' }, el('b', { textContent: t.name }));
      if (S.desc && t.desc) txt.append(el('small', { textContent: t.desc }));
      const star = el('span', { className: 'st' + (fav ? ' on' : ''), title: fav ? 'Unpin' : 'Pin to top', textContent: fav ? '\u2605' : '\u2606' });
      star.onclick = e => {
        e.stopPropagation();
        S.favs = fav ? S.favs.filter(f => f !== t.file) : [...S.favs, t.file];
        save(); render(); q.focus();
      };
      const open = menuFor === t.file;
      const more = el('span', { className: 'st more' + (open ? ' on' : ''), title: 'More ways to launch', textContent: '\u22EE' });
      more.onclick = e => { e.stopPropagation(); menuFor = open ? '' : t.file; manual = null; render(); q.focus(); };
      const row = el('div', { className: 'i' + (i === sel ? ' sel' : '') }, txt, star, more);
      row.onclick = () => run(t);
      lPane.append(row);
      if (open) {
        const item = (label, fn) => el('button', { className: 'mi', textContent: label, onclick: e => { e.stopPropagation(); fn(t); } });
        const sub = el('div', { className: 'sub' },
          item('Open in a new tab', runNewTab),
          item('Copy code to run in another tab', copyCode),
          el('div', { className: 'hint', textContent: 'A bookmarklet cannot reach into another tab. To use a tool on a page where the hub is blocked (like Google Docs): copy the code, go to that tab, click the address bar, type javascript: and paste, then press Enter. No console needed.' }));
        if (manual && manual.file === t.file) {
          const ta = el('textarea', { value: manual.code, readOnly: true });
          ta.onfocus = () => ta.select();
          sub.append(ta);
        }
        lPane.append(sub); subEl = sub;
      }
    });
    lPane.scrollTop = keepTop;
    if (subEl) {   // make sure the open menu is fully visible
      const r = subEl.getBoundingClientRect(), pr = lPane.getBoundingClientRect();
      if (r.bottom > pr.bottom) lPane.scrollTop += r.bottom - pr.bottom + 8;
    }
  }

  const CFG = ['__K', '__OR', '__CHAT_DB', '__CHAT_ROOM', '__CHAT_NAME'];
  const flash = (msg, ms = 10000, isErr = false) => {
    note.textContent = msg; note.className = 'note' + (isErr ? ' err' : ''); note.hidden = false;
    clearTimeout(noteT); noteT = setTimeout(() => { note.hidden = true; }, ms);
  };
  async function getToolCode(t) {
    const r = await fetch(bust(base() + 'tools/' + t.file), { cache: 'no-store' });
    if (!r.ok) throw new Error(t.file + ' returned ' + r.status);
    const code = await r.text();
    const pre = S.copyKeys ? CFG.filter(k => window[k] != null && window[k] !== '').map(k => 'window.' + k + '=' + JSON.stringify(window[k]) + ';').join('') : '';
    return toAddress(pre + oneLine(code));
  }
  async function copyCode(t) {
    flash('Getting the code...', 4000);
    try {
      const p = getToolCode(t);
      let ok = false;
      try {   // deferred clipboard write keeps the click's permission even though we fetch first
        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'text/plain': p.then(x => new Blob([x], { type: 'text/plain' })) })]);
          ok = true;
        }
      } catch {}
      const code = await p;
      if (!ok) { try { await navigator.clipboard.writeText(code); ok = true; } catch {} }
      if (!ok) {
        try { const ta = document.createElement('textarea'); ta.value = code; ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
          document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch {}
      }
      if (ok) flash('Copied "' + t.name + '" (' + Math.max(1, Math.round(code.length / 1024)) + ' KB). Go to the other tab, click the address bar, type javascript: then paste (Ctrl+V) and press Enter. You can also paste it as the address of a new bookmark.', 14000);
      else { manual = { file: t.file, code }; flash('Could not copy automatically. Select the box below and copy it, then use it in the other tab\'s address bar.', 12000, true); render(); }
    } catch (e) { flash('Could not get the code: ' + e.message, 8000, true); }
  }
  function runNewTab(t) {
    const w = window.open('', '_blank');   // must happen directly inside the click
    if (!w) { flash('The browser blocked the new tab. Allow pop-ups for this site and try again.', 9000, true); return; }
    try {
      const d = w.document;
      d.title = t.name;
      if (d.body) d.body.style.cssText = 'margin:0;background:#1b1d23;color:#ddd;font:14px system-ui,sans-serif';
      for (const k of CFG) if (window[k] != null && S.copyKeys) w[k] = window[k];
      const url = bust(base() + 'tools/' + t.file);
      const inject = (props) => { const s = d.createElement('script'); Object.assign(s, props); d.head.appendChild(s); return s; };
      // Fetch the code here and run it inline in the new tab (a fresh blank tab can be slow to load scripts by address);
      // if fetching fails, fall back to a normal script tag.
      fetch(url, { cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
        .then(code => inject({ textContent: code }))
        .catch(() => { const s = inject({ src: url }); s.onerror = () => { try { w.alert('Could not load ' + t.file); } catch {} }; });
      flash('Opened "' + t.name + '" in a new tab. Tools that read the page will see a blank page there.', 7000);
    } catch (e) { flash('Could not start it in the new tab: ' + e.message, 8000, true); }
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
    row('Include my keys when copying code', check('copyKeys'));

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
  q.addEventListener('input', () => { sel = 0; menuFor = ''; manual = null; render(); });
  P.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { if (view === 'set') setView('list'); else if (menuFor) { menuFor = ''; manual = null; render(); } else close(); return; }
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
