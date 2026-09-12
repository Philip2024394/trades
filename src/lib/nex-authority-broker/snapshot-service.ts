// src/lib/nex-authority-broker/snapshot-service.ts
//
// Phase 8 v0.1.0 · Broker-owned pre-state snapshots.
// v0.1.0 T1: in-memory snapshot registry keyed by path · signed by Broker Ed25519.
// v0.1.0 T2 declared: NEX1 has ZERO write authority over snapshot storage · in-process trust boundary.
// T3 declared NOT_IMPLEMENTED: separate-process storage · DPAPI-encrypted at-rest.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import type { PreStateSnapshotEntry } from "../nex-controlled-hands/types";
import { signBytes, type KeyPair } from "../nex-controlled-hands/ed25519";

interface StoredSnapshot {
  readonly entry: PreStateSnapshotEntry;
  readonly bytes: Buffer | null;   // null when was_absent
}

export class SnapshotService {
  private snapshots = new Map<string, StoredSnapshot>();    // keyed by workspace-relative path

  constructor(private readonly signing_key: KeyPair) {}

  async capture(workspace_relative_path: string, workspace_root: string, at: string): Promise<PreStateSnapshotEntry> {
    if (this.snapshots.has(workspace_relative_path)) return this.snapshots.get(workspace_relative_path)!.entry;
    const abs = workspace_root + "/" + workspace_relative_path;
    let entry: PreStateSnapshotEntry;
    let bytes: Buffer | null = null;
    try {
      bytes = await fs.readFile(abs);
      const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const canonical = JSON.stringify({ path: workspace_relative_path, was_absent: false, sha256: sha, size: bytes.length, at });
      entry = {
        path: workspace_relative_path, was_absent: false, sha256: sha, size_bytes: bytes.length,
        captured_at: at, stored_at: `broker://snapshots/${workspace_relative_path}`,
        signature: signBytes(this.signing_key, canonical),
      };
    } catch (e) {
      if (/ENOENT/.test((e as Error).message)) {
        const canonical = JSON.stringify({ path: workspace_relative_path, was_absent: true, sha256: null, size: null, at });
        entry = {
          path: workspace_relative_path, was_absent: true, sha256: null, size_bytes: null,
          captured_at: at, stored_at: `broker://snapshots/${workspace_relative_path}`,
          signature: signBytes(this.signing_key, canonical),
        };
      } else throw e;
    }
    this.snapshots.set(workspace_relative_path, { entry, bytes });
    return entry;
  }

  get(workspace_relative_path: string): PreStateSnapshotEntry | undefined {
    return this.snapshots.get(workspace_relative_path)?.entry;
  }

  get_all_entries(): readonly PreStateSnapshotEntry[] {
    return Array.from(this.snapshots.values()).map((s) => s.entry);
  }

  manifest_hash(): string {
    const sorted = Array.from(this.snapshots.values()).map((s) => s.entry).sort((a, b) => a.path.localeCompare(b.path));
    const serial = sorted.map((e) => `${e.path}|${e.was_absent}|${e.sha256}|${e.size_bytes}`).join("\n");
    return createHash("sha256").update(serial).digest("hex").slice(0, 16);
  }

  // Rollback: restore each snapshotted file to its pre-state
  async rollback(workspace_root: string): Promise<{ restored: number; deleted: number; failures: readonly string[] }> {
    let restored = 0, deleted = 0;
    const failures: string[] = [];
    for (const [rel_path, s] of this.snapshots) {
      const abs = workspace_root + "/" + rel_path;
      try {
        if (s.entry.was_absent) {
          try { await fs.unlink(abs); deleted++; } catch (e) { if (!/ENOENT/.test((e as Error).message)) failures.push(rel_path + ":" + (e as Error).message); }
        } else if (s.bytes) {
          await fs.mkdir(abs.substring(0, abs.lastIndexOf("/")), { recursive: true });
          await fs.writeFile(abs, s.bytes);
          restored++;
        }
      } catch (e) { failures.push(rel_path + ":" + (e as Error).message); }
    }
    return { restored, deleted, failures };
  }
}
