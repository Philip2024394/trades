// WO-SOURCE-GUARDIAN-01 · Truth Engine Guardian for source acquisition.
//
// Founder-locked 2026-09-13 · fail-closed protection at the Internet
// input boundary. NO source may enter the production intelligence
// pipeline unless it is explicitly present in the governed Source
// Registry AND the requesting agent is a PRODUCTION_WORKFORCE identity
// (test/fixture/simulation cannot masquerade as production).
//
// Every rejection produces a signed evidence record so the founder can
// audit exactly what the crawler tried to fetch, when, from where, and
// why the request was refused.

import { randomUUID } from "node:crypto";
import { provenanceChainHash } from "./provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { AUTHORISED_SOURCES } from "./source-registry";
import { loadLatestSourceRegistryManifest, loadAllSourceRegistryManifests, verifySourceRegistryManifest } from "./source-registry-manifest";
import type { AgentEnvironment } from "@/lib/nex-agent-runtime/types";

export const SOURCE_GUARDIAN_REJECTIONS_COLLECTION = "nex_source_guardian_rejections";

// ── Rejection codes (founder-locked) ───────────────────────────────────

export type GuardianRejectionCode =
  | "te.evidence_source_unregistered"        // source_id not in registry
  | "te.evidence_source_missing_id"           // request has no source_id
  | "te.evidence_source_url_mismatch"         // URL host doesn't match registered host
  | "te.evidence_source_host_mismatch"        // requested host not authorised for any source
  | "te.evidence_source_test_masquerade"      // TEST/FIXTURE agent requesting production acquisition
  | "te.evidence_source_registry_untrusted";  // registry manifest failed signature verification

// ── Persisted rejection record ─────────────────────────────────────────

export interface GuardianRejection {
  readonly record_type: "NEX_SOURCE_GUARDIAN_REJECTION";
  readonly rejection_id: string;
  readonly rejection_code: GuardianRejectionCode;
  readonly requested_source_id: string | null;
  readonly requested_url: string | null;
  readonly requested_host: string | null;
  readonly requesting_agent_id: string;
  readonly requesting_identity_id: string;
  readonly requesting_environment: AgentEnvironment;
  readonly mission_id: string | null;
  readonly authorization_context: Readonly<Record<string, unknown>>;
  readonly reason: string;
  readonly rejected_at: string;
  readonly provenance_chain_hash: string;
}

async function persistRejection(input: Omit<GuardianRejection, "record_type" | "rejection_id" | "provenance_chain_hash">): Promise<GuardianRejection> {
  const rejection_id = `GRD-REJ-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const base = { record_type: "NEX_SOURCE_GUARDIAN_REJECTION" as const, rejection_id, ...input };
  const record: GuardianRejection = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(SOURCE_GUARDIAN_REJECTIONS_COLLECTION, record);
  return record;
}

// ── Guardian check API ─────────────────────────────────────────────────

export interface GuardianCheckInput {
  readonly source_id: string | null;
  readonly url: string | null;
  readonly requesting_agent_id: string;
  readonly requesting_identity_id: string;
  readonly requesting_environment: AgentEnvironment;
  readonly mission_id: string | null;
  readonly authorization_context: Readonly<Record<string, unknown>>;
  readonly trusted_founder_public_keys_hex: readonly string[];
}

export interface GuardianCheckOk {
  readonly ok: true;
  readonly source_id: string;
  readonly host: string;
  readonly url: string;
}

export interface GuardianCheckDenied {
  readonly ok: false;
  readonly rejection: GuardianRejection;
}

/**
 * Founder-locked · fail-closed check.
 *
 * (1) Registry manifest must exist and verify against a trusted founder key.
 * (2) source_id must be provided.
 * (3) source_id must exist in the manifest's authorised_source_ids AND in AUTHORISED_SOURCES.
 * (4) URL's host must match the registered source's host.
 * (5) Environment must be PRODUCTION_WORKFORCE (or explicitly-approved for test).
 *
 * Every rejection is persisted BEFORE returning. Callers cannot skip
 * evidence recording.
 */
export async function guardianCheck(input: GuardianCheckInput): Promise<GuardianCheckOk | GuardianCheckDenied> {
  // (0) Environment gate · TEST/FIXTURE/SIMULATION cannot request production acquisition
  if (input.requesting_environment !== "PRODUCTION_WORKFORCE") {
    const rejection = await persistRejection({
      rejection_code: "te.evidence_source_test_masquerade",
      requested_source_id: input.source_id,
      requested_url: input.url,
      requested_host: input.url ? safeHost(input.url) : null,
      requesting_agent_id: input.requesting_agent_id,
      requesting_identity_id: input.requesting_identity_id,
      requesting_environment: input.requesting_environment,
      mission_id: input.mission_id,
      authorization_context: input.authorization_context,
      reason: `environment=${input.requesting_environment} · production intelligence pipeline accepts PRODUCTION_WORKFORCE only`,
      rejected_at: new Date().toISOString(),
    });
    return { ok: false, rejection };
  }

  // (1) At least one persisted manifest must verify against a trusted founder key.
  //     Founder-locked: multiple manifests may exist on disk (test isolation, key
  //     rotation) · Guardian accepts if ANY of them verifies with the trusted key.
  const allManifests = await loadAllSourceRegistryManifests();
  if (allManifests.length === 0) {
    const rejection = await persistRejection({
      rejection_code: "te.evidence_source_registry_untrusted",
      requested_source_id: input.source_id,
      requested_url: input.url,
      requested_host: input.url ? safeHost(input.url) : null,
      requesting_agent_id: input.requesting_agent_id,
      requesting_identity_id: input.requesting_identity_id,
      requesting_environment: input.requesting_environment,
      mission_id: input.mission_id,
      authorization_context: input.authorization_context,
      reason: "no source registry manifest present · Guardian cannot verify registry integrity",
      rejected_at: new Date().toISOString(),
    });
    return { ok: false, rejection };
  }
  let manifest: import("./source-registry-manifest").SourceRegistryManifest | null = null;
  let lastRejectionReason = "";
  for (const m of allManifests) {
    const v = verifySourceRegistryManifest({ manifest: m, trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex });
    if (v.ok) { manifest = m; break; }
    lastRejectionReason = `${v.rejection}: ${v.reason}`;
  }
  if (!manifest) {
    const rejection = await persistRejection({
      rejection_code: "te.evidence_source_registry_untrusted",
      requested_source_id: input.source_id,
      requested_url: input.url,
      requested_host: input.url ? safeHost(input.url) : null,
      requesting_agent_id: input.requesting_agent_id,
      requesting_identity_id: input.requesting_identity_id,
      requesting_environment: input.requesting_environment,
      mission_id: input.mission_id,
      authorization_context: input.authorization_context,
      reason: `no persisted manifest (of ${allManifests.length}) verifies against trusted founder keys · last: ${lastRejectionReason}`,
      rejected_at: new Date().toISOString(),
    });
    return { ok: false, rejection };
  }

  // (2) source_id must be provided
  if (!input.source_id) {
    const rejection = await persistRejection({
      rejection_code: "te.evidence_source_missing_id",
      requested_source_id: null,
      requested_url: input.url,
      requested_host: input.url ? safeHost(input.url) : null,
      requesting_agent_id: input.requesting_agent_id,
      requesting_identity_id: input.requesting_identity_id,
      requesting_environment: input.requesting_environment,
      mission_id: input.mission_id,
      authorization_context: input.authorization_context,
      reason: "acquisition request has no source_id · production pipeline requires a registered source_id",
      rejected_at: new Date().toISOString(),
    });
    return { ok: false, rejection };
  }

  // (3) source_id must be in both the signed manifest AND the current registry code
  const inManifest = manifest.authorised_source_ids.includes(input.source_id);
  const inRegistry = AUTHORISED_SOURCES.find((s) => s.source_id === input.source_id);
  if (!inManifest || !inRegistry) {
    const rejection = await persistRejection({
      rejection_code: "te.evidence_source_unregistered",
      requested_source_id: input.source_id,
      requested_url: input.url,
      requested_host: input.url ? safeHost(input.url) : null,
      requesting_agent_id: input.requesting_agent_id,
      requesting_identity_id: input.requesting_identity_id,
      requesting_environment: input.requesting_environment,
      mission_id: input.mission_id,
      authorization_context: input.authorization_context,
      reason: `source_id "${input.source_id}" is not present in ${!inManifest ? "signed manifest" : "current registry"}`,
      rejected_at: new Date().toISOString(),
    });
    return { ok: false, rejection };
  }

  // (4) URL's host must match the registered source's host (if URL provided)
  if (input.url) {
    const requestedHost = safeHost(input.url);
    if (!requestedHost) {
      const rejection = await persistRejection({
        rejection_code: "te.evidence_source_url_mismatch",
        requested_source_id: input.source_id,
        requested_url: input.url,
        requested_host: null,
        requesting_agent_id: input.requesting_agent_id,
        requesting_identity_id: input.requesting_identity_id,
        requesting_environment: input.requesting_environment,
        mission_id: input.mission_id,
        authorization_context: input.authorization_context,
        reason: `url "${input.url}" could not be parsed`,
        rejected_at: new Date().toISOString(),
      });
      return { ok: false, rejection };
    }
    if (requestedHost !== inRegistry.host) {
      const rejection = await persistRejection({
        rejection_code: "te.evidence_source_host_mismatch",
        requested_source_id: input.source_id,
        requested_url: input.url,
        requested_host: requestedHost,
        requesting_agent_id: input.requesting_agent_id,
        requesting_identity_id: input.requesting_identity_id,
        requesting_environment: input.requesting_environment,
        mission_id: input.mission_id,
        authorization_context: input.authorization_context,
        reason: `url host "${requestedHost}" does not match registered host "${inRegistry.host}" for source_id "${input.source_id}"`,
        rejected_at: new Date().toISOString(),
      });
      return { ok: false, rejection };
    }
    return { ok: true, source_id: input.source_id, host: inRegistry.host, url: input.url };
  }

  // No URL provided but source_id is valid — caller will use the registered URL template
  return { ok: true, source_id: input.source_id, host: inRegistry.host, url: inRegistry.url_template };
}

function safeHost(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
}

// ── Read helpers ───────────────────────────────────────────────────────

export async function loadRecentGuardianRejections(limit = 200): Promise<GuardianRejection[]> {
  return getStorage().query<GuardianRejection>(SOURCE_GUARDIAN_REJECTIONS_COLLECTION, {
    limit, order_by: "rejected_at", order_dir: "desc",
  }).catch(() => []);
}
