// Xrated Trades — premium-tier sticky footer trust bar.
//
// Lives above the global XratedFooter on paid profiles. Combines the
// social-proof signal (stars + review count) with the conversion CTA
// (WhatsApp) in a single bar so the customer's eye reads
// "Trusted → tap to message" as one motion.
//
// Behaviour:
//   - 0 reviews → left half hides the rating, shows "Brand new — be the
//     first" microcopy instead (curiosity hook, no shame).
//   - Auto-hides when the global XratedFooter scrolls into view via
//     IntersectionObserver on #xrated-footer (same pattern as the
//     landing StickyMobileLandingBar uses).
//   - Black surface with yellow accents per the user spec.

"use client";

import { useEffect, useState } from "react";

export function PremiumStickyTrust({
  ratingAvg,
  ratingCount,
  whatsappHref,
  themeColor = "#FFB300"
}: {
  ratingAvg: number | null;
  ratingCount: number;
  whatsappHref: string;
  themeColor?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const hasRating = ratingCount > 0 && typeof ratingAvg === "number" && ratingAvg > 0;
  const displayRating = hasRating ? ratingAvg!.toFixed(1) : null;
  // Round to nearest half-star for display.
  const filledStars = hasRating ? Math.round(ratingAvg!) : 0;

  useEffect(() => {
    const target =
      document.getElementById("xrated-footer") ??
      document.querySelector("footer");
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setHidden(e.isIntersecting);
      },
      { threshold: 0.05 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black shadow-[0_-8px_24px_rgba(0,0,0,0.35)] transition-transform duration-300 ${
        hidden ? "pointer-events-none translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:gap-5 sm:px-4 sm:py-3">
        {/* LEFT — trust signal block */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-extrabold uppercase tracking-[0.22em] sm:text-[10px]"
            style={{ color: themeColor }}
          >
            Trusted by customers
          </p>
          {hasRating ? (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5" aria-label={`${displayRating} stars`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg
                    key={i}
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill={i <= filledStars ? themeColor : "rgba(255,255,255,0.18)"}
                    aria-hidden="true"
                  >
                    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                  </svg>
                ))}
              </span>
              <span className="text-sm font-extrabold text-white sm:text-base">
                {displayRating}
              </span>
              <span className="text-[11px] text-white/60 sm:text-xs">
                ({ratingCount} review{ratingCount === 1 ? "" : "s"})
              </span>
            </div>
          ) : (
            <p className="mt-0.5 text-[11px] font-bold text-white/85 sm:text-xs">
              Brand new — be the first to review
            </p>
          )}
        </div>

        {/* RIGHT — WhatsApp action. Colour matches the "Available now"
            badge on the hero banner (#0F7A3F) so the page reads as a
            single trust-and-action system: same green = active /
            available / tappable. */}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.97] sm:h-12 sm:px-5 sm:text-sm"
          style={{ background: "#0F7A3F", boxShadow: "0 8px 22px rgba(15,122,63,0.55)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
          </svg>
          <span className="hidden xs:inline">Message</span>
          <span className="xs:hidden">WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
