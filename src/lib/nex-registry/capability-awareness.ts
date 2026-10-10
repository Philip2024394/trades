// src/lib/nex-registry/capability-awareness.ts
//
// NEX Capability Awareness Query API (Ledger B · Zero LLM)
//
// This is the natural-language-shaped interface that NEX1, Twin, Referee
// and specialist agents call to reason about "what can NEX currently do?"
//
// FOUNDER MANDATE
//   NEX must know what NEX can do, what NEX cannot do, which agents can
//   do it, which tools/components/assets enable it, what evidence proves
//   it, what dependencies constrain it, and how recently that capability
//   was verified.
//
// ANTI-MANUFACTURING INVARIANTS
//   1. MISSING is a real result · never converted to "maybe we have it"
//   2. Every answer returns EVIDENCE (paths / test files) not confidence scores
//   3. Only VERIFIED or PROMOTED capabilities are returned by default
//   4. Intent queries return NOT_UNDERSTOOD when no semantic tag matches ·
//      never fabricate a mapping
//   5. Agent scope queries return empty when the agent owns nothing ·
//      not a fabricated list

import { getCapability, getCapabilityByName, listCapabilities } from "./capability-registry";
import { findByTag, findMissing, getRequires, getRequiredBy, proposeCompositionPath, type CapabilityReference, type CompositionPath, type GapAnalysis } from "./capability-graph";
import { getAgentByName } from "./agent-registry";
import { verifyClaim } from "./capability-verifier";
import type { CapabilityCategory, CapabilityRecord, VerificationResult } from "./capability-types";

export const NEX_CAPABILITY_AWARENESS_VERSION = "nex-capability-awareness.v1.2026-09-19";

// ── "What can NEX do?" ────────────────────────────────────────────────
export interface AwarenessResponse<T> {
  readonly question: string;
  readonly answer: T;
  readonly evidence_count: number;
  readonly answered_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

// Return trustable capabilities (PROMOTED by default; caller can widen)
export function whatCanNexDo(scope: { category?: CapabilityCategory; include_verified?: boolean } = {}): AwarenessResponse<readonly CapabilityRecord[]> {
  const rows: CapabilityRecord[] = [];
  const acceptVerified = scope.include_verified ?? true;   // VERIFIED counts by default
  for (const c of listCapabilities()) {
    if (scope.category && c.category !== scope.category) continue;
    if (c.status === "PROMOTED" || (acceptVerified && c.status === "VERIFIED")) rows.push(c);
  }
  return {
    question: scope.category ? `what can NEX do in category=${scope.category}?` : "what can NEX do?",
    answer: Object.freeze(rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))),
    evidence_count: rows.reduce((s, c) => s + c.evidence_refs.length, 0),
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "What can NEX NOT do?" ────────────────────────────────────────────
export function whatCanNexNotDo(): AwarenessResponse<readonly { capability_name: string; reason: string }[]> {
  const rows: { capability_name: string; reason: string }[] = [];
  for (const c of listCapabilities()) {
    if (c.status === "REJECTED") rows.push({ capability_name: c.name, reason: `rejected · failure_patterns=${c.failure_patterns.join(",")}` });
    if (c.status === "DEPRECATED") rows.push({ capability_name: c.name, reason: `deprecated${c.supersedes ? ` · superseded_by=${c.supersedes}` : ""}` });
    if (c.status === "PROPOSED") rows.push({ capability_name: c.name, reason: "proposed but not yet verified · cannot be relied on" });
  }
  return {
    question: "what can NEX not do?",
    answer: Object.freeze(rows.sort((a, b) => a.capability_name.localeCompare(b.capability_name))),
    evidence_count: 0,
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "What can this agent do?" ─────────────────────────────────────────
export function whatCanAgentDo(agentName: string): AwarenessResponse<readonly CapabilityRecord[]> {
  const agent = getAgentByName(agentName);
  if (!agent) {
    return {
      question: `what can agent ${agentName} do?`,
      answer: Object.freeze([]),
      evidence_count: 0,
      answered_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    };
  }
  const rows: CapabilityRecord[] = [];
  for (const c of listCapabilities()) {
    if (c.status !== "VERIFIED" && c.status !== "PROMOTED") continue;
    if (c.owner_agent === agentName || c.supporting_agents.includes(agentName)) rows.push(c);
  }
  return {
    question: `what can agent ${agentName} do?`,
    answer: Object.freeze(rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))),
    evidence_count: rows.reduce((s, c) => s + c.evidence_refs.length, 0),
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "What evidence supports this capability?" ─────────────────────────
export function whatEvidenceSupports(ref: CapabilityReference): AwarenessResponse<VerificationResult> {
  const answer = verifyClaim(ref);
  const capName = ref.by_name ? `${ref.by_name.category}::${ref.by_name.name}` : ref.capability_id ?? "unknown";
  const count = answer.outcome === "VERIFIED" ? answer.evidence.length : 0;
  return {
    question: `what evidence supports capability ${capName}?`,
    answer,
    evidence_count: count,
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "What depends on this capability?" ────────────────────────────────
export function whatDependsOn(capability_id: string): AwarenessResponse<readonly CapabilityRecord[]> {
  const rows = getRequiredBy(capability_id);
  return {
    question: `what depends on capability_id=${capability_id}?`,
    answer: rows,
    evidence_count: rows.length,
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "What does this capability depend on?" ────────────────────────────
export function whatDoesItDependOn(capability_id: string): AwarenessResponse<readonly CapabilityRecord[]> {
  const rows = getRequires(capability_id);
  return {
    question: `what does capability_id=${capability_id} depend on?`,
    answer: rows,
    evidence_count: rows.length,
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "What is missing for this request?" ───────────────────────────────
export function whatIsMissingFor(requested: readonly CapabilityReference[]): AwarenessResponse<GapAnalysis> {
  const gap = findMissing(requested);
  return {
    question: "what is missing for this request?",
    answer: gap,
    evidence_count: gap.satisfied.length,
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "How would I build this?" · dependency-ordered plan ───────────────
export function howToBuild(goal: CapabilityReference): AwarenessResponse<CompositionPath> {
  const path = proposeCompositionPath(goal);
  const label = goal.by_name ? `${goal.by_name.category}::${goal.by_name.name}` : goal.capability_id ?? "unknown";
  return {
    question: `how do I build ${label}?`,
    answer: path,
    evidence_count: path.outcome === "resolved" ? path.total_steps : 0,
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── "Can I satisfy this intent?" · semantic tag matching ──────────────
export type IntentMatch =
  | { readonly outcome: "matched"; readonly candidates: readonly CapabilityRecord[]; readonly matched_tags: readonly string[] }
  | { readonly outcome: "NOT_UNDERSTOOD"; readonly rationale: string };

export function canSatisfyIntent(intent_keywords: readonly string[]): AwarenessResponse<IntentMatch> {
  if (intent_keywords.length === 0) {
    return {
      question: "can NEX satisfy this intent?",
      answer: { outcome: "NOT_UNDERSTOOD", rationale: "no intent keywords provided" },
      evidence_count: 0,
      answered_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    };
  }
  const candidates = findByTag(intent_keywords);
  if (candidates.length === 0) {
    return {
      question: "can NEX satisfy this intent?",
      answer: {
        outcome: "NOT_UNDERSTOOD",
        rationale: `no capability has semantic_tags matching any of: ${intent_keywords.join(", ")}`,
      },
      evidence_count: 0,
      answered_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    };
  }
  // Filter to trustable only (Rule 2: PROPOSED capabilities cannot satisfy an intent)
  const trustable = candidates.filter((c) => c.status === "VERIFIED" || c.status === "PROMOTED");
  if (trustable.length === 0) {
    return {
      question: "can NEX satisfy this intent?",
      answer: {
        outcome: "NOT_UNDERSTOOD",
        rationale: `capability tag(s) matched but no matching capability is VERIFIED or PROMOTED · only PROPOSED candidates exist (Rule 2)`,
      },
      evidence_count: 0,
      answered_at_iso: new Date().toISOString(),
      zero_llm: true,
      ledger: "B",
    };
  }
  const usedTags: string[] = [];
  const lc = intent_keywords.map((t) => t.toLowerCase());
  for (const c of trustable) {
    for (const tag of c.semantic_tags ?? []) if (lc.includes(tag.toLowerCase()) && !usedTags.includes(tag)) usedTags.push(tag);
  }
  return {
    question: "can NEX satisfy this intent?",
    answer: {
      outcome: "matched",
      candidates: Object.freeze(trustable),
      matched_tags: Object.freeze(usedTags),
    },
    evidence_count: trustable.reduce((s, c) => s + c.evidence_refs.length, 0),
    answered_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}

// ── Summary snapshot for chat-turn / dashboards ───────────────────────
export interface AwarenessSnapshot {
  readonly version: string;
  readonly total_capabilities: number;
  readonly trustable_count: number;
  readonly proposed_count: number;
  readonly rejected_count: number;
  readonly by_category: Record<CapabilityCategory, number>;
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function awarenessSnapshot(): AwarenessSnapshot {
  const all = listCapabilities();
  const by_category = { brain: 0, agents: 0, code: 0, ui: 0, visual: 0, layout: 0, runtime: 0, governance: 0, evolution: 0 } as Record<CapabilityCategory, number>;
  let trustable = 0, proposed = 0, rejected = 0;
  for (const c of all) {
    by_category[c.category] += 1;
    if (c.status === "VERIFIED" || c.status === "PROMOTED") trustable += 1;
    if (c.status === "PROPOSED") proposed += 1;
    if (c.status === "REJECTED") rejected += 1;
  }
  return {
    version: NEX_CAPABILITY_AWARENESS_VERSION,
    total_capabilities: all.length,
    trustable_count: trustable,
    proposed_count: proposed,
    rejected_count: rejected,
    by_category,
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}
