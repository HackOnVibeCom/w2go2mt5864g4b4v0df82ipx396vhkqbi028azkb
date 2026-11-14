CREATE TABLE IF NOT EXISTS split_finalizations (
  split_id TEXT PRIMARY KEY REFERENCES splits(id) ON DELETE CASCADE,
  finalized_at INTEGER NOT NULL
);
