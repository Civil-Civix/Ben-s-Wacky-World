CREATE TABLE IF NOT EXISTS chat_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 sender TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient TEXT REFERENCES users(id) ON DELETE CASCADE,
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 1000),
 created INTEGER NOT NULL,
 expires INTEGER NOT NULL,
 client_id TEXT NOT NULL,
 UNIQUE(sender,client_id)
);
CREATE INDEX IF NOT EXISTS chat_expiry ON chat_messages(expires);
CREATE INDEX IF NOT EXISTS chat_sender ON chat_messages(sender,created);
CREATE INDEX IF NOT EXISTS chat_room ON chat_messages(recipient,id);
CREATE INDEX IF NOT EXISTS chat_dm ON chat_messages(sender,recipient,id);
