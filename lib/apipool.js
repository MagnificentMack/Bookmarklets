// apipool.js - shared by the AI tools. Keeps a pool of API keys (any provider), tries them in order,
// and moves on to the next one when a key runs out. Keys live in an ENCRYPTED vault in your database.
(() => {
  const VER = 1;
  if (window.APIPool && window.APIPool.v >= VER) return;

  // ---- Logic ----
  const ptDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const nextPtMidnight = () => {
    const now = Date.now();
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(now));
    const g = t => (+f.find(x => x.type === t).value) % 24 || 0;
    return now + (86400 - (g('hour') * 3600 + g('minute') * 60 + g('second'))) * 1000;
  };
  const nextUtcMidnight = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
  const parseRetry = msg => {                                   // "Please retry in 5h30m5.4s" -> seconds
    const m = /retry in\s+((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)/i.exec(String(msg || ''));
    if (!m || !m[1]) return 0;
    const h = /(\d+)h/.exec(m[1]), mi = /(\d+)m/.exec(m[1]), se = /([\d.]+)s/.exec(m[1]);
    return (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0) + (se ? +se[1] : 0);
  };
  const mk = m => String(m).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);           // model name -> database-safe key
  const PROVIDERS = {
    gemini:     { name: 'Google Gemini', models: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'], vision: true, limit: 20, hint: 'Starts with AIza or AQ.' },
    openrouter: { name: 'OpenRouter', models: ['openai/gpt-4o-mini'], vision: true, limit: 0, base: 'https://openrouter.ai/api/v1', hint: 'Starts with sk-or-' },
    openai:     { name: 'Other (OpenAI-compatible: Groq, OpenAI, Mistral, DeepSeek, ...)', models: [], vision: false, limit: 0, base: '', hint: 'Needs the service\'s base URL, e.g. https://api.groq.com/openai/v1' },
    anthropic:  { name: 'Anthropic Claude', models: [], vision: true, limit: 0, hint: 'Starts with sk-ant-' },
  };
  const maskKey = k => { k = String(k || ''); return k.length <= 10 ? '\u2022\u2022\u2022\u2022' : k.slice(0, 4) + '\u2026' + k.slice(-4); };
  const limitOf = e => (e.limit != null && e.limit !== '' ? +e.limit : ((PROVIDERS[e.provider] || {}).limit || 0));
  const hasVision = e => (e.vision != null ? !!e.vision : !!(PROVIDERS[e.provider] || {}).vision);
  const orderEntries = entries => entries.map((e, i) => ({ e, i })).sort((a, b) => ((a.e.prio != null ? a.e.prio : 100) - (b.e.prio != null ? b.e.prio : 100)) || a.i - b.i).map(x => x.e);
  const buildSlots = (entries, o = {}) => {
    const out = [];
    for (const e of orderEntries(entries)) {
      if (e.enabled === false || !e.key) continue;
      if (o.vision && !hasVision(e)) continue;
      const models = e.models && e.models.length ? e.models : ((PROVIDERS[e.provider] || {}).models || []);
      for (const model of models) out.push({ entry: e, model });
    }
    return out;
  };
  // What went wrong, and what to do about it. Never throws.
  const classify = (provider, status, body, retryAfter) => {
    let msg = '';
    if (body && typeof body === 'object') { const er = body.error; msg = typeof er === 'string' ? er : (er && (er.message || er.status)) || body.message || ''; }
    else if (typeof body === 'string') msg = body;
    msg = String(msg).slice(0, 300);
    const all = (msg + ' ' + (typeof body === 'object' ? JSON.stringify(body || '') : '')).toLowerCase();
    const sec = parseRetry(msg) || (+retryAfter || 0);
    const resetAt = () => (provider === 'gemini' ? nextPtMidnight() : nextUtcMidnight());
    if (status === 401 || (status === 400 && /api key not valid|invalid api key|incorrect api key|invalid x-api-key/.test(all)) ||
        (status === 403 && /api key|permission|disabled|suspended|unauthor|denied/.test(all))) return { kind: 'invalid', msg: msg || 'Key rejected', status };
    if (status === 429 || status === 402) {
      const noMoney = status === 402 || /insufficient_quota|insufficient credits|out of credits|payment required/.test(all);
      const daily = noMoney || /per\s*day|perday|per-day|daily|free-models-per-day/.test(all) || sec > 900;
      if (daily) return { kind: 'daily', msg, status, until: sec > 900 ? Date.now() + sec * 1000 : (noMoney ? Date.now() + 6 * 3600000 : resetAt()) };
      return { kind: 'rate', msg, status, until: Date.now() + Math.max(15, Math.min(sec || 15, 120)) * 1000 };
    }
    if (status === 404) return { kind: 'missing', msg, status };
    if (status >= 500) return { kind: 'server', msg, status, until: Date.now() + 60000 };
    return { kind: 'other', msg, status };
  };
  // Why a slot should be skipped right now (or '' if it is fine). st = {usage,cool,bad} from the database; sess = in-memory marks.
  const unavailable = (s, st, now, sess) => {
    const kid = s.entry._kid, m = mk(s.model), key = kid + ':' + m;
    if (st.bad && st.bad[kid]) return 'key rejected';
    const u = st.cool && st.cool[kid] && st.cool[kid][m];
    if (u && u > now) return 'used up until ' + new Date(u).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    if (sess.skip.has(kid + ':*')) return 'key rejected';
    const su = sess.cool.get(key); if (su && su > now) return 'cooling down';
    if (sess.skip.has(key)) return 'model not available to this key';
    const lim = limitOf(s.entry), c = (((st.usage || {})[ptDay()] || {})[kid] || {})[m] || {};
    if (lim && (c.c || 0) >= lim) return 'daily limit reached (' + (c.c || 0) + '/' + lim + ')';
    return '';
  };
  // ---- /Logic ----

  // ---------------- vault (encrypted in your database) ----------------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  class PoolError extends Error { constructor(msg, attempts) { super(msg); this.name = 'PoolError'; this.attempts = attempts || []; } }
  const dbCfg = () => {
    const d = String(window.__CHAT_DB || '').trim().replace(/\/+$/, '');
    return (/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(d) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(d)) ? d : '';
  };
  const sessionPass = () => { try { return sessionStorage.getItem('__vault_pass') || ''; } catch { return ''; } };
  const secret = () => window.__VAULT || sessionPass();
  let vc = null, cache = null;
  const keyId = async k => {
    try { return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(k)))).slice(0, 10); }
    catch { let h = 5381; for (const c of String(k)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(16).padStart(8, '0').padEnd(10, '0'); }
  };
  async function vaultCrypto() {
    const sec = secret();
    if (!sec) throw new PoolError('No vault passphrase yet. Put window.__VAULT="your passphrase" in your loader bookmark, or set one in the API keys tool.');
    if (!crypto.subtle) throw new PoolError('The vault needs a secure (https) page.');
    if (vc && vc.sec === sec) return vc;
    const base = await crypto.subtle.importKey('raw', enc.encode(sec), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    const idBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('hub-vault-id-v1'), iterations: 120000, hash: 'SHA-256' }, base, 80);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('hub-vault-key-v1'), iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return (vc = { sec, id: hex(idBits), key });
  }
  const put = async (path, val) => { const d = dbCfg(); if (!d) return false; try { const r = await fetch(d + path + '.json', { method: 'PUT', body: JSON.stringify(val) }); return r.ok; } catch { return false; } };
  const del = async path => { const d = dbCfg(); if (!d) return; try { await fetch(d + path + '.json', { method: 'DELETE' }); } catch {} };

  async function load(force) {
    if (!force && cache && Date.now() - cache.t < 60000) return cache.entries;
    const list = []; let vaultErr = null, haveVault = false;
    if (dbCfg() && secret()) {
      try {
        const v = await vaultCrypto();
        const r = await fetch(dbCfg() + '/vault/' + v.id + '/blob.json', { cache: 'no-store' });
        if (!r.ok) throw new PoolError(r.status === 401 || r.status === 403 ? 'The database refused the vault (update the database rules).' : 'Database error ' + r.status);
        const blob = await r.json(); haveVault = true;
        if (blob && blob.ct) {
          let plain;
          try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, v.key, unb64(blob.ct)); }
          catch { throw new PoolError('Wrong vault passphrase, or the stored data is damaged.'); }
          list.push(...JSON.parse(dec.decode(plain)));
        }
      } catch (e) { vaultErr = e instanceof PoolError ? e : new PoolError('Could not read the vault: ' + e.message); }
    }
    const have = new Set(list.map(e => e.key));                  // keys still in your loader bookmark keep working
    if (window.__K && !have.has(window.__K)) list.push({ id: 'loader-gemini', provider: 'gemini', label: 'Loader key (Gemini)', key: window.__K, fromLoader: true });
    if (window.__OR && !have.has(window.__OR)) list.push({ id: 'loader-openrouter', provider: 'openrouter', label: 'Loader key (OpenRouter)', key: window.__OR, fromLoader: true });
    for (const e of list) e._kid = await keyId(e.key);
    cache = { t: Date.now(), entries: list, vaultErr, haveVault };
    return list;
  }
  async function save(entries) {
    const v = await vaultCrypto();
    const clean = entries.filter(e => !e.fromLoader).map(e => { const c = { ...e }; delete c._kid; return c; });
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, v.key, enc.encode(JSON.stringify(clean)));
    const ok = await put('/vault/' + v.id + '/blob', { v: 1, iv: b64(iv), ct: b64(ct), ts: { '.sv': 'timestamp' } });
    if (!ok) throw new PoolError('Could not save to the database (check the rules and your connection).');
    cache = null; return true;
  }

  // ---------------- usage / cool-down state ----------------
  const sess = { cool: new Map(), skip: new Set() };
  async function readState() {
    const st = { usage: {}, cool: {}, bad: {}, ok: false };
    const d = dbCfg(); if (!d || !secret()) return st;
    try {
      const v = await vaultCrypto();
      const r = await fetch(d + '/vault/' + v.id + '/state.json', { cache: 'no-store' });
      if (r.ok) { const j = (await r.json()) || {}; st.usage = j.usage || {}; st.cool = j.cool || {}; st.bad = j.bad || {}; st.ok = true; st.vid = v.id; }
    } catch {}
    return st;
  }
  const vid = async () => { try { return (await vaultCrypto()).id; } catch { return ''; } };

  // ---------------- talking to each kind of provider ----------------
  const jfetch = async (url, init, ms = 30000) => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(url, { ...init, signal: ac.signal });
      const txt = await r.text(); let body = null; try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
      return { r, body };
    } finally { clearTimeout(t); }
  };
  const fail = (provider, out) => ({ ok: false, cls: classify(provider, out.r.status, out.body, out.r.headers.get('retry-after')) });
  const lastUserIdx = msgs => msgs.map(m => m.role).lastIndexOf('user');
  const adapters = {
    async gemini(s, msgs, image, system, think) {
      const lu = lastUserIdx(msgs);
      const mkBody = th => JSON.stringify({
        contents: msgs.map((m, i) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }, ...(image && i === lu ? [{ inline_data: { mime_type: 'image/jpeg', data: image } }] : [])] })),
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        ...(th ? { generationConfig: { thinkingConfig: { thinkingLevel: th } } } : {}),
      });
      let th = think, out;
      for (let i = 0; i < 2; i++) {
        out = await jfetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(s.model) + ':generateContent',
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.entry.key }, body: mkBody(th) });
        if (out.r.status === 400 && th && /think/i.test(JSON.stringify(out.body))) { th = ''; continue; }
        break;
      }
      if (!out.r.ok) return fail('gemini', out);
      const parts = ((((out.body || {}).candidates || [])[0] || {}).content || {}).parts || [];
      const text = parts.filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
      return text ? { ok: true, text } : { ok: false, cls: { kind: 'other', msg: 'Empty or blocked response', status: out.r.status } };
    },
    async openai(s, msgs, image, system) {
      const base = String(s.entry.base || (PROVIDERS[s.entry.provider] || {}).base || '').replace(/\/+$/, '');
      if (!base) return { ok: false, cls: { kind: 'other', msg: 'No base URL is set for this key', status: 0 } };
      const lu = lastUserIdx(msgs);
      const messages = [...(system ? [{ role: 'system', content: system }] : []),
        ...msgs.map((m, i) => (image && i === lu
          ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + image } }] }
          : { role: m.role, content: m.content }))];
      const out = await jfetch(base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.entry.key }, body: JSON.stringify({ model: s.model, messages }) });
      if (!out.r.ok) return fail(s.entry.provider, out);
      const c = ((((out.body || {}).choices || [])[0] || {}).message || {}).content;
      const text = (Array.isArray(c) ? c.map(x => x.text || '').join('') : String(c || '')).trim();
      return text ? { ok: true, text } : { ok: false, cls: { kind: 'other', msg: 'Empty response', status: out.r.status } };
    },
    async anthropic(s, msgs, image, system) {
      const lu = lastUserIdx(msgs);
      const messages = msgs.map((m, i) => ({ role: m.role, content: image && i === lu
        ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: m.content }] : m.content }));
      const out = await jfetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': s.entry.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: s.model, max_tokens: 1500, messages, ...(system ? { system } : {}) }) });
      if (!out.r.ok) return fail('anthropic', out);
      const text = (((out.body || {}).content || []).filter(b => b.type === 'text').map(b => b.text).join('') || '').trim();
      return text ? { ok: true, text } : { ok: false, cls: { kind: 'other', msg: 'Empty response', status: out.r.status } };
    },
  };
  adapters.openrouter = adapters.openai;
  async function callSlot(s, msgs, image, system, think) {
    try { return await adapters[s.entry.provider](s, msgs, image, system, think); }
    catch (e) { return { ok: false, cls: { kind: 'network', msg: e.name === 'AbortError' ? 'Timed out' : 'Could not reach the service (network, CORS or the site\'s security policy)', status: 0, until: Date.now() + 60000 } }; }
  }

  // ---------------- the main call ----------------
  async function ask(o = {}) {
    const msgs = o.messages || [{ role: 'user', content: String(o.text || '') }];
    const entries = await load();
    const slots = buildSlots(entries, { vision: !!(o.image || o.vision) });
    if (!slots.length) throw new PoolError(entries.length ? 'None of your keys can read images. Add one that can (Gemini, OpenRouter vision models, Claude).' : 'No API keys are set up yet. Open the "API keys" tool and add one.');
    const st = await readState(), now = Date.now(), attempts = [];
    for (const s of slots) {
      const why = unavailable(s, st, Date.now(), sess);
      if (why) { attempts.push({ label: s.entry.label, model: s.model, skipped: why }); continue; }
      if (o.onTry) { try { o.onTry(s); } catch {} }
      const r = await callSlot(s, msgs, o.image, o.system, o.think);
      if (r.ok) { await recordUse(s, st); return { text: r.text, label: s.entry.label, model: s.model, provider: s.entry.provider, attempts }; }
      attempts.push({ label: s.entry.label, model: s.model, error: r.cls.kind, msg: r.cls.msg });
      await applyFailure(s, r.cls);
    }
    const parts = attempts.map(a => a.label + ' / ' + a.model + ': ' + (a.skipped || (a.error + (a.msg ? ' (' + a.msg.slice(0, 80) + ')' : ''))));
    throw new PoolError('Every key is used up or failing right now.\n' + parts.join('\n'), attempts);
  }
  async function recordUse(s, st) {
    const id = await vid(); if (!id) return;
    const kid = s.entry._kid, m = mk(s.model), day = ptDay(), base = '/vault/' + id + '/state/usage/' + day + '/' + kid + '/' + m;
    const known = (((st.usage || {})[day] || {})[kid] || {})[m] || {};
    await put(base + '/c', { '.sv': { increment: 1 } });
    if (!known.l && limitOf(s.entry)) await put(base + '/l', limitOf(s.entry));
    for (const d of Object.keys(st.usage || {})) if (d !== day) del('/vault/' + id + '/state/usage/' + d);   // tidy old days
  }
  async function applyFailure(s, cls) {
    const kid = s.entry._kid, m = mk(s.model), key = kid + ':' + m, id = await vid();
    if (cls.kind === 'daily' && id) { sess.cool.set(key, cls.until); await put('/vault/' + id + '/state/cool/' + kid + '/' + m, cls.until); }
    else if (cls.kind === 'invalid') { if (id) await put('/vault/' + id + '/state/bad/' + kid, Date.now()); sess.skip.add(kid + ':*'); sess.cool.set(key, Date.now() + 3600000); }
    else if (cls.kind === 'rate' || cls.kind === 'server' || cls.kind === 'network') sess.cool.set(key, cls.until || Date.now() + 30000);
    else sess.skip.add(key);                                     // 'missing' / 'other': do not retry this one in this session
  }

  // ---------------- for the manager tool ----------------
  async function status() {
    const entries = await load(), st = await readState(), day = ptDay(), now = Date.now();
    return buildSlots(entries).map(s => {
      const kid = s.entry._kid, m = mk(s.model), c = ((((st.usage || {})[day] || {})[kid] || {})[m]) || {};
      return { entry: s.entry, model: s.model, used: c.c || 0, limit: limitOf(s.entry), skipped: unavailable(s, st, now, sess) };
    });
  }
  async function test(entry) {
    const e = { ...entry, _kid: await keyId(entry.key) };
    const model = (e.models && e.models[0]) || ((PROVIDERS[e.provider] || {}).models || [])[0];
    if (!model) return { ok: false, msg: 'Add at least one model name first.' };
    const t0 = Date.now(), r = await callSlot({ entry: e, model }, [{ role: 'user', content: 'Reply with the single word OK.' }]);
    if (r.ok) { const id = await vid(); if (id) del('/vault/' + id + '/state/bad/' + e._kid); return { ok: true, ms: Date.now() - t0, text: r.text.slice(0, 60), model }; }
    return { ok: false, kind: r.cls.kind, msg: ({ invalid: 'The service rejected this key. ', daily: 'This key works but is used up for now. ', rate: 'Rate limited, try again in a moment. ', missing: 'That model name was not found. ' }[r.cls.kind] || '') + (r.cls.msg || ''), model };
  }
  const setPass = p => { try { sessionStorage.setItem('__vault_pass', p); } catch {} vc = null; cache = null; };
  window.APIPool = { v: VER, PROVIDERS, PoolError, ask, load, save, status, test, setPass, maskKey, mk, ptDay,
    dbOk: () => !!dbCfg(), hasSecret: () => !!secret(), vaultError: () => (cache && cache.vaultErr) || null, invalidate: () => { cache = null; }, newId: () => 'k' + Math.random().toString(36).slice(2, 9) };
})();
