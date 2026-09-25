#!/usr/bin/env bash
set -euo pipefail
test -f /home/ubuntu/pokemon-showdown-client-master/play.pokemonshowdown.com/caches/index-new.html
mkdir -p /srv/bww-client-v1 /opt/bww-client
node /home/ubuntu/stage-client.mjs /home/ubuntu/pokemon-showdown-client-master /srv/bww-client-v1
id bww-client >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin bww-client
install -m 644 /home/ubuntu/client-gateway.mjs /opt/bww-client/client-gateway.mjs
install -m 644 /home/ubuntu/client-gateway.service /etc/systemd/system/bww-client.service
python3 - <<'PY'
import os, zipfile
root='/home/ubuntu/pokemon-showdown-client-master'
with zipfile.ZipFile('/srv/bww-client-v1/source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for folder, dirs, files in os.walk(root):
        dirs[:]=[d for d in dirs if d not in ('node_modules','.git')]
        for f in files:
            p=os.path.join(folder,f)
            if not os.path.isfile(p) or os.path.islink(p): continue
            z.write(p,os.path.relpath(p,root))
PY
chmod -R a+rX /srv/bww-client-v1
systemctl daemon-reload
systemctl enable --now bww-client
caddy validate --config /home/ubuntu/Caddyfile.selfhosted --adapter caddyfile
cp /etc/caddy/Caddyfile /home/ubuntu/Caddyfile.before-selfhosted
install -m 644 /home/ubuntu/Caddyfile.selfhosted /etc/caddy/Caddyfile
systemctl reload caddy
systemctl is-active bww-client showdown caddy
