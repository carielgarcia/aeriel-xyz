#!/usr/bin/env node
/* Smoke test for the Machiavell API against a running server (local `wrangler pages dev` with the placeholder seed).

   node scripts/machiavell/smoke.mjs http://127.0.0.1:8788 "test phrase"

   Never point this at the live site: it posts a side note and spends wrong-phrase attempts. */
const [base = 'http://127.0.0.1:8788', phrase = 'test phrase'] = process.argv.slice(2);
const api = base.replace(/\/$/, '') + '/machiavell/api/';
let failed = 0;
let cookie = '';

function check(label, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : '  ' + JSON.stringify(detail)}`);
  if (!ok) failed++;
}
async function call(path, { method = 'GET', body, auth = true, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const r = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await r.json(); } catch (e) { /* not JSON */ }
  return { status: r.status, data, setCookie: r.headers.get('set-cookie') || '', cache: r.headers.get('cache-control') };
}

/* static pages are served */
const page = await fetch(base + '/machiavell/');
check('reading room page loads', page.ok && (await page.text()).includes('/machiavell/js/app.js'), page.status);

/* signed out */
let r = await call('me');
check('signed out: /me is 401', r.status === 401 && r.data?.error === 'no-session', r);
r = await call('chapters');
check('signed out: chapters are hidden', r.status === 401, r);

/* entering */
r = await call('enter', { method: 'POST', body: { name: 'Smoke Test', phrase: 'definitely wrong' } });
check('wrong phrase is refused', r.status === 401 && r.data?.error === 'wrong-phrase', r);
r = await call('enter', { method: 'POST', body: { name: '!', phrase } });
check('bad name is refused', r.status === 422 && r.data?.error === 'bad-name', r);
r = await call('enter', { method: 'POST', body: { name: 'Smoke Test', phrase }, origin: 'https://evil.example' });
check('cross-site POST is refused', r.status === 403, r);
r = await call('enter', { method: 'POST', body: { name: 'Smoke Test', phrase: '  ' + phrase.toUpperCase() + ' ' } });
check('right phrase (any case, extra spaces) lets you in', r.status === 200 && r.data?.name === 'Smoke Test', r);
check('session cookie is HttpOnly and scoped to /machiavell', /HttpOnly/.test(r.setCookie) && /Path=\/machiavell/.test(r.setCookie), r.setCookie);
cookie = r.setCookie.split(';')[0];

r = await call('me');
check('signed in: /me knows the name', r.status === 200 && r.data?.name === 'Smoke Test', r);
check('API responses are not cached', r.cache === 'no-store', r.cache);

/* a forged cookie does not work */
const forged = cookie.replace(/\.[^.]+$/, '.AAAA');
const fr = await fetch(api + 'me', { headers: { cookie: forged } });
check('forged cookie is refused', fr.status === 401, fr.status);

/* library */
r = await call('chapters');
const open = r.data?.chapters || [];
check('library lists released chapters', r.status === 200 && open.length >= 1, r);
const sealedN = (r.data?.sealed || [])[0];
check('library names sealed chapters without their text', sealedN === undefined || (r.data.sealedTitles?.[sealedN] && !('body' in r.data)), r.data);

/* chapter */
const n = open[0]?.n;
r = await call(`chapters/${n}`);
check('chapter has blocks', r.status === 200 && Array.isArray(r.data?.blocks) && r.data.blocks.length > 0, r);
const para = r.data?.blocks?.find((b) => b.t === 'p')?.i;
r = await call(`chapters/${n}?lang=es`);
check('Spanish request falls back to the original when there is no translation', r.status === 200 && ['en', 'es'].includes(r.data?.lang), r);
if (sealedN !== undefined) {
  r = await call(`chapters/${sealedN}`);
  check('sealed chapter text is not served', r.status === 404 && r.data?.error === 'sealed', r);
}

/* side notes */
r = await call(`comments/${n}`, { method: 'POST', body: { para, text: 'Smoke test note.' } });
check('a side note can be left on a paragraph', r.status === 201 && r.data?.comment?.author === 'Smoke Test', r);
r = await call(`comments/${n}`, { method: 'POST', body: { para: 9999, text: 'nowhere' } });
check('a note on a paragraph that does not exist is refused', r.status === 422, r);
r = await call(`comments/${n}`);
check('side notes are listed', r.status === 200 && r.data?.comments?.some((c) => c.body === 'Smoke test note.'), r);

/* leaving */
r = await call('leave', { method: 'POST', body: {} });
check('leaving clears the cookie', r.status === 200 && /Max-Age=0/.test(r.setCookie), r);

/* rate limit: the earlier wrong phrase counts too, so 8 more must trip it */
let last;
for (let i = 0; i < 8; i++) last = await call('enter', { method: 'POST', body: { name: 'Guesser', phrase: 'guess ' + i }, auth: false });
check('too many wrong phrases are slowed down', last.status === 429 && last.data?.error === 'too-many', last);

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
