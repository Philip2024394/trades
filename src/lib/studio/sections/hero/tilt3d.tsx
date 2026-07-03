// hero.tilt_3d_1 — 3D Tilt Card Hero.
//
// Apple / Stripe / Framer aesthetic. A big card containing the copy
// and a mock preview tilts in 3D based on cursor position. Feels
// premium and product-y — perfect for merchant showcases, plant hire
// with equipment cards, kitchen studios with product tiles.
//
// Design principles applied:
//   • Perspective-based rotation follows cursor smoothly
//   • Card returns to level when cursor leaves (500ms cubic-bezier)
//   • Depth achieved with layered shadows + subtle inner glow
//   • Optional floating mock UI element (equipment card / product /
//     review card) tilts along with the main card
//   • Touch devices get a static "hero" pose (no tilt)
//   • prefers-reduced-motion locks the card flat

"use client";

import { useEffect, useRef, useState } from "react";
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
  mockCardTitle: string;
  mockCardCategory: string;
  mockCardPrice: string;
  mockCardBadge: string;
  mockCardImageUrl: string;
  containerImageUrl: string;
  containerImageOpacity: number;
  tiltIntensity: number;
  glareIntensity: number;
  surface: "onyx" | "midnight" | "steel";
};

function Tilt3dHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const surfaceMap = {
    onyx: {
      bg: "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)",
      cardBg: "linear-gradient(135deg, #1a1a1a 0%, #262626 100%)"
    },
    midnight: {
      bg: "linear-gradient(135deg, #0A0A0A 0%, #1e1b4b 50%, #0A0A0A 100%)",
      cardBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"
    },
    steel: {
      bg: "linear-gradient(180deg, #1F1F1F 0%, #404040 100%)",
      cardBg: "linear-gradient(135deg, #262626 0%, #525252 100%)"
    }
  }[config.surface];

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; glareX: number; glareY: number; active: boolean }>({
    rx: 0,
    ry: 0,
    glareX: 50,
    glareY: 50,
    active: false
  });

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const intensity = Math.max(4, Math.min(24, config.tiltIntensity));
    function handleMove(e: MouseEvent) {
      const rect = card!.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);
      const clampedDx = Math.max(-1, Math.min(1, dx));
      const clampedDy = Math.max(-1, Math.min(1, dy));
      setTilt({
        rx: clampedDy * -intensity,
        ry: clampedDx * intensity,
        glareX: ((e.clientX - rect.left) / rect.width) * 100,
        glareY: ((e.clientY - rect.top) / rect.height) * 100,
        active: true
      });
    }
    function handleLeave() {
      setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
    }
    card.addEventListener("mousemove", handleMove);
    card.addEventListener("mouseleave", handleLeave);
    return () => {
      card.removeEventListener("mousemove", handleMove);
      card.removeEventListener("mouseleave", handleLeave);
    };
  }, [config.tiltIntensity]);

  const glareOpacity = Math.max(0, Math.min(1, config.glareIntensity));
  const uid = instanceId.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: surfaceMap.bg,
        color: "#FFFFFF",
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.tilt_3d_1", "3D Tilt Card Hero")}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(50% 60% at 50% 50%, ${accent}18 0%, transparent 60%)`
        }}
      />

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div
          className={`tilt-card-${uid}`}
          ref={cardRef}
          style={
            {
              perspective: "1200px"
            } as React.CSSProperties
          }
        >
          <div
            className="relative rounded-3xl border p-8 sm:p-14"
            style={{
              background: surfaceMap.cardBg,
              borderColor: "rgba(255,255,255,0.1)",
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: tilt.active
                ? "transform 60ms linear"
                : "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
              transformStyle: "preserve-3d",
              boxShadow: `
                0 8px 24px rgba(0,0,0,0.4),
                0 40px 80px rgba(0,0,0,0.4),
                inset 0 1px 0 rgba(255,255,255,0.06)
              `
            }}
          >
            {/* Optional background image inside the tilt card. Sits
                behind the glare and content so it inherits the 3D tilt
                but never fights the copy for legibility. */}
            {config.containerImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.containerImageUrl}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full rounded-3xl object-contain"
                style={{
                  opacity: Math.max(0, Math.min(1, config.containerImageOpacity))
                }}
                {...treeAttrs(instanceId, "containerImageUrl", "Container photo", "image")}
              />
            )}

            {/* Glare overlay — bright reflection that follows cursor */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
              style={{
                background: `radial-gradient(60% 80% at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,${glareOpacity * 0.15}) 0%, transparent 60%)`,
                transition: tilt.active
                  ? "background 60ms linear"
                  : "background 500ms cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: tilt.active ? 1 : 0
              }}
            />

            <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12">
              {/* LEFT — copy */}
              <div style={{ transform: "translateZ(30px)" }}>
                {config.eyebrow && (
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
                    style={{ color: accent }}
                    {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
                  >
                    {config.eyebrow}
                  </p>
                )}
                <h1
                  className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-6xl"
                  style={{
                    fontFamily: headingFont,
                    letterSpacing: "-0.03em",
                    // Inverse-rotate the headline to cancel the parent
                    // card's cursor-driven tilt. The rest of the card
                    // still tilts + glares + parallaxes — only the
                    // headline visually stays put so the reader isn't
                    // chasing the words.
                    transform: `rotateX(${-tilt.rx}deg) rotateY(${-tilt.ry}deg)`,
                    transformOrigin: "center center",
                    transition: tilt.active
                      ? "transform 60ms linear"
                      : "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
                    willChange: "transform"
                  }}
                  {...treeAttrs(instanceId, "heading", "Headline", "text")}
                >
                  {config.heading}
                </h1>
                {config.subheading && (
                  <p
                    className="mt-5 max-w-md text-[15px] leading-relaxed text-white/75 sm:text-[17px]"
                    {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
                  >
                    {config.subheading}
                  </p>
                )}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={primaryHref || "#"}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
                    style={{
                      background: accent,
                      color: "#0A0A0A",
                      boxShadow: `0 8px 24px ${accent}66`
                    }}
                    {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
                  >
                    <span>{config.primaryCtaLabel}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                  {config.secondaryCtaLabel && (
                    <Link
                      href={secondaryHref || "#"}
                      className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition"
                      style={{
                        borderColor: "rgba(255,255,255,0.24)",
                        color: "#FFFFFF",
                        background: "rgba(255,255,255,0.05)"
                      }}
                      {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
                    >
                      {config.secondaryCtaLabel}
                    </Link>
                  )}
                </div>
              </div>

              {/* RIGHT — floating mock product/service card */}
              <div
                className="flex justify-center lg:justify-end"
                style={{ transform: "translateZ(60px)" }}
              >
                <div
                  className="w-full max-w-xs overflow-hidden rounded-2xl border"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    borderColor: "rgba(255,255,255,0.14)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
                  }}
                >
                  <div
                    className="relative flex h-40 w-full items-center justify-center overflow-hidden"
                    style={{
                      background: config.mockCardImageUrl
                        ? "transparent"
                        : `linear-gradient(135deg, ${accent}88 0%, ${accent}44 100%)`
                    }}
                  >
                    {config.mockCardImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={config.mockCardImageUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <PlaceholderIcon />
                    )}
                    {config.mockCardBadge && (
                      <span
                        className="absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest"
                        style={{ background: accent, color: "#0A0A0A" }}
                        {...treeAttrs(instanceId, "mockCardBadge", "Mock badge", "text")}
                      >
                        {config.mockCardBadge}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <p
                      className="text-[10px] font-extrabold uppercase tracking-widest"
                      style={{ color: accent }}
                      {...treeAttrs(instanceId, "mockCardCategory", "Mock category", "text")}
                    >
                      {config.mockCardCategory}
                    </p>
                    <h3
                      className="mt-1 text-lg font-extrabold text-white"
                      {...treeAttrs(instanceId, "mockCardTitle", "Mock title", "text")}
                    >
                      {config.mockCardTitle}
                    </h3>
                    <p
                      className="mt-3 text-xl font-extrabold text-white"
                      {...treeAttrs(instanceId, "mockCardPrice", "Mock price", "text")}
                    >
                      {config.mockCardPrice}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-white/70">
                      <span className="inline-flex items-center gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={accent} aria-hidden="true">
                            <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </span>
                      <span>4.9 · 127 reviews</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reduced-motion fallback: freeze the tilt */}
      <style>{`
        @media (prefers-reduced-motion: reduce), (pointer: coarse) {
          .tilt-card-${uid} > div {
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function PlaceholderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.tilt_3d_1",
  name: "3D Tilt Card Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Apple / Stripe aesthetic. A big card containing copy + floating mock product tilts in 3D based on cursor position. Glare reflection follows the cursor across the surface.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Product-quality trade", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Every job. Product-perfect.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "The finish that shows in the light. The details that show in the manual. The care that shows in the reviews.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Portfolio", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "mockCardTitle", label: "Mock card title", type: { kind: "text", maxLength: 60 }, default: "Bespoke Oak Kitchen", priority: "text", group: "Mock product" },
    { key: "mockCardCategory", label: "Mock card category", type: { kind: "text", maxLength: 40 }, default: "Recent installation", priority: "text", group: "Mock product" },
    { key: "mockCardPrice", label: "Mock card price", type: { kind: "text", maxLength: 30 }, default: "From £24,500", priority: "text", group: "Mock product" },
    { key: "mockCardBadge", label: "Mock card badge", type: { kind: "text", maxLength: 20 }, default: "Featured", group: "Mock product" },
    { key: "mockCardImageUrl", label: "Mock card image URL", type: { kind: "image", aspectRatio: "3:2", recommendedWidthPx: 800 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_10_31%20PM.png", group: "Mock product" },
    { key: "containerImageUrl", label: "Container background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1600 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_09_05%20PM.png", group: "Container", description: "Sits inside the tilting card, behind the copy. Leave empty to use the plain surface colour." },
    { key: "containerImageOpacity", label: "Container photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Container", description: "1 = photo fully visible. Lower to let the surface colour show through." },
    { key: "tiltIntensity", label: "Tilt intensity (degrees)", type: { kind: "number", min: 4, max: 24, step: 2, unit: "°" }, default: 12, group: "Interaction" },
    { key: "glareIntensity", label: "Glare intensity", type: { kind: "number", min: 0, max: 1, step: 0.1 }, default: 0.7, group: "Interaction" },
    {
      key: "surface",
      role: "surface_mode",label: "Surface",
      type: {
        kind: "select",
        options: [
          { value: "onyx", label: "Onyx" },
          { value: "midnight", label: "Midnight blue" },
          { value: "steel", label: "Brushed steel" }
        ]
      },
      default: "onyx",
      group: "Layout"
    }
  ],
  animations: ["3d-tilt", "glare-follow"],
  aiPrompts: {
    explain: "Explain when the 3D Tilt Card hero converts best.",
    improve: "Suggest what the mock product should showcase for this trade.",
    rewrite: "Rewrite the headline in Apple-adjacent voice.",
    suggestAlternative: "Which hero would work for a merchant on a mostly-mobile audience?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "3d", "tilt", "interactive", "premium"],
  bestForVerticals: ["kitchen-fitter", "bathroom-fitter", "showroom", "bespoke-kitchen", "interior-designer", "plant-hire", "tool-hire", "extension-builder"],
  defaultConfig: () => ({
    eyebrow: "Product-quality trade",
    heading: "Every job. Product-perfect.",
    subheading: "The finish that shows in the light. The details that show in the manual. The care that shows in the reviews.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "Portfolio",
    secondaryCtaHref: "#projects",
    mockCardTitle: "Bespoke Oak Kitchen",
    mockCardCategory: "Recent installation",
    mockCardPrice: "From £24,500",
    mockCardBadge: "Featured",
    mockCardImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_10_31%20PM.png",
    containerImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_09_05%20PM.png",
    containerImageOpacity: 1,
    tiltIntensity: 12,
    glareIntensity: 0.7,
    surface: "onyx"
  }),
  renderer: Tilt3dHero
};

sectionRegistry.register(registration);
