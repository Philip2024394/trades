// src/components/nexapp/CategoryConstellation.tsx
//
// Country Foundation Step 7 · Part B · Phase 7B.2 · 2026-08-23.
//
// The CategoryConstellation is NEX's living discovery layer. Category nodes
// orbit around the central NEX identity, glowing with the ambient NEX energy.
// Selecting a node transitions into an in-panel focused conversation with NEX
// scoped to that category — NOT a navigation to an old directory page.
//
// Constitutional doctrine (must never violate):
//   · Registry-driven · reads `activeCategoriesForCountry(userCountry)` · never
//     hardcodes a category slug/label/glyph anywhere in this file.
//   · Truth Invariant · GB user sees zero registry nodes (empty-country state)
//     because no Registry entry currently declares GB in its countries[].
//   · The chat area and category constellation are ONE experience · selecting a
//     node reveals a focused conversation surface, not another panel.
//   · Motion is restrained + premium · communicates state, not decoration.
//   · Scales to hundreds of categories via Registry alone · no per-category
//     hand-coded visual hacks.
//
// Cross-refs:
//   project_nex_category_wheel_experience_doctrine_2026_08_22 (Step 7 Part B · Direction A)
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 7)
//   project_nex_country_scope_from_phone_country_code_2026_08_22 (Four-Country model)
//   project_nex_truth_invariant_2026_08_22 (no invented tiles)
//   project_nex_should_know_not_ask_2026_08_21 (no country picker in the wheel)

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { NEX } from "@/lib/nexapp/tokens";
import { activeCategoriesForCountry, type CategoryEntry } from "@/lib/nex/category-registry";
import type { NexState } from "./NexAppHome";
import { CategoryBusinessCard } from "./CategoryBusinessCard";
import type { DirectoryListing } from "@/app/api/nex-directory/listings/route";

// ═══════════════════════════════════════════════════════════════════════
// Pure helpers (exported for unit tests · no React · no rendering)
// ═══════════════════════════════════════════════════════════════════════

/** Deterministic orbital layout for N nodes around the central NEX orb.
 *  Returns unit-space coordinates in [-1, 1] × [-1, 1] with center at (0, 0).
 *  Caller scales into container coordinates.
 *
 *  N=0 → empty. N=1 → single node above centre (12 o'clock).
 *  N≥2 → evenly distributed on a circle of radius 0.9, starting from 12 o'clock
 *        and progressing clockwise. */
export function layoutNodes(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: -0.85 }];
  const positions: Array<{ x: number; y: number }> = [];
  const radius = 0.9;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    positions.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return positions;
}

/** Family-based accent color · subtle tint, never overrides NEX orange identity.
 *  Free-form string mapping — Registry entries opt in via `visual.family`.
 *  Unknown families fall back to the default NEX orange. */
export function familyAccent(family: string | undefined): string {
  switch (family) {
    case "food":          return "rgba(249, 115, 22, 1.0)";   // NEX orange (primary)
    case "accommodation": return "rgba(255, 165, 90, 1.0)";   // warm amber
    default:              return "rgba(249, 115, 22, 1.0)";
  }
}

/** Vertical centre of the constellation as % of container height.
 *  Refinement 2026-08-23 (Philip screenshot review): shifted from 50 → 42 so the
 *  whole cluster sits ~24 px higher in a 340-px container. Result: bottom nodes
 *  (Hostel/Hotel at ~78% vs previous 86%) have clear breathing room above the
 *  chat input · all labels visible · no clipping. Central NEX orb and orbital
 *  layout both anchor to this value so they stay perfectly aligned. */
const CONSTELLATION_CENTER_Y_PCT = 42;

/** Resolve a lucide glyph name (from Registry `visual.glyph`) to a lucide
 *  icon component. Falls back to Circle if the name isn't a known lucide export. */
function resolveGlyph(glyphName: string): LucideIcon {
  const iconMap = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
  return iconMap[glyphName] ?? LucideIcons.Circle;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 7B.3 · NEX conversational response helpers (pure functions)
// Truth Invariant: every response text is grounded in the API result count/reason,
// never invented. Callers pass real data; these functions just format it.
// ═══════════════════════════════════════════════════════════════════════

/** NEX response text when we found real listings. */
export function nexResponseForResults(categoryLabel: string, count: number): string {
  if (count === 1) return `Here's one ${categoryLabel.toLowerCase()} I found for you.`;
  return `Here are ${count} ${categoryLabel.toLowerCase()} places I found for you.`;
}

/** NEX response text when the query returned no listings · truthful, never fabricates. */
export function nexResponseForEmpty(categoryLabel: string, country: string, reason: string | undefined): string {
  if (reason === "no_inventory_in_country") {
    return `I don't have ${categoryLabel.toLowerCase()} listings in ${country} yet.`;
  }
  if (reason === "category_inactive") {
    return `I understand ${categoryLabel.toLowerCase()}, but that category isn't ready yet in NEX.`;
  }
  if (reason === "unsupported_vertical") {
    return `${categoryLabel} isn't wired to a data source yet — coming soon.`;
  }
  // no_visible_listings or unknown reason
  return `I couldn't find any visible ${categoryLabel.toLowerCase()} places right now.`;
}

/** NEX response text when the fetch itself failed (network/server). */
export function nexResponseForError(): string {
  return "I couldn't reach my directory just now — please try again in a moment.";
}

// ═══════════════════════════════════════════════════════════════════════
// Motion profiles per NEX state · quiet idle · reactive listening/thinking/speaking
// ═══════════════════════════════════════════════════════════════════════

interface MotionProfile {
  breathScale: number;
  breathDuration: number;
  glowOpacity: number;
}

const MOTION_PROFILES: Record<NexState, MotionProfile> = {
  idle:      { breathScale: 1.02, breathDuration: 6.5, glowOpacity: 0.40 },
  listening: { breathScale: 1.04, breathDuration: 2.2, glowOpacity: 0.75 },
  thinking:  { breathScale: 1.03, breathDuration: 3.5, glowOpacity: 0.55 },
  speaking:  { breathScale: 1.06, breathDuration: 1.8, glowOpacity: 0.90 },
};

// ═══════════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════════

export interface CategoryConstellationProps {
  /** ISO 3166-1 alpha-2 · current-market country per Four-Country doctrine.
   *  Filters Registry via activeCategoriesForCountry. */
  userCountry: string;

  /** NEX ambient state · nodes breathe with the surrounding NEX energy. */
  nexState: NexState;

  /** Currently focused category (null = discovery view). */
  activeCategorySlug: string | null;

  /** Callback fired when user selects a category (or deselects with null). */
  onSelectCategory: (slug: string | null) => void;

  /** OPTIONAL · Brain-derived recognized category id from live conversation.
   *  When NEX detects the user is talking about a category, this node pulses
   *  distinctly to signal "I heard you." Wired in a future phase — pass null
   *  for now. */
  recognizedCategoryId?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// Root component
// ═══════════════════════════════════════════════════════════════════════

export function CategoryConstellation(props: CategoryConstellationProps) {
  const { userCountry, nexState, activeCategorySlug, onSelectCategory, recognizedCategoryId } = props;

  const categories = useMemo(() => activeCategoriesForCountry(userCountry), [userCountry]);
  const positions = useMemo(() => layoutNodes(categories.length), [categories.length]);
  const selected = categories.find((c) => c.id === activeCategorySlug) ?? null;

  // Truth Invariant: honest empty state when no active categories in this country
  if (categories.length === 0) {
    return <EmptyConstellation userCountry={userCountry} />;
  }

  // Focused conversation view when a category is selected
  if (selected) {
    return (
      <FocusedCategoryView
        category={selected}
        nexState={nexState}
        userCountry={userCountry}
        onDeselect={() => onSelectCategory(null)}
      />
    );
  }

  // Discovery view · constellation of orbiting nodes around the NEX orb
  return (
    <div style={containerStyle} data-testid="category-constellation" data-nex-state={nexState}>
      <CenterNexOrb nexState={nexState} />
      {categories.map((cat, i) => {
        const pos = positions[i]!;
        const isRecognized = cat.id === recognizedCategoryId;
        return (
          <CategoryNode
            key={cat.id}
            category={cat}
            position={pos}
            nexState={nexState}
            recognized={isRecognized}
            onClick={() => onSelectCategory(cat.id)}
          />
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Central NEX identity orb · breathes with NEX energy
// ═══════════════════════════════════════════════════════════════════════

function CenterNexOrb({ nexState }: { nexState: NexState }) {
  const profile = MOTION_PROFILES[nexState];
  return (
    <motion.div
      // top overridden to CONSTELLATION_CENTER_Y_PCT so the orb sits at the
      // same vertical anchor as the surrounding nodes (see the constant's doc).
      style={{ ...centerOrbStyle, top: `${CONSTELLATION_CENTER_Y_PCT}%` }}
      animate={{ scale: [1, profile.breathScale, 1] }}
      transition={{ duration: profile.breathDuration, ease: "easeInOut", repeat: Infinity }}
      aria-label="NEX intelligence"
    >
      <motion.div
        style={centerGlowStyle}
        animate={{ opacity: [profile.glowOpacity * 0.6, profile.glowOpacity, profile.glowOpacity * 0.6] }}
        transition={{ duration: profile.breathDuration, ease: "easeInOut", repeat: Infinity }}
      />
      <div style={centerMarkStyle} aria-hidden>
        <span>NE</span>
        <span style={{ color: NEX.orange, marginLeft: 1 }}>X</span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Category node · one orbiting glyph
// ═══════════════════════════════════════════════════════════════════════

function CategoryNode({
  category,
  position,
  nexState,
  recognized,
  onClick,
}: {
  category: CategoryEntry;
  position: { x: number; y: number };
  nexState: NexState;
  recognized: boolean;
  onClick: () => void;
}) {
  const Icon = resolveGlyph(category.visual.glyph);
  const accent = familyAccent(category.visual.family);
  const profile = MOTION_PROFILES[nexState];

  const breathTarget = recognized ? profile.breathScale * 1.15 : profile.breathScale;
  const glowOpacity = recognized
    ? Math.min(1, profile.glowOpacity * 1.5)
    : profile.glowOpacity;

  // Convert unit coords (-1..1) to CSS percentages inside the container.
  // Using 40% keeps nodes clear of the container edges.
  // Vertical centre uses CONSTELLATION_CENTER_Y_PCT (42) rather than 50 so the
  // whole cluster sits higher — see the constant's doc comment.
  const leftPct = 50 + position.x * 40;
  const topPct = CONSTELLATION_CENTER_Y_PCT + position.y * 40;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      style={{
        ...nodeButtonStyle,
        left: `${leftPct}%`,
        top: `${topPct}%`,
      }}
      data-category-id={category.id}
      data-recognized={recognized ? "true" : "false"}
      aria-label={`Discover ${category.displayName.en}`}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      animate={{ scale: [1, breathTarget, 1] }}
      transition={{ duration: profile.breathDuration, ease: "easeInOut", repeat: Infinity }}
    >
      <motion.div
        style={{
          ...nodeGlowStyle,
          background: `radial-gradient(circle, ${accent.replace("1.0", String(glowOpacity * 0.55))} 0%, transparent 70%)`,
        }}
      />
      <div style={nodeBodyStyle}>
        <Icon size={22} strokeWidth={1.6} color={accent} />
      </div>
      <div style={nodeLabelStyle}>{category.displayName.en}</div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Focused category view · in-panel conversation surface for the selected category
// ═══════════════════════════════════════════════════════════════════════

// ─── In-panel conversation message shape (local to focused view) ───

type ConvMessage =
  | { kind: "user"; id: string; text: string }
  | { kind: "nex";  id: string; text: string }
  | { kind: "results"; id: string; listings: DirectoryListing[] };

function FocusedCategoryView({
  category,
  nexState,
  userCountry,
  onDeselect,
}: {
  category: CategoryEntry;
  nexState: NexState;
  userCountry: string;
  onDeselect: () => void;
}) {
  const Icon = resolveGlyph(category.visual.glyph);
  const accent = familyAccent(category.visual.family);
  const profile = MOTION_PROFILES[nexState];

  // Conversation state · seeded with NEX opening prompt (grounded, no fabrication)
  const [messages, setMessages] = useState<ConvMessage[]>(() => [
    {
      kind: "nex",
      id: "opening",
      text: `What are you looking for in ${category.displayName.en.toLowerCase()}?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { kind: "user", id: userId, text }]);
    setInput("");
    setIsThinking(true);

    try {
      const url = `/api/nex-directory/listings?category=${encodeURIComponent(category.id)}&country=${encodeURIComponent(userCountry)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        listings?: DirectoryListing[];
        reason?: string;
      };

      const nexId = `n-${Date.now()}`;
      if (data.ok && data.listings && data.listings.length > 0) {
        const resultsId = `r-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { kind: "nex", id: nexId, text: nexResponseForResults(category.displayName.en, data.listings!.length) },
          { kind: "results", id: resultsId, listings: data.listings! },
        ]);
      } else if (data.ok) {
        setMessages((prev) => [
          ...prev,
          { kind: "nex", id: nexId, text: nexResponseForEmpty(category.displayName.en, userCountry, data.reason) },
        ]);
      } else {
        setMessages((prev) => [...prev, { kind: "nex", id: nexId, text: nexResponseForError() }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { kind: "nex", id: `n-${Date.now()}`, text: nexResponseForError() },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, category.id, category.displayName.en, userCountry]);

  return (
    <div style={focusedContainerStyle} data-testid="focused-category" data-category-id={category.id}>
      {/* Category header (glyph + name) */}
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={focusedHeaderStyle}
      >
        <motion.div
          style={{
            ...focusedGlowStyle,
            background: `radial-gradient(circle, ${accent.replace("1.0", String(profile.glowOpacity * 0.6))} 0%, transparent 70%)`,
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: profile.breathDuration, ease: "easeInOut", repeat: Infinity }}
        />
        <div style={focusedGlyphStyle}>
          <Icon size={28} strokeWidth={1.5} color={accent} />
        </div>
        <div style={focusedTitleStyle}>{category.displayName.en}</div>
      </motion.div>

      {/* Conversation stream · scrollable · newest at bottom */}
      <div style={messagesScrollStyle} data-testid="focused-messages">
        {messages.map((m) => {
          if (m.kind === "user") return <UserBubble key={m.id} text={m.text} />;
          if (m.kind === "nex") return <NexBubble key={m.id} text={m.text} />;
          // results
          return (
            <div key={m.id} style={resultsListStyle} data-testid="focused-results">
              {m.listings.map((l, i) => (
                <CategoryBusinessCard
                  key={l.publicListingRef}
                  listing={l}
                  familyAccent={accent}
                  index={i}
                />
              ))}
            </div>
          );
        })}
        {isThinking && <ThinkingBubble />}
        <div ref={messagesEndRef} />
      </div>

      {/* Live input · Enter to submit */}
      <div style={focusedInputWrapStyle}>
        <input
          type="text"
          placeholder={`Ask NEX about ${category.displayName.en.toLowerCase()}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isThinking}
          style={focusedInputStyle}
          aria-label={`Ask NEX about ${category.displayName.en}`}
          autoFocus
        />
      </div>

      {/* Back to constellation */}
      <motion.button
        type="button"
        onClick={onDeselect}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        whileHover={{ opacity: 1 }}
        style={focusedBackStyle}
        aria-label="Return to category constellation"
      >
        ← All categories
      </motion.button>
    </div>
  );
}

// ─── Conversation bubble sub-components (inside focused view) ───

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={userBubbleStyle}
    >
      {text}
    </motion.div>
  );
}

function NexBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={nexBubbleWrapStyle}
    >
      <span style={nexBadgeSmallStyle} aria-hidden>NEX</span>
      <span style={nexBubbleTextStyle}>{text}</span>
    </motion.div>
  );
}

function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={nexBubbleWrapStyle}
      data-testid="focused-thinking"
    >
      <span style={nexBadgeSmallStyle} aria-hidden>NEX</span>
      <span style={thinkingDotsWrapStyle}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            style={thinkingDotStyle}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, delay: i * 0.15, ease: "easeInOut", repeat: Infinity }}
          />
        ))}
      </span>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Empty-country state · honest zero when Registry has no active categories for the country
// ═══════════════════════════════════════════════════════════════════════

function EmptyConstellation({ userCountry }: { userCountry: string }) {
  return (
    <div
      style={{ ...containerStyle, alignItems: "center", justifyContent: "center", display: "flex", flexDirection: "column" }}
      data-testid="constellation-empty"
      data-user-country={userCountry}
    >
      <CenterNexOrb nexState="idle" />
      <div style={emptyMessageStyle}>
        NEX doesn&apos;t have categories in <strong style={{ color: NEX.text }}>{userCountry}</strong> yet.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Styles · dark NEX aesthetic · orange energy · subtle depth
// ═══════════════════════════════════════════════════════════════════════

const containerStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 340,
  width: "100%",
  overflow: "hidden",
};

const centerOrbStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 76,
  height: 76,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${NEX.bgSurfaceHi} 0%, ${NEX.bg} 92%)`,
  border: `1px solid ${NEX.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2,
  boxShadow: `0 0 24px ${NEX.orangeGlowLo}, inset 0 0 12px rgba(0,0,0,0.5)`,
};

const centerGlowStyle: CSSProperties = {
  position: "absolute",
  inset: -18,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${NEX.orangeGlow} 0%, transparent 70%)`,
  filter: "blur(10px)",
  pointerEvents: "none",
  zIndex: -1,
};

const centerMarkStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: 0.5,
  color: NEX.text,
  lineHeight: 1,
  zIndex: 1,
  position: "relative",
};

const nodeButtonStyle: CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  zIndex: 1,
};

const nodeGlowStyle: CSSProperties = {
  position: "absolute",
  inset: -10,
  borderRadius: "50%",
  filter: "blur(7px)",
  pointerEvents: "none",
  zIndex: -1,
};

const nodeBodyStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: `linear-gradient(180deg, rgba(21,21,21,0.92) 0%, rgba(13,13,13,0.88) 100%)`,
  border: `1px solid rgba(249, 115, 22, 0.28)`,
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  zIndex: 1,
  boxShadow: `0 4px 12px rgba(0,0,0,0.4)`,
};

const nodeLabelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 500,
  color: NEX.text,
  letterSpacing: 0.2,
  textAlign: "center",
  maxWidth: 88,
  lineHeight: 1.25,
  marginTop: 3,
  textShadow: `0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)`,
  opacity: 0.85,
};

// ── Focused view styles ──

const focusedContainerStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 340,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "56px 20px 20px",
};

const focusedHeaderStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginBottom: 24,
};

const focusedGlowStyle: CSSProperties = {
  position: "absolute",
  width: 90,
  height: 90,
  borderRadius: "50%",
  top: -8,
  left: "50%",
  transform: "translateX(-50%)",
  filter: "blur(12px)",
  pointerEvents: "none",
  zIndex: 0,
};

const focusedGlyphStyle: CSSProperties = {
  width: 62,
  height: 62,
  borderRadius: "50%",
  background: `linear-gradient(180deg, rgba(21,21,21,0.95) 0%, rgba(13,13,13,0.9) 100%)`,
  border: `1px solid rgba(249, 115, 22, 0.32)`,
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: `0 6px 16px rgba(0,0,0,0.5)`,
  zIndex: 1,
  position: "relative",
};

const focusedTitleStyle: CSSProperties = {
  fontSize: 19,
  fontWeight: 600,
  color: NEX.text,
  letterSpacing: -0.2,
  marginTop: 10,
  zIndex: 1,
  position: "relative",
};

const focusedMessageStyle: CSSProperties = {
  fontSize: 14,
  color: NEX.text,
  textAlign: "center",
  lineHeight: 1.55,
  marginBottom: 18,
  maxWidth: 300,
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  justifyContent: "center",
  flexWrap: "wrap",
};

const focusedNexBadgeStyle: CSSProperties = {
  color: NEX.orange,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 2.5,
};

const focusedInputWrapStyle: CSSProperties = {
  width: "100%",
  maxWidth: 320,
  marginBottom: 22,
};

const focusedInputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "rgba(21, 21, 21, 0.85)",
  border: `1px solid ${NEX.borderMuted}`,
  borderRadius: 14,
  color: NEX.text,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  backdropFilter: "blur(6px)",
};

const focusedInputHintStyle: CSSProperties = {
  fontSize: 10,
  color: NEX.textFaint,
  marginTop: 8,
  textAlign: "center",
  letterSpacing: 0.2,
};

const focusedBackStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: NEX.textMuted,
  fontSize: 11,
  cursor: "pointer",
  padding: "6px 12px",
  letterSpacing: 0.3,
};

// ── Phase 7B.3 · in-panel conversation stream + bubbles + thinking ──

const messagesScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: "100%",
  maxWidth: 340,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "6px 4px",
  marginBottom: 12,
};

const userBubbleStyle: CSSProperties = {
  alignSelf: "flex-end",
  maxWidth: "82%",
  padding: "8px 12px",
  background: `linear-gradient(180deg, ${NEX.orange} 0%, ${NEX.orangeSoft} 100%)`,
  color: "#0a0a0a",
  borderRadius: "14px 14px 2px 14px",
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.4,
  letterSpacing: -0.1,
  boxShadow: `0 4px 10px rgba(249, 115, 22, 0.18)`,
};

const nexBubbleWrapStyle: CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: "88%",
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "8px 12px",
  background: "rgba(21, 21, 21, 0.75)",
  border: `1px solid ${NEX.borderMuted}`,
  borderRadius: "14px 14px 14px 2px",
  backdropFilter: "blur(6px)",
};

const nexBadgeSmallStyle: CSSProperties = {
  color: NEX.orange,
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: 2,
  paddingTop: 3,
  flex: "0 0 auto",
};

const nexBubbleTextStyle: CSSProperties = {
  fontSize: 13,
  color: NEX.text,
  lineHeight: 1.45,
  flex: 1,
};

const thinkingDotsWrapStyle: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  alignItems: "center",
  paddingTop: 6,
  paddingBottom: 2,
};

const thinkingDotStyle: CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: NEX.orange,
};

const resultsListStyle: CSSProperties = {
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 2,
};

// ── Empty state ──

const emptyMessageStyle: CSSProperties = {
  marginTop: 28,
  textAlign: "center",
  color: NEX.textMuted,
  fontSize: 12.5,
  maxWidth: 260,
  lineHeight: 1.5,
};
