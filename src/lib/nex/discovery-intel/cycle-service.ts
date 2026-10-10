// src/lib/nex/discovery-intel/cycle-service.ts
//
// NEX Fresh World Discovery · one-cycle runner
// Founder-authorised programme · bounded wave 2026-09-21.
//
// **Discovery ≠ marketing permission.** This service never sends email,
// never touches send queue / package / operating budget / campaign tables.
// It records structured evidence per cycle so the Founder monitor can
// show honest activity: what NEX searched, what it found, and — where
// evidence supports it — which candidate terms + relationships emerged.
//
// The service is designed to be invocable both by (a) a scheduled cron
// (5-minute cadence) and (b) manually via the Founder-only API. Each run
// records a single durable `nex.discovery_cycle` row plus updates to
// vocabulary + relationships based on what was observed.

import type { PoolClient } from "pg";
import type {
  DiscoveryCycleReport,
  SourceOutcomeRecord,
  CycleOutcome,
  SearchTerm,
} from "./types";
import { loadVocabulary, recordCandidateFromCycle } from "./vocabulary";
import { recordRelationshipEvidence } from "./relationships";

// ─── Adapter contract — one probe per source ─────────────────────────
//
// The cycle service is source-agnostic. Each source is asked to probe
// a single (term × country) combination and return an aggregate outcome:
// how many candidate business elements it observed, whether they had
// email tags, and any related-term evidence. Actual network I/O lives
// in the adapter (existing `scripts/nex-scaffolding-harvest.mjs` or a
// future test-friendly stub). This service composes results only.
//
// **Adapter never returns raw addresses to the cycle service.** It
// reports counts + observed related-term evidence.

export interface ProbeInput {
  readonly term: string;
  readonly country_iso: string;                   // e.g. "GB"
  readonly deadline_ms: number;
}

export interface ObservedRelatedTerm {
  readonly term: string;
  readonly kind: "commercial_service_of" | "equipment_of" | "trade_of" | "industry_context_of" | "synonym_of";
  readonly evidence: number;
}

export interface ProbeOutcome {
  readonly source: string;                        // e.g. "osm_overpass"
  readonly outcome: SourceOutcomeRecord["outcome"];
  readonly ms: number;
  readonly bytes: number | null;
  readonly note: string | null;
  readonly elements_seen: number;                 // total business records observed
  readonly new_email_count: number;               // brand-new (to marketing_contact via canonical importer)
  readonly existing_email_matched: number;
  readonly rejected_email_count: number;
  readonly newly_classified: number;
  readonly newly_eligible: number;
  readonly categories_touched: ReadonlyArray<string>;
  readonly related_terms: ReadonlyArray<ObservedRelatedTerm>;
}

export interface CycleAdapter {
  readonly source_id: string;                     // e.g. "osm_overpass"
  probe(input: ProbeInput): Promise<ProbeOutcome>;
}

// ─── Config ──────────────────────────────────────────────────────────
export interface RunCycleInput {
  readonly topic: string;
  readonly countries: ReadonlyArray<string>;      // ISO alpha-2 codes to probe this cycle
  readonly adapters: ReadonlyArray<CycleAdapter>;
  readonly per_probe_deadline_ms?: number;         // default 20_000
  readonly cycle_deadline_ms?: number;             // default 90_000
  readonly now?: () => number;
  readonly max_terms_per_cycle?: number;           // default 6 (bounded per §22)
}

// ─── Next cycle_seq (monotonic per topic) ────────────────────────────
async function nextCycleSeq(client: PoolClient, topic: string): Promise<number> {
  const r = await client.query<{ n: number }>(
    `SELECT COALESCE(MAX(cycle_seq), 0) + 1 AS n FROM nex.discovery_cycle WHERE topic = $1`,
    [topic],
  );
  return r.rows[0].n;
}

// ─── Persist / update source health ──────────────────────────────────
async function recordSourceHealth(client: PoolClient, source: string, outcome: SourceOutcomeRecord): Promise<void> {
  const success = outcome.outcome === "responded" || outcome.outcome === "responded_zero";
  const bytes = outcome.bytes ?? 0;
  const reason = outcome.note ?? "unknown";
  await client.query(
    `INSERT INTO nex.discovery_source_health (source, last_success_at, last_success_bytes, last_failure_at, last_failure_reason,
                                              consecutive_failures, requests_attempted, requests_succeeded, bytes_in_total, updated_at)
     VALUES ($1,
             CASE WHEN $2::bool THEN now() ELSE NULL::timestamptz END,
             $3::int,
             CASE WHEN $2::bool THEN NULL::timestamptz ELSE now() END,
             $4::text,
             CASE WHEN $2::bool THEN 0 ELSE 1 END, 1, CASE WHEN $2::bool THEN 1 ELSE 0 END, $3::int, now())
     ON CONFLICT (source) DO UPDATE SET
       last_success_at    = CASE WHEN $2::bool THEN now() ELSE nex.discovery_source_health.last_success_at END,
       last_success_bytes = CASE WHEN $2::bool THEN $3::int ELSE nex.discovery_source_health.last_success_bytes END,
       last_failure_at    = CASE WHEN $2::bool THEN nex.discovery_source_health.last_failure_at ELSE now() END,
       last_failure_reason = CASE WHEN $2::bool THEN NULL::text ELSE $4::text END,
       consecutive_failures = CASE WHEN $2::bool THEN 0 ELSE nex.discovery_source_health.consecutive_failures + 1 END,
       requests_attempted  = nex.discovery_source_health.requests_attempted + 1,
       requests_succeeded  = nex.discovery_source_health.requests_succeeded + CASE WHEN $2::bool THEN 1 ELSE 0 END,
       bytes_in_total      = nex.discovery_source_health.bytes_in_total + $3::int,
       updated_at          = now()`,
    [source, success, bytes, reason],
  );
}

// ─── Pick the terms for this cycle (bounded) ────────────────────────
function pickTermsForCycle(vocab: ReadonlyArray<SearchTerm>, limit: number): ReadonlyArray<SearchTerm> {
  // Priority: seeds first · then validated · never rejected. Round-robin
  // is a future refinement; this bounded picker keeps evidence deterministic.
  const seeds = vocab.filter(v => v.status === "seed");
  const validated = vocab.filter(v => v.status === "validated");
  return [...seeds, ...validated].slice(0, limit);
}

// ─── Run one cycle end-to-end ────────────────────────────────────────
export async function runDiscoveryCycle(client: PoolClient, input: RunCycleInput): Promise<DiscoveryCycleReport> {
  const now_fn = input.now ?? Date.now;
  const t0 = now_fn();
  const started_at_iso = new Date(t0).toISOString();

  const cycle_seq = await nextCycleSeq(client, input.topic);
  const per_probe_deadline_ms = input.per_probe_deadline_ms ?? 20_000;
  const cycle_deadline_ms = input.cycle_deadline_ms ?? 90_000;
  const max_terms = input.max_terms_per_cycle ?? 6;

  // Open a cycle row so it's visible to the Founder monitor while running
  const openRow = await client.query<{ cycle_id: string }>(
    `INSERT INTO nex.discovery_cycle
       (cycle_seq, topic, started_at, outcome)
     VALUES ($1, $2, now(), 'in_progress')
     RETURNING cycle_id`,
    [cycle_seq, input.topic],
  );
  const cycle_id = openRow.rows[0].cycle_id;

  const vocab = await loadVocabulary(client, input.topic);
  const terms_selected = pickTermsForCycle(vocab, max_terms);
  const terms_probed = new Set<string>();
  const countries_touched = new Set<string>();
  const sources_attempted = new Set<string>();
  const categories_touched = new Set<string>();
  const source_outcomes: SourceOutcomeRecord[] = [];

  let searches_attempted = 0;
  let businesses_discovered = 0;
  let new_emails = 0;
  let existing_matched = 0;
  let rejected_emails = 0;
  let newly_classified = 0;
  let newly_eligible = 0;

  const cycle_deadline = t0 + cycle_deadline_ms;

  outer: for (const term of terms_selected) {
    for (const country of input.countries) {
      if (now_fn() > cycle_deadline) break outer;
      countries_touched.add(country);
      for (const adapter of input.adapters) {
        if (now_fn() > cycle_deadline) break outer;
        sources_attempted.add(adapter.source_id);
        terms_probed.add(term.term);
        searches_attempted += 1;
        let probe: ProbeOutcome;
        try {
          probe = await adapter.probe({ term: term.term, country_iso: country, deadline_ms: per_probe_deadline_ms });
        } catch (e) {
          probe = {
            source: adapter.source_id, outcome: "unavailable", ms: 0, bytes: null,
            note: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
            elements_seen: 0, new_email_count: 0, existing_email_matched: 0, rejected_email_count: 0,
            newly_classified: 0, newly_eligible: 0, categories_touched: [], related_terms: [],
          };
        }
        const outcomeRow: SourceOutcomeRecord = {
          source: `${adapter.source_id}:${term.term}:${country}`,
          outcome: probe.outcome, elements: probe.elements_seen, bytes: probe.bytes,
          ms: probe.ms, note: probe.note,
        };
        source_outcomes.push(outcomeRow);
        await recordSourceHealth(client, adapter.source_id, outcomeRow);

        businesses_discovered += probe.elements_seen;
        new_emails            += probe.new_email_count;
        existing_matched      += probe.existing_email_matched;
        rejected_emails       += probe.rejected_email_count;
        newly_classified      += probe.newly_classified;
        newly_eligible        += probe.newly_eligible;
        for (const c of probe.categories_touched) categories_touched.add(c);

        // Record observed related-term evidence · never invents · never promotes
        for (const rt of probe.related_terms) {
          if (rt.evidence <= 0) continue;                // no evidence · no record
          await recordCandidateFromCycle(client, {
            term: rt.term, topic: input.topic, family: rt.kind.replace(/_of$/, ""), cycle_id, evidence_added: rt.evidence,
          });
          await recordRelationshipEvidence(client, {
            parent_term: term.term, child_term: rt.term, relationship_kind: rt.kind, topic: input.topic, cycle_id, evidence_added: rt.evidence,
          });
        }
      }
    }
  }

  const t1 = now_fn();
  const duration_ms = t1 - t0;

  // Classify overall outcome
  let outcome: CycleOutcome;
  if (source_outcomes.length === 0) outcome = "failed";
  else if (source_outcomes.every(o => o.outcome === "unavailable" || o.outcome === "rate_limited" || o.outcome === "blocked_by_governance"))
    outcome = "source_unavailable";
  else if (businesses_discovered === 0) outcome = "zero_results";
  else if (source_outcomes.some(o => o.outcome === "unavailable" || o.outcome === "rate_limited")) outcome = "partial";
  else outcome = "complete";

  // Governance canaries — these constants MUST remain zero (CHECK constraints enforce)
  const sends_triggered = 0;
  const addresses_exposed = 0;

  await client.query(
    `UPDATE nex.discovery_cycle
        SET finished_at = now(),
            duration_ms = $1,
            searches_attempted = $2,
            terms_used = $3,
            countries_touched = $4,
            sources_attempted = $5,
            businesses_discovered = $6,
            new_emails = $7,
            existing_matched = $8,
            rejected_emails = $9,
            newly_classified = $10,
            newly_eligible = $11,
            categories_touched = $12,
            source_outcomes = $13::jsonb,
            outcome = $14,
            note = $15,
            sends_triggered = 0,
            addresses_exposed = 0
      WHERE cycle_id = $16`,
    [
      duration_ms, searches_attempted, Array.from(terms_probed), Array.from(countries_touched),
      Array.from(sources_attempted), businesses_discovered, new_emails, existing_matched,
      rejected_emails, newly_classified, newly_eligible, Array.from(categories_touched),
      JSON.stringify(source_outcomes), outcome,
      outcome === "source_unavailable" ? "no source responded this cycle" : null,
      cycle_id,
    ],
  );

  return {
    cycle_id, cycle_seq, topic: input.topic, started_at: started_at_iso,
    finished_at: new Date(t1).toISOString(), duration_ms,
    searches_attempted, terms_used: Array.from(terms_probed), countries_touched: Array.from(countries_touched),
    sources_attempted: Array.from(sources_attempted),
    businesses_discovered, new_emails, existing_matched, rejected_emails,
    newly_classified, newly_eligible, categories_touched: Array.from(categories_touched),
    source_outcomes, outcome, note: outcome === "source_unavailable" ? "no source responded this cycle" : null,
    sends_triggered, addresses_exposed,
  };
}

// ─── Load recent cycles for the Founder monitor ────────────────────
export async function loadRecentCycles(client: PoolClient, topic: string, limit: number = 12): Promise<ReadonlyArray<DiscoveryCycleReport>> {
  const res = await client.query(
    `SELECT cycle_id, cycle_seq, topic,
            started_at::text  AS started_at,
            finished_at::text AS finished_at,
            duration_ms, searches_attempted, terms_used, countries_touched, sources_attempted,
            businesses_discovered, new_emails, existing_matched, rejected_emails,
            newly_classified, newly_eligible, categories_touched,
            source_outcomes, outcome, note, sends_triggered, addresses_exposed
       FROM nex.discovery_cycle
      WHERE topic = $1
      ORDER BY cycle_seq DESC
      LIMIT $2`,
    [topic, limit],
  );
  return res.rows.map(r => ({
    cycle_id: r.cycle_id, cycle_seq: Number(r.cycle_seq), topic: r.topic,
    started_at: r.started_at, finished_at: r.finished_at, duration_ms: r.duration_ms,
    searches_attempted: r.searches_attempted, terms_used: r.terms_used ?? [],
    countries_touched: r.countries_touched ?? [], sources_attempted: r.sources_attempted ?? [],
    businesses_discovered: r.businesses_discovered, new_emails: r.new_emails,
    existing_matched: r.existing_matched, rejected_emails: r.rejected_emails,
    newly_classified: r.newly_classified, newly_eligible: r.newly_eligible,
    categories_touched: r.categories_touched ?? [], source_outcomes: r.source_outcomes ?? [],
    outcome: r.outcome as CycleOutcome, note: r.note,
    sends_triggered: r.sends_triggered as 0, addresses_exposed: r.addresses_exposed as 0,
  }));
}

// ─── Current status readout for the Founder monitor ────────────────
export interface DiscoveryStatus {
  readonly topic: string;
  readonly running_cycle_id: string | null;
  readonly last_completed_cycle: DiscoveryCycleReport | null;
  readonly next_expected_at: string | null;                // 5 minutes after last start
  readonly cadence_seconds: number;
}

export const DEFAULT_CADENCE_SECONDS = 300;

export async function loadDiscoveryStatus(client: PoolClient, topic: string): Promise<DiscoveryStatus> {
  const running = await client.query<{ cycle_id: string }>(
    `SELECT cycle_id FROM nex.discovery_cycle WHERE topic = $1 AND outcome = 'in_progress' ORDER BY cycle_seq DESC LIMIT 1`,
    [topic],
  );
  const recent = await loadRecentCycles(client, topic, 1);
  const last = recent[0] ?? null;
  let next_expected_at: string | null = null;
  if (last?.started_at) {
    const t = Date.parse(last.started_at) + DEFAULT_CADENCE_SECONDS * 1000;
    next_expected_at = new Date(t).toISOString();
  }
  return {
    topic,
    running_cycle_id: running.rows[0]?.cycle_id ?? null,
    last_completed_cycle: last?.outcome !== "in_progress" ? last : null,
    next_expected_at,
    cadence_seconds: DEFAULT_CADENCE_SECONDS,
  };
}
