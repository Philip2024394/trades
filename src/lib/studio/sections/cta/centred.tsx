// cta.centred_1 — big centred call-to-action band.
//
// One-purpose section: force a decision. Small kicker, big headline,
// one supporting line, one primary button (optionally two), optional
// trust line under the button. Best used near the bottom of a page.

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
  showTrustLine: boolean;
  trustLine: string;
};

function CtaCentred({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const surface = (tokens["color.surface"] as string | undefined) ?? "#FFFFFF";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const muted = (tokens["color.muted"] as string | undefined) ?? "#737373";
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

  return (
    <section
      className="w-full"
      style={{ background: surface, color: text }}
      {...sectionRootAttrs(instanceId, "cta.centred_1", "Centred CTA")}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center sm:px-6 sm:py-20">
        {config.eyebrow && (
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Small kicker", "text")}
          >
            {config.eyebrow}
          </p>
        )}
        <h2
          className="text-3xl leading-tight sm:text-5xl"
          style={{ fontFamily: headingFont, fontWeight: headingWeight ?? 800 }}
          {...treeAttrs(instanceId, "heading", "Main headline", "text")}
        >
          {config.heading}
        </h2>
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
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {config.primaryCtaLabel && (
            <Link
              href={primaryHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
              style={{ background: accent, color: "#0A0A0A" }}
              {...treeAttrs(instanceId, "primaryCtaLabel", "Main button", "button")}
            >
              {config.primaryCtaLabel} →
            </Link>
          )}
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              tabIndex={isEditing ? -1 : undefined}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:bg-neutral-100"
              style={{ background: "transparent", color: text, border: `2px solid ${text}` }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Second button", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>
        {config.showTrustLine && config.trustLine && (
          <p
            className="mt-2 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "trustLine", "Trust line", "text")}
          >
            {config.trustLine}
          </p>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "cta.centred_1",
  name: "Centred CTA",
  version: "1.0.0",
  library: "cta",
  description:
    "One purpose, one action. Small kicker, big headline, sub-line, main button, optional second button. Best near the bottom of a page or between two long sections.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Ready when you are", priority: "text", group: "Copy" },
    { key: "heading", role: "headline",label: "Main headline", type: { kind: "text", maxLength: 120, multiline: true }, default: "Get a quote today.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Supporting line", type: { kind: "text", maxLength: 220, multiline: true }, default: "We reply on WhatsApp within one working hour, Monday to Saturday.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Main button text", type: { kind: "text", maxLength: 24 }, default: "WhatsApp now", priority: "button", group: "Buttons" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Main button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#whatsapp", description: 'Type "#whatsapp" for WhatsApp, "tel:0800…" for a phone.', group: "Buttons" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Second button text", type: { kind: "text", maxLength: 24 }, default: "See recent work", priority: "button", group: "Buttons" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Second button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "/portfolio", group: "Buttons" },
    { key: "showTrustLine", label: "Show trust line", type: { kind: "boolean" }, default: true, group: "Trust" },
    { key: "trustLine", label: "Trust line copy", type: { kind: "text", maxLength: 80 }, default: "Fully insured · CPA-standard · No callout fee", priority: "text", aiPromptable: true, group: "Trust" }
  ],
  animations: ["none", "fade", "slide-up"],
  aiPrompts: {
    explain: "A centred CTA. Explain in 3 bullets what makes it convert well and 2 bullets on what could be tightened. Reference the specific headline and buttons.",
    improve: "Improve this CTA without changing layout. Headline under 6 words. Sub-line one sentence. Primary CTA verb-first. Return only patched config.",
    rewrite: "Rewrite the headline + sub-line in a {tone} voice. Preserve length within 10 percent.",
    suggestAlternative: "Suggest one alternative CTA from library='cta' that would suit a photo-heavy trade merchant. One-sentence rationale.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency (0-100). JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/cta-centred-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: true, ctaAboveFold: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.surface", "color.text"] }
  },
  telemetryTags: ["cta", "centred", "typography_first", "two_cta", "trust_line"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "landscaping", "roofing", "joinery"],
  defaultConfig: () => ({
    eyebrow: "Ready when you are",
    heading: "Get a quote today.",
    subheading: "We reply on WhatsApp within one working hour, Monday to Saturday.",
    primaryCtaLabel: "WhatsApp now",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See recent work",
    secondaryCtaHref: "/portfolio",
    showTrustLine: true,
    trustLine: "Fully insured · CPA-standard · No callout fee"
  }),
  renderer: CtaCentred
};

sectionRegistry.register(registration);
