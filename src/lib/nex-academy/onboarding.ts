// WO-ACADEMY-01 · onboarding of the 14 existing NEX agents.
//
// Sources: WO-ACADEMY-01 Agent Capability Review + WO-HQ-AGENTS-01
// registry. Each agent's initial capability profile + career state is
// derived from the review; scores start at defaults appropriate to the
// agent's demonstrated evidence.

import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { buildCapabilityProfile, persistCapabilityProfile } from "./capability-profile";
import { buildAcademyRecord, persistAcademyRecord } from "./registry";
import type { AcademyRecord, CapabilityProfile, CareerState, KnownWeakness } from "./types";
import type { AgentDescriptor } from "@/lib/nex-hq-agents/types";

interface OnboardingSpec {
  readonly initial_career_state: CareerState;
  readonly what_it_knows: readonly string[];
  readonly what_it_trained_on: readonly string[];
  readonly tasks_it_can_perform: readonly string[];
  readonly qualified_tools: readonly string[];
  readonly capability_scope: readonly string[];
  readonly specialist_domain: string;
  readonly initial_task_completion_score: number;
  readonly initial_knowledge_contribution_score: number;
  readonly initial_regression_score: number;
  readonly known_weaknesses: readonly KnownWeakness[];
}

const ONBOARDING: Readonly<Record<string, OnboardingSpec>> = Object.freeze({
  // ── Orchestrator lane ─────────────────────────────────────────────
  "nex1-master-engineer": {
    initial_career_state: "SPECIALIST",
    what_it_knows: ["workflow-tracing", "state-machine", "wo-handoff", "audit-chain-integrity"],
    what_it_trained_on: ["wo-01-through-13", "227-orchestrator-tests"],
    tasks_it_can_perform: ["orchestrate-workflow", "hand-off-work-order", "record-audit-event"],
    qualified_tools: ["gb-storage"],
    capability_scope: ["engineering-orchestration"],
    specialist_domain: "engineering-orchestration",
    initial_task_completion_score: 0.90,
    initial_knowledge_contribution_score: 0.30,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "no self-quality-assessment", status: "monitored", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
      { weakness: "single-project historical evidence only", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo3-code-generation-pipeline": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["template-rendering", "syntax-validation", "diff-computation", "wo-02-authorization"],
    what_it_trained_on: ["wo-03-tests"],
    tasks_it_can_perform: ["generate-code-from-plan", "validate-syntax", "compute-diff"],
    qualified_tools: ["node-syntax-check"],
    capability_scope: ["code-generation", "syntax-validation"],
    specialist_domain: "authoring",
    initial_task_completion_score: 0.90,
    initial_knowledge_contribution_score: 0.20,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "narrow template library (plain-node-server, three-page-app only)", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo4-broker-executor": {
    initial_career_state: "SPECIALIST",
    what_it_knows: ["broker-mediated-write", "snapshot-rollback", "observer-reconciliation"],
    what_it_trained_on: ["wo-04-tests", "t3-a-broker-suite"],
    tasks_it_can_perform: ["controlled-write", "snapshot-on-failure", "rollback", "observer-check"],
    qualified_tools: ["authority-broker"],
    capability_scope: ["filesystem-controlled-write"],
    specialist_domain: "filesystem-controlled-write",
    initial_task_completion_score: 0.92,
    initial_knowledge_contribution_score: 0.25,
    initial_regression_score: 0.98,
    known_weaknesses: [
      { weakness: "runtime tampering during a write not monitored (secure-boot layer)", status: "founder-accepted", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo5-build-executor": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["subprocess-spawn", "allowed-executables-enforcement"],
    what_it_trained_on: ["wo-05-tests"],
    tasks_it_can_perform: ["spawn-subprocess", "capture-stdout-stderr"],
    qualified_tools: ["node", "npm", "npx"],
    capability_scope: ["subprocess-execution"],
    specialist_domain: "subprocess-execution",
    initial_task_completion_score: 0.90,
    initial_knowledge_contribution_score: 0.15,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "no per-executable version pinning", status: "monitored", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
      { weakness: "no signed binary attestation", status: "monitored", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo6-runtime-executor": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["subprocess-lifecycle", "sigterm-sigkill", "http-health-check"],
    what_it_trained_on: ["wo-06-tests"],
    tasks_it_can_perform: ["boot-runtime", "http-health-verify", "graceful-terminate"],
    qualified_tools: ["node", "node:http"],
    capability_scope: ["subprocess-lifecycle", "http-health-verification"],
    specialist_domain: "subprocess-lifecycle",
    initial_task_completion_score: 0.90,
    initial_knowledge_contribution_score: 0.15,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "body match is substring only; no schema validation", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo7-node-syntax-specialist": {
    initial_career_state: "SPECIALIST",
    what_it_knows: ["node-check-parsing", "enoent-detection", "syntax-error-detection", "file-not-found-classification"],
    what_it_trained_on: ["wo-07-tests", "wo-12-real-correction-cycle"],
    tasks_it_can_perform: ["validate-node-file", "extract-stderr-signals", "classify-failures"],
    qualified_tools: ["node", "node --check"],
    capability_scope: ["node-syntax-validation", "stderr-signal-extraction"],
    specialist_domain: "validation",
    initial_task_completion_score: 0.93,
    initial_knowledge_contribution_score: 0.35,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "only handles Node.js; no TS/Python/other-language specialists", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo9-corrector": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["signal-extraction", "rule-library-reinvoke-plan-missing-files", "escalation-on-ambiguous"],
    what_it_trained_on: ["wo-09-tests", "wo-12-real-correction-cycle"],
    tasks_it_can_perform: ["diagnose-failure", "propose-correction", "escalate-ambiguous"],
    qualified_tools: ["deterministic-rule-library"],
    capability_scope: ["correction"],
    specialist_domain: "correction",
    initial_task_completion_score: 0.88,
    initial_knowledge_contribution_score: 0.25,
    initial_regression_score: 0.90,
    known_weaknesses: [
      { weakness: "rule library is small (v0.1); mixed-signal failures not handled yet", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "wo13-substrate-guard": {
    initial_career_state: "ELITE_SPECIALIST",
    what_it_knows: ["sha256-integrity", "ed25519-attestation", "substrate-integrity-table"],
    what_it_trained_on: ["wo-13-tests", "16-adversarial-suite"],
    tasks_it_can_perform: ["verify-substrate-integrity", "refuse-on-drift", "attestation-signature-verify"],
    qualified_tools: ["node:crypto"],
    capability_scope: ["substrate-enforcement", "attestation-verification"],
    specialist_domain: "enforcement",
    initial_task_completion_score: 0.97,
    initial_knowledge_contribution_score: 0.55,
    initial_regression_score: 0.98,
    known_weaknesses: [
      { weakness: "no post-startup mutation monitoring (secure-boot / TPM layer)", status: "founder-accepted", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  // ── Intelligence lane ─────────────────────────────────────────────
  "intelligence-crawler": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["signed-manifest-verification", "broker-gated-http-get", "rate-limiting", "provenance-chain"],
    what_it_trained_on: ["wo-intelligence-01-tests", "wo-intelligence-02-tests"],
    tasks_it_can_perform: ["crawler-fetch-arxiv", "crawler-fetch-nodejs-docs"],
    qualified_tools: ["node:https", "node:http"],
    capability_scope: ["broker-gated-http-get", "manifest-verification"],
    specialist_domain: "data-collection",
    initial_task_completion_score: 0.85,
    initial_knowledge_contribution_score: 0.30,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "only 2 source classes onboarded (arxiv, nodejs-docs)", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "intelligence-discovery": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["pattern-detection", "conflict-detection", "connection-detection", "combinatorial-synthesis"],
    what_it_trained_on: ["wo-intelligence-01-tests"],
    tasks_it_can_perform: ["detect-patterns", "detect-conflicts", "detect-connections", "combinatorial-synthesis"],
    qualified_tools: ["deterministic-rule-library"],
    capability_scope: ["knowledge-discovery"],
    specialist_domain: "discovery",
    initial_task_completion_score: 0.85,
    initial_knowledge_contribution_score: 0.45,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "stopword list small; classifier weights hand-tuned", status: "monitored", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "intelligence-hypothesis": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["hypothesis-templates", "held-out-isolation-discipline"],
    what_it_trained_on: ["wo-intelligence-01-tests", "wo-intelligence-02-tests"],
    tasks_it_can_perform: ["form-hypothesis-from-discovery"],
    qualified_tools: ["deterministic-template-library"],
    capability_scope: ["hypothesis-formation"],
    specialist_domain: "hypothesis-formation",
    initial_task_completion_score: 0.85,
    initial_knowledge_contribution_score: 0.35,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "four hypothesis templates only; no bespoke domain hypotheses", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "intelligence-experiment": {
    initial_career_state: "SPECIALIST",
    what_it_knows: ["sandboxed-subprocess", "bounded-experiments", "outcome-capture"],
    what_it_trained_on: ["wo-intelligence-01-tests"],
    tasks_it_can_perform: ["run-parse-stderr-experiment"],
    qualified_tools: ["node", "wo7-specialist-invocation"],
    capability_scope: ["experimentation"],
    specialist_domain: "experimentation",
    initial_task_completion_score: 0.90,
    initial_knowledge_contribution_score: 0.40,
    initial_regression_score: 0.95,
    known_weaknesses: [
      { weakness: "ONE experiment kind (parse-stderr-signal-detection)", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "intelligence-scoring": {
    initial_career_state: "ELITE_SPECIALIST",
    what_it_knows: ["deterministic-scoring", "tiered-promotion", "property-verified"],
    what_it_trained_on: ["wo-intelligence-01-tests", "wo-intelligence-02-tests"],
    tasks_it_can_perform: ["score-evidence", "decide-promotion"],
    qualified_tools: ["pure-function-scoring"],
    capability_scope: ["deterministic-scoring", "deterministic-promotion"],
    specialist_domain: "deterministic-decision",
    initial_task_completion_score: 0.95,
    initial_knowledge_contribution_score: 0.50,
    initial_regression_score: 1.00,
    known_weaknesses: [
      { weakness: "thresholds are constants; not yet evidence-informed", status: "monitored", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
  "intelligence-proposal": {
    initial_career_state: "CERTIFIED",
    what_it_knows: ["structured-proposal-emission", "wo-recommendation"],
    what_it_trained_on: ["wo-intelligence-01-tests"],
    tasks_it_can_perform: ["emit-proposal"],
    qualified_tools: ["gb-storage"],
    capability_scope: ["proposal-emission"],
    specialist_domain: "proposal-emission",
    initial_task_completion_score: 0.88,
    initial_knowledge_contribution_score: 0.25,
    initial_regression_score: 1.00,
    known_weaknesses: [
      { weakness: "proposals are text; no structured diff or preview", status: "bounded", discovered_at: "2026-09-13T00:00:00.000Z", evidence_pointer: null },
    ],
  },
});

export interface OnboardingResult {
  readonly record: AcademyRecord;
  readonly profile: CapabilityProfile;
}

/** Build the initial CapabilityProfile + AcademyRecord for one agent (pure). */
export function buildOnboardingForAgent(agent: AgentDescriptor): OnboardingResult {
  const spec = ONBOARDING[agent.id];
  if (!spec) throw new Error(`[nex-academy/onboarding] no onboarding spec for agent id: ${agent.id}`);
  const profile = buildCapabilityProfile({
    agent_id: agent.id,
    what_it_knows: spec.what_it_knows,
    what_it_trained_on: spec.what_it_trained_on,
    tasks_it_can_perform: spec.tasks_it_can_perform,
    success_rate: spec.initial_task_completion_score,
    failure_types: [],
    qualified_tools: spec.qualified_tools,
    evidence_pointers: [],
    capability_scope: spec.capability_scope,
    current_workload: 0,
    confidence: 0.5,   // advisory; actual measurements come from usage
    specialist_domain: spec.specialist_domain,
    known_weaknesses: spec.known_weaknesses,
  });
  const record = buildAcademyRecord({
    agent_id: agent.id,
    agent_name: agent.name,
    domain: spec.specialist_domain,
    initial_career_state: spec.initial_career_state,
    initial_reason: "onboarded 2026-09-13 from WO-ACADEMY-01 Agent Capability Review",
    capability_profile_version: profile.version,
    initial_scores: {
      task_completion_score: spec.initial_task_completion_score,
      knowledge_contribution_score: spec.initial_knowledge_contribution_score,
      regression_score: spec.initial_regression_score,
    },
    antecedent_provenance_hashes: [profile.provenance_chain_hash],
  });
  return { record, profile };
}

/** Onboard all 14 existing agents. Idempotent — safe to call repeatedly. */
export async function onboardAllExistingAgents(): Promise<readonly OnboardingResult[]> {
  const results: OnboardingResult[] = [];
  for (const agent of AGENT_REGISTRY) {
    const built = buildOnboardingForAgent(agent);
    await persistCapabilityProfile(built.profile);
    await persistAcademyRecord(built.record);
    results.push(built);
  }
  return results;
}

/** Test helper: list every configured agent id (for property tests). */
export function listOnboardedAgentIds(): readonly string[] {
  return Object.freeze(Object.keys(ONBOARDING));
}
