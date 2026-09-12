// WO-WORKSTATION-04 · manifest / work-order bridge
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Bridge from WO-03 AuthorisedDiffBundle (deterministic authoring output) to
// the existing T3-A/T3-B AuthorityBroker WorkOrder + CapabilityManifest.
//
// Rationale: the Broker at src/lib/nex-authority-broker/broker.ts holds the
// 41/41 real-execution baseline (T1 33/33 + T3-A 3/3 + case 47 + T3-B 4/4).
// WO-04 does NOT reimplement its scope enforcement, hard-link protection,
// snapshot service, replay detection, or event log — it composes. This file
// is the only translation layer needed.

import { randomBytes } from "node:crypto";
import path from "node:path";
import type { CapabilityManifest, WorkOrder } from "@/lib/nex-controlled-hands/types";
import type { AuthorisedDiffBundle } from "./wo3-types";
import type { FounderAuthorization } from "./wo2-authorization";

/**
 * Sensible defaults for the CapabilityManifest fields the Broker needs
 * but WO-03/WO-04 don't yet expose in the higher-level API. These are
 * v0.1 conservative values — a WO can override them per-project once we
 * have a real per-project policy layer.
 */
const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  cpu_ms_max:            60_000,
  memory_bytes_max:      512 * 1024 * 1024,
  wall_ms_max:           120_000,
  fd_max:                256,
  total_write_bytes_max: 32 * 1024 * 1024,
  process_count_max:     0,        // v0.1: WO-04 never spawns processes
});

const DEFAULT_IPC_POLICY = Object.freeze({
  request_rate_limit:         10_000,   // per-session cap · generous · well above expected 3n
  session_timeout_seconds:    600,
  max_request_size_bytes:     8 * 1024 * 1024,
  capability_token_ttl_seconds: 600,
});

const DEFAULT_SNAPSHOT_POLICY = Object.freeze({
  capture_before_every_write: true as const,
  retention_after_rollback:   "always" as const,
  retention_after_reject:     "always" as const,
  retention_after_accept:     "founder_authored" as const,
});

/**
 * Build a WorkOrder ready for `new AuthorityBroker({ work_order, ... })`.
 *
 * Every path the bundle intends to touch becomes a scope declaration:
 *   - `write_root` = the workspace root (absolute, resolved)
 *   - protected paths = an empty list at the manifest layer (Broker adds
 *     its own defaults via default_protected_paths_absolute)
 *
 * The founder_authorisation_signature field is populated with the WO-02
 * signature so audit records the linkage. The Broker doesn't itself
 * verify this signature at intake in v0.1 (that's the WO-04 executor's
 * job before the Broker is even instantiated); but the field is present
 * for downstream Compliance Verifier + Observer bundles.
 */
export function buildWorkOrderForBundle(input: {
  readonly bundle: AuthorisedDiffBundle;
  readonly authorization: FounderAuthorization;
  readonly workspace_root: string;
  /** Optional expiry override; defaults to +1h from now. */
  readonly expiry?: string;
}): WorkOrder {
  const wsRoot = path.resolve(input.workspace_root);
  const manifest_id = "mf-" + randomBytes(8).toString("hex");
  const manifest: CapabilityManifest = {
    manifest_id,
    work_order_id:             `${input.bundle.trace_id}::${input.authorization.work_order_id}`,
    founder_authorisation_ref: input.authorization.authorization_id,
    write_root:                wsRoot,
    read_roots:                [wsRoot],
    protected_paths:           [],     // Broker's own defaults cover repo-level protection
    read_denylist:             [],
    allowed_processes:         [],     // WO-04 v0.1: no process spawn
    allowed_environment:       {},
    network_policy:            "DENY",
    resource_limits:           { ...DEFAULT_RESOURCE_LIMITS },
    iteration_limit:           1,
    timeout_seconds:           300,
    snapshot_policy:           DEFAULT_SNAPSHOT_POLICY,
    ipc_policy:                DEFAULT_IPC_POLICY,
    interpretation_authority:  { allow: [] },
    // Not a broker-verified field in v0.1 — kept for audit-trail linkage
    founder_authorisation_signature: input.authorization.signature,
  };
  const wo: WorkOrder = {
    work_order_id:      manifest.work_order_id,
    user_objective:     `WO-03 diff ${input.bundle.diff.diff_id} on trace ${input.bundle.trace_id}`,
    acceptance_criteria: [{
      requirement_id: "wo4.write_all_candidates",
      criterion_text: `every file in bundle.candidate_files must exist at its declared workspace-relative path with content matching content_hash`,
      mechanical_check: "post-execution observer walk matches expected hashes",
    }],
    capability_manifest: manifest,
    rollback_reference:  input.bundle.bundle_id,   // for audit link back to bundle
    expiry:              input.expiry ?? new Date(Date.now() + 3_600_000).toISOString(),
  };
  return wo;
}
