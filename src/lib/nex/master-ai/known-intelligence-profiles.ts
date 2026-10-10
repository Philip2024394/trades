// src/lib/nex/master-ai/known-intelligence-profiles.ts
//
// NEX Native Intelligence (NI) Doctrine · known intelligence profiles
// Founder 2026-09-16 · AUTHORIZE (NI Doctrine Phase 2)
//
// This file exports evidence-backed intelligence profiles for the agents /
// sub-capabilities where the audit of 2026-09-16 (Agent B LLM audit + Agent A
// agent inventory) produced concrete evidence.
//
// These constants are INERT — they are not automatically recorded to the
// master-ai JSONL ledger. Recording is a deliberate human action:
//   `recordCapabilityProfile({ agent_id, ..., intelligence_status: <constant> })`
//
// Every agent NOT listed here defaults to UNKNOWN via
// UNKNOWN_INTELLIGENCE_PROFILE. Per founder rule, UNKNOWN never auto-upgrades
// to NATIVE — evidence must be verified per-agent before adding to this file.

import type { Nex1IntelligenceProfile } from "./intelligence-status";

const NOW = "2026-09-16T00:00:00.000Z";

// ── NEX1 sub-capabilities (all NATIVE · No-LLM Hard Rule scope) ─────────────

/**
 * NEX1 · Capability A · Founder Intent Classifier
 * Deterministic vocabulary + verb-family classification of goal strings.
 * Cannot comprehend code · cannot answer natural-language comprehension.
 */
export const NEX1_CAPABILITY_A_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "NATIVE",
  maturity: "NI-1",
  native_capabilities: [
    {
      capability: "coding-vocabulary-classification",
      implementation_path: "src/lib/nex-agent/code-engine/capability-a-founder-intent/",
      test_paths: [
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/__tests__/classifier.test.ts",
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/__tests__/coding-vocabulary.test.ts",
      ],
      test_count: 1634,
      version: "v5.0.0-alpha.7",
      last_verified_iso: NOW,
      scope_positive: [
        "verb-family classification (BUILD/MODIFY/FIX/REFACTOR/TEST/INVESTIGATE/VERIFY/REMOVE)",
        "deliverable-kind classification (application/component/function/module/test/route/endpoint/type_definition/documentation)",
        "coding vocabulary recognition (~180 tools · ~250 frameworks · ~1254 concepts · ~65 languages · ~240 config files)",
        "file-reference extraction via regex",
        "project-directory reference detection with context-evidence gate (Cluster 2)",
        "requirement-marker extraction (must_have / must_not_have / constraint / verification_intent)",
      ],
      scope_negative: [
        "does not read target file contents",
        "does not perform semantic reasoning",
        "does not answer natural-language questions",
        "refuses when the goal contains no controlled-vocabulary verb",
      ],
    },
  ],
  delegated_capabilities: [],
  unsupported_capabilities: [
    { capability: "source-code-comprehension", reason: "requires generative reasoning", requires_generative: true },
    { capability: "execution-flow-reasoning", reason: "no AST/CFG implementation", requires_generative: true },
    { capability: "cross-file-semantic-reasoning", reason: "no symbol graph implementation", requires_generative: true },
  ],
  rejected_claims: [],
  last_audit_iso: NOW,
  taught_by: "master_ai_engineer",
});

/**
 * NEX1 · Capability M-1 · File Memory Index
 * Stores file metadata (SHA-256, size, language, tags, summary). Summary
 * is CALLER-SUPPLIED, not computed from file contents.
 */
export const NEX1_CAPABILITY_M1_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "NATIVE",
  maturity: "NI-1",
  native_capabilities: [
    {
      capability: "file-metadata-storage",
      implementation_path: "src/lib/nex-agent/code-engine/capability-m-file-memory/",
      test_paths: [
        "src/lib/nex-agent/code-engine/capability-m-file-memory/__tests__/store.test.ts",
        "src/lib/nex-agent/code-engine/capability-m-file-memory/__tests__/language-detect.test.ts",
      ],
      test_count: 32,
      version: "v1.0.0",
      last_verified_iso: NOW,
      scope_positive: [
        "append-only JSONL persistence of file entries",
        "SHA-256 fingerprinting + byte size",
        "language detection by extension",
        "caller-supplied tags + summary",
        "path validation (no traversal / no outside-repo)",
        "recall by path with kind={found|forgotten|not_remembered}",
      ],
      scope_negative: [
        "does NOT generate summaries from file contents (summary is caller-supplied)",
        "does not read code semantically",
        "does not build symbol graphs",
      ],
    },
  ],
  delegated_capabilities: [],
  unsupported_capabilities: [
    { capability: "automatic-summary-generation", reason: "would require generative comprehension", requires_generative: true },
  ],
  rejected_claims: [],
  last_audit_iso: NOW,
  taught_by: "master_ai_engineer",
});

/**
 * NEX1 · Cluster 2 · Project-Dir Detector (Phase 1.10-alpha.2)
 * Evidence-gated detection of well-known project directory names in goal
 * text. Emits compound path + segments with evidence kind.
 */
export const NEX1_CLUSTER2_PROJECT_DIR_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "NATIVE",
  maturity: "NI-1",
  native_capabilities: [
    {
      capability: "project-directory-reference-detection",
      implementation_path: "src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts",
      test_paths: [
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/__tests__/coding-vocabulary-v5-alpha7-project-dirs-detector.test.ts",
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/__tests__/coding-vocabulary-v5-alpha8-founder-kill-test.test.ts",
        "src/lib/nex-agent/code-engine/capability-a-founder-intent/__tests__/coding-vocabulary-v5-alpha9-terminal-position.test.ts",
      ],
      test_count: 191, // alpha.7 (19) + alpha.8 (~119) + alpha.9 (53)
      version: "v5.0.0-alpha.9",
      last_verified_iso: NOW,
      scope_positive: [
        "compound path detection (src/lib/util → path + segments[])",
        "trailing-slash detection (components/)",
        "path_noun_anchor (directory/folder/dir/path/tree/layout/structure)",
        "path_verb_anchor (cd/into/in/inside/under/at/to/from/within)",
        "framework_anchor with mandatory path_noun co-occurrence (founder rule #2)",
        "adjacent_file_ref (extracts dir portion of extracted file refs)",
        "underscore-prefixed dir detection (__tests__ / __mocks__ / __snapshots__ / __pycache__) · alpha.9 tokenizer fix",
        "terminal-position rule for path_verb_anchor bare-word emission · alpha.9 · distinguishes `in src/lib` (path) from `in services rendered` (English)",
        "trailing-punctuation stripping in dir lookup (`services.` → `services`) · alpha.9",
        "Founder Kill Test corpus passes (bare English words emit nothing without anchor · English continuations after path_verb_prep correctly suppress)",
      ],
      scope_negative: [
        "does not understand what those directories contain",
        "does not build directory-structure knowledge from a repository",
        "does not propagate path context through chained connectors (`in components and hooks` emits only `components`) · alpha.5+ scope",
        "cannot fully disambiguate English idioms ending in a well-known dir (`the util lives in services` still emits) · genuinely ambiguous",
        "detection ≠ understanding (per founder architectural rule)",
      ],
    },
  ],
  delegated_capabilities: [],
  unsupported_capabilities: [],
  rejected_claims: [
    "Alpha.9 does NOT elevate NEX1 to NI-2 · the terminal-position rule is smarter classification, still NI-1 recognition",
    "Alpha.9 does NOT enable source-code comprehension",
  ],
  last_audit_iso: NOW,
  taught_by: "master_ai_engineer",
});

// ── Wider NEX components (AI_DELEGATED — legitimate LLM use outside NEX1) ───

/**
 * NEX Nex Orchestrator (`nex/agent.ts`) · AI_DELEGATED
 * Uses Anthropic Claude (Haiku + Opus) for conversational orchestration.
 * NOT within NEX1's No-LLM Hard Rule scope — this is the wider NEX chat surface.
 */
export const NEX_NEX_ORCHESTRATOR_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "AI_DELEGATED",
  maturity: "NI-0",
  native_capabilities: [],
  delegated_capabilities: [
    {
      capability: "conversational-orchestration",
      provider: "Anthropic Claude (Haiku + Opus routing)",
      caller_path: "src/lib/nex/agent.ts",
      fallback_present: true, // NEX_DETERMINISTIC_REPLY=1 uses composer first, LLM rescue after
    },
  ],
  unsupported_capabilities: [],
  rejected_claims: [],
  last_audit_iso: NOW,
  taught_by: "master_ai_engineer",
});

/**
 * NEX Brain (`nex/brain/llm.ts`) · AI_DELEGATED
 * 8-provider LLM chain with circuit breaker + daily budget tracking.
 * Legitimate AI-delegated capability. Outside NEX1 scope.
 */
export const NEX_BRAIN_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "AI_DELEGATED",
  maturity: "NI-0",
  native_capabilities: [],
  delegated_capabilities: [
    {
      capability: "text-and-json-completion",
      provider: "Multi-provider chain: SambaNova → Cerebras → Cloudflare → HuggingFace → Mistral → Groq → Gemini → OpenRouter (+ Anthropic emergency-only)",
      caller_path: "src/lib/nex/brain/llm.ts",
      fallback_present: true, // mock deterministic adapter when all providers fail
    },
  ],
  unsupported_capabilities: [],
  rejected_claims: [
    "NEX Brain is not 'Native Intelligence' — it delegates to external LLM providers",
  ],
  last_audit_iso: NOW,
  taught_by: "master_ai_engineer",
});

// Staircase Advisor · deferred pending evidence.
//
// Phase 2 audit found `src/lib/nex/staircase-advisor/llm-composer.ts` (LLM
// composer) and `src/lib/nex/brain/agents/staircase.ts` (deterministic
// staircase brain), suggesting a HYBRID composition. However, no explicit
// test file could be located for the deterministic side during the audit,
// so we CANNOT claim HYBRID status without violating the NI Doctrine's
// evidence requirement. The Staircase Advisor stays UNKNOWN until direct
// evidence is verified — do not add it to KNOWN_INTELLIGENCE_PROFILES
// without a test path. This IS the doctrine working correctly.

// ── NEX1 top-level composite profile ────────────────────────────────────────

/**
 * NEX1 (composite view) · NATIVE
 * Composite of all NEX1 sub-capabilities. This is the profile a Test-20 style
 * probe of "What is your intelligence status?" should return for NEX1 as a
 * whole. Every native capability listed here has evidence; every gap is
 * declared honestly.
 */
export const NEX1_COMPOSITE_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "NATIVE",
  maturity: "NI-1",
  native_capabilities: [
    ...NEX1_CAPABILITY_A_PROFILE.native_capabilities,
    ...NEX1_CAPABILITY_M1_PROFILE.native_capabilities,
    ...NEX1_CLUSTER2_PROJECT_DIR_PROFILE.native_capabilities,
  ],
  delegated_capabilities: [],
  unsupported_capabilities: [
    { capability: "source-code-comprehension (Test-20 Q1)", reason: "no AST + no symbol graph + no natural-language generation", requires_generative: true },
    { capability: "execution-flow-reasoning (Test-20 Q2)", reason: "no control-flow analysis", requires_generative: true },
    { capability: "data-flow-reasoning (Test-20 Q3)", reason: "no data-flow analysis", requires_generative: true },
    { capability: "symbol-relationship-reasoning (Test-20 Q4)", reason: "no symbol graph", requires_generative: false },
    { capability: "type-relationship-reasoning (Test-20 Q5)", reason: "no TS compiler API integration yet", requires_generative: false },
    { capability: "cross-file-semantic-reasoning (Test-20 Q6)", reason: "no import graph implementation yet", requires_generative: false },
    { capability: "contextual-bug-identification (Test-20 Q10)", reason: "requires reasoning about intent vs behaviour", requires_generative: true },
    { capability: "edge-case-reasoning (Test-20 Q11)", reason: "requires generative enumeration", requires_generative: true },
    { capability: "change-impact-reasoning (Test-20 Q13)", reason: "requires cross-file semantic analysis", requires_generative: true },
    { capability: "code-modification (Test-20 Q14)", reason: "requires generative capability", requires_generative: true },
    { capability: "refactoring (Test-20 Q15)", reason: "requires generative capability", requires_generative: true },
    { capability: "natural-language-evidence-explanation (Test-20 Q16)", reason: "requires natural-language generation", requires_generative: true },
    { capability: "self-meta-reasoning (Test-20 Q17)", reason: "requires reasoning about own limits", requires_generative: true },
  ],
  rejected_claims: [
    "NEX1 does NOT claim 'Full Native Intelligence'",
    "NEX1 does NOT claim source-code comprehension",
    "NEX1 does NOT claim human-level intelligence",
    "NEX1 does NOT claim autonomous operation",
    "The '~24/50 skill ladder' figure in AGENT-CAPABILITY-MAPPING-2026-09-13.md is a subjective estimate, not an NI-doctrine maturity level",
  ],
  last_audit_iso: NOW,
  taught_by: "master_ai_engineer",
});

// ── Registry map for lookup ─────────────────────────────────────────────────

/**
 * All known intelligence profiles, keyed by a stable slug. Consumers can
 * iterate this map (e.g., a self-report endpoint) to describe every agent
 * whose status has been evidence-verified.
 *
 * Agents NOT in this map default to UNKNOWN_INTELLIGENCE_PROFILE. That IS
 * the correct behaviour per founder rule: "Every UNKNOWN stays UNKNOWN until
 * direct evidence."
 */
export const KNOWN_INTELLIGENCE_PROFILES: ReadonlyMap<string, Nex1IntelligenceProfile> = new Map([
  ["nex1", NEX1_COMPOSITE_PROFILE],
  ["nex1_capability_a", NEX1_CAPABILITY_A_PROFILE],
  ["nex1_capability_m1", NEX1_CAPABILITY_M1_PROFILE],
  ["nex1_cluster2_project_dirs", NEX1_CLUSTER2_PROJECT_DIR_PROFILE],
  ["nex_nex_orchestrator", NEX_NEX_ORCHESTRATOR_PROFILE],
  ["nex_brain", NEX_BRAIN_PROFILE],
]);
