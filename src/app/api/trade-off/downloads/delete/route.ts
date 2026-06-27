// POST /api/trade-off/downloads/delete
// Magic-link authenticated. Body: { slug, edit_token, download_id }.
// Soft delete — flips status to 'archived' so any external links to the
// public file URL keep resolving (the bucket object stays put). Hard
// delete would orphan customers who bookmarked the file.

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
  const downloadId = s(body.download_id);

  if (!slug || !token || !downloadId) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or download_id." },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(downloadId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid download id." },
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

  const upd = await supabaseAdmin
    .from("hammerex_xrated_downloads")
    .update({ status: "archived" })
    .eq("id", downloadId)
    .eq("listing_id", listing.data.id)
    .select("id")
    .maybeSingle();

  if (upd.error) {
    console.error("[trade-off/downloads/delete] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  if (!upd.data) {
    return NextResponse.json(
      { ok: false, error: "Download not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
