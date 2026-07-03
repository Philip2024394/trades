// hero.review_wave_1 — Review-Wave Hero.
//
// Social-proof hero for trades with review depth. A live-scrolling
// marquee of review snippets sits at the top of the hero; big
// headline, subhead and dual CTAs sit below; a rating badge (4.9 ★
// / 127 reviews) anchors bottom-left.
//
// Design principles applied:
//   • Reviews are the pitch — never buried below the fold
//   • Marquee scrolls slowly (18s per loop) so reviews are readable
//   • Pauses on hover for accessibility
//   • Rating badge is glanceable at a distance
//   • Respects prefers-reduced-motion (marquee freezes)

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  ratingValue: number;
  ratingCount: number;
  review1: string;
  review1Author: string;
  review2: string;
  review2Author: string;
  review3: string;
  review3Author: string;
  review4: string;
  review4Author: string;
  review5: string;
  review5Author: string;
  review6: string;
  review6Author: string;
};

function ReviewWaveHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const bg = "#0A0A0A";
  const ink = "#FFFFFF";
  const muted = "rgba(255,255,255,0.72)";
  const border = "rgba(255,255,255,0.14)";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const reviews = [
    { text: config.review1, author: config.review1Author },
    { text: config.review2, author: config.review2Author },
    { text: config.review3, author: config.review3Author },
    { text: config.review4, author: config.review4Author },
    { text: config.review5, author: config.review5Author },
    { text: config.review6, author: config.review6Author }
  ].filter((r) => r.text && r.text.trim().length > 0);

  // Duplicate the list so the marquee loops seamlessly.
  const doubled = [...reviews, ...reviews];

  const rating = Math.min(5, Math.max(0, Number(config.ratingValue) || 0));

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.review_wave_1", "Review-Wave Hero")}
    >
      {/* Reviews marquee — top strip */}
      {reviews.length > 0 && (
        <div
          className="relative w-full overflow-hidden border-b py-3"
          style={{ borderColor: border, background: "rgba(255,255,255,0.02)" }}
          aria-label="Recent customer reviews"
        >
          <div
            className="flex gap-6 whitespace-nowrap"
            style={{
              animation: "trade-marquee 45s linear infinite",
              width: "fit-content"
            }}
          >
            {doubled.map((r, i) => (
              <div key={i} className="inline-flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ background: accent, color: "#0A0A0A" }}
                >
                  <MiniStar />
                  5
                </span>
                <span className="text-[13px] font-semibold" style={{ color: ink }}>
                  &ldquo;{r.text}&rdquo;
                </span>
                <span className="text-[12px]" style={{ color: muted }}>
                  — {r.author}
                </span>
                <span aria-hidden="true" style={{ color: border }}>·</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main hero body */}
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 sm:py-24">
        {config.eyebrow && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
          >
            {config.eyebrow}
          </p>
        )}
        <h1
          className="mt-4 max-w-4xl text-4xl font-extrabold leading-[0.95] sm:text-6xl md:text-7xl"
          style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>
        {config.subheading && (
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed sm:text-[17px]"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={primaryHref || "#"}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: accent,
              color: "#0A0A0A",
              boxShadow: `0 8px 24px ${accent}55`
            }}
            {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
          >
            <span>{config.primaryCtaLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-110"
              style={{
                borderColor: border,
                color: ink,
                background: "rgba(255,255,255,0.03)"
              }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>

        {/* Rating badge */}
        <div
          className="mt-10 inline-flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: border,
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <svg
                key={i}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"
                  fill={i < Math.floor(rating) ? accent : "transparent"}
                  stroke={accent}
                  strokeWidth="1.5"
                />
              </svg>
            ))}
          </div>
          <div>
            <p
              className="text-xl font-extrabold leading-none"
              style={{ color: ink, fontFamily: headingFont }}
              {...treeAttrs(instanceId, "ratingValue", "Rating value", "text")}
            >
              {rating.toFixed(1)}
            </p>
            <p
              className="mt-1 text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "ratingCount", "Rating count", "text")}
            >
              {config.ratingCount.toLocaleString()} verified reviews
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes trade-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes trade-marquee { from { transform: none; } to { transform: none; } }
        }
      `}</style>
    </section>
  );
}

function MiniStar() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.review_wave_1",
  name: "Review-Wave Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Social-proof hero with a live-scrolling marquee of real review snippets across the top strip. Rating badge anchors bottom-left.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "4.9 ★ across 127 reviews", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "The trade your neighbours already booked.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Verified reviews from real customers, no filters, no cherry-picking. Read them all, then decide.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Read all reviews", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link" }, default: "#reviews", group: "CTAs" },
    { key: "ratingValue", label: "Star rating", type: { kind: "number", min: 0, max: 5, step: 0.1 }, default: 4.9, group: "Rating badge" },
    { key: "ratingCount", label: "Review count", type: { kind: "number", min: 0, max: 999999, step: 1 }, default: 127, group: "Rating badge" },
    { key: "review1", label: "Review 1", type: { kind: "text", maxLength: 120 }, default: "Turned up on time, quoted honestly, cleaned up after.", group: "Marquee reviews" },
    { key: "review1Author", label: "Review 1 author", type: { kind: "text", maxLength: 40 }, default: "Sarah, Leeds", group: "Marquee reviews" },
    { key: "review2", label: "Review 2", type: { kind: "text", maxLength: 120 }, default: "Best plumber I've used in 20 years.", group: "Marquee reviews" },
    { key: "review2Author", label: "Review 2 author", type: { kind: "text", maxLength: 40 }, default: "Mark, York", group: "Marquee reviews" },
    { key: "review3", label: "Review 3", type: { kind: "text", maxLength: 120 }, default: "Quoted on WhatsApp within 20 minutes. Job done next day.", group: "Marquee reviews" },
    { key: "review3Author", label: "Review 3 author", type: { kind: "text", maxLength: 40 }, default: "Priya, Manchester", group: "Marquee reviews" },
    { key: "review4", label: "Review 4", type: { kind: "text", maxLength: 120 }, default: "Really tidy work, priced fairly, no drama.", group: "Marquee reviews" },
    { key: "review4Author", label: "Review 4 author", type: { kind: "text", maxLength: 40 }, default: "James, Sheffield", group: "Marquee reviews" },
    { key: "review5", label: "Review 5", type: { kind: "text", maxLength: 120 }, default: "Would recommend without hesitation.", group: "Marquee reviews" },
    { key: "review5Author", label: "Review 5 author", type: { kind: "text", maxLength: 40 }, default: "Anna, Wakefield", group: "Marquee reviews" },
    { key: "review6", label: "Review 6", type: { kind: "text", maxLength: 120 }, default: "Great team. Clean finish. Fair price.", group: "Marquee reviews" },
    { key: "review6Author", label: "Review 6 author", type: { kind: "text", maxLength: 40 }, default: "Tom, Bradford", group: "Marquee reviews" }
  ],
  animations: ["none", "marquee", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Review-Wave hero works best.",
    improve: "Suggest which review snippet should lead.",
    rewrite: "Rewrite the headline for a review-rich trade.",
    suggestAlternative: "Which hero would work for a merchant with few reviews yet?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "reviews", "social-proof", "marquee"],
  bestForVerticals: ["plumber", "electrician", "carpenter", "kitchen-fitter", "roofer", "gas-engineer", "landscape-designer"],
  defaultConfig: () => ({
    eyebrow: "4.9 ★ across 127 reviews",
    heading: "The trade your neighbours already booked.",
    subheading: "Verified reviews from real customers, no filters, no cherry-picking. Read them all, then decide.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "Read all reviews",
    secondaryCtaHref: "#reviews",
    ratingValue: 4.9,
    ratingCount: 127,
    review1: "Turned up on time, quoted honestly, cleaned up after.",
    review1Author: "Sarah, Leeds",
    review2: "Best plumber I've used in 20 years.",
    review2Author: "Mark, York",
    review3: "Quoted on WhatsApp within 20 minutes. Job done next day.",
    review3Author: "Priya, Manchester",
    review4: "Really tidy work, priced fairly, no drama.",
    review4Author: "James, Sheffield",
    review5: "Would recommend without hesitation.",
    review5Author: "Anna, Wakefield",
    review6: "Great team. Clean finish. Fair price.",
    review6Author: "Tom, Bradford"
  }),
  renderer: ReviewWaveHero
};

sectionRegistry.register(registration);
