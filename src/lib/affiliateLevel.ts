// Affiliate level system. Levels are computed from the count of
// commissions in the terminal `paid` state (not pending, not
// approved, not cancelled, not refunded). recomputeAffiliateLevel()
// recounts + promotes + sends a "you levelled up" email when the
// stored level changes.
//
// Thresholds:
//   Bronze   0–4   paid referrals
//   Silver   5–19
//   Gold     20–49
//   Platinum 50+
//
// Used by:
//   * Admin commission PATCH / bulk APIs   — every paid transition
//   * Stripe webhook                       — direct status flips
//   * Dashboard overview                   — badge + progress bar
//   * Public leaderboard                   — badge column
import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

export type AffiliateLevel = "bronze" | "silver" | "gold" | "platinum";

export type LevelMeta = {
  id: AffiliateLevel;
  label: string;
  /** Inclusive lower bound of paid commissions to qualify. */
  min: number;
  /** Hex accent for badges + progress bars. */
  accent: string;
  /** One-sentence perk summary surfaced on dashboards. */
  perks: string;
};

export const LEVEL_META: Record<AffiliateLevel, LevelMeta> = {
  bronze: {
    id: "bronze",
    label: "Bronze",
    min: 0,
    accent: "#B87333",
    perks: "Standard £10 per paid referral. Access to the core marketing pack."
  },
  silver: {
    id: "silver",
    label: "Silver",
    min: 5,
    accent: "#C0C0C0",
    perks:
      "Standard payouts plus Silver-only marketing assets and priority email support."
  },
  gold: {
    id: "gold",
    label: "Gold",
    min: 20,
    accent: "#FFB300",
    perks:
      "Everything in Silver, plus Gold-only marketing creatives and white-label landing pages featured."
  },
  platinum: {
    id: "platinum",
    label: "Platinum",
    min: 50,
    accent: "#E5E4E2",
    perks:
      "Everything in Gold, plus Platinum exclusives and quarterly bonus competitions."
  }
};

export const LEVEL_ORDER: AffiliateLevel[] = [
  "bronze",
  "silver",
  "gold",
  "platinum"
];

/** Maps a count of paid commissions to its level bucket. */
export function computeLevelFromPaidCount(n: number): AffiliateLevel {
  if (n >= LEVEL_META.platinum.min) return "platinum";
  if (n >= LEVEL_META.gold.min) return "gold";
  if (n >= LEVEL_META.silver.min) return "silver";
  return "bronze";
}

/** How many MORE paid referrals are needed to hit the next level. */
export function progressToNextLevel(
  paidCount: number
): { next: AffiliateLevel | null; needed: number; percent: number } {
  const current = computeLevelFromPaidCount(paidCount);
  const idx = LEVEL_ORDER.indexOf(current);
  if (idx === LEVEL_ORDER.length - 1) {
    return { next: null, needed: 0, percent: 100 };
  }
  const next = LEVEL_ORDER[idx + 1];
  const lower = LEVEL_META[current].min;
  const upper = LEVEL_META[next].min;
  const needed = Math.max(0, upper - paidCount);
  const span = upper - lower;
  const within = paidCount - lower;
  const percent = span > 0 ? Math.min(100, Math.round((within / span) * 100)) : 0;
  return { next, needed, percent };
}

/**
 * Recount paid commissions for the affiliate, recompute the level,
 * and write back if it changed. Returns the new level and whether a
 * promotion occurred so the caller can fire a notification.
 *
 * Best-effort: errors are logged and a `bronze/false` fallback is
 * returned. Never throws — this runs from webhook + admin code paths
 * where a failure should not break the user-visible flow.
 */
export async function recomputeAffiliateLevel(
  affiliateId: number
): Promise<{ level: AffiliateLevel; promoted: boolean }> {
  try {
    const { count } = await supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", affiliateId)
      .eq("status", "paid");
    const paidCount = count ?? 0;
    const newLevel = computeLevelFromPaidCount(paidCount);

    const { data: current } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select("level, email, first_name")
      .eq("affiliate_id", affiliateId)
      .maybeSingle();
    const oldLevel = (current?.level ?? "bronze") as AffiliateLevel;

    if (newLevel === oldLevel) {
      return { level: newLevel, promoted: false };
    }

    const promoted =
      LEVEL_ORDER.indexOf(newLevel) > LEVEL_ORDER.indexOf(oldLevel);
    await supabaseAdmin
      .from("hammerex_affiliates")
      .update({
        level: newLevel,
        level_promoted_at: promoted ? new Date().toISOString() : null
      })
      .eq("affiliate_id", affiliateId);

    await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
      actor_type: "system",
      actor_id: "affiliateLevel",
      action: promoted ? "affiliate.level.promoted" : "affiliate.level.changed",
      target_id: String(affiliateId),
      details: { from: oldLevel, to: newLevel, paid_count: paidCount }
    });

    if (promoted) {
      // Fire-and-forget the promotion email. Imported lazily so we
      // can run this helper from contexts that don't already pay the
      // affiliateEmails import cost.
      try {
        const { sendLevelPromotedEmail } = await import("./affiliateEmails");
        await sendLevelPromotedEmail(
          {
            affiliate_id: affiliateId,
            email: current?.email ?? null,
            first_name: current?.first_name ?? null
          },
          newLevel
        );
      } catch (err) {
        console.error("[affiliateLevel] promotion email threw:", err);
      }
    }

    return { level: newLevel, promoted };
  } catch (err) {
    console.error("[affiliateLevel] recomputeAffiliateLevel threw:", err);
    return { level: "bronze", promoted: false };
  }
}
