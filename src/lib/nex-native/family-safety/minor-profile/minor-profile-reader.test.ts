// src/lib/nex-native/family-safety/minor-profile/minor-profile-reader.test.ts
//
// Unit tests for the Minor Profile reader. Guarantees:
//   · No write path exists.
//   · Absent row is NOT treated as a minor (default-closed).
//   · After transferred_at is set, isMinor()/isSafeChatAlwaysOn() return FALSE.

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  getMinorProfile,
  isMinor,
  isSafeChatAlwaysOn,
} from "./minor-profile-reader";
import { CHILD_CREATION_ERROR_CODES } from "../child-account-creation/types";

const CHILD = "child-11111111-1111-4111-8111-111111111111";

function minorRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account_id: CHILD,
    is_minor: true,
    parent_custody_id: "22222222-2222-4222-8222-222222222222",
    auto_transfer_at: new Date("2031-05-10T00:00:00Z"),
    transferred_at: null,
    safechat_always_on: true,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    updated_at: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

describe("getMinorProfile", () => {
  it("returns null when no row exists", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const result = await getMinorProfile(CHILD);
    expect(result).toBeNull();
  });

  it("returns the row when present", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    const result = await getMinorProfile(CHILD);
    expect(result).not.toBeNull();
    expect(result?.accountId).toBe(CHILD);
    expect(result?.isMinor).toBe(true);
    expect(result?.safechatAlwaysOn).toBe(true);
  });

  it("throws when accountId is empty", async () => {
    await expect(getMinorProfile("")).rejects.toThrow(
      CHILD_CREATION_ERROR_CODES.INVALID_PARENT,
    );
  });

  it("returns null when DB unavailable", async () => {
    withClientUnavailable = true;
    const result = await getMinorProfile(CHILD);
    expect(result).toBeNull();
  });

  it("uses a SELECT · never writes", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    await getMinorProfile(CHILD);
    expect(withClientCalls[0].sql).toMatch(/SELECT/i);
    expect(withClientCalls[0].sql).not.toMatch(/INSERT|UPDATE|DELETE/i);
  });
});

describe("isMinor", () => {
  it("returns FALSE for absent profile (default-closed)", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    expect(await isMinor(CHILD)).toBe(false);
  });

  it("returns TRUE for active minor", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    expect(await isMinor(CHILD)).toBe(true);
  });

  it("returns FALSE after transferred_at is set", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ transferred_at: new Date() })],
      rowCount: 1,
    });
    expect(await isMinor(CHILD)).toBe(false);
  });

  it("returns FALSE when is_minor is already FALSE", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ is_minor: false, transferred_at: new Date() })],
      rowCount: 1,
    });
    expect(await isMinor(CHILD)).toBe(false);
  });
});

describe("isSafeChatAlwaysOn", () => {
  it("returns TRUE for active minor with safechat_always_on=TRUE", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    expect(await isSafeChatAlwaysOn(CHILD)).toBe(true);
  });

  it("returns FALSE for absent profile", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    expect(await isSafeChatAlwaysOn(CHILD)).toBe(false);
  });

  it("returns FALSE after transferred_at (adult now)", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ transferred_at: new Date() })],
      rowCount: 1,
    });
    expect(await isSafeChatAlwaysOn(CHILD)).toBe(false);
  });

  it("returns FALSE if is_minor=FALSE even when flag is TRUE", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ is_minor: false, transferred_at: new Date() })],
      rowCount: 1,
    });
    expect(await isSafeChatAlwaysOn(CHILD)).toBe(false);
  });
});
