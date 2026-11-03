# Machiavell reading room: setup

Lives at `/machiavell`. Static pages in `machiavell/`, API in `functions/machiavell/api/`, data in a D1 database.
**This repository is public, so chapter text never goes in it.** Chapters live only in D1.

## Setup

Most of the Cloudflare side is in code now:

- `wrangler.toml` (repo root) names the Pages project, sets the runtime date and binds the `machiavell` D1 database as `DB`.
  Once deployed it is the source of truth: the dashboard shows those settings read-only.
- `_routes.json` (repo root) runs the Function only for `/machiavell/api/*`; every other path is served as a plain file.
- `.github/workflows/machiavell.yml` builds the Functions and runs `scripts/machiavell/check.sh` on every pull request.

The database already exists and has its tables. On a fresh account it would be:
```bash
npx wrangler d1 create machiavell        # then put the printed id in wrangler.toml
npx wrangler d1 execute machiavell --remote --file=scripts/machiavell/schema.sql
```

The two secrets live only in Cloudflare (never in this repository). Set or change them from the repo root:
```bash
npx wrangler pages secret put PASSPHRASE                # the phrase you give your friends (case and extra spaces ignored)
npx wrangler pages secret put SESSION_SECRET            # a long random string: openssl rand -base64 48
npx wrangler pages secret put PASSPHRASE --env preview  # repeat both for preview deployments if you want those to open too
```
`wrangler pages secret list` shows which exist, not their values. Until `DB`, `PASSPHRASE` and `SESSION_SECRET` all exist
the API answers `not-configured` and the Doorward says the latch is unwritten. A new secret takes effect on the next deployment.

Preview deployments (`*.aeriel-xyz.pages.dev`, one per branch) use the same database, so a side note left on a preview is real.

**`seed-placeholder.sql` is for a local database only.** It writes chapters 1 to 4 with `INSERT OR REPLACE`, so on the live
database it would overwrite the real chapters.

## Releasing a chapter

Keep chapter text files outside the repo (or in `chapters-private/`, which is git-ignored).
Plain text; blank line = paragraph; `***` = scene break; a paragraph starting `> ` is set as a letter.

```bash
node scripts/machiavell/chapter.mjs add 1 "Chapter Title" ~/book/ch1.txt "Optional epigraph" > /tmp/c.sql
node scripts/machiavell/chapter.mjs release 1 >> /tmp/c.sql            # now; or add 2026-12-01 for that day
npx wrangler d1 execute machiavell --remote --file=/tmp/c.sql
```
`add` stores a chapter sealed. `release N [date]` opens it (a future date opens itself that day). `seal N` hides it again.
Editing a chapter after friends have commented: side notes attach to the paragraph's position, so avoid adding or removing paragraphs.

## Languages (English and Spanish)

The page, the Doorward and every label are available in English and Spanish (`machiavell/js/i18n.js`). On a first visit the
browser's language list decides; the EN / ES switch in the top bar overrides it and is remembered.

Chapter text is in English unless a Spanish version exists. Spanish versions live in the `chapter_translations` table (so,
like the chapters, never in this repository). If the table or a row is missing, the reader gets the original with a short notice.

```bash
# once, on the live database (safe to repeat: every statement is IF NOT EXISTS):
npx wrangler d1 execute machiavell --remote --file=scripts/machiavell/schema.sql
# per chapter (the English chapter must already exist; it is released as usual, the Spanish text opens with it):
node scripts/machiavell/chapter.mjs add-translation 1 es "El Título" ~/book/capitulo-1.txt "Epígrafe opcional" [map.json] > /tmp/t.sql
npx wrangler d1 execute machiavell --remote --file=/tmp/t.sql
```
Side notes attach to the original's paragraph numbers and are shared between both languages. If the Spanish splits a paragraph
that the English keeps whole (or the reverse), pass a map as the last argument: a JSON list with one number per Spanish block,
the English block it belongs to (e.g. `[0,0,1,2]` when English block 0 became two Spanish blocks). The note then sits on the
first piece. Without a map the blocks are matched by position, so the counts must agree (the tool prints the Spanish count).
`*text*` in a chapter is set in italics. Release and sealing are decided by the English chapter.

## Local testing

```bash
scripts/machiavell/check.sh            # builds, seeds a throwaway local database, runs smoke.mjs against it
```
To click around yourself:
```bash
printf 'PASSPHRASE=test phrase\nSESSION_SECRET=anything-long\n' > .dev.vars   # git-ignored
npx wrangler d1 execute DB --local --file=scripts/machiavell/schema.sql
npx wrangler d1 execute DB --local --file=scripts/machiavell/seed-placeholder.sql
npx wrangler pages dev .               # http://localhost:8788/machiavell/
```

## Moderation

Comments are in the `comments` table. Delete one: `npx wrangler d1 execute machiavell --remote --command "DELETE FROM comments WHERE id=7"`.
Everyone shares one phrase, so names are self-declared: nothing stops two friends choosing the same name.
To lock everyone out, change `PASSPHRASE` and `SESSION_SECRET` (the latter also signs everyone out).
