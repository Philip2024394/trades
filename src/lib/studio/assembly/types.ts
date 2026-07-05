// Assembly Rule Runtime — types.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// The resolver takes a set of module ids and produces a
// ResolvedAssemblyPlan that a UI can render as a proposal to the
// merchant. Every proposal carries its rationale; every conflict
// carries its resolution reason. No black-box.

import type { AssemblyAction, AssemblyTrigger } from "@/lib/studio/modules";

/** One proposed action a module wants the platform to take on
 *  install. Enriched from the module's raw AssemblyRule with the
 *  source module id and a stable proposal id. */
export type AssemblyProposal = {
  /** `<moduleId>::<ruleId>` — stable + inspectable in logs. */
  id: string;
  moduleId: string;
  moduleName: string;
  ruleId: string;
  trigger: AssemblyTrigger;
  action: AssemblyAction;
  rationale: string;
};

/** A conflict happens when two proposals compete for the same
 *  bounded slot (slot.maxOccupants set). Resolution is priority-
 *  based; the winning proposal is `winner`, the loser gets its own
 *  conflict record so the UI can show the trade-off. */
export type AssemblySlotConflict = {
  /** The slot id under contention. */
  slotId: string;
  /** The proposal that won the conflict. */
  winner: AssemblyProposal;
  /** Proposals that lost. Ordered by priority desc. */
  losers: AssemblyProposal[];
  /** Human sentence explaining the resolution — always shown. */
  resolutionReason: string;
};

/** The full plan a resolver produces from a set of modules. */
export type ResolvedAssemblyPlan = {
  /** The moduleIds fed into the resolver. */
  moduleIdsRequested: string[];
  /** Modules that were skipped (not registered). */
  moduleIdsSkipped: string[];
  /** Every proposal, in the module-declared order. */
  proposals: AssemblyProposal[];
  /** Proposals grouped by target — useful for the UI so the merchant
   *  can see "here's what happens at nav.header". */
  proposalsByTarget: Record<string, AssemblyProposal[]>;
  /** Slot conflicts detected + resolved. */
  conflicts: AssemblySlotConflict[];
  /** Metadata for the UI header. */
  meta: {
    /** How many proposals in total, including losers of conflicts. */
    totalProposals: number;
    /** How many proposals will actually apply if the merchant accepts
     *  all (excludes losers of conflicts). */
    applicableProposals: number;
    /** Slot ids touched. */
    slotsTouched: string[];
    /** on-install proposals are always ready to apply. Others (time-
     *  based, analytics-based) are pending later evaluation. Split so
     *  the UI can show "5 to apply now, 2 pending future signals". */
    pendingLaterTriggers: number;
  };
};
