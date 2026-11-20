# Krillion in Cloudflare Portable

Based on Civil-Civix/openkrillion.com-service at 33fdff48623fb4815e95081a1a1d41bd1902f99d. Original MIT license and third-party notices are retained. This is the independent OpenKrillion reconstruction, not the original service.

Runs and scores use a separate D1 database. R2 is not required. Public daily puzzles are synchronized on demand with a labelled sample fallback. No cron is configured. The embedded client uses a browser-local random bearer ID when third-party cookies are blocked. Keep that ID private. Production disables local test time controls.

Run npm test, npm run build, and browser game-flow QA before deployment. The local configuration uses sample puzzles to make checks deterministic.

## Past Dives

The archive lists only saved real puzzles dated before the current New York day. Archive attempts use practice mode, never publish to the daily leaderboard, and keep a separate browser resume slot from today's dive. Missing dates and sample puzzles are not offered. No database migration is required. Historical puzzle rows are reused rather than copying multi-megabyte answer banks into each attempt.

## Puffer Party

Private rooms are available at /party through the same Worker. The PartyRoom SQLite Durable Object is introduced by the party-v1 Wrangler migration; it does not alter the existing D1 daily puzzle or ranking tables. See PUFFER-PARTY.md for implemented rules, known fidelity limits and local QA boundaries. Publish only after the full existing test suite, build and focused local multiplayer browser acceptance pass.
