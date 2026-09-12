// src/lib/nex/brain/universal-discovery/viewed-entity.ts
//
// NEX World-Class Result Card Interaction & Entity Detail Slice
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§8 · §9 · §11)
//   Session-side memory that the user just opened /nex-app/entity/[refId]
//   for a specific entity. Consumed by the attribute-query gate + the
//   reference-resolution paths so a follow-up like "does it have a pool?"
//   after returning from the detail page resolves against the ENTITY
//   THE USER WAS JUST VIEWING (rather than the first ordinal on the
//   memoized card set).
//
// PRESERVES
//   D1 · D3 · D4 · P0.3 · P0.4 · G04 · entity-attribute-contract remain
//   authoritative. This module ADDS one more anchor for pronoun and
//   attribute-question resolution · it never overrides them.

import type { WorldVertical } from "../world-adapters/types";
import type { EntityCardMemo } from "../entity-result-cards";

// ─── Types ──────────────────────────────────────────────────────

/** Snapshot the user's most-recent entity detail view. Populated by
 *  the /api/nex-conv/session/view beacon endpoint · consumed by
 *  attribute-query + reference resolution. */
export type ViewedEntitySnapshot = {
  ref_id: string;                       // e.g. "place:accommodation:#AC-2026-0000D"
  vertical: WorldVertical;
  name: string;                         // display name captured at view time
  viewedInTurn: number;                 // session.turnCount at the beacon time
  viewedAtIso: string;                  // wall clock (audit only · never authoritative)
  /** Optional memoized attribute state for THIS entity · captured at
   *  beacon time from the same projectAttributes() the result cards
   *  use. When present, the attribute-query gate prepends this to
   *  session.entityCardMemo so a pronoun follow-up ("does it have a
   *  pool?") resolves against the entity the user just viewed. When
   *  absent, the standard memo-first pathway wins. */
  memo?: EntityCardMemo;
};

// ─── Freshness policy ──────────────────────────────────────────

/** How many turns after the beacon the viewed entity remains eligible
 *  as the pronoun/attribute-question anchor. Beyond this, references
 *  fall back to the standard entity-card-memo (memo[0]) path. */
export const VIEWED_ENTITY_FRESHNESS_TURNS = 3;

/** True IFF the viewed entity is fresh enough to anchor a follow-up
 *  question this turn. */
export function isViewedEntityFresh(
  snapshot: ViewedEntitySnapshot | undefined,
  currentTurn: number,
): boolean {
  if (!snapshot) return false;
  if (typeof snapshot.viewedInTurn !== "number") return false;
  if (currentTurn < snapshot.viewedInTurn) return false;
  return (currentTurn - snapshot.viewedInTurn) <= VIEWED_ENTITY_FRESHNESS_TURNS;
}

// ─── Pure constructors ─────────────────────────────────────────

/** Build a snapshot from beacon-payload primitives. Defensive parse ·
 *  returns null when required fields are missing or malformed so an
 *  invalid beacon can never corrupt session state. */
export function makeViewedEntitySnapshot(input: {
  ref_id: unknown;
  vertical: unknown;
  name: unknown;
  turnCount: number;
  nowIso?: string;
}): ViewedEntitySnapshot | null {
  const ref_id = typeof input.ref_id === "string" && input.ref_id.length > 0 ? input.ref_id : null;
  const vertical = isKnownVertical(input.vertical) ? input.vertical : null;
  const name = typeof input.name === "string" && input.name.length > 0 ? input.name : null;
  if (!ref_id || !vertical || !name) return null;
  if (!Number.isFinite(input.turnCount)) return null;
  return {
    ref_id,
    vertical,
    name,
    viewedInTurn: Math.max(1, Math.floor(input.turnCount)),
    viewedAtIso: input.nowIso ?? new Date().toISOString(),
  };
}

function isKnownVertical(v: unknown): v is WorldVertical {
  return v === "accommodation" || v === "food" || v === "commerce"
      || v === "service" || v === "transport" || v === "places";
}
