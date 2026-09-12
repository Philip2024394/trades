// src/lib/nex/response-composer/composer.ts
//
// NEX Master AI Engineer · Response Composer · main entry point
// Founder BEGIN 2026-09-08 · Intelligence Composition Pilot
//
// Wires: normalize → cache lookup → route classify → hot-tier or canonical
// query → deterministic answer OR small local inference → verification →
// cache write → return trace.
//
// Discipline (Founder mandates in force):
// - Never invoke LLM merely because available
// - Never fabricate · UNKNOWN when data insufficient
// - Postgres canonical · hot tier disposable · rebuild-on-empty
// - Every request emits auditable ComposerTrace
// - Semantic cache freshness-gated · superseded evidence invalidates cache
//
// Non-goals:
// - Not a chat UI (that's src/components/nex-app)
// - Not a specialist agent (compositions runs BEFORE specialist routing)
// - Not a replacement for brain/orchestrate.ts (composes with · does not replace)

import { performance } from "node:perf_hooks";
import type {
  ComposerInput,
  ComposerResponse,
  ComposerTrace,
  RouteClass,
} from "./types.js";
import type { ResponseComposerCache } from "./semantic-cache.js";
import type { HotAccommodationTier, HotAccommodationRecord } from "./hot-accommodation-tier.js";
import { classifyRoute, type RouteDecision } from "./route-classifier.js";
import { normalizeQuery } from "./request-normalizer.js";
import crypto from "node:crypto";

/** Provider signature · caller supplies a small-local-model callable. */
export type LocalInferenceProvider = (opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
}) => Promise<{
  text: string;
  input_tokens: number;
  output_tokens: number;
  ttft_ms: number;
  total_ms: number;
  stop_reason: string;
  provider_name: string;
  model_name: string;
}>;

/** Canonical fallback (Postgres) · caller supplies. Returns null when unavailable. */
export type CanonicalFallback = {
  lookupByRef: (ref: string) => Promise<HotAccommodationRecord | null>;
  lookupByCity: (city: string, limit: number) => Promise<HotAccommodationRecord[]>;
} | null;

export interface ComposerDeps {
  cache: ResponseComposerCache | null;
  hotTier: HotAccommodationTier | null;
  canonicalFallback: CanonicalFallback;
  localInference: LocalInferenceProvider | null;
}

export interface ComposerConfig {
  /** Cache write only for FRESH answers with confidence >= this. */
  cache_write_min_confidence: number;
  /** Default freshness TTL for cache writes if provider didn't set one. */
  default_cache_ttl_seconds: number;
  /** Route D max token budget (small local model). */
  local_inference_max_tokens: number;
  /** Route D max wall-clock budget in ms · circuit-breaker. */
  local_inference_timeout_ms: number;
  /** Never invoke LLM merely because available — enforced by classifier · this flag is a belt-and-braces safety. */
  refuse_llm_when_route_below_D: boolean;
}

export const DEFAULT_COMPOSER_CONFIG: ComposerConfig = {
  cache_write_min_confidence: 0.7,
  default_cache_ttl_seconds: 6 * 3600, // 6h · accommodation freshness bucket
  local_inference_max_tokens: 512,
  local_inference_timeout_ms: 30_000,
  refuse_llm_when_route_below_D: true,
};

export class ResponseComposer {
  constructor(
    private deps: ComposerDeps,
    private config: ComposerConfig = DEFAULT_COMPOSER_CONFIG,
  ) {}

  async answer(input: ComposerInput): Promise<ComposerResponse> {
    const t0 = performance.now();
    const requestId = `req_${crypto.randomBytes(6).toString("hex")}_${Date.now()}`;
    const receivedAtIso = new Date().toISOString();

    // ─────────────────────────────────────────────────────────
    // Stage 1 · Route classification (deterministic)
    // ─────────────────────────────────────────────────────────
    const decision: RouteDecision = classifyRoute({
      question: input.question,
      user_scope: input.user_scope,
      hotTier: this.deps.hotTier,
      cache: this.deps.cache,
      forceClass: input.force_route_class,
    });

    // ─────────────────────────────────────────────────────────
    // Stage 2 · Execute route
    // ─────────────────────────────────────────────────────────
    let answer_text: string | null = null;
    let answer_kind: ComposerTrace["response"]["answer_kind"] = "text";
    let confidence: number = decision.confidence;
    let disclaimers: string[] = [];
    let freshness_state: ComposerTrace["response"]["freshness_state"] = "UNKNOWN";
    let gap_enqueued_ref: string | null = null;
    let inferenceMeta: ComposerTrace["inference"] = null;
    const knowledge: ComposerTrace["knowledge"] = [];
    const tools: ComposerTrace["tools"] = [];
    let cacheStatus: "hit" | "miss" | "skipped" = "skipped";
    let cacheSemanticStatus: "hit" | "miss" | "skipped" = "skipped";
    let cacheStaleRejected = false;
    let cacheLatencySaved: number | null = null;
    let cacheFingerprint: string | null = null;
    let failure: ComposerTrace["failure_mode"] = null;
    let postgres_avoided = true;
    let hot_tier_hit = false;
    let local_gpu_seconds = 0;

    try {
      // Cache-level checks · exact + semantic
      if (this.deps.cache) {
        const lookup = this.deps.cache.lookup({
          question: input.question,
          user_scope: input.user_scope,
        });
        cacheFingerprint = lookup.cache_key_fingerprint;
        if (lookup.status === "exact_hit") {
          cacheStatus = "hit";
          cacheSemanticStatus = "skipped";
          cacheLatencySaved = lookup.latency_saved_ms;
          answer_text = lookup.entry!.answer_text;
          confidence = lookup.entry!.confidence;
          freshness_state = lookup.entry!.freshness_state;
          knowledge.push(...lookup.entry!.evidence_refs.map((e) => ({
            source: "cache_evidence",
            record_id: e,
            ref_key: null,
            confidence: lookup.entry!.confidence,
            freshness_state: lookup.entry!.freshness_state,
            evidence_refs: [e],
          })));
        } else if (lookup.status === "semantic_hit") {
          cacheStatus = "miss";
          cacheSemanticStatus = "hit";
          cacheLatencySaved = lookup.latency_saved_ms;
          answer_text = lookup.entry!.answer_text;
          confidence = lookup.entry!.confidence * 0.95;
          freshness_state = lookup.entry!.freshness_state;
        } else if (lookup.status === "stale_rejected") {
          cacheStaleRejected = true;
          cacheStatus = "miss";
          cacheSemanticStatus = "miss";
          // Fall through to canonical path
        } else {
          cacheStatus = "miss";
          cacheSemanticStatus = "miss";
        }
      }

      // If cache did not produce an answer, execute the route
      if (answer_text === null) {
        const routed = await this.executeRoute(decision, input);
        answer_text = routed.answer_text;
        answer_kind = routed.answer_kind;
        confidence = routed.confidence;
        freshness_state = routed.freshness_state;
        knowledge.push(...routed.knowledge);
        tools.push(...routed.tools);
        inferenceMeta = routed.inference;
        gap_enqueued_ref = routed.gap_enqueued_ref;
        disclaimers.push(...routed.disclaimers);
        postgres_avoided = routed.postgres_avoided;
        hot_tier_hit = routed.hot_tier_hit;
        local_gpu_seconds = routed.local_gpu_seconds;
      }

      // Cache write for successful answers
      if (
        this.deps.cache &&
        answer_text !== null &&
        confidence >= this.config.cache_write_min_confidence &&
        freshness_state !== "STALE" &&
        !cacheStaleRejected // avoid rewriting rejected entries with same evidence
      ) {
        this.deps.cache.put({
          question: input.question,
          user_scope: input.user_scope,
          answer_text,
          answer_kind,
          route_class_when_computed: decision.class,
          confidence,
          freshness_state,
          freshness_ttl_seconds: freshness_state === "PERMANENT" ? null : this.config.default_cache_ttl_seconds,
          evidence_refs: knowledge.flatMap((k) => k.evidence_refs),
        });
      }

    } catch (e: any) {
      failure = {
        code: e?.code ?? "COMPOSER_UNCAUGHT",
        stage: "route",
        recoverable: false,
        detail: e?.message ?? String(e),
      };
      if (answer_text === null) {
        answer_text = null;
        answer_kind = "unknown_with_clarification";
        confidence = 0;
        disclaimers.push("An internal error prevented me from answering. Please try again shortly.");
      }
    }

    // ─────────────────────────────────────────────────────────
    // Stage 3 · Verification (deterministic wherever possible)
    // ─────────────────────────────────────────────────────────
    const verification = this.verify(decision.class, answer_text, knowledge);

    const completedAtIso = new Date().toISOString();
    const latency_ms = Math.round((performance.now() - t0) * 100) / 100;

    const trace: ComposerTrace = {
      request_id: requestId,
      received_at_iso: receivedAtIso,
      completed_at_iso: completedAtIso,
      latency_ms,
      route: {
        class: decision.class,
        reason_code: decision.reason_code,
        reason_detail: decision.reason_detail,
        confidence: decision.confidence,
        considered_classes: decision.considered.map((c) => c.class),
      },
      cache: {
        exact_lookup: cacheStatus,
        semantic_lookup: cacheSemanticStatus,
        stale_rejected: cacheStaleRejected,
        latency_saved_ms: cacheLatencySaved,
        cache_key_fingerprint: cacheFingerprint,
      },
      knowledge,
      tools,
      inference: inferenceMeta,
      verification,
      response: {
        answer_text,
        answer_kind,
        confidence,
        freshness_state,
        disclaimers,
        gap_enqueued_ref,
      },
      cost_classification: {
        third_party_billable: false,
        local_gpu_seconds,
        electricity_bucket: local_gpu_seconds > 10 ? "medium" : local_gpu_seconds > 2 ? "small" : "negligible",
      },
      failure_mode: failure,
    };

    // Extra pilot fields (attached without breaking trace typing)
    (trace as any).pilot = {
      postgres_avoided,
      hot_tier_hit,
    };

    return {
      trace,
      route_class: decision.class,
      answer_text,
      answer_kind,
      confidence,
      disclaimers,
    };
  }

  /** Execute the route classification against real data + tools. */
  private async executeRoute(decision: RouteDecision, input: ComposerInput): Promise<{
    answer_text: string | null;
    answer_kind: ComposerTrace["response"]["answer_kind"];
    confidence: number;
    freshness_state: ComposerTrace["response"]["freshness_state"];
    knowledge: ComposerTrace["knowledge"];
    tools: ComposerTrace["tools"];
    inference: ComposerTrace["inference"];
    gap_enqueued_ref: string | null;
    disclaimers: string[];
    postgres_avoided: boolean;
    hot_tier_hit: boolean;
    local_gpu_seconds: number;
  }> {
    const knowledge: ComposerTrace["knowledge"] = [];
    const tools: ComposerTrace["tools"] = [];
    const disclaimers: string[] = [];
    let inference: ComposerTrace["inference"] = null;
    let gap_enqueued_ref: string | null = null;
    let postgres_avoided = true;
    let hot_tier_hit = false;
    let local_gpu_seconds = 0;

    const ext = decision.extracted;

    switch (decision.class) {
      case "A": {
        // Deterministic only · e.g. safety, small-talk, canned reply
        const text = decision.reason_code === "SAFETY_EXPRESSION"
          ? "For safety concerns like this, please contact emergency services or the nearest medical facility. I cannot provide medical or emergency advice."
          : decision.reason_code === "PATTERN_INTENT_DETERMINISTIC" && ext.small_talk_flag
            ? "Hello! How can I help you today?"
            : "I understand. Please tell me more.";
        return {
          answer_text: text,
          answer_kind: "text",
          confidence: decision.confidence,
          freshness_state: "PERMANENT",
          knowledge, tools, inference,
          gap_enqueued_ref, disclaimers,
          postgres_avoided, hot_tier_hit, local_gpu_seconds,
        };
      }

      case "B": {
        // Structured lookup · hot tier first · fall back to canonical if tier empty
        if (ext.listing_ref_hint && this.deps.hotTier?.isReady()) {
          const hit = this.deps.hotTier.lookupByRef(ext.listing_ref_hint);
          if (hit.hit && hit.record) {
            hot_tier_hit = true;
            knowledge.push({
              source: "hot_accommodation_tier",
              record_id: hit.record.public_listing_ref,
              ref_key: hit.record.business_name,
              confidence: 0.98,
              freshness_state: "FRESH",
              evidence_refs: [hit.record.public_listing_ref],
            });
            return {
              answer_text: this.formatAccommodationRecord(hit.record),
              answer_kind: "text",
              confidence: 0.98,
              freshness_state: "FRESH",
              knowledge, tools, inference,
              gap_enqueued_ref, disclaimers,
              postgres_avoided, hot_tier_hit, local_gpu_seconds,
            };
          }
          // Miss in hot tier · fall back to canonical
          postgres_avoided = false;
          if (this.deps.canonicalFallback) {
            const rec = await this.deps.canonicalFallback.lookupByRef(ext.listing_ref_hint);
            if (rec) {
              knowledge.push({
                source: "canonical_postgres",
                record_id: rec.public_listing_ref,
                ref_key: rec.business_name,
                confidence: 0.95,
                freshness_state: "FRESH",
                evidence_refs: [rec.public_listing_ref],
              });
              return {
                answer_text: this.formatAccommodationRecord(rec),
                answer_kind: "text",
                confidence: 0.95,
                freshness_state: "FRESH",
                knowledge, tools, inference, gap_enqueued_ref, disclaimers,
                postgres_avoided, hot_tier_hit, local_gpu_seconds,
              };
            }
          }
        }
        if (ext.distance_intent && ext.city_hint && this.deps.hotTier?.isReady()) {
          // Distance query · deterministic Haversine on hot tier
          const t0 = performance.now();
          const city = this.deps.hotTier.lookupByCity(ext.city_hint);
          if (city.hit && city.records.length > 0) {
            hot_tier_hit = true;
            // Return top 5 with coordinates
            const withCoords = city.records.filter((r) => r.coordinates_lat != null).slice(0, 5);
            tools.push({
              name: "hot_tier_by_city",
              inputs: { city: ext.city_hint },
              outputs: { count: withCoords.length },
              latency_ms: Math.round((performance.now() - t0) * 100) / 100,
              ok: true,
              error: null,
            });
            knowledge.push(...withCoords.map((r) => ({
              source: "hot_accommodation_tier",
              record_id: r.public_listing_ref,
              ref_key: r.business_name,
              confidence: 0.9,
              freshness_state: "FRESH" as const,
              evidence_refs: [r.public_listing_ref],
            })));
            return {
              answer_text: `Found ${withCoords.length} accommodations in ${ext.city_hint} with location data: ` +
                withCoords.map((r) => `${r.business_name} (${r.district ?? "?"})`).join("; "),
              answer_kind: "card",
              confidence: 0.9,
              freshness_state: "FRESH",
              knowledge, tools, inference, gap_enqueued_ref, disclaimers,
              postgres_avoided, hot_tier_hit, local_gpu_seconds,
            };
          }
        }
        if (ext.city_hint && this.deps.hotTier?.isReady()) {
          const top = this.deps.hotTier.topByCity(ext.city_hint, 10);
          if (top.hit) {
            hot_tier_hit = true;
            knowledge.push(...top.records.map((r) => ({
              source: "hot_accommodation_tier",
              record_id: r.public_listing_ref,
              ref_key: r.business_name,
              confidence: 0.85,
              freshness_state: "FRESH" as const,
              evidence_refs: [r.public_listing_ref],
            })));
            return {
              answer_text: `Top ${top.records.length} in ${ext.city_hint}: ` +
                top.records.map((r, i) => `${i+1}. ${r.business_name}${r.rating ? ` (★${r.rating})` : ""}`).join("; "),
              answer_kind: "card",
              confidence: 0.85,
              freshness_state: "FRESH",
              knowledge, tools, inference, gap_enqueued_ref, disclaimers,
              postgres_avoided, hot_tier_hit, local_gpu_seconds,
            };
          }
        }
        // No structured hit found · demote to E
        gap_enqueued_ref = `gap_${crypto.randomBytes(4).toString("hex")}`;
        disclaimers.push("I don't have verified information matching that. Enqueued for research.");
        return {
          answer_text: null,
          answer_kind: "unknown_with_gap_enqueued",
          confidence: 0.1,
          freshness_state: "UNKNOWN",
          knowledge, tools, inference,
          gap_enqueued_ref, disclaimers,
          postgres_avoided, hot_tier_hit, local_gpu_seconds,
        };
      }

      case "C": {
        // Retrieval + reasoning · hot tier predicate + deterministic composition
        if (this.deps.hotTier?.isReady()) {
          const predicates = ext.predicates;
          const city = ext.city_hint;
          const pred = (r: HotAccommodationRecord) => {
            if (city && (!r._city_lower || !r._city_lower.includes(city.toLowerCase()))) return false;
            if (predicates.length === 0) return true;
            return predicates.every((p) => {
              const hit =
                r.amenities.some((a) => a.toLowerCase().includes(p)) ||
                r.categories.some((c) => c.toLowerCase().includes(p)) ||
                (r._name_lower.includes(p));
              return hit;
            });
          };
          const results = this.deps.hotTier.lookupByPredicate(pred, 20);
          if (results.hit && results.records.length > 0) {
            hot_tier_hit = true;
            knowledge.push(...results.records.slice(0, 10).map((r) => ({
              source: "hot_accommodation_tier",
              record_id: r.public_listing_ref,
              ref_key: r.business_name,
              confidence: 0.8,
              freshness_state: "FRESH" as const,
              evidence_refs: [r.public_listing_ref],
            })));
            const top = results.records.slice(0, 5);
            return {
              answer_text: `Found ${results.records.length} matches${city ? ` in ${city}` : ""}${predicates.length ? ` with ${predicates.join(", ")}` : ""}. Top ${top.length}: ${top.map((r) => r.business_name).join("; ")}.`,
              answer_kind: "card",
              confidence: 0.8,
              freshness_state: "FRESH",
              knowledge, tools, inference, gap_enqueued_ref, disclaimers,
              postgres_avoided, hot_tier_hit, local_gpu_seconds,
            };
          }
        }
        // No retrieval hit
        gap_enqueued_ref = `gap_${crypto.randomBytes(4).toString("hex")}`;
        disclaimers.push("No verified data matches that query in my current knowledge. Enqueued.");
        return {
          answer_text: null,
          answer_kind: "unknown_with_gap_enqueued",
          confidence: 0.15,
          freshness_state: "UNKNOWN",
          knowledge, tools, inference,
          gap_enqueued_ref, disclaimers,
          postgres_avoided, hot_tier_hit, local_gpu_seconds,
        };
      }

      case "D": {
        // Small local inference · gated
        if (!this.deps.localInference) {
          disclaimers.push("Local inference unavailable · cannot answer this free-form query right now.");
          return {
            answer_text: null,
            answer_kind: "unknown_with_clarification",
            confidence: 0.1,
            freshness_state: "UNKNOWN",
            knowledge, tools, inference,
            gap_enqueued_ref, disclaimers,
            postgres_avoided, hot_tier_hit, local_gpu_seconds,
          };
        }
        if (this.config.refuse_llm_when_route_below_D && decision.class !== "D") {
          throw new Error("refusing to invoke LLM · route below D");
        }
        const t0 = performance.now();
        try {
          const res = await this.deps.localInference({
            system: "You are NEX. Answer concisely. If you do not know, say so.",
            prompt: input.question,
            maxTokens: this.config.local_inference_max_tokens,
            timeoutMs: this.config.local_inference_timeout_ms,
          });
          inference = {
            provider: res.provider_name,
            model: res.model_name,
            input_tokens: res.input_tokens,
            output_tokens: res.output_tokens,
            ttft_ms: res.ttft_ms,
            total_ms: res.total_ms,
            stop_reason: res.stop_reason,
          };
          local_gpu_seconds = res.total_ms / 1000;
          return {
            answer_text: res.text,
            answer_kind: "text",
            confidence: 0.6,
            freshness_state: "PERMANENT",
            knowledge, tools, inference, gap_enqueued_ref, disclaimers,
            postgres_avoided, hot_tier_hit, local_gpu_seconds,
          };
        } catch (e: any) {
          const ms = performance.now() - t0;
          local_gpu_seconds = ms / 1000;
          disclaimers.push(`Local inference failed after ${ms.toFixed(0)}ms: ${e.message}`);
          return {
            answer_text: null,
            answer_kind: "unknown_with_clarification",
            confidence: 0.1,
            freshness_state: "UNKNOWN",
            knowledge, tools, inference,
            gap_enqueued_ref: `gap_${crypto.randomBytes(4).toString("hex")}`,
            disclaimers,
            postgres_avoided, hot_tier_hit, local_gpu_seconds,
          };
        }
      }

      case "E":
      default: {
        gap_enqueued_ref = `gap_${crypto.randomBytes(4).toString("hex")}`;
        disclaimers.push("I don't have verified information to answer that yet. I'll research and come back.");
        return {
          answer_text: null,
          answer_kind: "unknown_with_gap_enqueued",
          confidence: 0.2,
          freshness_state: "UNKNOWN",
          knowledge, tools, inference,
          gap_enqueued_ref, disclaimers,
          postgres_avoided, hot_tier_hit, local_gpu_seconds,
        };
      }
    }
  }

  private verify(routeClass: RouteClass, answer_text: string | null, knowledge: ComposerTrace["knowledge"]): ComposerTrace["verification"] {
    if (answer_text === null) {
      return {
        method: "skipped",
        verdict: "UNKNOWN",
        evidence_refs: [],
        reason: "no answer produced · nothing to verify",
      };
    }
    if (routeClass === "A") {
      return {
        method: "deterministic_match",
        verdict: "PASS",
        evidence_refs: [],
        reason: "Route A · deterministic canned response",
      };
    }
    if (routeClass === "B" || routeClass === "C") {
      // If knowledge has evidence_refs · verified
      const refs = knowledge.flatMap((k) => k.evidence_refs);
      return {
        method: "deterministic_match",
        verdict: refs.length > 0 ? "PASS" : "UNKNOWN",
        evidence_refs: refs,
        reason: refs.length > 0
          ? `${refs.length} evidence refs from ${knowledge.length} knowledge sources`
          : "no evidence backing answer",
      };
    }
    if (routeClass === "D") {
      return {
        method: "human_pending",
        verdict: "UNKNOWN",
        evidence_refs: [],
        reason: "Route D · LLM output · human blind eval required per V.5.4.4",
      };
    }
    return {
      method: "skipped",
      verdict: "UNKNOWN",
      evidence_refs: [],
      reason: "Route E · no verification path",
    };
  }

  private formatAccommodationRecord(r: HotAccommodationRecord): string {
    const parts: string[] = [r.business_name];
    if (r.city) parts.push(`in ${r.city}`);
    if (r.district) parts.push(`(${r.district} district)`);
    if (r.star_rating) parts.push(`★${r.star_rating}`);
    if (r.rating && r.review_count) parts.push(`rated ${r.rating} from ${r.review_count} reviews`);
    if (r.amenities.length > 0) parts.push(`amenities: ${r.amenities.slice(0, 5).join(", ")}`);
    if (r.address) parts.push(`— ${r.address}`);
    return parts.join(" ");
  }
}
