/* ============================================================
   BlockCraft Planner — building guides
   Each guide: id, title, icon (emoji), blurb, and body (HTML).
   Body HTML is authored here (trusted, static content).
   ============================================================ */

const GUIDES = [
  {
    id: "first_blueprint",
    icon: "✏️",
    title: "Your First Blueprint",
    blurb: "Learn the planner in 5 minutes: layers, tools, materials and exporting.",
    body: `
<p>A blueprint here is a stack of <strong>layers</strong> — horizontal slices of your build,
exactly like the Y-levels in Minecraft. Layer&nbsp;1 is the ground course, layer&nbsp;2 sits on
top of it, and so on. You draw each slice top-down, and the planner counts every block for you.</p>

<h3>1. Start a blueprint</h3>
<ul>
<li>Click <strong>New</strong> and set a size. Width runs left–right (X), depth runs up–down on the
grid (Z), height is the number of layers (Y). A small house fits comfortably in 12×12×10.</li>
<li>Or open <strong>Templates</strong> and load a finished build to poke around in — it's the
fastest way to see how layers work.</li>
</ul>

<h3>2. Draw</h3>
<ul>
<li>Pick a block in the left palette (search box up top), then draw on the grid with the
<strong>Pencil</strong>. Hold and drag to paint. <strong>Right-click always erases.</strong></li>
<li><strong>Line</strong>, <strong>Rectangle</strong> and <strong>Ellipse</strong> drag out shapes —
ellipse is the secret weapon for towers and circular fountains. Toggle <em>Fill shape</em> to get
solid shapes instead of outlines.</li>
<li><strong>Fill</strong> (bucket) floods a connected area — great for floors.</li>
<li><strong>Mirror X/Z</strong> paints both halves of a symmetric build at once. Turn it on before
you start a house front and you'll never miscount a window again.</li>
</ul>

<h3>3. Move between layers</h3>
<ul>
<li>Use the layer arrows or press <kbd>[</kbd> / <kbd>]</kbd> to step down/up.</li>
<li><strong>Onion skin</strong> shows the layer below as a ghost, so you can line walls up with
the floor beneath them.</li>
<li><strong>Duplicate layer up</strong> copies this layer to the one above — walls in one click.</li>
</ul>

<h3>4. Check the materials</h3>
<p>The Materials panel updates live: every block type, total count, and how many
<strong>stacks</strong> (64) and <strong>shulker boxes</strong> (27 stacks) that means. Copy it to
your clipboard as a shopping list before you start mining.</p>

<h3>5. Save & export</h3>
<ul>
<li>Your work autosaves in the browser. <strong>Save</strong> keeps named copies.</li>
<li><strong>Export → JSON</strong> downloads a file you can back up or share; anyone can
<strong>Import</strong> it here.</li>
<li><strong>Export → Blueprint sheet (PNG)</strong> renders every layer with the material list —
print it or keep it on a second screen while you build.</li>
</ul>`,
  },

  {
    id: "in_game",
    icon: "🧭",
    title: "Building From a Blueprint In-Game",
    blurb: "How to translate layers into blocks without losing count.",
    body: `
<p>The planner's layers map one-to-one to Minecraft Y-levels. Here's the workflow experienced
builders use:</p>

<h3>Stake out the footprint</h3>
<ul>
<li>Clear and flatten the site first. Nothing ruins counting like a half-buried corner.</li>
<li>Place <strong>corner markers</strong> from layer 1 of the blueprint — temporary blocks of
something loud, like magenta wool, at all four corners.</li>
<li>Count out the outline of layer 1 along the edges, checking against the grid coordinates
shown in the planner's status bar.</li>
</ul>

<h3>Build layer by layer</h3>
<ul>
<li>Finish each layer completely before starting the next — resist the urge to run one wall to
the top. Mistakes caught one layer up cost minutes; caught ten layers up they cost an evening.</li>
<li>Use the planner's onion skin to see how the current layer sits on the one below.</li>
<li>For tall builds, carry <strong>scaffolding</strong> — it places fast, climbs like a ladder
and breaks in one hit from the bottom block.</li>
</ul>

<h3>Counting tricks</h3>
<ul>
<li>Blocks place in runs: count "1–2–3–4" out loud in repeating patterns instead of "17, 18, 19…".</li>
<li>Symmetric build? Build one half, then mirror it by eye from the finished half.</li>
<li>Doors sit in the <em>bottom</em> cell of their 2-block opening — the planner's door note in
the materials list reminds you.</li>
<li>Stairs and slabs in a blueprint mark <em>position</em>; you choose the facing when you place
them. Roof stairs face the ridge.</li>
</ul>

<h3>Don't build at night (at first)</h3>
<p>Until the shell is sealed and lit, creepers are a bigger threat to your build than
miscounting. Torch the site perimeter before you start.</p>`,
  },

  {
    id: "fundamentals",
    icon: "🏗️",
    title: "Building Fundamentals",
    blurb: "Why builds look boxy, and the three fixes: shape, depth, texture.",
    body: `
<p>Almost every "my build looks bad" problem is one of three things: a boring shape, flat walls,
or single-block texture. Fix them in that order.</p>

<h3>1. Shape (silhouette)</h3>
<ul>
<li>Avoid a single rectangle footprint. L-shapes, T-shapes, or a main body plus a smaller wing
read as "designed" instead of "default".</li>
<li>Vary the roofline: different wing heights, a tower, a chimney. If the silhouette is
interesting at sunset — pure black against the sky — the build works.</li>
<li>Sketch the footprint on layer 1 of the planner before anything else. It's free to move a
wall here; it's not free in-game.</li>
</ul>

<h3>2. Depth</h3>
<ul>
<li>Flat walls kill builds. Push window bays out by one block, inset the door, let log
<strong>corner posts</strong> stick out of the plank wall by keeping them proud on the grid.</li>
<li>Roof <strong>overhangs</strong>: extend the roof one block past the wall on each side.
It's the single highest-value trick in Minecraft building.</li>
<li>In-game, stairs, slabs, trapdoors, fences and walls add sub-block depth — window sills from
slabs, shutters from trapdoors.</li>
</ul>

<h3>3. Texture</h3>
<ul>
<li>Mix 2–3 similar blocks instead of one: stone bricks + ~15% cracked + ~10% mossy reads as
aged stone. Use the planner's pencil to scatter the accents randomly — <em>real</em> randomness,
not a checkerboard.</li>
<li>Keep gradients vertical: darker/rougher blocks low (cobble base course), cleaner blocks
high. Buildings in real life weather from the ground up.</li>
<li>Don't texture small builds to death — a 5×5 shed wants maybe one accent block.</li>
</ul>

<h3>Scale rule of thumb</h3>
<p>Interior rooms want ceilings 3–4 blocks high (2 feels like a cave), and walls look best at
odd widths — odd numbers give you a center block for the door, the window, the lantern.</p>`,
  },

  {
    id: "palettes",
    icon: "🎨",
    title: "Choosing a Block Palette",
    blurb: "Base + accent + detail: reliable color recipes that always work.",
    body: `
<p>A palette is 3–5 blocks with jobs: a <strong>base</strong> (60–70% of the build), an
<strong>accent</strong> (20–30%, usually the frame/trim), and a <strong>detail</strong> (5–10%,
doors, lights, decoration). Pick the jobs first, then audition blocks in the planner — the
materials panel doubles as a palette list.</p>

<h3>Recipes that always work</h3>
<ul>
<li><strong>Classic starter:</strong> oak planks base, cobblestone/stone brick accent, dark oak details.</li>
<li><strong>Alpine cottage:</strong> spruce planks base, stone brick + andesite accent, stripped spruce trim.</li>
<li><strong>Tudor:</strong> white/calcite base, dark oak log framing, deepslate roof.</li>
<li><strong>Desert:</strong> sandstone base, cut/smooth sandstone accent, terracotta details.</li>
<li><strong>Seaside:</strong> white concrete base, cyan/light-blue accents, spruce boardwalks.</li>
<li><strong>Gothic/castle:</strong> stone bricks base with cracked/mossy scatter, deepslate accents, iron details.</li>
<li><strong>End/Purpur:</strong> purpur base, end stone brick accent, amethyst details.</li>
</ul>

<h3>Rules of thumb</h3>
<ul>
<li><strong>Contrast in value, not just hue:</strong> the frame should be clearly lighter or
darker than the wall. Squint at your blueprint — if it goes uniform, add contrast.</li>
<li><strong>Wood + stone almost always works;</strong> two different woods of similar value
usually don't.</li>
<li>Concrete is flat and modern; terracotta is muted and rustic; wool is bright but flammable.
Match the material's "finish" to the build's era.</li>
<li>Test palettes on a small wall in the planner before committing — draw a 5×5 swatch with
your ratio and look at it zoomed out.</li>
</ul>`,
  },

  {
    id: "roofs",
    icon: "🏠",
    title: "Roofs That Don't Look Flat",
    blurb: "Gable, hip, and mansard roofs — and how to draw them in layers.",
    body: `
<p>Roofs are where boxes become buildings, and they're the trickiest thing to read from a 2-D
plan. Here's how each classic roof looks as planner layers.</p>

<h3>Gable (the triangle)</h3>
<p>The Starter House template is a gable roof: each layer, the two long-edge rows of stairs step
<em>inward</em> by one, and the end walls (gables) fill the shrinking gap with planks. On an
odd-depth building the final layer is a single ridge row — cap it with slabs.</p>
<ul>
<li>Depth 7 → 3 roof layers + slab ridge. Depth 9 → 4 + ridge. (Odd depths give clean ridges.)</li>
<li>Overhang: make the first roof layer one block wider than the walls on all sides.</li>
</ul>

<h3>Hip (slopes on all four sides)</h3>
<p>Like a gable, but every layer shrinks by one on <em>all</em> edges — draw a rectangle outline
one block smaller each layer. Rectangular footprints end in a ridge line; square ones end in a
single peak block.</p>

<h3>Mansard (steep sides, flat-ish top)</h3>
<p>Step inward for 2–3 layers like a hip, then stop and fill the top flat with slabs. Loved for
big builds because you keep usable attic space inside.</p>

<h3>Material notes</h3>
<ul>
<li><strong>Stairs</strong> give the classic stepped slope; place them facing the ridge.</li>
<li><strong>Slabs</strong> make gentler half-block slopes — a slab roof rises 1 for every 2
across. Draw slab roofs as wider steps in the planner.</li>
<li>Good roof blocks: dark oak or spruce stairs on light walls, deepslate on white, brick on
cream. The roof usually wants to be the <em>darkest</em> element of the palette.</li>
<li>Never leave a big roof plane unbroken: dormers, chimneys and lightning rods break it up.</li>
</ul>`,
  },

  {
    id: "interiors",
    icon: "💡",
    title: "Interiors & Lighting",
    blurb: "Mob-proof lighting, ceiling heights, and furniture illusions.",
    body: `
<h3>Light or lose it</h3>
<ul>
<li>Since Minecraft 1.18, hostile mobs spawn only at <strong>light level 0</strong> — but one
dark corner is all it takes. Light rooms while you build, not after.</li>
<li>Torch = light 14, lantern = 15, glowstone/sea lantern/shroomlight = 15, campfire = 15,
candles = up to 12. Light drops by 1 per block of distance.</li>
<li>Hide light sources: glowstone in the ceiling behind trapdoors, lanterns under overhangs,
sea lanterns under carpet in the floor — or just embrace visible lanterns; they look great.</li>
</ul>

<h3>Room proportions</h3>
<ul>
<li>Ceilings: 3 blocks minimum, 4–5 for living spaces. A 2-block ceiling with a 2-block player
reads as a tunnel.</li>
<li>Plan interior walls on the blueprint too — rooms of 5×5 to 9×9 furnish well.</li>
<li>Stairwells need a 2-block-wide run to feel right; spiral stairs fit in 3×3.</li>
</ul>

<h3>Furniture illusions (all vanilla)</h3>
<ul>
<li><strong>Table:</strong> fence post + pressure plate, or two stairs back-to-back with a slab bridge.</li>
<li><strong>Chair:</strong> stair + trapdoor armrests, or a slab with signs.</li>
<li><strong>Couch:</strong> a run of stairs with trapdoors on the ends.</li>
<li><strong>Fireplace:</strong> campfire + stone surround + iron bars screen; run the chimney
column up through the roof (see the Cozy Cottage template).</li>
<li><strong>Shelves:</strong> bookshelves inset in the wall, or trapdoors held open.</li>
<li><strong>Kitchen:</strong> smoker (stove), cauldron (sink), barrel (cabinet), item frame + food.</li>
</ul>

<h3>Windows from inside</h3>
<p>Deep sills sell interiors: leave the window inset one block and put a slab "sill" under it.
Interior window frames of a different wood make rooms feel finished.</p>`,
  },

  {
    id: "material_math",
    icon: "📦",
    title: "Material Math & Gathering",
    blurb: "Stacks, shulkers, and how the planner counts special blocks.",
    body: `
<h3>The units</h3>
<ul>
<li><strong>1 stack = 64</strong> blocks (everything in this planner's palette stacks to 64 —
except water and lava buckets, which don't stack at all).</li>
<li><strong>1 shulker box = 27 stacks = 1,728</strong> blocks. A full inventory (36 slots) carries
2,304 loose blocks — or 36 shulker boxes holding 62,208, if you're rich.</li>
<li>The materials panel shows all three: total, stacks + remainder, and shulkers for big counts.</li>
</ul>

<h3>How the planner counts</h3>
<ul>
<li>Every filled cell = 1 item of that block. Air costs nothing.</li>
<li><strong>Doors:</strong> draw only the bottom cell (1 cell = 1 door item). The cell above
stays empty — the game fills it when you place the door.</li>
<li><strong>Slabs:</strong> 1 cell = 1 slab. If you double them up into a full block in-game,
that's 2 slabs — draw 2 cells or remember the difference.</li>
<li><strong>Water/lava:</strong> counted as buckets. Two water sources placed in a 2×2 pool
refill infinitely, so 2 buckets can fill any basin.</li>
<li><strong>Crops:</strong> counted as seeds/items to plant.</li>
</ul>

<h3>Gathering smart</h3>
<ul>
<li>Add <strong>10–15% overage</strong> to every count — creepers, drops in lava, and misplaced
blocks are a tax you will pay.</li>
<li>Stone: a fortune-less iron pick clears ~1 stack in under a minute; smelt cobble → stone in
bulk with 8 furnaces or a super-smelter.</li>
<li>Wood: 1 log = 4 planks. The planner counts <em>planks</em>, so divide by 4 for logs to chop
(a full oak tree yields 4–8 logs).</li>
<li>Concrete needs sand + gravel + dye, then <em>placing powder against water</em> to convert.
Count your dye: 8 powder per dye craft.</li>
<li>Glass: smelt sand 1:1. Panes: 6 glass → 16 panes, so panes are 2.7× cheaper per cell.</li>
</ul>`,
  },
];
