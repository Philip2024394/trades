#!/usr/bin/env node
// NEX Infrastructure Runtime · Week 1 pilot verification
//
// Round-trips a real Intelligence Event through the storage abstraction and
// asserts every layer behaved correctly. Run any time to prove the pilot is
// still healthy — the same call path production uses.
//
// USAGE
//   npm run nex:verify-storage
//   (or) npx tsx scripts/verify-storage-pilot.ts
//
// WHAT IT PROVES
//   · registry picks a backend without throwing
//   · emitEvent writes through StorageBackend.save
//   · the JSONL adapter's legacy-path map lands events on the expected file
//   · listEvents retrieves the row via query() with exact-match where clauses
//   · countEvents grows by exactly 1
//   · file size on disk grows
//
// EXIT CODES  0 = all assertions pass  ·  1 = any assertion fails
//
// SAFE TO RUN REPEATEDLY. Each run appends one event of type
// "storage_pilot_verify" tagged with a unique actor_id, so noise in the
// audit log is filterable and each verification produces a durable receipt.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  countEvents,
  emitEvent,
  listEvents,
} from "../src/lib/nex/events/fs-store";
import { getStorage } from "../src/lib/nex/storage/registry";

const EVENTS_FILE = path.join(process.cwd(), "data", "nex-events", "events.jsonl");

type Check = { name: string; pass: boolean; detail?: string };

async function fileSize(file: string): Promise<number> {
  try {
    const s = await fs.stat(file);
    return s.size;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const actorId = `verify-${runId}`;
  const store = getStorage();

  console.log("── NEX Storage Pilot Verification ──");
  console.log(`  backend       : ${store.name}`);
  console.log(`  events file   : ${EVENTS_FILE}`);
  console.log(`  run marker    : ${actorId}`);
  console.log("");

  const checks: Check[] = [];

  // Pre-state snapshot ────────────────────────────────────────────────
  const preCount = await countEvents();
  const preSize = await fileSize(EVENTS_FILE);
  console.log(`  pre-state     : ${preCount} events · ${preSize} bytes on disk`);

  // 1 · Emit through the abstraction ─────────────────────────────────
  let emittedId: string;
  try {
    emittedId = await emitEvent({
      event_type: "storage_pilot_verify",
      source: "system",
      actor_id: actorId,
      outcome: "success",
      payload: {
        run_id: runId,
        note: "Automated round-trip check · docs/NEX_INFRASTRUCTURE_RUNTIME.md §7",
      },
    });
    checks.push({
      name: "emitEvent returns UUID",
      pass: typeof emittedId === "string" && emittedId.length >= 32,
      detail: emittedId,
    });
  } catch (err) {
    checks.push({
      name: "emitEvent returns UUID",
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return report(checks);
  }

  // 2 · Read back via listEvents with exact-match filter ─────────────
  //     (both event_type AND actor_id must match; guarantees exactly ours)
  const rows = await listEvents({
    event_type: "storage_pilot_verify",
    since_ms: 60_000,
    limit: 50,
  });
  const mine = rows.filter((r) => r.actor_id === actorId);
  checks.push({
    name: "listEvents returns the emitted row exactly once",
    pass: mine.length === 1,
    detail: `matched ${mine.length} rows (expected 1) · total returned in window: ${rows.length}`,
  });

  // 3 · The retrieved row identity matches what emitEvent returned ──
  const retrieved = mine[0];
  checks.push({
    name: "retrieved event_id matches emitEvent return value",
    pass: retrieved?.event_id === emittedId,
    detail: `expected ${emittedId} · got ${retrieved?.event_id ?? "<none>"}`,
  });

  // 4 · Payload round-tripped intact ──────────────────────────────────
  checks.push({
    name: "payload survives round-trip",
    pass: (retrieved?.payload as { run_id?: string } | undefined)?.run_id === runId,
    detail: `payload.run_id expected ${runId}`,
  });

  // 5 · Count grew by exactly 1 ───────────────────────────────────────
  const postCount = await countEvents();
  checks.push({
    name: "countEvents grew by exactly 1",
    pass: postCount === preCount + 1,
    detail: `${preCount} → ${postCount}`,
  });

  // 6 · File on disk grew ─────────────────────────────────────────────
  const postSize = await fileSize(EVENTS_FILE);
  checks.push({
    name: "on-disk file size increased",
    pass: postSize > preSize,
    detail: `${preSize} → ${postSize} bytes`,
  });

  // 7 · Legacy-path routing landed the event where we expect ─────────
  //     (the JsonlStorage LEGACY_PATHS map should be pointing "events"
  //      at data/nex-events/events.jsonl, not the new data/nex-storage/)
  const legacyExists = await fs
    .stat(EVENTS_FILE)
    .then(() => true)
    .catch(() => false);
  checks.push({
    name: "legacy path data/nex-events/events.jsonl still active",
    pass: legacyExists,
    detail: EVENTS_FILE,
  });

  // 8 · Capabilities Layer · every known capability is declared ─────
  //     (Contract §14.4 · verify scripts assert declaration to catch
  //      missing/added capabilities at CI time.)
  const knownCaps = ["efficientLatestPerKey", "atomicMultiWrite", "jsonPathQueries", "fullTextSearch", "vectorSearch"] as const;
  const caps = store.capabilities;
  const undeclared = knownCaps.filter((k) => typeof caps[k] !== "boolean");
  checks.push({
    name: "capabilities property declares every known StorageBackendCapability",
    pass: undeclared.length === 0,
    detail: undeclared.length === 0
      ? `${knownCaps.length}/${knownCaps.length} declared · ${knownCaps.filter((k) => caps[k]).join(", ") || "(none true on this backend)"}`
      : `missing: ${undeclared.join(", ")}`,
  });

  report(checks);
}

function report(checks: Check[]): void {
  console.log("");
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
    console.log(`FAIL · ${failed} of ${checks.length} checks failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-storage-pilot] unexpected error:", err);
  process.exit(1);
});
