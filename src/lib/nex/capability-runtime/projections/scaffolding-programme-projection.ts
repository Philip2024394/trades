// src/lib/nex/capability-runtime/projections/scaffolding-programme-projection.ts
//
// NEX Runtime Projection · Stage 6 · Scaffolding Programme
// Founder-authorised build-lane addition · 2026-09-23.
//
// WRAPS the authoritative aggregator at:
//   src/lib/nex/discovery-world/scaffolding-programme-status.ts
//
// This projection:
//   · calls `loadScaffoldingProgrammeStatus()` (the real read-only aggregator)
//   · packages the result as a LoggedFact<ScaffoldingProgrammeStatus>
//   · sets freshness=ok on success, freshness=error on throw
//   · sets fact=null on any non-ok freshness (no silent zero)
//   · classifies "relation does not exist" errors as freshness=unavailable
//     (schema not applied is a truthful unavailable state)
//
// Does NOT: modify the aggregator · duplicate any table read · persist any
// materialised copy · write anything anywhere.

import type { PoolClient } from "pg";
import {
  loadScaffoldingProgrammeStatus,
  type ScaffoldingProgrammeStatus,
} from "../../discovery-world/scaffolding-programme-status";
import {
  loggedFactFromQuery,
  type LoggedFact,
} from "../logged-fact";
import {
  errorResult,
  okResult,
  unavailableResult,
  type ProjectionEngine,
  type ProjectionResult,
} from "../projection-engine";

export const SCAFFOLDING_PROGRAMME_PROJECTION_NAME = "scaffolding_programme_status";
export const SCAFFOLDING_PROGRAMME_PROJECTION_VERSION = "1.0.0";

/**
 * Loader function signature. Default injection is the real
 * `loadScaffoldingProgrammeStatus` from the aggregator module.
 * Tests can inject a fake for freshness-state coverage.
 */
export type ScaffoldingProgrammeLoader = (
  client: PoolClient,
  slug: string,
) => Promise<ScaffoldingProgrammeStatus>;

export interface ScaffoldingProgrammeProjectionInput {
  readonly client: PoolClient;
  readonly programme_slug?: string;
}

const AUTHORITATIVE_STORES = [
  "nex.world_country",
  "nex.discovery_programme",
  "nex.discovery_programme_country",
  "nex.discovery_country_state",
  "nex.discovery_business_evidence",
  "nex.discovery_entity",
  "nex.discovery_cycle",
];

/**
 * Detect "table missing" (schema not applied) errors so we can report
 * them as `unavailable` rather than `error`.
 */
function isSchemaMissingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist/i.test(msg);
}

export class ScaffoldingProgrammeProjection
  implements ProjectionEngine<ScaffoldingProgrammeProjectionInput, ScaffoldingProgrammeStatus>
{
  readonly name = SCAFFOLDING_PROGRAMME_PROJECTION_NAME;
  readonly version = SCAFFOLDING_PROGRAMME_PROJECTION_VERSION;

  constructor(private readonly loader: ScaffoldingProgrammeLoader = loadScaffoldingProgrammeStatus) {}

  async compute(
    input: ScaffoldingProgrammeProjectionInput,
  ): Promise<ProjectionResult<ScaffoldingProgrammeStatus>> {
    const slug = input.programme_slug ?? "scaffolding";
    const computed_at = new Date().toISOString();

    try {
      const status = await this.loader(input.client, slug);
      const fact: LoggedFact<ScaffoldingProgrammeStatus> = loggedFactFromQuery({
        value: status,
        // multiple stores compose this fact — record the primary anchor
        store: AUTHORITATIVE_STORES.join(","),
        query_signature: `${this.name}:v${this.version}:slug=${slug}`,
        recorded_at: computed_at,
      });
      return okResult({
        projection_name: this.name,
        projection_version: this.version,
        fact,
        computed_at,
      });
    } catch (err) {
      if (isSchemaMissingError(err)) {
        return unavailableResult({
          projection_name: this.name,
          projection_version: this.version,
          reason: `authoritative_store_unavailable: ${err instanceof Error ? err.message : String(err)}`,
          computed_at,
        });
      }
      return errorResult({
        projection_name: this.name,
        projection_version: this.version,
        error: err instanceof Error ? err.message : String(err),
        computed_at,
      });
    }
  }
}

// ─── Doctrine lock (Stage 6 · projection-specific) ────────────────────

export const _SCAFFOLDING_PROJECTION_READS_ONLY_NEVER_WRITES =
  "scaffolding_projection_calls_loadScaffoldingProgrammeStatus_never_inserts_never_updates_never_deletes";

export const _SCAFFOLDING_PROJECTION_NEVER_FABRICATES_ON_ERROR =
  "on_loader_throw_projection_returns_null_fact_never_zero_valued_status_object";
