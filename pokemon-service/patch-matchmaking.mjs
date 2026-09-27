// Private, casual Gen 9 Random Battle queue. Other ladders retain upstream checks.
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('Usage: node patch-matchmaking.mjs SERVER_SOURCE');
const formats = path.join(root, 'config/formats.ts');
let text = fs.readFileSync(formats, 'utf8');
const name = 'name: "[Gen 9] Random Battle",';
if (!text.includes(name)) throw new Error('Random Battle format not found');
if (!text.includes(name + '\n\t\trated: false, // BWW casual queue')) {
  text = text.replace(name, name + '\n\t\trated: false, // BWW casual queue');
  fs.writeFileSync(formats, text);
}
const file = path.join(root, 'server/ladders.ts');
text = fs.readFileSync(file, 'utf8');
const marker = '\t\tif (Config.noipchecks) {';
if (!text.includes('// BWW casual matchmaking')) {
  if (!text.includes(marker)) throw new Error('Matchmaking patch point not found');
  text = text.replace(marker, `\t\t// BWW casual matchmaking: shared Wi-Fi and repeat opponents are welcome.
\t\t// The distinct-user check above still prevents matching a user with themselves.
\t\tif (formatid === 'gen9randombattle' && Dex.formats.get(formatid).rated === false) {
\t\t\treturn true;
\t\t}

${marker}`);
  fs.writeFileSync(file, text);
}
console.log('Applied casual Random Battle matchmaking; build and restart Showdown to activate.');
