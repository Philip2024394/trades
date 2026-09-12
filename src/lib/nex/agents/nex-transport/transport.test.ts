// src/lib/nex/agents/nex-transport/transport.test.ts
//
// WAVE-S-7 · Transport / Logistics contract tests
// Founder BEGIN WAVE-S-7 · 2026-09-08

import { describe, it, expect } from "vitest";
import { classifyTransportRequest, detectTransportSafetySignals, respondTransport } from "./transport-gate";
import { TRANSPORT_CORPUS_V1, freezeTransportCorpus } from "./corpus";
import { evaluateTransportCorpus } from "./evaluator";

describe("§S7-CLASSIFY", () => {
  it("emergency · tanker leaking", () => expect(classifyTransportRequest("our tanker is leaking chemicals on the M25")).toBe("emergency_incident"));
  it("emergency · truck rolled over", () => expect(classifyTransportRequest("truck rolled over on I-90 driver is injured")).toBe("emergency_incident"));
  it("driver hours query", () => expect(classifyTransportRequest("tachograph rules for hours of service")).toBe("driver_hours_query"));
  it("hazmat query", () => expect(classifyTransportRequest("how do I transport ADR class 3 flammable liquid?")).toBe("hazmat_transport_query"));
  it("customs query", () => expect(classifyTransportRequest("what HS code for this shipment?")).toBe("customs_declaration_query"));
  it("vehicle maintenance", () => expect(classifyTransportRequest("MOT and DVSA walk-round check schedule")).toBe("vehicle_maintenance_query"));
  it("passenger transport", () => expect(classifyTransportRequest("child seat rules for school bus")).toBe("passenger_transport"));
  it("fleet management", () => expect(classifyTransportRequest("telematics improve driver score")).toBe("fleet_management"));
  it("freight pricing", () => expect(classifyTransportRequest("haulage rate per mile")).toBe("freight_pricing"));
  it("route planning", () => expect(classifyTransportRequest("multi-drop route optimisation")).toBe("route_planning"));
  it("cargo general", () => expect(classifyTransportRequest("FTL vs LTL palletised freight")).toBe("cargo_general"));
  it("unlicensed carrier query classifies as cargo_general (haulage IS cargo · safety detector fires unlicensed_carrier_boundary separately)", () => expect(classifyTransportRequest("commercial haulage without operator licence")).toBe("cargo_general"));
  it("unknown", () => expect(classifyTransportRequest("hi")).toBe("unknown"));
});

describe("§S7-SAFETY", () => {
  it("emergency routes with 999 for UK context", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "tanker leaking chemicals in England", jurisdiction: "UK" }, "emergency_incident");
    const em = sigs.find((s) => s.kind === "emergency_route");
    expect(em).toBeDefined();
    if (em && em.kind === "emergency_route") expect(em.regime_hint).toContain("999");
  });

  it("emergency routes with 911 for US context", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "truck rolled over driver injured", jurisdiction: "US" }, "emergency_incident");
    const em = sigs.find((s) => s.kind === "emergency_route");
    expect(em).toBeDefined();
    if (em && em.kind === "emergency_route") expect(em.regime_hint).toContain("911");
  });

  it("driver hours query triggers regulation flag", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "tachograph rest break question" }, "driver_hours_query");
    expect(sigs.some((s) => s.kind === "driver_hours_regulation_risk")).toBe(true);
  });

  it("unsafe driver-hours language triggers extra flag", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "I drove for 12 hours without a break can I keep going" }, "driver_hours_query");
    const flags = sigs.filter((s) => s.kind === "driver_hours_regulation_risk");
    expect(flags.length).toBeGreaterThanOrEqual(1);
  });

  it("hazmat mention triggers hazmat boundary", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "ADR class 3 flammable liquid transport" }, "hazmat_transport_query");
    expect(sigs.some((s) => s.kind === "hazmat_handling_boundary")).toBe(true);
  });

  it("roadworthiness risk on bald tyres", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "bald tyres but need to complete this run" }, "vehicle_maintenance_query");
    expect(sigs.some((s) => s.kind === "vehicle_roadworthiness_risk")).toBe(true);
  });

  it("customs mention triggers customs boundary", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "HS code for cross-border shipment" }, "customs_declaration_query");
    expect(sigs.some((s) => s.kind === "cross_border_customs_boundary")).toBe(true);
  });

  it("unlicensed carrier boundary fires", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "commercial haulage without operator licence" }, "unknown");
    expect(sigs.some((s) => s.kind === "unlicensed_carrier_boundary")).toBe(true);
  });

  it("passenger safety on child seat query", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "child seat rules for minibus" }, "passenger_transport");
    expect(sigs.some((s) => s.kind === "passenger_safety_risk")).toBe(true);
  });

  it("guaranteed £2.50 per mile triggers unsupported quote (via loose match)", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "guaranteed £2.50 per mile haulage rate for the whole year" }, "freight_pricing");
    expect(sigs.some((s) => s.kind === "unsupported_freight_quote")).toBe(true);
  });

  it("neutral route planning has no safety concern", () => {
    const sigs = detectTransportSafetySignals({ request_id: "x", request_text: "multi-drop route sheet template" }, "route_planning");
    expect(sigs.every((s) => s.kind === "no_transport_safety_concern")).toBe(true);
  });
});

describe("§S7-RESPOND · strict discipline", () => {
  it("emergency advisory contains route number", () => {
    const r = respondTransport({ request_id: "x", request_text: "tanker leaking chemicals", jurisdiction: "UK" });
    expect(r.advisory_text).toContain("999");
  });

  it("driver-hours advisory never encourages driving fatigued or falsifying tachograph", () => {
    const r = respondTransport({ request_id: "x", request_text: "I drove for 12 hours without a break can I keep going" });
    expect(r.advisory_text).not.toMatch(/\bjust keep driving\b/i);
    expect(r.advisory_text).not.toMatch(/\bfalsify (?:your |the )?tachograph\b/i);
    expect(r.advisory_text).not.toMatch(/\bskip the (?:break|rest)\b/i);
  });

  it("hazmat advisory never gives DIY handling advice", () => {
    const r = respondTransport({ request_id: "x", request_text: "transport ADR class 3 flammable" });
    expect(r.advisory_text).not.toMatch(/\bskip the dg training\b/i);
    expect(r.advisory_text).not.toMatch(/\bno need for adr\b/i);
  });

  it("freight-quote advisory never fabricates specific rate", () => {
    const r = respondTransport({ request_id: "x", request_text: "guaranteed £2.50 per mile" });
    expect(r.advisory_text).not.toMatch(/\bexactly \d+ per mile\b/i);
  });
});

describe("§S7-CORPUS", () => {
  it("corpus is frozen + hash stable across re-invocations", () => {
    const a = freezeTransportCorpus();
    const b = freezeTransportCorpus();
    expect(a.content_hash).toBe(b.content_hash);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("corpus V1 has 12 cases", () => {
    expect(TRANSPORT_CORPUS_V1.cases.length).toBe(12);
  });

  it("corpus V1 evaluates 100% pass under deterministic gate", () => {
    const run = evaluateTransportCorpus(TRANSPORT_CORPUS_V1);
    if (run.failed > 0) {
      const failedCases = run.results.filter((r) => !r.passed).map((r) => ({
        case_id: r.case_id,
        failed_checks: r.checks.filter((c) => !c.ok).map((c) => `${c.check}(${c.detail ?? "n/a"})`),
      }));
      console.error("FAILED CASES:", JSON.stringify(failedCases, null, 2));
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(TRANSPORT_CORPUS_V1.cases.length);
  });
});
