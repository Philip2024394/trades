// WO-CRAWLER-INTERNET-01 · shared intelligence source pool.
//
// Founder-locked 2026-09-13 · NEX Continuous Multi-Source Crawler Directive:
//   Crawler writes to a SHARED source pool (nex_intelligence_sources).
//   Sanitizer reads from that pool. Discovery reads from Sanitizer's output.
//   Each hop produces attributable evidence linking back to Crawler's real
//   external acquisition.
//
// This breaks the per-agent-memory silo that previously prevented the
// intelligence pipeline from flowing.

import { randomUUID } from "node:crypto";
import { provenanceChainHash, sha256Hex } from "./provenance";
import { getStorage } from "@/lib/nex/storage/registry";

export const SOURCE_POOL_COLLECTION = "nex_intelligence_sources";
export const SOURCE_ENTRY_POOL_COLLECTION = "nex_intelligence_source_entries";
export const SANITIZED_POOL_COLLECTION = "nex_intelligence_sanitized";
export const DISCOVERY_POOL_COLLECTION = "nex_intelligence_discoveries";
export const HYPOTHESIS_POOL_COLLECTION = "nex_intelligence_hypotheses";
export const EXPERIMENT_POOL_COLLECTION = "nex_intelligence_experiments";
export const KNOWLEDGE_POOL_COLLECTION = "nex_intelligence_knowledge_objects";
export const PROPOSAL_POOL_COLLECTION = "nex_intelligence_proposals";

// ── Shared record types ────────────────────────────────────────────────

export interface SourceRecord {
  readonly record_type: "NEX_INTELLIGENCE_SOURCE";
  readonly source_id: string;
  readonly emitter_agent_id: string;
  readonly emitter_identity_id: string;
  readonly emitter_mission_id: string;
  readonly registry_source_id: string;              // e.g. "arxiv-cs-se" · from AUTHORISED_SOURCES
  readonly host: string;
  readonly url: string;
  readonly http_status: number;
  readonly response_bytes: number;
  readonly content_sha256: string;
  readonly content_type: string;
  readonly acquired_at: string;
  readonly latency_ms: number;
  readonly body_ref: string | null;                 // optional: pointer to body storage · null in slice-1
  readonly evidence_marker: string;
  readonly provenance_chain_hash: string;
}

/**
 * A structured entry extracted from a SourceRecord (e.g. one Atom `<entry>`
 * per source response). Founder-locked · every entry preserves back-refs
 * to its parent SourceRecord and carries its own raw content_hash so
 * the Sanitizer can dedupe deterministically.
 */
export interface SourceEntryRecord {
  readonly record_type: "NEX_INTELLIGENCE_SOURCE_ENTRY";
  readonly source_entry_id: string;
  readonly source_id: string;                       // parent SourceRecord
  readonly emitter_agent_id: string;
  readonly emitter_identity_id: string;
  readonly kind: "atom_entry" | "raw_content";
  readonly raw_content_hash: string;
  readonly raw_text: string;                         // capped raw text (pre-sanitize)
  readonly extracted_at: string;
  readonly provenance_chain_hash: string;
}

export interface SanitizedRecord {
  readonly record_type: "NEX_INTELLIGENCE_SANITIZED";
  readonly sanitized_id: string;
  readonly emitter_agent_id: string;
  readonly emitter_identity_id: string;
  readonly source_id: string;                       // FK → SourceRecord
  readonly source_entry_id: string;                  // FK → SourceEntry (the specific entry sanitized)
  readonly source_content_hash: string;              // parent SourceRecord's content_sha256
  readonly canonical_text: string;                   // real canonical form of the entry
  readonly canonical_tokens: readonly string[];      // extracted word tokens for downstream analysis
  readonly canonical_word_count: number;
  readonly sanitized_hash: string;
  readonly bytes: number;
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

export interface DiscoveryRecord {
  readonly record_type: "NEX_INTELLIGENCE_DISCOVERY";
  readonly discovery_id: string;
  readonly emitter_agent_id: string;
  readonly source_sanitized_ids: readonly string[];  // FK → SanitizedRecord
  readonly cluster_bucket: string;
  readonly member_count: number;
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

export interface HypothesisRecord {
  readonly record_type: "NEX_INTELLIGENCE_HYPOTHESIS";
  readonly hypothesis_id: string;
  readonly emitter_agent_id: string;
  readonly source_discovery_ids: readonly string[];
  readonly predicate: string;
  readonly testable: boolean;
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

export interface ExperimentRecord {
  readonly record_type: "NEX_INTELLIGENCE_EXPERIMENT";
  readonly experiment_id: string;
  readonly emitter_agent_id: string;
  readonly hypothesis_id: string;
  readonly result: "PASS" | "FAIL";
  readonly measurement: Readonly<Record<string, unknown>>;
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

export interface KnowledgeObjectRecord {
  readonly record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT";
  readonly knowledge_object_id: string;
  readonly emitter_agent_id: string;
  readonly source_experiment_id: string;
  readonly source_hypothesis_id: string;
  readonly source_discovery_ids: readonly string[];
  readonly source_sanitized_ids: readonly string[];
  readonly source_source_ids: readonly string[];
  readonly tier: "VALIDATED";
  readonly causal_chain: string;
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

export interface ProposalRecord {
  readonly record_type: "NEX_INTELLIGENCE_PROPOSAL";
  readonly proposal_id: string;
  readonly emitter_agent_id: string;
  readonly source_knowledge_object_id: string;
  readonly evidence_chain: readonly string[];
  readonly founder_signature_slot: null;             // P-U · never signed by agent
  readonly created_at: string;
  readonly provenance_chain_hash: string;
}

// ── Write helpers (with content-hash + provenance chain) ───────────────

export async function persistSourceRecord(input: Omit<SourceRecord, "record_type" | "source_id" | "provenance_chain_hash">): Promise<SourceRecord> {
  const source_id = `SRC-${input.content_sha256.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
  const base = { record_type: "NEX_INTELLIGENCE_SOURCE" as const, source_id, ...input };
  const record: SourceRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(SOURCE_POOL_COLLECTION, record);
  return record;
}

export async function persistSourceEntry(input: Omit<SourceEntryRecord, "record_type" | "source_entry_id" | "raw_content_hash" | "provenance_chain_hash">): Promise<SourceEntryRecord> {
  const raw_content_hash = sha256Hex(input.raw_text);
  const source_entry_id = `SRC-ENT-${raw_content_hash.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
  const base = { record_type: "NEX_INTELLIGENCE_SOURCE_ENTRY" as const, source_entry_id, raw_content_hash, ...input };
  const record: SourceEntryRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(SOURCE_ENTRY_POOL_COLLECTION, record);
  return record;
}

export async function loadRecentSourceEntries(limit = 500): Promise<SourceEntryRecord[]> {
  return getStorage().query<SourceEntryRecord>(SOURCE_ENTRY_POOL_COLLECTION, { limit, order_by: "extracted_at", order_dir: "desc" }).catch(() => []);
}

export async function persistSanitized(input: Omit<SanitizedRecord, "record_type" | "sanitized_id" | "sanitized_hash" | "provenance_chain_hash">): Promise<SanitizedRecord> {
  const sanitized_hash = sha256Hex(input.canonical_text + "|" + input.source_content_hash + "|" + input.source_entry_id);
  const sanitized_id = `SAN-${sanitized_hash.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
  const base = { record_type: "NEX_INTELLIGENCE_SANITIZED" as const, sanitized_id, sanitized_hash, ...input };
  const record: SanitizedRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(SANITIZED_POOL_COLLECTION, record);
  return record;
}

export async function persistDiscovery(input: Omit<DiscoveryRecord, "record_type" | "discovery_id" | "provenance_chain_hash">): Promise<DiscoveryRecord> {
  const idHash = sha256Hex(input.cluster_bucket + ":" + [...input.source_sanitized_ids].sort().join(","));
  const discovery_id = `DISC-${idHash.slice(0, 16)}`;
  const base = { record_type: "NEX_INTELLIGENCE_DISCOVERY" as const, discovery_id, ...input };
  const record: DiscoveryRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(DISCOVERY_POOL_COLLECTION, record);
  return record;
}

export async function persistHypothesis(input: Omit<HypothesisRecord, "record_type" | "hypothesis_id" | "provenance_chain_hash">): Promise<HypothesisRecord> {
  const idHash = sha256Hex([...input.source_discovery_ids].sort().join("|") + ":" + input.predicate);
  const hypothesis_id = `HYP-${idHash.slice(0, 16)}`;
  const base = { record_type: "NEX_INTELLIGENCE_HYPOTHESIS" as const, hypothesis_id, ...input };
  const record: HypothesisRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(HYPOTHESIS_POOL_COLLECTION, record);
  return record;
}

export async function persistExperiment(input: Omit<ExperimentRecord, "record_type" | "experiment_id" | "provenance_chain_hash">): Promise<ExperimentRecord> {
  const experiment_id = `EXP-${sha256Hex(input.hypothesis_id + Date.now()).slice(0, 16)}`;
  const base = { record_type: "NEX_INTELLIGENCE_EXPERIMENT" as const, experiment_id, ...input };
  const record: ExperimentRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(EXPERIMENT_POOL_COLLECTION, record);
  return record;
}

export async function persistKnowledgeObject(input: Omit<KnowledgeObjectRecord, "record_type" | "knowledge_object_id" | "provenance_chain_hash">): Promise<KnowledgeObjectRecord> {
  const knowledge_object_id = `KO-${sha256Hex(input.source_experiment_id).slice(0, 16)}`;
  const base = { record_type: "NEX_INTELLIGENCE_KNOWLEDGE_OBJECT" as const, knowledge_object_id, ...input };
  const record: KnowledgeObjectRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(KNOWLEDGE_POOL_COLLECTION, record);
  return record;
}

export async function persistProposal(input: Omit<ProposalRecord, "record_type" | "proposal_id" | "founder_signature_slot" | "provenance_chain_hash">): Promise<ProposalRecord> {
  const proposal_id = `PROP-${sha256Hex(input.source_knowledge_object_id).slice(0, 16)}`;
  const base = { record_type: "NEX_INTELLIGENCE_PROPOSAL" as const, proposal_id, founder_signature_slot: null as const, ...input };
  const record: ProposalRecord = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(PROPOSAL_POOL_COLLECTION, record);
  return record;
}

// ── Read helpers (batched) ─────────────────────────────────────────────

export async function loadRecentSources(limit = 200): Promise<SourceRecord[]> {
  return getStorage().query<SourceRecord>(SOURCE_POOL_COLLECTION, { limit, order_by: "acquired_at", order_dir: "desc" }).catch(() => []);
}
export async function loadRecentSanitized(limit = 200): Promise<SanitizedRecord[]> {
  return getStorage().query<SanitizedRecord>(SANITIZED_POOL_COLLECTION, { limit, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
export async function loadRecentDiscoveries(limit = 200): Promise<DiscoveryRecord[]> {
  return getStorage().query<DiscoveryRecord>(DISCOVERY_POOL_COLLECTION, { limit, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
export async function loadRecentHypotheses(limit = 200): Promise<HypothesisRecord[]> {
  return getStorage().query<HypothesisRecord>(HYPOTHESIS_POOL_COLLECTION, { limit, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
export async function loadRecentExperiments(limit = 200): Promise<ExperimentRecord[]> {
  return getStorage().query<ExperimentRecord>(EXPERIMENT_POOL_COLLECTION, { limit, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
export async function loadRecentKnowledgeObjects(limit = 200): Promise<KnowledgeObjectRecord[]> {
  return getStorage().query<KnowledgeObjectRecord>(KNOWLEDGE_POOL_COLLECTION, { limit, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
export async function loadRecentProposals(limit = 200): Promise<ProposalRecord[]> {
  return getStorage().query<ProposalRecord>(PROPOSAL_POOL_COLLECTION, { limit, order_by: "created_at", order_dir: "desc" }).catch(() => []);
}
