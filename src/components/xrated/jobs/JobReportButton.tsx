"use client";

// Xrated Trades — inline "report this job" button mirroring TradeReportButton.
// POSTs to /api/trade-off/jobs/report (Agent B). Short reason list, no body.

import { useState } from "react";

const REASONS = [
  "Fake job",
  "Inappropriate content",
  "Wrong trade",
  "Spam",
  "Other"
] as const;

type Status = "idle" | "open" | "submitting" | "done" | "error";

export function JobReportButton({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [reason, setReason] = useState<string>(REASONS[0]);

  async function submit() {
    setStatus("submitting");
    try {
      const res = await fetch("/api/trade-off/jobs/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, reason })
      });
      if (!res.ok) throw new Error("bad status");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-xs text-brand-success">
        Reported — thanks for helping keep Xrated Trades clean.
      </p>
    );
  }

  if (status === "open" || status === "submitting" || status === "error") {
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-4">
        <p className="text-xs font-semibold text-brand-text">Report this job</p>
        <p className="mt-1 text-xs text-brand-muted">
          Only use this for genuinely fake or inappropriate posts. We review every report.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="job-report-reason">Reason</label>
          <select
            id="job-report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={status === "submitting"}
            className="h-11 flex-1 rounded-lg border border-brand-line bg-white px-3 text-xs text-brand-text focus:border-[#FFB300] focus:outline-none"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={status === "submitting"}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-brand-line bg-white px-4 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300] disabled:opacity-60"
          >
            {status === "submitting" ? "Submitting…" : "Submit report"}
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            disabled={status === "submitting"}
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-xs text-brand-muted transition hover:text-brand-text"
          >
            Cancel
          </button>
        </div>
        {status === "error" && (
          <p className="mt-2 text-xs text-red-600">Could not submit. Try again.</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStatus("open")}
      className="text-xs text-brand-muted underline-offset-4 transition hover:text-brand-text hover:underline"
    >
      Report this job
    </button>
  );
}

export default JobReportButton;
