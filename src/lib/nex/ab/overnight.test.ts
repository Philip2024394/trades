// Overnight formatters — pure text-rendering tests.

import { describe, it, expect } from "vitest";
import { approvalQueueToText, overnightRunToText } from "./overnight";
import type { OvernightRun, PreparedAction } from "./types";

const ev = { source: "t", tables: [], computed_at: "x" };

function action(overrides: Partial<PreparedAction> = {}): PreparedAction {
  return {
    key:               "k",
    category:          "recommendation",
    severity:          "notice",
    headline:          "Something to look at",
    reason:            "cf",
    preview_of_effect: "n/a",
    reversible:        true,
    source:            "ab",
    evidence:          ev,
    status:            "awaiting_approval",
    ...overrides
  };
}

describe("approvalQueueToText", () => {
  it("empty queue → friendly message", () => {
    expect(approvalQueueToText([])).toContain("Nothing awaits your approval");
  });

  it("lists each action with severity + reason + preview", () => {
    const out = approvalQueueToText([
      action({ key: "1", severity: "warning", headline: "Chase £800", reason: "overdue", preview_of_effect: "drafts WA" }),
      action({ key: "2", severity: "notice",  headline: "Check in with Mrs Smith", reason: "quiet 65 days", preview_of_effect: "drafts note" })
    ]);
    expect(out).toContain("Chase £800");
    expect(out).toContain("[warning]");
    expect(out).toContain("If approved: drafts WA");
    expect(out).toContain("Check in with Mrs Smith");
  });
});

describe("overnightRunToText", () => {
  it("headline + prepared count + manual-mode note", () => {
    const run: OvernightRun = {
      merchant_slug: "phil", ran_at: "2026-07-23T05:00:00Z",
      prepared_count: 4, auto_approved: 0,
      highlights: [{ headline: "Chase £800 overdue", category: "invoice_reminder" }],
      queue: { computed_at: "x", merchant_slug: "phil", autonomy: { merchant_slug: "phil", mode: "manual", trusted_categories: [], source: "engine_default" }, actions: [], auto_approvable: [], errors: [] },
      errors: []
    };
    const out = overnightRunToText(run);
    expect(out).toContain("Overnight run — 2026-07-23");
    expect(out).toContain("Prepared: 4 actions");
    expect(out).toContain("Auto-approved: 0 (mode is Manual");
    expect(out).toContain("Chase £800 overdue");
  });
});
