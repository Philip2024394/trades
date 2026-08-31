// NEX Indonesia · Geographic hierarchy + coverage tracking.
//
// Authoritative registry of the 38 provinces of Indonesia (post-2022
// Papua split). Backed by data/indonesia/geo/provinces.json which is
// a single source of truth for provinces + islands + regions +
// capitals + ISO 3166-2 codes.
//
// The coverage matrix is the "which parts of Indonesia have we NOT
// covered yet?" question the mandate calls out as one of the most
// important HQ metrics.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROVINCES_FILE = path.resolve(here, "../../../../../data/indonesia/geo/provinces.json");

export type Province = {
  /** ISO 3166-2 subdivision code (e.g. "ID-BA"). */
  code: string;
  /** NEX-internal slug (kebab-case, stable). */
  slug: string;
  /** Display name in English. */
  name: string;
  /** Major island grouping. */
  island: "Sumatra" | "Java" | "Kalimantan" | "Sulawesi" | "Bali" | "Nusa Tenggara" | "Maluku" | "Papua";
  /** Sub-regional label within the island. */
  region: string;
  /** Provincial capital. */
  capital: string;
};

let CACHE: Province[] | null = null;

function loadProvinces(): Province[] {
  if (CACHE) return CACHE;
  try {
    CACHE = JSON.parse(readFileSync(PROVINCES_FILE, "utf8")) as Province[];
  } catch {
    CACHE = [];
  }
  return CACHE;
}

export function listProvinces(): readonly Province[] {
  return loadProvinces();
}

export function provinceCount(): number {
  return loadProvinces().length;
}

export function provinceBySlug(slug: string): Province | undefined {
  return loadProvinces().find((p) => p.slug === slug);
}

export function provinceByCode(code: string): Province | undefined {
  return loadProvinces().find((p) => p.code === code);
}

/** Resolve any of "Bali", "bali", "ID-BA", "Denpasar" to the province. */
export function resolveProvince(input: string): Province | undefined {
  const s = input.trim();
  const lower = s.toLowerCase();
  const provinces = loadProvinces();
  return (
    provinces.find((p) => p.code === s) ||
    provinces.find((p) => p.slug === lower) ||
    provinces.find((p) => p.name.toLowerCase() === lower) ||
    provinces.find((p) => p.capital.toLowerCase() === lower) ||
    undefined
  );
}

export function provincesByIsland(island: Province["island"]): readonly Province[] {
  return loadProvinces().filter((p) => p.island === island);
}

export const ISLANDS: Array<Province["island"]> = [
  "Sumatra", "Java", "Kalimantan", "Sulawesi", "Bali", "Nusa Tenggara", "Maluku", "Papua",
];

// ─── Coverage matrix ──────────────────────────────────────────────

export type CoverageStatus =
  | "not_covered"      // no walker has ever produced a record for this cell
  | "partial"          // some records but below target
  | "covered"          // meets target
  | "stale"            // was covered but now past refresh window
  | "failed";          // recent acquisition attempts failed

export type CoverageCell = {
  province: string;    // province slug
  category: string;    // walker branch or specific category ("food.halal", "safety.weather", …)
  status: CoverageStatus;
  recordCount: number;
  lastAcquiredAt?: string;
  targetRecords?: number;
};

export type CoverageMatrix = {
  cells: CoverageCell[];
  totals: {
    provinces: number;
    categories: number;
    covered: number;
    partial: number;
    stale: number;
    failed: number;
    notCovered: number;
    coveragePct: number;
  };
};

export type CoverageObservation = {
  province: string;      // slug
  category: string;
  recordCount?: number;
  lastAcquiredAt?: string;
  status?: CoverageStatus;
  targetRecords?: number;
};

/** Build the province × category coverage matrix from a set of
 *  observations. Observations describe what walkers have produced;
 *  cells default to "not_covered" for province/category combos with
 *  no observations. */
export function buildCoverageMatrix(
  observations: CoverageObservation[],
  categories: string[],
  opts: { targetPerCell?: number } = {},
): CoverageMatrix {
  const provinces = loadProvinces();
  const targetPerCell = opts.targetPerCell ?? 1;
  const byKey = new Map<string, CoverageObservation>();
  for (const o of observations) byKey.set(`${o.province}::${o.category}`, o);

  const cells: CoverageCell[] = [];
  for (const p of provinces) {
    for (const c of categories) {
      const key = `${p.slug}::${c}`;
      const obs = byKey.get(key);
      const recordCount = obs?.recordCount ?? 0;
      const status: CoverageStatus =
        obs?.status ??
        (recordCount === 0 ? "not_covered" :
         recordCount < targetPerCell ? "partial" :
         "covered");
      cells.push({
        province: p.slug,
        category: c,
        status,
        recordCount,
        lastAcquiredAt: obs?.lastAcquiredAt,
        targetRecords: obs?.targetRecords ?? targetPerCell,
      });
    }
  }

  const totals = {
    provinces: provinces.length,
    categories: categories.length,
    covered: cells.filter((c) => c.status === "covered").length,
    partial: cells.filter((c) => c.status === "partial").length,
    stale: cells.filter((c) => c.status === "stale").length,
    failed: cells.filter((c) => c.status === "failed").length,
    notCovered: cells.filter((c) => c.status === "not_covered").length,
    coveragePct: 0,
  };
  totals.coveragePct = cells.length === 0 ? 0 : Math.round((totals.covered / cells.length) * 100);

  return { cells, totals };
}

/** Group the coverage matrix by province · returns a per-province
 *  summary useful for HQ's "which parts of Indonesia are behind"
 *  view. */
export function summariseByProvince(matrix: CoverageMatrix): Array<{ province: string; islandName: string; covered: number; total: number; pct: number }> {
  const provinces = loadProvinces();
  const byProv = new Map<string, { covered: number; total: number }>();
  for (const c of matrix.cells) {
    const s = byProv.get(c.province) ?? { covered: 0, total: 0 };
    s.total++;
    if (c.status === "covered" || c.status === "partial") s.covered++;
    byProv.set(c.province, s);
  }
  return provinces.map((p) => {
    const s = byProv.get(p.slug) ?? { covered: 0, total: 0 };
    return {
      province: p.name,
      islandName: p.island,
      covered: s.covered,
      total: s.total,
      pct: s.total === 0 ? 0 : Math.round((s.covered / s.total) * 100),
    };
  });
}
