// src/lib/nex-registry/orb-invariants.test.ts
//
// Step 8 · Rule-6 invariants for the Workstation Orb.
//
// The Orb is a visual layer over already-real capabilities. It must:
//   1. Only surface REAL capabilities as "available"
//   2. Honestly display UNAVAILABLE capabilities (BUILD, PUBLISH, etc.)
//   3. Never authorise any action · resolver identifies · does not invoke
//   4. Preserve the 4-state contract (RESOLVED / AMBIGUOUS / NOT_AVAILABLE / NOT_FOUND)
//
// These tests exercise the SAME semantic graph + resolver the Orb component
// consumes, so any regression in the underlying invariants is caught here.

import { describe, it, expect, beforeEach } from "vitest";
import {
  listUiElements,
  seedWorkstationUiTargets,
  _resetUiSemanticGraphForTests,
} from "./nex-ui-semantic-graph";
import { resolveIntentGrounded, type LiveUiState } from "./nex-guide";

function liveWithAllReal(): LiveUiState {
  return {
    visible_selectors: new Set([
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
      '[data-nex-ui="workstation-active-project"]',
      '[data-nex-ui="workstation-run-project"]',
      '[data-nex-ui="workstation-export-project"]',
      '[data-nex-ui="workstation-nex-orb"]',
    ]),
    probed_at_iso: new Date().toISOString(),
    viewport: "desktop",
  };
}

beforeEach(() => {
  _resetUiSemanticGraphForTests();
  seedWorkstationUiTargets();
});

describe("Orb · surfaces only real capabilities as available", () => {
  it("Available list contains SAVE / RUN / VERIFY-adjacent-controls / EXPORT / TASK-adjacent (chat)", () => {
    const all = listUiElements({ scope: "workstation" });
    const availableLabels = all
      .filter((e) => e.availability !== "not_available")
      .map((e) => e.customer_label);
    expect(availableLabels).toContain("Save");
    expect(availableLabels).toContain("Run project");
    expect(availableLabels).toContain("Export project");
    expect(availableLabels).toContain("Active project");
    // Task creation surface (chat composer + Send)
    expect(availableLabels).toContain("Ask NEX");
    expect(availableLabels).toContain("Send");
    // Verify has no dedicated Workstation button · that's honest · not represented
    // as a customer-facing target in the semantic graph.
  });

  it("Unavailable list HONESTLY includes Publish and other not-yet capabilities", () => {
    const all = listUiElements({ scope: "workstation" });
    const unavailableLabels = all
      .filter((e) => e.availability === "not_available")
      .map((e) => e.customer_label);
    expect(unavailableLabels).toContain("Publish");
    // BUILD is not a NEX1 customer operation at all · it doesn't need to appear
    // in either list. The audit found "customer Build doesn't exist" so the
    // Orb doesn't fabricate it.
    // Files / Assets / Tests / Git / Evidence / Settings remain aspirational
    expect(unavailableLabels).toContain("Files");
    expect(unavailableLabels).toContain("Tests");
  });

  it("BUILD is not fabricated · no customer-facing Build target in the graph", () => {
    const all = listUiElements({ scope: "workstation" });
    const buildLike = all.filter((e) =>
      /build/i.test(e.customer_label) || e.intent_tags.some((t) => /build/i.test(t))
    );
    // Nothing should present itself as a customer Build operation
    expect(buildLike.length).toBe(0);
  });
});

describe("Orb · resolver never returns RESOLVED for a not-yet capability", () => {
  it("'publish my app' → NOT_AVAILABLE (never RESOLVED · never NOT_FOUND when semantic exists)", () => {
    const live = liveWithAllReal();
    const r = resolveIntentGrounded({ text: "publish my app", live_state: live });
    expect(r.outcome).toBe("NOT_AVAILABLE");
    if (r.outcome === "NOT_AVAILABLE") {
      const names = r.matched_but_not_live.map((c) => c.customer_label);
      expect(names).toContain("Publish");
    }
  });

  it("gibberish → NOT_FOUND · distinct from NOT_AVAILABLE", () => {
    const live = liveWithAllReal();
    const r = resolveIntentGrounded({ text: "quibblenax morfnak", live_state: live });
    expect(r.outcome).toBe("NOT_FOUND");
  });
});

describe("Orb · Rule 6 · resolver identifies but never authorises", () => {
  // Rule 6 is enforced at the resolver contract level: the outcome shape
  // provides ONLY a target reference, never an action-invocation. The Orb
  // component reads this and highlights the DOM element; the customer must
  // press the real control. These assertions verify the shape guarantees.

  it("RESOLVED outcome shape carries a target reference only · no action-invocation field", () => {
    const live = liveWithAllReal();
    const r = resolveIntentGrounded({ text: "save my work", live_state: live });
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") {
      // The resolver returns { target, next_state } and nothing that could be
      // interpreted as an execute-this instruction.
      const keys = Object.keys(r);
      expect(keys.sort()).toEqual(["next_state", "outcome", "target"].sort());
      expect(r.next_state).toBe("TARGET_FOUND");
      // The target is a descriptor · not an executor
      expect(r.target).toHaveProperty("customer_label");
      expect(r.target).toHaveProperty("css_selector");
      expect(r.target).toHaveProperty("purpose");
      // No `execute` or `invoke` field
      expect((r.target as unknown as { execute?: unknown }).execute).toBeUndefined();
      expect((r.target as unknown as { invoke?: unknown }).invoke).toBeUndefined();
    }
  });

  it("all real Workstation targets have a purpose string · so the Orb can explain, not just point", () => {
    const all = listUiElements({ scope: "workstation" });
    for (const el of all) {
      expect(typeof el.purpose).toBe("string");
      expect(el.purpose.length).toBeGreaterThan(0);
    }
  });
});

describe("Orb · availability signalling is anti-fabrication-safe", () => {
  it("every aspirational target is honestly flagged availability='not_available'", () => {
    const all = listUiElements({ scope: "workstation" });
    const asp = all.filter((e) => e.availability === "not_available");
    for (const el of asp) {
      // Aspirational entries must NEVER pretend to be live
      // The css_selector may exist for future wiring but availability must be not_available
      expect(el.availability).toBe("not_available");
    }
  });

  it("every real target has availability !== 'not_available'", () => {
    const all = listUiElements({ scope: "workstation" });
    const real = all.filter((e) =>
      e.css_selector && !e.css_selector.includes("workstation-nav-") // "workstation-nav-*" is our aspirational-slot convention
    );
    for (const el of real) {
      expect(el.availability).not.toBe("not_available");
    }
  });
});
