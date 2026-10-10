// src/lib/nex-agent/code-engine/hypothesis/capability-hypothesis-store.ts
//
// NEX1 · Hypothesis Store · Ledger B substrate.
//
// STRICT SCOPE (founder directive · 2026-09-18):
//   · This file is a STORE only.
//   · It does NOT generate hypotheses.
//   · It does NOT contain hypothesis templates.
//   · It does NOT map evidence to hypothesis kinds.
//   · It contains ONLY the schema fields from Section 10 of the mission,
//     plus writer/reader utilities.
//
// If nothing in the runtime autonomously WRITES to this store, the store
// remains empty. That is the point.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "../capability-agent-registry";

registerAgent({
  id: "hypothesis_store",
  name: "Hypothesis Store · append-only",
  cognitive_layer: "hypothesis_and_experimentation",
  description: "Append-only store for hypothesis records. Contains only schema fields; does not generate or interpret. Section 10 compliance.",
});

// ── Public schema · exactly as specified in Section 10 ────────────────

export type HypothesisStatus = "PROPOSED" | "TESTING" | "SUPPORTED" | "REJECTED" | "UNRESOLVED";

export interface HypothesisRecord {
  readonly hypothesis_id: string;
  readonly timestamp: string;
  readonly source_agent: string;                 // which agent authored the write
  readonly evidence_refs: readonly string[];     // ids of experience records the hypothesis rests on
  readonly observation_pattern: string;          // caller-supplied string · not interpreted here
  readonly proposed_relationship: string;        // caller-supplied
  readonly expected_observation: string;         // caller-supplied
  readonly counterexample_condition: string;     // caller-supplied
  readonly confidence: number;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly status: HypothesisStatus;
  readonly experiments_run: readonly string[];   // ids of experiments performed against this hypothesis
}

// ── Path ──────────────────────────────────────────────────────────────

export function getHypothesisStorePath(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-hypotheses", "entries.jsonl");
}

// ── Writer ────────────────────────────────────────────────────────────

/**
 * Append a hypothesis record. This is the ONLY entry-point. Any caller
 * that writes here must be a NEX-side agent producing a hypothesis from
 * its own reasoning · Claude / test harness / experiment orchestrator
 * writes here would be Ledger B and must be labelled as such.
 */
export function writeHypothesis(args: {
  readonly source_agent: string;
  readonly evidence_refs: readonly string[];
  readonly observation_pattern: string;
  readonly proposed_relationship: string;
  readonly expected_observation: string;
  readonly counterexample_condition: string;
  readonly confidence: number;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly repo_root?: string;
}): HypothesisRecord {
  const rec: HypothesisRecord = {
    hypothesis_id: "hyp_" + crypto.randomBytes(6).toString("hex"),
    timestamp: new Date().toISOString(),
    source_agent: args.source_agent,
    evidence_refs: args.evidence_refs,
    observation_pattern: args.observation_pattern,
    proposed_relationship: args.proposed_relationship,
    expected_observation: args.expected_observation,
    counterexample_condition: args.counterexample_condition,
    confidence: args.confidence,
    provenance: args.provenance,
    status: "PROPOSED",
    experiments_run: [],
  };
  const p = getHypothesisStorePath(args.repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(rec) + "\n", "utf8");
  recordHeartbeat({
    agent_id: "hypothesis_store",
    event_type: "write_hypothesis",
    event_data: { source_agent: args.source_agent, hypothesis_id: rec.hypothesis_id },
  });
  return rec;
}

/** Attach an experiment id to a hypothesis · append-only journal entry. */
export function attachExperimentId(hypothesis_id: string, experiment_id: string, repo_root?: string): void {
  const p = getHypothesisStorePath(repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const journal = { journal_type: "attach_experiment", hypothesis_id, experiment_id, timestamp: new Date().toISOString() };
  fs.appendFileSync(p, JSON.stringify(journal) + "\n", "utf8");
}

/**
 * Update a hypothesis's status (SUPPORTED/REJECTED/UNRESOLVED). The
 * verifier is the only caller that should invoke this. We keep it
 * append-only by writing a journal record; readers apply status changes
 * during load.
 */
export function updateHypothesisStatus(hypothesis_id: string, new_status: HypothesisStatus, repo_root?: string): void {
  const p = getHypothesisStorePath(repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const journal = { journal_type: "status_update", hypothesis_id, new_status, timestamp: new Date().toISOString() };
  fs.appendFileSync(p, JSON.stringify(journal) + "\n", "utf8");
  recordHeartbeat({
    agent_id: "hypothesis_store",
    event_type: "update_status",
    event_data: { hypothesis_id, new_status },
  });
}

// ── Reader ────────────────────────────────────────────────────────────

export function loadAllHypotheses(repo_root?: string): readonly HypothesisRecord[] {
  const p = getHypothesisStorePath(repo_root);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const journal_updates = new Map<string, HypothesisStatus>();
  const experiments_by_hyp = new Map<string, string[]>();
  const records: HypothesisRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
    if (obj.journal_type === "status_update") {
      journal_updates.set(obj.hypothesis_id as string, obj.new_status as HypothesisStatus);
    } else if (obj.journal_type === "attach_experiment") {
      const arr = experiments_by_hyp.get(obj.hypothesis_id as string) ?? [];
      arr.push(obj.experiment_id as string);
      experiments_by_hyp.set(obj.hypothesis_id as string, arr);
    } else if (obj.hypothesis_id) {
      records.push(obj as unknown as HypothesisRecord);
    }
  }
  // Apply status updates deterministically (last write wins)
  return records.map((r) => ({
    ...r,
    status: journal_updates.get(r.hypothesis_id) ?? r.status,
    experiments_run: [...(r.experiments_run ?? []), ...(experiments_by_hyp.get(r.hypothesis_id) ?? [])],
  }));
}

export const HYPOTHESIS_STORE_VERSION = "hypothesis-store.v1";
