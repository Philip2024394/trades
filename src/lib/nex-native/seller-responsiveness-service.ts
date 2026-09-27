// src/lib/nex-native/seller-responsiveness-service.ts
//
// Bridge 13 · Seller responsiveness signals.
// ------------------------------------------
// Graduated activity model computed from nex_business columns:
//
//   'active'    · replied to something in the last 24h · green pulse
//   'slow'      · 24h to 7d since last activity · amber
//   'away'      · is_away=true (manual) OR > 7d inactive (automatic)
//                 · purple "🌙 Away" badge
//   'archived'  · archived_at IS NOT NULL OR > 30d inactive
//                 · gray badge · hidden from Directory search
//
// The chat surface calls markBusinessOwnerActive() after every send
// so an active seller's shop shows the green pulse in near-real
// time. The status resolver auto-archives shops crossing 30 days
// so callers never see stale rows in an intermediate state.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How the shop reads on the public landing right now. */
export type SellerActivityStatus = "active" | "slow" | "away" | "archived";

export interface SellerActivityBundle {
  status: SellerActivityStatus;
  /** Short label rendered inline (e.g. "Active", "Slow to respond"). */
  label: string;
  /** Longer sub-label rendered under the badge (e.g. "Last active 4h
   *  ago", "Back on 5 Oct"). Empty string when nothing meaningful. */
  detail: string;
  /** ISO string of the last activity · handy for tests + tooltips. */
  lastActivityAt: string;
}

/** Input shape the resolver needs · matches the subset of
 *  NexBusinessRow columns Bridge 13 cares about. Keeps this
 *  function pure + composable · callers pass whatever they have. */
export interface SellerActivityInput {
  business_id: NexUuid;
  last_seller_activity_at: NexTimestamp;
  is_away: boolean;
  away_until: NexTimestamp | null;
  away_message: string | null;
  archived_at: NexTimestamp | null;
}

/** Resolve the current activity status. Side-effect: if the row
 *  crosses the 30-day inactivity floor and archived_at is still
 *  null, this quietly writes archived_at back to the DB so the
 *  next call is a straight read. */
export async function resolveActivity(
  input: SellerActivityInput,
): Promise<SellerActivityBundle> {
  const now = Date.now();
  const lastActive = new Date(input.last_seller_activity_at).getTime();
  const ageMs = now - lastActive;

  // Already archived · manual archive OR auto-archive wrote back.
  if (input.archived_at) {
    return {
      status: "archived",
      label: "Archived",
      detail: "This shop is no longer being monitored",
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // Auto-archive when 30+ days inactive · write once and cache.
  if (ageMs > 30 * DAY_MS) {
    const stamp = new Date().toISOString();
    await nexSupabaseAdmin
      .from("nex_business")
      .update({ archived_at: stamp })
      .eq("id", input.business_id);
    return {
      status: "archived",
      label: "Archived",
      detail: "Inactive for 30+ days",
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // Manual vacation mode wins over automatic thresholds when
  // still within the away_until window (or when no window set).
  if (input.is_away) {
    const detail = input.away_until
      ? `Back on ${formatShortDate(input.away_until)}`
      : input.away_message?.trim() || "Currently away";
    return {
      status: "away",
      label: "Away",
      detail,
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // > 7d inactive · soft-away automatically. Label kept factual ·
  // buyers can still message, just with clear expectations.
  if (ageMs > 7 * DAY_MS) {
    return {
      status: "away",
      label: "Away",
      detail: `Last active ${formatAge(ageMs)} ago`,
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // > 24h · slow · amber signal.
  if (ageMs > DAY_MS) {
    return {
      status: "slow",
      label: "Slow to respond",
      detail: `Last active ${formatAge(ageMs)} ago`,
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // Fresh · green pulse.
  return {
    status: "active",
    label: "Active",
    detail:
      ageMs < HOUR_MS
        ? "Active in the last hour"
        : `Active ${formatAge(ageMs)} ago`,
    lastActivityAt: input.last_seller_activity_at,
  };
}

/** Bump last_seller_activity_at on every business owned by this
 *  account · called by peer-message-service after a successful
 *  send. Also clears archived_at because the seller is clearly
 *  back. Best-effort · logs on failure but never throws so the
 *  message send path stays clean. */
export async function markBusinessOwnerActive(
  ownerAccountId: NexUuid,
): Promise<void> {
  const stamp = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({
      last_seller_activity_at: stamp,
      archived_at: null,
    })
    .eq("owner_account_id", ownerAccountId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `seller-responsiveness.markBusinessOwnerActive soft-fail: ${error.message}`,
    );
  }
}

/** Manual vacation mode on. */
export async function setAwayMode(
  businessId: NexUuid,
  opts: {
    awayUntil?: string | null;
    awayMessage?: string | null;
  } = {},
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({
      is_away: true,
      away_until: opts.awayUntil ?? null,
      away_message: opts.awayMessage ?? null,
    })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `seller-responsiveness-service.setAwayMode: ${error.message}`,
    );
  }
}

/** Manual vacation mode off · also bumps activity so the shop
 *  snaps back to green immediately. */
export async function endAwayMode(businessId: NexUuid): Promise<void> {
  const stamp = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({
      is_away: false,
      away_until: null,
      away_message: null,
      last_seller_activity_at: stamp,
      archived_at: null,
    })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `seller-responsiveness-service.endAwayMode: ${error.message}`,
    );
  }
}

/* --------------------------------------------------------------------- *
 * Small formatters                                                       *
 * --------------------------------------------------------------------- */

function formatAge(ms: number): string {
  if (ms < HOUR_MS) return `${Math.max(1, Math.round(ms / (60 * 1000)))}m`;
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`;
  return `${Math.round(ms / DAY_MS)}d`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
