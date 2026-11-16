CREATE TABLE IF NOT EXISTS phone_limits(user_id TEXT NOT NULL,kind TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,kind));
CREATE TABLE IF NOT EXISTS phone_reports(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,chain_id TEXT NOT NULL,round INTEGER NOT NULL,reporter TEXT NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created INTEGER NOT NULL,UNIQUE(room,chain_id,round,reporter));
CREATE INDEX IF NOT EXISTS phone_report_status ON phone_reports(status,id);
