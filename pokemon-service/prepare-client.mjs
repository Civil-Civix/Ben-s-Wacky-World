// Apply the small, reproducible battle-only fork to the supplied AGPL client.
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('Usage: node prepare-client.mjs CLIENT_SOURCE_DIR');
const web = path.join(root, 'play.pokemonshowdown.com');
const host = 'bens-pokemon.129-146-183-45.sslip.io';
function edit(file, from, to) {
  const p = path.join(web, file);
  const source = fs.readFileSync(p, 'utf8');
  if (!source.includes(from)) throw new Error(`Patch does not match: ${file}`);
  fs.writeFileSync(p, source.replace(from, to));
}
const routes = JSON.parse(fs.readFileSync(path.join(root, 'config/routes.json')));
routes.client = host;
fs.writeFileSync(path.join(root, 'config/routes.json'), JSON.stringify(routes, null, 2));
fs.writeFileSync(path.join(root, 'config/config.js'), `var Config = {
  version: 'bww-1', bannedHosts: [], whitelist: [], customcolors: {},
  defaultserver: {id: 'bww', host: '${host}', port: 443, httpport: 80, registered: false},
  testclient: true
};\n`);
// Avoid an account form: each browser tab receives a temporary guest name.
edit('src/client-connection.ts', "let url = '/~~' + PS.server.id + '/action.php';", "let url = '/guest-name';");
edit('src/client-main.ts', "this.updateLogin({ name, needsPassword: true });", "this.updateLogin({ error: 'That name is reserved. Please choose a different guest name.' });");
edit('src/client-main.ts', "this.updateLogin({ name, needsGoogle: true });", "this.updateLogin({ error: 'That name is reserved. Please choose a different guest name.' });");
edit('src/client-main.ts', "\t\tthis.addRoom({\n\t\t\tid: 'rooms' as RoomID,\n\t\t\ttitle: \"Rooms\",\n\t\t\tautofocus: false,\n\t\t});\n\t\tthis.rightPanel = this.rooms['rooms']!;", '');
// Retain upstream battle, challenge, team selection, and teambuilder behavior.
const menuPath = path.join(web, 'src/panel-mainmenu.tsx');
let menu = fs.readFileSync(menuPath, 'utf8');
const start = menu.indexOf('\toverride render() {', menu.indexOf('\trenderBackgroundCredit()'));
const end = menu.indexOf('\n}\n\nexport class CCPAIntercept', start);
if (start < 0 || end < 0) throw new Error('Main menu patch does not match');
menu = menu.slice(0, start) + `\toverride render() {
    return <PSPanelWrapper room={this.props.room} onDragEnter={this.handleDragEnter}>
      <div class="mainmenu bww-menu">
        <h1>Ben’s Pokémon Battles</h1>
        <p>One server. Pick a format and battle another player.</p>
        {this.renderGames()}
        {this.renderSearchButton()}
        <div class="menugroup">
          <p><a class="mainmenu2 mainmenu button" href="teambuilder">Teambuilder</a></p>
          <p><a class="mainmenu3 mainmenu button" href="users">Challenge a player</a></p>
        </div>
        <p class="bww-help">Friends on the same Wi-Fi: use Challenge a player.<br />Your temporary player name appears above.</p>
        <p class="bww-source"><a href="/source.zip" download>Client source (AGPLv3)</a></p>
      </div>
    </PSPanelWrapper>;
  }` + menu.slice(end);
fs.writeFileSync(menuPath, menu);
// Hide chat inputs and account/replay controls, preserving battle logs and moves.
fs.writeFileSync(path.join(root, 'config/head-custom.html'), '<link rel="stylesheet" href="/bww.css">');
edit('index-new.html', '<!-- build-tools/news-embed.php -->', '');
edit('index-new.html', '<script defer src="/js/client-core.js?">', '<script defer src="/js/client-core.js?">');
edit('index-new.html', '</body>', '<script defer src="/bww.js"></script></body>');
fs.writeFileSync(path.join(web, 'bww.css'), `
body { background: #171c32 !important; }
.bww-menu { position:relative !important; max-width:540px; margin:32px auto !important; padding:24px !important; color:#eef1ff; }
.bww-menu h1 { font-size:28px; } .bww-help { line-height:1.6; }
.bww-source { font-size:12px; } .bww-source a { color:#b9c9ff; }
.mainmenu-mini-windows,.mainmenufooter,.mainmenu-footer,.chatbox,.chat-log-add,.pm-log,.pm-log-add,
#roomtab-rooms,#roomtab-lobby,#roomtab-staff,[data-href="register"],a[href="register"],a[href="login"],
button[name="saveReplay"],button[name="uploadReplay"],button[value="/savereplay"],button[data-cmd="/savereplay"],
a[href*="replay.pokemonshowdown"],a[href*="dex.pokemonshowdown"],a[href*="smogon.com"],
button[data-href="options"] { display:none !important; }
`);
fs.writeFileSync(path.join(web, 'bww.js'), `
(() => {
  let naming = false;
  const random = crypto.getRandomValues(new Uint32Array(2));
  const name = 'BWW' + random[0].toString(36) + random[1].toString(36).slice(0,4);
  const timer = setInterval(() => {
    if (typeof PS === 'undefined' || !PS.user?.challstr) return;
    for (const id of ['rooms','lobby','staff','news']) {
      if (PS.rooms[id]) PS.leave(id);
    }
    if (!PS.user.named && !naming) { naming = true; PS.user.changeName(name); }
    if (PS.user.named) clearInterval(timer);
  }, 300);
})();
`);
console.log('Prepared battle-only client source. Run node build next.');
