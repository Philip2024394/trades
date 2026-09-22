// GET/POST /api/cron/nex-harvest-tick
//
// NEX 24/7 World Harvest Engine · Wave H5 · Controller tick endpoint
// Founder-authorised programme · 2026-09-22.
//
// GATED: NEX_DISCOVERY_CRON_ACTIVATION must equal "on" · else 503 dormant.
// When active, runs ONE controller tick with NULL adapters (safe default).
// Production adapters (real Overpass + real PageFetcher) are wired at H5
// activation by the Founder · not by this endpoint.
//
// A "green" response from this endpoint DOES NOT MEAN harvesting is running.
// It means one tick executed with whatever adapters were configured.
// The Overview page reads harvest_yield · that is the definition of ACTIVE.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { runHarvestControllerTick, resolveProductionHarvestAdapters } from "@/lib/nex/harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  if (process.env.NEX_DISCOVERY_CRON_ACTIVATION !== "on") {
    return NextResponse.json({
      ok: false,
      state: "endpoint_dormant",
      note: "set NEX_DISCOVERY_CRON_ACTIVATION=on to activate the harvest controller · production adapters must be wired at H5 activation for real harvesting",
    }, { status: 503 });
  }
  const url = new URL(req.url);
  const programme_id = url.searchParams.get("programme_id") ?? "";
  const worker_id = req.headers.get("x-worker-id") || process.env.NEX_HARVEST_WORKER_ID || "cron-harvest-default";
  const terms_param = url.searchParams.get("terms") ?? "scaffolding,scaffolders,scaffolder";
  const terms = terms_param.split(",").map(s => s.trim()).filter(Boolean);

  if (!programme_id) {
    return NextResponse.json({ ok: false, error: "programme_id_required" }, { status: 400 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    // Founder-authorised production wire-in · scope-locked 2026-09-22.
    // When NEX_PAGE_FETCHER_ACTIVATION === "on" AND the Founder-signed
    // allowlist file is readable, production adapters are constructed.
    // Otherwise the controller falls back to NULL_OVERPASS_ADAPTER +
    // NULL_FETCHER · a green response with null_defaults means the tick
    // ran but no real-world HTTP was performed.
    const adapters = await resolveProductionHarvestAdapters({ env: process.env });
    const result = await runHarvestControllerTick({
      client, worker_id, programme_id, programme_terms: terms,
      overpass_adapter: adapters.overpass_adapter,
      page_fetcher: adapters.page_fetcher,
    });
    return NextResponse.json({
      ok: true,
      state: "active",
      adapters: { source: adapters.source, reason: adapters.reason },
      result,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error", detail: (e as Error).message }, { status: 500 });
  } finally { client.release(); }
}

export async function GET(req: Request)  { return run(req); }
export async function POST(req: Request) { return run(req); }
