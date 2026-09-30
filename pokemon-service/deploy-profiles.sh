#!/usr/bin/env bash
set -euo pipefail
root=/opt/showdown/pokemon-showdown
client=/home/ubuntu/pokemon-showdown-client-master/play.pokemonshowdown.com
site=/srv/bww-client-v1
if [ "${CLIENT_ONLY:-0}" != "1" ]; then
if [ ! -f "$root/server/users.ts.before-bww-profiles" ]; then cp "$root/server/users.ts" "$root/server/users.ts.before-bww-profiles"; fi
node /home/ubuntu/patch-profiles.mjs "$root"
cd "$root"
sudo -u showdown /usr/local/bin/node build
fi
for target in "$client" "$site"; do
 cat /home/ubuntu/profile-bridge.js /home/ubuntu/theme-bridge.js > "$target/bww-profile.js"
 cat "$target/bww.css" /home/ubuntu/profile-client.css > "$target/bww-profile.css"
done
python3 - <<'PYCODE'
from pathlib import Path
import re,os,zipfile
site=Path('/srv/bww-client-v1')
f=site/'index.html';s=f.read_text();s=re.sub(r'/bww.js(?:\?v=[^" ]*)?', '/bww-profile.js?v=20260930-restored-menu-2',s);s=re.sub(r'/bww.css(?:\?v=[^" ]*)?', '/bww-profile.css?v=20260930-restored-menu-2',s);(site/'profile-battle.html').write_text(s);Path('/home/ubuntu/pokemon-showdown-client-master/play.pokemonshowdown.com/profile-battle.html').write_text(s)
root='/home/ubuntu/pokemon-showdown-client-master'
with zipfile.ZipFile(site/'source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for folder,dirs,files in os.walk(root):
  dirs[:]=[d for d in dirs if d not in ('node_modules','.git')]
  for name in files:
   p=os.path.join(folder,name)
   if os.path.isfile(p) and not os.path.islink(p):z.write(p,os.path.relpath(p,root))
PYCODE
if [ ! -f /home/ubuntu/Caddyfile.before-profile-route ]; then cp /etc/caddy/Caddyfile /home/ubuntu/Caddyfile.before-profile-route; fi
python3 - <<'PYCODE'
from pathlib import Path
import re
p=Path('/etc/caddy/Caddyfile');s=p.read_text()
policy=re.search(r'header Content-Security-Policy ([^\n]+)',s).group(1)
if 'handle /profile-battle.html {' not in s:
 s=s.replace('    handle /guest-name {',"""    handle /profile-battle.html {
        header Content-Security-Policy BWW_POLICY
        header X-Content-Type-Options nosniff
        root * /srv/bww-client-v1
        file_server
    }
    handle /bww-profile* {
        root * /srv/bww-client-v1
        file_server
    }
    handle /guest-name {""")
p.write_text(s.replace("BWW_POLICY",policy))
PYCODE
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
if [ "${CLIENT_ONLY:-0}" != "1" ]; then systemctl restart showdown; fi
systemctl is-active showdown caddy bww-client
