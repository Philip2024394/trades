// /api/admin/reviews/[id]
//
// PATCH — edit a review. Body: { customer_name?, body?, overall_rating?,
//         service_name?, action_reason? }. Only updates the fields the
//         admin actually changed; stamps admin_edited_at = now() so the
//         moderation audit trail has a timestamp.
// DELETE — hard DELETE the row. Used as the "nuclear option" for
//         illegal / unrecoverable content. Cascades any review_replies
//         only if the FK in that table is set ON DELETE CASCADE — we
//         rely on that wiring, no manual delete here.
//
// Auth: shared xrated_admin_session HMAC cookie via isAdminAuthed().

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function intInRange(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  if (n < min || n > max) return undefined;
  return n;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { admin_edited_at: new Date().toISOString() };

  const customer_name = s(body.customer_name);
  if (customer_name !== undefined) patch.customer_name = customer_name;

  const reviewBody = s(body.body);
  if (reviewBody !== undefined) patch.body = reviewBody;

  const overall = intInRange(body.overall_rating, 1, 5);
  if (overall !== undefined) patch.overall_rating = overall;

  // service_name can be cleared by passing an explicit empty string; we
  // treat undefined/missing as "don't touch", empty string as "set null".
  if (Object.prototype.hasOwnProperty.call(body, "service_name")) {
    const sn = typeof body.service_name === "string" ? body.service_name.trim() : "";
    patch.service_name = sn.length === 0 ? null : sn;
  }

  const action_reason = s(body.action_reason);
  if (action_reason !== undefined) patch.admin_action_reason = action_reason;

  const upd = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (upd.error) {
    console.error("[admin/reviews/PATCH] update failed:", upd.error);
    return NextResponse.json(
      { error: `Update failed: ${upd.error.message}` },
      { status: 500 }
    );
  }
  if (!upd.data) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const del = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (del.error) {
    console.error("[admin/reviews/DELETE] failed:", del.error);
    return NextResponse.json(
      { error: `Delete failed: ${del.error.message}` },
      { status: 500 }
    );
  }
  if (!del.data) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
