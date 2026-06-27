// POST /api/trade-off/projects/upsert
// Magic-link authenticated. Body: { slug, edit_token, project: { id?, ... } }.
// When `id` is present, UPDATE WHERE listing_id matches (cross-listing
// tamper guard). Otherwise INSERT — but only if the listing has fewer
// than 20 live projects already.
//
// privacy_disclaimer_confirmed_at is a hard NOT NULL gate at the table
// level; the API requires the client to send `privacy_confirmed: true`
// on create (which we translate into a server-side timestamp so a
// leaked token can't backdate the disclaimer).
//
// This is the Job Diary "projects" namespace — separate from the
// existing /api/trade-off/projects/{create,update,delete} routes
// which handle the older portfolio "before/during/after" projects.

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

function nonNegInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
  const projectIn = (body.project && typeof body.project === "object"
    ? body.project
    : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
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

  const title = s(projectIn.title);
  if (title.length < 3 || title.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Title must be 3–80 characters." },
      { status: 400 }
    );
  }
  const location_label = s(projectIn.location_label);
  if (location_label.length < 2 || location_label.length > 60) {
    return NextResponse.json(
      { ok: false, error: "Location must be 2–60 characters." },
      { status: 400 }
    );
  }
  const cover_image_url = s(projectIn.cover_image_url).slice(0, 600);
  if (!cover_image_url) {
    return NextResponse.json(
      { ok: false, error: "Upload a cover photo first." },
      { status: 400 }
    );
  }

  const estimated_complete_at = isoOrNull(projectIn.estimated_complete_at);
  const sort_order = nonNegInt(projectIn.sort_order);

  const idRaw = s(projectIn.id);

  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid project id." },
        { status: 400 }
      );
    }
    // Update path — never mutate privacy_disclaimer_confirmed_at,
    // status, completed_at, or final_summary here. Those flow
    // through the dedicated close / reopen / removal endpoints.
    const patch = {
      title,
      location_label,
      cover_image_url,
      estimated_complete_at,
      sort_order
    };
    const upd = await supabaseAdmin
      .from("hammerex_xrated_projects")
      .update(patch)
      .eq("id", idRaw)
      .eq("listing_id", listing.data.id)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[projects/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "Project not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, project: upd.data });
  }

  // INSERT path — enforce per-listing live cap + privacy disclaimer.
  const privacy_confirmed = projectIn.privacy_confirmed === true;
  if (!privacy_confirmed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Confirm the privacy checklist before starting a project: no faces, no addresses, customer agreed."
      },
      { status: 400 }
    );
  }

  const countRes = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listing.data.id)
    .eq("status", "live");
  if (countRes.error) {
    console.error("[projects/upsert] count failed:", countRes.error);
    return NextResponse.json(
      { ok: false, error: countRes.error.message },
      { status: 500 }
    );
  }
  if ((countRes.count ?? 0) >= MAX_LIVE_PER_LISTING) {
    return NextResponse.json(
      {
        ok: false,
        error: `You already have ${MAX_LIVE_PER_LISTING} live projects. Close one first.`
      },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .insert({
      listing_id: listing.data.id,
      title,
      location_label,
      cover_image_url,
      estimated_complete_at,
      sort_order,
      status: "live",
      privacy_disclaimer_confirmed_at: new Date().toISOString()
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[projects/upsert] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, project: ins.data });
}
