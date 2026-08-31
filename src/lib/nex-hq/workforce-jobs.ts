// src/lib/nex-hq/workforce-jobs.ts
//
// TypeScript reader for data/nex-job-registry.json.
// Mirrors scripts/nex-workforce/_job-registry.mjs · single source of truth is
// the JSON. Adding a job = one JSON entry · both loaders pick it up.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface JobStrategy {
  provider: "overpass" | "nominatim" | "own-website" | "wikipedia";
  query_kind: "tag" | "keyword" | "domain";
  params: Record<string, unknown>;
}
export interface JobEntry {
  id: string;
  name: string;
  emoji: string;
  category_slug: string;
  target_table: "nex.food_business" | "nex.accommodation_business" | "nex.service_business";
  strategies: JobStrategy[];
  geographic_scope: string;
}

let _cached: JobEntry[] | null = null;

export function loadJobs(): JobEntry[] {
  if (_cached) return _cached;
  const registryPath = join(process.cwd(), "data", "nex-job-registry.json");
  const raw = readFileSync(registryPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.jobs)) {
    throw new Error("nex-job-registry.json · .jobs must be an array");
  }
  _cached = parsed.jobs as JobEntry[];
  return _cached;
}
