// GET /api/nex/brain/cloud-status — cloud worker heartbeat feed
//
// Philip 2026-08-06 · Phase 5 · Cloud Worker Runtime
//
// Returns every worker heartbeat seen in the last 5 minutes. Powers
// the dashboard "Cloud worker: online" tile. A heartbeat older than
// 60s is considered stale — the worker has stopped, crashed, or lost
// its Supabase connection.

import { NextResponse } from "next/server";
import { brainStore } from "@/lib/nex/brain/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const heartbeats = await brainStore().listHeartbeats({
      since: fiveMinAgo,
      limit: 10,
    });

    const now = Date.now();
    const enriched = heartbeats.map((h) => {
      const age = now - new Date(h.last_seen_at).getTime();
      return {
        ...h,
        age_ms: age,
        status:
          age < 30_000 ? "online" : age < 60_000 ? "lagging" : "stale",
      };
    });

    return NextResponse.json({
      ok: true,
      any_online: enriched.some((h) => h.status === "online"),
      workers: enriched,
    });
  } catch (err) {
    console.error("[api.brain.cloud-status] failed:", err);
    return NextResponse.json(
      { ok: false, error: "cloud_status_failed" },
      { status: 500 }
    );
  }
}
