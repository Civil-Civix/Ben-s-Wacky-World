# Game leaderboards — October 3, 2026

## Status
Backend deployed October 4, 2026. D1 score tables applied; Worker deployment `d4fec32bea5a4707937cc32ec5e154d7` is live with existing bindings preserved and BATTLE_RESULT_SECRET added. Showdown result plugin installed, built and service restarted while idle; private secret has mode 600 and is owned by showdown. Main site leaderboard UI is already published.

Remaining: user commits and pushes the local newcargame changes. Published Poly Track does not yet include bww-leaderboard.js. Do not push on the user's behalf unless asked.

## What is ready
- Existing playtime leaderboard plus Showdown wins and Poly Track tabs, search, top three, track selector and Watch replay buttons.
- Gen 9 Random Battle matchmaking wins only, from site-linked profiles. Challenges/ties do not count. Server-signed results are idempotent. Scores start at rollout; no historical backfill was performed.
- Poly Track: 17 official tracks, fastest submitted run per account/track, native in-game leaderboard and replay playback. Shared site names are authoritative; local game nicknames cannot impersonate accounts.
- Fresh finishes upload; existing browser-only bests are not auto-imported. The game continues saving local records.
- Poly replays have bounded decompression and structural validation. Claimed finish times are NOT physics-verified; displayed as community submissions.

## Locations
- Main checkout: `C:\Users\mrell\OneDrive\Documents\GitHub\Ben's Wacky World`
- Poly Track checkout: `C:\Users\mrell\OneDrive\Documents\GitHub\newcargame` (cloned from the user-approved Civil-Civix/newcargame).
- Backend: `account-service/scores.mjs`, `poly-tracks.mjs`, `score-schema.sql`, updated `worker.mjs`.
- Showdown: `pokemon-service/wacky-results.ts` (chat plugin), `results-test.mjs`.
- Site UI: `accounts.js`, `app.js`, `index.html`, `styles.css`.
- Poly integration: `bww-leaderboard.js`, hooks in `main.bundle.js`, `index.html`, `tests/leaderboard.cjs`.

## Deployment order
1. Completed: restored Cloudflare access and applied additive/idempotent `account-service/score-schema.sql` to existing D1 `bens-wacky-accounts` (5e683b3e-fcda-4a84-8d55-0db23514438e). Applied October 4, 2026.
2. Generate a new private random 32-byte secret. Add it as Worker secret `BATTLE_RESULT_SECRET`. Store the same value only in `/opt/showdown/pokemon-showdown/config/bww-result-secret`, owned by showdown with mode 600. Never put it in a public file, source tree, command output or chat.
3. Deploy `bens-wacky-accounts`, including scores.mjs and poly-tracks.mjs along with every existing module, preserving all existing bindings, secrets, triggers and observability. Verify old account endpoints and public leaderboard reads.
4. Back up the active Showdown code/config privately. Copy wacky-results.ts to `/opt/showdown/pokemon-showdown/server/chat-plugins/wacky-results.ts`, build with the existing Node build process, and restart Showdown when there are no active battles. Confirm the plugin is loaded. The outbox lives in private config/bww-result-outbox; do not publish or erase pending rows.
5. User pushes Poly Track and Ben’s Wacky World frontends. Do not push on the user's behalf unless asked. Check published version tags and one user-tested run/battle. Do not create live test accounts or manufacture production wins.

If deploying via wrangler, inspect live settings first; do not overwrite dashboard-only configuration. Use the existing account and Worker, never create a paid resource for this feature.

## Checks completed
- `node account-service/score-test.mjs`: signed wins, forged/duplicate/challenge rejection, account ownership, personal best retention, track isolation, replay retrieval/validation, rate limiting, banned-account filtering.
- `node account-service/test.mjs`: existing accounts, chat, moderation and battle-ticket regression checks.
- `node pokemon-service/results-test.mjs`: matchmaking-only event handling, HMAC signature, durable outbox success/failure behavior, with mocked delivery.
- `.audit-evidence/score-ui-check.cjs`: mode switching, formats, track selector, replay controls and existing playtime.
- Poly `node tests/leaderboard.cjs`: game starts with 17 tracks; native save path submits; adapters show account names; replay deserialization and actual viewer work. All network records mocked.

## Follow-up
User pushes newcargame, then tests a normal completed run and matchmaking win. Live read checks passed for playtime, Showdown, tracks and Poly board; unauthenticated /me remains 401. No production scores were manufactured. Full server-side Poly Track simulation validation and historical Showdown backfill remain outside this first rollout.
