// hero.emergency_247_1 — Phase 3 rebuild on shadcn foundation.
//
// High-conversion hero for reactive trades. Panicking customer at 2am
// with one thumb, cracked screen. Massive Call Now button, pulsing
// response-time chip, dark surface with urgent-colour glow.
// shadcn Button + Badge + Framer Motion Reveal. Typography scale.
// Defensive fallbacks.

"use client";

import Link from "next/link";
import { Phone, MessageCircle, MapPin, AlertCircle } from "lucide-react";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { GridPattern } from "@/components/magicui/grid-pattern";
import { cn } from "@/lib/utils";

/** Emergency hero is dark + already loaded with an urgency glow. The
 *  Magic UI addition is a subtle grid pattern for that "engineered
 *  precision" feel — no aurora option (would fight the urgency glow). */
type VisualEffect = "none" | "grid";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  callPhoneNumber: string;
  callCtaLabel: string;
  whatsappCtaLabel: string;
  responseTime: string;
  responseTimeLabel: string;
  coverageArea: string;
  urgencyAccent: "red" | "orange" | "yellow";
  visualEffect: VisualEffect;
};

const URGENCY_MAP: Record<string, string> = {
  red: "#DC2626",
  orange: "#EA580C",
  yellow: "#F59E0B"
};

function Emergency247Hero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const urgent = URGENCY_MAP[config.urgencyAccent] ?? URGENCY_MAP.red;
  const visualEffect: VisualEffect =
    config.visualEffect === "none" ? "none" : "grid";

  // Defensive fallbacks.
  const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : "";
  const heading = (typeof config.heading === "string" && config.heading) || "Emergency? We're on it.";
  const subheading = typeof config.subheading === "string" ? config.subheading : "";
  const callPhoneNumber = typeof config.callPhoneNumber === "string" ? config.callPhoneNumber : "";
  const callCtaLabel = (typeof config.callCtaLabel === "string" && config.callCtaLabel) || "Call Now";
  const whatsappCtaLabel = (typeof config.whatsappCtaLabel === "string" && config.whatsappCtaLabel) || "WhatsApp";
  const responseTime = typeof config.responseTime === "string" ? config.responseTime : "45 min";
  const responseTimeLabel = (typeof config.responseTimeLabel === "string" && config.responseTimeLabel) || "AVG RESPONSE";
  const coverageArea = typeof config.coverageArea === "string" ? config.coverageArea : "";

  const telHref = callPhoneNumber
    ? `tel:${callPhoneNumber.replace(/\s+/g, "")}`
    : "#";
  const whatsappHref = data.whatsappHref ?? "#whatsapp";

  return (
    <section
      className="relative isolate w-full overflow-x-clip bg-neutral-950 text-white"
      style={{
        background: "linear-gradient(180deg, #0A0A0A 0%, #171717 100%)"
      }}
      {...sectionRootAttrs(instanceId, "hero.emergency_247_1", "24/7 Emergency Hero")}
    >
      {/* Magic UI grid — subtle engineering precision layer beneath
          the urgency glow. */}
      {visualEffect === "grid" && (
        <GridPattern
          size={44}
          strokeWidth={1}
          className="-z-20 text-white/[0.05]"
        />
      )}

      {/* Radial urgency glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 55% at 50% 0%, ${urgent}22 0%, transparent 65%)`
        }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:min-h-[600px] lg:max-h-[800px] lg:py-20">
        {/* Response-time pulsing chip */}
        <Reveal>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
            style={{ borderColor: `${urgent}66`, background: `${urgent}18` }}
          >
            <span
              className="relative inline-flex h-2.5 w-2.5 items-center justify-center rounded-full"
              style={{ background: urgent }}
              aria-hidden="true"
            >
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: urgent,
                  animation: "trade-pulse 1.4s ease-out infinite",
                  opacity: 0.7
                }}
              />
            </span>
            <span
              className="text-caption font-extrabold uppercase text-white"
              {...treeAttrs(instanceId, "responseTimeLabel", "Response label", "text")}
            >
              {responseTimeLabel}
            </span>
            <span
              className="text-body-sm font-extrabold"
              style={{ color: urgent }}
              {...treeAttrs(instanceId, "responseTime", "Response time", "text")}
            >
              {responseTime}
            </span>
          </div>
        </Reveal>

        {eyebrow && (
          <Reveal delay={0.05}>
            <p
              className="mt-5 text-eyebrow font-extrabold uppercase"
              style={{ color: urgent }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {eyebrow}
            </p>
          </Reveal>
        )}

        <Reveal delay={0.1}>
          <h1
            className="mt-4 text-display-md font-extrabold sm:mt-6 sm:text-display-lg lg:text-display-xl"
            {...treeAttrs(instanceId, "heading", "Main headline", "text")}
          >
            {heading}
          </h1>
        </Reveal>

        {subheading && (
          <Reveal delay={0.16}>
            <p
              className="mt-4 max-w-xl text-body-md text-white/70 sm:mt-5 sm:text-body-lg"
              {...treeAttrs(instanceId, "subheading", "Supporting line", "text")}
            >
              {subheading}
            </p>
          </Reveal>
        )}

        {/* MASSIVE Call Now button — the primary conversion action */}
        <Reveal delay={0.22}>
          <div className="mx-auto mt-8 flex w-full max-w-[320px] flex-col gap-2.5 sm:mt-10 sm:max-w-md">
            <Button
              asChild
              size="xl"
              className="group w-full"
              style={{
                background: urgent,
                color: "#FFFFFF",
                boxShadow: `0 12px 32px ${urgent}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
                fontSize: "15px",
                height: "60px"
              }}
            >
              <Link
                href={telHref}
                {...treeAttrs(instanceId, "callCtaLabel", "Call CTA", "button")}
              >
                <Phone strokeWidth={2.5} aria-hidden="true" />
                <span>{callCtaLabel}</span>
                {callPhoneNumber && (
                  <span className="ml-1 opacity-80">{callPhoneNumber}</span>
                )}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="xl"
              className="w-full border-white/25 bg-transparent text-white hover:bg-white/10"
            >
              <Link
                href={whatsappHref}
                {...treeAttrs(instanceId, "whatsappCtaLabel", "WhatsApp CTA", "button")}
              >
                <MessageCircle strokeWidth={2.5} style={{ color: "#25D366" }} aria-hidden="true" />
                <span>{whatsappCtaLabel}</span>
              </Link>
            </Button>
          </div>
        </Reveal>

        {coverageArea && (
          <Reveal delay={0.3}>
            <div
              className="mt-6 inline-flex items-center gap-1.5 text-caption font-bold uppercase text-white/60"
              {...treeAttrs(instanceId, "coverageArea", "Coverage area", "text")}
            >
              <MapPin size={12} strokeWidth={2.5} />
              {coverageArea}
            </div>
          </Reveal>
        )}
      </div>

      {/* Pulse keyframe */}
      <style jsx>{`
        @keyframes trade-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(2.5); opacity: 0.15; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.emergency_247_1",
  name: "24/7 Emergency Hero",
  version: "3.0.0",
  library: "hero",
  description:
    "High-conversion hero for reactive trades. Massive Call Now button (60px tall), pulsing response-time chip, dark surface with urgent-colour glow. shadcn Button + Framer Motion. Optimised for panicking 2am customers.",
  editableFields: [
    { key: "eyebrow", label: "Small eyebrow", type: { kind: "text", maxLength: 40 }, default: "24/7 · No callout fee", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Main headline", type: { kind: "text", maxLength: 80 }, default: "Emergency? We're on it.", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 180, multiline: true }, default: "Any hour, any day, across the region. Fully insured, £5M public liability, no fix no fee.", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    { key: "callPhoneNumber", label: "Phone number", type: { kind: "text", maxLength: 20 }, default: "0800 000 0000", priority: "text", role: "cta_call", group: "Actions" },
    { key: "callCtaLabel", label: "Call button label", type: { kind: "text", maxLength: 20 }, default: "Call Now", priority: "button", group: "Actions" },
    { key: "whatsappCtaLabel", label: "WhatsApp label", type: { kind: "text", maxLength: 20 }, default: "WhatsApp", priority: "button", role: "cta_whatsapp", group: "Actions" },
    { key: "responseTime", label: "Response time value", type: { kind: "text", maxLength: 30 }, default: "45 min", priority: "text", group: "Trust" },
    { key: "responseTimeLabel", label: "Response time label", type: { kind: "text", maxLength: 30 }, default: "AVG RESPONSE", priority: "text", group: "Trust" },
    { key: "coverageArea", label: "Coverage area", type: { kind: "text", maxLength: 60 }, default: "Serving all of Greater Manchester", priority: "text", role: "location_label", group: "Trust" },
    { key: "urgencyAccent", label: "Urgency colour", type: { kind: "select", options: [{ value: "red", label: "Red" }, { value: "orange", label: "Orange" }, { value: "yellow", label: "Yellow" }] }, default: "red", group: "Style" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "none", label: "None" }] }, default: "grid", description: "Subtle Magic UI grid layered under the urgency glow.", group: "Style" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A 24/7 emergency hero. Explain why panicking-user optimisation matters.",
    improve: "Tighten headline + subhead — under 6 words. Return patched fields only.",
    rewrite: "Rewrite copy in a {tone} voice — urgent-calm blend.",
    suggestAlternative: "Suggest an alternative when the trade isn't emergency-first.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 0 }, accessibility: { contrastMin: 4.5 }, sales: { primaryActionRequired: true, ctaAboveFold: true }, seo: { headingLevel: 1 }, mobile: { minTapTargetPx: 60 }, brandConsistency: { boundTokens: ["color.accent"] } },
  telemetryTags: ["hero", "emergency", "24_7", "urgency", "shadcn", "framer_motion"],
  bestForVerticals: ["emergency-roofing", "plumber-emergency", "locksmith", "boiler-repair", "electrician-emergency", "recovery-service"],
  defaultConfig: () => ({
    eyebrow: "24/7 · No callout fee",
    heading: "Emergency? We're on it.",
    subheading: "Any hour, any day, across the region. Fully insured, £5M public liability, no fix no fee.",
    callPhoneNumber: "0800 000 0000",
    callCtaLabel: "Call Now",
    whatsappCtaLabel: "WhatsApp",
    responseTime: "45 min",
    responseTimeLabel: "AVG RESPONSE",
    coverageArea: "Serving all of Greater Manchester",
    urgencyAccent: "red",
    visualEffect: "grid"
  }),
  renderer: Emergency247Hero
};

sectionRegistry.register(registration);
