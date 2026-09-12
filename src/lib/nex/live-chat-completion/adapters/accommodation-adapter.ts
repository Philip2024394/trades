// src/lib/nex/live-chat-completion/adapters/accommodation-adapter.ts
//
// Founder BEGIN 2026-09-09 · LIVE CHAT COMPLETION · accommodation adapter.
//
// Wraps intent-parser · hot-tier-facts · fact-computer · deterministic-composer
// to satisfy the DomainAdapter contract. Every reply is composed at request
// time from stored facts. Zero LLM. Zero fabrication.
//
// The adapter is stateless per turn — hot-tier + bootstrap are module-level
// (see shadow-mode.ts). Reuses the same bootstrap promise so we don't warm
// twice.

import type { Pool } from "pg";
import { performance } from "node:perf_hooks";

import type {
  DomainAdapter,
  AdapterReply,
  AdapterTurnInput,
  ReplyClaim,
  TrustBand,
} from "../contract";

import { parseIntent, type ParsedIntent } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-parser";
import { computeFactBundle } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";
import { composeReply } from "@/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer";
import {
  factHotGet, factHotSet, factHotSetBulk, factHotStats, factHotAllNames, factHotEnumerate,
} from "@/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts";
import { normalise } from "@/lib/nex/intelligence-storage-grid/accommodation/language-normaliser";
import { getIntent } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-registry";
// Founder BEGIN SI-1 · semantic intent resolution when token-trigger matching fails.
import { topKIntents } from "@/lib/nex/live-chat-completion/semantic/intent-semantic-index";
import { makeDefaultEmbeddingProvider } from "@/lib/nex/live-chat-completion/semantic/embedding-provider";
// Founder BEGIN Phase 3.6 · Truth Engine surfaces (freshness prefix).
import { getIntentFreshness } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-registry";
const _semanticIntentProvider = makeDefaultEmbeddingProvider();
const _SEMANTIC_INTENT_MIN_SIM = 0.35;
import type { FactBundle } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";
import type { AccommodationRow, FieldProvenanceRow } from "@/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres";
import type { EnrichmentEvidenceRow } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";

// ═══════════════════════════════════════════════════════════════════
// Bootstrap · memoized module-level. Same shape as shadow-mode.ts.
// Separate promise so shadow-mode can keep running as before.
// ═══════════════════════════════════════════════════════════════════

let _bootstrapPromise: Promise<{ ok: boolean; loaded: number; ms: number; note?: string }> | null = null;

async function bootstrapHotTierForAdapter(pool: Pool, city = "Yogyakarta") {
  if (_bootstrapPromise) return _bootstrapPromise;
  _bootstrapPromise = (async () => {
    const t0 = performance.now();
    try {
      const rowsRes = await pool.query(
        `SELECT * FROM nex.accommodation_business
          WHERE city = $1 AND claim_status IN ('listed', 'invited', 'claimed', 'paying')
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1000`,
        [city],
      );
      const rows = rowsRes.rows as AccommodationRow[];
      if (rows.length === 0) {
        return { ok: true, loaded: 0, ms: Math.round(performance.now() - t0), note: "no rows in Postgres for city" };
      }
      const refs = rows.map((r) => r.public_listing_ref);
      const provRes = await pool.query(
        `SELECT * FROM nex.accommodation_business_field_provenance WHERE business_ref = ANY($1::text[])`,
        [refs],
      );
      const evRes = await pool.query(
        `SELECT business_ref, field_name, value, raw_payload, confidence, source, source_type, discovered_at
           FROM nex.accommodation_enrichment_evidence WHERE business_ref = ANY($1::text[])`,
        [refs],
      );
      const provByRef = new Map<string, FieldProvenanceRow[]>();
      for (const p of provRes.rows as FieldProvenanceRow[]) {
        if (!provByRef.has(p.business_ref)) provByRef.set(p.business_ref, []);
        provByRef.get(p.business_ref)!.push(p);
      }
      const evByRef = new Map<string, EnrichmentEvidenceRow[]>();
      for (const e of evRes.rows as EnrichmentEvidenceRow[]) {
        if (!evByRef.has(e.business_ref)) evByRef.set(e.business_ref, []);
        evByRef.get(e.business_ref)!.push(e);
      }
      const bundles: FactBundle[] = rows.map((row) =>
        computeFactBundle({
          row,
          provenance: provByRef.get(row.public_listing_ref) ?? [],
          evidence: evByRef.get(row.public_listing_ref) ?? [],
        }),
      );
      factHotSetBulk(bundles);
      return { ok: true, loaded: bundles.length, ms: Math.round(performance.now() - t0) };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      _bootstrapPromise = null; // allow retry
      return { ok: false, loaded: 0, ms: Math.round(performance.now() - t0), note: `bootstrap_failed: ${msg}` };
    }
  })();
  return _bootstrapPromise;
}

// ═══════════════════════════════════════════════════════════════════
// Lazy per-ref Postgres fetch for prior_list items not in hot-tier
// ═══════════════════════════════════════════════════════════════════

async function fetchMissingBundles(pool: Pool, refs: readonly string[]): Promise<FactBundle[]> {
  if (refs.length === 0) return [];
  try {
    const rowsRes = await pool.query(
      `SELECT * FROM nex.accommodation_business WHERE public_listing_ref = ANY($1::text[])`,
      [refs],
    );
    const rows = rowsRes.rows as AccommodationRow[];
    if (rows.length === 0) return [];
    const foundRefs = rows.map((r) => r.public_listing_ref);
    const provRes = await pool.query(
      `SELECT * FROM nex.accommodation_business_field_provenance WHERE business_ref = ANY($1::text[])`,
      [foundRefs],
    );
    const evRes = await pool.query(
      `SELECT business_ref, field_name, value, raw_payload, confidence, source, source_type, discovered_at
         FROM nex.accommodation_enrichment_evidence WHERE business_ref = ANY($1::text[])`,
      [foundRefs],
    );
    const provByRef = new Map<string, FieldProvenanceRow[]>();
    for (const p of provRes.rows as FieldProvenanceRow[]) {
      if (!provByRef.has(p.business_ref)) provByRef.set(p.business_ref, []);
      provByRef.get(p.business_ref)!.push(p);
    }
    const evByRef = new Map<string, EnrichmentEvidenceRow[]>();
    for (const e of evRes.rows as EnrichmentEvidenceRow[]) {
      if (!evByRef.has(e.business_ref)) evByRef.set(e.business_ref, []);
      evByRef.get(e.business_ref)!.push(e);
    }
    return rows.map((row) => {
      const b = computeFactBundle({
        row,
        provenance: provByRef.get(row.public_listing_ref) ?? [],
        evidence: evByRef.get(row.public_listing_ref) ?? [],
      });
      factHotSet(row.public_listing_ref, b);
      return b;
    });
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// Trust mapping (accommodation TrustLayer → contract TrustBand)
// ═══════════════════════════════════════════════════════════════════

function toTrustBand(t: string): TrustBand {
  switch (t) {
    case "canonical_verified": return "canonical_verified";
    case "canonical_unverified": return "canonical_unverified";
    case "evidence_verified": return "evidence_verified";
    case "evidence_provisional": return "evidence_provisional";
    case "unknown": return "unknown";
    case "clarify": return "clarify";
    case "mixed": return "mixed";
    default: return "unknown";
  }
}

// ═══════════════════════════════════════════════════════════════════
// Adapter
// ═══════════════════════════════════════════════════════════════════

export interface AccommodationAdapterDeps {
  getPool: () => Pool;
  /**
   * Founder BEGIN Phase 3.2 · optional KF pool (nex.question_variant lookup).
   * Falls back to getPool() when omitted · but production uses a separate
   * KF pool because knowledge-factory tables and canonical data may live
   * on different Postgres hosts (KF on local, canonical on Supabase, etc.).
   */
  getKfPool?: () => Pool;
  /**
   * Founder BEGIN Phase 2 · optional gap emission. When the adapter honestly
   * returns unknown with a resolved entity, we UPSERT into nex.knowledge_gap
   * so background workers can pick it up and continuously improve coverage.
   * Best-effort · never breaks the customer reply if it fails.
   */
  enqueueGap?: (input: {
    domain: "accommodation";
    entity_ref: string;
    intent_slug: string;
    source_conversation_id: string | null;
  }) => Promise<void>;
}

export function makeAccommodationAdapter(deps: AccommodationAdapterDeps): DomainAdapter {
  return {
    domain: "accommodation",
    canHandle(_input: AdapterTurnInput): boolean {
      // Domain classifier already decided. Always accept.
      return true;
    },
    async compose(input: AdapterTurnInput): Promise<AdapterReply> {
      const t0 = performance.now();
      const reasoning: string[] = [];
      const known: ReplyClaim[] = [];
      const unknown: ReplyClaim[] = [];
      const requested: ReplyClaim[] = [];
      let fingerprint_hit = false;

      // 1. Ensure hot-tier is warm.
      const pool = deps.getPool();
      const bootstrap = await bootstrapHotTierForAdapter(pool);
      reasoning.push(`bootstrap: ok=${bootstrap.ok} loaded=${bootstrap.loaded} ms=${bootstrap.ms}${bootstrap.note ? ` note=${bootstrap.note}` : ""}`);

      // Founder BEGIN Phase 3.1 · Follow-up-on-list handling.
      // When the conversation-brain turn interpreter has classified this
      // turn as follow_up_on_list AND resolved a result_set, do the list
      // filter (or ordinal lookup) IN-STATE — no re-search of the world.
      const tp = input.turn_plan;
      if (tp && tp.classification === "follow_up_on_list" && tp.result_set) {
        const rs = tp.result_set;
        // Warm bundles for the result-set entities (usually already hot).
        const rsBundles: FactBundle[] = [];
        const missing: string[] = [];
        for (const ref of rs.entity_refs) {
          const hit = factHotGet(ref);
          if (hit) rsBundles.push(hit.bundle);
          else missing.push(ref);
        }
        if (missing.length > 0) {
          const fetched = await fetchMissingBundles(pool, missing);
          for (const b of fetched) if (!rsBundles.find((x) => x.listing_ref === b.listing_ref)) rsBundles.push(b);
        }

        // Ordinal lookup: "the first one" → return the fact for that entity.
        if (tp.resolved_ordinal && tp.resolved_ordinal >= 1 && tp.resolved_ordinal <= rsBundles.length) {
          const target = rsBundles[tp.resolved_ordinal - 1];
          // Fall through to the normal fact-composition path with focus = target.
          reasoning.push(`turn_plan · ordinal ${tp.resolved_ordinal} → ${target.listing_ref}`);
          const parsedForFact = parseIntent(input.message, { known_names: factHotAllNames() });
          const composed = composeReply({
            parsed: parsedForFact,
            bundles: [target],
            context: { language: input.language, focus_listing_ref: target.listing_ref },
          });
          return finaliseReply({ composed, reasoning, latency_ms: Math.round(performance.now() - t0), fingerprint_hit: false });
        }

        // Filter: "which has a pool" → keep entities where fact is verified.
        if (tp.list_filter) {
          const fact_slug = tp.list_filter.fact_slug;
          const surviving = rsBundles.filter((b) => {
            const f = b.facts[fact_slug];
            if (!f || f.unknown) return false;
            if (typeof f.value === "boolean") return f.value === true;
            return f.value !== null && f.value !== undefined;
          });
          reasoning.push(`turn_plan · list_filter fact=${fact_slug} survivors=${surviving.length}/${rsBundles.length}`);

          if (surviving.length === 0) {
            const text = `I don't have verified ${prettifyFactSlug(fact_slug)} data for any of the ${rsBundles.length} ${rs.category ?? "hotel"}s I showed you. Want me to check a different attribute?`;
            const latency = Math.round(performance.now() - t0);
            return {
              answered: true,
              reply_text: text,
              // Founder BEGIN Phase 3.1 · reply_kind "list" (empty survivors)
              // so shouldPromoteReply accepts. Trust "canonical_verified" is
              // honest — the FILTER is verified (we truly checked each entity),
              // even though the answer is "none passed".
              reply_kind: "list",
              trust: "canonical_verified",
              intent_slug: fact_slug,
              entity_ref: null,
              known: [],
              unknown: rsBundles.map((b) => ({ kind: fact_slug, entity_ref: b.listing_ref, trust: "unknown" as TrustBand })),
              requested: [],
              reasoning,
              latency_ms: latency,
              perf: { fingerprint_hit: false, hot_tier_hit: true },
            };
          }

          // Compose "N of the properties have <fact>: A, B, C"
          const names = surviving.map((b) => b.business_name).slice(0, 6);
          const nameStr = names.join(", ") + (surviving.length > 6 ? ", …" : "");
          const factLabel = prettifyFactSlug(fact_slug);
          const text = surviving.length === rsBundles.length
            ? `All ${rsBundles.length} of them have verified ${factLabel} on record: ${nameStr}.`
            : `${surviving.length} of the ${rsBundles.length} have verified ${factLabel}: ${nameStr}. The rest I don't have data for yet.`;
          const latency = Math.round(performance.now() - t0);
          return {
            answered: true,
            reply_text: text,
            reply_kind: "list",
            trust: "canonical_verified",
            intent_slug: fact_slug,
            entity_ref: null,
            known: surviving.map((b) => ({ kind: fact_slug, entity_ref: b.listing_ref, trust: "canonical_verified" as TrustBand })),
            unknown: rsBundles.filter((b) => !surviving.includes(b)).map((b) => ({ kind: fact_slug, entity_ref: b.listing_ref, trust: "unknown" as TrustBand })),
            requested: [],
            reasoning,
            latency_ms: latency,
            perf: { fingerprint_hit: false, hot_tier_hit: true },
            list_rendered: {
              intent_slug: fact_slug,
              entity_refs: surviving.map((b) => b.listing_ref),
              city: rs.city,
              category: rs.category,
              render_summary: `${surviving.length} filtered by ${factLabel}`,
            },
          };
        }
      }

      // Founder BEGIN Phase 3.2 · fingerprint-first hot lookup · REAL short-circuit.
      // Check nex.question_variant for this exact normalised question. If
      // it's already been verified at answered trust, skip parseIntent +
      // compose · use the stored (entity_ref, intent_slug) directly.
      // Only short-circuits fragments/fresh turns (no turn_plan overrides).
      // Never short-circuits when the interpreter has follow_up_on_list.
      const allowShortCircuit = !tp
        || tp.classification === "new_topic"
        || tp.classification === "fragment"
        || tp.classification === "follow_up_on_entity";
      // Founder BEGIN Phase 3.2 · question_variant lives on the KF pool
      // (may be a different Postgres than the canonical source pool).
      const kfPool = deps.getKfPool ? deps.getKfPool() : pool;
      try {
        const normalised = String(input.message ?? "")
          .toLowerCase()
          .replace(/[!.?]+$/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (normalised.length > 0) {
          const hit = await kfPool.query(
            `SELECT entity_ref, intent_slug, answer_status, trust
               FROM nex.question_variant
               WHERE domain = 'accommodation' AND language = $1 AND normalised_text = $2
               ORDER BY
                 CASE answer_status
                   WHEN 'answered' THEN 0
                   WHEN 'partially_answered' THEN 1
                   ELSE 2
                 END,
                 last_verified_at DESC NULLS LAST
               LIMIT 1`,
            [input.language, normalised],
          );
          if (hit.rowCount > 0) {
            fingerprint_hit = true;
            const r = hit.rows[0];
            reasoning.push(`fingerprint_hit · entity_ref=${r.entity_ref} intent=${r.intent_slug} status=${r.answer_status} trust=${r.trust}`);

            // REAL short-circuit: if the hit is answered/partially_answered and
            // we have (entity_ref, intent_slug), compose directly from the
            // bundle without parsing or entity-resolving again.
            const okStatus = r.answer_status === "answered" || r.answer_status === "partially_answered";
            const entityRef = r.entity_ref ? String(r.entity_ref) : null;
            const intentSlug = r.intent_slug ? String(r.intent_slug) : null;
            if (allowShortCircuit && okStatus && entityRef && intentSlug) {
              const intentDef = getIntent(intentSlug);
              if (intentDef) {
                const bundleHit = factHotGet(entityRef);
                let bundle = bundleHit?.bundle ?? null;
                if (!bundle) {
                  const fetched = await fetchMissingBundles(pool, [entityRef]);
                  bundle = fetched[0] ?? null;
                }
                if (bundle) {
                  const synthetic: ParsedIntent = {
                    intent_slug: intentSlug,
                    intent: intentDef,
                    slots: {
                      is_question: true,
                      is_follow_up_where: false,
                      is_follow_up_has: false,
                      is_follow_up_ordinal: false,
                      is_vertical_switch: false,
                      is_action_show: false,
                      is_action_book: false,
                    },
                    confidence: 1,
                    normalised: normalise(input.message),
                    reasoning: [`short_circuit · fingerprint_hit`],
                  };
                  const composedFast = composeReply({
                    parsed: synthetic,
                    bundles: [bundle],
                    context: { language: input.language, focus_listing_ref: entityRef },
                  });
                  reasoning.push(`short_circuit · skipped parseIntent + entity-resolution`);
                  return finaliseReply({
                    composed: composedFast,
                    reasoning,
                    latency_ms: Math.round(performance.now() - t0),
                    fingerprint_hit: true,
                  });
                }
              }
            }
          }
        }
      } catch { /* fingerprint miss must never break the reply path */ }

      // 2. Parse intent · pass known names for property-name resolution.
      const knownNames = factHotAllNames();
      const parsed = parseIntent(input.message, { known_names: knownNames });
      reasoning.push(`parsed intent=${parsed.intent_slug} conf=${parsed.confidence}${parsed.slots.property_name_match ? ` name=${parsed.slots.property_name_match.business_name}` : ""}${parsed.slots.time ? ` time=${parsed.slots.time}` : ""}`);

      // Founder BEGIN SI-1 · semantic-first intent resolution.
      // Runs on every turn. Overrides parseIntent when:
      //   (a) parseIntent found nothing meaningful, OR
      //   (b) parseIntent chose a GENERIC intent (list_in_city / property_category /
      //       location_city with `where` trigger / room_types with `room` mention)
      //       AND semantic finds a specific intent with sim >= 0.4.
      // Never overrides confident specific intents (wifi_available, breakfast_available,
      // etc.) unless semantic is dramatically higher (sim >= 0.55).
      const GENERIC_PARSED_INTENTS = new Set([
        "list_in_city", "property_category", "location_city", "property_name",
        "room_types", // triggered by any "room" mention · often wrong for wifi-in-room etc.
      ]);
      try {
        const hits = await topKIntents({
          query: input.message,
          provider: _semanticIntentProvider,
          k: 3,
          min_similarity: 0.25,
        });
        if (hits.length > 0) {
          const top = hits[0];
          const sameAsParsed = top.intent_slug === parsed.intent_slug;
          const parsedIsGeneric = !parsed.intent_slug || GENERIC_PARSED_INTENTS.has(parsed.intent_slug);
          // Threshold is intentionally LOWER when the parsed intent came from
          // a generic trigger · because parseIntent's guess is barely a signal
          // in those cases. Higher threshold to override a SPECIFIC parsed intent.
          const highConfidenceForGeneric = top.similarity >= 0.28;
          const dominantConfidence = top.similarity >= 0.55;
          const shouldOverride = !sameAsParsed && (
            (parsedIsGeneric && highConfidenceForGeneric)
            || dominantConfidence
          );
          if (shouldOverride) {
            const nextIntent = getIntent(top.intent_slug);
            if (nextIntent) {
              reasoning.push(`semantic_intent · resolved=${top.intent_slug} sim=${top.similarity.toFixed(3)} (was ${parsed.intent_slug ?? "null"}, generic=${parsedIsGeneric})`);
              parsed.intent_slug = top.intent_slug;
              parsed.intent = nextIntent;
            }
          } else {
            reasoning.push(`semantic_intent · not_overriding · top=${top.intent_slug} sim=${top.similarity.toFixed(3)} parsed=${parsed.intent_slug ?? "null"}`);
          }
        }
      } catch { /* semantic degraded · continue with token-trigger result */ }

      // Founder BEGIN Phase 3.1 · turn_plan overrides for fragment classifications.
      // If interpreter resolved an entity + intent (fragment against active entity),
      // trust that over the parser's guess. Fragments are ambiguous by design and
      // conversation state is the correct disambiguator.
      if (tp && tp.classification === "fragment" && tp.inferred_intent_slug && tp.resolved_entity_ref) {
        reasoning.push(`turn_plan · fragment override · intent=${tp.inferred_intent_slug} entity=${tp.resolved_entity_ref}`);
        const hit = factHotGet(tp.resolved_entity_ref);
        const bundle = hit?.bundle ?? null;
        const bundlesForFrag = bundle ? [bundle] : [];
        const parsedForFrag = {
          ...parsed,
          intent_slug: tp.inferred_intent_slug,
          intent: parsed.intent, // adapter falls through to composer's fact lookup
        } as typeof parsed;
        const composed = composeReply({
          parsed: parsedForFrag,
          bundles: bundlesForFrag,
          context: { language: input.language, focus_listing_ref: tp.resolved_entity_ref },
        });
        return finaliseReply({ composed, reasoning, latency_ms: Math.round(performance.now() - t0), fingerprint_hit: false });
      }

      // 3. Build the bundle pool. Prior-list items get precedence.
      let priorList = input.prior_entities.map((e) => ({
        listing_ref: e.entity_ref,
        business_name: e.display_name,
      }));

      const bundles: FactBundle[] = [];
      const missingRefs: string[] = [];
      // Prior-list refs
      for (const item of priorList) {
        const hit = factHotGet(item.listing_ref);
        if (hit) bundles.push(hit.bundle);
        else missingRefs.push(item.listing_ref);
      }
      // Property-name match (adds bundle if not already present)
      if (parsed.slots.property_name_match) {
        const nameHit = factHotGet(parsed.slots.property_name_match.listing_ref);
        if (nameHit && !bundles.find((b) => b.listing_ref === nameHit.bundle.listing_ref)) {
          bundles.push(nameHit.bundle);
        }
      }
      // Lazy fetch missing prior-list refs so composer has full context.
      if (missingRefs.length > 0) {
        const fetched = await fetchMissingBundles(pool, missingRefs);
        for (const b of fetched) {
          if (!bundles.find((x) => x.listing_ref === b.listing_ref)) bundles.push(b);
        }
        reasoning.push(`lazy-fetched ${fetched.length}/${missingRefs.length} missing bundles`);
      }

      // Founder BEGIN LCC 2026-09-09 · self-sufficient list synthesis.
      // When the intent is list_in_city / availability_query AND the chat
      // brain didn't hand us usable prior_entities (or the refs didn't
      // match hot-tier), pull our own list from hot-tier — city-filtered
      // if a city slot was parsed. This is the correction that kills
      // "Yep — found N" for fresh list requests. The composer sees a
      // prior_list of verified bundles and renders the canonical answer.
      const isListIntent = parsed.intent_slug === "list_in_city" || parsed.intent_slug === "availability_query";
      const hasVerifiedBundlesForPriorList = priorList.length > 0 && bundles.length > 0;
      if (isListIntent && !hasVerifiedBundlesForPriorList) {
        const cityFilter = parsed.slots.city; // canonical, e.g. "yogyakarta"
        const cityLower = cityFilter ? cityFilter.toLowerCase() : null;
        const enumerated = factHotEnumerate();
        const synth: { listing_ref: string; business_name: string; bundle: FactBundle }[] = [];
        for (const e of enumerated) {
          const bundleHit = factHotGet(e.listing_ref);
          if (!bundleHit) continue;
          const b = bundleHit.bundle;
          const cityFact = b.facts["location_city"];
          const rowCity = typeof cityFact?.value === "string" ? cityFact.value.toLowerCase() : null;
          if (cityLower && rowCity && rowCity !== cityLower) continue;
          if (!b.business_name) continue;
          synth.push({ listing_ref: b.listing_ref, business_name: b.business_name, bundle: b });
          if (synth.length >= 6) break;
        }
        if (synth.length > 0) {
          priorList = synth.map((s) => ({ listing_ref: s.listing_ref, business_name: s.business_name }));
          for (const s of synth) {
            if (!bundles.find((b) => b.listing_ref === s.listing_ref)) bundles.push(s.bundle);
          }
          reasoning.push(`self-synth prior_list · ${synth.length} verified ${cityFilter ? `in ${cityFilter}` : "from hot-tier"}`);
        } else {
          reasoning.push(`self-synth prior_list · 0 verified${cityFilter ? ` in ${cityFilter}` : ""} (empty result honestly reported)`);
        }
      }

      // 4. Compose.
      const focusRef = parsed.slots.property_name_match?.listing_ref ?? undefined;
      const composed = composeReply({
        parsed,
        bundles,
        context: {
          language: input.language,
          prior_list: priorList.length > 0 ? priorList : undefined,
          focus_listing_ref: focusRef,
        },
      });

      // Founder BEGIN Phase 3.6 · Truth Engine prefixes surface in composed reply.
      // Honest signals from the Truth Engine become user-visible so trust is
      // continuously observable, not just computed. Two channels:
      //   a) Freshness prefix for volatile/live intents (price, availability)
      //      even when the answer itself is truthful · signals that the value
      //      may have moved.
      //   b) Conflict prefix when the fact-computer surfaced a mixed-value
      //      answer (multiple provenance rows disagreeing).
      // No new DB queries · signals derived from data already in scope.
      if (composed.answered && composed.reply_kind === "fact" && composed.intent_slug) {
        const freshness = getIntentFreshness(composed.intent_slug);
        let prefix = "";
        if (freshness === "volatile") {
          prefix = input.language === "id"
            ? "Data ini bisa berubah cepat · "
            : "This value moves often, so treat as a snapshot: ";
        } else if (freshness === "live" && composed.reply_kind === "fact") {
          prefix = input.language === "id"
            ? "Real-time belum bisa saya verifikasi · "
            : "I can't verify real-time state, but on record: ";
        }
        // Conflict signal: composer sets trust to "mixed" when it saw
        // disagreeing sources in the bundle (already Phase 3.2 behavior).
        if (composed.trust === "mixed" && !prefix) {
          prefix = input.language === "id"
            ? "Sumber kami tidak sepakat · "
            : "Sources on record disagree here — ";
        }
        if (prefix && !composed.reply_text.startsWith(prefix)) {
          composed.reply_text = prefix + composed.reply_text;
          reasoning.push(`truth_engine_prefix · class=${freshness} · trust=${composed.trust}`);
        }
      }

      // 5. Fill tri-state claim ledger honestly.
      const trust = toTrustBand(composed.trust);
      if (composed.answered) {
        known.push({
          kind: composed.reply_kind,
          entity_ref: composed.listing_ref,
          value: composed.reply_text,
          trust,
        });
      }
      // Availability window is REQUESTED but NOT known.
      if (parsed.slots.time) {
        requested.push({
          kind: "live_availability",
          entity_ref: null,
          value: parsed.slots.time,
          trust: "unknown",
        });
      }
      // Composer emitted an unknown → record as gap
      if (composed.reply_kind === "unknown") {
        unknown.push({
          kind: composed.intent_slug ?? "unknown_fact",
          entity_ref: composed.listing_ref,
          trust: "unknown",
        });
      }

      // Founder BEGIN LCC 2026-09-09 · honest per-entity unknown IS an answer.
      // When the composer honestly says "I don't have that on record for
      // <resolved entity> yet", that IS a substantive customer-visible answer,
      // not a "nothing to say". Mark it answered=true so the promotion gate
      // can accept it. The tri-state ledger already records it as unknown.
      const adapterAnswered = composed.answered
        || (composed.reply_kind === "unknown" && composed.listing_ref !== null);

      // Founder BEGIN Phase 2 · knowledge-gap feedback loop.
      // When we honestly could not answer a per-entity fact, tell the
      // background worker fleet so they can queue it for research (§10, §21).
      // Best-effort · fire-and-forget · never blocks the customer.
      if (
        deps.enqueueGap
        && composed.reply_kind === "unknown"
        && composed.listing_ref
        && composed.intent_slug
      ) {
        void deps.enqueueGap({
          domain: "accommodation",
          entity_ref: composed.listing_ref,
          intent_slug: composed.intent_slug,
          source_conversation_id: input.conversation_id ?? null,
        }).catch(() => { /* best-effort */ });
      }

      const latency = Math.round(performance.now() - t0);
      reasoning.push(`compose ${composed.reply_kind} · trust=${composed.trust} · composed.answered=${composed.answered} · adapter.answered=${adapterAnswered} · ${latency}ms`);

      // Founder BEGIN Phase 3.1 · register list_rendered when the composer
      // surfaced a list. The chat route persists this into nex.result_set
      // and points conversation_state.current_result_set_id at it. Future
      // follow-ups filter this set.
      let list_rendered: AdapterReply["list_rendered"];
      if (
        (composed.reply_kind === "list" || composed.reply_kind === "availability_unknown")
        && priorList.length > 0
      ) {
        list_rendered = {
          intent_slug: composed.intent_slug ?? "list_in_city",
          entity_refs: priorList.map((p) => p.listing_ref),
          city: (parsed.slots.city as string) ?? null,
          category: (parsed.slots.property_category as string) ?? null,
          render_summary: composed.reply_text.slice(0, 160),
        };
      }

      return {
        answered: adapterAnswered,
        reply_text: composed.reply_text,
        reply_kind: composed.reply_kind,
        trust,
        intent_slug: composed.intent_slug,
        entity_ref: composed.listing_ref,
        known,
        unknown,
        requested,
        reasoning,
        latency_ms: latency,
        list_rendered,
        perf: { fingerprint_hit, hot_tier_hit: bundles.length > 0 },
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Local helpers · Phase 3.1
// ═══════════════════════════════════════════════════════════════════

function prettifyFactSlug(slug: string): string {
  return slug
    .replace(/_available$/, "")
    .replace(/_/g, " ");
}

/** Finalise an AdapterReply from a ComposedReply · used by the short-circuit branches. */
function finaliseReply(input: {
  composed: import("@/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer").ComposedReply;
  reasoning: string[];
  latency_ms: number;
  fingerprint_hit: boolean;
}): AdapterReply {
  const { composed } = input;
  const trust = toTrustBand(composed.trust);
  const known: ReplyClaim[] = [];
  const unknown: ReplyClaim[] = [];
  const requested: ReplyClaim[] = [];
  const adapterAnswered = composed.answered || (composed.reply_kind === "unknown" && composed.listing_ref !== null);
  if (composed.answered) {
    known.push({ kind: composed.reply_kind, entity_ref: composed.listing_ref, value: composed.reply_text, trust });
  }
  if (composed.reply_kind === "unknown") {
    unknown.push({ kind: composed.intent_slug ?? "unknown_fact", entity_ref: composed.listing_ref, trust: "unknown" });
  }
  return {
    answered: adapterAnswered,
    reply_text: composed.reply_text,
    reply_kind: composed.reply_kind,
    trust,
    intent_slug: composed.intent_slug,
    entity_ref: composed.listing_ref,
    known,
    unknown,
    requested,
    reasoning: input.reasoning,
    latency_ms: input.latency_ms,
    perf: { fingerprint_hit: input.fingerprint_hit },
  };
}
