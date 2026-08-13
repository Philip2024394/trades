// Vision Intelligence Platform · MVP analyzer.
//
// MVP composes a VisionAnalysis from caller-provided hints + heuristic
// scoring. Real vision-model integration is deferred · the contract stays
// stable so future upgrades slot in without breaking consumers.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import type {
  VisionAnalysis, VisionHint, DetectedObject, ShapeSignature,
  RelationshipEdge, DirectionalProfile, MoodProfile, StyleDNA,
  SceneAnalysis, KnowledgeGraphNode,
} from "./types";

const ANALYSER_VERSION = "e9_vision_mvp_1.0";

const WARM_PALETTE = new Set(["oak", "walnut", "brass", "cream", "beige", "warm_neutral", "amber", "terracotta"]);
const COOL_PALETTE = new Set(["steel", "concrete", "charcoal", "black", "chrome", "aluminium", "grey", "cool_blue"]);

function scoreWarmth(materials: readonly string[], palette: readonly string[], lightingK?: number): number {
  const combined = [...materials, ...palette].map((s) => s.toLowerCase());
  const warmHits = combined.filter((s) => WARM_PALETTE.has(s)).length;
  const coolHits = combined.filter((s) => COOL_PALETTE.has(s)).length;
  const balance = warmHits + coolHits === 0 ? 50 : Math.round((warmHits / (warmHits + coolHits)) * 100);
  // Lighting temperature nudges the score · < 3200K adds warmth · > 5000K removes.
  if (lightingK === undefined) return balance;
  if (lightingK <= 2700) return Math.min(100, balance + 10);
  if (lightingK <= 3500) return Math.min(100, balance + 5);
  if (lightingK >= 5000) return Math.max(0, balance - 10);
  return balance;
}

function classifyContrast(palette: readonly string[]): "low" | "medium" | "high" {
  const p = palette.map((s) => s.toLowerCase());
  const hasDark = p.some((s) => ["black", "charcoal", "walnut", "steel", "night"].includes(s));
  const hasLight = p.some((s) => ["cream", "white", "beige", "oak"].includes(s));
  if (hasDark && hasLight) return "high";
  if (hasDark || hasLight) return "medium";
  return "low";
}

function moodLabel(warmth: number, contrast: "low" | "medium" | "high", style: string | undefined, materials: readonly string[]): string {
  const m = materials.map((s) => s.toLowerCase());
  const industrialSignal = m.some((s) => ["steel", "concrete", "charcoal", "chrome"].includes(s));
  if (warmth >= 80 && contrast === "low") return "relaxed";
  if (warmth >= 80 && contrast === "high") return "cosy_dramatic";
  if (warmth <= 30 && industrialSignal) return "industrial";
  if (warmth <= 30 && contrast === "low") return "minimalist";
  if (style?.includes("scandinavian")) return "airy_scandinavian";
  return "balanced";
}

function detectStyleDNA(hint: VisionHint, materials: readonly string[]): StyleDNA {
  const weights: Record<string, number> = { traditional: 0, contemporary: 0, scandinavian: 0, industrial: 0, luxury: 0 };
  const materialSet = new Set(materials.map((m) => m.toLowerCase()));

  if (materialSet.has("oak") || materialSet.has("brass") || materialSet.has("walnut")) weights.traditional += 0.3;
  if (materialSet.has("steel") || materialSet.has("concrete") || materialSet.has("charcoal")) weights.industrial += 0.4;
  if (materialSet.has("oak") && hint.known_lighting?.includes("warm")) weights.scandinavian += 0.2;
  if (materialSet.has("walnut") || materialSet.has("brass") || materialSet.has("marble")) weights.luxury += 0.2;
  if (materialSet.has("aluminium") || materialSet.has("chrome")) weights.contemporary += 0.3;
  if (hint.known_style) weights[hint.known_style] = (weights[hint.known_style] ?? 0) + 0.3;

  const sum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  for (const k of Object.keys(weights)) weights[k] = Math.round((weights[k] / sum) * 100) / 100;

  return {
    weights,
    timber: materials.find((m) => ["oak", "walnut", "pine", "mahogany", "ash"].includes(m.toLowerCase())),
    hardware: materials.find((m) => ["brass", "steel", "chrome", "aluminium"].includes(m.toLowerCase())),
    palette: hint.known_palette?.[0] ?? "warm_neutral",
    lighting: hint.known_lighting,
    mood: weights.luxury > 0.3 ? "luxury" : weights.industrial > 0.3 ? "industrial" : "everyday",
  };
}

function buildGraph(hint: VisionHint, objects: readonly DetectedObject[], scene: SceneAnalysis): KnowledgeGraphNode {
  return {
    id: hint.source_asset_id,
    kind: "image",
    properties: { room_type: scene.room_type, style: scene.style },
    children: [
      {
        id: `${hint.source_asset_id}#room`,
        kind: "room",
        properties: { type: scene.room_type, contains: scene.contains },
        children: objects.map((o) => ({
          id: o.object_id,
          kind: "object",
          properties: { type: o.type, material: o.material, confidence: o.confidence },
        })),
      },
    ],
  };
}

/** MVP analyzer · consumes a hint context and produces a complete VisionAnalysis.
 *  Never invents object types not supplied by the hint · marks confidence
 *  accordingly. Vision-model integration replaces the internals · not the shape. */
export function analyze(hint: VisionHint): VisionAnalysis {
  const objects: DetectedObject[] = (hint.known_object_types ?? []).map((t, idx) => ({
    object_id: `${hint.source_asset_id}#obj_${idx + 1}`,
    type: t,
    confidence: 0.9,
    material: hint.known_materials?.[idx] ?? hint.known_materials?.[0],
  }));

  const shapes: Record<string, ShapeSignature> = {};
  for (const o of objects) {
    shapes[o.object_id] = { primary_shape: "rectangle", secondary_shapes: [], edge_treatment: "sharp", proportions: "medium", style_class: hint.known_style as ShapeSignature["style_class"] ?? "unknown" };
  }

  const relationships: RelationshipEdge[] = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      if (objects[i].material && objects[j].material && objects[i].material === objects[j].material) {
        relationships.push({ from_id: objects[i].object_id, to_id: objects[j].object_id, kind: "matches_material" });
      }
    }
  }

  const directional: DirectionalProfile = { camera_orientation: "eye_level", perspective: "2_point" };

  const materials = hint.known_materials ?? [];
  const palette = hint.known_palette ?? materials;
  const warmth = scoreWarmth(materials, palette);
  const contrast = classifyContrast(palette);
  const mood: MoodProfile = {
    colour_temperature: warmth >= 70 ? "warm" : warmth <= 30 ? "cool" : "neutral",
    dominant_palette: palette,
    dominant_materials: materials,
    contrast,
    mood_label: moodLabel(warmth, contrast, hint.known_style, materials),
    style_label: hint.known_style ?? "unspecified",
    overall_warmth_score: warmth,
  };

  const style_dna = detectStyleDNA(hint, materials);

  const scene: SceneAnalysis = {
    room_type: hint.known_room_type,
    contains: objects.map((o) => o.type),
    lighting_kind: hint.known_lighting,
    style: hint.known_style,
  };

  return {
    source_asset_id: hint.source_asset_id,
    objects,
    shape_signatures: shapes,
    relationships,
    directional,
    mood,
    style_dna,
    scene,
    knowledge_graph: buildGraph(hint, objects, scene),
    analyser_version: ANALYSER_VERSION,
    generated_at: new Date().toISOString(),
  };
}
