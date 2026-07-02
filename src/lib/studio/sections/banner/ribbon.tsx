// banner.ribbon_1 — slim horizontal promo band.
//
// Full-width single-row band. Merchant sets the message, optional icon
// glyph, optional CTA link. Three visual styles (accent / dark / light-
// bordered) via a select-like boolean pair, since we don't yet have a
// proper enum editable field kind.
//
// Best pinned to the top of a page — seasonal offer, emergency
// availability, free consultation window. Not editable at the
// individual-word level (single flat message field) because merchants
// use these to shout ONE thing.

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  icon: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  style: "accent" | "dark" | "light";
};

function BannerRibbon({
  instanceId,
  config,
  tokens,
  data,
  mode
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string | undefined) ?? "#FFB300";
  const text = (tokens["color.text"] as string | undefined) ?? "#0A0A0A";
  const headingFont = tokens["font.heading"] as string | undefined;
  const bodyFont = tokens["font.body"] as string | undefined;
  const headingWeight = tokens["font.heading.weight"] as number | undefined;
  const isEditing = mode === "edit";

  const ctaHref =
    config.ctaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.ctaHref;

  const style = config.style;
  const bg =
    style === "accent" ? accent : style === "dark" ? "#0A0A0A" : "#FFFFFF";
  const fg =
    style === "accent" ? "#0A0A0A" : style === "dark" ? "#FFFFFF" : text;
  const borderTop =
    style === "light" ? "1px solid #E5E5E5" : "none";
  const borderBottom =
    style === "light" ? "1px solid #E5E5E5" : "none";
  const ctaBg =
    style === "accent" ? "#0A0A0A" : accent;
  const ctaFg =
    style === "accent" ? "#FFFFFF" : "#0A0A0A";

  return (
    <section
      className="w-full"
      style={{
        background: bg,
        color: fg,
        borderTop,
        borderBottom
      }}
      {...sectionRootAttrs(instanceId, "banner.ribbon_1", "Banner")}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3 text-center sm:px-6">
        {config.icon && (
          <span
            aria-hidden="true"
            className="text-[16px]"
            {...treeAttrs(instanceId, "icon", "Banner icon", "text")}
          >
            {config.icon}
          </span>
        )}
        {config.message && (
          <p
            className="text-[13px] leading-tight"
            style={{
              fontFamily: bodyFont,
              fontWeight: headingWeight ?? 700
            }}
            {...treeAttrs(instanceId, "message", "Banner message", "text")}
          >
            {config.message}
          </p>
        )}
        {config.ctaLabel && (
          <Link
            href={ctaHref || "#"}
            tabIndex={isEditing ? -1 : undefined}
            className="inline-flex h-8 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
            style={{ background: ctaBg, color: ctaFg, fontFamily: headingFont }}
            {...treeAttrs(instanceId, "ctaLabel", "Banner button", "button")}
          >
            {config.ctaLabel} →
          </Link>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "banner.ribbon_1",
  name: "Ribbon banner",
  version: "1.0.0",
  library: "banner",
  description:
    "Slim horizontal promo band — icon + one-line message + optional CTA. Pin to the top of a page for seasonal offers, emergency availability, or free-consultation windows. Accent / dark / light-bordered styles.",
  editableFields: [
    { key: "icon", label: "Icon glyph (optional)", type: { kind: "text", maxLength: 4 }, default: "⚡", priority: "text", description: "One emoji or symbol — leave blank for text-only.", group: "Content" },
    { key: "message", label: "Message", type: { kind: "text", maxLength: 200 }, default: "Same-day emergency callouts — WhatsApp us any time.", priority: "text", aiPromptable: true, group: "Content" },
    { key: "ctaLabel", label: "Button text (optional)", type: { kind: "text", maxLength: 24 }, default: "Message us", priority: "button", group: "Button" },
    { key: "ctaHref", label: "Button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#whatsapp", description: 'Use "#whatsapp" for WhatsApp.', group: "Button" },
    { key: "style", label: "Style", type: { kind: "select", options: [
      { value: "accent", label: "Accent (yellow)" },
      { value: "dark", label: "Dark (black)" },
      { value: "light", label: "Light (bordered)" }
    ] }, default: "accent", description: "Accent = highlighted; Dark = urgent; Light = calm.", group: "Style" }
  ],
  animations: ["none", "fade", "slide-down"],
  aiPrompts: {
    explain: "Explain why a slim ribbon banner works at the top of a UK trades page. Reference specific copy.",
    improve: "Improve without layout change. Message under 12 words. Button verb-first. Return only patched config.",
    rewrite: "Rewrite message in a {tone} voice.",
    suggestAlternative: "Suggest an alternative banner layout from library='banner'. One-sentence rationale.",
    score: "Score across 6 dimensions. JSON only."
  },
  thumbnail: "https://ik.imagekit.io/9mrgsv2rp/studio/thumbnails/banner-ribbon-1.png",
  scoreHints: {
    loading: { imageWeightBudgetKb: 0 },
    accessibility: { contrastMin: 4.5 },
    sales: { primaryActionRequired: false },
    seo: { headingLevel: 2 },
    mobile: { minTapTargetPx: 44 },
    brandConsistency: { boundTokens: ["color.accent", "color.text"] }
  },
  telemetryTags: ["banner", "ribbon", "one_line", "three_styles", "promo"],
  bestForVerticals: ["plumbing", "electrical", "hvac", "boiler_repair", "locksmith", "drain_clearance", "landscaping", "roofing", "joinery", "handyman"],
  defaultConfig: () => ({
    icon: "⚡",
    message: "Same-day emergency callouts — WhatsApp us any time.",
    ctaLabel: "Message us",
    ctaHref: "#whatsapp",
    style: "accent"
  }),
  renderer: BannerRibbon
};

sectionRegistry.register(registration);
