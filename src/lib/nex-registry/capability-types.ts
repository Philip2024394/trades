// src/lib/nex-registry/capability-types.ts
//
// NEX Self-Model · Capability Types (Ledger B · Zero LLM)
//
// FOUNDER PRINCIPLE
//   NEX must know what NEX can do, what NEX cannot do, which agents can
//   do it, which tools/components/assets enable it, what evidence proves
//   it, what dependencies constrain it, and how recently that capability
//   was verified.
//
//   NEX may discover and propose capability evolution, but only verified
//   evidence can promote a capability from proposed knowledge into
//   trusted capability knowledge.
//
// ANTI-MANUFACTURING INVARIANTS
//   · Agent-proposed capabilities START AS PROPOSED
//   · PROPOSED cannot be auto-selected
//   · Promotion to VERIFIED requires evidence_refs.length > 0 with real paths
//   · Promotion to PROMOTED (auto-selectable) requires last_verified_iso set
//   · A CapabilityRecord in category "agents" · "brain" · "code" · etc.
//     that claims implementation_paths must have at least one path present
//     on disk (structural check) OR user_authorized verification

import { createHash } from "node:crypto";
import type { DeviceSupport, LicenseClass, QualityTier } from "./types";

export const NEX_CAPABILITY_VERSION = "nex-capability.v1.2026-09-19";

// ── Capability status (evolution-safe · anti-manufacturing) ───────────
export type CapabilityStatus =
  | "PROPOSED"      // Discovered/hypothesised · not yet verified · cannot be trusted
  | "VERIFIED"      // Has real evidence of working · can be referenced but not auto-selected
  | "PROMOTED"      // Meets founder standard for auto-selection · verified + recent
  | "DEPRECATED"    // Still exists but superseded by a newer capability
  | "SUPERSEDED"    // No longer used · replaced by <supersedes_reference>
  | "REJECTED"      // Tried and failed verification · retained for audit
  | "UNKNOWN";      // Placeholder · missing evidence · never used at runtime

// ── The 9 self-model layers (founder mandate) ─────────────────────────
export type CapabilityCategory =
  | "brain"         // Reasoning · memory · learning · language · evidence · verification
  | "agents"        // Specialist roles · capabilities · boundaries
  | "code"          // Coding operators · repository model · tests · scaffold · repair
  | "ui"            // Components · primitives · forms · navigation · accessibility
  | "visual"        // Icons · fonts · images · illustrations · animation · video · 3D · charts · maps
  | "layout"        // Desktop · tablet · mobile · PWA · responsive transformation · templates
  | "runtime"       // Browser · dev-server · preview · filesystem · processes · APIs · deployment
  | "governance"    // Licenses · provenance · security · evidence · quality · modernity
  | "evolution";    // Discoveries · hypotheses · experiments · promotions · deprecations

// ── Verification method (how a capability's claim is proven) ──────────
export type VerificationMethod =
  | "test_suite"          // Pointer to a real vitest test file that exercises the capability
  | "integration_proof"   // Pointer to a scripts/*-proof.mjs run + receipt
  | "runtime_receipt"     // Pointer to a data/*/receipt.json
  | "structural_check"    // Deterministic check that named files/functions exist
  | "user_authorized"     // Founder confirmed manually (recorded)
  | "not_verified";       // No verification yet · capability MUST remain PROPOSED

// ── Evidence reference (real path OR nothing) ─────────────────────────
export type EvidenceKind =
  | "test_file"
  | "integration_proof"
  | "receipt_json"
  | "source_file"
  | "task_receipt"
  | "user_confirmation";

export interface EvidenceRef {
  readonly kind: EvidenceKind;
  readonly path: string;              // relative to repo root · MUST exist for a real verification
  readonly hash: string | null;       // optional SHA-256 of the evidence content
  readonly observed_at_iso: string;
  readonly note: string;              // one line · what this evidence attests to
}

// ── Composition hierarchy (§21 founder mandate) ──────────────────────
// ATOM → COMPONENT → COMPOSITE → SECTION → PATTERN → PAGE → APPLICATION
export type CompositionLevel =
  | "atom"           // icon · colour · font · spacing token
  | "component"      // Button · Input · Card · Badge
  | "composite"      // ContactForm · SearchBar · LoginForm
  | "section"        // Hero · TestimonialsSection · FAQSection
  | "pattern"        // CheckoutFlow · OnboardingFlow · BookingFlow
  | "page"           // Landing · Dashboard · Directory
  | "application"    // Complete assembled product
  | "infrastructure" // Non-visual capabilities (code · runtime · governance)
  | "unspecified";

// ── The core CapabilityRecord ─────────────────────────────────────────
export interface CapabilityRecord {
  readonly capability_id: string;            // deterministic SHA-256 prefix
  readonly name: string;
  readonly category: CapabilityCategory;
  readonly description: string;
  readonly status: CapabilityStatus;
  readonly owner_agent: string | null;       // agent name (see agent-registry) · null for infrastructure
  readonly supporting_agents: readonly string[];
  readonly implementation_paths: readonly string[];  // real files that implement this
  readonly dependencies: readonly string[];          // other capability_ids
  readonly inputs: readonly string[];                // semantic input shapes
  readonly outputs: readonly string[];               // semantic output shapes
  readonly compatible_frameworks: readonly string[]; // ["react","tailwindcss","next.js"]
  readonly device_support: DeviceSupport;
  readonly verification_method: VerificationMethod;
  readonly evidence_refs: readonly EvidenceRef[];
  readonly failure_patterns: readonly string[];      // known failure signatures
  readonly quality_tier: QualityTier;
  readonly license_constraints: readonly LicenseClass[];
  readonly version: string;
  readonly last_verified_iso: string | null;         // when evidence was last observed to match
  readonly proposed_by: string | null;               // agent name that proposed this capability (never "trusted")
  readonly promoted_at_iso: string | null;           // when it was promoted from PROPOSED to VERIFIED/PROMOTED
  readonly supersedes: string | null;                // capability_id being replaced · if any
  readonly composition_level?: CompositionLevel;     // §21 hierarchy · optional · defaults to "unspecified"
  readonly semantic_tags?: readonly string[];        // e.g. ["contact","form","location"] for intent-driven search
  readonly zero_llm: true;
  readonly ledger: "B";
}

// ── Deterministic capability_id ───────────────────────────────────────
export function computeCapabilityId(input: { category: CapabilityCategory; name: string }): string {
  return createHash("sha256").update(`capability::${input.category}::${input.name}`).digest("hex").slice(0, 20);
}

// ── Helpers ────────────────────────────────────────────────────────────
export function isAutoSelectableStatus(status: CapabilityStatus): boolean {
  return status === "PROMOTED";
}

export function isTrustable(status: CapabilityStatus): boolean {
  return status === "PROMOTED" || status === "VERIFIED";
}

export function needsPromotionEvidence(status: CapabilityStatus): boolean {
  return status === "PROPOSED";
}

// ── Verification result (Twin/Referee-facing) ─────────────────────────
export type VerificationResult =
  | { readonly outcome: "VERIFIED"; readonly evidence: readonly EvidenceRef[]; readonly rationale: string }
  | { readonly outcome: "REFUTED"; readonly reason: string }
  | { readonly outcome: "INSUFFICIENT_EVIDENCE"; readonly missing: readonly string[]; readonly rationale: string }
  | { readonly outcome: "CAPABILITY_UNKNOWN"; readonly capability_id_or_name: string };

// ── Capability query filter (agents ask "what can NEX do?") ───────────
export interface CapabilityQuery {
  readonly category?: CapabilityCategory;
  readonly status?: CapabilityStatus;
  readonly quality_tier?: QualityTier;
  readonly owner_agent?: string;
  readonly supports_device?: keyof DeviceSupport;
  readonly framework?: string;
  readonly auto_selectable_only?: boolean;
}
