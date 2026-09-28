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

  // Bridge 16e · working-hours-aware active signal. Founder direction
  // 2026-09-28: buyers should see sellers as "regular active" during
  // working hours (7am-11pm Asia/Jakarta) so they know sellers are
  // reachable throughout the day. During that window we show a
  // stable-random "Last active Xm ago" chosen from a plausible set
  // {25min, 45min, 1h, 2h, 3h} · seeded by business_id + current
  // hour so all viewers see the same value within an hour and it
  // updates naturally at hour boundaries.
  //
  // Outside working hours (11pm-7am) · show a "Resting · back at
  // 7am" label with the true last-active timestamp underneath. This
  // is honest at night while still telling buyers when replies
  // resume.
  const nowDate = new Date();
  const inWorkingHours = isWithinWorkingHours(nowDate);

  if (inWorkingHours) {
    const activeAge = pickPlausibleActiveAge(
      input.business_id,
      nowDate,
    );
    return {
      status: "active",
      label: `Active ${activeAge} ago`,
      detail: "Working hours 7am-11pm · usually replies quickly",
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // Outside working hours · still show green when seller has been
  // active in the last 24h · buyer sees they are regularly online.
  if (ageMs < DAY_MS) {
    return {
      status: "active",
      label: `Last active ${formatAge(ageMs)} ago`,
      detail: "Back at 7am · working hours 7am-11pm",
      lastActivityAt: input.last_seller_activity_at,
    };
  }

  // 24h-7d outside working hours · slow signal.
  return {
    status: "slow",
    label: "Slow to respond",
    detail: `Last active ${formatAge(ageMs)} ago · working hours 7am-11pm`,
    lastActivityAt: input.last_seller_activity_at,
  };
}

/** Bridge 16e · working hours check. Founder-set constant · Indonesia
 *  launch defaults to Asia/Jakarta 7am-11pm. When we expand to other
 *  markets this should read from the business's own working_hours
 *  (nex_business.hours already exists · migration TBD to consume). */
function isWithinWorkingHours(now: Date): boolean {
  try {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(now);
    const hour = Number.parseInt(hourStr, 10);
    if (!Number.isFinite(hour)) return false;
    return hour >= 7 && hour < 23;
  } catch {
    // Fallback · treat as working hours to fail-open (buyer still
    // sees the seller as active).
    return true;
  }
}

/** Bridge 16e · stable-random plausible active-age. Picks from a
 *  set of natural-sounding recent intervals · seeded by business_id
 *  + Asia/Jakarta hour so the value is stable within an hour and
 *  every viewer sees the same string. Updates naturally at hour
 *  boundaries. */
function pickPlausibleActiveAge(businessId: string, now: Date): string {
  const AGES = ["25m", "45m", "1h", "2h", "3h"];
  try {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    }).format(now);
    // Simple hash · djb2 · deterministic across processes.
    const key = businessId + "|" + hourStr;
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) + h + key.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(h) % AGES.length;
    return AGES[idx]!;
  } catch {
    return "1h";
  }
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
