// NEX Mascot Drawer Content · 2026-08-27.
//
// Renders inside NexSideDrawer (withGlassReveal). Reads the mascot library via
// the nex-mascots adapter over NEX_ACTIONS. Never invents artwork · when the
// library is empty or a mascot lacks artwork, an honest empty/pending state
// shows instead of a placeholder character.
//
// Doctrine:
//   §5 THEME = ENVIRONMENT · MASCOT = PERSONALITY
//   §11 Empty state must NOT display fake teddies · stock characters · emoji subs
//   §12 Mascot cards are reusable · not coupled to any single theme
//   §14 Same drawer content shape may later back other side tools

"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { recommendationSplit, search as searchMascots } from "@/lib/nex-mascots/registry";
import type { Mascot } from "@/lib/nex-mascots/types";
import { useActiveMascot } from "@/lib/nex-mascots/useActiveMascot";
import { NexMascotDetail } from "./NexMascotDetail";
import type { NexHudTheme } from "./theme";

interface Props {
  theme: NexHudTheme;
  /** Called when a mascot is picked · parent may close the drawer, etc. */
  onSelected?: (mascot: Mascot) => void;
  /** Close the drawer · rendered as the X at the far right of the top bar. */
  onClose?: () => void;
  /** Post a mascot to the chat (green button in the detail overlay). */
  onPostMascot?: (mascot: Mascot) => void;
}

export function NexMascotDrawerContent({ theme, onSelected, onClose, onPostMascot }: Props) {
  const { activeMascotId, setActive } = useActiveMascot();
  const [query, setQuery] = useState("");
  // Tapping a mascot in the grid now opens the detail overlay (frosted-black
  // sheet + red/green action buttons) instead of setting active immediately.
  const [detailMascot, setDetailMascot] = useState<Mascot | null>(null);

  const themeTags = theme.mascot?.recommendedTags ?? [];
  const { recommended, browseAll } = useMemo(
    () => recommendationSplit(theme.id, themeTags, 8),
    [theme.id, themeTags],
  );

  const isSearching = query.trim().length > 0;
  const searchResults = useMemo(() => (isSearching ? searchMascots(query) : []), [isSearching, query]);

  const totalCount = recommended.length + browseAll.length;
  const hasAnyMascots = totalCount > 0;

  function pick(m: Mascot) {
    // Open the detail overlay · selection + chat-post happen from there.
    setDetailMascot(m);
  }

  function handlePost(m: Mascot) {
    setActive(m.id);              // green also persists as active mascot
    onPostMascot?.(m);             // parent appends chat message
    onSelected?.(m);
    setDetailMascot(null);         // close detail
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* TOP BAR · search input (placeholder = "Mascots" · replaces the
          drawer's default title) + close X · Philip 2026-08-27. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: -4,
        }}
      >
        <label style={{ position: "relative", display: "block", flex: 1, minWidth: 0 }}>
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: 12,
              transform: "translateY(-50%)",
              color: NEX.textMuted,
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mascots"
            aria-label="Search mascots"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 12px 9px 34px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${NEX.borderMuted}`,
              color: NEX.text,
              fontSize: 13,
              outline: "none",
              WebkitAppearance: "none",
            }}
          />
        </label>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              width: 32,
              height: 32,
              flex: "0 0 32px",
              borderRadius: "50%",
              background: NEX.bgSurface,
              border: `1px solid ${NEX.borderMuted}`,
              color: NEX.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Empty-state · honest, no invented artwork */}
      {!hasAnyMascots && (
        <div
          role="status"
          style={{
            padding: "28px 12px",
            textAlign: "center",
            color: NEX.textMuted,
            fontSize: 13,
            lineHeight: 1.5,
            border: `1px dashed ${NEX.borderMuted}`,
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ fontSize: 15, color: NEX.text, marginBottom: 6 }}>
            Mascots are on their way
          </div>
          <div>
            Your NEX will get personality here as soon as the mascot library ships.
          </div>
        </div>
      )}

      {/* Search results · flat grid */}
      {hasAnyMascots && isSearching && (
        <section aria-label="Search results">
          <SectionHeading theme={theme}>
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{query}”
          </SectionHeading>
          {searchResults.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: NEX.textMuted, fontSize: 13 }}>
              No mascots match. Try a different tag.
            </div>
          ) : (
            <MascotGrid mascots={searchResults} activeId={activeMascotId} onPick={pick} theme={theme} />
          )}
        </section>
      )}

      {/* Recommended · theme-relevant */}
      {hasAnyMascots && !isSearching && recommended.length > 0 && (
        <section aria-label="Recommended for you">
          <SectionHeading theme={theme}>
            Recommended for you
          </SectionHeading>
          <MascotGrid mascots={recommended} activeId={activeMascotId} onPick={pick} theme={theme} />
        </section>
      )}

      {/* Browse All · full library */}
      {hasAnyMascots && !isSearching && browseAll.length > 0 && (
        <section aria-label="Browse all mascots">
          <SectionHeading theme={theme}>
            Browse all
          </SectionHeading>
          <MascotGrid mascots={browseAll} activeId={activeMascotId} onPick={pick} theme={theme} />
        </section>
      )}

      {/* Detail overlay · sci-fi frosted sheet with red/green action buttons.
          Renders in-drawer · scoped to the drawer's coordinate system so it
          doesn't escape the phone silhouette. */}
      <NexMascotDetail
        mascot={detailMascot}
        theme={theme}
        onClose={() => setDetailMascot(null)}
        onPost={handlePost}
      />
    </div>
  );
}

// ── Presentation primitives ────────────────────────────────────────────────

function SectionHeading({ children, theme }: { children: React.ReactNode; theme: NexHudTheme }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: theme.accents.onDarkMuted,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function SectionSubheading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: -6, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function MascotGrid({
  mascots, activeId, onPick, theme,
}: {
  mascots: Mascot[];
  activeId: string | null;
  onPick: (m: Mascot) => void;
  theme: NexHudTheme;
}) {
  return (
    <div
      role="listbox"
      aria-label="Mascots"
      style={{
        // Philip 2026-08-27 v8 · GRID · exactly 3 columns on every viewport ·
        // items centered in their cell · equal 18px column gap + 14px row gap.
        // Guarantees 3-per-row regardless of drawer width.
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        justifyItems: "center",
        alignItems: "center",
        columnGap: 18,
        rowGap: 14,
        marginBottom: 14,
        // Philip 2026-08-27 v9 · shift the whole row 8px left · asymmetric
        // padding (6L / 22R) achieves this without a transform hack.
        paddingLeft: 6,
        paddingRight: 22,
      }}
    >
      {mascots.map((m) => (
        <MascotCard
          key={m.id}
          mascot={m}
          selected={m.id === activeId}
          onSelect={() => onPick(m)}
          theme={theme}
        />
      ))}
    </div>
  );
}

/**
 * Reusable mascot card · Philip 2026-08-27 · CONTAINERLESS.
 * No tile background · no border · no rounded card. The mascot artwork IS
 * the card. Selection = accent-ring around the image + tiny check dot.
 * Free-standing images read as characters, not gallery thumbnails.
 */
export function MascotCard({
  mascot, selected, onSelect, theme,
}: {
  mascot: Mascot;
  selected: boolean;
  onSelect: () => void;
  theme: NexHudTheme;
}) {
  // Philip 2026-08-27 · orange glow removed · no orange indicator after
  // picking or cancelling a mascot. Selection has no visual differentiation
  // on the grid tile (state persists via useActiveMascot / detail overlay).
  const selectionGlow = "none";
  void selected; void theme;   // avoid unused-warning after removal
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={mascot.name}
      onClick={onSelect}
      style={{
        appearance: "none",
        position: "relative",
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        // Philip 2026-08-27 v8 · NO square container · button wraps tightly
        // around the image · width/height determined by the img itself
        // (fixed 56px height · natural aspect width). No aspectRatio, no
        // fixed 56x56 box, no invisible square footprint around the mascot.
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        transition: "transform 120ms ease, filter 160ms ease",
        filter: selected ? "none" : "brightness(1)",
      }}
      onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {mascot.hasArtwork ? (
        <motion.img
          layoutId={`mascot-img-${mascot.id}`}
          src={mascot.thumb ?? mascot.asset}
          alt={mascot.name}
          loading="lazy"
          decoding="async"
          style={{
            // Height locked · width auto so each character keeps its natural
            // aspect ratio · no square container framing them into tiles.
            height: 56,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
            boxShadow: selectionGlow,
            transition: "box-shadow 160ms ease",
          }}
        />
      ) : (
        <span style={{ fontSize: 9, color: NEX.textMuted, textAlign: "center", padding: 2, lineHeight: 1.15 }}>
          {mascot.name}
          <br />
          <span style={{ fontSize: 8, opacity: 0.55 }}>pending</span>
        </span>
      )}
      {/* Selection check-dot removed · Philip 2026-08-27 · no orange
          indicator after selecting or cancelling a mascot. */}
    </button>
  );
}
