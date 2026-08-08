// GET /api/nex/comms-social/content/drafts?tenant_id=&limit=
import { NextResponse } from "next/server";
import { listDrafts } from "@/lib/nex/comms-social/content/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
  const drafts = await listDrafts(tenant_id, limit);
  return NextResponse.json({ ok: true, drafts });
}
