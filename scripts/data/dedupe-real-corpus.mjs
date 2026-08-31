#!/usr/bin/env node
// dedupe-real-corpus.mjs · runs blocking dedupe against the migrated
// corpus. Non-destructive · reports what WOULD be merged/reviewed.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__DEDUP_REAL_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __DEDUP_REAL_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { analyseCorpus } = await import("../../src/lib/nex/indonesia/data/dedupe-blocking.ts");

  const entitiesFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
  let entities;
  try {
    const payload = JSON.parse(readFileSync(entitiesFile, "utf8"));
    entities = payload.entities ?? [];
  } catch (e) {
    console.error(`Cannot read ${entitiesFile}. Run \`npm run data:migrate\` first.`);
    process.exit(1);
  }

  console.log(`\nDedupe against real migrated corpus: ${entities.length} entities`);
  const report = analyseCorpus(entities);
  console.log(`  candidate pairs:   ${report.candidatePairs}`);
  console.log(`  strong merges:     ${report.strongMerges.length}`);
  console.log(`  review candidates: ${report.reviewCandidates.length}`);
  console.log(`  wall time:         ${report.wallMs}ms`);

  if (report.strongMerges.length > 0) {
    console.log(`\nSTRONG MERGES (would collapse into a canonical entity):`);
    for (const m of report.strongMerges.slice(0, 20)) {
      console.log(`  · ${m.a.id.padEnd(40)} + ${m.b.id.padEnd(40)} · score=${m.score.toFixed(2)} · via=${m.blockerName} · ${m.reasons.slice(0, 3).join(", ")}`);
    }
    if (report.strongMerges.length > 20) console.log(`  ... +${report.strongMerges.length - 20} more`);
  }
  if (report.reviewCandidates.length > 0) {
    console.log(`\nREVIEW CANDIDATES (human should decide):`);
    for (const m of report.reviewCandidates.slice(0, 20)) {
      console.log(`  · ${m.a.id.padEnd(40)} + ${m.b.id.padEnd(40)} · score=${m.score.toFixed(2)} · via=${m.blockerName} · ${m.reasons.slice(0, 3).join(", ")}`);
    }
    if (report.reviewCandidates.length > 20) console.log(`  ... +${report.reviewCandidates.length - 20} more`);
  }
  if (report.strongMerges.length === 0 && report.reviewCandidates.length === 0) {
    console.log(`\n(Corpus is clean · no duplicates found by the current blocker set.)`);
  }
}
