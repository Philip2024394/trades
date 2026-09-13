// WO-HQ-AGENTS-01 · agent registry (static, slice 1)
//
// The 14 named agents as authorised in the WO spec §4. Each entry is a
// pure descriptor — no dynamic behaviour lives here.
//
// A future WO will introduce a runtime Agent Registry (per Continuous
// Operation Doctrine §Architectural target); slice 1 uses this static
// list because every agent listed is a real code path in the repo.

import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { AgentDescriptor } from "./types";

export const AGENT_REGISTRY: readonly AgentDescriptor[] = Object.freeze([
  // ── Orchestrator lane ──────────────────────────────────────────────
  {
    id: "nex1-master-engineer",
    name: "NEX1 Master Engineer",
    kind: "orchestrator",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_workflow_traces,
    wire_downstream: ["wo3-code-generation-pipeline"],
  },
  {
    id: "wo3-code-generation-pipeline",
    name: "WO-03 Code Generation Pipeline",
    kind: "author-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_execution_reports,
    wire_downstream: ["wo4-broker-executor"],
  },
  {
    id: "wo4-broker-executor",
    name: "WO-04 Broker Executor",
    kind: "write-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_execution_reports,
    wire_downstream: ["wo5-build-executor"],
  },
  {
    id: "wo5-build-executor",
    name: "WO-05 Build Executor",
    kind: "build-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_build_reports,
    wire_downstream: ["wo6-runtime-executor"],
  },
  {
    id: "wo6-runtime-executor",
    name: "WO-06 Runtime Executor",
    kind: "runtime-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_runtime_reports,
    wire_downstream: ["wo7-node-syntax-specialist"],
  },
  {
    id: "wo7-node-syntax-specialist",
    name: "WO-07 Node-Syntax Specialist",
    kind: "validation-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_specialist_results,
    wire_downstream: ["wo9-corrector"],
  },
  {
    id: "wo9-corrector",
    name: "WO-09 Corrector",
    kind: "correction-stage",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_execution_reports,
    wire_downstream: ["wo13-substrate-guard"],
  },
  {
    id: "wo13-substrate-guard",
    name: "WO-13 Substrate Guard",
    kind: "enforcement",
    lane: "orchestrator",
    source_collection: COLLECTIONS.nex1_audit_events,
    wire_downstream: [],
  },
  // ── Intelligence lane ──────────────────────────────────────────────
  {
    id: "intelligence-crawler",
    name: "NEX Intelligence · Crawler",
    kind: "data-collection",
    lane: "intelligence",
    source_collection: COLLECTIONS.nex_intelligence_crawler_audit,
    wire_downstream: ["intelligence-discovery"],
  },
  {
    id: "intelligence-discovery",
    name: "NEX Intelligence · Discovery Engine",
    kind: "discovery",
    lane: "intelligence",
    source_collection: COLLECTIONS.nex_intelligence_sources,
    wire_downstream: ["intelligence-hypothesis"],
  },
  {
    id: "intelligence-hypothesis",
    name: "NEX Intelligence · Hypothesis Engine",
    kind: "hypothesis",
    lane: "intelligence",
    source_collection: COLLECTIONS.nex_intelligence_hypotheses,
    wire_downstream: ["intelligence-experiment"],
  },
  {
    id: "intelligence-experiment",
    name: "NEX Intelligence · Experiment Engine",
    kind: "experiment",
    lane: "intelligence",
    source_collection: COLLECTIONS.nex_intelligence_experiments,
    wire_downstream: ["intelligence-scoring"],
  },
  {
    id: "intelligence-scoring",
    name: "NEX Intelligence · Scoring / Promotion",
    kind: "scoring",
    lane: "intelligence",
    source_collection: COLLECTIONS.nex_intelligence_knowledge_objects,
    wire_downstream: ["intelligence-proposal"],
  },
  {
    id: "intelligence-proposal",
    name: "NEX Intelligence · Proposal Generator",
    kind: "proposal",
    lane: "intelligence",
    source_collection: COLLECTIONS.nex_intelligence_proposals,
    wire_downstream: [],
  },
]);

/** Allowlist of collections the HQ agents page is permitted to read from. */
export const READABLE_COLLECTIONS: readonly string[] = Object.freeze(
  [...new Set(AGENT_REGISTRY.map((a) => a.source_collection))],
);
