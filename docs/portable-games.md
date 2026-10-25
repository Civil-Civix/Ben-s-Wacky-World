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

Choose Windows or Chromebook before packaging the launcher. Configure the portable UI's optional online services and offline messaging, test saves across restarts, and decide distribution/update hosting. This is a prepared game-pack preview, not an end-user portable release.

## Startup verification

All twelve imports reached their startup screen with external HTTP requests blocked and no missing local files or uncaught JavaScript errors. Screenshots and logs are saved in .audit-evidence/bundled/. Hill Climb's split assets are streamed locally; Gambonanza's WebAssembly MIME type is corrected. Gambonanza still logs an upstream missing Steam integration but reaches its menu. Twitch integration, multiplayer and telemetry are not offline features. Full gameplay and save persistence remain release checks.
