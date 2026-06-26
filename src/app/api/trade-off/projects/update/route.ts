// POST /api/trade-off/projects/update
// Magic-link authenticated. Body: { slug, edit_token, project_id, fields }.
//
// Auth via edit_token, scope-check that the project belongs to the slug's
// listing, then update only the safe subset of fields. `verified` is locked
// out — only admins (direct DB) can set it.

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

function strOrNull(v: unknown, max = 400): string | null {
  const t = s(v);
  if (!t) return null;
  return t.slice(0, max);
}

function dateOrNull(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return t;
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
  const fieldsIn = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, unknown>;

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

  const patch: Record<string, unknown> = {};

  if ("title" in fieldsIn) {
    const t = s(fieldsIn.title).slice(0, 160);
    if (!t) {
      return NextResponse.json({ ok: false, error: "Title cannot be empty." }, { status: 400 });
    }
    patch.title = t;
  }
  if ("description" in fieldsIn) patch.description = strOrNull(fieldsIn.description, 2000);
  if ("before_url" in fieldsIn) patch.before_url = strOrNull(fieldsIn.before_url, 600);
  if ("during_url" in fieldsIn) patch.during_url = strOrNull(fieldsIn.during_url, 600);
  if ("after_url" in fieldsIn) patch.after_url = strOrNull(fieldsIn.after_url, 600);
  if ("location_city" in fieldsIn) patch.location_city = strOrNull(fieldsIn.location_city, 80);
  if ("completed_at" in fieldsIn) patch.completed_at = dateOrNull(fieldsIn.completed_at);

  // Make sure at least one photo remains after the patch.
  const remainingBefore =
    "before_url" in patch ? patch.before_url : undefined;
  const remainingDuring =
    "during_url" in patch ? patch.during_url : undefined;
  const remainingAfter =
    "after_url" in patch ? patch.after_url : undefined;
  if (
    "before_url" in patch ||
    "during_url" in patch ||
    "after_url" in patch
  ) {
    // Need to re-read the row to know the final state.
    const cur = await supabaseAdmin
      .from("hammerex_trade_off_projects")
      .select("before_url, during_url, after_url")
      .eq("id", project_id)
      .maybeSingle();
    const finalBefore =
      "before_url" in patch ? remainingBefore : cur.data?.before_url ?? null;
    const finalDuring =
      "during_url" in patch ? remainingDuring : cur.data?.during_url ?? null;
    const finalAfter =
      "after_url" in patch ? remainingAfter : cur.data?.after_url ?? null;
    if (!finalBefore && !finalDuring && !finalAfter) {
      return NextResponse.json(
        { ok: false, error: "Cannot remove all photos — at least one stage must remain." },
        { status: 400 }
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_projects")
    .update(patch)
    .eq("id", project_id);
  if (upd.error) {
    console.error("[trade-off/projects/update] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
