// src/lib/nex-hq/worker-config-resolver.ts
//
// SINGLE resolver from worker_cycle_run.worker_config → { city, category }.
// Extracted 2026-08-24 so `/discovery` NOW WORKING · NEXT · RECENTLY COMPLETED
// panels never silently render "unknown / unknown" when a non-acquisition
// worker (comms · staircase · brain-* · etc.) slips into the query.
//
// Doctrine (Philip 2026-08-24):
//   · Every completed acquisition cycle MUST resolve to a real city/category
//   · Non-acquisition worker_configs MUST NOT display fake values · they
//     surface as { unresolved: true, rawConfig } and callers filter them out
//   · New worker_config format = add here + add a regression test · never
//     invent silently

import { CITY_REGISTRY } from "@/lib/nex/city-registry";
import { WALKED_CATEGORIES } from "./discovery-rotation";

export interface ResolvedCombo {
  resolved: true;
  city: string;                 // canonical city name (e.g. "Kulon Progo")
  category: string;             // "food" | "accommodation" | "market" | "transport"
  rawConfig: string;
}
export interface UnresolvedCombo {
  resolved: false;
  rawConfig: string;
}
export type WorkerConfigResolution = ResolvedCombo | UnresolvedCombo;

// Registry of all acquisition worker_config patterns currently produced by
// the walkers. Add a row here when a new walker/category ships · covered by
// worker-config-resolver.test.ts. NEVER catch-all wildcards · every pattern
// must be intentional.
interface WorkerConfigPattern {
  category: string;
  // Matcher receives the raw worker_config string and returns the canonical
  // city name (or null if the pattern doesn't apply).
  match: (cfg: string) => string | null;
}

function marketCityFromConfig(cfg: string): string | null {
  // e.g. "market:kulon-progo:nominatim" · "market:yogyakarta-city:nominatim"
  //      "market:central-java-magelang:nominatim"
  if (!cfg.startsWith("market:")) return null;
  const tail = cfg.slice("market:".length);
  const cityToken = tail.split(":")[0];
  if (!cityToken) return null;
  // Match against city-registry · try slug-form (hyphenated lowercase) first.
  const norm = cityToken.toLowerCase();
  for (const c of CITY_REGISTRY) {
    if (c.slug === norm) return c.canonical;
  }
  // Handle market walker legacy zone ids like "yogyakarta-city" and
  // "central-java-{city}" (from scripts/nex-shop/_market-walker-discover.mjs).
  if (norm === "yogyakarta-city") return "Yogyakarta";
  const cjMatch = norm.match(/^central-java-(.+)$/);
  if (cjMatch) {
    const cjCity = cjMatch[1];
    for (const c of CITY_REGISTRY) {
      if (c.slug === cjCity) return c.canonical;
    }
  }
  return null;
}

function categoryCityFromConfig(category: "food" | "accommodation" | "transport", cfg: string): string | null {
  // e.g. "food:Sleman:prambanan" · "accommodation:Kulon Progo:prambanan"
  //      "transport:Sleman:query-universe-v1"
  const prefix = `${category}:`;
  if (!cfg.startsWith(prefix)) return null;
  const tail = cfg.slice(prefix.length);
  // City segment is the substring up to the LAST colon (city may contain
  // spaces but never colons · e.g. "Kulon Progo:prambanan").
  const lastColon = tail.lastIndexOf(":");
  const cityToken = lastColon >= 0 ? tail.slice(0, lastColon) : tail;
  if (!cityToken) return null;
  for (const c of CITY_REGISTRY) {
    if (c.canonical === cityToken) return c.canonical;
  }
  return null;
}

const PATTERNS: WorkerConfigPattern[] = [
  { category: "market",        match: marketCityFromConfig },
  { category: "food",          match: (cfg) => categoryCityFromConfig("food", cfg) },
  { category: "accommodation", match: (cfg) => categoryCityFromConfig("accommodation", cfg) },
  { category: "transport",     match: (cfg) => categoryCityFromConfig("transport", cfg) },
];

/**
 * Resolve worker_config → { city, category } · or Unresolved for non-acquisition
 * configs (comms · staircase · brain-* · anything else).
 */
export function resolveWorkerConfig(cfg: string | null | undefined): WorkerConfigResolution {
  const raw = String(cfg ?? "");
  if (!raw) return { resolved: false, rawConfig: raw };
  for (const p of PATTERNS) {
    const city = p.match(raw);
    if (city) return { resolved: true, city, category: p.category, rawConfig: raw };
  }
  return { resolved: false, rawConfig: raw };
}

/**
 * True when the worker_config is one of NEX's acquisition patterns.
 * Callers use this to filter Recently Completed to only acquisition cycles.
 */
export function isAcquisitionWorkerConfig(cfg: string | null | undefined): boolean {
  return resolveWorkerConfig(cfg).resolved;
}

/**
 * Suffixes for the recently-completed SQL filter · SQL LIKE patterns that
 * match ONLY acquisition worker_configs · rejects comms/staircase/brain-*.
 */
export const ACQUISITION_CONFIG_SQL_LIKE: string[] = WALKED_CATEGORIES.map((c) => `${c}:%`);
