# Ben's Wacky World

A static game site with accounts, Chat, Ben AI, appearance settings, and profile-linked Pokémon battles. GitHub Pages serves the frontend without a build step.

## Open locally

Run **Start Local.cmd** from this folder and open **http://127.0.0.1:4173**. Node.js is required. Keep the preview window open while using the site.

## Repository map

| Location | Contents |
| --- | --- |
| Root HTML, CSS and JavaScript | Live website: navigation, games, accounts, Chat, AI, appearance and player |
| `games.json`, `games.js`, `game-images.json`, `home-quotes.json` | Active site content |
| `disabled-games.json` | Entries intentionally excluded from reimporting |
| `images/`, `fonts/`, `library/`, `vendor/` | Site assets, game files and required third-party runtimes |
| `account-service/` | Cloudflare backend for accounts, Chat, groups, AI and moderation |
| `pokemon-service/` | Pokémon server integration |
| `popularity-service/` | Game popularity backend |
| `tools/` | Maintenance, imports, cleanup utilities and browser checks |
| `reports/` | Historical audit, import and validation results |
| `docs/` | Guides, audit notes and development handoff |
| `docs/previews/` | Historical UI screenshots (not used by the live site) |
| `licenses/` | Third-party license notices |

## Guides

- [Current development handoff](docs/SITE-HANDOFF.md)
- [Adding game artwork](docs/ADDING-IMAGES.md)
- [Game audit notes](docs/GAME-AUDIT.md)
- [Quote review](docs/QUOTE-REVIEW.md)
- [Backend setup](account-service/README.md)
- [Maintenance tools](tools/README.md)

The manual [game audit review](game-audit-review.html) remains at its existing URL. Its browser scripts and generated review data are kept in the root to preserve that page.

## Working on the site

Edit frontend files, check the change locally, then commit and push to publish through GitHub Pages. Backend changes require a separate Cloudflare or Pokémon server deployment; pushing website files does not deploy those services.

Appearance preferences are saved per browser. First-time defaults are Midnight, orange and Halloween. Effects support speed up to 5× and amount from 0.25× to 3×. Chat supports the main room, DMs and groups of up to 10 people; messages expire after 24 hours.

## Local-only folders

`.audit-evidence/`, `.audit-backups/`, `.pokemon-runtime/`, caches, dependencies and secret environment files are ignored by Git. They are intentionally retained locally. `library/seraph-apps/storage/` contains shared game runtimes even though Apps was removed from navigation; do not remove it as unused app clutter.

Historical reports and screenshots are reference material, not current test results. Some games require outside servers and cannot work fully offline.
