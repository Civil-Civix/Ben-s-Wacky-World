# GitLab Pages hosting copy

Project: https://gitlab.com/wacky-group/Wacky-project
Live site: https://wacky-project-84f094.gitlab.io/
Cloudflare: https://bens-wacky-world.pages.dev/

GitHub main remains the source of truth. `.github/workflows/gitlab-pages.yml` triggers this GitLab project's main pipeline after pushes. GitLab clones the latest GitHub main, runs packaging tests and publishes the same static package used by Cloudflare. The GitLab repository remains private; Pages access is public.

The GitLab trigger token is stored only in the GitHub Actions secret `GITLAB_PAGES_TRIGGER_TOKEN`. It expires October 25, 2027 UTC and must be renewed there before expiration. The workflow can also be run manually. It confirms pipeline creation, not completion; final deployment status is in GitLab Pipelines.

On October 25, 2026, account and popularity Workers were deployed with the exact GitLab origin added, preserving the existing GitHub and Cloudflare origins. Live account CORS tests accepted all three and rejected an unrelated origin. GitLab and Cloudflare index.html, accounts.js and games.js hashes matched. Chrome/Edge launcher checks passed for catalog, guest chat, leaderboard, Poly Track and fullscreen. Actual signed-in sessions, AI and the complete catalog have not been tested.

## Pending

Pokémon battles on GitLab still need the committed profile/theme bridge and Caddy frame-origin changes deployed to the Showdown server. SSH access was unavailable; the user chose to leave this pending. The existing Cloudflare Pokémon path remains unchanged.

Seven oversized-game fallbacks still use GitHub Pages; keep that host online. Browser-local preferences and game saves do not transfer between hostnames. Launchers are generated with `node tools/build-online-launcher.mjs`; see online-launcher.md.