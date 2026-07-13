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
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";
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

export function Emergency247Hero({
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

