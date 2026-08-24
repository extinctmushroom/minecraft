/* Validates blocks.js + templates.js data integrity (run: node tools/validate.mjs) */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src =
  readFileSync(join(root, "js/blocks.js"), "utf8") +
  "\n" +
  readFileSync(join(root, "js/templates.js"), "utf8") +
  "\n" +
  readFileSync(join(root, "js/templates_large.js"), "utf8") +
  "\nreturn { BLOCKS, BLOCK_BY_ID, TEMPLATES, BLOCK_CATEGORIES };";
const { BLOCKS, BLOCK_BY_ID, TEMPLATES, BLOCK_CATEGORIES } = new Function(src)();

let errors = 0;
const err = (msg) => { errors++; console.error("ERROR:", msg); };

// --- blocks ---
const seen = new Set();
for (const b of BLOCKS) {
  if (seen.has(b.id)) err(`duplicate block id ${b.id}`);
  seen.add(b.id);
  if (!/^#[0-9a-f]{6}$/i.test(b.color)) err(`bad color for ${b.id}: ${b.color}`);
  if (!BLOCK_CATEGORIES.includes(b.cat)) err(`unknown category for ${b.id}: ${b.cat}`);
}
console.log(`blocks: ${BLOCKS.length} ok (${errors} errors so far)`);

// --- templates ---
for (const t of TEMPLATES) {
  const { width: W, depth: D, height: H } = t;
  if (H < 1) err(`${t.id}: no layers`);
  t.layers.forEach((layer, y) => {
    if (layer.length !== D) err(`${t.id} layer ${y}: ${layer.length} rows, want ${D}`);
    layer.forEach((row, z) => {
      if (row.length !== W) err(`${t.id} layer ${y} row ${z}: ${row.length} chars, want ${W} ("${row}")`);
      for (const ch of row) {
        if (ch === ".") continue;
        const id = t.legend[ch];
        if (!id) err(`${t.id} layer ${y} row ${z}: char '${ch}' missing from legend`);
        else if (!BLOCK_BY_ID[id]) err(`${t.id}: legend '${ch}' → unknown block id '${id}'`);
      }
    });
  });
  for (const [ch, id] of Object.entries(t.legend)) {
    const used = t.layers.some((L) => L.some((r) => r.includes(ch)));
    if (!used) console.warn(`warn: ${t.id}: legend '${ch}' (${id}) is never used`);
  }
  console.log(`template ${t.id}: ${t.size} ok`);
}

if (errors) { console.error(`\n${errors} error(s)`); process.exit(1); }
console.log("\nAll data valid.");
