// src/lib/nex/master-ai/agent-3state-report.ts
//
// NEX Master AI · 3-state agent status report
// Founder BEGIN 2026-09-08 · concurrent-work window during V.5.4.3-002
//
// Encodes doctrine_nex_observation_versus_capability_2026_09_08.md into
// a deterministic reporting helper.
//
// Every registered agent has THREE independent state axes that must be
// reported honestly (never conflated):
//   1. observation_state — is Master AI aware of this agent's identity?
//   2. runtime_state     — is the agent currently running?
//   3. capability_state  — what kind of work can the agent produce today?
//
// This helper is DERIVATION-ONLY. It never modifies any state · never
// writes any file · never invokes any subprocess. Pure read + classify.
//
// Doctrinal purpose: prevent conflation of "Master AI can see agent X" with
// "agent X is smart" or "agent X is running". These are separable facts.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { listAgents } from "./agent-registry";
import type { AgentCatalogueEntry, MasterAgentId } from "./types";

// ═══════════════════════════════════════════════════════════════════
// § A · STATE ENUMS
// ═══════════════════════════════════════════════════════════════════

export type ObservationState =
  | "visible"       // agent_id present in Master AI's registry catalogue
  | "invisible";    // agent_id NOT in catalogue (referenced elsewhere but Master AI cannot observe it)

export type RuntimeState =
  | "RUNNING"                 // heartbeat file exists AND fresh (<15s)
  | "STARTING"                // heartbeat status field is "STARTING"
  | "STOPPING"                // heartbeat status field is "STOPPING"
  | "STOPPED_HONEST"          // no heartbeat file (agent is deliberately not running · matches STOPPED-registered posture)
  | "STOPPED_STALE"           // heartbeat file exists but stale (>60s) · possible crash or forgotten process
  | "UNKNOWN";

export type CapabilityState =
  | "no_worker"                       // registry entry exists but no worker code in src/lib/nex/agent-runtime/
  | "has_worker_only"                 // worker exists but no self-benchmark corpus (bare speaking-template)
  | "has_deterministic_benchmark"     // worker + deterministic self-benchmark corpus + evaluator (Phase 3)
  | "has_llm_augmented"               // Phase 4 · worker uses LLM inference via gateway
  | "has_measured_l4_evidence"        // has at least one RunProvenance record from V.5.4.3+ controlled-instrument bakeoff
  | "unknown";

export type Agent3StateReport = {
  agent_id: MasterAgentId;
  registry: AgentCatalogueEntry | null;
  observation_state: ObservationState;
  runtime_state: RuntimeState;
  capability_state: CapabilityState;
  runtime_freshness_ms: number | null;
  runtime_status_hint?: string;         // raw status from heartbeat file when present
  capability_notes: string[];
  reported_at_iso: string;
};

// ═══════════════════════════════════════════════════════════════════
// § B · CAPABILITY MAP (deterministic · code-derived · never guessed)
// ═══════════════════════════════════════════════════════════════════
//
// Keyed by agent_id. Each entry declares the highest-earned capability
// tier AS OF 2026-09-08 based on what exists in the codebase. Adding a
// new tier to an agent requires updating this map in the same PR as the
// capability upgrade · never automatically.
//
// L4-measured evidence is DELIBERATELY set to "no" for every agent
// today · because V.5.4.3-001 failed for infrastructure reasons AND
// V.5.4.3-002 is still running as of doctrine write. Set to "yes" only
// when a real RunProvenance exists in data/l4-bakeoff/runs/ for that
// agent's actual L4 candidate (which for most specialists is TBD).

type CapabilitySpec = {
  worker_exists: boolean;
  deterministic_benchmark_exists: boolean;
  llm_augmented: boolean;
  has_measured_l4_evidence: boolean;
  notes: readonly string[];
};

const CAPABILITY_MAP: Readonly<Record<string, CapabilitySpec>> = Object.freeze({
  programmer: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // Phase D benchmark suite
    llm_augmented: false,                            // Phase G LLM code-gen NOT authorized
    has_measured_l4_evidence: false,                 // programmer is not a bakeoff candidate
    notes: [
      "Phase A-G disciplines active",
      "Phase G LLM code-mutation NOT authorized (deliberate)",
      "self-benchmark: programmer-benchmark corpora",
    ],
  },
  accommodation: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // A0-A3 GREEN
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: ["A0-A3 GREEN · canonical model + room types + attribute overlay", "A4-A9 pending"],
  },
  master_ai: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // observation + failure aggregation
    llm_augmented: false,                            // Master AI reasoning steps L4-blocked
    has_measured_l4_evidence: false,
    notes: ["orchestration layer above specialists", "reasoning steps L4-blocked"],
  },
  speaking: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // 60s self-benchmark active
    llm_augmented: false,                            // warmth-first LLM wording L4-blocked
    has_measured_l4_evidence: false,
    notes: ["speaking-template · WAVE-S baseline", "warmth-first LLM wording L4-blocked"],
  },
  vision: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-1
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: ["WAVE-S-1 · STOPPED-registered · Founder posture"],
  },
  travel: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-2
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: ["WAVE-S-2 · STOPPED-registered · Founder posture"],
  },
  business: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-3
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: ["WAVE-S-3 · STOPPED-registered · Founder posture"],
  },
  food: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-4 · 2026-09-08
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: ["WAVE-S-4 · STOPPED-registered · Founder posture"],
  },
  construction: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-5 · 2026-09-08 · staircase-aware
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: [
      "WAVE-S-5 · STOPPED-registered · Founder posture",
      "general (all countries) · NEX-scoped · staircase-aware (defers to staircase-* modules)",
    ],
  },
  healthcare: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-6 · 2026-09-08 · strict medical discipline
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: [
      "WAVE-S-6 · STOPPED-registered · Founder posture",
      "strict medical discipline: never diagnoses · never prescribes · routes emergencies + mental-health crisis",
      "Phase 4 upgrade requires additional clinical-oversight discipline",
    ],
  },
  transport: {
    worker_exists: true,
    deterministic_benchmark_exists: true,           // WAVE-S-7 · 2026-09-08
    llm_augmented: false,
    has_measured_l4_evidence: false,
    notes: [
      "WAVE-S-7 · STOPPED-registered · Founder posture",
      "operational-safety discipline: never encourages fatigued driving · never gives unlicensed hazmat advice · routes transport emergencies",
      "Phase 4 upgrade requires additional operator-oversight discipline",
    ],
  },
});

function classifyCapability(agent_id: string): { state: CapabilityState; notes: string[] } {
  const spec = CAPABILITY_MAP[agent_id];
  if (!spec) return { state: "unknown", notes: [`no capability spec for agent_id='${agent_id}' · add to CAPABILITY_MAP`] };
  if (spec.has_measured_l4_evidence) return { state: "has_measured_l4_evidence", notes: [...spec.notes] };
  if (spec.llm_augmented) return { state: "has_llm_augmented", notes: [...spec.notes] };
  if (spec.deterministic_benchmark_exists) return { state: "has_deterministic_benchmark", notes: [...spec.notes] };
  if (spec.worker_exists) return { state: "has_worker_only", notes: [...spec.notes] };
  return { state: "no_worker", notes: [...spec.notes] };
}

// ═══════════════════════════════════════════════════════════════════
// § C · RUNTIME STATE (from heartbeat file freshness)
// ═══════════════════════════════════════════════════════════════════

const HEARTBEAT_FRESH_MS = 15_000;         // heartbeat this recent → RUNNING
const HEARTBEAT_STALE_CUTOFF_MS = 60_000;  // beyond this → STOPPED_STALE (possible crash)

function agentRuntimeDir(): string {
  // Runtime dir is separate from Master AI dir · env override respected
  const override = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  if (override) return override;
  const cwd = process.cwd();
  return path.join(cwd, "data", "agent-runtime");
}

function classifyRuntime(agent_id: string): {
  state: RuntimeState;
  freshness_ms: number | null;
  status_hint?: string;
} {
  const dir = agentRuntimeDir();
  const hbFile = path.join(dir, `heartbeat-${agent_id}.json`);
  if (!existsSync(hbFile)) return { state: "STOPPED_HONEST", freshness_ms: null };
  let hb: Record<string, unknown>;
  try {
    hb = JSON.parse(readFileSync(hbFile, "utf8")) as Record<string, unknown>;
  } catch {
    return { state: "UNKNOWN", freshness_ms: null };
  }
  const tsIso = typeof hb.timestamp_iso === "string" ? hb.timestamp_iso : "";
  const status = typeof hb.status === "string" ? hb.status : undefined;
  if (!tsIso) return { state: "UNKNOWN", freshness_ms: null, status_hint: status };
  const parsed = Date.parse(tsIso);
  if (!Number.isFinite(parsed)) return { state: "UNKNOWN", freshness_ms: null, status_hint: status };
  const freshness_ms = Date.now() - parsed;
  if (status === "STARTING") return { state: "STARTING", freshness_ms, status_hint: status };
  if (status === "STOPPING") return { state: "STOPPING", freshness_ms, status_hint: status };
  if (freshness_ms <= HEARTBEAT_FRESH_MS) return { state: "RUNNING", freshness_ms, status_hint: status };
  if (freshness_ms >= HEARTBEAT_STALE_CUTOFF_MS) return { state: "STOPPED_STALE", freshness_ms, status_hint: status };
  // 15s–60s: ambiguous · treat as RUNNING with drift · caller can inspect freshness_ms
  return { state: "RUNNING", freshness_ms, status_hint: status };
}

// ═══════════════════════════════════════════════════════════════════
// § D · PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/** Report the 3-state status for a specific agent_id (whether or not
 *  registered). Returns observation_state=invisible when not registered. */
export function reportAgent3State(agent_id: string): Agent3StateReport {
  const registry = listAgents().find((a) => a.agent_id === agent_id) ?? null;
  const observation_state: ObservationState = registry ? "visible" : "invisible";
  const runtime = classifyRuntime(agent_id);
  const capability = classifyCapability(agent_id);
  return {
    agent_id,
    registry,
    observation_state,
    runtime_state: runtime.state,
    capability_state: capability.state,
    runtime_freshness_ms: runtime.freshness_ms,
    runtime_status_hint: runtime.status_hint,
    capability_notes: capability.notes,
    reported_at_iso: new Date().toISOString(),
  };
}

/** Report every currently-registered agent (per Master AI's catalogue).
 *  Sorted by agent_id for deterministic output. */
export function reportAllRegisteredAgents3State(): Agent3StateReport[] {
  const ids = listAgents().map((a) => a.agent_id).sort();
  return ids.map(reportAgent3State);
}

/** Aggregate 3-state summary suitable for the top of a Master AI report.
 *  Never claims what it hasn't measured. */
export function summarize3StateReport(reports: readonly Agent3StateReport[]): {
  total_agents: number;
  observable: number;
  running: number;
  stopped_honest: number;
  stopped_stale: number;
  with_deterministic_benchmark: number;
  with_llm_augmented: number;
  with_measured_l4_evidence: number;
  worker_only: number;
  no_worker: number;
} {
  return {
    total_agents: reports.length,
    observable: reports.filter((r) => r.observation_state === "visible").length,
    running: reports.filter((r) => r.runtime_state === "RUNNING").length,
    stopped_honest: reports.filter((r) => r.runtime_state === "STOPPED_HONEST").length,
    stopped_stale: reports.filter((r) => r.runtime_state === "STOPPED_STALE").length,
    with_deterministic_benchmark: reports.filter((r) => r.capability_state === "has_deterministic_benchmark").length,
    with_llm_augmented: reports.filter((r) => r.capability_state === "has_llm_augmented").length,
    with_measured_l4_evidence: reports.filter((r) => r.capability_state === "has_measured_l4_evidence").length,
    worker_only: reports.filter((r) => r.capability_state === "has_worker_only").length,
    no_worker: reports.filter((r) => r.capability_state === "no_worker").length,
  };
}

