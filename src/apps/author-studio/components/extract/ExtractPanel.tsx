"use client";

import { useState } from "react";
import Link from "next/link";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS } from "../editors/_helpers";
import { CandidateCard } from "./CandidateCard";

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

type ExtractResponse = {
  ok: true;
  run_id: string;
  candidates: Candidate[];
  created_at: string;
  note: string;
} | { ok: false; error: string; detail: string };

export function ExtractPanel({ slug, authorId }: { slug: string; authorId: string }) {
  const [rawInput, setRawInput]  = useState("");
  const [moduleHint, setModuleHint] = useState("");
  const [runId, setRunId]        = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus]      = useState<"idle" | "running" | "reviewing" | "error">("idle");
  const [error, setError]        = useState<string | null>(null);

  async function runExtraction() {
    setStatus("running");
    setError(null);
    try {
      const res  = await fetch(`/api/authors/brains/${slug}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: rawInput, module_hint: moduleHint || undefined })
      });
      const json = await res.json() as ExtractResponse & { ok?: boolean };
      if (!res.ok || !json.ok) {
        setStatus("error");
        setError((json as { detail?: string; error?: string }).detail ?? (json as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      const j = json as Extract<ExtractResponse, { ok: true }>;
      setRunId(j.run_id);
      setCandidates(j.candidates);
      setStatus("reviewing");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runQaImport() {
    setStatus("running");
    setError(null);
    try {
      const res  = await fetch(`/api/authors/brains/${slug}/import-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: rawInput })
      });
      const json = await res.json() as (ExtractResponse & { ok?: boolean; skipped?: string[] });
      if (!res.ok || !json.ok) {
        setStatus("error");
        setError((json as { detail?: string; error?: string }).detail ?? (json as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      const j = json as Extract<ExtractResponse, { ok: true }> & { skipped?: string[] };
      setRunId(j.run_id);
      setCandidates(j.candidates);
      setStatus("reviewing");
      if (j.skipped && j.skipped.length > 0) {
        setError(`Imported ${j.candidates.length} pair(s) · skipped: ${j.skipped.join(" · ")}`);
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function confirmCandidate(candidateId: string, action: "accept" | "reject" | "edit", editedPayload?: unknown, notes?: string) {
    if (!runId) return;
    const res  = await fetch(`/api/authors/brains/${slug}/extract/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, candidate_id: candidateId, action, edited_payload: editedPayload, notes })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.detail ?? json.error ?? `HTTP ${res.status}`);
      return;
    }
    setCandidates((prev) => prev.map((c) => c.id === candidateId ? { ...c, ...(json.candidate as Candidate) } : c));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Teach Nex · {slug}</h1>
          <p className="text-xs text-[#0A0A0A]/60">Author: {authorId}</p>
        </div>
        <Link href={`/authors/brains/${slug}/edit`} className="text-xs underline">Back to editor</Link>
      </div>

      <section className="rounded border border-[#0A0A0A]/10 bg-white p-4">
        <p className="text-xs text-[#0A0A0A]/70">
          Paste raw trade knowledge, notes, voice transcript or written experience below. Nex proposes structured Knowledge Node candidates. You review each one · nothing enters your Brain draft until you Accept it · nothing reaches the Runtime until an Administrator subsequently approves it.
        </p>
        <p className="mt-2 text-xs text-[#0A0A0A]/60">
          <strong>Tip:</strong> start each topic with a single question — e.g. <em>&ldquo;How do I choose the right staircase style?&rdquo;</em> — and then write your answer. The question becomes the Primary Question for the Knowledge Node and makes the Brain easier to search.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="col-span-2 block">
            <span className="text-xs font-medium">Your knowledge</span>
            <textarea
              rows={10}
              className={INPUT_CLASS}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Start with a question, then write your answer..."
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium">Module hint (optional)</span>
            <select className={INPUT_CLASS} value={moduleHint} onChange={(e) => setModuleHint(e.target.value)}>
              <option value="">Let Nex decide</option>
              <option value="craft">Craft</option>
              <option value="regulations">Regulations</option>
              <option value="materials">Materials</option>
              <option value="workflow">Workflow</option>
              <option value="defects">Defects</option>
              <option value="pricing_model">Pricing Model</option>
            </select>
            <p className="mt-2 text-xs text-[#0A0A0A]/60">
              If you know this text is mostly about one module, pick it. Otherwise Nex will spread candidates across whichever kinds fit.
            </p>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={BUTTON_PRIMARY} onClick={runExtraction} disabled={status === "running" || rawInput.trim().length === 0}>
            {status === "running" ? "Teaching Nex..." : "Teach Nex (LLM · ~$0.50)"}
          </button>
          <button
            className="rounded bg-[#0A0A0A] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            onClick={runQaImport}
            disabled={status === "running" || rawInput.trim().length === 0}
          >
            {status === "running" ? "Importing..." : "Import Q&A (free · direct)"}
          </button>
          {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
        <p className="mt-3 text-xs text-[#0A0A0A]/60">
          <strong>Teach Nex</strong> uses Claude Opus to structure raw notes into candidates · ~$0.50 per run.
          {" "}<strong>Import Q&A</strong> parses already-structured Q&A pairs deterministically · $0 per run. Use ChatGPT or your own writing to produce lines like:
        </p>
        <pre className="mt-2 rounded bg-[#FBF6EC] p-2 text-xs">
{`Q: Should I paint or spray my staircase?
A: Brush painting is generally the more economical option...

Q: What's the best preparation?
A: Sanding, sealing exposed end grain...`}
        </pre>
      </section>

      {status === "reviewing" && candidates.length > 0 && (
        <section className="rounded border border-[#0A0A0A]/10 bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Review candidates</h2>
            <span className="text-xs text-[#0A0A0A]/60">
              {candidates.filter((c) => c.status === "accepted" || c.status === "edited").length} accepted ·
              {" "}{candidates.filter((c) => c.status === "rejected").length} rejected ·
              {" "}{candidates.filter((c) => c.status === "pending").length} pending
            </span>
          </div>
          <p className="mt-2 text-xs text-[#0A0A0A]/60">
            Every candidate is a proposal, not a decision. Read each one against your input. Accept only what you would sign your name to.
          </p>
          <div className="mt-3 space-y-3">
            {candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                onConfirm={(action, edited, notes) => confirmCandidate(c.id, action, edited, notes)}
              />
            ))}
          </div>
        </section>
      )}

      {status === "reviewing" && candidates.length === 0 && (
        <section className="rounded border border-[#0A0A0A]/10 bg-white p-4">
          <p className="text-sm text-[#0A0A0A]/70">
            Nex found nothing in your paste that mapped cleanly to a Brain module. Try a longer, more specific paste — or write directly into the module editors.
          </p>
        </section>
      )}
    </div>
  );
}
