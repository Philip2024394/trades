// src/lib/nex/marketing/deliverability/dns-domain-auth-checker.ts
//
// NEX Deliverability · DNS-based DomainAuthChecker adapter
// Founder-authorised programme · Session-10 · Part 12 (gate #3 preparation) · 2026-09-21.
//
// PURE ADAPTER · not registered as module default. NULL_DOMAIN_CHECKER remains
// the module's exported default. This adapter is instantiated explicitly by the
// Founder when gate #3 (NEX_DOMAIN_AUTH_CHECKER_ACTIVATION=on) is turned on.
//
// GOVERNANCE HARD-LOCKS:
//   * Fails closed on any DNS error · never fabricates a `pass`
//   * Never mutates state · pure read-only DNS resolution
//   * Never falls back to a different resolver silently
//   * DNS resolver is INJECTABLE for testing (default = node:dns/promises)
//   * Timeout-safe · per-lookup budget (default 3s · configurable)
//   * ONLY queries the three canonical namespaces:
//       - <domain>                        (SPF · TXT)
//       - <selector>._domainkey.<domain>  (DKIM · TXT)
//       - _dmarc.<domain>                 (DMARC · TXT)

import type { DomainAuthChecker, DomainAuthCheckResult } from "./domain-auth";
import type { SpfStatus, DkimStatus, DmarcStatus } from "./types";

export interface DnsResolver {
  resolveTxt(hostname: string): Promise<string[][]>;
}

export interface DnsCheckerOptions {
  readonly resolver?: DnsResolver;
  readonly per_lookup_timeout_ms?: number;
  readonly dkim_selectors_to_try?: readonly string[];
  readonly source_id?: string;
}

/** Common DKIM selectors used by major providers · we probe in order and
 *  return the first `pass` (or the last observed state if none pass). */
export const COMMON_DKIM_SELECTORS: readonly string[] = [
  "default", "google", "selector1", "selector2", "s1", "s2",
  "resend", "sendgrid", "mailgun", "postmark", "amazonses", "k1", "smtpapi",
];

// ─── DNS resolver factory (default: node:dns/promises) ─────────────
export async function createNodeDnsResolver(): Promise<DnsResolver> {
  const dns = await import("node:dns/promises");
  return {
    async resolveTxt(hostname: string): Promise<string[][]> {
      return await dns.resolveTxt(hostname);
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────
function joinTxt(parts: string[]): string {
  // TXT records may be split into ≤255-char strings · joined without separator
  return parts.join("");
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`dns_timeout: ${label}`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ─── SPF classifier ─────────────────────────────────────────────────
/** Given raw TXT records, find the SPF record and classify.
 *  RFC 7208 · SPF record starts with `v=spf1` and ends with a qualifier ·
 *  we classify the closing "all" qualifier: -all=hard_fail · ~all=soft_fail ·
 *  +all=pass · ?all=neutral. Multiple SPF records → permerror (RFC 7208 §3.2). */
export function classifySpf(txts: readonly string[]): { status: SpfStatus; record: string | null } {
  const spf = txts.filter(t => /^v=spf1\b/i.test(t.trim()));
  if (spf.length === 0) return { status: "missing", record: null };
  if (spf.length > 1) return { status: "permerror", record: spf[0] ?? null };
  const rec = spf[0]!.trim();
  // Look for the terminal "all" mechanism
  const m = rec.match(/(?:^|\s)([-~+?])all\s*$/);
  if (!m) return { status: "pass", record: rec };
  switch (m[1]) {
    case "-": return { status: "hard_fail", record: rec };
    case "~": return { status: "soft_fail", record: rec };
    case "+": return { status: "pass", record: rec };
    case "?": return { status: "pass", record: rec }; // neutral · treated as pass here
    default:  return { status: "pass", record: rec };
  }
}

// ─── DKIM classifier ────────────────────────────────────────────────
/** DKIM TXT records look like `v=DKIM1; k=rsa; p=<base64>`. Missing p= or
 *  revoked (p=) means the key is missing/revoked → fail. */
export function classifyDkim(txts: readonly string[]): { status: DkimStatus; selector: string | null } {
  const dk = txts.filter(t => /^v=DKIM1\b/i.test(t.trim()));
  if (dk.length === 0) return { status: "no_signature", selector: null };
  const rec = dk[0]!.trim();
  // Revoked key = has "p=" with empty value
  if (/[;\s]p=(?:\s|;|$)/i.test(rec)) return { status: "fail", selector: null };
  if (!/[;\s]p=[A-Za-z0-9+/=]/i.test(rec)) return { status: "missing", selector: null };
  return { status: "pass", selector: null };
}

// ─── DMARC classifier ───────────────────────────────────────────────
/** DMARC TXT is `v=DMARC1; p=none|quarantine|reject; …; pct=<n>`. */
export function classifyDmarc(txts: readonly string[]): { status: DmarcStatus; policy: string | null; pct: number | null } {
  const dmarc = txts.filter(t => /^v=DMARC1\b/i.test(t.trim()));
  if (dmarc.length === 0) return { status: "missing", policy: null, pct: null };
  if (dmarc.length > 1) return { status: "fail", policy: null, pct: null };
  const rec = dmarc[0]!.trim();
  const p = rec.match(/[;\s]p=(none|quarantine|reject)\b/i);
  const pct_m = rec.match(/[;\s]pct=(\d{1,3})\b/i);
  const pct = pct_m ? Math.min(100, Math.max(0, Number(pct_m[1]))) : 100;
  if (!p) return { status: "fail", policy: null, pct: null };
  const policy = p[1]!.toLowerCase();
  switch (policy) {
    case "reject":     return { status: "reject_policy", policy, pct };
    case "quarantine": return { status: "quarantine_policy", policy, pct };
    case "none":       return { status: "none_policy", policy, pct };
    default:           return { status: "pass", policy, pct };
  }
}

// ─── DnsDomainAuthChecker ───────────────────────────────────────────
export class DnsDomainAuthChecker implements DomainAuthChecker {
  readonly source_id: string;
  private readonly resolver_promise: Promise<DnsResolver>;
  private readonly timeout_ms: number;
  private readonly selectors: readonly string[];

  constructor(opts: DnsCheckerOptions = {}) {
    this.source_id = opts.source_id ?? "node-dns-txt";
    this.resolver_promise = opts.resolver ? Promise.resolve(opts.resolver) : createNodeDnsResolver();
    this.timeout_ms = opts.per_lookup_timeout_ms ?? 3000;
    this.selectors = opts.dkim_selectors_to_try ?? COMMON_DKIM_SELECTORS;
  }

  async checkDomain(domain_in: string): Promise<DomainAuthCheckResult> {
    const domain = String(domain_in).trim().toLowerCase();
    const started = new Date().toISOString();
    const resolver = await this.resolver_promise;

    // ─── SPF ────────────────────────────────────────────────────
    let spf_status: SpfStatus = "unknown";
    let spf_record: string | null = null;
    let spf_err: string | null = null;
    try {
      const raw = await withTimeout(resolver.resolveTxt(domain), this.timeout_ms, `SPF:${domain}`);
      const joined = raw.map(joinTxt);
      const c = classifySpf(joined);
      spf_status = c.status; spf_record = c.record;
    } catch (e) {
      const msg = (e as Error).message;
      spf_status = /ENOTFOUND|NXDOMAIN/i.test(msg) ? "missing" : "unknown";
      spf_err = msg;
    }

    // ─── DKIM · probe selectors in order ────────────────────────
    let dkim_status: DkimStatus = "no_signature";
    let dkim_selector: string | null = null;
    let dkim_err: string | null = null;
    for (const sel of this.selectors) {
      try {
        const raw = await withTimeout(resolver.resolveTxt(`${sel}._domainkey.${domain}`), this.timeout_ms, `DKIM:${sel}:${domain}`);
        const joined = raw.map(joinTxt);
        const c = classifyDkim(joined);
        if (c.status === "pass") {
          dkim_status = "pass"; dkim_selector = sel;
          break;
        }
        // Retain the strictest observed state (fail beats missing beats no_signature)
        if (c.status === "fail" && dkim_status !== "pass") { dkim_status = "fail"; dkim_selector = sel; }
        else if (c.status === "missing" && dkim_status === "no_signature") { dkim_status = "missing"; dkim_selector = sel; }
      } catch (e) {
        const msg = (e as Error).message;
        if (!/ENOTFOUND|NXDOMAIN/i.test(msg)) {
          dkim_err = msg;
          if (dkim_status === "no_signature") dkim_status = "unknown";
        }
      }
    }

    // ─── DMARC ─────────────────────────────────────────────────
    let dmarc_status: DmarcStatus = "unknown";
    let dmarc_policy: string | null = null;
    let dmarc_pct: number | null = null;
    let dmarc_err: string | null = null;
    try {
      const raw = await withTimeout(resolver.resolveTxt(`_dmarc.${domain}`), this.timeout_ms, `DMARC:${domain}`);
      const joined = raw.map(joinTxt);
      const c = classifyDmarc(joined);
      dmarc_status = c.status; dmarc_policy = c.policy; dmarc_pct = c.pct;
    } catch (e) {
      const msg = (e as Error).message;
      dmarc_status = /ENOTFOUND|NXDOMAIN/i.test(msg) ? "missing" : "unknown";
      dmarc_err = msg;
    }

    const errors = [spf_err, dkim_err, dmarc_err].filter(Boolean).join(" | ") || null;
    return {
      sending_domain: domain,
      spf_status, spf_record,
      dkim_status, dkim_selector,
      dmarc_status, dmarc_policy, dmarc_pct,
      check_source: this.source_id,
      check_method: "node:dns/promises_resolveTxt",
      checked_at: started,
      error: errors,
    };
  }
}

// ─── Structural boundary markers ────────────────────────────────────
export const _DNS_CHECKER_IS_NOT_MODULE_DEFAULT =
  "NULL_DOMAIN_CHECKER_remains_the_module_default_founder_opts_in_explicitly";
export const _DNS_CHECKER_FAILS_CLOSED_ON_ERROR =
  "dns_error_returns_unknown_never_fabricates_pass";
export const _DNS_CHECKER_ONLY_QUERIES_THREE_NAMESPACES =
  "domain_for_SPF_and_selector_domainkey_for_DKIM_and_underscore_dmarc_for_DMARC_only";
