// WO-SOURCE-GUARDIAN-01 · founder-signed source registry manifest.
//
// Founder-locked 2026-09-13: the source registry itself is tamper-evident.
// Adding, removing, or altering a source requires a signed manifest.
// The Guardian verifies the manifest's signature on every registry read
// so a compromised process cannot inject unregistered sources.
//
// Persistence: nex_source_registry_manifest.jsonl · append-only ·
// latest signed manifest is authoritative.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "./provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { AUTHORISED_SOURCES, type AuthorisedSource } from "./source-registry";

export const SOURCE_REGISTRY_MANIFEST_COLLECTION = "nex_source_registry_manifests";

// ── Manifest record ────────────────────────────────────────────────────

export interface SourceRegistryManifest {
  readonly record_type: "NEX_SOURCE_REGISTRY_MANIFEST";
  readonly manifest_id: string;
  readonly manifest_version: number;
  readonly authorised_source_ids: readonly string[];
  readonly registry_content_hash: string;             // hash of the whole registry content
  readonly issued_at: string;
  readonly founder_public_key_hex: string;
  readonly founder_signature_hex: string;
  readonly provenance_chain_hash: string;
}

// ── Compute canonical hash of the current source registry ──────────────

function registryContentHash(sources: readonly AuthorisedSource[]): string {
  // Canonicalise each source entry deterministically and hash the whole list.
  const canonical = canonicalJson({
    sources: [...sources].sort((a, b) => a.source_id.localeCompare(b.source_id)).map((s) => ({
      source_id: s.source_id,
      source_class: s.source_class,
      host: s.host,
      url_template: s.url_template,
      params: s.params,
      access_method: s.access_method,
      parser_kind: s.parser_kind,
      priority: s.priority,
      policy: s.policy,
    })),
  });
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function manifestSignaturePayload(input: {
  manifest_id: string;
  manifest_version: number;
  authorised_source_ids: readonly string[];
  registry_content_hash: string;
  issued_at: string;
}): string {
  return canonicalJson({
    manifest_id: input.manifest_id,
    manifest_version: input.manifest_version,
    authorised_source_ids: [...input.authorised_source_ids].sort(),
    registry_content_hash: input.registry_content_hash,
    issued_at: input.issued_at,
  });
}

// ── Sign a new manifest (founder-only in production) ───────────────────

export interface SignManifestInput {
  readonly manifest_version: number;
  readonly founder_public_key_hex: string;
  readonly founder_private_key_hex: string;
  readonly issued_at?: string;
}

export function signSourceRegistryManifest(input: SignManifestInput): SourceRegistryManifest {
  const issued_at = input.issued_at ?? new Date().toISOString();
  const manifest_id = `SRM-${randomUUID().slice(0, 12)}`;
  const authorised_source_ids = AUTHORISED_SOURCES.map((s) => s.source_id);
  const registry_content_hash = registryContentHash(AUTHORISED_SOURCES);

  const payload = manifestSignaturePayload({
    manifest_id, manifest_version: input.manifest_version,
    authorised_source_ids, registry_content_hash, issued_at,
  });
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.founder_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });

  const base = {
    record_type: "NEX_SOURCE_REGISTRY_MANIFEST" as const,
    manifest_id, manifest_version: input.manifest_version,
    authorised_source_ids: Object.freeze([...authorised_source_ids]) as readonly string[],
    registry_content_hash,
    issued_at,
    founder_public_key_hex: input.founder_public_key_hex,
    founder_signature_hex: signature.toString("hex"),
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

export async function persistSourceRegistryManifest(m: SourceRegistryManifest): Promise<void> {
  await getStorage().save(SOURCE_REGISTRY_MANIFEST_COLLECTION, m);
}

// ── Verify a manifest ──────────────────────────────────────────────────

export type ManifestRejectionCode =
  | "te.registry_manifest_missing"
  | "te.registry_manifest_signature_invalid"
  | "te.registry_manifest_wrong_founder_key"
  | "te.registry_content_hash_mismatch";

export interface ManifestVerification {
  readonly ok: boolean;
  readonly rejection?: ManifestRejectionCode;
  readonly reason?: string;
}

export function verifySourceRegistryManifest(input: {
  manifest: SourceRegistryManifest;
  trusted_founder_public_keys_hex: readonly string[];
}): ManifestVerification {
  const m = input.manifest;
  if (!m.founder_signature_hex || m.founder_signature_hex.length === 0) {
    return { ok: false, rejection: "te.registry_manifest_missing", reason: "no founder signature" };
  }
  // Recompute the current registry's content hash and ensure it matches
  const currentHash = registryContentHash(AUTHORISED_SOURCES);
  if (currentHash !== m.registry_content_hash) {
    return { ok: false, rejection: "te.registry_content_hash_mismatch", reason: `manifest hash=${m.registry_content_hash.slice(0, 16)}... but current registry hash=${currentHash.slice(0, 16)}...` };
  }
  const payload = manifestSignaturePayload({
    manifest_id: m.manifest_id,
    manifest_version: m.manifest_version,
    authorised_source_ids: m.authorised_source_ids,
    registry_content_hash: m.registry_content_hash,
    issued_at: m.issued_at,
  });
  const signature = Buffer.from(m.founder_signature_hex, "hex");
  for (const pubHex of input.trusted_founder_public_keys_hex) {
    try {
      const pub = Buffer.from(pubHex, "hex");
      const ok = ed25519Verify(null, Buffer.from(payload, "utf8"), { key: pub, format: "der", type: "spki" }, signature);
      if (ok) return { ok: true };
    } catch { /* try next */ }
  }
  return { ok: false, rejection: "te.registry_manifest_wrong_founder_key", reason: "signature did not verify against any trusted founder key" };
}

// ── Load the latest manifest ───────────────────────────────────────────

export async function loadLatestSourceRegistryManifest(): Promise<SourceRegistryManifest | null> {
  const records = await getStorage().query<SourceRegistryManifest>(SOURCE_REGISTRY_MANIFEST_COLLECTION, {
    limit: 100, order_by: "issued_at", order_dir: "desc",
  }).catch(() => []);
  return records[0] ?? null;
}

/** Load every persisted manifest. Founder-locked 2026-09-13: the Guardian
 *  will try each manifest against the trusted-founder-keys · this allows
 *  the same disk to hold multiple manifests (for example test isolation
 *  or key rotation) as long as at least one verifies. */
export async function loadAllSourceRegistryManifests(): Promise<SourceRegistryManifest[]> {
  return getStorage().query<SourceRegistryManifest>(SOURCE_REGISTRY_MANIFEST_COLLECTION, {
    limit: 500, order_by: "issued_at", order_dir: "desc",
  }).catch(() => []);
}
