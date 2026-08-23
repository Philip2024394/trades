// DecisionButtons · Phase 2 · 2026-08-23
// Client-side action panel · one per pending candidate.
//
// Never writes anywhere directly. Every action POSTs to
// /api/nex-head-quarters/directory-factory/decide which is the ONLY
// server-side entry point that mutates a candidate's admin_decision.
//
// Reviewer identity: dev-friendly text input persisted to localStorage.
// In production this would be replaced by real HQ auth, but no auth
// stack change is in scope for Phase 2.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Decision = "approved" | "rejected" | "duplicate" | "superseded";

export function DecisionButtons({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [reviewer, setReviewer] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [duplicateOf, setDuplicateOf] = useState<string>("");
  const [supersededBy, setSupersededBy] = useState<string>("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load reviewer from localStorage on mount so admins don't retype every time.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("nex.hq.directoryFactory.reviewer");
      if (saved) setReviewer(saved);
    } catch {
      /* ignore · localStorage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!reviewer) return;
    try {
      window.localStorage.setItem("nex.hq.directoryFactory.reviewer", reviewer);
    } catch {
      /* ignore */
    }
  }, [reviewer]);

  async function decide(decision: Decision) {
    setError(null);
    if (!reviewer.trim()) {
      setError("Reviewer name required.");
      return;
    }
    if (decision === "duplicate" && !duplicateOf.trim()) {
      setError("For 'duplicate', provide the existing Registry id it duplicates.");
      return;
    }
    if (decision === "superseded" && !supersededBy.trim()) {
      setError("For 'superseded', provide the newer candidate id that supersedes this one.");
      return;
    }
    setBusy(decision);
    try {
      const res = await fetch("/api/nex-head-quarters/directory-factory/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          decision,
          reviewed_by: reviewer.trim(),
          notes: notes.trim() || undefined,
          duplicate_of_registry_id: decision === "duplicate" ? duplicateOf.trim() : undefined,
          superseded_by_candidate_id: decision === "superseded" ? supersededBy.trim() : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setError(body?.reason ?? body?.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      // Success · refresh server component to re-fetch the candidate list.
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={reviewerRowStyle}>
        <label style={labelStyle}>
          Reviewer
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="your name / email"
            style={inputStyle}
          />
        </label>
      </div>

      <label style={labelStyle}>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="why approve / reject / duplicate / superseded"
          style={{ ...inputStyle, resize: "vertical", minHeight: 36 }}
        />
      </label>

      <div style={optionalRowStyle}>
        <label style={labelStyle}>
          duplicate_of_registry_id
          <input
            type="text"
            value={duplicateOf}
            onChange={(e) => setDuplicateOf(e.target.value)}
            placeholder="existing Registry id (only for 'duplicate')"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          superseded_by_candidate_id
          <input
            type="text"
            value={supersededBy}
            onChange={(e) => setSupersededBy(e.target.value)}
            placeholder="uuid of newer candidate (only for 'superseded')"
            style={inputStyle}
          />
        </label>
      </div>

      {error && <div style={errorStyle}>Error: {error}</div>}

      <div style={buttonRowStyle}>
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={busy !== null}
          style={buttonStyle("approved", busy === "approved")}
        >
          {busy === "approved" ? "…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={busy !== null}
          style={buttonStyle("rejected", busy === "rejected")}
        >
          {busy === "rejected" ? "…" : "Reject"}
        </button>
        <button
          type="button"
          onClick={() => decide("duplicate")}
          disabled={busy !== null}
          style={buttonStyle("duplicate", busy === "duplicate")}
        >
          {busy === "duplicate" ? "…" : "Duplicate of…"}
        </button>
        <button
          type="button"
          onClick={() => decide("superseded")}
          disabled={busy !== null}
          style={buttonStyle("superseded", busy === "superseded")}
        >
          {busy === "superseded" ? "…" : "Superseded by…"}
        </button>
      </div>

      <div style={hintStyle}>
        Approving a candidate persists <code>admin_decision='approved'</code> only.
        A Registry row + directory route + wheel + Brain intent are Phase 3 work — not created here.
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 12,
  marginTop: 10,
  background: "rgba(249,115,22,0.05)",
  border: "1px solid rgba(249,115,22,0.20)",
  borderRadius: 12,
};
const reviewerRowStyle: React.CSSProperties = { display: "flex", gap: 10 };
const optionalRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 10,
  color: "rgba(0,0,0,0.6)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  flex: 1,
};
const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  borderRadius: 8,
  background: "#fff",
  color: "#1a1a1a",
  fontFamily: "inherit",
};
const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};
function buttonStyle(decision: Decision, busy: boolean): React.CSSProperties {
  const colors: Record<Decision, string> = {
    approved:   "#16a34a",
    rejected:   "#dc2626",
    duplicate:  "#9333ea",
    superseded: "#64748b",
  };
  return {
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    background: colors[decision],
    border: "none",
    borderRadius: 8,
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.6 : 1,
    minWidth: 100,
  };
}
const errorStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "rgba(239,68,68,0.10)",
  border: "1px solid rgba(239,68,68,0.35)",
  color: "#b91c1c",
  borderRadius: 8,
  fontSize: 12,
};
const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(0,0,0,0.55)",
  lineHeight: 1.4,
  marginTop: 4,
};
