/* Machiavell: members-only reading room.
   One catch-all Pages Function for /machiavell/api/*.

   Bindings (set in the Cloudflare dashboard, see scripts/machiavell/README.md):
     DB              D1 database (tables: chapters, comments, attempts)
     PASSPHRASE      the shared passphrase (secret)
     SESSION_SECRET  long random string used to sign the session cookie (secret)

   Chapters live in D1, never in this repository (the repository is public). */

const COOKIE = 'mv';
const SESSION_DAYS = 60;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 8;
const MAX_COMMENT = 1500;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .'’-]{1,31}$/u;

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------- small helpers ---------- */
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}
const fail = (status, error) => json({ error }, status);

function b64u(bytes) {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function digest(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
/* the phrase is compared loosely (case, spacing) so friends are not punished for a stray capital */
const normPhrase = (s) => String(s || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

async function makeCookie(env, name, secure) {
  const payload = b64u(enc.encode(JSON.stringify({ n: name, e: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 })));
  const sig = b64u(await hmac(env.SESSION_SECRET, payload));
  return `${COOKIE}=${payload}.${sig}; Path=/machiavell; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
const clearCookie = (secure) => `${COOKIE}=; Path=/machiavell; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

async function readSession(request, env) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  try {
    const good = await hmac(env.SESSION_SECRET, payload);
    if (!sameBytes(good, unb64u(sig))) return null;
    const p = JSON.parse(dec.decode(unb64u(payload)));
    if (!p.n || p.e < Date.now() / 1000) return null;
    return { name: p.n };
  } catch (e) {
    return null;
  }
}

function cleanName(raw) {
  const n = String(raw || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  return NAME_RE.test(n) ? n : null;
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return null;
  const text = await request.text();
  if (text.length > 8000) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

/* A chapter body is plain text. Blank line = new block.
     ***            a scene break
     > text         a letter (italic, inset)
   Anything else is a paragraph. Indices count every block, so notes stay put. */
function blocks(body) {
  return String(body).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b, i) => {
    if (/^(\*\s*){3,}$/.test(b)) return { i, t: 'break' };
    if (b.startsWith('> ')) return { i, t: 'letter', text: b.replace(/^>\s?/gm, '').replace(/\n/g, ' ') };
    return { i, t: 'p', text: b.replace(/\n/g, ' ') };
  });
}

/* ---------- handlers ---------- */
async function enter(request, env, url) {
  const data = await readJson(request);
  if (!data) return fail(400, 'bad-request');
  const name = cleanName(data.name);
  if (!name) return fail(422, 'bad-name');

  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  await env.DB.prepare('DELETE FROM attempts WHERE at < ?').bind(now - 3600 * 1000).run();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip = ? AND at > ?').bind(ip, now - ATTEMPT_WINDOW_MS).first();
  if (n >= ATTEMPT_LIMIT) return fail(429, 'too-many');

  const [a, b] = await Promise.all([digest(normPhrase(data.phrase)), digest(normPhrase(env.PASSPHRASE))]);
  if (!sameBytes(a, b)) {
    await env.DB.prepare('INSERT INTO attempts (ip, at) VALUES (?, ?)').bind(ip, now).run();
    return fail(401, 'wrong-phrase');
  }
  return json({ name }, 200, { 'set-cookie': await makeCookie(env, name, url.protocol === 'https:') });
}

async function listChapters(env) {
  const now = new Date().toISOString();
  const rows = (await env.DB.prepare('SELECT n, title, epigraph, released_at FROM chapters WHERE released_at IS NOT NULL AND released_at <= ? ORDER BY n').bind(now).all()).results;
  const sealed = (await env.DB.prepare('SELECT n FROM chapters WHERE released_at IS NULL OR released_at > ? ORDER BY n').bind(now).all()).results.map((r) => r.n);
  const counts = {};
  (await env.DB.prepare('SELECT chapter, COUNT(*) AS c FROM comments GROUP BY chapter').all()).results.forEach((r) => (counts[r.chapter] = r.c));
  return json({
    chapters: rows.map((r) => ({ n: r.n, title: r.title, epigraph: r.epigraph, released: r.released_at, remarks: counts[r.n] || 0 })),
    sealed,
  });
}

async function getChapter(env, n) {
  const now = new Date().toISOString();
  const r = await env.DB.prepare('SELECT n, title, epigraph, body, released_at FROM chapters WHERE n = ? AND released_at IS NOT NULL AND released_at <= ?').bind(n, now).first();
  if (!r) return fail(404, 'sealed');
  const nb = await env.DB.prepare('SELECT n FROM chapters WHERE released_at IS NOT NULL AND released_at <= ? ORDER BY n').bind(now).all();
  const ns = nb.results.map((x) => x.n);
  const at = ns.indexOf(n);
  return json({
    n: r.n, title: r.title, epigraph: r.epigraph, released: r.released_at,
    blocks: blocks(r.body),
    prev: at > 0 ? ns[at - 1] : null,
    next: at < ns.length - 1 ? ns[at + 1] : null,
  });
}

async function listComments(env, n) {
  const rows = (await env.DB.prepare('SELECT id, para, author, body, created_at AS at FROM comments WHERE chapter = ? ORDER BY id').bind(n).all()).results;
  return json({ comments: rows });
}

async function addComment(request, env, n, session) {
  const ch = await env.DB.prepare('SELECT body FROM chapters WHERE n = ? AND released_at IS NOT NULL AND released_at <= ?').bind(n, new Date().toISOString()).first();
  if (!ch) return fail(404, 'sealed');
  const data = await readJson(request);
  if (!data) return fail(400, 'bad-request');
  const text = String(data.text || '').trim();
  if (!text || text.length > MAX_COMMENT) return fail(422, 'bad-text');
  let para = null;
  if (data.para !== null && data.para !== undefined) {
    para = Number(data.para);
    const b = blocks(ch.body)[para];
    if (!Number.isInteger(para) || !b || b.t === 'break') return fail(422, 'bad-paragraph');
  }
  const at = new Date().toISOString();
  const res = await env.DB.prepare('INSERT INTO comments (chapter, para, author, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(n, para, session.name, text, at).run();
  return json({ comment: { id: res.meta.last_row_id, para, author: session.name, body: text, at } }, 201);
}

/* ---------- router ---------- */
export async function onRequest({ request, env, params }) {
  if (!env.DB || !env.PASSPHRASE || !env.SESSION_SECRET) return fail(503, 'not-configured');
  const url = new URL(request.url);
  const path = [].concat(params.path || []);
  const route = path.join('/');
  const method = request.method;

  if (method === 'POST') {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return fail(403, 'bad-origin');
  }

  if (route === 'enter' && method === 'POST') return enter(request, env, url);
  if (route === 'leave' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie(url.protocol === 'https:') });

  const session = await readSession(request, env);
  if (route === 'me' && method === 'GET') return session ? json({ name: session.name }) : fail(401, 'no-session');
  if (!session) return fail(401, 'no-session');

  if (route === 'chapters' && method === 'GET') return listChapters(env);
  let m;
  if ((m = route.match(/^chapters\/(\d{1,4})$/)) && method === 'GET') return getChapter(env, Number(m[1]));
  if ((m = route.match(/^comments\/(\d{1,4})$/))) {
    if (method === 'GET') return listComments(env, Number(m[1]));
    if (method === 'POST') return addComment(request, env, Number(m[1]), session);
  }
  return fail(404, 'not-found');
}
