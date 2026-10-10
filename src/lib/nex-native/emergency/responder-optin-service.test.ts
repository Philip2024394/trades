// src/lib/nex-native/emergency/responder-optin-service.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QCall = { sql: string; params: readonly unknown[] };
let qCalls: QCall[];
let qResponse: ((sql: string, params: readonly unknown[]) =>
  { rows: Record<string, unknown>[]; rowCount: number | null } | null
) | null;
let withClientNullMode = false;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    if (withClientNullMode) return null;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        qCalls.push({ sql, params: params ?? [] });
        if (qResponse) {
          const r = qResponse(sql, params ?? []);
          if (r !== null) return r;
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  countActiveResponders,
  getOptIn,
  optIn,
  optOut,
  RESPONDER_OPTIN_RULES,
  updateRadius,
} from "./responder-optin-service";

const ACC = "11111111-1111-4111-8111-111111111111";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account_id: ACC,
    opted_in_at: new Date("2026-10-10T09:00:00Z"),
    acknowledged_safety_guidance_at: new Date("2026-10-10T08:00:00Z"),
    radius_km: 5,
    simulated: true,
    ...overrides,
  };
}

beforeEach(() => {
  qCalls = [];
  qResponse = null;
  withClientNullMode = false;
});

afterEach(() => vi.restoreAllMocks());

describe("optIn · guards", () => {
  it("rejects blank account id", async () => {
    await expect(
      optIn({ accountId: "", radiusKm: 5, acknowledgedSafetyGuidanceAt: new Date().toISOString() }),
    ).rejects.toThrow(/invalid_account_id/);
  });

  it("rejects radius below 1", async () => {
    await expect(
      optIn({ accountId: ACC, radiusKm: 0, acknowledgedSafetyGuidanceAt: new Date().toISOString() }),
    ).rejects.toThrow(/invalid_radius/);
  });

  it("rejects radius above 25", async () => {
    await expect(
      optIn({ accountId: ACC, radiusKm: 999, acknowledgedSafetyGuidanceAt: new Date().toISOString() }),
    ).rejects.toThrow(/invalid_radius/);
  });

  it("rejects non-integer radius", async () => {
    await expect(
      optIn({ accountId: ACC, radiusKm: 3.5, acknowledgedSafetyGuidanceAt: new Date().toISOString() }),
    ).rejects.toThrow(/invalid_radius/);
  });

  it("rejects safety ack older than 30 days", async () => {
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    await expect(
      optIn({ accountId: ACC, radiusKm: 5, acknowledgedSafetyGuidanceAt: stale }),
    ).rejects.toThrow(/safety_guidance_stale/);
  });

  it("rejects malformed safety ack timestamp", async () => {
    await expect(
      optIn({ accountId: ACC, radiusKm: 5, acknowledgedSafetyGuidanceAt: "nope" }),
    ).rejects.toThrow(/invalid_safety_ack/);
  });

  it("upserts and returns the row (simulated=TRUE forced)", async () => {
    qResponse = (sql) => sql.includes("INSERT INTO nex.emergency_responder_optin")
      ? { rows: [row()], rowCount: 1 }
      : null;
    const r = await optIn({
      accountId: ACC,
      radiusKm: 5,
      acknowledgedSafetyGuidanceAt: new Date().toISOString(),
    });
    expect(r.simulated).toBe(true);
    const call = qCalls.find((c) => c.sql.includes("INSERT INTO nex.emergency_responder_optin"));
    expect(call?.sql).toMatch(/TRUE\s*\)/);
    expect(call?.sql).toMatch(/ON\s+CONFLICT\s*\(\s*account_id\s*\)/);
  });

  it("throws db_unavailable when pool is unset", async () => {
    withClientNullMode = true;
    await expect(
      optIn({
        accountId: ACC,
        radiusKm: 5,
        acknowledgedSafetyGuidanceAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/db_unavailable/);
  });
});

describe("getOptIn", () => {
  it("returns mapped row when present", async () => {
    qResponse = (sql) => sql.includes("WHERE account_id = $1")
      ? { rows: [row()], rowCount: 1 }
      : null;
    const r = await getOptIn(ACC);
    expect(r?.radiusKm).toBe(5);
    expect(r?.simulated).toBe(true);
  });

  it("returns null when no opt-in exists", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    const r = await getOptIn(ACC);
    expect(r).toBeNull();
  });
});

describe("optOut", () => {
  it("deletes the row", async () => {
    qResponse = (sql) =>
      sql.includes("DELETE FROM nex.emergency_responder_optin")
        ? { rows: [], rowCount: 1 }
        : null;
    await optOut(ACC);
    expect(qCalls.some((c) => c.sql.includes("DELETE FROM nex.emergency_responder_optin"))).toBe(true);
  });

  it("throws db_unavailable when pool is unset", async () => {
    withClientNullMode = true;
    await expect(optOut(ACC)).rejects.toThrow(/db_unavailable/);
  });
});

describe("updateRadius", () => {
  it("updates and returns the row", async () => {
    qResponse = (sql) =>
      sql.includes("UPDATE nex.emergency_responder_optin")
        ? { rows: [row({ radius_km: 12 })], rowCount: 1 }
        : null;
    const r = await updateRadius(ACC, 12);
    expect(r.radiusKm).toBe(12);
  });

  it("throws not_opted_in if no row updated", async () => {
    qResponse = () => ({ rows: [], rowCount: 0 });
    await expect(updateRadius(ACC, 12)).rejects.toThrow(/not_opted_in/);
  });
});

describe("countActiveResponders", () => {
  it("returns the integer count", async () => {
    qResponse = (sql) =>
      sql.includes("count(*)")
        ? { rows: [{ n: 42 }], rowCount: 1 }
        : null;
    expect(await countActiveResponders()).toBe(42);
  });

  it("returns 0 when DB is unavailable", async () => {
    withClientNullMode = true;
    expect(await countActiveResponders()).toBe(0);
  });
});

describe("RESPONDER_OPTIN_RULES", () => {
  it("exposes sealed radius bounds and safety-ack window", () => {
    expect(RESPONDER_OPTIN_RULES.minRadiusKm).toBe(1);
    expect(RESPONDER_OPTIN_RULES.maxRadiusKm).toBe(25);
    expect(RESPONDER_OPTIN_RULES.safetyAckMaxAgeDays).toBe(30);
  });
});
