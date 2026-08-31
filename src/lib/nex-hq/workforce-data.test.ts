// workforce-data.test.ts · unit tests for the JobSlot derivation logic.
// We test the pure derivation function through a mocked DB path · no live DB.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the DB pool before importing the module under test.
vi.mock("@/lib/nex-food/db", () => {
  const state: {
    rotation: any[]; running: any[]; latest: any[]; hourly: any[];
  } = { rotation: [], running: [], latest: [], hourly: [] };
  return {
    __setState: (s: any) => { Object.assign(state, s); },
    getFoodDbPool: () => ({
      query: async (sql: string) => {
        if (/discovery_rotation_state/i.test(sql)) return { rows: state.rotation };
        if (/status = 'running'/i.test(sql))       return { rows: state.running };
        if (/DISTINCT ON \(worker_config\)/i.test(sql)) return { rows: state.latest };
        if (/GROUP BY split_part/i.test(sql))      return { rows: state.hourly };
        return { rows: [] };
      },
    }),
  };
});

// Mock the JSON loader with a fixed 2-job registry.
vi.mock("./workforce-jobs", () => ({
  loadJobs: () => [
    {
      id: "09", name: "Gyms", emoji: "🏋️", category_slug: "gyms",
      target_table: "nex.service_business",
      strategies: [{ provider: "overpass", query_kind: "tag", params: { leisure: "fitness_centre" } }],
      geographic_scope: "indonesia-all",
    },
    {
      id: "23", name: "Pharmacies", emoji: "💊", category_slug: "pharmacies",
      target_table: "nex.service_business",
      strategies: [{ provider: "overpass", query_kind: "tag", params: { amenity: "pharmacy" } }],
      geographic_scope: "indonesia-all",
    },
  ],
}));

const { loadWorkforceSnapshot } = await import("./workforce-data");
const dbMock = await import("@/lib/nex-food/db");
const setState = (dbMock as any).__setState as (s: any) => void;

const now = Date.now();

beforeEach(() => setState({ rotation: [], running: [], latest: [], hourly: [] }));
afterEach(() => vi.restoreAllMocks());

describe("loadWorkforceSnapshot · per-job status derivation", () => {
  it("job with no rotation rows → needs-strategy", async () => {
    const slots = await loadWorkforceSnapshot();
    expect(slots.find((s) => s.job.category_slug === "gyms")?.status).toBe("needs-strategy");
  });

  it("job with at least one build-state city → queued", async () => {
    setState({
      rotation: [
        { city: "Jakarta", category: "gyms", surface: "overpass", state: "build", cooldown_until: null },
        { city: "Bandung", category: "gyms", surface: "overpass", state: "saturated", cooldown_until: new Date(now + 3600_000) },
      ],
    });
    const slots = await loadWorkforceSnapshot();
    const gym = slots.find((s) => s.job.category_slug === "gyms")!;
    expect(gym.status).toBe("queued");
    expect(gym.currentCity).toBe("Jakarta");
    expect(gym.nextEligibleCity).toBe("Jakarta");
  });

  it("job with ALL cities cooling → cooling (surface cooldown, not workforce cooldown)", async () => {
    setState({
      rotation: [
        { city: "Jakarta", category: "gyms", surface: "overpass", state: "saturated", cooldown_until: new Date(now + 3_600_000) },
        { city: "Bandung", category: "gyms", surface: "overpass", state: "saturated", cooldown_until: new Date(now + 7_200_000) },
      ],
    });
    const slots = await loadWorkforceSnapshot();
    const gym = slots.find((s) => s.job.category_slug === "gyms")!;
    expect(gym.status).toBe("cooling");
    expect(gym.currentCity).toBe("Jakarta");   // earliest cooldown
    expect(gym.nextEligibleCity).toBeNull();
    expect(gym.cooldownNext).toBeTruthy();
  });

  it("running walker for this job → running (overrides queued)", async () => {
    setState({
      rotation: [
        { city: "Jakarta", category: "gyms", surface: "overpass", state: "build", cooldown_until: null },
      ],
      running: [{ worker_config: "gyms:Surabaya:overpass", started_at: new Date(now) }],
    });
    const slots = await loadWorkforceSnapshot();
    const gym = slots.find((s) => s.job.category_slug === "gyms")!;
    expect(gym.status).toBe("running");
    expect(gym.currentCity).toBe("Surabaya");
    expect(gym.currentProvider).toBe("overpass");
  });

  it("latest cycle failed → error (unless a walker is currently running)", async () => {
    setState({
      rotation: [
        { city: "Jakarta", category: "gyms", surface: "overpass", state: "build", cooldown_until: null },
      ],
      latest: [{
        worker_config: "gyms:Jakarta:overpass",
        finished_at: new Date(now - 60_000),
        status: "failed", records_new: 0, cycle_outcome: "PROVIDER_ERROR",
      }],
    });
    const slots = await loadWorkforceSnapshot();
    const gym = slots.find((s) => s.job.category_slug === "gyms")!;
    expect(gym.status).toBe("error");
  });

  it("aggregates records/hour and records/24h from hourly SQL result", async () => {
    setState({
      rotation: [
        { city: "Jakarta", category: "gyms", surface: "overpass", state: "build", cooldown_until: null },
      ],
      hourly: [{ category_slug: "gyms", records_last_hour: 3, records_last_24h: 27, cycles_last_24h: 12 }],
    });
    const slots = await loadWorkforceSnapshot();
    const gym = slots.find((s) => s.job.category_slug === "gyms")!;
    expect(gym.recordsLastHour).toBe(3);
    expect(gym.recordsLast24h).toBe(27);
    expect(gym.cyclesLast24h).toBe(12);
  });

  it("both jobs return snapshot even when only one has data (needs-strategy vs queued)", async () => {
    setState({
      rotation: [
        { city: "Jakarta", category: "gyms", surface: "overpass", state: "build", cooldown_until: null },
      ],
    });
    const slots = await loadWorkforceSnapshot();
    expect(slots).toHaveLength(2);
    expect(slots.find((s) => s.job.category_slug === "gyms")?.status).toBe("queued");
    expect(slots.find((s) => s.job.category_slug === "pharmacies")?.status).toBe("needs-strategy");
  });
});
