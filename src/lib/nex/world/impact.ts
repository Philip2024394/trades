// Impact analysis — "what happens if I delay X?".
//
// Runs a bounded traversal from the change target + reports the
// affected entities with a plain-English reason per effect. Never
// mutates anything.

import { loadEntityCloud } from "./entities";
import { evidenceFor, type ImpactAnalysis, type ImpactChange, type ImpactEffect } from "./types";

export type BuildImpactInput = {
  change: ImpactChange;
};

export async function buildImpactAnalysis(input: BuildImpactInput): Promise<ImpactAnalysis> {
  const { change } = input;
  const evidence = evidenceFor("world impact traversal", []);
  const warnings: string[] = [];

  const cloud = await loadEntityCloud({ kind: change.target.kind, id: change.target.id, depth: 2 });
  if (!cloud) {
    warnings.push("Change target not found — nothing to analyse.");
    return { change, effects: [], warnings, evidence };
  }

  const effects: ImpactEffect[] = [];

  // Simple, honest rules — one effect per relationship kind.
  for (const rel of cloud.relationships) {
    if (rel.from.kind !== change.target.kind || rel.from.id !== change.target.id) continue;
    switch (change.kind) {
      case "delay": {
        if (rel.to.kind === "cost") {
          effects.push({
            affected: rel.to,
            severity: "notice",
            headline: `Cost "${rel.to.label}" waits with the job — payment timing slips.`,
            reason:   "Costs paid on project completion move with the job's actual end date.",
            evidence
          });
        }
        if (rel.to.kind === "job") {
          effects.push({
            affected: rel.to,
            severity: "warning",
            headline: `Job "${rel.to.label}" rescheduled — customer needs a heads-up.`,
            reason:   change.detail || "The scheduled_end_date needs pushing to keep the timeline honest.",
            evidence
          });
        }
        if (rel.to.kind === "photo") {
          effects.push({
            affected: rel.to,
            severity: "info",
            headline: `Photo timeline gap — next milestone photo lands later.`,
            reason:   "Delay means the next progress photo happens further out.",
            evidence
          });
        }
        break;
      }
      case "cancel": {
        if (rel.to.kind === "cost") {
          effects.push({
            affected: rel.to,
            severity: "warning",
            headline: `Cost "${rel.to.label}" needs cancelling too — check if paid deposits are refundable.`,
            reason:   "Costs referencing this target become orphans if left untouched.",
            evidence
          });
        }
        if (rel.to.kind === "job") {
          effects.push({
            affected: rel.to,
            severity: "warning",
            headline: `Job "${rel.to.label}" must be closed — mark status=cancelled.`,
            reason:   "Job-diary rows that reference the cancelled target need an explicit close.",
            evidence
          });
        }
        break;
      }
      case "reprice":
        if (rel.to.kind === "cost") {
          effects.push({
            affected: rel.to,
            severity: "notice",
            headline: `Cost "${rel.to.label}" is priced against the original quote — margin may shift.`,
            reason:   "Costs sit against the original quoted number; re-quoting changes margin bands.",
            evidence
          });
        }
        break;
      case "reassign":
        if (rel.to.kind === "job") {
          effects.push({
            affected: rel.to,
            severity: "notice",
            headline: `Job "${rel.to.label}" will move to the new assignee — confirm they have capacity.`,
            reason:   "Job-diary rows need the merchant/assignee updated.",
            evidence
          });
        }
        break;
    }
  }

  if (effects.length === 0) warnings.push("No relationships walked from this target — either it's an isolated entity or the source tables don't yet capture the link.");

  return { change, effects, warnings, evidence };
}
