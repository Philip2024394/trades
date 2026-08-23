// NEX TOOLS · staircase-design handlers.
//
// Backing implementations for the four staircase-agent tools declared
// in `../schemas.ts`:
//   - readStaircaseDesign  (READ · returns current state as JSON)
//   - updateStaircaseDesign (WRITE · validates + queues mutations)
//   - generateInspiration  (Phase 3 stub · returns not_implemented)
//   - requestQuote         (Phase 4 stub · returns not_implemented)
//
// Design: handlers are pure functions with the current design state
// closed over via a factory. Mutations accumulate in a passed-in
// buffer so the caller (staircase agent runner) can emit them to the
// client, which applies them to its React state.
//
// Doctrine references:
//   - project_nex_full_experience_phase_plan_2026_08_20.md
//     (Phase 1 · doctrine amendment · chat may WRITE when customer
//     issues direct design instruction · provenance required)
//   - project_nex_staircase_submission_five_categories_2026_08_17.md
//     (every write carries provenance)
//   - project_nex_staircase_canonical_identity_and_submission_2026_08_17.md
//     (canonical slug only · never derive from label at runtime)

import {
  STAIRCASE_GEOMETRIES,
  STAIRCASE_MATERIAL_FAMILIES,
  STAIRCASE_RISER,
  STAIRCASE_STRUCTURAL,
  STAIRCASE_USE,
  STAIRCASE_WOOD_SPECIES,
} from "@/lib/nex/tools/schemas";
import type { StaircaseDesignState } from "@/lib/nex/staircase/design-state";

// ─── Types ─────────────────────────────────────────────────────────

/** One design mutation with provenance · emitted per updateStaircaseDesign
 *  tool call. Caller collects these and applies to their state store. */
export type DesignMutation = {
  field: keyof StaircaseDesignState;
  value: string | null;
  provenance: "chat_customer_instruction";
  sourceMessageId?: string;
  /** ISO timestamp when the mutation was queued. */
  at: string;
};

export type ToolHandlerContext = {
  /** Current design state at the start of this agent turn. Handlers
   *  READ from this snapshot; updates land in `mutations`, applied by
   *  the caller after the turn ends. */
  currentDesign: StaircaseDesignState;
  /** Mutation buffer · handlers append; caller drains. */
  mutations: DesignMutation[];
};

/** A handler takes a NEX-canonical tool input (already-parsed JSON
 *  object) plus the shared context, and returns the JSON string that
 *  becomes the tool_result content the LLM sees on its next turn. */
export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolHandlerContext,
) => Promise<string>;

// ─── Canonical field → enum registry ──────────────────────────────
// Validates that a value about to be written is in the canonical
// enum for that field. Prevents the LLM from inventing new slugs.

const FIELD_ENUMS: Partial<Record<keyof StaircaseDesignState, readonly string[]>> = {
  materialFamily: STAIRCASE_MATERIAL_FAMILIES,
  use: STAIRCASE_USE,
  geometry: STAIRCASE_GEOMETRIES,
  string: STAIRCASE_STRUCTURAL,
  riser: STAIRCASE_RISER,
  wood: STAIRCASE_WOOD_SPECIES,
  treadWood: STAIRCASE_WOOD_SPECIES,
  riserWood: STAIRCASE_WOOD_SPECIES,
  handrailWood: STAIRCASE_WOOD_SPECIES,
};

// Fields that accept ANY string (no enum) — free-form or externally-
// validated. LLM should still use sensible canonical forms.
const FREE_FORM_FIELDS: ReadonlySet<keyof StaircaseDesignState> = new Set([
  "country",
  "finish",
  "tread",
  "newel",
  "handrail",
  "handrailPosition",
  "balustrade",
  "propertyType",
  "buildStage",
  "replaceExisting",
  "openingReady",
  "customerType",
  "vatStatus",
  "installRequired",
  "supplyMarket",
  "exportCountry",
  "projectStage",
  "notes",
]);

const KNOWN_FIELDS: ReadonlySet<keyof StaircaseDesignState> = new Set([
  ...Object.keys(FIELD_ENUMS),
  ...FREE_FORM_FIELDS,
] as Array<keyof StaircaseDesignState>);

// ─── Handler: readStaircaseDesign ─────────────────────────────────

const readStaircaseDesign: ToolHandler = async (_input, ctx) => {
  // Return the current design as JSON. Only fields that are set —
  // this makes the response smaller AND makes it obvious to the LLM
  // what's still unknown (per No Forced Decisions doctrine · missing
  // ≠ default ≠ empty).
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx.currentDesign)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    set[key] = value;
  }
  return JSON.stringify({
    status: "ok",
    fields_set: Object.keys(set),
    fields_missing: allDesignFields().filter((f) => !(f in set)),
    design: set,
  });
};

// ─── Handler: updateStaircaseDesign ───────────────────────────────

const updateStaircaseDesign: ToolHandler = async (input, ctx) => {
  const updates = input.updates as Record<string, unknown> | undefined;
  const sourceMessageId = typeof input.sourceMessageId === "string" ? input.sourceMessageId : undefined;

  if (!updates || typeof updates !== "object") {
    return JSON.stringify({
      status: "error",
      error: "invalid_input",
      message: "updates must be an object mapping field names to canonical slug values",
    });
  }

  const applied: Array<{ field: string; oldValue: unknown; newValue: string | null }> = [];
  const rejected: Array<{ field: string; value: unknown; reason: string }> = [];
  const now = new Date().toISOString();

  for (const [rawField, rawValue] of Object.entries(updates)) {
    // Reject unknown fields — LLM can't invent fields, only pick from
    // the canonical StaircaseDesignState surface.
    if (!KNOWN_FIELDS.has(rawField as keyof StaircaseDesignState)) {
      rejected.push({ field: rawField, value: rawValue, reason: "unknown_field" });
      continue;
    }
    const field = rawField as keyof StaircaseDesignState;

    // Null explicitly clears the field.
    if (rawValue === null) {
      const oldValue = ctx.currentDesign[field];
      ctx.mutations.push({ field, value: null, provenance: "chat_customer_instruction", sourceMessageId, at: now });
      applied.push({ field, oldValue, newValue: null });
      continue;
    }

    // Reject non-string values (canonical slugs are always strings).
    if (typeof rawValue !== "string") {
      rejected.push({ field: rawField, value: rawValue, reason: "value_must_be_string_slug_or_null" });
      continue;
    }

    // Reject empty strings (customer probably meant to clear · use null).
    if (rawValue.length === 0) {
      rejected.push({ field: rawField, value: rawValue, reason: "empty_string_use_null_to_clear" });
      continue;
    }

    // Validate against canonical enum if one exists for this field.
    const enumValues = FIELD_ENUMS[field];
    if (enumValues && !enumValues.includes(rawValue)) {
      rejected.push({
        field: rawField,
        value: rawValue,
        reason: `not_in_canonical_enum · allowed values: ${enumValues.join(", ")}`,
      });
      continue;
    }

    // Accept — queue mutation, record for response.
    const oldValue = ctx.currentDesign[field];
    ctx.mutations.push({
      field,
      value: rawValue,
      provenance: "chat_customer_instruction",
      sourceMessageId,
      at: now,
    });
    applied.push({ field, oldValue, newValue: rawValue });
  }

  return JSON.stringify({
    status: rejected.length === 0 ? "ok" : "partial",
    applied,
    rejected,
    note: rejected.length > 0
      ? "Some updates were rejected. Do NOT invent new slugs — use ONLY the enum values shown in the reason field. Ask the customer to clarify if their intent doesn't map to a canonical option."
      : undefined,
  });
};

// ─── Handler: generateInspiration (Phase 3 stub) ──────────────────

const generateInspiration: ToolHandler = async (input, _ctx) => {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  return JSON.stringify({
    status: "not_implemented",
    phase: "phase_3_vibe_studio",
    prompt_received: prompt,
    guidance:
      "Vibe Studio image generation lands in Phase 3. For now, tell the " +
      "customer honestly that visual generation is arriving soon and offer " +
      "to continue refining the design in text. Do NOT fabricate a fake " +
      "image URL — that violates the Silence over Fabrication doctrine.",
  });
};

// ─── Handler: requestQuote (Phase 4 stub) ─────────────────────────

const requestQuote: ToolHandler = async (_input, ctx) => {
  return JSON.stringify({
    status: "not_implemented",
    phase: "phase_4_geometry_engine_and_specialist_handoff",
    design_snapshot: ctx.currentDesign,
    guidance:
      "Quote generation lands in Phase 4 with the Geometry Engine and " +
      "specialist handoff. For now, tell the customer honestly: 'I'll use " +
      "the staircase specification to prepare the quote. A specialist will " +
      "confirm dimensions and pricing.' Do NOT invent a price yourself.",
  });
};

// ─── Registry ─────────────────────────────────────────────────────

export const STAIRCASE_TOOL_HANDLERS: Readonly<Record<string, ToolHandler>> = {
  readStaircaseDesign,
  updateStaircaseDesign,
  generateInspiration,
  requestQuote,
};

// ─── Utilities ─────────────────────────────────────────────────────

function allDesignFields(): Array<keyof StaircaseDesignState> {
  return Array.from(KNOWN_FIELDS);
}

/** Apply an accumulated mutation buffer to a starting state and return
 *  the resulting state. Pure function · used by callers that want the
 *  final state without maintaining external storage. */
export function applyMutations(
  base: StaircaseDesignState,
  mutations: readonly DesignMutation[],
): StaircaseDesignState {
  const next: StaircaseDesignState = { ...base };
  for (const m of mutations) {
    if (m.value === null) {
      delete next[m.field];
    } else {
      // TS: writing string to a field whose declared type is
      // `string | undefined` is safe; we validated at the tool
      // handler layer.
      (next as Record<string, unknown>)[m.field] = m.value;
    }
  }
  return next;
}
