// src/lib/nex-directory/business-knowledge-object.ts
//
// BUSINESS KNOWLEDGE OBJECT (BKO) reader.
//
// The polymorphic evidence overlay for food + accommodation. Each row = one piece
// of evidence about one attribute of one business. Reads carry the full SOURCE →
// CLAIM → INTERPRETATION → UNKNOWN chain so Decision Context can compose honest
// answers without inventing anything.
//
// This module ONLY reads and writes evidence rows. It does not score, rank,
// recommend, or classify. Those live in Decision Context (which consumes BKO) and
// nowhere else.
//
// Doctrine anchors:
//   - Truth Invariant (2026-08-22 CONSTITUTIONAL)
//   - Business Knowledge Object three-layer (2026-08-23)
//   - SOURCE → CLAIM → INTERPRETATION → UNKNOWN → DECISION chain (2026-08-23)
//   - Verified vs Anecdotal source rule (2026-08-23)
//   - Reputation Non-Weapon rule (2026-08-23): scorers must NOT read BKO
//
// Bright lines enforced by TYPES here:
//   - EvidenceItem does not carry a `verdict` field. Verdicts live in Decision Context.
//   - readBusinessKnowledge NEVER returns bare values. Every attribute returns the
//     full evidence array so the caller sees provenance and interpretation.
//   - There is no `getSuitable()` or `isFamilySafe()` shortcut. Callers must go
//     through Decision Context which composes SCIUD honestly.

import { withClient, type PgClientLike } from "../nex/db";

export type SourceTier =
  | "VERIFIED"
  | "OBSERVED"
  | "OWNER_CLAIM"
  | "INFERRED"
  | "UNKNOWN";

export type AttributeDomain =
  | "identity"
  | "location"
  | "contact"
  | "opening_availability"
  | "facilities"
  | "accessibility"
  | "family"
  | "suitability"
  | "character"
  | "commercial"
  | "freshness"
  | "physical";

export type Vertical = "food" | "accommodation";

export interface EvidenceItem {
  knowledgeId: string;
  vertical: Vertical;
  businessRef: string;
  attributeDomain: AttributeDomain;
  attributeKey: string;
  source: string;
  sourceReference: string | null;
  sourceTier: SourceTier;
  claim: unknown;
  interpretation: string | null;
  unknownNote: string | null;
  confidence: number | null;
  capturedAt: Date;
  freshnessValidUntil: Date | null;
  provenance: Record<string, unknown>;
  snapshotId: string | null;
  cycleRunId: string | null;
  supersededBy: string | null;
  createdAt: Date;
}

export interface BusinessKnowledge {
  vertical: Vertical;
  businessRef: string;
  byDomain: Partial<Record<AttributeDomain, Record<string, EvidenceItem[]>>>;
  allEvidence: EvidenceItem[];
}

export interface EvidenceWriteInput {
  vertical: Vertical;
  businessRef: string;
  attributeDomain: AttributeDomain;
  attributeKey: string;
  source: string;
  sourceReference?: string | null;
  sourceTier: SourceTier;
  claim: unknown;
  interpretation?: string | null;
  unknownNote?: string | null;
  confidence?: number | null;
  capturedAt?: Date;
  freshnessValidUntil?: Date | null;
  provenance?: Record<string, unknown>;
  snapshotId?: string | null;
  cycleRunId?: string | null;
}

const TIER_RANK: Record<SourceTier, number> = {
  VERIFIED: 5,
  OBSERVED: 4,
  OWNER_CLAIM: 3,
  INFERRED: 2,
  UNKNOWN: 1,
};

function rowToItem(row: Record<string, unknown>): EvidenceItem {
  return {
    knowledgeId: String(row.knowledge_id),
    vertical: row.vertical as Vertical,
    businessRef: String(row.business_ref),
    attributeDomain: row.attribute_domain as AttributeDomain,
    attributeKey: String(row.attribute_key),
    source: String(row.source),
    sourceReference: (row.source_reference ?? null) as string | null,
    sourceTier: row.source_tier as SourceTier,
    claim: row.claim,
    interpretation: (row.interpretation ?? null) as string | null,
    unknownNote: (row.unknown_note ?? null) as string | null,
    confidence: row.confidence == null ? null : Number(row.confidence),
    capturedAt: new Date(String(row.captured_at)),
    freshnessValidUntil: row.freshness_valid_until
      ? new Date(String(row.freshness_valid_until))
      : null,
    provenance: (row.provenance ?? {}) as Record<string, unknown>,
    snapshotId: (row.snapshot_id ?? null) as string | null,
    cycleRunId: (row.cycle_run_id ?? null) as string | null,
    supersededBy: (row.superseded_by ?? null) as string | null,
    createdAt: new Date(String(row.created_at)),
  };
}

/**
 * Read the full evidence overlay for one business. Returns a structure where
 * every attribute maps to an ARRAY of evidence items sorted by tier descending.
 * There is no "current best value" shortcut here — callers must inspect the
 * evidence and use Decision Context to compose an honest answer.
 */
export async function readBusinessKnowledge(
  vertical: Vertical,
  businessRef: string,
): Promise<BusinessKnowledge | null> {
  return withClient(async (client) => {
    const q = await client.query(
      `SELECT * FROM nex.business_knowledge
        WHERE vertical = $1
          AND business_ref = $2
          AND superseded_by IS NULL
        ORDER BY attribute_domain, attribute_key, source_tier DESC, captured_at DESC`,
      [vertical, businessRef],
    );

    const allEvidence = q.rows.map(rowToItem);
    const byDomain: BusinessKnowledge["byDomain"] = {};

    for (const item of allEvidence) {
      const domain = (byDomain[item.attributeDomain] ??= {});
      const bucket = (domain[item.attributeKey] ??= []);
      bucket.push(item);
    }

    // Preserve tier-desc ordering per attribute
    for (const domain of Object.values(byDomain)) {
      if (!domain) continue;
      for (const items of Object.values(domain)) {
        items.sort((a, b) => {
          const t = TIER_RANK[b.sourceTier] - TIER_RANK[a.sourceTier];
          if (t !== 0) return t;
          return b.capturedAt.getTime() - a.capturedAt.getTime();
        });
      }
    }

    return { vertical, businessRef, byDomain, allEvidence };
  });
}

/**
 * Write one piece of evidence. New evidence for the same (vertical, business,
 * attribute, source, source_reference) tuple supersedes the previous row rather
 * than rewriting it — the audit chain is preserved.
 *
 * Returns the new knowledge_id, or null when the pool is unavailable.
 */
export async function writeEvidence(
  input: EvidenceWriteInput,
): Promise<string | null> {
  return withClient(async (client) => {
    return await writeEvidenceInClient(client, input);
  });
}

async function writeEvidenceInClient(
  client: PgClientLike,
  input: EvidenceWriteInput,
): Promise<string> {
  const capturedAt = input.capturedAt ?? new Date();
  const provenance = input.provenance ?? {};

  // Look up any existing live row for this (vertical, business, attribute, source, ref)
  const existing = await client.query(
    `SELECT knowledge_id FROM nex.business_knowledge
      WHERE vertical = $1 AND business_ref = $2
        AND attribute_domain = $3 AND attribute_key = $4
        AND source = $5 AND source_reference IS NOT DISTINCT FROM $6
        AND superseded_by IS NULL`,
    [
      input.vertical,
      input.businessRef,
      input.attributeDomain,
      input.attributeKey,
      input.source,
      input.sourceReference ?? null,
    ],
  );

  // If an identical live row exists we insert a new versioned row and mark the
  // old one superseded. This keeps the audit chain even when the claim value
  // itself hasn't changed (freshness matters too).
  const insert = await client.query(
    `INSERT INTO nex.business_knowledge (
       vertical, business_ref, attribute_domain, attribute_key,
       source, source_reference, source_tier, claim,
       interpretation, unknown_note, confidence,
       captured_at, freshness_valid_until,
       provenance, snapshot_id, cycle_run_id
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8::jsonb,
       $9, $10, $11,
       $12, $13,
       $14::jsonb, $15, $16
     )
     ON CONFLICT (vertical, business_ref, attribute_domain, attribute_key, source, source_reference)
     DO UPDATE SET
       claim = EXCLUDED.claim,
       source_tier = EXCLUDED.source_tier,
       interpretation = EXCLUDED.interpretation,
       unknown_note = EXCLUDED.unknown_note,
       confidence = EXCLUDED.confidence,
       captured_at = EXCLUDED.captured_at,
       freshness_valid_until = EXCLUDED.freshness_valid_until,
       provenance = EXCLUDED.provenance,
       snapshot_id = EXCLUDED.snapshot_id,
       cycle_run_id = EXCLUDED.cycle_run_id
     RETURNING knowledge_id`,
    [
      input.vertical,
      input.businessRef,
      input.attributeDomain,
      input.attributeKey,
      input.source,
      input.sourceReference ?? null,
      input.sourceTier,
      JSON.stringify(input.claim),
      input.interpretation ?? null,
      input.unknownNote ?? null,
      input.confidence ?? null,
      capturedAt.toISOString(),
      input.freshnessValidUntil?.toISOString() ?? null,
      JSON.stringify(provenance),
      input.snapshotId ?? null,
      input.cycleRunId ?? null,
    ],
  );

  // Cast the returned row's knowledge_id back to string
  const newRow = insert.rows[0] as { knowledge_id: string } | undefined;
  const newId = String(newRow?.knowledge_id ?? "");

  // Mark any *different* prior row superseded. In practice ON CONFLICT above
  // catches the exact-tuple case; the sweep here handles source_reference NULL
  // vs a specific value from the same source.
  if (existing.rows.length > 0) {
    const priorId = String((existing.rows[0] as { knowledge_id: string }).knowledge_id);
    if (priorId !== newId) {
      await client.query(
        `UPDATE nex.business_knowledge SET superseded_by = $1 WHERE knowledge_id = $2`,
        [newId, priorId],
      );
    }
  }

  return newId;
}

/**
 * List every current evidence item across a whole vertical for a single attribute.
 * Useful for coverage audits ("how many food rows have wheelchair evidence?").
 */
export async function auditAttributeCoverage(
  vertical: Vertical,
  attributeDomain: AttributeDomain,
  attributeKey: string,
): Promise<{ businessRef: string; sourceTier: SourceTier; capturedAt: Date }[]> {
  const result = await withClient(async (client) => {
    const q = await client.query(
      `SELECT business_ref, source_tier, captured_at
         FROM nex.business_knowledge
        WHERE vertical = $1 AND attribute_domain = $2 AND attribute_key = $3
          AND superseded_by IS NULL
        ORDER BY business_ref`,
      [vertical, attributeDomain, attributeKey],
    );
    return q.rows.map((r) => ({
      businessRef: String(r.business_ref),
      sourceTier: r.source_tier as SourceTier,
      capturedAt: new Date(String(r.captured_at)),
    }));
  });
  return result ?? [];
}
