// NEX Contact Intelligence · Consumer Adoption tracking
//
// Every NEX service that touches a person should resolve through the
// Contact Registry. This module is the source of truth for WHICH services
// have adopted the registry, WHAT "adopted" means for each of them, and
// runtime metrics derived from nex.events so admins can see adoption
// progress in real-time.
//
// Doctrine:
//   Consumer → Registry → Alias Resolution → Canonical Contact →
//   Compliance Check → Runtime → Provider

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";

export type ConsumerAdoptionStatus =
  | "adopted"                     // fully routes through registry · every send is registry_resolved when a contact exists
  | "partial"                     // some paths route through registry · others still direct
  | "pending"                     // known consumer · not yet wired
  | "not_started";                // consumer surface doesn't exist yet · roadmap item

export type ConsumerDefinition = {
  id: string;
  label: string;
  category: "communications" | "workflow" | "analytics" | "planning";
  status: ConsumerAdoptionStatus;
  description: string;
  wiring_notes: string;
  audit_signal: null | {
    event_type_prefix: string;                    // e.g. "email." or "contacts.connector.sync"
    caller_hint?: string;                          // sub-filter on payload.caller
  };
};

// Roster · updated as consumers migrate. Adoption status is authoritative;
// runtime metrics are derived from nex.events per audit_signal.
export const CONSUMER_ROSTER: ConsumerDefinition[] = [
  {
    id: "email-runtime",
    label: "Email Runtime",
    category: "communications",
    status: "adopted",
    description: "Every sendEmail() resolves the recipient through the registry (alias + canonical lookup by email/phone). Compliance runs against real registry state. Audit events link to canonical contact_id.",
    wiring_notes: "src/lib/nex/email/queue.ts · Phase 3d.1 · registry-resolved on every send · falls back to consent-unknown only when registry unreachable.",
    audit_signal: { event_type_prefix: "email." },
  },
  {
    id: "contact-forms",
    label: "Contact Forms",
    category: "workflow",
    status: "adopted",
    description: "Every /api/contact submission calls recordContactFromForm() which upserts through the registry with source_type='form'.",
    wiring_notes: "src/app/api/contact/route.ts · Phase 3b.3 · adopted from day one · every submission is a first-class registry write.",
    audit_signal: { event_type_prefix: "contacts.connector.sync", caller_hint: "contact-form" },
  },
  {
    id: "connectors",
    label: "Connectors (Trades · Newsletter · CRM · fs-store · Manual · CSV)",
    category: "workflow",
    status: "adopted",
    description: "Every connector calls only upsertContact(). No connector writes to the contacts tables directly. The registry is the single authority for every source.",
    wiring_notes: "src/lib/nex/contacts/connectors/*.ts · Phase 3b · 7 connectors built · all route through the registry.",
    audit_signal: { event_type_prefix: "contacts.connector.sync" },
  },
  {
    id: "notifications",
    label: "Notifications (WhatsApp · SMS · Push)",
    category: "communications",
    status: "partial",
    description: "Notifications Runtime shipped in Phase 3d.2 · WhatsApp channel (Meta Business Cloud) registry-resolved on every send · SMS (Twilio) and Push (Web Push) adapters + legacy caller migration in Phase 3d.2b+c.",
    wiring_notes: "src/lib/nex/notifications/*.ts · Runtime + Meta WhatsApp adapter live · sendNotification({channel, ...}) is the single entry point · registry.resolveAlias + findContactByIdentifiers({phone}) run per send · legacy raw-fetch sites (beaconNotify · beaconCustomerEmail · Twilio OTP) still direct · migration in Phase 3d.2c.",
    audit_signal: { event_type_prefix: "notification." },
  },
  {
    id: "crm",
    label: "CRM (per-merchant views)",
    category: "workflow",
    status: "partial",
    description: "CRM's app_crm_contacts table is CONSUMED by the CRM Connector (registry pulls FROM it) but per-merchant read/write paths still hit app_crm_contacts directly. Read side should resolve linked_business_id → canonical registry contact.",
    wiring_notes: "src/app/api/apps/crm/**/*.ts · needs a lookup helper that maps app_crm_contacts.id → canonical contact via the registry.",
    audit_signal: null,
  },
  {
    id: "ai",
    label: "AI (NEX Brain · Master Aggregator)",
    category: "analytics",
    status: "partial",
    description: "resolveContactForAI() helper + /api/nex/ai/resolve-contact endpoint live · every call follows aliases automatically · ranked matches by confidence · every resolution audited. Brain workers can now call this to identify canonical contacts. Actually wiring each brain worker is Phase 3d.4b.",
    wiring_notes: "src/lib/nex/ai/contact_resolver.ts · resolveContactForAI({ contact_id? · email? · phone? · name_hint? · company_hint? · free_text? · caller? }) returns ranked canonical matches with confidence + match_reason · writes ai.contact_resolved audit events. Phase 3d.4b migrates NEX Brain workers to call it.",
    audit_signal: { event_type_prefix: "ai." },
  },
  {
    id: "support",
    label: "Customer Support",
    category: "workflow",
    status: "not_started",
    description: "Support surface not built yet. When it lands, every ticket must resolve the customer through the registry so agents see canonical identity + full history from every source.",
    wiring_notes: "Awaiting the Support Centre feature (Growth Floor · currently 'awaiting').",
    audit_signal: null,
  },
  {
    id: "marketing",
    label: "Marketing (Campaign Builder)",
    category: "planning",
    status: "not_started",
    description: "Every campaign audience must be a filter OVER the registry (never a materialised copy of contacts). Sends flow through the Email Runtime · every recipient re-resolved through registry at send time so late unsubscribes are honoured.",
    wiring_notes: "Phase 4 Email Runtime scope · awaiting.",
    audit_signal: null,
  },
];

// ── Runtime metrics · read from nex.events via the storage layer ────

export type ConsumerMetrics = {
  consumer_id: string;
  last_activity_at: string | null;
  events_total: number;
  events_today: number;
  registry_resolved_total: number;             // where payload.registry_resolved === true
  alias_resolved_total: number;                 // where payload.alias_resolved === true
  compliance_blocks_total: number;              // where event_type ends with .blocked
  adoption_pct: number | null;                  // registry_resolved / events_total · null when events_total = 0
};

type StoredEvent = {
  event_type?: string;
  timestamp?: string;
  outcome?: string;
  payload?: {
    caller?: string;
    registry_resolved?: boolean;
    alias_resolved?: boolean;
  };
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getConsumerMetrics(): Promise<ConsumerMetrics[]> {
  const store = getStorage();
  // Pull a wide window (5000 recent events) and bucket in-process.
  const raw = await store.query<StoredEvent>(COLLECTIONS.events, { limit: 5000, order_dir: "desc" });
  const todayStart = startOfTodayIso();

  return CONSUMER_ROSTER.map((consumer) => {
    if (!consumer.audit_signal) {
      return {
        consumer_id: consumer.id,
        last_activity_at: null,
        events_total: 0, events_today: 0,
        registry_resolved_total: 0, alias_resolved_total: 0,
        compliance_blocks_total: 0,
        adoption_pct: null,
      };
    }
    const { event_type_prefix, caller_hint } = consumer.audit_signal;
    const matches = raw.filter((e) =>
      typeof e.event_type === "string" && e.event_type.startsWith(event_type_prefix)
      && (!caller_hint || (e.payload?.caller ?? "") === caller_hint),
    );
    const events_total = matches.length;
    const events_today = matches.filter((e) => (e.timestamp ?? "") >= todayStart).length;
    const registry_resolved = matches.filter((e) => e.payload?.registry_resolved === true).length;
    const alias_resolved = matches.filter((e) => e.payload?.alias_resolved === true).length;
    const blocks = matches.filter((e) => e.event_type?.endsWith(".blocked")).length;
    const last = matches[0]?.timestamp ?? null;
    return {
      consumer_id: consumer.id,
      last_activity_at: last,
      events_total,
      events_today,
      registry_resolved_total: registry_resolved,
      alias_resolved_total: alias_resolved,
      compliance_blocks_total: blocks,
      adoption_pct: events_total > 0 ? Math.round((registry_resolved / events_total) * 1000) / 10 : null,
    };
  });
}
