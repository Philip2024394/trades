// src/app/nex-native/directory/_directory-card.tsx
//
// NEX Directory · Phase A · The Directory listing card.
//
// What this is
//   · The single reusable Directory listing card component.
//   · Renders the real canonical view-model honestly: real identity,
//     real image when present, real location, real distance when the
//     viewer has granted geolocation, real categories, real
//     destination action.
//   · Missing data disappears gracefully — no "N/A", no fake fields,
//     no fabricated imagery, no made-up ratings, no invented
//     distances.
//
// What this is NOT
//   · Not a parallel Business/Profile detail component — clicking a
//     card takes the user to the EXISTING NEX Business cover or
//     EXISTING NEX user profile. The Directory is a discovery
//     layer INTO NEX.
//   · Not a mutator — card is read-only.
//   · Not a route owner — the Directory only hosts the listing
//     surface; the clicked route is NEX's existing destination.
//
// Destination behaviours (sealed by Phase C discriminated union)
//   nex_business              → full-card <Link> → /nex-native/{slug}
//   nex_user_profile          → full-card <Link> → /nex-native/u/{handle}
//   claim_available           → non-clickable · elegant "owners can
//                               claim this listing" affordance ·
//                               no claim route exists yet, so we do
//                               NOT fabricate one
//   place_detail              → non-clickable · "Directory detail
//                               coming" chip · integration gap
//                               reported in Phase A completion
//   redirect_to_canonical     → should not reach the card (service
//                               layer is responsible for re-resolving
//                               the chain · the server component
//                               pre-filters these)
//   unresolved                → should not reach the card (same ·
//                               the server component pre-filters)

"use client";

import type * as React from "react";
import Link from "next/link";
import type {
  DirectoryClassification,
  DirectoryCoordinates,
  DirectoryDestination,
  DirectoryListingVM,
} from "@/lib/nex-native/directory";
import { formatKmDistance, haversineKmOrNull } from "./_distance";
import { NoImage } from "./_no-image";

const PALETTE = {
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.08)",
  borderSoft: "rgba(255,255,255,0.06)",
} as const;

const CLASSIFICATION_LABEL: Record<DirectoryClassification, string> = {
  business: "Business",
  person: "Person",
  place: "Place",
};

const CLASSIFICATION_ACCENT: Record<DirectoryClassification, string> = {
  business: PALETTE.orange,
  person: PALETTE.cyan,
  place: PALETTE.textDim,
};

export interface DirectoryCardProps {
  readonly listing: DirectoryListingVM;
  readonly destination: DirectoryDestination;
  readonly userCoords: DirectoryCoordinates | null;
}

export function DirectoryCard(props: DirectoryCardProps): React.ReactElement {
  const { listing, destination, userCoords } = props;

  const distanceKm = haversineKmOrNull(userCoords, listing.coordinates);
  const distanceLabel = distanceKm === null ? null : formatKmDistance(distanceKm);
  const place = joinPlace(listing.city, listing.district);

  // Keywords = aliases (variants of the name the user might search).
  // Deliberately NOT fabricated from `name_canonical` or
  // `category_ids` — aliases are a real column with real values.
  const keywords = listing.aliases.filter((a) => a.trim().length > 0);
  const categories = listing.categoryIds.filter((c) => c.trim().length > 0);

  const isLinkable =
    destination.kind === "nex_business" || destination.kind === "nex_user_profile";
  const href =
    destination.kind === "nex_business"
      ? destination.path
      : destination.kind === "nex_user_profile"
        ? destination.path
        : null;
  const actionLabel = buildActionLabel(destination);

  const body = (
    <article
      data-nex-directory-card
      data-nex-directory-card-canonical-id={listing.canonicalBusinessId}
      data-nex-directory-card-classification={listing.classification}
      data-nex-directory-card-destination-kind={destination.kind}
      data-nex-directory-card-linkable={isLinkable ? "true" : "false"}
      data-nex-directory-card-has-image={listing.primaryImage !== null ? "true" : "false"}
      data-nex-directory-card-has-distance={distanceLabel !== null ? "true" : "false"}
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 16,
        padding: 14,
        display: "flex",
        gap: 14,
        alignItems: "stretch",
      }}
    >
      <CardImage
        listing={listing}
        classification={listing.classification}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            data-nex-directory-card-chip="classification"
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: CLASSIFICATION_ACCENT[listing.classification],
            }}
          >
            {CLASSIFICATION_LABEL[listing.classification]}
          </span>
          {distanceLabel !== null ? (
            <span
              data-nex-directory-card-chip="distance"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: PALETTE.textDim,
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${PALETTE.borderSoft}`,
                background: PALETTE.surfaceHi,
              }}
            >
              {distanceLabel}
            </span>
          ) : null}
        </div>
        <h3
          data-nex-directory-card-name
          style={{
            margin: 0,
            color: PALETTE.text,
            fontSize: 17,
            fontWeight: 600,
            lineHeight: 1.25,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {listing.name}
        </h3>
        {place !== null ? (
          <p
            data-nex-directory-card-place
            style={{
              margin: 0,
              color: PALETTE.textMuted,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {place}
          </p>
        ) : null}
        {categories.length > 0 ? (
          <ul
            aria-label="Categories"
            data-nex-directory-card-categories
            style={{
              margin: "2px 0 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {categories.slice(0, 3).map((c) => (
              <li
                key={c}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 8px",
                  background: PALETTE.surfaceHi,
                  color: PALETTE.textDim,
                  borderRadius: 999,
                }}
              >
                {c}
              </li>
            ))}
          </ul>
        ) : null}
        {keywords.length > 0 ? (
          <p
            data-nex-directory-card-keywords
            style={{
              margin: 0,
              color: PALETTE.textSoft,
              fontSize: 12,
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Also known as: {keywords.slice(0, 3).join(" · ")}
          </p>
        ) : null}
        <CardAction destination={destination} actionLabel={actionLabel} />
      </div>
    </article>
  );

  if (isLinkable && href !== null) {
    return (
      <Link
        href={href}
        aria-label={`Open ${listing.name}`}
        data-nex-directory-card-link
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {body}
      </Link>
    );
  }
  return body;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Card image slot
// ═════════════════════════════════════════════════════════════════════

function CardImage(props: {
  readonly listing: DirectoryListingVM;
  readonly classification: DirectoryClassification;
}): React.ReactElement {
  const { listing, classification } = props;
  if (listing.primaryImage !== null) {
    return (
      <div
        data-nex-directory-card-image="present"
        style={{
          width: 92,
          height: 92,
          flexShrink: 0,
          borderRadius: 14,
          overflow: "hidden",
          background: PALETTE.surfaceHi,
          position: "relative",
        }}
      >
        {/* Plain <img> tag · the Phase B contract exposes a plain URL
            string. If a future wave adds next/image optimisation + an
            allowlist for Supabase storage domains, this swaps in-place. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.primaryImage.url}
          alt={listing.primaryImage.altText || listing.name}
          data-nex-directory-card-image-src
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }
  return (
    <div data-nex-directory-card-image="absent" style={{ flexShrink: 0 }}>
      <NoImage classification={classification} name={listing.name} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Card action footer
// ═════════════════════════════════════════════════════════════════════

function CardAction(props: {
  readonly destination: DirectoryDestination;
  readonly actionLabel: string;
}): React.ReactElement | null {
  const { destination, actionLabel } = props;
  if (destination.kind === "nex_business" || destination.kind === "nex_user_profile") {
    return (
      <div
        data-nex-directory-card-action="link"
        style={{
          marginTop: 4,
          color: PALETTE.orange,
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {actionLabel}
        <ArrowGlyph />
      </div>
    );
  }
  if (destination.kind === "claim_available") {
    return (
      <div
        data-nex-directory-card-action="claim-available"
        style={{
          marginTop: 4,
          color: PALETTE.cyan,
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${PALETTE.cyan}`,
          background: PALETTE.cyanFaint,
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <OwnerClaimGlyph />
        Unclaimed · owners can claim this listing
      </div>
    );
  }
  if (destination.kind === "place_detail") {
    return (
      <div
        data-nex-directory-card-action="place-detail"
        style={{
          marginTop: 4,
          color: PALETTE.textMuted,
          fontSize: 12,
          fontWeight: 500,
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${PALETTE.borderSoft}`,
          background: PALETTE.surfaceHi,
          alignSelf: "flex-start",
        }}
      >
        Directory detail · coming later
      </div>
    );
  }
  // Pre-filtered redirect/unresolved should never reach here;
  // defence in depth returns null (no action).
  return null;
}

function ArrowGlyph(): React.ReactElement {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function OwnerClaimGlyph(): React.ReactElement {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3 7h7l-5.6 4.4L18.3 21 12 16.9 5.7 21l1.9-7.6L2 9h7z" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure helpers
// ═════════════════════════════════════════════════════════════════════

function joinPlace(
  city: string | null,
  district: string | null,
): string | null {
  const parts: string[] = [];
  if (district !== null && district.length > 0) parts.push(district);
  if (city !== null && city.length > 0) parts.push(city);
  return parts.length === 0 ? null : parts.join(" · ");
}

function buildActionLabel(destination: DirectoryDestination): string {
  if (destination.kind === "nex_business") return "Open on NEX";
  if (destination.kind === "nex_user_profile") return "View profile";
  if (destination.kind === "claim_available") return "Claim";
  if (destination.kind === "place_detail") return "View place";
  return "";
}
