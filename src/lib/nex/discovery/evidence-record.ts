// src/lib/nex/discovery/evidence-record.ts
//
// UWI · Wave 3.3 · M13 · WARC-shaped evidence record + provenance chain
// Founder-authorised programme.
//
// This is the ONLY sanctioned way to record a fetch outcome. Every
// discovery-layer transaction produces one EvidenceRecord that captures
// the full provenance chain (discover → robots → schedule → fetch →
// extract → normalise) so downstream evidence layers can audit the
// complete lineage.
//
// WARC-shaped means the field vocabulary follows WARC/1.1 concepts
// (record_id · record_type · target_url · fetched_at · content_type ·
// content_length · content_hash) without committing to the on-disk WARC
// format. warcio dependency was DEFERRED in Wave 3.1 — this record shape
// can be trivially serialised to WARC later if needed.

import type {
  CanonicalUrl,
  EvidenceRecord,
  ExtractionOutcome,
  DiscoveryFailure,
  RobotsDecision,
  PolitenessOutcome,
} from "./types";
import { deriveIdempotencyKey } from "@/lib/nex/durability/idempotency-key";

export interface EvidenceRecordInput {
  workflow_id: string;
  activity_name: string;
  attempt_id: string | number;
  target_url: CanonicalUrl;
  source_class: string;
  robots_decision: RobotsDecision;
  politeness: PolitenessOutcome;
  fetched_at_iso: string;
  content_type?: string | null;
  content_length?: number | null;
  content_hash_sha256?: string | null;
  headers?: Record<string, string>;
  body_ref?: string | null;
  provenance_chain?: ReadonlyArray<{ stage: string; at_iso: string; detail?: string }>;
  extraction?: ExtractionOutcome | null;
  failure?: DiscoveryFailure | null;
  record_type?: EvidenceRecord["record_type"];
}

export function buildEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  const record_id = deriveIdempotencyKey({
    workflow_id: input.workflow_id,
    activity_name: input.activity_name,
    attempt_id: input.attempt_id,
  });
  return {
    record_id,
    record_type: input.record_type ?? "response",
    target_url: input.target_url,
    fetched_at_iso: input.fetched_at_iso,
    content_type: input.content_type ?? null,
    content_length: input.content_length ?? null,
    content_hash_sha256: input.content_hash_sha256 ?? null,
    headers: input.headers ?? {},
    body_ref: input.body_ref ?? null,
    source_class: input.source_class,
    provenance_chain: input.provenance_chain ?? [],
    robots_decision: input.robots_decision,
    politeness: input.politeness,
    extraction: input.extraction ?? null,
    failure: input.failure ?? null,
  };
}

/** Append a stage to the provenance chain immutably. */
export function withProvenanceStage(
  record: EvidenceRecord,
  stage: string,
  detail?: string,
  at_iso: string = new Date().toISOString(),
): EvidenceRecord {
  return {
    ...record,
    provenance_chain: [...record.provenance_chain, { stage, at_iso, detail }],
  };
}

/** Attach an extraction outcome (immutable). */
export function withExtraction(record: EvidenceRecord, extraction: ExtractionOutcome): EvidenceRecord {
  return { ...record, extraction };
}

/** Attach a failure classification (immutable). */
export function withFailure(record: EvidenceRecord, failure: DiscoveryFailure): EvidenceRecord {
  return { ...record, failure };
}
