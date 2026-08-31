// src/lib/nex/brain/tool-selection.ts
//
// Stage 3.18 · Phase 11 · Tool Selection (Philip 2026-08-31).
//
// Foundation before Commerce Brain intent + Action layer. Makes the
// Brain's tool choice EXPLICIT and AUDITABLE, replacing the implicit
// "always use retrieveKnowledge" pattern.
//
// v1 discipline:
//   · Deterministic decision function · no LLM
//   · Attached to BrainReply for observability
//   · Composer consults the decision · today's world_retrieval path
//     is formalised (not changed); commerce_retrieval / live_source /
//     calculator / user_action are declared but not yet triggered
//     (they light up as those verticals wire in)
//   · When a tool doesn't exist yet, the decision honestly says so ·
//     never fabricates a tool call
//
// This is the layer future Commerce Brain intent (Phase 12+) plugs
// into: add one case to selectTool, wire the composer, done.

import type { AccommodationSlots } from "./accommodation-slots";

export type ToolKind =
  | "world_retrieval"       // retrieveKnowledge · Indonesia knowledge corpus
  | "commerce_retrieval"    // findSellers/findProducts/findOffers (Stage 4 data model)
  | "live_source"           // BMKG earthquake · OSM live · future live sources
  | "calculator"            // future
  | "user_action"           // execute against resolved reference · future
  | "none";                 // no tool required (chit-chat, greetings, safety)

export type ToolAvailability = "available" | "declared_not_wired" | "gated";

export type ToolDecision = {
  /** Primary tool for this turn. */
  primary: ToolKind;
  /** Additional tools consulted / to consult. */
  secondary: ToolKind[];
  /** Why this tool was selected. */
  reason: string;
  /** Availability of the primary tool. `declared_not_wired` = the
   *  decision maps to a future tool that isn't consumed yet. */
  availability: ToolAvailability;
  /** Parameters we'd pass to the tool. Composer may consume these. */
  parameters?: Record<string, unknown>;
};

export type ToolSelectionInput = {
  intent: string;
  message: string;
  slots?: Readonly<AccommodationSlots>;
  userMarket?: "ID" | "UK" | "US";
  /** True when the current turn has a resolved reference to a specific business. */
  hasResolvedReference?: boolean;
};

// ─── The decision ────────────────────────────────────────────────────

export function selectTool(input: ToolSelectionInput): ToolDecision {
  const intent = input.intent;

  // Explicit action verbs on a resolved reference → user_action (future).
  // "book it" · "buy it" · "reserve it" — once Action layer + Governance
  // are in place, this dispatches. Today we honestly declare it.
  if (input.hasResolvedReference && input.slots?.action === "book") {
    return {
      primary: "user_action",
      secondary: ["world_retrieval"],
      reason: `book intent on resolved reference · Action layer not yet wired`,
      availability: "declared_not_wired",
      parameters: { referenceKind: "business", action: "book" },
    };
  }

  // Accommodation · food · tourism · indonesia · places · business →
  // world_retrieval (knowledge corpus + accommodation vertical).
  if (["accommodation", "food", "tourism", "indonesia", "places", "business"].includes(intent)) {
    const preferCategory = intent === "accommodation" ? "accommodation" : undefined;
    return {
      primary: "world_retrieval",
      secondary: [],
      reason: `intent=${intent} → grounded corpus retrieval${preferCategory ? ` · preferCategory=${preferCategory}` : ""}`,
      availability: "available",
      parameters: {
        preferCategory,
        market: input.userMarket,
        query: input.message,
        limit: 15,
        minConfidence: 0.5,
      },
    };
  }

  // Weather · live data · declared but not wired.
  if (intent === "weather") {
    return {
      primary: "live_source",
      secondary: [],
      reason: `intent=weather → live source (BMKG for ID) · not yet wired into chat path`,
      availability: "declared_not_wired",
      parameters: { source: "bmkg", market: input.userMarket },
    };
  }

  // Commerce · Stage 3.19 · commerce composer is wired · availability=available.
  if (intent === "commerce") {
    return {
      primary: "commerce_retrieval",
      secondary: [],
      reason: `intent=commerce → commerce world (Stage 4 findProducts + findOffers + joinOffers)`,
      availability: "available",
      parameters: { market: input.userMarket, query: input.message },
    };
  }

  // Marketplace · booking → commerce_retrieval (data model exists but
  // Brain composer for these two intents not wired yet · Phase 12+ candidates).
  if (intent === "marketplace" || intent === "booking") {
    return {
      primary: "commerce_retrieval",
      secondary: [],
      reason: `intent=${intent} → commerce world (Stage 4 data model) · not yet wired into Brain composer`,
      availability: "declared_not_wired",
      parameters: { market: input.userMarket, query: input.message },
    };
  }

  // Translation · writing → no tool required, deterministic composer.
  if (intent === "translation" || intent === "writing" || intent === "image") {
    return {
      primary: "none",
      secondary: [],
      reason: `intent=${intent} → composer answers directly · no external tool required`,
      availability: "available",
    };
  }

  // Safety · runs BEFORE tool selection, but if we get here with a
  // safety intent it's a routing bug · still honest.
  if (intent.startsWith("safety.")) {
    return {
      primary: "none",
      secondary: [],
      reason: "safety response handled by safety.ts before tool selection",
      availability: "available",
    };
  }

  // Conversation / greeting / meta → no tool.
  if (intent === "conversation") {
    return {
      primary: "none",
      secondary: [],
      reason: "conversational intent · composer replies directly",
      availability: "available",
    };
  }

  // Fallback · unknown intent (staircase / trades / quotation / documents
  // in ID market go through the passthrough path; UK staircase reaches
  // the Qwen specialist, not this decision function).
  return {
    primary: "none",
    secondary: [],
    reason: `intent=${intent} · no tool mapping defined`,
    availability: "available",
  };
}

/** Human-readable one-line summary for the ActivationTrace + logs. */
export function summariseToolDecision(d: ToolDecision): string {
  const secondary = d.secondary.length > 0 ? ` (+${d.secondary.join(",")})` : "";
  return `${d.primary}${secondary} · ${d.availability}`;
}
