(() => {
  const ID = '__ttt_tool';
  const old = document.getElementById(ID);
  if (old) { old.remove(); return; }

  // ---- Logic ----
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = b => {
    for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { p: b[l[0]], line: l };
    return null;
  };
  const free = b => b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  const minimax = (b, turn, bot, depth) => {
    const w = winner(b);
    if (w) return w.p === bot ? 10 - depth : depth - 10;
    const f = free(b);
    if (!f.length) return 0;
    let best = turn === bot ? -Infinity : Infinity;
    for (const i of f) {
      b[i] = turn;
      const v = minimax(b, turn === 'X' ? 'O' : 'X', bot, depth + 1);
      b[i] = '';
      best = turn === bot ? Math.max(best, v) : Math.min(best, v);
    }
    return best;
  };
  const rand = a => a[Math.floor(Math.random() * a.length)];
  const hard = (b, bot) => {
    let top = -Infinity, picks = [];
    for (const i of free(b)) {
      b[i] = bot;
      const v = minimax(b, bot === 'X' ? 'O' : 'X', bot, 1);
      b[i] = '';
      if (v > top) { top = v; picks = [i]; } else if (v === top) picks.push(i);
    }
    return rand(picks);
  };
  const easy = (b, bot) => {
    const opp = bot === 'X' ? 'O' : 'X';
    for (const who of [bot, opp]) {
      for (const i of free(b)) {
        b[i] = who;
        const w = winner(b);
        b[i] = '';
        if (w) return i;
      }
    }
    return rand(free(b));
  };

  // ---- UI ----
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial;position:fixed;top:20px;right:20px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .box{width:290px;box-sizing:border-box;background:#262522;color:#fff;border:1px solid #3d3b38;border-radius:10px;
        box-shadow:0 8px 30px rgba(0,0,0,.6);font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        padding:12px;user-select:none}
      .hd{display:flex;justify-content:space-between;align-items:center;cursor:move;padding-bottom:8px;margin-bottom:10px;
        border-bottom:1px solid #3d3b38;font-weight:700;color:#f0d9b5}
      .x{cursor:pointer;color:#aaa;padding:2px 6px}
      .g{display:grid;grid-template-columns:repeat(3,84px);grid-template-rows:repeat(3,84px);gap:6px;justify-content:center}
      .c{background:#3d3b38;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;
        font-weight:700;cursor:pointer;line-height:1}
      .c:hover{background:#4a4845}
      .X{color:#6cb6ff}.O{color:#ff8f6b}
      .win{background:#3a5a2c}
      .st{margin:10px 0 4px;min-height:20px;text-align:center;font-weight:600;color:#bababa}
      .sc{text-align:center;color:#9a9892;font-size:13px;margin-bottom:8px}
      .ct{display:flex;gap:6px}
      button,select{flex:1;background:#3d3b38;color:#fff;border:0;border-radius:6px;padding:7px 4px;font:inherit;cursor:pointer}
      button:hover,select:hover{background:#4a4845}
    </style>
    <div class='box'>
      <div class='hd'><span>Tic-tac-toe</span><span class='x'>\u2715</span></div>
      <div class='g'></div>
      <div class='st'></div>
      <div class='sc'></div>
      <div class='ct'><button class='nr'>New round</button><button class='rs'>Reset score</button><select class='md'></select></div>
    </div>`;
  document.body.appendChild(host);

  const $ = q => root.querySelector(q);
  const grid = $('.g'), stat = $('.st'), score = $('.sc'), modeSel = $('.md'), hd = $('.hd');
  [['Unbeatable bot', 'hard'], ['Easy bot', 'easy'], ['2 players', '2p']].forEach(([n, v]) => modeSel.add(new Option(n, v)));

  let b, turn, starter = 'X', over, line = [], busy = false, token = 0;
  const tally = { X: 0, O: 0, D: 0 };
  const mode = () => modeSel.value;
  const names = () => (mode() === '2p' ? { X: 'X', O: 'O' } : { X: 'You', O: 'Bot' });

  const render = () => {
    grid.textContent = '';
    b.forEach((v, i) => {
      const el = document.createElement('div');
      el.className = 'c' + (v ? ' ' + v : '') + (line.includes(i) ? ' win' : '');
      el.textContent = v;
      el.onclick = () => click(i);
      grid.appendChild(el);
    });
    const n = names();
    score.textContent = n.X + ' ' + tally.X + '  |  ' + n.O + ' ' + tally.O + '  |  Draws ' + tally.D;
  };

  const say = (t, col) => { stat.textContent = t; stat.style.color = col || '#bababa'; };

  const finish = () => {
    const w = winner(b), n = names();
    if (w) {
      over = true; line = w.line; tally[w.p]++;
      say(mode() === '2p' ? w.p + ' wins!' : (w.p === 'X' ? 'You win!' : 'Bot wins.'), w.p === 'X' || mode() === '2p' ? '#51cf66' : '#ff6b6b');
    } else if (!free(b).length) {
      over = true; tally.D++; say('Draw.');
    } else {
      say(mode() === '2p' ? turn + "'s turn" : (turn === 'X' ? 'Your turn (X)' : 'Bot is thinking...'));
    }
    render();
  };

  const botTurn = () => {
    if (over || mode() === '2p' || turn !== 'O') return;
    busy = true;
    const my = token;
    setTimeout(() => {
      if (my !== token) return;
      busy = false;
      const i = (mode() === 'hard' ? hard : easy)(b.slice(), 'O');
      b[i] = 'O'; turn = 'X';
      finish();
    }, 250);
  };

  const click = i => {
    if (over || busy || b[i]) return;
    b[i] = turn;
    turn = turn === 'X' ? 'O' : 'X';
    finish();
    botTurn();
  };

  const round = () => {
    token++; busy = false;
    b = Array(9).fill(''); line = []; over = false; turn = starter;
    starter = starter === 'X' ? 'O' : 'X';
    finish();
    botTurn();
  };

  $('.nr').onclick = round;
  $('.rs').onclick = () => { tally.X = tally.O = tally.D = 0; starter = 'X'; round(); };
  modeSel.onchange = () => { tally.X = tally.O = tally.D = 0; starter = 'X'; round(); };
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

  round();
})();
