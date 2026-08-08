// GET /api/nex/comms-social/hq/network?admin_user_id=&reason=
// Returns the network-wide overview with k-anonymity floor applied.
import { NextResponse } from "next/server";
import { computeNetworkOverview, adapterStatus } from "@/lib/nex/comms-social/hq/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin_user_id = url.searchParams.get("admin_user_id");
  const reason        = url.searchParams.get("reason");
  if (!admin_user_id || !reason) return NextResponse.json({ ok: false, error: "admin_user_id + reason required" }, { status: 400 });
  try {
    const overview = await computeNetworkOverview({ admin_user_id, reason });
    const adapters = await adapterStatus();
    return NextResponse.json({ ok: true, overview, adapters });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
