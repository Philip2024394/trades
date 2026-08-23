// src/components/nexapp/CategoryBusinessCard.tsx
//
// Country Foundation Step 7 Part B · Phase 7B.3 · 2026-08-23.
//
// Compact NEX-styled inline business card. Rendered inside the constellation's
// focused conversation view — NOT a stand-alone directory card. It inherits
// the NEX glass language (dark surface, orange border, subtle glow) and its
// family accent from the active category. Feels like NEX presenting a
// recommendation, not a directory exposing a database row.
//
// Doctrine anchors:
//   project_nex_category_wheel_experience_doctrine_2026_08_22 (Business cards must belong to NEX)
//   project_nex_truth_invariant_2026_08_22 (never fabricate · surface only what's real)
//   project_nex_should_know_not_ask_2026_08_21 (minimum copy · maximum clarity)

"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { NEX } from "@/lib/nexapp/tokens";
import type { DirectoryListing } from "@/app/api/nex-directory/listings/route";

export interface CategoryBusinessCardProps {
  listing: DirectoryListing;
  familyAccent: string;
  index: number;
}

export function CategoryBusinessCard({ listing, familyAccent, index }: CategoryBusinessCardProps) {
  const initial = listing.businessName.charAt(0).toUpperCase();
  const hasImage = listing.heroImageUrl != null && listing.heroImageUrl.length > 0;
  const contact = listing.whatsappNumber || listing.phone;
  const rating = listing.rating != null ? listing.rating.toFixed(1) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.05 * index, ease: "easeOut" }}
      style={cardStyle}
      data-testid="category-business-card"
      data-business-ref={listing.publicListingRef}
    >
      <div style={cardRowStyle}>
        <div
          style={{
            ...thumbStyle,
            background: hasImage
              ? "transparent"
              : `linear-gradient(135deg, rgba(21,21,21,0.9) 0%, rgba(13,13,13,0.85) 100%)`,
            borderColor: familyAccent.replace("1.0", "0.32"),
          }}
          aria-hidden
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.heroImageUrl!}
              alt=""
              style={thumbImgStyle}
              loading="lazy"
            />
          ) : (
            <span style={{ ...thumbInitialStyle, color: familyAccent }}>{initial}</span>
          )}
        </div>

        <div style={bodyStyle}>
          <div style={nameRowStyle}>
            <div style={nameStyle}>{listing.businessName}</div>
            {rating && (
              <div style={ratingStyle} aria-label={`Rated ${rating}`}>
                <span style={{ color: NEX.orange }}>★</span> {rating}
              </div>
            )}
          </div>

          <div style={metaRowStyle}>
            {listing.district && <span style={metaChipStyle}>{listing.district}</span>}
            {!listing.district && listing.city && <span style={metaChipStyle}>{listing.city}</span>}
          </div>

          {contact && (
            <div style={actionRowStyle}>
              {listing.whatsappNumber ? (
                <a
                  href={`https://wa.me/${listing.whatsappNumber.replace(/\D+/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...actionButtonStyle, background: NEX.green, color: "#062219" }}
                >
                  WhatsApp
                </a>
              ) : (
                <a
                  href={`tel:${listing.phone!.replace(/\s+/g, "")}`}
                  style={actionButtonStyle}
                >
                  Call
                </a>
              )}
              {listing.website && (
                <a
                  href={listing.website}
                  target="_blank"
                  rel="noreferrer"
                  style={actionLinkStyle}
                >
                  Site
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// ─── Styles ───

const cardStyle: CSSProperties = {
  background: "rgba(21, 21, 21, 0.85)",
  border: `1px solid ${NEX.borderMuted}`,
  borderRadius: 14,
  padding: 10,
  backdropFilter: "blur(6px)",
  boxShadow: `0 4px 12px rgba(0, 0, 0, 0.35)`,
};

const cardRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
};

const thumbStyle: CSSProperties = {
  flex: "0 0 auto",
  width: 56,
  height: 56,
  borderRadius: 12,
  border: "1px solid",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const thumbImgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const thumbInitialStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: -0.2,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
};

const nameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: NEX.text,
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const ratingStyle: CSSProperties = {
  flex: "0 0 auto",
  fontSize: 11,
  fontWeight: 600,
  color: NEX.text,
  letterSpacing: 0.2,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const metaChipStyle: CSSProperties = {
  fontSize: 10.5,
  color: NEX.textMuted,
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(255, 255, 255, 0.04)",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 4,
};

const actionButtonStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 999,
  background: NEX.orange,
  color: "#0a0a0a",
  textDecoration: "none",
  letterSpacing: 0.2,
};

const actionLinkStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: "5px 10px",
  borderRadius: 999,
  background: "transparent",
  color: NEX.textMuted,
  textDecoration: "none",
  border: `1px solid ${NEX.borderMuted}`,
  letterSpacing: 0.2,
};
