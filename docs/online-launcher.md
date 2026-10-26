# Online HTML launcher

October 25, 2026. Current direction: online-required launcher for the existing full site, not an offline game pack.

Build: node tools/build-online-launcher.mjs
Output: .portable/Bens Wacky World.html
Double-click the file in Windows and open it in Chrome or Edge. The file displays https://bens-wacky-world.pages.dev/ in a full-viewport frame. It does not copy or independently host the site. Live site updates appear on subsequent loads. Internet and access to the existing site/game hosts are required. No new hosting or billing was enabled.

The hosted frame preserves existing script paths and the trusted origin used by the account backend. Loading those scripts directly from file:// would instead send a null origin, which the account backend correctly rejects. No CORS or authentication policies were weakened.

Browser harness: Desktop/COdex/online-launcher-qa.cjs. Edge and Chrome passed: catalog contains 434 games, guest World chat visible, public chat/tracks/leaderboard API responses HTTP 200, account dialog opens, Poly Track reaches its menu in a nested frame, fullscreen enters/exits, no uncaught page errors. Evidence is .audit-evidence/online-launcher-msedge.png and online-launcher-chrome.png plus matching JSON reports.

Sign-in, session persistence, private chat, AI, game-save persistence and the entire game catalog have NOT been validated in this launcher. Existing browser restrictions on third-party/partitioned cookies can affect sign-in. The loading timeout offers retry/direct-site access; cross-origin frame load events cannot reliably distinguish all server error pages.

Next check: user signs into their account in the launcher; do not infer authentication success from opening the account dialog. This supersedes the local-server Windows launcher for the user's online-only use case; prior portable experiments remain available and unchanged.
