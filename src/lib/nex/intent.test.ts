// Nex intent detection — keyword coverage tests.

import { describe, it, expect } from "vitest";
import { detectIntent } from "./intent";

describe("Nex intent detection", () => {
  it("routes 'design my van' to van-wrap", () => {
    expect(detectIntent("Nex, design my van")).toMatchObject({
      kind: "invoke_studio", capability_id: "vehicle.van-wrap"
    });
  });

  it("routes 'make my van wrap' to van-wrap", () => {
    expect(detectIntent("make my van wrap look premium")).toMatchObject({
      kind: "invoke_studio", capability_id: "vehicle.van-wrap"
    });
  });

  it("routes business card requests", () => {
    expect(detectIntent("I need business cards")).toMatchObject({
      kind: "invoke_studio", capability_id: "print.business-card"
    });
    expect(detectIntent("calling cards to match my van")).toMatchObject({
      kind: "invoke_studio", capability_id: "print.business-card"
    });
  });

  it("recognises colour edit intent", () => {
    expect(detectIntent("change my brand colour to yellow")).toMatchObject({
      kind: "edit_brand", field: "colour"
    });
  });

  it("recognises logo edit intent", () => {
    expect(detectIntent("I've changed my logo")).toMatchObject({
      kind: "edit_brand", field: "logo"
    });
  });

  it("routes 'my brand' to vault", () => {
    expect(detectIntent("show my brand")).toMatchObject({
      kind: "open_page", path: "/studio/vault"
    });
  });

  it("routes 'export' to vault (export button)", () => {
    expect(detectIntent("I want to download everything")).toMatchObject({
      kind: "open_page", path: "/studio/vault"
    });
  });

  it("empty input → unknown", () => {
    expect(detectIntent("")).toMatchObject({ kind: "unknown" });
  });

  it("question-shaped input routes to answer intent", () => {
    expect(detectIntent("what's the VAT threshold")).toMatchObject({ kind: "answer" });
    expect(detectIntent("how do I fit a staircase")).toMatchObject({ kind: "answer" });
    expect(detectIntent("does this include VAT?")).toMatchObject({ kind: "answer" });
  });

  it("plain statement → unknown", () => {
    expect(detectIntent("just some random text with no signals")).toMatchObject({ kind: "unknown" });
  });

  it("research intent captures topic", () => {
    const i = detectIntent("Nex, research the latest UK staircase guidance from official sources");
    expect(i.kind).toBe("research");
    if (i.kind === "research") {
      expect(i.topic.toLowerCase()).toContain("staircase");
    }
  });

  it("research intent works with 'find' verb + regs keyword", () => {
    const i = detectIntent("find new regulations for electricians");
    expect(i.kind).toBe("research");
  });

  it("teach intent captures content", () => {
    const i = detectIntent("Nex, learn this: staircase max rise is 220mm");
    expect(i.kind).toBe("teach");
    if (i.kind === "teach") expect(i.content).toContain("220mm");
  });

  it("teach intent via 'store this permanently'", () => {
    expect(detectIntent("store this permanently: use C24 for spans over 4m")).toMatchObject({ kind: "teach" });
  });

  it("approve_all requires confirm keyword", () => {
    const i1 = detectIntent("approve everything");
    expect(i1).toMatchObject({ kind: "approve_all", confirm: false });
    const i2 = detectIntent("approve everything, confirm");
    expect(i2).toMatchObject({ kind: "approve_all", confirm: true });
  });

  it("what_changed intent", () => {
    expect(detectIntent("what changed this week")).toMatchObject({ kind: "what_changed", scope: "this_week" });
    expect(detectIntent("any updates")).toMatchObject({ kind: "what_changed" });
  });
});
