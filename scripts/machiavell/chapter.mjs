#!/usr/bin/env node
/* Prints SQL for the Machiavell reading room. Nothing is sent anywhere; pipe it into wrangler.

   node scripts/machiavell/chapter.mjs add 5 "The Title" path/to/chapter.txt ["epigraph"] > /tmp/c.sql
   node scripts/machiavell/chapter.mjs release 5            # opens it now
   node scripts/machiavell/chapter.mjs release 5 2026-12-01 # opens it on that day (UTC)
   node scripts/machiavell/chapter.mjs seal 5               # hides it again

   then:  npx wrangler d1 execute machiavell --remote --file=/tmp/c.sql

   Chapter text file: plain text. Blank line = new paragraph. A line of *** = scene break.
   A paragraph starting with "> " is set as a letter. `add` never releases; it only stores. */
import { readFileSync } from 'node:fs';

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const [cmd, num, a, b, c] = process.argv.slice(2);
const n = Number(num);
if (!Number.isInteger(n) || n < 1) { console.error('Chapter number required.'); process.exit(1); }

if (cmd === 'add') {
  if (!a || !b) { console.error('Usage: add <n> "<title>" <file> ["epigraph"]'); process.exit(1); }
  const body = readFileSync(b, 'utf8').replace(/\r\n/g, '\n').trim();
  console.log(`INSERT INTO chapters (n,title,epigraph,body,released_at) VALUES (${n},${q(a)},${c ? q(c) : 'NULL'},${q(body)},NULL)
ON CONFLICT(n) DO UPDATE SET title=excluded.title, epigraph=excluded.epigraph, body=excluded.body;`);
} else if (cmd === 'release') {
  const when = a ? new Date(a + (a.length === 10 ? 'T00:00:00Z' : '')) : new Date();
  if (isNaN(when)) { console.error('Bad date.'); process.exit(1); }
  console.log(`UPDATE chapters SET released_at=${q(when.toISOString())} WHERE n=${n};`);
} else if (cmd === 'seal') {
  console.log(`UPDATE chapters SET released_at=NULL WHERE n=${n};`);
} else {
  console.error('Commands: add | release | seal'); process.exit(1);
}
