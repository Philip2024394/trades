// BOS answer router — classifier + dispatch.

import { describe, it, expect } from "vitest";
import { answerBOS, classifyBOSQuestion } from "./answer";

describe("classifyBOSQuestion", () => {
  it("morning intelligence report", () => {
    expect(classifyBOSQuestion("morning intelligence report").kind).toBe("morning_report");
    expect(classifyBOSQuestion("run my business intelligence").kind).toBe("morning_report");
  });
  it("predict risks", () => {
    expect(classifyBOSQuestion("predict risks on my projects").kind).toBe("predict_risks");
    expect(classifyBOSQuestion("what could go wrong today?").kind).toBe("predict_risks");
  });
  it("industry signals", () => {
    expect(classifyBOSQuestion("market signals").kind).toBe("industry_signals");
    expect(classifyBOSQuestion("what's happening in my market?").kind).toBe("industry_signals");
  });
  it("growth opportunities", () => {
    expect(classifyBOSQuestion("growth opportunities").kind).toBe("growth_opportunities");
    expect(classifyBOSQuestion("where can I grow?").kind).toBe("growth_opportunities");
  });
  it("afford", () => {
    const q = classifyBOSQuestion("can I afford another van?");
    expect(q.kind).toBe("afford");
    if (q.kind === "afford") { expect(q.label).toMatch(/van/); expect(q.price_pence).toBe(2_500_000); }
  });
  it("afford with explicit price", () => {
    const q = classifyBOSQuestion("can I afford a scaffold tower for £3,000?");
    if (q.kind === "afford") { expect(q.price_pence).toBe(300_000); }
  });
  it("trade graph", () => {
    const q = classifyBOSQuestion("what do I know about plumbing?");
    expect(q.kind).toBe("trade_graph");
    if (q.kind === "trade_graph") expect(q.trade).toBe("plumbing");
  });
  it("draft actions", () => {
    expect(classifyBOSQuestion("draft the reminders").kind).toBe("draft_actions");
  });
  it("unrelated → none", () => {
    expect(classifyBOSQuestion("hello there").kind).toBe("none");
  });
});

describe("answerBOS", () => {
  const base = { merchant_slug: "phil", merchant_name: "Phil" };

  it("morning_report always returns a speak with the greeting", async () => {
    const r = await answerBOS({ question: { kind: "morning_report" }, ...base });
    expect(r.speak).toContain("Phil");
    expect(r.data?.morning_report).toBeDefined();
  });

  it("predict_risks with no input → helpful nudge", async () => {
    const r = await answerBOS({ question: { kind: "predict_risks" }, ...base });
    expect(r.speak.toLowerCase()).toContain("snapshot");
  });

  it("afford with no finance → UNKNOWN + helpful reason", async () => {
    const r = await answerBOS({
      question: { kind: "afford", label: "a van", price_pence: 2_500_000, urgency: "flexible" },
      ...base
    });
    expect(r.speak).toContain("UNKNOWN");
  });

  it("trade_graph plumbing → returns tools + regs", async () => {
    const r = await answerBOS({ question: { kind: "trade_graph", trade: "plumbing" }, ...base });
    expect(r.speak).toContain("Plumbing");
    expect(r.speak).toContain("Regulations");
    expect(r.data?.trade_node).toBeDefined();
  });

  it("trade_graph unknown → 'Nothing on file'", async () => {
    const r = await answerBOS({ question: { kind: "trade_graph", trade: "interstellar-thing" }, ...base });
    expect(r.speak.toLowerCase()).toContain("nothing on file");
  });

  it("draft_actions with no input → 'nothing to draft'", async () => {
    const r = await answerBOS({ question: { kind: "draft_actions" }, ...base });
    expect(r.speak.toLowerCase()).toContain("nothing to draft");
  });

  it("none → empty speak", async () => {
    const r = await answerBOS({ question: { kind: "none" }, ...base });
    expect(r.speak).toBe("");
  });
});
