"use client";

// Style preview tile — square card that renders the style's real
// preview image if present (public/logo-templates/<slug>.jpg or .png),
// otherwise falls back to a gradient tile with the style name so the
// design still reads before images land.
//
// Used on the landing hero + styles strip + inside the style-picker
// modal. Sizes: sm (hero reel) | md (grid card) | lg (modal preview).

import { useState } from "react";
import type { LogoStyle } from "@/lib/logo/catalog";
import { pickSample } from "@/lib/logo/catalog";

type Size = "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  sm: "aspect-square rounded-xl",
  md: "aspect-square rounded-2xl",
  lg: "aspect-square rounded-3xl"
};

const NAME_CLASS: Record<Size, string> = {
  sm: "text-[10px]",
  md: "text-[13px]",
  lg: "text-[22px]"
};

export function StylePreviewTile({
  style, size = "md", onClick, ariaLabel, tradeSlug = null, imageUrl
}: {
  style:      LogoStyle;
  size?:      Size;
  onClick?:   () => void;
  ariaLabel?: string;
  /** Trade context — when set, the tile picks the matching sample
   *  from style.samples. Otherwise first available sample or gradient. */
  tradeSlug?: string | null;
  /** Explicit override — used by the modal to show a specific sample. */
  imageUrl?:  string;
}) {
  const [imageOk, setImageOk] = useState(true);
  const sample = imageUrl
    ? { imageUrl, tradeSlug: tradeSlug ?? "" }
    : pickSample(style, tradeSlug);
  const src = sample?.imageUrl ?? null;

  const bg = imageOk && src
    ? undefined
    : { backgroundImage: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})` };

  const inner = (
    <div
      className={
        "group relative overflow-hidden border border-neutral-200 shadow-sm transition hover:shadow-lg " +
        SIZE_CLASS[size]
      }
      style={bg}
    >
      {src && imageOk && (
        // Per global rule: object-contain, never crop a logo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={style.name}
          className="h-full w-full object-contain p-2"
          style={{ backgroundImage: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})` }}
          onError={() => setImageOk(false)}
        />
      )}
      {(!src || !imageOk) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <span className="mb-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/80">{style.vibe}</span>
          <span className={`font-black leading-tight text-white drop-shadow ${NAME_CLASS[size]}`}>{style.name}</span>
        </div>
      )}
      {onClick && (
        <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full bg-white/90 py-1 text-center text-[10px] font-black opacity-0 backdrop-blur transition group-hover:opacity-100">
          See it →
        </span>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left" aria-label={ariaLabel ?? `Preview ${style.name}`}>
        {inner}
        <p className="mt-1.5 text-[11px] font-black text-neutral-800">{style.name}</p>
        <p className="text-[10px] text-neutral-500">{style.tagline}</p>
      </button>
    );
  }
  return (
    <div className="block">
      {inner}
      {size !== "sm" && (
        <>
          <p className="mt-1.5 text-[11px] font-black text-neutral-800">{style.name}</p>
          <p className="text-[10px] text-neutral-500">{style.tagline}</p>
        </>
      )}
    </div>
  );
}
