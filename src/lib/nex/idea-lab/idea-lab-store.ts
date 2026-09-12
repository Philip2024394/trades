// src/lib/nex/idea-lab/idea-lab-store.ts
//
// In-memory Idea Lab store · per-process singleton. Persists across API
// requests but not across restarts. Replaced by pg-backed store once
// migration lands.

import type { IdeaDecision, IdeaEvaluation } from "./types";

class IdeaLabStore {
  private evaluations = new Map<string, IdeaEvaluation>();
  private decisions = new Map<string, IdeaDecision>();

  saveEvaluation(e: IdeaEvaluation): void {
    this.evaluations.set(e.ideaId, e);
  }

  getEvaluation(id: string): IdeaEvaluation | null {
    return this.evaluations.get(id) ?? null;
  }

  listEvaluations(): readonly IdeaEvaluation[] {
    return Array.from(this.evaluations.values());
  }

  recordDecision(ideaId: string, decision: IdeaDecision): void {
    this.decisions.set(ideaId, decision);
  }

  getDecision(ideaId: string): IdeaDecision | null {
    return this.decisions.get(ideaId) ?? null;
  }

  listDecisions(): ReadonlyMap<string, IdeaDecision> {
    return this.decisions;
  }

  clear(): void {
    this.evaluations.clear();
    this.decisions.clear();
  }
}

const g = globalThis as unknown as { __nex_idea_lab_store?: IdeaLabStore };
if (!g.__nex_idea_lab_store) g.__nex_idea_lab_store = new IdeaLabStore();
export const ideaLabStore: IdeaLabStore = g.__nex_idea_lab_store;
