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

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { computeWarehouseView } from "@/lib/nex/brain/warehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const snapshot = await computeWarehouseView();
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "warehouse_compute_failed" },
      { status: 500 },
    );
  }
}
