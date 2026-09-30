"use client";

// src/app/nex-native/_cover/primitives.tsx
//
// Cover primitive library · Founder-sealed 2026-09-30.
// -------------------------------------------------------------------
// Every primitive reads CSS custom properties exposed by
// <CoverThemeSkin>. No primitive hardcodes palette values, wallpaper,
// or bubble geometry — they all inherit the theme's visual DNA.
//
// Primitives (this file):
//   · CoverIdentityBadge  · portrait + ping ring + charm + name
//   · CoverChatCTA        · primary action button (accent-filled)
//   · CoverSecondaryCTA   · secondary button (accent-outlined)
//   · CoverSectionHeading · section header with accent underline
//   · CoverProductCard    · one product tile (inherits bubbleStyle)
//   · CoverProductGrid    · N-column responsive grid of cards
//   · CoverIdentityRail   · discovery rail (social + handle + location)
//   · CoverStickyBar      · bottom-fixed conversion bar
//
// Layouts (Café, Restaurant, etc.) COMPOSE these · they do not build
// their own visual primitives. That's the doctrine that keeps a
// Pink Dream × Café cover unmistakably Pink Dream.

import * as React from "react";
import Link from "next/link";

// ─── Charm glyph registry ────────────────────────────────────────────
// One SVG per theme "family." Themes without a bespoke charm get a
// generic diamond so the identity badge is never empty.

function CharmGlyph({
  themeId,
  size = 22,
}: {
  themeId: string;
  size?: number;
}): React.JSX.Element {
  const stroke = "var(--nex-accent)";
  const fill = "var(--nex-accent-faint)";
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    style: { display: "block" },
  };

  // Match by family so 20+ themes don't all need a bespoke SVG.
  if (
    themeId === "pink-dream" ||
    themeId === "twilight-rose" ||
    themeId === "rose-garden" ||
    themeId === "coral-reef"
  ) {
    // Heart
    return (
      <svg {...props}>
        <path
          d="M12 20.5s-7-4.35-9.3-9.05C1.3 8.6 2.8 5.5 5.8 5.5c1.7 0 3.1 0.9 4.2 2.3C11.1 6.4 12.5 5.5 14.2 5.5c3 0 4.5 3.1 3.1 5.95C19 16.15 12 20.5 12 20.5z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={fill}
        />
      </svg>
    );
  }
  if (themeId === "theme-1" || themeId === "arctic-fjord" || themeId === "aurora-ridge" || themeId === "ice-crystal") {
    // Camera
    return (
      <svg {...props}>
        <path
          d="M4 9h3l1.5-2h7L17 9h3v10H4z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={fill}
        />
        <circle cx="12" cy="14" r="3.2" stroke={stroke} strokeWidth="1.6" fill="none" />
      </svg>
    );
  }
  if (themeId === "cyber-grid") {
    // </>
    return (
      <svg {...props}>
        <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 6l-3 12" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (themeId === "cafe" || themeId === "sahara-gold" || themeId === "copper-dusk" || themeId === "desert-ember") {
    // Coffee cup
    return (
      <svg {...props}>
        <path d="M5 10h11v6a3 3 0 01-3 3H8a3 3 0 01-3-3z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" fill={fill} />
        <path d="M16 12h2.5a1.5 1.5 0 010 3H16" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <path d="M8 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (themeId === "forest-whisper" || themeId === "jade-meridian" || themeId === "emerald-city" || themeId === "ocean-depth") {
    // Leaf
    return (
      <svg {...props}>
        <path
          d="M5 19c0-7 4-13 14-14-1 10-7 14-14 14zm0 0c2-3 5-5 9-6"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={fill}
        />
      </svg>
    );
  }
  if (themeId === "cosmic-purple" || themeId === "deep-space") {
    // Star
    return (
      <svg {...props}>
        <path
          d="M12 3l2.4 5.9L20 10l-4.6 3.6L17 20l-5-3.4L7 20l1.6-6.4L4 10l5.6-1.1z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={fill}
        />
      </svg>
    );
  }
  if (themeId === "neon-tokyo" || themeId === "volcanic" || themeId === "sunset-peak") {
    // Bolt
    return (
      <svg {...props}>
        <path
          d="M13 3L4 14h6l-1 7 9-11h-6z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={fill}
        />
      </svg>
    );
  }
  // Generic diamond fallback so identity is never charmless.
  return (
    <svg {...props}>
      <path
        d="M12 3l9 9-9 9-9-9z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={fill}
      />
    </svg>
  );
}

// ─── Identity badge ──────────────────────────────────────────────────

export interface CoverIdentityBadgeProps {
  portraitUrl: string | null;
  name: string;
  subtitle: string;
  themeId: string;
  presenceOnline?: boolean;
  size?: "hero" | "compact";
  /** Founder direction 2026-09-30 · ISO 3166-1 alpha-2 country code
   *  ("ID", "GB", "US"). Renders a small round flag badge in the
   *  bottom-right of the portrait circle where the theme charm used
   *  to sit. Optional · falls back to nothing when absent. */
  countryCode?: string | null;
}

/**
 * Convert an ISO 3166-1 alpha-2 country code to its flag emoji using
 * Unicode regional indicator symbols. Returns null for invalid codes.
 */
function countryCodeToFlagEmoji(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return (
    String.fromCodePoint(A + (trimmed.charCodeAt(0) - base)) +
    String.fromCodePoint(A + (trimmed.charCodeAt(1) - base))
  );
}

export function CoverIdentityBadge(
  props: CoverIdentityBadgeProps,
): React.JSX.Element {
  const isHero = props.size !== "compact";
  // Founder direction 2026-09-30 · shrunk the portrait (hero 88→64,
  // compact 44→36) so long business names have room to breathe. Flag
  // badge + charm scale automatically via the isHero branch. Combined
  // with the 2-line-clamp on the name below, "Maria's Fabulous Café
  // & Vintage Ceramics" reads without overflow.
  const portraitSize = isHero ? 64 : 36;
  return (
    <>
      <style>{`
        @keyframes nex-cover-ping {
          0%   { transform: scale(1);    opacity: 0.55; }
          80%  { transform: scale(1.7);  opacity: 0; }
          100% { transform: scale(1.7);  opacity: 0; }
        }
        [data-nex-cover-ping] {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid var(--nex-accent);
          animation: nex-cover-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        [data-nex-cover-ping-2] { animation-delay: 1s; }
      `}</style>
      <div
        data-nex-cover-rise
        style={{
          display: "flex",
          alignItems: "center",
          gap: isHero ? 14 : 10,
        }}
      >
        <div
          style={{
            position: "relative",
            width: portraitSize,
            height: portraitSize,
            flexShrink: 0,
          }}
        >
          {props.presenceOnline && (
            <>
              <span aria-hidden data-nex-cover-ping />
              <span aria-hidden data-nex-cover-ping data-nex-cover-ping-2 />
            </>
          )}
          <div
            aria-hidden
            style={{
              position: "relative",
              width: portraitSize,
              height: portraitSize,
              borderRadius: "50%",
              backgroundImage: props.portraitUrl
                ? `url(${props.portraitUrl})`
                : `linear-gradient(135deg, var(--nex-accent-soft) 0%, var(--nex-panel) 100%)`,
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              border: "2px solid var(--nex-accent)",
              boxShadow:
                "0 6px 22px rgba(0,0,0,0.45), 0 0 18px var(--nex-accent-glow)",
              display: "grid",
              placeItems: "center",
              color: "var(--nex-text)",
              fontFamily: "var(--nex-font-display)",
              fontWeight: 700,
              fontSize: isHero ? 26 : 16,
            }}
          >
            {!props.portraitUrl && initials(props.name)}
          </div>
          {/* Founder direction 2026-09-30 · the theme charm circle used
              to sit here. Replaced by a small round country-flag badge
              showing which country the seller/restaurant is from. Falls
              back to nothing when countryCode is absent (older mock
              rows). Kept the same bottom-right anchor and shadow so the
              silhouette of the portrait unit is preserved. */}
          {(() => {
            const flag = countryCodeToFlagEmoji(props.countryCode);
            if (!flag) return null;
            const badgeSize = isHero ? 28 : 20;
            return (
              <div
                aria-label={`Country ${props.countryCode}`}
                title={props.countryCode ?? undefined}
                style={{
                  position: "absolute",
                  bottom: -4,
                  right: -4,
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: "50%",
                  background: "var(--nex-panel, #050f1e)",
                  border: "2px solid var(--nex-accent)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.55)",
                  overflow: "hidden",
                  fontSize: isHero ? 18 : 13,
                  lineHeight: 1,
                }}
              >
                {flag}
              </div>
            );
          })()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--nex-font-display)",
              fontSize: isHero ? 24 : 14,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
              textShadow: "0 2px 8px rgba(0,0,0,0.55)",
              // Founder direction 2026-09-30 (revised) · fit the whole
              // business name. One line ideally · wraps to a SECOND
              // line for extra-long names · never a third (clamped
              // with an ellipsis after two lines).
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {props.name}
          </div>
          <div
            style={{
              marginTop: isHero ? 5 : 2,
              fontSize: isHero ? 13 : 11,
              color: "var(--nex-text-dim)",
              letterSpacing: "0.02em",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 1px 4px rgba(0,0,0,0.65)",
            }}
          >
            {props.subtitle}
          </div>
          {props.presenceOnline && isHero && (
            <div
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--nex-accent)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--nex-accent)",
                  boxShadow: "0 0 8px var(--nex-accent-glow)",
                }}
              />
              online now
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

// ─── CTAs ────────────────────────────────────────────────────────────

export function CoverChatCTA({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <style>{`
        [data-nex-cover-chat-cta] {
          position: relative;
          transition: transform 220ms ease, box-shadow 220ms ease;
        }
        [data-nex-cover-chat-cta]:hover,
        [data-nex-cover-chat-cta]:focus-visible {
          transform: translateY(-1px);
          box-shadow: 0 14px 36px rgba(0,0,0,0.55), 0 0 22px var(--nex-accent-glow);
        }
        [data-nex-cover-chat-cta]:active {
          transform: translateY(1px);
        }
      `}</style>
      <Link
        href={href}
        data-nex-cover-chat-cta
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "14px 24px",
          borderRadius: 999,
          background: "var(--nex-accent)",
          color: "#fff",
          fontFamily: "var(--nex-font-display)",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.01em",
          textDecoration: "none",
          border: "1px solid var(--nex-accent)",
          boxShadow:
            "0 10px 26px rgba(0,0,0,0.45), 0 0 18px var(--nex-accent-glow)",
        }}
      >
        {children}
      </Link>
    </>
  );
}

export function CoverSecondaryCTA({
  href,
  children,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
}): React.JSX.Element {
  const styleObj: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 999,
    background: "transparent",
    color: "var(--nex-text)",
    fontFamily: "var(--nex-font-body)",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.02em",
    textDecoration: "none",
    border: "1px solid var(--nex-accent-soft)",
    cursor: "pointer",
  };
  if (href) {
    return (
      <Link href={href} style={styleObj}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={styleObj}>
      {children}
    </button>
  );
}

// ─── Section heading ─────────────────────────────────────────────────

export function CoverSectionHeading({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: 14 }}>
      {eyebrow && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--nex-accent)",
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
      )}
      {/* Founder direction 2026-09-30 · remove the small accent-coloured
          dash that used to sit before the title. Title now stands alone
          for a cleaner heading. */}
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--nex-font-display)",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          textShadow: "0 1px 4px rgba(0,0,0,0.55)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

// ─── Product card + grid ─────────────────────────────────────────────

export interface CoverProduct {
  id: string;
  slug: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  stock_status: string | null;
  section_id?: string | null;
  /** Short 2-line description shown on the CoverProductCard between
   *  name and price. Clamped visually to 2 lines. Optional · card
   *  hides the row when absent. */
  description?: string | null;
}

// ─── Category Tabs (sealed 2026-09-30) ────────────────────────────────
// Per-shop grouping displayed above the product/menu grid AND above the
// peer-chat shop slider. Same primitive · same UX · zero drift.
// One-word cap 3 rule enforced at form/service layer NOT here.

export interface CoverSection {
  id: string;
  name: string;
  sort_order?: number;
}

/**
 * ALL_TAB_ID is the sentinel used for the always-first "All" tab.
 * When active, filters are cleared and every card renders (including
 * uncategorised items with section_id === null).
 */
export const ALL_TAB_ID = "__all__";

export function CoverCategoryTabs({
  sections,
  activeId,
  onSelect,
  maxDisplay = 3,
}: {
  sections: CoverSection[];
  activeId: string;
  onSelect: (id: string) => void;
  maxDisplay?: number;
}): React.JSX.Element | null {
  // Founder ruling: 0-1 sections hide the tab bar entirely.
  if (sections.length <= 1) return null;

  const ordered = [...sections].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const visible = ordered.slice(0, maxDisplay);

  // Founder direction 2026-09-30 · no "All" tab in the row. Nothing
  // selected = grid shows everything, no underline anywhere. Tapping
  // a tab underlines it AND filters the grid. Tapping the active tab
  // again clears the filter (toggle behaviour). Only the highlighted
  // tab shows an underline · unselected tabs sit as plain text with
  // no line beneath them.
  const tabs = visible.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div
      role="tablist"
      aria-label="Category tabs"
      style={{
        display: "flex",
        gap: 4,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(isActive ? "" : tab.id)}
            type="button"
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: "10px 14px 12px",
              margin: 0,
              cursor: "pointer",
              fontFamily: "var(--nex-font-body)",
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: "0.02em",
              color: isActive
                ? "var(--nex-accent, #06b6d4)"
                : "var(--nex-text-dim, rgba(148,163,184,0.8))",
              // Only the highlighted tab gets a line beneath it. Others
              // sit as plain text · no border, no track.
              borderBottom: isActive
                ? "2px solid var(--nex-accent, #06b6d4)"
                : "none",
              transition: "color 160ms ease, border-color 160ms ease",
              whiteSpace: "nowrap",
              textTransform: "capitalize",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function CoverProductCard({
  product,
  peerAccountId,
  eyebrow,
}: {
  product: CoverProduct;
  peerAccountId: string;
  eyebrow?: string | null;
}): React.JSX.Element {
  const soldOut = product.stock_status === "sold_out";
  const priceLabel = formatMoney(product.currency, product.price_pence);
  const chatHref = `/nex-native/chat/peer/${peerAccountId}?product=${encodeURIComponent(product.id)}&auto=1`;
  return (
    <>
      <style>{`
        [data-nex-cover-product-card] {
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-nex-cover-product-card]:hover,
        [data-nex-cover-product-card]:focus-visible {
          transform: translateY(-3px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.55), 0 0 18px var(--nex-accent-glow);
        }
      `}</style>
      <Link
        href={chatHref}
        data-nex-cover-product-card
        style={{
          display: "block",
          position: "relative",
          borderRadius: "var(--nex-card-radius)",
          border: "var(--nex-card-border)",
          background: "var(--nex-card-bg)",
          backdropFilter: "blur(14px) saturate(1.1)",
          WebkitBackdropFilter: "blur(14px) saturate(1.1)",
          overflow: "hidden",
          textDecoration: "none",
          color: "var(--nex-text)",
          boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
          opacity: soldOut ? 0.7 : 1,
        }}
      >
        <div
          aria-hidden
          style={{
            aspectRatio: "1 / 1",
            width: "100%",
            backgroundImage: product.image_url
              ? `url(${product.image_url})`
              : undefined,
            background: product.image_url
              ? undefined
              : `linear-gradient(135deg, var(--nex-accent-faint), var(--nex-panel))`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
          }}
        >
          {eyebrow && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                padding: "2px 8px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: "var(--nex-accent)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              {eyebrow}
            </span>
          )}
          {soldOut && (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                padding: "2px 8px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: "rgba(180,40,40,0.85)",
              }}
            >
              Sold out
            </span>
          )}
        </div>
        {/* Founder direction 2026-09-30 · card meta stack ·
              name → 2-line description → price → small View pill.
            The View pill signals that tap opens the seller's chat with
            the shop slider focused on this product (whole card is the
            same link, pill is the visible affordance). */}
        <div
          style={{
            padding: "10px 12px 12px",
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.name}
          </div>
          {product.description && product.description.trim().length > 0 && (
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                color: "var(--nex-text-dim)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 2,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--nex-accent)",
                letterSpacing: "0.01em",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {priceLabel}
            </div>
            <span
              aria-hidden
              style={{
                flex: "0 0 auto",
                padding: "5px 12px",
                borderRadius: 999,
                background: "var(--nex-accent)",
                color: "#03101D",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
              }}
            >
              View
            </span>
          </div>
        </div>
      </Link>
    </>
  );
}

export function CoverProductGrid({
  products,
  peerAccountId,
  columns = 2,
  activeSectionId = ALL_TAB_ID,
}: {
  products: CoverProduct[];
  peerAccountId: string;
  columns?: 1 | 2 | 3;
  /**
   * When ALL_TAB_ID (default) all products render including uncategorised
   * (section_id === null). Any other value filters to strict match.
   */
  activeSectionId?: string;
}): React.JSX.Element {
  const visible =
    activeSectionId === ALL_TAB_ID
      ? products
      : products.filter((p) => p.section_id === activeSectionId);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {visible.map((p) => (
        <CoverProductCard
          key={p.id}
          product={p}
          peerAccountId={peerAccountId}
        />
      ))}
    </div>
  );
}

// ─── Identity rail ───────────────────────────────────────────────────

export interface CoverSocialLinks {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
  other?: { label: string; url: string }[];
}

export function CoverIdentityRail({
  handle,
  location,
  social,
  themeId,
}: {
  handle: string | null;
  location: string | null;
  social: CoverSocialLinks | null;
  themeId: string;
}): React.JSX.Element {
  const icons = social
    ? [
        social.instagram && { key: "ig", label: "Instagram", url: `https://instagram.com/${strip(social.instagram)}`, glyph: <IconInstagram /> },
        social.tiktok && { key: "tt", label: "TikTok", url: `https://tiktok.com/@${strip(social.tiktok).replace(/^@/, "")}`, glyph: <IconTikTok /> },
        social.facebook && { key: "fb", label: "Facebook", url: `https://facebook.com/${strip(social.facebook)}`, glyph: <IconFacebook /> },
        social.whatsapp && { key: "wa", label: "WhatsApp", url: `https://wa.me/${strip(social.whatsapp).replace(/[^\d+]/g, "").replace(/^\+/, "")}`, glyph: <IconWhatsApp /> },
        social.website && { key: "web", label: "Website", url: social.website, glyph: <IconGlobe /> },
        ...(social.other ?? []).map((o) => ({ key: o.url, label: o.label, url: o.url, glyph: <IconLink /> })),
      ].filter(Boolean)
    : [];
  return (
    <div
      data-nex-cover-rise
      style={{
        display: "grid",
        gap: 10,
        padding: "20px 4px 4px",
        borderTop: "1px dashed var(--nex-accent-soft)",
      }}
    >
      {handle && (
        <div
          style={{
            fontFamily: "var(--nex-font-display)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            color: "var(--nex-text)",
          }}
        >
          {handle}
        </div>
      )}
      {icons.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {icons.map((it) => it && (
            <a
              key={it.key}
              href={it.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={it.label}
              title={it.label}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "var(--nex-accent-faint)",
                border: "1px solid var(--nex-accent-soft)",
                color: "var(--nex-accent)",
                textDecoration: "none",
              }}
            >
              {it.glyph}
            </a>
          ))}
        </div>
      )}
      {location && (
        <div
          style={{
            fontSize: 11,
            color: "var(--nex-text-dim)",
            letterSpacing: "0.03em",
          }}
        >
          📍 {location}
        </div>
      )}
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--nex-text-dim)",
        }}
      >
        <CharmGlyph themeId={themeId} size={12} />
        Powered by NEX
      </div>
    </div>
  );
}

function strip(v: string): string {
  return v.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ─── Sticky action bar (conversion only) ─────────────────────────────

export function CoverStickyBar({
  chatHref,
  menuHref,
  cartHref,
  chatLabel = "Chat",
  menuLabel = "Menu",
  cartLabel = "Cart",
}: {
  chatHref: string;
  menuHref?: string | null;
  cartHref?: string;
  chatLabel?: string;
  menuLabel?: string;
  cartLabel?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        padding: "10px 16px calc(env(safe-area-inset-bottom, 0) + 12px)",
        background:
          "linear-gradient(0deg, rgba(3,8,20,0.94) 0%, rgba(3,8,20,0.82) 60%, rgba(3,8,20,0.4) 100%)",
        backdropFilter: "blur(16px) saturate(1.1)",
        WebkitBackdropFilter: "blur(16px) saturate(1.1)",
        borderTop: "1px solid var(--nex-accent-soft)",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          gap: 8,
        }}
      >
        <StickyBtn href={chatHref} primary>
          💬 <span style={{ marginLeft: 6 }}>{chatLabel}</span>
        </StickyBtn>
        {menuHref && (
          <StickyBtn href={menuHref}>
            🍽 <span style={{ marginLeft: 6 }}>{menuLabel}</span>
          </StickyBtn>
        )}
        {cartHref && (
          <StickyBtn href={cartHref}>
            🛒 <span style={{ marginLeft: 6 }}>{cartLabel}</span>
          </StickyBtn>
        )}
      </div>
    </div>
  );
}

function StickyBtn({
  href,
  primary,
  children,
}: {
  href: string;
  primary?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 16px",
        borderRadius: 12,
        fontFamily: "var(--nex-font-display)",
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: "0.01em",
        textDecoration: "none",
        color: primary ? "#fff" : "var(--nex-text)",
        background: primary
          ? "var(--nex-accent)"
          : "var(--nex-accent-faint)",
        border: primary
          ? "1px solid var(--nex-accent)"
          : "1px solid var(--nex-accent-soft)",
        boxShadow: primary
          ? "0 10px 24px rgba(0,0,0,0.45), 0 0 18px var(--nex-accent-glow)"
          : "0 6px 16px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </Link>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatMoney(currency: string, minor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") {
    return `Rp ${Math.round(minor / 100).toLocaleString("id-ID")}`;
  }
  const sym = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${sym}${(minor / 100).toFixed(2)}`;
}

// ─── Compact icon glyphs (theme-tinted) ──────────────────────────────

function IconInstagram(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="0.9" fill="currentColor" />
    </svg>
  );
}
function IconTikTok(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14.5 4v9.2a3 3 0 11-3-3V13a1.7 1.7 0 100 3.4A1.7 1.7 0 0013.2 14V4h1.3c.2 1.7 1.4 3 3 3.2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconFacebook(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 8h2V5h-2a3 3 0 00-3 3v2H9v3h2v7h3v-7h2l1-3h-3V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconWhatsApp(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20l1.5-4A7 7 0 1112 19a7 7 0 01-3.5-.9L4 20zM9 9.5c0-.4.4-.5.7-.5s.5 0 .7.5.7 1.5.7 1.7-.2.4-.5.5c-.3.2-.4.3-.2.6.4.7 1.3 1.6 2 2 .3.1.5 0 .6-.2.2-.3.4-.5.7-.5.5 0 1.4.7 1.7.9.2.2.2.4.1.5-.3.6-1 1.1-1.7 1.1-1.4 0-3.4-1.5-4.4-3.4-.4-.6-.4-1.3-.4-1.7z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconGlobe(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12h16M12 4c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8M12 4C9.5 6.5 8.5 9 8.5 12s1 5.5 3.5 8" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}
function IconLink(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 14a3 3 0 000-4l-1-1a3 3 0 10-4 4l1 1M14 10a3 3 0 000 4l1 1a3 3 0 104-4l-1-1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
