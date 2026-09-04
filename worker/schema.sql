-- One row per exchange. Flat on purpose: reading a conversation is
--   SELECT ... WHERE cid = ? ORDER BY turn_index
-- and the rate limiter is two COUNT(*) queries against the same table.
CREATE TABLE IF NOT EXISTS turns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cid        TEXT    NOT NULL,  -- conversation id, generated client-side
  turn_index INTEGER NOT NULL,  -- 0-based position within the conversation
  created_at INTEGER NOT NULL,  -- epoch ms
  user_text  TEXT    NOT NULL,
  reply_text TEXT,              -- NULL when the turn errored or was rate-limited
  status     TEXT    NOT NULL,  -- ok | refusal | rate_limited | error | mock
  ip_hash    TEXT    NOT NULL,  -- SHA-256(ip + IP_SALT); the raw IP is never stored
  country    TEXT,              -- request.cf.country, no finer than that
  user_agent TEXT,
  in_tokens  INTEGER,
  out_tokens INTEGER
);

-- Per-IP rate limit lookup.
CREATE INDEX IF NOT EXISTS idx_turns_ip_time ON turns(ip_hash, created_at);
-- Global daily cap + retention sweep.
CREATE INDEX IF NOT EXISTS idx_turns_time ON turns(created_at);
-- Reading one conversation in order.
CREATE INDEX IF NOT EXISTS idx_turns_cid ON turns(cid, turn_index);
