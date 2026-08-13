#!/usr/bin/env node
// Verify the new resolveHeroPool returns non-empty pools for every step-unit
// swatch in the manifest. Prints the pool size per swatch and flags empty pools.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MAN = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
const j   = JSON.parse(await readFile(MAN, "utf8"));

// Inline copy of the resolver (JS-only for standalone verification).
const SPECIES_ALIASES = {
  "oak":"oak","light-oak":"oak","mid-oak":"oak","dark-oak":"oak","rustic-knotty-oak":"oak","dark-rustic-oak":"oak",
  "walnut":"walnut","dark-walnut":"walnut","mahogany":"mahogany","maple":"maple","blonde-maple":"maple",
  "white":"painted-white","cream":"painted-cream",
};
const canon = (s) => s ? (SPECIES_ALIASES[String(s).toLowerCase()] ?? String(s).toLowerCase()) : "";
const componentOf = (img, role) => img.material_composition?.find((c) => c.component_role === role);
const treadSpecies = (i) => canon(componentOf(i, "tread")?.sub_material ?? i.sub_material);
const riserFamily  = (i) => {
  const m = componentOf(i, "riser")?.material?.toLowerCase();
  if (m === "metal")   return "metal";
  if (m === "painted") return "painted";
  if (m === "wood")    return "wood";
  if (m === "glass")   return "glass";
  return i.material === "wood" ? "wood" : null;
};
const balusterMat = (i) => componentOf(i, "baluster")?.material?.toLowerCase() ?? "";

// STRICT-EXACT resolver (matches src/lib/refacing/hero-pool-resolver.ts).
function resolve(family, species, images, pattern) {
  const s = canon(species);
  const wholes = images.filter((i) => i.component_role === "whole_staircase");
  if (pattern && /arched/i.test(pattern)) {
    return wholes.filter((i) => {
      const r = componentOf(i, "riser");
      if (r?.pattern !== pattern) return false;
      const inset = canon(r?.inset_species);
      return s ? inset === s : true;
    });
  }
  if (s) {
    return wholes.filter((i) => riserFamily(i) === family && treadSpecies(i) === s);
  }
  return wholes.filter((i) => riserFamily(i) === family);
}

const images_v3 = j.images_v3 || [];
console.log(`Total images_v3 whole_staircase: ${images_v3.filter(i => i.component_role === "whole_staircase").length}`);
console.log();

for (const group of j.step_units || []) {
  console.log(`── ${group.family.toUpperCase()} ──────────────────────────────────`);
  for (const u of group.step_units || []) {
    const pool = resolve(group.family, u.tread_species, images_v3, u.pattern);
    const first = pool[0];
    const mark = pool.length === 0 ? "❌ EMPTY" : pool.length < 3 ? `⚠️  ${pool.length}` : `✅ ${pool.length}`;
    const preview = first ? first.src.replace(/^.*\//, "") : "(swatch fallback)";
    console.log(`  ${mark.padEnd(10)}  ${u.pattern}/${u.tread_species}  →  ${preview}`);
  }
  console.log();
}
