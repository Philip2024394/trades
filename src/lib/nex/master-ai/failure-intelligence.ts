// src/lib/nex/master-ai/failure-intelligence.ts
//
// NEX Master AI Engineer · Failure Intelligence · §18
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Aggregate repeated failures across the runtime event-bus into
// FailurePatterns. Every pattern preserves: first_seen, last_seen,
// occurrence_count, representative_reason, affected_agents.
//
// Master AI must NEVER hide failures. Patterns feed candidate
// improvement generation.

import { createHash, randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { failurePatternsPath } from "./paths";
import { tailRuntimeEvents } from "./observation";
import type { FailurePattern, MasterAgentId } from "./types";

type EventLike = {
  kind: string;
  agent_id: string;
  timestamp_iso: string;
  attributes?: Record<string, unknown>;
};

/** Canonicalize a failure reason into a stable fingerprint so noisy
 *  variants (paths, PIDs, timestamps, UUIDs) fold into one pattern. */
function fingerprintReason(reason: string): string {
  const stripped = reason
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "<uuid>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "<ts>")
    .replace(/\b\d{4,}\b/g, "<num>")
    .replace(/[A-Z]:\\[^\s"']+/gi, "<path>")
    .replace(/\/(?:[^\s"'\\/]+\/){2,}[^\s"'\\/]+/g, "<path>")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(stripped).digest("hex").slice(0, 20);
}

function coerceEventList(raw: unknown[]): EventLike[] {
  const out: EventLike[] = [];
  for (const r of raw) {
    if (r && typeof r === "object" && "kind" in r && "agent_id" in r && "timestamp_iso" in r) {
      out.push(r as EventLike);
    }
  }
  return out;
}

/** Aggregate failures from the runtime events log into FailurePatterns.
 *  Deduplicates by fingerprint · appends new patterns · updates existing
 *  patterns by writing a NEW record (append-only history) with the
 *  refreshed occurrence_count/last_seen. */
export function aggregateFailurePatterns(maxEvents = 5000): FailurePattern[] {
  const events = coerceEventList(tailRuntimeEvents(maxEvents));
  const failureEvents = events.filter((e) =>
    e.kind === "WORK_FAILED"
    || e.kind === "AGENT_CRASHED"
    || e.kind === "WORK_BLOCKED"
    || e.kind === "AGENT_RESTART_GIVEUP");

  const byKey = new Map<string, FailurePattern>();
  const existingLatest = latestByKey();

  for (const e of failureEvents) {
    const reason = String((e.attributes as Record<string, unknown> | undefined)?.["error"]
      ?? (e.attributes as Record<string, unknown> | undefined)?.["reason"]
      ?? e.kind);
    const key = fingerprintReason(reason);
    const existing = byKey.get(key) ?? existingLatest.get(key);
    if (existing) {
      const agents = new Set(existing.affected_agents);
      agents.add(e.agent_id as MasterAgentId);
      byKey.set(key, {
        ...existing,
        last_seen_iso: e.timestamp_iso > existing.last_seen_iso ? e.timestamp_iso : existing.last_seen_iso,
        first_seen_iso: e.timestamp_iso < existing.first_seen_iso ? e.timestamp_iso : existing.first_seen_iso,
        occurrence_count: existing.occurrence_count + (existingLatest.has(key) ? 0 : 1),
        affected_agents: Array.from(agents),
      });
    } else {
      byKey.set(key, {
        pattern_id: randomUUID(),
        pattern_key: key,
        first_seen_iso: e.timestamp_iso,
        last_seen_iso: e.timestamp_iso,
        occurrence_count: 1,
        representative_reason: reason.slice(0, 240),
        affected_agents: [e.agent_id as MasterAgentId],
        candidate_improvement_slug: null,
      });
    }
  }

  // Increment counts for existing patterns (folded above only counted
  // instances found in this pass · we need to preserve totals).
  const written: FailurePattern[] = [];
  for (const p of byKey.values()) {
    appendJsonLine(failurePatternsPath(), p);
    written.push(p);
  }
  return written;
}

function latestByKey(): Map<string, FailurePattern> {
  const out = new Map<string, FailurePattern>();
  for (const p of readJsonlAll<FailurePattern>(failurePatternsPath())) {
    out.set(p.pattern_key, p);
  }
  return out;
}

export function listCurrentPatterns(): FailurePattern[] {
  return Array.from(latestByKey().values())
    .sort((a, b) => b.occurrence_count - a.occurrence_count);
}

/** Mark a pattern as promoted to a candidate improvement · records
 *  the associated improvement slug so downstream reporting shows the
 *  linkage. Append-only. */
export function linkPatternToImprovement(input: {
  pattern_key: string;
  candidate_improvement_slug: string;
}): FailurePattern | null {
  const current = latestByKey().get(input.pattern_key);
  if (!current) return null;
  const next: FailurePattern = {
    ...current,
    candidate_improvement_slug: input.candidate_improvement_slug,
  };
  appendJsonLine(failurePatternsPath(), next);
  return next;
}

export function _resetFailureIntelForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(failurePatternsPath())) fs.unlinkSync(failurePatternsPath()); } catch { /* ignore */ }
}
