// Prompt Compiler · DesignDocument → CompiledPrompt.
//
// The compiler walks the DesignDocument metadata + resolved theme + camera +
// lighting + materials + hero references and produces a structured prompt.
// Nothing in this module invents design details — every fragment traces to a
// source field in the document.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { CompiledPrompt, CompileOptions } from "./types";

const COMPILER_VERSION = "e7_prompt_compiler_mvp_1.0";

type CompilerInputDoc = {
  document_id: string;
  theme_pack?: { id: string };
  metadata?: {
    hero_product_type?: string;
    timber_profile?: string;
    marketing_tone?: string;
    campaign_type?: string;
    audience?: string;
    persona?: string;
    layout_family?: string;
    brand_personality?: string;
  };
  scene_graph?: {
    camera?: { kind?: string };
    lighting?: unknown;
  };
  banner_specification?: {
    layers?: readonly { type?: string; text?: string; href?: string }[];
    layout_family?: string;
  };
};

function pickHeroRefs(doc: CompilerInputDoc): CompiledPrompt["reference_images"] {
  const layers = doc.banner_specification?.layers ?? [];
  const hero = layers.find((l) => l.type === "image" && l.href);
  if (!hero || !hero.href) return undefined;
  return [{ role: "hero", url: hero.href, weight: 1.0 }];
}

function composePositive(doc: CompilerInputDoc): string {
  const m = doc.metadata ?? {};
  const parts: string[] = [];
  if (m.hero_product_type) parts.push(m.hero_product_type);
  if (m.timber_profile) parts.push(m.timber_profile);
  if (m.marketing_tone) parts.push(`${m.marketing_tone} tone`);
  if (m.audience) parts.push(`for ${m.audience.replace(/_/g, " ")}`);
  if (m.brand_personality) parts.push(`${m.brand_personality} personality`);
  if (doc.theme_pack?.id) parts.push(`theme:${doc.theme_pack.id}`);
  if (m.layout_family ?? doc.banner_specification?.layout_family) parts.push(`layout:${m.layout_family ?? doc.banner_specification?.layout_family}`);
  return parts.filter(Boolean).join(" · ");
}

function composeNegative(doc: CompilerInputDoc): string {
  const m = doc.metadata ?? {};
  const negatives: string[] = ["low quality", "artifacts", "distorted geometry"];
  if (m.brand_personality === "luxury") negatives.push("discount badge", "urgency bar", "all-caps CTA");
  if (m.brand_personality === "heritage") negatives.push("neon colours");
  return negatives.join(", ");
}

export function compilePrompt(doc: CompilerInputDoc, opts: CompileOptions): CompiledPrompt {
  return {
    target: opts.target,
    positive: composePositive(doc),
    negative: composeNegative(doc),
    reference_images: pickHeroRefs(doc),
    guidance_scale: 7.0,
    steps: 30,
    seed_policy: opts.seed_policy ?? "deterministic",
    seed: opts.seed,
    aspect_ratio: opts.aspect_ratio,
    target_size: opts.target_size,
    compiler_version: COMPILER_VERSION,
    provenance: {
      design_document_id: doc.document_id,
      theme_pack: doc.theme_pack?.id,
      layout_family: doc.metadata?.layout_family ?? doc.banner_specification?.layout_family,
      camera_profile: doc.scene_graph?.camera?.kind,
      materials: doc.metadata?.timber_profile ? [doc.metadata.timber_profile] : undefined,
      scene_summary: composePositive(doc),
    },
  };
}
