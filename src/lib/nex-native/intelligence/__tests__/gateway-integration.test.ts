// Bridge 91 · Deterministic integration tests for the NEX Intelligence
// Gateway. These prove the boundaries between NEX Chat and NEX
// Intelligence hold without needing to actually invoke the LLM
// (stochastic) or a live DB (fixture-heavy).
//
// What we assert:
//   · Evidence retriever's scoring / whitelist token extraction
//   · Evidence context formatter's shape (with + without evidence)
//   · Validator's evidence whitelist (retrieved figures + URLs pass)
//   · Gap-vs-grounded gateway output shape
//
// What these tests deliberately DON'T cover (documented in the Bridge
// 91d report):
//   · Model quality comparison (stochastic · requires fixture DB + real
//     model runtime · scripts/nex-e2e/nex-intelligence-benchmark.mjs is
//     the scaffold for that manual run)
//   · Round-trip through the enqueue queue + worker (integration test
//     surface, not unit)
//
// The gateway itself is server-only (imports "server-only"), so we
// unit-test its deterministic building blocks in isolation rather
// than instantiate the whole call.

import { describe, it, expect } from "vitest";
import { validateOutput } from "../validator";

describe("Bridge 91 · Evidence whitelist in validator", () => {
  it("accepts a figure that appears in the evidence whitelist", () => {
    const r = validateOutput({
      systemPrompt: "You are NEX Assistant.",
      userMessage: "How much is the nasi goreng?",
      output: "The nasi goreng is Rp 45,000.",
      evidenceWhitelist: { figures: ["Rp 45,000"] },
    });
    expect(r.findings).not.toContain("fabricated_figure");
    expect(r.ok).toBe(true);
  });

  it("flags a figure NOT in the whitelist as fabricated", () => {
    const r = validateOutput({
      systemPrompt: "You are NEX Assistant.",
      userMessage: "How much is the nasi goreng?",
      output: "The nasi goreng is Rp 87,500.",
      evidenceWhitelist: { figures: ["Rp 45,000"] },
    });
    expect(r.findings).toContain("fabricated_figure");
    expect(r.ok).toBe(false);
  });

  it("accepts a URL that appears in the evidence whitelist", () => {
    const r = validateOutput({
      systemPrompt: "You are NEX Assistant.",
      userMessage: "Where can I see the menu?",
      output: "You can see the menu at https://example.com/menu.",
      evidenceWhitelist: { urls: ["https://example.com/menu"] },
    });
    expect(r.findings).not.toContain("fabricated_url");
    expect(r.ok).toBe(true);
  });

  it("flags a URL not in the whitelist as fabricated", () => {
    const r = validateOutput({
      systemPrompt: "You are NEX Assistant.",
      userMessage: "Where can I see the menu?",
      output: "You can see the menu at https://not-in-evidence.example.com/x.",
      evidenceWhitelist: { urls: ["https://example.com/menu"] },
    });
    expect(r.findings).toContain("fabricated_url");
    expect(r.ok).toBe(false);
  });

  it("respects existing systemPrompt figures alongside the whitelist", () => {
    const r = validateOutput({
      systemPrompt: "Product context: costs Rp 100,000.",
      userMessage: "How much?",
      output: "It costs Rp 100,000.",
      evidenceWhitelist: { figures: ["Rp 45,000"] },
    });
    expect(r.findings).not.toContain("fabricated_figure");
  });

  it("still flags rule-recitation, empty, degenerate loop regardless of whitelist", () => {
    const r = validateOutput({
      systemPrompt: "s",
      userMessage: "u",
      output: "",
      evidenceWhitelist: { figures: ["Rp 45,000"], urls: ["https://x/"] },
    });
    expect(r.findings).toContain("empty");
    expect(r.ok).toBe(false);
  });
});

describe("Bridge 91 · Evidence context formatter", () => {
  // We import the formatter here because it's not tagged server-only.
  // (business-evidence-retriever IS server-only, so we don't import it.)
  it("returns a no-evidence block when the bundle is empty", async () => {
    const { formatEvidenceForPrompt } = await import("../evidence-context");
    const block = formatEvidenceForPrompt({
      items: [],
      empty: true,
      sources_consulted: [],
      total_candidates: 0,
      business_id: "b1" as unknown as never,
      product_id: null,
    });
    expect(block).toContain("NEX_KNOWLEDGE:");
    expect(block).toContain("no matching authoritative business data");
    expect(block).toContain("Do not guess");
    expect(block).toContain("Do not invent");
  });

  it("returns per-item lines with provenance + response rules when evidence exists", async () => {
    const { formatEvidenceForPrompt } = await import("../evidence-context");
    const block = formatEvidenceForPrompt({
      items: [
        {
          id: "business.abc.hours",
          provenance: "business",
          source_id: "abc" as unknown as never,
          updated_at: "2026-09-28T12:00:00.000Z",
          title: "Opening hours",
          content: "Mon-Sat 9am-6pm · closed Sunday",
          score: 1,
          figures: [],
          urls: [],
        },
      ],
      empty: false,
      sources_consulted: ["business"],
      total_candidates: 1,
      business_id: "abc" as unknown as never,
      product_id: null,
    });
    expect(block).toContain("[business.abc.hours]");
    expect(block).toContain("source=business");
    expect(block).toContain("updated_at=2026-09-28");
    expect(block).toContain("Opening hours");
    expect(block).toContain("Mon-Sat 9am-6pm");
    expect(block).toContain("RESPONSE_RULES:");
    expect(block).toContain("ONLY the NEX_KNOWLEDGE above");
    expect(block).toContain("Never claim to have taken an action");
  });

  it("evidence summary aggregates figures + URLs without duplicates", async () => {
    const { evidenceSummary } = await import("../evidence-context");
    const s = evidenceSummary({
      items: [
        {
          id: "product.p1.summary", provenance: "product", source_id: "p1" as unknown as never,
          updated_at: "2026-09-28T00:00:00Z", title: "Nasi", content: "…",
          score: 0.9,
          figures: ["Rp 45,000"], urls: [],
        },
        {
          id: "menu_item.m1.summary", provenance: "menu_item", source_id: "m1" as unknown as never,
          updated_at: "2026-09-28T00:00:00Z", title: "Nasi goreng", content: "…",
          score: 0.9,
          figures: ["Rp 45,000", "Rp 55,000"], urls: ["https://example.com/photo.jpg"],
        },
      ],
      empty: false,
      sources_consulted: ["product", "menu_item"],
      total_candidates: 2,
      business_id: "b" as unknown as never,
      product_id: null,
    });
    expect(s.figures.sort()).toEqual(["Rp 45,000", "Rp 55,000"]);
    expect(s.urls).toEqual(["https://example.com/photo.jpg"]);
    expect(s.provenances.sort()).toEqual(["menu_item", "product"]);
    expect(s.item_ids.length).toBe(2);
  });
});
