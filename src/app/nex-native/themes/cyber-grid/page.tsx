"use client";

// src/app/nex-native/themes/cyber-grid/page.tsx
//
// Cyber Grid theme · terminal layout preview.
// -------------------------------------------------------------------
// Founder-set 2026-09-29 · nex_chat_theme.id = 'cyber-grid' ·
// tier=gratis · category=standard · layout_style='terminal'.
//
// Terminal-log chat aesthetic:
//   · monospace font throughout
//   · every line: `> <name> [HH:MM]: <body>`
//   · names colour-coded per participant (Maria = emerald, Philip =
//     amber) so a line-scan reads like an IRC/terminal transcript
//   · dim-grey session banner at the top
//   · solid green block cursor at the composing prompt
//   · deep emerald-black background with the theme5 circuit
//     wallpaper at low opacity providing the HUD atmosphere
//
// This preview is self-contained (no PortraitBloomShell dependency)
// so it matches the "theme5text" reference exactly. The peer-chat
// runtime rendering of layout_style='terminal' is a separate wiring
// step in the shell · this preview is the sealed visual spec.

import * as React from "react";
import { UniversalChromeOverlay } from "../../chat-standard/_universal-chrome-overlay";
import { UniversalComposerFooter } from "../../chat-standard/_universal-composer-footer";
import { UniversalHeaderIconsOverlay } from "../../chat-standard/_universal-header-icons-overlay";

const PALETTE = {
  bg: "#050b09",            // near-black with a green undertone
  panelDim: "rgba(94,120,102,0.9)", // dim banner text
  bannerRule: "rgba(60,90,72,0.55)", // separator under banner
  mariaName: "#5FED8B",     // emerald — incoming speaker
  philipName: "#FF9142",    // amber — outgoing (you)
  timestamp: "#5F7A67",     // dim grey-green
  chevron: "#3E9F63",       // slightly softer green for the > prompt
  body: "#E7ECE4",          // cream-white message body
  cursor: "#4CFF7A",        // bright green composing block
  glow: "rgba(76,255,122,0.16)",
};

const MONO =
  "'Cascadia Mono', 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

const WALLPAPER =
  "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/cyber-grid-1790688636327.png";

// Same peer portrait used by the Theme 1 preview so the two themes
// share a consistent "maria" identity across the preview library.
const MARIA_PORTRAIT =
  "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png";

interface LogLine {
  speaker: "maria" | "philip";
  time: string;
  body: string;
  /** Rendered with the emoji at the end so we get the same visual
   *  cadence as the theme5text reference. */
  trailingEmoji?: string;
}

interface ShopItem {
  id: string;
  name: string;
  priceLabel: string;
  stock: "in_stock" | "low_stock" | "sold_out";
  imageUrl: string | null;
}

// Terminal-styled shop-slider items · matches the Bridge 93/94
// fixture so a founder can eyeball the theme against real product
// shapes without needing live data.
const SHOP_ITEMS: ShopItem[] = [
  { id: "hammerpro-16oz", name: "HammerPro 16oz", priceLabel: "Rp 185.000", stock: "in_stock", imageUrl: null },
  { id: "trade-belt-pro", name: "Trade Belt Pro", priceLabel: "Rp 425.000", stock: "low_stock", imageUrl: null },
  { id: "scaffold-station-v2", name: "Scaffold Station V2", priceLabel: "Rp 675.000", stock: "sold_out", imageUrl: null },
  { id: "safety-harness-lite", name: "Safety Harness Lite", priceLabel: "Rp 295.000", stock: "in_stock", imageUrl: null },
];

// Sealed conversation — matches the reference image (theme5text.png)
// so the preview is a 1:1 spec of the intended visual.
const CONVO: LogLine[] = [
  { speaker: "maria", time: "18:04", body: "Sunset tonight is unreal — running by the pier?" },
  { speaker: "philip", time: "18:06", body: "On my way. Grab you a coffee?" },
  { speaker: "maria", time: "18:07", body: "Yes please. Oat + cinnamon", trailingEmoji: "🤎" },
  { speaker: "philip", time: "18:08", body: "Locked. See you in 10." },
];

export default function CyberGridPreviewPage(): React.JSX.Element {
  const [draft, setDraft] = React.useState<string>("");
  const [flash, setFlash] = React.useState<boolean>(false);
  const [shopOpen, setShopOpen] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus the composer on mount so a visitor can immediately start
  // typing — matches shell UX where the prompt is always focused.
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!draft.trim()) return;
    // Preview-only · flash the `[↵]` glyph briefly and clear the
    // draft. Real send is wired later when the terminal renderer
    // lands in the peer-chat runtime shell.
    setFlash(true);
    setDraft("");
    setTimeout(() => setFlash(false), 260);
  };

  return (
    <>
      <style>{`
        html, body { background: ${PALETTE.bg} !important; margin: 0; }
        [data-nex-terminal-root] * { box-sizing: border-box; }
        [data-nex-terminal-scroll]::-webkit-scrollbar { width: 6px; }
        [data-nex-terminal-scroll]::-webkit-scrollbar-thumb {
          background: rgba(76,255,122,0.22); border-radius: 3px;
        }
        /* Ping ring animation · same shape as Theme 1's portrait
           ping (t1-portrait-ping) but tinted to the Cyber Grid
           emerald so it reads as "online" in the terminal palette.
           Two rings offset by 0.9s so the ping feels continuous. */
        @keyframes cg-portrait-ping {
          0%   { transform: scale(1);    opacity: 0.60; }
          80%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        [data-nex-terminal-root] [data-cg-ping] {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid ${PALETTE.cursor};
          animation: cg-portrait-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        [data-nex-terminal-root] [data-cg-ping-2] { animation-delay: 0.9s; }

        /* Block cursor for the terminal composer · flashes at the
           end of the typed text with a soft green glow. Matches the
           reference (theme5text) cursor rather than the browser's
           default thin line caret. */
        @keyframes cg-cursor-blink {
          0%, 45%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        [data-nex-terminal-root] [data-cg-cursor] {
          display: inline-block;
          width: 10px;
          height: 16px;
          vertical-align: text-bottom;
          margin-left: 1px;
          background: ${PALETTE.cursor};
          box-shadow: 0 0 10px ${PALETTE.glow};
          animation: cg-cursor-blink 1.05s steps(1, end) infinite;
        }
      `}</style>

      <main
        data-nex-terminal-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.body,
          fontFamily: MONO,
          fontSize: 14,
          lineHeight: 1.55,
          overflow: "hidden",
          // Bottom pad reserves space for the fixed composer so the
          // last log row isn't hidden underneath it.
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 68px)",
        }}
      >
        {/* Standard NEX chat header · same structure as Theme 1 +
            Pink Dream · avatar (52px) · name + subtitle · right
            cluster [Home · Cart · Shop]. Tinted with the Cyber Grid
            emerald accent so it reads as part of the theme without
            breaking the shared nav pattern. */}
        <header
          style={{
            position: "relative",
            zIndex: 5,
            padding: "calc(env(safe-area-inset-top, 0) + 8px) 14px 8px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background:
              "linear-gradient(180deg, rgba(5,15,10,0.85) 0%, rgba(5,15,10,0.55) 60%, transparent 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: `1px solid rgba(76,255,122,0.18)`,
          }}
        >
          {/* Peer avatar · maria portrait behind a green rim ·
              paired with a pulsing "online" ping (two rings offset
              0.9s apart, matching the Theme 1 pattern but tinted
              emerald for Cyber Grid). Ping only renders when the
              peer is online · here it's on because the fixture peer
              is live. */}
          <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
            <span aria-hidden data-cg-ping />
            <span aria-hidden data-cg-ping data-cg-ping-2 />
            <div
              aria-hidden
              style={{
                position: "relative",
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: `url(${MARIA_PORTRAIT}) center/cover`,
                border: `2px solid ${PALETTE.cursor}`,
                boxShadow: `0 0 12px ${PALETTE.glow}, inset 0 0 6px rgba(0,0,0,0.35)`,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: PALETTE.body,
                lineHeight: 1.15,
                fontFamily: MONO,
              }}
            >
              maria
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: PALETTE.mariaName,
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: `0 0 6px ${PALETTE.glow}`,
              }}
            >
              photographer
            </div>
          </div>
          {/* Standard right-cluster · Home · Cart · Shop · tinted to
              the emerald accent so the icons read as green outlines
              consistent with the terminal palette.
              R11b (sealed 2026-10-05) · tagged `data-nex-native-r1-cluster`
              so the UniversalHeaderIconsOverlay suppresses this native
              cluster · the overlay owns R1. Cyber-grid's shop-open
              behaviour is preserved via onShopClick on the overlay. */}
          <div
            data-nex-native-r1-cluster
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <a href="/nex-native/home" aria-label="Home" style={emeraldIcon()}>
              <HomeGlyph />
            </a>
            <a href="/cart" aria-label="Cart" style={emeraldIcon()}>
              <CartGlyph />
            </a>
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              aria-label="Open shop"
              style={{ ...emeraldIcon(), cursor: "pointer" }}
            >
              <ShopGlyph />
            </button>
          </div>
        </header>

        {/* Circuit wallpaper · deliberately low opacity so the log
            stays legible. Fixed to viewport so scrolling the log
            doesn't drag the background with it. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage: `url(${WALLPAPER})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.42,
            filter: "saturate(1.1) contrast(1.05)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        {/* Green scanline vignette · adds the CRT feel without
            hurting legibility. */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(80% 60% at 50% 40%, transparent 0%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "16px 20px 24px" }}>
          {/* Session banner · dim grey · matches reference top strip. */}
          <div
            style={{
              color: PALETTE.panelDim,
              fontSize: 12,
              letterSpacing: "0.04em",
              paddingBottom: 10,
              borderBottom: `1px dashed ${PALETTE.bannerRule}`,
              marginBottom: 14,
              textShadow: `0 0 8px ${PALETTE.glow}`,
            }}
          >
            nex-chat v3 · maria ↔ philip · secure
          </div>

          {/* Terminal log · every line renders as
              `> <name> [HH:MM]: <body>` with per-participant colour. */}
          <div
            data-nex-terminal-scroll
            style={{
              display: "grid",
              gap: 8,
              maxHeight: "70dvh",
              overflowY: "auto",
              paddingRight: 6,
            }}
          >
            {CONVO.map((line, i) => (
              <LogRow key={i} line={line} />
            ))}
          </div>

        </div>

        {/* Native terminal composer retired 2026-10-05 ·
            UniversalComposerFooter at the end of the page is the sealed
            "one default footer across every live theme" ·
            cyber-grid's inline <form> composer no longer rendered. */}
        {false && (<form
          onSubmit={handleSubmit}
          onClick={() => inputRef.current?.focus()}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 6,
            padding: "10px 20px calc(env(safe-area-inset-bottom, 0) + 12px)",
            background:
              "linear-gradient(0deg, rgba(5,15,10,0.94) 0%, rgba(5,15,10,0.85) 60%, rgba(5,15,10,0.55) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderTop: `1px dashed ${PALETTE.bannerRule}`,
            cursor: "text",
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              type="button"
              aria-label="Attach"
              style={composerIconStyle()}
              onClick={(e) => { e.stopPropagation(); inputRef.current?.focus(); }}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Emoji"
              style={composerIconStyle()}
              onClick={(e) => { e.stopPropagation(); inputRef.current?.focus(); }}
            >
              😀
            </button>

            {/* Visible display line with block cursor · plus hidden
                input for keystrokes. Wrapping the mirror lets the
                cursor sit exactly after the draft text at any length.
                No `> philip:` prefix · that identity is already
                clear from the header and would clutter the input. */}
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: PALETTE.body,
                  fontFamily: MONO,
                  fontSize: 14,
                  lineHeight: 1.55,
                  whiteSpace: "pre",
                  overflow: "hidden",
                  textOverflow: "clip",
                  maxWidth: "100%",
                }}
              >
                {draft}
              </span>
              <span aria-hidden data-cg-cursor />
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Type a message"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  // Text invisible · the mirror span above renders
                  // the visible draft. Keeps native focus + selection
                  // + IME behaviour while showing a block cursor.
                  color: "transparent",
                  caretColor: "transparent",
                  fontFamily: MONO,
                  fontSize: 14,
                  lineHeight: 1.55,
                  padding: 0,
                }}
              />
            </div>

            <button
              type="submit"
              aria-label="Send"
              disabled={draft.trim().length === 0}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 4,
                cursor: draft.trim().length > 0 ? "pointer" : "default",
                background: "transparent",
                // Green as soon as there is text to send · matches
                // "send button turns green when user types" spec.
                color:
                  flash || draft.trim().length > 0
                    ? PALETTE.cursor
                    : PALETTE.panelDim,
                border: `1px solid ${
                  flash || draft.trim().length > 0
                    ? PALETTE.cursor
                    : "rgba(94,120,102,0.4)"
                }`,
                textShadow:
                  flash || draft.trim().length > 0
                    ? `0 0 8px ${PALETTE.glow}`
                    : "none",
                transition:
                  "color 180ms, border-color 180ms, text-shadow 180ms",
              }}
            >
              [↵]
            </button>
          </div>
        </form>)}

        {/* Shop modal · triggered by the header shop icon · matches
            the Pink Dream doctrine (chat-native shop = slider that
            opens over the chat surface). Bottom-sheet on mobile,
            floating panel on desktop. Terminal aesthetic — ASCII
            frame + emerald ShopCards inside a horizontal strip. */}
        {shopOpen && (
          <ShopModal items={SHOP_ITEMS} onClose={() => setShopOpen(false)} />
        )}
      </main>
      <UniversalHeaderIconsOverlay
        accent={PALETTE.mariaName}
        onShopClick={() => setShopOpen((v) => !v)}
        shopOpen={shopOpen}
      />
      <UniversalChromeOverlay accent={PALETTE.mariaName} deep={PALETTE.bg} />
      <UniversalComposerFooter accent={PALETTE.mariaName} deep={PALETTE.bg} themeId="cyber-grid" />
    </>
  );
}

// ─── Header icons + helper ───────────────────────────────────────────
// Green outline SVGs matching the standard right-cluster shape used
// by Theme 1 / Pink Dream, but tinted to the Cyber Grid emerald so
// they belong to the terminal palette.

// ─── Shop modal · triggered by the header shop icon ──────────────────

function ShopModal({
  items,
  onClose,
}: {
  items: ShopItem[];
  onClose: () => void;
}): React.JSX.Element {
  // Trap Escape to close · matches keyboard expectation for modals.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(3,8,6,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "82dvh",
          overflowY: "auto",
          overflowX: "hidden",
          background: PALETTE.bg,
          borderTop: `1px dashed ${PALETTE.cursor}`,
          borderLeft: `1px dashed rgba(76,255,122,0.4)`,
          borderRight: `1px dashed rgba(76,255,122,0.4)`,
          borderRadius: "10px 10px 0 0",
          boxShadow: `0 -12px 40px rgba(0,0,0,0.65), 0 0 24px ${PALETTE.glow}`,
          padding: "14px 18px calc(env(safe-area-inset-bottom, 0) + 18px)",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            paddingBottom: 8,
            borderBottom: `1px dashed ${PALETTE.bannerRule}`,
          }}
        >
          <div style={{ color: PALETTE.panelDim, fontSize: 12, letterSpacing: "0.04em" }}>
            <span style={{ color: PALETTE.chevron, fontWeight: 700 }}>&gt; </span>
            <span style={{ color: PALETTE.mariaName, fontWeight: 600 }}>shop</span>
            <span> · maria's live items ({items.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shop"
            style={{
              padding: "3px 10px",
              fontSize: 12,
              color: PALETTE.emerald,
              background: "transparent",
              border: `1px dashed rgba(76,255,122,0.42)`,
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: MONO,
            }}
          >
            [x close]
          </button>
        </div>
        <ShopStrip items={items} />
      </div>
    </div>
  );
}

// ─── Shop strip · terminal-styled ────────────────────────────────────

function ShopStrip({ items }: { items: ShopItem[] }): React.JSX.Element {
  // Grid layout matching the Pink Dream shop slider — cards flow
  // top-to-bottom in a responsive 2/3-column grid instead of a
  // side-scrolling strip. Cards keep the terminal aesthetic
  // (dashed emerald frame · ASCII image tile · config-line body).
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 10,
        paddingBottom: 4,
      }}
    >
      {items.map((it) => (
        <ShopCard key={it.id} item={it} />
      ))}
    </div>
  );
}

function ShopCard({ item }: { item: ShopItem }): React.JSX.Element {
  const soldOut = item.stock === "sold_out";
  const stockLabel =
    item.stock === "sold_out"
      ? "sold_out"
      : item.stock === "low_stock"
        ? "low_stock"
        : "in_stock";
  const stockColor =
    item.stock === "sold_out"
      ? "#FF7373"
      : item.stock === "low_stock"
        ? PALETTE.philipName
        : PALETTE.mariaName;
  return (
    <a
      href={`/nex-native/themes/cyber-grid/product?id=${encodeURIComponent(item.id)}`}
      style={{
        scrollSnapAlign: "start",
        display: "grid",
        gridTemplateRows: "84px auto auto auto",
        gap: 6,
        padding: 10,
        borderRadius: 8,
        border: `1px dashed rgba(76,255,122,0.42)`,
        background: "rgba(6,18,12,0.55)",
        boxShadow: "0 0 12px rgba(0,0,0,0.4)",
        textDecoration: "none",
        color: PALETTE.body,
        fontFamily: MONO,
        fontSize: 12,
        opacity: soldOut ? 0.72 : 1,
      }}
    >
      {/* Image tile · dashed frame + ASCII corner marks so it belongs
          to the terminal palette even when we don't have a real
          product photo yet. */}
      <div
        style={{
          position: "relative",
          background: `rgba(76,255,122,0.06)`,
          border: `1px solid rgba(76,255,122,0.28)`,
          backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 4,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {!item.imageUrl && (
          <span
            aria-hidden
            style={{
              color: PALETTE.chevron,
              fontFamily: MONO,
              fontSize: 22,
              letterSpacing: "0.05em",
              textShadow: `0 0 6px ${PALETTE.glow}`,
            }}
          >
            [ img ]
          </span>
        )}
      </div>
      <div style={{ color: PALETTE.body, fontWeight: 600, lineHeight: 1.25 }}>
        {item.name}
      </div>
      <div style={{ color: PALETTE.mariaName, fontWeight: 700 }}>
        {item.priceLabel}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: stockColor, fontSize: 11 }}>
          {stockLabel}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 3,
            color: soldOut ? PALETTE.panelDim : PALETTE.cursor,
            border: `1px solid ${soldOut ? "rgba(94,120,102,0.4)" : PALETTE.cursor}`,
            textShadow: soldOut ? "none" : `0 0 6px ${PALETTE.glow}`,
          }}
        >
          {soldOut ? "[--]" : "[+ add]"}
        </span>
      </div>
    </a>
  );
}

function composerIconStyle(): React.CSSProperties {
  // Terminal-flavoured icon slot for the composer's + / 😀 buttons.
  // Deliberately minimal so the composer still reads as a shell
  // prompt rather than a WhatsApp-shape input.
  return {
    width: 24,
    height: 24,
    borderRadius: 6,
    display: "grid",
    placeItems: "center",
    color: PALETTE.mariaName,
    background: "transparent",
    border: `1px dashed rgba(76,255,122,0.3)`,
    cursor: "pointer",
    fontFamily: MONO,
    fontSize: 13,
    padding: 0,
  };
}

function emeraldIcon(): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: PALETTE.mariaName,
    background: "rgba(76,255,122,0.06)",
    border: `1px solid rgba(76,255,122,0.32)`,
    textDecoration: "none",
    boxShadow: `0 0 8px rgba(76,255,122,0.08)`,
  };
}

function HomeGlyph(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11L12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartGlyph(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h2l2 11h11l2-8H7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="20" r="1.3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ShopGlyph(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h16l-1 4H5L4 8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6 12v7h12v-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogRow({ line }: { line: LogLine }): React.JSX.Element {
  const nameColor =
    line.speaker === "maria" ? PALETTE.mariaName : PALETTE.philipName;
  return (
    <div
      style={{
        color: PALETTE.body,
        // Hanging indent on wrap so the second visual line of a long
        // message aligns under the body, not under the chevron.
        paddingLeft: 0,
        textShadow: `0 0 6px rgba(76,255,122,0.05)`,
      }}
    >
      <span style={{ color: PALETTE.chevron, fontWeight: 700, marginRight: 6 }}>&gt;</span>
      <span style={{ color: nameColor, fontWeight: 600, marginRight: 6 }}>
        {line.speaker}
      </span>
      <span style={{ color: PALETTE.timestamp, marginRight: 8 }}>
        [{line.time}]:
      </span>
      <span>{line.body}</span>
      {line.trailingEmoji && (
        <span style={{ marginLeft: 6 }}>{line.trailingEmoji}</span>
      )}
    </div>
  );
}
