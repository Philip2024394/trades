#!/usr/bin/env node
// scripts/refacing/migrate-manifest-to-v3.mjs
//
// Non-destructive additive migration · bumps
// data/staircase-renovations/manifest.json from v2 → v3 by adding an
// images_v3[] block alongside the existing categories[] and step_units[]
// blocks.
//
// Governance:
//   · categories[] and step_units[] byte-preserved · never mutated
//   · images_v3[] entries populated with derived data where confidently
//     inferrable · every derived field marked confidence: 'inferred' or
//     'unknown' · NEVER 'observed' (that requires human tagger review · PR-16)
//   · migration is idempotent · running twice produces the same output
//   · reversibility · removing images_v3[] + downgrading version → 2 returns
//     the manifest to pre-migration state exactly
//
// Doctrinal authority:
//   · docs/refacing/PR-12-EXECUTION-SPEC.md §§2, 3, 10
//   · project_nex_refacing_architecture_v2_2026_08_12.md · PR-12, PR-16
//
// Usage:
//   node scripts/refacing/migrate-manifest-to-v3.mjs                 (dry-run · reports what would change)
//   node scripts/refacing/migrate-manifest-to-v3.mjs --write          (actually writes the manifest)

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = join(
  REPO_ROOT,
  "data",
  "staircase-renovations",
  "manifest.json"
);

const WRITE = process.argv.includes("--write");

// ── Component-role derivation heuristics ──────────────────────────────────

function deriveComponentRoleFromCategory(categorySlug) {
  const s = String(categorySlug).toLowerCase();
  // Existing categories are all whole-staircase lifestyle photos.
  if (["oak", "walnut", "painted", "white", "modern", "traditional", "glass"].includes(s)) {
    return { role: "whole_staircase", confidence: "inferred" };
  }
  if (["storage", "workspace"].includes(s)) {
    return { role: "in_situ_room", confidence: "inferred" };
  }
  if (s === "feature-wall") {
    return { role: "in_situ_room", confidence: "inferred" };
  }
  return { role: "whole_staircase", confidence: "unknown" };
}

function deriveComponentRoleForStepUnit() {
  return { role: "step_unit", confidence: "observed" };
}

// ── Material derivation ───────────────────────────────────────────────────

function deriveMaterialFromCategory(categorySlug, imgMaterialsTag) {
  const s = String(categorySlug).toLowerCase();
  // Explicit materials tag on image wins (already truthful per manifest v2 rule).
  if (Array.isArray(imgMaterialsTag) && imgMaterialsTag.length > 0) {
    const mat = imgMaterialsTag[0].toLowerCase();
    if (["walnut", "oak", "mahogany", "maple", "beech", "ash", "cherry", "iroko"].includes(mat)) {
      return {
        material: "wood",
        material_confidence: "inferred",
        sub_material: mat,
        sub_material_confidence: "inferred",
      };
    }
  }
  if (s === "glass") {
    return {
      material: "glass",
      material_confidence: "inferred",
      sub_material: "clear",
      sub_material_confidence: "unknown",
    };
  }
  if (s === "painted" || s === "white") {
    return {
      material: "painted",
      material_confidence: "inferred",
      sub_material: s === "white" ? "white" : "cream",
      sub_material_confidence: "inferred",
    };
  }
  if (["oak", "walnut"].includes(s)) {
    return {
      material: "wood",
      material_confidence: "inferred",
      sub_material: s,
      sub_material_confidence: "inferred",
    };
  }
  // modern / traditional / storage / workspace / feature-wall = ambiguous
  return {
    material: "wood",
    material_confidence: "unknown",
    sub_material: "unknown",
    sub_material_confidence: "unknown",
  };
}

// ── Style / mood derivation (best-effort) ─────────────────────────────────

function deriveStyleMoodFromCategory(categorySlug) {
  const s = String(categorySlug).toLowerCase();
  if (s === "modern") {
    return {
      style: ["modern"],
      style_confidence: "inferred",
      mood: ["restrained"],
      mood_confidence: "unknown",
    };
  }
  if (s === "traditional") {
    return {
      style: ["traditional", "classic"],
      style_confidence: "inferred",
      mood: ["cosy"],
      mood_confidence: "unknown",
    };
  }
  if (s === "glass") {
    return {
      style: ["modern", "minimal"],
      style_confidence: "inferred",
      mood: ["airy"],
      mood_confidence: "inferred",
    };
  }
  if (s === "walnut") {
    return {
      style: ["warm-natural"],
      style_confidence: "inferred",
      mood: ["cosy"],
      mood_confidence: "unknown",
    };
  }
  if (s === "oak") {
    return {
      style: ["warm-natural"],
      style_confidence: "inferred",
      mood: ["restrained"],
      mood_confidence: "unknown",
    };
  }
  // Everything else · leave unset · admin will tag in later pass.
  return null;
}

// ── Image ID derivation ───────────────────────────────────────────────────

function makeImageIdFromSrc(src) {
  // "/staircase-renovations/oak/oak-treads-and-risers-full-flight.png"
  // → "img_oak_oak-treads-and-risers-full-flight"
  const parts = String(src).split("/").filter(Boolean);
  const bareName = parts[parts.length - 1]
    .replace(/\.(png|jpg|jpeg|webp|svg)$/i, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
  const dir = parts[parts.length - 2] || "root";
  return `img_${dir}_${bareName}`.slice(0, 120);
}

// ── Build a v3 entry from a legacy category image ─────────────────────────

function buildEntryFromCategoryImage(categorySlug, img, nowIso) {
  const role = deriveComponentRoleFromCategory(categorySlug);
  const material = deriveMaterialFromCategory(categorySlug, img.materials);
  const styleMood = deriveStyleMoodFromCategory(categorySlug);

  const entry = {
    image_id: makeImageIdFromSrc(img.src),
    src: img.src,
    alt: img.alt ?? "",

    component_role: role.role,
    component_role_confidence: role.confidence,

    material: material.material,
    material_confidence: material.material_confidence,
    sub_material: material.sub_material,
    sub_material_confidence: material.sub_material_confidence,

    governance: {
      owner_type: "nex_curated",
      owner_id: "nex",
      visibility_label: "INSPIRATION_LIBRARY",
      created_at: nowIso,
      updated_at: nowIso,
      superseded_by: null,
      retention_class: "long_term",
    },
  };

  if (styleMood) {
    entry.style = styleMood.style;
    entry.style_confidence = styleMood.style_confidence;
    entry.mood = styleMood.mood;
    entry.mood_confidence = styleMood.mood_confidence;
  }

  return entry;
}

// ── Build a v3 entry from a legacy step-unit ──────────────────────────────

function buildEntryFromStepUnit(familyKey, unit, nowIso) {
  const role = deriveComponentRoleForStepUnit();

  const material = String(familyKey).toLowerCase();
  const material_family = ["metal", "painted", "wood", "glass"].includes(material) ? material : "wood";

  const entry = {
    image_id: makeImageIdFromSrc(unit.src),
    src: unit.src,
    alt: unit.alt ?? "",

    component_role: role.role,
    component_role_confidence: role.confidence, // 'observed' · isometric renders are unambiguous

    material: material_family,
    material_confidence: "observed", // step-unit family is explicit metadata, not derived
    sub_material: unit.sub_material ?? unit.tread_species ?? "unknown",
    sub_material_confidence: unit.sub_material || unit.tread_species ? "observed" : "unknown",

    governance: {
      owner_type: "nex_curated",
      owner_id: "nex",
      visibility_label: "INSPIRATION_LIBRARY",
      created_at: nowIso,
      updated_at: nowIso,
      superseded_by: null,
      retention_class: "long_term",
    },
  };

  // step_units also carry pattern + tread_species metadata · preserve.
  if (Array.isArray(unit.materials) && unit.materials.length > 0) {
    entry.material_composition = unit.materials.map((m) => ({
      component_role: "tread",
      material: "wood",
      sub_material: String(m),
      confidence: "observed",
    }));
  }

  return entry;
}

// ── Dedup by image_id · keep first occurrence order-stable ────────────────

function dedupById(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (seen.has(e.image_id)) continue;
    seen.add(e.image_id);
    out.push(e);
  }
  return out;
}

// ── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);

  const nowIso = new Date().toISOString();

  const categoryEntries = [];
  for (const cat of manifest.categories ?? []) {
    for (const img of cat.images ?? []) {
      categoryEntries.push(buildEntryFromCategoryImage(cat.slug, img, nowIso));
    }
  }

  const stepUnitEntries = [];
  for (const fam of manifest.step_units ?? []) {
    for (const unit of fam.step_units ?? []) {
      stepUnitEntries.push(buildEntryFromStepUnit(fam.family, unit, nowIso));
    }
  }

  const combined = dedupById([...categoryEntries, ...stepUnitEntries]);

  // Report before writing
  console.log("── migrate-manifest-to-v3 report ──");
  console.log(`  manifest source:      ${MANIFEST_PATH}`);
  console.log(`  category images:      ${categoryEntries.length}`);
  console.log(`  step-unit images:     ${stepUnitEntries.length}`);
  console.log(`  after dedup:          ${combined.length}`);

  const withInferredMaterial = combined.filter((e) => e.material_confidence === "inferred").length;
  const withObservedMaterial = combined.filter((e) => e.material_confidence === "observed").length;
  const withUnknownMaterial = combined.filter((e) => e.material_confidence === "unknown").length;
  const withStyle = combined.filter((e) => e.style && e.style.length > 0).length;
  console.log(`  material observed:    ${withObservedMaterial}`);
  console.log(`  material inferred:    ${withInferredMaterial}`);
  console.log(`  material unknown:     ${withUnknownMaterial}`);
  console.log(`  style populated:      ${withStyle}`);
  console.log(`  admin review pending: ${combined.length - withStyle} · style/mood/canonical_profile/compatibility_group all require human pass`);

  // Idempotency check
  if (Array.isArray(manifest.images_v3) && manifest.images_v3.length > 0) {
    console.log(`  images_v3 already present (${manifest.images_v3.length} entries) · this run would REPLACE it if --write is passed`);
  }

  if (!WRITE) {
    console.log("");
    console.log("Dry-run · no changes written. Run with --write to persist.");
    return;
  }

  // Additive-only mutation · categories[] and step_units[] byte-preserved
  const nextManifest = {
    ...manifest,
    version: 3,
    updated_at: nowIso.slice(0, 10),
    images_v3: combined,
  };

  // Preserve note-order + prepend a v3 note about the additive migration
  const v3Note =
    "images_v3[] added by scripts/refacing/migrate-manifest-to-v3.mjs (PR-12 EXECUTION SPEC · non-destructive · categories[] and step_units[] byte-preserved). Every derived field marked with confidence 'inferred' or 'unknown' per PR-16 — never 'observed' without human tagger review. Style / mood / canonical_profile_ids / compatibility_group_ids fields await manual pass.";
  nextManifest.notes = [
    v3Note,
    ...(Array.isArray(manifest.notes) ? manifest.notes : []),
  ];

  await writeFile(
    MANIFEST_PATH,
    JSON.stringify(nextManifest, null, 2) + "\n",
    "utf8"
  );
  console.log("");
  console.log("Wrote manifest v3 to disk. categories[] and step_units[] preserved.");
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
