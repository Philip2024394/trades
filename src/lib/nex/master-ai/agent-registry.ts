// src/lib/nex/master-ai/agent-registry.ts
//
// NEX Master AI Engineer · M1 · Agent Registry
// Philip 2026-09-07 · AUTHORIZE
//
// Extensible catalogue of every NEX agent Master AI knows about. Uses
// append-only JSONL (mirrors Phase A discipline) · corrections require
// a NEW registration with `supersedes` referring to the prior entry ·
// in-place edits rejected.
//
// PRESERVATION:
//   · Does NOT modify src/lib/nex/agent-runtime/registry.ts (the
//     runtime's own hardcoded catalogue). Master AI catalogue is a
//     PARALLEL, extensible catalogue that references but never mutates
//     the runtime's authorized-agents state.
//   · Does NOT bypass control-plane authorization. Registering an agent
//     here does NOT grant the runtime the right to spawn it.
//
// Every mutation appends to the catalogue file. Every read scans the
// full file · dedup by taking the LATEST record per agent_id.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { agentCataloguePath } from "./paths";
import type {
  AgentCatalogueEntry,
  MasterAgentId,
  AgentLifecycleState,
  AgentAuthorizationState,
} from "./types";

const AGENT_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export class InvalidAgentIdError extends Error {
  constructor(id: string) { super(`invalid_agent_id:${id}`); }
}

export function validateAgentId(id: string): void {
  if (!id || !AGENT_ID_PATTERN.test(id)) throw new InvalidAgentIdError(id);
}

/** Register (or update) an agent. Append-only: every call writes a NEW
 *  record to the catalogue file. The current state per agent_id is the
 *  LAST record seen. Corrections are made by registering a new record
 *  with the corrected fields · never by editing the file. */
export function registerAgent(input: Omit<AgentCatalogueEntry, "registered_at_iso" | "registered_by"> & {
  registered_by: string;
}): AgentCatalogueEntry {
  validateAgentId(input.agent_id);
  const entry: AgentCatalogueEntry = {
    ...input,
    registered_at_iso: new Date().toISOString(),
  };
  appendJsonLine(agentCataloguePath(), entry);
  return entry;
}

export function readAllHistory(): AgentCatalogueEntry[] {
  return readJsonlAll<AgentCatalogueEntry>(agentCataloguePath());
}

/** Current state per agent (latest record wins). */
export function listAgents(): AgentCatalogueEntry[] {
  const byId = new Map<MasterAgentId, AgentCatalogueEntry>();
  for (const entry of readAllHistory()) byId.set(entry.agent_id, entry);
  return Array.from(byId.values()).sort((a, b) => a.agent_id.localeCompare(b.agent_id));
}

export function getAgent(agentId: MasterAgentId): AgentCatalogueEntry | null {
  validateAgentId(agentId);
  let latest: AgentCatalogueEntry | null = null;
  for (const entry of readAllHistory()) if (entry.agent_id === agentId) latest = entry;
  return latest;
}

export function setLifecycleState(input: {
  agent_id: MasterAgentId;
  lifecycle_state: AgentLifecycleState;
  registered_by: string;
  reason?: string;
}): AgentCatalogueEntry {
  const current = getAgent(input.agent_id);
  if (!current) throw new Error(`unknown_agent:${input.agent_id}`);
  const next: AgentCatalogueEntry = {
    ...current,
    lifecycle_state: input.lifecycle_state,
    notes: input.reason ?? current.notes,
    registered_at_iso: new Date().toISOString(),
    registered_by: input.registered_by,
  };
  appendJsonLine(agentCataloguePath(), next);
  return next;
}

export function setAuthorizationState(input: {
  agent_id: MasterAgentId;
  authorization_state: AgentAuthorizationState;
  registered_by: string;
  reason?: string;
}): AgentCatalogueEntry {
  const current = getAgent(input.agent_id);
  if (!current) throw new Error(`unknown_agent:${input.agent_id}`);
  const next: AgentCatalogueEntry = {
    ...current,
    authorization_state: input.authorization_state,
    notes: input.reason ?? current.notes,
    registered_at_iso: new Date().toISOString(),
    registered_by: input.registered_by,
  };
  appendJsonLine(agentCataloguePath(), next);
  return next;
}

/** Seed the catalogue with the two agents already known to the runtime.
 *  Idempotent · calling repeatedly is a no-op if the current record for
 *  each agent already matches the seed shape. */
export function ensureRuntimeAgentsRegistered(input: { registered_by: string }): void {
  const existing = new Map(listAgents().map((e) => [e.agent_id, e]));
  const seeds: Array<Omit<AgentCatalogueEntry, "registered_at_iso">> = [
    {
      agent_id: "programmer",
      name: "NEX Programmer Agent",
      description: "Engineering execution core · 10,314 LOC across Phases A-G · review · benchmark · stability · improvement · execution",
      version: "v0.1.0",
      lifecycle_state: "ACTIVE",
      domain: "engineering",
      capabilities: ["phase_a_learning", "phase_c_review", "phase_d_benchmark", "phase_e_stability", "phase_f_improvement", "phase_g_execution"],
      benchmark_suite_ref: null,
      knowledge_domains: ["software_engineering", "review", "benchmarking", "sandboxed_execution"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "Seeded from runtime · PRESERVE Phase A-G disciplines · anti-self-reinforcement · immutable history · no LLM code gen",
    },
    {
      agent_id: "accommodation",
      name: "NEX Accommodation Intelligence Agent",
      description: "Accommodation intelligence · A0-A3 GREEN · canonical model + room types + attribute overlay · A4-A9 pending",
      version: "v0.3.0",
      lifecycle_state: "ACTIVE",
      domain: "accommodation",
      capabilities: ["accommodation_capability_registration", "accommodation_persister", "accommodation_canonical_model"],
      benchmark_suite_ref: null,
      knowledge_domains: ["hotels", "villas", "guesthouses", "hostels", "apartments", "kos", "homestays", "resorts", "indonesia_accommodation"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "Seeded from runtime · local PG :5433 · nex_dev · Project B untouched · watchdog untouched",
    },
    {
      agent_id: "master_ai",
      name: "NEX Master AI Engineer",
      description: "Intelligence + engineering orchestration layer above Programmer · research · teaching · evaluation · Philip intel · autonomous evolution",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "master_ai",
      capabilities: [],
      benchmark_suite_ref: null,
      knowledge_domains: [],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "Registered · not yet ACTIVE · foundation modules M1-M11 in construction",
    },
    // 2026-09-08: added speaking + Wave-S specialists (vision/travel/business).
    // Master AI's endurance report and failure aggregation now cover them.
    // Vision/travel/business are STOPPED-registered per Founder posture — the
    // registry records their identity so Master AI knows they EXIST · not that
    // they are currently RUNNING.
    {
      agent_id: "speaking",
      name: "NEX Speaking Agent",
      description: "Owner-facing voice specialist · speaking-template pattern · WORK_COMPLETED/WORK_FAILED via 60s self-benchmark",
      version: "v0.1.0",
      lifecycle_state: "ACTIVE",
      domain: "speaking",
      capabilities: ["speaking_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["conversational_ux", "voice", "en", "id"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "Speaking-template specialist · WAVE-S baseline",
    },
    {
      agent_id: "vision",
      name: "NEX Vision Specialist",
      description: "Vision/image intelligence specialist · WAVE-S-1 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "vision",
      capabilities: ["vision_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["images", "captioning", "vision"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged",
    },
    {
      agent_id: "travel",
      name: "NEX Travel Specialist",
      description: "Travel domain intelligence · WAVE-S-2 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "travel",
      capabilities: ["travel_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["travel", "logistics", "geography"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged",
    },
    {
      agent_id: "business",
      name: "NEX Business Intelligence Specialist",
      description: "Business intelligence domain · WAVE-S-3 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "business",
      capabilities: ["business_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["business_intelligence", "commercial_context"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged",
    },
    {
      agent_id: "food",
      name: "NEX Food Specialist",
      description: "Food safety · dietary restrictions · allergens · hygiene · temperature discipline · WAVE-S-4 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "food",
      capabilities: ["food_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["food_safety", "allergens", "dietary_restrictions", "hygiene", "cultural_food_practice"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged",
    },
    {
      agent_id: "construction",
      name: "NEX Construction Specialist",
      description: "General construction (all countries · NEX-scoped not Networkers-scoped) · Building regs / codes · trade licensing · safety at height · asbestos · structural load · shared-wall notice · staircase-aware (defers detail to staircase-* modules) · WAVE-S-5 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "construction",
      capabilities: ["construction_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["construction_safety", "building_regulations", "trade_licensing", "structural", "shared_wall_law", "staircase"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged",
    },
    {
      agent_id: "transport",
      name: "NEX Transport & Logistics Specialist",
      description: "General transport + logistics (all countries · NEX-scoped) · driver-hours (UK/EU WTD · US HOS · AU CoR) · hazmat (ADR/DOT/IMDG/IATA DGR) · vehicle roadworthiness · cross-border customs · unlicensed-carrier boundary · passenger safety · emergency routing · WAVE-S-7 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "transport",
      capabilities: ["transport_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["driver_hours_regulation", "hazmat_transport", "vehicle_roadworthiness", "cross_border_customs", "carrier_licensing", "passenger_safety", "transport_emergency_routing"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged · high-stakes operational domain",
    },
    {
      agent_id: "healthcare",
      name: "NEX Healthcare Specialist",
      description: "General healthcare / medical (all countries · NEX-scoped) · strict discipline: never diagnoses · never prescribes · always routes emergencies (UK 999 · US 911 · EU 112 · AU 000 · ID 112/119 · JP 119) · always routes mental-health crisis (UK Samaritans 116 123 · US 988 · AU 13 11 14 · ID 119 ext 8) · pregnancy + pediatric + medication-interaction boundaries · WAVE-S-6 · speaking-template · currently STOPPED-registered per Founder posture",
      version: "v0.1.0",
      lifecycle_state: "REGISTERED",
      domain: "healthcare",
      capabilities: ["healthcare_self_benchmark"],
      benchmark_suite_ref: null,
      knowledge_domains: ["medical_boundary", "emergency_routing", "mental_health_crisis_routing", "prescription_boundary", "pregnancy_medical", "pediatric_medical", "medication_interaction", "unsupported_medical_claims"],
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
      notes: "STOPPED-registered · desired_state=STOPPED · Founder posture unchanged · high-stakes domain · Phase 4 upgrade will require additional clinical-oversight discipline",
    },
  ];
  for (const seed of seeds) {
    const cur = existing.get(seed.agent_id);
    // Cheap identity check — skip if the visible seed fields already match.
    if (cur
      && cur.lifecycle_state === seed.lifecycle_state
      && cur.authorization_state === seed.authorization_state
      && cur.version === seed.version) continue;
    registerAgent(seed);
  }
}

/** Test hook · truncates the catalogue file. NEVER call in production. */
export function _resetCatalogueForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(agentCataloguePath())) fs.unlinkSync(agentCataloguePath()); } catch { /* ignore */ }
}
