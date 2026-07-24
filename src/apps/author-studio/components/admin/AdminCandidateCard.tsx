"use client";

import { useState } from "react";

type Candidate = {
  id: string;
  run_id: string;
  kind: string;
  payload: unknown;
  source_span: string | null;
  needs_author_source: boolean;
  provenance: { llm_model: string; proposed_at: string; prompt_version: string; input_hash: string };
  status: string;
  admin_status: string;
  review_history: unknown[];
};

type Props = {
  candidate: Candidate;
  onReview: (action: string, reason?: string, notes?: string, mergeTargetId?: string) => void;
};

const BUTTON_APPROVE  = "rounded bg-[#166534] px-3 py-1.5 text-xs font-medium text-white";
const BUTTON_REJECT   = "rounded bg-red-700  px-3 py-1.5 text-xs font-medium text-white";
const BUTTON_NEUTRAL  = "rounded border border-[#0A0A0A]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#0A0A0A]";

export function AdminCandidateCard({ candidate, onReview }: Props) {
  const [expanded, setExpanded]     = useState(false);
  const [reason, setReason]         = useState("");
  const [notes, setNotes]           = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [showMerge, setShowMerge]   = useState(false);

  return (
    <div className="rounded border border-[#0A0A0A]/10 bg-white p-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#0A0A0A]/60">{candidate.kind}</span>
          <span className="rounded bg-[#FBF6EC] px-2 py-0.5 text-xs">Author: {candidate.status}</span>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Admin: {candidate.admin_status}
          </span>
        </div>
        <button className="text-xs underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "collapse" : "expand"}
        </button>
      </div>

      {(() => {
        const payload = candidate.payload as { classification?: string; safety_note?: string } | undefined;
        if (payload?.safety_note || payload?.classification === "repair_procedure" || payload?.classification === "safety_advice") {
          return (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <div className="font-semibold">
                {payload.classification === "safety_advice" ? "Safety advice" : payload.classification === "repair_procedure" ? "Repair procedure — review carefully" : "Safety note"}
              </div>
              {payload.safety_note && <div className="mt-1">{payload.safety_note}</div>}
            </div>
          );
        }
        return null;
      })()}

      <pre className="mt-2 whitespace-pre-wrap break-words text-xs bg-[#FBF6EC] p-2 rounded">
        {JSON.stringify(candidate.payload, null, 2)}
      </pre>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[#0A0A0A]/10 pt-3 text-xs">
          <div>
            <strong>Source span:</strong>
            <div className="mt-1 rounded bg-[#FBF6EC]/60 p-2 italic">
              {candidate.source_span ?? <em className="text-[#0A0A0A]/50">(Author supplied — no LLM span)</em>}
            </div>
          </div>
          <div>
            <strong>Provenance:</strong> {candidate.provenance.llm_model} at {candidate.provenance.proposed_at.slice(0, 16)} · prompt {candidate.provenance.prompt_version} · input {candidate.provenance.input_hash}
          </div>
          <div>
            <strong>Review history:</strong>
            <ol className="mt-1 space-y-1 list-decimal list-inside">
              {(candidate.review_history ?? []).map((e, i) => (
                <li key={i} className="font-mono text-[10px]">{JSON.stringify(e)}</li>
              ))}
              {(candidate.review_history ?? []).length === 0 && <li className="text-[#0A0A0A]/50 italic">no events yet</li>}
            </ol>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded border border-[#0A0A0A]/20 bg-white px-2 py-1.5 text-xs"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required for reject / request changes)"
          />
          <input
            className="rounded border border-[#0A0A0A]/20 bg-white px-2 py-1.5 text-xs"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
          />
        </div>
        {showMerge && (
          <input
            className="rounded border border-[#0A0A0A]/20 bg-white px-2 py-1.5 text-xs w-full"
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            placeholder="Existing node id to merge into"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={BUTTON_APPROVE}
            onClick={() => onReview("approve", reason || undefined, notes || undefined)}
          >
            Approve
          </button>
          <button
            className={BUTTON_REJECT}
            disabled={reason.trim() === ""}
            onClick={() => onReview("reject", reason, notes || undefined)}
          >
            Reject
          </button>
          <button
            className={BUTTON_NEUTRAL}
            disabled={reason.trim() === ""}
            onClick={() => onReview("request_changes", reason, notes || undefined)}
          >
            Request changes
          </button>
          <button
            className={BUTTON_NEUTRAL}
            onClick={() => setShowMerge((v) => !v)}
          >
            {showMerge ? "Cancel merge" : "Merge with existing…"}
          </button>
          {showMerge && (
            <button
              className={BUTTON_APPROVE}
              disabled={mergeTarget.trim() === ""}
              onClick={() => onReview("merge", reason || undefined, notes || undefined, mergeTarget)}
            >
              Confirm merge
            </button>
          )}
          <button
            className={BUTTON_NEUTRAL}
            onClick={() => onReview("send_back", reason || undefined, notes || undefined)}
          >
            Send back to Author
          </button>
        </div>
      </div>
    </div>
  );
}
