// GET /api/nex/brain/warehouse
//
// Returns the current warehouse snapshot: six production stages a work
// item can be in, with real counts + oldest-item ages composed from
// worker_jobs and knowledge_records. Read-only aggregator · never writes.
//
// See src/lib/nex/brain/warehouse.ts for the stage definitions and
// aggregation rules. This endpoint is the projection the UI's Warehouse
// panel renders — no data lives here that isn't already in worker_jobs
// or knowledge_records.
//
// G3-B · Truth Contract 2026-08-10. This route also computes the
// KJ-level `in_production` metric from local Postgres nex.knowledge_dump_jobs
// and merges it into the response. This lives server-only in this route
// because warehouse.ts is imported by client components (via
// computeJobProgress) and a top-level pg import would poison the
// browser bundle. See warehouse.ts header note.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { computeWarehouseView, type WarehouseSnapshot } from "@/lib/nex/brain/warehouse";
import { withBrainRole } from "@/lib/nex/db/with-brain-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// G3-B · The 10 preserved fixture KJs. Duplicated intentionally from
// scripts/prove-supervisor-review.ts::PRESERVED_KJIDS,
// scripts/burnin-snapshot.mjs and (from now on) this file. Every drift
// makes the in_production count wrong · keep all copies aligned.
const PRESERVED_KJIDS: readonly string[] = [
  "46a8eb51-617c-404b-8237-6a515ad6125a",
  "56e1da78-6a97-461a-bc38-cc505d25e00a",
  "ab5835b8-05c8-485e-b1ef-399fe9a48b0a",
  "47e0cf43-5e4c-4d69-a509-59e232e141f1",
  "7fc668ef-cbbc-42a4-b2ef-16e1cde41680",
  "270865e6-f2ca-4fc0-8648-151417c85f64",
  "b1772902-7348-49cd-aed4-48d221ea2d69",
  "1e09c119-f9ed-4400-9dc7-722fc7ae223d",
  "6381641c-eb29-4007-8f3c-2942933cb62d",
  "7e1fc4f9-efb5-4892-8d55-51b347babe1c",
];

// G3-B · Compute the KJ-level "in production" signal from the
// authoritative KJ lifecycle table. Read-only · one SELECT · never
// writes. Excludes the 10 preserved fixture KJs per the Truth Contract.
async function computeInProduction(): Promise<WarehouseSnapshot["in_production"]> {
  try {
    const result = await withBrainRole(async (c) => {
      const r = await c.query(
        `SELECT status, COUNT(*)::int AS n, MIN(created_at) AS oldest_at
           FROM nex.knowledge_dump_jobs
          WHERE status IN ('queued','claimed','processing')
            AND job_id <> ALL($1::text[])
          GROUP BY status`,
        [PRESERVED_KJIDS as unknown as string[]],
      );
      const by = { queued: 0, claimed: 0, processing: 0 };
      let oldestMs: number | null = null;
      let oldestIso: string | null = null;
      for (const row of r.rows as Array<{ status: string; n: number; oldest_at: Date | string | null }>) {
        const status = row.status as keyof typeof by;
        if (status in by) by[status] = Number(row.n);
        const raw = row.oldest_at;
        if (raw != null) {
          const t = raw instanceof Date ? raw.getTime() : new Date(raw as string).getTime();
          if (Number.isFinite(t) && (oldestMs === null || t < oldestMs)) {
            oldestMs = t;
            oldestIso = new Date(t).toISOString();
          }
        }
      }
      const total = by.queued + by.claimed + by.processing;
      return {
        total,
        by_status: by,
        oldest_at: oldestIso,
        oldest_age_ms: oldestMs !== null ? Date.now() - oldestMs : null,
        source: "local_postgres_knowledge_dump_jobs" as const,
        excludes_preserved_kjids: PRESERVED_KJIDS.length,
      };
    });
    if (result === null) {
      return {
        total: 0,
        by_status: { queued: 0, claimed: 0, processing: 0 },
        oldest_at: null,
        oldest_age_ms: null,
        source: "unavailable",
        excludes_preserved_kjids: PRESERVED_KJIDS.length,
        note: "NEX_POSTGRES_URL not configured",
      };
    }
    return result;
  } catch (err) {
    return {
      total: 0,
      by_status: { queued: 0, claimed: 0, processing: 0 },
      oldest_at: null,
      oldest_age_ms: null,
      source: "unavailable",
      excludes_preserved_kjids: PRESERVED_KJIDS.length,
      note: `in_production query failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function GET(_req: NextRequest) {
  try {
    // Run the Supabase-backed stages aggregator and the pg-backed
    // in_production query in parallel · independent sources.
    const [snapshot, inProduction] = await Promise.all([
      computeWarehouseView(),
      computeInProduction(),
    ]);
    // Merge · in_production replaces the placeholder shape emitted by
    // computeWarehouseView.
    const merged: WarehouseSnapshot = { ...snapshot, in_production: inProduction };
    return NextResponse.json({ ok: true, ...merged });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "warehouse_compute_failed" },
      { status: 500 },
    );
  }
}
