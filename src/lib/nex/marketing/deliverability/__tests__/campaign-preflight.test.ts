// src/lib/nex/marketing/deliverability/__tests__/campaign-preflight.test.ts
//
// NEX Deliverability · Campaign Preflight Composer acceptance
// Founder-authorised programme · Session-15 · Part 11i · 2026-09-22.

import { describe, it, expect } from "vitest";
import {
  composeCampaignPreflight,
  _COMPOSER_NEVER_SENDS, _COMPOSER_NEVER_PERSISTS,
  _COMPOSER_FAIL_FAST_ON_REPUTATION_HOLD,
  _COMPOSER_NO_EMAIL_ADDRESSES_IN_OUTPUT,
  type SuppressionInputRow, type VariantDefinition, type CampaignPreflightInput,
} from "..";

const VARIANTS: VariantDefinition[] = [
  { variant_id: "A", weight: 1 },
  { variant_id: "B", weight: 1 },
];

function makeRows(n: number, transform: (i: number, r: SuppressionInputRow) => SuppressionInputRow = (_, r) => r): SuppressionInputRow[] {
  return Array.from({ length: n }, (_, i) => transform(i, {
    contact_id: `c-${i}`,
    has_valid_email: true, hard_bounced: false, opt_out: false,
    complaint_count: 0, sender_reputation_state: null,
    domain_dmarc_reject_unaligned: false,
  }));
}

function baseInput(overrides: Partial<CampaignPreflightInput> = {}): CampaignPreflightInput {
  return {
    campaign_id: "cmp-1",
    audience_rows: makeRows(100),
    variants: VARIANTS,
    sender_id: "sender-1",
    sender_reputation_state: "healthy",
    per_hour_cap: 100,
    window_hours: 4,
    start_at: "2026-09-22T09:00:00.000Z",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · Happy path composition
// ═══════════════════════════════════════════════════════════════════
describe("Campaign preflight · (A) happy path composition", () => {
  it("(A1) 100 clean contacts + healthy sender · projects successfully", () => {
    const o = composeCampaignPreflight(baseInput());
    expect(o.kind).toBe("projected");
    if (o.kind === "projected") {
      expect(o.suppression.sendable).toBe(100);
      expect(o.per_variant).toHaveLength(2);
      expect(o.overall_scheduled).toBeGreaterThan(0);
    }
  });
  it("(A2) per-variant weights honoured within tolerance", () => {
    const o = composeCampaignPreflight(baseInput({ audience_rows: makeRows(1000) }));
    if (o.kind === "projected") {
      const a = o.per_variant.find(v => v.variant_id === "A")!;
      const b = o.per_variant.find(v => v.variant_id === "B")!;
      // 50/50 weight · expect ~500 each ±10%
      expect(Math.abs(a.assigned_count - 500)).toBeLessThan(100);
      expect(Math.abs(b.assigned_count - 500)).toBeLessThan(100);
    }
  });
  it("(A3) note includes overall_scheduled and window_hours", () => {
    const o = composeCampaignPreflight(baseInput());
    if (o.kind === "projected") {
      expect(o.note).toContain("of 100 sendable contacts");
      expect(o.note).toContain("2 variants");
      expect(o.note).toMatch(/4h window/);
    }
  });
  it("(A4) overall_slots equals sum of per-variant slots_count", () => {
    const o = composeCampaignPreflight(baseInput());
    if (o.kind === "projected") {
      const sum = o.per_variant.reduce((a, v) => a + v.slots_count, 0);
      expect(o.overall_slots).toBe(sum);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Reputation short-circuit
// ═══════════════════════════════════════════════════════════════════
describe("Campaign preflight · (B) reputation short-circuit", () => {
  it("(B1) sender frozen → reputation_hold · BEFORE variant assignment", () => {
    const o = composeCampaignPreflight(baseInput({ sender_reputation_state: "frozen" }));
    expect(o.kind).toBe("reputation_hold");
    if (o.kind === "reputation_hold") {
      expect(o.reputation_state).toBe("frozen");
      // suppression projection still computed · but no per_variant field
      expect((o as any).per_variant).toBeUndefined();
    }
  });
  it("(B2) sender limited → reputation_hold", () => {
    const o = composeCampaignPreflight(baseInput({ sender_reputation_state: "limited" }));
    expect(o.kind).toBe("reputation_hold");
  });
  it("(B3) healthy/watch/warning/unknown proceed to projection", () => {
    for (const state of ["healthy", "watch", "warning", "unknown"] as const) {
      const o = composeCampaignPreflight(baseInput({ sender_reputation_state: state }));
      expect(o.kind).toBe("projected");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Edge cases
// ═══════════════════════════════════════════════════════════════════
describe("Campaign preflight · (C) edge cases", () => {
  it("(C1) empty audience → empty_audience", () => {
    const o = composeCampaignPreflight(baseInput({ audience_rows: [] }));
    expect(o.kind).toBe("empty_audience");
  });
  it("(C2) all-suppressed audience → all_suppressed", () => {
    const rows = makeRows(50, (_, r) => ({ ...r, hard_bounced: true }));
    const o = composeCampaignPreflight(baseInput({ audience_rows: rows }));
    expect(o.kind).toBe("all_suppressed");
  });
  it("(C3) missing campaign_id → invalid_input", () => {
    const o = composeCampaignPreflight(baseInput({ campaign_id: "" }));
    expect(o.kind).toBe("invalid_input");
  });
  it("(C4) empty variants → invalid_input", () => {
    const o = composeCampaignPreflight(baseInput({ variants: [] }));
    expect(o.kind).toBe("invalid_input");
  });
  it("(C5) partially-suppressed audience · sendable count in suppression matches variant total", () => {
    const rows = makeRows(100, (i, r) => i < 30 ? { ...r, hard_bounced: true } : r);
    const o = composeCampaignPreflight(baseInput({ audience_rows: rows }));
    if (o.kind === "projected") {
      expect(o.suppression.sendable).toBe(70);
      const total_assigned = o.per_variant.reduce((a, v) => a + v.assigned_count, 0);
      expect(total_assigned).toBe(70);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Multi-variant weighting
// ═══════════════════════════════════════════════════════════════════
describe("Campaign preflight · (D) variant weighting", () => {
  it("(D1) 3:1 weight split ~75/25", () => {
    const V = [{ variant_id: "control", weight: 3 }, { variant_id: "test", weight: 1 }];
    const o = composeCampaignPreflight(baseInput({ audience_rows: makeRows(1000), variants: V }));
    if (o.kind === "projected") {
      const control = o.per_variant.find(v => v.variant_id === "control")!;
      expect(Math.abs(control.assigned_count - 750)).toBeLessThan(100);
    }
  });
  it("(D2) three-way variant (A/B/C) · each variant gets a schedule", () => {
    const V = [
      { variant_id: "A", weight: 1 },
      { variant_id: "B", weight: 1 },
      { variant_id: "C", weight: 1 },
    ];
    const o = composeCampaignPreflight(baseInput({ audience_rows: makeRows(900), variants: V }));
    if (o.kind === "projected") {
      expect(o.per_variant).toHaveLength(3);
      for (const v of o.per_variant) {
        expect(v.assigned_count).toBeGreaterThan(0);
      }
    }
  });
  it("(D3) per-variant hourly cap is proportional to weight", () => {
    const V = [{ variant_id: "big", weight: 3 }, { variant_id: "small", weight: 1 }];
    const o = composeCampaignPreflight(baseInput({ audience_rows: makeRows(400), variants: V, per_hour_cap: 40 }));
    if (o.kind === "projected") {
      const big = o.per_variant.find(v => v.variant_id === "big")!;
      const small = o.per_variant.find(v => v.variant_id === "small")!;
      // big gets floor(40 * 3/4) = 30/hr, small floor(40 * 1/4) = 10/hr · big scheduled more
      expect(big.total_scheduled).toBeGreaterThan(small.total_scheduled);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Campaign preflight · (E) governance canaries", () => {
  it("(E1) boundary markers exported", () => {
    expect(_COMPOSER_NEVER_SENDS).toContain("never_transmits");
    expect(_COMPOSER_NEVER_PERSISTS).toContain("no_DB_writes");
    expect(_COMPOSER_FAIL_FAST_ON_REPUTATION_HOLD).toContain("short_circuit_before");
    expect(_COMPOSER_NO_EMAIL_ADDRESSES_IN_OUTPUT).toContain("opaque_contact_ids");
  });
  it("(E2) module exports NO send/persist/trigger function", async () => {
    const mod: any = await import("..");
    expect(mod.executeCampaign).toBeUndefined();
    expect(mod.persistCampaignPreflight).toBeUndefined();
    expect(mod.triggerCampaign).toBeUndefined();
    expect(mod.dispatchCampaignSlots).toBeUndefined();
    expect(mod.forceCampaignSend).toBeUndefined();
    expect(mod.commitPreflightAsCampaign).toBeUndefined();
  });
  it("(E3) projected output body contains NO @-shaped email patterns", () => {
    const rows = makeRows(50, (i, r) => ({ ...r, contact_id: `contact-${i}-uuid` }));
    const o = composeCampaignPreflight(baseInput({ audience_rows: rows }));
    const body = JSON.stringify(o);
    expect(body).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+/i);
  });
  it("(E4) reputation_hold does not perform variant assignment · never leaks contact IDs to variants", () => {
    const o = composeCampaignPreflight(baseInput({ sender_reputation_state: "frozen" }));
    if (o.kind === "reputation_hold") {
      // Verify the reputation_hold outcome has NO per_variant assignments at all
      expect((o as any).per_variant).toBeUndefined();
    }
  });
  it("(E5) module source contains no fetch/http/DB reference", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/campaign-preflight.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/\bpool\.query\b/);
    expect(code).not.toMatch(/\bclient\.query\b/);
  });
});
