// src/lib/nex-hq/city-workforce-status.test.ts

import { describe, it, expect } from "vitest";
import { aggregateCityStatus, aggregateStatusesByCity, buildCityWorkforceDetails } from "./city-workforce-status";
import type { WorkforceStatus } from "./workforce-status";

describe("aggregateCityStatus · precedence ladder", () => {
  it("returns unavailable for empty input (never fake activity)", () => {
    expect(aggregateCityStatus([])).toBe("unavailable");
  });

  it("WORKING beats every other status", () => {
    const cases: WorkforceStatus[][] = [
      ["working"],
      ["working", "idle"],
      ["working", "error"],
      ["saturated", "working", "queued"],
      ["unavailable", "unavailable", "working"],
    ];
    for (const c of cases) expect(aggregateCityStatus(c)).toBe("working");
  });

  it("QUEUED beats ERROR/WAITING/SATURATED/IDLE/UNAVAILABLE", () => {
    expect(aggregateCityStatus(["error", "queued"])).toBe("queued");
    expect(aggregateCityStatus(["saturated", "queued"])).toBe("queued");
    expect(aggregateCityStatus(["idle", "queued"])).toBe("queued");
  });

  it("ERROR beats WAITING/SATURATED/IDLE/UNAVAILABLE (attention priority)", () => {
    expect(aggregateCityStatus(["waiting", "error"])).toBe("error");
    expect(aggregateCityStatus(["saturated", "error"])).toBe("error");
    expect(aggregateCityStatus(["idle", "error"])).toBe("error");
    expect(aggregateCityStatus(["unavailable", "error"])).toBe("error");
  });

  it("WAITING beats SATURATED/IDLE/UNAVAILABLE", () => {
    expect(aggregateCityStatus(["saturated", "waiting"])).toBe("waiting");
    expect(aggregateCityStatus(["idle", "waiting"])).toBe("waiting");
  });

  it("SATURATED beats IDLE/UNAVAILABLE (never becomes 'finished forever')", () => {
    expect(aggregateCityStatus(["idle", "saturated"])).toBe("saturated");
    expect(aggregateCityStatus(["unavailable", "saturated"])).toBe("saturated");
  });

  it("IDLE beats UNAVAILABLE", () => {
    expect(aggregateCityStatus(["unavailable", "idle"])).toBe("idle");
  });

  it("all-UNAVAILABLE stays UNAVAILABLE (honest)", () => {
    expect(aggregateCityStatus(["unavailable", "unavailable", "unavailable"])).toBe("unavailable");
  });
});

describe("aggregateStatusesByCity", () => {
  it("groups by city and applies aggregate precedence", () => {
    const rows = [
      { city: "Yogyakarta", status: "working" as const },
      { city: "Yogyakarta", status: "saturated" as const },
      { city: "Sleman",     status: "idle" as const },
      { city: "Sleman",     status: "error" as const },
      { city: "Bantul",     status: "unavailable" as const },
    ];
    const map = aggregateStatusesByCity(rows);
    expect(map.get("Yogyakarta")).toBe("working");   // working beats saturated
    expect(map.get("Sleman")).toBe("error");         // error beats idle
    expect(map.get("Bantul")).toBe("unavailable");
  });

  it("returns empty map for empty input", () => {
    expect(aggregateStatusesByCity([]).size).toBe(0);
  });
});

describe("buildCityWorkforceDetails · preserves per-category detail for drill-down", () => {
  it("groups per-category detail while computing aggregate", () => {
    const rows = [
      { city: "Yogyakarta", category: "food",          status: "saturated" as const },
      { city: "Yogyakarta", category: "accommodation", status: "saturated" as const },
      { city: "Yogyakarta", category: "market",        status: "working"   as const },
      { city: "Yogyakarta", category: "transport",     status: "idle"      as const },
    ];
    const details = buildCityWorkforceDetails(rows);
    expect(details.length).toBe(1);
    const yog = details[0];
    expect(yog.city).toBe("Yogyakarta");
    expect(yog.aggregate).toBe("working");   // working from market wins
    expect(yog.perCategory.length).toBe(4);
    expect(yog.perCategory.find((p) => p.category === "market")?.status).toBe("working");
    expect(yog.perCategory.find((p) => p.category === "food")?.status).toBe("saturated");
  });

  it("returns one detail entry per city · aggregates within each city only", () => {
    const rows = [
      { city: "Yogyakarta", category: "market", status: "working"    as const },
      { city: "Sleman",     category: "food",   status: "saturated"  as const },
    ];
    const details = buildCityWorkforceDetails(rows);
    expect(details.length).toBe(2);
    expect(details.find((d) => d.city === "Yogyakarta")?.aggregate).toBe("working");
    expect(details.find((d) => d.city === "Sleman")?.aggregate).toBe("saturated");
  });
});
