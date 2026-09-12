// src/lib/nex/master-ai/connectivity-regulation.ts
//
// NEX Master AI Engineer · Wave 4 · W4-B · Regulation findings ledger
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// Every finding about Indonesian (or any other jurisdiction's)
// connectivity regulation lives here. Findings are APPEND-ONLY,
// carry an AuthorityTier, a ConnectivityLegalCategory, and a
// citation. Nothing is presented as fact without evidence.
//
// PRESERVATION:
//   · Category is MANDATORY on every write — UNKNOWN is a valid
//     category · missing category is an error.
//   · Empty ledger produces `no_findings_yet` on query — never
//     invented data.
//   · Findings never mutate existing records; corrections append
//     a new record with `supersedes` set.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { connectivityFindingsPath, connectivityInvestigationsPath } from "./paths";
import type { AuthorityTier } from "./types";
import type { ConnectivityLegalCategory } from "./connectivity-domain";
import type { WhoPays } from "./connectivity-mission-domain";

export type ConnectivityFinding = {
  finding_id: string;
  created_at_iso: string;
  jurisdiction: string;                           // "ID" (Indonesia) · "GLOBAL" · ISO country code
  topic: "SPECTRUM" | "LICENSING" | "EQUIPMENT" | "OPERATOR" | "PILOT_PROGRAMME" | "OTHER";
  band_slug: string | null;                       // ref to SPECTRUM_CATALOGUE
  architecture_slug: string | null;               // ref to ARCHITECTURE_CATALOGUE
  business_model_slug: string | null;             // ref to BUSINESS_MODEL_CATALOGUE
  category: ConnectivityLegalCategory;            // MANDATORY
  authority_tier: AuthorityTier;
  statement: string;
  citation: string;                               // regulator URL / gazette / paper
  evidence_ref: string | null;                    // ref to research_findings.jsonl finding_id
  uncertainty_note: string | null;                // required if UNKNOWN
  supersedes: string | null;                      // prior finding_id if this corrects it
  created_by: string;
  who_pays?: WhoPays | null;                      // OPTIONAL · added in global mission · backward-compatible
};

export class InvalidFindingError extends Error {
  constructor(reason: string) { super(`invalid_finding:${reason}`); }
}

export function recordConnectivityFinding(input: Omit<ConnectivityFinding, "finding_id" | "created_at_iso">): ConnectivityFinding {
  if (!input.jurisdiction || input.jurisdiction.length < 2) throw new InvalidFindingError("jurisdiction");
  if (!input.category) throw new InvalidFindingError("category_required");
  if (!input.statement || input.statement.trim().length < 3) throw new InvalidFindingError("statement_too_short");
  if (input.category === "UNKNOWN" && !input.uncertainty_note) throw new InvalidFindingError("uncertainty_note_required_for_unknown");
  const finding: ConnectivityFinding = {
    ...input,
    finding_id: randomUUID(),
    created_at_iso: new Date().toISOString(),
  };
  appendJsonLine(connectivityFindingsPath(), finding);
  return finding;
}

export function readAllConnectivityFindings(): ConnectivityFinding[] {
  return readJsonlAll<ConnectivityFinding>(connectivityFindingsPath());
}

/** Returns the latest non-superseded findings per jurisdiction+topic+band. */
export function currentFindings(filter?: {
  jurisdiction?: string;
  category?: ConnectivityLegalCategory;
  topic?: ConnectivityFinding["topic"];
}): ConnectivityFinding[] {
  const all = readAllConnectivityFindings();
  const superseded = new Set<string>();
  for (const f of all) if (f.supersedes) superseded.add(f.supersedes);
  return all
    .filter((f) => !superseded.has(f.finding_id))
    .filter((f) => !filter?.jurisdiction || f.jurisdiction === filter.jurisdiction)
    .filter((f) => !filter?.category || f.category === filter.category)
    .filter((f) => !filter?.topic || f.topic === filter.topic);
}

/** Categorisation summary — how many findings fall in each bucket. */
export function categorisationSummary(jurisdiction?: string): Record<ConnectivityLegalCategory, number> {
  const out: Record<ConnectivityLegalCategory, number> = {
    ALLOWED_NOW: 0, REQUIRES_LICENSE: 0, REQUIRES_PARTNERSHIP: 0, POSSIBLE_PILOT: 0, UNKNOWN: 0,
  };
  for (const f of currentFindings({ jurisdiction })) out[f.category]++;
  return out;
}

// ─── Connectivity investigation (drives the research queue) ─────────

export type ConnectivityInvestigation = {
  investigation_id: string;
  created_at_iso: string;
  question: string;
  jurisdiction: string;
  status: "OPEN" | "COMPLETED" | "ABANDONED";
  target_source_slugs: string[];
  linked_research_query_ids: string[];
  linked_finding_ids: string[];
  created_by: string;
};

export function openInvestigation(input: {
  question: string;
  jurisdiction: string;
  target_source_slugs: string[];
  created_by: string;
}): ConnectivityInvestigation {
  const inv: ConnectivityInvestigation = {
    investigation_id: randomUUID(),
    created_at_iso: new Date().toISOString(),
    status: "OPEN",
    linked_research_query_ids: [],
    linked_finding_ids: [],
    ...input,
  };
  appendJsonLine(connectivityInvestigationsPath(), inv);
  return inv;
}

export function readAllInvestigations(): ConnectivityInvestigation[] {
  return readJsonlAll<ConnectivityInvestigation>(connectivityInvestigationsPath());
}

/** Append an updated version of an investigation (append-only pattern). */
export function updateInvestigation(input: {
  investigation_id: string;
  linked_research_query_id?: string;
  linked_finding_id?: string;
  new_status?: "OPEN" | "COMPLETED" | "ABANDONED";
}): ConnectivityInvestigation | null {
  const latest = readAllInvestigations().filter((i) => i.investigation_id === input.investigation_id).slice(-1)[0];
  if (!latest) return null;
  const next: ConnectivityInvestigation = {
    ...latest,
    linked_research_query_ids: input.linked_research_query_id
      ? Array.from(new Set([...latest.linked_research_query_ids, input.linked_research_query_id]))
      : latest.linked_research_query_ids,
    linked_finding_ids: input.linked_finding_id
      ? Array.from(new Set([...latest.linked_finding_ids, input.linked_finding_id]))
      : latest.linked_finding_ids,
    status: input.new_status ?? latest.status,
  };
  appendJsonLine(connectivityInvestigationsPath(), next);
  return next;
}

export function _resetConnectivityForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [connectivityFindingsPath(), connectivityInvestigationsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
