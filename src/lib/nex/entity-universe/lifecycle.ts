// src/lib/nex/entity-universe/lifecycle.ts
//
// NEX Entity Universe · Movement · Multi-location · Change detection
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Agent Runtime Phase B
//
// PURE FUNCTIONS. No I/O — the caller (persistence layer) applies the
// derived operations.
//
// COVERS:
//   §4  · movement (same business, new city, old placement → HISTORICAL)
//   §5  · multi-location (same business, additional active placement)
//   §7  · category evolution (do not destroy history)
//   §11 · no blind overwrite (every mutation produces a ChangeRecord)
//   §25 · movement vs duplicate (evidence determines the outcome)
//   §33 · change detection

import { randomUUID } from "node:crypto";
import type {
  BusinessId,
  BusinessIdentity,
  BusinessPlacement,
  CategoryAssignment,
  ChangeKind,
  ChangeRecord,
  ChangeSubject,
  EvidenceId,
  LocationRef,
  PlacementStatus,
} from "./types";

// ── Movement/expansion decision ────────────────────────────────────

export type PlacementIntent =
  | "APPEND_NEW_ACTIVE"          // §5 · additional active placement (multi-location)
  | "MOVE_MARK_PRIOR_HISTORICAL" // §4 · move · demote prior to HISTORICAL
  | "CLOSE_PRIOR"                // §32 · prior closed at that location
  | "MARK_AMBIGUOUS"             // §10 · unresolved
  | "NO_CHANGE";                 // nothing to update

export type MovementSignal = {
  /** Did evidence explicitly say the old location closed? */
  prior_closed: boolean;
  /** Did evidence explicitly say the old location moved (relocation)? */
  prior_moved: boolean;
  /** Did evidence indicate the business now operates from multiple
   *  places (chain expansion)? */
  is_multi_location_signal: boolean;
  /** How confident are we that the new placement belongs to this business? */
  identity_confidence: "HIGH" | "MEDIUM" | "LOW" | "AMBIGUOUS";
};

export function decidePlacementIntent(input: {
  existing_active_placements: ReadonlyArray<BusinessPlacement>;
  new_location: LocationRef;
  signal: MovementSignal;
}): PlacementIntent {
  const { existing_active_placements, new_location, signal } = input;

  if (signal.identity_confidence === "AMBIGUOUS") return "MARK_AMBIGUOUS";

  const anyAtSameCity = existing_active_placements.some(
    (p) => p.location.city_slug === new_location.city_slug,
  );

  // Multi-location signal + new city + no relocation flag → expand.
  if (signal.is_multi_location_signal && !signal.prior_moved && !anyAtSameCity) {
    return "APPEND_NEW_ACTIVE";
  }

  // Explicit relocation signal + new city → demote prior placements at
  // the SAME city as the (now-vacated) address to HISTORICAL. If there
  // are no prior placements, still appends a new active.
  if (signal.prior_moved && !anyAtSameCity) {
    return "MOVE_MARK_PRIOR_HISTORICAL";
  }

  // Explicit closure of prior without a new active → close.
  if (signal.prior_closed && !signal.is_multi_location_signal
      && existing_active_placements.length > 0) {
    return "CLOSE_PRIOR";
  }

  // No signal + already at the same city → NO_CHANGE.
  if (anyAtSameCity && !signal.prior_moved && !signal.is_multi_location_signal) {
    return "NO_CHANGE";
  }

  // Default when identity confidence is LOW and no strong signal → default
  // to APPEND_NEW_ACTIVE so we don't drop the evidence, but the caller
  // may downgrade it further (persistence layer decides).
  if (signal.identity_confidence === "LOW") return "APPEND_NEW_ACTIVE";

  // Otherwise · new city + no explicit move signal + no expansion signal
  // → treat as append-new-active with medium confidence. Do NOT silently
  // demote prior placements — the caller must have explicit signal to do
  // that (§4 · §25).
  return "APPEND_NEW_ACTIVE";
}

// ── Change record helpers (§11 · §33) ──────────────────────────────
// Every attribute mutation must produce a ChangeRecord. The persistence
// layer appends these; this module provides the constructors so no code
// path can silently overwrite.

function makeChange(input: {
  subject: ChangeSubject;
  kind: ChangeKind;
  previous_value: string | null;
  new_value: string | null;
  change_reason: string;
  evidence_ids: EvidenceId[];
  confidence: ChangeRecord["confidence"];
  now_iso?: string;
}): ChangeRecord {
  return {
    change_id: randomUUID(),
    subject: input.subject,
    kind: input.kind,
    previous_value: input.previous_value,
    new_value: input.new_value,
    change_reason: input.change_reason,
    evidence_ids: input.evidence_ids,
    confidence: input.confidence,
    observed_at_iso: input.now_iso ?? new Date().toISOString(),
  };
}

/** Compute the ChangeRecords implied by a placement mutation. Returns
 *  an empty array when nothing meaningful changed (idempotent). */
export function diffPlacementAttributes(input: {
  previous: BusinessPlacement;
  incoming: Partial<Pick<BusinessPlacement,
    "phone" | "whatsapp" | "website" | "email" | "opening_hours"
    | "location" | "category" | "status"
  >>;
  change_reason: string;
  evidence_ids: EvidenceId[];
  confidence: ChangeRecord["confidence"];
  now_iso?: string;
}): ChangeRecord[] {
  const { previous, incoming } = input;
  const subject: ChangeSubject = {
    kind: "placement",
    placement_id: previous.placement_id,
    business_id: previous.business_id,
  };
  const changes: ChangeRecord[] = [];

  const mkKindedChange = (kind: ChangeKind, prev: string | null, next: string | null) => {
    if (prev === next) return;
    changes.push(makeChange({
      subject, kind, previous_value: prev, new_value: next,
      change_reason: input.change_reason,
      evidence_ids: input.evidence_ids,
      confidence: input.confidence,
      now_iso: input.now_iso,
    }));
  };

  if (incoming.phone !== undefined) mkKindedChange("PHONE_CHANGED", previous.phone, incoming.phone ?? null);
  if (incoming.whatsapp !== undefined) mkKindedChange("WHATSAPP_CHANGED", previous.whatsapp, incoming.whatsapp ?? null);
  if (incoming.website !== undefined) mkKindedChange("WEBSITE_CHANGED", previous.website, incoming.website ?? null);
  if (incoming.email !== undefined) mkKindedChange("EMAIL_CHANGED", previous.email, incoming.email ?? null);
  if (incoming.opening_hours !== undefined) mkKindedChange("OPENING_HOURS_CHANGED", previous.opening_hours, incoming.opening_hours ?? null);
  if (incoming.status !== undefined && incoming.status !== previous.status) {
    changes.push(makeChange({
      subject, kind: "STATUS_CHANGED",
      previous_value: previous.status, new_value: incoming.status ?? null,
      change_reason: input.change_reason,
      evidence_ids: input.evidence_ids,
      confidence: input.confidence,
      now_iso: input.now_iso,
    }));
  }
  if (incoming.location) {
    const prevAddr = previous.location.address ?? "";
    const nextAddr = incoming.location.address ?? "";
    if (prevAddr !== nextAddr
        || previous.location.city_slug !== incoming.location.city_slug) {
      changes.push(makeChange({
        subject, kind: "ADDRESS_CHANGED",
        previous_value: JSON.stringify({ city: previous.location.city_slug, address: prevAddr }),
        new_value: JSON.stringify({ city: incoming.location.city_slug, address: nextAddr }),
        change_reason: input.change_reason,
        evidence_ids: input.evidence_ids,
        confidence: input.confidence,
        now_iso: input.now_iso,
      }));
    }
  }
  if (incoming.category) {
    const prevCat = previous.category;
    const nextCat = incoming.category;
    const changed =
      prevCat.vertical !== nextCat.vertical
      || prevCat.sub_category !== nextCat.sub_category
      || JSON.stringify(prevCat.additional_sub_categories) !== JSON.stringify(nextCat.additional_sub_categories);
    if (changed) {
      changes.push(makeChange({
        subject, kind: "CATEGORY_CHANGED",
        previous_value: JSON.stringify({ vertical: prevCat.vertical, sub: prevCat.sub_category, add: prevCat.additional_sub_categories }),
        new_value: JSON.stringify({ vertical: nextCat.vertical, sub: nextCat.sub_category, add: nextCat.additional_sub_categories }),
        change_reason: input.change_reason,
        evidence_ids: input.evidence_ids,
        confidence: input.confidence,
        now_iso: input.now_iso,
      }));
    }
  }
  return changes;
}

/** Compute ChangeRecords implied by a business-identity mutation. */
export function diffBusinessIdentity(input: {
  previous: BusinessIdentity;
  incoming: Partial<Pick<BusinessIdentity, "name" | "alternate_names">>;
  change_reason: string;
  evidence_ids: EvidenceId[];
  confidence: ChangeRecord["confidence"];
  now_iso?: string;
}): ChangeRecord[] {
  const { previous, incoming } = input;
  const subject: ChangeSubject = { kind: "business", business_id: previous.business_id };
  const changes: ChangeRecord[] = [];
  if (incoming.name !== undefined && incoming.name !== previous.name) {
    changes.push(makeChange({
      subject, kind: "NAME_CHANGED",
      previous_value: previous.name, new_value: incoming.name,
      change_reason: input.change_reason,
      evidence_ids: input.evidence_ids,
      confidence: input.confidence,
      now_iso: input.now_iso,
    }));
  }
  if (incoming.alternate_names !== undefined) {
    const prevSet = new Set(previous.alternate_names);
    for (const n of incoming.alternate_names) {
      if (!prevSet.has(n)) {
        changes.push(makeChange({
          subject, kind: "ALTERNATE_NAME_ADDED",
          previous_value: null, new_value: n,
          change_reason: input.change_reason,
          evidence_ids: input.evidence_ids,
          confidence: input.confidence,
          now_iso: input.now_iso,
        }));
      }
    }
  }
  return changes;
}

// ── Category evolution (§7 · never overwrite) ──────────────────────
// Returns the NEW category assignment when evolution is warranted;
// callers persist it and mark the prior as superseded.

export function evolveCategory(input: {
  current: CategoryAssignment;
  incoming_vertical: CategoryAssignment["vertical"];
  incoming_sub_category: string | null;
  additional_sub_categories?: string[];
  evidence_ids: EvidenceId[];
  now_iso?: string;
}): { evolved: boolean; next: CategoryAssignment | null } {
  const now = input.now_iso ?? new Date().toISOString();
  const additional = input.additional_sub_categories ?? [];

  // Same vertical + same sub_category + no new additional → no evolution
  const sameVertical = input.current.vertical === input.incoming_vertical;
  const sameSub = input.current.sub_category === input.incoming_sub_category;
  const newAdds = additional.filter((a) => !input.current.additional_sub_categories.includes(a));
  if (sameVertical && sameSub && newAdds.length === 0) {
    return { evolved: false, next: null };
  }
  return {
    evolved: true,
    next: {
      vertical: input.incoming_vertical,
      sub_category: input.incoming_sub_category,
      additional_sub_categories: Array.from(new Set([
        ...input.current.additional_sub_categories,
        ...(sameSub ? [] : [input.current.sub_category].filter((x): x is string => !!x)),
        ...additional,
      ])),
      specificity: input.incoming_sub_category ? "SUB_CATEGORY_KNOWN" : "VERTICAL_ONLY",
      effective_from_iso: now,
      superseded_at_iso: null,
      evidence_ids: input.evidence_ids,
    },
  };
}

// ── Placement status transitions ───────────────────────────────────
// Not every transition is allowed; e.g. CLOSED must not silently
// reactivate. All allowed transitions preserve auditability.

const ALLOWED_STATUS_TRANSITIONS: Record<PlacementStatus, ReadonlyArray<PlacementStatus>> = {
  ACTIVE:      ["HISTORICAL", "CLOSED", "AMBIGUOUS", "CONFLICTING"],
  STARTING:    ["ACTIVE", "CLOSED", "AMBIGUOUS"],
  PROVISIONAL: ["ACTIVE", "AMBIGUOUS", "CLOSED"],
  HISTORICAL:  ["ACTIVE"],                                // reactivation possible with new evidence
  CLOSED:      ["ACTIVE"],                                // reopening at same location with new evidence
  AMBIGUOUS:   ["ACTIVE", "CONFLICTING", "CLOSED"],
  CONFLICTING: ["ACTIVE", "AMBIGUOUS", "CLOSED"],
};

export function canPlacementStatusTransition(from: PlacementStatus, to: PlacementStatus): boolean {
  return (ALLOWED_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function assertPlacementStatusTransition(from: PlacementStatus, to: PlacementStatus): void {
  if (!canPlacementStatusTransition(from, to)) {
    throw new Error(`nex-entity-universe:invalid_placement_status_transition:${from}->${to}`);
  }
}
