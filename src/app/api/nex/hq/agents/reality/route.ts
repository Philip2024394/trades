// WO-LIVE-WORKFORCE-PROOF-01 · Agent Reality Card API.
//
// Founder-locked 2026-09-13: second layer beyond the 15-facet card.
// Answers "is this agent GENUINELY doing something?" with real timestamps
// and evidence pointers · every field backed by a live GB record.

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { loadAllAgentIdentities, loadAgentCapabilityManifest } from "@/lib/nex-agent-runtime/provisioning";
import { AGENT_HEARTBEAT_EVENT_COLLECTION } from "@/lib/nex-agent-runtime/runtime-loop";
import { PERFORMANCE_HISTORY_COLLECTION } from "@/lib/nex-agent-runtime/performance-history";
import { LEARNING_CONTRIBUTION_COLLECTION } from "@/lib/nex-agent-runtime/learning-contribution";
import { agentMemoryCollectionName } from "@/lib/nex-agent-runtime/memory";
import type { AgentHeartbeatEvent, AgentIdentity } from "@/lib/nex-agent-runtime/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AgentRealityCard {
  agent_id: string;
  agent_name: string;
  lane: string;

  // Identity + runtime
  identity_status: "VERIFIED" | "UNPROVISIONED";
  runtime_status: "RUNNING" | "IDLE" | "UNKNOWN";
  identity_id: string | null;

  // Founder-locked colour semantics · observer's derived state maps to a
  // specific colour · WORKING is only green when all 4 conditions hold
  // (mission + heartbeat + progress + evidence).
  heartbeat_state: string;                   // observer's derived state
  colour: "green" | "yellow" | "orange" | "red" | "black" | "grey";
  colour_reason: string;

  // Facet tiers (compact)
  brain_tier: string;
  memory_tier: string;
  tools_tier: string;
  network_tier: string;
  vision_tier: string;

  // Internet reality
  internet_status: "ACTIVE" | "NOT_APPLICABLE" | "IDLE";
  internet_last_success_at: string | null;
  internet_last_source: string | null;
  internet_last_http_status: number | null;
  internet_last_bytes: number | null;
  internet_last_evidence_ref: string | null;

  // Live signals (age from now, seconds)
  current_mission_id: string | null;
  last_heartbeat_age_s: number | null;
  last_meaningful_progress_age_s: number | null;
  last_external_request_age_s: number | null;
  last_memory_update_age_s: number | null;
  last_evidence_age_s: number | null;

  // 1-hour output (real GB counts)
  output_1h: {
    heartbeats: number;
    memory_writes: number;
    performance_records: number;
    learning_contributions: number;
  };

  // NEX contribution (real counts)
  nex_contribution: {
    validated_findings_1h: number;
    proposals_1h: number;
    knowledge_1h: number;
  };
}

interface RealityResponse {
  record_type: "NEX_HQ_AGENT_REALITY";
  generated_at: string;
  observed_window_ms: number;
  observed_window_label: string;
  agents: AgentRealityCard[];
}

function ageSec(nowMs: number, iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / 1000));
}

function labelForWindow(ms: number): string {
  if (ms === 0) return "no observation window yet";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 24 * 3600_000) return `${(ms / 3600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(2)}d`;
}

/**
 * Founder-locked colour semantics 2026-09-13:
 *   🟢 WORKING       real mission + recent heartbeat + progress + evidence
 *   🟡 WAITING       alive, but no authorised work
 *   🟡 BACKING_OFF   agent deliberately respecting source limits
 *   🟠 RATE_LIMITED  external source has limited access
 *   🔴 FAILED        active mission + missing liveness/progress
 *   ⚫ QUARANTINED   governance/security restriction
 *   ⚫ (unknown)     no observer data yet
 *
 * NO heartbeat-only green. WORKING requires the full 4-condition proof
 * elsewhere in the observer; this mapping trusts the observer's decision.
 */
function colourFor(hbState: string, latestHb: AgentHeartbeatEvent | null, now: number): { colour: "green" | "yellow" | "orange" | "red" | "black" | "grey"; reason: string } {
  const isFresh = latestHb ? (now - Date.parse(latestHb.emitted_at) < 120_000) : false;
  const hasProgress = latestHb ? (latestHb.progress_counter > 0 && latestHb.evidence_refs.length > 0) : false;
  const hasMission = latestHb?.mission_id ? true : false;
  const fullWorking = hbState === "WORKING" && isFresh && hasProgress && hasMission;
  if (fullWorking) return { colour: "green", reason: "mission + heartbeat + progress + evidence · all 4 present" };
  if (hbState === "WORKING" && (!isFresh || !hasProgress || !hasMission)) return { colour: "yellow", reason: "heartbeat says WORKING but one of {mission, fresh, progress+evidence} missing · downgraded" };
  if (hbState === "WAITING") return { colour: "yellow", reason: "alive · no authorised work" };
  if (hbState === "BACKING_OFF") return { colour: "yellow", reason: "agent deliberately respecting source limits" };
  if (hbState === "RATE_LIMITED") return { colour: "orange", reason: "external source has limited access" };
  if (hbState === "FAILED" || hbState === "STALLED" || hbState === "NO_LIVENESS_EVIDENCE" || hbState === "PROGRESS_WITHOUT_EVIDENCE" || hbState === "UNATTRIBUTABLE_ACTIVITY") return { colour: "red", reason: `${hbState} · investigate` };
  if (hbState === "ALIVE_NO_PROGRESS") return { colour: "yellow", reason: "heartbeat present · no progress yet" };
  if (hbState === "DEGRADED") return { colour: "orange", reason: "degraded · intermittent failures or resource pressure" };
  if (hbState === "UNVERIFIED") return { colour: "grey", reason: "no positive evidence yet · UNVERIFIED per NO EVIDENCE = NO CLAIM" };
  if (hbState === "ALIVE") return { colour: "yellow", reason: "heartbeat alive · scheduler not yet examined" };
  return { colour: "grey", reason: `unknown state: ${hbState}` };
}

export async function GET(): Promise<Response> {
  const store = getStorage();
  const now = Date.now();
  const oneHour = 3600 * 1000;

  // Load observer's latest per-agent derived state
  const observerHbs = await store.query<{ agent_id?: string; derived_state?: string; observed_at?: string }>("nex_hq_agent_heartbeats", { limit: 5000, order_by: "observed_at", order_dir: "desc" }).catch(() => []);
  const latestObserverStateByAgent = new Map<string, string>();
  for (const h of observerHbs) if (h.agent_id && !latestObserverStateByAgent.has(h.agent_id) && h.derived_state) latestObserverStateByAgent.set(h.agent_id, h.derived_state);

  const identities = await loadAllAgentIdentities();
  const identityByAgent = new Map<string, AgentIdentity>();
  for (const i of identities) if (!identityByAgent.has(i.agent_id)) identityByAgent.set(i.agent_id, i);

  const heartbeats = await store.query<AgentHeartbeatEvent>(AGENT_HEARTBEAT_EVENT_COLLECTION, { limit: 20_000 }).catch(() => []);
  const perfRecords = await store.query<{ agent_id: string; finished_at: string; outcome: string; evidence_refs: readonly string[] }>(PERFORMANCE_HISTORY_COLLECTION, { limit: 10_000 }).catch(() => []);
  const learnRecords = await store.query<{ agent_id: string; proposed_at: string; kind: string }>(LEARNING_CONTRIBUTION_COLLECTION, { limit: 10_000 }).catch(() => []);

  // Compute observed window
  const timestamps: number[] = [];
  for (const h of heartbeats) timestamps.push(Date.parse(h.emitted_at));
  for (const p of perfRecords) timestamps.push(Date.parse(p.finished_at));
  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : now;
  const observed_window_ms = timestamps.length > 0 ? now - oldest : 0;

  const agents: AgentRealityCard[] = [];
  for (const agent of AGENT_REGISTRY) {
    const identity = identityByAgent.get(agent.id) ?? null;
    const cap = await loadAgentCapabilityManifest(agent.id);

    // Memory records
    let memRecords: Array<{ created_at?: string; content?: Record<string, unknown> }> = [];
    try { memRecords = await store.query(agentMemoryCollectionName(agent.id), { limit: 20_000 }); } catch { memRecords = []; }
    const memRecords1h = memRecords.filter((m) => typeof m.created_at === "string" && now - Date.parse(m.created_at) <= oneHour);

    // Heartbeats
    const agentHbs = heartbeats.filter((h) => h.agent_id === agent.id).sort((a, b) => b.emitted_at.localeCompare(a.emitted_at));
    const agentHbs1h = agentHbs.filter((h) => now - Date.parse(h.emitted_at) <= oneHour);
    const latestHb = agentHbs[0] ?? null;
    const latestProgressHb = agentHbs.find((h) => h.progress_counter > 0 && h.evidence_refs.length > 0) ?? null;
    const currentMissionId = latestProgressHb?.mission_id ?? null;

    // Internet reality: find latest heartbeat with an evidence_ref starting "http:"
    const latestHttpHb = agentHbs.find((h) => h.evidence_refs.some((r) => r.startsWith("http:")));
    let httpEvidenceRef: string | null = null;
    let httpStatus: number | null = null;
    if (latestHttpHb) {
      const httpRef = latestHttpHb.evidence_refs.find((r) => r.startsWith("http:")) ?? null;
      httpEvidenceRef = httpRef;
      // Format: http:{hash-16}:{status}
      const m = httpRef?.match(/^http:[a-f0-9]+:(\d+)$/);
      if (m) httpStatus = parseInt(m[1], 10);
    }

    // Latest external request memory record (Crawler writes source_url in content)
    const latestUrl = memRecords.find((m) => typeof (m.content as { source_url?: string })?.source_url === "string");
    const latestSource = latestUrl ? (latestUrl.content as { source_url: string }).source_url : null;
    const latestBytes = latestUrl ? ((latestUrl.content as { bytes?: number })?.bytes ?? null) : null;

    // Performance + learning
    const perf1h = perfRecords.filter((p) => p.agent_id === agent.id && now - Date.parse(p.finished_at) <= oneHour);
    const learn1h = learnRecords.filter((l) => l.agent_id === agent.id && now - Date.parse(l.proposed_at) <= oneHour);

    // Facet tiers
    const tierOf = (f: string): string => cap?.facets.find((x) => x.facet === f)?.tier ?? "CLAIMED";

    // Network status
    const isIntelligence = agent.lane === "intelligence";
    const networkTier = tierOf("network");
    const internetStatus: AgentRealityCard["internet_status"] =
      networkTier === "NOT_APPLICABLE" ? "NOT_APPLICABLE" :
      latestHttpHb ? "ACTIVE" :
      isIntelligence ? "IDLE" : "NOT_APPLICABLE";

    // Runtime status
    const runtimeStatus: AgentRealityCard["runtime_status"] = latestHb
      ? (now - Date.parse(latestHb.emitted_at) < 120_000 ? "RUNNING" : "IDLE")
      : "UNKNOWN";

    // Founder-locked colour mapping · observer's derived state → colour + reason
    const heartbeatState = latestObserverStateByAgent.get(agent.id) ?? "UNVERIFIED";
    const { colour, reason: colourReason } = colourFor(heartbeatState, latestHb ?? null, now);

    agents.push({
      agent_id: agent.id,
      agent_name: agent.name,
      lane: agent.lane,
      identity_status: identity ? "VERIFIED" : "UNPROVISIONED",
      runtime_status: runtimeStatus,
      identity_id: identity?.identity_id ?? null,
      heartbeat_state: heartbeatState,
      colour, colour_reason: colourReason,
      brain_tier: tierOf("brain"),
      memory_tier: tierOf("memory"),
      tools_tier: tierOf("tools"),
      network_tier: networkTier,
      vision_tier: tierOf("vision"),
      internet_status: internetStatus,
      internet_last_success_at: latestHttpHb?.emitted_at ?? null,
      internet_last_source: latestSource,
      internet_last_http_status: httpStatus,
      internet_last_bytes: latestBytes,
      internet_last_evidence_ref: httpEvidenceRef,
      current_mission_id: currentMissionId,
      last_heartbeat_age_s: ageSec(now, latestHb?.emitted_at ?? null),
      last_meaningful_progress_age_s: ageSec(now, latestProgressHb?.emitted_at ?? null),
      last_external_request_age_s: ageSec(now, latestHttpHb?.emitted_at ?? null),
      last_memory_update_age_s: ageSec(now, memRecords[0]?.created_at ?? null),
      last_evidence_age_s: ageSec(now, latestProgressHb?.emitted_at ?? latestHb?.emitted_at ?? null),
      output_1h: {
        heartbeats: agentHbs1h.length,
        memory_writes: memRecords1h.length,
        performance_records: perf1h.length,
        learning_contributions: learn1h.length,
      },
      nex_contribution: {
        validated_findings_1h: learn1h.filter((l) => l.kind === "VALIDATED_LESSON").length,
        proposals_1h: memRecords1h.filter((m) => (m.content as { kind?: string })?.kind === "proposal" || (m.content as { proposal_id?: unknown })?.proposal_id !== undefined).length,
        knowledge_1h: memRecords1h.filter((m) => (m.content as { knowledge_object_id?: unknown })?.knowledge_object_id !== undefined).length,
      },
    });
  }

  const response: RealityResponse = {
    record_type: "NEX_HQ_AGENT_REALITY",
    generated_at: new Date().toISOString(),
    observed_window_ms,
    observed_window_label: labelForWindow(observed_window_ms),
    agents,
  };
  return NextResponse.json(response, { status: 200 });
}

export async function POST(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response { return NextResponse.json({ error: "method_not_allowed" }, { status: 405 }); }
