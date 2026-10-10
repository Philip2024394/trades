// src/lib/nex/discovery-world/__tests__/orchestrator.test.ts
//
// NEX World Email Intelligence · Session-3 · Orchestrator + reaper acceptance
// Founder-authorised programme · 2026-09-21.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  runOrchestrationTick, runReaper, tryAcquireLeader, releaseLeader,
  loadRecentTicks, loadOrchestrationStatus,
  _ORCHESTRATOR_TWO_CLOCK_DISCIPLINE, _ORCHESTRATOR_LEADER_SINGLE_WRITER,
} from "..";

// ─── SQL-faithful mock (bounded · only handles orchestrator queries) ─
function makeMock() {
  const store: any = {
    programmes: new Map<string, any>(),
    programme_countries: new Map<string, any[]>(),
    country_state: new Map<string, any>(),
    ticks: [] as any[],
    leaders: new Map<string, any>(),
    cycles: [] as any[],
  };
  let seq = 1;
  const key = (p: string, iso: string) => `${p}|${iso}`;
  const bucketKey = (p: string, b: string) => `${p}|${b}`;

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // ─── reaper: expired claims ────
      if (/UPDATE nex\.discovery_country_state SET status = 'idle'/i.test(norm) && /activity_expires_at IS NOT NULL/i.test(norm)) {
        let n = 0;
        for (const s of store.country_state.values()) {
          if (s.activity_expires_at && new Date(s.activity_expires_at) < new Date()) {
            s.status = "idle"; s.current_cycle_id = null; s.claimed_at = null; s.claimed_by = null; s.activity_expires_at = null;
            n++;
          }
        }
        return R([], n);
      }
      // ─── reaper: stalled cycles ────
      if (/UPDATE nex\.discovery_cycle SET outcome = 'failed'/i.test(norm)) {
        let n = 0;
        for (const c of store.cycles) {
          if (c.outcome === "in_progress" && new Date(c.started_at) < new Date(Date.now() - 10 * 60_000)) {
            c.outcome = "failed"; c.finished_at = new Date().toISOString();
            n++;
          }
        }
        return R([], n);
      }
      // ─── leader ────
      if (/^INSERT INTO nex\.discovery_orchestrator_leader/i.test(norm)) {
        const k = bucketKey(params[0], params[1]);
        if (store.leaders.has(k)) return R([], 0);
        store.leaders.set(k, { programme_id: params[0], minute_bucket: params[1], worker_id: params[2], acquired_at: new Date().toISOString(), released_at: null });
        return R([{ worker_id: params[2] }], 1);
      }
      if (/^SELECT worker_id FROM nex\.discovery_orchestrator_leader/i.test(norm)) {
        const k = bucketKey(params[0], params[1]);
        const l = store.leaders.get(k);
        return R(l ? [{ worker_id: l.worker_id }] : []);
      }
      if (/^UPDATE nex\.discovery_orchestrator_leader SET released_at = now\(\)/i.test(norm)) {
        const k = bucketKey(params[0], params[1]);
        const l = store.leaders.get(k);
        if (l) l.released_at = new Date().toISOString();
        return R([]);
      }
      // ─── programme ────
      if (/^SELECT \* FROM nex\.discovery_programme WHERE slug = \$1/i.test(norm)) {
        const p = [...store.programmes.values()].find(x => x.slug === params[0]);
        return R(p ? [p] : []);
      }
      // ─── programme countries ────
      if (/^SELECT pc\.iso_alpha_2, wc\.name, wc\.region, pc\.priority/i.test(norm)) {
        const list = store.programme_countries.get(params[0]) ?? [];
        return R(list);
      }
      // ─── country states ────
      if (/^UPDATE nex\.discovery_country_state SET status = 'idle', current_cycle_id = NULL/i.test(norm)) {
        return R([], 0);
      }
      if (/^SELECT \* FROM nex\.discovery_country_state WHERE programme_id = \$1 ORDER BY iso_alpha_2/i.test(norm)) {
        const list = [...store.country_state.values()].filter(s => s.programme_id === params[0]);
        return R(list);
      }
      // ─── programme policy_json (used by loadProgrammeCountries) ────
      if (/^SELECT policy_json FROM nex\.discovery_programme WHERE programme_id = \$1/i.test(norm)) {
        const p = store.programmes.get(params[0]);
        return R(p ? [{ policy_json: p.policy_json ?? {} }] : []);
      }
      // ─── tick idempotency ────
      if (/^SELECT \* FROM nex\.discovery_orchestrator_tick WHERE worker_id = \$1 AND minute_bucket = \$2/i.test(norm)) {
        const existing = store.ticks.find((t: any) => t.worker_id === params[0] && t.minute_bucket === params[1]);
        return R(existing ? [existing] : []);
      }
      // ─── tick_seq ────
      if (/COALESCE\(MAX\(tick_seq\), 0\) \+ 1 AS n/i.test(norm)) {
        const n = store.ticks.reduce((m: number, t: any) => Math.max(m, t.tick_seq), 0);
        return R([{ n: n + 1 }]);
      }
      // ─── tick INSERT (superseded path) ────
      if (/^INSERT INTO nex\.discovery_orchestrator_tick .*VALUES \(\$1, \$2, \$3, now\(\), 0, \$4, \$5, 'superseded'/i.test(norm)) {
        const row = {
          tick_id: `t-${seq++}`, tick_seq: params[0], tick_at: params[1], minute_bucket: params[2],
          finished_at: new Date().toISOString(), duration_ms: 0,
          leader: params[3], worker_id: params[4], outcome: "superseded", note: params[5],
          cycles_planned: 0, cycles_started: 0, cycles_skipped: 0,
          countries_touched: [], programmes_touched: [],
          reaped_stalled_cycles: 0, reaped_expired_claims: 0,
        };
        store.ticks.push(row);
        return R([row]);
      }
      // ─── tick INSERT (planned path · cycles_started hard-coded 0 in SQL) ────
      if (/^INSERT INTO nex\.discovery_orchestrator_tick/i.test(norm)) {
        const row = {
          tick_id: `t-${seq++}`,
          tick_seq: params[0], tick_at: params[1], minute_bucket: params[2],
          finished_at: params[3], duration_ms: params[4],
          leader: params[5], worker_id: params[6],
          cycles_planned: params[7], cycles_started: 0, cycles_skipped: params[8],
          countries_touched: params[9], programmes_touched: params[10],
          reaped_stalled_cycles: params[11], reaped_expired_claims: params[12],
          outcome: params[13], note: params[14],
        };
        store.ticks.push(row);
        return R([row]);
      }
      // ─── recent ticks ────
      if (/^SELECT \* FROM nex\.discovery_orchestrator_tick ORDER BY tick_seq DESC/i.test(norm)) {
        return R([...store.ticks].sort((a, b) => b.tick_seq - a.tick_seq).slice(0, params[0]));
      }
      throw new Error(`orchestrator mock: unhandled SQL: ${norm.slice(0, 160)}`);
    },
    release() {},
  } as unknown as PoolClient;

  return {
    client, store,
    seedProgramme(slug: string, opts: { cadence_seconds?: number } = {}) {
      const id = `p-${seq++}`;
      store.programmes.set(id, {
        programme_id: id, slug, display_name: slug, topic: slug, status: "active",
        cadence_seconds: opts.cadence_seconds ?? 300, policy_json: {},
      });
      store.programme_countries.set(id, []);
      return id;
    },
    seedCountry(programme_id: string, iso: string, opts: { status?: string; last_completed_at?: string; activity_expires_at?: string } = {}) {
      store.programme_countries.get(programme_id)!.push({ iso_alpha_2: iso, name: iso, region: "Europe", priority: 100, included: true, policy_json: {} });
      store.country_state.set(key(programme_id, iso), {
        programme_id, iso_alpha_2: iso,
        status: opts.status ?? "idle",
        current_cycle_id: null, last_cycle_id: null,
        claimed_at: null, claimed_by: null,
        activity_expires_at: opts.activity_expires_at ?? null,
        last_completed_at: opts.last_completed_at ?? null,
        next_scheduled_at: null,
        businesses_discovered_today: 0, new_emails_today: 0, existing_matched_today: 0,
        rejected_today: 0, websites_resolved_today: 0, sources_responded_today: 0,
        sources_unavailable_today: 0, metrics_day: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      });
    },
  };
}
function R(rows: any[], rowCount?: number): QueryResult<any> {
  return { rows, rowCount: rowCount ?? rows.length, command: "", oid: 0, fields: [] };
}

// ═══════════════════════════════════════════════════════════════════
// A · Two-clock discipline · leader · idempotency
// ═══════════════════════════════════════════════════════════════════
describe("Orchestrator · (A) discipline", () => {
  it("(A1) boundary markers exported", () => {
    expect(_ORCHESTRATOR_TWO_CLOCK_DISCIPLINE).toBe("orchestration_cadence_never_overrides_source_politeness");
    expect(_ORCHESTRATOR_LEADER_SINGLE_WRITER).toBe("one_writer_per_programme_minute_bucket");
  });
  it("(A2) leader election · one winner per (programme, minute)", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    const bucket = new Date();
    bucket.setSeconds(0, 0);
    const first = await tryAcquireLeader(mock.client, { programme_id: pid, minute_bucket: bucket, worker_id: "worker-A" });
    const second = await tryAcquireLeader(mock.client, { programme_id: pid, minute_bucket: bucket, worker_id: "worker-B" });
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(second.incumbent).toBe("worker-A");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Tick idempotency
// ═══════════════════════════════════════════════════════════════════
describe("Orchestrator · (B) tick idempotency", () => {
  it("(B1) same tick fired twice within the same minute → returns existing row", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    mock.seedCountry(pid, "GB");
    const t = new Date();
    const first = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 3, now: () => t });
    const second = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 3, now: () => t });
    expect(second.tick_id).toBe(first.tick_id);
    expect(second.tick_seq).toBe(first.tick_seq);
  });

  it("(B2) different worker · same minute → superseded", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    mock.seedCountry(pid, "GB");
    const t = new Date();
    const first = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 3, now: () => t });
    const second = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w2", max_countries_per_tick: 3, now: () => t });
    expect(first.outcome).not.toBe("superseded");
    expect(second.outcome).toBe("superseded");
    expect(second.note).toContain("superseded by w1");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Planning
// ═══════════════════════════════════════════════════════════════════
describe("Orchestrator · (C) planning", () => {
  it("(C1) plans idle countries · skips ones actively crawling", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    mock.seedCountry(pid, "GB");
    mock.seedCountry(pid, "US", { status: "crawling" });
    mock.seedCountry(pid, "DE");
    const rep = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 5 });
    expect(rep.cycles_planned).toBe(2);            // GB · DE
    expect(rep.cycles_skipped).toBe(1);            // US
    expect(rep.countries_touched).toEqual(expect.arrayContaining(["GB", "DE"]));
    expect(rep.countries_touched).not.toContain("US");
  });

  it("(C2) respects max_countries_per_tick · outcome=partial when saturated", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    for (const iso of ["GB","US","DE","FR","IT","ES","NL","BE","PL"]) mock.seedCountry(pid, iso);
    const rep = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 3 });
    expect(rep.cycles_planned).toBe(3);
    expect(rep.outcome).toBe("partial");
  });

  it("(C3) respects politeness · skips country completed within cadence window", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding", { cadence_seconds: 300 });
    mock.seedCountry(pid, "GB");
    mock.seedCountry(pid, "US", { last_completed_at: new Date(Date.now() - 30_000).toISOString() });   // 30s ago · within cadence
    mock.seedCountry(pid, "DE", { last_completed_at: new Date(Date.now() - 600_000).toISOString() });   // 10min ago · past cadence
    const rep = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 5 });
    expect(rep.countries_touched).toContain("GB");
    expect(rep.countries_touched).toContain("DE");
    expect(rep.countries_touched).not.toContain("US");
  });

  it("(C4) no idle countries → outcome=no_work", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    mock.seedCountry(pid, "GB", { status: "crawling" });
    const rep = await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 5 });
    expect(rep.outcome).toBe("no_work");
    expect(rep.cycles_planned).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Reaper
// ═══════════════════════════════════════════════════════════════════
describe("Orchestrator · (D) reaper", () => {
  it("(D1) reaper resets expired country claims to idle", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding");
    mock.seedCountry(pid, "GB", { status: "crawling", activity_expires_at: new Date(Date.now() - 5_000).toISOString() });
    mock.seedCountry(pid, "DE", { status: "crawling", activity_expires_at: new Date(Date.now() + 60_000).toISOString() });
    const out = await runReaper(mock.client);
    expect(out.expired_claims_reset).toBe(1);          // only GB (past-due)
    // DE remains crawling · not reaped
    const de = mock.store.country_state.get(`${pid}|DE`);
    expect(de.status).toBe("crawling");
    const gb = mock.store.country_state.get(`${pid}|GB`);
    expect(gb.status).toBe("idle");
  });

  it("(D2) reaper marks stalled cycles as failed", async () => {
    const mock = makeMock();
    mock.store.cycles.push({ cycle_id: "c1", outcome: "in_progress", started_at: new Date(Date.now() - 15 * 60_000).toISOString() });
    mock.store.cycles.push({ cycle_id: "c2", outcome: "in_progress", started_at: new Date(Date.now() -  2 * 60_000).toISOString() });
    const out = await runReaper(mock.client);
    expect(out.stalled_cycles_marked_failed).toBe(1);   // c1 only (15min > 10min threshold)
    expect(mock.store.cycles.find(c => c.cycle_id === "c1")!.outcome).toBe("failed");
    expect(mock.store.cycles.find(c => c.cycle_id === "c2")!.outcome).toBe("in_progress");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Status readout
// ═══════════════════════════════════════════════════════════════════
describe("Orchestrator · (E) status readout", () => {
  it("(E1) recent ticks returned most-recent first · next_expected_at = last + cadence", async () => {
    const mock = makeMock();
    const pid = mock.seedProgramme("scaffolding", { cadence_seconds: 300 });
    mock.seedCountry(pid, "GB");
    await runOrchestrationTick(mock.client, { programme_slug: "scaffolding", worker_id: "w1", max_countries_per_tick: 3 });
    const status = await loadOrchestrationStatus(mock.client, "scaffolding");
    expect(status.last_tick).toBeTruthy();
    expect(status.cadence_seconds).toBe(300);
    expect(status.next_expected_at).toBeTruthy();
    if (status.last_tick && status.next_expected_at) {
      const delta = Date.parse(status.next_expected_at) - Date.parse(status.last_tick.tick_at);
      expect(delta).toBe(300_000);
    }
  });
});
