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

export type ReferenceResolution =
  | {
      resolved: true;
      /** The business entity being referred to. */
      entity: RecognisedEntity;
      /** Which mention type triggered resolution. */
      refKind: "ordinal" | "pronoun";
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
        | "ambiguous_pronoun"            // pronoun with >1 presented business
        | "unknown_ordinal";             // ordinal we don't map
    };

/**
 * Resolve a reference from this turn's entities against the session's
 * rolling entity window. Deterministic · no LLM. Called after entity
 * extraction, before the composer's final wording.
 */
export function resolveReference(
  turnEntities: ReadonlyArray<RecognisedEntity>,
  sessionEntityWindow: ReadonlyArray<RecognisedEntity>,
): ReferenceResolution {
  const ordinal = turnEntities.find((e) => e.kind === "ordinal");
  const pronoun = turnEntities.find((e) => e.kind === "pronoun");
  if (!ordinal && !pronoun) {
    return { resolved: false, reason: "no_reference_mentioned" };
  }

  // Find the presented-business batch to resolve against.
  const presented = sessionEntityWindow.filter((e) => e.kind === "business_name" && e.source === "nex_reply");
  if (presented.length === 0) {
    return { resolved: false, reason: "no_prior_presentation" };
  }

  if (ordinal) {
    const offset = ORDINAL_TO_OFFSET[ordinal.canonical];
    if (offset === undefined) {
      return { resolved: false, reason: "unknown_ordinal" };
    }
    const hit = findPresentedBusinessByOffset(sessionEntityWindow, offset);
    if (!hit) {
      return { resolved: false, reason: "ordinal_out_of_range" };
    }
    return { resolved: true, entity: hit, refKind: "ordinal", offset };
  }

  // Pronoun-only path · resolve ONLY when unambiguous (batch size 1).
  // Determine the most-recent batch via atIso · same logic as
  // findPresentedBusinessByOffset uses internally.
  const mostRecentIso = presented[presented.length - 1].atIso;
  const batch = presented.filter((e) => e.atIso === mostRecentIso);
  if (batch.length > 1) {
    return { resolved: false, reason: "ambiguous_pronoun" };
  }
  return { resolved: true, entity: batch[0], refKind: "pronoun", offset: batch[0].presentedOffset ?? 1 };
}

/** Serialisable snapshot of the resolution for HTTP response + observability. */
export function summariseResolution(r: ReferenceResolution): {
  resolved: boolean;
  refKind?: "ordinal" | "pronoun";
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
