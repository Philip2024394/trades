// src/lib/nex/agents/nex-legal/legal.test.ts
//
// WAVE-S-8 · Legal specialist contract tests
// Founder BEGIN WAVE-S-8 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyLegalRequest, detectLegalSafetySignals, respondLegal } from "./legal-gate";
import { LEGAL_CORPUS_V1, freezeLegalCorpus } from "./corpus";
import { evaluateLegalCorpus } from "./evaluator";

describe("§S8-CLASSIFY", () => {
  it("emergency · being arrested", () => expect(classifyLegalRequest("police have arrested me and are about to interview me")).toBe("emergency_legal"));
  it("emergency · deportation", () => expect(classifyLegalRequest("I received a removal order and am about to be deported")).toBe("emergency_legal"));
  it("contract interpretation · force majeure", () => expect(classifyLegalRequest("what does a force majeure clause cover")).toBe("contract_interpretation"));
  it("family_law · child arrangements", () => expect(classifyLegalRequest("child arrangements orders in England")).toBe("family_law_query"));
  it("criminal_law · guilty plea", () => expect(classifyLegalRequest("criminal charge and guilty plea question")).toBe("criminal_law_query"));
  it("immigration · ILR", () => expect(classifyLegalRequest("indefinite leave to remain requirements in the UK")).toBe("immigration_query"));
  it("employment · unfair dismissal", () => expect(classifyLegalRequest("unfair dismissal employment tribunal")).toBe("employment_law_query"));
  it("consumer · faulty goods", () => expect(classifyLegalRequest("washing machine not fit for purpose refund")).toBe("consumer_law_query"));
  it("intellectual property · trademark", () => expect(classifyLegalRequest("how do I file a trademark for my brand?")).toBe("intellectual_property_query"));
  it("legal procedure · statute of limitations", () => expect(classifyLegalRequest("statute of limitations personal injury")).toBe("legal_procedure_query"));
  it("rights query", () => expect(classifyLegalRequest("do I have the right to remain silent")).toBe("rights_query"));
  it("unknown · guaranteed-win case", () => expect(classifyLegalRequest("am I guaranteed to win with damages of £50,000")).toBe("unknown"));
});

describe("§S8-SAFETY", () => {
  it("emergency routes with 999 for UK", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "police have arrested me", jurisdiction: "UK" }, "emergency_legal");
    const em = sigs.find((s) => s.kind === "emergency_route");
    expect(em).toBeDefined();
    if (em && em.kind === "emergency_route") expect(em.regime_hint).toContain("999");
  });

  it("emergency routes with 911 + public defender for US", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "about to be deported", jurisdiction: "US" }, "emergency_legal");
    const em = sigs.find((s) => s.kind === "emergency_route");
    expect(em).toBeDefined();
    if (em && em.kind === "emergency_route") {
      expect(em.regime_hint).toContain("911");
      expect(em.regime_hint).toContain("public defender");
    }
  });

  it("legal advice boundary fires on any recognised legal kind", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "child arrangements orders" }, "family_law_query");
    expect(sigs.some((s) => s.kind === "legal_advice_boundary")).toBe(true);
  });

  it("bar admission required fires on any recognised legal kind", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "trademark filing" }, "intellectual_property_query");
    expect(sigs.some((s) => s.kind === "bar_admission_licensing_required")).toBe(true);
  });

  it("criminal law boundary fires on criminal query", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "criminal charge and guilty plea" }, "criminal_law_query");
    expect(sigs.some((s) => s.kind === "criminal_law_boundary")).toBe(true);
  });

  it("family law boundary fires on family query", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "child arrangements orders" }, "family_law_query");
    expect(sigs.some((s) => s.kind === "family_law_boundary")).toBe(true);
  });

  it("statute of limitations awareness on procedure query", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "statute of limitations personal injury" }, "legal_procedure_query");
    expect(sigs.some((s) => s.kind === "statute_of_limitations_awareness")).toBe(true);
  });

  it("privileged communication risk on privilege topic", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "attorney-client privilege waived?" }, "unknown");
    expect(sigs.some((s) => s.kind === "privileged_communication_risk")).toBe(true);
  });

  it("guaranteed-win language triggers unsupported case outcome claim", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "am I guaranteed to win with damages of £50,000?" }, "unknown");
    expect(sigs.some((s) => s.kind === "unsupported_case_outcome_claim")).toBe(true);
  });

  it("empty text has no safety concern", () => {
    const sigs = detectLegalSafetySignals({ request_id: "x", request_text: "" }, "unknown");
    expect(sigs.every((s) => s.kind === "no_legal_safety_concern")).toBe(true);
  });
});

describe("§S8-RESPOND · strict discipline", () => {
  it("emergency advisory contains emergency number + solicitor referral", () => {
    const r = respondLegal({ request_id: "x", request_text: "police have arrested me", jurisdiction: "UK" });
    expect(r.advisory_text).toContain("999");
    expect(r.advisory_text.toLowerCase()).toContain("duty solicitor");
  });

  it("advisory never gives legal advice ('I advise you to' / 'you should sue')", () => {
    const r = respondLegal({ request_id: "x", request_text: "child arrangements orders" });
    expect(r.advisory_text).not.toMatch(/\bI advise you to\b/i);
    expect(r.advisory_text).not.toMatch(/\byou should sue\b/i);
    expect(r.advisory_text).not.toMatch(/\byou must sue\b/i);
  });

  it("advisory never guarantees case outcome", () => {
    const r = respondLegal({ request_id: "x", request_text: "am I guaranteed to win?" });
    expect(r.advisory_text).not.toMatch(/\byou will win\b/i);
    expect(r.advisory_text).not.toMatch(/\bcourt will side with you\b/i);
  });

  it("advisory never fabricates specific damages figure", () => {
    const r = respondLegal({ request_id: "x", request_text: "am I guaranteed damages of £50,000?" });
    expect(r.advisory_text).not.toMatch(/\bexactly £\d+ in damages\b/i);
    expect(r.advisory_text).not.toMatch(/\bguaranteed £\d+ payout\b/i);
  });

  it("every legal kind requires human review", () => {
    const r1 = respondLegal({ request_id: "x", request_text: "trademark filing" });
    const r2 = respondLegal({ request_id: "x", request_text: "unfair dismissal" });
    expect(r1.requires_human_review).toBe(true);
    expect(r2.requires_human_review).toBe(true);
  });
});

describe("§S8-CORPUS", () => {
  it("corpus is frozen + hash stable across re-invocations", () => {
    const a = freezeLegalCorpus();
    const b = freezeLegalCorpus();
    expect(a.content_hash).toBe(b.content_hash);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("corpus V1 has 12 cases", () => {
    expect(LEGAL_CORPUS_V1.cases.length).toBe(12);
  });

  it("corpus V1 evaluates 100% pass under deterministic gate", () => {
    const run = evaluateLegalCorpus(LEGAL_CORPUS_V1);
    if (run.failed > 0) {
      const failedCases = run.results.filter((r) => !r.passed).map((r) => ({
        case_id: r.case_id,
        failed_checks: r.checks.filter((c) => !c.ok).map((c) => `${c.check}(${c.detail ?? "n/a"})`),
      }));
      console.error("FAILED CASES:", JSON.stringify(failedCases, null, 2));
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(LEGAL_CORPUS_V1.cases.length);
  });
});
