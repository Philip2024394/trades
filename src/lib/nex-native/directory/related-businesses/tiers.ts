// src/lib/nex-native/directory/related-businesses/tiers.ts
//
// NEX Directory · Related Businesses · Tier resolver.
//
// What this module is
//   · Pure, deterministic helpers that extract two of the three sealed
//     "You may also need" tiers from an anchor's `services_products`
//     jsonb payload (surfaced on the DirectoryListingVM as
//     `verticalPayload`):
//       Tier 1 "provided_by_business"   ← verticalPayload.provided[]
//                                       ← verticalPayload.facilities[]
//       Tier 2 "established_partner"    ← verticalPayload.partners[]
//     The third tier ("nearby_independent") is produced by the sealed
//     radius query in `./service.ts` and is NOT shaped by this module.
//
// What this module is NOT
//   · Not a DB reader. Pure function over an already-fetched anchor.
//   · Not a publication gatekeeper. Partner resolution is wired in
//     `./service.ts`, which filters resolved partner canonicals via
//     `nex.business_directory_v` (sealed D-1 + D-2 publication gate).
//     This file ONLY surfaces the declared partner canonical IDs so
//     that reader can look them up.
//   · Not a fabricator. If `verticalPayload` is null, malformed, or
//     missing the sealed fields, every extractor returns an empty
//     array (honest-empty).
//
// Sealed shape of `verticalPayload` (CONVENTION, not a new column):
//   services_products jsonb (migration 167) is additive · the
//   "provided" / "facilities" / "partners" keys below are a new
//   convention introduced for the three-tier Related Businesses
//   presentation. No migration required.
//
//   {
//     // Tier 1 · the anchor itself offers these services / facilities
//     "provided":   string[]   // e.g. ["Airport pickup","Laundry","Breakfast"]
//     "facilities": string[]   // e.g. ["Swimming pool","Wi-Fi","Parking"]
//
//     // Tier 2 · the anchor has declared these partners (uuids +
//     // optional display label; the reader resolves names via the view)
//     "partners": {
//       "canonical_business_id": "uuid-...",
//       "label"?: "Short display override"
//     }[]
//   }
//
//   Any other keys are ignored. Any malformed entry inside provided /
//   facilities / partners is silently dropped (never surfaced to the
//   visitor as a half-formed row). The anchor's own canonical row is
//   the ONLY source of partnership claims · this module NEVER infers
//   a partnership from proximity or category overlap.
//
// Doctrine
//   · NEVER label a nearby business as a partner — partners come from
//     the anchor's declared `verticalPayload.partners[]` ONLY.
//   · Honest-empty everywhere. No "we think you might also need" copy.

export type RelatedTier =
  | "provided_by_business"
  | "established_partner"
  | "nearby_independent";

export interface TieredRelatedItem {
  readonly tier: RelatedTier;
  /** For "provided_by_business" this is the service / facility name
   *  (e.g. "Airport pickup"). For "established_partner" and
   *  "nearby_independent" this is the related business's display name. */
  readonly label: string;
  /** For "provided_by_business" items this is null (self-reference —
   *  the anchor itself provides this service, so there is no separate
   *  canonical row to link to). For partners and nearby businesses this
   *  is the referenced `nex.business_canonical.canonical_business_id`. */
  readonly canonicalBusinessId: string | null;
  /** Optional one-line description. Not fabricated · set only when the
   *  source payload supplies it. */
  readonly description?: string;
  /** Only populated for "nearby_independent" items — the metre distance
   *  from the anchor computed by the sealed radius query. */
  readonly distanceMeters?: number;
}

export interface TieredRelatedGroup {
  readonly tier: RelatedTier;
  /** The section header shown to the visitor. Sealed vocabulary:
   *    "This business offers"
   *    "Partner services"
   *    "Independent businesses nearby"
   *  The `nearby_independent` tier may still carry nested sub-group
   *  labels (e.g. "Rentals", "Food & drink") via the service layer. */
  readonly groupLabel: string;
  readonly items: readonly TieredRelatedItem[];
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Anchor view-shape for extractors
// ═════════════════════════════════════════════════════════════════════

/** Minimal shape the extractors need. Matches the subset of
 *  `DirectoryListingVM` the service already has in hand, so no extra
 *  fetch is required. */
export interface AnchorForTiers {
  readonly entityType: string;
  readonly verticalPayload: unknown;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure helpers · value guards
// ═════════════════════════════════════════════════════════════════════

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** uuid shape · same rule as `isUuidShape` in `directory-service.ts`.
 *  Permissive on variant nibble, strict on hex digits + dashes. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidString(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Narrow an unknown to a readonly array of unknown without throwing. */
function toUnknownArray(v: unknown): readonly unknown[] {
  return Array.isArray(v) ? v : [];
}

// ═════════════════════════════════════════════════════════════════════
// §3 · extractProvidedByBusiness
// ═════════════════════════════════════════════════════════════════════

/** Pull the "this business offers X" items from the anchor's own
 *  verticalPayload. Reads from `provided[]` AND `facilities[]`.
 *
 *  Both arrays are permitted. The sealed convention is:
 *    · `provided[]` lists services the business delivers on request
 *      (e.g. "Airport pickup", "Laundry", "Breakfast").
 *    · `facilities[]` lists on-premises amenities (e.g. "Swimming pool",
 *      "Wi-Fi", "Parking").
 *  Entries from both arrays flow into the same tier because, to the
 *  visitor, they both answer "what does this business itself provide?".
 *  Order is preserved: all `provided` entries first (in source order),
 *  then all `facilities` entries. Duplicate labels are de-duplicated
 *  (case-insensitive) · the first occurrence wins.
 *
 *  Honest-empty:
 *    · verticalPayload === null                        → []
 *    · verticalPayload not an object                   → []
 *    · neither "provided" nor "facilities" present     → []
 *    · either key present but not an array             → []  (skipped)
 *    · array entries that are not non-empty strings    → dropped
 *
 *  Pure. Deterministic. Zero fabrication. */
export function extractProvidedByBusiness(
  anchor: AnchorForTiers,
): readonly TieredRelatedItem[] {
  if (!isObject(anchor.verticalPayload)) return [];
  const payload = anchor.verticalPayload;

  const provided = toUnknownArray(payload.provided);
  const facilities = toUnknownArray(payload.facilities);

  const seen = new Set<string>();
  const out: TieredRelatedItem[] = [];

  const pushLabel = (raw: unknown): void => {
    if (!isNonEmptyString(raw)) return;
    const label = raw.trim();
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      tier: "provided_by_business",
      label,
      canonicalBusinessId: null,
    });
  };

  for (const entry of provided) pushLabel(entry);
  for (const entry of facilities) pushLabel(entry);

  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · extractEstablishedPartners
// ═════════════════════════════════════════════════════════════════════

/** Pull the declared partner canonicals from the anchor's own
 *  verticalPayload. Each entry MUST be an object with a well-formed
 *  `canonical_business_id` uuid. An optional `label` override is kept
 *  so the UI can display a short name different from the referenced
 *  business's canonical name (used sparingly · the reader prefers the
 *  referenced row's own name_canonical).
 *
 *  This function returns the RAW declared partner list — it does NOT
 *  know whether a partner canonical is itself publishable. The reader
 *  (`./service.ts`) is responsible for filtering unpublishable partner
 *  references via `business_directory_v`.
 *
 *  Honest-empty:
 *    · verticalPayload === null                   → []
 *    · verticalPayload not an object              → []
 *    · partners key missing / not an array        → []
 *    · entry not an object                        → dropped
 *    · entry missing / malformed uuid             → dropped
 *    · duplicate uuid in the same list            → first wins
 *
 *  Pure. Deterministic. Zero fabrication. */
export function extractEstablishedPartners(
  anchor: AnchorForTiers,
): readonly { readonly canonicalBusinessId: string; readonly label?: string }[] {
  if (!isObject(anchor.verticalPayload)) return [];
  const payload = anchor.verticalPayload;
  const partners = toUnknownArray(payload.partners);
  if (partners.length === 0) return [];

  const seen = new Set<string>();
  const out: { readonly canonicalBusinessId: string; readonly label?: string }[] = [];
  for (const raw of partners) {
    if (!isObject(raw)) continue;
    const id = raw.canonical_business_id;
    if (!isUuidString(id)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = raw.label;
    if (isNonEmptyString(label)) {
      out.push({ canonicalBusinessId: id, label: label.trim() });
    } else {
      out.push({ canonicalBusinessId: id });
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Sealed group labels
// ═════════════════════════════════════════════════════════════════════

/** The three sealed group labels. Kept exported so the UI, API, and
 *  tests all reference the same strings · never duplicated inline. */
export const TIER_GROUP_LABELS: Readonly<Record<RelatedTier, string>> = {
  provided_by_business: "This business offers",
  established_partner: "Partner services",
  nearby_independent: "Independent businesses nearby",
} as const;
