// src/components/nex/RentalListingCard.tsx · Philip 2026-08-29
//
// Bike rental listing card matching the Trade Centre theme.
// Theme tokens (from src/components/nex-app/centre/NexCentreShell.tsx:51):
//   · bg          #FAF8F4 (warm off-white, page level)
//   · card        #FFFFFF
//   · primary     #F68A1E (deeper orange · CTA + accents)
//   · secondary   #FFB15A
//   · lightOrange #FFE7CC
//   · whatsapp    #166534 (dark green · messaging CTA)
//   · text        #222222
//   · textSoft    #6B7280
//   · border      #ECECEC (slight gray rim)
//
// Fields shown:
//   · Bike image (tinted to a deterministic paint color for consistency)
//   · Rental name + city + neighbourhood
//   · Amenities strip: helmets, raincoats, hotel/villa drop-off, tank full
//   · Pricing: per day / week / month (IDR)
//   · Rent-or-buy option (when has_buy_option) with buy price
//   · Rating pill + WhatsApp CTA + Reserve CTA

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { bikeRentalCardData, type TaxonomyBike, type BikeCategory } from "@/lib/nex/bikeRentalRotation";

export const T_TC = {
  bg:           "#FAF8F4",
  card:         "#FFFFFF",
  primary:      "#F68A1E",
  secondary:    "#FFB15A",
  lightOrange:  "#FFE7CC",
  whatsapp:     "#166534",
  text:         "#222222",
  textSoft:     "#6B7280",
  border:       "#ECECEC",
  gradient:     "linear-gradient(135deg, #F68A1E 0%, #FFB15A 100%)",
  shadowSoft:   "0 10px 30px -14px rgba(246,138,30,0.18), 0 4px 14px -8px rgba(0,0,0,0.06)",
  shadowLift:   "0 20px 50px -18px rgba(246,138,30,0.28), 0 8px 20px -10px rgba(0,0,0,0.08)",
};

export interface RentalListing {
  rental_id: string;
  slug: string;
  name: string;
  city: string;
  neighbourhood?: string | null;
  whatsapp_e164?: string | null;
  preferred_bike_slug?: string | null;
  preferred_categories: BikeCategory[];
  helmets_included: number;
  raincoats_included: number;
  hotel_villa_dropoff: boolean;
  tank_full_on_rental: boolean;
  airport_pickup_on_arrival?: boolean;
  price_per_day_idr?: number | null;
  price_per_week_idr?: number | null;
  price_per_month_idr?: number | null;
  has_buy_option: boolean;
  buy_price_idr?: number | null;
  rating_avg?: number | null;
  rating_count: number;
}

// Format IDR compactly · "Rp 70k" / "Rp 1.4M" / "Rp 18.5jt" style
function fmtIdr(n?: number | null): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1_000)     return `Rp ${(n / 1_000).toFixed(0)}k`;
  return `Rp ${n}`;
}

// Same canvas paint-swap as DriverBikeCard (localised here to keep component self-contained)
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
}
function rgbToHsl(r: number, g: number, b: number) {
  const rN = r/255, gN = g/255, bN = b/255;
  const max = Math.max(rN,gN,bN), min = Math.min(rN,gN,bN);
  const l = (max + min)/2; let h=0, s=0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case rN: h = (gN-bN)/d + (gN<bN?6:0); break;
      case gN: h = (bN-rN)/d + 2; break;
      case bN: h = (rN-gN)/d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  let r=0,g=0,b=0;
  if (s===0) r=g=b=l;
  else {
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l - q;
    const hue = (t: number) => {
      if (t<0) t+=1; if (t>1) t-=1;
      if (t<1/6) return p+(q-p)*6*t;
      if (t<1/2) return q;
      if (t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    r = hue(h+1/3); g = hue(h); b = hue(h-1/3);
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}
function tintBike(source: HTMLImageElement, targetHex: string): string {
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
  for (let i=0; i<d.length; i+=4) {
    const a = d[i+3]; if (a === 0) continue;
    const hsl = rgbToHsl(d[i], d[i+1], d[i+2]);
    if (hsl.l < 0.15 || hsl.l > 0.88 || hsl.s < 0.16) continue;
    const newS = Math.min(1, targetHsl.s * 0.75 + hsl.s * 0.25);
    const rgb = hslToRgb(targetHsl.h, newS, hsl.l);
    d[i]=rgb.r; d[i+1]=rgb.g; d[i+2]=rgb.b;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function RentalListingCard({
  rental, taxonomy, onReserve, onWhatsapp,
}: {
  rental: RentalListing;
  taxonomy: TaxonomyBike[];
  onReserve?: () => void;
  onWhatsapp?: () => void;
}) {
  // Pick bike deterministically · either explicit preferred_bike_slug or rotation
  const pick = useMemo(() => {
    if (rental.preferred_bike_slug) {
      const b = taxonomy.find((t) => t.slug === rental.preferred_bike_slug);
      if (b) {
        const paintHex = bikeRentalCardData(rental.slug, [b])?.paintHex ?? "#F68A1E";
        return { bike: b, paintHex };
      }
    }
    return bikeRentalCardData(rental.slug, taxonomy, rental.preferred_categories);
  }, [rental, taxonomy]);

  const bike = pick?.bike;
  const paintHex = pick?.paintHex ?? "#F68A1E";
  const baseSrc = bike ? `/nex/bikes/${bike.slug}.png` : "";
  const [displaySrc, setDisplaySrc] = useState<string>(baseSrc);

  useEffect(() => {
    if (!baseSrc) return;
    setDisplaySrc(baseSrc);
    const img = new Image();
    img.onload = () => {
      try { setDisplaySrc(tintBike(img, paintHex)); } catch { /* keep base */ }
    };
    img.onerror = () => { /* keep base */ };
    img.src = baseSrc;
  }, [baseSrc, paintHex]);

  return (
    <div style={{
      background: T_TC.card,
      border: `1px solid ${T_TC.border}`,
      borderRadius: 18,
      boxShadow: T_TC.shadowSoft,
      overflow: "hidden",
      color: T_TC.text,
      transition: "box-shadow 200ms ease, transform 200ms ease",
    }}>
      {/* Image band · warm gradient bg so bike pops on white */}
      <div style={{
        position: "relative",
        background: T_TC.gradient,
        height: 148,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {bike && (
          <img
            src={displaySrc}
            alt={`${bike.brand} ${bike.model}`}
            style={{
              maxWidth: "80%", maxHeight: "128px",
              width: "auto", height: "auto", objectFit: "contain",
              filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.25))",
            }}
          />
        )}
        {/* Rating pill · top left · when we have one */}
        {rental.rating_avg != null && (
          <span style={{
            position: "absolute", top: 10, left: 10,
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "rgba(255,255,255,0.95)",
            color: T_TC.text,
            fontSize: 11, fontWeight: 800,
            padding: "3px 8px", borderRadius: 999,
            boxShadow: "0 2px 6px rgba(0,0,0,0.14)",
          }}>
            ★ {rental.rating_avg.toFixed(1)}
            {rental.rating_count > 0 && <span style={{ color: T_TC.textSoft, fontWeight: 600 }}> · {rental.rating_count}</span>}
          </span>
        )}
        {/* Buy-option chip · top right · when available */}
        {rental.has_buy_option && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            display: "inline-flex", alignItems: "center", gap: 4,
            background: T_TC.whatsapp,
            color: "#ffffff",
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
            padding: "3px 8px", borderRadius: 999,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            textTransform: "uppercase",
          }}>Rent or Buy</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px" }}>
        {/* Rental name + location */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T_TC.text, lineHeight: 1.2 }}>
            {rental.name}
          </div>
          <div style={{ fontSize: 12, color: T_TC.textSoft, marginTop: 3 }}>
            📍 {rental.neighbourhood ? `${rental.neighbourhood}, ${rental.city}` : rental.city}
          </div>
        </div>

        {/* Bike detail line · brand / model / cc */}
        {bike && (
          <div style={{
            marginTop: 10,
            fontSize: 12, color: T_TC.textSoft,
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
          }}>
            <span style={{ fontWeight: 700, color: T_TC.text }}>{bike.brand} {bike.model}</span>
            <span>· {bike.cc > 0 ? `${bike.cc}cc` : "electric"}</span>
            <span>·</span>
            <span style={{
              width: 12, height: 12, borderRadius: 999,
              background: paintHex,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
            }} />
            <span style={{ fontSize: 10, color: T_TC.textSoft, letterSpacing: 0.5, textTransform: "uppercase" }}>
              example
            </span>
          </div>
        )}

        {/* Amenities strip */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          marginTop: 12,
        }}>
          <Amenity icon="🪖" label={`${rental.helmets_included} helmet${rental.helmets_included === 1 ? "" : "s"}`} />
          {rental.raincoats_included > 0 && (
            <Amenity icon="🌂" label={`${rental.raincoats_included} raincoat${rental.raincoats_included === 1 ? "" : "s"}`} />
          )}
          {rental.hotel_villa_dropoff && <Amenity icon="🏨" label="Hotel/villa drop-off" />}
          {rental.tank_full_on_rental && <Amenity icon="⛽" label="Full tank" />}
          {rental.airport_pickup_on_arrival && <Amenity icon="✈️" label="Airport pickup" />}
        </div>

        {/* Pricing tiers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginTop: 14,
          padding: "10px 12px",
          background: T_TC.lightOrange,
          borderRadius: 12,
        }}>
          <PriceTier label="Day"   value={fmtIdr(rental.price_per_day_idr)} />
          <PriceTier label="Week"  value={fmtIdr(rental.price_per_week_idr)} />
          <PriceTier label="Month" value={fmtIdr(rental.price_per_month_idr)} />
        </div>

        {/* Buy option row */}
        {rental.has_buy_option && rental.buy_price_idr && (
          <div style={{
            marginTop: 10, padding: "8px 12px",
            background: "#F0FDF4",
            border: `1px solid ${T_TC.whatsapp}22`,
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12,
          }}>
            <span style={{ color: T_TC.textSoft }}>Also for sale</span>
            <span style={{ fontWeight: 800, color: T_TC.whatsapp }}>{fmtIdr(rental.buy_price_idr)}</span>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button onClick={onWhatsapp} style={{
            padding: "10px 12px", minHeight: 44,
            fontSize: 13, fontWeight: 700,
            background: T_TC.whatsapp,
            color: "#ffffff",
            border: "none", borderRadius: 10,
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            💬 WhatsApp
          </button>
          <button onClick={onReserve} style={{
            padding: "10px 12px", minHeight: 44,
            fontSize: 13, fontWeight: 700,
            background: T_TC.primary,
            color: "#ffffff",
            border: "none", borderRadius: 10,
            cursor: "pointer",
          }}>
            Reserve
          </button>
        </div>
      </div>
    </div>
  );
}

function Amenity({ icon, label }: { icon: string; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600,
      padding: "4px 9px", borderRadius: 999,
      background: T_TC.lightOrange, color: "#8B4B00",
      border: "1px solid #F5D6A6",
    }}>
      <span aria-hidden style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </span>
  );
}

function PriceTier({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8,
        color: "#8B4B00", textTransform: "uppercase",
      }}>{label}</div>
      <div style={{
        fontSize: 14, fontWeight: 800, color: T_TC.text, marginTop: 2,
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
    </div>
  );
}
