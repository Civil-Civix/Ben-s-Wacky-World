-- Pin each dive before sample puzzle rows can be refreshed with live content.
-- Existing fallback dives remain practice/sample and never enter ranked scores.
ALTER TABLE runs ADD COLUMN puzzle_content TEXT;
UPDATE runs SET puzzle_content = (SELECT content FROM puzzles WHERE puzzles.date = runs.date)
WHERE puzzle_content IS NULL AND EXISTS (
  SELECT 1 FROM puzzles WHERE puzzles.date = runs.date
  AND CASE WHEN typeof(content) = 'text' THEN json_extract(content, '$.sample') ELSE 0 END = 1
);
