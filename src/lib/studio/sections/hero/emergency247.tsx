// hero.emergency_247_1 — Emergency 24/7 Hero.
//
// High-conversion hero for reactive trades: emergency plumbers,
// locksmiths, electricians, boiler repairs, roofing leaks, appliance
// breakdowns. Every design choice is optimised for a panicking
// customer at 2am with one thumb and a cracked screen.
//
// Design principles applied:
//   • Massive Call Now button (72px tap target, thumb-reach centered)
//   • Pulsing response-time chip (draws the eye but not gaudy)
//   • Danger accent (red) reads as urgency without breaking brand
//   • Minimal copy — panicking users don't read
//   • Full-bleed dark surface, high contrast
//   • WhatsApp secondary CTA for follow-up

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
  callPhoneNumber: string;
  callCtaLabel: string;
  whatsappCtaLabel: string;
  responseTime: string;
  responseTimeLabel: string;
  coverageArea: string;
  urgencyAccent: "red" | "orange" | "yellow";
};

function Emergency247Hero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const brandAccent = (tokens["color.accent"] as string) ?? "#FFB300";
  const urgencyMap = {
    red: "#DC2626",
    orange: "#EA580C",
    yellow: "#F59E0B"
  } as const;
  const urgent = urgencyMap[config.urgencyAccent] ?? urgencyMap.red;
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";

  const telHref = config.callPhoneNumber
    ? `tel:${config.callPhoneNumber.replace(/\s+/g, "")}`
    : "#";
  const whatsappHref = data.whatsappHref ?? "#whatsapp";

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0A0A0A 0%, #1a1a1a 100%)",
        color: "#FFFFFF",
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.emergency_247_1", "24/7 Emergency Hero")}
    >
      {/* Ambient glow — subtle radial that pulses gently */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 50% at 50% 0%, ${urgent}22 0%, transparent 60%)`
        }}
      />

      <div className="mx-auto max-w-4xl px-5 py-14 text-center sm:px-6 sm:py-20">
        {/* Response-time pulsing chip */}
        <div
          className="mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-2"
          style={{
            borderColor: `${urgent}66`,
            background: `${urgent}18`
          }}
        >
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: urgent }}
            aria-hidden="true"
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: urgent,
                animation: "trade-pulse 1.4s ease-out infinite",
                opacity: 0.6
              }}
            />
          </span>
          <span
            className="text-[11px] font-extrabold uppercase tracking-widest"
            style={{ color: "#FFFFFF" }}
            {...treeAttrs(instanceId, "responseTimeLabel", "Response label", "text")}
          >
            {config.responseTimeLabel}
          </span>
          <span
            className="text-[13px] font-extrabold"
            style={{ color: urgent }}
            {...treeAttrs(instanceId, "responseTime", "Response time", "text")}
          >
            {config.responseTime}
          </span>
        </div>

        {/* Eyebrow */}
        {config.eyebrow && (
          <p
            className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: brandAccent }}
            {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
          >
            {config.eyebrow}
          </p>
        )}

        {/* Massive headline */}
        <h1
          className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-6xl md:text-7xl"
          style={{
            fontFamily: headingFont,
            letterSpacing: "-0.02em"
          }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>

        {/* Subheading */}
        {config.subheading && (
          <p
            className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-[17px]"
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        {/* Massive Call Now button */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href={telHref}
            className="inline-flex h-[72px] w-full max-w-md items-center justify-center gap-3 rounded-2xl px-8 text-lg font-extrabold uppercase tracking-widest transition active:scale-[0.98] sm:text-xl"
            style={{
              background: urgent,
              color: "#FFFFFF",
              boxShadow: `0 12px 40px ${urgent}66, 0 0 0 4px ${urgent}22`
            }}
            {...treeAttrs(instanceId, "callCtaLabel", "Call CTA", "button")}
          >
            <PhoneIcon />
            <span>{config.callCtaLabel}</span>
          </Link>
          {config.callPhoneNumber && (
            <p
              className="font-mono text-lg font-bold text-white/80 sm:text-xl"
              {...treeAttrs(instanceId, "callPhoneNumber", "Phone number", "text")}
            >
              {config.callPhoneNumber}
            </p>
          )}

          {/* WhatsApp secondary */}
          <Link
            href={whatsappHref}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-6 text-[12px] font-extrabold uppercase tracking-widest transition hover:brightness-110"
            style={{
              borderColor: "rgba(255,255,255,0.24)",
              color: "#FFFFFF",
              background: "rgba(255,255,255,0.04)"
            }}
            {...treeAttrs(instanceId, "whatsappCtaLabel", "WhatsApp CTA", "button")}
          >
            <WhatsAppIcon />
            <span>{config.whatsappCtaLabel}</span>
          </Link>
        </div>

        {/* Coverage strip */}
        {config.coverageArea && (
          <p
            className="mt-10 text-[11px] font-bold uppercase tracking-[0.22em] text-white/50"
            {...treeAttrs(instanceId, "coverageArea", "Coverage area", "text")}
          >
            Covering: {config.coverageArea}
          </p>
        )}
      </div>

      {/* Local keyframes for the pulse — kept inline so this hero is
          fully self-contained (no global CSS dependency). */}
      <style>{`
        @keyframes trade-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(2.6); opacity: 0; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes trade-pulse { from { transform: none; } to { transform: none; } }
        }
      `}</style>
    </section>
  );
}

function PhoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c7.29 3.925 16.436-1.322 16.437-10.348-.001-3.166-1.233-6.144-3.253-8.55zm-8.62 17.204c-1.796 0-3.554-.482-5.09-1.395l-.365-.217-3.79.988 1.01-3.677-.237-.379a10.001 10.001 0 01-1.53-5.339c.003-7.72 7.955-11.582 13.395-6.14 5.44 5.441 1.594 13.44-6.14 13.44z" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.emergency_247_1",
  name: "Emergency 24/7 Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Panic-mode-optimised hero for reactive trades. Massive Call Now button, pulsing response-time chip, urgency accent, coverage strip.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "24/7 emergency response", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Emergency? Call now.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "24-hour emergency callouts across your area. Real engineers on the phone, not a call centre.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "callPhoneNumber", label: "Phone number (E.164)", type: { kind: "text", maxLength: 20 }, default: "0800 000 000", priority: "text", group: "Call button" },
    { key: "callCtaLabel", label: "Call button label", type: { kind: "text", maxLength: 30 }, default: "Call now", priority: "button", group: "Call button" },
    { key: "whatsappCtaLabel", label: "WhatsApp CTA label", type: { kind: "text", maxLength: 30 }, default: "WhatsApp instead", priority: "button", group: "WhatsApp" },
    { key: "responseTime", label: "Response time", type: { kind: "text", maxLength: 20 }, default: "45 mins", priority: "text", group: "Response chip" },
    { key: "responseTimeLabel", label: "Response label", type: { kind: "text", maxLength: 30 }, default: "Avg on-site", priority: "text", group: "Response chip" },
    { key: "coverageArea", label: "Coverage area", type: { kind: "text", maxLength: 120 }, default: "M25 corridor · Central London · North & West London", priority: "text", group: "Coverage" },
    { key: "urgencyAccent", label: "Urgency accent", type: { kind: "select", options: [{ value: "red", label: "Red" }, { value: "orange", label: "Orange" }, { value: "yellow", label: "Yellow" }] }, default: "red", group: "Colour" }
  ],
  animations: ["none", "pulse", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Emergency 24/7 hero pattern converts best.",
    improve: "Suggest a tweak to make this hero fit the merchant's specific emergency trade.",
    rewrite: "Rewrite the headline to feel more urgent while staying honest.",
    suggestAlternative: "Which other hero would work better for a non-emergency trade?",
    score: "Score this hero for an emergency trade merchant on loading, a11y, sales, SEO, mobile, brand."
  },
  thumbnail: "",
  telemetryTags: ["hero", "emergency", "urgent", "call-first"],
  bestForVerticals: ["plumber", "electrician", "locksmith", "boiler-engineer", "roofer", "drainage", "glazier", "appliance-repair"],
  defaultConfig: () => ({
    eyebrow: "24/7 emergency response",
    heading: "Emergency? Call now.",
    subheading: "24-hour emergency callouts across your area. Real engineers on the phone, not a call centre.",
    callPhoneNumber: "0800 000 000",
    callCtaLabel: "Call now",
    whatsappCtaLabel: "WhatsApp instead",
    responseTime: "45 mins",
    responseTimeLabel: "Avg on-site",
    coverageArea: "M25 corridor · Central London · North & West London",
    urgencyAccent: "red"
  }),
  renderer: Emergency247Hero
};

sectionRegistry.register(registration);
