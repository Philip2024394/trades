// hero.animated_gradient_1 — Animated Mesh Gradient Hero.
//
// Zero-image, always-fast hero. Uses a slow-moving mesh gradient
// built from brand tokens to create depth and atmosphere without a
// single kilobyte of image data. Loads instantly, looks premium,
// theme-native.
//
// Design principles applied:
//   • No images = 0KB payload, always crisp at any resolution
//   • Gradient blobs drift slowly (30s loop) — hypnotic but not distracting
//   • Frozen by prefers-reduced-motion
//   • Perfect for merchants without brand photography yet
//   • Editorial typography rhythm: big, tight, confident

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
  headingAccentWord: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  chipLabel: string;
  gradientIntensity: "subtle" | "medium" | "bold";
  darkOrLight: "dark" | "light";
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

function AnimatedGradientHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.darkOrLight === "dark";
  const baseBg = isDark ? "#0A0A0A" : "#FBFAF7";
  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const muted = isDark ? "rgba(255,255,255,0.72)" : "rgba(10,10,10,0.6)";
  const border = isDark ? "rgba(255,255,255,0.15)" : "rgba(10,10,10,0.12)";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const intensityAlpha = {
    subtle: 0.22,
    medium: 0.38,
    bold: 0.55
  }[config.gradientIntensity];

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  // Split the heading into "before accent word" + accent word + "after".
  const accentWord = (config.headingAccentWord ?? "").trim();
  const heading = config.heading ?? "";
  const idx = accentWord ? heading.toLowerCase().indexOf(accentWord.toLowerCase()) : -1;
  const before = idx >= 0 ? heading.slice(0, idx) : heading;
  const accentSlice = idx >= 0 ? heading.slice(idx, idx + accentWord.length) : "";
  const after = idx >= 0 ? heading.slice(idx + accentWord.length) : "";

  const uniqueSuffix = instanceId.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: baseBg,
        color: ink,
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.animated_gradient_1", "Animated Gradient Hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
          style={{
            opacity: Math.max(0, Math.min(1, config.backgroundImageOpacity ?? 1))
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}

      {/* Gradient blobs — pure CSS, animated via keyframes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className={`blob-${uniqueSuffix} absolute`}
          style={{
            width: "60%",
            height: "60%",
            top: "-15%",
            left: "-10%",
            background: accent,
            opacity: intensityAlpha,
            filter: "blur(90px)",
            borderRadius: "50%"
          }}
        />
        <div
          className={`blob-${uniqueSuffix}-2 absolute`}
          style={{
            width: "55%",
            height: "55%",
            bottom: "-20%",
            right: "-15%",
            background: isDark ? "#3B82F6" : accent,
            opacity: intensityAlpha * 0.8,
            filter: "blur(120px)",
            borderRadius: "50%"
          }}
        />
        <div
          className={`blob-${uniqueSuffix}-3 absolute`}
          style={{
            width: "40%",
            height: "40%",
            top: "40%",
            left: "50%",
            background: isDark ? "#EF4444" : "#F59E0B",
            opacity: intensityAlpha * 0.55,
            filter: "blur(100px)",
            borderRadius: "50%"
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 py-24 sm:px-6 sm:py-32">
        {config.chipLabel && (
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest backdrop-blur-md"
            style={{
              borderColor: border,
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
              color: ink
            }}
            {...treeAttrs(instanceId, "chipLabel", "Chip label", "text")}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accent }}
              aria-hidden="true"
            />
            {config.chipLabel}
          </span>
        )}
        {config.eyebrow && (
          <p
            className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
          >
            {config.eyebrow}
          </p>
        )}
        <h1
          className="mt-4 text-5xl font-extrabold leading-[0.95] sm:text-7xl md:text-8xl"
          style={{
            fontFamily: headingFont,
            letterSpacing: "-0.03em"
          }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {before}
          {accentSlice && (
            <span
              style={{
                color: accent,
                textShadow: `0 4px 40px ${accent}66`
              }}
            >
              {accentSlice}
            </span>
          )}
          {after}
        </h1>
        {config.subheading && (
          <p
            className="mt-6 max-w-2xl text-[15px] leading-relaxed sm:text-[18px]"
            style={{ color: muted }}
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
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
              className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest backdrop-blur-md transition hover:brightness-110"
              style={{
                borderColor: border,
                color: ink,
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)"
              }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blob-${uniqueSuffix}-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(6%, 8%) scale(1.05); }
          66% { transform: translate(-4%, 4%) scale(0.95); }
        }
        @keyframes blob-${uniqueSuffix}-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-8%, -6%) scale(1.1); }
        }
        @keyframes blob-${uniqueSuffix}-drift-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(4%, -4%) scale(0.9); }
          80% { transform: translate(-6%, 6%) scale(1.05); }
        }
        .blob-${uniqueSuffix} { animation: blob-${uniqueSuffix}-drift 30s ease-in-out infinite; }
        .blob-${uniqueSuffix}-2 { animation: blob-${uniqueSuffix}-drift-2 36s ease-in-out infinite; }
        .blob-${uniqueSuffix}-3 { animation: blob-${uniqueSuffix}-drift-3 40s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .blob-${uniqueSuffix}, .blob-${uniqueSuffix}-2, .blob-${uniqueSuffix}-3 { animation: none; }
        }
      `}</style>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.animated_gradient_1",
  name: "Animated Gradient Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Zero-image mesh-gradient hero. Slow-drifting colour blobs create depth without a single kilobyte of image data. Perfect for merchants without brand photography.",
  editableFields: [
    { key: "chipLabel", label: "Chip label", type: { kind: "text", maxLength: 60 }, default: "New in your area", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Local · Insured · Reviewed", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "The trade you'll actually recommend.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "headingAccentWord", label: "Word in headline to accent", type: { kind: "text", maxLength: 40 }, default: "recommend", priority: "text", group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 240, multiline: true }, default: "Friendly, professional, on time. That's the boring bit — the reason customers text their family about us afterwards is we do the small stuff nobody notices until it's missing.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Get a quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See our work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "gradientIntensity", label: "Gradient intensity", type: { kind: "select", options: [{ value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }, { value: "bold", label: "Bold" }] }, default: "medium", group: "Layout" },
    { key: "darkOrLight", role: "surface_mode",label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_49_26%20AM.png?updatedAt=1783047003198", group: "Background", description: "Full-bleed photo behind the drifting gradient blobs. Leave empty for the plain surface + gradient only." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" }
  ],
  animations: ["none", "gradient-drift"],
  aiPrompts: {
    explain: "Explain when the Animated Gradient hero works best.",
    improve: "Suggest a headline accent word for this trade.",
    rewrite: "Rewrite the headline in the merchant's voice.",
    suggestAlternative: "Which hero would work if the merchant has strong project photography?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "gradient", "image-free", "fast-loading"],
  bestForVerticals: ["*"],
  defaultConfig: () => ({
    chipLabel: "New in your area",
    eyebrow: "Local · Insured · Reviewed",
    heading: "The trade you'll actually recommend.",
    headingAccentWord: "recommend",
    subheading: "Friendly, professional, on time. That's the boring bit — the reason customers text their family about us afterwards is we do the small stuff nobody notices until it's missing.",
    primaryCtaLabel: "Get a quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "#projects",
    gradientIntensity: "medium",
    darkOrLight: "dark",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2009_49_26%20AM.png?updatedAt=1783047003198",
    backgroundImageOpacity: 1
  }),
  renderer: AnimatedGradientHero
};

sectionRegistry.register(registration);
