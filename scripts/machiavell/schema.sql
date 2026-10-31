-- Machiavell reading room. Apply once:  wrangler d1 execute machiavell --remote --file=scripts/machiavell/schema.sql
CREATE TABLE IF NOT EXISTS chapters (
  n           INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  epigraph    TEXT,
  body        TEXT NOT NULL,
  released_at TEXT            -- ISO date-time; NULL = sealed. A future date opens it on that day.
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
