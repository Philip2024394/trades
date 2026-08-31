"use client";
// NexDirectorySurface · Philip 2026-08-30 · Directory Surface Architecture
//
// Locked reusable primitive per project_nex_directory_surface_architecture.
// One interaction language hosts every directory vertical (Food · Hotels ·
// Trades · Services · Marketplace · Mobility · Rentals · …). Content model
// changes per vertical descriptor; interaction language does not.
//
// Sequence: Discover → category chips → vertical listing feed → View →
// Detail → Ask NEX → Chat with pendingBusinessContext attached.
//
// This file OWNS all visual + interaction chrome shared across verticals.
// Verticals only supply data + a few strings + optional per-vertical detail
// action metadata. No vertical should reimplement card / detail / header
// layouts — extend this primitive instead.

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Star,
  Clock,
  Sparkles,
  X,
  Heart,
  Utensils,
} from "lucide-react";
// BusinessContext is the shape the shell prepends to the backend chat
// text when the user taps Ask NEX. Owned here so verticals can import it
// without pulling the whole Food workspace module.
export interface BusinessContext {
  id: string;
  name: string;
  /** Free-form category descriptor. Food = cuisine · Hotels = "3-star hotel" · etc. */
  cuisine: string;
  distanceKm: number;
  rating: number;
  openStatus: "open" | "closing-soon" | "closed";
}

// ─── Icon type ────────────────────────────────────────────────────────
// lucide-react icons + any React component that accepts these props.
export type DirectoryIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  fill?: string;
  style?: React.CSSProperties;
}>;

// ─── Vertical descriptor ──────────────────────────────────────────────

export interface DirectoryEntity {
  id: string;
  name: string;
  /** One-line category descriptor: "Indonesian" for food · "3-star" for hotels. */
  subtitle: string;
  rating: number;
  distanceKm: number;
  /** Short price hint: "Rp —" · "$120/night" · "£45/hr". */
  priceIndication: string;
  openStatus: "open" | "closing-soon" | "closed";
  /** CSS gradient used as the photo-slot placeholder. Vertical picks the palette. */
  cardGradient: string;

  // ─── World-class food-directory contract fields (all OPTIONAL · Philip 2026-08-30) ───
  // Verticals opt into any subset · unused fields don't render. Enables real
  // richness (image · price range · hours · description · tags) while keeping
  // sparse verticals working unchanged.
  /** Chip-id this entity belongs to for filter routing. Missing = always shown. */
  chip?: string;
  /** Full cuisine label · "Traditional Javanese Cuisine". Card subtitle. */
  cuisine?: string;
  /** Compact price signifier · "$" · "$$" · "$$$" · "$$$$". */
  priceRange?: string;
  /** Human-readable hours line · "Open · Closes 21:00". */
  hoursText?: string;
  /** Hero image URL for card + detail. If missing, falls back to gradient + icon. */
  heroImageUrl?: string;
  /** Additional gallery images for the detail view. */
  galleryImageUrls?: string[];
  /** Small attribute chips shown under the name · "Family Friendly · Local Favourite". */
  tags?: string[];
  /** Total review count · rendered as "1.2k" style. */
  reviewCount?: number;
  /** Text label alongside the rating · "Excellent" · "Great". */
  ratingLabel?: string;
  /** Short description for the detail view. One sentence, honest. Never fabricate. */
  description?: string;
}

export interface DirectoryCategoryChip {
  id: string;
  label: string;
  icon: DirectoryIcon;
}

export interface DirectoryDetailAction {
  id: string;
  label: string;
  icon: DirectoryIcon;
  /** Enabled actions get an onClick; disabled ones render as honest placeholders. */
  onClick?: () => void;
  disabled?: boolean;
}

export interface DirectoryStatusLabels {
  open: string;
  "closing-soon": string;
  closed: string;
}

// Default labels · food/hotel semantics · used when a vertical does not
// supply its own labels. Extracted so verticals like Trades can opt into
// domain-appropriate wording ("Available now" / "Booked today" / …) without
// forking the primitive.
const DEFAULT_STATUS_LABELS: DirectoryStatusLabels = {
  open: "Open now",
  "closing-soon": "Closing soon",
  closed: "Closed",
};

export interface DirectoryVertical {
  /** Machine id: "food" · "hotels" · "trades". */
  verticalId: string;
  city: string;
  /** Header eyebrow (all caps): "FOOD · YOGYAKARTA". */
  headerLabel: string;
  /** Prompt line under header: "What are you hungry for?". */
  headerPrompt: string;
  searchPlaceholder: string;
  /** Word used in the detail Back button + aria: "Back to {backNoun} listings". */
  backNoun: string;
  /** Icon shown in card + detail photo slot placeholder. */
  photoIcon: DirectoryIcon;
  categoryChips: DirectoryCategoryChip[];
  listings: DirectoryEntity[];
  /** Row of secondary actions above Ask NEX in the detail view. */
  detailActions: DirectoryDetailAction[];
  /**
   * Optional per-vertical wording for the entity's status pill.
   * Defaults to food/hotel labels ("Open now" / "Closing soon" / "Closed").
   * Trades opts in with "Available now" / "Booked today" / "Fully booked".
   * Descriptor-level evolution · not a per-vertical UI component. Enforces
   * the "no per-vertical surface component" doctrine.
   */
  statusLabels?: DirectoryStatusLabels;
  /**
   * Optional background image URL rendered as a fixed layer behind the
   * surface content. Verticals opt in when they want their own atmosphere
   * (Food surface uses a specific ChatGPT-generated backdrop per Philip
   * 2026-08-30). When absent, the surface is transparent and inherits the
   * shell's dark bezel · matching Chat. Descriptor-only · never a per-vertical
   * UI file.
   */
  backgroundImageUrl?: string;
  /**
   * Optional per-vertical override for the neutral "View" button label on the
   * card. Food uses "VIEW MENU" · Hotels could use "VIEW ROOMS" · defaults to
   * "VIEW" when unset. Descriptor-only.
   */
  viewButtonLabel?: string;
  /** Maps a vertical entity to the generic BusinessContext the shell sends
      to the chat backend when the user taps Ask NEX. Verticals decide how
      to fill each field. */
  entityToContext: (e: DirectoryEntity) => BusinessContext;
}

export type AskNexHandler = (business: BusinessContext) => void;

// ─── Shared helpers ───────────────────────────────────────────────────

const statusText = (s: DirectoryEntity["openStatus"], labels: DirectoryStatusLabels) => labels[s];
const statusColor = (s: DirectoryEntity["openStatus"]) =>
  s === "open" ? "rgba(74,222,128,0.9)" : s === "closing-soon" ? "rgba(251,191,36,0.95)" : "rgba(239,68,68,0.9)";

// ─── Card ─────────────────────────────────────────────────────────────

// ─── Card overlays / helpers ──────────────────────────────────────────

// Colored status dot · open=green · closing-soon=amber · closed=red.
// Matches statusColor() below but sized for the pill.
function StatusDot({ status }: { status: DirectoryEntity["openStatus"] }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: 999,
        background: statusColor(status),
        boxShadow: `0 0 6px ${statusColor(status)}`,
        marginRight: 6,
      }}
    />
  );
}

// Format review count · 1200 → "1.2k" · 500 → "500".
function formatReviewCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k.toFixed(k >= 10 ? 0 : 1)}k`;
}

function DirectoryCard({
  entity,
  photoIcon: PhotoIcon,
  statusLabels,
  viewButtonLabel,
  onView,
  onAskNex,
  entityToContext,
}: {
  entity: DirectoryEntity;
  photoIcon: DirectoryIcon;
  statusLabels: DirectoryStatusLabels;
  viewButtonLabel: string;
  onView: () => void;
  onAskNex: AskNexHandler;
  entityToContext: DirectoryVertical["entityToContext"];
}) {
  // Prefer entity-specific fields · fall through to legacy subtitle when a
  // vertical hasn't been enriched yet. Keeps old descriptors rendering fine.
  const displayCuisine = entity.cuisine ?? entity.subtitle;
  const statusPillLabel = statusText(entity.openStatus, statusLabels);
  const openLabel = entity.openStatus === "open" ? "Open"
    : entity.openStatus === "closing-soon" ? "Closing soon" : "Closed";
  const openColor = statusColor(entity.openStatus);
  return (
    <article
      aria-label={entity.name}
      style={{
        width: "100%",
        padding: 0,
        // Philip 2026-08-30 · match the search bar container exactly.
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        overflow: "hidden",
        color: "inherit",
        display: "flex",
        alignItems: "stretch",
        gap: 0,
      }}
    >
      {/* ─── LEFT · Photo with overlays ─── */}
      <div
        style={{
          position: "relative",
          flex: "0 0 42%",
          minHeight: 132,
          background: entity.heroImageUrl
            ? `url(${entity.heroImageUrl}) center / cover no-repeat`
            : entity.cardGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.35)",
          overflow: "hidden",
        }}
      >
        {!entity.heroImageUrl && <PhotoIcon size={44} strokeWidth={1.4} />}

        {/* OPEN pill · top-left · green outline + green text on dark bg */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 11px 5px 9px",
            borderRadius: 999,
            background: "rgba(6,10,8,0.82)",
            border: `1px solid ${openColor}`,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: openColor,
            textTransform: "uppercase",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: 999,
              background: openColor,
              boxShadow: `0 0 6px ${openColor}`,
              marginRight: 6,
            }}
          />
          {statusPillLabel}
        </div>

        {/* Favorite circle · top-right · dark bg with white outline */}
        <button
          type="button"
          aria-label={`Save ${entity.name}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            appearance: "none",
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "rgba(10,10,14,0.75)",
            border: "1.5px solid rgba(255,255,255,0.65)",
            backdropFilter: "blur(6px)",
            color: "rgba(255,255,255,0.95)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Heart size={15} strokeWidth={2.2} />
        </button>

        {/* Distance pill · bottom-left · with map pin icon */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 999,
            background: "rgba(10,10,14,0.78)",
            border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(6px)",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(245,245,245,0.95)",
          }}
        >
          <MapPin size={12} strokeWidth={2.2} />
          {entity.distanceKm.toFixed(1)} km
        </div>
      </div>

      {/* ─── RIGHT · Content column ─── */}
      <div style={{
        flex: "1 1 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        padding: "10px 12px",
        gap: 3,
      }}>
        {/* Name · large cream */}
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: "rgba(255,247,236,0.98)",
          lineHeight: 1.2,
          letterSpacing: -0.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {entity.name}
        </div>

        {/* Rating row · orange star + rating + review count in parens */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,247,236,0.94)",
          marginTop: 2,
        }}>
          <Star size={14} strokeWidth={0} fill="currentColor" style={{ color: "rgba(245,158,11,1)" }} />
          {entity.rating.toFixed(1)}
          {entity.reviewCount != null && (
            <span style={{ color: "rgba(255,247,236,0.75)", fontWeight: 500 }}>
              ({formatReviewCount(entity.reviewCount)})
            </span>
          )}
        </div>

        {/* Cuisine line */}
        <div style={{
          fontSize: 13,
          color: "rgba(255,247,236,0.86)",
          lineHeight: 1.35,
          marginTop: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {displayCuisine}
        </div>

        {/* Price · orange */}
        {entity.priceRange && (
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: "rgba(245,158,11,0.98)",
            letterSpacing: 1,
            marginTop: 1,
          }}>
            {entity.priceRange}
          </div>
        )}

        {/* Open · Closes 21:00 · green dot + status word · then hours */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: openColor,
          fontWeight: 600,
          marginTop: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: 999,
              background: openColor,
              boxShadow: `0 0 4px ${openColor}`,
            }}
          />
          <span>{openLabel}</span>
          {entity.hoursText && (
            <span style={{ color: "rgba(255,247,236,0.7)", fontWeight: 500 }}>
              {` · ${entity.hoursText.replace(/^(Open|Closing soon|Closed)\s*·\s*/i, "").replace(/^Closes\s+/i, "Closes ")}`}
            </span>
          )}
        </div>

        {/* Action row · VIEW MENU (outlined) + ASK NEX (filled amber) */}
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 10 }}>
          <button
            type="button"
            onClick={onView}
            aria-label={`View ${entity.name}`}
            style={{
              appearance: "none",
              flex: "1 1 0",
              padding: "10px 8px",
              borderRadius: 10,
              background: "transparent",
              border: "1.5px solid rgba(245,158,11,0.85)",
              color: "rgba(245,158,11,1)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.6,
              fontFamily: "inherit",
              cursor: "pointer",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {viewButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => onAskNex(entityToContext(entity))}
            aria-label={`Ask NEX about ${entity.name}`}
            style={{
              appearance: "none",
              flex: "1 1 0",
              padding: "10px 8px",
              borderRadius: 10,
              background: "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
              border: "1.5px solid rgba(245,158,11,0.95)",
              color: "#1e1206",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.6,
              fontFamily: "inherit",
              cursor: "pointer",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
            }}
          >
            ASK NEX
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────

// ─── Detail info tile (Philip 2026-08-30 · world-class spec) ─────────

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
      }}
    >
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        color: "rgba(245,245,245,0.95)",
        letterSpacing: 0.3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        letterSpacing: 1.5,
        color: "rgba(245,245,245,0.5)",
        textTransform: "uppercase",
        fontWeight: 500,
      }}>
        {label}
      </div>
    </div>
  );
}

function DirectoryDetail({
  entity,
  vertical,
  onBack,
  onAskNex,
}: {
  entity: DirectoryEntity;
  vertical: DirectoryVertical;
  onBack: () => void;
  onAskNex: AskNexHandler;
}) {
  const PhotoIcon = vertical.photoIcon;
  const [heroIndex, setHeroIndex] = useState(0);

  const gallery = entity.galleryImageUrls ?? [];
  const heroImages = entity.heroImageUrl ? [entity.heroImageUrl, ...gallery] : gallery;
  const currentHero = heroImages[heroIndex] ?? entity.heroImageUrl;

  const displayCuisine = entity.cuisine ?? entity.subtitle;
  const statusLabels = vertical.statusLabels ?? DEFAULT_STATUS_LABELS;
  const statusLabel = statusText(entity.openStatus, statusLabels);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header row · back · name · favorite */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 16px 4px",
        gap: 8,
      }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${vertical.backNoun} listings`}
          style={{
            appearance: "none",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "8px",
            borderRadius: 999,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            color: "rgba(245,245,245,0.95)",
            flex: "0 0 auto",
          }}
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <div style={{
          fontSize: 15,
          fontWeight: 600,
          color: "rgba(245,245,245,0.92)",
          textAlign: "center",
          flex: "1 1 auto",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 4px",
        }}>
          {entity.name}
        </div>
        <button
          type="button"
          aria-label={`Save ${entity.name}`}
          style={{
            appearance: "none",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "8px",
            borderRadius: 999,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            color: "rgba(245,245,245,0.95)",
            flex: "0 0 auto",
          }}
        >
          <Heart size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Cuisine subtitle · under the header row */}
      <div style={{
        padding: "0 20px 12px",
        fontSize: 12,
        letterSpacing: 1.5,
        color: "rgba(74,201,255,0.8)",
        textAlign: "center",
        textTransform: "uppercase",
        fontWeight: 600,
      }}>
        {displayCuisine}
      </div>

      {/* Hero · large cinematic image with overlays */}
      <div
        style={{
          position: "relative",
          height: 260,
          margin: "0 16px",
          borderRadius: 18,
          background: currentHero
            ? `linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%), url(${currentHero}) center / cover no-repeat`
            : entity.cardGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.32)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {!currentHero && <PhotoIcon size={72} strokeWidth={1.2} />}

        {/* Rating + label overlay · bottom-left */}
        <div style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(10,10,14,0.75)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(6px)",
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(245,245,245,0.98)",
        }}>
          <Star size={13} strokeWidth={2} fill="currentColor" style={{ color: "rgba(251,191,36,0.95)" }} />
          {entity.rating.toFixed(1)}
          {entity.ratingLabel && (
            <span style={{ color: "rgba(245,245,245,0.7)", fontWeight: 500 }}> {entity.ratingLabel}</span>
          )}
        </div>

        {/* Distance overlay · bottom-right */}
        <div style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(10,10,14,0.75)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(6px)",
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(245,245,245,0.9)",
        }}>
          <MapPin size={12} strokeWidth={2} />
          {entity.distanceKm.toFixed(1)} km
        </div>
      </div>

      {/* Gallery thumbnails · shown only when >1 image available */}
      {heroImages.length > 1 && (
        <div style={{
          display: "flex",
          gap: 8,
          padding: "12px 16px 4px",
          overflowX: "auto",
        }}>
          {heroImages.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setHeroIndex(i)}
              aria-label={`Show image ${i + 1}`}
              style={{
                appearance: "none",
                flex: "0 0 auto",
                width: 68,
                height: 52,
                borderRadius: 8,
                background: `url(${src}) center / cover no-repeat, rgba(0,0,0,0.5)`,
                border: `2px solid ${i === heroIndex ? "rgba(245,158,11,0.85)" : "rgba(255,255,255,0.14)"}`,
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Info tile grid · adapt to available fields (never fabricate) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
        padding: "16px 16px 4px",
      }}>
        <InfoTile
          label={entity.openStatus === "open" ? "Open now" : entity.openStatus === "closing-soon" ? "Closing soon" : "Closed"}
          value={entity.hoursText ?? statusLabel}
        />
        {entity.priceRange && <InfoTile label="Price range" value={entity.priceRange} />}
        {displayCuisine && <InfoTile label="Category" value={displayCuisine} />}
        <InfoTile
          label={entity.reviewCount ? `${formatReviewCount(entity.reviewCount)} reviews` : "Rating"}
          value={`★ ${entity.rating.toFixed(1)}`}
        />
      </div>

      {/* Description · rendered only when provided */}
      {entity.description && (
        <div style={{
          padding: "16px 20px 4px",
          fontSize: 14,
          lineHeight: 1.55,
          color: "rgba(245,245,245,0.78)",
        }}>
          {entity.description}
        </div>
      )}

      {/* Real actions row · vertical.detailActions unchanged */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${vertical.detailActions.length || 1}, minmax(0, 1fr))`,
          gap: 8,
          padding: "16px 16px 0",
        }}
      >
        {vertical.detailActions.map((a) => {
          const Icon = a.icon;
          const isDisabled = !!a.disabled || !a.onClick;
          return (
            <button
              key={a.id}
              type="button"
              disabled={isDisabled}
              onClick={a.onClick}
              aria-label={isDisabled ? `${a.label} · coming soon` : a.label}
              style={{
                appearance: "none",
                padding: "14px 8px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(245,245,245,0.85)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.4,
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                cursor: isDisabled ? "not-allowed" : "pointer",
                textTransform: "uppercase",
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Ask NEX module · primary action · always visible near bottom */}
      <div style={{ padding: "18px 16px 40px" }}>
        <div style={{
          fontSize: 10,
          letterSpacing: 2,
          color: "rgba(245,245,245,0.55)",
          textTransform: "uppercase",
          marginBottom: 8,
          textAlign: "center",
          fontWeight: 600,
        }}>
          Ask NEX about this place
        </div>
        <button
          type="button"
          onClick={() => onAskNex(vertical.entityToContext(entity))}
          aria-label={`Ask NEX about ${entity.name}`}
          style={{
            appearance: "none",
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(245,158,11,0.32) 0%, rgba(217,119,6,0.18) 100%)",
            border: "1px solid rgba(245,158,11,0.65)",
            color: "rgba(255,251,235,0.98)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.6,
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(245,158,11,0.18)",
            textTransform: "uppercase",
          }}
        >
          <Sparkles size={16} strokeWidth={2} /> Ask NEX
        </button>
      </div>
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────

// Philip 2026-08-30 · Directory UX doctrine · never expose all chips at once.
// Show at most 5 inline; overflow moves into an EXPLORE CATEGORIES bottom
// sheet reached via a `Categories ›` affordance. Right-edge fade signals
// horizontal overflow because native scrollbars are hidden app-wide on
// /nexapp. See project_nex_directory_ux_locked_2026_08_30.md.
const CHIPS_INLINE_LIMIT = 5;

// Philip 2026-08-30 · shared HUD container styling. Card + search bar +
// any future NEX HUD panel share these values so they cannot drift out
// of alignment. If Philip retunes the look, one change here updates
// every surface consistently.
const WARM_HUD_BACKGROUND = "radial-gradient(120% 140% at 20% 20%, #4a2c14 0%, #3a2210 45%, #2a1808 85%, #1e1206 100%)";
const WARM_HUD_BORDER = "1px solid rgba(245,158,11,0.35)";
const WARM_HUD_SHADOW = "0 0 0 1px rgba(245,158,11,0.08), 0 8px 24px rgba(0,0,0,0.55), 0 0 32px rgba(245,158,11,0.05)";

function chipStyle(active: boolean): React.CSSProperties {
  return {
    appearance: "none",
    padding: "10px 16px",
    borderRadius: 999,
    background: active ? "rgba(74,201,255,0.15)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "rgba(74,201,255,0.55)" : "rgba(255,255,255,0.1)"}`,
    color: active ? "rgba(245,245,245,0.98)" : "rgba(245,245,245,0.75)",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  };
}

function DirectoryListView({
  vertical,
  onOpen,
  onAskNex,
}: {
  vertical: DirectoryVertical;
  onOpen: (e: DirectoryEntity) => void;
  onAskNex: AskNexHandler;
}) {
  const [activeChip, setActiveChip] = useState<string>(vertical.categoryChips[0]?.id ?? "");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const statusLabels = vertical.statusLabels ?? DEFAULT_STATUS_LABELS;

  const hasOverflow = vertical.categoryChips.length > CHIPS_INLINE_LIMIT;
  const inlineChips = hasOverflow
    ? vertical.categoryChips.slice(0, CHIPS_INLINE_LIMIT)
    : vertical.categoryChips;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ padding: "22px 20px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(74,201,255,0.9)", fontWeight: 600 }}>
          {vertical.headerLabel}
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: "rgba(245,245,245,0.95)", lineHeight: 1.3 }}>
          {vertical.headerPrompt}
        </div>
      </div>

      <div style={{ padding: "0 20px 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(245,245,245,0.5)",
          fontSize: 13,
        }}>
          <Search size={16} strokeWidth={2} />
          <span>{vertical.searchPlaceholder}</span>
        </div>
      </div>

      {/* Chip row · at most CHIPS_INLINE_LIMIT inline + Categories › overflow. */}
      <div style={{ position: "relative", padding: "0 0 16px" }}>
        <div style={{
          display: "flex",
          gap: 8,
          padding: "0 20px",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none" as React.CSSProperties["msOverflowStyle"],
        }}>
          {inlineChips.map(({ id, label, icon: Icon }) => {
            const active = activeChip === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveChip(id)}
                aria-label={`${label}${active ? " (active)" : ""}`}
                style={chipStyle(active)}
              >
                <Icon size={14} strokeWidth={2} /> {label}
              </button>
            );
          })}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              aria-label="Explore all categories"
              style={{
                ...chipStyle(false),
                background: "rgba(255,255,255,0.06)",
                border: "1px dashed rgba(255,255,255,0.24)",
              }}
            >
              Categories <ChevronRight size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        {/* Right-edge fade · signals horizontal overflow when scrollbar is hidden.
            Rendered only when overflow exists so short lists stay clean. */}
        {hasOverflow && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 16,
              width: 44,
              pointerEvents: "none",
              background: "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85))",
            }}
          />
        )}
      </div>

      {/* Card feed · chip filter applies when any listing declares a chip.
          Backwards compatible: verticals whose entities lack `chip` field
          continue to render all listings regardless of active chip. */}
      {/* Card feed · full screen width per Philip 2026-08-30 · minimal side
          padding so horizontal cards breathe edge-to-edge. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 8px 40px" }}>
        {(() => {
          const anyChipTagged = vertical.listings.some((e) => !!e.chip);
          const isAllChip = activeChip === "all" || activeChip === vertical.categoryChips[0]?.id;
          const filtered = !anyChipTagged || isAllChip
            ? vertical.listings
            : vertical.listings.filter((e) => e.chip === activeChip);

          if (filtered.length === 0) {
            const chipLabel = vertical.categoryChips.find((c) => c.id === activeChip)?.label ?? activeChip;
            return (
              <div
                role="status"
                style={{
                  padding: "36px 20px",
                  borderRadius: 14,
                  border: "1px dashed rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.02)",
                  textAlign: "center",
                  color: "rgba(245,245,245,0.7)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  No {chipLabel.toLowerCase()} yet
                </div>
                <div style={{ fontSize: 12, color: "rgba(245,245,245,0.5)" }}>
                  NEX is walking your city · check back soon
                </div>
              </div>
            );
          }

          return filtered.map((entity) => (
            <DirectoryCard
              key={entity.id}
              entity={entity}
              photoIcon={vertical.photoIcon}
              statusLabels={statusLabels}
              viewButtonLabel={vertical.viewButtonLabel ?? "VIEW"}
              onView={() => onOpen(entity)}
              onAskNex={onAskNex}
              entityToContext={vertical.entityToContext}
            />
          ));
        })()}
      </div>

      {/* EXPLORE CATEGORIES · bottom-sheet-style overlay inside the surface.
          Never a route change · never a full-page modal. User picks a chip,
          it becomes active, sheet closes. Backdrop tap also closes. Honors
          the "content expands, but NEX never leaves" framing. */}
      {categoriesOpen && (
        <CategoriesPanel
          chips={vertical.categoryChips}
          activeChipId={activeChip}
          onSelect={(id) => { setActiveChip(id); setCategoriesOpen(false); }}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Explore Categories panel ─────────────────────────────────────────

function CategoriesPanel({
  chips,
  activeChipId,
  onSelect,
  onClose,
}: {
  chips: DirectoryCategoryChip[];
  activeChipId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Explore categories"
      aria-modal="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        zIndex: 40,
      }}
    >
      {/* Backdrop · tap outside to close */}
      <button
        type="button"
        aria-label="Close categories panel"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          cursor: "pointer",
          appearance: "none",
          padding: 0,
        }}
      />
      {/* Sheet · slides up · contains scrollable chip list */}
      <div
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #131319 0%, #0a0a0e 100%)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          padding: "16px 0 24px",
          maxHeight: "70%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* Grabber */}
        <div aria-hidden style={{
          width: 40, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.2)",
          margin: "0 auto 12px",
        }} />
        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px 12px",
        }}>
          <div style={{
            fontSize: 11, letterSpacing: 2, color: "rgba(74,201,255,0.9)", fontWeight: 600,
          }}>
            EXPLORE CATEGORIES
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              appearance: "none", background: "transparent", border: "none",
              color: "rgba(245,245,245,0.7)", cursor: "pointer", padding: 4,
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {/* Vertical chip list */}
        <div style={{ overflowY: "auto", padding: "4px 12px 0" }}>
          {chips.map(({ id, label, icon: Icon }) => {
            const active = activeChipId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-label={`Select ${label}${active ? " (active)" : ""}`}
                style={{
                  appearance: "none",
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: active ? "rgba(74,201,255,0.12)" : "transparent",
                  border: `1px solid ${active ? "rgba(74,201,255,0.4)" : "transparent"}`,
                  color: active ? "rgba(245,245,245,0.98)" : "rgba(245,245,245,0.85)",
                  fontSize: 15,
                  fontWeight: active ? 600 : 500,
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Exported surface ─────────────────────────────────────────────────

export function NexDirectorySurface({
  vertical,
  onAskNex,
}: {
  vertical: DirectoryVertical;
  onAskNex: AskNexHandler;
}) {
  const [selected, setSelected] = useState<DirectoryEntity | null>(null);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Vertical-specified background image · optional · Philip 2026-08-30.
          Sits OUTSIDE the scroll container so it fills the entire surface
          (full width + full height) and stays visible as content scrolls
          over it. Raw image · no shade overlay per Philip's directive.
          Descriptor-only · never a per-vertical UI file. When absent, the
          surface is transparent and inherits Chat's dark bezel exactly. */}
      {vertical.backgroundImageUrl && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            backgroundImage: `url("${vertical.backgroundImageUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Scroll container · sits above the background · content scrolls
          within it while the background image remains fully visible. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {selected
          ? <DirectoryDetail entity={selected} vertical={vertical} onBack={() => setSelected(null)} onAskNex={onAskNex} />
          : <DirectoryListView vertical={vertical} onOpen={setSelected} onAskNex={onAskNex} />
        }
      </div>
    </div>
  );
}
