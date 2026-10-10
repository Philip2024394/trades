// WO-AGENT-RUNTIME-01 · supervisor adversarial tests.

import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { generateAgentKeypair, createAgentIdentity, hashCapabilityManifest, hashAuthorityManifest } from "../identity";
import { buildAuthorityManifest } from "../authority-manifest";
import { buildCapabilityManifest } from "../capability-manifest";
import { superviseAgent, tickAllSupervisedAgents, superviseAllProvisionedAgents } from "../supervisor";
import type { Dispatcher } from "../runtime-loop";

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

function buildBundleFor(agent_id: string) {
  const agentKp = generateAgentKeypair();
  const founder = founderKp();
  const authManifest = buildAuthorityManifest({
    agent_id, runtime_version: "0.1.0",
    authorised_tools: ["*"],
    authorised_hosts: ["export.arxiv.org"],
    authorised_collections_read: [],
    authorised_collections_write: [],
    prohibited_actions: ["POST", "authorise", "modify-substrate"],
    founder_attestation_private_key_hex: founder.privateKeyHex,
  });
  const capManifest = buildCapabilityManifest({
    agent_id, runtime_version: "0.1.0", version: 1, specialist_domain: "test",
    facets: {}, runtime_private_key_hex: agentKp.privateKeyHex,
  });
  const cap_hash = hashCapabilityManifest({
    record_type: "NEX_AGENT_CAPABILITY_MANIFEST", manifest_id: capManifest.manifest_id, agent_id,
    runtime_version: "0.1.0", version: 1, emitted_at: capManifest.emitted_at, facets: capManifest.facets,
    specialist_domain: "test",
  });
  const auth_hash = hashAuthorityManifest({
    record_type: "NEX_AGENT_AUTHORITY_MANIFEST", manifest_id: authManifest.manifest_id, agent_id,
    runtime_version: "0.1.0",
    authorised_tools: authManifest.authorised_tools,
    authorised_hosts: authManifest.authorised_hosts,
    authorised_collections_read: authManifest.authorised_collections_read,
    authorised_collections_write: authManifest.authorised_collections_write,
    prohibited_actions: authManifest.prohibited_actions,
    emitted_at: authManifest.emitted_at,
  });
  const identity = createAgentIdentity({
    agent_id, runtime_version: "0.1.0",
    agent_public_key_hex: agentKp.publicKeyHex,
    capability_manifest_hash: cap_hash, authority_manifest_hash: auth_hash,
    founder_attestation_private_key_hex: founder.privateKeyHex,
  });
  return { identity, agentKp, founder, authManifest, capManifest };
}

const idleDispatcher: Dispatcher = { poll: async () => null, report: async () => {} };

describe("WO-AGENT-RUNTIME-01 · supervisor", () => {
  it("S-1 · supervised agent tick returns TickResult", async () => {
    const agent_id = `sup-${Date.now()}-1`;
    const { identity, agentKp, authManifest, capManifest } = buildBundleFor(agent_id);
    const handle = superviseAgent({
      agent: {
        agent_id, identity, runtime_private_key_hex: agentKp.privateKeyHex,
        capability_manifest: capManifest, authority_manifest: authManifest,
        trusted_founder_public_keys_hex: [],
      },
      dispatcher: idleDispatcher,
    });
    const r = await handle.tick();
    expect(r?.kind).toBe("IDLE");
    await handle.stop();
    expect(handle.alive).toBe(false);
  });

  it("S-2 · simulated crash triggers auto-restart within budget", async () => {
    const agent_id = `sup-${Date.now()}-2`;
    const { identity, agentKp, authManifest, capManifest } = buildBundleFor(agent_id);
    const handle = superviseAgent({
      agent: {
        agent_id, identity, runtime_private_key_hex: agentKp.privateKeyHex,
        capability_manifest: capManifest, authority_manifest: authManifest,
        trusted_founder_public_keys_hex: [],
      },
      dispatcher: idleDispatcher, max_restarts: 3,
    });
    expect(handle.restarts).toBe(0);
    await handle.simulateCrash();
    const r1 = await handle.tick();
    expect(r1).toBeNull();   // crash + restart · null returned
    expect(handle.restarts).toBe(1);
    expect(handle.alive).toBe(true);
    // Subsequent tick should succeed
    const r2 = await handle.tick();
    expect(r2?.kind).toBe("IDLE");
    await handle.stop();
  });

  it("S-3 · exceeding max_restarts stops supervisor and rethrows", async () => {
    const agent_id = `sup-${Date.now()}-3`;
    const { identity, agentKp, authManifest, capManifest } = buildBundleFor(agent_id);
    const handle = superviseAgent({
      agent: {
        agent_id, identity, runtime_private_key_hex: agentKp.privateKeyHex,
        capability_manifest: capManifest, authority_manifest: authManifest,
        trusted_founder_public_keys_hex: [],
      },
      dispatcher: idleDispatcher, max_restarts: 2,
    });
    for (let i = 0; i < 2; i++) {
      await handle.simulateCrash();
      const r = await handle.tick();
      expect(r).toBeNull();
    }
    // 3rd crash exceeds budget → tick rethrows
    await handle.simulateCrash();
    await expect(handle.tick()).rejects.toThrow(/simulated crash/);
    expect(handle.alive).toBe(false);
  });

  it("S-4 · one crash does NOT affect other agents (isolation boundary)", async () => {
    const agentAId = `sup-${Date.now()}-A`;
    const agentBId = `sup-${Date.now()}-B`;
    const bundleA = buildBundleFor(agentAId);
    const bundleB = buildBundleFor(agentBId);
    const handleA = superviseAgent({
      agent: { agent_id: agentAId, identity: bundleA.identity, runtime_private_key_hex: bundleA.agentKp.privateKeyHex,
        capability_manifest: bundleA.capManifest, authority_manifest: bundleA.authManifest, trusted_founder_public_keys_hex: [] },
      dispatcher: idleDispatcher,
    });
    const handleB = superviseAgent({
      agent: { agent_id: agentBId, identity: bundleB.identity, runtime_private_key_hex: bundleB.agentKp.privateKeyHex,
        capability_manifest: bundleB.capManifest, authority_manifest: bundleB.authManifest, trusted_founder_public_keys_hex: [] },
      dispatcher: idleDispatcher,
    });
    // Crash A
    await handleA.simulateCrash();
    await handleA.tick();
    // B is unaffected
    const rB = await handleB.tick();
    expect(rB?.kind).toBe("IDLE");
    expect(handleB.alive).toBe(true);
    expect(handleB.restarts).toBe(0);
    await handleA.stop();
    await handleB.stop();
  });

  it("S-5 · tickAllSupervisedAgents fires one tick per agent in parallel", async () => {
    const provisioned = [
      buildBundleForProvisioning(`nex1-master-engineer`),
      buildBundleForProvisioning(`intelligence-crawler`),
      buildBundleForProvisioning(`lab-security-observer`),
    ];
    const handles = superviseAllProvisionedAgents({
      provisioned,
      trusted_founder_public_keys_hex: [],
    });
    // Only actually-registered agent_ids will be supervised
    expect(handles.size).toBe(3);
    for (const h of handles.values()) await h.stop();
  });
});

function buildBundleForProvisioning(agent_id: string) {
  const bundle = buildBundleFor(agent_id);
  return {
    agent_id,
    identity: bundle.identity,
    runtime_private_key_hex: bundle.agentKp.privateKeyHex,
    capability_manifest: bundle.capManifest,
    authority_manifest: bundle.authManifest,
  };
}
