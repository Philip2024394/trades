// src/lib/nex-native/directory/related-businesses/service.ts
//
// NEX Directory · Related Businesses · server-only reader.
//
// What this module is
//   · The one authoritative server-side read path that answers:
//     "given an anchor canonical row at coordinates (lat, lng), what
//      related businesses exist within <radius> metres, grouped by
//      the relevance map in `./relevance.ts`?"
//   · Reads EXCLUSIVELY from `nex.business_directory_v` (migration 175)
//     so publication gates (D-1 lifecycle · D-2 permission-OR) are
//     enforced inside the view, never in TypeScript.
//   · Opens a read-only pg session (`SET LOCAL default_transaction_read_only = on`)
//     so a bug in SQL construction cannot write.
//   · Honest empty state: a group with zero results is DROPPED from
//     the response · the UI collapses that strip.
//
// What this module is NOT
//   · Not a writer. SELECT only. No INSERT / UPDATE / DELETE.
//   · Not a publication gatekeeper (the view does that).
//   · Not an owner-link resolver (nearby cards link to the Directory
//     query page, not to a face-cover · Phase A integrates via
//     RelatedBusinessesSection).
//   · Not a cache. Reads live every call. Doctrine #7 does NOT apply
//     (public directory data).
//
// Architectural invariants
//   · User-controlled values (coords, entity-type names, radius,
//     limit) are bound as positional parameters · never string-
//     interpolated into SQL text.
//   · PostGIS primitives: `ST_DWithin(coordinates, $anchor, $m)` for
//     the radius predicate (indexable on idx_bc_coordinates_gist via
//     the view's underlying table) + `ST_Distance(coordinates, $anchor)`
//     for the per-row metre distance.
//   · The anchor row is excluded (`canonical_business_id <> $anchor`).
//   · Rows with NULL coordinates are excluded (defensive · ST_DWithin
//     would already drop them).

import "server-only";
import { withClient } from "@/lib/nex/db";
import {
  groupsForAnchor,
  rankScore,
  formatDistanceLabel,
  type AnchorCategory,
  type RelatedGroup,
} from "./relevance";
import {
  extractProvidedByBusiness,
  extractEstablishedPartners,
  TIER_GROUP_LABELS,
  type AnchorForTiers,
  type TieredRelatedGroup,
  type TieredRelatedItem,
} from "./tiers";
import type { EntityType } from "../types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

export interface AnchorCoordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface FetchRelatedBusinessesArgs {
  readonly anchorCanonicalId: string;
  readonly anchorEntityType: AnchorCategory;
  readonly anchorCoords: AnchorCoordinates;
  /** Default 6. Capped at 24 defensively. */
  readonly limitPerGroup?: number;
  /** Default 1500 metres. Capped at 20_000 defensively. */
  readonly radiusMeters?: number;
  /** The anchor's own `services_products` jsonb payload (surfaced on
   *  DirectoryListingVM as `verticalPayload`). Optional · when absent
   *  the tier-1 (provided_by_business) and tier-2 (established_partner)
   *  groups are honest-empty. Tier-3 (nearby_independent) is produced
   *  regardless. */
  readonly anchorVerticalPayload?: unknown;
}

export interface RelatedBusinessResult {
  readonly canonicalBusinessId: string;
  readonly name: string;
  readonly city: string | null;
  readonly entityType: EntityType;
  readonly categoryIds: readonly string[];
  readonly coordinates: AnchorCoordinates;
  readonly phoneE164: string | null;
  readonly websiteApex: string | null;
  readonly distanceMeters: number;
  /** Pre-formatted distance label, e.g. "350 m" or "1.2 km". */
  readonly distanceLabel: string;
  /** Final composite rank · for a global sort when the caller wants
   *  one. Within a single strip the UI already sorts by distance. */
  readonly rank: number;
}

export interface RelatedGroupResult {
  readonly label: string;
  readonly icon?: string;
  readonly relevanceWeight: number;
  readonly results: readonly RelatedBusinessResult[];
}

/**
 * The v2 return shape of {@link fetchRelatedBusinessesTiered}. Three
 * sealed tiers in sealed order:
 *   1. provided_by_business   · the anchor itself offers these
 *   2. established_partner    · the anchor declares these partners
 *   3. nearby_independent     · geographic radius query · existing
 *                               `nearbyGroups` nested here
 * Each tier is OMITTED from the array when its items/groups are empty.
 */
export interface TieredRelatedResult {
  readonly tier: TieredRelatedGroup["tier"];
  readonly groupLabel: string;
  readonly items: readonly TieredRelatedItem[];
  /** Only present for `nearby_independent`. The existing per-entity-type
   *  grouping (Rentals / Food & drink / Attractions / …) nested inside
   *  the single tier-3 bucket. Empty when no nearby results. */
  readonly nearbyGroups?: readonly RelatedGroupResult[];
}

// ═════════════════════════════════════════════════════════════════════
// §2 · SQL · parameterised SELECT against business_directory_v
// ═════════════════════════════════════════════════════════════════════

/** SELECT one group's worth of nearby rows.
 *  Params (positional):
 *    $1  anchor coords as geography(Point,4326)   (wkt built below)
 *    $2  entity_type[]                             (text[])
 *    $3  anchor canonical_business_id              (uuid)
 *    $4  radius in metres                          (int)
 *    $5  LIMIT                                     (int)
 *
 *  Coordinates are projected through `ST_Y::geometry` / `ST_X::geometry`
 *  (same pattern as `directory-service.ts`) so the pg driver can return
 *  structured { lat, lng } without a PostGIS-aware type parser.
 */
const RELATED_SELECT_SQL = `
  SELECT
    canonical_business_id,
    name_canonical,
    city,
    entity_type,
    category_ids,
    phone_e164,
    website_apex,
    ST_Y(coordinates::geometry) AS lat,
    ST_X(coordinates::geometry) AS lng,
    ST_Distance(coordinates, $1::geography) AS distance_m
  FROM nex.business_directory_v
  WHERE entity_type = ANY($2::text[])
    AND canonical_business_id <> $3
    AND coordinates IS NOT NULL
    AND ST_DWithin(coordinates, $1::geography, $4)
  ORDER BY distance_m ASC
  LIMIT $5
`;

// ═════════════════════════════════════════════════════════════════════
// §3 · Helpers
// ═════════════════════════════════════════════════════════════════════

/** Build the WKT POINT for the anchor as a pg geography parameter.
 *  PostGIS reads POINT(lng lat) — longitude FIRST, latitude SECOND.
 *  The bare WKT does not carry a SRID; the SQL casts the parameter to
 *  `geography(Point,4326)` via `$1::geography` and the planner picks
 *  up the SRID from the target column. We additionally force the
 *  srid via `SRID=4326;` prefix (EWKT) for defensive correctness. */
function anchorEwkt(coords: AnchorCoordinates): string {
  return `SRID=4326;POINT(${coords.lng} ${coords.lat})`;
}

function parseNumeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseCoordHalf(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Hard-coded sealed entity_type set · defensive filter.  If the view
 *  somehow returned an entity_type outside the sealed 9, we drop the
 *  row rather than render a defective result. */
const SEALED_ENTITY_TYPES: readonly EntityType[] = [
  "food",
  "accommodation",
  "service",
  "professional",
  "vehicle_rental",
  "marketplace_seller",
  "transport_driver",
  "transport_operator",
  "place",
] as const;

function isSealedEntityType(v: unknown): v is EntityType {
  return typeof v === "string" && (SEALED_ENTITY_TYPES as readonly string[]).includes(v);
}

// ═════════════════════════════════════════════════════════════════════
// §4 · fetchRelatedBusinesses · the one entry point
// ═════════════════════════════════════════════════════════════════════

/** Fetch all relevant RelatedGroups for an anchor, in the order given
 *  by `groupsForAnchor(anchorEntityType)`. Groups with zero results
 *  are OMITTED from the returned array · the UI then renders nothing
 *  (never a fabricated placeholder).
 *
 *  Returns [] when:
 *    · NEX_POSTGRES_URL is not set (dev offline mode)
 *    · the DB throws (table missing, permission failure, etc.)
 *    · every group's query returned zero rows
 *
 *  All three cases collapse to one honest signal to the UI: "no
 *  related businesses available for this listing right now".
 */
export async function fetchRelatedBusinesses(
  args: FetchRelatedBusinessesArgs,
): Promise<readonly RelatedGroupResult[]> {
  const limitPerGroup = Math.min(
    Math.max(1, args.limitPerGroup ?? 6),
    24,
  );
  const radiusMeters = Math.min(
    Math.max(1, args.radiusMeters ?? 1500),
    20_000,
  );
  const groups = groupsForAnchor(args.anchorEntityType);
  if (groups.length === 0) return [];

  const anchor = anchorEwkt(args.anchorCoords);

  // One connection per fetch · run every group's SELECT inside the
  // same read-only transaction. This also means `SET LOCAL
  // default_transaction_read_only = on` scopes to this transaction.
  try {
    const outcome = await withClient(async (client) => {
      // Read-only session gate.
      await client.query("BEGIN");
      try {
        await client.query(
          "SET LOCAL default_transaction_read_only = on",
        );
        const results: RelatedGroupResult[] = [];
        for (const group of groups) {
          const rows = await runGroupQuery(client, {
            anchor,
            anchorCanonicalId: args.anchorCanonicalId,
            entityTypes: group.entityTypes,
            radiusMeters,
            limitPerGroup,
          });
          const mapped = mapRowsToResults(rows, group);
          if (mapped.length === 0) continue; // honest-empty · drop
          results.push({
            label: group.label,
            icon: group.icon,
            relevanceWeight: group.relevanceWeight,
            results: mapped,
          });
        }
        await client.query("COMMIT");
        return results;
      } catch (inner) {
        await client.query("ROLLBACK");
        throw inner;
      }
    });
    return outcome ?? [];
  } catch {
    // Honest empty on any DB failure. Doctrine #7 does not apply here
    // but we still refuse to fabricate.
    return [];
  }
}

interface GroupQueryInputs {
  readonly anchor: string;
  readonly anchorCanonicalId: string;
  readonly entityTypes: readonly EntityType[];
  readonly radiusMeters: number;
  readonly limitPerGroup: number;
}

async function runGroupQuery(
  client: {
    query: (
      text: string,
      params?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  },
  inputs: GroupQueryInputs,
): Promise<Record<string, unknown>[]> {
  const res = await client.query(RELATED_SELECT_SQL, [
    inputs.anchor,
    [...inputs.entityTypes],
    inputs.anchorCanonicalId,
    inputs.radiusMeters,
    inputs.limitPerGroup,
  ]);
  return res.rows ?? [];
}

/** Adapt raw rows to RelatedBusinessResult[]. Applies the optional
 *  `categorySlugs` filter in TypeScript (small result sets · simpler
 *  than parameterising the SQL further). Drops any row with a bad
 *  entity_type (defensive) or missing coordinates (shouldn't happen
 *  because the WHERE excludes them). */
function mapRowsToResults(
  rows: readonly Record<string, unknown>[],
  group: RelatedGroup,
): readonly RelatedBusinessResult[] {
  const slugFilter =
    group.categorySlugs && group.categorySlugs.length > 0
      ? new Set(group.categorySlugs)
      : null;
  const out: RelatedBusinessResult[] = [];
  for (const r of rows) {
    const entityType = r.entity_type;
    if (!isSealedEntityType(entityType)) continue;
    const categoryIds = Array.isArray(r.category_ids)
      ? (r.category_ids as unknown[]).filter(
          (c): c is string => typeof c === "string",
        )
      : [];
    if (slugFilter !== null) {
      if (!categoryIds.some((c) => slugFilter.has(c))) continue;
    }
    const lat = parseCoordHalf(r.lat, -90, 90);
    const lng = parseCoordHalf(r.lng, -180, 180);
    if (lat === null || lng === null) continue;
    const distanceM = parseNumeric(r.distance_m);
    const name = typeof r.name_canonical === "string" ? r.name_canonical : "";
    if (name.trim().length === 0) continue;
    out.push({
      canonicalBusinessId: String(r.canonical_business_id),
      name,
      city: typeof r.city === "string" ? r.city : null,
      entityType,
      categoryIds,
      coordinates: { lat, lng },
      phoneE164: typeof r.phone_e164 === "string" ? r.phone_e164 : null,
      websiteApex: typeof r.website_apex === "string" ? r.website_apex : null,
      distanceMeters: distanceM,
      distanceLabel: formatDistanceLabel(distanceM),
      rank: rankScore(distanceM, group.relevanceWeight),
    });
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §4b · fetchRelatedBusinessesTiered · v2 three-tier shape
// ═════════════════════════════════════════════════════════════════════

/** SELECT the publishable (view-gated) partner rows for the anchor.
 *  Reads EXCLUSIVELY from `nex.business_directory_v` so a declared
 *  partner that is NOT publishable (lifecycle_state / permission gate
 *  excluded by the view) is silently dropped · the UI will not render
 *  a half-truth. Pure parameterised SELECT · no interpolation.
 *
 *  Params (positional):
 *    $1 uuid[] of declared partner canonical_business_ids
 *    $2 anchor canonical_business_id (uuid) · defensive self-exclude
 *
 *  Order preservation: resolved rows come back in whatever order
 *  the view returns them. We re-order to match the anchor's declared
 *  order in TypeScript so the UI respects the business owner's
 *  intended partner priority. */
const PARTNER_RESOLVE_SQL = `
  SELECT
    canonical_business_id,
    name_canonical,
    city,
    entity_type,
    category_ids,
    phone_e164,
    website_apex,
    ST_Y(coordinates::geometry) AS lat,
    ST_X(coordinates::geometry) AS lng
  FROM nex.business_directory_v
  WHERE canonical_business_id = ANY($1::uuid[])
    AND canonical_business_id <> $2
`;

/** Resolve declared partner uuids → publishable mini-business rows.
 *  Partners that are NOT publishable (dropped by the view) are
 *  silently omitted. Order follows the anchor's declared order. */
async function resolvePartners(
  client: {
    query: (
      text: string,
      params?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  },
  args: {
    readonly declared: readonly {
      readonly canonicalBusinessId: string;
      readonly label?: string;
    }[];
    readonly anchorCanonicalId: string;
    readonly anchorCoords: AnchorCoordinates;
  },
): Promise<readonly TieredRelatedItem[]> {
  if (args.declared.length === 0) return [];
  const ids = args.declared.map((p) => p.canonicalBusinessId);
  const res = await client.query(PARTNER_RESOLVE_SQL, [
    ids,
    args.anchorCanonicalId,
  ]);
  const rows = res.rows ?? [];
  // Map by id for O(1) lookup when re-ordering to declared order
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const id =
      typeof r.canonical_business_id === "string"
        ? r.canonical_business_id
        : null;
    if (id === null) continue;
    byId.set(id, r);
  }
  const anchorLat = args.anchorCoords.lat;
  const anchorLng = args.anchorCoords.lng;
  const items: TieredRelatedItem[] = [];
  for (const declared of args.declared) {
    const row = byId.get(declared.canonicalBusinessId);
    if (row === undefined) continue; // not publishable · drop (honest)
    const name =
      typeof row.name_canonical === "string" ? row.name_canonical : "";
    if (name.trim().length === 0) continue;
    const lat = parseCoordHalf(row.lat, -90, 90);
    const lng = parseCoordHalf(row.lng, -180, 180);
    const distanceM =
      lat !== null && lng !== null
        ? haversineMeters(anchorLat, anchorLng, lat, lng)
        : undefined;
    const label =
      declared.label !== undefined && declared.label.trim().length > 0
        ? declared.label.trim()
        : name;
    const item: TieredRelatedItem = {
      tier: "established_partner",
      label,
      canonicalBusinessId: declared.canonicalBusinessId,
      ...(distanceM !== undefined ? { distanceMeters: distanceM } : {}),
    };
    items.push(item);
  }
  return items;
}

/** Pure Haversine distance in metres. Used only for partner tier where
 *  we don't want to pay the cost of ST_Distance in the partner SELECT
 *  (partner lists are tiny · 0-10 entries). Reference radius 6371 km. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** v2 tiered reader · returns a three-tier payload. Tiers 1 + 2 come
 *  from the anchor's own `verticalPayload` (pure extraction) · tier 3
 *  reuses the sealed radius query from {@link fetchRelatedBusinesses}.
 *
 *  Honest-empty semantics:
 *    · Tier 1 omitted entirely when `extractProvidedByBusiness` → [].
 *    · Tier 2 omitted entirely when `extractEstablishedPartners` → []
 *      OR when all declared partners are unpublishable (view-dropped).
 *    · Tier 3 omitted entirely when the radius query returns no groups.
 *    · All three empty → the function returns [] · the UI then shows a
 *      muted "No related businesses yet" line.
 *
 *  Deterministic ordering: provided → partner → nearby. */
export async function fetchRelatedBusinessesTiered(
  args: FetchRelatedBusinessesArgs,
): Promise<readonly TieredRelatedResult[]> {
  // Tier 1 · pure extraction, no DB
  const anchorForTiers: AnchorForTiers = {
    entityType: args.anchorEntityType,
    verticalPayload: args.anchorVerticalPayload ?? null,
  };
  const providedItems = extractProvidedByBusiness(anchorForTiers);
  const declaredPartners = extractEstablishedPartners(anchorForTiers);

  // Tier 3 · sealed radius query (reused, same semantics as v1)
  const nearbyGroups = await fetchRelatedBusinesses(args);

  // Tier 2 · partner resolution via the sealed publication view.
  // One short-lived connection, piggy-backed on the same read-only
  // transaction pattern as `fetchRelatedBusinesses` but a separate
  // call because partner resolution is unrelated to the radius query.
  let partnerItems: readonly TieredRelatedItem[] = [];
  if (declaredPartners.length > 0) {
    try {
      const outcome = await withClient(async (client) => {
        await client.query("BEGIN");
        try {
          await client.query(
            "SET LOCAL default_transaction_read_only = on",
          );
          const resolved = await resolvePartners(client, {
            declared: declaredPartners,
            anchorCanonicalId: args.anchorCanonicalId,
            anchorCoords: args.anchorCoords,
          });
          await client.query("COMMIT");
          return resolved;
        } catch (inner) {
          await client.query("ROLLBACK");
          throw inner;
        }
      });
      partnerItems = outcome ?? [];
    } catch {
      // Honest empty on any DB failure.
      partnerItems = [];
    }
  }

  const out: TieredRelatedResult[] = [];
  if (providedItems.length > 0) {
    out.push({
      tier: "provided_by_business",
      groupLabel: TIER_GROUP_LABELS.provided_by_business,
      items: providedItems,
    });
  }
  if (partnerItems.length > 0) {
    out.push({
      tier: "established_partner",
      groupLabel: TIER_GROUP_LABELS.established_partner,
      items: partnerItems,
    });
  }
  if (nearbyGroups.length > 0) {
    // Flatten nearby groups into tier-3 `items` (one entry per nearby
    // business) AND preserve the per-entity-type grouping in
    // `nearbyGroups` so the UI can keep its horizontal-strip pattern.
    const items: TieredRelatedItem[] = [];
    for (const group of nearbyGroups) {
      for (const r of group.results) {
        items.push({
          tier: "nearby_independent",
          label: r.name,
          canonicalBusinessId: r.canonicalBusinessId,
          distanceMeters: r.distanceMeters,
        });
      }
    }
    out.push({
      tier: "nearby_independent",
      groupLabel: TIER_GROUP_LABELS.nearby_independent,
      items,
      nearbyGroups,
    });
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Pure helpers exported for tests
// ═════════════════════════════════════════════════════════════════════

export const _internal = {
  RELATED_SELECT_SQL,
  PARTNER_RESOLVE_SQL,
  anchorEwkt,
  parseCoordHalf,
  parseNumeric,
  isSealedEntityType,
  SEALED_ENTITY_TYPES,
  mapRowsToResults,
  haversineMeters,
};
