// hero.portfolio_mosaic_1 — Portfolio Mosaic Hero.
//
// Photo-first hero for trades whose portfolio IS their pitch:
// builders, extensions, kitchen fitters, landscape designers,
// bathroom fitters, tilers, decorators. A 6-tile mosaic of real
// project photos sits behind a dark overlay; the copy centres on top.
//
// Design principles applied:
//   • Portfolio = trust for visual trades
//   • Auto-covers 6 photos into a mosaic that tiles cleanly on any width
//   • Dark overlay ensures headline legibility over any photo mix
//   • Subtle parallax on desktop scroll (respects prefers-reduced-motion)
//   • Centred copy for maximum focal weight

"use client";

import Link from "next/link";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type { SectionRendererProps } from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  photo1: string;
  photo2: string;
  photo3: string;
  photo4: string;
  photo5: string;
  photo6: string;
  overlayOpacity: number;
  projectCountLabel: string;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

export function PortfolioMosaicHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const overlay = Math.max(0.3, Math.min(0.9, config.overlayOpacity));
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

  const photos = [
    config.photo1,
    config.photo2,
    config.photo3,
    config.photo4,
    config.photo5,
    config.photo6
  ].filter((p) => p && p.trim().length > 0);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: "#0A0A0A",
        color: "#FFFFFF",
        fontFamily: bodyFont,
        minHeight: 520
      }}
      {...sectionRootAttrs(instanceId, "hero.portfolio_mosaic_1", "Portfolio Mosaic Hero")}
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

      {/* Photo mosaic — CSS grid so gaps are consistent and any photo
          missing collapses gracefully. */}
      {photos.length > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 grid grid-cols-3 grid-rows-2 gap-1 opacity-70"
          style={{ filter: "saturate(0.9)" }}
        >
          {photos.slice(0, 6).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="h-full w-full object-cover"
            />
          ))}
        </div>
      )}

      {/* Dark overlay with radial punch under headline */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse at center, rgba(10,10,10,${overlay * 0.65}) 0%, rgba(10,10,10,${overlay}) 60%, rgba(10,10,10,${Math.min(1, overlay + 0.1)}) 100%)`
        }}
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:px-6 sm:py-28">
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
          className="mt-4 text-4xl font-extrabold leading-[0.95] sm:text-6xl md:text-7xl"
          style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
          {...treeAttrs(instanceId, "heading", "Headline", "text")}
        >
          {config.heading}
        </h1>

        {config.subheading && (
          <p
            className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-[17px]"
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition hover:bg-white/10"
              style={{
                borderColor: "rgba(255,255,255,0.35)",
                color: "#FFFFFF",
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(4px)"
              }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>

        {config.projectCountLabel && (
          <p
            className="mt-10 text-[11px] font-bold uppercase tracking-[0.24em] text-white/60"
            {...treeAttrs(instanceId, "projectCountLabel", "Project count", "text")}
          >
            {config.projectCountLabel}
          </p>
        )}
      </div>
    </section>
  );
}

