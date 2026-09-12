"use client";

// src/app/nexapp/nex-agent/Nex1CapabilityLadder.tsx
//
// NEX1 · MASTER CODE AGENT · Capability Ladder.
//
// Founder directive (2026-09-11):
//   Turn the "master coder" title into something NEX1 has to earn through
//   measurable coding evidence · not a decorative label.
//
// This panel reads from the existing 9-signal autonomy dashboard
// (src/lib/nex-agent/core/autonomy-dashboard.ts · GET /api/nex/agent/autonomy)
// and renders a 0-100 % ladder with:
//   · overall capability % derived from real Postgres competency ledger
//   · 10 milestone levels · 10 % apart
//   · 9-signal evidence checklist (arch · coding · db · security · self-repair ·
//     generalisation · verified production · guardian health · founder-intervention health)
//   · next-tier gap explanation from the dashboard
//   · MASTER CODE AI PROVEN vs NOT YET PROVEN status
//   · Master AI + Claude independent attestation slots (AWAITING until wired)
//
// NEX1 is not called "Master Code AI" in the UI until the ladder reaches 100 %
// AND both Master AI + Claude have independently attested.
//
// This is additive to existing NEX infrastructure · does NOT duplicate the
// autonomy-dashboard.ts logic · reads the same signals founder already sees
// at /nex-head-quarters. Bar movement is evidence-driven · never spoofable.

import { useEffect, useState } from "react";

interface AutonomySignal {
  key: string;
  label: string;
  category: "capability" | "generalisation" | "operational";
  value: number;
  raw: string;
  tier_impact: "LOW" | "MEDIUM" | "HIGH" | "MULTI";
  higher_is_worse?: boolean;
  notes?: string;
}
interface AutonomyDashboard {
  computed_at: string;
  tier: "LOW" | "MEDIUM" | "HIGH";
  next_tier: "LOW" | "MEDIUM" | "HIGH" | null;
  signals: AutonomySignal[];
  unseen_family_coverage: Array<{ family: string; passed: number; total_available: number }>;
  gates: {
    architecture_capability_ok: boolean;
    coding_capability_ok: boolean;
    database_capability_ok: boolean;
    security_capability_ok: boolean;
    self_repair_capability_ok: boolean;
    unseen_all_families_ok: boolean;
    verified_production_ok: boolean;
    guardian_healthy: boolean;
    founder_intervention_healthy: boolean;
  };
  next_tier_gap: string[];
}

// Founder-authored 10-level milestone descriptors · displayed against the bar
const LEVEL_MILESTONES: ReadonlyArray<{ pct: number; label: string }> = [
  { pct:  10, label: "Modify code safely" },
  { pct:  20, label: "Create tested components" },
  { pct:  30, label: "Understand existing architecture" },
  { pct:  40, label: "Integrate multiple NEX systems" },
  { pct:  50, label: "Diagnose + repair failures" },
  { pct:  60, label: "Complete section builds independently" },
  { pct:  70, label: "Self-review architectural mistakes" },
  { pct:  80, label: "Work across Brain · TE · Guardian · Storage · UI · APIs" },
  { pct:  90, label: "Production-ready builds under supervision" },
  { pct: 100, label: "MASTER CODE AI · sustained evidence" },
];

// Weighting matches the tier-derivation intent from autonomy-dashboard.ts:
// capability signals dominate before HIGH tier · operational signals dominate after.
function computeOverallPct(d: AutonomyDashboard): number {
  const get = (k: string) => d.signals.find((s) => s.key === k)?.value ?? 0;
  const arch = get("architecture_competency");
  const coding = get("coding_competency");
  const database = get("database_competency");
  const security = get("security_competency");
  const selfRepair = get("self_repair_competency");
  const unseen = get("unseen_task_success");
  const verifiedProd = get("verified_production_tasks");
  const guardianRej = get("guardian_rejection_rate");     // higher-is-worse
  const interv = get("founder_intervention_rate");          // higher-is-worse

  const capabilityAvg = (arch * 0.15) + (coding * 0.20) + (database * 0.15)
                      + (security * 0.20) + (selfRepair * 0.15) + (unseen * 0.15);
  const opAdjust = (verifiedProd * 0.10)
    - (guardianRej > 40 ? (guardianRej - 40) * 0.5 : 0)
    - (interv > 20 ? (interv - 20) * 0.5 : 0);
  const raw = capabilityAvg + opAdjust;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function allGatesOk(d: AutonomyDashboard): boolean {
  return Object.values(d.gates).every((v) => v === true);
}

type ProvenAttestation = "PROVEN" | "AWAITING" | "PENDING_ATTESTATION";

interface AttestationSlot {
  attested: boolean;
  latest_at: string | null;
  events_count: number;
  latest_reason: string | null;
}
interface AttestationSummary {
  master_ai: AttestationSlot;
  claude: AttestationSlot;
}
interface SkillEntry {
  skill: string;
  level: "bronze" | "silver" | "gold" | "mythic";
  xp: number;
  successes: number;
  failures: number;
  lastExercisedAt: string;
}
interface RecentEvent {
  recorded_at: string;
  domain_key: string | null;
  domain_label: string | null;
  delta: number;
  reason: string;
  evidence_kind: string | null;
  recorded_by: string;
}
interface RecentTask {
  task_id: string;
  submitted_at: string;
  updated_at: string;
  status: string;
  prompt_preview: string;
  submitted_by: string;
}
interface SpeedMetrics {
  tasks_per_24h: number;
  applied_per_24h: number;
  median_time_to_apply_ms: number | null;
  verified_apply_streak: number;
  regression_free_streak: number;
  last_verified_apply_at: string | null;
}
interface LatestVerdict {
  task_id: string | null;
  status: string | null;
  guardian_verdict: "ACCEPT" | "REJECT" | "PENDING" | null;
  ui_dna_verdict: "PASS" | "FAIL" | "PENDING" | null;
  security_verdict: "PASS" | "FAIL" | "PENDING" | null;
  tests_passed: number | null;
  tests_total: number | null;
  self_repair_cycles: number;
  last_step_kind: string | null;
  last_step_at: string | null;
}
interface ActivityState {
  state: "active" | "idle" | "stopped" | "no-data";
  last_step_seconds_ago: number | null;
  active_agent: string | null;
}
interface LivePayload {
  recent_events: RecentEvent[];
  recent_tasks: RecentTask[];
  speed: SpeedMetrics;
  top_skills: SkillEntry[];
  weekly_grade: "A+" | "A" | "B" | "C" | "no-data";
  weekly_reason: string;
  data_source: "postgres+ledger" | "ledger_only" | "empty";
  latest_verdict: LatestVerdict;
  activity: ActivityState;
  self_repair_cycles_24h: number;
}

function fmtRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const d = Math.max(0, now - then);
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600_000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400_000) return `${Math.floor(d / 3600000)}h ago`;
    return `${Math.floor(d / 86400000)}d ago`;
  } catch { return "-"; }
}
function fmtDuration(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
const SKILL_COLORS = { mythic: "#F97316", gold: "#EAB308", silver: "#94A3B8", bronze: "#B45309" } as const;
const GRADE_COLORS = { "A+": "#22C55E", "A": "#22C55E", "B": "#22D3EE", "C": "#F59E0B", "no-data": "#94A3B8" } as const;

export function Nex1CapabilityLadder() {
  const [dashboard, setDashboard] = useState<AutonomyDashboard | null>(null);
  const [attestations, setAttestations] = useState<AttestationSummary | null>(null);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const load = async (): Promise<void> => {
    try {
      const [autonomyRes, attestRes, liveRes] = await Promise.all([
        fetch("/api/nex/agent/autonomy", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/agent/capability/attestations", { cache: "no-store" }).catch(() => null),
        fetch("/api/nex/agent/capability/live", { cache: "no-store" }).catch(() => null),
      ]);
      if (autonomyRes && autonomyRes.ok) {
        const j = (await autonomyRes.json()) as { ok: boolean; dashboard?: AutonomyDashboard; error?: string };
        if (j.ok && j.dashboard) { setDashboard(j.dashboard); setError(null); }
        else { setError(j.error ?? "no data"); setDashboard(null); }
      } else {
        setError(autonomyRes ? `telemetry ${autonomyRes.status}` : "telemetry unreachable");
        setDashboard(null);
      }
      if (attestRes && attestRes.ok) {
        const j = (await attestRes.json()) as { ok: boolean; attestations?: AttestationSummary };
        if (j.attestations) setAttestations(j.attestations);
      }
      if (liveRes && liveRes.ok) {
        const j = (await liveRes.json()) as { ok: boolean; live?: LivePayload };
        if (j.live) setLive(j.live);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 60) : "fetch failed");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 20_000);
    // Instant refresh when any child records an attempt · surfaces the bar move
    const onExternalRefresh = () => { void load(); };
    window.addEventListener("nex1:capability:refresh", onExternalRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("nex1:capability:refresh", onExternalRefresh);
    };
  }, []);

  const overallPct = dashboard ? computeOverallPct(dashboard) : 0;
  const gatesAllOk = dashboard ? allGatesOk(dashboard) : false;
  const proven: ProvenAttestation =
    !dashboard ? "AWAITING"
    : dashboard.tier === "HIGH" && gatesAllOk ? "PENDING_ATTESTATION"  // system-ok · awaiting Master AI + Claude
    : "AWAITING";
  // Attestation slots · read from competency_events.evidence_kind='mentor_promotion'
  const masterAiAttested = attestations?.master_ai.attested ?? false;
  const claudeAttested = attestations?.claude.attested ?? false;
  const trulyMasterCodeAi = proven === "PENDING_ATTESTATION" && masterAiAttested && claudeAttested;

  // ── color scheme ──
  const tierColor = !dashboard ? "#94A3B8"
    : dashboard.tier === "HIGH" ? "#22C55E"
    : dashboard.tier === "MEDIUM" ? "#22D3EE"
    : "#F97316";
  const barGlow = trulyMasterCodeAi ? "0 0 24px rgba(34, 197, 94, 0.55)"
    : proven === "PENDING_ATTESTATION" ? "0 0 18px rgba(34, 211, 238, 0.4)"
    : "0 0 12px rgba(249, 115, 22, 0.28)";

  const evidenceRows = dashboard ? [
    { key: "architecture", label: "Architecture reading", ok: dashboard.gates.architecture_capability_ok, sig: dashboard.signals.find((s) => s.key === "architecture_competency") },
    { key: "coding",       label: "Coding capability",    ok: dashboard.gates.coding_capability_ok,       sig: dashboard.signals.find((s) => s.key === "coding_competency") },
    { key: "database",     label: "Database reasoning",   ok: dashboard.gates.database_capability_ok,     sig: dashboard.signals.find((s) => s.key === "database_competency") },
    { key: "security",     label: "Security reasoning",   ok: dashboard.gates.security_capability_ok,     sig: dashboard.signals.find((s) => s.key === "security_competency") },
    { key: "self_repair",  label: "Self-repair",          ok: dashboard.gates.self_repair_capability_ok,  sig: dashboard.signals.find((s) => s.key === "self_repair_competency") },
    { key: "unseen",       label: "Unseen generalisation",ok: dashboard.gates.unseen_all_families_ok,     sig: dashboard.signals.find((s) => s.key === "unseen_task_success") },
    { key: "production",   label: "Verified production",  ok: dashboard.gates.verified_production_ok,     sig: dashboard.signals.find((s) => s.key === "verified_production_tasks") },
    { key: "guardian",     label: "Guardian health",      ok: dashboard.gates.guardian_healthy,           sig: dashboard.signals.find((s) => s.key === "guardian_rejection_rate") },
    { key: "founder_iv",   label: "Founder-rescue health",ok: dashboard.gates.founder_intervention_healthy, sig: dashboard.signals.find((s) => s.key === "founder_intervention_rate") },
  ] : [];

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(11, 18, 32, 0.92))",
      border: `1px solid ${tierColor}44`,
      borderRadius: 12,
      padding: 12,
      boxShadow: barGlow,
      fontFamily: "Inter, system-ui, sans-serif",
      color: "#F9FAFB",
      marginBottom: 10,
    }}>
      {/* Header · live activity dot + title + collapse */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ position: "relative", fontSize: 16, filter: `drop-shadow(0 0 6px ${tierColor})` }} aria-hidden="true">
            🧠
            {live && (
              <span
                style={{
                  position: "absolute", right: -2, bottom: -2,
                  width: 8, height: 8, borderRadius: 4,
                  background: live.activity.state === "active" ? "#22C55E"
                    : live.activity.state === "idle" ? "#22D3EE"
                    : live.activity.state === "stopped" ? "#94A3B8"
                    : "#64748B",
                  boxShadow: live.activity.state === "active" ? "0 0 6px #22C55E, 0 0 12px #22C55E88" : "none",
                  border: "1.5px solid #0F172A",
                  animation: live.activity.state === "active" ? "nex1CapPulse 1.4s ease-in-out infinite" : "none",
                }}
                title={`${live.activity.state} · ${live.activity.last_step_seconds_ago ?? "?"}s ago${live.activity.active_agent ? " · " + live.activity.active_agent : ""}`}
              />
            )}
          </span>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: tierColor, fontWeight: 800 }}>
              NEX1 · MASTER CODE AGENT
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              {live
                ? `${live.activity.state.toUpperCase()} · ${live.activity.last_step_seconds_ago !== null ? live.activity.last_step_seconds_ago + "s ago" : "no telemetry"}`
                : "Coding capability · evidence-backed · non-spoofable"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: "transparent", border: `1px solid ${tierColor}55`, borderRadius: 6,
            color: tierColor, fontSize: 10, padding: "3px 7px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >{collapsed ? "▸" : "▾"}</button>
      </div>
      <style>{`@keyframes nex1CapPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.75; } }`}</style>

      {loading && !dashboard && (
        <div style={{ fontSize: 11, color: "#94A3B8", padding: "12px 0", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>
          reading telemetry…
        </div>
      )}

      {error && !dashboard && !loading && (
        <div style={{
          fontSize: 10, color: "#F59E0B", background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.28)", borderRadius: 6, padding: 8,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          AWAITING TELEMETRY · {error}
          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 3 }}>
            (Postgres competency ledger unreachable · scale will populate when workers are running)
          </div>
        </div>
      )}

      {dashboard && (
        <>
          {/* Percentage + tier pill */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 800, color: tierColor, fontVariantNumeric: "tabular-nums" }}>{overallPct}</span>
              <span style={{ fontSize: 14, color: tierColor, fontWeight: 600, marginLeft: 2 }}>%</span>
            </div>
            <span style={{
              background: `${tierColor}22`,
              border: `1px solid ${tierColor}66`,
              color: tierColor,
              fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
              padding: "3px 8px", borderRadius: 999, fontFamily: "'JetBrains Mono', monospace",
            }}>Tier · {dashboard.tier}</span>
          </div>

          {/* Progress bar with 10 tick milestones */}
          {!collapsed && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{
                position: "relative", height: 14, background: "rgba(148, 163, 184, 0.12)",
                borderRadius: 7, overflow: "hidden", border: "1px solid rgba(148, 163, 184, 0.18)",
              }}>
                <div style={{
                  position: "absolute", inset: 0, width: `${overallPct}%`,
                  background: `linear-gradient(90deg, ${tierColor}66, ${tierColor})`,
                  boxShadow: `inset 0 0 8px ${tierColor}88`,
                  transition: "width 0.6s ease",
                }} />
                {/* Tick marks at every 10 % */}
                {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((tick) => (
                  <div key={tick} style={{
                    position: "absolute", top: 0, bottom: 0, left: `${tick}%`,
                    width: 1, background: "rgba(148, 163, 184, 0.35)",
                  }} />
                ))}
              </div>
              {/* Level milestone labels · show which levels have been proven */}
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                {LEVEL_MILESTONES.map((m) => {
                  const achieved = overallPct >= m.pct;
                  return (
                    <div key={m.pct} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      color: achieved ? "#F9FAFB" : "#64748B",
                      opacity: achieved ? 1 : 0.55,
                    }}>
                      <span style={{
                        display: "inline-block", width: 22, textAlign: "right",
                        color: achieved ? tierColor : "#64748B", fontWeight: 700,
                      }}>{m.pct}%</span>
                      <span>{achieved ? "✓" : "○"}</span>
                      <span>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence checklist */}
          {!collapsed && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#F97316", fontWeight: 700, marginBottom: 4,
              }}>Evidence · from Postgres competency ledger</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {evidenceRows.map((r) => (
                  <div key={r.key} style={{
                    display: "flex", alignItems: "center", gap: 6, fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    <span style={{
                      color: r.ok ? "#22C55E" : "#94A3B8",
                      fontSize: 12, width: 12,
                    }}>{r.ok ? "✓" : "○"}</span>
                    <span style={{ flex: 1, color: r.ok ? "#F9FAFB" : "#94A3B8" }}>{r.label}</span>
                    <span style={{
                      color: r.ok ? "#22C55E" : "#94A3B8",
                      fontSize: 9,
                    }}>{r.sig ? `${r.sig.value}%` : "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next-tier gap */}
          {!collapsed && dashboard.next_tier_gap.length > 0 && (
            <div style={{
              background: "rgba(249, 115, 22, 0.06)",
              border: "1px solid rgba(249, 115, 22, 0.24)",
              borderRadius: 6, padding: 6, marginBottom: 10,
            }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#F97316", fontWeight: 700, marginBottom: 3,
              }}>Next-tier gap · what unlocks {dashboard.next_tier ?? "PROVEN"}</div>
              <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 10, color: "#F9FAFB", fontFamily: "'JetBrains Mono', monospace" }}>
                {dashboard.next_tier_gap.map((g, i) => (
                  <li key={i} style={{ marginBottom: 1 }}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Speed · standards · streak */}
          {!collapsed && live && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#22D3EE", fontWeight: 700, marginBottom: 4,
              }}>Speed · standards</div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5,
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <div style={{ background: "rgba(34, 211, 238, 0.06)", border: "1px solid rgba(34, 211, 238, 0.2)", borderRadius: 5, padding: "5px 7px" }}>
                  <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Tasks · 24h</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#22D3EE" }}>{live.speed.tasks_per_24h}</div>
                </div>
                <div style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: 5, padding: "5px 7px" }}>
                  <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Applied · 24h</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E" }}>{live.speed.applied_per_24h}</div>
                </div>
                <div style={{ background: "rgba(148, 163, 184, 0.06)", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: 5, padding: "5px 7px" }}>
                  <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Median apply</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>{fmtDuration(live.speed.median_time_to_apply_ms)}</div>
                </div>
                <div style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: 5, padding: "5px 7px" }}>
                  <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Zero-regression streak</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: live.speed.regression_free_streak > 0 ? "#22C55E" : "#94A3B8" }}>{live.speed.regression_free_streak}</div>
                </div>
              </div>
              <div style={{
                marginTop: 6, display: "flex", alignItems: "center", gap: 6,
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{
                  background: `${GRADE_COLORS[live.weekly_grade]}22`,
                  color: GRADE_COLORS[live.weekly_grade],
                  border: `1px solid ${GRADE_COLORS[live.weekly_grade]}55`,
                  borderRadius: 4, padding: "2px 7px", fontWeight: 800,
                }}>WEEK · {live.weekly_grade}</span>
                <span style={{ flex: 1, color: "#94A3B8", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{live.weekly_reason}</span>
              </div>
            </div>
          )}

          {/* Top skills strip */}
          {!collapsed && live && live.top_skills.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#EAB308", fontWeight: 700, marginBottom: 4,
              }}>Top skills · learning ledger</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {live.top_skills.map((s) => (
                  <span key={s.skill} style={{
                    background: `${SKILL_COLORS[s.level]}18`,
                    border: `1px solid ${SKILL_COLORS[s.level]}55`,
                    color: SKILL_COLORS[s.level],
                    borderRadius: 4, padding: "2px 6px",
                    fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  }} title={`${s.level} · ${s.xp} xp · ${s.successes}✓ / ${s.failures}✗`}>
                    {s.skill} · {s.level.slice(0, 1).toUpperCase()}{s.xp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent movements */}
          {!collapsed && live && live.recent_events.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#22C55E", fontWeight: 700, marginBottom: 4,
              }}>Recent movements</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                {live.recent_events.slice(0, 6).map((e, i) => {
                  const d = Number(e.delta) || 0;   // Postgres numeric returns as string · coerce
                  return (
                  <div key={i} style={{
                    display: "flex", gap: 5, alignItems: "baseline",
                    padding: "2px 4px", borderRadius: 3,
                    background: d > 0 ? "rgba(34, 197, 94, 0.05)" : "rgba(148, 163, 184, 0.05)",
                  }}>
                    <span style={{ color: d > 0 ? "#22C55E" : "#F59E0B", fontWeight: 700, width: 26 }}>
                      {d > 0 ? "+" : ""}{d.toFixed(1)}
                    </span>
                    <span style={{ flex: 1, color: "#F9FAFB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.domain_label ?? e.domain_key ?? "domain"} · {e.reason.slice(0, 40)}
                    </span>
                    <span style={{ color: "#64748B", fontSize: 8 }}>{fmtRelative(e.recorded_at)}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent tasks */}
          {!collapsed && live && live.recent_tasks.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#F97316", fontWeight: 700, marginBottom: 4,
              }}>Recent NEX1 tasks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                {live.recent_tasks.slice(0, 4).map((t) => {
                  const good = ["applied_verified", "migration_applied", "shipped"].includes(t.status);
                  const bad = ["plan_rejected", "migration_failed"].includes(t.status);
                  const c = good ? "#22C55E" : bad ? "#EF4444" : "#22D3EE";
                  return (
                    <div key={t.task_id} style={{
                      padding: "3px 5px", borderRadius: 3,
                      background: `${c}08`, borderLeft: `2px solid ${c}`,
                    }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                        <span style={{ color: c, fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>{t.status}</span>
                        <span style={{ flex: 1, color: "#64748B", fontSize: 8, textAlign: "right" }}>{fmtRelative(t.submitted_at)}</span>
                      </div>
                      <div style={{ color: "#F9FAFB", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.prompt_preview}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standards · latest attempt verdicts */}
          {!collapsed && live && live.latest_verdict.task_id && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "#22C55E", fontWeight: 700, marginBottom: 4,
              }}>Standards · latest attempt</div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 4,
                fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
              }}>
                {[
                  { label: "Guardian", v: live.latest_verdict.guardian_verdict, good: "ACCEPT" },
                  { label: "UI DNA", v: live.latest_verdict.ui_dna_verdict, good: "PASS" },
                  { label: "Security", v: live.latest_verdict.security_verdict, good: "PASS" },
                ].map((g) => {
                  const ok = g.v === g.good;
                  const bad = g.v && g.v !== g.good && g.v !== "PENDING";
                  const pending = !g.v || g.v === "PENDING";
                  const color = ok ? "#22C55E" : bad ? "#EF4444" : "#94A3B8";
                  return (
                    <span key={g.label} style={{
                      background: `${color}12`,
                      border: `1px solid ${color}55`,
                      color, borderRadius: 4, padding: "2px 6px", fontWeight: 700,
                    }}>{ok ? "✓" : bad ? "✗" : "…"} {g.label}{pending ? " · pending" : ""}</span>
                  );
                })}
                {live.latest_verdict.tests_total !== null && (
                  <span style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    border: "1px solid rgba(34, 197, 94, 0.55)",
                    color: (live.latest_verdict.tests_passed ?? 0) === live.latest_verdict.tests_total ? "#22C55E" : "#F59E0B",
                    borderRadius: 4, padding: "2px 6px", fontWeight: 700,
                  }}>
                    Tests {live.latest_verdict.tests_passed}/{live.latest_verdict.tests_total}
                  </span>
                )}
                {live.latest_verdict.self_repair_cycles > 0 && (
                  <span style={{
                    background: "rgba(34, 211, 238, 0.12)",
                    border: "1px solid rgba(34, 211, 238, 0.55)",
                    color: "#22D3EE",
                    borderRadius: 4, padding: "2px 6px", fontWeight: 700,
                  }} title="Positive evidence · NEX1 diagnosed & repaired its own failure">
                    Self-repair ×{live.latest_verdict.self_repair_cycles}
                  </span>
                )}
                <span style={{
                  background: "rgba(148, 163, 184, 0.12)",
                  border: "1px solid rgba(148, 163, 184, 0.35)",
                  color: "#94A3B8", borderRadius: 4, padding: "2px 6px",
                }}>Status · {live.latest_verdict.status}</span>
              </div>
              {live.self_repair_cycles_24h > 0 && (
                <div style={{ marginTop: 4, fontSize: 9, color: "#22D3EE", fontFamily: "'JetBrains Mono', monospace" }}>
                  +{live.self_repair_cycles_24h} self-repair cycles in last 24h (positive evidence)
                </div>
              )}
            </div>
          )}

          {/* Master AI · Claude · attestation footer */}
          <div style={{
            borderTop: `1px solid ${tierColor}33`, paddingTop: 8,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: masterAiAttested ? "#22C55E" : "#94A3B8", width: 12, fontSize: 12 }}>{masterAiAttested ? "✓" : "○"}</span>
                <span style={{ flex: 1 }}>Master AI Engineer</span>
                <span style={{ fontSize: 9, color: masterAiAttested ? "#22C55E" : "#F59E0B", fontWeight: 700 }}>
                  {masterAiAttested ? "CONFIRMED" : "AWAITING"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: claudeAttested ? "#22C55E" : "#94A3B8", width: 12, fontSize: 12 }}>{claudeAttested ? "✓" : "○"}</span>
                <span style={{ flex: 1 }}>Claude · independent reviewer</span>
                <span style={{ fontSize: 9, color: claudeAttested ? "#22C55E" : "#F59E0B", fontWeight: 700 }}>
                  {claudeAttested ? "CONFIRMED" : "AWAITING"}
                </span>
              </div>
            </div>
            <div style={{
              padding: "6px 8px", borderRadius: 6,
              background: trulyMasterCodeAi ? "rgba(34, 197, 94, 0.10)" : "rgba(148, 163, 184, 0.08)",
              border: trulyMasterCodeAi ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid rgba(148, 163, 184, 0.24)",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase",
                color: trulyMasterCodeAi ? "#22C55E" : "#94A3B8",
              }}>
                {trulyMasterCodeAi ? "MASTER CODE AI · PROVEN" : "MASTER CODE AI · NOT YET PROVEN"}
              </div>
              {!trulyMasterCodeAi && (
                <div style={{ fontSize: 9, color: "#64748B", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  {proven === "PENDING_ATTESTATION"
                    ? "System evidence complete · awaiting independent Master AI + Claude attestation"
                    : "Evidence-driven promotion · title cannot be granted by claim"}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
