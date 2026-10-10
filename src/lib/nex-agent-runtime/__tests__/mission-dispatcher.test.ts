// WO-AGENT-RUNTIME-01 · mission dispatcher adversarial tests.

import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign as ed25519Sign } from "node:crypto";
import { generateAgentKeypair, createAgentIdentity, hashCapabilityManifest, hashAuthorityManifest } from "../identity";
import { buildAuthorityManifest } from "../authority-manifest";
import { buildCapabilityManifest } from "../capability-manifest";
import { signMissionEnvelope, verifyMissionEnvelope, envelopeSubsetOfAuthority, makeEnvelopeDispatcher, persistEnvelope } from "../mission-dispatcher";

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

function buildAuthFor(agent_id: string, opts: Partial<Parameters<typeof buildAuthorityManifest>[0]> = {}) {
  const founder = founderKp();
  const auth = buildAuthorityManifest({
    agent_id, runtime_version: "0.1.0",
    authorised_tools: opts.authorised_tools ?? ["http_get", "parse_atom"],
    authorised_hosts: opts.authorised_hosts ?? ["export.arxiv.org"],
    authorised_collections_read: [],
    authorised_collections_write: [],
    prohibited_actions: opts.prohibited_actions ?? ["POST", "authorise", "modify-substrate"],
    founder_attestation_private_key_hex: founder.privateKeyHex,
  });
  return { founder, auth };
}

describe("WO-AGENT-RUNTIME-01 · mission envelope · adversarial", () => {
  it("D-1 · founder-signed envelope verifies", () => {
    const { founder } = buildAuthFor("test-md-1");
    const env = signMissionEnvelope({
      target_agent_id: "test-md-1", target_lane: "intelligence",
      kind: "test", input: {},
      authorised_hosts: ["export.arxiv.org"], authorised_tools: ["http_get"],
      budget_ms: 30_000, founder_attestation_private_key_hex: founder.privateKeyHex,
    });
    const v = verifyMissionEnvelope({ envelope: env, trusted_founder_public_keys_hex: [founder.publicKeyHex] });
    expect(v.ok).toBe(true);
  });

  it("D-2 · envelope signed by wrong founder REJECTED", () => {
    const { founder: f1 } = buildAuthFor("test-md-2");
    const f2 = founderKp();
    const env = signMissionEnvelope({
      target_agent_id: "test-md-2", target_lane: "intelligence",
      kind: "test", input: {},
      authorised_hosts: ["export.arxiv.org"], authorised_tools: ["http_get"],
      budget_ms: 30_000, founder_attestation_private_key_hex: f1.privateKeyHex,
    });
    const v = verifyMissionEnvelope({ envelope: env, trusted_founder_public_keys_hex: [f2.publicKeyHex] });
    expect(v.ok).toBe(false);
    expect(v.rejection).toBe("WRONG_KEY");
  });

  it("D-3 · expired envelope REJECTED (STALE_TIMESTAMP)", () => {
    const { founder } = buildAuthFor("test-md-3");
    const env = signMissionEnvelope({
      target_agent_id: "test-md-3", target_lane: "intelligence",
      kind: "test", input: {},
      authorised_hosts: [], authorised_tools: [],
      budget_ms: 100, lifetime_ms: 100,
      founder_attestation_private_key_hex: founder.privateKeyHex,
    });
    // Verify with now = far in the future
    const future = new Date(Date.now() + 3600_000);
    const v = verifyMissionEnvelope({ envelope: env, trusted_founder_public_keys_hex: [founder.publicKeyHex], now: future });
    expect(v.ok).toBe(false);
    expect(v.rejection).toBe("STALE_TIMESTAMP");
  });

  it("D-4 · envelope requesting an unauthorised host is NOT a subset of authority (P-U)", () => {
    const { founder, auth } = buildAuthFor("test-md-4", { authorised_hosts: ["safe.example.com"] });
    const env = signMissionEnvelope({
      target_agent_id: "test-md-4", target_lane: "intelligence",
      kind: "test", input: {},
      authorised_hosts: ["evil.example.com"], authorised_tools: ["http_get"],
      budget_ms: 1000, founder_attestation_private_key_hex: founder.privateKeyHex,
    });
    const subset = envelopeSubsetOfAuthority({ envelope: env, authority: auth });
    expect(subset.ok).toBe(false);
    expect(subset.reason).toMatch(/not in agent's authorised_hosts/);
  });

  it("D-5 · envelope tool in prohibited_actions is REJECTED even with authority (P-U)", () => {
    const { founder, auth } = buildAuthFor("test-md-5", {
      authorised_tools: ["*"], prohibited_actions: ["modify-substrate"],
    });
    const env = signMissionEnvelope({
      target_agent_id: "test-md-5", target_lane: "orchestrator",
      kind: "test", input: {},
      authorised_hosts: [], authorised_tools: ["modify-substrate"],
      budget_ms: 1000, founder_attestation_private_key_hex: founder.privateKeyHex,
    });
    const subset = envelopeSubsetOfAuthority({ envelope: env, authority: auth });
    expect(subset.ok).toBe(false);
    expect(subset.reason).toMatch(/prohibited_actions/);
  });

  it("D-6 · dispatcher SKIPS envelopes with forged signature and returns null", async () => {
    const { founder, auth } = buildAuthFor(`test-md-6-${Date.now()}`);
    const attacker = founderKp();
    const env = signMissionEnvelope({
      target_agent_id: auth.agent_id, target_lane: "orchestrator",
      kind: "test", input: {},
      authorised_hosts: [], authorised_tools: [],
      budget_ms: 1000, founder_attestation_private_key_hex: attacker.privateKeyHex,
    });
    await persistEnvelope(env);
    const dispatcher = makeEnvelopeDispatcher({ authority: auth, trusted_founder_public_keys_hex: [founder.publicKeyHex] });
    const mission = await dispatcher.poll(auth.agent_id);
    expect(mission).toBeNull();
  });

  it("D-7 · dispatcher SURFACES a valid envelope and marks it assigned", async () => {
    const { founder, auth } = buildAuthFor(`test-md-7-${Date.now()}`, {
      authorised_tools: ["http_get"], authorised_hosts: ["export.arxiv.org"],
    });
    const env = signMissionEnvelope({
      target_agent_id: auth.agent_id, target_lane: "orchestrator",
      kind: "test", input: { x: 1 },
      authorised_hosts: ["export.arxiv.org"], authorised_tools: ["http_get"],
      budget_ms: 1000, founder_attestation_private_key_hex: founder.privateKeyHex,
    });
    await persistEnvelope(env);
    const dispatcher = makeEnvelopeDispatcher({ authority: auth, trusted_founder_public_keys_hex: [founder.publicKeyHex] });
    const first = await dispatcher.poll(auth.agent_id);
    expect(first).not.toBeNull();
    expect(first?.mission_id).toBe(env.mission_id);
    // Second poll should NOT return the same envelope (already assigned)
    const second = await dispatcher.poll(auth.agent_id);
    expect(second?.mission_id).not.toBe(env.mission_id);
  });
});
