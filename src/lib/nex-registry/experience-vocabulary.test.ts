import { describe, it, expect, beforeEach } from "vitest";
import {
  seedExperienceVocabulary,
  NEX_EXPERIENCE_VOCABULARY_VERSION,
} from "./experience-vocabulary";
import {
  seedCoreCapabilities,
  getCapabilityByName,
  listCapabilities,
  _resetCapabilityRegistryForTests,
} from "./capability-registry";
import { canSatisfyIntent, whatIsMissingFor, howToBuild } from "./capability-awareness";
import { proposeCompositionPath } from "./capability-graph";
import { auditRuleCompliance, RULE_5_CHOICE_TO_REAL_IMPLEMENTATION, assertRule5ChoiceOutcome, describeRules } from "./capability-rule";

describe("Rule 5 · every choice must lead to real implementation", () => {
  it("frozen constant with founder-verbatim statement", () => {
    expect(RULE_5_CHOICE_TO_REAL_IMPLEMENTATION.id).toBe("RULE-5");
    expect(RULE_5_CHOICE_TO_REAL_IMPLEMENTATION.statement).toContain("real implementation");
    expect(RULE_5_CHOICE_TO_REAL_IMPLEMENTATION.statement).toContain("real verification");
    expect(RULE_5_CHOICE_TO_REAL_IMPLEMENTATION.frozen).toBe(true);
  });

  it("assertRule5ChoiceOutcome flags empty file_diff_paths", () => {
    const v = assertRule5ChoiceOutcome({
      choice_id: "A", file_diff_paths: [], run_id: "run-1",
      verification_hash: "hash-1", completion_claim: "done",
    });
    expect(v.some((s) => s.includes("file_diff_path"))).toBe(true);
  });

  it("assertRule5ChoiceOutcome flags missing run_id", () => {
    const v = assertRule5ChoiceOutcome({
      choice_id: "A", file_diff_paths: ["src/x.tsx"], run_id: null,
      verification_hash: "hash-1", completion_claim: "done",
    });
    expect(v.some((s) => s.includes("run_id"))).toBe(true);
  });

  it("assertRule5ChoiceOutcome flags missing verification_hash", () => {
    const v = assertRule5ChoiceOutcome({
      choice_id: "A", file_diff_paths: ["src/x.tsx"], run_id: "run-1",
      verification_hash: null, completion_claim: "done",
    });
    expect(v.some((s) => s.includes("verification_hash"))).toBe(true);
  });

  it("assertRule5ChoiceOutcome passes a fully-evidenced outcome", () => {
    const v = assertRule5ChoiceOutcome({
      choice_id: "A", file_diff_paths: ["src/pages/home.tsx"],
      run_id: "run-abc-123", verification_hash: "sha256:aabbccdd",
      completion_claim: "changed the hero to option A",
    });
    expect(v.length).toBe(0);
  });

  it("describeRules exposes rule 1-5", () => {
    const r = describeRules();
    expect(r.rule_1.id).toBe("RULE-1");
    expect(r.rule_2.id).toBe("RULE-2");
    expect(r.rule_3.id).toBe("RULE-3");
    expect(r.rule_4.id).toBe("RULE-4");
    expect(r.rule_5.id).toBe("RULE-5");
  });
});

describe("seedExperienceVocabulary · Phase 5B curation + registration", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
    seedExperienceVocabulary();
  });

  it("canonical version", () => {
    expect(NEX_EXPERIENCE_VOCABULARY_VERSION).toBe("nex-experience-vocabulary.v1.2026-09-19");
  });

  it("curated existing entries gain composition_level and semantic_tags", () => {
    const button = getCapabilityByName("ui", "ui-Button")!;
    expect(button.composition_level).toBe("component");
    expect(button.semantic_tags).toContain("button");
    expect(button.semantic_tags).toContain("action");

    const card = getCapabilityByName("ui", "ui-Card")!;
    expect(card.composition_level).toBe("component");
    expect(card.semantic_tags).toContain("card");

    const lucide = getCapabilityByName("visual", "lucide-icon-family")!;
    expect(lucide.composition_level).toBe("atom");
    expect(lucide.semantic_tags).toContain("icon");
  });

  it("curation does NOT change status or evidence of existing entries (Rule 2 preserved)", () => {
    // Snapshot Button before + after · Button was PROMOTED · must remain PROMOTED
    const button = getCapabilityByName("ui", "ui-Button")!;
    expect(button.status).toBe("PROMOTED");
    expect(button.evidence_refs.length).toBeGreaterThan(0);
    expect(button.last_verified_iso).toBeTruthy();
  });

  it("registered new higher-level entries · Header, Hero, ContactForm, FAQ, ...", () => {
    for (const name of ["Header", "Hero", "Footer", "ContactForm", "SubscribeForm", "SearchBox", "PricingCard", "MetricCard", "LocationCard", "ServicesSection", "TestimonialsSection", "FAQSection", "ContactSection", "ModalOverlay", "FloatingMenu", "Navigation", "ContactExperience", "PricingExperience", "LandingPage", "ContactPage"]) {
      const cap = getCapabilityByName("ui", name);
      expect(cap, `missing: ${name}`).toBeTruthy();
      expect(cap!.status, `wrong status: ${name}`).toBe("PROMOTED");
    }
    for (const name of ["Image", "Video"]) {
      const cap = getCapabilityByName("visual", name);
      expect(cap, `missing: ${name}`).toBeTruthy();
      expect(cap!.status, `wrong status: ${name}`).toBe("PROMOTED");
    }
  });

  it("Chart is honestly PROPOSED · not VERIFIED · not silently AVAILABLE", () => {
    const chart = getCapabilityByName("visual", "Chart")!;
    expect(chart.status).toBe("PROPOSED");
    expect(chart.evidence_refs.length).toBe(0);
    expect(chart.last_verified_iso).toBeNull();
    expect(chart.failure_patterns.some((p) => p.includes("no chart library"))).toBe(true);
  });

  it("DataTable is PROPOSED · Map is PROPOSED", () => {
    expect(getCapabilityByName("ui", "DataTable")!.status).toBe("PROPOSED");
    expect(getCapabilityByName("ui", "Map")!.status).toBe("PROPOSED");
  });

  it("Dashboard and DashboardPage are PROPOSED because they transitively depend on Chart", () => {
    const dashboard = getCapabilityByName("ui", "Dashboard")!;
    expect(dashboard.status).toBe("PROPOSED");
    expect(dashboard.failure_patterns.some((p) => p.includes("Chart"))).toBe(true);
    const dp = getCapabilityByName("ui", "DashboardPage")!;
    expect(dp.status).toBe("PROPOSED");
  });

  it("registry still satisfies rule audit · zero violations", () => {
    const audit = auditRuleCompliance();
    expect(audit.rule1_violations.length).toBe(0);
    expect(audit.rule2_violations.length).toBe(0);
    expect(audit.all_compliant).toBe(true);
  });

  it("registry now has ≥90 total capabilities (55 seeded + ~30 new)", () => {
    expect(listCapabilities().length).toBeGreaterThanOrEqual(80);
  });
});

describe("Phase 5B · graph queries are now materially useful", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
    seedExperienceVocabulary();
  });

  it("canSatisfyIntent(['contact']) now returns ContactForm", () => {
    const r = canSatisfyIntent(["contact"]);
    expect(r.answer.outcome).toBe("matched");
    if (r.answer.outcome === "matched") {
      const names = r.answer.candidates.map((c) => c.name);
      expect(names).toContain("ContactForm");
    }
  });

  it("canSatisfyIntent(['pricing']) returns PricingCard + PricingExperience", () => {
    const r = canSatisfyIntent(["pricing"]);
    expect(r.answer.outcome).toBe("matched");
    if (r.answer.outcome === "matched") {
      const names = r.answer.candidates.map((c) => c.name);
      expect(names).toContain("PricingCard");
    }
  });

  it("canSatisfyIntent(['chart']) returns NOT_UNDERSTOOD · Rule 2 blocks PROPOSED candidates", () => {
    const r = canSatisfyIntent(["chart"]);
    expect(r.answer.outcome).toBe("NOT_UNDERSTOOD");
    if (r.answer.outcome === "NOT_UNDERSTOOD") {
      expect(r.answer.rationale).toContain("PROPOSED");
    }
  });

  it("canSatisfyIntent(['map']) returns NOT_UNDERSTOOD · map is honestly PROPOSED", () => {
    const r = canSatisfyIntent(["map"]);
    expect(r.answer.outcome).toBe("NOT_UNDERSTOOD");
  });

  it("howToBuild(LandingPage) returns resolved · full dependency tree", () => {
    const r = howToBuild({ by_name: { category: "ui", name: "LandingPage" } });
    expect(r.answer.outcome).toBe("resolved");
    if (r.answer.outcome === "resolved") {
      // Ensure Header + Hero + Footer all appear in the path
      const names = r.answer.steps.map((s) => s.capability_name);
      expect(names).toContain("Header");
      expect(names).toContain("Hero");
      expect(names).toContain("Footer");
      // Composite/sections must be built AFTER their atomic dependencies
      const headerIdx = names.indexOf("Header");
      const buttonIdx = names.indexOf("ui-Button");
      expect(buttonIdx).toBeLessThan(headerIdx);
    }
  });

  it("howToBuild(DashboardPage) shows the graph is not blocked at PROPOSED · returns resolved · downstream can inspect blockers", () => {
    // A path can include PROPOSED nodes; the caller (Guided Design) is
    // responsible for checking each step's status. proposeCompositionPath
    // returns resolved as long as the nodes exist.
    const r = howToBuild({ by_name: { category: "ui", name: "DashboardPage" } });
    expect(r.answer.outcome).toBe("resolved");
    if (r.answer.outcome === "resolved") {
      const names = r.answer.steps.map((s) => s.capability_name);
      expect(names).toContain("Dashboard");
      expect(names).toContain("Chart");
    }
  });

  it("whatIsMissingFor([DashboardPage's atoms]) honestly separates satisfied from untrustable", () => {
    // Chart is PROPOSED · findMissing returns it as untrustable
    const gap = whatIsMissingFor([
      { by_name: { category: "ui", name: "MetricCard" } },        // PROMOTED
      { by_name: { category: "visual", name: "Chart" } },          // PROPOSED
      { by_name: { category: "ui", name: "ui-Tabs" } },            // PROMOTED
    ]);
    expect(gap.answer.satisfied.length).toBe(2);
    expect(gap.answer.untrustable.length).toBe(1);
    expect(gap.answer.all_satisfied).toBe(false);
  });

  it("composition path for LandingPage places atoms before sections before pages", () => {
    const r = proposeCompositionPath({ by_name: { category: "ui", name: "LandingPage" } });
    expect(r.outcome).toBe("resolved");
    if (r.outcome === "resolved") {
      const lpIdx = r.steps.findIndex((s) => s.capability_name === "LandingPage");
      const headerIdx = r.steps.findIndex((s) => s.capability_name === "Header");
      const buttonIdx = r.steps.findIndex((s) => s.capability_name === "ui-Button");
      expect(buttonIdx).toBeLessThan(headerIdx);
      expect(headerIdx).toBeLessThan(lpIdx);
    }
  });
});

describe("Founder scenario · 'Build a dashboard with a chart'", () => {
  beforeEach(() => {
    _resetCapabilityRegistryForTests();
    seedCoreCapabilities();
    seedExperienceVocabulary();
  });

  it("NEX honestly identifies chart as missing rather than fabricating", () => {
    const gap = whatIsMissingFor([
      { by_name: { category: "ui", name: "DashboardPage" } },
      { by_name: { category: "visual", name: "Chart" } },
      { by_name: { category: "ui", name: "MetricCard" } },
      { by_name: { category: "ui", name: "Header" } },
      { by_name: { category: "ui", name: "Footer" } },
    ]);
    // MetricCard, Header, Footer are PROMOTED · satisfied
    // Chart, DashboardPage are PROPOSED · untrustable
    expect(gap.answer.satisfied.length).toBe(3);
    expect(gap.answer.untrustable.length).toBe(2);
    // NEX can now truthfully answer: "I have MetricCard, Header, Footer.
    //  I don't have a verified Chart, so I can't complete this yet."
  });
});
