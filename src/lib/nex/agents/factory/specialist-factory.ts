// src/lib/nex/agents/factory/specialist-factory.ts
//
// Phase 13 · Specialist Factory (under Founder Governance)
// Philip 2026-09-08 · AUTHORIZE Phase 13
//
// Bootstraps a NEW specialist agent from a well-formed SpecialistSpec.
// Every specialist inherits the 13 HARD DOCTRINES from day one.
//
// DISCIPLINE:
//   · Founder-authorization required per specialist creation
//   · Sprawl cap: MAX_SPECIALISTS_TOTAL enforced (currently 10)
//   · Reserved agent-ids protected (programmer · accommodation · master_ai · speaking)
//   · Every specialist must inherit ALL 13 hard doctrines · missing any → REJECTED
//   · Dry-run mode default · returns bootstrap plan without writing files
//   · Real file writes require persist_bootstrap: true AND Founder authorization
//
// The factory produces a BOOTSTRAP PLAN — a machine-readable description
// of the specialist that Founder can review before authorizing actual
// creation. Real integration into the agent-runtime + control-plane
// requires separate wiring per specialist.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────

export type SpecialistArchetype =
  | "conversation_driven"   // e.g. NEX Speaking Intelligence Engineer
  | "analysis_driven"       // e.g. Vision Intelligence Engineer
  | "retrieval_driven"      // e.g. Local Knowledge Intelligence Engineer
  | "classification_driven" // e.g. Sentiment Intelligence Engineer
  | "generation_driven";    // e.g. Content Intelligence Engineer (never LLM-only · always bounded)

export const REQUIRED_DOCTRINE_INHERITANCE = [
  "life_safety_supersession",
  "medical_disclaimer_discipline",
  "legal_disclaimer_discipline",
  "expert_chef_discipline",
  "cultures_history_belief_discipline",
  "animals_veterinary_discipline",
  "multilingual_voice_humor_discipline",
  "language_interaction_spelling_suggest_never_choose",
  "vision_no_third_party_llm",
  "construction_country_code_compliance",
  "ui_and_code_quality_guardian",
  "bounded_autonomous_engineering_founder_governance",
  "owner_identity_founder_gate",
] as const;
export type RequiredDoctrine = typeof REQUIRED_DOCTRINE_INHERITANCE[number];

export const RESERVED_AGENT_IDS = ["programmer", "accommodation", "master_ai", "speaking"] as const;
export const MAX_SPECIALISTS_TOTAL = 10;

/** SpecialistSpec — what Founder authorizes when creating a specialist. */
export type SpecialistSpec = {
  agent_id: string;                     // e.g. "cooking" · slug format
  human_name: string;                   // e.g. "NEX Cooking Intelligence Engineer"
  archetype: SpecialistArchetype;
  domain_slug: string;                  // e.g. "cooking" · single word or dotted
  priority_languages: string[];         // ["en", "id", "ja"] etc.
  benchmark_corpus_seed: {              // seed for the specialist's own benchmark
    seed_case_count: number;            // minimum viable · e.g. 5
    defect_class_focus: string;         // e.g. "cooking.food_safety"
  };
  doctrine_inheritance: RequiredDoctrine[];  // MUST include every REQUIRED_DOCTRINE_INHERITANCE
  founder_authorization_id: string;     // Founder-issued per-specialist auth
  founder_reason: string;               // human-readable rationale
};

export type SpecialistBootstrap = {
  status: "APPROVED" | "REJECTED" | "DRY_RUN_PLAN";
  spec: SpecialistSpec;
  rejection_reasons: string[];
  planned_worker_file: string;          // src/lib/nex/agent-runtime/worker-<id>.ts
  planned_module_directory: string;     // src/lib/nex/agents/nex-<id>/
  planned_knowledge_namespace: string;  // domain filter · e.g. "cooking.*"
  planned_ledger_paths: {
    heartbeat: string;
    events_appends_to: string;
    audit: string;
  };
  planned_agent_runtime_registration: {
    agent_id: string;
    machinery: string;
    domain: string;
    internet_requirement: "REQUIRED" | "PREFERRED" | "OPTIONAL";
  };
  doctrine_manifest: RequiredDoctrine[];
  integration_checklist: string[];      // steps Founder must approve before this specialist ships
  requires_founder_approval_before_ship: true;
  time_to_first_improvement_cycle_target_hours: number;
  created_at_iso: string;
};

// ─── Sprawl policy ───────────────────────────────────

/** Count currently-registered specialists (via nex-agent-runtime positions.json).
 *  Reserved agents (programmer · accommodation · master_ai) are NOT counted. */
function currentSpecialistCount(repoRoot?: string): number {
  const root = repoRoot ?? process.cwd();
  const positionsPath = path.join(root, "data", "nex-agent-runtime", "positions.json");
  if (!existsSync(positionsPath)) return 0;
  try {
    const raw = readFileSync(positionsPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const list: Array<{ agent_id?: string }> = Array.isArray(parsed) ? parsed as any[] : (parsed as any)?.positions ?? [];
    return list.filter((p) => {
      const id = String(p?.agent_id ?? "");
      return id && !RESERVED_AGENT_IDS.includes(id as any);
    }).length;
  } catch { return 0; }
}

// ─── Validation ──────────────────────────────────────

function validateSpec(spec: SpecialistSpec, repoRoot?: string): string[] {
  const errors: string[] = [];

  // agent_id format
  if (!spec.agent_id || !/^[a-z][a-z0-9_]{1,31}$/.test(spec.agent_id)) {
    errors.push(`agent_id '${spec.agent_id}' must match ^[a-z][a-z0-9_]{1,31}$`);
  }
  // reserved-name conflict
  if (RESERVED_AGENT_IDS.includes(spec.agent_id as any)) {
    errors.push(`agent_id '${spec.agent_id}' is RESERVED (core system agent)`);
  }
  // founder authorization required
  if (!spec.founder_authorization_id || spec.founder_authorization_id.trim().length === 0) {
    errors.push("founder_authorization_id required · no specialist creation without Founder-issued authorization");
  }
  if (!spec.founder_reason || spec.founder_reason.trim().length < 20) {
    errors.push("founder_reason required · minimum 20 characters explaining why this specialist is needed");
  }
  // doctrine inheritance completeness
  const inherited = new Set(spec.doctrine_inheritance);
  for (const req of REQUIRED_DOCTRINE_INHERITANCE) {
    if (!inherited.has(req)) errors.push(`doctrine_inheritance missing required doctrine: ${req}`);
  }
  // priority languages non-empty
  if (!spec.priority_languages || spec.priority_languages.length === 0) {
    errors.push("priority_languages must contain at least one language code");
  }
  // benchmark seed non-trivial
  if (!spec.benchmark_corpus_seed || spec.benchmark_corpus_seed.seed_case_count < 5) {
    errors.push("benchmark_corpus_seed.seed_case_count must be >= 5 (minimum viable benchmark)");
  }
  // sprawl cap
  const currentCount = currentSpecialistCount(repoRoot);
  if (currentCount >= MAX_SPECIALISTS_TOTAL) {
    errors.push(`sprawl cap: ${currentCount} specialists already registered · cap is ${MAX_SPECIALISTS_TOTAL} · deregister one before creating another`);
  }
  return errors;
}

// ─── The factory ────────────────────────────────────

export function bootstrapSpecialist(spec: SpecialistSpec, opts: { persist_bootstrap?: boolean; repo_root?: string; dry_run?: boolean } = {}): SpecialistBootstrap {
  const now = new Date().toISOString();
  const errors = validateSpec(spec, opts.repo_root);
  const workerFile = `src/lib/nex/agent-runtime/worker-${spec.agent_id}.ts`;
  const moduleDir = `src/lib/nex/agents/nex-${spec.agent_id}/`;
  const knowledgeNs = `${spec.domain_slug}.*`;
  const heartbeatPath = `data/nex-agent-runtime/heartbeat-${spec.agent_id}.json`;
  const eventsFile = `data/nex-agent-runtime/events.jsonl`;
  const auditPath = `data/programmer-execution/command_audit.jsonl`;

  const integrationChecklist = [
    `1. Founder reviews SpecialistBootstrap plan (this document)`,
    `2. Founder issues explicit BEGIN for building the specialist module at ${moduleDir}`,
    `3. Programmer builds the worker file ${workerFile} following the archetype template (${spec.archetype})`,
    `4. Specialist inherits every doctrine in REQUIRED_DOCTRINE_INHERITANCE (${REQUIRED_DOCTRINE_INHERITANCE.length} doctrines)`,
    `5. Specialist seeds its own frozen benchmark corpus (>= ${spec.benchmark_corpus_seed.seed_case_count} cases · defect_class_focus=${spec.benchmark_corpus_seed.defect_class_focus})`,
    `6. Specialist registered in agent-runtime types.ts + control-plane.ts + nex-agent-runtime.mjs dispatch`,
    `7. Contract tests prove every doctrine is inherited and enforced`,
    `8. Founder issues explicit BEGIN for starting the specialist as a live process`,
    `9. Speaking-Phase-3-style status snapshot confirms specialist RUNNING · heartbeat fresh · Master AI observation loop consuming its events`,
    `10. Only after all 9 steps: specialist is officially operational and shows up in the {active:5+} runtime count`,
  ];

  const status: SpecialistBootstrap["status"] = errors.length > 0
    ? "REJECTED"
    : (opts.persist_bootstrap && !opts.dry_run ? "APPROVED" : "DRY_RUN_PLAN");

  return {
    status,
    spec,
    rejection_reasons: errors,
    planned_worker_file: workerFile,
    planned_module_directory: moduleDir,
    planned_knowledge_namespace: knowledgeNs,
    planned_ledger_paths: {
      heartbeat: heartbeatPath,
      events_appends_to: eventsFile,
      audit: auditPath,
    },
    planned_agent_runtime_registration: {
      agent_id: spec.agent_id,
      machinery: `${spec.agent_id}_intelligence_engineer`,
      domain: spec.domain_slug,
      internet_requirement: "PREFERRED",
    },
    doctrine_manifest: [...REQUIRED_DOCTRINE_INHERITANCE],
    integration_checklist: integrationChecklist,
    requires_founder_approval_before_ship: true,
    time_to_first_improvement_cycle_target_hours: 24,
    created_at_iso: now,
  };
}
