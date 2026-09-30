# Ben's Wacky World — Pokémon Showdown

## Current deployment status

The Oracle game server and self-hosted battle client are live. All visitors
connect to this one server. Players receive temporary names without signing
in. The interface keeps battles, challenges, and teams; chat inputs, account
forms, Pokédex navigation, and replay controls are removed or hidden.

- Site: https://civil-civix.github.io/Ben-s-Wacky-World/#all (search Showdown).
- Client: https://bens-pokemon.129-146-183-45.sslip.io/battle.html
- Existing owner client (registered WackyBen login): https://bens---pokemon-129---146---183---45-sslip-io.psim.us/beta
- HTTPS server: https://bens-pokemon.129-146-183-45.sslip.io
- Administrator: registered Pokémon Showdown account `WackyBen`.

- Provider: Oracle Cloud, Phoenix (`us-phoenix-1`), availability domain AD-2.
- Instance: `bens-wacky-world-pokemon`.
- Shape: Always Free-eligible `VM.Standard.A1.Flex`, 1 OCPU, 6 GB RAM.
- OS: Canonical Ubuntu 24.04 Minimal aarch64.
- Boot disk: default 46.6 GB.
- Network: `bens-pokemon-network`; subnet: `bens-pokemon-public`.
- Private address: `10.0.0.239`.
- Public address: `129.146.183.45` (ephemeral, retained while assigned).
- AD-1 creation failed with insufficient capacity; AD-2 accepted creation.

The account must remain on Free Tier. Do not upgrade to Pay As You Go or
use trial-funded paid resources. Recheck current Always Free allowances
before changing resources.

## Local inputs

- Server archive: `C:\Users\mrell\Downloads\pokemon-showdown-master (1).zip`.
- Client archive: `C:\Users\mrell\Downloads\pokemon-showdown-client-master.zip`.
- Server staging: `.pokemon-runtime/pokemon-showdown-master/` (Git-ignored).
- The user saved the server SSH key pair in Downloads. Never commit private
  keys, copy them into the public site, or paste their contents into chat.

## Operation and verification

- Ubuntu user: `ubuntu`; SSH key stays in the user's Downloads folder.
- Runtime: `/opt/showdown/pokemon-showdown`, owned by system user `showdown`.
- Node 24; systemd services `showdown` and `caddy` are enabled at boot.
- Caddy renews HTTPS certificates and proxies to `127.0.0.1:8000`.
- Public ports: 80/443 for HTTPS and renewal, 22 for key-based SSH.
- Configuration templates are beside this README. `install.sh` is for a
  fresh installation only; it deliberately refuses an existing installation.
- Admin data: `/opt/showdown/pokemon-showdown/config/usergroups.csv`.
  Registered-account authentication is required for the administrator rank.
- Back up `config/`, `logs/`, and `databases/` privately before maintenance.
  These can contain user data; never copy them into this public repository.
- Restart: `sudo systemctl restart showdown`. Inspect status with
  `sudo systemctl status showdown caddy` and logs with
  `sudo journalctl -u showdown -n 100`.

Verified September 24, 2026: public HTTPS, two temporary guest players,
challenge/accept, three battle turns, result delivery, and a successful
second battle after restarting Showdown. The site iframe loads the beta
client and connects to this server. About 4.7 GB of RAM remained available
after the test; this is a smoke test, not a capacity/load guarantee.

Run `node pokemon-service/smoke-test.mjs` with Node 24 to repeat the public
connection test. It creates temporary guest names and an unrated battle.
It may also be copied to the server and run there if local network access
blocks the connection. No passwords are required or logged.

## Dependencies and limits

The supplied client is now a modified, self-hosted fork. Browser scripts,
game data, sprites, and battle connections use the Oracle hostname.
The guest-name service still calls the upstream Showdown assertion service
from the server. Missing artwork/audio are fetched from a fixed upstream
asset host and cached (512 MB limit); this is not an offline implementation.
DNS is supplied by sslip.io. School-device/network access remains unverified.

Guest names change on a full reload. Teams are stored in the browser;
there are no cloud accounts or cloud team backups in this client. Friends
on the same network should use Challenge a player, because Showdown's
normal matchmaking may exclude players sharing an IP. Registered owner
authentication is preserved through the existing hosted client.

### Self-hosted client maintenance

- Prepared source: `/home/ubuntu/pokemon-showdown-client-master`.
- Public build: `/srv/bww-client-v1`; entry point `/battle.html` avoids an
  earlier root redirect that some browsers cached.
- Helper service: `bww-client`, code `/opt/bww-client/client-gateway.mjs`,
  loopback port 8001; cache `/var/cache/bww-client`.
- Active proxy: `Caddyfile.selfhosted`; original config backup:
  `/home/ubuntu/Caddyfile.before-selfhosted`.
- The Google Sites wrapper adds two ancestors: `https://sites.google.com`
  and `https://www.gstatic.com`. Both must be present in the game's
  `frame-ancestors` policy along with GitHub Pages, or the nested game
  shows "refused to connect" even when it works directly on GitHub Pages.
- On a fresh extraction of the supplied client archive, run
  `node prepare-client.mjs SOURCE`, then `node finish-client.mjs SOURCE`,
  then `npm ci` and `node build` inside SOURCE. Prepare applies once;
  finish can be repeated. Do not run prepare twice on a patched tree.
- Upload deployment helpers to `/home/ubuntu/`, then run
  `sudo bash /home/ubuntu/deploy-client.sh`. This stages the client,
  refreshes the AGPL source archive, and installs the helper service and
  Caddy configuration. Review its fixed paths before reuse.
- Client source and license are at `/source.zip` and `/LICENSE`. Keep
  the source archive synchronized whenever changing the served fork.
- After `finish-client.mjs`, apply `node theme-client.mjs SOURCE` before
  building. Keep `battle-theme.css`, `theme-bridge.js`, and the Inter font
  and license beside that script (or use the repo's `../fonts` directory).
  This adds the matching cards, controls, and responsive menu layout.
- The website sends only its accent hex color and background preset to
  the game using `postMessage`. The game validates the direct parent,
  origin, and both values. Changes also update an already-open game.
  Supported presets match the site: Obsidian, Midnight, Slate, and Mocha.
  Animated site backgrounds remain paused while playing, as on the site.
- Inspect `sudo systemctl status bww-client showdown caddy` and
  `sudo journalctl -u bww-client -n 50` for operational failures.
- Run `node check-client.mjs` for browser resource/endpoint checks. For
  the three-turn guest battle test, run this on one line:
  `node smoke-test.mjs wss://bens-pokemon.129-146-183-45.sslip.io/showdown/websocket https://bens-pokemon.129-146-183-45.sslip.io/guest-name`.

Verified September 25, 2026: two browser guests challenged, accepted,
loaded animated Pokémon artwork, and exchanged moves; no console errors
were recorded during that test. Automated resource and battle checks passed.

No paid upgrade was performed. The instance uses Always Free-eligible
resources rather than trial-only capacity. Oracle availability and idle
resource reclamation can still interrupt service; this is not guaranteed
permanent hosting. If the public IP changes, update the hostname in the
Caddyfile, both game catalogs, and the test endpoint, then reload Caddy.

## Handoff

September 26 queue fix: run `node patch-matchmaking.mjs SERVER_SOURCE`,
then build the server and restart Showdown. This makes Gen 9 Random Battle
casual/unrated and permits shared-IP players and immediate rematches in
that format only. Distinct-user checks and other ladders remain unchanged.
Append `search` to the smoke-test command above to test two same-IP guests
through three turns and an immediate second match. The queue requires
another person searching the same format on this private server.
The aligned top bar lives in `battle-theme.css` under the navigation-row comment.

Goal: one shared Pokémon battle server accessible inside Ben's Wacky World.
The server, HTTPS, owner assignment, and battle-only embedded client are
configured. Remaining user check: try the new client on the school laptop. Continue maintenance in the Ben's Wacky World project using
this folder. Keep private keys and live user data outside the public repo.

The server runs in Oracle Cloud; GitHub Pages only serves the website.
No Showdown runtime, configuration secrets, or SSH keys belong in the
public GitHub Pages content.


## Profile battles � September 30, 2026

The site now opens `/profile-battle.html`. Existing `/battle.html` remains
available for the old frontend during rollout. Profile challenges use Gen 9
6v6 Random Battle: invite, accept/decline, then automatically join the same game.
The new client signs in using the site's existing authenticated profile.
A stable internal ID avoids username collisions; the client displays profile names.

The account Worker includes `battle.mjs`; apply `battle-schema.sql` before
publishing that module and the updated `worker.mjs`. Tickets expire in 60 seconds,
are bound to the connection challenge, and can be consumed only once. Invitations
expire after two minutes. An accepted invitation has 90 seconds to connect.
Banned/suspended users cannot obtain or redeem tickets. Existing connected
battles are not forcibly disconnected by a later site moderation change.

Server patch: `node patch-profiles.mjs SERVER_SOURCE`, then build and restart.
`deploy-profiles.sh` backs up the touched files and updates client/source.zip.
Set `CLIENT_ONLY=1` for client changes without rebuilding/restarting Showdown.
It expects helpers uploaded to `/home/ubuntu/`; inspect its fixed paths first.
The gateway now serves WAV audio, including the challenge notification sound.

Checks: account/AI/provider suites passed; two temporary site profiles completed
three battle turns. Two real browser sessions accepted a profile challenge,
authenticated inside the iframe, entered the same battle, and displayed profile
names. All temporary accounts from these checks were removed. The notification
WAV initially returned 404; its corrected endpoint returned 200.

`profile-smoke-test.mjs` and `profile-browser-test.mjs` create disposable accounts
and print their IDs for explicit database cleanup afterward. They do not clean
up automatically. The browser check requires Playwright (`PLAYWRIGHT_PATH` may
point to an installed package) and Microsoft Edge. Run from the repository root.
Do not run against production routinely.

Menu restoration: format selection, team selection, battle options, Teambuilder,
and the native Challenge a Player menu are restored on profile-battle.html.
Only site-profile invitation matchmaking is fixed to Gen 9 Random Battle.
Profile authentication now adds a status line instead of replacing the menu.
