// NEX Composer · mode-toggle icon · separator · text field · send button.
// Sits in the HUD frame's BOTTOM zone over the bottom pill housing.
//
// Layout (Philip 2026-09-02 · quick-chips removed, field pushed to bottom):
//   [ + · mode toggle ] [ Ask NEX… input on solid black ] [ send · round ]
//
// The + button no longer owns any surface itself — it fires `onAddTap` and
// the shell flips its `chatMode` (CHAT ↔ CATEGORY ↔ CATEGORY_DETAIL). When
// the shell reports a non-chat mode via `modeActive`, the + rotates 45° to
// read as a close/back affordance. Voice remains on the orb.
//
// Doctrine anchors:
//   project_nex_workspace_identity_doctrine_2026_08_25
//   project_nex_workspace_terminology_addendum_2026_08_25
//     (composer is the persistent input · workspace hosts the transcript)

"use client";

import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NexVoiceState } from "@/lib/nex-voice";
import {
  Paperclip, Sparkles, CornerUpLeft, X as XIcon,
  Grid2x2, Camera, FileText, MapPin, Brain, StickyNote, ShoppingBag, Wrench, Zap,
  Send, File as FileIcon, ImagePlus, Link as LinkIcon,
} from "lucide-react";
import { useGuidanceTarget } from "./hud/NexGuidance";
import { TouchButton } from "./primitives/TouchButton";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  nexState: NexVoiceState;
  /** Fired on a short + tap. Parent flips chatMode. */
  onAddTap?: () => void;
  /** Fired on a 2-second HOLD of the +. Parent opens the recent-pages
   *  panel (Philip 2026-09-01). Regular tap is suppressed when this fires. */
  onAddLongPress?: () => void;
  /** When true, + rotates 45° and reads as a close/back affordance. */
  modeActive?: boolean;
  /** Reply Mode · when true, the input rim glows a restrained orange so
   *  the user can see at a glance that the next send is a reply. */
  replyMode?: boolean;
  /** SELECT → CONTEXT · Philip 2026-09-03. When set, the composer pill
   *  transforms upward to a two-row card: top row = "Replying to <name>"
   *  + preview + × dismiss; bottom row = the existing input row. When
   *  null, the composer is a single-row pill (default). Grow/collapse
   *  animation is 220ms. */
  replyContext?: {
    friendName: string;
    preview: string;
    onDismiss: () => void;
  } | null;
  /** Fires when the user taps the mascot glyph inside the input container
   *  · parent opens the mascot picker. Philip 2026-09-02. */
  onMascotTap?: () => void;
  /** Fires when the input gains focus · shell uses this to mount the
   *  NEX Keypad (Philip 2026-09-03 Slice A). */
  onInputFocus?: () => void;
  /** Fires when the input loses focus · shell uses this to unmount the
   *  NEX Keypad. */
  onInputBlur?:  () => void;
  /** Keypad INSERT mode · Philip 2026-09-03. When true, the ⋮⋮ trigger
   *  in the pill renders in its ACTIVE state. Owned by the shell so
   *  NexKeypad can subscribe to the same state and swap its content. */
  insertMode?: boolean;
  /** Fires when the ⋮⋮ trigger in the pill is tapped · shell toggles
   *  keypadInsertMode. */
  onInsertModeToggle?: () => void;
  /** Fires when the ✨ NEX button on the LEFT of the composer form is
   *  tapped · Philip 2026-09-03. Toggles NEX Assist mode (private):
   *  next send goes to NEX (not to the friend), NEX responds with a
   *  private container in the chat thread. */
  onNexSuggest?: () => void;
  /** NEX Assist mode active · when true, the ✨ button renders in its
   *  ACTIVE state and the placeholder becomes NEX's own prompt "How
   *  can I help?" (in her voice). */
  nexAssistMode?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const HOLD_MS = 2000;

// Rotating placeholder hints · Philip 2026-09-01.
// While the input is empty and the parent hasn't overridden the placeholder,
// the field cycles through these prompts every 2.6s so a fresh user sees
// examples of what NEX can do.
const PLACEHOLDER_ROTATION = [
  "Ask NEX",
  "Search Food",
  "Search Accommodation",
  "Search Rentals",
] as const;
const PLACEHOLDER_ROTATE_MS = 2600;

// Kept only for the send-button glow (voice states no longer drive the left
// button — that's now the + add-panel). Master colour scheme: cool white.
const SEND_TINT = {
  idleBorder: "rgba(255,255,255,0.14)",
  idleBg:     "rgba(255,255,255,0.05)",
  idleFg:     "rgba(245,245,245,0.4)",
  hotBorder:  "rgba(249,115,22,0.6)",
  hotBg:      "rgba(249,115,22,0.3)",
  hotFg:      "#fff",
} as const;
// INSERT_TILES moved to NexKeypad.tsx · Philip 2026-09-03. The 8-tile
// insert panel is no longer rendered as an overlay above the composer;
// instead the NEX Keypad transforms to show the tiles when the shell's
// keypadInsertMode is true (triggered by the ⋮⋮ button in the pill).

// ATTACH_TILES removed · Philip 2026-09-03. The attach button was
// replaced with the NEX Suggest button on the left of the composer.

// Retained for future signalling (thinking pulse etc.). Kept lint-friendly.
export type _NexComposerVoiceHint = NexVoiceState;

export const NexComposer = forwardRef<HTMLTextAreaElement, Props>(function NexComposer(
  {
    value,
    onChange,
    onSubmit,
    nexState: _nexState,
    onAddTap,
    onAddLongPress,
    modeActive = false,
    replyMode = false,
    replyContext = null,
    onMascotTap,
    onInputFocus,
    onInputBlur,
    insertMode = false,
    onInsertModeToggle,
    onNexSuggest,
    nexAssistMode = false,
    disabled = false,
    placeholder,
  },
  ref,
) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the textarea to fit content · Philip 2026-09-03 "text must
  // flow under top line when mas type not run off widow the user must be
  // able to see the text lines they are typeing". Set height:auto first
  // to allow shrink, then set to scrollHeight so it grows exactly to
  // fit the wrapped content.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  // + button uses TouchButton with onTap + onLongPress directly · Philip
  // 2026-09-02 · TouchButton owns the useLongPress hook internally. Short
  // tap → onAddTap (mode toggle). 2s hold → onAddLongPress (recent pages).

  // Attach panel REMOVED · Philip 2026-09-03. The orange File-icon
  // button on the left was replaced with a NEX Suggest button that
  // posts a NEX-suggested reply directly to the chat. Attach features
  // (Image/File/URL) can be re-added later via the 8-tile keypad
  // insert grid if needed.

  // Rotating placeholder · only when the input is empty AND no override
  // placeholder was passed by the parent. Stops immediately once the user
  // types anything (rotation restarts from index 0 next time it's idle).
  const [rotIdx, setRotIdx] = useState(0);
  useEffect(() => {
    if (placeholder) return;             // parent supplied a fixed hint
    if (value.length > 0) return;         // user is typing · freeze
    if (replyContext) return;             // reply target selected · freeze
    const t = setInterval(() => {
      setRotIdx((i) => (i + 1) % PLACEHOLDER_ROTATION.length);
    }, PLACEHOLDER_ROTATE_MS);
    return () => clearInterval(t);
  }, [placeholder, value.length, replyContext]);
  // NEX Assist mode overrides the placeholder with NEX's own voice.
  // Priority: nexAssistMode > parent placeholder > rotating hints.
  const effectivePlaceholder = nexAssistMode
    ? "How can I help?"
    : (placeholder ?? PLACEHOLDER_ROTATION[rotIdx]);
  useEffect(() => {
    if (typeof ref === "function") ref(inputRef.current);
    else if (ref) ref.current = inputRef.current;
  }, [ref]);
  const hasText = value.trim().length > 0;
  // Register composer parts as guidance targets so NEX can point at them.
  // "voice-button" id retained for compatibility with existing guidance script
  // targets · this slot is now the + mode-toggle.
  const attachAddButton     = useGuidanceTarget("voice-button");
  const attachComposerInput = useGuidanceTarget("composer-input");
  const attachSendButton    = useGuidanceTarget("send-button");

  return (
    <div
      style={{
        // Composer STACK · Philip 2026-09-02 · chips removed.
        //   [ fade region · gradient · pointer-events pass-through ]
        //   [ input row  · + | Ask NEX on solid black | send ]
        // Fills the (18%-tall) bottom zone from geometry.ts. Fade sits at
        // the top and dissolves the chat scrolling underneath — no border,
        // no visible top edge, no glass box.
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      {/* Fade extracted to NexHudFrame (z:15 · behind frame chassis) so
          the metallic footer bezel paints ON TOP of the gradient instead
          of the gradient overlaying the frame (Philip 2026-09-02). */}

      {/* 8-tile INSERTION PANEL · Philip 2026-09-03 reference-matched.
          Appears above the composer form as a rounded orange-bordered
          card with a 2×4 grid of colored action tiles. Toggled by the
          2×2 grid trigger button in the form below. Mock only · each
          tile just closes the panel today. Panel sits ABOVE the form
          (flex-end column with panel BEFORE form so it stacks on top). */}
      {/* Attach panel REMOVED · Philip 2026-09-03. The trigger button
          was replaced with the NEX Suggest button. Attach features
          (Image/File/URL) can be re-added via the 8-tile insert grid
          in the keypad if needed. */}

      {/* 8-tile insert panel REMOVED from the composer · Philip 2026-09-03.
          The panel is now rendered by NexKeypad when the shell's
          keypadInsertMode is true (the alphabet keys disappear and
          the 8 tiles take their place · only Shift + Backspace remain).
          The ⋮⋮ trigger in the pill fires onInsertModeToggle to flip
          the shell state. */}

    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "0 8px",
        // Text field pushed 20px lower in the composer stack · sits below
        // the composer zone's nominal bottom into the 3.2% buffer above
        // the frame's decorative bottom (Philip 2026-09-02 · "lower down
        // the text field for footer 20px").
        marginBottom: -16,
        pointerEvents: "auto",
        zIndex: 1,
      }}
    >
      {/* NEX SUGGEST · LEFT side of the composer form · Philip 2026-09-03
          "the button on the left side of the kepad text imput field
          change to nex button when user will select the nex button she
          will post in the chat window - hi alex good to catch up . how
          can i help example". Orange NEX-branded button (Sparkles icon)
          · tap fires onNexSuggest → shell constructs a NEX-suggested
          reply and posts it directly to the current friend chat.
          Bypasses the composer input state entirely · the suggestion
          appears in the chat as a user message. */}
      <TouchButton
        ref={attachAddButton as (el: HTMLButtonElement | null) => void}
        aria-label={nexAssistMode ? "Exit NEX assist" : "Ask NEX (private)"}
        aria-expanded={nexAssistMode}
        onTap={onNexSuggest}
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        enforceMinTouchTarget
        style={{
          appearance: "none",
          flexShrink: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          // 30% larger · Philip 2026-09-03. 32px → 42px.
          width: 42, height: 42, minWidth: 42,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // Active-state glow uses the NEX orange · matches the "NEX
          // Assist mode is engaged" signal used elsewhere in the app.
          boxShadow: nexAssistMode
            ? "0 0 16px rgba(249,115,22,0.65)"
            : "0 0 8px rgba(249,115,22,0.28)",
          transition: "box-shadow 200ms ease, transform 120ms ease",
        }}
      >
        {/* NEX brand button · Philip 2026-09-03. Custom PNG with black
            metallic bezel + "NEX" wordmark (NE white · X orange). Full
            asset provided by Philip · lives at /nex-app/nex-button.png. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nex-app/nex-button.png"
          alt="NEX"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </TouchButton>

      {/* 2×2 grid trigger lives INSIDE the input pill (see below).
          Send button lives INSIDE the input pill on the right (see below). */}

      {/* Text-field CONTAINER · Philip 2026-09-02 · solid-black pill with
          input on the left and paperclip attach icon on the right. Black
          background gives the input a clean surface distinct from the
          fading chat behind it.

          SELECT → CONTEXT · Philip 2026-09-03 approval #1 (Option A).
          When replyContext is set, the pill physically transforms upward
          into a two-row card:
            [ ↩ Replying to <name>              ×  ]  ← context strip
            [ preview text, single-line ellipsis    ]
            [───────────────────────────────────────]  ← subtle divider
            [ ✦  │  cursor              📎        ]  ← existing input row
          borderRadius softens from 999 to 14, and the outer flex flips
          from row to column so the existing input content (wrapped in
          its own inner row div) sits below the context strip. */}
      <div
        style={{
          // Reply Mode paints the input rim DARK GREEN (matches user
          // identity color) to signal "your reply is being composed"
          // even before the user types (Philip 2026-09-02 · "composer
          // input should have a subtle green rim when hero has a reply
          // target"). Non-reply mode = quiet, no border.
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: replyContext ? "column" : "row",
          alignItems: replyContext ? "stretch" : "center",
          gap: 0,
          // Reduced vertical padding · Philip 2026-09-03 "make height of
          // text imput field smaller in height little keep back ground
          // same size". Pill height trims by ~4px · shared dark wrapper
          // above/around remains the same size.
          padding: replyContext ? 0 : "2px 8px",
          // borderRadius 20 (was 999) · Philip 2026-09-03. The pill is
          // now a multi-line textarea that grows vertically as the user
          // types — a fully-round pill only reads correctly at fixed
          // single-line height. 20px keeps a rounded, friendly feel at
          // any height. Reply mode keeps 14px for the tighter card look.
          borderRadius: replyContext ? 14 : 20,
          // Input pill · Philip 2026-09-03 "fix the text field bubble
          // on the kepad" · Option A. Restored the pill's visible
          // presence: matches the keypad key styling (same dark tint +
          // white-alpha rim) so the input reads as a stretched-out key
          // at the top of the keypad console. Reply mode overrides
          // with the green identity treatment.
          border: replyMode
            ? "1px solid rgba(5,150,105,0.55)"
            : "1px solid rgba(255,255,255,0.10)",
          background: replyMode
            ? "rgba(5,150,105,0.06)"
            : "rgba(30,30,30,0.9)",
          boxShadow: replyMode ? "0 0 10px rgba(5,150,105,0.22)" : "none",
          transition: "border-color 220ms ease, box-shadow 220ms ease, background 220ms ease, border-radius 220ms ease, padding 220ms ease",
          overflow: "hidden",
        }}
      >
        {/* CONTEXT strip DISABLED · Philip 2026-09-03 "REMOVE THE ALEX
            TEXT FROM TEXT IMPUT FIELD ONLY YOU TEXT WILL APEAR". The
            entire "Replying to Alex / quoted-message preview / cancel"
            strip is short-circuited so nothing from Alex ever renders
            inside the composer pill. That context now lives ONLY in
            the hero card at the top of the chat (which is reverted to
            always visible). Full JSX kept below for a future re-enable
            if needed · currently unreachable. */}
        {false && replyContext && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "6px 10px 6px 10px",
              animation: "nex-composer-context-in 220ms ease both",
            }}
          >
            <CornerUpLeft
              size={12}
              strokeWidth={2.4}
              color="#f97316"
              style={{ flexShrink: 0, marginTop: 2 }}
              aria-hidden
            />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{
                fontSize: 10.5,
                color: "rgba(245,245,245,0.9)",
                fontWeight: 600,
                letterSpacing: 0.15,
                lineHeight: 1.2,
              }}>
                {/* "Replying to <name>" REMOVED · Philip 2026-09-03 "REMOVE THE ALEX TEXT FROM TEXT IMPUT FIELD ONLY YOU TEXT WILL APEAR". */}
              </div>
              <div style={{
                fontSize: 11,
                color: "rgba(245,245,245,0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontStyle: "italic",
                lineHeight: 1.25,
              }}>
                {replyContext.preview ? `"${replyContext.preview}"` : " "}
              </div>
            </div>
            <TouchButton
              aria-label="Cancel reply"
              onTap={replyContext.onDismiss}
              enforceMinTouchTarget
              style={{
                appearance: "none",
                flexShrink: 0,
                border: "none",
                background: "transparent",
                color: "rgba(245,245,245,0.55)",
                cursor: "pointer",
                padding: 0,
                width: 20, height: 20,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
              }}
            >
              <XIcon size={12} strokeWidth={2.4} />
            </TouchButton>
          </div>
        )}

        {/* Divider DISABLED · Philip 2026-09-03. The context strip
            above it is short-circuited, so the divider has nothing
            to separate. */}
        {false && replyContext && (
          <div
            aria-hidden
            style={{
              height: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "0 10px",
            }}
          />
        )}

        {/* INPUT ROW · always rendered · wrapped in its own container so
            the outer container can switch cleanly between row (single-pill)
            and column (context card) layouts. In non-reply mode the outer
            container's padding provides spacing; in reply mode this row
            takes its own padding so the two rows have consistent gutters. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: replyContext ? "5px 8px" : 0,
            flex: replyContext ? "0 0 auto" : "1 1 auto",
            minWidth: 0,
          }}
        >
          {/* 2×2 grid INSERT-PANEL trigger · lives INSIDE the pill on
              the left of the input · Philip 2026-09-03. Small circular
              orange-tinted button when active. Toggling opens the
              8-tile panel above the composer. */}
          <TouchButton
            aria-label={insertMode ? "Return to letters" : "Open insert tiles"}
            aria-expanded={insertMode}
            onTap={onInsertModeToggle}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            enforceMinTouchTarget
            style={{
              // Button chrome REMOVED · Philip 2026-09-03 "remove the
              // button and just show icon enlarge icon size and blue
              // color". Bare icon only · no border/background/shadow
              // · larger (20px) · blue color.
              appearance: "none",
              flexShrink: 0,
              border: "none",
              background: "transparent",
              color: "#4AC9FF",
              cursor: "pointer",
              padding: 0,
              width: 24, height: 24, minWidth: 24,
              borderRadius: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 160ms ease, opacity 160ms ease",
              opacity: insertMode ? 1 : 0.9,
            }}
          >
            <Grid2x2 size={20} strokeWidth={2.2} />
          </TouchButton>

          {/* Text input · Philip 2026-09-03. Changed from single-line
              <input> to <textarea> so the text WRAPS to a new line
              when it hits the right edge instead of scrolling off ·
              "text must flow under top line when mas type not run off
              widow the user must be able to see the text lines they
              are typeing". Auto-grow via useLayoutEffect on value.
              inputMode="none" still suppresses OS keyboard · the NEX
              Keypad remains the only text entry surface. */}
          <textarea
            ref={(el) => {
              inputRef.current = el;
              attachComposerInput(el as unknown as HTMLElement | null);
            }}
            // NEX owns the input surface · inputMode="none" prevents
            // the OS keyboard from opening. The NEX Keypad is the ONLY
            // text-entry surface.
            inputMode="none"
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => onInputFocus?.()}
            onBlur={() => onInputBlur?.()}
            disabled={disabled}
            placeholder={effectivePlaceholder}
            aria-label="Message NEX"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "rgba(245,245,245,0.95)",
              padding: "2px 2px",
              fontSize: 13,
              // lineHeight sets each wrapped line's height · users can
              // see stacked lines cleanly.
              lineHeight: 1.4,
              outline: "none",
              resize: "none",
              // Wrap long words / URLs so text never runs off the right
              // edge · flows to the next line instead.
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              // Hide the scrollbar · height auto-grows via useLayoutEffect
              // so the textarea always fits its content without scrolling.
              overflow: "hidden",
              fontFamily: "inherit",
            }}
          />

          {/* Orange SEND button · Philip 2026-09-03 "orange send button
              on the right side". 32×32 circle · NEX orange · white
              paper-plane icon · dimmed when the input has no text. On
              tap, submits the composer (same handler as Enter on the
              NEX Keypad). */}
          <button
            type="submit"
            aria-label="Send"
            disabled={disabled || !hasText}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              appearance: "none",
              flexShrink: 0,
              width: 32,
              height: 32,
              minWidth: 32,
              border: "none",
              borderRadius: "50%",
              background: hasText ? "#f97316" : "rgba(249,115,22,0.30)",
              color: hasText ? "#0a0a0a" : "rgba(10,10,10,0.55)",
              cursor: hasText ? "pointer" : "default",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 160ms ease, color 160ms ease",
            }}
          >
            <Send size={14} strokeWidth={2.2} />
          </button>

        </div>
      </div>

      {/* Local keyframes · CONTEXT strip entrance + INSERT PANEL entrance
          · Philip 2026-09-03. */}
      <style>{`
        @keyframes nex-composer-context-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes nex-insert-panel-in {
          from { opacity: 0; transform: translateY(6px)  scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      {/* Category surface owned by the shell (NexCategoryMode) · rendered
          as a full-surface overlay inside .nex-console-viewport when the
          shell's chatMode !== "chat". The composer no longer portals its
          own panel · the + mode-toggle (on the LEFT of the form above)
          fires onAddTap and the shell decides which surface to show. */}
    </form>
    </div>
  );
});
