#!/usr/bin/env node
// Gap report — which step-unit swatches lack a Layer 1 EXACT hero (riser + tread species match)?
// Prints regeneration briefs Philip can use to generate the missing NEX Trade Center hero images.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAN = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
const j   = JSON.parse(await readFile(MAN, "utf8"));

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

const images = (j.images_v3 || []).filter((i) => i.component_role === "whole_staircase");
const total = images.length;

const CANONICAL_SPECIES = ["oak","walnut","mahogany","maple"];
const FAMILIES = ["metal","painted","wood","glass"];

// Build the current exact-match matrix.
const matrix = {}; // family → species → list of matching src
for (const f of FAMILIES) {
  matrix[f] = {};
  for (const s of CANONICAL_SPECIES) matrix[f][s] = [];
}
for (const img of images) {
  const f = riserFamily(img);
  const s = treadSpecies(img);
  if (!f || !CANONICAL_SPECIES.includes(s)) continue;
  matrix[f][s].push(img.src);
}

// Ideal counts per (family, pattern, species) for a healthy library.
const IDEAL_MIN = 3;

// Arched-inset patterns require special hero photos with the pattern visible in the riser.
// None of the current 79 heroes have arched risers · so pattern is part of the gap key.
function isArched(pattern) { return /arched/i.test(pattern || ""); }

const rows = [];
for (const group of j.step_units || []) {
  const family = group.family;
  if (family === "glass") continue; // family intentionally empty per doctrine
  for (const u of group.step_units || []) {
    const species = canon(u.tread_species);
    if (!CANONICAL_SPECIES.includes(species)) continue;
    const arched = isArched(u.pattern);
    // For arched patterns, no library images qualify. For flat/monolithic/metal-plate,
    // use the family×species matrix.
    const have = arched ? [] : (matrix[family]?.[species] ?? []);
    const gap  = Math.max(0, IDEAL_MIN - have.length);
    rows.push({
      family, pattern: u.pattern, species,
      swatch_src: u.src,
      have: have.length,
      gap,
      matches: have,
      arched,
    });
  }
}

// Group rows by unique (family, pattern, species).
const seenKey = new Set();
const uniqueGaps = [];
for (const r of rows) {
  const k = `${r.family}::${r.pattern}::${r.species}`;
  if (seenKey.has(k)) continue;
  seenKey.add(k);
  uniqueGaps.push(r);
}

// Build the report.
const OUT = join(process.cwd(), "data", "staircase-renovations", "intake", "gaps-report.md");

const patternSpec = {
  "flat":                  (fam) => fam === "painted" ? "flat cream-painted riser · smooth surface" : `solid wood riser · flat · matching tread species`,
  "metal-plate":           () => "brushed stainless steel riser plate (1mm) · flat metal surface",
  "monolithic":            () => "solid wood riser matching tread species · single-species monolithic finish · flat",
  "arched-wood-inset":     () => "cream-painted riser FRAME with a decorative ARCHED WOOD panel inset in the centre of each riser (Victorian-style moulding) · wood panel matches the tread species",
  "arched-painted-inset":  () => "solid wood riser FRAME (matching tread species) with a decorative ARCHED PAINTED panel inset in the centre of each riser · painted panel is cream/white",
};
const speciesSpec = {
  oak:      "solid European oak tread · warm honey tone · straight grain · satin finish",
  walnut:   "solid American walnut tread · dark chocolate brown · straight grain · satin finish",
  mahogany: "solid mahogany tread · rich reddish-brown · fine grain · satin finish",
  maple:    "solid hard maple tread · blonde/pale golden · very tight grain · satin finish",
};
const balustradeDefault = "white-painted turned traditional balusters · white newel with ball-top · white handrail · white string on both sides · white baserail";

let md = `# NEX Refacing · Hero Library Gap Report

**Generated:** ${new Date().toISOString().slice(0,10)}
**Total whole_staircase images:** ${total}
**Ideal minimum per (family × species):** ${IDEAL_MIN}

This report shows every step-unit swatch that lacks **Layer 1 EXACT matches**
(hero photos where the riser material AND tread species BOTH match the swatch).
When a swatch has fewer than ${IDEAL_MIN} exact heroes, the customer either sees
the same photo repeatedly or falls back to a species-only match with a
non-matching riser.

## Current coverage matrix

| Family \\ Species | oak | walnut | mahogany | maple |
|---|---|---|---|---|
`;
for (const f of ["metal","painted","wood"]) {
  md += `| **${f}** |`;
  for (const s of CANONICAL_SPECIES) {
    const n = matrix[f][s].length;
    const cell = n === 0 ? `❌ 0` : n < IDEAL_MIN ? `⚠️ ${n}` : `✅ ${n}`;
    md += ` ${cell} |`;
  }
  md += "\n";
}

md += `\n_(glass family intentionally empty per evidence-or-silence doctrine · no gap)_\n\n`;

// Sort gap rows worst-first.
const worst = uniqueGaps.filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap);

md += `## Gaps to fill (${worst.length} unique family × species combos need work)\n\n`;
md += `Every image must use the **NEX Trade Center scenario**: same female talent (dark cap, NEX polo, chino trousers, work boots, black glove/prosthetic on right arm) · same pose (standing at base of stairs, right hand resting on newel) · same NEX Trade Center backdrop (grey NEX TRADE CENTER wall sign · glass display cabinets · dark wood floor · window above) · same portrait aspect ratio · same eye-level camera looking up the flight · straight-flight geometry going up-right · bullnose starting step (rounded left edge).\n\n`;

let n = 1;
for (const r of worst) {
  md += `### ${n}. ${r.family.toUpperCase()} · ${r.pattern.toUpperCase()} · ${r.species.toUpperCase()} tread\n`;
  md += `**Currently have:** ${r.have} exact match${r.have === 1 ? "" : "es"}. **Need:** ${r.gap} more (target ${IDEAL_MIN}).\n\n`;
  if (r.arched) {
    md += `> ⚠️ **Distinctive pattern required** — the riser must show a visible ARCHED PANEL INSET · plain flat risers do not qualify · library currently has zero images with this pattern.\n\n`;
  }
  if (r.matches.length > 0) {
    md += `**Existing reference:** \`${r.matches[0]}\`\n\n`;
  }
  const riserSpec = (patternSpec[r.pattern] || (() => "solid painted riser"))(r.family);
  md += `**Riser spec:** ${riserSpec}\n\n`;
  md += `**Tread spec:** ${speciesSpec[r.species]}\n\n`;
  md += `**Balustrade default:** ${balustradeDefault}\n\n`;
  md += `**Recommended variants to generate (${r.gap}):**\n`;
  const variants = [
    "turned white balusters + white ball-topped newel + wood handrail matching tread species",
    "square white spindles + square white newel + white handrail (contemporary variant)",
    "wrought iron balusters (black) + wood newel matching tread + wood handrail matching tread",
  ];
  for (let i = 0; i < r.gap; i++) {
    md += `- Variant ${i + 1}: ${variants[i] ?? variants[i % variants.length]}\n`;
  }
  md += `\n`;
  n++;
}

md += `## Regeneration prompt template\n\n`;
md += "```\n";
md += `NEX Trade Center whole-staircase photograph.
Talent: same female presenter — dark NEX cap, black NEX polo shirt, chino cargo trousers, brown work boots, black prosthetic right arm, standing at the base of the stairs with right hand resting lightly on the newel post.
Backdrop: NEX Trade Center — grey wall with NEX TRADE CENTER lettering upper left, glass display cabinets with amber bottles behind, dark polished wood floor, small window upper right, warm interior lighting.
Camera: eye-level portrait aspect · looking up-right at the staircase from the base.
Staircase geometry: straight flight going up and to the right · 12-14 visible risers · bullnose starting step (rounded left edge).
Staircase components:
  - Tread: [TREAD SPEC HERE]
  - Riser: [RISER SPEC HERE]
  - Balustrade: [BALUSTRADE SPEC HERE]
  - Newel post: [NEWEL SPEC HERE]
  - Handrail: [HANDRAIL SPEC HERE]
  - String (both sides): white painted closed string
  - Baserail: white painted matching string
Style: photorealistic architectural photograph · natural interior lighting · sharp focus throughout · no motion blur · no depth-of-field blur on the staircase.
Aspect: portrait 3:5.
`;
md += "```\n";

await writeFile(OUT, md, "utf8");
console.log(`gap report written to ${OUT}`);
console.log(`unique family×species gaps: ${worst.length}`);
console.log(`total gap slots to fill (target ${IDEAL_MIN} per combo): ${worst.reduce((a,r) => a+r.gap, 0)}`);
