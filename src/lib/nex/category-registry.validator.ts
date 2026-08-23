// src/lib/nex/category-registry.validator.ts
//
// Directory Factory · Phase 0 · 2026-08-23
// TypeScript ↔ Database parity validator. In Phase 0 the DB table
// exists alongside the TS constant · runtime still reads TS. This
// validator guarantees they don't drift.
//
// Failure mode: throws a diagnostic Error listing every mismatched
// field. Callers decide whether that's fatal (production boot) or
// informational (dev warning).
//
// Callable manually via `pnpm tsx src/lib/nex/category-registry.validator.ts`
// or (later) wired into a startup check.
//
// Environments without the DB (no NEX_POSTGRES_URL) skip cleanly and
// return { ok: true, skipped: true, reason: ... } — dev machines that
// don't run PG locally still boot.
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22 (Phase 0 gate)

import { CATEGORY_REGISTRY, type CategoryEntry } from "./category-registry";
import {
  readCategoryRegistryRows,
  type CategoryRegistryRow,
} from "./category-registry.db";

export interface ValidationResult {
  ok: boolean;
  skipped?: true;
  reason?: string;
  mismatches?: string[];
  missingInDb?: string[];   // TS ids that are not in DB
  extraInDb?: string[];     // DB ids that are not in TS
}

/** Compare TS CATEGORY_REGISTRY against nex.category_registry rows.
 *  Returns { ok: true } if aligned · { ok: false, mismatches: [...] }
 *  if drift · { ok: true, skipped: true } if the DB is unreachable. */
export async function validateRegistryParity(): Promise<ValidationResult> {
  const dbRows = await readCategoryRegistryRows();
  if (dbRows === null) {
    return {
      ok: true,
      skipped: true,
      reason:
        "NEX_POSTGRES_URL not set · Registry parity validation skipped. " +
        "Set NEX_POSTGRES_URL and re-run to validate against nex.category_registry.",
    };
  }

  // Only compare general (non-trade) entries in Phase 0 — the trade
  // thin rows are in the DB but not in the TS array (per D1 · two-tier).
  const tsById = new Map(CATEGORY_REGISTRY.map((c) => [c.id, c]));
  const dbById = new Map<string, CategoryRegistryRow>(
    dbRows.map((r) => [r.id, r]),
  );

  const mismatches: string[] = [];
  const missingInDb: string[] = [];
  const extraInDb: string[] = [];

  // Every TS entry must exist in DB with matching values.
  for (const ts of CATEGORY_REGISTRY) {
    const db = dbById.get(ts.id);
    if (!db) {
      missingInDb.push(ts.id);
      continue;
    }
    const diffs = diffEntry(ts, db);
    for (const d of diffs) mismatches.push(`${ts.id}: ${d}`);
  }

  // Every DB row not in TS must be one of the known trade thin rows.
  // Anything else is drift.
  const KNOWN_TRADE_THIN = new Set([
    "staircase-refacing",
    "staircase-manufacture",
    "kitchens",
  ]);
  for (const db of dbRows) {
    if (tsById.has(db.id)) continue;
    if (KNOWN_TRADE_THIN.has(db.id)) continue;
    extraInDb.push(db.id);
  }

  const ok =
    mismatches.length === 0 &&
    missingInDb.length === 0 &&
    extraInDb.length === 0;

  return { ok, mismatches, missingInDb, extraInDb };
}

/** Field-by-field diff between a TS CategoryEntry and a DB row.
 *  Returns human-readable strings describing each mismatch. */
export function diffEntry(
  ts: CategoryEntry,
  db: CategoryRegistryRow,
): string[] {
  const diffs: string[] = [];

  if (ts.parentVertical !== db.parent_vertical)
    diffs.push(`parent_vertical: TS=${ts.parentVertical} DB=${db.parent_vertical}`);
  if (ts.displayName.en !== db.display_name_en)
    diffs.push(`display_name_en: TS="${ts.displayName.en}" DB="${db.display_name_en}"`);
  if (ts.displayName.id !== db.display_name_id)
    diffs.push(`display_name_id: TS="${ts.displayName.id}" DB="${db.display_name_id}"`);
  if (ts.icon !== db.icon)
    diffs.push(`icon: TS="${ts.icon}" DB="${db.icon ?? ""}"`);
  if (ts.visual.glyph !== db.visual_glyph)
    diffs.push(`visual.glyph: TS=${ts.visual.glyph} DB=${db.visual_glyph}`);
  if ((ts.visual.family ?? null) !== db.visual_family)
    diffs.push(`visual.family: TS=${ts.visual.family ?? "null"} DB=${db.visual_family ?? "null"}`);
  if (ts.route !== db.route)
    diffs.push(`route: TS=${ts.route} DB=${db.route}`);
  if (ts.active !== db.active)
    diffs.push(`active: TS=${ts.active} DB=${db.active}`);

  const tsKw = [...ts.brainKeywords].sort();
  const dbKw = [...(db.brain_keywords ?? [])].sort();
  if (tsKw.join("|") !== dbKw.join("|"))
    diffs.push(`brain_keywords: TS=${JSON.stringify(tsKw)} DB=${JSON.stringify(dbKw)}`);

  const tsCountries = [...ts.countries].sort();
  const dbCountries = [...(db.countries ?? [])].sort();
  if (tsCountries.join(",") !== dbCountries.join(","))
    diffs.push(`countries: TS=${JSON.stringify(tsCountries)} DB=${JSON.stringify(dbCountries)}`);

  if ((ts.businessTable ?? null) !== db.business_table)
    diffs.push(`business_table: TS=${ts.businessTable ?? "null"} DB=${db.business_table ?? "null"}`);

  if ((ts.categoryFilter ?? null) !== db.category_filter)
    diffs.push(`category_filter: TS=${ts.categoryFilter ?? "null"} DB=${db.category_filter ?? "null"}`);

  return diffs;
}

/** Fail-fast helper for boot-time integration. Throws with a
 *  diagnostic message on mismatch, no-ops on skip. */
export async function assertRegistryParity(): Promise<void> {
  const result = await validateRegistryParity();
  if (result.skipped) return;
  if (result.ok) return;
  const parts: string[] = [
    "NEX Registry TS ↔ DB parity CHECK FAILED.",
  ];
  if (result.missingInDb && result.missingInDb.length > 0)
    parts.push(`  Missing in DB: ${result.missingInDb.join(", ")}`);
  if (result.extraInDb && result.extraInDb.length > 0)
    parts.push(`  Extra in DB (not in TS and not a known trade thin row): ${result.extraInDb.join(", ")}`);
  if (result.mismatches && result.mismatches.length > 0) {
    parts.push("  Field mismatches:");
    for (const m of result.mismatches) parts.push(`    · ${m}`);
  }
  parts.push(
    "  Fix: reconcile src/lib/nex/category-registry.ts with " +
    "nex.category_registry (or re-run migration 082 seed).",
  );
  throw new Error(parts.join("\n"));
}
