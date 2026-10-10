// src/lib/nex/discovery-intel/relationships.ts
//
// NEX Fresh World Discovery · relationship learner + reader
// Founder-authorised programme · bounded wave 2026-09-21.

import type { PoolClient } from "pg";
import type { DiscoveryRelationship, RelationshipKind, RelationshipStatus } from "./types";

export const EVIDENCE_FLOOR_FOR_CONFIDENCE_1 = 25;

export async function recordRelationshipEvidence(
  client: PoolClient,
  input: {
    parent_term: string; child_term: string; relationship_kind: RelationshipKind;
    topic: string; cycle_id: string; evidence_added: number;
  },
): Promise<{ kind: "new_relationship" | "evidence_appended" | "skipped_self_loop"; relationship_id: string; evidence_count: number; confidence: number }> {
  if (input.parent_term === input.child_term) {
    return { kind: "skipped_self_loop", relationship_id: "", evidence_count: 0, confidence: 0 };
  }
  const evidence_added = Math.max(0, Math.floor(input.evidence_added ?? 0));

  const existing = await client.query(
    `SELECT relationship_id, evidence_count FROM nex.discovery_relationship
      WHERE parent_term = $1 AND child_term = $2 AND relationship_kind = $3 AND topic = $4`,
    [input.parent_term, input.child_term, input.relationship_kind, input.topic],
  );

  if (existing.rows.length === 0) {
    const conf = Math.min(1, evidence_added / EVIDENCE_FLOOR_FOR_CONFIDENCE_1);
    const insert = await client.query(
      `INSERT INTO nex.discovery_relationship
         (parent_term, child_term, relationship_kind, topic, evidence_count, confidence,
          first_observed_cycle, last_observed_cycle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING relationship_id, evidence_count, confidence`,
      [input.parent_term, input.child_term, input.relationship_kind, input.topic, evidence_added, conf, input.cycle_id],
    );
    return {
      kind: "new_relationship",
      relationship_id: insert.rows[0].relationship_id,
      evidence_count: insert.rows[0].evidence_count,
      confidence: Number(insert.rows[0].confidence),
    };
  }

  const row = existing.rows[0];
  const new_evidence_count = row.evidence_count + evidence_added;
  const new_conf = Math.min(1, new_evidence_count / EVIDENCE_FLOOR_FOR_CONFIDENCE_1);
  const updated = await client.query(
    `UPDATE nex.discovery_relationship
        SET evidence_count = $1, confidence = $2, last_observed_cycle = $3, last_observed_at = now()
      WHERE relationship_id = $4
    RETURNING relationship_id, evidence_count, confidence`,
    [new_evidence_count, new_conf, input.cycle_id, row.relationship_id],
  );
  return {
    kind: "evidence_appended",
    relationship_id: updated.rows[0].relationship_id,
    evidence_count: updated.rows[0].evidence_count,
    confidence: Number(updated.rows[0].confidence),
  };
}

export async function loadRelationships(
  client: PoolClient,
  input: { topic: string; parent_term?: string; min_evidence?: number },
): Promise<ReadonlyArray<DiscoveryRelationship>> {
  const params: unknown[] = [input.topic];
  let where = `topic = $1`;
  if (input.parent_term) { params.push(input.parent_term); where += ` AND parent_term = $${params.length}`; }
  if (input.min_evidence !== undefined) { params.push(input.min_evidence); where += ` AND evidence_count >= $${params.length}`; }
  const res = await client.query(
    `SELECT relationship_id, parent_term, child_term, relationship_kind, topic,
            evidence_count, confidence::float AS confidence,
            first_observed_cycle, last_observed_cycle,
            first_observed_at::text AS first_observed_at,
            last_observed_at::text  AS last_observed_at,
            status, metadata
       FROM nex.discovery_relationship
      WHERE ${where}
      ORDER BY evidence_count DESC, parent_term, child_term
      LIMIT 500`,
    params,
  );
  return res.rows.map(r => ({
    relationship_id: r.relationship_id, parent_term: r.parent_term, child_term: r.child_term,
    relationship_kind: r.relationship_kind as RelationshipKind, topic: r.topic,
    evidence_count: r.evidence_count, confidence: Number(r.confidence),
    first_observed_cycle: r.first_observed_cycle, last_observed_cycle: r.last_observed_cycle,
    first_observed_at: r.first_observed_at, last_observed_at: r.last_observed_at,
    status: r.status as RelationshipStatus, metadata: r.metadata ?? {},
  }));
}
