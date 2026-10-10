// src/lib/nex/discovery-world/cycle-adapter.ts
//
// NEX World Email Intelligence · Part 6 · Cycle adapter wiring
// Founder-authorised programme · session-2 · 2026-09-21.
//
// Composes:
//   walker → extractor → classifier → entity-resolution → business_evidence
//
// PageFetcher is INJECTED. Default fetcher refuses every URL with
// `blocked_by_governance` — allowlist expansion is a Founder decision.

import type { PoolClient } from "pg";
import type { PageFetcher, WalkOutcome } from "./page-fetcher";
import { NULL_FETCHER } from "./page-fetcher";
import { walkEntityWebsite, DEFAULT_WALKER, type WalkerConfig } from "./website-walker";
import { extractEmails, type ExtractedEmail } from "./email-extractor";
import { classifyEmail, type EmailClassification } from "./email-classifier";
import { recordEntityObservation, canonicalWebsite } from "./entity-resolution";
import { recordBusinessEvidence } from "./business-evidence";

export interface EntityCandidate {
  readonly programme_id: string;
  readonly iso: string;
  readonly business_name: string;
  readonly website_url: string;
  readonly discovery_term: string;
  readonly cycle_id?: string;
  readonly directory_source?: string;               // e.g. "osm_overpass"
}

export interface AdaptedResult {
  readonly candidate: EntityCandidate;
  readonly walk: WalkOutcome;
  readonly emails: ReadonlyArray<{ classification: EmailClassification; extracted: ExtractedEmail }>;
  readonly outcome:
    | "no_website"
    | "walker_blocked_by_governance"
    | "walker_no_pages_fetched"
    | "walker_completed_no_emails"
    | "walker_completed_with_emails"
    | "error";
  readonly persisted: {
    readonly entity_id: string | null;
    readonly evidence_ids: ReadonlyArray<string>;
  };
  readonly note: string | null;
}

export interface AdapterConfig {
  readonly fetcher?: PageFetcher;
  readonly walker?: Partial<WalkerConfig>;
  readonly max_emails_per_entity?: number;
}

export async function processEntityCandidate(
  client: PoolClient,
  candidate: EntityCandidate,
  config: AdapterConfig = {},
): Promise<AdaptedResult> {
  const fetcher = config.fetcher ?? NULL_FETCHER;
  const domain = canonicalWebsite(candidate.website_url);
  if (!domain) {
    return {
      candidate, walk: emptyWalk(""), emails: [], outcome: "no_website",
      persisted: { entity_id: null, evidence_ids: [] },
      note: "candidate has no canonical website · cannot walk",
    };
  }

  const walk = await walkEntityWebsite({
    canonical_website: domain,
    fetcher,
    config: config.walker,
  });

  if (walk.pages_fetched === 0) {
    // Persist candidate entity even without walk results, so cross-cycle
    // evidence can still accumulate deterministically.
    const entity_obs = await recordEntityObservation(client, {
      programme_id: candidate.programme_id, iso: candidate.iso,
      business_name: candidate.business_name, website_url: candidate.website_url,
      discovery_term: candidate.discovery_term,
      source_url: candidate.directory_source ? `directory:${candidate.directory_source}` : `unknown-source:${domain}`,
      source_kind: candidate.directory_source ?? "directory",
      cycle_id: candidate.cycle_id,
    });
    const outcome = walk.pages_blocked_by_governance === walk.pages_attempted
      ? "walker_blocked_by_governance"
      : "walker_no_pages_fetched";
    return { candidate, walk, emails: [], outcome, persisted: { entity_id: entity_obs.entity.entity_id, evidence_ids: [] }, note: walk.note };
  }

  // ─── Extract + classify emails across every fetched page ──────
  const maxEmails = config.max_emails_per_entity ?? 12;
  const perEntity: Array<{ classification: EmailClassification; extracted: ExtractedEmail; sourceUrl: string; isContactPage: boolean }> = [];
  for (const page of walk.pages) {
    const isContactPage = /\/contact/i.test(page.url) || /\/get-in-touch/i.test(page.url);
    const extracted = extractEmails(page.html, { max_emails: maxEmails });
    for (const e of extracted) {
      // Classify each email · provider-agnostic
      const classification = classifyEmail({
        email: e.normalized,
        source_kind: isContactPage ? "entity_website_contact_page" : "entity_website_other_page",
        on_entity_domain: true,
        email_matches_entity_domain: e.normalized.split("@")[1] === domain,
      });
      if (!classification.valid) continue;
      perEntity.push({ classification, extracted: e, sourceUrl: page.url_final, isContactPage });
      if (perEntity.length >= maxEmails) break;
    }
    if (perEntity.length >= maxEmails) break;
  }

  // ─── Persist entity observation ─────────────────────────────
  const entity_obs = await recordEntityObservation(client, {
    programme_id: candidate.programme_id,
    iso: candidate.iso,
    business_name: candidate.business_name,
    website_url: candidate.website_url,
    discovery_term: candidate.discovery_term,
    source_url: `https://${domain}`,
    source_kind: "website",
    cycle_id: candidate.cycle_id,
  });

  // ─── Persist single business_evidence row (highest-conf email as anchor) ──
  //
  // Existing single-row-per-business schema is preserved for backwards
  // compatibility. The highest-confidence email becomes the "primary" email
  // on the evidence row · every extracted email is ALSO written to
  // nex.business_email (multi-email persistence, added 2026-09-22).
  const evidence_ids: string[] = [];
  const persisted_emails: Array<{ email: string; method: string; confidence: number; source_url: string }> = [];
  let anchorEvidenceId: string | null = null;
  if (perEntity.length > 0) {
    // Pick highest-confidence email as the anchor for the discovery_business_evidence row
    const anchor = perEntity.reduce((best, cur) =>
      emailConfidence(cur.extracted.method, cur.classification) > emailConfidence(best.extracted.method, best.classification) ? cur : best);
    const rec = await recordBusinessEvidence(client, {
      programme_id: candidate.programme_id,
      iso: candidate.iso,
      cycle_id: candidate.cycle_id ?? null,
      business_name: candidate.business_name,
      website_url: candidate.website_url,
      contact_page_url: anchor.isContactPage ? anchor.sourceUrl : null,
      services: entity_obs.entity.services,
      category: entity_obs.entity.category,
      discovered_via_term: candidate.discovery_term,
      discovered_via_source: candidate.directory_source ?? "website",
      discovered_via_evidence_url: anchor.sourceUrl,
      discovered_email: anchor.classification.normalized_email,
      email_source_url: anchor.sourceUrl,
      email_extraction_confidence: emailConfidence(anchor.extracted.method, anchor.classification),
      metadata: {
        email_type: anchor.classification.email_type,
        email_evidence_tier: anchor.classification.email_evidence_tier,
        email_provider_domain: anchor.classification.email_provider_domain,
        extraction_method: anchor.extracted.method,
        role_hint: anchor.extracted.nearby_role_hint,
        multi_email_count: perEntity.length,
      },
    });
    evidence_ids.push(rec.evidence.evidence_id);
    anchorEvidenceId = rec.evidence.evidence_id;
  }

  // ─── Persist EVERY extracted email to nex.business_email (multi-email) ─
  // Tolerant when schema not applied yet · returns silently on missing table.
  if (anchorEvidenceId && perEntity.length > 0) {
    for (const item of perEntity) {
      try {
        const conf = emailConfidence(item.extracted.method, item.classification);
        const emailDomain = item.classification.normalized_email.split("@")[1] ?? "";
        const sameApex = emailDomain === domain;
        await client.query(
          `INSERT INTO nex.business_email
             (evidence_id, email_address, email_source_url, extraction_method,
              email_type, email_evidence_tier, email_provider_domain, role_hint,
              extraction_confidence, same_apex_as_business, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (evidence_id, LOWER(email_address)) DO UPDATE SET
             last_seen_at = now(),
             extraction_confidence = GREATEST(nex.business_email.extraction_confidence, EXCLUDED.extraction_confidence),
             extraction_method = CASE
               WHEN EXCLUDED.extraction_confidence > nex.business_email.extraction_confidence THEN EXCLUDED.extraction_method
               ELSE nex.business_email.extraction_method
             END`,
          [anchorEvidenceId, item.classification.normalized_email, item.sourceUrl, item.extracted.method,
           item.classification.email_type, item.classification.email_evidence_tier,
           item.classification.email_provider_domain, item.extracted.nearby_role_hint,
           conf, sameApex, JSON.stringify({})],
        );
        persisted_emails.push({
          email: item.classification.normalized_email,
          method: item.extracted.method,
          confidence: conf,
          source_url: item.sourceUrl,
        });
      } catch (e) {
        // Schema not applied yet · surface once in note but keep going
        if (!/does not exist/i.test((e as Error).message)) throw e;
      }
    }
  }

  return {
    candidate,
    walk,
    emails: perEntity.map(x => ({ classification: x.classification, extracted: x.extracted })),
    outcome: evidence_ids.length > 0 ? "walker_completed_with_emails" : "walker_completed_no_emails",
    persisted: { entity_id: entity_obs.entity.entity_id, evidence_ids },
    note: persisted_emails.length > 0
      ? `${persisted_emails.length} email(s) persisted to business_email`
      : null,
  };
}

function emailConfidence(method: ExtractedEmail["method"], c: EmailClassification): number {
  // Higher structured evidence → higher confidence · caps at 0.95 without independent corroboration
  const base = method === "json_ld_contact_point" ? 0.85
             : method === "schema_microdata_email" ? 0.80
             : method === "mailto_href" ? 0.75
             : method === "html_entity_at" ? 0.65
             : method === "obfuscated_at" ? 0.55
             : 0.45;
  const tier_bonus = c.email_evidence_tier === "directly_published_by_entity" ? 0.10 : 0.0;
  return Math.min(0.95, base + tier_bonus);
}

function emptyWalk(domain: string): WalkOutcome {
  return {
    entity_domain: domain, pages: [], pages_attempted: 0, pages_fetched: 0,
    pages_blocked_by_governance: 0, pages_robots_denied: 0, pages_not_found: 0, pages_unavailable: 0,
    deadline_expired: false, total_bytes: 0, total_ms: 0, note: null,
  };
}

export const _CYCLE_ADAPTER_NULL_FETCHER_DEFAULT = "default_refuses_every_url_no_silent_allowlist_expansion";
