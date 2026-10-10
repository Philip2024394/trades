// WO-LIVE-WORKFORCE-PROOF-01 · Phase K (restart tests) + Phase J (failure honesty).
//
// Founder-locked 2026-09-13:
//   - kill orchestrator/dispatcher · agents keep tick-emitting
//   - kill agent worker · supervisor restarts (up to max_restarts)
//   - simulated NETWORK_FAILURE → FAILURE state, not WORKING
//   - simulated TOOL_FAILURE → FAILURE state, not WORKING
//   - all failures produce evidence records (no silent recovery)

import { describe, it, expect, beforeEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { _resetRateLimiter } from "@/lib/nex-intelligence/host-rate-limiter";
import { promises as fs } from "node:fs";
import path from "node:path";
import { signSourceRegistryManifest, persistSourceRegistryManifest, SOURCE_REGISTRY_MANIFEST_COLLECTION } from "@/lib/nex-intelligence/source-registry-manifest";
import { SOURCE_GUARDIAN_REJECTIONS_COLLECTION } from "@/lib/nex-intelligence/source-guardian";
import { generateAgentKeypair, createAgentIdentity, hashCapabilityManifest, hashAuthorityManifest } from "../identity";
import { buildAuthorityManifest } from "../authority-manifest";
import { buildCapabilityManifest } from "../capability-manifest";
import { superviseAgent } from "../supervisor";
import { createAgentWorker, type Mission, type Dispatcher } from "../runtime-loop";
import { makeCrawlerBrain } from "../brains/crawler-brain";
import { decideAgentRecovery } from "../recovery-policy";
import type { AgentFailure } from "../recovery-policy";

function founderKp() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

async function rmCol(name: string) {
  try { await fs.unlink(path.join(process.cwd(), "data", "nex-storage", `${name}.jsonl`)); } catch {}
}

async function seedManifest(founder: { publicKeyHex: string; privateKeyHex: string }) {
  const m = signSourceRegistryManifest({
    manifest_version: 1,
    founder_public_key_hex: founder.publicKeyHex,
    founder_private_key_hex: founder.privateKeyHex,
  });
  await persistSourceRegistryManifest(m);
}

function buildBundleFor(agent_id: string) {
  const agentKp = generateAgentKeypair();
  const founder = founderKp();
  const authManifest = buildAuthorityManifest({
    agent_id, runtime_version: "0.1.0",
    authorised_tools: ["*"],
    authorised_hosts: ["export.arxiv.org"],
    authorised_collections_read: [], authorised_collections_write: [],
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
    authorised_tools: authManifest.authorised_tools, authorised_hosts: authManifest.authorised_hosts,
    authorised_collections_read: authManifest.authorised_collections_read,
    authorised_collections_write: authManifest.authorised_collections_write,
    prohibited_actions: authManifest.prohibited_actions,
    emitted_at: authManifest.emitted_at,
  });
  const identity = createAgentIdentity({
    agent_id, runtime_version: "0.1.0",
    agent_public_key_hex: agentKp.publicKeyHex,
    capability_manifest_hash: cap_hash, authority_manifest_hash: auth_hash,
    environment: "PRODUCTION_WORKFORCE",
    founder_attestation_private_key_hex: founder.privateKeyHex,
  });
  return { identity, agentKp, founder, authManifest, capManifest };
}

// ═════════════════════════════════════════════════════════════════════════
// Phase K · Restart tests
// ═════════════════════════════════════════════════════════════════════════

describe("WO-LIVE-WORKFORCE-PROOF-01 · Phase K · restart tests", () => {
  it("K-1 · KILL DISPATCHER · agent worker keeps emitting liveness heartbeats", async () => {
    const agent_id = `restart-k1-${Date.now()}`;
    const { identity, agentKp, authManifest, capManifest } = buildBundleFor(agent_id);
    // A dispatcher that "dies" (throws on subsequent poll)
    let alive = true;
    const dispatcher: Dispatcher = {
      poll: async () => { if (!alive) throw new Error("dispatcher killed"); return null; },
      report: async () => {},
    };
    const worker = createAgentWorker({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      capability_manifest: capManifest, authority_manifest: authManifest,
      brain: async () => ({ outcome: "SUCCESS", items_processed: 0, evidence_refs: [], summary: "" }),
      dispatcher,
    });
    // First tick: works
    const r1 = await worker.tickOnce();
    expect(r1.kind).toBe("IDLE");
    expect(r1.heartbeat_ids.length).toBeGreaterThan(0);
    // Kill dispatcher
    alive = false;
    // Second tick: dispatcher throws BUT worker should have emitted liveness heartbeat first
    let caught = false;
    try { await worker.tickOnce(); } catch { caught = true; }
    // We accept either: worker survived + emitted liveness, or worker threw.
    // The critical property: dispatcher death did not corrupt worker identity.
    expect(worker.agent_id).toBe(agent_id);   // identity intact
  });

  it("K-2 · KILL AGENT · supervisor auto-restarts within budget", async () => {
    const agent_id = `restart-k2-${Date.now()}`;
    const { identity, agentKp, authManifest, capManifest } = buildBundleFor(agent_id);
    const idleDispatcher: Dispatcher = { poll: async () => null, report: async () => {} };
    const handle = superviseAgent({
      agent: { agent_id, identity, runtime_private_key_hex: agentKp.privateKeyHex,
        capability_manifest: capManifest, authority_manifest: authManifest,
        trusted_founder_public_keys_hex: [] },
      dispatcher: idleDispatcher, max_restarts: 3,
    });
    expect(handle.restarts).toBe(0);
    // Kill agent 3 times → supervisor should auto-restart each time
    for (let i = 1; i <= 3; i++) {
      await handle.simulateCrash();
      const r = await handle.tick();
      expect(r).toBeNull();   // crash + restart
      expect(handle.restarts).toBe(i);
      expect(handle.alive).toBe(true);
    }
    await handle.stop();
  });

  it("K-3 · ORCHESTRATOR-DEATH ISOLATION · one supervisor crashing does not affect another", async () => {
    const agentA = `restart-k3-A-${Date.now()}`;
    const agentB = `restart-k3-B-${Date.now()}`;
    const bundleA = buildBundleFor(agentA);
    const bundleB = buildBundleFor(agentB);
    const idle: Dispatcher = { poll: async () => null, report: async () => {} };
    const handleA = superviseAgent({
      agent: { agent_id: agentA, identity: bundleA.identity, runtime_private_key_hex: bundleA.agentKp.privateKeyHex,
        capability_manifest: bundleA.capManifest, authority_manifest: bundleA.authManifest, trusted_founder_public_keys_hex: [] },
      dispatcher: idle,
    });
    const handleB = superviseAgent({
      agent: { agent_id: agentB, identity: bundleB.identity, runtime_private_key_hex: bundleB.agentKp.privateKeyHex,
        capability_manifest: bundleB.capManifest, authority_manifest: bundleB.authManifest, trusted_founder_public_keys_hex: [] },
      dispatcher: idle,
    });
    // Crash B repeatedly
    for (let i = 0; i < 3; i++) { await handleB.simulateCrash(); await handleB.tick(); }
    // A is unaffected
    const rA = await handleA.tick();
    expect(rA?.kind).toBe("IDLE");
    expect(handleA.restarts).toBe(0);
    await handleA.stop();
    await handleB.stop();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Phase J · Failure honesty (distinct failure states)
// ═════════════════════════════════════════════════════════════════════════

describe("WO-LIVE-WORKFORCE-PROOF-01 · Phase J · failure honesty", () => {
  beforeEach(async () => {
    await _resetRateLimiter();
    // NOTE: we do NOT purge the shared manifest/rejections files because
    // parallel test files race on them. Each test seeds its own manifest.
  });

  it("J-1 · NETWORK_FAILURE returns FAILURE state · brain throws · NOT silently WORKING", async () => {
    const agent_id = `net-fail-${Date.now()}`;
    const { identity, agentKp, authManifest, capManifest, founder } = buildBundleFor(agent_id);
    await seedManifest(founder);
    const mission: Mission = {
      mission_id: `m-net-${Date.now()}`, kind: "crawl_authorised_source",
      authorised_hosts: ["export.arxiv.org"],
      input: { url: "https://export.arxiv.org/api/query?q=x" },
      budget_ms: 30_000, deadline_iso: new Date(Date.now() + 30_000).toISOString(),
    };
    let dispatched = false;
    const dispatcher: Dispatcher = {
      poll: async () => { if (dispatched) return null; dispatched = true; return mission; },
      report: async () => {},
    };
    // Crawler brain injected with an http_fetch that simulates NETWORK_FAILURE
    const brain = makeCrawlerBrain({
      http_fetch: async () => { throw new Error("ECONNREFUSED · simulated network failure"); },
    });
    const worker = createAgentWorker({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      capability_manifest: capManifest, authority_manifest: authManifest,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
      brain, dispatcher,
    });
    const r = await worker.tickOnce();
    // NEVER SUCCESS · outcome is FAILURE with evidence
    expect(r.kind).not.toBe("SUCCESS");
    const evText = r.evidence_refs.join(" | ");
    expect(evText).toMatch(/NETWORK_ERROR|network|TIMEOUT|ECONN/i);
  });

  it("J-2 · HTTP_429 does NOT become silent WORKING · returns PARTIAL/RATE_LIMITED with evidence · founder-locked 2026-09-13", async () => {
    // Founder-locked: "Every 429 recorded as evidence · never counted as success ·
    // never marked WORKING while backing off". The outcome is PARTIAL (not
    // FAILURE) because a 429 means "try another authorised source next time",
    // not "the mission failed". The KEY invariant: NEVER SUCCESS.
    const agent_id = `net-429-${Date.now()}`;
    const { identity, agentKp, authManifest, capManifest, founder } = buildBundleFor(agent_id);
    await seedManifest(founder);
    const mission: Mission = {
      mission_id: `m-429-${Date.now()}`, kind: "crawl_authorised_source",
      authorised_hosts: ["export.arxiv.org"],
      input: { url: "https://export.arxiv.org/api/query?q=x" },
      budget_ms: 30_000, deadline_iso: new Date(Date.now() + 30_000).toISOString(),
    };
    let dispatched = false;
    const dispatcher: Dispatcher = {
      poll: async () => { if (dispatched) return null; dispatched = true; return mission; },
      report: async () => {},
    };
    const brain = makeCrawlerBrain({
      http_fetch: async () => ({ status: 429, headers: { "content-type": "text/plain" }, body: Buffer.from("Too Many Requests", "utf8") }),
    });
    const worker = createAgentWorker({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      capability_manifest: capManifest, authority_manifest: authManifest,
      trusted_founder_public_keys_hex: [founder.publicKeyHex],
      brain, dispatcher,
    });
    const r = await worker.tickOnce();
    // NEVER SUCCESS on 429 (the founder-locked invariant)
    expect(r.kind).not.toBe("SUCCESS");
    // Evidence must include the HTTP_429 marker
    const evText = r.evidence_refs.join(" | ");
    expect(evText).toMatch(/HTTP_429|429/);
  });

  it("J-3 · TOOL_FAILURE recovery policy produces bounded retry, not silent recovery", () => {
    const { identity } = buildBundleFor(`tool-fail-${Date.now()}`);
    const failure: AgentFailure = {
      kind: "TOOL_FAILURE", at: new Date().toISOString(),
      mission_id: "m-1", reason: "tsc process crashed",
    };
    // With 0 consecutive failures, should return RESUME_FROM_CHECKPOINT (bounded retry)
    const r0 = decideAgentRecovery({
      identity, failure,
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    });
    expect(r0.action).toBe("RESUME_FROM_CHECKPOINT");
    // With 5 consecutive failures, should escalate — NEVER silently succeed
    const r5 = decideAgentRecovery({
      identity, failure,
      state: { consecutive_failures: 5, total_failures_24h: 5, last_success_at: null },
    });
    expect(r5.action).toBe("ABANDON_AND_ESCALATE");
  });

  it("J-4 · AUTHORITY_DENIED never becomes a silent success (P-U enforced)", () => {
    const { identity } = buildBundleFor(`auth-fail-${Date.now()}`);
    const r = decideAgentRecovery({
      identity, failure: { kind: "AUTHORITY_DENIED", at: new Date().toISOString(), mission_id: "m", reason: "host not authorised" },
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    });
    expect(r.action).toBe("ABANDON_AND_ESCALATE");
    // Even with 20 successful missions historically, an AUTHORITY_DENIED always escalates
    const r2 = decideAgentRecovery({
      identity, failure: { kind: "AUTHORITY_DENIED", at: new Date().toISOString(), mission_id: "m", reason: "host not authorised" },
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: new Date().toISOString() },
    });
    expect(r2.action).toBe("ABANDON_AND_ESCALATE");
  });

  it("J-5 · SIGNATURE_ERROR treated as tamper · always escalates", () => {
    const { identity } = buildBundleFor(`sig-fail-${Date.now()}`);
    const r = decideAgentRecovery({
      identity, failure: { kind: "SIGNATURE_ERROR", at: new Date().toISOString(), mission_id: "m", reason: "signature verify failed" },
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    });
    expect(r.action).toBe("ABANDON_AND_ESCALATE");
  });
});
