// NEX Food Directory · landscape listing card.
// Hero image dominates the top · info stacked underneath · NEX/local
// membership badge top-right. Same visual grammar as ContactCard but
// hero-image-forward (rather than avatar-forward) because food is
// visual-first per Philip 2026-08-21.

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import {
  FOOD_CATEGORIES,
  formatDistance,
  type FoodListing,
} from "@/lib/nexapp/foodListings";
import { pickFoodCopy } from "./foodCopy";

export function FoodListingCard({
  listing,
  onTap,
  language,
}: {
  listing: FoodListing;
  onTap: () => void;
  language: "en" | "id";
}) {
  const t = pickFoodCopy(language);
  const category = FOOD_CATEGORIES.find((c) => c.slug === listing.category);
  const categoryLabel = category
    ? (language === "id" ? category.labelId : category.labelEn)
    : listing.category;

  const badgeText =
    listing.claimStatus === "claimed"   ? t.nexMemberBadge :
    listing.claimStatus === "invited"   ? t.invitedBadge :
    t.notYetClaimedBadge;
  const badgeIsMember = listing.claimStatus === "claimed";

  const statusLabel =
    listing.openingStatus === "open"   ? t.openLabel :
    listing.openingStatus === "closed" ? t.closedLabel :
    t.unknownStatusLabel;
  const statusColor =
    listing.openingStatus === "open"   ? "#22c55e" :
    listing.openingStatus === "closed" ? "#ef4444" :
    "rgba(255,255,255,0.5)";

  return (
    <button
      type="button"
      onClick={onTap}
      style={cardStyle}
      aria-label={`Open ${listing.name} details`}
    >
      {/* Hero image · dominant visual element */}
      <div style={heroWrapStyle}>
        <img
          src={listing.heroImageUrl}
          alt=""
          style={heroImageStyle}
          loading="lazy"
        />
        {/* Membership badge · top-right over the image */}
        <span style={badgeStyle(badgeIsMember)}>{badgeText}</span>
        {/* Open/closed pill · bottom-left over the image */}
        <span style={statusPillStyle(statusColor)}>
          <span style={{ ...statusDotStyle, background: statusColor }} />
          {statusLabel}
        </span>
      </div>

      {/* Info block */}
      <div style={infoStyle}>
        <div style={nameRowStyle}>
          <span style={nameStyle}>{listing.name}</span>
          {typeof listing.rating === "number" && (
            <span style={ratingStyle}>★ {listing.rating.toFixed(1)}</span>
          )}
        </div>
        <div style={metaStyle}>
          <span style={{ opacity: 0.85 }}>{category?.emoji} {categoryLabel}</span>
          <span style={metaSepStyle}>·</span>
          <span>📍 {listing.district}</span>
          {listing.distanceKm != null && (
            <>
              <span style={metaSepStyle}>·</span>
              <span>{formatDistance(listing.distanceKm)}</span>
            </>
          )}
        </div>
        {listing.claimStatus === "unclaimed" && (
          <div style={verifyingStyle}>{t.businessBeingVerified}</div>
        )}
      </div>
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: 0,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: 16,
  overflow: "hidden",
  color: NEX.text,
  cursor: "pointer",
  textAlign: "left",
  transition: "background 140ms ease, border-color 140ms ease, transform 100ms ease",
};

const heroWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  overflow: "hidden",
  background: "#0a0a0a",
};

const heroImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

function badgeStyle(isMember: boolean): CSSProperties {
  return {
    position: "absolute",
    top: 10,
    right: 10,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    padding: "4px 8px",
    borderRadius: 999,
    color: isMember ? "#0a0a0a" : "rgba(255,255,255,0.85)",
    background: isMember ? NEX.orange as string : "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    border: isMember ? "none" : `1px solid rgba(255,255,255,0.20)`,
  };
}

function statusPillStyle(color: string): CSSProperties {
  return {
    position: "absolute",
    bottom: 10,
    left: 10,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10.5,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    color,
    border: `1px solid ${color}55`,
  };
}

const statusDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  display: "inline-block",
};

const infoStyle: CSSProperties = {
  padding: "12px 14px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const nameStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: -0.2,
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const ratingStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 12,
  fontWeight: 700,
  flex: "0 0 auto",
};

const metaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 4,
  color: "rgba(255,255,255,0.60)",
  fontSize: 12,
  lineHeight: 1.5,
};

const metaSepStyle: CSSProperties = {
  color: "rgba(255,255,255,0.30)",
};

const verifyingStyle: CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.40)",
  fontSize: 10.5,
  fontStyle: "italic",
};
