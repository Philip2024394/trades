// DELETE /api/homeowner/costs/documents/[docId] — remove a cost
// document + its storage object. Homeowner-scoped.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { deleteDocument } from "@/lib/homeowners/costDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  const { docId } = await params;
  const ok = await deleteDocument({ homeownerId: homeowner.id, id: docId });
  if (!ok) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
