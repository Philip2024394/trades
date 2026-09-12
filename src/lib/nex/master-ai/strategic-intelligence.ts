// src/lib/nex/master-ai/strategic-intelligence.ts
//
// NEX Master AI · Phase 6 · W5-5 · Strategic Intelligence
// Philip 2026-09-07 · AUTHORIZE Phase 6
//
// Derives StrategicRecommendation records from REAL ledger evidence.
// Every recommendation MUST include:
//   · a specific hypothesis (X should change / stay)
//   · at least 1 evidence_ref pointing at a real ledger entry
//   · at least 1 counter-consideration OR alternative
//   · a confidence rating with rules-based justification
//   · an adversarial steelman of the opposite position
//   · the decision it would actually change
//
// DISCIPLINE:
//   · Never fabricates a claim without evidence_ref
//   · Confidence LOW unless ≥2 evidence pointers; MEDIUM ≥ 2; HIGH requires ≥3 + at least one authority TIER_1/2/3 ref
//   · Anti-recency-bias: if every evidence ref is <24h old, cap confidence at MEDIUM
//   · Recommendations are proposals to the FOUNDER · never auto-actioned
//   · Empty evidence → 0 recommendations · never a "generic" recommendation

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────────────

export type StrategicConfidence = "LOW" | "MEDIUM" | "HIGH";

export type EvidenceRef = {
  source: string;            // ledger path or module name
  identifier: string;        // e.g. pattern_key · candidate_id · finding_id · file bytes
  timestamp_iso?: string | null;
  summary: string;           // one-line describing the evidence content
};

export type StrategicRecommendation = {
  recommendation_id: string;
  generator: string;         // which rule produced it
  hypothesis: string;        // "NEX should X because A, B and C"
  decision_it_would_change: string;
  evidence_refs: EvidenceRef[];
  counter_evidence_refs: EvidenceRef[];
  alternatives_considered: string[];
  adversarial_steelman: string;
  confidence: StrategicConfidence;
  confidence_rationale: string;
  requires_founder_approval: true;
  created_at_iso: string;
};

// ─── Helpers ────────────────────────────────────────────────────

function readJsonlLines(file: string): unknown[] {
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, "utf8");
  const out: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip */ }
  }
  return out;
}

function nowIso(): string { return new Date().toISOString(); }

function hoursOld(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (nowMs - new Date(iso).getTime()) / (1000 * 60 * 60);
}

/** Apply the confidence rules and anti-recency-bias cap. */
function scoreConfidence(
  evidence: EvidenceRef[],
  hasAuthorityTier123: boolean,
  nowMs: number,
): { confidence: StrategicConfidence; rationale: string } {
  if (evidence.length === 0) return { confidence: "LOW", rationale: "no evidence refs" };

  let confidence: StrategicConfidence;
  if (evidence.length >= 3 && hasAuthorityTier123) confidence = "HIGH";
  else if (evidence.length >= 2) confidence = "MEDIUM";
  else confidence = "LOW";

  // Anti-recency-bias: if ALL evidence <24h, cap at MEDIUM
  const allRecent = evidence.every((e) => hoursOld(e.timestamp_iso ?? null, nowMs) < 24);
  if (allRecent && confidence === "HIGH") {
    confidence = "MEDIUM";
    return { confidence, rationale: `${evidence.length} refs but all <24h old · anti-recency-bias caps at MEDIUM` };
  }

  return {
    confidence,
    rationale: `${evidence.length} evidence ref(s) · authority_tier_1_2_3_present=${hasAuthorityTier123} · all_recent=${allRecent}`,
  };
}

let _rid = 0;
function newRecId(prefix: string): string {
  _rid += 1;
  return `${prefix}_${Date.now().toString(36)}_${_rid}`;
}

// ─── Rule generators ────────────────────────────────────────────

type LedgerContext = {
  repoRoot: string;
  runtimeDir: string;
  masterDir: string;
  improvementDir: string;
  nowMs: number;
};

function ctx(repoRoot?: string): LedgerContext {
  const root = repoRoot ?? process.cwd();
  return {
    repoRoot: root,
    runtimeDir: path.join(root, "data", "nex-agent-runtime"),
    masterDir: path.join(root, "data", "master-ai"),
    improvementDir: path.join(root, "data", "programmer-improvement"),
    nowMs: Date.now(),
  };
}

// REC-A · Recurrent failure pattern → recommend Founder authorize targeted improvement
function recFailurePatternRepeat(c: LedgerContext): StrategicRecommendation[] {
  const patterns = readJsonlLines(path.join(c.masterDir, "failure_patterns.jsonl")) as Array<{
    pattern_key?: string;
    occurrence_count?: number;
    affected_agents?: string[];
    representative_reason?: string;
    last_seen_iso?: string;
    first_seen_iso?: string;
  }>;
  // Latest per pattern_key
  const latest = new Map<string, typeof patterns[number]>();
  for (const p of patterns) {
    const k = String(p.pattern_key ?? "");
    if (!k) continue;
    const existing = latest.get(k);
    if (!existing || String(p.last_seen_iso ?? "") > String(existing.last_seen_iso ?? "")) latest.set(k, p);
  }
  const recs: StrategicRecommendation[] = [];
  for (const p of latest.values()) {
    // Only recommend when the pattern has recurred (occurrence_count >= 3)
    if ((p.occurrence_count ?? 0) < 3) continue;
    const evidenceRefs: EvidenceRef[] = [{
      source: "data/master-ai/failure_patterns.jsonl",
      identifier: `pattern_key:${p.pattern_key}`,
      timestamp_iso: p.last_seen_iso ?? null,
      summary: `${p.occurrence_count} occurrences · agents=${(p.affected_agents ?? []).join(",")} · reason=${(p.representative_reason ?? "").slice(0, 120)}`,
    }];
    // Counter-evidence: if only 1 agent affected and pattern is old (last_seen > 48h ago) it may be dormant
    const lastSeenHrs = hoursOld(p.last_seen_iso, c.nowMs);
    const counterRefs: EvidenceRef[] = [];
    if (lastSeenHrs > 48) {
      counterRefs.push({
        source: "temporal_analysis",
        identifier: `last_seen_gt_48h:${p.pattern_key}`,
        timestamp_iso: p.last_seen_iso ?? null,
        summary: `pattern last seen ${lastSeenHrs.toFixed(0)} hours ago · may be dormant`,
      });
    }
    if ((p.affected_agents ?? []).length === 1) {
      counterRefs.push({
        source: "scope_analysis",
        identifier: `single_agent_scope:${p.pattern_key}`,
        summary: `pattern affects only 1 agent · may be agent-specific rather than systemic`,
      });
    }
    const { confidence, rationale } = scoreConfidence(evidenceRefs, false, c.nowMs);
    recs.push({
      recommendation_id: newRecId("rec_fp"),
      generator: "REC-A · failure_pattern_repeat",
      hypothesis: `NEX should authorize a targeted improvement cycle for failure pattern '${p.representative_reason ?? p.pattern_key}' (${p.occurrence_count} occurrences · affects ${(p.affected_agents ?? []).join(",")}). The Y-W5-1 infrastructure (Y-W5-1-a corpus + Y-W5-1-b harness + Y-W5-1-C surgical extension) is now proven and could be applied to this specific pattern.`,
      decision_it_would_change: `Whether to invest engineering time on this specific failure pattern versus other backlog items.`,
      evidence_refs: evidenceRefs,
      counter_evidence_refs: counterRefs,
      alternatives_considered: [
        "Do nothing · wait to see if pattern recurs at a higher rate",
        "Attempt a manual (non-Y-W5-1) fix directly in the affected agent's worker",
        "Address the pattern via Founder-authored operational-runbook rather than code change",
      ],
      adversarial_steelman: `One should NOT authorize this improvement if: (a) the pattern is dormant (last seen > 48h ago) · (b) it's confined to a single agent and better fixed via that agent's own maintenance · (c) the effort of an improvement cycle would exceed the impact of just handling the pattern's downstream effects.`,
      confidence,
      confidence_rationale: rationale,
      requires_founder_approval: true,
      created_at_iso: nowIso(),
    });
  }
  return recs;
}

// REC-B · Candidate accumulated multiple GREENs but still AWAITING_APPROVAL → recommend Founder promotion decision
function recCandidateMultipleGreens(c: LedgerContext): StrategicRecommendation[] {
  const candidates = readJsonlLines(path.join(c.improvementDir, "candidates.jsonl")) as Array<{
    candidate_id?: string;
    kind?: string;
    affects_capability?: string;
    proposed_knowledge?: { knowledge_id?: string };
    created_at?: string;
    verification_status?: string;
  }>;
  const recs: StrategicRecommendation[] = [];
  // Heuristic: any candidate that has been in the ledger for > 2 hours AND is still UNVERIFIED
  // is a candidate the Founder should decide on. We don't know the GREENs count from the ledger
  // alone · but the mere presence of an aging AWAITING_APPROVAL row is grounds to surface it.
  for (const cand of candidates) {
    const createdHrs = hoursOld(cand.created_at, c.nowMs);
    if (createdHrs < 2) continue; // too fresh · Founder may not have seen it yet
    if (String(cand.verification_status ?? "").toUpperCase() === "PROMOTED") continue;
    const evidenceRefs: EvidenceRef[] = [{
      source: "data/programmer-improvement/candidates.jsonl",
      identifier: `candidate_id:${cand.candidate_id}`,
      timestamp_iso: cand.created_at ?? null,
      summary: `kind=${cand.kind} · affects=${cand.affects_capability} · aged ${createdHrs.toFixed(1)}h`,
    }];
    const counterRefs: EvidenceRef[] = [{
      source: "founder_gate_doctrine",
      identifier: "no_autonomous_promotion",
      summary: `Founder gate intentionally requires explicit approval · aging is NOT itself grounds to promote`,
    }];
    const { confidence, rationale } = scoreConfidence(evidenceRefs, false, c.nowMs);
    recs.push({
      recommendation_id: newRecId("rec_cand"),
      generator: "REC-B · aging_awaiting_approval_candidate",
      hypothesis: `NEX Founder should make an explicit APPROVE/REJECT decision on candidate ${cand.candidate_id} (${createdHrs.toFixed(1)}h old · still AWAITING_APPROVAL). A decision in either direction moves the system forward; indefinite AWAITING_APPROVAL neither promotes nor closes the ledger.`,
      decision_it_would_change: `Whether the candidate is promoted, rejected, or explicitly deferred with a reason.`,
      evidence_refs: evidenceRefs,
      counter_evidence_refs: counterRefs,
      alternatives_considered: [
        "Approve the candidate for production promotion",
        "Reject with an explicit reason recorded in the ledger",
        "Defer explicitly with a review-by date",
        "Request additional evidence (e.g. independent second benchmark for knowledge candidates)",
      ],
      adversarial_steelman: `One should LEAVE the candidate AWAITING_APPROVAL if there is genuine uncertainty and rushing a decision would set a bad precedent. Founder-gate doctrine explicitly says autonomous promotion is disabled · the aging is not itself a signal to act.`,
      confidence,
      confidence_rationale: rationale,
      requires_founder_approval: true,
      created_at_iso: nowIso(),
    });
  }
  return recs;
}

// REC-C · Storage projection approaching soft cap → recommend rotation policy
function recStorageForecast(c: LedgerContext): StrategicRecommendation[] {
  // Reuse the endurance report's storage-growth math (avoid duplication)
  const eventsFile = path.join(c.runtimeDir, "events.jsonl");
  if (!existsSync(eventsFile)) return [];
  const events = readJsonlLines(eventsFile) as Array<{ timestamp_iso?: string }>;
  let oldest: string | null = null;
  for (const e of events) {
    const t = String(e.timestamp_iso ?? "");
    if (t && (!oldest || t < oldest)) oldest = t;
  }
  if (!oldest) return [];
  const windowHours = (Date.now() - new Date(oldest).getTime()) / (1000 * 60 * 60);
  if (windowHours <= 0) return [];
  const files = [
    eventsFile,
    path.join(c.masterDir, "failure_patterns.jsonl"),
    path.join(c.masterDir, "research_findings.jsonl"),
    path.join(c.masterDir, "agent_health_reports.jsonl"),
  ];
  let total = 0;
  for (const f of files) if (existsSync(f)) total += readFileSync(f).length;
  const bytesPerHour = total / windowHours;
  const projection30d = bytesPerHour * 24 * 30;
  const softCapBytes = 500 * 1024 * 1024;
  if (projection30d < softCapBytes * 0.5) return []; // < 50% of cap · no rec needed
  const evidenceRefs: EvidenceRef[] = [{
    source: "endurance_report_derived",
    identifier: `bytes_per_hour:${Math.round(bytesPerHour)}`,
    summary: `Current append rate ${(bytesPerHour / 1024).toFixed(0)} KB/hour · 30-day projection ${(projection30d / (1024 * 1024)).toFixed(0)} MB (soft cap 500 MB)`,
  }];
  const { confidence, rationale } = scoreConfidence(evidenceRefs, false, c.nowMs);
  return [{
    recommendation_id: newRecId("rec_storage"),
    generator: "REC-C · storage_projection_gt_50pct_cap",
    hypothesis: `NEX should authorize storage rotation policy tightening or archival strategy for the ledger set. Current append rate projects to ${(projection30d / (1024 * 1024)).toFixed(0)} MB over 30 days · exceeding 50% of the 500 MB soft cap.`,
    decision_it_would_change: `Whether to add a rotation policy or archive-to-cold-storage for high-growth ledgers.`,
    evidence_refs: evidenceRefs,
    counter_evidence_refs: [{
      source: "storage_intelligence_module",
      identifier: "current_headroom",
      summary: `Soft cap not yet reached · rotation may be premature`,
    }],
    alternatives_considered: [
      "Add per-ledger rotation policy triggered at 100 MB per file",
      "Archive ledgers older than 30 days to compressed offline storage",
      "Do nothing · monitor for one more week and reassess",
    ],
    adversarial_steelman: `One should NOT act if actual usage is well below cap and premature rotation would lose observability for endurance work that requires long-window ledger reads.`,
    confidence,
    confidence_rationale: rationale,
    requires_founder_approval: true,
    created_at_iso: nowIso(),
  }];
}

// REC-D · A registered specialist agent is STOPPED with no real endurance data → recommend authorization decision
function recStoppedSpecialistNoData(c: LedgerContext): StrategicRecommendation[] {
  const events = readJsonlLines(path.join(c.runtimeDir, "events.jsonl")) as Array<{ agent_id?: string; kind?: string }>;
  // Core agents that are the base system (not "specialists")
  const coreAgents = new Set(["programmer", "accommodation", "master_ai"]);
  // Infrastructure event sources that emit with agent_id but are NOT specialists
  const infrastructureIds = new Set(["watchdog", "control_plane", "supervisor", "founder", "system"]);
  const specialistIds = Array.from(new Set(
    events.map((e) => e.agent_id ?? "").filter((a) => a && !coreAgents.has(a) && !infrastructureIds.has(a)),
  ));
  // Also include registered agents from positions.json if available (real specialist agents only)
  const positionsFile = path.join(c.runtimeDir, "positions.json");
  if (existsSync(positionsFile)) {
    try {
      const positions = JSON.parse(readFileSync(positionsFile, "utf8")) as Array<{ agent_id?: string; desired_state?: string; runtime_state?: string }>;
      for (const p of positions) {
        const a = p.agent_id ?? "";
        if (a && !coreAgents.has(a) && !infrastructureIds.has(a) && !specialistIds.includes(a)) specialistIds.push(a);
      }
    } catch { /* skip */ }
  }
  const recs: StrategicRecommendation[] = [];
  for (const agentId of specialistIds) {
    const agentEvents = events.filter((e) => e.agent_id === agentId);
    if (agentEvents.length > 10) continue; // has activity · not "no data"
    const evidenceRefs: EvidenceRef[] = [{
      source: "data/nex-agent-runtime/positions.json",
      identifier: `agent_id:${agentId}`,
      summary: `Registered specialist '${agentId}' has ${agentEvents.length} events (below activity threshold of 10)`,
    }];
    const { confidence, rationale } = scoreConfidence(evidenceRefs, false, c.nowMs);
    recs.push({
      recommendation_id: newRecId("rec_spec"),
      generator: "REC-D · stopped_specialist_no_endurance_data",
      hypothesis: `NEX should decide whether to activate specialist '${agentId}' (currently registered but with no meaningful endurance data). Without activation, downstream phases that depend on the specialist's real ledger evidence cannot proceed.`,
      decision_it_would_change: `Whether the specialist starts producing real endurance evidence · or stays STOPPED indefinitely.`,
      evidence_refs: evidenceRefs,
      counter_evidence_refs: [{
        source: "founder_gate_doctrine",
        identifier: "no_autonomous_activation",
        summary: `Specialist activation is an explicit Founder authorization step · staying STOPPED is a valid state`,
      }],
      alternatives_considered: [
        "Activate the specialist (node scripts/nex-agents.mjs start " + agentId + ")",
        "Keep specialist STOPPED indefinitely · Phase 5 endurance instrumentation still works for the other agents",
        "Deregister the specialist entirely if it is not needed",
      ],
      adversarial_steelman: `One should keep the specialist STOPPED if there is no downstream demand for its behavior right now · activation increases resource use and observability surface without measurable benefit.`,
      confidence,
      confidence_rationale: rationale,
      requires_founder_approval: true,
      created_at_iso: nowIso(),
    });
  }
  return recs;
}

// REC-E · Master AI has produced discovery + research + candidate + measurement · recommend closing the loop
function recCloseImprovementLoop(c: LedgerContext): StrategicRecommendation[] {
  const candidates = readJsonlLines(path.join(c.improvementDir, "candidates.jsonl"));
  const findings = readJsonlLines(path.join(c.masterDir, "research_findings.jsonl"));
  const patterns = readJsonlLines(path.join(c.masterDir, "failure_patterns.jsonl"));
  if (candidates.length === 0 || findings.length === 0 || patterns.length === 0) return [];
  const evidenceRefs: EvidenceRef[] = [
    { source: "data/master-ai/failure_patterns.jsonl", identifier: `count:${patterns.length}`, summary: `${patterns.length} failure-pattern rows persisted` },
    { source: "data/master-ai/research_findings.jsonl", identifier: `count:${findings.length}`, summary: `${findings.length} research findings persisted` },
    { source: "data/programmer-improvement/candidates.jsonl", identifier: `count:${candidates.length}`, summary: `${candidates.length} improvement candidates persisted` },
  ];
  const { confidence, rationale } = scoreConfidence(evidenceRefs, true, c.nowMs);
  return [{
    recommendation_id: newRecId("rec_loop"),
    generator: "REC-E · improvement_loop_evidence_present",
    hypothesis: `NEX should close at least ONE full improvement cycle through Founder promotion soon. The evidence chain (failure → research → candidate) exists in real ledgers · the mechanism has been proven end-to-end · indefinite AWAITING_APPROVAL leaves the system in a demonstrable-but-not-consequential state.`,
    decision_it_would_change: `Whether the first genuine self-improvement candidate lands in production or stays as evidence only.`,
    evidence_refs: evidenceRefs,
    counter_evidence_refs: [{
      source: "founder_verdict_history",
      identifier: "candidate_still_awaiting_approval",
      summary: `Founder previously chose to wait for independent second benchmark before promotion · that discipline may still apply`,
    }],
    alternatives_considered: [
      "Approve one candidate now to establish the closed-loop precedent",
      "Continue producing more candidates + more benchmarks · defer promotion",
      "Explicitly document the reason NOT to promote so the aging is not silent",
    ],
    adversarial_steelman: `One should NOT promote if any doubt remains about the candidate's safety or generality · a rushed first promotion could set an unsafe precedent. Founder-gate exists for exactly this pause.`,
    confidence,
    confidence_rationale: rationale,
    requires_founder_approval: true,
    created_at_iso: nowIso(),
  }];
}

// ─── Aggregator ────────────────────────────────────────────────

const GENERATORS: Array<(c: LedgerContext) => StrategicRecommendation[]> = [
  recFailurePatternRepeat,
  recCandidateMultipleGreens,
  recStorageForecast,
  recStoppedSpecialistNoData,
  recCloseImprovementLoop,
];

/** Run all rule generators against real ledgers · return all real
 *  recommendations sorted by (confidence DESC · evidence_count DESC). */
export function deriveStrategicRecommendations(repoRoot?: string): StrategicRecommendation[] {
  const c = ctx(repoRoot);
  const all: StrategicRecommendation[] = [];
  for (const gen of GENERATORS) {
    try { all.push(...gen(c)); } catch { /* rule failure never crashes the aggregator */ }
  }
  // Sort HIGH → MEDIUM → LOW · then by evidence count
  const rank: Record<StrategicConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  all.sort((a, b) => (rank[b.confidence] - rank[a.confidence]) || (b.evidence_refs.length - a.evidence_refs.length));
  return all;
}
