// src/lib/nex-hq/email-harvest-manifest.ts
//
// EMAIL HARVEST sidebar section · canonical manifest
// Founder-authorised directive · 2026-09-22.
//
// Every sub-page in the EMAIL HARVEST Founder HQ section is defined here.
// Status is a promise-to-truth:
//
//   real           - page reads real persisted data · answers real questions
//   real_via_reuse - link points to an existing HQ page (do not duplicate)
//   stub           - honest NOT_YET_BUILT placeholder that names its blocker
//   partial        - page renders real data for what exists · honest gaps
//
// This manifest is the single source of truth used by (a) the sidebar,
// (b) the /nex-head-quarters/email-harvest/[slug] dynamic route, and
// (c) the acceptance test that asserts sidebar↔manifest↔page consistency.

export type EmailHarvestPageStatus =
  | "real"
  | "real_via_reuse"
  | "partial"
  | "stub";

export interface EmailHarvestPage {
  readonly slug: string;            // used in URL /nex-head-quarters/email-harvest/{slug}
  readonly label: string;           // sidebar text
  readonly purpose: string;         // one-line "what this page answers"
  readonly status: EmailHarvestPageStatus;
  readonly href?: string;           // for real_via_reuse: the existing route
  readonly reads_from?: readonly string[];  // tables / APIs the real page reads from
  readonly blocker?: string;        // for stub/partial: what wave/build unlocks this
  readonly related_links?: readonly { label: string; href: string }[];
}

/** Canonical 17-entry manifest. Order = sidebar order. */
export const EMAIL_HARVEST_PAGES: readonly EmailHarvestPage[] = [
  {
    slug: "overview",
    label: "Overview",
    purpose: "Is email harvesting actually working right now?",
    status: "real",
    reads_from: [
      "nex.harvest_job (queue summary)",
      "nex.harvest_yield (recent evidence)",
      "nex.harvest_worker (live workers)",
      "/api/nex/founder/world/scaffolding-programme-status",
      "/api/nex/founder/marketing/inventory",
    ],
  },
  {
    slug: "live",
    label: "Live Harvest",
    purpose: "Real-time view of workers claiming/processing jobs · controller ticks per (worker, minute).",
    status: "real",
    reads_from: [
      "nex.harvest_job (claimed/processing status)",
      "nex.harvest_worker (heartbeat)",
      "nex.harvest_yield (recent activity)",
      "/api/nex/founder/email-harvest/workers",
    ],
  },
  {
    slug: "queue",
    label: "Harvest Queue",
    purpose: "Durable job queue · filter by country/category/type/status · H5 controller enqueues via H2 seam and dispatches via H3/H4 executors.",
    status: "real",
    reads_from: [
      "nex.harvest_job (H1 · zero rows until H5 activation + adapters wired · truthful empty state is intentional)",
      "/api/nex/founder/email-harvest/queue-summary",
    ],
  },
  {
    slug: "countries",
    label: "Countries",
    purpose: "Country-level harvest state · 242 countries · Asia-last policy.",
    status: "real_via_reuse",
    href: "/nex-head-quarters/world-discovery",
    reads_from: ["existing /nex-head-quarters/world-discovery"],
  },
  {
    slug: "categories",
    label: "Categories",
    purpose: "Category × country matrix of stored contacts + provenance.",
    status: "real",
    reads_from: [
      "/api/nex/founder/marketing/inventory (categories + countries)",
      "nex.marketing_contact.category_group",
    ],
  },
  {
    slug: "businesses",
    label: "Businesses",
    purpose: "Retained business candidates from source probes · distinct counters (source_results / candidates / with-website / walk-jobs-queued) · never discarded per audit-2026-09-22 fix.",
    status: "real",
    reads_from: [
      "nex.harvest_business_candidate (H3 · retained Overpass elements · never discarded)",
      "/api/nex/founder/email-harvest/businesses",
    ],
  },
  {
    slug: "emails",
    label: "Emails",
    purpose: "Public-emails inventory · aggregate counts + provenance flags · addresses gated by existing Founder audience controls.",
    status: "real_via_reuse",
    href: "/nex-head-quarters/email-marketing",
    reads_from: ["/api/nex/founder/marketing/inventory"],
  },
  {
    slug: "sources",
    label: "Sources",
    purpose: "Source registry · what NEX is allowed to harvest from · per-source health + reliability + founder-signed provenance.",
    status: "real",
    reads_from: [
      "nex.harvest_source (H2 · Founder-signed source registry)",
      "/api/nex/founder/email-harvest/sources",
    ],
  },
  {
    slug: "websites",
    label: "Website Harvest",
    purpose: "Website walker layer · distinct counters (businesses_discovered / websites_discovered / websites_walked / websites_walked_zero_pages / websites_blocked_by_robots / websites_blocked_by_governance / emails_discovered) · Session-2 walker chain wired via H4 executor · H5 controller dispatches.",
    status: "real",
    reads_from: [
      "nex.harvest_business_candidate (H3 candidates · website_walk_status populated by H4)",
      "nex.harvest_yield (H4 · website_walk_completed + website_pages_walked + email_captured)",
      "/api/nex/founder/email-harvest/website-harvest",
    ],
  },
  {
    slug: "evidence",
    label: "Evidence & Provenance",
    purpose: "For every harvested record: what/where/when/how · confidence · provenance level.",
    status: "partial",
    reads_from: ["nex.discovery_business_evidence · nex.discovery_entity"],
    blocker: "Schema exists · zero live-cycle rows until H3 bridge (rows come from importer today).",
    related_links: [
      { label: "World-discovery drill-in shows per-country evidence", href: "/nex-head-quarters/world-discovery" },
    ],
  },
  {
    slug: "workers",
    label: "Workers & Recovery",
    purpose: "Live worker heartbeat · lease age · reaper recovery · DLQ · H5 controller integrates reaper into every tick.",
    status: "real",
    reads_from: [
      "nex.harvest_worker (heartbeat + status alive/expired/drained)",
      "nex.harvest_job (dead_letter status + reaper-releases)",
      "/api/nex/founder/email-harvest/workers",
    ],
  },
  {
    slug: "cycles",
    label: "Harvest Cycles",
    purpose: "Every discovery cycle · programme/country/source · zero_results vs source_unavailable distinct.",
    status: "real",
    reads_from: ["nex.discovery_cycle", "nex.discovery_source_health"],
  },
  {
    slug: "analytics",
    label: "Collection Analytics",
    purpose: "Yield trends · country/category/source/deduplication/provenance breakdown.",
    status: "real",
    reads_from: [
      "/api/nex/founder/marketing/inventory",
      "/api/nex/founder/world/scaffolding-programme-status",
      "nex.harvest_yield (once H4 wired)",
    ],
  },
  {
    slug: "sender-system",
    label: "Sender System",
    purpose: "Available Founder-lane senders · verification · provider · capacity · reputation.",
    status: "real_via_reuse",
    href: "/nex-head-quarters/email-marketing",
  },
  {
    slug: "send-activity",
    label: "Send Activity",
    purpose: "Actual sends by lane · queued/sent/delivered/bounced/complained/unsubscribed/opened/clicked.",
    status: "real",
    reads_from: [
      "nex.marketing_send_log",
      "nex.marketing_bounce_log (Session-7 recorder path)",
      "/api/nex/marketing/stats",
    ],
  },
  {
    slug: "deliverability",
    label: "Deliverability",
    purpose: "SPF/DKIM/DMARC state · sender reputation · webhook readiness · suppression.",
    status: "real",
    reads_from: [
      "/api/nex/founder/marketing/deliverability",
      "/api/nex/founder/marketing/sending-safety-readiness",
      "nex.marketing_sender_domain_auth · nex.marketing_sender_reputation",
    ],
  },
  {
    slug: "proof-health",
    label: "Proof & Health",
    purpose: "Anti-fabrication guardrail. MACHINERY / ENDPOINT / LIVE WORLD / PERSISTENT DATA / CONTINUOUS OPERATION / RECOVERY / 24/7 HEALTH — each with evidence + honest state.",
    status: "real",
    reads_from: [
      "/api/nex/founder/marketing/acceptance-matrix (A-Z matrix)",
      "/api/nex/founder/marketing/sending-safety-readiness",
      "/api/nex/founder/world/scaffolding-programme-status",
      "nex.harvest_yield (yield summary)",
    ],
  },
];

/** Fast lookup by slug. */
export function findEmailHarvestPage(slug: string): EmailHarvestPage | null {
  return EMAIL_HARVEST_PAGES.find(p => p.slug === slug) ?? null;
}

/** Structural boundary markers · asserted in acceptance. */
export const _MANIFEST_NEVER_LISTS_FAKE_PAGE = "every_entry_has_a_route_or_is_honestly_stubbed";
export const _MANIFEST_STUB_NAMES_ITS_BLOCKER = "every_stub_and_partial_carries_blocker_text";
