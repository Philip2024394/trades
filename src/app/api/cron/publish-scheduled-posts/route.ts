// GET /api/cron/publish-scheduled-posts
//
// Runs every 5 minutes (see vercel.json). Picks up rows in
// hammerex_scheduled_posts where scheduled_for <= NOW() AND
// status = 'pending', publishes each into hammerex_canteen_posts,
// and marks the row 'posted'. Yard visibility falls out for free
// since yard reads from the same table filtered by kind IN
// ('counter','showcase').
//
// Idempotent: each row moves to 'posted' after success or 'failed'
// after 3 attempts. Failed rows never retry automatically — the
// merchant sees them in the dashboard with the failure reason.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 3;

type ScheduledRow = {
  id:                 string;
  merchant_slug:      string;
  canteen_id:         string | null;
  kind:               string;
  body:               string | null;
  photo_urls:         string[] | null;
  mood_slug:          string | null;
  price_gbp:          number | null;
  target_trade_slugs: string[] | null;
  attempts:           number;
};

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function loadMerchant(slug: string): Promise<{ display_name: string; avatar_url: string | null } | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, avatar_url")
    .eq("slug", slug)
    .maybeSingle();
  return data as { display_name: string; avatar_url: string | null } | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Vercel Cron sends a Bearer token if CRON_SECRET is set.
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return unauthorized();

  const now = new Date().toISOString();

  const due = await supabaseAdmin
    .from("hammerex_scheduled_posts")
    .select("id, merchant_slug, canteen_id, kind, body, photo_urls, mood_slug, price_gbp, target_trade_slugs, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE);

  if (due.error) {
    console.error("[publish-scheduled] fetch failed:", due.error.message);
    return NextResponse.json({ ok: false, error: due.error.message }, { status: 500 });
  }

  const rows = (due.data ?? []) as ScheduledRow[];
  let posted   = 0;
  let failed   = 0;
  const perMerchant = new Map<string, { display_name: string; avatar_url: string | null } | null>();

  for (const row of rows) {
    // Bump attempts BEFORE publishing so a crash mid-publish still
    // eats the retry budget instead of pounding the same row.
    await supabaseAdmin
      .from("hammerex_scheduled_posts")
      .update({ attempts: row.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    try {
      // Look up author metadata once per merchant per batch.
      let author = perMerchant.get(row.merchant_slug);
      if (author === undefined) {
        author = await loadMerchant(row.merchant_slug);
        perMerchant.set(row.merchant_slug, author);
      }
      if (!author) throw new Error("merchant_not_found");

      const canteenId = row.canteen_id;
      if (!canteenId) throw new Error("canteen_missing");

      const insert = await supabaseAdmin
        .from("hammerex_canteen_posts")
        .insert({
          canteen_id:          canteenId,
          author_slug:         row.merchant_slug,
          author_display_name: author.display_name,
          author_avatar_url:   author.avatar_url,
          kind:                row.kind,
          body:                row.body,
          photo_urls:          row.photo_urls ?? [],
          mood_slug:           row.mood_slug,
          price_gbp:           row.price_gbp,
          target_trade_slugs:  row.target_trade_slugs ?? [],
          status:              "live"
        })
        .select("id")
        .single();

      if (insert.error || !insert.data) {
        throw new Error(insert.error?.message ?? "insert_returned_no_id");
      }

      await supabaseAdmin
        .from("hammerex_scheduled_posts")
        .update({
          status:         "posted",
          posted_at:      new Date().toISOString(),
          posted_post_id: (insert.data as { id: string }).id,
          updated_at:     new Date().toISOString()
        })
        .eq("id", row.id);
      posted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isFinal = row.attempts + 1 >= MAX_ATTEMPTS;
      await supabaseAdmin
        .from("hammerex_scheduled_posts")
        .update({
          status:         isFinal ? "failed" : "pending",
          failure_reason: message.slice(0, 500),
          updated_at:     new Date().toISOString()
        })
        .eq("id", row.id);
      if (isFinal) failed++;
    }
  }

  return NextResponse.json({ ok: true, considered: rows.length, posted, failed });
}
