// Xrated Trades — "See it in action" callout for tip guides.
//
// Rendered just above the ClosingCta on each /trade-off/tips/<slug>
// page. Cross-links the article to one of the 6 lead case studies so
// readers can see the principle applied on a real, live profile.
//
// Visual: small yellow-rim card, eyebrow "Real example", title +
// arrow, links into the same tab (no target=_blank — same-site
// navigation, simpler back-button behaviour).
//
// Honest: the title/href pair is wired by the calling page from the
// LEAD_CASE_STUDIES registry — never hard-coded here.

import { XRATED_BRAND } from "@/lib/xratedTrades";

export type CaseStudyCalloutProps = {
  /** Demo-profile slug — must exist in LEAD_CASE_STUDIES. We don't
   *  resolve here so the caller stays explicit about which study
   *  pairs with which tip. */
  slug: string;
  /** Short title for the card — typically "See how <Name> <verbs>...".
   *  Keep under 70 chars so it stays single-line on mobile. */
  title: string;
  /** Subtitle — one sentence on what to look at on the profile.
   *  Optional but recommended. */
  subtitle?: string;
};

export function CaseStudyCallout({ slug, title, subtitle }: CaseStudyCalloutProps) {
  return (
    <section className="mt-12">
      <a
        href={`/trade/${slug}`}
        className="group block overflow-hidden rounded-2xl border-2 bg-white p-5 transition hover:shadow-lg sm:p-6"
        style={{ borderColor: XRATED_BRAND.accent }}
      >
        <p
          className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#7a5a00" }}
        >
          Real example
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-extrabold leading-tight text-neutral-900 sm:text-base">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-900 transition group-hover:translate-x-0.5"
            style={{ background: XRATED_BRAND.accent }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </div>
      </a>
    </section>
  );
}
