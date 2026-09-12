// src/lib/nex/master-ai/agent-factory.ts
//
// NEX Master AI Engineer · M8 · Agent factory · SPEC ONLY
// Philip 2026-09-07 · AUTHORIZE
//
// Master AI can decompose a mission ("Build a world-class Restaurant
// Intelligence Agent") into an AgentSpecification.
//
// PRESERVATION:
//   · The factory NEVER activates agents.
//   · Specifications become slice-authorization sequences (matching the
//     A0/A1/A2/A3 discipline every other NEX agent follows).
//   · Registering an agent in the catalogue (M1) does NOT grant runtime
//     the right to spawn it. Runtime spawning still requires control-plane
//     authorization.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { agentSpecificationsPath } from "./paths";
import type {
  AgentSpecification,
  MasterAgentId,
} from "./types";

export class FactoryPreconditionError extends Error {
  constructor(reason: string) { super(`factory_precondition:${reason}`); }
}

/** Decompose a mission into an AgentSpecification. */
export function decomposeMission(input: {
  mission: string;
  proposed_agent_id: MasterAgentId;
  proposed_name: string;
  domain: string;
  internet_requirement: "NOT_REQUIRED" | "PREFERRED" | "REQUIRED";
  created_by: string;
}): AgentSpecification {
  if (input.mission.trim().length < 12) throw new FactoryPreconditionError("mission_too_short");
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(input.proposed_agent_id)) {
    throw new FactoryPreconditionError(`invalid_agent_id:${input.proposed_agent_id}`);
  }
  const spec: AgentSpecification = {
    specification_id: randomUUID(),
    proposed_agent_id: input.proposed_agent_id,
    proposed_name: input.proposed_name,
    mission_statement: input.mission.trim(),
    domain_definition: input.domain,
    required_capabilities: deriveRequiredCapabilities(input.domain),
    research_requirements: deriveResearchQueries(input.mission, input.domain),
    knowledge_requirements: [],
    benchmark_specification: {
      corpus_size_min: 30,
      case_categories: deriveBenchmarkCategories(input.domain),
    },
    architecture_sketch: renderArchitectureSketch(input),
    runtime_requirements: {
      domain: input.domain,
      internet_requirement: input.internet_requirement,
    },
    safety_boundaries: [
      "no_bypass_of_authentication",
      "no_bypass_of_captcha",
      "no_bypass_of_paywalls",
      "no_bypass_of_robots_txt",
      "respect_rate_limits",
      "respect_terms_of_service",
      "founder_approval_before_activation",
    ],
    deployment_gate_list: [
      "A0_workforce_foundation",
      "A1_capability_registration",
      "A2_real_persister_boundary_if_writes",
      "A3_canonical_model",
      "A4_entity_resolution",
      "A5_evidence_verification_confidence",
      "A6_freshness_change_detection",
      "A7_image_intelligence",
      "A8_controlled_real_acquisition_one_city",
      "A9_controlled_multi_city_rotation",
    ],
    status: "DRAFT",
    created_at_iso: new Date().toISOString(),
    created_by: input.created_by,
    approved_by: null,
    approved_at_iso: null,
  };
  appendJsonLine(agentSpecificationsPath(), spec);
  return spec;
}

function deriveRequiredCapabilities(domain: string): string[] {
  const common = ["source_ingestion", "normalization", "entity_resolution", "verification", "freshness"];
  if (domain === "accommodation") return [...common, "type_specific_attributes", "room_type_model", "image_intelligence"];
  if (domain === "restaurant")    return [...common, "menu_extraction", "cuisine_normalization", "dietary_tagging"];
  if (domain === "travel")        return [...common, "route_intelligence", "schedule_intelligence", "operator_registry"];
  return common;
}

function deriveResearchQueries(mission: string, domain: string): string[] {
  return [
    `What canonical entities compose the ${domain} domain in NEX?`,
    `Which legitimate ${domain} data sources exist that respect ToS/rate limits?`,
    `What ${domain}-specific benchmarks currently exist and what evaluation shape do they use?`,
    `What Indonesian ${domain} terminology must the normalizer preserve?`,
    `What existing NEX capabilities from Programmer / Accommodation could apply to ${domain}?`,
  ];
}

function deriveBenchmarkCategories(domain: string): string[] {
  const common = ["identity_completeness", "location_confidence", "source_diversity", "verification_coverage", "freshness"];
  if (domain === "accommodation") return [...common, "type_correctness", "room_type_association"];
  if (domain === "restaurant")    return [...common, "cuisine_classification", "menu_evidence"];
  if (domain === "travel")        return [...common, "route_correctness", "schedule_confidence"];
  return common;
}

function renderArchitectureSketch(input: { mission: string; proposed_name: string; domain: string }): string {
  return [
    `# ${input.proposed_name}`,
    `## Mission`,
    input.mission,
    ``,
    `## Architecture (inherits NEX doctrine)`,
    ``,
    `Source ingestion -> Normalization -> Entity resolution -> Dedup`,
    `                -> Source reconciliation -> Evidence engine`,
    `                -> Verification / Confidence -> Canonical model`,
    `                -> Change detection -> Freshness -> Quality score`,
    `                -> Domain-specific database -> NEX Brain -> NEX Chat card`,
    ``,
    `## Domain: ${input.domain}`,
    ``,
    `Follows the A0-A9 slice-authorization pattern proven on Accommodation:`,
    `A0 workforce foundation · A1 capability registration · A2 real persister`,
    `A3 canonical model · A4 entity resolution · A5 evidence/verification`,
    `A6 freshness/change detection · A7 image intelligence`,
    `A8 controlled acquisition (one city) · A9 controlled multi-city rotation`,
    ``,
    `## Governing rule`,
    ``,
    `Build the intelligence system, not just the crawler.`,
    ``,
    `Master AI does NOT activate this agent. Every slice above requires`,
    `its own explicit founder authorization prompt.`,
  ].join("\n");
}

export function approveSpecification(input: {
  specification_id: string;
  approved_by: string;
}): AgentSpecification {
  const current = getSpecification(input.specification_id);
  if (!current) throw new FactoryPreconditionError(`unknown_specification:${input.specification_id}`);
  const next: AgentSpecification = {
    ...current,
    status: "APPROVED",
    approved_by: input.approved_by,
    approved_at_iso: new Date().toISOString(),
  };
  appendJsonLine(agentSpecificationsPath(), next);
  return next;
}

export function readAllSpecificationHistory(): AgentSpecification[] {
  return readJsonlAll<AgentSpecification>(agentSpecificationsPath());
}

export function getSpecification(id: string): AgentSpecification | null {
  let latest: AgentSpecification | null = null;
  for (const s of readAllSpecificationHistory()) if (s.specification_id === id) latest = s;
  return latest;
}

export function listSpecifications(): AgentSpecification[] {
  const byId = new Map<string, AgentSpecification>();
  for (const s of readAllSpecificationHistory()) byId.set(s.specification_id, s);
  return Array.from(byId.values());
}

export function _resetFactoryForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(agentSpecificationsPath())) fs.unlinkSync(agentSpecificationsPath()); } catch { /* ignore */ }
}
