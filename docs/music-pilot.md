# Music pilot — Cloudflare Portable

Built November 6, 2026. No billing or hosting services enabled.

## Source and scope

The owner supplied and authorized music from Drive folders 17nwNUObAIbmNYGO0jo8skk09NoXhpz5V and 10tvBZbrFa6sHGvrP1XGG82kHbX2QjB2-. The initial catalogue has 3,764 distinct audio file IDs and display names. It stores no credentials or downloaded audio. Peter/Peters Playlist, Request a Song, Spotify and Google Slides were excluded.

This is a partial snapshot, not a live sync: folder listings were limited to 100 items, shortcuts were skipped, and traversal was capped at four subfolder levels. Some large artist folders and later root entries are therefore missing. Availability and sharing have not been verified individually for every song.

## Playback

A persistent native audio element now uses a read-only relay at /music/audio. The relay permits only catalogue IDs, passes single byte ranges for seeking, streams without buffering or storing songs, forwards no cookies or authentication, and rejects HTML responses and redirects outside approved Drive hosts. It uses the existing Worker's origin checks and rate limit. No billing or storage service was enabled.

The frontend provides play/pause, previous/next, shuffle, repeat off/all/one, a seek bar with times, volume and mute. Tracks advance automatically at the end; repeat one uses the audio element's loop behavior. Closing the music library keeps audio playing. Playback failures show an inline message and allow retry or another song.

Search, album filters, favorites and named playlists remain browser-local, not account-synced. Clearing browser data removes them. The Music tile replaces Links, retaining the desktop two-by-four grid.

## Files and release

music.js, music.css and music-library.json are included by index.html and the Pages builder (the Portable builder reads the same file list). The feature is enabled only for bens-wacky-world.pages.dev and local QA hosts. This pilot and its audio relay have not been deployed. Local preview: node tools/preview-music.mjs, then http://127.0.0.1:4337/. The production relay still needs a Cloudflare runtime check and coordinated backend/frontend release.

## Validation

Current player QA: .audit-evidence/music-native-qa.cjs, using real Drive audio through the local relay. Verified play/pause, seeking, volume/mute, playback while closed, repeat modes, shuffle, manual and automatic advance, and 390/320px layouts. Both Balatro Main Theme and 679 (feat. Monty) played and supported seeking. Backend regression suite: 18 passing tests, including relay range forwarding, credential isolation, allowlist, redirect bounds and HTML rejection.

Earlier iframe-based harnesses music-qa.cjs and music-portable-qa.cjs document the previous prototype; they are superseded for playback. Deployment has not happened and Cloudflare streaming performance/quota behavior is not yet verified.

## Credits and icon polish — November 7, 2026

Checked metadata for all 3,764 indexed files, with a larger-header pass where cover art could precede credits. 3,236 tracks have usable artist/composer credits; 528 remain explicitly labeled unavailable. Credits come from embedded audio metadata, not playlist folders. Both 679 entries credit Fetty Wap/Monty. This is metadata attribution, not an independent verification of every file.

Music labels strip emoji while preserving song IDs and saved playlists. Toolbar headphones now match neighboring 38px buttons with 19px icons; homepage icons follow the shared responsive sizes. Headphones shake only during ready playback, stop immediately on pause/buffering, and respect reduced motion. Pause glyph and player bar centering were measured in browser QA. The final harness .audit-evidence/music-polish-qa.cjs passed against the local preview. Changes remain undeployed.


## Artist browsing and shared playlists — November 7, 2026

Browse shows the top 30 credited artists by distinct song title in this imported catalogue (featured credits included; duplicate copies counted once). The complete photo checklist is docs/music-top-artists.md. Artist portrait paths are prepared in music-library.json; initials are placeholders until photographs are supplied. The ranking is for this partial imported library, not complete artist discographies.

The + Playlist control opens a themed, keyboard-accessible chooser with cover thumbnails and song counts. Playlist cover uploads accept JPEG/PNG/WebP up to 8 MB, crop to a square, and compress to a 256px JPEG under 50,000 characters. Covers are stored with playlists. Unshared lists and favorites remain browser-local.

Sharing requires an account in production. Share in chat prepares a draft in the current conversation; it never sends automatically. Chat detects trusted playlist links and opens the playlist inside Music. Anyone holding a link can listen; only its creator can update it. Shared views fetch current contents on opening and refresh every 30 seconds while visible. Song and cover edits sync with optimistic version checks. Save a copy makes an independent local playlist. Limits: 30 shared playlists per account and 200 tracks per playlist. Stale concurrent edits report a conflict and require reopening the shared link rather than overwriting someone else's edits.

### Local QA and release status

Local preview uses the same playlist handler with an isolated SQLite database at .audit-evidence/music-playlists-preview.sqlite. Preview identities are browser-local and links work only on this computer; no live accounts, chat messages or Cloudflare database were changed. Browser QA verified two separate listeners, uploaded cover propagation/removal, automatic song synchronization, recipient playback, read-only original access, saving a copy, themed chooser bounds at 320/390/768/1440px, and chat draft preservation without sending. Native playback regression checks passed. Backend tests cover authorization, unknown songs, invalid photos, quota, stale versions, concurrent edits, idempotent creation and banned creators.

Before production release: apply account-service/music-playlists.sql to the existing D1 database, verify the Worker audio relay in Cloudflare, then deploy the Worker and frontend together. These changes are still local and have not been deployed. Do not publish only the frontend: the playlist API and migration are required. Artist photographs remain to be supplied by the owner.


## Source availability and square cards — November 7, 2026

Artist portraits now use rounded-square cards instead of circles. The rest of the Music navigation and player remain intact.

Initial real-browser testing found 42 of 45 SEGA SOUND TEAM files failed; sample upstream responses were HTTP 200 HTML pages titled Google Drive - Quota exceeded. These are temporary source download limits, not proof of corrupt audio. During the later full-source check, the files recovered. A final browser run played and sought all 45 successfully, so they were retained. The app cannot prevent Drive from applying this limit again.

The source audit checked all 3,764 original entries with streamed requests, cancelling audio bodies after headers. It found 16 FLAC and nine Ogg tracks mislabeled by Drive as application/octet-stream. Their file signatures were verified, and explicit catalogue MIME overrides now let the relay serve audio/flac or audio/ogg. Browser playback and seeking passed for all 25. Arbitrary generic downloads and HTML remain rejected. One imported M3U playlist is not audio and was removed from the catalogue, leaving 3,763 entries. A single timed-out source also passed its later browser playback check. These checks verify source access for the whole catalogue and actual decoding/seek for the 71 suspect files, not full listening to every song.

On future playback failure, the player checks the relay's structured error reason. Quota-limited, inaccessible, missing, HTML-page or unsupported files are hidden from that visit's lists and queue; the reason is shown. A general network failure stays retryable and does not prune the library. No Drive originals are deleted. Stored playlist references to removed catalogue entries are filtered before display/sharing.

Repeat source audit: node tools/check-music-sources.cjs --fresh --include-unavailable. It writes .audit-evidence/music-source-audit.json and does not change the catalogue. Review failures and verify real playback before changing availability. Excluded originals and reasons are recorded in docs/music-unavailable.json. Recheck temporary failures before restoring/removing them; HTTP status 200 alone is not a playback success.

Validation: music-test.mjs covers source quota HTML, bounded error inspection, access/missing/network distinctions, generic-file rejection and verified FLAC seek responses. .audit-evidence/music-availability-qa.cjs checks hiding quota failures, keeping network failures retryable, advancing to working audio and 320/390/768/1440px layouts. .audit-evidence/music-final-playback-qa.json records 71 actual play/seek results. The initial SEGA audit is preserved separately. Changes are local only; coordinated deployment is still outstanding.


## Playlist management and browsing shelves — November 7, 2026

Local playlists can be renamed or deleted through themed dialogs. Shared names update on the existing link. Creator-only DELETE /music/playlists/:id removes the shared record, so future link reads return 404; listeners who saved independent copies retain them. The deletion dialog explains this and requires confirmation. Delete is idempotent for already-missing records. Remote viewers discard a deleted playlist on their next visible refresh. No new database migration is needed beyond the existing music-playlists.sql table.

Browse now has five horizontal, keyboard/touch/arrow-scroll shelves: top artists (30), Pop (26), Rock (18), R&B (30), and Video Games (17). All cap at 30 cards; genre shelves are curated browsing groupings using available artists, with some intentional crossovers. Video Games groups existing soundtrack folders. These groupings are saved in music-library.json under shelves. Headphones glow in the accent color and gently scale during active playback; paused/buffering playback stops the effect, and reduced-motion mode keeps a static glow.

The browser harness .audit-evidence/music-rows-qa.cjs passed row limits/single-line layout, horizontal controls, soundtrack selection, local and shared rename, deletion cancellation, shared-link deletion, pulse/pause/reduced-motion behavior, and 320/390/768/1440px widths. Backend tests passed creator-only deletion, deleted link reads, idempotency and independent-copy preservation. Current changes remain local and undeployed.


## Release preparation — November 8, 2026
Community uploads postponed. No Google credentials or upload capability ship in this release. Song flags remain, with account-required reports and owner-only dismissal/removal; blocked songs cannot stream through the relay. Removed all 11 entries in the [Ai Songs] collection; Drive originals unchanged. Apply music-playlists.sql and music-reports.sql before deploying. Production verification pending.

Release status: music database tables created and Worker version 09180ec7-9641-4f06-8cd7-6efd0c9f2f09 deployed on November 8. Frontend release follows through the existing Cloudflare Pages Git integration. Upload prototype files remain local and are excluded from this release.
