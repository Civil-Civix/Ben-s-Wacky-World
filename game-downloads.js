'use strict';
(() => {
  const site = "https://sites.google.com/stu.tempeunion.org/bens-wack-world/home";
  const publishedRoot = 'https://civil-civix.github.io/Ben-s-Wacky-World/';
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
    const mark = `<style>
#bww-download-watermark{all:initial!important;position:fixed!important;z-index:2147483647!important;bottom:14px!important;right:14px!important;display:grid!important;place-items:center!important;width:42px!important;height:42px!important;box-sizing:border-box!important;border:1px solid #cbd2d9!important;border-radius:11px!important;background:rgba(38,39,42,.88)!important;color:#e5edf2!important;text-decoration:none!important;font:800 29px/1 Arial,sans-serif!important;cursor:pointer!important}
#bww-download-watermark:focus-visible{outline:2px solid white!important;outline-offset:3px!important}
</style><a id="bww-download-watermark" href="${site}" target="_blank" rel="noopener noreferrer" aria-label="Visit Ben's Wacky Site" title="Ben's Wacky Site · This game may require internet">W</a>`;
    parsed.body.insertAdjacentHTML('beforeend', mark);
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
