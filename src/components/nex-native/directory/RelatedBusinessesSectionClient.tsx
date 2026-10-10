"use client";

// src/components/nex-native/directory/RelatedBusinessesSectionClient.tsx
//
// NEX Directory · Related Businesses · CLIENT wrapper.
//
// What this is
//   · Client sibling of the server component `RelatedBusinessesSection`.
//     Fetches the v2 tiered payload from
//       GET /api/nex-directory/v1/related/[canonical_id]
//     and renders THREE stacked sections:
//       1. "This business offers"                 (tier 1 · tier-cyan)
//       2. "Partner services"                     (tier 2 · tier-orange)
//       3. "Independent businesses nearby — not partners of {anchor}"
//                                                  (tier 3 · existing strips)
//
// Honesty & doctrine
//   · Partners NEVER inferred from nearby. They come only from the
//     anchor's declared `verticalPayload.partners[]`.
//   · If all three tiers are empty → muted "No related businesses yet".
//   · If tier 1 empty but tier 3 populated → tier 1 collapses entirely,
//     tier 3 renders normally.
//   · `coordinates === null` on the anchor → the server endpoint will
//     still return tier-1 items if the anchor declares any; tier-3
//     will be empty. If ALL tiers end up empty we render the muted
//     line (not null) so the detail page doesn't go silent.
//   · Loading state is a skeleton, not fabricated content.
//
// Test selectors
//   · data-nex-related                                 section root
//   · data-nex-related-group-count={N}                 non-empty tier count
//   · data-nex-related-tier={tier}                     per tier section
//   · data-nex-related-tier-count={N}                  per tier item count

import * as React from "react";
import type { DirectoryListingVM } from "@/lib/nex-native/directory";

// ─── Palette · match the server variant ─────────────────────────────
const PALETTE = {
  bg: "#020914",
  surface: "#0E1526",
  surfaceHi: "#182540",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#B5C3D6",
  textSoft: "#7D9BC0",
  orange: "#FF7200",
  cyan: "#00AFFF",
  green: "#28D194",
  borderSoft: "rgba(255,255,255,0.08)",
  partnerBorder: "rgba(255,114,0,0.35)",
  partnerBg: "rgba(255,114,0,0.08)",
  providedBorder: "rgba(0,175,255,0.30)",
  providedBg: "rgba(0,175,255,0.06)",
} as const;

// ─── Payload shapes (mirror the route response) ─────────────────────
type RelatedTier =
  | "provided_by_business"
  | "established_partner"
  | "nearby_independent";

interface TieredRelatedItem {
  readonly tier: RelatedTier;
  readonly label: string;
  readonly canonicalBusinessId: string | null;
  readonly description?: string;
  readonly distanceMeters?: number;
}

interface MinibusinessVM {
  readonly canonicalBusinessId: string;
  readonly name: string;
  readonly city: string | null;
  readonly entityType: string;
  readonly categoryIds: readonly string[] | null;
  readonly phoneE164: string | null;
  readonly websiteApex: string | null;
  readonly distanceMeters: number;
  readonly distanceLabel: string;
  readonly rank: number;
}

interface NearbyGroupPayload {
  readonly label: string;
  readonly icon: string | null;
  readonly entityTypes: readonly string[];
  readonly results: readonly MinibusinessVM[];
}

interface TierPayload {
  readonly tier: RelatedTier;
  readonly groupLabel: string;
  readonly items: readonly TieredRelatedItem[];
  readonly nearbyGroups?: readonly NearbyGroupPayload[];
}

interface ApiResponse {
  readonly ok: boolean;
  readonly _schema_version?: string;
  readonly tiers?: readonly TierPayload[];
  readonly groups?: readonly NearbyGroupPayload[]; // backward-compat
  readonly anchor_has_coordinates?: boolean;
  readonly anchor_name?: string;
}

export interface RelatedBusinessesSectionClientProps {
  readonly listing: DirectoryListingVM;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready";
      tiers: readonly TierPayload[];
      anchorName: string;
    }
  | { kind: "no_coords" }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function RelatedBusinessesSectionClient(
  props: RelatedBusinessesSectionClientProps,
): React.ReactElement | null {
  const { listing } = props;

  const [state, setState] = React.useState<LoadState>({ kind: "idle" });

  React.useEffect(() => {
    // Early exit: anchor has no coordinates AND we can't verify tier-1
    // declarations without a fetch · still fetch (tier-1/2 don't need
    // coords), but if the server reports no coords AND zero items,
    // we render nothing.
    let cancelled = false;
    setState({ kind: "loading" });
    const url = `/api/nex-directory/v1/related/${encodeURIComponent(listing.canonicalBusinessId)}`;
    fetch(url, { method: "GET", headers: { Accept: "application/json" } })
      .then(async (r) => {
        const data = (await r.json()) as ApiResponse;
        if (cancelled) return;
        if (!data.ok) {
          setState({ kind: "error", message: "unavailable" });
          return;
        }
        const tiers = (data.tiers ?? []).filter(
          (t) => t.items.length > 0 || (t.nearbyGroups?.length ?? 0) > 0,
        );
        if (tiers.length === 0) {
          if (data.anchor_has_coordinates === false) {
            // No coords + no declared tier-1/2 items → render nothing.
            setState({ kind: "no_coords" });
            return;
          }
          setState({ kind: "empty" });
          return;
        }
        setState({
          kind: "ready",
          tiers,
          anchorName: data.anchor_name ?? listing.name,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "fetch_failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [listing.canonicalBusinessId, listing.name]);

  if (state.kind === "no_coords") return null;

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section
        data-nex-related
        data-nex-related-state="loading"
        aria-busy="true"
        style={mutedBoxStyle()}
      >
        Finding related businesses…
      </section>
    );
  }

  if (state.kind === "empty") {
    return (
      <section
        data-nex-related
        data-nex-related-group-count={0}
        style={mutedBoxStyle(true)}
      >
        No related businesses yet
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section
        data-nex-related
        data-nex-related-state="error"
        style={mutedBoxStyle()}
      >
        Related businesses are temporarily unavailable
      </section>
    );
  }

  // Ready — render three stacked sections (whichever tiers have content).
  return (
    <section
      data-nex-related
      data-nex-related-group-count={state.tiers.length}
      aria-label="Related businesses"
      style={{
        marginTop: 20,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {state.tiers.map((tier) => (
        <TierBlock
          key={tier.tier}
          tier={tier}
          anchorName={state.anchorName}
        />
      ))}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tier block router — each of the 3 tiers has its own visual treatment
// ─────────────────────────────────────────────────────────────────────

function TierBlock({
  tier,
  anchorName,
}: {
  readonly tier: TierPayload;
  readonly anchorName: string;
}): React.ReactElement | null {
  if (tier.tier === "provided_by_business") {
    return <ProvidedByBusinessTier tier={tier} />;
  }
  if (tier.tier === "established_partner") {
    return <EstablishedPartnerTier tier={tier} />;
  }
  return <NearbyIndependentTier tier={tier} anchorName={anchorName} />;
}

// ─────────────────────────────────────────────────────────────────────
// Tier 1 · "This business offers" · compact chip rows · cyan accent
// ─────────────────────────────────────────────────────────────────────

function ProvidedByBusinessTier({
  tier,
}: {
  readonly tier: TierPayload;
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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
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
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
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
// Tier 2 · "Partner services" · subtle orange highlight
// ─────────────────────────────────────────────────────────────────────

function EstablishedPartnerTier({
  tier,
}: {
  readonly tier: TierPayload;
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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {tier.items.map((item) => (
          <PartnerCard key={item.canonicalBusinessId ?? item.label} item={item} />
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
      ? `/nex-native/directory?country=ID&q=${encodeURIComponent(item.label)}`
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
// Tier 3 · "Independent businesses nearby" · existing strip pattern
// ─────────────────────────────────────────────────────────────────────

function NearbyIndependentTier({
  tier,
  anchorName,
}: {
  readonly tier: TierPayload;
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
        <NearbyGroupStrip key={g.label} group={g} />
      ))}
    </div>
  );
}

function NearbyGroupStrip({
  group,
}: {
  readonly group: NearbyGroupPayload;
}): React.ReactElement {
  return (
    <div
      data-nex-related-group={group.label.toLowerCase().replace(/\s+/g, "-")}
      data-nex-related-group-count-row={group.results.length}
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
          gap: 8,
          padding: "0 2px",
        }}
      >
        {group.icon ? (
          <span aria-hidden="true" style={{ fontSize: 15 }}>
            {group.icon}
          </span>
        ) : null}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: PALETTE.text,
          }}
        >
          {group.label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: PALETTE.textSoft,
            marginLeft: 4,
          }}
        >
          {group.results.length}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 4,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {group.results.map((r) => (
          <MiniCard key={r.canonicalBusinessId} business={r} />
        ))}
      </div>
    </div>
  );
}

function MiniCard({ business }: { business: MinibusinessVM }): React.ReactElement {
  const href = `/nex-native/directory?country=ID&q=${encodeURIComponent(business.name)}`;
  return (
    <a
      href={href}
      data-nex-related-mini-card
      data-nex-related-mini-canonical-id={business.canonicalBusinessId}
      style={{
        flex: "0 0 160px",
        scrollSnapAlign: "start",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 10,
        background: PALETTE.surface,
        border: `1px solid ${PALETTE.borderSoft}`,
        borderRadius: 10,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.3,
          color: PALETTE.text,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {business.name}
      </span>
      <span style={{ fontSize: 11, color: PALETTE.textMuted }}>
        {business.city ?? "—"}
      </span>
      <span
        style={{
          marginTop: "auto",
          fontSize: 11,
          color: PALETTE.cyan,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {business.distanceLabel}
      </span>
    </a>
  );
}

// ─── Pure helpers ────────────────────────────────────────────────────

function formatDistanceLabel(distanceM: number | undefined): string {
  if (distanceM === undefined || !Number.isFinite(distanceM) || distanceM < 0) {
    return "";
  }
  if (distanceM < 1000) return `${Math.round(distanceM / 10) * 10} m`;
  const km = distanceM / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function mutedBoxStyle(italic = false): React.CSSProperties {
  return {
    marginTop: 20,
    padding: "12px 14px",
    background: PALETTE.surface,
    border: `1px solid ${PALETTE.borderSoft}`,
    borderRadius: 12,
    color: PALETTE.textMuted,
    fontSize: 12.5,
    ...(italic ? { fontStyle: "italic" as const } : {}),
  };
}
