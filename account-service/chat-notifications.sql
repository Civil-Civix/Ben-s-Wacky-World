-- Apply once before deploying guest chat and notifications.
ALTER TABLE chat_messages ADD COLUMN mentions_everyone INTEGER NOT NULL DEFAULT 0 CHECK(mentions_everyone IN (0,1));
CREATE TABLE IF NOT EXISTS chat_room_reads (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, room TEXT NOT NULL, last_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,room));
