// src/lib/nex/aof/agents/discovery-agent.ts
//
// NEX Autonomous Operations Framework · Discovery Agent
// Founder-authorised programme · 2026-09-22.
//
// Wraps the existing harvest primitives (source_probe + business_candidate
// + walk-job enqueue) into a governed agent action. Delegates to
// executeSourceProbe (Overpass path) or performs an equivalent Nominatim
// discovery pass (adapters return raw elements, agent maps to candidates
// deterministically via extractNominatimCandidate · zero fabrication).

import type { PgClient, PgClient as C } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";
import { updateCycleCounters } from "../cycle";
import type { AdapterRegistry } from "../adapters/registry";
import { extractNominatimCandidate } from "../adapters/nominatim-adapter";
import { extractWikidataCandidate } from "../adapters/wikidata-adapter";
import { lookupExistingCandidate, recordRediscovery } from "../dedup";
import { insertBusinessCandidate, enqueueJob } from "@/lib/nex/harvest";

export interface DiscoveryAgentDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly adapters: AdapterRegistry;
  readonly programme_id: string;
}

export interface DiscoverInput {
  readonly source_slug: string;
  readonly country_iso: string;
  readonly term: string;
  readonly cycle_id: string;
  readonly max_results?: number;
}

export interface DiscoverOutcome {
  readonly kind: "ok" | "source_unavailable" | "rate_limited" | "parse_error" | "adapter_missing" | "adapter_dormant" | "zero_results";
  readonly source_slug: string;
  readonly candidates_inserted: number;
  readonly candidates_duplicate: number;               // same source · same external_ref
  readonly cross_source_rediscoveries: number;         // Wave F · match by canonical_website or country+name from another source
  readonly walks_enqueued: number;
  readonly direct_osm_emails: number;
  readonly note: string | null;
  readonly bytes: number;
  readonly ms: number;
}

export async function discover(deps: DiscoveryAgentDeps, input: DiscoverInput): Promise<DiscoverOutcome> {
  await requireCapability(deps.client, deps.agent_id, "source_probe");
  const entry = deps.adapters.get(input.source_slug);
  if (!entry) {
    await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: "error", cycle_id: input.cycle_id,
      payload: { op: "discover", reason: "adapter_missing", source_slug: input.source_slug } });
    return { kind: "adapter_missing", source_slug: input.source_slug, candidates_inserted: 0, candidates_duplicate: 0, walks_enqueued: 0, direct_osm_emails: 0, note: "no adapter registered", bytes: 0, ms: 0 };
  }

  if (entry.kind === "nominatim") {
    const nom = entry.adapter as any;
    const t0 = Date.now();
    const res = await nom.search({ term: input.term, country_iso: input.country_iso, limit: input.max_results ?? 30 });
    const ms = Date.now() - t0;
    if (res.kind !== "responded") {
      const outcomeKind: DiscoverOutcome["kind"] =
        res.kind === "responded_zero" ? "zero_results"
        : res.kind === "rate_limited" ? "rate_limited"
        : res.kind === "parse_error" ? "parse_error"
        : res.kind === "not_authorised" ? "adapter_dormant"
        : "source_unavailable";
      await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: outcomeKind === "zero_results" ? "decision" : "error",
        cycle_id: input.cycle_id, payload: { op: "discover", source_slug: input.source_slug, adapter: "nominatim", country_iso: input.country_iso, term: input.term, kind: outcomeKind, note: res.note } });
      return { kind: outcomeKind, source_slug: input.source_slug, candidates_inserted: 0, candidates_duplicate: 0, cross_source_rediscoveries: 0, walks_enqueued: 0, direct_osm_emails: 0, note: res.note, bytes: res.bytes, ms };
    }
    let inserted = 0, dup = 0, enq = 0, directEmails = 0, crossRedisc = 0;
    for (const el of res.elements) {
      const cand = extractNominatimCandidate(el);
      if (!cand) continue;
      // Cross-source dedup · check identity across sources before inserting
      const existing = await lookupExistingCandidate(deps.client, {
        country_iso: input.country_iso, business_name: cand.business_name, website_url: cand.website_url,
      });
      if (existing.existing_candidate_id && existing.existing_source_slug && existing.existing_source_slug !== input.source_slug) {
        await recordRediscovery(deps.client, {
          agent_id: deps.agent_id, cycle_id: input.cycle_id,
          existing_candidate_id: existing.existing_candidate_id, existing_source_slug: existing.existing_source_slug,
          new_source_slug: input.source_slug, new_external_ref: cand.external_ref,
          matched_on: existing.matched_on!, country_iso: input.country_iso,
          business_name: cand.business_name, website_url: cand.website_url,
        });
        crossRedisc++;
        continue;
      }
      const out = await insertBusinessCandidate(deps.client, {
        source_slug: input.source_slug,
        source_probe_job_id: null,
        programme_id: deps.programme_id,
        country_iso: input.country_iso,
        term: input.term,
        external_ref: cand.external_ref,
        business_name: cand.business_name,
        website_url: cand.website_url,
        phone: cand.phone,
        address: cand.address,
        latitude: cand.latitude,
        longitude: cand.longitude,
        raw_tags: cand.raw_tags,
        provenance_url: `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input.term)}&countrycodes=${input.country_iso.toLowerCase()}`,
        provenance_note: `nominatim search · countrycodes=${input.country_iso.toLowerCase()} · q=${input.term}`,
      } as any);
      if (out.kind === "inserted") inserted++;
      else if (out.kind === "duplicate") dup++;
      if (cand.direct_email_from_osm) directEmails++;
      if (out.kind === "inserted" && cand.website_url && (out as any).candidate) {
        const canonical = safeHost(cand.website_url);
        const walkKey = `aof:${input.cycle_id}:walk:${(out as any).candidate.candidate_id}`;
        const walk = await enqueueJob(deps.client, {
          job_type: "website_walk", idempotency_key: walkKey,
          programme_id: deps.programme_id, country_iso: input.country_iso,
          source_id: input.source_slug, priority: 150,
          payload: {
            candidate_id: (out as any).candidate.candidate_id, website_url: cand.website_url,
            business_name: cand.business_name, canonical_website: canonical,
            country_iso: input.country_iso, discovered_from_source_slug: input.source_slug,
            aof_cycle_id: input.cycle_id,
          },
        });
        if (walk.kind === "enqueued") enq++;
      }
    }
    await updateCycleCounters(deps.client, {
      cycle_id: input.cycle_id, countries_touched: [input.country_iso],
      sources_attempted: [input.source_slug], sources_succeeded: [input.source_slug],
      candidates_added_delta: inserted,
    });
    await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: "decision", cycle_id: input.cycle_id,
      payload: { op: "discover", source_slug: input.source_slug, adapter: "nominatim", country_iso: input.country_iso, term: input.term,
                 inserted, duplicate: dup, cross_source_rediscoveries: crossRedisc, walks_enqueued: enq, direct_osm_emails: directEmails } });
    return { kind: "ok", source_slug: input.source_slug, candidates_inserted: inserted, candidates_duplicate: dup, cross_source_rediscoveries: crossRedisc, walks_enqueued: enq, direct_osm_emails: directEmails, note: null, bytes: res.bytes, ms };
  }

  if (entry.kind === "wikidata") {
    const wd = entry.adapter as any;
    const t0 = Date.now();
    const res = await wd.search({ country_iso: input.country_iso, domain: "scaffolding", limit: input.max_results ?? 30 });
    const ms = Date.now() - t0;
    if (res.kind !== "responded") {
      const outcomeKind: DiscoverOutcome["kind"] =
        res.kind === "responded_zero" ? "zero_results"
        : res.kind === "rate_limited" ? "rate_limited"
        : res.kind === "parse_error" ? "parse_error"
        : res.kind === "not_authorised" ? "adapter_dormant"
        : "source_unavailable";
      await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: outcomeKind === "zero_results" ? "decision" : "error",
        cycle_id: input.cycle_id, payload: { op: "discover", source_slug: input.source_slug, adapter: "wikidata", country_iso: input.country_iso, term: input.term, kind: outcomeKind, note: res.note } });
      return { kind: outcomeKind, source_slug: input.source_slug, candidates_inserted: 0, candidates_duplicate: 0, cross_source_rediscoveries: 0, walks_enqueued: 0, direct_osm_emails: 0, note: res.note, bytes: res.bytes, ms };
    }
    let inserted = 0, dup = 0, enq = 0, crossRedisc = 0;
    for (const b of res.bindings) {
      const cand = extractWikidataCandidate(b);
      if (!cand) continue;
      // Cross-source dedup · Wikidata Q-ID businesses may already exist from Nominatim discovery
      const existing = await lookupExistingCandidate(deps.client, {
        country_iso: input.country_iso, business_name: cand.business_name, website_url: cand.website_url,
      });
      if (existing.existing_candidate_id && existing.existing_source_slug && existing.existing_source_slug !== input.source_slug) {
        await recordRediscovery(deps.client, {
          agent_id: deps.agent_id, cycle_id: input.cycle_id,
          existing_candidate_id: existing.existing_candidate_id, existing_source_slug: existing.existing_source_slug,
          new_source_slug: input.source_slug, new_external_ref: cand.external_ref,
          matched_on: existing.matched_on!, country_iso: input.country_iso,
          business_name: cand.business_name, website_url: cand.website_url,
        });
        crossRedisc++;
        continue;
      }
      const out = await insertBusinessCandidate(deps.client, {
        source_slug: input.source_slug, source_probe_job_id: null,
        programme_id: deps.programme_id, country_iso: input.country_iso, term: input.term,
        external_ref: cand.external_ref, business_name: cand.business_name,
        website_url: cand.website_url, phone: cand.phone, address: cand.address,
        latitude: cand.latitude, longitude: cand.longitude, raw_tags: cand.raw_tags,
        provenance_url: `https://www.wikidata.org/wiki/${cand.external_ref}`,
        provenance_note: `wikidata sparql · scaffolding domain · ${input.country_iso}`,
      } as any);
      if (out.kind === "inserted") inserted++;
      else if (out.kind === "duplicate") dup++;
      if (out.kind === "inserted" && cand.website_url && (out as any).candidate) {
        const canonical = safeHost(cand.website_url);
        const walkKey = `aof:${input.cycle_id}:walk:${(out as any).candidate.candidate_id}`;
        const walk = await enqueueJob(deps.client, {
          job_type: "website_walk", idempotency_key: walkKey,
          programme_id: deps.programme_id, country_iso: input.country_iso,
          source_id: input.source_slug, priority: 160,
          payload: {
            candidate_id: (out as any).candidate.candidate_id, website_url: cand.website_url,
            business_name: cand.business_name, canonical_website: canonical,
            country_iso: input.country_iso, discovered_from_source_slug: input.source_slug,
            aof_cycle_id: input.cycle_id, wikidata_qid: cand.external_ref,
          },
        });
        if (walk.kind === "enqueued") enq++;
      }
    }
    await updateCycleCounters(deps.client, {
      cycle_id: input.cycle_id, countries_touched: [input.country_iso],
      sources_attempted: [input.source_slug], sources_succeeded: [input.source_slug],
      candidates_added_delta: inserted,
    });
    await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: "decision", cycle_id: input.cycle_id,
      payload: { op: "discover", source_slug: input.source_slug, adapter: "wikidata", country_iso: input.country_iso, term: input.term,
                 inserted, duplicate: dup, cross_source_rediscoveries: crossRedisc, walks_enqueued: enq } });
    return { kind: "ok", source_slug: input.source_slug, candidates_inserted: inserted, candidates_duplicate: dup, cross_source_rediscoveries: crossRedisc, walks_enqueued: enq, direct_osm_emails: 0, note: null, bytes: res.bytes, ms };
  }

  // Overpass path (Wave F adds Kumi mirror · reachability tested by Wave F runner)
  await logAgentEvent(deps.client, { agent_id: deps.agent_id, event_kind: "decision", cycle_id: input.cycle_id,
    payload: { op: "discover", source_slug: input.source_slug, adapter: "overpass", note: "delegated_to_source_probe_executor_via_queue" } });
  return { kind: "adapter_dormant", source_slug: input.source_slug, candidates_inserted: 0, candidates_duplicate: 0, cross_source_rediscoveries: 0, walks_enqueued: 0, direct_osm_emails: 0, note: "overpass path handled by H3 executor · not duplicated by discovery agent", bytes: 0, ms: 0 };
}

function safeHost(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
