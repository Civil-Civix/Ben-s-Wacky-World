CREATE TABLE IF NOT EXISTS online_visitors (
 visitor_hash TEXT PRIMARY KEY,
 last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS online_visitors_seen ON online_visitors(last_seen);
