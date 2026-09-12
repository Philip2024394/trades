// src/lib/nex-agent/code-engine/nex1-decision-trail.ts
//
// Records the ten NEX1-owned decisions per Amendment 1. Every completed task
// carries a trail that proves NEX1 (not the adapter) decided each step.

import type { Nex1DecisionTrail } from "./types";

export class Nex1DecisionTrailBuilder {
  private trail: Partial<Nex1DecisionTrail> = {
    files_selected: [],
    tests_run: [],
    candidate_rejected_count: 0,
    diff_evaluated: "not_applicable",
    repair_attempts: 0,
    diagnosis_notes: "",
    evidence_recorded_at: null,
    completion_decided_at: null,
  };

  interpretTask(hash: string): void {
    this.trail.task_interpretation = { at: new Date().toISOString(), hash };
  }
  selectFiles(paths: readonly string[]): void {
    this.trail.files_selected = [...paths];
  }
  composeContext(hash: string): void {
    this.trail.context_composed_hash = hash;
  }
  acceptCandidate(accepted: boolean): void {
    this.trail.candidate_accepted = accepted;
    if (!accepted) this.trail.candidate_rejected_count = (this.trail.candidate_rejected_count ?? 0) + 1;
  }
  evaluateDiff(verdict: "passed" | "failed" | "not_applicable"): void {
    this.trail.diff_evaluated = verdict;
  }
  runTests(names: readonly string[]): void {
    this.trail.tests_run = [...(this.trail.tests_run ?? []), ...names];
  }
  recordDiagnosis(note: string): void {
    this.trail.diagnosis_notes = ((this.trail.diagnosis_notes ?? "") + (this.trail.diagnosis_notes ? " · " : "") + note).slice(0, 2000);
  }
  incrementRepair(): void {
    this.trail.repair_attempts = (this.trail.repair_attempts ?? 0) + 1;
  }
  recordEvidence(): void {
    this.trail.evidence_recorded_at = new Date().toISOString();
  }
  decideCompletion(): void {
    this.trail.completion_decided_at = new Date().toISOString();
  }

  build(): Nex1DecisionTrail {
    if (!this.trail.task_interpretation) throw new Error("decision trail incomplete · task_interpretation missing");
    if (!this.trail.context_composed_hash) throw new Error("decision trail incomplete · context_composed_hash missing");
    if (typeof this.trail.candidate_accepted !== "boolean") throw new Error("decision trail incomplete · candidate_accepted missing");
    return this.trail as Nex1DecisionTrail;
  }
}
