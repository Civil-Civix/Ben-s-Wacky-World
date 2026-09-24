#!/usr/bin/env bash
set -euo pipefail
# Run on the dedicated Ubuntu ARM instance after uploading the supplied server ZIP.
test "$(uname -m)" = aarch64
test -f /home/ubuntu/pokemon-showdown.zip
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y ca-certificates curl xz-utils unzip caddy git
mkdir -p /opt/node-download
cd /opt/node-download
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
node_archive=$(awk '$2 ~ /linux-arm64.tar.xz$/ {print $2}' SHASUMS256.txt)
test -n "$node_archive"
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$node_archive"
grep " $node_archive$" SHASUMS256.txt | sha256sum -c -
tar -xJf "$node_archive" -C /usr/local --strip-components=1
id showdown >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/showdown --shell /usr/sbin/nologin showdown
test ! -e /opt/showdown/pokemon-showdown
unzip -q /home/ubuntu/pokemon-showdown.zip -d /opt/showdown
mv /opt/showdown/pokemon-showdown-master /opt/showdown/pokemon-showdown
cp /home/ubuntu/showdown-config.js /opt/showdown/pokemon-showdown/config/config.js
chown -R showdown:showdown /opt/showdown
cd /opt/showdown/pokemon-showdown
sudo -u showdown /usr/local/bin/npm ci --omit=dev --no-audit --no-fund
sudo -u showdown /usr/local/bin/node build
install -m 644 /home/ubuntu/showdown.service /etc/systemd/system/showdown.service
install -m 644 /home/ubuntu/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
iptables -C INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp -m multiport --dports 80,443 -j ACCEPT
iptables-save > /etc/iptables/rules.v4
systemctl daemon-reload
systemctl enable --now showdown
systemctl enable caddy
systemctl restart caddy
systemctl --no-pager --full status showdown
