// src/lib/nex/aof/agents/evidence-audit-agent.ts
//
// NEX Autonomous Operations Framework · Evidence Audit Agent
// Founder-authorised programme · 2026-09-22.
//
// Continuously verifies the provenance chain integrity:
//   candidate → source (Founder-signed) → website → page → evidence → email
//
// Rules enforced (audit_fail on violation):
//   R1: every discovery_business_evidence.discovered_email has an email_source_url that starts with http(s)://
//   R2: every discovered_via_source is present in nex.harvest_source AND founder_signed_at IS NOT NULL
//   R3: every candidate reachable back from evidence exists in harvest_business_candidate
//   R4: no evidence row has both discovered_email set AND email_source_url NULL (would be fabrication)
//   R5: no candidate.source_slug missing from harvest_source (broken provenance)
//   R6: no walked candidate with emails_discovered_count > 0 but zero evidence rows
//
// Fails soft (returns report) · orbiting agent decides how to react.

import type { PgClient } from "../types";
import { requireCapability } from "../capability";
import { logAgentEvent } from "../lifecycle";

export interface EvidenceAuditDeps {
  readonly client: PgClient;
  readonly agent_id: string;
  readonly cycle_id?: string;
}

export interface AuditReport {
  readonly pass: boolean;
  readonly checks: Readonly<Record<string, { pass: boolean; count: number; sample?: any[] }>>;
  readonly summary: {
    readonly evidence_rows_total: number;
    readonly evidence_rows_with_email: number;
    readonly candidates_total: number;
    readonly walked_candidates_total: number;
    readonly countries_with_evidence: number;
    readonly sources_in_evidence: number;
  };
}

export async function auditEvidenceChain(deps: EvidenceAuditDeps): Promise<AuditReport> {
  await requireCapability(deps.client, deps.agent_id, "audit_evidence");
  const c = deps.client;
  const checks: Record<string, { pass: boolean; count: number; sample?: any[] }> = {};

  // R1 · every email has http(s) source_url
  const r1 = await c.query(`
    SELECT business_name, discovered_email, email_source_url FROM nex.discovery_business_evidence
     WHERE discovered_email IS NOT NULL
       AND (email_source_url IS NULL OR email_source_url !~* '^https?://')
     LIMIT 5`);
  checks.R1_email_source_url_valid = { pass: r1.rowCount === 0, count: r1.rowCount ?? 0, sample: r1.rows };

  // R2 · every discovered_via_source is Founder-signed
  const r2 = await c.query(`
    SELECT DISTINCT e.discovered_via_source
      FROM nex.discovery_business_evidence e
      LEFT JOIN nex.harvest_source s ON s.source_slug = e.discovered_via_source
     WHERE e.discovered_via_source IS NOT NULL
       AND (s.source_slug IS NULL OR s.founder_signed_at IS NULL)
     LIMIT 5`);
  checks.R2_source_founder_signed = { pass: r2.rowCount === 0, count: r2.rowCount ?? 0, sample: r2.rows };

  // R3 · evidence traces back to candidate (via business_name + website_url pair)
  const r3 = await c.query(`
    SELECT e.business_name, e.website_url
      FROM nex.discovery_business_evidence e
      LEFT JOIN nex.harvest_business_candidate cand
        ON lower(cand.business_name) = lower(e.business_name)
       AND (cand.website_url = e.website_url OR (cand.website_url IS NULL AND e.website_url IS NULL))
     WHERE e.discovered_email IS NOT NULL AND cand.candidate_id IS NULL
     LIMIT 5`);
  checks.R3_evidence_traces_to_candidate = { pass: r3.rowCount === 0, count: r3.rowCount ?? 0, sample: r3.rows };

  // R4 · no email set with source_url null (checked in R1 too, this is direct)
  const r4 = await c.query(`
    SELECT COUNT(*)::int AS c
      FROM nex.discovery_business_evidence
     WHERE discovered_email IS NOT NULL AND email_source_url IS NULL`);
  checks.R4_no_fabricated_email = { pass: Number(r4.rows[0].c) === 0, count: Number(r4.rows[0].c) };

  // R5 · no candidate.source_slug missing from harvest_source
  const r5 = await c.query(`
    SELECT DISTINCT c.source_slug
      FROM nex.harvest_business_candidate c
      LEFT JOIN nex.harvest_source s ON s.source_slug = c.source_slug
     WHERE c.source_slug IS NOT NULL AND s.source_slug IS NULL
     LIMIT 5`);
  checks.R5_candidate_source_exists = { pass: r5.rowCount === 0, count: r5.rowCount ?? 0, sample: r5.rows };

  // R6 · walked candidate with emails_discovered_count > 0 must have >= 1 evidence row
  const r6 = await c.query(`
    SELECT c.candidate_id, c.business_name, c.emails_discovered_count
      FROM nex.harvest_business_candidate c
     WHERE c.website_walk_status = 'walked'
       AND c.emails_discovered_count > 0
       AND NOT EXISTS (
         SELECT 1 FROM nex.discovery_business_evidence e
          WHERE lower(e.business_name) = lower(c.business_name)
       )
     LIMIT 5`);
  checks.R6_walked_with_emails_has_evidence = { pass: r6.rowCount === 0, count: r6.rowCount ?? 0, sample: r6.rows };

  // Summary
  const s = await c.query(`
    SELECT
      (SELECT COUNT(*)::int FROM nex.discovery_business_evidence) AS evidence_rows_total,
      (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS evidence_rows_with_email,
      (SELECT COUNT(*)::int FROM nex.harvest_business_candidate) AS candidates_total,
      (SELECT COUNT(*)::int FROM nex.harvest_business_candidate WHERE website_walk_status = 'walked') AS walked_candidates_total,
      (SELECT COUNT(DISTINCT iso_alpha_2)::int FROM nex.discovery_business_evidence) AS countries_with_evidence,
      (SELECT COUNT(DISTINCT discovered_via_source)::int FROM nex.discovery_business_evidence) AS sources_in_evidence`);
  const summary = {
    evidence_rows_total: Number(s.rows[0].evidence_rows_total),
    evidence_rows_with_email: Number(s.rows[0].evidence_rows_with_email),
    candidates_total: Number(s.rows[0].candidates_total),
    walked_candidates_total: Number(s.rows[0].walked_candidates_total),
    countries_with_evidence: Number(s.rows[0].countries_with_evidence),
    sources_in_evidence: Number(s.rows[0].sources_in_evidence),
  };

  const pass = Object.values(checks).every(k => k.pass);
  await logAgentEvent(deps.client, {
    agent_id: deps.agent_id, event_kind: pass ? "audit_pass" : "audit_fail",
    cycle_id: deps.cycle_id ?? null,
    payload: { checks, summary },
  });

  return { pass, checks, summary };
}

export const _EVIDENCE_AUDIT_FAILS_SOFT_ORBITING_DECIDES =
  "audit_returns_report_never_throws_orbiting_agent_decides_pause_or_continue";
export const _EVIDENCE_AUDIT_NEVER_MUTATES_EVIDENCE =
  "audit_reads_never_writes_to_discovery_business_evidence_or_harvest_business_candidate";
