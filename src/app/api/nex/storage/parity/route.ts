// GET /api/nex/storage/parity — Migration Verification Dashboard endpoint
//
// Compares PRIMARY vs SECONDARY backends for every migrated collection.
//   · Row counts match?
//   · Latest record hash match?
//   · Oldest record hash match?
//   · Backend latencies (for capacity planning)
//
// SINGLE-BACKEND MODE (jsonl only): parity is trivially true because
// there's only one source. Endpoint still returns success · marked
// honestly in the `note` field · no fabricated green.
//
// DUAL-WRITE MODE (jsonl + postgres): parity comparison is real and
// load-bearing. A green row means "safe to promote secondary to primary."
// Red = do not cut over.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getStorageForParity } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { isPostgresHealthy } from "@/lib/nex/storage/adapters/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every collection currently migrated through the abstraction.
const MIGRATED_COLLECTIONS: string[] = [
  COLLECTIONS.events,
];

type ParityRow = {
  collection: string;
  primary_backend: string;
  secondary_backend: string | null;
  primary_count: number;
  secondary_count: number | null;
  counts_match: boolean | null;
  latest_hash_primary: string | null;
  latest_hash_secondary: string | null;
  latest_matches: boolean | null;
  oldest_hash_primary: string | null;
  oldest_hash_secondary: string | null;
  oldest_matches: boolean | null;
  primary_latency_ms: number;
  secondary_latency_ms: number | null;
  overall_green: boolean;
};

function hashRecord(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  // Hash only the stable subset of fields · exclude storage-side metadata
  // (inserted_at is Postgres-only, size_bytes drifts). Event fields are
  // authoritative across both backends.
  const stable: Record<string, unknown> = {};
  const stableFields = [
    "event_id", "event_type", "source", "actor_id", "timestamp",
    "related_department", "related_brain", "related_job", "related_contact",
    "outcome", "payload", "reversible", "reverse_of", "supersedes",
  ];
  for (const f of stableFields) {
    if (f in record) stable[f] = record[f];
  }
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 16);
}

export async function GET() {
  const { primary, secondary } = getStorageForParity();
  const rows: ParityRow[] = [];

  let secondaryReachable = true;
  let secondaryDetail: string | undefined;
  if (secondary?.name === "postgres") {
    const probe = await isPostgresHealthy();
    secondaryReachable = probe.healthy;
    secondaryDetail = probe.detail;
  }

  for (const collection of MIGRATED_COLLECTIONS) {
    // Primary side
    const t1 = Date.now();
    const [primary_count, primary_query] = await Promise.all([
      primary.count(collection),
      primary.query<Record<string, unknown>>(collection, { limit: 10000, order_by: "timestamp", order_dir: "desc" }),
    ]);
    const primary_latency = Date.now() - t1;
    const primary_latest = primary_query[0] ?? null;
    const primary_oldest = primary_query[primary_query.length - 1] ?? null;

    // Secondary side (if present + reachable)
    let secondary_count: number | null = null;
    let secondary_latency: number | null = null;
    let secondary_latest: Record<string, unknown> | null = null;
    let secondary_oldest: Record<string, unknown> | null = null;

    if (secondary && secondaryReachable) {
      try {
        const t2 = Date.now();
        const [sc, sq] = await Promise.all([
          secondary.count(collection),
          secondary.query<Record<string, unknown>>(collection, { limit: 10000, order_by: "timestamp", order_dir: "desc" }),
        ]);
        secondary_latency = Date.now() - t2;
        secondary_count = sc;
        secondary_latest = sq[0] ?? null;
        secondary_oldest = sq[sq.length - 1] ?? null;
      } catch (err) {
        secondaryReachable = false;
        secondaryDetail = err instanceof Error ? err.message : "unknown";
      }
    }

    const latest_p = hashRecord(primary_latest);
    const latest_s = hashRecord(secondary_latest);
    const oldest_p = hashRecord(primary_oldest);
    const oldest_s = hashRecord(secondary_oldest);

    const counts_match = secondary_count === null ? null : (primary_count === secondary_count);
    const latest_matches = latest_s === null ? null : (latest_p === latest_s);
    const oldest_matches = oldest_s === null ? null : (oldest_p === oldest_s);

    const overall_green = secondary === null
      ? true    // single-backend mode · nothing to compare
      : (counts_match === true && latest_matches === true && oldest_matches === true);

    rows.push({
      collection,
      primary_backend: primary.name,
      secondary_backend: secondary?.name ?? null,
      primary_count,
      secondary_count,
      counts_match,
      latest_hash_primary: latest_p,
      latest_hash_secondary: latest_s,
      latest_matches,
      oldest_hash_primary: oldest_p,
      oldest_hash_secondary: oldest_s,
      oldest_matches,
      primary_latency_ms: primary_latency,
      secondary_latency_ms: secondary_latency,
      overall_green,
    });
  }

  const allGreen = rows.every((r) => r.overall_green);
  const mode = secondary ? "dual-write" : "single-backend";

  return NextResponse.json({
    ok: allGreen,
    mode,
    primary_backend: primary.name,
    secondary_backend: secondary?.name ?? null,
    secondary_reachable: secondary ? secondaryReachable : null,
    secondary_error: secondary && !secondaryReachable ? secondaryDetail : null,
    migrated_collections: rows.length,
    all_green: allGreen,
    rows,
    generated_at: new Date().toISOString(),
    note: mode === "single-backend"
      ? "Single-backend mode · parity is trivially true (no comparison possible). Set NEX_STORAGE_BACKEND=dual-write + NEX_POSTGRES_URL to activate real comparison."
      : allGreen
        ? "All migrated collections show matching counts + latest/oldest hashes. Safe to promote secondary to primary after 5-7 days of continuous green."
        : "DIVERGENCE DETECTED · do not promote secondary until every row is green.",
  });
}
