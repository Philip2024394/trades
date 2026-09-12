// src/lib/nex/brain/universal-discovery/result-set-page.ts
//
// NEX Universal Discovery Slice · Result-set page contract
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE
//   Universal 10-per-page pagination + active-entity + reference-state
//   contract that adapts across ALL discoverable verticals
//   (accommodation · food · commerce · service · transport · places).
//
// DESIGN
//   ONE contract. Vertical-specific knowledge lives in the entity itself,
//   NOT here. This file exposes pure types + pure reducers — no I/O,
//   no framework coupling, no fabrication. The existing
//   `presentRecordsExpanded()` in presentation.ts already produces
//   `ExpandedResultsPage` with the same page/total/pageSize/hasNext
//   shape · this module ADAPTS that into a durable session-scoped
//   ResultSetPage that can be referenced from later turns
//   ("the third one" / "one more" / "go back to the restaurants").
//
// PRESERVES
//   D1 · D3 · D4 · P0.3 · P0.4 · Universal Entity Delta v2 · G04 all
//   remain authoritative for reference resolution. This module ONLY
//   exposes state that those resolvers can read against.

import type { WorldVertical } from "../world-adapters/types";
import type { EntityResultCard } from "../entity-result-cards";

// ─── Types ───────────────────────────────────────────────────────

/** A single page of a discovery result set. `page` is 1-indexed.
 *  `entities` carries the presentation-ready cards for THIS page only
 *  (max 10). `totalAvailable` is the world-adapter total across all
 *  pages · derived from the same PresentedCardSet.totalAvailable that
 *  the existing composer already exposes. */
export type ResultSetPage = {
  page: number;
  page_size: number;                     // fixed at 10 per §5 of AUTHORIZE
  total_available: number;
  has_next: boolean;
  has_prev: boolean;
  entities: readonly EntityResultCard[]; // this page's cards (≤ page_size)
};

/** Historical / stale-context marker for a prior result set that the
 *  user has since topic-shifted away from. See §6 · a topic switch
 *  demotes an ACTIVE set to HISTORICAL · reference-resolution treats
 *  historical sets as unavailable for the "the second one" anchor. */
export type ResultSetState =
  | "NO_RESULT_SET"
  | "ACTIVE_RESULT_SET"
  | "HISTORICAL_RESULT_SET"
  | "STALE_RESULT_SET";

/** Session-durable snapshot of an active result set. Consumed by
 *  reference-resolution + attribute-query gates so "third one" resolves
 *  even after intermediate turns. `active_entity_ref_id` is null when
 *  the user hasn't selected/anchored a specific entity yet. */
export type ActiveResultSetSnapshot = {
  set_id: string;                        // stable ID for this result set (sha of query + turn)
  vertical: WorldVertical;
  established_in_turn: number;
  state: ResultSetState;
  page: ResultSetPage;
  active_entity_ref_id: string | null;   // set when user selects a card / says "the third"
};

// ─── Pure functions · pagination reducer ─────────────────────────

/** Fixed page size · §5 requirement. Never overridden. */
export const RESULT_SET_PAGE_SIZE = 10;

/** Build a ResultSetPage from a flat entity list + current page.
 *  Pure · slicing only · no fetch. Callers already have the full
 *  entity list via the existing world adapters. */
export function pageOf(
  allEntities: ReadonlyArray<EntityResultCard>,
  page: number,
  totalAvailable: number,
): ResultSetPage {
  const clampedPage = Math.max(1, Math.floor(page));
  const start = (clampedPage - 1) * RESULT_SET_PAGE_SIZE;
  const end = start + RESULT_SET_PAGE_SIZE;
  const entities = allEntities.slice(start, end);
  const totalPages = Math.max(1, Math.ceil(totalAvailable / RESULT_SET_PAGE_SIZE));
  return {
    page: clampedPage,
    page_size: RESULT_SET_PAGE_SIZE,
    total_available: totalAvailable,
    has_next: clampedPage < totalPages,
    has_prev: clampedPage > 1,
    entities,
  };
}

/** Advance to the next page. Returns the same page if already on last. */
export function nextPage(current: ResultSetPage, allEntities: ReadonlyArray<EntityResultCard>): ResultSetPage {
  if (!current.has_next) return current;
  return pageOf(allEntities, current.page + 1, current.total_available);
}

/** Retreat to the previous page. Returns the same page if already on first. */
export function prevPage(current: ResultSetPage, allEntities: ReadonlyArray<EntityResultCard>): ResultSetPage {
  if (!current.has_prev) return current;
  return pageOf(allEntities, current.page - 1, current.total_available);
}

// ─── Reference-position lookup ────────────────────────────────────

/** Resolve a 1-indexed ordinal against the current page's entities.
 *  Returns null when out-of-range · never guesses · caller must handle
 *  clarify path. §17: fresh-session ordinal remains safe via P0.4 —
 *  this function is only consulted when a result set is ACTIVE. */
export function resolveOrdinalOnPage(
  page: ResultSetPage,
  ordinal1Indexed: number,
): EntityResultCard | null {
  if (ordinal1Indexed < 1 || ordinal1Indexed > page.entities.length) return null;
  return page.entities[ordinal1Indexed - 1] ?? null;
}

/** "the last one" — the last entity on the current page (not the last
 *  in the total set). Matches natural conversational meaning. */
export function resolveLastOnPage(page: ResultSetPage): EntityResultCard | null {
  return page.entities.length === 0 ? null : page.entities[page.entities.length - 1];
}

// ─── State transitions ────────────────────────────────────────────

/** Establish a fresh ACTIVE result set from a discovery turn. Callers
 *  provide the vertical + all fetched entities + total + turn number. */
export function establishResultSet(input: {
  vertical: WorldVertical;
  allEntities: ReadonlyArray<EntityResultCard>;
  totalAvailable: number;
  currentTurn: number;
}): ActiveResultSetSnapshot {
  return {
    set_id: computeSetId(input.vertical, input.allEntities, input.currentTurn),
    vertical: input.vertical,
    established_in_turn: input.currentTurn,
    state: "ACTIVE_RESULT_SET",
    page: pageOf(input.allEntities, 1, input.totalAvailable),
    active_entity_ref_id: null,
  };
}

/** Demote an active set to HISTORICAL when a topic-shift fires and the
 *  user has moved to a different vertical. D4 already applies the
 *  session-side reset · this reflects the same event on the snapshot. */
export function demoteToHistorical(snapshot: ActiveResultSetSnapshot): ActiveResultSetSnapshot {
  return { ...snapshot, state: "HISTORICAL_RESULT_SET" };
}

/** Anchor an active entity within the current set (user selected/named
 *  a specific card). ref_id must belong to the current page or the
 *  call is a no-op — anchoring never fabricates. */
export function anchorActiveEntity(
  snapshot: ActiveResultSetSnapshot,
  ref_id: string,
): ActiveResultSetSnapshot {
  const hit = snapshot.page.entities.find((e) => e.ref_id === ref_id);
  if (!hit) return snapshot;
  return { ...snapshot, active_entity_ref_id: ref_id };
}

// ─── Deterministic set-id ─────────────────────────────────────────

function computeSetId(
  vertical: WorldVertical,
  entities: ReadonlyArray<EntityResultCard>,
  turn: number,
): string {
  const firstIds = entities.slice(0, 3).map((e) => e.ref_id).join("|");
  return `rs_${vertical}_${turn}_${simpleHash(firstIds)}`;
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
