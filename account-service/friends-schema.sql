CREATE TABLE IF NOT EXISTS friendships (
 user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 requester TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN ('pending','accepted','declined')),
 updated INTEGER NOT NULL,
 PRIMARY KEY(user_a,user_b), CHECK(user_a<user_b), CHECK(requester IN (user_a,user_b))
);
CREATE INDEX IF NOT EXISTS friends_by_b ON friendships(user_b,state);
