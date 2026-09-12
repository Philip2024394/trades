// src/lib/nex/live/analytics-claim.ts
//
// NEX LIVE · Phase A · Analytics with Evidence Discipline
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A
//
// PURPOSE (§22 · §26)
//   Every metric NEX ever surfaces about Live content or creators MUST
//   carry an evidence state. The immutable rule:
//
//     UNKNOWN ≠ 0
//
//   An empty database or missing measurement source is NOT zero. It's
//   "not available yet". Surfaces render that difference honestly.
//
// COMPOSITION
//   Mirrors the 6-state AttributeState discipline entity intelligence
//   already enforces. The Wave 7 Claim / verifier is the correct
//   downstream fabrication defense — this module produces the raw
//   AnalyticsFact records those verifiers consume.
//
// SCOPE (Phase A)
//   Pure types + validators + display projection. Zero database. Zero
//   collection endpoint. Phase G onwards produces real events; Phase B–L
//   optionally surface these facts through the existing conversational
//   Claim/Verifier if Philip authorises later.

// ── Metric taxonomy ────────────────────────────────────────────────

export type AnalyticsMetric =
  | "viewers_concurrent"
  | "viewers_unique"
  | "watch_time_seconds"
  | "watch_completion_ratio"
  | "follows"
  | "profile_visits"
  | "product_views"
  | "menu_views"
  | "chats_started"
  | "interests_expressed"
  | "booking_enquiries"
  | "conversions_verified";

// ── Evidence state (mirrors AttributeState 6-state discipline) ─────

export type AnalyticsEvidenceState =
  | "KNOWN_MEASURED"      // measurement source recorded actual events
  | "KNOWN_ZERO"           // measurement source ran, definitively zero events
  | "UNKNOWN"              // no measurement source available yet · never rendered as 0
  | "UNVERIFIED"           // events recorded but source integrity unproven
  | "CONFLICTING"          // two sources disagree
  | "STALE";               // measurement source last ran outside freshness window

export type AnalyticsFact = {
  metric: AnalyticsMetric;
  state: AnalyticsEvidenceState;

  /** The measured value. Present only when state === "KNOWN_MEASURED"
   *  or "KNOWN_ZERO". Null in every other state, so callers cannot
   *  accidentally render UNKNOWN as 0. */
  value: number | null;

  /** Which measurement source produced this fact — used by verifiers to
   *  decide whether to escalate UNVERIFIED → KNOWN_MEASURED. */
  source: string | null;

  /** ISO timestamp of measurement. */
  measured_at_iso: string | null;

  /** ISO timestamp of assessment (may equal measured_at_iso). */
  assessed_at_iso: string;
};

// ── Immutable guard: UNKNOWN ≠ 0 ────────────────────────────────────
// Throws when a caller tries to construct a fact that violates the rule.
// This is the mechanical enforcement of §22 — not a comment, a runtime
// assertion.

export function assertAnalyticsHonest(fact: AnalyticsFact): void {
  const numericStates: AnalyticsEvidenceState[] = ["KNOWN_MEASURED", "KNOWN_ZERO"];
  const requiresValue = numericStates.includes(fact.state);
  if (requiresValue && (fact.value === null || fact.value < 0)) {
    throw new Error(`nex-live:analytics_dishonest:${fact.state}_requires_non_negative_value`);
  }
  if (!requiresValue && fact.value !== null) {
    throw new Error(`nex-live:analytics_dishonest:${fact.state}_forbids_value`);
  }
  if (fact.state === "KNOWN_MEASURED" || fact.state === "KNOWN_ZERO"
      || fact.state === "UNVERIFIED" || fact.state === "STALE") {
    if (!fact.source) {
      throw new Error(`nex-live:analytics_dishonest:${fact.state}_requires_source`);
    }
    if (!fact.measured_at_iso) {
      throw new Error(`nex-live:analytics_dishonest:${fact.state}_requires_measured_at`);
    }
  }
}

// ── Display projection ─────────────────────────────────────────────
// UIs read this instead of the raw fact so no surface ever renders
// UNKNOWN as 0 by accident.

export type AnalyticsDisplay =
  | { kind: "number"; value: number }
  | { kind: "not_available_yet" }
  | { kind: "unverified"; provisional: number }
  | { kind: "stale"; last_known: number; measured_at_iso: string }
  | { kind: "conflicting" };

export function deriveAnalyticsDisplay(fact: AnalyticsFact): AnalyticsDisplay {
  switch (fact.state) {
    case "KNOWN_MEASURED":
    case "KNOWN_ZERO":
      return { kind: "number", value: fact.value ?? 0 };
    case "UNVERIFIED":
      return { kind: "unverified", provisional: fact.value ?? 0 };
    case "STALE":
      return { kind: "stale", last_known: fact.value ?? 0, measured_at_iso: fact.measured_at_iso ?? "" };
    case "CONFLICTING":
      return { kind: "conflicting" };
    case "UNKNOWN":
    default:
      return { kind: "not_available_yet" };
  }
}

// ── Factory · always safe by construction ──────────────────────────

export function newUnknownFact(metric: AnalyticsMetric, nowIso: string): AnalyticsFact {
  return {
    metric,
    state: "UNKNOWN",
    value: null,
    source: null,
    measured_at_iso: null,
    assessed_at_iso: nowIso,
  };
}
