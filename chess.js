(() => {
  const ID = '__chess_tool';
  const old = document.getElementById(ID);
  if (old) { old.remove(); return; }

  // ---- Engine ----
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const isW = p => p === p.toUpperCase();
  const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]], ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

  const start = () => ({
    b: [...'rnbqkbnr', ...'pppppppp', ...Array(32).fill(''), ...'PPPPPPPP', ...'RNBQKBNR'],
    w: true, c: { K: 1, Q: 1, k: 1, q: 1 }, ep: -1,
  });

  const attacked = (b, sq, byW) => {
    const r = sq >> 3, c = sq & 7;
    const at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : '');
    const pr = byW ? r + 1 : r - 1;
    if (at(pr, c - 1) === (byW ? 'P' : 'p') || at(pr, c + 1) === (byW ? 'P' : 'p')) return true;
    for (const [dr, dc] of KN) if (at(r + dr, c + dc) === (byW ? 'N' : 'n')) return true;
    for (const [dr, dc] of KG) if (at(r + dr, c + dc) === (byW ? 'K' : 'k')) return true;
    for (const [dirs, A] of [[DIAG, 'b'], [ORTH, 'r']]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = b[rr * 8 + cc];
          if (p) {
            const l = p.toLowerCase();
            if (isW(p) === byW && (l === A || l === 'q')) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  };

  const gen = s => {
    const { b, w, c, ep } = s, out = [];
    const add = (f, t, x) => out.push({ f, t, ...x });
    for (let f = 0; f < 64; f++) {
      const p = b[f];
      if (!p || isW(p) !== w) continue;
      const r = f >> 3, col = f & 7, l = p.toLowerCase();
      if (l === 'p') {
        const d = w ? -1 : 1, sr = w ? 6 : 1, pr = w ? 0 : 7;
        const push = t => add(f, t, (t >> 3) === pr ? { promo: true } : {});
        const t1 = f + d * 8;
        if (!b[t1]) {
          push(t1);
          if (r === sr && !b[t1 + d * 8]) add(f, t1 + d * 8, { dbl: true });
        }
        for (const dc of [-1, 1]) {
          const cc = col + dc;
          if (cc < 0 || cc > 7) continue;
          const t = (r + d) * 8 + cc;
          if (b[t] && isW(b[t]) !== w) push(t);
          else if (t === ep) add(f, t, { ep: true });
        }
      } else if (l === 'n' || l === 'k') {
        for (const [dr, dc] of (l === 'n' ? KN : KG)) {
          const rr = r + dr, cc = col + dc;
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          const t = rr * 8 + cc;
          if (!b[t] || isW(b[t]) !== w) add(f, t);
        }
        if (l === 'k' && f === (w ? 60 : 4) && !attacked(b, f, !w)) {
          const h = w ? 56 : 0, R = w ? 'R' : 'r';
          if (c[w ? 'K' : 'k'] && b[h + 7] === R && !b[h + 5] && !b[h + 6] &&
              !attacked(b, h + 5, !w) && !attacked(b, h + 6, !w)) add(f, h + 6, { castle: 'K' });
          if (c[w ? 'Q' : 'q'] && b[h] === R && !b[h + 1] && !b[h + 2] && !b[h + 3] &&
              !attacked(b, h + 3, !w) && !attacked(b, h + 2, !w)) add(f, h + 2, { castle: 'Q' });
        }
      } else {
        const dirs = l === 'b' ? DIAG : l === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = col + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const t = rr * 8 + cc;
            if (!b[t]) add(f, t);
            else { if (isW(b[t]) !== w) add(f, t); break; }
            rr += dr; cc += dc;
          }
        }
      }
    }
    return out;
  };

  const make = (s, m) => {
    const b = s.b.slice(), p = b[m.f], w = s.w, c = { ...s.c };
    b[m.t] = m.promo ? (w ? 'Q' : 'q') : p;
    b[m.f] = '';
    if (m.ep) b[(m.f >> 3) * 8 + (m.t & 7)] = '';
    if (m.castle) {
      const h = w ? 56 : 0;
      if (m.castle === 'K') { b[h + 5] = b[h + 7]; b[h + 7] = ''; }
      else { b[h + 3] = b[h]; b[h] = ''; }
    }
    if (p === 'K') { c.K = 0; c.Q = 0; }
    if (p === 'k') { c.k = 0; c.q = 0; }
    for (const sq of [m.f, m.t]) {
      if (sq === 56) c.Q = 0;
      if (sq === 63) c.K = 0;
      if (sq === 0) c.q = 0;
      if (sq === 7) c.k = 0;
    }
    return { b, w: !w, c, ep: m.dbl ? (m.f + m.t) / 2 : -1 };
  };

  const inCheck = s => attacked(s.b, s.b.indexOf(s.w ? 'K' : 'k'), !s.w);
  const legal = s => gen(s).filter(m => {
    const n = make(s, m);
    return !attacked(n.b, n.b.indexOf(s.w ? 'K' : 'k'), !s.w);
  });
  const dead = b => {
    const x = b.filter(p => p && p.toLowerCase() !== 'k').map(p => p.toLowerCase());
    return x.length === 0 || (x.length === 1 && (x[0] === 'n' || x[0] === 'b'));
  };

  const evalS = s => {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p) continue;
      const l = p.toLowerCase(), r = i >> 3, c = i & 7, w = isW(p);
      const cen = (3.5 - Math.abs(3.5 - r)) + (3.5 - Math.abs(3.5 - c));
      let x = VAL[l];
      if (l === 'n' || l === 'b') x += cen * 5;
      else if (l === 'p') x += (w ? 6 - r : r - 1) * 6 + cen * 2;
      else if (l === 'q') x += cen;
      v += w ? x : -x;
    }
    return v;
  };

  const order = (s, ms) => ms
    .map(m => [m, (s.b[m.t] ? VAL[s.b[m.t].toLowerCase()] * 10 - VAL[s.b[m.f].toLowerCase()] : 0) + (m.promo ? 800 : 0)])
    .sort((a, b) => b[1] - a[1]).map(x => x[0]);

  const search = (s, d, a, bt, ply) => {
    if (d <= 0 && ply > 1) return (s.w ? 1 : -1) * evalS(s);
    const ms = legal(s);
    if (!ms.length) return inCheck(s) ? -100000 + ply : 0;
    if (d <= 0) return (s.w ? 1 : -1) * evalS(s);
    let best = -Infinity;
    for (const m of order(s, ms)) {
      const v = -search(make(s, m), d - 1, -bt, -a, ply + 1);
      if (v > best) best = v;
      if (best > a) a = best;
      if (a >= bt) break;
    }
    return best;
  };

  const pick = (s, L) => {
    let best = null, bv = -Infinity;
    for (const m of order(s, legal(s))) {
      const v = -search(make(s, m), L.d - 1, -Infinity, Infinity, 1) + Math.random() * L.n;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  };

  // ---- UI ----
  const LEVELS = [{ name: 'Easy', d: 1, n: 60 }, { name: 'Medium', d: 2, n: 8 }, { name: 'Hard', d: 3, n: 0 }];
  const GLYPH = { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' };

  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial;position:fixed;top:20px;right:20px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .box{width:344px;box-sizing:border-box;background:#262522;color:#fff;border:1px solid #3d3b38;border-radius:10px;
        box-shadow:0 8px 30px rgba(0,0,0,.6);font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        padding:12px;user-select:none}
      .hd{display:flex;justify-content:space-between;align-items:center;cursor:move;padding-bottom:8px;margin-bottom:10px;
        border-bottom:1px solid #3d3b38;font-weight:700;color:#f0d9b5}
      .x{cursor:pointer;color:#aaa;padding:2px 6px}
      .g{display:grid;grid-template-columns:repeat(8,40px);grid-template-rows:repeat(8,40px);width:320px;
        border:2px solid #1a1917;border-radius:4px;overflow:hidden;box-sizing:content-box}
      .s{width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:29px;line-height:1;
        cursor:pointer;position:relative}
      .l{background:#f0d9b5}.d{background:#b58863}
      .lm{box-shadow:inset 0 0 0 40px rgba(246,246,105,.45)}
      .sel{box-shadow:inset 0 0 0 40px rgba(186,196,102,.85)}
      .chk{box-shadow:inset 0 0 0 40px rgba(255,70,70,.6)}
      .w{color:#fff;text-shadow:0 0 2px #000,0 0 2px #000,0 0 3px #000}
      .bl{color:#161616;text-shadow:0 0 1px rgba(255,255,255,.35)}
      .mv::after{content:'';position:absolute;width:12px;height:12px;border-radius:50%;background:rgba(0,0,0,.3)}
      .cap::after{width:32px;height:32px;background:none;border:3px solid rgba(0,0,0,.3);box-sizing:border-box}
      .st{margin-top:10px;min-height:20px;text-align:center;font-weight:600;color:#bababa}
      .ct{display:flex;gap:6px;margin-top:10px}
      button,select{flex:1;background:#3d3b38;color:#fff;border:0;border-radius:6px;padding:7px 4px;font:inherit;cursor:pointer}
      button:hover,select:hover{background:#4a4845}
    </style>
    <div class='box'>
      <div class='hd'><span>\u265F Chess (you are White)</span><span class='x'>\u2715</span></div>
      <div class='g'></div>
      <div class='st'></div>
      <div class='ct'><button class='nw'>New game</button><button class='un'>Undo</button><select class='lv'></select></div>
    </div>`;
  document.body.appendChild(host);

  const $ = q => root.querySelector(q);
  const grid = $('.g'), stat = $('.st'), lvSel = $('.lv'), hd = $('.hd');
  LEVELS.forEach((L, i) => lvSel.add(new Option(L.name, i)));
  lvSel.value = 1;

  let st, hist, last, sel, targets, busy, over, token = 0;

  const status = (t, col) => { stat.textContent = t; stat.style.color = col || '#bababa'; };

  const afterMove = () => {
    const ms = legal(st), chk = inCheck(st);
    if (!ms.length) {
      over = true;
      if (chk) st.w ? status('Checkmate. The bot wins.', '#ff6b6b') : status('Checkmate! You win!', '#51cf66');
      else status('Stalemate. Draw.');
    } else if (dead(st.b)) {
      over = true; status('Draw: not enough material.');
    } else if (st.w) {
      status(chk ? 'Check! Your move.' : 'Your move (White)', chk ? '#ff6b6b' : '#bababa');
    } else {
      status(chk ? 'Check! Bot is thinking...' : 'Bot is thinking...', chk ? '#ffa94d' : '#bababa');
    }
  };

  const render = () => {
    grid.textContent = '';
    const ks = inCheck(st) ? st.b.indexOf(st.w ? 'K' : 'k') : -1;
    for (let i = 0; i < 64; i++) {
      const el = document.createElement('div'), p = st.b[i];
      el.className = 's ' + (((i >> 3) + (i & 7)) % 2 ? 'd' : 'l');
      if (last && (i === last.f || i === last.t)) el.classList.add('lm');
      if (i === sel) el.classList.add('sel');
      if (i === ks) el.classList.add('chk');
      if (targets.some(m => m.t === i)) el.classList.add('mv', ...(p || targets.find(m => m.t === i).ep ? ['cap'] : []));
      if (p) { el.textContent = GLYPH[p.toLowerCase()] + '\uFE0E'; el.classList.add(isW(p) ? 'w' : 'bl'); }
      el.onclick = () => click(i);
      grid.appendChild(el);
    }
  };

  const play = m => {
    hist.push({ s: st, last });
    st = make(st, m); last = m; sel = null; targets = [];
    afterMove(); render();
    if (!over && !st.w) {
      busy = true;
      const my = token;
      setTimeout(() => {
        if (my !== token) return;
        const bm = pick(st, LEVELS[+lvSel.value]);
        busy = false;
        if (bm) play(bm);
      }, 60);
    }
  };

  const click = i => {
    if (busy || over || !st.w) return;
    const mv = targets.find(m => m.t === i);
    if (sel !== null && mv) { play(mv); return; }
    const p = st.b[i];
    if (p && isW(p)) { sel = i; targets = legal(st).filter(m => m.f === i); }
    else { sel = null; targets = []; }
    render();
  };

  const reset = () => {
    token++; st = start(); hist = []; last = null; sel = null; targets = []; busy = false; over = false;
    afterMove(); render();
  };

  $('.nw').onclick = reset;
  $('.un').onclick = () => {
    if (busy || !hist.length) return;
    do { const h = hist.pop(); st = h.s; last = h.last; } while (!st.w && hist.length);
    over = false; sel = null; targets = []; afterMove(); render();
  };
  $('.x').onclick = () => { token++; host.remove(); };

  let drag = false, dx = 0, dy = 0;
  hd.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('x')) return;
    drag = true;
    const r = host.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    hd.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  hd.addEventListener('pointermove', e => {
    if (!drag) return;
    host.style.left = (e.clientX - dx) + 'px'; host.style.top = (e.clientY - dy) + 'px'; host.style.right = 'auto';
  });
  hd.addEventListener('pointerup', () => { drag = false; });

  reset();
})();
