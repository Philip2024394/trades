// src/lib/nex-native/safechat/retention-sweep.test.ts
//
// Hermetic tests for the SafeChat retention sweep. We stub @/lib/nex/db
// so no actual DB is touched. The tests verify:
//   · validation of retentionDays (positive integer only)
//   · happy path returns deletedCount + cutoffAt
//   · idempotency (second run returns deletedCount = 0)
//   · dry-run mode (count) does not DELETE
//   · null DB result (pool unavailable) returns a safe zero

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const queryMock = vi.fn();
const withClientMock = vi.fn();

vi.mock("@/lib/nex/db", () => ({
  withClient: (fn: (c: { query: typeof queryMock }) => Promise<unknown>) =>
    withClientMock(fn),
}));

beforeEach(() => {
  vi.clearAllMocks();
  withClientMock.mockImplementation(async (fn) => fn({ query: queryMock }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("validation", () => {
  test("rejects zero", async () => {
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    await expect(
      sweepClassificationsOlderThan({ retentionDays: 0 }),
    ).rejects.toThrow(/positive integer/);
  });

  test("rejects negative", async () => {
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    await expect(
      sweepClassificationsOlderThan({ retentionDays: -3 }),
    ).rejects.toThrow(/positive integer/);
  });

  test("rejects NaN", async () => {
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    await expect(
      sweepClassificationsOlderThan({ retentionDays: Number.NaN }),
    ).rejects.toThrow(/positive integer/);
  });

  test("rejects fractional", async () => {
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    await expect(
      sweepClassificationsOlderThan({ retentionDays: 1.5 }),
    ).rejects.toThrow(/positive integer/);
  });

  test("accepts a valid positive integer", async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ at: "2026-09-10T00:00:00Z" }] });
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    const r = await sweepClassificationsOlderThan({ retentionDays: 30 });
    expect(r.deletedCount).toBe(0);
  });

  test("dry-run rejects invalid retentionDays too", async () => {
    const { countClassificationsOlderThan } = await import("./retention-sweep");
    await expect(
      countClassificationsOlderThan({ retentionDays: 0 }),
    ).rejects.toThrow(/positive integer/);
  });
});

describe("sweepClassificationsOlderThan", () => {
  test("happy path · returns deletedCount + cutoffAt", async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 7,
        rows: Array.from({ length: 7 }, (_, i) => ({ classification_id: `c-${i}` })),
      })
      .mockResolvedValueOnce({ rows: [{ at: "2026-09-10T00:00:00Z" }] });
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    const r = await sweepClassificationsOlderThan({ retentionDays: 30 });
    expect(r.deletedCount).toBe(7);
    expect(r.cutoffAt).toBe("2026-09-10T00:00:00Z");
  });

  test("binds retentionDays as a positional parameter", async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ at: "x" }] });
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    await sweepClassificationsOlderThan({ retentionDays: 42 });
    expect(queryMock.mock.calls[0]![1]).toEqual([42]);
    expect(queryMock.mock.calls[1]![1]).toEqual([42]);
  });

  test("idempotency · second run with zero-matching returns deletedCount=0", async () => {
    // First run deletes 3; second run deletes 0.
    queryMock
      .mockResolvedValueOnce({ rowCount: 3, rows: [{ a: 1 }, { a: 2 }, { a: 3 }] })
      .mockResolvedValueOnce({ rows: [{ at: "t1" }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ at: "t2" }] });
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    const r1 = await sweepClassificationsOlderThan({ retentionDays: 30 });
    expect(r1.deletedCount).toBe(3);
    const r2 = await sweepClassificationsOlderThan({ retentionDays: 30 });
    expect(r2.deletedCount).toBe(0);
  });

  test("DB unavailable · returns safe zero", async () => {
    withClientMock.mockImplementationOnce(async () => null);
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    const r = await sweepClassificationsOlderThan({ retentionDays: 30 });
    expect(r.deletedCount).toBe(0);
    expect(r.cutoffAt).toBe("");
  });

  test("missing cutoff row · returns empty cutoffAt", async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ a: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    const { sweepClassificationsOlderThan } = await import("./retention-sweep");
    const r = await sweepClassificationsOlderThan({ retentionDays: 30 });
    expect(r.deletedCount).toBe(1);
    expect(r.cutoffAt).toBe("");
  });
});

describe("countClassificationsOlderThan (dry-run)", () => {
  test("returns the count without issuing a DELETE", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ n: 42, at: "2026-09-10T00:00:00Z" }],
    });
    const { countClassificationsOlderThan } = await import("./retention-sweep");
    const r = await countClassificationsOlderThan({ retentionDays: 30 });
    expect(r.deletedCount).toBe(42);
    expect(r.cutoffAt).toBe("2026-09-10T00:00:00Z");
    expect(queryMock).toHaveBeenCalledTimes(1);
    const sql = String(queryMock.mock.calls[0]![0]);
    expect(sql.toUpperCase()).not.toContain("DELETE");
    expect(sql.toUpperCase()).toContain("SELECT COUNT");
  });

  test("DB unavailable · returns safe zero in dry-run", async () => {
    withClientMock.mockImplementationOnce(async () => null);
    const { countClassificationsOlderThan } = await import("./retention-sweep");
    const r = await countClassificationsOlderThan({ retentionDays: 30 });
    expect(r.deletedCount).toBe(0);
    expect(r.cutoffAt).toBe("");
  });
});
