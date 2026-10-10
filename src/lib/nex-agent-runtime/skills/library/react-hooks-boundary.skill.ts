// §36-E-3B · WAVE-E3B · 2026-09-14 · first-real-skills
// NEX bounded infrastructure · skill definition · react-hooks-boundary · 2026-09-14
// Provenance recorded on the exported skill object as bounded NEX infrastructure. NOT NEX1-authored capability.
//
// Skill: react-hooks-boundary
// Domain: framework (react)

import { createHash } from "node:crypto";
import type { Skill } from "../skill-schema-types";

const AUTHORING_EVIDENCE = createHash("sha256")
  .update("§36-E-3B · WAVE-E3B · 2026-09-14 · react-hooks-boundary", "utf8")
  .digest("hex");

export const REACT_HOOKS_BOUNDARY_SKILL: Skill = {
  identity: {
    slug: "react-hooks-boundary",
    version: "1.0.0",
    display_name: "React · Hooks Boundary Discipline",
    domain: "framework",
  },
  applicability: {
    applicable_languages: ["typescript", "tsx"],
    applicable_frameworks: ["react", "nextjs"],
    applicable_change_kinds: ["file_new", "file_content"],
  },
  validators: [
    {
      validator_id: "must_be_tsx_or_jsx",
      predicate_id: "path_matches_regex",
      predicate_args: {
        kind: "path_matches_regex",
        regex: "\\.(tsx|jsx)$",
      },
      kind: "precondition",
      rationale: "React component conventions apply to JSX/TSX files",
    },
    {
      validator_id: "no_hooks_conditionally_after_return",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "return[\\s\\S]{0,100}\\n[\\s]*(?:const|let)\\s+\\[?\\w+\\]?\\s*=\\s*use(State|Effect|Memo|Callback|Reducer|Ref|Context)\\b",
      },
      kind: "anti_pattern",
      rationale: "Hooks must be called unconditionally at the top of a component · never after an early return",
    },
    {
      validator_id: "no_hooks_inside_conditional",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "if\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,200}use(State|Effect|Memo|Callback|Reducer)\\(",
      },
      kind: "anti_pattern",
      rationale: "Hooks must not be called inside conditional branches",
    },
    {
      validator_id: "no_hooks_inside_loop",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "\\.map\\([^)]*=>\\s*\\{[\\s\\S]{0,200}use(State|Effect|Memo|Callback|Reducer)\\(",
      },
      kind: "anti_pattern",
      rationale: "Hooks must not be called inside .map() or other loops",
    },
    {
      validator_id: "server_component_no_use_state",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "^(?!\"use client\")[\\s\\S]*useState\\(",
      },
      kind: "anti_pattern",
      rationale: "Server components (no 'use client' directive) must not use React state hooks",
    },
    {
      validator_id: "no_direct_dom_manipulation",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "document\\.(getElementById|querySelector|createElement|body\\.appendChild)",
      },
      kind: "anti_pattern",
      rationale: "React components use refs · not direct DOM manipulation",
    },
  ],
  procedures: [
    {
      step_id: "verify-hooks-shape",
      step_kind: "verify",
      description: "Ensure hooks discipline (rules of hooks)",
      required_predicate_verdicts: [
        { validator_id: "no_hooks_conditionally_after_return", required_verdict: "satisfied" },
        { validator_id: "no_hooks_inside_conditional", required_verdict: "satisfied" },
        { validator_id: "no_hooks_inside_loop", required_verdict: "satisfied" },
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
