// src/lib/nex-agent/code-engine/capability-agent-registry.ts
//
// NEX1 · Central Agent Registry + Per-Agent Database + Heartbeat.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Give every cognitive/infrastructure agent in the NEX1 brain:
//     1. Its own append-only JSONL database at
//        `data/nex1-agent-registry/agent-dbs/{agent_id}.jsonl`
//     2. A heartbeat file at
//        `data/nex1-agent-registry/heartbeats/{agent_id}.json`
//     3. An entry in the central catalog at
//        `data/nex1-agent-registry/agents.json`
//
//   Provides:
//     - registerAgent({ id, name, cognitive_layer, description })
//     - recordHeartbeat({ agent_id, event_type, event_data })
//     - getRegistrySnapshot() — full state for health probes
//
// CONSTITUTIONAL PRESERVATION
//   - Zero LLM. Deterministic. Append-only for JSONL databases.
//   - Heartbeat file is a single JSON object (overwritten on each beat) —
//     it represents CURRENT liveness, not history. History is in the JSONL.
//   - R11-B: the registry itself never enters R-4 SUPPORTING count. It is
//     observational infrastructure, not evidence.
//   - Failures are silent (never throw upstream). A missing DB dir is
//     created lazily; write failures are captured in in-process errors[]
//     and never poison the caller's turn.
//   - No modification of Q7/Q8/Fix 23a/b/c/Schema V1/Fix 17.

import fs from "node:fs";
import path from "node:path";

// ── Public shape ─────────────────────────────────────────────────────────

export type CognitiveLayer =
  | "perception"
  | "attention_salience"
  | "working_memory"
  | "episodic_memory"
  | "semantic_memory"
  | "procedural_memory"
  | "reasoning"
  | "metacognition"
  | "execution"
  | "verification"
  | "learning_signal"
  | "safety"
  | "infrastructure_orchestrator"
  | "infrastructure_authority"
  | "infrastructure_registry"
  | "infrastructure_telemetry";

export interface AgentCatalogEntry {
  readonly agent_id: string;
  readonly name: string;
  readonly cognitive_layer: CognitiveLayer;
  readonly description: string;
  readonly registered_at: string;
  readonly db_path: string;
  readonly heartbeat_path: string;
}

export interface HeartbeatEvent {
  readonly agent_id: string;
  readonly event_type: string;
  readonly event_data?: Readonly<Record<string, unknown>>;
  /** Deterministic timestamp override for tests. */
  readonly timestamp?: string;
}

export interface HeartbeatFile {
  readonly agent_id: string;
  readonly last_beat_at: string;
  readonly last_event_type: string;
  readonly total_beats: number;
}

export interface RegistrySnapshot {
  readonly root: string;
  readonly agents: readonly AgentCatalogEntry[];
  readonly heartbeats: Readonly<Record<string, HeartbeatFile | null>>;
  readonly db_sizes: Readonly<Record<string, number>>;
}

// ── Filesystem layout ────────────────────────────────────────────────────

export function getRegistryRoot(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-agent-registry");
}

function getAgentsCatalogPath(repo_root?: string): string {
  return path.join(getRegistryRoot(repo_root), "agents.json");
}

function getAgentDbPath(agent_id: string, repo_root?: string): string {
  return path.join(getRegistryRoot(repo_root), "agent-dbs", `${agent_id}.jsonl`);
}

function getAgentHeartbeatPath(agent_id: string, repo_root?: string): string {
  return path.join(getRegistryRoot(repo_root), "heartbeats", `${agent_id}.json`);
}

function ensureDirs(repo_root?: string): void {
  const root = getRegistryRoot(repo_root);
  const dbs = path.join(root, "agent-dbs");
  const beats = path.join(root, "heartbeats");
  for (const d of [root, dbs, beats]) {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch {
      /* silent per contract */
    }
  }
}

// ── In-process error capture (never thrown) ─────────────────────────────

interface RegistryProcessState {
  errors: string[];
  beat_counts: Map<string, number>;
}
const STATE_KEY = "__NEX1_AGENT_REGISTRY_STATE__";
type GT = typeof globalThis & { [STATE_KEY]?: RegistryProcessState };
function getState(): RegistryProcessState {
  const g = globalThis as GT;
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = { errors: [], beat_counts: new Map() };
  }
  return g[STATE_KEY]!;
}

export function getRegistryErrors(): readonly string[] {
  return [...getState().errors];
}
export function _resetRegistryErrorsForTests(): void {
  getState().errors.length = 0;
  getState().beat_counts.clear();
}

// ── Register ─────────────────────────────────────────────────────────────

export interface RegisterAgentInput {
  readonly id: string;
  readonly name: string;
  readonly cognitive_layer: CognitiveLayer;
  readonly description: string;
  readonly repo_root?: string;
}

export function registerAgent(input: RegisterAgentInput): AgentCatalogEntry {
  ensureDirs(input.repo_root);
  const catalogPath = getAgentsCatalogPath(input.repo_root);
  let catalog: AgentCatalogEntry[] = [];
  try {
    if (fs.existsSync(catalogPath)) {
      const raw = fs.readFileSync(catalogPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) catalog = parsed as AgentCatalogEntry[];
    }
  } catch (err) {
    getState().errors.push(
      `registry · catalog read failed · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    );
  }
  const existing = catalog.find((e) => e.agent_id === input.id);
  if (existing) return existing;

  const entry: AgentCatalogEntry = {
    agent_id: input.id,
    name: input.name,
    cognitive_layer: input.cognitive_layer,
    description: input.description,
    registered_at: new Date().toISOString(),
    db_path: getAgentDbPath(input.id, input.repo_root),
    heartbeat_path: getAgentHeartbeatPath(input.id, input.repo_root),
  };
  catalog.push(entry);
  try {
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf8");
  } catch (err) {
    getState().errors.push(
      `registry · catalog write failed · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    );
  }
  return entry;
}

// ── Heartbeat ────────────────────────────────────────────────────────────

export function recordHeartbeat(input: HeartbeatEvent & { repo_root?: string }): void {
  ensureDirs(input.repo_root);
  const timestamp = input.timestamp ?? new Date().toISOString();

  const dbPath = getAgentDbPath(input.agent_id, input.repo_root);
  const beatPath = getAgentHeartbeatPath(input.agent_id, input.repo_root);

  // Append to per-agent JSONL DB.
  const dbEntry = {
    agent_id: input.agent_id,
    event_type: input.event_type,
    event_data: input.event_data ?? null,
    timestamp,
  };
  try {
    fs.appendFileSync(dbPath, JSON.stringify(dbEntry) + "\n", "utf8");
  } catch (err) {
    getState().errors.push(
      `registry · db write failed · ${input.agent_id} · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    );
  }

  // Update heartbeat file (current-state, overwritten).
  const total = (getState().beat_counts.get(input.agent_id) ?? 0) + 1;
  getState().beat_counts.set(input.agent_id, total);
  const hb: HeartbeatFile = {
    agent_id: input.agent_id,
    last_beat_at: timestamp,
    last_event_type: input.event_type,
    total_beats: total,
  };
  try {
    fs.writeFileSync(beatPath, JSON.stringify(hb, null, 2), "utf8");
  } catch (err) {
    getState().errors.push(
      `registry · beat write failed · ${input.agent_id} · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    );
  }
}

// ── Snapshot (health probe consumer) ─────────────────────────────────────

export function getRegistrySnapshot(repo_root?: string): RegistrySnapshot {
  const root = getRegistryRoot(repo_root);
  ensureDirs(repo_root);
  const catalogPath = getAgentsCatalogPath(repo_root);
  let agents: AgentCatalogEntry[] = [];
  try {
    if (fs.existsSync(catalogPath)) {
      const raw = fs.readFileSync(catalogPath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) agents = parsed as AgentCatalogEntry[];
    }
  } catch (err) {
    getState().errors.push(
      `registry · snapshot catalog read failed · ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`,
    );
  }
  const heartbeats: Record<string, HeartbeatFile | null> = {};
  const db_sizes: Record<string, number> = {};
  for (const a of agents) {
    heartbeats[a.agent_id] = null;
    db_sizes[a.agent_id] = 0;
    try {
      if (fs.existsSync(a.heartbeat_path)) {
        const raw = fs.readFileSync(a.heartbeat_path, "utf8");
        heartbeats[a.agent_id] = JSON.parse(raw) as HeartbeatFile;
      }
    } catch {
      /* silent per contract */
    }
    try {
      if (fs.existsSync(a.db_path)) {
        const stat = fs.statSync(a.db_path);
        db_sizes[a.agent_id] = stat.size;
      }
    } catch {
      /* silent per contract */
    }
  }
  return {
    root,
    agents,
    heartbeats,
    db_sizes,
  };
}

// ── Convenience: register the 16 cognitive-lattice agents at import time ──
//
// This produces a canonical roster whether or not any of them has fired
// this session. Heartbeats stay null until each actually records one at
// runtime. Idempotent — registerAgent skips if already present.

export function ensureCanonicalAgentsRegistered(repo_root?: string): void {
  const roster: Omit<RegisterAgentInput, "repo_root">[] = [
    // 12 cognitive-function agents
    { id: "perception", name: "Perception (classifier + paraphrase)", cognitive_layer: "perception", description: "Turn-1 intent classification, paraphrase, target extraction." },
    { id: "attention_salience", name: "Attention · Salience (Fix 25)", cognitive_layer: "attention_salience", description: "Salience switch · adjacent-test detection · promotion gate." },
    { id: "working_memory", name: "Working Memory (ConversationHead)", cognitive_layer: "working_memory", description: "Per-turn scratchpad · bindings · threads · turn history." },
    { id: "episodic_memory", name: "Episodic Memory (Fix 17 + Fix 26)", cognitive_layer: "episodic_memory", description: "Investigation-conclusion JSONL write + read." },
    { id: "semantic_memory", name: "Semantic Memory (target discovery)", cognitive_layer: "semantic_memory", description: "Repo-wide identifier scan · Batch 2B." },
    { id: "procedural_memory", name: "Procedural Memory (Fix 30 aggregator)", cognitive_layer: "procedural_memory", description: "Cross-session prior-context aggregator." },
    { id: "reasoning", name: "Reasoning (investigation + Q7/Q8)", cognitive_layer: "reasoning", description: "Native investigation · ranking · selection." },
    { id: "metacognition_concern", name: "Metacognition · Concern", cognitive_layer: "metacognition", description: "Risk-signal aggregator (Concern.v1)." },
    { id: "metacognition_afraid", name: "Metacognition · Afraid", cognitive_layer: "metacognition", description: "Session-mood assessor from turn history." },
    { id: "execution", name: "Execution (Fix 23a operator + spec loop)", cognitive_layer: "execution", description: "Deterministic mutation operator + spec-driven-loop." },
    { id: "verification", name: "Verification (Fix 23c preservation)", cognitive_layer: "verification", description: "Post-mutation preservation-check + auto-revert." },
    { id: "learning_signal", name: "Learning Signal (Fix 31 broadcast)", cognitive_layer: "learning_signal", description: "Feedback event pub-sub for cross-agent signal." },
    // Safety boundary agent
    { id: "safety_fear", name: "Safety · Fear (boundary agent)", cognitive_layer: "safety", description: "Protected-path + cross-repo + preservation gate." },
    // Extras: Fix 30B comparator + speaker intent + agent selector
    { id: "prior_evidence_comparator", name: "Prior-Evidence Comparator (Fix 30B)", cognitive_layer: "learning_signal", description: "Structural RELATIONSHIP classifier between prior & current." },
    { id: "class2_bridge", name: "Class 2 Bridge (Fix 24)", cognitive_layer: "attention_salience", description: "Failing-test → ExpectedBehaviour translator." },
    { id: "speaker_intent", name: "Speaker-Intent (Fix 29)", cognitive_layer: "perception", description: "Pragmatic inference of coding vs investigation intent." },
    { id: "investigation_to_agent", name: "Investigation → Agent Selector (Batch 2C)", cognitive_layer: "infrastructure_orchestrator", description: "Deterministic rule-based next-agent chooser." },
    // Infrastructure
    { id: "chat_turn_orchestrator", name: "Chat-Turn Orchestrator", cognitive_layer: "infrastructure_orchestrator", description: "The conductor · assembles all cognitive layers per turn." },
    { id: "agent_registry", name: "Agent Registry (self)", cognitive_layer: "infrastructure_registry", description: "This module. Records its own heartbeats too." },
  ];
  for (const r of roster) {
    registerAgent({ ...r, repo_root });
  }
}

export const AGENT_REGISTRY_VERSION = "registry.v1";
