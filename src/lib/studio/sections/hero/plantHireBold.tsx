// hero.plant_hire_bold_1 — first registered section.
//
// Bold trade-vertical hero for UK plant hire / tool hire / building
// merchants. Serves as the reference implementation proving the
// Section Registry contract works end-to-end.
//
// The renderer is a pure React component: receives fully-resolved
// props, renders JSX, no I/O. Works in server and client bundles
// identically.

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
  backgroundImageUrl: string;
  overlayOpacity: number;
  showTrustBadge: boolean;
  trustBadgeText: string;
};

function PlantHireBoldHero({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const bg = (tokens["color.surface"] as string | undefined) ?? "#0A0A0A";
  const overlay = Math.max(0, Math.min(1, config.overlayOpacity));
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const bodyWeight = tokens["font.body.weight"] as number | undefined;

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const isEditing = mode === "edit";

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, minHeight: 380 }}
      {...sectionRootAttrs(instanceId, "hero.plant_hire_bold_1", "Bold trade hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.6}) 0%, rgba(0,0,0,${overlay}) 100%)`
        }}
      />

      <div className="mx-auto flex max-w-6xl flex-col justify-center gap-5 px-4 py-14 text-white sm:px-6 sm:py-20">
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
          className="max-w-3xl text-3xl leading-tight sm:text-5xl"
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
            className="max-w-2xl text-[14px] leading-relaxed text-white/80 sm:text-[16px]"
            style={{
              fontFamily: bodyFont,
              fontWeight: bodyWeight ?? 500
            }}
            {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
          >
            {config.subheading}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-3">
          {config.primaryCtaLabel && (
            <Link
              href={primaryHref || "#"}
              className="inline-flex h-12 items-center rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
              style={{ background: accent, color: "#0A0A0A" }}
              tabIndex={isEditing ? -1 : undefined}
              {...treeAttrs(instanceId, "primaryCtaLabel", "Main button", "button")}
            >
              {config.primaryCtaLabel} →
            </Link>
          )}
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
              style={{ background: "#25D366" }}
              tabIndex={isEditing ? -1 : undefined}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Second button", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>

        {config.showTrustBadge && config.trustBadgeText && (
          <p
            className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/50"
            {...treeAttrs(instanceId, "trustBadgeText", "Trust line", "text")}
          >
            {config.trustBadgeText}
          </p>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.plant_hire_bold_1",
  name: "Bold trade hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Full-bleed dark hero with eyebrow, big headline, subhead, two CTAs and a small trust badge. Best for merchants selling into UK construction / trades where credibility beats decoration.",
  editableFields: [
    {
      key: "eyebrow",
      label: "Small kicker",
      type: { kind: "text", maxLength: 40 },
      default: "Plant hire",
      priority: "text",
      role: "eyebrow",
      description: "The uppercase line above the headline. Keep it short.",
      group: "Copy"
    },
    {
      key: "heading",
      label: "Main headline",
      type: { kind: "text", maxLength: 120, multiline: true },
      default: "Every Machine You Need. On Your Site.",
      priority: "text",
      role: "headline",
      aiPromptable: true,
      description: "The largest text on the page. Under 8 words reads best.",
      group: "Copy"
    },
    {
      key: "subheading",
      label: "Supporting line",
      type: { kind: "text", maxLength: 240, multiline: true },
      default:
        "0.8T micro digger to 14T excavator. CPA-standard machines, 24/7 breakdown line, delivered same day locally.",
      priority: "text",
      role: "subhead",
      aiPromptable: true,
      group: "Copy"
    },
    {
      key: "primaryCtaLabel",
      label: "Main button text",
      type: { kind: "text", maxLength: 24 },
      default: "See the fleet",
      priority: "button",
      role: "primary_action_label",
      group: "Buttons"
    },
    {
      key: "primaryCtaHref",
      label: "Main button link",
      type: { kind: "link", allowInternal: true, allowExternal: true },
      default: "/plant-hire/machines",
      role: "primary_action_href",
      description: 'Type "#whatsapp" to open WhatsApp instead of a link.',
      group: "Buttons"
    },
    {
      key: "secondaryCtaLabel",
      label: "Second button text",
      type: { kind: "text", maxLength: 24 },
      default: "WhatsApp quote",
      priority: "button",
      role: "secondary_action_label",
      group: "Buttons"
    },
    {
      key: "secondaryCtaHref",
      label: "Second button link",
      type: { kind: "link", allowInternal: true, allowExternal: true },
      default: "#whatsapp",
      role: "secondary_action_href",
      group: "Buttons"
    },
    {
      key: "backgroundImageUrl",
      label: "Background photo",
      type: {
        kind: "image",
        aspectRatio: "16/9",
        recommendedWidthPx: 1920
      },
      default: "",
      priority: "image",
      role: "background_media",
      description:
        "A landscape site photo works best. Leave empty for a solid brand-colour hero.",
      group: "Media"
    },
    {
      key: "overlayOpacity",
      label: "Photo darkness",
      type: { kind: "number", min: 0, max: 1, step: 0.05 },
      default: 0.55,
      role: "opacity",
      description:
        "Darken the photo so the white text stays readable. 0 = clear photo, 1 = fully dark.",
      group: "Media"
    },
    {
      key: "showTrustBadge",
      label: "Show trust line",
      type: { kind: "boolean" },
      default: true,
      group: "Trust"
    },
    {
      key: "trustBadgeText",
      label: "Trust line copy",
      type: { kind: "text", maxLength: 80 },
      default: "CPA-standard · 24/7 breakdown · Insured",
      priority: "text",
      role: "trust_line",
      aiPromptable: true,
      group: "Trust"
    }
  ],
  animations: ["none", "fade", "slide-up", "zoom-photo"],
  aiPrompts: {
    explain:
      "You're looking at a plant-hire hero for a UK trades merchant. Explain in 3 short bullets what makes it work and 2 bullets on what could be improved. Ground every claim in the specific headline, buttons, or photo — never generic advice.",
    improve:
      "Improve this plant-hire hero without changing the layout. Preserve headline strength, tighten the sub-line if it's over 15 words, and ensure the primary CTA verb is action-first ('Hire', 'Book', 'See'). Return only the patched config fields, not prose.",
    rewrite:
      "Rewrite the headline and sub-line in a {tone} voice. Tone options: 'trade-plain' (UK site voice, no marketing fluff), 'reassuring' (safety-first), 'premium' (fleet + heritage). Preserve the field lengths within 10 percent.",
    suggestAlternative:
      "The merchant may want a different hero from the same Library. Suggest one alternative section id (from library='hero') that would fit a UK plant-hire merchant better if their business is heavy plant + haulage rather than tool hire. Explain in one sentence.",
    score:
      "Score this hero across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency (each 0–100). Loading: check photo weight budget. Accessibility: check contrast against overlay. Sales: check CTA above the fold. SEO: single H1, meaningful copy. Mobile: 44px tap targets. Brand: are colours bound to brand tokens or hard-coded? Return JSON only."
  },
  thumbnail:
    "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/hero-plant-hire-bold-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 240 },
    accessibility: { contrastMin: 4.5, requiredAlt: ["backgroundImageUrl"] },
    sales: {
      ctaAboveFold: true,
      primaryActionRequired: true,
      socialProofRecommended: true
    },
    seo: { headingLevel: 1 },
    mobile: { minTapTargetPx: 44, noHorizontalScroll: true },
    brandConsistency: {
      boundTokens: ["color.accent", "color.surface"]
    }
  },
  telemetryTags: [
    "hero",
    "trade_vertical",
    "uk_trades",
    "plant_hire",
    "dark",
    "photo_bg",
    "two_cta",
    "trust_line"
  ],
  bestForVerticals: [
    "plant_hire",
    "tool_hire",
    "building_merchant",
    "scaffolding"
  ],
  defaultConfig: () => ({
    eyebrow: "Plant hire",
    heading: "Every Machine You Need. On Your Site.",
    subheading:
      "0.8T micro digger to 14T excavator. CPA-standard machines, 24/7 breakdown line, delivered same day locally.",
    primaryCtaLabel: "See the fleet",
    primaryCtaHref: "/plant-hire/machines",
    secondaryCtaLabel: "WhatsApp quote",
    secondaryCtaHref: "#whatsapp",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    overlayOpacity: 0,
    showTrustBadge: true,
    trustBadgeText: "CPA-standard · 24/7 breakdown · Insured"
  }),
  renderer: PlantHireBoldHero
};

sectionRegistry.register(registration);
