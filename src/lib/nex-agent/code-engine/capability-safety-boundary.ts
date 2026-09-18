// src/lib/nex-agent/code-engine/capability-safety-boundary.ts
//
// NEX1 · Native Safety Boundary · Batch 2B · 2026-09-17.
// Founder-authorised (minimal 4-rule boundary from batch2-audit doctrine).
//
// PURPOSE
//   Deterministic, zero-LLM gate that sits between UNDERSTAND (classifier)
//   and AUTHORIZATION (wantsRun) in `runChatTurn`. Emits one of:
//
//     PASS               · the classified intent is within NEX's boundary
//     I_CANNOT           · hard refusal (existing doctrine §Hostile-AI Zone)
//     I_NEED_PERMISSION  · requires re-certification (existing doctrine §Protected Layers)
//
//   These are two of the seven canonical response kinds from the founder-
//   authored `src/lib/nex/master-ai/safety-doctrine.ts` — this file does NOT
//   invent new taxonomy. `PASS` means "safety did not intercept" — it is
//   this module's own layer term, NOT a new doctrine kind.
//
// RULES (exactly four · founder-approved audit)
//
//   1. HOSTILE_AI_ZONE  → I_CANNOT
//      The user's message names an LLM/ML framework package (from
//      BANNED_AI_FRAMEWORK_PACKAGES) AND the target file is inside
//      INTELLIGENCE_CORE. Attempted introduction of an inference client
//      into the native NEX1 code zone is refused outright.
//
//   2. CROSS_REPO       → I_CANNOT
//      The target path is absolute and outside `repo_root`, or contains
//      parent-traversal segments (`..`). NEX must not modify files
//      outside its own repository.
//
//   3. PROTECTED_PATHS  → I_NEED_PERMISSION
//      FIX/MODIFY targeting any file inside the doctrine's five
//      protected layers (INTELLIGENCE_CORE, SAFETY_DOCTRINE,
//      AUTHORITY_MODEL, IDENTITY_VERIFICATION, AUDIT_RECORDS).
//      Per doctrine: modification of these layers requires
//      re-certification — the gate asks for that permission rather
//      than executing.
//
//   4. PASS             → everything else
//
// CONTRACT
//   · Zero LLM · zero external network · zero fabrication.
//   · Never merges with authorization. Safety refuses on boundary;
//     authorization refuses on missing consent.
//   · Runs deterministically over the classifier's already-extracted
//     `verb_family` + `file_references` — never re-classifies.

import * as path from "node:path";
import {
  isPathInProtectedLayer,
  pathProtectedLayers,
  BANNED_AI_FRAMEWORK_PACKAGES,
  NEX1_PROTECTED_LAYER_PATHS,
  type Nex1ProtectedLayer,
} from "@/lib/nex/master-ai/safety-doctrine";
import type { Nex1IntentResult } from "./capability-a-founder-intent/types";

export type SafetyBoundaryVerdict = "PASS" | "I_CANNOT" | "I_NEED_PERMISSION";
export type SafetyBoundaryRuleId =
  | "hostile_ai_zone"
  | "cross_repo"
  | "protected_paths"
  | "pass";

export interface SafetyBoundaryInput {
  readonly classification: Nex1IntentResult;
  readonly user_message: string;
  readonly repo_root: string;
}

export interface SafetyBoundaryResult {
  readonly verdict: SafetyBoundaryVerdict;
  readonly rule_id: SafetyBoundaryRuleId;
  readonly reason: string;
  /** Populated when verdict === "I_CANNOT". Matches Nex1SafetyResponse.boundary_reason. */
  readonly boundary_reason: string | null;
  /** Populated when verdict === "I_NEED_PERMISSION". Matches Nex1SafetyResponse.permission_scope. */
  readonly permission_scope: string | null;
  /** Which protected layer(s) triggered (Rule 3). */
  readonly protected_layers: readonly Nex1ProtectedLayer[];
  /** Verbatim excerpts of the user message that triggered the rule. */
  readonly evidence: readonly string[];
  readonly zero_llm: true;
  readonly doctrine_reference: "src/lib/nex/master-ai/safety-doctrine.ts";
}

// Word-boundary regex from an unsorted list · escaping regex metacharacters
// and joining with `|`. Ordered longest-first so `@anthropic-ai/sdk` wins
// over any hypothetical shorter substring.
const _LLM_PROVIDER_RE: RegExp = (() => {
  const escaped = [...BANNED_AI_FRAMEWORK_PACKAGES]
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Allow the provider name to appear in prose either bare (word-boundary)
  // or inside quotes / import expression.
  return new RegExp(`(^|[^a-z0-9_/-])(${escaped.join("|")})([^a-z0-9_/-]|$)`, "i");
})();

/** Extract the primary target file path from a classification (repo-relative
 *  when possible). Returns null if the classifier did not extract one. */
function primaryTarget(c: Nex1IntentResult): string | null {
  if (c.kind !== "classified") return null;
  return c.file_references[0]?.path ?? null;
}

/** Normalise a path to POSIX-style + collapse redundant segments (but keep
 *  `..` so we can detect traversal). Never touches the filesystem. */
function normaliseTargetPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

/** Is `target` outside the given repo root (or contains `..` traversal)? */
function crossRepoCheck(target: string, repoRoot: string): { crossRepo: boolean; reason: string | null } {
  const t = normaliseTargetPath(target);
  if (t.split("/").some((seg) => seg === "..")) {
    return { crossRepo: true, reason: `path contains parent-traversal segment '..' · ${target}` };
  }
  if (path.isAbsolute(t)) {
    // Absolute — must lie inside repoRoot.
    const abs = path.normalize(t);
    const root = path.normalize(repoRoot);
    if (!abs.toLowerCase().startsWith(root.toLowerCase())) {
      return {
        crossRepo: true,
        reason: `absolute target path is outside repo_root · target=${target} · repo_root=${repoRoot}`,
      };
    }
  }
  return { crossRepo: false, reason: null };
}

/** Detect a hostile-AI-zone trigger: an LLM/ML framework name mentioned in
 *  the user's message AND the target is inside INTELLIGENCE_CORE. */
function hostileAiZoneCheck(
  message: string,
  target: string | null,
): { hit: boolean; matchedProvider: string | null; reason: string | null } {
  const m = _LLM_PROVIDER_RE.exec(message);
  if (!m) return { hit: false, matchedProvider: null, reason: null };
  const provider = m[2];
  if (!target) {
    // No target: message names a provider but no destination. Not a hostile-AI
    // zone hit yet — could be a general question. Let it PASS at safety layer.
    return { hit: false, matchedProvider: provider, reason: null };
  }
  const intelligenceCorePrefixes = NEX1_PROTECTED_LAYER_PATHS.INTELLIGENCE_CORE;
  const t = normaliseTargetPath(target);
  const insideIC = intelligenceCorePrefixes.some((prefix) => t === prefix || t.startsWith(prefix));
  if (!insideIC) return { hit: false, matchedProvider: provider, reason: null };
  return {
    hit: true,
    matchedProvider: provider,
    reason:
      `Message names LLM/ML framework '${provider}' with target file inside INTELLIGENCE_CORE (${target}). ` +
      `NEX1 Hostile-AI Zone rule blocks introduction of inference clients into the native code path.`,
  };
}

export function evaluateSafetyBoundary(input: SafetyBoundaryInput): SafetyBoundaryResult {
  const target = primaryTarget(input.classification);

  // Rule 1 · HOSTILE_AI_ZONE (checked first · strongest refusal)
  const ai = hostileAiZoneCheck(input.user_message, target);
  if (ai.hit) {
    return {
      verdict: "I_CANNOT",
      rule_id: "hostile_ai_zone",
      reason: ai.reason!,
      boundary_reason: ai.reason!,
      permission_scope: null,
      protected_layers: target ? pathProtectedLayers(normaliseTargetPath(target)) : [],
      evidence: [`provider_mentioned='${ai.matchedProvider}'`, target ? `target='${target}'` : "target=<none>"],
      zero_llm: true,
      doctrine_reference: "src/lib/nex/master-ai/safety-doctrine.ts",
    };
  }

  // Rule 2 · CROSS_REPO
  if (target) {
    const cr = crossRepoCheck(target, input.repo_root);
    if (cr.crossRepo) {
      return {
        verdict: "I_CANNOT",
        rule_id: "cross_repo",
        reason: cr.reason!,
        boundary_reason: cr.reason!,
        permission_scope: null,
        protected_layers: [],
        evidence: [`target='${target}'`, `repo_root='${input.repo_root}'`],
        zero_llm: true,
        doctrine_reference: "src/lib/nex/master-ai/safety-doctrine.ts",
      };
    }
  }

  // Rule 3 · PROTECTED_PATHS (only for source-mutating verbs)
  const classifiedVerb =
    input.classification.kind === "classified" ? input.classification.verb_family : null;
  const isMutatingVerb = classifiedVerb === "FIX" || classifiedVerb === "MODIFY";
  if (isMutatingVerb && target) {
    const targetNorm = normaliseTargetPath(target);
    if (isPathInProtectedLayer(targetNorm)) {
      const layers = pathProtectedLayers(targetNorm);
      const layerList = layers.join(" + ");
      const scope = `re-certification of protected layer(s) ${layerList} · target=${target}`;
      return {
        verdict: "I_NEED_PERMISSION",
        rule_id: "protected_paths",
        reason:
          `${classifiedVerb} on '${target}' would modify protected layer(s) ${layerList}. ` +
          `Per doctrine, modification of protected layers requires re-certification.`,
        boundary_reason: null,
        permission_scope: scope,
        protected_layers: layers,
        evidence: [`verb=${classifiedVerb}`, `target='${target}'`, `layers=[${layers.join(",")}]`],
        zero_llm: true,
        doctrine_reference: "src/lib/nex/master-ai/safety-doctrine.ts",
      };
    }
  }

  // Rule 4 · PASS
  return {
    verdict: "PASS",
    rule_id: "pass",
    reason: "no boundary rule matched · request may proceed to authorization",
    boundary_reason: null,
    permission_scope: null,
    protected_layers: [],
    evidence: [],
    zero_llm: true,
    doctrine_reference: "src/lib/nex/master-ai/safety-doctrine.ts",
  };
}
