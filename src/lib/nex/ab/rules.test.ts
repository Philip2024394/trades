// Rule evaluator — matches / doesn't / auto-approvable derivation.

import { describe, it, expect } from "vitest";
import { evaluateRule, evaluateRules } from "./rules";
import type { AutomationRule, AutomationRuleContext, PreparedAction } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function ctx(): AutomationRuleContext {
  return {
    merchant_slug: "phil",
    autonomy: {
      merchant_slug: "phil", mode: "trusted",
      trusted_categories: ["review_request"], source: "merchant_override"
    }
  };
}

const okAction: PreparedAction = {
  key: "ask_review_x1", category: "review_request", severity: "notice",
  headline: "Ask X for a review",
  reason:   "Signed off 30 days ago, still no review request.",
  preview_of_effect: "Sends a review-request template — merchant approves before send.",
  reversible: true, source: "ab", evidence: ev, status: "awaiting_approval"
};

describe("evaluateRule", () => {
  it("returns matches:false when the rule opts out", async () => {
    const rule: AutomationRule = {
      key: "r1", name: "r1", category: "review_request",
      evaluate: async () => ({ matches: false, auto_approvable: false, reason: "no candidates" })
    };
    const res = await evaluateRule(rule, ctx());
    expect(res.matches).toBe(false);
    expect(res.prepared_action).toBeUndefined();
  });

  it("matches + auto-approvable when trusted mode + category listed + reversible", async () => {
    const rule: AutomationRule = {
      key: "r1", name: "r1", category: "review_request",
      evaluate: async () => ({ matches: true, prepared_action: okAction, auto_approvable: false, reason: "match" })
    };
    const res = await evaluateRule(rule, ctx());
    expect(res.matches).toBe(true);
    expect(res.auto_approvable).toBe(true);
    expect(res.prepared_action?.key).toBe("ask_review_x1");
  });

  it("NOT auto-approvable when action is not reversible", async () => {
    const rule: AutomationRule = {
      key: "r1", name: "r1", category: "review_request",
      evaluate: async () => ({ matches: true, prepared_action: { ...okAction, reversible: false }, auto_approvable: false, reason: "" })
    };
    const res = await evaluateRule(rule, ctx());
    expect(res.auto_approvable).toBe(false);
  });

  it("swallows rule errors with a friendly reason", async () => {
    const rule: AutomationRule = {
      key: "r1", name: "r1", category: "review_request",
      evaluate: async () => { throw new Error("kaboom"); }
    };
    const res = await evaluateRule(rule, ctx());
    expect(res.matches).toBe(false);
    expect(res.reason).toContain("rule error");
    expect(res.reason).toContain("kaboom");
  });
});

describe("evaluateRules", () => {
  it("runs a batch + collects prepared actions", async () => {
    const rules: AutomationRule[] = [
      { key: "r1", name: "r1", category: "review_request", evaluate: async () => ({ matches: true, prepared_action: okAction,                       auto_approvable: false, reason: "" }) },
      { key: "r2", name: "r2", category: "review_request", evaluate: async () => ({ matches: true, prepared_action: { ...okAction, key: "y" },      auto_approvable: false, reason: "" }) },
      { key: "r3", name: "r3", category: "review_request", evaluate: async () => ({ matches: false, auto_approvable: false, reason: "no match" }) }
    ];
    const { results, actions } = await evaluateRules(rules, ctx());
    expect(results.length).toBe(3);
    expect(actions.length).toBe(2);
    expect(actions.map((a) => a.key)).toEqual(["ask_review_x1", "y"]);
  });
});
