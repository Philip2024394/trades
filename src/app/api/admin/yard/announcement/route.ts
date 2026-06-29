// POST /api/admin/yard/announcement
//
// Creates a Trade Off team announcement in the Yard feed. Announcements
// are admin-authored, pinned by default, render with the yellow rim +
// "ANNOUNCEMENT" badge, and use the ADMIN_LISTING_ID sentinel UUID for
// listing_id since there's no real listing behind them.
//
// Auth: shared xrated_admin_session HMAC cookie via isAdminAuthed().
// Body: { title, body }. Markdown is allowed in body but is rendered
// verbatim — the public feed already handles plain text + URLs.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_LISTING_ID, ADMIN_DISPLAY_NAME } from "@/lib/yardAdmin";
import {
  YARD_TITLE_MAX,
  YARD_TITLE_MIN,
  YARD_BODY_MAX,
  YARD_BODY_MIN
} from "@/lib/yardPosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_EXPIRY_DAYS = 90;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = s(payload.title);
  const body = s(payload.body);
  const trade_slug = s(payload.trade_slug) || "general-builder";
  const country = s(payload.country) || "UK";
  const isPinned = payload.is_pinned === false ? false : true;

  if (title.length < YARD_TITLE_MIN || title.length > YARD_TITLE_MAX) {
    return NextResponse.json(
      {
        error: `Title must be ${YARD_TITLE_MIN}–${YARD_TITLE_MAX} chars`
      },
      { status: 400 }
    );
  }
  if (body.length < YARD_BODY_MIN || body.length > YARD_BODY_MAX) {
    return NextResponse.json(
      {
        error: `Body must be ${YARD_BODY_MIN}–${YARD_BODY_MAX} chars`
      },
      { status: 400 }
    );
  }

  // Announcements live longer than regular posts — 90 days by default,
  // since they carry policy / event notices the team wants visible
  // beyond the 14-day member window. Admin can hide/restore manually.
  const expires_at = new Date(
    Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const ins = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      listing_id: ADMIN_LISTING_ID,
      kind: "chat",
      trade_slug,
      title,
      body,
      country,
      region: null,
      is_sample: false,
      status: "live",
      is_admin_announcement: true,
      is_pinned: isPinned,
      moderation_status: "live",
      expires_at,
      metadata: { posted_by: "trade_off_team", display_name: ADMIN_DISPLAY_NAME }
    })
    .select("id")
    .single();

  if (ins.error) {
    console.error("[admin/yard/announcement] insert failed:", ins.error);
    return NextResponse.json(
      { error: `Insert failed: ${ins.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: ins.data?.id });
}
