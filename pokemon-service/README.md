# Ben's Wacky World — Pokémon Showdown

## Current deployment status

Setup is in progress. The game is not live yet.

- Provider: Oracle Cloud, Phoenix (`us-phoenix-1`), availability domain AD-2.
- Instance: `bens-wacky-world-pokemon`.
- Shape: Always Free-eligible `VM.Standard.A1.Flex`, 1 OCPU, 6 GB RAM.
- OS: Canonical Ubuntu 24.04 Minimal aarch64.
- Boot disk: default 46.6 GB.
- Network: `bens-pokemon-network`; subnet: `bens-pokemon-public`.
- Private address: `10.0.0.239`.
- Public address: not assigned yet; confirmation requested before public access.
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

## Remaining work

1. Complete public IP, routing, and minimum necessary firewall configuration.
2. Connect with the user's saved SSH key and verify the server's identity.
3. Install the supplied Showdown server and configure automatic startup.
4. Configure HTTPS and connect the standard Showdown client.
5. Verify two-player battles, restart recovery, and resource usage.
6. Add the verified game link to the site's catalog and publish the change.
7. Obtain the user's registered Showdown username for administrator setup.

The server runs in Oracle Cloud; GitHub Pages only serves the website.
No Showdown runtime, configuration secrets, or SSH keys belong in the
public GitHub Pages content.
