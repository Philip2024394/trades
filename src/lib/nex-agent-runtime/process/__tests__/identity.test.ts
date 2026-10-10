// WO-NEX-RUNTIME-01 · identity module adversarial tests.
//
// Founder-locked 2026-09-13. Assertions:
//   - Fresh identity is generated only when explicitly allowed.
//   - Identity survives across load calls (same public key).
//   - Signed heartbeats verify against the matching public key.
//   - Forged heartbeats (any field mutated) fail signature verification.
//   - Wrong key rejects.
//   - Missing / corrupted / mismatched identity files fail-closed.
//   - createIfMissing=false NEVER silently regenerates.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import {
  createOrLoadIdentity,
  identityFile,
  identityDir,
  signHeartbeat,
  verifyHeartbeat,
  signEvidence,
  verifyEvidence,
  canonicaliseHeartbeat,
} from "../identity";
import type { AgentRuntimeHeartbeat, AgentEvidenceRecord } from "../types";

function tmpRepoRoot(): string {
  return path.join(process.cwd(), "data", "nex-agent-workspaces", `runtime01-identity-test-${randomUUID().slice(0, 12)}`);
}

async function nuke(p: string): Promise<void> {
  try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ok */ }
}

describe("WO-NEX-RUNTIME-01 · identity", () => {
  const cleanups: string[] = [];
  afterEach(async () => {
    while (cleanups.length) {
      const p = cleanups.pop();
      if (p) await nuke(p);
    }
  });

  it("I-1 · createOrLoad · fresh generates and persists to disk", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.freshly_generated).toBe(true);
    expect(r.identity.public_key_der_hex.length).toBeGreaterThan(0);
    const stat = await fs.stat(identityFile(root, "test-echo"));
    expect(stat.isFile()).toBe(true);
  });

  it("I-2 · load twice returns SAME public key (persistent identity)", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const a = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    const b = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.identity.public_key_der_hex).toBe(b.identity.public_key_der_hex);
      expect(b.freshly_generated).toBe(false);
    }
  });

  it("I-3 · createIfMissing=false refuses to auto-generate", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo", createIfMissing: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("IDENTITY_MISSING");
  });

  it("I-4 · corrupted file (empty) fails-closed · does NOT auto-regenerate", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    await fs.mkdir(identityDir(root, "test-echo"), { recursive: true });
    await fs.writeFile(identityFile(root, "test-echo"), "", "utf8");
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("IDENTITY_CORRUPTED");
  });

  it("I-5 · corrupted file (invalid JSON) fails-closed", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    await fs.mkdir(identityDir(root, "test-echo"), { recursive: true });
    await fs.writeFile(identityFile(root, "test-echo"), "not-json{{{\n", "utf8");
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("IDENTITY_CORRUPTED");
  });

  it("I-6 · agent_id mismatch in file · fail-closed", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const orig = await createOrLoadIdentity({ repoRoot: root, agent_id: "other-agent" });
    if (!orig.ok) throw new Error("setup failed");
    // Path where we'd load "test-echo" but content is for "other-agent"
    const wrongDir = identityDir(root, "test-echo");
    await fs.mkdir(wrongDir, { recursive: true });
    // Copy other-agent's file to test-echo's path
    const otherRaw = await fs.readFile(identityFile(root, "other-agent"), "utf8");
    await fs.writeFile(identityFile(root, "test-echo"), otherRaw, "utf8");
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("IDENTITY_MISMATCH");
  });

  it("I-7 · signed heartbeat verifies against agent public key", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    if (!r.ok) throw new Error("setup");
    const hbBase: Omit<AgentRuntimeHeartbeat, "signature_hex"> = {
      record_type: "NEX_AGENT_RUNTIME_HEARTBEAT",
      heartbeat_id: `hb-${randomUUID()}`,
      agent_id: "test-echo",
      instance_id: "inst-1",
      pid: 12345,
      emitted_at: new Date().toISOString(),
      mission_id: null,
      progress_counter: 0,
      evidence_refs: [],
      lifecycle_state: "ALIVE_IDLE",
    };
    const signed = signHeartbeat(r.identity, hbBase);
    expect(verifyHeartbeat(r.identity.public_key_der_hex, signed)).toBe(true);
  });

  it("I-8 · forged heartbeat (progress_counter mutated) · signature INVALID", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    if (!r.ok) throw new Error("setup");
    const hbBase: Omit<AgentRuntimeHeartbeat, "signature_hex"> = {
      record_type: "NEX_AGENT_RUNTIME_HEARTBEAT",
      heartbeat_id: `hb-${randomUUID()}`,
      agent_id: "test-echo",
      instance_id: "inst-1",
      pid: 12345,
      emitted_at: new Date().toISOString(),
      mission_id: null,
      progress_counter: 0,
      evidence_refs: [],
      lifecycle_state: "ALIVE_IDLE",
    };
    const signed = signHeartbeat(r.identity, hbBase);
    // Attacker mutates progress but keeps signature
    const forged: AgentRuntimeHeartbeat = { ...signed, progress_counter: 999 };
    expect(verifyHeartbeat(r.identity.public_key_der_hex, forged)).toBe(false);
  });

  it("I-9 · forged heartbeat signed by WRONG key · rejected against real identity key", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const real = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    if (!real.ok) throw new Error("setup");
    // Attacker generates their OWN keypair · signs a "test-echo" heartbeat
    const { publicKey: attackerPub, privateKey: attackerPriv } = generateKeyPairSync("ed25519");
    const hbBase: Omit<AgentRuntimeHeartbeat, "signature_hex"> = {
      record_type: "NEX_AGENT_RUNTIME_HEARTBEAT",
      heartbeat_id: `hb-${randomUUID()}`,
      agent_id: "test-echo",
      instance_id: "inst-attacker",
      pid: 6666,
      emitted_at: new Date().toISOString(),
      mission_id: null,
      progress_counter: 0,
      evidence_refs: [],
      lifecycle_state: "ALIVE_IDLE",
    };
    const attackerSig = (await import("node:crypto")).sign(null, canonicaliseHeartbeat(hbBase), attackerPriv).toString("hex");
    const forged: AgentRuntimeHeartbeat = { ...hbBase, signature_hex: attackerSig };
    // Verify against REAL agent's public key · MUST reject
    expect(verifyHeartbeat(real.identity.public_key_der_hex, forged)).toBe(false);
    // Sanity: attacker's own key WOULD verify (proves the payload+sig math is right)
    const attackerPubHex = (attackerPub.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
    expect(verifyHeartbeat(attackerPubHex, forged)).toBe(true);
  });

  it("I-10 · signed evidence verifies against agent public key", async () => {
    const root = tmpRepoRoot();
    cleanups.push(root);
    const r = await createOrLoadIdentity({ repoRoot: root, agent_id: "test-echo" });
    if (!r.ok) throw new Error("setup");
    const evBase: Omit<AgentEvidenceRecord, "signature_hex"> = {
      record_type: "NEX_AGENT_EVIDENCE",
      evidence_id: `ev-${randomUUID()}`,
      agent_id: "test-echo",
      instance_id: "inst-1",
      mission_id: "mission-1",
      emitted_at: new Date().toISOString(),
      kind: "echo.reply",
      payload: { message: "hello" },
    };
    const signed = signEvidence(r.identity, evBase);
    expect(verifyEvidence(r.identity.public_key_der_hex, signed)).toBe(true);
    // Mutated payload → invalid
    const forged: AgentEvidenceRecord = { ...signed, payload: { message: "attacker replaced" } };
    expect(verifyEvidence(r.identity.public_key_der_hex, forged)).toBe(false);
  });
});
