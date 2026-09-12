// NEX Keypad · Philip 2026-09-03 · REUSABLE INPUT COMPONENT
//
// Replaces the native OS keyboard when the NEX composer is focused. The
// NEX composer sets inputMode="none" so the OS keyboard never opens;
// this keypad is the ONLY text-entry surface. Owned architecturally at
// the shell level (NexAppShell renders <NexKeypad /> whenever the
// composer is focused), NOT inline in NexComposer.
//
// Features (Philip 2026-09-03 "activate the capital button on kepad
// and 123 numbers and symbols and all other kep pad features that is
// standard for chat window"):
//   ✅  3-row QWERTY letters mode
//   ✅  Shift · iOS-style auto-release · visual orange active state
//   ✅  ?123 → Numbers mode (1234567890 · -/:;()$&@" · .,?!' · #+=)
//   ✅  #+= → Symbols mode ([]{}#%^*+= · _\|~<>€£¥• · .,?!' · 123)
//   ✅  ABC returns to letters mode from Numbers or Symbols
//   ✅  Space · Enter · Backspace
//   ✅  Held-backspace · repeats after 400ms initial delay at 80ms interval
//   ✅  Focus-preservation (onMouseDown preventDefault) so tapping a key
//        does not blur the composer input and unmount the keypad
//   ✅  Edge-to-edge full-width bottom console (no border-radius/side border)
//   ✅  Slide-up + fade entrance animation
//
// Not built yet (deliberately deferred):
//   ❌  Emoji picker key (will live in the 8-tile insert panel)
//   ❌  Haptic feedback
//   ❌  Autocorrect / suggestions
//   ❌  Predictive text bar

"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Delete, CornerDownLeft, ArrowBigUp,
  Camera, FileText, ShoppingBag, Wrench, Zap,
  MessageSquare, Phone, Video,
} from "lucide-react";

type Props = {
  /** Fired when the user taps a letter / number / symbol / space key. */
  onKeyTap:    (char: string) => void;
  /** Fired when the user taps Backspace (or on each auto-repeat while held). */
  onBackspace: () => void;
  /** Fired when the user taps Enter · submit the composer. */
  onEnter:     () => void;
  /** INSERT mode · Philip 2026-09-03. When true, the alphabet keys are
   *  replaced by the 8-tile insert grid (Camera · File · Places · Brain ·
   *  Notes · Shop · Tools · Quick Actions). Only Shift + Backspace remain
   *  from the standard keypad chrome. Toggled by the ⋮⋮ button inside
   *  the composer's input pill (via shell state). */
  insertMode?: boolean;
  /** Fires when the user taps one of the 8 insert tiles · shell exits
   *  insertMode. */
  onInsertTileTap?: (tileKey: string) => void;
};

// 8-tile insert grid · Philip 2026-09-03. Moved here from NexComposer.
// When the keypad enters insertMode, these tiles replace the alphabet
// keys. Each tile is a visual stub today; real feature wiring per tile
// (Camera → device camera, File → file picker, Places → maps, etc.)
// lands in follow-up work.
// Tile lineup · Philip 2026-09-03:
//   · Brain  → Chats   (MessageSquare · NEX orange primary)
//   · Places → Video   (Video icon · cyan)
//   · Notes  → Call    (Phone · green)
// Row 1 (top) = communication + capture actions
// Row 2 (bottom) = files + commerce + tools + shortcuts
const INSERT_TILES: ReadonlyArray<{
  key: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
}> = [
  // Row 1
  { key: "chats",   label: "Chats",         Icon: MessageSquare, color: "#f97316" },
  { key: "call",    label: "Call",          Icon: Phone,         color: "#22c55e" },
  { key: "video",   label: "Video",         Icon: Video,         color: "#4AC9FF" },
  { key: "camera",  label: "Camera",        Icon: Camera,        color: "#a78bfa" },
  // Row 2
  { key: "file",    label: "File",          Icon: FileText,      color: "#3b82f6" },
  { key: "shop",    label: "Products",      Icon: ShoppingBag,   color: "#ec4899" },
  { key: "tools",   label: "Tools",         Icon: Wrench,        color: "#94a3b8" },
  { key: "actions", label: "Quick Actions", Icon: Zap,           color: "#eab308" },
];

type KeypadMode = "letters" | "numbers" | "symbols";

// LETTERS layout · classic 3-row QWERTY.
const LETTERS_R1 = ["q","w","e","r","t","y","u","i","o","p"] as const;
const LETTERS_R2 = ["a","s","d","f","g","h","j","k","l"]      as const;
const LETTERS_R3 = ["z","x","c","v","b","n","m"]              as const;

// NUMBERS mode · iOS-style: 1-0 on top, common punctuation below.
const NUMBERS_R1 = ["1","2","3","4","5","6","7","8","9","0"] as const;
const NUMBERS_R2 = ["-","/",":",";","(",")","$","&","@","\""] as const;
const NUMBERS_R3 = [".",",","?","!","'"]                       as const;

// SYMBOLS mode (from Numbers · via #+= key).
const SYMBOLS_R1 = ["[","]","{","}","#","%","^","*","+","="] as const;
const SYMBOLS_R2 = ["_","\\","|","~","<",">","€","£","¥","•"] as const;
const SYMBOLS_R3 = [".",",","?","!","'"]                       as const;

// Preventing focus steal on tap · the keypad button's mousedown default
// action is to move focus to itself, which would blur the composer input
// and (because keypad visibility is driven by input focus) unmount the
// keypad mid-tap. preventDefault on mousedown blocks the focus move
// while still allowing the click event to fire.
const preventFocusSteal = (e: React.MouseEvent) => e.preventDefault();

const KEY_BASE: React.CSSProperties = {
  appearance: "none",
  // Standard mobile keyboard key height · Philip 2026-09-03 "adjust
  // the kepad height to standard size". Was 40 → now 48px matches
  // iOS/Android standard key size. Combined with the row-gap bump
  // (6 → 8) the keypad totals ~232px which is in-line with native
  // iOS keyboard (~275-300 including predictive bar) minus the
  // predictive-text row we don't have yet.
  height: 48,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(30,30,30,0.9)",
  color: "rgba(245,245,245,0.95)",
  borderRadius: 7,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  transition: "background 100ms ease, transform 80ms ease, border-color 100ms ease",
  userSelect: "none",
  WebkitTapHighlightColor: "transparent",
};

function pressDown(el: HTMLElement) {
  el.style.transform = "scale(0.94)";
  el.style.background = "rgba(249,115,22,0.28)";
  el.style.borderColor = "rgba(249,115,22,0.55)";
}
function pressUp(el: HTMLElement) {
  el.style.transform = "scale(1)";
  el.style.background = "rgba(30,30,30,0.9)";
  el.style.borderColor = "rgba(255,255,255,0.10)";
}

function CharKey({ char, display, onTap }: { char: string; display?: string; onTap: (c: string) => void }) {
  return (
    <button
      type="button"
      aria-label={display ?? char}
      onMouseDown={preventFocusSteal}
      onClick={() => onTap(char)}
      style={{ ...KEY_BASE, flex: 1, minWidth: 0 }}
      onPointerDown={(e) => pressDown(e.currentTarget as HTMLElement)}
      onPointerUp={(e) => pressUp(e.currentTarget as HTMLElement)}
      onPointerLeave={(e) => pressUp(e.currentTarget as HTMLElement)}
      onPointerCancel={(e) => pressUp(e.currentTarget as HTMLElement)}
    >
      {display ?? char}
    </button>
  );
}

function SpecialKey({
  ariaLabel, onTap, children, flexBasis, active = false,
}: {
  ariaLabel: string;
  onTap?: () => void;
  children: React.ReactNode;
  /** If provided → fixed-width key (px). Omit → flex:1 for wide keys like SPACE. */
  flexBasis?: number;
  /** True when the key is in an "engaged" state (e.g. Shift held). Renders
   *  orange border + tint so the user sees the state at a glance. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseDown={preventFocusSteal}
      onClick={onTap}
      style={{
        ...KEY_BASE,
        flex: flexBasis !== undefined ? `0 0 ${flexBasis}px` : 1,
        minWidth: 0,
        ...(active ? {
          background: "rgba(249,115,22,0.24)",
          borderColor: "rgba(249,115,22,0.65)",
          color: "#f97316",
        } : {}),
      }}
      onPointerDown={(e) => pressDown(e.currentTarget as HTMLElement)}
      onPointerUp={(e) => {
        // Preserve the active-state visual after release · don't overwrite
        // the orange tint we set inline. pressUp() would reset to the
        // default dark. Skip the reset when active is true.
        if (!active) pressUp(e.currentTarget as HTMLElement);
      }}
      onPointerLeave={(e) => {
        if (!active) pressUp(e.currentTarget as HTMLElement);
      }}
      onPointerCancel={(e) => {
        if (!active) pressUp(e.currentTarget as HTMLElement);
      }}
    >
      {children}
    </button>
  );
}

/**
 * Backspace key · special-cased for HELD-repeat behavior · Philip
 * 2026-09-03 "all other kep pad features that is standard for chat
 * window". On tap → fire once. On press-and-hold → after 400ms initial
 * delay, fire every 80ms until release. Standard iOS/Android pattern.
 */
function BackspaceKey({ onBackspace }: { onBackspace: () => void }) {
  const delayRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (delayRef.current)  { clearTimeout(delayRef.current);  delayRef.current  = null; }
    if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; }
  }, []);

  const startPress = (el: HTMLElement) => {
    pressDown(el);
    onBackspace();
    delayRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => onBackspace(), 80);
    }, 400);
  };
  const endPress = (el: HTMLElement) => {
    pressUp(el);
    clearTimers();
  };

  return (
    <button
      type="button"
      aria-label="Backspace"
      onMouseDown={preventFocusSteal}
      style={{ ...KEY_BASE, flex: "0 0 52px", minWidth: 0 }}
      onPointerDown={(e) => startPress(e.currentTarget as HTMLElement)}
      onPointerUp={(e) => endPress(e.currentTarget as HTMLElement)}
      onPointerLeave={(e) => endPress(e.currentTarget as HTMLElement)}
      onPointerCancel={(e) => endPress(e.currentTarget as HTMLElement)}
    >
      <Delete size={16} strokeWidth={2} />
    </button>
  );
}

export function NexKeypad({ onKeyTap, onBackspace, onEnter, insertMode = false, onInsertTileTap }: Props) {
  // Mode · which key set is currently shown.
  //   letters → 3-row QWERTY (Shift-aware for uppercase)
  //   numbers → 1-0 / -/:;()$&@" / .,?!'  (with #+= to switch to symbols)
  //   symbols → []{}#%^*+= / _\|~<>€£¥• / .,?!'  (with 123 to return to numbers)
  const [mode, setMode] = useState<KeypadMode>("letters");

  // Shift · applies only in letters mode. iOS-style auto-release:
  // shift ON → next letter uppercase → shift OFF.
  // Tapping shift while ON toggles OFF without emitting a letter.
  const [shift, setShift] = useState(false);

  const emitLetter = (c: string) => {
    onKeyTap(shift ? c.toUpperCase() : c);
    if (shift) setShift(false);
  };

  // Non-letter chars (numbers, symbols, punctuation) do not respect shift.
  const emitChar = (c: string) => onKeyTap(c);

  // Switching between modes always clears any lingering shift.
  const switchTo = (target: KeypadMode) => { setMode(target); setShift(false); };

  const isLetters = mode === "letters";

  // Row 1/2/3 content per mode.
  const r1 = isLetters ? LETTERS_R1 : mode === "numbers" ? NUMBERS_R1 : SYMBOLS_R1;
  const r2 = isLetters ? LETTERS_R2 : mode === "numbers" ? NUMBERS_R2 : SYMBOLS_R2;
  const r3 = isLetters ? LETTERS_R3 : mode === "numbers" ? NUMBERS_R3 : SYMBOLS_R3;

  // Character display + emit dispatch per row.
  const displayLetter = (c: string) => (shift ? c.toUpperCase() : c);
  const renderCharKey = (c: string) => (
    isLetters
      ? <CharKey key={c} char={c} display={displayLetter(c)} onTap={emitLetter} />
      : <CharKey key={c} char={c} onTap={emitChar} />
  );

  // INSERT MODE render · Philip 2026-09-03. When insertMode is true,
  // the alphabet keys are replaced by the 8-tile grid (2 rows of 4
  // tiles). Only Shift + Backspace remain from the standard keypad
  // chrome (bottom row). Tapping a tile calls onInsertTileTap → shell
  // exits insertMode → keypad returns to letters.
  if (insertMode) {
    const topTiles = INSERT_TILES.slice(0, 4);
    const bottomTiles = INSERT_TILES.slice(4, 8);
    // Touchscreen-style tile · Philip 2026-09-03 "change the kepad 8
    // buttons to design like touch screen and use the same style for
    // buttons as the did you know frame color". Matches FactCard's
    // frosted-glass styling: dark blue-gray transparent bg + blur +
    // subtle white rim + outer dark shadow + inner top highlight +
    // rounded 18. Tactile press feedback (scale 0.96 + inner shadow
    // intensifies on pointer-down) for the touchscreen feel.
    const TileButton = (tile: typeof INSERT_TILES[number]) => {
      const TileIcon = tile.Icon;
      return (
        <button
          key={tile.key}
          type="button"
          aria-label={tile.label}
          onMouseDown={preventFocusSteal}
          onClick={() => onInsertTileTap?.(tile.key)}
          style={{
            flex: 1,
            minWidth: 0,
            appearance: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 6px",
            borderRadius: 18,
            background: "rgba(20, 20, 30, 0.55)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
            color: "rgba(245,245,245,0.92)",
            cursor: "pointer",
            minHeight: 64,
            transition: "transform 120ms ease, box-shadow 160ms ease, background 160ms ease",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
          onPointerDown={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "scale(0.96)";
            el.style.background = "rgba(30, 30, 40, 0.75)";
            el.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.45), inset 0 2px 4px rgba(0, 0, 0, 0.35)";
          }}
          onPointerUp={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "scale(1)";
            el.style.background = "rgba(20, 20, 30, 0.55)";
            el.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
          }}
          onPointerLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "scale(1)";
            el.style.background = "rgba(20, 20, 30, 0.55)";
            el.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
          }}
          onPointerCancel={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "scale(1)";
            el.style.background = "rgba(20, 20, 30, 0.55)";
            el.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
          }}
        >
          <TileIcon size={24} color={tile.color} strokeWidth={2} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(245,245,245,0.92)",
            letterSpacing: 0.15,
            lineHeight: 1.1,
            textAlign: "center",
          }}>
            {tile.label}
          </span>
        </button>
      );
    };
    return (
      <div
        role="group"
        aria-label="NEX keypad · insert mode"
        onMouseDown={(e) => e.preventDefault()}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8,
          background: "transparent",
          border: "none",
          animation: "nex-keypad-in 220ms cubic-bezier(0.34, 1.36, 0.64, 1) both",
        }}
      >
        {/* Row 1 · 4 tiles */}
        <div style={{ display: "flex", gap: 6 }}>{topTiles.map(TileButton)}</div>
        {/* Row 2 · 4 tiles */}
        <div style={{ display: "flex", gap: 6 }}>{bottomTiles.map(TileButton)}</div>
        {/* Row 3 · Shift (left) + Backspace (right) · alphabet is gone,
            only these 2 controls remain per Philip's spec. */}
        <div style={{ display: "flex", gap: 6 }}>
          <SpecialKey
            ariaLabel={shift ? "Shift active" : "Shift"}
            onTap={() => setShift((s) => !s)}
            flexBasis={52}
            active={shift}
          >
            <ArrowBigUp size={18} strokeWidth={2} />
          </SpecialKey>
          <div style={{ flex: 1 }} aria-hidden />
          <BackspaceKey onBackspace={onBackspace} />
        </div>

        <style>{`
          @keyframes nex-keypad-in {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="NEX keypad"
      // Prevent any tap inside the keypad from stealing focus from the
      // composer input (belt-and-braces on top of the per-key handler).
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        // Chrome (dark bg + blur + shadow + rounded top) is now provided
        // by the SHARED CONSOLE WRAPPER in NexAppShell · Philip 2026-09-03.
        // The keypad itself is a transparent container of keys · no bg,
        // no border, no shadow, no radius. Composer + keypad share ONE
        // continuous dark surface with input field visually inside the
        // rounded top rim.
        background: "transparent",
        border: "none",
        animation: "nex-keypad-in 220ms cubic-bezier(0.34, 1.36, 0.64, 1) both",
      }}
    >
      {/* Row 1 · letters mode = Q-P · numbers mode = 1-0 · symbols mode = []{}#%^*+= */}
      <div style={{ display: "flex", gap: 6 }}>
        {r1.map(renderCharKey)}
      </div>

      {/* Row 2 · letters mode = A-L (indented) · numbers/symbols = 10-char row (no indent) */}
      <div style={{ display: "flex", gap: 5, padding: isLetters ? "0 16px" : 0 }}>
        {r2.map(renderCharKey)}
      </div>

      {/* Row 3 · leading MODE-CHANGE key + row content + Backspace.
          letters: Shift + Z-M + Backspace
          numbers: #+= + .,?!' + Backspace
          symbols: 123 + .,?!' + Backspace */}
      <div style={{ display: "flex", gap: 6 }}>
        {isLetters ? (
          <SpecialKey
            ariaLabel={shift ? "Shift active" : "Shift"}
            onTap={() => setShift((s) => !s)}
            flexBasis={52}
            active={shift}
          >
            <ArrowBigUp size={18} strokeWidth={2} />
          </SpecialKey>
        ) : mode === "numbers" ? (
          <SpecialKey ariaLabel="Symbols mode" onTap={() => switchTo("symbols")} flexBasis={52}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>#+=</span>
          </SpecialKey>
        ) : (
          <SpecialKey ariaLabel="Numbers mode" onTap={() => switchTo("numbers")} flexBasis={52}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>123</span>
          </SpecialKey>
        )}
        {r3.map(renderCharKey)}
        <BackspaceKey onBackspace={onBackspace} />
      </div>

      {/* Row 4 · mode-toggle-to-numbers-or-back-to-letters + SPACE + Enter */}
      <div style={{ display: "flex", gap: 6 }}>
        {isLetters ? (
          <SpecialKey ariaLabel="Numbers mode" onTap={() => switchTo("numbers")} flexBasis={68}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>?123</span>
          </SpecialKey>
        ) : (
          <SpecialKey ariaLabel="Letters mode" onTap={() => switchTo("letters")} flexBasis={68}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>ABC</span>
          </SpecialKey>
        )}
        <SpecialKey ariaLabel="Space" onTap={() => onKeyTap(" ")}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2 }}>SPACE</span>
        </SpecialKey>
        <SpecialKey ariaLabel="Enter" onTap={onEnter} flexBasis={68}>
          <CornerDownLeft size={16} strokeWidth={2} />
        </SpecialKey>
      </div>

      <style>{`
        @keyframes nex-keypad-in {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
