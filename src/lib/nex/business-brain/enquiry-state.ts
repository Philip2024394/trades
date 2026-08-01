// Business Brain · Supplier Enquiry State (Philip 2026-08-02)
//
// Per-conversation supplier-workflow accumulator. Extends the advisor's
// long-term state with the specific fields needed to compose a Supplier Brief.
// Isolated from Staircase Brain state (design_enquiry_context etc.) even though
// the initial fields are seeded from it — Business Brain owns its own store.

import "server-only";

export type SupplierEnquiryStep =
  | "not_started"
  | "collecting"        // Step 1 · gathering requirements
  | "explaining"        // Step 2 · one-time "why info matters" line
  | "brief_ready"       // Step 3 · Supplier Brief assembled
  | "connected";        // Step 4 · handoff message delivered

export type SupplierEnquiry = {
  conversation_id:  string;
  enquiry_id:       string;           // NEX-ENQUIRY-<uuid> · lands in CRM later
  step:             SupplierEnquiryStep;

  // Requirements collected across turns
  country?:         string;           // seeded from AdvisorState.user_country
  project_location?: string;          // free-text · city/region
  project_type?:    string;           // new_build | renovation | replacement
  staircase_type?:  string;           // straight_flight | quarter_turn | spiral | curved | floating
  materials?:       string[];         // ["oak", "glass_balustrade", "stainless"]
  design_style?:    string;           // modern | traditional | contemporary | industrial | luxury
  approximate_size?: string;          // e.g. "single flight · 3m rise"
  quantity?:        string;           // "1 staircase" · "2 staircases + landing"
  timeframe?:       string;           // "spring 2026" · "3 months"

  // Philip 2026-08-02 · v1.1 tightening from fuller design prompt.
  // Both optional · asked after required set closes when still empty · never block the brief.
  use_case?:        "residential" | "commercial";
  project_stage?:   "planning" | "ready_to_purchase" | "installation_required";

  // Philip 2026-08-02 · Opportunity 1 · Visual Brain → Supplier Workflow Bridge v1.
  // Trusted image metadata carried into the brief so the supplier sees the design
  // reference the customer was looking at. NEVER treats the image as specification.
  // Populated by the bridge in supplier-workflow.ts · rendered by brief-builder.ts.
  design_references?: Array<{
    design_id:            string;
    title?:               string;
    image_state:          "concept" | "reference" | "manufacturer" | "customer_project";
    transparency_caption: string;
    design_style?:        string;
    staircase_type?:      string;
    materials?:           string[];
  }>;

  created_at:       number;
  updated_at:       number;

  // Philip 2026-08-02 · Supplier Memory v1 · explicit lifecycle timestamps.
  // Set by the workflow when the brief closes · updated by the admin API
  // when the response lands. Never assume prepared === delivered.
  prepared_at?:     number;
  delivered_at?:    number;
  responded_at?:    number;
};

const ENQUIRY_STORE = new Map<string, SupplierEnquiry>();
const TTL_MS = 60 * 60 * 1000;   // 1 hour · matches AdvisorState TTL

function gcExpired(): void {
  const now = Date.now();
  for (const [id, e] of ENQUIRY_STORE) {
    if (now - e.updated_at > TTL_MS) ENQUIRY_STORE.delete(id);
  }
}

function newEnquiryId(): string {
  // Simple opaque id · will be replaced by DB-backed sequential id when persisted
  return "NEX-ENQUIRY-" + (Math.random().toString(36).slice(2, 10)).toUpperCase();
}

export function getOrCreateEnquiry(conversationId: string): SupplierEnquiry {
  gcExpired();
  const existing = ENQUIRY_STORE.get(conversationId);
  if (existing) {
    existing.updated_at = Date.now();
    return existing;
  }
  const now = Date.now();
  const fresh: SupplierEnquiry = {
    conversation_id: conversationId,
    enquiry_id:      newEnquiryId(),
    step:            "not_started",
    created_at:      now,
    updated_at:      now,
  };
  ENQUIRY_STORE.set(conversationId, fresh);
  return fresh;
}

export function persistEnquiry(enquiry: SupplierEnquiry): void {
  enquiry.updated_at = Date.now();
  ENQUIRY_STORE.set(enquiry.conversation_id, enquiry);
}

/** Test-only helper · exposes the store for assertions. Do not use in prod paths. */
export function _debugAllEnquiries(): Map<string, SupplierEnquiry> {
  return ENQUIRY_STORE;
}

// ─── Helpers ──────────────────────────────────────────────────────

// The fields we require to be able to assemble a useful Supplier Brief.
// Country + staircase_type + materials + quantity is the minimum viable
// "prepared enquiry" per Philip's spec.
export const REQUIRED_FIELDS: ReadonlyArray<keyof SupplierEnquiry> = [
  "country",
  "staircase_type",
  "materials",
  "quantity",
];

export function missingRequiredFields(enquiry: SupplierEnquiry): (keyof SupplierEnquiry)[] {
  return REQUIRED_FIELDS.filter((k) => {
    const v = enquiry[k];
    if (Array.isArray(v)) return v.length === 0;
    return v === undefined || v === null || v === "";
  });
}
