// WO-HQ-AGENTS-01 · NEX HQ Agents live-observation page
//
// Route: /nex-head-quarters/agents
// Read-only. Polls /api/nex/hq/agents every 5 seconds. Shows 14 named
// agents across two lanes with lifecycle state, health, and non-normal
// state reasons per Continuous Operation Doctrine §2.
//
// No control surface. No signing helper imported. No writes anywhere.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AgentSnapshot, HqAgentsSnapshotResponse } from "@/lib/nex-hq-agents/types";
import "../../nex-app/nex-app.css";

const DEFAULT_POLL_MS = 5000;
const MIN_POLL_MS = 1000;
const MAX_POLL_MS = 60000;

const TOKEN = {
  bg:          "var(--nex-cream)",
  card:        "var(--nex-neutral-0)",
  border:      "var(--nex-neutral-200)",
  divider:     "var(--nex-neutral-100)",
  text:        "var(--nex-neutral-900)",
  textSoft:    "var(--nex-neutral-500)",
  textMid:     "var(--nex-neutral-700)",
  accent:      "var(--nex-accent-500)",
  success:     "var(--nex-success-500)",
  warning:     "var(--nex-warning-500)",
  danger:      "var(--nex-danger-500, #dc2626)",
  info:        "var(--nex-info-500)",
  shadowSm:    "var(--nex-shadow-sm)",
};

const HEALTH_COLOUR: Record<AgentSnapshot["health"], string> = {
  green: TOKEN.success,
  amber: TOKEN.warning,
  red:   TOKEN.danger,
  grey:  TOKEN.textSoft,
};

function parsePollInterval(): number {
  if (typeof window === "undefined") return DEFAULT_POLL_MS;
  const p = new URLSearchParams(window.location.search).get("poll");
  if (!p) return DEFAULT_POLL_MS;
  const n = Number(p.replace(/ms$/, ""));
  if (!Number.isFinite(n)) return DEFAULT_POLL_MS;
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, n));
}

export default function HqAgentsPage() {
  const [snapshot, setSnapshot] = useState<HqAgentsSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/hq/agents", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HqAgentsSnapshotResponse;
      setSnapshot(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = parsePollInterval();
    const id = setInterval(load, interval);
    return () => clearInterval(id);
  }, [load]);

  const orchestratorAgents = snapshot?.agents.filter((a) => a.lane === "orchestrator") ?? [];
  const intelligenceAgents = snapshot?.agents.filter((a) => a.lane === "intelligence") ?? [];

  return (
    <div style={{ minHeight: "100vh", background: TOKEN.bg, padding: "24px", color: TOKEN.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <header style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px" }}>NEX Agents</h1>
              <p style={{ margin: "4px 0 0", color: TOKEN.textMid, fontSize: "14px" }}>
                Live observation · read-only · every value derived from real GB storage
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: TOKEN.textSoft }}>
              {loading ? "Loading…" : snapshot ? `Snapshot: ${new Date(snapshot.generated_at).toLocaleTimeString()}` : ""}
              {error && <span style={{ color: TOKEN.danger }}>Error: {error}</span>}
              <Link href="/nex-head-quarters" style={{ color: TOKEN.accent }}>← HQ</Link>
            </div>
          </div>
        </header>

        <Lane title="Orchestrator lane" agents={orchestratorAgents} />
        <div style={{ height: 24 }} />
        <Lane title="Intelligence lane" agents={intelligenceAgents} />

        <footer style={{ marginTop: "40px", padding: "12px", fontSize: "12px", color: TOKEN.textSoft, borderTop: `1px solid ${TOKEN.divider}` }}>
          Read-only observation surface. No button on this page grants authority, promotes knowledge, or writes to any collection.
          States derived deterministically from GB records per the Continuous Operation Doctrine §2.
        </footer>
      </div>
    </div>
  );
}

function Lane({ title, agents }: { title: string; agents: readonly AgentSnapshot[] }): React.ReactElement {
  return (
    <section>
      <h2 style={{ fontSize: "18px", margin: "0 0 12px", color: TOKEN.textMid }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
        {agents.map((a) => <AgentCard key={a.id} agent={a} />)}
      </div>
    </section>
  );
}

function AgentCard({ agent }: { agent: AgentSnapshot }): React.ReactElement {
  const dotColour = HEALTH_COLOUR[agent.health];
  return (
    <div style={{ background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: 14, boxShadow: TOKEN.shadowSm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-label={agent.state} title={agent.state} style={{ width: 10, height: 10, borderRadius: "50%", background: dotColour, display: "inline-block", flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</h3>
          </div>
          <div style={{ fontSize: 12, color: TOKEN.textSoft, marginTop: 2 }}>{agent.kind}</div>
        </div>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: dotColour, color: "#fff", flexShrink: 0 }}>{agent.state}</span>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: TOKEN.textMid, display: "grid", gap: 4 }}>
        <div><strong style={{ color: TOKEN.text }}>Assignment:</strong> {agent.current_assignment}</div>
        <div><strong style={{ color: TOKEN.text }}>Last activity:</strong> {agent.last_activity_at ? new Date(agent.last_activity_at).toLocaleString() : "never observed"}</div>
        <div><strong style={{ color: TOKEN.text }}>Last success:</strong> {agent.last_successful_task ? `${new Date(agent.last_successful_task.at).toLocaleTimeString()} · ${agent.last_successful_task.record_id.slice(0, 24)}…` : "none this session"}</div>
        <div><strong style={{ color: TOKEN.text }}>Records observed:</strong> {agent.total_records_observed}</div>
        {agent.recent_record_ids.length > 0 && (
          <div style={{ fontSize: 11, color: TOKEN.textSoft }}>
            Recent: {agent.recent_record_ids.map((id) => id.slice(0, 12) + "…").join(" · ")}
          </div>
        )}
      </div>

      {agent.non_normal_state && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: agent.health === "red" ? "rgba(220, 38, 38, 0.08)" : "rgba(245, 158, 11, 0.08)", border: `1px solid ${dotColour}`, fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: dotColour }}>{agent.state}</div>
          <div><strong>Reason:</strong> {agent.non_normal_state.reason}</div>
          <div><strong>Since:</strong> {new Date(agent.non_normal_state.entered_at).toLocaleString()}</div>
          <div><strong>Subsystem:</strong> {agent.non_normal_state.responsible_subsystem}</div>
          {agent.non_normal_state.evidence_pointer && (
            <div><strong>Evidence:</strong> {agent.non_normal_state.evidence_pointer.slice(0, 32)}…</div>
          )}
          {agent.non_normal_state.recovery_path && (
            <div><strong>Recovery:</strong> {agent.non_normal_state.recovery_path}</div>
          )}
        </div>
      )}

      {agent.academy && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.35)", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <strong style={{ color: TOKEN.info }}>Academy</strong>
            <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 10, background: TOKEN.info, color: "#fff" }}>{agent.academy.career_state}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <div>Task: {(agent.academy.task_completion_score * 100).toFixed(0)}%</div>
            <div>Knowledge: {(agent.academy.knowledge_contribution_score * 100).toFixed(0)}%</div>
            <div>Regression: {(agent.academy.regression_score * 100).toFixed(0)}%</div>
            <div>Profile v{agent.academy.capability_profile_version}</div>
          </div>
          {(agent.academy.notice_count.notice_1 + agent.academy.notice_count.notice_2 + agent.academy.notice_count.notice_3 > 0) && (
            <div style={{ marginTop: 4, fontSize: 11, color: TOKEN.warning }}>
              Notices — N1: {agent.academy.notice_count.notice_1} · N2: {agent.academy.notice_count.notice_2} · N3: {agent.academy.notice_count.notice_3}
            </div>
          )}
          {agent.academy.open_notices.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, color: TOKEN.warning }}>
              {agent.academy.open_notices.map((n, i) => (
                <div key={i}>· {n.kind}: {n.reason.slice(0, 50)}{n.reason.length > 50 ? "…" : ""}</div>
              ))}
            </div>
          )}
          {agent.academy.training && (agent.academy.training.active_programs > 0 || agent.academy.training.last_verdict) && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${TOKEN.divider}`, fontSize: 11, color: TOKEN.textMid }}>
              <strong style={{ color: TOKEN.text }}>Training:</strong>
              {agent.academy.training.active_programs > 0 && ` ${agent.academy.training.active_programs} program(s)`}
              {agent.academy.training.last_verdict && (
                <div style={{ marginTop: 2, color: agent.academy.training.last_verdict.kind === "IMPROVED" ? TOKEN.success : agent.academy.training.last_verdict.kind === "REGRESSION_INTRODUCED" ? TOKEN.danger : TOKEN.textMid }}>
                  Last verdict: <strong>{agent.academy.training.last_verdict.kind}</strong>
                </div>
              )}
              {agent.academy.training.last_verdict?.targeted_weakness && (
                <div style={{ marginTop: 2, fontSize: 10 }}>
                  Targeted weakness: {agent.academy.training.last_verdict.targeted_weakness.slice(0, 60)}{agent.academy.training.last_verdict.targeted_weakness.length > 60 ? "…" : ""}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
