-- Apply once before deploying the public-room update.
ALTER TABLE chat_messages ADD COLUMN room TEXT NOT NULL DEFAULT 'world' CHECK(room IN ('world','poke'));
CREATE INDEX chat_public_room ON chat_messages(room,id) WHERE group_id IS NULL AND recipient IS NULL;
