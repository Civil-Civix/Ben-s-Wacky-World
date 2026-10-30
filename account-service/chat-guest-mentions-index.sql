-- Keep guest mention polling limited to public broadcasts.
CREATE INDEX IF NOT EXISTS chat_public_mentions ON chat_messages(id,expires) WHERE group_id IS NULL AND recipient IS NULL AND room='world' AND mentions_everyone=1;
