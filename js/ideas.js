/* ============================================================
   BlockCraft Planner — build idea generator
   Rolls a structure × style × twist combo with a ready palette
   and suggested canvas size, so starting a build takes one tap.
   All palette entries must be valid ids from js/blocks.js.
   ============================================================ */

const IDEA_STRUCTURES = [
  { name: "cottage",          w: 11, d: 9,  h: 8  },
  { name: "watchtower",       w: 9,  d: 9,  h: 16 },
  { name: "windmill",         w: 11, d: 11, h: 18 },
  { name: "bridge",           w: 19, d: 5,  h: 8  },
  { name: "lighthouse",       w: 9,  d: 9,  h: 18 },
  { name: "tavern",           w: 13, d: 11, h: 10 },
  { name: "chapel",           w: 11, d: 15, h: 12 },
  { name: "barn",             w: 13, d: 9,  h: 9  },
  { name: "fishing pier",     w: 7,  d: 17, h: 6  },
  { name: "garden gazebo",    w: 9,  d: 9,  h: 7  },
  { name: "village well plaza", w: 11, d: 11, h: 6 },
  { name: "gatehouse",        w: 13, d: 7,  h: 10 },
  { name: "ruined keep",      w: 15, d: 15, h: 10 },
  { name: "greenhouse",       w: 11, d: 9,  h: 7  },
  { name: "library",          w: 13, d: 11, h: 10 },
  { name: "blacksmith forge", w: 11, d: 9,  h: 8  },
  { name: "market stall row", w: 15, d: 7,  h: 6  },
  { name: "fishing boat",     w: 7,  d: 13, h: 8  },
  { name: "tree fort",        w: 15, d: 15, h: 16 },
];

const IDEA_STYLES = [
  { name: "Rustic oak",      palette: ["oak_planks", "oak_log", "cobblestone", "oak_stairs", "glass_pane"] },
  { name: "Alpine spruce",   palette: ["spruce_planks", "spruce_log", "stone_bricks", "cobblestone", "lantern"] },
  { name: "Tudor",           palette: ["calcite", "dark_oak_log", "dark_oak_planks", "deepslate_tiles", "glass_pane"] },
  { name: "Desert sandstone",palette: ["sandstone", "smooth_sandstone", "cut_sandstone", "orange_terracotta", "torch"] },
  { name: "Seaside",         palette: ["white_concrete", "light_blue_concrete", "spruce_planks", "glass", "sea_lantern"] },
  { name: "Gothic",          palette: ["stone_bricks", "deepslate_tiles", "polished_blackstone", "blue_stained_glass", "iron_bars"] },
  { name: "Overgrown ruin",  palette: ["cracked_stone_bricks", "mossy_stone_bricks", "moss_block", "oak_leaves", "cobblestone"] },
  { name: "Steampunk",       palette: ["copper_block", "exposed_copper", "dark_oak_planks", "iron_block", "glass"] },
  { name: "Frozen",          palette: ["packed_ice", "blue_ice", "snow_block", "ice", "soul_lantern"] },
  { name: "Japanese",        palette: ["white_terracotta", "red_terracotta", "dark_oak_planks", "dark_oak_stairs", "lantern"] },
  { name: "Nether-touched",  palette: ["polished_blackstone_bricks", "nether_bricks", "magma_block", "gold_block", "soul_lantern"] },
  { name: "End-touched",     palette: ["purpur_block", "end_stone_bricks", "amethyst_block", "obsidian", "end_rod"] },
];

const IDEA_TWISTS = [
  "on stilts over the water",
  "built into a hillside",
  "with a rooftop garden",
  "half-ruined and overgrown",
  "perched on a tiny floating island",
  "wrapped around a giant tree",
  "with a small waterfall feature",
  "with a bell tower on one corner",
  "leaning like it grew crooked",
  "with a glass atrium roof",
  "guarded by two statue pillars",
  "with a cozy chimney and campfire smoke",
  "connected to a dock by a boardwalk",
  "with lanterns strung along the eaves",
];

const IDEA_TIPS = [
  "Turn on Mirror X before you start — symmetric fronts build themselves.",
  "Draw layer 1 as just the outline first; fill floors after the shape feels right.",
  "Use the Ellipse tool for anything round — towers, ponds, plazas.",
  "Duplicate-layer-up is the fastest way to raise walls.",
  "Check the 3D preview every few layers; problems show up there first.",
  "Odd widths give you a center block for the door and windows.",
];

function rollIdea() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const s = pick(IDEA_STRUCTURES);
  const style = pick(IDEA_STYLES);
  return {
    structure: s,
    style,
    twist: pick(IDEA_TWISTS),
    tip: pick(IDEA_TIPS),
    title: `${style.name} ${s.name}`,
  };
}
