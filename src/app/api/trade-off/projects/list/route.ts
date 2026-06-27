// GET /api/trade-off/projects/list?slug=<slug>&edit_token=<token>
// or  POST { slug, edit_token }
//
// Dashboard list — returns ALL projects (live + completed + archived)
// for the listing, newest-first. Auth via edit_token.
//
// Public list (no edit_token) is served directly by the page server
// components — we don't expose a public JSON endpoint here because the
// SSR'd pages give us better SEO + per-project OG images.

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

async function handle(slug: string, token: string) {
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

  const res = await supabaseAdmin
    .from("hammerex_xrated_projects")
    .select("*")
    .eq("listing_id", listing.data.id)
    .order("status", { ascending: true })
    .order("started_at", { ascending: false });

  if (res.error) {
    console.error("[projects/list] select failed:", res.error);
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  // Per-project update counts so the dashboard can render "X updates"
  // pills without an N+1.
  const ids = (res.data ?? []).map((p) => p.id as string);
  let countsByProject: Record<string, number> = {};
  if (ids.length > 0) {
    const ur = await supabaseAdmin
      .from("hammerex_xrated_project_updates")
      .select("project_id")
      .in("project_id", ids);
    if (ur.data) {
      countsByProject = (ur.data as { project_id: string }[]).reduce<
        Record<string, number>
      >((acc, row) => {
        acc[row.project_id] = (acc[row.project_id] ?? 0) + 1;
        return acc;
      }, {});
    }
  }

  return NextResponse.json({
    ok: true,
    projects: res.data ?? [],
    update_counts: countsByProject
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(
    s(url.searchParams.get("slug")),
    s(url.searchParams.get("edit_token"))
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  return handle(s(body.slug), s(body.edit_token));
}
