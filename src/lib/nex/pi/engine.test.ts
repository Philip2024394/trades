// Engine — permission gate, adapter aggregation, last-mile visible_to
// filter, caching. Registry + supabase mocked so no DB is touched.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./registry", () => {
  const ok = {
    aspect: "photos", label: "Photos", weight: 1.2,
    async run() {
      return {
        aspect: "photos", label: "Photos", sub_score: 80, weight: 1.2,
        metrics: [
          { key: "photos_total", label: "Photos", value: 5, unit: "count", direction: "higher_is_better", evidence: e() },
          { key: "budget_used_pct", label: "Budget used", value: 40, unit: "pct", direction: "lower_is_better", evidence: e(), visible_to: ["homeowner"] }
        ],
        observations: [
          { key: "public_ok", aspect: "photos", severity: "info",    headline: "All fine.",            evidence: e() },
          { key: "money",     aspect: "photos", severity: "warning", headline: "£1,500 outstanding.",  evidence: e(), visible_to: ["homeowner"] }
        ],
        timeline: [
          { at: "2026-07-22T10:00:00Z", event_type: "photo_added",  actor_type: "trade",     actor_name: "Dave", headline: "Photo uploaded",   evidence: e() },
          { at: "2026-07-23T08:00:00Z", event_type: "payment_made", actor_type: "homeowner", actor_name: null,   headline: "Paid £1,200.",     evidence: e(), visible_to: ["homeowner"] }
        ]
      };
    }
  };
  const thrower = {
    aspect: "costs", label: "Costs", weight: 2,
    async run() { throw new Error("boom"); }
  };
  return { ADAPTERS: [ok, thrower] };
});

vi.mock("./permissions", () => ({
  assertAccess: vi.fn(async (_pid: string, viewer: string, viewerId: string) => {
    if (viewerId === "denied") return { ok: false, reason: "not_owner" };
    return { ok: true };
  })
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "p1", title: "Smith extension", status: "in-progress",
              address_city: "Manchester", cover_photo_url: null,
              started_at: null, completed_at: null,
              budget_min_gbp: 30000, budget_max_gbp: 40000, total_spent_gbp: 12000
            }
          })
        })
      })
    })
  }
}));

function e() { return { source: "t", tables: [], computed_at: "x" }; }

import { buildProjectSnapshot, _clearPiCache } from "./engine";

beforeEach(() => _clearPiCache());

describe("buildProjectSnapshot", () => {
  it("returns not_owner when permissions deny", async () => {
    const r = await buildProjectSnapshot({ projectId: "p1", viewer: "homeowner", viewerId: "denied" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_owner");
  });

  it("aggregates adapters + reports thrower as errors", async () => {
    const r = await buildProjectSnapshot({ projectId: "p1", viewer: "homeowner", viewerId: "h1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.errors).toEqual(expect.arrayContaining([expect.objectContaining({ aspect: "costs" })]));
    expect(r.snapshot.health.score).toBeGreaterThan(0);
  });

  it("HOMEOWNER viewer sees homeowner_only metrics + observations + timeline", async () => {
    const r = await buildProjectSnapshot({ projectId: "p1", viewer: "homeowner", viewerId: "h1" });
    if (!r.ok) throw new Error("expected ok");
    const photos = r.snapshot.aspects.find((a) => a.aspect === "photos")!;
    expect(photos.metrics.map((m) => m.key)).toEqual(expect.arrayContaining(["photos_total", "budget_used_pct"]));
    expect(photos.observations.map((o) => o.key)).toEqual(expect.arrayContaining(["public_ok", "money"]));
    expect(photos.timeline.map((t) => t.event_type)).toEqual(expect.arrayContaining(["photo_added", "payment_made"]));
  });

  it("MERCHANT viewer never sees homeowner_only fields", async () => {
    const r = await buildProjectSnapshot({ projectId: "p1", viewer: "merchant", viewerId: "m1" });
    if (!r.ok) throw new Error("expected ok");
    const photos = r.snapshot.aspects.find((a) => a.aspect === "photos")!;
    expect(photos.metrics.map((m) => m.key)).not.toContain("budget_used_pct");
    expect(photos.observations.map((o) => o.key)).not.toContain("money");
    expect(photos.timeline.map((t) => t.event_type)).not.toContain("payment_made");
  });

  it("caches per (project, viewer, hour)", async () => {
    const now = new Date("2026-07-23T09:15:00Z");
    const r1 = await buildProjectSnapshot({ projectId: "p1", viewer: "homeowner", viewerId: "h1", now });
    const r2 = await buildProjectSnapshot({ projectId: "p1", viewer: "homeowner", viewerId: "h1", now });
    if (!r1.ok || !r2.ok) throw new Error();
    expect(r1.snapshot).toBe(r2.snapshot);
  });

  it("homeowner + merchant caches are separate (permission-safe)", async () => {
    const now = new Date("2026-07-23T09:15:00Z");
    const ho = await buildProjectSnapshot({ projectId: "p1", viewer: "homeowner", viewerId: "h1", now });
    const mr = await buildProjectSnapshot({ projectId: "p1", viewer: "merchant",  viewerId: "h1", now });
    if (!ho.ok || !mr.ok) throw new Error();
    expect(ho.snapshot).not.toBe(mr.snapshot);
  });
});
