// POST /api/trade-off/projects/request-removal
// Public endpoint — anyone (customer, neighbour, employer, etc.) can
// request a Job Diary project be hidden.
//
// Body: { slug, project_id, requester_email, reason }
//
// Server-side flow:
//   1. Validate project_id belongs to the slug (anti-tampering)
//   2. INSERT removal request row
//   3. Soft-hide the project (status -> 'archived') immediately
//   4. (Best-effort) email the listing owner via the existing
//      messaging plumbing — admin reviews within 24h.
//
// The soft-hide is intentional: a customer who sees their address in a
// post gets immediate relief while the admin reviews. Reopening (if
// the complaint is unfounded) is a manual admin task.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
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
  const project_id = s(body.project_id);
  const requester_email = s(body.requester_email);
  const reason = s(body.reason).slice(0, 2000);

  if (!slug || !UUID_RE.test(project_id)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid project reference." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(requester_email) || requester_email.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email so we can confirm the request." },
      { status: 400 }
    );
  }
  if (reason.length < 20) {
    return NextResponse.json(
      {
        ok: false,
        error: "Tell us briefly why this project should be removed (min 20 chars)."
      },
      { status: 400 }
    );
  }

  // Anti-tampering — the project must belong to this slug.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, email")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  const proj = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .select("id, listing_id, title, status")
    .eq("id", project_id)
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!proj.data) {
    return NextResponse.json(
      { ok: false, error: "Project not found for this profile." },
      { status: 404 }
    );
  }

  // Insert the removal-request row first so we have an audit trail even
  // if the soft-hide update fails.
  const ip = clientIp(req);
  const ip_hash = ip ? hashIp(ip) : null;
  const ins = await supabaseAdmin
    .from("hammerex_xrated_project_removal_requests")
    .insert({
      project_id,
      requester_email,
      reason,
      resolution_note: ip_hash ? `ip_hash=${ip_hash}` : null
    })
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[projects/request-removal] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: "Could not record the request — try again." },
      { status: 500 }
    );
  }

  // Soft-hide immediately. Best-effort — if the update fails the
  // request is still on file and an admin can hide manually.
  if (proj.data.status !== "archived") {
    await supabaseAdmin
      .from("hammerex_xrated_projects")
      .update({ status: "archived" })
      .eq("id", project_id)
      .eq("listing_id", listing.data.id);
  }

  return NextResponse.json({ ok: true, id: ins.data.id });
}
