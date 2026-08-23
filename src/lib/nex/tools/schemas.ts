// NEX TOOLS · canonical tool schemas.
//
// Every tool NEX Brain can call is declared here as a NexToolDef.
// Session 1 · Phase 1 · the four staircase-agent tools:
//   - readStaircaseDesign  (READ, live)
//   - updateStaircaseDesign (WRITE, live per doctrine amendment
//     2026-08-20: chat can WRITE when customer issues a direct
//     design instruction)
//   - generateInspiration  (Phase 3 stub)
//   - requestQuote         (Phase 4 stub)
//
// Handlers land in `./handlers/*` — this file is schema-only.
// Adapters (Anthropic / OpenAI / future) MUST accept the same
// schemas without translation errors.

import type { NexToolDef } from "@/lib/nex/brain/provider";

// ─── Staircase design canonical vocabulary ────────────────────────
// Sourced from StaircaseDesignState + staircase-knowledge decision
// tree. Kept in sync with those authoritative sources — this list
// is a WRITE contract the LLM must respect (per Canonical Identity
// doctrine · one slug per selection). Adding a new option requires
// updating both the decision tree AND this list.

export const STAIRCASE_MATERIAL_FAMILIES = [
  "timber",
  "metal",
  "glass",
  "concrete",
  "stone",
  "mixed_timber_metal",
  "mixed_timber_glass",
  "mixed_metal_glass",
  "mixed_all",
] as const;

export const STAIRCASE_GEOMETRIES = [
  "straight",
  "quarter_turn",
  "t_shape",
  "half_turn",
  "winder",
  "spiral",
  "curved",
  "double_sweep",
  "space_saver",
] as const;

export const STAIRCASE_STRUCTURAL = [
  "closed_string",
  "cut_string",
  "cut_string_double",
  "mono_stringer",
  "cantilever",
  "bolt_fixed",
  "open_riser",
] as const;

export const STAIRCASE_RISER = [
  "closed",
  "open",
  "partial",
  "closed_mdf_painted",
  "closed_stainless_brushed",
  "closed_short",
  "open_arched",
  "partial_chrome_bar",
  "open_glass",
] as const;

export const STAIRCASE_WOOD_SPECIES = [
  "oak",
  "walnut",
  "ash",
  "beech",
  "pine",
  "knotty_pine",
  "sapele",
  "iroko",
  "mahogany",
  "cherry",
  "teak",
  "maple",
  "yellow_pine",
  "alder",
] as const;

export const STAIRCASE_USE = [
  "primary_home",
  "secondary_home",
  "loft_access",
  "basement_access",
  "commercial",
  "fire_escape",
  "outdoor",
  "industrial",
] as const;

// ─── Tool: readStaircaseDesign ────────────────────────────────────

export const READ_STAIRCASE_DESIGN_TOOL: NexToolDef = {
  name: "readStaircaseDesign",
  description:
    "Read the customer's current staircase design state (every field they've " +
    "chosen so far). Call this at the start of a design conversation and " +
    "any time you need to reason about what has already been picked before " +
    "responding. Returns a JSON object with fields like country, materialFamily, " +
    "use, geometry, string (structural), riser, wood (primary timber), " +
    "treadWood, riserWood, handrailWood, handrail, balustrade, newel, finish. " +
    "Missing fields mean the customer hasn't picked them yet.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// ─── Tool: updateStaircaseDesign ──────────────────────────────────
// PER DOCTRINE AMENDMENT 2026-08-20 · chat may WRITE design state
// when customer issues a direct design instruction. Never silently,
// never during browse/question flows. Every write MUST carry
// provenance "chat_customer_instruction" + source_message_id.

export const UPDATE_STAIRCASE_DESIGN_TOOL: NexToolDef = {
  name: "updateStaircaseDesign",
  description:
    "Update one or more fields of the customer's staircase design. ONLY call " +
    "this when the customer has issued a direct design instruction (e.g. " +
    "'make it oak', 'change the handrail to walnut', 'add glass balustrades'). " +
    "NEVER call during browsing, questions, or exploration — that violates the " +
    "No Silent Writes doctrine. Every field written MUST use a canonical slug " +
    "from the enum (never free text). Use the enums exactly. When the customer " +
    "message is ambiguous (e.g. 'make it wider'), do not call this tool — " +
    "instead ask a clarifying question in your response, or apply a sensible " +
    "default and explain the assumption in your reply. When the customer " +
    "contradicts previous state (e.g. 'actually walnut instead of oak'), call " +
    "this to overwrite — the latest explicit instruction wins.",
  inputSchema: {
    type: "object",
    properties: {
      updates: {
        type: "object",
        description:
          "Object mapping field names to canonical slug values. Any subset " +
          "of the StaircaseDesign fields. Fields not included are unchanged. " +
          "Setting a field to null explicitly clears it (rare — usually you " +
          "want to change, not clear).",
      },
      sourceMessageId: {
        type: "string",
        description:
          "The customer message ID that triggered this update. Used for " +
          "provenance tracking and conflict resolution across surfaces.",
      },
    },
    required: ["updates"],
  },
};

// ─── Tool: generateInspiration (Phase 3 stub) ─────────────────────

export const GENERATE_INSPIRATION_TOOL: NexToolDef = {
  name: "generateInspiration",
  description:
    "Generate an inspirational staircase image from the customer's current " +
    "design + a natural-language prompt. Returns 'not_implemented' until " +
    "Phase 3 (Vibe Studio) ships. Use this ONLY when the customer explicitly " +
    "asks to see the design (e.g. 'show me', 'what would that look like', " +
    "'create an image'). Until Phase 3 lands, if you call this, tell the " +
    "customer honestly that visual generation is arriving soon and offer " +
    "to continue refining the design in text.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Concise natural-language description of the staircase to render. " +
          "Combine relevant fields from the current design + any extra " +
          "context from the customer's message.",
      },
    },
    required: ["prompt"],
  },
};

// ─── Tool: requestQuote (Phase 4 stub) ────────────────────────────

export const REQUEST_QUOTE_TOOL: NexToolDef = {
  name: "requestQuote",
  description:
    "Hand off the customer's design + reference images to a specialist for " +
    "quotation. Returns 'not_implemented' until Phase 4 (Quote-ready " +
    "Refacing + Geometry Engine) ships. Use ONLY when the customer asks " +
    "about price / cost / how much / getting a quote. NEVER invent a price " +
    "yourself — always call this tool. Until Phase 4 lands, if you call " +
    "this, tell the customer honestly: 'I'll use the staircase specification " +
    "to prepare the quote. A specialist will confirm dimensions and pricing.'",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// ─── Registry ─────────────────────────────────────────────────────

export const STAIRCASE_AGENT_TOOLS: readonly NexToolDef[] = [
  READ_STAIRCASE_DESIGN_TOOL,
  UPDATE_STAIRCASE_DESIGN_TOOL,
  GENERATE_INSPIRATION_TOOL,
  REQUEST_QUOTE_TOOL,
];
