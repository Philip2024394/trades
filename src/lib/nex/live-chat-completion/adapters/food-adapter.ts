// src/lib/nex/live-chat-completion/adapters/food-adapter.ts
//
// Founder Path B · Phase B2 · Food thin adapter.
//
// Uses:
//   · workers/index · normalisation + entity resolution + freshness
//   · knowledge-brain · hybrid retrieve when we have candidate facts
//
// This is DELIBERATELY THIN. The heavy composition logic lives in the
// accommodation adapter today; other domains (food · transport · etc.)
// can plug into that same discipline as their fact schemas mature.
// Until then the adapter returns HONEST UNKNOWN when it has no data,
// which cleanly triggers the downstream Research Brain fallback.
//
// Doctrine anchors preserved: #1 (Truth Engine downstream) ·
// #2 (no actions) · #3 (evidence caps flow through) · #4 (memory only
// as personalization context, never seed).

import type { DomainAdapter, AdapterTurnInput, AdapterReply } from "@/lib/nex/live-chat-completion/contract";
import { normalisationWorker, entityResolutionWorker } from "@/lib/nex/workers";
import { makeDefaultKnowledgeBrain } from "@/lib/nex/knowledge-brain";

const _knowledgeBrain = makeDefaultKnowledgeBrain();

export function makeFoodAdapter(): DomainAdapter {
  return {
    domain: "food",

    async canHandle(input: AdapterTurnInput): Promise<boolean> {
      // Cheap classifier: food-related tokens in the message.
      const msg = String(input.message ?? "").toLowerCase();
      return /\b(restaurant|makan|kuliner|food|nasi|resto|cafe|kafe|warung|menu|dish|meal|breakfast|lunch|dinner|halal|vegetarian|vegan|hala|kopi|coffee|tea|beverage|drink)\b/i.test(msg);
    },

    async compose(input: AdapterTurnInput): Promise<AdapterReply> {
      const t0 = performance.now();
      const ctx = { domain: "food", language: input.language };

      // 1. Normalise query · deterministic.
      const norm = await normalisationWorker(ctx, { text: input.message });

      // 2. Entity resolution against prior list · uses reusable worker.
      const priorNames = input.prior_entities?.map((e) => e.display_name).filter((n): n is string => !!n) ?? [];
      const resolved = await entityResolutionWorker(ctx, {
        free_text: norm.data?.canonical ?? input.message,
        candidate_names: priorNames,
      });

      // 3. Knowledge Brain lookup (BM25 + dense + rerank) scoped to food.
      let kbHits: readonly { text: string; entity_ref?: string | null; scores?: { fused?: number } }[] = [];
      let kbAnswered = false;
      if (_knowledgeBrain) {
        try {
          const ans = await _knowledgeBrain.answer({
            query: norm.data?.canonical ?? input.message,
            language: input.language,
            domain_hint: "food",
            entity_hint: resolved.data?.canonical_name ?? undefined,
            top_k: 5,
            budget_ms: 2000,
          });
          kbAnswered = ans.answered;
          kbHits = ans.hits;
        } catch { /* non-fatal · fall to honest UNKNOWN */ }
      }

      const latencyMs = Math.round(performance.now() - t0);

      // 4. Compose honest reply.
      if (kbAnswered && kbHits.length > 0) {
        const top = kbHits[0];
        return {
          answered: true,
          reply_text: top.text.slice(0, 240),
          reply_kind: "fact",
          trust: "evidence_provisional",
          intent_slug: "food_generic_lookup",
          entity_ref: top.entity_ref ?? null,
          known: [{ kind: "food_generic_lookup", value: top.text.slice(0, 200), trust: "evidence_provisional" }],
          unknown: [],
          requested: [],
          reasoning: [
            `food_adapter · normalised=${norm.data?.canonical ?? ""}`,
            `entity_resolution=${resolved.data?.match_kind ?? "none"}(conf=${resolved.data?.confidence ?? 0})`,
            `knowledge_brain_hits=${kbHits.length}·top_fused=${top.scores?.fused ?? "n/a"}`,
          ],
          latency_ms: latencyMs,
        };
      }

      // Honest UNKNOWN — triggers Research Brain fallback in the chat route.
      return {
        answered: false,
        reply_text: "",
        reply_kind: "unknown",
        trust: "unknown",
        intent_slug: null,
        entity_ref: resolved.data?.canonical_name ? `food_entity:${resolved.data.canonical_name}` : null,
        known: [],
        unknown: [{ kind: "food_lookup", trust: "unknown" }],
        requested: [],
        reasoning: [
          `food_adapter · no substantive knowledge_brain hits`,
          `entity_resolution=${resolved.data?.match_kind ?? "none"}(conf=${resolved.data?.confidence ?? 0})`,
        ],
        latency_ms: latencyMs,
      };
    },
  };
}
