CREATE TABLE IF NOT EXISTS music_playlists (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_id TEXT NOT NULL,
 name TEXT NOT NULL,
 tracks TEXT NOT NULL,
 cover TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 updated INTEGER NOT NULL,
 UNIQUE(owner_id, client_id)
);
