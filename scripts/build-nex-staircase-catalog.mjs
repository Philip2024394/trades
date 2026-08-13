#!/usr/bin/env node
// build-nex-staircase-catalog.mjs
//
// Scans data/nex-staircase-components/variants/shell_*.yaml and emits
// src/lib/nex/staircase-components/catalog.generated.ts with the
// discovered SHELL_CATALOG constant.
//
// Master AI Engineer refactor 2026-08-05 (Philip): replaces the pre-2026-08-05
// hardcoded `Array.from({length: 15}, ...)` in catalog.ts. Adding a new
// shell YAML (16, 17, quarter_landing_01, etc.) just requires re-running
// this script — nothing in catalog.ts needs editing.
//
// Filename convention:  shell_{family_snake}_{NN}.yaml
//                        where NN is the tread count (2-digit, zero-padded).
//
// Run:  node scripts/build-nex-staircase-catalog.mjs
// Runs automatically after every meaningful staircase authoring session.

import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const VARIANTS_DIR = join(REPO_ROOT, "data", "nex-staircase-components", "variants");
const OUT_PATH = join(REPO_ROOT, "src", "lib", "nex", "staircase-components", "catalog.generated.ts");

// Family display labels. Small human-authored config — extend when a new
// structural family (quarter_landing, half_landing_u_shaped, ...) arrives.
// The Phase A roadmap in types.ts / STRUCTURAL_FAMILY_ROADMAP names them.
const FAMILY_LABELS = {
  straight_closed: {
    family_id: "SHELL_STRAIGHT_CLOSED",
    family_name: "Straight, Closed-String Both Sides",
    layout_label: "Straight flight",
    construction_label: "Closed string (both sides)",
  },
  // quarter_landing: { ... }   ← Phase A next
  // half_landing_u_shaped: { ... }
  // winder: { ... }
  // kite_winder: { ... }
  // open_string: { ... }
};

// Regex parses shell_{family_snake}_{NN}.yaml. Family snake can contain
// underscores (straight_closed · quarter_landing · half_landing_u_shaped).
// The final `_NN.yaml` pattern is the anchor.
const FILENAME_RE = /^shell_([a-z][a-z0-9_]*?)_(\d{2})\.yaml$/;

function discoverShellVariants() {
  if (!existsSync(VARIANTS_DIR)) {
    throw new Error(`Missing variants directory: ${VARIANTS_DIR}`);
  }
  const files = readdirSync(VARIANTS_DIR);
  const byFamily = new Map();

  for (const file of files) {
    const match = FILENAME_RE.exec(file);
    if (!match) continue;
    const [, familySnake, ttStr] = match;
    const treads = Number.parseInt(ttStr, 10);
    if (!Number.isInteger(treads) || treads < 1) {
      throw new Error(`Invalid tread count parsed from ${file}: ${ttStr}`);
    }

    if (!byFamily.has(familySnake)) byFamily.set(familySnake, []);
    byFamily.get(familySnake).push({
      component_id: `SHELL_${familySnake.toUpperCase()}_${ttStr}`,
      treads,
      risers: treads + 1,
      review_status: "locked",
    });
  }

  for (const [, variants] of byFamily) {
    variants.sort((a, b) => a.treads - b.treads);
  }
  return byFamily;
}

function buildCatalog(byFamily) {
  const catalog = [];
  const seenFamilies = new Set(byFamily.keys());

  for (const [familySnake, labels] of Object.entries(FAMILY_LABELS)) {
    const variants = byFamily.get(familySnake);
    if (!variants || variants.length === 0) {
      throw new Error(
        `FAMILY_LABELS declares "${familySnake}" but no shell_${familySnake}_NN.yaml files found. ` +
          `Either author variants or remove the FAMILY_LABELS entry.`,
      );
    }
    seenFamilies.delete(familySnake);
    catalog.push({ ...labels, variants });
  }

  if (seenFamilies.size > 0) {
    const list = [...seenFamilies].join(", ");
    console.warn(
      `warn: ${list} have shell YAMLs but no FAMILY_LABELS entry — hidden from SHELL_CATALOG. ` +
        `Add a FAMILY_LABELS entry in scripts/build-nex-staircase-catalog.mjs to surface them.`,
    );
  }
  return catalog;
}

function emit(catalog) {
  const header = `// AUTO-GENERATED · do not edit by hand.
// Regenerate with: node scripts/build-nex-staircase-catalog.mjs
// Source: data/nex-staircase-components/variants/shell_*.yaml
// Family labels: scripts/build-nex-staircase-catalog.mjs FAMILY_LABELS
//
// Master AI Engineer refactor 2026-08-05 (Philip): the SHELL_CATALOG
// constant is derived from filesystem discovery so adding shell 16-17-18
// or a new structural family (quarter_landing, etc.) requires only a
// re-run of the build script — no edits to catalog.ts.

import type { ShellCatalogFamily } from "./catalog";

export const GENERATED_SHELL_CATALOG: readonly ShellCatalogFamily[] = ${JSON.stringify(
    catalog,
    null,
    2,
  )} as const;

export const GENERATED_AT = ${JSON.stringify(new Date().toISOString())};
`;

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, header, "utf8");
  console.log(`wrote ${OUT_PATH}`);
  const total = catalog.reduce((s, f) => s + f.variants.length, 0);
  console.log(`  ${catalog.length} families · ${total} variants total`);
  for (const f of catalog) {
    console.log(`  ${f.family_id} · ${f.variants.length} variants (treads ${f.variants[0].treads}-${f.variants[f.variants.length - 1].treads})`);
  }
}

const byFamily = discoverShellVariants();
const catalog = buildCatalog(byFamily);
emit(catalog);
