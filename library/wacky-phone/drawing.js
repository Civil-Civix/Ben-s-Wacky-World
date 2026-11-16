(function () {
  "use strict";

  const WIDTH = 640;
  const HEIGHT = 400;
  const HISTORY_LIMIT = 20;
  const MAX_DATA_URL_LENGTH = 110000;
  const COLORS = ["#111111", "#ffffff", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ec407a", "#795548"];
  const SIZES = [3, 7, 14, 24];

  function create(container, options) {
    if (!container || !container.appendChild) throw new TypeError("A container element is required.");
    options = options || {};
    const root = document.createElement("section");
    root.className = "wacky-drawing";
    root.setAttribute("aria-label", "Drawing canvas");
    root.innerHTML = '<style>\
.wacky-drawing{font:inherit;color:var(--text,#222);width:100%;max-width:760px}.wacky-drawing *{box-sizing:border-box}.wacky-drawing .wd-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;font-size:11px}.wacky-drawing button,.wacky-drawing input,.wacky-drawing select{font:inherit}.wacky-drawing button{border:1px solid var(--border,#bbb);color:var(--text,#222);background:var(--panel,#fff);border-radius:7px;padding:6px 10px;cursor:pointer}.wacky-drawing button[aria-pressed=true]{outline:2px solid var(--accent,#2674d9);outline-offset:1px}.wacky-drawing button:focus-visible,.wacky-drawing input:focus-visible,.wacky-drawing select:focus-visible{outline:3px solid var(--accent,#2674d9);outline-offset:2px}.wacky-drawing .wd-colors{display:flex;gap:4px}.wacky-drawing .wd-swatch{width:26px;height:26px;padding:0;border-radius:50%;border:2px solid var(--border,#777)}.wacky-drawing .wd-canvas-wrap{width:100%;border:1px solid var(--border,#bbb);background:#fff;touch-action:none}.wacky-drawing canvas{display:block;width:100%;height:auto;touch-action:none;cursor:crosshair}.wacky-drawing .wd-label{display:flex;align-items:center;gap:5px}.wacky-drawing .wd-spacer{flex:1}\
</style><div class="wd-tools" role="toolbar" aria-label="Drawing tools"><div class="wd-colors" role="group" aria-label="Colors"></div><label class="wd-label">Custom color <input class="wd-custom" type="color" value="#111111" title="Choose custom color"></label><label class="wd-label">Brush <select class="wd-size" title="Brush size"></select></label><button type="button" data-tool="eraser" aria-pressed="false" title="Erase">Eraser</button><button type="button" data-tool="fill" aria-pressed="false" title="Fill an enclosed area">Fill</button><span class="wd-spacer"></span><button type="button" data-action="undo" title="Undo">Undo</button><button type="button" data-action="redo" title="Redo">Redo</button><button type="button" data-action="clear" title="Clear drawing">Clear</button></div><div class="wd-canvas-wrap"><canvas width="640" height="400" aria-label="White drawing canvas" role="img"></canvas></div>';
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
    SIZES.forEach(size => { const o = document.createElement("option"); o.value = String(size); o.textContent = size + " px"; sizeSelect.appendChild(o); });
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (options.initial) setImage(options.initial);

    function refreshTools() {
      root.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === tool)));
      root.querySelectorAll(".wd-swatch").forEach(b => b.setAttribute("aria-pressed", String(b.title.endsWith(selectedColor))));
    }
    function snapshot() { return ctx.getImageData(0, 0, WIDTH, HEIGHT); }
    function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > HISTORY_LIMIT) undoStack.shift(); redoStack.length = 0; }
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
    function restore(stack, other) { if (disabled || !stack.length) return; other.push(snapshot()); ctx.putImageData(stack.pop(), 0, 0); emitChange(); }
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
          undoStack.length = 0; redoStack.length = 0; resolve(true);
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
    on(root.querySelector('[data-action="undo"]'), "click", () => restore(undoStack, redoStack));
    on(root.querySelector('[data-action="redo"]'), "click", () => restore(redoStack, undoStack));
    on(root.querySelector('[data-action="clear"]'), "click", () => {
      if (disabled || !window.confirm("Clear the drawing?")) return;
      version++;
      pushUndo(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, HEIGHT); emitChange();
    });
    refreshTools();
    return {
      getImage,
      setImage,
      setDisabled(value) { disabled = Boolean(value); root.querySelectorAll("button,input,select").forEach(el => { el.disabled = disabled; }); canvas.style.pointerEvents = disabled ? "none" : ""; root.setAttribute("aria-disabled", String(disabled)); if (disabled) end(); },
      destroy() { destroyed = true; version++; handlers.forEach(fn => fn()); root.remove(); }
    };
  }
  window.WackyDrawing = { create };
})();
