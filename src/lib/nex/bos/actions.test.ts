// Action drafts — draft-only, approval-gated.

import { describe, it, expect } from "vitest";
import { suggestActions } from "./actions";

describe("suggestActions", () => {
  it("empty → empty", () => {
    expect(suggestActions({})).toEqual([]);
  });

  it("EVERY suggestion has requires_approval=true", () => {
    const actions = suggestActions({
      overdue_invoices: [{ invoice_id: "i1", customer_label: "Sam Smith", amount_pence: 8_400_00, days_overdue: 32 }],
      stale_follow_ups: [{ customer_label: "Jones", last_touch_days: 45 }],
      quotes_to_prepare: [{ customer_label: "Doe", scope_brief: "extension" }],
      project_updates: [{ project_id: "p1", project_title: "Smith kitchen", status_change: "Ready" }],
      supplier_recs: [{ need: "MDPE 25mm", supplier_name: "Wolseley", reason: "in stock local" }],
      reports_to_prepare: [{ label: "P&L", period: "November" }]
    });
    expect(actions.every((a) => a.requires_approval === true)).toBe(true);
    expect(actions.length).toBe(6);
  });

  it("reminder draft names the amount + overdue days", () => {
    const [a] = suggestActions({
      overdue_invoices: [{ invoice_id: "i1", customer_label: "Sam", amount_pence: 8_400_00, days_overdue: 32 }]
    });
    expect(a!.draft).toContain("£8,400");
    expect(a!.draft).toContain("32 days");
    expect(a!.target_label).toContain("32d overdue");
  });

  it("follow_up draft mentions the day count", () => {
    const [a] = suggestActions({
      stale_follow_ups: [{ customer_label: "Sam", last_touch_days: 90 }]
    });
    expect(a!.draft).toContain("90 days");
  });

  it("no em dashes anywhere in the drafts (brand rule)", () => {
    const actions = suggestActions({
      overdue_invoices: [{ invoice_id: "i1", customer_label: "Sam", amount_pence: 100_00, days_overdue: 10 }],
      stale_follow_ups: [{ customer_label: "Jo", last_touch_days: 30 }],
      quotes_to_prepare: [{ customer_label: "Doe", scope_brief: "loft", price_hint_pence: 15_000_00 }]
    });
    for (const a of actions) expect(a.draft).not.toContain("—");
  });
});
