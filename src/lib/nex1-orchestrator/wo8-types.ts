// WO-WORKSTATION-08 · engineering evidence persistence types
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// WO-08 makes the reports produced by WO-04..WO-07 durable in NEX GB storage.
// This is the substrate WO-09 (correction/rebuild loop) reads to decide what
// to fix next.

import type { ExecutionReport } from "./wo4-types";
import type { BuildReport } from "./wo5-types";
import type { RuntimeReport } from "./wo6-types";
import type { SpecialistResult } from "./wo7-types";

// ── Unified engineering history entry ───────────────────────────────────
//
// Discriminated union so WO-09's diagnosis logic can pattern-match on
// entry.kind and pull the specific fields it needs. Every entry carries
// the same started_at so the merged stream sorts chronologically.

export type EngineeringHistoryEntry =
  | { readonly kind: "execution"; readonly started_at: string; readonly report: ExecutionReport }
  | { readonly kind: "build";     readonly started_at: string; readonly report: BuildReport }
  | { readonly kind: "runtime";   readonly started_at: string; readonly report: RuntimeReport }
  | { readonly kind: "specialist"; readonly started_at: string; readonly result: SpecialistResult };

// ── Failure codes ───────────────────────────────────────────────────────

export type PersistFailureCode =
  | "REPORT_MISSING_ID"
  | "REPORT_MISSING_TRACE_ID"
  | "STORAGE_UNAVAILABLE";

export type PersistResult =
  | { ok: true; already_present: boolean }
  | { ok: false; reason_code: PersistFailureCode; reason: string };
