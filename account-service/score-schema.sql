CREATE TABLE IF NOT EXISTS battle_results(battle_id TEXT PRIMARY KEY,winner TEXT NOT NULL REFERENCES users(id),loser TEXT NOT NULL REFERENCES users(id),finished INTEGER NOT NULL,CHECK(winner<>loser));
CREATE INDEX IF NOT EXISTS battle_wins ON battle_results(winner);
CREATE TABLE IF NOT EXISTS poly_records(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,track TEXT NOT NULL,frames INTEGER NOT NULL CHECK(frames>0),recording TEXT NOT NULL,car_style TEXT NOT NULL,updated INTEGER NOT NULL,UNIQUE(user_id,track));
CREATE INDEX IF NOT EXISTS poly_ranking ON poly_records(track,frames,updated,id);
CREATE TABLE IF NOT EXISTS poly_limits(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,last_submit INTEGER NOT NULL);
