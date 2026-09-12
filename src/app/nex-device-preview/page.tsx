// src/app/nex-device-preview/page.tsx
//
// Realistic device-frame preview · Philip 2026-09-06
//
// Renders /nexapp inside a CSS-drawn iPhone-15-Pro-style device body so
// the founder can see how the current NEX bezel chassis + app content
// look on an actual phone rather than a browser-shaped viewport.
//
// Zero product-behavior impact · preview-only route. Uses
// <iframe src="/nexapp"> so nothing about /nexapp needs to change.
//
// URL controls:
//   ?device=iphone15pro (default) | iphone15promax
//   ?color=titanium (default) | space | silver | gold
//   ?scale=1  (0.5 … 1.2)

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// Next.js 15/16 requires useSearchParams() to be under a Suspense
// boundary; without it the page short-circuits during prerender and
// the client-only device body never appears. This default export
// wraps the real content in Suspense · the inner component is where
// all the hooks live.
export default function NexDevicePreviewPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0b0b0d" }} />}>
      <NexDevicePreviewInner />
    </Suspense>
  );
}

type DeviceKey = "classic" | "classic-plus" | "galaxy-s" | "galaxy-note";
type ColorKey = "black" | "white" | "silver" | "gold" | "phantom" | "burgundy";

// Classic-case device geometry · rectangular body, thick top + bottom
// bezels, straight sides. Modelled on the "standard phone case" mockup
// commonly used for marketing composites — think iPhone 4/5/6/7/8-style
// hardware profile rather than the modern edge-to-edge screen.
type DeviceGeometry = {
  label: string;
  brand: "apple" | "samsung";
  /** Real physical width in mm · drives on-screen size so the preview
   *  looks like a phone in your hand, not a poster. */
  physicalWidthMm: number;
  bodyRatioHW: number;         // h / w
  bezelTop: number;            // % of body height · top bezel
  bezelBottom: number;         // % of body height · bottom bezel
  bezelLR: number;             // % of body width  · side bezel
  cornerRadius: number;        // % of body width  · body corner radius
  screenRadius: number;        // % of body width  · screen corner radius
  /** Apple-style home button diameter · 0 disables (edge-to-edge phones). */
  homeButtonDiameter: number;  // % of body width
  /** Apple-style ear-speaker slot width · 0 disables. */
  speakerWidth: number;        // % of body width
  /** Camera dot diameter · used differently per brand (Apple = beside
   *  the speaker; Samsung = centered hole-punch inside the screen). */
  cameraDiameter: number;      // % of body width
  /** Samsung-style hole-punch camera sits inside the screen · when
   *  true the camera is drawn at the top of the screen area, not the
   *  bezel. Apple-style false: camera lives in the top bezel. */
  cameraInsideScreen: boolean;
};

const DEVICES: Record<DeviceKey, DeviceGeometry> = {
  classic: {
    label: "Apple · Standard Case",
    brand: "apple",
    physicalWidthMm: 67,              // real iPhone 8-class body width
    bodyRatioHW: 138.1 / 67.0,        // ~2.06 · classic phone proportion
    bezelTop: 8.5,
    bezelBottom: 9.5,
    bezelLR: 2.5,
    cornerRadius: 4.5,                // straight-ish edges · small radius only
    screenRadius: 0.5,                // near-square screen corners
    homeButtonDiameter: 12,
    speakerWidth: 22,
    cameraDiameter: 4.2,
    cameraInsideScreen: false,
  },
  "classic-plus": {
    label: "Apple · Standard Case · Plus",
    brand: "apple",
    physicalWidthMm: 77.8,            // real iPhone 8 Plus-class body width
    bodyRatioHW: 158.2 / 77.8,        // 2.033 · taller "plus" case
    bezelTop: 8.0,
    bezelBottom: 9.0,
    bezelLR: 2.2,
    cornerRadius: 4.5,
    screenRadius: 0.5,
    homeButtonDiameter: 11.5,
    speakerWidth: 21,
    cameraDiameter: 4,
    cameraInsideScreen: false,
  },
  "galaxy-s": {
    label: "Samsung · Galaxy S",
    brand: "samsung",
    physicalWidthMm: 70.6,            // Galaxy S22 body width
    bodyRatioHW: 146.0 / 70.6,        // 2.068 · edge-to-edge S-class
    bezelTop: 1.8,                    // thin symmetric bezels
    bezelBottom: 2.2,
    bezelLR: 1.4,
    cornerRadius: 9,                  // Samsung has noticeably rounded corners
    screenRadius: 8,                  // screen matches body radius closely
    homeButtonDiameter: 0,            // no physical home button
    speakerWidth: 12,                 // very thin earpiece at top edge
    cameraDiameter: 3.6,              // center hole-punch
    cameraInsideScreen: true,
  },
  "galaxy-note": {
    label: "Samsung · Galaxy Note",
    brand: "samsung",
    physicalWidthMm: 77.2,            // Note 20-class body width
    bodyRatioHW: 165.6 / 77.2,        // 2.145 · taller Note aspect
    bezelTop: 1.6,
    bezelBottom: 1.9,
    bezelLR: 1.2,
    cornerRadius: 8,
    screenRadius: 7,
    homeButtonDiameter: 0,
    speakerWidth: 11,
    cameraDiameter: 3.4,
    cameraInsideScreen: true,
  },
};

const COLORS: Record<ColorKey, {
  body: string;
  bezel: string;
  sheen: string;
  screenSurround: string;
  homeButton: string;
  buttonOuterRing: string;
  label: string;
}> = {
  black: {
    label: "Black",
    body:           "linear-gradient(180deg, #1a1a1c 0%, #232326 50%, #131315 100%)",
    bezel:          "#0d0d0e",
    sheen:          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.03) 100%)",
    screenSurround: "#000000",
    homeButton:     "radial-gradient(circle at 30% 30%, #2a2a2c 0%, #0e0e10 100%)",
    buttonOuterRing:"rgba(255,255,255,0.10)",
  },
  white: {
    label: "White",
    body:           "linear-gradient(180deg, #f4f4f4 0%, #ffffff 50%, #e6e6e6 100%)",
    bezel:          "#f7f7f7",
    sheen:          "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.02) 100%)",
    screenSurround: "#000000",
    homeButton:     "radial-gradient(circle at 30% 30%, #ffffff 0%, #d0d0d0 100%)",
    buttonOuterRing:"rgba(0,0,0,0.12)",
  },
  silver: {
    label: "Silver",
    body:           "linear-gradient(180deg, #c9ccd1 0%, #e0e2e6 50%, #b3b6bb 100%)",
    bezel:          "#f2f2f4",
    sheen:          "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.05) 100%)",
    screenSurround: "#000000",
    homeButton:     "radial-gradient(circle at 30% 30%, #f0f0f0 0%, #b0b3b8 100%)",
    buttonOuterRing:"rgba(0,0,0,0.12)",
  },
  gold: {
    label: "Rose Gold",
    body:           "linear-gradient(180deg, #d9b19a 0%, #efc8b0 50%, #c69077 100%)",
    bezel:          "#faf1e8",
    sheen:          "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.05) 100%)",
    screenSurround: "#000000",
    homeButton:     "radial-gradient(circle at 30% 30%, #f5dfd0 0%, #b48064 100%)",
    buttonOuterRing:"rgba(0,0,0,0.12)",
  },
  phantom: {
    // Samsung "Phantom Black" · deep near-black with subtle blue undertone
    label: "Phantom Black",
    body:           "linear-gradient(180deg, #16171a 0%, #1e1f24 50%, #0e0f11 100%)",
    bezel:          "#050506",
    sheen:          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.02) 100%)",
    screenSurround: "#000000",
    homeButton:     "radial-gradient(circle at 30% 30%, #2a2a2c 0%, #0e0e10 100%)",
    buttonOuterRing:"rgba(255,255,255,0.08)",
  },
  burgundy: {
    // Samsung Burgundy · deep wine red
    label: "Burgundy",
    body:           "linear-gradient(180deg, #4a1520 0%, #6b1e2d 50%, #360f18 100%)",
    bezel:          "#1a0a10",
    sheen:          "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.10) 100%)",
    screenSurround: "#000000",
    homeButton:     "radial-gradient(circle at 30% 30%, #5c1c28 0%, #2a0c14 100%)",
    buttonOuterRing:"rgba(255,255,255,0.06)",
  },
};

function NexDevicePreviewInner() {
  const search = useSearchParams();
  const rawDevice = (search?.get("device") as DeviceKey) ?? "classic";
  const deviceKey: DeviceKey = rawDevice in DEVICES ? rawDevice : "classic";
  const device = DEVICES[deviceKey];
  const rawColor = (search?.get("color") as ColorKey) ?? "black";
  const colorKey: ColorKey = rawColor in COLORS ? rawColor : "black";
  const color = COLORS[colorKey];
  const rawScale = Number.parseFloat(search?.get("scale") ?? "1");
  const scale = Number.isFinite(rawScale) ? Math.min(1.2, Math.max(0.5, rawScale)) : 1;

  // CSS-only sizing · renders on first paint (no useEffect gate).
  //
  // Realistic phone size: cap the body width to the phone's PHYSICAL
  // width in mm (CSS treats mm as 96/25.4 ≈ 3.78 px/mm on standard-
  // DPI displays). A 67mm classic case → ~253 CSS pixels on desktop,
  // which is how a phone in your hand actually looks on a laptop
  // screen. On narrow viewports (mobile browser) the width shrinks
  // to fit the viewport. `scale` multiplies for zoom-in / zoom-out.
  const bodyWidthCss = `min(
    calc(${device.physicalWidthMm}mm * ${scale}),
    calc((100vw - 40px) * ${scale}),
    calc((100vh - 130px) * ${scale} / ${device.bodyRatioHW})
  )`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0d",
        color: "#f2f2f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 12px 20px",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      {/* Top chrome · device + colour pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 11,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span style={{ opacity: 0.55, letterSpacing: 0.06, textTransform: "uppercase", marginRight: 4 }}>
          NEX on
        </span>
        <QueryLink label="Apple · Case"      active={deviceKey === "classic"}      params={{ device: "classic" }} />
        <QueryLink label="Apple · Plus"      active={deviceKey === "classic-plus"} params={{ device: "classic-plus" }} />
        <QueryLink label="Galaxy S"          active={deviceKey === "galaxy-s"}     params={{ device: "galaxy-s" }} />
        <QueryLink label="Galaxy Note"       active={deviceKey === "galaxy-note"}  params={{ device: "galaxy-note" }} />
        <span style={{ opacity: 0.35, margin: "0 4px" }}>·</span>
        {device.brand === "samsung" ? (
          <>
            <QueryLink label="Phantom Black" active={colorKey === "phantom"}  params={{ color: "phantom" }} />
            <QueryLink label="Silver"        active={colorKey === "silver"}   params={{ color: "silver" }} />
            <QueryLink label="White"         active={colorKey === "white"}    params={{ color: "white" }} />
            <QueryLink label="Burgundy"      active={colorKey === "burgundy"} params={{ color: "burgundy" }} />
          </>
        ) : (
          <>
            <QueryLink label="Black"     active={colorKey === "black"}  params={{ color: "black" }} />
            <QueryLink label="White"     active={colorKey === "white"}  params={{ color: "white" }} />
            <QueryLink label="Silver"    active={colorKey === "silver"} params={{ color: "silver" }} />
            <QueryLink label="Rose Gold" active={colorKey === "gold"}   params={{ color: "gold" }} />
          </>
        )}
      </div>

      {/* Device body · classic rectangular phone case · pure-CSS sized so
          it renders on first paint. Straight-ish edges (~4.5cqw radius,
          not the modern pill shape), thick top + bottom bezels, thin
          side bezels, home button + speaker + front camera as chassis
          furniture. Container-query units (cqw) let every proportion
          scale exactly with the body width. */}
      <div
        data-testid="nex-device-frame"
        style={{
          width: bodyWidthCss,
          aspectRatio: `1 / ${device.bodyRatioHW}`,
          borderRadius: `${device.cornerRadius}cqw`,
          background: color.body,
          position: "relative",
          boxShadow: [
            "0 30px 60px -20px rgba(0,0,0,0.75)",
            "0 8px 16px -6px rgba(0,0,0,0.5)",
            "inset 0 0 0 1px rgba(255,255,255,0.10)",
            "inset 0 0 0 2px rgba(0,0,0,0.35)",
          ].join(", "),
          overflow: "hidden",
          transition: "background 200ms ease",
          containerType: "inline-size",
        }}
      >
        {/* Subtle body sheen · vertical highlight (glass/aluminum look) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: `${device.cornerRadius}cqw`,
            background: color.sheen,
            pointerEvents: "none",
            mixBlendMode: "screen",
            opacity: 0.9,
          }}
        />

        {/* Side buttons · classic-case power + volume */}
        <SideButton side="left"  top="14%" h="5%" />
        <SideButton side="left"  top="21%" h="9%" />
        <SideButton side="right" top="16%" h="9%" />

        {/* ─── TOP bezel furniture · speaker (both brands) + Apple camera ─── */}
        {device.speakerWidth > 0 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              // Samsung earpieces sit hard against the top edge; Apple
              // sits down inside the thicker bezel.
              top: device.brand === "samsung" ? "0.6cqw" : `${device.bezelTop / 2.4}cqw`,
              left: "50%",
              transform: "translateX(-50%)",
              width: `${device.speakerWidth}cqw`,
              height: `${Math.max(device.speakerWidth / 22, 0.6)}cqw`,
              minHeight: 3,
              borderRadius: 999,
              background: "#000",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          />
        )}
        {/* Apple front camera lives in the top bezel next to the speaker */}
        {!device.cameraInsideScreen && device.cameraDiameter > 0 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: `${device.bezelTop / 2.4}cqw`,
              left: `50%`,
              transform: `translateX(calc(-50% - ${device.speakerWidth / 2 + device.cameraDiameter}cqw))`,
              width: `${device.cameraDiameter}cqw`,
              height: `${device.cameraDiameter}cqw`,
              borderRadius: "50%",
              background: "#000",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          />
        )}

        {/* ─── SCREEN · centered between the thick bezels ─── */}
        <div
          style={{
            position: "absolute",
            top: `${device.bezelTop}cqw`,
            bottom: `${device.bezelBottom}cqw`,
            left: `${device.bezelLR}cqw`,
            right: `${device.bezelLR}cqw`,
            background: color.screenSurround,
            borderRadius: `${device.screenRadius}cqw`,
            overflow: "hidden",
            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.6), inset 0 0 12px rgba(0,0,0,0.4)",
          }}
        >
          <iframe
            src="/nexapp"
            title="NEX chassis inside phone case preview"
            style={{
              border: "none",
              width: "100%",
              height: "100%",
              display: "block",
              background: "#000",
            }}
          />

          {/* Samsung-style hole-punch camera · centered inside the screen
              area at the top edge · sits above the iframe so it looks
              baked into the display. */}
          {device.cameraInsideScreen && device.cameraDiameter > 0 && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "1.4cqw",
                left: "50%",
                transform: "translateX(-50%)",
                width: `${device.cameraDiameter}cqw`,
                height: `${device.cameraDiameter}cqw`,
                borderRadius: "50%",
                background: "#000",
                boxShadow: [
                  "inset 0 0 0 0.4cqw rgba(20,20,25,0.9)",
                  "inset 0 0 4px rgba(30,60,120,0.4)",
                  "0 0 0 1px rgba(0,0,0,0.6)",
                ].join(", "),
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* ─── HOME button · Apple-only ─── */}
        {device.homeButtonDiameter > 0 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: `${(device.bezelBottom - device.homeButtonDiameter) / 2}cqw`,
              left: "50%",
              transform: "translateX(-50%)",
              width: `${device.homeButtonDiameter}cqw`,
              height: `${device.homeButtonDiameter}cqw`,
              borderRadius: "50%",
              background: color.homeButton,
              boxShadow: [
                `inset 0 0 0 0.5cqw ${color.buttonOuterRing}`,
                "inset 0 1px 2px rgba(255,255,255,0.15)",
                "0 1px 2px rgba(0,0,0,0.35)",
              ].join(", "),
            }}
          />
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, opacity: 0.5, textAlign: "center", maxWidth: 380 }}>
        Preview only · the NEX chassis renders inside a CSS-drawn iPhone body via an
        iframe of <code style={{ opacity: 0.7 }}>/nexapp</code>. Swap device + colour
        above. Append <code style={{ opacity: 0.7 }}>?scale=0.85</code> to shrink.
      </div>
    </div>
  );
}

function SideButton({ side, top, h }: { side: "left" | "right"; top: string; h: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        [side]: -2,
        top,
        width: 4,
        height: h,
        borderRadius: 2,
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.6) 100%)",
        boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.08)",
        opacity: 0.85,
      }}
    />
  );
}

function QueryLink({ label, active, params }: {
  label: string;
  active: boolean;
  params: Record<string, string>;
}) {
  const search = useSearchParams();
  const next = new URLSearchParams();
  search?.forEach((v, k) => next.set(k, v));
  for (const [k, v] of Object.entries(params)) next.set(k, v);
  const href = `?${next.toString()}`;
  return (
    <a
      href={href}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: active ? "#f2f2f5" : "rgba(255,255,255,0.06)",
        color: active ? "#0b0b0d" : "#c9c9d0",
        textDecoration: "none",
        border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.10)"}`,
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </a>
  );
}
