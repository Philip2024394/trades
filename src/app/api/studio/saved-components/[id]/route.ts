// DELETE /api/studio/saved-components/[id]
//
// Removes a saved component from the merchant's library. Cookie-auth,
// scoped by merchant_id so one merchant can't delete another's row.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "missing-id" },
      { status: 400 }
    );
  }
  const res = await supabaseAdmin
    .from("studio_saved_components")
    .delete()
    .eq("id", id)
    .eq("merchant_id", session.merchant.id);
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
