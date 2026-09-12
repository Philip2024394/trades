// src/lib/nex/language/language.test.ts
//
// Founder BEGIN 2026-09-10 · smoke tests for the domain-agnostic language
// engine. Proves that founder-shaped English with UK slang normalises to
// canonical tokens · and that the code-domain intent parser resolves realistic
// slangy prompts to the right nex1 intent.

import { describe, it, expect } from "vitest";
import { normalise } from "./normaliser";
import { parseIntent } from "./intent-parser";
import { CODE_INTENT_REGISTRY } from "@/lib/nex-agent/language/code-intent-registry";

describe("language normaliser · UK slang → canonical", () => {
  it("collapses common UK slang verbs to canonical action words", () => {
    const r = normalise("Can you chuck in a new endpoint for me mate");
    expect(r.canonical_tokens).toContain("add");
    expect(r.canonical_tokens).toContain("endpoint");
    // 'mate' → 'person' · 'me' is a stopword and drops
    expect(r.canonical_tokens).toContain("person");
  });

  it("normalises spoken contractions", () => {
    const r = normalise("Gonna sort out that dodgy migration cos it's broken");
    expect(r.canonical_tokens).toContain("going");
    expect(r.canonical_tokens).toContain("fix");
    expect(r.canonical_tokens).toContain("broken");
    expect(r.canonical_tokens).toContain("migration");
  });

  it("catches slangy nouns like 'thingy'", () => {
    const r = normalise("Bung in a thingy that shows the last 10 leads");
    expect(r.canonical_tokens).toContain("add");
    expect(r.canonical_tokens).toContain("thing");
  });

  it("preserves proper nouns and paths as unresolved tokens", () => {
    const r = normalise("Add a new route at /api/nex/health that returns {ok:true}");
    expect(r.unresolved.some(t => t.includes("api"))).toBe(true);
  });

  it("records what got substituted", () => {
    const r = normalise("Chuck out the naff module and knock up a proper one");
    const subs = r.substitutions.map(s => s.from);
    expect(subs).toContain("chuck out");
    expect(subs).toContain("naff");
    expect(subs).toContain("knock up");
    expect(subs).toContain("proper");
  });
});

describe("intent parser · code domain · slangy phrasings resolve", () => {
  const intents = CODE_INTENT_REGISTRY;

  it("resolves 'chuck in a new endpoint' → add_api_route", () => {
    const r = parseIntent("chuck in a new endpoint at /api/nex/foo", { intents });
    expect(r.intent_slug === "add_api_route" || r.intent_slug === "add_feature").toBe(true);
    // Add_api_route should be highest OR at least in candidates
    expect(r.candidate_intents.some(c => c.slug === "add_api_route")).toBe(true);
  });

  it("resolves 'sort out that dodgy migration' → fix_bug OR add_migration", () => {
    const r = parseIntent("sort out that dodgy migration", { intents });
    expect(["fix_bug", "add_migration"]).toContain(r.intent_slug);
  });

  it("resolves 'walk me through how tierCatalog works' → explain", () => {
    const r = parseIntent("walk me through how tierCatalog works", { intents });
    expect(r.intent_slug).toBe("explain");
  });

  it("resolves 'bung in a new column on leads table' → add_migration", () => {
    const r = parseIntent("bung in a new column on the leads table", { intents });
    expect(r.intent_slug).toBe("add_migration");
  });

  it("resolves 'hi' as small_talk", () => {
    const r = parseIntent("hi", { intents });
    expect(r.intent_slug).toBe("small_talk");
  });

  it("returns null intent + candidate list for gibberish", () => {
    const r = parseIntent("xkcd wibble frobnicate zorp", { intents });
    expect(r.intent_slug).toBe(null);
    expect(r.confidence).toBeLessThan(0.15);
  });

  it("captures which trigger tokens fired · explainability check", () => {
    const r = parseIntent("chuck in a new endpoint", { intents });
    expect(r.trigger_matches.length).toBeGreaterThan(0);
  });
});
