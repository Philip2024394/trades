// cta.compact_band_1 — Phase 2 retrofit on shadcn foundation.
//
// High-contrast CTA band matching the mockup's red band section.
// Filled variant = solid accent surface (theme colour); outlined =
// bordered card on the surface. shadcn Button + Framer Motion Reveal
// + platform typography scale.

"use client";

import Link from "next/link";
import { Phone, ArrowRight, MessageCircle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

type Config = {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
  ctaIcon: string;
  variant: "filled" | "outlined";
};

const CTA_ICONS: Record<string, LucideIcon> = {
  phone: Phone,
  arrow: ArrowRight,
  message: MessageCircle,
  clock: Clock
};

function CtaCompactBandSection({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";

  // Defensive fallbacks.
  const heading =
    (typeof config.heading === "string" && config.heading) || "Need Help Today?";
  const subheading =
    typeof config.subheading === "string" ? config.subheading : "";
  const ctaLabel =
    typeof config.ctaLabel === "string" && config.ctaLabel
      ? config.ctaLabel
      : "Contact us";
  const ctaIconKey =
    typeof config.ctaIcon === "string" ? config.ctaIcon : "phone";
  const variant = config.variant === "outlined" ? "outlined" : "filled";

  const ctaHref =
    config.ctaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : (typeof config.ctaHref === "string" && config.ctaHref) || "#contact";

  const CtaIcon = CTA_ICONS[ctaIconKey] ?? Phone;
  const isFilled = variant === "filled";

  return (
    <section
      className={cn(
        "relative w-full overflow-x-clip",
        !isFilled && "bg-background text-foreground"
      )}
      style={
        isFilled ? { background: accent, color: "#0A0A0A" } : undefined
      }
      {...sectionRootAttrs(
        instanceId,
        "cta.compact_band_1",
        "Compact CTA band"
      )}
    >
      <div
        className={cn(
          isFilled
            ? "mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6 sm:py-14"
            : "mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"
        )}
      >
        {isFilled ? (
          <>
            <Reveal>
              <h2
                className="text-display-sm font-extrabold sm:text-display-md lg:text-display-lg"
                {...treeAttrs(instanceId, "heading", "Heading", "text")}
              >
                {heading}
              </h2>
            </Reveal>
            {subheading && (
              <Reveal delay={0.08}>
                <p
                  className="max-w-xl text-body-md sm:text-body-lg"
                  style={{ color: "rgba(10,10,10,0.72)" }}
                  {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
                >
                  {subheading}
                </p>
              </Reveal>
            )}
            <Reveal delay={0.16}>
              <Button
                asChild
                size="xl"
                className="group mt-2"
                style={{
                  background: "#0A0A0A",
                  color: "#FFFFFF",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
                }}
              >
                <Link
                  href={ctaHref}
                  {...treeAttrs(instanceId, "ctaLabel", "CTA", "button")}
                >
                  <CtaIcon strokeWidth={2.5} aria-hidden="true" />
                  <span>{ctaLabel}</span>
                  <ArrowRight
                    strokeWidth={2.5}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </Reveal>
          </>
        ) : (
          <Reveal>
            <div
              className="flex flex-col items-center gap-4 rounded-2xl border-2 p-6 text-center sm:p-10"
              style={{
                borderColor: accent,
                background: `${accent}08`
              }}
            >
              <h2
                className="text-display-sm font-extrabold sm:text-display-md"
                {...treeAttrs(instanceId, "heading", "Heading", "text")}
              >
                {heading}
              </h2>
              {subheading && (
                <p
                  className="max-w-xl text-body-md text-muted-foreground sm:text-body-lg"
                  {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
                >
                  {subheading}
                </p>
              )}
              <Button
                asChild
                size="xl"
                className="group mt-1"
                style={{
                  background: accent,
                  color: "#0A0A0A",
                  boxShadow: `0 8px 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.5)`
                }}
              >
                <Link
                  href={ctaHref}
                  {...treeAttrs(instanceId, "ctaLabel", "CTA", "button")}
                >
                  <CtaIcon strokeWidth={2.5} aria-hidden="true" />
                  <span>{ctaLabel}</span>
                  <ArrowRight
                    strokeWidth={2.5}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "cta.compact_band_1",
  name: "Compact CTA band",
  version: "2.0.0",
  library: "cta",
  description:
    "Compact accent-tinted CTA band on shadcn Button + Framer Motion. Filled variant = solid accent surface matching the mockup's red band; outlined = soft bordered card.",
  editableFields: [
    { key: "heading", label: "Heading", type: { kind: "text", maxLength: 60 }, default: "Need Help Today?", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 140, multiline: true }, default: "We're here to help. Get in touch.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "ctaLabel", label: "Button label", type: { kind: "text", maxLength: 24 }, default: "Call Now", priority: "button", role: "primary_action_label", group: "Button" },
    { key: "ctaHref", label: "Button link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "tel:0800000000", role: "primary_action_href", description: 'Type "#whatsapp" for WhatsApp, "tel:0…" for a phone number.', group: "Button" },
    { key: "ctaIcon", label: "Button icon", type: { kind: "select", options: [{ value: "phone", label: "Phone" }, { value: "message", label: "Message" }, { value: "arrow", label: "Arrow only" }, { value: "clock", label: "Clock" }] }, default: "phone", group: "Button" },
    { key: "variant", label: "Style", type: { kind: "select", options: [{ value: "filled", label: "Filled band" }, { value: "outlined", label: "Outlined card" }] }, default: "filled", group: "Layout" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A compact CTA band. Explain when filled beats outlined.",
    improve: "Tighten heading + subheading. Return patched fields only.",
    rewrite: "Rewrite heading + subheading in a {tone} voice, preserving field length.",
    suggestAlternative: "Suggest an alternative when the merchant wants a longer sales narrative.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true, ctaAboveFold: false }, seo: { headingLevel: 2 }, mobile: { minTapTargetPx: 48 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["cta", "band", "compact", "high_contrast", "shadcn", "framer_motion"],
  bestForVerticals: ["electrician", "plumber", "gas-engineer", "emergency-callout", "hvac-contractor", "locksmith"],
  defaultConfig: () => ({
    heading: "Need Help Today?",
    subheading: "We're here to help. Get in touch.",
    ctaLabel: "Call Now",
    ctaHref: "tel:0800000000",
    ctaIcon: "phone",
    variant: "filled"
  }),
  renderer: CtaCompactBandSection
};

sectionRegistry.register(registration);
