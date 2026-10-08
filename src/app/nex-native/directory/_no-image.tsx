// src/app/nex-native/directory/_no-image.tsx
//
// NEX Directory · Phase A · Elegant no-image treatment.
//
// What this is
//   · A deliberate visual element for Directory cards that do NOT
//     have a real `primaryImage`. The founder's directive: "intentional,
//     elegant no-image treatment that does NOT pretend an image
//     exists."
//
// What this is NOT
//   · Not a stock image.
//   · Not a stolen image.
//   · Not a fabricated business photo.
//   · Not a placeholder that LOOKS like a photo.
//
// Visual approach
//   · A classification-aware monogram/icon in a subtle gradient block,
//     keyed to NEX's palette. The user can tell at a glance that
//     "this listing has no uploaded image yet" without ever being
//     deceived into thinking they are looking at the listing's
//     storefront.
//   · Business / Person / Place each get a distinct, abstract icon
//     drawn purely in SVG — no network fetch, no asset dependency.

import type * as React from "react";
import type { DirectoryClassification } from "@/lib/nex-native/directory";

interface NoImageProps {
  readonly classification: DirectoryClassification;
  readonly name: string;
  readonly size?: "card" | "hero";
}

const PALETTE = {
  bg: "#0E1526",
  bgAlt: "#182540",
  orange: "#FF7200",
  cyan: "#00AFFF",
  textMuted: "#7D9BC0",
  textDim: "#B5C3D6",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

const CLASSIFICATION_ACCENT: Record<DirectoryClassification, string> = {
  business: PALETTE.orange,
  person: PALETTE.cyan,
  place: PALETTE.textDim,
};

export function NoImage(props: NoImageProps): React.ReactElement {
  const accent = CLASSIFICATION_ACCENT[props.classification];
  const monogram = extractMonogram(props.name);
  const dim = props.size === "hero" ? 240 : 72;

  return (
    <div
      data-nex-directory-no-image
      data-nex-directory-no-image-classification={props.classification}
      aria-hidden="true"
      style={{
        width: dim,
        height: dim,
        flexShrink: 0,
        borderRadius: 14,
        background: `linear-gradient(135deg, ${PALETTE.bg} 0%, ${PALETTE.bgAlt} 100%)`,
        border: `1px solid ${PALETTE.borderSoft}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 10,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <ClassificationGlyph classification={props.classification} color={accent} />
      </div>
      <span
        style={{
          fontSize: props.size === "hero" ? 72 : 24,
          lineHeight: 1,
          fontWeight: 700,
          color: accent,
          letterSpacing: "0.02em",
          opacity: 0.85,
        }}
      >
        {monogram}
      </span>
    </div>
  );
}

function extractMonogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "·";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

function ClassificationGlyph(props: {
  readonly classification: DirectoryClassification;
  readonly color: string;
}): React.ReactElement {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: props.color,
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (props.classification === "business") {
    return (
      <svg {...common}>
        <rect x="4" y="7" width="16" height="13" rx="1" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M4 12h16" />
      </svg>
    );
  }
  if (props.classification === "person") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}
