(function () {
  "use strict";

  const WIDTH = 640;
  const HEIGHT = 400;
  const HISTORY_LIMIT = 20;
  const MAX_DATA_URL_LENGTH = 110000;
  const COLORS = ["#171923", "#ffffff", "#a6a9b4", "#ef4444", "#f97316", "#facc15", "#8b5e3c", "#f5b48c", "#f9a8d4", "#ec4899", "#a855f7", "#6d28d9", "#2563eb", "#38bdf8", "#22d3ee", "#15803d", "#4ade80", "#bef264"];
  const SIZES = [3, 7, 14, 24];

  function create(container, options) {
    if (!container || !container.appendChild) throw new TypeError("A container element is required.");
    options = options || {};
    const root = document.createElement("section");
    root.className = "wacky-drawing";
    root.setAttribute("aria-label", "Drawing canvas");
    const icons = {
      brush: '<path d="m14 5 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15l-1 5Z"/>',
      eraser: '<path d="m14 4 6 6a2 2 0 0 1 0 3l-7 7H8l-5-5a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0ZM7 8l9 9M13 20h8"/>',
      fill: '<path d="m8 3 10 10-7 7a2 2 0 0 1-3 0l-5-5a2 2 0 0 1 0-3l8-8M4 12h13M20 16s-2 2-2 3a2 2 0 0 0 4 0c0-1-2-3-2-3Z"/>',
      undo: '<path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
      redo: '<path d="m15 5 5 5-5 5M20 10H10a6 6 0 0 0 0 12" transform="translate(0 -2)"/>',
      clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>'
    };
    function iconButton(kind, label, action) {
      return '<button type="button" class="wd-icon" ' + (action ? 'data-action' : 'data-tool') + '="' + kind + '" title="' + label + '" aria-label="' + label + '"' + (action ? '' : ' aria-pressed="false"') + '><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[kind] + '</svg></button>';
    }
    root.innerHTML = `<style>
.wacky-drawing{font:inherit;color:var(--text,#252434);width:100%;max-width:1000px;margin-inline:auto}.wacky-drawing *{box-sizing:border-box}.wacky-drawing button,.wacky-drawing input{font:inherit}.wacky-drawing button{border:1px solid var(--border,#c9c7d1);color:var(--text,#252434);background:var(--panel,#fff);border-radius:9px;padding:0;cursor:pointer;transition:transform .12s,background .12s}.wacky-drawing button:hover:not(:disabled){transform:translateY(-1px)}.wacky-drawing button:disabled{opacity:.35;cursor:default}.wacky-drawing button[aria-pressed=true]{outline:2px solid var(--accent,#8b5cf6);outline-offset:2px}.wacky-drawing button:focus-visible,.wacky-drawing input:focus-visible{outline:3px solid var(--accent,#8b5cf6);outline-offset:3px}.wacky-drawing .wd-workspace{display:grid;grid-template-columns:98px minmax(0,1fr) 44px;gap:12px;align-items:start}.wacky-drawing .wd-palette{padding:10px 7px;border:1px solid var(--border,#c9c7d1);border-radius:12px;background:var(--panel,#fff)}.wacky-drawing .wd-caption{display:block;text-align:center;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.65;margin-bottom:10px}.wacky-drawing .wd-colors{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.wacky-drawing .wd-swatch{width:22px;height:22px;border-radius:5px;border:1px solid #0003;box-shadow:inset 0 0 0 1px #fff2}.wacky-drawing .wd-custom-label{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:12px;font-size:10px;font-weight:700;cursor:pointer}.wacky-drawing .wd-custom{width:25px;height:25px;padding:0;border:0;background:transparent;cursor:pointer}.wacky-drawing .wd-tools{display:flex;flex-direction:column;gap:9px}.wacky-drawing .wd-icon{width:42px;height:42px;display:grid;place-items:center;box-shadow:0 2px 0 var(--border,#c9c7d1)}.wacky-drawing .wd-icon svg{width:22px;height:22px}.wacky-drawing .wd-icon[aria-pressed=true]{background:color-mix(in srgb,var(--accent,#8b5cf6) 16%,var(--panel,#fff))}.wacky-drawing .wd-tool-divider{height:1px;background:var(--border,#c9c7d1);margin:2px 0}.wacky-drawing .wd-canvas-wrap{width:100%;border:2px solid var(--border,#c9c7d1);border-radius:9px;overflow:hidden;background:#fff;touch-action:none;box-shadow:0 5px 0 var(--border,#c9c7d1)}.wacky-drawing canvas{display:block;width:100%;height:auto;touch-action:none;cursor:crosshair}.wacky-drawing .wd-bottom{display:flex;align-items:center;gap:14px;margin:17px 56px 0 110px;min-height:42px;flex-wrap:wrap}.wacky-drawing .wd-presets{display:flex;align-items:center;gap:7px}.wacky-drawing .wd-preset{display:grid;place-items:center;width:33px;height:33px;border-radius:50%}.wacky-drawing .wd-preset span{display:block;background:currentColor;border-radius:50%}.wacky-drawing .wd-width{display:flex;align-items:center;gap:8px;flex:1;min-width:140px;font-size:11px;font-weight:700}.wacky-drawing .wd-size{width:100%;min-width:55px;accent-color:var(--accent,#8b5cf6)}.wacky-drawing .wd-width output{min-width:34px;white-space:nowrap}.wacky-drawing .wd-preview{width:39px;height:39px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1px solid var(--border,#c9c7d1)}.wacky-drawing .wd-preview-dot{border-radius:50%;display:block}
@media(max-width:600px){.wacky-drawing .wd-workspace{grid-template-columns:minmax(0,1fr);gap:11px}.wacky-drawing .wd-palette{padding:8px;display:flex;align-items:center;gap:10px;grid-row:1}.wacky-drawing .wd-caption{display:none}.wacky-drawing .wd-colors{grid-template-columns:repeat(9,minmax(0,1fr));gap:5px;flex:1}.wacky-drawing .wd-swatch{width:100%;height:auto;aspect-ratio:1;max-height:28px}.wacky-drawing .wd-custom-label{margin:0;flex-direction:column;font-size:9px;gap:2px}.wacky-drawing .wd-tools{flex-direction:row;justify-content:center;gap:9px;grid-row:3}.wacky-drawing .wd-icon{width:40px;height:38px}.wacky-drawing .wd-tool-divider{width:1px;height:30px;margin:4px 1px}.wacky-drawing .wd-canvas-wrap{grid-row:2}.wacky-drawing .wd-bottom{margin:15px 0 0;gap:10px}.wacky-drawing .wd-preset{width:29px;height:29px}.wacky-drawing .wd-presets{gap:5px}.wacky-drawing .wd-width{min-width:110px}.wacky-drawing .wd-preview{width:33px;height:33px}}
</style><div class="wd-workspace"><div class="wd-palette"><span class="wd-caption">Paint box</span><div class="wd-colors" role="group" aria-label="Paint colors"></div><label class="wd-custom-label" title="Choose a custom color"><input class="wd-custom" type="color" value="#171923" aria-label="Custom paint color">Custom</label></div><div class="wd-canvas-wrap"><canvas width="640" height="400" aria-label="White drawing canvas" role="img"></canvas></div><div class="wd-tools" role="group" aria-label="Drawing tools">${iconButton("brush", "Brush")}${iconButton("eraser", "Eraser")}${iconButton("fill", "Fill an enclosed area")}<span class="wd-tool-divider" aria-hidden="true"></span>${iconButton("undo", "Undo", true)}${iconButton("redo", "Redo", true)}${iconButton("clear", "Clear drawing (Undo to restore)", true)}</div></div><div class="wd-bottom"><div class="wd-presets" role="group" aria-label="Brush sizes"></div><label class="wd-width">Size <input class="wd-size" type="range" min="1" max="36" value="3" aria-label="Brush width"><output>3 px</output></label><div class="wd-preview" role="img" aria-label="Current brush preview"><span class="wd-preview-dot"></span></div></div>`;
    container.appendChild(root);
    const canvas = root.querySelector("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const palette = root.querySelector(".wd-colors");
    const sizeSelect = root.querySelector(".wd-size");
    let selectedColor = COLORS[0], tool = "brush", disabled = false, drawing = false, lastPoint = null;
    let undoStack = [], redoStack = [], version = 0, destroyed = false;
    COLORS.forEach((color, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "wd-swatch"; b.style.backgroundColor = color;
      b.title = "Color " + (i + 1) + ": " + color; b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => { if (!disabled) { selectedColor = color; tool = "brush"; refreshTools(); } });
      palette.appendChild(b);
    });
    SIZES.forEach(size => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "wd-preset"; b.dataset.size = String(size);
      b.title = "Brush width: " + size + " pixels"; b.setAttribute("aria-label", b.title);
      const dot = document.createElement("span"); dot.style.width = dot.style.height = Math.min(size, 22) + "px"; b.appendChild(dot);
      b.addEventListener("click", () => { if (!disabled) { sizeSelect.value = String(size); refreshTools(); } });
      root.querySelector(".wd-presets").appendChild(b);
    });
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (options.initial) setImage(options.initial);

    function refreshTools() {
      root.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === tool)));
      root.querySelectorAll(".wd-swatch").forEach(b => b.setAttribute("aria-pressed", String(b.title.endsWith(selectedColor))));
      root.querySelectorAll(".wd-preset").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.size === sizeSelect.value)));
      root.querySelector(".wd-custom").value = selectedColor;
      root.querySelector(".wd-width output").textContent = sizeSelect.value + " px";
      const preview = root.querySelector(".wd-preview-dot");
      preview.style.width = preview.style.height = sizeSelect.value + "px";
      preview.style.background = tool === "eraser" ? "#ffffff" : selectedColor;
      preview.style.boxShadow = tool === "eraser" ? "0 0 0 1px #aaa" : "none";
      root.querySelector('[data-action="undo"]').disabled = disabled || !undoStack.length;
      root.querySelector('[data-action="redo"]').disabled = disabled || !redoStack.length;
    }
    function snapshot() { return ctx.getImageData(0, 0, WIDTH, HEIGHT); }
    function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > HISTORY_LIMIT) undoStack.shift(); redoStack.length = 0; refreshTools(); }
    function emitChange() { if (!destroyed && typeof options.onChange === "function") options.onChange(getImage()); }
    function point(e) {
      const r = canvas.getBoundingClientRect();
      return { x: Math.max(0, Math.min(WIDTH - 1, (e.clientX - r.left) * WIDTH / r.width)), y: Math.max(0, Math.min(HEIGHT - 1, (e.clientY - r.top) * HEIGHT / r.height)) };
    }
    function start(e) {
      if (disabled || destroyed || e.button > 0) return;
      version++;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      const p = point(e);
      if (tool === "fill") { pushUndo(); floodFill(Math.floor(p.x), Math.floor(p.y), selectedColor); emitChange(); return; }
      pushUndo(); drawing = true; lastPoint = p;
      ctx.beginPath(); ctx.arc(p.x, p.y, Number(sizeSelect.value) / 2, 0, Math.PI * 2); ctx.fillStyle = tool === "eraser" ? "#ffffff" : selectedColor; ctx.fill();
    }
    function move(e) {
      if (!drawing || disabled) return;
      e.preventDefault(); const p = point(e);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : selectedColor;
      ctx.lineWidth = Number(sizeSelect.value); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(lastPoint.x, lastPoint.y); ctx.lineTo(p.x, p.y); ctx.stroke(); lastPoint = p;
    }
    function end() { if (drawing) { drawing = false; lastPoint = null; emitChange(); } }
    function floodFill(sx, sy, color) {
      const image = snapshot(), data = image.data, idx = (sy * WIDTH + sx) * 4;
      const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
      const rgb = hexToRgb(color), replacement = [rgb[0], rgb[1], rgb[2], 255];
      if (target.every((v, i) => v === replacement[i])) return;
      const limit = WIDTH * HEIGHT, queue = new Int32Array(limit), seen = new Uint8Array(limit);
      const start = sy * WIDTH + sx;
      let head = 0, tail = 0;
      queue[tail++] = start; seen[start] = 1;
      function enqueue(pos) {
        if (seen[pos]) return;
        const j = pos * 4;
        if (data[j] === target[0] && data[j + 1] === target[1] && data[j + 2] === target[2] && data[j + 3] === target[3]) {
          seen[pos] = 1; queue[tail++] = pos;
        }
      }
      while (head < tail) {
        const pos = queue[head++];
        const j = pos * 4;
        data[j] = replacement[0]; data[j + 1] = replacement[1]; data[j + 2] = replacement[2]; data[j + 3] = replacement[3];
        const x = pos % WIDTH, y = (pos / WIDTH) | 0;
        if (x > 0) enqueue(pos - 1); if (x < WIDTH - 1) enqueue(pos + 1);
        if (y > 0) enqueue(pos - WIDTH); if (y < HEIGHT - 1) enqueue(pos + WIDTH);
      }
      ctx.putImageData(image, 0, 0);
    }
    function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function restore(stack, other) { if (disabled || !stack.length) return; version++; other.push(snapshot()); ctx.putImageData(stack.pop(), 0, 0); refreshTools(); emitChange(); }
    function setImage(dataURL) {
      if (typeof dataURL !== "string" || !dataURL) return Promise.resolve(false);
      const token = ++version, img = new Image();
      return new Promise(resolve => {
        img.onload = () => {
          if (destroyed || token !== version) { resolve(false); return; }
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
          const scale = Math.min(WIDTH / img.width, HEIGHT / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
          undoStack.length = 0; redoStack.length = 0; refreshTools(); resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = dataURL;
      });
    }
    function getImage() {
      const png = canvas.toDataURL("image/png");
      if (png.length <= MAX_DATA_URL_LENGTH) return png;
      let q = 0.88, data = canvas.toDataURL("image/jpeg", q);
      while (data.length > MAX_DATA_URL_LENGTH && q > 0.12) { q = Math.max(0.12, q - 0.12); data = canvas.toDataURL("image/jpeg", q); }
      if (data.length > MAX_DATA_URL_LENGTH) {
        let scale = 0.9;
        while (data.length > MAX_DATA_URL_LENGTH && scale >= 0.1) {
          const tmp = document.createElement("canvas"); tmp.width = Math.round(WIDTH * scale); tmp.height = Math.round(HEIGHT * scale);
          tmp.getContext("2d").drawImage(canvas, 0, 0, tmp.width, tmp.height);
          data = tmp.toDataURL("image/jpeg", 0.12); scale -= 0.1;
        }
      }
      return data;
    }
    const handlers = [];
    function on(el, type, fn) { el.addEventListener(type, fn); handlers.push(() => el.removeEventListener(type, fn)); }
    on(canvas, "pointerdown", start); on(canvas, "pointermove", move);
    on(canvas, "pointerup", end); on(canvas, "pointercancel", end); on(canvas, "lostpointercapture", end);
    root.querySelectorAll("[data-tool]").forEach(b => on(b, "click", () => { if (!disabled) { tool = b.dataset.tool; refreshTools(); } }));
    on(root.querySelector(".wd-custom"), "input", e => { if (!disabled) { selectedColor = e.target.value; tool = "brush"; refreshTools(); } });
    on(sizeSelect, "input", refreshTools);
    on(root.querySelector('[data-action="undo"]'), "click", () => restore(undoStack, redoStack));
    on(root.querySelector('[data-action="redo"]'), "click", () => restore(redoStack, undoStack));
    on(root.querySelector('[data-action="clear"]'), "click", () => {
      if (disabled) return;
      version++;
      drawing = false; lastPoint = null;
      pushUndo(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, HEIGHT); emitChange();
    });
    refreshTools();
    return {
      getImage,
      setImage,
      setDisabled(value) { disabled = Boolean(value); root.querySelectorAll("button,input,select").forEach(el => { el.disabled = disabled; }); canvas.style.pointerEvents = disabled ? "none" : ""; root.setAttribute("aria-disabled", String(disabled)); if (disabled) end(); refreshTools(); },
      destroy() { destroyed = true; version++; handlers.forEach(fn => fn()); root.remove(); }
    };
  }
  window.WackyDrawing = { create };
})();
