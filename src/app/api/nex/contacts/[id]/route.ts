// GET /api/nex/contacts/{id} — per-contact detail drawer feed
//
// Returns the canonical snapshot + full source history + merge history
// (as surviving or absorbed) + recent related events (email.* +
// contacts.connector.sync). One round-trip per drawer open.

import { NextResponse } from "next/server";
import { getContactDetail } from "@/lib/nex/contacts/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const detail = await getContactDetail(id);
  if (!detail || !detail.contact) {
    return NextResponse.json({ ok: false, error: "contact_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...detail });
}
