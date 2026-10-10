// WO-LIVE-WORKFORCE-PROOF-02 · NEX NET GROWTH API.
//
// Returns the latest signed NET GROWTH snapshot with per-domain deltas
// and the single-headline `net_nex_growth` figure. Every metric carries
// record_ids for drill-down.

import { NextResponse } from "next/server";
import { loadRecentNexNetGrowthSnapshots } from "@/lib/nex-agent-runtime/nex-net-growth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const snapshots = await loadRecentNexNetGrowthSnapshots(60);
  const latest = snapshots[0] ?? null;
  return NextResponse.json({
    record_type: "NEX_HQ_NET_GROWTH",
    generated_at: new Date().toISOString(),
    snapshot_count: snapshots.length,
    latest,
    all_snapshots: snapshots,
  }, { status: 200 });
}

export async function POST(): Promise<Response> { return NextResponse.json({ error: "method_not_allowed" }, { status: 405 }); }
