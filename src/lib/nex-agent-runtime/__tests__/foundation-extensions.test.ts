// WO-AGENT-RUNTIME-01 · foundation-extension tests.
//
// Covers: authority-manifest sign/verify/enforce, performance-history
// round-trip, learning-contribution NO_EVIDENCE guard, recovery-policy
// decisions, runtime-loop tick with real brain + dispatcher.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";

import { generateAgentKeypair, createAgentIdentity, hashCapabilityManifest, hashAuthorityManifest } from "../identity";
import { buildAuthorityManifest, verifyAuthorityManifest, authorityPermits } from "../authority-manifest";
import { buildCapabilityManifest } from "../capability-manifest";
import { recordPerformance, queryPerformance, rollupPerformance, PERFORMANCE_HISTORY_COLLECTION } from "../performance-history";
import { emitLearningContribution, queryLearningContributions, LEARNING_CONTRIBUTION_COLLECTION } from "../learning-contribution";
import { decideAgentRecovery } from "../recovery-policy";
import { createAgentWorker, AGENT_HEARTBEAT_EVENT_COLLECTION, type Mission, type MissionResult, type Dispatcher } from "../runtime-loop";
import { agentMemoryCollectionName } from "../memory";
import type { AgentIdentity, AuthorityManifest, CapabilityManifest } from "../types";

const REPO_ROOT = process.cwd();

async function rmCollection(name: string): Promise<void> {
  try { await fs.unlink(path.join(REPO_ROOT, "data", "nex-storage", `${name}.jsonl`)); } catch { /* ok */ }
}

function founderKp(): { publicKeyHex: string; privateKeyHex: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

function buildTestBundle(agent_id: string, authOverrides: Partial<Parameters<typeof buildAuthorityManifest>[0]> = {}) {
  const agentKp = generateAgentKeypair();
  const founder = founderKp();
  const authManifest = buildAuthorityManifest({
    agent_id, runtime_version: "0.1.0",
    authorised_tools: authOverrides.authorised_tools ?? ["http_get", "parse_atom"],
    authorised_hosts: authOverrides.authorised_hosts ?? ["export.arxiv.org"],
    authorised_collections_read: authOverrides.authorised_collections_read ?? [],
    authorised_collections_write: authOverrides.authorised_collections_write ?? [],
    prohibited_actions: authOverrides.prohibited_actions ?? ["POST", "authorise", "modify-substrate"],
    founder_attestation_private_key_hex: founder.privateKeyHex,
  });
  const capManifest = buildCapabilityManifest({
    agent_id, runtime_version: "0.1.0", version: 1, specialist_domain: "test", facets: {},
    runtime_private_key_hex: agentKp.privateKeyHex,
  });
  const cap_hash = hashCapabilityManifest({
    record_type: "NEX_AGENT_CAPABILITY_MANIFEST", manifest_id: capManifest.manifest_id, agent_id, runtime_version: "0.1.0",
    version: 1, emitted_at: capManifest.emitted_at, facets: capManifest.facets, specialist_domain: "test",
  });
  const auth_hash = hashAuthorityManifest({
    record_type: "NEX_AGENT_AUTHORITY_MANIFEST", manifest_id: authManifest.manifest_id, agent_id, runtime_version: "0.1.0",
    authorised_tools: authManifest.authorised_tools,
    authorised_hosts: authManifest.authorised_hosts,
    authorised_collections_read: authManifest.authorised_collections_read,
    authorised_collections_write: authManifest.authorised_collections_write,
    prohibited_actions: authManifest.prohibited_actions,
    emitted_at: authManifest.emitted_at,
  });
  const identity = createAgentIdentity({
    agent_id, runtime_version: "0.1.0", agent_public_key_hex: agentKp.publicKeyHex,
    capability_manifest_hash: cap_hash, authority_manifest_hash: auth_hash,
    founder_attestation_private_key_hex: founder.privateKeyHex,
  });
  return { identity, agentKp, founder, authManifest, capManifest };
}

// ═════════════════════════════════════════════════════════════════════════
// AUTHORITY MANIFEST
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · authority manifest", () => {
  it("A-21 · founder-signed manifest verifies", () => {
    const { authManifest, founder } = buildTestBundle("test-auth-1");
    const r = verifyAuthorityManifest({ manifest: authManifest, trusted_founder_public_keys_hex: [founder.publicKeyHex] });
    expect(r.ok).toBe(true);
  });

  it("A-22 · manifest signed by wrong founder key is REJECTED", () => {
    const { authManifest } = buildTestBundle("test-auth-2");
    const otherFounder = founderKp();
    const r = verifyAuthorityManifest({ manifest: authManifest, trusted_founder_public_keys_hex: [otherFounder.publicKeyHex] });
    expect(r.ok).toBe(false);
    expect(r.rejection).toBe("WRONG_KEY");
  });

  it("A-23 · authorityPermits rejects unauthorised host (P-U runtime enforcement)", () => {
    const { authManifest } = buildTestBundle("test-auth-3");
    const p = authorityPermits({ manifest: authManifest, action: { kind: "host", value: "evil.example.com" } });
    expect(p.permitted).toBe(false);
  });

  it("A-24 · authorityPermits rejects prohibited action even if listed in authorised_tools", () => {
    const { authManifest } = buildTestBundle("test-auth-4", { authorised_tools: ["POST"], prohibited_actions: ["POST"] });
    const p = authorityPermits({ manifest: authManifest, action: { kind: "tool", value: "POST" } });
    expect(p.permitted).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// PERFORMANCE HISTORY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · performance history", () => {
  // Never rm the shared collection — parallel test files race on it.
  // Unique agent_id per test provides isolation.

  it("A-25 · recordPerformance + queryPerformance round-trip · signed by agent runtime key", async () => {
    const { identity, agentKp } = buildTestBundle(`test-perf-1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const rec = await recordPerformance({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      mission_id: "m-1", started_at: new Date(Date.now() - 5000).toISOString(),
      outcome: "SUCCESS", evidence_refs: ["ev-a", "ev-b"],
      items_processed: 3, compute_used_ms: 5000,
    });
    expect(rec.runtime_signature_hex.length).toBeGreaterThan(0);
    const q = await queryPerformance({ agent_id: rec.agent_id });
    expect(q.length).toBe(1);
    expect(q[0].mission_id).toBe("m-1");
    expect(q[0].items_processed).toBe(3);
  });

  it("A-26 · rollupPerformance aggregates deterministically · zero records = zero counts (no fabrication)", async () => {
    const empty = await rollupPerformance("test-perf-empty");
    expect(empty.total_missions).toBe(0);
    expect(empty.successes).toBe(0);
    expect(empty.total_items_processed).toBe(0);
    expect(empty.last_mission_at).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LEARNING CONTRIBUTION
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · learning contribution", () => {
  // Never rm the shared collection — parallel test files race on it.
  // Unique agent_id per test provides isolation.

  it("A-27 · emitLearningContribution REFUSES empty evidence_refs (NO EVIDENCE = NO CLAIM)", async () => {
    const { identity, agentKp } = buildTestBundle(`test-learn-1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const r = await emitLearningContribution({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      mission_id: "m-1", kind: "VALIDATED_LESSON",
      content: { note: "trying to fake learning" }, evidence_refs: [],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rejection).toBe("NO_EVIDENCE");
  });

  it("A-28 · emitLearningContribution accepts evidence-backed contribution · signed + persisted", async () => {
    const { identity, agentKp } = buildTestBundle(`test-learn-2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const r = await emitLearningContribution({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      mission_id: "m-1", kind: "NEW_PATTERN",
      content: { pattern: "arxiv atom feed produces 200 on cs.SE" },
      evidence_refs: ["ev-a", "ev-b"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const q = await queryLearningContributions(identity.agent_id);
    expect(q.length).toBe(1);
    expect(q[0].contribution_id).toBe(r.contribution.contribution_id);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// RECOVERY POLICY
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · recovery policy", () => {
  const { identity } = buildTestBundle("test-recovery");

  it("A-29 · AUTHORITY_DENIED always ABANDON_AND_ESCALATE (P-U)", () => {
    const r = decideAgentRecovery({
      identity, failure: { kind: "AUTHORITY_DENIED", at: new Date().toISOString(), mission_id: "m", reason: "host not authorised" },
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    });
    expect(r.action).toBe("ABANDON_AND_ESCALATE");
  });

  it("A-30 · SIGNATURE_ERROR always ABANDON_AND_ESCALATE (tamper defence)", () => {
    const r = decideAgentRecovery({
      identity, failure: { kind: "SIGNATURE_ERROR", at: new Date().toISOString(), mission_id: "m", reason: "sig fail" },
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    });
    expect(r.action).toBe("ABANDON_AND_ESCALATE");
  });

  it("A-31 · MEMORY_CORRUPTION enters QUARANTINE (do not touch memory until founder inspects)", () => {
    const r = decideAgentRecovery({
      identity, failure: { kind: "MEMORY_CORRUPTION", at: new Date().toISOString(), mission_id: null, reason: "hash mismatch" },
      state: { consecutive_failures: 0, total_failures_24h: 0, last_success_at: null },
    });
    expect(r.action).toBe("ENTER_QUARANTINE");
  });

  it("A-32 · 5 consecutive failures escalate", () => {
    const r = decideAgentRecovery({
      identity, failure: { kind: "TOOL_FAILURE", at: new Date().toISOString(), mission_id: "m", reason: "tool crash" },
      state: { consecutive_failures: 5, total_failures_24h: 5, last_success_at: null },
    });
    expect(r.action).toBe("ABANDON_AND_ESCALATE");
  });

  it("A-33 · transient NETWORK_FAILURE gets bounded backoff", () => {
    const r = decideAgentRecovery({
      identity, failure: { kind: "NETWORK_FAILURE", at: new Date().toISOString(), mission_id: "m", reason: "timeout" },
      state: { consecutive_failures: 1, total_failures_24h: 1, last_success_at: null },
    });
    expect(r.action).toBe("REEMIT_HEARTBEAT");
    expect(r.retry_delay_ms).toBeGreaterThan(0);
    expect(r.retry_delay_ms).toBeLessThanOrEqual(60_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// RUNTIME LOOP
// ═════════════════════════════════════════════════════════════════════════

describe("WO-AGENT-RUNTIME-01 · runtime loop", () => {
  const agent_id = `test-runtime-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const memoryColl = agentMemoryCollectionName(agent_id);
  // Only clean up per-agent memory (unique agent_id means no cross-test collision).
  // NEVER rm the shared collections during runs — parallel test files would race.
  afterEach(async () => { await rmCollection(memoryColl); });

  it("A-34 · idle tick with no mission emits pure-liveness heartbeat only", async () => {
    const { identity, agentKp, authManifest, capManifest } = buildTestBundle(agent_id);
    const dispatcher: Dispatcher = { poll: async () => null, report: async () => {} };
    const brain = async (): Promise<MissionResult> => ({ outcome: "SUCCESS", items_processed: 0, evidence_refs: [], summary: "not called" });
    const worker = createAgentWorker({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      capability_manifest: capManifest, authority_manifest: authManifest,
      brain, dispatcher,
    });
    const r = await worker.tickOnce();
    expect(r.kind).toBe("IDLE");
    expect(r.heartbeat_ids.length).toBeGreaterThan(0);   // liveness heartbeat emitted
  });

  it("A-35 · dispatched mission runs brain · emits signed progress heartbeats · records performance · writes memory", async () => {
    const { identity, agentKp, authManifest, capManifest } = buildTestBundle(agent_id);
    const mission: Mission = {
      mission_id: "m-run-1", kind: "test_mission",
      authorised_hosts: ["export.arxiv.org"], input: { q: "cs.SE" },
      budget_ms: 30_000, deadline_iso: new Date(Date.now() + 30_000).toISOString(),
    };
    let dispatched = false;
    const dispatcher: Dispatcher = {
      poll: async () => { if (dispatched) return null; dispatched = true; return mission; },
      report: async () => {},
    };
    const brain = async (m: Mission, ctx: Parameters<typeof createAgentWorker>[0]["brain"] extends (m: Mission, c: infer C) => Promise<MissionResult> ? C : never): Promise<MissionResult> => {
      // Emit 2 progress heartbeats with real evidence refs
      await ctx.emitProgress({ progress_counter: 1, last_completed_work: "step 1", evidence_refs: ["ev-1"] });
      await ctx.writeMemory({ kind: "LEARNED_PATTERN", mission_id: m.mission_id, content: { learned: "step 1 ok" } });
      await ctx.emitProgress({ progress_counter: 2, last_completed_work: "step 2", evidence_refs: ["ev-1", "ev-2"] });
      const learn = await ctx.contributeLearning({ kind: "VALIDATED_LESSON", content: { insight: "cs.SE feed reliable" }, evidence_refs: ["ev-1", "ev-2"] });
      expect(learn.ok).toBe(true);
      return { outcome: "SUCCESS", items_processed: 2, evidence_refs: ["ev-1", "ev-2"], summary: "processed 2 items" };
    };
    const worker = createAgentWorker({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      capability_manifest: capManifest, authority_manifest: authManifest,
      brain, dispatcher,
    });
    const r = await worker.tickOnce();
    expect(r.kind).toBe("SUCCESS");
    expect(r.heartbeat_ids.length).toBeGreaterThanOrEqual(3);   // ALIVE_NO_PROGRESS + 2 progress (+ final)
    expect(r.evidence_refs).toContain("ev-1");
    expect(r.evidence_refs).toContain("ev-2");
    // Performance record persisted
    const perf = await queryPerformance({ agent_id });
    expect(perf.length).toBe(1);
    expect(perf[0].outcome).toBe("SUCCESS");
    expect(perf[0].items_processed).toBe(2);
    // Learning contribution persisted
    const learns = await queryLearningContributions(agent_id);
    expect(learns.length).toBe(1);
  });

  it("A-36 · mission with UNAUTHORISED host is REFUSED · P-U runtime enforcement", async () => {
    const { identity, agentKp, authManifest, capManifest } = buildTestBundle(agent_id, { authorised_hosts: ["allowed.example.com"] });
    const mission: Mission = {
      mission_id: "m-authz-fail", kind: "test_mission",
      authorised_hosts: ["evil.example.com"],
      input: {}, budget_ms: 1000, deadline_iso: new Date(Date.now() + 1000).toISOString(),
    };
    let dispatched = false;
    const dispatcher: Dispatcher = {
      poll: async () => { if (dispatched) return null; dispatched = true; return mission; },
      report: async () => {},
    };
    const brainInvoked = { value: false };
    const brain = async (): Promise<MissionResult> => { brainInvoked.value = true; return { outcome: "SUCCESS", items_processed: 0, evidence_refs: [], summary: "should not run" }; };
    const worker = createAgentWorker({
      identity, runtime_private_key_hex: agentKp.privateKeyHex,
      capability_manifest: capManifest, authority_manifest: authManifest,
      brain, dispatcher,
    });
    const r = await worker.tickOnce();
    expect(r.kind).toBe("FAILURE");
    expect(brainInvoked.value).toBe(false);   // brain NEVER invoked when authority denied
    expect(r.reason).toMatch(/authority denied/);
  });
});
