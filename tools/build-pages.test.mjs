import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, truncate } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPages } from './build-pages.mjs';

const oversizedFiles = [
  'library/imported-20260919/mindustry/mindustry-part-6.js',
  'library/noah/games/164.html',
  "library/seraph-games/majorasmask/Legend of Zelda, The - Majora's Mask (USA).zip",
  'library/seraph-pokemon/pokemondiamond/pokemon-diamond.zip',
  'library/seraph-pokemon/pokemonplatinum/pokemon-platinum.zip',
  'library/seraph-pokemon/pokemonsoulsilver/pokemon-soulsilver.zip',
  'library/seraph-pokemon/pokemonstadium/Pokemon Stadium (USA) (Rev A).zip',
];
const gameUrls = {
  minecraft1121: 'library/noah/games/164.html',
  mindustry: 'library/imported-20260919/mindustry/index.html',
  majorasmask: 'library/seraph-games/majorasmask/index.html',
  pokemondiamond: 'library/seraph-pokemon/pokemondiamond/index.html',
  pokemonplatinum: 'library/seraph-pokemon/pokemonplatinum/index.html',
  pokemonsoulsilver: 'library/seraph-pokemon/pokemonsoulsilver/index.html',
  pokemonstadium: 'library/seraph-pokemon/pokemonstadium/index.html',
};

async function fixture(t, games = gameUrls) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bww-pages-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'index.html'), '<h1>site</h1>');
  const entries = Object.entries(games).map(([id, url]) => ({ id, url }));
  await writeFile(path.join(root, 'games.json'), JSON.stringify(entries));
  await writeFile(path.join(root, 'games.js'), `window.WACKY_GAMES = ${JSON.stringify(entries)};`);
  await writeFile(path.join(root, 'game-ad-guard.js'), 'guard');
  await writeFile(path.join(root, 'server.cjs'), 'backend');
  await writeFile(path.join(root, 'README.md'), 'docs');
  await writeFile(path.join(root, 'reports.json'), 'reports');
  await mkdir(path.join(root, 'library'), { recursive: true });
  await writeFile(path.join(root, 'library', 'small.html'), 'game');
  for (const relative of oversizedFiles) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'x');
    await truncate(target, 25 * 1024 * 1024 + 1);
  }
  return root;
}

test('packages only allowlisted frontend files, safely externalizes large games, and omits >25 MiB assets', async t => {
  const root = await fixture(t);
  const result = await buildPages({ root });
  const output = result.output;

  assert.equal(result.skipped.length, 7);
  assert.equal(result.externalized.length, 7);
  assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), '<h1>site</h1>');
  assert.equal(await readFile(path.join(output, 'library', 'small.html'), 'utf8'), 'game');
  assert.equal(await readFile(path.join(output, 'game-ad-guard.js'), 'utf8'), 'guard');
  for (const name of ['server.cjs', 'README.md', 'reports.json']) {
    await assert.rejects(readFile(path.join(output, name)), { code: 'ENOENT' });
  }
  for (const relative of oversizedFiles) {
    await assert.rejects(readFile(path.join(output, relative)), { code: 'ENOENT' });
  }
  const outputGames = JSON.parse(await readFile(path.join(output, 'games.json'), 'utf8'));
  const appGamesJs = await readFile(path.join(output, 'games.js'), 'utf8');
  const appGames = JSON.parse(appGamesJs.match(/^window\.WACKY_GAMES = (.*);\n$/)[1]);
  for (const [id, url] of Object.entries(gameUrls)) {
    const page = outputGames.find(game => game.id === id);
    assert.equal(page.url, `https://civil-civix.github.io/Ben-s-Wacky-World/${url.split('/').map(encodeURIComponent).join('/')}`);
    assert.equal(appGames.find(game => game.id === id).url, page.url);
  }
});

test('fails on an unmapped oversized asset before it can enter a Pages package', async t => {
  const root = await fixture(t);
  const unknown = path.join(root, 'images', 'unexpected.bin');
  await mkdir(path.dirname(unknown), { recursive: true });
  await writeFile(unknown, 'x');
  await truncate(unknown, 25 * 1024 * 1024 + 1);

  await assert.rejects(buildPages({ root }), /Unmapped Pages asset exceeds 25 MiB: images\/unexpected\.bin/);
});

test('refuses to write outside the repository or replace the repository root', async t => {
  const root = await fixture(t);
  await assert.rejects(buildPages({ root, outDir: path.dirname(root) }), /Output directory must be the configured repository path/);
  await assert.rejects(buildPages({ root, outDir: root }), /Output directory must be the configured repository path/);
});

test('fails if one of the expected external game entries disappears', async t => {
  const games = { ...gameUrls };
  delete games.mindustry;
  const root = await fixture(t, games);
  await assert.rejects(buildPages({ root }), /Missing expected fallback game entries: mindustry/);
});
