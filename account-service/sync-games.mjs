import {readFileSync,writeFileSync} from 'node:fs';
const games=JSON.parse(readFileSync(new URL('../games.json',import.meta.url),'utf8'));
const ids=[...new Set(games.map(game=>game.id))];
writeFileSync(new URL('./game-ids.mjs',import.meta.url),'// Generated from games.json; run node sync-games.mjs before deploying.\nexport default '+JSON.stringify(ids)+';\n');
console.log('Synced '+ids.length+' account timer game IDs.');
