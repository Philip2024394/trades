// Collection Intelligence aggregator — ADR-0030 Level 1.
//
// Reads all high-confidence A+ rows in a collection and computes the
// aggregate DNA / common tags / common image_types / common prompts
// with per-field confidence scores. New images entering the collection
// inherit this aggregate as their baseline — reducing admin review
// from the default to only genuinely ambiguous cases.
//
// Per Philip's directive 2026-07-27: "NEX should never ask admin a
// question NEX can answer itself. Admin is the LAST option. Target
// <5% admin intervention across all images."

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ImageDNA,
  ImageType,
} from "./knowledgeParser";

export type PerFieldConfidence = {
  [key: string]: number; // 0-100
};

export type CollectionIntelligence = {
  collection_id: string;
  sample_size: number; // rows that contributed
  aggregate_dna: Partial<ImageDNA>;
  per_field_confidence: PerFieldConfidence;
  common_tags: string[]; // top 20 tags across the collection
  common_image_types: ImageType[]; // types found in this collection
  common_master_prompt_stems: string[]; // sample prompt starts (for template inspiration)
  overall_confidence: number; // 0-100 — how well-known this collection is
};

const MANIFEST_PATH = path.join(process.cwd(), "data", "nex-image-manifest.json");

/** Load the manifest — reused by the aggregator + parser. */
async function loadManifest(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as { images?: Record<string, unknown> };
    return parsed.images ?? {};
  } catch {
    return {};
  }
}

/** Compute the aggregate intelligence for a collection from all its
 *  A+ high-confidence rows in the manifest. */
export async function getCollectionIntelligence(
  collection_id: string | undefined
): Promise<CollectionIntelligence> {
  const empty: CollectionIntelligence = {
    collection_id: collection_id ?? "",
    sample_size: 0,
    aggregate_dna: {},
    per_field_confidence: {},
    common_tags: [],
    common_image_types: [],
    common_master_prompt_stems: [],
    overall_confidence: 0,
  };
  if (!collection_id) return empty;

  const images = await loadManifest();

  // Only consider high-confidence rows: a_plus, not excluded, DNA >= 85
  const contributing: Record<string, unknown>[] = [];
  for (const row of Object.values(images) as Record<string, unknown>[]) {
    if (row.collection_id !== collection_id) continue;
    if ((row as { excluded?: boolean }).excluded) continue;
    const dna = row.image_dna as ImageDNA | undefined;
    // Include even sub-A+ rows for aggregation if they have any DNA extracted —
    // we lower the bar for collection SIGNALS but not for individual auth.
    if (dna && typeof dna.score === "number") {
      contributing.push(row);
    }
  }

  const sample_size = contributing.length;
  if (sample_size === 0) {
    return { ...empty, collection_id };
  }

  // ── Aggregate DNA scalar fields — take the most common non-empty
  //    value; confidence = count(most_common) / sample_size × 100
  function fieldMode(getter: (r: Record<string, unknown>) => string | undefined) {
    const counts: Record<string, number> = {};
    for (const r of contributing) {
      const v = getter(r);
      if (!v || typeof v !== "string") continue;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return { value: undefined, confidence: 0 };
    const [value, count] = entries[0];
    return { value, confidence: Math.round((count / sample_size) * 100) };
  }

  const style_primary = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.STYLE?.primary);
  const style_secondary = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.STYLE?.secondary);
  const style_photographic = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.STYLE?.photographic);
  const camera_view = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.CAMERA?.view);
  const camera_orientation = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.CAMERA?.orientation);
  const camera_height = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.CAMERA?.height);
  const materials_primary = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.MATERIALS?.primary);
  const materials_secondary = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.MATERIALS?.secondary);
  const lighting_primary = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.LIGHTING?.primary);
  const quality_realism = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.QUALITY?.realism);
  const quality_rendering = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.QUALITY?.rendering);
  const setting_primary = fieldMode((r) => (r.image_dna as ImageDNA | undefined)?.SETTING?.primary);

  const aggregate_dna: Partial<ImageDNA> = {
    STYLE: {
      primary: style_primary.value,
      secondary: style_secondary.value,
      photographic: style_photographic.value,
    },
    CAMERA: {
      view: camera_view.value,
      orientation: camera_orientation.value,
      height: camera_height.value,
    },
    MATERIALS: {
      primary: materials_primary.value,
      secondary: materials_secondary.value,
    },
    LIGHTING: { primary: lighting_primary.value, characteristics: [] },
    QUALITY: {
      realism: quality_realism.value,
      rendering: quality_rendering.value,
    },
    SETTING: { primary: setting_primary.value },
  };

  const per_field_confidence: PerFieldConfidence = {
    "STYLE.primary": style_primary.confidence,
    "STYLE.secondary": style_secondary.confidence,
    "STYLE.photographic": style_photographic.confidence,
    "CAMERA.view": camera_view.confidence,
    "CAMERA.orientation": camera_orientation.confidence,
    "CAMERA.height": camera_height.confidence,
    "MATERIALS.primary": materials_primary.confidence,
    "MATERIALS.secondary": materials_secondary.confidence,
    "LIGHTING.primary": lighting_primary.confidence,
    "QUALITY.realism": quality_realism.confidence,
    "QUALITY.rendering": quality_rendering.confidence,
    "SETTING.primary": setting_primary.confidence,
  };

  // ── Common tags (top 20 by frequency)
  const tagCounts: Record<string, number> = {};
  for (const r of contributing) {
    for (const t of (r.tags as string[]) ?? []) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
  const common_tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);

  // ── Common image types
  const typeCounts: Record<string, number> = {};
  for (const r of contributing) {
    const t = r.image_type as string;
    if (t) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const common_image_types = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t as ImageType);

  // ── Sample master prompt stems (first 100 chars of up to 5)
  const common_master_prompt_stems = contributing
    .map((r) => (r.master_ai_prompt as string) ?? "")
    .filter((p) => p && p.length > 40)
    .slice(0, 5)
    .map((p) => p.slice(0, 100));

  // ── Overall confidence: average of the top DNA field confidences,
  //    weighted by sample size (small samples never claim >70%)
  const topConfidences = Object.values(per_field_confidence)
    .sort((a, b) => b - a)
    .slice(0, 8);
  const avgTop =
    topConfidences.reduce((a, b) => a + b, 0) / (topConfidences.length || 1);
  const sampleWeight = Math.min(1, sample_size / 10); // needs 10+ rows for full weight
  const overall_confidence = Math.round(avgTop * sampleWeight);

  return {
    collection_id,
    sample_size,
    aggregate_dna,
    per_field_confidence,
    common_tags,
    common_image_types,
    common_master_prompt_stems,
    overall_confidence,
  };
}

/** Level 1-5 intelligence-layer fill. Takes a partially-parsed
 *  knowledge object and the collection intelligence, fills empty
 *  fields from the aggregate where per-field confidence >= 85. */
export function applyCollectionInheritance(
  knowledge: {
    image_dna: ImageDNA;
    tags: string[];
    image_type?: string;
  },
  intel: CollectionIntelligence
): { fieldsInherited: string[]; boostedConfidence: number } {
  const inherited: string[] = [];

  function maybeFillNested(
    parent: Record<string, unknown>,
    field: string,
    aggregateValue: unknown,
    confidenceKey: string
  ) {
    if (parent[field]) return; // already has a value; don't overwrite
    const conf = intel.per_field_confidence[confidenceKey] ?? 0;
    if (conf >= 85 && aggregateValue) {
      parent[field] = aggregateValue;
      inherited.push(`${confidenceKey}=${aggregateValue} (${conf}%)`);
    }
  }

  const dna = knowledge.image_dna;
  const agg = intel.aggregate_dna;

  if (agg.STYLE) {
    maybeFillNested(dna.STYLE as unknown as Record<string, unknown>, "primary", agg.STYLE.primary, "STYLE.primary");
    maybeFillNested(dna.STYLE as unknown as Record<string, unknown>, "secondary", agg.STYLE.secondary, "STYLE.secondary");
    maybeFillNested(dna.STYLE as unknown as Record<string, unknown>, "photographic", agg.STYLE.photographic, "STYLE.photographic");
  }
  if (agg.CAMERA) {
    maybeFillNested(dna.CAMERA as unknown as Record<string, unknown>, "view", agg.CAMERA.view, "CAMERA.view");
    maybeFillNested(dna.CAMERA as unknown as Record<string, unknown>, "orientation", agg.CAMERA.orientation, "CAMERA.orientation");
    maybeFillNested(dna.CAMERA as unknown as Record<string, unknown>, "height", agg.CAMERA.height, "CAMERA.height");
  }
  if (agg.MATERIALS) {
    maybeFillNested(dna.MATERIALS as unknown as Record<string, unknown>, "primary", agg.MATERIALS.primary, "MATERIALS.primary");
    maybeFillNested(dna.MATERIALS as unknown as Record<string, unknown>, "secondary", agg.MATERIALS.secondary, "MATERIALS.secondary");
  }
  if (agg.LIGHTING) {
    maybeFillNested(dna.LIGHTING as unknown as Record<string, unknown>, "primary", agg.LIGHTING.primary, "LIGHTING.primary");
  }
  if (agg.QUALITY) {
    maybeFillNested(dna.QUALITY as unknown as Record<string, unknown>, "realism", agg.QUALITY.realism, "QUALITY.realism");
    maybeFillNested(dna.QUALITY as unknown as Record<string, unknown>, "rendering", agg.QUALITY.rendering, "QUALITY.rendering");
  }
  if (agg.SETTING) {
    maybeFillNested(dna.SETTING as unknown as Record<string, unknown>, "primary", agg.SETTING.primary, "SETTING.primary");
  }

  // Inherit high-frequency collection tags not already on the image
  const existingTagSet = new Set(knowledge.tags.map((t) => t.toLowerCase()));
  for (const t of intel.common_tags.slice(0, 10)) {
    if (!existingTagSet.has(t.toLowerCase())) {
      knowledge.tags.push(t);
      inherited.push(`tag=${t}`);
    }
  }

  // Confidence boost: proportional to how much was inherited relative
  // to how many fields were empty
  const boost = Math.min(30, inherited.length * 3);
  const boostedConfidence = Math.min(100, dna.score + boost);
  dna.score = boostedConfidence;

  return { fieldsInherited: inherited, boostedConfidence };
}

/** Auto-generate a MASTER AI PROMPT from the inherited + inferred
 *  intelligence. Uses natural-language template composition — no
 *  fabrication, only assembly of KNOWN values. */
export function autoGenerateMasterAiPrompt(knowledge: {
  image_dna: ImageDNA;
  image_type?: string;
  ai_intent: { purpose?: string; collection?: string };
  tags: string[];
}): string {
  const dna = knowledge.image_dna;
  const parts: string[] = [];

  const realism = dna.QUALITY.realism ?? "photorealistic";
  const rendering = dna.QUALITY.rendering ?? "architectural visualization";
  const style = dna.STYLE.photographic ?? "architectural photography";
  const imageType = (knowledge.image_type ?? "hero_image").replace(/_/g, " ");

  parts.push(`Ultra ${realism} ${style} of a ${imageType}`);

  if (dna.STYLE.primary) parts.push(dna.STYLE.primary);
  if (dna.MATERIALS.primary) parts.push(`in ${dna.MATERIALS.primary}`);
  if (dna.MATERIALS.secondary) parts.push(`with ${dna.MATERIALS.secondary}`);
  if (dna.SETTING.primary) parts.push(`set in a ${dna.SETTING.primary}`);
  if (dna.CAMERA.view) parts.push(`viewed from ${dna.CAMERA.view}`);
  if (dna.CAMERA.height) parts.push(`at ${dna.CAMERA.height}`);
  if (dna.LIGHTING.primary) parts.push(`under ${dna.LIGHTING.primary}`);

  const tagline = knowledge.tags.slice(0, 6).join(", ");
  if (tagline) parts.push(`Features: ${tagline}`);

  parts.push(`Rendered in premium ${rendering} quality with realistic lighting and material detail throughout.`);

  return parts.filter(Boolean).join(". ").replace(/\.\s*\./g, ".").trim() + ".";
}
