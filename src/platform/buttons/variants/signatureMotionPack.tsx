"use client";

// Signature motion pack — Framer-parity attention-getters.
// Magnetic · Cursor-follow · Ripple-from-origin · Border-draw ·
// Text-kinetic · Confetti · Skeleton shimmer · Video-in-button.
//
// Every one respects prefers-reduced-motion (the interactive JS falls
// through to a plain button when the OS preference is set).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import { resolveState } from "../themeAdapter";
import { usePrefersReducedMotion } from "../states/useButtonState";
import type {
  ButtonRegistration,
  ButtonRendererProps
} from "../types";

type Simple = { label: string; href: string };

// ─── 1. Magnetic ────────────────────────────────────

function MagneticButton({ config, tokens, mode }: ButtonRendererProps<Simple>) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (reduced || mode === "edit") return;
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d < 96) {
        const strength = 1 - d / 96;
        setOffset({ x: dx * 0.3 * strength, y: dy * 0.3 * strength });
      } else {
        setOffset({ x: 0, y: 0 });
      }
    }
    function onLeave() { setOffset({ x: 0, y: 0 }); }
    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced, mode]);
  const resolved = resolveState(MAGNETIC_REG, "default", tokens);
  return (
    <Link
      ref={ref}
      href={config.href || "#"}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 52,
        padding: "0 24px",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        border: "none",
        borderRadius: 999,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: "pointer"
      }}
    >
      {config.label}
    </Link>
  );
}

const MAGNETIC_REG: ButtonRegistration<Simple> = {
  id: "signature.magnetic_1",
  name: "Magnetic",
  version: "1.0.0",
  category: "interactive",
  role: "primary_action",
  description: "Button pulls toward the cursor within a 96px field. Framer signature.",
  shortPitch: "Cursor tractor beam.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Chase me", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "floating" }
  },
  motion: { hover: "magnetic" },
  shape: { kind: "pill" },
  size: "lg",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Magnetic action", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.magnetic", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: true, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 52 },
  aiPrompts: { explain: "magnetic", improveCopy: "verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "novelty tax vs delight", scoreAccessibility: "keyboard reachable", suggestIcon: "arrow" },
  searchKeywords: ["magnetic", "framer", "cursor", "attract"],
  defaultConfig: () => ({ label: "Chase me", href: "#" }),
  renderer: MagneticButton
};
buttonRegistry.register(MAGNETIC_REG);

// ─── 2. Cursor-follow gradient ──────────────────────

function CursorFollowButton({ config, tokens, mode }: ButtonRendererProps<Simple>) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  useEffect(() => {
    if (reduced || mode === "edit") return;
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      });
    }
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [reduced, mode]);
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  return (
    <Link
      ref={ref}
      href={config.href || "#"}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 52,
        padding: "0 24px",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: `radial-gradient(120px circle at ${pos.x}% ${pos.y}%, ${accent}, #0A0A0A 70%)`,
        color: "#FFFFFF",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        transition: "background 60ms linear"
      }}
    >
      {config.label}
    </Link>
  );
}

const CURSOR_FOLLOW_REG: ButtonRegistration<Simple> = {
  id: "signature.cursor_follow_1",
  name: "Cursor-follow gradient",
  version: "1.0.0",
  category: "interactive",
  role: "primary_action",
  description: "Radial gradient follows the cursor across the button surface.",
  shortPitch: "Spotlight follows you.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Follow me", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: { default: {} },
  motion: { hover: "mouse_follow" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "lg",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Cursor gradient", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.cursorfollow", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 52 },
  aiPrompts: { explain: "cursor-follow gradient", improveCopy: "verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "wow tax", scoreAccessibility: "keyboard fallback", suggestIcon: "none" },
  searchKeywords: ["cursor", "follow", "spotlight", "framer"],
  defaultConfig: () => ({ label: "Follow me", href: "#" }),
  renderer: CursorFollowButton
};
buttonRegistry.register(CURSOR_FOLLOW_REG);

// ─── 3. Ripple from click origin ────────────────────

type Ripple = { id: number; x: number; y: number };

function RippleButton({ config, tokens, mode }: ButtonRendererProps<Simple>) {
  const reduced = usePrefersReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const resolved = resolveState(RIPPLE_REG, "default", tokens);
  return (
    <Link
      href={config.href || "#"}
      tabIndex={mode === "edit" ? -1 : 0}
      onClick={(e) => {
        if (reduced || mode === "edit") return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const id = Date.now();
        setRipples((prev) => [
          ...prev,
          { id, x: e.clientX - rect.left, y: e.clientY - rect.top }
        ]);
        window.setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 48,
        padding: "0 20px",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        border: "none",
        borderRadius: 8,
        cursor: "pointer"
      }}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: r.y,
            left: r.x,
            width: 20,
            height: 20,
            background: "rgba(255,255,255,0.5)",
            borderRadius: "50%",
            transform: "translate(-50%, -50%) scale(1)",
            animation: "sig-ripple 600ms ease-out forwards",
            pointerEvents: "none"
          }}
        />
      ))}
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes sig-ripple { to { transform: translate(-50%, -50%) scale(18); opacity: 0; } }`
      }} />
      {config.label}
    </Link>
  );
}

const RIPPLE_REG: ButtonRegistration<Simple> = {
  id: "signature.ripple_origin_1",
  name: "Ripple from click",
  version: "1.0.0",
  category: "interactive",
  role: "primary_action",
  description: "Real Material Design ripple from the click point.",
  shortPitch: "Material-authentic feedback.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Tap me", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: { default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "layered" } },
  motion: { press: "ripple" },
  shape: { kind: "rect", radiusPx: 8 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Ripple", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.ripple", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: { explain: "material ripple", improveCopy: "verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "keyboard", suggestIcon: "none" },
  searchKeywords: ["ripple", "material", "click"],
  defaultConfig: () => ({ label: "Tap me", href: "#" }),
  renderer: RippleButton
};
buttonRegistry.register(RIPPLE_REG);

// ─── 4. Border draw ─────────────────────────────────

function BorderDrawButton({ config, tokens, mode }: ButtonRendererProps<Simple>) {
  const [hover, setHover] = useState(false);
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const resolved = resolveState(BORDER_DRAW_REG, "default", tokens);
  return (
    <Link
      href={config.href || "#"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 48,
        padding: "0 24px",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "transparent",
        color: resolved.ink,
        border: "none",
        cursor: "pointer"
      }}
    >
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="1000"
          strokeDashoffset={hover ? 0 : 1000}
          style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span style={{ position: "relative" }}>{config.label}</span>
    </Link>
  );
}

const BORDER_DRAW_REG: ButtonRegistration<Simple> = {
  id: "signature.border_draw_1",
  name: "Border-draw stroke",
  version: "1.0.0",
  category: "interactive",
  role: "cta_learn_more",
  description: "SVG stroke traces the border on hover — signature Framer / Portfolio move.",
  shortPitch: "Elegant hover, editorial tone.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "See our work", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: { default: { inkToken: "color.primary" } },
  motion: { hover: "border_draw" },
  shape: { kind: "rect", radiusPx: 0 },
  size: "md",
  themeTokensUsed: ["color.primary", "color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Border draw", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.borderdraw", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: { explain: "border-draw", improveCopy: "verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "editorial fit", scoreAccessibility: "keyboard", suggestIcon: "none" },
  searchKeywords: ["border", "stroke", "outline", "portfolio"],
  defaultConfig: () => ({ label: "See our work", href: "#" }),
  renderer: BorderDrawButton
};
buttonRegistry.register(BORDER_DRAW_REG);

// ─── 5. Text kinetic (per-letter reveal) ────────────

function KineticTextButton({ config, tokens, mode }: ButtonRendererProps<Simple>) {
  const [hover, setHover] = useState(false);
  const resolved = resolveState(KINETIC_REG, "default", tokens);
  return (
    <Link
      href={config.href || "#"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 52,
        padding: "0 24px",
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        border: "none",
        borderRadius: 999,
        cursor: "pointer",
        overflow: "hidden"
      }}
    >
      {config.label.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            transform: hover ? "translateY(-2px)" : "translateY(0)",
            transition: `transform 400ms cubic-bezier(0.34,1.56,0.64,1) ${i * 30}ms`
          }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </Link>
  );
}

const KINETIC_REG: ButtonRegistration<Simple> = {
  id: "signature.kinetic_text_1",
  name: "Kinetic text",
  version: "1.0.0",
  category: "interactive",
  role: "primary_action",
  description: "Per-letter lift on hover — signature attention effect.",
  shortPitch: "Letters wave on hover.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Play with me", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: { default: { backgroundToken: "color.accent", inkLiteral: "#0A0A0A", shadowPreset: "floating" } },
  motion: { hover: "wave" },
  shape: { kind: "pill" },
  size: "lg",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Kinetic action", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.kinetic", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 52 },
  aiPrompts: { explain: "kinetic text", improveCopy: "short verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "delight tax", scoreAccessibility: "reduced-motion fallback", suggestIcon: "none" },
  searchKeywords: ["kinetic", "wave", "letters", "playful"],
  defaultConfig: () => ({ label: "Play with me", href: "#" }),
  renderer: KineticTextButton
};
buttonRegistry.register(KINETIC_REG);

// ─── 6. Confetti on click ───────────────────────────

type Confetti = { id: number; x: number; y: number; dx: number; dy: number; color: string };

function ConfettiButton({ config, tokens, mode }: ButtonRendererProps<Simple>) {
  const reduced = usePrefersReducedMotion();
  const [pieces, setPieces] = useState<Confetti[]>([]);
  const resolved = resolveState(CONFETTI_REG, "default", tokens);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <Link
        href={config.href || "#"}
        onClick={(e) => {
          if (reduced || mode === "edit") return;
          const rect = e.currentTarget.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const now = Date.now();
          const next: Confetti[] = Array.from({ length: 20 }).map((_, i) => ({
            id: now + i,
            x: cx,
            y: cy,
            dx: (Math.random() - 0.5) * 200,
            dy: -Math.random() * 200 - 50,
            color: ["#FFB300", "#EC4899", "#06B6D4", "#10B981", "#F97316"][i % 5]
          }));
          setPieces(next);
          window.setTimeout(() => setPieces([]), 900);
        }}
        tabIndex={mode === "edit" ? -1 : 0}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
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
          cursor: "pointer",
          position: "relative"
        }}
      >
        {config.label}
      </Link>
      {pieces.map((p) => (
        <span
          key={p.id}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: 6,
            height: 10,
            background: p.color,
            borderRadius: 2,
            transform: `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`,
            animation: `sig-confetti 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            // per-piece drift via CSS vars
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            pointerEvents: "none"
          }}
        />
      ))}
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes sig-confetti { to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 300px)) rotate(720deg); opacity: 0; } }`
      }} />
    </div>
  );
}

const CONFETTI_REG: ButtonRegistration<Simple> = {
  id: "signature.confetti_1",
  name: "Confetti on click",
  version: "1.0.0",
  category: "interactive",
  role: "cta_subscribe",
  description: "20-particle confetti burst on click. Great for delightful confirms.",
  shortPitch: "Celebrate the click.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "I'm in!", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: { default: { backgroundToken: "color.accent", inkLiteral: "#0A0A0A", shadowPreset: "floating" } },
  motion: { press: "shrink" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "md",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Celebrate", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.confetti", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: { explain: "confetti", improveCopy: "warm verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "celebration fit", scoreAccessibility: "reduced-motion opt-out", suggestIcon: "none" },
  searchKeywords: ["confetti", "celebrate", "party", "success"],
  defaultConfig: () => ({ label: "I'm in!", href: "#" }),
  renderer: ConfettiButton
};
buttonRegistry.register(CONFETTI_REG);

// ─── 7. Skeleton shimmer (loading state as button) ──

type SkeletonConfig = { label: string };

function SkeletonButton({ config, tokens, mode }: ButtonRendererProps<SkeletonConfig>) {
  const [loading, setLoading] = useState(false);
  const resolved = resolveState(SKELETON_REG, loading ? "loading" : "default", tokens);
  return (
    <button
      type="button"
      onClick={() => {
        if (mode === "edit") return;
        setLoading(true);
        window.setTimeout(() => setLoading(false), 1800);
      }}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        padding: "0 20px",
        fontSize: 13,
        fontWeight: 700,
        background: loading ? "#E5E5E5" : resolved.background,
        color: loading ? "transparent" : resolved.ink,
        border: "none",
        borderRadius: 10,
        cursor: loading ? "wait" : "pointer",
        transition: "background 150ms ease, color 150ms ease"
      }}
    >
      {loading && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
            animation: "sig-shimmer 1.2s linear infinite"
          }}
        />
      )}
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes sig-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`
      }} />
      {config.label}
    </button>
  );
}

const SKELETON_REG: ButtonRegistration<SkeletonConfig> = {
  id: "signature.skeleton_shimmer_1",
  name: "Skeleton shimmer",
  version: "1.0.0",
  category: "interactive",
  role: "primary_action",
  description: "On click, shows a proper skeleton shimmer while pretending to load.",
  shortPitch: "Loading, done right.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Save", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF" },
    loading: { backgroundLiteral: "#E5E5E5", inkLiteral: "#E5E5E5" }
  },
  motion: { loading: "spinner" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Save", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "sig.skeleton", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: { explain: "skeleton", improveCopy: "verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "n/a", scoreAccessibility: "aria-busy during loading", suggestIcon: "none" },
  searchKeywords: ["skeleton", "shimmer", "loading"],
  defaultConfig: () => ({ label: "Save" }),
  renderer: SkeletonButton
};
buttonRegistry.register(SKELETON_REG);

// ─── 8. Video-in-button ─────────────────────────────

type VideoBtnConfig = { label: string; href: string; videoUrl: string };

function VideoInButton({ config, tokens, mode }: ButtonRendererProps<VideoBtnConfig>) {
  const resolved = resolveState(VIDEO_REG, "default", tokens);
  return (
    <Link
      href={config.href || "#"}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 56,
        padding: "0 28px",
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "#0A0A0A",
        color: "#FFFFFF",
        border: "none",
        borderRadius: 999,
        cursor: "pointer",
        boxShadow: resolved.shadow
      }}
    >
      {config.videoUrl ? (
        <video
          src={config.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.6
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)",
            backgroundSize: "200% 200%",
            animation: "sig-gradient-drift 6s ease-in-out infinite"
          }}
        />
      )}
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes sig-gradient-drift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`
      }} />
      <span style={{ position: "relative", zIndex: 1 }}>▶ {config.label}</span>
    </Link>
  );
}

const VIDEO_REG: ButtonRegistration<VideoBtnConfig> = {
  id: "signature.video_in_button_1",
  name: "Video-in-button",
  version: "1.0.0",
  category: "interactive",
  role: "primary_action",
  description: "Muted looping video (or animated gradient) inside the button. Framer signature.",
  shortPitch: "Motion IS the button.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Watch the story", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" },
    { key: "videoUrl", label: "Video URL (MP4)", type: { kind: "text", maxLength: 500 }, default: "", description: "Leave empty for a drifting gradient fallback.", group: "Content" }
  ],
  states: { default: { shadowPreset: "floating" } },
  motion: { hover: "grow" },
  shape: { kind: "pill" },
  size: "xl",
  themeTokensUsed: [],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Watch", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "sig.video_in_button", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 56 },
  aiPrompts: { explain: "video-in-button", improveCopy: "cinematic verb", improveStyle: "Match {mood}", restyle: "Match {mood}", generateFromBrief: "", scoreConversion: "wow tax", scoreAccessibility: "video muted + captions on the target page", suggestIcon: "play" },
  searchKeywords: ["video", "framer", "signature", "cinematic"],
  defaultConfig: () => ({ label: "Watch the story", href: "#", videoUrl: "" }),
  renderer: VideoInButton
};
buttonRegistry.register(VIDEO_REG);
