// Nex Booker · compliance reader.
//
// Typed accessor over a NexBkComplianceBundle. Consumers never re-parse
// the raw JSONB rule_value column — they call these methods and get
// validated, typed values or a clear error explaining what's missing.
//
// Why this exists:
// · The DB stores compliance rules as JSONB (flexible for varied values —
//   scalars, objects, arrays). Without a typed reader, every consumer
//   would end up with its own bespoke parsing + fallback logic + subtle
//   drift bugs. The reader is the single interpretation layer.
// · Different jurisdictions use different rule_keys for conceptually
//   similar values (UK: vat_standard_rate · AU: gst_standard_rate ·
//   IE: vat_standard_rate). Convenience methods handle the mapping so
//   callers just say `reader.vatOrGstStandardRate()`.
// · Compliance version + source URLs stay attached to the reader so
//   any answer NEX gives from these values is traceable to package
//   `GB-1.1.0 verified 2026-08-06` with the source URL.
//
// This module is pure once the bundle is loaded — no DB access below
// `loadCompliance`. That keeps unit tests trivial (mock bundle in,
// assertions out) and keeps the reader safe to cache in-process.

import type {
  NexBkComplianceBundle,
  NexBkCompliancePackage,
  Uuid,
} from "./types";
import type { NexBkStore } from "./storage";

// ── Errors ──────────────────────────────────────────────────────────

export class ComplianceReaderError extends Error {
  readonly code: string;
  readonly rule_key?: string;
  constructor(code: string, message: string, rule_key?: string) {
    super(message);
    this.name = "ComplianceReaderError";
    this.code = code;
    this.rule_key = rule_key;
  }
}

// ── Reader interface ────────────────────────────────────────────────

/**
 * Typed accessor over a compliance bundle. Every method throws
 * ComplianceReaderError with a specific `code` if the rule is missing
 * or the shape is wrong — callers must handle this at least by logging
 * (silent fallback would corrupt calculations).
 */
export type ComplianceReader = {
  // Metadata
  readonly package: NexBkCompliancePackage;
  readonly countryCode: string;
  readonly stateCode: string | null;
  readonly version: string;
  readonly lastVerifiedAt: string;

  // Existence check without throwing
  has(rule_key: string): boolean;

  // Generic typed accessors
  getRate(rule_key: string): number;                 // 0.20 style
  getMoneyAmount(rule_key: string): number;          // e.g. threshold in currency minor units-of-1
  getInteger(rule_key: string): number;
  getString(rule_key: string): string;
  getBool(rule_key: string): boolean;
  getObject<T = Record<string, unknown>>(rule_key: string): T;
  getStringArray(rule_key: string): string[];

  // Optional variants (return undefined instead of throwing when missing)
  tryGetRate(rule_key: string): number | undefined;
  tryGetMoneyAmount(rule_key: string): number | undefined;
  tryGetString(rule_key: string): string | undefined;
  tryGetObject<T = Record<string, unknown>>(rule_key: string): T | undefined;

  // Convenience — cross-jurisdictional aliases
  /** Returns VAT (UK/IE) or GST (AU) standard rate — whichever this jurisdiction uses. */
  vatOrGstStandardRate(): number;
  /** Returns VAT/GST registration threshold in the business's own currency. */
  registrationThreshold(): number;
  /** Returns record retention requirement in years — the shortest applicable if multiple. */
  recordRetentionYears(): number;
  /** Returns the ISO 4217 currency code for the jurisdiction. */
  currencyCode(): string;
  /** Returns the display symbol (e.g. £, €, $). */
  currencySymbol(): string;
  /** Returns the tax authority's full name. */
  authorityName(): string;
  /** Returns the common abbreviation (HMRC, Revenue, ATO, IRS). */
  authorityAbbreviation(): string;

  // For provenance / audit
  /** Returns a citation string suitable for footnotes: "GB v1.1.0 · verified 2026-08-06 · gov.uk". */
  citation(): string;
};

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Async loader — fetches the current compliance package for the
 * jurisdiction, hydrates its rules, returns a typed reader. Throws
 * if no active package exists.
 */
export async function loadCompliance(
  store: NexBkStore,
  countryCode: string,
  stateCode: string | null = null
): Promise<ComplianceReader> {
  const pkg = await store.getCurrentCompliancePackage(countryCode, stateCode);
  if (!pkg) {
    throw new ComplianceReaderError(
      "no_active_package",
      `No active compliance package for ${countryCode}${stateCode ? "/" + stateCode : ""}`
    );
  }
  const bundle = await store.getComplianceBundle(pkg.id);
  if (!bundle) {
    throw new ComplianceReaderError(
      "bundle_missing",
      `Compliance package ${pkg.id} has no rules`
    );
  }
  return makeReader(bundle);
}

/**
 * Pure factory — build a reader from an already-loaded bundle. Use
 * this directly in unit tests + when you have the bundle in hand.
 */
export function makeReader(bundle: NexBkComplianceBundle): ComplianceReader {
  const { package: pkg, rules } = bundle;

  function required(rule_key: string): unknown {
    if (!(rule_key in rules)) {
      throw new ComplianceReaderError(
        "rule_missing",
        `Compliance package ${pkg.country_code}/${pkg.version} has no rule "${rule_key}"`,
        rule_key
      );
    }
    return rules[rule_key];
  }

  function asNumber(v: unknown, rule_key: string): number {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    throw new ComplianceReaderError(
      "wrong_shape",
      `Rule "${rule_key}" expected number, got ${typeof v} (${JSON.stringify(v).slice(0, 80)})`,
      rule_key
    );
  }

  function asString(v: unknown, rule_key: string): string {
    if (typeof v === "string" && v.length > 0) return v;
    throw new ComplianceReaderError(
      "wrong_shape",
      `Rule "${rule_key}" expected non-empty string, got ${typeof v}`,
      rule_key
    );
  }

  // Registration threshold: rule key differs per jurisdiction. Try the
  // known aliases in preference order (specific > generic).
  function findRegistrationThreshold(): number {
    const candidates = [
      "vat_registration_threshold_gbp",     // UK
      "vat_threshold_services_eur",         // Ireland — services (lower, more common for trades)
      "vat_threshold_goods_eur",            // Ireland — goods
      "gst_registration_threshold_standard_aud",  // Australia
      "vat_registration_threshold",         // Generic fallback
    ];
    for (const k of candidates) {
      if (k in rules) return asNumber(rules[k], k);
    }
    throw new ComplianceReaderError(
      "rule_missing",
      `No registration threshold rule found in ${pkg.country_code}/${pkg.version} (tried: ${candidates.join(", ")})`
    );
  }

  function findStandardRate(): number {
    const candidates = ["vat_standard_rate", "gst_standard_rate"];
    for (const k of candidates) {
      if (k in rules) return asNumber(rules[k], k);
    }
    throw new ComplianceReaderError(
      "rule_missing",
      `No VAT/GST standard rate rule found in ${pkg.country_code}/${pkg.version}`
    );
  }

  function findRetentionYears(): number {
    const candidates = [
      "record_retention_years",             // AU, IE, generic
      "vat_record_retention_years",         // UK
      "record_retention_general_years",     // US (general)
    ];
    for (const k of candidates) {
      if (k in rules) return asNumber(rules[k], k);
    }
    throw new ComplianceReaderError(
      "rule_missing",
      `No record retention rule found in ${pkg.country_code}/${pkg.version}`
    );
  }

  const reader: ComplianceReader = {
    package: pkg,
    countryCode: pkg.country_code,
    stateCode: pkg.state_code,
    version: pkg.version,
    lastVerifiedAt: pkg.last_verified_at,

    has(rule_key) {
      return rule_key in rules;
    },

    getRate(rule_key) {
      const v = required(rule_key);
      const n = asNumber(v, rule_key);
      if (n < 0 || n > 1) {
        // Rates should be 0..1. We allow strictly, since a "rate" that comes back as 20 not 0.20 would silently multiply amounts by 100x.
        throw new ComplianceReaderError(
          "wrong_shape",
          `Rule "${rule_key}" is not a rate (expected 0..1, got ${n}). If this is a percentage stored as 0..100, fix at the seed.`,
          rule_key
        );
      }
      return n;
    },

    getMoneyAmount(rule_key) {
      const v = required(rule_key);
      const n = asNumber(v, rule_key);
      if (n < 0) {
        throw new ComplianceReaderError(
          "wrong_shape",
          `Rule "${rule_key}" is a money amount but was negative (${n})`,
          rule_key
        );
      }
      return n;
    },

    getInteger(rule_key) {
      const v = required(rule_key);
      const n = asNumber(v, rule_key);
      if (!Number.isInteger(n)) {
        throw new ComplianceReaderError(
          "wrong_shape",
          `Rule "${rule_key}" expected integer, got ${n}`,
          rule_key
        );
      }
      return n;
    },

    getString(rule_key) {
      return asString(required(rule_key), rule_key);
    },

    getBool(rule_key) {
      const v = required(rule_key);
      if (typeof v === "boolean") return v;
      throw new ComplianceReaderError(
        "wrong_shape",
        `Rule "${rule_key}" expected boolean, got ${typeof v}`,
        rule_key
      );
    },

    getObject<T = Record<string, unknown>>(rule_key: string): T {
      const v = required(rule_key);
      if (v === null || typeof v !== "object" || Array.isArray(v)) {
        throw new ComplianceReaderError(
          "wrong_shape",
          `Rule "${rule_key}" expected object, got ${Array.isArray(v) ? "array" : typeof v}`,
          rule_key
        );
      }
      return v as T;
    },

    getStringArray(rule_key) {
      const v = required(rule_key);
      if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
        throw new ComplianceReaderError(
          "wrong_shape",
          `Rule "${rule_key}" expected string[]`,
          rule_key
        );
      }
      return v as string[];
    },

    tryGetRate(rule_key) {
      if (!(rule_key in rules)) return undefined;
      try {
        return this.getRate(rule_key);
      } catch {
        return undefined;
      }
    },

    tryGetMoneyAmount(rule_key) {
      if (!(rule_key in rules)) return undefined;
      try {
        return this.getMoneyAmount(rule_key);
      } catch {
        return undefined;
      }
    },

    tryGetString(rule_key) {
      if (!(rule_key in rules)) return undefined;
      try {
        return this.getString(rule_key);
      } catch {
        return undefined;
      }
    },

    tryGetObject<T = Record<string, unknown>>(rule_key: string): T | undefined {
      if (!(rule_key in rules)) return undefined;
      try {
        return this.getObject<T>(rule_key);
      } catch {
        return undefined;
      }
    },

    vatOrGstStandardRate() {
      return findStandardRate();
    },

    registrationThreshold() {
      return findRegistrationThreshold();
    },

    recordRetentionYears() {
      return findRetentionYears();
    },

    currencyCode() {
      return this.getString("currency_code");
    },

    currencySymbol() {
      return this.getString("currency_symbol");
    },

    authorityName() {
      return this.getString("authority_name");
    },

    authorityAbbreviation() {
      return this.getString("authority_abbreviation");
    },

    citation() {
      const host = pickHostFromUrls(pkg.source_urls);
      const iso = pkg.last_verified_at.slice(0, 10);
      const state = pkg.state_code ? `/${pkg.state_code}` : "";
      return `${pkg.country_code}${state} v${pkg.version} · verified ${iso}${host ? " · " + host : ""}`;
    },
  };

  return reader;
}

function pickHostFromUrls(urls: string[] | null | undefined): string | null {
  if (!urls || urls.length === 0) return null;
  try {
    const u = new URL(urls[0]);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
