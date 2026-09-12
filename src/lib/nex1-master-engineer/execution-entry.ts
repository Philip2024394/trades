// src/lib/nex1-master-engineer/execution-entry.ts
//
// Phase 8 v0.1.0 · NEX1 Master Engineer execution entry.
// Trust Domain A · calls Broker only via narrow capability requests · never direct OS.
// v0.1.0 T2: in-process module boundary · no in-process reference to Broker internals beyond the request API surface.

import { randomBytes } from "node:crypto";
import type { NEX1DiffProposal } from "@/lib/nex-controlled-hands/types";
import type { AuthorityBroker, CapabilityRequest, CapabilitySession } from "@/lib/nex-authority-broker/broker";

// The client is intentionally narrow · it only knows how to construct capability requests
// and read the results. It does NOT know about event logs · snapshots · keys · trust boundaries.

export class NEX1CapabilityClient {
  private session: CapabilitySession | null = null;

  constructor(private readonly broker: AuthorityBroker, private readonly clock: () => string) {}

  start(nex1_execution_instance_id: string): void {
    this.session = this.broker.start_session(nex1_execution_instance_id);
  }

  private make_request(capability: string, args: Record<string, unknown>): CapabilityRequest {
    if (!this.session) throw new Error("session not started");
    return {
      capability_token: this.session.capability_token,
      sequence_number: this.session.next_sequence,
      nonce: "nonce-" + randomBytes(8).toString("hex"),
      capability,
      args,
      request_id: "req-" + randomBytes(6).toString("hex"),
    };
  }

  async open_for_write(path: string): Promise<{ ok: boolean; handle_id?: string; reason?: string }> {
    const req = this.make_request("fs.open_for_write", { path });
    const r = await this.broker.fs_open_for_write(req);
    if (!r.ok || !r.value) return { ok: false, reason: r.reason };
    return { ok: true, handle_id: r.value.handle_id };
  }

  async open_for_read(path: string): Promise<{ ok: boolean; handle_id?: string; reason?: string }> {
    const req = this.make_request("fs.open_for_read", { path });
    const r = await this.broker.fs_open_for_read(req);
    if (!r.ok || !r.value) return { ok: false, reason: r.reason };
    return { ok: true, handle_id: r.value.handle_id };
  }

  async write(handle_id: string, content: string): Promise<{ ok: boolean; post_hash?: string; reason?: string }> {
    const req = this.make_request("fs.write", { handle_id });
    const r = await this.broker.fs_write(req, handle_id, Buffer.from(content, "utf8"));
    if (!r.ok || !r.value) return { ok: false, reason: r.reason };
    return { ok: true, post_hash: r.value.post_hash };
  }

  async read(handle_id: string): Promise<{ ok: boolean; content?: string; reason?: string }> {
    const req = this.make_request("fs.read", { handle_id });
    const r = await this.broker.fs_read(req, handle_id);
    if (!r.ok || !r.value) return { ok: false, reason: r.reason };
    return { ok: true, content: r.value.content };
  }

  close(handle_id: string): { ok: boolean; reason?: string } {
    const req = this.make_request("fs.close", { handle_id });
    const r = this.broker.fs_close(req, handle_id);
    return { ok: r.ok, reason: r.reason };
  }

  spawn_allowed(entry_id: string, args: readonly string[]): { ok: boolean; process_handle?: string; reason?: string } {
    const req = this.make_request("process.spawn_allowed", { entry_id, args });
    const r = this.broker.process_spawn_allowed(req, entry_id, args);
    return { ok: r.ok, process_handle: r.value?.process_handle, reason: r.reason };
  }

  handover(): { ok: boolean; seal_hash?: string; snapshot_manifest_hash?: string; reason?: string } {
    const req = this.make_request("handover.request", {});
    const r = this.broker.handover_request(req);
    return { ok: r.ok, seal_hash: r.value?.seal_hash, snapshot_manifest_hash: r.value?.snapshot_manifest_hash, reason: r.reason };
  }
}

// The "engineer" — a deterministic v0.1.0 implementation that carries out a Work Order.
// v0.1.0 T1: NEX1 Master Engineer is a deterministic template-only implementation.
// Real language-model binding is a future phase.

export interface NEX1EngineerInput {
  readonly work_order_id: string;
  readonly proposed_file_actions: readonly {
    readonly kind: "create" | "modify" | "delete";
    readonly path: string;         // workspace-relative
    readonly content?: string;
  }[];
  readonly interpretation?: NEX1DiffProposal["interpretation"];
  readonly reasoning?: string;
  readonly counter_argument?: string;
  readonly counter_argument_addressed?: string;
}

export async function execute_nex1_master_engineer(args: {
  input: NEX1EngineerInput;
  client: NEX1CapabilityClient;
  clock: () => string;
}): Promise<{ proposal: NEX1DiffProposal; grants: number; denials: number; denial_reasons: readonly string[] }> {
  const proposed_files_created: string[] = [];
  const proposed_files_modified: string[] = [];
  const proposed_files_deleted: string[] = [];
  const denial_reasons: string[] = [];
  let grants = 0, denials = 0;

  for (const action of args.input.proposed_file_actions) {
    if (action.kind === "create" || action.kind === "modify") {
      const open = await args.client.open_for_write(action.path);
      if (!open.ok) { denials++; denial_reasons.push(`${action.kind} ${action.path}: ${open.reason}`); continue; }
      const write = await args.client.write(open.handle_id!, action.content ?? "");
      if (!write.ok) { denials++; denial_reasons.push(`${action.kind} ${action.path}: ${write.reason}`); continue; }
      args.client.close(open.handle_id!);
      grants++;
      if (action.kind === "create") proposed_files_created.push(action.path);
      else proposed_files_modified.push(action.path);
    } else if (action.kind === "delete") {
      // v0.1.0: delete is not a capability in this iteration · declared NOT_IMPLEMENTED for delete
      denials++;
      denial_reasons.push(`delete ${action.path}: delete capability not implemented at v0.1.0`);
    }
  }

  const proposal: NEX1DiffProposal = {
    record_type: "NEX1_DIFF_PROPOSAL",
    work_order_id: args.input.work_order_id,
    proposed_files_created, proposed_files_modified, proposed_files_deleted,
    self_critique: {
      verdict: denials === 0 ? "SUBMIT_WITH_CONFIDENCE" : "SUBMIT_WITH_RESERVATIONS",
      reasoning: args.input.reasoning ?? "template-only v0.1.0 engineer · executed proposed_file_actions verbatim",
      counter_argument: args.input.counter_argument ?? "actions could have been denied by broker · in which case denial reasons are captured",
      counter_argument_addressed: args.input.counter_argument_addressed ?? denial_reasons.length === 0 ? "no denials observed" : `denials observed: ${denial_reasons.join(" | ")}`,
    },
    interpretation: args.input.interpretation ?? "LITERAL",
    iterations_used: 1,
    attribution: {
      external_llm_used: false,
      deterministic: true,
      role: "nex1_master_engineer",
      authority: "advisory_only",
      produced_by: "nex1_master_engineer",
    },
    at: args.clock(),
  };
  return { proposal, grants, denials, denial_reasons };
}
