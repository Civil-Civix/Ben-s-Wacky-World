// Apply after prepare-client and finish-client; then run the upstream build.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = process.argv[2];
if (!root) throw new Error('Usage: node theme-client.mjs CLIENT_SOURCE_DIR');
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(root,'play.pokemonshowdown.com');
const file = path.join(web,'src/panel-mainmenu.tsx');
let text = fs.readFileSync(file,'utf8');
const start = text.indexOf('\toverride render() {',text.indexOf('\trenderBackgroundCredit()'));
const end = text.indexOf('\n}\n\nexport class CCPAIntercept',start);
if (start < 0 || end < 0) throw new Error('Main menu template does not match');
text = text.slice(0,start) + `\toverride render() {
    return <PSPanelWrapper room={this.props.room} onDragEnter={this.handleDragEnter}>
      <div class="mainmenu bww-menu">
        <header class="bww-heading">
          <p class="bww-eyebrow">BEN’S WACKY WORLD</p>
          <h1>Pokémon Battles<span>.</span></h1>
          <p>Pick your team. Find your rival.</p>
        </header>
        <div class="bww-dashboard">
          <section class="bww-battle-card" aria-label="Find a battle">
            <div class="bww-card-heading"><span class="bww-icon"><i class="fa fa-bolt" aria-hidden /></span><div><h2>Find a battle</h2><p>Play someone on this server.</p></div></div>
            {this.renderSearchButton()}
          </section>
          <div class="bww-shortcuts">
            <a class="bww-tile" href="users"><span class="bww-icon"><i class="fa fa-crosshairs" aria-hidden /></span><span><strong>Challenge a player</strong><small>Have a friend’s name? Battle them directly.</small></span><i class="fa fa-arrow-right" aria-hidden /></a>
            <a class="bww-tile" href="teambuilder"><span class="bww-icon"><i class="fa fa-th-large" aria-hidden /></span><span><strong>Teambuilder</strong><small>Create and organize your teams.</small></span><i class="fa fa-arrow-right" aria-hidden /></a>
            <p class="bww-tip"><i class="fa fa-info-circle" aria-hidden /> Same Wi-Fi? Use Challenge a player.</p>
          </div>
        </div>
        <div class="bww-active">{this.renderGames()}</div>
        <div class="bww-challenges">{this.renderMiniRooms()}</div>
        <footer class="bww-footer"><span>No account needed. Your player name is in the top bar.</span><a href="/source.zip" download>Client source · AGPLv3</a></footer>
      </div>
    </PSPanelWrapper>;
  }` + text.slice(end);
fs.writeFileSync(file,text);
const css=path.join(web,'bww.css');
const old=fs.readFileSync(css,'utf8').split('/* BWW SITE THEME */')[0];
fs.writeFileSync(css,old+'\n/* BWW SITE THEME */\n'+fs.readFileSync(path.join(here,'battle-theme.css'),'utf8'));
fs.mkdirSync(path.join(web,'fonts'),{recursive:true});
for (const name of ['InterVariable.woff2','Inter-LICENSE.txt']) {
  const source = fs.existsSync(path.join(here,'../fonts',name)) ? path.join(here,'../fonts',name) : path.join(here,name);
  fs.copyFileSync(source,path.join(web,'fonts',name));
}
console.log('Applied the Ben’s Wacky World menu and control theme.');
