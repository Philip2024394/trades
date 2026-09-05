// src/lib/nex/brain/reference-resolution.ts
//
// Stage 3.15 · Phase 8 · Reference Resolution (Philip 2026-08-31).
//
// Consumer of Entity Intelligence (Phase 7). When the user says "the
// second one" / "book it" / "yang kedua", we resolve to a specific
// business the user is talking about — from the most-recent batch
// NEX presented in a prior reply.
//
// v1 discipline:
//   · Ordinals resolve deterministically (offset = ordinal position)
//   · Pronouns resolve ONLY when the last presentation batch has
//     exactly one business (unambiguous). Multi-business batches
//     with a pronoun return unresolved with reason "ambiguous_pronoun"
//     — we don't guess.
//   · Missing context (no prior presentation) returns unresolved with
//     reason "no_prior_presentation".
//   · Result attached to session as `session.currentReference` for the
//     composer + downstream to consume. Observational v1: composer
//     acknowledges resolved reference in book-intent replies. No
//     action execution.

import type { RecognisedEntity } from "./entities";
import { findPresentedBusinessByOffset } from "./entities";

const ORDINAL_TO_OFFSET: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
};

// Stage 3.41.m · positional / temporal canonicals resolved dynamically.
// Kept out of the static map because their offset depends on the
// presented batch length OR on session.currentReference.
// Corpus R addendum · `next` mirrors `previous` (offset +1 vs -1).
const DYNAMIC_CANONICALS = new Set(["last", "previous", "yang_tadi", "next"]);

export type ReferenceResolution =
  | {
      resolved: true;
      /** The business entity being referred to. */
      entity: RecognisedEntity;
      /** Which mention type triggered resolution. */
      refKind: "ordinal" | "pronoun" | "pronoun_via_current_reference";
      /** The 1-indexed offset within the most-recent batch. */
      offset: number;
    }
  | {
      resolved: false;
      /** Why we couldn't resolve. Never a guess. */
      reason:
        | "no_reference_mentioned"       // no ordinal or pronoun in user message
        | "no_prior_presentation"        // no business_name entities in the window
        | "ordinal_out_of_range"         // "the fifth" but only 3 presented
        | "ambiguous_pronoun"            // pronoun with >1 presented business AND no current pick
        | "stale_current_reference"      // Stage 3.41.d P4 · current pick too old to reuse
        | "unknown_ordinal"              // ordinal we don't map
        | "previous_without_current"     // Stage 3.41.m · "yang sebelumnya" but no fresh current pick
        | "yang_tadi_without_current"    // Stage 3.41.m · "yang tadi" but no fresh current pick AND batch is ambiguous
        | "next_without_current";        // Stage 3.41.m addendum · "yang next" but no fresh current pick to base +1 on
    };

/**
 * Stage 3.41.d P4 · staleness threshold for reusing the session's
 * currentReference as the pronoun target. Beyond this many turns of
 * silence about the pick, pronoun references are treated as ambiguous
 * and NEX must ask rather than guess.
 */
export const PRONOUN_CURRENT_REFERENCE_MAX_TURN_AGE = 3;

/**
 * Optional session-level context for smarter pronoun resolution.
 * Stage 3.41.d P4 · when the user has RECENTLY picked one specific
 * entity (via ordinal or explicit name) and the current turn uses a
 * pronoun ("them"/"it"/"mereka"/"dia"), we resolve the pronoun to
 * that recent pick — even when the presented batch has multiple
 * candidates. Never guesses when the pick is stale or absent.
 */
export type ResolveReferenceContext = {
  /** From session.currentReference · the last resolved pick (if any). */
  currentReferenceEntity?: RecognisedEntity;
  /** Turn number when currentReferenceEntity was resolved · used for staleness. */
  currentReferenceResolvedInTurn?: number;
  /** Current turn number (from session.turnCount+1). */
  currentTurn?: number;
};

/**
 * Resolve a reference from this turn's entities against the session's
 * rolling entity window. Deterministic · no LLM. Called after entity
 * extraction, before the composer's final wording.
 *
 * Stage 3.41.d P4 · third argument optional · when provided,
 * pronouns can resolve via a recent currentReference pick even if the
 * presented batch is ambiguous. Preserves the constitutional rule:
 * never guess. Stale picks (> PRONOUN_CURRENT_REFERENCE_MAX_TURN_AGE)
 * make pronouns unresolvable rather than resolve to a possibly-wrong
 * candidate.
 */
export function resolveReference(
  turnEntities: ReadonlyArray<RecognisedEntity>,
  sessionEntityWindow: ReadonlyArray<RecognisedEntity>,
  ctx: ResolveReferenceContext = {},
): ReferenceResolution {
  const ordinal = turnEntities.find((e) => e.kind === "ordinal");
  const pronoun = turnEntities.find((e) => e.kind === "pronoun");
  if (!ordinal && !pronoun) {
    return { resolved: false, reason: "no_reference_mentioned" };
  }

  // Find the presented-entity batch to resolve against.
  // P1 REDIRECT (Philip 2026-09-05): widened from business_name-only
  // to also accept `place` and `area` kinds when source === "nex_reply".
  // Reason: the P0.2 `composed-entities.ts` extractor emits `kind:"place"`
  // for enumerated locations in composed replies (e.g., "the three main
  // Indonesian tuna fishing regions are Aceh, Java, and Sulawesi").
  // Without this widening, ordinal reference to composed lists always
  // fails ("current_reference.resolved = null" — the known P0.2 gap).
  // Every kind accepted here still requires source === "nex_reply" so
  // user-generated entities (kind:"place" from a user message) never
  // become ordinally-resolvable — only entities NEX actually presented.
  const presented = sessionEntityWindow.filter(
    (e) =>
      (e.kind === "business_name" || e.kind === "place" || e.kind === "area") &&
      e.source === "nex_reply",
  );
  if (presented.length === 0) {
    return { resolved: false, reason: "no_prior_presentation" };
  }

  if (ordinal) {
    // Stage 3.41.m · resolve positional / temporal canonicals against
    // the most-recent batch + session.currentReference. Static numeric
    // ordinals go through the map unchanged.
    let offset: number | undefined = ORDINAL_TO_OFFSET[ordinal.canonical];

    if (offset === undefined && DYNAMIC_CANONICALS.has(ordinal.canonical)) {
      // Determine most-recent batch to size / index against.
      const mostRecentIso = presented[presented.length - 1].atIso;
      const batch = presented.filter((e) => e.atIso === mostRecentIso);

      // Freshness of currentReference (same discipline as pronoun path).
      const ctxFresh =
        ctx.currentReferenceEntity !== undefined
        && ctx.currentReferenceResolvedInTurn !== undefined
        && ctx.currentTurn !== undefined
        && (ctx.currentTurn - ctx.currentReferenceResolvedInTurn) <= PRONOUN_CURRENT_REFERENCE_MAX_TURN_AGE;

      if (ordinal.canonical === "last") {
        // Deterministic: last item in the most-recent batch.
        offset = batch.length;
      } else if (ordinal.canonical === "previous") {
        // Requires currentReference · resolves to offset - 1.
        if (!ctxFresh || !ctx.currentReferenceEntity!.presentedOffset || ctx.currentReferenceEntity!.presentedOffset <= 1) {
          return { resolved: false, reason: "previous_without_current" };
        }
        offset = ctx.currentReferenceEntity!.presentedOffset - 1;
      } else if (ordinal.canonical === "yang_tadi") {
        // Prefer currentReference (the "one we were just talking about").
        // Fall back to a single-entity batch. Never guess otherwise.
        if (ctxFresh && ctx.currentReferenceEntity!.presentedOffset) {
          offset = ctx.currentReferenceEntity!.presentedOffset;
        } else if (batch.length === 1) {
          offset = batch[0].presentedOffset ?? 1;
        } else {
          return { resolved: false, reason: "yang_tadi_without_current" };
        }
      } else if (ordinal.canonical === "next") {
        // Requires currentReference · resolves to offset + 1. If offset+1
        // exceeds batch length, fall through to ordinal_out_of_range so
        // the caller can respond honestly ("that was the last one").
        if (!ctxFresh || !ctx.currentReferenceEntity!.presentedOffset) {
          return { resolved: false, reason: "next_without_current" };
        }
        offset = ctx.currentReferenceEntity!.presentedOffset + 1;
      }
    }

    if (offset === undefined) {
      return { resolved: false, reason: "unknown_ordinal" };
    }
    const hit = findPresentedBusinessByOffset(sessionEntityWindow, offset);
    if (!hit) {
      return { resolved: false, reason: "ordinal_out_of_range" };
    }
    return { resolved: true, entity: hit, refKind: "ordinal", offset };
  }

  // Pronoun-only path · Stage 3.41.d P4 · try in order:
  //   (a) most-recent batch has exactly 1 business → resolve
  //   (b) currentReference is fresh AND its entity is in the window
  //       → resolve to that pick (this is how "message them" works
  //       after the user said "the second one")
  //   (c) otherwise → ambiguous_pronoun · never guess
  const mostRecentIso = presented[presented.length - 1].atIso;
  const batch = presented.filter((e) => e.atIso === mostRecentIso);
  if (batch.length === 1) {
    return { resolved: true, entity: batch[0], refKind: "pronoun", offset: batch[0].presentedOffset ?? 1 };
  }

  // (b) · consult currentReference if provided
  if (ctx.currentReferenceEntity && ctx.currentReferenceResolvedInTurn !== undefined && ctx.currentTurn !== undefined) {
    const age = ctx.currentTurn - ctx.currentReferenceResolvedInTurn;
    if (age > PRONOUN_CURRENT_REFERENCE_MAX_TURN_AGE) {
      return { resolved: false, reason: "stale_current_reference" };
    }
    // The pick must still be findable in the window (defense against
    // window rotation dropping it · shouldn't happen within N turns
    // but we don't trust it silently).
    const stillInWindow = presented.find(
      (e) => (ctx.currentReferenceEntity!.refId && e.refId === ctx.currentReferenceEntity!.refId)
          || e.canonical === ctx.currentReferenceEntity!.canonical,
    );
    if (stillInWindow) {
      return {
        resolved: true,
        entity: stillInWindow,
        refKind: "pronoun_via_current_reference",
        offset: stillInWindow.presentedOffset ?? 1,
      };
    }
  }

  // (c) · genuinely ambiguous · fail-closed
  return { resolved: false, reason: "ambiguous_pronoun" };
}

/** Serialisable snapshot of the resolution for HTTP response + observability. */
export function summariseResolution(r: ReferenceResolution): {
  resolved: boolean;
  refKind?: "ordinal" | "pronoun" | "pronoun_via_current_reference";
  offset?: number;
  business?: { canonical: string; raw: string; refId?: string };
  reason?: string;
} {
  if (r.resolved) {
    return {
      resolved: true,
      refKind: r.refKind,
      offset: r.offset,
      business: { canonical: r.entity.canonical, raw: r.entity.raw, refId: r.entity.refId },
    };
  }
  return { resolved: false, reason: r.reason };
}
