// src/lib/nex-agent/code-engine/capability-source-outcome-ledger.ts
//
// NEX · Source-Outcome Learning Loop · S8 · 2026-09-21.
// Founder-authorised as part of the "Internet as External Knowledge
// Substrate" programme.
//
// PURPOSE
//
//   NEX needs to learn — without warehousing raw external content —
//   which sources answer which question classes reliably. This ledger
//   records ONLY the source × class × outcome triple per turn, never
//   the retrieved payload. Over time it builds a reusable, auditable
//   pattern:
//
//       "Nominatim answered 'geographic_coordinates' successfully
//        42 times out of 45 in the last 30 days."
//       "BMKG succeeded on 'weather_current' 11/12 times, one HTTP
//        403 (User-Agent WAF), no false-fresh reports."
//       "Wikidata disagreed with Nominatim on Java 3/10 times —
//        remember to surface the disagreement, not silently pick."
//
//   This is the LEARNED_ABSTRACTION kind from
//   capability-retention-model.ts. Data-driven, not opinion.
//
// ANTI-CHEATING GUARANTEE
//
//   · Ledger rows carry NO retrieved content · only source, class,
//     outcome, timestamp, and a short trace-derived reason.
//   · Reading + writing are pure IO wrappers · never throw · never
//     poison the caller turn.
//   · Aggregates are computed deterministically from the rows on
//     demand · nothing is precomputed, nothing is cached silently.
//   · Adding an OutcomeKind is a governance action (edit this file,
//     TypeScript union breaks callers loudly).
//
// COMPOSITION
//
//   capability-chat-turn.ts records an outcome after every external
//   retrieval fires. capability-source-selection.ts (future extension)
//   MAY consult the aggregate to influence primary-vs-secondary
//   ordering — but only when a per-class rule explicitly opts in.
//   Learning remains subordinate to governance.

import fs from "node:fs";
import path from "node:path";

// ── Outcome kinds ────────────────────────────────────────────────────

export type SourceOutcomeKind =
  | "ok_confirmed"        // fetch succeeded, evidence confirmed
  | "ok_unconfirmed"      // fetch succeeded, evidence unconfirmed (partial / disagreement)
  | "ok_zero_results"     // fetch succeeded but returned zero relevant results
  | "http_error"          // fetch returned a non-2xx status
  | "network_error"       // fetch threw (timeout, DNS, connection)
  | "malformed_response"  // fetch OK but response could not be parsed
  | "disagreement"        // this source disagreed with a peer in a multi-source lookup
  | "blocked"             // internet gate refused this call
  | "not_available";      // source selected but no permitted host is configured

// ── Ledger row ───────────────────────────────────────────────────────

export interface SourceOutcomeRow {
  readonly id: string;
  readonly recorded_at_iso: string;
  readonly conversation_id: string;
  readonly turn_id: number;
  readonly source_identifier: string;    // e.g. "bmkg.go.id"
  readonly info_class: string;           // e.g. "weather_current"
  readonly outcome: SourceOutcomeKind;
  readonly duration_ms: number | null;   // null when not applicable
  readonly note: string;                 // short human-readable · never the payload
}

const LEDGER_DIR = path.resolve(process.cwd(), "data", "nex-source-outcome-ledger");
const LEDGER_FILE = path.join(LEDGER_DIR, "outcomes.jsonl");

function ensureDir(): void {
  try { fs.mkdirSync(LEDGER_DIR, { recursive: true }); } catch { /* silent */ }
}

// ── Public API ───────────────────────────────────────────────────────

export interface RecordOutcomeInputs {
  readonly conversation_id: string;
  readonly turn_id: number;
  readonly source_identifier: string;
  readonly info_class: string;
  readonly outcome: SourceOutcomeKind;
  readonly duration_ms?: number | null;
  readonly note?: string;
}

/** Record one outcome. Never throws · silently no-ops on IO error. */
export function recordSourceOutcome(inputs: RecordOutcomeInputs): SourceOutcomeRow {
  ensureDir();
  const row: SourceOutcomeRow = {
    id: `sol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    recorded_at_iso: new Date().toISOString(),
    conversation_id: inputs.conversation_id,
    turn_id: inputs.turn_id,
    source_identifier: inputs.source_identifier,
    info_class: inputs.info_class,
    outcome: inputs.outcome,
    duration_ms: inputs.duration_ms ?? null,
    note: (inputs.note ?? "").slice(0, 200),
  };
  try {
    fs.appendFileSync(LEDGER_FILE, JSON.stringify(row) + "\n", "utf8");
  } catch { /* silent · never poison a turn */ }
  return row;
}

/** Read the ledger. Returns [] on any error. Used by audit / suites. */
export function readSourceOutcomeLedger(): readonly SourceOutcomeRow[] {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    const raw = fs.readFileSync(LEDGER_FILE, "utf8");
    const rows: SourceOutcomeRow[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { rows.push(JSON.parse(trimmed) as SourceOutcomeRow); } catch { /* skip malformed */ }
    }
    return rows;
  } catch {
    return [];
  }
}

/** Test / audit hook. */
export function resetSourceOutcomeLedgerForTests(): void {
  try { fs.rmSync(LEDGER_FILE, { force: true }); } catch { /* silent */ }
}

// ── Aggregates ───────────────────────────────────────────────────────
//
// Deterministically computed from rows. No caching. Callers pay the
// scan cost, which is fine at NEX-native volumes (this ledger will
// be small · one row per external call · not per token).

export interface SourceClassAggregate {
  readonly source_identifier: string;
  readonly info_class: string;
  readonly total: number;
  readonly by_outcome: Readonly<Record<SourceOutcomeKind, number>>;
  readonly success_rate: number; // (ok_confirmed + ok_unconfirmed) / total
  readonly last_seen_iso: string | null;
}

const ZERO_BY_OUTCOME: Record<SourceOutcomeKind, number> = {
  ok_confirmed: 0,
  ok_unconfirmed: 0,
  ok_zero_results: 0,
  http_error: 0,
  network_error: 0,
  malformed_response: 0,
  disagreement: 0,
  blocked: 0,
  not_available: 0,
};

// ── G12 · Outcome decay · Phase 4 · 2026-09-21 ─────────────────────
//
// Old outcomes should lose influence. A source that was reliable a
// year ago but has since failed 20 times in a row should not be
// scored on the year-old successes. The decay window is deterministic
// (30-day half-life) and applied at aggregate time. Rows are never
// deleted — the ledger remains a full audit trail.

const DECAY_HALFLIFE_MS = 30 * 24 * 60 * 60 * 1000;

function decayWeight(recorded_at_iso: string, now_ms: number): number {
  const age = Math.max(0, now_ms - Date.parse(recorded_at_iso));
  return Math.pow(0.5, age / DECAY_HALFLIFE_MS);
}

export interface DecayedSourceClassAggregate extends SourceClassAggregate {
  readonly decayed_success_rate: number;
  readonly decayed_total: number;
}

export function aggregateBySourceAndClassDecayed(
  rows: readonly SourceOutcomeRow[] = readSourceOutcomeLedger(),
  now_ms: number = Date.now(),
): readonly DecayedSourceClassAggregate[] {
  const base = aggregateBySourceAndClass(rows);
  const decayedBySource = new Map<string, { weighted_total: number; weighted_success: number }>();
  for (const r of rows) {
    const key = `${r.source_identifier}::${r.info_class}`;
    let bucket = decayedBySource.get(key);
    if (!bucket) { bucket = { weighted_total: 0, weighted_success: 0 }; decayedBySource.set(key, bucket); }
    const w = decayWeight(r.recorded_at_iso, now_ms);
    bucket.weighted_total += w;
    if (r.outcome === "ok_confirmed" || r.outcome === "ok_unconfirmed") {
      bucket.weighted_success += w;
    }
  }
  return base.map((agg) => {
    const key = `${agg.source_identifier}::${agg.info_class}`;
    const d = decayedBySource.get(key);
    const decayedRate = d && d.weighted_total > 0 ? d.weighted_success / d.weighted_total : 0;
    return {
      ...agg,
      decayed_success_rate: Number(decayedRate.toFixed(3)),
      decayed_total: Number((d?.weighted_total ?? 0).toFixed(3)),
    };
  });
}

export function aggregateBySourceAndClass(rows: readonly SourceOutcomeRow[] = readSourceOutcomeLedger()): readonly SourceClassAggregate[] {
  const map = new Map<string, { by_outcome: Record<SourceOutcomeKind, number>; last: string | null; total: number }>();
  for (const r of rows) {
    const key = `${r.source_identifier}::${r.info_class}`;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { by_outcome: { ...ZERO_BY_OUTCOME }, last: null, total: 0 };
      map.set(key, bucket);
    }
    bucket.by_outcome[r.outcome] = (bucket.by_outcome[r.outcome] ?? 0) + 1;
    bucket.total += 1;
    if (!bucket.last || bucket.last < r.recorded_at_iso) bucket.last = r.recorded_at_iso;
  }
  const out: SourceClassAggregate[] = [];
  for (const [key, bucket] of map.entries()) {
    const [source_identifier, info_class] = key.split("::");
    const successes = bucket.by_outcome.ok_confirmed + bucket.by_outcome.ok_unconfirmed;
    out.push({
      source_identifier,
      info_class,
      total: bucket.total,
      by_outcome: bucket.by_outcome,
      success_rate: bucket.total === 0 ? 0 : successes / bucket.total,
      last_seen_iso: bucket.last,
    });
  }
  return out;
}

// ── Trace emitter ────────────────────────────────────────────────────

export function emitSourceOutcomeTrace(row: SourceOutcomeRow): string {
  return `source_outcome · source=${row.source_identifier} · class=${row.info_class} · outcome=${row.outcome}${row.duration_ms !== null ? ` · duration_ms=${row.duration_ms}` : ""}${row.note ? ` · ${row.note.slice(0, 80)}` : ""}`;
}
