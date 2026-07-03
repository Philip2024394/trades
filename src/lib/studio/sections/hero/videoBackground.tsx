// hero.video_background_1 — Full-Bleed Video Background Hero.
//
// Cinematic hero for trades with real footage: landscapers on-site,
// plant-hire fleet in action, roofers finishing an install, chef-run
// kitchen showrooms. A muted, autoplay-safe video loop plays behind
// the copy. Dark overlay keeps type legible.
//
// Design principles applied:
//   • Muted + loop + playsinline = works everywhere without user gesture
//   • Poster image renders instantly while video loads (no black frame)
//   • Overlay gradient keeps headline crisp over any footage
//   • Optional trust ribbon along the bottom edge
//   • prefers-reduced-motion pauses video and freezes on poster
//   • MP4 + WebM fallback support

"use client";

import { useEffect, useRef } from "react";
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
  videoMp4Url: string;
  videoWebmUrl: string;
  posterImageUrl: string;
  overlayOpacity: number;
  ribbon1: string;
  ribbon2: string;
  ribbon3: string;
};

function VideoBackgroundHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const overlay = Math.max(0.3, Math.min(0.85, config.overlayOpacity));
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches && videoRef.current) {
      videoRef.current.pause();
    }
    function handle(e: MediaQueryListEvent) {
      if (e.matches && videoRef.current) videoRef.current.pause();
      else videoRef.current?.play().catch(() => {});
    }
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  const ribbons = [config.ribbon1, config.ribbon2, config.ribbon3].filter(
    (r) => r && r.trim().length > 0
  );

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: "#0A0A0A",
        color: "#FFFFFF",
        fontFamily: bodyFont,
        minHeight: 640
      }}
      {...sectionRootAttrs(instanceId, "hero.video_background_1", "Video Background Hero")}
    >
      {/* Video / poster */}
      {(config.videoMp4Url || config.videoWebmUrl) ? (
        <video
          ref={videoRef}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={config.posterImageUrl || undefined}
          preload="metadata"
        >
          {config.videoWebmUrl && (
            <source src={config.videoWebmUrl} type="video/webm" />
          )}
          {config.videoMp4Url && (
            <source src={config.videoMp4Url} type="video/mp4" />
          )}
        </video>
      ) : config.posterImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.posterImageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #404040 50%, #0A0A0A 100%)"
          }}
        />
      )}

      {/* Overlay gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.45}) 0%, rgba(0,0,0,${overlay}) 100%)`
        }}
      />

      <div className="relative mx-auto flex min-h-[540px] max-w-4xl flex-col justify-end px-5 py-16 sm:px-6 sm:py-24">
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
          className="mt-4 max-w-3xl text-5xl font-extrabold leading-[0.95] text-white sm:text-7xl md:text-8xl"
          style={{
            fontFamily: headingFont,
            letterSpacing: "-0.03em",
            textShadow: "0 4px 40px rgba(0,0,0,0.5)"
          }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>
        {config.subheading && (
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-[17px]"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={primaryHref || "#"}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: accent,
              color: "#0A0A0A",
              boxShadow: `0 8px 24px ${accent}55`
            }}
            {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
          >
            <span>{config.primaryCtaLabel}</span>
          </Link>
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest backdrop-blur-md transition hover:bg-white/10"
              style={{
                borderColor: "rgba(255,255,255,0.3)",
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

      {/* Trust ribbon along bottom */}
      {ribbons.length > 0 && (
        <div
          className="relative border-t backdrop-blur-md"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.5)"
          }}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-6 px-5 py-4 sm:justify-between sm:px-6">
            {ribbons.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-white/85"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  aria-hidden="true"
                />
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.video_background_1",
  name: "Video Background Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Cinematic full-bleed video hero with muted autoplay loop. Poster fallback + overlay gradient + trust ribbon. Perfect for trades with real on-site footage.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Watch the work", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Made to last.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Every job filmed. Every install signed off. Every homeowner gets the same crew, start to finish.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Start your project", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Watch reel", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link" }, default: "#reel", group: "CTAs" },
    { key: "videoMp4Url", label: "Video (MP4) URL", type: { kind: "text", maxLength: 500 }, default: "", group: "Video", description: "Muted, looping, ~10-20s. H.264 MP4 recommended. Under 2MB for fast load." },
    { key: "videoWebmUrl", label: "Video (WebM) URL", type: { kind: "text", maxLength: 500 }, default: "", group: "Video", description: "Optional WebM alternative — served to Chrome/Firefox for smaller file size." },
    { key: "posterImageUrl", label: "Poster image URL", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "", group: "Video", description: "Shown before the video loads and as a fallback if the browser blocks autoplay." },
    { key: "overlayOpacity", label: "Overlay darkness", type: { kind: "number", min: 0.3, max: 0.85, step: 0.05 }, default: 0.55, group: "Layout" },
    { key: "ribbon1", label: "Ribbon 1", type: { kind: "text", maxLength: 40 }, default: "£5m insured", group: "Trust ribbon" },
    { key: "ribbon2", label: "Ribbon 2", type: { kind: "text", maxLength: 40 }, default: "218 projects since 2011", group: "Trust ribbon" },
    { key: "ribbon3", label: "Ribbon 3", type: { kind: "text", maxLength: 40 }, default: "Written guarantee on every job", group: "Trust ribbon" }
  ],
  animations: ["none", "loop", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Video Background hero converts best.",
    improve: "Suggest what footage works best for this trade.",
    rewrite: "Rewrite the headline for cinematic impact.",
    suggestAlternative: "Which hero would work if the merchant has no video?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "video", "cinematic"],
  bestForVerticals: ["landscape-designer", "plant-hire", "builder", "kitchen-fitter", "showroom", "extension-builder", "roofer", "driveway-installer"],
  defaultConfig: () => ({
    eyebrow: "Watch the work",
    heading: "Made to last.",
    subheading: "Every job filmed. Every install signed off. Every homeowner gets the same crew, start to finish.",
    primaryCtaLabel: "Start your project",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "Watch reel",
    secondaryCtaHref: "#reel",
    videoMp4Url: "",
    videoWebmUrl: "",
    posterImageUrl: "",
    overlayOpacity: 0.55,
    ribbon1: "£5m insured",
    ribbon2: "218 projects since 2011",
    ribbon3: "Written guarantee on every job"
  }),
  renderer: VideoBackgroundHero
};

sectionRegistry.register(registration);
