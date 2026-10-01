-- Apply once to the existing accounts database before deploying chat.mjs.
CREATE TABLE chat_groups (id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),creator TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created INTEGER NOT NULL);
CREATE TABLE chat_group_members (group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,last_id INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(group_id,user_id));
CREATE INDEX chat_group_user ON chat_group_members(user_id,group_id);
ALTER TABLE chat_messages ADD COLUMN group_id TEXT REFERENCES chat_groups(id) ON DELETE CASCADE;
CREATE INDEX chat_group_messages ON chat_messages(group_id,id);
