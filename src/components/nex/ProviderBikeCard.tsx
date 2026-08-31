// src/components/nex/ProviderBikeCard.tsx
//
// NEX provider directory bike card · Philip 2026-08-29.
//
// Renders one provider's bike, tinted at runtime to the provider's declared
// bike_color_hex. Chat-surface frosted-glass card exception (like ambient
// knowledge cards) — regular chat stays typographic per doctrine.
//
// Color-swap: HTML canvas pixel-tint. Loads the base PNG (transparent bg),
// walks every pixel, applies a hue+tint transform that preserves black
// (rider leather, tires, engine) and only shifts the paint area. Cheap: one
// pass on mount + when color changes. No paid API. Doctrine: Free Infra.
//
// Consumer contract (mobility doctrine v5 · Provider not Driver):
//   <ProviderBikeCard
//     bikeSlug="honda-vario-160-red"
//     paintHex="#22c55e"                 // provider's actual bike color
//     providerName="Andi"
//     providerRating={4.9}
//     plate="B 4218 UYE"
//     yearRange="2022-2026"
//     cc={160}
//     category="matic"
//     brand="Honda"
//     model="Vario 160"
//     onSelect={() => ...}
//   />

"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ProviderBikeCardProps {
  bikeSlug: string;
  paintHex: string;
  providerName: string;
  providerRating?: number;
  plate?: string;
  yearRange?: string;
  cc?: number;
  category?: "matic" | "maxi" | "sport" | "commuter" | "bebek" | "adventure" | "retro" | "electric";
  brand?: string;
  model?: string;
  /** Language provider speaks besides Bahasa Indonesia (e.g. "English", "Mandarin"). */
  secondaryLanguage?: string;
  /** Whether provider carries a passenger raincoat (huge in monsoon Oct-Apr). */
  providesRaincoat?: boolean;
  onSelect?: () => void;
}

// Hex → RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

// RGB → HSL (for hue detection)
function rgbToHsl(r: number, g: number, b: number) {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: h = (bN - rN) / d + 2; break;
      case bN: h = (rN - gN) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

// Paint-swap pass:
//   · Preserve near-black (rider, tires, engine) · preserve near-white edges
//   · Any coloured pixel (saturation > 0.18, lightness 0.15-0.85) becomes
//     target hue while keeping its original lightness → smooth tint
//   · Alpha unchanged
function tintBikeToColor(source: HTMLImageElement, targetHex: string): string {
  const target = hexToRgb(targetHex);
  if (!target) return source.src;

  const targetHsl = rgbToHsl(target.r, target.g, target.b);
  const w = source.naturalWidth, h = source.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source.src;

  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a === 0) continue;

    const hsl = rgbToHsl(r, g, b);

    if (hsl.l < 0.15) continue;   // near-black · rider gear, tires, engine
    if (hsl.l > 0.88) continue;   // near-white · headlights, edges, glass
    if (hsl.s < 0.16) continue;   // low-saturation greys · chrome, matte

    const newH = targetHsl.h;
    const newS = Math.min(1, targetHsl.s * 0.75 + hsl.s * 0.25);
    const newL = hsl.l;

    const rgb = hslToRgb(newH, newS, newL);
    d[i]     = rgb.r;
    d[i + 1] = rgb.g;
    d[i + 2] = rgb.b;
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function hslToRgb(h: number, s: number, l: number) {
  let r = 0, g = 0, b = 0;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue(h + 1 / 3);
    g = hue(h);
    b = hue(h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

const CATEGORY_LABEL: Record<NonNullable<ProviderBikeCardProps["category"]>, string> = {
  matic:     "Matic",
  maxi:      "Maxi",
  sport:     "Sport",
  commuter:  "Commuter",
  bebek:     "Bebek",
  adventure: "Adventure",
  retro:     "Classic",
  electric:  "Electric",
};

export function ProviderBikeCard({
  bikeSlug, paintHex, providerName, providerRating, plate,
  yearRange, cc, category, brand, model,
  secondaryLanguage, providesRaincoat,
  onSelect,
}: ProviderBikeCardProps) {
  const originalSrc = `/nex/bikes/${bikeSlug}.png`;
  const [displaySrc, setDisplaySrc] = useState<string>(originalSrc);
  const [loading, setLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDisplaySrc(originalSrc);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      try {
        const tinted = tintBikeToColor(img, paintHex);
        if (!cancelled) { setDisplaySrc(tinted); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    img.onerror = () => { if (!cancelled) setLoading(false); };
    img.src = originalSrc;
    return () => { cancelled = true; };
  }, [originalSrc, paintHex]);

  return (
    <div
      onClick={onSelect}
      style={{
        position: "relative",
        maxWidth: 460,
        margin: "8px auto",
        padding: "16px 18px 14px",
        borderRadius: 20,
        background: "rgba(10,10,12,0.78)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        border: "1px solid rgba(148,163,184,0.22)",
        boxShadow:
          "0 12px 42px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
        color: "rgba(245,245,245,0.94)",
        cursor: onSelect ? "pointer" : "default",
        overflow: "hidden",
        transition: "transform 200ms ease",
      }}
    >
      {/* Header · doctrine v5: Provider not Driver */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase",
        marginBottom: 4,
      }}>
        <span style={{ color: "rgba(249,115,22,0.9)" }}>NEX · Available provider</span>
        {category && (
          <span style={{
            padding: "2px 8px", borderRadius: 8,
            background: "rgba(255,255,255,0.08)", color: "rgba(245,245,245,0.7)",
            fontSize: 10, letterSpacing: 0.8,
          }}>{CATEGORY_LABEL[category]}</span>
        )}
      </div>

      {/* Bike image · tinted */}
      <div style={{
        position: "relative",
        width: "100%",
        height: 160,
        margin: "8px 0 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: 12,
      }}>
        <img
          src={displaySrc}
          alt={`${brand ?? ""} ${model ?? bikeSlug}`}
          style={{
            display: "block",
            maxWidth: "72%",
            maxHeight: "150px",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            opacity: loading ? 0.6 : 1,
            transition: "opacity 250ms ease",
          }}
        />
      </div>

      {/* Bike detail line */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 14,
        marginBottom: 8,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(245,245,245,0.97)", lineHeight: 1.2 }}>
            {brand} {model}
          </div>
          <div style={{ fontSize: 12, color: "rgba(245,245,245,0.62)", marginTop: 3 }}>
            {yearRange && <span>{yearRange}</span>}
            {cc != null && cc > 0 && <span> · {cc}cc</span>}
            {category === "electric" && <span> · Electric</span>}
          </div>
        </div>
        {/* Colour chip · doctrine "LOOK FOR THE BLACK VARIO" */}
        <div style={{
          flexShrink: 0,
          width: 24, height: 24, borderRadius: 999,
          background: paintHex,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.35)",
        }} title={`Paint · ${paintHex}`} />
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0 10px" }} />

      {/* Provider row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 999,
            background: "linear-gradient(135deg, #f97316, #a855f7)",
            display: "grid", placeItems: "center",
            fontSize: 14, fontWeight: 700, color: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>{providerName[0]?.toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{providerName}</div>
            {providerRating != null && (
              <div style={{ fontSize: 11, color: "rgba(245,245,245,0.62)" }}>
                ★ {providerRating.toFixed(1)}
              </div>
            )}
          </div>
        </div>
        {plate && (
          <span style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11, fontWeight: 600, letterSpacing: 1,
            padding: "4px 8px", borderRadius: 6,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "rgba(245,245,245,0.85)",
          }}>{plate.toUpperCase()}</span>
        )}
      </div>

      {/* Amenities strip · language + raincoat · only when signal exists */}
      {(secondaryLanguage || providesRaincoat) && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          marginTop: 10, paddingTop: 10,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          {secondaryLanguage && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600,
              padding: "4px 9px", borderRadius: 999,
              background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "rgba(147,197,253,0.95)",
            }}
            title={`Speaks ${secondaryLanguage} + Bahasa Indonesia`}>
              <span aria-hidden style={{ fontSize: 12 }}>🗣</span>
              {secondaryLanguage}
            </span>
          )}
          {providesRaincoat && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600,
              padding: "4px 9px", borderRadius: 999,
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "rgba(134,239,172,0.95)",
            }} title="Passenger raincoat provided">
              <span aria-hidden style={{ fontSize: 12 }}>🌂</span>
              Raincoat
            </span>
          )}
        </div>
      )}
    </div>
  );
}
