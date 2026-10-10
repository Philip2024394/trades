// WO-AGENT-RUNTIME-01 · adversarial + property tests.
//
// Founder-locked acceptance bar 2026-09-13:
//  - Agents must have unique identity signed by founder attestation root
//  - Agents must emit signed heartbeats; forged/unsigned/stale/duplicate rejected
//  - Progress without evidence rejected at emission AND verification
//  - Per-agent memory persists to real filesystem
//  - Capability manifest tiers respected (CLAIMED ≠ green)

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";

import {
  generateAgentKeypair,
  createAgentIdentity,
  verifyAgentIdentity,
  hashCapabilityManifest,
  hashAuthorityManifest,
} from "../identity";
import { emitHeartbeat, verifyHeartbeat } from "../heartbeat-emitter";
import {
  buildCapabilityManifest,
  verifyCapabilityManifest,
  countFacetsAtLeast,
  isFacetHqGreenEligible,
  ALL_FACETS,
} from "../capability-manifest";
import { writeAgentMemory, readAgentMemory, agentMemoryCollectionName } from "../memory";
import type { AgentHeartbeatEvent, AgentIdentity, AuthorityManifest, CapabilityManifest } from "../types";

const REPO_ROOT = process.cwd();

async function cleanAgentMemory(agent_id: string): Promise<void> {
  const coll = agentMemoryCollectionName(agent_id);
  try { await fs.unlink(path.join(REPO_ROOT, "data", "nex-storage", `${coll}.jsonl`)); } catch { /* ok */ }
}

// ── Founder attestation keypair helper ─────────────────────────────────

function founderKeypair(): { privateKeyHex: string; publicKeyHex: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

// ── Helper: build a signed identity for a test agent ───────────────────

function buildTestIdentity(agent_id: string): {
  identity: AgentIdentity;
  agent_keypair: { publicKeyHex: string; privateKeyHex: string };
  founder_keypair: { publicKeyHex: string; privateKeyHex: string };
  authority_manifest: AuthorityManifest;
  capability_manifest_stub_hash: string;
} {
  const agentKp = generateAgentKeypair();
  const founderKp = founderKeypair();

  // Build a stub CapabilityManifest first (we'll re-sign it if needed)
  const capMan = buildCapabilityManifest({
    agent_id, runtime_version: "0.1.0", version: 1, specialist_domain: "test",
    facets: {}, runtime_private_key_hex: agentKp.privateKeyHex,
  });
  const cap_hash = hashCapabilityManifest({
    record_type: "NEX_AGENT_CAPABILITY_MANIFEST", manifest_id: capMan.manifest_id, agent_id, runtime_version: "0.1.0", version: 1, emitted_at: capMan.emitted_at, facets: capMan.facets, specialist_domain: "test",
  });

  const auth_manifest_base: Omit<AuthorityManifest, "founder_attestation_signature_hex" | "provenance_chain_hash"> = {
    record_type: "NEX_AGENT_AUTHORITY_MANIFEST",
    manifest_id: `auth-${agent_id}`,
    agent_id,
    runtime_version: "0.1.0",
    authorised_tools: ["http_get", "parse_atom"],
    authorised_hosts: ["export.arxiv.org"],
    authorised_collections_read: ["nex_intelligence_sources"],
    authorised_collections_write: ["nex_intelligence_crawler_audit"],
    prohibited_actions: ["POST", "authorise", "modify-substrate"],
    emitted_at: new Date().toISOString(),
  };
  const auth_hash = hashAuthorityManifest(auth_manifest_base);
  const authority_manifest: AuthorityManifest = {
    ...auth_manifest_base,
    founder_attestation_signature_hex: "",   // simplified for test
    provenance_chain_hash: "",
  };

  const identity = createAgentIdentity({
    agent_id,
    runtime_version: "0.1.0",
    agent_public_key_hex: agentKp.publicKeyHex,
    capability_manifest_hash: cap_hash,
    authority_manifest_hash: auth_hash,
    founder_attestation_private_key_hex: founderKp.privateKeyHex,
  });

  return { identity, agent_keypair: agentKp, founder_keypair: founderKp, authority_manifest, capability_manifest_stub_hash: cap_hash };
}

// ═════════════════════════════════════════════════════════════════════════
// IDENTITY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · identity", () => {
  it("A-1 · createAgentIdentity produces a valid identity signed by founder attestation root", () => {
    const { identity, founder_keypair } = buildTestIdentity("test-agent-1");
    expect(identity.record_type).toBe("NEX_AGENT_IDENTITY");
    expect(identity.agent_id).toBe("test-agent-1");
    expect(identity.founder_attestation_signature_hex.length).toBeGreaterThan(0);
    const r = verifyAgentIdentity({ identity, trusted_founder_public_keys_hex: [founder_keypair.publicKeyHex] });
    expect(r.ok).toBe(true);
  });

  it("A-2 · verifyAgentIdentity REJECTS with WRONG_KEY when signed by different founder key", () => {
    const { identity } = buildTestIdentity("test-agent-2");
    const wrongFounder = founderKeypair();
    const r = verifyAgentIdentity({ identity, trusted_founder_public_keys_hex: [wrongFounder.publicKeyHex] });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("WRONG_KEY");
  });

  it("A-3 · verifyAgentIdentity REJECTS with MISSING_SIGNATURE when signature stripped", () => {
    const { identity, founder_keypair } = buildTestIdentity("test-agent-3");
    const tampered: AgentIdentity = { ...identity, founder_attestation_signature_hex: "" };
    const r = verifyAgentIdentity({ identity: tampered, trusted_founder_public_keys_hex: [founder_keypair.publicKeyHex] });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("MISSING_SIGNATURE");
  });

  it("A-4 · tampering with the identity payload (e.g. changing runtime_key) invalidates the signature", () => {
    const { identity, founder_keypair } = buildTestIdentity("test-agent-4");
    const otherKp = generateAgentKeypair();
    const tampered: AgentIdentity = { ...identity, runtime_key_public_hex: otherKp.publicKeyHex };
    const r = verifyAgentIdentity({ identity: tampered, trusted_founder_public_keys_hex: [founder_keypair.publicKeyHex] });
    expect(r.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// HEARTBEAT
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · heartbeat", () => {
  it("A-5 · emitHeartbeat produces a signed heartbeat that verifyHeartbeat accepts", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-5");
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 3,
      last_completed_work: "processed page 3", evidence_refs: ["evidence-1", "evidence-2", "evidence-3"],
    });
    expect(emitted.ok).toBe(true);
    if (!emitted.ok) return;
    const r = verifyHeartbeat({
      heartbeat: emitted.heartbeat,
      expected_agent_id: identity.agent_id,
      expected_runtime_public_key_hex: agent_keypair.publicKeyHex,
    });
    expect(r.ok).toBe(true);
  });

  it("A-6 · emitHeartbeat REFUSES to sign when progress_counter > 0 and evidence_refs empty (NO EVIDENCE = NO CLAIM · founder-locked 2026-09-13)", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-6");
    const r = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 5,
      last_completed_work: "attempted fake progress", evidence_refs: [],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection).toBe("PROGRESS_WITHOUT_EVIDENCE");
  });

  it("A-7 · verifyHeartbeat REJECTS wrong-key signature (adversarial forge attempt)", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-7");
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 1, last_completed_work: "x", evidence_refs: ["e-1"],
    });
    if (!emitted.ok) throw new Error("setup failed");
    const attacker = generateAgentKeypair();
    const r = verifyHeartbeat({
      heartbeat: emitted.heartbeat,
      expected_agent_id: identity.agent_id,
      expected_runtime_public_key_hex: attacker.publicKeyHex,
    });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("WRONG_KEY");
  });

  it("A-8 · verifyHeartbeat REJECTS unsigned heartbeat with MISSING_SIGNATURE", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-8");
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 1, last_completed_work: "x", evidence_refs: ["e-1"],
    });
    if (!emitted.ok) throw new Error("setup failed");
    const stripped: AgentHeartbeatEvent = { ...emitted.heartbeat, runtime_signature_hex: "" };
    const r = verifyHeartbeat({
      heartbeat: stripped,
      expected_agent_id: identity.agent_id,
      expected_runtime_public_key_hex: agent_keypair.publicKeyHex,
    });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("MISSING_SIGNATURE");
  });

  it("A-9 · verifyHeartbeat REJECTS AGENT_ID_MISMATCH (impersonation of another agent)", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-9-real");
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 1, last_completed_work: "x", evidence_refs: ["e-1"],
    });
    if (!emitted.ok) throw new Error("setup failed");
    const r = verifyHeartbeat({
      heartbeat: emitted.heartbeat,
      expected_agent_id: "test-agent-9-fake",         // observer expected a DIFFERENT agent
      expected_runtime_public_key_hex: agent_keypair.publicKeyHex,
    });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("AGENT_ID_MISMATCH");
  });

  it("A-10 · verifyHeartbeat REJECTS FUTURE_TIMESTAMP (clock-skew attack)", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-10");
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 1, last_completed_work: "x", evidence_refs: ["e-1"],
      emitted_at: new Date(Date.now() + 60_000).toISOString(),  // 60s in the future
    });
    if (!emitted.ok) throw new Error("setup failed");
    const r = verifyHeartbeat({
      heartbeat: emitted.heartbeat,
      expected_agent_id: identity.agent_id,
      expected_runtime_public_key_hex: agent_keypair.publicKeyHex,
    });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("FUTURE_TIMESTAMP");
  });

  it("A-11 · verifyHeartbeat REJECTS STALE_TIMESTAMP beyond max_age_ms", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-11");
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 1, last_completed_work: "x", evidence_refs: ["e-1"],
      emitted_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),   // 48h old
    });
    if (!emitted.ok) throw new Error("setup failed");
    const r = verifyHeartbeat({
      heartbeat: emitted.heartbeat,
      expected_agent_id: identity.agent_id,
      expected_runtime_public_key_hex: agent_keypair.publicKeyHex,
    });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("STALE_TIMESTAMP");
  });

  it("A-12 · verifyHeartbeat REJECTS PROGRESS_WITHOUT_EVIDENCE at verification time (defence-in-depth)", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-12");
    // Emit an evidence-linked heartbeat first, then strip evidence_refs
    // to simulate an attacker rewriting the record post-signing.
    const emitted = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: "m-1", progress_counter: 5, last_completed_work: "x", evidence_refs: ["e-1"],
    });
    if (!emitted.ok) throw new Error("setup failed");
    const tampered: AgentHeartbeatEvent = { ...emitted.heartbeat, evidence_refs: [] };
    const r = verifyHeartbeat({
      heartbeat: tampered,
      expected_agent_id: identity.agent_id,
      expected_runtime_public_key_hex: agent_keypair.publicKeyHex,
    });
    expect(r.ok).toBe(false);
    // Rejection may be PROGRESS_WITHOUT_EVIDENCE (evidence check first)
    // OR WRONG_KEY (signature no longer verifies) — both are honest rejections.
    expect(["PROGRESS_WITHOUT_EVIDENCE", "WRONG_KEY"]).toContain(r.rejection);
  });

  it("A-13 · pure liveness heartbeat (progress_counter=0) is allowed with empty evidence_refs", () => {
    const { identity, agent_keypair } = buildTestIdentity("test-agent-13");
    const r = emitHeartbeat({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      mission_id: null, progress_counter: 0, last_completed_work: null, evidence_refs: [],
    });
    expect(r.ok).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// MEMORY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · memory", () => {
  const agent_id = "test-agent-memory";
  beforeEach(() => cleanAgentMemory(agent_id));
  afterEach(() => cleanAgentMemory(agent_id));

  it("A-14 · writeAgentMemory + readAgentMemory round-trip · signed with agent runtime key", async () => {
    const { identity, agent_keypair } = buildTestIdentity(agent_id);
    const written = await writeAgentMemory({
      identity, runtime_private_key_hex: agent_keypair.privateKeyHex,
      kind: "VALIDATED_LESSON", mission_id: "m-1",
      content: { note: "processed cs.SE fixture, dedupe rules worked" },
    });
    expect(written.record_type).toBe("NEX_AGENT_MEMORY_RECORD");
    expect(written.runtime_signature_hex.length).toBeGreaterThan(0);

    const read = await readAgentMemory({ agent_id, kind: "VALIDATED_LESSON" });
    expect(read.length).toBeGreaterThan(0);
    expect(read[0].memory_id).toBe(written.memory_id);
    expect(read[0].content_hash).toBe(written.content_hash);
  });

  it("A-15 · memory is keyed per-agent · one agent's writes NEVER surface in another agent's reads", async () => {
    const { identity: idA, agent_keypair: kpA } = buildTestIdentity("test-agent-memory-A");
    const { identity: idB, agent_keypair: kpB } = buildTestIdentity("test-agent-memory-B");
    await cleanAgentMemory("test-agent-memory-A");
    await cleanAgentMemory("test-agent-memory-B");
    try {
      await writeAgentMemory({ identity: idA, runtime_private_key_hex: kpA.privateKeyHex, kind: "MISSION_OUTCOME", mission_id: "m-A", content: { agent: "A" } });
      await writeAgentMemory({ identity: idB, runtime_private_key_hex: kpB.privateKeyHex, kind: "MISSION_OUTCOME", mission_id: "m-B", content: { agent: "B" } });
      const readA = await readAgentMemory({ agent_id: "test-agent-memory-A" });
      const readB = await readAgentMemory({ agent_id: "test-agent-memory-B" });
      expect(readA.every((r) => r.agent_id === "test-agent-memory-A")).toBe(true);
      expect(readB.every((r) => r.agent_id === "test-agent-memory-B")).toBe(true);
      expect(readA.length).toBeGreaterThan(0);
      expect(readB.length).toBeGreaterThan(0);
    } finally {
      await cleanAgentMemory("test-agent-memory-A");
      await cleanAgentMemory("test-agent-memory-B");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// CAPABILITY MANIFEST
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · capability manifest", () => {
  it("A-16 · CLAIMED-only manifest has ZERO facets HQ-green-eligible (founder-locked · code existing ≠ facet verified)", () => {
    const { agent_keypair } = buildTestIdentity("test-agent-capman-1");
    const manifest = buildCapabilityManifest({
      agent_id: "test-agent-capman-1", runtime_version: "0.1.0", version: 1, specialist_domain: "test",
      facets: {}, runtime_private_key_hex: agent_keypair.privateKeyHex,
    });
    expect(manifest.facets.length).toBe(ALL_FACETS.length);
    const greenEligible = manifest.facets.filter(isFacetHqGreenEligible).length;
    expect(greenEligible).toBe(0);
    expect(countFacetsAtLeast(manifest, "CLAIMED")).toBe(ALL_FACETS.length);
    expect(countFacetsAtLeast(manifest, "RUNTIME_VERIFIED")).toBe(0);
  });

  it("A-17 · manifest with RUNTIME_VERIFIED facets counts correctly", () => {
    const { agent_keypair } = buildTestIdentity("test-agent-capman-2");
    const manifest = buildCapabilityManifest({
      agent_id: "test-agent-capman-2", runtime_version: "0.1.0", version: 1, specialist_domain: "test",
      facets: {
        identity: { tier: "RUNTIME_VERIFIED", evidence_pointer: "ev-1", last_verified_at: new Date().toISOString() },
        liveness: { tier: "RUNTIME_VERIFIED", evidence_pointer: "ev-2", last_verified_at: new Date().toISOString() },
        brain:    { tier: "PRODUCTION_VERIFIED", evidence_pointer: "ev-3", last_verified_at: new Date().toISOString() },
      },
      runtime_private_key_hex: agent_keypair.privateKeyHex,
    });
    const greenEligible = manifest.facets.filter(isFacetHqGreenEligible).length;
    expect(greenEligible).toBe(3);
    expect(countFacetsAtLeast(manifest, "PRODUCTION_VERIFIED")).toBe(1);
  });

  it("A-18 · verifyCapabilityManifest accepts a manifest signed by the agent's own runtime key", () => {
    const { agent_keypair } = buildTestIdentity("test-agent-capman-3");
    const manifest = buildCapabilityManifest({
      agent_id: "test-agent-capman-3", runtime_version: "0.1.0", version: 1, specialist_domain: "test",
      facets: {}, runtime_private_key_hex: agent_keypair.privateKeyHex,
    });
    const r = verifyCapabilityManifest({ manifest, agent_runtime_public_key_hex: agent_keypair.publicKeyHex });
    expect(r.ok).toBe(true);
  });

  it("A-19 · verifyCapabilityManifest REJECTS manifest signed by a different agent's key (impersonation defence)", () => {
    const { agent_keypair } = buildTestIdentity("test-agent-capman-4");
    const attacker = generateAgentKeypair();
    const manifest = buildCapabilityManifest({
      agent_id: "test-agent-capman-4", runtime_version: "0.1.0", version: 1, specialist_domain: "test",
      facets: {}, runtime_private_key_hex: attacker.privateKeyHex,     // signed by ATTACKER
    });
    const r = verifyCapabilityManifest({ manifest, agent_runtime_public_key_hex: agent_keypair.publicKeyHex });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("WRONG_KEY");
  });

  it("A-20 · manifest tamper (change a facet's tier post-signing) invalidates the signature", () => {
    const { agent_keypair } = buildTestIdentity("test-agent-capman-5");
    const manifest = buildCapabilityManifest({
      agent_id: "test-agent-capman-5", runtime_version: "0.1.0", version: 1, specialist_domain: "test",
      facets: {}, runtime_private_key_hex: agent_keypair.privateKeyHex,
    });
    // Tamper: promote a facet to PRODUCTION_VERIFIED
    const tamperedFacets = manifest.facets.map((f, i) => i === 0 ? { ...f, tier: "PRODUCTION_VERIFIED" as const } : f);
    const tampered: CapabilityManifest = { ...manifest, facets: tamperedFacets };
    const r = verifyCapabilityManifest({ manifest: tampered, agent_runtime_public_key_hex: agent_keypair.publicKeyHex });
    expect(r.ok).toBe(false);
  });
});
