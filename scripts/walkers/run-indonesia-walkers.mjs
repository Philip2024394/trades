#!/usr/bin/env node
// run-indonesia-walkers.mjs
//
// Runs every registered Indonesia walker, funnels the output through
// the pipeline, and publishes the enriched corpus to
// data/indonesia/knowledge-acquired.json.
//
// This file is the OPERATOR ENTRY POINT for the acquisition machine.
// `npm run walkers:indonesia` calls it. In production a scheduler
// (cron / worker) would call it on the refresh cadence declared by
// each walker.
//
// Never mutates the hand-curated `knowledge-seed.json` — that stays
// as an authored ground-truth. The retrieval layer merges both files
// (see knowledge.ts loadCorpus).

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

// System A isolation gate · substitute NEX_TAXONOMY_POSTGRES_URL into
// NEX_POSTGRES_URL so the child tsx process never receives the production
// NEX URL. Fails loud if NEX_TAXONOMY_POSTGRES_URL is unset.
if (existsSync(path.join(repoRoot, ".env.local"))) {
  for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const TAX_URL = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!TAX_URL || TAX_URL.trim().length === 0) {
  console.error(
    "[indonesia-walkers] FAIL-CLOSED · NEX_TAXONOMY_POSTGRES_URL is not set · " +
    "System A refuses to run against the production NEX database.",
  );
  process.exit(2);
}
const SYSTEM_A_ENV = { ...process.env, NEX_POSTGRES_URL: TAX_URL };

if (!process.env.__WALKERS_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...SYSTEM_A_ENV, __WALKERS_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { createCuratedSourceWalker } = await import("../../src/lib/nex/indonesia/walkers/source-curated.ts");
  const { loadConfigWalkers } = await import("../../src/lib/nex/indonesia/walkers/config-walker.ts");
  const { runWalkerFleet } = await import("../../src/lib/nex/indonesia/walkers/pipeline.ts");

  const walkers = [
    // Original curated:seed walker (destinations, hospitals, dishes,
    // airports · pre-taxonomy-registry).
    createCuratedSourceWalker(),
    // All config-defined specialist walkers · each config in
    // data/indonesia/walker-configs/ automatically becomes a walker.
    ...loadConfigWalkers(),
  ];

  console.log(`\nNEX INDONESIA WALKERS · running ${walkers.length} walker(s)\n`);
  for (const w of walkers) console.log(`  · ${w.id.padEnd(24)} [${w.domain}] · ${w.description}`);

  const { records, reports } = await runWalkerFleet(walkers, {
    minContentChars: 40,
    minKeywords: 2,
    minConfidence: 0.6,
  });

  console.log("\nPIPELINE REPORTS");
  console.log("┌──────────────────────────┬───────┬─────────┬──────────┬─────────┬──────────┐");
  console.log("│ Walker                   │ In    │ Publish │ Rejected │ Deduped │ QA vars  │");
  console.log("├──────────────────────────┼───────┼─────────┼──────────┼─────────┼──────────┤");
  for (const r of reports) {
    console.log(`│ ${r.walkerId.padEnd(24)} │ ${String(r.in).padStart(5)} │ ${String(r.published).padStart(7)} │ ${String(r.rejected.length).padStart(8)} │ ${String(r.deduped.length).padStart(7)} │ ${String(r.qaVariantsTotal).padStart(8)} │`);
  }
  console.log("└──────────────────────────┴───────┴─────────┴──────────┴─────────┴──────────┘");

  for (const r of reports) {
    if (r.rejected.length > 0) {
      console.log(`\n[${r.walkerId}] REJECTED:`);
      for (const rj of r.rejected) console.log(`  · ${rj.externalId}: ${rj.reason}`);
    }
    if (r.deduped.length > 0) {
      console.log(`\n[${r.walkerId}] DEDUPED:`);
      for (const dd of r.deduped) console.log(`  · ${dd.externalId} → merged into ${dd.mergedInto}`);
    }
  }

  const outPath = path.join(repoRoot, "data/indonesia/knowledge-acquired.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    walkers: reports.map((r) => ({ id: r.walkerId, published: r.published })),
    records,
  };
  await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`\n✅ Published ${records.length} records → ${path.relative(repoRoot, outPath)}`);

  // Summary of stability distribution & regions.
  const stab = records.reduce((acc, r) => ((acc[r.stability] = (acc[r.stability] ?? 0) + 1), acc), {});
  const regions = new Set(records.map((r) => r.region));
  console.log(`   Stability: ${JSON.stringify(stab)}`);
  console.log(`   Regions covered: ${regions.size}`);
  console.log(`   QA variants total: ${reports.reduce((a, r) => a + r.qaVariantsTotal, 0)}`);
}
