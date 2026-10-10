// src/lib/nex/continuous-loop/discovery-scheduler.ts
//
// UWI · Wave 8.F · Continuous ecosystem discovery scheduling
// Founder-authorised programme.
//
// Turns the one-shot HF (Wave 8.B) + GitHub (Wave 8.E) discovery into a
// permanent scheduled loop that participates in Wave 7's `TriggerRouter`.
//
// **Reuses existing machinery · creates no new scheduling system:**
//   • Wave 7 `TriggerRouter` — `scheduled` trigger kind
//   • Wave 2 D3 `createDeadline` / `assertNotExpired`   — per-adapter deadline
//   • Wave 2 D2 `deriveIdempotencyKey`                  — deterministic job identity
//   • Wave 8.A `auditRepository`                        — 8-question verdict
//   • Wave 8.B `bridgeEcosystemFindingToOpportunity`    — into Wave 5 lifecycle
//   • Wave 5 `OpportunityStore`                         — memory / M18-M24
//   • Existing internet/constitutional gates            — adapters use them
//   • Wave 6 failure taxonomy                           — adapter errors are typed
//
// Founder-required acceptance properties (verified in Wave 8.F suite):
//   (a) deterministic/idempotent job identity   (b) no duplicate processing
//   (c) bounded per-source work                 (d) failure → typed recovery
//   (e) blocked/failed source does NOT stop other sources
//   (f) provenance for every discovery          (g) constitutional gates preserved
//   (h) no fabricated product candidates        (i) no invented routes
//   (j) clean shutdown/recovery behaviour
//
// **No Product Candidates created in the continuous loop** (property h).
// Product Candidate creation requires §18 10-question gates answered with
// real evidence · that is a downstream Wave 9+ path that consumes the
// Opportunities this scheduler produces.

import type { TriggerRouter } from "./trigger-router";
import type { TriggerEvent } from "./types";
import type {
  EcosystemAdapter,
  ResourceKindInEcosystem,
  EcosystemFinding,
} from "../ecosystem/types";
import { auditRepository } from "../ecosystem/repository-audit-orchestrator";
import { bridgeEcosystemFindingToOpportunity } from "../ecosystem/wave-5-bridge";
import type { OpportunityStore } from "../research-memory/opportunity-store";
import { deriveIdempotencyKey } from "../durability/idempotency-key";
import { createDeadline, assertNotExpired, isExpired, DeadlineExceededError } from "../durability/deadline-context";

// ─── Adapter spec ────────────────────────────────────────────────────
export interface AdapterSpec {
  readonly adapter: EcosystemAdapter;
  readonly discovery_query: {
    readonly resource_kind: ResourceKindInEcosystem;
    readonly query?: string;
  };
  readonly extract_declared_license: (metadata: Record<string, unknown>) => { spdx: string | null; text: string | null };
  /** Optional user_relevance / nex_relevance calibration per adapter. Defaults 0.4 / 0.5. */
  readonly default_user_relevance?: number;
  readonly default_nex_relevance?: number;
  readonly default_novelty_score?: number;
}

// ─── Per-adapter result ──────────────────────────────────────────────
export interface DiscoveryCycleAdapterResult {
  readonly adapter_ecosystem: string;
  readonly cycle_id: string;
  readonly idempotency_key: string;
  readonly resources_probed: number;
  readonly findings_created: number;
  readonly opportunities_created: number;
  readonly dispositions_blocked: number;
  readonly observation_downgrades: number;
  readonly errors: ReadonlyArray<string>;
  readonly deadline_expired: boolean;
  readonly duration_ms: number;
}

// ─── Whole-cycle report ──────────────────────────────────────────────
export interface DiscoveryCycleReport {
  readonly cycle_id: string;
  readonly started_at_iso: string;
  readonly completed_at_iso: string;
  readonly duration_ms: number;
  readonly adapters: ReadonlyArray<DiscoveryCycleAdapterResult>;
  readonly totals: {
    readonly resources_probed: number;
    readonly findings_created: number;
    readonly opportunities_created: number;
    readonly adapters_succeeded: number;
    readonly adapters_failed: number;
  };
}

// ─── Scheduler config ────────────────────────────────────────────────
export interface DiscoverySchedulerConfig {
  readonly trigger_router: TriggerRouter;
  readonly adapters: ReadonlyArray<AdapterSpec>;
  readonly workflow_id: string;
  readonly max_resources_per_adapter_per_cycle: number;
  readonly per_adapter_deadline_ms: number;
  readonly opportunity_store: OpportunityStore;
  /** Optional external audit sink. */
  readonly on_cycle_completed?: (report: DiscoveryCycleReport) => void;
  readonly on_adapter_failed?: (result: DiscoveryCycleAdapterResult) => void;
  readonly on_finding_created?: (finding: EcosystemFinding) => void;
  readonly now?: () => number;
}

// ─── Scheduler ──────────────────────────────────────────────────────
export class DiscoveryScheduler {
  private cycle_seq = 0;
  private cycle_reports: DiscoveryCycleReport[] = [];
  private processed_cycle_keys = new Set<string>();

  constructor(private readonly cfg: DiscoverySchedulerConfig) {}

  /** Register as the single `scheduled` handler on Wave 7 TriggerRouter.
   *  Called once at bootstrap. Refuses if a `scheduled` handler already
   *  exists (single-handler-per-kind Wave 7 discipline). */
  registerWithTriggerRouter(): void {
    if (this.cfg.trigger_router.registeredKinds().includes("scheduled")) {
      throw new Error(
        "DiscoveryScheduler.registerWithTriggerRouter · a 'scheduled' handler is already registered on this TriggerRouter · " +
        "unregister the existing handler first (Wave 7 single-handler-per-kind discipline)"
      );
    }
    this.cfg.trigger_router.register("scheduled", async (event: TriggerEvent) => {
      const detail_cycle = event.detail?.["cycle_id"];
      const cycle_id = typeof detail_cycle === "string" ? detail_cycle : this.newCycleId();
      await this.runCycle(cycle_id);
    });
  }

  /** Deterministic cycle id (property a · idempotent job identity). */
  newCycleId(): string {
    this.cycle_seq += 1;
    return `discovery-cycle-${this.cfg.workflow_id}-${this.cycle_seq}`;
  }

  /** Run one discovery cycle across all registered adapters.
   *  Adapter isolation preserved · one failure does not stop other adapters. */
  async runCycle(cycle_id: string): Promise<DiscoveryCycleReport> {
    const now_fn = this.cfg.now ?? Date.now;
    const t0 = now_fn();
    const started_at_iso = new Date(t0).toISOString();
    const results: DiscoveryCycleAdapterResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const spec of this.cfg.adapters) {
      // Adapter-scoped try/catch guarantees property (e): one adapter failing does not stop others
      let adapter_result: DiscoveryCycleAdapterResult;
      try {
        adapter_result = await this.runAdapterCycle(spec, cycle_id);
      } catch (e) {
        // Defence in depth: even if runAdapterCycle itself throws, we capture
        adapter_result = {
          adapter_ecosystem: spec.adapter.ecosystem,
          cycle_id,
          idempotency_key: deriveIdempotencyKey({
            workflow_id: this.cfg.workflow_id,
            activity_name: `cycle_${spec.adapter.ecosystem}`,
            attempt_id: cycle_id,
          }),
          resources_probed: 0,
          findings_created: 0,
          opportunities_created: 0,
          dispositions_blocked: 0,
          observation_downgrades: 0,
          errors: [`adapter_cycle_uncaught: ${e instanceof Error ? e.message : String(e)}`],
          deadline_expired: false,
          duration_ms: 0,
        };
      }
      results.push(adapter_result);
      if (adapter_result.errors.length === 0 && !adapter_result.deadline_expired) succeeded += 1;
      else { failed += 1; this.cfg.on_adapter_failed?.(adapter_result); }
    }

    const t1 = now_fn();
    const report: DiscoveryCycleReport = {
      cycle_id,
      started_at_iso,
      completed_at_iso: new Date(t1).toISOString(),
      duration_ms: t1 - t0,
      adapters: results,
      totals: {
        resources_probed: results.reduce((n, r) => n + r.resources_probed, 0),
        findings_created: results.reduce((n, r) => n + r.findings_created, 0),
        opportunities_created: results.reduce((n, r) => n + r.opportunities_created, 0),
        adapters_succeeded: succeeded,
        adapters_failed: failed,
      },
    };
    this.cycle_reports.push(report);
    this.cfg.on_cycle_completed?.(report);
    return report;
  }

  private async runAdapterCycle(spec: AdapterSpec, cycle_id: string): Promise<DiscoveryCycleAdapterResult> {
    const now_fn = this.cfg.now ?? Date.now;
    const t0 = now_fn();
    // Property (a) · deterministic idempotency key per adapter+cycle
    const idempotency_key = deriveIdempotencyKey({
      workflow_id: this.cfg.workflow_id,
      activity_name: `cycle_${spec.adapter.ecosystem}`,
      attempt_id: cycle_id,
    });
    // Property (b) · duplicate cycle detection
    if (this.processed_cycle_keys.has(idempotency_key)) {
      return {
        adapter_ecosystem: spec.adapter.ecosystem,
        cycle_id,
        idempotency_key,
        resources_probed: 0,
        findings_created: 0,
        opportunities_created: 0,
        dispositions_blocked: 0,
        observation_downgrades: 0,
        errors: [],
        deadline_expired: false,
        duration_ms: now_fn() - t0,
      };
    }
    this.processed_cycle_keys.add(idempotency_key);

    // Property (c) · bounded per-source work via deadline
    const deadline = createDeadline(
      this.cfg.per_adapter_deadline_ms,
      `adapter:${spec.adapter.ecosystem}:${cycle_id}`,
      t0,
    );
    const errors: string[] = [];
    let findings_created = 0;
    let opportunities_created = 0;
    let dispositions_blocked = 0;
    let observation_downgrades = 0;
    let resources_probed = 0;
    let deadline_expired = false;

    try {
      // Step 1 · list bounded resources (property c)
      const listed = await spec.adapter.listResources({
        ...spec.discovery_query,
        limit: this.cfg.max_resources_per_adapter_per_cycle,
      });
      const to_probe = listed.slice(0, this.cfg.max_resources_per_adapter_per_cycle);

      // Step 2 · audit each resource · bounded by deadline
      for (const resource of to_probe) {
        if (isExpired(deadline, now_fn())) { deadline_expired = true; break; }
        resources_probed += 1;
        try {
          const declared = spec.extract_declared_license(resource.metadata as Record<string, unknown>);
          const finding = await auditRepository({
            resource,
            view: null,                  // metadata-only in continuous loop (Rule 5o.R)
            declared_license_spdx: declared.spdx,
            declared_license_text: declared.text,
            workflow_id: this.cfg.workflow_id,
            activity_name: `discovery_${spec.adapter.ecosystem}`,
            attempt_id: `${cycle_id}#${resource.id}`,
            user_relevance: spec.default_user_relevance ?? 0.4,
            nex_relevance: spec.default_nex_relevance ?? 0.5,
            novelty_score: spec.default_novelty_score ?? 0.5,
          });
          findings_created += 1;
          this.cfg.on_finding_created?.(finding);

          // Step 3 · bridge to Opportunity if disposition warrants (Wave 8.B path)
          const outcome = bridgeEcosystemFindingToOpportunity(finding, {
            actor: `continuous-discovery:${cycle_id}`,
            workflow_id: this.cfg.workflow_id,
            opportunity_store: this.cfg.opportunity_store,
          });
          if (outcome.kind === "opportunity_created") opportunities_created += 1;
          else if (outcome.kind === "downgraded_to_observation") observation_downgrades += 1;
          else if (outcome.kind === "disposition_blocked") dispositions_blocked += 1;
          // Property (h) · NO Product Candidate creation in continuous loop
        } catch (e) {
          // Property (d) · per-resource error is captured, does not abort adapter cycle
          errors.push(`resource=${resource.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      // Final deadline check after loop
      try { assertNotExpired(deadline, `adapter:${spec.adapter.ecosystem}:${cycle_id}`, now_fn()); }
      catch (e) {
        if (e instanceof DeadlineExceededError) deadline_expired = true;
        else throw e;
      }
    } catch (e) {
      // Property (d) · adapter-level error captured as typed error
      const is_deadline = e instanceof DeadlineExceededError;
      if (is_deadline) deadline_expired = true;
      else errors.push(`adapter_error: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      adapter_ecosystem: spec.adapter.ecosystem,
      cycle_id,
      idempotency_key,
      resources_probed,
      findings_created,
      opportunities_created,
      dispositions_blocked,
      observation_downgrades,
      errors,
      deadline_expired,
      duration_ms: now_fn() - t0,
    };
  }

  cycles(): ReadonlyArray<DiscoveryCycleReport> { return this.cycle_reports; }
  latestCycle(): DiscoveryCycleReport | null {
    return this.cycle_reports.length === 0 ? null : this.cycle_reports[this.cycle_reports.length - 1];
  }

  _resetForTests(): void {
    this.cycle_seq = 0;
    this.cycle_reports = [];
    this.processed_cycle_keys.clear();
  }
}
