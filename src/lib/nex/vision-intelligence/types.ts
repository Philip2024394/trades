// Vision Intelligence Platform · Visual Understanding Engine.
//
// Progressive extraction: Image → Object Detection → Segmentation → Geometry →
// Materials → Lighting → Colours → Style → Relationships → Scene → Knowledge
// Objects → Design Database.
//
// Pixels are temporary. Knowledge is permanent.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

// ─── Object Intelligence ────────────────────────────────────────────────

export type DetectedObject = {
  object_id: string;
  type: string;                          // "staircase" · "kitchen_island" · "worktop" · etc.
  confidence: number;                    // 0..1
  material?: string;
  finish?: string;
  construction?: string;                 // e.g. "closed_string"
  balustrade?: string;
  handrail?: string;
  lighting?: string;
  condition?: "excellent" | "good" | "fair" | "poor";
  position?: string;                     // free-text · e.g. "room_centre"
  connected_to?: readonly string[];      // ids of nearby detected objects
  bbox_pct?: { x: number; y: number; width: number; height: number };
};

// ─── Shape Intelligence ─────────────────────────────────────────────────

export type ShapePrimitive = "rectangle" | "cylinder" | "cone" | "sphere" | "prism" | "torus" | "curve" | "arc" | "spline" | "flat_panel" | "tapered";

export type ShapeSignature = {
  primary_shape: ShapePrimitive;
  secondary_shapes: readonly ShapePrimitive[];
  edge_treatment?: "sharp" | "rounded" | "chamfered" | "beveled" | "moulded";
  proportions?: "small" | "medium" | "large";
  style_class?: "shaker" | "modern" | "traditional" | "industrial" | "scandinavian" | "heritage" | "unknown";
};

// ─── Relationship Intelligence ──────────────────────────────────────────

export type RelationshipEdge = {
  from_id: string;
  to_id: string;
  kind: "matches_material" | "adjacent_to" | "supports" | "contains" | "reflects" | "shadows" | "coordinates_with";
};

// ─── Direction Intelligence ─────────────────────────────────────────────

export type DirectionalProfile = {
  lighting_direction?: "top_left" | "top_right" | "top" | "front" | "back" | "left" | "right" | "bottom";
  shadow_direction?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "top" | "bottom" | "left" | "right";
  wood_grain?: "vertical" | "horizontal" | "diagonal" | "chevron" | "cross";
  floor_direction?: "horizontal" | "vertical" | "diagonal" | "herringbone";
  camera_orientation?: "eye_level" | "looking_up" | "looking_down" | "wide" | "close";
  perspective?: "1_point" | "2_point" | "3_point" | "isometric" | "orthographic";
};

// ─── Mood / Warmth Intelligence ─────────────────────────────────────────

export type MoodProfile = {
  colour_temperature: "very_warm" | "warm" | "neutral" | "cool" | "very_cool";
  dominant_palette: readonly string[];   // hex values or named palette
  lighting_temperature_k?: number;
  dominant_materials: readonly string[];
  contrast: "low" | "medium" | "high";
  mood_label: string;                    // e.g. "relaxed" · "energetic" · "industrial"
  style_label: string;                   // e.g. "scandinavian" · "modern_farmhouse"
  overall_warmth_score: number;          // 0..100
};

// ─── Style DNA ──────────────────────────────────────────────────────────

export type StyleDNA = {
  weights: Record<string, number>;       // e.g. { traditional: 0.45, contemporary: 0.35, scandinavian: 0.20 }
  timber?: string;
  palette?: string;                      // e.g. "warm_neutral"
  hardware?: string;                     // e.g. "brass"
  lighting?: string;                     // e.g. "warm_white"
  mood?: string;                         // e.g. "luxury_family"
};

// ─── Scene Intelligence ─────────────────────────────────────────────────

export type SceneAnalysis = {
  room_type?: "kitchen" | "hallway" | "landing" | "living_room" | "bedroom" | "bathroom" | "utility" | "study" | "dining" | "loft" | "cellar" | "other";
  contains: readonly string[];           // object types present
  windows_count?: number;
  visible_from_scene?: readonly string[];// e.g. ["staircase", "garden"]
  lighting_kind?: string;
  floor?: string;
  worktop?: string;
  splashback?: string;
  style?: string;                        // e.g. "modern_farmhouse"
};

// ─── Knowledge Graph Node ───────────────────────────────────────────────

export type KnowledgeGraphNode = {
  id: string;
  kind: "image" | "room" | "object" | "material" | "lighting" | "camera";
  properties: Record<string, unknown>;
  children?: readonly KnowledgeGraphNode[];
};

// ─── Full Vision Analysis (composed of all above) ──────────────────────

export type VisionAnalysis = {
  source_asset_id: string;
  objects: readonly DetectedObject[];
  shape_signatures: Record<string, ShapeSignature>;  // by object_id
  relationships: readonly RelationshipEdge[];
  directional: DirectionalProfile;
  mood: MoodProfile;
  style_dna: StyleDNA;
  scene: SceneAnalysis;
  knowledge_graph: KnowledgeGraphNode;
  analyser_version: string;
  generated_at: string;
};

// ─── Hint context (caller-provided · never invented) ────────────────────

export type VisionHint = {
  source_asset_id: string;
  known_object_types?: readonly string[];
  known_materials?: readonly string[];
  known_room_type?: SceneAnalysis["room_type"];
  known_style?: string;
  known_palette?: readonly string[];
  known_lighting?: string;
};
