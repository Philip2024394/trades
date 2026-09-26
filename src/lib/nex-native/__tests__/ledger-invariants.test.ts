// src/lib/nex-native/__tests__/ledger-invariants.test.ts
//
// Contract tests for the ledger-service balanced-entry + reversal-safe
// invariants. Uses vi.mock on the Supabase admin client so no real DB
// is required · these are contract tests of the service's own promises.
//
// Doctrine:
//   · Honest Baseline · these tests prove the contract · they don't
//     substitute for the end-to-end Founder Test that hits real DB
//   · Founder 2026-09-24 · ledger writes go through controlled service
//     boundary · that boundary is what these tests exercise

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client BEFORE importing the service · vi.mock is hoisted
vi.mock("../supabase-admin", () => {
  const insert = vi.fn();
  const select = vi.fn();
  const single = vi.fn();
  const eq = vi.fn();
  const maybeSingle = vi.fn();
  const order = vi.fn();
  const chain: Record<string, unknown> = { insert, select, single, eq, maybeSingle, order };
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => ({ data: null, error: null }));
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => ({ data: null, error: null }));
  chain.order = vi.fn(() => ({ data: [], error: null }));
  return {
    nexSupabaseAdmin: { from: vi.fn(() => chain) },
    nexSupabaseProjectRef: () => "test-project",
  };
});

import { postEntry, reverseEntry } from "../ledger-service";
import { nexSupabaseAdmin } from "../supabase-admin";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ledger-service · balanced-entry invariant", () => {
  it("throws when a line has both debit and credit set", async () => {
    await expect(
      postEntry({
        description: "bad",
        lines: [
          { account: "a", debit_pence: 100, credit_pence: 50, currency: "GBP" },
          { account: "b", debit_pence: 0, credit_pence: 50, currency: "GBP" },
        ],
      })
    ).rejects.toThrow(/exactly one of debit\/credit/);
  });

  it("throws when a line has neither debit nor credit set", async () => {
    await expect(
      postEntry({
        description: "empty",
        lines: [{ account: "a", currency: "GBP" }],
      })
    ).rejects.toThrow(/exactly one of debit\/credit/);
  });

  it("throws when a line has a negative amount", async () => {
    await expect(
      postEntry({
        description: "negative",
        lines: [
          { account: "a", debit_pence: -100, credit_pence: 0, currency: "GBP" },
        ],
      })
    ).rejects.toThrow(/negative amount/);
  });

  it("throws when currency is not a 3-char ISO code", async () => {
    await expect(
      postEntry({
        description: "bad-currency",
        lines: [
          { account: "a", debit_pence: 100, currency: "GBP" },
          { account: "b", credit_pence: 100, currency: "gbp" }, // lowercase
        ],
      })
    ).rejects.toThrow(/3-char ISO-4217/);
  });

  it("throws when sum of debits does not equal sum of credits", async () => {
    await expect(
      postEntry({
        description: "unbalanced",
        lines: [
          { account: "a", debit_pence: 100, currency: "GBP" },
          { account: "b", credit_pence: 50, currency: "GBP" },
        ],
      })
    ).rejects.toThrow(/not balanced.*sum\(debits\)=100 sum\(credits\)=50/);
  });

  it("throws when total entry value is zero", async () => {
    await expect(
      postEntry({
        description: "zero",
        lines: [
          { account: "a", debit_pence: 0, credit_pence: 0, currency: "GBP" },
        ],
      })
    ).rejects.toThrow(/exactly one of debit\/credit/);
    // (Zero total is caught first by the per-line invariant above.)
  });

  it("throws when account is empty", async () => {
    await expect(
      postEntry({
        description: "no-account",
        lines: [{ account: "   ", debit_pence: 100, currency: "GBP" }],
      })
    ).rejects.toThrow(/empty account/);
  });
});

describe("ledger-service · reversal-safe invariant", () => {
  it("reverseEntry throws if the original entry is missing", async () => {
    // Configure the mock chain to return null for getEntryById
    const chain = (nexSupabaseAdmin as unknown as { from: () => Record<string, unknown> }).from();
    (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: null });
    await expect(reverseEntry("missing-uuid", "test reversal")).rejects.toThrow(
      /entry missing-uuid not found/
    );
  });

  // NOTE: Full end-to-end reversal round-trip test (post → reverse → verify
  // opposite lines) requires a real DB round-trip. That test lives in the
  // Founder Test executed against a live NEX Supabase · not here. This
  // suite only verifies the guard-throws that live in the service.
});
