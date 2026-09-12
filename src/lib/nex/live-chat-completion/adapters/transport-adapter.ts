// src/lib/nex/live-chat-completion/adapters/transport-adapter.ts
//
// Founder Path B · Phase B2 · Transport thin adapter.
//
// Same shape as food-adapter · uses reusable capability workers +
// Knowledge Brain. Honest UNKNOWN when we have no transport facts yet,
// which cleanly triggers Research Brain in the chat route.

import type { DomainAdapter, AdapterTurnInput, AdapterReply } from "@/lib/nex/live-chat-completion/contract";
import { normalisationWorker, entityResolutionWorker } from "@/lib/nex/workers";
import { makeDefaultKnowledgeBrain } from "@/lib/nex/knowledge-brain";

const _knowledgeBrain = makeDefaultKnowledgeBrain();

export function makeTransportAdapter(): DomainAdapter {
  return {
    domain: "transport",

    async canHandle(input: AdapterTurnInput): Promise<boolean> {
      const msg = String(input.message ?? "").toLowerCase();
      return /\b(train|bus|taxi|grab|gojek|ojek|angkot|becak|bemo|kereta|bis|pesawat|flight|airport|bandara|terminal|station|stasiun|route|rute|schedule|jadwal|fare|tarif|transport|transportation|ride|drive|driver)\b/i.test(msg);
    },

    async compose(input: AdapterTurnInput): Promise<AdapterReply> {
      const t0 = performance.now();
      const ctx = { domain: "transport", language: input.language };

      const norm = await normalisationWorker(ctx, { text: input.message });
      const priorNames = input.prior_entities?.map((e) => e.display_name).filter((n): n is string => !!n) ?? [];
      const resolved = await entityResolutionWorker(ctx, {
        free_text: norm.data?.canonical ?? input.message,
        candidate_names: priorNames,
      });

      let kbHits: readonly { text: string; entity_ref?: string | null; scores?: { fused?: number } }[] = [];
      let kbAnswered = false;
      if (_knowledgeBrain) {
        try {
          const ans = await _knowledgeBrain.answer({
            query: norm.data?.canonical ?? input.message,
            language: input.language,
            domain_hint: "transport",
            entity_hint: resolved.data?.canonical_name ?? undefined,
            top_k: 5,
            budget_ms: 2000,
          });
          kbAnswered = ans.answered;
          kbHits = ans.hits;
        } catch { /* non-fatal */ }
      }

      const latencyMs = Math.round(performance.now() - t0);

      if (kbAnswered && kbHits.length > 0) {
        const top = kbHits[0];
        return {
          answered: true,
          reply_text: top.text.slice(0, 240),
          reply_kind: "fact",
          trust: "evidence_provisional",
          intent_slug: "transport_generic_lookup",
          entity_ref: top.entity_ref ?? null,
          known: [{ kind: "transport_generic_lookup", value: top.text.slice(0, 200), trust: "evidence_provisional" }],
          unknown: [],
          requested: [],
          reasoning: [
            `transport_adapter · normalised=${norm.data?.canonical ?? ""}`,
            `entity_resolution=${resolved.data?.match_kind ?? "none"}(conf=${resolved.data?.confidence ?? 0})`,
            `knowledge_brain_hits=${kbHits.length}·top_fused=${top.scores?.fused ?? "n/a"}`,
          ],
          latency_ms: latencyMs,
        };
      }

      return {
        answered: false,
        reply_text: "",
        reply_kind: "unknown",
        trust: "unknown",
        intent_slug: null,
        entity_ref: resolved.data?.canonical_name ? `transport_entity:${resolved.data.canonical_name}` : null,
        known: [],
        unknown: [{ kind: "transport_lookup", trust: "unknown" }],
        requested: [],
        reasoning: [
          `transport_adapter · no substantive knowledge_brain hits`,
          `entity_resolution=${resolved.data?.match_kind ?? "none"}(conf=${resolved.data?.confidence ?? 0})`,
        ],
        latency_ms: latencyMs,
      };
    },
  };
}
