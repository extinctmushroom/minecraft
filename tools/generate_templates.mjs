/* ============================================================
   Generates js/templates_large.js — the "Grand Builds" templates.
   Large, intricate structures are built programmatically from
   voxel primitives (boxes, cylinders, cones, noise) instead of
   hand-typed layer strings, then serialized to the same
   layers-of-strings format the app loads.

   Run:  node tools/generate_templates.mjs
   ============================================================ */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------------- deterministic RNG ---------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- voxel canvas ---------------- */
class Vox {
  constructor(w, d, h) {
    this.w = w; this.d = d; this.h = h;
    this.g = new Array(w * d * h).fill(null);
  }
  idx(x, z, y) { return (y * this.d + z) * this.w + x; }
  in(x, z, y) { return x >= 0 && x < this.w && z >= 0 && z < this.d && y >= 0 && y < this.h; }
  set(x, z, y, id) { if (this.in(x, z, y)) this.g[this.idx(x, z, y)] = id; }
  get(x, z, y) { return this.in(x, z, y) ? this.g[this.idx(x, z, y)] : null; }
  /* inclusive box fill; id may be a function (x,z,y)=>id for noise */
  box(x0, z0, y0, x1, z1, y1, id) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
          this.set(x, z, y, typeof id === "function" ? id(x, z, y) : id);
  }
  clear(x0, z0, y0, x1, z1, y1) { this.box(x0, z0, y0, x1, z1, y1, null); }
  /* rectangle outline at one layer */
  ringRect(x0, z0, x1, z1, y, id) {
    this.box(x0, z0, y, x1, z0, y, id);
    this.box(x0, z1, y, x1, z1, y, id);
    this.box(x0, z0, y, x0, z1, y, id);
    this.box(x1, z0, y, x1, z1, y, id);
  }
  /* square annulus between half-widths hwIn..hwOut around (cx,cz) */
  annulusRect(cx, cz, hwIn, hwOut, y, id) {
    for (let z = cz - hwOut; z <= cz + hwOut; z++)
      for (let x = cx - hwOut; x <= cx + hwOut; x++) {
        const m = Math.max(Math.abs(x - cx), Math.abs(z - cz));
        if (m >= hwIn && m <= hwOut) this.set(x, z, y, typeof id === "function" ? id(x, z, y) : id);
      }
  }
  inDisk(cx, cz, r, x, z) {
    const dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz <= (r + 0.42) * (r + 0.42);
  }
  disk(cx, cz, y, r, id) {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (this.inDisk(cx, cz, r, x, z))
          this.set(x, z, y, typeof id === "function" ? id(x, z, y) : id);
  }
  /* circle outline: disk cells with a 4-neighbour outside the disk */
  ringCircle(cx, cz, y, r, id) {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!this.inDisk(cx, cz, r, x, z)) continue;
        if (!this.inDisk(cx, cz, r, x + 1, z) || !this.inDisk(cx, cz, r, x - 1, z) ||
            !this.inDisk(cx, cz, r, x, z + 1) || !this.inDisk(cx, cz, r, x, z - 1))
          this.set(x, z, y, typeof id === "function" ? id(x, z, y) : id);
      }
  }
  cylinder(cx, cz, y0, y1, r, id, hollow = true) {
    for (let y = y0; y <= y1; y++)
      hollow ? this.ringCircle(cx, cz, y, r, id) : this.disk(cx, cz, y, r, id);
  }
  /* count non-empty cells (sanity) */
  count() { return this.g.reduce((a, v) => a + (v ? 1 : 0), 0); }
}

/* ---------------- serializer ---------------- */
const CHAR_POOL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#@$%&*+=?!^~<>()[]{}|;:,_";

function toTemplate(meta, v) {
  // trim empty top layers
  let top = v.h - 1;
  outer: for (; top >= 0; top--) {
    for (let z = 0; z < v.d; z++)
      for (let x = 0; x < v.w; x++)
        if (v.get(x, z, top)) break outer;
  }
  const H = top + 1;
  if (H < 1) throw new Error(`${meta.id}: empty build`);
  const legend = {};   // char -> id
  const charOf = {};   // id -> char
  let next = 0;
  const layers = [];
  for (let y = 0; y < H; y++) {
    const rows = [];
    for (let z = 0; z < v.d; z++) {
      let row = "";
      for (let x = 0; x < v.w; x++) {
        const id = v.get(x, z, y);
        if (!id) { row += "."; continue; }
        if (!(id in charOf)) {
          if (next >= CHAR_POOL.length) throw new Error(`${meta.id}: legend overflow`);
          charOf[id] = CHAR_POOL[next++];
          legend[charOf[id]] = id;
        }
        row += charOf[id];
      }
      rows.push(row);
    }
    layers.push(rows);
  }
  console.log(`${meta.id}: ${v.w}×${v.d}×${H}, ${v.count()} blocks, ${next} block types`);
  return { ...meta, scale: "grand", legend, layers };
}

const templates = [];

/* ============================================================
   1. STONEHOLD KEEP — medieval castle, 31×31×20
   ============================================================ */
{
  const W = 31, D = 31, H = 20;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(1337);
  const stone = () => {
    const r = rnd();
    return r < 0.10 ? "mossy_stone_bricks" : r < 0.17 ? "cracked_stone_bricks" : "stone_bricks";
  };

  // ground: grass courtyard on a cobble rim
  v.box(0, 0, 0, W - 1, D - 1, 0, "grass_block");
  v.ringRect(0, 0, W - 1, D - 1, 0, "cobblestone");
  v.ringRect(1, 1, W - 2, D - 2, 0, "cobblestone");

  // curtain walls (2 thick), y=1..8, along all four sides
  const wallLo = 3, wallHi = 27; // outer wall rows at 3&4 / 26&27
  v.box(wallLo, wallLo, 1, wallHi, wallLo + 1, 8, stone);       // front
  v.box(wallLo, wallHi - 1, 1, wallHi, wallHi, 8, stone);       // back
  v.box(wallLo, wallLo, 1, wallLo + 1, wallHi, 8, stone);       // left
  v.box(wallHi - 1, wallLo, 1, wallHi, wallHi, 8, stone);       // right
  // wall-walk planks + outer merlons
  v.box(wallLo, wallLo + 1, 8, wallHi, wallLo + 1, 8, "oak_planks");
  v.box(wallLo, wallHi - 1, 8, wallHi, wallHi - 1, 8, "oak_planks");
  v.box(wallLo + 1, wallLo, 8, wallLo + 1, wallHi, 8, "oak_planks");
  v.box(wallHi - 1, wallLo, 8, wallHi - 1, wallHi, 8, "oak_planks");
  for (let i = wallLo; i <= wallHi; i += 2) {
    v.set(i, wallLo, 9, "stone_bricks");
    v.set(i, wallHi, 9, "stone_bricks");
    v.set(wallLo, i, 9, "stone_bricks");
    v.set(wallHi, i, 9, "stone_bricks");
  }
  // arrow slits mid-wall
  for (const i of [9, 15, 21]) {
    v.clear(i, wallLo, 5, i, wallLo, 6);
    v.clear(i, wallHi, 5, i, wallHi, 6);
    v.clear(wallLo, i, 5, wallLo, i, 6);
    v.clear(wallHi, i, 5, wallHi, i, 6);
  }

  // gatehouse: thicker, taller front-center section with portcullis
  v.box(11, wallLo, 1, 19, wallLo + 2, 10, stone);
  for (let x = 11; x <= 19; x += 2) v.set(x, wallLo, 11, "stone_bricks");
  v.clear(14, wallLo, 1, 16, wallLo + 2, 3);                   // gate passage
  v.box(14, wallLo, 4, 16, wallLo, 4, "iron_bars");            // portcullis
  v.set(13, wallLo - 1, 4, "lantern");
  v.set(17, wallLo - 1, 4, "lantern");
  // path from gate to keep door
  v.box(14, wallLo + 3, 0, 16, 9, 0, "dirt_path");

  // corner towers, r=3 shells with flared crowns
  for (const [cx, cz] of [[4, 4], [26, 4], [4, 26], [26, 26]]) {
    v.disk(cx, cz, 0, 4, "cobblestone");
    v.cylinder(cx, cz, 1, 12, 3, stone, true);
    v.disk(cx, cz, 13, 4, stone);                              // machicolation ledge
    v.cylinder(cx, cz, 14, 14, 4, stone, true);
    // alternating merlons on the r=4 ring
    for (let z = cz - 5; z <= cz + 5; z++)
      for (let x = cx - 5; x <= cx + 5; x++)
        if (v.get(x, z, 14) && (x + z) % 2 === 0) v.set(x, z, 15, "stone_bricks");
    v.disk(cx, cz, 13, 3, "oak_planks");                       // deck
    // slit windows
    v.clear(cx, cz - 3, 6, cx, cz - 3, 7);
    v.clear(cx, cz + 3, 6, cx, cz + 3, 7);
    v.set(cx, cz, 14, "torch");
  }

  // central keep 11×11, y=1..11
  v.box(10, 10, 0, 20, 20, 0, "cobblestone");
  v.box(11, 11, 0, 19, 19, 0, "oak_planks");                   // hall floor
  for (let y = 1; y <= 11; y++) v.ringRect(10, 10, 20, 20, y, stone);
  v.box(11, 11, 6, 19, 19, 6, "oak_planks");                   // second storey floor
  // keep door + entry
  v.clear(15, 10, 1, 15, 10, 2);
  v.set(15, 10, 1, "spruce_door");
  v.set(14, 9, 1, "torch");
  v.set(16, 9, 1, "torch");
  // windows (glass panes) on both storeys, all faces
  for (const x of [12, 18]) {
    v.box(x, 10, 3, x, 10, 4, "glass_pane");
    v.box(x, 20, 3, x, 20, 4, "glass_pane");
    v.box(x, 10, 8, x, 10, 9, "glass_pane");
    v.box(x, 20, 8, x, 20, 9, "glass_pane");
    v.box(10, x, 3, 10, x, 4, "glass_pane");
    v.box(20, x, 3, 20, x, 4, "glass_pane");
    v.box(10, x, 8, 10, x, 9, "glass_pane");
    v.box(20, x, 8, 20, x, 9, "glass_pane");
  }
  v.box(15, 20, 8, 15, 20, 9, "glass_pane");
  // keep battlements + rooftop watch room
  v.box(10, 10, 11, 20, 20, 11, stone);
  v.box(11, 11, 11, 19, 19, 11, "stone_bricks");
  for (let i = 10; i <= 20; i += 2) {
    v.set(i, 10, 12, "stone_bricks"); v.set(i, 20, 12, "stone_bricks");
    v.set(10, i, 12, "stone_bricks"); v.set(20, i, 12, "stone_bricks");
  }
  for (let y = 12; y <= 14; y++) v.ringRect(13, 13, 17, 17, y, "spruce_planks");
  v.box(14, 13, 12, 16, 13, 13, "glass_pane");
  v.box(14, 17, 12, 16, 17, 13, "glass_pane");
  v.annulusRect(15, 15, 2, 2, 15, "spruce_stairs");
  v.annulusRect(15, 15, 1, 1, 16, "spruce_stairs");
  v.set(15, 15, 15, "spruce_planks");
  v.set(15, 15, 16, "spruce_slab");
  v.set(15, 15, 17, "lantern");

  // courtyard well
  v.ringRect(6, 14, 8, 16, 1, "cobblestone");
  v.set(7, 15, 1, "water");
  v.set(7, 15, 0, "cobblestone");

  templates.push(toTemplate({
    id: "stonehold_keep",
    name: "Stonehold Keep",
    category: "Medieval",
    difficulty: "Advanced",
    description:
      "A full 31×31 castle: crenellated curtain walls with a wall-walk and arrow slits, four " +
      "flared corner towers, a portcullised gatehouse, a courtyard well, and a three-storey " +
      "central keep crowned with a watch room. Aged stone throughout — mossy and cracked bricks " +
      "are scattered in at ~1 in 6.",
    tips: [
      "Build order: walls first (they set every alignment), then towers, then the keep.",
      "The wall-walk is one block below the outer merlons — you can patrol the whole circuit.",
      "Scatter the mossy/cracked variants randomly as you go; don't batch them or they'll look tiled.",
      "Swap oak for dark oak and add banners for a more sinister lord.",
    ],
  }, v));
}

/* ============================================================
   2. ARCANUM SPIRE — wizard tower, 17×17×32
   ============================================================ */
{
  const W = 17, D = 17, H = 32;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(4242);
  const dark = () => {
    const r = rnd();
    return r < 0.12 ? "cobbled_deepslate" : r < 0.2 ? "polished_deepslate" : "deepslate_bricks";
  };
  const roofMix = () => (rnd() < 0.15 ? "crying_obsidian" : "purpur_block");
  const C = 8;

  // rocky base
  v.disk(C, C, 0, 7, () => (rnd() < 0.3 ? "moss_block" : "cobbled_deepslate"));
  v.ringCircle(C, C, 1, 6.5, dark);

  // tapering shaft
  v.cylinder(C, C, 1, 6, 5, dark, true);
  v.cylinder(C, C, 7, 17, 4, dark, true);
  v.disk(C, C, 7, 4, dark);                                    // ledge where it steps in
  v.disk(C, C, 1, 4, "polished_deepslate");                    // ground floor
  v.disk(C, C, 9, 3, "spruce_planks");                         // mid floor
  // door
  v.clear(C, 3, 1, C, 3, 2);
  v.set(C, 3, 1, "spruce_door");
  v.set(C - 1, 2, 1, "soul_lantern");
  v.set(C + 1, 2, 1, "soul_lantern");
  // slit windows spiralling up
  v.box(C + 5, C, 4, C + 5, C, 5, "light_blue_stained_glass");
  v.box(C, C + 4, 8, C, C + 4, 9, "light_blue_stained_glass");
  v.box(C - 4, C, 11, C - 4, C, 12, "light_blue_stained_glass");
  v.box(C, C - 4, 14, C, C - 4, 15, "light_blue_stained_glass");

  // overhanging study: dark-oak floor ledge + blackstone walls
  v.disk(C, C, 18, 6.5, "dark_oak_planks");
  v.cylinder(C, C, 19, 23, 6, () => (rnd() < 0.15 ? "blackstone" : "polished_blackstone_bricks"), true);
  // four tall windows framed in amethyst
  for (const [wx, wz] of [[C + 6, C], [C - 6, C], [C, C + 6], [C, C - 6]]) {
    v.box(wx, wz, 20, wx, wz, 22, "light_blue_stained_glass");
    const fx = wx === C ? 1 : 0, fz = wz === C ? 0 : 1; // frame offset axis
    v.set(wx + fx, wz + (fx ? 0 : (wz > C ? 0 : 0)), 19, "amethyst_block");
    v.set(wx + fx, wz, 23, "amethyst_block");
    v.set(wx - fx, wz, 23, "amethyst_block");
    void fz;
  }
  // study interior: bookshelf ring + lantern
  v.ringCircle(C, C, 19, 5, "bookshelf");
  v.ringCircle(C, C, 20, 5, "bookshelf");
  v.set(C, C, 22, "lantern");
  v.set(C, C, 19, "crafting_table");

  // conical purple roof
  const roofR = [6.5, 5.5, 4.5, 3.5, 2.5, 1.5, 1];
  roofR.forEach((r, i) => v.disk(C, C, 24 + i, r, roofMix));
  v.set(C, C, 31, "end_rod");
  // floating arcane crystals around the roof
  v.set(C + 7, C, 22, "amethyst_block");
  v.set(C - 7, C + 2, 25, "amethyst_block");
  v.set(C + 3, C - 7, 27, "amethyst_block");
  v.set(C + 7, C, 21, "end_rod");

  templates.push(toTemplate({
    id: "arcanum_spire",
    name: "Arcanum Spire",
    category: "Fantasy",
    difficulty: "Advanced",
    description:
      "A 32-block wizard tower in weathered deepslate: a tapering shaft climbs to an overhanging " +
      "blackstone study lined with bookshelves, lit by amethyst-framed windows, under a swirling " +
      "purpur cone roof with crying-obsidian streaks and floating crystal shards.",
    tips: [
      "Build the shaft with scaffolding up the middle — the overhang at layer 19 is much easier from inside.",
      "The floating crystals are the vibe: place them last, offset from the roof, no supports.",
      "Soul lanterns by the door and an end rod finial give the cold arcane light this build wants.",
      "Interior floors are included at layers 2 and 10 — ladder or spiral-stair between them in game.",
    ],
  }, v));
}

/* ============================================================
   3. CRIMSON PAGODA — 4-tier pagoda, 21×21×30
   ============================================================ */
{
  const W = 21, D = 21, H = 30;
  const v = new Vox(W, D, H);
  const C = 10;

  // stone plinth with steps on the front
  v.annulusRect(C, C, 0, 9, 0, "smooth_stone");
  v.box(C - 2, 0, 0, C + 2, 0, 0, "stone_brick_slab");         // step strip
  v.box(C - 8, C - 8, 0, C + 8, C + 8, 0, "smooth_stone");

  for (let tier = 0; tier < 4; tier++) {
    const hw = 7 - tier;
    const b = 1 + tier * 6;
    // walls: white plaster with red columns at corners and face centers
    for (let y = b; y <= b + 3; y++) {
      v.annulusRect(C, C, hw, hw, y, "white_terracotta");
      for (const o of [-hw, hw]) {
        v.set(C + o, C - hw, y, "red_terracotta");
        v.set(C + o, C + hw, y, "red_terracotta");
        v.set(C - hw, C + o, y, "red_terracotta");
        v.set(C + hw, C + o, y, "red_terracotta");
      }
      v.set(C, C - hw, y, "red_terracotta");
      v.set(C, C + hw, y, "red_terracotta");
      v.set(C - hw, C, y, "red_terracotta");
      v.set(C + hw, C, y, "red_terracotta");
    }
    // interior floor per tier
    v.annulusRect(C, C, 0, hw - 1, b - 1, "spruce_planks");
    // openings: ground door / upper windows on the front face
    if (tier === 0) {
      v.clear(C, C - hw, 1, C, C - hw, 2);
      v.set(C, C - hw, 1, "spruce_door");
      v.set(C - 1, C - hw, 2, "glass_pane");
      v.set(C + 1, C - hw, 2, "glass_pane");
      v.set(C - 2, C - hw - 1, 1, "soul_lantern");
      v.set(C + 2, C - hw - 1, 1, "soul_lantern");
    } else {
      v.set(C, C - hw, b + 1, "glass_pane");
      v.set(C, C + hw, b + 1, "glass_pane");
      v.set(C - hw, C, b + 1, "glass_pane");
      v.set(C + hw, C, b + 1, "glass_pane");
    }
    // flared roof: wide skirt, corner upturns, then trim ring
    v.annulusRect(C, C, hw, hw + 2, b + 4, "dark_oak_planks");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      v.set(C + sx * (hw + 2), C + sz * (hw + 2), b + 5, "dark_oak_stairs");
      if (tier === 0) v.set(C + sx * (hw + 2), C + sz * (hw + 2), b + 3, "lantern");
    }
    v.annulusRect(C, C, hw - 1, hw, b + 5, "dark_oak_planks");
  }

  // crowning pyramid + gilded spire (top tier: hw=4, roof trim ends y=24)
  v.annulusRect(C, C, 2, 3, 25, "dark_oak_planks");
  v.annulusRect(C, C, 0, 1, 26, "dark_oak_planks");
  v.set(C, C, 27, "dark_oak_fence");
  v.set(C, C, 28, "gold_block");
  v.set(C, C, 29, "end_rod");

  templates.push(toTemplate({
    id: "crimson_pagoda",
    name: "Crimson Pagoda",
    category: "Oriental",
    difficulty: "Advanced",
    description:
      "A four-tier 30-block pagoda: white plaster walls framed by vermilion columns, each tier " +
      "wrapped in a flared dark-oak roof with upturned stair corners and hanging lanterns, " +
      "stacked to a gilded spire. Every tier has its own floor, and the whole build is " +
      "perfectly symmetric — turn Mirror X and Z on if you recreate it by hand.",
    tips: [
      "Each tier is exactly walls ×4 layers + roof ×2 layers — settle into the rhythm and it builds fast.",
      "The corner upturns are single stairs placed one layer above the roof skirt, facing outward.",
      "Hang lanterns under the first roof's corners; soul lanterns flank the door for a cooler tone.",
      "Looks best beside water or on a hilltop with a stone path leading to the front steps.",
    ],
  }, v));
}

/* ============================================================
   4. GRIMHOLLOW CATHEDRAL — gothic cathedral, 17×33×24
   ============================================================ */
{
  const W = 17, D = 33, H = 24;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(6666);
  const stone = () => {
    const r = rnd();
    return r < 0.08 ? "cracked_stone_bricks" : r < 0.14 ? "mossy_stone_bricks" : "stone_bricks";
  };

  // floor: checkered nave on a stone outline
  v.box(0, 0, 0, 16, 32, 0, stone);
  for (let z = 3; z <= 29; z++)
    for (let x = 3; x <= 13; x++)
      v.set(x, z, 0, (x + z) % 2 ? "polished_andesite" : "polished_diorite");

  // nave side walls with lancet windows + buttresses
  for (const x of [2, 14]) {
    v.box(x, 5, 1, x, 28, 12, stone);
    for (const z of [8, 12, 16, 20, 24]) {
      v.box(x, z, 3, x, z, 9, z % 8 === 0 ? "blue_stained_glass" : "red_stained_glass");
      v.set(x, z, 10, "gray_stained_glass");
    }
  }
  for (const bx of [1, 15]) for (const z of [6, 10, 14, 18, 22, 26]) {
    v.box(bx, z, 1, bx, z, 8, stone);
    v.set(bx, z, 9, "stone_brick_slab");
  }

  // front towers (5×5, z=0..4)
  for (const x0 of [0, 12]) {
    v.box(x0, 0, 1, x0 + 4, 4, 18, stone);
    v.clear(x0 + 1, 1, 1, x0 + 3, 3, 17);                      // hollow inside
    for (const y of [5, 11, 15]) {                             // slit windows
      v.set(x0 + 2, 0, y, "gray_stained_glass");
      v.set(x0 + 2, 0, y + 1, "gray_stained_glass");
    }
    // pointed deepslate spires
    v.box(x0, 0, 19, x0 + 4, 4, 19, "deepslate_tiles");
    v.box(x0 + 1, 1, 20, x0 + 3, 3, 20, "deepslate_tiles");
    v.box(x0 + 1, 1, 21, x0 + 3, 3, 21, "deepslate_tiles");
    v.set(x0 + 2, 2, 22, "deepslate_tiles");
    v.set(x0 + 2, 2, 23, "end_rod");
  }

  // facade between the towers, with portal + rose window
  v.box(4, 2, 1, 12, 2, 12, stone);
  v.clear(7, 2, 1, 9, 2, 4);                                   // portal arch
  v.set(7, 2, 1, "spruce_door"); v.set(8, 2, 1, "spruce_door"); v.set(9, 2, 1, "spruce_door");
  v.set(6, 1, 3, "lantern"); v.set(10, 1, 3, "lantern");
  // rose window (r=2 disk, gold centre cross)
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      if (dx * dx + dy * dy <= 5)
        v.set(8 + dx, 2, 9 + dy, Math.abs(dx) + Math.abs(dy) <= 1 ? "yellow_stained_glass" : "blue_stained_glass");
  // front gable above facade follows the roof pitch
  for (let y = 13; y <= 19; y++) v.box(y - 11, 2, y, 16 - (y - 11), 2, y, stone);

  // pitched deepslate roof over the nave
  for (let step = 0; step <= 5; step++) {
    const y = 13 + step;
    v.box(2 + step, 3, y, 2 + step, 29, y, "deepslate_tiles");
    v.box(14 - step, 3, y, 14 - step, 29, y, "deepslate_tiles");
  }
  v.box(8, 3, 19, 8, 29, 19, "deepslate_tiles");               // ridge

  // apse: rounded east end with a stepped half-dome
  for (let y = 1; y <= 12; y++)
    for (let z = 28; z <= 32; z++)
      for (let x = 2; x <= 14; x++) {
        const dx = x - 8, dz = z - 28;
        const rr = dx * dx + dz * dz;
        if (rr <= 42 && rr >= 30 && dz >= 0) v.set(x, z, y, stone());
      }
  for (const [ax, az] of [[4, 32], [8, 32], [12, 32], [3, 30], [13, 30]])
    v.box(ax, az, 4, ax, az, 7, "blue_stained_glass");
  const domeR = [6, 5, 4, 2];
  domeR.forEach((r, i) => {
    const y = 13 + i;
    for (let z = 28; z <= 32; z++)
      for (let x = 2; x <= 14; x++) {
        const dx = x - 8, dz = z - 28;
        if (dz >= 0 && dx * dx + dz * dz <= r * r) v.set(x, z, y, "deepslate_tiles");
      }
  });

  // interior: column rows + altar
  for (const x of [5, 11]) for (const z of [8, 12, 16, 20, 24]) {
    v.box(x, z, 1, x, z, 11, "polished_blackstone");
    v.set(x, z, 8, "lantern");
  }
  v.box(6, 26, 1, 10, 27, 1, "polished_blackstone");           // altar dais
  v.set(8, 27, 2, "gold_block");
  v.set(6, 27, 2, "torch"); v.set(10, 27, 2, "torch");

  templates.push(toTemplate({
    id: "grimhollow_cathedral",
    name: "Grimhollow Cathedral",
    category: "Gothic",
    difficulty: "Advanced",
    description:
      "A 33-block-long gothic cathedral: twin hollow bell towers with deepslate spires, a rose " +
      "window over a triple-door portal, buttressed nave walls lined with lancet stained glass, " +
      "a steep deepslate roof, blackstone column rows over a checkered marble floor, and a " +
      "rounded apse with a stepped half-dome behind the altar.",
    tips: [
      "Lay the checkered floor first — the column rows and buttresses all key off it.",
      "Alternate blue and red lancet windows like the blueprint; the rose window reads best at dusk.",
      "The towers are hollow: add ladders or spiral stairs inside, and bells at the top slits.",
      "Deepslate tiles are the roof; in-game you can smooth the pitch with deepslate-tile stairs.",
    ],
  }, v));
}

/* ============================================================
   5. VISTA MODERNA — modern villa, 27×19×12
   ============================================================ */
{
  const W = 27, D = 19, H = 12;
  const v = new Vox(W, D, H);

  // grounds: lawn, stone pad, path
  v.box(0, 0, 0, 26, 18, 0, "grass_block");
  v.box(1, 2, 0, 25, 16, 0, "smooth_stone");
  v.box(5, 16, 0, 7, 18, 0, "dirt_path");
  // pool with inset sea-lantern lighting and quartz deck
  v.box(18, 11, 0, 25, 16, 0, "quartz_block");
  v.box(19, 12, 0, 24, 15, 0, "water");
  v.set(19, 12, 0, "sea_lantern"); v.set(24, 15, 0, "sea_lantern");
  v.set(19, 15, 0, "sea_lantern"); v.set(24, 12, 0, "sea_lantern");

  // ground-floor volume: white concrete, glass front (south, z=13)
  v.box(2, 3, 1, 15, 13, 4, "white_concrete");
  v.clear(3, 4, 1, 14, 12, 4);                                 // hollow
  v.box(3, 4, 0, 14, 12, 0, "birch_planks");                   // interior floor
  v.box(4, 13, 1, 13, 13, 3, "glass");                         // glass curtain wall
  v.set(6, 13, 1, "iron_door");                                // entry
  v.clear(6, 13, 2, 6, 13, 2);
  v.box(4, 3, 2, 13, 3, 3, "glass");                           // rear ribbon window
  // flat roof w/ overhang rim
  v.box(1, 2, 5, 16, 14, 5, "light_gray_concrete");

  // upper volume: gray concrete, cantilevered east over the pool deck
  v.box(9, 4, 6, 24, 12, 9, "gray_concrete");
  v.clear(10, 5, 6, 23, 11, 9);                                // hollow
  v.box(10, 5, 5, 23, 11, 5, "spruce_planks");                 // upper floor
  v.box(10, 12, 7, 23, 12, 8, "glass");                        // south ribbon glazing
  v.box(24, 6, 7, 24, 10, 8, "glass");                         // east window wall
  v.box(9, 5, 7, 9, 11, 8, "stripped_oak_log");                // timber feature wall (west)
  v.box(16, 4, 7, 21, 4, 8, "glass");                          // north ribbon
  // cantilever support columns on the pool deck
  v.box(20, 5, 1, 20, 5, 5, "smooth_stone");
  v.box(20, 11, 1, 20, 11, 5, "smooth_stone");
  // upper roof: pale slab with black solar strips
  v.box(8, 3, 10, 25, 13, 10, "light_gray_concrete");
  v.box(10, 5, 11, 12, 11, 11, "black_concrete");
  v.box(14, 5, 11, 16, 11, 11, "black_concrete");
  v.box(18, 5, 11, 20, 11, 11, "black_concrete");

  // roof terrace on volume A with glass balustrade
  v.box(2, 2, 6, 8, 13, 6, "glass_pane");
  v.clear(3, 3, 6, 8, 12, 6);
  v.box(3, 12, 6, 7, 12, 6, "glass_pane");
  v.set(4, 4, 6, "campfire");                                  // fire bowl lounge
  v.set(6, 10, 6, "lantern");

  // landscaping: sculpted hedges + feature tree
  v.box(1, 16, 1, 2, 17, 1, "azalea_leaves");
  v.box(10, 15, 1, 11, 16, 1, "azalea_leaves");
  v.set(23, 2, 1, "oak_log"); v.set(23, 2, 2, "oak_log");
  v.disk(23, 2, 3, 1.5, "oak_leaves");
  v.disk(23, 2, 4, 1, "oak_leaves");

  templates.push(toTemplate({
    id: "vista_moderna",
    name: "Vista Moderna",
    category: "Modern",
    difficulty: "Advanced",
    description:
      "A flat-roofed modern villa in white and gray concrete: a glass-fronted ground floor under " +
      "a cantilevered upper storey with a stripped-oak feature wall, a roof terrace with glass " +
      "balustrade and fire bowl, solar strips up top, and a quartz-decked pool lit by sea " +
      "lanterns set into the floor.",
    tips: [
      "Concrete only — stone or planks in the walls instantly breaks the modern look.",
      "The sea lanterns sit flush in the pool corners: place them as the floor, not on it.",
      "Keep glazing in long unbroken runs; single windows read as cottage, ribbons read as modern.",
      "The cantilever needs no supports in Minecraft — the two columns are purely for the look.",
    ],
  }, v));
}

/* ============================================================
   6. AETHERHOLM — floating sky island, 25×25×22
   ============================================================ */
{
  const W = 25, D = 25, H = 22;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(9001);
  const C = 12;
  const under = (y) => {
    const r = rnd();
    if (y <= 3) return r < 0.25 ? "amethyst_block" : "deepslate";
    if (y <= 7) return r < 0.15 ? "glowstone" : r < 0.55 ? "stone" : "cobbled_deepslate";
    return r < 0.6 ? "dirt" : "stone";
  };

  // inverted cone: radius grows with height, tip at the bottom
  for (let y = 0; y <= 11; y++) v.disk(C, C, y, y === 0 ? 0.5 : y, under);
  v.set(C, C, 0, "amethyst_block");
  // hanging spikes + under-lights
  for (const [sx, sz, sy] of [[7, 9, 5], [17, 14, 6], [10, 17, 4], [15, 7, 5]]) {
    v.set(sx, sz, sy, "cobbled_deepslate");
    v.set(sx, sz, sy - 1, "deepslate");
    v.set(sx, sz, sy - 2, "soul_lantern");
  }

  // surface: grass cap with a sand-edged pond
  v.disk(C, C, 11, 11, "dirt");
  v.disk(C, C, 12, 11, "grass_block");
  v.disk(17, 8, 12, 2.5, "sand");
  v.disk(17, 8, 12, 1.7, "water");
  // waterfall over the rim
  v.set(23, 12, 12, "water");
  for (let y = 6; y <= 11; y++) v.set(24, 12, y, "water");

  // ancient ruin: broken pillar circle + glowing pedestal
  const pillarH = [4, 2, 3, 1, 4, 2];
  const ruinStone = () => (rnd() < 0.4 ? "cracked_stone_bricks" : rnd() < 0.5 ? "mossy_stone_bricks" : "stone_bricks");
  pillarH.forEach((ph, i) => {
    const a = (i / pillarH.length) * Math.PI * 2;
    const px = Math.round(C + Math.cos(a) * 4.5), pz = Math.round(C + Math.sin(a) * 4.5);
    for (let y = 13; y < 13 + ph; y++) v.set(px, pz, y, ruinStone());
  });
  v.set(C, C, 13, "chiseled_stone_bricks");
  v.set(C, C, 14, "amethyst_block");
  v.set(C, C, 15, "end_rod");
  v.disk(C, C, 12, 1.5, "moss_block");

  // lone tree on the west rim
  for (let y = 13; y <= 16; y++) v.set(6, 15, y, "oak_log");
  v.disk(6, 15, 16, 2.2, "oak_leaves");
  v.disk(6, 15, 17, 2.2, "oak_leaves");
  v.disk(6, 15, 18, 1.2, "oak_leaves");
  v.set(6, 15, 16, "oak_log");
  v.set(6, 15, 19, "oak_leaves");

  // two satellite islets drifting alongside
  v.disk(3, 4, 13, 1.6, "dirt"); v.disk(3, 4, 14, 1.6, "grass_block");
  v.set(3, 4, 12, "stone"); v.set(3, 4, 15, "azalea_leaves");
  v.disk(21, 20, 15, 1.2, "dirt"); v.disk(21, 20, 16, 1.2, "grass_block");
  v.set(21, 20, 14, "cobbled_deepslate"); v.set(21, 20, 17, "lantern");

  templates.push(toTemplate({
    id: "aetherholm",
    name: "Aetherholm",
    category: "Ethereal",
    difficulty: "Advanced",
    description:
      "A floating island torn from the world: an inverted stone cone dripping with deepslate " +
      "spikes, soul lanterns and amethyst veins, capped by a grassy meadow holding a broken " +
      "ring of mossy ruins around a glowing pedestal, a lone oak, a spring-fed pond spilling a " +
      "waterfall off the rim, and two islets drifting alongside.",
    tips: [
      "In survival, build the cone downward from the meadow rim with scaffolding — or up from a pillar you remove.",
      "The waterfall sells the float: one source at the rim, and let it stream into the void.",
      "Glowstone and amethyst veins in the underside make the island glow at night from below.",
      "Leave the ruin broken — uneven pillar heights and cracked brick are what make it feel ancient.",
    ],
  }, v));
}

/* ---------------- emit ---------------- */
const banner = `/* ============================================================
   BlockCraft Planner — GRAND BUILD templates
   AUTO-GENERATED by tools/generate_templates.mjs — do not edit
   by hand; edit the generator and re-run:
       node tools/generate_templates.mjs
   ============================================================ */
`;

const body =
  "const LARGE_TEMPLATES = " +
  JSON.stringify(templates, null, 1).replace(/^/gm, "").trim() +
  ";\n\n" +
  `LARGE_TEMPLATES.forEach((t) => {
  t.height = t.layers.length;
  t.depth = t.layers[0].length;
  t.width = t.layers[0][0].length;
  t.size = \`\${t.width}×\${t.depth}×\${t.height}\`;
});
TEMPLATES.push(...LARGE_TEMPLATES);
`;

writeFileSync(join(ROOT, "js/templates_large.js"), banner + body);
console.log(`\nWrote js/templates_large.js (${templates.length} grand builds)`);
