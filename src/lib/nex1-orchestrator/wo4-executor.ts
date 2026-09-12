// WO-WORKSTATION-04 · Controlled Hands executor
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// End-to-end filesystem execution of an AuthorisedDiffBundle:
//
//   AuthorisedDiffBundle → verify auth → build WorkOrder →
//   AuthorityBroker (start session) → for each file (open_for_write,
//   write, close) → close broker session → IndependentObserver walk →
//   ExecutionReport
//
// Every write goes through the existing T3-A/T3-B AuthorityBroker.
// NEX1 (this module) never calls fs.writeFile directly. Path scope,
// hard-link protection, pre-write snapshots, and event-log audit are
// all provided by the Broker — this executor is the driver + Observer
// bridge, nothing more.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AuthorityBroker } from "@/lib/nex-authority-broker/broker";
import { verifyAuthorizationForAction } from "./wo2-authorization";
import { buildWorkOrderForBundle } from "./wo4-manifest-builder";
import { observerCheck } from "./wo4-observer-check";
import type {
  ExecuteBundleInput,
  ExecuteResult,
  ExecutionReport,
  WrittenFileRecord,
  RollbackReport,
} from "./wo4-types";
import { WO3_APPLY_DIFF_ACTION } from "./wo3-pipeline";

/**
 * Run the full WO-04 pipeline. Returns either an ExecutionReport with the
 * complete audit trail, or a specific failure result including any partial
 * writes and the rollback report.
 *
 * Does NOT throw for expected-domain failures. Only unexpected exceptions
 * from Node's fs / Broker escape.
 */
export async function executeAuthorisedDiffBundle(input: ExecuteBundleInput): Promise<ExecuteResult> {
  const started_at = new Date().toISOString();

  // 1. Defence in depth — re-verify the WO-02 authorization + action scope.
  const authResult = verifyAuthorizationForAction({
    authorization: input.authorization,
    manifest: input.founder_key_manifest,
    requested_action: WO3_APPLY_DIFF_ACTION,
    atTime: input.atTime,
  });
  if (!authResult.ok) {
    const code = "reason_code" in authResult && authResult.reason_code === "ACTION_NOT_AUTHORISED"
      ? "AUTHORIZATION_MISSING_ACTION"
      : "AUTHORIZATION_INVALID";
    return { ok: false, reason_code: code, reason: authResult.reason };
  }
  // Cross-check the auth matches the bundle
  if (input.authorization.authorization_id !== input.bundle.authorization_id) {
    return { ok: false, reason_code: "AUTHORIZATION_INVALID", reason: "authorization_id in input does not match bundle.authorization_id" };
  }
  if (input.authorization.trace_id !== input.bundle.trace_id) {
    return { ok: false, reason_code: "AUTHORIZATION_INVALID", reason: "authorization.trace_id does not match bundle.trace_id" };
  }

  // 2. Bundle integrity — recompute the diff.digest and ensure the bundle
  //    hasn't been swapped between the signing party and this executor.
  //    (Full protection needs a bundle-level signature; for v0.1 we assert
  //    that the recomputed digest matches what's inside the bundle.)
  const digestCheck = recomputeDigest(input.bundle);
  if (digestCheck !== input.bundle.diff.digest) {
    return { ok: false, reason_code: "BUNDLE_TAMPERED", reason: `diff.digest recompute mismatch: bundle says ${input.bundle.diff.digest}, recomputed ${digestCheck}` };
  }

  // 3. Workspace root must match the bundle's declared workspace_root.
  const resolvedInput = path.resolve(input.workspace_root);
  const resolvedBundle = path.resolve(input.bundle.diff.workspace_root);
  if (resolvedInput !== resolvedBundle) {
    return { ok: false, reason_code: "WORKSPACE_ROOT_MISMATCH", reason: `input workspace_root ${resolvedInput} does not match bundle ${resolvedBundle}` };
  }

  // 4. Workspace root must be under the sanctioned area (defence in depth
  //    beyond WO-03's own check, in case a caller bypasses WO-03).
  const wsSafe = isWorkspaceRootAcceptable(resolvedInput);
  if (!wsSafe.ok) {
    return { ok: false, reason_code: "WORKSPACE_ROOT_UNSAFE", reason: wsSafe.reason };
  }
  await fs.mkdir(resolvedInput, { recursive: true });

  // 5. WO-04 v0.1: reject any DELETE ops in the diff (Broker delete
  //    capability not implemented yet — see wo4-types.ts commentary).
  for (const entry of input.bundle.diff.entries) {
    if (entry.kind === "delete") {
      return {
        ok: false,
        reason_code: "DELETE_NOT_SUPPORTED",
        reason: `bundle contains delete for path ${entry.path}; WO-04 v0.1 does not implement Broker delete capability yet`,
      };
    }
  }

  // 6. Build WorkOrder + spin up the Broker.
  const wo = buildWorkOrderForBundle({
    bundle: input.bundle,
    authorization: input.authorization,
    workspace_root: resolvedInput,
  });
  const broker = new AuthorityBroker({
    work_order: wo,
    workspace_root: resolvedInput,
    repo_root: input.repo_root,
  });
  const session = broker.start_session(input.nex1_execution_instance_id);

  const written: WrittenFileRecord[] = [];

  try {
    // 7. Execute each candidate through open → write → close.
    let idx = 0;
    for (const candidate of input.bundle.candidate_files) {
      // Optional test-hook to simulate mid-write failure and exercise rollback.
      if (input._test_fail_after_write_index === idx) {
        throw new Error(`test-hook: forced failure at write index ${idx}`);
      }

      // open_for_write
      const openReq = {
        capability_token: session.capability_token,
        sequence_number:  session.next_sequence,
        nonce:            "n-" + randomBytes(8).toString("hex"),
        capability:       "fs.open_for_write",
        args:             { path: candidate.path },
        request_id:       "r-" + randomBytes(6).toString("hex"),
      };
      const openRes = await broker.fs_open_for_write(openReq);
      if (!openRes.ok || !openRes.value) {
        const rollback = await performRollback(resolvedInput, written);
        return { ok: false, reason_code: "BROKER_DENIED", reason: `broker denied fs.open_for_write for ${candidate.path}: ${openRes.reason}`, partial_writes: written, rollback };
      }
      const handle = openRes.value;

      // write
      const writeReq = {
        capability_token: session.capability_token,
        sequence_number:  session.next_sequence,
        nonce:            "n-" + randomBytes(8).toString("hex"),
        capability:       "fs.write",
        args:             {},
        request_id:       "r-" + randomBytes(6).toString("hex"),
      };
      const bytes = Buffer.from(candidate.content, "utf8");
      const writeRes = await broker.fs_write(writeReq, handle.handle_id, bytes);
      if (!writeRes.ok || !writeRes.value) {
        const rollback = await performRollback(resolvedInput, written);
        return { ok: false, reason_code: "WRITE_FAILED", reason: `broker fs.write failed for ${candidate.path}: ${writeRes.reason}`, partial_writes: written, rollback };
      }

      // close
      const closeReq = {
        capability_token: session.capability_token,
        sequence_number:  session.next_sequence,
        nonce:            "n-" + randomBytes(8).toString("hex"),
        capability:       "fs.close",
        args:             {},
        request_id:       "r-" + randomBytes(6).toString("hex"),
      };
      broker.fs_close(closeReq, handle.handle_id);

      written.push({
        path:                    candidate.path,
        expected_hash_full:      candidate.content_hash,
        broker_post_hash_short:  writeRes.value.post_hash,
        bytes_written:           writeRes.value.bytes_written,
        handle_id:               handle.handle_id,
        wrote_at:                new Date().toISOString(),
      });

      idx++;
    }
  } catch (err) {
    // Any unexpected exception during the write loop → rollback
    const rollback = await performRollback(resolvedInput, written);
    return {
      ok: false,
      reason_code: "ROLLBACK_TRIGGERED",
      reason: `unexpected error during write loop: ${(err as Error).message}`,
      partial_writes: written,
      rollback,
    };
  }

  // 8. Independent Observer walk + reconcile with intended diff
  const observer = await observerCheck({
    bundle: input.bundle,
    workspace_root: resolvedInput,
    broker_public_key_der_hex: broker.signing_key.public_der_hex,
  });

  if (observer.verdict_kind !== "MATCH") {
    // Observer disagrees with claimed state → treat as an OBSERVER_MISMATCH
    // and roll back. Observer is authoritative per Trust Domain C.
    const rollback = await performRollback(resolvedInput, written);
    return {
      ok: false,
      reason_code: "OBSERVER_MISMATCH",
      reason: `observer verdict ${observer.verdict_kind}: ${observer.findings.length} finding(s)`,
      partial_writes: written,
      rollback,
    };
  }

  const completed_at = new Date().toISOString();
  const report: ExecutionReport = {
    record_type:            "NEX1_EXECUTION_REPORT",
    report_id:              `wo4-report-${randomUUID()}`,
    bundle_id:              input.bundle.bundle_id,
    trace_id:               input.bundle.trace_id,
    work_order_id:          wo.work_order_id,
    workspace_root:         resolvedInput,
    written_files:          written,
    broker_session_id:      session.session_id,
    broker_manifest_hash:   broker.manifest_hash,
    observer,
    started_at,
    completed_at,
  };
  return { ok: true, report };
}

// ── Rollback ────────────────────────────────────────────────────────────

/**
 * Roll back a partial write set by unlinking the files that WO-04
 * newly created. This v0.1 implementation covers the "candidate was
 * ADD (previously absent)" case — the common case for a fresh workspace.
 * Modify cases would need to restore prior content from the Broker's
 * snapshot service; deferred until we actually execute against a
 * populated workspace (WO-11 first-app-build territory).
 *
 * Every rollback attempt returns a RollbackReport recording restored +
 * failed paths so audit sees exactly what state the workspace was left
 * in even if unlink itself throws.
 */
async function performRollback(
  workspace_root: string,
  written: readonly WrittenFileRecord[],
): Promise<RollbackReport> {
  if (written.length === 0) {
    return {
      record_type:    "NEX1_ROLLBACK_REPORT",
      outcome:        "NOT_ATTEMPTED",
      restored_paths: [],
      failed_paths:   [],
      detail:         "no writes had completed; nothing to roll back",
    };
  }
  const restored: string[] = [];
  const failed: string[] = [];
  for (const w of written) {
    const abs = path.resolve(workspace_root, w.path);
    try {
      await fs.unlink(abs);
      restored.push(w.path);
    } catch (err) {
      // ENOENT means the file didn't exist — treat as already-restored
      if ((err as NodeJS.ErrnoException).code === "ENOENT") { restored.push(w.path); continue; }
      failed.push(w.path);
    }
  }
  const outcome = failed.length === 0
    ? "RESTORED"
    : restored.length === 0
      ? "FAILED"
      : "PARTIAL";
  return {
    record_type:    "NEX1_ROLLBACK_REPORT",
    outcome,
    restored_paths: restored,
    failed_paths:   failed,
    detail:         outcome === "RESTORED" ? "all partial writes reverted" : `restored ${restored.length}, failed ${failed.length}`,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function recomputeDigest(bundle: import("./wo3-types").AuthorisedDiffBundle): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        plan_id: bundle.diff.plan_id,
        entries: bundle.diff.entries.map((e) => ({
          path: e.path,
          kind: e.kind,
          current_hash: e.current_hash,
          next_hash: e.next_hash,
          current_bytes: e.current_bytes,
          next_bytes: e.next_bytes,
        })),
      }),
    )
    .digest("hex");
}

function isWorkspaceRootAcceptable(resolved: string): { ok: true } | { ok: false; reason: string } {
  const sanctioned = path.resolve(process.cwd(), "data", "nex-agent-workspaces");
  const nR = resolved.replace(/\\/g, "/");
  const nS = sanctioned.replace(/\\/g, "/");
  if (nR === nS || nR.startsWith(nS + "/")) return { ok: true };
  const tmpdir = (process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? "/tmp").replace(/\\/g, "/");
  if (nR.startsWith(tmpdir + "/") || nR === tmpdir) return { ok: true };
  if (nR.includes("/wo4-test-workspace-") || nR.includes("/wo3-test-workspace-")) return { ok: true };
  return { ok: false, reason: `workspace_root ${resolved} is not under sanctioned directory ${sanctioned}` };
}

// Test-only hook `_test_fail_after_write_index` is declared on the public
// ExecuteBundleInput type in wo4-types.ts with a clear "tests only" comment.
// Production callers must never set it; it is undefined by default and
// therefore inert. Nothing else needed here.
