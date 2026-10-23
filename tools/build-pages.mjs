import { cp, lstat, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = '.wrangler/pages-static';
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const GITHUB_PAGES_ROOT = 'https://civil-civix.github.io/Ben-s-Wacky-World/';

const ROOT_FILES = [
  'index.html', 'styles.css', 'games.js', 'home-quotes.js', 'home.js',
  'popularity.js', 'weekly-track.js', 'accounts.js', 'friends.js', 'admin.js',
  'messages.js', 'ai-files.js', 'ai.js', 'game-downloads.js', 'app.js',
  'battles.js', 'sort-menu.js', 'background-effects.js', 'appearance.js',
  'game-ad-guard.js', 'games.json', 'game-images.json', 'home-quotes.json', 'disabled-games.json',
];
const ASSET_DIRS = ['library', 'vendor', 'fonts', 'images', 'licenses'];

// Keep these game pages on GitHub Pages until their >25 MiB assets move elsewhere.
const EXTERNAL_GAME_IDS = new Set([
  'minecraft1121', 'mindustry', 'majorasmask', 'pokemondiamond',
  'pokemonplatinum', 'pokemonsoulsilver', 'pokemonstadium',
]);
const OVERSIZE_PATHS = new Set([
  'library/imported-20260919/mindustry/mindustry-part-6.js',
  'library/noah/games/164.html',
  'library/seraph-games/majorasmask/Legend of Zelda, The - Majora\'s Mask (USA).zip',
  'library/seraph-pokemon/pokemondiamond/pokemon-diamond.zip',
  'library/seraph-pokemon/pokemonplatinum/pokemon-platinum.zip',
  'library/seraph-pokemon/pokemonsoulsilver/pokemon-soulsilver.zip',
  'library/seraph-pokemon/pokemonstadium/Pokemon Stadium (USA) (Rev A).zip',
]);

function githubPageUrl(relativeUrl) {
  return new URL(relativeUrl.split('/').map(encodeURIComponent).join('/'), GITHUB_PAGES_ROOT).href;
}

async function copyTree(source, destination, relative = '', skipped = []) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await copyTree(sourcePath, destinationPath, childRelative, skipped);
      continue;
    }
    if (!entry.isFile()) continue;
    const bytes = (await stat(sourcePath)).size;
    if (bytes > MAX_ASSET_BYTES) {
      if (!OVERSIZE_PATHS.has(childRelative)) {
        throw new Error(`Unmapped Pages asset exceeds 25 MiB: ${childRelative} (${bytes} bytes)`);
      }
      skipped.push(childRelative);
      continue;
    }
    await cp(sourcePath, destinationPath);
  }
}

export async function buildPages({ root = ROOT, outDir = path.join(root, OUTPUT) } = {}) {
  root = path.resolve(root);
  outDir = path.resolve(outDir);
  if (outDir !== path.resolve(root, OUTPUT)) {
    throw new Error(`Output directory must be the configured repository path: ${OUTPUT}`);
  }
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Repository root is not a directory: ${root}`);
  const outputParent = path.dirname(outDir);
  try {
    const parentStat = await lstat(outputParent);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
      throw new Error(`Build output parent must be a real directory: ${outputParent}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(outputParent, { recursive: true });
  }
  try {
    if ((await lstat(outDir)).isSymbolicLink()) {
      throw new Error(`Refusing to replace a symbolic link at the build output path: ${outDir}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const skipped = [];
  // Only recreate the explicitly configured output directory after verifying its boundary.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const name of ROOT_FILES) {
    const source = path.join(root, name);
    try {
      const info = await stat(source);
      if (!info.isFile()) continue;
      if (info.size > MAX_ASSET_BYTES) {
        throw new Error(`Root Pages asset exceeds 25 MiB: ${name} (${info.size} bytes)`);
      }
      await cp(source, path.join(outDir, name));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
  }

  for (const name of ASSET_DIRS) {
    const source = path.join(root, name);
    try {
      if (!(await stat(source)).isDirectory()) continue;
      await mkdir(path.join(outDir, name), { recursive: true });
      await copyTree(source, path.join(outDir, name), name, skipped);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
  }

  const externalized = new Set();
  const externalizeGames = games => {
    if (!Array.isArray(games)) throw new Error('Expected a game array in the published catalog.');
    for (const game of games) {
      if (EXTERNAL_GAME_IDS.has(game.id)) {
        const expected = game.url;
        if (!expected?.startsWith('library/')) throw new Error(`Expected a repository game path for ${game.id}.`);
        game.url = githubPageUrl(expected);
        externalized.add(game.id);
      }
    }
    const missing = [...EXTERNAL_GAME_IDS].filter(id => !externalized.has(id));
    if (missing.length) throw new Error(`Missing expected fallback game entries: ${missing.join(', ')}`);
    return games;
  };
  const gamesPath = path.join(outDir, 'games.json');
  const games = externalizeGames(JSON.parse(await readFile(gamesPath, 'utf8')));
  await writeFile(gamesPath, `${JSON.stringify(games, null, 2)}\n`, 'utf8');
  const gamesJsPath = path.join(outDir, 'games.js');
  const gamesJs = await readFile(gamesJsPath, 'utf8');
  const gamesJsMatch = gamesJs.match(/^window\.WACKY_GAMES\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!gamesJsMatch) throw new Error('Could not parse the window.WACKY_GAMES assignment in games.js.');
  const jsGames = externalizeGames(JSON.parse(gamesJsMatch[1]));
  await writeFile(gamesJsPath, `window.WACKY_GAMES = ${JSON.stringify(jsGames)};\n`, 'utf8');

  const unexpected = [...OVERSIZE_PATHS].filter(file => !skipped.includes(file));
  if (unexpected.length) throw new Error(`Expected oversize source files were not found: ${unexpected.join(', ')}`);
  return { output: outDir, skipped, externalized: [...externalized] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPages().then(result => {
    console.log(`Cloudflare Pages static output: ${result.output}`);
    console.log(`Copied allowlisted assets; externalized ${result.externalized.length} games; skipped ${result.skipped.length} oversized files.`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
