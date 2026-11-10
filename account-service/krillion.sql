CREATE TABLE IF NOT EXISTS krillion_tickets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_hash TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS krillion_ticket_expiry ON krillion_tickets(expires);
CREATE TABLE IF NOT EXISTS krillion_results(date TEXT NOT NULL,user_id TEXT NOT NULL,run_id TEXT NOT NULL UNIQUE,score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 700),finished INTEGER NOT NULL,PRIMARY KEY(date,user_id));
CREATE INDEX IF NOT EXISTS krillion_daily_scores ON krillion_results(date,score DESC);
