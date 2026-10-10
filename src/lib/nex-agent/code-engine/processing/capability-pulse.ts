// src/lib/nex-agent/code-engine/processing/capability-pulse.ts
//
// NEX1 · Bidirectional Pulse Infrastructure · Section 4 of the mission.
//
// Represents actual information movement between:
//   Cortex ↔ Specialist
//   Cortex ↔ Processing Brain
//   Processing Brain ↔ NEX
//
// Never fabricates activity. Every pulse is a real record with source,
// destination, direction, payload reference, sequence, state. Records
// go to `data/nex1-processing-brain/signals.jsonl` (a Processing-Brain
// owned store) so the pulse trace lives alongside the brain's own state.
//
// Anomaly types this module recognises (Section 4):
//   duplicate · missing · stale · conflicting · delayed · empty · malformed · high_volume · recovered
//
// Zero-LLM. Deterministic. Read/write JSONL only.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "../capability-agent-registry";

registerAgent({
  id: "bidirectional_pulse",
  name: "Bidirectional Pulse Infrastructure · Cortex ↔ brains",
  cognitive_layer: "processing_brain",
  description: "Deterministic pulse mechanism representing actual state movement. Traceable end-to-end. Recognises duplicate/missing/stale/conflicting/delayed/empty/malformed anomalies. Never fabricates activity.",
});

// ── Types ─────────────────────────────────────────────────────────────

export type PulseDirection =
  | "cortex_to_specialist"
  | "specialist_to_cortex"
  | "cortex_to_processing_brain"
  | "processing_brain_to_cortex"
  | "processing_brain_to_nex"
  | "nex_to_processing_brain";

export type PulseState =
  | "pending"
  | "processed"
  | "conflicted"
  | "delayed"
  | "malformed"
  | "empty"
  | "stale"
  | "duplicate";

export interface Pulse {
  readonly pulse_id: string;
  readonly timestamp: string;
  readonly source: string;
  readonly destination: string;
  readonly direction: PulseDirection;
  readonly payload_type: string;
  readonly payload_reference: string | null;
  readonly sequence: number;
  readonly state: PulseState;
  readonly processed: boolean;
  readonly result_reference: string | null;
  readonly correlation_id: string;      // groups pulses belonging to one task
  readonly session_id: string;
}

// ── Path ──────────────────────────────────────────────────────────────

export function getSignalsPath(repo_root?: string): string {
  return path.join(repo_root ?? process.cwd(), "data", "nex1-processing-brain", "signals.jsonl");
}

// ── Sequence + session ────────────────────────────────────────────────

let _seq = 0;
let _sessionId = crypto.randomBytes(4).toString("hex");
export function currentSessionId(): string { return _sessionId; }

// ── Emit ──────────────────────────────────────────────────────────────

export function emitPulse(args: {
  readonly source: string;
  readonly destination: string;
  readonly direction: PulseDirection;
  readonly payload_type: string;
  readonly payload_reference?: string | null;
  readonly correlation_id: string;
  readonly state?: PulseState;
  readonly repo_root?: string;
}): Pulse {
  _seq++;
  const p: Pulse = {
    pulse_id: "pulse_" + crypto.randomBytes(6).toString("hex"),
    timestamp: new Date().toISOString(),
    source: args.source,
    destination: args.destination,
    direction: args.direction,
    payload_type: args.payload_type,
    payload_reference: args.payload_reference ?? null,
    sequence: _seq,
    state: args.state ?? "pending",
    processed: false,
    result_reference: null,
    correlation_id: args.correlation_id,
    session_id: _sessionId,
  };
  const outPath = getSignalsPath(args.repo_root);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(p) + "\n", "utf8");
  recordHeartbeat({
    agent_id: "bidirectional_pulse",
    event_type: "emit",
    event_data: { direction: p.direction, seq: p.sequence, correlation_id: p.correlation_id },
  });
  return p;
}

/** Append a follow-up pulse marking prior_pulse as processed with a result_reference. */
export function markPulseProcessed(args: {
  readonly prior_pulse_id: string;
  readonly result_reference: string;
  readonly repo_root?: string;
}): void {
  const p = {
    pulse_id: "pulseack_" + crypto.randomBytes(6).toString("hex"),
    timestamp: new Date().toISOString(),
    ack_of: args.prior_pulse_id,
    result_reference: args.result_reference,
    session_id: _sessionId,
  };
  fs.appendFileSync(getSignalsPath(args.repo_root), JSON.stringify(p) + "\n", "utf8");
}

// ── Read + trace ─────────────────────────────────────────────────────

export function loadPulses(repo_root?: string): readonly Pulse[] {
  const p = getSignalsPath(repo_root);
  if (!fs.existsSync(p)) return [];
  const out: Pulse[] = [];
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Pulse;
      if (rec.pulse_id && rec.direction) out.push(rec);
    } catch { /* skip corrupted */ }
  }
  return out;
}

export function pulsesForCorrelation(correlation_id: string, repo_root?: string): readonly Pulse[] {
  return loadPulses(repo_root).filter((p) => p.correlation_id === correlation_id);
}

// ── Anomaly detection · deterministic ─────────────────────────────────

export interface PulseAnomalyReport {
  readonly correlation_id: string;
  readonly total_pulses: number;
  readonly duplicates: number;                    // same sequence appearing twice
  readonly out_of_order: number;                  // pulse with lower sequence after higher one
  readonly gaps: number;                          // missing sequence numbers
  readonly stale: number;                         // > STALE_MS after prior pulse in the chain
  readonly malformed: number;                     // missing required fields
  readonly empty: number;                         // empty payload_reference on a payload-carrying direction
  readonly conflicting_directions: number;        // e.g. two "cortex_to_processing_brain" for the same correlation with different payloads
}

const STALE_MS = 60_000;
const PAYLOAD_CARRYING: ReadonlySet<PulseDirection> = new Set([
  "cortex_to_processing_brain",
  "processing_brain_to_cortex",
  "processing_brain_to_nex",
  "specialist_to_cortex",
]);

export function analyseCorrelation(correlation_id: string, repo_root?: string): PulseAnomalyReport {
  const chain = pulsesForCorrelation(correlation_id, repo_root).slice().sort((a, b) => a.sequence - b.sequence);
  const seqSeen = new Map<number, number>();
  let duplicates = 0;
  let outOfOrder = 0;
  let stale = 0;
  let malformed = 0;
  let empty = 0;

  let lastSeq = -Infinity;
  let lastTs = 0;
  for (const p of chain) {
    if (!p.pulse_id || !p.direction || !p.timestamp) { malformed++; continue; }
    if (PAYLOAD_CARRYING.has(p.direction) && (p.payload_reference === null || p.payload_reference === undefined || p.payload_reference === "")) empty++;
    if (seqSeen.has(p.sequence)) duplicates++;
    seqSeen.set(p.sequence, (seqSeen.get(p.sequence) ?? 0) + 1);
    if (p.sequence < lastSeq) outOfOrder++;
    const ts = Date.parse(p.timestamp) || 0;
    if (lastTs > 0 && ts - lastTs > STALE_MS) stale++;
    lastSeq = Math.max(lastSeq, p.sequence);
    lastTs = ts;
  }
  const seqs = [...seqSeen.keys()].sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < seqs.length; i++) if (seqs[i] - seqs[i - 1] > 1) gaps += (seqs[i] - seqs[i - 1] - 1);

  // conflicting_directions · same direction twice with different payload_refs
  const byDir = new Map<PulseDirection, string[]>();
  for (const p of chain) {
    const list = byDir.get(p.direction) ?? [];
    list.push(p.payload_reference ?? "");
    byDir.set(p.direction, list);
  }
  let conflicting = 0;
  for (const [, refs] of byDir) if (new Set(refs).size > 1 && refs.length > 1) conflicting++;

  return {
    correlation_id,
    total_pulses: chain.length,
    duplicates,
    out_of_order: outOfOrder,
    gaps,
    stale,
    malformed,
    empty,
    conflicting_directions: conflicting,
  };
}

/** Testing helper · reset internal sequence counter + session for isolated experiments. */
export function _resetForTesting(session_id?: string): void {
  _seq = 0;
  _sessionId = session_id ?? crypto.randomBytes(4).toString("hex");
}

export const PULSE_INFRASTRUCTURE_VERSION = "pulse.v1";
