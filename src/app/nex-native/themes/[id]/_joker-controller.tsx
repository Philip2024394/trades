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
// Stage 1 universal-chrome convergence (sealed 2026-10-05) · the Trust
// Scan auto-open preference used to live here as a theme-local toggle.
// Trust Scan is a universal NEX feature now (rendered by
// UniversalChatControls), so the preference is no longer a Joker
// concern. The localStorage key itself is preserved — not deleted
// elsewhere — so any value a user already set is retained for a future
// universal-Trust-Scan preference surface.

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
    caption: "Green rain streaks.",
    icon: <RainIcon />,
  },
  {
    variant: "bat",
    label: "Flying Bats",
    caption: "Bats fly up on send.",
    icon: <BatIcon />,
  },
  {
    variant: "lightning",
    label: "Lightning",
    caption: "Rare sparse strikes.",
    icon: <BoltIcon />,
  },
];

export interface JokerControllerProps {
  // Stage 1 (sealed 2026-10-05) · onOpenTrustScan removed · Trust Scan
  // is now a universal shell action owned by UniversalChatControls, not
  // a Joker-controller action. The prop interface is kept exported so
  // any residual importers typecheck cleanly while the preview layer
  // migration completes.
}

export function JokerController(
  _props: JokerControllerProps = {},
): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [toggles, setToggles] = React.useState<Toggles>({});
  const [batBurstKey, setBatBurstKey] = React.useState<number | null>(null);
  // Sealed 2026-10-01 · hide the dancing-dots trigger while the shop
  // slider is up so the floating button doesn't sit on top of the
  // slider content. ShopGridModal broadcasts `nex-shop-slider-visible`
  // when it opens / closes.
  const [shopSliderOpen, setShopSliderOpen] = React.useState(false);
  React.useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      setShopSliderOpen(!!detail?.open);
    };
    window.addEventListener("nex-shop-slider-visible", onEvt as EventListener);
    return () =>
      window.removeEventListener(
        "nex-shop-slider-visible",
        onEvt as EventListener,
      );
  }, []);
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
    const key = Date.now();
    setWiseCardKey(key);
    window.setTimeout(() => {
      setWiseCardKey((prev) => (prev === key ? null : prev));
    }, WISE_CARD_LIFE_MS);
  }, []);

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

      {/* 3-dots floating trigger · bottom-right · no circle / border /
          background · just the dots floating per founder direction
          2026-10-01 · hidden while the panel is open so it doesn't
          double up as a dismiss target. */}
      {!open && !shopSliderOpen && (
        <button
          type="button"
          aria-label="Theme animations"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 4,
            bottom: 96,
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: 0,
            background: "transparent",
            border: "none",
            color: "#8FFF6E",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            zIndex: 9995,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
          }}
        >
          <DancingDots />
        </button>
      )}

      {/* Full-screen panel · 100vw x 100dvh · alley backdrop + the
          stack of landscape cards centered. Backdrop tap closes.
          Sealed 2026-10-01 · backdrop now reuses the exact Joker
          shop-slider wallpaper (joker-shop-bg.png) under the same
          light vignette as ShopGridModal so the two surfaces read
          as one visual family. */}
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
              "linear-gradient(180deg, rgba(6,15,28,0.18) 0%, rgba(3,10,20,0.32) 100%), url(/nex-themes/joker-shop-bg.png) center center / cover no-repeat",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            padding:
              "calc(env(safe-area-inset-top, 0) + 76px) 18px 24px",
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
            {/* Stage 1 universal-chrome convergence (sealed 2026-10-05) ·
                the Trust Scan action card previously lived here. It has
                been moved out of JokerController into
                `UniversalChatControls` so Trust Scan is now reachable on
                every production theme, not just Joker. Joker's panel
                keeps the theme-specific ambient toggles + Wise Card
                below; universal NEX actions live in the universal
                3-dots menu rendered natively by PortraitBloomShell. */}
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
              onToggle={(next) => {
                setWiseCardEnabledPersisted(next);
                if (next) {
                  setOpen(false);
                  // Sealed 2026-10-01 · wait a full frame + 140ms
                  // after closing the panel before firing the draw.
                  // Earlier setTimeout(0) raced with React 18's
                  // batched state flush and the card was mounting
                  // while the panel was still unmounting, so the
                  // overlay was being hidden before the user could
                  // see it. RAF + delay guarantees paint-order
                  // correctness.
                  requestAnimationFrame(() => {
                    window.setTimeout(() => drawWiseCard(), 140);
                  });
                }
              }}
            />
          </div>

          {/* Round × close · top-right of the panel · sealed 2026-10-01.
              Floats over the backdrop so it stays reachable regardless
              of how many cards are stacked below. */}
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
              background: "linear-gradient(180deg, #0a1a30 0%, #020914 100%)",
              border: "1px solid rgba(0,159,239,0.65)",
              color: "#009FEF",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              zIndex: 2,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
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
// Action card · [icon][label + caption][button] · for tap-to-open flows
// (e.g. NEX Trust Scan) that don't have a toggle semantic.
// ---------------------------------------------------------------------------
function ActionCard({
  icon,
  label,
  caption,
  actionLabel,
  onAction,
  toggleValue,
  onToggle,
  toggleLabel,
}: {
  icon: React.ReactNode;
  label: string;
  caption: string;
  /** Fallback action button when the card has no toggle. If a toggle
   *  is provided the toggle itself becomes the sole control (toggle ON
   *  fires the action AND persists the enabled state). */
  actionLabel?: string;
  onAction?: () => void;
  toggleValue?: boolean;
  onToggle?: (next: boolean) => void;
  toggleLabel?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        // Sealed 2026-10-01 · aligned to the ShopTypeButton palette so
        // the 3-dots panel cards and the "What are you selling on NEX?"
        // chooser read as the same card family · same cyan tint ·
        // same border weight · same paddings.
        background:
          "linear-gradient(180deg, rgba(0,159,239,0.14) 0%, rgba(0,159,239,0.06) 100%)",
        border: "1px solid rgba(0,159,239,0.5)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(0,159,239,0.35)",
          display: "grid",
          placeItems: "center",
          color: "#009FEF",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F4F7FC",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div
          style={{
            // Sealed 2026-10-01 · proto #05 · TV-broadcast legibility
            // dual shadow + brighter neutral gray · matches the
            // ShopTypeButton caption treatment exactly so the two
            // card families read as one language.
            color: "#B4BAC3",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            marginTop: 3,
            whiteSpace: "nowrap",
            textShadow:
              "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {caption}
        </div>
      </div>
      {onToggle ? (
        <ToggleSwitch
          value={!!toggleValue}
          onChange={onToggle}
          ariaLabel={toggleLabel ?? label}
        />
      ) : (
        actionLabel &&
        onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #0a1a30 0%, #020914 100%)",
              border: "1px solid rgba(0,159,239,0.65)",
              color: "#009FEF",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {actionLabel}
          </button>
        )
      )}
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
        padding: "14px 16px",
        borderRadius: 14,
        // Sealed 2026-10-01 · aligned to the ShopTypeButton palette so
        // the 3-dots panel cards and the "What are you selling on NEX?"
        // chooser read as the same card family · same cyan tint ·
        // same border weight · same paddings.
        background:
          "linear-gradient(180deg, rgba(0,159,239,0.14) 0%, rgba(0,159,239,0.06) 100%)",
        border: "1px solid rgba(0,159,239,0.5)",
      }}
    >
      {/* Icon frame · left */}
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(0,159,239,0.35)",
          display: "grid",
          placeItems: "center",
          color: "#009FEF",
        }}
      >
        {spec.icon}
      </div>

      {/* Label + caption · middle · locked to a single line each so
          the row heights stay flush across every card and nothing
          wraps unpredictably over the alley wallpaper. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F4F7FC",
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
            // Sealed 2026-10-01 · proto #05 · TV-broadcast legibility
            // · matches the ShopTypeButton caption treatment so the
            // panel cards and the chooser cards read as one family.
            color: "#B4BAC3",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow:
              "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
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
}: {
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
        // Sealed 2026-10-01 · aligned to the ShopTypeButton palette so
        // the 3-dots panel cards and the "What are you selling on NEX?"
        // chooser read as the same card family · same cyan tint ·
        // same border weight · same paddings.
        background:
          "linear-gradient(180deg, rgba(0,159,239,0.14) 0%, rgba(0,159,239,0.06) 100%)",
        border: "1px solid rgba(0,159,239,0.5)",
      }}
    >
      {/* Icon · playing card glyph */}
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(0,159,239,0.35)",
          display: "grid",
          placeItems: "center",
          color: "#009FEF",
        }}
      >
        <WiseCardIcon />
      </div>
      {/* Label + caption · single-line each · matches ActionCard +
          AnimationCard so every card in the panel reads the same. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F4F7FC",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          Daily Insight
        </div>
        <div
          style={{
            // Sealed 2026-10-01 · proto #05 · TV-broadcast legibility
            // dual shadow + brighter neutral gray · matches the
            // ShopTypeButton caption treatment exactly so the two
            // card families read as one language.
            color: "#B4BAC3",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            marginTop: 3,
            whiteSpace: "nowrap",
            textShadow:
              "0 0 2px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          A card to read.
        </div>
      </div>
      {/* Right · toggle only · tapping ON fires one draw AND persists
          the enabled state (parent decides the semantics). */}
      <ToggleSwitch
        value={enabled}
        onChange={onToggle}
        ariaLabel="Daily Insight"
      />
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
          ? "1px solid rgba(0,159,239,0.65)"
          : "1px solid rgba(255,255,255,0.12)",
        background: value ? "rgba(0,159,239,0.22)" : "rgba(0,0,0,0.45)",
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
          background: value ? "#009FEF" : "rgba(220,230,245,0.6)",
          boxShadow: value
            ? "0 0 10px rgba(0,159,239,0.65)"
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
