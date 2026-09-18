# Wacky Games

Local desktop game catalog using Noah’s supplied games. Seraph has been removed for now; the original ZIP in Downloads remains untouched. The repository is saved in `C:\Users\mrell\OneDrive\Desktop\COdex\Wacky Games`.

## Open locally

Double-click **Start Local.cmd**, keep that window open, and open **http://127.0.0.1:4173** in your desktop browser. Node.js must be installed (it is available on this computer). Stop the server with Ctrl+C in its window. If a preview is already running, use its address without starting another copy.

## Included

- 405 catalog entries, with 12 duplicates skipped. The first encountered copy is kept. Comparison ignores case, punctuation, spacing, and known spelling variants. Sequels and distinct editions remain separate.
- Searchable All, Favorites, and Recents views; six cards per desktop row; purple #8B7BFF accents and hover highlights. Favorites are toggled inside the player. Favorites and recents are stored locally in this browser, without a database.
- Six approximately 280 x 175 pixel cards per row at a 1920 pixel desktop width.
- An in-page player with Favorite, Reload, Fullscreen, and Close. Closing unloads the game and retains search and scroll position. Reload restarts the game page but does not erase its saved progress.
- Noah’s game launch files. Seraph games and shared runtimes were removed. Source apps and catalog thumbnails were not imported.
- Original source license files under `licenses/`; upstream game notices remain in the game files.

## Validation and limitations

All 405 remaining launch files exist; the catalog was checked again after removing Seraph. Catalog IDs and launch paths are unique. Search, empty results, scrolling, opening, reloading, fullscreen, and closing were exercised in a local desktop browser; keyboard gameplay was previously verified in 2048 before Seraph was removed. Catalog and player screenshots were visually reviewed. This is not a play-through or compatibility certification of all 405 remaining games.

Some supplied games download additional content from outside servers. Running the site locally does not make those games available offline. Outside servers can fail or block embedding. Browser security also prevents reliably detecting every error inside those games.

The source's Doom 3 entry pointed to a folder rather than a supplied game file and was omitted. Two remaining games contain missing script or stylesheet references in the supplied sources: Roulette Hero and Hextrix. Their entries remain available, but they may not work completely. Details are in `source-issues.json`. Missing optional images and links are recorded separately in `import-report.json`.

## GitHub Pages status

The page uses static HTML, CSS, and JavaScript, with relative paths for project hosting. A local Git repository is initialized on `main`. Nothing has been committed, pushed, or published.

The project is approximately 528 MB with Noah games and Seraph apps, below GitHub Pages’ published-site size limit. Individual games still require compatibility checks before publication. No deployment was configured.

## Files

- `index.html`, `styles.css`, `app.js`: catalog and player.
- `games.json`, `games.js`: game titles and local launch paths.
- `library/`: imported game files and required game runtimes.
- `server.cjs`, `Start Local.cmd`: local preview.
- `source-inventory.json`, `import-report.json`, `source-issues.json`: import records and known missing files.
- `inspect_sources.py`, `import_games.py`, `verify-library.py`: import and verification helpers for the supplied ZIP locations. Import defaults to Noah only; Seraph requires the explicit `--include-seraph` option.
- `check-ui.cjs`: browser checks using the Codex-bundled browser testing package on this computer.

## Handoff

Goal: a barebones desktop game site eventually hosted on GitHub Pages. Decisions: blank cards until artwork is mapped, searchable All/Favorites/Recents views, Games sidebar, in-page player controls, first copy wins for duplicates, all development local. Current work: catalog and player implemented and checked; Seraph removed at the user’s request. Remaining work: address incomplete source games, and verify individual game compatibility before publishing. Continue in this Wacky Games folder for the next task.

## Adding artwork
See ADDING-IMAGES.md for instructions and every game ID. Put artwork in images/ and map IDs to paths in game-images.json. No artwork is included by default.

## Appearance settings
Open Settings in the left sidebar to choose Midnight, Obsidian, Slate, or Mocha; select an accent preset or custom color; and turn falling snow on or off. Changes are saved in this browser. Snow is enabled by default, except when the system requests reduced motion; it can be enabled explicitly in Settings. Animation pauses during gameplay and when the page is hidden. No game artwork is added.

## Homepage
The root address now opens Home, with Ben's Wacky World typed once per page load in locally hosted Inter Bold. The heading remains after the animation ends. The two rows of four boxes contain Games first, Apps second, and Settings last; the five unused boxes are blank and inactive. The Home sidebar icon returns here; Games uses a controller and Settings a gear. Direct #all, #favorites, #recents, and #settings links still work. Reduced-motion preferences show the complete heading immediately.

## Apps and homepage ripple
Apps is available beside Games on Home and in the sidebar. It contains the 16 supplied Seraph apps as searchable, text-only cards with six columns on desktop. Apps open in the viewer with Reload, Fullscreen, and Close; they do not enter game Favorites or Recents. Files are in library/seraph-apps. Some apps depend on external services. The homepage title types once, then runs a subtle staggered ripple; reduced-motion preferences suppress both animations. Seraph games remain excluded.
