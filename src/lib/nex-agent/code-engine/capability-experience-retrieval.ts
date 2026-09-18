// src/lib/nex-agent/code-engine/capability-experience-retrieval.ts
//
// NEX1 · Fix 26 · Hippocampal Retrieval · Fix 17 Read-Side.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Fix 17 established an append-only JSONL store of investigation
//   conclusions at data/nex1-investigation-conclusions/entries.jsonl.
//   Until now that store has had no readers — a write-only "memory."
//   Fix 26 supplies the read-side: deterministic retrieval of prior
//   experience entries by source_file, selection_state, or candidate id.
//
//   CONSTITUTIONAL PRESERVATION
//   - R11-B enforced: retrieved evidence never enters R-4 SUPPORTING count.
//     This module only READS. Any consumer that wants to use retrieved
//     experience for selection must respect Q8 V2 v4's rules. This module
//     itself makes no selection.
//   - Q8 V2 v4 Sub-decisions A-E remain unresolved and are NOT silently
//     resolved here.
//   - Every returned record carries `evidence_kind: "INFERRED"` verbatim
//     from Fix 17. Nothing is upgraded.
//   - Fix 17 writer UNCHANGED.
//
//   Deterministic · zero LLM · zero external network.

import fs from "node:fs";
import path from "node:path";
import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";
import { getConclusionsStorePath } from "./investigation-conclusion-store";

// ── Public shape ─────────────────────────────────────────────────────────

export interface RetrievalQuery {
  readonly repo_root?: string;
  /** Filter by source_file (exact string match, repo-relative). */
  readonly source_file?: string;
  /** Filter by selection_state. */
  readonly selection_state?: InvestigationConclusionEntry["selection_state"];
  /** Filter by selected_candidate id (exact). */
  readonly selected_candidate?: string;
  /** Cap the returned entries. Default 50. */
  readonly max_entries?: number;
}

export type RetrievalRefusalKind =
  | "store_not_found"
  | "store_unreadable"
  | "empty_query_would_return_everything";

export interface RetrievalRefusal {
  readonly ok: false;
  readonly refusal_kind: RetrievalRefusalKind;
  readonly detail: string;
}

export interface RetrievalSuccess {
  readonly ok: true;
  readonly evidence_kind: "INFERRED";
  readonly entries: readonly InvestigationConclusionEntry[];
  readonly store_path: string;
  readonly total_entries_scanned: number;
  /** Retrieval-side R11-B marker: retrieved entries may INFORM investigation
   *  but MUST NOT satisfy R-4 SUPPORTING count. Consumers must respect. */
  readonly r11b_marker: "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

export type RetrievalResult = RetrievalSuccess | RetrievalRefusal;

// ── Implementation ───────────────────────────────────────────────────────

/** Load-and-parse the JSONL store. Skips malformed lines silently rather
 *  than throwing; malformed lines are counted separately. */
function readAllEntries(storePath: string): {
  entries: InvestigationConclusionEntry[];
  malformed: number;
} {
  if (!fs.existsSync(storePath)) return { entries: [], malformed: 0 };
  const raw = fs.readFileSync(storePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const entries: InvestigationConclusionEntry[] = [];
  let malformed = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      // Minimum required shape check — deterministic, no schema library.
      if (
        parsed &&
        typeof parsed.entry_id === "string" &&
        typeof parsed.source_file === "string" &&
        typeof parsed.selection_state === "string" &&
        parsed.evidence_kind === "INFERRED"
      ) {
        entries.push(parsed);
      } else {
        malformed++;
      }
    } catch {
      malformed++;
    }
  }
  return { entries, malformed };
}

export function retrieveExperience(query: RetrievalQuery): RetrievalResult {
  // Refuse queries that would return the entire store. Sub-decision A / C
  // require the caller to specify at least one filter.
  if (
    !query.source_file &&
    !query.selection_state &&
    !query.selected_candidate
  ) {
    return {
      ok: false,
      refusal_kind: "empty_query_would_return_everything",
      detail:
        "retrieval requires at least one filter (source_file | selection_state | selected_candidate)",
    };
  }
  const storePath = getConclusionsStorePath(query.repo_root);
  if (!fs.existsSync(storePath)) {
    return {
      ok: false,
      refusal_kind: "store_not_found",
      detail: `store not found at ${storePath}`,
    };
  }
  let all: { entries: InvestigationConclusionEntry[]; malformed: number };
  try {
    all = readAllEntries(storePath);
  } catch (err) {
    return {
      ok: false,
      refusal_kind: "store_unreadable",
      detail:
        err instanceof Error ? err.message.slice(0, 200) : String(err),
    };
  }
  const filtered = all.entries.filter((e) => {
    if (query.source_file && e.source_file !== query.source_file) return false;
    if (
      query.selection_state &&
      e.selection_state !== query.selection_state
    ) return false;
    if (
      query.selected_candidate &&
      e.selected_candidate !== query.selected_candidate
    ) return false;
    return true;
  });
  const capped = filtered.slice(
    0,
    typeof query.max_entries === "number" && query.max_entries > 0
      ? query.max_entries
      : 50,
  );
  return {
    ok: true,
    evidence_kind: "INFERRED",
    entries: capped,
    store_path: storePath,
    total_entries_scanned: all.entries.length,
    r11b_marker:
      "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
  };
}

/** Convenience: count entries matching a query without materialising them.
 *  Same refusal contract as retrieveExperience(). */
export function countExperience(query: RetrievalQuery): number | RetrievalRefusal {
  const r = retrieveExperience({ ...query, max_entries: 999999 });
  if (!r.ok) return r;
  return r.entries.length;
}

export const EXPERIENCE_RETRIEVAL_VERSION = "fix26.v1";
