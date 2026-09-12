// src/lib/nex-authority-broker/broker.ts
//
// Phase 8 v0.1.0 · Authority Broker · T1 REAL capability router.
// v0.1.0 IMPLEMENTATION_TIER T2 declared: in-process module boundary.
// T3 declared NOT_IMPLEMENTED: separate OS process · restricted user token · Job Object.

import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve as pathResolve, join, dirname } from "node:path";
import type { CapabilityManifest, WorkOrder, ProcessCapabilityEntry } from "../nex-controlled-hands/types";
import { canonicalisePath, toctou_safe_identify, enforce_write_scope, enforce_read_scope, is_hard_link_to_protected, default_protected_paths_absolute, default_read_denylist_absolute, type ProtectedRootPolicy } from "../nex-controlled-hands/path-security";
import { BrokerEventLog } from "./event-log";
import { SnapshotService } from "./snapshot-service";
import { generateKeyPair, type KeyPair } from "../nex-controlled-hands/ed25519";

export interface CapabilitySession {
  readonly session_id: string;
  readonly capability_token: string;
  readonly work_order_id: string;
  readonly capability_manifest_hash: string;
  readonly nex1_execution_instance_id: string;
  readonly session_start_ts: string;
  readonly ttl_seconds: number;
  next_sequence: number;
  frozen: boolean;
}

export interface CapabilityRequest {
  readonly capability_token: string;
  readonly sequence_number: number;
  readonly nonce: string;
  readonly capability: string;                                    // e.g. "fs.open_for_write"
  readonly args: Record<string, unknown>;
  readonly request_id: string;
}

export interface CapabilityHandle {
  readonly handle_id: string;
  readonly capability: string;
  readonly canonical_path: string;
  readonly kind: "read" | "write" | "process";
  readonly opened_at: string;
  closed: boolean;
}

export interface BrokerResponse<T> {
  readonly ok: boolean;
  readonly reason?: string;
  readonly denial_class?: "SANDBOX_DENIAL" | "BROKER_CAPABILITY_DENIAL";
  readonly value?: T;
}

// ─── Broker instance ─────────────────────────────────────────────

export class AuthorityBroker {
  readonly signing_key: KeyPair;
  readonly event_log: BrokerEventLog;
  readonly snapshot_service: SnapshotService;
  readonly workspace_root: string;
  readonly repo_root: string;
  readonly policy: ProtectedRootPolicy;
  readonly work_order: WorkOrder;
  readonly manifest_hash: string;

  private session: CapabilitySession | null = null;
  private handles = new Map<string, CapabilityHandle>();
  private nonce_seen = new Set<string>();
  private request_count = 0;
  private clock: () => string;

  constructor(args: {
    work_order: WorkOrder;
    workspace_root: string;
    repo_root: string;
    clock?: () => string;
  }) {
    this.signing_key = generateKeyPair("broker");
    this.event_log = new BrokerEventLog(this.signing_key);
    this.snapshot_service = new SnapshotService(this.signing_key);
    this.workspace_root = pathResolve(args.workspace_root);
    this.repo_root = pathResolve(args.repo_root);
    this.work_order = args.work_order;
    this.manifest_hash = createHash("sha256").update(JSON.stringify(args.work_order.capability_manifest)).digest("hex").slice(0, 16);
    this.clock = args.clock ?? (() => new Date().toISOString());
    this.policy = {
      write_root_absolute: this.workspace_root,
      read_roots_absolute: args.work_order.capability_manifest.read_roots.map((r) => pathResolve(this.workspace_root, r)),
      protected_paths_absolute: [
        ...default_protected_paths_absolute(this.repo_root),
        ...args.work_order.capability_manifest.protected_paths.map((p) => pathResolve(this.repo_root, p)),
      ],
      read_denylist_absolute: [
        ...default_read_denylist_absolute(this.repo_root),
        ...args.work_order.capability_manifest.read_denylist.map((p) => pathResolve(this.repo_root, p)),
      ],
    };
  }

  // ─── Session ───────────────────────────────────────────────

  start_session(nex1_execution_instance_id: string): CapabilitySession {
    if (this.session !== null) throw new Error("session already started");
    const token = "cap-" + randomBytes(16).toString("hex");
    this.session = {
      session_id: "S-" + randomBytes(4).toString("hex"),
      capability_token: token,
      work_order_id: this.work_order.work_order_id,
      capability_manifest_hash: this.manifest_hash,
      nex1_execution_instance_id,
      session_start_ts: this.clock(),
      ttl_seconds: this.work_order.capability_manifest.ipc_policy.session_timeout_seconds,
      next_sequence: 1,
      frozen: false,
    };
    return this.session;
  }

  get_session(): CapabilitySession | null { return this.session; }

  // ─── Request validation ────────────────────────────────────

  private validate_request(req: CapabilityRequest): { ok: true } | { ok: false; reason: string; kind: "IPC_REPLAY_ATTEMPT" | "TOKEN_MANIFEST_MISMATCH" | "TOKEN_INSTANCE_MISMATCH" | "SESSION_EXPIRED" | "WORKSPACE_FROZEN" | "RATE_LIMIT" } {
    if (this.session === null) return { ok: false, reason: "no active session", kind: "IPC_REPLAY_ATTEMPT" };
    if (this.session.frozen) return { ok: false, reason: "workspace is frozen", kind: "WORKSPACE_FROZEN" };
    if (req.capability_token !== this.session.capability_token) return { ok: false, reason: "capability token mismatch", kind: "IPC_REPLAY_ATTEMPT" };
    if (req.sequence_number !== this.session.next_sequence) return { ok: false, reason: `expected sequence ${this.session.next_sequence}, got ${req.sequence_number}`, kind: "IPC_REPLAY_ATTEMPT" };
    if (this.nonce_seen.has(req.nonce)) return { ok: false, reason: "nonce replay", kind: "IPC_REPLAY_ATTEMPT" };
    // Manifest & instance bindings verified at token issuance · but we also enforce that the current session's manifest still matches
    // (In-process v0.1.0: manifest is immutable within session · this is a placeholder for cross-Work-Order replay in T3)
    if (this.session.capability_manifest_hash !== this.manifest_hash) return { ok: false, reason: "capability_manifest_hash mismatch (cross-WO replay)", kind: "TOKEN_MANIFEST_MISMATCH" };
    // Rate limit
    this.request_count++;
    if (this.request_count > this.work_order.capability_manifest.ipc_policy.request_rate_limit) return { ok: false, reason: "rate limit exceeded", kind: "RATE_LIMIT" };
    // Session TTL
    const now = new Date(this.clock()).getTime();
    const start = new Date(this.session.session_start_ts).getTime();
    if ((now - start) / 1000 > this.session.ttl_seconds) return { ok: false, reason: "session expired", kind: "SESSION_EXPIRED" };
    return { ok: true };
  }

  private consume_request(req: CapabilityRequest): void {
    this.session!.next_sequence++;
    this.nonce_seen.add(req.nonce);
  }

  // ─── Public capabilities ───────────────────────────────────

  async fs_open_for_write(req: CapabilityRequest): Promise<BrokerResponse<CapabilityHandle>> {
    const v = this.validate_request(req);
    if (!v.ok) {
      // If workspace is frozen, event log is sealed · we cannot append. Return the denial without a new log entry.
      if (!this.event_log.is_sealed()) {
        this.event_log.append(v.kind === "IPC_REPLAY_ATTEMPT" ? "IPC_REPLAY_ATTEMPT" : "BROKER_CAPABILITY_DENIAL", { req: { capability: req.capability, sequence_number: req.sequence_number }, reason: v.reason }, this.clock());
      }
      return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    this.consume_request(req);
    const path = String(req.args.path ?? "");
    const canon = canonicalisePath(path, this.workspace_root);
    if (!canon.ok) {
      this.event_log.append("SCOPE_ESCAPE_ATTEMPT", { req, reason: canon.reason }, this.clock());
      return { ok: false, reason: canon.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    const scope = enforce_write_scope(canon.canonical!, this.policy);
    if (!scope.ok) {
      const kind = scope.reason?.includes("MASTER_AUTHORITY_ELEVATION_ATTEMPT") ? "MASTER_AUTHORITY_ELEVATION_ATTEMPT" : "SCOPE_ESCAPE_ATTEMPT";
      this.event_log.append(kind, { req, reason: scope.reason }, this.clock());
      return { ok: false, reason: scope.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    // Hard-link inode check (against protected paths)
    const hl = await is_hard_link_to_protected(canon.canonical!, this.policy.protected_paths_absolute);
    if (hl.hit) {
      this.event_log.append("MASTER_AUTHORITY_ELEVATION_ATTEMPT", { req, reason: `hard link to protected target ${hl.protected_target}` }, this.clock());
      return { ok: false, reason: "hard link to protected inode", denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    // Capture pre-state snapshot before granting write
    const rel = canon.canonical!.substring(this.workspace_root.length + 1).replace(/\\/g, "/");
    await this.snapshot_service.capture(rel, this.workspace_root, this.clock());
    const handle: CapabilityHandle = {
      handle_id: "h-w-" + randomBytes(6).toString("hex"),
      capability: "fs.open_for_write",
      canonical_path: canon.canonical!,
      kind: "write",
      opened_at: this.clock(),
      closed: false,
    };
    this.handles.set(handle.handle_id, handle);
    this.event_log.append("CAPABILITY_GRANTED", { req, handle: handle.handle_id, path: rel }, this.clock());
    return { ok: true, value: handle };
  }

  async fs_open_for_read(req: CapabilityRequest): Promise<BrokerResponse<CapabilityHandle>> {
    const v = this.validate_request(req);
    if (!v.ok) {
      // If workspace is frozen, event log is sealed · we cannot append. Return the denial without a new log entry.
      if (!this.event_log.is_sealed()) {
        this.event_log.append(v.kind === "IPC_REPLAY_ATTEMPT" ? "IPC_REPLAY_ATTEMPT" : "BROKER_CAPABILITY_DENIAL", { req: { capability: req.capability, sequence_number: req.sequence_number }, reason: v.reason }, this.clock());
      }
      return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    this.consume_request(req);
    const path = String(req.args.path ?? "");
    // Reads can be workspace-relative or repo-relative
    const canon = canonicalisePath(path, this.workspace_root);
    let canonical_abs: string;
    if (canon.ok && canon.canonical) {
      canonical_abs = canon.canonical;
    } else {
      // Try repo-relative for reads
      canonical_abs = pathResolve(this.repo_root, path);
    }
    const scope = enforce_read_scope(canonical_abs, this.policy);
    if (!scope.ok) {
      const kind = scope.reason?.includes("MASTER_AUTHORITY_ELEVATION_ATTEMPT") ? "MASTER_AUTHORITY_ELEVATION_ATTEMPT"
        : scope.reason?.includes("PROTECTED_DATA_ACCESS_ATTEMPT") ? "PROTECTED_DATA_ACCESS_ATTEMPT"
        : "SCOPE_ESCAPE_ATTEMPT";
      this.event_log.append(kind, { req, reason: scope.reason, path: canonical_abs }, this.clock());
      return { ok: false, reason: scope.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    const handle: CapabilityHandle = {
      handle_id: "h-r-" + randomBytes(6).toString("hex"),
      capability: "fs.open_for_read",
      canonical_path: canonical_abs,
      kind: "read",
      opened_at: this.clock(),
      closed: false,
    };
    this.handles.set(handle.handle_id, handle);
    this.event_log.append("CAPABILITY_GRANTED", { req, handle: handle.handle_id, path: canonical_abs }, this.clock());
    return { ok: true, value: handle };
  }

  async fs_write(req: CapabilityRequest, handle_id: string, bytes: Buffer): Promise<BrokerResponse<{ bytes_written: number; post_hash: string }>> {
    const v = this.validate_request(req);
    if (!v.ok) return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    this.consume_request(req);
    const handle = this.handles.get(handle_id);
    if (!handle || handle.closed || handle.kind !== "write") {
      this.event_log.append("BROKER_CAPABILITY_DENIAL", { req, reason: "invalid write handle" }, this.clock());
      return { ok: false, reason: "invalid handle", denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    try {
      await fs.mkdir(dirname(handle.canonical_path), { recursive: true });
      await fs.writeFile(handle.canonical_path, bytes);
      const post_hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const rel = handle.canonical_path.substring(this.workspace_root.length + 1).replace(/\\/g, "/");
      this.event_log.append("FS_MUTATION", { path: rel, post_hash, bytes_written: bytes.length }, this.clock());
      return { ok: true, value: { bytes_written: bytes.length, post_hash } };
    } catch (e) {
      this.event_log.append("BROKER_CAPABILITY_DENIAL", { req, reason: "write failed: " + (e as Error).message }, this.clock());
      return { ok: false, reason: (e as Error).message };
    }
  }

  fs_close(req: CapabilityRequest, handle_id: string): BrokerResponse<{ closed: true }> {
    const v = this.validate_request(req);
    if (!v.ok) return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    this.consume_request(req);
    const handle = this.handles.get(handle_id);
    if (!handle) return { ok: false, reason: "unknown handle", denial_class: "BROKER_CAPABILITY_DENIAL" };
    (handle as any).closed = true;
    return { ok: true, value: { closed: true } };
  }

  async fs_read(req: CapabilityRequest, handle_id: string): Promise<BrokerResponse<{ content: string }>> {
    const v = this.validate_request(req);
    if (!v.ok) return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    this.consume_request(req);
    const handle = this.handles.get(handle_id);
    if (!handle || handle.closed || handle.kind !== "read") return { ok: false, reason: "invalid read handle", denial_class: "BROKER_CAPABILITY_DENIAL" };
    const content = await fs.readFile(handle.canonical_path, "utf8");
    return { ok: true, value: { content } };
  }

  // Process spawn: enforce PROCESS_CAPABILITY_ENTRY allowlist
  process_spawn_allowed(req: CapabilityRequest, entry_id: string, args: readonly string[]): BrokerResponse<{ process_handle: string }> {
    const v = this.validate_request(req);
    if (!v.ok) return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    this.consume_request(req);
    const entry = this.work_order.capability_manifest.allowed_processes.find((e) => e.entry_id === entry_id);
    if (!entry) {
      this.event_log.append("BROKER_CAPABILITY_DENIAL", { req, reason: `process entry ${entry_id} not in allowlist` }, this.clock());
      return { ok: false, reason: "process not on allowlist", denial_class: "BROKER_CAPABILITY_DENIAL" };
    }
    // v0.1.0 T2: we do NOT actually spawn processes · we record the intent and return a fake handle.
    // Real spawn requires T3 sandbox mechanism (AppContainer / Job Object).
    const handle = "p-" + randomBytes(6).toString("hex");
    this.event_log.append("PROCESS_SPAWNED", { entry_id, args, handle_stub: handle, note: "T2: intent recorded, no actual spawn at v0.1.0" }, this.clock());
    return { ok: true, value: { process_handle: handle } };
  }

  handover_request(req: CapabilityRequest): BrokerResponse<{ seal_hash: string; snapshot_manifest_hash: string }> {
    const v = this.validate_request(req);
    if (!v.ok) return { ok: false, reason: v.reason, denial_class: "BROKER_CAPABILITY_DENIAL" };
    this.consume_request(req);
    this.event_log.append("HANDOVER_REQUESTED", { session_id: this.session!.session_id }, this.clock());
    // Append WORKSPACE_FROZEN before sealing so the event is inside the sealed chain
    this.event_log.append("WORKSPACE_FROZEN", { session_id: this.session!.session_id }, this.clock());
    // Freeze: no further capabilities granted
    this.session!.frozen = true;
    const seal = this.event_log.seal(this.clock());
    return { ok: true, value: { seal_hash: seal, snapshot_manifest_hash: this.snapshot_service.manifest_hash() } };
  }

  // Public: attempted-elevation shortcut (used by adversarial tests)
  record_authority_elevation_attempt(detail: string): void {
    this.event_log.append("MASTER_AUTHORITY_ELEVATION_ATTEMPT", { detail }, this.clock());
  }

  record_interpretation_authority_exceeded(detail: string): void {
    this.event_log.append("INTERPRETATION_AUTHORITY_EXCEEDED", { detail }, this.clock());
  }
}
