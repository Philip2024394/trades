// src/lib/nex/live-chat-completion/adapters/thin-adapter-factory.ts
//
// Founder Phase 5 · P5-1 · shared factory for thin domain adapters.
//
// Follows the food/transport pattern:
//   1. Cheap regex classifier to answer canHandle()
//   2. Normalisation + entity resolution via reusable workers
//   3. Knowledge Brain lookup scoped to the domain
//   4. Honest UNKNOWN when no data · triggers Research Brain / cross-domain
//
// All 4 doctrines preserved by construction (KB caps trust, memory never
// enters evidence, no actions).

import type { DomainAdapter, AdapterTurnInput, AdapterReply, Domain } from "@/lib/nex/live-chat-completion/contract";
import { normalisationWorker, entityResolutionWorker } from "@/lib/nex/workers";
import { makeDefaultKnowledgeBrain } from "@/lib/nex/knowledge-brain";

const _kb = makeDefaultKnowledgeBrain();

export interface ThinAdapterConfig {
  domain: Domain;
  /** Regex that decides canHandle() · classifier tokens for this domain. */
  handles_re: RegExp;
  /** Intent slug used when the adapter surfaces a KB hit as a fact. */
  generic_intent_slug: string;
  /** Prefix for synthetic entity refs when the query resolves an entity. */
  entity_prefix: string;
}

export function makeThinAdapter(cfg: ThinAdapterConfig): DomainAdapter {
  return {
    domain: cfg.domain,

    async canHandle(input: AdapterTurnInput): Promise<boolean> {
      const msg = String(input.message ?? "").toLowerCase();
      return cfg.handles_re.test(msg);
    },

    async compose(input: AdapterTurnInput): Promise<AdapterReply> {
      const t0 = performance.now();
      const ctx = { domain: cfg.domain, language: input.language };

      const norm = await normalisationWorker(ctx, { text: input.message });
      const priorNames = input.prior_entities?.map((e) => e.display_name).filter((n): n is string => !!n) ?? [];
      const resolved = await entityResolutionWorker(ctx, {
        free_text: norm.data?.canonical ?? input.message,
        candidate_names: priorNames,
      });

      let kbHits: readonly { text: string; entity_ref?: string | null; scores?: { fused?: number } }[] = [];
      let kbAnswered = false;
      if (_kb) {
        try {
          const ans = await _kb.answer({
            query: norm.data?.canonical ?? input.message,
            language: input.language,
            domain_hint: cfg.domain,
            entity_hint: resolved.data?.canonical_name ?? undefined,
            top_k: 5,
            budget_ms: 2000,
          });
          kbAnswered = ans.answered;
          kbHits = ans.hits;
        } catch { /* non-fatal · fall to UNKNOWN */ }
      }

      const latencyMs = Math.round(performance.now() - t0);

      if (kbAnswered && kbHits.length > 0) {
        const top = kbHits[0];
        return {
          answered: true,
          reply_text: top.text.slice(0, 240),
          reply_kind: "fact",
          trust: "evidence_provisional",
          intent_slug: cfg.generic_intent_slug,
          entity_ref: top.entity_ref ?? null,
          known: [{ kind: cfg.generic_intent_slug, value: top.text.slice(0, 200), trust: "evidence_provisional" }],
          unknown: [],
          requested: [],
          reasoning: [
            `${cfg.domain}_adapter · normalised=${norm.data?.canonical ?? ""}`,
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
        entity_ref: resolved.data?.canonical_name ? `${cfg.entity_prefix}:${resolved.data.canonical_name}` : null,
        known: [],
        unknown: [{ kind: `${cfg.domain}_lookup`, trust: "unknown" }],
        requested: [],
        reasoning: [
          `${cfg.domain}_adapter · no substantive knowledge_brain hits`,
          `entity_resolution=${resolved.data?.match_kind ?? "none"}(conf=${resolved.data?.confidence ?? 0})`,
        ],
        latency_ms: latencyMs,
      };
    },
  };
}
