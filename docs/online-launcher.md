# Online HTML launcher

October 25, 2026. Current direction: online-required launcher for the existing full site, not an offline game pack.

Build: node tools/build-online-launcher.mjs
Outputs:
- .portable/Bens Wacky World - Cloudflare.html → https://bens-wacky-world.pages.dev/
- .portable/Bens Wacky World - GitLab.html → https://wacky-project-84f094.gitlab.io/
- .portable/Bens Wacky World.html → compatibility alias for the Cloudflare launcher

Double-click either named file in Windows and open it in Chrome or Edge. Each file displays its selected site in a full-viewport frame. The compatibility alias continues to use Cloudflare. These launchers do not copy or independently host the site. Live site updates appear on subsequent loads. Internet and access to the selected site and game hosts are required. No new hosting or billing was enabled.

The hosted frame preserves existing script paths and the trusted origin used by the account backend. Loading those scripts directly from file:// would instead send a null origin, which the account backend correctly rejects. No CORS or authentication policies were weakened.

Browser harness: Desktop/COdex/online-launcher-qa.cjs (Cloudflare URL); GitLab was checked with a separate temporary copy pointed at its named launcher. Both hosts returned anonymous HTTP 200 for `/`, `/accounts.js`, and `/games.js`; the SHA-256 hashes matched across hosts for all three files. GitLab Edge and Chrome QA passed: catalog contains 434 games, guest World chat is visible, public chat/tracks/leaderboard API responses return HTTP 200, account dialog opens, Poly Track reaches its menu in a nested frame, fullscreen enters/exits, and no uncaught page errors occurred. Anonymous `/me` returns HTTP 401 as expected. GitLab proof: .audit-evidence/online-launcher-gitlab-msedge.png and online-launcher-gitlab-chrome.png with matching JSON reports; a separate Edge retry is in online-launcher-gitlab-retry-msedge.png and its JSON report. Existing Cloudflare proof is .audit-evidence/online-launcher-msedge.png and online-launcher-chrome.png plus matching JSON reports.

Sign-in, session persistence, private chat, AI, game-save persistence and the entire game catalog have NOT been validated in this launcher. Existing browser restrictions on third-party/partitioned cookies can affect sign-in. The loading timeout offers retry/direct-site access; cross-origin frame load events cannot reliably distinguish all server error pages.

Next check: user signs into their account in the launcher; do not infer authentication success from opening the account dialog. This supersedes the local-server Windows launcher for the user's online-only use case; prior portable experiments remain available and unchanged.
