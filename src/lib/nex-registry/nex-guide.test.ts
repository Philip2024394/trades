import { describe, it, expect, beforeEach } from "vitest";
import {
  RULE_6_CUSTOMER_SOVEREIGNTY,
  assertRule6GuideAction,
  describeRule3Summary,
  describeRules,
  RULE_3_CUSTOMER_LANGUAGE_PRIMACY,
} from "./capability-rule";
import { CHOICESET_LIMITS, makeChoiceSet } from "./nex-guided-design";
import {
  seedWorkstationUiTargets,
  registerUiElement,
  listUiElements,
  countUiElements,
  findByIntent,
  _resetUiSemanticGraphForTests,
  NEX_UI_SEMANTIC_GRAPH_VERSION,
} from "./nex-ui-semantic-graph";
import {
  resolveIntent,
  advanceState,
  performGuideAction,
  runGuideSession,
  NEX_GUIDE_VERSION,
} from "./nex-guide";

describe("Founder-directed fix · Rule 3 count is mechanically generated", () => {
  it("describeRule3Summary reports the ACTUAL length of the frozen array (not a manual number)", () => {
    const s = describeRule3Summary();
    expect(s.forbidden_customer_facing_terms_count).toBe(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms.length);
    expect(s.rule_id).toBe("RULE-3");
    expect(s.frozen).toBe(true);
  });

  it("the frozen array contains ≥20 terms (protects against silent removal)", () => {
    expect(RULE_3_CUSTOMER_LANGUAGE_PRIMACY.forbidden_customer_facing_terms.length).toBeGreaterThanOrEqual(20);
  });
});

describe("Founder-directed fix · ChoiceSet 2-4 limit labelled as design hypothesis", () => {
  it("CHOICESET_LIMITS declares evidence_status DESIGN_HYPOTHESIS", () => {
    expect(CHOICESET_LIMITS.min).toBe(2);
    expect(CHOICESET_LIMITS.max).toBe(4);
    expect(CHOICESET_LIMITS.max_rationale_evidence_status).toBe("DESIGN_HYPOTHESIS");
    expect(CHOICESET_LIMITS.origin).toBe("GOVERNANCE_RULE");
  });

  it("REJECTED rationale for >4 choices references DESIGN_HYPOTHESIS · not scientific claim", () => {
    const r = makeChoiceSet({
      question: "?",
      choices: [
        { id: "A", customer_label: "1", preview_description: "p", applies_to_regions: ["primary_content"], structural_change: "x", is_placeholder: false },
        { id: "B", customer_label: "2", preview_description: "p", applies_to_regions: ["primary_content"], structural_change: "x", is_placeholder: false },
        { id: "C", customer_label: "3", preview_description: "p", applies_to_regions: ["primary_content"], structural_change: "x", is_placeholder: false },
        { id: "D", customer_label: "4", preview_description: "p", applies_to_regions: ["primary_content"], structural_change: "x", is_placeholder: false },
        // @ts-expect-error · deliberately 5
        { id: "E", customer_label: "5", preview_description: "p", applies_to_regions: [], structural_change: "x", is_placeholder: false },
      ],
      target_customer_phrase: "anything",
    });
    expect(r.outcome).toBe("REJECTED");
    if (r.outcome === "REJECTED") {
      expect(r.reason).toContain("DESIGN_HYPOTHESIS");
    }
  });
});

describe("RULE-6 · Customer Sovereignty (the Orb principle)", () => {
  it("frozen constant matches founder mandate", () => {
    expect(RULE_6_CUSTOMER_SOVEREIGNTY.id).toBe("RULE-6");
    expect(RULE_6_CUSTOMER_SOVEREIGNTY.statement).toContain("NEX has hands on the interface");
    expect(RULE_6_CUSTOMER_SOVEREIGNTY.statement).toContain("customer remains in control");
    expect(RULE_6_CUSTOMER_SOVEREIGNTY.frozen).toBe(true);
    expect(RULE_6_CUSTOMER_SOVEREIGNTY.forbidden_actions).toContain("silent_click");
    expect(RULE_6_CUSTOMER_SOVEREIGNTY.forbidden_actions).toContain("invocation_without_explicit_authorization");
  });

  it("assertRule6GuideAction flags invocation without authorization", () => {
    const v = assertRule6GuideAction({
      action_id: "open_export_panel",
      customer_authorization: null,
      side_effect_kind: "invocation",
    });
    expect(v.some((s) => s.includes("customer_authorization"))).toBe(true);
  });

  it("assertRule6GuideAction passes highlight_only action without authorization", () => {
    const v = assertRule6GuideAction({
      action_id: "highlight_target",
      customer_authorization: null,
      side_effect_kind: "highlight_only",
    });
    expect(v.length).toBe(0);
  });

  it("assertRule6GuideAction flags any action_id in the forbidden list", () => {
    const v = assertRule6GuideAction({
      action_id: "silent_click",
      customer_authorization: { kind: "explicit_click", observed_at_iso: new Date().toISOString() },
      side_effect_kind: "invocation",
    });
    expect(v.some((s) => s.includes("explicitly forbidden"))).toBe(true);
  });

  it("performGuideAction returns REJECTED_RULE_6 for a rule violation", () => {
    const r = performGuideAction({
      action_id: "open_export_panel",
      customer_authorization: null,
      side_effect_kind: "invocation",
    });
    expect(r.outcome).toBe("REJECTED_RULE_6");
  });

  it("performGuideAction PERFORMED for an authorized invocation", () => {
    const r = performGuideAction({
      action_id: "open_export_panel",
      customer_authorization: { kind: "explicit_orb_confirm", observed_at_iso: new Date().toISOString() },
      side_effect_kind: "invocation",
    });
    expect(r.outcome).toBe("PERFORMED");
  });

  it("describeRules exposes all six rules", () => {
    const r = describeRules();
    expect(r.rule_6.id).toBe("RULE-6");
  });
});

describe("nex-ui-semantic-graph · anti-fabrication", () => {
  beforeEach(() => _resetUiSemanticGraphForTests());

  it("canonical version", () => {
    expect(NEX_UI_SEMANTIC_GRAPH_VERSION).toBe("nex-ui-semantic-graph.v1.2026-09-19");
  });

  it("refuses to register element with no real target (no selector · no route · no region · no user confirmation)", () => {
    expect(() => registerUiElement({
      scope: "workstation", kind: "button",
      customer_label: "Ghost", purpose: "does not exist",
      location_path: [], action: "do_nothing",
      intent_tags: ["ghost"],
      availability: "always",
      css_selector: null, route_href: null, region_id: null,
      provenance: [],
    })).toThrow(/must declare a real target/);
  });

  it("permits element with real css_selector", () => {
    const e = registerUiElement({
      scope: "workstation", kind: "button",
      customer_label: "Real", purpose: "exists in the DOM",
      location_path: [], action: "click_me",
      intent_tags: ["real"],
      availability: "always",
      css_selector: '[data-nex-ui="test"]', route_href: null, region_id: null,
      provenance: [],
    });
    expect(e.customer_label).toBe("Real");
  });

  it("permits element without selector if user_confirmation provenance is present", () => {
    const now = new Date().toISOString();
    const e = registerUiElement({
      scope: "workstation", kind: "region",
      customer_label: "Preview area", purpose: "the live preview surface",
      location_path: [], action: "focus_preview",
      intent_tags: ["preview"],
      availability: "always",
      css_selector: null, route_href: null, region_id: null,
      provenance: [{ kind: "user_confirmation", path: "n/a", hash: null, observed_at_iso: now, note: "founder confirmed" }],
    });
    expect(e.customer_label).toBe("Preview area");
  });

  it("refuses element with zero intent_tags (Orb has nothing to match against)", () => {
    expect(() => registerUiElement({
      scope: "workstation", kind: "button",
      customer_label: "Untagged", purpose: "no way to find this",
      location_path: [], action: "nothing",
      intent_tags: [],
      availability: "always",
      css_selector: '[data-nex-ui="untagged"]', route_href: null, region_id: null,
      provenance: [],
    })).toThrow(/intent_tags/);
  });
});

describe("nex-ui-semantic-graph · workstation seed", () => {
  beforeEach(() => {
    _resetUiSemanticGraphForTests();
    seedWorkstationUiTargets();
  });

  it("seeds ≥12 real workstation targets", () => {
    expect(countUiElements()).toBeGreaterThanOrEqual(12);
  });

  it("Export project target has intent_tags including 'export' and 'download'", () => {
    const exportEls = listUiElements({ scope: "workstation" }).filter((e) => e.customer_label === "Export project");
    expect(exportEls.length).toBe(1);
    expect(exportEls[0].intent_tags).toContain("export");
    expect(exportEls[0].intent_tags).toContain("download");
    expect(exportEls[0].css_selector).toContain("workstation-export-project");
  });

  it("Publish target has intent_tags including 'go live' and 'deploy'", () => {
    const publish = listUiElements().find((e) => e.customer_label === "Publish")!;
    expect(publish.intent_tags).toContain("go live");
    expect(publish.intent_tags).toContain("deploy");
  });

  it("findByIntent(['export']) returns the Export project target", () => {
    const rows = findByIntent(["export"]);
    expect(rows.length).toBe(1);
    expect(rows[0].customer_label).toBe("Export project");
  });

  it("findByIntent(['gibberish']) returns empty · anti-fabrication", () => {
    const rows = findByIntent(["gibberish"]);
    expect(rows.length).toBe(0);
  });
});

describe("nex-guide · intent resolution (the founder scenario)", () => {
  beforeEach(() => {
    _resetUiSemanticGraphForTests();
    seedWorkstationUiTargets();
  });

  it("canonical version", () => {
    expect(NEX_GUIDE_VERSION).toBe("nex-guide.v1.2026-09-19");
  });

  it("'how do I export my app?' RESOLVES to the Export project target", () => {
    const r = resolveIntent({ text: "how do I export my app?" });
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") {
      expect(r.target.customer_label).toBe("Export project");
      expect(r.next_state).toBe("TARGET_FOUND");
    }
  });

  it("'I want to put this online' RESOLVES to Publish (semantic tag 'put online')", () => {
    const r = resolveIntent({ text: "I want to put this online please" });
    expect(r.outcome).toBe("RESOLVED");
    if (r.outcome === "RESOLVED") expect(r.target.customer_label).toBe("Publish");
  });

  it("gibberish returns NOT_FOUND · never invents a target (anti-fabrication)", () => {
    const r = resolveIntent({ text: "flibbergibbert xyzzy narwhal" });
    expect(r.outcome).toBe("NOT_FOUND");
    if (r.outcome === "NOT_FOUND") {
      expect(r.next_state).toBe("IDLE");
      expect(r.rationale).toContain("no registered UI element");
    }
  });

  it("ambiguous intent returns AMBIGUOUS with all candidates · never picks silently", () => {
    // 'files' matches Repo (real · intent_tag "files") + Files (aspirational · intent_tag "files")
    // Static resolveIntent doesn't filter by availability · so both appear
    const r = resolveIntent({ text: "where are my files?" });
    expect(r.outcome).toBe("AMBIGUOUS");
    if (r.outcome === "AMBIGUOUS") {
      const names = r.candidates.map((c) => c.customer_label);
      expect(names).toContain("Repo");
      expect(names).toContain("Files");
      expect(r.next_state).toBe("ASKING");
      expect(r.clarifying_question).toContain("Which one?");
    }
  });

  it("empty text returns NOT_FOUND without crashing", () => {
    const r = resolveIntent({ text: "" });
    expect(r.outcome).toBe("NOT_FOUND");
  });
});

describe("nex-guide · state machine (deterministic transitions)", () => {
  it("IDLE + customer_typed_intent → OBSERVING", () => {
    expect(advanceState("IDLE", { kind: "customer_typed_intent", text: "help" })).toBe("OBSERVING");
  });

  it("OBSERVING + target_illuminated → TARGET_FOUND", () => {
    expect(advanceState("OBSERVING", { kind: "target_illuminated" })).toBe("TARGET_FOUND");
  });

  it("TARGET_FOUND + target_illuminated → GUIDING", () => {
    expect(advanceState("TARGET_FOUND", { kind: "target_illuminated" })).toBe("GUIDING");
  });

  it("GUIDING + customer_reached_target → COMPLETE", () => {
    expect(advanceState("GUIDING", { kind: "customer_reached_target" })).toBe("COMPLETE");
  });

  it("GUIDING + customer_authorized_action → ACTION_AVAILABLE (Rule 6 gates the action itself, state machine only tracks readiness)", () => {
    expect(advanceState("GUIDING", { kind: "customer_authorized_action" })).toBe("ACTION_AVAILABLE");
  });

  it("any state + timeout_return_idle → IDLE", () => {
    for (const s of ["OBSERVING", "HELP_AVAILABLE", "ASKING", "TARGET_FOUND", "GUIDING", "ACTION_AVAILABLE", "COMPLETE"] as const) {
      expect(advanceState(s, { kind: "timeout_return_idle" })).toBe("IDLE");
    }
  });

  it("unknown event does not change state (deterministic · no fabrication)", () => {
    expect(advanceState("IDLE", { kind: "customer_authorized_action" })).toBe("IDLE");
  });
});

describe("nex-guide · full session receipt", () => {
  beforeEach(() => {
    _resetUiSemanticGraphForTests();
    seedWorkstationUiTargets();
  });

  it("session receipt records initial → final state coherently", () => {
    const r = runGuideSession({ customer_text: "how do I export?", scope: "workstation" });
    expect(r.initial_state).toBe("IDLE");
    expect(r.final_state).toBe("TARGET_FOUND");
    expect(r.resolution.outcome).toBe("RESOLVED");
    expect(r.zero_llm).toBe(true);
    expect(r.ledger).toBe("B");
  });

  it("session receipt for a NOT_FOUND intent returns to IDLE", () => {
    const r = runGuideSession({ customer_text: "flibbergibbet nowhere" });
    expect(r.final_state).toBe("IDLE");
    expect(r.resolution.outcome).toBe("NOT_FOUND");
  });

  it("session receipt for AMBIGUOUS intent ends in ASKING", () => {
    const r = runGuideSession({ customer_text: "where are my files" });
    expect(r.final_state).toBe("ASKING");
    expect(r.resolution.outcome).toBe("AMBIGUOUS");
  });
});
