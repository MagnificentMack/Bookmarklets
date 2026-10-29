(() => {
  const SRC = document.currentScript.src;
  const BASE = SRC.slice(0, SRC.lastIndexOf('/') + 1);
  const ID = '__hub_root';
  document.getElementById(ID)?.remove();

  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial;position:fixed;top:12px;right:12px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .p{width:320px;max-height:75vh;display:flex;flex-direction:column;background:#111;color:#eee;
         font:14px system-ui,sans-serif;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.55);overflow:hidden}
      .h{display:flex;gap:8px;padding:10px;border-bottom:1px solid #2a2a2a}
      input{flex:1;background:#1c1c1c;color:#eee;border:1px solid #333;border-radius:8px;padding:8px;font:inherit;outline:none}
      .x{cursor:pointer;color:#999;padding:6px}
      .l{overflow:auto;padding:6px}
      .i{padding:8px 10px;border-radius:8px;cursor:pointer}
      .i.sel,.i:hover{background:#2b2b2b}
      .i small{display:block;color:#999;margin-top:2px}
      .m{padding:12px;color:#999}
    </style>
    <div class='p'>
      <div class='h'><input placeholder='Search tools...'><span class='x'>\u2715</span></div>
      <div class='l'><div class='m'>Loading...</div></div>
    </div>`;
  document.body.appendChild(host);

  const $ = s => root.querySelector(s);
  const input = $('input'), list = $('.l');
  let tools = [], shown = [], sel = 0;
  const close = () => host.remove();
  $('.x').onclick = close;

  function render() {
    const q = input.value.toLowerCase();
    shown = tools.filter(t => (t.name + ' ' + (t.desc || '') + ' ' + (t.tags || '')).toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    list.innerHTML = '';
    if (!shown.length) { list.innerHTML = `<div class='m'>No matches</div>`; return; }
    shown.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'i' + (i === sel ? ' sel' : '');
      el.innerHTML = '<b></b><small></small>';
      el.firstChild.textContent = t.name;
      el.lastChild.textContent = t.desc || '';
      el.onclick = () => run(t);
      list.appendChild(el);
    });
  }

  function run(t) {
    close();
    const s = document.createElement('script');
    s.src = BASE + 'tools/' + t.file;
    s.onerror = () => alert('Could not load ' + t.file + '. Check the filename, or the site may block external scripts.');
    document.head.appendChild(s);
  }

  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && shown[sel]) run(shown[sel]);
  });

  fetch(BASE + 'tools.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(data => {
      const site = location.hostname;
      const here = t => (t.sites || []).some(s => site.endsWith(s));
      tools = data.sort((a, b) => here(b) - here(a));
      render();
      input.focus();
    })
    .catch(e => { list.textContent = 'Could not load tools.json: ' + e.message; });
})();
