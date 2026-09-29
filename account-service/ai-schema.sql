CREATE TABLE IF NOT EXISTS ai_requests (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 browser_hash TEXT NOT NULL,
 day TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','complete','failed')),
 prompt TEXT,
 answer TEXT,
 provider TEXT,
 model TEXT,
 created INTEGER NOT NULL,
 expires INTEGER NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS ai_account_day ON ai_requests(user_id,day,status);
CREATE INDEX IF NOT EXISTS ai_browser_day ON ai_requests(browser_hash,day,status);
CREATE INDEX IF NOT EXISTS ai_expiry ON ai_requests(expires);
