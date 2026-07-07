// HeroPreview — renders the actual hero with the merchant's chosen
// image + preset + edits + optional uploaded image. Uses CSS filters
// for the brightness/warmth/vignette edits so preview is real-time.
//
// This IS the hero — the demo page drops this straight into the
// header slot. It's also what the sheet's live-preview reflects.

"use client";

import { HERO_PRESETS } from "@/lib/hero-swap/presets";
import { watermarkedUrl } from "@/lib/watermark/urls";
import { useEditModeOptional } from "@/apps/live-edit/EditModeContext";
import type {
  HeroEdits,
  HeroImage,
  HeroPreset
} from "@/lib/hero-swap/types";

export type HeroPreviewProps = {
  image: HeroImage;
  preset: HeroPreset;
  edits: HeroEdits;
  uploadUrl?: string | null;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  aspectClass?: string;
};

function buildFilter(edits: HeroEdits): string {
  const brightness = 1 + edits.brightness / 100;
  const warmth = edits.warmth / 100;
  // Warmth is a hue-rotate approximation — real merchant Studio would
  // do a proper color-matrix, but this feels right for the preview.
  const hueRotate = warmth * -18;
  return `brightness(${brightness.toFixed(2)}) hue-rotate(${hueRotate.toFixed(1)}deg)`;
}

function VignetteOverlay({ strength }: { strength: number }) {
  if (strength <= 0) return null;
  const opacity = Math.min(0.6, strength / 100);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${opacity}) 100%)`
      }}
    />
  );
}

export function HeroPreview({
  image,
  preset,
  edits,
  uploadUrl,
  headline,
  subhead,
  ctaLabel,
  onCtaClick,
  children,
  className = "",
  aspectClass = "aspect-[16/9]"
}: HeroPreviewProps) {
  const spec = HERO_PRESETS[preset];
  // Merchant-uploaded images bypass the watermark endpoint — they own
  // that content. Library images route through /api/image/serve for
  // the preview-tier watermark + SEO backlink. If the merchant is
  // signed in, their id is threaded via ?m= so the endpoint can
  // upgrade tier to standard/clean based on their active licences.
  const editCtx = useEditModeOptional();
  const src =
    uploadUrl ??
    watermarkedUrl(image.id, {
      fallback: image.image_url,
      merchantId: editCtx?.merchantId
    });
  const filter = buildFilter(edits);

  if (preset === "card") {
    return (
      <div
        className={`grid gap-3 md:grid-cols-2 ${className}`}
        style={{ padding: spec.container_padding_px }}
      >
        <div
          className={`relative overflow-hidden ${aspectClass}`}
          style={{ borderRadius: spec.image_border_radius_px }}
        >
          <img
            src={src}
            alt={image.subject}
            className="h-full w-full object-cover"
            style={{ filter }}
          />
          <VignetteOverlay strength={edits.vignette} />
        </div>
        <div
          className="flex flex-col justify-center gap-3 rounded-2xl p-6 text-white"
          style={{ backgroundColor: image.theme_palette.surface_deep }}
        >
          {headline ? (
            <h1 className="text-[24px] font-bold leading-tight md:text-[32px]">
              {headline}
            </h1>
          ) : null}
          {subhead ? (
            <p className="text-[14px] opacity-90">{subhead}</p>
          ) : null}
          {ctaLabel ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="w-fit rounded-full px-5 py-2 text-[14px] font-semibold text-neutral-900 transition hover:opacity-90"
              style={{ backgroundColor: image.theme_palette.primary }}
            >
              {ctaLabel}
            </button>
          ) : null}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ padding: spec.container_padding_px }}
    >
      <div
        className={`relative overflow-hidden ${aspectClass}`}
        style={{ borderRadius: spec.image_border_radius_px }}
      >
        <img
          src={src}
          alt={image.subject}
          className="h-full w-full object-cover"
          style={{ filter }}
        />
        <VignetteOverlay strength={edits.vignette} />
        {spec.overlay_style === "gradient" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 45%, transparent 100%)"
            }}
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col justify-center gap-3 p-6 text-white md:p-10">
          {headline ? (
            <h1 className="max-w-2xl text-[24px] font-bold leading-tight drop-shadow md:text-[42px]">
              {headline}
            </h1>
          ) : null}
          {subhead ? (
            <p className="max-w-xl text-[14px] opacity-95 drop-shadow md:text-[16px]">
              {subhead}
            </p>
          ) : null}
          {ctaLabel ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="w-fit rounded-full px-5 py-2 text-[14px] font-semibold text-neutral-900 transition hover:opacity-90"
              style={{ backgroundColor: image.theme_palette.primary }}
            >
              {ctaLabel}
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
