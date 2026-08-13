// case-schema.ts — RefacingCase type per architecture memory (Refacing Case
// structure section · locked Philip 2026-08-12).
//
// This is the artefact NEX produces at LOCK and hands to the Refacing Member
// at CONNECT. Its quality is the two-dimensional success metric (homeowner
// side + member side).
//
// PR-14: Refacing Case IS the deliverable.
// PR-18: every composed element carries composition_provenance.
// PR-16: every field carries confidence markers.
// PR-13: no NEX-attributed price appears anywhere on this artefact.

import type { RefacingCaseId } from "./case-id";
import type { Confidence } from "./confidence";
import type {
  ComponentRole,
  Geometry,
  MaterialCompositionEntry,
  CanonicalProfileId,
  StyleValue,
  MoodValue,
} from "./image-schema";
import type { CompositionProvenance } from "./provenance";

// ── Existing staircase (BASE) ─────────────────────────────────────────────
export type BasePhoto = {
  image_id: string; // Points to images_v3[] entry with owner_type='customer_upload'
  captured_at: string; // ISO
};

export type VisibleComponent = {
  component_role: ComponentRole;
  count?: number; // e.g. "2 newels visible"
  count_confidence?: Confidence;
  notes?: string; // Free-text customer-confirmed observation
};

export type ExistingStaircase = {
  photos: BasePhoto[];
  visible_geometry?: Geometry; // From PHOTO UNDERSTANDING · always with confidence markers
  visible_components?: VisibleComponent[];
  customer_confirmed: boolean; // Customer tapped "Looks right" at PHOTO UNDERSTANDING
};

// ── Customer intent (from FEEL) ────────────────────────────────────────────
export const INTENT_TREATMENTS = [
  "MUST_REMAIN",
  "MUST_CHANGE",
  "MUST_NOT_CHANGE",
  "UNDETERMINED",
] as const;
export type IntentTreatment = (typeof INTENT_TREATMENTS)[number];

/**
 * A component or architectural item with its treatment · per Stage 2 LOCKED
 * vocabulary. UNDETERMINED is first-class (never coerced to another treatment
 * without explicit customer confirmation).
 */
export type IntentEntry = {
  item: string; // e.g. 'newel_post', 'baluster_row', 'tread_top_surface'
  treatment: IntentTreatment;
  customer_confirmed: boolean;
  brain_hypothesis?: string; // What NEX proposed · never overrides customer
  hypothesis_confidence?: Confidence;
};

/**
 * The Feeling vector captured at FEEL. Human-language multi-select.
 * NEX Brain translates this to canonical profiles for retrieval.
 */
export const FEELING_VALUES = [
  "more-modern",
  "more-natural",
  "more-elegant",
  "more-dramatic",
  "more-open",
  "not-sure",
] as const;
export type FeelingValue = (typeof FEELING_VALUES)[number];

export type TransformationScope = "just-refresh" | "change-look" | "total-transformation" | "not-sure";

export type CustomerIntent = {
  feelings: FeelingValue[];
  transformation_scope?: TransformationScope;
  intent_entries: IntentEntry[]; // MUST_REMAIN / MUST_CHANGE / MUST_NOT_CHANGE / UNDETERMINED
  raw_customer_wording?: string; // Preserved AS EVIDENCE · never the specification
};

// ── Selected design (from SEE + TRY) ──────────────────────────────────────
export type DesignDirection = "safe-centre" | "warm-character" | "stretch-statement" | "custom";

export type SelectedDesign = {
  direction: DesignDirection;
  name: string; // Human-facing name (e.g. "Warm Modern")
  reason_for_existing: string; // One-line description per PR-9
  key_materials_description: string; // One-line description per PR-9
  canonical_profile_ids: CanonicalProfileId[];
  canonical_profile_ids_confidence: Confidence;
  style: StyleValue[];
  mood: MoodValue[];
  material_composition: MaterialCompositionEntry[];
  visualisation_image_id?: string; // The composited/rendered image (if produced)
  reference_image_ids: string[]; // Every reference the design draws from (PR-18 provenance)
  component_selections: Array<{
    component_role: ComponentRole;
    image_id: string; // Points to the specific reference image
    notes?: string;
  }>;
};

// ── Requested work ────────────────────────────────────────────────────────
export type RequestedWorkArea =
  | "treads"
  | "risers"
  | "balustrade"
  | "handrail"
  | "newels"
  | "stringers"
  | "finish";

export type RequestedWork = {
  areas: RequestedWorkArea[];
  quote_requirement: "supply_plus_installation" | "supply_only" | "installation_only" | "unspecified";
};

// ── Unknown / needs survey ────────────────────────────────────────────────
export type UnknownItem = {
  concern: string; // e.g. 'exact_dimensions', 'timber_species_confirmation'
  reason: string; // Why NEX can't determine from photo (PR-16 truthfulness)
};

// ── Case status ───────────────────────────────────────────────────────────
export const CASE_STATUSES = [
  "DRAFT",
  "AWAITING_BASE_STAIRCASE",
  "BASE_UPLOADED",
  "BASE_CONFIRMED",          // SEE UI · after customer taps "Looks right" or completes correction UI (spec §A.6)
  "INTENT_DEFINED",
  "CONCEPT_READY",
  "DESIGN_SELECTED",
  "READY_FOR_ASSESSMENT",
  "CONNECTED",
  "SURVEYING",
  "QUOTED",
  "CONTRACTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

// ── Contact (attached at CONNECT · not at entry per V2) ───────────────────
export type CustomerContact = {
  name: string;
  phone: string;
  email: string;
  postcode?: string;
  contact_preference?: "whatsapp" | "email" | "phone" | "nex_chat";
  attached_at: string; // ISO · when the customer chose to identify themselves
};

// ── The Refacing Case artefact ────────────────────────────────────────────
export type RefacingCase = {
  refacing_case_id: RefacingCaseId;
  created_at: string; // ISO
  updated_at: string; // ISO
  status: CaseStatus;

  existing_staircase: ExistingStaircase;
  customer_intent: CustomerIntent;
  selected_design?: SelectedDesign; // Absent until DESIGN_SELECTED
  requested_work?: RequestedWork; // Absent until DESIGN_SELECTED
  unknown_items: UnknownItem[]; // Photo-only limitations · always present per PR-16

  composition_provenance: CompositionProvenance; // PR-18 · required at LOCK
  contact?: CustomerContact; // Absent until CONNECTED

  /**
   * SEE UI · Save & Share (spec §E.3 · §F.2).
   * Additive · does not affect PR-16 or PR-18. Directions the customer has
   * marked as "save this" during SEE — distinct from `selected_design` (which
   * is the committed pick). Multiple saves permitted · timestamped.
   */
  saved_directions?: Array<{
    direction: DesignDirection;
    name: string;
    reason_for_existing: string;
    key_materials_description: string;
    reference_image_ids: string[];
    saved_at: string;
  }>;

  /**
   * Anonymous access token — enables Case resume across sessions per Stage 1 · C6.
   * Signed opaque value · not the Case ID itself. Distinct so a leaked Case ID
   * alone cannot grant access without the token.
   */
  anonymous_return_token?: string;

  /**
   * NEVER present on this artefact:
   *   · nex_indicative_price     (would violate PR-13)
   *   · homeowner_price_band     (would violate PR-13)
   *   · member_quote             (member quotes live in their own quote surface)
   *   · contractor_ranking       (customer never sees marketplace mechanics)
   *
   * These are enforced by validators.ts + the case-store write path.
   */
};
