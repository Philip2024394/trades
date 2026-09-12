"use client";

// src/app/nex-head-quarters/review-queue/ReviewQueueClient.tsx

import { useEffect, useState } from "react";

interface ReviewRow {
  revisionId: string;
  capabilityId: string;
  capabilityTitle: string;
  version: string;
  parentVersion: string | null;
  lifecycleState: string;
  submittedAt: string;
  agentId: string;
  artifactId: string;
  filesCount: number;
  totalBytes: number;
  testsPassed: number;
  testsTotal: number;
  guardianVerdict: string | null;
  uiDnaVerdict: string | null;
  changeRequestId: string | null;
  previewUrl: string | null;
}

export function ReviewQueueClient() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/nex/review-queue/list", { cache: "no-store" });
        const j = await res.json();
        if (cancelled) return;
        setRows(j.rows ?? []);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load review queue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 6000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return <div className="nws-card" style={{ color: "var(--nws-slate)" }}>Loading review queue…</div>;
  }
  if (error) {
    return <div className="nws-card" style={{ color: "var(--nws-danger)" }}>Error: {error}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Queue empty</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>
          No revisions awaiting founder review. Revisions appear here when NEX1 completes a build and transitions to <code>AWAITING_PREVIEW</code> or <code>IN_REVIEW</code>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
      {rows.map((r) => (
        <CapCard key={r.revisionId} row={r} />
      ))}
    </div>
  );
}

function CapCard({ row }: { row: ReviewRow }) {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch("/api/nex/review-queue/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCapabilityId: row.capabilityId,
          targetRevisionId: row.revisionId,
          founderMessage: message,
          attachedManifestIds: [],
          founderSignature: signature,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setSubmitResult("Change request submitted · new revision will spawn");
        setMessage("");
      } else {
        setSubmitResult(`Rejected: ${j.reason ?? "unknown"} (${j.code ?? "no-code"})`);
      }
    } catch (e: any) {
      setSubmitResult(`Network error: ${e?.message ?? "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const stateColor =
    row.lifecycleState === "APPROVED"         ? "nws-badge-green"  :
    row.lifecycleState === "IN_REVIEW"        ? "nws-badge-cyan"   :
    row.lifecycleState === "AWAITING_PREVIEW" ? "nws-badge-amber"  :
    row.lifecycleState === "REQUEST_UPDATE"   ? "nws-badge-orange" :
    row.lifecycleState === "REJECTED"         ? "nws-badge-red"    : "nws-badge-slate";

  return (
    <article className="nws-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 15, margin: "0 0 2px" }}>{row.capabilityTitle}</h3>
          <div style={{ fontSize: 11, color: "var(--nws-slate)" }}>
            <code>{row.capabilityId}</code> · {row.version}
            {row.parentVersion && <> · parent {row.parentVersion}</>}
          </div>
        </div>
        <span className={`nws-badge ${stateColor}`}>{row.lifecycleState}</span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11 }}>
        <Meter label="Tests" value={`${row.testsPassed}/${row.testsTotal}`} tone={row.testsPassed === row.testsTotal ? "green" : "amber"} />
        <Meter label="Guardian" value={row.guardianVerdict ?? "…"} tone={row.guardianVerdict === "ACCEPT" ? "green" : row.guardianVerdict === "REJECT" ? "red" : "slate"} />
        <Meter label="UI DNA" value={row.uiDnaVerdict ?? "…"} tone={row.uiDnaVerdict === "PASS" ? "green" : row.uiDnaVerdict === "FAIL" ? "red" : "slate"} />
      </div>

      {row.previewUrl && (
        <a href={row.previewUrl} target="_blank" rel="noreferrer" className="nws-btn-secondary" style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}>
          ↗ Open preview
        </a>
      )}

      <details style={{ borderTop: "1px solid var(--nws-card-border)", paddingTop: 10 }}>
        <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--nws-cyan)", listStyle: "none" }}>
          Type a change request →
        </summary>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            className="nws-input"
            placeholder="What should change? Attach clear instructions · NEX1 uses this to spawn a new revision"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
          <input
            type="password"
            className="nws-input"
            placeholder="Founder signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            style={{ fontFamily: "inherit" }}
          />
          <button
            type="button"
            className="nws-btn-primary"
            onClick={submit}
            disabled={submitting || !message.trim() || !signature.trim()}
            style={{ opacity: (!message.trim() || !signature.trim()) ? 0.5 : 1 }}
          >
            {submitting ? "Submitting…" : "Submit change request"}
          </button>
          {submitResult && (
            <div style={{ fontSize: 11, color: submitResult.startsWith("Change request submitted") ? "var(--nws-success)" : "var(--nws-danger)" }}>
              {submitResult}
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

function Meter({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" | "slate" }) {
  const cls =
    tone === "green" ? "nws-badge-green"  :
    tone === "amber" ? "nws-badge-amber"  :
    tone === "red"   ? "nws-badge-red"    : "nws-badge-slate";
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 6, padding: 6, textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ marginTop: 2 }}><span className={`nws-badge ${cls}`}>{value}</span></div>
    </div>
  );
}
