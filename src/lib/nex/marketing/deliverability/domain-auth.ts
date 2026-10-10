// src/lib/nex/marketing/deliverability/domain-auth.ts
//
// NEX Deliverability · Domain auth state (SPF · DKIM · DMARC)
// Founder-authorised programme · Session-5 · Part 12 · 2026-09-21.
//
// **Reader + upsert only.** Actual DNS lookups happen through an injected
// DomainAuthChecker adapter. Default checker is null-safe · returns
// `unknown` for every domain until a Founder-configured checker is wired
// (same M26-style discipline as PageFetcher).

import type { PoolClient } from "pg";
import type { DomainAuth, SpfStatus, DkimStatus, DmarcStatus } from "./types";

export interface DomainAuthCheckResult {
  readonly sending_domain: string;
  readonly spf_status: SpfStatus;
  readonly spf_record: string | null;
  readonly dkim_status: DkimStatus;
  readonly dkim_selector: string | null;
  readonly dmarc_status: DmarcStatus;
  readonly dmarc_policy: string | null;
  readonly dmarc_pct: number | null;
  readonly check_source: string;
  readonly check_method: string;
  readonly checked_at: string;
  readonly error: string | null;
}

export interface DomainAuthChecker {
  readonly source_id: string;
  checkDomain(domain: string): Promise<DomainAuthCheckResult>;
}

/** Default checker · returns `unknown` for every dimension. Never
 *  fabricates a pass · never invents a record. Founder must inject a
 *  real DNS/provider adapter to change these values. */
export const NULL_DOMAIN_CHECKER: DomainAuthChecker = {
  source_id: "null-domain-checker",
  async checkDomain(domain: string): Promise<DomainAuthCheckResult> {
    return {
      sending_domain: domain.toLowerCase(),
      spf_status: "unknown",  spf_record: null,
      dkim_status: "unknown", dkim_selector: null,
      dmarc_status: "unknown", dmarc_policy: null, dmarc_pct: null,
      check_source: "null-domain-checker",
      check_method: "no-op",
      checked_at: new Date().toISOString(),
      error: "no production DomainAuthChecker configured · Founder decision",
    };
  },
};

// ─── Alignment computation (pure · deterministic) ─────────────────
export function computeAligned(spf: SpfStatus, dkim: DkimStatus, dmarc: DmarcStatus): boolean {
  return spf === "pass" && dkim === "pass" && dmarc === "pass";
}

// ─── Load current record for a domain ─────────────────────────────
export async function loadDomainAuth(client: PoolClient, sending_domain: string): Promise<DomainAuth | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_sender_domain_auth WHERE sending_domain = $1`,
    [sending_domain.toLowerCase()],
  );
  if (res.rows.length === 0) return null;
  return rowToAuth(res.rows[0]);
}

export async function loadAllDomainAuth(client: PoolClient): Promise<ReadonlyArray<DomainAuth>> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_sender_domain_auth ORDER BY updated_at DESC`,
  );
  return res.rows.map(rowToAuth);
}

// ─── Persist a check result ────────────────────────────────────────
export async function recordDomainAuthCheck(
  client: PoolClient,
  r: DomainAuthCheckResult,
): Promise<DomainAuth> {
  const aligned = computeAligned(r.spf_status, r.dkim_status, r.dmarc_status);
  const res = await client.query(
    `INSERT INTO nex.marketing_sender_domain_auth
        (sending_domain, spf_status, spf_record, dkim_status, dkim_selector,
         dmarc_status, dmarc_policy, dmarc_pct, aligned,
         check_source, check_method, last_verified_at, last_check_error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12)
     ON CONFLICT (sending_domain) DO UPDATE SET
        spf_status = EXCLUDED.spf_status,
        spf_record = COALESCE(EXCLUDED.spf_record, nex.marketing_sender_domain_auth.spf_record),
        dkim_status = EXCLUDED.dkim_status,
        dkim_selector = COALESCE(EXCLUDED.dkim_selector, nex.marketing_sender_domain_auth.dkim_selector),
        dmarc_status = EXCLUDED.dmarc_status,
        dmarc_policy = COALESCE(EXCLUDED.dmarc_policy, nex.marketing_sender_domain_auth.dmarc_policy),
        dmarc_pct = COALESCE(EXCLUDED.dmarc_pct, nex.marketing_sender_domain_auth.dmarc_pct),
        aligned = EXCLUDED.aligned,
        check_source = EXCLUDED.check_source,
        check_method = EXCLUDED.check_method,
        last_verified_at = now(),
        last_check_error = EXCLUDED.last_check_error,
        updated_at = now()
     RETURNING *`,
    [
      r.sending_domain.toLowerCase(),
      r.spf_status, r.spf_record,
      r.dkim_status, r.dkim_selector,
      r.dmarc_status, r.dmarc_policy, r.dmarc_pct,
      aligned,
      r.check_source, r.check_method,
      r.error,
    ],
  );
  return rowToAuth(res.rows[0]);
}

/** Refresh a domain's auth state using the injected checker. */
export async function refreshDomainAuth(
  client: PoolClient,
  input: { sending_domain: string; checker?: DomainAuthChecker },
): Promise<DomainAuth> {
  const checker = input.checker ?? NULL_DOMAIN_CHECKER;
  const result = await checker.checkDomain(input.sending_domain);
  return recordDomainAuthCheck(client, result);
}

function rowToAuth(r: any): DomainAuth {
  return {
    sending_domain: r.sending_domain,
    spf_status: r.spf_status as SpfStatus,
    spf_record: r.spf_record,
    dkim_status: r.dkim_status as DkimStatus,
    dkim_selector: r.dkim_selector,
    dmarc_status: r.dmarc_status as DmarcStatus,
    dmarc_policy: r.dmarc_policy,
    dmarc_pct: r.dmarc_pct,
    aligned: r.aligned,
    check_source: r.check_source,
    check_method: r.check_method,
    last_verified_at: r.last_verified_at,
    last_check_error: r.last_check_error,
    first_observed_at: r.first_observed_at,
    updated_at: r.updated_at,
    metadata: r.metadata ?? {},
  };
}
