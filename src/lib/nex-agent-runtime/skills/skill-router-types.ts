// §36-E-4 · WAVE-E4 · 2026-09-14 · skill-router
// NEX bounded infrastructure · skill-router types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Types + refusal codes + locked constants for the skill router primitive.

import type {
  ApplyValidatorsResult,
  ApplyValidatorsSuccess,
  Skill,
  SkillCandidate,
} from "./skill-schema-types";

// ── Locked refusal-code union (exhaustive · 8) ──────────────────────────

export type SkillRouterRefusalCode =
  | "SR_EMPTY_LIBRARY"
  | "SR_DUPLICATE_SKILL_SLUGS"
  | "SR_INVALID_CANDIDATE"
  | "SR_INVALID_REQUEST"
  | "SR_SKILL_LIBRARY_TOO_LARGE"
  | "SR_MALFORMED_SKILL"
  | "SR_NON_DETERMINISTIC_ORDER"
  | "SR_INTERNAL";

export const SKILL_ROUTER_REFUSAL_CODES: readonly SkillRouterRefusalCode[] = Object.freeze([
  "SR_EMPTY_LIBRARY",
  "SR_DUPLICATE_SKILL_SLUGS",
  "SR_INVALID_CANDIDATE",
  "SR_INVALID_REQUEST",
  "SR_SKILL_LIBRARY_TOO_LARGE",
  "SR_MALFORMED_SKILL",
  "SR_NON_DETERMINISTIC_ORDER",
  "SR_INTERNAL",
]);

// ── Locked router-verdict union (exhaustive · 5) ────────────────────────

export type SkillRouterVerdict =
  | "clean"
  | "violations_present"
  | "no_applicable_skills"
  | "inconclusive"
  | "refused";

export const SKILL_ROUTER_VERDICTS: readonly SkillRouterVerdict[] = Object.freeze([
  "clean",
  "violations_present",
  "no_applicable_skills",
  "inconclusive",
  "refused",
]);

// ── Per-skill routing result (locked shape) ─────────────────────────────

export interface RouterPerSkillResult {
  readonly skill_slug: string;
  readonly skill_version: string;
  // Router-level applicability: true when the skill's change_kind list matched the candidate.
  readonly applicable: boolean;
  // Present only when applicable === true.
  readonly invocation_result: ApplyValidatorsResult | null;
}

// ── Router input request (locked shape) ─────────────────────────────────

export interface SkillRouterRequest {
  readonly candidate: SkillCandidate;
  readonly skill_library: readonly Skill[];
}

// ── Router output (locked shape) ────────────────────────────────────────

export interface SkillRouterSuccess {
  readonly kind: "SUCCESS";
  readonly router_verdict: Exclude<SkillRouterVerdict, "refused">;
  readonly per_skill_results: readonly RouterPerSkillResult[];
  readonly total_applicable_skills: number;
  readonly total_violations_across_library: number;
  readonly invocation_sha256: string;
  readonly router_grep_marker: "§36-E-4 · WAVE-E4 · 2026-09-14 · skill-router";
}

export interface SkillRouterFailure {
  readonly kind: "FAILURE";
  readonly router_verdict: "refused";
  readonly refusal_code: SkillRouterRefusalCode;
  readonly reason: string;
  readonly offending_slug: string | null;
  readonly router_grep_marker: "§36-E-4 · WAVE-E4 · 2026-09-14 · skill-router";
}

export type SkillRouterResult = SkillRouterSuccess | SkillRouterFailure;

// ── Locked router limits ────────────────────────────────────────────────

export const SR_MAX_SKILL_LIBRARY_SIZE = 64;

// ── Re-export types for consumers ───────────────────────────────────────

export type {
  ApplyValidatorsResult,
  ApplyValidatorsSuccess,
  Skill,
  SkillCandidate,
};
