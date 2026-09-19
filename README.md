# Ben's Wacky World

Static desktop game and app site. Current repository: `C:\Users\mrell\OneDrive\Documents\GitHub\Ben's Wacky World`. The older Desktop Wacky Games folder is not used for development.

## Open locally

Run **Start Local.cmd** from this repository, then open **http://127.0.0.1:4173**. Keep its window open. If an older preview is running from another folder, stop that preview first. Node.js is required. GitHub Pages can serve the static site without a build step.

## Included

- Games from Noah's supplied files, with duplicate titles excluded. See games.json for the current catalog.
- 16 Seraph apps in their own tab. Seraph games remain excluded.
- Six text-only cards per desktop row, with search and an in-page player.
- Favorites and Recents saved locally in the browser. Apps do not enter these game collections.
- Reload, game-only fullscreen, and Close controls.
- Home with locally hosted Inter Bold, typing and ripple animation, and a four-by-two tile layout.
- Appearance settings, custom accent color (default #8B7BFF), background themes, and falling snow. Reduced-motion preferences are respected.

## Game checks and ads

See [GAME-AUDIT.md](GAME-AUDIT.md) for complete results. Open **http://127.0.0.1:4173/game-audit-review.html** while the local preview is running to check uncertain games. Working/broken review marks stay in that browser and do not remove entries.

All 405 original entries received a short browser loading check. Confirmed missing-asset failures were retried and reviewed before being hidden. Working-looking and uncertain entries remain. Appears-loaded is not a full gameplay test.

Known embedded ad scripts, AdSense placements, and injected ad sidebars were removed. Modified Flash loaders were replaced with the local emulator. Local game documents block known ad requests and popup windows. Ads within externally hosted embedded pages cannot be universally removed here.

`disabled-games.json` preserves hidden catalog entries; their source files remain. `.audit-backups/` contains original HTML and the previous catalog, and `.audit-evidence/` contains local screenshots. Both folders are ignored by Git. The importer respects disabled IDs; importing original source HTML again will require repeating the ad cleanup and checking the results.

## Files

- `index.html`, `app.js`, `styles.css`: homepage, catalogs, player, and shared layout.
- `home.js`, `appearance.js`: heading animations and saved appearance settings.
- `games.json` / `games.js`, `apps.json` / `apps.js`: catalogs.
- `library/noah/games/`: supplied game pages.
- `library/seraph-apps/`: apps and local emulator files.
- `game-ad-guard.js`: source for the protection embedded in local game pages.
- `game-audit-review.html`: manual review page.
- `game-audit-results.json`, `GAME-AUDIT.md`: audit evidence and summary.
- `licenses/`: supplied license notices.
- `ADDING-IMAGES.md`: how to map your own artwork to game IDs.

Some games download large files from outside servers. Local hosting does not make them offline games. External outages, blocked embedding, and browser differences can still affect them.

## Handoff

Current goal: keep usable games, hide only confirmed failures, and remove identifiable ads. Automated checks and local ad cleanup are complete; uncertain games need manual review. Continue in this GitHub repository. These audit changes have not been committed or pushed.


## Background effects
Settings → Appearance offers None, Falling snow, Matrix, Constellation, Topography, and Starfield. Each follows the accent color, with a subtle page tint and a soft homepage title spotlight. Animate background pauses motion while retaining the selected design. Choices are saved locally; animations pause during gameplay and in hidden tabs. New effects are original lightweight implementations inspired by the supplied Noah theme options.
