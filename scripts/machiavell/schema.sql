-- Machiavell reading room. Apply once:  wrangler d1 execute machiavell --remote --file=scripts/machiavell/schema.sql
CREATE TABLE IF NOT EXISTS chapters (
  n           INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  epigraph    TEXT,
  body        TEXT NOT NULL,
  released_at TEXT            -- ISO date-time; NULL = sealed. A future date opens it on that day.
);
-- A chapter's text in another language. The chapter itself (release date, notes) stays in `chapters`;
-- a translation is shown when the reader asks for that language and a row exists, otherwise the original is shown.
-- Side notes attach to a paragraph's position, so a translation should keep the same blocks in the same order.
CREATE TABLE IF NOT EXISTS chapter_translations (
  n        INTEGER NOT NULL,
  lang     TEXT NOT NULL,       -- 'es'
  title    TEXT NOT NULL,
  epigraph TEXT,
  body     TEXT NOT NULL,
  PRIMARY KEY (n, lang)
);
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter    INTEGER NOT NULL,
  para       INTEGER,          -- NULL = a remark on the whole chapter
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_chapter ON comments (chapter, id);
CREATE TABLE IF NOT EXISTS attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_ip ON attempts (ip, at);
