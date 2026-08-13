// NDIP · The universal DesignDocument base type.
//
// Every visual output produced by Nex is a specialization of DesignDocument.
// A BannerDocument is one such specialization. Websites · brochures · quotes ·
// room visualisations · presentations · exhibition stands · staircase proposals ·
// kitchen plans all extend the same base contract.
//
// Doctrine: docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md
// Constitutional rule: the renderer receives a fully-specified DesignDocument ·
// it makes ZERO aesthetic decisions of its own.

import type { BannerSpecification, ExportSize, Layer, ThemePack } from "./types";

export type DocumentType =
  | "BannerDocument"
  | "WebsiteDocument"
  | "BrochureDocument"
  | "QuoteDocument"
  | "FlyerDocument"
  | "PresentationDocument"
  | "RoomVisualisationDocument"
  | "KitchenPlanDocument"
  | "StaircaseProposalDocument"
  | "MarketingCampaignDocument"
  | "ExhibitionStandDocument";

// ─── Scene Graph (2D-flat today · 3D-ready tomorrow) ────────────────────

export type Camera = {
  kind: "identity" | "perspective" | "orthographic";
  position?: [number, number, number];
  target?: [number, number, number];
  fov_deg?: number;
  aspect?: number;
};

export type LightingRig = {
  ambient?: number;                      // 0..1
  key?: { color: string; intensity: number };
  fill?: { color: string; intensity: number };
  rim?: { color: string; intensity: number };
  shadows_enabled?: boolean;
};

export type EnvironmentBinding = {
  background?: string;                   // colour · gradient · texture ref
  sky_ref?: string;
  walls_ref?: string;
  floor_ref?: string;
  hdri_ref?: string;
};

// For 2D banners today · SceneObject is a thin wrapper that holds Layer[].
// For 3D room visualisation tomorrow · SceneObject holds geometry + transform.
export type SceneObject =
  | { kind: "layer_group"; id: string; layers: readonly Layer[] }
  | { kind: "geometry_ref"; id: string; ref: string; transform: number[]; material_ref?: string };

export type SceneGraph = {
  camera: Camera;
  lighting: LightingRig;
  environment: EnvironmentBinding;
  objects: readonly SceneObject[];
};

// ─── Provenance (Rule 7 · every decision explainable) ─────────────────────

export type Provenance = {
  campaign_engine?: string;
  reasoning_chain?: readonly string[];
  knowledge_citations?: readonly string[];
  asset_evidence?: readonly string[];
  render_planner_version?: string;
  engine_version?: string;
};

// ─── DesignDocument base contract ─────────────────────────────────────────

export type DesignDocumentBase = {
  document_id: string;
  document_type: DocumentType;
  document_version: string;              // e.g. "1.0"
  theme_pack: ThemePack;
  export_target: ExportSize;
  scene_graph: SceneGraph;
  metadata: Record<string, unknown>;
  provenance: Provenance;
};

// ─── BannerDocument · first specialization ────────────────────────────────
// Structurally compatible with the existing BannerSpecification runtime · so
// existing tests + call sites migrate additively rather than being rewritten.

export type BannerDocument = DesignDocumentBase & {
  document_type: "BannerDocument";
  banner_specification: BannerSpecification;  // the resolved layer + layout + personality data
};

// ─── DesignDocument union (grows as new document types are added) ─────────

export type DesignDocument = BannerDocument;

/** Wrap a BannerSpecification in a full DesignDocument. Backward-compatible: existing
 *  callers can still pass a bare BannerSpecification to the renderer. */
export function bannerToDocument(
  spec: BannerSpecification,
  opts?: { provenance?: Provenance; document_version?: string }
): BannerDocument {
  return {
    document_id: spec.banner_id,
    document_type: "BannerDocument",
    document_version: opts?.document_version ?? "1.0",
    theme_pack: spec.theme_pack,
    export_target: spec.export,
    scene_graph: {
      camera: { kind: "identity" },
      lighting: { ambient: 1.0, shadows_enabled: false },
      environment: { background: spec.theme_pack.colors.background },
      objects: [{ kind: "layer_group", id: "root", layers: spec.layers }],
    },
    metadata: { ...spec.metadata, layout_family: spec.layout_family, brand_personality: spec.brand_personality, cta_architecture: spec.cta_architecture },
    provenance: opts?.provenance ?? {},
    banner_specification: spec,
  };
}
