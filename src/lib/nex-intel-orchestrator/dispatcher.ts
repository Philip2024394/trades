// WO-INTEL-ORCHESTRATOR-01 · mission dispatcher.
//
// Takes a scheduled work-class + mandate + current state → constructs a
// concrete IntelligenceMission record → hands it to the intelligence-
// lane pipeline for execution. Reuses WO-INTEL-01/02 crawler + discovery
// + hypothesis + experiment + scoring + proposal chain.

import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { runDiscoveryCore } from "@/lib/nex-intelligence/orchestrator";
import type {
  IntelligenceMission,
  IntelligenceOperatingMandate,
  IntelligenceWorkClass,
  MissionOutcome,
} from "./types";
import { preCheckMissionAgainstMandate } from "./scheduler";

// ── Build a mission for a chosen work class ────────────────────────────

const AGENT_ASSIGNMENTS_ALL_LANES: IntelligenceMission["agent_assignments"] = Object.freeze([
  { agent_id: "intelligence-crawler",    role: "crawler" },
  { agent_id: "intelligence-discovery",  role: "discovery" },
  { agent_id: "intelligence-hypothesis", role: "hypothesis" },
  { agent_id: "intelligence-experiment", role: "experiment" },
  { agent_id: "intelligence-scoring",    role: "scoring" },
  { agent_id: "intelligence-proposal",   role: "proposal" },
]);

export function buildMission(input: {
  readonly mandate: IntelligenceOperatingMandate;
  readonly work_class: IntelligenceWorkClass;
  readonly compute_budget_ms?: number;
  readonly antecedent_provenance_hashes?: readonly string[];
}): IntelligenceMission {
  const now = new Date();
  const mission_id = `intel-mission-${sha256Hex(input.mandate.mandate_id + input.work_class + now.toISOString()).slice(0, 16)}-${randomUUID().slice(0, 8)}`;
  const expires_at = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const budget = Math.min(
    input.compute_budget_ms ?? 60_000,
    input.mandate.max_experiment_budget_ms,
  );
  const objective = objectiveFor(input.work_class);
  const scope = scopeFor(input.work_class, input.mandate);
  const base = {
    record_type: "NEX_INTEL_MISSION" as const,
    mission_id,
    mandate_id: input.mandate.mandate_id,
    kind: input.work_class,
    created_at: now.toISOString(),
    expires_at,
    objective,
    scope,
    agent_assignments: AGENT_ASSIGNMENTS_ALL_LANES,
    compute_budget_ms: budget,
    evidence_requirements: {
      min_source_records: 1,
      min_experiment_outcomes: 1,
      min_generalisation_ratio: 0,
    },
    expected_outputs: expectedOutputsFor(input.work_class),
    termination_condition: `time_budget_elapsed OR expected_outputs produced OR mandate_expired`,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes ?? [input.mandate.provenance_chain_hash]) };
}

function objectiveFor(kind: IntelligenceWorkClass): string {
  switch (kind) {
    case "crawl_new_authorised_source":  return "fetch a new authorised source and produce Source + Fragment records";
    case "revisit_stale_knowledge":      return "revisit knowledge objects flagged stale · CONFIRM/UPDATE/SUPERSEDE/REJECT via existing revisit machinery";
    case "resolve_contradiction":        return "attempt to resolve one contradiction against fresh evidence";
    case "detect_new_combinations":      return "run combinatorial synthesis over current knowledge library";
    case "test_promising_hypothesis":    return "run the experiment engine on the highest-signal pending hypothesis";
    case "reproduce_previous_finding":   return "attempt independent reproduction of a previously-recorded finding";
    case "challenge_existing_knowledge": return "attempt to falsify a knowledge object · record contradictions honestly";
    case "investigate_stale_knowledge":  return "audit a stale knowledge object · surface known weaknesses";
  }
}

function scopeFor(kind: IntelligenceWorkClass, mandate: IntelligenceOperatingMandate): IntelligenceMission["scope"] {
  switch (kind) {
    case "crawl_new_authorised_source":
      return { source_class_ids: [mandate.authorised_source_class_ids[0]] };
    default:
      return {};
  }
}

function expectedOutputsFor(kind: IntelligenceWorkClass): IntelligenceMission["expected_outputs"] {
  const all: IntelligenceMission["expected_outputs"][number][] = [
    "SourceRecord", "KnowledgeFragment", "DiscoveryRecord",
    "HypothesisRecord", "ExperimentRecord", "ProposalRecord",
  ];
  if (kind === "crawl_new_authorised_source") return Object.freeze(all) as IntelligenceMission["expected_outputs"];
  return Object.freeze(all) as IntelligenceMission["expected_outputs"];
}

// ── Dispatch a mission (real execution) ───────────────────────────────

export interface DispatchInput {
  readonly mandate: IntelligenceOperatingMandate;
  readonly mission: IntelligenceMission;
  /** For test-scoped runs. */
  readonly trusted_attestation_keys?: readonly string[];
  /** Fixture Atom for arXiv when we know rate-limit blocks real fetch. */
  readonly _http_override?: import("@/lib/nex-intelligence/crawler").HttpRequestFn;
  /** Signed crawler manifest to use for the crawl step (must be in mandate.authorised_crawler_manifest_ids). */
  readonly crawler_manifest: import("@/lib/nex-intelligence/types").CrawlerManifest;
  /** Sandbox for the experiment engine. */
  readonly sandbox_root: string;
  /** URL to fetch for the crawl step. Must be in the manifest. */
  readonly fetch_url: string;
}

export async function dispatchMission(input: DispatchInput): Promise<MissionOutcome> {
  const started_at = new Date().toISOString();
  const startMs = Date.now();

  // Envelope pre-check
  const check = preCheckMissionAgainstMandate(input.mission, input.mandate);
  if (!check.ok) {
    return buildOutcome(input.mission, "REFUSED_BY_MANDATE", started_at, startMs, check.reason);
  }

  // Persist the mission (this makes it visible to heartbeat as "active mission")
  await getStorage().save(COLLECTIONS.nex_intel_missions, input.mission);

  // Emit an initial progress snapshot for every assigned agent — so the
  // heartbeat monitor observes them as WORKING even mid-mission. The
  // snapshot records ONLY liveness intent (0 items processed); it never
  // fabricates completion evidence.
  const now0 = new Date().toISOString();
  for (const a of input.mission.agent_assignments) {
    await getStorage().save(COLLECTIONS.nex_hq_agent_progress_snapshots, {
      record_type: "NEX_HQ_AGENT_PROGRESS_SNAPSHOT" as const,
      snapshot_id: `progress-${input.mission.mission_id}-${a.agent_id}-start`,
      agent_id: a.agent_id,
      mission_id: input.mission.mission_id,
      observed_at: now0,
      items_processed: 0,
      items_expected: null,
      evidence_record_ids: [],
      compute_used_ms: 0,
      deadline: input.mission.expires_at,
      last_progress_at: now0,
      provenance_chain_hash: "",
    });
  }

  try {
    const result = await runDiscoveryCore({
      manifest: input.crawler_manifest,
      trusted_attestation_keys: input.trusted_attestation_keys,
      fetch_url: input.fetch_url,
      sandbox_root: input.sandbox_root,
      stderr_test_cases: [
        { case_id: "mission-tc-1", stderr_snippet: "", expected_rule: "file-not-found", expected_message_pattern: null },
        { case_id: "mission-tc-2", stderr_snippet: "", expected_rule: "clean",          expected_message_pattern: null },
      ],
      _http_override: input._http_override,
    });

    const outcome: MissionOutcome = buildOutcome(input.mission, "COMPLETED", started_at, startMs, null, {
      source_record_ids: [result.source.source_id],
      knowledge_fragment_ids: result.fragments.map((f) => f.fragment_id),
      discovery_ids: result.discoveries.map((d) => d.discovery_id),
      hypothesis_ids: result.hypotheses.map((h) => h.hypothesis_id),
      experiment_ids: result.experiments.map((e) => e.experiment_id),
      proposal_ids: result.proposals.map((p) => p.proposal_id),
    });
    await getStorage().save(COLLECTIONS.nex_intel_mission_outcomes, outcome);
    return outcome;
  } catch (err) {
    const outcome = buildOutcome(input.mission, "FAILED", started_at, startMs, (err as Error).message);
    await getStorage().save(COLLECTIONS.nex_intel_mission_outcomes, outcome);
    return outcome;
  }
}

function buildOutcome(
  mission: IntelligenceMission,
  kind: MissionOutcome["kind"],
  started_at: string,
  startMs: number,
  failure_reason: string | null,
  outputs?: MissionOutcome["outputs_produced"],
): MissionOutcome {
  const empty: MissionOutcome["outputs_produced"] = {
    source_record_ids: [], knowledge_fragment_ids: [], discovery_ids: [],
    hypothesis_ids: [], experiment_ids: [], proposal_ids: [],
  };
  const outs = outputs ?? empty;
  const outcome_id = `intel-outcome-${sha256Hex(mission.mission_id + kind).slice(0, 16)}`;
  const base = {
    record_type: "NEX_INTEL_MISSION_OUTCOME" as const,
    outcome_id,
    mission_id: mission.mission_id,
    mandate_id: mission.mandate_id,
    started_at,
    finished_at: new Date().toISOString(),
    kind,
    outputs_produced: outs,
    evidence_summary: {
      sources_acquired: outs.source_record_ids.length,
      fragments_extracted: outs.knowledge_fragment_ids.length,
      discoveries_produced: outs.discovery_ids.length,
      hypotheses_formed: outs.hypothesis_ids.length,
      experiments_run: outs.experiment_ids.length,
      experiments_passed: 0,
      proposals_emitted: outs.proposal_ids.length,
      contradictions_detected: 0,
      fabricated_or_unsupported_rejected: 0,
    },
    resource_usage: { runtime_ms: Date.now() - startMs },
    failure_reason,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, [mission.provenance_chain_hash]) };
}
