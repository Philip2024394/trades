// dashboard-singularity-allowlist.mjs · Task #78 Phase 2 · 2026-08-22
//
// Companion to dashboard-singularity.test.mjs. Documents every HQ page
// that exists under /nex-head-quarters/*/page.tsx but does NOT appear in
// HQShell.SECTIONS · with a short reason/reachability note for each.
//
// Philip 2026-08-22 procedural rule (verbatim):
//   "Do not automatically add the 10 orphaned pages to the sidebar.
//    Do not retire anything yet based only on naming/duplication assumptions.
//    Put the 10 pages into an explicit documented allowlist, with a short
//    reason/reachability note for each."
//
// Phase 3 (separate future task) will inspect each entry here and decide:
//   canonical HQ page → add to HQShell.SECTIONS
//   obsolete duplicate → retire (delete + redirect)
//   legitimate subordinate workflow → document its parent/reachability permanently
//
// Until Phase 3 lands, every entry below is EXPLICITLY ALLOWED by this
// file. Adding a new HQ page requires either adding it to HQShell.SECTIONS
// or adding it here with a reason.

export const HQ_ORPHAN_ALLOWLIST = [
  {
    route: "/nex-head-quarters/operations-centre",
    reason: "ALIAS of Reception · /nex-head-quarters composes it directly · Reception is the sidebar entry",
    disposition_phase_3: "keep as alias · already reached via Reception root",
  },
  {
    route: "/nex-head-quarters/cle-review",
    reason: "Bundle B (2026-08-22) admin promotion gate for CLE candidates · reachable via direct URL · sidebar entry decision deferred to Phase 3",
    disposition_phase_3: "candidate for sidebar addition under Review group",
  },
  {
    route: "/nex-head-quarters/comms-social",
    reason: "Older 11-tab Comms Social surface · comms-social-hq is the canonical 5-tab HQ panel · possible supersession · Phase 3 decides fold/retire/keep",
    disposition_phase_3: "inspect vs comms-social-hq · candidate for retirement",
  },
  {
    route: "/nex-head-quarters/conversations",
    reason: "HQ conversations viewer · reachability unclear · Phase 3 to verify parent/purpose",
    disposition_phase_3: "verify purpose · confirm reachability from CLE Review or Journal · decide add-to-sidebar or retire",
  },
  {
    route: "/nex-head-quarters/claim-review",
    reason: "HQ claim review workflow · reachability unclear · Phase 3 to verify parent/purpose",
    disposition_phase_3: "verify purpose · confirm reachability · decide add-to-sidebar or retire",
  },
  {
    route: "/nex-head-quarters/draft-review",
    reason: "Older CLE draft promotion surface (pre-Bundle-B) · possibly superseded by cle-review · Phase 3 decides fold/retire/keep",
    disposition_phase_3: "inspect vs cle-review · candidate for retirement",
  },
  {
    route: "/nex-head-quarters/m4-survey/[conversation_id]",
    reason: "DYNAMIC ROUTE · legal absence from static sidebar · reached from parent page (likely m4-results or Journal)",
    disposition_phase_3: "permanent · dynamic routes never in static sidebar · document parent reachability",
  },
  {
    route: "/nex-head-quarters/m4-results",
    reason: "M4 survey results view · verify parent/purpose in Phase 3",
    disposition_phase_3: "verify purpose · decide sidebar/retire",
  },
  {
    route: "/nex-head-quarters/vitals",
    reason: "HQ vitals surface · reachability + purpose unclear · Phase 3 to verify",
    disposition_phase_3: "verify purpose · decide sidebar/retire",
  },
  {
    route: "/nex-head-quarters/collector/[category]/dashboard",
    reason: "DYNAMIC ROUTE · legal absence from static sidebar · reached from parent /nex-head-quarters/collector/[category]",
    disposition_phase_3: "permanent · dynamic routes never in static sidebar · document parent reachability",
  },
  {
    route: "/nex-head-quarters/collector/[category]",
    reason: "DYNAMIC ROUTE · legal absence from static sidebar · static counterpart /nex-head-quarters/collector/staircase_refacing is the sidebar entry · dynamic route reachable via any {category} slug",
    disposition_phase_3: "verify vs static staircase_refacing page · possible consolidation OR permanent dual-shape (static shortcut + dynamic general) · not a rule violation either way",
  },
];

// ── Component-name allowlist ──────────────────────────────────────────
//
// Dashboard-pattern components (*Dashboard*, *ControlCentre*, etc.) that
// legitimately exist outside /nex-head-quarters/*. Merchant/studio/product
// surfaces are NOT operational admin dashboards · they are consumer product
// screens · exempt per Philip 2026-08-22 doctrine.

export const COMPONENT_NAMESPACE_ALLOWLIST = [
  // NEX HQ canonical (always allowed)
  "src/components/nex-head-quarters/",
  // Merchant-facing product surfaces
  "src/components/studio/",
  "src/components/trade-off/",
  "src/components/home/",
  "src/components/sitebook/",
  "src/components/food/",
  "src/components/affiliates/",
  "src/components/hero/",
  "src/components/community/",
  // Design/marketing (never operational)
  "src/components/design-os/",
];

// ── API route allowlist for operational surfaces ─────────────────────
//
// Admin/operational API routes MUST live under one of these prefixes.
// /api/admin/* is Networkers (allowed exception). /api/nex/* is NEX-canonical.
// /api/admin/nex/* was deleted 2026-08-22 · MUST NOT reappear.

export const OPERATIONAL_API_ALLOWLIST = [
  "src/app/api/admin/",  // Networkers legacy · allowed exception
  "src/app/api/nex/",     // NEX canonical
];

export const OPERATIONAL_API_FORBIDDEN = [
  "src/app/api/admin/nex/",  // Deleted 2026-08-22 in Step 1c · must never resurrect
];

// ── Content-marker rules for architectural enforcement ───────────────
//
// Assertion 3 uses these to detect "this page renders operational data
// even though it's outside the allowed zones." Architectural, not filename-based.
// If a page outside HQ imports/queries these, it's building a competing dashboard.

export const HQ_OPERATIONAL_MARKERS = [
  "nex.worker_heartbeat",
  "nex.worker_cycle_run",
  "nex.worker_health_status",
  "worker_missed_runs_24h",
  "evaluateWorker",
  "evaluateAllSystems",
  "deriveVerdict",
  "SixCriteriaTable",
  "RealityStrip",
];

// ── Zones where operational content is allowed ──────────────────────

export const OPERATIONAL_CONTENT_ZONES = [
  "src/app/nex-head-quarters/",   // NEX HQ · canonical
  "src/app/admin/(authed)/",       // Networkers · allowed exception
  "src/app/api/nex/",              // NEX API routes
  "src/app/api/admin/",            // Networkers API
  "src/lib/nex/hq/",               // HQ evaluator libraries
  "src/components/nex-head-quarters/", // HQ components
];
