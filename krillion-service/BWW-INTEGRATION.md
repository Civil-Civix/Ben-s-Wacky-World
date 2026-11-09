# Krillion in Cloudflare Portable

Based on Civil-Civix/openkrillion.com-service at 33fdff48623fb4815e95081a1a1d41bd1902f99d. Original MIT license and third-party notices are retained. This is the independent OpenKrillion reconstruction, not the original service.

Runs and scores use a separate D1 database. R2 is not required. Public daily puzzles are synchronized on demand with a labelled sample fallback. No cron is configured. The embedded client uses a browser-local random bearer ID when third-party cookies are blocked. Keep that ID private. Production disables local test time controls.

Run npm test, npm run build, and browser game-flow QA before deployment. The local configuration uses sample puzzles to make checks deterministic.
