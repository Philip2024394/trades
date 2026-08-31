// NEX Workspace · CHAT · SPATIAL CANVAS (Phase 1 · Philip 2026-08-28).
//
// The conversation is NOT a chat list. There are NO bubbles, cards,
// rounded-rects, or message containers. It is a spatial typographic canvas:
// each message is a text element with an assigned (x, y) coordinate that
// NEVER moves after it's placed.
//
// Rules (constitutional · Philip 2026-08-28 LOCKED):
//   · NEX text = LEFT · USER text = RIGHT (side locked to sender)
//   · UNIFIED chronological timeline · ONE cumulative Y advances for every msg
//     regardless of sender · matches WhatsApp/iMessage rhythm
//   · Every message is launchable (tap or auto) · no "anchor" concept
//   · On overflow (total visible > MAX_VISIBLE_TOTAL) OLDEST auto-launches
//     (1.1s animation · mirrored by side) and its slot frees up so remaining
//     messages shift up in the shared timeline
//
// Doctrine anchors:
//   project_nex_chat_bubble_locked_position_2026_08_28  (typographic style)
//   project_nex_frame_geometry_canonical_lock_2026_08_27 (workspace bounds)

"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { NexVoiceState } from "@/lib/nex-voice";
import {
  NEX_ANCHOR_POSITION,
  NEX_COLUMN_INSET_PCT,
  NEX_MESSAGE_VERTICAL_GAP_PX,
} from "@/components/nexapp/hud/geometry";
import { AmbientKnowledgeCard } from "@/components/nexapp/AmbientKnowledgeCard";

export interface ChatMessage {
  id:     string;
  sender: "user" | "nex";
  text:   string;
  time:   string;
  senderName?: string;
  avatarSrc?:  string;
  // Ambient Knowledge Injector · Philip 2026-08-28.
  // When kind='ambient', the message renders as a frosted glass card
  // (AmbientKnowledgeCard) instead of the standard typographic message.
  // Ambient cards fire during quiet chat moments · silence-only trigger.
  // See project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md.
  kind?: "normal" | "ambient";
  ambientVariant?: "did_you_know" | "they_say";
  // NEX FACT vs NEX KNOWLEDGE badge · Philip 2026-08-28 constitutional.
  // Every NEX-sourced message MUST carry a truth class · the badge renders
  // beside the timestamp so users see at-a-glance whether information is
  // verified fact or cultural/AI-generated knowledge. User-authored messages
  // omit this field (user's own words don't need self-labeling).
  truthClass?: "confirmed_fact" | "academic_reference"
             | "traditional_folk" | "spiritual_belief"
             | "unconfirmed" | "ai_generated";
  // Optional short source label shown when the badge is tapped · e.g.
  // "Wikipedia (CC BY-SA)" or "AI-translated by Qwen 2.5".
  truthSource?: string;
  // Legacy fields · kept for backward compat with previous shell payloads.
  mascotUrl?:              string;
  mascotName?:             string;
  mascotMeaning?:          string;
  mascotPersonalMessage?:  string;
}

// Maps DB truth_class values to the two constitutional badges.
// Philip 2026-08-28 · project_nex_fact_vs_knowledge_doctrine_2026_08_28.md
// UI update (Philip 2026-08-28 late): rendered as icon+word next to NEX name
// on the top-right of the message · no pill background · no uppercase.
export function classifyTruth(truthClass: ChatMessage["truthClass"]):
  | { kind: "fact"; label: string; color: string; symbol: string }
  | { kind: "knowledge"; label: string; color: string; symbol: string }
  | null {
  if (!truthClass) return null;
  if (truthClass === "confirmed_fact" || truthClass === "academic_reference") {
    return { kind: "fact", label: "Fact", color: "#22c55e", symbol: "✓" };
  }
  return { kind: "knowledge", label: "Knowledge", color: "#a855f7", symbol: "📚" };
}

interface Props {
  messages: ChatMessage[];
  nexState: NexVoiceState;
  onOrbTap?: () => void;
  error?:    string | null;
  /** Deprecated · kept for prop-shape compat with existing shell. */
  wideBubbles?: boolean;
  /** User display name · greeted at top-left and used as sender label. */
  userName?: string;
  /** Optional user profile image URL. */
  userAvatarSrc?: string;
  /** Deprecated · variant switching removed in Phase 1 rewrite. */
  variant?: string;
  /** Fires when a message begins its launch animation · direction the msg
   *  flew (NEX left → up-right, USER right → up-left). Parent can use this
   *  to make the voice orb's eye track the departing message. */
  onLaunchStart?: (direction: "up-right" | "up-left") => void;
  /** When true, chat expands into the freed hero + rail space (full-width
   *  cinematic mode · Philip 2026-08-28). Phase 2 fills geometry · Phase 1
   *  accepts the prop so the pipeline is ready. */
  fullWidth?: boolean;
}

const NEX_STATE_LABEL: Record<NexVoiceState, string> = {
  idle: "", listening: "Listening…", thinking: "NEX is thinking…",
  speaking: "NEX is speaking…", error: "Something went wrong",
};
const NEX_STATE_COLOR: Record<NexVoiceState, string> = {
  idle: "rgba(249,115,22,0.55)", listening: "#f97316", thinking: "#a855f7",
  speaking: "#22d3ee", error: "#f43f5e",
};

export function NexWorkspaceChat({
  messages, nexState, onOrbTap, error, userName, userAvatarSrc, onLaunchStart,
  fullWidth = false,
}: Props) {
  const firstName = userName?.trim().split(/\s+/)[0] || "";
  const greeting  = `Hi ${firstName || "there"}`;
  const userInitial = (firstName.charAt(0) || "?").toUpperCase();
  const isIdle = nexState === "idle";

  // Full-width mode timeline start · text moves UP 60px + spreads wider when
  // full-width active (Philip 2026-08-28 · "nex text moves up 60px and text
  // spread wider to give full width page position for chat"). Transitions via
  // CSS so the shift is animated when fullWidth flips.
  const timelineStartYCss = fullWidth
    ? `calc(${NEX_ANCHOR_POSITION.yCss} - 60px)`
    : NEX_ANCHOR_POSITION.yCss;

  // Launched-message tracking · every message (NEX or USER) is launchable via
  // tap OR auto-launch when the unified timeline exceeds MAX_VISIBLE_TOTAL.
  // Uses the approved 1.1s animation (mirrored by side · see /nex-anim-test).
  const [launchedIds, setLaunchedIds] = useState<Set<string>>(new Set());
  // Ref-tracked notification set · prevents onLaunchStart from firing twice
  // for the same message id and lets us call it OUTSIDE the setState updater
  // (calling parent setState from inside an updater = "setState during
  // render" error since React runs updaters during the render phase).
  const notifiedLaunchRef = useRef<Set<string>>(new Set());
  const launch = useCallback((id: string, sender: "user" | "nex") => {
    if (notifiedLaunchRef.current.has(id)) return;
    notifiedLaunchRef.current.add(id);
    setLaunchedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Fire parent callback OUTSIDE the updater · React batches this into a
    // separate render cycle. NEX (left) flies to top-RIGHT · USER (right)
    // flies to top-LEFT.
    onLaunchStart?.(sender === "nex" ? "up-right" : "up-left");
  }, [onLaunchStart]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Profile chip · Philip 2026-08-29 BATCH 1 · position:FIXED anchored
          to the bezel silhouette (NOT to the workspace zone). Previously
          the chip was `position: absolute` inside the workspace-zone root,
          which meant `chatFullWidth` shifting the workspace up 2% dragged
          the chip up with it (underneath the header · that was the bug).
          Now the chip is anchored to viewport-relative bezel coordinates,
          so drawer/rail/full-width state has ZERO authority over its Y.
          Match the previous visual idle position: workspace.top (8%) + 6px
          from bezel top-inside; workspace.left (11.80%) + 3px from left. */}
      <div
        style={{
          position: "fixed",
          top:  "calc(max(0px, (100dvh - min(100dvh, calc(100dvw * 1850 / 850))) / 2) + min(100dvh, calc(100dvw * 1850 / 850)) * 0.08 + 6px)",
          left: "calc(max(0px, (100dvw - min(100dvw, calc(100dvh * 850 / 1850))) / 2) + min(100dvw, calc(100dvh * 850 / 1850)) * 0.118 + 3px)",
          zIndex: 5,
          display: "flex", alignItems: "center", gap: 5,
          pointerEvents: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <button
          type="button"
          onClick={onOrbTap}
          aria-label={greeting}
          style={{
            appearance: "none", border: "1px solid rgba(255,255,255,0.20)",
            background: "#1a1a1a", width: 38, height: 38, minWidth: 38,
            borderRadius: "50%", cursor: "pointer", padding: 0,
            overflow: "hidden", display: "flex", alignItems: "center",
            justifyContent: "center", color: "rgba(245,245,245,0.85)",
            fontSize: 15, fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {userAvatarSrc
            ? <img src={userAvatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : userInitial}
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.3,
            color: "rgba(245,245,245,0.95)",
            whiteSpace: "nowrap",
          }}
        >
          {firstName || "there"}
        </span>
      </div>

      {/* Unified chronological stream · one Y timeline · side per sender. */}
      <MessageStream
        messages={messages}
        startYCss={timelineStartYCss}
        firstName={firstName}
        launchedIds={launchedIds}
        onLaunch={launch}
        fullWidth={fullWidth}
      />

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute", bottom: 4, left: 12, right: 12,
            padding: "6px 12px", fontSize: 11, color: "#fca5a5",
            background: "rgba(244,63,94,0.10)", borderRadius: 8,
            zIndex: 5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageStream · unified chronological timeline. ALL messages share ONE
// cumulative Y offset · side (LEFT/RIGHT) determined per-message by sender.
// Launched messages don't advance the cursor · remaining messages shift up.
// ─────────────────────────────────────────────────────────────────────────────

// Max visible (non-launched) messages in the unified timeline before the
// oldest auto-launches. Philip 2026-08-28 · 3 → 4 after anchor moved up
// 50px freed vertical room for one more visible message.
const MAX_VISIBLE_TOTAL = 4;

function MessageStream({
  messages, startYCss, firstName, launchedIds, onLaunch, fullWidth = false,
}: {
  messages: ChatMessage[];
  startYCss: string;
  firstName: string;
  launchedIds: Set<string>;
  onLaunch: (id: string, sender: "user" | "nex") => void;
  fullWidth?: boolean;
}) {
  // Keyed by message id (stable) · not ordinal. Rounded to whole pixels so
  // subpixel jitter from getBoundingClientRect doesn't cause update loops.
  const [heights, setHeights] = useState<Record<string, number>>({});

  const reportHeight = useCallback((id: string, h: number) => {
    const rounded = Math.round(h);
    setHeights((prev) => (prev[id] === rounded ? prev : { ...prev, [id]: rounded }));
  }, []);

  const FALLBACK_HEIGHT_PX = 40;
  const cumulativeYOffsets: number[] = [];
  let cumOffset = 0;
  for (let i = 0; i < messages.length; i++) {
    cumulativeYOffsets.push(cumOffset);
    if (!launchedIds.has(messages[i].id)) {
      const h = heights[messages[i].id] ?? FALLBACK_HEIGHT_PX;
      cumOffset += h + NEX_MESSAGE_VERTICAL_GAP_PX;
    }
  }

  // Auto-launch oldest when the unified timeline exceeds MAX_VISIBLE_TOTAL.
  // useLayoutEffect (not useEffect) so the launch fires on the SAME frame as
  // the new message is committed · user perceives the fly-off and the arrival
  // as one synchronous event · not "post → wait a frame → oldest starts flying"
  // (Philip 2026-08-28 · "the launch at same time as post arrives").
  const visibleCount = messages.reduce(
    (n, m) => (launchedIds.has(m.id) ? n : n + 1),
    0,
  );
  useLayoutEffect(() => {
    if (visibleCount > MAX_VISIBLE_TOTAL) {
      const oldest = messages.find((m) => !launchedIds.has(m.id));
      if (oldest) onLaunch(oldest.id, oldest.sender);
    }
  }, [visibleCount, messages, launchedIds, onLaunch]);

  return (
    <>
      {messages.map((m, idx) => {
        // Ambient Knowledge cards render as premium frosted glass instead of
        // the standard typographic text (Philip 2026-08-28). Intentional
        // exception to the "no bubbles" doctrine · see the ambient injector
        // doctrine memory file. Centered in workspace, spans a fixed max.
        if (m.kind === "ambient" && m.ambientVariant) {
          return (
            <AmbientTimelineElement
              key={m.id}
              messageId={m.id}
              variant={m.ambientVariant}
              body={m.text}
              time={m.time}
              sourceLabel={m.truthSource}
              absoluteY={`calc(${startYCss} + ${cumulativeYOffsets[idx]}px)`}
              onMeasuredHeight={reportHeight}
              launched={launchedIds.has(m.id)}
              onDismiss={() => onLaunch(m.id, "nex")}
            />
          );
        }
        return (
          <NexTextElement
            key={m.id}
            message={m}
            sender={m.sender}
            side={m.sender === "nex" ? "left" : "right"}
            absoluteY={`calc(${startYCss} + ${cumulativeYOffsets[idx]}px)`}
            firstName={firstName}
            messageId={m.id}
            onMeasuredHeight={reportHeight}
            launched={launchedIds.has(m.id)}
            onLaunch={() => onLaunch(m.id, m.sender)}
            fullWidth={fullWidth}
          />
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AmbientTimelineElement · positions an AmbientKnowledgeCard in the shared
// message timeline · centred horizontally · dismissable · fades out on launch.
// ─────────────────────────────────────────────────────────────────────────────

function AmbientTimelineElement({
  messageId, variant, body, time, sourceLabel,
  absoluteY, onMeasuredHeight, launched, onDismiss,
}: {
  messageId: string;
  variant: "did_you_know" | "they_say";
  body: string;
  time: string;
  sourceLabel?: string;
  absoluteY: string;
  onMeasuredHeight?: (id: string, height: number) => void;
  launched: boolean;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onMeasuredHeight) return;
    const measure = () => onMeasuredHeight(messageId, el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasuredHeight, messageId]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: absoluteY,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(84%, 440px)",
        zIndex: launched ? 999 : 3,
        pointerEvents: launched ? "none" : "auto",
        opacity: launched ? 0 : 1,
        transition: "opacity 400ms ease",
      }}
    >
      <AmbientKnowledgeCard
        variant={variant}
        body={body}
        time={time}
        sourceLabel={sourceLabel}
        onDismiss={onDismiss}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NexTextElement · a single typographic text at an absolute (x, y).
// Nothing more · no container styling, no bubble, no border. Just typography.
// ─────────────────────────────────────────────────────────────────────────────

function NexTextElement({
  message, sender, side, absoluteY, firstName, isAnchor,
  messageId, onMeasuredHeight, launched = false, onLaunch, fullWidth = false,
}: {
  message:  ChatMessage;
  sender:   "user" | "nex";
  side:     "left" | "right";
  absoluteY: string;
  firstName: string;
  isAnchor?: boolean;
  messageId?: string;
  onMeasuredHeight?: (id: string, h: number) => void;
  launched?: boolean;
  onLaunch?: () => void;
  /** Full-width mode · text wider (85% vs 60%), tighter column inset */
  fullWidth?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onMeasuredHeight || !messageId) return;
    const measure = () => onMeasuredHeight(messageId, el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasuredHeight, messageId]);

  // Freeze absoluteY at the moment of launch so the launching message stays
  // put mid-animation while its column recomputes offsets around it.
  const [frozenTop, setFrozenTop] = useState<string | null>(null);
  useEffect(() => {
    if (launched && frozenTop === null) setFrozenTop(absoluteY);
  }, [launched, absoluteY, frozenTop]);
  const effectiveTop = frozenTop ?? absoluteY;

  const displayName = message.senderName
    ?? (sender === "user" ? (firstName || "You") : "NEX");
  const isNex = sender === "nex";

  // X positioning · left/right column inset from workspace edge.
  // Full-width mode uses tighter inset (2% vs 4%) so text spreads wider.
  const insetPct = fullWidth ? 2 : NEX_COLUMN_INSET_PCT;
  const xStyle: React.CSSProperties = side === "left"
    ? { left:  `${insetPct}%` }
    : { right: `${insetPct}%` };

  const senderFirst = displayName.charAt(0).toUpperCase();
  const senderRest  = displayName.slice(1);

  // Both NEX and USER text can launch (tap + auto). Anchor never launches.
  // Philip 2026-08-28 · overflow policy: symmetric columns.
  const launchable = !isAnchor && !!onLaunch;

  return (
    <motion.div
      ref={ref}
      onClick={launchable && !launched ? onLaunch : undefined}
      // Launch animation · direction mirrors by column: LEFT → top-right ·
      // RIGHT → top-left. Both fly diagonally across the viewport, symmetric.
      // Philip 2026-08-28 · steepened angle: y -60vh → -140vh so trajectory
      // rises sharply instead of looking near-horizontal. Duration 2.0s.
      animate={
        launched
          ? side === "left"
            ? { x:  "120vw", y: "-140vh", rotate:  55, scale: 0.4, opacity: 0 }
            : { x: "-120vw", y: "-140vh", rotate: -55, scale: 0.4, opacity: 0 }
          : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
      }
      transition={{ duration: 2.0, ease: [0.4, 0.0, 0.2, 1] }}
      style={{
        position: "absolute",
        top: effectiveTop,
        ...xStyle,
        // Full-width mode gives text ~78% of container vs standard 60% ·
        // reads as spacious world-class chat when hero + rail are hidden.
        // 78% was 85% · reduced to prevent right-edge clipping (Philip 2026-08-28).
        maxWidth: fullWidth ? "78%" : "60%",
        padding: 0,
        textAlign: side === "left" ? "left" : "right",
        // Launching messages fly OVER the rail / frame chrome (Philip 2026-08-28 ·
        // side button was covering USER text mid-launch). 999 puts them on top
        // of everything · they fade to opacity 0 anyway.
        zIndex: launched ? 999 : (isAnchor ? 3 : 2),
        transformOrigin: side === "left" ? "top left" : "top right",
        cursor: launchable && !launched ? "pointer" : "default",
        // Smooth transition when full-width flips · text glides to new
        // position/inset/max-width in sync with the wider layout change.
        transition: "top 600ms cubic-bezier(0.4, 0, 0.2, 1), left 600ms cubic-bezier(0.4, 0, 0.2, 1), right 600ms cubic-bezier(0.4, 0, 0.2, 1), max-width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Sender label row · NEX name on left · optional Fact/Knowledge icon
          label on the right (Philip 2026-08-28 late update · replaces the
          bottom-left pill badge). Only appears on NEX-authored messages
          that carry a truthClass. User messages have no truth label. */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
          flexDirection: side === "left" ? "row" : "row-reverse",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.6,
            lineHeight: 1,
            color: "rgba(245,245,245,0.9)",
          }}
        >
          {isNex
            ? <>NE<span style={{ color: "#f97316" }}>X</span></>
            : <span style={{ color: "#f97316" }}>{senderFirst}{senderRest}</span>}
        </div>
        {/* Truth badge (Fact/Knowledge coloured chip) hidden 2026-08-29
            (Philip · "same NEX color always" · uniform NEX look).
            classifyTruth() + message.truthClass field preserved so this
            can be restored per-surface if doctrine review requires it. */}
      </div>
      {/* Body · typographic text · pre-wrap for line breaks. */}
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.4,
          color: "rgba(245,245,245,0.94)",
          fontWeight: 400,
          letterSpacing: 0.1,
          whiteSpace: "pre-wrap",
        }}
      >
        {message.text}
      </div>
      {/* Timestamp · muted · aligned to sender's edge · orange clock icon.
          The Fact/Knowledge icon now lives up in the sender-label row
          (top-right of message · Philip 2026-08-28 late update). */}
      <div
        style={{
          fontSize: 12,
          color: "rgba(245,245,245,0.42)",
          letterSpacing: 0.3,
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          gap: 6,
          justifyContent: side === "left" ? "flex-start" : "flex-end",
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#f97316" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{message.time}</span>
      </div>
    </motion.div>
  );
}
