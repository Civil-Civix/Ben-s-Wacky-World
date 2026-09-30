# Ben’s Wacky World — September 30, 2026

## Current goal and decisions
Connect Pokémon Showdown to existing profiles, then improve the current site's
spacing, consistency and speed. Keep the dark style/accent colors. Only Gen 9
6v6 Random Battle; no team building or new social modes. Frontend publishing
remains the owner's normal GitHub push workflow.

## Completed
- Profile Challenge invitations, accept/decline/cancel, authenticated game entry
  and profile display names. Account Worker and Oracle game changes are deployed.
- Profile details use a clearer two-column form, full-width banner/bio controls,
  and separate status/favorite-game controls above Appearance.
- Shared spacing, control sizing, focus states, mobile home tiles, and wrapping
  game filters. The five main pages fit desktop and narrow phone widths.
- Search titles are normalized once, and rapid typing is coalesced into updates.
- Offscreen cards use content visibility. Random artwork cycles only while
  visible, uses at most eight artwork candidates, and respects data saving.
- The artwork map can use browser caching. Background animation pauses behind
  Chat and AI, where it is covered by the page.

## Files and locations
This document is in the confirmed Ben's Wacky World repository, alongside
app.js, styles.css, index.html, battles.js and background-effects.js.
Account backend: account-service/. Game server/client helpers: pokemon-service/.
Local-only screenshots/checks: .audit-evidence/ (ignored by Git).
See pokemon-service/README.md for deployed server paths and battle checks.

## Verification and limits
Account, AI, provider, syntax and diff checks passed. Live battle and browser
profile flow verified with disposable accounts, then accounts removed. Local
layout checks cover Home, Games, Settings, Chat and AI at 1365px and 390px.
No Lighthouse/Core Web Vitals score is claimed; the dedicated tracing tool was
not available. This is a targeted site-wide polish, not a complete code rewrite.

## Follow-up
Push the remaining frontend changes through the normal GitHub workflow and try
one challenge with another person. Largest future loading opportunity: several
older PNG cards (Gang Beasts ~1.97 MB, Among Us ~1.58 MB, Yohoho ~1.27 MB) could
have separately optimized thumbnails. Original artwork has not been modified.
Continue in this same repository/project for further optimization.
