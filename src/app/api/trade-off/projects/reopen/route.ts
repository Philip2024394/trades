// POST /api/trade-off/projects/reopen
// Body: { slug, edit_token, project_id }
//
// Flips a closed project back to `live`. Nulls completed_at and
// final_summary (the CHECK constraint requires both to be NULL when
// status != 'completed'). The update stream stays intact — the auto-
// posted `completed` chip becomes part of the history.
//
// Reopen is also used to recover from a right-to-removal archive once
// the admin has reviewed it — though we don't expose that through the
// public form (admin uses Supabase studio for those edge cases).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_LIVE_PER_LISTING = 20;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const project_id = s(body.project_id);

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(project_id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid project id." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const proj = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .select("id, status")
    .eq("id", project_id)
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!proj.data) {
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }
  if (proj.data.status === "live") {
    return NextResponse.json(
      { ok: false, error: "Project is already live." },
      { status: 400 }
    );
  }

  // Live-cap guard — same as upsert. Stops a tradesperson from
  // reopening their way past the 20 limit.
  const countRes = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing.data.id)
    .eq("status", "live");
  if ((countRes.count ?? 0) >= MAX_LIVE_PER_LISTING) {
    return NextResponse.json(
      {
        ok: false,
        error: `You already have ${MAX_LIVE_PER_LISTING} live projects. Close one first.`
      },
      { status: 400 }
    );
  }

  const upd = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .update({ status: "live", completed_at: null, final_summary: null })
    .eq("id", project_id)
    .eq("listing_id", listing.data.id)
    .select("*")
    .maybeSingle();
  if (upd.error || !upd.data) {
    console.error("[projects/reopen] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Reopen failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, project: upd.data });
}
