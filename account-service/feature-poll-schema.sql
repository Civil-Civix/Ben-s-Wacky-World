CREATE TABLE IF NOT EXISTS feature_votes (
 poll_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 choice TEXT NOT NULL CHECK(choice IN ('tournaments','wacky-phone','daily-games','music')),
 updated INTEGER NOT NULL,
 PRIMARY KEY(poll_id,user_id)
);
CREATE INDEX IF NOT EXISTS feature_votes_totals ON feature_votes(poll_id,choice);
