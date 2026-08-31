// NEX Mascot Drawer · CONCEPT A · Orbit Ring + Break-to-Center · 2026-08-27.
//
// Doctrine (Philip 2026-08-27):
//   · mascots sit on a partial ARC along the drawer's right edge
//   · idle drift · focused mascot bobs + shows name chip
//   · tap → mascot BREAKS from orbit, flies to centre with red/green arc buttons
//   · green confirms + fires a compression-beam into the chat area
//   · red returns mascot to orbit
//   · everything stays inside the drawer's coordinate system (no modal)
//
// World-class references:
//   · Apple Watch Digital Crown wheel (focal rotation + haptic detent)
//   · Family app (Rauno Freiberg · orbital physics + parallax lift)
//   · visionOS spatial windows (one-at-a-time focus)

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { listAll, search as searchMascots } from "@/lib/nex-mascots/registry";
import { pickPersonalTemplate } from "@/lib/nex-mascots/meaning";
import type { Mascot, MascotSection } from "@/lib/nex-mascots/types";
import { useActiveMascot } from "@/lib/nex-mascots/useActiveMascot";
import type { NexHudTheme } from "./theme";

/** Category axis · one row per NEX_ACTIONS section. Order = display order. */
const CATEGORY_ORDER: Array<{ section: MascotSection; label: string }> = [
  { section: "react",    label: "React"    },
  { section: "ask-nex",  label: "Ask NEX"  },
  { section: "discover", label: "Discover" },
  { section: "special",  label: "Special"  },
];

/** Payload emitted when the user confirms a mascot with meaning + personal line. */
export interface MascotPostPayload {
  mascot: Mascot;
  meaning: string;
  personalMessage: string;
}

interface Props {
  theme: NexHudTheme;
  onSelected?: (mascot: Mascot) => void;
  onClose?: () => void;
  /**
   * Post an emotional postcard to the chat · Philip 2026-08-27.
   * Payload carries the mascot + resolved meaning + the editable personal
   * line the sender chose. Chat renderer reads all three.
   */
  onPostMascot?: (payload: MascotPostPayload) => void;
}

// Orbit geometry · every slot is `SLOT_STEP_Y` apart · focused sits at Y=0.
// Non-focused slots recede in X toward the right rail edge · focus bulges left.
const SLOT_STEP_Y      = 62;   // px between adjacent mascots (vertical)
const FOCUS_X_OFFSET   = 44;   // px focused mascot bulges LEFT from the rail edge
const RAIL_EDGE_INSET  = 24;   // px right-side breathing room from the drawer edge
const AUTO_DRIFT_MS    = 4200; // idle drift cadence

// Per-distance styling table · distance = |slotIndex - focusIndex|.
// Values beyond distance 4 are effectively invisible.
const SLOT_TABLE: Array<{ scale: number; opacity: number; xShift: number }> = [
  { scale: 1.00, opacity: 1.00, xShift: FOCUS_X_OFFSET }, // 0 · focused
  { scale: 0.72, opacity: 0.82, xShift: 18 },              // ±1
  { scale: 0.52, opacity: 0.55, xShift: 6 },               // ±2
  { scale: 0.38, opacity: 0.30, xShift: 0 },               // ±3
  { scale: 0.28, opacity: 0.10, xShift: 0 },               // ±4
];

export function NexMascotDrawerContent({ theme, onSelected, onClose, onPostMascot }: Props) {
  const { activeMascotId, setActive } = useActiveMascot();
  const allMascots = useMemo(() => listAll().filter((m) => m.hasArtwork), []);

  // Category selector · one representative mascot per section · discovery-first
  // dropdown is the ONLY way to browse (search removed 2026-08-27 · Philip).
  const [selectedSection, setSelectedSection] = useState<MascotSection>("react");
  const categoryReps = useMemo(() =>
    CATEGORY_ORDER.map(({ section, label }) => ({
      section, label,
      mascot: allMascots.find((m) => m.section === section) ?? null,
    })).filter((x) => x.mascot !== null),
  [allMascots]);

  // Mascots visible in the list · always filtered by the selected category.
  const visibleMascots = useMemo(
    () => allMascots.filter((m) => m.section === selectedSection),
    [allMascots, selectedSection],
  );

  // Confirm-mode candidate · when set, orbit dims and the postcard UI rises.
  const [candidate, setCandidate] = useState<Mascot | null>(null);
  // Editable personal line for the postcard · initialised from a random
  // template pick when candidate changes · user can freely edit before send.
  const [personalMessage, setPersonalMessage] = useState<string>("");
  useEffect(() => {
    if (candidate) {
      setPersonalMessage(pickPersonalTemplate(candidate.expression));
    } else {
      setPersonalMessage("");
    }
  }, [candidate?.id, candidate?.expression]);

  // Category selector · no more auto-drift, no hover-changes-top. User taps
  // a category to change what shows in the list. Cards under the top strip
  // never mutate the top strip (Philip 2026-08-27 · fixed hover-artifact bug).
  const listRef = useRef<HTMLDivElement | null>(null);

  // Category selection · Philip 2026-08-27 · dropdown replaced by a row of
  // round orange icon buttons (one per section · discovery-first).

  function handlePickMascot(m: Mascot) {
    setCandidate(m);
  }

  function handleConfirm() {
    if (!candidate) return;
    setActive(candidate.id);
    onPostMascot?.({
      mascot: candidate,
      meaning: candidate.meaning,
      personalMessage: personalMessage.trim(),
    });
    onSelected?.(candidate);
    // Post-beam animation is expressed by the candidate motion.div's exit variants.
    setCandidate(null);
  }

  function handleCancel() {
    setCandidate(null);
  }

  const hasAny = allMascots.length > 0;

  // CONFIRM VIEW · Philip 2026-08-27 · takes over the whole drawer when a
  // mascot is selected. No search bar · mascot at top-centre, large · meaning
  // below · editable personal line · red/green buttons at the bottom.
  if (candidate) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "34px 20px 26px",
          gap: 16,
          position: "relative",
        }}
      >
        {/* Mascot · top-centre · large. Shared layoutId morphs from the
            list row's img so the transition reads as one motion. */}
        <motion.img
          layoutId={`mascot-img-${candidate.id}`}
          src={candidate.asset}
          alt={candidate.name}
          animate={{ y: [0, -6, 0] }}
          transition={{ y: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } }}
          style={{
            height: 132,
            width: "auto",
            maxWidth: "80%",
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            filter: `drop-shadow(0 14px 26px rgba(0,0,0,0.72)) drop-shadow(0 0 22px ${theme.accents.slotActiveRing}55)`,
          }}
        />

        {/* Meaning · authoritative label. Only renders when the expression
            has a known meaning (see meaning.ts) · empty meanings deliberately
            omit the label so no robotic auto-sentence appears. */}
        {candidate.meaning && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2.2,
              textTransform: "uppercase",
              color: theme.accents.onDark,
              textAlign: "center",
              lineHeight: 1.25,
              marginTop: 2,
            }}
          >
            {candidate.meaning}
          </div>
        )}

        {/* Editable personal line · auto-picked from template rotation ·
            user can freely edit before send. */}
        <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
          <input
            type="text"
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder="Add a line…"
            aria-label="Personal message"
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 32px 10px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${NEX.borderMuted}`,
              color: theme.accents.onDark,
              fontSize: 13,
              lineHeight: 1.4,
              outline: "none",
              WebkitAppearance: "none",
              textAlign: "center",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              color: NEX.textMuted,
              pointerEvents: "none",
            }}
          >
            ✎
          </span>
        </div>

        {/* Spacer · pushes the action row to the bottom of the drawer. */}
        <div style={{ flex: 1 }} />

        {/* Action row · red LEFT (cancel), green RIGHT (post). */}
        <div style={{ display: "flex", gap: 40, marginBottom: 6 }}>
          <BottomActionButton kind="cancel"  onClick={handleCancel}  />
          <BottomActionButton kind="confirm" onClick={handleConfirm} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100%" }}>
      {/* TOP BAR · Themes dropdown only · Philip 2026-08-27 · search bar
          removed in favour of discovery-first dropdown. Users browse themes
          rather than type them. */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
        padding: "0 2px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* THEMES header + DROPDOWN · discovery-first · users see the
            currently selected theme + can tap to reveal the full list of
            themes (surfaces what they didn't know existed). */}
        {categoryReps.length > 0 && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: "uppercase", color: theme.accents.onDarkMuted,
              paddingLeft: 4, marginBottom: 6,
              lineHeight: 1,
            }}>
              Themes
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              gap: 6,
              // Right padding pushes buttons LEFT so they clear the rail-frame
              // area on the drawer's right edge (rail sits over the last ~50px
              // of the drawer where the frame is opaque). Philip 2026-08-27.
              padding: "0 46px 0 4px",
            }}>
              {categoryReps.map(({ section, label, mascot }) => {
                const isActive = section === selectedSection;
                return (
                  <button
                    key={section}
                    type="button"
                    aria-label={`${label} mascots`}
                    aria-pressed={isActive}
                    title={label}
                    onClick={() => setSelectedSection(section)}
                    style={{
                      appearance: "none",
                      width: 46, height: 46, minWidth: 46,
                      borderRadius: "50%",
                      border: `2px solid ${isActive ? "#f97316" : "rgba(249,115,22,0.55)"}`,
                      background: isActive
                        ? "radial-gradient(circle at 32% 28%, rgba(249,115,22,0.35) 0%, rgba(20,20,24,0.85) 90%)"
                        : "radial-gradient(circle at 32% 28%, rgba(60,60,66,0.4) 0%, rgba(14,14,18,0.85) 90%)",
                      boxShadow: isActive
                        ? "0 0 14px rgba(249,115,22,0.65), inset 0 0 8px rgba(249,115,22,0.20), 0 4px 10px rgba(0,0,0,0.5)"
                        : "0 0 8px rgba(249,115,22,0.20), inset 0 0 6px rgba(0,0,0,0.4), 0 3px 8px rgba(0,0,0,0.4)",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      transition: "border-color 160ms ease, box-shadow 200ms ease, transform 120ms ease",
                    }}
                    onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
                    onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <img
                      src={mascot!.thumb ?? mascot!.asset}
                      alt=""
                      loading="lazy"
                      style={{
                        height: 30, width: "auto", maxWidth: "80%",
                        objectFit: "contain", pointerEvents: "none",
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
                        opacity: isActive ? 1 : 0.85,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* EMPTY-STATE · honest, no invented artwork. */}
      {!hasAny && (
        <div
          role="status"
          style={{
            marginTop: 24, padding: "28px 12px", textAlign: "center",
            color: NEX.textMuted, fontSize: 13, lineHeight: 1.5,
            border: `1px dashed ${NEX.borderMuted}`, borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ fontSize: 15, color: NEX.text, marginBottom: 6 }}>Mascots are on their way</div>
          <div>Your NEX will get personality here as soon as the mascot library ships.</div>
        </div>
      )}

      {/* Category-empty notice · shown when the selected theme has no
          mascots with artwork (shouldn't happen normally · defensive). */}
      {hasAny && visibleMascots.length === 0 && (
        <div style={{
          position: "absolute",
          top: 130, left: 32, right: 12,
          padding: 20, textAlign: "center", color: NEX.textMuted, fontSize: 13,
        }}>
          No mascots in this theme yet.
        </div>
      )}

      {/* Focus preview banner removed 2026-08-27 · replaced by the category
          strip at the top. Category selection controls what shows below,
          hovering cards no longer mutates any top element. */}

      {/* MASCOT LIST · Philip 2026-08-27 · right-aligned so cards visually
          run under the bezel's rail housing (drawer z:15 sits under bezel
          z:20, so the opaque rail housing naturally hides the card's right
          edge). Filtered by the selected category. */}
      {hasAny && visibleMascots.length > 0 && (
        <div
          ref={listRef}
          className="nex-no-scrollbar"
          style={{
            position: "absolute",
            top: 78,           // clear Themes header (0-14) + dropdown button (18-62) + gap
            bottom: 14,
            // Philip 2026-08-27 · small left padding · drawer's left edge is
            // now close to the mascot cards' left edge (drawer width narrowed
            // in NexSideDrawer). Right stays flush so cards run under the
            // rail housing.
            left: 12,
            right: -4,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingBottom: 8,
          }}
        >
          {/* Filtered list · no hover-focus mutation · tap to open confirm.
              Cards visually run under the frame on the right side. */}
          {!candidate && visibleMascots.map((m) => {
            return (
              <button
                key={m.id}
                type="button"
                aria-label={m.name}
                onClick={() => handlePickMascot(m)}
                style={{
                  // Philip 2026-08-27 · reference image applied as the card
                  // material · overlaid with a subtle darkening gradient so
                  // the mascot + text remain crisp against any image content.
                  appearance: "none",
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: `linear-gradient(150deg, rgba(20,20,24,0.55) 0%, rgba(10,10,14,0.68) 100%), url("https://ik.imagekit.io/ctlxgvqcm/Untitleddfsdfsdfsdfsdfsdfsd.png") center/cover no-repeat`,
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 12,
                  // Philip 2026-08-27 · thin dark-gray line running INSIDE
                  // the card · 1.5px inset ring · follows the rounded
                  // corners naturally.
                  boxShadow: "0 3px 8px rgba(0,0,0,0.35), inset 0 0 0 1.5px rgba(75,75,80,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
                  transition: "background 160ms ease, border-color 160ms ease, transform 120ms ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = `linear-gradient(150deg, rgba(30,30,36,0.40) 0%, rgba(18,18,22,0.55) 100%), url("https://ik.imagekit.io/ctlxgvqcm/Untitleddfsdfsdfsdfsdfsdfsd.png") center/cover no-repeat`;
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = `linear-gradient(150deg, rgba(20,20,24,0.55) 0%, rgba(10,10,14,0.68) 100%), url("https://ik.imagekit.io/ctlxgvqcm/Untitleddfsdfsdfsdfsdfsdfsd.png") center/cover no-repeat`;
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
                onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <img
                  src={m.thumb ?? m.asset}
                  alt=""
                  loading="lazy"
                  style={{
                    height: 40, width: "auto", maxWidth: 48, objectFit: "contain",
                    pointerEvents: "none", userSelect: "none",
                    flex: "0 0 auto",
                    filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Philip 2026-08-27 · tag subtitle removed · name only ·
                      slightly larger and centered within the text column. */}
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: theme.accents.onDark,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    letterSpacing: -0.1,
                    textAlign: "center",
                  }}>
                    {m.name}
                  </div>
                </div>
              </button>
            );
          })}

          {/* CONFIRM MODE moved OUT · Philip 2026-08-27 · now a full-drawer
              takeover view rendered at the top of this component. The block
              below is left in place but guarded so it never fires (candidate
              is always null here when we reach this render). */}
          <AnimatePresence>
            {false && candidate && (
              <motion.div
                key={`confirm-${candidate.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={handleCancel}   // tap outside cancels
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 100%)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  cursor: "pointer",
                  zIndex: 20,
                }}
              >
                <motion.div
                  onClick={(e) => e.stopPropagation()}
                  initial={{ scale: 0.72, opacity: 0, y: 12 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scaleY: 0.05, scaleX: 0.4, x: -320, opacity: 0 }}   // beam-to-chat compression on exit
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  style={{
                    position: "relative",
                    width: "82%",
                    maxWidth: 260,
                    borderRadius: 18,
                    padding: "22px 18px 76px",
                    background: "linear-gradient(160deg, rgba(20,20,24,0.86) 0%, rgba(6,6,10,0.94) 100%)",
                    border: `1px solid ${theme.accents.slotActiveRing}44`,
                    boxShadow: `0 18px 44px rgba(0,0,0,0.7), 0 0 32px ${theme.accents.slotActiveRing}22`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    cursor: "default",
                  }}
                >
                  {/* MASCOT · visual hero. Shared layout morph from orbit focus. */}
                  <motion.img
                    layoutId={`mascot-img-${candidate.id}`}
                    src={candidate.asset}
                    alt={candidate.name}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ y: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } }}
                    style={{
                      height: 92, width: "auto", objectFit: "contain",
                      pointerEvents: "none", userSelect: "none",
                      filter: `drop-shadow(0 10px 20px rgba(0,0,0,0.7)) drop-shadow(0 0 16px ${theme.accents.slotActiveRing}55)`,
                    }}
                  />

                  {/* MEANING · authoritative label. Only rendered when the
                      expression has a known meaning. Empty meanings (generic
                      fallback) intentionally show only the mascot + editable
                      personal line — no robotic auto-generated sentence. */}
                  {candidate.meaning && (
                    <div style={{
                      fontSize: 11,
                      letterSpacing: 1.8,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: theme.accents.onDark,
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}>
                      {candidate.meaning}
                    </div>
                  )}

                  {/* PERSONAL LINE · editable, softer, human. Auto-picked from
                      the template pool on open · user can override before send. */}
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      type="text"
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                      placeholder="Add a line…"
                      aria-label="Personal message"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "9px 30px 9px 12px",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${NEX.borderMuted}`,
                        color: theme.accents.onDark,
                        fontSize: 12,
                        lineHeight: 1.35,
                        outline: "none",
                        WebkitAppearance: "none",
                        textAlign: "center",
                      }}
                    />
                    {/* Edit hint · pure decoration to signal editability. */}
                    <span aria-hidden style={{
                      position: "absolute",
                      right: 10, top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 12, color: NEX.textMuted,
                      pointerEvents: "none",
                    }}>✎</span>
                  </div>

                  {/* ARC BUTTONS · red LEFT (cancel) · green RIGHT (send). */}
                  <ArcButton kind="cancel" onClick={handleCancel} />
                  <ArcButton kind="confirm" onClick={handleConfirm} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Bottom action button · red cancel · green confirm ─────────────────────

function BottomActionButton({ kind, onClick }: { kind: "cancel" | "confirm"; onClick: () => void }) {
  const isConfirm = kind === "confirm";
  const base = isConfirm ? "#0e5f34" : "#7c1d2a";
  const rim  = isConfirm ? "#22c55e" : "#f43f5e";
  const glyph = isConfirm ? "✓" : "×";
  const label = isConfirm ? "Post to chat" : "Cancel";
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.90 }}
      whileHover={{ scale: 1.06 }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.10 }}
      style={{
        position: "relative",
        appearance: "none",
        width: 52, height: 52, borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, ${base} 0%, #08080b 92%)`,
        border: `1.5px solid ${rim}aa`,
        color: rim,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isConfirm ? 18 : 24, fontWeight: 700, lineHeight: 1,
        boxShadow: `0 0 22px ${rim}55, inset 0 0 12px ${rim}33, 0 4px 12px rgba(0,0,0,0.5)`,
        padding: 0,
        paddingLeft: isConfirm ? 3 : 0,
      }}
    >
      {glyph}
      <span aria-hidden style={{
        position: "absolute", inset: -6, borderRadius: "50%",
        border: `1px solid ${rim}`, opacity: 0.30,
        animation: "nex-btn-ring 2.4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <style>{`
        @keyframes nex-btn-ring {
          0%, 100% { transform: scale(1);   opacity: 0.30; }
          50%      { transform: scale(1.22); opacity: 0.04; }
        }
      `}</style>
    </motion.button>
  );
}

// ── Legacy arc button (retained for reference · not currently rendered) ────

function ArcButton({ kind, onClick }: { kind: "cancel" | "confirm"; onClick: () => void }) {
  const isConfirm = kind === "confirm";
  const base = isConfirm ? "#0e5f34" : "#7c1d2a";
  const rim  = isConfirm ? "#22c55e" : "#f43f5e";
  const glyph = isConfirm ? "✓" : "×";
  const label = isConfirm ? "Post to chat" : "Cancel";
  // Positioned along the BOTTOM of the postcard · red left · green right.
  const positionStyle: React.CSSProperties = isConfirm
    ? { right: 14, bottom: 14 }
    : { left:  14, bottom: 14 };
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.90 }}
      whileHover={{ scale: 1.06 }}
      initial={{ scale: 0.2, opacity: 0, x: isConfirm ? -20 : 20 }}
      animate={{ scale: 1, opacity: 1, x: 0 }}
      exit={{ scale: 0.2, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.10 }}
      style={{
        position: "absolute",
        appearance: "none",
        width: 48, height: 48, borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, ${base} 0%, #08080b 92%)`,
        border: `1.5px solid ${rim}aa`,
        color: rim,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isConfirm ? 16 : 22, fontWeight: 700, lineHeight: 1,
        boxShadow: `0 0 22px ${rim}55, inset 0 0 12px ${rim}33, 0 4px 12px rgba(0,0,0,0.5)`,
        padding: 0,
        paddingLeft: isConfirm ? 3 : 0,
        zIndex: 30,
        ...positionStyle,
      }}
    >
      {glyph}
      <span aria-hidden style={{
        position: "absolute", inset: -6, borderRadius: "50%",
        border: `1px solid ${rim}`, opacity: 0.30,
        animation: "nex-btn-ring 2.4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <style>{`
        @keyframes nex-btn-ring {
          0%, 100% { transform: scale(1);   opacity: 0.30; }
          50%      { transform: scale(1.22); opacity: 0.04; }
        }
      `}</style>
    </motion.button>
  );
}
