// WO-NEX-RUNTIME-01 · agent identity: create, load, sign, verify.
//
// Founder-locked 2026-09-13. RUNTIME-01-only: plain PKCS8 JSONL under
// data/nex-agent-runtime/identities/<agent_id>/keypair.jsonl,
// protected by filesystem ACL. RUNTIME-08 upgrades this to DPAPI /
// libsecret / hardware-backed custody. Hard boundary: this key signs
// only agent-side records (heartbeats + evidence + audit) · it CANNOT
// approve workstation mutation.

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as ed25519Sign,
  verify as ed25519Verify,
  type KeyObject,
} from "node:crypto";
import type {
  AgentIdentityRecord,
  AgentRuntimeHeartbeat,
  AgentEvidenceRecord,
} from "./types";

// ── Persistence layout ─────────────────────────────────────────────────

export function identityDir(repoRoot: string, agent_id: string): string {
  return path.join(repoRoot, "data", "nex-agent-runtime", "identities", agent_id);
}

export function identityFile(repoRoot: string, agent_id: string): string {
  return path.join(identityDir(repoRoot, agent_id), "keypair.jsonl");
}

// ── On-disk shape ──────────────────────────────────────────────────────

interface OnDiskIdentity {
  readonly agent_id: string;
  readonly private_key_pkcs8_der_hex: string;   // Ed25519 private key
  readonly public_key_spki_der_hex: string;     // matching public key
  readonly created_at: string;
  readonly notes: string;
}

/** In-memory identity handle used by the daemon at runtime. */
export interface AgentIdentity {
  readonly agent_id: string;
  readonly private: KeyObject;
  readonly public: KeyObject;
  readonly public_key_der_hex: string;
  readonly created_at: string;
}

// ── Create or load ─────────────────────────────────────────────────────

export interface CreateOrLoadOptions {
  readonly repoRoot: string;
  readonly agent_id: string;
  /** If true (default) and no identity exists on disk, generate a fresh
   *  keypair and persist it. If false, throw when missing. Adversarial
   *  test relies on the false path (corrupted / missing identity must
   *  refuse to start · never auto-generate a replacement silently). */
  readonly createIfMissing?: boolean;
}

export type LoadIdentityResult =
  | { ok: true; identity: AgentIdentity; freshly_generated: boolean }
  | { ok: false; reason_code: "IDENTITY_MISSING" | "IDENTITY_CORRUPTED" | "IDENTITY_MISMATCH"; reason: string };

export async function createOrLoadIdentity(opts: CreateOrLoadOptions): Promise<LoadIdentityResult> {
  const dir = identityDir(opts.repoRoot, opts.agent_id);
  const file = identityFile(opts.repoRoot, opts.agent_id);

  // Try to read existing
  let raw: string | null = null;
  try { raw = await fs.readFile(file, "utf8"); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      return { ok: false, reason_code: "IDENTITY_CORRUPTED", reason: `read failed: ${(e as Error).message}` };
    }
  }

  if (raw !== null) {
    // Parse existing
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return { ok: false, reason_code: "IDENTITY_CORRUPTED", reason: "identity file exists but is empty" };
    }
    let parsed: OnDiskIdentity;
    try {
      // JSONL — one record; take the first non-empty line
      const line = trimmed.split(/\r?\n/).find((l) => l.trim().length > 0);
      if (!line) throw new Error("no non-empty line");
      parsed = JSON.parse(line) as OnDiskIdentity;
    } catch (e) {
      return { ok: false, reason_code: "IDENTITY_CORRUPTED", reason: `parse failed: ${(e as Error).message}` };
    }
    if (parsed.agent_id !== opts.agent_id) {
      return { ok: false, reason_code: "IDENTITY_MISMATCH", reason: `on-disk identity is for agent_id "${parsed.agent_id}" but caller asked for "${opts.agent_id}"` };
    }
    try {
      const privateKey = createPrivateKey({
        key: Buffer.from(parsed.private_key_pkcs8_der_hex, "hex"),
        format: "der", type: "pkcs8",
      });
      const publicKey = createPublicKey({
        key: Buffer.from(parsed.public_key_spki_der_hex, "hex"),
        format: "der", type: "spki",
      });
      // Sanity: private and public must be a matching pair
      const testPayload = Buffer.from("identity-pair-check", "utf8");
      const testSig = ed25519Sign(null, testPayload, privateKey);
      const ok = ed25519Verify(null, testPayload, publicKey, testSig);
      if (!ok) {
        return { ok: false, reason_code: "IDENTITY_CORRUPTED", reason: "private/public key on disk do not form a valid Ed25519 pair" };
      }
      return {
        ok: true, freshly_generated: false,
        identity: {
          agent_id: parsed.agent_id,
          private: privateKey,
          public: publicKey,
          public_key_der_hex: parsed.public_key_spki_der_hex,
          created_at: parsed.created_at,
        },
      };
    } catch (e) {
      return { ok: false, reason_code: "IDENTITY_CORRUPTED", reason: `key materialisation failed: ${(e as Error).message}` };
    }
  }

  // Not found · maybe generate
  if (opts.createIfMissing === false) {
    return { ok: false, reason_code: "IDENTITY_MISSING", reason: `no identity file at ${file}` };
  }

  // Generate fresh
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const private_hex = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex");
  const public_hex = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex");
  const created_at = new Date().toISOString();
  const record: OnDiskIdentity = {
    agent_id: opts.agent_id,
    private_key_pkcs8_der_hex: private_hex,
    public_key_spki_der_hex: public_hex,
    created_at,
    notes: "generated by createOrLoadIdentity · RUNTIME-01 · NOT execution authority",
  };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(record) + "\n", { encoding: "utf8", mode: 0o600 });
  return {
    ok: true, freshly_generated: true,
    identity: {
      agent_id: opts.agent_id, private: privateKey, public: publicKey,
      public_key_der_hex: public_hex, created_at,
    },
  };
}

// ── Canonical payload serialisers ──────────────────────────────────────

/** Canonical bytes of a heartbeat MINUS the signature field. Ordered
 *  keys, deterministic JSON. */
export function canonicaliseHeartbeat(hb: Omit<AgentRuntimeHeartbeat, "signature_hex">): Buffer {
  const ordered = {
    record_type: hb.record_type,
    heartbeat_id: hb.heartbeat_id,
    agent_id: hb.agent_id,
    instance_id: hb.instance_id,
    pid: hb.pid,
    emitted_at: hb.emitted_at,
    mission_id: hb.mission_id,
    progress_counter: hb.progress_counter,
    evidence_refs: [...hb.evidence_refs],
    lifecycle_state: hb.lifecycle_state,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function canonicaliseEvidence(ev: Omit<AgentEvidenceRecord, "signature_hex">): Buffer {
  const ordered = {
    record_type: ev.record_type,
    evidence_id: ev.evidence_id,
    agent_id: ev.agent_id,
    instance_id: ev.instance_id,
    mission_id: ev.mission_id,
    emitted_at: ev.emitted_at,
    kind: ev.kind,
    payload: ev.payload,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

// ── Sign + verify ──────────────────────────────────────────────────────

export function signHeartbeat(identity: AgentIdentity, hb: Omit<AgentRuntimeHeartbeat, "signature_hex">): AgentRuntimeHeartbeat {
  const sig = ed25519Sign(null, canonicaliseHeartbeat(hb), identity.private);
  return { ...hb, signature_hex: sig.toString("hex") };
}

export function verifyHeartbeat(publicKeyDerHex: string, hb: AgentRuntimeHeartbeat): boolean {
  try {
    const pub = createPublicKey({
      key: Buffer.from(publicKeyDerHex, "hex"),
      format: "der", type: "spki",
    });
    return ed25519Verify(null, canonicaliseHeartbeat(hb), pub, Buffer.from(hb.signature_hex, "hex"));
  } catch { return false; }
}

export function signEvidence(identity: AgentIdentity, ev: Omit<AgentEvidenceRecord, "signature_hex">): AgentEvidenceRecord {
  const sig = ed25519Sign(null, canonicaliseEvidence(ev), identity.private);
  return { ...ev, signature_hex: sig.toString("hex") };
}

export function verifyEvidence(publicKeyDerHex: string, ev: AgentEvidenceRecord): boolean {
  try {
    const pub = createPublicKey({
      key: Buffer.from(publicKeyDerHex, "hex"),
      format: "der", type: "spki",
    });
    return ed25519Verify(null, canonicaliseEvidence(ev), pub, Buffer.from(ev.signature_hex, "hex"));
  } catch { return false; }
}

// ── Publish identity record ────────────────────────────────────────────

export function toPublishableIdentity(identity: AgentIdentity, notes = "RUNTIME-01 · agent identity · NOT execution authority"): AgentIdentityRecord {
  return {
    record_type: "NEX_AGENT_IDENTITY",
    agent_id: identity.agent_id,
    public_key_der_hex: identity.public_key_der_hex,
    created_at: identity.created_at,
    notes,
  };
}
