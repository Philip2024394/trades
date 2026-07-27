#!/usr/bin/env node
// build.mjs — merges every knowledge/<category>.json into a single
// knowledge_master.json for downstream ingest (substrate loader,
// Supabase upload, SEO page generation, etc).
//
// Fails fast if validate.mjs errors — never builds bad data.
//
// Output shape:
//   {
//     "generated_at": "2026-07-25T…",
//     "categories": ["cement", "sand", …],
//     "total_count": 899,
//     "categories_manifest": {
//       "cement": { "count": 150, "checksum": "…" },
//       …
//     },
//     "entries": [ …flattened, sorted by id… ]
//   }

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { loadAllCategories, MASTER_FILE, checksum, fmtBytes } from "./_lib.mjs";

const args = process.argv.slice(2);
const skipValidate = args.includes("--skip-validate");

// Gate: refuse to build if validation fails, unless explicitly skipped
if (!skipValidate) {
  console.log("→ Validating first…");
  const r = spawnSync(process.execPath, ["scripts/knowledge/validate.mjs"], {
    stdio: "inherit"
  });
  if (r.status !== 0) {
    console.error("❌ Validation failed — refusing to build. Pass --skip-validate to override.");
    process.exit(1);
  }
  console.log("");
}

const cats = loadAllCategories();
if (cats.length === 0) {
  console.log("⚠️  No knowledge files in knowledge/ — nothing to build.");
  process.exit(0);
}

// Flatten
const allEntries = [];
const manifest = {};

for (const { category, doc } of cats) {
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  const serialised = JSON.stringify(entries);
  manifest[category] = {
    count:    entries.length,
    checksum: checksum(serialised)
  };
  for (const e of entries) allEntries.push(e);
}

// Sort by id for deterministic output
allEntries.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));

const master = {
  kind:                "brain_faqs_master",
  generated_at:        new Date().toISOString(),
  categories:          cats.map((c) => c.category).sort(),
  total_count:         allEntries.length,
  categories_manifest: manifest,
  entries:             allEntries
};

fs.writeFileSync(MASTER_FILE, JSON.stringify(master, null, 2) + "\n", "utf8");

const size = fs.statSync(MASTER_FILE).size;
console.log(`\n═══ master built ═══`);
console.log(`  file:       knowledge_master.json (${fmtBytes(size)})`);
console.log(`  categories: ${master.categories.length}`);
console.log(`  entries:    ${master.total_count}`);
console.log(`\n  per-category:`);
for (const [cat, m] of Object.entries(manifest).sort()) {
  console.log(`    ${cat.padEnd(20)} ${String(m.count).padStart(5)} entries · ${m.checksum}`);
}
console.log("\n✅ Done.");

// Refresh Brain Health metrics so the admin dashboard stays in sync
console.log("");
const health = spawnSync(process.execPath, ["scripts/knowledge/health.mjs", "--quiet"], {
  stdio: "inherit"
});
if (health.status !== 0) console.log("⚠️  Health metrics refresh failed (build still succeeded)");
else console.log("✅ knowledge_health.json refreshed");
