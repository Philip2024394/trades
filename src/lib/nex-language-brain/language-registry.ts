// src/lib/nex-language-brain/language-registry.ts
//
// NEX1 · LANGUAGE REGISTRY + PROGRESSION GATE v0.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Discipline:
//   · Registry is a scaffold · NOT 32 language brains. Most entries honestly
//     say `status: scaffolded · score: unmeasured`. Zero fabricated 0%.
//   · Progression gate: a SCAFFOLDED language may only become ACTIVE by
//     explicit founder AUTHORISE AND after english AND bahasa_indonesia both
//     reach fluent + benchmark_complete + maturity=proven.
//   · This module never mutates the registry file · it only READS + REPORTS.
//     Founder ADR is the ONLY path to registry change.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Nex1LanguageId, Nex1BenchmarkMaturity, Nex1LevelBand } from "./language-scorecard";

export type LanguageStatus = "active" | "scaffolded";

export interface LanguageRegistryEntry {
  readonly id: string; // NOT constrained to Nex1LanguageId · registry is broader
  readonly display_name: string;
  readonly iso_639_1: string;
  readonly script: string;
  readonly direction: "ltr" | "rtl";
  readonly morphology: "analytic" | "agglutinative" | "fusional" | "isolating" | "root-and-pattern";
  readonly status: LanguageStatus;
  readonly primary_countries: readonly string[];
  readonly notes?: string;
}

export interface LanguageRegistry {
  readonly version: string;
  readonly progression_gate: {
    readonly rule: string;
    readonly next_priority: string;
    readonly next_priority_rationale: string;
    readonly cannot_advance_before: Readonly<Record<string, { readonly level: Nex1LevelBand; readonly benchmark_complete: boolean; readonly maturity: Nex1BenchmarkMaturity }>>;
  };
  readonly languages: readonly LanguageRegistryEntry[];
}

let CACHED: LanguageRegistry | null = null;

/**
 * @summary Load the registry from disk · cached for the process lifetime.
 * Never mutates the file. A change to the registry means a founder ADR.
 */
export function loadLanguageRegistry(): LanguageRegistry {
  if (CACHED) return CACHED;
  const p = resolve(process.cwd(), "data/nex1-language-brain/language-registry.json");
  CACHED = JSON.parse(readFileSync(p, "utf8")) as LanguageRegistry;
  return CACHED;
}

/**
 * @summary Test-only: reset the module-level cache so tests can point at a
 * different registry fixture without a process restart.
 */
export function _resetRegistryCacheForTest(): void {
  CACHED = null;
}

export interface ProgressionGateInput {
  readonly language_id: string;
  readonly english_state?: { readonly level: Nex1LevelBand; readonly benchmark_complete: boolean; readonly maturity: Nex1BenchmarkMaturity };
  readonly bahasa_indonesia_state?: { readonly level: Nex1LevelBand; readonly benchmark_complete: boolean; readonly maturity: Nex1BenchmarkMaturity };
}
export type ProgressionGateVerdict =
  | { readonly allowed: true; readonly reason: string }
  | { readonly allowed: false; readonly reason: string; readonly refusal_class: "refused_language_lab_not_authorised" };

/**
 * @summary Enforce the progression gate. Returns { allowed: true } only when:
 *   · language is in the registry AND
 *   · language is `active` (already unlocked)  OR
 *   · language is `scaffolded` AND english+bahasa_indonesia BOTH pass the
 *     "cannot_advance_before" bar.
 *
 * The check is EVIDENCE-BASED · no calendar / no time-based advance.
 * Backslide by design: if english regresses below fluent, previously-active
 * languages are NOT auto-demoted (immutable history), but no NEW scaffolded
 * languages may be promoted until english recovers.
 */
export function checkProgressionGate(
  input: ProgressionGateInput,
  registry: LanguageRegistry = loadLanguageRegistry(),
): ProgressionGateVerdict {
  const entry = registry.languages.find((l) => l.id === input.language_id);
  if (!entry) {
    return {
      allowed: false,
      reason: `language '${input.language_id}' not in registry v${registry.version}`,
      refusal_class: "refused_language_lab_not_authorised",
    };
  }
  if (entry.status === "active") {
    return { allowed: true, reason: `language '${input.language_id}' is ACTIVE in registry v${registry.version}` };
  }
  // scaffolded · gate check
  const gate = registry.progression_gate.cannot_advance_before;
  const englishReq = gate["english"];
  const idReq = gate["bahasa_indonesia"];
  const enOK = !!(input.english_state
    && input.english_state.level === englishReq.level
    && input.english_state.benchmark_complete === englishReq.benchmark_complete
    && input.english_state.maturity === englishReq.maturity);
  const idOK = !!(input.bahasa_indonesia_state
    && input.bahasa_indonesia_state.level === idReq.level
    && input.bahasa_indonesia_state.benchmark_complete === idReq.benchmark_complete
    && input.bahasa_indonesia_state.maturity === idReq.maturity);
  if (enOK && idOK) {
    return {
      allowed: false,
      reason: `language '${input.language_id}' is scaffolded · foundation criteria met but explicit founder AUTHORISE still required to activate`,
      refusal_class: "refused_language_lab_not_authorised",
    };
  }
  const missing: string[] = [];
  if (!enOK) missing.push(`english not yet ${englishReq.level}+${englishReq.maturity}`);
  if (!idOK) missing.push(`bahasa_indonesia not yet ${idReq.level}+${idReq.maturity}`);
  return {
    allowed: false,
    reason: `language '${input.language_id}' is scaffolded · foundation criteria unmet: ${missing.join(" · ")}`,
    refusal_class: "refused_language_lab_not_authorised",
  };
}

/**
 * @summary Which registry entry corresponds to a given Nex1LanguageId (the
 * scorecard's smaller union)? Not every registry entry maps to a Nex1LanguageId
 * yet · this returns null for scaffolded ones.
 */
export function scorecardIdToRegistryId(langId: Nex1LanguageId): string | null {
  switch (langId) {
    case "english": return "english";
    case "bahasa_indonesia": return "bahasa_indonesia";
    // code_switch + programming are cross-language modes · not registry entries
    default: return null;
  }
}
