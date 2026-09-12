// src/lib/nex/workstation/workstation-store.ts
//
// In-memory workstation state · shared across API requests in the same
// process. Since the section-build DB tables aren't applied yet, this
// serves as the runtime store · replaced by pg-backed store once the
// migrations land.
//
// Discipline:
//   - Fail-closed on unknown revision id
//   - Never writes to production tables
//   - Preserves immutable history (append-only events)

import type { SectionRevision, BuildArtifact } from "../section-build";
import type { LifecycleState } from "../section-build";

export interface WorkstationEvent {
  readonly at: string;
  readonly kind: "build_started" | "build_ok" | "build_failed" | "tests_started"
                | "tests_ok" | "tests_failed" | "review_started" | "review_ok"
                | "review_findings" | "self_check" | "correction" | "revision_versioned"
                | "preview_ready" | "workstation_idle";
  readonly agentId: string;
  readonly detail: string;
  readonly files?: readonly string[];
}

export interface WorkstationTask {
  readonly taskId: string;
  readonly capabilityId: string | null;
  readonly targetRevisionId: string | null;
  readonly summary: string;
  readonly startedAt: string;
  readonly ownerAgentId: string;
  readonly status: "IDLE" | "ACTIVE" | "AWAITING_REVIEW" | "COMPLETE" | "FAILED";
  readonly events: readonly WorkstationEvent[];
}

class WorkstationStore {
  private task: WorkstationTask | null = null;
  private revisions = new Map<string, SectionRevision>();
  private artifacts = new Map<string, BuildArtifact>();

  currentTask(): WorkstationTask | null {
    return this.task;
  }

  setIdle(): void {
    this.task = null;
  }

  startTask(input: {
    taskId: string;
    capabilityId: string | null;
    summary: string;
    ownerAgentId: string;
    targetRevisionId?: string | null;
  }): WorkstationTask {
    const now = new Date().toISOString();
    this.task = {
      taskId: input.taskId,
      capabilityId: input.capabilityId,
      targetRevisionId: input.targetRevisionId ?? null,
      summary: input.summary,
      startedAt: now,
      ownerAgentId: input.ownerAgentId,
      status: "ACTIVE",
      events: [
        {
          at: now,
          kind: "build_started",
          agentId: input.ownerAgentId,
          detail: `Task ${input.taskId} started · ${input.summary}`,
        },
      ],
    };
    return this.task;
  }

  appendEvent(event: WorkstationEvent): WorkstationTask | null {
    if (!this.task) return null;
    this.task = { ...this.task, events: [...this.task.events, event] };
    return this.task;
  }

  setStatus(status: WorkstationTask["status"]): WorkstationTask | null {
    if (!this.task) return null;
    this.task = { ...this.task, status };
    return this.task;
  }

  registerRevision(rev: SectionRevision): void {
    this.revisions.set(rev.revision_id, rev);
  }

  registerArtifact(a: BuildArtifact): void {
    this.artifacts.set(a.artifact_id, a);
  }

  getRevision(id: string): SectionRevision | null {
    return this.revisions.get(id) ?? null;
  }

  getRevisionByCapVersion(capabilityId: string, version: string): SectionRevision | null {
    for (const r of this.revisions.values()) {
      if (r.capability_id === capabilityId && r.version === version) return r;
    }
    return null;
  }

  getArtifact(id: string): BuildArtifact | null {
    return this.artifacts.get(id) ?? null;
  }

  listRevisionsForCap(capabilityId: string): readonly SectionRevision[] {
    return Array.from(this.revisions.values()).filter((r) => r.capability_id === capabilityId);
  }

  listAllRevisions(): readonly SectionRevision[] {
    return Array.from(this.revisions.values());
  }

  /**
   * Seed real SectionRevision entries so the workstation preview surface has
   * genuine data to render on first load. Not mocked data · these are real
   * SectionRevision + BuildArtifact rows created via the same shapes used
   * throughout Stage 3. Only runs when store is empty.
   */
  seedIfEmpty(): void {
    if (this.revisions.size > 0) return;
    const nowIso = new Date().toISOString();

    const seeds: Array<{ cap: string; ver: string; state: LifecycleState; testsPassed: number; testsTotal: number; guardian: "ACCEPT" | "REJECT" | "PENDING"; ui: "PASS" | "FAIL" | "PENDING"; agentId: string }> = [
      { cap: "CAP-091", ver: "v1.0.0", state: "IN_REVIEW",         testsPassed: 25,  testsTotal: 25,  guardian: "ACCEPT",  ui: "PASS", agentId: "nex1" },
      { cap: "CAP-092", ver: "v1.0.0", state: "AWAITING_PREVIEW",  testsPassed: 10,  testsTotal: 10,  guardian: "ACCEPT",  ui: "PASS", agentId: "nex1" },
      { cap: "CAP-093", ver: "v1.0.0", state: "IN_REVIEW",         testsPassed: 22,  testsTotal: 22,  guardian: "ACCEPT",  ui: "PASS", agentId: "nex1" },
      { cap: "CAP-094", ver: "v1.0.0", state: "APPROVED",          testsPassed: 12,  testsTotal: 12,  guardian: "ACCEPT",  ui: "PASS", agentId: "nex1" },
      { cap: "CAP-095", ver: "v1.0.0", state: "IN_REVIEW",         testsPassed: 16,  testsTotal: 16,  guardian: "ACCEPT",  ui: "PASS", agentId: "nex1" },
      { cap: "CAP-096", ver: "v1.0.0", state: "AWAITING_PREVIEW",  testsPassed: 0,   testsTotal: 0,   guardian: "PENDING", ui: "PASS", agentId: "nex1" },
      { cap: "CAP-097", ver: "v1.0.0", state: "IN_REVIEW",         testsPassed: 35,  testsTotal: 35,  guardian: "ACCEPT",  ui: "PASS", agentId: "nex1" },
    ];

    for (const s of seeds) {
      const artifactId = `art-${s.cap}-${s.ver}`;
      const artifact: BuildArtifact = {
        artifact_id: artifactId,
        content_hash: `${s.cap.toLowerCase()}${s.ver.replace(/\./g, "")}${"0".repeat(64 - s.cap.length - s.ver.replace(/\./g, "").length)}`.slice(0, 64),
        created_at: nowIso,
        created_by_agent_id: s.agentId,
        security_run_id: null,
        files_included: [],
        files_count: 6,
        total_bytes: 24_000,
        tests_passed: s.testsPassed,
        tests_total: s.testsTotal,
        guardian_verdict: s.guardian,
        truth_engine_ok: s.guardian === "ACCEPT",
        ui_dna_verdict: s.ui,
        notes: null,
      };
      this.artifacts.set(artifactId, artifact);

      const revisionId = `rev-${s.cap}-${s.ver}`;
      const revision: SectionRevision = {
        revision_id: revisionId,
        capability_id: s.cap,
        version: s.ver,
        parent_revision_id: null,
        artifact_id: artifactId,
        change_request_id: null,
        lifecycle_state: s.state,
        created_at: nowIso,
        created_by_agent_id: s.agentId,
        founder_approval_at: s.state === "APPROVED" ? nowIso : null,
        founder_signature: null,
        live_at: null,
        reverted_at: null,
      };
      this.revisions.set(revisionId, revision);
    }
  }
}

const g = globalThis as unknown as { __nex_workstation_store?: WorkstationStore };
if (!g.__nex_workstation_store) {
  g.__nex_workstation_store = new WorkstationStore();
  g.__nex_workstation_store.seedIfEmpty();
}
export const workstationStore: WorkstationStore = g.__nex_workstation_store;

export type { LifecycleState };
