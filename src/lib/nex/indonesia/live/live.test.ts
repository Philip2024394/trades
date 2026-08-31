// live.test.ts · live-source connector unit coverage.
//
// All tests use MOCKED payloads · no live HTTP anywhere. When the
// user flips NEX_LIVE_SOURCES_ENABLED=1 in production the same
// parser + entity mapping runs against real BMKG / MAGMA payloads.

import { describe, it, expect } from "vitest";
import { httpFetch } from "./http-adapter";
import { createBmkgEarthquakeConnector, parseBmkgEarthquake, parseBmkgTsunami, parseBmkgWeatherStub, classifyTsunamiPotential } from "./bmkg";
import { createMagmaVolcanoConnector, parseMagmaStatuses } from "./magma";

describe("httpFetch · env gating", () => {
  it("returns { error: 'disabled' } when NEX_LIVE_SOURCES_ENABLED is not set", async () => {
    delete process.env.NEX_LIVE_SOURCES_ENABLED;
    const r = await httpFetch("https://example.invalid/x");
    expect("error" in r && r.reason).toBe("disabled");
  });

  it("__forceEnabled bypass allows fetch with injected fetch stub", async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;
    const r = await httpFetch("https://example.invalid/x", { __forceEnabled: true, __fetch: fakeFetch });
    expect("ok" in r && r.ok).toBe(true);
  });

  it("propagates HTTP status error", async () => {
    const fakeFetch = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    const r = await httpFetch("https://example.invalid/x", { __forceEnabled: true, __fetch: fakeFetch, retries: 0 });
    expect("error" in r && r.reason).toBe("http_status");
  });

  it("timeout aborts and returns timeout error", async () => {
    const fakeFetch = ((url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })) as unknown as typeof fetch;
    const r = await httpFetch("https://example.invalid/x", { __forceEnabled: true, __fetch: fakeFetch, timeoutMs: 20, retries: 0 });
    expect("error" in r && r.reason).toBe("timeout");
  });
});

describe("BMKG earthquake · parse + entity mapping", () => {
  const bmkgFixture = {
    Infogempa: {
      gempa: {
        Tanggal: "30 Aug 2026",
        Jam: "12:34:56 WIB",
        DateTime: "2026-08-30T05:34:56+00:00",
        Magnitude: "5.6",
        Kedalaman: "10 km",
        Wilayah: "35 km Barat Daya Denpasar",
        Coordinates: "-8.85,115.05",
        Potensi: "Tidak berpotensi tsunami",
      },
    },
  };

  it("produces one EntityRecord with kind=government, category=safety.earthquake", () => {
    const entities = parseBmkgEarthquake(bmkgFixture);
    expect(entities.length).toBe(1);
    const e = entities[0];
    expect(e.kind).toBe("government");
    expect(e.category).toBe("safety.earthquake");
    expect(e.name).toContain("M5.6");
    expect(e.provenance[0].sourceTier).toBe("A");
    expect(e.freshness.policy).toBe("live");
    expect(e.geo?.lat).toBeCloseTo(-8.85);
  });

  it("connector fetch({ mock }) returns LiveObservation with live=false", async () => {
    const c = createBmkgEarthquakeConnector();
    const r = await c.fetch({ mock: bmkgFixture });
    expect("entities" in r).toBe(true);
    if ("entities" in r) {
      expect(r.entities.length).toBe(1);
      expect(r.live).toBe(false);
    }
  });

  it("connector fetch() without mock and gating disabled returns disabled error", async () => {
    delete process.env.NEX_LIVE_SOURCES_ENABLED;
    const c = createBmkgEarthquakeConnector();
    const r = await c.fetch();
    expect("error" in r && r.reason).toBe("disabled");
  });
});

describe("classifyTsunamiPotential · normalises BMKG Potensi text", () => {
  it("'Tidak berpotensi tsunami' → 'no'", () => {
    expect(classifyTsunamiPotential("Tidak berpotensi tsunami")).toBe("no");
  });
  it("case + whitespace variants of 'tidak berpotensi tsunami' → 'no'", () => {
    expect(classifyTsunamiPotential("  TIDAK BERPOTENSI TSUNAMI  ")).toBe("no");
    expect(classifyTsunamiPotential("Tidak Berpotensi Tsunami .")).toBe("no");
  });
  it("'Berpotensi tsunami' → 'yes'", () => {
    expect(classifyTsunamiPotential("Berpotensi tsunami")).toBe("yes");
    expect(classifyTsunamiPotential("BERPOTENSI TSUNAMI · segera evakuasi")).toBe("yes");
  });
  it("felt-quake message → 'unknown' (not classified as no or yes)", () => {
    expect(classifyTsunamiPotential("Gempa ini dirasakan untuk diteruskan pada masyarakat")).toBe("unknown");
  });
  it("undefined / null / empty / non-string → 'unknown' (never silently 'no')", () => {
    expect(classifyTsunamiPotential(undefined)).toBe("unknown");
    expect(classifyTsunamiPotential(null)).toBe("unknown");
    expect(classifyTsunamiPotential("")).toBe("unknown");
    expect(classifyTsunamiPotential("   ")).toBe("unknown");
    expect(classifyTsunamiPotential(123)).toBe("unknown");
    expect(classifyTsunamiPotential({})).toBe("unknown");
  });
});

describe("parseBmkgEarthquake · surfaces tsunamiPotential alongside raw Potensi", () => {
  const base = { Tanggal: "30 Aug 2026", Jam: "12:34:56 WIB", Magnitude: "5.0", Kedalaman: "10 km", Wilayah: "Bali", Coordinates: "-8.85,115.05" };
  it("Tidak berpotensi tsunami → tsunamiPotential=no, potensi preserved verbatim", () => {
    const e = parseBmkgEarthquake({ Infogempa: { gempa: { ...base, Potensi: "Tidak berpotensi tsunami" } } });
    expect(e[0].attributes?.tsunamiPotential).toBe("no");
    expect(e[0].attributes?.potensi).toBe("Tidak berpotensi tsunami");
  });
  it("Berpotensi tsunami → tsunamiPotential=yes, potensi preserved", () => {
    const e = parseBmkgEarthquake({ Infogempa: { gempa: { ...base, Potensi: "Berpotensi tsunami" } } });
    expect(e[0].attributes?.tsunamiPotential).toBe("yes");
    expect(e[0].attributes?.potensi).toBe("Berpotensi tsunami");
  });
  it("felt-quake wording → tsunamiPotential=unknown", () => {
    const e = parseBmkgEarthquake({ Infogempa: { gempa: { ...base, Potensi: "Gempa ini dirasakan untuk diteruskan pada masyarakat" } } });
    expect(e[0].attributes?.tsunamiPotential).toBe("unknown");
  });
  it("missing Potensi → tsunamiPotential=unknown", () => {
    const e = parseBmkgEarthquake({ Infogempa: { gempa: { ...base } } });
    expect(e[0].attributes?.tsunamiPotential).toBe("unknown");
  });
});

describe("BMKG tsunami · parser", () => {
  it("empty payload → 'no active warning' record", () => {
    const e = parseBmkgTsunami({});
    expect(e[0].name).toMatch(/No active/i);
    expect(e[0].freshness.policy).toBe("live");
  });

  it("payload with gempa → warning record", () => {
    const e = parseBmkgTsunami({ gempa: { Magnitude: "7.5" } });
    expect(e[0].name).toMatch(/warning/i);
    expect(e[0].keywords).toContain("warning");
  });
});

describe("BMKG weather stub", () => {
  it("produces one per-province EntityRecord with hourly policy", () => {
    const now = new Date("2026-08-30T12:00:00Z");
    const e = parseBmkgWeatherStub("<xml>...</xml>", "bali", now);
    expect(e[0].freshness.policy).toBe("hourly");
    expect(e[0].geo?.province).toBe("bali");
    expect(e[0].category).toBe("safety.weather");
  });
});

describe("MAGMA volcano · parser", () => {
  const magmaFixture = [
    { code: "MER", name: "Merapi", status: "SIAGA", lat: -7.54, lon: 110.44, province: "DIY", updated_at: "2026-08-30T00:00Z" },
    { code: "AGN", name: "Agung", status: "NORMAL", lat: -8.34, lon: 115.51, province: "Bali" },
  ];

  it("produces one EntityRecord per volcano with severity-mapped description", () => {
    const entities = parseMagmaStatuses(magmaFixture);
    expect(entities.length).toBe(2);
    const merapi = entities.find((e) => e.name.includes("Merapi"))!;
    expect(merapi.category).toBe("safety.volcano");
    expect(merapi.attributes?.alertLevel).toBe("SIAGA");
    expect(merapi.attributes?.alertSeverity).toBe(3);
    expect(merapi.description).toMatch(/ELEVATED/);
    const agung = entities.find((e) => e.name.includes("Agung"))!;
    expect(agung.attributes?.alertSeverity).toBe(1);
    expect(agung.description).not.toMatch(/ELEVATED/);
  });

  it("connector.fetch({ mock: [] }) returns zero entities without error", async () => {
    const c = createMagmaVolcanoConnector();
    const r = await c.fetch({ mock: [] });
    expect("entities" in r).toBe(true);
    if ("entities" in r) expect(r.entities.length).toBe(0);
  });
});
