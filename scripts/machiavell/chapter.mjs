#!/usr/bin/env node
/* Prints SQL for the Machiavell reading room. Nothing is sent anywhere; pipe it into wrangler.

   node scripts/machiavell/chapter.mjs add 5 "The Title" path/to/chapter.txt ["epigraph"] > /tmp/c.sql
   node scripts/machiavell/chapter.mjs release 5            # opens it now
   node scripts/machiavell/chapter.mjs release 5 2026-12-01 # opens it on that day (UTC)
   node scripts/machiavell/chapter.mjs seal 5               # hides it again
   node scripts/machiavell/chapter.mjs add-translation 5 es "El Título" path/to/capitulo.txt ["epígrafe"]
                                                            # Spanish text for chapter 5 (chapter 5 must exist)

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
} else if (cmd === 'add-translation') {
  const [lang, title, file, epigraph, mapFile] = [a, b, c, process.argv[7], process.argv[8]];
  if (lang !== 'es' || !title || !file) { console.error('Usage: add-translation <n> es "<title>" <file> ["epigraph"]'); process.exit(1); }
  const body = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
  const blocks = (t) => t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).length;
  console.error(`Spanish text has ${blocks(body)} blocks. Side notes follow paragraph positions, so this should match the original's count.`);
  /* map.json: a list with one number per block of the Spanish text, the original block it belongs to.
     Only needed when the translation splits or joins paragraphs. */
  let map = null;
  if (mapFile) {
    map = JSON.parse(readFileSync(mapFile, 'utf8'));
    if (!Array.isArray(map) || map.length !== blocks(body) || map.some((v, i) => !Number.isInteger(v) || (i && v < map[i - 1]))) {
      console.error('map.json must list one non-decreasing whole number per block.'); process.exit(1);
    }
  }
  console.log(`INSERT INTO chapter_translations (n,lang,title,epigraph,body,map) VALUES (${n},${q(lang)},${q(title)},${epigraph ? q(epigraph) : 'NULL'},${q(body)},${map ? q(JSON.stringify(map)) : 'NULL'})
ON CONFLICT(n,lang) DO UPDATE SET title=excluded.title, epigraph=excluded.epigraph, body=excluded.body, map=excluded.map;`);
} else if (cmd === 'release') {
  const when = a ? new Date(a + (a.length === 10 ? 'T00:00:00Z' : '')) : new Date();
  if (isNaN(when)) { console.error('Bad date.'); process.exit(1); }
  console.log(`UPDATE chapters SET released_at=${q(when.toISOString())} WHERE n=${n};`);
} else if (cmd === 'seal') {
  console.log(`UPDATE chapters SET released_at=NULL WHERE n=${n};`);
} else {
  console.error('Commands: add | add-translation | release | seal'); process.exit(1);
}
