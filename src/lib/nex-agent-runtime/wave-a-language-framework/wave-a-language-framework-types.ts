// §36-WAVE-A · WAVE-A · 2026-09-15 · wave-a-language-framework
// NEX bounded infrastructure · Wave A language + framework specialist types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Locked catalogue for the five Wave A specialists:
//   nex-typescript-engineering
//   nex-react-engineering
//   nex-nextjs-engineering
//   nex-vitest-engineering
//   nex-postgresql-engineering
//
// Grep-heuristic v1 per docs/NEX1/SKILLS-ENGINEERING-LANGUAGE-FRAMEWORK-AUDIT-2026-09-15.md §17.
// AST upgrade is a future amendment; this file locks the v1 surface.

import type { SkillCandidate } from "../skills/skill-schema-types";

// ── Locked grep marker (identity) ───────────────────────────────────────

export const WAVE_A_GREP_MARKER = "§36-WAVE-A · WAVE-A · 2026-09-15 · wave-a-language-framework" as const;
export type WaveAGrepMarker = typeof WAVE_A_GREP_MARKER;

// ── Locked refusal codes (4) ────────────────────────────────────────────

export type WaveASpecialistRefusalCode =
  | "WA_INVALID_REQUEST"
  | "WA_INVALID_CANDIDATE"
  | "WA_UNKNOWN_SPECIALIST"
  | "WA_INTERNAL";

export const WAVE_A_REFUSAL_CODES: readonly WaveASpecialistRefusalCode[] = Object.freeze([
  "WA_INVALID_REQUEST",
  "WA_INVALID_CANDIDATE",
  "WA_UNKNOWN_SPECIALIST",
  "WA_INTERNAL",
]);

// ── Locked specialist ids (5) ───────────────────────────────────────────

export type WaveASpecialistId =
  | "nex-typescript-engineering"
  | "nex-react-engineering"
  | "nex-nextjs-engineering"
  | "nex-vitest-engineering"
  | "nex-postgresql-engineering";

export const WAVE_A_SPECIALIST_IDS: readonly WaveASpecialistId[] = Object.freeze([
  "nex-typescript-engineering",
  "nex-react-engineering",
  "nex-nextjs-engineering",
  "nex-vitest-engineering",
  "nex-postgresql-engineering",
]);

// ── Locked severity taxonomy (3) ────────────────────────────────────────

export type WaveASpecialistFindingSeverity = "advisory" | "warning" | "critical";

export const WAVE_A_FINDING_SEVERITIES: readonly WaveASpecialistFindingSeverity[] = Object.freeze([
  "advisory",
  "warning",
  "critical",
]);

// ── Locked finding-id union (exhaustive · 36) ──────────────────────────

export type WaveASpecialistFindingId =
  // nex-typescript-engineering (NTS · 8)
  | "NTS_TS_IGNORE_COMMENT"
  | "NTS_TS_EXPECT_ERROR_UNJUSTIFIED"
  | "NTS_TS_NOCHECK"
  | "NTS_ENUM_DECLARATION"
  | "NTS_NAMESPACE_DECLARATION"
  | "NTS_NON_NULL_ASSERTION_CHAIN"
  | "NTS_UNTYPED_JSON_PARSE"
  | "NTS_DEEP_MODULE_RELATIVE_5PLUS"
  // nex-react-engineering (NRX · 7)
  | "NRX_INDEX_AS_KEY"
  | "NRX_MAP_WITHOUT_KEY"
  | "NRX_DIRECT_STATE_MUTATION"
  | "NRX_USEEFFECT_NO_CLEANUP_SUBSCRIPTION"
  | "NRX_INLINE_STYLE_OBJECT_IN_LOOP"
  | "NRX_ANONYMOUS_HANDLER_IN_MAP"
  | "NRX_EAGER_USESTATE_INIT"
  // nex-nextjs-engineering (NNX · 7)
  | "NNX_SERVER_COMPONENT_WITH_CLIENT_HOOK"
  | "NNX_API_ROUTE_NO_ERROR_SHAPE"
  | "NNX_UNVALIDATED_SEARCHPARAMS"
  | "NNX_METADATA_EXPORT_IN_CLIENT_COMPONENT"
  | "NNX_HARDCODED_HTTP_URL"
  | "NNX_MISSING_ROUTE_RUNTIME_DECL"
  | "NNX_USE_CLIENT_IN_LAYOUT"
  // nex-vitest-engineering (NVT · 7)
  | "NVT_ONLY_LEFT_IN"
  | "NVT_TEST_NO_ASSERTION"
  | "NVT_SKIP_LEFT_IN"
  | "NVT_ASYNC_TEST_NO_AWAIT"
  | "NVT_TIMER_MOCK_NO_RESTORE"
  | "NVT_MISSING_DESCRIBE"
  | "NVT_LARGE_INLINE_SNAPSHOT"
  // nex-postgresql-engineering (NPG · 7)
  | "NPG_MISSING_PRIMARY_KEY"
  | "NPG_TIMESTAMP_WITHOUT_TIMEZONE"
  | "NPG_UNBOUNDED_VARCHAR"
  | "NPG_SERIAL_INSTEAD_OF_IDENTITY"
  | "NPG_MISSING_RLS_ENABLE"
  | "NPG_MULTI_STATEMENT_NO_TRANSACTION"
  | "NPG_UUID_WITHOUT_EXTENSION";

// Locked severity map · compile-time exhaustive.
export const WAVE_A_FINDING_ID_SEVERITY_MAP: Readonly<Record<WaveASpecialistFindingId, WaveASpecialistFindingSeverity>> = Object.freeze({
  // nex-typescript-engineering
  NTS_TS_IGNORE_COMMENT: "warning",
  NTS_TS_EXPECT_ERROR_UNJUSTIFIED: "warning",
  NTS_TS_NOCHECK: "critical",
  NTS_ENUM_DECLARATION: "advisory",
  NTS_NAMESPACE_DECLARATION: "advisory",
  NTS_NON_NULL_ASSERTION_CHAIN: "warning",
  NTS_UNTYPED_JSON_PARSE: "advisory",
  NTS_DEEP_MODULE_RELATIVE_5PLUS: "warning",
  // nex-react-engineering
  NRX_INDEX_AS_KEY: "warning",
  NRX_MAP_WITHOUT_KEY: "warning",
  NRX_DIRECT_STATE_MUTATION: "critical",
  NRX_USEEFFECT_NO_CLEANUP_SUBSCRIPTION: "warning",
  NRX_INLINE_STYLE_OBJECT_IN_LOOP: "advisory",
  NRX_ANONYMOUS_HANDLER_IN_MAP: "advisory",
  NRX_EAGER_USESTATE_INIT: "advisory",
  // nex-nextjs-engineering
  NNX_SERVER_COMPONENT_WITH_CLIENT_HOOK: "critical",
  NNX_API_ROUTE_NO_ERROR_SHAPE: "warning",
  NNX_UNVALIDATED_SEARCHPARAMS: "warning",
  NNX_METADATA_EXPORT_IN_CLIENT_COMPONENT: "warning",
  NNX_HARDCODED_HTTP_URL: "advisory",
  NNX_MISSING_ROUTE_RUNTIME_DECL: "advisory",
  NNX_USE_CLIENT_IN_LAYOUT: "warning",
  // nex-vitest-engineering
  NVT_ONLY_LEFT_IN: "critical",
  NVT_TEST_NO_ASSERTION: "critical",
  NVT_SKIP_LEFT_IN: "warning",
  NVT_ASYNC_TEST_NO_AWAIT: "warning",
  NVT_TIMER_MOCK_NO_RESTORE: "warning",
  NVT_MISSING_DESCRIBE: "advisory",
  NVT_LARGE_INLINE_SNAPSHOT: "advisory",
  // nex-postgresql-engineering
  NPG_MISSING_PRIMARY_KEY: "critical",
  NPG_TIMESTAMP_WITHOUT_TIMEZONE: "warning",
  NPG_UNBOUNDED_VARCHAR: "advisory",
  NPG_SERIAL_INSTEAD_OF_IDENTITY: "advisory",
  NPG_MISSING_RLS_ENABLE: "advisory",
  NPG_MULTI_STATEMENT_NO_TRANSACTION: "warning",
  NPG_UUID_WITHOUT_EXTENSION: "warning",
});

// ── Finding shape (locked) ──────────────────────────────────────────────

export interface WaveASpecialistFinding {
  readonly specialist_id: WaveASpecialistId;
  readonly finding_id: WaveASpecialistFindingId;
  readonly severity: WaveASpecialistFindingSeverity;
  readonly evidence_summary: string;
}

// ── Overall verdict (locked · 3) ────────────────────────────────────────

export type WaveASpecialistOverallVerdict = "no_findings" | "advisory_only" | "action_required";

// ── Request / response shapes ───────────────────────────────────────────

export interface RunWaveASpecialistsRequest {
  readonly candidate: SkillCandidate;
  readonly specialists_to_run: readonly WaveASpecialistId[] | "all";
}

export interface WaveAPerSpecialistResult {
  readonly specialist_id: WaveASpecialistId;
  readonly findings: readonly WaveASpecialistFinding[];
}

export interface RunWaveASpecialistsSuccess {
  readonly kind: "SUCCESS";
  readonly per_specialist: readonly WaveAPerSpecialistResult[];
  readonly total_findings: number;
  readonly critical_count: number;
  readonly warning_count: number;
  readonly advisory_count: number;
  readonly overall_verdict: WaveASpecialistOverallVerdict;
  readonly grep_marker: WaveAGrepMarker;
}

export interface RunWaveASpecialistsFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: WaveASpecialistRefusalCode;
  readonly reason: string;
  readonly offending_specialist: WaveASpecialistId | null;
  readonly grep_marker: WaveAGrepMarker;
}

export type RunWaveASpecialistsResult = RunWaveASpecialistsSuccess | RunWaveASpecialistsFailure;
