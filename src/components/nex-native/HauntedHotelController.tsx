"use client";

// src/components/nex-native/HauntedHotelController.tsx
//
// Haunted Hotel theme · animation controller.
// -----------------------------------------------------------------------------
// Mirrors the Joker _joker-controller.tsx pattern so the two premium
// themes share one visual language:
//
//   · Floating 3-dots trigger (bottom-right) opens a full-screen panel
//   · Panel has landscape cards · icon + label + caption + toggle
//   · Toggles persist in localStorage (nex_haunted_hotel_fx_toggles_v1)
//   · Hidden while the shop slider is up (listens for
//     'nex-shop-slider-visible' CustomEvent)
//   · Each toggle fires a self-contained CSS-only overlay in the viewport

import * as React from "react";

const STORAGE_KEY = "nex_haunted_hotel_fx_toggles_v1";

type FxVariant =
  | "lightning"
  | "fog"
  | "rain"
  | "vignette"
  | "dust"
  | "phantom"
  | "chime"
  | "cobweb"
  | "candelabra"
  | "blowout";

type Toggles = Partial<Record<FxVariant, boolean>>;

function loadToggles(): Toggles {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Toggles) : {};
  } catch {
    return {};
  }
}
function saveToggles(t: Toggles): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* no-op */
  }
}

interface CardSpec {
  variant: FxVariant;
  label: string;
  caption: string;
  icon: React.ReactNode;
}

const CARDS: CardSpec[] = [
  { variant: "lightning",  label: "Lightning",         caption: "Sheet lightning strikes.",     icon: <BoltIcon /> },
  { variant: "fog",        label: "Rolling Fog",       caption: "Fog drifts in from the edges.", icon: <FogIcon /> },
  { variant: "rain",       label: "Rain",              caption: "Silver streaks on the glass.", icon: <RainIcon /> },
  { variant: "vignette",   label: "Breathing Dark",    caption: "The corners inhale slowly.",   icon: <VignetteIcon /> },
  { variant: "dust",       label: "Dust Motes",        caption: "Particles in the lamp cone.",  icon: <DustIcon /> },
  { variant: "phantom",    label: "Phantom Silhouette", caption: "A figure passes the window.", icon: <PhantomIcon /> },
  { variant: "chime",      label: "Clock Chime",       caption: "Brass bell · pulses slowly.",  icon: <BellIcon /> },
  { variant: "cobweb",     label: "Cobweb",            caption: "A web grows in the corner.",   icon: <WebIcon /> },
  { variant: "candelabra", label: "Candelabra",        caption: "Three flickering flames.",     icon: <CandelabraIcon /> },
  { variant: "blowout",    label: "Second Blow-Out",   caption: "A lamp relights alone.",       icon: <LampIcon /> },
];

export function HauntedHotelController(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [toggles, setToggles] = React.useState<Toggles>({});
  const [shopSliderOpen, setShopSliderOpen] = React.useState(false);

  // Hydrate from localStorage + listen for cross-tab changes.
  React.useEffect(() => {
    setToggles(loadToggles());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setToggles(loadToggles());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Hide the 3-dots trigger while the shop slider is up.
  React.useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      setShopSliderOpen(!!detail?.open);
    };
    window.addEventListener("nex-shop-slider-visible", onEvt as EventListener);
    return () =>
      window.removeEventListener("nex-shop-slider-visible", onEvt as EventListener);
  }, []);

  // Entry-point from the composer's + button · Media modal fires this
  // event when the user taps the Animations option. Replaces the
  // floating 3-dots trigger that used to open the panel.
  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("nex-haunted-hotel-open-animations", onOpen);
    return () =>
      window.removeEventListener("nex-haunted-hotel-open-animations", onOpen);
  }, []);

  const setToggle = React.useCallback((variant: FxVariant, next: boolean) => {
    setToggles((prev) => {
      const merged = { ...prev, [variant]: next };
      saveToggles(merged);
      return merged;
    });
  }, []);

  return (
    <>
      {/* Shared keyframes · hh-ctl-* namespace */}
      <style>{`
        @keyframes hh-ctl-dot {
          0%, 80%, 100% { transform: scale(1);   opacity: 0.55; }
          40%           { transform: scale(1.4); opacity: 1; }
        }
        @keyframes hh-ctl-panel-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* Subtle brightness kick · simulates the whole room being
         * briefly lit from outside by a strike. */
        @keyframes hh-ctl-lightning-scene {
          0%, 70%, 100%     { opacity: 0; }
          2%                { opacity: 0.55; }
          3%                { opacity: 0.1; }
          4%                { opacity: 0.4; }
          5%, 69%           { opacity: 0; }
          8%                { opacity: 0.3; }
          9%                { opacity: 0.08; }
        }
        /* The real event · a bright burst behind the window + a
         * micro-pulse 60ms later to sell the double-flash feel. */
        @keyframes hh-ctl-lightning-window {
          0%, 70%, 100%     { opacity: 0; transform: scale(1); }
          1.5%              { opacity: 1;    transform: scale(1.05); }
          2.5%              { opacity: 0.35; transform: scale(1.1); }
          3.5%              { opacity: 1;    transform: scale(1.12); }
          5%, 69%           { opacity: 0;    transform: scale(1); }
          8%                { opacity: 0.75; transform: scale(1.06); }
          9%                { opacity: 0.1;  transform: scale(1.08); }
        }
        /* The bolt itself · briefly visible outside the window during
         * the strike · sized smaller than the glow so it reads as
         * distant. */
        @keyframes hh-ctl-lightning-bolt {
          0%, 70%, 100%     { opacity: 0; }
          2%                { opacity: 0.95; }
          3%                { opacity: 0.3; }
          4%                { opacity: 0.9; }
          5%, 69%           { opacity: 0; }
          8%                { opacity: 0.6; }
          9%                { opacity: 0.08; }
        }
        @keyframes hh-ctl-thunder {
          0%, 7%, 20%, 100% { opacity: 0; }
          10%               { opacity: 0.75; }
          15%               { opacity: 0.3; }
        }
        @keyframes hh-ctl-fog {
          0%   { transform: translateX(var(--hh-fog-from, -40%)) scale(1); opacity: 0; }
          20%  { opacity: 0.55; }
          80%  { opacity: 0.35; }
          100% { transform: translateX(var(--hh-fog-to, 60%)) scale(1.3); opacity: 0; }
        }
        @keyframes hh-ctl-rain {
          0%   { transform: translate(0, -30%) rotate(14deg); opacity: 0; }
          10%  { opacity: 0.72; }
          100% { transform: translate(-14%, 130%) rotate(14deg); opacity: 0; }
        }
        @keyframes hh-ctl-breath {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 0.9; }
        }
        @keyframes hh-ctl-dust {
          0%   { transform: translate(0, 0); opacity: 0; }
          10%  { opacity: 0.85; }
          80%  { opacity: 0.5; }
          100% { transform: translate(var(--hh-dust-dx, 20px), 220px); opacity: 0; }
        }
        @keyframes hh-ctl-phantom-walk {
          0%   { transform: translateX(110vw); opacity: 0; }
          10%  { opacity: 0.75; }
          50%  { opacity: 0.95; }
          90%  { opacity: 0.6; }
          100% { transform: translateX(-10vw); opacity: 0; }
        }
        @keyframes hh-ctl-phantom-dim {
          0%, 30%, 70%, 100% { opacity: 0; }
          50%                { opacity: 0.4; }
        }
        @keyframes hh-ctl-bell {
          0%, 90%, 100% { opacity: 0.2; transform: scale(1); filter: blur(14px); }
          93%           { opacity: 1;   transform: scale(1.18); filter: blur(10px); }
          96%           { opacity: 0.6; transform: scale(1.26); filter: blur(14px); }
        }
        @keyframes hh-ctl-cobweb-grow {
          0%, 15%  { opacity: 0; stroke-dashoffset: 500; }
          80%, 100% { opacity: 0.75; stroke-dashoffset: 0; }
        }
        @keyframes hh-ctl-flame {
          0%, 100% { transform: scaleY(1)    translateY(0);  filter: brightness(1); }
          25%      { transform: scaleY(1.15) translateY(-1px); filter: brightness(1.3); }
          50%      { transform: scaleY(0.9)  translateY(1px);  filter: brightness(0.85); }
          75%      { transform: scaleY(1.08) translateY(-2px); filter: brightness(1.15); }
        }
        @keyframes hh-ctl-blowout {
          0%, 40%           { opacity: 0; filter: blur(14px); }
          45%, 48%          { opacity: 0.5; }
          46%, 47%          { opacity: 0.15; }
          55%, 58%, 62%     { opacity: 0.9; }
          56%, 59%          { opacity: 0.3; }
          80%               { opacity: 0.75; filter: blur(10px); }
          85%               { opacity: 0.1;  filter: blur(16px); }
          92%               { opacity: 0.4; }
          95%               { opacity: 0.05; filter: blur(22px); }
          100%              { opacity: 0; filter: blur(26px); }
        }
      `}</style>

      {/* ── Enabled effect overlays · each rendered as a fixed layer ── */}
      {toggles.lightning && <LightningFx />}
      {toggles.fog && <FogFx />}
      {toggles.rain && <RainFx />}
      {toggles.vignette && <VignetteFx />}
      {toggles.dust && <DustFx />}
      {toggles.phantom && <PhantomFx />}
      {toggles.chime && <ChimeFx />}
      {toggles.cobweb && <CobwebFx />}
      {toggles.candelabra && <CandelabraFx />}
      {toggles.blowout && <BlowoutFx />}

      {/* 3-dots floating trigger removed 2026-10-04 per founder
          direction. The Haunted Hotel Animations panel is now entered
          from the composer's + button (Animations option in the
          MediaModal), which dispatches the custom window event
          "nex-haunted-hotel-open-animations" that we listen for below.
          The floating trigger used to live here. */}

      {/* ── Full-screen panel ── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Haunted Hotel animations"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            background:
              "linear-gradient(180deg, rgba(10,6,20,0.3) 0%, rgba(3,2,8,0.55) 100%), url(/nex-native/chat/haunted-hotel-dark.png) center center / cover no-repeat",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            padding: "calc(env(safe-area-inset-top, 0) + 76px) 18px 24px",
            overflowY: "auto",
            animationName: "hh-ctl-panel-in",
            animationDuration: "180ms",
            animationTimingFunction: "cubic-bezier(.2,.7,.2,1)",
            animationFillMode: "both",
          }}
        >
          <div
            style={{
              color: "#f0c87a",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Haunted Hotel · Animations
          </div>
          <div
            style={{
              marginTop: 6,
              color: "rgba(240,220,200,0.6)",
              fontSize: 12,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Toggle any effect on or off. Choices persist on this device.
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: 22,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: "100%",
              maxWidth: 480,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {CARDS.map((c) => (
              <AnimationCard
                key={c.variant}
                spec={c}
                enabled={!!toggles[c.variant]}
                onToggle={(next) => setToggle(c.variant, next)}
              />
            ))}
          </div>

          {/* Close × */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 0) + 16px)",
              right: 16,
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "50%",
              background: "linear-gradient(180deg, #2a1a08 0%, #0a0604 100%)",
              border: "1px solid rgba(216,168,86,0.65)",
              color: "#d8a856",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,220,160,0.08)",
              zIndex: 2,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// AnimationCard · same geometry as the Joker card for family resemblance,
// but with the Haunted Hotel amber/parchment palette.
// ---------------------------------------------------------------------------
function AnimationCard({
  spec,
  enabled,
  onToggle,
}: {
  spec: CardSpec;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background:
          "linear-gradient(180deg, rgba(216,168,86,0.14) 0%, rgba(216,168,86,0.06) 100%)",
        border: "1px solid rgba(216,168,86,0.5)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(216,168,86,0.35)",
          display: "grid",
          placeItems: "center",
          color: "#d8a856",
        }}
      >
        {spec.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F4F0E6",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {spec.label}
        </div>
        <div
          style={{
            color: "#C9BFAE",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {spec.caption}
        </div>
      </div>
      <ToggleSwitch value={enabled} onChange={onToggle} ariaLabel={spec.label} />
    </div>
  );
}

function ToggleSwitch({
  value,
  onChange,
  ariaLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={`${ariaLabel} toggle`}
      onClick={() => onChange(!value)}
      style={{
        flexShrink: 0,
        width: 48,
        height: 28,
        borderRadius: 999,
        border: value ? "1px solid rgba(216,168,86,0.75)" : "1px solid rgba(255,255,255,0.12)",
        background: value ? "rgba(216,168,86,0.25)" : "rgba(0,0,0,0.5)",
        position: "relative",
        cursor: "pointer",
        padding: 0,
        transition: "background 160ms ease, border 160ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: value ? 22 : 2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: value ? "#d8a856" : "rgba(220,205,180,0.6)",
          boxShadow: value ? "0 0 10px rgba(216,168,86,0.7)" : "0 1px 3px rgba(0,0,0,0.5)",
          transition: "left 160ms cubic-bezier(.2,.7,.2,1), background 160ms ease",
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Trigger glyph
// ---------------------------------------------------------------------------
function DancingDots(): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center" }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "currentColor",
            animationName: "hh-ctl-dot",
            animationDuration: "900ms",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            animationDelay: `${i * 140}ms`,
          }}
        />
      ))}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Effect overlays · each a fixed-position layer running pure CSS keyframes.
// zIndex 1 so they sit above the hotel background but below content.
// ───────────────────────────────────────────────────────────────────────────

const OVERLAY_BASE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 1,
  overflow: "hidden",
};

// Window-centred lightning · the strike happens OUTSIDE the hotel so
// the brightness blooms through the window area. Tweak WINDOW_X_PCT /
// WINDOW_Y_PCT once you know the exact window position in the hotel
// photograph · the current numbers assume a mid-upper window.
const WINDOW_X_PCT = 50;
const WINDOW_Y_PCT = 32;
const WINDOW_X_OFFSET_PX = 10; // positive = right
const WINDOW_Y_OFFSET_PX = 7;  // positive = down
const WINDOW_WIDTH_PX = 240;
const WINDOW_HEIGHT_PX = 310;

function LightningFx(): React.JSX.Element {
  const strikeDurationS = 22;
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      {/* Scene brightness kick · soft white overlay screen-blended so
          the whole room reads as briefly lit from outside by the
          strike. Dimmer than a full whiteout. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,1)",
          animationName: "hh-ctl-lightning-scene",
          animationDuration: `${strikeDurationS}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
        }}
      />

      {/* Window glow · bright white burst anchored at the window
          position in the image. This is the main "wow" element · it
          reads as lightning illuminating the glass. */}
      <div
        style={{
          position: "absolute",
          left: `${WINDOW_X_PCT}%`,
          top: `${WINDOW_Y_PCT}%`,
          width: WINDOW_WIDTH_PX,
          height: WINDOW_HEIGHT_PX,
          marginLeft: -WINDOW_WIDTH_PX / 2 + WINDOW_X_OFFSET_PX,
          marginTop: -WINDOW_HEIGHT_PX / 2 + WINDOW_Y_OFFSET_PX,
          background:
            "radial-gradient(ellipse 50% 55% at 50% 50%, rgba(255,255,255,0.98) 0%, rgba(230,240,255,0.9) 25%, rgba(190,215,255,0.55) 55%, rgba(140,170,220,0.2) 80%, rgba(255,255,255,0) 100%)",
          filter: "blur(10px)",
          animationName: "hh-ctl-lightning-window",
          animationDuration: `${strikeDurationS}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
          transformOrigin: "50% 50%",
        }}
      />

      {/* Lightning bolt SVG · smaller than the glow so it reads as a
          distant strike through the glass. Zigzag white path. */}
      <div
        style={{
          position: "absolute",
          left: `${WINDOW_X_PCT}%`,
          top: `${WINDOW_Y_PCT}%`,
          width: 160,
          height: 62,
          marginLeft: -80 + WINDOW_X_OFFSET_PX - 5,
          marginTop: -31 + WINDOW_Y_OFFSET_PX + 3,
          animationName: "hh-ctl-lightning-bolt",
          animationDuration: `${strikeDurationS}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
        }}
      >
        <svg viewBox="0 0 160 62" width="100%" height="100%">
          <defs>
            <filter id="hh-lightning-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Single main bolt · first segment is a clean straight
            line at 30° off vertical to the left · then zigzag */}
          <path
            d="M 92 2.1 L 79 21.5 L 92 30 L 68 41 L 86 48 L 60 58.5 L 76 62"
            fill="none"
            stroke="rgba(255,255,255,0.98)"
            strokeWidth="3"
            strokeLinejoin="miter"
            strokeLinecap="round"
            filter="url(#hh-lightning-glow)"
          />
          {/* One very small branch · tiny tendril off the first zig */}
          <path
            d="M 92 30 L 104 33.5"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.3"
            strokeLinecap="round"
            filter="url(#hh-lightning-glow)"
          />
        </svg>
      </div>

      {/* Thunder-glow vignette · delayed · dark rolling pulse after
          the strike. Keeps the strike feeling heavy. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(80,110,180,0) 20%, rgba(60,80,160,0.45) 70%, rgba(0,0,0,0.85) 100%)",
          animationName: "hh-ctl-thunder",
          animationDuration: `${strikeDurationS}s`,
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
      />
    </div>
  );
}

function FogFx(): React.JSX.Element {
  const configs = [
    { side: "left" as const,  top: "15%", dur: 14, delay: 0,   from: "-60%", to: "160%" },
    { side: "left" as const,  top: "40%", dur: 17, delay: 3.5, from: "-60%", to: "160%" },
    { side: "left" as const,  top: "65%", dur: 15, delay: 7,   from: "-60%", to: "160%" },
    { side: "right" as const, top: "25%", dur: 16, delay: 1.5, from: "60%",  to: "-160%" },
    { side: "right" as const, top: "55%", dur: 18, delay: 5,   from: "60%",  to: "-160%" },
  ];
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      {configs.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            [c.side]: 0,
            top: c.top,
            width: 420,
            height: 160,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.65) 0%, rgba(220,225,240,0.25) 50%, rgba(255,255,255,0) 80%)",
            filter: "blur(26px)",
            animationName: "hh-ctl-fog",
            animationDuration: `${c.dur}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationDelay: `${c.delay}s`,
            mixBlendMode: "screen",
            // CSS vars consumed by the keyframe
            ["--hh-fog-from" as string]: c.from,
            ["--hh-fog-to" as string]: c.to,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function RainFx(): React.JSX.Element {
  const streaks = Array.from({ length: 42 }).map((_, i) => ({
    x: 2 + i * 2.3,
    delay: ((i * 173) % 1500) / 1000,
    dur: 1.1 + ((i * 41) % 7) * 0.1,
  }));
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(80,100,160,0.07) 0%, rgba(40,60,100,0.14) 100%)",
          mixBlendMode: "screen",
        }}
      />
      {streaks.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: 0,
            width: 1,
            height: 80,
            background: "linear-gradient(180deg, rgba(220,235,255,0) 0%, rgba(220,235,255,0.8) 60%, rgba(220,235,255,0) 100%)",
            animationName: "hh-ctl-rain",
            animationDuration: `${s.dur}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function VignetteFx(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.95) 100%)",
          animationName: "hh-ctl-breath",
          animationDuration: "8s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
      />
    </div>
  );
}

function DustFx(): React.JSX.Element {
  const motes = Array.from({ length: 24 }).map((_, i) => ({
    x: 2 + ((i * 97) % 96),
    y: 0 + ((i * 61) % 15),
    delay: ((i * 211) % 7000) / 1000,
    dur: 9 + ((i * 37) % 7),
    dx: -14 + ((i * 83) % 29),
  }));
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      {motes.map((m, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,240,210,0.95) 0%, rgba(255,240,210,0) 70%)",
            animationName: "hh-ctl-dust",
            animationDuration: `${m.dur}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationDelay: `${m.delay}s`,
            mixBlendMode: "screen",
            ["--hh-dust-dx" as string]: `${m.dx}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function PhantomFx(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, transparent 20%, rgba(0,0,0,0.6) 95%)",
          animationName: "hh-ctl-phantom-dim",
          animationDuration: "18s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: 0,
          width: "100%",
          height: "70%",
          animationName: "hh-ctl-phantom-walk",
          animationDuration: "18s",
          animationIterationCount: "infinite",
          animationTimingFunction: "linear",
        }}
      >
        <svg viewBox="0 0 60 140" width={60} height={160} style={{ display: "block" }}>
          <path
            d="M 30 10 C 20 10, 14 20, 16 32 L 14 46 L 10 70 L 12 110 L 20 110 L 22 80 L 28 80 L 28 110 L 34 110 L 36 80 L 42 80 L 44 110 L 50 110 L 48 70 L 46 46 L 44 32 C 46 20, 40 10, 30 10 Z"
            fill="rgba(5,3,10,0.95)"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    </div>
  );
}

function ChimeFx(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 30,
          width: 80,
          height: 80,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -24,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,220,160,0.85) 0%, rgba(255,170,90,0.3) 40%, rgba(255,140,60,0) 70%)",
            animationName: "hh-ctl-bell",
            animationDuration: "20s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            mixBlendMode: "screen",
          }}
        />
        <svg viewBox="0 0 60 60" width="100%" height="100%" style={{ position: "relative" }}>
          <path
            d="M 30 10 L 30 14 M 20 16 C 20 10, 40 10, 40 16 L 42 42 L 18 42 Z M 16 44 L 44 44 M 28 48 L 32 48"
            fill="rgba(216,168,86,0.85)"
            stroke="#8a5a2a"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function CobwebFx(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <svg viewBox="0 0 180 180" style={{ position: "absolute", top: 56, right: 10, width: 160, height: 160 }}>
        <g
          fill="none"
          stroke="rgba(230,230,240,0.75)"
          strokeWidth="0.9"
          strokeDasharray="500"
          style={{
            animationName: "hh-ctl-cobweb-grow",
            animationDuration: "60s",
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
          }}
        >
          <line x1="180" y1="0" x2="0" y2="180" />
          <line x1="180" y1="0" x2="30" y2="180" />
          <line x1="180" y1="0" x2="90" y2="180" />
          <line x1="180" y1="0" x2="180" y2="180" />
          <line x1="180" y1="0" x2="0" y2="120" />
          <line x1="180" y1="0" x2="0" y2="60" />
          <path d="M 180 36 Q 138 63, 165 90" />
          <path d="M 180 72 Q 114 90, 150 138" />
          <path d="M 180 108 Q 90 114, 108 177" />
          <path d="M 162 0 Q 114 48, 54 90" />
        </g>
      </svg>
    </div>
  );
}

function CandelabraFx(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 18,
          width: 140,
          height: 140,
        }}
      >
        <svg viewBox="0 0 160 160" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <g fill="rgba(14,8,4,0.95)" stroke="rgba(216,168,86,0.35)" strokeWidth="0.6">
            <rect x="68" y="135" width="24" height="5" rx="1" />
            <rect x="60" y="140" width="40" height="6" rx="2" />
            <rect x="78" y="60" width="4" height="80" />
            <path d="M 80 80 Q 50 80, 40 55 L 40 70 Q 50 72, 70 92" />
            <path d="M 80 80 Q 110 80, 120 55 L 120 70 Q 110 72, 90 92" />
            <rect x="36" y="50" width="8" height="8" rx="1" />
            <rect x="116" y="50" width="8" height="8" rx="1" />
            <rect x="74" y="48" width="12" height="10" rx="1" />
            <rect x="37" y="36" width="6" height="14" fill="#ead8a8" />
            <rect x="117" y="36" width="6" height="14" fill="#ead8a8" />
            <rect x="75" y="30" width="10" height="18" fill="#ead8a8" />
          </g>
        </svg>
        {[
          { left: 40, top: 20, delay: 0,   dur: 1.4 },
          { left: 80, top: 14, delay: 0.3, dur: 1.6 },
          { left: 120, top: 20, delay: 0.6, dur: 1.3 },
        ].map((f, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: f.left,
              top: f.top,
              width: 10,
              height: 18,
              marginLeft: -5,
              background: "radial-gradient(ellipse 60% 100% at 50% 100%, #ffe28a 0%, #ff9a2a 55%, rgba(255,120,30,0) 90%)",
              filter: "blur(0.6px)",
              borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
              transformOrigin: "50% 100%",
              animationName: "hh-ctl-flame",
              animationDuration: `${f.dur}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              animationDelay: `${f.delay}s`,
              boxShadow: "0 -4px 14px rgba(255,170,70,0.6), 0 0 10px rgba(255,210,120,0.4)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BlowoutFx(): React.JSX.Element {
  return (
    <div aria-hidden style={OVERLAY_BASE}>
      <div
        style={{
          position: "absolute",
          left: "32%",
          top: "20%",
          marginLeft: -90,
          marginTop: -90,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,220,150,0.95) 0%, rgba(255,180,80,0.55) 35%, rgba(255,140,40,0) 70%)",
          animationName: "hh-ctl-blowout",
          animationDuration: "22s",
          animationIterationCount: "infinite",
          animationTimingFunction: "steps(1)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Icons · brass/amber palette for the Haunted Hotel chrome
// ───────────────────────────────────────────────────────────────────────────

function BoltIcon(): React.JSX.Element {
  return (
    <svg width={22} height={28} viewBox="0 0 20 26" aria-hidden>
      <path d="M12 2 3 15h6l-2 9 9-13h-6l2-9Z" fill="currentColor" />
    </svg>
  );
}
function FogIcon(): React.JSX.Element {
  return (
    <svg width={28} height={22} viewBox="0 0 32 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M4 8 h18 M6 13 h20 M3 18 h22" />
    </svg>
  );
}
function RainIcon(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 8a5 5 0 0 1 9.6-1.9A4 4 0 1 1 17 14H7a4 4 0 0 1-1-7.9Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M9 17v3M12 17v4M15 17v3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
function VignetteIcon(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden>
      <defs>
        <radialGradient id="hhv" cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="24" height="24" rx="4" fill="url(#hhv)" />
    </svg>
  );
}
function DustIcon(): React.JSX.Element {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <circle cx="6" cy="6" r="1.5" />
      <circle cx="14" cy="4" r="1" />
      <circle cx="18" cy="10" r="1.3" />
      <circle cx="10" cy="12" r="1" />
      <circle cx="6" cy="18" r="1.4" />
      <circle cx="14" cy="18" r="1" />
      <circle cx="20" cy="18" r="1.1" />
    </svg>
  );
}
function PhantomIcon(): React.JSX.Element {
  return (
    <svg width={22} height={28} viewBox="0 0 22 28" aria-hidden>
      <path d="M11 3 C7 3, 4 7, 5 12 L4 20 L7 24 L10 20 L13 24 L16 20 L18 24 L17 12 C18 7, 15 3, 11 3 Z" fill="currentColor" />
    </svg>
  );
}
function BellIcon(): React.JSX.Element {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 V 5 M7 7 C7 4, 17 4, 17 7 L18 17 L6 17 Z M4 19 L20 19 M11 21 L13 21" />
    </svg>
  );
}
function WebIcon(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.2}>
      <line x1="28" y1="0" x2="0" y2="28" />
      <line x1="28" y1="0" x2="6" y2="28" />
      <line x1="28" y1="0" x2="16" y2="28" />
      <line x1="28" y1="0" x2="28" y2="28" />
      <line x1="28" y1="0" x2="0" y2="12" />
      <path d="M 28 6 Q 20 12, 24 18 M 28 14 Q 14 18, 20 26 M 24 0 Q 16 10, 4 16" />
    </svg>
  );
}
function CandelabraIcon(): React.JSX.Element {
  return (
    <svg width={26} height={28} viewBox="0 0 22 24" aria-hidden fill="currentColor">
      <rect x="10" y="6" width="2" height="12" />
      <path d="M 11 10 Q 4 10, 3 6 L 3 8 Q 4 9, 8 11 Z" />
      <path d="M 11 10 Q 18 10, 19 6 L 19 8 Q 18 9, 14 11 Z" />
      <rect x="9" y="4" width="4" height="4" />
      <rect x="2" y="4" width="2" height="3" />
      <rect x="18" y="4" width="2" height="3" />
      <rect x="8" y="18" width="6" height="2" />
      <rect x="7" y="20" width="8" height="2" />
    </svg>
  );
}
function LampIcon(): React.JSX.Element {
  return (
    <svg width={24} height={28} viewBox="0 0 22 26" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M11 2 L17 10 L5 10 Z" fill="currentColor" />
      <line x1="11" y1="10" x2="11" y2="24" />
      <line x1="7" y1="24" x2="15" y2="24" />
    </svg>
  );
}
