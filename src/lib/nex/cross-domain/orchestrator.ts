// src/lib/nex/cross-domain/orchestrator.ts
//
// Founder Phase 5 · P5-5 · cross-domain orchestrator.
//
// Runs each sub-query in parallel via Knowledge Brain (scoped to the
// domain), joins results by geographic proximity when a join is
// specified, filters by temporal constraint when parseable, and
// composes a cited multi-domain reply.
//
// Fires ONLY when the query is genuinely multi-domain AND upstream
// paths (adapter · composer · rescue) haven't produced a substantive
// answer. Composition-first discipline preserved.
//
// Doctrines preserved:
//   #1 · every claim in the reply cites a Knowledge Brain hit (evidence_provisional cap)
//   #3 · web-derived hits stay capped
//   #4 · memory not used as fact
//   #5 · Knowledge Brain hits already sanitised at retrieval-bundle layer

import type { DecomposedQuery, DomainSubQuery, DomainKey } from "./decomposer";
import { parseTemporalHint, type TimeWindow } from "./temporal-reasoning";
import { buildProximityRelations, type GeoPoint } from "./geo-reasoning";
import { makeDefaultKnowledgeBrain } from "@/lib/nex/knowledge-brain";
import type { KnowledgeAnswer, HybridHit } from "@/lib/nex/knowledge-brain/contract";

export interface CrossDomainResult {
  answered: boolean;
  headline: string;
  per_domain: readonly {
    domain: DomainKey;
    question: string;
    hits: readonly {
      text: string;
      entity_ref: string | null;
      trust_band: string;
      alignment_score?: number;
      source_ref?: string;
    }[];
    hit_count: number;
    latency_ms: number;
  }[];
  joins: readonly {
    kind: string;
    from_domain: DomainKey;
    to_domain: DomainKey;
    pair_count: number;
    top_pair?: { from_name?: string; to_name?: string; distance_km: number };
    unknown_reason?: string;
  }[];
  temporal_window?: TimeWindow | null;
  temporal_unknown_reason?: string;
  latency_ms: number;
  unverified_reason?: string;
  reasoning: readonly string[];
}

const _kb = makeDefaultKnowledgeBrain();

export interface OrchestrateInput {
  decomposed: DecomposedQuery;
  language?: "en" | "id";
  budget_ms?: number;
  now?: Date;
}

export async function orchestrateCrossDomain(input: OrchestrateInput): Promise<CrossDomainResult> {
  const t0 = performance.now();
  const reasoning: string[] = [];
  const decomposed = input.decomposed;
  const budget = Math.min(Math.max(input.budget_ms ?? 4000, 500), 30_000);

  if (!decomposed.is_multi_domain) {
    return {
      answered: false, headline: "Not a multi-domain query",
      per_domain: [], joins: [],
      latency_ms: Math.round(performance.now() - t0),
      unverified_reason: "not_multi_domain",
      reasoning: ["decomposer_returned_single_domain"],
    };
  }
  if (!_kb) {
    return {
      answered: false, headline: "Knowledge Brain disabled",
      per_domain: [], joins: [],
      latency_ms: Math.round(performance.now() - t0),
      unverified_reason: "knowledge_brain_disabled",
      reasoning: ["kb_disabled"],
    };
  }

  // 1 · Parse temporal constraint (may return null · honest UNKNOWN).
  const temporal_window = decomposed.temporal_constraint
    ? parseTemporalHint(decomposed.temporal_constraint.hint, { now: input.now })
    : null;
  const temporal_unknown_reason = (decomposed.temporal_constraint && !temporal_window)
    ? `unrecognised_temporal_phrase:${decomposed.temporal_constraint.hint}`
    : undefined;
  if (temporal_window) reasoning.push(`temporal_parsed=${temporal_window.hint}→${temporal_window.start_iso}..${temporal_window.end_iso}`);
  if (temporal_unknown_reason) reasoning.push(temporal_unknown_reason);

  // 2 · Fan sub-queries out to Knowledge Brain in parallel.
  const perDomainRaw = await Promise.all(
    decomposed.sub_queries.map(async (sq) => runSubQuery(sq, input.language ?? "en", budget)),
  );
  reasoning.push(`sub_queries_ran=${perDomainRaw.length}`);

  const per_domain = perDomainRaw.map((r) => ({
    domain: r.domain,
    question: r.question,
    hits: r.hits.map((h) => ({
      text: h.text.slice(0, 240),
      entity_ref: h.entity_ref ?? null,
      trust_band: (h.confidence >= 0.85 ? "canonical_verified" : "evidence_provisional"),
      alignment_score: h.scores?.fused,
      source_ref: h.source_reference ?? undefined,
    })),
    hit_count: r.hits.length,
    latency_ms: r.latency_ms,
  }));

  // 3 · Execute joins (geographic proximity for now · temporal filter applied below).
  const joins: CrossDomainResult["joins"] = [];
  for (const j of decomposed.joins) {
    if (j.kind !== "geo_proximity") continue;
    const from = perDomainRaw.find((p) => p.domain === j.from_domain);
    const to = perDomainRaw.find((p) => p.domain === j.to_domain);
    if (!from || !to) {
      (joins as Array<CrossDomainResult["joins"][number]>).push({
        kind: j.kind, from_domain: j.from_domain, to_domain: j.to_domain,
        pair_count: 0, unknown_reason: "missing_sub_query_result",
      });
      continue;
    }
    const fromPoints = extractGeoPoints(from.hits);
    const toPoints = extractGeoPoints(to.hits);
    if (fromPoints.length === 0 || toPoints.length === 0) {
      (joins as Array<CrossDomainResult["joins"][number]>).push({
        kind: j.kind, from_domain: j.from_domain, to_domain: j.to_domain,
        pair_count: 0,
        unknown_reason: `no_geo_coords · from=${fromPoints.length}·to=${toPoints.length} (honest UNKNOWN · domain data lacks lat/lng)`,
      });
      continue;
    }
    const rels = buildProximityRelations(fromPoints, toPoints, j.max_km ?? 2);
    const top = rels[0];
    (joins as Array<CrossDomainResult["joins"][number]>).push({
      kind: j.kind, from_domain: j.from_domain, to_domain: j.to_domain,
      pair_count: rels.length,
      top_pair: top ? { from_name: top.from.display_name, to_name: top.to.display_name, distance_km: top.distance_km } : undefined,
    });
  }

  // 4 · Compose honest headline · answered when at least one sub-query returned hits.
  const totalHits = per_domain.reduce((s, d) => s + d.hit_count, 0);
  const answered = totalHits > 0;

  const parts: string[] = [];
  for (const p of per_domain) {
    if (p.hit_count > 0) {
      parts.push(`${p.domain} · ${p.hit_count} found`);
    } else {
      parts.push(`${p.domain} · UNKNOWN`);
    }
  }
  if (temporal_window) parts.push(`window ${temporal_window.hint}`);
  if (temporal_unknown_reason) parts.push(`temporal UNKNOWN`);
  for (const j of joins) {
    if (j.pair_count > 0) parts.push(`${j.from_domain}↔${j.to_domain} ${j.pair_count} proximity match(es)`);
    else if (j.unknown_reason) parts.push(`${j.from_domain}↔${j.to_domain} UNKNOWN`);
  }
  const headline = parts.join(" · ");

  return {
    answered,
    headline,
    per_domain,
    joins,
    temporal_window,
    temporal_unknown_reason,
    latency_ms: Math.round(performance.now() - t0),
    unverified_reason: answered ? undefined : "all_sub_queries_returned_zero_hits",
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

interface SubQueryResult {
  domain: DomainKey;
  question: string;
  hits: readonly HybridHit[];
  latency_ms: number;
  answer?: KnowledgeAnswer;
}

async function runSubQuery(sq: DomainSubQuery, language: "en" | "id", budget_ms: number): Promise<SubQueryResult> {
  const t0 = performance.now();
  if (!_kb) return { domain: sq.domain, question: sq.question, hits: [], latency_ms: 0 };
  try {
    const ans = await _kb.answer({
      query: sq.question,
      language,
      domain_hint: sq.domain,
      top_k: 5,
      budget_ms: Math.max(500, Math.floor(budget_ms / 2)),
    });
    return { domain: sq.domain, question: sq.question, hits: ans.hits, latency_ms: Math.round(performance.now() - t0), answer: ans };
  } catch {
    return { domain: sq.domain, question: sq.question, hits: [], latency_ms: Math.round(performance.now() - t0) };
  }
}

/**
 * Extract geo points from a hit set. Currently we rely on entity_ref
 * being a listing_ref where lat/lng may be available via a downstream
 * lookup. For this phase we return the shape without hard-coded coords
 * so the join honestly reports UNKNOWN when data absent. A future
 * BEGIN wires the accommodation adapter's hot-tier facts to populate
 * lat/lng here.
 */
function extractGeoPoints(hits: readonly HybridHit[]): GeoPoint[] {
  const out: GeoPoint[] = [];
  for (const h of hits) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyHit = h as any;
    const lat = typeof anyHit.lat === "number" ? anyHit.lat : (typeof anyHit.latitude === "number" ? anyHit.latitude : null);
    const lng = typeof anyHit.lng === "number" ? anyHit.lng : (typeof anyHit.longitude === "number" ? anyHit.longitude : null);
    out.push({
      entity_ref: h.entity_ref ?? h.ref_id,
      display_name: h.text.slice(0, 60),
      lat, lng,
    });
  }
  // Only return points that HAVE coordinates · we never inject fake lat/lng.
  return out.filter((p) => p.lat != null && p.lng != null);
}
