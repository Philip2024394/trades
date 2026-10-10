// §36-E-3B · WAVE-E3B · 2026-09-14 · first-real-skills
// NEX bounded infrastructure · skill definition · nex-agent-runtime-boundary · 2026-09-14
// Provenance recorded on the exported skill object as bounded NEX infrastructure. NOT NEX1-authored capability.
//
// Skill: nex-agent-runtime-boundary
// Domain: NEX runtime · governance boundary
//
// Purpose: enforce the NEX1 runtime authoring conventions that have been
// established across every §36-X wave: grep-marker discipline, zero-I/O
// boundary, refusal-first design, no arbitrary code execution.
//
// This is INVOCABLE knowledge · every invariant references a locked predicate.

import { createHash } from "node:crypto";
import type { Skill } from "../skill-schema-types";

const AUTHORING_EVIDENCE = createHash("sha256")
  .update("§36-E-3B · WAVE-E3B · 2026-09-14 · nex-agent-runtime-boundary", "utf8")
  .digest("hex");

export const NEX_AGENT_RUNTIME_BOUNDARY_SKILL: Skill = {
  identity: {
    slug: "nex-agent-runtime-boundary",
    version: "1.0.0",
    display_name: "NEX Agent Runtime Boundary Discipline",
    domain: "nex-agent-runtime",
  },
  applicability: {
    applicable_languages: ["typescript"],
    applicable_frameworks: [],
    applicable_change_kinds: ["file_new", "file_content"],
  },
  validators: [
    {
      validator_id: "grep_marker_required",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "§36-[A-Z0-9\\-]+ · [A-Z]+-[A-Z0-9\\-]+ · \\d{4}-\\d{2}-\\d{2}",
      },
      kind: "invariant",
      rationale: "Every runtime file must carry a §36 grep marker for governance traceability",
    },
    {
      validator_id: "no_fs_write_operations",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "\\bfs\\.(writeFile|writeFileSync|mkdirSync|unlink|rmdir|rmSync|appendFile|copyFile|rename|chmod|chown)\\b",
      },
      kind: "anti_pattern",
      rationale: "Runtime primitives are zero-I/O · writes route through workstation-integration",
    },
    {
      validator_id: "no_subprocess_spawn",
      predicate_id: "text_does_not_contain_substring",
      predicate_args: {
        kind: "text_does_not_contain_substring",
        substring: "child_process",
      },
      kind: "anti_pattern",
      rationale: "Runtime primitives never spawn subprocesses",
    },
    {
      validator_id: "no_dynamic_code_execution",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "\\beval\\(|new Function\\(|Function\\(",
      },
      kind: "anti_pattern",
      rationale: "Runtime primitives never execute arbitrary code",
    },
    {
      validator_id: "no_network_access",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "\\b(fetch\\(|http\\.|https\\.|dns\\.|WebSocket\\b)",
      },
      kind: "anti_pattern",
      rationale: "Runtime primitives have zero network access",
    },
    {
      validator_id: "must_touch_runtime_module",
      predicate_id: "candidate_touches_module",
      predicate_args: {
        kind: "candidate_touches_module",
        module_prefix: "src/lib/nex-agent-runtime/",
      },
      kind: "precondition",
      rationale: "Skill only applies to files under the NEX agent runtime tree",
    },
    {
      validator_id: "candidate_must_be_authorised",
      predicate_id: "candidate_authorised",
      predicate_args: { kind: "candidate_authorised" },
      kind: "evidence_requirement",
      rationale: "All runtime modifications require founder authorisation via §36 amendment",
    },
  ],
  procedures: [
    {
      step_id: "verify-marker",
      step_kind: "verify",
      description: "Confirm the grep marker is present before authoring",
      required_predicate_verdicts: [
        { validator_id: "grep_marker_required", required_verdict: "satisfied" },
      ],
    },
    {
      step_id: "verify-no-writes",
      step_kind: "verify",
      description: "Confirm no filesystem write operations are introduced",
      required_predicate_verdicts: [
        { validator_id: "no_fs_write_operations", required_verdict: "satisfied" },
      ],
    },
    {
      step_id: "verify-authority",
      step_kind: "verify",
      description: "Confirm founder authorisation is on record",
      required_predicate_verdicts: [
        { validator_id: "candidate_must_be_authorised", required_verdict: "satisfied" },
      ],
    },
  ],
  known_anti_patterns: [],
  evidence_requirements: [],
  provenance: {
    authored_by: "MAI_infrastructure",
    authored_at: "2026-09-14T22:30:00.000Z",
    authoring_evidence_sha256: AUTHORING_EVIDENCE,
    promotion_state: "PROMOTED",
  },
};
