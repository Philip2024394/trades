// src/lib/nex/brains/_coverage.ts
//
// Coverage Map + per-module Knowledge Health · Phase 2 observability
// (ADR-0038 · Philip 2026-07-28)
//
// Reads the current published version's modules_json and reports
// per-module coverage against the Phase 3 expected module set for
// Staircase Brain (materials · construction · manufacturing ·
// installation · design · regulations · maintenance · fault_finding ·
// estimating · terminology · safety · tools). Other brains fall back
// to their own declared module set — no assumption is made about
// module count for non-staircase brains.
//
// This is observability. It reads existing data. It does not require
// any new tables (per ADR-0038 + ADR-0041).

import { brainSupabase, brainSupabaseAvailable, getCurrentBrainVersion } from "./_supabase";

// ---------- Types ----------

export type ModuleCoverage = {
  module: string;
  is_expected: boolean;              // in the Phase 3 expected set for this trade
  is_authored: boolean;              // module key exists on current version
  content_size_bytes: number;        // rough proxy for depth · 0 when not authored
  content_entries: number | null;    // when the module is an array/object · count of top-level entries
  coverage_pct: number;              // 0-100 · content-fill heuristic
  status: "excellent" | "good" | "developing" | "empty" | "missing";
  unknowns_this_module: number | null; // when trackable via answers table
};

export type CoverageAssessment = {
  brain_slug: string;
  overall_pct: number;               // avg coverage across expected modules
  authored_expected: number;
  expected_total: number;
  modules: ModuleCoverage[];
  computed_at: string;
  source: "current_version" | "empty";
};

// Trade-specific expected module sets. Staircase Brain uses the Phase 3
// brief list. New trades ship without pre-defined expected sets — the
// author-driven rule (ADR-0041) means we let the first brain of that
// trade reveal what "complete" means.
const EXPECTED_MODULES: Record<string, string[]> = {
  staircase: [
    "materials", "construction", "manufacturing", "installation",
    "design", "regulations", "maintenance", "fault_finding",
    "estimating", "terminology", "safety", "tools",
  ],
};

// ---------- Public API ----------

export async function computeCoverage(brain_slug: string, trade: string | null = "staircase"): Promise<CoverageAssessment> {
  const computed_at = new Date().toISOString();

  if (!brainSupabaseAvailable()) {
    return emptyAssessment(brain_slug, computed_at, "supabase_unavailable");
  }

  const version = await getCurrentBrainVersion(brain_slug);
  if (!version) {
    return emptyAssessment(brain_slug, computed_at, "no_current_version", trade);
  }

  const modulesJson = (version.modules_json ?? {}) as Record<string, unknown>;
  const authoredKeys = Object.keys(modulesJson);

  const tradeKey = trade?.toLowerCase() ?? "staircase";
  const expected = EXPECTED_MODULES[tradeKey] ?? authoredKeys; // for unknown trades, expected == authored (no false gaps)

  // Union of expected + authored so we surface unexpected modules too.
  const unionKeys = Array.from(new Set([...expected, ...authoredKeys]));

  const modules: ModuleCoverage[] = unionKeys.map((key) => {
    const authored = key in modulesJson;
    const value = authored ? modulesJson[key] : null;
    const bytes = authored ? JSON.stringify(value).length : 0;
    const entries = authored ? countEntries(value) : null;
    const coverage_pct = computeModuleCoveragePct(authored, bytes, entries);
    const status = statusFromPct(authored, coverage_pct);
    return {
      module: key,
      is_expected: expected.includes(key),
      is_authored: authored,
      content_size_bytes: bytes,
      content_entries: entries,
      coverage_pct,
      status,
      unknowns_this_module: null, // per-module unknown attribution requires answer tagging · Phase 3
    };
  });

  // Sort: expected-missing first (biggest gap), then by coverage ascending.
  modules.sort((a, b) => {
    const aMissing = a.is_expected && !a.is_authored ? 0 : 1;
    const bMissing = b.is_expected && !b.is_authored ? 0 : 1;
    if (aMissing !== bMissing) return aMissing - bMissing;
    return a.coverage_pct - b.coverage_pct;
  });

  const expectedModulesList = modules.filter((m) => m.is_expected);
  const authored_expected = expectedModulesList.filter((m) => m.is_authored).length;
  const overall_pct = expectedModulesList.length > 0
    ? Math.round(expectedModulesList.reduce((s, m) => s + m.coverage_pct, 0) / expectedModulesList.length)
    : 0;

  return {
    brain_slug,
    overall_pct,
    authored_expected,
    expected_total: expected.length,
    modules,
    computed_at,
    source: "current_version",
  };
}

// ---------- Helpers ----------

function countEntries(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return null;
}

function computeModuleCoveragePct(authored: boolean, bytes: number, entries: number | null): number {
  if (!authored) return 0;
  // Heuristic ladder — deliberately coarse (per ADR-0040 · number is footnote, not primary).
  // ~10KB or ≥20 entries reads as "excellent" coverage; empty stubs read as ~10%.
  if (bytes < 200) return 10;
  if (bytes < 1000 || (entries !== null && entries < 3)) return 35;
  if (bytes < 5000 || (entries !== null && entries < 10)) return 65;
  if (bytes < 10000 || (entries !== null && entries < 20)) return 85;
  return 95;
}

function statusFromPct(authored: boolean, pct: number): ModuleCoverage["status"] {
  if (!authored) return "missing";
  if (pct >= 85) return "excellent";
  if (pct >= 60) return "good";
  if (pct >= 20) return "developing";
  return "empty";
}

function emptyAssessment(brain_slug: string, computed_at: string, reason: string, trade: string | null = "staircase"): CoverageAssessment {
  const tradeKey = trade?.toLowerCase() ?? "staircase";
  const expected = EXPECTED_MODULES[tradeKey] ?? [];
  return {
    brain_slug,
    overall_pct: 0,
    authored_expected: 0,
    expected_total: expected.length,
    modules: expected.map((key) => ({
      module: key,
      is_expected: true,
      is_authored: false,
      content_size_bytes: 0,
      content_entries: null,
      coverage_pct: 0,
      status: "missing" as const,
      unknowns_this_module: null,
    })),
    computed_at: `${computed_at} (${reason})`,
    source: "empty",
  };
}
