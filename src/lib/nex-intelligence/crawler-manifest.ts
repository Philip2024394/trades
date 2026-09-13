// WO-INTELLIGENCE-01 · signed crawler manifest.
//
// Every crawler manifest is signed by the WO-13 attestation trust root.
// An unsigned or badly-signed manifest is rejected on load; no crawler
// action is permitted without a valid manifest.
//
// The manifest declares — per source — allowed hosts, paths, methods,
// rate limits, categories, and query predicates. Any fetch violating
// its matching entry is refused BEFORE any network I/O.

import { createPrivateKey, sign as ed25519Sign } from "node:crypto";
import { verifyAttestationSignature } from "@/lib/nex1-orchestrator/wo13-attestation";
import { canonicalJson } from "./provenance";
import type { CrawlerManifest, CrawlerManifestEntry } from "./types";

/**
 * Canonical bytes over which the manifest attestation signature is
 * computed. Same input = same signature bytes. Must match exactly
 * between signFor* and verify functions.
 */
export function canonicalizeCrawlerEntries(entries: readonly CrawlerManifestEntry[]): Buffer {
  // Order entries by manifest_entry_id, then serialise deterministically.
  const sorted = [...entries].sort((a, b) => a.manifest_entry_id.localeCompare(b.manifest_entry_id));
  return Buffer.from(canonicalJson(sorted), "utf8");
}

/**
 * Verify the manifest signature. `trustedKeys` defaults to the compiled-in
 * WO-13 attestation trust root; tests supply their own keys.
 */
export function verifyCrawlerManifest(
  manifest: CrawlerManifest,
  trustedKeys?: readonly string[],
): boolean {
  if (manifest.record_type !== "NEX_INTELLIGENCE_CRAWLER_MANIFEST") return false;
  if (manifest.version !== "wo-intel.v0.1") return false;
  if (!Array.isArray(manifest.entries)) return false;
  if (typeof manifest.attestation_signature_hex !== "string") return false;
  const canonical = canonicalizeCrawlerEntries(manifest.entries);
  return verifyAttestationSignature(canonical, manifest.attestation_signature_hex, trustedKeys);
}

/**
 * Sign a crawler manifest. Founder-side use (with the offline attestation
 * private key) and test-side use (with an ephemeral test key).
 */
export function signCrawlerManifest(
  attestationPrivateKeyPkcs8Hex: string,
  entries: readonly CrawlerManifestEntry[],
): CrawlerManifest {
  const privateKey = createPrivateKey({
    key: Buffer.from(attestationPrivateKeyPkcs8Hex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  const canonical = canonicalizeCrawlerEntries(entries);
  const signature = ed25519Sign(null, canonical, privateKey);
  return {
    record_type: "NEX_INTELLIGENCE_CRAWLER_MANIFEST",
    version: "wo-intel.v0.1",
    entries,
    attestation_signature_hex: signature.toString("hex"),
  };
}

// ── Match a request against the manifest ────────────────────────────────

export type ManifestCheckResult =
  | { readonly ok: true; readonly entry: CrawlerManifestEntry }
  | {
      readonly ok: false;
      readonly reason_code:
        | "REFUSED_MANIFEST_INVALID"
        | "REFUSED_UNAUTHORISED_HOST"
        | "REFUSED_UNAUTHORISED_PATH"
        | "REFUSED_UNAUTHORISED_METHOD"
        | "REFUSED_CATEGORY_MISMATCH"
        | "REFUSED_ENTRY_EXPIRED";
      readonly reason: string;
    };

/**
 * Given a fetch request (host, path, method, optional query params), find
 * the matching manifest entry and check every constraint. Returns the
 * entry on success, or a specific refusal reason. No network I/O.
 *
 * `queryPredicates` are the tokens found in the request query string that
 * must all appear in the entry's authorised_query_predicates list. This
 * ensures crawlers cannot silently expand their queryable surface.
 */
export function checkCrawlerRequest(
  manifest: CrawlerManifest,
  request: {
    host: string;
    path: string;
    method: "GET";
    queryPredicates?: readonly string[];
    matchCategories?: readonly string[];
  },
  atTime: Date = new Date(),
): ManifestCheckResult {
  // Attempt to find an entry whose host matches exactly.
  for (const entry of manifest.entries) {
    if (!entry.authorised_hosts.includes(request.host)) continue;

    // Expiry check
    if (Date.parse(entry.expires_at) < atTime.getTime()) {
      return {
        ok: false,
        reason_code: "REFUSED_ENTRY_EXPIRED",
        reason: `manifest entry ${entry.manifest_entry_id} expired at ${entry.expires_at}`,
      };
    }
    // Method
    if (!entry.authorised_methods.includes(request.method)) {
      return {
        ok: false,
        reason_code: "REFUSED_UNAUTHORISED_METHOD",
        reason: `method ${request.method} not authorised for ${entry.manifest_entry_id}`,
      };
    }
    // Path prefix
    const pathOk = entry.authorised_paths.some((p) => request.path === p || request.path.startsWith(p));
    if (!pathOk) {
      return {
        ok: false,
        reason_code: "REFUSED_UNAUTHORISED_PATH",
        reason: `path ${request.path} not authorised for ${entry.manifest_entry_id}`,
      };
    }
    // Query predicates — if provided, every request predicate must be in the allowlist
    if (request.queryPredicates && request.queryPredicates.length > 0) {
      const missing = request.queryPredicates.filter((q) => !entry.authorised_query_predicates.includes(q));
      if (missing.length > 0) {
        return {
          ok: false,
          reason_code: "REFUSED_CATEGORY_MISMATCH",
          reason: `query predicates not authorised: ${missing.join(", ")}`,
        };
      }
    }
    // Categories — if provided, every requested category must be in the allowlist
    if (request.matchCategories && request.matchCategories.length > 0) {
      const missing = request.matchCategories.filter((c) => !entry.authorised_categories.includes(c));
      if (missing.length > 0) {
        return {
          ok: false,
          reason_code: "REFUSED_CATEGORY_MISMATCH",
          reason: `categories not authorised: ${missing.join(", ")}`,
        };
      }
    }
    return { ok: true, entry };
  }
  return {
    ok: false,
    reason_code: "REFUSED_UNAUTHORISED_HOST",
    reason: `host ${request.host} not authorised in any manifest entry`,
  };
}
