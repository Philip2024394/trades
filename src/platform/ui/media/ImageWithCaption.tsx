// ImageWithCaption — photo with dark gradient overlay + caption.
//
// Reference: https://github.com/themesberg/flowbite — content
// sections · image cards. Rewritten with our tokens.
//
// The gradient sits from bottom-40% to transparent so the caption
// reads on any photo — no need to pick "photo-safe" colours.

import type { ReactNode } from "react";
import { AspectRatio } from "./AspectRatio";
import type { AspectRatioPreset } from "./AspectRatio";
import { CARD_RADIUS } from "../tokens";

export type ImageWithCaptionProps = {
  /** Image slot — pass an <img> or any node. */
  image: ReactNode;
  /** Overline text above the caption. */
  overline?: string;
  caption: string;
  supporting?: string;
  aspect?: AspectRatioPreset;
  /** How intense the gradient should be. */
  gradient?: "subtle" | "strong";
};

export function ImageWithCaption({
  image,
  overline,
  caption,
  supporting,
  aspect = "landscape",
  gradient = "strong"
}: ImageWithCaptionProps) {
  const gradientClass =
    gradient === "strong"
      ? "bg-gradient-to-t from-neutral-900/85 via-neutral-900/40 to-transparent"
      : "bg-gradient-to-t from-neutral-900/60 via-neutral-900/20 to-transparent";
  return (
    <figure className={`relative overflow-hidden ${CARD_RADIUS} bg-neutral-100`}>
      <AspectRatio preset={aspect}>{image}</AspectRatio>
      <div className={`pointer-events-none absolute inset-0 ${gradientClass}`} />
      <figcaption className="absolute inset-x-0 bottom-0 p-3 text-white md:p-4">
        {overline ? (
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            {overline}
          </div>
        ) : null}
        <div className="mt-0.5 text-[14px] font-semibold leading-tight md:text-[16px]">
          {caption}
        </div>
        {supporting ? (
          <div className="mt-1 text-[12px] leading-relaxed text-neutral-200">
            {supporting}
          </div>
        ) : null}
      </figcaption>
    </figure>
  );
}
