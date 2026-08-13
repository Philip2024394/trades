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
import { isCloudHeartbeat } from "@/lib/nex/brain/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// G2 · Truth Contract · this endpoint reports ONLY heartbeats whose
// runtime_kind is provably 'cloud'. Before G2, every heartbeat was
// counted as cloud · so local worker heartbeats (host_id `<type>@<pid>`)
// were mis-reported as Fly workers, causing HQ's "Cloud Workers (Fly)
// Running" tile to say Running when Fly had actually been decommissioned.
//
// The rule "a heartbeat alone is not cloud" is enforced by
// isCloudHeartbeat(). Local heartbeats (runtime_kind='local' OR legacy
// rows with no runtime_kind) are excluded. Local workforce liveness
// is exposed separately via /api/nex/brain/status (worker_pool) and
// the deprecated /workers-live endpoint.

export async function GET() {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    // Pull a wider window to preserve legacy compat with the "lagging"
    // and "stale" enrichment · the isCloudHeartbeat filter happens below.
    const allHeartbeats = await brainStore().listHeartbeats({
      since: fiveMinAgo,
      limit: 50,
    });

    const cloudHeartbeats = allHeartbeats.filter(isCloudHeartbeat);

    const now = Date.now();
    const enriched = cloudHeartbeats.map((h) => {
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
      // G2 · disclose what was filtered so operators can see the
      // reason a zero response is honest (local heartbeats exist,
      // they just are not cloud).
      diagnostics: {
        total_heartbeats_in_window: allHeartbeats.length,
        cloud_heartbeats: cloudHeartbeats.length,
        non_cloud_heartbeats: allHeartbeats.length - cloudHeartbeats.length,
        window_start: fiveMinAgo,
        // G2 verification · sample the runtime_kind on each heartbeat
        // so operators can see the filter is honest. Never dumps
        // secrets · only host_id + runtime_kind + last_seen_at age.
        heartbeat_sample: allHeartbeats.slice(0, 12).map((h) => ({
          host_id: h.host_id,
          last_seen_at: h.last_seen_at,
          runtime_kind: (h.metadata && typeof h.metadata === "object")
            ? (h.metadata as Record<string, unknown>).runtime_kind ?? "(missing)"
            : "(no-metadata)",
          age_ms: now - new Date(h.last_seen_at).getTime(),
        })),
      },
    });
  } catch (err) {
    console.error("[api.brain.cloud-status] failed:", err);
    return NextResponse.json(
      { ok: false, error: "cloud_status_failed" },
      { status: 500 }
    );
  }
}
