// WO-SOURCE-GUARDIAN-01 · adversarial + acceptance tests.
//
// Founder-locked · no source may enter the production intelligence
// pipeline unless it is explicitly present in the governed Source
// Registry and the requesting agent is PRODUCTION_WORKFORCE.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  signSourceRegistryManifest,
  persistSourceRegistryManifest,
  verifySourceRegistryManifest,
  loadLatestSourceRegistryManifest,
  SOURCE_REGISTRY_MANIFEST_COLLECTION,
} from "../source-registry-manifest";
import {
  guardianCheck,
  loadRecentGuardianRejections,
  SOURCE_GUARDIAN_REJECTIONS_COLLECTION,
} from "../source-guardian";

const REPO = process.cwd();

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

async function rmCollection(name: string) {
  try { await fs.unlink(path.join(REPO, "data", "nex-storage", `${name}.jsonl`)); } catch { /* ok */ }
}

async function seedTrustedManifest(founder: { publicKeyHex: string; privateKeyHex: string }) {
  const m = signSourceRegistryManifest({
    manifest_version: 1,
    founder_public_key_hex: founder.publicKeyHex,
    founder_private_key_hex: founder.privateKeyHex,
  });
  await persistSourceRegistryManifest(m);
  return m;
}

describe("WO-SOURCE-GUARDIAN-01 · signed source registry manifest", () => {
  // Do NOT purge the shared manifest/rejection files — parallel test files
  // race on the same disk. Each test seeds its own manifest; the latest wins.

  it("SG-1 · founder-signed manifest verifies", async () => {
    const founder = founderKp();
    const m = await seedTrustedManifest(founder);
    const v = verifySourceRegistryManifest({ manifest: m, trusted_founder_public_keys_hex: [founder.publicKeyHex] });
    expect(v.ok).toBe(true);
  });

  it("SG-2 · manifest signed by wrong founder REJECTED", async () => {
    const founder = founderKp();
    const attacker = founderKp();
    const m = await seedTrustedManifest(founder);
    const v = verifySourceRegistryManifest({ manifest: m, trusted_founder_public_keys_hex: [attacker.publicKeyHex] });
    expect(v.ok).toBe(false);
    expect(v.rejection).toBe("te.registry_manifest_wrong_founder_key");
  });

  it("SG-3 · latest manifest is loaded", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const latest = await loadLatestSourceRegistryManifest();
    expect(latest).not.toBeNull();
    expect(latest?.manifest_version).toBe(1);
  });
});

describe("WO-SOURCE-GUARDIAN-01 · adversarial · guardianCheck", () => {
  // Do NOT purge the shared manifest/rejection files — parallel test files
  // race on the same disk. Each test seeds its own manifest; the latest wins.

  it("SG-4 · unknown source_id → te.evidence_source_unregistered · rejection persisted", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: "attacker-injected-source",
      url: "https://export.arxiv.org/api/query",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-4",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_unregistered");
    const persisted = await loadRecentGuardianRejections(5);
    expect(persisted.some((p) => p.rejection_id === r.rejection.rejection_id)).toBe(true);
  });

  it("SG-5 · unknown DOMAIN (host_mismatch on registered source_id) → te.evidence_source_host_mismatch", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: "arxiv-cs-se",   // real source_id
      url: "https://evil.example.com/steal",   // wrong host
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-5",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_host_mismatch");
  });

  it("SG-6 · missing source_id → te.evidence_source_missing_id", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: null,
      url: "https://export.arxiv.org/api/query",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-6",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_missing_id");
  });

  it("SG-7 · TEST identity requesting production acquisition → te.evidence_source_test_masquerade", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: "arxiv-cs-se",
      url: "https://export.arxiv.org/api/query",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "TEST",    // <-- test masquerade
      mission_id: "m-sg-7",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_test_masquerade");
  });

  it("SG-8 · forged registry (wrong founder key) → te.evidence_source_registry_untrusted", async () => {
    const attackerFounder = founderKp();
    const realFounder = founderKp();
    // Attacker signs their own manifest and persists it
    await seedTrustedManifest(attackerFounder);
    // But we trust ONLY the real founder's key
    const r = await guardianCheck({
      source_id: "arxiv-cs-se",
      url: "https://export.arxiv.org/api/query",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-8",
      authorization_context: {},
      trusted_founder_public_keys_hex: [realFounder.publicKeyHex],   // real key trusted, not attacker's
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_registry_untrusted");
  });

  it("SG-9 · no registry manifest at all → te.evidence_source_registry_untrusted", async () => {
    // Do not seed a manifest
    const founder = founderKp();
    const r = await guardianCheck({
      source_id: "arxiv-cs-se",
      url: "https://export.arxiv.org/api/query",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-9",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_registry_untrusted");
  });

  it("SG-10 · registered source with matching host → allowed", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: "arxiv-cs-se",
      url: "https://export.arxiv.org/api/query?search_query=cat:cs.SE",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-10",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source_id).toBe("arxiv-cs-se");
    expect(r.host).toBe("export.arxiv.org");
  });

  it("SG-11 · every rejection is persisted with full context (agent, timestamp, reason, environment)", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: "not-in-registry-abc",
      url: "https://export.arxiv.org/api/query",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-11",
      authorization_context: { authorised_hosts: ["export.arxiv.org"], budget_ms: 30000 },
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const rej = r.rejection;
    expect(rej.requesting_agent_id).toBe("intelligence-crawler");
    expect(rej.requesting_identity_id).toBe("agent-identity-crawler-x");
    expect(rej.requesting_environment).toBe("PRODUCTION_WORKFORCE");
    expect(rej.mission_id).toBe("m-sg-11");
    expect(rej.rejected_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(rej.reason.length).toBeGreaterThan(0);
    expect(rej.provenance_chain_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("SG-12 · malformed URL → te.evidence_source_url_mismatch (not silent success)", async () => {
    const founder = founderKp();
    await seedTrustedManifest(founder);
    const r = await guardianCheck({
      source_id: "arxiv-cs-se",
      url: "not-a-valid-url",
      requesting_agent_id: "intelligence-crawler",
      requesting_identity_id: "agent-identity-crawler-x",
      requesting_environment: "PRODUCTION_WORKFORCE",
      mission_id: "m-sg-12",
      authorization_context: {},
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection.rejection_code).toBe("te.evidence_source_url_mismatch");
  });
});
