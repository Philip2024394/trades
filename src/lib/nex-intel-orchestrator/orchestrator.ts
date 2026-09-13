// WO-INTEL-ORCHESTRATOR-01 · orchestrator main entry point.
//
// One "tick" reads the current mandate + current state, decides via the
// pure scheduler, builds the mission via the dispatcher, and returns
// the mission outcome. Called externally by the tick API route.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { loadLatestMandate, verifyMandate } from "./mandate";
import { decideNextMission } from "./scheduler";
import { buildMission, dispatchMission, type DispatchInput } from "./dispatcher";
import type {
  IntelligenceMission,
  IntelligenceOperatingMandate,
  MissionOutcome,
} from "./types";
import type { CrawlerManifest } from "@/lib/nex-intelligence/types";

export interface OrchestratorTickInput {
  readonly at_time?: Date;
  /** Test-only or dev-only override for the crawler HTTP layer. */
  readonly _http_override?: DispatchInput["_http_override"];
  /** Test-only override for the mandate. */
  readonly _mandate?: IntelligenceOperatingMandate;
  readonly trusted_attestation_keys?: readonly string[];
  readonly crawler_manifest: CrawlerManifest;
  readonly sandbox_root: string;
  readonly fetch_url: string;
}

export type OrchestratorTickResult =
  | { readonly kind: "DISPATCHED"; readonly mission: IntelligenceMission; readonly outcome: MissionOutcome }
  | { readonly kind: "NO_MISSION"; readonly reason: string }
  | { readonly kind: "REFUSED_MANDATE_INVALID"; readonly reason: string };

export async function runOrchestratorTick(input: OrchestratorTickInput): Promise<OrchestratorTickResult> {
  const now = input.at_time ?? new Date();

  const mandate = input._mandate ?? await loadLatestMandate();
  if (!mandate) {
    return { kind: "REFUSED_MANDATE_INVALID", reason: "no mandate persisted · founder must sign an IntelligenceOperatingMandate first" };
  }
  if (!verifyMandate(mandate, input.trusted_attestation_keys)) {
    return { kind: "REFUSED_MANDATE_INVALID", reason: "mandate signature invalid" };
  }

  const state = await measureState(mandate, now);

  const decision = decideNextMission({
    mandate,
    active_missions_count: state.activeMissions,
    missions_in_last_24h_count: state.missions24h,
    stale_knowledge_count: state.staleKnowledge,
    unresolved_contradictions_count: state.contradictions,
    hypotheses_awaiting_experiment_count: state.pendingHypotheses,
    crawler_quota_remaining_today: state.crawlerQuotaRemaining,
    at_time_ms: now.getTime(),
  });

  if (decision.kind === "NO_MISSION") {
    return { kind: "NO_MISSION", reason: decision.reason };
  }

  const mission = buildMission({
    mandate,
    work_class: decision.work_class,
    antecedent_provenance_hashes: [mandate.provenance_chain_hash],
  });
  const outcome = await dispatchMission({
    mandate,
    mission,
    trusted_attestation_keys: input.trusted_attestation_keys,
    crawler_manifest: input.crawler_manifest,
    sandbox_root: input.sandbox_root,
    fetch_url: input.fetch_url,
    _http_override: input._http_override,
  });
  return { kind: "DISPATCHED", mission, outcome };
}

// ── Internal state measurement ────────────────────────────────────────

async function measureState(mandate: IntelligenceOperatingMandate, now: Date): Promise<{
  activeMissions: number;
  missions24h: number;
  staleKnowledge: number;
  contradictions: number;
  pendingHypotheses: number;
  crawlerQuotaRemaining: number;
}> {
  const store = getStorage();
  // active missions = mandate-scoped missions with future expiry AND no outcome yet
  let missions: { mandate_id?: string; mission_id?: string; expires_at?: string; created_at?: string }[] = [];
  try { missions = await store.query(COLLECTIONS.nex_intel_missions, { limit: 500 }); } catch { missions = []; }
  let outcomes: { mission_id?: string; started_at?: string }[] = [];
  try { outcomes = await store.query(COLLECTIONS.nex_intel_mission_outcomes, { limit: 500 }); } catch { outcomes = []; }

  const outcomesByMission = new Set(outcomes.map((o) => o.mission_id));
  const nowMs = now.getTime();
  const cutoff = nowMs - 24 * 3600 * 1000;

  const scoped = missions.filter((m) => m.mandate_id === mandate.mandate_id);
  const activeMissions = scoped.filter((m) => !outcomesByMission.has(m.mission_id) && m.expires_at && Date.parse(m.expires_at) > nowMs).length;
  const missions24h = scoped.filter((m) => m.created_at && Date.parse(m.created_at) >= cutoff).length;

  const crawlerQuotaRemaining = Math.max(0, mandate.max_daily_missions - missions24h);

  // Slice-1: use conservative estimates (0) for the intelligence-state signals
  // so the crawler-quota path fires. Slice-2 wires these to real Intelligence
  // Library queries (revisit_scheduled_at, contradictions, pending hypotheses).
  return {
    activeMissions,
    missions24h,
    staleKnowledge: 0,
    contradictions: 0,
    pendingHypotheses: 0,
    crawlerQuotaRemaining,
  };
}
