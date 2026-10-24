# Poly Track — Wacky World integration

The original game and replay viewer remain intact. `bww-leaderboard.js` connects native leaderboard reads and newly completed runs to the Ben’s Wacky World account API. `main.bundle.js` has small, searchable `BWWPoly` hooks; preserve them when updating the bundled game. `index.html` loads the adapter first.

- 17 official tracks. Best time per account/track; profiles come from authenticated site sessions, never the local game nickname.
- Launch through Ben’s Wacky World while logged in to post scores. Guests can play and watch replays.
- Leaderboard entries use native Watch/replay controls. `?bwwReplay=ID` opens a shared replay from the site leaderboard.
- Fresh finishes upload even if a previous browser-local personal best is faster. Old local records are not automatically assigned to an account. Existing local progress is preserved.
- Community times: replay structure is validated, but physics/finish times are not verified on the server. Do not label these as cheat-proof records.
- Keep the original game credits and terms.

## Check
Run `node tests/leaderboard.cjs` from this folder with `PLAYWRIGHT_PATH` pointing to Playwright. It uses mocked requests, synthetic replay input, and headless Edge; no live records or accounts are created.

## Publish order
Deploy the shared account Worker with `scores.mjs`, `poly-tracks.mjs` and `score-schema.sql` first, then push this repo and Ben’s Wacky World. Backend implementation and rollout notes live in the sibling Ben’s Wacky World repository under `docs/LEADERBOARD-ROLLOUT.md`.
