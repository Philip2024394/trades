// src/lib/nex/master-ai/research-engine.ts
//
// NEX Master AI Engineer · M5 · Research engine (source registry +
// adapter interface + queue + persistence)
// Philip 2026-09-07 · AUTHORIZE
//
// MINIMUM VIABLE ARCHITECTURE. No live external HTTP in this pass:
// registering a real live source adapter requires separate founder
// authorization per §5, §10, §43. This module defines:
//
//   · SourceRegistry            (append-only)
//   · SourceAdapter interface   (contract every real adapter must satisfy)
//   · Research queue            (append-only)
//   · Research findings ledger  (append-only · content-hash dedup)
//   · EvidenceClassifier        (7-tag classification enforced)
//
// Fixture adapter provided for tests · never used in production.
// PRESERVATION: never bypasses authentication / CAPTCHA / paywalls /
// robots.txt / rate limits. Every adapter records BLOCKED_REASON when
// legitimate access is denied.

import { createHash, randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import {
  sourceRegistryPath,
  researchQueuePath,
  researchFindingsPath,
} from "./paths";
import type {
  SourceRegistryEntry,
  ResearchQuery,
  ResearchFinding,
  SourceKind,
  AuthorityTier,
  AgentAuthorizationState,
  ClaimClassification,
} from "./types";

// ─── Source adapter contract ────────────────────────────────────────
// Every real adapter must implement this. Adapters are registered via
// `registerAdapter` at runtime · not stored in the JSONL registry
// (which stores only the source metadata).

export type AdapterFetchResult =
  | { status: "OK"; raw_evidence: string; retrieved_at_iso: string; language: string | null; license: string | null }
  | { status: "BLOCKED"; reason: string; retrieved_at_iso: string }
  | { status: "NOT_FOUND"; reason: string; retrieved_at_iso: string }   // query has no answer at source · source is still HEALTHY
  | { status: "FAILED"; reason: string; retrieved_at_iso: string };

export interface SourceAdapter {
  source_slug: string;
  fetch(query: ResearchQuery): Promise<AdapterFetchResult>;
}

const ADAPTERS = new Map<string, SourceAdapter>();

export function registerAdapter(a: SourceAdapter): void {
  ADAPTERS.set(a.source_slug, a);
}

export function getAdapter(slug: string): SourceAdapter | null {
  return ADAPTERS.get(slug) ?? null;
}

export function _clearAdaptersForTests(): void { ADAPTERS.clear(); }

// ─── Source registry (append-only) ──────────────────────────────────

export function registerSource(input: {
  source_slug: string;
  name: string;
  kind: SourceKind;
  authority_tier: AuthorityTier;
  base_url: string | null;
  rate_policy: SourceRegistryEntry["rate_policy"];
  respects_robots_txt: boolean;
  license_note: string | null;
  authorization_state: AgentAuthorizationState;
  registered_by: string;
}): SourceRegistryEntry {
  const entry: SourceRegistryEntry = {
    source_id: randomUUID(),
    ...input,
    registered_at_iso: new Date().toISOString(),
  };
  appendJsonLine(sourceRegistryPath(), entry);
  return entry;
}

export function readAllSourceHistory(): SourceRegistryEntry[] {
  return readJsonlAll<SourceRegistryEntry>(sourceRegistryPath());
}

export function listSources(): SourceRegistryEntry[] {
  const bySlug = new Map<string, SourceRegistryEntry>();
  for (const s of readAllSourceHistory()) bySlug.set(s.source_slug, s);
  return Array.from(bySlug.values()).sort((a, b) => a.source_slug.localeCompare(b.source_slug));
}

export function getSource(slug: string): SourceRegistryEntry | null {
  let latest: SourceRegistryEntry | null = null;
  for (const s of readAllSourceHistory()) if (s.source_slug === slug) latest = s;
  return latest;
}

// ─── Research queue ─────────────────────────────────────────────────

export function enqueueResearchQuery(input: {
  question: string;
  target_source_slugs: string[];
  priority: number;
  created_by: string;
}): ResearchQuery {
  const query: ResearchQuery = {
    query_id: randomUUID(),
    question: input.question,
    target_source_slugs: input.target_source_slugs,
    priority: input.priority,
    status: "QUEUED",
    created_at_iso: new Date().toISOString(),
    created_by: input.created_by,
    resolved_at_iso: null,
    blocked_reason: null,
  };
  appendJsonLine(researchQueuePath(), query);
  return query;
}

export function readAllQueryHistory(): ResearchQuery[] {
  return readJsonlAll<ResearchQuery>(researchQueuePath());
}

/** Latest state per query_id. */
export function listQueries(): ResearchQuery[] {
  const byId = new Map<string, ResearchQuery>();
  for (const q of readAllQueryHistory()) byId.set(q.query_id, q);
  return Array.from(byId.values());
}

export function updateQueryStatus(input: {
  query_id: string;
  status: ResearchQuery["status"];
  blocked_reason?: string;
}): ResearchQuery {
  const current = listQueries().find((q) => q.query_id === input.query_id);
  if (!current) throw new Error(`unknown_query:${input.query_id}`);
  const next: ResearchQuery = {
    ...current,
    status: input.status,
    blocked_reason: input.blocked_reason ?? current.blocked_reason,
    resolved_at_iso: input.status === "COMPLETED" || input.status === "BLOCKED" || input.status === "FAILED"
      ? new Date().toISOString()
      : current.resolved_at_iso,
  };
  appendJsonLine(researchQueuePath(), next);
  return next;
}

// ─── Research findings (append-only · content-hash dedup) ───────────

const VALID_CLASSIFICATIONS: ReadonlySet<ClaimClassification> = new Set([
  "FACT", "OBSERVATION", "INFERENCE", "ESTIMATE", "FORECAST", "SCENARIO", "UNKNOWN",
]);

export class InvalidResearchFindingError extends Error {
  constructor(reason: string) { super(`invalid_research_finding:${reason}`); }
}

/** Classify raw evidence. This function is deliberately CONSERVATIVE:
 *  by default every finding classified as `UNKNOWN` unless upstream
 *  supplies an explicit classification. Doctrine §10 rule: never
 *  present inference as fact. */
export function classifyEvidence(input: {
  claimed_classification?: ClaimClassification;
  raw_evidence: string;
  source_authority_tier: AuthorityTier;
}): ClaimClassification {
  if (input.claimed_classification && VALID_CLASSIFICATIONS.has(input.claimed_classification)) {
    // FACT downgraded to OBSERVATION unless source authority is TIER_1 or TIER_2.
    if (input.claimed_classification === "FACT"
      && input.source_authority_tier !== "TIER_1"
      && input.source_authority_tier !== "TIER_2") {
      return "OBSERVATION";
    }
    return input.claimed_classification;
  }
  return "UNKNOWN";
}

/** Record a research finding · deduplication via content_hash. Returns
 *  the existing finding if the hash was previously recorded. */
export function recordFinding(input: {
  query_id: string;
  source_slug: string;
  authority_tier: AuthorityTier;
  claimed_classification?: ClaimClassification;
  raw_evidence: string;
  normalized_claim: string;
  retrieved_at_iso: string;
  freshness_expires_at_iso: string | null;
  language: string | null;
  license: string | null;
}): ResearchFinding {
  if (!input.raw_evidence || input.raw_evidence.length === 0) {
    throw new InvalidResearchFindingError("raw_evidence_empty");
  }
  const content_hash = createHash("sha256").update(input.raw_evidence).digest("hex");
  const existing = readJsonlAll<ResearchFinding>(researchFindingsPath())
    .find((f) => f.content_hash === content_hash);
  if (existing) return existing;

  const classification = classifyEvidence({
    claimed_classification: input.claimed_classification,
    raw_evidence: input.raw_evidence,
    source_authority_tier: input.authority_tier,
  });

  const finding: ResearchFinding = {
    finding_id: randomUUID(),
    query_id: input.query_id,
    source_slug: input.source_slug,
    authority_tier: input.authority_tier,
    classification,
    raw_evidence: input.raw_evidence,
    normalized_claim: input.normalized_claim,
    content_hash,
    retrieved_at_iso: input.retrieved_at_iso,
    freshness_expires_at_iso: input.freshness_expires_at_iso,
    language: input.language,
    license: input.license,
  };
  appendJsonLine(researchFindingsPath(), finding);
  return finding;
}

export function readAllFindings(): ResearchFinding[] {
  return readJsonlAll<ResearchFinding>(researchFindingsPath());
}

export function _resetResearchForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [sourceRegistryPath(), researchQueuePath(), researchFindingsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
  _clearAdaptersForTests();
}
