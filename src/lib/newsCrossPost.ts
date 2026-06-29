// Newsroom → Yard cross-poster.
//
// When a /news post goes live, we drop an admin-authored announcement
// into hammerex_trade_off_yard_posts so members can react + comment.
// The yard row carries metadata.news_post_id so we can find it later
// to hide it when the news post is archived.
//
// Why this lives in lib (not the admin API route): the helper is
// idempotent and self-contained, mirroring src/lib/yardWelcome.ts —
// the API route stays narrowly about CRUD, and a future "resend
// announcement" surface can call createYardCrossPost(...) directly.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_LISTING_ID, ADMIN_DISPLAY_NAME } from "@/lib/yardAdmin";

// 30-day yard lifespan for the cross-post — matches the welcome-message
// expiry rhythm. After 30 days the news piece still lives at
// /news/<slug>; the yard echo just rolls off the recent-chat feed.
const YARD_EXPIRY_DAYS = 30;

const PUBLIC_BASE = "https://xratedtrade.com";

export type NewsPostLite = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
};

export type CreateYardCrossPostResult =
  | { ok: true; created: true; yardPostId: string }
  | { ok: true; created: false; reason: "exists" | "missing" }
  | { ok: false; reason: string };

/**
 * Insert (idempotent) a Yard cross-post for the given news post.
 *
 *  - listing_id = ADMIN_LISTING_ID (sentinel — not a real listing)
 *  - kind = 'chat'
 *  - is_admin_announcement = true, is_pinned = false
 *  - moderation_status = 'live'
 *  - metadata.news_post_id = newsPost.id (used for archive / re-sync)
 *
 * On success, also updates the news row's `yard_post_id` so the admin
 * UI can show "✓ cross-posted to Yard" without re-querying.
 */
export async function createYardCrossPost(
  newsPost: NewsPostLite
): Promise<CreateYardCrossPostResult> {
  if (!newsPost?.id) {
    return { ok: false, reason: "missing-news-id" };
  }

  // Idempotency — bail if we already wired a yard row for this news id.
  const existing = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id")
    .eq("is_admin_announcement", true)
    .eq("listing_id", ADMIN_LISTING_ID)
    .contains("metadata", { news_post_id: newsPost.id })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    return { ok: true, created: false, reason: "exists" };
  }

  const title = `📰 Newsroom: ${newsPost.title}`;
  const url = `${PUBLIC_BASE}/news/${newsPost.slug}`;
  const bodyLines = [
    `📰 New from the Newsroom: ${newsPost.title}`,
    "",
    newsPost.excerpt ?? "",
    "",
    `Read the full piece: ${url}`
  ];

  const expires_at = new Date(
    Date.now() + YARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const ins = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      listing_id: ADMIN_LISTING_ID,
      kind: "chat",
      trade_slug: "general-builder",
      title,
      body: bodyLines.join("\n"),
      country: "UK",
      region: null,
      is_sample: false,
      status: "live",
      is_admin_announcement: true,
      is_pinned: false,
      moderation_status: "live",
      expires_at,
      metadata: {
        posted_by: "trade_off_team",
        display_name: ADMIN_DISPLAY_NAME,
        type: "news_announcement",
        news_post_id: newsPost.id,
        news_slug: newsPost.slug
      }
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) {
    console.error("[newsCrossPost] insert failed:", ins.error);
    return { ok: false, reason: ins.error?.message ?? "insert-failed" };
  }

  // Persist the link back on the news row so admins can see the
  // cross-post status without a separate query.
  const upd = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .update({ yard_post_id: ins.data.id })
    .eq("id", newsPost.id);

  if (upd.error) {
    console.error(
      "[newsCrossPost] news.yard_post_id back-link failed:",
      upd.error
    );
    // Non-fatal — the yard row exists, we just couldn't stamp the link.
  }

  return { ok: true, created: true, yardPostId: ins.data.id };
}

/**
 * Hide the yard cross-post when the news post is archived/deleted.
 * Sets moderation_status='hidden' so the yard feed quietly drops it.
 */
export async function hideYardCrossPost(newsPostId: string): Promise<void> {
  if (!newsPostId) return;
  const { error } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update({ moderation_status: "hidden" })
    .eq("is_admin_announcement", true)
    .eq("listing_id", ADMIN_LISTING_ID)
    .contains("metadata", { news_post_id: newsPostId });
  if (error) {
    console.error("[newsCrossPost] hideYardCrossPost failed:", error);
  }
}
