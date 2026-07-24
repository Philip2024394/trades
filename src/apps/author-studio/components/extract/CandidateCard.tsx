"use client";

import { useState } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS } from "../editors/_helpers";

type Candidate = {
  id: string;
  kind: string;
  payload: unknown;
  source_span: string | null;
  needs_author_source: boolean;
  provenance: { llm_model: string; proposed_at: string; prompt_version: string; input_hash: string };
  status: "pending" | "accepted" | "rejected" | "edited";
  author_notes?: string;
};

type Props = {
  candidate: Candidate;
  onConfirm: (action: "accept" | "reject" | "edit", editedPayload?: unknown, notes?: string) => void;
};

export function CandidateCard({ candidate, onConfirm }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingSource, setEditingSource] = useState("");
  const [notes, setNotes] = useState("");

  const statusColor =
    candidate.status === "accepted" || candidate.status === "edited" ? "bg-green-100 text-green-900"
    : candidate.status === "rejected" ? "bg-red-100 text-red-900"
    : candidate.needs_author_source ? "bg-amber-100 text-amber-900"
    : "bg-[#FBF6EC] text-[#0A0A0A]";

  return (
    <div className={"rounded border border-[#0A0A0A]/10 p-3 " + statusColor}>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#0A0A0A]/60">{candidate.kind}</span>
          <span className="text-xs font-medium">{candidate.status}</span>
          {candidate.needs_author_source && (
            <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
              needs source
            </span>
          )}
        </div>
        <button className="text-xs underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "collapse" : "expand"}
        </button>
      </div>

      <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
        {JSON.stringify(candidate.payload, null, 2)}
      </pre>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-[#0A0A0A]/10 pt-3">
          <div>
            <span className="text-xs font-medium">Source span from your input</span>
            <div className="mt-1 rounded bg-white/60 p-2 text-xs italic">
              {candidate.source_span ?? <em className="text-[#0A0A0A]/50">(none — you must supply one)</em>}
            </div>
          </div>

          {candidate.needs_author_source && (
            <label className="block">
              <span className="text-xs font-medium">Add a citation (source) to enable Accept</span>
              <input
                className={INPUT_CLASS}
                value={editingSource}
                onChange={(e) => setEditingSource(e.target.value)}
                placeholder="e.g. BS 5395-1:2010 §6.1"
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium">Author notes (optional · captured in audit trail)</span>
            <input
              className={INPUT_CLASS}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="text-xs text-[#0A0A0A]/50">
            Proposed by {candidate.provenance.llm_model} at {candidate.provenance.proposed_at.slice(0, 16)} ·
            prompt {candidate.provenance.prompt_version}
          </div>
        </div>
      )}

      {candidate.status === "pending" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className={BUTTON_PRIMARY}
            disabled={candidate.needs_author_source && editingSource.trim() === ""}
            onClick={() => {
              if (candidate.needs_author_source) {
                const edited = withAppendedSource(candidate.payload, candidate.kind, editingSource);
                onConfirm("edit", edited, notes || undefined);
              } else {
                onConfirm("accept", undefined, notes || undefined);
              }
            }}
          >
            Accept
          </button>
          <button className={BUTTON_SECONDARY} onClick={() => onConfirm("reject", undefined, notes || undefined)}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

/** For `needs_author_source` candidates the Author supplies a citation
 *  by editing the payload's `evidence` field. This helper builds the
 *  edited payload without the Author needing to touch JSON. */
function withAppendedSource(payload: unknown, kind: string, source: string): unknown {
  const p = payload as Record<string, unknown>;
  const newEvidence = [{ source }];
  // All V1 module payload shapes carry `evidence` on their fact/rule/
  // playbook/material/defect/pricing-rule shapes — set it here.
  return { ...p, evidence: newEvidence };
}
