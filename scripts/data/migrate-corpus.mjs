#!/usr/bin/env node
// migrate-corpus.mjs · convert the legacy KnowledgeRecord corpus to
// canonical EntityRecord shape. Writes to
// data/indonesia/knowledge-entities.json alongside the original files
// (never overwrites seed/acquired · both remain readable). The
// retrieval layer can begin consuming entities when we're ready to
// flip the loader.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__MIGRATE_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __MIGRATE_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { listAllRecords } = await import("../../src/lib/nex/indonesia/knowledge.ts");
  const { migrateAll } = await import("../../src/lib/nex/indonesia/data/migration.ts");

  console.log("\nNEX corpus migration · KnowledgeRecord → EntityRecord\n");

  const legacy = listAllRecords();
  console.log(`  Input:  ${legacy.length} legacy KnowledgeRecord entries`);

  const { migrated, skipped } = migrateAll(legacy);
  console.log(`  Output: ${migrated.length} EntityRecord entries · ${skipped.length} skipped\n`);

  // Aggregate insights.
  const byKind = {};
  const byLifecycle = {};
  const byPolicy = {};
  const withGeo = migrated.filter((m) => m.geo && m.geo.province).length;
  const withProvenance = migrated.filter((m) => m.provenance.length > 0).length;
  const quality = { lo: 0, mid: 0, hi: 0 };

  for (const m of migrated) {
    byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
    byLifecycle[m.lifecycle] = (byLifecycle[m.lifecycle] ?? 0) + 1;
    byPolicy[m.freshness.policy] = (byPolicy[m.freshness.policy] ?? 0) + 1;
    const q = m.quality?.overall ?? 0;
    if (q < 0.4) quality.lo++;
    else if (q < 0.7) quality.mid++;
    else quality.hi++;
  }

  console.log("  BY KIND        " + Object.entries(byKind).map(([k, v]) => `${k}:${v}`).join(" · "));
  console.log("  BY LIFECYCLE   " + Object.entries(byLifecycle).map(([k, v]) => `${k}:${v}`).join(" · "));
  console.log("  BY POLICY      " + Object.entries(byPolicy).map(([k, v]) => `${k}:${v}`).join(" · "));
  console.log(`  WITH GEO       ${withGeo}/${migrated.length}`);
  console.log(`  WITH PROVENANCE ${withProvenance}/${migrated.length}`);
  console.log(`  QUALITY        hi(≥0.7):${quality.hi} · mid:${quality.mid} · lo(<0.4):${quality.lo}`);

  if (skipped.length > 0) {
    console.log("\n  SKIPPED:");
    for (const s of skipped) console.log(`    · ${s.id} — ${s.reason}`);
  }

  const outPath = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
  await writeFile(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    count: migrated.length,
    entities: migrated,
  }, null, 2) + "\n");
  console.log(`\n✅ Written ${path.relative(repoRoot, outPath)}`);
}
