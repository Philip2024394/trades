// src/lib/nex-hq/city-category-observability.ts
//
// Phase 3 · 2026-08-24 · Admin observability helper.
//
// Combines the LATEST cycle in nex.worker_cycle_run for each (city, category)
// with the REAL persisted-row count in the corresponding business table.
// Answers Philip's ambiguous-zero problem: a card that says "0" must tell
// the admin WHICH kind of zero it is (nothing processed · all deduped ·
// provider errored · cycle still running · not run at all).
//
// Never derives counts from cycle counters when a truthful table count is
// available. Cycle counters describe walker activity · table counts describe
// database reality. Both are needed to distinguish the states.

import type { Pool } from "pg";
import { DIRECTORY_CATEGORIES, type DirectoryCategory } from "./directory-counts";

// Philip 2026-08-27 · A1: extended to include service categories.
// Service categories share nex.service_business filtered by category_slug ·
// extraWhere lets the observability count SQL filter accordingly.
interface CategoryTableSpec { table: string; cityColumn: string; extraWhere?: string }
function svc(slug: string): CategoryTableSpec {
  return { table: "nex.service_business", cityColumn: "city", extraWhere: `category_slug = '${slug}'` };
}
const CATEGORY_TABLE: Record<DirectoryCategory, CategoryTableSpec> = {
  food:          { table: "nex.food_business",                    cityColumn: "city" },
  accommodation: { table: "nex.accommodation_business",           cityColumn: "city" },
  market:        { table: "nex.mp_seller",                        cityColumn: "city" },
  transport:     { table: "nex.transport_acquisition_record",     cityColumn: "city" },
  "services-gyms":       svc("gyms"),
  "services-salons":     svc("salons"),
  "services-dentists":   svc("dentists"),
  "services-opticians":  svc("opticians"),
  "services-pharmacies": svc("pharmacies"),
  "services-car-repair": svc("car-repair"),
};

export type LastRunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED" | "NEVER_RUN";

export interface CityCategoryCard {
  city:                 string;
  category:             DirectoryCategory;
  // Cycle-derived (walker activity)
  processed:            number | null;   // provider records/candidates examined
  matched:              number | null;   // matched-to-existing (dedupe) count
  newCandidates:        number | null;   // classified as new before persist
  addedToNex:           number | null;   // authoritative records persisted this cycle
  errorsCount:          number | null;
  lastRunStatus:        LastRunStatus;
  lastRunStartedAt:     Date | null;
  lastRunFinishedAt:    Date | null;
  lastRunDurationMs:    number | null;
  provider:             string | null;   // primary provider from summary.provider_results[0]
  providerError:        string | null;   // summary.unexpected_error · null if none
  // Table-derived (database reality)
  totalInDirectory:     number;          // authoritative persisted-row count for (city, category)
  // Derived diagnosis · one of a small enumeration so UI can render an icon/colour
  diagnosis:            CardDiagnosis;
  diagnosisText:        string;
}

export type CardDiagnosis =
  | "never-run"                // no cycle history for this combo
  | "running"                  // cycle in flight now
  | "provider-error"           // last cycle finished with summary.unexpected_error
  | "processed-zero-provider"  // walker ran · provider returned zero rows · not an error
  | "deduped-zero-persisted"   // walker examined candidates · none were new · nothing persisted
  | "productive"               // walker examined + persisted new rows this cycle
  | "aborted"                  // reconciler aborted a stuck cycle
  | "failed";                  // status='failed' · errors_count > 0 · not a provider-error string

// Diagnosis precedence · Philip 2026-08-24 · truthful reporting doctrine.
//
// Priority (highest first):
//   1 · 🔵 running                → cycle in flight now
//   2 · 🟠 aborted                → reconciler killed a zombie (real, honest)
//   3 · 🟢 productive             → provider SUCCESS + persisted > 0
//   4 · 🟡 deduped-zero-persisted → provider SUCCESS + returned > 0 + persisted = 0
//   5 · 🔴 provider-error         → provider itself failed (HTTP / network / rate)
//   6 · 🔴 failed                 → cycle status=failed AND provider did not return candidates
//   7 · ⚪ processed-zero-provider → provider SUCCESS + returned = 0 (empty query universe)
//
// KEY RULE: a secondary error (errors_count > 0) MUST NOT override a successful
// primary discovery. If Nominatim returned 48 rows and all 48 were dedupe-matched,
// the diagnosis is "all deduped" — not "cycle failed". Philip: "The secondary
// error that pushed errors_count=1 must not override the actual successful
// discovery outcome in the HQ diagnosis."
//
// Exported for unit testing · consumed inside loadCityCategoryObservability().
export function diagnose(row: {
  status: string | null;
  processed: number | null;
  newCandidates: number | null;
  persisted: number | null;
  errors: number | null;
  providerError: string | null;
  providerStatus: string | null;   // summary.provider_results[0].status ('SUCCESS' | 'ERROR' | ...)
  providerReturned: number | null; // summary.provider_results[0].returned
  reconcilerReason: string | null; // summary.reconciler_reason (why the reconciler aborted it)
  finishedAt: Date | null;
}): { diagnosis: CardDiagnosis; text: string } {
  // 1 · 🔵 Running now
  if (row.status === "running" || (row.status === null && row.finishedAt === null)) {
    return { diagnosis: "running", text: "Cycle in flight now" };
  }
  // 2 · 🟠 Zombie reconciled (aborted by the timeout reconciler)
  if (row.status === "aborted") {
    const suffix = row.reconcilerReason ? ` · ${row.reconcilerReason}` : "";
    return { diagnosis: "aborted", text: `Zombie reconciled${suffix}` };
  }

  // Reality of the provider call · what did discovery actually do?
  //   providerReturned falls back to processed when provider_results[0].returned
  //   isn't populated (some walkers only surface processed).
  const processed        = row.processed ?? 0;
  const persisted        = row.persisted ?? 0;
  const providerReturned = row.providerReturned ?? processed;
  const providerSucceeded = row.providerStatus === "SUCCESS" || processed > 0;

  // 3 · 🟢 Productive — provider succeeded AND we persisted new rows
  if (providerSucceeded && persisted > 0) {
    return { diagnosis: "productive", text: `Persisted ${persisted} new rows this cycle` };
  }

  // 4 · 🟡 All deduped — provider succeeded AND returned candidates AND all were already in DB
  //   THIS is Philip's Solo Market case: 48 returned, 0 persisted, status=failed with
  //   errors=1 (secondary persist warning). The successful discovery outcome wins.
  if (providerSucceeded && providerReturned > 0) {
    return {
      diagnosis: "deduped-zero-persisted",
      text: `Examined ${processed} · all already in DB (deduped)`,
    };
  }

  // The provider did NOT return candidates. Only now do failure axes matter.
  // 5 · 🔴 Provider error — the primary provider call itself failed
  if (row.providerError) {
    return { diagnosis: "provider-error", text: `Provider error · ${row.providerError.slice(0, 80)}` };
  }
  // 6 · 🔴 Cycle failed — status=failed with no provider success signal
  if (row.status === "failed") {
    return { diagnosis: "failed", text: `Cycle failed · errors=${row.errors ?? 0}` };
  }
  // 7 · ⚪ Provider empty — provider succeeded but the query universe was empty
  return { diagnosis: "processed-zero-provider", text: "Provider returned zero rows this cycle" };
}

function toStatus(x: string | null): LastRunStatus {
  if (!x) return "NEVER_RUN";
  if (x === "running") return "RUNNING";
  if (x === "completed") return "COMPLETED";
  if (x === "failed") return "FAILED";
  if (x === "aborted") return "ABORTED";
  return "NEVER_RUN";
}

/**
 * Load observability cards for all (city, category) combos that either
 * appear in rotation_state OR have persisted rows. Never returns fabricated
 * data · a combo with no history + no persisted rows shows NEVER_RUN.
 */
export async function loadCityCategoryObservability(
  pool: Pool,
): Promise<CityCategoryCard[]> {
  // 1) All (city, category) combos we know about (rotation state · walker registry)
  const cityCategoriesR = await pool.query<{ city: string; category: DirectoryCategory }>(
    `SELECT DISTINCT city, category
       FROM nex.discovery_rotation_state
      WHERE category = ANY($1::text[])
      ORDER BY city, category`,
    [DIRECTORY_CATEGORIES as unknown as string[]],
  );
  const combos = cityCategoriesR.rows;

  // 2) Latest cycle per (parsed city, category) via DISTINCT ON.
  // parse worker_config = "{cat}:{city}:{surface}" · city is 2nd segment.
  // 2026-08-24 · Philip diagnosis-truth fix · added provider_status +
  // provider_returned + reconciler_reason so diagnose() can distinguish
  // "provider SUCCESS + all deduped" from "genuine failure".
  const latestR = await pool.query<{
    city: string; category: string; started_at: Date | null; finished_at: Date | null;
    status: string | null; records_processed: number | null; records_new: number | null;
    errors_count: number | null; duration_ms: number | null;
    provider: string | null; provider_error: string | null;
    provider_status: string | null; provider_returned: number | null;
    reconciler_reason: string | null;
    discovery_persisted: number | null; discovery_candidates: number | null;
    discovery_classified_new: number | null;
    matched_exact: number | null; matched_high: number | null;
  }>(`
    SELECT DISTINCT ON (city, category)
      split_part(worker_config,':',2) AS city,
      split_part(worker_config,':',1) AS category,
      started_at, finished_at, status, records_processed, records_new,
      errors_count, duration_ms,
      (summary->'provider_results'->0->>'provider')       AS provider,
      (summary->>'unexpected_error')                      AS provider_error,
      (summary->'provider_results'->0->>'status')         AS provider_status,
      NULLIF(summary->'provider_results'->0->>'returned','')::int AS provider_returned,
      (summary->>'reconciler_reason')                     AS reconciler_reason,
      NULLIF(summary->'discovery_stats'->>'records_persisted','')::int      AS discovery_persisted,
      NULLIF(summary->'discovery_stats'->>'candidates_examined','')::int    AS discovery_candidates,
      NULLIF(summary->'discovery_stats'->>'candidates_classified_new','')::int AS discovery_classified_new,
      -- Matched-to-existing count · food/accommodation exposes matched_exact +
      -- matched_high in summary.scoring_stats. Other walkers derive it below.
      NULLIF(summary->'scoring_stats'->>'matched_exact','')::int             AS matched_exact,
      NULLIF(summary->'scoring_stats'->>'matched_high','')::int              AS matched_high
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition'
      AND started_at >= now() - interval '48 hours'
      AND split_part(worker_config,':',1) = ANY($1::text[])
    ORDER BY city, category, started_at DESC
  `, [DIRECTORY_CATEGORIES as unknown as string[]]);
  const latestByKey = new Map(latestR.rows.map((r) => [`${r.city}:${r.category}`, r]));

  // 3) Persisted-row counts per (city, category) from the authoritative tables.
  // Philip 2026-08-27 · A1: init all DIRECTORY_CATEGORIES (including 6 service
  // slugs) so TypeScript is exhaustive and runtime writes don't hit undefined.
  const perCityCounts: Record<DirectoryCategory, Map<string, number>> = Object.fromEntries(
    DIRECTORY_CATEGORIES.map((c) => [c, new Map<string, number>()]),
  ) as Record<DirectoryCategory, Map<string, number>>;
  await Promise.all(DIRECTORY_CATEGORIES.map(async (cat) => {
    const spec = CATEGORY_TABLE[cat];
    const extraWhereClause = spec.extraWhere ? `WHERE ${spec.extraWhere}` : "";
    try {
      const r = await pool.query<{ city: string | null; n: string }>(
        `SELECT ${spec.cityColumn} AS city, count(*)::text AS n
           FROM ${spec.table}
           ${extraWhereClause}
          GROUP BY ${spec.cityColumn}`,
      );
      for (const row of r.rows) {
        if (row.city) perCityCounts[cat].set(row.city, Number(row.n));
      }
    } catch { /* table missing or permission · leave counts empty */ }
  }));

  // 4) Compose cards
  const cards: CityCategoryCard[] = [];
  for (const combo of combos) {
    const latest = latestByKey.get(`${combo.city}:${combo.category}`);
    const persistedCycle = latest?.discovery_persisted ?? latest?.records_new ?? null;
    const processed      = latest?.discovery_candidates ?? latest?.records_processed ?? null;
    const newCandidates  = latest?.discovery_classified_new ?? null;
    // Matched · food/accommodation report matched_exact + matched_high directly.
    // Market/transport don't · derive as processed - persisted when both known.
    let matched: number | null = null;
    if (latest?.matched_exact != null || latest?.matched_high != null) {
      matched = (latest.matched_exact ?? 0) + (latest.matched_high ?? 0);
    } else if (processed != null && persistedCycle != null) {
      matched = Math.max(0, processed - persistedCycle);
    }
    const providerError  = latest?.provider_error ?? null;
    const finishedAt     = latest?.finished_at ?? null;
    const startedAt      = latest?.started_at ?? null;
    const status         = latest?.status ?? null;

    const diag = latest
      ? diagnose({
          status, processed, newCandidates, persisted: persistedCycle,
          errors: latest.errors_count ?? 0, providerError, finishedAt,
          providerStatus:  latest.provider_status  ?? null,
          providerReturned: latest.provider_returned ?? null,
          reconcilerReason: latest.reconciler_reason ?? null,
        })
      : { diagnosis: "never-run" as CardDiagnosis, text: "No cycle has ever run for this combo" };

    const totalInDirectory = perCityCounts[combo.category]?.get(combo.city) ?? 0;

    cards.push({
      city:              combo.city,
      category:          combo.category,
      processed,
      matched,
      newCandidates,
      addedToNex:        persistedCycle,
      errorsCount:       latest?.errors_count ?? null,
      lastRunStatus:     toStatus(status),
      lastRunStartedAt:  startedAt ? new Date(startedAt) : null,
      lastRunFinishedAt: finishedAt ? new Date(finishedAt) : null,
      lastRunDurationMs: latest?.duration_ms ?? null,
      provider:          latest?.provider ?? null,
      providerError,
      totalInDirectory,
      diagnosis:         diag.diagnosis,
      diagnosisText:     diag.text,
    });
  }
  return cards;
}
