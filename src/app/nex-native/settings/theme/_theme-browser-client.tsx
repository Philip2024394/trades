"use client";

// Interactive theme browser · search + filter + grid + enlarge modal.
// Server hands over the full theme list, the current active theme, and
// whether the caller can use premium (bisnis tier). Everything else
// happens client-side · filtering, search, previewing, tier gating.

import * as React from "react";
import { createPortal } from "react-dom";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSolid: "rgba(3,16,29,0.96)",
  fieldBg: "rgba(4,20,36,0.85)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  cyanFaint: "rgba(0,175,255,0.14)",
  cyanBorder: "rgba(0,175,255,0.35)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export interface BrowserThemeRow {
  id: string;
  name: string;
  tagline: string | null;
  accent_hex: string;
  tier: "gratis" | "bisnis";
  category: "standard" | "premium";
  hero_image_url: string | null;
  sort_order: number;
}

type FilterMode = "all" | "gratis" | "bisnis";

interface Props {
  themes: BrowserThemeRow[];
  currentThemeId: string;
  canUsePremium: boolean;
  activateAction: (formData: FormData) => Promise<never> | void | Promise<void>;
}

export function ThemeBrowserClient({
  themes,
  currentThemeId,
  canUsePremium,
  activateAction,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterMode>("all");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return themes.filter((t) => {
      if (filter === "gratis" && t.tier !== "gratis") return false;
      if (filter === "bisnis" && t.tier !== "bisnis") return false;
      if (q.length === 0) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.tagline ?? "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [themes, query, filter]);

  const preview = previewId
    ? themes.find((t) => t.id === previewId) ?? null
    : null;

  const filterBadge = filter !== "all" ? 1 : 0;

  return (
    <>
      {/* Search + filter row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 14px 0 40px",
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanBorder}`,
            borderRadius: 12,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: NEX.textMute,
              display: "grid",
              placeItems: "center",
            }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NEX themes"
            style={{
              flex: 1,
              minHeight: 42,
              background: "transparent",
              color: NEX.text,
              border: "none",
              outline: "none",
              fontSize: 15,
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.42)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: NEX.text,
                cursor: "pointer",
                padding: 0,
                display: "grid",
                placeItems: "center",
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-label="Filter themes"
          aria-expanded={filterOpen}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: filter !== "all" ? NEX.cyanFaint : NEX.fieldBg,
            border: `1px solid ${filter !== "all" ? NEX.cyan : NEX.cyanBorder}`,
            color: NEX.text,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <FilterIcon />
          {filterBadge > 0 && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                minWidth: 14,
                height: 14,
                borderRadius: 999,
                background: NEX.orange,
                color: "#0B0F1A",
                fontSize: 9,
                fontWeight: 700,
                display: "grid",
                placeItems: "center",
                padding: "0 3px",
                boxShadow: "0 0 6px rgba(255,120,0,0.6)",
              }}
            >
              {filterBadge}
            </span>
          )}
        </button>
      </div>

      {/* Filter drawer (inline expansion) */}
      {filterOpen && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 12,
            background: NEX.panel,
            border: `1px solid ${NEX.cyanBorder}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.textDim,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Filter by
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FilterChip
              label="All"
              selected={filter === "all"}
              onClick={() => {
                setFilter("all");
                setFilterOpen(false);
              }}
            />
            <FilterChip
              label="Free"
              accent={NEX.green}
              selected={filter === "gratis"}
              onClick={() => {
                setFilter("gratis");
                setFilterOpen(false);
              }}
            />
            <FilterChip
              label="Premium"
              accent={NEX.orange}
              selected={filter === "bisnis"}
              onClick={() => {
                setFilter("bisnis");
                setFilterOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Result count + active hint */}
      <div
        style={{
          fontSize: 11,
          color: NEX.textMute,
          marginBottom: 12,
          letterSpacing: "0.04em",
        }}
      >
        {filtered.length} {filtered.length === 1 ? "theme" : "themes"}
        {filter !== "all" && (
          <>
            {" · "}
            <span style={{ color: NEX.textDim }}>
              filtered to {filter === "gratis" ? "Free" : "Premium"}
            </span>
          </>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyResult />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((t) => (
            <ThemeGridCard
              key={t.id}
              theme={t}
              active={t.id === currentThemeId}
              locked={t.tier === "bisnis" && !canUsePremium}
              onOpen={() => setPreviewId(t.id)}
            />
          ))}
        </div>
      )}

      {/* Enlarge preview modal · portaled to body to escape any parent
          stacking context. */}
      {preview && mounted &&
        createPortal(
          <PreviewModal
            theme={preview}
            active={preview.id === currentThemeId}
            locked={preview.tier === "bisnis" && !canUsePremium}
            activateAction={activateAction}
            onClose={() => setPreviewId(null)}
          />,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Grid card
// ---------------------------------------------------------------------------

function ThemeGridCard({
  theme,
  active,
  locked,
  onOpen,
}: {
  theme: BrowserThemeRow;
  active: boolean;
  locked: boolean;
  onOpen: () => void;
}) {
  const rgb = hexToRgb(theme.accent_hex);
  const glow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.25)`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Preview ${theme.name}${locked ? " (Bisnis-only)" : ""}`}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: 0,
        borderRadius: 14,
        background: NEX.panel,
        border: active
          ? `1px solid ${theme.accent_hex}`
          : `1px solid ${NEX.cyanBorder}`,
        boxShadow: active ? `0 0 18px ${glow}` : "none",
        cursor: "pointer",
        overflow: "hidden",
        color: NEX.text,
        transition: "transform 120ms ease, border-color 160ms ease",
      }}
    >
      <ThemeSwatch theme={theme} />
      <div style={{ padding: "8px 10px 10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {theme.name}
          </span>
          {active ? (
            <span
              style={{
                fontSize: 8,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 999,
                background: `${theme.accent_hex}33`,
                color: theme.accent_hex,
              }}
            >
              Active
            </span>
          ) : locked ? (
            <span aria-hidden style={{ color: NEX.orange, display: "grid", placeItems: "center" }}>
              <LockIcon />
            </span>
          ) : null}
        </div>
        {theme.tagline && (
          <div
            style={{
              fontSize: 10,
              color: NEX.textDim,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {theme.tagline}
          </div>
        )}
      </div>
    </button>
  );
}

function ThemeSwatch({ theme }: { theme: BrowserThemeRow }) {
  return (
    <div
      style={{
        position: "relative",
        height: 96,
        background: theme.hero_image_url
          ? `url(${theme.hero_image_url})`
          : NEX.bg,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderBottom: `1px solid ${theme.accent_hex}44`,
      }}
    >
      {!theme.hero_image_url && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 14,
              left: 12,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: theme.accent_hex,
              boxShadow: `0 0 16px ${theme.accent_hex}66`,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 16,
              right: 12,
              left: 52,
              height: 18,
              borderRadius: 9,
              background: "rgba(8,20,36,0.55)",
              border: `1px solid ${theme.accent_hex}80`,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 14,
              left: 24,
              right: 12,
              height: 18,
              borderRadius: 9,
              background: "rgba(12,32,58,0.62)",
              border: `1px solid ${theme.accent_hex}D9`,
            }}
          />
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  selected,
  onClick,
  accent,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  accent?: string;
}) {
  const c = accent ?? NEX.cyan;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: selected ? `${c}22` : "transparent",
        border: `1px solid ${selected ? c : "rgba(255,255,255,0.1)"}`,
        color: selected ? c : NEX.textDim,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Enlarge preview modal
// ---------------------------------------------------------------------------

function PreviewModal({
  theme,
  active,
  locked,
  activateAction,
  onClose,
}: {
  theme: BrowserThemeRow;
  active: boolean;
  locked: boolean;
  activateAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rgb = hexToRgb(theme.accent_hex);
  const outgoingRim = `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
  const incomingRim = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
  const glow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`;

  return (
    <>
      <style>{`
        @keyframes nex-theme-modal-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      <div
        role="button"
        aria-label="Close preview"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.75)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 900,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${theme.name}`}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(360px, calc(100vw - 24px))",
          maxHeight: "min(88vh, 720px)",
          background: NEX.panelSolid,
          border: `1px solid ${outgoingRim}`,
          borderRadius: 24,
          zIndex: 901,
          padding: 0,
          overflow: "hidden",
          animation: "nex-theme-modal-in 220ms cubic-bezier(.2,.7,.2,1) both",
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 24px 60px rgba(0,0,0,0.65), 0 0 60px ${glow}`,
          color: NEX.text,
          fontFamily: "inherit",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${outgoingRim}55`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: theme.accent_hex,
              boxShadow: `0 0 18px ${glow}`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{theme.name}</div>
            <div
              style={{
                fontSize: 10,
                color: NEX.textMute,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.02em",
              }}
            >
              {theme.accent_hex}
            </div>
          </div>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              background:
                theme.tier === "bisnis"
                  ? "rgba(255,120,0,0.18)"
                  : "rgba(22,214,107,0.18)",
              color: theme.tier === "bisnis" ? NEX.orange : NEX.green,
            }}
          >
            {theme.tier === "bisnis" ? "Bisnis" : "Free"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body · enlarged phone preview */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 0",
          }}
        >
          {theme.tagline && (
            <div
              style={{
                fontSize: 13,
                color: NEX.textDim,
                lineHeight: 1.5,
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              {theme.tagline}
            </div>
          )}

          <div
            style={{
              borderRadius: 18,
              background: theme.hero_image_url
                ? `url(${theme.hero_image_url}) center/cover no-repeat, ${NEX.bg}`
                : NEX.bg,
              border: `1px solid ${outgoingRim}44`,
              padding: 14,
              minHeight: 260,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {theme.hero_image_url && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, transparent 20%, rgba(2,9,20,0.55) 50%, rgba(2,9,20,0.92) 100%)",
                }}
              />
            )}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <MockBubble mine={false} rim={incomingRim}>
                Hey! Just saw your latest post. Looks amazing 👋
              </MockBubble>
              <MockBubble mine={true} rim={outgoingRim}>
                Thanks! Really happy with how it turned out.
              </MockBubble>
              <MockBubble mine={false} rim={incomingRim}>
                Love the colours. More styles soon?
              </MockBubble>
              <MockBubble mine={true} rim={outgoingRim}>
                Yes! New collection dropping this weekend.
              </MockBubble>
            </div>
            {/* Mock composer */}
            <div
              style={{
                marginTop: 14,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 12,
                background: "rgba(12,32,58,0.62)",
                border: `1px solid ${outgoingRim}`,
                boxShadow: `0 0 12px ${glow}`,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.42)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: NEX.textDim,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                }}
              >
                +
              </span>
              <span style={{ flex: 1, color: NEX.textMute, fontSize: 12 }}>
                Message…
              </span>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: NEX.orange,
                  color: "#0B0F1A",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                ➤
              </span>
            </div>
          </div>
        </div>

        {/* Footer · CTA */}
        <div
          style={{
            padding: "14px 16px calc(env(safe-area-inset-bottom, 0) + 14px)",
            borderTop: `1px solid ${outgoingRim}33`,
          }}
        >
          {active ? (
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                padding: "12px",
                borderRadius: 10,
                background: `${theme.accent_hex}22`,
                border: `1px solid ${theme.accent_hex}`,
                color: theme.accent_hex,
              }}
            >
              ✓ Currently active on your NEX
            </div>
          ) : locked ? (
            <a
              href="/nex-native/settings/tier"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px",
                borderRadius: 10,
                background: NEX.orange,
                color: "#0B0F1A",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              Upgrade to NEX Bisnis to unlock →
            </a>
          ) : (
            <form action={activateAction}>
              <input type="hidden" name="chat_theme" value={theme.id} />
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  background: theme.accent_hex,
                  color: "#0B0F1A",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                Use this theme
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function MockBubble({
  mine,
  rim,
  children,
}: {
  mine: boolean;
  rim: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "80%",
        padding: "9px 12px",
        borderRadius: 14,
        background: mine ? "rgba(12,32,58,0.62)" : "rgba(8,20,36,0.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${rim}`,
        color: NEX.text,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}

function EmptyResult() {
  return (
    <div
      style={{
        margin: "24px auto",
        maxWidth: 320,
        textAlign: "center",
        color: NEX.textDim,
        fontSize: 13,
        padding: "20px 12px",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
      No themes match. Try a different search or filter.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden {...strokeProps} strokeWidth={2.4}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      aria-hidden
      {...strokeProps}
      strokeWidth={2.2}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 118 0v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full || "009FEF", 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}
