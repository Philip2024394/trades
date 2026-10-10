// GET /api/cron/nex-discovery-tick
//
// NEX Fresh World Discovery · 5-minute cron tick.
// Founder-authorised programme · bounded wave 2026-09-21.
//
// Invocable by cron. Runs one bounded discovery cycle against the configured
// adapters. **Zero send.** **Zero raw address exposure.** **Zero AUTO event.**
// Governance canaries are enforced at the DB level (CHECK sends_triggered=0
// AND addresses_exposed=0) and at the module boundary (typed constants 0).

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { runDiscoveryCycle, type CycleAdapter, type ProbeOutcome } from "@/lib/nex/discovery-intel";
import { loadProgrammeBySlug, claimCountry, completeCountryCycle } from "@/lib/nex/discovery-world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Adapter: OSM Overpass (single mirror · already on runtime allowlist) ─
//
// This adapter reuses the same failover-lite pattern as
// `scripts/nex-scaffolding-harvest.mjs`. In this wave it targets the
// canonical `craft=scaffolder` tag. Governance §23: no allowlist expansion.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const USER_AGENT = "NEX-Discovery-Tick/1.0 (+ODbL-attribution-respected)";
const PER_ENDPOINT_TIMEOUT_MS = 15_000;

function buildQuery(term: string, iso: string): string {
  // Primary: craft=scaffolder scoped to country · Secondary: name-contains match
  return `[out:json][timeout:60];area["ISO3166-1"="${iso}"]->.a;(node["craft"="scaffolder"](area.a);node["shop"]["name"~"${term}",i](area.a);node["office"]["name"~"${term}",i](area.a);node["craft"]["name"~"${term}",i](area.a););out center tags 200;`.trim();
}

const overpassAdapter: CycleAdapter = {
  source_id: "osm_overpass",
  async probe({ term, country_iso, deadline_ms }): Promise<ProbeOutcome> {
    const query = buildQuery(term, country_iso);
    const started = Date.now();
    const per_endpoint_deadline = Math.min(PER_ENDPOINT_TIMEOUT_MS, deadline_ms);
    for (const ep of OVERPASS_ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), per_endpoint_deadline);
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.status === 429) continue;
        if (!res.ok) continue;
        const text = await res.text();
        const bytes = Buffer.byteLength(text, "utf8");
        let json: any;
        try { json = JSON.parse(text); } catch { continue; }
        const elements = Array.isArray(json.elements) ? json.elements : [];
        // Aggregate: counts + related-term evidence · never returns addresses
        let email_count = 0;
        const related_map = new Map<string, number>();
        for (const el of elements) {
          const tags = el?.tags ?? {};
          if (tags.email || tags["contact:email"]) email_count += 1;
          const name = String(tags.name ?? "").toLowerCase();
          for (const candidate of ["scaffold hire", "scaffold erection", "scaffold contractor", "scaffold rental", "scaffold supplier", "access scaffolding", "commercial scaffolding", "industrial scaffolding"]) {
            if (name.includes(candidate.split(" ")[0]) && name.includes(candidate.split(" ")[1] ?? candidate)) {
              related_map.set(candidate, (related_map.get(candidate) ?? 0) + 1);
            }
          }
        }
        const related_terms = [...related_map.entries()].map(([term, evidence]) => ({
          term, kind: "commercial_service_of" as const, evidence,
        }));
        return {
          source: "osm_overpass",
          outcome: elements.length > 0 ? "responded" : "responded_zero",
          ms: Date.now() - started,
          bytes,
          note: `endpoint=${ep} elements=${elements.length}`,
          elements_seen: elements.length,
          new_email_count: 0,             // The importer decides new vs existing · we only report we observed potential emails
          existing_email_matched: email_count,
          rejected_email_count: 0,
          newly_classified: 0,
          newly_eligible: 0,
          categories_touched: elements.length > 0 ? ["construction"] : [],
          related_terms,
        };
      } catch (err) {
        clearTimeout(timer);
        // try next endpoint
      }
    }
    return {
      source: "osm_overpass",
      outcome: "unavailable",
      ms: Date.now() - started,
      bytes: null,
      note: "every Overpass mirror unavailable",
      elements_seen: 0, new_email_count: 0, existing_email_matched: 0, rejected_email_count: 0,
      newly_classified: 0, newly_eligible: 0, categories_touched: [], related_terms: [],
    };
  },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? "scaffolding";
  const countriesArg = url.searchParams.get("countries") ?? "GB";
  const countries = countriesArg.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{2}$/.test(s));

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    // Look up the programme so we can update per-country state as real work happens.
    const programme = await loadProgrammeBySlug(client, topic).catch(() => null);
    const worker_id = `cron:${new Date().toISOString()}`;

    // Claim each country BEFORE the cycle runs · this is the ONLY moment
    // the world map shows 'crawling'. If the cycle is skipped or fails
    // fast, the claim expires per ACTIVITY_TTL_SECONDS.
    if (programme) {
      for (const iso of countries) {
        await claimCountry(client, { programme_id: programme.programme_id, iso, cycle_id: `${worker_id}:${iso}`, worker_id }).catch(() => { /* soft · never block cycle */ });
      }
    }

    const report = await runDiscoveryCycle(client, {
      topic, countries, adapters: [overpassAdapter],
      per_probe_deadline_ms: 15_000, cycle_deadline_ms: 60_000,
    });

    // Update per-country state with the real cycle outcome.
    if (programme) {
      // Classify per-country outcome from the source_outcomes attached to the report.
      // Each source_outcome id is `${adapter}:${term}:${country}` — group by country.
      const perCountry = new Map<string, { responded: number; unavailable: number; elements: number; existing: number }>();
      for (const o of report.source_outcomes) {
        const iso = o.source.split(":").pop() ?? "";
        if (!countries.includes(iso)) continue;
        const bucket = perCountry.get(iso) ?? { responded: 0, unavailable: 0, elements: 0, existing: 0 };
        if (o.outcome === "responded" || o.outcome === "responded_zero") bucket.responded += 1;
        else bucket.unavailable += 1;
        bucket.elements += o.elements;
        perCountry.set(iso, bucket);
      }
      for (const iso of countries) {
        const b = perCountry.get(iso) ?? { responded: 0, unavailable: 0, elements: 0, existing: 0 };
        let status: "completed" | "partial" | "zero_results" | "source_unavailable";
        if (b.responded === 0 && b.unavailable > 0) status = "source_unavailable";
        else if (b.responded > 0 && b.unavailable > 0) status = "partial";
        else if (b.elements === 0) status = "zero_results";
        else status = "completed";
        await completeCountryCycle(client, {
          programme_id: programme.programme_id, iso, cycle_id: report.cycle_id, status,
          businesses_discovered: b.elements,
          new_emails: 0,                    // resolved when importer runs · not synchronous
          existing_matched: 0,
          rejected: 0,
          websites_resolved: 0,
          sources_responded: b.responded,
          sources_unavailable: b.unavailable,
        }).catch(() => { /* soft */ });
      }
    }

    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
