# Site-wide popularity

Deployed September 19, 2026 using the connected Cloudflare plugin.

- Worker: `bens-wacky-popularity`
- API: https://bens-wacky-popularity.mr-ellis1009.workers.dev/popular
- D1: `bens-wacky-popularity` (`bedb0332-b11b-40bc-af12-69529685d87c`)
- Existing Worker `ben-s-wacky-world` was not changed.
- Website stays on GitHub Pages. Push the frontend changes normally to activate counting for visitors. No paid plan was enabled.

## What Popular measures

Game openings, not successful loads or time played. Rankings include today and the previous 29 UTC calendar dates. Each browser counts at most once per game per UTC date, including concurrent requests. Rankings refresh when selected, with up to 60 seconds of caching. Pinned games remain first; equal counts sort A–Z. With no counts yet, the list is alphabetical after pins. Favorites and Recents remain local; Popular can also sort those game collections.

Apps, Stream Hub, reloads and local previews do not contribute. The game always opens even if the service is unavailable. With no ranking available, Popular explains that it is showing the default order; a failed refresh can retain the last ranking.

## Data and limits

A random browser ID is saved locally and sent with the selected game ID. The Worker stores a daily HMAC hash, never the original browser ID or a raw IP address in D1. IP addresses are hashed for short-lived rate limits. Cloudflare still processes requests as the hosting provider.

The database keeps aggregate daily totals for 30 calendar dates. A daily 00:17 UTC cleanup retains deduplication hashes for today/yesterday and removes older totals. Reads exclude older data even before cleanup runs. Cloudflare backups may retain older database states according to its platform retention.

Limits: 12 submissions per browser per minute and a broader 300 requests per IP per minute per read/write route at each Cloudflare location. The IP allowance accommodates shared networks. Database uniqueness is authoritative for duplicate counting. These controls reduce casual spam; clearing browser storage or using many devices/addresses can still inflate totals. Origin checks are browser restrictions, not authentication. Free quota exhaustion makes rankings unavailable without blocking games.

## Files and maintenance

- `worker.mjs`: request validation, privacy hashing, ranking reads, rate limits and cleanup.
- `schema.sql`: tables plus an atomic insert trigger.
- `game-ids.mjs`: allowlist generated from the root `games.json`.
- `wrangler.jsonc`: equivalent deployment configuration, including public resource IDs.
- Root `popularity.js`: browser API client. Its endpoint is public, not a secret.
- Root `app.js` and `index.html`: Popular menu and launch integration.

After adding or removing games, run `node popularity-service/sync-games.mjs` from the repository root and redeploy both Worker modules through Cloudflare. Pushing to GitHub alone does not redeploy the Worker or update its allowlist.

The `HASH_SECRET` binding was generated securely inside the Cloudflare deployment tool and is stored only as a Cloudflare Worker secret. Preserve it on updates (API uploads can use `keep_bindings: ["secret_text"]`). Never add a secret, API token, or local environment file to this repository. Rotating the secret can permit duplicate counts for that UTC date.

## Verification

Using Node 24 from the repository root:
- `node popularity-service/test.mjs`: SQLite trigger, simultaneous duplicate requests, different browsers/games, validation, CORS, rate limits, date window, cleanup and outage behavior.
- `node check-popularity.cjs`: browser sorting, pins, A–Z, persistence, deduplication, apps exclusion and outage playability. This machine's installed Playwright/Edge is used.

Both tests passed. A live browser successfully fetched rankings and posted a game opening; a second identical post left the D1 total at one. The test data was removed afterward and the aggregate table was confirmed empty. Daily cleanup SQL is tested locally; the scheduled Cloudflare job is configured but has not yet reached its first scheduled run.
