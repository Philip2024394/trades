// src/lib/nex/programmer-learning/verification.ts
//
// NEX Programmer Agent · Phase A · verification & contradiction discipline
// Philip 2026-09-05 · AUTHORIZE
//
// This module enforces:
//   · §10 duplicate detection / contradiction handling / supersession
//   · §7 no self-reported success as authority
//   · §11 failures preserved as first-class experiences
//
// The verifier operates over the append-only stores from ./store.
// It NEVER silently overwrites: supersession and rejection are
// captured as NEW records (via appendKnowledge with superseded_by
// set on the OLD record's replacement pointer).

import {
  appendKnowledge,
  readKnowledge,
  stableHash,
  generateId,
  newProvenance,
} from "./store";
import type {
  KnowledgeItem,
  Provenance,
  VerificationState,
} from "./types";

// ─── Duplicate detection ─────────────────────────────────────────

/** Two knowledge items are duplicates when their content_hash matches
 *  AND their source_url matches. Same fact from different sources is
 *  NOT a duplicate — it's corroboration (or contradiction). */
export function detectDuplicate(
  incoming: Pick<KnowledgeItem, "content_hash" | "provenance">,
  existing: KnowledgeItem[],
): KnowledgeItem | null {
  for (const k of existing) {
    if (k.content_hash === incoming.content_hash
        && k.provenance.source_url === incoming.provenance.source_url) {
      return k;
    }
  }
  return null;
}

// ─── Contradiction detection ─────────────────────────────────────

export type ContradictionReport = {
  kind: "contradiction" | "supersession_candidate" | "corroboration" | "unrelated";
  existing: KnowledgeItem;
  reason: string;
};

/** Given a new knowledge item, classify its relationship to existing
 *  records for the SAME (domain, technology).
 *  - SAME statement · SAME source → corroboration (later merged / kept)
 *  - SAME technology · DIFFERENT statement · both authoritative → contradiction
 *  - SAME technology · SAME statement · newer source higher tier → supersession candidate
 *  - Otherwise → unrelated
 *
 *  This function DOES NOT MUTATE. Callers decide what to do with the
 *  report (per §10: "STORE THE DISAGREEMENT · do not manufacture
 *  consensus"). */
export function classifyIncomingKnowledge(
  incoming: KnowledgeItem,
  existing: KnowledgeItem[],
): ContradictionReport[] {
  const reports: ContradictionReport[] = [];
  const authorityRank: Record<string, number> = {
    TIER_1: 5, TIER_2: 4, TIER_3: 3, TIER_4: 2, TIER_5: 1,
  };
  for (const k of existing) {
    if (k.domain !== incoming.domain) continue;
    if (incoming.technology && k.technology && k.technology !== incoming.technology) continue;
    if (k.knowledge_id === incoming.knowledge_id) continue;
    // Corroboration · same statement from a different source
    if (statementSimilarity(k.statement, incoming.statement) >= 0.85
        && k.provenance.source_url !== incoming.provenance.source_url) {
      reports.push({
        kind: "corroboration",
        existing: k,
        reason: `same statement, different source (${k.provenance.source})`,
      });
      continue;
    }
    // Supersession candidate · same statement, newer authoritative source
    if (statementSimilarity(k.statement, incoming.statement) >= 0.75
        && authorityRank[incoming.provenance.authority_tier] > authorityRank[k.provenance.authority_tier]) {
      reports.push({
        kind: "supersession_candidate",
        existing: k,
        reason: `newer authoritative source · tier ${incoming.provenance.authority_tier} > ${k.provenance.authority_tier}`,
      });
      continue;
    }
    // Contradiction · same technology · substantively different statement · both authoritative
    if (statementSimilarity(k.statement, incoming.statement) < 0.35
        && authorityRank[k.provenance.authority_tier] >= 3
        && authorityRank[incoming.provenance.authority_tier] >= 3
        && sharesDomainTechnology(k, incoming)) {
      reports.push({
        kind: "contradiction",
        existing: k,
        reason: `distinct statements for same (domain, technology) from Tier-${authorityRank[k.provenance.authority_tier]} + Tier-${authorityRank[incoming.provenance.authority_tier]} sources`,
      });
    }
  }
  return reports;
}

function sharesDomainTechnology(a: KnowledgeItem, b: KnowledgeItem): boolean {
  if (a.domain !== b.domain) return false;
  if (a.technology && b.technology && a.technology === b.technology) return true;
  // Same domain, unspecified tech on one side: still count as "may contradict".
  if (!a.technology || !b.technology) return true;
  return false;
}

/** Jaccard similarity over word-sets · deterministic · no LLM. */
function statementSimilarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
  const wb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
  if (wa.size === 0 && wb.size === 0) return 1;
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersect = 0;
  for (const w of wa) if (wb.has(w)) intersect++;
  const union = wa.size + wb.size - intersect;
  return union > 0 ? intersect / union : 0;
}

// ─── Supersession (§10 · never silent) ───────────────────────────

/** Mark an OLD knowledge item as superseded by a NEW one.
 *  Emits a NEW knowledge record (append-only discipline) with
 *  verification_status=SUPERSEDED and superseded_by=<new id>.
 *  The original record on disk is not mutated · the store is
 *  append-only. Retrieval respects the latest record per knowledge_id.
 */
export function markSuperseded(input: {
  old_knowledge_id: string;
  new_knowledge_id: string;
  reason: string;
  actor_source: string;      // "verifier" · "philip" · etc.
}): KnowledgeItem {
  const existing = readKnowledge();
  const old = existing.find((k) => k.knowledge_id === input.old_knowledge_id);
  if (!old) throw new Error(`markSuperseded: old_knowledge_id ${input.old_knowledge_id} not found`);
  const provenance: Provenance = newProvenance({
    source: input.actor_source,
    source_type: "internal_artifact",
    authority_tier: "TIER_1",     // supersession is a NEX-internal metadata event
    evidence_pointer: `supersession:${input.old_knowledge_id}->${input.new_knowledge_id}`,
    observed_by: "system",
  });
  const record: KnowledgeItem = {
    ...old,
    knowledge_id: generateId("know"),
    verification_status: "SUPERSEDED",
    superseded_by: input.new_knowledge_id,
    provenance,
    content_hash: stableHash({ supersedes: old.knowledge_id, by: input.new_knowledge_id }),
    created_at: new Date().toISOString(),
  };
  appendKnowledge(record);
  return record;
}

// ─── Contradiction recording (§10) ───────────────────────────────

/** Record a contradiction between two authoritative sources. Emits a
 *  NEW knowledge record marking BOTH as contradicting. Never chooses
 *  a winner · never manufactures consensus. */
export function recordContradiction(input: {
  a_knowledge_id: string;
  b_knowledge_id: string;
  contradiction_statement: string;
  actor_source: string;
}): KnowledgeItem {
  const provenance: Provenance = newProvenance({
    source: input.actor_source,
    source_type: "internal_artifact",
    authority_tier: "TIER_1",
    evidence_pointer: `contradiction:${input.a_knowledge_id}::${input.b_knowledge_id}`,
    observed_by: "system",
  });
  const record: KnowledgeItem = {
    knowledge_id: generateId("know"),
    statement: `[CONTRADICTION] ${input.contradiction_statement}`,
    domain: "meta.contradiction",
    technology: null,
    provenance,
    verification_status: "CHECKED",   // the contradiction itself is verified
    confidence: 1.0,                  // certainty that they disagree
    superseded_by: null,
    related_knowledge: [input.a_knowledge_id, input.b_knowledge_id],
    content_hash: stableHash({ a: input.a_knowledge_id, b: input.b_knowledge_id }),
    created_at: new Date().toISOString(),
  };
  appendKnowledge(record);
  return record;
}

// ─── Verification with evidence (§4 lifecycle: DISCOVERED → CHECKED → VERIFIED) ─

/** Promote a knowledge item's verification_status by appending a NEW
 *  record with the promoted state and an evidence pointer explaining
 *  why. Old record retained for provenance chain.
 *
 *  IMPORTANT: promotion to VERIFIED requires an independent
 *  evidence_pointer that is NOT the same source URL as the knowledge
 *  itself (per §7 · self-reference is not verification). */
export function verifyKnowledge(input: {
  knowledge_id: string;
  new_status: VerificationState;
  independent_evidence_pointer: string;
  independent_evidence_source: string;  // "test_runner" · "runtime" · "cross_reference" etc.
  reason: string;
}): KnowledgeItem {
  const existing = readKnowledge();
  const orig = existing.find((k) => k.knowledge_id === input.knowledge_id);
  if (!orig) throw new Error(`verifyKnowledge: not found ${input.knowledge_id}`);
  if (input.new_status === "VERIFIED"
      && orig.provenance.source_url
      && orig.provenance.source_url === input.independent_evidence_pointer) {
    throw new Error("verifyKnowledge: independent evidence pointer must differ from the knowledge's own source URL (§7 no self-reference)");
  }
  const provenance: Provenance = newProvenance({
    source: input.independent_evidence_source,
    source_type: "internal_artifact",
    authority_tier: "TIER_1",
    evidence_pointer: input.independent_evidence_pointer,
    observed_by: "system",
  });
  const record: KnowledgeItem = {
    ...orig,
    knowledge_id: generateId("know"),
    verification_status: input.new_status,
    confidence: input.new_status === "VERIFIED" ? Math.min(1, orig.confidence + 0.1) : orig.confidence,
    provenance,
    superseded_by: null,
    content_hash: stableHash({ verifies: orig.knowledge_id, status: input.new_status, reason: input.reason }),
    created_at: new Date().toISOString(),
    related_knowledge: [orig.knowledge_id, ...(orig.related_knowledge ?? [])],
  };
  appendKnowledge(record);
  return record;
}

// ─── Structural integrity check (§4) ─────────────────────────────

/** Cheap check that a knowledge record's provenance is well-formed.
 *  Returns list of issues · empty = OK. Never mutates. */
export function checkKnowledgeIntegrity(k: KnowledgeItem): string[] {
  const issues: string[] = [];
  if (!k.knowledge_id) issues.push("missing knowledge_id");
  if (!k.statement || k.statement.trim().length < 4) issues.push("statement too short");
  if (!k.domain) issues.push("missing domain");
  if (!k.provenance) issues.push("missing provenance");
  else {
    if (!k.provenance.source) issues.push("provenance.source missing");
    if (!k.provenance.evidence_pointer) issues.push("provenance.evidence_pointer missing");
    if (!k.provenance.retrieved_at) issues.push("provenance.retrieved_at missing");
    if (!k.provenance.authority_tier) issues.push("provenance.authority_tier missing");
  }
  if (!k.content_hash) issues.push("missing content_hash");
  if (typeof k.confidence !== "number" || k.confidence < 0 || k.confidence > 1) {
    issues.push("confidence out of range");
  }
  return issues;
}

