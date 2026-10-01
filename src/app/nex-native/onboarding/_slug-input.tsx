"use client";

// src/app/nex-native/onboarding/_slug-input.tsx
//
// Live .nex slug input · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Live-availability input used on the seller onboarding page. As the
// user types, debounces 350ms then POSTs to the slug-availability route
// (/api/nex-native/slug-availability) and renders inline status:
//
//   · green tick ✓          · available for this viewer's tier
//   · red × with reason     · format error / reserved / too short for
//                             tier / already taken
//   · spinner while checking
//
// Live preview under the input shows `<slug>.nex` in the active state
// colour so the seller sees exactly what they're claiming.
//
// Policy enforcement (sealed 2026-10-01 · B):
//   · Gratis · slugs must be ≥ 7 chars OR contain a hyphen
//     (compound). Short/premium names are Bisnis-only.
//   · Bisnis · any valid slug 1-64 chars.
//   · Reserved prefixes blocked for all.
//
// Hidden `<input name="slug">` carries the normalized value into the
// surrounding form so `createBusinessAction` picks it up unchanged.

import * as React from "react";
import { createPortal } from "react-dom";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; tier: "gratis" | "bisnis" }
  | {
      kind: "err";
      reason: "format" | "reserved" | "too_short_for_tier" | "taken";
      tier: "gratis" | "bisnis";
    };

function reasonCopy(
  reason: "format" | "reserved" | "too_short_for_tier" | "taken",
  tier: "gratis" | "bisnis",
): string {
  switch (reason) {
    case "format":
      return "Lowercase letters, digits, and hyphens only · no leading/trailing hyphen.";
    case "reserved":
      return "That name starts with a reserved prefix (nex-, admin, system…). Try another.";
    case "too_short_for_tier":
      return tier === "gratis"
        ? "This shop name is available only with a Business account. Free shop names similar can be selected below · or try again."
        : "Name is too short.";
    case "taken":
      return "Already taken · pick another name.";
  }
}

/** Build 3 compound variants of a short slug so a Gratis seller can
 *  one-tap confirm instead of being told to "figure it out." Keeps the
 *  user's original word front-and-center · appends an industry-neutral
 *  qualifier that satisfies the ≥ 7 char OR has-hyphen rule. */
function suggestCompoundSlugs(base: string): string[] {
  const clean = base.replace(/-+$/, "");
  if (!clean) return [];
  return [`${clean}-shop`, `${clean}-studio`, `${clean}-store`];
}

export function SlugInput({
  tier,
  defaultValue = "",
  onStatusChange,
}: {
  tier: "gratis" | "bisnis";
  defaultValue?: string;
  /** Fires every time the normalized slug or availability status
   *  changes. Lets the parent gate "Next" buttons on availability
   *  without resorting to DOM polling. */
  onStatusChange?: (next: {
    normalized: string;
    available: boolean;
  }) => void;
}): React.JSX.Element {
  const [value, setValue] = React.useState(defaultValue);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const requestIdRef = React.useRef(0);
  // Celebration · increments every time the status transitions INTO
  // "ok" so the ConfettiBurst remounts with a fresh key and replays
  // its animation. Doesn't fire on subsequent re-renders where status
  // is still "ok" (e.g. same name re-validated).
  const [celebrationKey, setCelebrationKey] = React.useState(0);
  const prevStatusKindRef = React.useRef<Status["kind"]>("idle");
  React.useEffect(() => {
    if (status.kind === "ok" && prevStatusKindRef.current !== "ok") {
      setCelebrationKey((k) => k + 1);
    }
    prevStatusKindRef.current = status.kind;
  }, [status.kind]);

  React.useEffect(() => {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "checking" });
    const myId = ++requestIdRef.current;
    const handle = window.setTimeout(() => {
      fetch(
        `/api/nex-native/slug-availability?slug=${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      )
        .then((r) => r.json())
        .then((data) => {
          // Stale response guard · only commit if this is the latest
          // in-flight request. Avoids flicker when the user types fast.
          if (myId !== requestIdRef.current) return;
          if (data.ok === true) {
            setStatus({ kind: "ok", tier: data.tier ?? tier });
          } else {
            setStatus({
              kind: "err",
              reason: data.reason ?? "format",
              tier: data.tier ?? tier,
            });
          }
        })
        .catch(() => {
          if (myId !== requestIdRef.current) return;
          // Network error · fall back to a silent 'format' so the UI
          // doesn't block the user indefinitely. They can retry.
          setStatus({ kind: "err", reason: "format", tier });
        });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [value, tier]);

  const normalized = value.trim().toLowerCase();

  // Push status up to the parent · the wizard uses this to gate the
  // Next button on real availability instead of polling the hidden
  // input's DOM value.
  React.useEffect(() => {
    onStatusChange?.({
      normalized,
      available: status.kind === "ok",
    });
  }, [normalized, status.kind, onStatusChange]);

  const previewColor =
    status.kind === "ok"
      ? "#8FFF6E"
      : status.kind === "err"
        ? "#FF5A5A"
        : "rgba(220,230,245,0.5)";

  return (
    <div
      style={{
        // Sealed 2026-10-01 · ROOT height locked so no internal state
        // (idle / checking / ok / err / long-slug / wrapped-upgrade-
        // link) can push the SlugInput bigger. Previously the status
        // region was contained but the overall column still crept
        // when captions wrapped. 220 = input(50) + gap(8) + preview
        // (18) + gap(8) + status(112) + slack(24). overflow:hidden
        // guarantees it. Confetti is portaled to document.body so
        // the hidden overflow here never clips the celebration.
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: 220,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          minLength={1}
          maxLength={64}
          pattern="^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$"
          placeholder="e.g. maria-coffee"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "0 48px 0 14px",
            borderRadius: 12,
            background: "rgba(4,20,36,0.85)",
            border: `1px solid ${
              status.kind === "ok"
                ? "rgba(143,255,110,0.65)"
                : status.kind === "err"
                  ? "rgba(255,90,90,0.65)"
                  : "rgba(0,159,239,0.4)"
            }`,
            color: "#F4F7FC",
            fontSize: 15,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
            letterSpacing: "0.01em",
            outline: "none",
            boxShadow:
              status.kind === "ok"
                ? "0 0 14px rgba(143,255,110,0.25)"
                : "none",
            transition:
              "border-color 160ms ease, box-shadow 160ms ease",
          }}
        />
        {/* Hidden form field · the surrounding form posts this
            normalized value to createBusinessAction. The visible input
            is cosmetic / live-check only. */}
        <input type="hidden" name="slug" value={normalized} />
        {/* Status glyph on the right · tick / cross / spinner. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            width: 20,
            height: 20,
            display: "grid",
            placeItems: "center",
          }}
        >
          {status.kind === "checking" && (
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: "2px solid rgba(0,159,239,0.4)",
                borderTopColor: "#009FEF",
                animation: "nex-slug-spin 900ms linear infinite",
              }}
            />
          )}
          {status.kind === "ok" && (
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8FFF6E"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {status.kind === "err" && (
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FF5A5A"
              strokeWidth={3}
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </span>
        <style>{`
          @keyframes nex-slug-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Live .nex URL preview */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
          color: previewColor,
          letterSpacing: "0.02em",
          transition: "color 180ms ease",
          paddingLeft: 4,
        }}
      >
        <span style={{ opacity: normalized ? 1 : 0.4 }}>
          {normalized || "yourname"}
        </span>
        <span style={{ color: "rgba(220,230,245,0.6)" }}>.nex</span>
      </div>

      {/* Status region · FIXED 112px height · uses position: relative
          + absolute children so each status state occupies the same
          slot without affecting layout. Only ONE visible at a time.
          Sealed 2026-10-01 after multiple failed attempts with
          minHeight / height on static-flow content — only absolute
          positioning truly removes children from the parent sizing
          calculation. Removes any possibility of enlargement. */}
      <div
        style={{
          position: "relative",
          height: 112,
          overflow: "hidden",
        }}
      >
      {status.kind === "ok" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          {/* Two-line layout · "Congratulations" on top as the beat,
              the actual claimed name on its own line underneath so
              long slugs (tom456-shop, maria-coffee-company) never
              wrap awkwardly inline. Slug sits in monospace so it
              reads as an address, not a sentence fragment. */}
          <div
            style={{
              fontSize: 14,
              color: "#8FFF6E",
              lineHeight: 1.4,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            🎉 Congratulations
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 15,
              color: "#8FFF6E",
              lineHeight: 1.3,
              fontWeight: 800,
              letterSpacing: "0.01em",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
              wordBreak: "break-all",
            }}
          >
            {normalized}.nex
          </div>
          {tier === "gratis" && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "rgba(220,230,245,0.6)",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              <a
                href="/nex-native/settings/tier"
                style={{
                  color: "#FF7200",
                  fontStyle: "normal",
                  fontWeight: 700,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                Upgrade to a Business account
              </a>{" "}
              to unlock premium business names.
            </div>
          )}
        </div>
      )}
      {celebrationKey > 0 && (
        <ConfettiBurst key={celebrationKey} />
      )}
      {status.kind === "err" && status.reason === "too_short_for_tier" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "rgba(220,230,245,0.78)",
              lineHeight: 1.45,
              marginBottom: 8,
            }}
          >
            {reasonCopy(status.reason, status.tier)}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {suggestCompoundSlugs(normalized).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background:
                    "linear-gradient(180deg, rgba(0,159,239,0.22) 0%, rgba(0,159,239,0.1) 100%)",
                  border: "1px solid rgba(0,159,239,0.55)",
                  color: "#DCECFF",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
                  cursor: "pointer",
                  transition: "background 140ms ease, transform 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {s}.nex
              </button>
            ))}
          </div>
        </div>
      ) : status.kind === "err" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            fontSize: 12,
            color: "#FF9F9F",
            lineHeight: 1.45,
          }}
        >
          {reasonCopy(status.reason, status.tier)}
        </div>
      ) : null}
      {status.kind === "idle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            fontSize: 12,
            color: "rgba(220,230,245,0.55)",
            lineHeight: 1.45,
          }}
        >
          {tier === "gratis"
            ? "Pick a name you love · 7+ characters or compound (e.g. my-shop)."
            : "Pick any name 1-64 characters · Bisnis unlocks short premium names."}
        </div>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfettiBurst · lightweight CSS-only celebration overlay. Spawns 32
// coloured confetti pieces fixed to the viewport that fall + sway +
// rotate for ~3.5s then auto-unmount. No dependency on canvas-confetti
// or any external lib. Mounted once per slug-availability celebration
// via its `key` so React remounts a fresh instance each time.
// ---------------------------------------------------------------------------
function ConfettiBurst(): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), 3500);
    return () => window.clearTimeout(t);
  }, []);

  if (!mounted || !visible) return null;

  const colors = [
    "#009FEF", // NEX cyan
    "#8FFF6E", // Joker green
    "#FF7200", // NEX orange
    "#FF4D9F", // pink
    "#FFD54D", // warm yellow
    "#F4F7FC", // white
  ];
  // Sealed 2026-10-01 · 56 pieces · each piece ANCHORED to a known
  // horizontal column (i/N) so the burst guarantees full-width
  // coverage edge to edge · adds a small per-piece random jitter so
  // the columns don't look like a grid. Earlier purely-random
  // placement left visible gaps on narrower viewports.
  const COUNT = 56;
  const pieces = Array.from({ length: COUNT }).map((_, i) => {
    const r = (seed: number) => {
      const x = Math.sin(i * 999.9 + seed) * 10000;
      return x - Math.floor(x);
    };
    const column = (i / (COUNT - 1)) * 100;
    const jitter = (r(1) - 0.5) * (100 / COUNT);
    const left = Math.max(0, Math.min(100, column + jitter));
    const delay = r(2) * 600;
    const duration = 2400 + r(3) * 900;
    const size = 6 + Math.floor(r(4) * 8);
    const color = colors[Math.floor(r(5) * colors.length)];
    const sway = r(6) > 0.5 ? "nex-confetti-sway-a" : "nex-confetti-sway-b";
    const rotate = r(7) > 0.5 ? "nex-confetti-rot-cw" : "nex-confetti-rot-ccw";
    const isCircle = r(8) > 0.7;
    return {
      i,
      left,
      delay,
      duration,
      size,
      color,
      sway,
      rotate,
      isCircle,
    };
  });

  // Portal to document.body · guarantees the fixed-positioned confetti
  // escapes any ancestor containing block (sticky header, main's
  // backdrop filter, step shell transforms) and spans the FULL
  // viewport width + height.
  return createPortal(
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 9000,
      }}
    >
      <style>{`
        @keyframes nex-confetti-fall {
          0%   { transform: translateY(-10vh); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0.9; }
        }
        @keyframes nex-confetti-sway-a {
          0%   { margin-left: 0; }
          50%  { margin-left: 24px; }
          100% { margin-left: -14px; }
        }
        @keyframes nex-confetti-sway-b {
          0%   { margin-left: 0; }
          50%  { margin-left: -24px; }
          100% { margin-left: 14px; }
        }
        @keyframes nex-confetti-rot-cw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(540deg); }
        }
        @keyframes nex-confetti-rot-ccw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-540deg); }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.i}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            borderRadius: p.isCircle ? "50%" : 2,
            background: p.color,
            boxShadow: `0 0 6px ${p.color}55`,
            animation: `nex-confetti-fall ${p.duration}ms cubic-bezier(.3,.1,.3,1) ${p.delay}ms both, ${p.sway} ${p.duration}ms ease-in-out ${p.delay}ms both`,
          }}
        >
          <span
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              background: "inherit",
              borderRadius: "inherit",
              animation: `${p.rotate} ${p.duration}ms linear ${p.delay}ms both`,
            }}
          />
        </span>
      ))}
    </div>,
    document.body,
  );
}
