// GET /api/nex/storage/centre — Data Platform Centre aggregator
//
// Honest scope: ship the numbers we actually have. Anything not yet
// instrumented (writes/sec · reads/sec · replication) is returned as null
// with a `not_instrumented: true` marker so the UI can render "—" or an
// explicit "not yet measured" instead of fabricating.

import { NextResponse } from "next/server";
import { getStorage, getStorageForParity } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { isPostgresHealthy } from "@/lib/nex/storage/adapters/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every collection that COULD be showing data (legacy paths OR future
// storage-native paths). Displayed even at 0 records so admins see the
// full contract inventory.
const KNOWN_COLLECTIONS = Object.values(COLLECTIONS);

export async function GET() {
  const store = getStorage();
  const { primary, secondary } = getStorageForParity();

  // Per-collection stats · every collection we know about.
  // Only the migrated ones will have live counts today · unmigrated ones
  // return 0 (they still write to their own legacy paths).
  const perCollection = await Promise.all(
    KNOWN_COLLECTIONS.map(async (c) => {
      try {
        const s = await primary.stats(c);
        return { collection: c, ...s, error: null };
      } catch (err) {
        return {
          collection: c,
          total_records: 0,
          latest_write_at: null,
          size_bytes: 0,
          error: err instanceof Error ? err.message : "unknown",
        };
      }
    }),
  );

  const totalRecords = perCollection.reduce((n, c) => n + c.total_records, 0);
  const totalBytes = perCollection.reduce((n, c) => n + c.size_bytes, 0);
  const largest = perCollection.slice().sort((a, b) => b.total_records - a.total_records)[0] ?? null;

  // Secondary backend health probe
  let secondaryHealthy: boolean | null = null;
  let secondaryDetail: string | null = null;
  if (secondary?.name === "postgres") {
    const probe = await isPostgresHealthy();
    secondaryHealthy = probe.healthy;
    secondaryDetail = probe.detail ?? null;
  }

  return NextResponse.json({
    ok: true,
    backend: {
      primary: primary.name,
      secondary: secondary?.name ?? null,
      mode: secondary ? "dual-write" : "single-backend",
      secondary_healthy: secondaryHealthy,
      secondary_detail: secondaryDetail,
    },
    totals: {
      collections_declared: KNOWN_COLLECTIONS.length,
      collections_with_data: perCollection.filter((c) => c.total_records > 0).length,
      total_records: totalRecords,
      storage_used_bytes: totalBytes,
      storage_used_mb: Math.round(totalBytes / (1024 * 1024) * 100) / 100,
    },
    largest_collection: largest ? { collection: largest.collection, records: largest.total_records } : null,
    per_collection: perCollection.sort((a, b) => b.total_records - a.total_records),
    // Honest instrumentation state · these are not yet measured. UI must
    // render "not instrumented" instead of a fake number.
    not_instrumented: {
      writes_per_second: true,
      reads_per_second: true,
      average_query_ms: true,
      replication_lag_ms: true,
      last_backup_at: true,
    },
    generated_at: new Date().toISOString(),
  });
}
