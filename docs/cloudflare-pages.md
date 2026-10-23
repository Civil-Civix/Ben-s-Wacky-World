# Cloudflare Pages static build

This repository can use Cloudflare Pages Git integration with a small allowlisted static build. The script packages the site into `.wrangler/pages-static`; it does not run a backend or copy server, documentation, report or development-only files.

In Cloudflare Pages, connect the existing Git repository and set:

- **Build command:** `node tools/build-pages.mjs`
- **Build output directory:** `.wrangler/pages-static`
- **Root directory:** repository root

Run the same build locally with `node tools/build-pages.mjs`. To check the packaging rules with fixtures, run `node --test tools/build-pages.test.mjs`.

The build copies the homepage, its frontend scripts and data (including `game-ad-guard.js` for game pages that load it), and the `library`, `vendor`, `fonts`, `images`, and `licenses` directories. It fails if it encounters a file larger than Pages' 25 MiB per-asset limit unless that file is explicitly listed as a temporary fallback. The seven currently oversized files are omitted from the Pages output, and both generated game catalogs (`games.json` and the `window.WACKY_GAMES` assignment in `games.js`) point the affected game pages at the same paths on the existing GitHub Pages site:

- Minecraft 1.12.1
- Mindustry
- The Legend of Zelda: Majora's Mask
- Pokémon Diamond, Platinum, SoulSilver, and Stadium

Those game pages and their relative assets continue to load from GitHub Pages, which keeps the ROMs and Mindustry bundle same-origin with their game runtimes. This requires the GitHub Pages copy to remain available until these assets move to a host that supports them. The source `games.json` is not changed.

No `functions/` directory is packaged. The existing account and popularity Workers serve both the GitHub Pages and exact Cloudflare production origins. Accounts, chat, AI, and scores share the existing databases. Showdown also allows the Cloudflare parent in its profile/theme bridges and frame policy. Visitors may need to sign in again on the new host; browser-local game saves and preferences do not automatically move across origins.

Cloudflare references: [Git integration and build output settings](https://developers.cloudflare.com/pages/get-started/git-integration/), [Pages asset size limits](https://developers.cloudflare.com/pages/platform/limits/), and [Pages static asset serving](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Production project: `bens-wacky-world` (`https://bens-wacky-world.pages.dev`), connected to `Civil-Civix/Ben-s-Wacky-World`, branch `main`. Preview builds are disabled; only the exact production origin is authorized by the account services. GitHub Pages remains active.
