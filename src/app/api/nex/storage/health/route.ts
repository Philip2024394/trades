// GET /api/nex/storage/health — Storage abstraction self-test
//
// Exercises the interface end-to-end · save · load · latestPerKey · query · count · stats.
// Uses a `_storage_health` collection so it never pollutes real data.
// Returns pass/fail per operation so we can prove the abstraction works
// before migrating any real service through it.

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestRecord = {
  record_id: string;
  key: string;                    // for latestPerKey testing
  value: number;
  created_at: string;
};

export async function GET() {
  const store = getStorage();
  const results: Array<{ step: string; ok: boolean; detail?: string }> = [];

  const write = async (step: string, fn: () => Promise<unknown>) => {
    try { await fn(); results.push({ step, ok: true }); }
    catch (err) { results.push({ step, ok: false, detail: err instanceof Error ? err.message : "unknown" }); }
  };

  const testKey = `key-${Date.now()}`;
  const rec1: TestRecord = { record_id: randomUUID(), key: testKey, value: 1, created_at: new Date().toISOString() };
  const rec2: TestRecord = { record_id: randomUUID(), key: testKey, value: 2, created_at: new Date(Date.now() + 1).toISOString() };
  const otherKey = `key-${Date.now()}-other`;
  const rec3: TestRecord = { record_id: randomUUID(), key: otherKey, value: 99, created_at: new Date(Date.now() + 2).toISOString() };

  // 1. save
  await write("save x3", async () => {
    await store.save("_storage_health", rec1);
    await store.save("_storage_health", rec2);
    await store.save("_storage_health", rec3);
  });

  // 2. load by id
  await write("load by record_id (returns latest match)", async () => {
    const found = await store.load<TestRecord>("_storage_health", rec2.record_id);
    if (!found || found.record_id !== rec2.record_id) throw new Error("load returned unexpected record");
  });

  // 3. count with where
  await write("count where key = testKey", async () => {
    const n = await store.count("_storage_health", { where: { key: testKey } });
    if (n !== 2) throw new Error(`expected count=2 got ${n}`);
  });

  // 4. query with sort + limit
  await write("query where key = testKey, order by value asc", async () => {
    const rows = await store.query<TestRecord>("_storage_health", { where: { key: testKey }, order_by: "value", order_dir: "asc" });
    if (rows.length !== 2) throw new Error(`expected 2 rows got ${rows.length}`);
    if (rows[0].value !== 1 || rows[1].value !== 2) throw new Error("unexpected sort order");
  });

  // 5. latestPerKey · should collapse rec1+rec2 to just rec2 (latest for testKey)
  await write("latestPerKey by key · rec2 wins for testKey", async () => {
    const rows = await store.latestPerKey<TestRecord>("_storage_health", "key", { where: { key: testKey } });
    if (rows.length !== 1) throw new Error(`expected 1 collapsed row got ${rows.length}`);
    if (rows[0].value !== 2) throw new Error(`expected value=2 (latest) got ${rows[0].value}`);
  });

  // 6. stats
  await write("stats returns non-null size + latest_write_at", async () => {
    const s = await store.stats("_storage_health");
    if (s.total_records < 3) throw new Error(`expected >=3 records got ${s.total_records}`);
    if (!s.latest_write_at) throw new Error("latest_write_at should be set after writes");
  });

  const allPass = results.every((r) => r.ok);
  return NextResponse.json({
    ok: allPass,
    backend: store.name,
    results,
    contract_version: 1,
  }, { status: allPass ? 200 : 500 });
}
