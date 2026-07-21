// DELETE /api/scheduled-posts/[id]  — cancel a pending scheduled post
// PATCH  /api/scheduled-posts/[id]  — reschedule (change scheduled_for)

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_SCHEDULE_OFFSET_MS = 2  * 60 * 1000;
const MAX_SCHEDULE_OFFSET_MS = 90 * 24 * 60 * 60 * 1000;

async function ensureOwn(id: string, merchantSlug: string) {
  const { data, error } = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .select("id, status")
    .eq("id", id)
    .eq("merchant_slug", merchantSlug)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; status: string };
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { id } = await params;
  const row = await ensureOwn(id, merchantSlug);
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_cancellable", detail: `Post is ${row.status}.` }, { status: 409 });
  }
  const upd = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");   // race-safe: only cancel if still pending
  if (upd.error) return NextResponse.json({ ok: false, error: "cancel_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { id } = await params;
  const row = await ensureOwn(id, merchantSlug);
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_editable", detail: `Post is ${row.status}.` }, { status: 409 });
  }

  let body: { scheduled_for?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const when = body.scheduled_for ? new Date(body.scheduled_for) : null;
  if (!when || isNaN(when.getTime())) return NextResponse.json({ ok: false, error: "invalid_time" }, { status: 400 });
  const offset = when.getTime() - Date.now();
  if (offset < MIN_SCHEDULE_OFFSET_MS) return NextResponse.json({ ok: false, error: "too_soon" }, { status: 400 });
  if (offset > MAX_SCHEDULE_OFFSET_MS) return NextResponse.json({ ok: false, error: "too_far" }, { status: 400 });

  const upd = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .update({ scheduled_for: when.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (upd.error) return NextResponse.json({ ok: false, error: "reschedule_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, scheduled_for: when.toISOString() });
}
