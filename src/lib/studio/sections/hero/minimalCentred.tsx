// hero.minimal_centred_1 — no photo, no ornament, centred typography.
//
// Best for service-heavy trades whose value is *what they do*, not
// what it looks like: plumbers, electricians, HVAC engineers,
// glaziers, locksmiths. Loads instantly (no photo weight), always
// perfect on mobile (single column by construction), converts well
// because there's nothing to distract from the CTA.

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
  showTrustRow: boolean;
  trustItems: string; // comma-separated, e.g. "Insured, Gas Safe, 24/7 callout"
};

function MinimalCentredHero({
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
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const trustList = config.trustItems
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(
        instanceId,
        "hero.minimal_centred_1",
        "Minimal centred hero"
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        {config.eyebrow && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
          >
            {config.eyebrow}
          </p>
        )}

        <h1
          className="text-4xl leading-[1.05] sm:text-6xl"
          style={{
            fontFamily: headingFont,
            fontWeight: headingWeight ?? 800
          }}
          {...treeAttrs(instanceId, "heading", "Main headline", "text")}
        >
          {config.heading}
        </h1>

        {config.subheading && (
          <p
            className="max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
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

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {config.primaryCtaLabel && (
            <Link
              href={primaryHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
              style={{ background: accent, color: "#0A0A0A" }}
              {...treeAttrs(
                instanceId,
                "primaryCtaLabel",
                "Main button",
                "button"
              )}
            >
              {config.primaryCtaLabel}
            </Link>
          )}
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:bg-neutral-100"
              style={{ background: "transparent", color: text, border: `2px solid ${text}` }}
              {...treeAttrs(
                instanceId,
                "secondaryCtaLabel",
                "Second button",
                "button"
              )}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>

        {config.showTrustRow && trustList.length > 0 && (
          <ul
            className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] font-bold"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "trustItems", "Trust row", "text")}
          >
            {trustList.map((item, i) => (
              <li key={i} className="inline-flex items-center gap-1.5">
                <span style={{ color: accent }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.minimal_centred_1",
  name: "Minimal centred hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Photo-free, typography-first hero. Two CTAs, optional trust row. Fastest to load and reads perfectly on any screen — best for service trades where speed matters (emergency call-outs, plumbing, electrical).",
  editableFields: [
    {
      key: "eyebrow",
      label: "Small kicker",
      type: { kind: "text", maxLength: 40 },
      default: "Local · Insured · Same-day",
      priority: "text",
      group: "Copy"
    },
    {
      key: "heading",
      label: "Main headline",
      type: { kind: "text", maxLength: 120, multiline: true },
      default: "Broken? We'll be there today.",
      priority: "text",
      aiPromptable: true,
      description: "Under 8 words. State the outcome, not the service.",
      group: "Copy"
    },
    {
      key: "subheading",
      label: "Supporting line",
      type: { kind: "text", maxLength: 240, multiline: true },
      default:
        "Same-day emergency call-outs across the region. Fully qualified, £5M public liability, no call-out fee if we can't fix it.",
      priority: "text",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "primaryCtaLabel",
      label: "Main button text",
      type: { kind: "text", maxLength: 24 },
      default: "Call now",
      priority: "button",
      group: "Buttons"
    },
    {
      key: "primaryCtaHref",
      label: "Main button link",
      type: { kind: "link", allowInternal: true, allowExternal: true },
      default: "#whatsapp",
      description: 'Use "#whatsapp" for WhatsApp, "tel:0800…" for a phone.',
      group: "Buttons"
    },
    {
      key: "secondaryCtaLabel",
      label: "Second button text",
      type: { kind: "text", maxLength: 24 },
      default: "Get a quote",
      priority: "button",
      group: "Buttons"
    },
    {
      key: "secondaryCtaHref",
      label: "Second button link",
      type: { kind: "link", allowInternal: true, allowExternal: true },
      default: "/quote",
      group: "Buttons"
    },
    {
      key: "showTrustRow",
      label: "Show trust row",
      type: { kind: "boolean" },
      default: true,
      group: "Trust"
    },
    {
      key: "trustItems",
      label: "Trust items (comma-separated)",
      type: { kind: "text", maxLength: 200 },
      default: "Fully insured, Gas Safe, 24/7 callout, No callout fee",
      priority: "text",
      aiPromptable: true,
      description:
        "3-5 items. Comma-separated. Renders as a row of ticked credentials.",
      group: "Trust"
    }
  ],
  animations: ["none", "fade", "slide-up"],
  aiPrompts: {
    explain:
      "A minimal centred hero for a UK service trade. Explain in 3 bullets what makes it work (typography-first, fast load, mobile-perfect) and 2 bullets on what would tighten conversion further. Reference the specific headline and trust items.",
    improve:
      "Improve this hero without changing the layout. Headline under 8 words. Sub-line: lead with the outcome not the service. Trust items: pick 3-5 concrete credentials, not fluff. Return only the patched config fields.",
    rewrite:
      "Rewrite the headline and sub-line in a {tone} voice. Tone options: 'urgent' (emergency response), 'reassuring' (insured, guaranteed), 'trade-plain' (site voice). Preserve field lengths within 10 percent.",
    suggestAlternative:
      "Suggest one alternative hero from library='hero' that would work better if this merchant is photo-heavy (finished residential jobs, portfolio-driven). One-sentence rationale.",
    score:
      "Score this hero across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency (0-100). Loading: near-perfect (no images). Accessibility: contrast pass, semantic H1. Sales: two CTAs above fold, trust row present. SEO: single H1, meaningful. Mobile: 44px targets. Brand: bound to tokens? Return JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/hero-minimal-centred-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: {
      ctaAboveFold: true,
      primaryActionRequired: true,
      socialProofRecommended: true
    },
    seo: { headingLevel: 1 },
    mobile: { minTapTargetPx: 44, noHorizontalScroll: true },
    brandConsistency: {
      boundTokens: ["color.accent", "color.text", "color.surface"]
    }
  },
  telemetryTags: [
    "hero",
    "minimal",
    "centred",
    "typography_first",
    "no_photo",
    "two_cta",
    "trust_row",
    "fast_load"
  ],
  bestForVerticals: [
    "plumbing",
    "electrical",
    "hvac",
    "glazing",
    "locksmith",
    "boiler_repair",
    "drain_clearance"
  ],
  defaultConfig: () => ({
    eyebrow: "Local · Insured · Same-day",
    heading: "Broken? We'll be there today.",
    subheading:
      "Same-day emergency call-outs across the region. Fully qualified, £5M public liability, no call-out fee if we can't fix it.",
    primaryCtaLabel: "Call now",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "Get a quote",
    secondaryCtaHref: "/quote",
    showTrustRow: true,
    trustItems: "Fully insured, Gas Safe, 24/7 callout, No callout fee"
  }),
  renderer: MinimalCentredHero
};

sectionRegistry.register(registration);
