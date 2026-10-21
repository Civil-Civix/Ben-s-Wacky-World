CREATE TABLE IF NOT EXISTS game_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 game_id TEXT NOT NULL,
 reporter TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','fixed','removed')),
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL,
 UNIQUE(game_id,reporter)
);
CREATE INDEX IF NOT EXISTS reports_status ON game_reports(status,id);
