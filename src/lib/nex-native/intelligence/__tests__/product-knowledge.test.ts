// Bridge 92 · Deterministic tests for the product-knowledge layer.
// Proves the catalogue is self-consistent, the retriever finds
// entries that match natural user questions, and plan-lookup is
// wired to the account state fields.

import { describe, it, expect } from "vitest";
import {
  NEX_FEATURES,
  NEX_PLANS,
  NEX_WORKFLOWS,
  NEX_PRODUCT_KNOWLEDGE,
  findProductEntry,
  planEntryForSubscription,
} from "../product-knowledge";
import { retrieveProductKnowledge } from "../product-knowledge-retriever";

describe("Bridge 92 · Product knowledge catalogue", () => {
  it("every entry has a stable id, non-empty content, and sealed_at", () => {
    for (const e of NEX_PRODUCT_KNOWLEDGE) {
      expect(e.id).toMatch(/^(feature|plan|workflow)\./);
      expect(e.content.length).toBeGreaterThan(20);
      expect(e.content.length).toBeLessThan(800);
      expect(e.sealed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.keywords.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate ids across the catalogue", () => {
    const ids = NEX_PRODUCT_KNOWLEDGE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("kind matches id prefix", () => {
    for (const e of NEX_PRODUCT_KNOWLEDGE) {
      expect(e.id.startsWith(`${e.kind}.`)).toBe(true);
    }
  });

  it("dependencies reference existing feature ids", () => {
    const ids = new Set(NEX_PRODUCT_KNOWLEDGE.map((e) => e.id));
    for (const e of NEX_PRODUCT_KNOWLEDGE) {
      for (const dep of e.dependencies ?? []) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });

  it("has all three kinds shipped", () => {
    expect(NEX_FEATURES.length).toBeGreaterThanOrEqual(10);
    expect(NEX_PLANS.length).toBeGreaterThanOrEqual(3);
    expect(NEX_WORKFLOWS.length).toBeGreaterThanOrEqual(5);
  });

  it("findProductEntry returns null for unknown ids", () => {
    expect(findProductEntry("feature.nope")).toBeNull();
    expect(findProductEntry("plan.gratis")).not.toBeNull();
  });
});

describe("Bridge 92 · planEntryForSubscription mapping", () => {
  it("maps bisnis subscription plan to Bisnis plan entry", () => {
    const e = planEntryForSubscription("bisnis", "bisnis");
    expect(e?.id).toBe("plan.bisnis");
  });

  it("maps ringan subscription plan to Ringan entry", () => {
    const e = planEntryForSubscription("ringan", "gratis");
    expect(e?.id).toBe("plan.themes_ringan");
  });

  it("maps buy subscription plan to Buy-a-theme entry", () => {
    const e = planEntryForSubscription("buy", "gratis");
    expect(e?.id).toBe("plan.buy_theme");
  });

  it("falls back to bisnis when tier is bisnis but plan is null", () => {
    const e = planEntryForSubscription(null, "bisnis");
    expect(e?.id).toBe("plan.bisnis");
  });

  it("defaults to gratis when nothing else applies", () => {
    const e = planEntryForSubscription(null, "gratis");
    expect(e?.id).toBe("plan.gratis");
  });
});

describe("Bridge 92 · Product knowledge retriever · natural questions", () => {
  it("finds the video-call feature when the user asks about video calls", () => {
    const r = retrieveProductKnowledge({
      question: "How do I start a video call?",
    });
    const ids = r.items.map((i) => i.id);
    expect(ids).toContain("workflow.start_video_call");
  });

  it("finds the theme trial when the user asks about trying premium themes", () => {
    const r = retrieveProductKnowledge({
      question: "Can I try premium themes for free?",
    });
    const ids = r.items.map((i) => i.id);
    // Should surface either the trial workflow or the trial feature
    const hitsTrial = ids.some((id) =>
      id === "workflow.try_premium_theme" || id === "feature.themes_trial",
    );
    expect(hitsTrial).toBe(true);
  });

  it("finds the Bisnis plan when the user asks about pricing", () => {
    const r = retrieveProductKnowledge({
      question: "How much is Bisnis?",
    });
    const ids = r.items.map((i) => i.id);
    expect(ids).toContain("plan.bisnis");
  });

  it("finds the peer-chat feature when the user asks about privacy", () => {
    const r = retrieveProductKnowledge({
      question: "Are my messages encrypted?",
    });
    const ids = r.items.map((i) => i.id);
    // Should surface either the peer_chat feature or zero_knowledge doctrine
    const hitsPrivacy = ids.some((id) =>
      id === "feature.peer_chat" ||
      id === "feature.zero_knowledge_doctrine" ||
      id === "feature.encrypted_media",
    );
    expect(hitsPrivacy).toBe(true);
  });

  it("returns empty for a completely unrelated question", () => {
    const r = retrieveProductKnowledge({
      question: "xyzzy zorkmid grue",
    });
    expect(r.items).toEqual([]);
  });

  it("respects onlyKind filter", () => {
    const r = retrieveProductKnowledge({
      question: "video call theme premium",
      onlyKind: "plan",
    });
    for (const item of r.items) {
      expect(item.id.startsWith("plan.")).toBe(true);
    }
  });

  it("emits IDR currency figures in the whitelist for plan entries", () => {
    const r = retrieveProductKnowledge({
      question: "how much does bisnis cost",
    });
    const bisnis = r.items.find((i) => i.id === "plan.bisnis");
    expect(bisnis).toBeTruthy();
    // Some Rp figure should show up in the whitelist so the validator
    // doesn't flag price mentions in the model output as fabricated.
    expect(bisnis!.figures.length).toBeGreaterThan(0);
    for (const f of bisnis!.figures) {
      expect(f).toMatch(/^Rp\s?\d/);
    }
  });

  it("caps results at maxItems", () => {
    const r = retrieveProductKnowledge({
      question: "theme feature plan workflow chat call",
      maxItems: 2,
    });
    expect(r.items.length).toBeLessThanOrEqual(2);
  });
});
