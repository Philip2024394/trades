"use client";

// src/app/nex-native/themes/[id]/_joker-controller.tsx
//
// Joker theme · animation controller · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Floating 3-dots trigger (bottom-right) opens a full-screen panel with
// landscape cards for each ambient animation. Each card has an icon
// frame on the left and a toggle switch on the right. Toggles persist in
// localStorage so the user's choice sticks across sessions.
//
//  · Rain      · toggle on → continuous rain overlay
//  · Flying    · toggle on → 5s bat burst each time the user hits Send
//    Bats        (via a `nex-joker-send` CustomEvent dispatched by the
//                 composer when the form submits)
//  · Lightning · toggle on → sparse scheduled strikes (90-240s cadence)
//
// Only mounted for the Joker theme (theme-0) · other themes stay quiet.

import * as React from "react";
import { JokerMotionOverlay, JokerWiseCardDraw } from "./_joker-motion";
import type { JokerMotionVariant } from "./_joker-motion-data";

const STORAGE_KEY = "nex_joker_motion_toggles_v1";
const BAT_BURST_MS = 5000;
// Wise card lifetime · 8s on-screen animation + 2s quiet tail before
// the parent unmounts the overlay, matching the founder's sealed
// "6s read + 2s after disappear" spec (6s read window lives inside
// the 8s animation at the 20-80% keyframe band).
const WISE_CARD_LIFE_MS = 10000;
const WISE_CARD_ENABLED_KEY = "nex_joker_wise_card_enabled_v1";

type Toggles = Partial<Record<JokerMotionVariant, boolean>>;

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
  variant: JokerMotionVariant;
  label: string;
  caption: string;
  icon: React.ReactNode;
}

const CARDS: CardSpec[] = [
  {
    variant: "rain",
    label: "Rain",
    caption: "Toxic green streaks fall across the chat.",
    icon: <RainIcon />,
  },
  {
    variant: "bat",
    label: "Flying Bats",
    caption: "A short flock bursts up from the send button each time you post.",
    icon: <BatIcon />,
  },
  {
    variant: "lightning",
    label: "Lightning",
    caption: "Sparse strikes · never more than one every ~90 seconds.",
    icon: <BoltIcon />,
  },
];

export interface JokerControllerProps {
  /** When tapped on the NEX Trust Scan action card, the controller
   *  closes its panel and calls this. The parent (theme viewer /
   *  chat shell) owns the Trust Scan overlay state. */
  onOpenTrustScan?: () => void;
}

export function JokerController({
  onOpenTrustScan,
}: JokerControllerProps = {}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [toggles, setToggles] = React.useState<Toggles>({});
  const [batBurstKey, setBatBurstKey] = React.useState<number | null>(null);
  // Wise Card · hybrid toggle + button · founder-sealed 2026-10-01.
  // `wiseCardEnabled` persists in localStorage and gates the Draw
  // button · `wiseCardKey` is bumped on each Draw tap so the overlay
  // mounts a fresh instance (restarting the animation cleanly).
  const [wiseCardEnabled, setWiseCardEnabled] = React.useState(false);
  const [wiseCardKey, setWiseCardKey] = React.useState<number | null>(null);

  // Hydrate from localStorage + listen for cross-tab changes.
  React.useEffect(() => {
    setToggles(loadToggles());
    try {
      setWiseCardEnabled(
        window.localStorage.getItem(WISE_CARD_ENABLED_KEY) === "1",
      );
    } catch {
      /* no-op */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setToggles(loadToggles());
      if (e.key === WISE_CARD_ENABLED_KEY) {
        setWiseCardEnabled(e.newValue === "1");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setWiseCardEnabledPersisted = React.useCallback((next: boolean) => {
    setWiseCardEnabled(next);
    try {
      window.localStorage.setItem(WISE_CARD_ENABLED_KEY, next ? "1" : "0");
    } catch {
      /* no-op */
    }
    // If the user turns the feature OFF while a card is in flight,
    // clear it immediately · otherwise the current draw finishes and
    // then no further draws are possible until re-enabled.
    if (!next) setWiseCardKey(null);
  }, []);

  const drawWiseCard = React.useCallback(() => {
    if (!wiseCardEnabled) return;
    const key = Date.now();
    setWiseCardKey(key);
    window.setTimeout(() => {
      setWiseCardKey((prev) => (prev === key ? null : prev));
    }, WISE_CARD_LIFE_MS);
  }, [wiseCardEnabled]);

  // Flying bats bind: when toggle is on, each send-press mounts a fresh
  // bat overlay keyed by a timestamp so the animation restarts cleanly
  // every time. The overlay auto-unmounts after BAT_BURST_MS.
  React.useEffect(() => {
    if (!toggles.bat) return;
    const onSend = () => {
      const key = Date.now();
      setBatBurstKey(key);
      window.setTimeout(() => {
        setBatBurstKey((prev) => (prev === key ? null : prev));
      }, BAT_BURST_MS);
    };
    window.addEventListener("nex-joker-send", onSend as EventListener);
    return () =>
      window.removeEventListener("nex-joker-send", onSend as EventListener);
  }, [toggles.bat]);

  const setToggle = React.useCallback(
    (variant: JokerMotionVariant, next: boolean) => {
      setToggles((prev) => {
        const merged = { ...prev, [variant]: next };
        saveToggles(merged);
        return merged;
      });
    },
    [],
  );

  return (
    <>
      {/* Enabled continuous overlays · each variant renders its own
          full-viewport motion layer. Bats are handled separately via
          batBurstKey because they fire on send, not continuously. */}
      {toggles.rain && <JokerMotionOverlay variant="rain" />}
      {toggles.lightning && <JokerMotionOverlay variant="lightning" />}
      {batBurstKey !== null && (
        <JokerMotionOverlay key={batBurstKey} variant="bat" />
      )}
      {/* Wise Card draw · one-shot · auto-unmounts after the 10s
          lifetime (8s animation + 2s quiet tail per sealed spec). */}
      {wiseCardKey !== null && <JokerWiseCardDraw key={wiseCardKey} />}

      {/* 3-dots floating trigger · bottom-right · hidden while the
          panel is open so it doesn't double up as a dismiss target. */}
      {!open && (
        <button
          type="button"
          aria-label="Theme animations"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 14,
            bottom: 96,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(10,15,25,0.78)",
            border: "1px solid rgba(143,255,110,0.35)",
            color: "#8FFF6E",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            zIndex: 9995,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
          }}
        >
          <DancingDots />
        </button>
      )}

      {/* Full-screen panel · 100vw x 100dvh · dim backdrop + the stack
          of landscape cards centered. Backdrop tap closes. */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Joker theme animations"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            background:
              "linear-gradient(180deg, rgba(4,10,20,0.94) 0%, rgba(2,6,14,0.96) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            padding: "28px 18px 24px",
            overflowY: "auto",
            animation: "nex-joker-controller-in 180ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          <style>{`
            @keyframes nex-joker-controller-in {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
          `}</style>
          <div
            style={{
              color: "#8FFF6E",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Joker · Animations
          </div>
          <div
            style={{
              marginTop: 6,
              color: "rgba(220,230,245,0.6)",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Toggle any animation on or off. Choices persist on this device.
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
            {/* NEX Trust Scan · theme-neutral action card · the panel
                is theme-specific but the action it fires is a NEX
                product (see trust-scan-skin.tsx). Tapping Open closes
                the panel and asks the parent to mount the Trust Scan
                overlay. */}
            {onOpenTrustScan && (
              <ActionCard
                icon={<ShieldIcon />}
                label="NEX Trust Scan"
                caption="Open the trust report for this account."
                actionLabel="Open"
                onAction={() => {
                  setOpen(false);
                  onOpenTrustScan();
                }}
              />
            )}
            {CARDS.map((c) => (
              <AnimationCard
                key={c.variant}
                spec={c}
                enabled={!!toggles[c.variant]}
                onToggle={(next) => setToggle(c.variant, next)}
              />
            ))}
            {/* Wise Card · hybrid toggle + Draw button · founder-sealed
                2026-10-01 · each Draw tap fires exactly ONE wise card
                (6s read + 1s swoop in + 1s fade out + 2s quiet tail
                before unmount). Toggle persists; Draw is disabled when
                the toggle is off. */}
            <WiseCardControlCard
              enabled={wiseCardEnabled}
              onToggle={setWiseCardEnabledPersisted}
              onDraw={() => {
                setOpen(false);
                drawWiseCard();
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              marginTop: 26,
              alignSelf: "center",
              padding: "10px 30px",
              background: "transparent",
              border: "1px solid rgba(143,255,110,0.45)",
              color: "#8FFF6E",
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 13,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Action card · [icon][label + caption][button] · for tap-to-open flows
// (e.g. NEX Trust Scan) that don't have a toggle semantic.
// ---------------------------------------------------------------------------
function ActionCard({
  icon,
  label,
  caption,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  caption: string;
  actionLabel: string;
  onAction: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(14,24,38,0.9) 0%, rgba(8,16,28,0.9) 100%)",
        border: "1px solid rgba(0,175,255,0.45)",
        boxShadow:
          "0 0 24px rgba(0,175,255,0.14), 0 8px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 54,
          height: 54,
          borderRadius: 14,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(0,175,255,0.3)",
          display: "grid",
          placeItems: "center",
          color: "#00AFFF",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F2F5F8",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: "rgba(200,215,235,0.65)",
            fontSize: 11,
            lineHeight: 1.35,
            marginTop: 2,
          }}
        >
          {caption}
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        style={{
          flexShrink: 0,
          padding: "8px 18px",
          borderRadius: 999,
          background:
            "linear-gradient(180deg, rgba(0,175,255,0.3) 0%, rgba(0,120,200,0.18) 100%)",
          border: "1px solid rgba(0,175,255,0.65)",
          color: "#DCECFF",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 0 16px rgba(0,175,255,0.3)",
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function ShieldIcon(): React.JSX.Element {
  return (
    <svg width={26} height={28} viewBox="0 0 22 24" fill="none" aria-hidden>
      <path
        d="M11 1.5 L19.5 4.5 V12 C19.5 17.5 15.5 21 11 22.5 C6.5 21 2.5 17.5 2.5 12 V4.5 Z"
        fill="rgba(0,175,255,0.14)"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M7 11.5 L10 14.5 L15 8.5"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Landscape card · [icon frame][label + caption][toggle]
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
        padding: "12px 14px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(14,24,38,0.9) 0%, rgba(8,16,28,0.9) 100%)",
        border: enabled
          ? "1px solid rgba(143,255,110,0.5)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: enabled
          ? "0 0 24px rgba(143,255,110,0.18)"
          : "0 8px 20px rgba(0,0,0,0.4)",
        transition: "border 160ms ease, box-shadow 160ms ease",
      }}
    >
      {/* Icon frame · left */}
      <div
        style={{
          flexShrink: 0,
          width: 54,
          height: 54,
          borderRadius: 14,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "grid",
          placeItems: "center",
          color: "#B8F7A3",
        }}
      >
        {spec.icon}
      </div>

      {/* Label + caption · middle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F2F5F8",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.01em",
          }}
        >
          {spec.label}
        </div>
        <div
          style={{
            color: "rgba(200,215,235,0.65)",
            fontSize: 11,
            lineHeight: 1.35,
            marginTop: 2,
          }}
        >
          {spec.caption}
        </div>
      </div>

      {/* Toggle · right */}
      <ToggleSwitch value={enabled} onChange={onToggle} ariaLabel={spec.label} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wise Card hybrid control · landscape card with Draw button + toggle
// sealed 2026-10-01. Draw fires a one-shot JokerWiseCardDraw mount.
// ---------------------------------------------------------------------------
function WiseCardControlCard({
  enabled,
  onToggle,
  onDraw,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onDraw: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(14,24,38,0.9) 0%, rgba(8,16,28,0.9) 100%)",
        border: enabled
          ? "1px solid rgba(143,255,110,0.5)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: enabled
          ? "0 0 24px rgba(143,255,110,0.18)"
          : "0 8px 20px rgba(0,0,0,0.4)",
        transition: "border 160ms ease, box-shadow 160ms ease",
      }}
    >
      {/* Icon · playing card glyph */}
      <div
        style={{
          flexShrink: 0,
          width: 54,
          height: 54,
          borderRadius: 14,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "grid",
          placeItems: "center",
          color: "#B8F7A3",
        }}
      >
        <WiseCardIcon />
      </div>
      {/* Label + caption */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F2F5F8",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.01em",
          }}
        >
          Wise Card
        </div>
        <div
          style={{
            color: "rgba(200,215,235,0.65)",
            fontSize: 11,
            lineHeight: 1.35,
            marginTop: 2,
          }}
        >
          Draw a card · 6s to read · one card per tap.
        </div>
      </div>
      {/* Right · Draw button stacked above the toggle */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onDraw}
          disabled={!enabled}
          aria-label="Draw a wise card"
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            background: enabled
              ? "linear-gradient(180deg, rgba(143,255,110,0.3) 0%, rgba(90,200,70,0.18) 100%)"
              : "rgba(143,255,110,0.08)",
            border: enabled
              ? "1px solid rgba(143,255,110,0.6)"
              : "1px solid rgba(255,255,255,0.08)",
            color: enabled ? "#B8F7A3" : "rgba(200,215,235,0.4)",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            cursor: enabled ? "pointer" : "not-allowed",
            opacity: enabled ? 1 : 0.6,
            boxShadow: enabled ? "0 0 14px rgba(143,255,110,0.25)" : "none",
            transition: "opacity 160ms ease, box-shadow 160ms ease",
          }}
        >
          Draw
        </button>
        <ToggleSwitch value={enabled} onChange={onToggle} ariaLabel="Wise Card" />
      </div>
    </div>
  );
}

function WiseCardIcon(): React.JSX.Element {
  return (
    <svg width={24} height={30} viewBox="0 0 22 28" aria-hidden>
      <rect
        x={2}
        y={2}
        width={18}
        height={24}
        rx={3}
        fill="rgba(143,255,110,0.14)"
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <text
        x={5}
        y={10}
        fontSize={6}
        fontFamily="serif"
        fontWeight="700"
        fill="currentColor"
      >
        J
      </text>
      <circle cx={11} cy={14} r={3} stroke="currentColor" strokeWidth={1.3} fill="none" />
      <path d="M8 18 Q 11 20, 14 18" stroke="currentColor" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <text
        x={14}
        y={23}
        fontSize={6}
        fontFamily="serif"
        fontWeight="700"
        fill="currentColor"
        transform="rotate(180 15 21)"
      >
        J
      </text>
    </svg>
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
        border: value
          ? "1px solid rgba(143,255,110,0.65)"
          : "1px solid rgba(255,255,255,0.12)",
        background: value ? "rgba(143,255,110,0.22)" : "rgba(0,0,0,0.45)",
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
          background: value ? "#8FFF6E" : "rgba(220,230,245,0.6)",
          boxShadow: value
            ? "0 0 10px rgba(143,255,110,0.65)"
            : "0 1px 3px rgba(0,0,0,0.5)",
          transition: "left 160ms cubic-bezier(.2,.7,.2,1), background 160ms ease",
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Trigger glyph + card icons
// ---------------------------------------------------------------------------
function DancingDots(): React.JSX.Element {
  return (
    <>
      <style>{`
        @keyframes nex-joker-dot {
          0%, 80%, 100% { transform: scale(1);   opacity: 0.55; }
          40%           { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "currentColor",
              animation: "nex-joker-dot 900ms ease-in-out infinite",
              animationDelay: `${i * 140}ms`,
            }}
          />
        ))}
      </span>
    </>
  );
}

function RainIcon(): React.JSX.Element {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8a5 5 0 0 1 9.6-1.9A4 4 0 1 1 17 14H7a4 4 0 0 1-1-7.9Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M9 17v3M12 17v4M15 17v3"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BatIcon(): React.JSX.Element {
  // Simple bat silhouette · reuses the Joker palette green so the icon
  // matches the rest of the card chrome. The real bat PNG lives at
  // /nex-themes/joker-bat.png but using an SVG keeps the card crisp.
  return (
    <svg width={32} height={20} viewBox="0 0 36 22" aria-hidden>
      <path
        d="M18 2c-1 3-3 5-7 5-3 0-5-2-7-2 2 2 1 5 2 7 1 2 4 3 7 3 2 0 3-1 5-3 2 2 3 3 5 3 3 0 6-1 7-3 1-2 0-5 2-7-2 0-4 2-7 2-4 0-6-2-7-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BoltIcon(): React.JSX.Element {
  return (
    <svg width={22} height={28} viewBox="0 0 20 26" aria-hidden>
      <path
        d="M12 2 3 15h6l-2 9 9-13h-6l2-9Z"
        fill="currentColor"
      />
    </svg>
  );
}
