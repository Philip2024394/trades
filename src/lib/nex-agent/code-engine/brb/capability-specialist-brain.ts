// src/lib/nex-agent/code-engine/brb/capability-specialist-brain.ts
//
// NEX1 · Brain Recovery & Builder Network · Phase 1-4 foundation.
//
// This module provides:
//   · SpecialistBrain: base persistent structure (Section 4)
//   · Common specialist interface (Section 6)
//   · Isolated per-specialist mini-brain directory (Section 3)
//   · Independent heartbeat (Section 5)
//   · Register with existing Cortex/agent-registry (Section 17)
//
// Constitutional invariants preserved:
//   · Zero LLM.
//   · Recommend, do not execute (Section 6).
//   · Deterministic. No LLM calls.
//   · Existing safety unchanged.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "../capability-agent-registry";

// ── Base types (Section 4) ─────────────────────────────────────────────

export type SpecialistStatus = "ACTIVE" | "IDLE" | "WAITING" | "DEGRADED" | "QUARANTINED";

export interface SpecialistBrainMeta {
  readonly brain_id: string;
  readonly specialist_id: string;
  readonly version: string;
  readonly knowledge_store: string;
  readonly experience_store: string;
  readonly observation_store: string;
  readonly decision_store: string;
  readonly hypothesis_store: string;
  readonly outcome_store: string;
  readonly heartbeat_interval_ms: number;
  status: SpecialistStatus;
  readonly capabilities: readonly string[];
  readonly safety_level: string;
  last_heartbeat: string;
}

// ── Common specialist interfaces (Section 6) ──────────────────────────

export interface Observation {
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}

export interface Analysis {
  readonly specialist_id: string;
  readonly kind: string;
  readonly findings: Readonly<Record<string, unknown>>;
  readonly confidence: number;
  readonly evidence_ids: readonly string[];
  readonly timestamp: string;
  readonly evidence_kind: "OBSERVED" | "INFERRED";
}

export interface Hypothesis {
  readonly specialist_id: string;
  readonly kind: string;
  readonly statement: string;
  readonly evidence_ids: readonly string[];
  readonly confidence: number;
  readonly timestamp: string;
}

export interface Recommendation {
  readonly specialist_id: string;
  readonly kind: string;
  readonly action_class: "PROPOSAL_ONLY";
  readonly detail: Readonly<Record<string, unknown>>;
  readonly evidence_ids: readonly string[];
  readonly requires_approval: true; // Always. Specialists do not execute.
  readonly timestamp: string;
}

export interface Capability {
  readonly id: string;
  readonly kind: string;
  readonly maturity: "PRIMITIVE" | "DEVELOPING" | "MATURE" | "TRANSFER_READY";
  readonly description: string;
}

export interface Heartbeat {
  readonly brain_id: string;
  readonly specialist_id: string;
  readonly timestamp: string;
  readonly status: SpecialistStatus;
  readonly stores_available: boolean;
  readonly pending_tasks: number;
  readonly last_success: string | null;
  readonly last_failure: string | null;
  readonly capability_count: number;
}

export interface RetrievedExperience {
  readonly id: string;
  readonly source: string;
  readonly summary: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}

export interface ExperienceInput {
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly source_evidence_ids?: readonly string[];
}

export interface OutcomeInput {
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly related_decision_id?: string | null;
}

export interface NEXSpecialistBrain {
  readonly meta: SpecialistBrainMeta;
  observe(input: Observation): Observation;
  analyse(input: unknown): Analysis;
  retrieve(query: { readonly kind?: string; readonly limit?: number }): readonly RetrievedExperience[];
  hypothesise(input: unknown): readonly Hypothesis[];
  recommend(input: unknown): Recommendation;
  recordExperience(experience: ExperienceInput): void;
  recordOutcome(outcome: OutcomeInput): void;
  heartbeat(): Heartbeat;
  capabilities(): readonly Capability[];
  status(): SpecialistStatus;
  /** Read-only view of one of the specialist's own stores. */
  readOwnStore(which: StoreName, opts?: { readonly limit?: number }): readonly Readonly<Record<string, unknown>>[];
}

export type StoreName = "knowledge" | "experience" | "observations" | "decisions" | "hypotheses" | "outcomes";

// ── Config for specialist factory ─────────────────────────────────────

export interface SpecialistFactoryConfig {
  readonly specialist_id: string;
  readonly domain: string;
  readonly description: string;
  readonly capabilities: readonly Capability[];
  readonly safety_level?: string;
  readonly cognitive_layer?: string;
  readonly version?: string;
  readonly heartbeat_interval_ms?: number;
  readonly repo_root?: string;

  // Role-specific handlers (overridable). Base factory provides deterministic no-op stubs.
  readonly onAnalyse?: (input: unknown, ctx: SpecialistContext) => Omit<Analysis, "specialist_id" | "timestamp">;
  readonly onHypothesise?: (input: unknown, ctx: SpecialistContext) => readonly Omit<Hypothesis, "specialist_id" | "timestamp">[];
  readonly onRecommend?: (input: unknown, ctx: SpecialistContext) => Omit<Recommendation, "specialist_id" | "timestamp" | "action_class" | "requires_approval">;
}

export interface SpecialistContext {
  readonly specialist_id: string;
  readonly readOwnStore: (which: StoreName, opts?: { readonly limit?: number }) => readonly Readonly<Record<string, unknown>>[];
  readonly appendStore: (which: StoreName, record: Readonly<Record<string, unknown>>) => void;
  readonly meta: SpecialistBrainMeta;
}

// ── Path helpers (Section 3) ──────────────────────────────────────────

export function getNetworkRoot(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-brain-recovery");
}
export function getSpecialistRoot(specialist_id: string, repo_root?: string): string {
  return path.join(getNetworkRoot(repo_root), specialist_id);
}
export function getStorePath(specialist_id: string, which: StoreName, repo_root?: string): string {
  return path.join(getSpecialistRoot(specialist_id, repo_root), which === "observations" ? "observations.jsonl" : which + ".jsonl");
}
export function getBrainJsonPath(specialist_id: string, repo_root?: string): string {
  return path.join(getSpecialistRoot(specialist_id, repo_root), "brain.json");
}
export function getHeartbeatPath(specialist_id: string, repo_root?: string): string {
  return path.join(getSpecialistRoot(specialist_id, repo_root), "heartbeat.json");
}

// ── Store helpers ─────────────────────────────────────────────────────

function ensureStore(specialist_id: string, which: StoreName, repo_root?: string) {
  const p = getStorePath(specialist_id, which, repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, "", "utf8");
}
function appendStore(specialist_id: string, which: StoreName, record: Readonly<Record<string, unknown>>, repo_root?: string) {
  ensureStore(specialist_id, which, repo_root);
  const p = getStorePath(specialist_id, which, repo_root);
  fs.appendFileSync(p, JSON.stringify(record) + "\n", "utf8");
}
function readStore(specialist_id: string, which: StoreName, opts?: { readonly limit?: number }, repo_root?: string): readonly Record<string, unknown>[] {
  const p = getStorePath(specialist_id, which, repo_root);
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const parsed: Record<string, unknown>[] = [];
  for (const line of lines) {
    try { parsed.push(JSON.parse(line) as Record<string, unknown>); } catch { /* skip corrupted line */ }
  }
  if (opts?.limit && parsed.length > opts.limit) return parsed.slice(parsed.length - opts.limit);
  return parsed;
}

// ── Factory (creates a specialist mini-brain) ─────────────────────────

export function createSpecialistBrain(cfg: SpecialistFactoryConfig): NEXSpecialistBrain {
  const version = cfg.version ?? "specialist.v1";
  const heartbeat_interval_ms = cfg.heartbeat_interval_ms ?? 60_000;
  const brain_id = "brb_" + cfg.specialist_id;
  const repo_root = cfg.repo_root;

  // Ensure all 6 stores + directory exist (Section 3)
  const stores: readonly StoreName[] = ["knowledge", "experience", "observations", "decisions", "hypotheses", "outcomes"];
  for (const w of stores) ensureStore(cfg.specialist_id, w, repo_root);

  // brain.json
  const brainJsonPath = getBrainJsonPath(cfg.specialist_id, repo_root);
  const meta: SpecialistBrainMeta = {
    brain_id,
    specialist_id: cfg.specialist_id,
    version,
    knowledge_store: getStorePath(cfg.specialist_id, "knowledge", repo_root),
    experience_store: getStorePath(cfg.specialist_id, "experience", repo_root),
    observation_store: getStorePath(cfg.specialist_id, "observations", repo_root),
    decision_store: getStorePath(cfg.specialist_id, "decisions", repo_root),
    hypothesis_store: getStorePath(cfg.specialist_id, "hypotheses", repo_root),
    outcome_store: getStorePath(cfg.specialist_id, "outcomes", repo_root),
    heartbeat_interval_ms,
    status: "ACTIVE",
    capabilities: cfg.capabilities.map((c) => c.id),
    safety_level: cfg.safety_level ?? "RECOMMEND_ONLY",
    last_heartbeat: new Date().toISOString(),
  };
  fs.writeFileSync(brainJsonPath, JSON.stringify(meta, null, 2), "utf8");

  // Register with existing agent-registry (Section 17)
  registerAgent({
    id: cfg.specialist_id,
    name: "BRB · " + cfg.domain,
    cognitive_layer: cfg.cognitive_layer ?? "brain_recovery_specialist",
    description: cfg.description,
  });

  const ctx: SpecialistContext = {
    specialist_id: cfg.specialist_id,
    readOwnStore: (which, opts) => readStore(cfg.specialist_id, which, opts, repo_root),
    appendStore: (which, record) => appendStore(cfg.specialist_id, which, record, repo_root),
    meta,
  };

  const capabilitiesArr = cfg.capabilities.map((c) => ({ ...c }));

  function nowIso() { return new Date().toISOString(); }
  function idFor(kind: string): string { return kind + "_" + crypto.randomBytes(6).toString("hex"); }

  const specialist: NEXSpecialistBrain = {
    meta,

    observe(input: Observation): Observation {
      const obs = { ...input, id: idFor("obs") };
      appendStore(cfg.specialist_id, "observations", obs, repo_root);
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "observe", event_data: { kind: input.kind } });
      return input;
    },

    analyse(input: unknown): Analysis {
      const base = cfg.onAnalyse
        ? cfg.onAnalyse(input, ctx)
        : { kind: "no_op", findings: {}, confidence: 0, evidence_ids: [], evidence_kind: "INFERRED" as const };
      const out: Analysis = { specialist_id: cfg.specialist_id, timestamp: nowIso(), ...base };
      // NOT persisted here; caller decides via recordExperience/recordOutcome
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "analyse", event_data: { kind: out.kind, confidence: out.confidence } });
      return out;
    },

    retrieve(query): readonly RetrievedExperience[] {
      const experiences = readStore(cfg.specialist_id, "experience", { limit: query.limit }, repo_root);
      return experiences
        .filter((e) => !query.kind || (e as { kind?: string }).kind === query.kind)
        .map((e) => ({
          id: String((e as { id?: unknown }).id ?? ""),
          source: String((e as { source?: unknown }).source ?? cfg.specialist_id),
          summary: String((e as { summary?: unknown }).summary ?? (e as { kind?: unknown }).kind ?? ""),
          data: (e as { data?: Record<string, unknown> }).data ?? {},
          timestamp: String((e as { timestamp?: unknown }).timestamp ?? ""),
        }));
    },

    hypothesise(input: unknown): readonly Hypothesis[] {
      const raw = cfg.onHypothesise ? cfg.onHypothesise(input, ctx) : [];
      const out = raw.map((h) => ({ specialist_id: cfg.specialist_id, timestamp: nowIso(), ...h }));
      for (const h of out) appendStore(cfg.specialist_id, "hypotheses", { ...h, id: idFor("hyp") }, repo_root);
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "hypothesise", event_data: { count: out.length } });
      return out;
    },

    recommend(input: unknown): Recommendation {
      const base = cfg.onRecommend
        ? cfg.onRecommend(input, ctx)
        : { kind: "no_op", detail: {}, evidence_ids: [] };
      const rec: Recommendation = {
        specialist_id: cfg.specialist_id,
        timestamp: nowIso(),
        action_class: "PROPOSAL_ONLY",
        requires_approval: true,
        ...base,
      };
      appendStore(cfg.specialist_id, "decisions", { ...rec, id: idFor("rec") }, repo_root);
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "recommend", event_data: { kind: rec.kind } });
      return rec;
    },

    recordExperience(experience: ExperienceInput): void {
      const rec = {
        id: idFor("exp"),
        specialist_id: cfg.specialist_id,
        kind: experience.kind,
        data: experience.data,
        source_evidence_ids: experience.source_evidence_ids ?? [],
        timestamp: nowIso(),
      };
      appendStore(cfg.specialist_id, "experience", rec, repo_root);
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "record_experience", event_data: { kind: experience.kind } });
    },

    recordOutcome(outcome: OutcomeInput): void {
      const rec = {
        id: idFor("out"),
        specialist_id: cfg.specialist_id,
        kind: outcome.kind,
        data: outcome.data,
        related_decision_id: outcome.related_decision_id ?? null,
        timestamp: nowIso(),
      };
      appendStore(cfg.specialist_id, "outcomes", rec, repo_root);
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "record_outcome", event_data: { kind: outcome.kind } });
    },

    heartbeat(): Heartbeat {
      // Actually inspect the stores (Section 5)
      const storesOk = stores.every((s) => fs.existsSync(getStorePath(cfg.specialist_id, s, repo_root)));
      const last_success = readStore(cfg.specialist_id, "outcomes", { limit: 1 }, repo_root)[0] as { timestamp?: string } | undefined;
      const experiences = readStore(cfg.specialist_id, "experience", undefined, repo_root);
      const outcomes = readStore(cfg.specialist_id, "outcomes", undefined, repo_root);
      const failures = outcomes.filter((o) => String((o as { kind?: unknown }).kind ?? "").includes("fail"));
      const last_failure = failures[failures.length - 1] as { timestamp?: string } | undefined;
      const hb: Heartbeat = {
        brain_id,
        specialist_id: cfg.specialist_id,
        timestamp: nowIso(),
        status: storesOk ? meta.status : "DEGRADED",
        stores_available: storesOk,
        pending_tasks: experiences.length - outcomes.length > 0 ? experiences.length - outcomes.length : 0,
        last_success: last_success?.timestamp ?? null,
        last_failure: last_failure?.timestamp ?? null,
        capability_count: capabilitiesArr.length,
      };
      // Persist to heartbeat.json
      fs.writeFileSync(getHeartbeatPath(cfg.specialist_id, repo_root), JSON.stringify(hb, null, 2), "utf8");
      meta.last_heartbeat = hb.timestamp;
      // Also mirror to the central agent-registry heartbeat store
      recordHeartbeat({ agent_id: cfg.specialist_id, event_type: "heartbeat", event_data: { status: hb.status, pending: hb.pending_tasks } });
      return hb;
    },

    capabilities(): readonly Capability[] { return capabilitiesArr; },
    status(): SpecialistStatus { return meta.status; },
    readOwnStore(which, opts) { return readStore(cfg.specialist_id, which, opts, repo_root); },
  };

  // Initial heartbeat
  specialist.heartbeat();
  return specialist;
}

export const SPECIALIST_BRAIN_FACTORY_VERSION = "specialist-brain.v1";
