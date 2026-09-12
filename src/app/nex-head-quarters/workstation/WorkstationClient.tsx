"use client";

// src/app/nex-head-quarters/workstation/WorkstationClient.tsx
//
// Live split-workspace client. LEFT = preview iframe with viewport controls.
// RIGHT = current task · events · files · tests · security · review.

import { useEffect, useMemo, useState } from "react";

type Viewport = "mobile" | "tablet" | "desktop" | "fluid";

interface PreviewableRevision {
  readonly revision_id: string;
  readonly capability_id: string;
  readonly version: string;
  readonly lifecycle_state: string;
  readonly preview_url: string | null;
}

interface WorkstationEvent {
  readonly at: string;
  readonly kind: string;
  readonly agentId: string;
  readonly detail: string;
  readonly files?: readonly string[];
}

interface WorkstationTask {
  readonly taskId: string;
  readonly capabilityId: string | null;
  readonly targetRevisionId: string | null;
  readonly summary: string;
  readonly startedAt: string;
  readonly ownerAgentId: string;
  readonly status: "IDLE" | "ACTIVE" | "AWAITING_REVIEW" | "COMPLETE" | "FAILED";
  readonly events: readonly WorkstationEvent[];
}

interface StatusResponse {
  ok: boolean;
  task: WorkstationTask | null;
  idle: boolean;
  revisions_count: number;
  previewable_revisions: PreviewableRevision[];
  generated_at: string;
}

const VIEWPORT_SIZES: Record<Viewport, { w: number | "100%"; h: number | "100%"; label: string }> = {
  mobile:  { w: 390,   h: 844,   label: "iPhone · 390 × 844" },
  tablet:  { w: 820,   h: 1180,  label: "Tablet · 820 × 1180" },
  desktop: { w: 1440,  h: 900,   label: "Desktop · 1440 × 900" },
  fluid:   { w: "100%", h: "100%", label: "Fluid · fills panel" },
};

export function WorkstationClient() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Poll workstation status every 4s
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/nex/workstation/status", { cache: "no-store" });
        const j = (await res.json()) as StatusResponse;
        if (!cancelled) setStatus(j);
      } catch {
        // network failure · leave previous status intact rather than fake data
      }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const previewables = status?.previewable_revisions ?? [];
  const iframeSrc = useMemo(() => {
    if (!selectedPreviewUrl) return null;
    return `${selectedPreviewUrl}?_t=${reloadNonce}`;
  }, [selectedPreviewUrl, reloadNonce]);

  const size = VIEWPORT_SIZES[viewport];

  return (
    <div className="nws-split">
      {/* ─── LEFT · real preview iframe · viewport controls ────────────── */}
      <section className="nws-card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--nws-card-border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="nws-badge nws-badge-cyan">LIVE PREVIEW</span>
          <ViewportPicker current={viewport} onChange={setViewport} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="nws-btn-secondary"
            onClick={() => { setPreviewError(null); setReloadNonce((n) => n + 1); }}
            aria-label="Reload preview"
          >
            ↻ Reload
          </button>
        </div>

        <PreviewSelector
          revisions={previewables}
          selectedUrl={selectedPreviewUrl}
          onSelect={(url) => { setSelectedPreviewUrl(url); setPreviewError(null); setReloadNonce((n) => n + 1); }}
        />

        <div style={{ flex: 1, background: "#050810", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16 }}>
          {iframeSrc ? (
            <div style={{
              width: size.w,
              height: size.h,
              maxWidth: "100%",
              maxHeight: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              border: "1px solid var(--nws-card-border)",
              borderRadius: 8,
              overflow: "hidden",
              background: "#0B1220",
              position: "relative",
            }}>
              {previewError ? (
                <div style={{ padding: 24, color: "var(--nws-danger)", fontSize: 13, textAlign: "center" }}>
                  <strong>Preview error</strong>
                  <div style={{ marginTop: 8, color: "var(--nws-slate)" }}>{previewError}</div>
                </div>
              ) : (
                <iframe
                  key={iframeSrc}
                  src={iframeSrc}
                  title="NEX section preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  style={{ width: "100%", height: "100%", border: "none", background: "#FFFFFF00" }}
                  onError={() => setPreviewError("iframe failed to load · check preview eligibility (must be AWAITING_PREVIEW / IN_REVIEW / APPROVED / ACTIVATING / REQUEST_UPDATE)")}
                />
              )}
            </div>
          ) : (
            <IdlePreviewPlaceholder />
          )}
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--nws-card-border)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nws-slate)" }}>
          <span>Preview isolated from production · not deployed live</span>
          <span>{size.label}</span>
        </div>
      </section>

      {/* ─── RIGHT · NEX1 code/build/test/diagnostics ──────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
        <TaskCard task={status?.task ?? null} idle={status?.idle ?? true} />
        <EventTimeline events={status?.task?.events ?? []} />
        <BuildDiagnostics task={status?.task ?? null} />
        <RevisionsIndex revisions={previewables} />
      </section>
    </div>
  );
}

function ViewportPicker({ current, onChange }: { current: Viewport; onChange: (v: Viewport) => void }) {
  const options: Viewport[] = ["mobile", "tablet", "desktop", "fluid"];
  return (
    <div style={{ display: "inline-flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3, border: "1px solid var(--nws-card-border)" }}>
      {options.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "none",
            background: current === v ? "rgba(34, 211, 238, 0.18)" : "transparent",
            color: current === v ? "var(--nws-cyan)" : "var(--nws-slate)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function PreviewSelector({
  revisions,
  selectedUrl,
  onSelect,
}: {
  revisions: readonly PreviewableRevision[];
  selectedUrl: string | null;
  onSelect: (url: string | null) => void;
}) {
  if (revisions.length === 0) {
    return (
      <div style={{ padding: "10px 16px", background: "rgba(148,163,184,0.04)", borderBottom: "1px solid var(--nws-card-border)", fontSize: 12, color: "var(--nws-slate)" }}>
        No preview-eligible revisions · start a build in workstation to see preview here
      </div>
    );
  }
  return (
    <div style={{ padding: "10px 16px", background: "rgba(148,163,184,0.04)", borderBottom: "1px solid var(--nws-card-border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Revision</span>
      <select
        className="nws-input"
        style={{ width: "auto", minWidth: 260 }}
        value={selectedUrl ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">— pick a preview-eligible revision —</option>
        {revisions.map((r) => (
          <option key={r.revision_id} value={r.preview_url ?? ""}>
            {r.capability_id} · {r.version} · {r.lifecycle_state}
          </option>
        ))}
      </select>
    </div>
  );
}

function IdlePreviewPlaceholder() {
  return (
    <div style={{ textAlign: "center", color: "var(--nws-slate)", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>◧</div>
      <div style={{ color: "var(--nws-soft-white)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        No preview selected
      </div>
      <div style={{ maxWidth: 320 }}>
        Pick a preview-eligible revision above · or start a NEX1 build. The preview here reflects the isolated build · never production.
      </div>
    </div>
  );
}

function TaskCard({ task, idle }: { task: WorkstationTask | null; idle: boolean }) {
  if (idle || !task) {
    return (
      <div className="nws-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>Current task</h3>
          <span className="nws-badge nws-badge-slate">IDLE</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>
          NEX1 has no active build task. When a section build starts, this card reflects the CAP · summary · lifecycle · files touched · test results.
        </p>
      </div>
    );
  }
  const badgeClass =
    task.status === "ACTIVE"          ? "nws-badge-cyan"   :
    task.status === "AWAITING_REVIEW" ? "nws-badge-amber"  :
    task.status === "COMPLETE"        ? "nws-badge-green"  :
    task.status === "FAILED"          ? "nws-badge-red"    : "nws-badge-slate";
  return (
    <div className="nws-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>Current task</h3>
        <span className={`nws-badge ${badgeClass}`}>{task.status}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--nws-soft-white)", marginBottom: 6 }}>{task.summary}</div>
      <div style={{ fontSize: 11, color: "var(--nws-slate)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span>Task <code>{task.taskId}</code></span>
        {task.capabilityId && <span>· <code>{task.capabilityId}</code></span>}
        <span>· Owner <code>{task.ownerAgentId}</code></span>
        <span>· Started {new Date(task.startedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: readonly WorkstationEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Build events</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>
          No events yet · will populate on build start, test run, review, revision.
        </p>
      </div>
    );
  }
  return (
    <div className="nws-card">
      <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Build events · {events.length}</h3>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {events.slice(-20).reverse().map((e, i) => (
          <li key={`${e.at}-${i}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12 }}>
            <span style={{ color: "var(--nws-slate)", minWidth: 68 }}>{new Date(e.at).toLocaleTimeString()}</span>
            <span className={`nws-badge ${badgeForKind(e.kind)}`} style={{ minWidth: 84, justifyContent: "center" }}>{e.kind}</span>
            <span style={{ color: "var(--nws-soft-white)" }}>{e.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function badgeForKind(k: string): string {
  if (k.endsWith("_ok"))       return "nws-badge-green";
  if (k.endsWith("_failed"))   return "nws-badge-red";
  if (k.endsWith("_started"))  return "nws-badge-cyan";
  if (k === "review_findings") return "nws-badge-amber";
  if (k === "correction")      return "nws-badge-orange";
  return "nws-badge-slate";
}

function BuildDiagnostics({ task }: { task: WorkstationTask | null }) {
  if (!task) return null;
  const okEvents = task.events.filter((e) => e.kind.endsWith("_ok")).length;
  const failedEvents = task.events.filter((e) => e.kind.endsWith("_failed")).length;
  return (
    <div className="nws-card">
      <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Diagnostics</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
        <Stat label="OK events" value={okEvents} tone="green" />
        <Stat label="Failed" value={failedEvents} tone={failedEvents > 0 ? "red" : "slate"} />
        <Stat label="Total events" value={task.events.length} tone="cyan" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "cyan" | "slate" }) {
  const color =
    tone === "green" ? "var(--nws-success)" :
    tone === "red"   ? "var(--nws-danger)"  :
    tone === "cyan"  ? "var(--nws-cyan)"    : "var(--nws-slate)";
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function RevisionsIndex({ revisions }: { revisions: readonly PreviewableRevision[] }) {
  return (
    <div className="nws-card">
      <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Preview-eligible revisions · {revisions.length}</h3>
      {revisions.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>
          No revisions in preview-eligible states. Revisions appear here once they enter AWAITING_PREVIEW / IN_REVIEW / APPROVED / ACTIVATING / REQUEST_UPDATE.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          {revisions.map((r) => (
            <li key={r.revision_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span><code>{r.capability_id}</code> · {r.version}</span>
              <span className="nws-badge nws-badge-slate">{r.lifecycle_state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
