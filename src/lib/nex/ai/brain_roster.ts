// NEX AI · Brain Worker Roster
//
// Declarative source of truth for every NEX Brain module + its Contact
// Registry migration status. Updated as each brain is migrated · powers
// the AI Adoption dashboard in the Contact Registry panel.
//
// A brain is "migrated" when every person-identifying code path inside
// it routes through resolveContactForAI() rather than doing its own
// lookup against app_crm_contacts / hammerex_trade_off_listings / etc.
//
// Doctrine (Philip 2026-08-07 · Phase 3d.4c):
//   No Brain should implement its own contact matching or duplicate
//   handling. Every Brain reasons about the same canonical identities.

export type BrainMigrationStatus =
  | "migrated"                           // every person-identifying path routes through resolveContactForAI
  | "partial"                            // some paths migrated · others pending
  | "list_brain_pending"                 // brain produces lists/snapshots · needs row-level enrichment
  | "no_person_refs"                     // brain doesn't identify people · no migration needed
  | "future";                            // brain not built yet · adopts registry from day one

export type BrainCategory =
  | "customer"                           // customer / person interaction
  | "commercial"                         // finance · payments · billing
  | "operations"                         // project management · workflow
  | "intelligence"                       // knowledge · analytics · research
  | "communication";                     // chat · assistants · notifications

export type BrainWorkerDefinition = {
  id: string;                            // matches caller prefix suffix: "nex-brain:{id}:{fn}"
  label: string;
  category: BrainCategory;
  status: BrainMigrationStatus;
  description: string;
  migration_notes: string;
  caller_prefix: string;                 // e.g. "nex-brain:cx" · used to detect adoption from audit
};

export const BRAIN_WORKER_ROSTER: BrainWorkerDefinition[] = [
  {
    id: "cx",
    label: "Customer eXperience",
    category: "customer",
    status: "migrated",
    description: "Resolves customer questions (name / contact_id / party_id) for the merchant chat. Answers 'tell me about Mrs Smith' · 'who owes me money'.",
    migration_notes: "Phase 3d.4b · resolveCustomer() enriches with canonical registry contact via enrichWithRegistry helper · 3 tagged callers (resolve_by_contact_id · resolve_by_party_id · resolve_by_search).",
    caller_prefix: "nex-brain:cx",
  },
  {
    id: "net",
    label: "Network Intelligence",
    category: "customer",
    status: "migrated",
    description: "Trade directory search + collaboration matchmaking. Every returned trade carries a canonical registry contact via batch email lookup · alias-safe.",
    migration_notes: "Phase 3d.4d · findBusinesses attaches NetworkBusiness.registry via findContactsByEmails() batch lookup · single ai.contact_resolved audit event per call · caller nex-brain:net:findBusinesses.",
    caller_prefix: "nex-brain:net",
  },
  {
    id: "cc",
    label: "Customer Care · Property Vault",
    category: "customer",
    status: "list_brain_pending",
    description: "Property vault + building passport · warranty tracking · asset forecasting. References owner and contractor identities via project pointers.",
    migration_notes: "Row-level enrichment on ownerId / trade_listing_id resolution. Passport export already accepts a resolved canonical contact when caller supplies it.",
    caller_prefix: "nex-brain:cc",
  },
  {
    id: "pi",
    label: "Project Intelligence",
    category: "operations",
    status: "list_brain_pending",
    description: "Project snapshot builder · resolves participants (customer · trade · homeowner) into the project timeline.",
    migration_notes: "buildProjectSnapshot needs to enrich its 'customer' + 'lead_trade' fields via registry lookup by the underlying email/phone.",
    caller_prefix: "nex-brain:pi",
  },
  {
    id: "fi",
    label: "Financial Intelligence",
    category: "commercial",
    status: "list_brain_pending",
    description: "Financial snapshot builder · references customers via outstanding-balance rows.",
    migration_notes: "Customer breakdown lines should carry canonical_contact_id so downstream emails send through registry aliases.",
    caller_prefix: "nex-brain:fi",
  },
  {
    id: "bos",
    label: "Business OS",
    category: "commercial",
    status: "list_brain_pending",
    description: "Business overview + growth metrics · aggregates across customer segments.",
    migration_notes: "Growth cohorts reference customer_id — enrich each cohort row with canonical registry ids.",
    caller_prefix: "nex-brain:bos",
  },
  {
    id: "xp",
    label: "Experience Intelligence",
    category: "customer",
    status: "list_brain_pending",
    description: "Customer experience signals · touch history · sentiment. References contact_id for every recorded interaction.",
    migration_notes: "Touch history rows should resolve contact_id through the alias chain before display.",
    caller_prefix: "nex-brain:xp",
  },
  {
    id: "mp",
    label: "Market Positioning",
    category: "intelligence",
    status: "list_brain_pending",
    description: "Market-share and competitive analysis · references business identities for comparison.",
    migration_notes: "Competitor identities should route through registry for canonical business_id references.",
    caller_prefix: "nex-brain:mp",
  },
  {
    id: "est",
    label: "Estimate Intelligence",
    category: "commercial",
    status: "list_brain_pending",
    description: "Estimate + quote intelligence · resolves the customer + trade for each estimate.",
    migration_notes: "answerEstimate resolves customer id → enrich with canonical registry contact.",
    caller_prefix: "nex-brain:est",
  },
  {
    id: "bi",
    label: "Business Intelligence",
    category: "intelligence",
    status: "no_person_refs",
    description: "Aggregate metrics about the merchant's own business · doesn't identify specific external people.",
    migration_notes: "No migration needed today · future person-referencing features would adopt the registry from day one.",
    caller_prefix: "nex-brain:bi",
  },
  {
    id: "md",
    label: "Managing Director Briefings",
    category: "intelligence",
    status: "no_person_refs",
    description: "Executive-tier briefings · aggregates without naming individuals.",
    migration_notes: "No person refs today. Any future 'top customers this quarter' briefing must route through registry.",
    caller_prefix: "nex-brain:md",
  },
  {
    id: "pm",
    label: "Project Management",
    category: "operations",
    status: "no_person_refs",
    description: "Command centre + portfolio overview + forecasting. Currently anonymous project-scope.",
    migration_notes: "When PM adds per-participant views, they must route through registry.",
    caller_prefix: "nex-brain:pm",
  },
  {
    id: "sc",
    label: "Supply Chain",
    category: "operations",
    status: "no_person_refs",
    description: "Materials + supplier flow intelligence.",
    migration_notes: "Supplier-as-identity features (not yet built) would adopt registry.",
    caller_prefix: "nex-brain:sc",
  },
  {
    id: "twin",
    label: "Digital Twin",
    category: "intelligence",
    status: "no_person_refs",
    description: "Simulation + scenario planning · no direct person identification today.",
    migration_notes: "Twin scenarios that name individuals would resolve through registry.",
    caller_prefix: "nex-brain:twin",
  },
  {
    id: "ab",
    label: "AB Testing",
    category: "intelligence",
    status: "no_person_refs",
    description: "Experiment control + treatment analysis.",
    migration_notes: "Cohort membership operates on ids · registry resolution not required until cohort ↔ person mapping surfaces.",
    caller_prefix: "nex-brain:ab",
  },
  {
    id: "chat",
    label: "Chat Router",
    category: "communication",
    status: "future",
    description: "The main chat surface (/api/nex/chat) that dispatches to specialist brains. Currently anchors on the merchant session · downstream brains (cx etc.) do the identity work.",
    migration_notes: "When chat gains cross-merchant / global identity refs, it will route through registry directly.",
    caller_prefix: "nex-brain:chat",
  },
];

export function totalBrains(): number { return BRAIN_WORKER_ROSTER.length; }

export function migratedBrains(): BrainWorkerDefinition[] {
  return BRAIN_WORKER_ROSTER.filter((b) => b.status === "migrated" || b.status === "partial");
}

export function pendingBrains(): BrainWorkerDefinition[] {
  return BRAIN_WORKER_ROSTER.filter((b) => b.status === "list_brain_pending" || b.status === "future");
}

export function applicableBrains(): BrainWorkerDefinition[] {
  return BRAIN_WORKER_ROSTER.filter((b) => b.status !== "no_person_refs");
}

export function adoptionPct(): number {
  const applicable = applicableBrains();
  if (applicable.length === 0) return 100;
  const done = migratedBrains().length;
  return Math.round((done / applicable.length) * 1000) / 10;
}
