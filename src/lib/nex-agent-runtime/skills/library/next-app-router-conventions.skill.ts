// §36-E-3B · WAVE-E3B · 2026-09-14 · first-real-skills
// NEX bounded infrastructure · skill definition · next-app-router-conventions · 2026-09-14
// Provenance recorded on the exported skill object as bounded NEX infrastructure. NOT NEX1-authored capability.
//
// Skill: next-app-router-conventions
// Domain: framework (nextjs · app-router)

import { createHash } from "node:crypto";
import type { Skill } from "../skill-schema-types";

const AUTHORING_EVIDENCE = createHash("sha256")
  .update("§36-E-3B · WAVE-E3B · 2026-09-14 · next-app-router-conventions", "utf8")
  .digest("hex");

export const NEXT_APP_ROUTER_CONVENTIONS_SKILL: Skill = {
  identity: {
    slug: "next-app-router-conventions",
    version: "1.0.0",
    display_name: "Next.js · App Router Conventions",
    domain: "framework",
  },
  applicability: {
    applicable_languages: ["typescript", "tsx"],
    applicable_frameworks: ["nextjs"],
    applicable_change_kinds: ["file_new", "file_content"],
  },
  validators: [
    {
      validator_id: "route_files_must_be_in_app_dir",
      predicate_id: "candidate_touches_module",
      predicate_args: {
        kind: "candidate_touches_module",
        module_prefix: "src/app/",
      },
      kind: "precondition",
      rationale: "App Router conventions apply to files under src/app/",
    },
    {
      validator_id: "route_handler_exports_http_methods",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "export\\s+(async\\s+)?function\\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\\b",
      },
      kind: "invariant",
      rationale: "Route handlers under app/**/route.ts must export named HTTP method functions",
    },
    {
      validator_id: "server_components_no_use_client",
      predicate_id: "text_does_not_contain_substring",
      predicate_args: {
        kind: "text_does_not_contain_substring",
        substring: '"use client"',
      },
      kind: "invariant",
      rationale: "Prefer server components · 'use client' only when interactivity is required",
    },
    {
      validator_id: "no_async_client_components",
      predicate_id: "text_does_not_match_regex",
      predicate_args: {
        kind: "text_does_not_match_regex",
        regex: "\"use client\"[\\s\\S]{0,500}export\\s+default\\s+async\\s+function",
      },
      kind: "anti_pattern",
      rationale: "Client components must not be async · async functions are server-only",
    },
    {
      validator_id: "route_handler_declares_runtime",
      predicate_id: "text_matches_regex",
      predicate_args: {
        kind: "text_matches_regex",
        regex: "export\\s+const\\s+runtime\\s*=\\s*\"(nodejs|edge)\"",
      },
      kind: "evidence_requirement",
      rationale: "Route handlers should explicitly declare runtime for reproducibility",
    },
    {
      validator_id: "no_getServerSideProps_in_app_router",
      predicate_id: "text_does_not_contain_substring",
      predicate_args: {
        kind: "text_does_not_contain_substring",
        substring: "getServerSideProps",
      },
      kind: "anti_pattern",
      rationale: "getServerSideProps is Pages Router only · App Router uses async server components",
    },
  ],
  procedures: [
    {
      step_id: "verify-app-router-shape",
      step_kind: "verify",
      description: "Confirm App Router conventions are followed",
      required_predicate_verdicts: [
        { validator_id: "route_files_must_be_in_app_dir", required_verdict: "satisfied" },
        { validator_id: "no_getServerSideProps_in_app_router", required_verdict: "satisfied" },
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
