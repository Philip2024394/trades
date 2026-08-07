// GET /api/nex/contacts/merge-preview?surviving=X&absorbed=Y
//
// Deterministic preview of what the resulting canonical contact will look
// like · surfaces every conflict the merge engine will resolve. No writes.

import { NextResponse } from "next/server";
import { previewMerge } from "@/lib/nex/contacts/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const surviving = q.get("surviving");
  const absorbed = q.get("absorbed");
  if (!surviving || !absorbed) {
    return NextResponse.json({ ok: false, error: "surviving and absorbed query params required" }, { status: 400 });
  }
  const result = await previewMerge(surviving, absorbed);
  if ("error" in result) return NextResponse.json({ ok: false, ...result }, { status: 400 });
  return NextResponse.json({ ok: true, ...result });
}
