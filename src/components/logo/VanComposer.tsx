"use client";

// Van composer — renders a VanLayout (list of typed elements) on
// top of a van image tinted to the picked colour.
//
// Element kinds supported:
//   • logo      — image, positioned + sized in %
//   • text      — business name / strap line / anything typed
//   • strip     — filled rounded band with optional text (phone bar)
//   • ribbon    — angled label
//   • divider   — thin coloured rule
//
// The van image is tinted via a multiply blend over a colour layer
// so white PNGs read as any paint colour. For production print files
// we'd swap to SVG vans + fill swap; this pattern is preview-grade.

import type { VanTemplate } from "@/lib/logo/vans";
import type { VanColour } from "@/lib/logo/vans";
import type { VanLayout, LayoutElement } from "@/lib/logo/vanLayout";

type Props = {
  van:       VanTemplate;
  colour?:   VanColour | null;
  layout:    VanLayout;
};

export function VanComposer({ van, colour, layout }: Props) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-neutral-50">
      {/* Colour underlay — sits behind the van image and gets multiplied through */}
      {colour && (
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: colour.hex }}
        />
      )}

      {/* Van image — mix-blend-multiply against the colour underlay
          converts a white/silver van into any paint colour. Not
          perfect for dark vans on black backgrounds, but good enough
          for preview. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={van.imageUrl}
        alt={`${van.model} — ${van.angle}`}
        className="relative z-10 block h-auto w-full"
        style={{
          maxHeight:    "70vh",
          objectFit:    "contain",
          mixBlendMode: colour ? "multiply" : undefined
        }}
      />

      {/* Overlay layer — every layout element positioned in % */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {layout.elements.map((el, i) => (
          <RenderElement key={i} el={el}/>
        ))}
      </div>
    </div>
  );
}

function RenderElement({ el }: { el: LayoutElement }) {
  if (el.kind === "logo") {
    return (
      <div
        className="absolute"
        style={{
          left:    `${el.xPct}%`,
          top:     `${el.yPct}%`,
          width:   `${el.wPct}%`,
          height:  `${el.hPct}%`,
          opacity: el.opacity ?? 1,
          transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={el.url} alt="logo" className="h-full w-full object-contain drop-shadow-md"/>
      </div>
    );
  }

  if (el.kind === "text") {
    return (
      <div
        className="absolute"
        style={{
          left:  `${el.xPct}%`,
          top:   `${el.yPct}%`,
          width: `${el.wPct}%`,
          color: el.colour,
          fontWeight: el.fontWeight ?? "black",
          fontSize:   `${el.fontSizeVw ?? 2.6}vw`,
          textAlign:  el.align ?? "left",
          fontStyle:  el.italic ? "italic" : undefined,
          letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : undefined,
          textTransform: el.uppercase ? "uppercase" : undefined,
          textShadow: el.shadow ? "0 1px 2px rgba(255,255,255,0.6)" : undefined,
          lineHeight: 1
        }}
      >
        {el.content}
      </div>
    );
  }

  if (el.kind === "strip") {
    return (
      <div
        className="absolute flex items-center justify-center font-black"
        style={{
          left:   `${el.xPct}%`,
          top:    `${el.yPct}%`,
          width:  `${el.wPct}%`,
          height: `${el.hPct}%`,
          backgroundColor: el.backgroundColour,
          color: el.textColour ?? "#ffffff",
          fontSize: `${el.fontSizeVw ?? 1.8}vw`,
          borderRadius: `${el.radiusPx ?? 6}px`,
          letterSpacing: "0.05em",
          padding: "0 0.5em"
        }}
      >
        {el.text ?? ""}
      </div>
    );
  }

  if (el.kind === "ribbon") {
    return (
      <div
        className="absolute font-black"
        style={{
          left:  `${el.xPct}%`,
          top:   `${el.yPct}%`,
          width: `${el.wPct}%`,
          backgroundColor: el.colour,
          color: el.textColour,
          padding: "0.25em 0.6em",
          transform: `rotate(${el.angle ?? -8}deg)`,
          transformOrigin: "left center",
          fontSize: "1.1vw",
          textAlign: "center",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
        }}
      >
        {el.text}
      </div>
    );
  }

  if (el.kind === "divider") {
    return (
      <div
        className="absolute"
        style={{
          left:  `${el.xPct}%`,
          top:   `${el.yPct}%`,
          width: `${el.wPct}%`,
          height: `${el.heightPx ?? 3}px`,
          backgroundColor: el.colour
        }}
      />
    );
  }

  return null;
}
