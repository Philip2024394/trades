// §36-E-3A · WAVE-E3A · 2026-09-14 · skill-data-model
// NEX bounded infrastructure · skill-schema validator + invocation primitive · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O · fully synchronous.
//
// Two entry points:
//   validateSkillDefinition(skill)             → categorical well-formedness
//   applySkillValidatorsToCandidate(request)   → categorical per-validator verdicts
//
// The load-bearing design: skills reference LOCKED PREDICATES by id, not
// arbitrary functions. This makes skills genuine engineering knowledge NEX1
// can invoke deterministically without violating any I/O boundary.

import { createHash } from "node:crypto";
import {
  APPROVED_PREDICATES,
  SS_MAX_PROCEDURES_PER_SKILL,
  SS_MAX_STRING_LENGTH,
  SS_MAX_VALIDATORS_PER_SKILL,
  SS_PROHIBITED_SUBSTRINGS,
  type ApplyValidatorsRequest,
  type ApplyValidatorsResult,
  type ApplyValidatorsSuccess,
  type LockedPredicateId,
  type PredicateArgs,
  type Skill,
  type SkillCandidate,
  type SkillSchemaFailure,
  type SkillSchemaRefusalCode,
  type SkillValidatorRef,
  type ValidateSkillRequest,
  type ValidateSkillResult,
  type ValidateSkillSuccess,
  type ValidatorInvocationResult,
  type ValidatorVerdict,
} from "./skill-schema-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: SkillSchemaRefusalCode,
  reason: string,
  offendingField?: string,
): SkillSchemaFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(s: string): boolean {
  for (const bad of SS_PROHIBITED_SUBSTRINGS) if (s.includes(bad)) return true;
  return false;
}

function isNonEmptyString(v: unknown, maxLen: number = SS_MAX_STRING_LENGTH): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen;
}

/** Compile a glob to a regex. Supports `*` (matches any except `/`) and `**` (any including `/`).
 *  Deterministic, bounded, no arbitrary regex evaluation. */
function globToRegex(glob: string): RegExp | null {
  if (typeof glob !== "string" || glob.length === 0 || glob.length > 256) return null;
  // NOTE: prohibited-substring check is deliberately NOT applied here.
  // Glob patterns may need to reference bad-substring names (e.g. a glob
  // catching files whose paths include "eval" would need to say so).
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else if ("^$.+()[]{}|\\".includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  re += "$";
  try {
    return new RegExp(re);
  } catch {
    return null;
  }
}

/** Try to compile a caller-supplied regex string with bounded flags. Refuses on any
 *  syntax error or excessive length. */
function compileRegex(pattern: string): RegExp | null {
  if (typeof pattern !== "string" || pattern.length === 0 || pattern.length > 512) return null;
  // NOTE: prohibited-substring check is deliberately NOT applied here.
  // Regex patterns for anti-pattern detection MUST reference the strings
  // they detect (e.g., an anti-pattern for eval() usage must contain "eval").
  // The regex is only used as a read-only test predicate against candidate
  // content · never eval'd · never executed as code.
  try {
    // Only allow no-flags · no `g` (stateful) · no `y` · caller-facing determinism.
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

// ── Skill definition validation ────────────────────────────────────────

function validateValidatorRef(ref: SkillValidatorRef): SkillSchemaFailure | null {
  if (!ref || typeof ref !== "object") return fail("SS_INVALID_SKILL", "validator ref must be object");
  if (!isNonEmptyString(ref.validator_id)) return fail("SS_INVALID_SKILL", `validator_id invalid`);
  if (!/^[a-z0-9_\-]+$/i.test(ref.validator_id)) return fail("SS_INVALID_SKILL", `validator_id must be alphanumeric+underscore+hyphen`);
  if (containsProhibited(ref.validator_id)) return fail("SS_PROHIBITED_STRING_CONTENT", "validator_id contains prohibited");
  if (!APPROVED_PREDICATES.includes(ref.predicate_id)) {
    return fail("SS_UNKNOWN_PREDICATE", `predicate_id '${String(ref.predicate_id)}' not in locked catalogue`);
  }
  if (!ref.predicate_args || typeof ref.predicate_args !== "object") {
    return fail("SS_INVALID_PREDICATE_ARGS", `predicate_args missing`);
  }
  if (ref.predicate_args.kind !== ref.predicate_id) {
    return fail("SS_INVALID_PREDICATE_ARGS", `predicate_args.kind '${ref.predicate_args.kind}' does not match predicate_id '${ref.predicate_id}'`);
  }
  const kindsOk = ref.kind === "invariant" || ref.kind === "anti_pattern" || ref.kind === "evidence_requirement" || ref.kind === "precondition";
  if (!kindsOk) return fail("SS_INVALID_SKILL", `validator ref kind invalid`);
  if (!isNonEmptyString(ref.rationale)) return fail("SS_INVALID_SKILL", "rationale required");
  if (containsProhibited(ref.rationale)) return fail("SS_PROHIBITED_STRING_CONTENT", "rationale contains prohibited");
  // Args-shape validation per predicate
  const args = ref.predicate_args;
  switch (args.kind) {
    case "path_matches_glob":
      if (!isNonEmptyString(args.glob, 256) || globToRegex(args.glob) === null) return fail("SS_INVALID_PREDICATE_ARGS", `glob invalid: ${args.glob}`);
      break;
    case "path_matches_regex":
    case "text_matches_regex":
    case "text_does_not_match_regex":
      if (compileRegex(args.regex) === null) return fail("SS_INVALID_PREDICATE_ARGS", `regex invalid`);
      break;
    case "file_declares_symbol":
    case "file_imports_symbol":
      if (!isNonEmptyString(args.symbol_name) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(args.symbol_name)) return fail("SS_INVALID_PREDICATE_ARGS", `symbol_name invalid`);
      break;
    case "file_imports_from_specifier":
      if (!isNonEmptyString(args.specifier)) return fail("SS_INVALID_PREDICATE_ARGS", `specifier invalid`);
      if (containsProhibited(args.specifier)) return fail("SS_PROHIBITED_STRING_CONTENT", `specifier prohibited`);
      break;
    case "text_contains_substring":
    case "text_does_not_contain_substring":
      if (!isNonEmptyString(args.substring)) return fail("SS_INVALID_PREDICATE_ARGS", `substring invalid`);
      // NOTE: We do NOT reject prohibited substrings HERE · a validator might explicitly want to catch them.
      // We do bound length.
      if (args.substring.length > 256) return fail("SS_INVALID_PREDICATE_ARGS", `substring too long`);
      break;
    case "sha256_equals_declared":
      if (!isNonEmptyString(args.expected_sha256_hex) || !/^[0-9a-f]{64}$/.test(args.expected_sha256_hex)) return fail("SS_INVALID_PREDICATE_ARGS", `expected_sha256_hex invalid`);
      break;
    case "candidate_change_kind_is": {
      const kinds: readonly string[] = ["file_new", "file_content", "file_delete", "test_only"];
      if (!kinds.includes(args.change_kind)) return fail("SS_INVALID_PREDICATE_ARGS", `change_kind invalid`);
      break;
    }
    case "candidate_touches_module":
      if (!isNonEmptyString(args.module_prefix)) return fail("SS_INVALID_PREDICATE_ARGS", `module_prefix invalid`);
      if (args.module_prefix.includes("..") || containsProhibited(args.module_prefix)) return fail("SS_INVALID_PREDICATE_ARGS", `module_prefix contains prohibited`);
      break;
    case "test_count_at_least":
      if (typeof args.minimum !== "number" || !Number.isFinite(args.minimum) || args.minimum < 0 || args.minimum > 10000) return fail("SS_INVALID_PREDICATE_ARGS", `minimum out of range`);
      break;
    case "candidate_authorised":
    case "no_operation":
      break;
    default: {
      const _exhaustive: never = args;
      void _exhaustive;
      return fail("SS_INVALID_PREDICATE_ARGS", `unknown predicate args kind`);
    }
  }
  return null;
}

export function validateSkillDefinition(request: ValidateSkillRequest): ValidateSkillResult {
  if (!request || typeof request !== "object") return fail("SS_INVALID_REQUEST", "request required");
  const skill = request.skill;
  if (!skill || typeof skill !== "object") return fail("SS_INVALID_SKILL", "skill required");
  // Identity
  if (!skill.identity || typeof skill.identity !== "object") return fail("SS_INVALID_SKILL", "skill.identity required");
  if (!isNonEmptyString(skill.identity.slug, 128) || !/^[a-z0-9\-]+$/.test(skill.identity.slug)) return fail("SS_INVALID_SKILL", "skill.identity.slug must be kebab-case");
  if (!/^\d+\.\d+\.\d+$/.test(skill.identity.version)) return fail("SS_INVALID_SKILL", "skill.identity.version must be semver");
  if (!isNonEmptyString(skill.identity.display_name)) return fail("SS_INVALID_SKILL", "display_name required");
  if (containsProhibited(skill.identity.display_name)) return fail("SS_PROHIBITED_STRING_CONTENT", "display_name prohibited content");
  const domains: readonly string[] = ["language", "framework", "runtime", "database", "security", "testing", "architecture", "nex-agent-runtime"];
  if (!domains.includes(skill.identity.domain)) return fail("SS_INVALID_SKILL", `domain '${skill.identity.domain}' unknown`);

  // Applicability
  if (!skill.applicability || typeof skill.applicability !== "object") return fail("SS_INVALID_SKILL", "applicability required");
  if (!Array.isArray(skill.applicability.applicable_languages)) return fail("SS_INVALID_SKILL", "applicable_languages must be array");
  if (!Array.isArray(skill.applicability.applicable_frameworks)) return fail("SS_INVALID_SKILL", "applicable_frameworks must be array");
  if (!Array.isArray(skill.applicability.applicable_change_kinds)) return fail("SS_INVALID_SKILL", "applicable_change_kinds must be array");

  // Validators
  if (!Array.isArray(skill.validators)) return fail("SS_INVALID_SKILL", "validators must be array");
  if (skill.validators.length > SS_MAX_VALIDATORS_PER_SKILL) return fail("SS_INVALID_SKILL", `> ${SS_MAX_VALIDATORS_PER_SKILL} validators`);
  const seenValidatorIds = new Set<string>();
  for (const ref of skill.validators) {
    const check = validateValidatorRef(ref);
    if (check) return check;
    if (seenValidatorIds.has(ref.validator_id)) return fail("SS_INVALID_SKILL", `duplicate validator_id ${ref.validator_id}`);
    seenValidatorIds.add(ref.validator_id);
  }

  // Procedures
  if (!Array.isArray(skill.procedures)) return fail("SS_INVALID_SKILL", "procedures must be array");
  if (skill.procedures.length > SS_MAX_PROCEDURES_PER_SKILL) return fail("SS_INVALID_SKILL", `> ${SS_MAX_PROCEDURES_PER_SKILL} procedures`);
  const seenStepIds = new Set<string>();
  for (const proc of skill.procedures) {
    if (!isNonEmptyString(proc.step_id) || !/^[a-z0-9_\-]+$/.test(proc.step_id)) return fail("SS_INVALID_SKILL", "procedure step_id invalid");
    if (seenStepIds.has(proc.step_id)) return fail("SS_INVALID_SKILL", `duplicate step_id ${proc.step_id}`);
    seenStepIds.add(proc.step_id);
    const stepKinds: readonly string[] = ["read", "analyse", "declare", "verify", "record"];
    if (!stepKinds.includes(proc.step_kind)) return fail("SS_INVALID_SKILL", `step_kind invalid`);
    if (!isNonEmptyString(proc.description)) return fail("SS_INVALID_SKILL", "procedure description required");
    if (containsProhibited(proc.description)) return fail("SS_PROHIBITED_STRING_CONTENT", "procedure description prohibited");
    for (const rp of proc.required_predicate_verdicts) {
      if (!seenValidatorIds.has(rp.validator_id)) return fail("SS_INVALID_SKILL", `procedure references unknown validator_id ${rp.validator_id}`);
      const verdicts: readonly ValidatorVerdict[] = ["satisfied", "violated", "not_applicable", "inconclusive"];
      if (!verdicts.includes(rp.required_verdict)) return fail("SS_INVALID_SKILL", "required_verdict invalid");
    }
  }

  // Provenance
  if (!skill.provenance || typeof skill.provenance !== "object") return fail("SS_INVALID_SKILL", "provenance required");
  const authoredBys: readonly string[] = ["NEX1_via_typed_data_contract", "MAI_infrastructure"];
  if (!authoredBys.includes(skill.provenance.authored_by)) return fail("SS_INVALID_SKILL", "authored_by invalid");
  if (!isNonEmptyString(skill.provenance.authored_at)) return fail("SS_INVALID_SKILL", "authored_at required");
  if (!/^[0-9a-f]{64}$/.test(skill.provenance.authoring_evidence_sha256)) return fail("SS_INVALID_SKILL", "authoring_evidence_sha256 invalid");
  const promotionStates: readonly string[] = ["PROMOTED", "PENDING", "SUPERSEDED", "NEEDS_REVIEW"];
  if (!promotionStates.includes(skill.provenance.promotion_state)) return fail("SS_INVALID_SKILL", "promotion_state invalid");

  const definitionSha = sha256Hex(JSON.stringify({
    identity: skill.identity, applicability: skill.applicability,
    validators: skill.validators, procedures: skill.procedures,
    provenance: skill.provenance,
  }));

  return {
    ok: true,
    skill_slug: skill.identity.slug,
    skill_version: skill.identity.version,
    validator_count: skill.validators.length,
    procedure_count: skill.procedures.length,
    definition_sha256: definitionSha,
  };
}

// ── Candidate validation ───────────────────────────────────────────────

function validateCandidate(c: SkillCandidate): SkillSchemaFailure | null {
  if (!c || typeof c !== "object") return fail("SS_INVALID_CANDIDATE", "candidate required");
  if (!isNonEmptyString(c.workspace_relative_path)) return fail("SS_INVALID_CANDIDATE", "workspace_relative_path required");
  if (containsProhibited(c.workspace_relative_path)) return fail("SS_INVALID_CANDIDATE", "workspace_relative_path prohibited");
  if (c.workspace_relative_path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(c.workspace_relative_path)) return fail("SS_INVALID_CANDIDATE", "workspace_relative_path must be relative");
  const kinds: readonly string[] = ["file_new", "file_content", "file_delete", "test_only"];
  if (!kinds.includes(c.change_kind)) return fail("SS_INVALID_CANDIDATE", "change_kind invalid");
  if (c.current_sha256_hex !== null && (typeof c.current_sha256_hex !== "string" || !/^[0-9a-f]{64}$/.test(c.current_sha256_hex))) return fail("SS_INVALID_CANDIDATE", "current_sha256_hex invalid");
  if (c.proposed_content_sha256_hex !== null && (typeof c.proposed_content_sha256_hex !== "string" || !/^[0-9a-f]{64}$/.test(c.proposed_content_sha256_hex))) return fail("SS_INVALID_CANDIDATE", "proposed_content_sha256_hex invalid");
  if (!Array.isArray(c.declared_symbols)) return fail("SS_INVALID_CANDIDATE", "declared_symbols must be array");
  if (!Array.isArray(c.imported_symbols)) return fail("SS_INVALID_CANDIDATE", "imported_symbols must be array");
  if (!Array.isArray(c.imported_from_specifiers)) return fail("SS_INVALID_CANDIDATE", "imported_from_specifiers must be array");
  if (typeof c.authorised !== "boolean") return fail("SS_INVALID_CANDIDATE", "authorised must be boolean");
  return null;
}

// ── Predicate evaluators (all deterministic · zero I/O) ────────────────

function evaluatePredicate(
  predicate_id: LockedPredicateId,
  args: PredicateArgs,
  candidate: SkillCandidate,
): { verdict: ValidatorVerdict; evidence: string } {
  switch (args.kind) {
    case "path_matches_glob": {
      const re = globToRegex(args.glob);
      if (!re) return { verdict: "inconclusive", evidence: `invalid glob '${args.glob}'` };
      const m = re.test(candidate.workspace_relative_path);
      return { verdict: m ? "satisfied" : "violated", evidence: `path '${candidate.workspace_relative_path}' ${m ? "matches" : "does not match"} '${args.glob}'` };
    }
    case "path_matches_regex": {
      const re = compileRegex(args.regex);
      if (!re) return { verdict: "inconclusive", evidence: `invalid regex` };
      const m = re.test(candidate.workspace_relative_path);
      return { verdict: m ? "satisfied" : "violated", evidence: `path ${m ? "matches" : "does not match"} regex` };
    }
    case "file_declares_symbol": {
      const has = candidate.declared_symbols.includes(args.symbol_name);
      return { verdict: has ? "satisfied" : "violated", evidence: `symbol '${args.symbol_name}' ${has ? "declared" : "not declared"}` };
    }
    case "file_imports_symbol": {
      const has = candidate.imported_symbols.includes(args.symbol_name);
      return { verdict: has ? "satisfied" : "violated", evidence: `symbol '${args.symbol_name}' ${has ? "imported" : "not imported"}` };
    }
    case "file_imports_from_specifier": {
      const has = candidate.imported_from_specifiers.includes(args.specifier);
      return { verdict: has ? "satisfied" : "violated", evidence: `specifier '${args.specifier}' ${has ? "present" : "absent"}` };
    }
    case "text_contains_substring": {
      if (candidate.proposed_content === null) return { verdict: "not_applicable", evidence: `no proposed_content` };
      const has = candidate.proposed_content.includes(args.substring);
      return { verdict: has ? "satisfied" : "violated", evidence: `substring '${args.substring.slice(0, 40)}' ${has ? "present" : "absent"}` };
    }
    case "text_matches_regex": {
      if (candidate.proposed_content === null) return { verdict: "not_applicable", evidence: `no proposed_content` };
      const re = compileRegex(args.regex);
      if (!re) return { verdict: "inconclusive", evidence: `invalid regex` };
      const m = re.test(candidate.proposed_content);
      return { verdict: m ? "satisfied" : "violated", evidence: `regex ${m ? "matches" : "does not match"} content` };
    }
    case "text_does_not_contain_substring": {
      if (candidate.proposed_content === null) return { verdict: "not_applicable", evidence: `no proposed_content` };
      const has = candidate.proposed_content.includes(args.substring);
      return { verdict: has ? "violated" : "satisfied", evidence: `substring '${args.substring.slice(0, 40)}' ${has ? "PRESENT (violates)" : "absent"}` };
    }
    case "text_does_not_match_regex": {
      if (candidate.proposed_content === null) return { verdict: "not_applicable", evidence: `no proposed_content` };
      const re = compileRegex(args.regex);
      if (!re) return { verdict: "inconclusive", evidence: `invalid regex` };
      const m = re.test(candidate.proposed_content);
      return { verdict: m ? "violated" : "satisfied", evidence: `regex ${m ? "MATCHES (violates)" : "does not match"}` };
    }
    case "sha256_equals_declared": {
      const actual = candidate.proposed_content_sha256_hex;
      if (actual === null) return { verdict: "not_applicable", evidence: `no proposed_content_sha256` };
      const m = actual === args.expected_sha256_hex;
      return { verdict: m ? "satisfied" : "violated", evidence: `sha ${m ? "equals" : "differs"} expected` };
    }
    case "candidate_change_kind_is": {
      const m = candidate.change_kind === args.change_kind;
      return { verdict: m ? "satisfied" : "violated", evidence: `change_kind is ${candidate.change_kind}, expected ${args.change_kind}` };
    }
    case "candidate_touches_module": {
      const m = candidate.workspace_relative_path.startsWith(args.module_prefix);
      return { verdict: m ? "satisfied" : "violated", evidence: `path ${m ? "under" : "outside"} module '${args.module_prefix}'` };
    }
    case "test_count_at_least": {
      if (candidate.test_count_declared === null) return { verdict: "not_applicable", evidence: `no declared test_count` };
      const ok = candidate.test_count_declared >= args.minimum;
      return { verdict: ok ? "satisfied" : "violated", evidence: `test_count=${candidate.test_count_declared} vs minimum=${args.minimum}` };
    }
    case "candidate_authorised":
      return { verdict: candidate.authorised ? "satisfied" : "violated", evidence: `authorised=${candidate.authorised}` };
    case "no_operation":
      return { verdict: "satisfied", evidence: `no_operation always satisfied` };
  }
  // Exhaustiveness · unreachable
  const _exhaustive: never = args;
  void _exhaustive;
  return { verdict: "inconclusive", evidence: "unreachable" };
}

// ── Applicability check ────────────────────────────────────────────────

function isApplicable(skill: Skill, candidate: SkillCandidate): boolean {
  if (!skill.applicability.applicable_change_kinds.includes(candidate.change_kind)) return false;
  return true;
}

// ── applySkillValidatorsToCandidate ────────────────────────────────────

export function applySkillValidatorsToCandidate(request: ApplyValidatorsRequest): ApplyValidatorsResult {
  if (!request || typeof request !== "object") return fail("SS_INVALID_REQUEST", "request required");
  const defCheck = validateSkillDefinition({ skill: request.skill });
  if (!defCheck.ok) return defCheck;
  const candCheck = validateCandidate(request.candidate);
  if (candCheck) return candCheck;

  const skill = request.skill;
  const candidate = request.candidate;
  const applicable = isApplicable(skill, candidate);

  const invocations: ValidatorInvocationResult[] = [];
  for (const ref of skill.validators) {
    if (!applicable) {
      invocations.push({
        validator_id: ref.validator_id,
        predicate_id: ref.predicate_id,
        kind: ref.kind,
        verdict: "not_applicable",
        evidence_summary: `skill applicability does not match candidate change_kind '${candidate.change_kind}'`,
      });
      continue;
    }
    const { verdict, evidence } = evaluatePredicate(ref.predicate_id, ref.predicate_args, candidate);
    invocations.push({
      validator_id: ref.validator_id,
      predicate_id: ref.predicate_id,
      kind: ref.kind,
      verdict,
      evidence_summary: evidence,
    });
  }

  const satisfied = invocations.filter((i) => i.verdict === "satisfied").length;
  const violated = invocations.filter((i) => i.verdict === "violated").length;
  const notApplicable = invocations.filter((i) => i.verdict === "not_applicable").length;
  const inconclusive = invocations.filter((i) => i.verdict === "inconclusive").length;

  const overall: ApplyValidatorsSuccess["overall_verdict"] =
    violated > 0 ? "any_violated"
    : (satisfied > 0 && notApplicable === 0) ? "all_satisfied"
    : (satisfied === 0 && notApplicable === invocations.length && invocations.length > 0) ? "no_applicable"
    : "mixed";

  const canonical = JSON.stringify({
    skill_slug: skill.identity.slug,
    skill_version: skill.identity.version,
    candidate_path: candidate.workspace_relative_path,
    invocations,
  });
  const invocationSha = sha256Hex(canonical);

  return {
    ok: true,
    skill_slug: skill.identity.slug,
    candidate_path: candidate.workspace_relative_path,
    invocations: Object.freeze(invocations),
    satisfied_count: satisfied,
    violated_count: violated,
    not_applicable_count: notApplicable,
    inconclusive_count: inconclusive,
    overall_verdict: overall,
    invocation_sha256: invocationSha,
  };
}

export type {
  ApplyValidatorsRequest,
  ApplyValidatorsResult,
  ApplyValidatorsSuccess,
  LockedPredicateId,
  PredicateArgs,
  Skill,
  SkillCandidate,
  SkillDomain,
  SkillIdentity,
  SkillProcedure,
  SkillProvenance,
  SkillSchemaFailure,
  SkillSchemaRefusalCode,
  SkillValidatorRef,
  ValidateSkillRequest,
  ValidateSkillResult,
  ValidateSkillSuccess,
  ValidatorInvocationResult,
  ValidatorVerdict,
} from "./skill-schema-types";
