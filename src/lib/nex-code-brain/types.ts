// NEX Code Brain · shared types
// A specialised knowledge + concurrency brain for the CODING workstation only.
// Does NOT replace nex-agent-runtime/nex1/memory.ts (7-layer Ed25519 memory) —
// it INDEXES coding-specific patterns + enforces exclusive file-lane ownership.
//
// Load-bearing invariant: every file path resolves to exactly ONE lane via
// deterministic longest-prefix match, so NEX1 and NEX-Twin can never be
// assigned overlapping paths.

export type LaneStatus = "active" | "pending_activation" | "quarantined";

export interface AgentLane {
  readonly lane_id: string; // stable slug · e.g. "nex-coding-primary"
  readonly display_name: string;
  readonly status: LaneStatus;
  readonly owner_agent_ids: readonly string[]; // which agents may act in this lane
  readonly path_prefixes: readonly string[]; // repo-relative · longest-prefix match
  readonly domain_tags: readonly string[]; // e.g. ["typescript", "react", "api"]
  readonly notes: string;
  readonly registered_at: string;
}

export interface WriteLease {
  readonly lease_id: string;
  readonly path: string; // repo-relative · forward-slash normalised
  readonly agent_lane: string;
  readonly task_id: string | null;
  readonly acquired_at: string;
  readonly expires_at: string;
  readonly holder_pid: number;
  readonly holder_agent_id: string | null;
}

export type LeaseConflictKind =
  | "WRONG_LANE" // path routes to a different lane
  | "CONFLICT" // path is already leased to another lane
  | "UNSAFE_PATH" // path is universal-deny or path-traversal
  | "UNKNOWN_LANE" // requested lane not registered
  | "LANE_INACTIVE"; // lane exists but not active

export interface LeaseGrant {
  readonly ok: true;
  readonly lease: WriteLease;
  readonly reclaimed_from?: WriteLease; // if we broke an expired lease
}

export interface LeaseConflict {
  readonly ok: false;
  readonly kind: LeaseConflictKind;
  readonly reason: string;
  readonly conflict?: WriteLease; // populated on CONFLICT
  readonly expected_lane?: string; // populated on WRONG_LANE
}

export type LeaseResult = LeaseGrant | LeaseConflict;

export interface LeaseRequest {
  readonly agent_lane: string;
  readonly path: string;
  readonly task_id?: string;
  readonly holder_agent_id?: string;
  readonly ttl_seconds?: number; // default 1800 (30 min)
}

export interface KnowledgeEntry {
  readonly entry_id: string;
  readonly kind: "pattern" | "anti-pattern" | "fix-recipe" | "convention" | "framework-note" | "gotcha";
  readonly title: string;
  readonly body: string; // markdown-ish
  readonly contributed_by_lane: string;
  readonly contributed_by_agent: string | null;
  readonly applicable_paths: readonly string[]; // path prefix patterns
  readonly tags: readonly string[];
  readonly created_at: string;
  readonly evidence: readonly string[]; // file:line refs
  readonly founder_approved: boolean;
}

export interface FeedItem {
  readonly item_id: string;
  readonly lane: string;
  readonly task_id: string;
  readonly title: string;
  readonly priority: number; // 0 = high, higher = lower priority
  readonly paths: readonly string[]; // all paths MUST resolve to `lane`
  readonly status: "queued" | "leased" | "completed" | "abandoned";
  readonly requested_at: string;
  readonly requested_by: string;
  readonly hint: string;
}

export interface AssignmentRecord {
  readonly assignment_id: string;
  readonly lane: string;
  readonly task_id: string;
  readonly paths: readonly string[];
  readonly lease_id: string | null;
  readonly status: "queued" | "leased" | "completed" | "abandoned";
  readonly created_at: string;
  readonly closed_at: string | null;
}

export interface LaneRoutingResult {
  readonly path: string;
  readonly resolved_lane: string | null;
  readonly matched_prefix: string | null;
}

export interface CrossLaneRejection {
  readonly ok: false;
  readonly kind: "CROSS_LANE";
  readonly reason: string;
  readonly path_to_lane: Readonly<Record<string, string | null>>;
  readonly distinct_lanes: readonly string[];
}

export interface WorkAcceptance {
  readonly ok: true;
  readonly lane: string;
  readonly lease: WriteLease;
  readonly assignment: AssignmentRecord;
}

export type WorkRequestResult = WorkAcceptance | CrossLaneRejection | LeaseConflict;

export interface WorkRequest {
  readonly requested_by: string; // e.g. "founder" · "nex-coding-team-runtime"
  readonly task_id: string;
  readonly title: string;
  readonly paths: readonly string[]; // all paths the task will touch
  readonly hint: string;
  readonly ttl_seconds?: number;
  readonly holder_agent_id?: string;
}
