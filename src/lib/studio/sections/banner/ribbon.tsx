// banner.ribbon_1 — Phase 3 rebuild on shadcn foundation.
//
// Slim horizontal promo band pinned above the hero. Merchant sets the
// message, icon, and optional CTA link. Three visual styles.

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { cn } from "@/lib/utils";

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
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isEditing = mode === "edit";

  // Defensive fallbacks.
  const icon = typeof config.icon === "string" ? config.icon : "";
  const message = typeof config.message === "string" ? config.message : "";
  const ctaLabel = typeof config.ctaLabel === "string" ? config.ctaLabel : "";
  const rawHref = typeof config.ctaHref === "string" ? config.ctaHref : "";
  const style = config.style ?? "accent";

  if (!message) return null;

  const ctaHref =
    rawHref === "#whatsapp" && data.whatsappHref ? data.whatsappHref : rawHref;

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip border-b",
        style === "dark" && "border-white/10 bg-neutral-950 text-white",
        style === "light" && "border-border bg-background text-foreground",
        style === "accent" && "border-transparent"
      )}
      style={
        style === "accent"
          ? { background: accent, color: "#0A0A0A" }
          : undefined
      }
      {...sectionRootAttrs(instanceId, "banner.ribbon_1", "Ribbon banner")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-center sm:px-6 sm:py-2.5">
        {icon && (
          <span
            className="text-body-md"
            aria-hidden="true"
            {...treeAttrs(instanceId, "icon", "Icon", "text")}
          >
            {icon}
          </span>
        )}
        <p
          className="text-caption font-extrabold uppercase tracking-widest sm:text-body-sm"
          {...treeAttrs(instanceId, "message", "Message", "text")}
        >
          {message}
        </p>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            tabIndex={isEditing ? -1 : undefined}
            className="group inline-flex items-center gap-1 text-caption font-extrabold uppercase tracking-widest underline-offset-4 hover:underline sm:text-body-sm"
            {...treeAttrs(instanceId, "ctaLabel", "CTA", "button")}
          >
            {ctaLabel}
            <ArrowRight
              size={12}
              strokeWidth={2.5}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "banner.ribbon_1",
  name: "Ribbon banner",
  version: "2.0.0",
  library: "banner",
  description:
    "Slim horizontal promo band on shadcn foundation. Icon + message + optional CTA link. Three styles: accent (branded), dark, light-bordered.",
  editableFields: [
    { key: "icon", label: "Icon glyph", type: { kind: "text", maxLength: 4 }, default: "⚡", group: "Content" },
    { key: "message", label: "Message", type: { kind: "text", maxLength: 120 }, default: "24/7 emergency callout — reply in 45 min", priority: "text", role: "trust_line", aiPromptable: true, group: "Content" },
    { key: "ctaLabel", label: "CTA label (optional)", type: { kind: "text", maxLength: 24 }, default: "Call Now", priority: "button", group: "CTA" },
    { key: "ctaHref", label: "CTA link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "tel:0800000000", role: "primary_action_href", group: "CTA" },
    { key: "style", label: "Style", type: { kind: "select", options: [{ value: "accent", label: "Accent (branded)" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light bordered" }] }, default: "accent", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A ribbon banner. Explain when it converts vs distracts.",
    improve: "Tighten message to under 8 words. Return patched fields only.",
    rewrite: "Rewrite the message in a {tone} voice.",
    suggestAlternative: "Suggest an alternative when the message is more than one line.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: false }, seo: { headingLevel: 3 }, mobile: { minTapTargetPx: 32 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["banner", "ribbon", "promo", "shadcn"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "emergency-callout", "hvac-contractor", "roofer"],
  defaultConfig: () => ({
    icon: "⚡",
    message: "24/7 emergency callout — reply in 45 min",
    ctaLabel: "Call Now",
    ctaHref: "tel:0800000000",
    style: "accent"
  }),
  renderer: BannerRibbon
};

sectionRegistry.register(registration);
