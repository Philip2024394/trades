// src/lib/nex/github-round-trip/types.ts
//
// Stage 8 · GitHub round-trip types.
//
// Discipline (locked):
//   - Never bypass Security Agent (all PRs run CI security-agent workflow)
//   - Never --no-verify (pre-commit hook runs Security Agent locally)
//   - Never force-push
//   - Branch names are deterministic from (capabilityId · version)

export interface BranchDescriptor {
  readonly name: string;                    // e.g. "nex-build/CAP-091/v1.0.0"
  readonly capabilityId: string;
  readonly version: string;
  readonly parentSha: string | null;        // parent commit sha at branch time
}

export interface PrDescriptor {
  readonly title: string;
  readonly body: string;
  readonly baseBranch: string;              // usually "main"
  readonly headBranch: string;
  readonly draftMode: boolean;              // opens as draft during BUILDING/TESTING
}

export interface PrLifecycleEvent {
  readonly kind: "opened" | "converted_to_ready" | "review_requested" | "changes_requested" | "approved" | "merged" | "closed";
  readonly at: string;
  readonly by: string;                      // agent id · founder session · reviewer login
  readonly note: string | null;
}

export interface RoundTripState {
  readonly revisionId: string;
  readonly capabilityId: string;
  readonly version: string;
  readonly branchName: string;
  readonly prNumber: number | null;         // null until PR opened
  readonly prUrl: string | null;
  readonly events: readonly PrLifecycleEvent[];
}

export type BranchValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };
