// scripts/nex-workforce/_job-registry.mjs
//
// NEX Workforce Job Registry loader · Philip 2026-08-27.
//
// Single source of truth: data/nex-job-registry.json.
// Adding a category-specialist = one JSON entry · consumers pick up automatically.
//
// Consumers (Phase 1):
//   · scripts/nex-workforce/_category-walker.mjs         (job execution)
//   · scripts/nex-discovery-rotation/_rotation-tick.mjs  (state evaluation)
//   · scripts/nex-discovery-orchestrator/_orchestrator-tick.mjs (spawn)
//   · src/lib/nex-hq/workforce.ts (mirror · via TS reader · Phase 1 no mirror yet)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "..", "..", "data", "nex-job-registry.json");

/** Allowed target tables · extend when new category-family lands.
 *  Philip 2026-08-27 (Phase 2 marketplace): added nex.mp_seller so retail
 *  categories (electronics/fashion/hardware/etc.) can populate the marketplace
 *  seller universe via the same Phase 1 workforce infrastructure. */
const ALLOWED_TARGET_TABLES = Object.freeze([
  "nex.food_business",
  "nex.accommodation_business",
  "nex.service_business",
  "nex.mp_seller",
]);

/** Allowed strategy providers · Phase 1 · extend as strategies land. */
const ALLOWED_PROVIDERS = Object.freeze(["overpass", "nominatim", "own-website", "wikipedia"]);
const ALLOWED_QUERY_KINDS = Object.freeze(["tag", "keyword", "domain"]);

/**
 * Validate one job entry · throws with a specific error on any violation.
 * All validation happens at load time so bad JSON fails LOUD not silently.
 */
function validateJob(job, index, seenSlugs, seenIds) {
  const prefix = `job[${index}] (id=${job?.id ?? "?"})`;
  // Philip 2026-08-30 · Phase 3 expansion · registry goal is 100+ categories.
  // Widened to 2-3 digit IDs · existing 2-digit ids (01-61) stay stable, new
  // Phase 3 entries land in the 100-999 space.
  if (typeof job.id !== "string" || !/^\d{2,3}$/.test(job.id)) {
    throw new Error(`${prefix}: id must be a 2-3 digit string`);
  }
  if (job.active !== undefined && typeof job.active !== "boolean") {
    throw new Error(`${prefix}: active (when set) must be boolean`);
  }
  if (seenIds.has(job.id)) throw new Error(`${prefix}: duplicate id`);
  seenIds.add(job.id);
  if (typeof job.name !== "string" || !job.name) throw new Error(`${prefix}: name required`);
  if (typeof job.emoji !== "string" || !job.emoji) throw new Error(`${prefix}: emoji required`);
  if (typeof job.category_slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(job.category_slug)) {
    throw new Error(`${prefix}: category_slug must be lowercase-hyphenated`);
  }
  if (seenSlugs.has(job.category_slug)) throw new Error(`${prefix}: duplicate category_slug`);
  seenSlugs.add(job.category_slug);
  if (!ALLOWED_TARGET_TABLES.includes(job.target_table)) {
    throw new Error(`${prefix}: target_table must be one of ${ALLOWED_TARGET_TABLES.join(", ")}`);
  }
  if (!Array.isArray(job.strategies) || job.strategies.length === 0) {
    throw new Error(`${prefix}: strategies must be a non-empty array`);
  }
  job.strategies.forEach((s, si) => {
    const sp = `${prefix}.strategies[${si}]`;
    if (!ALLOWED_PROVIDERS.includes(s.provider)) {
      throw new Error(`${sp}: provider must be one of ${ALLOWED_PROVIDERS.join(", ")}`);
    }
    if (!ALLOWED_QUERY_KINDS.includes(s.query_kind)) {
      throw new Error(`${sp}: query_kind must be one of ${ALLOWED_QUERY_KINDS.join(", ")}`);
    }
    if (typeof s.params !== "object" || s.params === null) {
      throw new Error(`${sp}: params must be an object`);
    }
  });
  if (typeof job.geographic_scope !== "string" || !job.geographic_scope) {
    throw new Error(`${prefix}: geographic_scope required`);
  }
}

let _cached = null;

/** Load + validate the registry · caches after first successful read. */
export function loadJobRegistry({ force = false, path = REGISTRY_PATH } = {}) {
  if (_cached && !force) return _cached;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.jobs)) throw new Error("registry.jobs must be an array");
  const seenSlugs = new Set();
  const seenIds = new Set();
  parsed.jobs.forEach((j, i) => validateJob(j, i, seenSlugs, seenIds));
  _cached = { jobs: Object.freeze(parsed.jobs.map((j) => Object.freeze(j))) };
  return _cached;
}

/** Convenience · array of jobs (frozen). Includes inactive jobs · use activeJobs() when spawning walkers. */
export function allJobs() {
  return loadJobRegistry().jobs;
}

/** Only jobs currently eligible for the workforce (active !== false).
 *  Philip 2026-08-27 (Phase 2B): staged category activation · the escalation
 *  runner flips `active: true` on pending jobs when earlier waves saturate.
 *  Rotation-tick + orchestrator MUST consume this (not allJobs) so inactive
 *  categories don't generate rotation state rows or orchestrator picks. */
export function activeJobs() {
  return loadJobRegistry().jobs.filter((j) => j.active !== false);
}

/** Find a job by category_slug · throws if not found. */
export function jobBySlug(slug) {
  const j = allJobs().find((x) => x.category_slug === slug);
  if (!j) throw new Error(`no job with category_slug="${slug}" in registry`);
  return j;
}

/** Find a job by id · throws if not found. */
export function jobById(id) {
  const j = allJobs().find((x) => x.id === id);
  if (!j) throw new Error(`no job with id="${id}" in registry`);
  return j;
}

/** All ACTIVE category slugs · used by rotation-tick + orchestrator to enumerate
 *  walked categories. Inactive Phase 2B jobs are excluded until escalation flips
 *  them on. Philip 2026-08-27. */
export function jobCategorySlugs() {
  return activeJobs().map((j) => j.category_slug);
}

/** Reset cache · testing only. */
export function _resetCache() { _cached = null; }
