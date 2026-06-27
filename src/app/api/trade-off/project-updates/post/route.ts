// POST /api/trade-off/project-updates/post
// Body: { slug, edit_token, update: { project_id, status_chip, image_urls?, note?, shared_platforms? } }
//
// Posts a new update on a Job Diary project. Caps:
//   * 30 updates per project (blocked once hit)
//   * 4 images per update (CHECK constraint at the DB level)
//   * 280 chars on the note
//
// status_chip is the 8-value controlled enum. shared_platforms is a
// fire-and-forget intent marker the editor sends after the Web Share
// API sheet completes (best-effort — empty array is fine).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_UPDATES_PER_PROJECT = 30;
const STATUS_CHIPS = new Set([
  "on_track",
  "stage_complete",
  "inspection_passed",
  "weather_delay",
  "materials_delay",
  "scope_change",
  "snagging",
  "completed"
]);
const SHARE_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "whatsapp",
  "linkedin",
  "copy_link",
  "native_share"
]);

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
  const updateIn = (body.update && typeof body.update === "object"
    ? body.update
    : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const project_id = s(updateIn.project_id);
  if (!UUID_RE.test(project_id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid project id." },
      { status: 400 }
    );
  }

  const status_chip = s(updateIn.status_chip);
  if (!STATUS_CHIPS.has(status_chip)) {
    return NextResponse.json(
      { ok: false, error: "Pick a status chip." },
      { status: 400 }
    );
  }

  const image_urls = Array.isArray(updateIn.image_urls)
    ? (updateIn.image_urls as unknown[])
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .slice(0, 4)
    : [];

  const noteRaw = s(updateIn.note).slice(0, 280);
  const note = noteRaw.length > 0 ? noteRaw : null;

  if (!note && image_urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Add a photo or a note before posting." },
      { status: 400 }
    );
  }

  const shared_platforms = Array.isArray(updateIn.shared_platforms)
    ? (updateIn.shared_platforms as unknown[])
        .filter(
          (p): p is string =>
            typeof p === "string" && SHARE_PLATFORMS.has(p.toLowerCase().trim())
        )
        .map((p) => p.toLowerCase().trim())
        .slice(0, 8)
    : [];

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

  // Confirm the project belongs to this listing AND is live.
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
  if (proj.data.status !== "live") {
    return NextResponse.json(
      {
        ok: false,
        error: "Reopen the project before posting another update."
      },
      { status: 400 }
    );
  }

  // Per-project update cap — count existing rows.
  const countRes = await supabaseAdmin
    .from("hammerex_xrated_project_updates")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project_id);
  if ((countRes.count ?? 0) >= MAX_UPDATES_PER_PROJECT) {
    return NextResponse.json(
      {
        ok: false,
        error: `Project is full — ${MAX_UPDATES_PER_PROJECT} updates max. Close it to archive.`
      },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_project_updates")
    .insert({
      project_id,
      status_chip,
      image_urls,
      note,
      shared_platforms
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[project-updates/post] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Post failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, update: ins.data });
}

// PATCH — update shared_platforms after the Web Share sheet returns.
// Fire-and-forget from the client; we don't return the row.
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const update_id = s(body.update_id);
  const platforms = Array.isArray(body.shared_platforms)
    ? (body.shared_platforms as unknown[])
        .filter(
          (p): p is string =>
            typeof p === "string" && SHARE_PLATFORMS.has(p.toLowerCase().trim())
        )
        .map((p) => p.toLowerCase().trim())
        .slice(0, 8)
    : [];

  if (!slug || !token || !UUID_RE.test(update_id)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) return NextResponse.json({ ok: false }, { status: 404 });
  if (!constantTimeEq(listing.data.edit_token, token))
    return NextResponse.json({ ok: false }, { status: 403 });

  // Verify the update belongs to a project belonging to the listing.
  const upd = await supabaseAdmin
    .from("hammerex_xrated_project_updates")
    .select("id, project_id, hammerex_xrated_projects!inner(listing_id)")
    .eq("id", update_id)
    .maybeSingle();
  // Cross-listing tamper guard is done via the join's listing_id; if
  // Supabase REST returns a row at all here we know the join held.
  // We still re-query the project explicitly for safety.
  const proj = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .select("id")
    .eq("id", (upd.data as { project_id?: string } | null)?.project_id ?? "")
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!proj.data) return NextResponse.json({ ok: false }, { status: 404 });

  await supabaseAdmin
    .from("hammerex_xrated_project_updates")
    .update({ shared_platforms: platforms })
    .eq("id", update_id);

  return NextResponse.json({ ok: true });
}
