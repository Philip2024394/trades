// NEX icon library
// ─────────────────────────────────────────────────────────────────
// Named-icon component wrapping Philip's ImageKit-hosted NEX icons.
// Use in place of raw <img> so the URL list stays in one place.
//
// Usage:
//   <NexIcon name="thinking" size={22} />
//   <NexIcon name="checklist" size={18} />
//
// Adding a new icon: Philip provides the ImageKit URL → drop it into
// NEX_ICONS below with a semantic name. Never inline raw URLs at the
// call site.

"use client";

import Image from "next/image";

export type NexIconName =
  | "thinking"        // brain · shown while NEX reasons about the question
  | "gallery"         // multi-image loading · shown while gallery composes
  | "before_after"    // paired before/after image pair
  | "calculations"    // cost / estimator
  | "measurements"    // dimensional reasoning
  | "materials"       // timber / material choice
  | "checklist"       // task list · next-steps · readiness check
  | "trusted"         // trusted company / reviewed
  | "reviews"         // review-related
  | "bullseye";       // exact match · user got it right

const NEX_ICONS: Record<NexIconName, string> = {
  thinking:     "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsddsddfsdsd-removebg-preview.png?updatedAt=1784870473582",
  before_after: "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsdd-removebg-preview.png?updatedAt=1784870201814",
  calculations: "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsd-removebg-preview.png?updatedAt=1784870138872",
  gallery:      "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasd-removebg-preview.png?updatedAt=1784870078725",
  measurements: "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasd-removebg-preview.png?updatedAt=1784870013307",
  materials:    "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsddsd-removebg-preview.png?updatedAt=1784870262679",
  checklist:    "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsddsddf-removebg-preview.png?updatedAt=1784870335564",
  trusted:      "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsddsddfsdsddgf-removebg-preview.png?updatedAt=1784870632723",
  reviews:      "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsddsddfsd-removebg-preview.png?updatedAt=1784870411854",
  bullseye:     "https://ik.imagekit.io/5vv5pw26q/Untitledsddsdasdadsasdasdasdsddsddfsdsdd-removebg-preview.png?updatedAt=1784870540626",
};

export function NexIcon({
  name,
  size = 22,
  className,
  style,
}: {
  name: NexIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const src = NEX_ICONS[name];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized                       // ImageKit already CDN-serves
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",           // per global rule · no cropping
        ...style,
      }}
    />
  );
}
