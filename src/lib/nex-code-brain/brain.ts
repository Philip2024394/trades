// NEX Code Brain · High-level facade
// One entry point that composes routing + lease + assignment + feed for a
// caller (dispatcher · agent runtime · Founder). Every caller uses this
// rather than calling the primitives directly so the duplication-prevention
// invariants are always enforced.

import type {
  WorkRequest,
  WorkRequestResult,
  CrossLaneRejection,
  AssignmentRecord,
} from "./types";
import { routePaths } from "./path-router";
import { acquireLease, releaseLease } from "./leases";
import { newAssignmentId, recordAssignment, findActiveAssignment, currentAssignments } from "./assignments";
import { enqueueOnLane } from "./feed";

/**
 * Founder / dispatcher call: "assign this task to whichever lane owns its paths".
 * Returns:
 *  · WorkAcceptance with a lease if all paths route to a single active lane
 *  · CrossLaneRejection if paths span multiple lanes
 *  · LeaseConflict / other rejection if the target lane is already busy
 *
 * The caller MUST later call `completeWork(assignment_id)` or the lease will
 * eventually expire (default TTL 30 min).
 */
export function requestWork(req: WorkRequest): WorkRequestResult {
  if (req.paths.length === 0) {
    return { ok: false, kind: "UNSAFE_PATH", reason: "task has no paths" };
  }
  // Duplicate-task guard.
  const active = findActiveAssignment(req.task_id);
  if (active) {
    return {
      ok: false,
      kind: "CONFLICT",
      reason: `task_id "${req.task_id}" already has an active assignment on lane "${active.lane}"`,
    };
  }

  const routed = routePaths(req.paths);
  if (routed.unresolved.length > 0) {
    return {
      ok: false,
      kind: "UNSAFE_PATH",
      reason: `paths do not resolve to any active lane: ${routed.unresolved.join(", ")}`,
    };
  }
  if (routed.distinct_lanes.length > 1) {
    const rejection: CrossLaneRejection = {
      ok: false,
      kind: "CROSS_LANE",
      reason: `paths span ${routed.distinct_lanes.length} lanes (${routed.distinct_lanes.join(", ")}). Cross-lane tasks must be split by the Founder.`,
      path_to_lane: routed.per_path,
      distinct_lanes: routed.distinct_lanes,
    };
    return rejection;
  }
  const lane = routed.distinct_lanes[0]!;

  // Enqueue on the lane feed first (visible even before lease is granted).
  const enq = enqueueOnLane({
    lane,
    task_id: req.task_id,
    title: req.title,
    paths: req.paths,
    priority: 5,
    requested_by: req.requested_by,
    hint: req.hint,
  });
  if (!enq.ok) {
    return { ok: false, kind: "CONFLICT", reason: enq.reason ?? "enqueue rejected" };
  }

  // Acquire a lease for the first path · we treat the first as the primary lock.
  // Additional paths in the same lane are covered by the assignment record.
  const primary = req.paths[0]!;
  const lease = acquireLease({
    agent_lane: lane,
    path: primary,
    task_id: req.task_id,
    holder_agent_id: req.holder_agent_id,
    ttl_seconds: req.ttl_seconds,
  });
  if (!lease.ok) return lease;

  const assignment: AssignmentRecord = {
    assignment_id: newAssignmentId(),
    lane,
    task_id: req.task_id,
    paths: Array.from(req.paths).map((p) => p.replace(/\\/g, "/")),
    lease_id: lease.lease.lease_id,
    status: "leased",
    created_at: new Date().toISOString(),
    closed_at: null,
  };
  recordAssignment(assignment);

  return { ok: true, lane, lease: lease.lease, assignment };
}

/** Release the lease + mark the assignment completed / abandoned. */
export function completeWork(assignment_id: string, outcome: "completed" | "abandoned" = "completed"): {
  ok: boolean;
  reason?: string;
} {
  // Find the latest state of the assignment.
  const all = currentAssignments();
  const target = all.find((a) => a.assignment_id === assignment_id);
  if (!target) return { ok: false, reason: `no such assignment: ${assignment_id}` };
  if (target.status === "completed" || target.status === "abandoned") {
    return { ok: false, reason: `assignment ${assignment_id} already ${target.status}` };
  }
  // Release the lease (if any).
  if (target.lease_id) {
    const r = releaseLease(target.lease_id);
    // We continue even if the lease was already released elsewhere (idempotent).
    if (!r.ok) {
      // Not fatal — the lease might have expired.
    }
  }
  const closed: AssignmentRecord = {
    ...target,
    status: outcome,
    lease_id: null,
    closed_at: new Date().toISOString(),
  };
  recordAssignment(closed);
  return { ok: true };
}
