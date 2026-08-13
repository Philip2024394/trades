// NDIP · Render Manifest.
//
// Every render produces a manifest alongside its pixel output. The manifest
// enables versioning · reproducibility · debuggability · quality-tracking over
// time. Same DesignDocument + same ResolvedAssets + same engine version → same
// determinism_hash → same output (byte-identical where possible).
//
// Doctrine: docs/brains/nex-design-intelligence-platform-ndip-philip-2026-08-04.md

import crypto from "node:crypto";
import type { DesignDocument, BannerDocument } from "./design-document";
import type { ResolvedAssets, GrammarViolation } from "./types";

export type RenderManifest = {
  render_id: string;
  render_document: string;
  document_type: DesignDocument["document_type"];
  document_version: string;
  theme_pack: string;
  layout_family?: string;
  scene_graph_nodes: number;
  hero_asset?: string;
  logo_asset?: string;
  icon_bundle?: string;
  font_set: {
    heading: string;
    subheading: string;
    body: string;
    cta: string;
  };
  components_rendered: number;
  render_time_ms: number;
  engine_version: string;
  determinism_hash: string;
  grammar_violations: readonly GrammarViolation[];
  provenance: DesignDocument["provenance"];
};

function canonicalize(obj: unknown): string {
  // Stable JSON stringification with sorted keys · yields deterministic hashes.
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((obj as Record<string, unknown>)[k])).join(",") + "}";
}

export function determinismHash(doc: DesignDocument, assets: ResolvedAssets, engineVersion: string): string {
  const payload = canonicalize({ doc, assets: { hero: assets.hero_url, logo: assets.logo_url, icon: assets.icon_bundle_id, bg: assets.background_texture_url }, engineVersion });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function buildRenderManifest(params: {
  doc: BannerDocument;
  assets: ResolvedAssets;
  engineVersion: string;
  renderTimeMs: number;
  componentsRendered: number;
  sceneGraphNodes: number;
  grammarViolations: readonly GrammarViolation[];
}): RenderManifest {
  const { doc, assets, engineVersion, renderTimeMs, componentsRendered, sceneGraphNodes, grammarViolations } = params;
  const dhash = determinismHash(doc, assets, engineVersion);
  return {
    render_id: `rnd_${dhash.slice(0, 12)}`,
    render_document: doc.document_id,
    document_type: doc.document_type,
    document_version: doc.document_version,
    theme_pack: doc.theme_pack.id,
    layout_family: doc.banner_specification.layout_family,
    scene_graph_nodes: sceneGraphNodes,
    hero_asset: assets.hero_url,
    logo_asset: assets.logo_url,
    icon_bundle: assets.icon_bundle_id,
    font_set: {
      heading: doc.theme_pack.fonts.headline,
      subheading: doc.theme_pack.fonts.subheadline,
      body: doc.theme_pack.fonts.body,
      cta: doc.theme_pack.fonts.cta,
    },
    components_rendered: componentsRendered,
    render_time_ms: renderTimeMs,
    engine_version: engineVersion,
    determinism_hash: dhash,
    grammar_violations: grammarViolations,
    provenance: doc.provenance,
  };
}
