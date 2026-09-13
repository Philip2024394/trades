// WO-INTEL-ORCHESTRATOR-01 · mandate signing + verification.
//
// The mandate is the founder-signed envelope inside which the Intelligence
// Orchestrator operates. Uses the WO-13 attestation trust root — same
// pattern as the crawler manifest.

import { createPrivateKey, sign as ed25519Sign } from "node:crypto";
import { verifyAttestationSignature } from "@/lib/nex1-orchestrator/wo13-attestation";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { IntelligenceOperatingMandate, IntelligenceWorkClass } from "./types";

/**
 * Canonical bytes over which the mandate signature is computed.
 * Deterministic; must match between sign and verify.
 */
export function canonicaliseMandate(input: {
  readonly mandate_id: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly authorised_source_class_ids: readonly string[];
  readonly authorised_crawler_manifest_ids: readonly string[];
  readonly authorised_work_classes: readonly IntelligenceWorkClass[];
  readonly authorised_domains: readonly string[];
  readonly max_concurrent_missions: number;
  readonly max_daily_missions: number;
  readonly max_experiment_budget_ms: number;
  readonly max_storage_bytes_per_mission: number;
  readonly prohibited_actions: readonly string[];
  readonly prohibited_hosts: readonly string[];
  readonly promotion_thresholds_by_tier: { readonly INTELLIGENCE: number; readonly SUPER_INTELLIGENCE: number };
  readonly authorising_wo_id: string;
}): Buffer {
  return Buffer.from(canonicalJson({
    mandate_id: input.mandate_id,
    issued_at: input.issued_at,
    expires_at: input.expires_at,
    authorised_source_class_ids: [...input.authorised_source_class_ids].sort(),
    authorised_crawler_manifest_ids: [...input.authorised_crawler_manifest_ids].sort(),
    authorised_work_classes: [...input.authorised_work_classes].sort(),
    authorised_domains: [...input.authorised_domains].sort(),
    max_concurrent_missions: input.max_concurrent_missions,
    max_daily_missions: input.max_daily_missions,
    max_experiment_budget_ms: input.max_experiment_budget_ms,
    max_storage_bytes_per_mission: input.max_storage_bytes_per_mission,
    prohibited_actions: [...input.prohibited_actions].sort(),
    prohibited_hosts: [...input.prohibited_hosts].sort(),
    promotion_thresholds_by_tier: input.promotion_thresholds_by_tier,
    authorising_wo_id: input.authorising_wo_id,
  }), "utf8");
}

/**
 * Sign a mandate with the founder's attestation private key.
 * Founder-side (offline) and test-side use.
 */
export function signMandate(
  attestationPrivateKeyPkcs8Hex: string,
  fields: Parameters<typeof canonicaliseMandate>[0],
): IntelligenceOperatingMandate {
  const privateKey = createPrivateKey({
    key: Buffer.from(attestationPrivateKeyPkcs8Hex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  const canonical = canonicaliseMandate(fields);
  const signature = ed25519Sign(null, canonical, privateKey);
  const base = {
    record_type: "NEX_INTEL_OPERATING_MANDATE" as const,
    version: "wo-intel-orch.v0.1" as const,
    ...fields,
    attestation_signature_hex: signature.toString("hex"),
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

/** Verify a mandate against the compiled-in trust root (or test-supplied keys). */
export function verifyMandate(
  m: IntelligenceOperatingMandate,
  trustedKeys?: readonly string[],
): boolean {
  if (m.record_type !== "NEX_INTEL_OPERATING_MANDATE") return false;
  if (m.version !== "wo-intel-orch.v0.1") return false;
  if (typeof m.attestation_signature_hex !== "string" || m.attestation_signature_hex.length === 0) return false;
  const canonical = canonicaliseMandate(m);
  return verifyAttestationSignature(canonical, m.attestation_signature_hex, trustedKeys);
}

export async function persistMandate(m: IntelligenceOperatingMandate): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intel_operating_mandates, m);
}

export async function loadLatestMandate(): Promise<IntelligenceOperatingMandate | null> {
  const rows = await getStorage().query<IntelligenceOperatingMandate>(
    COLLECTIONS.nex_intel_operating_mandates,
    { limit: 10, order_by: "issued_at", order_dir: "desc" },
  );
  return rows[0] ?? null;
}
