// POST /api/trade-off/projects/close
// Body: { slug, edit_token, project_id, final_summary, cover_image_url? }
//
// Marks a Job Diary project as completed. Requires a final_summary
// (3–500 chars) because the project moves into the public past-projects
// strip; an empty summary reads as a graveyard. Optionally swap the
// cover photo to a "finished" shot.
//
// Also writes a `completed` status_chip update so the stream's last
// post mirrors the project state. Idempotent — a project already in
// `completed` state errors out (use reopen first).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

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
  const final_summary = s(body.final_summary).slice(0, 500);
  const cover_image_url = s(body.cover_image_url).slice(0, 600);

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
  if (final_summary.length < 3) {
    return NextResponse.json(
      {
        ok: false,
        error: "Write a short wrap-up — what was delivered? (3-500 chars)"
      },
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
    .select("id, status, cover_image_url")
    .eq("id", project_id)
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!proj.data) {
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }
  if (proj.data.status === "completed") {
    return NextResponse.json(
      { ok: false, error: "Project is already closed." },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
    final_summary
  };
  if (cover_image_url) patch.cover_image_url = cover_image_url;

  const upd = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .update(patch)
    .eq("id", project_id)
    .eq("listing_id", listing.data.id)
    .select("*")
    .maybeSingle();
  if (upd.error || !upd.data) {
    console.error("[projects/close] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Close failed" },
      { status: 500 }
    );
  }

  // Auto-post a completion update so the stream's last entry reads
  // as "Completed". Best-effort — if it fails the project still closes.
  await supabaseAdmin
    .from("hammerex_xrated_project_updates")
    .insert({
      project_id,
      status_chip: "completed",
      image_urls: [],
      note: final_summary.slice(0, 280)
    });

  return NextResponse.json({ ok: true, project: upd.data });
}
