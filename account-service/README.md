# Wacky accounts
Frontend: `accounts.js`, `index.html`, `styles.css`, and the game lifecycle hooks in `app.js`.
Service: https://bens-wacky-accounts.mr-ellis1009.workers.dev
Database: bens-wacky-accounts (separate from popularity).

## Behavior
- Username/password login; usernames are case-insensitive, 3–20 letters/numbers/underscores.
- Signup passwords require at least 8 characters. No email, password recovery, or Google login.
- WackyBen is reserved and has a server-assigned Owner badge. The badge grants no administrative API powers. Its password is not in this repository.
- Profiles, circular photos, bio, and cumulative game playtime are public.
- Photos are cropped to 256 × 256, re-encoded as JPEG, and limited to 48 KiB; source upload limit 5 MB.
- Leaderboard lists all accounts in pages of 50 with a top-three podium and username search.
- Persistent login uses a Secure, HttpOnly, partitioned cookie for up to 180 days. Clearing site data, expiry, or unsupported/blocked cookies requires another login.
- Appearance and favorites/recents remain local to the browser.

## Timing
The client sends a heartbeat every 30 seconds only while a game player is open and the document is visible. Apps and Stream Hub do not count.
A server lease allows only one timer per account across tabs/devices. Sequence checks reject replay, server elapsed time bounds credit, and gaps above 65 seconds are discarded. Hidden/closed periods are excluded.
Playtime is cumulative only: no per-game history is stored. A crash or connection loss can lose the unsynced interval. These checks limit casual duplication; they cannot prove someone is actively playing or defeat a deliberately modified client.

## Security and operations
Passwords use salted scrypt (N=16384, r=8, p=5) plus a secret server pepper. This is one of the configurations in the [OWASP Password Storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The pepper is stored only as the Cloudflare `PASSWORD_PEPPER` secret. Preserve it across deployments: replacing it invalidates existing password hashes. Do not put it or passwords in Git.
Session tokens are stored hashed in D1. Profile responses exclude password hashes and session values. Login limits apply by username and IP; writes require the allowed Origin and a custom request header. Uploaded files are served with image content type and nosniff.
Daily cleanup removes expired sessions. Account uploads are bounded but storage grows with users; monitor the existing Cloudflare free-tier dashboard before traffic increases.
The parent site hosts third-party games. Their same-origin scripts are a separate trust boundary that this account feature does not fully isolate; HttpOnly protects token reads but is not a substitute for isolating all game content.

## Maintenance
From this directory:
1. `node sync-games.mjs` after changing games.json (also sync/deploy the separate popularity service).
2. `node test.mjs` for isolated local tests (Node 24 SQLite).
3. Deploy with this directory's Wrangler config, preserving the existing pepper secret and D1 binding. Run schema.sql only for initial provisioning or reviewed migrations.

`check-browser.cjs` is a LIVE integration check using locally served frontend files and a temporary QA account. It prints the exact QA account ID for removal from D1 after the check; remove only that test user (related rows cascade). It does not push or deploy the frontend.
Validated: live signup/login/logout and reload persistence; profile/photo upload/removal; cache refresh; game-only and hidden-tab timing; public profiles; owner badge; leaderboard search; existing catalog regression checks.
Frontend changes take effect on GitHub Pages after the repository is pushed and its deployment finishes.
