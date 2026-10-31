# Machiavell reading room: setup

Lives at `/machiavell`. Static pages in `machiavell/`, API in `functions/machiavell/api/`, data in a D1 database.
**This repository is public, so chapter text never goes in it.** Chapters live only in D1.

## One-time setup (Cloudflare dashboard + wrangler)

1. Create the database and tables:
   ```bash
   npx wrangler d1 create machiavell
   npx wrangler d1 execute machiavell --remote --file=scripts/machiavell/schema.sql
   ```
2. Pages project for aeriel.xyz → Settings → Bindings → **D1 database**: variable name `DB`, database `machiavell`.
3. Settings → Variables and secrets (as **secrets**, Production and Preview):
   - `PASSPHRASE`: the phrase you give your friends (compared ignoring case and extra spaces).
   - `SESSION_SECRET`: a long random string, e.g. `openssl rand -base64 48`.
   Until all three exist, the API answers `not-configured` and the Doorward says the latch is unwritten.
4. Redeploy. To try it with placeholder chapters first:
   ```bash
   npx wrangler d1 execute machiavell --remote --file=scripts/machiavell/seed-placeholder.sql
   ```
   Remove them later: `DELETE FROM chapters WHERE title LIKE '%Placeholder'; DELETE FROM comments;`

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

## Local testing

```bash
printf 'PASSPHRASE=test phrase\nSESSION_SECRET=anything-long\n' > .dev.vars   # git-ignored
npx wrangler d1 execute DB --local --file=scripts/machiavell/schema.sql   # needs a wrangler.toml with a DB binding, or use --persist-to as in the session
npx wrangler pages dev . --d1=DB
```

## Moderation

Comments are in the `comments` table. Delete one: `npx wrangler d1 execute machiavell --remote --command "DELETE FROM comments WHERE id=7"`.
Everyone shares one phrase, so names are self-declared: nothing stops two friends choosing the same name.
To lock everyone out, change `PASSPHRASE` and `SESSION_SECRET` (the latter also signs everyone out).
