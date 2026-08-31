// src/components/nex/RideStatusCard.tsx · Philip 2026-08-29
//
// Cinematic booking-status card · six phases (assigning → confirmed → en_route
// → nearby → arriving → riding), each with tuned motion + copy + gradient.
// Motion is CSS-only: 5px vertical bob + dust puffs behind rear wheel + speed
// lines. All disabled in assigning + riding so the card is calm when calm.
//
// En-route recolor: same canvas paint-swap engine as DriverBikeCard so the
// bike shown in transit is tinted to the driver's actual bike_color_hex.
// User sees the bike they'll be looking for.
//
// Consumer contract:
//   <RideStatusCard
//     phase="en_route"
//     serviceKind="ride"                  // "ride" | "parcel" | "food"
//     driverFirstName="Andi"
//     plate="B 4218 UYE"
//     etaSeconds={480}                     // remaining seconds
//     bikeSlug="honda-vario-160-red"       // for en-route recolor
//     paintHex="#22c55e"                   // driver's actual bike paint
//   />

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
// AssigningDriverPanel removed 2026-08-29 · doctrine v5 bans cinematic wait
// + "finding your driver" scrolling · replaced by typographic NEX network check.

export type RideStatusPhase =
  | "assigning" | "confirmed" | "en_route" | "nearby"
  | "arriving" | "riding"     | "completed";
export type RideServiceKind = "ride" | "parcel" | "food";

export interface RideStatusCardProps {
  phase: RideStatusPhase;
  serviceKind: RideServiceKind;
  driverFirstName?: string;
  plate?: string;
  etaSeconds?: number;
  /** Bike from taxonomy · loaded from /nex/bikes/{slug}.png · tinted at render. */
  bikeSlug?: string;
  /** Driver's actual bike paint hex · #RRGGBB. */
  paintHex?: string;
  /** Called when user taps the card (e.g. open full ride detail). */
  onTap?: () => void;
}

// Front-view sport-bike rider images (owner assets · from ride/) · picked
// by driver's bike paint colour and tinted via canvas to match exactly.
// These are the "someone is coming toward you" visuals · used in every
// non-food live-status phase (confirmed → riding).
const RIDER_IMAGE_YELLOW     = "/nex/ride/rider-yellow.png";
const RIDER_IMAGE_YELLOW_ALT = "/nex/ride/rider-yellow-alt.png";
const RIDER_IMAGE_BLUE       = "/nex/ride/rider-blue.png";
const FOOD_BIKE_IMAGE        = "/nex/ride/food-bike.png";

// Pick the best base rider variant given the driver's paint hex.
// Blueish hex → blue rider · yellowish/warm → yellow · else yellow-alt.
function pickRiderBase(paintHex?: string): string {
  if (!paintHex) return RIDER_IMAGE_YELLOW;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(paintHex);
  if (!m) return RIDER_IMAGE_YELLOW;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  // Simple hue classify: b dominant → blue rider
  if (b > r && b > g && b > 120) return RIDER_IMAGE_BLUE;
  return RIDER_IMAGE_YELLOW;
}

// Warmer gradient as ETA shrinks · cool at far, amber near.
const PHASE_GRADIENT: Record<RideStatusPhase, string> = {
  assigning:  "linear-gradient(160deg, #1a2437 0%, #0f1725 100%)",
  confirmed:  "linear-gradient(160deg, #1e2f52 0%, #131d33 100%)",
  en_route:   "linear-gradient(160deg, #2a3a5c 0%, #17223a 100%)",
  nearby:     "linear-gradient(160deg, #4a3a2c 0%, #2a1f18 100%)",
  arriving:   "linear-gradient(160deg, #6b4a1e 0%, #3a2812 100%)",
  riding:     "linear-gradient(160deg, #2c3e2c 0%, #182518 100%)",
  completed:  "linear-gradient(160deg, #1c2c1c 0%, #0f1a0f 100%)",
};

const PHASE_HEADLINE: Record<RideStatusPhase, string> = {
  assigning: "Finding a rider near you…",
  confirmed: "On the way",
  en_route:  "En route",
  nearby:    "Almost with you",
  arriving:  "Just outside",
  riding:    "In transit",
  completed: "Arrived",
};

// ── Canvas paint-swap (same engine as DriverBikeCard) ──────────────────
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
}
function rgbToHsl(r: number, g: number, b: number) {
  const rN = r/255, gN = g/255, bN = b/255;
  const max = Math.max(rN,gN,bN), min = Math.min(rN,gN,bN);
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
function hslToRgb(h: number, s: number, l: number) {
  let r = 0, g = 0, b = 0;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q-p)*6*t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q-p)*(2/3-t)*6;
      return p;
    };
    r = hue(h + 1/3); g = hue(h); b = hue(h - 1/3);
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
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i+3]; if (a === 0) continue;
    const hsl = rgbToHsl(d[i], d[i+1], d[i+2]);
    if (hsl.l < 0.15 || hsl.l > 0.88 || hsl.s < 0.16) continue;
    const newS = Math.min(1, targetHsl.s * 0.75 + hsl.s * 0.25);
    const rgb = hslToRgb(targetHsl.h, newS, hsl.l);
    d[i] = rgb.r; d[i+1] = rgb.g; d[i+2] = rgb.b;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatCountdown(sec: number): string {
  if (sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useLiveCountdown(initialSec?: number, phase?: RideStatusPhase) {
  const [sec, setSec] = useState(initialSec ?? 0);
  useEffect(() => { setSec(initialSec ?? 0); }, [initialSec]);
  useEffect(() => {
    if (!initialSec || phase === "riding" || phase === "completed" || phase === "assigning") return;
    const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [initialSec, phase]);
  return sec;
}

function motionForPhase(phase: RideStatusPhase, isFood: boolean) {
  const bobPx = isFood ? 0 : (
    phase === "arriving" ? 7 : phase === "nearby" ? 6 :
    phase === "en_route" ? 5 : phase === "riding" ? 3 :
    phase === "confirmed" ? 3 : 0
  );
  const bobSec = phase === "arriving" ? 1.4 : phase === "nearby" ? 1.6 : 1.9;
  const dust = !isFood && (phase === "en_route" || phase === "nearby" || phase === "arriving");
  const speedLines = !isFood && (phase === "nearby" || phase === "arriving");
  return { bobPx, bobSec, dust, speedLines };
}

// ── Component ──────────────────────────────────────────────────────────
export function RideStatusCard({
  phase, serviceKind, driverFirstName, plate,
  etaSeconds, bikeSlug, paintHex, onTap,
}: RideStatusCardProps) {
  const liveSec = useLiveCountdown(etaSeconds, phase);
  const isFood = serviceKind === "food";
  const motion = motionForPhase(phase, isFood);

  // Image source · Philip 2026-08-29:
  //   · Food service → static food-delivery bike (no tint, no motion)
  //   · Live phases (confirmed → riding) → front-view sport-bike RIDER
  //     from /nex/ride/rider-*.png (picked by paint colour), tinted to
  //     match driver's bike hex. bikeSlug is used ONLY for driver-directory
  //     browsing (DriverBikeCard), never for the live-status card.
  const baseSrc = isFood
    ? FOOD_BIKE_IMAGE
    : pickRiderBase(paintHex);
  const [displaySrc, setDisplaySrc] = useState<string>(baseSrc);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setDisplaySrc(baseSrc);
    if (isFood || !paintHex) { setLoaded(true); return; }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      try { setDisplaySrc(tintBike(img, paintHex)); } catch { /* keep base showing */ }
      setLoaded(true);
    };
    img.onerror = () => { if (!cancelled) setLoaded(true); };
    img.src = baseSrc;
    return () => { cancelled = true; };
  }, [baseSrc, isFood, paintHex]);

  const helmet = paintHex ? "matching-colour" : "yellow";

  const subline = useMemo(() => {
    if (phase === "assigning") return "Matching you with the nearest rider.";
    if (phase === "confirmed" && driverFirstName)
      return `${driverFirstName} accepted your ${serviceKind}. Look for the ${helmet} bike.`;
    if (phase === "en_route") return "Halfway to you. Look up in a few minutes.";
    if (phase === "nearby")
      return `Should be with you in a couple of minutes. Look for the bike.`;
    if (phase === "arriving" && driverFirstName && plate)
      return `${driverFirstName} is just outside · ${plate}.`;
    if (phase === "arriving")
      return `Just outside now${plate ? ` · ${plate}` : ""}.`;
    if (phase === "riding") return "Enjoy the ride. Safety notes below.";
    if (phase === "completed") return "You've arrived. Rate the ride when you're ready.";
    return "";
  }, [phase, driverFirstName, plate, serviceKind, helmet]);

  const showCountdown = liveSec > 0 && phase !== "assigning" && phase !== "riding" && phase !== "completed";

  return (
    <>
      <style>{`
        @keyframes nex-bike-bob {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-${motion.bobPx}px); }
        }
        @keyframes nex-dust-puff {
          0%   { opacity: 0.55; transform: translate(0,0) scale(1); }
          100% { opacity: 0;    transform: translate(-24px,6px) scale(1.6); }
        }
        @keyframes nex-speed-line {
          0%   { opacity: 0;   transform: translateX(0); }
          25%  { opacity: 0.6; }
          100% { opacity: 0;   transform: translateX(-32px); }
        }
        @keyframes nex-pulse-outline {
          0%,100% { opacity: 0.35; }
          50%     { opacity: 0.9; }
        }
      `}</style>
      <div
        onClick={onTap}
        style={{
          position: "relative",
          maxWidth: 420,
          margin: "0 auto",
          padding: "18px 20px 16px",
          borderRadius: 22,
          // Black frosted glass · Philip 2026-08-29 · phase gradient becomes
          // a subtle inner tint via a wash div below.
          background: "rgba(10,10,12,0.82)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          // Slight gray rim
          border: "1px solid rgba(148,163,184,0.22)",
          boxShadow: "0 14px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
          color: "rgba(245,245,245,0.96)",
          overflow: "hidden",
          cursor: onTap ? "pointer" : "default",
        }}
      >
        {/* Phase-tinted wash · gives the warm/cool feel without leaving glass */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: PHASE_GRADIENT[phase],
          opacity: 0.35,
          transition: "opacity 800ms ease, background 800ms ease",
          pointerEvents: "none",
          zIndex: 0,
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
        {phase !== "assigning" && (
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase",
            color: "rgba(249,115,22,0.9)", marginBottom: 6,
          }}>
            NEX · {PHASE_HEADLINE[phase]}
          </div>
        )}

        {phase === "assigning" && (
          // Doctrine v5 · typographic only · no cinematic wait · no simulated
          // driver scroll · no countdown. NEX quietly checks the network.
          <div style={{ padding: "10px 4px 6px" }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase",
              color: "rgba(249,115,22,0.9)", marginBottom: 6,
            }}>
              NEX · Checking the network
            </div>
            <div style={{
              fontSize: 15, lineHeight: 1.45,
              color: "rgba(245,245,245,0.94)",
            }}>
              Your request is reaching nearby providers.
            </div>
          </div>
        )}

        {phase !== "assigning" && (<>

        {/* Bike image · fixed frame · clipped */}
        <div style={{
          position: "relative", width: "100%", height: 180,
          margin: "6px 0 4px",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", borderRadius: 12,
        }}>
          {motion.speedLines && (
            <>
              <span style={{
                position: "absolute", left: 22, top: 74, width: 42, height: 2,
                background: "rgba(255,255,255,0.65)", borderRadius: 2,
                filter: "blur(0.4px)",
                animation: "nex-speed-line 1.1s ease-out infinite",
              }} />
              <span style={{
                position: "absolute", left: 16, top: 116, width: 34, height: 2,
                background: "rgba(255,255,255,0.5)", borderRadius: 2,
                filter: "blur(0.4px)",
                animation: "nex-speed-line 1.1s 0.35s ease-out infinite",
              }} />
            </>
          )}
          {motion.dust && (
            <div style={{
              position: "absolute", left: "50%", bottom: 14,
              transform: "translateX(-50%)",
              width: 120, height: 30, pointerEvents: "none",
            }}>
              {[0, 0.6, 1.2].map((delay, i) => (
                <span key={i} style={{
                  position: "absolute",
                  left: `${20 + i * 8}px`, bottom: 6,
                  width: 14, height: 14, borderRadius: 999,
                  background: "rgba(200,180,140,0.55)",
                  filter: "blur(3px)",
                  animation: `nex-dust-puff 1.8s ${delay}s ease-out infinite`,
                }} />
              ))}
            </div>
          )}

          <img src={displaySrc} alt="Rider"
            style={{
              display: "block",
              maxWidth: "72%", maxHeight: "170px", width: "auto", height: "auto",
              objectFit: "contain",
              opacity: loaded ? 1 : 0.5,
              animation: motion.bobPx > 0
                ? `nex-bike-bob ${motion.bobSec}s ease-in-out infinite`
                : "none",
              transition: "opacity 300ms ease",
            }} />
        </div>

        {showCountdown && (
          <div style={{
            textAlign: "center", fontVariantNumeric: "tabular-nums",
            fontSize: 34, fontWeight: 300, letterSpacing: 2,
            color: "rgba(245,245,245,0.98)", lineHeight: 1.1,
            margin: "10px 0 0",
          }}>
            {formatCountdown(liveSec)}
            <span style={{
              display: "block", fontSize: 10, letterSpacing: 2,
              color: "rgba(245,245,245,0.55)", marginTop: 2,
              textTransform: "uppercase", fontWeight: 600,
            }}>estimated arrival</span>
          </div>
        )}

        {(driverFirstName || plate) && phase !== "assigning" && phase !== "completed" && (
          <div style={{
            marginTop: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            fontSize: 13, color: "rgba(245,245,245,0.78)",
          }}>
            {driverFirstName && <span style={{ fontWeight: 600 }}>{driverFirstName}</span>}
            {plate && (
              <span style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 12, fontWeight: 600, letterSpacing: 1,
                padding: "3px 8px", borderRadius: 6,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}>{plate.toUpperCase()}</span>
            )}
            {paintHex && (
              <span style={{
                width: 16, height: 16, borderRadius: 999, background: paintHex,
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
              }} title={`Bike paint · ${paintHex}`} />
            )}
          </div>
        )}

        <div style={{
          marginTop: 12, padding: "0 4px", textAlign: "center",
          fontSize: 14, lineHeight: 1.45, color: "rgba(245,245,245,0.86)",
        }}>
          {subline}
        </div>

        </>)}{/* end non-assigning branch */}

        {phase === "riding" && (
          <div style={{
            marginTop: 14, padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontSize: 13, lineHeight: 1.55,
            color: "rgba(245,245,245,0.82)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "rgba(255,255,255,0.95)" }}>
              Helmet fastened? Comfortable with the speed?
            </div>
            <div>
              If you'd like slower, just say{" "}
              <span style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontWeight: 600, color: "#fbbf24",
              }}>&quot;pelan-pelan&quot;</span>
              {" "}— {driverFirstName ?? "your driver"} will understand.
            </div>
            <div style={{ marginTop: 6 }}>
              Otherwise, please save conversation for when you stop. Your safety and{" "}
              {driverFirstName ?? "the driver"}&apos;s focus matter most.
            </div>
          </div>
        )}
        </div>{/* z-index wrapper */}
      </div>
    </>
  );
}
