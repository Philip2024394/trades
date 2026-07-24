// Automation rules — pure-data contract + evaluator.
//
// A rule is a NAMED predicate + PreparedAction builder. The evaluator
// runs the predicate, wraps the produced action, and reports whether
// current autonomy settings would auto-approve it. Rules NEVER touch
// the DB directly — they read from engine snapshots the caller
// supplies.

import { isAutoApprovable } from "./modes";
import type {
  AutomationRule,
  AutomationRuleContext,
  AutomationRuleResult,
  PreparedAction
} from "./types";

/** Run a single rule, tag the result with auto-approvability. */
export async function evaluateRule(rule: AutomationRule, ctx: AutomationRuleContext): Promise<AutomationRuleResult> {
  try {
    const res = await rule.evaluate(ctx);
    if (!res.matches || !res.prepared_action) {
      return {
        matches:          false,
        prepared_action:  undefined,
        auto_approvable:  false,
        reason:           res.reason ?? "did not match"
      };
    }
    const auto = isAutoApprovable(res.prepared_action.category, res.prepared_action.reversible, ctx.autonomy);
    return {
      matches:         true,
      prepared_action: res.prepared_action,
      auto_approvable: auto,
      reason:          `${res.reason ?? "matched"}${auto ? " · auto-approve permitted" : " · awaiting approval"}`
    };
  } catch (err) {
    return {
      matches:         false,
      auto_approvable: false,
      reason:          `rule error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/** Run a batch of rules in parallel; skip failures cleanly. */
export async function evaluateRules(rules: AutomationRule[], ctx: AutomationRuleContext): Promise<{
  results:  AutomationRuleResult[];
  actions:  PreparedAction[];
}> {
  const results = await Promise.all(rules.map((r) => evaluateRule(r, ctx)));
  const actions: PreparedAction[] = [];
  for (const r of results) if (r.prepared_action) actions.push(r.prepared_action);
  return { results, actions };
}
