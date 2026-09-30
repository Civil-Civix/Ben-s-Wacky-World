CREATE TABLE IF NOT EXISTS battle_tickets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,challenge TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS battle_tickets_expiry ON battle_tickets(expires);
CREATE TABLE IF NOT EXISTS battle_invites(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,recipient TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS battle_invites_users ON battle_invites(recipient,sender,expires);
