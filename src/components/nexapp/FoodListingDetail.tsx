// NEX Food Directory · listing detail view.
// Slides in over the FoodDirectoryPanel · back arrow returns to list.
// Shows hero image · identity · about · menu (claimed) OR verified-only
// note (unclaimed) · never invents dishes/prices per Owner-Provenanced
// Pricing constitutional doctrine.

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import {
  FOOD_CATEGORIES,
  dishesForListing,
  formatDistance,
  formatRupiah,
  type FoodListing,
} from "@/lib/nexapp/foodListings";
import { pickFoodCopy } from "./foodCopy";

export function FoodListingDetail({
  listing,
  onBack,
  language,
}: {
  listing: FoodListing;
  onBack: () => void;
  language: "en" | "id";
}) {
  const t = pickFoodCopy(language);
  const category = FOOD_CATEGORIES.find((c) => c.slug === listing.category);
  const categoryLabel = category
    ? (language === "id" ? category.labelId : category.labelEn)
    : listing.category;
  const dishes = dishesForListing(listing.id);
  const isClaimed = listing.claimStatus === "claimed";

  const badgeText =
    listing.claimStatus === "claimed"   ? t.nexMemberBadge :
    listing.claimStatus === "invited"   ? t.invitedBadge :
    t.notYetClaimedBadge;
  const badgeIsMember = listing.claimStatus === "claimed";

  return (
    <div className="nex-no-scrollbar" style={rootStyle}>
      {/* Back bar */}
      <div style={backBarStyle}>
        <button
          type="button"
          onClick={onBack}
          aria-label={t.backToList}
          style={backBtnStyle}
        >
          ‹ <span style={{ marginLeft: 4 }}>{t.backToList}</span>
        </button>
      </div>

      {/* Hero */}
      <div style={heroWrapStyle}>
        <img
          src={listing.heroImageUrl}
          alt=""
          style={heroImgStyle}
          loading="eager"
        />
        <span style={badgeStyle(badgeIsMember)}>{badgeText}</span>
      </div>

      {/* Identity */}
      <div style={identityStyle}>
        <h2 style={nameStyle}>{listing.name}</h2>
        <div style={metaStyle}>
          <span>{category?.emoji} {categoryLabel}</span>
          <span style={metaSepStyle}>·</span>
          <span>📍 {listing.district}</span>
          {listing.distanceKm != null && (
            <>
              <span style={metaSepStyle}>·</span>
              <span>{formatDistance(listing.distanceKm)}</span>
            </>
          )}
        </div>
        {typeof listing.rating === "number" && (
          <div style={ratingRowStyle}>
            <span style={{ color: NEX.orange, fontWeight: 700 }}>★ {listing.rating.toFixed(1)}</span>
            {listing.reviewCount != null && (
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                · {t.ratingReviews(listing.reviewCount)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* About */}
      {listing.description && (
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>{t.aboutSection}</div>
          <div style={aboutTextStyle}>{listing.description}</div>
        </section>
      )}

      {/* Menu · claimed listings only */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>{t.menuSection}</div>
        {!isClaimed ? (
          <div style={unclaimedNoteStyle}>{t.noMenuUnclaimed}</div>
        ) : dishes.length === 0 ? (
          <div style={unclaimedNoteStyle}>{t.menuComingSoon}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dishes.map((d) => (
              <div key={d.id} style={dishRowStyle(d.availability === "unavailable")}>
                {d.imageUrl && (
                  <img
                    src={d.imageUrl}
                    alt=""
                    style={dishImgStyle}
                    loading="lazy"
                  />
                )}
                <div style={dishBodyStyle}>
                  <div style={dishNameRowStyle}>
                    <span style={dishNameStyle}>{d.name}</span>
                    {d.price != null && d.currency === "IDR" && (
                      <span style={dishPriceStyle}>{formatRupiah(d.price)}</span>
                    )}
                  </div>
                  {d.description && <div style={dishDescStyle}>{d.description}</div>}
                  {d.availability === "unavailable" && (
                    <div style={unavailableTagStyle}>{t.unavailable}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer actions · placeholder wiring */}
      <div style={footerActionsStyle}>
        {!isClaimed && (
          <div style={ownerHintStyle}>{t.ownerClaimHint}</div>
        )}
        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const backBarStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  padding: "8px 8px 6px",
  background: "linear-gradient(180deg, rgba(6,6,6,0.95) 0%, rgba(6,6,6,0) 100%)",
};

const backBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  background: "rgba(0,0,0,0.55)",
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 999,
  padding: "6px 14px 6px 10px",
  color: NEX.text,
  fontSize: 12.5,
  fontWeight: 500,
  cursor: "pointer",
  backdropFilter: "blur(6px)",
};

const heroWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  overflow: "hidden",
  marginTop: -34,   // pull under the sticky back bar
};

const heroImgStyle: CSSProperties = {
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

const identityStyle: CSSProperties = {
  padding: "14px 14px 10px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const nameStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: -0.4,
  lineHeight: 1.2,
  margin: 0,
};

const metaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 4,
  color: "rgba(255,255,255,0.65)",
  fontSize: 12.5,
};

const metaSepStyle: CSSProperties = {
  color: "rgba(255,255,255,0.30)",
};

const ratingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  paddingTop: 4,
};

const sectionStyle: CSSProperties = {
  padding: "10px 14px 14px",
  borderTop: `1px solid rgba(255,255,255,0.06)`,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const sectionHeaderStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 1.8,
  textTransform: "uppercase",
  paddingTop: 4,
};

const aboutTextStyle: CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontSize: 13,
  lineHeight: 1.55,
};

const unclaimedNoteStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12.5,
  lineHeight: 1.55,
  fontStyle: "italic",
  padding: "6px 0",
};

function dishRowStyle(unavailable: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 10px",
    background: "rgba(255,255,255,0.03)",
    border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: 12,
    opacity: unavailable ? 0.55 : 1,
  };
}

const dishImgStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 10,
  objectFit: "cover",
  flex: "0 0 auto",
  border: `1px solid rgba(255,255,255,0.08)`,
};

const dishBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const dishNameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const dishNameStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 14,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
  minWidth: 0,
};

const dishPriceStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 12.5,
  fontWeight: 700,
  flex: "0 0 auto",
};

const dishDescStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 11.5,
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const unavailableTagStyle: CSSProperties = {
  marginTop: 4,
  display: "inline-block",
  fontSize: 10,
  fontWeight: 600,
  color: "#ef4444",
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

const footerActionsStyle: CSSProperties = {
  padding: "0 14px",
  marginTop: "auto",
};

const ownerHintStyle: CSSProperties = {
  color: "rgba(255,255,255,0.40)",
  fontSize: 11,
  fontStyle: "italic",
  padding: "10px 0",
  textAlign: "center",
};
