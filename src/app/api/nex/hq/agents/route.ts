// WO-HQ-AGENTS-01 · API route serving the HQ agents live snapshot.
//
// READ-ONLY. GET only. Reads exclusively from the allowlisted collections
// declared in the agent registry. Never writes, signs, activates, or
// mutates anything.

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY, READABLE_COLLECTIONS } from "@/lib/nex-hq-agents/registry";
import { deriveSnapshot } from "@/lib/nex-hq-agents/derive-snapshot";
import type { AcademyStateSummary, AgentSnapshot, HqAgentsSnapshotResponse } from "@/lib/nex-hq-agents/types";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { AcademyRecord, NoticeRecord } from "@/lib/nex-academy/types";
import type { TrainingProgram, TrainingRun, TrainingVerdict } from "@/lib/nex-academy/training/types";
import type { AgentHeartbeat, AgentHealthCheck } from "@/lib/nex-hq-heartbeat/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET · returns a fresh snapshot of every named agent.
export async function GET(): Promise<Response> {
  const store = getStorage();
  const now = new Date();
  const agents: AgentSnapshot[] = [];

  // Batch-load Academy state (read-only)
  let allAcademyRecords: AcademyRecord[] = [];
  try {
    allAcademyRecords = await store.query<AcademyRecord>(COLLECTIONS.nex_academy_agents, { limit: 1000 });
  } catch { allAcademyRecords = []; }
  const academyByAgent = new Map<string, AcademyRecord>(
    allAcademyRecords.map((r) => [r.agent_id, r]),
  );
  let allNotices: NoticeRecord[] = [];
  try {
    allNotices = await store.query<NoticeRecord>(COLLECTIONS.nex_academy_notices, { limit: 5000 });
  } catch { allNotices = []; }

  // WO-ACADEMY-02 · training programs + runs + latest verdicts
  let allPrograms: TrainingProgram[] = [];
  let allRuns: TrainingRun[] = [];
  let allVerdicts: TrainingVerdict[] = [];
  try {
    allPrograms = await store.query<TrainingProgram>(COLLECTIONS.nex_academy_training_programs, { limit: 5000 });
  } catch { allPrograms = []; }
  try {
    allRuns = await store.query<TrainingRun>(COLLECTIONS.nex_academy_training_runs, { limit: 5000 });
  } catch { allRuns = []; }
  try {
    allVerdicts = await store.query<TrainingVerdict>(COLLECTIONS.nex_academy_training_verdicts, { limit: 5000, order_by: "verdict_id", order_dir: "desc" });
  } catch { allVerdicts = []; }

  const runsByRunId = new Map<string, TrainingRun>();
  for (const r of allRuns) runsByRunId.set(r.run_id, r);
  const programsByProgramId = new Map<string, TrainingProgram>();
  for (const p of allPrograms) programsByProgramId.set(p.program_id, p);

  const programsByAgent = new Map<string, TrainingProgram[]>();
  for (const p of allPrograms) {
    const arr = programsByAgent.get(p.target_agent_id) ?? [];
    arr.push(p);
    programsByAgent.set(p.target_agent_id, arr);
  }

  const latestVerdictByAgent = new Map<string, { verdict: TrainingVerdict; program: TrainingProgram }>();
  // Verdicts are sorted DESC — first hit per agent is the latest
  for (const v of allVerdicts) {
    const run = runsByRunId.get(v.run_id);
    if (!run) continue;
    const program = programsByProgramId.get(run.program_id);
    if (!program) continue;
    if (!latestVerdictByAgent.has(run.agent_id)) {
      latestVerdictByAgent.set(run.agent_id, { verdict: v, program });
    }
  }

  // WO-HQ-HEARTBEAT-01 · latest heartbeat + health-check per agent
  let allHeartbeats: AgentHeartbeat[] = [];
  let allHealthChecks: AgentHealthCheck[] = [];
  try { allHeartbeats = await store.query<AgentHeartbeat>(COLLECTIONS.nex_hq_agent_heartbeats, { limit: 5000, order_by: "observed_at", order_dir: "desc" }); } catch { allHeartbeats = []; }
  try { allHealthChecks = await store.query<AgentHealthCheck>(COLLECTIONS.nex_hq_agent_health_checks, { limit: 5000, order_by: "checked_at", order_dir: "desc" }); } catch { allHealthChecks = []; }
  const latestHeartbeatByAgent = new Map<string, AgentHeartbeat>();
  for (const h of allHeartbeats) if (!latestHeartbeatByAgent.has(h.agent_id)) latestHeartbeatByAgent.set(h.agent_id, h);
  const latestHealthByAgent = new Map<string, AgentHealthCheck>();
  for (const c of allHealthChecks) if (!latestHealthByAgent.has(c.agent_id)) latestHealthByAgent.set(c.agent_id, c);

  for (const agent of AGENT_REGISTRY) {
    // Defensive: assert the collection we're about to read is in the
    // allowlist. This is redundant with registry construction (registry
    // pulls from COLLECTIONS) but makes tampering more visible.
    if (!READABLE_COLLECTIONS.includes(agent.source_collection)) {
      continue;
    }
    let records: Record<string, unknown>[] = [];
    try {
      records = await store.query<Record<string, unknown>>(agent.source_collection, {
        limit: 100,
        order_by: mostLikelyOrderField(agent.source_collection),
        order_dir: "desc",
      });
    } catch {
      // If the collection doesn't exist yet, records = []. That's the
      // WAITING state — do not throw, do not fabricate.
      records = [];
    }
    // Strip potentially-secret fields before returning to the client.
    const safeRecords = records.map((r) => scrubSecrets(r));

    // Academy overlay (WO-ACADEMY-01 · read-only summary)
    const academyRecord = academyByAgent.get(agent.id) ?? null;
    const agentPrograms = programsByAgent.get(agent.id) ?? [];
    const agentLatestVerdict = latestVerdictByAgent.get(agent.id) ?? null;
    const academy: AcademyStateSummary | null = academyRecord
      ? {
          career_state: academyRecord.career_state,
          task_completion_score: academyRecord.task_completion_score,
          knowledge_contribution_score: academyRecord.knowledge_contribution_score,
          regression_score: academyRecord.regression_score,
          notice_count: academyRecord.notice_count,
          capability_profile_version: academyRecord.capability_profile_version,
          open_notices: allNotices
            .filter((n) => n.agent_id === agent.id)
            .slice(0, 3)
            .map((n) => ({ kind: n.kind, reason: n.reason, issued_at: n.issued_at })),
          training: {
            active_programs: agentPrograms.length,
            last_verdict: agentLatestVerdict
              ? {
                  kind: agentLatestVerdict.verdict.kind,
                  at: (agentLatestVerdict.verdict as unknown as { verdict_id?: string }).verdict_id?.slice(0, 24) ?? "",
                  targeted_weakness: agentLatestVerdict.program.targeted_weakness,
                }
              : null,
          },
        }
      : null;
    // WO-HQ-HEARTBEAT-01 overlay
    const hb = latestHeartbeatByAgent.get(agent.id) ?? null;
    const hc = latestHealthByAgent.get(agent.id) ?? null;
    const heartbeat = hb ? {
      state: hb.derived_state,
      reason: hb.derivation_reason,
      observed_at: hb.observed_at,
      liveness_alive: hb.liveness_signal.is_alive,
      liveness_age_ms: hb.liveness_signal.age_ms,
      progress_has_mission: hb.progress_signal.has_active_mission,
      progress_mission_id: hb.progress_signal.mission_id,
      progress_age_ms: hb.progress_signal.age_since_progress_ms,
      last_action: hc?.action_taken ?? "NONE",
      last_action_reason: hc?.reason ?? "",
    } : null;

    agents.push({ ...deriveSnapshot({ agent, records: safeRecords, now, academy }), heartbeat });
  }

  const wire: HqAgentsSnapshotResponse["wire"] = AGENT_REGISTRY.flatMap((a) =>
    a.wire_downstream.map((to) => ({ from: a.id, to })),
  );

  const response: HqAgentsSnapshotResponse = {
    record_type: "NEX_HQ_AGENTS_SNAPSHOT",
    generated_at: now.toISOString(),
    agents,
    wire,
  };
  return NextResponse.json(response, { status: 200 });
}

// Any non-GET method is refused (no control surface).
export async function POST(): Promise<Response> { return methodNotAllowed(); }
export async function PUT(): Promise<Response> { return methodNotAllowed(); }
export async function PATCH(): Promise<Response> { return methodNotAllowed(); }
export async function DELETE(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function mostLikelyOrderField(collection: string): string {
  // Convention: the primary timestamp per collection
  if (collection.includes("audit_events")) return "occurred_at";
  if (collection.includes("workflow_traces")) return "updated_at";
  if (collection.includes("execution_reports")) return "started_at";
  if (collection.includes("build_reports")) return "started_at";
  if (collection.includes("runtime_reports")) return "started_at";
  if (collection.includes("specialist_results")) return "started_at";
  if (collection.includes("sources")) return "fetched_at";
  if (collection.includes("knowledge_objects")) return "created_at";
  if (collection.includes("hypotheses")) return "formed_at";
  if (collection.includes("experiments")) return "run_at";
  if (collection.includes("proposals")) return "emitted_at";
  if (collection.includes("crawler_audit")) return "attempted_at";
  return "created_at";
}

/**
 * Never return secret material to the client. Intelligence records may
 * contain `attestation_signature_hex`, `raw_content_ref`, or auth-related
 * fields — strip them before serialising.
 */
function scrubSecrets(r: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = { ...r };
  const forbidden = ["attestation_signature_hex", "signature", "raw_content_ref", "founder_key_id", "authorization", "signing_key"];
  for (const k of forbidden) if (k in stripped) delete stripped[k];
  return stripped;
}
