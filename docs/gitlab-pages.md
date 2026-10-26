# GitLab Pages hosting copy

Target: https://gitlab.com/wacky-group/Wacky-project

Status: First GitLab Pages deployment succeeded. Verified origin: https://wacky-project-84f094.gitlab.io. GitHub remains the source of truth.

The root `.gitlab-ci.yml` can be committed as the initial file in the GitLab project. Each pipeline clones the current `main` branch from `Civil-Civix/Ben-s-Wacky-World`, runs the packaging tests, and publishes the same static package used by Cloudflare. GitHub remains the source of truth. The GitLab project does not need the full repository copied into it.

Runs currently require a GitLab commit or manual pipeline run. Automatic GitHub-triggered updates are not configured yet.

The package retains the seven oversized-game GitHub Pages fallbacks. GitHub Pages must remain online for those games.

After each code change:

1. Configure public Pages access while keeping the GitLab repository private, if GitLab permits it for this project.
2. Keep the exact origin above in the account and popularity services and Showdown parent/frame policies.
3. Test direct and Google Sites iframe views, artwork, game launches, account CORS, and leaderboard reads.
4. Configure automatic updates and verify a fresh GitHub change reaches GitLab Pages.

Do not switch the existing Google Sites embed until these checks pass. Existing browser-local preferences and game saves do not transfer to a different origin.
