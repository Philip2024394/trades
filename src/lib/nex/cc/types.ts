// Nex Construction Cloud — contracts.
//
// A PROPERTY is the stable identity for "this building" across every
// project the homeowner ever runs at that address. Kitchen refit in
// 2026, roof in 2028, extension in 2030 = one Property, three
// Projects. Phase 6 PI is per-project. Phase 12 PM is multi-project.
// Phase 16 CC is per-PROPERTY — longer-lived than either.
//
// Property identity is derived from (homeowner_id + normalised
// address). We don't yet have a persistent os_properties join so this
// resolver is best-effort; the shape is stable so migrating to
// os_properties later is a single-file swap.

import type { Evidence } from "../pi/types";
export type { Evidence };

export type ViewerType = "homeowner" | "merchant";

/** Property identity — stable across projects at the same address. */
export type PropertyRef = {
  property_id:      string;             // derived hash for now (see resolver)
  homeowner_id:     string;
  homeowner_name:   string | null;
  address_line:     string | null;
  address_postcode: string | null;
  address_city:     string | null;
  first_seen_at:    string;             // earliest project.created_at at this address
};

// ─── Timeline entry ──────────────────────────────────────────────

export type PropertyTimelineEntry = {
  at:            string;                // ISO
  event_type:    string;                // "project_started" | "project_completed" | "photo" | "warranty" | "cost_paid" | …
  headline:      string;
  detail?:       string;
  project_id?:   string;
  evidence:      Evidence;
  visible_to?:   ViewerType[];
};

// ─── Assets ──────────────────────────────────────────────────────

export type AssetKind =
  | "kitchen"
  | "bathroom"
  | "boiler"
  | "roof"
  | "windows"
  | "doors"
  | "flooring"
  | "electrical"
  | "plumbing"
  | "heating"
  | "solar"
  | "other";

export type AssetItem = {
  key:              string;                    // stable dedupe key
  kind:             AssetKind;
  label:            string;                    // "Kitchen refit — 2026-07"
  installed_at:     string | null;             // ISO date
  trade_name:       string | null;             // who did the work
  supplier:         string | null;
  warranty_expires_at: string | null;
  next_maintenance_at: string | null;
  cadence_days:     number | null;
  evidence:         Evidence;
};

// ─── Maintenance forecast ────────────────────────────────────────

export type MaintenanceForecastItem = {
  asset_key:      string;
  asset_label:    string;
  next_due_at:    string;
  days_until:     number;
  cadence_days:   number | null;
  status:         "upcoming" | "due_soon" | "overdue";
  suggested_action: string;
  evidence:       Evidence;
};

// ─── Property snapshot ───────────────────────────────────────────

export type PropertySnapshot = {
  property:        PropertyRef;
  viewer:          ViewerType;
  projects_count:  number;
  projects:        Array<{
    project_id:   string;
    title:        string;
    status:       string;
    started_at:   string | null;
    completed_at: string | null;
  }>;
  photos_count:    number;
  documents_count: number;
  costs_total_pence:      number;        // homeowner view: full ledger; merchant view: own costs only
  costs_paid_pence:       number;
  costs_outstanding_pence: number;
  assets:          AssetItem[];
  forecast:        MaintenanceForecastItem[];
  timeline:        PropertyTimelineEntry[];   // sorted desc, capped
  computed_at:     string;
  errors:          Array<{ module: string; error: string }>;
};

// ─── Building Passport ───────────────────────────────────────────

export type BuildingPassport = {
  property:        PropertyRef;
  generated_at:    string;
  summary:         string;
  projects:        PropertySnapshot["projects"];
  assets:          AssetItem[];
  photos_count:    number;
  documents_count: number;
  warranties:      Array<{ title: string; expires_at: string | null; trade: string | null }>;
  maintenance:     MaintenanceForecastItem[];
  future_recommendations: string[];
  disclaimer:      string;
};

// ─── Search ──────────────────────────────────────────────────────

export type PropertySearchResult = {
  property_id:      string;
  address_line:     string | null;
  address_postcode: string | null;
  homeowner_name:   string | null;
  matched_reason:   string;              // "kitchen mentioned in project 'Smith kitchen refit'"
  evidence:         Evidence;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

/** Stable pseudo-id for a property derived from (homeowner + address).
 *  We use SHA-256 of the normalised composite so the same address in
 *  the same postcode always yields the same property_id across queries. */
import { createHash } from "node:crypto";
export function derivePropertyId(homeownerId: string, postcode: string | null, line: string | null): string {
  const key = `${homeownerId}|${(postcode ?? "").toUpperCase().replace(/\s+/g, "")}|${(line ?? "").toLowerCase().trim()}`;
  return "prop_" + createHash("sha256").update(key).digest("hex").slice(0, 16);
}
