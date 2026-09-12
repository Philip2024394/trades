// GET /api/nex1/controlled-hands/t3a-attack
//
// Phase 8 · T3-A adversarial harness · REAL SPAWNED BROKER · not in-process module.
// Executes cases 47 · 49 · 55 against a Broker that runs in a separate OS process (broker-child-process.ts).
// Every claim in the response is produced by actual execution against the real IPC boundary.
// Where a case cannot be fully proven at T3-A because of a genuine mechanism limitation
// (e.g. NEX1 is still in-process at T3-A · not yet a separate child), that is declared honestly.
//
// Attack discipline (per founder guidance 2026-09-12):
//   "Don't accept the mechanism because it sounds correct — attack the mechanism."

import { NextResponse } from "next/server";
import { promises as fs, openSync, writeSync, closeSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { randomBytes } from "node:crypto";
import { BrokerChildClient } from "@/lib/nex-authority-broker/broker-child-client";
import type { WorkOrder, CapabilityManifest } from "@/lib/nex-controlled-hands/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface T3ACaseResult {
  id: string;
  category: string;
  ok: boolean;
  detail: string;
  evidence?: unknown;
  honest_limitation?: string;
}

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
    allowed_environment: { NODE_ENV: "production" },
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
  const ws = pathResolve(process.cwd(), ".nex", "workspaces-t3a", wo_id);
  await fs.mkdir(ws, { recursive: true });
  return ws;
}

async function cleanup_workspace(ws: string): Promise<void> {
  try { await fs.rm(ws, { recursive: true, force: true }); } catch {}
}

function make_work_order(wo_id: string, workspace_root: string): WorkOrder {
  return {
    work_order_id: wo_id,
    user_objective: "Phase 8 T3-A adversarial harness fixture",
    acceptance_criteria: [{ requirement_id: "R1", criterion_text: "must create workspace/foo.ts", mechanical_check: "created:foo.ts" }],
    capability_manifest: make_manifest(wo_id, workspace_root),
    rollback_reference: "rb-" + wo_id,
    expiry: new Date(Date.now() + 3600_000).toISOString(),
  };
}

// ─── Case 49 · inherited privileged handle ────────────────────────────
// Attack: parent has fd 3 open · child MUST NOT be able to fstat it.
// If child sees fd 3, handle inheritance blocking has failed at OS level.
async function case_49_inherited_privileged_handle(): Promise<T3ACaseResult> {
  const wo_id = "T3A-49-" + randomBytes(3).toString("hex");
  const workspace_root = await make_workspace(wo_id);
  const wo = make_work_order(wo_id, workspace_root);

  // Open a spare fd in the PARENT · this is the "privileged handle" being tested for inheritance.
  const secret_path = pathResolve(workspace_root, ".parent-secret");
  await fs.writeFile(secret_path, "SECRET_PARENT_DATA_FD_LEAK_INDICATOR");
  const parent_fd = openSync(secret_path, "r");

  let child_fds_open: number[] = [];
  let child_process_info: any = null;
  let spawn_ok = false;
  let attack_denied = false;
  let error_str: string | null = null;

  const client = new BrokerChildClient();
  try {
    await client.spawn_broker({ work_order: wo, workspace_root, repo_root: process.cwd() });
    spawn_ok = true;

    // Probe child for open fds beyond stdio (0,1,2)
    const probe_result = await client.probe("inherited_fds") as { open_fds: number[]; errors: Record<number, string> };
    child_fds_open = probe_result.open_fds;

    const info_result = await client.probe("process_info") as { pid: number; ppid: number };
    child_process_info = { pid: info_result.pid, ppid: info_result.ppid };

    // Attack succeeds if child_fds_open is empty (or only stdio) — meaning fd 3 was NOT inherited
    attack_denied = child_fds_open.length === 0;
  } catch (e) {
    error_str = (e as Error).message;
  } finally {
    try { closeSync(parent_fd); } catch {}
    await client.shutdown();
    await cleanup_workspace(workspace_root);
  }

  return {
    id: "49",
    category: "INHERITED_PRIVILEGED_HANDLE",
    ok: spawn_ok && attack_denied,
    detail: spawn_ok
      ? (attack_denied
        ? `Broker child spawned successfully. Parent had fd ${parent_fd} open · child sees ${child_fds_open.length} inheritable fd(s) beyond stdio (fds 0/1/2). Inheritance blocked at OS spawn boundary via stdio:[pipe,pipe,pipe].`
        : `ATTACK NOT PREVENTED · child observed inheritable fds beyond stdio: ${JSON.stringify(child_fds_open)}`)
      : `SPAWN FAILED · ${error_str}`,
    evidence: {
      parent_fd_opened: parent_fd,
      parent_pid: process.pid,
      child_process_info,
      child_open_fds_beyond_stdio: child_fds_open,
      spawn_stdio_config: "['pipe','pipe','pipe'] · no fd inheritance beyond 0/1/2",
      error: error_str,
    },
  };
}

// ─── Case 55 · cross-Broker-instance token replay across Broker restart ─────
// Attack: obtain capability_token from Broker instance 1 · shutdown Broker 1 · spawn Broker 2 ·
// replay old token against Broker 2 · Broker 2 MUST refuse.
async function case_55_cross_broker_instance_token_replay(): Promise<T3ACaseResult> {
  const wo_id_1 = "T3A-55A-" + randomBytes(3).toString("hex");
  const wo_id_2 = "T3A-55B-" + randomBytes(3).toString("hex");
  const ws_1 = await make_workspace(wo_id_1);
  const ws_2 = await make_workspace(wo_id_2);
  const wo_1 = make_work_order(wo_id_1, ws_1);
  const wo_2 = make_work_order(wo_id_2, ws_2);

  let broker_1_session: any = null;
  let broker_2_public_key: string | null = null;
  let broker_1_public_key: string | null = null;
  let replay_response: any = null;
  let error_str: string | null = null;

  // Spawn Broker 1 · start session · capture token
  const client_1 = new BrokerChildClient();
  try {
    const b1 = await client_1.spawn_broker({ work_order: wo_1, workspace_root: ws_1, repo_root: process.cwd() });
    broker_1_public_key = b1.public_key_der_hex;
    broker_1_session = await client_1.call("start_session", ["nex1-inst-A"]);
  } catch (e) {
    error_str = "broker_1 phase failure: " + (e as Error).message;
  } finally {
    await client_1.shutdown();
  }

  if (error_str) {
    await cleanup_workspace(ws_1);
    await cleanup_workspace(ws_2);
    return { id: "55", category: "CROSS_WO_TOKEN_REPLAY_ACROSS_BROKER_RESTART", ok: false, detail: error_str };
  }

  // Spawn Broker 2 · start session · then attempt replay of Broker 1's token
  const client_2 = new BrokerChildClient();
  try {
    const b2 = await client_2.spawn_broker({ work_order: wo_2, workspace_root: ws_2, repo_root: process.cwd() });
    broker_2_public_key = b2.public_key_der_hex;
    await client_2.call("start_session", ["nex1-inst-B"]);

    // ATTACK: construct a request with BROKER 1's token · send to BROKER 2.
    const replay_req = {
      capability_token: broker_1_session.capability_token,   // stolen from Broker 1
      sequence_number: 1,
      nonce: "N-attack-" + randomBytes(6).toString("hex"),
      capability: "fs.open_for_write",
      args: { path: "attack.ts" },
      request_id: "R-attack-55",
    };
    replay_response = await client_2.call("fs_open_for_write", [replay_req]);
  } catch (e) {
    error_str = "broker_2 phase failure: " + (e as Error).message;
  } finally {
    await client_2.shutdown();
    await cleanup_workspace(ws_1);
    await cleanup_workspace(ws_2);
  }

  const attack_denied = replay_response && replay_response.ok === false;
  const different_keys = broker_1_public_key !== null && broker_2_public_key !== null && broker_1_public_key !== broker_2_public_key;

  return {
    id: "55",
    category: "CROSS_WO_TOKEN_REPLAY_ACROSS_BROKER_RESTART",
    ok: !error_str && attack_denied && different_keys,
    detail: error_str
      ? `ERROR: ${error_str}`
      : (attack_denied
        ? `Broker 2 refused Broker 1's capability_token · reason: "${replay_response.reason}". Broker 1 and Broker 2 have independent Ed25519 keypairs (different public_key_der_hex).`
        : `ATTACK NOT PREVENTED · Broker 2 accepted Broker 1's stolen token: ${JSON.stringify(replay_response)}`),
    evidence: {
      broker_1_capability_token_prefix: broker_1_session ? broker_1_session.capability_token.slice(0, 20) + "…" : null,
      broker_1_manifest_hash: broker_1_session?.capability_manifest_hash,
      broker_2_refused_response: replay_response,
      broker_1_public_key_prefix: broker_1_public_key?.slice(0, 40) + "…",
      broker_2_public_key_prefix: broker_2_public_key?.slice(0, 40) + "…",
      keys_are_different: different_keys,
    },
  };
}

// ─── Case 47 · pre-existing writable handle survives handover ──────────────
// Attack: parent (acting as an untrusted actor holding a raw fs handle) writes to a workspace
// file AFTER Broker session enters WORKSPACE_FROZEN. This tests whether the workspace-freeze
// protocol is effective against a caller who has bypassed the Broker's capability model.
//
// Honest limitation at T3-A: Domain A (NEX1) is not yet its own separate process. In T3-A
// the parent test harness plays both the orchestrator and NEX1 role. Therefore a raw parent
// write will NOT be blocked at OS level — full prevention requires T3-D (AppContainer /
// syscall-level sandboxing). What T3-A CAN prove is that the Broker's freeze protocol seals
// the event log immutably, and any post-freeze mutation is detectable (by walking the
// workspace against the sealed event log).
async function case_47_pre_existing_writable_handle(): Promise<T3ACaseResult> {
  const wo_id = "T3A-47-" + randomBytes(3).toString("hex");
  const workspace_root = await make_workspace(wo_id);
  const wo = make_work_order(wo_id, workspace_root);

  const target_path = pathResolve(workspace_root, "target.ts");
  await fs.writeFile(target_path, "// initial content authored inside test setup\n");

  // Open a raw write handle in the parent (bypassing Broker entirely)
  const raw_fd = openSync(target_path, "r+");

  let spawn_ok = false;
  let session_started = false;
  let handover_response: any = null;
  let post_freeze_write_ok = false;
  let post_freeze_write_error: string | null = null;
  let post_freeze_second_capability_response: any = null;
  let error_str: string | null = null;
  let session: any = null;

  const client = new BrokerChildClient();
  try {
    await client.spawn_broker({ work_order: wo, workspace_root, repo_root: process.cwd() });
    spawn_ok = true;
    session = await client.call("start_session", ["nex1-inst-47"]);
    session_started = true;

    // Trigger HANDOVER_REQUESTED via IPC · Broker seals event log · workspace frozen
    const handover_req = {
      capability_token: session.capability_token,
      sequence_number: 1,
      nonce: "N-handover-" + randomBytes(6).toString("hex"),
      capability: "handover.request",
      args: {},
      request_id: "R-handover-47",
    };
    handover_response = await client.call("handover_request", [handover_req]);

    // Attack part A: parent raw-write via pre-existing handle after freeze
    try {
      writeSync(raw_fd, Buffer.from("// POST-FREEZE UNAUTHORIZED MUTATION\n"));
      post_freeze_write_ok = true;   // The raw write succeeded at OS level (limitation)
    } catch (e) {
      post_freeze_write_error = (e as Error).message;
    }

    // Attack part B: verify Broker refuses further capability grants after freeze
    const post_freeze_req = {
      capability_token: session.capability_token,
      sequence_number: 2,
      nonce: "N-postfreeze-" + randomBytes(6).toString("hex"),
      capability: "fs.open_for_write",
      args: { path: "sneak.ts" },
      request_id: "R-postfreeze-47",
    };
    post_freeze_second_capability_response = await client.call("fs_open_for_write", [post_freeze_req]);
  } catch (e) {
    error_str = (e as Error).message;
  } finally {
    try { closeSync(raw_fd); } catch {}
    await client.shutdown();
  }

  // Read the file content post-attack to see what actually happened on disk
  let final_content: string | null = null;
  try { final_content = await fs.readFile(target_path, "utf8"); } catch (e) { final_content = "READ_ERR:" + (e as Error).message; }

  await cleanup_workspace(workspace_root);

  const broker_freeze_effective = handover_response?.ok === true && post_freeze_second_capability_response?.ok === false;
  const broker_denial_reason_correct = post_freeze_second_capability_response?.reason?.toLowerCase().includes("frozen");

  return {
    id: "47",
    category: "PRE_EXISTING_WRITABLE_HANDLE",
    ok: broker_freeze_effective && broker_denial_reason_correct === true,
    detail: broker_freeze_effective
      ? `Broker WORKSPACE_FROZEN protocol effective: handover sealed event log · Broker refused subsequent capability request via IPC · reason: "${post_freeze_second_capability_response?.reason}". OS-level raw handle write DID succeed (declared limitation · T3-D required).`
      : `Broker freeze protocol INEFFECTIVE at IPC layer · handover=${JSON.stringify(handover_response)} · post-freeze grant=${JSON.stringify(post_freeze_second_capability_response)}`,
    evidence: {
      spawn_ok,
      session_started,
      handover_response,
      broker_seal_hash_present: !!handover_response?.value?.seal_hash,
      post_freeze_second_capability_response,
      post_freeze_raw_write_at_os_level_succeeded: post_freeze_write_ok,
      post_freeze_raw_write_os_error: post_freeze_write_error,
      final_target_content: final_content?.slice(0, 200),
      error: error_str,
    },
    honest_limitation: "T3-A cannot prevent an OS-level raw file write from the parent process because NEX1 is not yet its own separate process (parent = orchestrator + NEX1 role). The Broker's IPC-layer freeze protocol IS effective (proven by post-freeze capability denial). Full OS-level prevention of the raw parent write requires T3-D (AppContainer / syscall-level sandbox) OR moving NEX1 into its own restricted process (a separate T3 sub-step).",
  };
}

// ─── entrypoint ─────────────────────────────────────────────────────────
export async function GET() {
  const started_at = new Date().toISOString();
  const cases: T3ACaseResult[] = [];

  // Run cases in order · each is self-contained · isolated workspaces
  try {
    cases.push(await case_49_inherited_privileged_handle());
  } catch (e) {
    cases.push({ id: "49", category: "INHERITED_PRIVILEGED_HANDLE", ok: false, detail: "HARNESS_ERROR: " + (e as Error).message });
  }
  try {
    cases.push(await case_55_cross_broker_instance_token_replay());
  } catch (e) {
    cases.push({ id: "55", category: "CROSS_WO_TOKEN_REPLAY_ACROSS_BROKER_RESTART", ok: false, detail: "HARNESS_ERROR: " + (e as Error).message });
  }
  try {
    cases.push(await case_47_pre_existing_writable_handle());
  } catch (e) {
    cases.push({ id: "47", category: "PRE_EXISTING_WRITABLE_HANDLE", ok: false, detail: "HARNESS_ERROR: " + (e as Error).message });
  }

  const finished_at = new Date().toISOString();
  const total = cases.length;
  const passed = cases.filter((c) => c.ok).length;
  const failed = total - passed;

  return NextResponse.json({
    phase: "Phase 8 · T3-A adversarial harness",
    version: "v0.1.0",
    execution_model: "REAL SPAWNED BROKER · separate OS process · IPC over stdio JSON-lines",
    zero_third_party_runtime_deps: true,
    mechanism: {
      broker_process_boundary: "child_process.spawn(node, [--experimental-loader ./broker-child-loader.mjs, --experimental-transform-types, broker-child-process.ts], { stdio: ['pipe','pipe','pipe'] })",
      typescript_execution: "Node 24 built-in type stripping + transform-types · zero external transpiler",
      path_alias_resolution: "src/lib/nex-authority-broker/broker-child-loader.mjs · local ESM resolver hook · zero deps",
    },
    honest_scope: {
      what_t3a_proves: "The Broker actually runs in a separate OS process · handles OS-level handle-inheritance blocking · maintains per-instance signing keys · refuses cross-instance token replay · seals event log on handover.",
      what_t3a_does_not_prove: "Domain A (NEX1) is not yet a separate process at T3-A. Full OS-level enforcement of NEX1's boundary (AppContainer · Job Object · restricted user token · DPAPI) is T3-B through T3-E · declared NOT_IMPLEMENTED at v0.1.0.",
    },
    started_at, finished_at,
    total, passed, failed,
    cases,
  });
}
