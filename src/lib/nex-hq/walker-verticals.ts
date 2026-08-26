// NEX HQ · Walker vertical registry.
//
// One canonical place to register a Walker that should appear in the HQ
// sidebar with a live green-light indicator and its own dedicated Walker
// data page under /nex-head-quarters/walker/[vertical].
//
// Doctrine anchor:
//   · Universal Acquisition Engine (runAgent) reused across verticals · this
//     registry stays synchronised with scripts/nex-dev-scheduler.mjs · adding
//     a Walker means editing BOTH the scheduler (spawn entry) and here.
//   · No new dashboard · every vertical page renders inside the existing
//     HQ Walker page shell (see /nex-head-quarters/walker/[vertical]/page.tsx).
//   · Heartbeat / cycle_run filtering is BY worker_id · never by the loose
//     worker_type='acquisition' pattern that would confuse food and
//     accommodation now that BOTH walkers write heartbeats to the same table.
//
// This file is server-safe and client-safe · no runtime imports.
export type WalkerVerticalId = "food" | "accommodation";

export interface WalkerVerticalDef {
  /** URL segment · /nex-head-quarters/walker/{id} */
  id: WalkerVerticalId;
  /** Human label · shown in sidebar entry + page header */
  label: string;
  /** Page-header sub-title fragment · e.g. "Yogyakarta Food Discovery" */
  pageTitle: string;
  /** Exact worker_id used by the scheduler + written to nex.worker_heartbeat.
   *  Matches the spawn `key` in scripts/nex-dev-scheduler.mjs. */
  workerId: string;
  /** worker_config LIKE prefix used to isolate cycles for this vertical.
   *  E.g. "food:Yogyakarta:%" · "accommodation:Yogyakarta:%". */
  workerConfigLikePrefix: string;
  /** Schema-qualified table where discovered businesses land. */
  businessTable: string;
  /** Schema-qualified per-field provenance table (Direct-Provenance A pattern). */
  provenanceTable: string;
  /** Whether the business table has a `categories text[]` secondary-token
   *  column (Task #85). Food has it · accommodation does not (yet). */
  hasSecondaryCategoriesArray: boolean;
  /** Rotation zones · MUST mirror scripts/nex-dev-scheduler.mjs bboxRotation. */
  zones: readonly string[];
  /** Cursor file (JSON) written by the scheduler on rotation. */
  cursorFile: string;
  /** Public-facing directory URL for this vertical · the surface where the
   *  cards + businesses NEX has built are visible to end users. Linked from
   *  the Walker data page header so Philip can jump from acquisition metrics
   *  straight to the built directory in one click. */
  directoryHref: string;
}

export const WALKER_VERTICALS: readonly WalkerVerticalDef[] = [
  {
    id: "food",
    label: "Food · Yogyakarta",
    pageTitle: "Yogyakarta Food Discovery",
    workerId: "acquisition:food:Yogyakarta",
    workerConfigLikePrefix: "food:Yogyakarta:%",
    businessTable: "nex.food_business",
    provenanceTable: "nex.food_business_field_provenance",
    hasSecondaryCategoriesArray: true,
    zones: ["prambanan", "sleman-north", "bantul-south", "klaten-east", "gamping-west"],
    cursorFile: "data/nex-scheduler/walker-geo-cursor.json",
    directoryHref: "/food",
  },
  {
    id: "accommodation",
    label: "Accommodation · Yogyakarta",
    pageTitle: "Yogyakarta Accommodation Discovery",
    workerId: "acquisition:accommodation:Yogyakarta",
    workerConfigLikePrefix: "accommodation:Yogyakarta:%",
    businessTable: "nex.accommodation_business",
    provenanceTable: "nex.accommodation_business_field_provenance",
    hasSecondaryCategoriesArray: false,
    zones: ["malioboro", "prawirotaman", "kaliurang", "borobudur", "yogya-wider"],
    cursorFile: "data/nex-scheduler/walker-accommodation-geo-cursor.json",
    directoryHref: "/accommodation",
  },
] as const;

export function getWalkerVertical(id: string): WalkerVerticalDef | null {
  return WALKER_VERTICALS.find((v) => v.id === id) ?? null;
}

// Heartbeat state semantics · identical to WalkerLiveIndicator thresholds so
// the sidebar dot and the full page indicator agree on what "green" means.
export type WalkerLiveTier = "running" | "idle" | "overdue" | "stopped";

export function resolveWalkerTier(ageSeconds: number | null): WalkerLiveTier {
  if (ageSeconds == null || ageSeconds >= 1800) return "stopped";
  if (ageSeconds >= 900) return "overdue";
  if (ageSeconds >= 60) return "idle";
  return "running";
}

export interface WalkerSidebarStatus {
  workerId: string;
  ageSeconds: number | null;
  lastHeartbeatAt: string | null;
  tier: WalkerLiveTier;
}
