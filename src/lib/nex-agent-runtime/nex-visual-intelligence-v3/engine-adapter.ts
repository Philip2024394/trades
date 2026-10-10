// §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3 · adapter
// NEX bounded infrastructure · replaceable engine adapter boundary · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// Pure function · zero I/O · deterministic. The adapter defines the shape
// of a NEX Visual Generation invocation. It does NOT contain, invoke, or
// import any real image-generation engine.
//
// The registry `V3_ENGINE_REGISTRY` is a locked frozen empty object.
// Every well-formed request that reaches the invocation stage receives
// `V3_ENGINE_NOT_REGISTERED` failure. Registering an engine is a future
// bounded amendment (each engine needs its own licence-manifest entry
// and adapter implementation).
//
// This wave establishes the CONTRACT. It does not deliver any generator.

import { createHash } from "node:crypto";
import type {
  V3EngineRegistration,
  V3GenerationOutcome,
  V3GenerationRequest,
} from "./visual-generation-contract";
import {
  V3_MAX_OUTPUT_IMAGES,
  V3_MAX_PROMPT_LENGTH,
  type V3_EngineAdapterRefusalReason,
} from "./visual-generation-contract-ranges";
import {
  V3_ADAPTER_VERSION,
  V3_GREP_MARKER,
  type RunV3EngineAdapterRequest,
  type V3AdapterFailure,
  type V3AdapterResult,
  type V3AdapterSuccess,
} from "./engine-adapter-types";

// ── Locked prohibited substrings ────────────────────────────────────────

const V3_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "eval(",
  "new Function",
  "child_process",
  "<script>",
  "</script>",
  "dangerouslySetInnerHTML",
  "__proto__",
  "constructor.prototype",
]);

// ── Locked engine registry (empty in this wave) ────────────────────────
//
// A future amendment can add engines here. Each addition requires:
//   · a bounded §36 amendment
//   · a licence-manifest entry
//   · an adapter implementation
//   · brand-clean audit
// This wave introduces NO engines.

export const V3_ENGINE_REGISTRY: Readonly<Record<string, V3EngineRegistration>> = Object.freeze({});

// ── Failure helpers ────────────────────────────────────────────────────

function fail(code: V3_EngineAdapterRefusalReason, reason: string): V3AdapterFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    grep_marker: V3_GREP_MARKER,
    adapter_version: V3_ADAPTER_VERSION,
  };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(text: string): string | null {
  for (const bad of V3_PROHIBITED_SUBSTRINGS) if (text.includes(bad)) return bad;
  return null;
}

// ── Request structural validation ──────────────────────────────────────

const IDENT_PATH_RE = /^[A-Za-z0-9_\-\.:/]+$/;

const KNOWN_GENERATION_KINDS: readonly string[] = Object.freeze([
  "text_to_image",
  "image_to_image",
  "reference_conditioned",
  "multi_reference_composition",
]);

const KNOWN_OUTPUT_FORMATS: readonly string[] = Object.freeze([
  "png", "webp", "jpeg", "alpha_native",
]);

function isValidRequest(req: unknown): req is V3GenerationRequest {
  if (!req || typeof req !== "object") return false;
  const r = req as Record<string, unknown>;
  if (typeof r.request_id !== "string" || r.request_id.length === 0) return false;
  if (!IDENT_PATH_RE.test(r.request_id) || r.request_id.length > 128) return false;
  if (typeof r.generation_kind !== "string" || !KNOWN_GENERATION_KINDS.includes(r.generation_kind)) return false;
  if (typeof r.reference_contract_id !== "string" || r.reference_contract_id.length === 0) return false;
  if (typeof r.reference_contract_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r.reference_contract_sha256)) return false;
  if (typeof r.prompt !== "string") return false;
  if (typeof r.output_format !== "string" || !KNOWN_OUTPUT_FORMATS.includes(r.output_format)) return false;
  if (typeof r.max_output_images !== "number" || !Number.isInteger(r.max_output_images)) return false;
  return true;
}

// ── Entry point ────────────────────────────────────────────────────────

export function runVisualEngineAdapter(request: RunV3EngineAdapterRequest): V3AdapterResult {
  if (!request || typeof request !== "object") {
    return fail("V3_INVALID_REQUEST", "request required");
  }
  if (!isValidRequest(request.request)) {
    return fail("V3_INVALID_REQUEST", "request.request malformed · missing/invalid required field");
  }
  const gr: V3GenerationRequest = request.request;

  // Reference contract sanity
  if (!/^[0-9a-f]{64}$/.test(gr.reference_contract_sha256)) {
    return fail("V3_INVALID_CONSTRAINT_CONTRACT_REFERENCE", "reference_contract_sha256 must be 64-char hex");
  }

  // Length bounds
  if (gr.prompt.length < V3_MAX_PROMPT_LENGTH.min || gr.prompt.length > V3_MAX_PROMPT_LENGTH.max) {
    return fail("V3_MAX_PROMPT_EXCEEDED", `prompt length ${gr.prompt.length} outside [${V3_MAX_PROMPT_LENGTH.min}, ${V3_MAX_PROMPT_LENGTH.max}]`);
  }
  if (gr.max_output_images < V3_MAX_OUTPUT_IMAGES.min || gr.max_output_images > V3_MAX_OUTPUT_IMAGES.max) {
    return fail("V3_MAX_OUTPUT_IMAGES_EXCEEDED", `max_output_images ${gr.max_output_images} outside [${V3_MAX_OUTPUT_IMAGES.min}, ${V3_MAX_OUTPUT_IMAGES.max}]`);
  }

  // Prohibited substring guard on prompt
  const badInPrompt = containsProhibited(gr.prompt);
  if (badInPrompt !== null) {
    return fail("V3_PROHIBITED_STRING_CONTENT", `prompt contains prohibited substring '${badInPrompt}'`);
  }

  // Engine selection
  const requested_slug = request.options?.engine_slug;
  if (typeof requested_slug === "string" && requested_slug.length > 0) {
    // Caller asked for a specific engine
    if (!Object.prototype.hasOwnProperty.call(V3_ENGINE_REGISTRY, requested_slug)) {
      return fail(
        "V3_ENGINE_UNKNOWN_SLUG",
        `engine_slug '${requested_slug}' is not in the locked V3_ENGINE_REGISTRY (registry is currently empty · every request refuses V3_ENGINE_NOT_REGISTERED regardless of slug in this wave)`,
      );
    }
  }

  // The registry is empty in this wave. Return a structured outcome that
  // makes the zero-engine state visible in the V3GenerationOutcome shape
  // rather than swallowing it in a plain FAILURE.
  const invoked_at = request.options?.invoked_at ?? "1970-01-01T00:00:00.000Z";
  const outcome_id = request.options?.outcome_id
    ?? `outcome:${gr.request_id}:${gr.reference_contract_sha256.slice(0, 12)}`;

  const outcome: V3GenerationOutcome = {
    outcome_id,
    request_id: gr.request_id,
    response_kind: "engine_registration_incomplete",
    engine_registration_status: "no_engine_registered",
    perception_verification_status: "not_applicable",
    reason_summary:
      "V3 adapter contract is live · registry contains zero engines · no image bytes produced. " +
      "Registering an engine is a future bounded amendment. Perception (image → candidate contract) " +
      "is a separate future capability · not part of V3.",
    candidate_asset_ids: Object.freeze([]),
    generated_at: invoked_at,
  };

  const success: V3AdapterSuccess = {
    kind: "SUCCESS",
    outcome,
    grep_marker: V3_GREP_MARKER,
    adapter_version: V3_ADAPTER_VERSION,
  };
  return success;
}

// ── Deterministic id helper for callers ────────────────────────────────

export function deriveDeterministicOutcomeId(request_id: string, reference_contract_sha256: string): string {
  return `outcome:${request_id}:${reference_contract_sha256.slice(0, 12)}`;
}

// Re-exports
export { V3_ADAPTER_VERSION, V3_GREP_MARKER } from "./engine-adapter-types";
export { sha256Hex };
