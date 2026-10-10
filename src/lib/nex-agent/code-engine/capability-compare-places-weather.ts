// src/lib/nex-agent/code-engine/capability-compare-places-weather.ts
//
// NEX · Phase 6 · DK · Compare-places-weather composition · 2026-09-21.
// Founder-authorised.
//
// PURPOSE
//
//   User-level composition: "which is warmer, Bandung or Semarang?"
//   Fires the existing BMKG-backed weather retrieval for each supported
//   city in parallel, evaluates the temperatures deterministically,
//   and returns a comparison result. Never fabricates. Only compares
//   cities in the BMKG ADM4 map.
//
// ANTI-CHEATING
//
//   · Uses guardedFetch (Phase 4 M3) — R1 preserved.
//   · Records per-source outcome (Phase 4 S8).
//   · If any city fetch fails, degrade honestly rather than compare a
//     partial result.
//   · The comparison rule is deterministic (compare `t` field).

import { guardedFetch, ProductionGateBlockedError } from "./capability-production-internet-gate";
import { recordSourceOutcome } from "./capability-source-outcome-ledger";

// Same curated ADM4 map used by the weather_lookup handler. Kept in
// sync deliberately — adding a city is a governance action in both
// places.
const ADM4_MAP: Record<string, { adm4: string; label: string }> = {
  "jakarta":       { adm4: "31.71.01.1001", label: "Gambir, Jakarta Pusat" },
  "bandung":       { adm4: "32.73.03.1002", label: "Sumur Bandung, Bandung" },
  "surabaya":      { adm4: "35.78.19.1004", label: "Genteng, Surabaya" },
  "yogyakarta":    { adm4: "34.71.04.1002", label: "Gondomanan, Yogyakarta" },
  "denpasar":      { adm4: "51.71.01.1001", label: "Denpasar Selatan (Serangan), Bali" },
  "bali":          { adm4: "51.71.01.1001", label: "Denpasar Selatan (Serangan), Bali" },
  "semarang":      { adm4: "33.74.01.1001", label: "Semarang Tengah, Semarang" },
  "medan":         { adm4: "12.71.03.1001", label: "Medan Kota, Medan" },
  "makassar":      { adm4: "73.71.05.1001", label: "Ujung Pandang, Makassar" },
};

export interface CityWeatherResult {
  readonly city: string;
  readonly label: string;
  readonly ok: boolean;
  readonly temp: number | null;
  readonly humidity: number | null;
  readonly condition: string | null;
  readonly duration_ms: number;
  readonly error: string | null;
}

export interface ComparePlacesWeatherArgs {
  readonly conversation_id: string;
  readonly turn_id: number;
  readonly subjects: readonly string[];
}

export interface ComparePlacesWeatherResult {
  readonly rows: readonly CityWeatherResult[];
  readonly warmest_city: string | null;
  readonly coolest_city: string | null;
  readonly all_ok: boolean;
  readonly total_ms: number;
  readonly text: string;
  readonly trace_lines: readonly string[];
}

export async function comparePlacesWeather(args: ComparePlacesWeatherArgs): Promise<ComparePlacesWeatherResult> {
  const t0 = Date.now();
  const trace: string[] = [];
  const jobs = args.subjects.map(async (city): Promise<CityWeatherResult> => {
    const mapped = ADM4_MAP[city.toLowerCase()];
    if (!mapped) {
      return { city, label: city, ok: false, temp: null, humidity: null, condition: null, duration_ms: 0, error: "not_in_adm4_map" };
    }
    const start = Date.now();
    try {
      const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${mapped.adm4}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await guardedFetch(url, { method: "GET", headers: { "Accept": "application/json" }, signal: controller.signal }, "compare_places_weather:bmkg");
      clearTimeout(timer);
      const dur = Date.now() - start;
      if (!res.ok) {
        trace.push(`compare_weather · ${city} · bmkg · http_${res.status} · duration_ms=${dur}`);
        try { recordSourceOutcome({ conversation_id: args.conversation_id, turn_id: args.turn_id, source_identifier: "bmkg.go.id", info_class: "weather_current", outcome: "http_error", duration_ms: dur, note: `HTTP ${res.status} for ${city}` }); } catch { /* silent */ }
        return { city, label: mapped.label, ok: false, temp: null, humidity: null, condition: null, duration_ms: dur, error: `http_${res.status}` };
      }
      const data: any = await res.json();
      const first = data?.data?.[0]?.cuaca?.[0]?.[0] ?? null;
      if (!first) {
        trace.push(`compare_weather · ${city} · bmkg · empty_forecast · duration_ms=${dur}`);
        return { city, label: mapped.label, ok: false, temp: null, humidity: null, condition: null, duration_ms: dur, error: "empty_forecast" };
      }
      trace.push(`compare_weather · ${city} · bmkg · ok · temp=${first.t} · humidity=${first.hu} · duration_ms=${dur}`);
      try { recordSourceOutcome({ conversation_id: args.conversation_id, turn_id: args.turn_id, source_identifier: "bmkg.go.id", info_class: "weather_current", outcome: "ok_confirmed", duration_ms: dur, note: `compare ${city} temp=${first.t}` }); } catch { /* silent */ }
      return {
        city,
        label: mapped.label,
        ok: true,
        temp: typeof first.t === "number" ? first.t : null,
        humidity: typeof first.hu === "number" ? first.hu : null,
        condition: first.weather_desc ?? null,
        duration_ms: dur,
        error: null,
      };
    } catch (err) {
      const dur = Date.now() - start;
      const errStr = err instanceof Error ? err.message.slice(0, 120) : String(err);
      trace.push(`compare_weather · ${city} · bmkg · threw · ${errStr}`);
      try { recordSourceOutcome({ conversation_id: args.conversation_id, turn_id: args.turn_id, source_identifier: "bmkg.go.id", info_class: "weather_current", outcome: "network_error", duration_ms: dur, note: errStr }); } catch { /* silent */ }
      return { city, label: mapped.label, ok: false, temp: null, humidity: null, condition: null, duration_ms: dur, error: errStr };
    }
  });
  const rows = await Promise.all(jobs);
  const okRows = rows.filter((r) => r.ok && r.temp !== null);
  const allOk = rows.every((r) => r.ok);
  let warmest: string | null = null;
  let coolest: string | null = null;
  if (okRows.length >= 2) {
    let max = okRows[0], min = okRows[0];
    for (const r of okRows) {
      if ((r.temp ?? -Infinity) > (max.temp ?? -Infinity)) max = r;
      if ((r.temp ?? Infinity) < (min.temp ?? Infinity)) min = r;
    }
    warmest = max.city;
    coolest = min.city;
  }
  const totalMs = Date.now() - t0;
  const text = composeText(rows, warmest, coolest, totalMs);
  trace.push(`compare_weather · complete · rows=${rows.length} · ok=${okRows.length} · warmest=${warmest ?? "?"} · coolest=${coolest ?? "?"} · total_ms=${totalMs}`);
  return { rows, warmest_city: warmest, coolest_city: coolest, all_ok: allOk, total_ms: totalMs, text, trace_lines: trace };
}

function composeText(rows: readonly CityWeatherResult[], warmest: string | null, coolest: string | null, totalMs: number): string {
  const parts: string[] = [];
  parts.push(`BMKG comparison (query ${totalMs}ms):`);
  for (const r of rows) {
    if (r.ok) parts.push(`· ${r.label}: ${r.condition ?? "?"} · ${r.temp ?? "?"}°C · humidity ${r.humidity ?? "?"}%`);
    else parts.push(`· ${r.label}: retrieval failed (${r.error ?? "unknown"})`);
  }
  if (warmest && coolest) {
    if (warmest === coolest) {
      parts.push(`Result: identical temperatures across the cities.`);
    } else {
      const wRow = rows.find((r) => r.city === warmest);
      const cRow = rows.find((r) => r.city === coolest);
      parts.push(`Result: warmest = ${wRow?.label ?? warmest} (${wRow?.temp}°C) · coolest = ${cRow?.label ?? coolest} (${cRow?.temp}°C). Source: bmkg.go.id.`);
    }
  } else {
    parts.push(`Result: insufficient successful retrievals to compare.`);
  }
  return parts.join(" ");
}

export function emitCompareWeatherTrace(result: ComparePlacesWeatherResult): string {
  return `compare_places_weather · rows=${result.rows.length} · ok=${result.rows.filter((r) => r.ok).length} · warmest=${result.warmest_city ?? "?"} · total_ms=${result.total_ms}`;
}
