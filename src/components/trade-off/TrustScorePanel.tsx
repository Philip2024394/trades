// Dashboard "Build your Trust Score" panel.
//
// Shows the tradesperson their live Trust Score (0-100) with:
//   - Large circular gauge (matches the SVG ring on the public profile)
//   - 8-item checklist showing which points are earned vs available
//   - Tip line per unearned item with the action the tradesperson can take
//
// Server component — pure render from a Listing record. No client state.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { getTrustScore, getTrustScoreItems, getTrustScoreBand, getFreeTierMaxScore } from "@/lib/trustScore";

export function TrustScorePanel({
  listing,
  tier = "paid"
}: {
  listing: HammerexTradeOffListing;
  /** When "free", the gauge denominator drops to the free-tier max and
   *  paid-only items show a 🔒 PAID chip + upgrade CTA instead of being
   *  greyed out as missed points. */
  tier?: "free" | "paid";
}) {
  const score = getTrustScore(listing);
  const items = getTrustScoreItems(listing);
  const band = getTrustScoreBand(score);
  const earnedCount = items.filter((i) => i.earned).length;
  // Free tier's denominator is its actual ceiling so "32/32" reads as
  // "you've maxed out the free tier" instead of "32/100 — failure".
  const isFree = tier === "free";
  const freeMax = getFreeTierMaxScore();
  const denominator = isFree ? freeMax : 100;
  const displayScore = isFree ? Math.min(score, freeMax) : score;
  // Recompute the "earn more" target against the right ceiling so the
  // headline number reflects the tier's reality.
  const totalUnearnedFree = items
    .filter((i) => !i.earned && !i.paidOnly)
    .reduce((sum, i) => sum + (i.points - i.pointsEarned), 0);
  const totalUnearnedPaid = items
    .filter((i) => !i.earned)
    .reduce((sum, i) => sum + (i.points - i.pointsEarned), 0);
  const totalUnearned = isFree ? totalUnearnedFree : totalUnearnedPaid;
  // Points still locked behind upgrade (only shown to free users).
  const lockedByPaid = items
    .filter((i) => i.paidOnly && !i.earned)
    .reduce((sum, i) => sum + i.points, 0);

  // SVG gauge geometry — circumference 2π × 46 ≈ 289 in a 100-unit
  // viewBox. dashoffset paints the unfilled portion at the END so the
  // start point sits at 12 o'clock (because of -rotate-90).
  const ringCircumference = 2 * Math.PI * 46;
  const ringDashOffset = ringCircumference * (1 - displayScore / denominator);

  return (
    <section className="mx-auto max-w-3xl px-4 pb-6">
      <div
        className="overflow-hidden rounded-3xl border border-brand-line bg-brand-surface p-5 sm:p-6"
        style={{ background: "#0A0A0A" }}
      >
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Gauge */}
          <div className="relative h-24 w-24 shrink-0 sm:h-32 sm:w-32">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#FFB300"
                strokeWidth="6"
                strokeDasharray={ringCircumference.toFixed(2)}
                strokeDashoffset={ringDashOffset.toFixed(2)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="text-3xl font-extrabold leading-none sm:text-4xl" style={{ color: "#FFB300" }}>
                {displayScore}
              </span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-[11px]">
                / {denominator}
              </span>
            </div>
          </div>

          {/* Headline + status */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: "#FFB300" }}>
              {isFree ? "Free tier · Trust Score" : "Your Trust Score"}
            </p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight text-white sm:text-2xl">
              {isFree ? `Free max: ${freeMax}` : band.label}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/70 sm:text-sm">
              {totalUnearned > 0
                ? `${earnedCount} of 8 trust signals earned. Add ${totalUnearned} more free-tier points to top up your gauge.`
                : isFree
                  ? `You're maxed out for free tier. Upgrade to unlock ${lockedByPaid} more points.`
                  : `You're maxed out — exceptional.`}
            </p>
            {isFree && lockedByPaid > 0 && (
              <p className="mt-1 text-xs leading-relaxed text-white/55">
                <span className="font-bold text-white">+{lockedByPaid} more points</span> are locked behind paid features — upgrade to reach 100.
              </p>
            )}
          </div>
        </div>

        {/* 8-item checklist */}
        <ul className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5">
          {items.map((item) => {
            const partial = !item.earned && item.pointsEarned > 0;
            // On free tier, paid-only items get a distinct "🔒 PAID"
            // treatment so the user reads them as upgrade opportunities,
            // not failures.
            const lockedForFree = isFree && item.paidOnly && !item.earned;
            return (
              <li
                key={item.key}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                style={lockedForFree ? { background: "rgba(255,179,0,0.06)", borderColor: "rgba(255,179,0,0.25)" } : undefined}
              >
                {/* Status circle */}
                <span
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: item.earned
                      ? "#FFB300"
                      : lockedForFree
                        ? "rgba(255,179,0,0.18)"
                        : partial
                          ? "rgba(255,179,0,0.25)"
                          : "rgba(255,255,255,0.08)"
                  }}
                  aria-hidden="true"
                >
                  {item.earned ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : lockedForFree ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-extrabold text-white/40">
                      {item.points - item.pointsEarned}
                    </span>
                  )}
                </span>
                {/* Label + tip */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className={`text-xs font-bold sm:text-sm ${item.earned ? "text-white" : "text-white/85"}`}>
                      {item.label}
                    </p>
                    {lockedForFree ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider sm:text-[10px]"
                        style={{ background: "#FFB300", color: "#0A0A0A" }}
                      >
                        🔒 Paid · +{item.points}
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider sm:text-[10px]"
                        style={{
                          background: item.earned ? "rgba(255,179,0,0.18)" : "rgba(255,255,255,0.08)",
                          color: item.earned ? "#FFB300" : "rgba(255,255,255,0.55)"
                        }}
                      >
                        {item.earned ? `+${item.points} earned` : partial ? `+${item.pointsEarned}/${item.points}` : `+${item.points}`}
                      </span>
                    )}
                  </div>
                  {item.tip && !item.earned && (
                    <p className="mt-1 text-[11px] leading-relaxed text-white/60 sm:text-xs">
                      {item.tip}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {isFree && lockedByPaid > 0 && (
          <a
            href="/trade-off/pricing"
            className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
            style={{ background: "#FFB300", boxShadow: "0 8px 24px rgba(255,179,0,0.45)" }}
          >
            Upgrade to unlock {lockedByPaid} more points
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
        )}

        {/* Footer note — links to marketing page so the tradesperson
            can see what the score looks like to a customer. */}
        <p className="mt-4 text-[11px] leading-relaxed text-white/55">
          Your score updates the moment you save a change in any section
          below. Customers see your number on your public profile —{" "}
          <a href="/trade-off/trust" className="font-bold underline-offset-2 hover:underline" style={{ color: "#FFB300" }}>
            see how the gauge appears →
          </a>
        </p>
      </div>
    </section>
  );
}
