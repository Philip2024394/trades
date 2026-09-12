// GET /api/nex1/controlled-hands/self-test
// Phase 8 v0.1.0 · adversarial harness · REAL EXECUTION · not spec-claim.
// Runs cases that are provable in-process at implementation-tier T1.
// Cases that require T3 real OS sandbox are declared NOT_TESTED_IN_V0_1_0 honestly.

import { NextResponse } from "next/server";
import { promises as fs, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { AuthorityBroker } from "@/lib/nex-authority-broker/broker";
import { IndependentObserver } from "@/lib/nex-independent-observer/observer";
import { WorkOrderComplianceVerifier } from "@/lib/nex-work-order-compliance-verifier/verifier";
import { NEX1CapabilityClient, execute_nex1_master_engineer } from "@/lib/nex1-master-engineer/execution-entry";
import { canonicalisePath, is_hard_link_to_protected, default_protected_paths_absolute } from "@/lib/nex-controlled-hands/path-security";
import { verifyBytes, loadPublicKeyFromDerHex } from "@/lib/nex-controlled-hands/ed25519";
import type { WorkOrder, CapabilityManifest } from "@/lib/nex-controlled-hands/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case { id: string; ok: boolean; detail: string; denial_class?: string; }

function make_manifest(wo_id: string, workspace_rel: string): CapabilityManifest {
  return {
    manifest_id: "WOM-" + wo_id,
    work_order_id: wo_id,
    founder_authorisation_ref: "FA-" + wo_id,
    write_root: workspace_rel,
    read_roots: [workspace_rel],
    protected_paths: [],
    read_denylist: [],
    allowed_processes: [{
      entry_id: "node-test", executable_identity: "node", executable_absolute_path: "node",
      arguments_policy: { kind: "whitelist", value: ["--test"] },
      working_directory_policy: workspace_rel,
      environment_policy: {},
      resource_limits: { cpu_ms_max: 30000, memory_bytes_max: 536870912, wall_ms_max: 60000, fd_max: 128 },
      network_policy: "DENY", stdio_policy: "captured", child_process_policy: "DENY",
    }],
    allowed_environment: { NODE_ENV: "test" },
    network_policy: "DENY",
    resource_limits: { cpu_ms_max: 60000, memory_bytes_max: 1073741824, wall_ms_max: 120000, fd_max: 256, total_write_bytes_max: 10485760, process_count_max: 8 },
    iteration_limit: 5,
    timeout_seconds: 300,
    snapshot_policy: { capture_before_every_write: true, retention_after_rollback: "always", retention_after_reject: "always", retention_after_accept: "founder_authored" },
    ipc_policy: { request_rate_limit: 1000, session_timeout_seconds: 300, max_request_size_bytes: 65536, capability_token_ttl_seconds: 300 },
    interpretation_authority: { allow: [] },
    founder_authorisation_signature: "STUB-FA-SIG-" + wo_id,
  };
}

async function make_workspace(wo_id: string): Promise<string> {
  const ws = resolve(process.cwd(), ".nex", "workspaces", wo_id);
  await fs.mkdir(ws, { recursive: true });
  return ws;
}

async function cleanup_workspace(ws: string): Promise<void> {
  try { await fs.rm(ws, { recursive: true, force: true }); } catch {}
}

async function make_broker_setup(wo_id: string) {
  const workspace_root = await make_workspace(wo_id);
  const manifest = make_manifest(wo_id, workspace_root);
  const work_order: WorkOrder = {
    work_order_id: wo_id,
    user_objective: "Phase 8 v0.1.0 adversarial test fixture",
    acceptance_criteria: [{ requirement_id: "R1", criterion_text: "must create workspace/foo.ts", mechanical_check: "created:foo.ts" }],
    capability_manifest: manifest,
    rollback_reference: "rb-" + wo_id,
    expiry: new Date(Date.now() + 3600_000).toISOString(),
  };
  const broker = new AuthorityBroker({ work_order, workspace_root, repo_root: process.cwd(), clock: () => new Date().toISOString() });
  const client = new NEX1CapabilityClient(broker, () => new Date().toISOString());
  client.start("inst-" + randomBytes(4).toString("hex"));
  return { workspace_root, broker, client, work_order };
}

export async function GET() {
  const cases: Case[] = [];
  const run = async (id: string, fn: () => Promise<{ ok: boolean; detail: string; denial_class?: string }>) => {
    try { cases.push({ id, ...(await fn()) }); }
    catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); }
  };

  // ===== Path security · canonicalisation =====

  await run("PS.canonicalisation.reject-double-dot", async () => {
    const ws = resolve(process.cwd(), ".nex", "workspaces", "ps1");
    const r = canonicalisePath("../../etc/passwd", ws);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly allowed" : (r.reason ?? "") };
  });

  await run("PS.canonicalisation.reject-UNC-prefix", async () => {
    const ws = resolve(process.cwd(), ".nex", "workspaces", "ps2");
    const r = canonicalisePath("\\\\?\\C:\\Windows\\System32", ws);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly allowed" : (r.reason ?? "") };
  });

  await run("PS.canonicalisation.reject-alt-data-stream", async () => {
    const ws = resolve(process.cwd(), ".nex", "workspaces", "ps3");
    const r = canonicalisePath("foo.txt:secret", ws);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly allowed" : (r.reason ?? "") };
  });

  await run("PS.canonicalisation.reject-trailing-dot", async () => {
    const ws = resolve(process.cwd(), ".nex", "workspaces", "ps4");
    const r = canonicalisePath("weird./foo.txt", ws);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly allowed" : (r.reason ?? "") };
  });

  await run("PS.canonicalisation.reject-bidi-control", async () => {
    const ws = resolve(process.cwd(), ".nex", "workspaces", "ps5");
    const r = canonicalisePath("foo‮txt.bar", ws);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly allowed" : (r.reason ?? "") };
  });

  await run("PS.canonicalisation.accept-workspace-relative", async () => {
    const ws = resolve(process.cwd(), ".nex", "workspaces", "ps6");
    const r = canonicalisePath("src/foo.ts", ws);
    return { ok: r.ok === true, detail: r.ok ? r.canonical! : (r.reason ?? "") };
  });

  // ===== Broker capability enforcement =====

  await run("BROKER.write-inside-workspace-granted", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-b1");
    const r = await client.open_for_write("foo.ts");
    if (!r.ok) return { ok: false, detail: `unexpected denial: ${r.reason}` };
    const w = await client.write(r.handle_id!, "export const x = 1;");
    client.close(r.handle_id!);
    await cleanup_workspace(workspace_root);
    return { ok: w.ok, detail: w.ok ? `granted · post_hash=${w.post_hash}` : (w.reason ?? "") };
  });

  await run("BROKER.write-outside-workspace-denied", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-b2");
    const r = await client.open_for_write("../../src/lib/nex-evidence-engine/types.ts");
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly granted" : (r.reason ?? ""), denial_class: "BROKER_CAPABILITY_DENIAL" };
  });

  await run("BROKER.write-mandatory-exclusion-denied", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-b3");
    // Even if boundary permitted, mandatory exclusion beats it
    const target = "../../../docs/DECISIONS/x.md";
    const r = await client.open_for_write(target);
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly granted" : (r.reason ?? ""), denial_class: "BROKER_CAPABILITY_DENIAL" };
  });

  await run("BROKER.read-inside-workspace-granted", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-b4");
    await fs.writeFile(join(workspace_root, "readme.txt"), "hello", "utf8");
    const r = await client.open_for_read("readme.txt");
    await cleanup_workspace(workspace_root);
    return { ok: r.ok, detail: r.ok ? "granted" : (r.reason ?? "") };
  });

  await run("BROKER.read-env-file-denied", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-b5");
    const r = await client.open_for_read("../../../.env");
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly granted" : (r.reason ?? ""), denial_class: "BROKER_CAPABILITY_DENIAL" };
  });

  await run("BROKER.read-git-internals-denied", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-b6");
    const r = await client.open_for_read("../../../.git/config");
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok, detail: r.ok ? "unexpectedly granted" : (r.reason ?? ""), denial_class: "BROKER_CAPABILITY_DENIAL" };
  });

  // ===== IPC contract =====

  await run("IPC.sequence-number-monotonic", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-ipc1");
    // Craft a request with the wrong sequence number by reaching into internals · simulate replay
    const goodOpen = await client.open_for_write("a.ts");
    const sess = broker.get_session()!;
    // Replay by re-issuing a request with a previously-used sequence number
    const badReq = {
      capability_token: sess.capability_token,
      sequence_number: 1,  // already consumed
      nonce: "nonce-replay-" + Date.now(),
      capability: "fs.open_for_write",
      args: { path: "b.ts" },
      request_id: "req-replay-" + Date.now(),
    };
    const r = await broker.fs_open_for_write(badReq);
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok, detail: r.ok ? "replay unexpectedly succeeded" : (r.reason ?? ""), denial_class: r.denial_class };
  });

  await run("IPC.wrong-capability-token-denied", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-ipc2");
    const sess = broker.get_session()!;
    const badReq = {
      capability_token: "cap-forged-" + randomBytes(4).toString("hex"),
      sequence_number: sess.next_sequence,
      nonce: "nonce-" + Date.now(),
      capability: "fs.open_for_write",
      args: { path: "x.ts" },
      request_id: "req-" + Date.now(),
    };
    const r = await broker.fs_open_for_write(badReq);
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok, detail: r.reason ?? "", denial_class: r.denial_class };
  });

  await run("IPC.nonce-replay-denied", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-ipc3");
    // First: a legitimate open
    const r1 = await client.open_for_write("a.ts");
    if (!r1.ok) { await cleanup_workspace(workspace_root); return { ok: false, detail: "setup failed" }; }
    // Second: replay the SAME nonce via direct broker call
    const sess = broker.get_session()!;
    // Extract a used nonce · we can't observe it directly · instead we replay with an artificially reused nonce and expect denial via other checks
    // For this test: reuse a specific-looking nonce twice
    const forced_nonce = "nonce-fixed-replay-test";
    const req_first: any = { capability_token: sess.capability_token, sequence_number: sess.next_sequence, nonce: forced_nonce, capability: "fs.open_for_write", args: { path: "b.ts" }, request_id: "r1" };
    const r_first = await broker.fs_open_for_write(req_first);
    const req_second: any = { capability_token: sess.capability_token, sequence_number: sess.next_sequence, nonce: forced_nonce, capability: "fs.open_for_write", args: { path: "c.ts" }, request_id: "r2" };
    const r_second = await broker.fs_open_for_write(req_second);
    await cleanup_workspace(workspace_root);
    return { ok: r_first.ok && !r_second.ok, detail: `first=${r_first.ok} second=${r_second.ok} reason=${r_second.reason}`, denial_class: r_second.denial_class };
  });

  // ===== Workspace freeze =====

  await run("FREEZE.no-writes-after-handover", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-fz1");
    await client.open_for_write("a.ts");   // consume sequence
    const ho = client.handover();
    if (!ho.ok) { await cleanup_workspace(workspace_root); return { ok: false, detail: `handover failed: ${ho.reason}` }; }
    // Now try to write · should be refused
    const r = await client.open_for_write("b.ts");
    await cleanup_workspace(workspace_root);
    return { ok: !r.ok && /frozen/i.test(r.reason ?? ""), detail: r.reason ?? "" };
  });

  await run("FREEZE.event-log-sealed", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-fz2");
    await client.open_for_write("a.ts");
    client.handover();
    const seal = broker.event_log.get_seal_hash();
    await cleanup_workspace(workspace_root);
    return { ok: seal !== null && seal.length > 0, detail: `seal=${seal}` };
  });

  // ===== Snapshot service =====

  await run("SNAPSHOT.pre-state-captured-before-write", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-sn1");
    await fs.writeFile(join(workspace_root, "existing.ts"), "original", "utf8");
    const open = await client.open_for_write("existing.ts");
    const snap = broker.snapshot_service.get("existing.ts");
    await cleanup_workspace(workspace_root);
    return { ok: snap !== undefined && snap.was_absent === false && snap.size_bytes === 8, detail: `snap=${JSON.stringify(snap)?.slice(0, 100)}` };
  });

  await run("SNAPSHOT.was-absent-recorded-for-new-file", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-sn2");
    const open = await client.open_for_write("brand-new.ts");
    const snap = broker.snapshot_service.get("brand-new.ts");
    await cleanup_workspace(workspace_root);
    return { ok: snap !== undefined && snap.was_absent === true, detail: `was_absent=${snap?.was_absent}` };
  });

  await run("SNAPSHOT.manifest-hash-deterministic", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-sn3");
    await client.open_for_write("a.ts");
    await client.open_for_write("b.ts");
    const h1 = broker.snapshot_service.manifest_hash();
    const h2 = broker.snapshot_service.manifest_hash();
    await cleanup_workspace(workspace_root);
    return { ok: h1 === h2 && h1.length === 16, detail: `h=${h1}` };
  });

  await run("SNAPSHOT.rollback-restores-original", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-sn4");
    await fs.writeFile(join(workspace_root, "existing.ts"), "ORIGINAL", "utf8");
    const open = await client.open_for_write("existing.ts");
    await client.write(open.handle_id!, "MUTATED");
    client.close(open.handle_id!);
    // Verify mutation happened
    const post = await fs.readFile(join(workspace_root, "existing.ts"), "utf8");
    if (post !== "MUTATED") { await cleanup_workspace(workspace_root); return { ok: false, detail: `pre-rollback: ${post}` }; }
    // Rollback
    const r = await broker.snapshot_service.rollback(workspace_root);
    const restored = await fs.readFile(join(workspace_root, "existing.ts"), "utf8");
    await cleanup_workspace(workspace_root);
    return { ok: restored === "ORIGINAL" && r.restored >= 1, detail: `restored=${r.restored} deleted=${r.deleted} content=${restored}` };
  });

  await run("SNAPSHOT.rollback-deletes-created-files", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-sn5");
    const open = await client.open_for_write("new.ts");
    await client.write(open.handle_id!, "NEW");
    client.close(open.handle_id!);
    const created = await fs.readFile(join(workspace_root, "new.ts"), "utf8");
    if (created !== "NEW") { await cleanup_workspace(workspace_root); return { ok: false, detail: "creation failed" }; }
    const r = await broker.snapshot_service.rollback(workspace_root);
    const exists = existsSync(join(workspace_root, "new.ts"));
    await cleanup_workspace(workspace_root);
    return { ok: !exists && r.deleted >= 1, detail: `deleted=${r.deleted} still_exists=${exists}` };
  });

  // ===== Event log =====

  await run("EVENTLOG.chain-hash-verifies", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-el1");
    await client.open_for_write("a.ts");
    await client.open_for_write("b.ts");
    const valid = broker.event_log.verify_chain();
    await cleanup_workspace(workspace_root);
    return { ok: valid === true, detail: `verify=${valid} entries=${broker.event_log.size()}` };
  });

  await run("EVENTLOG.every-entry-signed-by-broker", async () => {
    const { workspace_root, broker, client } = await make_broker_setup("wo-el2");
    await client.open_for_write("a.ts");
    await cleanup_workspace(workspace_root);
    const pubKey = loadPublicKeyFromDerHex(broker.signing_key.public_der_hex);
    const entries = broker.event_log.get_all();
    let allSigned = true;
    for (const e of entries) {
      const canonical = JSON.stringify({ prev: e.prev_chain_hash, seq: e.entry_sequence, kind: e.kind, detail: e.detail, at: e.at });
      if (!verifyBytes(pubKey, canonical, e.signature)) { allSigned = false; break; }
    }
    return { ok: allSigned && entries.length > 0, detail: `entries=${entries.length} allSigned=${allSigned}` };
  });

  // ===== Observer =====

  await run("OBSERVER.walk-independent-and-deterministic", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-ob1");
    const open = await client.open_for_write("foo.ts");
    await client.write(open.handle_id!, "export const x = 1;");
    client.close(open.handle_id!);
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const w1 = await observer.walk(workspace_root);
    const w2 = await observer.walk(workspace_root);
    const sig1 = Array.from(w1.entries()).sort().map(([k, v]) => `${k}:${v.sha256}`).join("|");
    const sig2 = Array.from(w2.entries()).sort().map(([k, v]) => `${k}:${v.sha256}`).join("|");
    await cleanup_workspace(workspace_root);
    return { ok: sig1 === sig2 && w1.size === 1, detail: `sig1=${sig1.slice(0, 80)}` };
  });

  await run("OBSERVER.reconciliation-detects-nex1-misreport", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-ob2");
    const open = await client.open_for_write("foo.ts");
    await client.write(open.handle_id!, "actual");
    client.close(open.handle_id!);
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    // NEX1 misreport: says it created bar.ts but really created foo.ts
    const false_proposal: any = {
      record_type: "NEX1_DIFF_PROPOSAL",
      work_order_id: work_order.work_order_id,
      proposed_files_created: ["bar.ts"],   // WRONG
      proposed_files_modified: [], proposed_files_deleted: [],
      self_critique: { verdict: "SUBMIT_WITH_CONFIDENCE", reasoning: "x", counter_argument: "x", counter_argument_addressed: "x" },
      interpretation: "LITERAL", iterations_used: 1,
      attribution: { external_llm_used: false, deterministic: true, role: "nex1_master_engineer", authority: "advisory_only", produced_by: "nex1_master_engineer" },
      at: new Date().toISOString(),
    };
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-test",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: false_proposal,
      clock: () => new Date().toISOString(),
    });
    await cleanup_workspace(workspace_root);
    return { ok: bundle.reconciliation_verdict === "NEX1_MISREPORT_DETECTED", detail: `verdict=${bundle.reconciliation_verdict} detail=${bundle.reconciliation_detail ?? ""}` };
  });

  await run("OBSERVER.reconciliation-matches-honest-proposal", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-ob3");
    const open = await client.open_for_write("honest.ts");
    await client.write(open.handle_id!, "content");
    client.close(open.handle_id!);
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const honest_proposal: any = {
      record_type: "NEX1_DIFF_PROPOSAL", work_order_id: work_order.work_order_id,
      proposed_files_created: ["honest.ts"], proposed_files_modified: [], proposed_files_deleted: [],
      self_critique: { verdict: "SUBMIT_WITH_CONFIDENCE", reasoning: "x", counter_argument: "x", counter_argument_addressed: "x" },
      interpretation: "LITERAL", iterations_used: 1,
      attribution: { external_llm_used: false, deterministic: true, role: "nex1_master_engineer", authority: "advisory_only", produced_by: "nex1_master_engineer" },
      at: new Date().toISOString(),
    };
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-test",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: honest_proposal,
      clock: () => new Date().toISOString(),
    });
    await cleanup_workspace(workspace_root);
    return { ok: bundle.reconciliation_verdict === "MATCH" && bundle.authoritative_files_created.length === 1, detail: `verdict=${bundle.reconciliation_verdict}` };
  });

  await run("OBSERVER.bundle-signed-by-observer-key", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-ob4");
    const open = await client.open_for_write("foo.ts");
    await client.write(open.handle_id!, "x");
    client.close(open.handle_id!);
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const proposal: any = {
      record_type: "NEX1_DIFF_PROPOSAL", work_order_id: work_order.work_order_id,
      proposed_files_created: ["foo.ts"], proposed_files_modified: [], proposed_files_deleted: [],
      self_critique: { verdict: "SUBMIT_WITH_CONFIDENCE", reasoning: "x", counter_argument: "x", counter_argument_addressed: "x" },
      interpretation: "LITERAL", iterations_used: 1,
      attribution: { external_llm_used: false, deterministic: true, role: "nex1_master_engineer", authority: "advisory_only", produced_by: "nex1_master_engineer" },
      at: new Date().toISOString(),
    };
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-test",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: proposal, clock: () => new Date().toISOString(),
    });
    const pubKey = loadPublicKeyFromDerHex(observer.signing_key.public_der_hex);
    const canonical = JSON.stringify({
      wo: bundle.work_order_id, pre: bundle.pre_state_manifest_hash, seal: bundle.broker_event_log_seal_hash,
      c: bundle.authoritative_files_created.map((x) => x.path).sort(),
      m: bundle.authoritative_files_modified.map((x) => x.path).sort(),
      d: bundle.authoritative_files_deleted.map((x) => x.path).sort(),
      verdict: bundle.reconciliation_verdict,
    });
    const valid = verifyBytes(pubKey, canonical, bundle.signature);
    await cleanup_workspace(workspace_root);
    return { ok: valid, detail: `signature_verifies=${valid}` };
  });

  // ===== Compliance Verifier =====

  await run("VERIFIER.compliant-happy-path", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-vf1");
    const open = await client.open_for_write("foo.ts");
    await client.write(open.handle_id!, "x");
    client.close(open.handle_id!);
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const proposal: any = {
      record_type: "NEX1_DIFF_PROPOSAL", work_order_id: work_order.work_order_id,
      proposed_files_created: ["foo.ts"], proposed_files_modified: [], proposed_files_deleted: [],
      self_critique: { verdict: "SUBMIT_WITH_CONFIDENCE", reasoning: "x", counter_argument: "x", counter_argument_addressed: "x" },
      interpretation: "LITERAL", iterations_used: 1,
      attribution: { external_llm_used: false, deterministic: true, role: "nex1_master_engineer", authority: "advisory_only", produced_by: "nex1_master_engineer" },
      at: new Date().toISOString(),
    };
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-test",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: proposal, clock: () => new Date().toISOString(),
    });
    const verifier = new WorkOrderComplianceVerifier();
    const verdict = verifier.verify({
      work_order, manifest_hash: broker.manifest_hash, authoritative_diff: bundle,
      broker_event_log: broker.event_log.get_all(), nex1_proposal: proposal,
      clock: () => new Date().toISOString(),
    });
    await cleanup_workspace(workspace_root);
    return { ok: verdict.verdict === "COMPLIANT" || verdict.verdict === "REQUIRED_TEST_NOT_EXECUTED", detail: `verdict=${verdict.verdict}` };
  });

  await run("VERIFIER.interpretation-without-decision-fails", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-vf2");
    const open = await client.open_for_write("foo.ts");
    await client.write(open.handle_id!, "x");
    client.close(open.handle_id!);
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const proposal: any = {
      record_type: "NEX1_DIFF_PROPOSAL", work_order_id: work_order.work_order_id,
      proposed_files_created: ["foo.ts"], proposed_files_modified: [], proposed_files_deleted: [],
      self_critique: { verdict: "SUBMIT_WITH_CONFIDENCE", reasoning: "x", counter_argument: "x", counter_argument_addressed: "x" },
      interpretation: { kind: "PROPOSED_INTERPRETATION", text: "founder actually wanted X" },   // no authority_layer_decision_id
      iterations_used: 1,
      attribution: { external_llm_used: false, deterministic: true, role: "nex1_master_engineer", authority: "advisory_only", produced_by: "nex1_master_engineer" },
      at: new Date().toISOString(),
    };
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-test",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: proposal, clock: () => new Date().toISOString(),
    });
    const verifier = new WorkOrderComplianceVerifier();
    const verdict = verifier.verify({
      work_order, manifest_hash: broker.manifest_hash, authoritative_diff: bundle,
      broker_event_log: broker.event_log.get_all(), nex1_proposal: proposal,
      clock: () => new Date().toISOString(),
    });
    await cleanup_workspace(workspace_root);
    return { ok: verdict.verdict === "INTERPRETATION_AUTHORITY_EXCEEDED", detail: `verdict=${verdict.verdict}` };
  });

  await run("VERIFIER.process-not-on-allowlist-fails", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-vf3");
    // Broker records a process spawn with an unauthorized entry_id
    broker.event_log.append("PROCESS_SPAWNED", { entry_id: "bad-entry", args: [] }, new Date().toISOString());
    const open = await client.open_for_write("foo.ts");
    await client.write(open.handle_id!, "x");
    client.close(open.handle_id!);
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const proposal: any = {
      record_type: "NEX1_DIFF_PROPOSAL", work_order_id: work_order.work_order_id,
      proposed_files_created: ["foo.ts"], proposed_files_modified: [], proposed_files_deleted: [],
      self_critique: { verdict: "SUBMIT_WITH_CONFIDENCE", reasoning: "x", counter_argument: "x", counter_argument_addressed: "x" },
      interpretation: "LITERAL", iterations_used: 1,
      attribution: { external_llm_used: false, deterministic: true, role: "nex1_master_engineer", authority: "advisory_only", produced_by: "nex1_master_engineer" },
      at: new Date().toISOString(),
    };
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-test",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: proposal, clock: () => new Date().toISOString(),
    });
    const verifier = new WorkOrderComplianceVerifier();
    const verdict = verifier.verify({
      work_order, manifest_hash: broker.manifest_hash, authoritative_diff: bundle,
      broker_event_log: broker.event_log.get_all(), nex1_proposal: proposal,
      clock: () => new Date().toISOString(),
    });
    await cleanup_workspace(workspace_root);
    return { ok: verdict.verdict === "PROCESS_NOT_ON_ALLOWLIST", detail: `verdict=${verdict.verdict}` };
  });

  // ===== Full end-to-end =====

  await run("E2E.happy-path-complete", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-e2e1");
    const result = await execute_nex1_master_engineer({
      input: {
        work_order_id: work_order.work_order_id,
        proposed_file_actions: [{ kind: "create", path: "foo.ts", content: "export const x = 1;" }],
      },
      client, clock: () => new Date().toISOString(),
    });
    if (result.denials > 0) { await cleanup_workspace(workspace_root); return { ok: false, detail: `denials=${result.denials} · ${result.denial_reasons.join(",")}` }; }
    client.handover();
    const observer = new IndependentObserver(broker.signing_key.public_der_hex);
    const bundle = await observer.produce_authoritative_diff({
      workspace_root, work_order_id: work_order.work_order_id, work_order_authorisation_ref: "FA-e2e",
      broker_event_log: broker.event_log.get_all(),
      broker_seal_hash: broker.event_log.get_seal_hash() ?? "",
      pre_state_snapshots: broker.snapshot_service.get_all_entries(),
      pre_state_manifest_hash: broker.snapshot_service.manifest_hash(),
      nex1_proposal: result.proposal, clock: () => new Date().toISOString(),
    });
    const verifier = new WorkOrderComplianceVerifier();
    const verdict = verifier.verify({
      work_order, manifest_hash: broker.manifest_hash, authoritative_diff: bundle,
      broker_event_log: broker.event_log.get_all(), nex1_proposal: result.proposal,
      clock: () => new Date().toISOString(),
    });
    await cleanup_workspace(workspace_root);
    return {
      ok: bundle.reconciliation_verdict === "MATCH" && (verdict.verdict === "COMPLIANT" || verdict.verdict === "REQUIRED_TEST_NOT_EXECUTED"),
      detail: `bundle=${bundle.reconciliation_verdict} · compliance=${verdict.verdict}`,
    };
  });

  await run("E2E.rollback-restores-workspace", async () => {
    const { workspace_root, broker, client, work_order } = await make_broker_setup("wo-e2e2");
    await execute_nex1_master_engineer({
      input: { work_order_id: work_order.work_order_id, proposed_file_actions: [{ kind: "create", path: "will-be-rolled-back.ts", content: "delete me" }] },
      client, clock: () => new Date().toISOString(),
    });
    const before_rollback = existsSync(join(workspace_root, "will-be-rolled-back.ts"));
    const r = await broker.snapshot_service.rollback(workspace_root);
    const after_rollback = existsSync(join(workspace_root, "will-be-rolled-back.ts"));
    await cleanup_workspace(workspace_root);
    return { ok: before_rollback && !after_rollback && r.deleted >= 1, detail: `before=${before_rollback} after=${after_rollback} deleted=${r.deleted}` };
  });

  // ===== Not-tested-in-v0.1.0 declarations (T3 NOT_IMPLEMENTED · honest) =====

  const NOT_TESTED_T3 = [
    "T3.pre-existing-writable-handle-survives-freeze (requires real OS process termination · v0.1.0 in-process)",
    "T3.inherited-privileged-handle (requires real spawn with bInheritHandle=FALSE)",
    "T3.descendant-cmd-exe-block (requires Windows Job Object)",
    "T3.dependency-lifecycle-npm-install (requires real read-only node_modules mount)",
    "T3.hard-link-created-by-outside-actor (requires filesystem-level link creation NEX1 can't perform)",
    "T3.child-process-tree-inheritance (requires real Job Object breakaway control)",
    "T3.real-sandbox-denial-vs-broker-denial (requires OS-level enforcement · v0.1.0 all denials are BROKER_CAPABILITY_DENIAL)",
    "T3.authority-alias-via-real-symlink-preinstalled (workspace symlink pointing at protected root created outside NEX1's authority · v0.1.0 in-process fixture cannot simulate the OS-level route)",
    "T3.token-cross-workorder-replay-across-broker-restart (requires broker restart · v0.1.0 in-process holds Broker for session lifetime)",
  ];

  const pass = cases.filter((c) => c.ok).length;
  const fail = cases.filter((c) => !c.ok).length;
  return NextResponse.json({
    phase: "Phase 8 v0.1.0 · adversarial harness · REAL EXECUTION",
    implementation_tier_declaration: {
      T1_real_and_executed: "path canonicalisation · Broker capability enforcement · IPC contract · workspace freeze · snapshot service · event log · Ed25519 signing · Observer walk + reconciliation · Compliance Verifier · full E2E happy path + rollback",
      T2_limited_in_process: "trust domain separation is in-process module boundary · keys held in memory · deterministic clock in tests",
      T3_not_tested_v0_1_0: NOT_TESTED_T3,
    },
    at: new Date().toISOString(),
    total: cases.length, pass, fail, cases,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_controlled_hands_adversarial_harness", authority: "test_only", produced_by: "nex_controlled_hands_adversarial_harness" },
  }, { headers: { "Cache-Control": "no-store" } });
}
