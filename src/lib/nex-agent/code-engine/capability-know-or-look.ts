// src/lib/nex-agent/code-engine/capability-know-or-look.ts
//
// NEX · KNOW-or-LOOK Decision Architecture · S3 · 2026-09-21.
// Founder-authorised as part of the "Internet as External Knowledge
// Substrate" programme.
//
// PURPOSE
//
//   The central intelligence question NEX must be excellent at:
//
//       "Do I already know enough to answer, or do I need to look?"
//
//   Today (before this programme) that decision is IMPLICIT — it lives
//   in which RecallKind pattern matches. There is no first-class
//   classifier that names its answer. This module introduces one.
//
//   The classifier returns exactly one of four verdicts:
//
//     KNOWN            — NEX has sufficient established information.
//     LOOK_REQUIRED    — external information is required to answer.
//     LOOK_RECOMMENDED — NEX can answer but external verification
//                        would materially improve reliability.
//     INSUFFICIENT     — neither internal memory nor permitted
//                        external sources are sufficient.
//
//   The verdict is deterministic given the inputs. No LLM, no
//   guesswork. Each factor that contributes is exposed for audit.
//
// ANTI-CHEATING GUARANTEE
//
//   · Pure decision function · zero side effects · zero I/O.
//   · Every input factor is a boolean or a bounded enum.
//   · The verdict is derived by a small, auditable rule table
//     rather than a scoring model.
//   · Callers must supply the freshness verdict from
//     capability-freshness-policy.ts · this module NEVER invents
//     a freshness claim.
//   · An "unknown information class" input reduces to LOOK_REQUIRED
//     (fail-safe · never assume KNOWN when the class is undeclared).
//
// COMPOSITION
//
//   capability-chat-turn.ts consults this classifier when it has
//   parsed a user question but not yet decided whether to retrieve.
//   The verdict is stamped into the trace as
//
//       know_or_look · verdict=<VERDICT> · reason=<short>
//
//   so audit and regression suites can see why the decision was made.

import type { FreshnessVerdict, InformationClass } from "./capability-freshness-policy";

// ── Inputs ─────────────────────────────────────────────────────────────

export interface KnowOrLookInputs {
  /** Information class the user is asking about · from S4 source
   *  selection or the caller's classification. Unknown class fails
   *  safe to LOOK_REQUIRED. */
  readonly info_class: InformationClass | "unknown";

  /** Does NEX have a stored fact from a prior turn that would answer
   *  the question (e.g. a previously retained coordinate, an earlier
   *  weather value, a PERSONAL_PROJECT decision)? */
  readonly has_internal_memory: boolean;

  /** If has_internal_memory, what is the freshness verdict from
   *  capability-freshness-policy.assessFreshness()? */
  readonly memory_freshness: FreshnessVerdict | null;

  /** Did the user explicitly request current / latest / live
   *  information (words like "current", "now", "today", "latest",
   *  "right now", "as of today")? */
  readonly user_requested_current: boolean;

  /** Is the question about a specific external entity NEX would
   *  never own (e.g. weather in Jakarta, coordinates of Lyon)? */
  readonly external_entity: boolean;

  /** Does the internal memory carry a confidence high enough to
   *  answer without external verification (e.g. own_record with
   *  established evidence vs. an unconfirmed fragment)? */
  readonly memory_confidence: "high" | "medium" | "low" | "none";

  /** Is a permitted allowlisted source available for this
   *  information class? (from S4 source-selection) */
  readonly external_source_available: boolean;
}

// ── Output ─────────────────────────────────────────────────────────────

export type KnowOrLookVerdict =
  | "KNOWN"
  | "LOOK_REQUIRED"
  | "LOOK_RECOMMENDED"
  | "INSUFFICIENT";

export interface KnowOrLookResult {
  readonly verdict: KnowOrLookVerdict;
  readonly reason: string;
  /** The factors that fired the verdict, in the order they were
   *  consulted. Reads top-down as a rule audit. */
  readonly consulted_factors: readonly string[];
}

// ── Decision function ─────────────────────────────────────────────────
//
// Rule order (first match wins):
//
//   1. External-entity question + user asked for current
//      → LOOK_REQUIRED (if source available) else INSUFFICIENT.
//   2. User explicitly asked for current / latest / live
//      → LOOK_REQUIRED (if source available) else INSUFFICIENT.
//   3. External-entity question, no internal memory
//      → LOOK_REQUIRED (if source available) else INSUFFICIENT.
//   4. Internal memory present but freshness is stale or
//      verify_always → LOOK_REQUIRED (if source available)
//      else INSUFFICIENT.
//   5. Internal memory present, freshness fresh/no_expiry, high
//      confidence → KNOWN.
//   6. Internal memory present, freshness fresh/no_expiry, medium
//      confidence → LOOK_RECOMMENDED (verifying would materially
//      help but NEX can still answer).
//   7. Internal memory present, low or no confidence → LOOK_REQUIRED
//      (if source available) else INSUFFICIENT.
//   8. Unknown info class → LOOK_REQUIRED (if source available)
//      else INSUFFICIENT.
//   9. Fallback → INSUFFICIENT.

export function decideKnowOrLook(inputs: KnowOrLookInputs): KnowOrLookResult {
  const consulted: string[] = [];

  const external = inputs.external_source_available;
  const requireLook = (reason: string): KnowOrLookResult => ({
    verdict: external ? "LOOK_REQUIRED" : "INSUFFICIENT",
    reason: external ? reason : `${reason} · but no permitted source is available → INSUFFICIENT`,
    consulted_factors: consulted,
  });

  // Rule 1: external entity + explicit current request → LOOK_REQUIRED
  consulted.push(`external_entity=${inputs.external_entity}`);
  consulted.push(`user_requested_current=${inputs.user_requested_current}`);
  if (inputs.external_entity && inputs.user_requested_current) {
    return requireLook("external entity + user asked for current information");
  }

  // Rule 2: explicit current request alone → LOOK_REQUIRED
  if (inputs.user_requested_current) {
    return requireLook("user explicitly asked for current / latest information");
  }

  // Rule 3: external entity without any internal memory → LOOK_REQUIRED
  consulted.push(`has_internal_memory=${inputs.has_internal_memory}`);
  if (inputs.external_entity && !inputs.has_internal_memory) {
    return requireLook("external entity + no relevant internal memory");
  }

  // Rule 4: memory exists but freshness verdict says stale / verify_always
  consulted.push(`memory_freshness=${inputs.memory_freshness ?? "null"}`);
  if (inputs.has_internal_memory && (inputs.memory_freshness === "stale" || inputs.memory_freshness === "verify_always")) {
    return requireLook(`stored memory is ${inputs.memory_freshness} under freshness policy`);
  }

  // Rule 5-6: fresh/no_expiry memory decisions gated by confidence
  consulted.push(`memory_confidence=${inputs.memory_confidence}`);
  const isFreshOrEternal = inputs.memory_freshness === "fresh" || inputs.memory_freshness === "no_expiry";
  if (inputs.has_internal_memory && isFreshOrEternal) {
    if (inputs.memory_confidence === "high") {
      return { verdict: "KNOWN", reason: "internal memory is fresh/eternal with high confidence", consulted_factors: consulted };
    }
    if (inputs.memory_confidence === "medium") {
      return {
        verdict: external ? "LOOK_RECOMMENDED" : "KNOWN",
        reason: external
          ? "internal memory sufficient but external verification would materially improve reliability"
          : "internal memory is fresh with medium confidence and no external source available",
        consulted_factors: consulted,
      };
    }
    // low / none confidence fall through to Rule 7
  }

  // Rule 7: memory exists but low/no confidence
  if (inputs.has_internal_memory && (inputs.memory_confidence === "low" || inputs.memory_confidence === "none")) {
    return requireLook("internal memory has low or no confidence · look required");
  }

  // Rule 8: unknown info class · fail-safe
  consulted.push(`info_class=${inputs.info_class}`);
  if (inputs.info_class === "unknown") {
    return requireLook("information class is not registered · fail-safe requires a look");
  }

  // Rule 9: fallback
  return {
    verdict: "INSUFFICIENT",
    reason: "no rule matched · treating as INSUFFICIENT (honest degradation)",
    consulted_factors: consulted,
  };
}

// ── Trace emitter ─────────────────────────────────────────────────────
//
// Standard trace-line format so downstream regression suites can grep
// know_or_look decisions unambiguously.

export function emitKnowOrLookTrace(result: KnowOrLookResult): string {
  const shortReason = result.reason.length > 140 ? result.reason.slice(0, 137) + "..." : result.reason;
  return `know_or_look · verdict=${result.verdict} · reason=${shortReason}`;
}
