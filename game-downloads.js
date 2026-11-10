'use strict';
(() => {
  const publishedRoot = new URL('./', document.baseURI).href;
  const embedded = new Set(["grandtheftauto3", "yohohoio", "minecraft1121", "cookieclicker", "kirbysoftwet", "busterjam", "minesweeper", "pixelgun3d", "flyinggorilla", "eattherich", "amazingropepolice", "plantsvszombies2", "dokidokiliteratureclub", "baseballbros", "nubbysnumberfactory", "clashroyale", "angrybirds", "plinko", "paperio2", "sandgame", "dodgeball", "cuttherope"]);
  function eligible(game) {
    return Boolean(game && game.kind !== 'stream' && game.url.startsWith('library/') && !embedded.has(game.id));
  }
  function documentFor(game, source) {
    if (!eligible(game)) throw new Error('This game cannot be downloaded.');
    if (/<iframe\b|createElement\(['"]iframe['"]\)/i.test(source)) throw new Error('Embedded games cannot be downloaded.');
    const gameURL = new URL(game.url, publishedRoot);
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    const originalBase = parsed.querySelector('base[href]')?.getAttribute('href');
    const baseURL = new URL(originalBase || '.', gameURL).href;
    const base = parsed.createElement('base');base.href = baseURL;parsed.head.prepend(base);
    parsed.querySelectorAll('.noah-wmk,#bww-download-watermark,#watermark,.watermark').forEach(node=>node.remove());
    const doctype = parsed.doctype ? new XMLSerializer().serializeToString(parsed.doctype) : '';
    return doctype + '\n' + parsed.documentElement.outerHTML;
  }
  async function download(game) {
    if (!eligible(game)) throw new Error('This game cannot be downloaded.');
    const response = await fetch(new URL(game.url, location.href));
    if (!response.ok) throw new Error('Could not download the game. Try again.');
    const blob = new Blob([documentFor(game, await response.text())], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = (game.title.replace(/[^a-z0-9 _-]/gi,'').trim() || game.id) + ' - Bens Wacky World.html';
    document.body.append(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.WackyDownloads = {eligible, documentFor, download};
})();
