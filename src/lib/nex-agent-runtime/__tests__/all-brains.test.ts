// WO-AGENT-RUNTIME-02..05 · every brain runs end-to-end via runtime-loop.
//
// One assertion: for every registered agent, the brain runs a mission
// through the runtime loop and produces signed heartbeats + evidence.

import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { generateAgentKeypair, createAgentIdentity, hashCapabilityManifest, hashAuthorityManifest } from "../identity";
import { buildAuthorityManifest } from "../authority-manifest";
import { buildCapabilityManifest } from "../capability-manifest";
import { createAgentWorker, type Mission, type Dispatcher } from "../runtime-loop";
import { brainForAgent } from "../brains/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";

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
  return { identity, agentKp, authManifest, capManifest };
}

describe("WO-AGENT-RUNTIME-02..05 · every registered agent has a brain that runs", () => {
  for (const agent of AGENT_REGISTRY) {
    // Crawler requires an actual HTTP override — it's tested separately in crawler-reference-agent.test.ts
    if (agent.id === "intelligence-crawler") continue;
    const unique_id = `${agent.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    it(`A-B-${agent.id} · brain runs a mission and emits evidence`, async () => {
      const { identity, agentKp, authManifest, capManifest } = buildBundleFor(unique_id);
      const mission: Mission = {
        mission_id: `brain-test-${unique_id}`, kind: "brain-smoke-test",
        authorised_hosts: ["export.arxiv.org"],
        input: { template: "hello", path: "package.json", kind: "unit", complexity: 1, files: 1, max_edits: 1 },
        budget_ms: 30_000, deadline_iso: new Date(Date.now() + 30_000).toISOString(),
      };
      let dispatched = false;
      const dispatcher: Dispatcher = {
        poll: async () => { if (dispatched) return null; dispatched = true; return mission; },
        report: async () => {},
      };
      const brain = brainForAgent(agent.id);
      const worker = createAgentWorker({
        identity, runtime_private_key_hex: agentKp.privateKeyHex,
        capability_manifest: capManifest, authority_manifest: authManifest,
        brain, dispatcher,
      });
      const r = await worker.tickOnce();
      // Every brain must produce at least SUCCESS or PARTIAL (never fail on smoke)
      expect(["SUCCESS", "PARTIAL"]).toContain(r.kind);
      // Every brain must emit at least the AliveNoProgress heartbeat
      expect(r.heartbeat_ids.length).toBeGreaterThan(0);
    });
  }
});
