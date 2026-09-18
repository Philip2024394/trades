// src/lib/nex-agent/code-engine/capability-conversation-gateway.ts
//
// NEX · NATIVE CONVERSATION GATEWAY · deterministic · zero LLM.
// Founder-authorised 2026-09-17 · Batch 1 Native Gateway & Progressive
// Unification Mission.
//
// PURPOSE (§3 gateway invariants):
//   The gateway performs ONLY deterministic transport + contract adaptation +
//   routing decision. It is NEVER a second intelligence layer.
//
//   Allowed operations:
//     · request normalization
//     · session normalization
//     · ConversationHead lookup / persistence
//     · explicit routing rule evaluation
//     · response normalization
//     · execution-source labelling
//     · error-state translation
//     · trace correlation
//
//   Prohibited operations:
//     · LLM reasoning
//     · semantic reasoning beyond deterministic pattern matching (delegated
//       to capability-a-founder-intent classifier)
//     · hidden fallback (a native failure MUST NOT silently invoke Qwen)
//     · duplicate memory (uses the ONE ConversationHead)
//     · duplicate conversation intelligence (delegates to runChatTurn)
//     · duplicate coding intelligence
//     · fabricated responses
//     · silent provider substitution
//
// ROUTING RULES (§7 · §8):
//   R1. classifier extracts coding-family verb OR explicit file/target
//        → route: NATIVE (runChatTurn)
//   R2. classifier refuses AND active conversation head has coding context
//        → route: NATIVE (runChatTurn · Fix 24 follow-up path handles it)
//   R3. message references a legacy domain adapter tag (accommodation, food,
//        transport, markets, travel, attractions, business, staircase, live
//        discovery, hotel, restaurant, itinerary, tour, market, shop, book, etc.)
//        → route: LEGACY (caller invokes existing consumer route; the gateway
//        does NOT invoke it directly · returns a `CAPABILITY_UNAVAILABLE_IN_NATIVE`
//        state that the caller can use to delegate)
//   R4. otherwise → route: NATIVE with the understanding that a native
//        refusal is legitimate and MUST NOT be silently rescued
//
// EXECUTION_SOURCE contract (§5):
//   Every response must carry exactly one of:
//     · NEX1_NATIVE                   (native path executed)
//     · LEGACY_QWEN                   (legacy path executed by caller)
//     · EXTERNAL_SERVICE              (external service invoked · not applicable
//                                      to gateway responses in Batch 1)
//     · CAPABILITY_UNAVAILABLE        (honest refusal · gateway declined to
//                                      route because no native capability
//                                      matches AND no legacy pass-through was
//                                      requested)
//
// SHADOW MODE (§9):
//   When mode === "shadow", the gateway performs the ROUTING DECISION and the
//   optional NATIVE INVOCATION but does NOT modify any ConversationHead state
//   and returns the decision + result without persisting turns to the store.
//   The caller can then compare shadow output against live legacy output for
//   parity analysis WITHOUT changing consumer state.

import { runChatTurn, type RunChatTurnResult } from "./capability-chat-turn";
import { classifyFounderIntent } from "./capability-a-founder-intent";
import type { Nex1IntentResult } from "./capability-a-founder-intent/types";
import {
  getConversationHead,
  type ConversationHead,
} from "./capability-conversation-context";

// ── Public shape ────────────────────────────────────────────────────────

export type GatewayMode = "live" | "shadow";

export type ExecutionSource =
  | "NEX1_NATIVE"
  | "LEGACY_QWEN"
  | "EXTERNAL_SERVICE"
  | "CAPABILITY_UNAVAILABLE";

export type RoutingDecision =
  | "route_native"
  | "route_legacy_domain"
  | "route_capability_unavailable";

export interface ConsumerNexRequest {
  /** Consumer session identifier · maps to conversation_id if not provided. */
  readonly sessionId?: string;
  /** Explicit conversation_id override · takes precedence when supplied. */
  readonly conversationId?: string;
  /** Human message · required. */
  readonly message: string;
  /** Optional list of previous turns · the gateway does NOT trust these as
   *  authoritative memory · they are used only for legacy context handoff.
   *  ConversationHead remains the truth source. */
  readonly historyForLegacy?: readonly { role: "user" | "assistant"; text: string }[];
  /** Explicit request for shadow-mode evaluation · defaults to "live". */
  readonly mode?: GatewayMode;
}

export interface GatewayResponse {
  readonly ok: true;
  readonly execution_source: ExecutionSource;
  readonly routing_decision: RoutingDecision;
  readonly routing_reason: string;
  readonly classifier_signals: {
    readonly kind: string;
    readonly verb_family: string | null;
    readonly file_references_count: number;
    readonly project_dir_references_count: number;
    readonly coding_concepts_count: number;
    readonly overall_confidence: number;
    readonly ambiguities: readonly string[];
  };
  readonly mode: GatewayMode;
  readonly conversation_id: string;
  /** Present when execution_source === "NEX1_NATIVE" · verbatim runChatTurn output. */
  readonly native_result: RunChatTurnResult | null;
  /** Present when routing_decision === "route_legacy_domain" · the gateway
   *  did NOT invoke legacy · caller must invoke /api/nex-conv/chat and label
   *  execution_source = LEGACY_QWEN on their response envelope. */
  readonly legacy_delegation_hint: {
    readonly detected_domain_tags: readonly string[];
    readonly caller_should_invoke: "/api/nex-conv/chat";
  } | null;
  /** Present when routing_decision === "route_capability_unavailable" · honest
   *  refusal · caller must NOT silently fall back to Qwen. */
  readonly refusal: {
    readonly reason: string;
  } | null;
  readonly zero_llm: true;
  readonly trace: readonly string[];
}

// ── Legacy domain detector · deterministic vocabulary from the domain-classifier
// audit. This list is deliberately SHORT and clearly consumer-product oriented ·
// no coding verbs, no ambiguous general English. Any token not in this list is
// treated as NEX1_NATIVE candidate. ────────────────────────────────────────

const LEGACY_DOMAIN_TOKENS: ReadonlySet<string> = new Set([
  // accommodation
  "hotel", "hotels", "stay", "stays", "accommodation", "villa", "villas",
  "guesthouse", "bnb", "airbnb", "resort",
  // food
  "restaurant", "restaurants", "food", "cafe", "cafes", "eat", "eatery",
  "dining", "cuisine", "menu",
  // transport
  "flight", "flights", "train", "trains", "transport", "bus", "buses",
  "taxi", "ferry", "airport", "kereta", "pesawat",
  // markets
  "market", "markets", "pasar", "shop", "shops", "mall", "malls", "shopping",
  // travel / itinerary
  "itinerary", "trip", "vacation", "holiday", "travel", "tour", "tours",
  // attractions
  "attraction", "attractions", "sights", "landmark", "landmarks", "temple",
  "temples", "beach", "beaches",
  // business
  "business", "businesses", "company", "companies",
  // staircase (consumer product specialty)
  "staircase", "staircases", "stair", "stairs", "spindle", "spindles",
  "handrail", "handrails", "newel", "tread", "riser",
]);

function detectLegacyDomainTags(message: string): string[] {
  const lc = message.toLowerCase();
  const tags: string[] = [];
  for (const t of LEGACY_DOMAIN_TOKENS) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lc)) tags.push(t);
  }
  return tags;
}

// ── Session adapter (§10) ──────────────────────────────────────────────

function normaliseConversationId(input: ConsumerNexRequest): string {
  if (input.conversationId && input.conversationId.trim().length > 0) return input.conversationId;
  if (input.sessionId && input.sessionId.trim().length > 0) return `session-${input.sessionId}`;
  // Fallback · anonymous per-request session (not ideal · consumer surfaces
  // should always send a sessionId for continuity)
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public entry ────────────────────────────────────────────────────────

export async function runNativeConversationGateway(
  input: ConsumerNexRequest,
  opts: { readonly repo_root?: string } = {},
): Promise<GatewayResponse> {
  const mode: GatewayMode = input.mode ?? "live";
  const conversation_id = normaliseConversationId(input);
  const trace: string[] = [];
  trace.push(`gateway · mode=${mode} · conversation_id=${conversation_id} · message_len=${input.message.length}`);

  // Deterministic classification (Capability A · zero LLM)
  const classification: Nex1IntentResult = classifyFounderIntent(input.message);
  trace.push(
    `gateway · classifier · kind=${classification.kind}` +
    (classification.kind === "classified"
      ? ` · verb=${classification.verb_family} · files=${classification.file_references.length} · concepts=${classification.coding_concepts.length}`
      : ` · refusal=${classification.refusal}`),
  );

  // Extract signals for the returned envelope
  const signals = {
    kind: classification.kind,
    verb_family: classification.kind === "classified" ? classification.verb_family : null,
    file_references_count: classification.kind === "classified" ? classification.file_references.length : 0,
    project_dir_references_count: classification.kind === "classified" ? classification.project_dir_references.length : 0,
    coding_concepts_count: classification.kind === "classified" ? classification.coding_concepts.length : 0,
    overall_confidence: classification.kind === "classified" ? classification.overall_confidence : 0,
    ambiguities: classification.kind === "classified" ? classification.ambiguities.map((a) => a.detail) : [],
  };

  // Legacy domain detection · deterministic vocabulary
  const legacyTags = detectLegacyDomainTags(input.message);

  // Routing decision · explicit rules R1-R4
  let routing: RoutingDecision;
  let routingReason: string;

  const head = getConversationHead(conversation_id);
  const hasActiveCodingContext = head.active_task_verb !== null && head.active_target !== null;
  const hasCodingSignals =
    classification.kind === "classified" &&
    (["FIX", "MODIFY", "INVESTIGATE", "TEST", "REFACTOR", "VERIFY", "REMOVE", "BUILD"].includes(classification.verb_family) ||
      classification.file_references.length > 0 ||
      classification.project_dir_references.length > 0);

  if (hasCodingSignals) {
    // R1
    routing = "route_native";
    routingReason = `classifier extracted coding signals (verb=${signals.verb_family} · files=${signals.file_references_count} · dirs=${signals.project_dir_references_count})`;
  } else if (classification.kind === "refused" && hasActiveCodingContext) {
    // R2 · Fix 24 follow-up territory
    routing = "route_native";
    routingReason = `classifier refused but active coding context exists (target=${head.active_target} · verb=${head.active_task_verb}) · native follow-up handler will interpret`;
  } else if (legacyTags.length > 0) {
    // R3 · legacy domain token detected · gateway declines to invoke legacy
    routing = "route_legacy_domain";
    routingReason = `legacy domain tag(s) detected: [${legacyTags.slice(0, 5).join(", ")}] · caller should invoke /api/nex-conv/chat`;
  } else {
    // R4 · attempt native · legitimate refusal allowed
    routing = "route_native";
    routingReason = `no coding signals and no legacy tags · attempting native; honest refusal is acceptable`;
  }
  trace.push(`gateway · routing=${routing} · reason=${routingReason}`);

  // Shadow mode · do NOT modify state · do NOT invoke native runChatTurn
  // that would persist turns. Return decision only.
  if (mode === "shadow") {
    trace.push(`gateway · shadow mode · NOT invoking runChatTurn · NOT persisting`);
    return buildResponse({
      routing,
      routingReason,
      classifier_signals: signals,
      mode,
      conversation_id,
      native_result: null,
      legacy_tags: legacyTags,
      trace,
    });
  }

  // Live mode · execute according to routing decision
  if (routing === "route_native") {
    const nativeResult = await runChatTurn({
      conversation_id,
      user_message: input.message,
      repo_root: opts.repo_root,
    });
    trace.push(`gateway · native invocation completed · state=${nativeResult.state} · zero_llm=${nativeResult.zero_llm}`);
    return buildResponse({
      routing,
      routingReason,
      classifier_signals: signals,
      mode,
      conversation_id,
      native_result: nativeResult,
      legacy_tags: legacyTags,
      trace,
    });
  }

  if (routing === "route_legacy_domain") {
    trace.push(`gateway · legacy domain hint returned · caller must invoke consumer route · gateway did NOT invoke legacy`);
    return buildResponse({
      routing,
      routingReason,
      classifier_signals: signals,
      mode,
      conversation_id,
      native_result: null,
      legacy_tags: legacyTags,
      trace,
    });
  }

  // route_capability_unavailable (only reachable if we add such a rule later)
  return buildResponse({
    routing: "route_capability_unavailable",
    routingReason,
    classifier_signals: signals,
    mode,
    conversation_id,
    native_result: null,
    legacy_tags: legacyTags,
    trace,
  });
}

// ── Response builder · guarantees execution_source is set correctly ─────

interface BuildInput {
  readonly routing: RoutingDecision;
  readonly routingReason: string;
  readonly classifier_signals: GatewayResponse["classifier_signals"];
  readonly mode: GatewayMode;
  readonly conversation_id: string;
  readonly native_result: RunChatTurnResult | null;
  readonly legacy_tags: readonly string[];
  readonly trace: readonly string[];
}

function buildResponse(b: BuildInput): GatewayResponse {
  let execution_source: ExecutionSource;
  if (b.mode === "shadow") {
    // Shadow mode did not execute anything · report the routing intent only.
    execution_source = "CAPABILITY_UNAVAILABLE";
  } else if (b.native_result) {
    // Native invocation happened · source is verbatim from runChatTurn.
    execution_source = b.native_result.source === "NEX1_NATIVE" ? "NEX1_NATIVE" : "CAPABILITY_UNAVAILABLE";
  } else if (b.routing === "route_legacy_domain") {
    // Gateway delegated to caller to invoke legacy · gateway itself did not
    // execute · label reflects the caller's responsibility.
    execution_source = "CAPABILITY_UNAVAILABLE";
  } else {
    execution_source = "CAPABILITY_UNAVAILABLE";
  }

  return {
    ok: true,
    execution_source,
    routing_decision: b.routing,
    routing_reason: b.routingReason,
    classifier_signals: b.classifier_signals,
    mode: b.mode,
    conversation_id: b.conversation_id,
    native_result: b.native_result,
    legacy_delegation_hint:
      b.routing === "route_legacy_domain"
        ? {
            detected_domain_tags: b.legacy_tags,
            caller_should_invoke: "/api/nex-conv/chat",
          }
        : null,
    refusal:
      b.routing === "route_capability_unavailable"
        ? { reason: b.routingReason }
        : null,
    zero_llm: true,
    trace: b.trace,
  };
}
