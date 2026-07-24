// Phase 24 catalog Brain hook — an optional wrapper around
// buildSpecialistAgent that gives a specialist a Brain-aware invoker.
//
// When the runtime flag is ON and a Brain matching the requested slug
// is registered + published, the wrapper routes the ask through
// retrieveFromBrains and returns a specialist reply grounded in the
// Brain's own facts + citations. When the flag is OFF, the wrapper
// falls back to the caller-supplied invoker — the existing Phase 24
// knowledge-backed default. Zero behaviour change today.

import { nexBrainRuntimeEnabled } from "./_flag";
import { brainRegistry } from "./_loader";
import { retrieveFromBrains, DomainSeparationError } from "./_router";
import type { Agent, AgentInvocationContext, AgentResult } from "@/lib/nex/orch/types";
import { evidenceFor } from "@/lib/nex/orch/types";

export type BrainAgentWrapperInput = {
  /** The Phase 24 specialist to wrap. The wrapper preserves the
   *  specialist's identity, category, and permissions unchanged. */
  base: Agent;
  /** The Brain slug this specialist consults when the flag is ON. */
  brain_slug: string;
};

/** Wrap a Phase 24 specialist so that when the Brain runtime is live,
 *  answers come from the Author-authored Brain instead of the generic
 *  hammerex_knowledge_entries pool. Falls back to `base.invoke` when
 *  the flag is off or the Brain is not registered. */
export function withBrain({ base, brain_slug }: BrainAgentWrapperInput): Agent {
  const brainInvoke = async (ctx: AgentInvocationContext): Promise<AgentResult> => {
    if (!nexBrainRuntimeEnabled()) return base.invoke(ctx);
    if (!brainRegistry.has(brain_slug))  return base.invoke(ctx);

    try {
      const result = retrieveFromBrains({
        brain_slugs: [brain_slug],
        query:       ctx.focus_ask,
        limit:       3
      });

      if (result.status !== "ok" || result.data.length === 0) {
        return {
          agent_id:    base.id,
          headline:    `Brain '${brain_slug}' has no matching guidance for this ask.`,
          speak:       `The ${base.name} Brain has no matching guidance on file for that specific ask.`,
          confidence:  "low",
          is_official: base.speciality === "regulations",
          evidence:    evidenceFor(`Brain '${brain_slug}'`, [`brain:${brain_slug}`])
        };
      }

      const bullets = result.data
        .map((hit) => `- ${hit.snippet}${hit.evidence[0] ? ` (${hit.evidence[0].source})` : ""}`)
        .join("\n");

      const author = result.provenance.author_attribution[0];
      const attributionLine = author ? ` (authored by ${author})` : "";
      const brainVersion = result.provenance.brain_versions[brain_slug] ?? "unknown";

      return {
        agent_id:    base.id,
        headline:    `${result.data.length} guidance point${result.data.length === 1 ? "" : "s"} from ${base.name} Brain v${brainVersion}${attributionLine}.`,
        speak:       `${base.name} Brain:\n${bullets}`,
        confidence:  result.data.length >= 3 ? "medium" : "low",
        is_official: base.speciality === "regulations",
        evidence:    evidenceFor(`Brain '${brain_slug}' v${brainVersion}`, [`brain:${brain_slug}`]),
        metadata: {
          brain_slug,
          brain_version: brainVersion,
          hit_count:     result.data.length
        }
      };
    } catch (err) {
      if (err instanceof DomainSeparationError) {
        return base.invoke(ctx);
      }
      return {
        agent_id:    base.id,
        headline:    `${base.name} Brain lookup failed.`,
        speak:       `The ${base.name} Brain is on file but couldn't be consulted for this ask.`,
        confidence:  "low",
        is_official: false,
        evidence:    evidenceFor(`Brain '${brain_slug}'`, []),
        error:       err instanceof Error ? err.message : String(err)
      };
    }
  };

  return { ...base, invoke: brainInvoke };
}
