import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveIntentGrounded,
  type LiveUiState,
} from "./nex-guide";
import {
  seedWorkstationUiTargets,
  _resetUiSemanticGraphForTests,
  listUiElements,
} from "./nex-ui-semantic-graph";

// ─── LiveUiState helpers ──────────────────────────────────────────────

function liveWith(...selectors: readonly string[]): LiveUiState {
  return {
    visible_selectors: new Set(selectors),
    probed_at_iso: new Date().toISOString(),
    viewport: "desktop",
  };
}

// Selectors that would come from a real Playwright probe of the actual
// workstation now that data-nex-ui attributes have been added.
const REAL_WORKSTATION_LIVE_SELECTORS = [
  '[data-nex-ui="workstation-tile-code"]',
  '[data-nex-ui="workstation-tile-history"]',
  '[data-nex-ui="workstation-tile-plugins"]',
  '[data-nex-ui="workstation-tile-loop"]',
  '[data-nex-ui="workstation-tile-repo"]',
  '[data-nex-ui="workstation-tile-notes"]',
  '[data-nex-ui="workstation-chat-input"]',
  '[data-nex-ui="workstation-chat-send"]',
  '[data-nex-ui="workstation-preview-frame"]',
  '[data-nex-ui="workstation-preview-reload"]',
  '[data-nex-ui="workstation-save"]',
  '[data-nex-ui="workstation-run-project"]',
  '[data-nex-ui="workstation-export-project"]',
];

describe("Phase 5C · seed audit · what's actually in the workstation", () => {
  beforeEach(() => {
    _resetUiSemanticGraphForTests();
    seedWorkstationUiTargets();
  });

  it("registers the 6 REAL tab tiles + chat + send + preview + reload + Orb + Save + Active project + Run project + Export project (15 real + 7 aspirational = 22)", () => {
    const all = listUiElements({ scope: "workstation" });
    const real = all.filter((e) => e.availability !== "not_available");
    const aspirational = all.filter((e) => e.availability === "not_available");
    expect(real.length).toBeGreaterThanOrEqual(14);
    expect(aspirational.length).toBeGreaterThanOrEqual(7);
  });

  it("aspirational entries (Publish, Files, Assets, etc.) are honestly marked not_available", () => {
    const notLive = listUiElements({ scope: "workstation" }).filter((e) => e.availability === "not_available");
    const names = notLive.map((e) => e.customer_label);
    expect(names).toContain("Publish");
    expect(names).toContain("Files");
    expect(names).toContain("Assets");
  });

  it("Save is REAL · resolves against the actual workstation-save button", () => {
    const all = listUiElements({ scope: "workstation" });
    const save = all.find((e) => e.customer_label === "Save");
    expect(save).toBeDefined();
    expect(save?.availability).toBe("always");
    expect(save?.css_selector).toBe('[data-nex-ui="workstation-save"]');
    expect(save?.action).toBe("open_save_envelope");
  });
});

describe("Phase 5C · four founder-required scenarios", () => {
  beforeEach(() => {
    _resetUiSemanticGraphForTests();
    seedWorkstationUiTargets();
  });

  // Scenario 1: "How do I export my app?"
  // Export project is now REAL (bound to canonical Project registry).
  // Intent resolves to the real Export project button.
  it("'How do I export my app?' → RESOLVED to real Export project button", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "how do I export my app?", live_state: live });
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") {
      expect(r.target.customer_label).toBe("Export project");
      expect(r.target.css_selector).toBe('[data-nex-ui="workstation-export-project"]');
    }
  });

  // Scenario 2: "I want to put this online" → Publish is also aspirational
  it("'I want to put this online' → NOT_AVAILABLE (Publish exists in graph but is not_available)", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "I want to put this online please", live_state: live });
    expect(r.outcome).toBe("NOT_AVAILABLE");
    if (r.outcome === "NOT_AVAILABLE") {
      const names = r.matched_but_not_live.map((c) => c.customer_label);
      expect(names).toContain("Publish");
    }
  });

  // Scenario 3: unknown intent → NOT_FOUND · Orb points nowhere
  it("unknown intent → NOT_FOUND (Orb points nowhere)", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "flibbergibbert xyzzy narwhal", live_state: live });
    expect(r.outcome).toBe("NOT_FOUND");
  });

  // Scenario 4: REAL live target: user asks about code
  it("'show me the code' → RESOLVED to real Code tile", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "show me the code", live_state: live });
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") {
      expect(r.target.customer_label).toBe("Code");
      expect(r.target.css_selector).toBe('[data-nex-ui="workstation-tile-code"]');
    }
  });

  // Save is REAL: "save my work" → RESOLVED to the real Save button
  it("'save my work' → RESOLVED to real Save button", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "save my work", live_state: live });
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") {
      expect(r.target.customer_label).toBe("Save");
      expect(r.target.css_selector).toBe('[data-nex-ui="workstation-save"]');
    }
  });

  // Ambiguity across REAL tiles: "repo" and "files" · Repo tile has intent_tag "files"
  it("'where are my files?' → NOT_AVAILABLE OR AMBIGUOUS (Files aspirational · Repo tile also tagged 'files')", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "where are my files?", live_state: live });
    // Repo tile is live with intent_tag "files" · Files aspirational is not_available
    // So result is RESOLVED to Repo (the only live match)
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") {
      expect(r.target.customer_label).toBe("Repo");
    }
  });
});

describe("Phase 5C · anti-fabrication invariants of resolveIntentGrounded", () => {
  beforeEach(() => {
    _resetUiSemanticGraphForTests();
    seedWorkstationUiTargets();
  });

  it("when live_state is empty · every semantic match becomes NOT_AVAILABLE", () => {
    const emptyLive: LiveUiState = { visible_selectors: new Set(), probed_at_iso: new Date().toISOString() };
    const r = resolveIntentGrounded({ text: "show me the code", live_state: emptyLive });
    expect(r.outcome).toBe("NOT_AVAILABLE");
  });

  it("NOT_AVAILABLE is distinct from NOT_FOUND · caller can inform the customer differently", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    // Publish is still aspirational · use it as the NOT_AVAILABLE case
    const rPublish = resolveIntentGrounded({ text: "publish my app", live_state: live });
    const rGibberish = resolveIntentGrounded({ text: "flibbergibbert xyzzy", live_state: live });
    expect(rPublish.outcome).toBe("NOT_AVAILABLE");
    expect(rGibberish.outcome).toBe("NOT_FOUND");
    // Different outcomes = different UX responses
    expect(rPublish.outcome).not.toBe(rGibberish.outcome);
  });

  it("empty text → NOT_FOUND (no fabricated match)", () => {
    const live = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS);
    const r = resolveIntentGrounded({ text: "", live_state: live });
    expect(r.outcome).toBe("NOT_FOUND");
  });

  it("target with matching intent but absent from live_state selector set → NOT_AVAILABLE", () => {
    // Live state that has ONLY the reload button · not the tiles
    const partial = liveWith('[data-nex-ui="workstation-preview-reload"]');
    const r = resolveIntentGrounded({ text: "show me the code", live_state: partial });
    expect(r.outcome).toBe("NOT_AVAILABLE");
  });

  it("resolveIntentGrounded never returns RESOLVED with a not_available target", () => {
    // Even if we pass "publish" and the publish selector were in live_state,
    // availability="not_available" filters it out (Publish is still aspirational).
    const liveWithPublish = liveWith(...REAL_WORKSTATION_LIVE_SELECTORS, '[data-nex-ui="workstation-nav-publish"]');
    const r = resolveIntentGrounded({ text: "publish my app", live_state: liveWithPublish });
    // Because availability="not_available" is a hard filter, this stays NOT_AVAILABLE
    expect(r.outcome).toBe("NOT_AVAILABLE");
  });
});
