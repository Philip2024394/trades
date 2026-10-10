// WO-CAP-01 · NEX1 governed self-improvement adversarial tests.
//
// Founder-locked: Discovery ≠ Authority. Every fix path passes through
// the Authority Broker. Every broker approval requires a valid founder
// signature. Attackers cannot bypass.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { persistCapabilityGap } from "../registry";
import { nex1EngineerProposeFor, authorityBrokerGate, founderSignProposal, CAP_ENGINEERING_PROPOSAL_COLLECTION } from "../nex1-engineer";
import { CAP_COLLECTION } from "../types";

const REPO = process.cwd();
async function rm(name: string) { try { await fs.unlink(path.join(REPO, "data", "nex-storage", `${name}.jsonl`)); } catch {} }

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

describe("WO-CAP-01 · NEX1 Engineer governed self-improvement", () => {
  // Do NOT purge shared files · unique dedupe_keys prevent collision.

  it("E-1 · ordinary CAP → PROPOSE outcome · unsigned proposal drafted · CAP transitions to PROPOSED", async () => {
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff", category: "PERFORMANCE", priority: "MEDIUM",
      title: "test", evidence: [], detector_agent_id: null,
      dedupe_key: `e1-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    expect(r.outcome).toBe("PROPOSE");
    expect(r.proposal).not.toBeNull();
    expect(r.proposal?.founder_signature_slot).toBeNull();
    expect(r.proposal?.required_authority_scope.requires_founder_signature).toBe(true);
  });

  it("E-2 · CRITICAL priority CAP → ESCALATE · no proposal drafted", async () => {
    const cap = await persistCapabilityGap({
      kind: "any.kind", category: "SECURITY", priority: "CRITICAL",
      title: "critical test", evidence: [], detector_agent_id: null,
      dedupe_key: `e2-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    expect(r.outcome).toBe("ESCALATE");
    expect(r.proposal).toBeNull();
  });

  it("E-3 · ESCALATE_ONLY kind (registry tamper) → ESCALATE regardless of priority", async () => {
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "LOW",
      title: "registry tamper", evidence: [], detector_agent_id: null,
      dedupe_key: `e3-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    expect(r.outcome).toBe("ESCALATE");
  });

  it("E-4 · Broker refuses execution without founder signature", async () => {
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff", category: "PERFORMANCE", priority: "LOW",
      title: "test", evidence: [], detector_agent_id: null,
      dedupe_key: `e4-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    expect(r.proposal).not.toBeNull();
    const gate = await authorityBrokerGate({
      proposal_id: r.proposal!.proposal_id,
      founder_signature_hex: "",   // no signature
      trusted_founder_public_keys_hex: [],
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/no founder signature/);
  });

  it("E-5 · Broker refuses execution with WRONG founder signature (attacker forged)", async () => {
    const realFounder = founderKp();
    const attacker = founderKp();
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff", category: "PERFORMANCE", priority: "LOW",
      title: "test", evidence: [], detector_agent_id: null,
      dedupe_key: `e5-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    const forgedSig = await founderSignProposal({
      proposal: r.proposal!,
      founder_private_key_hex: attacker.privateKeyHex,
    });
    const gate = await authorityBrokerGate({
      proposal_id: r.proposal!.proposal_id,
      founder_signature_hex: forgedSig,
      trusted_founder_public_keys_hex: [realFounder.publicKeyHex],   // only real founder trusted
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/did not verify/);
  });

  it("E-6 · Broker ALLOWS execution when founder signs valid proposal", async () => {
    const founder = founderKp();
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff", category: "PERFORMANCE", priority: "LOW",
      title: "test", evidence: [], detector_agent_id: null,
      dedupe_key: `e6-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    const sig = await founderSignProposal({
      proposal: r.proposal!,
      founder_private_key_hex: founder.privateKeyHex,
    });
    const gate = await authorityBrokerGate({
      proposal_id: r.proposal!.proposal_id,
      founder_signature_hex: sig,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
    });
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toMatch(/founder signature verified/);
  });

  it("E-7 · ESCALATE proposals cannot be broker-approved (founder must resolve manually)", async () => {
    const founder = founderKp();
    const cap = await persistCapabilityGap({
      kind: "guardian.te.evidence_source_registry_untrusted",
      category: "SECURITY", priority: "MEDIUM",
      title: "must escalate", evidence: [], detector_agent_id: null,
      dedupe_key: `e7-${Date.now()}`,
    });
    const r = await nex1EngineerProposeFor(cap);
    // ESCALATE outcome → no proposal drafted at all
    expect(r.outcome).toBe("ESCALATE");
    expect(r.proposal).toBeNull();
  });

  it("E-8 · diagnosis is deterministic per CAP kind (P-S · same kind → same diagnosis)", async () => {
    const a = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff", category: "PERFORMANCE", priority: "MEDIUM",
      title: "a", evidence: [], detector_agent_id: null,
      dedupe_key: `e8a-${Date.now()}-${Math.random()}`,
    });
    const b = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff", category: "PERFORMANCE", priority: "MEDIUM",
      title: "b", evidence: [], detector_agent_id: null,
      dedupe_key: `e8b-${Date.now()}-${Math.random()}`,
    });
    const ra = await nex1EngineerProposeFor(a);
    const rb = await nex1EngineerProposeFor(b);
    expect(ra.proposal?.diagnosis).toBe(rb.proposal?.diagnosis);
    expect(ra.proposal?.proposed_fix_summary).toBe(rb.proposal?.proposed_fix_summary);
  });
});
