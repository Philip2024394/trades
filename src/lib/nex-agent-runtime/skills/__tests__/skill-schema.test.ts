// §36-E-3A · WAVE-E3A · 2026-09-14 · skill-data-model
// NEX bounded infrastructure · skill-schema tests · 2026-09-14

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { applySkillValidatorsToCandidate, validateSkillDefinition } from "../skill-schema";
import type {
  ApplyValidatorsResult,
  ApplyValidatorsSuccess,
  Skill,
  SkillCandidate,
  SkillSchemaFailure,
  SkillValidatorRef,
  ValidateSkillResult,
  ValidateSkillSuccess,
} from "../skill-schema-types";

function asValidateOk(r: ValidateSkillResult): ValidateSkillSuccess {
  if (!r.ok) throw new Error(`expected success · got ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asValidateFail(r: ValidateSkillResult): SkillSchemaFailure {
  if (r.ok) throw new Error("expected failure · got success");
  return r;
}
function asApplyOk(r: ApplyValidatorsResult): ApplyValidatorsSuccess {
  if (!r.ok) throw new Error(`expected success · got ${r.refusal_code} · ${r.reason}`);
  return r;
}
function asApplyFail(r: ApplyValidatorsResult): SkillSchemaFailure {
  if (r.ok) throw new Error("expected failure · got success");
  return r;
}
function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ── Fixtures ──────────────────────────────────────────────────────────

function validator(overrides: Partial<SkillValidatorRef> & { validator_id: string; predicate_id: SkillValidatorRef["predicate_id"]; predicate_args: SkillValidatorRef["predicate_args"] }): SkillValidatorRef {
  return {
    validator_id: overrides.validator_id,
    predicate_id: overrides.predicate_id,
    predicate_args: overrides.predicate_args,
    kind: overrides.kind ?? "invariant",
    rationale: overrides.rationale ?? "test rationale",
  };
}

function baseSkill(overrides?: Partial<Skill>): Skill {
  return {
    identity: overrides?.identity ?? {
      slug: "test-skill",
      version: "1.0.0",
      display_name: "Test Skill",
      domain: "runtime",
    },
    applicability: overrides?.applicability ?? {
      applicable_languages: ["typescript"],
      applicable_frameworks: [],
      applicable_change_kinds: ["file_new", "file_content"],
    },
    validators: overrides?.validators ?? [
      validator({
        validator_id: "no_op_test",
        predicate_id: "no_operation",
        predicate_args: { kind: "no_operation" },
      }),
    ],
    procedures: overrides?.procedures ?? [],
    known_anti_patterns: overrides?.known_anti_patterns ?? [],
    evidence_requirements: overrides?.evidence_requirements ?? [],
    provenance: overrides?.provenance ?? {
      authored_by: "MAI_infrastructure",
      authored_at: "2026-09-14T12:00:00.000Z",
      authoring_evidence_sha256: "a".repeat(64),
      promotion_state: "PROMOTED",
    },
  };
}

function baseCandidate(overrides?: Partial<SkillCandidate>): SkillCandidate {
  return {
    workspace_relative_path: overrides?.workspace_relative_path ?? "src/lib/foo.ts",
    change_kind: overrides?.change_kind ?? "file_new",
    current_sha256_hex: overrides?.current_sha256_hex ?? null,
    proposed_content: overrides?.proposed_content ?? null,
    proposed_content_sha256_hex: overrides?.proposed_content_sha256_hex ?? null,
    declared_symbols: overrides?.declared_symbols ?? [],
    imported_symbols: overrides?.imported_symbols ?? [],
    imported_from_specifiers: overrides?.imported_from_specifiers ?? [],
    authorised: overrides?.authorised ?? true,
    test_count_declared: overrides?.test_count_declared ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════
// §A · Definition validation (10)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-3A · E3a · §A · definition validation", () => {
  it("A-1 · valid skill → success with definition_sha256", () => {
    const r = asValidateOk(validateSkillDefinition({ skill: baseSkill() }));
    expect(r.definition_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.validator_count).toBe(1);
  });
  it("A-2 · malformed slug → SS_INVALID_SKILL", () => {
    const r = asValidateFail(validateSkillDefinition({ skill: baseSkill({ identity: { ...baseSkill().identity, slug: "Not Kebab!" } }) }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
  it("A-3 · malformed version → SS_INVALID_SKILL", () => {
    const r = asValidateFail(validateSkillDefinition({ skill: baseSkill({ identity: { ...baseSkill().identity, version: "1.0" as `${number}.${number}.${number}` } }) }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
  it("A-4 · unknown domain → SS_INVALID_SKILL", () => {
    const r = asValidateFail(validateSkillDefinition({ skill: baseSkill({ identity: { ...baseSkill().identity, domain: "not-a-domain" as Skill["identity"]["domain"] } }) }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
  it("A-5 · unknown predicate_id → SS_UNKNOWN_PREDICATE", () => {
    const bad: Skill = baseSkill({
      validators: [validator({ validator_id: "v1", predicate_id: "not_a_predicate" as SkillValidatorRef["predicate_id"], predicate_args: { kind: "no_operation" } })],
    });
    const r = asValidateFail(validateSkillDefinition({ skill: bad }));
    expect(r.refusal_code).toBe("SS_UNKNOWN_PREDICATE");
  });
  it("A-6 · predicate_args.kind mismatches predicate_id → SS_INVALID_PREDICATE_ARGS", () => {
    const bad: Skill = baseSkill({
      validators: [validator({
        validator_id: "v1",
        predicate_id: "path_matches_glob",
        predicate_args: { kind: "text_contains_substring", substring: "x" },
      })],
    });
    const r = asValidateFail(validateSkillDefinition({ skill: bad }));
    expect(r.refusal_code).toBe("SS_INVALID_PREDICATE_ARGS");
  });
  it("A-7 · duplicate validator_id → SS_INVALID_SKILL", () => {
    const bad: Skill = baseSkill({
      validators: [
        validator({ validator_id: "dup", predicate_id: "no_operation", predicate_args: { kind: "no_operation" } }),
        validator({ validator_id: "dup", predicate_id: "no_operation", predicate_args: { kind: "no_operation" } }),
      ],
    });
    const r = asValidateFail(validateSkillDefinition({ skill: bad }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
  it("A-8 · > 32 validators → SS_INVALID_SKILL", () => {
    const many = Array.from({ length: 33 }, (_, i) => validator({
      validator_id: `v${i}`,
      predicate_id: "no_operation",
      predicate_args: { kind: "no_operation" },
    }));
    const r = asValidateFail(validateSkillDefinition({ skill: baseSkill({ validators: many }) }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
  it("A-9 · procedure references unknown validator_id → SS_INVALID_SKILL", () => {
    const bad: Skill = baseSkill({
      procedures: [{
        step_id: "s1",
        step_kind: "verify",
        description: "test",
        required_predicate_verdicts: [{ validator_id: "does_not_exist", required_verdict: "satisfied" }],
      }],
    });
    const r = asValidateFail(validateSkillDefinition({ skill: bad }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
  it("A-10 · invalid provenance sha → SS_INVALID_SKILL", () => {
    const bad: Skill = baseSkill({
      provenance: { ...baseSkill().provenance, authoring_evidence_sha256: "not-hex" },
    });
    const r = asValidateFail(validateSkillDefinition({ skill: bad }));
    expect(r.refusal_code).toBe("SS_INVALID_SKILL");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §B · Predicate evaluation (15 · 1 per predicate)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-3A · E3a · §B · predicate evaluation", () => {
  const applyOne = (v: SkillValidatorRef, c: SkillCandidate) => {
    const skill = baseSkill({ validators: [v] });
    const r = asApplyOk(applySkillValidatorsToCandidate({ skill, candidate: c }));
    return r.invocations[0];
  };

  it("B-1 · path_matches_glob · matches", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "path_matches_glob", predicate_args: { kind: "path_matches_glob", glob: "src/**/*.ts" } }),
      baseCandidate({ workspace_relative_path: "src/lib/foo/bar.ts" }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-2 · path_matches_regex · matches", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "path_matches_regex", predicate_args: { kind: "path_matches_regex", regex: "^src/.*\\.ts$" } }),
      baseCandidate({ workspace_relative_path: "src/lib/foo.ts" }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-3 · file_declares_symbol · present", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "file_declares_symbol", predicate_args: { kind: "file_declares_symbol", symbol_name: "FooType" } }),
      baseCandidate({ declared_symbols: ["FooType", "BarType"] }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-4 · file_imports_symbol · absent → violated", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "file_imports_symbol", predicate_args: { kind: "file_imports_symbol", symbol_name: "Missing" } }),
      baseCandidate({ imported_symbols: ["Other"] }),
    );
    expect(inv.verdict).toBe("violated");
  });
  it("B-5 · file_imports_from_specifier · present", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "file_imports_from_specifier", predicate_args: { kind: "file_imports_from_specifier", specifier: "./types" } }),
      baseCandidate({ imported_from_specifiers: ["./types"] }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-6 · text_contains_substring · not_applicable when proposed_content null", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "text_contains_substring", predicate_args: { kind: "text_contains_substring", substring: "foo" } }),
      baseCandidate({ proposed_content: null }),
    );
    expect(inv.verdict).toBe("not_applicable");
  });
  it("B-7 · text_matches_regex · matches", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "text_matches_regex", predicate_args: { kind: "text_matches_regex", regex: "^import" } }),
      baseCandidate({ proposed_content: "import x from './x';" }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-8 · text_does_not_contain_substring · violated when present", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "text_does_not_contain_substring", predicate_args: { kind: "text_does_not_contain_substring", substring: "TODO" }, kind: "anti_pattern" }),
      baseCandidate({ proposed_content: "// TODO: fix" }),
    );
    expect(inv.verdict).toBe("violated");
  });
  it("B-9 · text_does_not_match_regex · satisfied when absent", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "text_does_not_match_regex", predicate_args: { kind: "text_does_not_match_regex", regex: "console\\.log" }, kind: "anti_pattern" }),
      baseCandidate({ proposed_content: "const x = 1;" }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-10 · sha256_equals_declared · match", () => {
    const sha = sha256Hex("content");
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "sha256_equals_declared", predicate_args: { kind: "sha256_equals_declared", expected_sha256_hex: sha } }),
      baseCandidate({ proposed_content_sha256_hex: sha }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-11 · candidate_change_kind_is · match", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "candidate_change_kind_is", predicate_args: { kind: "candidate_change_kind_is", change_kind: "file_new" } }),
      baseCandidate({ change_kind: "file_new" }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-12 · candidate_touches_module · under prefix", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "candidate_touches_module", predicate_args: { kind: "candidate_touches_module", module_prefix: "src/lib/nex-agent-runtime/" } }),
      baseCandidate({ workspace_relative_path: "src/lib/nex-agent-runtime/skills/x.ts" }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-13 · test_count_at_least · meets", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "test_count_at_least", predicate_args: { kind: "test_count_at_least", minimum: 10 } }),
      baseCandidate({ test_count_declared: 15 }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-14 · candidate_authorised · true", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "candidate_authorised", predicate_args: { kind: "candidate_authorised" } }),
      baseCandidate({ authorised: true }),
    );
    expect(inv.verdict).toBe("satisfied");
  });
  it("B-15 · no_operation · always satisfied", () => {
    const inv = applyOne(
      validator({ validator_id: "v", predicate_id: "no_operation", predicate_args: { kind: "no_operation" } }),
      baseCandidate(),
    );
    expect(inv.verdict).toBe("satisfied");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §C · Overall verdict aggregation (4)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-3A · E3a · §C · overall verdict", () => {
  it("C-1 · all satisfied → all_satisfied", () => {
    const skill = baseSkill({
      validators: [
        validator({ validator_id: "v1", predicate_id: "no_operation", predicate_args: { kind: "no_operation" } }),
        validator({ validator_id: "v2", predicate_id: "candidate_authorised", predicate_args: { kind: "candidate_authorised" } }),
      ],
    });
    const r = asApplyOk(applySkillValidatorsToCandidate({ skill, candidate: baseCandidate({ authorised: true }) }));
    expect(r.overall_verdict).toBe("all_satisfied");
  });
  it("C-2 · any violated → any_violated", () => {
    const skill = baseSkill({
      validators: [
        validator({ validator_id: "v1", predicate_id: "no_operation", predicate_args: { kind: "no_operation" } }),
        validator({ validator_id: "v2", predicate_id: "candidate_authorised", predicate_args: { kind: "candidate_authorised" } }),
      ],
    });
    const r = asApplyOk(applySkillValidatorsToCandidate({ skill, candidate: baseCandidate({ authorised: false }) }));
    expect(r.overall_verdict).toBe("any_violated");
    expect(r.violated_count).toBe(1);
  });
  it("C-3 · skill inapplicable to change_kind → invocations all not_applicable", () => {
    const skill = baseSkill({
      applicability: { applicable_languages: ["typescript"], applicable_frameworks: [], applicable_change_kinds: ["file_new"] },
    });
    const r = asApplyOk(applySkillValidatorsToCandidate({ skill, candidate: baseCandidate({ change_kind: "file_delete" }) }));
    expect(r.overall_verdict).toBe("no_applicable");
  });
  it("C-4 · invocation_sha256 is deterministic and 64-hex", () => {
    const skill = baseSkill();
    const cand = baseCandidate();
    const a = asApplyOk(applySkillValidatorsToCandidate({ skill, candidate: cand }));
    const b = asApplyOk(applySkillValidatorsToCandidate({ skill, candidate: cand }));
    expect(a.invocation_sha256).toBe(b.invocation_sha256);
    expect(a.invocation_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// §D · Candidate validation refusals (5)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-3A · E3a · §D · candidate refusals", () => {
  it("D-1 · null request → SS_INVALID_REQUEST", () => {
    const r = asApplyFail(applySkillValidatorsToCandidate(null as unknown as { skill: Skill; candidate: SkillCandidate }));
    expect(r.refusal_code).toBe("SS_INVALID_REQUEST");
  });
  it("D-2 · candidate missing path → SS_INVALID_CANDIDATE", () => {
    const r = asApplyFail(applySkillValidatorsToCandidate({ skill: baseSkill(), candidate: baseCandidate({ workspace_relative_path: "" }) }));
    expect(r.refusal_code).toBe("SS_INVALID_CANDIDATE");
  });
  it("D-3 · absolute path → SS_INVALID_CANDIDATE", () => {
    const r = asApplyFail(applySkillValidatorsToCandidate({ skill: baseSkill(), candidate: baseCandidate({ workspace_relative_path: "/etc/x.ts" }) }));
    expect(r.refusal_code).toBe("SS_INVALID_CANDIDATE");
  });
  it("D-4 · malformed change_kind → SS_INVALID_CANDIDATE", () => {
    const r = asApplyFail(applySkillValidatorsToCandidate({ skill: baseSkill(), candidate: baseCandidate({ change_kind: "not_a_kind" as SkillCandidate["change_kind"] }) }));
    expect(r.refusal_code).toBe("SS_INVALID_CANDIDATE");
  });
  it("D-5 · malformed sha256 → SS_INVALID_CANDIDATE", () => {
    const r = asApplyFail(applySkillValidatorsToCandidate({ skill: baseSkill(), candidate: baseCandidate({ current_sha256_hex: "not-hex" }) }));
    expect(r.refusal_code).toBe("SS_INVALID_CANDIDATE");
  });
});

// ══════════════════════════════════════════════════════════════════════
// §E · Boundary preservation (6 static-grep)
// ══════════════════════════════════════════════════════════════════════

describe("§36-E-3A · E3a · §E · boundary preservation", () => {
  const primitivePath = path.resolve(__dirname, "..", "skill-schema.ts");
  const src = fs.readFileSync(primitivePath, "utf8");
  it("E-1 · no fs.*", () => {
    expect(src).not.toMatch(/\bfs\.(readFileSync|readdirSync|statSync|readFile|readdir|stat|open|write|mkdir|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("E-2 · no subprocess", () => {
    expect(src).not.toMatch(/\b(child_process|spawnSync|execSync|fork\()/);
    // exec allowed for regex-exec pattern; ensure it isn't process-exec
    expect(src).not.toMatch(/\bexec\(/);
  });
  it("E-3 · no network", () => {
    expect(src).not.toMatch(/\b(fetch\(|http\.|https\.|dns\.|net\.|WebSocket)/);
  });
  it("E-4 · no writes", () => {
    expect(src).not.toMatch(/\b(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)/);
  });
  it("E-5 · synchronous", () => {
    expect(src).not.toMatch(/\basync\s+function|\bawait\s+|\bPromise\./);
  });
  it("E-6 · no LLM", () => {
    expect(src.toLowerCase()).not.toMatch(/anthropic|openai|\bllm\b/);
  });
});
