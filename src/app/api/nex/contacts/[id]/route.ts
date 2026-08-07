// GET /api/nex/contacts/{id} — per-contact detail drawer feed
//
// Returns the canonical snapshot + full source history + merge history
// (as surviving or absorbed) + recent related events (email.* +
// contacts.connector.sync). One round-trip per drawer open.

import { NextResponse } from "next/server";
import { getContactDetail } from "@/lib/nex/contacts/registry";
import { resolveAlias } from "@/lib/nex/contacts/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Alias resolution · if this id was absorbed by a merge, redirect to
  // the surviving canonical contact. Preserves historical foreign keys
  // + connector references without leaking absorbed identities.
  const canonicalId = await resolveAlias(id);
  const detail = await getContactDetail(canonicalId);
  if (!detail || !detail.contact) {
    return NextResponse.json({ ok: false, error: "contact_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    alias_resolved: canonicalId !== id,
    requested_id: id,
    canonical_id: canonicalId,
    ...detail,
  });
}
