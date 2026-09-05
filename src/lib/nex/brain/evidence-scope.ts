// src/lib/nex/brain/evidence-scope.ts
//
// NEX Speaking Intelligence · Wave 4 · Evidence & Reasoning Discipline
// Philip 2026-09-06 · AUTHORIZE · WAVE 4 · §4 §5 §6
//
// PURPOSE
//   Distinguish 6 evidence states (§4) and expose an EvidenceScope
//   that names WHICH dimensions of the current turn have grounded
//   support. Both are the input to the model-boundary layer that
//   sits between retrieval and LLM composition.
//
// PRINCIPLE
//   The current pipeline reduces "did retrieval succeed?" to a single
//   `hits.length` integer (k). That collapses six meaningfully-different
//   states into one binary. Downstream code then makes decisions on
//   the wrong signal. §4 forbids that collapse.
//
// SCOPE
//   Pure functions. No IO. No LLM. Consumed by honest-boundary-reply
//   and (later) by the model-boundary layer.

// ─── 6-valued evidence state (§4) ──────────────────────────────

/** Every retrieval outcome resolves to exactly one of these states.
 *  Never mixed. Never silently mapped. */
export type EvidenceState =
  | "NO_EVIDENCE"         // retrieval returned k=0 for the scope
  | "PARTIAL_EVIDENCE"    // some scope dimensions covered, others not
  | "SUFFICIENT_EVIDENCE" // scope fully covered by grounded hits
  | "CONFLICTING_EVIDENCE"// two grounded sources materially disagree
  | "STALE_EVIDENCE"      // grounded hits exist but past freshness window
  | "OUT_OF_SCOPE_EVIDENCE"; // hits exist but do not cover the ASKED scope
                             // (this is the G24 "k>0 but irrelevant" case)

// ─── Evidence-scope dimensions (§6) ────────────────────────────

/** Every reasoning operation carries an evidence scope. Fields are
 *  optional — the presence of a value means "the message pinned this
 *  dimension" and the retrieval must cover it. */
export type EvidenceScope = {
  domain?: string;        // "accommodation" · "food" · "tourism" · ...
  geography?: string;     // "Yogyakarta" · "Tokyo" · ...
  entity?: string;        // "Griya Sentana Hotel" · "gudeg" · ...
  time?: string;          // "tonight" · "this weekend" · "current" · ...
  attribute?: string;     // "pool" · "price" · "capacity" · ...
  result_set?: boolean;   // does the question refer to an active result set?
  user_context?: boolean; // does the answer depend on user-provided facts?
  source?: string;        // pinned source name if the message references one
  freshness?: "current" | "any" | "historical";
};

// ─── Retrieval hit shape (minimal · just what we need) ─────────

export type MinimalHit = {
  id: string;
  /** Free-form text of the retrieved fact. Only used for coverage
   *  scoring — never fed to the model directly by this module. */
  content?: string;
  /** Optional geography/domain metadata carried by the source. */
  region?: string;
  domain?: string;
  /** ISO string · used for freshness computation. */
  last_verified?: string;
  /** Confidence in [0, 1]. */
  confidence?: number;
};

// ─── Evaluator ─────────────────────────────────────────────────

/** Classify the evidence state given: the asked scope, the retrieved
 *  hits, and the current time. Never invents scope coverage. */
export function classifyEvidenceState(input: {
  scope: EvidenceScope;
  hits: readonly MinimalHit[];
  nowMs?: number;
  /** Optional freshness window in ms. Default 180 days. */
  freshnessMs?: number;
}): {
  state: EvidenceState;
  reason: string;
  covered_dimensions: string[];
  missing_dimensions: string[];
} {
  const { scope, hits } = input;
  const nowMs = input.nowMs ?? Date.now();
  const freshnessMs = input.freshnessMs ?? 180 * 24 * 60 * 60 * 1000;

  // 1 · Zero hits → NO_EVIDENCE regardless of scope shape.
  if (hits.length === 0) {
    return {
      state: "NO_EVIDENCE",
      reason: "hits_empty",
      covered_dimensions: [],
      missing_dimensions: enumerateScopeDimensions(scope),
    };
  }

  // 2 · Coverage check per pinned dimension.
  const covered: string[] = [];
  const missing: string[] = [];
  const contentJoined = hits.map((h) => (h.content ?? "") + " " + (h.region ?? "") + " " + (h.domain ?? "")).join(" ").toLowerCase();
  const containsToken = (t: string) => new RegExp(`\\b${t.toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`).test(contentJoined);

  const dims: [string, string | undefined][] = [
    ["domain", scope.domain],
    ["geography", scope.geography],
    ["entity", scope.entity],
    ["attribute", scope.attribute],
  ];
  for (const [name, value] of dims) {
    if (value === undefined) continue;
    if (containsToken(value)) covered.push(name);
    else missing.push(name);
  }

  // 3 · Freshness · if all hits are past the window AND time is pinned to "current"
  const anyFresh = hits.some((h) => {
    if (!h.last_verified) return true;
    const ts = Date.parse(h.last_verified);
    if (Number.isNaN(ts)) return true;
    return (nowMs - ts) < freshnessMs;
  });
  if (!anyFresh && scope.freshness === "current") {
    return {
      state: "STALE_EVIDENCE",
      reason: "all_hits_stale_and_current_asked",
      covered_dimensions: covered,
      missing_dimensions: missing,
    };
  }

  // 4 · Primary-dimension miss · geography or entity pinned but not
  //     covered → OUT_OF_SCOPE_EVIDENCE. Geography and entity are the
  //     "hard" scope pins — asking about "Tokyo food" with Yogyakarta
  //     hits is not partial coverage, it's the wrong scope entirely.
  const pinnedCount = dims.filter(([, v]) => v !== undefined).length;
  const geographyOrEntityPinned = scope.geography !== undefined || scope.entity !== undefined;
  const geographyOrEntityMissed = (scope.geography !== undefined && missing.includes("geography"))
    || (scope.entity !== undefined && missing.includes("entity"));
  if (geographyOrEntityPinned && geographyOrEntityMissed) {
    return {
      state: "OUT_OF_SCOPE_EVIDENCE",
      reason: "primary_dimension_missed",
      covered_dimensions: covered,
      missing_dimensions: missing,
    };
  }
  // Fallback · pinned dimensions but ALL missing (rare — e.g., only
  // attribute pinned and unmatched).
  if (pinnedCount > 0 && covered.length === 0) {
    return {
      state: "OUT_OF_SCOPE_EVIDENCE",
      reason: "no_pinned_dimension_covered",
      covered_dimensions: covered,
      missing_dimensions: missing,
    };
  }

  // 5 · Some pinned covered, others missing → PARTIAL_EVIDENCE
  if (pinnedCount > 0 && missing.length > 0) {
    return {
      state: "PARTIAL_EVIDENCE",
      reason: "some_dimensions_covered",
      covered_dimensions: covered,
      missing_dimensions: missing,
    };
  }

  // 6 · CONFLICTING_EVIDENCE producer is reserved · no signal today
  // (would require diff-check across sources at content level).

  // 7 · Full coverage or no dimensions pinned → SUFFICIENT_EVIDENCE
  return {
    state: "SUFFICIENT_EVIDENCE",
    reason: pinnedCount > 0 ? "all_pinned_covered" : "no_pinned_dimensions",
    covered_dimensions: covered,
    missing_dimensions: missing,
  };
}

function enumerateScopeDimensions(scope: EvidenceScope): string[] {
  const out: string[] = [];
  if (scope.domain) out.push("domain");
  if (scope.geography) out.push("geography");
  if (scope.entity) out.push("entity");
  if (scope.attribute) out.push("attribute");
  if (scope.time) out.push("time");
  return out;
}

// ─── Convenience: is this state suitable for LLM composition? ──

/** The LLM composer may run ONLY when evidence is sufficient. Every
 *  other state must produce a deterministic honest boundary. */
export function stateAllowsComposition(s: EvidenceState): boolean {
  return s === "SUFFICIENT_EVIDENCE" || s === "PARTIAL_EVIDENCE";
}

/** True when the state means NEX must not make substantive domain
 *  claims — even though the LLM might be technically capable. */
export function stateRequiresHonestBoundary(s: EvidenceState): boolean {
  return s === "NO_EVIDENCE"
      || s === "OUT_OF_SCOPE_EVIDENCE"
      || s === "STALE_EVIDENCE"
      || s === "CONFLICTING_EVIDENCE";
}

// ─── Convenience: extract a compact observability payload ──────

export type EvidenceObservability = {
  state: EvidenceState;
  covered_dimensions: readonly string[];
  missing_dimensions: readonly string[];
  hit_count: number;
  fresh_hit_count: number;
  reason: string;
};

export function toEvidenceObservability(input: {
  scope: EvidenceScope;
  hits: readonly MinimalHit[];
  nowMs?: number;
  freshnessMs?: number;
}): EvidenceObservability {
  const c = classifyEvidenceState(input);
  const nowMs = input.nowMs ?? Date.now();
  const freshnessMs = input.freshnessMs ?? 180 * 24 * 60 * 60 * 1000;
  const fresh = input.hits.filter((h) => {
    if (!h.last_verified) return true;
    const ts = Date.parse(h.last_verified);
    if (Number.isNaN(ts)) return true;
    return (nowMs - ts) < freshnessMs;
  }).length;
  return {
    state: c.state,
    covered_dimensions: c.covered_dimensions,
    missing_dimensions: c.missing_dimensions,
    hit_count: input.hits.length,
    fresh_hit_count: fresh,
    reason: c.reason,
  };
}
