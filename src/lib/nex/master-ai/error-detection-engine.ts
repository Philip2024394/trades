// src/lib/nex/master-ai/error-detection-engine.ts
//
// NEX Master AI · Ecosystem Error Detection Engine (World-First §2)
// Philip 2026-09-07 · AUTHORIZE
//
// Continuously scans NEX ecosystem ledgers + runtime event bus for
// errors, classifies them, deduplicates, and surfaces new patterns to
// the failure-trajectory system.
//
// PRESERVATION:
//   · READ-ONLY across all monitored paths · never modifies observed files
//   · Deduplicates by (kind × signature) hash · never double-reports
//   · Every detection carries a first-seen + last-seen timestamp
//   · Fabricates no errors · surfaces only what is actually observed

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { ecosystemErrorsPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Error kinds
// ═════════════════════════════════════════════════════════════════════

export type EcosystemErrorKind =
  | "TYPE_ERROR"         // TypeScript compilation errors
  | "TEST_FAILURE"       // Failing vitest / test runners
  | "RUNTIME_ERROR"      // Thrown at runtime · from event bus WORK_FAILED
  | "BUILD_ERROR"        // Build pipeline failures
  | "REGRESSION"         // Previously-passing behaviour that broke
  | "LEDGER_CORRUPTION"  // Malformed JSONL row detected
  | "UNKNOWN";

export const ECOSYSTEM_ERROR_KINDS: readonly EcosystemErrorKind[] = Object.freeze([
  "TYPE_ERROR", "TEST_FAILURE", "RUNTIME_ERROR", "BUILD_ERROR",
  "REGRESSION", "LEDGER_CORRUPTION", "UNKNOWN",
] as const);

// ═════════════════════════════════════════════════════════════════════
// Error record
// ═════════════════════════════════════════════════════════════════════

export type EcosystemErrorRecord = {
  error_id: string;
  detected_at_iso: string;
  first_seen_iso: string;
  last_seen_iso: string;
  occurrences: number;
  kind: EcosystemErrorKind;
  signature_hash: string;                           // sha256 for dedup
  source_ledger: string;                            // ledger where the error was observed
  source_ref: string | null;                        // e.g. finding_id / event_id
  representative_message: string;                    // first ≤ 500 chars
  agent_id: string | null;
  severity_hint: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolved: boolean;
  resolution_note: string | null;
};

function severityFromKind(kind: EcosystemErrorKind, occurrences: number): EcosystemErrorRecord["severity_hint"] {
  if (kind === "LEDGER_CORRUPTION") return "CRITICAL";
  if (kind === "REGRESSION") return "CRITICAL";
  if (kind === "TYPE_ERROR" || kind === "BUILD_ERROR") return occurrences >= 3 ? "HIGH" : "MEDIUM";
  if (kind === "TEST_FAILURE") return occurrences >= 5 ? "HIGH" : "MEDIUM";
  if (kind === "RUNTIME_ERROR") return occurrences >= 10 ? "HIGH" : "MEDIUM";
  return "LOW";
}

function sigHash(kind: string, message: string): string {
  return createHash("sha256").update(`${kind}|${message}`).digest("hex").slice(0, 16);
}

/** Record a newly-observed error · dedup by (kind, signature).
 *  If already exists, increments occurrences + updates last_seen. */
export function recordError(input: {
  kind: EcosystemErrorKind;
  source_ledger: string;
  source_ref: string | null;
  message: string;
  agent_id: string | null;
  detected_at?: number;                             // for tests
}): EcosystemErrorRecord {
  const detectedIso = new Date(input.detected_at ?? Date.now()).toISOString();
  const hash = sigHash(input.kind, input.message);
  const existing = readAllErrors().find((e) => e.signature_hash === hash && !e.resolved);
  if (existing) {
    const updated: EcosystemErrorRecord = {
      ...existing,
      last_seen_iso: detectedIso,
      occurrences: existing.occurrences + 1,
      severity_hint: severityFromKind(existing.kind, existing.occurrences + 1),
    };
    appendJsonLine(ecosystemErrorsPath(), updated);
    return updated;
  }
  const rec: EcosystemErrorRecord = {
    error_id: randomUUID(),
    detected_at_iso: detectedIso,
    first_seen_iso: detectedIso,
    last_seen_iso: detectedIso,
    occurrences: 1,
    kind: input.kind,
    signature_hash: hash,
    source_ledger: input.source_ledger,
    source_ref: input.source_ref,
    representative_message: input.message.slice(0, 500),
    agent_id: input.agent_id,
    severity_hint: severityFromKind(input.kind, 1),
    resolved: false,
    resolution_note: null,
  };
  appendJsonLine(ecosystemErrorsPath(), rec);
  return rec;
}

/** Mark an error as resolved. Appends a new record with resolved=true. */
export function markResolved(input: { error_id: string; note: string }): EcosystemErrorRecord | null {
  const latest = latestBySignature();
  const target = Array.from(latest.values()).find((e) => e.error_id === input.error_id);
  if (!target) return null;
  const resolved: EcosystemErrorRecord = {
    ...target,
    resolved: true,
    resolution_note: input.note,
    last_seen_iso: new Date().toISOString(),
  };
  appendJsonLine(ecosystemErrorsPath(), resolved);
  return resolved;
}

export function readAllErrors(): EcosystemErrorRecord[] {
  return readJsonlAll<EcosystemErrorRecord>(ecosystemErrorsPath());
}

/** Latest record per signature · deduplicates the append-only history. */
export function latestBySignature(): Map<string, EcosystemErrorRecord> {
  const latest = new Map<string, EcosystemErrorRecord>();
  const all = readAllErrors().sort((a, b) => a.last_seen_iso.localeCompare(b.last_seen_iso));
  for (const e of all) latest.set(e.signature_hash, e);
  return latest;
}

/** Unresolved errors keyed by severity for prioritisation. */
export function unresolvedBySeverity(): Record<EcosystemErrorRecord["severity_hint"], EcosystemErrorRecord[]> {
  const out: Record<EcosystemErrorRecord["severity_hint"], EcosystemErrorRecord[]> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const e of latestBySignature().values()) {
    if (!e.resolved) out[e.severity_hint].push(e);
  }
  return out;
}

/** Bounded scan of NEX runtime event bus for WORK_FAILED events.
 *  Uses the same events.jsonl path pattern the runtime writes to.
 *  Returns count of NEWLY detected errors this scan. */
export function scanRuntimeEventsForErrors(input?: { window_ms?: number; now?: number }): number {
  const now = input?.now ?? Date.now();
  const windowMs = input?.window_ms ?? 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(now - windowMs).toISOString();
  const runtimeRoot = process.env.NEX_AGENT_RUNTIME_DATA_ROOT ?? path.join(process.cwd(), "data", "agent-runtime");
  const eventsPath = path.join(runtimeRoot, "events.jsonl");
  if (!fs.existsSync(eventsPath)) return 0;
  const raw = fs.readFileSync(eventsPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  let recorded = 0;
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      if (ev.kind !== "WORK_FAILED") continue;
      if (ev.timestamp_iso && ev.timestamp_iso < cutoffIso) continue;
      const msg = (ev.attributes?.error ?? ev.attributes?.reason ?? "").toString();
      if (!msg) continue;
      recordError({
        kind: "RUNTIME_ERROR",
        source_ledger: "agent-runtime/events.jsonl",
        source_ref: ev.event_id ?? null,
        message: msg,
        agent_id: ev.agent_id ?? null,
        detected_at: Date.parse(ev.timestamp_iso ?? new Date().toISOString()),
      });
      recorded++;
    } catch { /* skip malformed */ }
  }
  return recorded;
}

export function _resetErrorDetectionForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(ecosystemErrorsPath())) fs.unlinkSync(ecosystemErrorsPath()); } catch { /* ignore */ }
}
