#!/usr/bin/env node
// One-off preview runner. Bypasses the browser Studio + auth cookie
// by importing exportPackFromDrafts directly. Useful for verifying
// a Brain pack builds cleanly from the filesystem draft store.
//
// Usage: node scripts/preview-brain.mjs <slug>

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register tsx loader for TS imports.
register("tsx/esm", pathToFileURL("./"));

const slug = process.argv[2] ?? "staircase";

const mod = await import("../src/lib/nex/brains/_studio/_pack_exporter.ts");
const { exportPackFromDrafts } = mod;

const result = await exportPackFromDrafts(slug, "draft");

if (!result.ok) {
  console.log("Preview FAILED:", result.reason);
  console.log("Detail:", result.detail);
  if (result.missing) console.log("Missing modules:", result.missing);
  if (result.pending) console.log("Pending Admin:", result.pending.length, "candidate(s)");
  process.exit(1);
}

const b = result.loaded;
console.log("Preview OK · Brain '" + slug + "' boots cleanly");
console.log("");
console.log("Manifest:");
console.log("  name:", b.manifest.name);
console.log("  version:", b.manifest.version);
console.log("  status:", b.manifest.status);
console.log("  author:", b.manifest.primary_author_name ?? "(unset)");
console.log("  countries:", b.manifest.supported_countries.join(", "));
console.log("");
console.log("Counts:");
console.log("  craft.facts:      ", b.craft.facts.length);
console.log("  craft.glossary:   ", b.craft.glossary.length);
console.log("  regulations:      ", b.regulations.regulations.length);
console.log("  materials:        ", b.materials.materials.length);
console.log("  workflow.playbooks:", b.workflow.playbooks.length);
console.log("  defects:          ", b.defects.defects.length);
console.log("  pricing.rules:    ", b.pricing_model.rules.length);
console.log("");
if (result.admin_gate_pending && result.admin_gate_pending.length > 0) {
  console.log("Admin gate:", result.admin_gate_pending.length, "candidate(s) still awaiting Admin review");
} else {
  console.log("Admin gate: clean");
}
