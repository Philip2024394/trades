// Assembly Action Executor — pure dispatch.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Every row ends in one of three states:
//   • applied_at set, apply_error null       — success
//   • applied_at set, apply_error set        — honest not-yet-executable
//   • applied_at null                        — retryable transient failure
//
// Deliberately narrow scope today: only `suggest-module` succeeds. Every
// other action-kind marks itself with a clear, honest error message so
// the audit trail says "we know about this, we just haven't built the
// site-mutation executor for it yet". A downstream slice adds each kind
// one at a time, no re-plumbing needed.
//
// The DB-touching runner lives in ./executorRunner.ts so this file
// stays importable from unit-test scripts without server-only.

import type { AssemblyAction } from "@/lib/studio/modules";

export type ExecutorContext = {
  merchantId: string;
  brandId: string;
};

export type ExecutorOutcome =
  | { ok: true }
  | { ok: false; error: string };

export type PendingDecisionRow = {
  id: string;
  proposal_id: string;
  module_id: string;
  rule_id: string;
  action_json: AssemblyAction;
  rationale_snapshot: string;
};

/** Pure dispatch — no DB access here. The runner below handles the
 *  row read + row update. This keeps executor logic unit-testable. */
export function executeDecision(
  action: AssemblyAction,
  _ctx: ExecutorContext
): ExecutorOutcome {
  switch (action.kind) {
    case "suggest-module":
      // Signal-only. Growth Coach reads applied suggest-module rows
      // from studio_assembly_decisions and surfaces them as tasks. No
      // additional side-effect needed — marking applied IS the effect.
      return { ok: true };

    case "add-nav-item":
      // Runner-side effect. The runner writes a row into
      // studio_assembly_nav_entries; composeNavigation folds these into
      // the composed tree. This case reports ok:true so the runner
      // knows to attempt the DB write.
      return { ok: true };

    case "add-cta":
      // Runner-side effect. The runner writes a row into
      // studio_assembly_ctas; hero renderers query getAssemblyCta and
      // override their default CTA when a winning row exists.
      return { ok: true };

    case "insert-section":
    case "add-to-page":
    case "wire-to":
      return {
        ok: false,
        error: `action-kind-not-yet-executable:${action.kind}`
      };
  }
}

