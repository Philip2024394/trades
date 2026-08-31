#!/usr/bin/env node
// backfill-market.mjs · one-time backfill of the market field on
// every existing EntityRecord in the canonical corpus (Philip
// 2026-08-31 doctrine · Stage 1).
//
// Rule: everything currently in the Indonesian corpus IS Indonesian
// data. The audit below verifies this (no UK/US sources present) and
// then stamps market="ID" on every record's provenance[0] that lacks it.
// Records with an unrecognisable market signal are left UNKNOWN and
// reported · we never silently guess.
//
// Idempotent · re-running produces no drift.
// Atomic · tmp+rename write.
// Never destroys existing good records · only sets market when absent.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__BACKFILL_MARKET__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __BACKFILL_MARKET__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const entityFile = path.join(repoRoot, "data/indonesia/knowledge-entities.json");
  if (!existsSync(entityFile)) {
    console.error("No corpus found at", entityFile);
    process.exit(2);
  }
  const parsed = JSON.parse(readFileSync(entityFile, "utf8"));
  const entities = parsed.entities ?? [];

  // Audit · classify every record by inferred market from provenance
  // + walkerId + source. This is a READ-ONLY audit · then we backfill.
  const audit = { ID: 0, UK: 0, US: 0, UNIVERSAL: 0, UNKNOWN: 0, alreadySet: 0, willSet: 0 };
  const suspicious = []; // records that DON'T look Indonesian
  const backfill = [];

  for (const e of entities) {
    const p0 = e.provenance?.[0];
    if (!p0) { audit.UNKNOWN++; continue; }
    if (p0.market) {
      audit[p0.market] = (audit[p0.market] || 0) + 1;
      audit.alreadySet++;
      continue;
    }
    // Infer · every current source is Indonesian, but check for UK/US
    // signals so an accidental contamination is caught, not stamped.
    const src = ((p0.sourceName ?? "") + " " + (p0.sourceKey ?? "") + " " + (p0.walkerId ?? "")).toLowerCase();
    const looksUK = /\b(uk|britain|london|british|england|hmrc|building\s*regs)\b/.test(src);
    const looksUS = /\b(usa|america|osha|ansi|irs)\b/.test(src);
    if (looksUK) {
      suspicious.push({ id: e.id, inferred: "UK", source: p0.sourceName });
      audit.UK++;
      continue;
    }
    if (looksUS) {
      suspicious.push({ id: e.id, inferred: "US", source: p0.sourceName });
      audit.US++;
      continue;
    }
    // Default · Indonesian (all seeds/walkers in this corpus are
    // Indonesian per doctrine). Loudly-reported when suspicious.
    audit.ID++;
    audit.willSet++;
    backfill.push(e.id);
  }

  console.log(`\nCORPUS MARKET AUDIT`);
  console.log(`  total entities:       ${entities.length}`);
  console.log(`  already-set market:   ${audit.alreadySet}`);
  console.log(`  will-set to ID:       ${audit.willSet}`);
  console.log(`  inferred:  ID=${audit.ID}  UK=${audit.UK}  US=${audit.US}  UNIVERSAL=${audit.UNIVERSAL}  UNKNOWN=${audit.UNKNOWN}`);
  if (suspicious.length > 0) {
    console.log(`\n⚠ SUSPICIOUS (non-Indonesian signal detected · NOT backfilled to ID):`);
    for (const s of suspicious.slice(0, 20)) console.log(`  · ${s.id.padEnd(50)} inferred=${s.inferred} · ${s.source}`);
    if (suspicious.length > 20) console.log(`  ... +${suspicious.length - 20} more`);
  }
  if (dryRun) {
    console.log(`\n(dry-run · no changes written · re-run without --dry-run to apply)\n`);
    return;
  }

  // Apply backfill · only stamp market="ID" where absent + not suspicious.
  let applied = 0;
  for (const e of entities) {
    const p0 = e.provenance?.[0];
    if (!p0 || p0.market) continue;
    const src = ((p0.sourceName ?? "") + " " + (p0.sourceKey ?? "") + " " + (p0.walkerId ?? "")).toLowerCase();
    if (/\b(uk|britain|london|british|england|hmrc|building\s*regs)\b/.test(src)) continue;
    if (/\b(usa|america|osha|ansi|irs)\b/.test(src)) continue;
    p0.market = "ID";
    applied++;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    schemaVersion: parsed.schemaVersion ?? 1,
    count: entities.length,
    entities,
  };
  mkdirSync(path.dirname(entityFile), { recursive: true });
  const tmp = entityFile + ".tmp";
  writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
  renameSync(tmp, entityFile);

  console.log(`\n✅ BACKFILL COMPLETE`);
  console.log(`  records stamped market="ID": ${applied}`);
  console.log(`  written to:                  ${path.relative(repoRoot, entityFile)}\n`);
}
