-- Tapsplit schema. Runs on Cloudflare D1 (wrangler d1 migrations apply) and on
-- Node's built-in SQLite for local dev and tests. Keep statements idempotent.

CREATE TABLE IF NOT EXISTS splits (
  id TEXT PRIMARY KEY,
  admin_token TEXT NOT NULL,
  title TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  items TEXT NOT NULL,          -- JSON [{id, name, price, qty}] (price in minor units)
  extras TEXT NOT NULL,         -- JSON [{label, amount}] (tax, service, tip, discount)
  pay_method TEXT NOT NULL DEFAULT 'none',
  pay_handle TEXT NOT NULL DEFAULT '',
  parent_id TEXT,               -- the split whose page brought this creator here
  creator_vid TEXT,             -- anonymous visitor id of the creator
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS splits_parent ON splits(parent_id);
CREATE INDEX IF NOT EXISTS splits_creator ON splits(creator_vid);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  split_id TEXT NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  claims TEXT NOT NULL DEFAULT '{}',  -- JSON {itemId: shares}
  is_payer INTEGER NOT NULL DEFAULT 0,
  vid TEXT,
  paid_at INTEGER,
  paid_amount INTEGER,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS participants_split ON participants(split_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- view | share | cta
  split_id TEXT,
  vid TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS events_type_split ON events(type, split_id);
CREATE INDEX IF NOT EXISTS events_vid ON events(vid);
