// Design Memory · schema.
//
// Persistent VISUAL memory (not conversation memory). For every image we ever
// render, we store the full context so that later requests like "make another
// one like last month but with walnut instead of oak" load the prior memory ·
// swap ONE object · re-render · preserve everything else. Never start over.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

export type DesignMemoryEntry = {
  memory_id: string;
  project_id: string;
  captured_at: string;                   // ISO

  original_brief: string;                // user's original request text/voice
  final_rendered_image_url?: string;
  final_rendered_asset_id?: string;      // UniversalAsset id in Asset Library

  design_document: unknown;              // snapshot at render time
  scene_graph?: unknown;
  object_graph?: unknown;

  design_decisions: readonly string[];   // reasoning chain
  reality_checks?: unknown;              // RealityReport at time of render

  measurements?: readonly { path: string; value: number; unit: string; confidence: string }[];

  style_tags: readonly string[];
  compatible_products?: readonly string[];

  customer_edits?: readonly { at: string; command: string; reason?: string }[];
  final_approved_version?: { branch_id: string; version: number };

  render_settings?: {
    theme_pack?: string;
    layout_family?: string;
    camera_profile?: string;
    lighting_profile?: string;
    engine_version?: string;
    determinism_hash?: string;
  };

  quality_score?: {
    overall: number;                     // 0..100
    dimensions?: Record<string, number>;
  };

  // Rule c
  provenance: {
    named_expert: string;
    authored: string;
  };
};

export type DesignMemoryQuery = {
  project_id?: string;
  style_tag_any?: readonly string[];
  since?: string;                        // ISO
  min_quality_score?: number;
  limit?: number;
};

export type DesignMemoryStore = {
  save(entry: DesignMemoryEntry): DesignMemoryEntry;
  get(memory_id: string): DesignMemoryEntry | undefined;
  latest(project_id: string): DesignMemoryEntry | undefined;
  findSimilar(query: DesignMemoryQuery): readonly DesignMemoryEntry[];
  count(): number;
};
