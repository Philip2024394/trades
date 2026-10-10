// NEX Business Context · blueprint serialisation (Wave 1 · 2026-09-23)
//
// Pure functions that round-trip an AppBlueprint through the jsonb column
// on os_business_listings. Kept in its own file (no side-effects, no
// server-only imports) so it can be unit-tested without a database or a
// Next.js runtime.
//
// Doctrine: the AppBlueprint contract at
// `src/lib/app-builder/blueprint-schema.ts` is the source of truth. This
// module NEVER invents or drops fields — it round-trips whatever the
// contract emits.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";

/**
 * Serialise an AppBlueprint into the exact JSON shape stored in
 * os_business_listings.blueprint_snapshot. Uses `JSON.parse(JSON.stringify(...))`
 * to guarantee the value is plain JSON (no functions · no undefined · no
 * class instances).
 */
export function serialiseBlueprint(blueprint: AppBlueprint): unknown {
  return JSON.parse(JSON.stringify(blueprint));
}

/**
 * Deserialise the jsonb column back into an AppBlueprint. Trusts the
 * database — the value was written by `serialiseBlueprint()` and Postgres
 * jsonb preserves order and shape. If the column shape drifts in the
 * future (e.g. blueprintVersion bumps), a migration should transform the
 * row before this function is called; this function does not
 * shape-validate.
 */
export function deserialiseBlueprint(row: unknown): AppBlueprint {
  if (row === null || typeof row !== "object") {
    throw new Error(
      "deserialiseBlueprint: expected object from jsonb column, received " +
        typeof row
    );
  }
  return row as AppBlueprint;
}

/**
 * The DB-level revision counter is separate from `blueprint.meta.revision`
 * (which is the AppBlueprint's own internal counter). When we publish, we
 * bump the DB counter monotonically. This helper takes the current DB
 * value and returns the next one — a trivial function today, but kept
 * explicit so future publish policies (e.g. skip revision on no-op
 * publish) can slot in without touching callers.
 */
export function nextBlueprintRevision(currentDbRevision: number): number {
  if (!Number.isFinite(currentDbRevision) || currentDbRevision < 1) return 1;
  return Math.floor(currentDbRevision) + 1;
}
