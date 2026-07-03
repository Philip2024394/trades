// hero.split_photo_left_1 — asymmetric hero with photo left, text right.
//
// Best for merchants whose *visual* is the pitch (plant on-site,
// finished job photo, before/after) rather than the copy. Stacks on
// mobile (photo top, text bottom) — Tailwind grid handles the flip.
//
// Same renderer contract as every other section: pure React, all data
// via props, priority tags on every leaf so Modules 1-4 already work.

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
  imageUrl: string;
  imageAlt: string;
  ratingText: string;
  showRating: boolean;
};

function SplitPhotoLeftHero({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;
  const isEditing = mode === "edit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;

  return (
    <section
      className="w-full"
      style={{ background: surface }}
      {...sectionRootAttrs(
        instanceId,
        "hero.split_photo_left_1",
        "Split-photo hero"
      )}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-16">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100">
          {config.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.imageUrl}
              alt={config.imageAlt || ""}
              className="absolute inset-0 h-full w-full object-contain"
              {...treeAttrs(instanceId, "imageUrl", "Photo", "image")}
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center text-[11px] font-bold uppercase tracking-widest"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "imageUrl", "Photo", "image")}
            >
              Add a job photo →
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
            >
              {config.eyebrow}
            </p>
          )}

          <h1
            className="text-3xl leading-tight sm:text-4xl lg:text-5xl"
            style={{
              color: text,
              fontFamily: headingFont,
              fontWeight: headingWeight ?? 800
            }}
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {config.heading}
          </h1>

          {config.subheading && (
            <p
              className="max-w-xl text-[14px] leading-relaxed sm:text-[16px]"
              style={{
                color: muted,
                fontFamily: bodyFont,
                fontWeight: bodyWeight ?? 500
              }}
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {config.subheading}
            </p>
          )}

          {config.primaryCtaLabel && (
            <Link
              href={primaryHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="mt-1 inline-flex h-12 w-fit items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
              style={{ background: accent, color: "#0A0A0A" }}
              {...treeAttrs(
                instanceId,
                "primaryCtaLabel",
                "Main button",
                "button"
              )}
            >
              {config.primaryCtaLabel} →
            </Link>
          )}

          {config.showRating && config.ratingText && (
            <p
              className="mt-2 text-[12px] font-bold"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "ratingText", "Rating line", "text")}
            >
              <span style={{ color: accent }}>★★★★★</span> {config.ratingText}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.split_photo_left_1",
  name: "Split photo hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Photo on the left, headline + CTA on the right. Stacks on mobile. Best for trades whose finished-job photos sell the pitch — landscaping, joinery, tiling, roofing.",
  editableFields: [
    {
      key: "eyebrow",
      label: "Small kicker",
      type: { kind: "text", maxLength: 40 },
      default: "Since 1998",
      priority: "text",
      role: "eyebrow",
      group: "Copy"
    },
    {
      key: "heading",
      label: "Main headline",
      type: { kind: "text", maxLength: 120, multiline: true },
      default: "The work speaks. The photos prove it.",
      priority: "text",
      role: "headline",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "subheading",
      label: "Supporting line",
      type: { kind: "text", maxLength: 240, multiline: true },
      default:
        "Domestic and commercial builds across the region. Every job photographed, referenced, and guaranteed for two years.",
      priority: "text",
      role: "subhead",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "primaryCtaLabel",
      label: "Button text",
      type: { kind: "text", maxLength: 24 },
      default: "See recent work",
      priority: "button",
      role: "primary_action_label",
      group: "Buttons"
    },
    {
      key: "primaryCtaHref",
      label: "Button link",
      type: { kind: "link", allowInternal: true, allowExternal: true },
      default: "/portfolio",
      role: "primary_action_href",
      description: 'Type "#whatsapp" to open WhatsApp instead.',
      group: "Buttons"
    },
    {
      key: "imageUrl",
      label: "Photo",
      type: { kind: "image", aspectRatio: "4/3", recommendedWidthPx: 1200 },
      default:
        "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
      priority: "image",
      role: "hero_media",
      description:
        "A landscape site or finished-job photo. Bright, single subject, no watermarks.",
      group: "Media"
    },
    {
      key: "imageAlt",
      label: "Photo alt text",
      type: { kind: "text", maxLength: 120 },
      default: "Recent job",
      description:
        "Short description of what's in the photo — for search engines and screen readers.",
      group: "Media"
    },
    {
      key: "showRating",
      label: "Show star rating",
      type: { kind: "boolean" },
      default: true,
      group: "Trust"
    },
    {
      key: "ratingText",
      label: "Rating text",
      type: { kind: "text", maxLength: 80 },
      default: "4.9 average · 380 verified reviews",
      priority: "text",
      role: "trust_line",
      aiPromptable: true,
      group: "Trust"
    }
  ],
  animations: ["none", "fade", "slide-up"],
  aiPrompts: {
    explain:
      "A split-photo hero for a UK trades merchant. Explain in 3 bullets what makes it work and 2 bullets on what could be tightened. Ground every claim in the specific headline, photo, or rating.",
    improve:
      "Improve this split-photo hero WITHOUT changing the layout. Tighten the sub-line if over 15 words, ensure headline reads as a claim (not a question), verify the button verb is action-first. Return only the patched config fields.",
    rewrite:
      "Rewrite the headline and sub-line in a {tone} voice. Tone options: 'trade-plain' (site voice, no fluff), 'reassuring' (safety-first), 'premium' (high-end residential). Preserve field lengths within 10 percent.",
    suggestAlternative:
      "Suggest one alternative hero from library='hero' that would fit this merchant better if their primary trade is service-heavy (plumbing, electrical, HVAC) rather than photo-heavy. One-sentence rationale.",
    score:
      "Score this hero across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency (0-100 each). Loading: check photo file size. Accessibility: alt text present, contrast pass. Sales: single primary CTA above fold, social proof visible. SEO: single H1, meaningful copy. Mobile: 44px tap target, stack layout. Brand: colours bound to tokens or hardcoded? Return JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/hero-split-photo-left-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 320 },
    accessibility: { contrastMin: 4.5, requiredAlt: ["imageUrl"] },
    sales: {
      ctaAboveFold: true,
      primaryActionRequired: true,
      socialProofRecommended: true
    },
    seo: { headingLevel: 1 },
    mobile: { minTapTargetPx: 44, noHorizontalScroll: true },
    brandConsistency: {
      boundTokens: ["color.accent", "color.surface", "color.text"]
    }
  },
  telemetryTags: [
    "hero",
    "split_layout",
    "photo_left",
    "trades",
    "photo_heavy",
    "one_cta",
    "rating"
  ],
  bestForVerticals: [
    "landscaping",
    "joinery",
    "tiling",
    "roofing",
    "kitchen_install",
    "bathroom_install"
  ],
  defaultConfig: () => ({
    eyebrow: "Since 1998",
    heading: "The work speaks. The photos prove it.",
    subheading:
      "Domestic and commercial builds across the region. Every job photographed, referenced, and guaranteed for two years.",
    primaryCtaLabel: "See recent work",
    primaryCtaHref: "/portfolio",
    imageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    imageAlt: "Recent job",
    ratingText: "4.9 average · 380 verified reviews",
    showRating: true
  }),
  renderer: SplitPhotoLeftHero
};

sectionRegistry.register(registration);
