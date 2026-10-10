// src/lib/nex/research-signals/source-reliability-ledger.ts
//
// UWI · Wave 4 · M16 · Source-reliability learning ledger
// Founder-authorised programme.
//
// Records per-source outcome history and derives a moving-window
// reliability snapshot per (source × source_class). Feeds NEX's existing
// SOURCE_RELIABILITY registry (in `capability-evidence-status.ts`) as an
// evidence-based learning signal — currently the registry is a static
// 3-tier map, this ledger closes the loop.
//
// Storage: append-only in-memory list; production integration will back
// this with JSONL persistence + Postgres roll-up. Interface designed to
// swap storage without changing consumers.
//
// Deterministic · pure · no external deps.

import type {
  SourceOutcome,
  SourceOutcomeRecord,
  SourceReliabilitySnapshot,
} from "./types";

export interface LedgerConfig {
  /** How many most-recent records per (source × source_class) inform the snapshot. */
  readonly window_size: number;
  /** Thresholds for recommendation. */
  readonly prefer_agreement_min: number;   // e.g. 0.9
  readonly use_agreement_min: number;      // e.g. 0.7
  readonly avoid_availability_max: number; // e.g. 0.3
}

export const DEFAULT_LEDGER: LedgerConfig = {
  window_size: 50,
  prefer_agreement_min: 0.9,
  use_agreement_min: 0.7,
  avoid_availability_max: 0.3,
};

export class SourceReliabilityLedger {
  private records: SourceOutcomeRecord[] = [];

  constructor(public readonly config: LedgerConfig = DEFAULT_LEDGER) {}

  record(entry: SourceOutcomeRecord): void {
    this.records.push(entry);
  }

  recordAll(entries: ReadonlyArray<SourceOutcomeRecord>): void {
    for (const e of entries) this.records.push(e);
  }

  /** Compute a moving-window snapshot for a (source × source_class). */
  snapshot(source: string, source_class: string): SourceReliabilitySnapshot | null {
    const relevant = this.records
      .filter(r => r.source === source && r.source_class === source_class)
      .slice(-this.config.window_size);
    if (relevant.length === 0) return null;

    const outcomes = relevant.map(r => r.outcome);
    const confirmed_count = outcomes.filter(o => o === "confirmed").length;
    const contradicted_count = outcomes.filter(o => o === "contradicted").length;
    const unverified_count = outcomes.filter(o => o === "unverified").length;
    const empty_count = outcomes.filter(o => o === "empty").length;
    const malformed_count = outcomes.filter(o => o === "malformed").length;
    const timeout_count = outcomes.filter(o => o === "timeout").length;
    const http_error_count = outcomes.filter(o => o === "http_error").length;
    const robots_denied_count = outcomes.filter(o => o === "robots_denied").length;

    const evaluable = confirmed_count + contradicted_count;
    const useful = confirmed_count + contradicted_count + unverified_count;
    const total = outcomes.length;

    const agreement_rate = evaluable > 0 ? confirmed_count / evaluable : 0;
    const availability_rate = total > 0 ? useful / total : 0;

    const latencies = relevant
      .map(r => r.latency_ms)
      .filter((v): v is number => typeof v === "number");
    const avg_latency_ms = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : null;

    let recommendation: SourceReliabilitySnapshot["recommendation"];
    if (availability_rate < this.config.avoid_availability_max) recommendation = "avoid";
    else if (agreement_rate >= this.config.prefer_agreement_min && evaluable >= 5) recommendation = "prefer";
    else if (agreement_rate >= this.config.use_agreement_min) recommendation = "use";
    else recommendation = "verify";

    return {
      source,
      source_class,
      window_size: relevant.length,
      agreement_rate,
      availability_rate,
      avg_latency_ms,
      recent_outcomes: outcomes,
      recommendation,
    };
  }

  /** Enumerate all (source × source_class) pairs the ledger has seen. */
  keys(): Array<{ source: string; source_class: string }> {
    const seen = new Set<string>();
    const out: Array<{ source: string; source_class: string }> = [];
    for (const r of this.records) {
      const k = `${r.source}::${r.source_class}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ source: r.source, source_class: r.source_class });
      }
    }
    return out;
  }

  size(): number { return this.records.length; }

  clear(): void { this.records = []; }
}
