// Trust profile — composed from what Trade OS actually stores.
//
// Four signals (each weighted, null-safe):
//   • reviews      — average star rating × log(count)
//   • completions  — count of hammerex_sitebook_members rows with
//                    status = 'complete'
//   • reliability  — % of network reviews with owner_response_body
//   • tenure       — years since listing.created_at (cap 5 years)
//
// Null-scored signals are excluded, not zeroed. Nothing fabricated.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type TrustProfile, type TrustSignal } from "./types";

const DAY_MS = 86_400_000;

const BANDS: Array<{ min: number; band: TrustProfile["band"] }> = [
  { min: 90, band: "excellent" },
  { min: 75, band: "healthy" },
  { min: 60, band: "steady" },
  { min: 40, band: "attention" },
  { min:  0, band: "critical" }
];

export function bandFor(score: number): TrustProfile["band"] {
  for (const b of BANDS) if (score >= b.min) return b.band;
  return "critical";
}

export type BuildTrustInput = {
  merchantSlug:      string;
  merchantListingId?: string;    // for the completions signal
  now?:              Date;
};

export async function buildTrustProfile(opts: BuildTrustInput): Promise<TrustProfile> {
  const now = opts.now ?? new Date();
  const evidence = evidenceFor(
    "hammerex_network_reviews + hammerex_sitebook_members + hammerex_trade_off_listings",
    ["hammerex_network_reviews", "hammerex_sitebook_members", "hammerex_trade_off_listings"]
  );

  const [listing, reviews, completions] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, display_name, created_at")
      .eq("slug", opts.merchantSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_network_reviews")
      .select("overall_score, owner_response_body")
      .eq("merchant_slug", opts.merchantSlug)
      .eq("status", "live"),
    opts.merchantListingId
      ? supabaseAdmin
          .from("hammerex_sitebook_members")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", opts.merchantListingId)
          .eq("status", "complete")
      : Promise.resolve({ count: null })
  ]);

  const display = String(listing.data?.display_name ?? opts.merchantSlug);
  const reviewRows = reviews.data ?? [];

  // Signal: reviews.
  const reviewsSignal = signalReviews(reviewRows);
  // Signal: completions.
  const completionsSignal = signalCompletions(completions.count ?? null);
  // Signal: reliability — % of reviews owner has replied to.
  const reliabilitySignal = signalReliability(reviewRows);
  // Signal: tenure.
  const tenureSignal = signalTenure((listing.data?.created_at as string | null) ?? null, now);

  const parts = [reviewsSignal, completionsSignal, reliabilitySignal, tenureSignal];
  const weightSum = parts.reduce((s, p) => s + (p.score === null ? 0 : p.weight), 0);
  const valueSum  = parts.reduce((s, p) => s + (p.score === null ? 0 : p.weight * p.score), 0);
  const overall = weightSum === 0 ? 0 : Math.max(0, Math.min(100, Math.round(valueSum / weightSum)));

  return {
    slug:            opts.merchantSlug,
    display_name:    display,
    overall_score:   overall,
    band:            bandFor(overall),
    signals: {
      reviews:     reviewsSignal,
      completions: completionsSignal,
      reliability: reliabilitySignal,
      tenure:      tenureSignal
    },
    evidence
  };
}

// ─── Signal builders ──────────────────────────────────────────

function signalReviews(rows: Array<{ overall_score: number | null | string | undefined }>): TrustSignal {
  const count = rows.length;
  if (count === 0) return { score: null, weight: 2, note: "No reviews on file yet." };
  const avg = rows.reduce((s, r) => s + Number(r.overall_score ?? 0), 0) / count;
  // Map 1..5 stars to 0..100. Weight review count using log so more
  // reviews raises confidence without dominating.
  const starScore = Math.round(Math.max(0, (avg - 1) / 4) * 100);
  const countWeight = Math.min(1, Math.log10(count + 1) / 1.5);   // saturates ~30 reviews
  const score = Math.round(starScore * (0.6 + 0.4 * countWeight));
  return { score, weight: 2, note: `${count} live review${count === 1 ? "" : "s"}, avg ${avg.toFixed(1)}★.` };
}

function signalCompletions(count: number | null): TrustSignal {
  if (count === null) return { score: null, weight: 1.5, note: "Completion history not available." };
  if (count === 0)    return { score: 40,   weight: 1.5, note: "No completed projects on the platform yet." };
  // Saturate at 20 completions.
  const score = Math.min(100, Math.round(50 + count * 3));
  return { score, weight: 1.5, note: `${count} project${count === 1 ? "" : "s"} completed on the platform.` };
}

function signalReliability(rows: Array<{ owner_response_body: string | null }>): TrustSignal {
  if (rows.length === 0) return { score: null, weight: 1, note: "Not enough reviews to score reply behaviour." };
  const replied = rows.filter((r) => (r.owner_response_body ?? "").trim().length > 0).length;
  const pct = Math.round((replied / rows.length) * 100);
  const score = Math.round(Math.max(20, Math.min(100, 40 + pct * 0.6)));
  return { score, weight: 1, note: `Owner has replied to ${replied} of ${rows.length} reviews (${pct}%).` };
}

function signalTenure(createdAt: string | null, now: Date): TrustSignal {
  if (!createdAt) return { score: null, weight: 0.5, note: "Listing creation date unknown." };
  const years = (now.getTime() - new Date(createdAt).getTime()) / DAY_MS / 365;
  const clamped = Math.max(0, Math.min(5, years));
  const score = Math.round(60 + (clamped / 5) * 30);   // 60 → 90 across 5 years
  return { score, weight: 0.5, note: `Listing has been on the platform for ${years.toFixed(1)} year${years.toFixed(1) === "1.0" ? "" : "s"}.` };
}
