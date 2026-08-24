/* ============================================================
   BlockCraft Planner — block palette data
   Each block: id (minecraft-ish id), name, color (hex), cat,
   optional alpha (translucent render), optional note shown in
   the materials list (e.g. doors span 2 cells but cost 1 item).
   ============================================================ */

const BLOCK_CATEGORIES = [
  "Wood",
  "Stone",
  "Brick & Nether",
  "Concrete",
  "Wool",
  "Terracotta",
  "Glass",
  "Nature",
  "Stairs, Slabs & Fences",
  "Light & Utility",
  "Metal & Gems",
];

const BLOCKS = [
  // ---------------- Wood ----------------
  { id: "oak_planks",      name: "Oak Planks",      color: "#b8945f", cat: "Wood" },
  { id: "spruce_planks",   name: "Spruce Planks",   color: "#7a5a35", cat: "Wood" },
  { id: "birch_planks",    name: "Birch Planks",    color: "#d7c185", cat: "Wood" },
  { id: "jungle_planks",   name: "Jungle Planks",   color: "#b88764", cat: "Wood" },
  { id: "acacia_planks",   name: "Acacia Planks",   color: "#ba6337", cat: "Wood" },
  { id: "dark_oak_planks", name: "Dark Oak Planks", color: "#4f3218", cat: "Wood" },
  { id: "mangrove_planks", name: "Mangrove Planks", color: "#773934", cat: "Wood" },
  { id: "cherry_planks",   name: "Cherry Planks",   color: "#e2b6af", cat: "Wood" },
  { id: "bamboo_planks",   name: "Bamboo Planks",   color: "#c4a94d", cat: "Wood" },
  { id: "crimson_planks",  name: "Crimson Planks",  color: "#7e3a56", cat: "Wood" },
  { id: "warped_planks",   name: "Warped Planks",   color: "#2b6963", cat: "Wood" },
  { id: "oak_log",         name: "Oak Log",         color: "#6e5530", cat: "Wood" },
  { id: "spruce_log",      name: "Spruce Log",      color: "#553a1f", cat: "Wood" },
  { id: "birch_log",       name: "Birch Log",       color: "#c8c29f", cat: "Wood" },
  { id: "dark_oak_log",    name: "Dark Oak Log",    color: "#3b2711", cat: "Wood" },
  { id: "acacia_log",      name: "Acacia Log",      color: "#676157", cat: "Wood" },
  { id: "stripped_oak_log",    name: "Stripped Oak Log",    color: "#c6a165", cat: "Wood" },
  { id: "stripped_spruce_log", name: "Stripped Spruce Log", color: "#8a6538", cat: "Wood" },
  { id: "bookshelf",       name: "Bookshelf",       color: "#a3824f", cat: "Wood" },

  // ---------------- Stone ----------------
  { id: "stone",                name: "Stone",                 color: "#7d7d7d", cat: "Stone" },
  { id: "cobblestone",          name: "Cobblestone",           color: "#6e6e6e", cat: "Stone" },
  { id: "mossy_cobblestone",    name: "Mossy Cobblestone",     color: "#66765a", cat: "Stone" },
  { id: "stone_bricks",         name: "Stone Bricks",          color: "#797979", cat: "Stone" },
  { id: "mossy_stone_bricks",   name: "Mossy Stone Bricks",    color: "#737b64", cat: "Stone" },
  { id: "cracked_stone_bricks", name: "Cracked Stone Bricks",  color: "#6d6c6c", cat: "Stone" },
  { id: "chiseled_stone_bricks",name: "Chiseled Stone Bricks", color: "#8a8a8a", cat: "Stone" },
  { id: "smooth_stone",         name: "Smooth Stone",          color: "#9e9e9e", cat: "Stone" },
  { id: "andesite",             name: "Andesite",              color: "#888c8c", cat: "Stone" },
  { id: "polished_andesite",    name: "Polished Andesite",     color: "#84878a", cat: "Stone" },
  { id: "diorite",              name: "Diorite",               color: "#bdbdbe", cat: "Stone" },
  { id: "polished_diorite",     name: "Polished Diorite",      color: "#c3c4c6", cat: "Stone" },
  { id: "granite",              name: "Granite",               color: "#95655b", cat: "Stone" },
  { id: "polished_granite",     name: "Polished Granite",      color: "#9a6c59", cat: "Stone" },
  { id: "deepslate",            name: "Deepslate",             color: "#4c4c50", cat: "Stone" },
  { id: "cobbled_deepslate",    name: "Cobbled Deepslate",     color: "#54545a", cat: "Stone" },
  { id: "polished_deepslate",   name: "Polished Deepslate",    color: "#48484e", cat: "Stone" },
  { id: "deepslate_bricks",     name: "Deepslate Bricks",      color: "#464650", cat: "Stone" },
  { id: "deepslate_tiles",      name: "Deepslate Tiles",       color: "#39393f", cat: "Stone" },
  { id: "tuff",                 name: "Tuff",                  color: "#6f6f68", cat: "Stone" },
  { id: "calcite",              name: "Calcite",               color: "#dfdfda", cat: "Stone" },
  { id: "dripstone_block",      name: "Dripstone Block",       color: "#866b5c", cat: "Stone" },
  { id: "sandstone",            name: "Sandstone",             color: "#d8cb9a", cat: "Stone" },
  { id: "smooth_sandstone",     name: "Smooth Sandstone",      color: "#e0d6a4", cat: "Stone" },
  { id: "cut_sandstone",        name: "Cut Sandstone",         color: "#dacf9e", cat: "Stone" },
  { id: "red_sandstone",        name: "Red Sandstone",         color: "#b8622f", cat: "Stone" },
  { id: "blackstone",           name: "Blackstone",            color: "#2a252c", cat: "Stone" },
  { id: "polished_blackstone",  name: "Polished Blackstone",   color: "#35313a", cat: "Stone" },
  { id: "polished_blackstone_bricks", name: "Polished Blackstone Bricks", color: "#302b34", cat: "Stone" },
  { id: "basalt",               name: "Basalt",                color: "#4e4e54", cat: "Stone" },
  { id: "smooth_basalt",        name: "Smooth Basalt",         color: "#48484e", cat: "Stone" },

  // ---------------- Brick & Nether ----------------
  { id: "bricks",              name: "Bricks",              color: "#97614e", cat: "Brick & Nether" },
  { id: "mud_bricks",          name: "Mud Bricks",          color: "#8c6c50", cat: "Brick & Nether" },
  { id: "nether_bricks",       name: "Nether Bricks",       color: "#2c161a", cat: "Brick & Nether" },
  { id: "red_nether_bricks",   name: "Red Nether Bricks",   color: "#470a0a", cat: "Brick & Nether" },
  { id: "prismarine",          name: "Prismarine",          color: "#639c97", cat: "Brick & Nether" },
  { id: "prismarine_bricks",   name: "Prismarine Bricks",   color: "#63b5ac", cat: "Brick & Nether" },
  { id: "dark_prismarine",     name: "Dark Prismarine",     color: "#335f4f", cat: "Brick & Nether" },
  { id: "purpur_block",        name: "Purpur Block",        color: "#a97ba9", cat: "Brick & Nether" },
  { id: "end_stone",           name: "End Stone",           color: "#dbde9e", cat: "Brick & Nether" },
  { id: "end_stone_bricks",    name: "End Stone Bricks",    color: "#d6d8a3", cat: "Brick & Nether" },
  { id: "quartz_block",        name: "Quartz Block",        color: "#ece9e2", cat: "Brick & Nether" },
  { id: "smooth_quartz",       name: "Smooth Quartz",       color: "#f0ece4", cat: "Brick & Nether" },
  { id: "quartz_bricks",       name: "Quartz Bricks",       color: "#eae6df", cat: "Brick & Nether" },
  { id: "quartz_pillar",       name: "Quartz Pillar",       color: "#ede9e1", cat: "Brick & Nether" },
  { id: "obsidian",            name: "Obsidian",            color: "#14121e", cat: "Brick & Nether" },
  { id: "crying_obsidian",     name: "Crying Obsidian",     color: "#2a1259", cat: "Brick & Nether" },
  { id: "netherrack",          name: "Netherrack",          color: "#6f3634", cat: "Brick & Nether" },
  { id: "magma_block",         name: "Magma Block",         color: "#8e3f20", cat: "Brick & Nether" },

  // ---------------- Concrete ----------------
  { id: "white_concrete",      name: "White Concrete",      color: "#cfd5d6", cat: "Concrete" },
  { id: "light_gray_concrete", name: "Light Gray Concrete", color: "#7d7d73", cat: "Concrete" },
  { id: "gray_concrete",       name: "Gray Concrete",       color: "#36393d", cat: "Concrete" },
  { id: "black_concrete",      name: "Black Concrete",      color: "#080a0f", cat: "Concrete" },
  { id: "brown_concrete",      name: "Brown Concrete",      color: "#603b1f", cat: "Concrete" },
  { id: "red_concrete",        name: "Red Concrete",        color: "#8e2121", cat: "Concrete" },
  { id: "orange_concrete",     name: "Orange Concrete",     color: "#e06100", cat: "Concrete" },
  { id: "yellow_concrete",     name: "Yellow Concrete",     color: "#f1af15", cat: "Concrete" },
  { id: "lime_concrete",       name: "Lime Concrete",       color: "#5ea818", cat: "Concrete" },
  { id: "green_concrete",      name: "Green Concrete",      color: "#495b24", cat: "Concrete" },
  { id: "cyan_concrete",       name: "Cyan Concrete",       color: "#157788", cat: "Concrete" },
  { id: "light_blue_concrete", name: "Light Blue Concrete", color: "#2489c7", cat: "Concrete" },
  { id: "blue_concrete",       name: "Blue Concrete",       color: "#2c2e8f", cat: "Concrete" },
  { id: "purple_concrete",     name: "Purple Concrete",     color: "#64209c", cat: "Concrete" },
  { id: "magenta_concrete",    name: "Magenta Concrete",    color: "#a9309f", cat: "Concrete" },
  { id: "pink_concrete",       name: "Pink Concrete",       color: "#d5658f", cat: "Concrete" },

  // ---------------- Wool ----------------
  { id: "white_wool",      name: "White Wool",      color: "#e9ecec", cat: "Wool" },
  { id: "light_gray_wool", name: "Light Gray Wool", color: "#8e8e86", cat: "Wool" },
  { id: "gray_wool",       name: "Gray Wool",       color: "#3e4447", cat: "Wool" },
  { id: "black_wool",      name: "Black Wool",      color: "#141519", cat: "Wool" },
  { id: "brown_wool",      name: "Brown Wool",      color: "#825432", cat: "Wool" },
  { id: "red_wool",        name: "Red Wool",        color: "#a12722", cat: "Wool" },
  { id: "orange_wool",     name: "Orange Wool",     color: "#f07613", cat: "Wool" },
  { id: "yellow_wool",     name: "Yellow Wool",     color: "#f8c527", cat: "Wool" },
  { id: "lime_wool",       name: "Lime Wool",       color: "#70b919", cat: "Wool" },
  { id: "green_wool",      name: "Green Wool",      color: "#546d1b", cat: "Wool" },
  { id: "cyan_wool",       name: "Cyan Wool",       color: "#158991", cat: "Wool" },
  { id: "light_blue_wool", name: "Light Blue Wool", color: "#3aafd9", cat: "Wool" },
  { id: "blue_wool",       name: "Blue Wool",       color: "#35399d", cat: "Wool" },
  { id: "purple_wool",     name: "Purple Wool",     color: "#7b2fbe", cat: "Wool" },
  { id: "magenta_wool",    name: "Magenta Wool",    color: "#bd44b3", cat: "Wool" },
  { id: "pink_wool",       name: "Pink Wool",       color: "#ed8dac", cat: "Wool" },

  // ---------------- Terracotta ----------------
  { id: "terracotta",            name: "Terracotta",            color: "#985e43", cat: "Terracotta" },
  { id: "white_terracotta",      name: "White Terracotta",      color: "#d2b2a1", cat: "Terracotta" },
  { id: "light_gray_terracotta", name: "Light Gray Terracotta", color: "#876b62", cat: "Terracotta" },
  { id: "gray_terracotta",       name: "Gray Terracotta",       color: "#3a2a24", cat: "Terracotta" },
  { id: "black_terracotta",      name: "Black Terracotta",      color: "#251710", cat: "Terracotta" },
  { id: "brown_terracotta",      name: "Brown Terracotta",      color: "#4d3324", cat: "Terracotta" },
  { id: "red_terracotta",        name: "Red Terracotta",        color: "#8f3d2e", cat: "Terracotta" },
  { id: "orange_terracotta",     name: "Orange Terracotta",     color: "#a15325", cat: "Terracotta" },
  { id: "yellow_terracotta",     name: "Yellow Terracotta",     color: "#b98423", cat: "Terracotta" },
  { id: "cyan_terracotta",       name: "Cyan Terracotta",       color: "#575b5b", cat: "Terracotta" },

  // ---------------- Glass ----------------
  { id: "glass",                    name: "Glass",                    color: "#e5f3f3", cat: "Glass", alpha: 0.55 },
  { id: "glass_pane",               name: "Glass Pane",               color: "#dcecec", cat: "Glass", alpha: 0.55 },
  { id: "white_stained_glass",      name: "White Stained Glass",      color: "#ffffff", cat: "Glass", alpha: 0.6 },
  { id: "gray_stained_glass",       name: "Gray Stained Glass",       color: "#4c4c4c", cat: "Glass", alpha: 0.6 },
  { id: "black_stained_glass",      name: "Black Stained Glass",      color: "#191919", cat: "Glass", alpha: 0.6 },
  { id: "red_stained_glass",        name: "Red Stained Glass",        color: "#993333", cat: "Glass", alpha: 0.6 },
  { id: "yellow_stained_glass",     name: "Yellow Stained Glass",     color: "#e5e533", cat: "Glass", alpha: 0.6 },
  { id: "light_blue_stained_glass", name: "Light Blue Stained Glass", color: "#6699d8", cat: "Glass", alpha: 0.6 },
  { id: "blue_stained_glass",       name: "Blue Stained Glass",       color: "#334cb2", cat: "Glass", alpha: 0.6 },
  { id: "green_stained_glass",      name: "Green Stained Glass",      color: "#667f33", cat: "Glass", alpha: 0.6 },

  // ---------------- Nature ----------------
  { id: "grass_block",   name: "Grass Block",   color: "#5d923a", cat: "Nature" },
  { id: "dirt",          name: "Dirt",          color: "#866043", cat: "Nature" },
  { id: "coarse_dirt",   name: "Coarse Dirt",   color: "#77553b", cat: "Nature" },
  { id: "farmland",      name: "Farmland",      color: "#79553a", cat: "Nature" },
  { id: "dirt_path",     name: "Dirt Path",     color: "#94794a", cat: "Nature" },
  { id: "mud",           name: "Mud",           color: "#3c3a3d", cat: "Nature" },
  { id: "sand",          name: "Sand",          color: "#dbd3a0", cat: "Nature" },
  { id: "red_sand",      name: "Red Sand",      color: "#be6621", cat: "Nature" },
  { id: "gravel",        name: "Gravel",        color: "#807f7f", cat: "Nature" },
  { id: "clay",          name: "Clay",          color: "#9ea4b0", cat: "Nature" },
  { id: "moss_block",    name: "Moss Block",    color: "#546e2c", cat: "Nature" },
  { id: "oak_leaves",    name: "Oak Leaves",    color: "#4d7a28", cat: "Nature", alpha: 0.9 },
  { id: "spruce_leaves", name: "Spruce Leaves", color: "#3e6039", cat: "Nature", alpha: 0.9 },
  { id: "azalea_leaves", name: "Azalea Leaves", color: "#5f7628", cat: "Nature", alpha: 0.9 },
  { id: "snow_block",    name: "Snow Block",    color: "#f6fbfb", cat: "Nature" },
  { id: "ice",           name: "Ice",           color: "#7dadff", cat: "Nature", alpha: 0.7 },
  { id: "packed_ice",    name: "Packed Ice",    color: "#8cb4fc", cat: "Nature" },
  { id: "blue_ice",      name: "Blue Ice",      color: "#74a8fd", cat: "Nature" },
  { id: "water",         name: "Water (bucket)", color: "#3f76e4", cat: "Nature", alpha: 0.75, note: "2 buckets in a 2×2 pool make an infinite source" },
  { id: "lava",          name: "Lava (bucket)",  color: "#d45a12", cat: "Nature", alpha: 0.9 },
  { id: "wheat_crop",    name: "Wheat (seeds)",  color: "#d5bb65", cat: "Nature" },
  { id: "hay_block",     name: "Hay Bale",      color: "#ac8b30", cat: "Nature" },
  { id: "pumpkin",       name: "Pumpkin",       color: "#c07615", cat: "Nature" },
  { id: "melon",         name: "Melon",         color: "#71aa34", cat: "Nature" },

  // ---------------- Stairs, Slabs & Fences ----------------
  { id: "oak_stairs",          name: "Oak Stairs",          color: "#ab8752", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "oak_slab",            name: "Oak Slab",            color: "#c19a63", cat: "Stairs, Slabs & Fences" },
  { id: "spruce_stairs",       name: "Spruce Stairs",       color: "#6d5030", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "spruce_slab",         name: "Spruce Slab",         color: "#81603a", cat: "Stairs, Slabs & Fences" },
  { id: "dark_oak_stairs",     name: "Dark Oak Stairs",     color: "#472d15", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "dark_oak_slab",       name: "Dark Oak Slab",       color: "#573920", cat: "Stairs, Slabs & Fences" },
  { id: "stone_brick_stairs",  name: "Stone Brick Stairs",  color: "#6f6f6f", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "stone_brick_slab",    name: "Stone Brick Slab",    color: "#848484", cat: "Stairs, Slabs & Fences" },
  { id: "cobblestone_stairs",  name: "Cobblestone Stairs",  color: "#636363", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "cobblestone_slab",    name: "Cobblestone Slab",    color: "#787878", cat: "Stairs, Slabs & Fences" },
  { id: "brick_stairs",        name: "Brick Stairs",        color: "#8a5745", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "quartz_stairs",       name: "Quartz Stairs",       color: "#e2ded6", cat: "Stairs, Slabs & Fences", note: "orientation is chosen in-game" },
  { id: "oak_fence",           name: "Oak Fence",           color: "#a5824e", cat: "Stairs, Slabs & Fences" },
  { id: "spruce_fence",        name: "Spruce Fence",        color: "#725434", cat: "Stairs, Slabs & Fences" },
  { id: "dark_oak_fence",      name: "Dark Oak Fence",      color: "#4a2f16", cat: "Stairs, Slabs & Fences" },
  { id: "oak_fence_gate",      name: "Oak Fence Gate",      color: "#9f7c49", cat: "Stairs, Slabs & Fences" },
  { id: "cobblestone_wall",    name: "Cobblestone Wall",    color: "#666666", cat: "Stairs, Slabs & Fences" },
  { id: "stone_brick_wall",    name: "Stone Brick Wall",    color: "#747474", cat: "Stairs, Slabs & Fences" },
  { id: "deepslate_brick_wall",name: "Deepslate Brick Wall",color: "#44444e", cat: "Stairs, Slabs & Fences" },

  // ---------------- Light & Utility ----------------
  { id: "torch",          name: "Torch",          color: "#ffd800", cat: "Light & Utility" },
  { id: "soul_torch",     name: "Soul Torch",     color: "#67e8f9", cat: "Light & Utility" },
  { id: "lantern",        name: "Lantern",        color: "#e8a33c", cat: "Light & Utility" },
  { id: "soul_lantern",   name: "Soul Lantern",   color: "#71cdd6", cat: "Light & Utility" },
  { id: "glowstone",      name: "Glowstone",      color: "#cda870", cat: "Light & Utility" },
  { id: "sea_lantern",    name: "Sea Lantern",    color: "#b3c9c3", cat: "Light & Utility" },
  { id: "shroomlight",    name: "Shroomlight",    color: "#f2954f", cat: "Light & Utility" },
  { id: "redstone_lamp",  name: "Redstone Lamp",  color: "#7a4a2b", cat: "Light & Utility" },
  { id: "campfire",       name: "Campfire",       color: "#d3862e", cat: "Light & Utility" },
  { id: "end_rod",        name: "End Rod",        color: "#e0dbd3", cat: "Light & Utility" },
  { id: "oak_door",       name: "Oak Door",       color: "#8b6f3f", cat: "Light & Utility", note: "1 door fills 2 vertical cells — draw only the bottom cell" },
  { id: "spruce_door",    name: "Spruce Door",    color: "#6a4f2e", cat: "Light & Utility", note: "1 door fills 2 vertical cells — draw only the bottom cell" },
  { id: "iron_door",      name: "Iron Door",      color: "#c4c4c4", cat: "Light & Utility", note: "1 door fills 2 vertical cells — draw only the bottom cell" },
  { id: "oak_trapdoor",   name: "Oak Trapdoor",   color: "#7f6237", cat: "Light & Utility" },
  { id: "spruce_trapdoor",name: "Spruce Trapdoor",color: "#674c2b", cat: "Light & Utility" },
  { id: "ladder",         name: "Ladder",         color: "#a8834a", cat: "Light & Utility" },
  { id: "scaffolding",    name: "Scaffolding",    color: "#b3844a", cat: "Light & Utility" },
  { id: "chest",          name: "Chest",          color: "#a06d2c", cat: "Light & Utility" },
  { id: "barrel",         name: "Barrel",         color: "#815e36", cat: "Light & Utility" },
  { id: "crafting_table", name: "Crafting Table", color: "#7d5530", cat: "Light & Utility" },
  { id: "furnace",        name: "Furnace",        color: "#5e5e5e", cat: "Light & Utility" },
  { id: "iron_bars",      name: "Iron Bars",      color: "#888c88", cat: "Light & Utility", alpha: 0.85 },
  { id: "chain",          name: "Chain",          color: "#3b4352", cat: "Light & Utility", alpha: 0.85 },
  { id: "bell",           name: "Bell",           color: "#f5c542", cat: "Light & Utility" },

  // ---------------- Metal & Gems ----------------
  { id: "iron_block",        name: "Block of Iron",      color: "#dcdcdc", cat: "Metal & Gems" },
  { id: "gold_block",        name: "Block of Gold",      color: "#f6d33c", cat: "Metal & Gems" },
  { id: "diamond_block",     name: "Block of Diamond",   color: "#65e3d5", cat: "Metal & Gems" },
  { id: "emerald_block",     name: "Block of Emerald",   color: "#2cc153", cat: "Metal & Gems" },
  { id: "netherite_block",   name: "Block of Netherite", color: "#3b383c", cat: "Metal & Gems" },
  { id: "lapis_block",       name: "Block of Lapis",     color: "#274daa", cat: "Metal & Gems" },
  { id: "redstone_block",    name: "Block of Redstone",  color: "#971607", cat: "Metal & Gems" },
  { id: "coal_block",        name: "Block of Coal",      color: "#101010", cat: "Metal & Gems" },
  { id: "amethyst_block",    name: "Block of Amethyst",  color: "#855fc0", cat: "Metal & Gems" },
  { id: "copper_block",      name: "Block of Copper",    color: "#c06b4f", cat: "Metal & Gems" },
  { id: "exposed_copper",    name: "Exposed Copper",     color: "#9a7560", cat: "Metal & Gems" },
  { id: "weathered_copper",  name: "Weathered Copper",   color: "#648d7b", cat: "Metal & Gems" },
  { id: "oxidized_copper",   name: "Oxidized Copper",    color: "#4fab90", cat: "Metal & Gems" },
  { id: "cut_copper",        name: "Cut Copper",         color: "#bf6b51", cat: "Metal & Gems" },
];

/* Fast lookups */
const BLOCK_BY_ID = Object.create(null);
BLOCKS.forEach((b, i) => { b.index = i + 1; BLOCK_BY_ID[b.id] = b; }); // 0 is reserved for air

/* Items with a non-64 stack size. Filled buckets don't stack at all,
   so water/lava counts must never be shown as "N stacks". */
const STACK_SIZE_OVERRIDES = Object.assign(Object.create(null), {
  water: 1,
  lava: 1,
});

function stackSizeOf(id) { return STACK_SIZE_OVERRIDES[id] || 64; }

/* Shade helper used by both the 2-D grid and the isometric preview. */
function shadeColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (pct >= 0) {
    r += (255 - r) * pct; g += (255 - g) * pct; b += (255 - b) * pct;
  } else {
    r *= 1 + pct; g *= 1 + pct; b *= 1 + pct;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
