// §36-E-4 · WAVE-E4 · 2026-09-14 · skill-router
// NEX bounded infrastructure · skill-router primitive · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O · fully synchronous.
//
// Composes E3a's applySkillValidatorsToCandidate with E3b's skill library.
// Takes a candidate change + a library of skills, runs each applicable
// skill's validators, and emits per-skill results + an overall router
// verdict. Zero fs / subprocess / network / LLM.

import { createHash } from "node:crypto";

import {
  applySkillValidatorsToCandidate,
  validateSkillDefinition,
} from "./skill-schema";
import type {
  ApplyValidatorsResult,
  ApplyValidatorsSuccess,
  Skill,
} from "./skill-schema-types";
import type {
  RouterPerSkillResult,
  SkillRouterFailure,
  SkillRouterRequest,
  SkillRouterResult,
  SkillRouterSuccess,
  SkillRouterVerdict,
} from "./skill-router-types";
import { SR_MAX_SKILL_LIBRARY_SIZE } from "./skill-router-types";

const GREP_MARKER = "§36-E-4 · WAVE-E4 · 2026-09-14 · skill-router" as const;

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  code: SkillRouterFailure["refusal_code"],
  reason: string,
  offending_slug: string | null = null,
): SkillRouterFailure {
  return {
    kind: "FAILURE",
    router_verdict: "refused",
    refusal_code: code,
    reason,
    offending_slug,
    router_grep_marker: GREP_MARKER,
  };
}

// ── SHA-256 helper (deterministic) ──────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ── Applicability check (router-level · matches E3a's isApplicable) ─────

function isApplicableAtRouter(skill: Skill, candidateChangeKind: string): boolean {
  return skill.applicability.applicable_change_kinds.includes(candidateChangeKind as never);
}

// ── Canonical serialisation for invocation_sha256 ───────────────────────

function canonicalInputRepresentation(
  request: SkillRouterRequest,
  library_slugs_in_order: readonly string[],
): string {
  const c = request.candidate;
  const canonicalCandidate = {
    workspace_relative_path: c.workspace_relative_path,
    change_kind: c.change_kind,
    current_sha256_hex: c.current_sha256_hex,
    proposed_content_sha256_hex: c.proposed_content_sha256_hex,
    declared_symbols: [...c.declared_symbols].sort(),
    imported_symbols: [...c.imported_symbols].sort(),
    imported_from_specifiers: [...c.imported_from_specifiers].sort(),
    authorised: c.authorised,
    test_count_declared: c.test_count_declared,
  };
  return JSON.stringify({
    grep_marker: GREP_MARKER,
    candidate: canonicalCandidate,
    library_slugs: library_slugs_in_order,
  });
}

// ── Router entry point ─────────────────────────────────────────────────

export function routeSkillsAgainstCandidate(request: SkillRouterRequest): SkillRouterResult {
  if (!request || typeof request !== "object") {
    return fail("SR_INVALID_REQUEST", "request required");
  }
  if (!request.candidate || typeof request.candidate !== "object") {
    return fail("SR_INVALID_CANDIDATE", "request.candidate required");
  }
  if (!Array.isArray(request.skill_library)) {
    return fail("SR_INVALID_REQUEST", "request.skill_library must be an array");
  }
  if (request.skill_library.length === 0) {
    return fail("SR_EMPTY_LIBRARY", "skill_library must contain at least one skill");
  }
  if (request.skill_library.length > SR_MAX_SKILL_LIBRARY_SIZE) {
    return fail(
      "SR_SKILL_LIBRARY_TOO_LARGE",
      `skill_library.length ${request.skill_library.length} exceeds hard cap ${SR_MAX_SKILL_LIBRARY_SIZE}`,
    );
  }

  // Validate every skill in the library up-front.
  for (const skill of request.skill_library) {
    const defCheck = validateSkillDefinition({ skill });
    if (!defCheck.ok) {
      return fail(
        "SR_MALFORMED_SKILL",
        `skill definition failed validation: ${defCheck.refusal_code} · ${defCheck.reason}`,
        skill?.identity?.slug ?? null,
      );
    }
  }

  // Duplicate-slug check.
  const seenSlugs = new Set<string>();
  for (const skill of request.skill_library) {
    if (seenSlugs.has(skill.identity.slug)) {
      return fail(
        "SR_DUPLICATE_SKILL_SLUGS",
        `duplicate slug '${skill.identity.slug}' in library`,
        skill.identity.slug,
      );
    }
    seenSlugs.add(skill.identity.slug);
  }

  // Deterministic-order check: library MUST be sorted by identity.slug ascending.
  for (let i = 1; i < request.skill_library.length; i++) {
    const prev = request.skill_library[i - 1].identity.slug;
    const curr = request.skill_library[i].identity.slug;
    if (prev.localeCompare(curr) > 0) {
      return fail(
        "SR_NON_DETERMINISTIC_ORDER",
        `skill_library not sorted by identity.slug ascending: '${prev}' preceded '${curr}'`,
        curr,
      );
    }
  }

  const library_slugs: string[] = request.skill_library.map((s) => s.identity.slug);
  const canonicalInput = canonicalInputRepresentation(request, library_slugs);
  const invocation_sha256 = sha256Hex(canonicalInput);

  const per_skill_results: RouterPerSkillResult[] = [];
  let total_applicable = 0;
  let total_violations = 0;

  for (const skill of request.skill_library) {
    const applicable = isApplicableAtRouter(skill, request.candidate.change_kind);
    if (!applicable) {
      per_skill_results.push({
        skill_slug: skill.identity.slug,
        skill_version: skill.identity.version,
        applicable: false,
        invocation_result: null,
      });
      continue;
    }
    total_applicable++;
    const invocation: ApplyValidatorsResult = applySkillValidatorsToCandidate({
      skill,
      candidate: request.candidate,
    });
    if (invocation.ok) {
      total_violations += (invocation as ApplyValidatorsSuccess).violated_count;
    }
    per_skill_results.push({
      skill_slug: skill.identity.slug,
      skill_version: skill.identity.version,
      applicable: true,
      invocation_result: invocation,
    });
  }

  const router_verdict = deriveRouterVerdict(per_skill_results, total_applicable, total_violations);

  const success: SkillRouterSuccess = {
    kind: "SUCCESS",
    router_verdict,
    per_skill_results: Object.freeze(per_skill_results),
    total_applicable_skills: total_applicable,
    total_violations_across_library: total_violations,
    invocation_sha256,
    router_grep_marker: GREP_MARKER,
  };
  return success;
}

// ── Locked derivation rule ─────────────────────────────────────────────

function deriveRouterVerdict(
  per_skill_results: readonly RouterPerSkillResult[],
  total_applicable: number,
  total_violations: number,
): Exclude<SkillRouterVerdict, "refused"> {
  if (total_applicable === 0) return "no_applicable_skills";
  if (total_violations > 0) return "violations_present";
  // At least one applicable skill and no violations. Check whether every applicable skill returned all_satisfied.
  let all_satisfied_present = false;
  let non_all_satisfied_present = false;
  for (const r of per_skill_results) {
    if (!r.applicable) continue;
    const inv = r.invocation_result;
    if (!inv || !inv.ok) {
      non_all_satisfied_present = true;
      continue;
    }
    if (inv.overall_verdict === "all_satisfied") all_satisfied_present = true;
    else non_all_satisfied_present = true;
  }
  if (all_satisfied_present && !non_all_satisfied_present) return "clean";
  return "inconclusive";
}
