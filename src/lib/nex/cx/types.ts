// Nex Customer Intelligence — contracts.
//
// Where BI is merchant-scope, PI is project-scope, Est is job-scope,
// CX is CUSTOMER-scope. The engine builds on top of the existing CRM
// (`app_crm_contacts` + `loadContactSummary`) — never duplicates it.
// This module adds four reasoning layers:
//   • Preferences  — inferred contact channel / time / response speed
//   • Opportunities — future work Nex spots (kitchen 18mo ago → maint.)
//   • Warranties   — from hammerex_sitebook_home_care_items
//   • Payments     — from hammerex_sitebook_costs
// Plus cross-customer search ("who owes me money", "who should I
// contact today?") and an answer router.
//
// Evidence-or-silence: every derived fact carries a source + reason
// string. Predictions never appear without a "because…".

import type { ContactSummary } from "@/lib/crm/loadContactTimeline";
import type { Evidence } from "../pi/types";

export type { ContactSummary };
export type { Evidence };

/** How the caller identifies which customer to look up. */
export type CustomerRef =
  | { kind: "contact_id"; id: string }
  | { kind: "party_id";  id: string }
  | { kind: "search";    query: string };

export type CustomerResolveOk = {
  ok: true;
  contactId: string;                     // merchant-scoped app_crm_contacts.id
  summary:   ContactSummary;
  /** Phase 3d.4b · canonical Contact Registry enrichment. Null when the
   *  registry is unreachable or the contact isn't in the registry yet.
   *  Every CX brain answer that references a person now carries the
   *  canonical identity so downstream consumers (Email · Notifications ·
   *  future AI) resolve through the same alias-safe id. */
  registry?: {
    canonical_contact_id: string | null;
    alias_resolved: boolean;
    confidence: number | null;
    match_reason: string | null;
    resolved_at: string;
  };
};

export type CustomerResolveErr = {
  ok: false;
  reason:  "not_found" | "ambiguous" | "not_yours";
  matches?: Array<{ contactId: string; displayName: string; lifecycleStage: string; lastActivityAt: string | null }>;
};

/** A recommended future action Nex spotted. Always carries a reason. */
export type Opportunity = {
  key:      string;
  headline: string;                      // "Kitchen completed 18 months ago — recommend annual maintenance."
  reason:   string;                      // "Signed off on 2025-01-14. Kitchens typically due for check at 18 months."
  action?:  { label: string; href: string };
  evidence: Evidence;
};

/** An inferred customer preference. Every preference has a source
 *  (activity pattern, explicit note) so Nex can defend it. */
export type Preference = {
  key:      string;                      // "channel_wa" | "time_evening" | "prefer_photos"
  label:    string;                      // "Prefers WhatsApp"
  strength: "observed" | "strong" | "weak";
  reason:   string;                      // "5 of last 6 activities were on WhatsApp."
  evidence: Evidence;
};

/** A warranty on record for this customer. */
export type WarrantyItem = {
  title:       string;
  trade_name?: string | null;
  next_due_at: string | null;
  days_until:  number | null;
  evidence:    Evidence;
};

/** A payment owed by this customer (from sitebook_costs). */
export type PaymentOwed = {
  cost_id:         string;
  project_title:   string | null;
  description:     string | null;
  agreed_pence:    number;
  paid_pence:      number;
  outstanding_pence: number;
  due_at:          string | null;
  is_overdue:      boolean;
  evidence:        Evidence;
};

/** Overall relationship health for the customer. */
export type RelationshipHealth = {
  score:    number;                      // 0–100
  band:     "excellent" | "healthy" | "steady" | "attention" | "critical";
  headline: string;
  /** Per-signal breakdown so the merchant can see WHY the score is
   *  what it is. Missing signals return null. */
  signals: {
    payments:      { score: number | null; note: string };
    communication: { score: number | null; note: string };
    reviews:       { score: number | null; note: string };
    repeat:        { score: number | null; note: string };
    responsiveness: { score: number | null; note: string };
  };
};

/** The full customer snapshot Nex hands back. */
export type CustomerSnapshot = {
  contactId:      string;
  contact:        ContactSummary["contact"];
  timeline:       ContactSummary["timeline"];
  openTasks:      ContactSummary["openTasks"];
  totals:         ContactSummary["totals"];
  health:         RelationshipHealth;
  preferences:    Preference[];
  opportunities:  Opportunity[];
  warranties:     WarrantyItem[];
  payments_owed:  PaymentOwed[];
  computed_at:    string;
  /** Adapter errors surfaced honestly — never silently swallowed. */
  errors:         Array<{ enricher: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

// ─── Cross-customer search ──────────────────────────────────────────

export type CustomerListEntry = {
  contactId:       string;
  displayName:     string;
  lifecycleStage:  string;
  lastActivityAt:  string | null;
  /** The single most relevant fact the search predicate found. */
  note:            string;
  /** Optional numeric anchor — used by the answer builder to sort +
   *  format ("£1,200 outstanding", "42 days quiet"). */
  metric?:         number;
  metric_unit?:    "gbp" | "days" | "count" | "pct" | "stars";
};
