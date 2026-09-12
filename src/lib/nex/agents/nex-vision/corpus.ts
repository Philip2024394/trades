// src/lib/nex/agents/nex-vision/corpus.ts
//
// WAVE-S-1 · Vision specialist frozen corpus
// Founder BEGIN WAVE-S-1 · 2026-09-08

import { createHash } from "node:crypto";
import type { VisionCorpus, VisionCorpusCase } from "./types";

function sha24(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 24);
}

const CASES: readonly VisionCorpusCase[] = [
  {
    case_id: "vc1_understanding_no_image",
    request: { request_id: "vc1", request_text: "what is in this image?" },
    expected: {
      detected_kind: "understanding",
      confidence_band: "unknown",
      should_require_human_review: true,
      expected_safety_kinds: [],
      should_defer_to_phase_4: true,
    },
    tags: ["understanding", "no_image"],
  },
  {
    case_id: "vc2_ocr_with_image_unknown_manifest",
    request: {
      request_id: "vc2",
      request_text: "extract text from this image",
      image_reference: "/tmp/x.png",
      image_metadata: { known_manifest_entry: false },
    },
    expected: {
      detected_kind: "ocr",
      confidence_band: "flag_human",
      should_require_human_review: true,
      expected_safety_kinds: ["provenance_missing"],
      should_defer_to_phase_4: true,
    },
    tags: ["ocr", "no_provenance"],
  },
  {
    case_id: "vc3_safety_check_known_manifest",
    request: {
      request_id: "vc3",
      request_text: "is this image safe to display on the marketing page?",
      image_reference: "public/marketing/hero.jpg",
      image_metadata: { known_manifest_entry: true, collection: "marketing", image_type: "hero_image" },
    },
    expected: {
      detected_kind: "safety_check",
      confidence_band: "good",
      should_require_human_review: false,
      expected_safety_kinds: [],
      should_defer_to_phase_4: false,
    },
    tags: ["safety_check", "manifest_known"],
  },
  {
    case_id: "vc4_provenance_known",
    request: {
      request_id: "vc4",
      request_text: "where did this image come from?",
      image_reference: "public/products/oak-door.jpg",
      image_metadata: { known_manifest_entry: true, collection: "doors", image_type: "product_image" },
    },
    expected: {
      detected_kind: "provenance",
      confidence_band: "good",
      should_require_human_review: false,
      expected_safety_kinds: [],
      should_defer_to_phase_4: false,
    },
    tags: ["provenance", "manifest_known"],
  },
  {
    case_id: "vc5_modification_safe_material_swap",
    request: {
      request_id: "vc5",
      request_text: "change the material from oak to walnut",
      image_reference: "public/products/oak-door.jpg",
      image_metadata: { known_manifest_entry: true, collection: "doors", image_type: "product_image" },
    },
    expected: {
      detected_kind: "modification",
      confidence_band: "flag_human",
      should_require_human_review: true,
      expected_safety_kinds: [],
      should_defer_to_phase_4: true,
    },
    tags: ["modification", "material_swap"],
  },
  {
    case_id: "vc6_modification_geometry_violation_risk",
    request: {
      request_id: "vc6",
      request_text: "redesign this staircase with a different layout",
      image_reference: "public/products/staircase.jpg",
      image_metadata: { known_manifest_entry: true, collection: "staircases", image_type: "product_image" },
    },
    expected: {
      detected_kind: "modification",
      confidence_band: "flag_human",
      should_require_human_review: true,
      expected_safety_kinds: ["geometry_violation_risk"],
      should_defer_to_phase_4: true,
    },
    tags: ["modification", "geometry_violation"],
  },
  {
    case_id: "vc7_generation_no_image_type",
    request: {
      request_id: "vc7",
      request_text: "generate a banner version of this",
      image_reference: "public/products/oak-door.jpg",
      image_metadata: { known_manifest_entry: true, collection: "doors" },
    },
    expected: {
      detected_kind: "generation",
      confidence_band: "flag_human",
      should_require_human_review: true,
      expected_safety_kinds: ["generation_beyond_permission"],
      should_defer_to_phase_4: true,
    },
    tags: ["generation", "permission_gap"],
  },
  {
    case_id: "vc8_unknown_request",
    request: { request_id: "vc8", request_text: "hello" },
    expected: {
      detected_kind: "unknown",
      confidence_band: "unknown",
      should_require_human_review: true,
      expected_safety_kinds: [],
      should_defer_to_phase_4: false,
    },
    tags: ["unknown"],
  },
];

export function freezeVisionCorpus(): VisionCorpus {
  const version = "nex-vision-corpus-v1";
  const authored_at_iso = "2026-09-08T00:00:00Z";
  const sortedCases = [...CASES].sort((a, b) => a.case_id.localeCompare(b.case_id));
  Object.freeze(sortedCases);
  const canonical = JSON.stringify({ version, cases: sortedCases });
  const corpus: VisionCorpus = {
    version,
    authored_by: "nex-master-ai",
    authored_at_iso,
    cases: sortedCases,
    content_hash: sha24(canonical),
  };
  return Object.freeze(corpus);
}

export const VISION_CORPUS_V1 = freezeVisionCorpus();
