// src/lib/nex-native/tier-gate.ts
//
// NEX package-tier feature gates · server-only.
// -------------------------------------------------------------------------
// Enforces the free-tier limits sealed in the Indonesia launch package
// doctrine (CLAUDE.md 2026-09-27 · design_nex_packages_indonesia_launch
// _2026_09_27.md).
//
// Every write path that should be gated calls the matching `assertCan…`
// function BEFORE hitting the DB. On limit hit, throws NexTierLimitError
// which server actions catch and redirect to a friendly upgrade CTA.
//
// Gates enforced:
//   · assertCanCreateProduct   · 10 live/draft products per business (Gratis)
//   · assertCanCreateBusiness  · 1 business per account (Gratis) · 5 (Bisnis)
//   · assertCanCreateLivePost  · 3 posts per business per 7 days (Gratis)
//   · assertCanCreateEmailSub  · 100 subscribers per list.business.owner (Gratis)
//   · assertAIReplyUnderCap    · 20 NEX Assistant replies/day (Gratis)
//   · clampAnalyticsWindow     · 7-day max window on Gratis · full on Bisnis+
//
// Reads use `effectiveTier(account)` from account-service so expired
// Bisnis subscriptions transparently fall back to Gratis limits.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { effectiveTier } from "./account-service";
import type { NexAccountRow, NexUuid } from "./types";

// ---------------------------------------------------------------------------
// Sealed tier limits · match CLAUDE.md 2026-09-27
// ---------------------------------------------------------------------------

export const NEX_GRATIS_PRODUCT_LIMIT = 10;
export const NEX_GRATIS_BUSINESS_LIMIT = 1;
export const NEX_BISNIS_BUSINESS_LIMIT = 5;
export const NEX_GRATIS_LIVE_POSTS_PER_WEEK = 3;
export const NEX_GRATIS_EMAIL_SUBSCRIBER_LIMIT = 100;
export const NEX_GRATIS_AI_REPLIES_PER_DAY = 20;
export const NEX_GRATIS_ANALYTICS_WINDOW_DAYS = 7;

/** Human-friendly upgrade CTA appended to every gate error message. */
const UPGRADE_CTA = "Upgrade to NEX Bisnis for unlimited.";

/** Thrown by any assert…-style gate function when the caller has hit
 *  their tier limit. Server actions catch this and redirect with the
 *  `code` as the error banner key. */
export class NexTierLimitError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NexTierLimitError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Internal · resolve owner tier for a business or list
// ---------------------------------------------------------------------------

async function getBusinessOwnerTier(businessId: NexUuid): Promise<{
  ownerAccountId: NexUuid;
  tier: ReturnType<typeof effectiveTier>;
} | null> {
  const biz = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", businessId)
    .maybeSingle();
  if (biz.error || !biz.data) return null;
  const ownerAccountId = (biz.data as { owner_account_id: string }).owner_account_id;
  const owner = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at")
    .eq("id", ownerAccountId)
    .maybeSingle();
  if (owner.error || !owner.data) return null;
  return {
    ownerAccountId,
    tier: effectiveTier(owner.data as Pick<NexAccountRow, "tier" | "bisnis_expires_at">),
  };
}

async function getAccountTier(accountId: NexUuid): Promise<ReturnType<typeof effectiveTier> | null> {
  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select("tier, bisnis_expires_at")
    .eq("id", accountId)
    .maybeSingle();
  if (row.error || !row.data) return null;
  return effectiveTier(row.data as Pick<NexAccountRow, "tier" | "bisnis_expires_at">);
}

// ---------------------------------------------------------------------------
// Product cap · 10 live-or-draft products per business on Gratis
// ---------------------------------------------------------------------------

export async function assertCanCreateProduct(businessId: NexUuid): Promise<void> {
  const info = await getBusinessOwnerTier(businessId);
  if (!info || info.tier !== "gratis") return;
  const { count, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["live", "draft"]);
  if (error) return; // fail open on count-check error · don't block real users
  if ((count ?? 0) >= NEX_GRATIS_PRODUCT_LIMIT) {
    throw new NexTierLimitError(
      "product_cap_gratis",
      `NEX Gratis is limited to ${NEX_GRATIS_PRODUCT_LIMIT} live or draft products. ${UPGRADE_CTA}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Business cap · 1 business per Gratis account · 5 per Bisnis
// ---------------------------------------------------------------------------

export async function assertCanCreateBusiness(ownerAccountId: NexUuid): Promise<void> {
  const tier = await getAccountTier(ownerAccountId);
  if (tier === null) return;
  const limit =
    tier === "gratis" ? NEX_GRATIS_BUSINESS_LIMIT : NEX_BISNIS_BUSINESS_LIMIT;
  const { count, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*", { count: "exact", head: true })
    .eq("owner_account_id", ownerAccountId);
  if (error) return; // fail open
  if ((count ?? 0) >= limit) {
    if (tier === "gratis") {
      throw new NexTierLimitError(
        "business_cap_gratis",
        `NEX Gratis is limited to ${NEX_GRATIS_BUSINESS_LIMIT} business. ${UPGRADE_CTA}`,
      );
    }
    throw new NexTierLimitError(
      "business_cap_bisnis",
      `NEX Bisnis is limited to ${NEX_BISNIS_BUSINESS_LIMIT} businesses. Contact NEX to discuss a Pro plan.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Live post cap · 3 per business per rolling 7 days on Gratis
// ---------------------------------------------------------------------------

export async function assertCanCreateLivePost(businessId: NexUuid): Promise<void> {
  const info = await getBusinessOwnerTier(businessId);
  if (!info || info.tier !== "gratis") return;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await nexSupabaseAdmin
    .from("nex_live_post")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", sevenDaysAgo);
  if (error) return;
  if ((count ?? 0) >= NEX_GRATIS_LIVE_POSTS_PER_WEEK) {
    throw new NexTierLimitError(
      "live_post_cap_gratis",
      `NEX Gratis is limited to ${NEX_GRATIS_LIVE_POSTS_PER_WEEK} live posts every 7 days. ${UPGRADE_CTA}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Email subscriber cap · 100 per business (owner Gratis)
// ---------------------------------------------------------------------------

export async function assertCanCreateEmailSubscriber(listId: NexUuid): Promise<void> {
  const list = await nexSupabaseAdmin
    .from("nex_email_list")
    .select("business_id")
    .eq("id", listId)
    .maybeSingle();
  if (list.error || !list.data) return;
  const businessId = (list.data as { business_id: string }).business_id;
  const info = await getBusinessOwnerTier(businessId);
  if (!info || info.tier !== "gratis") return;

  // Count subscribers across ALL lists for this business (per-business
  // pool, not per-list · matches the doctrine wording).
  const listsForBiz = await nexSupabaseAdmin
    .from("nex_email_list")
    .select("id")
    .eq("business_id", businessId);
  if (listsForBiz.error) return;
  const listIds = ((listsForBiz.data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (listIds.length === 0) return;
  const { count, error } = await nexSupabaseAdmin
    .from("nex_email_subscriber")
    .select("*", { count: "exact", head: true })
    .in("list_id", listIds);
  if (error) return;
  if ((count ?? 0) >= NEX_GRATIS_EMAIL_SUBSCRIBER_LIMIT) {
    throw new NexTierLimitError(
      "email_subscriber_cap_gratis",
      `NEX Gratis is limited to ${NEX_GRATIS_EMAIL_SUBSCRIBER_LIMIT} email subscribers per business. ${UPGRADE_CTA}`,
    );
  }
}

// ---------------------------------------------------------------------------
// AI reply cap · 20 NEX Assistant replies per account per calendar day
// ---------------------------------------------------------------------------

export async function assertAIReplyUnderCap(accountId: NexUuid): Promise<void> {
  const tier = await getAccountTier(accountId);
  if (tier === null || tier !== "gratis") return;
  // Count nex_generation_job rows requested by this account in the
  // current UTC calendar day. Simple heuristic · a persistent counter
  // column would be nicer but adds schema; this is fine for MVP.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await nexSupabaseAdmin
    .from("nex_generation_job")
    .select("*", { count: "exact", head: true })
    .eq("requester_account_id", accountId)
    .gte("created_at", startOfDay.toISOString());
  if (error) return;
  if ((count ?? 0) >= NEX_GRATIS_AI_REPLIES_PER_DAY) {
    throw new NexTierLimitError(
      "ai_reply_cap_gratis",
      `NEX Gratis is limited to ${NEX_GRATIS_AI_REPLIES_PER_DAY} NEX Assistant replies per day. ${UPGRADE_CTA}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Analytics window · clamp to 7 days on Gratis · pass through on Bisnis+
// ---------------------------------------------------------------------------

/** Returns the effective number of days the analytics query should
 *  actually cover. Gratis accounts get at most 7 days of window
 *  regardless of what they request. Non-Gratis accounts get whatever
 *  they asked for. Non-throwing: reads pass through with a smaller
 *  window instead of failing hard. */
export async function clampAnalyticsWindow(
  ownerAccountId: NexUuid,
  requestedDays: number,
): Promise<number> {
  const tier = await getAccountTier(ownerAccountId);
  if (tier === "gratis") {
    return Math.min(requestedDays, NEX_GRATIS_ANALYTICS_WINDOW_DAYS);
  }
  return requestedDays;
}
