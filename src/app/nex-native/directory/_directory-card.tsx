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
//   claim_available           → full-card <Link> → /nex-native/directory/{id}
//                               (Directory-side detail page · no "Unclaimed"
//                               label shown to visitors · ownership state
//                               is preserved internally via
//                               data-nex-directory-card-destination-kind
//                               for future NEX Marketing / acquisition work)
//   place_detail              → full-card <Link> → /nex-native/directory/{id}
//                               (same Directory-side detail page · place
//                               entities are not claimable; the detail
//                               page shows read-only canonical content)
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
import { buildDirectoryDetailPath } from "./_routes";
import { CardCtaStrip } from "@/components/nex-native/directory/CardCtaStrip";
import {
  resolveCategoryImage,
  type CategoryImageLibraryRow,
  type CategoryImageResolved,
} from "@/lib/nex-native/directory/category-image-resolver";

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
  /** Opens the slide-up Directory detail panel. Wired by the parent
   *  (Agent B's results surface). Optional so the card remains
   *  usable in SSR / isolation / disabled contexts — the CTA strip
   *  renders the "View X" button as a disabled `<button>` when the
   *  callback is absent. */
  readonly onOpenDetail?: () => void;
  /** Opens the sealed listing-chat panel. Wired by the parent (Agent
   *  B's results surface). Optional for the same reasons as
   *  onOpenDetail; the "Message" CTA renders disabled when absent. */
  readonly onOpenChat?: () => void;
  /** The curated category-image library · threaded from page.tsx →
   *  DirectoryResults → each card. Used to resolve a representative
   *  illustration when the listing has no OWNER_IMAGE / VERIFIED_REAL
   *  primary image. Empty array when the DB is unreachable or the
   *  library has not been seeded · the card then renders the honest
   *  no-image fallback. */
  readonly categoryImageLibrary?: readonly CategoryImageLibraryRow[];
}

export function DirectoryCard(props: DirectoryCardProps): React.ReactElement {
  const {
    listing,
    destination,
    userCoords,
    onOpenDetail,
    onOpenChat,
    categoryImageLibrary,
  } = props;

  const distanceKm = haversineKmOrNull(userCoords, listing.coordinates);
  const distanceLabel = distanceKm === null ? null : formatKmDistance(distanceKm);
  // "Distance from me" is a standard card feature. When either side's
  // coordinates are missing (user has not granted geolocation yet, or
  // the canonical listing has no coordinates) the chip renders
  // "Location Unconfirmed" · an honest status label, not a fabricated
  // distance.
  const distanceChipLabel =
    distanceLabel !== null ? distanceLabel : "Location Unconfirmed";
  const distanceChipKind: "known" | "unconfirmed" =
    distanceLabel !== null ? "known" : "unconfirmed";
  const place = joinPlace(listing.city, listing.district);

  // Keywords = aliases (variants of the name the user might search).
  // Deliberately NOT fabricated from `name_canonical` or
  // `category_ids` — aliases are a real column with real values.
  const keywords = listing.aliases.filter((a) => a.trim().length > 0);
  const categories = listing.categoryIds.filter((c) => c.trim().length > 0);

  // Every destination kind that reaches the card (page.tsx pre-filters
  // redirect_to_canonical + unresolved) now routes somewhere real:
  //   nex_business      → owner's existing /nex-native/{slug}
  //   nex_user_profile  → owner's existing /nex-native/u/{handle}
  //   claim_available   → Directory-side /nex-native/directory/{id}
  //   place_detail      → Directory-side /nex-native/directory/{id}
  // "Unclaimed" / ownership-status labels are deliberately NOT exposed
  // to the visitor; that state is preserved internally via
  // `data-nex-directory-card-destination-kind` for future acquisition work.
  const href = buildHref(destination);
  const isLinkable = href !== null;
  const actionLabel = buildActionLabel(destination);

  // Resolve a representative category illustration when the listing
  // has no OWNER_IMAGE / VERIFIED_REAL primary image. Pure · deterministic:
  // same (library snapshot + canonical id) → same variant on every render.
  // Returns null when the library hasn't been seeded OR when no tier
  // matches · the hero slot then renders the no-image fallback honestly.
  const representativeImage: CategoryImageResolved | null =
    listing.primaryImage === null && categoryImageLibrary !== undefined
      ? resolveCategoryImage({
          libraryRows: categoryImageLibrary,
          entityType: listing.entityType,
          categoryIds: listing.categoryIds,
          canonicalBusinessId: listing.canonicalBusinessId,
        })
      : null;

  const body = (
    <article
      data-nex-directory-card
      data-nex-directory-card-canonical-id={listing.canonicalBusinessId}
      data-nex-directory-card-classification={listing.classification}
      data-nex-directory-card-destination-kind={destination.kind}
      data-nex-directory-card-linkable={isLinkable ? "true" : "false"}
      data-nex-directory-card-has-image={listing.primaryImage !== null ? "true" : "false"}
      data-nex-directory-card-has-representative={representativeImage !== null ? "true" : "false"}
      data-nex-directory-card-has-distance={distanceLabel !== null ? "true" : "false"}
      style={{
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hero slot · fills the full card width above the body row. When
          the listing has a real primary image, the inline <CardImage>
          below still renders the small 92×92 identity thumb inside the
          body so claimed listings keep their proven card shape · this
          hero is purely the representative-illustration layer for
          unclaimed canonical rows (ADR-0022-compliant). */}
      {listing.primaryImage === null ? (
        <CategoryHero
          resolved={representativeImage}
          classification={listing.classification}
          name={listing.name}
        />
      ) : null}
      <div
        style={{
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
          <span
            data-nex-directory-card-chip="distance"
            data-nex-directory-card-distance-kind={distanceChipKind}
            aria-label={
              distanceChipKind === "known"
                ? `${distanceChipLabel} away`
                : "Distance from you is unavailable because location has not been shared or this listing has no coordinates"
            }
            style={{
              fontSize: 11,
              fontWeight: 600,
              color:
                distanceChipKind === "known"
                  ? PALETTE.textDim
                  : PALETTE.textSoft,
              padding: "2px 8px",
              borderRadius: 999,
              border: `1px solid ${PALETTE.borderSoft}`,
              background:
                distanceChipKind === "known"
                  ? PALETTE.surfaceHi
                  : "transparent",
            }}
          >
            {distanceChipLabel}
          </span>
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
        {/* Data-conditional CTA strip. Buttons appear only when the
            underlying field on the real VM is present — never
            fabricated. Message is always shown; it defers to the
            parent-wired onOpenChat. "View X" is entity-type-aware and
            defers to onOpenDetail. The strip's stopPropagation on
            CTA clicks prevents the surrounding whole-card <Link>
            from swallowing the tap. */}
        <CardCtaStrip
          listing={listing}
          onOpenDetail={onOpenDetail}
          onOpenChat={onOpenChat}
        />
      </div>
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
// §0 · Category hero (representative illustration · ADR-0022)
// ═════════════════════════════════════════════════════════════════════

/** The full-width hero that renders at the top of a card when the
 *  listing has no OWNER_IMAGE / VERIFIED_REAL primary image. If the
 *  resolver returned a representative illustration from the curated
 *  library (nex.category_image_library · migration 112) we render it
 *  with an honest "Representative illustration" caption. If the
 *  resolver returned null (library empty / unseeded / no tier match)
 *  we render a styled no-image panel at the same dimensions so card
 *  heights stay consistent. */
function CategoryHero(props: {
  readonly resolved: CategoryImageResolved | null;
  readonly classification: DirectoryClassification;
  readonly name: string;
}): React.ReactElement {
  const { resolved, classification, name } = props;
  if (resolved === null) {
    return (
      <div
        data-nex-directory-card-hero="absent"
        style={{
          width: "100%",
          aspectRatio: "4 / 3",
          background: PALETTE.surfaceHi,
          borderBottom: `1px solid ${PALETTE.borderSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <NoImage classification={classification} name={name} size="hero" />
      </div>
    );
  }
  return (
    <div
      data-nex-directory-card-hero="representative"
      data-nex-directory-card-hero-slug={resolved.category_slug}
      data-nex-directory-card-hero-variant={resolved.variant_tag ?? ""}
      style={{
        width: "100%",
        aspectRatio: "4 / 3",
        position: "relative",
        background: PALETTE.surfaceHi,
        borderBottom: `1px solid ${PALETTE.borderSoft}`,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved.url}
        alt={`Representative illustration · ${resolved.category_slug}${resolved.variant_tag ? ` · ${resolved.variant_tag}` : ""}`}
        data-nex-directory-card-hero-img
        loading="lazy"
        decoding="async"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
      {/* Honest ADR-0022 caption · overlaid bottom-right · the Directory
          never pretends a representative illustration is a photograph of
          the specific business. */}
      <span
        data-nex-directory-card-hero-caption
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          padding: "3px 8px",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: PALETTE.textDim,
          background: "rgba(2,9,20,0.72)",
          border: `1px solid ${PALETTE.borderSoft}`,
          borderRadius: 999,
          pointerEvents: "none",
        }}
      >
        Representative illustration
      </span>
    </div>
  );
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
  // Visitor-facing action is a uniform inline chevron for every real
  // destination kind. The label varies with the destination kind
  // (see buildActionLabel) but the ownership state is NEVER exposed
  // to the visitor as copy — the Directory does not say "Unclaimed",
  // does not say "coming soon", does not expose any internal state.
  // Internal state remains in data-nex-directory-card-destination-kind
  // on the <article> for future acquisition / Marketing work.
  if (
    destination.kind === "nex_business" ||
    destination.kind === "nex_user_profile" ||
    destination.kind === "claim_available" ||
    destination.kind === "place_detail"
  ) {
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
  // Pre-filtered redirect_to_canonical / unresolved should never reach
  // the card; defence in depth returns null (no action).
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

/** Build the full-card href for every renderable destination kind.
 *  Returns null for destinations that should never reach the card
 *  (redirect_to_canonical / unresolved · pre-filtered in page.tsx).
 *
 *  Owner-claimed destinations route to their existing NEX cover /
 *  profile. Everything else routes to the Directory-side detail page.
 *  No destination kind is a dead card. */
function buildHref(destination: DirectoryDestination): string | null {
  if (destination.kind === "nex_business") return destination.path;
  if (destination.kind === "nex_user_profile") return destination.path;
  if (destination.kind === "claim_available") {
    return buildDirectoryDetailPath(destination.canonicalBusinessId);
  }
  if (destination.kind === "place_detail") {
    return buildDirectoryDetailPath(destination.canonicalBusinessId);
  }
  return null;
}

/** Visitor-facing action label. Does NOT expose ownership state.
 *  claim_available and place_detail both read "View details" so a
 *  visitor sees the Directory as one coherent discovery surface. */
function buildActionLabel(destination: DirectoryDestination): string {
  if (destination.kind === "nex_business") return "Open on NEX";
  if (destination.kind === "nex_user_profile") return "View profile";
  if (destination.kind === "claim_available") return "View details";
  if (destination.kind === "place_detail") return "View details";
  return "";
}
