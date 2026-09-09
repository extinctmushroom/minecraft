/* ============================================================
   BlockCraft Planner — application
   Vanilla JS, no build step. Structure:
     1. State & grid storage          6. Materials
     2. DOM refs & init               7. Isometric preview
     3. Palette                       8. Modals (new/templates/guides/…)
     4. Canvas rendering (2-D)        9. Save / load / import / export
     5. Tools & pointer input        10. Shortcuts, toasts, boot
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   1. State & grid storage
   Grid is a flat Uint16Array: 0 = air, n = BLOCKS[n-1].
   Index = (y * depth + z) * width + x.
   ------------------------------------------------------------ */
const LIMITS = { maxW: 128, maxD: 128, maxH: 64 };
const AUTOSAVE_KEY = "bcp.autosave.v1";
const SAVES_KEY = "bcp.saves.v1";

const state = {
  name: "My First Build",
  w: 16, d: 16, h: 8,
  grid: null,           // Uint16Array
  cur: 0,               // current layer (0-based)
  tool: "pencil",
  blockIdx: 0,          // index into BLOCKS of selected block
  cell: 24,             // zoom (px per cell)
  fillShape: false,
  mirrorX: false, mirrorZ: false,
  onion: true, gridLines: true,
  layerOnly: false,
  previewRot: 2, // front (low-z) faces the camera by default
  previewCut: false,
  dirty: false,         // has unsaved (un-autosaved) edits
};

const undoStack = [], redoStack = [];
const UNDO_MAX = 120;

const idx3 = (x, z, y) => (y * state.d + z) * state.w + x;
const inBounds = (x, z) => x >= 0 && x < state.w && z >= 0 && z < state.d;
const getCell = (x, z, y) => state.grid[idx3(x, z, y)];
const setCell = (x, z, y, v) => { state.grid[idx3(x, z, y)] = v; };
const curBlock = () => BLOCKS[state.blockIdx];

function newGrid(w, d, h) { return new Uint16Array(w * d * h); }

/* ---- undo/redo ---- */
function snapshotLayer(y) {
  const start = y * state.d * state.w;
  return { kind: "layer", y, data: state.grid.slice(start, start + state.d * state.w) };
}
function snapshotFull() {
  return {
    kind: "full", name: state.name, w: state.w, d: state.d, h: state.h,
    cur: state.cur, cell: state.cell, data: state.grid.slice(),
  };
}
function pushUndo(snap) {
  undoStack.push(snap);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}
function applySnap(snap) {
  // Returns the inverse snapshot (for the opposite stack).
  if (snap.kind === "layer") {
    const inverse = snapshotLayer(snap.y);
    state.grid.set(snap.data, snap.y * state.d * state.w);
    if (state.cur !== snap.y) setLayer(snap.y, false);
    return inverse;
  }
  const inverse = snapshotFull();
  state.name = snap.name; state.w = snap.w; state.d = snap.d; state.h = snap.h;
  state.grid = snap.data.slice();
  state.cur = Math.min(snap.cur, state.h - 1);
  els.bpName.value = state.name;
  // dimensions and zoom may have changed (resize/template/import undo)
  if (snap.cell) { state.cell = snap.cell; els.zoomLabel.textContent = snap.cell + "px"; }
  canvasSize();
  return inverse;
}
function undo() {
  const snap = undoStack.pop();
  if (!snap) return;
  redoStack.push(applySnap(snap));
  afterEdit(true);
  updateUndoButtons();
}
function redo() {
  const snap = redoStack.pop();
  if (!snap) return;
  undoStack.push(applySnap(snap));
  afterEdit(true);
  updateUndoButtons();
}
function updateUndoButtons() {
  els.btnUndo.disabled = undoStack.length === 0;
  els.btnRedo.disabled = redoStack.length === 0;
}

/* ------------------------------------------------------------
   2. DOM refs
   ------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const els = {
  bpName: $("bp-name"),
  palette: $("palette"), paletteSearch: $("palette-search"),
  currentChip: $("current-chip"), currentName: $("current-name"),
  canvas: $("grid-canvas"), canvasWrap: $("canvas-wrap"),
  layerNum: $("layer-num"), layerTotal: $("layer-total"), layerSlider: $("layer-slider"),
  zoomLabel: $("zoom-label"),
  statusPos: $("status-pos"), statusSize: $("status-size"),
  matList: $("materials-list"), matSummary: $("materials-summary"),
  previewCanvas: $("preview-canvas"), previewWrap: $("preview-wrap"),
  modalBackdrop: $("modal-backdrop"), modalTitle: $("modal-title"), modalBody: $("modal-body"),
  toastZone: $("toast-zone"),
  btnUndo: $("btn-undo"), btnRedo: $("btn-redo"),
  materialsPanel: $("materials-panel"), previewPanel: $("preview-panel"),
  tabMaterials: $("tab-materials"), tabPreview: $("tab-preview"),
};
const ctx = els.canvas.getContext("2d");
const pctx = els.previewCanvas.getContext("2d");

/* ------------------------------------------------------------
   3. Palette
   ------------------------------------------------------------ */
function buildPalette(filter = "") {
  const q = filter.trim().toLowerCase();
  els.palette.innerHTML = "";
  for (const cat of BLOCK_CATEGORIES) {
    const blocks = BLOCKS.filter(
      (b) => b.cat === cat && (!q || b.name.toLowerCase().includes(q) || b.id.includes(q))
    );
    if (!blocks.length) continue;
    const h = document.createElement("div");
    h.className = "pal-cat";
    h.textContent = cat;
    els.palette.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "pal-grid";
    for (const b of blocks) {
      const btn = document.createElement("button");
      btn.className = "pal-block" + (b.index - 1 === state.blockIdx ? " selected" : "");
      btn.style.background = b.color;
      btn.title = b.name;
      btn.setAttribute("aria-label", b.name);
      btn.addEventListener("click", () => selectBlock(b.index - 1));
      // drag a block straight onto the canvas to place it
      btn.draggable = true;
      btn.addEventListener("dragstart", (ev) => {
        selectBlock(b.index - 1);
        ev.dataTransfer.setData("text/plain", b.id);
        ev.dataTransfer.effectAllowed = "copy";
      });
      grid.appendChild(btn);
    }
    els.palette.appendChild(grid);
  }
}
function selectBlock(i) {
  state.blockIdx = i;
  const b = curBlock();
  els.currentChip.style.background = b.color;
  els.currentName.textContent = b.name;
  const qbChip = $("qb-chip");
  if (qbChip) qbChip.style.background = b.color;
  els.palette.querySelectorAll(".pal-block").forEach((el) => {
    el.classList.toggle("selected", el.title === b.name);
  });
  if (state.tool === "eraser" || state.tool === "picker") setTool("pencil");
  closeSheet(); // picking a block from the mobile sheet returns to the canvas
}

/* ------------------------------------------------------------
   4. Canvas rendering (2-D layer view)
   ------------------------------------------------------------ */
const RULER = 20;
let hoverCell = null;          // {x, z} under the pointer
let previewCells = null;       // Map "x,z" -> true while dragging shapes

function canvasSize() {
  els.canvas.width = RULER + state.w * state.cell + 1;
  els.canvas.height = RULER + state.d * state.cell + 1;
}

function render() {
  const { w, d, cell } = state;
  const c = ctx;
  c.clearRect(0, 0, els.canvas.width, els.canvas.height);

  // board background
  c.fillStyle = "#101215";
  c.fillRect(RULER, RULER, w * cell, d * cell);

  // onion skin: layer below as ghost
  if (state.onion && state.cur > 0) {
    c.globalAlpha = 0.28;
    drawLayerBlocks(c, state.cur - 1, cell);
    c.globalAlpha = 1;
    c.fillStyle = "rgba(16,18,21,.55)";
    c.fillRect(RULER, RULER, w * cell, d * cell);
  }

  drawLayerBlocks(c, state.cur, cell);

  // shape preview (including the mirrored copies that will be committed)
  if (previewCells && previewCells.size) {
    const b = curBlock();
    c.globalAlpha = 0.6;
    c.fillStyle = state.shapeErase ? "#0d0f11" : b.color;
    for (const key of previewCells.keys()) {
      const [x, z] = key.split(",").map(Number);
      for (const [mx, mz] of mirrorTargets(x, z))
        c.fillRect(RULER + mx * cell, RULER + mz * cell, cell, cell);
    }
    c.globalAlpha = 1;
  }

  // grid lines
  if (state.gridLines && cell >= 7) {
    c.strokeStyle = "rgba(255,255,255,.08)";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= w; x++) {
      c.moveTo(RULER + x * cell + 0.5, RULER);
      c.lineTo(RULER + x * cell + 0.5, RULER + d * cell);
    }
    for (let z = 0; z <= d; z++) {
      c.moveTo(RULER, RULER + z * cell + 0.5);
      c.lineTo(RULER + w * cell, RULER + z * cell + 0.5);
    }
    c.stroke();
    // heavier line every 5
    c.strokeStyle = "rgba(255,255,255,.16)";
    c.beginPath();
    for (let x = 0; x <= w; x += 5) {
      c.moveTo(RULER + x * cell + 0.5, RULER);
      c.lineTo(RULER + x * cell + 0.5, RULER + d * cell);
    }
    for (let z = 0; z <= d; z += 5) {
      c.moveTo(RULER, RULER + z * cell + 0.5);
      c.lineTo(RULER + w * cell, RULER + z * cell + 0.5);
    }
    c.stroke();
  }

  // mirror axes
  if (state.mirrorX || state.mirrorZ) {
    c.strokeStyle = "rgba(95,187,78,.5)";
    c.lineWidth = 2;
    c.setLineDash([6, 4]);
    c.beginPath();
    if (state.mirrorX) {
      const mx = RULER + (w / 2) * cell;
      c.moveTo(mx, RULER); c.lineTo(mx, RULER + d * cell);
    }
    if (state.mirrorZ) {
      const mz = RULER + (d / 2) * cell;
      c.moveTo(RULER, mz); c.lineTo(RULER + w * cell, mz);
    }
    c.stroke();
    c.setLineDash([]);
  }

  // rulers
  c.fillStyle = "#171a1e";
  c.fillRect(0, 0, els.canvas.width, RULER);
  c.fillRect(0, 0, RULER, els.canvas.height);
  c.fillStyle = "#8b93a0";
  c.font = "10px Inter, sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  const step = cell >= 14 ? 1 : 5;
  for (let x = 0; x < w; x += step) {
    if (step === 1 && cell < 20 && x % 5 !== 0 && x !== w - 1) continue;
    c.fillText(String(x + 1), RULER + x * cell + cell / 2, RULER / 2);
  }
  for (let z = 0; z < d; z += step) {
    if (step === 1 && cell < 20 && z % 5 !== 0 && z !== d - 1) continue;
    c.fillText(String(z + 1), RULER / 2, RULER + z * cell + cell / 2);
  }

  // hover highlight + brush ghost (mouse/pen only — fingers cover the cell)
  if (hoverCell && inBounds(hoverCell.x, hoverCell.z) && !pinch && lastPointerType !== "touch") {
    const erase = state.tool === "eraser";
    if (!drag && state.tool !== "picker") {
      c.globalAlpha = 0.45;
      c.fillStyle = erase ? "#000" : curBlock().color;
      for (const [gx, gz] of mirrorTargets(hoverCell.x, hoverCell.z))
        c.fillRect(RULER + gx * cell, RULER + gz * cell, cell, cell);
      c.globalAlpha = 1;
    }
    c.strokeStyle = erase ? "#d0564d" : "#5fbb4e";
    c.lineWidth = 2;
    for (const [gx, gz] of mirrorTargets(hoverCell.x, hoverCell.z))
      c.strokeRect(RULER + gx * cell + 1, RULER + gz * cell + 1, cell - 2, cell - 2);
  }
}

function drawLayerBlocks(c, y, cell) {
  const { w, d } = state;
  const base = y * d * w;
  // subtle per-block texture speckles, skipped on big grids to stay fast
  const speckle = cell >= 16 && w * d <= 4096;
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      const v = state.grid[base + z * w + x];
      if (!v) continue;
      const b = BLOCKS[v - 1];
      const px = RULER + x * cell, pz = RULER + z * cell;
      if (b.alpha != null) {
        c.save();
        c.globalAlpha *= b.alpha;
        c.fillStyle = b.color;
        c.fillRect(px, pz, cell, cell);
        c.restore();
      } else {
        c.fillStyle = b.color;
        c.fillRect(px, pz, cell, cell);
      }
      if (cell >= 10) { // bevel for a chunky block feel
        c.fillStyle = "rgba(255,255,255,.14)";
        c.fillRect(px, pz, cell, 2);
        c.fillRect(px, pz, 2, cell);
        c.fillStyle = "rgba(0,0,0,.2)";
        c.fillRect(px, pz + cell - 2, cell, 2);
        c.fillRect(px + cell - 2, pz, 2, cell);
      }
      if (speckle && b.alpha == null) {
        let h = (x * 73856093 ^ z * 19349663 ^ v * 83492791) >>> 0;
        for (let i = 0; i < 3; i++) {
          h = (h * 1664525 + 1013904223) >>> 0;
          const sx = px + 3 + (h % (cell - 7));
          const sy = pz + 3 + ((h >>> 9) % (cell - 7));
          c.fillStyle = (h & 32) ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.09)";
          c.fillRect(sx, sy, 3, 3);
        }
      }
    }
  }
}

/* ------------------------------------------------------------
   5. Tools & pointer input
   ------------------------------------------------------------ */
const SHAPE_TOOLS = new Set(["line", "rect", "ellipse"]);
let drag = null; // { button, startX, startZ, lastX, lastZ, snapDone }
let spaceDown = false;
let panDrag = null;

function setTool(t) {
  state.tool = t;
  document.querySelectorAll(".tool").forEach((el) =>
    el.classList.toggle("active", el.dataset.tool === t)
  );
  els.canvas.style.cursor = t === "picker" ? "copy" : "crosshair";
}

function cellFromEvent(e) {
  const r = els.canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left - RULER) / state.cell);
  const z = Math.floor((e.clientY - r.top - RULER) / state.cell);
  return { x, z };
}

function mirrorTargets(x, z) {
  const pts = [[x, z]];
  if (state.mirrorX) pts.push([state.w - 1 - x, z]);
  if (state.mirrorZ) pts.push([x, state.d - 1 - z]);
  if (state.mirrorX && state.mirrorZ) pts.push([state.w - 1 - x, state.d - 1 - z]);
  return pts;
}

function paintCell(x, z, v) {
  if (!inBounds(x, z)) return;
  for (const [px, pz] of mirrorTargets(x, z)) setCell(px, pz, state.cur, v);
}

function ensureStrokeSnapshot() {
  if (drag && !drag.snapDone) {
    pushUndo(snapshotLayer(state.cur));
    drag.snapDone = true;
  }
}

function toolValue(button) {
  // right button always erases; eraser tool always erases
  if (button === 2 || state.tool === "eraser") return 0;
  return curBlock().index;
}

function pickAt(x, z) {
  if (!inBounds(x, z)) return;
  const v = getCell(x, z, state.cur);
  if (v) { selectBlock(v - 1); toast(`Picked ${BLOCKS[v - 1].name}`); }
  else toast("Empty cell — nothing to pick", true);
}

function floodFill(x, z, v) {
  if (!inBounds(x, z)) return;
  const target = getCell(x, z, state.cur);
  if (target === v) return;
  pushUndo(snapshotLayer(state.cur));
  const { w, d } = state;
  const stack = [[x, z]];
  const seen = new Uint8Array(w * d);
  while (stack.length) {
    const [cx, cz] = stack.pop();
    if (cx < 0 || cx >= w || cz < 0 || cz >= d) continue;
    const si = cz * w + cx;
    if (seen[si]) continue;
    seen[si] = 1;
    if (getCell(cx, cz, state.cur) !== target) continue;
    setCell(cx, cz, state.cur, v);
    stack.push([cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]);
  }
  afterEdit();
}

/* ---- shape cell generation ---- */
function lineCells(x0, z0, x1, z1) {
  const cells = new Map();
  let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz, x = x0, z = z0;
  for (;;) {
    cells.set(`${x},${z}`, true);
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return cells;
}
function rectCells(x0, z0, x1, z1, filled) {
  const cells = new Map();
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const za = Math.min(z0, z1), zb = Math.max(z0, z1);
  for (let z = za; z <= zb; z++)
    for (let x = xa; x <= xb; x++)
      if (filled || x === xa || x === xb || z === za || z === zb)
        cells.set(`${x},${z}`, true);
  return cells;
}
function ellipseCells(x0, z0, x1, z1, filled) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const za = Math.min(z0, z1), zb = Math.max(z0, z1);
  const cx = (xa + xb) / 2, cz = (za + zb) / 2;
  const rx = (xb - xa) / 2 + 0.5, rz = (zb - za) / 2 + 0.5;
  const inside = (x, z) => {
    const nx = (x - cx) / rx, nz = (z - cz) / rz;
    return nx * nx + nz * nz <= 1;
  };
  const fill = new Set();
  for (let z = za; z <= zb; z++)
    for (let x = xa; x <= xb; x++)
      if (inside(x, z)) fill.add(`${x},${z}`);
  const cells = new Map();
  for (const key of fill) {
    if (filled) { cells.set(key, true); continue; }
    const [x, z] = key.split(",").map(Number);
    if (!fill.has(`${x + 1},${z}`) || !fill.has(`${x - 1},${z}`) ||
        !fill.has(`${x},${z + 1}`) || !fill.has(`${x},${z - 1}`))
      cells.set(key, true);
  }
  return cells;
}
function shapeCells(tool, x0, z0, x1, z1) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  x0 = clamp(x0, 0, state.w - 1); x1 = clamp(x1, 0, state.w - 1);
  z0 = clamp(z0, 0, state.d - 1); z1 = clamp(z1, 0, state.d - 1);
  if (tool === "line") return lineCells(x0, z0, x1, z1);
  if (tool === "rect") return rectCells(x0, z0, x1, z1, state.fillShape);
  return ellipseCells(x0, z0, x1, z1, state.fillShape);
}

function commitShape(v) {
  if (!previewCells || !previewCells.size) return;
  pushUndo(snapshotLayer(state.cur));
  for (const key of previewCells.keys()) {
    const [x, z] = key.split(",").map(Number);
    paintCell(x, z, v);
  }
  previewCells = null;
  afterEdit();
}

/* ---- pointer handlers ----
   Mouse/pen: paint immediately on press (right = erase, middle/alt = pick).
   Touch: tap places on release, dragging paints a stroke, holding still
   picks the block under the finger, and a second finger switches to
   pinch-zoom / two-finger pan without leaving stray paint. */
const pointers = new Map();   // pointerId -> {x, y} (client coords)
let pinch = null;             // {d, cell, mx, my}
let touchPending = null;      // {x, z, sx, sy, picked, longTimer}
let lastPointerType = "mouse";

els.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function beginToolAction(x, z, button) {
  if (state.tool === "picker") { pickAt(x, z); return; }
  const v = toolValue(button);
  if (state.tool === "fill") { floodFill(x, z, v); return; }
  if (SHAPE_TOOLS.has(state.tool)) {
    drag = { button, startX: x, startZ: z, shape: true };
    state.shapeErase = v === 0;
    previewCells = shapeCells(state.tool, x, z, x, z);
    render();
    return;
  }
  drag = { button, snapDone: false, lastX: x, lastZ: z };
  ensureStrokeSnapshot();
  paintCell(x, z, v);
  afterEdit();
}

function startPinch() {
  if (touchPending) { clearTimeout(touchPending.longTimer); touchPending = null; }
  if (drag) { drag = null; previewCells = null; state.shapeErase = false; }
  const [a, b] = [...pointers.values()];
  pinch = {
    d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    cell: state.cell,
    mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
  };
  hoverCell = null;
  render();
}

function updatePinch() {
  if (pointers.size < 2) return;
  const [a, b] = [...pointers.values()];
  const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const target = Math.max(4, Math.min(48, Math.round(pinch.cell * (d / pinch.d))));
  if (target !== state.cell) {
    // zoom around the gesture midpoint
    const wrap = els.canvasWrap;
    const rect = wrap.getBoundingClientRect();
    const ratio = target / state.cell;
    const contentX = wrap.scrollLeft + (mx - rect.left);
    const contentY = wrap.scrollTop + (my - rect.top);
    setZoom(target);
    wrap.scrollLeft = contentX * ratio - (mx - rect.left);
    wrap.scrollTop = contentY * ratio - (my - rect.top);
  }
  // two-finger pan
  els.canvasWrap.scrollLeft -= mx - pinch.mx;
  els.canvasWrap.scrollTop -= my - pinch.my;
  pinch.mx = mx; pinch.my = my;
}

els.canvas.addEventListener("pointerdown", (e) => {
  if (spaceDown) return; // panning handled on wrap
  lastPointerType = e.pointerType;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  els.canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) { startPinch(); return; }
  if (pinch || pointers.size > 2) return;

  const { x, z } = cellFromEvent(e);
  if (!inBounds(x, z)) return;

  if (e.pointerType === "touch") {
    touchPending = {
      x, z, sx: e.clientX, sy: e.clientY, picked: false,
      longTimer: setTimeout(() => {
        if (!touchPending) return;
        touchPending.picked = true;
        pickAt(touchPending.x, touchPending.z);
        if (navigator.vibrate) navigator.vibrate(12);
      }, 430),
    };
    return;
  }

  if (e.button === 1 || e.altKey) { e.preventDefault(); pickAt(x, z); return; }
  beginToolAction(x, z, e.button);
});

els.canvas.addEventListener("pointermove", (e) => {
  lastPointerType = e.pointerType;
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (pinch) { updatePinch(); return; }

  const { x, z } = cellFromEvent(e);

  // touch: promote a held tap into a stroke/shape once the finger moves
  if (touchPending) {
    if (Math.hypot(e.clientX - touchPending.sx, e.clientY - touchPending.sy) > 12) {
      const t = touchPending;
      clearTimeout(t.longTimer);
      touchPending = null;
      if (!t.picked && state.tool !== "picker" && state.tool !== "fill") {
        beginToolAction(t.x, t.z, 0);
        if (drag && drag.shape) {
          previewCells = shapeCells(state.tool, drag.startX, drag.startZ, x, z);
          render();
        } else if (drag && inBounds(x, z)) {
          const v = toolValue(0);
          for (const key of lineCells(t.x, t.z, x, z).keys()) {
            const [ix, iz] = key.split(",").map(Number);
            paintCell(ix, iz, v);
          }
          drag.lastX = x; drag.lastZ = z;
          afterEdit();
        }
      }
    }
    return;
  }

  const changedHover =
    !hoverCell || hoverCell.x !== x || hoverCell.z !== z;
  hoverCell = { x, z };
  updateStatusPos(x, z);

  if (drag) {
    if (drag.shape) {
      previewCells = shapeCells(state.tool, drag.startX, drag.startZ, x, z);
      render();
      return;
    }
    if (inBounds(x, z)) {
      const v = toolValue(drag.button);
      // interpolate so fast strokes don't leave gaps
      for (const key of lineCells(drag.lastX, drag.lastZ, x, z).keys()) {
        const [ix, iz] = key.split(",").map(Number);
        paintCell(ix, iz, v);
      }
      drag.lastX = x; drag.lastZ = z;
      afterEdit();
      return;
    }
  }
  if (changedHover) render();
});

function endStroke() {
  if (drag && drag.shape) commitShape(toolValue(drag.button));
  drag = null;
  state.shapeErase = false;
}

els.canvas.addEventListener("pointerup", (e) => {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (touchPending) {
    // a clean tap: act on release
    const t = touchPending;
    touchPending = null;
    clearTimeout(t.longTimer);
    if (!t.picked) {
      if (state.tool === "picker") pickAt(t.x, t.z);
      else if (state.tool === "fill") floodFill(t.x, t.z, toolValue(0));
      else {
        pushUndo(snapshotLayer(state.cur));
        paintCell(t.x, t.z, toolValue(0));
        afterEdit();
      }
    }
    return;
  }
  endStroke();
});

els.canvas.addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (touchPending) { clearTimeout(touchPending.longTimer); touchPending = null; }
  drag = null; previewCells = null; state.shapeErase = false;
  render();
});

els.canvas.addEventListener("pointerleave", () => {
  hoverCell = null;
  els.statusPos.textContent = "—";
  if (!drag) render();
});

/* ---- drag & drop a block from the palette straight onto the canvas ---- */
els.canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  const c2 = cellFromEvent(e);
  if (!hoverCell || hoverCell.x !== c2.x || hoverCell.z !== c2.z) {
    hoverCell = c2;
    render();
  }
});
els.canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const { x, z } = cellFromEvent(e);
  if (!inBounds(x, z)) return;
  setTool("pencil");
  pushUndo(snapshotLayer(state.cur));
  paintCell(x, z, curBlock().index);
  afterEdit();
});

/* ---- space + drag panning ---- */
document.addEventListener("keydown", (e) => {
  // Space must keep its native role on focused controls (toggling a
  // checkbox, pressing a button) — only hijack it for panning otherwise.
  if (e.code === "Space" && !isInteractiveFocused()) {
    spaceDown = true;
    els.canvas.style.cursor = "grab";
    e.preventDefault();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceDown = false;
    setTool(state.tool);
  }
});
els.canvasWrap.addEventListener("pointerdown", (e) => {
  if (!spaceDown) return;
  panDrag = { x: e.clientX, y: e.clientY, sl: els.canvasWrap.scrollLeft, st: els.canvasWrap.scrollTop };
  els.canvasWrap.setPointerCapture(e.pointerId);
  e.preventDefault();
});
els.canvasWrap.addEventListener("pointermove", (e) => {
  if (!panDrag) return;
  els.canvasWrap.scrollLeft = panDrag.sl - (e.clientX - panDrag.x);
  els.canvasWrap.scrollTop = panDrag.st - (e.clientY - panDrag.y);
});
els.canvasWrap.addEventListener("pointerup", () => { panDrag = null; });

/* ---- zoom ---- */
function setZoom(cell) {
  state.cell = Math.max(4, Math.min(48, Math.round(cell)));
  els.zoomLabel.textContent = state.cell + "px";
  canvasSize();
  render();
}
$("zoom-in").addEventListener("click", () => setZoom(state.cell + 4));
$("zoom-out").addEventListener("click", () => setZoom(state.cell - 4));
$("zoom-fit").addEventListener("click", fitZoom);
function fitZoom() {
  const availW = els.canvasWrap.clientWidth - RULER - 60;
  const availH = els.canvasWrap.clientHeight - RULER - 60;
  if (availW < 40 || availH < 40) return; // editor view is hidden — keep current zoom
  setZoom(Math.min(availW / state.w, availH / state.d));
}
els.canvasWrap.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(state.cell + (e.deltaY < 0 ? 2 : -2));
}, { passive: false });

/* ---- layers ---- */
function setLayer(y, doRender = true) {
  state.cur = Math.max(0, Math.min(state.h - 1, y));
  els.layerNum.textContent = state.cur + 1;
  els.layerTotal.textContent = state.h;
  els.layerSlider.max = state.h - 1;
  els.layerSlider.value = state.cur;
  const qbLayer = $("qb-layer");
  if (qbLayer) qbLayer.textContent = state.cur + 1;
  if (doRender) {
    render();
    scheduleSideUpdates();
  }
}
$("layer-up").addEventListener("click", () => setLayer(state.cur + 1));
$("layer-down").addEventListener("click", () => setLayer(state.cur - 1));
els.layerSlider.addEventListener("input", () => setLayer(+els.layerSlider.value));

$("layer-dup").addEventListener("click", () => {
  if (state.cur >= state.h - 1) { toast("Already at the top layer", true); return; }
  pushUndo(snapshotLayer(state.cur + 1));
  const size = state.d * state.w;
  const src = state.grid.subarray(state.cur * size, (state.cur + 1) * size);
  state.grid.set(src, (state.cur + 1) * size);
  setLayer(state.cur + 1, false);
  afterEdit(true);
  toast(`Layer ${state.cur} copied up to layer ${state.cur + 1}`);
});
$("layer-clear").addEventListener("click", () => {
  pushUndo(snapshotLayer(state.cur));
  const size = state.d * state.w;
  state.grid.fill(0, state.cur * size, (state.cur + 1) * size);
  afterEdit();
  toast(`Layer ${state.cur + 1} cleared`);
});

/* ---- edit plumbing ---- */
let sideTimer = null;
function afterEdit(full = false) {
  state.dirty = true;
  render();
  if (full) setLayer(state.cur, false);
  scheduleSideUpdates();
}
function scheduleSideUpdates() {
  clearTimeout(sideTimer);
  sideTimer = setTimeout(() => {
    updateMaterials();
    if (!els.previewPanel.classList.contains("hidden")) renderPreview();
    autosave();
    updateStatusSize();
  }, 120);
}
function updateStatusPos(x, z) {
  if (!inBounds(x, z)) { els.statusPos.textContent = "—"; return; }
  const v = getCell(x, z, state.cur);
  els.statusPos.textContent =
    `X ${x + 1} · Z ${z + 1} · Y ${state.cur + 1}` + (v ? ` · ${BLOCKS[v - 1].name}` : "");
}
function updateStatusSize() {
  els.statusSize.textContent = `${state.w}×${state.d} · ${state.h} layer${state.h > 1 ? "s" : ""}`;
}

/* ------------------------------------------------------------
   6. Materials
   ------------------------------------------------------------ */
function countMaterials(layerOnly) {
  const counts = new Map(); // block index (1-based) -> count
  const size = state.d * state.w;
  const from = layerOnly ? state.cur * size : 0;
  const to = layerOnly ? (state.cur + 1) * size : state.grid.length;
  for (let i = from; i < to; i++) {
    const v = state.grid[i];
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([v, n]) => ({ block: BLOCKS[v - 1], n }))
    .sort((a, b) => b.n - a.n);
}

function fmtCount(n, id) {
  const stack = stackSizeOf(id);
  if (stack === 1) return n === 1 ? "1 bucket" : `${n} buckets — don't stack`;
  if (n < stack) return `${n}`;
  const stacks = Math.floor(n / stack), rem = n % stack;
  let s = `${stacks} stack${stacks > 1 ? "s" : ""}${rem ? ` + ${rem}` : ""}`;
  if (n >= stack * 27) {
    const sh = (n / (stack * 27)).toFixed(1).replace(/\.0$/, "");
    s += ` · ${sh} shulker${sh !== "1" ? "s" : ""}`;
  }
  return s;
}

function updateMaterials() {
  const rows = countMaterials(state.layerOnly);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const scope = state.layerOnly ? `layer ${state.cur + 1}` : "whole build";
  els.matSummary.innerHTML = total
    ? `<b>${total.toLocaleString()}</b> blocks · <b>${rows.length}</b> types · ${scope}` +
      (total >= 64 ? ` · ≈<b>${Math.ceil(total / 64).toLocaleString()}</b> stacks` : "")
    : "";
  if (!rows.length) {
    els.matList.innerHTML =
      `<div class="mat-empty">No blocks yet.<br>Pick a block on the left and start drawing —<br>your shopping list appears here.</div>`;
    return;
  }
  els.matList.innerHTML = rows.map(({ block, n }) => `
    <div class="mat-row">
      <span class="chip" style="background:${block.color}"></span>
      <span class="mat-name">
        <span class="n">${block.name}</span>
        ${block.note ? `<span class="note">${block.note}</span>` : ""}
      </span>
      <span class="mat-count">
        <span class="total">${n.toLocaleString()}</span>
        <span class="stacks">${fmtCount(n, block.id)}</span>
      </span>
    </div>`).join("");
}

function materialsText() {
  const layerOnly = state.layerOnly;
  const rows = countMaterials(layerOnly);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const pad = Math.max(...rows.map((r) => r.block.name.length), 10);
  const lines = rows.map(
    ({ block, n }) => `${block.name.padEnd(pad + 2)}×${String(n).padStart(5)}   ${fmtCount(n, block.id)}`
  );
  return [
    `${state.name} — ${state.w}×${state.d}×${state.h} (BlockCraft Planner)` +
      (layerOnly ? ` — layer ${state.cur + 1} only` : ""),
    `Total blocks: ${total}`,
    "",
    ...lines,
  ].join("\n");
}

$("opt-layer-only").addEventListener("change", (e) => {
  state.layerOnly = e.target.checked;
  updateMaterials();
});
$("btn-copy-mats").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(materialsText());
    toast("Material list copied to clipboard");
  } catch {
    toast("Couldn't access clipboard — use Export instead", true);
  }
});

/* ------------------------------------------------------------
   7. Isometric preview
   ------------------------------------------------------------ */
function rotatedDims(rot, w, d) { return rot % 2 === 0 ? [w, d] : [d, w]; }
function rotatedGet(rot, x, z, y, w, d, get) {
  // (x,z) in rotated space -> original coords
  switch (rot) {
    case 0: return get(x, z, y);
    case 1: return get(z, d - 1 - x, y);       // rotated space: w'=d, d'=w
    case 2: return get(w - 1 - x, d - 1 - z, y);
    default: return get(w - 1 - z, x, y);
  }
}

/**
 * Renders an isometric view of a voxel volume onto ctx2d.
 * get(x,z,y) returns 0 or 1-based block index. Returns {width,height} used.
 */
function renderIso(ctx2d, canvas, get, W, D, H, maxPx, cutY = -1) {
  // tile size: fit into maxPx box
  const tw = Math.max(4, Math.min(26, Math.floor(maxPx / ((W + D) / 2 + 1)) * 2));
  const th = tw / 2;
  const bh = Math.round(tw * 0.55); // vertical block height in px
  const wpx = ((W + D) / 2) * tw + tw;
  const hpx = ((W + D) / 2) * th + (H + 1) * bh + th * 2;
  canvas.width = Math.ceil(wpx);
  canvas.height = Math.ceil(hpx);
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  const ox = (D - 1) * (tw / 2) + tw / 2;             // origin so all x-z fit
  const oy = H * bh + th;

  const effH = cutY >= 0 ? Math.min(H, cutY + 1) : H;
  const opaque = (x, z, y) => {
    if (x < 0 || x >= W || z < 0 || z >= D || y < 0 || y >= effH) return false;
    const v = get(x, z, y);
    return v !== 0 && BLOCKS[v - 1].alpha == null;
  };

  for (let s = 0; s <= W + D - 2; s++) {
    for (let y = 0; y < effH; y++) {
      const xMin = Math.max(0, s - (D - 1)), xMax = Math.min(W - 1, s);
      for (let x = xMin; x <= xMax; x++) {
        const z = s - x;
        const v = get(x, z, y);
        if (!v) continue;
        // culled if the three visible faces are all covered
        if (opaque(x, z, y + 1) && opaque(x + 1, z, y) && opaque(x, z + 1, y)) continue;
        const b = BLOCKS[v - 1];
        const sx = ox + (x - z) * (tw / 2);
        const sy = oy + (x + z) * (th / 2) - y * bh;
        drawIsoBlock(ctx2d, sx, sy, tw, th, bh, b);
      }
    }
  }
  return { width: canvas.width, height: canvas.height };
}

function drawIsoBlock(c, sx, sy, tw, th, bh, b) {
  const alpha = b.alpha != null ? b.alpha : 1;
  c.globalAlpha = alpha;
  // top face (diamond)
  c.fillStyle = shadeColor(b.color, 0.18);
  c.beginPath();
  c.moveTo(sx, sy - bh);
  c.lineTo(sx + tw / 2, sy - bh + th / 2);
  c.lineTo(sx, sy - bh + th);
  c.lineTo(sx - tw / 2, sy - bh + th / 2);
  c.closePath(); c.fill();
  // left face
  c.fillStyle = shadeColor(b.color, -0.28);
  c.beginPath();
  c.moveTo(sx - tw / 2, sy - bh + th / 2);
  c.lineTo(sx, sy - bh + th);
  c.lineTo(sx, sy + th);
  c.lineTo(sx - tw / 2, sy + th / 2);
  c.closePath(); c.fill();
  // right face
  c.fillStyle = shadeColor(b.color, -0.12);
  c.beginPath();
  c.moveTo(sx + tw / 2, sy - bh + th / 2);
  c.lineTo(sx, sy - bh + th);
  c.lineTo(sx, sy + th);
  c.lineTo(sx + tw / 2, sy + th / 2);
  c.closePath(); c.fill();
  c.globalAlpha = 1;
}

function renderPreview() {
  const rot = state.previewRot;
  const [W, D] = rotatedDims(rot, state.w, state.d);
  const maxPx = Math.max(280, els.previewWrap.clientWidth - 16);
  renderIso(
    pctx, els.previewCanvas,
    (x, z, y) => rotatedGet(rot, x, z, y, state.w, state.d, getCell),
    W, D, state.h, maxPx,
    state.previewCut ? state.cur : -1
  );
}

$("preview-rotate").addEventListener("click", () => {
  state.previewRot = (state.previewRot + 1) % 4;
  renderPreview();
});
$("opt-preview-cut").addEventListener("change", (e) => {
  state.previewCut = e.target.checked;
  renderPreview();
});

/* ---- right-panel tabs ---- */
function showTab(which) {
  const mat = which === "materials";
  els.materialsPanel.classList.toggle("hidden", !mat);
  els.previewPanel.classList.toggle("hidden", mat);
  els.tabMaterials.classList.toggle("active", mat);
  els.tabPreview.classList.toggle("active", !mat);
  els.tabMaterials.setAttribute("aria-selected", mat);
  els.tabPreview.setAttribute("aria-selected", !mat);
  if (!mat) renderPreview();
}
els.tabMaterials.addEventListener("click", () => showTab("materials"));
els.tabPreview.addEventListener("click", () => showTab("preview"));

/* ------------------------------------------------------------
   8. Modals
   ------------------------------------------------------------ */
let modalReturnFocus = null;
function openModal(title, bodyHTML) {
  if (els.modalBackdrop.classList.contains("hidden"))
    modalReturnFocus = document.activeElement;
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHTML;
  els.modalBackdrop.classList.remove("hidden");
  $("modal").focus();
  els.modalBody.scrollTop = 0;
}
function closeModal() {
  els.modalBackdrop.classList.add("hidden");
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
  modalReturnFocus = null;
}
$("modal-close").addEventListener("click", closeModal);
// Close only on a true backdrop click — not when a drag (e.g. selecting
// text in an input) merely ends over the backdrop.
let backdropPressed = false;
els.modalBackdrop.addEventListener("pointerdown", (e) => {
  backdropPressed = e.target === els.modalBackdrop;
});
els.modalBackdrop.addEventListener("click", (e) => {
  if (e.target === els.modalBackdrop && backdropPressed) closeModal();
  backdropPressed = false;
});

/* ---- New blueprint ---- */
$("btn-new").addEventListener("click", () => {
  openModal("New Blueprint", `
    <div class="form-grid">
      <label for="new-name">Name</label><input id="new-name" value="Untitled Build" maxlength="40">
      <label for="new-w">Width (X)</label><input id="new-w" type="number" min="1" max="${LIMITS.maxW}" value="${state.w}">
      <label for="new-d">Depth (Z)</label><input id="new-d" type="number" min="1" max="${LIMITS.maxD}" value="${state.d}">
      <label for="new-h">Height (layers)</label><input id="new-h" type="number" min="1" max="${LIMITS.maxH}" value="${state.h}">
      <div class="form-note">Width runs left–right on the grid, depth runs top–bottom, and each layer is one
      Y-level in game. Max ${LIMITS.maxW}×${LIMITS.maxD}×${LIMITS.maxH}. “Resize” keeps your existing blocks
      (anchored at the top-left corner of layer 1).</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-accent" id="new-create">Create empty</button>
      <button class="btn" id="new-resize">Resize current</button>
    </div>`);
  const dims = () => {
    const clamp = (v, hi) => Math.max(1, Math.min(hi, Math.round(+v || 1)));
    return {
      name: $("new-name").value.trim() || "Untitled Build",
      w: clamp($("new-w").value, LIMITS.maxW),
      d: clamp($("new-d").value, LIMITS.maxD),
      h: clamp($("new-h").value, LIMITS.maxH),
    };
  };
  $("new-create").addEventListener("click", () => {
    const { name, w, d, h } = dims();
    pushUndo(snapshotFull());
    state.name = name; els.bpName.value = name;
    state.w = w; state.d = d; state.h = h;
    state.grid = newGrid(w, d, h);
    state.cur = 0;
    closeModal();
    canvasSize(); fitZoom(); afterEdit(true);
    toast(`New ${w}×${d}×${h} blueprint`);
  });
  $("new-resize").addEventListener("click", () => {
    const { w, d, h } = dims();
    pushUndo(snapshotFull());
    const g = newGrid(w, d, h);
    for (let y = 0; y < Math.min(h, state.h); y++)
      for (let z = 0; z < Math.min(d, state.d); z++)
        for (let x = 0; x < Math.min(w, state.w); x++)
          g[(y * d + z) * w + x] = getCell(x, z, y);
    state.w = w; state.d = d; state.h = h; state.grid = g;
    state.cur = Math.min(state.cur, h - 1);
    closeModal();
    canvasSize(); fitZoom(); afterEdit(true);
    toast(`Resized to ${w}×${d}×${h}`);
  });
});

/* ---- Templates ---- */
function templateGrid(t) {
  const g = newGrid(t.width, t.depth, t.height);
  t.layers.forEach((layer, y) => {
    layer.forEach((row, z) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        const b = BLOCK_BY_ID[t.legend[ch]];
        if (b) g[(y * t.depth + z) * t.width + x] = b.index;
      }
    });
  });
  return g;
}

/* ============================================================
   Site views: browse (home), build detail, routing
   ============================================================ */
const TPL_CACHE = new Map(); // id -> {g, rows, total}
function templateData(t) {
  let d = TPL_CACHE.get(t.id);
  if (!d) {
    const g = templateGrid(t);
    const counts = new Map();
    g.forEach((v) => { if (v) counts.set(v, (counts.get(v) || 0) + 1); });
    const rows = [...counts.entries()]
      .map(([v, n]) => ({ block: BLOCKS[v - 1], n }))
      .sort((a, b) => b.n - a.n);
    d = { g, rows, total: rows.reduce((a, r) => a + r.n, 0) };
    TPL_CACHE.set(t.id, d);
  }
  return d;
}

/* front-facing accessor for gallery/detail renders */
const frontGet = (t, g) => (x, z, y) =>
  g[(y * t.depth + (t.depth - 1 - z)) * t.width + (t.width - 1 - x)];

/* ---- browse (home) ---- */
const browseFilter = { q: "", scale: "all", diff: "all" };
let chipsBuilt = false;

function buildChips() {
  if (chipsBuilt) return;
  chipsBuilt = true;
  const mk = (host, options, key) => {
    $(host).innerHTML = options.map(([val, label]) =>
      `<button class="fchip${browseFilter[key] === val ? " active" : ""}" data-v="${val}">${label}</button>`).join("");
    $(host).querySelectorAll(".fchip").forEach((ch) =>
      ch.addEventListener("click", () => {
        browseFilter[key] = ch.dataset.v;
        $(host).querySelectorAll(".fchip").forEach((c) => c.classList.toggle("active", c === ch));
        renderBrowse();
      }));
  };
  mk("chips-scale", [["all", "All sizes"], ["quick", "⚡ Quick builds"], ["grand", "🏰 Grand builds"]], "scale");
  mk("chips-diff", [["all", "Any difficulty"], ["Beginner", "Beginner"], ["Intermediate", "Intermediate"], ["Advanced", "Advanced"]], "diff");
  let searchTimer;
  $("browse-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { browseFilter.q = e.target.value.trim().toLowerCase(); renderBrowse(); }, 140);
  });
  $("hero-ideas").addEventListener("click", () => showIdeaModal(rollIdea()));
}

function browseCard(t) {
  const { total } = templateData(t);
  return `
    <a class="tpl-card" href="#/build/${t.id}">
      <canvas class="tpl-thumb" data-id="${t.id}"></canvas>
      <span class="tpl-info">
        <h3>${t.name}</h3>
        <span class="tpl-meta">
          <span class="tpl-badge d-${t.difficulty}">${t.difficulty}</span>
          <span class="tpl-badge">${t.category}</span>
          <span class="tpl-badge">${t.size}</span>
          <span class="tpl-badge">${total.toLocaleString()} blocks</span>
        </span>
        <span class="tpl-desc">${t.description.split(". ")[0].replace(/\.+$/, "")}.</span>
      </span>
    </a>`;
}

function renderBrowse() {
  buildChips();
  const { q, scale, diff } = browseFilter;
  const list = TEMPLATES.filter((t) => {
    if (scale === "quick" && t.scale === "grand") return false;
    if (scale === "grand" && t.scale !== "grand") return false;
    if (diff !== "all" && t.difficulty !== diff) return false;
    if (q && !(t.name + " " + t.category + " " + t.description).toLowerCase().includes(q)) return false;
    return true;
  });
  $("browse-grid").innerHTML = list.map(browseCard).join("");
  $("browse-count").innerHTML = `All builds · <b>${list.length}</b> of ${TEMPLATES.length}`;
  $("browse-empty").classList.toggle("hidden", list.length > 0);
  $("browse-grid").querySelectorAll("canvas.tpl-thumb").forEach((cv) => {
    const t = TEMPLATES.find((x) => x.id === cv.dataset.id);
    const { g } = templateData(t);
    renderIso(cv.getContext("2d"), cv, frontGet(t, g), t.width, t.depth, t.height, 200);
    cv.style.height = "140px";
  });
  renderMyBuilds();
}

function renderMyBuilds() {
  const saves = readSaves();
  const names = Object.keys(saves).sort();
  $("my-builds-section").classList.toggle("hidden", names.length === 0);
  if (!names.length) return;
  $("my-builds").innerHTML = names.map((n, i) => {
    const s = saves[n];
    return `
    <div class="tpl-card" data-i="${i}">
      <canvas class="tpl-thumb" data-i="${i}"></canvas>
      <span class="tpl-info">
        <h3>${escapeHTML(n)}</h3>
        <span class="tpl-meta"><span class="tpl-badge">${s.width}×${s.depth}×${s.height}</span></span>
      </span>
      <span class="mycard-actions">
        <button class="btn btn-sm btn-accent" data-open="${i}">✏️ Open</button>
        <button class="btn btn-sm btn-danger" data-del="${i}" title="Delete">✕</button>
      </span>
    </div>`;
  }).join("");
  $("my-builds").querySelectorAll("canvas.tpl-thumb").forEach((cv) => {
    try {
      const bp = deserialize(saves[names[+cv.dataset.i]]);
      renderIso(cv.getContext("2d"), cv,
        (x, z, y) => bp.grid[(y * bp.d + (bp.d - 1 - z)) * bp.w + (bp.w - 1 - x)],
        bp.w, bp.d, bp.h, 180);
      cv.style.height = "140px";
    } catch { /* corrupt save — leave the thumb blank */ }
  });
  $("my-builds").querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => {
      try {
        const bp = deserialize(saves[names[+b.dataset.open]]);
        showView("editor");
        location.hash = "#/create";
        loadBlueprint(bp, `Opened “${bp.name}”`);
      } catch (err) { toast(err.message, true); }
    }));
  $("my-builds").querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = names[+b.dataset.del];
      delete saves[n];
      localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
      toast(`Deleted “${n}”`);
      renderMyBuilds();
    }));
}

/* ---- build detail page ---- */
let buildCtx = null; // {t, rot, layer}

function renderBuildPage(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  const { g, rows, total } = templateData(t);
  buildCtx = { t, rot: 2, layer: 0 };
  $("build-title").textContent = t.name;
  $("build-badges").innerHTML = `
    <span class="tpl-badge d-${t.difficulty}">${t.difficulty}</span>
    <span class="tpl-badge">${t.category}</span>
    <span class="tpl-badge">${t.scale === "grand" ? "Grand build" : "Quick build"}</span>`;
  $("build-desc").textContent = t.description;
  $("build-stats").innerHTML = `
    <div class="stat"><b>${t.width}×${t.depth}</b><span>footprint</span></div>
    <div class="stat"><b>${t.height}</b><span>layers</span></div>
    <div class="stat"><b>${total.toLocaleString()}</b><span>blocks</span></div>
    <div class="stat"><b>${rows.length}</b><span>block types</span></div>`;
  $("build-tips").innerHTML = t.tips.map((tip) => `<li>${tip}</li>`).join("");
  $("build-materials").innerHTML = rows.map(({ block, n }) => `
    <div class="mat-row">
      <span class="chip" style="background:${block.color}"></span>
      <span class="mat-name"><span class="n">${block.name}</span>
        ${block.note ? `<span class="note">${block.note}</span>` : ""}</span>
      <span class="mat-count"><span class="total">${n.toLocaleString()}</span>
        <span class="stacks">${fmtCount(n, block.id)}</span></span>
    </div>`).join("");
  $("build-layerview").classList.add("hidden");
  const slider = $("bl-slider");
  slider.max = t.height - 1;
  slider.value = 0;
  drawBuildIso();
  document.querySelector("#view-build").scrollTop = 0;
}

function drawBuildIso() {
  const { t, rot } = buildCtx;
  const { g } = templateData(t);
  const [W, D] = rotatedDims(rot, t.width, t.depth);
  const cv = $("build-iso");
  const maxPx = Math.min(620, Math.max(300, window.innerWidth - 80));
  renderIso(cv.getContext("2d"), cv,
    (x, z, y) => rotatedGet(rot, x, z, y, t.width, t.depth,
      (ox, oz, oy) => g[(oy * t.depth + oz) * t.width + ox]),
    W, D, t.height, maxPx);
}

function drawBuildLayer() {
  const { t, layer } = buildCtx;
  const { g } = templateData(t);
  const cell = Math.max(8, Math.min(24, Math.floor(600 / Math.max(t.width, t.depth))));
  const cv = $("build-layer-canvas");
  cv.width = t.width * cell + 1;
  cv.height = t.depth * cell + 1;
  const c = cv.getContext("2d");
  c.fillStyle = "#101215";
  c.fillRect(0, 0, cv.width, cv.height);
  for (let z = 0; z < t.depth; z++)
    for (let x = 0; x < t.width; x++) {
      const v = g[(layer * t.depth + z) * t.width + x];
      if (!v) continue;
      const b = BLOCKS[v - 1];
      c.globalAlpha = b.alpha != null ? b.alpha : 1;
      c.fillStyle = b.color;
      c.fillRect(x * cell, z * cell, cell, cell);
      c.globalAlpha = 1;
    }
  c.strokeStyle = "rgba(255,255,255,.09)";
  c.beginPath();
  for (let x = 0; x <= t.width; x++) { c.moveTo(x * cell + 0.5, 0); c.lineTo(x * cell + 0.5, cv.height); }
  for (let z = 0; z <= t.depth; z++) { c.moveTo(0, z * cell + 0.5); c.lineTo(cv.width, z * cell + 0.5); }
  c.stroke();
  $("bl-label").textContent = `Layer ${layer + 1} / ${t.height}`;
  $("bl-slider").value = layer;
}

function setBuildLayer(y) {
  buildCtx.layer = Math.max(0, Math.min(buildCtx.t.height - 1, y));
  drawBuildLayer();
}

$("build-rotate").addEventListener("click", () => {
  buildCtx.rot = (buildCtx.rot + 1) % 4;
  drawBuildIso();
});
$("build-layers-toggle").addEventListener("click", () => {
  const lv = $("build-layerview");
  lv.classList.toggle("hidden");
  if (!lv.classList.contains("hidden")) drawBuildLayer();
});
$("bl-up").addEventListener("click", () => setBuildLayer(buildCtx.layer + 1));
$("bl-down").addEventListener("click", () => setBuildLayer(buildCtx.layer - 1));
$("bl-slider").addEventListener("input", () => setBuildLayer(+$("bl-slider").value));
$("build-open").addEventListener("click", () => {
  const { t } = buildCtx;
  const { g } = templateData(t);
  showView("editor");
  location.hash = "#/create";
  loadBlueprint({ name: t.name, w: t.width, d: t.depth, h: t.height, grid: g.slice() },
    `Loaded “${t.name}” — step through the layers with the ▲▼ buttons`);
});
$("build-json").addEventListener("click", () => {
  const { t } = buildCtx;
  const { g } = templateData(t);
  downloadBlob(
    new Blob([JSON.stringify(serializeAny(t.name, t.width, t.depth, t.height, g), null, 1)],
      { type: "application/json" }),
    safeFileName(t.name) + ".blockcraft.json");
  toast("Blueprint JSON downloaded");
});
$("build-mats").addEventListener("click", async () => {
  const { t } = buildCtx;
  const { rows, total } = templateData(t);
  const pad = Math.max(...rows.map((r) => r.block.name.length), 10);
  const text = [
    `${t.name} — ${t.size} (BlockCraft Builds)`,
    `Total blocks: ${total}`, "",
    ...rows.map(({ block, n }) =>
      `${block.name.padEnd(pad + 2)}×${String(n).padStart(5)}   ${fmtCount(n, block.id)}`),
  ].join("\n");
  try { await navigator.clipboard.writeText(text); toast("Material list copied"); }
  catch { toast("Couldn't access clipboard", true); }
});

/* ---- routing ---- */
let editorReady = false;
function showView(name) {
  for (const v of ["browse", "build", "editor"]) {
    $("view-" + v).classList.toggle("hidden", v !== name);
    document.body.classList.toggle("view-" + v, v === name);
  }
  document.querySelectorAll(".site-links a").forEach((a) =>
    a.classList.toggle("active",
      a.dataset.nav === name || (name === "build" && a.dataset.nav === "browse")));
  if (name === "editor") {
    if (!editorReady) {
      editorReady = true;
      canvasSize(); fitZoom(); updateStatusSize();
    }
    render();
  }
}
function route() {
  const h = location.hash || "#/builds";
  const m = h.match(/^#\/build\/([\w-]+)/);
  if (m && TEMPLATES.some((t) => t.id === m[1])) {
    showView("build");
    renderBuildPage(m[1]);
    return;
  }
  if (h.startsWith("#/create")) { showView("editor"); return; }
  showView("browse");
  renderBrowse();
}
window.addEventListener("hashchange", route);

/* ---- Guides ---- */
$("btn-guides").addEventListener("click", showGuidesModal);
function showGuidesModal() {
  openModal("Building Guides", `<div class="guide-list">${GUIDES.map((g, i) => `
    <button class="guide-item" data-i="${i}">
      <span class="g-icon">${g.icon}</span>
      <span><h3>${g.title}</h3><p>${g.blurb}</p></span>
    </button>`).join("")}</div>`);
  els.modalBody.querySelectorAll(".guide-item").forEach((item) => {
    item.addEventListener("click", () => {
      const g = GUIDES[+item.dataset.i];
      openModal(g.title, `
        <button class="btn btn-sm back-link" id="guide-back">← All guides</button>
        <div class="guide-article">${g.body}</div>`);
      $("guide-back").addEventListener("click", showGuidesModal);
    });
  });
}

/* ------------------------------------------------------------
   9. Save / open / import / export
   ------------------------------------------------------------ */
function serializeAny(name, w, d, h, grid) {
  // Compact palette-indexed format
  const used = new Map(); // block index -> palette pos
  const palette = [];
  const layers = [];
  const size = d * w;
  for (let y = 0; y < h; y++) {
    const rows = [];
    for (let z = 0; z < d; z++) {
      const row = new Array(w);
      for (let x = 0; x < w; x++) {
        const v = grid[y * size + z * w + x];
        if (!v) { row[x] = 0; continue; }
        if (!used.has(v)) { used.set(v, palette.length + 1); palette.push(BLOCKS[v - 1].id); }
        row[x] = used.get(v);
      }
      rows.push(row);
    }
    layers.push(rows);
  }
  return {
    app: "blockcraft-planner", version: 1,
    name, width: w, depth: d, height: h,
    palette, layers,
    savedAt: new Date().toISOString(),
  };
}
function serialize() {
  return serializeAny(state.name, state.w, state.d, state.h, state.grid);
}

function deserialize(data) {
  if (!data || data.app !== "blockcraft-planner" || !Array.isArray(data.layers))
    throw new Error("Not a BlockCraft Planner file");
  const w = Math.min(LIMITS.maxW, data.width | 0);
  const d = Math.min(LIMITS.maxD, data.depth | 0);
  const h = Math.min(LIMITS.maxH, data.height | 0);
  if (w < 1 || d < 1 || h < 1) throw new Error("Bad blueprint dimensions");
  const paletteIdx = (data.palette || []).map((id) => (BLOCK_BY_ID[id] ? BLOCK_BY_ID[id].index : 0));
  const grid = newGrid(w, d, h);
  let unknown = 0;
  for (let y = 0; y < h; y++) {
    const rows = data.layers[y] || [];
    for (let z = 0; z < d; z++) {
      const row = rows[z] || [];
      for (let x = 0; x < w; x++) {
        const p = row[x] | 0;
        if (!p) continue;
        const bi = paletteIdx[p - 1] || 0;
        if (!bi && p) unknown++;
        grid[(y * d + z) * w + x] = bi;
      }
    }
  }
  return { name: String(data.name || "Imported Build").slice(0, 40), w, d, h, grid, unknown };
}

function loadBlueprint(bp, announce) {
  pushUndo(snapshotFull());
  state.name = bp.name; els.bpName.value = bp.name;
  state.w = bp.w; state.d = bp.d; state.h = bp.h;
  state.grid = bp.grid;
  state.cur = 0;
  canvasSize(); fitZoom(); afterEdit(true);
  if (announce) toast(announce);
}

/* ---- autosave ---- */
function autosave() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serialize())); }
  catch { /* storage full or blocked — non-fatal */ }
}

/* ---- named saves ---- */
function readSaves() {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY)) || {}; }
  catch { return {}; }
}
$("btn-save").addEventListener("click", () => {
  const saves = readSaves();
  const key = state.name.trim() || "Untitled Build";
  // defineProperty so hostile-looking names like "__proto__" still save
  Object.defineProperty(saves, key, {
    value: serialize(), enumerable: true, writable: true, configurable: true,
  });
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    toast(`Saved “${key}” in this browser`);
  } catch {
    toast("Browser storage is full — use Export → JSON instead", true);
  }
});

$("btn-open").addEventListener("click", () => {
  const saves = readSaves();
  const names = Object.keys(saves).sort();
  if (!names.length) {
    openModal("Open Blueprint", `<p style="color:var(--text-dim)">No saved blueprints yet.
      Use <strong>💾 Save</strong> to keep named copies in this browser, or
      <strong>⬆️ Import</strong> to open a JSON file.</p>`);
    return;
  }
  openModal("Open Blueprint", `<div class="saved-list">${names.map((n, i) => {
    const s = saves[n];
    return `<div class="saved-row">
      <span class="s-name">${escapeHTML(n)}</span>
      <span class="s-meta">${s.width}×${s.depth}×${s.height}</span>
      <button class="btn btn-sm" data-open="${i}">Open</button>
      <button class="btn btn-sm btn-danger" data-del="${i}">Delete</button>
    </div>`;
  }).join("")}</div>`);
  els.modalBody.querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => {
      try {
        const bp = deserialize(saves[names[+b.dataset.open]]);
        closeModal();
        loadBlueprint(bp, `Opened “${bp.name}”`);
      } catch (err) { toast(err.message, true); }
    }));
  els.modalBody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = names[+b.dataset.del];
      delete saves[n];
      localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
      toast(`Deleted “${n}”`);
      closeModal();
      $("btn-open").click();
    }));
});

/* ---- import ---- */
$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const bp = deserialize(JSON.parse(await file.text()));
    loadBlueprint(bp, bp.unknown
      ? `Imported with ${bp.unknown} unknown block(s) skipped`
      : `Imported “${bp.name}”`);
  } catch (err) {
    toast(`Import failed: ${err.message}`, true);
  }
});

/* ---- export ---- */
$("btn-export").addEventListener("click", () => {
  openModal("Export", `<div class="export-grid">
    <button class="export-opt" id="exp-json">
      <span class="e-icon">🗂️</span>
      <span><h3>Blueprint file (JSON)</h3>
      <p>Download a file you can back up, share, and re-import here.</p></span>
    </button>
    <button class="export-opt" id="exp-png">
      <span class="e-icon">🖼️</span>
      <span><h3>Blueprint sheet (PNG)</h3>
      <p>Every layer laid out with the material list — print it or keep it on a second screen while you build.</p></span>
    </button>
    <button class="export-opt" id="exp-mats">
      <span class="e-icon">📋</span>
      <span><h3>Material list (clipboard)</h3>
      <p>Copies the shopping list as plain text.</p></span>
    </button>
  </div>`);
  $("exp-json").addEventListener("click", () => {
    downloadBlob(
      new Blob([JSON.stringify(serialize(), null, 1)], { type: "application/json" }),
      safeFileName(state.name) + ".blockcraft.json");
    closeModal();
    toast("Blueprint JSON downloaded");
  });
  $("exp-png").addEventListener("click", () => {
    exportSheet();
    closeModal();
  });
  $("exp-mats").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(materialsText());
      toast("Material list copied");
    } catch { toast("Couldn't access clipboard", true); }
    closeModal();
  });
});

function safeFileName(name) {
  return (name.trim() || "blueprint").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_").slice(0, 40) || "blueprint";
}
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---- PNG blueprint sheet ---- */
function exportSheet() {
  const { w, d, h } = state;
  // keep the whole sheet under a pixel budget so toBlob can't blow up
  // on giant blueprints (e.g. 128×128×64)
  let cell = Math.max(3, Math.min(16, Math.floor(920 / Math.max(w, d))));
  const PIXEL_BUDGET = 32e6;
  while (cell > 3 && w * d * h * cell * cell > PIXEL_BUDGET) cell--;
  const layerW = w * cell, layerH = d * cell;
  const GAP = 26, LABEL = 18, PAD = 30;
  const maxSheetW = Math.max(layerW + PAD * 2, 1400);
  const cols = Math.max(1, Math.min(h, Math.floor((maxSheetW - PAD * 2 + GAP) / (layerW + GAP))));
  const rows = Math.ceil(h / cols);
  const mats = countMaterials(false);
  const matCols = mats.length > 24 ? 3 : mats.length > 10 ? 2 : 1;
  const matRows = Math.ceil(mats.length / matCols);
  const MAT_LH = 20;
  const headerH = 84;
  const gridH = rows * (layerH + LABEL + GAP);
  const matsH = mats.length ? matRows * MAT_LH + 56 : 0;
  const sheetW = Math.max(560, PAD * 2 + cols * (layerW + GAP) - GAP);
  const sheetH = headerH + gridH + matsH + PAD;

  const cv = document.createElement("canvas");
  cv.width = sheetW; cv.height = sheetH;
  const c = cv.getContext("2d");
  c.fillStyle = "#17191d"; c.fillRect(0, 0, sheetW, sheetH);

  c.fillStyle = "#5fbb4e";
  c.font = "bold 26px Inter, sans-serif";
  c.textBaseline = "top"; c.textAlign = "left";
  c.fillText(state.name, PAD, 26);
  c.fillStyle = "#9aa2ad";
  c.font = "14px Inter, sans-serif";
  c.fillText(`${w}×${d}×${h} — ${mats.reduce((a, r) => a + r.n, 0)} blocks — BlockCraft Planner`, PAD, 58);

  const size = d * w;
  for (let y = 0; y < h; y++) {
    const gx = PAD + (y % cols) * (layerW + GAP);
    const gy = headerH + Math.floor(y / cols) * (layerH + LABEL + GAP);
    c.fillStyle = "#c8cdd4";
    c.font = "bold 13px Inter, sans-serif";
    c.fillText(`Layer ${y + 1}`, gx, gy);
    c.fillStyle = "#101215";
    c.fillRect(gx, gy + LABEL, layerW, layerH);
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        const v = state.grid[y * size + z * w + x];
        if (!v) continue;
        c.fillStyle = BLOCKS[v - 1].color;
        c.fillRect(gx + x * cell, gy + LABEL + z * cell, cell, cell);
      }
    }
    c.strokeStyle = "rgba(255,255,255,.10)";
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= w; x += 5) {
      c.moveTo(gx + x * cell + 0.5, gy + LABEL);
      c.lineTo(gx + x * cell + 0.5, gy + LABEL + layerH);
    }
    for (let z = 0; z <= d; z += 5) {
      c.moveTo(gx, gy + LABEL + z * cell + 0.5);
      c.lineTo(gx + layerW, gy + LABEL + z * cell + 0.5);
    }
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,.25)";
    c.strokeRect(gx + 0.5, gy + LABEL + 0.5, layerW - 1, layerH - 1);
  }

  if (mats.length) {
    const my = headerH + gridH + 8;
    c.fillStyle = "#5fbb4e";
    c.font = "bold 16px Inter, sans-serif";
    c.fillText("MATERIALS", PAD, my);
    c.font = "13px Inter, sans-serif";
    const colW = (sheetW - PAD * 2) / matCols;
    mats.forEach(({ block, n }, i) => {
      const mx = PAD + Math.floor(i / matRows) * colW;
      const yy = my + 30 + (i % matRows) * MAT_LH;
      c.fillStyle = block.color;
      c.fillRect(mx, yy + 2, 12, 12);
      c.strokeStyle = "rgba(0,0,0,.5)";
      c.strokeRect(mx + 0.5, yy + 2.5, 11, 11);
      c.fillStyle = "#e8eaed";
      c.fillText(`${block.name} — ${n}  (${fmtCount(n, block.id)})`, mx + 20, yy);
    });
  }

  cv.toBlob((blob) => {
    if (!blob) {
      toast("Sheet too large for this browser — try Export → JSON instead", true);
      return;
    }
    downloadBlob(blob, safeFileName(state.name) + "_blueprint.png");
    toast("Blueprint sheet downloaded");
  }, "image/png");
}

/* ------------------------------------------------------------
   10. Shortcuts, toasts, options, boot
   ------------------------------------------------------------ */
function isTyping() {
  // Only true for text-entry fields — checkboxes, sliders and buttons
  // shouldn't swallow tool shortcuts after being clicked.
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return !["checkbox", "radio", "range", "button", "file"].includes(el.type);
}
function isInteractiveFocused() {
  const el = document.activeElement;
  return el && ["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(el.tagName);
}

document.addEventListener("keydown", (e) => {
  // Modal handling first, so Escape works even from a focused text field.
  if (!els.modalBackdrop.classList.contains("hidden")) {
    if (e.key === "Escape") closeModal();
    return;
  }
  if (e.key === "Escape" && document.body.classList.contains("sheet-open")) {
    closeSheet();
    return;
  }
  if (isTyping()) return;
  if (drag) return; // no tool/layer/undo hopping mid-stroke
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey) return;
  switch (k) {
    case "b": setTool("pencil"); break;
    case "e": setTool("eraser"); break;
    case "f": setTool("fill"); break;
    case "l": setTool("line"); break;
    case "r": setTool("rect"); break;
    case "o": setTool("ellipse"); break;
    case "i": setTool("picker"); break;
    case "[": setLayer(state.cur - 1); break;
    case "]": setLayer(state.cur + 1); break;
    case "+": case "=": setZoom(state.cell + 4); break;
    case "-": setZoom(state.cell - 4); break;
    case "g": $("opt-grid").click(); break;
    case "m": $("opt-onion").click(); break;
  }
});

let toastTimer = 0;
function toast(msg, isErr = false) {
  const t = document.createElement("div");
  t.className = "toast" + (isErr ? " err" : "");
  t.textContent = msg;
  els.toastZone.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---- mobile quick bar & block sheet ---- */
function openSheet() { document.body.classList.add("sheet-open"); }
function closeSheet() { document.body.classList.remove("sheet-open"); }
$("qb-block").addEventListener("click", openSheet);
$("sheet-close").addEventListener("click", closeSheet);
$("sheet-scrim").addEventListener("click", closeSheet);
$("qb-undo").addEventListener("click", undo);
$("qb-layer-up").addEventListener("click", () => setLayer(state.cur + 1));
$("qb-layer-down").addEventListener("click", () => setLayer(state.cur - 1));

/* ---- build idea generator ---- */
$("btn-ideas").addEventListener("click", () => showIdeaModal(rollIdea()));
function showIdeaModal(idea) {
  const { structure: s, style, twist, tip, title } = idea;
  const chips = style.palette.map((id) => {
    const b = BLOCK_BY_ID[id];
    return b ? `<button class="idea-chip" data-id="${id}" title="Select ${b.name}">
      <span class="chip" style="background:${b.color}"></span>${b.name}</button>` : "";
  }).join("");
  openModal("Build Idea", `
    <div class="idea-card">
      <div class="idea-roll" aria-hidden="true">🎲</div>
      <h3 class="idea-title">${title}</h3>
      <p class="idea-line">A <strong>${s.name}</strong> in the <strong>${style.name.toLowerCase()}</strong> palette, ${twist}.</p>
      <p class="idea-size">Suggested canvas: <b>${s.w}×${s.d}×${s.h}</b> · tap a block to put it in hand</p>
      <div class="idea-chips">${chips}</div>
      <p class="idea-tip">💡 ${tip}</p>
      <div class="form-actions">
        <button class="btn btn-accent" id="idea-start">🏗️ Start this build</button>
        <button class="btn" id="idea-again">🎲 Roll another</button>
      </div>
    </div>`);
  els.modalBody.querySelectorAll(".idea-chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      const b = BLOCK_BY_ID[chip.dataset.id];
      if (b) { selectBlock(b.index - 1); toast(`${b.name} in hand`); }
    }));
  $("idea-again").addEventListener("click", () => showIdeaModal(rollIdea()));
  $("idea-start").addEventListener("click", () => {
    showView("editor");
    location.hash = "#/create";
    pushUndo(snapshotFull());
    state.name = title.slice(0, 40);
    els.bpName.value = state.name;
    state.w = s.w; state.d = s.d; state.h = s.h;
    state.grid = newGrid(s.w, s.d, s.h);
    state.cur = 0;
    // sketch the footprint outline on layer 1 in the base block
    const base = BLOCK_BY_ID[style.palette[0]];
    if (base && s.w > 4 && s.d > 4) {
      for (let x = 1; x < s.w - 1; x++) { setCell(x, 1, 0, base.index); setCell(x, s.d - 2, 0, base.index); }
      for (let z = 1; z < s.d - 1; z++) { setCell(1, z, 0, base.index); setCell(s.w - 2, z, 0, base.index); }
      selectBlock(base.index - 1);
    }
    closeModal();
    canvasSize(); fitZoom(); afterEdit(true);
    toast(`${title} — footprint sketched on layer 1. Make it yours!`);
  });
}

/* ---- option checkboxes & misc wiring ---- */
document.querySelectorAll(".tool").forEach((b) =>
  b.addEventListener("click", () => setTool(b.dataset.tool)));
$("opt-fill-shape").addEventListener("change", (e) => { state.fillShape = e.target.checked; });
$("opt-mirror-x").addEventListener("change", (e) => { state.mirrorX = e.target.checked; render(); });
$("opt-mirror-z").addEventListener("change", (e) => { state.mirrorZ = e.target.checked; render(); });
$("opt-onion").addEventListener("change", (e) => { state.onion = e.target.checked; render(); });
$("opt-grid").addEventListener("change", (e) => { state.gridLines = e.target.checked; render(); });
els.bpName.addEventListener("input", () => { state.name = els.bpName.value; scheduleSideUpdates(); });
$("btn-undo").addEventListener("click", undo);
$("btn-redo").addEventListener("click", redo);
window.addEventListener("resize", () => {
  if (!els.previewPanel.classList.contains("hidden")) renderPreview();
});
window.addEventListener("beforeunload", autosave);

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

/* ---- boot ---- */
function boot() {
  buildPalette();
  els.paletteSearch.addEventListener("input", () => buildPalette(els.paletteSearch.value));
  selectBlock(BLOCK_BY_ID["oak_planks"].index - 1);
  setTool("pencil");

  let restored = false;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      const bp = deserialize(JSON.parse(raw));
      state.name = bp.name; state.w = bp.w; state.d = bp.d; state.h = bp.h;
      state.grid = bp.grid;
      els.bpName.value = bp.name;
      restored = true;
    }
  } catch { /* corrupted autosave — fall through to demo */ }

  if (!restored) {
    // First visit: load the starter house so the app explains itself.
    const t = TEMPLATES[0];
    state.name = t.name + " (example)";
    els.bpName.value = state.name;
    state.w = t.width; state.d = t.depth; state.h = t.height;
    state.grid = templateGrid(t);
  }

  state.cur = 0;
  canvasSize();
  fitZoom();
  setLayer(0, false);
  render();
  updateMaterials();
  updateStatusSize();
  updateUndoButtons();
  route();
  if (!restored) {
    setTimeout(() => toast("Welcome! Pick a build below — or hit ✏️ Create to start from scratch"), 700);
  }
}

boot();
