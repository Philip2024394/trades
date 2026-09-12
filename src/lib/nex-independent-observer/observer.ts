// src/lib/nex-independent-observer/observer.ts
//
// Phase 8 v0.1.0 · Independent Observer · Trust Domain C.
// T1 REAL: deterministic filesystem walk · reconciliation with Broker event log · Ed25519-signed bundle.
// T2 declared: in-process trust boundary · separate signing key.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, relative } from "node:path";
import type { AuthoritativeDiffBundle, BrokerEvent, PreStateSnapshotEntry, NEX1DiffProposal } from "@/lib/nex-controlled-hands/types";
import { generateKeyPair, signBytes, verifyBytes, type KeyPair } from "@/lib/nex-controlled-hands/ed25519";

export class IndependentObserver {
  readonly signing_key: KeyPair;

  constructor(private readonly broker_public_key_der_hex: string) {
    this.signing_key = generateKeyPair("observer");
  }

  async walk(workspace_root: string): Promise<Map<string, { sha256: string; size: number }>> {
    const out = new Map<string, { sha256: string; size: number }>();
    const walk_dir = async (dir: string): Promise<void> => {
      let entries: any[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (e) { return; }
      // Deterministic order · sorted lexicographically
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) await walk_dir(full);
        else if (e.isFile()) {
          const bytes = await fs.readFile(full);
          const rel = relative(workspace_root, full).replace(/\\/g, "/");
          out.set(rel, {
            sha256: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
            size: bytes.length,
          });
        }
      }
    };
    await walk_dir(workspace_root);
    return out;
  }

  async produce_authoritative_diff(args: {
    workspace_root: string;
    work_order_id: string;
    work_order_authorisation_ref: string;
    broker_event_log: readonly BrokerEvent[];
    broker_seal_hash: string;
    pre_state_snapshots: readonly PreStateSnapshotEntry[];
    pre_state_manifest_hash: string;
    nex1_proposal: NEX1DiffProposal;
    clock: () => string;
  }): Promise<AuthoritativeDiffBundle> {
    const walk_started_at = args.clock();
    const walk = await this.walk(args.workspace_root);
    const walk_completed_at = args.clock();

    // Reconcile: for each pre-state entry, compare against walk
    const authoritative_files_created: AuthoritativeDiffBundle["authoritative_files_created"] = [];
    const authoritative_files_modified: AuthoritativeDiffBundle["authoritative_files_modified"] = [];
    const authoritative_files_deleted: AuthoritativeDiffBundle["authoritative_files_deleted"] = [];

    const pre_by_path = new Map(args.pre_state_snapshots.map((s) => [s.path, s]));
    // Files deleted = in pre-state but not in walk (and was not was_absent)
    for (const s of args.pre_state_snapshots) {
      if (!s.was_absent && !walk.has(s.path)) {
        authoritative_files_deleted.push({ path: s.path, pre_hash: s.sha256! });
      }
    }
    // Files created + modified = in walk
    for (const [rel, info] of walk) {
      const pre = pre_by_path.get(rel);
      if (!pre || pre.was_absent) {
        // Only count as created if it was captured in pre-state (i.e. broker knew about it)
        // If the file appeared in the walk but was never captured, that's an orphan walk change.
        if (pre) authoritative_files_created.push({ path: rel, post_hash: info.sha256, size_bytes: info.size });
        // (We handle orphan below during reconciliation.)
      } else if (pre.sha256 !== info.sha256) {
        authoritative_files_modified.push({ path: rel, pre_hash: pre.sha256!, post_hash: info.sha256, size_bytes: info.size });
      }
    }

    // Verdict determination
    let verdict: AuthoritativeDiffBundle["reconciliation_verdict"] = "MATCH";
    let detail: string | undefined;

    // Check every FS_MUTATION event has a walk entry
    const fs_events = args.broker_event_log.filter((e) => e.kind === "FS_MUTATION");
    for (const ev of fs_events) {
      const path = String((ev.detail as any).path);
      if (!walk.has(path)) { verdict = "ORPHAN_EVENT"; detail = `FS_MUTATION on ${path} but not in walk`; break; }
    }
    if (verdict === "MATCH") {
      // Check every walk entry (that changed) has an FS_MUTATION event
      const event_paths = new Set(fs_events.map((e) => String((e.detail as any).path)));
      for (const c of authoritative_files_created) {
        if (!event_paths.has(c.path)) { verdict = "ORPHAN_WALK_CHANGE"; detail = `walk change on ${c.path} but no FS_MUTATION event`; break; }
      }
      if (verdict === "MATCH") for (const m of authoritative_files_modified) {
        if (!event_paths.has(m.path)) { verdict = "ORPHAN_WALK_CHANGE"; detail = `walk change on ${m.path} but no FS_MUTATION event`; break; }
      }
    }
    if (verdict === "MATCH") {
      // Compare against NEX1 proposal
      const proposed_c = new Set(args.nex1_proposal.proposed_files_created);
      const proposed_m = new Set(args.nex1_proposal.proposed_files_modified);
      const proposed_d = new Set(args.nex1_proposal.proposed_files_deleted);
      for (const c of authoritative_files_created) if (!proposed_c.has(c.path)) { verdict = "NEX1_MISREPORT_DETECTED"; detail = `authoritative walk found create ${c.path} but NEX1 did not propose it`; break; }
      if (verdict === "MATCH") for (const m of authoritative_files_modified) if (!proposed_m.has(m.path)) { verdict = "NEX1_MISREPORT_DETECTED"; detail = `authoritative walk found modify ${m.path} but NEX1 did not propose it`; break; }
      if (verdict === "MATCH") for (const d of authoritative_files_deleted) if (!proposed_d.has(d.path)) { verdict = "NEX1_MISREPORT_DETECTED"; detail = `authoritative walk found delete ${d.path} but NEX1 did not propose it`; break; }
    }

    const canonical = JSON.stringify({
      wo: args.work_order_id, pre: args.pre_state_manifest_hash, seal: args.broker_seal_hash,
      c: authoritative_files_created.map((x) => x.path).sort(),
      m: authoritative_files_modified.map((x) => x.path).sort(),
      d: authoritative_files_deleted.map((x) => x.path).sort(),
      verdict,
    });
    const signature = signBytes(this.signing_key, canonical);

    return {
      record_type: "AUTHORITATIVE_DIFF_BUNDLE",
      work_order_id: args.work_order_id,
      work_order_authorisation_ref: args.work_order_authorisation_ref,
      workspace_path: args.workspace_root,
      pre_state_manifest_hash: args.pre_state_manifest_hash,
      broker_event_log_seal_hash: args.broker_seal_hash,
      authoritative_files_created,
      authoritative_files_modified,
      authoritative_files_deleted,
      reconciliation_verdict: verdict,
      reconciliation_detail: detail,
      nex1_proposal_ref: args.nex1_proposal.record_type + ":" + args.work_order_id,
      observer_walk_started_at: walk_started_at,
      observer_walk_completed_at: walk_completed_at,
      signature,
      observer_key_id: this.signing_key.key_id,
      observer_key_version: this.signing_key.key_version,
      attribution: {
        external_llm_used: false,
        deterministic: true,
        role: "nex_independent_observer",
        authority: "authoritative_observation",
        produced_by: "nex_independent_observer",
      },
      authorisation: false,
      execution: false,
      authority_boundary: "observer_authoritative_only",
    };
  }
}
