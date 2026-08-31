// src/lib/nex/brain/tool-router.ts
//
// Stage 3.35 · Phase E · NEX Tool Router (Philip 2026-08-31).
//
// CONSTITUTIONAL:
//   · Deterministic, inspectable · no LLM
//   · Precedence order fixed · no random tool selection
//   · Ambiguous requests → clarification · never a random tool
//   · Missing required inputs → BLOCKED · no fabricated evidence
//   · World routing continues via existing INTENT_TO_VERTICAL + adapters
//     (this router doesn't duplicate them · it sits above)
//
// Sits ABOVE existing tool-selection.ts (Stage 3.18) · does NOT replace
// it. tool-selection.ts remains the per-turn observational summary of
// what the composer implicitly used · tool-router.ts is the new
// deterministic dispatcher for calculator/weather/knowledge/action/
// world/world_plan/ambiguous.

export type ToolCategory =
  | "world"           // existing verticals · INTENT_TO_VERTICAL match
  | "world_plan"      // Phase D multi-step (parsePlanSteps 2+ steps)
  | "action"          // wraps action.ts · needs resolved target
  | "calculator"      // deterministic math
  | "weather"         // honest unavailable state today
  | "knowledge"       // editorial JSON wrapper (retrieveKnowledge)
  | "ambiguous"       // clarification prompt · no tool fired
  | "unsupported";    // request has no matching tool

/** Kind of value a tool needs at execution time. */
export type ToolInputKind =
  | "string"
  | "number"
  | "worldRecord"
  | "coordinates"
  | "phone"
  | "whatsapp"
  | "email"
  | "url";

export type ToolInput = {
  name: string;
  kind: ToolInputKind;
  source: "message" | "session" | "upstream_step" | "world" | "provider";
  requiredFrom?: string;   // upstream step id when source=upstream_step
};

export type EvidenceRequirement = {
  field: string;
  purpose: string;
  fallback: "block" | "clarify" | "proceed_without";
};

export type ToolSelection = {
  category: ToolCategory;
  toolId: string;                       // "world:accommodation" · "calculator:percentage" · etc.
  reason: string;
  precedenceRank: number;               // 1 = highest · matches the router's checked-order
  requiredInputs: readonly ToolInput[];
  optionalInputs: readonly ToolInput[];
  evidenceRequirements: readonly EvidenceRequirement[];
  readOnly: boolean;                    // false = mutates external state
  performsExternalAction: boolean;      // sends messages · books · pays
  verificationRequired: boolean;        // needs post-execution proof
  parameters: Record<string, unknown>;
};

/** Explicit execution states · used by executors + reporting. */
export type ExecutionState =
  | "pending"
  | "executing"
  | "executed"
  | "verified"
  | "failed"
  | "unavailable"
  | "unknown";

/** Post-execution verification state per doctrine:
 *    "not_required"          → tool is read-only
 *    "pending"               → verification in flight
 *    "verified"              → external proof received
 *    "unverified_but_executed" → we tried but couldn't confirm · honest
 *    "unavailable"           → verification channel down
 */
export type VerificationState =
  | "not_required"
  | "pending"
  | "verified"
  | "unverified_but_executed"
  | "unavailable";

// ─── Router input ───────────────────────────────────────────────────

export type RouterInput = {
  message: string;
  intent?: string;                      // classifier's intent (accommodation/food/etc.)
  hasMultiStep: boolean;                // caller pre-computed via parsePlanSteps.length >= 2
  hasResolvedReference?: boolean;       // session has a resolved business target
};

// ─── Precedence-based routing ───────────────────────────────────────

// Calculator markers · specific enough not to false-fire on words with
// hyphens (kos-kosan) or minus signs in text. Requires either:
//   · explicit "calculate/calc/compute/hitung" verb followed by digits, OR
//   · "N% of M" / "N% dari M" percentage pattern, OR
//   · standalone binary arithmetic "N + M" / "N * M" with spacing so
//     "kos-kosan" (letters-hyphen-letters) doesn't count.
const CALCULATOR_MARKERS = [
  /\b(calculate|calc|compute|hitung)\b.*\d/i,
  /\d+\s*(?:%|percent|persen)\s*(?:of|dari)\b/i,
  /\b\d+\s*[+\-*/×÷]\s*\d+\b/,
];

const WEATHER_MARKERS = [
  /\b(weather|forecast|temperature|raining|is it raining|is it sunny)\b/i,
  /\b(cuaca|hujan|panas|dingin)\b/i,
];

const KNOWLEDGE_MARKERS = [
  /\b(what\s+is|what\s+does|what\s+are|tell\s+me\s+about|explain)\s+(?:a|an|the)?\s*[a-z][\w-]{2,}/i,
  /\b(apa\s+itu|apa\s+arti|jelaskan)\s+[a-z][\w-]{2,}/i,
];

const ACTION_MARKERS = [
  /\b(message|contact|whatsapp|call|phone|reach\s+out\s+to)\b/i,
  /\b(hubungi|kontak|telepon|kirim\s+pesan)\b/i,
];

/**
 * Discovery/search verbs that should NEVER route to knowledge even
 * when the message also has a "what is X" pattern (e.g. "what hotels
 * are near Malioboro" is a discovery query, not a knowledge query).
 */
const DISCOVERY_VERBS = /\b(find|show|list|cari|tampilkan|tunjuk|hotels?\s+are|restaurants?\s+are|places?\s+are)\b/i;

const WORLD_INTENTS = new Set([
  "accommodation", "food", "business", "commerce", "marketplace", "transport",
]);

export function routeToTool(input: RouterInput): ToolSelection {
  const m = input.message;

  // 1. Multi-step plan wins.
  if (input.hasMultiStep) {
    return {
      category: "world_plan",
      toolId: "world_plan:sequenced",
      reason: "message describes 2+ sequential steps · Phase D WorldPlan takes over",
      precedenceRank: 1,
      requiredInputs: [],
      optionalInputs: [],
      evidenceRequirements: [],
      readOnly: true, performsExternalAction: false, verificationRequired: false,
      parameters: {},
    };
  }

  // 2. Explicit action verb + resolved reference.
  if (ACTION_MARKERS.some((rx) => rx.test(m)) && input.hasResolvedReference) {
    return {
      category: "action",
      toolId: "action:contact_or_message",
      reason: "explicit action verb (message/contact/whatsapp/call) + resolved reference in session",
      precedenceRank: 2,
      requiredInputs: [
        { name: "target",        kind: "worldRecord", source: "session" },
        { name: "contactChannel", kind: "string",     source: "world" },
      ],
      optionalInputs: [
        { name: "messageBody", kind: "string", source: "message" },
      ],
      evidenceRequirements: [
        { field: "target.whatsapp", purpose: "whatsapp send channel", fallback: "block" },
        { field: "target.phone",    purpose: "phone call channel",    fallback: "block" },
      ],
      readOnly: false,
      performsExternalAction: true,
      verificationRequired: true,
      parameters: {},
    };
  }

  // 3. Explicit calculation.
  if (CALCULATOR_MARKERS.some((rx) => rx.test(m))) {
    return {
      category: "calculator",
      toolId: "calculator:arithmetic",
      reason: "message contains explicit arithmetic pattern",
      precedenceRank: 3,
      requiredInputs: [
        { name: "operand", kind: "number", source: "message" },
      ],
      optionalInputs: [],
      evidenceRequirements: [
        { field: "numeric_arguments", purpose: "parse numbers from message", fallback: "block" },
      ],
      readOnly: true, performsExternalAction: false, verificationRequired: false,
      parameters: {},
    };
  }

  // 4. Explicit weather.
  if (WEATHER_MARKERS.some((rx) => rx.test(m))) {
    return {
      category: "weather",
      toolId: "weather:bmkg_or_provider",
      reason: "explicit weather query",
      precedenceRank: 4,
      requiredInputs: [
        { name: "location", kind: "string", source: "message" },
      ],
      optionalInputs: [],
      evidenceRequirements: [
        { field: "provider_available", purpose: "live weather source", fallback: "block" },
      ],
      readOnly: true, performsExternalAction: false, verificationRequired: false,
      parameters: {},
    };
  }

  // 5. Explicit knowledge · MUST NOT contain a discovery verb.
  if (KNOWLEDGE_MARKERS.some((rx) => rx.test(m)) && !DISCOVERY_VERBS.test(m)) {
    return {
      category: "knowledge",
      toolId: "knowledge:editorial",
      reason: "'what is X' / 'apa itu X' pattern without discovery verb",
      precedenceRank: 5,
      requiredInputs: [
        { name: "subject", kind: "string", source: "message" },
      ],
      optionalInputs: [],
      evidenceRequirements: [
        { field: "editorial_entry", purpose: "authoritative content", fallback: "block" },
      ],
      readOnly: true, performsExternalAction: false, verificationRequired: false,
      parameters: {},
    };
  }

  // 6. World vertical intent.
  if (input.intent && WORLD_INTENTS.has(input.intent)) {
    return {
      category: "world",
      toolId: `world:${input.intent}`,
      reason: `classifier intent ${input.intent} maps to a wired World adapter`,
      precedenceRank: 6,
      requiredInputs: [],
      optionalInputs: [
        { name: "city",     kind: "string",     source: "session" },
        { name: "area",     kind: "string",     source: "message" },
        { name: "category", kind: "string",     source: "session" },
        { name: "query",    kind: "string",     source: "message" },
      ],
      evidenceRequirements: [],
      readOnly: true, performsExternalAction: false, verificationRequired: false,
      parameters: { vertical: input.intent },
    };
  }

  // 7. Nothing matched · request is genuinely ambiguous OR unsupported.
  //    Prefer "ambiguous" (clarification) when message is short and
  //    non-specific · "unsupported" when it's clearly out of scope.
  const isVeryShort = m.trim().split(/\s+/).length <= 3;
  if (isVeryShort) {
    return {
      category: "ambiguous",
      toolId: "clarification",
      reason: "message too short/generic to route to a tool without guessing",
      precedenceRank: 7,
      requiredInputs: [],
      optionalInputs: [],
      evidenceRequirements: [],
      readOnly: true, performsExternalAction: false, verificationRequired: false,
      parameters: {},
    };
  }
  return {
    category: "unsupported",
    toolId: "unsupported",
    reason: `no tool matches this request's shape · intent=${input.intent ?? "unknown"}`,
    precedenceRank: 7,
    requiredInputs: [],
    optionalInputs: [],
    evidenceRequirements: [],
    readOnly: true, performsExternalAction: false, verificationRequired: false,
    parameters: {},
  };
}

// ─── Human-readable summary for logs / traces ───────────────────────
export function summariseToolSelection(t: ToolSelection): string {
  return `${t.category}:${t.toolId} (rank ${t.precedenceRank}) · ${t.reason}`;
}
