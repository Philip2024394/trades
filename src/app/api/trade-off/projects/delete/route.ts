// POST /api/trade-off/projects/delete
// Magic-link authenticated. Body: { slug, edit_token, project_id }.
// Auth + scope-check, then deletes the row.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

  if (!slug || !token || !project_id) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or project_id." },
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
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 401 });
  }

  const project = await supabaseAdmin
    .from("hammerex_trade_off_projects")
    .select("id, listing_id")
    .eq("id", project_id)
    .maybeSingle();
  if (!project.data) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }
  if (project.data.listing_id !== listing.data.id) {
    return NextResponse.json(
      { ok: false, error: "Project does not belong to this listing." },
      { status: 403 }
    );
  }

  const del = await supabaseAdmin
    .from("hammerex_trade_off_projects")
    .delete()
    .eq("id", project_id);
  if (del.error) {
    console.error("[trade-off/projects/delete] delete failed:", del.error);
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
