"use client";

// Rich-state pack — buttons whose entire value IS the state transition.
// Copy, Bookmark, Follow, Rating, QR, Voice, Download progress,
// Countdown, Number counter.

import { useEffect, useRef, useState } from "react";
import { buttonRegistry } from "../buttonRegistry";
import { resolveState } from "../themeAdapter";
import { MotionScope } from "../motion/MotionScope";
import type {
  ButtonRegistration,
  ButtonRendererProps
} from "../types";

// ─── 1. Copy-to-clipboard ───────────────────────────

type CopyConfig = { label: string; value: string };

function CopyButton({ config, tokens, mode }: ButtonRendererProps<CopyConfig>) {
  const [copied, setCopied] = useState(false);
  const resolved = resolveState(COPY_REG, copied ? "success" : "default", tokens);
  return (
    <MotionScope motion={COPY_REG.motion} state={copied ? "success" : "default"}>
      {({ animation }) => (
        <button
          type="button"
          onClick={async () => {
            if (mode === "edit") return;
            try {
              await navigator.clipboard.writeText(config.value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch { /* ignore */ }
          }}
          tabIndex={mode === "edit" ? -1 : 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            background: resolved.background,
            color: resolved.ink,
            border: `1px solid ${resolved.border}`,
            borderRadius: 8,
            boxShadow: resolved.shadow,
            animation,
            cursor: "pointer"
          }}
        >
          {copied ? (
            <><span aria-hidden="true">✓</span> Copied</>
          ) : (
            <><span aria-hidden="true">📋</span> {config.label}</>
          )}
        </button>
      )}
    </MotionScope>
  );
}

const COPY_REG: ButtonRegistration<CopyConfig> = {
  id: "rich.copy_1",
  name: "Copy to clipboard",
  version: "1.0.0",
  category: "utility",
  role: "util_copy",
  description: "One-tap copy with success morph + auto-revert.",
  shortPitch: "Copy → ✓ Copied → back to Copy.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Copy link", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "value", label: "Value to copy", type: { kind: "text", maxLength: 500 }, default: "https://xratedtrade.com", group: "Content" }
  ],
  states: {
    default: { backgroundLiteral: "#FFFFFF", inkLiteral: "#0A0A0A", borderLiteral: "#D4D4D4", borderWidthPx: 1 },
    success: { backgroundLiteral: "#D1FAE5", inkLiteral: "#065F46", borderLiteral: "#10B981", borderWidthPx: 1 }
  },
  motion: { press: "shrink", success: "checkmark_morph" },
  shape: { kind: "rect", radiusPx: 8 },
  size: "sm",
  themeTokensUsed: [],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Copy", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "copy.click", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 32 },
  aiPrompts: { explain: "Copy button", improveCopy: "Copy X", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-live for success", suggestIcon: "clipboard" },
  searchKeywords: ["copy", "clipboard", "share"],
  defaultConfig: () => ({ label: "Copy link", value: "https://xratedtrade.com" }),
  renderer: CopyButton
};
buttonRegistry.register(COPY_REG);

// ─── 2. Bookmark toggle ─────────────────────────────

type BookmarkConfig = { label: string; defaultOn?: boolean };

function BookmarkButton({ config, tokens, mode }: ButtonRendererProps<BookmarkConfig>) {
  const [on, setOn] = useState(!!config.defaultOn);
  const resolved = resolveState(BOOKMARK_REG, "default", tokens);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={config.label}
      onClick={() => mode !== "edit" && setOn((v) => !v)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        background: "transparent",
        border: "none",
        color: on ? resolved.ink : "#737373",
        cursor: "pointer",
        transition: "color 150ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1)",
        transform: on ? "scale(1.1)" : "scale(1)"
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  );
}

const BOOKMARK_REG: ButtonRegistration<BookmarkConfig> = {
  id: "rich.bookmark_1",
  name: "Bookmark toggle",
  version: "1.0.0",
  category: "utility",
  role: "wishlist",
  description: "Empty ↔ filled with a pop.",
  shortPitch: "One-tap save.",
  editableFields: [
    { key: "label", label: "Accessible label", type: { kind: "text", maxLength: 40 }, default: "Save for later", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "defaultOn", label: "Default saved", type: { kind: "boolean" }, default: false, group: "Content" }
  ],
  states: {
    default: { inkToken: "color.accent" }
  },
  motion: { press: "spring" },
  shape: { kind: "circle" },
  size: "md",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Bookmark", role: "button", activateOnSpace: true, toggleFlag: "aria-pressed" },
  telemetry: { eventOnClick: "bookmark.toggle", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 3, minTapTargetPx: 44 },
  aiPrompts: { explain: "bookmark", improveCopy: "one verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-pressed", suggestIcon: "bookmark filled/outline" },
  searchKeywords: ["bookmark", "save", "wishlist"],
  defaultConfig: () => ({ label: "Save for later", defaultOn: false }),
  renderer: BookmarkButton
};
buttonRegistry.register(BOOKMARK_REG);

// ─── 3. Follow / Unfollow ───────────────────────────

type FollowConfig = { defaultFollowing?: boolean };

function FollowButton({ config, tokens, mode }: ButtonRendererProps<FollowConfig>) {
  const [following, setFollowing] = useState(!!config.defaultFollowing);
  const [hover, setHover] = useState(false);
  const resolved = resolveState(FOLLOW_REG, "default", tokens);
  const showUnfollow = following && hover;
  const label = following ? (showUnfollow ? "Unfollow" : "Following") : "Follow";
  return (
    <button
      type="button"
      onClick={() => mode !== "edit" && setFollowing((v) => !v)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 96,
        height: 36,
        padding: "0 14px",
        fontSize: 12,
        fontWeight: 700,
        background: !following
          ? resolved.ink
          : showUnfollow
            ? "#FEE2E2"
            : "#FFFFFF",
        color: !following
          ? "#FFFFFF"
          : showUnfollow
            ? "#DC2626"
            : "#0A0A0A",
        border: !following
          ? "none"
          : showUnfollow
            ? "1px solid #DC2626"
            : "1px solid #D4D4D4",
        borderRadius: 999,
        cursor: "pointer",
        transition: "background 150ms ease, color 150ms ease, border-color 150ms ease"
      }}
    >
      {label}
    </button>
  );
}

const FOLLOW_REG: ButtonRegistration<FollowConfig> = {
  id: "rich.follow_1",
  name: "Follow / Unfollow",
  version: "1.0.0",
  category: "utility",
  role: "primary_action",
  description: "Twitter-style three-state — Follow → Following → Unfollow on hover.",
  shortPitch: "Trust: hover reveals the destructive action.",
  editableFields: [
    { key: "defaultFollowing", label: "Default following", type: { kind: "boolean" }, default: false, group: "Content" }
  ],
  states: { default: { inkToken: "color.primary" } },
  motion: { press: "shrink" },
  shape: { kind: "pill" },
  size: "sm",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: () => "Follow", role: "button", activateOnSpace: true, toggleFlag: "aria-pressed" },
  telemetry: { eventOnClick: "follow.toggle", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 36 },
  aiPrompts: { explain: "follow pattern", improveCopy: "Follow / Following / Unfollow", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-pressed", suggestIcon: "none" },
  searchKeywords: ["follow", "unfollow", "subscribe"],
  defaultConfig: () => ({ defaultFollowing: false }),
  renderer: FollowButton
};
buttonRegistry.register(FOLLOW_REG);

// ─── 4. Star rating ─────────────────────────────────

type RatingConfig = { defaultRating?: number };

function RatingButton({ config, mode }: ButtonRendererProps<RatingConfig>) {
  const [rating, setRating] = useState(config.defaultRating ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <div role="group" aria-label="Star rating" style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= (hover || rating);
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} stars`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => mode !== "edit" && setRating(n)}
            tabIndex={mode === "edit" ? -1 : 0}
            style={{
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: active ? "#F59E0B" : "#D4D4D4",
              transition: "color 100ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)",
              transform: hover === n ? "scale(1.15)" : "scale(1)"
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

const RATING_REG: ButtonRegistration<RatingConfig> = {
  id: "rich.rating_1",
  name: "Star Rating",
  version: "1.0.0",
  category: "utility",
  role: "primary_action",
  description: "5-star tap-to-rate with hover preview.",
  shortPitch: "Feedback, one tap.",
  editableFields: [
    { key: "defaultRating", label: "Default rating (0-5)", type: { kind: "number", min: 0, max: 5, step: 1 }, default: 0, group: "Content" }
  ],
  states: { default: {} },
  motion: { press: "spring" },
  shape: { kind: "rect", radiusPx: 4 },
  size: "sm",
  themeTokensUsed: [],
  a11y: { ariaLabelFor: () => "Rate", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "rating.set", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 3, minTapTargetPx: 32 },
  aiPrompts: { explain: "star rating", improveCopy: "n/a", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-label per star", suggestIcon: "star" },
  searchKeywords: ["rating", "star", "review", "feedback"],
  defaultConfig: () => ({ defaultRating: 0 }),
  renderer: RatingButton
};
buttonRegistry.register(RATING_REG);

// ─── 5. Countdown ───────────────────────────────────

type CountdownConfig = { label: string; endsAtIso: string; expiredLabel: string };

function CountdownButton({ config, tokens, mode }: ButtonRendererProps<CountdownConfig>) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(config.endsAtIso));
  useEffect(() => {
    if (mode === "edit") return;
    const t = window.setInterval(() => setRemaining(remainingSeconds(config.endsAtIso)), 1000);
    return () => window.clearInterval(t);
  }, [config.endsAtIso, mode]);
  const expired = remaining <= 0;
  const resolved = resolveState(COUNTDOWN_REG, expired ? "disabled" : "default", tokens);
  return (
    <button
      type="button"
      disabled={expired}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 48,
        padding: "0 20px",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        border: "none",
        borderRadius: 10,
        boxShadow: resolved.shadow,
        opacity: resolved.opacity,
        cursor: expired ? "not-allowed" : "pointer"
      }}
    >
      {expired ? (
        <span>{config.expiredLabel}</span>
      ) : (
        <>
          <span>{config.label}</span>
          <span aria-live="polite" style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
            {formatCountdown(remaining)}
          </span>
        </>
      )}
    </button>
  );
}

function remainingSeconds(iso: string): number {
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}
function formatCountdown(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const COUNTDOWN_REG: ButtonRegistration<CountdownConfig> = {
  id: "rich.countdown_1",
  name: "Countdown CTA",
  version: "1.0.0",
  category: "marketing",
  role: "cta_buy",
  description: "Time-boxed offer with a live HH:MM:SS ticker.",
  shortPitch: "Urgency, honestly earned.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Grab this deal", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "endsAtIso", label: "Ends at (ISO)", type: { kind: "text", maxLength: 40 }, default: new Date(Date.now() + 3600_000 * 24).toISOString(), group: "Content" },
    { key: "expiredLabel", label: "Expired label", type: { kind: "text", maxLength: 32 }, default: "Offer ended", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.accent", inkLiteral: "#0A0A0A", shadowPreset: "hard" },
    disabled: { backgroundLiteral: "#F5F5F5", inkLiteral: "#737373", shadowPreset: "none" }
  },
  motion: { hover: "lift", press: "shrink" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "lg",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Countdown offer", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "countdown.click", payloadKeys: ["endsAtIso"] },
  conversionHints: { primaryActionRecommended: true, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 48 },
  aiPrompts: { explain: "countdown", improveCopy: "Time-boxed verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "urgency + honesty", scoreAccessibility: "aria-live polite", suggestIcon: "clock" },
  searchKeywords: ["countdown", "timer", "offer", "sale"],
  defaultConfig: () => ({ label: "Grab this deal", endsAtIso: new Date(Date.now() + 3600_000 * 24).toISOString(), expiredLabel: "Offer ended" }),
  renderer: CountdownButton
};
buttonRegistry.register(COUNTDOWN_REG);

// ─── 6. QR trigger ──────────────────────────────────

type QrConfig = { label: string; value: string };

function QrButton({ config, tokens, mode }: ButtonRendererProps<QrConfig>) {
  const [open, setOpen] = useState(false);
  const resolved = resolveState(QR_REG, "default", tokens);
  return (
    <>
      <button
        type="button"
        onClick={() => mode !== "edit" && setOpen(true)}
        tabIndex={mode === "edit" ? -1 : 0}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          background: resolved.background,
          color: resolved.ink,
          border: `1px solid ${resolved.border}`,
          borderRadius: 8,
          cursor: "pointer"
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><path d="M14 14h.01M20 14h.01M14 20h.01M20 20h.01M17 14v3M17 17h3M17 20v-3M20 17h-3"/>
        </svg>
        {config.label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              padding: 24,
              borderRadius: 16,
              textAlign: "center"
            }}
          >
            <div
              aria-label="QR code"
              style={{
                width: 180,
                height: 180,
                background:
                  "conic-gradient(from 0deg, #0A0A0A 0 25%, #FFFFFF 25% 50%, #0A0A0A 50% 75%, #FFFFFF 75% 100%)",
                backgroundSize: "18px 18px",
                margin: "0 auto"
              }}
            />
            <p style={{ marginTop: 12, fontSize: 12, fontFamily: "monospace" }}>
              {config.value}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 12,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                background: "#0A0A0A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const QR_REG: ButtonRegistration<QrConfig> = {
  id: "rich.qr_1",
  name: "QR trigger",
  version: "1.0.0",
  category: "utility",
  role: "util_share",
  description: "Opens a modal with a QR containing the value. Great for print → digital handoff.",
  shortPitch: "One tap, offline-to-online bridge.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Show QR", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "value", label: "Encoded value", type: { kind: "text", maxLength: 500 }, default: "https://xratedtrade.com", group: "Content" }
  ],
  states: {
    default: { backgroundLiteral: "#FFFFFF", inkLiteral: "#0A0A0A", borderLiteral: "#D4D4D4", borderWidthPx: 1 }
  },
  motion: { press: "shrink" },
  shape: { kind: "rect", radiusPx: 8 },
  size: "sm",
  themeTokensUsed: [],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Show QR", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "qr.open", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 32 },
  aiPrompts: { explain: "qr trigger", improveCopy: "Show QR / Scan me", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "dialog role", suggestIcon: "qr" },
  searchKeywords: ["qr", "scan", "share", "print"],
  defaultConfig: () => ({ label: "Show QR", value: "https://xratedtrade.com" }),
  renderer: QrButton
};
buttonRegistry.register(QR_REG);

// ─── 7. Number counter (view-triggered roll) ───────

type CounterConfig = { prefix: string; target: number; suffix: string };

function CounterButton({ config, tokens, mode }: ButtonRendererProps<CounterConfig>) {
  const [current, setCurrent] = useState(0);
  const raf = useRef<number | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (mode === "edit") { setCurrent(config.target); return; }
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    const dur = 1400;
    const from = 0;
    const to = config.target;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCurrent(Math.round(from + (to - from) * eased));
      if (p < 1) raf.current = window.requestAnimationFrame(step);
    };
    raf.current = window.requestAnimationFrame(step);
    return () => { if (raf.current) window.cancelAnimationFrame(raf.current); };
  }, [config.target, mode]);
  const resolved = resolveState(COUNTER_REG, "default", tokens);
  return (
    <button
      type="button"
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 800,
        background: resolved.background,
        color: resolved.ink,
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontVariantNumeric: "tabular-nums"
      }}
    >
      <span>{config.prefix}</span>
      <span>{current.toLocaleString()}</span>
      <span>{config.suffix}</span>
    </button>
  );
}

const COUNTER_REG: ButtonRegistration<CounterConfig> = {
  id: "rich.counter_1",
  name: "Number counter",
  version: "1.0.0",
  category: "utility",
  role: "primary_action",
  description: "Rolls from 0 to a target on view. Great for stats or social proof buttons.",
  shortPitch: "Rolling number, honest signal.",
  editableFields: [
    { key: "prefix", label: "Prefix", type: { kind: "text", maxLength: 8 }, default: "", group: "Content" },
    { key: "target", label: "Target number", type: { kind: "number", min: 0, max: 1_000_000, step: 1 }, default: 12_500, role: "stat_value", priority: "text", group: "Content" },
    { key: "suffix", label: "Suffix", type: { kind: "text", maxLength: 12 }, default: " customers", role: "stat_label", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF" }
  },
  motion: { entrance: "fade" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => `${c.prefix ?? ""}${c.target}${c.suffix ?? ""}`, role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "counter.click", payloadKeys: ["target"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: { explain: "counter", improveCopy: "prefix + target + suffix", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "honesty of number", scoreAccessibility: "aria-label with full text", suggestIcon: "none" },
  searchKeywords: ["counter", "stat", "number", "count-up"],
  defaultConfig: () => ({ prefix: "", target: 12_500, suffix: " customers" }),
  renderer: CounterButton
};
buttonRegistry.register(COUNTER_REG);

// ─── 8. Voice input (mic pulse) ─────────────────────

type VoiceConfig = { label: string };

function VoiceButton({ config, tokens, mode }: ButtonRendererProps<VoiceConfig>) {
  const [listening, setListening] = useState(false);
  const resolved = resolveState(VOICE_REG, "default", tokens);
  return (
    <button
      type="button"
      aria-pressed={listening}
      aria-label={config.label}
      onClick={() => mode !== "edit" && setListening((v) => !v)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        background: listening ? "#DC2626" : resolved.background,
        color: listening ? "#FFFFFF" : resolved.ink,
        border: "none",
        borderRadius: "50%",
        boxShadow: listening
          ? "0 0 0 8px rgba(220,38,38,0.2), 0 8px 24px rgba(220,38,38,0.3)"
          : resolved.shadow,
        cursor: "pointer",
        transition: "background 150ms ease, box-shadow 150ms ease"
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
      </svg>
    </button>
  );
}

const VOICE_REG: ButtonRegistration<VoiceConfig> = {
  id: "rich.voice_1",
  name: "Voice input",
  version: "1.0.0",
  category: "utility",
  role: "primary_action",
  description: "Mic button with pulsing halo when listening.",
  shortPitch: "Speak-to-fill for search + prompts.",
  editableFields: [
    { key: "label", label: "Accessible label", type: { kind: "text", maxLength: 40 }, default: "Voice search", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "floating" }
  },
  motion: { press: "shrink" },
  shape: { kind: "circle" },
  size: "lg",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Voice input", role: "button", activateOnSpace: true, toggleFlag: "aria-pressed" },
  telemetry: { eventOnClick: "voice.toggle", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 56 },
  aiPrompts: { explain: "voice input", improveCopy: "verb aria-label", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-pressed + label", suggestIcon: "microphone" },
  searchKeywords: ["voice", "mic", "microphone", "record"],
  defaultConfig: () => ({ label: "Voice search" }),
  renderer: VoiceButton
};
buttonRegistry.register(VOICE_REG);

// ─── 9. Download progress ──────────────────────────

type DownloadConfig = { label: string; href: string };

function DownloadButton({ config, tokens, mode }: ButtonRendererProps<DownloadConfig>) {
  const [progress, setProgress] = useState<number | null>(null);
  const resolved = resolveState(DOWNLOAD_REG, "default", tokens);
  function startDownload() {
    if (mode === "edit") return;
    setProgress(0);
    const t = window.setInterval(() => {
      setProgress((p) => {
        if (p === null) return 0;
        if (p >= 100) {
          window.clearInterval(t);
          window.setTimeout(() => setProgress(null), 1200);
          return 100;
        }
        return p + 8;
      });
    }, 120);
  }
  const busy = progress !== null && progress < 100;
  const done = progress === 100;
  return (
    <button
      type="button"
      onClick={startDownload}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 44,
        padding: "0 16px",
        fontSize: 13,
        fontWeight: 700,
        background: resolved.background,
        color: resolved.ink,
        border: "none",
        borderRadius: 10,
        boxShadow: resolved.shadow,
        cursor: busy ? "default" : "pointer"
      }}
    >
      {progress !== null && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${progress}%`,
            background: "rgba(255,255,255,0.35)",
            transition: "width 120ms linear"
          }}
        />
      )}
      <span style={{ position: "relative", display: "inline-flex", gap: 6, alignItems: "center" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {done ? "Done ✓" : busy ? `${progress}%` : config.label}
      </span>
    </button>
  );
}

const DOWNLOAD_REG: ButtonRegistration<DownloadConfig> = {
  id: "rich.download_1",
  name: "Download with progress",
  version: "1.0.0",
  category: "utility",
  role: "util_download",
  description: "Button fills with progress as the file downloads.",
  shortPitch: "Progress bar IS the button.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Download PDF", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "File URL", type: { kind: "link" }, default: "/download", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "soft" },
    loading: { opacity: 0.9 },
    success: { backgroundLiteral: "#10B981", inkLiteral: "#FFFFFF" }
  },
  motion: { press: "shrink", success: "checkmark_morph" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Download", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "download.start", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: { explain: "download with progress", improveCopy: "Download X + size hint", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-live on progress", suggestIcon: "download" },
  searchKeywords: ["download", "file", "pdf", "progress"],
  defaultConfig: () => ({ label: "Download PDF", href: "/download" }),
  renderer: DownloadButton
};
buttonRegistry.register(DOWNLOAD_REG);
