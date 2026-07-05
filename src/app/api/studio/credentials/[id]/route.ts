// Delete a merchant credential.
//
//   DELETE /api/studio/credentials/[id] → { ok }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await ctx.params;
  const del = await supabaseAdmin
    .from("studio_brand_credentials")
    .delete()
    .eq("id", id)
    .eq("brand_id", session.brand.id);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
