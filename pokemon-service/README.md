# Ben's Wacky World — Pokémon Showdown

## Current deployment status

The Oracle game server is live. The site catalog opens the upstream beta
client inside the game player; all visitors connect to this one server.

- Site: https://civil-civix.github.io/Ben-s-Wacky-World/#all (search Showdown).
- Client: https://bens---pokemon-129---146---183---45-sslip-io.psim.us/beta
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

The standard hosted client, login service, and graphics are provided by
Pokémon Showdown; free hostname DNS is provided by sslip.io. The classic
client blocks iframe use, so the catalog explicitly requests `/beta`.
The supplied client archive is retained as an input, not deployed as a fork.
Showdown accounts are separate from Ben's Wacky World website accounts.
Players can choose the same battle format and search, or challenge someone
on this server through Find a user.

No paid upgrade was performed. The instance uses Always Free-eligible
resources rather than trial-only capacity. Oracle availability and idle
resource reclamation can still interrupt service; this is not guaranteed
permanent hosting. If the public IP changes, update the hostname in the
Caddyfile, both game catalogs, and the test endpoint, then reload Caddy.

## Handoff

Goal: one shared Pokémon battle server accessible inside Ben's Wacky World.
The server, HTTPS, owner assignment, and embedded-client integration are
configured. Continue maintenance in the Ben's Wacky World project using
this folder. Keep private keys and live user data outside the public repo.

The server runs in Oracle Cloud; GitHub Pages only serves the website.
No Showdown runtime, configuration secrets, or SSH keys belong in the
public GitHub Pages content.
