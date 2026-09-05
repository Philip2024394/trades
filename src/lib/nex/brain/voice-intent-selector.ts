// src/lib/nex/brain/voice-intent-selector.ts
//
// Stage 3.41 · Voice intent selector (Philip 2026-08-31).
//
// Reads the BrainReply signals produced by the constitutional composers
// and picks the right VoiceIntent + VoiceContent for the personality
// voice layer to render. Deterministic · no LLM · single decision
// point so the mapping is inspectable and testable.
//
// Precedence (first match wins · matches the intuitive order):
//   1. TERMINAL ACTION AUDIT  · reports the outcome honestly
//   2. AWAITING PROPOSAL      · asks the user to confirm
//   3. WORLD REASONING        · partial/full/zero evidence coverage
//   4. WORLD RECOMMENDATION   · pick + honest gaps
//   5. WORLD DISCOVERY        · found N / found nothing
//   6. TOOL SELECTION         · ambiguous / unsupported clarify
//   7. FALLBACK               · greeting / clarify
//
// The selector NEVER changes the semantic meaning of the underlying
// BrainReply · it only picks how to render it.

import type { BrainReply } from "./orchestrate";
import type { VoicePlea, VoiceIntent, VoiceContent } from "./personality-voice";
import type { PendingProposal } from "./action-authorization";
// Stage 3.42 · Conversation Layer (Philip 2026-09-01)
import { extractPragmaticFeatures } from "./pragmatic-features";
import { routeConversation, type ConversationRoute } from "./conversation-router";
import type { SessionState } from "./session";

export type SelectVoiceInput = {
  brain: BrainReply;
  pendingProposal?: PendingProposal | null;   // from SessionState post-turn
  message: string;                             // the user's raw message this turn
  /**
   * Stage 3.41.d P1 · did this turn's message actually resolve a
   * reference (e.g. "the second one" → Hotel B)? When true, the
   * selector prefers acknowledge_reference over discovery_hit even if
   * world_cards are still attached · because the user is confirming a
   * pick, not asking for a new discovery.
   */
  referenceJustResolved?: boolean;
  /**
   * Stage 3.41.d P2 · did this turn's message look like a follow-up
   * question about the currently-picked entity? (e.g. "what's good
   * about it?" / "tell me more"). The composer routes these to
   * entity-reasoning · the voice acknowledges via entity_followup.
   */
  entityFollowupIntent?: boolean;
  /**
   * The currently-picked entity (for acknowledge_reference and
   * entity_followup wording). Typically session.currentReference.business.
   */
  currentReferenceName?: string;
  /**
   * Stage 3.42 · Conversation Layer (Philip 2026-09-01) · optional
   * session state so the selector can consult conversation-router for
   * social/context replies BEFORE falling through to clarify_ambiguous.
   * When undefined, the router branch is skipped (backward compatible).
   */
  session?: SessionState | null;
};

/**
 * The single decision point. Returns a VoicePlea ready for renderVoice().
 * Also returns the derived reasoning so tests and telemetry can inspect
 * WHY this intent was chosen.
 */
export function selectVoiceIntent(input: SelectVoiceInput): VoicePlea & { chosenReason: string } {
  const b = input.brain;

  // 1. Terminal action audit takes highest precedence · it reports
  //    what actually happened to a mutation.
  const audit = b.action_audit;
  if (audit?.finalState) {
    const targetName = audit.target.canonical;
    const reason     = audit.verification.reason ?? audit.blockedReason;
    switch (audit.finalState) {
      case "VERIFIED":
        return {
          intent: "action_verified",
          content: { targetName },
          chosenReason: "action_audit.finalState === VERIFIED",
        };
      case "UNKNOWN":
        return {
          intent: "action_unknown",
          content: { targetName },
          chosenReason: "action_audit.finalState === UNKNOWN",
        };
      case "FAILED":
        return {
          intent: "action_failed",
          content: { targetName, reason },
          chosenReason: "action_audit.finalState === FAILED",
        };
      case "BLOCKED":
        return {
          intent: "action_blocked",
          content: { targetName, reason },
          chosenReason: "action_audit.finalState === BLOCKED",
        };
    }
  }

  // 2. Awaiting proposal · we're asking the user to confirm.
  //    This ALSO includes the case where the user's message parsed
  //    as AMBIGUOUS against a pending proposal (base reply already
  //    handles the ambiguous reprompt · we mirror it via voice).
  const pending = input.pendingProposal;
  if (pending && pending.status === "AWAITING") {
    // Is this the user's confirmation attempt that came back ambiguous?
    // The base reply text contains the ambiguous-reprompt phrasing
    // when that happens. Simple heuristic: if base.reply mentions
    // "yes or no" / "iya" / "jangan" this turn AND the proposal was
    // proposed on a prior turn, it's an ambiguous re-prompt.
    const isReprompt = /yes["\s]+or["\s]+no|"iya" atau "jangan"/i.test(b.reply)
                    && pending.proposedInTurn < (Number.MAX_SAFE_INTEGER); // best-effort · true when proposed earlier
    if (isReprompt && pending.proposedInTurn !== undefined) {
      return {
        intent: "auth_ambiguous",
        content: { targetName: pending.target.canonical },
        chosenReason: "pendingProposal AWAITING + base.reply matches ambiguous reprompt",
      };
    }
    return {
      intent: "propose_action",
      content: {
        targetName: pending.target.canonical,
        message:    pending.messageBody,
      },
      chosenReason: "pendingProposal.status === AWAITING",
    };
  }

  // 2.5. Stage 3.41.d P2 · follow-up question about the current entity.
  //    Checked AFTER action audit + awaiting proposal (those are hotter
  //    intents) but BEFORE acknowledge_reference · because a user
  //    saying "what's good about that one?" wants an ANSWER, not just
  //    to re-select. Also before reasoning/discovery/etc so a
  //    follow-up isn't drowned by a re-discovery.
  if (input.entityFollowupIntent && input.currentReferenceName) {
    return {
      intent: "entity_followup",
      content: {
        pickName:      input.currentReferenceName,
        pickDetail:    extractSingleEntityDetail(b),
        missingFields: extractSingleEntityMissingFields(b),
      },
      chosenReason: "P2 · follow-up about currently-picked entity",
    };
  }

  // 2.6. Stage 3.41.d P1 · reference just resolved this turn.
  //    Takes precedence over discovery_hit so we say
  //    "Yep — Griya Sentana." instead of "Yep — found 3." when the
  //    user picked one of the presented cards. Comes AFTER action gate
  //    handling · if the user's message was an action ("message them"),
  //    the pending proposal path above already responded.
  if (input.referenceJustResolved && input.currentReferenceName) {
    return {
      intent: "acknowledge_reference",
      content: { pickName: input.currentReferenceName },
      chosenReason: "P1 · reference just resolved this turn",
    };
  }

  // 3. Reasoning · multi-constraint evidence coverage
  const reasoning = b.world_reasoning;
  if (reasoning?.reasoned) {
    const coverage = reasoning.evidenceCoverage;
    if (coverage === 0) {
      return {
        intent: "reasoning_zero",
        content: {},
        chosenReason: "world_reasoning · evidenceCoverage === 0",
      };
    }
    const missing: string[] = [...(reasoning.unsupportedGlobally ?? [])].map(String);
    if (coverage < 1) {
      return {
        intent: "reasoning_partial",
        content: {
          pickName:      reasoning.pick?.name,
          pickDetail:    firstSupportedDetail(reasoning),
          missingFields: missing.length > 0 ? missing : undefined,
        },
        chosenReason: `world_reasoning · partial coverage ${coverage}`,
      };
    }
    return {
      intent: "reasoning_full",
      content: { pickName: reasoning.pick?.name },
      chosenReason: "world_reasoning · full coverage 1.0",
    };
  }

  // 4. Recommendation
  const rec = b.world_recommendation;
  if (rec?.recommended) {
    const missing: string[] = [...(rec.honestGaps ?? [])].map(String);
    return {
      intent: "recommendation_pick",
      content: {
        pickName:      rec.pick?.name,
        pickDetail:    formatPickDetail(rec),
        primarySignal: rec.primarySignal,
        missingFields: missing.length > 0 ? missing : undefined,
      },
      chosenReason: "world_recommendation.recommended === true",
    };
  }
  if (rec && !rec.recommended && rec.reason === "no_ranking_signal") {
    return {
      intent: "recommendation_no_signal",
      content: {},
      chosenReason: "world_recommendation.recommended === false · no_ranking_signal",
    };
  }

  // 5. Discovery
  const cards = b.world_cards;
  const cardCount = cards ? extractCardCount(cards) : 0;
  const worldRan = !!b.tool_selection && b.tool_selection.category === "world";
  if (cardCount > 0) {
    return {
      intent: "discovery_hit",
      content: { count: cardCount },
      chosenReason: `world_cards produced ${cardCount} records`,
    };
  }
  if (worldRan && cardCount === 0) {
    return {
      intent: "discovery_empty",
      content: {},
      chosenReason: "world adapter ran but returned zero records",
    };
  }

  // 6. Tool router · ambiguous / unsupported clarify
  const tool = b.tool_selection;
  if (tool?.category === "ambiguous") {
    // Stage 3.42 · Conversation Layer (Philip 2026-09-01) · BEFORE
    // returning clarify_ambiguous, give the conversation-router a
    // chance to recognise this as social_reply / context_signal /
    // acknowledged_answer. Router steps aside (returns null) when no
    // conversational route applies · in which case the original
    // clarify_ambiguous flows through unchanged.
    const preRoute = tryConversationRoute(input);
    if (preRoute) return preRoute;
    return {
      intent: "clarify_ambiguous",
      content: {},
      chosenReason: "tool_selection.category === ambiguous",
    };
  }
  if (tool?.category === "unsupported") {
    return {
      intent: "unsupported",
      content: {},
      chosenReason: "tool_selection.category === unsupported",
    };
  }

  // 7. Fallback · greeting for empty/short messages, honest_gap otherwise
  const trimmed = input.message.trim().toLowerCase();
  if (trimmed.length === 0 || /^(hi|hello|hey|halo|hai|yo)\b/.test(trimmed)) {
    return {
      intent: "greeting",
      content: {},
      chosenReason: "empty/greeting message with no other signals",
    };
  }

  // 7.5 · Stage 3.42 · Conversation Layer final fallback attempt.
  const preRoute = tryConversationRoute(input);
  if (preRoute) return preRoute;

  return {
    intent: "clarify_ambiguous",
    content: {},
    chosenReason: "fallback · no matching signal in BrainReply",
  };
}

// ─── Stage 3.42 · Conversation router bridge ──────────────────────────
//
// Consults conversation-router with pragmatic features · returns a
// VoicePlea when the router recognises social/context/acknowledged
// intent · returns null (caller falls through) otherwise. Extracted
// as a helper because we call it from TWO places: (a) before the
// tool_selection=ambiguous fallback and (b) before the final catch-
// all. Both paths currently end in clarify_ambiguous · router gets
// the last chance to route into a friendlier reply.

function tryConversationRoute(input: SelectVoiceInput): (VoicePlea & { chosenReason: string }) | null {
  const b = input.brain;
  const cards = b.world_cards;
  const cardCountForHot = cards ? extractCardCount(cards) : 0;
  const brainHasHotSignals =
    !!b.action_audit?.finalState
    || !!input.pendingProposal
    || !!b.world_reasoning?.reasoned
    || !!b.world_recommendation?.recommended
    || cardCountForHot > 0;
  const route: ConversationRoute | null = routeConversation({
    message: input.message,
    pragmatic: extractPragmaticFeatures(input.message),
    session: input.session ?? null,
    brainHasHotSignals,
  });
  if (!route) return null;
  if (route.kind === "social_reply") {
    return {
      intent: "social_reply",
      content: { addressName: route.addressName },
      chosenReason: "conversation-router · social_reply",
    };
  }
  if (route.kind === "context_signal") {
    return {
      intent: "context_signal",
      content: { contextSignal: route.signal, priorQuestion: route.priorQuestion },
      chosenReason: "conversation-router · context_signal",
    };
  }
  if (route.kind === "acknowledged_answer") {
    // Non-place conversational answers route to social_reply · reads
    // naturally ("Good to hear. What are you in the mood to do?") ·
    // reserves the context_signal template for actual place/topic
    // signals ("Yogyakarta — nice. What are you looking for?").
    return {
      intent: "social_reply",
      content: { addressName: undefined },
      chosenReason: "conversation-router · acknowledged_answer (non-place)",
    };
  }
  return null;
}

// ─── helpers ───────────────────────────────────────────────────────

function extractCardCount(cards: unknown): number {
  if (!cards || typeof cards !== "object") return 0;
  const c = cards as { cards?: unknown[]; records?: unknown[]; hits?: unknown[]; payload?: { hits?: unknown[] } };
  if (Array.isArray(c.cards))   return c.cards.length;
  if (Array.isArray(c.records)) return c.records.length;
  if (Array.isArray(c.hits))    return c.hits.length;
  if (Array.isArray(c.payload?.hits)) return c.payload.hits.length;
  return 0;
}

function formatPickDetail(rec: NonNullable<BrainReply["world_recommendation"]>): string | undefined {
  if (!rec.recommended) return undefined;
  // Prefer explicit pickReason string when available
  const reason = (rec as { pickReason?: string }).pickReason;
  if (reason && typeof reason === "string") return reason;
  return undefined;
}

/**
 * Stage 3.41.d P2 · pull a short factual detail about the picked entity
 * from whatever signals the Brain surfaced. Never fabricates.
 * Order of preference: reasoning pick detail > recommendation pick
 * detail > nothing (voice will honestly say "not much I can add").
 */
function extractSingleEntityDetail(b: BrainReply): string | undefined {
  const reasoning = b.world_reasoning;
  if (reasoning?.reasoned) {
    const detail = firstSupportedDetail(reasoning);
    if (detail) return detail;
  }
  const rec = b.world_recommendation;
  if (rec?.recommended) {
    const detail = (rec as { pickReason?: string }).pickReason;
    if (typeof detail === "string") return detail;
  }
  return undefined;
}

/**
 * Stage 3.41.d P2 · which fields are honestly missing for the picked
 * entity. Reuses whatever the constitutional composers already
 * surfaced (honestGaps / unsupportedGlobally). Never invented.
 */
function extractSingleEntityMissingFields(b: BrainReply): readonly string[] | undefined {
  const rec = b.world_recommendation;
  if (rec?.recommended && rec.honestGaps && rec.honestGaps.length > 0) {
    return [...rec.honestGaps].map(String);
  }
  const reasoning = b.world_reasoning;
  if (reasoning?.reasoned && reasoning.unsupportedGlobally && reasoning.unsupportedGlobally.length > 0) {
    return [...reasoning.unsupportedGlobally].map(String);
  }
  return undefined;
}

function firstSupportedDetail(reasoning: NonNullable<BrainReply["world_reasoning"]>): string | undefined {
  if (!reasoning.reasoned) return undefined;
  // Look at pickEvaluation.constraintEvaluations to find the first
  // "supported" evaluation and describe it briefly.
  const evals = (reasoning as { pickEvaluation?: { constraintEvaluations?: Array<{ constraint?: { kind?: string; detail?: string }; evidence?: string; rawEvidence?: unknown }> } }).pickEvaluation?.constraintEvaluations ?? [];
  for (const e of evals) {
    if (e.evidence === "supported") {
      const detail = e.constraint?.detail ? ` (${e.constraint.detail})` : "";
      return `${e.constraint?.kind ?? "criterion"}${detail}`;
    }
  }
  return undefined;
}
