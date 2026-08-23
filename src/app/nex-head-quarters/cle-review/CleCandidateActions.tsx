// CleCandidateActions · client component
//
// Task #76 Bundle B (2026-08-22): promotion + rejection UI for a single
// CLE candidate. POSTs to /api/nex/cle/promote-candidate · no client-side
// state derivation of promotion outcome (server decides) · refreshes page
// on success so the counts and pending list update.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CleCandidateActionsProps {
  candidateId: string;
}

type ActionState =
  | { kind: "idle" }
  | { kind: "pending"; action: "promote" | "reject" }
  | { kind: "success"; action: "promote" | "reject"; detail: string }
  | { kind: "error"; message: string };

export default function CleCandidateActions({ candidateId }: CleCandidateActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);

  async function submit(action: "promote" | "reject") {
    setState({ kind: "pending", action });
    try {
      const res = await fetch("/api/nex/cle/promote-candidate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          action,
          reviewer: "admin:hq",
          rejection_reason: action === "reject" ? (rejectionReason || "no reason provided") : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setState({ kind: "error", message: body?.error ?? `HTTP ${res.status}` });
        return;
      }
      const detail = action === "promote"
        ? `record_id=${body.record_id} · status=UNDER_REVIEW`
        : `rejected · ${body.rejection_reason}`;
      setState({ kind: "success", action, detail });
      setTimeout(() => router.refresh(), 800);
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (state.kind === "success") {
    return (
      <div style={successStyle}>
        ✓ {state.action === "promote" ? "PROMOTED" : "REJECTED"} · {state.detail}
      </div>
    );
  }

  return (
    <div style={rowStyle}>
      <button
        type="button"
        onClick={() => submit("promote")}
        disabled={state.kind === "pending"}
        style={promoteButtonStyle(state.kind === "pending")}
      >
        {state.kind === "pending" && state.action === "promote" ? "Promoting…" : "Promote → UNDER_REVIEW"}
      </button>
      {!showRejectPrompt ? (
        <button
          type="button"
          onClick={() => setShowRejectPrompt(true)}
          disabled={state.kind === "pending"}
          style={rejectButtonStyle}
        >
          Reject
        </button>
      ) : (
        <>
          <input
            type="text"
            placeholder="rejection reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            style={inputStyle}
            maxLength={500}
          />
          <button
            type="button"
            onClick={() => submit("reject")}
            disabled={state.kind === "pending"}
            style={rejectButtonStyle}
          >
            {state.kind === "pending" && state.action === "reject" ? "Rejecting…" : "Confirm reject"}
          </button>
          <button
            type="button"
            onClick={() => { setShowRejectPrompt(false); setRejectionReason(""); }}
            disabled={state.kind === "pending"}
            style={cancelButtonStyle}
          >
            Cancel
          </button>
        </>
      )}
      {state.kind === "error" && (
        <div style={errorStyle}>error: {state.message}</div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" };
function promoteButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    background: disabled ? "var(--nex-neutral-200)" : "rgba(16, 185, 129, 0.15)",
    color: disabled ? "var(--nex-neutral-500)" : "#047857",
    border: `1px solid ${disabled ? "var(--nex-neutral-300)" : "rgba(16, 185, 129, 0.55)"}`,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
  };
}
const rejectButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  background: "rgba(220, 38, 38, 0.08)",
  color: "#b91c1c",
  border: "1px solid rgba(220, 38, 38, 0.35)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const cancelButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  background: "transparent",
  color: "var(--nex-neutral-700)",
  border: "1px solid var(--nex-neutral-300)",
  fontSize: 12,
  cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--nex-neutral-300)",
  fontSize: 12,
  minWidth: 200,
};
const successStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  background: "rgba(16, 185, 129, 0.12)",
  color: "#047857",
  border: "1px solid rgba(16, 185, 129, 0.35)",
  fontSize: 12,
  fontWeight: 600,
  marginTop: 4,
};
const errorStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  background: "rgba(220, 38, 38, 0.08)",
  color: "#b91c1c",
  fontSize: 11,
};
