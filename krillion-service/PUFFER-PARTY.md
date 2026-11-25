# Puffer Party in Cloudflare Portable

Private multiplayer rooms are served at `/party` by the existing Krillion Worker. The daily leaderboard and archive are separate.

## Rules

Verified reference defaults: 2 starting hearts, 5-heart cap, 600 rarity points per extra heart, 6 seats by default (2–16 configurable), 3-second countdown, shared hidden random 10–30 second fuse. A valid unused answer always passes; the next player receives the remaining fuse with a minimum of 8 seconds. A pop starts a new fuse. Rarity awards use the existing 10/15/30/60/85/100 tier values.

Implementation choices where reference behavior was not fully observed: random initial holder, clockwise surviving-player order, one heart lost on a pop, new category after a pop, meter overflow retained below the heart cap and capped below the next award while at five hearts. Categories with no unused answers are skipped. If all saved categories are exhausted, the match ends without declaring an arbitrary winner.

## Scope and storage

Host/join by private code, host settings, real-time room updates, answer validation, elimination, spectator view for eliminated players, leave/kick between matches, host transfer, rematch, and reconnect are implemented. Public room listings, public matchmaking, ratings, and the original service's player population are not implemented.

Room state and immutable per-match answer snapshots live in a SQLite Durable Object. Answer banks are chunked rather than placed in a large single SQLite row. Browser messages contain only public room state; answer banks, player credentials, and the exact hidden fuse stay on the server. WebSocket upgrades use short-lived single-use room connection tickets. The existing guest identifier or Wacky World account ticket authenticates HTTP actions.

Production samples up to seven distinct questions across all saved real Krillion puzzle snapshots, with shuffled dates and prompt order for each start/rematch. All published saved dates are eligible; at most 21 candidate snapshots are decoded sequentially per start and retained answer JSON is capped at 24 MiB. Duplicate question text is skipped. Unavailable/private upstream questions are not invented or fetched during a match. Existing matches retain their immutable banks. Local acceptance tests use an independently assembled synthetic fixture in an isolated local database, never production player data.

## Reference and fidelity

Reference: https://krillion.io/party and https://krillion.io/faq. This is an independently implemented recreation, not the original server. Reference artwork is separately attributed in THIRD_PARTY_NOTICES.md. Do not describe unobserved mechanics or locally synthesized effects as exact reproductions.