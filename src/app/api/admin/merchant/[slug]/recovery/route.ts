// POST   /api/admin/merchant/[slug]/recovery — award recovery status
// DELETE /api/admin/merchant/[slug]/recovery — revoke it
//
// Admin-only. Recovery is a positive trust signal — awarded when the
// merchant demonstrably resolved a low-review dispute (customer
// edited/withdrew, evidence upheld, etc.). Publicly visible on the
// merchant's reviews page + profile focus.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";

const MIN_REASON = 10;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not-admin" }, { status: 401 });
  }
  const { slug } = await params;
  if (!slug) return NextResponse.json({ ok: false, error: "missing-slug" }, { status: 400 });

  let payload: { reason: string };
  try {
    payload = (await req.json()) as { reason: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const reason = String(payload.reason ?? "").trim();
  if (reason.length < MIN_REASON) {
    return NextResponse.json({ ok: false, error: "reason-required" }, { status: 400 });
  }

  const upsert = await supabaseAdmin
    .from("hammerex_merchant_recovery")
    .upsert({
      merchant_slug: slug,
      awarded_at: new Date().toISOString(),
      awarded_by: "admin",
      reason
    });
  if (upsert.error) {
    return NextResponse.json(
      { ok: false, error: "db-upsert-failed", detail: upsert.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not-admin" }, { status: 401 });
  }
  const { slug } = await params;
  const del = await supabaseAdmin
    .from("hammerex_merchant_recovery")
    .delete()
    .eq("merchant_slug", slug);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: "db-delete-failed", detail: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
