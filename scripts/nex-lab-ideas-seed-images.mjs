#!/usr/bin/env node
// scripts/nex-lab-ideas-seed-images.mjs
//
// Founder 2026-09-10 · Innovation Room · seed image processing + agent learning
// image creation ideas from creative agent (a603...). Idempotent by title.

import { Client } from "pg";

const IDEAS = [
  {
    agent: "creative-agent:image-processing",
    category: "discovery_ui",
    title: "Image Transformation Recipe Registry",
    user_need: "Agents should learn 'oak staircase → walnut variant is popular' from prior user transformation requests, so future users hear 'want walnut too?' automatically.",
    description: "Registry at data/nex-image-transformation-recipes.json records every user transformation request paired with source image DNA + resulting derivative's DNA. Aggregates learning_signals per collection · agents query before asking for clarification.",
    why_missing: "Pattern-learning types exist (src/lib/nex/pattern-learning/types.ts) but transformation pipelines don't mine co-occurrence patterns at image transformation level.",
    evidence_refs: ["src/lib/nex/pattern-learning/types.ts","src/lib/nex/images/globalIntelligencePipeline.ts","docs/DECISIONS/0028-*.md","docs/DECISIONS/0032-*.md"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "Create src/lib/nex/image-transformations/recipeRegistry.ts with recordTransformation(source_url, transformation_type, target_value, outcome_url, success) + suggestTransformations(source_dna, collection_id): Pairing[]. Wire to every banner-generation success path and image-tagger derivative save. Aggregate via ADR-0028 Rule #12 learning signals. Query from chat when users ask for variants.",
  },
  {
    agent: "creative-agent:image-processing",
    category: "chat_answer",
    title: "Family Tree Auto-Discovery Engine",
    user_need: "User asks 'show me all versions of this staircase' · today gets search results · deserves instant family_tree lookup 0.02s.",
    description: "Given a parent image URL, reconstructs complete family tree in <0.05s by following family_tree.parent_url + family_tree.children[] chains from manifest rows. Returns parent + children grouped by image_type (hero, facebook_banner, instagram_banner, etc.) with generation timestamps + confidence.",
    why_missing: "family_tree field is parsed and stored (src/lib/nex/images/knowledgeParser.ts:84) but no retrieval service uses it. Children saved but never queried as a group.",
    evidence_refs: ["src/lib/nex/images/knowledgeParser.ts","src/app/api/admin/image-tagger/save/route.ts","docs/DECISIONS/0028-*.md","docs/DECISIONS/0027-*.md"],
    difficulty: "S",
    user_value: "critical",
    engineering_brief: "getImageFamily(parent_url) returns { parent, children[] }. getFamilyChain(url) walks lineage up and down. Memoize. Export to chat composer + image-detail page. p99 latency < 50ms verified against 100+ images with 3+ children.",
  },
  {
    agent: "creative-agent:image-processing",
    category: "trust_signal",
    title: "Collection Learning Inheritance Validator",
    user_need: "When new image enters collection with 50+ existing images, users need confidence that inherited fields came from collection aggregate DNA, not guesses.",
    description: "validateInheritanceQuality(new_image_knowledge, collection_id, existing_a_plus_rows) computes per-field confidence based on aggregate DNA consistency (≥3 A+ rows) + new image DNA match + confidence drop relative to per-image extraction. Flags <85% collection signal as human-review-required.",
    why_missing: "ADR-0030 defines 6-level stack with Collection Intelligence as Level 1 but parseWithInheritance() doesn't expose inheritance-quality scores to chat/UI.",
    evidence_refs: ["docs/DECISIONS/0030-intelligence-layers-before-admin.md","src/lib/nex/images/collectionIntelligence.ts","src/lib/nex/images/validate.ts","docs/DECISIONS/0032-*.md"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "Compute per-collection aggregate DNA (style_primary, materials_primary) from ≥3 A+ rows. For new images: field_confidence_source per field (per-image DNA vs collection inheritance). If per_image_confidence ≥85% use that; else if collection_signal_consistency ≥85% use inheritance with penalty; else flag review. Return breakdown in /api/admin/image-tagger/score so UI shows '68% extracted · 32% inherited (high confidence)'.",
  },
  {
    agent: "creative-agent:image-processing",
    category: "monetization",
    title: "Generative Derivative Pipeline (Professional tier)",
    user_need: "Merchants on Professional tier want 'make me 8 Facebook banners for this staircase' - agents should auto-generate, geometry-check, then save as children to parent image.",
    description: "generativeDerivativeEngine loads parent image DNA + locked_attributes + geometry_preservation rules · composes MASTER AI PROMPT via Claude · calls SD/Midjourney · runs OpenCV geometry-preservation check (proportions within 98% of parent) · saves children to ImageKit + manifest with family_tree.parent_url. £0.99 per 3-pack via Stripe.",
    why_missing: "Campaign Family plans multi-channel outputs but is a planning/tracking system · no actual image synthesis. Image-gen module exists but not integrated into family-tree pipeline. No automated geometry check.",
    evidence_refs: ["src/lib/nex/campaign-family/types.ts","src/lib/nex/live-chat-completion/image-gen/index.ts","src/lib/nex/images/collectionDNA.ts","docs/DECISIONS/0028-*.md","docs/DECISIONS/0027-*.md","docs/DECISIONS/0034-*.md"],
    difficulty: "L",
    user_value: "critical",
    engineering_brief: "Compose MASTER AI PROMPT + collection DNA rules + derivative type spec into structured gen request. Claude crafts detailed prompt (never manifest → SD direct). Route to SD or Midjourney via env. Per generated image: OpenCV edge-detection for proportion match ≥98% + SIFT/pHash subject-focus match + vision model geometry verification. Save successful variants with strict family_tree.parent_url link. WebSocket progress stream. Test 10+ collections × 5+ derivative types.",
  },
  {
    agent: "creative-agent:image-processing",
    category: "community_layer",
    title: "Agent Learning Signal Aggregator (chat-to-DNA)",
    user_need: "10,000 future user chats should automatically improve collection intelligence · 'make this walnut' should teach the system.",
    description: "Every chat handler detects transformation requests ('make this walnut', 'darker stain', 'add Christmas theme') and records as learning_signal in nex.image_learning_signal table. Hourly job aggregates per collection to update data/nex-collection-dna.json with trending preferences. 200 users request 'walnut' for oak staircases → strong pairing signal for future inheritance.",
    why_missing: "LearningSignal type exists in knowledgeParser.ts but chat paths never write to it. Tagger writes signals for admin edits only · conversational learning absent. No aggregation job.",
    evidence_refs: ["src/lib/nex/images/knowledgeParser.ts","src/lib/nex/pattern-learning/types.ts","docs/DECISIONS/0028-*.md","docs/DECISIONS/0029-*.md","docs/DECISIONS/0032-*.md"],
    difficulty: "L",
    user_value: "critical",
    engineering_brief: "src/lib/nex/learning/conversationSignalDetector.ts with regex+NLP for transformation intent ('make it walnut' → {type: user_requested_material, dimension: material, value: walnut}). Wire to /api/nex/converse route. Each chat turn publishes to nex.image_learning_signal table. Cron /api/cron/aggregate-learning-signals hourly reads signals per collection, computes Pairing[] (support/confidence), updates nex-collection-dna.json. Test with 1000 simulated signals.",
  },
  {
    agent: "creative-agent:image-processing",
    category: "chat_answer",
    title: "Zero-Image Understanding Dashboard (kills '0 results')",
    user_need: "User asks 'sustainable hardwood staircase with glass balustrade and industrial lighting' · today gets 0 results · deserves NEX to understand fragments + offer derived paths (ADR-0034 gold standard).",
    description: "queryDecomposer parses into knowledge fragments (material: hardwood · sustainability: eco-cert · balustrade_type: glass · lighting_style: industrial). Per fragment: confidence + matching A+ rows + similar designs + references. UI shows 'NEX understood 89% of query' + buttons for derived paths: generate concept · find references · show similar.",
    why_missing: "queryDecomposer returns flat intent classification not fragment-level scoring. Chat with zero image matches doesn't offer fallback intelligence. ADR-0034 explicitly bans '0 results found' but replacement doesn't exist.",
    evidence_refs: ["src/lib/nex/knowledge/queryDecomposer.ts","docs/DECISIONS/0034-*.md","docs/DECISIONS/0028-*.md","src/lib/nex/centre-publishing/imageMatcher.ts"],
    difficulty: "M",
    user_value: "critical",
    engineering_brief: "Extend queryDecomposer to return { fragments: [{ name, type, value, confidence, matching_images[], similar_designs[], reference_links[] }] }. Per fragment: matcher at 0.60 floor + aggregate DNA + reference links. When chat gets zero image match: if total_understanding > 80%, surface understanding dashboard + generate/find/show buttons. Never return empty without breakdown.",
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  let inserted = 0, skipped = 0;
  for (const idea of IDEAS) {
    try {
      const existing = await c.query(`SELECT idea_id FROM nex_lab.innovation_ideas WHERE title = $1 LIMIT 1`, [idea.title]);
      if (existing.rows.length > 0) { skipped++; continue; }
      await c.query(
        `INSERT INTO nex_lab.innovation_ideas
           (generated_by_agent, category, title, user_need, description, why_missing, evidence_refs, engineering_brief, difficulty, user_value, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'proposed')`,
        [idea.agent, idea.category, idea.title, idea.user_need, idea.description, idea.why_missing, JSON.stringify(idea.evidence_refs), idea.engineering_brief, idea.difficulty, idea.user_value],
      );
      inserted++;
    } catch (err) { console.error(`ERR on "${idea.title}": ${err.message}`); }
  }
  console.log(`image-batch: seeded ${inserted} new ideas · ${skipped} already existed`);
  await c.end();
}
main().catch(err => { console.error("fatal:", err.message); process.exit(1); });
