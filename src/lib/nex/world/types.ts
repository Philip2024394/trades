// Nex World Model — contracts.
//
// The World Model is a THIN reasoning layer on top of every prior
// engine. It:
//   • Resolves a canonical Location Context for the merchant so
//     regulations, currency, VAT and units always match where the
//     work is happening.
//   • Resolves entities (Customer / Property / Project / Product /
//     Photo) to a common EntityRef so callers can traverse
//     relationships without knowing table names.
//   • Runs impact analysis ("what if I delay X?") by walking those
//     relationships and reporting affected entities.
//   • Runs universal search across every entity kind.
//
// Nothing new gets persisted. Everything reads from the existing
// tables and honours the same permission model as the underlying
// engines.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Location context ───────────────────────────────────────────

export type CountryCode = "UK" | "IE" | "AU" | "US" | "CA" | "NZ" | "AE" | "unknown";
export type UnitSystem  = "metric" | "imperial";

export type LocationSource =
  | "merchant_setting"
  | "active_project"
  | "customer"
  | "device"
  | "ip_fallback"
  | "engine_default";

export type LocationContext = {
  country:   CountryCode;
  region:    string | null;              // e.g. "England" | "Republic of Ireland" | "NSW" | "CA"
  city:      string | null;
  postcode:  string | null;
  source:    LocationSource;
  /** Human note explaining which signal was used. Surfaced to the
   *  merchant so they can override manually. */
  reason:    string;
  evidence:  Evidence;
};

// ─── Region config ──────────────────────────────────────────────

export type RegulationSource = {
  label:    string;                      // "Approved Document K" | "Irish Building Regulations Technical Guidance Document B"
  short:    string;                      // "Part K" | "TGD B"
  url:      string | null;               // Official source. NULL when we don't have one — mandatory honest fallback.
  version?: string;                      // "2013 edition" | "2021" when known
};

export type RegionConfig = {
  country:            CountryCode;
  country_label:      string;
  currency:           "GBP" | "EUR" | "AUD" | "USD" | "CAD" | "NZD" | "AED";
  currency_symbol:    string;
  vat_or_gst_rate:    number;            // percentage, e.g. 20 (UK VAT), 23 (IE VAT), 10 (AU GST)
  vat_or_gst_label:   string;            // "VAT" | "GST" | "Sales Tax"
  unit_system:        UnitSystem;
  /** Regulation source pointers per topic. Every topic must resolve —
   *  when we don't have a per-country source, the value is null and
   *  callers surface the mandated fallback. */
  regulations: {
    building:       RegulationSource | null;
    fire:           RegulationSource | null;
    accessibility:  RegulationSource | null;
    electrical:     RegulationSource | null;
    plumbing:       RegulationSource | null;
    stairs:         RegulationSource | null;
    energy:         RegulationSource | null;
  };
  evidence:           Evidence;
};

// ─── Entity refs + relationships ────────────────────────────────

export type EntityKind =
  | "merchant"
  | "customer"
  | "property"
  | "project"
  | "quote"
  | "job"
  | "cost"
  | "photo"
  | "product"
  | "review"
  | "supplier";

export type EntityRef = {
  kind:   EntityKind;
  id:     string;
  label:  string;                        // display label
};

export type RelationshipKind =
  | "belongs_to"
  | "sits_on"
  | "priced_in"
  | "paid_for"
  | "captured_on"
  | "produced_by"
  | "reviewed_by"
  | "supplied_by";

export type Relationship = {
  from:   EntityRef;
  to:     EntityRef;
  kind:   RelationshipKind;
  evidence: Evidence;
};

export type EntityCloud = {
  root:          EntityRef;
  relationships: Relationship[];
  /** Every distinct entity reached from the root. */
  entities:      EntityRef[];
  evidence:      Evidence;
};

// ─── Impact analysis ────────────────────────────────────────────

export type ImpactChange = {
  kind:   "delay" | "cancel" | "reprice" | "reassign";
  target: EntityRef;
  /** Optional detail — e.g. "delay by 5 days". */
  detail: string;
};

export type ImpactEffect = {
  affected:    EntityRef;
  severity:    "info" | "notice" | "warning" | "alert";
  headline:    string;
  reason:      string;
  evidence:    Evidence;
};

export type ImpactAnalysis = {
  change:         ImpactChange;
  effects:        ImpactEffect[];
  warnings:       string[];
  evidence:       Evidence;
};

// ─── Universal search hit ───────────────────────────────────────

export type UniversalSearchHit = {
  entity:   EntityRef;
  matched:  string;                      // which field matched
  snippet:  string;                      // excerpt showing why it matched
  evidence: Evidence;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

/** MANDATORY honest fallback surfaced whenever a regulation-touching
 *  reply hits a null source for the resolved country. */
export const NO_LOCAL_SOURCE_MESSAGE =
  "I couldn't find an official source for your location. Here's the best available industry guidance, but it should not be treated as a legal or regulatory requirement.";
