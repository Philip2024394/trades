// src/components/nex-native/directory/RelatedBusinessesSection.tsx
//
// NEX Directory · Related Businesses · listing-detail three-tier section.
//
// What this component is
//   · Server component that fetches related businesses via
//     `fetchRelatedBusinessesTiered` and renders THREE stacked tiers:
//       1. "This business offers"             · services on the anchor
//       2. "Partner services"                 · partners declared by the anchor
//       3. "Independent businesses nearby — not partners of {anchor}"
//
// Doctrine
//   · Partners are declared on the anchor's own canonical row
//     (`verticalPayload.partners[]`) ONLY — a nearby business is NEVER
//     labelled as a partner.
//   · Honest-empty: when all three tiers are empty, render a muted
//     "No related businesses yet" line (do not render an empty section
//     with just a header).
//   · When tier 1 is empty but tier 3 is populated, tier 1 collapses
//     entirely and tier 3 renders normally.
//
// Test selectors (match the client wrapper)
//   · data-nex-related                                 section root
//   · data-nex-related-group-count={N}                 non-empty tier count
//   · data-nex-related-tier={tier}                     per tier section
//   · data-nex-related-tier-count={N}                  per tier item count

import type * as React from "react";
import {
  fetchRelatedBusinessesTiered,
  type TieredRelatedResult,
  type RelatedBusinessResult,
  type RelatedGroupResult,
} from "@/lib/nex-native/directory/related-businesses/service";
import type { TieredRelatedItem } from "@/lib/nex-native/directory/related-businesses/tiers";
import type { DirectoryListingVM } from "@/lib/nex-native/directory";
import { buildDirectoryDetailPath } from "@/app/nex-native/directory/_routes";

const PALETTE = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  borderSoft: "rgba(255,255,255,0.08)",
  partnerBorder: "rgba(255,114,0,0.35)",
  partnerBg: "rgba(255,114,0,0.08)",
  providedBorder: "rgba(0,175,255,0.30)",
  providedBg: "rgba(0,175,255,0.06)",
} as const;

export interface RelatedBusinessesSectionProps {
  readonly listing: DirectoryListingVM;
}

export async function RelatedBusinessesSection(
  props: RelatedBusinessesSectionProps,
): Promise<React.ReactElement | null> {
  const { listing } = props;

  // Anchor with no coordinates can still have tier-1 / tier-2 payloads,
  // but tier-3 (radius) is impossible. Fetch anyway so declared tier-1
  // items still surface. If every tier ends up empty, we render nothing.
  const hasCoords = listing.coordinates !== null;

  let tiers: readonly TieredRelatedResult[] = [];
  try {
    tiers = await fetchRelatedBusinessesTiered({
      anchorCanonicalId: listing.canonicalBusinessId,
      anchorEntityType: listing.entityType,
      anchorCoords: hasCoords
        ? { lat: listing.coordinates!.lat, lng: listing.coordinates!.lng }
        : { lat: 0, lng: 0 },
      anchorVerticalPayload: listing.verticalPayload,
      // Force tier-3 empty when the anchor has no coords.
      ...(hasCoords ? {} : { radiusMeters: 1 }),
    });
  } catch {
    tiers = [];
  }

  // Drop any tier that would render empty.
  const nonEmpty = tiers.filter(
    (t) =>
      t.items.length > 0 || (t.nearbyGroups !== undefined && t.nearbyGroups.length > 0),
  );

  if (nonEmpty.length === 0) {
    // Honest empty · a muted line (not null) so the detail page
    // explains the gap rather than appearing broken.
    if (!hasCoords) return null; // no coords AND nothing declared → render nothing
    return (
      <section
        data-nex-related
        data-nex-related-group-count={0}
        style={{
          marginTop: 20,
          padding: "12px 14px",
          background: PALETTE.surface,
          border: `1px solid ${PALETTE.borderSoft}`,
          borderRadius: 12,
          color: PALETTE.textMuted,
          fontSize: 12.5,
          fontStyle: "italic",
        }}
      >
        No related businesses yet
      </section>
    );
  }

  return (
    <section
      data-nex-related
      data-nex-related-group-count={nonEmpty.length}
      aria-label="Related businesses"
      style={{
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {nonEmpty.map((tier) => {
        if (tier.tier === "provided_by_business") {
          return <ProvidedByBusinessTier key={tier.tier} tier={tier} />;
        }
        if (tier.tier === "established_partner") {
          return <EstablishedPartnerTier key={tier.tier} tier={tier} />;
        }
        return (
          <NearbyIndependentTier
            key={tier.tier}
            tier={tier}
            anchorName={listing.name}
          />
        );
      })}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tier 1 · "This business offers"
// ─────────────────────────────────────────────────────────────────────

function ProvidedByBusinessTier({
  tier,
}: {
  readonly tier: TieredRelatedResult;
}): React.ReactElement {
  return (
    <div
      data-nex-related-tier="provided_by_business"
      data-nex-related-tier-count={tier.items.length}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        background: PALETTE.providedBg,
        border: `1px solid ${PALETTE.providedBorder}`,
        borderRadius: 12,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: PALETTE.cyan,
          }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: PALETTE.text,
          }}
        >
          {tier.groupLabel}
        </h3>
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tier.items.map((item, idx) => (
          <span
            key={`${idx}-${item.label}`}
            data-nex-related-provided-chip
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: PALETTE.cyan,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(0,175,255,0.10)",
              border: `1px solid rgba(0,175,255,0.30)`,
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tier 2 · "Partner services"
// ─────────────────────────────────────────────────────────────────────

function EstablishedPartnerTier({
  tier,
}: {
  readonly tier: TieredRelatedResult;
}): React.ReactElement {
  return (
    <div
      data-nex-related-tier="established_partner"
      data-nex-related-tier-count={tier.items.length}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        background: PALETTE.partnerBg,
        border: `1px solid ${PALETTE.partnerBorder}`,
        borderRadius: 12,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: PALETTE.orange,
          }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: PALETTE.text,
          }}
        >
          {tier.groupLabel}
        </h3>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tier.items.map((item) => (
          <PartnerCard
            key={item.canonicalBusinessId ?? item.label}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}

function PartnerCard({
  item,
}: {
  readonly item: TieredRelatedItem;
}): React.ReactElement {
  const href =
    item.canonicalBusinessId !== null
      ? buildDirectoryDetailPath(item.canonicalBusinessId)
      : "#";
  const distanceLabel = formatDistanceLabel(item.distanceMeters);
  return (
    <a
      href={href}
      data-nex-related-partner-card
      data-nex-related-partner-canonical-id={item.canonicalBusinessId ?? ""}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: PALETTE.text,
            lineHeight: 1.3,
          }}
        >
          {item.label}
        </span>
        <span
          data-nex-related-partner-badge
          style={{
            alignSelf: "flex-start",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: PALETTE.orange,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(255,114,0,0.10)",
            border: `1px solid rgba(255,114,0,0.35)`,
          }}
        >
          Established partner
        </span>
      </div>
      {distanceLabel.length > 0 ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: PALETTE.cyan,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {distanceLabel}
        </span>
      ) : null}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tier 3 · "Independent businesses nearby"
// ─────────────────────────────────────────────────────────────────────

function NearbyIndependentTier({
  tier,
  anchorName,
}: {
  readonly tier: TieredRelatedResult;
  readonly anchorName: string;
}): React.ReactElement {
  const groups = tier.nearbyGroups ?? [];
  return (
    <div
      data-nex-related-tier="nearby_independent"
      data-nex-related-tier-count={tier.items.length}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          padding: "0 2px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: PALETTE.text,
          }}
        >
          {tier.groupLabel}
        </h3>
        <span style={{ fontSize: 10.5, color: PALETTE.textSoft }}>
          not partners of {anchorName}
        </span>
      </header>
      {groups.map((g) => (
        <RelatedStrip key={g.label} group={g} />
      ))}
    </div>
  );
}

function RelatedStrip(props: {
  readonly group: RelatedGroupResult;
}): React.ReactElement {
  const { group } = props;
  return (
    <div
      data-nex-related-group={group.label}
      data-nex-related-group-count-in-strip={group.results.length}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "0 2px",
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: PALETTE.text,
          }}
        >
          {group.label}
        </h4>
        <span
          data-nex-related-group-badge
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: PALETTE.textMuted,
            padding: "2px 8px",
            borderRadius: 999,
            background: PALETTE.surface,
            border: `1px solid ${PALETTE.borderSoft}`,
          }}
        >
          {group.results.length}
        </span>
      </div>
      <div
        data-nex-related-strip
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 10,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 4,
        }}
      >
        {group.results.map((r) => (
          <MiniCard key={r.canonicalBusinessId} result={r} />
        ))}
      </div>
    </div>
  );
}

function MiniCard(props: {
  readonly result: RelatedBusinessResult;
}): React.ReactElement {
  const { result } = props;
  const href = buildDirectoryDetailPath(result.canonicalBusinessId);
  const initial = result.name.trim().charAt(0).toUpperCase() || "·";
  return (
    <a
      href={href}
      data-nex-related-card={result.canonicalBusinessId}
      data-nex-related-card-entity-type={result.entityType}
      style={{
        flex: "0 0 auto",
        width: 128,
        scrollSnapAlign: "start",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
        textDecoration: "none",
        color: PALETTE.text,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: "100%",
          height: 90,
          borderRadius: 8,
          background: PALETTE.surfaceHi,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 700,
          color: PALETTE.textMuted,
          letterSpacing: 0,
          overflow: "hidden",
        }}
      >
        {initial}
      </div>
      <div
        title={result.name}
        style={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.25,
          color: PALETTE.text,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minHeight: 30,
        }}
      >
        {result.name}
      </div>
      {result.distanceLabel.length > 0 ? (
        <span
          data-nex-related-card-distance
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            fontSize: 10.5,
            fontWeight: 700,
            color: PALETTE.cyan,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(0,175,255,0.08)",
            border: `1px solid rgba(0,175,255,0.25)`,
          }}
        >
          {result.distanceLabel}
        </span>
      ) : null}
    </a>
  );
}

// ─── Pure helper ─────────────────────────────────────────────────────

function formatDistanceLabel(distanceM: number | undefined): string {
  if (distanceM === undefined || !Number.isFinite(distanceM) || distanceM < 0) {
    return "";
  }
  if (distanceM < 1000) return `${Math.round(distanceM / 10) * 10} m`;
  const km = distanceM / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
