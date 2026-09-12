// src/lib/nex-stories-brain/stories-store.ts
// Read-only loader + deterministic topic classifier + response composer.
// No LLM. No fabrication. Founder-authorised 2026-09-12.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { TopicsDoc, EvidenceTaxonomyDoc, Topic, StoryClassification, StoryResponsePlan, SubClaim, EvidenceTag } from "./types";

let TOPICS_CACHE: TopicsDoc | null = null;
let TAX_CACHE: EvidenceTaxonomyDoc | null = null;

export function loadTopics(): TopicsDoc {
  if (TOPICS_CACHE) return TOPICS_CACHE;
  const p = resolve(process.cwd(), "data/nex1-stories-brain/topics-v0.1.0.json");
  TOPICS_CACHE = JSON.parse(readFileSync(p, "utf8")) as TopicsDoc;
  return TOPICS_CACHE;
}
export function loadEvidenceTaxonomy(): EvidenceTaxonomyDoc {
  if (TAX_CACHE) return TAX_CACHE;
  const p = resolve(process.cwd(), "data/nex1-stories-brain/evidence-taxonomy.json");
  TAX_CACHE = JSON.parse(readFileSync(p, "utf8")) as EvidenceTaxonomyDoc;
  return TAX_CACHE;
}
export function _resetStoriesCache(): void { TOPICS_CACHE = null; TAX_CACHE = null; }

/**
 * @summary Deterministic topic classifier. Alias match wins. If multiple
 * topics match, the longest alias wins (specificity). If none matches,
 * returns null-topic. Never fabricates.
 */
export function classifyStoryTopic(utterance: string): StoryClassification {
  const text = (utterance ?? "").toLowerCase().trim();
  const topics = loadTopics().topics;
  let best: { topic: Topic; alias: string; specificity: number } | null = null;
  for (const t of topics) {
    for (const a of t.aliases) {
      const al = a.toLowerCase();
      if (text.includes(al)) {
        const spec = al.length;
        if (!best || spec > best.specificity) best = { topic: t, alias: a, specificity: spec };
      }
    }
  }
  if (!best) {
    return {
      matched_topic_id: null,
      matched_alias: null,
      rationale: "no topic alias matched · story classification returns UNKNOWN",
      consistency_fingerprint: fingerprint(null, []),
    };
  }
  return {
    matched_topic_id: best.topic.topic_id,
    matched_alias: best.alias,
    rationale: `matched alias '${best.alias}' · topic='${best.topic.topic_id}'`,
    consistency_fingerprint: fingerprint(best.topic.topic_id, best.topic.sub_claims.map((s) => s.id)),
  };
}

/**
 * @summary Compose a semantic response plan for a classified topic. If no
 * topic matched, returns a plan that surfaces UNKNOWN honestly · SB-6
 * refuse-over-fabricate applies.
 */
export function composeStoryResponse(cls: StoryClassification): StoryResponsePlan {
  if (!cls.matched_topic_id) {
    return {
      matched_topic_id: null,
      topic_recognition: "story topic not in the current registry · treat as UNKNOWN · offer to note the topic for future authorisation",
      decomposition: [],
      evidence_by_sub: {},
      layer_summary: "This topic is not currently in NEX's story registry. NEX declines to fabricate an answer.",
      discussion_opener: "I don't currently have a structured answer for that in my story registry. I would rather note the gap honestly than fabricate.",
      offer_to_expand: "If you'd like, I can note this topic for founder review so it enters the registry properly.",
      never_says: ["invented facts about the topic", "confident yes/no when no registry entry exists"],
      evidence_pointers: ["SB-1", "SB-2", "SB-3", "SB-4", "SB-5"],
      consistency_fingerprint: cls.consistency_fingerprint,
      semantic_only: true,
      taught_by: "master_ai_engineer",
    };
  }
  const topic = loadTopics().topics.find((t) => t.topic_id === cls.matched_topic_id)!;
  const evidence_by_sub: Record<string, EvidenceTag> = {};
  for (const s of topic.sub_claims) evidence_by_sub[s.id] = s.evidence;
  return {
    matched_topic_id: topic.topic_id,
    topic_recognition: `recognise this as topic '${topic.display_name}' · domain='${topic.domain}'`,
    decomposition: topic.sub_claims,
    evidence_by_sub,
    layer_summary: topic.layer_summary,
    discussion_opener: topic.discussion_opener,
    offer_to_expand: topic.offer_to_expand,
    never_says: topic.never_says,
    evidence_pointers: ["SB-1", "SB-2", "SB-3", "SB-4", "SB-5", `topic:${topic.topic_id}`],
    consistency_fingerprint: cls.consistency_fingerprint,
    semantic_only: true,
    taught_by: "master_ai_engineer",
  };
}

function fingerprint(topicId: string | null, subIds: readonly string[]): string {
  const s = `${topicId ?? "UNKNOWN"}::${subIds.slice().sort().join("|")}`;
  return "sf_" + createHash("sha256").update(s).digest("hex").slice(0, 12);
}
