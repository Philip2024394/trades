import { describe, it, expect, beforeEach } from "vitest";
import {
  NEX_GUIDED_DESIGN_VERSION,
  regionToCustomer,
  customerToRegions,
  customerToElement,
  generateDesignMap,
  makeChoiceSet,
  assessPageCompleteness,
  explainRegionToCustomer,
  explainChoiceSetToCustomer,
  type DesignChoice,
  type PageCompletenessAssessment,
} from "./nex-guided-design";
import {
  RULE_3_CUSTOMER_LANGUAGE_PRIMACY,
  RULE_4_NO_HALF_BUILT_PAGES,
  assertRule3CustomerLanguage,
  assertRule4NoHalfBuiltPages,
  describeRules,
} from "./capability-rule";
import { seedCoreLayouts, listAllLayouts, _resetLayoutRegistryForTests } from "./layout-registry";

describe("Rule 3 · Customer Language Primacy", () => {
  it("frozen constant matches founder mandate", () => {
    expect(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.id).toBe("RULE-3");
    expect(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.statement).toContain("Never require the customer to know");
    expect(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.statement).toContain("expose choices, not expose complexity");
    expect(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.frozen).toBe(true);
    expect(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms.length).toBeGreaterThan(10);
  });

  it("flags NEX using 'hero' when customer never did", () => {
    const v = assertRule3CustomerLanguage({
      nex_reply: "I'll adjust the hero section for you.",
      customer_message: "make the top of the page look better",
    });
    expect(v.some((s) => s.includes("hero"))).toBe(true);
  });

  it("does NOT flag NEX using 'hero' when customer used it first", () => {
    const v = assertRule3CustomerLanguage({
      nex_reply: "I'll adjust the hero for you now.",
      customer_message: "change the hero",
    });
    expect(v.length).toBe(0);
  });

  it("flags 'section' when NEX adds it even if the customer used 'hero'", () => {
    // Demonstrates that the exception is per-term, not blanket
    const v = assertRule3CustomerLanguage({
      nex_reply: "I'll adjust the hero section for you.",
      customer_message: "change the hero",
    });
    expect(v.some((s) => s.includes("section"))).toBe(true);
  });

  it("flags multiple jargon terms in one reply", () => {
    const v = assertRule3CustomerLanguage({
      nex_reply: "The container has excessive padding and poor vertical rhythm.",
      customer_message: "this area feels too crowded",
    });
    expect(v.length).toBeGreaterThanOrEqual(3);
  });

  it("descriptions of choices in customer-facing language pass", () => {
    const v = assertRule3CustomerLanguage({
      nex_reply: "I agree this area is quite dense. I can give it more breathing room, simplify the text, or make the heading stronger. Which direction would you like?",
      customer_message: "this bit feels too crowded",
    });
    expect(v.length).toBe(0);
  });
});

describe("Rule 4 · No Half-Built Pages", () => {
  it("frozen constant matches founder mandate", () => {
    expect(RULE_4_NO_HALF_BUILT_PAGES.id).toBe("RULE-4");
    expect(RULE_4_NO_HALF_BUILT_PAGES.statement).toContain("Every design must be complete");
    expect(RULE_4_NO_HALF_BUILT_PAGES.frozen).toBe(true);
    expect(RULE_4_NO_HALF_BUILT_PAGES.forbidden_completion_signals.length).toBeGreaterThan(5);
  });

  it("catches 'coming later' in a page summary", () => {
    const v = assertRule4NoHalfBuiltPages({
      page_summary: "Header, hero, contact form (map coming later)",
      region_manifest: [
        { region: "header", implemented: true, explicitly_deferred: false },
        { region: "hero", implemented: true, explicitly_deferred: false },
        { region: "map", implemented: false, explicitly_deferred: false },
      ],
    });
    expect(v.some((s) => s.includes("coming later"))).toBe(true);
  });

  it("catches 'placeholder' in a page summary", () => {
    const v = assertRule4NoHalfBuiltPages({
      page_summary: "Header, hero, placeholder for the map",
      region_manifest: [],
    });
    expect(v.some((s) => s.includes("placeholder"))).toBe(true);
  });

  it("catches unimplemented + non-deferred regions", () => {
    const v = assertRule4NoHalfBuiltPages({
      page_summary: "Header and hero",
      region_manifest: [
        { region: "header", implemented: true, explicitly_deferred: false },
        { region: "hero", implemented: false, explicitly_deferred: false },
      ],
    });
    expect(v.some((s) => s.includes("hero"))).toBe(true);
  });

  it("permits explicitly-deferred regions (customer opted them out)", () => {
    const v = assertRule4NoHalfBuiltPages({
      page_summary: "Header and hero",
      region_manifest: [
        { region: "header", implemented: true, explicitly_deferred: false },
        { region: "hero", implemented: false, explicitly_deferred: true },  // customer said "no hero"
      ],
    });
    expect(v.length).toBe(0);
  });
});

describe("describeRules exposes all 4 rules", () => {
  it("returns rule 1 · 2 · 3 · 4", () => {
    const rules = describeRules();
    expect(rules.rule_1.id).toBe("RULE-1");
    expect(rules.rule_2.id).toBe("RULE-2");
    expect(rules.rule_3.id).toBe("RULE-3");
    expect(rules.rule_4.id).toBe("RULE-4");
  });
});

describe("Vocabulary translation · customer ↔ system", () => {
  it("regionToCustomer never returns a forbidden jargon term", () => {
    const forbidden = RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms.map((t) => t.toLowerCase());
    const regions = ["primary_navigation", "top_bar", "primary_content", "detail_panel", "canvas", "asset_browser", "contextual_actions", "filters", "search", "footer", "install_prompt", "offline_indicator"] as const;
    for (const r of regions) {
      const phrase = regionToCustomer(r as never).toLowerCase();
      for (const bad of forbidden) {
        expect(phrase.includes(bad)).toBe(false);
      }
    }
  });

  it("customerToRegions maps 'menu' to primary_navigation", () => {
    const r = customerToRegions("the menu");
    expect(r).toContain("primary_navigation");
  });

  it("customerToRegions maps 'bottom of the page' to footer", () => {
    const r = customerToRegions("the bottom of the page");
    expect(r).toContain("footer");
  });

  it("customerToRegions returns empty for unrecognised phrase (no fabrication)", () => {
    const r = customerToRegions("something entirely unrelated to design");
    expect(r.length).toBe(0);
  });

  it("customerToElement maps 'title' to heading", () => {
    expect(customerToElement("the title")).toBe("heading");
  });

  it("customerToElement maps 'picture' to image", () => {
    expect(customerToElement("picture")).toBe("image");
  });

  it("customerToElement returns null for unrecognised phrase", () => {
    expect(customerToElement("gargantuan flux capacitor")).toBe(null);
  });
});

describe("Design Map · numbered overlay from a real layout", () => {
  beforeEach(() => {
    _resetLayoutRegistryForTests();
    seedCoreLayouts();
  });

  it("generates numbered markers matching the layout's visible regions", () => {
    const layout = listAllLayouts().find((l) => l.name === "focused-dashboard")!;
    const map = generateDesignMap(layout);
    expect(map.layout_id).toBe(layout.layout_id);
    expect(map.markers.length).toBeGreaterThan(0);
    // First marker starts at ordinal 1 with a circled glyph
    expect(map.markers[0].ordinal).toBe(1);
    expect(map.markers[0].display_glyph).toBe("①");
    // Every marker has both system + customer labels
    for (const m of map.markers) {
      expect(m.system_label.length).toBeGreaterThan(0);
      expect(m.customer_label.length).toBeGreaterThan(0);
    }
  });

  it("does NOT include hidden desktop regions in the design map", () => {
    const layout = listAllLayouts().find((l) => l.name === "focused-dashboard")!;
    const map = generateDesignMap(layout);
    for (const m of map.markers) {
      const desktopBehaviour = layout.responsive.desktop.regions[m.region];
      expect(desktopBehaviour).not.toBe("hidden");
    }
  });

  it("customer-facing labels never contain forbidden jargon (Rule 3)", () => {
    const layout = listAllLayouts()[0];
    const map = generateDesignMap(layout);
    const forbidden = RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms;
    for (const m of map.markers) {
      for (const bad of forbidden) {
        expect(m.customer_label.toLowerCase().includes(bad.toLowerCase())).toBe(false);
      }
    }
  });
});

describe("ChoiceSet · 'give me three options'", () => {
  const goodChoice = (id: DesignChoice["id"], label: string): DesignChoice => ({
    id, customer_label: label, preview_description: `${label} preview`,
    applies_to_regions: ["primary_content"], structural_change: `apply ${label}`,
    is_placeholder: false,
  });

  it("accepts a 2-choice set", () => {
    const r = makeChoiceSet({
      question: "How would you like the main area?",
      choices: [goodChoice("A", "Clean"), goodChoice("B", "Bold")],
      target_customer_phrase: "the main area",
    });
    expect(r.outcome).toBe("OK");
  });

  it("accepts a 3-choice set (canonical)", () => {
    const r = makeChoiceSet({
      question: "Three directions for the top of the page:",
      choices: [goodChoice("A", "Minimal"), goodChoice("B", "Editorial"), goodChoice("C", "Visual")],
      target_customer_phrase: "the top of the page",
    });
    expect(r.outcome).toBe("OK");
    if (r.outcome === "OK") {
      expect(r.choice_set.target_region).toBe("top_bar");
      expect(r.choice_set.choices.length).toBe(3);
    }
  });

  it("rejects a 1-choice set (one is not a choice)", () => {
    const r = makeChoiceSet({
      question: "Take it or leave it?",
      choices: [goodChoice("A", "Only option")],
      target_customer_phrase: "anything",
    });
    expect(r.outcome).toBe("REJECTED");
  });

  it("rejects a 5-choice set (overwhelms the customer)", () => {
    const r = makeChoiceSet({
      question: "Pick one",
      choices: [
        goodChoice("A", "1"), goodChoice("B", "2"), goodChoice("C", "3"), goodChoice("D", "4"),
        // @ts-expect-error · deliberately exceeding
        { id: "E", customer_label: "5", preview_description: "5", applies_to_regions: [], structural_change: "x", is_placeholder: false },
      ],
      target_customer_phrase: "anything",
    });
    expect(r.outcome).toBe("REJECTED");
  });

  it("rejects a choice with empty structural_change (would appear to change but do nothing)", () => {
    const r = makeChoiceSet({
      question: "?",
      choices: [
        goodChoice("A", "Real"),
        { id: "B", customer_label: "Also Real", preview_description: "p", applies_to_regions: [], structural_change: "", is_placeholder: false },
      ],
      target_customer_phrase: "anything",
    });
    expect(r.outcome).toBe("REJECTED");
  });

  it("rejects a choice marked as placeholder (Rule 4)", () => {
    const r = makeChoiceSet({
      question: "?",
      choices: [
        goodChoice("A", "Real"),
        // @ts-expect-error · violating is_placeholder invariant on purpose
        { id: "B", customer_label: "Fake", preview_description: "p", applies_to_regions: [], structural_change: "x", is_placeholder: true },
      ],
      target_customer_phrase: "anything",
    });
    expect(r.outcome).toBe("REJECTED");
  });
});

describe("PageCompletenessGate · Rule 4 enforcement", () => {
  const base: PageCompletenessAssessment = {
    page_id: "test-page",
    regions: [
      { region: "header", requested_by_customer: true, implemented: true, explicitly_deferred: false, evidence_ref: "src/x/header.tsx" },
      { region: "hero", requested_by_customer: true, implemented: true, explicitly_deferred: false, evidence_ref: "src/x/hero.tsx" },
      { region: "footer", requested_by_customer: true, implemented: true, explicitly_deferred: false, evidence_ref: "src/x/footer.tsx" },
    ],
    responsive: { desktop_implemented: true, tablet_implemented: true, mobile_implemented: true },
    interaction_states: { loading_state_implemented: true, empty_state_implemented: true, error_state_implemented: true },
    page_summary: "header, hero, footer · all responsive",
    interactive: true,
    has_list_or_search: false,
  };

  it("passes COMPLETE for a fully-built page", () => {
    const r = assessPageCompleteness(base);
    expect(r.outcome).toBe("COMPLETE");
  });

  it("catches missing responsive viewport (mobile)", () => {
    const r = assessPageCompleteness({ ...base, responsive: { ...base.responsive, mobile_implemented: false } });
    expect(r.outcome).toBe("INCOMPLETE");
    if (r.outcome === "INCOMPLETE") expect(r.missing_responsive).toContain("mobile");
  });

  it("catches unimplemented region the customer requested", () => {
    const r = assessPageCompleteness({
      ...base,
      regions: [...base.regions, { region: "contact_form", requested_by_customer: true, implemented: false, explicitly_deferred: false, evidence_ref: null }],
    });
    expect(r.outcome).toBe("INCOMPLETE");
    if (r.outcome === "INCOMPLETE") expect(r.missing_regions).toContain("contact_form");
  });

  it("catches 'coming later' phrase in page_summary", () => {
    const r = assessPageCompleteness({ ...base, page_summary: "header, hero, footer, map coming later" });
    expect(r.outcome).toBe("INCOMPLETE");
    if (r.outcome === "INCOMPLETE") expect(r.violations.some((v) => v.includes("coming later"))).toBe(true);
  });

  it("catches missing loading state when page is interactive", () => {
    const r = assessPageCompleteness({ ...base, interaction_states: { ...base.interaction_states, loading_state_implemented: false } });
    expect(r.outcome).toBe("INCOMPLETE");
    if (r.outcome === "INCOMPLETE") expect(r.missing_states).toContain("loading_state");
  });

  it("catches missing empty state on a list/search page", () => {
    const r = assessPageCompleteness({ ...base, has_list_or_search: true, interaction_states: { ...base.interaction_states, empty_state_implemented: false } });
    expect(r.outcome).toBe("INCOMPLETE");
    if (r.outcome === "INCOMPLETE") expect(r.missing_states).toContain("empty_state");
  });

  it("permits an explicitly-deferred region (customer opted out)", () => {
    const r = assessPageCompleteness({
      ...base,
      regions: [...base.regions, { region: "map", requested_by_customer: true, implemented: false, explicitly_deferred: true, evidence_ref: null }],
    });
    expect(r.outcome).toBe("COMPLETE");
  });
});

describe("Customer-facing explanation templates", () => {
  it("explainRegionToCustomer never uses forbidden jargon", () => {
    const r = explainRegionToCustomer("top_bar");
    const forbidden = RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms;
    for (const bad of forbidden) expect(r.toLowerCase().includes(bad.toLowerCase())).toBe(false);
  });

  it("explainChoiceSetToCustomer lists A/B/C labels the customer can point at", () => {
    const cs = makeChoiceSet({
      question: "Which direction?",
      choices: [
        { id: "A", customer_label: "Clean", preview_description: "p", applies_to_regions: ["primary_content"], structural_change: "x", is_placeholder: false },
        { id: "B", customer_label: "Bold", preview_description: "p", applies_to_regions: ["primary_content"], structural_change: "y", is_placeholder: false },
      ],
      target_customer_phrase: "the main area",
    });
    if (cs.outcome !== "OK") throw new Error("expected OK");
    const explanation = explainChoiceSetToCustomer(cs.choice_set);
    expect(explanation).toContain("A · Clean");
    expect(explanation).toContain("B · Bold");
  });
});

describe("nex-guided-design · version constant", () => {
  it("canonical version", () => {
    expect(NEX_GUIDED_DESIGN_VERSION).toBe("nex-guided-design.v1.2026-09-19");
  });
});
