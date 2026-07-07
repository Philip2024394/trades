// Feed post loader — CRUD helpers + the "auto-publish scheduled" pass.
//
// The approval buffer is implemented on read: whenever we load the
// merchant's feed, we first flip any scheduled posts whose
// scheduled_for has passed into 'published'. Cheap, correct, no cron
// required for MVP.

import { createClient } from "@supabase/supabase-js";
import type { FeedPost, FeedPostStatus } from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Row = {
  id: string;
  merchant_id: string;
  slug: string;
  headline: string;
  body_markdown: string;
  hero_image_url: string | null;
  photo_urls: string[];
  facets: Record<string, unknown>;
  cta_kind: string | null;
  cta_target: string | null;
  linked_event_id: string | null;
  linked_memory_record_id: string | null;
  status: FeedPostStatus;
  hold_reason: string | null;
  scheduled_for: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToFeedPost(row: Row): FeedPost {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    slug: row.slug,
    headline: row.headline,
    bodyMarkdown: row.body_markdown,
    heroImageUrl: row.hero_image_url,
    photoUrls: row.photo_urls ?? [],
    facets: row.facets ?? {},
    ctaKind: (row.cta_kind as FeedPost["ctaKind"]) ?? null,
    ctaTarget: row.cta_target,
    linkedEventId: row.linked_event_id,
    linkedMemoryRecordId: row.linked_memory_record_id,
    status: row.status,
    holdReason: row.hold_reason,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Auto-publish any scheduled posts whose scheduled_for has passed.
 *  Called on every feed read so the timeline is always current
 *  without needing a cron. Returns the number of posts flipped. */
export async function drainScheduled(merchantId: string): Promise<number> {
  const c = client();
  if (!c) return 0;
  const nowIso = new Date().toISOString();
  const { data } = await c
    .from("feed_posts")
    .update({ status: "published", published_at: nowIso })
    .eq("merchant_id", merchantId)
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .select("id");
  return data?.length ?? 0;
}

/** Load the merchant's published feed (public view). */
export async function loadPublishedFeed(
  merchantId: string,
  limit = 20
): Promise<FeedPost[]> {
  const c = client();
  if (!c) return [];
  await drainScheduled(merchantId);
  const { data } = await c
    .from("feed_posts")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => rowToFeedPost(r as Row));
}

/** Merchant view — includes scheduled + held so they can hold /
 *  release / archive. */
export async function loadMerchantFeed(
  merchantId: string,
  limit = 40
): Promise<FeedPost[]> {
  const c = client();
  if (!c) return [];
  await drainScheduled(merchantId);
  const { data } = await c
    .from("feed_posts")
    .select("*")
    .eq("merchant_id", merchantId)
    .neq("status", "archived")
    .order("scheduled_for", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => rowToFeedPost(r as Row));
}

export async function loadFeedPostBySlug(
  merchantId: string,
  slug: string
): Promise<FeedPost | null> {
  const c = client();
  if (!c) return null;
  await drainScheduled(merchantId);
  const { data } = await c
    .from("feed_posts")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return rowToFeedPost(data as Row);
}

export async function insertFeedPost(input: {
  merchantId: string;
  slug: string;
  headline: string;
  bodyMarkdown: string;
  heroImageUrl?: string;
  photoUrls?: string[];
  facets?: Record<string, unknown>;
  ctaKind?: FeedPost["ctaKind"];
  ctaTarget?: string;
  linkedEventId?: string;
  linkedMemoryRecordId?: string;
  scheduledMinutesFromNow?: number;
}): Promise<FeedPost | null> {
  const c = client();
  if (!c) return null;
  const scheduledFor = new Date(
    Date.now() + (input.scheduledMinutesFromNow ?? 60) * 60 * 1000
  ).toISOString();
  const { data, error } = await c
    .from("feed_posts")
    .insert({
      merchant_id: input.merchantId,
      slug: input.slug,
      headline: input.headline,
      body_markdown: input.bodyMarkdown,
      hero_image_url: input.heroImageUrl ?? null,
      photo_urls: input.photoUrls ?? [],
      facets: input.facets ?? {},
      cta_kind: input.ctaKind ?? null,
      cta_target: input.ctaTarget ?? null,
      linked_event_id: input.linkedEventId ?? null,
      linked_memory_record_id: input.linkedMemoryRecordId ?? null,
      status: "scheduled",
      scheduled_for: scheduledFor
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToFeedPost(data as Row);
}

export async function holdFeedPost(
  merchantId: string,
  postId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("feed_posts")
    .update({ status: "held", hold_reason: "merchant_paused" })
    .eq("merchant_id", merchantId)
    .eq("id", postId);
  return !error;
}

export async function releaseFeedPost(
  merchantId: string,
  postId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const nowIso = new Date().toISOString();
  const { error } = await c
    .from("feed_posts")
    .update({ status: "published", hold_reason: null, published_at: nowIso })
    .eq("merchant_id", merchantId)
    .eq("id", postId);
  return !error;
}

export async function archiveFeedPost(
  merchantId: string,
  postId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("feed_posts")
    .update({ status: "archived" })
    .eq("merchant_id", merchantId)
    .eq("id", postId);
  return !error;
}
