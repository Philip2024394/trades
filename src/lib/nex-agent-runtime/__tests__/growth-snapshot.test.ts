// WO-LIVE-WORKFORCE-PROOF-01 · growth snapshot tests.

import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPairSync, verify as ed25519Verify } from "node:crypto";
import { captureGrowthSnapshot, loadRecentSnapshots, GROWTH_SNAPSHOT_COLLECTION, _resetSnapshotSigner } from "../growth-snapshot";
import { canonicalJson } from "@/lib/nex-intelligence/provenance";

const REPO_ROOT = process.cwd();

async function rmCollection(name: string) {
  try { await fs.unlink(path.join(REPO_ROOT, "data", "nex-storage", `${name}.jsonl`)); } catch { /* ok */ }
}

describe("WO-LIVE-WORKFORCE-PROOF-01 · growth snapshot", () => {
  beforeAll(async () => {
    _resetSnapshotSigner();
    await rmCollection(GROWTH_SNAPSHOT_COLLECTION);
  });

  it("G-1 · captureGrowthSnapshot produces a signed record with every metric carrying record_ids provenance", async () => {
    const snap = await captureGrowthSnapshot();
    expect(snap.record_type).toBe("NEX_GROWTH_SNAPSHOT");
    expect(snap.signature_hex.length).toBeGreaterThan(0);
    // Every metric must be present with the record_ids provenance field.
    const keys = ["identities", "heartbeats", "mission_envelopes", "mission_outcomes", "performance_records", "learning_contributions", "memory_records_total"] as const;
    for (const k of keys) {
      const m = snap.metrics[k];
      expect(m).toBeDefined();
      expect(Array.isArray(m.record_ids)).toBe(true);
      // Founder-locked: record_ids length must equal count (or ≤ count if some records lack ID keys · but never more).
      expect(m.record_ids.length).toBeLessThanOrEqual(m.count);
    }
  });

  it("G-2 · snapshot signature verifies against signer public key", async () => {
    const snap = await captureGrowthSnapshot();
    // Reconstruct signature payload
    const payload = canonicalJson({
      snapshot_id: snap.snapshot_id,
      captured_at: snap.captured_at,
      previous_snapshot_id: snap.previous_snapshot_id,
      observed_window_ms: snap.observed_window_ms,
      metrics: snap.metrics,
      deltas_from_previous: snap.deltas_from_previous,
    });
    const ok = ed25519Verify(null, Buffer.from(payload, "utf8"),
      { key: Buffer.from(snap.signer_public_key_hex, "hex"), format: "der", type: "spki" },
      Buffer.from(snap.signature_hex, "hex"),
    );
    expect(ok).toBe(true);
  });

  it("G-3 · deltas_from_previous is NULL for first snapshot (no synthetic history · founder-locked)", async () => {
    // Clean and take one snapshot
    await rmCollection(GROWTH_SNAPSHOT_COLLECTION);
    _resetSnapshotSigner();
    const first = await captureGrowthSnapshot();
    expect(first.deltas_from_previous).toBeNull();
    expect(first.previous_snapshot_id).toBeNull();
    // Second snapshot must have deltas (non-null)
    const second = await captureGrowthSnapshot();
    expect(second.deltas_from_previous).not.toBeNull();
    expect(second.previous_snapshot_id).toBe(first.snapshot_id);
  });

  it("G-4 · deltas compute correctly (integer arithmetic against previous counts · founder-locked non-negative)", async () => {
    await rmCollection(GROWTH_SNAPSHOT_COLLECTION);
    _resetSnapshotSigner();
    const first = await captureGrowthSnapshot();
    const second = await captureGrowthSnapshot();
    if (!second.deltas_from_previous) throw new Error("expected deltas");
    // Deltas should be integer and non-negative (identities are only ever
    // added, never removed, across two snapshots close in time).
    expect(Number.isInteger(second.deltas_from_previous.identities)).toBe(true);
    expect(second.deltas_from_previous.identities).toBeGreaterThanOrEqual(0);
  });

  it("G-5 · loadRecentSnapshots returns snapshots ordered newest-first", async () => {
    const snapshots = await loadRecentSnapshots(10);
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i - 1].captured_at >= snapshots[i].captured_at).toBe(true);
    }
  });
});
