// AB answer router — classifier + mode formatter.
// Live engine calls mocked so the answer tests stay pure.

import { describe, it, expect, vi } from "vitest";

vi.mock("./queue", () => ({
  buildApprovalQueue: vi.fn(async () => ({
    computed_at: "x", merchant_slug: "phil",
    autonomy: { merchant_slug: "phil", mode: "manual", trusted_categories: [], source: "engine_default" },
    actions: [
      { key: "k1", category: "invoice_reminder", severity: "warning", headline: "Chase £800 overdue", reason: "cf", preview_of_effect: "drafts message", reversible: true, source: "fi", evidence: { source: "t", tables: [], computed_at: "x" }, status: "awaiting_approval" }
    ],
    auto_approvable: [],
    errors: []
  }))
}));

vi.mock("./overnight", () => ({
  approvalQueueToText: (actions: unknown[]) => `Queue: ${(actions as { headline: string }[]).map((a) => a.headline).join(" | ")}`,
  buildOvernightRun:   vi.fn(async () => ({
    merchant_slug: "phil", ran_at: "x", prepared_count: 3, auto_approved: 0,
    highlights: [{ headline: "H1", category: "recommendation" }],
    queue: { computed_at: "x", merchant_slug: "phil", autonomy: { merchant_slug: "phil", mode: "manual", trusted_categories: [], source: "engine_default" }, actions: [], auto_approvable: [], errors: [] },
    errors: []
  })),
  overnightRunToText:  (r: { prepared_count: number }) => `Overnight: prepared ${r.prepared_count}`
}));

vi.mock("./agents", () => ({
  detectAgent: (t: string) => t.startsWith("marketing nex,") ? { agent: "marketing", rest: t.slice("marketing nex,".length).trim() } : null,
  routeToAgent: vi.fn(async () => "Marketing Nex reply here.")
}));

import { answerAB, classifyABQuestion } from "./answer";

describe("classifyABQuestion", () => {
  it("routes approvals", () => {
    expect(classifyABQuestion("what needs my approval?").kind).toBe("approvals");
    expect(classifyABQuestion("approval queue").kind).toBe("approvals");
  });
  it("routes overnight", () => {
    expect(classifyABQuestion("what did you do overnight").kind).toBe("overnight");
  });
  it("routes mode", () => {
    expect(classifyABQuestion("what mode am I on").kind).toBe("mode");
  });
  it("routes agent handles FIRST", () => {
    const q = classifyABQuestion("marketing nex, how are my posts");
    expect(q.kind).toBe("agent");
    if (q.kind === "agent") {
      expect(q.agent).toBe("marketing");
      expect(q.rest).toBe("how are my posts");
    }
  });
  it("returns 'none' for unrelated text", () => {
    expect(classifyABQuestion("hello there").kind).toBe("none");
  });
});

describe("answerAB", () => {
  it("approvals surfaces the queue text", async () => {
    const s = await answerAB({ question: { kind: "approvals" }, merchantSlug: "phil" });
    expect(s).toContain("Queue:");
    expect(s).toContain("Chase £800 overdue");
  });

  it("overnight surfaces the run text", async () => {
    const s = await answerAB({ question: { kind: "overnight" }, merchantSlug: "phil" });
    expect(s).toContain("Overnight: prepared 3");
  });

  it("mode explains default manual + adds reassurance", async () => {
    const s = await answerAB({ question: { kind: "mode" }, merchantSlug: "phil" });
    expect(s.toLowerCase()).toContain("manual");
    expect(s).toContain("engine default");
    expect(s).toContain("No action fires without your explicit approval.");
  });

  it("agent route delegates to routeToAgent", async () => {
    const s = await answerAB({ question: { kind: "agent", agent: "marketing", rest: "posts?" }, merchantSlug: "phil" });
    expect(s).toContain("Marketing Nex reply here.");
  });

  it("none returns empty", async () => {
    const s = await answerAB({ question: { kind: "none" }, merchantSlug: "phil" });
    expect(s).toBe("");
  });
});
