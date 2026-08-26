// NEX emoji tray · the NEX-owned reaction picker.
//
// UX (Philip 2026-08-25):
//   · Opens INSIDE the chat window via a 3D flip animation · not a modal.
//   · Scrollable grid of NEX-owned mascot reactions (see nexEmojis.ts).
//   · Cells are 3× the earlier size so the character reads clearly.
//   · Animation toggle in the header · when ON the mascots gently bob so the
//     tray feels alive · when OFF they hold still. Toggle state persists via
//     localStorage across sessions.
//   · Tap emoji → apply reaction (parent handles toggle logic) → tray closes,
//     flip back to chat.

"use client";

import { useEffect, useMemo, useState } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { NEX_REACTIONS, type NexEmoji } from "@/lib/nexapp/nexEmojis";
import { NEX_ACTIONS, sectionForTier } from "@/lib/nex-actions/registry";
import { tooltipForAction } from "./NexTooltip";


export function NexEmojiTray({
  onSelect,
  onClose,
  activeEmojis,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** Emojis the current user has already reacted with · rendered highlighted. */
  activeEmojis: Set<string>;
}) {
  // Reactions now come from the NEX_ACTIONS registry (single source of truth
  // per F1 doctrine). Convert each Tier-1 NexAction into the NexEmoji shape
  // the tray renderer expects.
  const items = useMemo<NexEmoji[]>(
    () => NEX_ACTIONS
      .filter((a) => a.tier === "reaction")
      .map((a) => ({
        emoji: a.id,
        label: a.mascot.label,
        category: "nex",
        imageUrl: a.mascot.imageUrl,
      })),
    [],
  );
  // Animation is always on (Philip 2026-08-25 · toggle removed).
  const animate = true;
  // Section filter (Philip 2026-08-25) · segmented toggle bar under the
  // header lets users jump straight to React / Ask NEX / Discover / Special.
  // Persisted across tray opens via localStorage.
  type Section = "react" | "ask-nex" | "discover" | "special";
  const [activeSection, setActiveSection] = useState<Section>("react");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nex.emojiTray.section");
      if (raw === "react" || raw === "ask-nex" || raw === "discover" || raw === "special") {
        setActiveSection(raw);
      }
    } catch { /* ignore */ }
  }, []);
  const selectSection = (s: Section) => {
    setActiveSection(s);
    try { localStorage.setItem("nex.emojiTray.section", s); } catch { /* ignore */ }
  };
  const [preview, setPreview] = useState<NexEmoji | null>(null);
  const openPreview = (e: NexEmoji) => setPreview(e);
  const cancelPreview = () => setPreview(null);
  const confirmPreview = () => {
    if (!preview) return;
    const key = preview.emoji;
    setPreview(null);
    onSelect(key);
  };

  return (
    <div style={containerStyle}>
      <style>{keyframesCss}</style>
      <header style={headerStyle}>
        <span style={titleStyle}>React with NEX</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emoji picker"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>
      </header>

      {/* Segmented tab bar · pick a section to focus (Philip 2026-08-25) */}
      <div style={tabBarStyle} role="tablist" aria-label="NEX action sections">
        {([
          { key: "react",    label: "React" },
          { key: "ask-nex",  label: "Ask NEX" },
          { key: "discover", label: "Date" },
          { key: "special",  label: "Erase" },
        ] as const).map(t => {
          const active = activeSection === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectSection(t.key)}
              style={{
                ...tabButtonStyle,
                background: active ? "rgba(249, 115, 22, 0.16)" : "transparent",
                color: active ? NEX.orange : NEX.textMuted,
                borderColor: active ? NEX.orange : "transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={scrollAreaStyle} className="nex-no-scrollbar">
        {activeSection === "react" && <>
        <div style={gridStyle}>
          {items.map((e, i) => {
            const active = activeEmojis.has(e.emoji);
            return (
              <button
                key={e.emoji}
                type="button"
                onClick={() => openPreview(e)}
                aria-label={e.label}
                style={{
                  ...emojiCellStyle,
                  // Active = already-picked reaction · warm orange rim overrides gray.
                  borderColor: active ? NEX.orange : "rgba(255,255,255,0.14)",
                }}
              >
                <div style={cellImageWrapStyle}>
                  <NexEmojiRender emoji={e} animate={animate} phase={i} />
                </div>
                <span style={cellLabelStyle}>{e.label}</span>
              </button>
            );
          })}
        </div></>}

        {/* Ask NEX · Tier-2 intelligence · Discover · Tier-3 actions · Special · Tier-4 consumables */}
        {(["ask-nex", "discover", "special"] as const).filter(s => s === activeSection).map((sect) => {
          const items = NEX_ACTIONS.filter(a => (a.section ?? sectionForTier(a.tier)) === sect);
          if (items.length === 0) return null;
          const specialTint = sect === "special";
          return (
            <div key={sect}>
              <div style={gridStyle}>
                {items.map((a, i) => {
                  const tip = tooltipForAction(a);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openPreview({
                        emoji: a.id,
                        label: a.mascot.label,
                        category: "nex",
                        imageUrl: a.mascot.imageUrl,
                      } as NexEmoji)}
                      aria-label={tip.title}
                      style={{
                        ...emojiCellStyle,
                        // Special (Tier-4 consumables) get an orange rim to signal cost.
                        borderColor: specialTint ? NEX.orange : "rgba(255,255,255,0.14)",
                      }}
                    >
                      <div style={cellImageWrapStyle}>
                        <NexEmojiRender
                          emoji={{ emoji: a.id, label: a.mascot.label, category: "nex", imageUrl: a.mascot.imageUrl } as NexEmoji}
                          animate={animate}
                          phase={i}
                        />
                      </div>
                      <span style={cellLabelStyle}>{a.mascot.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview overlay · 2× emoji · POST or CLOSE */}
      {preview && (
        <div style={previewOverlayStyle} role="dialog" aria-label={`Preview ${preview.label}`}>
          <div style={previewCardStyle}>
            <div style={previewImageWrapStyle}>
              {preview.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt=""
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              ) : (
                <span style={{ fontSize: 120, lineHeight: 1 }}>{preview.emoji}</span>
              )}
            </div>
            <div style={previewLabelStyle}>{preview.label}</div>
            {(() => {
              const asAction = NEX_ACTIONS.find(a => a.id === preview.emoji);
              if (asAction?.cost?.sparks) {
                return (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", background: "rgba(249,115,22,0.14)",
                    border: `1px solid ${NEX.orange}`, borderRadius: 999,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                    color: NEX.orange,
                  }}>
                    ⚡ {asAction.cost.sparks} Sparks
                  </div>
                );
              }
              return null;
            })()}
            <div style={previewButtonsStyle}>
              <button type="button" onClick={cancelPreview} style={previewCloseBtnStyle}>Close</button>
              <button type="button" onClick={confirmPreview} style={previewPostBtnStyle}>
                {NEX_ACTIONS.find(a => a.id === preview.emoji)?.cost ? "Use" : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NexEmojiRender({ emoji, animate, phase }: { emoji: NexEmoji; animate: boolean; phase: number }) {
  const inner: React.CSSProperties = {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    display: "block",
    // Staggered animation delay so a row of 3 mascots doesn't bob in lockstep.
    animation: animate ? `nex-emoji-bob 2.4s ease-in-out ${(phase * 0.28).toFixed(2)}s infinite` : "none",
    transformOrigin: "center bottom",
  };
  if (emoji.imageUrl) {
    return <img src={emoji.imageUrl} alt="" draggable={false} style={inner} />;
  }
  return <span style={{ ...inner, fontSize: 64, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{emoji.emoji}</span>;
}

// ── styles ────────────────────────────────────────────────────────────

const keyframesCss = `
  @keyframes nex-emoji-bob {
    0%,   100% { transform: translateY(0) rotate(0deg) scale(1);   }
    30%        { transform: translateY(-4px) rotate(-3deg) scale(1.04); }
    60%        { transform: translateY(0)   rotate(2deg)  scale(1);   }
    80%        { transform: translateY(-2px) rotate(-1deg) scale(1.02); }
  }
  @keyframes nex-fade-in {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    [style*="nex-emoji-bob"], [style*="nex-fade-in"] { animation: none !important; }
  }
`;

const containerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  // Black tray container · Philip 2026-08-25 · cells sit on a pure-black
  // background with gray-rimmed cells for max mascot contrast.
  background: "#000000",
  borderRadius: 22,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  color: NEX.textMuted,
  textTransform: "uppercase" as const,
};

const closeButtonStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.10)",
  color: NEX.text,
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "14px 14px 20px",
};

// 3× the original cell size · 3-column grid so the mascots are unmistakable.
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
};

// Cell containers · Philip 2026-08-25 · solid black + gray rim · flex-column
// so mascot sits above its 1-word label. Aspect-ratio 4:5 leaves square-ish
// space for the mascot with a small label strip below (~20% of cell height).
const emojiCellStyle: React.CSSProperties = {
  position: "relative",
  aspectRatio: "4 / 5",
  background: "#000000",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 14,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 4px 6px",
  transition: "background 140ms ease, border-color 140ms ease",
  width: "100%",
  overflow: "hidden",
};

// Image wrapper · fills the square portion of the cell.
const cellImageWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Permanent 1-word label under each mascot · Philip 2026-08-25.
const cellLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.2,
  color: "#F5F5F5",
  lineHeight: 1.1,
  textAlign: "center",
  paddingTop: 3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "6px 10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};
const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 8px",
  border: "1px solid transparent",
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
  cursor: "pointer",
  transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
  // Never wrap · "Ask NEX" must stay on one line even at narrow widths.
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase" as const,
  color: NEX.textMuted,
  padding: "0 4px 8px",
};

// ── preview overlay styles ─────────────────────────────────────────
const previewOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 0, 0, 0.72)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 20,
  animation: "nex-fade-in 180ms ease-out both",
};
const previewCardStyle: React.CSSProperties = {
  background: "#000000",
  border: `1px solid rgba(255,255,255,0.14)`,
  borderRadius: 18,
  padding: "20px 24px 18px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 24px ${NEX.orangeGlowLo}`,
  minWidth: "60%",
  maxWidth: "82%",
};
const previewImageWrapStyle: React.CSSProperties = {
  width: 140,
  height: 140,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  filter: `drop-shadow(0 6px 18px ${NEX.orangeGlowLo})`,
};
const previewLabelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase" as const,
  color: NEX.textMuted,
  fontWeight: 600,
};
const previewButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 4,
};
const previewCloseBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: NEX.textMuted,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  cursor: "pointer",
};
const previewPostBtnStyle: React.CSSProperties = {
  padding: "8px 24px",
  borderRadius: 10,
  border: `1px solid ${NEX.orange}`,
  background: NEX.orange,
  color: "#0a0a0a",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  cursor: "pointer",
  boxShadow: `0 4px 14px ${NEX.orangeGlow}`,
};
