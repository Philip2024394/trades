// WO-DASHBOARD-24H-KNOWLEDGE-01 · per-agent 24h knowledge flow API.
//
// Computes:
//   - per-agent 24h knowledge update % (validated learning contributions /
//     total knowledge fragments touched in 24h)
//   - work in-flow (records/hour flowing INTO this agent from upstream)
//   - work out-flow (records/hour flowing OUT to downstream)
//   - hourly sparkline of activity for the last 24h (24 buckets)

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY } from "@/lib/nex-hq-agents/registry";
import { AGENT_HEARTBEAT_EVENT_COLLECTION } from "@/lib/nex-agent-runtime/runtime-loop";
import { PERFORMANCE_HISTORY_COLLECTION } from "@/lib/nex-agent-runtime/performance-history";
import { LEARNING_CONTRIBUTION_COLLECTION } from "@/lib/nex-agent-runtime/learning-contribution";
import { agentMemoryCollectionName } from "@/lib/nex-agent-runtime/memory";
import type { AgentHeartbeatEvent } from "@/lib/nex-agent-runtime/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AgentKnowledgeFlow {
  agent_id: string;
  agent_name: string;
  lane: string;
  wire_upstream: readonly string[];       // agents feeding INTO this one
  wire_downstream: readonly string[];     // agents this feeds INTO
  knowledge_update_pct_24h: number;       // 0..100
  memory_records_24h: number;
  learning_contributions_24h: number;
  work_in_per_hour: number;               // records/hour from upstream (average over last 24h)
  work_out_per_hour: number;              // records/hour to downstream
  hourly_activity_24h: readonly number[]; // 24 hourly buckets of signed heartbeat count
}

interface KnowledgeFlowResponse {
  record_type: "NEX_HQ_KNOWLEDGE_FLOW";
  generated_at: string;
  window_ms: number;
  /** Founder-locked 2026-09-13: honest observed window from oldest record on disk.
   *  NEVER a fabricated 24h · zero when nothing has been observed yet. */
  observed_window_ms: number;
  observed_window_label: string;
  agents: readonly AgentKnowledgeFlow[];
}

export async function GET(): Promise<Response> {
  const now = Date.now();
  const oneHour = 3600 * 1000;
  const oneDay = 24 * oneHour;
  const store = getStorage();

  // Build wire index: for each agent, list its upstream agents (agents that
  // have this agent in their wire_downstream).
  const upstreamOf = new Map<string, string[]>();
  for (const a of AGENT_REGISTRY) upstreamOf.set(a.id, []);
  for (const a of AGENT_REGISTRY) {
    for (const down of a.wire_downstream) {
      const arr = upstreamOf.get(down);
      if (arr && !arr.includes(a.id)) arr.push(a.id);
    }
  }

  // Global 24h fetches (bounded)
  const heartbeats24h = (await store.query<AgentHeartbeatEvent>(AGENT_HEARTBEAT_EVENT_COLLECTION, { limit: 20_000 }).catch(() => []))
    .filter((h) => now - Date.parse(h.emitted_at) <= oneDay);
  const perf24h = (await store.query<{ agent_id: string; finished_at: string; items_processed: number }>(PERFORMANCE_HISTORY_COLLECTION, { limit: 10_000 }).catch(() => []))
    .filter((p) => now - Date.parse(p.finished_at) <= oneDay);
  const learn24h = (await store.query<{ agent_id: string; proposed_at: string }>(LEARNING_CONTRIBUTION_COLLECTION, { limit: 10_000 }).catch(() => []))
    .filter((l) => now - Date.parse(l.proposed_at) <= oneDay);

  const agents: AgentKnowledgeFlow[] = [];
  for (const agent of AGENT_REGISTRY) {
    // Per-agent slices
    const agentHbs = heartbeats24h.filter((h) => h.agent_id === agent.id);
    const agentPerf = perf24h.filter((p) => p.agent_id === agent.id);
    const agentLearn = learn24h.filter((l) => l.agent_id === agent.id);

    // Memory records (all-time · we filter 24h below)
    let memRecords: Array<{ created_at?: string }> = [];
    try { memRecords = await store.query(agentMemoryCollectionName(agent.id), { limit: 10_000 }); } catch { memRecords = []; }
    const memRecords24h = memRecords.filter((m) => typeof m.created_at === "string" && now - Date.parse(m.created_at) <= oneDay);

    // Knowledge update % = validated learning contributions / total memory writes (24h)
    const knowledgeDenom = memRecords24h.length;
    const knowledgeNum = agentLearn.length;
    const knowledgePct = knowledgeDenom > 0 ? Math.round((knowledgeNum / knowledgeDenom) * 100) : 0;

    // Work in/out: use downstream/upstream agent's performance records as proxy
    // for "records flowing across the wire". For each upstream agent, count
    // their 24h missions completed → that many records notionally flowed to us.
    const upstream = upstreamOf.get(agent.id) ?? [];
    const workInCount = perf24h.filter((p) => upstream.includes(p.agent_id)).length;
    const workOutCount = perf24h.filter((p) => agent.wire_downstream.includes(p.agent_id)).length;

    // 24h hourly sparkline of heartbeats
    const hourly = new Array<number>(24).fill(0);
    for (const h of agentHbs) {
      const hoursAgo = Math.floor((now - Date.parse(h.emitted_at)) / oneHour);
      if (hoursAgo >= 0 && hoursAgo < 24) hourly[23 - hoursAgo]++;   // index 0 = 23h ago; index 23 = last hour
    }

    agents.push({
      agent_id: agent.id,
      agent_name: agent.name,
      lane: agent.lane,
      wire_upstream: Object.freeze([...upstream]) as readonly string[],
      wire_downstream: agent.wire_downstream,
      knowledge_update_pct_24h: knowledgePct,
      memory_records_24h: memRecords24h.length,
      learning_contributions_24h: agentLearn.length,
      work_in_per_hour: workInCount / 24,
      work_out_per_hour: workOutCount / 24,
      hourly_activity_24h: Object.freeze(hourly) as readonly number[],
    });
  }

  // Founder-locked: compute REAL observed window from oldest signed evidence on disk.
  // Do not display "24h" if the system has only been alive for 3 minutes.
  const timestampSources: number[] = [];
  for (const h of heartbeats24h) timestampSources.push(Date.parse(h.emitted_at));
  for (const p of perf24h) timestampSources.push(Date.parse(p.finished_at));
  for (const l of learn24h) timestampSources.push(Date.parse(l.proposed_at));
  const oldest = timestampSources.length > 0 ? Math.min(...timestampSources) : now;
  const observed_window_ms = timestampSources.length > 0 ? now - oldest : 0;
  const observed_window_label = observed_window_ms === 0
    ? "no observation window yet"
    : observed_window_ms < 60_000
      ? `${Math.floor(observed_window_ms / 1000)} seconds`
      : observed_window_ms < 3600_000
        ? `${Math.floor(observed_window_ms / 60_000)} minutes`
        : observed_window_ms < oneDay
          ? `${(observed_window_ms / 3600_000).toFixed(1)} hours`
          : `${(observed_window_ms / oneDay).toFixed(2)} days`;

  const response: KnowledgeFlowResponse = {
    record_type: "NEX_HQ_KNOWLEDGE_FLOW",
    generated_at: new Date().toISOString(),
    window_ms: oneDay,
    observed_window_ms,
    observed_window_label,
    agents,
  };
  return NextResponse.json(response, { status: 200 });
}

export async function POST(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response { return NextResponse.json({ error: "method_not_allowed" }, { status: 405 }); }
