// AspectRatio — ratio wrapper for images, videos, iframes.
//
// Reference: https://github.com/markmead/hyperui — media wrappers
// pattern. Rewritten with our tokens; presets match trade needs
// (4:3 landscape, 3:4 portrait, 16:9 video, 1:1 square).
//
// Prefer named presets over raw ratios so we can adjust one place
// when brand guidelines shift.

import type { ReactNode } from "react";

export type AspectRatioPreset =
  | "landscape"     // 4:3 — default for project photos
  | "portrait"     // 3:4 — mobile hero images, tall project shots
  | "square"       // 1:1 — avatars, tile media
  | "video"        // 16:9 — video embeds
  | "wide"         // 21:9 — hero banners
  | "auto";        // caller supplies raw aspect

const PRESET_CLASS: Record<AspectRatioPreset, string> = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[21/9]",
  auto: ""
};

export type AspectRatioProps = {
  preset?: AspectRatioPreset;
  /** Custom ratio when preset="auto" — e.g. "5/2". */
  ratio?: string;
  className?: string;
  children: ReactNode;
};

export function AspectRatio({
  preset = "landscape",
  ratio,
  className = "",
  children
}: AspectRatioProps) {
  const cls =
    preset === "auto" && ratio
      ? `aspect-[${ratio}]`
      : PRESET_CLASS[preset];
  return (
    <div className={`overflow-hidden ${cls} ${className}`.trim()}>
      {children}
    </div>
  );
}
