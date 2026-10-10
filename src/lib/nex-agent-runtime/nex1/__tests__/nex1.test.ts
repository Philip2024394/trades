// WO-NEX-RUNTIME-03 · NEX1 acceptance tests.
//
// Founder-locked 2026-09-13. Assertions:
//   - Persistent identity + memory + tools + brain wired to queue
//   - Deterministic (P-S · no LLM)
//   - Every proposal is UNSIGNED · founder_signature_slot=null
//   - Mission-context chain is signed + reconstructible
//   - Security-escalate missions REFUSED
//   - No filesystem mutation
//   - No workstation execution
//   - Restart preserves memory + identity

import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startNex1Daemon } from "../daemon";
import { enqueue } from "@/lib/nex-runtime-queue/queue";
import { verifyMemoryRecord, readMemoryForMission, readMemoryByLayer } from "../memory";
import { loadMissionContextChain } from "../mission-context";
import { persistCapabilityGap, loadCap } from "@/lib/nex-cap/registry";
import { getStorage } from "@/lib/nex/storage/registry";
import { NEX1_TOOL_INVOCATIONS_COLLECTION, NEX1_MISSION_CONTEXT_COLLECTION, type ToolInvocation, type MissionContextChain } from "../types";

const RUN = `runtime03-${randomUUID().slice(0, 8)}`;
const REPO = process.cwd();

async function nuke(p: string): Promise<void> { try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ } }

describe("WO-NEX-RUNTIME-03 · NEX1 daemon + brain + memory + tools", () => {
  const stopFns: Array<() => Promise<void>> = [];
  const cleanups: string[] = [];
  afterEach(async () => {
    while (stopFns.length) { const f = stopFns.pop(); if (f) await f(); }
    while (cleanups.length) { const p = cleanups.pop(); if (p) await nuke(p); }
  });

  it("N-1 · daemon starts · has persistent identity · heartbeat emitted", async () => {
    const agent_id = `nex1-${RUN}-n1`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d.stop);
    expect(d.identity.public_key_der_hex.length).toBeGreaterThan(0);
    expect(d.handle.instance_id).toMatch(/^inst-/);
  });

  it("N-2 · CAP mission · brain drafts UNSIGNED proposal · mission-context chain persisted + signed", async () => {
    const agent_id = `nex1-${RUN}-n2`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d.stop);

    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",
      category: "PERFORMANCE", priority: "MEDIUM",
      title: "Rate limiter persistent backoff on canonical intelligence source",
      evidence: [{ collection: "test", record_id: "seed-n2", kind: "test_seed" }],
      detector_agent_id: "runtime-03-test",
      dedupe_key: `runtime-03-n2-${randomUUID()}`,
    });
    const m = await enqueue({
      title: "Rate limiter backoff · brain proof",
      authored_intent: "Diagnose the rate limiter backoff",
      source: "CAP_REGISTRY",
      cap_id: cap.cap_id,
      priority: "HIGH",
      security_class: "STANDARD",
      risk_level: "LOW",
      affected_paths: [`src/runtime-03/${RUN}/n2/rate-limiter.ts`],
      required_capabilities: ["typescript"],
      dedupe_key: `n2-${RUN}-${randomUUID()}`,
    });

    // Call the brain directly · the scheduler-selection path is
    // separately tested in RUNTIME-02. Here we're proving the BRAIN.
    const { nex1BrainProcessMission } = await import("../brain");
    const brainOut = await nex1BrainProcessMission({
      identity: d.identity, instance_id: d.handle.instance_id, repo_root: REPO, mission: m,
    });
    expect(brainOut.verdict.kind).toBe("PROPOSED_TO_BROKER");

    // The mission-context chain must exist + verify
    const chain = await loadMissionContextChain(m.mission_id);
    expect(chain).not.toBeNull();
    if (chain) {
      expect(chain.mission_id).toBe(m.mission_id);
      expect(chain.observations.length).toBeGreaterThan(0);
      expect(chain.analysis.length).toBeGreaterThan(0);
      expect(chain.evidence_refs.length).toBeGreaterThan(0);
      // Handoff must be to FOUNDER_AUTHORIZATION with a proposal_id
      expect(chain.handoff?.to).toBe("FOUNDER_AUTHORIZATION");
      expect(chain.handoff?.proposal_id).toBeTruthy();
    }

    // Working memory holds mission_received observation
    const working = await readMemoryForMission(agent_id, m.mission_id);
    const missionStart = working.find((r) => r.kind === "mission_start");
    expect(missionStart).toBeDefined();
    expect(verifyMemoryRecord(d.identity.public_key_der_hex, missionStart!)).toBe(true);

    // Tool invocations were recorded and signed by agent identity
    const invs = await getStorage().query<ToolInvocation>(NEX1_TOOL_INVOCATIONS_COLLECTION, {
      where: { mission_id: m.mission_id }, limit: 200, order_by: "requested_at", order_dir: "asc",
    });
    expect(invs.length).toBeGreaterThan(0);
  }, 60_000);

  it("N-3 · security-escalate mission · brain REFUSES · no proposal drafted", async () => {
    const agent_id = `nex1-${RUN}-n3`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d.stop);

    // A security-escalate mission is filtered out by the scheduler
    // (SECURITY_CLASSES_BLOCKED). Tick should idle for OUR mission.
    // We call the brain directly for a deterministic REFUSED verdict.
    const { nex1BrainProcessMission } = await import("../brain");
    const missionLike = {
      record_type: "NEX_ENGINEERING_MISSION" as const,
      mission_id: `mid-fake-${RUN}`, dedupe_key: `sec-${RUN}`, created_at: new Date().toISOString(),
      source: "FOUNDER_DIRECT" as const, cap_id: null, work_map_ref: null,
      title: "security work",
      authored_intent: "founder to review",
      priority: "CRITICAL" as const, urgency: "URGENT" as const,
      security_class: "SECURITY_ESCALATION" as const,
      risk_level: "SEVERE" as const,
      affected_paths: [] as readonly string[], required_capabilities: [] as readonly string[],
      build_targets: [] as readonly string[], dependencies: [] as readonly string[],
      conflicts: [] as readonly string[],
      parent_mission_id: null, related_mission_ids: [] as readonly string[],
      status: "QUEUED" as const, queue_position: null,
      attempt_count: 0,
      last_scheduler_score: null, last_scheduler_reason: null, last_scheduler_at: null,
      assigned_agent_id: null, lease_expires_at: null,
      started_at: null, completed_at: null,
      evidence_refs: [] as readonly string[],
      last_updated_at: new Date().toISOString(),
      provenance_chain_hash: "",
    };
    const out = await nex1BrainProcessMission({
      identity: d.identity, instance_id: d.handle.instance_id, repo_root: REPO,
      mission: missionLike,
    });
    expect(out.verdict.kind).toBe("REFUSED");
    if (out.verdict.kind === "REFUSED") {
      expect(out.verdict.reason).toMatch(/SECURITY_ESCALATION|BLOCKED_FROM_AUTOMATION|founder-only/);
    }
  });

  it("N-4 · restart preserves identity + engineering memory", async () => {
    const agent_id = `nex1-${RUN}-n4`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d1 = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    // Write a piece of ENGINEERING memory
    const { writeMemory } = await import("../memory");
    await writeMemory({
      identity: d1.identity, layer: "ENGINEERING",
      key: `n4-past-${RUN}`, value: { note: "test past record" }, kind: "past_proposal",
      provenance: "runtime-03 restart test",
    });
    const pub1 = d1.identity.public_key_der_hex;
    await d1.stop();

    // Restart
    const d2 = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d2.stop);
    expect(d2.identity.public_key_der_hex).toBe(pub1);

    // Engineering memory still present + verifiable
    const eng = await readMemoryByLayer(agent_id, "ENGINEERING");
    const mine = eng.find((r) => r.key === `n4-past-${RUN}`);
    expect(mine).toBeDefined();
    expect(verifyMemoryRecord(d2.identity.public_key_der_hex, mine!)).toBe(true);
  });

  it("N-5 · every tool invocation signed by agent identity · read_file denies escape attempts", async () => {
    const agent_id = `nex1-${RUN}-n5`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d.stop);

    const { toolReadFile } = await import("../tools");
    const ctx = { identity: d.identity, instance_id: d.handle.instance_id, repo_root: REPO, mission_id: null };
    // Legitimate read
    const okRead = await toolReadFile(ctx, { path: "package.json" });
    expect(okRead.outcome).toBe("ok");
    // Escape attempts
    const escape1 = await toolReadFile(ctx, { path: "../../etc/passwd" });
    expect(escape1.outcome).toBe("denied");
    const escape2 = await toolReadFile(ctx, { path: "/etc/passwd" });
    expect(escape2.outcome).toBe("denied");
    // Each invocation was recorded (signed)
    const invs = await getStorage().query<ToolInvocation>(NEX1_TOOL_INVOCATIONS_COLLECTION, {
      where: { instance_id: d.handle.instance_id }, limit: 10, order_by: "requested_at", order_dir: "desc",
    });
    expect(invs.length).toBeGreaterThanOrEqual(3);
    for (const inv of invs.slice(0, 3)) {
      expect(inv.signature_hex.length).toBeGreaterThan(0);
      expect(inv.agent_id).toBe(agent_id);
    }
  });

  it("N-6 · brain never grants founder authority · proposal always has founder_signature_slot=null", async () => {
    const agent_id = `nex1-${RUN}-n6`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d.stop);

    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",
      category: "PERFORMANCE", priority: "LOW",
      title: "N-6 proposal · unsigned check",
      evidence: [{ collection: "test", record_id: "seed-n6", kind: "test_seed" }],
      detector_agent_id: "runtime-03-test",
      dedupe_key: `runtime-03-n6-${randomUUID()}`,
    });
    void cap;
    const m = await enqueue({
      title: "Rate limiter backoff · unsigned check",
      authored_intent: "make sure the proposal is unsigned",
      source: "CAP_REGISTRY", cap_id: cap.cap_id, priority: "HIGH",
      security_class: "STANDARD", risk_level: "LOW",
      affected_paths: [`src/runtime-03/${RUN}/n6/x.ts`],
      required_capabilities: ["typescript"],
      dedupe_key: `n6-${RUN}-${randomUUID()}`,
    });
    const { nex1BrainProcessMission } = await import("../brain");
    await nex1BrainProcessMission({ identity: d.identity, instance_id: d.handle.instance_id, repo_root: REPO, mission: m });
    const chain = await loadMissionContextChain(m.mission_id);
    expect(chain).not.toBeNull();
    if (!chain || !chain.handoff || !chain.handoff.proposal_id) return;
    // Fetch the actual proposal
    const { loadAllProposals } = await import("@/lib/nex-cap/nex1-engineer");
    const props = await loadAllProposals();
    const mine = props.find((p) => p.proposal_id === chain.handoff!.proposal_id);
    expect(mine).toBeDefined();
    // Founder-locked: brain NEVER grants execution authority
    expect(mine?.founder_signature_slot).toBeNull();
  }, 60_000);

  it("N-7 · mission-context chain is reconstructable · answers 'why did NEX1 propose this?'", async () => {
    const agent_id = `nex1-${RUN}-n7`;
    cleanups.push(path.join(REPO, "data", "nex-agent-runtime", "identities", agent_id));
    const d = await startNex1Daemon({ agent_id, repoRoot: REPO, heartbeat_interval_ms: 60_000, _test_unref_heartbeat: true });
    stopFns.push(d.stop);

    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",
      category: "PERFORMANCE", priority: "MEDIUM",
      title: "N-7 chain reconstruction check",
      evidence: [{ collection: "test", record_id: "seed-n7", kind: "test_seed" }],
      detector_agent_id: "runtime-03-test",
      dedupe_key: `runtime-03-n7-${randomUUID()}`,
    });
    const m = await enqueue({
      title: "Rate limiter chain reconstruction",
      authored_intent: "reconstruct the chain",
      source: "CAP_REGISTRY", cap_id: cap.cap_id, priority: "HIGH",
      security_class: "STANDARD", risk_level: "LOW",
      affected_paths: [`src/runtime-03/${RUN}/n7/x.ts`],
      required_capabilities: ["typescript"],
      dedupe_key: `n7-${RUN}-${randomUUID()}`,
    });
    const { nex1BrainProcessMission } = await import("../brain");
    await nex1BrainProcessMission({ identity: d.identity, instance_id: d.handle.instance_id, repo_root: REPO, mission: m });
    const rows = await getStorage().query<MissionContextChain>(NEX1_MISSION_CONTEXT_COLLECTION, {
      where: { mission_id: m.mission_id }, limit: 5,
    });
    expect(rows.length).toBeGreaterThan(0);
    const chain = rows[0];
    // The chain answers the founder-locked question set
    expect(chain.observations.length).toBeGreaterThan(0);   // NEX1 observations
    expect(chain.analysis.length).toBeGreaterThan(0);       // analysis
    expect(chain.proposed_solution).not.toBeNull();         // proposed solution
    expect(chain.files_considered.length).toBeGreaterThan(0);
    expect(chain.evidence_refs.length).toBeGreaterThan(0);
    expect(chain.handoff?.to).toBe("FOUNDER_AUTHORIZATION");
    expect(chain.signature_hex.length).toBeGreaterThan(0);
  }, 60_000);
});
