// GET /api/nex/comms-social/hq/audit?admin_user_id=&reason=&limit=&stream=audit|access
import { NextResponse } from "next/server";
import { listAdminAccessLog, listRecentAudit } from "@/lib/nex/comms-social/hq/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin_user_id = url.searchParams.get("admin_user_id");
  const reason        = url.searchParams.get("reason");
  const stream        = url.searchParams.get("stream") ?? "audit";
  const limit         = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  if (!admin_user_id || !reason) return NextResponse.json({ ok: false, error: "admin_user_id + reason required" }, { status: 400 });
  try {
    if (stream === "access") {
      const rows = await listAdminAccessLog({ admin_user_id, reason, limit });
      return NextResponse.json({ ok: true, stream, rows });
    }
    const rows = await listRecentAudit({ admin_user_id, reason, limit });
    return NextResponse.json({ ok: true, stream, rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
