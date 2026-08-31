// NEX Mascot Stage · Philip 2026-08-27 v2 · single-hero swipe experience.
//
// Bezel-contained · phone frame + rail + orb stay fully visible.
// Interior of the phone SLOWLY fades to black (~500ms opacity ramp).
// Hero area shows ONE mascot at a time · swipe dots indicate position.
// Below the dots: horizontal row of category containers (slight gray rim).
//
// Two states:
//   BROWSE  · hero mascot + swipe dots + category strip · tap hero → confirm
//   CONFIRM · hero mascot + MEANING + editable personal line + red/green
//
// V2 deferred:
//   · brain-generated personal line
//   · sound / haptics / particles
//   · recipient tap-to-explain

"use client";

import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { listAll } from "@/lib/nex-mascots/registry";
import { pickPersonalTemplate } from "@/lib/nex-mascots/meaning";
import type { Mascot, MascotSection } from "@/lib/nex-mascots/types";
import { useActiveMascot } from "@/lib/nex-mascots/useActiveMascot";
import type { MascotPostPayload } from "./NexMascotDrawerContent";
import type { NexHudTheme } from "./theme";

// Bezel-scoped positioning · same math NexHudFrame + NexSideDrawer use.
const BEZEL_W  = "min(100dvw, calc(100dvh * 850 / 1850))";
const H_GUTTER = `max(0px, calc((100dvw - ${BEZEL_W}) / 2))`;

// Category axis · 4 sections in NEX_ACTIONS. Row shows 3 at a time; the 4th
// scrolls horizontally when present (rare · Special has only 1 mascot).
const CATEGORIES: Array<{ section: MascotSection; label: string }> = [
  { section: "react",    label: "Feelings" },
  { section: "ask-nex",  label: "Ask NEX"  },
  { section: "discover", label: "Discover" },
  { section: "special",  label: "Special"  },
];

// Threshold for switching from dots → "n / m" counter.
const MAX_DOTS = 10;
// Swipe distance (px) at which we advance the hero to prev/next mascot.
const SWIPE_THRESHOLD = 50;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: NexHudTheme;
  onPost?: (payload: MascotPostPayload) => void;
  // Mascot state lifted to NexAppShell so interiorHeader can render the
  // preview bubble in the same DOM node as the "Mascot" title text.
  selectedSection: MascotSection;
  onSectionChange: (s: MascotSection) => void;
  heroIndex: number;
  onHeroIndexChange: (i: number | ((prev: number) => number)) => void;
}

export function NexMascotStage({
  isOpen, onClose, theme, onPost,
  selectedSection, onSectionChange, heroIndex, onHeroIndexChange,
}: Props) {
  const { setActive } = useActiveMascot();
  const allMascots = useMemo(() => listAll().filter((m) => m.hasArtwork), []);
  const setSelectedSection = onSectionChange;
  const setHeroIndex = onHeroIndexChange;
  const [candidate, setCandidate] = useState<Mascot | null>(null);
  const [personalMessage, setPersonalMessage] = useState<string>("");

  const filtered = useMemo(
    () => allMascots.filter((m) => m.section === selectedSection),
    [allMascots, selectedSection],
  );
  const currentMascot: Mascot | undefined = filtered[Math.min(heroIndex, filtered.length - 1)] ?? filtered[0];

  // Reset hero index whenever the category changes.
  useEffect(() => { setHeroIndex(0); }, [selectedSection]);

  // Populate personal message from template when a candidate is set.
  useEffect(() => {
    if (candidate) setPersonalMessage(pickPersonalTemplate(candidate.expression));
    else setPersonalMessage("");
  }, [candidate?.id, candidate?.expression]);

  // Reset state on close.
  useEffect(() => {
    if (!isOpen) {
      setCandidate(null);
      setPersonalMessage("");
    }
  }, [isOpen]);

  // Keyboard: arrows swipe the hero · Esc backs out.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (candidate) setCandidate(null);
        else onClose();
        return;
      }
      if (candidate) return;
      if (e.key === "ArrowRight") setHeroIndex((i) => (i + 1) % Math.max(1, filtered.length));
      if (e.key === "ArrowLeft")  setHeroIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
      if (e.key === "Enter" && currentMascot) setCandidate(currentMascot);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, candidate, filtered.length, currentMascot, onClose]);

  function handleSwipeEnd(_: unknown, info: PanInfo) {
    if (candidate) return;
    if (filtered.length <= 1) return;
    if (info.offset.x < -SWIPE_THRESHOLD)      setHeroIndex((i) => (i + 1) % filtered.length);
    else if (info.offset.x > SWIPE_THRESHOLD)  setHeroIndex((i) => (i - 1 + filtered.length) % filtered.length);
  }

  function handlePost() {
    if (!candidate) return;
    setActive(candidate.id);
    onPost?.({
      mascot: candidate,
      meaning: candidate.meaning,
      personalMessage: personalMessage.trim(),
    });
    setCandidate(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            right: H_GUTTER,
            width: BEZEL_W,
            height: "100dvh",
            overflow: "hidden",
            // Philip 2026-08-27 · "same template surround" · stage sits
            // UNDER the bezel img (z:20) so the frame decoration + rail
            // housing + top strip + bottom pill paint on TOP of the stage.
            // Bezel's transparent interior lets the mascot stage show through.
            // Composer (z:30) · rail (z:100) also above stage · visible.
            zIndex: 15,
            pointerEvents: "none",
          }}
        >
          {/* BLACK CANVAS · Philip 2026-08-27 v3 · FULL WIDTH · extends
              behind the rail buttons + under the composer/bottom-pill area.
              inset:0 fills the entire bezel wrapper. Bezel opaque decoration
              (z:20) + rail buttons (z:100) still paint on top so the frame
              silhouette + buttons stay visible against the full-width black. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => {
              if (candidate) setCandidate(null);
              else onClose();
            }}
            style={{
              position: "absolute",
              inset: 0,
              background: "#050506",
              pointerEvents: "auto",
              cursor: "pointer",
            }}
          />

          {/* STAGE CONTENT · sits INSIDE the interior opening · matches the
              black canvas bounds so mascot + dots + category row stay within
              the inner phone area only. Fades in AFTER the darkness has
              mostly settled (delay 500ms · duration 500ms) so the mascot
              arrives into a black stage rather than during the transition. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "5.6%",
              bottom: "13.9%",
              left: "8.1%",
              right: "17.5%",
              padding: "8% 6% 8%",
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Round × close button removed · Philip 2026-08-27 · users close
                by tapping the backdrop outside the stage content. */}

            {/* Hero header (Studio Mascot / swipe instructions) moved OUT
                to NexHudFrame `interiorHeader` slot at the top-bezel area ·
                sits between the wordmark and header-icon plates · z:30 so
                it paints above the bezel metal. Philip 2026-08-27. */}

            {/* HERO AREA · Philip 2026-08-27 · FULL-WIDTH chat container ·
                mascot on the LEFT · editable text input on the RIGHT · same
                container. Container is full width of the stage content and
                uses the same NEX-orange chat-bubble styling as live chat. */}
            <div style={{
              flex: "1 1 55%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 160,
              position: "relative",
              marginTop: -30,
              paddingTop: 6,
              paddingLeft: 0,
            }}>
              {/* FULL-WIDTH CHAT CONTAINER · mascot LEFT · editable text RIGHT.
                  Live-chat-bubble styling · what user types becomes the personal
                  message on send. Swipe the mascot half to change mascot ·
                  text half stays focus-safe for typing. */}
              {currentMascot && !candidate && (
                <div style={{
                  // Philip 2026-08-27 · shifted +11px RIGHT total (4 + 4 + 3).
                  // Left gap ~18px · right rides ~8px under the bezel edge.
                  width: "calc((min(100dvw, calc(100dvh * 850 / 1850))) * 0.12 - 10px + 100%)",
                  marginLeft: "calc(18px - (min(100dvw, calc(100dvh * 850 / 1850))) * 0.06)",
                  padding: "10px 12px",
                  borderRadius: 16,
                  background: "linear-gradient(150deg, rgba(20,20,24,0.55) 0%, rgba(10,10,14,0.72) 100%)",
                  border: "1px solid rgba(249,115,22,0.28)",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  {/* LEFT · swipeable mascot */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.4}
                    onDragEnd={handleSwipeEnd}
                    onClick={() => setCandidate(currentMascot)}
                    style={{
                      flex: "0 0 auto",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      touchAction: "pan-y",
                      padding: 2,
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`hero-${currentMascot.id}`}
                        layoutId={`mascot-img-${currentMascot.id}`}
                        src={currentMascot.asset}
                        alt={currentMascot.name}
                        initial={{ opacity: 0, x: 20, scale: 0.94 }}
                        animate={{ opacity: 1, x: 0,  scale: 1,    y: [0, -4, 0] }}
                        exit={{    opacity: 0, x: -20, scale: 0.94 }}
                        transition={{
                          opacity: { duration: 0.20 },
                          x:       { type: "spring", stiffness: 280, damping: 26 },
                          scale:   { type: "spring", stiffness: 280, damping: 26 },
                          y:       { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
                        }}
                        style={{
                          height: 72,
                          width: "auto",
                          maxWidth: 88,
                          objectFit: "contain",
                          userSelect: "none",
                          pointerEvents: "none",
                          filter: `drop-shadow(0 8px 14px rgba(0,0,0,0.65)) drop-shadow(0 0 14px ${theme.accents.slotActiveRing}55)`,
                        }}
                      />
                    </AnimatePresence>
                  </motion.div>

                  {/* RIGHT · meaning label + editable text input */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {currentMascot.meaning && (
                      <div style={{
                        fontSize: 10,
                        letterSpacing: 1.4,
                        textTransform: "uppercase",
                        color: "rgba(249,115,22,0.95)",
                        fontWeight: 700,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {currentMascot.meaning}
                      </div>
                    )}
                    <input
                      type="text"
                      value={personalMessage || currentMascot.personalTemplates?.[0] || ""}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                      placeholder="Add your line…"
                      aria-label="Personal message"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid ${NEX.borderMuted}`,
                        color: "rgba(245,245,245,0.95)",
                        fontSize: 12,
                        lineHeight: 1.35,
                        outline: "none",
                        WebkitAppearance: "none",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SWIPE DOTS · position within the current category. */}
            {!candidate && filtered.length > 1 && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                padding: "12px 0 8px",
                minHeight: 24,
              }}>
                {filtered.length <= MAX_DOTS ? (
                  filtered.map((_, i) => {
                    const isActive = i === heroIndex;
                    return (
                      <motion.span
                        key={i}
                        animate={{
                          scale: isActive ? 1.4 : 1,
                          backgroundColor: isActive ? "#f97316" : "rgba(255,255,255,0.28)",
                        }}
                        transition={{ duration: 0.18 }}
                        style={{
                          width: 6, height: 6, borderRadius: "50%",
                          display: "inline-block",
                        }}
                      />
                    );
                  })
                ) : (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1.2,
                    color: "rgba(255,255,255,0.55)",
                  }}>
                    {heroIndex + 1} / {filtered.length}
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY ROW · 3 containers visible · gray rim · gray frosted. */}
            {!candidate && (
              <div
                className="nex-no-scrollbar"
                style={{
                  display: "grid",
                  // 3 columns for a tidy row; on wide viewports 4 fit but 3
                  // reads as intentional. When we have >3 categories, the
                  // 4th just wraps to a second row (2×2 fallback would need
                  // grid tweak; today we ship the 4 · fit fine at 3 columns
                  // due to short labels).
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  paddingBottom: 6,
                }}
              >
                {CATEGORIES.map(({ section, label }) => {
                  const isActive = section === selectedSection;
                  const rep = allMascots.find((m) => m.section === section);
                  if (!rep) return null;
                  return (
                    <motion.button
                      key={section}
                      type="button"
                      onClick={() => setSelectedSection(section)}
                      whileTap={{ scale: 0.96 }}
                      style={{
                        appearance: "none",
                        padding: "10px 6px 8px",
                        borderRadius: 12,
                        // Slight gray rim per spec.
                        border: `1px solid ${isActive ? "rgba(249,115,22,0.6)" : "rgba(120,120,128,0.35)"}`,
                        background: isActive
                          ? "linear-gradient(150deg, rgba(249,115,22,0.14) 0%, rgba(20,20,24,0.7) 100%)"
                          : "linear-gradient(150deg, rgba(40,40,46,0.4) 0%, rgba(18,18,22,0.6) 100%)",
                        boxShadow: isActive
                          ? "inset 0 0 0 1px rgba(249,115,22,0.35), 0 3px 10px rgba(0,0,0,0.45)"
                          : "inset 0 0 0 1px rgba(120,120,128,0.20), 0 2px 6px rgba(0,0,0,0.4)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        transition: "border-color 160ms, background 160ms, box-shadow 200ms",
                      }}
                    >
                      <img
                        src={rep.thumb ?? rep.asset}
                        alt=""
                        loading="lazy"
                        style={{
                          height: 26,
                          width: "auto",
                          maxWidth: "72%",
                          objectFit: "contain",
                          pointerEvents: "none",
                          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
                          opacity: isActive ? 1 : 0.75,
                        }}
                      />
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: isActive ? theme.accents.onDark : theme.accents.onDarkMuted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}>
                        {label}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* CONFIRM OVERLAY · MEANING + editable personal line + red/green.
                Sits ABOVE the browse content · overlays it. */}
            <AnimatePresence>
              {candidate && (
                <motion.div
                  key={`confirm-${candidate.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 24px",
                    gap: 14,
                    background: "linear-gradient(180deg, rgba(5,5,7,0.86) 0%, rgba(5,5,7,0.94) 100%)",
                  }}
                >
                  {/* Hero mascot (larger in confirm mode) via shared layoutId. */}
                  <motion.img
                    layoutId={`mascot-img-${candidate.id}`}
                    src={candidate.asset}
                    alt={candidate.name}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ y: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } }}
                    style={{
                      height: 148,
                      width: "auto",
                      objectFit: "contain",
                      pointerEvents: "none",
                      filter: `drop-shadow(0 14px 26px rgba(0,0,0,0.75)) drop-shadow(0 0 26px ${theme.accents.slotActiveRing}55)`,
                    }}
                  />

                  {candidate.meaning && (
                    <div style={{
                      fontSize: 14, fontWeight: 700, letterSpacing: 2.4,
                      textTransform: "uppercase",
                      color: theme.accents.onDark, textAlign: "center",
                    }}>
                      {candidate.meaning}
                    </div>
                  )}

                  <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
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
                        padding: "12px 34px 12px 16px",
                        borderRadius: 14,
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
                    <span aria-hidden style={{
                      position: "absolute",
                      right: 14, top: "50%", transform: "translateY(-50%)",
                      fontSize: 12, color: NEX.textMuted, pointerEvents: "none",
                    }}>✎</span>
                  </div>

                  <div style={{ display: "flex", gap: 44, marginTop: 8 }}>
                    <StageActionButton kind="cancel"  onClick={() => setCandidate(null)} />
                    <StageActionButton kind="confirm" onClick={handlePost} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function StageActionButton({ kind, onClick }: { kind: "cancel" | "confirm"; onClick: () => void }) {
  const isConfirm = kind === "confirm";
  const base = isConfirm ? "#0e5f34" : "#7c1d2a";
  const rim  = isConfirm ? "#22c55e" : "#f43f5e";
  const glyph = isConfirm ? "✓" : "×";
  const label = isConfirm ? "Post to chat" : "Back";
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.90 }}
      whileHover={{ scale: 1.06 }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.10 }}
      style={{
        position: "relative",
        appearance: "none",
        width: 56, height: 56, borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, ${base} 0%, #08080b 92%)`,
        border: `1.5px solid ${rim}aa`,
        color: rim,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isConfirm ? 22 : 26, fontWeight: 700, lineHeight: 1,
        boxShadow: `0 0 24px ${rim}66, inset 0 0 12px ${rim}33, 0 6px 14px rgba(0,0,0,0.6)`,
        padding: 0,
      }}
    >
      {glyph}
      <span aria-hidden style={{
        position: "absolute", inset: -6, borderRadius: "50%",
        border: `1px solid ${rim}`, opacity: 0.30,
        animation: "nex-stage-btn-ring 2.4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <style>{`
        @keyframes nex-stage-btn-ring {
          0%, 100% { transform: scale(1);   opacity: 0.30; }
          50%      { transform: scale(1.22); opacity: 0.04; }
        }
      `}</style>
    </motion.button>
  );
}
