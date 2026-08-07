// GET /api/nex/compliance/contacts/{id} — compliance state + audit trail
import { NextResponse } from "next/server";
import { getAuditForContact, getContactCompliance } from "@/lib/nex/compliance/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [contact, audit] = await Promise.all([getContactCompliance(id), getAuditForContact(id, 200)]);
  if (!contact) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, contact, audit });
}
