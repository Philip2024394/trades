// src/lib/nex/marketing/deliverability/__tests__/suppression-preflight.test.ts
//
// NEX Deliverability · Suppression Preflight acceptance
// Founder-authorised programme · Session-14 · Part 11h · 2026-09-22.

import { describe, it, expect } from "vitest";
import {
  computeSuppressionProjection, SUPPRESSION_REASONS,
  _PREFLIGHT_NEVER_RETURNS_EMAILS,
  _PREFLIGHT_NEVER_UNSUPPRESSES,
  _PREFLIGHT_DETERMINISTIC_PRECEDENCE,
  _PREFLIGHT_HARD_BOUNCE_HIGHEST_PRECEDENCE,
  type SuppressionInputRow,
} from "..";

// Helper: build a base row with all suppression flags off
function row(overrides: Partial<SuppressionInputRow> = {}): SuppressionInputRow {
  return {
    contact_id: overrides.contact_id ?? `c-${Math.random().toString(36).slice(2, 8)}`,
    has_valid_email: true,
    hard_bounced: false,
    opt_out: false,
    complaint_count: 0,
    sender_reputation_state: null,
    domain_dmarc_reject_unaligned: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · Basic counts
// ═══════════════════════════════════════════════════════════════════
describe("Suppression preflight · (A) basic counts", () => {
  it("(A1) all-clean audience → 100% sendable", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ contact_id: `c-${i}` }));
    const p = computeSuppressionProjection(rows);
    expect(p.total_proposed).toBe(10);
    expect(p.sendable).toBe(10);
    expect(p.total_suppressed).toBe(0);
    expect(p.sendable_percentage).toBe(1);
  });
  it("(A2) empty audience → sendable_percentage=null · note", () => {
    const p = computeSuppressionProjection([]);
    expect(p.total_proposed).toBe(0);
    expect(p.sendable).toBe(0);
    expect(p.sendable_percentage).toBeNull();
    expect(p.note).toContain("empty_audience");
  });
  it("(A3) mixed audience · counts add up to total_proposed", () => {
    const rows = [
      row({ hard_bounced: true }),
      row({ opt_out: true }),
      row({ complaint_count: 3 }),
      row(), row(), row(),
    ];
    const p = computeSuppressionProjection(rows);
    expect(p.total_proposed).toBe(6);
    expect(p.sendable).toBe(3);
    expect(p.total_suppressed).toBe(3);
  });
  it("(A4) note reports sendable count clearly", () => {
    const p = computeSuppressionProjection([row(), row({ hard_bounced: true })]);
    expect(p.note).toContain("1 of 2");
    expect(p.note).toContain("50.00%");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Individual suppression reasons
// ═══════════════════════════════════════════════════════════════════
describe("Suppression preflight · (B) individual reasons", () => {
  it("(B1) hard_bounced counted", () => {
    const p = computeSuppressionProjection([row({ hard_bounced: true })]);
    expect(p.suppressed_by_reason.hard_bounced).toBe(1);
    expect(p.sendable).toBe(0);
  });
  it("(B2) on_opt_out_list counted", () => {
    const p = computeSuppressionProjection([row({ opt_out: true })]);
    expect(p.suppressed_by_reason.on_opt_out_list).toBe(1);
  });
  it("(B3) recent_complaint counted (any complaint_count ≥1)", () => {
    const p = computeSuppressionProjection([row({ complaint_count: 1 })]);
    expect(p.suppressed_by_reason.recent_complaint).toBe(1);
  });
  it("(B4) sender_frozen counted", () => {
    const p = computeSuppressionProjection([row({ sender_reputation_state: "frozen" })]);
    expect(p.suppressed_by_reason.sender_frozen).toBe(1);
  });
  it("(B5) sender_limited counted", () => {
    const p = computeSuppressionProjection([row({ sender_reputation_state: "limited" })]);
    expect(p.suppressed_by_reason.sender_limited).toBe(1);
  });
  it("(B6) sender_watch/warning/healthy do NOT suppress · counted as sendable", () => {
    const p = computeSuppressionProjection([
      row({ sender_reputation_state: "healthy" }),
      row({ sender_reputation_state: "watch" }),
      row({ sender_reputation_state: "warning" }),
      row({ sender_reputation_state: "unknown" }),
    ]);
    expect(p.sendable).toBe(4);
  });
  it("(B7) domain_dmarc_reject_unaligned counted", () => {
    const p = computeSuppressionProjection([row({ domain_dmarc_reject_unaligned: true })]);
    expect(p.suppressed_by_reason.domain_dmarc_reject_unaligned).toBe(1);
  });
  it("(B8) no_email counted · has_valid_email=false", () => {
    const p = computeSuppressionProjection([row({ has_valid_email: false })]);
    expect(p.suppressed_by_reason.no_email).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Precedence (multi-reason overlap)
// ═══════════════════════════════════════════════════════════════════
describe("Suppression preflight · (C) precedence · most-restrictive-first", () => {
  it("(C1) no_email precedes ALL other reasons", () => {
    const p = computeSuppressionProjection([row({
      has_valid_email: false, hard_bounced: true, opt_out: true, complaint_count: 5,
    })]);
    expect(p.suppressed_by_reason.no_email).toBe(1);
    expect(p.suppressed_by_reason.hard_bounced).toBe(0);
    expect(p.suppressed_by_reason.on_opt_out_list).toBe(0);
    expect(p.overlap_count).toBe(1);
  });
  it("(C2) hard_bounced precedes opt_out + complaint + sender + domain", () => {
    const p = computeSuppressionProjection([row({
      hard_bounced: true, opt_out: true, complaint_count: 2,
      sender_reputation_state: "frozen", domain_dmarc_reject_unaligned: true,
    })]);
    expect(p.suppressed_by_reason.hard_bounced).toBe(1);
    expect(p.suppressed_by_reason.on_opt_out_list).toBe(0);
    expect(p.overlap_count).toBe(1);
  });
  it("(C3) opt_out precedes complaint + sender + domain", () => {
    const p = computeSuppressionProjection([row({
      opt_out: true, complaint_count: 3, sender_reputation_state: "frozen",
    })]);
    expect(p.suppressed_by_reason.on_opt_out_list).toBe(1);
    expect(p.suppressed_by_reason.recent_complaint).toBe(0);
    expect(p.suppressed_by_reason.sender_frozen).toBe(0);
  });
  it("(C4) complaint precedes sender + domain", () => {
    const p = computeSuppressionProjection([row({
      complaint_count: 1, sender_reputation_state: "limited",
    })]);
    expect(p.suppressed_by_reason.recent_complaint).toBe(1);
    expect(p.suppressed_by_reason.sender_limited).toBe(0);
  });
  it("(C5) precedence_order exported exactly as expected · first entry is highest", () => {
    const p = computeSuppressionProjection([]);
    expect(p.precedence_order[0]).toBe("hard_bounced");
    expect(p.precedence_order[1]).toBe("on_opt_out_list");
    expect(p.precedence_order[p.precedence_order.length - 1]).toBe("no_email");
  });
  it("(C6) overlap_count counts rows with ≥2 matching reasons only", () => {
    const p = computeSuppressionProjection([
      row({ hard_bounced: true }),                          // 1 reason
      row({ hard_bounced: true, opt_out: true }),           // 2 reasons
      row({ opt_out: true, complaint_count: 5, sender_reputation_state: "frozen" }), // 3 reasons
      row({ complaint_count: 0 }),                          // 0 reasons (sendable)
    ]);
    expect(p.overlap_count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Suppression preflight · (D) governance canaries", () => {
  it("(D1) boundary markers exported", () => {
    expect(_PREFLIGHT_NEVER_RETURNS_EMAILS).toContain("opaque_contact_ids");
    expect(_PREFLIGHT_NEVER_UNSUPPRESSES).toContain("no_bypass");
    expect(_PREFLIGHT_DETERMINISTIC_PRECEDENCE).toContain("first_matching_reason_wins");
    expect(_PREFLIGHT_HARD_BOUNCE_HIGHEST_PRECEDENCE).toContain("never_overridden");
  });
  it("(D2) module exports NO unsuppress/override/bypass/clear function", async () => {
    const mod: any = await import("..");
    expect(mod.unsuppressContact).toBeUndefined();
    expect(mod.overridePreflightProjection).toBeUndefined();
    expect(mod.bypassSuppression).toBeUndefined();
    expect(mod.forceSendable).toBeUndefined();
    expect(mod.clearSuppression).toBeUndefined();
    expect(mod.projectPreflight).toBeUndefined(); // typo of computeSuppressionProjection · none such
  });
  it("(D3) projection body contains ZERO @ characters (no email leakage)", () => {
    const rows = [
      row({ contact_id: "c-1", hard_bounced: true }),
      row({ contact_id: "c-2", opt_out: true }),
      row({ contact_id: "c-3" }),
    ];
    const p = computeSuppressionProjection(rows);
    const body = JSON.stringify(p);
    expect(body).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+/i);
  });
  it("(D4) same input → identical projection (deterministic)", () => {
    const rows = [
      row({ contact_id: "c-1", hard_bounced: true }),
      row({ contact_id: "c-2", opt_out: true }),
      row({ contact_id: "c-3" }),
    ];
    const p1 = computeSuppressionProjection(rows);
    const p2 = computeSuppressionProjection(rows);
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
  });
  it("(D5) module source contains no fetch/http/DB reference", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/suppression-preflight.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/\bpool\.query\b/);
    expect(code).not.toMatch(/\bclient\.query\b/);
  });
  it("(D6) SUPPRESSION_REASONS is a readonly tuple of exactly 7 canonical reasons", () => {
    expect(SUPPRESSION_REASONS).toHaveLength(7);
    expect(SUPPRESSION_REASONS[0]).toBe("hard_bounced");
    expect(SUPPRESSION_REASONS).toContain("no_email");
  });
});
