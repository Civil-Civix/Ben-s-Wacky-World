# Portable game pack

Prepared October 24, 2026 in the existing Ben's Wacky World project.

## Build

- Run `node tools/build-portable.mjs --download` to download pinned, integrity-checked source assets and build the preview.
- Run `node tools/build-portable.mjs --check` to verify local assets without downloading or rebuilding.
- Run `node tools/build-portable.mjs` to rebuild from the existing local files.
- Preview output: `.portable/site/`. Serve this directory over localhost, not file://.

The preview catalog includes Poly Track and twelve requested imports: Superflight, Reincarnage, Among Us, DEEEER Simulator, Hill Climb Racing, Trees Hate You, Gambonanza, RimWorld and FNAF 1–4. Their game assets resolve inside the site. Among Us multiplayer, shared leaderboards, accounts, AI and chat still need online services. Local startup testing does not certify every level or multiplayer.

## Hosting boundary

Downloaded files are in `library/bundled/`, ignored by Git and excluded from the regular Pages build. The pinned asset inventory is `tools/portable-games.json`; modified launchers and bundled JSZip 3.10.1 with its license are in `tools/portable-overrides/`. Each game has SOURCE.json attribution. The pack is approximately 3 GiB and cannot fit GitHub Pages' 1 GB published-site limit. Live catalog game sources stay unchanged until a separate hosting decision; the five reported games are removed from both catalogs. No new paid storage or service was enabled.

## Remaining release work

Windows was selected. The browser launcher is packaged and tested. Configure the portable UI's optional online services and offline messaging, test saves across restarts, and decide distribution/update hosting. This is a prepared game-pack preview, not an end-user portable release.

## Startup verification

All twelve imports reached their startup screen with external HTTP requests blocked and no missing local files or uncaught JavaScript errors. Screenshots and logs are saved in .audit-evidence/bundled/. Hill Climb's split assets are streamed locally; Gambonanza's WebAssembly MIME type is corrected. Gambonanza still logs an upstream missing Steam integration but reaches its menu. Twitch integration, multiplayer and telemetry are not offline features. Full gameplay and save persistence remain release checks.

## Windows launcher

Run node tools/package-windows.mjs on Windows x64 after building the portable site. This bundles the current Node executable and its version-matched license; players do not need Node installed. The complete output is .portable/. Double-click Start Bens Wacky World.cmd there. Keep the window open while playing; Q then Enter stops it. Copy the entire folder when distributing it.

The server binds only to 127.0.0.1:48763 and keeps a fixed origin for browser saves. It supports streamed assets, HEAD and byte-range requests. Automated checks cover path traversal, host restrictions, missing files and unsupported methods. Browser QA confirmed the home page, 13-game catalog, localStorage retention across server restart, and clean shutdown. This storage check is not a full per-game save test. Do not run two packs simultaneously; another program using the port must be closed first.

Game saves belong to the chosen browser profile on that PC. Moving the folder to a different PC does not transfer browser saves. No automatic updater is included. Online service integration remains unfinished.

## Single-file HTML launcher experiment (October 25, 2026)

Build with node tools/build-html-launcher.mjs after downloading the pinned game pack. Output: .portable/Bens Wacky World HTML Preview.html. Open the HTML file directly in the browser and press Play FNAF 1. No local server is involved. This is one game, not the full Wacky World site.

The HTML embeds CSS, JSZip and the game runtime. The approximately 167 MB game archive is fetched in parts from the pinned genizy/fnaf GitHub source. The previous jsDelivr source returned HTTP 403 during testing; direct GitHub fetching is a prototype source, not the proposed production hosting plan. No R2 resources, paid service or live deployment were created.

Actual file:// browser testing in Edge reached the FNAF menu and Night 1. The game wrote its freddy localStorage key, and that value survived reopening the file. A synthetic storage key also survived reload. This does not prove completing a night and restoring later progress, browser restart persistence, other browsers or managed school devices. Moving/renaming the HTML can change file-origin storage behavior. Failed downloads display a readable error. The runtime script has a separate error handler; build checks validate embedded JavaScript and reject leftover external script tags.

Evidence: .audit-evidence/html-launcher.png and html-launcher-playing.png. Follow-up: test Continue after real saved progress, then select production asset hosting and expand the catalog. Chat, accounts and multiplayer have not been integrated into this HTML preview.
