// Apply after prepare-client, before building. Safe to repeat on the prepared tree.
import fs from 'node:fs';
import path from 'node:path';
const web = path.join(process.argv[2], 'play.pokemonshowdown.com');
const menu = path.join(web,'src/panel-mainmenu.tsx');
let text = fs.readFileSync(menu,'utf8');
if (!text.includes('class="bww-challenges"')) text = text.replace('{this.renderSearchButton()}','{this.renderSearchButton()}\n        <div class="bww-challenges">{this.renderMiniRooms()}</div>');
fs.writeFileSync(menu,text);
const chat = path.join(web,'src/panel-chat.tsx');
text = fs.readFileSync(chat,'utf8');
const marker = '\t\tconst userListWidth = room.width < 550 ? 0 : 146;';
const patch = '\t\tif (room.pmTarget) return <PSPanelWrapper room={room}><div class="bww-invitation">{this.renderControls()}</div></PSPanelWrapper>;\n';
if (!text.includes('class="bww-invitation"')) {
  if (!text.includes(marker)) throw new Error('Challenge panel patch does not match');
  text = text.replace(marker,patch+marker);
}
fs.writeFileSync(chat,text);
const css = path.join(web,'bww.css');
text = fs.readFileSync(css,'utf8');
if (!text.includes('/* battle invitations */')) text += `
/* battle invitations */
button[data-href^="dm-"],button[data-href^="useroptions-"],.maximizebutton,.minimizebutton {display:none!important}
.bww-challenges {color:#222} .bww-challenges .mini-window {margin:16px 0}
.bww-invitation {padding:10px;background:#fff}
`;
fs.writeFileSync(css,text);
