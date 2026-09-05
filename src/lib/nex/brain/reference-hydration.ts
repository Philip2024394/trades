// src/lib/nex/brain/reference-hydration.ts
//
// P0.3 · Hotel Resolved-Reference Continuity (Philip 2026-09-05 ·
// AUTHORIZE · P0.3 CORRECTION · HOTEL RESOLVED-REFERENCE CONTINUITY).
//
// PURPOSE:
//   When the session's currentReference resolved this turn to a
//   directory entity (via `resolveReference` in reference-resolution.ts),
//   the composition layer must see the full canonical record for that
//   entity — not just the ordinal position or the canonical name string.
//
// PROVEN FAILURE (before this module):
//   T1: User asks "Find me a hotel near Malioboro" → NEX presents
//       [Gaotama Hotel #AC-2026-0000D, Selaras Inn, Indonesia Hotel, ...]
//   T2: User asks "Tell me more about the first one" → reference-
//       resolution correctly resolves to refId="#AC-2026-0000D".
//   BUT: the accommodation deterministic composer doesn't consult
//       currentReference; it re-emits the T1 list-reply verbatim.
//       Resolved reference is lost between session state and composition.
//
// DESIGN:
//   · DETERMINISTIC: hydration reads the actual record via
//     `getWorldRecordById` — no LLM guessing.
//   · IF hydration fails (record deleted, wrong vertical, DB error) →
//     returns null · caller falls back to P0 zero-evidence guard.
//   · SCOPE LOCKED TO ACCOMMODATION per AUTHORIZE literal:
//     the parseRefId function recognizes all verticals but the caller
//     (route.ts) MUST only invoke this for accommodation. Other
//     verticals (gym/food/service continuity) are deferred to their
//     own authorization slices.
//   · FAIL-SAFE: never throws · bounded latency via getWorldRecordById.
//   · READ-ONLY: no session mutation · no DB writes.
//
// NEX HIERARCHY (preserved):
//   NEX reference-resolution (deterministic) →
//   NEX hydration (this module · deterministic · DB read) →
//   composition context (LLM sees the actual record) →
//   verification (existing) →
//   answer
//
// The LLM never decides which hotel the user meant. NEX decides
// (via ordinal resolution) and NEX hydrates (via getWorldRecordById).
// LLM only speaks over the hydrated record's actual fields.

import type { WorldRecord, WorldVertical, MarketCode } from "./world-adapters/types";
import { getWorldRecordById } from "./world-adapters";
import type { SessionState } from "./session";

/** Parse a session-stored refId into (vertical, canonicalId).
 *
 *  reference-resolution.ts stores refIds as `place:{vertical}:{id}`
 *  (e.g. `place:accommodation:#AC-2026-0000D`). This function also
 *  accepts bare refIds (e.g. `#AC-2026-0000D`) as a defensive fallback
 *  for future callers.
 *
 *  Returns null if the refId format is unrecognised — caller MUST
 *  handle null (fail-safe design). */
export function parseRefId(rawRefId: string | undefined | null): { vertical: WorldVertical; id: string } | null {
  if (!rawRefId || typeof rawRefId !== "string") return null;
  const trimmed = rawRefId.trim();
  if (!trimmed) return null;
  // Preferred format: place:{vertical}:{id}
  const m = /^place:([a-z_]+):(#[A-Z]{2}-\d{4}-[A-Z0-9]+)$/i.exec(trimmed);
  if (m) {
    const vertical = m[1].toLowerCase();
    const id = m[2];
    if (isKnownVertical(vertical)) return { vertical: vertical as WorldVertical, id };
    return null;
  }
  // Fallback: bare refId with vertical-encoded prefix (#AC/#SB/#FL)
  const m2 = /^(#[A-Z]{2})-\d{4}-[A-Z0-9]+$/i.exec(trimmed);
  if (m2) {
    const prefix = m2[1].toUpperCase();
    if (prefix === "#AC") return { vertical: "accommodation", id: trimmed.toUpperCase() };
    if (prefix === "#SB") return { vertical: "service", id: trimmed.toUpperCase() };
    if (prefix === "#FL") return { vertical: "food", id: trimmed.toUpperCase() };
    return null;
  }
  return null;
}

function isKnownVertical(v: string): boolean {
  return v === "accommodation" || v === "food" || v === "service"
    || v === "commerce" || v === "transport" || v === "places";
}

/** True IFF the session's currentReference is a fresh resolution on
 *  the given turn (not stale from a prior turn). Callers use this to
 *  avoid re-hydrating the same reference every turn. */
export function isReferenceFreshThisTurn(session: SessionState | null | undefined, currentTurn: number): boolean {
  if (!session) return false;
  const ref = session.currentReference as unknown as { resolved?: boolean; resolvedInTurn?: number } | undefined;
  if (!ref || ref.resolved !== true) return false;
  if (typeof ref.resolvedInTurn !== "number") return false;
  return ref.resolvedInTurn === currentTurn;
}

export type HydrationResult =
  | { hydrated: false; reason: string }
  | { hydrated: true; vertical: WorldVertical; record: WorldRecord };

/** Hydrate the session's currentReference to a full WorldRecord via
 *  the canonical `getWorldRecordById` adapter contract.
 *
 *  This is the deterministic bridge from "NEX resolved that the user
 *  meant entity X" → "here is the actual record NEX has for X".
 *
 *  Returns hydrated:false with a reason string when:
 *   · session is null / has no currentReference
 *   · currentReference is not resolved
 *   · refId format is unrecognized
 *   · vertical filter (verticalAllowlist) rejects the vertical
 *   · getWorldRecordById returns null (record not found in DB)
 *   · any error occurs during DB fetch (fail-safe)
 *
 *  The `verticalAllowlist` parameter is the SCOPE LOCK: callers pass
 *  ["accommodation"] to restrict this correction slice to hotel-only
 *  reference continuity per Philip's AUTHORIZE narrow scope. */
export async function hydrateResolvedReference(
  input: {
    session: SessionState | null | undefined;
    market: MarketCode;
    currentTurn: number;
    verticalAllowlist?: readonly WorldVertical[];
  },
): Promise<HydrationResult> {
  const { session, market, currentTurn } = input;
  if (!session) return { hydrated: false, reason: "no_session" };
  if (!isReferenceFreshThisTurn(session, currentTurn)) {
    return { hydrated: false, reason: "reference_not_fresh_this_turn" };
  }
  const ref = session.currentReference as unknown as {
    resolved?: boolean;
    business?: { refId?: string; canonical?: string; raw?: string };
  } | undefined;
  const rawRefId = ref?.business?.refId;
  if (!rawRefId) return { hydrated: false, reason: "no_refId_in_reference" };
  const parsed = parseRefId(rawRefId);
  if (!parsed) return { hydrated: false, reason: `unparseable_refId:${rawRefId}` };
  if (input.verticalAllowlist && !input.verticalAllowlist.includes(parsed.vertical)) {
    return { hydrated: false, reason: `vertical_not_allowed:${parsed.vertical}` };
  }
  let record: WorldRecord | null;
  try {
    record = await getWorldRecordById({ vertical: parsed.vertical, id: parsed.id, market });
  } catch (e) {
    return { hydrated: false, reason: `hydration_error:${String((e as Error)?.message ?? e).slice(0, 120)}` };
  }
  if (!record) return { hydrated: false, reason: "record_not_found" };
  return { hydrated: true, vertical: parsed.vertical, record };
}

// ─── WorldRecord → grounded knowledge shape ──────────────────────────
//
// Mirrors the shape that composition's `knowledge` array expects
// (topic, content, source, region, last_verified, stability). Kept
// intentionally minimal — this is not a schema change, just a
// conversion so the composer sees the hydrated record as first-class
// grounded evidence.
//
// Uses the same shape and honesty markers as
// `directory-knowledge.ts::worldRecordToKnowledge` — a caller
// wanting to inline this could reuse that. Kept local here so this
// module has no cross-import from `indonesia/directory-knowledge.ts`
// (that would blur the separation of concerns).

/** Deterministic hotel-record summary · used as a fallback when LLM
 *  composition over a hydrated hotel record fails claim verification
 *  (LLM added subjective/unsupported statements) OR fails to produce
 *  text at all. This summary uses ONLY fields present on the record —
 *  no fabrication · no interpretation · no marketing language.
 *
 *  Rationale: without this, a hydrated hotel reference would be lost
 *  to the deterministic accommodation composer's list-reemit fallback,
 *  defeating the entire P0.3 correction. The summary preserves the
 *  reference in the final response even under verifier rejection.
 *
 *  Keeps sentence structure minimal so it never triggers claim-verifier
 *  false positives on its own text. */
export function buildHotelRecordSummary(record: WorldRecord): string {
  const parts: string[] = [];
  // Name (always present per adapter contract).
  parts.push(record.name);
  // Optional descriptor triple: category + district + city
  const descriptors: string[] = [];
  if (record.category) descriptors.push(record.category);
  if (record.starRating !== undefined) descriptors.push(`${record.starRating}-star`);
  const loc: string[] = [];
  if (record.district) loc.push(record.district);
  if (record.city) loc.push(record.city);
  if (descriptors.length > 0 && loc.length > 0) {
    parts.push(`is a ${descriptors.join(" ")} in ${loc.join(", ")}.`);
  } else if (descriptors.length > 0) {
    parts.push(`is a ${descriptors.join(" ")}.`);
  } else if (loc.length > 0) {
    parts.push(`is in ${loc.join(", ")}.`);
  } else {
    parts.push("is on NEX's accommodation directory.");
  }
  if (record.address) parts.push(`Address: ${record.address}.`);
  if (record.phone) parts.push(`Phone: ${record.phone}.`);
  if (record.website) parts.push(`Website: ${record.website}.`);
  if (record.rating !== undefined) parts.push(`Rating: ${record.rating}${record.reviewCount ? ` (${record.reviewCount} reviews)` : ""}.`);
  if (record.roomCount !== undefined) parts.push(`${record.roomCount} rooms.`);
  if (record.amenities && record.amenities.length > 0) {
    parts.push(`Amenities: ${record.amenities.slice(0, 6).join(", ")}.`);
  }
  // Honesty markers · what NEX knows and doesn't know about this record.
  if (record.claimStatus === "listed") {
    parts.push("Listed on NEX (discovered from public directory data · not owner-verified).");
  } else if (record.verified) {
    parts.push("Owner-verified on NEX.");
  }
  return parts.join(" ");
}

export function hydratedRecordToKnowledge(record: WorldRecord): {
  id: string;
  topic: string;
  region: string;
  language: "en";
  stability: "live";
  confidence: number;
  source: string;
  last_verified: string;
  content: string;
  keywords: string[];
  walker_id: string;
} {
  const region = record.city ?? record.district ?? "Indonesia";
  const parts: string[] = [];
  parts.push(`${record.name}`);
  if (record.category) parts.push(`(${record.category})`);
  const locBits: string[] = [];
  if (record.district) locBits.push(record.district);
  if (record.city) locBits.push(record.city);
  if (locBits.length > 0) parts.push(`in ${locBits.join(", ")}`);
  if (record.address) parts.push(`· address: ${record.address}`);
  if (record.phone) parts.push(`· phone: ${record.phone}`);
  if (record.website) parts.push(`· website: ${record.website}`);
  if (record.rating !== undefined) parts.push(`· rating: ${record.rating}`);
  if (record.starRating !== undefined) parts.push(`· ${record.starRating} stars`);
  if (record.roomCount !== undefined) parts.push(`· ${record.roomCount} rooms`);
  if (record.amenities && record.amenities.length > 0) parts.push(`· amenities: ${record.amenities.slice(0, 8).join(", ")}`);
  if (record.claimStatus) parts.push(`· ${record.claimStatus} on NEX`);
  if (record.verified) parts.push(`· owner-verified`);
  const keywords = new Set<string>();
  for (const tok of record.name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length >= 3) keywords.add(tok);
  }
  if (record.category) keywords.add(record.category.toLowerCase());
  if (record.city) keywords.add(record.city.toLowerCase());
  if (record.district) keywords.add(record.district.toLowerCase());
  keywords.add(record.vertical);
  return {
    id: `hydrated:${record.vertical}:${record.id}`,
    topic: `${record.vertical}.${(record.category ?? "listing").toLowerCase()}.${record.id.toLowerCase()}`,
    region,
    language: "en",
    stability: "live",
    confidence: record.verified ? 0.98 : record.claimStatus === "listed" ? 0.85 : 0.7,
    source: `hydrated:reference:${record.vertical}`,
    last_verified: record.updatedAt ?? record.provenance?.readAt ?? new Date().toISOString().slice(0, 10),
    content: parts.join(" "),
    keywords: Array.from(keywords).slice(0, 12),
    walker_id: `hydrated:${record.vertical}`,
  };
}
