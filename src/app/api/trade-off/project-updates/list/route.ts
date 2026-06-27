// GET /api/trade-off/project-updates/list?slug=<slug>&project_id=<id>&edit_token=<token>
// or  POST { slug, project_id, edit_token }
//
// Returns updates for a project, newest first. Auth via edit_token —
// the public surfaces SSR their own data via the supabase anon client,
// so this endpoint is dashboard-only.

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

async function handle(slug: string, token: string, project_id: string) {
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
    .select("id")
    .eq("id", project_id)
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!proj.data) {
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }

  const res = await supabaseAdmin
    .from("hammerex_xrated_project_updates")
    .select("*")
    .eq("project_id", project_id)
    .order("posted_at", { ascending: false });

  if (res.error) {
    console.error("[project-updates/list] select failed:", res.error);
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, updates: res.data ?? [] });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(
    s(url.searchParams.get("slug")),
    s(url.searchParams.get("edit_token")),
    s(url.searchParams.get("project_id"))
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  return handle(s(body.slug), s(body.edit_token), s(body.project_id));
}
