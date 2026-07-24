"use client";

import { useEffect, useState } from "react";
import { AdminCandidateCard } from "./AdminCandidateCard";

type Candidate = {
  id: string;
  run_id: string;
  brain_slug: string;
  kind: string;
  payload: unknown;
  source_span: string | null;
  needs_author_source: boolean;
  provenance: { llm_model: string; proposed_at: string; prompt_version: string; input_hash: string };
  status: string;
  admin_status: string;
  review_history: unknown[];
};

export function AdminQueue({ brainSlug, adminId }: { brainSlug: string; adminId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus]   = useState<"loading" | "ready" | "error">("loading");
  const [error, setError]     = useState<string | null>(null);

  async function reload() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/brain-admin/queue?brain_slug=${encodeURIComponent(brainSlug)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus("error");
        setError(json.detail ?? json.error ?? `HTTP ${res.status}`);
        return;
      }
      setCandidates(json.candidates ?? []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => { reload(); }, [brainSlug]);

  async function review(candidate: Candidate, action: string, reason?: string, notes?: string, mergeTargetId?: string) {
    const res = await fetch(`/api/brain-admin/brains/${candidate.brain_slug}/candidates/${candidate.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: candidate.run_id, action, reason, notes, merge_target_id: mergeTargetId })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.detail ?? json.error ?? `HTTP ${res.status}`);
      return;
    }
    // Reload the queue — the reviewed candidate drops out.
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin queue · {brainSlug}</h1>
          <p className="text-xs text-[#0A0A0A]/60">Reviewer: {adminId}</p>
        </div>
        <button onClick={reload} className="text-xs underline">Refresh</button>
      </div>

      {status === "loading" && <p className="text-sm text-[#0A0A0A]/60">Loading...</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}

      {status === "ready" && candidates.length === 0 && (
        <div className="rounded border border-[#0A0A0A]/10 bg-white p-6">
          <p className="text-sm text-[#0A0A0A]/70">
            Queue is empty. Every Author-accepted candidate for this Brain has a terminal Admin decision.
          </p>
        </div>
      )}

      {status === "ready" && candidates.length > 0 && (
        <>
          <p className="text-xs text-[#0A0A0A]/60">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"} awaiting Admin decision. Nothing reaches the Runtime until every candidate is Approved, Rejected, or Merged.
          </p>
          <div className="space-y-3">
            {candidates.map((c) => (
              <AdminCandidateCard
                key={c.id}
                candidate={c}
                onReview={(action, reason, notes, mergeTargetId) => review(c, action, reason, notes, mergeTargetId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
