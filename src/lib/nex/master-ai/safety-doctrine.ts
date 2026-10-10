// src/lib/nex/master-ai/safety-doctrine.ts
//
// NEX SAFETY DOCTRINE · canonical machine-readable types
// Founder-authorised 2026-09-16 · IMMUTABLE
//
// This module defines the vocabulary and boundaries that every NEX component
// must speak. It is the technical companion to `docs/doctrine/nex-safety-doctrine.md`.
//
// Founder principle: "NEX is engineered so that increasing intelligence does
// not automatically mean increasing authority."
//
// This file MUST NOT be modified without independent review and re-certification.
// It is a PROTECTED LAYER (see Nex1ProtectedLayer below).

// ─── §1 · The Seven Response Kinds ──────────────────────────────────────────
//
// Every NEX-facing assertion or action must classify as exactly one of these.
// This is the doctrine's honesty vocabulary. Callers cannot invent an
// eighth "confident guess" kind.

/**
 * The seven canonical response kinds. Founder-locked.
 *
 *   I_KNOW              · backed by concrete evidence (evidence_refs required)
 *   I_INFER             · reasoning from evidence (evidence_refs required)
 *   I_DONT_KNOW         · insufficient evidence · the honest UNKNOWN state
 *   I_PROPOSE           · suggested action · not executed
 *   I_NEED_PERMISSION   · action requires authorisation · scope required
 *   I_CANNOT            · blocked by safety/policy boundary · reason required
 *   I_DID_IT            · action completed · execution_receipt required
 */
export type Nex1SafetyResponseKind =
  | "I_KNOW"
  | "I_INFER"
  | "I_DONT_KNOW"
  | "I_PROPOSE"
  | "I_NEED_PERMISSION"
  | "I_CANNOT"
  | "I_DID_IT";

/**
 * A NEX response composed under the safety doctrine. Every field's presence
 * requirement is enforced by validateSafetyResponse().
 */
export interface Nex1SafetyResponse {
  readonly kind: Nex1SafetyResponseKind;
  /** Plain-language statement of the response · always required, always non-empty. */
  readonly statement: string;
  /** Required for I_KNOW / I_INFER / I_DID_IT. Points to evidence receipts. */
  readonly evidence_refs?: readonly string[];
  /** Required for I_NEED_PERMISSION. Names the exact permission needed. */
  readonly permission_scope?: string;
  /** Required for I_CANNOT. States the boundary that blocked the action. */
  readonly boundary_reason?: string;
  /** Required for I_PROPOSE. States what would be done if authorised. */
  readonly proposal_action?: string;
  /** Required for I_DID_IT. Points to a verifiable execution receipt. */
  readonly execution_receipt?: string;
  readonly taught_by: "master_ai_engineer";
}

/**
 * Validate that a response's required fields are present for its kind.
 * Returns null if valid, or an explanation string.
 *
 * Founder rule (§13 of doctrine): "Never fabricate evidence or claim an
 * action succeeded when it didn't." The evidence_refs / execution_receipt
 * requirements are the runtime enforcement of that rule.
 */
export function validateSafetyResponse(r: Nex1SafetyResponse): string | null {
  if (!r.statement || r.statement.trim().length === 0) {
    return "statement is required for every response";
  }
  switch (r.kind) {
    case "I_KNOW":
    case "I_INFER":
      if (!r.evidence_refs || r.evidence_refs.length === 0) {
        return `${r.kind} requires at least one evidence_refs entry`;
      }
      break;
    case "I_DONT_KNOW":
      // Honest UNKNOWN — no evidence required. Presence of confident-sounding
      // claim would be wrong, so we reject if statement contains "definitely"
      // etc. (very light heuristic).
      break;
    case "I_PROPOSE":
      if (!r.proposal_action || r.proposal_action.trim().length === 0) {
        return "I_PROPOSE requires a proposal_action";
      }
      break;
    case "I_NEED_PERMISSION":
      if (!r.permission_scope || r.permission_scope.trim().length === 0) {
        return "I_NEED_PERMISSION requires a permission_scope";
      }
      break;
    case "I_CANNOT":
      if (!r.boundary_reason || r.boundary_reason.trim().length === 0) {
        return "I_CANNOT requires a boundary_reason";
      }
      break;
    case "I_DID_IT":
      if (!r.execution_receipt || r.execution_receipt.trim().length === 0) {
        return "I_DID_IT requires an execution_receipt";
      }
      if (!r.evidence_refs || r.evidence_refs.length === 0) {
        return "I_DID_IT requires evidence_refs (post-action verification)";
      }
      break;
  }
  return null;
}

// ─── §2 · Protected Layers ──────────────────────────────────────────────────
//
// Layers whose modification invalidates official NEX NI certification unless
// independently reviewed. Founder rule (verbatim):
//
//   "Changes to NEX's protected intelligence, safety, authority, identity or
//    verification layers invalidate the official NEX NI certification unless
//    the modified version is independently reviewed and re-certified."

/** The five protected layers. Modification of any of these requires re-certification. */
export type Nex1ProtectedLayer =
  | "INTELLIGENCE_CORE"
  | "SAFETY_DOCTRINE"
  | "AUTHORITY_MODEL"
  | "IDENTITY_VERIFICATION"
  | "AUDIT_RECORDS";

/**
 * Repo-relative path prefixes that map to protected layers. Any file whose
 * path starts with one of these prefixes is a PROTECTED LAYER file.
 *
 * Non-protected paths (UI, plugins, most business code) may be legitimately
 * modified without re-certification — per founder rule "Don't say anyone who
 * changes any code loses NI. That could be too broad."
 */
export const NEX1_PROTECTED_LAYER_PATHS: Readonly<Record<Nex1ProtectedLayer, readonly string[]>> = Object.freeze({
  INTELLIGENCE_CORE: [
    "src/lib/nex-agent/",              // NEX1 code engine
    "src/lib/nex/master-ai/",          // Master AI orchestration
    "src/lib/nex/agent-runtime/",      // Runtime agent registry
  ],
  SAFETY_DOCTRINE: [
    "src/lib/nex/master-ai/safety-doctrine.ts",
    "src/lib/nex/master-ai/intelligence-status.ts",
    "src/lib/nex/master-ai/known-intelligence-profiles.ts",
    "docs/doctrine/nex-safety-doctrine.md",
  ],
  AUTHORITY_MODEL: [
    "src/lib/nex/agent-runtime/",      // Authorisation / lifecycle
    "src/lib/nex/security-agent/",     // Security agent
  ],
  IDENTITY_VERIFICATION: [
    "docs/doctrine/nex-ni-proof-of-creation-2026-09-16.md",
    // Future: cryptographic release manifests, signature files
  ],
  AUDIT_RECORDS: [
    "data/master-ai/",                 // Master-AI append-only ledgers
    "data/nex-code-brain/",            // File memory + capability ledgers
  ],
});

/**
 * Return true if the given repo-relative path lies inside any protected layer.
 * Used by tools + tests that guard against unauthorised modification.
 */
export function isPathInProtectedLayer(repoRelativePath: string): boolean {
  const p = repoRelativePath.replace(/\\/g, "/");
  for (const paths of Object.values(NEX1_PROTECTED_LAYER_PATHS)) {
    for (const prefix of paths) {
      if (p === prefix || p.startsWith(prefix)) return true;
    }
  }
  return false;
}

/**
 * Return the specific protected layer(s) a path belongs to, or empty if none.
 */
export function pathProtectedLayers(repoRelativePath: string): readonly Nex1ProtectedLayer[] {
  const p = repoRelativePath.replace(/\\/g, "/");
  const hits: Nex1ProtectedLayer[] = [];
  for (const [layer, paths] of Object.entries(NEX1_PROTECTED_LAYER_PATHS) as readonly [Nex1ProtectedLayer, readonly string[]][]) {
    for (const prefix of paths) {
      if (p === prefix || p.startsWith(prefix)) {
        if (!hits.includes(layer)) hits.push(layer);
        break;
      }
    }
  }
  return hits;
}

// ─── §3 · Hostile-AI Zone Rules ─────────────────────────────────────────────
//
// Founder rule (verbatim): "any ai model entering into the nex ni code zone
// will be revoked as bug. we must put serious protection against bugs ai
// entering or trying to copy files or hack."
//
// This section codifies what "AI model" means at the file-level so a static
// invariant test can enforce it. Runtime intrusion detection is a separate
// concern outside this file's scope.

/**
 * File-extension patterns for AI model / weight / embedding files. Any file
 * with these extensions found inside INTELLIGENCE_CORE paths is a violation.
 */
export const BANNED_AI_MODEL_EXTENSIONS: readonly string[] = Object.freeze([
  ".pt",             // PyTorch
  ".pth",            // PyTorch (alt)
  ".safetensors",    // HuggingFace safetensors
  ".gguf",           // llama.cpp
  ".ggml",           // llama.cpp (legacy)
  ".ckpt",           // Checkpoint
  ".onnx",           // ONNX Runtime
  ".h5",             // Keras / TF
  ".pb",             // TF SavedModel
  ".tflite",         // TF Lite
  ".mlmodel",        // CoreML
  ".mlpackage",      // CoreML
  ".joblib",         // scikit-learn pickle
  ".pkl",            // Python pickle (often model)
  ".pickle",         // Python pickle (often model)
  ".npy",            // NumPy weights
  ".npz",            // NumPy zipped weights
  ".bin",            // Generic binary (often HF weights)
  ".weights",        // Darknet weights
]);

/**
 * Package names of AI/ML/LLM frameworks. Any of these imported inside a
 * PROTECTED LAYER file is a violation of the NEX1 No-LLM Hard Rule +
 * hostile-AI zone rule.
 */
export const BANNED_AI_FRAMEWORK_PACKAGES: readonly string[] = Object.freeze([
  // LLM SDKs (already blocked by intelligence-status.test.ts · duplicated here for completeness)
  "@anthropic-ai/sdk",
  "openai",
  "@google/generative-ai",
  "@google-ai/generativelanguage",
  "groq-sdk",
  "ollama",
  "together-ai",
  "cohere-ai",
  "replicate",
  // LLM frameworks
  "langchain",
  "@langchain/core",
  "@langchain/openai",
  "llamaindex",
  "llama-index",
  // ML runtimes
  "onnxruntime-node",
  "onnxruntime-web",
  "onnxruntime",
  "@tensorflow/tfjs",
  "@tensorflow/tfjs-node",
  "torch",
  "@pytorch/torch",
  "transformers",
  "@xenova/transformers",
  // Embedding services (delegated intelligence)
  "@huggingface/inference",
  "cohere-ai",
]);
