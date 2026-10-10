// src/lib/nex/discovery-world/types.ts
//
// NEX World Discovery · types
// Founder-authorised programme · bounded wave · 2026-09-21.
//
// Sibling to (not part of) src/lib/nex/discovery-intel/ · this module models
// canonical world geography + per-country crawler state + business evidence.
// Governance boundaries preserved:
//   * SOURCE_UNAVAILABLE distinct from ZERO_RESULTS
//   * Activity indicator reflects real DB state only · no fake pulse
//   * Founder-only surfaces may show emails · member-facing surfaces never do

export type Region = "Americas" | "Europe" | "Africa" | "Middle East" | "Asia" | "Oceania" | "Antarctica";

export type CountryStatus =
  | "idle"
  | "queued"
  | "crawling"
  | "processing"
  | "new_data"
  | "partial"
  | "zero_results"
  | "source_unavailable"
  | "blocked"
  | "completed";

/** Status values that count as "active work happening right now" · UI colour uses this. */
export const ACTIVE_STATUSES: ReadonlyArray<CountryStatus> = ["crawling", "processing"];

/** How long a claimed slot is honoured before it self-expires (dead workers). */
export const ACTIVITY_TTL_SECONDS = 180;

export interface WorldCountry {
  readonly iso_alpha_2: string;
  readonly iso_alpha_3: string;
  readonly numeric_code: string;
  readonly name: string;
  readonly region: Region;
  readonly subregion: string;
  readonly un_member: boolean;
  readonly sovereign: boolean;
  readonly active_in_nex: boolean;
}

export interface DiscoveryProgramme {
  readonly programme_id: string;
  readonly slug: string;
  readonly display_name: string;
  readonly topic: string;
  readonly status: "active" | "paused" | "archived";
  readonly cadence_seconds: number;
  readonly policy_json: Readonly<Record<string, unknown>>;
}

export interface CountryState {
  readonly programme_id: string;
  readonly iso_alpha_2: string;
  readonly status: CountryStatus;
  readonly current_cycle_id: string | null;
  readonly last_cycle_id: string | null;
  readonly claimed_at: string | null;
  readonly claimed_by: string | null;
  readonly activity_expires_at: string | null;
  readonly last_completed_at: string | null;
  readonly next_scheduled_at: string | null;
  readonly businesses_discovered_today: number;
  readonly new_emails_today: number;
  readonly existing_matched_today: number;
  readonly rejected_today: number;
  readonly websites_resolved_today: number;
  readonly sources_responded_today: number;
  readonly sources_unavailable_today: number;
  readonly metrics_day: string;
  readonly updated_at: string;
}

export interface BusinessEvidence {
  readonly evidence_id: string;
  readonly programme_id: string;
  readonly iso_alpha_2: string;
  readonly cycle_id: string | null;
  readonly business_name: string;
  readonly website_url: string | null;
  readonly contact_page_url: string | null;
  readonly services: ReadonlyArray<string>;
  readonly category: string | null;
  readonly discovered_via_term: string;
  readonly discovered_via_source: string;
  readonly discovered_via_evidence_url: string | null;
  readonly discovered_email: string | null;
  readonly email_source_url: string | null;
  readonly email_extraction_confidence: number | null;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface WorldOverview {
  readonly countries_total: number;
  readonly countries_un_member: number;
  readonly countries_active_in_nex: number;
  readonly programmes_active: number;
  readonly programmes_total: number;
  readonly per_status: Readonly<Record<CountryStatus, number>>;
  readonly per_region: ReadonlyArray<{ region: Region; total_countries: number; active_countries: number; businesses_today: number }>;
  readonly totals_today: {
    readonly businesses_discovered: number;
    readonly new_emails: number;
    readonly existing_matched: number;
    readonly rejected: number;
    readonly websites_resolved: number;
    readonly sources_responded: number;
    readonly sources_unavailable: number;
  };
  readonly computed_at: string;
}

// ─── Errors ─────────────────────────────────────────────────────────
export class WorldDiscoveryError extends Error {
  constructor(reason: string) {
    super(`World discovery · ${reason}`);
    this.name = "WorldDiscoveryError";
  }
}

// ─── Structural boundary markers (verified in acceptance) ───────────
export const _WORLD_DISCOVERY_BOUNDARY_NO_FAKE_ACTIVITY = "activity_from_db_state_only_no_animated_pulse";
export const _WORLD_DISCOVERY_BOUNDARY_FOUNDER_ONLY_EMAILS = "email_evidence_gated_by_founder_auth_only";
