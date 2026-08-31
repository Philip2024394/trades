// src/app/nex-bike-rental-register/page.tsx · Philip 2026-08-29 · v2
//
// Redesigned rental company onboarding:
//   · Cascade bike picker · brand → cc → model → color
//   · Cinematic bike reveal when all 3 dropdowns filled (fade + tint pulse)
//   · Amenity rows with large emoji icons in soft circles · dropdown for
//     count-based (helmets/raincoats) · tick boxes for boolean (tank/dropoff/airport)
//   · Live preview via RentalListingCard reflects everything
//
// Trade Centre theme throughout.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { RentalListingCard, T_TC, type RentalListing } from "@/components/nex/RentalListingCard";
import type { TaxonomyBike } from "@/lib/nex/bikeRentalRotation";

const CITIES = ["Jakarta","Denpasar","Canggu","Ubud","Sanur","Bandung","Yogyakarta","Surabaya","Malang","Lombok","Gili Trawangan","Medan"];

const PALETTE = [
  { hex: "#dc2626", name: "Red" }, { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Yellow" }, { hex: "#22c55e", name: "Green" },
  { hex: "#3b82f6", name: "Blue" }, { hex: "#8b5cf6", name: "Purple" },
  { hex: "#ec4899", name: "Pink" }, { hex: "#78350f", name: "Brown" },
  { hex: "#f5f5dc", name: "Cream" }, { hex: "#94a3b8", name: "Silver" },
  { hex: "#111827", name: "Black" }, { hex: "#f1f5f9", name: "White" },
];

// Canvas paint-swap · scoped copy so the cinematic reveal is self-contained
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
}
function rgbToHsl(r: number, g: number, b: number) {
  const rN = r/255, gN = g/255, bN = b/255;
  const max = Math.max(rN,gN,bN), min = Math.min(rN,gN,bN);
  const l = (max+min)/2; let h=0, s=0;
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

export default function RentalRegisterPage() {
  const [bikes, setBikes] = useState<TaxonomyBike[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Canggu");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [whatsapp, setWhatsapp] = useState("+62");

  // Amenities
  const [helmets, setHelmets] = useState<1|2>(2);
  const [raincoats, setRaincoats] = useState<0|1|2>(1);
  const [tankFull, setTankFull] = useState(true);
  const [dropoff, setDropoff] = useState(true);
  const [airportPickup, setAirportPickup] = useState(false);

  // Pricing
  const [pDay, setPDay] = useState<number | "">(80000);
  const [pWeek, setPWeek] = useState<number | "">(450000);
  const [pMonth, setPMonth] = useState<number | "">(1500000);
  const [hasBuy, setHasBuy] = useState(false);
  const [buyPrice, setBuyPrice] = useState<number | "">("");

  // Cascade bike picker
  const [brand, setBrand] = useState<string>("");
  const [cc, setCc] = useState<number | "">("");
  const [modelSlug, setModelSlug] = useState<string>("");
  const [paintHex, setPaintHex] = useState<string>("#3b82f6");

  // Cinematic reveal
  const [revealSrc, setRevealSrc] = useState<string>("");
  const [revealKey, setRevealKey] = useState(0);           // bump to retrigger animation

  const [submitState, setSubmitState] = useState<"idle"|"submitting"|"ok"|"error">("idle");
  const [serverMsg, setServerMsg] = useState<string>("");

  useEffect(() => {
    fetch("/api/nex/bike-models").then((r) => r.json()).then((d) => setBikes(d.bikes ?? []));
  }, []);

  // Cascade derived lists
  const brands = useMemo(() => Array.from(new Set(bikes.map((b) => b.brand))).sort(), [bikes]);
  const ccsForBrand = useMemo(() => {
    if (!brand) return [];
    return Array.from(new Set(bikes.filter((b) => b.brand === brand).map((b) => b.cc))).sort((a,b) => a - b);
  }, [bikes, brand]);
  const modelsForBrandCc = useMemo(() => {
    if (!brand || cc === "") return [];
    return bikes.filter((b) => b.brand === brand && b.cc === cc);
  }, [bikes, brand, cc]);
  const selectedBike = useMemo(() => bikes.find((b) => b.slug === modelSlug), [bikes, modelSlug]);

  // Auto-reset downstream when upstream changes
  useEffect(() => {
    if (brand && !bikes.some((b) => b.brand === brand && b.cc === cc)) setCc("");
  }, [brand, bikes, cc]);
  useEffect(() => {
    if (cc !== "" && !bikes.some((b) => b.slug === modelSlug && b.brand === brand && b.cc === cc)) setModelSlug("");
  }, [cc, bikes, modelSlug, brand]);

  // Cinematic reveal · when model + color chosen, load + tint
  useEffect(() => {
    if (!selectedBike) { setRevealSrc(""); return; }
    const baseSrc = `/nex/bikes/${selectedBike.slug}.png`;
    setRevealSrc(baseSrc);
    setRevealKey((k) => k + 1);              // retrigger fade-in
    const img = new Image();
    img.onload = () => {
      try {
        const tinted = tintBike(img, paintHex);
        setRevealSrc(tinted);
        setRevealKey((k) => k + 1);          // retrigger for color pulse
      } catch { /* keep base */ }
    };
    img.src = baseSrc;
  }, [selectedBike, paintHex]);

  const previewListing = useMemo<RentalListing>(() => ({
    rental_id: "preview", slug: "preview",
    name: name || "Your rental name",
    city,
    neighbourhood: neighbourhood || null,
    whatsapp_e164: whatsapp,
    preferred_bike_slug: modelSlug || null,
    preferred_categories: selectedBike ? [selectedBike.category] : [],
    helmets_included: helmets,
    raincoats_included: raincoats,
    hotel_villa_dropoff: dropoff,
    tank_full_on_rental: tankFull,
    airport_pickup_on_arrival: airportPickup,
    price_per_day_idr:   pDay   === "" ? null : Number(pDay),
    price_per_week_idr:  pWeek  === "" ? null : Number(pWeek),
    price_per_month_idr: pMonth === "" ? null : Number(pMonth),
    has_buy_option: hasBuy,
    buy_price_idr: buyPrice === "" ? null : Number(buyPrice),
    rating_avg: null,
    rating_count: 0,
  }), [name, city, neighbourhood, whatsapp, modelSlug, selectedBike,
       helmets, raincoats, dropoff, tankFull, airportPickup,
       pDay, pWeek, pMonth, hasBuy, buyPrice]);

  async function submit() {
    setSubmitState("submitting"); setServerMsg("");
    try {
      const resp = await fetch("/api/nex/bike-rental/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, city, neighbourhood: neighbourhood || null,
          whatsapp_e164: whatsapp,
          preferred_bike_slug: modelSlug || null,
          preferred_categories: selectedBike ? [selectedBike.category] : [],
          helmets_included: helmets, raincoats_included: raincoats,
          hotel_villa_dropoff: dropoff, tank_full_on_rental: tankFull,
          airport_pickup_on_arrival: airportPickup,
          price_per_day_idr:   pDay   === "" ? null : Number(pDay),
          price_per_week_idr:  pWeek  === "" ? null : Number(pWeek),
          price_per_month_idr: pMonth === "" ? null : Number(pMonth),
          has_buy_option: hasBuy,
          buy_price_idr: buyPrice === "" ? null : Number(buyPrice),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setSubmitState("error");
        setServerMsg(Array.isArray(data.errors) ? data.errors.join(" · ") : (data.error ?? "failed"));
      } else {
        setSubmitState("ok");
        setServerMsg(`Registered · slug=${data.slug}`);
      }
    } catch (err) {
      setSubmitState("error");
      setServerMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: T_TC.bg,
      color: T_TC.text,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "24px 16px 60px",
    }}>
      <style>{`
        @keyframes nex-bike-reveal {
          0%   { opacity: 0; transform: translateY(12px) scale(0.94); }
          60%  { opacity: 1; transform: translateY(0)   scale(1.02); filter: brightness(1.25); }
          100% { opacity: 1; transform: translateY(0)   scale(1);    filter: brightness(1); }
        }
        @keyframes nex-bike-bob-slow {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-4px); }
        }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
          color: T_TC.primary, fontWeight: 800, marginBottom: 4,
        }}>Rental company · register</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>
          List your bike rental on NEX
        </h1>

        {/* Live preview */}
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <SectionLabel>How riders will see you</SectionLabel>
          <RentalListingCard rental={previewListing} taxonomy={bikes} />
        </div>

        {/* Form container */}
        <div style={{
          padding: "20px 22px", borderRadius: 16,
          background: T_TC.card, border: `1px solid ${T_TC.border}`,
          display: "flex", flexDirection: "column", gap: 20,
          boxShadow: T_TC.shadowSoft,
        }}>
          {/* Basics */}
          <FieldGroup title="Company details">
            <FL label="Rental company name">
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Bali Scooter Rent · Canggu" style={inp} />
            </FL>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <FL label="City">
                <select value={city} onChange={(e) => setCity(e.target.value)} style={inp}>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FL>
              <FL label="Neighbourhood (optional)">
                <input value={neighbourhood} onChange={(e) => setNeighbourhood(e.target.value)}
                  placeholder="Berawa" style={inp} />
              </FL>
            </div>
            <div style={{ marginTop: 10 }}>
              <FL label="WhatsApp (+62 ...)">
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+6281234567890" style={inp} />
              </FL>
            </div>
          </FieldGroup>

          {/* Amenities · icon rows */}
          <FieldGroup title="Amenities included with each rental">
            <AmenityRow icon="🪖" label="Helmets" hint="One extra for a passenger">
              <NumberPicker value={helmets} onChange={(v) => setHelmets(v as 1|2)} options={[1, 2]} suffix="helmet" />
            </AmenityRow>
            <AmenityRow icon="🌂" label="Raincoats" hint="Vital during monsoon Oct-Apr">
              <NumberPicker value={raincoats} onChange={(v) => setRaincoats(v as 0|1|2)} options={[0, 1, 2]} suffix="raincoat" allowZero />
            </AmenityRow>
            <AmenityRow icon="⛽" label="Full tank on pickup" hint="Rider returns with same fuel level">
              <TickBox checked={tankFull} onChange={setTankFull} />
            </AmenityRow>
            <AmenityRow icon="🏨" label="Hotel/villa drop-off &amp; pick-up" hint="You deliver + collect the bike at their stay">
              <TickBox checked={dropoff} onChange={setDropoff} />
            </AmenityRow>
            <AmenityRow icon="✈️" label="Airport pick-up on arrival" hint="Bike waiting at DPS / CGK / JOG / SUB arrivals">
              <TickBox checked={airportPickup} onChange={setAirportPickup} />
            </AmenityRow>
          </FieldGroup>

          {/* Bike cascade + cinematic reveal */}
          <FieldGroup title="Fleet · pick the bike you want to feature">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <FL label="Brand">
                <select value={brand} onChange={(e) => setBrand(e.target.value)} style={inp}>
                  <option value="">— brand —</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </FL>
              <FL label="CC">
                <select value={cc} onChange={(e) => setCc(e.target.value ? Number(e.target.value) : "")}
                  disabled={!brand} style={inp}>
                  <option value="">— cc —</option>
                  {ccsForBrand.map((c) => (
                    <option key={c} value={c}>{c === 0 ? "Electric" : `${c}cc`}</option>
                  ))}
                </select>
              </FL>
              <FL label="Model">
                <select value={modelSlug} onChange={(e) => setModelSlug(e.target.value)}
                  disabled={cc === ""} style={inp}>
                  <option value="">— model —</option>
                  {modelsForBrandCc.map((b) => (
                    <option key={b.slug} value={b.slug}>{b.model}</option>
                  ))}
                </select>
              </FL>
            </div>

            {/* Color picker */}
            <div style={{ marginTop: 12 }}>
              <FL label="Bike colour · applies live to the reveal below">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {PALETTE.map((c) => (
                    <button key={c.hex} type="button" onClick={() => setPaintHex(c.hex)} title={c.name}
                      style={{
                        width: 32, height: 32, borderRadius: 999,
                        background: c.hex, cursor: "pointer",
                        border: paintHex === c.hex ? "2px solid #0a0e18" : "1px solid #d1d5db",
                        boxShadow: paintHex === c.hex
                          ? "0 0 0 3px rgba(10,14,24,0.12)"
                          : "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                  ))}
                  <input type="color" value={paintHex} onChange={(e) => setPaintHex(e.target.value)}
                    style={{ width: 34, height: 34, padding: 0, borderRadius: 999,
                      border: "1px solid #d1d5db", background: "transparent", cursor: "pointer" }} />
                </div>
              </FL>
            </div>

            {/* Cinematic reveal · fades in when model chosen · pulses when color changes */}
            <div style={{
              marginTop: 16, borderRadius: 14, padding: "20px 20px",
              background: T_TC.gradient, minHeight: 200,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
            }}>
              {selectedBike && revealSrc ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    key={revealKey}
                    src={revealSrc}
                    alt={`${selectedBike.brand} ${selectedBike.model}`}
                    style={{
                      maxWidth: 320, maxHeight: 160,
                      objectFit: "contain",
                      animation: "nex-bike-reveal 800ms ease-out, nex-bike-bob-slow 2s 800ms ease-in-out infinite",
                      filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.35))",
                    }}
                  />
                  <div style={{
                    marginTop: 10, fontSize: 13, fontWeight: 700, color: "#fff",
                    letterSpacing: 0.3, textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                  }}>
                    {selectedBike.brand} {selectedBike.model}
                    {selectedBike.cc > 0 ? ` · ${selectedBike.cc}cc` : " · Electric"}
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: 12, color: "rgba(255,255,255,0.9)",
                  letterSpacing: 1, textTransform: "uppercase", fontWeight: 800,
                  textAlign: "center",
                }}>
                  Pick brand → cc → model to see your bike here
                </div>
              )}
            </div>
          </FieldGroup>

          {/* Pricing */}
          <FieldGroup title="Pricing (IDR · leave blank if not offered)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <FL label="Per day">
                <input type="number" min="0" step="5000" value={pDay}
                  onChange={(e) => setPDay(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="70000" style={{ ...inp, fontVariantNumeric: "tabular-nums" }} />
              </FL>
              <FL label="Per week">
                <input type="number" min="0" step="10000" value={pWeek}
                  onChange={(e) => setPWeek(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="400000" style={{ ...inp, fontVariantNumeric: "tabular-nums" }} />
              </FL>
              <FL label="Per month">
                <input type="number" min="0" step="50000" value={pMonth}
                  onChange={(e) => setPMonth(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="1400000" style={{ ...inp, fontVariantNumeric: "tabular-nums" }} />
              </FL>
            </div>
          </FieldGroup>

          {/* Buy option */}
          <FieldGroup title="Rent or Buy">
            <AmenityRow icon="💰" label="Also offer this bike for outright purchase" hint="Shows green 'Rent or Buy' chip on your listing">
              <TickBox checked={hasBuy} onChange={setHasBuy} />
            </AmenityRow>
            {hasBuy && (
              <div style={{ marginTop: 10 }}>
                <FL label="Buy price (IDR)">
                  <input type="number" min="0" step="100000" value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="18500000" style={{ ...inp, fontVariantNumeric: "tabular-nums" }} />
                </FL>
              </div>
            )}
          </FieldGroup>

          <button onClick={submit} disabled={submitState === "submitting"}
            style={{
              padding: "14px 16px", minHeight: 52,
              background: submitState === "submitting" ? `${T_TC.primary}88` : T_TC.primary,
              color: "#fff", border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 800, letterSpacing: 0.3,
              cursor: submitState === "submitting" ? "wait" : "pointer",
            }}>
            {submitState === "submitting" ? "Submitting…" : "Register rental listing"}
          </button>
          {serverMsg && (
            <div style={{
              padding: "10px 12px", borderRadius: 10, fontSize: 13,
              background: submitState === "ok" ? "#f0fdf4" : "#fef2f2",
              border: submitState === "ok" ? `1px solid ${T_TC.whatsapp}44` : "1px solid #fecaca",
              color: submitState === "ok" ? T_TC.whatsapp : "#b91c1c",
            }}>{serverMsg}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── UI primitives · scoped to this page ────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 14,
  borderRadius: 10, border: `1px solid ${T_TC.border}`,
  background: "#fff", color: T_TC.text, minHeight: 44,
};

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: T_TC.textSoft, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      {children}
    </label>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
      color: T_TC.textSoft, fontWeight: 700, marginBottom: 8,
    }}>{children}</div>
  );
}
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
        color: T_TC.textSoft, textTransform: "uppercase",
        marginBottom: 12,
      }}>{title}</div>
      {children}
    </div>
  );
}

function AmenityRow({ icon, label, hint, children }: {
  icon: string; label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 14px",
      background: T_TC.card,
      border: `1px solid ${T_TC.border}`,
      borderRadius: 12,
      marginBottom: 8,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 999,
        background: T_TC.lightOrange,
        display: "grid", placeItems: "center",
        fontSize: 26,
        boxShadow: "inset 0 0 0 1px #F5D6A6",
        flexShrink: 0,
      }} aria-hidden>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T_TC.text, lineHeight: 1.25 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11.5, color: T_TC.textSoft, marginTop: 2, lineHeight: 1.3 }}>{hint}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function NumberPicker({ value, onChange, options, suffix, allowZero }: {
  value: number; onChange: (v: number) => void; options: number[]; suffix: string; allowZero?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}
      style={{
        padding: "8px 12px", fontSize: 14, fontWeight: 700,
        borderRadius: 10, border: `1px solid ${T_TC.border}`,
        background: "#fff", color: T_TC.text,
        minWidth: 108, minHeight: 44,
        cursor: "pointer",
      }}>
      {options.map((n) => (
        <option key={n} value={n}>
          {n === 0 && allowZero ? `None` : `${n} ${suffix}${n === 1 ? "" : "s"}`}
        </option>
      ))}
    </select>
  );
}

function TickBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 44, height: 44, borderRadius: 10,
        background: checked ? T_TC.primary : "#fff",
        border: `1px solid ${checked ? T_TC.primary : T_TC.border}`,
        cursor: "pointer",
        boxShadow: checked ? "0 4px 10px rgba(246,138,30,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
        transition: "background 150ms ease",
      }}
      aria-pressed={checked}
    >
      <span style={{ fontSize: 20, color: checked ? "#fff" : T_TC.border, lineHeight: 1 }}>
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}
