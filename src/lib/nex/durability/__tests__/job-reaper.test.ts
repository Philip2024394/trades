// src/lib/nex/durability/__tests__/job-reaper.test.ts
//
// UWI · Wave 2 · D7 unit tests (mock DB · deterministic).

import { describe, it, expect } from "vitest";
import {
  runReaperOnce,
  type JobReaperDb,
  type ReapableJobRow,
  DEFAULT_REAPER_CONFIG,
} from "../job-reaper";

class MockDb implements JobReaperDb {
  audits: Array<{ event_type: string; job_id: string; worker_type: string; details: Record<string, unknown> }> = [];
  constructor(
    private reaped: ReadonlyArray<ReapableJobRow>,
    private dead_lettered: ReadonlyArray<ReapableJobRow>,
  ) {}
  async reapExpiredLeases(): Promise<{ reaped: ReadonlyArray<ReapableJobRow>; dead_lettered: ReadonlyArray<ReapableJobRow> }> {
    return { reaped: this.reaped, dead_lettered: this.dead_lettered };
  }
  async writeAuditEvent(event: { event_type: "lease_reaped" | "job_dead_lettered"; job_id: string; worker_type: string; details: Record<string, unknown> }): Promise<void> {
    this.audits.push(event);
  }
}

const row = (id: string, worker_type: string, attempts: number): ReapableJobRow => ({
  id,
  worker_type,
  attempts,
  assigned_worker_id: `worker-${id}`,
  lease_expires_at: "2026-09-21T07:00:00.000Z",
});

describe("D7 · job reaper", () => {
  it("returns zero metrics on empty scan", async () => {
    const db = new MockDb([], []);
    const m = await runReaperOnce(db);
    expect(m.reaped_count).toBe(0);
    expect(m.dead_lettered_count).toBe(0);
    expect(db.audits).toHaveLength(0);
  });

  it("emits lease_reaped audit per reaped row", async () => {
    const reaped = [row("j1", "crawl", 1), row("j2", "normalise", 2)];
    const db = new MockDb(reaped, []);
    const m = await runReaperOnce(db);
    expect(m.reaped_count).toBe(2);
    expect(db.audits).toHaveLength(2);
    expect(db.audits[0]).toMatchObject({ event_type: "lease_reaped", job_id: "j1", worker_type: "crawl" });
    expect(db.audits[0].details).toMatchObject({
      prior_assigned_worker_id: "worker-j1",
      attempts_so_far: 1,
    });
  });

  it("emits job_dead_lettered audit per DLQ'd row with attempts+reason", async () => {
    const dead = [row("j-dead", "discovery", 5)];
    const db = new MockDb([], dead);
    const m = await runReaperOnce(db, { max_attempts: 5, scan_interval_ms: 1000 });
    expect(m.dead_lettered_count).toBe(1);
    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toMatchObject({
      event_type: "job_dead_lettered",
      job_id: "j-dead",
      worker_type: "discovery",
    });
    expect(db.audits[0].details).toMatchObject({
      attempts: 5,
      max_attempts: 5,
      reason: "attempts_exhausted",
    });
  });

  it("records scan_duration_ms + scanned_at_iso for observability", async () => {
    const db = new MockDb([], []);
    const now_iso = "2026-09-21T08:00:00.000Z";
    const m = await runReaperOnce(db, DEFAULT_REAPER_CONFIG, () => new Date(now_iso));
    expect(m.scanned_at_iso).toBe(now_iso);
    expect(m.scan_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("handles mixed reaped + dead-lettered in one pass", async () => {
    const reaped = [row("r1", "crawl", 1)];
    const dead = [row("d1", "crawl", 5), row("d2", "normalise", 5)];
    const db = new MockDb(reaped, dead);
    const m = await runReaperOnce(db);
    expect(m.reaped_count).toBe(1);
    expect(m.dead_lettered_count).toBe(2);
    expect(db.audits).toHaveLength(3);
    expect(db.audits.filter(a => a.event_type === "lease_reaped")).toHaveLength(1);
    expect(db.audits.filter(a => a.event_type === "job_dead_lettered")).toHaveLength(2);
  });
});
