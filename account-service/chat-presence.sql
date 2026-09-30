ALTER TABLE users ADD COLUMN presence TEXT NOT NULL DEFAULT 'online';
ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS sessions_presence ON sessions(user_id,last_seen);
ALTER TABLE chat_messages ADD COLUMN photo TEXT;
