// Global Intelligence Pipeline — ADR-0031.
//
// 7-pass processor that reads every candidate image, builds
// intelligence across the whole set, then saves atomically at Pass 7.
// No per-image saves. Image N benefits from image N+1 and vice versa.
//
// Passes:
//   1. Collection Intelligence  — cluster into collections
//   2. Relationship Intelligence — parent/sibling detection
//   3. Material Journey Intelligence — stage-of-N sequences
//   4. DNA Intelligence — extract + compute cross-collection patterns
//   5. MASTER AI PROMPT Generation — compose from real inherited values
//   6. Confidence Scoring — 100-pt MASTER IMAGE SCORE (ADR-0032)
//   7. SAVE — atomic manifest write
//
// Per ADR-0032: measurement is intelligence-first, not image-count-first.

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  parseImageKnowledge,
  computeDNAHash,
  type ImageKnowledge,
  type ImageDNA,
} from "./knowledgeParser";
import { autoGenerateMasterAiPrompt } from "./collectionIntelligence";

// ── Types for pipeline internal state ────────────────────────────

type Candidate = {
  url: string;
  contexts: Array<{
    source?: string | null;
    category?: string | null;
    question?: string | null;
    caption?: string | null;
    material?: string | null;
    wood?: string | null;
    notes?: string | null;
    role?: string | null;
    answer_excerpt?: string | null;
  }>;
  origin?: string;
  purpose?: string;
  referring_files?: string[];
};

type PipelineState = {
  candidates: Candidate[];
  provisionalDescriptions: Map<string, string>; // url → assembled MASTER DESCRIPTION
  provisionalKnowledge: Map<string, ImageKnowledge>; // url → parsed knowledge
  collectionMemberships: Map<string, string[]>; // url → collection ids (Knowledge Master graph)
  collectionAggregates: Map<string, CollectionAggregate>; // collection_id → aggregate stats
  relationships: Map<string, string[]>; // url → sibling urls
  journeyMap: Map<string, JourneyMember>; // url → journey membership
  confidence: Map<string, ConfidenceBreakdown>; // url → per-axis scores
};

type CollectionAggregate = {
  collection_id: string;
  sample_size: number;
  dominant: {
    style_primary?: string;
    materials_primary?: string;
    setting_primary?: string;
    lighting_primary?: string;
    camera_view?: string;
    quality_realism?: string;
    quality_rendering?: string;
  };
  common_tags: string[];
  confidence: number;
};

type JourneyMember = {
  journey_id: string;
  stage_number?: number;
  total_stages?: number;
};

type ConfidenceBreakdown = {
  image_intelligence: number; // /20
  collection_intelligence: number; // /20
  relationship_intelligence: number; // /20
  future_intelligence: number; // /20
  creative_intelligence: number; // /20
  master_score: number; // /100 (sum)
  overall_confidence: number; // 0-100 (for legacy validator)
};

export type PipelineReport = {
  total_images: number;
  collections_discovered: number;
  relationships_discovered: number;
  material_journeys_discovered: number;
  master_ai_prompts_created: number;
  // ADR-0035 · classify never reject
  clean_saves: number; // master + excellent + good bands (score >= 75)
  drafts_only: number; // deprecated (always 0) — kept for backwards compat
  rejected: number; // deprecated (always 0) — kept for backwards compat
  brains_assigned: Record<string, number>;
  band_counts: Record<string, number>; // 7 knowledge bands
  specialist_and_below: number; // specialist + reference + limited + visual
  per_pass_duration_ms: Record<string, number>;
  audit_log_path: string;
};

// ── Helper — canonicalise URL (strip cache-bust params) ──────────

function canonical(url: string): string {
  return url.split("?")[0];
}

// ── Pass 1 — Collection Intelligence ────────────────────────────

function inferCollectionMemberships(
  candidate: Candidate,
  description: string
): string[] {
  const collections = new Set<string>();
  const t = (description + " " + JSON.stringify(candidate.contexts)).toLowerCase();

  // Content-based classification — every image can belong to MANY
  // collections per ADR-0032 Knowledge Master rule
  if (/staircase|stair|balustrade|newel|tread|riser|handrail|banister/.test(t)) {
    collections.add("staircases");
    if (/luxury|premium|architectural|floating|cantilever/.test(t)) {
      collections.add("luxury_staircases");
    }
    if (/interior|home|living/.test(t)) collections.add("luxury_interiors");
  }
  if (/oak|walnut|pine|hardwood|softwood|timber|wood grain/.test(t)) {
    collections.add("timber_samples");
  }
  if (/manufactur|workshop|production|machining|joinery/.test(t)) {
    collections.add("manufacturing");
  }
  if (/material journey|stage \d+/.test(t)) {
    collections.add("material_journeys");
  }
  if (/pinterest|social/.test(t)) {
    collections.add("pinterest_collections");
  }
  if (/logo|brand mark/.test(t)) collections.add("brand_assets");
  if (/hero|banner|cover/.test(t)) collections.add("hero_images");
  if (/facebook|instagram|social media/.test(t)) collections.add("social_media_assets");
  if (/website|homepage/.test(t)) collections.add("website_assets");
  if (/educational|teach|learn|diagram/.test(t)) collections.add("educational_graphics");
  if (/install|guide|how to/.test(t)) collections.add("installation_guides");
  if (/product|catalogue/.test(t)) collections.add("product_images");
  if (/avatar|profile/.test(t)) collections.add("avatars");
  if (/transparent|isolated|cutout/.test(t)) collections.add("transparent_assets");
  if (candidate.origin === "imagekit-nex-era") collections.add("nex_ai_generated");
  if (candidate.origin === "imagekit-legacy") collections.add("legacy_networkers_assets");

  if (collections.size === 0) collections.add("unclassified");
  return [...collections];
}

// ── Pass 2 — Relationships ──────────────────────────────────────

const MONTH_3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function extractTimestamp(url: string): number | null {
  const filename = decodeURIComponent(url.split("/").pop() ?? "");
  const m = filename.match(
    /(?:ChatGPT\s+Image\s+)?(\w{3,9})\s+(\d{1,2}),\s+(\d{4}),?\s+(\d{1,2})_(\d{2})_(\d{2})\s*(AM|PM)/i
  );
  if (!m) return null;
  const monIdx = MONTH_3.indexOf(m[1].slice(0, 3));
  if (monIdx < 0) return null;
  let hour = Number.parseInt(m[4], 10);
  if (m[7].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (m[7].toUpperCase() === "AM" && hour === 12) hour = 0;
  return Date.UTC(Number.parseInt(m[3], 10), monIdx, Number.parseInt(m[2], 10), hour, Number.parseInt(m[5], 10), Number.parseInt(m[6], 10));
}

function detectRelationships(candidates: Candidate[]): Map<string, string[]> {
  const rel = new Map<string, string[]>();
  // Timestamp-adjacent siblings (within 5 minutes)
  const timestamped = candidates
    .map((c) => ({ url: c.url, ts: extractTimestamp(c.url) }))
    .filter((x) => x.ts !== null)
    .sort((a, b) => a.ts! - b.ts!);
  for (let i = 0; i < timestamped.length; i++) {
    const siblings: string[] = [];
    for (let j = Math.max(0, i - 2); j < Math.min(timestamped.length, i + 3); j++) {
      if (j === i) continue;
      const delta = Math.abs(timestamped[i].ts! - timestamped[j].ts!);
      if (delta < 5 * 60 * 1000) siblings.push(timestamped[j].url);
    }
    if (siblings.length > 0) rel.set(timestamped[i].url, siblings);
  }
  return rel;
}

// ── Pass 3 — Material Journey ──────────────────────────────────

function detectJourney(
  candidate: Candidate,
  description: string
): JourneyMember | null {
  const m = description.match(/Stage\s+(\d+)\s*(?:of\s+(\d+))?/i);
  if (!m) return null;
  const collectionHint =
    candidate.contexts.find((c) => c.category)?.category ?? "unknown";
  return {
    journey_id: collectionHint.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_journey",
    stage_number: Number.parseInt(m[1], 10),
    total_stages: m[2] ? Number.parseInt(m[2], 10) : undefined,
  };
}

// ── Pass 4 — Compute cross-collection DNA patterns ─────────────

function computeCollectionAggregates(state: PipelineState): void {
  // Group knowledge by collection
  const byCollection = new Map<string, ImageKnowledge[]>();
  for (const [url, memberships] of state.collectionMemberships) {
    const knowledge = state.provisionalKnowledge.get(url);
    if (!knowledge) continue;
    for (const cid of memberships) {
      if (!byCollection.has(cid)) byCollection.set(cid, []);
      byCollection.get(cid)!.push(knowledge);
    }
  }

  for (const [collection_id, members] of byCollection) {
    const dominant = {
      style_primary: mode(members.map((k) => k.image_dna.STYLE.primary)),
      materials_primary: mode(members.map((k) => k.image_dna.MATERIALS.primary)),
      setting_primary: mode(members.map((k) => k.image_dna.SETTING.primary)),
      lighting_primary: mode(members.map((k) => k.image_dna.LIGHTING.primary)),
      camera_view: mode(members.map((k) => k.image_dna.CAMERA.view)),
      quality_realism: mode(members.map((k) => k.image_dna.QUALITY.realism)),
      quality_rendering: mode(members.map((k) => k.image_dna.QUALITY.rendering)),
    };
    const tagCounts = new Map<string, number>();
    for (const k of members) {
      for (const t of k.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const common_tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([t]) => t);
    // Confidence: how well-defined this collection is by its aggregates
    const filledDominant = Object.values(dominant).filter(Boolean).length;
    const sampleWeight = Math.min(1, members.length / 5); // 5+ members = full weight
    const confidence = Math.round(
      (filledDominant / 7) * 100 * sampleWeight
    );
    state.collectionAggregates.set(collection_id, {
      collection_id,
      sample_size: members.length,
      dominant,
      common_tags,
      confidence,
    });
  }
}

function mode(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) return undefined;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ── Pass 5 — Apply cross-collection inheritance + auto-generate prompts ─

function applyGlobalInheritance(state: PipelineState): void {
  for (const [url, knowledge] of state.provisionalKnowledge) {
    const memberships = state.collectionMemberships.get(url) ?? [];
    // Find strongest collection this image belongs to
    let bestAggregate: CollectionAggregate | null = null;
    for (const cid of memberships) {
      const agg = state.collectionAggregates.get(cid);
      if (!agg) continue;
      if (!bestAggregate || agg.confidence > bestAggregate.confidence) {
        bestAggregate = agg;
      }
    }
    if (!bestAggregate || bestAggregate.confidence < 40) continue;

    // Fill empty DNA fields from dominant values
    const dna = knowledge.image_dna;
    const d = bestAggregate.dominant;
    if (!dna.STYLE.primary && d.style_primary) dna.STYLE.primary = d.style_primary;
    if (!dna.MATERIALS.primary && d.materials_primary) dna.MATERIALS.primary = d.materials_primary;
    if (!dna.SETTING.primary && d.setting_primary) dna.SETTING.primary = d.setting_primary;
    if (!dna.LIGHTING.primary && d.lighting_primary) dna.LIGHTING.primary = d.lighting_primary;
    if (!dna.CAMERA.view && d.camera_view) dna.CAMERA.view = d.camera_view;
    if (!dna.QUALITY.realism && d.quality_realism) dna.QUALITY.realism = d.quality_realism;
    if (!dna.QUALITY.rendering && d.quality_rendering) dna.QUALITY.rendering = d.quality_rendering;

    // Merge collection common_tags into image tags
    const existingTags = new Set(knowledge.tags.map((t) => t.toLowerCase()));
    for (const t of bestAggregate.common_tags.slice(0, 8)) {
      if (!existingTags.has(t.toLowerCase())) knowledge.tags.push(t);
    }

    // Auto-generate MASTER AI PROMPT if missing/thin
    if (!knowledge.master_ai_prompt || knowledge.master_ai_prompt.trim().length < 40) {
      knowledge.master_ai_prompt = autoGenerateMasterAiPrompt({
        image_dna: knowledge.image_dna,
        image_type: knowledge.image_type,
        ai_intent: knowledge.ai_intent,
        tags: knowledge.tags,
      });
    }

    // Rehash DNA post-inheritance
    knowledge.image_dna.hash = computeDNAHash(knowledge.image_dna);
  }
}

// ── Pass 6 — MASTER IMAGE SCORE (ADR-0032, 100 pts across 5 axes) ─

function computeMasterImageScore(
  url: string,
  state: PipelineState
): ConfidenceBreakdown {
  const knowledge = state.provisionalKnowledge.get(url)!;
  const memberships = state.collectionMemberships.get(url) ?? [];
  const relationships = state.relationships.get(url) ?? [];
  const journey = state.journeyMap.get(url);

  // 20 · Image Intelligence — DNA fill ratio
  const dnaFilled = countFilled([
    knowledge.image_dna.STYLE.primary,
    knowledge.image_dna.STYLE.secondary,
    knowledge.image_dna.STYLE.photographic,
    knowledge.image_dna.CAMERA.view,
    knowledge.image_dna.CAMERA.orientation,
    knowledge.image_dna.CAMERA.height,
    knowledge.image_dna.MATERIALS.primary,
    knowledge.image_dna.MATERIALS.secondary,
    knowledge.image_dna.LIGHTING.primary,
    knowledge.image_dna.QUALITY.realism,
    knowledge.image_dna.QUALITY.rendering,
    knowledge.image_dna.SETTING.primary,
  ]);
  const image_intelligence = Math.round((dnaFilled / 12) * 20);

  // 20 · Collection Intelligence — richness of collection membership
  const collection_intelligence = Math.min(
    20,
    memberships.length * 3 + (memberships.length > 0 ? 5 : 0)
  );

  // 20 · Relationship Intelligence — siblings + parent/child
  const relationship_intelligence = Math.min(
    20,
    relationships.length * 4 + (knowledge.family_tree.parent_url ? 4 : 0)
  );

  // 20 · Future Intelligence — recreation-readiness
  const promptOK = knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 80 ? 8 : 0;
  const lockedOK = knowledge.locked_attributes.must_keep.length > 0 ? 4 : 0;
  const canBecomeOK = Math.min(6, knowledge.can_become.length);
  const journeyOK = journey ? 2 : 0;
  const future_intelligence = promptOK + lockedOK + canBecomeOK + journeyOK;

  // 20 · Creative Intelligence — derivative-type richness
  const creative_intelligence = Math.min(20, knowledge.can_become.length * 3);

  const master_score =
    image_intelligence +
    collection_intelligence +
    relationship_intelligence +
    future_intelligence +
    creative_intelligence;

  return {
    image_intelligence,
    collection_intelligence,
    relationship_intelligence,
    future_intelligence,
    creative_intelligence,
    master_score,
    overall_confidence: master_score, // 0-100 same scale
  };
}

function countFilled(values: (string | undefined)[]): number {
  return values.filter((v) => v && v.length > 0).length;
}

// ── The pipeline entry point ────────────────────────────────────

export async function runGlobalIntelligencePipeline(input: {
  candidates: Candidate[];
  contextMap: Map<string, Candidate["contexts"]>;
  assembleMasterDescription: (candidate: Candidate, contexts: Candidate["contexts"]) => string;
}): Promise<{ report: PipelineReport; manifestRows: Record<string, ImageKnowledge & { master_image_score: ConfidenceBreakdown; collection_memberships: string[] }> }> {
  const startTimes: Record<string, number> = {};
  const durations: Record<string, number> = {};

  const state: PipelineState = {
    candidates: input.candidates,
    provisionalDescriptions: new Map(),
    provisionalKnowledge: new Map(),
    collectionMemberships: new Map(),
    collectionAggregates: new Map(),
    relationships: new Map(),
    journeyMap: new Map(),
    confidence: new Map(),
  };

  // Pass 1 — Collection Intelligence
  startTimes.pass1 = Date.now();
  for (const c of input.candidates) {
    const url = canonical(c.url);
    const contexts = input.contextMap.get(url) ?? c.contexts ?? [];
    const description = input.assembleMasterDescription(c, contexts);
    state.provisionalDescriptions.set(url, description);
    const memberships = inferCollectionMemberships(c, description);
    state.collectionMemberships.set(url, memberships);
  }
  durations.pass1_collections_ms = Date.now() - startTimes.pass1;

  // Pass 2 — Relationships
  startTimes.pass2 = Date.now();
  state.relationships = detectRelationships(input.candidates);
  durations.pass2_relationships_ms = Date.now() - startTimes.pass2;

  // Pass 3 — Material Journeys
  startTimes.pass3 = Date.now();
  for (const c of input.candidates) {
    const url = canonical(c.url);
    const desc = state.provisionalDescriptions.get(url) ?? "";
    const journey = detectJourney(c, desc);
    if (journey) state.journeyMap.set(url, journey);
  }
  durations.pass3_journeys_ms = Date.now() - startTimes.pass3;

  // Pass 4 — DNA Intelligence + cross-collection patterns
  startTimes.pass4 = Date.now();
  for (const [url, description] of state.provisionalDescriptions) {
    const knowledge = parseImageKnowledge({ master_description: description, master_ai_prompt: null });
    state.provisionalKnowledge.set(url, knowledge);
  }
  computeCollectionAggregates(state);
  durations.pass4_dna_ms = Date.now() - startTimes.pass4;

  // Pass 5 — Apply inheritance + auto-generate prompts
  startTimes.pass5 = Date.now();
  applyGlobalInheritance(state);
  durations.pass5_prompts_ms = Date.now() - startTimes.pass5;

  // Pass 6 — Master Image Score
  startTimes.pass6 = Date.now();
  for (const url of state.provisionalKnowledge.keys()) {
    state.confidence.set(url, computeMasterImageScore(url, state));
  }
  durations.pass6_scoring_ms = Date.now() - startTimes.pass6;

  // Pass 7 — CLASSIFY, NEVER REJECT per ADR-0035 SECOND LAW.
  // Every image saves into the manifest with its knowledge band.
  // No rejections. `primary_brain: null` is honest, not disqualifying —
  // the row saves and the classifier can re-run later when more
  // collection intelligence exists.
  startTimes.pass7 = Date.now();
  const rows: Record<
    string,
    ImageKnowledge & {
      master_image_score: ConfidenceBreakdown;
      collection_memberships: string[];
      knowledge_band: string;
      knowledge_band_label: string;
    }
  > = {};
  const { knowledgeBandFromScore, knowledgeBandLabel } = await import("./knowledgeParser");
  const bandCounts: Record<string, number> = {
    master: 0,
    excellent: 0,
    good: 0,
    specialist: 0,
    reference: 0,
    limited: 0,
    visual: 0,
  };
  let master_ai_prompts_created = 0;
  const brains_assigned: Record<string, number> = {};

  for (const [url, knowledge] of state.provisionalKnowledge) {
    const score = state.confidence.get(url)!;
    const memberships = state.collectionMemberships.get(url) ?? [];
    if (knowledge.master_ai_prompt && knowledge.master_ai_prompt.length > 40) {
      master_ai_prompts_created++;
    }

    const band = knowledgeBandFromScore(score.master_score);
    bandCounts[band] = (bandCounts[band] ?? 0) + 1;

    if (knowledge.primary_brain) {
      brains_assigned[knowledge.primary_brain] =
        (brains_assigned[knowledge.primary_brain] ?? 0) + 1;
    }

    rows[url] = {
      ...knowledge,
      master_image_score: score,
      collection_memberships: memberships,
      knowledge_band: band,
      knowledge_band_label: knowledgeBandLabel(band),
    };
  }
  const clean_saves = bandCounts.master + bandCounts.excellent + bandCounts.good;
  const specialist_and_below =
    bandCounts.specialist + bandCounts.reference + bandCounts.limited + bandCounts.visual;
  const rejected = 0; // ADR-0035 — never reject
  durations.pass7_save_ms = Date.now() - startTimes.pass7;

  // Audit log
  const auditDir = path.join(process.cwd(), "data", "nex-pipeline-audit");
  await fs.mkdir(auditDir, { recursive: true });
  const auditPath = path.join(
    auditDir,
    `pipeline-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  await fs.writeFile(
    auditPath,
    JSON.stringify(
      {
        run_at: new Date().toISOString(),
        durations,
        collections_discovered: state.collectionAggregates.size,
        relationships_discovered: state.relationships.size,
        material_journeys_discovered: new Set([...state.journeyMap.values()].map((j) => j.journey_id)).size,
        collection_aggregates: [...state.collectionAggregates.entries()],
      },
      null,
      2
    )
  );

  const report: PipelineReport = {
    total_images: input.candidates.length,
    collections_discovered: state.collectionAggregates.size,
    relationships_discovered: state.relationships.size,
    material_journeys_discovered: new Set(
      [...state.journeyMap.values()].map((j) => j.journey_id)
    ).size,
    master_ai_prompts_created,
    clean_saves,
    drafts_only: 0, // deprecated per ADR-0035
    rejected, // always 0 per ADR-0035
    brains_assigned,
    per_pass_duration_ms: durations,
    audit_log_path: auditPath,
    // ADR-0035 band counters
    band_counts: bandCounts,
    specialist_and_below,
  } as PipelineReport;

  return { report, manifestRows: rows };
}
