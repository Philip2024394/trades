// src/lib/nex/brain/tools/weather.test.ts
//
// Stage 3.35 · Phase E · Weather tool doctrine tests (Philip 2026-08-31).
//
// CONSTITUTIONAL: NEX never fabricates weather.
//
// Locks:
//   · no provider → obtained:false · reason:provider_not_configured
//   · provider unreachable → obtained:false · reason:provider_unavailable
//   · location not extractable → obtained:false · reason:location_not_extractable
//   · location extracted but provider has no data → obtained:false · reason:location_not_supported
//   · provider returns data → obtained:true · replyText cites provider + observedAt
//   · reply text NEVER says a generic "sunny/28°C" when obtained:false

import { describe, expect, it } from "vitest";
import { runWeather } from "./weather";
import type { WeatherProvider, WeatherObservation } from "./weather";

const fakeProvider = (obs: WeatherObservation | null): WeatherProvider => ({
  fetchCurrent: async () => obs,
});

describe("runWeather · honest unavailable states", () => {
  it("no provider wired → obtained:false · provider_not_configured", async () => {
    const r = await runWeather({ message: "what's the weather in Yogyakarta" });
    expect(r.obtained).toBe(false);
    if (!r.obtained) {
      expect(r.reason).toBe("provider_not_configured");
      // Never fabricates a weather answer
      expect(r.message.en).not.toMatch(/\b\d+°C\b/);
      expect(r.message.en.toLowerCase()).toContain("won't guess");
      expect(r.message.id).toContain("tidak akan menebak");
    }
  });

  it("provider throws → obtained:false · provider_unavailable · no fabricated conditions", async () => {
    const flaky: WeatherProvider = { fetchCurrent: async () => { throw new Error("network"); } };
    const r = await runWeather({ message: "what's the weather in Yogyakarta", provider: flaky });
    expect(r.obtained).toBe(false);
    if (!r.obtained) {
      expect(r.reason).toBe("provider_unavailable");
      expect(r.message.en).not.toMatch(/\b\d+°C\b/);
    }
  });

  it("provider returns null for a location → obtained:false · location_not_supported", async () => {
    const r = await runWeather({ message: "weather in Yogyakarta", provider: fakeProvider(null) });
    expect(r.obtained).toBe(false);
    if (!r.obtained) expect(r.reason).toBe("location_not_supported");
  });

  it("no location extractable → obtained:false · location_not_extractable", async () => {
    const r = await runWeather({ message: "what's the weather", provider: fakeProvider(null) });
    expect(r.obtained).toBe(false);
    if (!r.obtained) expect(r.reason).toBe("location_not_extractable");
  });
});

describe("runWeather · location extraction", () => {
  it("'weather in Yogyakarta' resolves to Yogyakarta", async () => {
    const provider = fakeProvider({
      temperatureC: 28, conditionSummary: "sunny", observedAt: "2026-08-31T10:00:00Z", provider: "test",
    });
    const r = await runWeather({ message: "weather in Yogyakarta", provider });
    expect(r.obtained).toBe(true);
    if (r.obtained) expect(r.location.city).toBe("Yogyakarta");
  });

  it("'cuaca di jogja' resolves to Yogyakarta (ID)", async () => {
    const provider = fakeProvider({
      temperatureC: 28, conditionSummary: "cerah", observedAt: "2026-08-31T10:00:00Z", provider: "test",
    });
    const r = await runWeather({ message: "cuaca di jogja", provider });
    if (r.obtained) expect(r.location.city).toBe("Yogyakarta");
  });

  it("bali → Denpasar · jakarta → Jakarta · bandung → Bandung", async () => {
    const provider = fakeProvider({
      temperatureC: 30, conditionSummary: "clear", observedAt: "2026-08-31T10:00:00Z", provider: "test",
    });
    const rBali = await runWeather({ message: "weather in bali", provider });
    if (rBali.obtained) expect(rBali.location.city).toBe("Denpasar");
    const rJkt = await runWeather({ message: "weather in jakarta", provider });
    if (rJkt.obtained) expect(rJkt.location.city).toBe("Jakarta");
    const rBdg = await runWeather({ message: "weather in bandung", provider });
    if (rBdg.obtained) expect(rBdg.location.city).toBe("Bandung");
  });
});

describe("runWeather · successful path · provenance cited", () => {
  it("reply cites provider + observedAt so downstream can verify", async () => {
    const provider = fakeProvider({
      temperatureC: 27,
      conditionSummary: "partly cloudy",
      observedAt: "2026-08-31T10:00:00Z",
      provider: "bmkg",
    });
    const r = await runWeather({ message: "weather in Yogyakarta", provider });
    expect(r.obtained).toBe(true);
    if (r.obtained) {
      expect(r.replyText.en).toContain("27°C");
      expect(r.replyText.en).toContain("partly cloudy");
      expect(r.replyText.en).toContain("bmkg");
      expect(r.replyText.en).toContain("2026-08-31T10:00:00Z");
    }
  });
});
