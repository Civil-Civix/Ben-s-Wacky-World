CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL,
  game_id TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0 CHECK (plays >= 0),
  PRIMARY KEY (day, game_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,
  game_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (day, game_id, visitor_hash)
) WITHOUT ROWID;
CREATE TRIGGER IF NOT EXISTS count_new_visit AFTER INSERT ON visits
BEGIN
  INSERT INTO daily_counts(day, game_id, plays) VALUES (NEW.day, NEW.game_id, 1)
  ON CONFLICT(day, game_id) DO UPDATE SET plays = plays + 1;
END;
