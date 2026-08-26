// src/lib/nex-hq/transport-data-aggregator.ts
//
// Pure aggregator for the HQ Transport Data page. Takes an array of raw
// transport_acquisition_record rows + returns the category × state matrix.
//
// Doctrine: honest counts · never fabricates categories · never promotes a
// discovered row into a verified/active bucket.

export interface TransportRecordRow {
  vehicleTypes: string[];               // e.g. ['motorcycle'] or ['car','airport_transfer']
  discoveryStage: string;               // 'discovered' · 'invitable' · ... · 'active'
  contactability: string;               // 'contactable' · 'unknown' · 'invalid'
  publicWhatsappLink: string | null;
  canonicalPhoneE164: string | null;
}

export interface CategoryAggregation {
  vehicleKind: string;
  discovered: number;
  contactable: number;
  withWhatsapp: number;
  verified: number;
  active: number;
}

export interface AggregationTotals {
  totalRecords: number;
  distinctPhones: number;
  duplicatePhones: number;
  automaticOutreachSent: number;   // must be 0 by doctrine · caller passes it in
}

const VERIFIED_STAGES = new Set(["verified"]);
const ACTIVE_STAGES   = new Set(["active"]);

/**
 * Aggregate rows into per-vehicle-kind counts. A row that carries multiple
 * vehicle_types contributes to each kind's counts (an operator with car AND
 * pickup counts under both). Deduplication for the row itself lives in the
 * schema (UNIQUE canonical_phone_e164).
 */
export function aggregateByVehicleKind(rows: TransportRecordRow[]): CategoryAggregation[] {
  const map = new Map<string, CategoryAggregation>();
  for (const r of rows) {
    for (const kind of r.vehicleTypes) {
      const agg = map.get(kind) ?? {
        vehicleKind: kind, discovered: 0, contactable: 0, withWhatsapp: 0, verified: 0, active: 0,
      };
      agg.discovered++;
      if (r.contactability === "contactable") agg.contactable++;
      if (r.publicWhatsappLink) agg.withWhatsapp++;
      if (VERIFIED_STAGES.has(r.discoveryStage)) agg.verified++;
      if (ACTIVE_STAGES.has(r.discoveryStage)) agg.active++;
      map.set(kind, agg);
    }
  }
  return [...map.values()].sort((a, b) => b.discovered - a.discovered);
}

/**
 * Category totals: total rows · duplicate-phone-count · distinct-phone-count.
 * automaticOutreachSent is passed IN because the HQ page queries the outreach
 * ledger separately · this aggregator refuses to invent that number.
 */
export function computeTotals(
  rows: TransportRecordRow[],
  automaticOutreachSent: number,
): AggregationTotals {
  const phoneCount = new Map<string, number>();
  for (const r of rows) {
    if (r.canonicalPhoneE164) {
      phoneCount.set(r.canonicalPhoneE164, (phoneCount.get(r.canonicalPhoneE164) ?? 0) + 1);
    }
  }
  let duplicates = 0;
  for (const c of phoneCount.values()) if (c > 1) duplicates++;
  return {
    totalRecords: rows.length,
    distinctPhones: phoneCount.size,
    duplicatePhones: duplicates,
    automaticOutreachSent,
  };
}
