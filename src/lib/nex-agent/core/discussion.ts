// src/lib/nex-agent/core/discussion.ts
//
// NEX Agent v1.1 · Multi-round discussion engine.
// nex1 ↔ nex2 ↔ nex3 debate in rounds until consensus (both reviewers pass in
// the SAME round) or MAX_ROUNDS is hit (no consensus · founder decides).
//
// Deterministic revision engine: no LLM. Every critique finding maps to a
// specific plan mutation. Reviewers' findings are consumable by nex1's revise().

import type { Plan, PlanStep, ReviewResult } from "./orchestrator-types";

export const MAX_ROUNDS = 5;

// ─── Revision engine · nex1 consumes critique + produces revised plan ─
export interface RevisionOutcome {
  revised_plan: Plan;
  changes_applied: string[];  // human-readable summary per change · shown in UI
  cannot_revise: string[];    // findings nex1 could NOT auto-fix · halts if consensus fails
}

export function reviseFromCritique(currentPlan: Plan, findings: ReviewResult["findings"]): RevisionOutcome {
  // Deep clone to avoid mutating the prior-round plan (which is durable in DB)
  const revised: Plan = JSON.parse(JSON.stringify(currentPlan));
  const changes_applied: string[] = [];
  const cannot_revise: string[] = [];

  for (const f of findings) {
    switch (f.rule) {
      case "protected_directory_touched": {
        // Location example: "db/migrations/TBD_TBD.sql ⊂ db/migrations/"
        const targetPath = String(f.location ?? "").split(" ⊂ ")[0];
        // If this is an ADDITIVE change (new file in an append-only dir like db/migrations),
        // annotate the plan with an "append-only ack" step rather than removing it.
        const isAppendOnlyDir = /^(db\/migrations\/|supabase\/migrations\/|docs\/DECISIONS\/)/.test(targetPath);
        if (isAppendOnlyDir) {
          revised.steps.unshift({
            number: 0,
            action: `[nex1 revision] Acknowledge ${targetPath.split("/")[0]}/ is append-only · adding a NEW file (not modifying an existing one) requires the file name to be numbered sequentially`,
            rationale: `Reviewer flagged '${f.detail}'. New numbered files in append-only dirs are permitted; modifications are not. Explicit ack + numbered filename.`,
          });
          changes_applied.push(`acknowledged append-only rule for ${targetPath.split("/")[0]}/ · numbered filename required`);
        } else {
          // Non-append-only protected dir · remove that path from the plan
          revised.files_to_touch = revised.files_to_touch.filter(p => p !== targetPath);
          revised.files_to_create = revised.files_to_create.filter(p => p !== targetPath);
          revised.risks.push(`Reviewer removed proposed path '${targetPath}' — protected directory. Alternative location required.`);
          changes_applied.push(`removed '${targetPath}' from plan · protected directory`);
        }
        break;
      }
      case "protected_file_touched": {
        const p = String(f.location ?? "");
        revised.files_to_touch = revised.files_to_touch.filter(x => x !== p);
        revised.files_to_create = revised.files_to_create.filter(x => x !== p);
        revised.risks.push(`Reviewer removed proposed path '${p}' — protected file.`);
        changes_applied.push(`removed protected file '${p}' from plan`);
        break;
      }
      case "forbidden_dependency":
      case "forbidden_string_pattern": {
        revised.risks.push(`Reviewer blocked: ${f.detail}${f.location ? ` (${f.location})` : ""}`);
        cannot_revise.push(`nex1 cannot auto-fix ${f.rule}: ${f.detail}`);
        break;
      }
      case "doctrine_phrase": {
        revised.risks.push(`Doctrine warning: ${f.detail}${f.location ? ` (${f.location})` : ""}`);
        changes_applied.push(`documented doctrine concern from ${f.location}`);
        break;
      }
      case "verification_missing": {
        // Add the missing gate to the plan
        if (f.detail.includes("typecheck") && !revised.verification_gates_to_run.includes("typecheck")) {
          revised.verification_gates_to_run.push("typecheck");
          changes_applied.push("added typecheck to verification gates");
        }
        if (f.detail.includes("architecture_scan") && !revised.verification_gates_to_run.includes("architecture_scan")) {
          revised.verification_gates_to_run.push("architecture_scan");
          changes_applied.push("added architecture_scan to verification gates");
        }
        break;
      }
      default:
        cannot_revise.push(`nex1 doesn't know how to revise finding '${f.rule}': ${f.detail}`);
    }
  }
  return { revised_plan: revised, changes_applied, cannot_revise };
}

// ─── Consensus predicate ────────────────────────────────────────
export function isConsensus(nex2: ReviewResult, nex3: ReviewResult): boolean {
  // Consensus requires BOTH reviewers to pass in the SAME round.
  return nex2.pass && nex3.pass;
}

// ─── Round summary formatter ────────────────────────────────────
export function summariseRound(round: number, nex2: ReviewResult, nex3: ReviewResult, revision?: RevisionOutcome): string {
  const parts: string[] = [`round ${round}`];
  parts.push(`nex2=${nex2.pass ? "✓" : "✗"}(${nex2.findings.length})`);
  parts.push(`nex3=${nex3.pass ? "✓" : "✗"}(${nex3.findings.length})`);
  if (revision) {
    parts.push(`revised=${revision.changes_applied.length}`);
    if (revision.cannot_revise.length > 0) parts.push(`stuck=${revision.cannot_revise.length}`);
  }
  return parts.join(" · ");
}
