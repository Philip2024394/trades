#!/usr/bin/env node
// NEX Infrastructure Runtime · storage-layer round-trip verification.
//
// Same test, three backends. Any behavioural divergence = abstraction leak.
//
// USAGE
//   NEX_STORAGE_BACKEND=jsonl      npx tsx scripts/verify-storage-roundtrip.ts
//   NEX_STORAGE_BACKEND=postgres   NEX_POSTGRES_URL=postgresql://... npx tsx scripts/verify-storage-roundtrip.ts
//   NEX_STORAGE_BACKEND=dual-write NEX_POSTGRES_URL=postgresql://... npx tsx scripts/verify-storage-roundtrip.ts
//
// Exit 0 on green, 1 on any failure.

import { randomUUID } from "node:crypto";
import { getStorage, getStorageForParity } from "../src/lib/nex/storage/registry";
import { isPostgresHealthy } from "../src/lib/nex/storage/adapters/postgres";
import { COLLECTIONS } from "../src/lib/nex/storage/types";

type Result = { name: string; pass: boolean; detail?: string; ms?: number };

function mark(r: Result): string {
  const tick = r.pass ? "✓" : "✗";
  const time = typeof r.ms === "number" ? ` (${r.ms}ms)` : "";
  return `  ${tick} ${r.name}${time}${r.detail ? `\n      ${r.detail}` : ""}`;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function main(): Promise<void> {
  const backend = (process.env.NEX_STORAGE_BACKEND ?? "jsonl").toLowerCase();
  const results: Result[] = [];

  console.log("── NEX Storage Round-Trip Verification ──");
  console.log(`  backend       : ${backend}`);
  console.log("");

  const store = getStorage();

  // Phase 1 · Health probe (Postgres-only, informational for jsonl)
  if (backend === "postgres" || backend === "dual-write") {
    const h = await timed(() => isPostgresHealthy());
    results.push({
      name: "isPostgresHealthy",
      pass: h.value.healthy,
      detail: h.value.detail,
      ms: h.ms,
    });
    if (!h.value.healthy) {
      console.log(results.map(mark).join("\n"));
      console.log("\nFAIL · Postgres not healthy · aborting round-trip");
      process.exit(1);
    }
  }

  // Phase 2 · Round-trip on events collection
  const eventId = randomUUID();
  const now = new Date().toISOString();
  const record = {
    event_id: eventId,
    event_type: "storage.roundtrip.verify",
    source: "verify-storage-roundtrip",
    actor_id: "system",
    timestamp: now,
    business_id: null,
    related_department: null,
    related_brain: null,
    related_job: null,
    related_contact: null,
    outcome: "ok",
    payload: { backend, note: "round-trip test" },
    reversible: false,
    reverse_of: null,
    supersedes: null,
  };

  const save = await timed(() => store.save(COLLECTIONS.events, record));
  results.push({ name: "save(events)", pass: true, ms: save.ms });

  const load = await timed(() => store.load<typeof record>(COLLECTIONS.events, eventId));
  results.push({
    name: "load(events, id) returns saved row",
    pass: load.value?.event_id === eventId,
    detail: load.value ? `event_id=${load.value.event_id}` : "null returned",
    ms: load.ms,
  });

  const count = await timed(() => store.count(COLLECTIONS.events));
  results.push({
    name: "count(events) ≥ 1",
    pass: count.value >= 1,
    detail: `count=${count.value}`,
    ms: count.ms,
  });

  const query = await timed(() =>
    store.query<typeof record>(COLLECTIONS.events, { where: { event_id: eventId }, limit: 5 }),
  );
  results.push({
    name: "query(events, where event_id=...) finds saved row",
    pass: query.value.some((r) => r.event_id === eventId),
    detail: `matched ${query.value.length} row(s)`,
    ms: query.ms,
  });

  const stats = await timed(() => store.stats(COLLECTIONS.events));
  results.push({
    name: "stats(events) returns non-null",
    pass: stats.value.total_records >= 1,
    detail: `total=${stats.value.total_records} · latest=${stats.value.latest_write_at}`,
    ms: stats.ms,
  });

  // Phase 2 extra · dual-write only – both sides must have the row
  if (backend === "dual-write") {
    const { primary, secondary } = getStorageForParity();
    if (secondary) {
      const p = await timed(() => primary.load(COLLECTIONS.events, eventId));
      const s = await timed(() => secondary.load(COLLECTIONS.events, eventId));
      results.push({
        name: "dual-write · row present on primary (jsonl)",
        pass: p.value !== null,
        ms: p.ms,
      });
      results.push({
        name: "dual-write · row present on secondary (postgres)",
        pass: s.value !== null,
        ms: s.ms,
      });
    }
  }

  console.log("── Results ──────────────────────────");
  console.log(results.map(mark).join("\n"));

  const failed = results.filter((r) => !r.pass);
  console.log("");
  if (failed.length === 0) {
    console.log(`PASS · ${results.length}/${results.length} checks green · backend=${backend}`);
    process.exit(0);
  } else {
    console.log(`FAIL · ${failed.length} of ${results.length} checks failed · backend=${backend}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-storage-roundtrip] unexpected error:", err);
  process.exit(1);
});
