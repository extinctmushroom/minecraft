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

/* ============================================================
   7. BLACKTIDE GALLEON — pirate ship, 13×31×24
   ============================================================ */
{
  const W = 13, D = 31, H = 24;
  const v = new Vox(W, D, H);
  const cx = 6;
  // deck half-width profile along the length
  const hw = (z) => {
    if (z < 2 || z > 28) return 0;
    if (z === 2) return 1;
    if (z === 3) return 2;
    if (z === 4) return 3;
    if (z === 5) return 4;
    if (z <= 24) return 5;
    return 4; // squared-off stern
  };
  const bottom = (z) => (z <= 3 || z >= 27 ? 4 : z <= 5 || z >= 25 ? 3 : 2);

  // hull shell: sides narrow toward the keel, floor at the bottom course
  for (let z = 2; z <= 28; z++) {
    const bw = hw(z);
    if (!bw) continue;
    for (let y = bottom(z); y <= 6; y++) {
      const wy = Math.max(1, bw - Math.max(0, 5 - y));
      const mat = y === 5 ? "dark_oak_planks" : "spruce_planks"; // wale stripe
      v.set(cx - wy, z, y, mat);
      v.set(cx + wy, z, y, mat);
      if (y === bottom(z)) v.box(cx - wy, z, y, cx + wy, z, y, "spruce_planks");
    }
    // bow stem and stern transom are solid walls
    if (z === 2 || z === 28)
      v.box(cx - Math.max(1, bw - 1), z, bottom(z), cx + Math.max(1, bw - 1), z, 7, "spruce_planks");
  }
  // main deck + bulwarks
  for (let z = 3; z <= 27; z++) v.box(cx - hw(z), z, 6, cx + hw(z), z, 6, "oak_planks");
  for (let z = 3; z <= 27; z++) {
    v.set(cx - hw(z), z, 7, "spruce_planks");
    v.set(cx + hw(z), z, 7, "spruce_planks");
  }
  // forecastle
  for (let z = 2; z <= 6; z++) v.box(cx - Math.max(1, hw(z) - 1), z, 8, cx + Math.max(1, hw(z) - 1), z, 8, "oak_planks");
  v.box(cx - 1, 2, 9, cx + 1, 2, 9, "oak_fence");
  v.set(cx - 3, 6, 9, "oak_fence"); v.set(cx + 3, 6, 9, "oak_fence");
  // stern castle: cabin, poop deck, railing, lanterns
  v.box(cx - 4, 23, 7, cx + 4, 28, 9, "spruce_planks");
  v.clear(cx - 3, 24, 7, cx + 3, 27, 9);                        // hollow interior (keep front wall)
  v.clear(cx, 23, 7, cx, 23, 8);                                // cabin doorway
  v.box(cx - 2, 28, 8, cx + 2, 28, 8, "glass_pane");            // stern gallery windows
  v.box(cx - 4, 23, 10, cx + 4, 28, 10, "oak_planks");          // poop deck
  for (let z = 23; z <= 28; z++) { v.set(cx - 4, z, 11, "oak_fence"); v.set(cx + 4, z, 11, "oak_fence"); }
  v.box(cx - 3, 28, 11, cx + 3, 28, 11, "oak_fence");
  v.set(cx - 3, 28, 12, "lantern"); v.set(cx + 3, 28, 12, "lantern");
  // bowsprit + gilded figurehead
  v.set(cx, 1, 8, "spruce_log"); v.set(cx, 0, 9, "spruce_log");
  v.set(cx, 1, 7, "gold_block");
  // anchor on the port bow
  v.set(cx - 5, 6, 5, "chain"); v.set(cx - 5, 6, 4, "chain"); v.set(cx - 5, 6, 3, "iron_block");
  // masts
  v.box(cx, 8, 7, cx, 8, 18, "dark_oak_log");                   // fore
  v.box(cx, 15, 7, cx, 15, 21, "dark_oak_log");                 // main
  v.box(cx, 24, 11, cx, 24, 19, "dark_oak_log");                // mizzen (through the poop deck)
  // sails (wool planes hung just forward of each mast) + yards
  const sail = (z, y0, y1, half) => {
    v.box(cx - half, z, y0, cx + half, z, y1, "white_wool");
    v.box(cx - half, z, y1 + 1, cx + half, z, y1 + 1, "oak_fence"); // yardarm
  };
  sail(7, 9, 12, 3); sail(7, 14, 16, 2);                        // fore lower + top
  sail(14, 10, 14, 4); sail(14, 16, 19, 3);                     // main lower + top
  sail(23, 12, 16, 3);                                          // mizzen
  // crow's nest + colours
  v.annulusRect(cx, 15, 1, 1, 18, "oak_planks");
  v.annulusRect(cx, 15, 1, 1, 19, "oak_fence");
  v.set(cx, 16, 21, "black_wool"); v.set(cx, 17, 21, "black_wool"); v.set(cx, 16, 20, "black_wool");

  templates.push(toTemplate({
    id: "blacktide_galleon",
    name: "Blacktide Galleon",
    category: "Nautical",
    difficulty: "Advanced",
    description:
      "A three-masted pirate galleon with a rounded spruce hull and dark-oak wale stripe, " +
      "raised forecastle and stern castle with glass gallery windows, five wool sails on " +
      "fenced yards, a crow's nest, black colours at the masthead, a gilded figurehead and " +
      "an anchor chain on the port bow.",
    tips: [
      "Build the keel and hull ribs first, layer by layer — the half-width shrinks by one for each course below the wale.",
      "Float it: build from a scaffold platform at water level and remove the platform last.",
      "Sails hang one block forward of each mast; leave them out for a docked, sails-furled look.",
      "Swap white wool for gray and fly the black flag higher if you want her more menacing.",
    ],
  }, v));
}

/* ============================================================
   8. SUNSPIRE ZIGGURAT — desert temple, 31×33×19
   ============================================================ */
{
  const W = 31, D = 33, H = 19;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(2468);
  const cx = 15, cz = 17;
  const sand = () => {
    const r = rnd();
    return r < 0.12 ? "smooth_sandstone" : r < 0.18 ? "cut_sandstone" : "sandstone";
  };
  const tierWall = (hwT, y) => {
    for (let z = cz - hwT; z <= cz + hwT; z++)
      for (let x = cx - hwT; x <= cx + hwT; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) !== hwT) continue;
        const corner = Math.abs(x - cx) === hwT && Math.abs(z - cz) === hwT;
        v.set(x, z, y, corner ? "cut_sandstone" : sand());
      }
  };
  const tiers = [[14, 0], [11, 3], [8, 6], [5, 9]];
  tiers.forEach(([hwT, y0], i) => {
    for (let y = y0; y <= y0 + 2; y++) tierWall(hwT, y);
    // orange banding on the middle course
    for (let x = cx - hwT + 2; x <= cx + hwT - 2; x += 3) {
      v.set(x, cz - hwT, y0 + 1, "orange_terracotta");
      v.set(x, cz + hwT, y0 + 1, "orange_terracotta");
    }
    for (let z = cz - hwT + 2; z <= cz + hwT - 2; z += 3) {
      v.set(cx - hwT, z, y0 + 1, "orange_terracotta");
      v.set(cx + hwT, z, y0 + 1, "orange_terracotta");
    }
    // exposed terrace surface on top of the tier
    const next = i < 3 ? tiers[i + 1][0] : 4;
    v.annulusRect(cx, cz, next, hwT, y0 + 2, sand);
    // lapis corner markers on each terrace
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      v.set(cx + sx * hwT, cz + sz * hwT, y0 + 2, "lapis_block");
  });
  // summit platform
  v.annulusRect(cx, cz, 0, 4, 12, "smooth_sandstone");
  // grand staircase: carve a recessed channel up the south face, then lay the ramp
  for (let k = 0; k <= 11; k++) {
    v.clear(cx - 2, 3 + k, k + 1, cx + 2, 3 + k, k + 4);
    v.box(cx - 2, 3 + k, k, cx + 2, 3 + k, k, "smooth_sandstone");
  }
  // summit shrine with gold crown
  for (let y = 13; y <= 15; y++) {
    v.annulusRect(cx, cz, 2, 2, y, sand);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      v.set(cx + 2 * sx, cz + 2 * sz, y, "cut_sandstone");
  }
  v.clear(cx, cz - 2, 13, cx, cz - 2, 14);                      // doorway
  v.annulusRect(cx, cz, 0, 2, 16, sand);
  v.annulusRect(cx, cz, 0, 1, 17, "gold_block");
  v.set(cx, cz, 18, "gold_block");
  v.set(cx, cz, 13, "gold_block");                              // altar
  v.set(cx - 4, cz - 4, 13, "torch"); v.set(cx + 4, cz - 4, 13, "torch");
  // twin obelisks flanking the approach
  for (const ox of [cx - 6, cx + 6]) {
    v.box(ox, 1, 0, ox, 1, 3, "cut_sandstone");
    v.set(ox, 1, 4, "gold_block");
  }

  templates.push(toTemplate({
    id: "sunspire_ziggurat",
    name: "Sunspire Ziggurat",
    category: "Desert",
    difficulty: "Advanced",
    description:
      "A four-tier stepped sandstone temple, 31 blocks to a side, with a recessed grand " +
      "staircase climbing the south face, orange-terracotta banding, lapis terrace markers, " +
      "cut-sandstone corners, twin gold-capped obelisks at the approach and a summit shrine " +
      "crowned in solid gold.",
    tips: [
      "Each tier is exactly 3 high and steps in 3 — get tier one square and the rest follow.",
      "The staircase channel is carved one block into each terrace so the walls shelter it.",
      "The tiers are hollow shells; leave them that way or hide treasure rooms inside.",
      "Build at desert dusk light with lanterns on the terraces — the orange bands come alive.",
    ],
  }, v));
}

/* ============================================================
   9. FROSTVEIL CITADEL — ice castle, 23×23×23
   ============================================================ */
{
  const W = 23, D = 23, H = 23;
  const v = new Vox(W, D, H);
  const C = 11;

  // snow ground pad + blue-ice approach
  v.box(0, 0, 0, 22, 22, 0, "snow_block");
  v.box(10, 0, 0, 12, 6, 0, "blue_ice");

  // corner towers with translucent ice bands and spires
  for (const [cx, cz] of [[4, 4], [18, 4], [4, 18], [18, 18]]) {
    v.cylinder(cx, cz, 1, 12, 2.5, "packed_ice", true);
    v.ringCircle(cx, cz, 6, 2.5, "ice");
    v.ringCircle(cx, cz, 10, 2.5, "ice");
    v.disk(cx, cz, 13, 3, "packed_ice");                        // flared ledge
    v.ringCircle(cx, cz, 14, 3, "snow_block");
    // icicles under the ledge
    v.set(cx + 3, cz, 12, "ice"); v.set(cx - 3, cz, 12, "ice");
    v.set(cx, cz + 3, 12, "ice"); v.set(cx, cz - 3, 11, "ice");
    // spire
    const spire = [2.5, 2, 1.5, 1, 0.5];
    spire.forEach((r, i) => v.disk(cx, cz, 15 + i, r, "blue_ice"));
    v.set(cx, cz, 20, "ice");
    v.set(cx, cz, 21, "end_rod");
  }

  // curtain walls with ice window bands and snow merlons
  for (const [x0, z0, x1, z1] of [[7, 4, 15, 4], [7, 18, 15, 18], [4, 7, 4, 15], [18, 7, 18, 15]]) {
    v.box(x0, z0, 1, x1, z1, 7, "packed_ice");
    v.box(x0, z0, 4, x1, z1, 5, "ice");
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        if ((x + z) % 2 === 0) v.set(x, z, 8, "snow_block");
  }
  // gate through the front wall
  v.clear(10, 4, 1, 12, 4, 3);
  v.clear(11, 4, 4, 11, 4, 4);                                  // pointed arch
  for (const px of [9, 13]) { v.set(px, 2, 1, "snow_block"); v.set(px, 2, 2, "soul_lantern"); }

  // central hall with glowing floor and pointed roof
  v.box(7, 7, 1, 15, 15, 9, "packed_ice");
  v.clear(8, 8, 1, 14, 14, 9);
  v.box(8, 8, 0, 14, 14, 0, "blue_ice");
  for (const [lx, lz] of [[11, 11], [9, 9], [13, 13], [9, 13], [13, 9]]) v.set(lx, lz, 0, "sea_lantern");
  // hall doorway (pointed) facing the gate
  v.clear(10, 7, 1, 12, 7, 3);
  v.clear(11, 7, 4, 11, 7, 4);
  // tall stained-glass windows on the other three faces
  v.box(10, 15, 3, 12, 15, 6, "light_blue_stained_glass");      // back
  v.box(7, 10, 3, 7, 12, 6, "light_blue_stained_glass");        // west
  v.box(15, 10, 3, 15, 12, 6, "light_blue_stained_glass");      // east
  // pointed hall roof
  v.annulusRect(C, C, 3, 4, 10, "packed_ice");
  v.annulusRect(C, C, 2, 3, 11, "packed_ice");
  v.annulusRect(C, C, 1, 2, 12, "packed_ice");
  v.annulusRect(C, C, 0, 1, 13, "blue_ice");
  v.set(C, C, 14, "ice");
  v.set(C, C, 15, "end_rod");

  templates.push(toTemplate({
    id: "frostveil_citadel",
    name: "Frostveil Citadel",
    category: "Frozen",
    difficulty: "Advanced",
    description:
      "A castle carved from winter itself: packed-ice curtain walls with translucent ice " +
      "window bands and snow merlons, four flared towers dripping icicles under blue-ice " +
      "spires, and a great hall with a glowing sea-lantern floor beneath a pointed ice roof — " +
      "all lit in the cold teal of soul lanterns and end rods.",
    tips: [
      "Packed ice and blue ice don't melt near light — regular ice does, so keep torches away from the window bands.",
      "The sea lanterns go IN the floor under blue ice: the whole hall glows from below at night.",
      "Silk Touch is mandatory for gathering every ice variant.",
      "Build it in a snowy biome at height — fog and powder snow around the spires is pure atmosphere.",
    ],
  }, v));
}

/* ============================================================
   10. AURELIA AIRSHIP — steampunk zeppelin, 15×33×27
   ============================================================ */
{
  const W = 15, D = 33, H = 27;
  const v = new Vox(W, D, H);
  const cx = 7, czE = 16, cyE = 19;
  const RX = 5, RZ = 12.5, RY = 6;

  // envelope: hollow ellipsoid shell with cream/rust panels and copper ribs
  const inside = (x, z, y) => {
    const dx = (x - cx) / RX, dz = (z - czE) / RZ, dy = (y - cyE) / RY;
    return dx * dx + dz * dz + dy * dy <= 1;
  };
  for (let y = cyE - RY; y <= cyE + RY; y++)
    for (let z = Math.floor(czE - RZ); z <= Math.ceil(czE + RZ); z++)
      for (let x = cx - RX; x <= cx + RX; x++) {
        if (!inside(x, z, y)) continue;
        const shell =
          !inside(x + 1, z, y) || !inside(x - 1, z, y) ||
          !inside(x, z + 1, y) || !inside(x, z - 1, y) ||
          !inside(x, z, y + 1) || !inside(x, z, y - 1);
        if (!shell) continue;
        const mat = z % 6 === 4 ? "exposed_copper"
          : Math.floor(z / 2) % 2 ? "white_terracotta" : "orange_terracotta";
        v.set(x, z, y, mat);
      }
  // tail fins
  for (let z = 27; z <= 30; z++) {
    const t = z - 27;
    v.box(cx, z, 17 + t, cx, z, 23 - t, "white_terracotta");            // vertical
    v.box(cx - 3 + t, z, 19, cx + 3 - t, z, 19, "orange_terracotta");   // horizontal
  }

  // gondola hull (little ship hung below)
  const ghw = (z) => (z === 9 || z === 23 ? 2 : z >= 10 && z <= 22 ? 3 : 0);
  for (let z = 9; z <= 23; z++) {
    const bw = ghw(z);
    if (!bw) continue;
    for (let y = 4; y <= 6; y++) {
      const wy = Math.max(1, bw - (y === 4 ? 1 : 0));
      v.set(cx - wy, z, y, "spruce_planks");
      v.set(cx + wy, z, y, "spruce_planks");
      if (y === 4) v.box(cx - wy, z, y, cx + wy, z, y, "dark_oak_planks");
    }
    if (z === 9 || z === 23) v.box(cx - 1, z, 4, cx + 1, z, 7, "spruce_planks");
  }
  for (let z = 10; z <= 22; z++) v.box(cx - ghw(z), z, 7, cx + ghw(z), z, 7, "oak_planks");
  for (let z = 10; z <= 22; z++) { v.set(cx - 3, z, 8, "oak_fence"); v.set(cx + 3, z, 8, "oak_fence"); }
  // wheelhouse with copper roof
  v.box(cx - 2, 17, 8, cx + 2, 21, 9, "spruce_planks");
  v.clear(cx - 1, 18, 8, cx + 1, 20, 9);
  v.set(cx, 17, 8, "glass_pane"); v.set(cx - 2, 19, 8, "glass_pane"); v.set(cx + 2, 19, 8, "glass_pane");
  v.box(cx - 2, 17, 10, cx + 2, 21, 10, "cut_copper");
  v.set(cx, 21, 8, "spruce_door"); v.clear(cx, 21, 9, cx, 21, 9);
  // copper nose + stern propeller
  v.set(cx, 8, 6, "copper_block");
  v.set(cx, 24, 6, "iron_block");
  v.box(cx, 24, 4, cx, 24, 5, "iron_bars"); v.box(cx, 24, 7, cx, 24, 8, "iron_bars");
  v.box(cx - 2, 24, 6, cx - 1, 24, 6, "iron_bars"); v.box(cx + 1, 24, 6, cx + 2, 24, 6, "iron_bars");
  // rigging chains up to the envelope (stop where the hull begins)
  for (const [rx, rz] of [[cx - 3, 11], [cx + 3, 11], [cx - 3, 21], [cx + 3, 21]]) {
    for (let y = 9; y <= 16; y++) {
      if (v.get(rx, rz, y)) break;
      v.set(rx, rz, y, "chain");
    }
  }
  // running lanterns under the keel
  v.set(cx - 2, 12, 3, "lantern"); v.set(cx + 2, 20, 3, "lantern");

  templates.push(toTemplate({
    id: "aurelia_airship",
    name: "Aurelia Airship",
    category: "Steampunk",
    difficulty: "Advanced",
    description:
      "A 33-block steampunk zeppelin: a hollow cream-and-rust panelled envelope ribbed with " +
      "exposed copper, tail fins, and a spruce gondola slung below on rigging chains — " +
      "complete with a copper-roofed wheelhouse, iron-bar propeller, copper nose cone and " +
      "running lanterns under the keel.",
    tips: [
      "Build the gondola first at final altitude, then raise the envelope ring by ring from its centre.",
      "The envelope is a hollow shell — count on scaffolding inside it while you close the top.",
      "Let the copper ribs oxidize unevenly (or wax them at different stages) for a weathered fleet look.",
      "Chains must hang straight: place them top-down from the envelope's underside.",
    ],
  }, v));
}

/* ============================================================
   11. VERDANT TREEHOUSE — giant oak home, 25×25×25
   ============================================================ */
{
  const W = 25, D = 25, H = 25;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(7777);
  const C = 12;

  // grassy knoll with moss and a path
  v.disk(C, C, 0, 11.5, () => (rnd() < 0.12 ? "moss_block" : "grass_block"));
  v.box(11, 0, 0, 13, 5, 0, "dirt_path");
  for (const [ax, az] of [[4, 8], [19, 14], [15, 3], [6, 19]]) v.set(ax, az, 1, "azalea_leaves");

  // trunk with root flares
  v.box(11, 11, 0, 13, 13, 17, "oak_log");
  for (const [rx, rz] of [[10, 12], [14, 12], [12, 10], [12, 14]]) v.box(rx, rz, 0, rx, rz, 1, "oak_log");
  for (const [rx, rz] of [[9, 9], [15, 15], [9, 15], [15, 9]]) v.set(rx, rz, 0, "oak_log");

  // four branches ending in leaf clusters
  const branch = (cells, bx, bz, by) => {
    cells.forEach(([x, z, y]) => v.set(x, z, y, "oak_log"));
    v.disk(bx, bz, by, 2, "oak_leaves");
    v.disk(bx, bz, by + 1, 2.3, "oak_leaves");
    v.disk(bx, bz, by + 2, 1.4, "oak_leaves");
  };
  branch([[14, 10, 13], [15, 9, 14], [16, 8, 15]], 17, 7, 15);
  branch([[10, 14, 12], [9, 15, 13], [8, 16, 14]], 7, 17, 14);
  branch([[14, 14, 14], [15, 15, 15]], 16, 16, 15);
  branch([[10, 10, 15], [9, 9, 16]], 8, 8, 16);

  // canopy dome
  const canopy = [[16, 5], [17, 8], [18, 9], [19, 9], [20, 7.5], [21, 5.5], [22, 3.5], [23, 1.8]];
  canopy.forEach(([y, r]) => v.disk(C, C, y, r, "oak_leaves"));

  // platform ring around the trunk with railing, hatch and ladder
  v.annulusRect(C, C, 2, 5, 9, "spruce_planks");
  v.annulusRect(C, C, 5, 5, 10, "oak_fence");
  v.clear(12, 10, 9, 12, 10, 10);                               // ladder hatch (railing too)
  v.box(12, 10, 1, 12, 10, 9, "ladder");
  // diagonal support struts
  for (const [s1, s2] of [
    [[12, 9, 8], [12, 8, 7]], [[12, 15, 8], [12, 16, 7]],
    [[9, 12, 8], [8, 12, 7]], [[15, 12, 8], [16, 12, 7]],
  ]) { v.set(...s1, "spruce_log"); v.set(...s2, "spruce_log"); }
  // lanterns hung under the platform corners
  for (const [lx, lz] of [[7, 7], [17, 7], [7, 17], [17, 17]]) v.set(lx, lz, 8, "lantern");

  // cabin on the west side of the platform
  v.box(7, 10, 10, 10, 14, 12, "spruce_planks");
  v.clear(8, 11, 10, 9, 13, 12);
  v.set(10, 12, 10, "spruce_door"); v.clear(10, 12, 11, 10, 12, 11);
  v.set(7, 11, 11, "glass_pane"); v.set(7, 13, 11, "glass_pane");
  v.set(8, 10, 11, "glass_pane"); v.set(9, 14, 11, "glass_pane");
  v.box(6, 9, 13, 10, 15, 13, "oak_slab");                      // overhanging roof (stops at the trunk)
  // rope swing from the south-east branch
  v.set(15, 15, 14, "chain"); v.set(15, 15, 13, "chain"); v.set(15, 15, 12, "oak_slab");

  templates.push(toTemplate({
    id: "verdant_treehouse",
    name: "Verdant Treehouse",
    category: "Woodland",
    difficulty: "Advanced",
    description:
      "A giant oak grown into a home: a 3×3 trunk with root flares climbs through a ringed " +
      "platform deck holding a little spruce cabin, up into four log branches and a huge leaf " +
      "canopy. A ladder runs up the trunk through a deck hatch, lanterns hang beneath the " +
      "corners, and a chain rope-swing dangles from the south-east branch.",
    tips: [
      "Grow the trunk and platform first; the canopy hides a multitude of sins afterwards.",
      "Vary the leaf clusters — copy the blueprint loosely here, exact leaves don't matter.",
      "The deck hatch at the north rail is your entrance: ladder up the trunk, through the hole.",
      "Add vines and moss carpet in-game (not counted here) for the full overgrown look.",
    ],
  }, v));
}

/* ============================================================
   12. EMBERREACH BASTION — nether stronghold, 27×27×20
   ============================================================ */
{
  const W = 27, D = 27, H = 20;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(6060);
  const C = 13;
  const black = () => {
    const r = rnd();
    return r < 0.03 ? "gold_block" : r < 0.2 ? "blackstone" : r < 0.3 ? "polished_blackstone" : "polished_blackstone_bricks";
  };

  // scorched ground with a basalt causeway
  v.box(0, 0, 0, 26, 26, 0, () => (rnd() < 0.1 ? "magma_block" : "netherrack"));
  v.box(12, 0, 0, 14, 13, 0, "basalt");
  v.box(2, 13, 0, 24, 13, 0, "basalt");

  // outer walls with red nether brick trim and merlons
  for (let y = 1; y <= 8; y++) v.annulusRect(C, C, 12, 12, y, black);
  v.annulusRect(C, C, 12, 12, 7, "red_nether_bricks");
  for (let z = 1; z <= 25; z++)
    for (let x = 1; x <= 25; x++)
      if (Math.max(Math.abs(x - C), Math.abs(z - C)) === 12 && (x + z) % 2 === 0)
        v.set(x, z, 9, "polished_blackstone_bricks");

  // gate: pointed arch with hanging chains, flanked by basalt pillars
  v.clear(11, 1, 1, 15, 1, 4);
  v.clear(12, 1, 5, 14, 1, 5);
  v.set(12, 1, 5, "chain"); v.set(14, 1, 5, "chain");
  for (const px of [9, 17]) {
    v.box(px, 0, 1, px, 0, 8, "basalt");
    v.set(px, 0, 9, "soul_lantern");
  }

  // corner turrets with gold bands and magma crowns
  for (const [tx, tz] of [[3, 3], [23, 3], [3, 23], [23, 23]]) {
    for (let y = 1; y <= 11; y++) v.annulusRect(tx, tz, 2, 2, y, black);
    v.annulusRect(tx, tz, 2, 2, 10, "gold_block");
    v.annulusRect(tx, tz, 0, 2, 11, black);
    for (let z = tz - 2; z <= tz + 2; z++)
      for (let x = tx - 2; x <= tx + 2; x++)
        if (Math.max(Math.abs(x - tx), Math.abs(z - tz)) === 2 && (x + z) % 2 === 0)
          v.set(x, z, 12, "polished_blackstone_bricks");
    v.set(tx, tz, 12, "magma_block");
  }

  // lava falls spilling from the side walls into ground pools
  for (const [lx, lz] of [[26, 8], [0, 18]]) {
    v.box(lx, lz, 1, lx, lz, 7, "lava");
    v.set(lx, lz - 1, 0, "lava"); v.set(lx, lz + 1, 0, "lava"); v.set(lx, lz, 0, "lava");
  }

  // obsidian spire keep with glowstone rings
  v.cylinder(C, C, 1, 14, 3.5, () => (rnd() < 0.2 ? "crying_obsidian" : "obsidian"), true);
  v.ringCircle(C, C, 5, 3.5, "glowstone");
  v.ringCircle(C, C, 10, 3.5, "glowstone");
  v.clear(C, 10, 1, C, 10, 2);                                  // spire door (south face)
  v.disk(C, C, 15, 4, black);
  v.ringCircle(C, C, 16, 4, "polished_blackstone_bricks");
  v.disk(C, C, 16, 1.5, "magma_block");
  v.set(C, C, 17, "crying_obsidian");
  v.set(C, C, 18, "soul_lantern");

  // courtyard lamp posts
  for (const [px, pz] of [[8, 8], [18, 8], [8, 18], [18, 18]]) {
    v.box(px, pz, 1, px, pz, 2, "basalt");
    v.set(px, pz, 3, "soul_lantern");
  }

  templates.push(toTemplate({
    id: "emberreach_bastion",
    name: "Emberreach Bastion",
    category: "Infernal",
    difficulty: "Advanced",
    description:
      "A nether war-fortress in gilded blackstone: 27×27 walls trimmed with red nether brick, " +
      "four turrets with gold bands and magma crowns, a chain-hung gate flanked by basalt " +
      "pillars, lava spilling from the ramparts into ground pools, and an obsidian spire keep " +
      "ringed in glowstone under a crying-obsidian beacon.",
    tips: [
      "The ~3% gold blocks scattered in the walls are the 'gilded blackstone' effect — place them as you go.",
      "Pour the lava falls LAST, from the wall spouts, after everything below is fireproof.",
      "Soul lanterns everywhere: their teal against the lava's orange is the whole color story.",
      "In the actual Nether, swap the ground for the local netherrack and it sits perfectly.",
    ],
  }, v));
}

/* ============================================================
   13. STARGAZER DOME — copper observatory, 19×19×22
   ============================================================ */
{
  const W = 19, D = 19, H = 22;
  const v = new Vox(W, D, H);
  const rnd = mulberry32(3141);
  const C = 9;
  const stone = () => {
    const r = rnd();
    return r < 0.1 ? "mossy_stone_bricks" : r < 0.16 ? "cracked_stone_bricks" : "stone_bricks";
  };
  const copper = () => {
    const r = rnd();
    return r < 0.55 ? "oxidized_copper" : r < 0.85 ? "weathered_copper" : "copper_block";
  };

  // tower base
  v.disk(C, C, 0, 7, "cobblestone");
  v.cylinder(C, C, 1, 9, 6, stone, true);
  v.disk(C, C, 1, 5, "spruce_planks");                          // ground floor
  v.clear(C, 3, 1, C, 3, 2);
  v.set(C, 3, 1, "spruce_door");
  v.set(C - 2, 2, 1, "lantern"); v.set(C + 2, 2, 1, "lantern");
  // window slits
  for (const [wx, wz] of [[C + 6, C], [C - 6, C], [C, C + 6]]) v.box(wx, wz, 5, wx, wz, 6, "glass_pane");
  // study interior
  v.set(C - 3, C + 2, 2, "bookshelf"); v.set(C - 2, C + 3, 2, "bookshelf"); v.set(C - 3, C + 3, 2, "bookshelf");
  v.set(C + 3, C + 2, 2, "crafting_table");
  v.disk(C, C, 6, 5, "spruce_planks");                          // observation floor

  // balcony ring with iron railing
  v.disk(C, C, 10, 7, "smooth_stone");
  v.ringCircle(C, C, 11, 7, "iron_bars");
  // dome-room wall
  v.cylinder(C, C, 11, 13, 5, "calcite", true);
  for (const [wx, wz] of [[C + 5, C], [C - 5, C], [C, C + 5]]) v.box(wx, wz, 12, wx, wz, 12, "glass");

  // weathered copper dome
  const dome = [[14, 5], [15, 4.7], [16, 4.2], [17, 3.4]];
  dome.forEach(([y, r]) => v.ringCircle(C, C, y, r, copper));
  v.disk(C, C, 18, 2.2, copper);
  v.disk(C, C, 19, 1, copper);
  // observation slit facing south + telescope poking through
  v.clear(8, 2, 14, 10, 7, 18);
  v.box(C, C, 11, C, C, 12, "iron_block");                      // mount
  const tube = [[C, 8, 13], [C, 7, 14], [C, 6, 15], [C, 5, 16], [C, 4, 17]];
  tube.forEach(([x, z, y]) => v.set(x, z, y, "iron_block"));
  v.set(C, 3, 18, "light_blue_stained_glass");                  // objective lens glint
  v.set(C, C, 20, "end_rod");                                   // finial / lightning rod

  templates.push(toTemplate({
    id: "stargazer_dome",
    name: "Stargazer Dome",
    category: "Astral",
    difficulty: "Advanced",
    description:
      "A stone observatory tower crowned with a weathered-copper dome, split by an open " +
      "observation slit where a blackstone telescope tilts at the southern sky. Below: an " +
      "iron-railed balcony ring, a calcite dome room, and a lantern-lit study floor with " +
      "bookshelves for your star charts.",
    tips: [
      "The dome mixes three copper oxidation stages — wax each block once it reaches the stage you want.",
      "The telescope is five blocks stepping one up and one out — through the slit, aimed at the stars.",
      "Put it on your highest peak; the end rod on top doubles as a lightning rod stand-in.",
      "Spyglass + ender chest of star charts in the study, obviously.",
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
