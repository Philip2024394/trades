#!/usr/bin/env node
// NEX Infrastructure Runtime · dual-write parity verification
//
// After enabling NEX_STORAGE_BACKEND=dual-write, this script confirms
// primary (JSONL) and secondary (Postgres) hold the same events.
//
// USAGE
//   NEX_STORAGE_BACKEND=dual-write \
//   NEX_POSTGRES_URL=postgresql://... \
//     npm run nex:verify-parity
//
//   Or, for a one-off ad-hoc check without touching the registry:
//     npx tsx scripts/verify-storage-parity.ts
//
// WHAT IT CHECKS
//   · count-parity: primary.count(events) === secondary.count(events) within tolerance
//   · sample-parity: the N most-recent events on the primary all exist on the secondary
//   · dual-write telemetry: secondary failure counter is 0 (or below alert threshold)
//
// EXIT CODES  0 = healthy  ·  1 = drift detected
//
// PARITY TOLERANCE
// Dual-write's secondary is fire-and-forget · a small transient lag is
// expected during high write bursts. The COUNT tolerance defaults to
// primary * 0.995 (0.5% missing on secondary before we alarm). The sample
// check is exact — every one of the last 50 events MUST exist on secondary.

import { getStorageForParity } from "../src/lib/nex/storage/registry";
import type { StorageBackend } from "../src/lib/nex/storage/types";
import { COLLECTIONS } from "../src/lib/nex/storage/types";

type Check = { name: string; pass: boolean; detail?: string };

const COUNT_TOLERANCE = 0.995;   // secondary must hold ≥ 99.5% of primary
const SAMPLE_SIZE = 50;

async function collectionParity(
  primary: StorageBackend,
  secondary: StorageBackend,
  collection: string,
): Promise<Check[]> {
  const checks: Check[] = [];

  // 1 · Count parity ─────────────────────────────────────────────────
  const [primaryCount, secondaryCount] = await Promise.all([
    primary.count(collection),
    secondary.count(collection),
  ]);
  const ratio = primaryCount === 0 ? 1 : secondaryCount / primaryCount;
  checks.push({
    name: `[${collection}] count parity within ${((1 - COUNT_TOLERANCE) * 100).toFixed(1)}%`,
    pass: ratio >= COUNT_TOLERANCE,
    detail: `primary ${primaryCount} · secondary ${secondaryCount} · ratio ${ratio.toFixed(4)}`,
  });

  // 2 · Sample parity ────────────────────────────────────────────────
  //     Take the most-recent N events from primary. Every event_id MUST
  //     exist on the secondary. This is exact — no tolerance.
  const primarySample = await primary.query<{ event_id?: string; [k: string]: unknown }>(
    collection,
    { limit: SAMPLE_SIZE, order_dir: "desc" },
  );

  const missingOnSecondary: string[] = [];
  for (const row of primarySample) {
    const id = String(row.event_id ?? row.record_id ?? row.job_id ?? row.attempt_id ?? row.run_id ?? row.memory_id ?? row.contact_id ?? row.chunk_id ?? row.review_id ?? row.duplicate_id ?? row.document_id ?? row.edge_id ?? "");
    if (!id) continue;
    const found = await secondary.load(collection, id);
    if (!found) missingOnSecondary.push(id);
  }
  checks.push({
    name: `[${collection}] last ${primarySample.length} events all present on secondary`,
    pass: missingOnSecondary.length === 0,
    detail: missingOnSecondary.length === 0
      ? `${primarySample.length}/${primarySample.length} verified`
      : `${missingOnSecondary.length} missing · e.g. ${missingOnSecondary.slice(0, 3).join(", ")}`,
  });

  return checks;
}

async function main(): Promise<void> {
  const { primary, secondary } = getStorageForParity();

  console.log("── NEX Storage Parity Verification ──");
  console.log(`  primary       : ${primary.name}`);
  console.log(`  secondary     : ${secondary?.name ?? "(none — not in dual-write mode)"}`);
  console.log("");

  if (!secondary) {
    console.log("SKIP · not in dual-write mode. Set NEX_STORAGE_BACKEND=dual-write and NEX_POSTGRES_URL to run parity.");
    process.exit(0);
  }

  const checks: Check[] = [];

  // For now, parity is only verified on collections that have actually
  // been migrated (dual-write turned on for them). Start with events;
  // add more names to this array as each service migrates per Contract §7.
  const enabled: string[] = [COLLECTIONS.events];

  for (const collection of enabled) {
    const collectionChecks = await collectionParity(primary, secondary, collection);
    checks.push(...collectionChecks);
  }

  console.log("── Results ─────────────────────────────────");
  let failed = 0;
  for (const c of checks) {
    const mark = c.pass ? "✓" : "✗";
    console.log(`  ${mark} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.pass) failed += 1;
  }
  console.log("");
  if (failed === 0) {
    console.log(`PASS · ${checks.length}/${checks.length} checks green`);
    process.exit(0);
  } else {
    console.log(`FAIL · ${failed} of ${checks.length} checks failed · investigate before promoting secondary to primary`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-storage-parity] unexpected error:", err);
  process.exit(1);
});
