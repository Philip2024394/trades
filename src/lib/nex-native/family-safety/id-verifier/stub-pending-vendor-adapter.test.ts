// src/lib/nex-native/family-safety/id-verifier/stub-pending-vendor-adapter.test.ts
//
// Unit tests for the stub ID-verifier adapter + manual override.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResponder = (
  sql: string,
  params: readonly unknown[],
) => { rows: Record<string, unknown>[]; rowCount: number };

let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponder: QueryResponder | null;
let withClientUnavailable: boolean;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    if (withClientUnavailable) return null;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        withClientCalls.push({ sql, params: params ?? [] });
        if (withClientResponder) return withClientResponder(sql, params ?? []);
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  StubPendingVendorAdapter,
  manualOverrideOutcome,
} from "./stub-pending-vendor-adapter";
import { selectAdapter } from "./select-adapter";
import { ID_VERIFIER_ERROR_CODES } from "./types";

const OVERRIDE_FLAG = "NEX_FAMILY_SAFETY_ID_VERIFIER_MANUAL_OVERRIDE";

let originalOverride: string | undefined;

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
  originalOverride = process.env[OVERRIDE_FLAG];
  delete process.env[OVERRIDE_FLAG];
});

afterEach(() => {
  if (originalOverride === undefined) delete process.env[OVERRIDE_FLAG];
  else process.env[OVERRIDE_FLAG] = originalOverride;
});

describe("StubPendingVendorAdapter.submit", () => {
  it("returns a fresh submission_id with outcome=pending", async () => {
    const adapter = new StubPendingVendorAdapter();
    const result = await adapter.submit({
      submitterAccountId: "parent-1",
      documentType: "indonesian_kk",
      documentBytes: new Uint8Array([1, 2, 3, 4, 5]),
      idempotencyKey: "idem-1",
    });
    expect(result.outcome).toBe("pending");
    expect(typeof result.submissionId).toBe("string");
    expect(result.submissionId.length).toBeGreaterThan(0);
  });

  it("rejects empty submitterAccountId", async () => {
    const adapter = new StubPendingVendorAdapter();
    await expect(
      adapter.submit({
        submitterAccountId: "   ",
        documentType: "indonesian_kk",
        documentBytes: new Uint8Array([1]),
        idempotencyKey: "idem-1",
      }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
  });

  it("rejects empty idempotencyKey", async () => {
    const adapter = new StubPendingVendorAdapter();
    await expect(
      adapter.submit({
        submitterAccountId: "parent-1",
        documentType: "indonesian_kk",
        documentBytes: new Uint8Array([1]),
        idempotencyKey: "",
      }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
  });

  it("rejects empty documentBytes", async () => {
    const adapter = new StubPendingVendorAdapter();
    await expect(
      adapter.submit({
        submitterAccountId: "parent-1",
        documentType: "passport",
        documentBytes: new Uint8Array(0),
        idempotencyKey: "idem-1",
      }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.BYTES_EMPTY);
  });

  it("rejects non-Uint8Array documentBytes", async () => {
    const adapter = new StubPendingVendorAdapter();
    await expect(
      adapter.submit({
        submitterAccountId: "parent-1",
        documentType: "passport",
        // @ts-expect-error purposefully invalid
        documentBytes: "not-bytes",
        idempotencyKey: "idem-1",
      }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.BYTES_EMPTY);
  });

  it("mints distinct submission ids across calls", async () => {
    const adapter = new StubPendingVendorAdapter();
    const a = await adapter.submit({
      submitterAccountId: "p",
      documentType: "indonesian_kk",
      documentBytes: new Uint8Array([1]),
      idempotencyKey: "a",
    });
    const b = await adapter.submit({
      submitterAccountId: "p",
      documentType: "indonesian_kk",
      documentBytes: new Uint8Array([1]),
      idempotencyKey: "b",
    });
    expect(a.submissionId).not.toBe(b.submissionId);
  });

  it("exposes adapterName as 'stub_pending_vendor'", () => {
    expect(new StubPendingVendorAdapter().adapterName).toBe("stub_pending_vendor");
  });
});

describe("StubPendingVendorAdapter.pollStatus", () => {
  it("always returns outcome=pending", async () => {
    const adapter = new StubPendingVendorAdapter();
    const result = await adapter.pollStatus("some-submission-id");
    expect(result.outcome).toBe("pending");
  });

  it("rejects empty submissionId", async () => {
    const adapter = new StubPendingVendorAdapter();
    await expect(adapter.pollStatus("")).rejects.toThrow(
      ID_VERIFIER_ERROR_CODES.INVALID_ARGS,
    );
  });
});

describe("manualOverrideOutcome", () => {
  it("throws MANUAL_OVERRIDE_DISABLED when flag is OFF", async () => {
    await expect(
      manualOverrideOutcome({
        submissionId: "sub-1",
        outcome: "verified",
      }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.MANUAL_OVERRIDE_DISABLED);
  });

  it("updates the row when flag is ON and outcome is 'verified'", async () => {
    process.env[OVERRIDE_FLAG] = "true";
    withClientResponder = () => ({ rows: [{ submission_id: "sub-1" }], rowCount: 1 });
    const result = await manualOverrideOutcome({
      submissionId: "sub-1",
      outcome: "verified",
    });
    expect(result).toBe(true);
    expect(withClientCalls[0].sql).toMatch(/UPDATE\s+nex\.id_verification_submission/i);
    expect(withClientCalls[0].sql).toMatch(/verification_outcome = \$2/i);
    expect(withClientCalls[0].params[1]).toBe("verified");
  });

  it("updates the row when outcome is 'rejected'", async () => {
    process.env[OVERRIDE_FLAG] = "true";
    withClientResponder = () => ({ rows: [{ submission_id: "sub-1" }], rowCount: 1 });
    const result = await manualOverrideOutcome({
      submissionId: "sub-1",
      outcome: "rejected",
      responseSummaryRedacted: "ID blurred",
    });
    expect(result).toBe(true);
    expect(withClientCalls[0].params[1]).toBe("rejected");
    expect(withClientCalls[0].params[2]).toBe("ID blurred");
  });

  it("returns false when no row matched (already terminal)", async () => {
    process.env[OVERRIDE_FLAG] = "true";
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const result = await manualOverrideOutcome({
      submissionId: "sub-1",
      outcome: "verified",
    });
    expect(result).toBe(false);
  });

  it("rejects unknown override outcome", async () => {
    process.env[OVERRIDE_FLAG] = "true";
    await expect(
      manualOverrideOutcome({
        submissionId: "sub-1",
        // @ts-expect-error purposefully invalid
        outcome: "pending",
      }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.INVALID_OVERRIDE_OUTCOME);
  });

  it("rejects empty submissionId", async () => {
    process.env[OVERRIDE_FLAG] = "true";
    await expect(
      manualOverrideOutcome({ submissionId: "", outcome: "verified" }),
    ).rejects.toThrow(ID_VERIFIER_ERROR_CODES.INVALID_ARGS);
  });

  it("clamps responseSummaryRedacted to 500 chars", async () => {
    process.env[OVERRIDE_FLAG] = "true";
    withClientResponder = () => ({ rows: [{ submission_id: "sub-1" }], rowCount: 1 });
    const longSummary = "A".repeat(600);
    await manualOverrideOutcome({
      submissionId: "sub-1",
      outcome: "verified",
      responseSummaryRedacted: longSummary,
    });
    const summary = withClientCalls[0].params[2] as string;
    expect(summary.length).toBeLessThanOrEqual(500);
  });
});

describe("selectAdapter", () => {
  it("returns a StubPendingVendorAdapter instance", () => {
    const a = selectAdapter();
    expect(a.adapterName).toBe("stub_pending_vendor");
  });
});
