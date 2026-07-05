// Assembly Rule Resolver.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Pure function. Takes a set of module ids, walks their AssemblyRule
// arrays, and produces a ResolvedAssemblyPlan the merchant can accept
// or dismiss.
//
// Slot conflicts: when a slot has `maxOccupants: N` and more than N
// proposals target it, the top-N by priority win; the rest become
// conflict losers. Ties broken by rule id lexicographically for
// determinism.
//
// Never mutates state. Never persists anything. The API layer that
// consumes this decides what to write.

import {
  BUSINESS_MODULES,
  getModule,
  getSlot
} from "@/lib/studio/modules";
import type { AssemblyAction, BusinessModule } from "@/lib/studio/modules";
import type {
  AssemblyProposal,
  AssemblySlotConflict,
  ResolvedAssemblyPlan
} from "./types";

export type ResolverInput = {
  /** Module ids to include in the plan. Callers pass the merchant's
   *  currently-installed set OR a hypothetical set for "what if I
   *  install X" previews. */
  moduleIds: string[];
};

/** Actions that resolve into a slot on the SLOT_REGISTRY. Other
 *  action kinds resolve into module ids or page ids and don't
 *  compete for slots. */
const SLOT_TARGETED_KINDS = new Set<AssemblyAction["kind"]>([
  "add-cta",
  "insert-section",
  "add-nav-item"
]);

/** Triggers that fire immediately vs. wait for later signals. */
function isImmediateTrigger(
  proposal: AssemblyProposal
): boolean {
  const kind = proposal.trigger.kind;
  return kind === "on-install" || kind === "on-configure";
}

export function resolveAssemblyPlan(
  input: ResolverInput
): ResolvedAssemblyPlan {
  const requested = Array.from(new Set(input.moduleIds));
  const proposals: AssemblyProposal[] = [];
  const skipped: string[] = [];

  // 1. Collect proposals in module-declared order
  for (const moduleId of requested) {
    const module = getModule(moduleId);
    if (!module) {
      skipped.push(moduleId);
      continue;
    }
    for (const rule of module.assemblyRules ?? []) {
      proposals.push({
        id: `${moduleId}::${rule.id}`,
        moduleId,
        moduleName: module.name,
        ruleId: rule.id,
        trigger: rule.trigger,
        action: rule.action,
        rationale: rule.rationale
      });
    }
  }

  // 2. Group by target
  const proposalsByTarget: Record<string, AssemblyProposal[]> = {};
  const slotsTouched = new Set<string>();
  for (const p of proposals) {
    const key = `${p.action.kind}:${p.action.target}`;
    (proposalsByTarget[key] ??= []).push(p);
    if (SLOT_TARGETED_KINDS.has(p.action.kind)) {
      slotsTouched.add(p.action.target);
    }
  }

  // 3. Detect conflicts on slot-targeted proposals
  const conflicts: AssemblySlotConflict[] = [];
  const loserIds = new Set<string>();

  for (const slotId of slotsTouched) {
    const slot = getSlot(slotId);
    // Only slots with maxOccupants can conflict — unbounded slots
    // fit everything.
    if (!slot?.maxOccupants) continue;

    // Which proposals target this slot?
    const contenders = proposals.filter(
      (p) =>
        SLOT_TARGETED_KINDS.has(p.action.kind) &&
        p.action.target === slotId
    );
    if (contenders.length <= slot.maxOccupants) continue;

    // Sort by priority desc, then rule id asc for determinism
    const sorted = [...contenders].sort((a, b) => {
      if (b.action.priority !== a.action.priority) {
        return b.action.priority - a.action.priority;
      }
      return a.id.localeCompare(b.id);
    });

    const winners = sorted.slice(0, slot.maxOccupants);
    const losers = sorted.slice(slot.maxOccupants);

    // Each losing bucket gets its own conflict record so the UI can
    // show "5 modules wanted this slot; here's the winner and why".
    // For maxOccupants === 1 this collapses to a single winner + N
    // losers — the common case.
    conflicts.push({
      slotId,
      winner: winners[0],
      losers,
      resolutionReason:
        `Slot "${slotId}" allows ${slot.maxOccupants} occupant${slot.maxOccupants === 1 ? "" : "s"}; ` +
        `${sorted.length} proposals compete. The highest-priority proposal from ${winners[0].moduleName} wins ` +
        `(priority ${winners[0].action.priority}). Losers are surfaced so you can override.`
    });

    for (const loser of losers) loserIds.add(loser.id);
  }

  // 4. Metadata
  const applicableProposals = proposals.filter(
    (p) => !loserIds.has(p.id)
  );
  const pendingLaterTriggers = applicableProposals.filter(
    (p) => !isImmediateTrigger(p)
  ).length;

  return {
    moduleIdsRequested: requested,
    moduleIdsSkipped: skipped,
    proposals,
    proposalsByTarget,
    conflicts,
    meta: {
      totalProposals: proposals.length,
      applicableProposals: applicableProposals.length,
      slotsTouched: Array.from(slotsTouched),
      pendingLaterTriggers
    }
  };
}

/** Given a plan and an accepted subset, return the proposals that
 *  will actually apply. Filters out losers of conflicts + anything
 *  the merchant dismissed. Used by the API when the merchant hits
 *  "Apply". */
export function applyDecisions(
  plan: ResolvedAssemblyPlan,
  acceptedProposalIds: string[]
): AssemblyProposal[] {
  const acceptedSet = new Set(acceptedProposalIds);
  const loserIds = new Set(
    plan.conflicts.flatMap((c) => c.losers.map((l) => l.id))
  );
  return plan.proposals.filter(
    (p) => acceptedSet.has(p.id) && !loserIds.has(p.id)
  );
}

/** Utility for "the whole platform" previews — resolves against every
 *  registered module. Used by admin dashboards. */
export function resolveWholePlatformPlan(): ResolvedAssemblyPlan {
  return resolveAssemblyPlan({
    moduleIds: BUSINESS_MODULES.filter(
      (m: BusinessModule) => (m.assemblyRules ?? []).length > 0
    ).map((m) => m.id)
  });
}
